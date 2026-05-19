import json
from pathlib import Path

import pytest

from app.pipeline import PlaceholderPipeline
from app.pipeline import PipelineError


# =========================================================
# Helpers
# =========================================================

PROJECT_ROOT = Path(__file__).resolve().parent.parent

TEST_DOCX = (
    PROJECT_ROOT
    / "tests/basic_sample_template.docx"
)

OUTPUT_DIR = (
    PROJECT_ROOT
    / "tests/output"
)


def load_json(path: Path):

    return json.loads(
        path.read_text(encoding="utf-8")
    )


# =========================================================
# ST4-TC01
# JSON inventory generated
# =========================================================

def test_json_inventory_generated():

    pipeline = PlaceholderPipeline()

    output_path = (
        OUTPUT_DIR
        / "inventory_tc01.json"
    )

    inventory = pipeline.run(
        input_docx=str(TEST_DOCX),
        output_json=str(output_path)
    )

    assert output_path.exists()

    json_data = load_json(output_path)

    assert isinstance(json_data, list)

    assert len(json_data) > 0


# =========================================================
# ST4-TC02
# Empty document returns empty array
# =========================================================

def test_empty_document_returns_empty_array():

    pipeline = PlaceholderPipeline()

    empty_doc = (
        PROJECT_ROOT
        / "tests/empty_template.docx"
    )

    inventory = pipeline.run(
        input_docx=str(empty_doc)
    )

    assert inventory == []


# =========================================================
# ST4-TC03
# Unsupported structures ignored safely
# =========================================================

def test_unsupported_structures_ignored_safely():

    pipeline = PlaceholderPipeline()

    unsupported_doc = (
        PROJECT_ROOT
        / "tests/unsupported_content.docx"
    )

    inventory = pipeline.run(
        input_docx=str(unsupported_doc)
    )

    # Pipeline should not crash
    assert isinstance(inventory, list)


# =========================================================
# ST4-TC04
# Pipeline integration succeeds
# =========================================================

def test_pipeline_integration_succeeds():

    pipeline = PlaceholderPipeline()

    inventory = pipeline.run(
        input_docx=str(TEST_DOCX)
    )

    assert isinstance(inventory, list)

    assert len(inventory) > 0


# =========================================================
# ST4-TC05
# Full document processing works
# =========================================================

def test_full_document_processing_works():

    pipeline = PlaceholderPipeline()

    inventory = pipeline.run(
        input_docx=str(TEST_DOCX)
    )

    required_fields = [
        "occurrence_id",
        "placeholder",
        "node_id",
        "node_type",
        "section",
        "paragraph_index",
        "matched_text_span",
        "inline_context",
        "neighbor_context",
    ]

    for item in inventory:

        for field in required_fields:

            assert field in item


# =========================================================
# ST4-TC06
# Output schema validation passes
# =========================================================

def test_output_schema_validation_passes():

    pipeline = PlaceholderPipeline()

    inventory = pipeline.run(
        input_docx=str(TEST_DOCX)
    )

    for item in inventory:

        assert isinstance(
            item["occurrence_id"],
            str
        )

        assert item["placeholder"].startswith("<")

        assert item["placeholder"].endswith(">")

        assert isinstance(
            item["matched_text_span"],
            dict
        )

        assert "start" in item["matched_text_span"]

        assert "end" in item["matched_text_span"]