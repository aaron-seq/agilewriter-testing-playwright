from dataclasses import dataclass, field
from typing import List, Dict, Optional


@dataclass
class Location:
    section: Optional[str] = None
    paragraph_index: Optional[int] = None

    table_index: Optional[int] = None
    row_index: Optional[int] = None
    cell_index: Optional[int] = None

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
class DocumentNode:
    id: str
    type: str

    text: str = ""

    children: List["DocumentNode"] = field(default_factory=list)

    rich_runs: List[RichTextRun] = field(default_factory=list)

    location: Optional[Location] = None

    context: Optional[ContextWindow] = None

    metadata: Dict = field(default_factory=dict)

    node_order: Optional[int] = None

    parent_id: Optional[str] = None

    def add_child(self, node: "DocumentNode"):
        self.children.append(node)
