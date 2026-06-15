"""
Placeholder Resolver — Full Text Scan Approach

For each placeholder:
1. Try tracked pair match (deleted text in XML)
2. Search ALL generated document text for inline_before/inline_after context
3. Search ALL generated document text for placeholder name as label:value
4. Search ALL generated document text for significant placeholder words
"""

import re
from difflib import SequenceMatcher

from replacement_resolution.models import ResolutionResult


def contains_placeholder(text):
    return bool(re.search(r"<[^>]+>", text)) if text else False


def flatten_tree(node):
    result = [node]
    for child in node.children:
        result.extend(flatten_tree(child))
    return result


def collect_tracked_pairs(tree):
    pairs = []
    for node in flatten_tree(tree):
        if hasattr(node, 'tracked_replacement_pairs') and node.tracked_replacement_pairs:
            for p in node.tracked_replacement_pairs:
                pairs.append({
                    "deleted_text": p.deleted_text,
                    "inserted_text": p.inserted_text,
                    "node_id": node.id,
                })
    return pairs


def extract_clean_value(text):
    """Extract a clean value from la bel:value text."""
    if not text:
        return None
    colon_idx = text.find(":")
    if colon_idx > 0:
        val = text[colon_idx + 1:].strip()
        for sep in [" / ", "  ", "\t"]:
            if sep in val:
                val = val.split(sep)[0].strip()
        if val and len(val) < 400 and not contains_placeholder(val):
            return val
    return None


class PlaceholderResolver:

    def resolve(self, classified_inventory, generated_tree):

        tracked_pairs = collect_tracked_pairs(generated_tree)

        # Build a flat text index of ALL generated document content
        all_nodes = [
            n for n in flatten_tree(generated_tree)
            if n.type in ("paragraph", "list_item", "cell") and n.text
        ]

        results = []
        used_node_ids = set()
        matched_count = 0
        unresolved_count = 0

        for occurrence in classified_inventory:
            placeholder = occurrence.get("placeholder", "").strip()
            occ_id = occurrence["occurrence_id"]
            ph_name = placeholder.strip("<>").strip()
            ph_normalized = ph_name.lower().strip()

            resolved = False

            # ==============================================
            # LEVEL 1: Direct tracked pair match
            # ==============================================
            if not resolved:
                for p in tracked_pairs:
                    dt = p["deleted_text"].strip()
                    if placeholder == dt or placeholder in dt or ph_normalized in dt.lower():
                        results.append(ResolutionResult(
                            occurrence_id=occ_id, placeholder=placeholder,
                            generated_node_id=p["node_id"],
                            matched_text=p["inserted_text"],
                            match_confidence=0.95,
                            resolution_status="RESOLVED",
                            score_breakdown={"method": "tracked_pair"}
                        ))
                        used_node_ids.add(p["node_id"])
                        resolved = True
                        matched_count += 1
                        break

            # ==============================================
            # LEVEL 2: INLINE CONTEXT — Find text before/after in generated doc
            # ==============================================
            if not resolved:
                inline_before = (occurrence.get("inline_context", {}) or {}).get("before", "").strip()
                inline_after = (occurrence.get("inline_context", {}) or {}).get("after", "").strip()

                if inline_before:
                    ib_lower = inline_before.lower()
                    for node in all_nodes:
                        if node.id in used_node_ids:
                            continue
                        node_text = node.text or ""
                        ntl = node_text.lower()
                        pos = ntl.find(ib_lower)
                        if pos >= 0:
                            after_pos = pos + len(ib_lower)
                            remaining = node_text[after_pos:].strip()
                            # Strip inline after
                            if inline_after:
                                ia_pos = remaining.lower().find(inline_after.lower())
                                if ia_pos >= 0:
                                    remaining = remaining[:ia_pos].strip()
                            # Clean
                            for sep in [" / ", "  ", "\t"]:
                                if sep in remaining:
                                    remaining = remaining.split(sep)[0].strip()
                            if remaining and len(remaining) < 400:
                                results.append(ResolutionResult(
                                    occurrence_id=occ_id, placeholder=placeholder,
                                    generated_node_id=node.id,
                                    matched_text=remaining,
                                    match_confidence=0.9,
                                    resolution_status="RESOLVED",
                                    score_breakdown={"method": "inline_before"}
                                ))
                                used_node_ids.add(node.id)
                                resolved = True
                                matched_count += 1
                                break

                if not resolved and inline_after:
                    ia_lower = inline_after.lower()
                    for node in all_nodes:
                        if node.id in used_node_ids:
                            continue
                        node_text = node.text or ""
                        pos = node_text.lower().find(ia_lower)
                        if pos >= 0:
                            before = node_text[:pos].strip()
                            if before and len(before) < 400:
                                results.append(ResolutionResult(
                                    occurrence_id=occ_id, placeholder=placeholder,
                                    generated_node_id=node.id,
                                    matched_text=before,
                                    match_confidence=0.85,
                                    resolution_status="RESOLVED",
                                    score_breakdown={"method": "inline_after"}
                                ))
                                used_node_ids.add(node.id)
                                resolved = True
                                matched_count += 1
                                break

            # ==============================================
            # LEVEL 3: LABEL SEARCH — Find label:value where label matches ph_name
            # ==============================================
            if not resolved:
                for node in all_nodes:
                    if node.id in used_node_ids:
                        continue
                    node_text = node.text or ""
                    if contains_placeholder(node_text):
                        continue
                    
                    colon_idx = node_text.find(":")
                    if colon_idx <= 0:
                        continue
                    
                    before_colon = node_text[:colon_idx].lower().strip()
                    after_colon = node_text[colon_idx + 1:].strip()
                    
                    # Check various match strategies
                    matched = False
                    val = None
                    
                    # Strategy A: Exact match
                    if ph_normalized == before_colon:
                        val = after_colon
                        matched = True
                    # Strategy B: ph_normalized in before_colon
                    elif ph_normalized in before_colon:
                        val = after_colon
                        matched = True
                    # Strategy C: Any significant word from ph_name in before_colon
                    else:
                        ph_words = set(ph_normalized.split())
                        label_words = set(before_colon.split())
                        overlap = ph_words & label_words
                        # Filter stopwords
                        stopwords = {"the", "and", "for", "with", "study", "of", "in", "to", "a", "an", "by", "on", "at", "is", "are", "be", "will", "not", "or", "as", "but", "if", "no", "each", "all", "any", "per", "its", "may", "via", "vs", "eg", "ie"}
                        significant_overlap = overlap - stopwords
                        if len(significant_overlap) >= 2:
                            val = after_colon
                            matched = True
                    
                    if matched and val:
                        for sep in [" / ", "  ", "\t"]:
                            if sep in val:
                                val = val.split(sep)[0].strip()
                        if val and len(val) < 400 and not contains_placeholder(val):
                            results.append(ResolutionResult(
                                occurrence_id=occ_id, placeholder=placeholder,
                                generated_node_id=node.id,
                                matched_text=val,
                                match_confidence=0.85,
                                resolution_status="RESOLVED",
                                score_breakdown={"method": "label_match"}
                            ))
                            used_node_ids.add(node.id)
                            resolved = True
                            matched_count += 1
                            break

            # ==============================================
            # LEVEL 4: TEXT SEARCH — Find placeholder name text anywhere in node
            # ==============================================
            if not resolved:
                for node in all_nodes:
                    if node.id in used_node_ids:
                        continue
                    node_text = node.text or ""
                    if contains_placeholder(node_text):
                        continue
                    
                    ntl = node_text.lower()
                    if ph_normalized in ntl:
                        # Found it. Try to extract a colon value if exists
                        val = extract_clean_value(node_text)
                        results.append(ResolutionResult(
                            occurrence_id=occ_id, placeholder=placeholder,
                            generated_node_id=node.id,
                            matched_text=val or node_text,
                            match_confidence=0.75,
                            resolution_status="RESOLVED",
                            score_breakdown={"method": "text_search"}
                        ))
                        used_node_ids.add(node.id)
                        resolved = True
                        matched_count += 1
                        break

            # ==============================================
            # LEVEL 5: WORD SEARCH — Find significant words from ph_name in node text
            # ==============================================
            if not resolved:
                # Get significant words
                stopwords = {"the", "and", "for", "with", "study", "of", "in", "to", "a", "an", 
                             "by", "on", "at", "is", "are", "be", "will", "not", "or", "as", "but",
                             "if", "no", "each", "all", "any", "per", "its", "may", "via", "vs",
                             "eg", "ie", "lay", "brief", "note", "based", "data", "also", "into",
                             "than", "has", "had", "was", "were", "been", "being", "have", "does"}
                ph_words = [w for w in ph_normalized.split() 
                           if len(w) > 3 and w not in stopwords]
                
                if ph_words:
                    best_node = None
                    best_count = 0
                    for node in all_nodes:
                        if node.id in used_node_ids:
                            continue
                        node_text = node.text or ""
                        if contains_placeholder(node_text):
                            continue
                        ntl = node_text.lower()
                        count = sum(1 for w in ph_words if w in ntl)
                        if count > best_count:
                            best_count = count
                            best_node = node
                    
                    if best_node and best_count >= max(1, len(ph_words) // 2):
                        node_text = best_node.text or ""
                        val = extract_clean_value(node_text)
                        results.append(ResolutionResult(
                            occurrence_id=occ_id, placeholder=placeholder,
                            generated_node_id=best_node.id,
                            matched_text=val or node_text,
                            match_confidence=0.65,
                            resolution_status="RESOLVED",
                            score_breakdown={"method": "word_search"}
                        ))
                        used_node_ids.add(best_node.id)
                        resolved = True
                        matched_count += 1

            # ---------------------------------------------------
            # LEVEL 5: Paragraph position fallback (lowest confidence)
            # Match by same section + paragraph_index
            # ---------------------------------------------------
            if not resolved:
                section = occurrence.get("section", "")
                paragraph_index = occurrence.get("paragraph_index")
                for node in all_nodes:
                    if node.id in used_node_ids:
                        continue
                    loc = node.location
                    if loc and loc.section == section and loc.paragraph_index == paragraph_index:
                        node_text = node.text or ""
                        if not contains_placeholder(node_text):
                            results.append(ResolutionResult(
                                occurrence_id=occ_id, placeholder=placeholder,
                                generated_node_id=node.id,
                                matched_text=node_text,
                                match_confidence=0.55,
                                resolution_status="RESOLVED",
                                score_breakdown={"method": "paragraph_position"}
                            ))
                            # Don't mark node as used for same paragraph position
                            # This allows multiple placeholders to share the same node
                            resolved = True
                            break

            if not resolved:
                # Also try table_path match
                table_path = occurrence.get("table_path")
                if table_path:
                    for node in all_nodes:
                        if node.id in used_node_ids:
                            continue
                        loc = node.location
                        if loc and loc.table_path == table_path:
                            node_text = node.text or ""
                            if not contains_placeholder(node_text):
                                results.append(ResolutionResult(
                                    occurrence_id=occ_id, placeholder=placeholder,
                                    generated_node_id=node.id,
                                    matched_text=node_text,
                                    match_confidence=0.5,
                                    resolution_status="RESOLVED",
                                    score_breakdown={"method": "table_path_position"}
                                ))
                                used_node_ids.add(node.id)
                                resolved = True
                                break

            if not resolved:
                unresolved_count += 1
                results.append(ResolutionResult(
                    occurrence_id=occ_id, placeholder=placeholder,
                    generated_node_id=None, match_confidence=0.0,
                    resolution_status="UNRESOLVED"
                ))

        return results
