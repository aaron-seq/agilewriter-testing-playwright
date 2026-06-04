from models.nodes import RichTextRun

NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
}


def extract_run_text(run):
    texts = run.xpath(".//w:t", namespaces=NS)

    return "".join(
        t.text for t in texts if t.text
    )

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
    """

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


    return {
        "text": "".join(merged_text),
        "rich_runs": rich_runs
    }