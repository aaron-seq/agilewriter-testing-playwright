import re

PLACEHOLDER_PATTERN = re.compile(
    r"<\s*([^<>]+?)\s*>"
)

def find_placeholders(text: str):
    """
    Returns all valid placeholders from text.
    Ignores malformed placeholders automatically.
    """
    if not text:
        return []

    return [
        match.group(0)
        for match in PLACEHOLDER_PATTERN.finditer(text)
    ]