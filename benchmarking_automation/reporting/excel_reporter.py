from openpyxl import Workbook


HEADERS = [
    "Occurrence ID",
    "Placeholder",
    "Type",
    "Confidence",
    "Reasons",
    "Rule IDs",
    "Node Type",
    "Table Path"
]


def export_excel_report(
    classified_inventory,
    output_path
):

    workbook = Workbook()

    worksheet = workbook.active

    worksheet.title = "Classified Inventory"

    worksheet.append(HEADERS)

    for item in classified_inventory:

        worksheet.append([
            item.get("occurrence_id"),
            item.get("placeholder"),
            item.get("type"),
            item.get("classification_confidence"),
            ", ".join(
                item.get(
                    "classification_reason",
                    []
                )
            ),
            ", ".join(
                item.get(
                    "matched_rule_ids",
                    []
                )
            ),
            item.get("node_type"),
            item.get("table_path")
        ])

    workbook.save(output_path)
