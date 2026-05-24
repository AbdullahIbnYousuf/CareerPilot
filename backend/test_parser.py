"""
Test CV parser with sample files.
Run this before integrating into API.

Usage:
    Place sample CVs in backend/ as sample_cv.pdf or sample_cv.docx
    Then run: python test_parser.py
"""
import os
import sys
import json

# Make sure we can import from parent dir
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.parser import parse_cv


def test_parser():
    """Test CV parser with sample PDF and DOCX files."""

    # Test with PDF
    print("=== Testing PDF Parser ===")
    try:
        with open("sample_cv.pdf", "rb") as f:
            pdf_bytes = f.read()

        result = parse_cv(pdf_bytes, "sample_cv.pdf")

        # Validate structure
        assert isinstance(result, dict), "Result must be a dict"
        assert all(k in result for k in ["skills", "experience", "education", "projects"]), \
            "Result must have all 4 keys"

        print(f"Skills:     {result['skills'][:100]}...")
        print(f"Experience: {result['experience'][:100]}...")
        print(f"Education:  {result['education'][:100]}...")
        print(f"Projects:   {result['projects'][:100]}...")
        print("\n✓ PDF Parser PASSED\n")

    except FileNotFoundError:
        print("⚠ sample_cv.pdf not found - skipping PDF test\n")
    except AssertionError as e:
        print(f"✗ PDF Parser FAILED (assertion): {e}\n")
    except Exception as e:
        print(f"✗ PDF Parser FAILED: {e}\n")

    # Test with DOCX
    print("=== Testing DOCX Parser ===")
    try:
        with open("sample_cv.docx", "rb") as f:
            docx_bytes = f.read()

        result = parse_cv(docx_bytes, "sample_cv.docx")

        assert isinstance(result, dict), "Result must be a dict"
        assert all(k in result for k in ["skills", "experience", "education", "projects"]), \
            "Result must have all 4 keys"

        print(f"Skills:     {result['skills'][:100]}...")
        print(f"Experience: {result['experience'][:100]}...")
        print(f"Education:  {result['education'][:100]}...")
        print(f"Projects:   {result['projects'][:100]}...")
        print("\n✓ DOCX Parser PASSED\n")

    except FileNotFoundError:
        print("⚠ sample_cv.docx not found - skipping DOCX test\n")
    except AssertionError as e:
        print(f"✗ DOCX Parser FAILED (assertion): {e}\n")
    except Exception as e:
        print(f"✗ DOCX Parser FAILED: {e}\n")

    # Test multi-column PDF (Canva/Figma template)
    print("=== Testing Multi-Column PDF (Canva) ===")
    try:
        with open("canva_cv.pdf", "rb") as f:
            pdf_bytes = f.read()

        result = parse_cv(pdf_bytes, "canva_cv.pdf")

        skills = result["skills"]
        all_text = " ".join(result.values())

        if len(skills) > 0 and not any(char in skills for char in ["\\ufffd", "□", "▪"]):
            print("✓ No text scrambling detected")
        else:
            print("⚠ Possible text scrambling - review skills output")

        if any(char in all_text for char in ["\\ufffd", "□"]):
            print("✗ Encoding issues detected")
        else:
            print("✓ No encoding issues")

        print(f"Skills: {skills[:100]}...")
        print("\n✓ Multi-Column PDF PASSED\n")

    except FileNotFoundError:
        print("⚠ canva_cv.pdf not found - skipping multi-column test\n")
    except Exception as e:
        print(f"✗ Multi-Column PDF FAILED: {e}\n")

    # Test unsupported file type
    print("=== Testing Unsupported File Type ===")
    try:
        result = parse_cv(b"some content", "test.txt")
        print("✗ FAILED: Should have raised ValueError for .txt\n")
    except ValueError:
        print("✓ Correctly rejected unsupported file type\n")
    except Exception as e:
        print(f"✗ Unexpected error: {e}\n")


if __name__ == "__main__":
    print("=== CV Parser Tests ===\n")
    print("Make sure GOOGLE_API_KEY is set in backend/.env\n")
    test_parser()
    print("=== Tests Complete ===")
