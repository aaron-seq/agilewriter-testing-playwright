"""Extract placeholders from a .docx template into a QA workbook."""

from .classify import classify
from .extractor import Occurrence, Placeholder, extract
from .workbook import build, write

__all__ = ["classify", "extract", "build", "write", "Placeholder", "Occurrence"]
