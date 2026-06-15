class TableCellExtractor:

    def extract(self, node):

        if isinstance(node, dict):

            return {
                "content": node.get(
                    "text",
                    ""
                ),
                "rows": node.get(
                    "rows",
                    []
                ),
                "formatting": node.get(
                    "formatting",
                    {}
                )
            }

        return {
            "content": node.text,
            "rows": node.metadata.get(
                "rows",
                []
            ),
            "formatting": node.metadata.get(
                "formatting",
                {}
            )
        }