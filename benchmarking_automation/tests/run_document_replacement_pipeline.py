import sys
from pathlib import Path

# Add project root to Python path
PROJECT_ROOT = Path(__file__).resolve().parent.parent

sys.path.insert(0, str(PROJECT_ROOT))

from app.document_replacement_pipeline import (
    DocumentReplacementPipeline
)

pipeline = (
    DocumentReplacementPipeline()
)

pipeline.run(
    template_docx=(
        "tests/CSR_Template_20FEB2026.docx"
    ),
    generated_docx=(
        "tests/CSR_1133_19_SB_raw.docx"
    ),
    output_dir="final_outputs"
)

print(
    "Completed. Outputs written to final_outputs/"
)