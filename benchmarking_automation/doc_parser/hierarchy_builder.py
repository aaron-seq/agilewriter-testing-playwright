# parser/hierarchy_builder.py

from models.nodes import DocumentNode, Location
from doc_parser.run_normalizer import normalize_runs
from doc_parser.xml_parser import is_list_paragraph
from models.nodes import (
    DocumentNode,
    Location,
    ContextWindow
)

NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
}

class HierarchyBuilder:

    def __init__(self):
        self.node_counter = 0

    def next_id(self, prefix):
        self.node_counter += 1
        return f"{prefix}_{self.node_counter:04d}"

    def build_paragraph_node(
        self,
        paragraph,
        paragraph_index,
        all_paragraphs,
        section="document",
        table_index=None,
        row_index=None,
        cell_index=None
    ):

        normalized = normalize_runs(paragraph)

        node_type = (
            "list_item"
            if is_list_paragraph(paragraph)
            else "paragraph"
        )
        context_data = build_context_window(
            all_paragraphs,
            paragraph_index
        )
        return DocumentNode(
            id=self.next_id("P"),
            type=node_type,
            text=normalized["text"],
            formatting={
                "runs": normalized["formatting_blocks"]
            },
            location=Location(
                section=section,
                paragraph_index=paragraph_index,
                table_index=table_index,
                row_index=row_index,
                cell_index=cell_index
            ),
            context=ContextWindow(
                before_text=context_data["before_text"],
                after_text=context_data["after_text"]
            ),
        )

    def build_table_node(
        self,
        table,
        table_index,
        section="document"
    ):

        table_node = DocumentNode(
            id=self.next_id("T"),
            type="table",
            location=Location(
                section=section,
                table_index=table_index
            )
        )

        rows = table.xpath("./w:tr", namespaces=NS)

        for row_idx, row in enumerate(rows):

            row_node = DocumentNode(
                id=self.next_id("R"),
                type="row",
                location=Location(
                    section=section,
                    table_index=table_index,
                    row_index=row_idx
                )
            )

            cells = row.xpath("./w:tc", namespaces=NS)

            for cell_idx, cell in enumerate(cells):

                cell_node = DocumentNode(
                    id=self.next_id("C"),
                    type="cell",
                    location=Location(
                        section=section,
                        table_index=table_index,
                        row_index=row_idx,
                        cell_index=cell_idx
                    )
                )

                paragraphs = cell.xpath("./w:p", namespaces=NS)

                for p_idx, paragraph in enumerate(paragraphs):

                    p_node = self.build_paragraph_node(
                        paragraph=paragraph,
                        paragraph_index=p_idx,
                        all_paragraphs=paragraphs,
                        section=section,
                        table_index=table_index,
                        row_index=row_idx,
                        cell_index=cell_idx
                    )

                    cell_node.add_child(p_node)

                row_node.add_child(cell_node)

            table_node.add_child(row_node)

        return table_node


# Helper Function 
def build_context_window(
    paragraphs,
    current_index
):

    before_text = None
    after_text = None

    if current_index > 0:

        before_text = normalize_runs(
            paragraphs[current_index - 1]
        )["text"]

    if current_index < len(paragraphs) - 1:

        after_text = normalize_runs(
            paragraphs[current_index + 1]
        )["text"]

    return {
        "before_text": before_text,
        "after_text": after_text
    }