class TableExtractor:

    def extract(self, node):

        return {
            "rows": node.get("rows", []),
            "style": node.get("style", {})
        }