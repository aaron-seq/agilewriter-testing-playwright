import re

from classification.base_rule import BaseClassificationRule
from classification.models.classification_result import ClassificationResult
from classification.models.placeholder_type import PlaceholderType


TABLE_PATTERNS = [
    # <Table: AE>
    r"^<\s*Table\s*:\s*.+>$",

    # <Insert Table: AE>
    r"^<\s*Insert\s+Table\s*:\s*.+>$",

    # <Insert Table Table Name>
    r"^<\s*Insert\s+Table\s+.+>$",

    # <Table X>
    # <Table 1>
    # <Table AE>
    # <Table Demographics>
    # <Table-Summary>
    # <Table_1>>
    r"^<\s*Table\b[^>]*>$",
]


class TableSyntaxRule(BaseClassificationRule):

    RULE_ID = "TABLE_SYNTAX_RULE"

    def match(self, occurrence):

        placeholder = occurrence.get("placeholder", "").strip()

        for pattern in TABLE_PATTERNS:
            if re.match(pattern, placeholder, re.IGNORECASE):

                return ClassificationResult(
                    placeholder=placeholder,
                    type=PlaceholderType.TABLE,
                    classification_reason=[
                        "TABLE_SYNTAX_MATCH"
                    ],
                    classification_confidence=1.0,
                    matched_rule_ids=[self.RULE_ID]
                )

        return None
