
import sys
from pathlib import Path

# Add project root to Python path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

sys.path.insert(0, str(PROJECT_ROOT))
from pprint import pprint
from classification.classifier import PlaceholderClassifier

inventory = [
    {   
        "placeholder": "<Table: Adverse Events>",
        "table_path": None,
        "inline_context": {}
    }
]

classifier = PlaceholderClassifier()

results = classifier.classify_inventory(inventory)

pprint(results, sort_dicts=False)

# output


# [
#   {
#     "placeholder": "<Table: Adverse Events>",
#     "table_path": null,
#     "inline_context": {},
#     "type": "table",
#     "classification_reason": [
#       "TABLE_SYNTAX_MATCH"
#     ],
#     "classification_confidence": 1.0,
#     "matched_rule_ids": [
#       "TABLE_SYNTAX_RULE"
#     ]
#   }
# ]
