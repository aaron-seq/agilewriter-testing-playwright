from enum import Enum


class PlaceholderType(str, Enum):
    TABLES = "tables"
    TABLE = "table"
    FIGURE = "figure"
    LIST = "list"
    TABLE_CELL = "table_cell"
    PARAGRAPH = "paragraph"
    KEYVALUE = "keyvalue"
    UNKNOWN = "unknown"
