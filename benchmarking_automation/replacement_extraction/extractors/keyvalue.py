class KeyValueExtractor:

    def extract(
        self,
        node,
        resolution
    ):

        if isinstance(
            resolution,
            dict
        ):
            matched_text = (
                resolution.get(
                    "matched_text"
                )
            )
        else:
            matched_text = (
                resolution.matched_text
            )

        return {
            "content": matched_text,
            "formatting": []
        }