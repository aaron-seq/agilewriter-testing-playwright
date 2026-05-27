from classification.classifier import PlaceholderClassifier


def test_deterministic_execution():

    classifier = PlaceholderClassifier()

    occurrence = {
        "placeholder": "<Table: AE>"
    }

    result1 = classifier.classify_occurrence(occurrence)
    result2 = classifier.classify_occurrence(occurrence)

    assert result1 == result2
