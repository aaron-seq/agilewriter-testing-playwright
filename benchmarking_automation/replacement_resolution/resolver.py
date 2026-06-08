import json

from replacement_resolution.models import (
    ResolutionResult
)
from replacement_resolution.scoring import (
    ResolutionScorer
)
from replacement_resolution.matching_engine import (
    find_best_match
)

import re

def contains_placeholder(text):

    if not text:
        return False

    return bool(
        re.search(
            r"<[^>]+>",
            text
        )
    )


def flatten_tree(node):

    result = [node]

    for child in node.children:
        result.extend(
            flatten_tree(child)
        )

    return result


class PlaceholderResolver:

    def resolve(
        self,
        classified_inventory,
        generated_tree
    ):

        all_nodes = [
            node
            for node in flatten_tree(
                generated_tree
            )
            if node.type in (
                "paragraph",
                "list_item"
            )
        ]
        node_lookup = {
            node.id: node
            for node in all_nodes
        }

        results = []

        for occurrence in classified_inventory:

            best_match = find_best_match(
                occurrence,
                all_nodes
            )

            if (
                best_match is None
                or best_match.score < ResolutionScorer.RESOLVED_THRESHOLD
            ):

                results.append(
                    ResolutionResult(
                        occurrence_id=occurrence[
                            "occurrence_id"
                        ],
                        placeholder=occurrence[
                            "placeholder"
                        ],
                        generated_node_id=None,
                        match_confidence=0.0,
                        resolution_status="UNRESOLVED"
                    )
                )

                continue

            matched_node = node_lookup.get(
                best_match.node_id
            )

            if matched_node is None:

                    results.append(
                        ResolutionResult(
                            occurrence_id=occurrence[
                                "occurrence_id"
                            ],
                            placeholder=occurrence[
                                "placeholder"
                            ],
                            generated_node_id=None,
                            match_confidence=0.0,
                            resolution_status="UNRESOLVED"
                        )
                    )

                    continue
            matched_text = (
                matched_node.text or ""
            ).strip()

            placeholder = (
                occurrence["placeholder"] or ""
            ).strip()

            if contains_placeholder(
                matched_text
            ):

                results.append(
                    ResolutionResult(
                        occurrence_id=occurrence[
                            "occurrence_id"
                        ],
                        placeholder=placeholder,
                        generated_node_id=None,
                        match_confidence=0.0,
                        resolution_status="UNRESOLVED"
                    )
                )

                continue

            results.append(
                ResolutionResult(
                    occurrence_id=occurrence[
                        "occurrence_id"
                    ],
                    placeholder=occurrence[
                        "placeholder"
                    ],
                    generated_node_id=matched_node.id,
                    matched_text=matched_node.text,
                    match_confidence=round(
                        best_match.score,
                        4
                    ),
                    resolution_status="RESOLVED",
                    score_breakdown={
                        "section": best_match.section_score,
                        "table": best_match.table_score,
                        "context": best_match.context_score,
                        "type": best_match.type_score,
                        "formatting": best_match.formatting_score,
                        "node_distance": (
                            best_match.node_distance_score
                        )
                    }
                )
            )

        return results
    


