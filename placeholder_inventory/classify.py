"""
Classify a placeholder into the taxonomy the QA workbooks use:
KeyValue | Paragraph | List | Table | Unknown

This is content *intent*, not document structure. ICF_SET0 has four tables and
no placeholder inside any of them, yet the reference workbook labels two
placeholders "Table" - because those ask for tabular content. So structure
alone cannot produce this taxonomy; the wording has to be read too.

Structure still wins where it is unambiguous: a placeholder sitting in a
numbered/bulleted paragraph is a List whatever its name says.
"""

from __future__ import annotations

import re

KEY_VALUE = "KeyValue"
PARAGRAPH = "Paragraph"
LIST = "List"
TABLE = "Table"
UNKNOWN = "Unknown"

_TABLE_RE = re.compile(
    r"^table[\s\d:.]"
    r"|^tbl[:\s]"
    r"|^grid[:\s]"
    r"|^matrix[:\s]"
    r"|\btable\s+\d"
    r"|\btables?\b",
    re.IGNORECASE,
)

_LIST_RE = re.compile(
    r"\bin\s+bullets?\b"
    r"|\bas\s+bullets?\b"
    r"|\bbulleted\s+list\b"
    r"|\blist\s+of\b"
    r"|^list[:\s]"
    r"|^items?[:\s]"
    r"|^bullet[s:\s]"
    r"|^points?[:\s]",
    re.IGNORECASE,
)

_PARAGRAPH_RE = re.compile(
    r"\bdescription\b"
    r"|\bsummary\b"
    r"|\bsummariz(e|ing)\b"
    r"|\bnarrative\b"
    r"|\boverview\b"
    r"|\bbackground\b"
    r"|\bexplain\b"
    r"|\brationale\b"
    r"|\bterminology\b"
    r"|\bdetails?\s+(on|of|for)\b"
    r"|\binformation\s+(on|about)\b"
    r"|^insert\s+a?\s*(brief|short)\b",
    re.IGNORECASE,
)

# A KeyValue is a short label naming one field: "Sponsor", "Protocol Number",
# "Telephone". Long or instruction-like text is never a KeyValue.
_MAX_KEY_VALUE_WORDS = 4


def classify(name: str, structure: str = PARAGRAPH) -> str:
    """
    Args:
        name: placeholder text without the angle brackets.
        structure: where it physically sits. Used only as a tie-break.

    Structure is deliberately NOT authoritative. In ICF_SET0 the body uses
    numbered paragraphs for ordinary sections, so <w:numPr> marks most of the
    document and would misclassify almost everything as a List.
    """
    text = (name or "").strip()
    if not text:
        return UNKNOWN

    # Order matters: "bullet list of lay terminology" is a List, even though
    # "terminology" also matches the Paragraph pattern.
    if _LIST_RE.search(text):
        return LIST
    if _TABLE_RE.search(text):
        return TABLE
    if _PARAGRAPH_RE.search(text):
        return PARAGRAPH

    if len(text.split()) <= _MAX_KEY_VALUE_WORDS:
        return KEY_VALUE

    # Only now does structure get a say, for names that give no signal at all.
    if structure == LIST:
        return LIST

    return PARAGRAPH
