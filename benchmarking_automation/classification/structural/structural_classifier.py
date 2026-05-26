from classification.models.placeholder_type import PlaceholderType
from classification.models.classification_result import ClassificationResult

from classification.structural.list_rules import classify_structural_list
from classification.structural.table_cell_rules import classify_table_cell
from classification.structural.paragraph_rules import classify_paragraph
from classification.structural.keyvalue_rules import classify_keyvalue


class StructuralClassifier:

    def classify(self, item: dict):

        # -----------------------------
        # RULE 1 — LIST
        # -----------------------------
        result = classify_structural_list(item)

        if result:
            return result

        # -----------------------------
        # RULE 2 — TABLE CELL
        # -----------------------------
        result = classify_table_cell(item)

        if result:
            return result

        # -----------------------------
        # RULE 3 — PARAGRAPH
        # -----------------------------
        result = classify_paragraph(item)

        if result:
            return result

        # -----------------------------
        # RULE 4 — KEYVALUE
        # -----------------------------
        result = classify_keyvalue(item)

        if result:
            return result

        # -----------------------------
        # RULE 5 — UNKNOWN
        # -----------------------------
        return ClassificationResult(
            placeholder=item["placeholder"],
            type=PlaceholderType.UNKNOWN,
            classification_confidence=0.0,
            classification_reason=[
                "NO_STRUCTURAL_RULE_MATCH"
            ]
        )
