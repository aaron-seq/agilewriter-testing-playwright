import json

from reporting.document_tree_loader import (
    DocumentTreeLoader
)

from reporting.placeholder_resolution_reporter import (
    PlaceholderResolutionReporter
)

from replacement_resolution.resolver import (
    PlaceholderResolver
)


class PlaceholderResolutionPipeline:

    def __init__(self):

        self.resolver = (
            PlaceholderResolver()
        )

    def load_inventory(
        self,
        inventory_path
    ):

        with open(
            inventory_path,
            "r",
            encoding="utf-8"
        ) as file:

            return json.load(file)

    def run(
        self,
        inventory_path,
        document_tree_path,
        output_path
    ):

        inventory = (
            self.load_inventory(
                inventory_path
            )
        )

        document_tree = (
            DocumentTreeLoader.load(
                document_tree_path
            )
        )

        results = (
            self.resolver.resolve(
                inventory,
                document_tree
            )
        )

        PlaceholderResolutionReporter.save(
            results,
            output_path
        )

        return results