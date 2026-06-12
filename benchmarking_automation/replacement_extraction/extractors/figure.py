class FigureExtractor:

    def extract(self, node):

        if isinstance(node, dict):

            return {
                "caption": node.get("caption"),
                "image_ref": node.get("image_ref"),
                "width": node.get("width"),
                "height": node.get("height")
            }

        return {
            "caption": node.metadata.get(
                "caption"
            ),
            "image_ref": node.metadata.get(
                "image_ref"
            ),
            "width": node.metadata.get(
                "width"
            ),
            "height": node.metadata.get(
                "height"
            )
        }