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


import json

from app.placeholder_resolution_pipeline import (
    PlaceholderResolutionPipeline
)


def test_pipeline_generates_output_file(
    tmp_path
):

    inventory_file = (
        tmp_path
        / "inventory.json"
    )

    tree_file = (
        tmp_path
        / "tree.json"
    )

    output_file = (
        tmp_path
        / "placeholder_resolution.json"
    )

    inventory = [
        {
            "occurrence_id": "PH_0001",
            "placeholder": "<Drug Name>",
            "node_type": "paragraph",
            "section": "document",
            "paragraph_index": 0,
            "table_path": None,
            "neighbor_context": {
                "before": "",
                "after": "Boneitis"
            }
        }
    ]

    tree = {
        "id": "ROOT",
        "type": "document",
        "text": "",
        "children": [
            {
                "id": "P_0001",
                "type": "paragraph",
                "text": "ABC-123",
                "children": [],
                "rich_runs": [],
                "location": {
                    "section": "document",
                    "paragraph_index": 0,
                    "table_index": None,
                    "row_index": None,
                    "cell_index": None,
                    "table_path": None,
                    "header_index": None,
                    "footer_index": None
                },
                "context": {
                    "before_text": None,
                    "after_text": "Boneitis"
                },
                "metadata": {},
                "node_order": 1,
                "parent_id": None
            }
        ],
        "rich_runs": [],
        "location": None,
        "context": None,
        "metadata": {},
        "node_order": None,
        "parent_id": None
    }

    with open(
        inventory_file,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            inventory,
            file
        )

    with open(
        tree_file,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            tree,
            file
        )

    pipeline = (
        PlaceholderResolutionPipeline()
    )

    results = pipeline.run(
        inventory_path=str(
            inventory_file
        ),
        document_tree_path=str(
            tree_file
        ),
        output_path=str(
            output_file
        )
    )

    assert output_file.exists()

    assert len(results) == 1

    assert (
        results[0].resolution_status
        in (
            "RESOLVED",
            "UNRESOLVED"
        )
    )

    with open(
        output_file,
        "r",
        encoding="utf-8"
    ) as file:

        saved_results = json.load(
            file
        )

    assert len(
        saved_results
    ) == 1

    assert (
        saved_results[0][
            "occurrence_id"
        ]
        == "PH_0001"
    )