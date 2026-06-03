import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

sys.path.insert(0, str(PROJECT_ROOT))

from doc_parser.xml_parser import load_docx
from doc_parser.node_builder import CanonicalDocumentBuilder
from reporting.document_tree_reporter import (
    DocumentTreeReporter
)

DOCX_PATH = (
    PROJECT_ROOT
    / "tests"
    / "CSR_1133_19_SB_raw.docx"
)

OUTPUT_PATH = (
    PROJECT_ROOT
    / "tests"
    / "output"
    / "generated_document_tree.json"
)

doc = load_docx(str(DOCX_PATH))

tree = CanonicalDocumentBuilder().build(doc)

DocumentTreeReporter.save(
    tree,
    str(OUTPUT_PATH)
)

print(
    f"Generated: {OUTPUT_PATH}"
)