from parser.xml_models import ParsedDocument

from normalizer.node_models import CanonicalDocumentTree, DocumentNode, Location
from normalizer.run_reconstructor import reconstruct_paragraph_text


WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS = {"w": WORD_NS}


def build_canonical_tree(parsed_document: ParsedDocument) -> CanonicalDocumentTree:
    """
    Build a flat, ordered canonical paragraph tree from parsed Word XML parts.

    The flat node list is the contract consumed by downstream placeholder
    detection: document body first, then headers, then footers.
    """
    tree = CanonicalDocumentTree()
    node_counter = 0

    def next_node_id() -> str:
        nonlocal node_counter
        node_counter += 1
        return f"P_{node_counter:04d}"

    def add_paragraph_node(
        paragraph,
        section: str,
        paragraph_index: int,
        table_index: int | None = None,
        row_index: int | None = None,
        cell_index: int | None = None,
    ) -> None:
        table_path = None
        if table_index is not None and row_index is not None and cell_index is not None:
            table_path = f"T{table_index + 1}/R{row_index + 1}/C{cell_index + 1}"

        tree.nodes.append(
            DocumentNode(
                node_id=next_node_id(),
                node_type="paragraph",
                text=reconstruct_paragraph_text(paragraph),
                location=Location(
                    section=section,
                    paragraph_index=paragraph_index,
                    table_index=table_index,
                    row_index=row_index,
                    cell_index=cell_index,
                    table_path=table_path,
                    is_list_item=is_list_paragraph(paragraph),
                ),
            )
        )

    def process_table(table, section: str, table_index: int) -> None:
        for row_index, row in enumerate(table.xpath("./w:tr", namespaces=NS)):
            for cell_index, cell in enumerate(row.xpath("./w:tc", namespaces=NS)):
                for paragraph_index, paragraph in enumerate(cell.xpath("./w:p", namespaces=NS)):
                    add_paragraph_node(
                        paragraph=paragraph,
                        section=section,
                        paragraph_index=paragraph_index,
                        table_index=table_index,
                        row_index=row_index,
                        cell_index=cell_index,
                    )

    def process_section(container, section: str) -> None:
        paragraph_index = 0
        table_index = 0

        for child in container:
            local_name = child.tag.split("}")[-1]

            if local_name == "p":
                add_paragraph_node(
                    paragraph=child,
                    section=section,
                    paragraph_index=paragraph_index,
                )
                paragraph_index += 1
            elif local_name == "tbl":
                process_table(child, section, table_index)
                table_index += 1

    process_section(_section_container(parsed_document.document_xml.tree, "body"), "document")

    for index, header in enumerate(parsed_document.headers):
        process_section(_section_container(header.tree, "hdr"), f"header_{index}")

    for index, footer in enumerate(parsed_document.footers):
        process_section(_section_container(footer.tree, "ftr"), f"footer_{index}")

    return tree


def _section_container(root, local_name: str):
    matches = root.xpath(f".//w:{local_name}", namespaces=NS)
    return matches[0] if matches else root


def is_list_paragraph(paragraph) -> bool:
    return bool(paragraph.xpath("./w:pPr/w:numPr", namespaces=NS))
