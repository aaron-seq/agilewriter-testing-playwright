from .resolved_node_extractor import ResolvedNodeExtractor
from .fragment_builder import FragmentBuilder

from .extractors.keyvalue import KeyValueExtractor
from .extractors.table_cell import TableCellExtractor
from .extractors.paragraph import ParagraphExtractor
from .extractors.list import ListExtractor
from .extractors.table import TableExtractor
from .extractors.figure import FigureExtractor


EXTRACTORS = {
    "KEYVALUE": KeyValueExtractor(),
    "TABLE_CELL": TableCellExtractor(),
    "PARAGRAPH": ParagraphExtractor(),
    "LIST": ListExtractor(),
    "TABLE": TableExtractor(),
    "FIGURE": FigureExtractor(),
}


class ReplacementExtractionEngine:

    def __init__(
        self,
        classified_inventory,
        placeholder_resolution,
        generated_tree,
    ):
        self.classified_inventory = classified_inventory
        self.placeholder_resolution = placeholder_resolution
        self.node_extractor = ResolvedNodeExtractor(
            generated_tree
        )

    def run(self):

        inventory = []
        fragment_store = []

        classification_map = {
            x["occurrence_id"]: x
            for x in self.classified_inventory
        }

        for resolution in self.placeholder_resolution:

            occurrence_id = resolution["occurrence_id"]

            classification = classification_map.get(
                occurrence_id
            )

            placeholder_type = (
                classification["type"]
                .upper()
            )

            if resolution["resolution_status"] != "RESOLVED":
                inventory.append({
                    "occurrence_id": occurrence_id,
                    "placeholder": classification["placeholder"],
                    "type": placeholder_type,
                    "generated_node_id": resolution.get(
                        "generated_node_id"
                    ),
                    "replacement_found": False,
                    "status": "UNRESOLVED",
                    "fragment_id": None,
                    "confidence": resolution.get(
                        "match_confidence"
                    )
                })

                continue

            node = self.node_extractor.get_node(
                resolution["generated_node_id"]
            )

            if node is None:
                inventory.append(
                    {
                        "occurrence_id": occurrence_id,
                        "placeholder": classification["placeholder"],
                        "generated_node_id": resolution[
                            "generated_node_id"
                        ],
                        "type": placeholder_type,
                        "replacement_found": False,
                        "status": "UNRESOLVED",
                        "fragment_id": None,
                        "confidence": resolution.get(
                            "match_confidence"
                        )
                    }
                )

                continue

            extractor = EXTRACTORS.get(
                placeholder_type
            )

            if extractor is None:
                raise ValueError(
                    f"Unsupported placeholder type: "
                    f"{placeholder_type}"
                )

            if placeholder_type == "KEYVALUE":
                extracted = extractor.extract(
                    node,
                    resolution
                )
            else:
                extracted = extractor.extract(node)

            fragment = FragmentBuilder.build(
                placeholder_type,
                extracted,
                extracted.get("formatting", {})
            )

            fragment_store.append(fragment)

            inventory.append({
                "occurrence_id": occurrence_id,
                "placeholder": classification["placeholder"],
                "type": placeholder_type,
                "generated_node_id": resolution[
                    "generated_node_id"
                ],
                "replacement_found": True,
                "status": "RESOLVED",
                "fragment_id": fragment["fragment_id"],
                "confidence": resolution.get(
                    "match_confidence"
                )
            })

        return inventory, fragment_store
