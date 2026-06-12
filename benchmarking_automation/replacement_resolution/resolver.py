import json
import re
from difflib import SequenceMatcher

from replacement_resolution.models import (
    ResolutionResult
)
from replacement_resolution.scoring import (
    ResolutionScorer
)
from replacement_resolution.matching_engine import (
    find_best_match
)


def contains_placeholder(text):
    if not text:
        return False
    return bool(re.search(r"<[^>]+>", text))


def flatten_tree(node):
    result = [node]
    for child in node.children:
        result.extend(flatten_tree(child))
    return result


def extract_label_value_pairs(node_text):
    """
    Extract (label, value) pairs from generated document text.
    Returns list of dicts: {label, label_norm, value, node_id, full_text}
    """
    if not node_text:
        return []

    pairs = []

    # Pattern: "Label: Value"
    colon_idx = node_text.find(":")
    if colon_idx > 0:
        label_part = node_text[:colon_idx].strip()
        value_part = node_text[colon_idx + 1:].strip()

        if label_part and value_part:
            # Whole label
            pairs.append({
                "label": label_part,
                "label_norm": label_part.lower().strip(),
                "value": value_part
            })

            # Split compound labels by /
            for sep in [" / ", " /", "/ "]:
                if sep in label_part:
                    for individual_label in label_part.split(sep):
                        ind_label = individual_label.strip()
                        if ind_label and len(ind_label) > 1:
                            pairs.append({
                                "label": ind_label,
                                "label_norm": ind_label.lower().strip(),
                                "value": value_part
                            })
                    break

    # Tab-separated cells: "Label\tValue"
    tab_match = re.match(r'([A-Za-z][A-Za-z\s/]+)\t+(.+)', node_text)
    if tab_match:
        label = tab_match.group(1).strip()
        value = tab_match.group(2).strip()
        pairs.append({
            "label": label,
            "label_norm": label.lower().strip(),
            "value": value
        })

    return pairs


def extract_value_after_label(node_text, label_name):
    """
    Extract the value from a label:value pair in node_text.
    label_name is the placeholder name (lowercased, no brackets).
    
    e.g. node_text="Sponsor / Study Title:Stendarr, Inc."
         label_name="sponsor"
         returns "Stendarr, Inc."
    """
    if not node_text or not label_name:
        return None

    label_lower = label_name.lower().strip()

    # Find colon
    colon_idx = node_text.find(":")
    if colon_idx <= 0:
        return None

    before_colon = node_text[:colon_idx].lower().strip()
    after_colon = node_text[colon_idx + 1:].strip()

    # Check if our label is in the part before the colon
    if label_lower in before_colon:
        # Extract value - split on common separators and take first segment
        value = after_colon
        for sep in [" / ", "  ", "\t"]:
            if sep in value:
                first_val = value.split(sep)[0].strip()
                if len(first_val) < 150:  # Reasonable value length
                    return first_val
                break
        if value:
            return value

    return None


def is_label(placeholder_name, node_text):
    """
    Check if the placeholder name (without brackets) appears as a label
    in the given node text.
    e.g. "sponsor" in "Sponsor / Study Title:Value" -> True
    """
    if not placeholder_name or not node_text:
        return False
    colon_idx = node_text.find(":")
    if colon_idx <= 0:
        return False
    before_colon = node_text[:colon_idx].lower().strip()
    return placeholder_name.lower() in before_colon


class PlaceholderResolver:

    def resolve(self, classified_inventory, generated_tree):

        # Get all text-bearing nodes from generated document
        all_nodes = [
            node for node in flatten_tree(generated_tree)
            if node.type in ("paragraph", "list_item", "cell") and node.text
        ]
        node_lookup = {node.id: node for node in all_nodes}

        # Create label index for KEYVALUE resolution
        label_value_map = {}  # label_norm -> {value: str, node_id: str}
        for node in all_nodes:
            pairs = extract_label_value_pairs(node.text)
            for pair in pairs:
                ln = pair["label_norm"]
                if ln not in label_value_map:
                    label_value_map[ln] = {
                        "value": pair["value"],
                        "node_id": node.id
                    }

        results = []
        used_node_ids = set()

        # Process placeholders
        for occurrence in classified_inventory:
            placeholder = occurrence.get("placeholder", "")
            occ_id = occurrence["occurrence_id"]
            ph_type = occurrence.get("type", "").upper()
            ph_name = placeholder.strip("<>").strip().lower()

            resolved = False

            # Step 1: For KEYVALUE, try label match first
            if ph_type == "KEYVALUE" and ph_name:
                # Direct label match
                if ph_name in label_value_map:
                    entry = label_value_map[ph_name]
                    node = node_lookup.get(entry["node_id"])
                    if node:
                        # Allow multiple placeholders to share the same node 
                        # if they all come from the same compound label cell
                        value = extract_value_after_label(node.text, ph_name)
                        matched = value or entry["value"]
                        results.append(
                            ResolutionResult(
                                occurrence_id=occ_id,
                                placeholder=placeholder,
                                generated_node_id=node.id,
                                matched_text=matched,
                                match_confidence=0.9,
                                resolution_status="RESOLVED",
                                score_breakdown={
                                    "method": "label_exact_match"
                                }
                            )
                        )
                        used_node_ids.add(node.id)
                        resolved = True

                # Multi-word label: all significant words must match
                if not resolved:
                    ph_words = set(w for w in ph_name.split() if len(w) > 3 and w not in (
                        "the", "and", "for", "with", "study", "lay", "brief", "insert", "bulleted",
                        "protocol", "number", "participant", "name", "terminology", "summary",
                        "description"
                    ))
                    if len(ph_words) >= 2:
                        for label_key, entry in label_value_map.items():
                            if resolved:
                                break
                            label_words = set(w for w in label_key.split() if len(w) > 3)
                            if len(label_words) >= 2 and ph_words.issubset(label_words):
                                node = node_lookup.get(entry["node_id"])
                                if node and node.id not in used_node_ids:
                                    value = extract_value_after_label(node.text, label_key)
                                    results.append(
                                        ResolutionResult(
                                            occurrence_id=occ_id,
                                            placeholder=placeholder,
                                            generated_node_id=node.id,
                                            matched_text=value or entry["value"],
                                            match_confidence=0.8,
                                            resolution_status="RESOLVED",
                                            score_breakdown={
                                                "method": "label_multiword_match"
                                            }
                                        )
                                    )
                                    used_node_ids.add(node.id)
                                    resolved = True

            # Step 2: For KEYVALUE that wasn't label-matched, check if placeholder name
            # text (without brackets) appears as a label in any unused node
            if not resolved:
                available_nodes = [
                    n for n in all_nodes
                    if n.id not in used_node_ids and not contains_placeholder(n.text or "")
                ]
                for node in available_nodes:
                    if resolved:
                        break
                    if is_label(ph_name, node.text):
                        value = extract_value_after_label(node.text, ph_name)
                        if value:
                            results.append(
                                ResolutionResult(
                                    occurrence_id=occ_id,
                                    placeholder=placeholder,
                                    generated_node_id=node.id,
                                    matched_text=value,
                                    match_confidence=0.85,
                                    resolution_status="RESOLVED",
                                    score_breakdown={
                                        "method": "label_content_search"
                                    }
                                )
                            )
                            used_node_ids.add(node.id)
                            resolved = True

            # Step 3: Structural matching fallback
            if not resolved:
                available_nodes = [
                    n for n in all_nodes
                    if n.id not in used_node_ids and not contains_placeholder(n.text or "")
                ]
                if not available_nodes:
                    available_nodes = all_nodes

                best_match = find_best_match(occurrence, available_nodes)
                if best_match and best_match.score >= ResolutionScorer.RESOLVED_THRESHOLD:
                    matched_node = node_lookup.get(best_match.node_id)
                    if matched_node and not contains_placeholder(matched_node.text or ""):
                        results.append(
                            ResolutionResult(
                                occurrence_id=occ_id,
                                placeholder=placeholder,
                                generated_node_id=matched_node.id,
                                matched_text=matched_node.text,
                                match_confidence=round(best_match.score, 4),
                                resolution_status="RESOLVED",
                                score_breakdown={
                                    "method": "structural_match"
                                }
                            )
                        )
                        used_node_ids.add(best_match.node_id)
                        resolved = True

            if not resolved:
                results.append(
                    ResolutionResult(
                        occurrence_id=occ_id,
                        placeholder=placeholder,
                        generated_node_id=None,
                        match_confidence=0.0,
                        resolution_status="UNRESOLVED"
                    )
                )

        return results