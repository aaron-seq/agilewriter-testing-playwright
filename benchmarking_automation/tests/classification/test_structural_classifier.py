from classification.structural.structural_classifier import StructuralClassifier
from classification.models.placeholder_type import PlaceholderType


classifier = StructuralClassifier()


def test_table_cell_classification():

    item = {
        "placeholder": "<Doctor_Name>",
        "table_path": "T1/R2/C2"
    }

    result = classifier.classify(item)

    assert result.type == PlaceholderType.TABLE_CELL


def test_keyvalue_classification():

    item = {
        "placeholder": "<Patient_Name>",
        "inline_context": {
            "before": "Patient Name:",
            "after": ""
        }
    }

    result = classifier.classify(item)

    assert result.type == PlaceholderType.KEYVALUE


def test_paragraph_classification():

    item = {
        "placeholder": "<Diagnosis>",
        "node_type": "paragraph",
        "table_path": None,
        "inline_context": {
            "before": "",
            "after": ""
        }
    }

    result = classifier.classify(item)

    assert result.type == PlaceholderType.PARAGRAPH


def test_unknown_fallback():

    item = {
        "placeholder": "<XYZ_UNKNOWN>"
    }

    result = classifier.classify(item)

    assert result.type == PlaceholderType.UNKNOWN
