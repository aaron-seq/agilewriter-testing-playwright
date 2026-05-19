# app/pipeline.py

from reporting.inventory_builder import InventoryBuilder
from reporting.json_reporter import JsonReporter
from reporting.export_service import ExportService
from reporting.inventory_validator import InventoryValidator

class PipelineError(Exception):
    pass

class PlaceholderPipeline:

    def __init__(self):

        self.inventory_builder = InventoryBuilder()

    def run(
        self,
        input_docx: str,
        output_json: str | None = None
    ):
        try:
            # -----------------------------------------
            # STEP 1: Build Inventory
            # -----------------------------------------

            inventory = (
                self.inventory_builder.build_inventory(
                    input_docx
                )
            )

            # -----------------------------------------
            # STEP 1.5: Validate Inventory
            # -----------------------------------------
            InventoryValidator.validate(
                inventory
            )

            # -----------------------------------------
            # STEP 2: Generate JSON
            # -----------------------------------------

            json_output = JsonReporter.generate(
                inventory
            )

            # -----------------------------------------
            # STEP 3: Export if requested
            # -----------------------------------------

            if output_json:

                ExportService.export_json(
                    output_json,
                    json_output
                )

            return inventory            

        except Exception as exc:
            raise PipelineError(
                f"Pipeline failed: {str(exc)}"
            ) from exc

