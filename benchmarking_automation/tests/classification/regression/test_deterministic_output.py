import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[3]

sys.path.insert(0, str(PROJECT_ROOT))

import json

from classification.classifier import (
    PlaceholderClassifier
)

INVENTORY = (
    PROJECT_ROOT
    / "tests"
    / "output"
    / "inventory.json"
)


def test_deterministic_output():

    with open(
        INVENTORY,
        "r",
        encoding="utf-8"
    ) as file:

        inventory = json.load(file)

    classifier = PlaceholderClassifier()

    result_1 = classifier.classify_inventory(
        inventory
    )

    result_2 = classifier.classify_inventory(
        inventory
    )

    assert result_1 == result_2
