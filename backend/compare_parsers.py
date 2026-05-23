"""
Compare CV parsing quality across different file formats.

Usage:
    1. Place CVs in backend/: cv_single_column.pdf, cv_canva_template.pdf, cv_word_doc.docx
    2. Start the server: uvicorn app.main:app --reload
    3. Run: python compare_parsers.py
"""
import requests
import json

BASE_URL = "http://localhost:8000"


def upload_and_analyze(filename: str, user_id: str) -> None:
    """Upload a CV and analyze the parsed data quality."""
    print(f"\n=== Analyzing {filename} ===")

    try:
        with open(filename, "rb") as f:
            response = requests.post(
                f"{BASE_URL}/api/cv/upload?user_id={user_id}",
                files={"file": (filename, f)}
            )

        if response.status_code != 200:
            print(f"✗ Upload failed ({response.status_code}): {response.json().get('detail', 'unknown error')}")
            return

        result = response.json()
        parsed = result["parsed_data"]

        # Section lengths
        print(f"\nSection lengths:")
        print(f"  Skills:     {len(parsed['skills'])} chars")
        print(f"  Experience: {len(parsed['experience'])} chars")
        print(f"  Education:  {len(parsed['education'])} chars")
        print(f"  Projects:   {len(parsed['projects'])} chars")

        # Empty sections check
        empty_sections = [k for k, v in parsed.items() if not v.strip()]
        if empty_sections:
            print(f"⚠ Empty sections: {', '.join(empty_sections)}")
        else:
            print("✓ All sections populated")

        # Encoding issues check
        all_text = " ".join(parsed.values())
        encoding_issues = [char for char in ["\ufffd", "□", "▪"] if char in all_text]
        if encoding_issues:
            print(f"✗ Encoding issues detected: {encoding_issues}")
        else:
            print("✓ No encoding issues")

        # Preview
        print(f"\nSkills preview:     {parsed['skills'][:100]}...")
        print(f"Experience preview: {parsed['experience'][:100]}...")

        # CV ID
        print(f"\nCV ID: {result['cv_id']}")

    except FileNotFoundError:
        print(f"⚠ {filename} not found — skipping")
    except Exception as e:
        print(f"✗ Error: {e}")


def check_health():
    """Verify server is running before tests."""
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=3)
        if response.status_code == 200:
            print("✓ Server is running\n")
            return True
        else:
            print(f"✗ Server returned {response.status_code}\n")
            return False
    except requests.ConnectionError:
        print("✗ Server not reachable — make sure it's running\n")
        return False


if __name__ == "__main__":
    print("=== CV Parsing Quality Comparison ===\n")

    if not check_health():
        print("Start server first: ..\\..venv\\Scripts\\python.exe -m uvicorn app.main:app --reload")
        exit(1)

    # Test all 3 formats
    upload_and_analyze("cv_single_column.pdf", "test-single")
    upload_and_analyze("cv_canva_template.pdf", "test-canva")
    upload_and_analyze("cv_word_doc.docx", "test-docx")

    # Also test with any sample_cv files present
    import os
    if os.path.exists("sample_cv.pdf"):
        upload_and_analyze("sample_cv.pdf", "test-sample-pdf")
    if os.path.exists("sample_cv.docx"):
        upload_and_analyze("sample_cv.docx", "test-sample-docx")

    print("\n=== Comparison Complete ===")
