class FigureExtractor:

    def extract(self, node):

        return {
            "caption": node.get("caption"),
            "image_ref": node.get("image_ref"),
            "width": node.get("width"),
            "height": node.get("height")
        }