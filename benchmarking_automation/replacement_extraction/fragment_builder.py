import uuid

class FragmentBuilder:

    @staticmethod
    def build(node_type, content, formatting):
        return {
            "fragment_id": f"FRAG_{uuid.uuid4().hex[:8]}",
            "node_type": node_type,
            "content": content,
            "formatting": formatting
        }