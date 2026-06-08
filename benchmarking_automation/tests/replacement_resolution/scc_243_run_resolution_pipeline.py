import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

sys.path.insert(0, str(PROJECT_ROOT))

from app.placeholder_resolution_pipeline import (
    PlaceholderResolutionPipeline
)

pipeline = (
    PlaceholderResolutionPipeline()
)

pipeline.run(
    inventory_path=(
        "output/classified_inventory.json"
    ),
    document_tree_path=(
        "tests/output/generated_document_tree.json"
    ),
    output_path=(
        "output/placeholder_resolution.json"
    )
)

print(
    "placeholder_resolution.json generated"
)