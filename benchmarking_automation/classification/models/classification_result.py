from dataclasses import dataclass, field
from typing import List

from classification.models.placeholder_type import PlaceholderType


@dataclass
class ClassificationResult:
    placeholder: str
    type: PlaceholderType
    classification_reason: List[str] = field(default_factory=list)
    classification_confidence: float = 0.0
    matched_rule_ids: List[str] = field(default_factory=list)
