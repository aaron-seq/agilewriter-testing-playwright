import re

from classification.base_rule import BaseClassificationRule
from classification.models.classification_result import ClassificationResult
from classification.models.placeholder_type import PlaceholderType


FIGURE_PATTERNS = [
    r"^<\s*Figure\s+.+>$",
    r"^<\s*Insert\s+Figure\s*>$",
    r"^<\s*Figure_[^<>]+>$",
]


class FigureSyntaxRule(BaseClassificationRule):

    RULE_ID = "FIGURE_SYNTAX_RULE"

    def match(self, occurrence):

        placeholder = occurrence.get("placeholder", "").strip()

        for pattern in FIGURE_PATTERNS:
            if re.match(pattern, placeholder, re.IGNORECASE):

                return ClassificationResult(
                    placeholder=placeholder,
                    type=PlaceholderType.FIGURE,
                    classification_reason=[
                        "FIGURE_SYNTAX_MATCH"
                    ],
                    classification_confidence=1.0,
                    matched_rule_ids=[self.RULE_ID]
                )

        return None
