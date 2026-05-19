# reporting/export_service.py

from pathlib import Path


class ExportService:

    @staticmethod
    def export_json(
        output_path: str,
        json_content: str
    ):

        path = Path(output_path)
        
        path.parent.mkdir(
            parents=True,
            exist_ok=True
        )

        path.write_text(
            json_content,
            encoding="utf-8"
        )

        return path