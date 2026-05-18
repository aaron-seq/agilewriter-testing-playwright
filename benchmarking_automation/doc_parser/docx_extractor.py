from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List
from zipfile import BadZipFile, ZipFile
from doc_parser.xml_models import XmlPart


# =========================================================
# Custom Exceptions
# =========================================================

class DocxExtractorError(Exception):
    """Base exception for DOCX extraction errors."""


class InvalidDocxError(DocxExtractorError):
    """Raised when file is not a valid DOCX/ZIP."""


class MissingXmlPartError(DocxExtractorError):
    """Raised when a required XML part is missing."""



# =========================================================
# DOCX Extractor
# =========================================================

class DocxExtractor:
    """
    Low-level DOCX XML extractor.

    Responsibilities:
    - Open DOCX as ZIP archive
    - Read internal XML files
    - Extract required XML parts
    - Handle invalid/corrupted DOCX safely
    """

    REQUIRED_FILES = [
        "word/document.xml",
    ]

    OPTIONAL_SINGLE_FILES = [
        "word/styles.xml",
        "word/numbering.xml",
    ]

    HEADER_PREFIX = "word/header"
    FOOTER_PREFIX = "word/footer"

    XML_EXTENSION = ".xml"

    def __init__(self, file_path: str):
        self.file_path = Path(file_path)

        self._validate_input_file()

    # =====================================================
    # Public API
    # =====================================================

    def list_files(self) -> List[str]:
        """
        Return all internal file paths inside DOCX archive.
        """

        try:
            with ZipFile(self.file_path, "r") as zip_ref:
                return zip_ref.namelist()

        except BadZipFile as exc:
            raise InvalidDocxError(
                f"Invalid DOCX file: {self.file_path}"
            ) from exc

    def read_xml_file(self, internal_path: str) -> bytes:
        """
        Read a single XML file from DOCX archive.
        """

        try:
            with ZipFile(self.file_path, "r") as zip_ref:

                if internal_path not in zip_ref.namelist():
                    raise MissingXmlPartError(
                        f"Missing XML part: {internal_path}"
                    )

                return zip_ref.read(internal_path)

        except BadZipFile as exc:
            raise InvalidDocxError(
                f"Invalid DOCX file: {self.file_path}"
            ) from exc

    def extract_all_xml_parts(self) -> Dict[str, List[XmlPart] | XmlPart | None]:
        """
        Extract all required XML parts.

        Returns:
        {
            "document": XmlPart,
            "headers": [XmlPart, ...],
            "footers": [XmlPart, ...],
            "styles": XmlPart | None,
            "numbering": XmlPart | None
        }
        """

        try:
            with ZipFile(self.file_path, "r") as zip_ref:

                all_files = zip_ref.namelist()

                # -----------------------------------------
                # Validate required XML files
                # -----------------------------------------

                for required_file in self.REQUIRED_FILES:
                    if required_file not in all_files:
                        raise MissingXmlPartError(
                            f"Required XML part missing: {required_file}"
                        )

                # -----------------------------------------
                # Extract main document.xml
                # -----------------------------------------

                document_xml = XmlPart(
                    path="word/document.xml",
                    content=zip_ref.read("word/document.xml")
                )

                # -----------------------------------------
                # Extract headers
                # -----------------------------------------

                headers = self._extract_prefixed_xml_parts(
                    zip_ref=zip_ref,
                    all_files=all_files,
                    prefix=self.HEADER_PREFIX
                )

                # -----------------------------------------
                # Extract footers
                # -----------------------------------------

                footers = self._extract_prefixed_xml_parts(
                    zip_ref=zip_ref,
                    all_files=all_files,
                    prefix=self.FOOTER_PREFIX
                )

                # -----------------------------------------
                # Extract optional XML parts
                # -----------------------------------------

                styles = self._extract_optional_file(
                    zip_ref,
                    all_files,
                    "word/styles.xml"
                )

                numbering = self._extract_optional_file(
                    zip_ref,
                    all_files,
                    "word/numbering.xml"
                )

                return {
                    "document": document_xml,
                    "headers": headers,
                    "footers": footers,
                    "styles": styles,
                    "numbering": numbering,
                }

        except BadZipFile as exc:
            raise InvalidDocxError(
                f"Invalid DOCX file: {self.file_path}"
            ) from exc


    # =====================================================
    # Internal Helpers
    # =====================================================

    def _validate_input_file(self) -> None:
        """
        Validate input DOCX file.
        """

        if not self.file_path.exists():
            raise FileNotFoundError(
                f"File does not exist: {self.file_path}"
            )

        if not self.file_path.is_file():
            raise ValueError(
                f"Path is not a file: {self.file_path}"
            )

        if self.file_path.suffix.lower() != ".docx":
            raise ValueError(
                f"Expected .docx file, got: {self.file_path.suffix}"
            )

    def _extract_prefixed_xml_parts(
        self,
        zip_ref: ZipFile,
        all_files: List[str],
        prefix: str
    ) -> List[XmlPart]:
        """
        Extract XML files matching prefix.

        Example:
        - word/header1.xml
        - word/header2.xml
        """

        matched_files = sorted([
            file_path
            for file_path in all_files
            if file_path.startswith(prefix)
            and file_path.endswith(self.XML_EXTENSION)
        ])

        extracted_parts = []

        for file_path in matched_files:
            extracted_parts.append(
                XmlPart(
                    path=file_path,
                    content=zip_ref.read(file_path)
                )
            )

        return extracted_parts

    def _extract_optional_file(
        self,
        zip_ref: ZipFile,
        all_files: List[str],
        file_path: str
    ) -> XmlPart | None:
        """
        Extract optional XML file if present.
        """

        if file_path not in all_files:
            return None

        return XmlPart(
            path=file_path,
            content=zip_ref.read(file_path)
        )



# =========================================================
# Example Usage
# =========================================================

if __name__ == "__main__":

    extractor = DocxExtractor(
    r"D:\SmarterCodes\automation-validation-tests\benchmarking_automation\tests\sample_template.docx"
)

    print("\n--- Internal DOCX Files ---")
    for file_name in extractor.list_files():
        print(file_name)

    extracted = extractor.extract_all_xml_parts()

    print("\n--- Extraction Summary ---")

    print(f"Document XML: {extracted['document'].path}")

    print("\nHeaders:")
    for header in extracted["headers"]:
        print(f" - {header.path}")

    print("\nFooters:")
    for footer in extracted["footers"]:
        print(f" - {footer.path}")

    if extracted["styles"]:
        print(f"\nStyles XML: {extracted['styles'].path}")

    if extracted["numbering"]:
        print(f"Numbering XML: {extracted['numbering'].path}")