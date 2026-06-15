from placeholders.validator import (
    find_placeholders,
    find_placeholder_matches
)
from placeholders.occurrence_generator import OccurrenceGenerator
from placeholders.context_extractor import extract_context
from models.nodes import RevisionFragment


class PlaceholderExtractor:

    def __init__(self):
        self.occurrence_generator = OccurrenceGenerator()

    def extract(self, canonical_document_tree):

        inventory = []

        # canonical_document_tree is ROOT DocumentNode
        for node in canonical_document_tree.children:

            self._traverse_node(node, inventory)

        return inventory

    def _get_search_text(self, node):
        """
        Get the text to search for placeholders.
        
        For documents with tracked changes, placeholders are stored
        in w:del elements (deleted text), so node.text (visible text)
        won't contain them. We use combined_text which includes deleted
        text to ensure placeholders are found.
        
        Returns (search_text, has_deleted_placeholders)
        """
        # Use combined_text from metadata if available (includes deleted revisions)
        combined = node.metadata.get("combined_text", "") if node.metadata else ""
        if combined:
            return combined, True

        # Fall back to node.text (for documents without tracked changes)
        return node.text or "", False

    def _traverse_node(self, node, inventory):

        # Scan text-bearing nodes: paragraph, list_item, AND cell
        if node.type in ["paragraph", "list_item", "cell"]:

            search_text, has_deleted = self._get_search_text(node)

            if search_text:
                # -------------------------------------------------
                # Find placeholders in the search text
                # (which includes deleted text if revisions exist)
                # -------------------------------------------------
                matches = find_placeholder_matches(search_text)

                for match in matches:

                    occurrence = self._build_occurrence(
                        node=node,
                        placeholder=match.group(0),
                        match=match,
                        search_text=search_text,
                        revision_source="normal"
                    )

                    inventory.append(occurrence)

            # -------------------------------------------------
            # Also check revision fragments for placeholders
            # that might not appear in combined_text
            # -------------------------------------------------
            if hasattr(node, 'revision_fragments') and node.revision_fragments:
                self._check_revision_fragments(node, inventory)

        # Recursively traverse child nodes (always, even if this node has no text)
        for child in node.children:
            self._traverse_node(child, inventory)

    def _check_revision_fragments(self, node, inventory):
        """Check revision fragments for additional placeholders."""
        for frag in node.revision_fragments:
            if frag.source == "deleted" and frag.text:
                frag_matches = find_placeholder_matches(frag.text)
                for match in frag_matches:
                    placeholder = match.group(0)
                    # Avoid duplicates - only add if not already in inventory
                    # for this node
                    if placeholder not in (
                        o["placeholder"]
                        for o in inventory
                        if o["node_id"] == node.id
                    ):
                        occurrence = self._build_occurrence(
                            node=node,
                            placeholder=placeholder,
                            match=match,
                            search_text=frag.text,
                            revision_source=frag.source,
                            revision_type=frag.revision_type
                        )
                        inventory.append(occurrence)

    def _build_occurrence(
        self,
        node,
        placeholder,
        match,
        search_text=None,
        revision_source="normal",
        revision_type=None
    ):

        if search_text is None:
            search_text = node.text or ""

        context = extract_context(
            search_text,
            placeholder
        )

        # -----------------------------------------
        # INLINE CONTEXT
        # (same paragraph)
        # ----------------------------------------- 

        inline_context = extract_context(
            search_text,
            placeholder
        )

        # -----------------------------------------
        # NEIGHBOR CONTEXT
        # (previous/next structural nodes)
        # -----------------------------------------

        neighbor_context = {
            "before": "",
            "after": ""
        }

        if node.context:

            neighbor_context["before"] = (
                node.context.before_text or ""
            )

            neighbor_context["after"] = (
                node.context.after_text or ""
            )

        location = node.location

        text_span = {
            "start": match.start(),
            "end": match.end()
        }

        occurrence = {    
            "occurrence_id":
                self.occurrence_generator.next_id(),

            "placeholder":
                placeholder,

            "node_id":
                node.id,

            "node_type":
                node.type,

            "section":
                location.section,

            "paragraph_index":
                location.paragraph_index,

            "table_index":
                location.table_index,

            "matched_text_span":
                text_span,

            "row_index":
                location.row_index,

            "cell_index":
                location.cell_index,

            "table_path":
                self._build_table_path(location),

            "inline_context": {
                "before": inline_context["context_before"],
                "after": inline_context["context_after"]
            },

            "neighbor_context": {
                "before": neighbor_context["before"],
                "after": neighbor_context["after"]
            },

            # -------------------------------------------------
            # REVISION METADATA
            # Tracks whether this placeholder was found in a
            # tracked deletion vs. normal text
            # -------------------------------------------------
            "revision_source": revision_source,
        }

        # Add revision_type if available
        if revision_type:
            occurrence["revision_type"] = revision_type

        return occurrence

    def _build_table_path(self, location):

        table = location.table_index
        row = location.row_index
        cell = location.cell_index

        if table is None:
            return None

        # Human-readable 1-based indexing
        return f"T{table + 1}/R{row + 1}/C{cell + 1}"