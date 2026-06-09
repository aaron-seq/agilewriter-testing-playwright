class FormattingSerializer:

    @staticmethod
    def serialize_runs(runs):
        return [
            {
                "text": run.get("text", ""),
                "bold": run.get("bold", False),
                "italic": run.get("italic", False),
                "underline": run.get("underline", False),
                "strikethrough": run.get("strikethrough", False),
            }
            for run in runs
        ]
