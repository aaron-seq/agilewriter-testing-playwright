import json
from pathlib import Path

from classification.classifier import (
    PlaceholderClassifier
)

from reporting.classified_inventory_reporter import (
    export_classified_inventory
)

from reporting.excel_reporter import (
    export_excel_report
)

from reporting.schema_validator import (
    validate_inventory_schema
)


class ClassificationPipeline:

    def __init__(self):

        self.classifier = PlaceholderClassifier()

    def load_inventory(
        self,
        inventory_path
    ):

        with open(
            inventory_path,
            "r",
            encoding="utf-8"
        ) as file:

            return json.load(file)

    def classify_inventory(
        self,
        inventory
    ):

        return self.classifier.classify_inventory(
            inventory
        )

    def validate_inventory(
        self,
        classified_inventory
    ):

        validate_inventory_schema(
            classified_inventory
        )

    def export_outputs(
        self,
        classified_inventory,
        json_output_path,
        excel_output_path=None
    ):

        export_classified_inventory(
            classified_inventory,
            json_output_path
        )

        if excel_output_path:

            export_excel_report(
                classified_inventory,
                excel_output_path
            )

    def run(
        self,
        inventory_path,
        json_output_path,
        excel_output_path=None
    ):

        inventory = self.load_inventory(
            inventory_path
        )

        classified_inventory = (
            self.classify_inventory(
                inventory
            )
        )

        self.validate_inventory(
            classified_inventory
        )

        self.export_outputs(
            classified_inventory,
            json_output_path,
            excel_output_path
        )

        return classified_inventory