class ResolvedNodeExtractor:

    def __init__(self, generated_tree):
        self.node_map = {
            node["node_id"]: node
            for node in generated_tree["nodes"]
        }

    def get_node(self, generated_node_id):
        return self.node_map.get(generated_node_id)