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

    return True


def score_context(
    occurrence,
    node
):

    if node.context is None:
        return 0.0

    scores = []

    # ---------------------------------------------------
    # Inline context (stronger signal)
    # - text immediately before/after the placeholder
    #   within the SAME paragraph
    # ---------------------------------------------------
    inline_before = (
        occurrence.get(
            "inline_context",
            {}
        ).get("before", "")
    )

    inline_after = (
        occurrence.get(
            "inline_context",
            {}
        ).get("after", "")
    )

    node_text = (node.text or "").strip()

    # Check if inline_before text appears in the generated node text
    if inline_before:
        inline_before_norm = inline_before.strip().lower()
        if inline_before_norm and inline_before_norm in node_text.lower():
            # Score proportional to how much of the node text starts
            # with the before-context (high precision match)
            if node_text.lower().startswith(inline_before_norm):
                scores.append(1.0)
            else:
                scores.append(0.5)

    # Check if inline_after text appears in the generated node text
    if inline_after:
        inline_after_norm = inline_after.strip().lower()
        if inline_after_norm and inline_after_norm in node_text.lower():
            if node_text.lower().endswith(inline_after_norm):
                scores.append(1.0)
            else:
                scores.append(0.5)

    # ---------------------------------------------------
    # Neighbor context (weaker signal)
    # - text from paragraphs before/after the placeholder
    # ---------------------------------------------------
    neighbor_before = (
        occurrence.get(
            "neighbor_context",
            {}
        ).get("before")
    )

    neighbor_after = (
        occurrence.get(
            "neighbor_context",
            {}
        ).get("after")
    )

    if (
        neighbor_before
        and node.context.before_text
    ):
        scores.append(
            ResolutionScorer.similarity(
                neighbor_before,
                node.context.before_text
            ) * 0.5  # Neighbor context is weaker
        )

    if (
        neighbor_after
        and node.context.after_text
    ):
        scores.append(
            ResolutionScorer.similarity(
                neighbor_after,
                node.context.after_text
            ) * 0.5  # Neighbor context is weaker
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

    # Partial credit if both are "document" types
    # or if one is a header/footer and other is document
    if not expected or not actual:
        return 0.0

    # Both are some kind of section - give partial credit
    return 0.3


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

    if not hasattr(node, 'rich_runs') or not node.rich_runs:
        return 0.0

    # Get the occurrence's node_type
    occurrence_type = occurrence.get("node_type", "")

    # If node has formatting properties (bold, italic, etc.) and matches
    # expected node type, give partial formatting credit
    has_formatting = any(
        r.bold or r.italic or r.underline
        for r in node.rich_runs
        if hasattr(r, 'bold')
    )

    if has_formatting:
        return 0.5

    # If the node type matches, that's weak formatting evidence
    if occurrence_type and occurrence_type == node.type:
        return 0.2

    return 0.0


def score_content_match(
    occurrence,
    node
):
    """
    Score how well the node's text content matches what we'd expect
    for this placeholder's replacement. Prefer nodes where:
    - The placeholder name text appears in the generated content
    - The placeholder tag is gone (replaced)
    - The text length is reasonable (not a full paragraph)
    """
    node_text = (node.text or "").strip()
    if not node_text:
        return 0.0

    placeholder = occurrence.get("placeholder", "")
    if not placeholder:
        return 0.0

    # If the node still contains the raw placeholder tag, that's bad
    if placeholder in node_text:
        return -0.5

    # Get the name inside the placeholder (without < >)
    ph_name = placeholder.strip("<>").strip().lower()
    if not ph_name or len(ph_name) <= 1:
        return 0.0

    # Check if placeholder name text appears in the generated content
    # This is the PRIMARY signal: for a placeholder like <Sponsor>,
    # the word "Sponsor" should appear as a label in the generated text
    if ph_name in node_text.lower():
        # Strong evidence of match
        ph_in_text_score = 0.5

        # Bonus: if placeholder name is near a colon (label: value pattern)
        if ":" in node_text.lower():
            ph_in_text_score += 0.2

        return ph_in_text_score

    # Check if inline context appears in generated text
    inline_before = occurrence.get(
        "inline_context", {}
    ).get("before", "").strip().lower()
    inline_after = occurrence.get(
        "inline_context", {}
    ).get("after", "").strip().lower()

    if inline_before and inline_before in node_text.lower():
        return 0.4
    if inline_after and inline_after in node_text.lower():
        return 0.4

    # Negative signals for large/compound paragraphs
    if len(node_text) > 300:
        return -0.3
    if node_text.count(":") > 3:
        return -0.2

    return 0.1


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

        # ----------
        # CONTENT MATCH: PRIMARY SIGNAL
        # For template → generated document matching, the strongest
        # signal is whether the placeholder name text (e.g. "Sponsor")
        # appears as a label in the generated content.
        # ----------
        content_score = score_content_match(
            occurrence,
            node
        )

        # ----------
        # STRUCTURAL SCORES: SECONDARY SIGNALS
        # Used as tiebreakers when multiple nodes match content.
        # ----------
        section_score = score_section(
            occurrence,
            node
        )

        table_score = score_table_path(
            occurrence,
            node
        )

        type_score = score_type(
            occurrence,
            node
        )

        context_score = score_context(
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

        # ----------
        # COMPOSITE SCORE:
        # Content score dominates (0-0.7 range)
        # Structural scores add smaller modifiers
        # ----------
        structural_score = (
            section_score * 0.15
            + table_score * 0.10
            + type_score * 0.10
            + context_score * 0.15
            + formatting_score * 0.05
            + node_distance_score * 0.05
        )

        # Final score = content + structural modifier
        total_score = content_score + structural_score

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
