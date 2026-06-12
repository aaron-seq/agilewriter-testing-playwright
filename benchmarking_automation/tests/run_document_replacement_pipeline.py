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
        "tests\ICF_docx\ICF_SET0 (1).docx"
        
    ),
    generated_docx=(
        "tests\ICF_docx\ICF_Full_output_01.docx"
    ),
    output_dir="final_outputs"
)

print(
    "Completed. Outputs written to final_outputs/"
)