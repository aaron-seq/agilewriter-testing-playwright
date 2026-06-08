from difflib import SequenceMatcher


class ResolutionScorer:

    SECTION_WEIGHT = 0.25
    TABLE_WEIGHT = 0.15
    TYPE_WEIGHT = 0.15
    CONTEXT_WEIGHT = 0.25
    FORMAT_WEIGHT = 0.05
    NODE_DISTANCE_WEIGHT = 0.15

    RESOLVED_THRESHOLD = 0.70

    @staticmethod
    def similarity(a: str | None, b: str | None) -> float:

        if not a or not b:
            return 0.0

        return SequenceMatcher(
            None,
            a.lower(),
            b.lower()
        ).ratio()

    @classmethod
    def compute_score(
        cls,
        section_score,
        table_score,
        type_score,
        context_score,
        formatting_score,
        node_distance_score
    ):

        return (
            section_score * cls.SECTION_WEIGHT
            + table_score * cls.TABLE_WEIGHT
            + type_score * cls.TYPE_WEIGHT
            + context_score * cls.CONTEXT_WEIGHT
            + formatting_score * cls.FORMAT_WEIGHT
            + node_distance_score * cls.NODE_DISTANCE_WEIGHT
        )
