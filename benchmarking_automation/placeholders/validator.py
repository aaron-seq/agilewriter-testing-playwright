import re

PLACEHOLDER_PATTERN = re.compile(
    r"<\s*([^<>]+?)\s*>"
)


def find_placeholder_matches(text: str):
    """
    Return regex match objects.
    """

    if not text:
        return []

    return list(
        PLACEHOLDER_PATTERN.finditer(text)
    )


def find_placeholders(text: str):
    """
    Backward-compatible helper.
    Returns all valid placeholders from text.
    Ignores malformed placeholders automatically.
    """

    return [
        match.group(0)
        for match in find_placeholder_matches(text)
    ]

