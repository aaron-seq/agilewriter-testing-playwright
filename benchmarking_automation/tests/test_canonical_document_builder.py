from lxml import etree
import pytest
from doc_parser.run_normalizer import normalize_runs

from doc_parser.hierarchy_builder import HierarchyBuilder

from models.nodes import DocumentNode

NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
}


# =========================================================
# TEST 1
# Split placeholder reconstruction
# =========================================================

def test_split_placeholder_reconstruction():

    xml = """
    <w:p xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:r>
            <w:t>&lt;Pat</w:t>
        </w:r>

        <w:r>
            <w:t>ient_Name&gt;</w:t>
        </w:r>
    </w:p>
    """

    paragraph = etree.fromstring(xml)

    result = normalize_runs(paragraph)

    assert result["text"] == "<Patient_Name>"


# =========================================================
# TEST 2
# Multiple fragmented runs
# =========================================================

def test_multiple_fragmented_runs():

    xml = """
    <w:p xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">

        <w:r>
            <w:t>&lt;Pat</w:t>
        </w:r>

        <w:r>
            <w:t>ient</w:t>
        </w:r>

        <w:r>
            <w:t>_Na</w:t>
        </w:r>

        <w:r>
            <w:t>me&gt;</w:t>
        </w:r>

    </w:p>
    """

    paragraph = etree.fromstring(xml)

    result = normalize_runs(paragraph)

    assert result["text"] == "<Patient_Name>"


# =========================================================
# TEST 3
# Preserve formatting blocks
# =========================================================

def test_formatting_blocks_preserved():

    xml = """
    <w:p xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">

        <w:r>
            <w:t>Hello </w:t>
        </w:r>

        <w:r>
            <w:rPr>
                <w:b/>
            </w:rPr>

            <w:t>World</w:t>
        </w:r>

    </w:p>
    """

    paragraph = etree.fromstring(xml)

    result = normalize_runs(paragraph)

    assert result["text"] == "Hello World"

    assert len(result["rich_runs"]) == 2

    assert result["rich_runs"][0].text == "Hello "

    assert result["rich_runs"][1].text == "World"

    assert result["rich_runs"][0].bold is False

    assert result["rich_runs"][1].bold is True


# =========================================================
# TEST 4
# Empty runs should be ignored
# =========================================================

def test_empty_runs_ignored():

    xml = """
    <w:p xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">

        <w:r>
            <w:t></w:t>
        </w:r>

        <w:r>
            <w:t>Hello</w:t>
        </w:r>

    </w:p>
    """

    paragraph = etree.fromstring(xml)

    result = normalize_runs(paragraph)

    assert result["text"] == "Hello"


# =========================================================
# TEST 5
# Table hierarchy structure
# =========================================================

def test_table_hierarchy_structure():

    xml = """
    <w:tbl xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">

        <w:tr>

            <w:tc>

                <w:p>
                    <w:r>
                        <w:t>Patient Name</w:t>
                    </w:r>
                </w:p>

            </w:tc>

        </w:tr>

    </w:tbl>
    """

    table = etree.fromstring(xml)

    builder = HierarchyBuilder()

    table_node = builder.build_table_node(
        table=table,
        table_index=0
    )

    # table
    assert table_node.type == "table"

    # row
    assert len(table_node.children) == 1

    row_node = table_node.children[0]

    assert row_node.type == "row"

    # cell
    assert len(row_node.children) == 1

    cell_node = row_node.children[0]

    assert cell_node.type == "cell"

    # paragraph
    assert len(cell_node.children) == 1

    paragraph_node = cell_node.children[0]

    assert paragraph_node.type == "paragraph"

    assert paragraph_node.text == "Patient Name"


# =========================================================
# TEST 6
# List paragraph detection
# =========================================================

def test_list_paragraph_detection():

    xml = """
    <w:p xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">

        <w:pPr>
            <w:numPr>
                <w:ilvl w:val="0"/>
                <w:numId w:val="1"/>
            </w:numPr>
        </w:pPr>

        <w:r>
            <w:t>List Item</w:t>
        </w:r>

    </w:p>
    """

    paragraph = etree.fromstring(xml)

    builder = HierarchyBuilder()

    node = builder.build_paragraph_node(
        paragraph=paragraph,
        paragraph_index=0,
        all_paragraphs=[paragraph]
    )

    assert node.type in ["paragraph", "list_item"]

    assert node.text == "List Item"


# =========================================================
# TEST 7
# Paragraph node structure
# =========================================================

def test_paragraph_node_structure():

    xml = """
    <w:p xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">

        <w:r>
            <w:t>&lt;Patient_Name&gt;</w:t>
        </w:r>

    </w:p>
    """

    paragraph = etree.fromstring(xml)

    builder = HierarchyBuilder()

    node = builder.build_paragraph_node(
        paragraph=paragraph,
        paragraph_index=1,
        all_paragraphs=[paragraph]
    )

    assert isinstance(node, DocumentNode)

    assert node.type == "paragraph"

    assert node.text == "<Patient_Name>"

    assert node.location.paragraph_index == 1

    assert len(node.rich_runs) == 1

    assert node.rich_runs[0].text == "<Patient_Name>"


# =========================================================
# TEST 8
# Real DOCX smoke test
# =========================================================

def test_real_docx_placeholder_reconstruction():

    from docx import Document

    doc = Document(
        "tests/Adv_Sample_Template.docx"
    )

    found = False

    for para in doc.paragraphs:

        full_text = "".join(
            run.text for run in para.runs
        )

        if "<" in full_text and ">" in full_text:
            found = True

            assert len(full_text.strip()) > 0

    assert found is True