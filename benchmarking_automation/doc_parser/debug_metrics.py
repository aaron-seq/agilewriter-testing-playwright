"""
Debug metrics for DOCX analysis.

Provides diagnostic information about the document structure, including:
- Number of strikethrough runs
- Number of deleted/inserted revisions
- Number of placeholders found (by source)
- Number of tracked replacement pairs

This immediately reveals which mechanism the document uses
(strikethrough vs. tracked changes vs. plain text).
"""

from typing import Optional
from models.nodes import DocumentNode, RevisionFragment
from doc_parser.xml_parser import get_paragraphs, get_runs, WORD_NAMESPACE
from doc_parser.revision_parser import (
    extract_all_fragments,
    detect_replacement_pairs,
    PLACEHOLDER_PATTERN
)
import re


def analyze_document_metrics(parsed_document, generated_tree=None):
    """
    Analyze a parsed document and compute debug metrics.
    
    Args:
        parsed_document: ParsedDocument object with XML trees.
        generated_tree: Optional DocumentNode tree for placeholder counts.
        
    Returns:
        dict with metrics data.
    """
    metrics = {}

    # =========================================================
    # Run-level metrics from XML
    # =========================================================
    all_paragraphs = parsed_document.document_xml.tree.xpath(
        "//w:p", namespaces=WORD_NAMESPACE
    )

    strike_runs = 0
    deleted_revisions = 0
    inserted_revisions = 0
    total_runs = 0

    for para in all_paragraphs:
        # Count strikethrough runs
        strike_nodes = para.xpath(
            ".//w:r[.//w:strike]",
            namespaces=WORD_NAMESPACE
        )
        strike_runs += len(strike_nodes)

        # Count runs
        runs_in_para = para.xpath(".//w:r", namespaces=WORD_NAMESPACE)
        total_runs += len(runs_in_para)

        # Count revision elements
        dels = para.xpath(".//w:del", namespaces=WORD_NAMESPACE)
        deleted_revisions += len(dels)

        ins = para.xpath(".//w:ins", namespaces=WORD_NAMESPACE)
        inserted_revisions += len(ins)

        move_from = para.xpath(".//w:moveFrom", namespaces=WORD_NAMESPACE)
        deleted_revisions += len(move_from)

        move_to = para.xpath(".//w:moveTo", namespaces=WORD_NAMESPACE)
        inserted_revisions += len(move_to)

    # Also count in headers and footers
    for header_xml in parsed_document.headers:
        hdr_paras = header_xml.tree.xpath("//w:p", namespaces=WORD_NAMESPACE)
        for para in hdr_paras:
            strike_nodes = para.xpath(
                ".//w:r[.//w:strike]",
                namespaces=WORD_NAMESPACE
            )
            strike_runs += len(strike_nodes)
            dels = para.xpath(".//w:del", namespaces=WORD_NAMESPACE)
            deleted_revisions += len(dels)
            ins = para.xpath(".//w:ins", namespaces=WORD_NAMESPACE)
            inserted_revisions += len(ins)

    for footer_xml in parsed_document.footers:
        ftr_paras = footer_xml.tree.xpath("//w:p", namespaces=WORD_NAMESPACE)
        for para in ftr_paras:
            strike_nodes = para.xpath(
                ".//w:r[.//w:strike]",
                namespaces=WORD_NAMESPACE
            )
            strike_runs += len(strike_nodes)
            dels = para.xpath(".//w:del", namespaces=WORD_NAMESPACE)
            deleted_revisions += len(dels)
            ins = para.xpath(".//w:ins", namespaces=WORD_NAMESPACE)
            inserted_revisions += len(ins)

    metrics["total_runs"] = total_runs
    metrics["strike_runs"] = strike_runs
    metrics["deleted_revisions"] = deleted_revisions
    metrics["inserted_revisions"] = inserted_revisions

    # =========================================================
    # Revision fragment analysis
    # =========================================================
    fragment_count = 0
    deleted_fragments = 0
    inserted_fragments = 0
    normal_fragments = 0
    tracked_pairs_count = 0

    for para in all_paragraphs:
        revision_data = extract_all_fragments(para)
        fragment_count += len(revision_data)

        for frag in revision_data:
            if frag.source == "deleted":
                deleted_fragments += 1
            elif frag.source == "inserted":
                inserted_fragments += 1
            else:
                normal_fragments += 1

        pairs = detect_replacement_pairs(revision_data)
        tracked_pairs_count += len(pairs)

    metrics["fragment_count"] = fragment_count
    metrics["deleted_fragments"] = deleted_fragments
    metrics["inserted_fragments"] = inserted_fragments
    metrics["normal_fragments"] = normal_fragments
    metrics["tracked_replacement_pairs"] = tracked_pairs_count

    # =========================================================
    # Placeholder metrics from generated tree
    # =========================================================
    placeholders_found = 0
    placeholders_in_deleted = 0
    placeholders_in_normal = 0

    if generated_tree:
        all_placeholders = set()
        deleted_ph = set()
        normal_ph = set()
        
        nodes_to_check = [generated_tree]
        while nodes_to_check:
            node = nodes_to_check.pop()
            nodes_to_check.extend(node.children)

            if node.text:
                matches = PLACEHOLDER_PATTERN.finditer(node.text)
                for match in matches:
                    ph = match.group(0)
                    all_placeholders.add(ph)
                    normal_ph.add(ph)

            if hasattr(node, 'revision_fragments') and node.revision_fragments:
                for frag in node.revision_fragments:
                    if frag.source == "deleted" and frag.text:
                        matches = PLACEHOLDER_PATTERN.finditer(frag.text)
                        for match in matches:
                            ph = match.group(0)
                            all_placeholders.add(ph)
                            deleted_ph.add(ph)

        placeholders_found = len(all_placeholders)
        placeholders_in_deleted = len(deleted_ph)
        placeholders_in_normal = len(normal_ph - deleted_ph)

    metrics["placeholders_found"] = placeholders_found
    metrics["placeholders_in_deleted"] = placeholders_in_deleted
    metrics["placeholders_in_normal"] = placeholders_in_normal

    # =========================================================
    # Determine primary mechanism
    # =========================================================
    if metrics["deleted_revisions"] > 10 and metrics["strike_runs"] == 0:
        metrics["primary_mechanism"] = "tracked_changes"
        metrics["mechanism_confidence"] = "high"
        metrics["mechanism_note"] = (
            "Document uses Word Track Changes (w:del/w:ins). "
            "Placeholder replacement detection via revision matching."
        )
    elif metrics["strike_runs"] > 0 and metrics["deleted_revisions"] == 0:
        metrics["primary_mechanism"] = "strikethrough"
        metrics["mechanism_confidence"] = "high"
        metrics["mechanism_note"] = (
            "Document uses strikethrough formatting (w:strike). "
            "Placeholder replacement detection via formatting analysis."
        )
    elif metrics["strike_runs"] > 0 and metrics["deleted_revisions"] > 0:
        metrics["primary_mechanism"] = "mixed"
        metrics["mechanism_confidence"] = "medium"
        metrics["mechanism_note"] = (
            "Document uses BOTH strikethrough and tracked changes. "
            "Combined detection approach needed."
        )
    else:
        metrics["primary_mechanism"] = "plain_text"
        metrics["mechanism_confidence"] = "medium"
        metrics["mechanism_note"] = (
            "Document appears to use plain text replacement "
            "(no strikethrough or revision markup detected)."
        )

    return metrics


def format_metrics_report(metrics: dict) -> str:
    """
    Format debug metrics as a human-readable report string.
    """
    lines = []
    lines.append("=" * 60)
    lines.append("DOCX DEBUG METRICS REPORT")
    lines.append("=" * 60)
    lines.append("")

    lines.append("--- Run Analysis ---")
    lines.append(f"  Total XML runs:          {metrics.get('total_runs', 0)}")
    lines.append(f"  Strikethrough runs:      {metrics.get('strike_runs', 0)}")
    lines.append("")

    lines.append("--- Revision Analysis ---")
    lines.append(f"  Deleted revisions:       {metrics.get('deleted_revisions', 0)}")
    lines.append(f"  Inserted revisions:      {metrics.get('inserted_revisions', 0)}")
    lines.append(f"  Tracked replacement pairs: {metrics.get('tracked_replacement_pairs', 0)}")
    lines.append("")

    lines.append("--- Fragment Analysis ---")
    lines.append(f"  Total fragments:         {metrics.get('fragment_count', 0)}")
    lines.append(f"  Normal fragments:        {metrics.get('normal_fragments', 0)}")
    lines.append(f"  Deleted fragments:       {metrics.get('deleted_fragments', 0)}")
    lines.append(f"  Inserted fragments:      {metrics.get('inserted_fragments', 0)}")
    lines.append("")

    lines.append("--- Placeholder Analysis ---")
    lines.append(f"  Placeholders found:      {metrics.get('placeholders_found', 0)}")
    lines.append(f"  In deleted text:         {metrics.get('placeholders_in_deleted', 0)}")
    lines.append(f"  In normal text:          {metrics.get('placeholders_in_normal', 0)}")
    lines.append("")

    lines.append("--- Mechanism Detection ---")
    lines.append(f"  Primary mechanism:       {metrics.get('primary_mechanism', 'unknown')}")
    lines.append(f"  Confidence:              {metrics.get('mechanism_confidence', 'unknown')}")
    lines.append(f"  Note:                    {metrics.get('mechanism_note', '')}")
    lines.append("")
    lines.append("=" * 60)

    return "\n".join(lines)


def generate_debug_json(metrics: dict) -> dict:
    """
    Generate the structured JSON debug block for diagnostic output.
    """
    return {
        "strike_runs": metrics.get("strike_runs", 0),
        "deleted_revisions": metrics.get("deleted_revisions", 0),
        "inserted_revisions": metrics.get("inserted_revisions", 0),
        "placeholders_found": metrics.get("placeholders_found", 0),
        "tracked_replacement_pairs": metrics.get("tracked_replacement_pairs", 0),
        "primary_mechanism": metrics.get("primary_mechanism", "unknown"),
        "placeholders_in_deleted": metrics.get("placeholders_in_deleted", 0),
    }