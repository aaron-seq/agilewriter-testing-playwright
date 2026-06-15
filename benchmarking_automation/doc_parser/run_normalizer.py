from models.nodes import RichTextRun, RevisionFragment, TrackedReplacementPair
from doc_parser.revision_parser import parse_paragraph_revisions

NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
}


def extract_run_text(run):
    texts = run.xpath(".//w:t", namespaces=NS)

    return "".join(
        t.text for t in texts if t.text
    )


def extract_field_code_text(paragraph):
    """
    Extract text from field codes (w:fldCode / w:instrText) which are commonly
    used in DOCX templates -- e.g. { MACROBUTTON  <Firstname Lastname> }
    These appear as w:fldChar/w:instrText elements.
    Returns the raw field instruction text if found.
    """
    instr_texts = paragraph.xpath(".//w:instrText", namespaces=NS)
    fld_code_texts = paragraph.xpath(".//w:fldCode/w:t", namespaces=NS)

    parts = []
    for node in instr_texts + fld_code_texts:
        if node.text:
            parts.append(node.text)

    return " ".join(parts) if parts else None


def extract_deleted_text(paragraph):
    """
    Extract text from w:delText elements (tracked deletions).
    Sometimes the placeholder text remains as deleted text in the generated doc.
    NOTE: This function is maintained for backward compatibility.
    The newer revision_parser module provides richer revision data.
    """
    del_text_nodes = paragraph.xpath(".//w:delText", namespaces=NS)
    parts = [t.text for t in del_text_nodes if t.text]
    return "".join(parts) if parts else None


def get_boolean_run_property(run, xpath_expr):

    nodes = run.xpath(xpath_expr, namespaces=NS)

    if not nodes:
        return False

    node = nodes[0]

    value = node.get(
        "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val"
    )

    if value is None:
        return True

    return value.lower() not in (
        "false",
        "0",
        "off"
    )


def get_font_name(run):

    fonts = run.xpath(
        "./w:rPr/w:rFonts",
        namespaces=NS
    )

    if not fonts:
        return None

    return (
    fonts[0].get(
        "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}ascii"
    )
    or fonts[0].get(
        "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}hAnsi"
    )
    or fonts[0].get(
        "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}eastAsia"
    )
    or fonts[0].get(
        "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}cs"
    )
)


def get_font_size(run):

    size_nodes = run.xpath(
        "./w:rPr/w:sz",
        namespaces=NS
    )

    if not size_nodes:
        return None

    value = size_nodes[0].get(
        "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val"
    )

    if value is None:
        return None

    try:
        return int(value)
    except ValueError:
        return None


def get_color(run):

    color_nodes = run.xpath(
        "./w:rPr/w:color",
        namespaces=NS
    )

    if not color_nodes:
        return None

    return color_nodes[0].get(
        "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val"
    )


def get_highlight(run):

    highlight_nodes = run.xpath(
        "./w:rPr/w:highlight",
        namespaces=NS
    )

    if not highlight_nodes:
        return None

    return highlight_nodes[0].get(
        "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val"
    )


def build_rich_run(run):

    text = extract_run_text(run)

    return RichTextRun(
        text=text,

        bold=get_boolean_run_property(
            run,
            "./w:rPr/w:b"
        ),

        italic=get_boolean_run_property(
            run,
            "./w:rPr/w:i"
        ),

        underline=get_boolean_run_property(
            run,
            "./w:rPr/w:u"
        ),

        strike=get_boolean_run_property(
            run,
            "./w:rPr/w:strike"
        ),

        font_name=get_font_name(run),

        font_size=get_font_size(run),

        color=get_color(run),

        highlight=get_highlight(run)
    )


def normalize_runs(paragraph):
    """
    Merge fragmented Word runs into logical text.
    Handles field codes, revision markup, tab/break characters.
    
    CRITICAL DESIGN:
    - "text" is the VISIBLE text (normal + inserted runs, EXCLUDING deleted).
      This is what the user sees and what resolution/extraction should match against.
    - "combined_text" is ALL text INCLUDING deleted revisions.
      This is ONLY used for placeholder detection (so placeholders in w:del are found).
    
    Returns:
    {
        "text": str,  # VISIBLE text (normal + inserted, no deleted)
        "combined_text": str,  # ALL text including deleted (for placeholder detection)
        "rich_runs": [RichTextRun, ...],
        "revision_fragments": [RevisionFragment, ...],
        "tracked_replacement_pairs": [TrackedReplacementPair, ...]
    }
    """

    # First check for field codes (w:instrText) which may contain the placeholder
    field_text = extract_field_code_text(paragraph)
    if field_text:
        pass

    # =========================================================
    # Parse revision elements (Track Changes)
    # This handles w:del, w:ins, w:moveFrom, w:moveTo
    # =========================================================
    revision_data = parse_paragraph_revisions(paragraph)

    # =========================================================
    # Extract regular runs for formatting info
    # =========================================================
    runs = paragraph.xpath(".//w:r", namespaces=NS)

    rich_runs = []

    merged_text = []

    for run in runs:
        text = extract_run_text(run)

        if not text:
            continue

        rich_run = build_rich_run(run)

        rich_runs.append(rich_run)

        merged_text.append(text)

    #: Use visible_text as the primary "text" field
    #: This ensures resolution matching sees clean text like
    #: "Patient Name: John Doe" instead of
    #: "Patient Name: <Patient_Name>John Doe"
    visible_text = revision_data.get("visible_text", "")

    # Fall back to regular merged text if no revision data
    primary_text = visible_text or "".join(merged_text)

    #: combined_text INCLUDES deleted text so placeholders
    #: inside w:del elements are still detected by the
    #: placeholder extraction phase
    combined_text = revision_data.get("combined_text", "") or primary_text

    return {
        "text": primary_text,
        "combined_text": combined_text,
        "rich_runs": rich_runs,
        "revision_fragments": revision_data["fragments"],
        "tracked_replacement_pairs": revision_data["paired_replacements"],
    }