# reporting/inventory_builder.py
from doc_parser.xml_parser import load_docx
from doc_parser.node_builder import CanonicalDocumentBuilder
from placeholders.extractor import PlaceholderExtractor


class InventoryBuilder:
    """
    Orchestrates full placeholder extraction flow.
    """

    def __init__(self):
        self.node_builder = CanonicalDocumentBuilder()
        self.extractor = PlaceholderExtractor()

    def build_inventory(self, docx_path: str):

        # -----------------------------------------
        # STEP 1: Parse DOCX XML
        # -----------------------------------------

        parsed_document = load_docx(docx_path)

        # -----------------------------------------
        # STEP 2: Build Canonical Tree
        # -----------------------------------------

        canonical_tree = self.node_builder.build(
            parsed_document
        )

        # -----------------------------------------
        # STEP 3: Extract Placeholders
        # -----------------------------------------

        inventory = self.extractor.extract(
            canonical_tree
        )

        return inventory