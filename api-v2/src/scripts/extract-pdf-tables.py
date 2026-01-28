#!/usr/bin/env python3
"""
PDF Table Extraction Script using pdfplumber
Extracts tables from pharmaceutical invoices for structured data processing
"""

import sys
import json
import pdfplumber

def extract_tables_from_pdf(pdf_path):
    """
    Extract tables from a PDF file using pdfplumber

    Args:
        pdf_path: Path to the PDF file

    Returns:
        JSON string with extracted tables and metadata
    """
    try:
        result = {
            "success": True,
            "tables": [],
            "text": "",
            "pages": 0,
            "error": None
        }

        with pdfplumber.open(pdf_path) as pdf:
            result["pages"] = len(pdf.pages)

            # Extract text from all pages
            full_text = ""
            for page in pdf.pages:
                full_text += page.extract_text() or ""
            result["text"] = full_text

            # Extract tables from all pages
            for page_num, page in enumerate(pdf.pages):
                tables = page.extract_tables()

                for table_num, table in enumerate(tables):
                    if table and len(table) > 0:
                        # Clean the table data - remove None values
                        cleaned_table = []
                        for row in table:
                            cleaned_row = [str(cell).strip() if cell is not None else "" for cell in row]
                            cleaned_table.append(cleaned_row)

                        result["tables"].append({
                            "page": page_num + 1,
                            "table_index": table_num,
                            "rows": len(cleaned_table),
                            "columns": len(cleaned_table[0]) if cleaned_table else 0,
                            "data": cleaned_table
                        })

        return json.dumps(result, indent=2)

    except Exception as e:
        error_result = {
            "success": False,
            "tables": [],
            "text": "",
            "pages": 0,
            "error": str(e)
        }
        return json.dumps(error_result, indent=2)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(json.dumps({
            "success": False,
            "error": "Usage: python extract-pdf-tables.py <pdf_path>"
        }))
        sys.exit(1)

    pdf_path = sys.argv[1]
    result = extract_tables_from_pdf(pdf_path)
    print(result)
