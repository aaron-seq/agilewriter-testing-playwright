WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS = {"w": WORD_NS}


def reconstruct_paragraph_text(paragraph_element) -> str:
    """
    Concatenate visible Word text runs into one logical paragraph string.

    Word often splits human-visible text across many w:r elements, so ST2 reads
    only w:t descendants in document order and strips only the final string.
    """
    text_chunks: list[str] = []

    for run in paragraph_element.xpath(".//w:r", namespaces=NS):
        for text_node in run.xpath(".//w:t", namespaces=NS):
            text_chunks.append(text_node.text or "")

    return "".join(text_chunks).strip()
