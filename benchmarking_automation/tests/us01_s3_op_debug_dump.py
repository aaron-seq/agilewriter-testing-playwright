import sys
from pathlib import Path

# Add project root to Python path
PROJECT_ROOT = Path(__file__).resolve().parent.parent

sys.path.insert(0, str(PROJECT_ROOT))

from pprint import pprint

from doc_parser.xml_parser import load_docx
from doc_parser.node_builder import CanonicalDocumentBuilder

from placeholders.extractor import PlaceholderExtractor


import os
DOCX_PATH = os.environ.get(
    "DOCX_PATH",
    str(Path(__file__).resolve().parent / "basic_sample_template.docx")
)


def main():

    # =====================================
    # STEP 1 — Load and parse DOCX
    # =====================================

    parsed_document = load_docx(DOCX_PATH)

    # =====================================
    # STEP 2 — Build canonical tree
    # =====================================

    builder = CanonicalDocumentBuilder()

    canonical_tree = builder.build(parsed_document)

    # =====================================
    # STEP 3 — Extract placeholders
    # =====================================

    placeholder_extractor = PlaceholderExtractor()

    inventory = placeholder_extractor.extract(
        canonical_tree
    )

    # =====================================
    # STEP 4 — Print results
    # =====================================

    print("\n========== PLACEHOLDER INVENTORY ==========\n")

    for item in inventory:

        pprint(item, sort_dicts=False)

        print("\n" + "=" * 80 + "\n")


if __name__ == "__main__":
    main()