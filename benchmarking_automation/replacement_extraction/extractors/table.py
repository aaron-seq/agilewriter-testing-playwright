class TableExtractor:

    def extract(self, node):

        if isinstance(node, dict):

            return {
                "rows": node.get(
                    "rows",
                    []
                ),
                "style": node.get(
                    "style",
                    {}
                )
            }

        return {
            "rows": node.metadata.get(
                "rows",
                []
            ),
            "style": node.metadata.get(
                "style",
                {}
            )
        }