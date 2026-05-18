from models.nodes import DocumentNode
from doc_parser.hierarchy_builder import HierarchyBuilder

NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
}


class CanonicalDocumentBuilder:

    def __init__(self):
        self.builder = HierarchyBuilder()

    def process_container(
        self,
        container,
        root,
        section_name="document"
    ):

        paragraph_index = 0
        table_index = 0

        # ---------------------------------
        # Collect ALL direct paragraphs
        # ---------------------------------

        all_paragraphs = container.xpath(
            "./w:p",
            namespaces=NS
        )

        for child in container:

            tag = child.tag.split("}")[-1]

            # =========================
            # PARAGRAPHS
            # =========================

            if tag == "p":

                node = self.builder.build_paragraph_node(
                    paragraph=child,
                    paragraph_index=paragraph_index,
                    all_paragraphs=all_paragraphs,
                    section=section_name
                )

                root.add_child(node)

                paragraph_index += 1

            # =========================
            # TABLES
            # =========================

            elif tag == "tbl":

                node = self.builder.build_table_node(
                    table=child,
                    table_index=table_index,
                    section=section_name
                )

                root.add_child(node)

                table_index += 1

    def build(self, parsed_document):

        root = DocumentNode(
            id="ROOT",
            type="document"
        )

        # =====================================
        # MAIN DOCUMENT BODY
        # =====================================

        document_body = parsed_document.document_xml.tree.xpath(
            "//w:body",
            namespaces=NS
        )[0]

        self.process_container(
            container=document_body,
            root=root,
            section_name="document"
        )

        # =====================================
        # HEADERS
        # =====================================

        for idx, header_xml in enumerate(parsed_document.headers):

            header_body = header_xml.tree.xpath(
                "//w:hdr",
                namespaces=NS
            )[0]

            self.process_container(
                container=header_body,
                root=root,
                section_name=f"header_{idx}"
            )

        # =====================================
        # FOOTERS
        # =====================================

        for idx, footer_xml in enumerate(parsed_document.footers):

            footer_body = footer_xml.tree.xpath(
                "//w:ftr",
                namespaces=NS
            )[0]

            self.process_container(
                container=footer_body,
                root=root,
                section_name=f"footer_{idx}"
            )

        return root