import re

from classification.base_rule import BaseClassificationRule
from classification.models.classification_result import ClassificationResult
from classification.models.placeholder_type import PlaceholderType


TABLES_PATTERNS = [
    r"^<\s*Tables\s*:\s*.+>$",
    r"^<\s*Extract\s+Tables\s*>$",
]


class TablesSyntaxRule(BaseClassificationRule):

    RULE_ID = "TABLES_SYNTAX_RULE"

    def match(self, occurrence):

        placeholder = occurrence.get("placeholder", "").strip()

        for pattern in TABLES_PATTERNS:
            if re.match(pattern, placeholder, re.IGNORECASE):

                return ClassificationResult(
                    placeholder=placeholder,
                    type=PlaceholderType.TABLES,
                    classification_reason=[
                        "TABLES_SYNTAX_MATCH"
                    ],
                    classification_confidence=1.0,
                    matched_rule_ids=[self.RULE_ID]
                )

        return None
