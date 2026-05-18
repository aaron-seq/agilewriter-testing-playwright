from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Location:
    section: str
    paragraph_index: int
    table_index: Optional[int] = None
    row_index: Optional[int] = None
    cell_index: Optional[int] = None
    table_path: Optional[str] = None
    is_list_item: bool = False


@dataclass
class DocumentNode:
    node_id: str
    node_type: str
    text: str
    location: Location


@dataclass
class CanonicalDocumentTree:
    nodes: list[DocumentNode] = field(default_factory=list)
