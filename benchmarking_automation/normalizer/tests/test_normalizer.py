from pathlib import Path

from lxml import etree

from normalizer.canonical_tree_builder import build_canonical_tree
from normalizer.run_reconstructor import reconstruct_paragraph_text
from parser.xml_models import ParsedDocument, ParsedXmlPart
from parser.xml_parser import load_docx


WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS = {"w": WORD_NS}
BASE_DIR = Path(__file__).resolve().parents[2] / "tests"
SAMPLE_DOCX = BASE_DIR / "basic_sample_template.docx"


def xml_element(xml: str):
    return etree.fromstring(xml.encode("utf-8"))


def parsed_part(name: str, xml: str) -> ParsedXmlPart:
    return ParsedXmlPart(name=name, tree=xml_element(xml))


def parsed_document(document_xml: str, headers=None, footers=None) -> ParsedDocument:
    return ParsedDocument(
        document_xml=parsed_part("word/document.xml", document_xml),
        headers=[parsed_part(f"word/header{i + 1}.xml", xml) for i, xml in enumerate(headers or [])],
        footers=[parsed_part(f"word/footer{i + 1}.xml", xml) for i, xml in enumerate(footers or [])],
        styles=None,
        numbering=None,
    )


def paragraph_xml(inner_xml: str) -> str:
    return f'<w:p xmlns:w="{WORD_NS}">{inner_xml}</w:p>'


def document_xml(body_xml: str) -> str:
    return (
        f'<w:document xmlns:w="{WORD_NS}">'
        f"<w:body>{body_xml}</w:body>"
        f"</w:document>"
    )


def test_st2_tc01_single_run_paragraph_reconstructs_correctly():
    """ST2-TC01: Single run paragraph reconstructs correctly."""
    paragraph = xml_element(paragraph_xml("<w:r><w:t>Hello World</w:t></w:r>"))

    assert reconstruct_paragraph_text(paragraph) == "Hello World"


def test_st2_tc02_multi_run_paragraph_concatenates_into_single_string():
    """ST2-TC02: Multi-run paragraph concatenates into single string."""
    paragraph = xml_element(
        paragraph_xml(
            "<w:r><w:t>Hello </w:t></w:r>"
            "<w:r><w:t>World</w:t></w:r>"
        )
    )

    assert reconstruct_paragraph_text(paragraph) == "Hello World"


def test_st2_tc03_fragmented_placeholder_reconstructs_to_full_placeholder():
    """ST2-TC03: Fragmented placeholder reconstructs to <Patient_Name>."""
    paragraph = xml_element(
        paragraph_xml(
            "<w:r><w:t>&lt;Pat</w:t></w:r>"
            "<w:r><w:t>ient</w:t></w:r>"
            "<w:r><w:t>_Name&gt;</w:t></w:r>"
        )
    )

    assert reconstruct_paragraph_text(paragraph) == "<Patient_Name>"


def test_st2_tc04_xml_space_preserve_spaces_are_preserved_mid_string():
    """ST2-TC04: xml:space='preserve' spaces are preserved mid-string."""
    paragraph = xml_element(
        (
            f'<w:p xmlns:w="{WORD_NS}" xmlns:xml="http://www.w3.org/XML/1998/namespace">'
            '<w:r><w:t>Alpha</w:t></w:r>'
            '<w:r><w:t xml:space="preserve">   Beta</w:t></w:r>'
            "</w:p>"
        )
    )

    assert reconstruct_paragraph_text(paragraph) == "Alpha   Beta"


def test_st2_tc05_instr_text_content_is_excluded_from_reconstruction():
    """ST2-TC05: w:instrText field instructions are excluded."""
    paragraph = xml_element(
        paragraph_xml(
            "<w:r><w:t>Page </w:t></w:r>"
            "<w:r><w:instrText>PAGE \\* MERGEFORMAT</w:instrText></w:r>"
            "<w:r><w:t>1</w:t></w:r>"
        )
    )

    assert reconstruct_paragraph_text(paragraph) == "Page 1"


def test_st2_tc06_empty_paragraph_produces_empty_string():
    """ST2-TC06: Empty paragraph produces empty string."""
    paragraph = xml_element(paragraph_xml(""))

    assert reconstruct_paragraph_text(paragraph) == ""


def test_st2_tc07_table_cell_paragraph_has_correct_table_path():
    """ST2-TC07: Table cell paragraph has correct T1/R2/C2 path."""
    doc = parsed_document(
        document_xml(
            "<w:tbl>"
            "<w:tr><w:tc><w:p><w:r><w:t>R1C1</w:t></w:r></w:p></w:tc></w:tr>"
            "<w:tr>"
            "<w:tc><w:p><w:r><w:t>R2C1</w:t></w:r></w:p></w:tc>"
            "<w:tc><w:p><w:r><w:t>R2C2</w:t></w:r></w:p></w:tc>"
            "</w:tr>"
            "</w:tbl>"
        )
    )

    tree = build_canonical_tree(doc)
    target = next(node for node in tree.nodes if node.text == "R2C2")

    assert target.location.table_path == "T1/R2/C2"
    assert target.location.table_index == 0
    assert target.location.row_index == 1
    assert target.location.cell_index == 1
    assert target.location.paragraph_index == 0


def test_st2_tc08_header_paragraphs_have_header_section():
    """ST2-TC08: Header paragraphs have section='header_0'."""
    doc = parsed_document(
        document_xml(""),
        headers=[f'<w:hdr xmlns:w="{WORD_NS}"><w:p><w:r><w:t>Header Text</w:t></w:r></w:p></w:hdr>'],
    )

    tree = build_canonical_tree(doc)

    assert tree.nodes[0].text == "Header Text"
    assert tree.nodes[0].location.section == "header_0"


def test_st2_tc09_footer_paragraphs_have_footer_section():
    """ST2-TC09: Footer paragraphs have section='footer_0'."""
    doc = parsed_document(
        document_xml(""),
        footers=[f'<w:ftr xmlns:w="{WORD_NS}"><w:p><w:r><w:t>Footer Text</w:t></w:r></w:p></w:ftr>'],
    )

    tree = build_canonical_tree(doc)

    assert tree.nodes[0].text == "Footer Text"
    assert tree.nodes[0].location.section == "footer_0"


def test_st2_tc10_node_ids_are_globally_sequential():
    """ST2-TC10: Node IDs are globally sequential across all sections."""
    doc = parsed_document(
        document_xml("<w:p><w:r><w:t>Doc</w:t></w:r></w:p>"),
        headers=[f'<w:hdr xmlns:w="{WORD_NS}"><w:p><w:r><w:t>Header</w:t></w:r></w:p></w:hdr>'],
        footers=[f'<w:ftr xmlns:w="{WORD_NS}"><w:p><w:r><w:t>Footer</w:t></w:r></w:p></w:ftr>'],
    )

    tree = build_canonical_tree(doc)

    assert [node.node_id for node in tree.nodes] == ["P_0001", "P_0002", "P_0003"]


def test_st2_tc11_canonical_tree_order_is_document_then_headers_then_footers():
    """ST2-TC11: CanonicalDocumentTree.nodes is ordered doc -> headers -> footers."""
    doc = parsed_document(
        document_xml("<w:p><w:r><w:t>Document</w:t></w:r></w:p>"),
        headers=[f'<w:hdr xmlns:w="{WORD_NS}"><w:p><w:r><w:t>Header</w:t></w:r></w:p></w:hdr>'],
        footers=[f'<w:ftr xmlns:w="{WORD_NS}"><w:p><w:r><w:t>Footer</w:t></w:r></w:p></w:ftr>'],
    )

    tree = build_canonical_tree(doc)

    assert [node.text for node in tree.nodes] == ["Document", "Header", "Footer"]


def test_st2_tc12_list_item_paragraph_is_flagged():
    """ST2-TC12: List item paragraph is flagged with is_list_item=True."""
    doc = parsed_document(
        document_xml(
            "<w:p>"
            "<w:pPr><w:numPr><w:ilvl w:val=\"0\"/><w:numId w:val=\"1\"/></w:numPr></w:pPr>"
            "<w:r><w:t>List Item</w:t></w:r>"
            "</w:p>"
        )
    )

    tree = build_canonical_tree(doc)

    assert tree.nodes[0].text == "List Item"
    assert tree.nodes[0].location.is_list_item is True


def test_st2_tc13_full_integration_build_canonical_tree_from_sample_docx_produces_nodes():
    """ST2-TC13: Full integration builds nodes from the sample DOCX."""
    parsed = load_docx(str(SAMPLE_DOCX))

    tree = build_canonical_tree(parsed)

    assert tree.nodes
    assert all(node.node_id.startswith("P_") for node in tree.nodes)
    assert all(isinstance(node.text, str) for node in tree.nodes)


def test_st2_tc14_non_table_paragraphs_have_no_table_metadata():
    """ST2-TC14: Paragraphs outside tables have no table metadata."""
    doc = parsed_document(
        document_xml("<w:p><w:r><w:t>Outside Table</w:t></w:r></w:p>")
    )

    tree = build_canonical_tree(doc)
    node = tree.nodes[0]

    assert node.location.table_index is None
    assert node.location.row_index is None
    assert node.location.cell_index is None
    assert node.location.table_path is None


def test_st2_tc15_deleted_text_is_excluded_from_reconstruction():
    """ST2-TC15: w:delText tracked-deletion content is excluded."""
    paragraph = xml_element(
        paragraph_xml(
            "<w:r><w:t>Visible</w:t></w:r>"
            "<w:r><w:delText>Deleted</w:delText></w:r>"
            "<w:r><w:t> Text</w:t></w:r>"
        )
    )

    assert reconstruct_paragraph_text(paragraph) == "Visible Text"


def test_st2_tc16_nested_table_does_not_raise():
    """ST2-TC16: Nested tables are out of scope but must not crash ST2."""
    doc = parsed_document(
        document_xml(
            "<w:tbl>"
            "<w:tr>"
            "<w:tc>"
            "<w:p><w:r><w:t>Outer Cell</w:t></w:r></w:p>"
            "<w:tbl>"
            "<w:tr><w:tc><w:p><w:r><w:t>Nested Cell</w:t></w:r></w:p></w:tc></w:tr>"
            "</w:tbl>"
            "</w:tc>"
            "</w:tr>"
            "</w:tbl>"
        )
    )

    tree = build_canonical_tree(doc)

    assert [node.text for node in tree.nodes] == ["Outer Cell"]
