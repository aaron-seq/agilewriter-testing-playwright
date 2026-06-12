from replacement_extraction.formatting_serializer import FormattingSerializer

class ParagraphExtractor:

    def extract(self, node):

        if isinstance(node, dict):

            text = node.get("text", "")
            runs = node.get("runs", [])

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