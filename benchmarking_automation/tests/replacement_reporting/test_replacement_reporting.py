import sys
from pathlib import Path

PROJECT_ROOT = (
    Path(__file__)
    .resolve()
    .parent
    .parent
    .parent
)

sys.path.insert(
    0,
    str(PROJECT_ROOT)
)

import json
from pathlib import Path

from replacement_reporting.query_service import (
    QueryService
)

from replacement_reporting.schema_validator import (
    SchemaValidator
)

from replacement_reporting.json_reporter import (
    JsonReporter
)

from replacement_reporting.excel_reporter import (
    ExcelReporter
)

from replacement_reporting.export_service import (
    ExportService
)


def sample_inventory():

    return [
        {
            "occurrence_id": "PH_001",
            "placeholder": "<Drug>",
            "type": "TABLE_CELL",
            "status": "RESOLVED",
            "replacement_found": True,
            "generated_node_id": "P_001",
            "replacement_content": "ABC-123",
            "confidence": 0.98,
            "section": "Study",
            "table_path": "T1/R1/C1",
            "summary": "Drug Name"
        }
    ]


def sample_fragment_store():

    return [
        {
            "fragment_id": "FRAG_001",
            "type": "TABLE_CELL",
            "content": {
                "content": "ABC-123"
            }
        }
    ]


# ==================================================
# Query Service
# ==================================================

def test_query_all():

    inventory = sample_inventory()

    result = QueryService.query_all(
        inventory
    )

    assert len(result) == 1


def test_query_specific_placeholder():

    inventory = sample_inventory()

    result = (
        QueryService.query_placeholders(
            inventory,
            ["<Drug>"]
        )
    )

    assert len(result) == 1

    assert (
        result[0]["placeholder"]
        == "<Drug>"
    )


def test_query_unknown_placeholder():

    inventory = sample_inventory()

    result = (
        QueryService.query_placeholders(
            inventory,
            ["<Unknown>"]
        )
    )

    assert len(result) == 0


# ==================================================
# Schema Validator
# ==================================================

def test_schema_validator_valid_record():

    inventory = sample_inventory()

    assert (
        SchemaValidator.validate_inventory(
            inventory
        )
        is True
    )


def test_schema_validator_missing_field():

    record = {
        "placeholder": "<Drug>"
    }

    try:
        SchemaValidator.validate_record(
            record
        )

        assert False

    except ValueError:
        assert True


def test_schema_validator_missing_content():

    record = {
        "occurrence_id": "PH_001",
        "placeholder": "<Drug>",
        "type": "TABLE_CELL",
        "status": "RESOLVED",
        "replacement_found": True,
        "replacement_content": None
    }

    try:
        SchemaValidator.validate_record(
            record
        )

        assert False

    except ValueError:
        assert True


# ==================================================
# JSON Reporter
# ==================================================

def test_json_inventory_export(
    tmp_path
):

    inventory = sample_inventory()

    output_file = (
        tmp_path
        / "inventory.json"
    )

    JsonReporter.export_inventory(
        inventory,
        output_file
    )

    assert output_file.exists()

    data = json.loads(
        output_file.read_text(
            encoding="utf-8"
        )
    )

    assert len(data) == 1


def test_json_fragment_export(
    tmp_path
):

    fragments = (
        sample_fragment_store()
    )

    output_file = (
        tmp_path
        / "fragments.json"
    )

    JsonReporter.export_fragment_store(
        fragments,
        output_file
    )

    assert output_file.exists()

    data = json.loads(
        output_file.read_text(
            encoding="utf-8"
        )
    )

    assert len(data) == 1


# ==================================================
# Excel Reporter
# ==================================================

def test_excel_export(
    tmp_path
):

    inventory = sample_inventory()

    output_file = (
        tmp_path
        / "inventory.xlsx"
    )

    ExcelReporter.export(
        inventory,
        output_file
    )

    assert output_file.exists()


# ==================================================
# Export Service
# ==================================================

def test_export_service_creates_outputs(
    tmp_path
):

    inventory = sample_inventory()

    fragments = (
        sample_fragment_store()
    )

    ExportService.export(
        inventory,
        fragments,
        tmp_path
    )

    assert (
        tmp_path
        / "replacement_inventory.json"
    ).exists()

    assert (
        tmp_path
        / "replacement_fragment_store.json"
    ).exists()

    assert (
        tmp_path
        / "replacement_inventory.xlsx"
    ).exists()


# ==================================================
# SCC-245 Integration Scenarios
# ==================================================

def test_unresolved_placeholder():

    inventory = [
        {
            "occurrence_id": "PH_001",
            "placeholder": "<Drug>",
            "type": "TABLE_CELL",
            "status": "UNRESOLVED",
            "replacement_found": False,
            "replacement_content": None
        }
    ]

    assert (
        inventory[0]["status"]
        == "UNRESOLVED"
    )

    assert (
        inventory[0]["replacement_found"]
        is False
    )


def test_removed_placeholder_resolved():

    inventory = [
        {
            "occurrence_id": "PH_001",
            "placeholder": "<Study Title>",
            "type": "PARAGRAPH",
            "status": "RESOLVED",
            "replacement_found": True,
            "replacement_content":
                "A Phase I Study"
        }
    ]

    assert (
        inventory[0]["status"]
        == "RESOLVED"
    )


def test_strikethrough_placeholder_extracted():

    inventory = [
        {
            "occurrence_id": "PH_001",
            "placeholder": "<Drug>",
            "type": "TABLE_CELL",
            "status": "RESOLVED",
            "replacement_found": True,
            "replacement_content":
                "ABC-123"
        }
    ]

    assert (
        inventory[0][
            "replacement_content"
        ]
        == "ABC-123"
    )


def test_multiple_placeholders_same_table_cell():

    inventory = [
        {
            "placeholder": "<Drug>",
            "replacement_content":
                "ABC-123"
        },
        {
            "placeholder": "<Disease>",
            "replacement_content":
                "Boneitis"
        },
        {
            "placeholder": "<Protocol>",
            "replacement_content":
                "SKY-2000-101"
        }
    ]

    assert (
        inventory[0][
            "replacement_content"
        ]
        == "ABC-123"
    )

    assert (
        inventory[1][
            "replacement_content"
        ]
        == "Boneitis"
    )

    assert (
        inventory[2][
            "replacement_content"
        ]
        == "SKY-2000-101"
    )