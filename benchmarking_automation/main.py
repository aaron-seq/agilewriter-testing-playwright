from app.classification_pipeline import (
    ClassificationPipeline
)


def main():

    pipeline = ClassificationPipeline()

    pipeline.run(
        inventory_path="tests/output/inventory.json",
        json_output_path=(
            "output/classified_inventory.json"
        ),
        excel_output_path=(
            "output/classified_inventory.xlsx"
        )
    )


if __name__ == "__main__":
    main()
