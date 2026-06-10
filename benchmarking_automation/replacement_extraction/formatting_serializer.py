class FormattingSerializer:

    @staticmethod
    def serialize_runs(runs):

        serialized = []

        for run in runs:

            if isinstance(run, dict):

                serialized.append({
                    "text": run.get("text", ""),
                    "bold": run.get("bold", False),
                    "italic": run.get("italic", False),
                    "underline": run.get("underline", False),
                    "strike": run.get("strike", False),
                    "font_name": run.get("font_name"),
                    "font_size": run.get("font_size"),
                    "color": run.get("color"),
                    "highlight": run.get("highlight")
                })

            else:

                serialized.append({
                    "text": run.text,
                    "bold": run.bold,
                    "italic": run.italic,
                    "underline": run.underline,
                    "strike": run.strike,
                    "font_name": run.font_name,
                    "font_size": run.font_size,
                    "color": run.color,
                    "highlight": run.highlight
                })

        return serialized