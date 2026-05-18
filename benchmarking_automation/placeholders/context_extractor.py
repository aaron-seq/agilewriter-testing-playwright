def extract_context(text: str, placeholder: str):
    """
    Extracts surrounding static text context.
    """

    start = text.find(placeholder)

    if start == -1:
        return {
            "context_before": "",
            "context_after": ""
        }

    before = text[:start].strip()

    after_start = start + len(placeholder)
    after = text[after_start:].strip()

    return {
        "context_before": before,
        "context_after": after
    }