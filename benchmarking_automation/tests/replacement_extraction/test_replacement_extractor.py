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



from replacement_extraction.extractor import (
    ReplacementExtractionEngine
)


def test_should_extract_keyvalue():

    classified_inventory = [
        {
            "occurrence_id": "PH_001",
            "placeholder": "<PATIENT_COUNT>",
            "type": "KEYVALUE"
        }
    ]

    placeholder_resolution = [
        {
            "occurrence_id": "PH_001",
            "generated_node_id": "P_001",
            "resolution_status": "RESOLVED",
            "matched_text": "245"
        }
    ]

    generated_tree = {
        "nodes": [
            {
                "node_id": "P_001",
                "text": "Patient Count: 245"
            }
        ]
    }

    engine = ReplacementExtractionEngine(
        classified_inventory,
        placeholder_resolution,
        generated_tree
    )

    inventory, fragments = engine.run()

    assert inventory[0]["replacement_found"] is True

    assert fragments[0]["content"]["content"] == "245"


def test_should_extract_table_cell():

    classified_inventory = [
        {
            "occurrence_id": "PH_001",
            "placeholder": "<Drug>",
            "type": "TABLE_CELL"
        }
    ]

    placeholder_resolution = [
        {
            "occurrence_id": "PH_001",
            "generated_node_id": "P_010",
            "resolution_status": "RESOLVED"
        }
    ]

    generated_tree = {
        "nodes": [
            {
                "node_id": "P_010",
                "text": "ABC-123"
            }
        ]
    }

    engine = ReplacementExtractionEngine(
        classified_inventory,
        placeholder_resolution,
        generated_tree
    )

    inventory, fragments = engine.run()

    assert inventory[0]["replacement_found"] is True

    assert fragments[0]["content"]["content"] == "ABC-123"


def test_should_extract_paragraph():

    classified_inventory = [
        {
            "occurrence_id": "PH_001",
            "placeholder": "<Study Title>",
            "type": "PARAGRAPH"
        }
    ]

    placeholder_resolution = [
        {
            "occurrence_id": "PH_001",
            "generated_node_id": "P_020",
            "resolution_status": "RESOLVED"
        }
    ]

    generated_tree = {
        "nodes": [
            {
                "node_id": "P_020",
                "text": (
                    "A First-In-Human Study of ABC-123"
                )
            }
        ]
    }

    engine = ReplacementExtractionEngine(
        classified_inventory,
        placeholder_resolution,
        generated_tree
    )

    inventory, fragments = engine.run()

    assert inventory[0]["replacement_found"] is True

    assert (
        fragments[0]["content"]["content"]
        == "A First-In-Human Study of ABC-123"
    )


def test_should_extract_list():

    classified_inventory = [
        {
            "occurrence_id": "PH_001",
            "placeholder": "<Inclusion Criteria>",
            "type": "LIST"
        }
    ]

    placeholder_resolution = [
        {
            "occurrence_id": "PH_001",
            "generated_node_id": "P_030",
            "resolution_status": "RESOLVED"
        }
    ]

    generated_tree = {
        "nodes": [
            {
                "node_id": "P_030",
                "items": [
                    "Age > 18",
                    "Healthy volunteer"
                ],
                "list_type": "bullet"
            }
        ]
    }

    engine = ReplacementExtractionEngine(
        classified_inventory,
        placeholder_resolution,
        generated_tree
    )

    inventory, fragments = engine.run()

    assert len(
        fragments[0]["content"]["items"]
    ) == 2


def test_should_extract_table():

    classified_inventory = [
        {
            "occurrence_id": "PH_001",
            "placeholder": "<Demographics Table>",
            "type": "TABLE"
        }
    ]

    placeholder_resolution = [
        {
            "occurrence_id": "PH_001",
            "generated_node_id": "T_001",
            "resolution_status": "RESOLVED"
        }
    ]

    generated_tree = {
        "nodes": [
            {
                "node_id": "T_001",
                "rows": [
                    ["Age", "35"],
                    ["Sex", "Male"]
                ]
            }
        ]
    }

    engine = ReplacementExtractionEngine(
        classified_inventory,
        placeholder_resolution,
        generated_tree
    )

    inventory, fragments = engine.run()

    assert len(
        fragments[0]["content"]["rows"]
    ) == 2


def test_should_extract_figure():

    classified_inventory = [
        {
            "occurrence_id": "PH_001",
            "placeholder": "<Figure X>",
            "type": "FIGURE"
        }
    ]

    placeholder_resolution = [
        {
            "occurrence_id": "PH_001",
            "generated_node_id": "FIG_001",
            "resolution_status": "RESOLVED"
        }
    ]

    generated_tree = {
        "nodes": [
            {
                "node_id": "FIG_001",
                "caption": "Study Design",
                "image_ref": "image1.png"
            }
        ]
    }

    engine = ReplacementExtractionEngine(
        classified_inventory,
        placeholder_resolution,
        generated_tree
    )

    inventory, fragments = engine.run()

    assert (
        fragments[0]["content"]["caption"]
        == "Study Design"
    )


def test_should_extract_inline_replacement():

    classified_inventory = [
        {
            "occurrence_id": "PH_001",
            "placeholder": "<Sponsor>",
            "type": "KEYVALUE"
        }
    ]

    placeholder_resolution = [
        {
            "occurrence_id": "PH_001",
            "generated_node_id": "P_001",
            "resolution_status": "RESOLVED",
            "matched_text": "Pfizer"
        }
    ]

    generated_tree = {
        "nodes": [
            {
                "node_id": "P_001",
                "text": (
                    "The sponsor is Pfizer."
                )
            }
        ]
    }

    engine = ReplacementExtractionEngine(
        classified_inventory,
        placeholder_resolution,
        generated_tree
    )

    inventory, fragments = engine.run()

    assert (
        fragments[0]["content"]["content"]
        == "Pfizer"
    )


def test_should_return_unresolved_when_resolution_failed():

    classified_inventory = [
        {
            "occurrence_id": "PH_001",
            "placeholder": "<Drug>",
            "type": "KEYVALUE"
        }
    ]

    placeholder_resolution = [
        {
            "occurrence_id": "PH_001",
            "generated_node_id": None,
            "resolution_status": "UNRESOLVED"
        }
    ]

    generated_tree = {
        "nodes": []
    }

    engine = ReplacementExtractionEngine(
        classified_inventory,
        placeholder_resolution,
        generated_tree
    )

    inventory, fragments = engine.run()

    assert inventory[0]["status"] == "UNRESOLVED"

    assert inventory[0]["replacement_found"] is False

    assert len(fragments) == 0


def test_should_preserve_formatting_runs():

    classified_inventory = [
        {
            "occurrence_id": "PH_001",
            "placeholder": "<Study Title>",
            "type": "PARAGRAPH"
        }
    ]

    placeholder_resolution = [
        {
            "occurrence_id": "PH_001",
            "generated_node_id": "P_001",
            "resolution_status": "RESOLVED"
        }
    ]

    generated_tree = {
        "nodes": [
            {
                "node_id": "P_001",
                "text": "ABC-123",
                "runs": [
                    {
                        "text": "ABC",
                        "bold": True
                    },
                    {
                        "text": "-123",
                        "bold": False
                    }
                ]
            }
        ]
    }

    engine = ReplacementExtractionEngine(
        classified_inventory,
        placeholder_resolution,
        generated_tree
    )

    inventory, fragments = engine.run()

    formatting = fragments[0]["content"]["formatting"]

    assert len(formatting) == 2

    assert formatting[0]["bold"] is True


def test_should_extract_from_resolved_node():

    classified_inventory = [
        {
            "occurrence_id": "PH_001",
            "placeholder": "<Drug>",
            "type": "TABLE_CELL"
        }
    ]

    placeholder_resolution = [
        {
            "occurrence_id": "PH_001",
            "generated_node_id": "P_100",
            "resolution_status": "RESOLVED"
        }
    ]

    generated_tree = {
        "nodes": [
            {
                "node_id": "P_100",
                "text": "ABC-123"
            }
        ]
    }

    engine = ReplacementExtractionEngine(
        classified_inventory,
        placeholder_resolution,
        generated_tree
    )

    inventory, fragments = engine.run()

    assert (
        inventory[0]["generated_node_id"]
        == "P_100"
    )

    assert (
        fragments[0]["content"]["content"]
        == "ABC-123"
    )


def test_should_extract_removed_placeholder_via_resolution():

    classified_inventory = [
        {
            "occurrence_id": "PH_001",
            "placeholder": "<Study Title>",
            "type": "PARAGRAPH"
        }
    ]

    placeholder_resolution = [
        {
            "occurrence_id": "PH_001",
            "generated_node_id": "P_200",
            "resolution_status": "RESOLVED"
        }
    ]

    generated_tree = {
        "nodes": [
            {
                "node_id": "P_200",
                "text": (
                    "A Phase I Study of ABC-123"
                )
            }
        ]
    }

    engine = ReplacementExtractionEngine(
        classified_inventory,
        placeholder_resolution,
        generated_tree
    )

    inventory, fragments = engine.run()

    assert inventory[0]["status"] == "RESOLVED"

    assert inventory[0]["replacement_found"] is True


def test_should_return_unresolved_when_resolved_node_missing():

    classified_inventory = [
        {
            "occurrence_id": "PH_001",
            "placeholder": "<Study Title>",
            "type": "PARAGRAPH"
        }
    ]

    placeholder_resolution = [
        {
            "occurrence_id": "PH_001",
            "generated_node_id": "P_999",
            "resolution_status": "RESOLVED"
        }
    ]

    generated_tree = {
        "nodes": []
    }

    engine = ReplacementExtractionEngine(
        classified_inventory,
        placeholder_resolution,
        generated_tree
    )

    inventory, fragments = engine.run()

    assert inventory[0]["replacement_found"] is False

    assert inventory[0]["status"] == "UNRESOLVED"

    assert len(fragments) == 0

def test_should_extract_empty_paragraph_content():

    classified_inventory = [
        {
            "occurrence_id": "PH_001",
            "placeholder": "<Study Title>",
            "type": "PARAGRAPH"
        }
    ]

    placeholder_resolution = [
        {
            "occurrence_id": "PH_001",
            "generated_node_id": "P_001",
            "resolution_status": "RESOLVED"
        }
    ]

    generated_tree = {
        "nodes": [
            {
                "node_id": "P_001",
                "text": ""
            }
        ]
    }

    engine = ReplacementExtractionEngine(
        classified_inventory,
        placeholder_resolution,
        generated_tree
    )

    inventory, fragments = engine.run()

    assert inventory[0]["replacement_found"] is True

    assert (
        fragments[0]["content"]["content"]
        == ""
    )


def test_should_extract_figure_without_caption():

    classified_inventory = [
        {
            "occurrence_id": "PH_001",
            "placeholder": "<Figure>",
            "type": "FIGURE"
        }
    ]

    placeholder_resolution = [
        {
            "occurrence_id": "PH_001",
            "generated_node_id": "FIG_001",
            "resolution_status": "RESOLVED"
        }
    ]

    generated_tree = {
        "nodes": [
            {
                "node_id": "FIG_001",
                "image_ref": "image.png"
            }
        ]
    }

    engine = ReplacementExtractionEngine(
        classified_inventory,
        placeholder_resolution,
        generated_tree
    )

    inventory, fragments = engine.run()

    assert inventory[0]["replacement_found"] is True 

    assert (
        fragments[0]["content"]["image_ref"]
        == "image.png"
    )