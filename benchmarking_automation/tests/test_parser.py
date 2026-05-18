#User Story 01: subtask 1

from pathlib import Path
import pytest

from doc_parser.xml_parser import load_docx


BASE_DIR = Path(__file__).parent

SAMPLE_DOCX = BASE_DIR / "basic_sample_template.docx"
INVALID_DOCX = BASE_DIR / "invalid.docx"

#ST1-TC01
def test_docx_opens_successfully():
    parsed = load_docx(str(SAMPLE_DOCX))

    assert parsed is not None

#ST1-TC02
def test_document_xml_extracted():
    parsed = load_docx(str(SAMPLE_DOCX))

    assert parsed.document_xml is not None

#ST1-TC03
#ST1-TC03
def test_headers_parsed():
    parsed = load_docx(str(SAMPLE_DOCX))

    assert isinstance(parsed.headers, list)

#ST1-TC04
def test_footers_parsed():
    parsed = load_docx(str(SAMPLE_DOCX))

    assert isinstance(parsed.footers, list)

#ST1-TC05
def test_tables_detected():
    parsed = load_docx(str(SAMPLE_DOCX))

    tables = parsed.document_xml.tree.findall(
        ".//w:tbl",
        {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    )

    assert len(tables) > 0

#ST1-TC06
def test_invalid_docx_handled_safely():
    with pytest.raises(Exception):
        load_docx(str(INVALID_DOCX))