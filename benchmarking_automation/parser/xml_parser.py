from lxml import etree
from parser.xml_models import ParsedXmlPart, ParsedDocument
from parser.docx_extractor import DocxExtractor

# WordprocessingML namespace
WORD_NAMESPACE = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
}


class XmlParseError(Exception):
    """Raised when XML parsing fails."""
    pass


def parse_xml(xml_bytes: bytes):
    """
    Convert raw XML bytes into an lxml XML tree.
    """

    try:

        parser = etree.XMLParser(
            resolve_entities=False
        )

        return etree.fromstring(xml_bytes, parser=parser)

    except etree.XMLSyntaxError as e:
        raise XmlParseError(f"Invalid XML content: {str(e)}")


def parse_document_xml(extracted_parts: dict) -> ParsedXmlPart:
    """
    Parse document.xml
    """

    if "document" not in extracted_parts:
        raise FileNotFoundError("document not found")

    document_part = extracted_parts["document"]

    xml_tree = parse_xml(document_part.content)

    return ParsedXmlPart(
        name=document_part.path,
        tree=xml_tree
    )


def parse_headers(extracted_parts: dict) -> list[ParsedXmlPart]:
    """
    Parse all header XML files.
    """

    parsed_headers = []

    headers = extracted_parts.get("headers", [])

    for header_part in headers:

        xml_tree = parse_xml(header_part.content)

        parsed_headers.append(
            ParsedXmlPart(
                name=header_part.path,
                tree=xml_tree
            )
        )

    return parsed_headers


def parse_footers(extracted_parts: dict) -> list[ParsedXmlPart]:
    """
    Parse all footer XML files.
    """

    parsed_footers = []

    footers = extracted_parts.get("footers", [])

    for footer_part in footers:

        xml_tree = parse_xml(footer_part.content)

        parsed_footers.append(
            ParsedXmlPart(
                name=footer_part.path,
                tree=xml_tree
            )
        )

    return parsed_footers



def parse_styles(extracted_parts: dict) -> ParsedXmlPart | None:
    """
    Parse styles.xml if present.
    """

    styles_part = extracted_parts.get("styles")

    if not styles_part:
        return None

    xml_tree = parse_xml(styles_part.content)

    return ParsedXmlPart(
        name=styles_part.path,
        tree=xml_tree
    )


def parse_numbering(extracted_parts: dict) -> ParsedXmlPart | None:
    """
    Parse numbering.xml if present.
    """

    numbering_part = extracted_parts.get("numbering")

    if not numbering_part:
        return None

    xml_tree = parse_xml(numbering_part.content)

    return ParsedXmlPart(
        name=numbering_part.path,
        tree=xml_tree
    )


# ---------------------------------------------------
# Structural traversal helper functions
# ---------------------------------------------------

def get_paragraphs(xml_root):
    """
    Return all paragraphs from XML root.
    """

    return xml_root.findall(".//w:p", WORD_NAMESPACE)

def is_list_paragraph(paragraph):
    """
    Detect whether paragraph belongs to a numbered/bulleted list.
    """

    num_pr = paragraph.find(".//w:numPr", WORD_NAMESPACE)

    return num_pr is not None

def get_tables(xml_root):
    """
    Return all tables from XML root.
    """

    return xml_root.findall(".//w:tbl", WORD_NAMESPACE)


def get_rows(table):
    """
    Return rows from a table.
    """

    return table.findall(".//w:tr", WORD_NAMESPACE)


def get_cells(row):
    """
    Return cells from a row.
    """

    return row.findall(".//w:tc", WORD_NAMESPACE)


def get_runs(paragraph):
    """
    Return text runs from a paragraph.
    """

    return paragraph.findall(".//w:r", WORD_NAMESPACE)


def get_texts(run):
    """
    Return all text nodes from a run.
    """

    return run.findall(".//w:t", WORD_NAMESPACE)


def extract_text_from_paragraph(paragraph) -> str:
    """
    Extract concatenated text from paragraph.
    This DOES NOT yet normalize fragmented placeholders.

    NOTE:
    This is a simplified text extraction helper.
    Structural semantics like tabs, breaks,
    field codes, and formatting are not yet preserved.
    """

    texts = []

    runs = get_runs(paragraph)

    for run in runs:

        text_nodes = get_texts(run)

        for text_node in text_nodes:

            if text_node.text:
                texts.append(text_node.text)

    return "".join(texts)


def load_docx(file_path: str) -> ParsedDocument:
    extractor = DocxExtractor(file_path)

    extracted = extractor.extract_all_xml_parts()

    return ParsedDocument(
        document_xml=parse_document_xml(extracted),
        headers=parse_headers(extracted),
        footers=parse_footers(extracted),
        styles=parse_styles(extracted),
        numbering=parse_numbering(extracted)
    )