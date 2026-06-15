from replacement_extraction.formatting_serializer import FormattingSerializer

class ParagraphExtractor:

    def extract(self, node):

        if isinstance(node, dict):

            text = node.get("text", "")
            runs = node.get("runs", [])

        else:

            # Prefer visible_text if available (excludes deleted revisions)
            # Falls back to node.text if revision_fragments not present
            if hasattr(node, 'revision_fragments') and node.revision_fragments:
                # Build visible text from normal + inserted fragments
                visible_parts = []
                for frag in node.revision_fragments:
                    if frag.source != "deleted":
                        visible_parts.append(frag.text)
                text = "".join(visible_parts) if visible_parts else node.text
            else:
                text = node.text

            runs = node.rich_runs

        return {
            "content": text,
            "formatting":
                FormattingSerializer.serialize_runs(
                    runs
                )
        }
