from classification.classifier import PlaceholderClassifier


classifier = PlaceholderClassifier()


def test_table_classification():

    result = classifier.classify_occurrence({
        "placeholder": "<Table: AE>"
    })

    assert result["type"] == "table"


def test_insert_table_classification():

    result = classifier.classify_occurrence({
        "placeholder": "<Insert Table: AE>"
    })

    assert result["type"] == "table"


def test_extract_tables_classification():

    result = classifier.classify_occurrence({
        "placeholder": "<Extract Tables>"
    })

    assert result["type"] == "tables"


def test_list_classification():

    result = classifier.classify_occurrence({
        "placeholder": "<number list: Criteria>"
    })

    assert result["type"] == "list"


def test_figure_classification():

    result = classifier.classify_occurrence({
        "placeholder": "<Insert Figure>"
    })

    assert result["type"] == "figure"


def test_unknown_classification():

    result = classifier.classify_occurrence({
        "placeholder": "<XYZ_Unknown>"
    })

    assert result["type"] == "unknown"
