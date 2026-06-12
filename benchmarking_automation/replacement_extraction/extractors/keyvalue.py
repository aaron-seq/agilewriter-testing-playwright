import re


class KeyValueExtractor:

    def _extract_using_placeholder_name(self, matched_text, placeholder):
        """
        Try to find just the replacement value by looking at what
        comes after common label patterns. For example, if placeholder
        is <Sponsor> and matched_text is "Sponsor / Study Title:Stendarr, Inc.",
        we want "Stendarr, Inc."
        """
        if not placeholder or not matched_text:
            return None

        # Get the plain name inside <...>
        ph_name = placeholder.strip("<>").strip()

        if not ph_name:
            return None

        # Strategy 1: Find the LAST colon in the text and take what's after it
        # This handles cases like "Label1 / Label2: Value1 / Value2"
        # where the value is always after the last colon
        colon_idx = matched_text.rfind(":")
        if colon_idx > 0:
            last_colon_value = matched_text[colon_idx + 1:].strip()
            if last_colon_value:
                # Take first meaningful segment
                for sep in [" / ", "  "]:
                    if sep in last_colon_value:
                        last_colon_value = last_colon_value.split(sep)[0].strip()
                # Only use if it's reasonable (not too long)
                if len(last_colon_value) < 200:
                    return last_colon_value

        # Strategy 2: Find the placeholder name in the text and look for
        # the value after ":" separator
        # e.g. "Tel:   <Telephone>" -> look for "Tel:" pattern
        # e.g. "Protocol Number:  SKY-2000-101" -> after "Protocol Number:"
        # This captures: <word/phrase>: <value>
        value_after_colon = re.search(
            r"\b" + re.escape(ph_name) + r"\b\s*:\s*(.+)",
            matched_text,
            re.IGNORECASE
        )
        if value_after_colon:
            value = value_after_colon.group(1).strip()
            for sep in [" / ", "  "]:
                if sep in value:
                    value = value.split(sep)[0].strip()
            if value and len(value) < 200:
                return value

        # Strategy 3: For table cells where text is like "Label   Value"
        # look for whitespace-separated pattern
        value_after_spaces = re.search(
            r"\b" + re.escape(ph_name) + r"\b\s{2,}(.+)",
            matched_text,
            re.IGNORECASE
        )
        if value_after_spaces:
            value = value_after_spaces.group(1).strip()
            for sep in [" / ", "  "]:
                if sep in value:
                    value = value.split(sep)[0].strip()
            if value and len(value) < 200:
                return value

        # Strategy 4: For patterns like "Label/Value" where placeholder
        # name is one label in a chain separated by "/"
        # e.g. "Sponsor / Study Title:Stendarr, Inc."
        # Find the colon, take everything after it, then split on "/"
        # and take first segment (which will be the actual value)
        if ":" in matched_text:
            after_last_colon = matched_text.split(":")[-1].strip()
            segments = [s.strip() for s in after_last_colon.split("/")]
            if segments and len(segments[0]) < 200:
                return segments[0]

        return None

    def extract(
        self,
        node,
        resolution
    ):

        # Get the full matched text
        if isinstance(
            resolution,
            dict
        ):
            matched_text = (
                resolution.get(
                    "matched_text"
                )
            )
            placeholder = resolution.get(
                "placeholder", ""
            )
        else:
            matched_text = (
                resolution.matched_text
            )
            placeholder = getattr(
                resolution, "placeholder", ""
            )

        if not matched_text:
            return {
                "content": "",
                "formatting": []
            }

        # Try to extract the value using the placeholder name as a label
        extracted = self._extract_using_placeholder_name(
            matched_text, placeholder
        )
        if extracted:
            return {
                "content": extracted,
                "formatting": []
            }

        # Fallback: if matched_text still contains the raw placeholder tag,
        # the replacement hasn't been made, return empty
        if placeholder and placeholder in matched_text:
            return {
                "content": "",
                "formatting": []
            }

        # If the matched text is very long (likely full paragraph),
        # try to find a shorter meaningful value by cleaning
        if len(matched_text) > 200:
            # Check if the text contains a colon - typically label:value pattern
            colon_idx = matched_text.find(":")
            if colon_idx > 0 and colon_idx < len(matched_text) - 1:
                value = matched_text[colon_idx + 1:].strip()
                if value:
                    return {
                        "content": value,
                        "formatting": []
                    }

        return {
            "content": matched_text,
            "formatting": []
        }
