from classification.models.placeholder_type import PlaceholderType
from classification.models.classification_result import ClassificationResult


def classify_structural_list(item: dict):
    """
    Structural fallback list detection.
    """

    node_type = item.get("node_type")

    list_info = item.get("list_info", {})

    is_list = list_info.get("is_list", False)

    if node_type == "list_item" or is_list:

        return ClassificationResult(
            placeholder=item["placeholder"],
            type=PlaceholderType.LIST,
            classification_confidence=0.88,
            classification_reason=[
                "STRUCTURAL_LIST_CONTEXT"
            ]
        )

    return None
