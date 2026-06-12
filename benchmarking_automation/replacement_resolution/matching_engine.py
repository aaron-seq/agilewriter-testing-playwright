from replacement_resolution.models import (
    CandidateMatch
)

from replacement_resolution.scoring import (
    ResolutionScorer
)


def is_candidate(
    placeholder_occurrence,
    node
):

    if node.location is None:
        return False

    if node.type not in (
        "paragraph",
        "list_item",
        "table",
        "table_cell"
    ):
        return False

    occurrence_section = (
        placeholder_occurrence.get(
            "section"
        )
    )

    if (
        occurrence_section
        and occurrence_section
        != node.location.section
    ):
        return False

    occurrence_table_path = (
        placeholder_occurrence.get(
            "table_path"
        )
    )

    if (
        occurrence_table_path
        and node.location.table_path
        and occurrence_table_path
        != node.location.table_path
    ):
        return False

    return True


def score_context(
    occurrence,
    node
):

    if node.context is None:
        return 0.0

    scores = []

    occurrence_before = (
        occurrence.get(
            "neighbor_context",
            {}
        ).get("before")
    )

    occurrence_after = (
        occurrence.get(
            "neighbor_context",
            {}
        ).get("after")
    )

    if (
        occurrence_before
        and node.context.before_text
    ):
        scores.append(
            ResolutionScorer.similarity(
                occurrence_before,
                node.context.before_text
            )
        )

    if (
        occurrence_after
        and node.context.after_text
    ):
        scores.append(
            ResolutionScorer.similarity(
                occurrence_after,
                node.context.after_text
            )
        )

    if not scores:
        return 0.0

    return sum(scores) / len(scores)


def score_table_path(
    occurrence,
    node
):
    if node.location is None:
        return 0.0

    expected = occurrence.get(
        "table_path"
    )

    actual = (
        node.location.table_path
    )

    if not expected or not actual:
        return 0.0

    if expected == actual:
        return 1.0

    return ResolutionScorer.similarity(
        expected,
        actual
    )


def score_section(
    occurrence,
    node
):
    if node.location is None:
        return 0.0

    expected = occurrence.get(
        "section"
    )

    actual = node.location.section

    if expected == actual:
        return 1.0

    return 0.0


def score_type(
    occurrence,
    node
):

    expected = occurrence.get(
        "node_type"
    )

    if not expected:
        return 0.0

    return (
        1.0
        if expected == node.type
        else 0.0
    )


def score_node_distance(
    occurrence,
    node
):

    if node.location is None:
        return 0.0

    expected = occurrence.get(
        "paragraph_index"
    )

    actual = node.location.paragraph_index

    if (
        expected is None
        or actual is None
    ):
        return 0.0

    distance = abs(
        expected - actual
    )

    return 1 / (1 + distance)


def score_formatting(
    occurrence,
    node
):

    # if not node.rich_runs:
    #     return 0.0

    # return 1.0
    return 0.0


def find_best_match(
    occurrence,
    nodes
):

    best = None

    for node in nodes:

        if not is_candidate(
            occurrence,
            node
        ):
            continue

        section_score = score_section(
            occurrence,
            node
        )

        table_score = score_table_path(
            occurrence,
            node
        )

        context_score = score_context(
            occurrence,
            node
        )

        neighbor_context = (
            occurrence.get(
                "neighbor_context",
                {}
            )
        )

        has_context = (
            neighbor_context.get("before")
            or neighbor_context.get("after")
        )

        #
        # Table placeholders require
        # context evidence.
        #
        if (
            occurrence.get("table_path")
            and not has_context
        ):
            continue

        # if (
        #     has_context
        #     and context_score == 0
        # ):
        #     continue

        # # Table placeholders with no context
        # # must have stronger evidence.

        # if (
        #     occurrence.get("table_path")
        #     and context_score == 0
        # ):
        #     continue

        type_score = score_type(
            occurrence,
            node
        )

        formatting_score = score_formatting(
            occurrence,
            node
        )

        node_distance_score = (
            score_node_distance(
                occurrence,
                node
            )
        )

        total_score = (
            ResolutionScorer.compute_score(
                section_score,
                table_score,
                type_score,
                context_score,
                formatting_score,
                node_distance_score
            )
        )
        if total_score <= 0:
            continue

        candidate = CandidateMatch(
            node_id=node.id,
            score=total_score,
            section_score=section_score,
            table_score=table_score,
            context_score=context_score,
            type_score=type_score,
            formatting_score=formatting_score,
            node_distance_score=node_distance_score
        )

        if (
            best is None
            or candidate.score > best.score
        ):
            best = candidate

    return best
