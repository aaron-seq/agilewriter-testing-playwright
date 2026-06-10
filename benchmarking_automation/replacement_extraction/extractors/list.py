class ListExtractor:

    def extract(self, node):

        if isinstance(node, dict):

            return {
                "items": node.get(
                    "items",
                    []
                ),
                "list_type": node.get(
                    "list_type",
                    "bullet"
                )
            }

        return {
            "items": node.metadata.get(
                "items",
                []
            ),
            "list_type": node.metadata.get(
                "list_type",
                "bullet"
            )
        }