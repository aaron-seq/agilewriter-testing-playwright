import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent

sys.path.insert(0, str(ROOT_DIR))

import json

from classification.classifier import (
    PlaceholderClassifier
)


def test_deterministic_output():

    with open(
        "tests/output/inventory.json",
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
