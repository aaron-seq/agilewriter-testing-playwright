import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent

sys.path.insert(0, str(ROOT_DIR))

import pytest

from reporting.schema_validator import (
    validate_inventory_schema,
    SchemaValidationError
)


def test_invalid_type():

    inventory = [
        {
            "occurrence_id": "PH_001",
            "placeholder": "<X>",
            "type": "INVALID_TYPE",
            "classification_confidence": 1.0,
            "classification_reason": [],
            "matched_rule_ids": []
        }
    ]

    with pytest.raises(
        SchemaValidationError
    ):

        validate_inventory_schema(
            inventory
        )
