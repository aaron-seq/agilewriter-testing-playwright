from pathlib import Path
from dataclasses import asdict
import json

from app.pipeline import PlaceholderPipeline
from app.classification_pipeline import (
    ClassificationPipeline
)

from app.placeholder_resolution_pipeline import (
    PlaceholderResolutionPipeline
)

from doc_parser.xml_parser import load_docx
from doc_parser.node_builder import (
    CanonicalDocumentBuilder
)

from replacement_extraction.extractor import (
    ReplacementExtractionEngine
)

from replacement_reporting.export_service import (
    ExportService
)


class DocumentReplacementPipeline:

    def run(
        self,
        template_docx,
        generated_docx,
        output_dir="final_outputs"
    ):

        output_dir = Path(output_dir)

        output_dir.mkdir(
            parents=True,
            exist_ok=True
        )

        #
        # Phase 1
        # Template Inventory
        #

        inventory = (
            PlaceholderPipeline()
            .run(template_docx)
        )

        #
        # Phase 2
        # Classification
        #

        classified_inventory = (
            ClassificationPipeline()
            .classify_inventory(
                inventory
            )
        )

        #
        # Phase 3
        # Generated Tree
        #

        generated_doc = load_docx(
            generated_docx
        )

        generated_tree = (
            CanonicalDocumentBuilder()
            .build(generated_doc)
        )

        #
        # Phase 4
        # Resolution
        #

        resolver = (
            PlaceholderResolutionPipeline()
        )

        resolution_results = (
            resolver.resolver.resolve(
                classified_inventory,
                generated_tree
            )
        )

        resolution_results = [
            asdict(result)
            for result in resolution_results
        ]

        resolution_results = [
            result.to_dict()
            if hasattr(
                result,
                "to_dict"
            )
            else result
            for result in resolution_results
        ]

        #
        # Phase 5
        # Extraction
        #

        extraction_engine = (
            ReplacementExtractionEngine(
                classified_inventory,
                resolution_results,
                generated_tree
            )
        )

        (
            replacement_inventory,
            fragment_store
        ) = extraction_engine.run()

        #
        # Phase 6
        # Export
        #

        ExportService().export(
            inventory=replacement_inventory,
            fragment_store=fragment_store,
            output_directory=str(output_dir)
        )

        return {
            "replacement_inventory":
                replacement_inventory,
            "fragment_store":
                fragment_store
        }