import re

from classification.models.placeholder_type import PlaceholderType
from classification.models.classification_result import ClassificationResult


LABEL_PATTERN = re.compile(r":\s*$")


def classify_keyvalue(item: dict):
    """
    Detect inline placeholders embedded in text.
    """

    inline_context = item.get("inline_context", {})

    before = inline_context.get("before", "").strip()
    after = inline_context.get("after", "").strip()

    if before or after:

        reasons = []

        confidence = 0.75

        # Strong label-value signal
        if LABEL_PATTERN.search(before):
            confidence = 0.95
            reasons.append("LABEL_VALUE_PATTERN")

        # Generic inline embedding
        else:
            reasons.append("INLINE_CONTEXT_PRESENT")

        return ClassificationResult(
            placeholder=item["placeholder"],
            type=PlaceholderType.KEYVALUE,
            classification_confidence=confidence,
            classification_reason=reasons
        )

    return None
