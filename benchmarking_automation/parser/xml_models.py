from dataclasses import dataclass
from lxml.etree import _Element


@dataclass
class ParsedXmlPart:
    name: str
    tree: _Element


@dataclass
class ParsedDocument:
    document_xml: ParsedXmlPart
    headers: list[ParsedXmlPart]
    footers: list[ParsedXmlPart]
    styles: ParsedXmlPart | None
    numbering: ParsedXmlPart | None



@dataclass
class XmlPart:
    path: str
    content: bytes