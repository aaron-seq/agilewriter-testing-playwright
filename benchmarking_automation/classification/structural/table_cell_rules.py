from classification.models.placeholder_type import PlaceholderType
from classification.models.classification_result import ClassificationResult


def classify_table_cell(item: dict):
    """
    Detect placeholders located inside table cells.
    """

    table_path = item.get("table_path")

    if table_path:
        return ClassificationResult(
            placeholder=item["placeholder"],
            type=PlaceholderType.TABLE_CELL,
            classification_confidence=0.98,
            classification_reason=[
                "TABLE_PATH_PRESENT"
            ]
        )

    return None
