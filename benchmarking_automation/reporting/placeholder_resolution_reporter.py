import json

from dataclasses import asdict


class PlaceholderResolutionReporter:

    @staticmethod
    def generate(results):

        return json.dumps(
            [
                asdict(result)
                for result in results
            ],
            indent=4
        )

    @staticmethod
    def save(
        results,
        output_path
    ):

        with open(
            output_path,
            "w",
            encoding="utf-8"
        ) as file:

            json.dump(
                [
                    asdict(result)
                    for result in results
                ],
                file,
                indent=4,
                ensure_ascii=False
            )
