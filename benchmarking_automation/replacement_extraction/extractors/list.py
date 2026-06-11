class ListExtractor:

    def extract(self, node):

        return {
            "items": node.get("items", []),
            "list_type": node.get("list_type", "bullet")
        }