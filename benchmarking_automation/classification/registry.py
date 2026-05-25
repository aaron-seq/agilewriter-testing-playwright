class RuleRegistry:
    def __init__(self):
        self._rules = []

    def register(self, rule):
        self._rules.append(rule)

    def get_rules(self):
        return self._rules
