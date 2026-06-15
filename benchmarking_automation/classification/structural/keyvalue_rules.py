import re

from classification.models.placeholder_type import PlaceholderType
from classification.models.classification_result import ClassificationResult


LABEL_PATTERN = re.compile(r":\s*$")


def classify_keyvalue(item: dict):
    """
    Detect inline placeholders embedded in text.
    
    Priority KEYVALUE detection:
    - Has inline context (text before/after the placeholder)
    - The placeholder name matches common label patterns
    - The inline context ends with ":" (label: value pattern)
    """
    inline_context = item.get("inline_context", {})
    neighbor_context = item.get("neighbor_context", {})
    placeholder = item.get("placeholder", "")
    ph_name = placeholder.strip("<>").strip().lower()

    before = inline_context.get("before", "").strip()
    after = inline_context.get("after", "").strip()

    reasons = []

    # Strong: label pattern (text before ends with ":")
    if before and LABEL_PATTERN.search(before):
        return ClassificationResult(
            placeholder=item["placeholder"],
            type=PlaceholderType.KEYVALUE,
            classification_confidence=0.95,
            classification_reason=["LABEL_VALUE_PATTERN"]
        )

    # Strong: placeholder name is short and surrounded by text
    if before and after and len(ph_name.split()) <= 4:
        return ClassificationResult(
            placeholder=item["placeholder"],
            type=PlaceholderType.KEYVALUE,
            classification_confidence=0.85,
            classification_reason=["INLINE_CONTEXT_SHORT_PLACEHOLDER"]
        )

    # Medium: any inline context exists
    if before or after:
        return ClassificationResult(
            placeholder=item["placeholder"],
            type=PlaceholderType.KEYVALUE,
            classification_confidence=0.75,
            classification_reason=["INLINE_CONTEXT_PRESENT"]
        )

    # Weak: neighbor context suggests keyvalue pattern
    # e.g. neighbor text has ":" pattern typical of label:value
    if neighbor_context:
        neighbor_before = neighbor_context.get("before", "") or ""
        neighbor_after = neighbor_context.get("after", "") or ""
        if ":" in neighbor_before or ":" in neighbor_after:
            return ClassificationResult(
                placeholder=item["placeholder"],
                type=PlaceholderType.KEYVALUE,
                classification_confidence=0.6,
                classification_reason=["NEIGHBOR_KEYVALUE_CONTEXT"]
            )

    return None