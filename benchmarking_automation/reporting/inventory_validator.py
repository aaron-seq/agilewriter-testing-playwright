# reporting/inventory_validator.py

REQUIRED_FIELDS = [
    "occurrence_id",
    "placeholder",
    "node_id",
    "section"
]


class InventoryValidator:

    @staticmethod
    def validate(inventory):

        for item in inventory:

            for field in REQUIRED_FIELDS:

                if field not in item:

                    raise ValueError(
                        f"Missing required field: {field}"
                    )

        return True