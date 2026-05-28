from classification.models.placeholder_type import PlaceholderType
from classification.models.classification_result import ClassificationResult


def classify_paragraph(item: dict):
    """
    Detect standalone placeholder paragraphs.
    """

    inline_context = item.get("inline_context", {})

    before = inline_context.get("before", "").strip()
    after = inline_context.get("after", "").strip()

    node_type = item.get("node_type")

    table_path = item.get("table_path")

    if (
        node_type == "paragraph"
        and not table_path
        and before == ""
        and after == ""
    ):
        return ClassificationResult(
            placeholder=item["placeholder"],
            type=PlaceholderType.PARAGRAPH,
            classification_confidence=0.90,
            classification_reason=[
                "STANDALONE_PARAGRAPH_PLACEHOLDER"
            ]
        )

    return None
