import re

from classification.base_rule import BaseClassificationRule
from classification.models.classification_result import ClassificationResult
from classification.models.placeholder_type import PlaceholderType


LIST_PATTERNS = [
    # Existing
    r"^<\s*number\s+list\s*:\s*.+>$",
    r"^<\s*bullet\s+list\s*:\s*.+>$",

    # Real inventory patterns
    r"^<\s*Number\s+list\s+.+>$",
    r"^<\s*Bullet\s+list\s+.+>$",

    # Optional
    r"^<\s*Insert\s+Reference\s+List\s*>$",
]


class ListSyntaxRule(BaseClassificationRule):

    RULE_ID = "LIST_SYNTAX_RULE"

    def match(self, occurrence):

        placeholder = occurrence.get("placeholder", "").strip()

        for pattern in LIST_PATTERNS:
            if re.match(pattern, placeholder, re.IGNORECASE):

                return ClassificationResult(
                    placeholder=placeholder,
                    type=PlaceholderType.LIST,
                    classification_reason=[
                        "LIST_SYNTAX_MATCH"
                    ],
                    classification_confidence=1.0,
                    matched_rule_ids=[self.RULE_ID]
                )

        return None
