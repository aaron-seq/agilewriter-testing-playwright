from dataclasses import asdict, is_dataclass
import json


class DocumentTreeReporter:

    @staticmethod
    def generate(tree):

        return json.dumps(
            DocumentTreeReporter._to_dict(tree),
            indent=4
        )

    @staticmethod
    def save(tree, output_path):

        with open(
            output_path,
            "w",
            encoding="utf-8"
        ) as file:

            json.dump(
                DocumentTreeReporter._to_dict(tree),
                file,
                indent=4,
                ensure_ascii=False
            )

    @staticmethod
    def _to_dict(obj):

        if is_dataclass(obj):

            return {
                key: DocumentTreeReporter._to_dict(value)
                for key, value in asdict(obj).items()
            }

        if isinstance(obj, list):

            return [
                DocumentTreeReporter._to_dict(item)
                for item in obj
            ]

        return obj