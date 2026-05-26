import sys
from pathlib import Path
# ---------------------------------------------------------
# Add project root to Python path
# ---------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parent.parent

sys.path.insert(0, str(PROJECT_ROOT))

# ---------------------------------------------------------
# Imports
# ---------------------------------------------------------

from doc_parser.xml_parser import load_docx
from doc_parser.node_builder import CanonicalDocumentBuilder

from placeholders.extractor import PlaceholderExtractor
from placeholders.validator import find_placeholders


# ---------------------------------------------------------
# Test DOCX
# ---------------------------------------------------------

import os
DOCX_PATH = os.environ.get(
    "DOCX_PATH",
    str(Path(__file__).resolve().parent / "basic_sample_template.docx")
)


# ---------------------------------------------------------
# Shared Fixture
# ---------------------------------------------------------

def build_inventory():

    parsed_document = load_docx(DOCX_PATH)

    builder = CanonicalDocumentBuilder()

    canonical_tree = builder.build(parsed_document)

    extractor = PlaceholderExtractor()

    return extractor.extract(canonical_tree)


# =========================================================
# ST3-TC01
# Placeholder in paragraph detected
# =========================================================

def test_placeholder_in_paragraph_detected():

    inventory = build_inventory()

    placeholders = [
        item["placeholder"]
        for item in inventory
    ]

    assert "<Patient_Name>" in placeholders


# =========================================================
# ST3-TC02
# Placeholder in table detected
# =========================================================

def test_placeholder_in_table_detected():

    inventory = build_inventory()

    table_placeholder = next(
        (
            item for item in inventory
            if item["placeholder"] == "<Doctor_Name>"
        ),
        None
    )

    assert table_placeholder is not None

    assert table_placeholder["table_index"] == 0
    assert table_placeholder["row_index"] == 1
    assert table_placeholder["cell_index"] == 1


# =========================================================
# ST3-TC03
# Multiple placeholders detected
# =========================================================

def test_multiple_placeholders_detected():

    inventory = build_inventory()

    assert len(inventory) > 1


# =========================================================
# ST3-TC04
# Repeated placeholders get unique IDs
# =========================================================

def test_repeated_placeholders_get_unique_ids():

    inventory = build_inventory()

    repeated = [
        item for item in inventory
        if item["placeholder"] == "<Contact_Name>"
    ]

    assert len(repeated) == 2

    ids = {
        item["occurrence_id"]
        for item in repeated
    }

    assert len(ids) == 2


# =========================================================
# ST3-TC05
# Malformed placeholders ignored
# =========================================================

def test_malformed_placeholders_ignored():

    malformed_text = (
        "<Patient_Name "
        "Patient_Name"
    )

    detected = find_placeholders(malformed_text)

    assert detected == []


# =========================================================
# ST3-TC06
# Header/footer placeholders detected
# =========================================================

def test_header_footer_placeholders_detected():

    inventory = build_inventory()

    header_found = any(
        item["placeholder"] == "<Hospital_Name>"
        and item["section"].startswith("header")
        for item in inventory
    )

    footer_found = any(
        item["placeholder"] == "<Generated_By>"
        and item["section"].startswith("footer")
        for item in inventory
    )

    assert header_found
    assert footer_found


# =========================================================
# ST3-TC07
# List placeholders detected
# =========================================================

def test_list_placeholders_detected():

    inventory = build_inventory()

    placeholders = [
        item["placeholder"]
        for item in inventory
    ]

    assert "<Treatment_Item_1>" in placeholders
    assert "<Treatment_Item_2>" in placeholders


# =========================================================
# Additional Structural Validation
# =========================================================

def test_all_occurrence_ids_are_unique():

    inventory = build_inventory()

    ids = [
        item["occurrence_id"]
        for item in inventory
    ]

    assert len(ids) == len(set(ids))


def test_total_placeholder_count():

    inventory = build_inventory()

    # Expected count from sample DOCX
    assert len(inventory) == 14


def test_text_span_exists():

    inventory = build_inventory()

    first = inventory[0]

    assert "matched_text_span" in first

    assert "start" in first["matched_text_span"]
    assert "end" in first["matched_text_span"]