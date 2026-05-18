from placeholders.validator import find_placeholders
from placeholders.occurrence_generator import OccurrenceGenerator
from placeholders.context_extractor import extract_context


class PlaceholderExtractor:

    def __init__(self):
        self.occurrence_generator = OccurrenceGenerator()

    def extract(self, canonical_document_tree):

        inventory = []

        # canonical_document_tree is ROOT DocumentNode
        for node in canonical_document_tree.children:

            self._traverse_node(node, inventory)

        return inventory

    def _traverse_node(self, node, inventory):

        # Only scan paragraph nodes
        # Prevent duplicate detection from table/row/cell nodes
        if (
            node.type == "paragraph"
            and node.text
        ):

            placeholders = find_placeholders(node.text)

            for placeholder in placeholders:

                occurrence = self._build_occurrence(
                    node=node,
                    placeholder=placeholder
                )

                inventory.append(occurrence)

        # Recursively traverse child nodes
        for child in node.children:

            self._traverse_node(child, inventory)

    def _build_occurrence(self, node, placeholder):

        context = extract_context(
            node.text,
            placeholder
        )

        # -----------------------------------------
        # INLINE CONTEXT
        # (same paragraph)
        # ----------------------------------------- 

        inline_context = extract_context(
            node.text,
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

        text_span = self._build_text_span(
            node.text,
            placeholder
        )

        return {    
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
            }
        }

    def _build_table_path(self, location):

        table = location.table_index
        row = location.row_index
        cell = location.cell_index

        if table is None:
            return None

        # Human-readable 1-based indexing
        return f"T{table + 1}/R{row + 1}/C{cell + 1}"

    def _build_text_span(
        self,
        text,
        placeholder
    ):
        """
        Returns placeholder character span
        inside reconstructed paragraph text.
        """

        start = text.find(placeholder)

        if start == -1:
            return {
                "start": None,
                "end": None
            }

        end = start + len(placeholder)

        return {
            "start": start,
            "end": end
        }