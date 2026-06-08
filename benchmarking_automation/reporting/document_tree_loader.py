import json

from models.nodes import (
    DocumentNode,
    Location,
    ContextWindow,
    RichTextRun
)


class DocumentTreeLoader:

    @staticmethod
    def load(file_path):

        with open(
            file_path,
            "r",
            encoding="utf-8"
        ) as file:

            data = json.load(file)

        return (
            DocumentTreeLoader
            ._build_node(data)
        )

    @staticmethod
    def _build_node(data):

        location = None

        if data.get("location"):

            location = Location(
                **data["location"]
            )

        context = None

        if data.get("context"):

            context = ContextWindow(
                **data["context"]
            )

        rich_runs = [
            RichTextRun(**run)
            for run in data.get(
                "rich_runs",
                []
            )
        ]

        node = DocumentNode(
            id=data["id"],
            type=data["type"],
            text=data.get(
                "text",
                ""
            ),
            rich_runs=rich_runs,
            location=location,
            context=context,
            metadata=data.get(
                "metadata",
                {}
            ),
            node_order=data.get(
                "node_order"
            ),
            parent_id=data.get(
                "parent_id"
            )
        )

        for child_data in data.get(
            "children",
            []
        ):

            node.add_child(
                DocumentTreeLoader._build_node(
                    child_data
                )
            )

        return node
