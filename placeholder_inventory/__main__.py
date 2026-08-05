"""
    python -m placeholder_inventory <template.docx> [-o output.xlsx]

Writes a QA workbook next to the template unless -o says otherwise.
"""

import argparse
import sys
from pathlib import Path

from .classify import classify
from .extractor import extract
from .workbook import write, write_reference


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="placeholder_inventory")
    parser.add_argument("template", help="path to the .docx template")
    parser.add_argument("-o", "--output", help="output .xlsx path")
    parser.add_argument(
        "--list", action="store_true",
        help="print the placeholders instead of writing a workbook",
    )
    parser.add_argument(
        "--json", action="store_true", dest="as_json",
        help="print the placeholders as JSON (used by the web runner to check "
             "a generated document for anything left unreplaced)",
    )
    parser.add_argument(
        "--reference", action="store_true",
        help="write a reference draft (QA fills in the expected text) "
             "instead of a QA-format workbook",
    )
    args = parser.parse_args(argv)

    template = Path(args.template)
    if not template.is_file():
        print(f"Not a file: {template}", file=sys.stderr)
        return 2

    placeholders = extract(str(template))

    if args.as_json:
        import json
        json.dump(
            [
                {
                    "name": p.name,
                    "type": classify(p.name, p.structure),
                    "count": p.count,
                    "context": p.context,
                }
                for p in placeholders
            ],
            sys.stdout,
        )
        return 0

    if args.list:
        for p in placeholders:
            print(f"{classify(p.name, p.structure):<10} x{p.count:<3} {p.name}")
        print(f"\n{len(placeholders)} unique, {sum(p.count for p in placeholders)} occurrences")
        return 0

    if args.reference:
        output = Path(args.output) if args.output else template.with_suffix(".reference.xlsx")
        write_reference(placeholders, str(output))
    else:
        output = Path(args.output) if args.output else template.with_suffix(".placeholders.xlsx")
        write(placeholders, template.name, str(output))

    print(f"{len(placeholders)} placeholders -> {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
