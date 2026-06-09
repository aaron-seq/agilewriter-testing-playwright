class KeyValueExtractor:

    def extract(self, node, resolution):

        return {
            "content": resolution.get("matched_text", ""),
            "formatting": []
        }