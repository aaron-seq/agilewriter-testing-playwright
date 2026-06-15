class ResolvedNodeExtractor:

    def __init__(
        self,
        generated_tree
    ):

        self.node_map = {}

        #
        # SCC-244 unit test format
        #
        if isinstance(
            generated_tree,
            dict
        ):

            for node in generated_tree.get(
                "nodes",
                []
            ):

                self.node_map[
                    node["node_id"]
                ] = node

            return

        #
        # Real document pipeline format
        #
        self._index_node(
            generated_tree
        )

    def _index_node(
        self,
        node
    ):

        self.node_map[
            node.id
        ] = node

        for child in node.children:

            self._index_node(
                child
            )

    def get_node(
        self,
        generated_node_id
    ):

        return self.node_map.get(
            generated_node_id
        )
