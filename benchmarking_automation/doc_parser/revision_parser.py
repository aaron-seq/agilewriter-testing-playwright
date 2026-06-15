"""
Revision Parser for Word Track Changes (w:del / w:ins / w:moveFrom / w:moveTo).

Extracts text fragments from revision elements and detects deletion↔insertion pairs
that represent placeholder replacements.

Usage:
    revision_data = parse_paragraph_revisions(paragraph_xml_element)
    # Returns:
    # {
    #     "fragments": [RevisionFragment, ...],
    #     "deleted_text": "...",
    #     "inserted_text": "...",
    #     "paired_replacements": [TrackedReplacementPair, ...]
    # }
"""

from typing import List, Optional
from models.nodes import RevisionFragment, TrackedReplacementPair
import re

NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
}

PLACEHOLDER_PATTERN = re.compile(r"<\s*([^<>]+?)\s*>")


def extract_fragment_text(element) -> str:
    """
    Extract all text from w:t and w:delText nodes within a given element.
    """
    texts = []
    # w:t elements
    for t_node in element.xpath(".//w:t", namespaces=NS):
        if t_node.text:
            texts.append(t_node.text)
    # w:delText elements (used for tracked deletion text)
    for dt_node in element.xpath(".//w:delText", namespaces=NS):
        if dt_node.text:
            texts.append(dt_node.text)
    return "".join(texts)


def extract_normal_fragments(paragraph) -> list:
    """
    Extract text from regular w:r runs that are NOT inside revision elements.
    """
    fragments = []
    # Get all w:r that are direct children of w:p or w:tc, not nested inside w:del/w:ins
    # We walk the paragraph children directly
    for child in paragraph:
        tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag
        if tag == "r":
            text = extract_fragment_text(child)
            if text:
                fragments.append(RevisionFragment(
                    text=text,
                    source="normal",
                    revision_type=None
                ))
        elif tag == "rPr":
            # Skip run properties that appear at paragraph level
            pass
    return fragments


def extract_revision_fragments(paragraph) -> list:
    """
    Extract text from revision elements: w:del, w:ins, w:moveFrom, w:moveTo.
    Each revision element may contain one or more w:r runs.
    """
    fragments = []

    revision_types = {
        "del": "deleted",
        "ins": "inserted",
        "moveFrom": "deleted",
        "moveTo": "inserted"
    }

    for rev_type, source in revision_types.items():
        xpath = f".//w:{rev_type}"
        for rev_elem in paragraph.xpath(xpath, namespaces=NS):
            text = extract_fragment_text(rev_elem)
            if text:
                fragments.append(RevisionFragment(
                    text=text,
                    source=source,
                    revision_type=rev_type
                ))

    return fragments


def extract_all_fragments(paragraph) -> list:
    """
    Extract ALL text fragments from a paragraph, preserving revision context.
    Returns a list of RevisionFragment sorted by document order.
    """
    fragments = []

    # We need to walk children in order to preserve relative positioning
    for child in paragraph:
        tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag

        if tag == "r":
            text = extract_fragment_text(child)
            if text:
                fragments.append(RevisionFragment(
                    text=text,
                    source="normal",
                    revision_type=None
                ))

        elif tag == "del":
            text = extract_fragment_text(child)
            if text:
                fragments.append(RevisionFragment(
                    text=text,
                    source="deleted",
                    revision_type="del"
                ))

        elif tag == "ins":
            text = extract_fragment_text(child)
            if text:
                fragments.append(RevisionFragment(
                    text=text,
                    source="inserted",
                    revision_type="ins"
                ))

        elif tag == "moveFrom":
            text = extract_fragment_text(child)
            if text:
                fragments.append(RevisionFragment(
                    text=text,
                    source="deleted",
                    revision_type="moveFrom"
                ))

        elif tag == "moveTo":
            text = extract_fragment_text(child)
            if text:
                fragments.append(RevisionFragment(
                    text=text,
                    source="inserted",
                    revision_type="moveTo"
                ))

        elif tag in ("pPr", "rPr", "bookmarkStart", "bookmarkEnd", "commentRangeStart",
                     "commentRangeEnd", "commentReference"):
            # Skip structural/formatting-only elements
            pass

        elif tag == "hyperlinks":
            # May contain runs inside hyperlinks
            for run in child.xpath(".//w:r", namespaces=NS):
                text = extract_fragment_text(run)
                if text:
                    fragments.append(RevisionFragment(
                        text=text,
                        source="normal",
                        revision_type=None
                    ))

    return fragments


def build_combined_text(fragments: list) -> str:
    """
    Build a unified text string from fragments.
    Includes deleted text so placeholders remain visible for detection.
    """
    parts = []
    for frag in fragments:
        parts.append(frag.text)
    return "".join(parts)


def build_visible_text(fragments: list) -> str:
    """
    Build the visible/accepted text (normal + inserted, excluding deleted).
    This represents what the user sees if Track Changes is off.
    """
    parts = []
    for frag in fragments:
        if frag.source != "deleted":
            parts.append(frag.text)
    return "".join(parts)


def detect_replacement_pairs(fragments: list) -> list:
    """
    Detect deletion↔insertion pairs that represent placeholder replacements.
    
    Heuristics:
    1. A deleted fragment containing a placeholder pattern <...>
       followed by an inserted fragment → likely a replacement.
    2. Adjacent del→ins pairs in the fragment sequence.
    3. The deleted text contains something that looks like a placeholder.
    
    Returns list of TrackedReplacementPair.
    """
    pairs = []

    for i in range(len(fragments) - 1):
        current = fragments[i]
        next_frag = fragments[i + 1]

        # Check for deletion followed by insertion
        if current.source == "deleted" and next_frag.source == "inserted":
            deleted_text = current.text.strip()
            inserted_text = next_frag.text.strip()

            if deleted_text and inserted_text:
                placeholder = None
                # Check if deleted text contains a placeholder pattern
                match = PLACEHOLDER_PATTERN.search(deleted_text)
                if match:
                    placeholder = match.group(0)

                pairs.append(TrackedReplacementPair(
                    deleted_text=deleted_text,
                    inserted_text=inserted_text,
                    placeholder=placeholder,
                    confidence=0.95 if placeholder else 0.7
                ))

        # Check for inserted followed by deletion (reverse order sometimes happens)
        elif current.source == "inserted" and next_frag.source == "deleted":
            deleted_text = next_frag.text.strip()
            inserted_text = current.text.strip()

            if deleted_text and inserted_text:
                placeholder = None
                match = PLACEHOLDER_PATTERN.search(deleted_text)
                if match:
                    placeholder = match.group(0)

                pairs.append(TrackedReplacementPair(
                    deleted_text=deleted_text,
                    inserted_text=inserted_text,
                    placeholder=placeholder,
                    confidence=0.95 if placeholder else 0.7
                ))

    return pairs


def parse_paragraph_revisions(paragraph) -> dict:
    """
    Main entry point: parse all revision data from a paragraph XML element.
    
    Returns:
    {
        "fragments": [RevisionFragment, ...],  # All fragments in document order
        "combined_text": str,  # All text including deleted (for placeholder detection)
        "visible_text": str,   # Only accepted text (normal + inserted)
        "deleted_text": str,   # All deleted text concatenated
        "inserted_text": str,  # All inserted text concatenated
        "paired_replacements": [TrackedReplacementPair, ...]  # Detected del↔ins pairs
    }
    """
    fragments = extract_all_fragments(paragraph)
    combined_text = build_combined_text(fragments)
    visible_text = build_visible_text(fragments)
    pairs = detect_replacement_pairs(fragments)

    deleted_text = "".join(
        f.text for f in fragments if f.source == "deleted"
    )

    inserted_text = "".join(
        f.text for f in fragments if f.source == "inserted"
    )

    return {
        "fragments": fragments,
        "combined_text": combined_text,
        "visible_text": visible_text,
        "deleted_text": deleted_text,
        "inserted_text": inserted_text,
        "paired_replacements": pairs,
    }