# reporting/json_reporter.py
import json


class JsonReporter:

    @staticmethod
    def generate(inventory):

        return json.dumps(
            inventory,
            indent=4
        )