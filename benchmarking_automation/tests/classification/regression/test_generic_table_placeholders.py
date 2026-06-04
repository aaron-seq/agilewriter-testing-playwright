import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent

sys.path.insert(0, str(ROOT_DIR))

import json
import pytest

from classification.classifier import (
    PlaceholderClassifier
)

@pytest.mark.parametrize(
    "placeholder",
    [
        "<Table X>",
        "<Table A>",
        "<Table 1>",
    ]
)
def test_generic_table_placeholders(placeholder):

    classifier = PlaceholderClassifier()

    result = classifier.classify_occurrence({
        "placeholder": placeholder,
        "table_path": None,
        "inline_context": {
            "before": "",
            "after": ""
        }
    })

    assert result["type"] == "table"