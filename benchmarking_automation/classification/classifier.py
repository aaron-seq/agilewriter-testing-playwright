from classification.precedence import resolve_precedence
from classification.registry import RuleRegistry
from classification.result_builder import build_output

from classification.syntax.table_rules import TableSyntaxRule
from classification.syntax.tables_rules import TablesSyntaxRule
from classification.syntax.figure_rules import FigureSyntaxRule
from classification.syntax.list_rules import ListSyntaxRule

from classification.structural.structural_classifier import (
    StructuralClassifier
)


class PlaceholderClassifier:

    def __init__(self):

        self.registry = RuleRegistry()

        self.structural_classifier = StructuralClassifier()

        self._register_rules()

    def _register_rules(self):

        self.registry.register(TablesSyntaxRule())
        self.registry.register(TableSyntaxRule())
        self.registry.register(FigureSyntaxRule())
        self.registry.register(ListSyntaxRule())

    def classify_occurrence(self, occurrence):

        matches = []
        # -----------------------------------
        # STEP 1 — RUN SYNTAX RULES
        # -----------------------------------
        for rule in self.registry.get_rules():

            result = rule.match(occurrence)

            if result:
                matches.append(result)

        # -----------------------------------
        # STEP 2 — RESOLVE SYNTAX PRECEDENCE
        # -----------------------------------

        final_result = resolve_precedence(matches)

        # -----------------------------------
        # STEP 3 — IF SYNTAX MATCHED,
        #          RETURN IT IMMEDIATELY
        # -----------------------------------

        if final_result is not None:

            return build_output(
                occurrence,
                final_result
            )

        # -----------------------------------
        # STEP 4 — RUN STRUCTURAL CLASSIFIER
        # -----------------------------------

        structural_result = (
            self.structural_classifier.classify(
                occurrence
            )
        )

        # -----------------------------------
        # STEP 5 — RETURN STRUCTURAL RESULT
        # -----------------------------------

        return build_output(
            occurrence,
            structural_result
        )

    def classify_inventory(self, inventory):

        sorted_inventory = sorted(
            inventory,
            key=lambda x: x.get(
                "occurrence_id",
                x.get("placeholder", "")
            )
        )

        return [
            self.classify_occurrence(item)
            for item in sorted_inventory
        ]
