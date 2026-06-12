from .json_reporter import (
    JsonReporter
)

from .excel_reporter import (
    ExcelReporter
)

from .schema_validator import (
    SchemaValidator
)


class ExportService:

    @staticmethod
    def export(
        inventory,
        fragment_store,
        output_directory
    ):

        SchemaValidator.validate_inventory(
            inventory
        )

        JsonReporter.export_inventory(
            inventory,
            f"{output_directory}/replacement_inventory.json"
        )

        JsonReporter.export_fragment_store(
            fragment_store,
            f"{output_directory}/replacement_fragment_store.json"
        )

        ExcelReporter.export(
            inventory,
            f"{output_directory}/replacement_inventory.xlsx"
        )