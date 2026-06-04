import sys
from pathlib import Path

# Add project root to Python path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

sys.path.insert(0, str(PROJECT_ROOT))

from lxml import etree

from doc_parser.run_normalizer import normalize_runs
from doc_parser.hierarchy_builder import HierarchyBuilder


NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
}


# =====================================================
# Helpers
# =====================================================

def build_paragraph(xml_string: str):
    return etree.fromstring(xml_string.encode("utf-8"))


# =====================================================
# Test 1
# Bold Extraction
# =====================================================

def test_extract_bold():

    paragraph = build_paragraph(
        """
        <w:p xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
            <w:r>
                <w:rPr>
                    <w:b/>
                </w:rPr>
                <w:t>Bold Text</w:t>
            </w:r>
        </w:p>
        """
    )

    result = normalize_runs(paragraph)

    assert len(result["rich_runs"]) == 1

    rich_run = result["rich_runs"][0]

    assert rich_run.bold is True
    assert rich_run.text == "Bold Text"


# =====================================================
# Test 2
# Italic Extraction
# =====================================================

def test_extract_italic():

    paragraph = build_paragraph(
        """
        <w:p xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
            <w:r>
                <w:rPr>
                    <w:i/>
                </w:rPr>
                <w:t>Italic Text</w:t>
            </w:r>
        </w:p>
        """
    )

    result = normalize_runs(paragraph)

    rich_run = result["rich_runs"][0]

    assert rich_run.italic is True


# =====================================================
# Test 3
# Strikethrough Extraction
# =====================================================

def test_extract_strike():

    paragraph = build_paragraph(
        """
        <w:p xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
            <w:r>
                <w:rPr>
                    <w:strike/>
                </w:rPr>
                <w:t>Deleted Text</w:t>
            </w:r>
        </w:p>
        """
    )

    result = normalize_runs(paragraph)

    rich_run = result["rich_runs"][0]

    assert rich_run.strike is True


# =====================================================
# Test 4
# Table Extraction
# =====================================================

def test_table_extraction():

    table = etree.fromstring(
        """
        <w:tbl xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">

            <w:tr>

                <w:tc>
                    <w:p>
                        <w:r>
                            <w:t>Cell 1</w:t>
                        </w:r>
                    </w:p>
                </w:tc>

            </w:tr>

        </w:tbl>
        """
    )

    builder = HierarchyBuilder()

    table_node = builder.build_table_node(
        table=table,
        table_index=0,
        section="document"
    )

    assert table_node.type == "table"


# =====================================================
# Test 5
# List Extraction
# =====================================================

def test_list_extraction():

    paragraph = build_paragraph(
        """
        <w:p xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">

            <w:pPr>
                <w:numPr>
                    <w:ilvl w:val="0"/>
                    <w:numId w:val="1"/>
                </w:numPr>
            </w:pPr>

            <w:r>
                <w:t>Item 1</w:t>
            </w:r>

        </w:p>
        """
    )

    builder = HierarchyBuilder()

    node = builder.build_paragraph_node(
        paragraph=paragraph,
        paragraph_index=0,
        all_paragraphs=[paragraph]
    )

    assert node.type == "list_item"


# =====================================================
# Additional SCC-242 Validation Tests
# =====================================================

def test_extract_font_name():

    paragraph = build_paragraph(
        """
        <w:p xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
            <w:r>
                <w:rPr>
                    <w:rFonts w:ascii="Calibri"/>
                </w:rPr>
                <w:t>Font Test</w:t>
            </w:r>
        </w:p>
        """
    )

    result = normalize_runs(paragraph)

    rich_run = result["rich_runs"][0]

    assert rich_run.font_name == "Calibri"


def test_extract_font_size():

    paragraph = build_paragraph(
        """
        <w:p xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
            <w:r>
                <w:rPr>
                    <w:sz w:val="22"/>
                </w:rPr>
                <w:t>Size Test</w:t>
            </w:r>
        </w:p>
        """
    )

    result = normalize_runs(paragraph)

    rich_run = result["rich_runs"][0]

    assert rich_run.font_size == 22


def test_extract_color():

    paragraph = build_paragraph(
        """
        <w:p xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
            <w:r>
                <w:rPr>
                    <w:color w:val="FF0000"/>
                </w:rPr>
                <w:t>Red Text</w:t>
            </w:r>
        </w:p>
        """
    )

    result = normalize_runs(paragraph)

    rich_run = result["rich_runs"][0]

    assert rich_run.color == "FF0000"


def test_extract_highlight():

    paragraph = build_paragraph(
        """
        <w:p xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
            <w:r>
                <w:rPr>
                    <w:highlight w:val="yellow"/>
                </w:rPr>
                <w:t>Highlighted</w:t>
            </w:r>
        </w:p>
        """
    )

    result = normalize_runs(paragraph)

    rich_run = result["rich_runs"][0]

    assert rich_run.highlight == "yellow"


def test_reconstruct_fragmented_runs():

    paragraph = build_paragraph(
        """
        <w:p xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">

            <w:r>
                <w:t>&lt;Pat</w:t>
            </w:r>

            <w:r>
                <w:t>ient_Name&gt;</w:t>
            </w:r>

        </w:p>
        """
    )

    result = normalize_runs(paragraph)

    assert result["text"] == "<Patient_Name>"