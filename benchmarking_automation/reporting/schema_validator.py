from classification.models.placeholder_type import (
    PlaceholderType
)


SUPPORTED_TYPES = {
    item.value
    for item in PlaceholderType
}


REQUIRED_FIELDS = {
    "occurrence_id",
    "placeholder",
    "type",
    "classification_confidence",
    "classification_reason",
    "matched_rule_ids"
}


class SchemaValidationError(Exception):
    pass


def validate_inventory_schema(classified_inventory):

    if not isinstance(classified_inventory, list):
        raise SchemaValidationError(
            "Inventory must be a list."
        )

    for item in classified_inventory:

        validate_inventory_item(item)


def validate_inventory_item(item):

    missing = REQUIRED_FIELDS - set(item.keys())

    if missing:
        raise SchemaValidationError(
            f"Missing required fields: {missing}"
        )

    validate_type(item)

    validate_confidence(item)

    validate_reason(item)


def validate_type(item):

    placeholder_type = item["type"]

    if placeholder_type not in SUPPORTED_TYPES:

        raise SchemaValidationError(
            f"Unsupported placeholder type: "
            f"{placeholder_type}"
        )


def validate_confidence(item):

    confidence = item["classification_confidence"]

    if not isinstance(confidence, (int, float)):
        raise SchemaValidationError(
            "classification_confidence "
            "must be numeric."
        )

    if confidence < 0 or confidence > 1:
        raise SchemaValidationError(
            "classification_confidence "
            "must be between 0 and 1."
        )


def validate_reason(item):

    reasons = item["classification_reason"]

    if not isinstance(reasons, list):
        raise SchemaValidationError(
            "classification_reason must be a list."
        )
