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
class DocumentNode:
    id: str
    type: str

    text: str = ""

    children: List["DocumentNode"] = field(default_factory=list)

    formatting: Dict = field(default_factory=dict)

    location: Optional[Location] = None

    context: Optional[ContextWindow] = None

    metadata: Dict = field(default_factory=dict)

    def add_child(self, node: "DocumentNode"):
        self.children.append(node)