from parser.docx_extractor import DocxExtractor
from parser.xml_parser import (
    parse_document_xml,
    parse_headers,
    parse_footers,
    parse_styles,
    parse_numbering,
    get_paragraphs,
    get_tables,
    get_rows,
    get_cells,
    extract_text_from_paragraph
)


DOCX_PATH = r"D:\SmarterCodes\automation-validation-tests\benchmarking_automation\tests\sample_template.docx"


def print_paragraphs(document_xml):

    print("\n========== PARAGRAPHS ==========\n")

    paragraphs = get_paragraphs(document_xml.tree)

    print(f"Total Paragraphs: {len(paragraphs)}\n")

    for index, paragraph in enumerate(paragraphs):

        text = extract_text_from_paragraph(paragraph)

        if text.strip():

            print(f"P{index + 1}: {text}")


def print_tables(document_xml):

    print("\n========== TABLES ==========\n")

    tables = get_tables(document_xml.tree)

    print(f"Total Tables: {len(tables)}\n")

    for t_index, table in enumerate(tables):

        print(f"TABLE {t_index + 1}")

        rows = get_rows(table)

        for r_index, row in enumerate(rows):

            cells = get_cells(row)

            for c_index, cell in enumerate(cells):

                paragraphs = get_paragraphs(cell)

                cell_text = []

                for paragraph in paragraphs:

                    text = extract_text_from_paragraph(paragraph)

                    if text.strip():
                        cell_text.append(text)

                joined_text = " | ".join(cell_text)

                print(
                    f"Row {r_index + 1}, "
                    f"Cell {c_index + 1}: "
                    f"{joined_text}"
                )

        print()


def print_headers(headers):

    print("\n========== HEADERS ==========\n")

    print(f"Total Headers: {len(headers)}\n")

    for h_index, header in enumerate(headers):

        paragraphs = get_paragraphs(header.tree)

        print(f"HEADER {h_index + 1}")

        for paragraph in paragraphs:

            text = extract_text_from_paragraph(paragraph)

            if text.strip():
                print(text)

        print()


def print_footers(footers):

    print("\n========== FOOTERS ==========\n")

    print(f"Total Footers: {len(footers)}\n")

    for f_index, footer in enumerate(footers):

        paragraphs = get_paragraphs(footer.tree)

        print(f"FOOTER {f_index + 1}")

        for paragraph in paragraphs:

            text = extract_text_from_paragraph(paragraph)

            if text.strip():
                print(text)

        print()


def main():

    print("\n========== START ==========\n")

    extractor = DocxExtractor(DOCX_PATH)

    print("Loading DOCX...\n")

    extracted_parts = extractor.extract_all_xml_parts()

    print("XML Parts Extracted:\n")

    for key in extracted_parts.keys():
        print(key)

    # Parse XML
    document_xml = parse_document_xml(extracted_parts)

    headers = parse_headers(extracted_parts)

    footers = parse_footers(extracted_parts)

    styles = parse_styles(extracted_parts)

    numbering = parse_numbering(extracted_parts)

    print("\n========== XML PARSED ==========\n")

    print(f"Styles Loaded: {styles is not None}")

    print(f"Numbering Loaded: {numbering is not None}")

    print_paragraphs(document_xml)

    print_tables(document_xml)

    print_headers(headers)

    print_footers(footers)

    print("\n========== SUCCESS ==========\n")


if __name__ == "__main__":
    main()