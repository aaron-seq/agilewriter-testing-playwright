from dataclasses import dataclass
from typing import Optional


@dataclass
class ResolutionResult:
    occurrence_id: str
    placeholder: str

    generated_node_id: Optional[str]

    match_confidence: float

    resolution_status: str

    matched_text: Optional[str] = None

    score_breakdown: dict | None = None


@dataclass
class CandidateMatch:
    node_id: str

    score: float

    section_score: float = 0.0

    table_score: float = 0.0

    context_score: float = 0.0

    type_score: float = 0.0

    formatting_score: float = 0.0

    node_distance_score: float = 0.0
