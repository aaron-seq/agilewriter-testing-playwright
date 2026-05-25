from abc import ABC, abstractmethod


class BaseClassificationRule(ABC):

    RULE_ID = "BASE_RULE"

    @abstractmethod
    def match(self, occurrence: dict):
        """
        Return ClassificationResult or None.
        """
        pass
