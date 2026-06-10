class QueryService:

    @staticmethod
    def query_all(
        inventory
    ):
        return inventory

    @staticmethod
    def query_placeholders(
        inventory,
        placeholders
    ):
        placeholder_set = {
            p.lower()
            for p in placeholders
        }

        return [
            row
            for row in inventory
            if row["placeholder"].lower()
            in placeholder_set
        ]