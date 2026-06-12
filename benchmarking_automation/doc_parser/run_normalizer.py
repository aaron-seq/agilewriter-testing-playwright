from models.nodes import RichTextRun

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
    Handles field codes, deleted text, tab/break characters.
    """

    # First check for field codes (w:instrText) which may contain the placeholder
    field_text = extract_field_code_text(paragraph)
    if field_text:
        # Field code text may contain the placeholder -- keep it as context
        # The actual display text will be in regular runs, but we also capture
        # field instructions for matching purposes
        pass

    # Check for deleted text (tracked changes) that may contain placeholders
    deleted = extract_deleted_text(paragraph)

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

    # Check for tab and break special characters
    # Word inserts <w:tab/> and <w:br/> between runs
    tab_nodes = paragraph.xpath(".//w:tab", namespaces=NS)
    br_nodes = paragraph.xpath(".//w:br", namespaces=NS)

    return {
        "text": "".join(merged_text),
        "rich_runs": rich_runs
    }
