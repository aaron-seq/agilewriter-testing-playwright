from openpyxl import Workbook


class ExcelReporter:

    HEADERS = [
        "Occurrence ID",
        "Placeholder",
        "Type",
        "Status",
        "Replacement Content",
        "Confidence",
        "Generated Node ID",
        "Section",
        "Table Path",
        "Summary",
        "Replacement Found"
    ]

    @classmethod
    def export(
        cls,
        inventory,
        output_path
    ):

        workbook = Workbook()

        worksheet = workbook.active

        worksheet.title = (
            "Replacement Inventory"
        )

        worksheet.append(
            cls.HEADERS
        )

        for row in inventory:

            worksheet.append([
                row.get(
                    "occurrence_id"
                ),
                row.get(
                    "placeholder"
                ),
                row.get(
                    "type"
                ),
                row.get(
                    "status"
                ),
                row.get(
                    "replacement_content"
                ),
                row.get(
                    "confidence"
                ),
                row.get(
                    "generated_node_id"
                ),
                row.get(
                    "section"
                ),
                row.get(
                    "table_path"
                ),
                row.get(
                    "summary"
                ),
                row.get(
                    "replacement_found"
                )
            ])

        workbook.save(
            output_path
        )