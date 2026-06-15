class ListExtractor:

    def extract(self, node):

        if isinstance(node, dict):

            text = node.get("text", "")
            return {
                "content": text,
                "items": node.get(
                    "items",
                    []
                ) or ([text] if text else []),
                "list_type": node.get(
                    "list_type",
                    "bullet"
                )
            }

        text = node.text or ""
        items = []
        if node.metadata:
            items = node.metadata.get("items", [])

        # If no items in metadata but text exists, use text as the item
        if not items and text:
            items = [text]

        return {
            "content": text,
            "items": items,
            "list_type": node.metadata.get(
                "list_type",
                "bullet"
            ) if node.metadata else "bullet"
        }