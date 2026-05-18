from lxml import etree

NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
}


def extract_run_text(run):
    texts = run.xpath(".//w:t", namespaces=NS)

    return "".join(
        t.text for t in texts if t.text
    )


def normalize_runs(paragraph):
    """
    Merge fragmented Word runs into logical text.
    """

    runs = paragraph.xpath("./w:r", namespaces=NS)

    merged_text = []

    formatting_blocks = []

    for run in runs:
        text = extract_run_text(run)

        if not text:
            continue

        merged_text.append(text)

        formatting_blocks.append({
            "text": text,
            "raw_run": run
        })

    final_text = "".join(merged_text)

    return {
        "text": final_text,
        "formatting_blocks": formatting_blocks
    }