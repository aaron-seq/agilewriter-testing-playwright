import json


class JsonReporter:

    @staticmethod
    def export_inventory(
        inventory,
        output_path
    ):

        with open(
            output_path,
            "w",
            encoding="utf-8"
        ) as file:

            json.dump(
                inventory,
                file,
                indent=2,
                ensure_ascii=False
            )

    @staticmethod
    def export_fragment_store(
        fragment_store,
        output_path
    ):

        with open(
            output_path,
            "w",
            encoding="utf-8"
        ) as file:

            json.dump(
                fragment_store,
                file,
                indent=2,
                ensure_ascii=False
            )