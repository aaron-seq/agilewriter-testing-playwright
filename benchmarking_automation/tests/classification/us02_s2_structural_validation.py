import json
import sys

from pathlib import Path

from pprint import pprint

from collections import Counter


# ---------------------------------------------------
# ADD PROJECT ROOT
# ---------------------------------------------------

PROJECT_ROOT = (
    Path(__file__).resolve().parent.parent.parent
)

sys.path.insert(0, str(PROJECT_ROOT))


# ---------------------------------------------------
# IMPORT CLASSIFIER
# ---------------------------------------------------

from classification.classifier import (
    PlaceholderClassifier
)


# ---------------------------------------------------
# LOAD INVENTORY
# ---------------------------------------------------

inventory_path = (
    PROJECT_ROOT
    / "tests"
    / "output"
    / "inventory.json"
)

with open(inventory_path, "r", encoding="utf-8") as file:

    inventory = json.load(file)


# ---------------------------------------------------
# RUN CLASSIFICATION
# ---------------------------------------------------

classifier = PlaceholderClassifier()

results = classifier.classify_inventory(inventory)


# ---------------------------------------------------
# SUMMARY
# ---------------------------------------------------

type_counts = Counter(
    item["type"]
    for item in results
)

print("\n===== SUBTASK 2 VALIDATION OUTPUT =====\n")

print("Classification Summary:\n")

pprint(dict(type_counts))


# ---------------------------------------------------
# TABLE CELL VALIDATION
# ---------------------------------------------------

print("\n===== TABLE CELL CLASSIFICATION =====\n")

table_cell_samples = [
    item for item in results
    if item["type"] == "table_cell"
][:10]

if table_cell_samples:

    for item in table_cell_samples:

        pprint({
            "placeholder": item["placeholder"],
            "type": item["type"],
            "table_path": item.get("table_path"),
            "classification_reason":
                item["classification_reason"]
        }, sort_dicts=False)

else:

    print("No table_cell placeholders found.")


# ---------------------------------------------------
# PARAGRAPH VALIDATION
# ---------------------------------------------------

print("\n===== PARAGRAPH CLASSIFICATION =====\n")

paragraph_samples = [
    item for item in results
    if item["type"] == "paragraph"
][:10]

if paragraph_samples:

    for item in paragraph_samples:

        pprint({
            "placeholder": item["placeholder"],
            "type": item["type"],
            "inline_context":
                item.get("inline_context"),
            "classification_reason":
                item["classification_reason"]
        }, sort_dicts=False)

else:

    print("No paragraph placeholders found.")


# ---------------------------------------------------
# KEYVALUE VALIDATION
# ---------------------------------------------------

print("\n===== KEYVALUE CLASSIFICATION =====\n")

keyvalue_samples = [
    item for item in results
    if item["type"] == "keyvalue"
][:10]

if keyvalue_samples:

    for item in keyvalue_samples:

        pprint({
            "placeholder": item["placeholder"],
            "type": item["type"],
            "inline_context":
                item.get("inline_context"),
            "classification_reason":
                item["classification_reason"]
        }, sort_dicts=False)

else:

    print("No keyvalue placeholders found.")


# ---------------------------------------------------
# LIST VALIDATION
# ---------------------------------------------------

print("\n===== STRUCTURAL LIST CLASSIFICATION =====\n")

list_samples = [
    item for item in results
    if (
        item["type"] == "list"
        and "STRUCTURAL_LIST_CONTEXT"
        in item["classification_reason"]
    )
][:10]

if list_samples:

    for item in list_samples:

        pprint({
            "placeholder": item["placeholder"],
            "type": item["type"],
            "node_type":
                item.get("node_type"),
            "classification_reason":
                item["classification_reason"]
        }, sort_dicts=False)

else:

    print("No structural list placeholders found.")

print("\n===== SYNTAX LIST CLASSIFICATION =====\n")

syntax_list_samples = [
    item for item in results
    if (
        item["type"] == "list"
        and any(
            "LIST_SYNTAX_MATCH" in reason
            for reason in item["classification_reason"]
        )
    )
][:10]


# ---------------------------------------------------
# UNKNOWN FALLBACK VALIDATION
# ---------------------------------------------------

print("\n===== UNKNOWN FALLBACK VALIDATION =====\n")

unknown_samples = [
    item for item in results
    if item["type"] == "unknown"
][:10]

if unknown_samples:

    for item in unknown_samples:

        pprint({
            "placeholder": item["placeholder"],
            "type": item["type"],
            "classification_reason":
                item["classification_reason"]
        }, sort_dicts=False)

else:

    print("No unknown placeholders found.")


# ---------------------------------------------------
# SAME PLACEHOLDER MULTIPLE TYPES
# ---------------------------------------------------

print(
    "\n===== SAME PLACEHOLDER DIFFERENT "
    "CLASSIFICATIONS =====\n"
)

placeholder_map = {}

for item in results:

    placeholder = item["placeholder"]

    placeholder_map.setdefault(
        placeholder,
        set()
    ).add(item["type"])


multi_type_placeholders = {
    key: value
    for key, value in placeholder_map.items()
    if len(value) > 1
}

if multi_type_placeholders:

    for placeholder, types in (
        multi_type_placeholders.items()
    ):

        pprint({
            "placeholder": placeholder,
            "types": list(types)
        }, sort_dicts=False)

else:

    print(
        "No placeholders classified "
        "differently by context."
    )


# ---------------------------------------------------
# SYNTAX PRECEDENCE VALIDATION
# ---------------------------------------------------

print("\n===== SYNTAX PRECEDENCE VALIDATION =====\n")

syntax_types = {
    "table",
    "tables",
    "figure"
}

syntax_samples = [
    item for item in results
    if item["type"] in syntax_types
][:10]

if syntax_samples:

    for item in syntax_samples:

        pprint({
            "placeholder": item["placeholder"],
            "type": item["type"],
            "classification_reason":
                item["classification_reason"]
        }, sort_dicts=False)

else:

    print(
        "No syntax-classified placeholders found."
    )


# ---------------------------------------------------
# DETERMINISM VALIDATION
# ---------------------------------------------------

print("\n===== DETERMINISM VALIDATION =====\n")

results_second_run = (
    classifier.classify_inventory(inventory)
)

if results == results_second_run:

    print(
        "Deterministic classification execution: PASSED"
    )

else:

    print(
        "Deterministic classification execution: FAILED"
    )


# ---------------------------------------------------
# FINAL STATUS
# ---------------------------------------------------

print(
    "\nSubtask 2 structural validation "
    "completed successfully."
)