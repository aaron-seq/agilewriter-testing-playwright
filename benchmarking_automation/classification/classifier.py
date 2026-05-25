from classification.models.classification_result import (
    ClassificationResult
)
from classification.models.placeholder_type import PlaceholderType

from classification.precedence import resolve_precedence
from classification.registry import RuleRegistry
from classification.result_builder import build_output

from classification.syntax.table_rules import TableSyntaxRule
from classification.syntax.tables_rules import TablesSyntaxRule
from classification.syntax.figure_rules import FigureSyntaxRule
from classification.syntax.list_rules import ListSyntaxRule


class PlaceholderClassifier:

    def __init__(self):

        self.registry = RuleRegistry()

        self._register_rules()

    def _register_rules(self):

        self.registry.register(TablesSyntaxRule())
        self.registry.register(TableSyntaxRule())
        self.registry.register(FigureSyntaxRule())
        self.registry.register(ListSyntaxRule())

    def classify_occurrence(self, occurrence):

        matches = []

        for rule in self.registry.get_rules():

            result = rule.match(occurrence)

            if result:
                matches.append(result)

        final_result = resolve_precedence(matches)

        if final_result is None:

            final_result = ClassificationResult(
                placeholder=occurrence["placeholder"],
                type=PlaceholderType.UNKNOWN,
                classification_reason=["UNKNOWN_FALLBACK"],
                classification_confidence=1.0,
                matched_rule_ids=[]
            )

        return build_output(
            occurrence,
            final_result
        )

    def classify_inventory(self, inventory):

        return [
            self.classify_occurrence(item)
            for item in inventory
        ]
