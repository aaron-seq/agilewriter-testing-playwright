import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent

sys.path.insert(0, str(ROOT_DIR))

from classification.classifier import (
    PlaceholderClassifier
)


def test_contract_preservation():

    inventory = [
        {
            "occurrence_id": "PH_001",
            "placeholder": "<Table: AE>",
            "node_type": "paragraph",
            "table_path": None
        }
    ]

    classifier = PlaceholderClassifier()

    result = classifier.classify_inventory(
        inventory
    )

    item = result[0]

    assert "occurrence_id" in item
    assert "placeholder" in item
    assert "node_type" in item
    assert "table_path" in item

    assert "type" in item
    assert "classification_confidence" in item
