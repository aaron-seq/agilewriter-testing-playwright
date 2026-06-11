class TableCellExtractor:

    def extract(self, node):

        return {
            "content": node.get("text", ""),
            "rows": node.get("rows", []),
            "formatting": node.get("formatting", {})
        }