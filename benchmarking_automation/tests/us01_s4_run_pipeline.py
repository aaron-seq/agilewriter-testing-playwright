# tests/us01_s4_run_pipeline.py

import sys
from pathlib import Path

# Add project root to Python path
PROJECT_ROOT = Path(__file__).resolve().parent.parent

sys.path.insert(0, str(PROJECT_ROOT))
from app.pipeline import PlaceholderPipeline


def main():

    pipeline = PlaceholderPipeline()

    inventory = pipeline.run(
        # input_docx="tests/basic_sample_template.docx",
        input_docx="tests/CSR_Template_20FEB2026.docx",
        # input_docx="tests/Adv_Sample_Template.docx",
        output_json="tests/output/inventory.json"
    )

    print("\n===== PLACEHOLDER INVENTORY =====\n")

    # for item in inventory:
    #     # print(item)
    print("\n===== OUTPUT PATH =====\n")
    print("tests/output/inventory.json")


if __name__ == "__main__":
    main()
