def build_output(occurrence, classification_result):

    output = dict(occurrence)

    output["type"] = classification_result.type.value
    output["classification_reason"] = (
        classification_result.classification_reason
    )
    output["classification_confidence"] = (
        classification_result.classification_confidence
    )
    output["matched_rule_ids"] = (
        classification_result.matched_rule_ids
    )

    return output
