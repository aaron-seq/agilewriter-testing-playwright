from dataclasses import dataclass, field
from typing import List, Dict, Optional


@dataclass
class Location:
    section: Optional[str] = None
    paragraph_index: Optional[int] = None

    table_index: Optional[int] = None
    row_index: Optional[int] = None
    cell_index: Optional[int] = None

    table_path: Optional[str] = None

    header_index: Optional[int] = None
    footer_index: Optional[int] = None

    

@dataclass
class ContextWindow:
    before_text: Optional[str] = None
    after_text: Optional[str] = None


@dataclass
class RichTextRun:
    text: str

    bold: bool = False
    italic: bool = False
    underline: bool = False
    strike: bool = False

    font_name: Optional[str] = None
    font_size: Optional[int] = None

    color: Optional[str] = None
    highlight: Optional[str] = None


@dataclass
class RevisionFragment:
    """
    Represents a text fragment from a Word revision element.
    
    source: one of "normal", "deleted", "inserted"
    revision_type: the XML element name e.g. "del", "ins", "moveFrom", "moveTo"
    """
    text: str
    source: str  # "normal" | "deleted" | "inserted"
    revision_type: Optional[str] = None  # "del" | "ins" | "moveFrom" | "moveTo"


@dataclass
class TrackedReplacementPair:
    """
    A matched deletion/insertion pair representing a placeholder replacement.
    """
    deleted_text: str
    inserted_text: str
    placeholder: Optional[str] = None
    confidence: float = 1.0


@dataclass
class DocumentNode:
    id: str
    type: str

    text: str = ""

    children: List["DocumentNode"] = field(default_factory=list)

    rich_runs: List[RichTextRun] = field(default_factory=list)

    revision_fragments: List[RevisionFragment] = field(default_factory=list)

    tracked_replacement_pairs: List[TrackedReplacementPair] = field(default_factory=list)

    location: Optional[Location] = None

    context: Optional[ContextWindow] = None

    metadata: Dict = field(default_factory=dict)

    node_order: Optional[int] = None

    parent_id: Optional[str] = None

    def add_child(self, node: "DocumentNode"):
        self.children.append(node)