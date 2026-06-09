from replacement_extraction.formatting_serializer import FormattingSerializer


class ParagraphExtractor:

    def extract(self, node):

        return {
            "content": node.get("text", ""),
            "formatting": FormattingSerializer.serialize_runs(
                node.get("runs", [])
            )
        }