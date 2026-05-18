# tests/us02_s2_op_debug_dump.py

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from pprint import pprint
from dataclasses import asdict

from parser.xml_parser import load_docx
from parser.node_builder import CanonicalDocumentBuilder


def sanitize_node(node_dict):

    formatting = node_dict.get("formatting", {})

    runs = formatting.get("runs", [])

    cleaned_runs = []

    for run in runs:

        cleaned_runs.append({
            "text": run.get("text", "")
        })

    formatting["runs"] = cleaned_runs

    node_dict["formatting"] = formatting

    return node_dict


def main():

    # ---------------------------------------------
    # Load DOCX
    # ---------------------------------------------

    parsed_document = load_docx(
        "tests/basic_sample_template.docx"
        # "tests/Adv_Sample_Template.docx"
    )

    # ---------------------------------------------
    # Build canonical tree
    # ---------------------------------------------

    builder = CanonicalDocumentBuilder()

    canonical_tree = builder.build(parsed_document)

    # ---------------------------------------------
    # Print output
    # ---------------------------------------------

    print("\n========== CANONICAL DOCUMENT TREE ==========\n")

    for child in canonical_tree.children:

        node_dict = asdict(child)

        cleaned = sanitize_node(node_dict)

        pprint(cleaned, width=120)

        print("\n" + "=" * 80 + "\n")


if __name__ == "__main__":
    main()