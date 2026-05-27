import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent

sys.path.insert(0, str(ROOT_DIR))

from classification.classifier import (
    PlaceholderClassifier
)


def test_empty_inventory():

    classifier = PlaceholderClassifier()

    result = classifier.classify_inventory([])

    assert result == []
