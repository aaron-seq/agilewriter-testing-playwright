import sys
from pathlib import Path

# Add project root to Python path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

sys.path.insert(0, str(PROJECT_ROOT))

from doc_parser.xml_parser import load_docx
from doc_parser.node_builder import CanonicalDocumentBuilder


# =====================================================
# Test DOCX
# =====================================================

TEST_DOCX = (
    PROJECT_ROOT
    / "tests"
    / "CSR_1133_19_SB_raw.docx"
)


def build_tree():

    parsed_document = load_docx(
        str(TEST_DOCX)
    )

    return CanonicalDocumentBuilder().build(
        parsed_document
    )


# =====================================================
# Test 1
# Canonical Tree Builds
# =====================================================

def test_build_document_tree():

    tree = build_tree()

    assert tree is not None

    assert tree.type == "document"

    assert len(tree.children) > 0


# =====================================================
# Test 2
# Paragraph Contains Rich Runs
# =====================================================

def test_paragraph_contains_rich_runs():

    tree = build_tree()

    paragraph_nodes = [
        node
        for node in tree.children
        if node.type in (
            "paragraph",
            "list_item"
        )
    ]

    assert len(paragraph_nodes) > 0

    found = False

    for node in paragraph_nodes:

        if len(node.rich_runs) > 0:

            found = True

            break

    assert found


# =====================================================
# Test 3
# Headers Parsed
# =====================================================

def test_headers_parsed():

    tree = build_tree()

    header_nodes = [
        node
        for node in tree.children
        if (
            node.location
            and node.location.section
            and node.location.section.startswith(
                "header"
            )
        )
    ]

    assert len(header_nodes) > 0


# =====================================================
# Test 4
# Footers Parsed
# =====================================================

def test_footers_parsed():

    tree = build_tree()

    footer_nodes = [
        node
        for node in tree.children
        if (
            node.location
            and node.location.section
            and node.location.section.startswith(
                "footer"
            )
        )
    ]

    assert len(footer_nodes) > 0


# =====================================================
# Test 5
# Rich Formatting Exists
# =====================================================

def test_rich_formatting_present():

    tree = build_tree()

    found = False

    for node in tree.children:

        if (
            hasattr(node, "rich_runs")
            and len(node.rich_runs) > 0
        ):
            found = True
            break

    assert found


# =====================================================
# Test 6
# Node Ordering Unique
# Only if SCC-242 implemented node_order
# =====================================================

def test_node_order_unique():

    tree = build_tree()

    nodes_with_order = [
        node
        for node in tree.children
        if getattr(
            node,
            "node_order",
            None
        ) is not None
    ]

    if not nodes_with_order:
        return

    orders = [
        node.node_order
        for node in nodes_with_order
    ]

    assert len(orders) == len(set(orders))


# =====================================================
# Test 7
# Parent IDs Present
# Only if SCC-242 implemented parent_id
# =====================================================

def test_parent_ids_present():

    tree = build_tree()

    row_nodes = [
        node
        for node in tree.children
        if node.type == "row"
    ]

    if not row_nodes:
        return

    for row in row_nodes:

        assert row.parent_id is not None


# =====================================================
# Test 8
# Generated Document Tree Structure
# =====================================================

def test_generated_document_tree_contains_required_fields():

    tree = build_tree()

    paragraph_nodes = [
        node
        for node in tree.children
        if node.type == "paragraph"
    ]

    assert len(paragraph_nodes) > 0

    node = paragraph_nodes[0]

    assert node.id is not None

    assert node.type == "paragraph"

    assert isinstance(
        node.text,
        str
    )

    assert isinstance(
        node.rich_runs,
        list
    )