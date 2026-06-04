import json
from pathlib import Path


def export_classified_inventory(
    classified_inventory,
    output_path
):

    output_path = Path(output_path)

    output_path.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    with open(output_path, "w", encoding="utf-8") as file:

        json.dump(
            classified_inventory,
            file,
            indent=2,
            ensure_ascii=False
        )
