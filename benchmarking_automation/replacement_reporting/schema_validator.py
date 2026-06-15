class SchemaValidator:

    REQUIRED_FIELDS = [
        "occurrence_id",
        "placeholder",
        "type",
        "status"
    ]

    @classmethod
    def validate_record(
        cls,
        record
    ):

        for field in cls.REQUIRED_FIELDS:

            if field not in record:
                raise ValueError(
                    f"Missing required field: {field}"
                )

        if record.get("replacement_found") is True:

            has_content = bool(
                record.get("replacement_content")
            )

            has_fragment = bool(
                record.get("fragment_id")
            )

            if not has_content and not has_fragment:
                raise ValueError(
                    "replacement_content or fragment_id required"
                )

        return True

    @classmethod
    def validate_inventory(
        cls,
        inventory
    ):

        for record in inventory:
            cls.validate_record(record)

        return True
