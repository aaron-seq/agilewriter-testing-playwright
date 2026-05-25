from classification.models.placeholder_type import PlaceholderType


CLASSIFICATION_PRECEDENCE = {
    PlaceholderType.TABLES: 1,
    PlaceholderType.TABLE: 2,
    PlaceholderType.FIGURE: 3,
    PlaceholderType.LIST: 4,
    PlaceholderType.TABLE_CELL: 5,
    PlaceholderType.PARAGRAPH: 6,
    PlaceholderType.KEYVALUE: 7,
    PlaceholderType.UNKNOWN: 8,
}


def resolve_precedence(results):
    """
    Deterministically choose highest-priority classification.
    Lower numeric value = higher priority.
    """

    if not results:
        return None

    return sorted(
        results,
        key=lambda r: CLASSIFICATION_PRECEDENCE[r.type]
    )[0]
