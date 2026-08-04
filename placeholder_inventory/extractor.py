"""
Extract every placeholder from a .docx template, with structure and context.

Combines the two approaches that already existed in this codebase:

- From test-openai-benchmark: scan EVERY word/*.xml part (headers, footers,
  footnotes - not just document.xml), flatten runs before matching, and filter
  noise. Measured 100% recall with zero false positives on ICF_SET0.
- From benchmarking_automation: read tracked-change text as well. Word stores
  deleted text in <w:delText>, so a template with revisions yields nothing to a
  scanner that only reads <w:t>.

Structure (table / list / paragraph) is read from the document tree rather than
guessed from the placeholder's wording, because the tree is ground truth.
"""

from __future__ import annotations

import re
import zipfile
from dataclasses import dataclass, field

from lxml import etree

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

# Placeholders look like <Study Title>. Bounded length and no newlines so a
# stray "<" followed much later by ">" cannot swallow half the document.
_ANGLE_RE = re.compile(r"<([^<>\n]{1,300}?)>")

# Text that sits between angle brackets but is not a placeholder.
_NOISE_EXACT = {
    "insert", "711", "n/a", "tbd", "na", "insert.",
    "click here", "type here", "enter text",
    "month", "year", "insert table number", "insert table numbers",
}
_NOISE_RE = re.compile(
    r"^[\d\s\.\-\+\,\/\\]+$"   # digits/punctuation only
    r"|^[a-zA-Z]{1,2}$"        # one or two letters
    r"|^https?://"             # URLs
    r"|^\?|^/|^w:|^xml"        # XML fragments that leaked through
)


@dataclass
class Occurrence:
    """One physical appearance of a placeholder in the document."""
    part: str            # e.g. "word/document.xml", "word/header1.xml"
    paragraph_index: int
    structure: str       # Table | List | Paragraph
    heading: str         # nearest preceding heading
    sentence: str        # the text it sits in, with the placeholder blanked
    is_tracked_deletion: bool


@dataclass
class Placeholder:
    name: str
    occurrences: list[Occurrence] = field(default_factory=list)

    @property
    def count(self) -> int:
        return len(self.occurrences)

    @property
    def structure(self) -> str:
        """Structure of the first occurrence - what the QA sheet reports."""
        return self.occurrences[0].structure if self.occurrences else "Paragraph"

    @property
    def context(self) -> str:
        return self.occurrences[0].sentence if self.occurrences else ""

    @property
    def heading(self) -> str:
        return self.occurrences[0].heading if self.occurrences else ""


def extract(docx_path: str) -> list[Placeholder]:
    """Every placeholder in the template, in document order, de-duplicated."""
    found: dict[str, Placeholder] = {}

    with zipfile.ZipFile(docx_path, "r") as archive:
        for part in _ordered_parts(archive):
            try:
                root = etree.fromstring(archive.read(part))
            except etree.XMLSyntaxError:
                # A malformed part should not lose the rest of the document.
                continue
            _scan_part(root, part, found)

    return list(found.values())


def _ordered_parts(archive: zipfile.ZipFile) -> list[str]:
    """document.xml first, then headers/footers/footnotes, for stable order."""
    parts = [
        name for name in archive.namelist()
        if name.startswith("word/") and name.endswith(".xml")
        and not name.startswith("word/_rels")
    ]
    parts.sort(key=lambda n: (n != "word/document.xml", n))
    return parts


def _scan_part(root, part: str, found: dict[str, Placeholder]) -> None:
    paragraphs = root.iter(f"{W}p")
    heading = ""

    for index, paragraph in enumerate(paragraphs):
        text, has_deleted = _paragraph_text(paragraph)
        if not text:
            continue

        if _looks_like_heading(text):
            heading = text

        structure = _structure_of(paragraph)

        for match in _ANGLE_RE.finditer(text):
            name = _clean(match.group(1))
            if not _is_placeholder(name):
                continue

            occurrence = Occurrence(
                part=part,
                paragraph_index=index,
                structure=structure,
                heading=heading if heading != text else "",
                sentence=_blank_out(text, match.group(0)),
                is_tracked_deletion=has_deleted,
            )

            found.setdefault(name, Placeholder(name=name)).occurrences.append(occurrence)


def _paragraph_text(paragraph) -> tuple[str, bool]:
    """
    Flattened paragraph text, including tracked-change deletions.

    Word splits a placeholder across runs whenever formatting or spellcheck
    state changes mid-word, so "<Study Title>" is routinely stored as
    "<Study", " Tit", "le>". Matching per-run finds nothing; matching the
    concatenation finds everything.
    """
    pieces: list[str] = []
    has_deleted = False

    for node in paragraph.iter():
        if node.tag == f"{W}t":
            pieces.append(node.text or "")
        elif node.tag == f"{W}delText":
            # Deleted text still carries the placeholder in a revised template.
            pieces.append(node.text or "")
            has_deleted = True
        elif node.tag in (f"{W}tab",):
            pieces.append(" ")
        elif node.tag in (f"{W}br", f"{W}cr"):
            pieces.append(" ")

    return "".join(pieces).strip(), has_deleted


def _structure_of(paragraph) -> str:
    """
    Where the paragraph physically sits. Read from ancestors rather than
    inferred from wording - a placeholder named "<Table: Demographics>" that
    sits in a normal paragraph is a Paragraph, whatever it calls itself.
    """
    if paragraph.find(f"{W}pPr/{W}numPr") is not None:
        return "List"

    for ancestor in paragraph.iterancestors():
        if ancestor.tag == f"{W}tbl":
            return "Table"

    return "Paragraph"


def _looks_like_heading(text: str) -> bool:
    if "<" in text and ">" in text:
        return False

    words = text.split()
    if not words or len(words) > 12:
        return False
    if re.match(r"^[\d\.]+\s+\w", text):        # "3.1 Study Design"
        return True
    return len(words) <= 6 and text[0].isupper()


def _blank_out(text: str, placeholder: str) -> str:
    return text.replace(placeholder, "___").strip()[:300]


def _clean(raw: str) -> str:
    return re.sub(r"\s+", " ", raw).strip()


def _is_placeholder(name: str) -> bool:
    if not name or len(name) < 3:
        return False
    if name.lower() in _NOISE_EXACT:
        return False
    if _NOISE_RE.match(name):
        return False
    if name.startswith("/") or "://" in name:
        return False
    return True
