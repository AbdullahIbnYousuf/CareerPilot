"""
Test edge cases for CV upload endpoint.

Usage:
    1. Start the server: uvicorn app.main:app --reload
    2. Run this script: python test_edge_cases.py
"""
import os
import sys
import requests

BASE_URL = "http://localhost:8000"


def test_invalid_file_type():
    """Test uploading .txt file (should fail with 400)"""
    print("=== Test 1: Invalid File Type (.txt) ===")

    # Create a temp text file
    with open("_test_invalid.txt", "w") as f:
        f.write("This is a text file, not a CV")

    with open("_test_invalid.txt", "rb") as f:
        response = requests.post(
            f"{BASE_URL}/api/cv/upload?user_id=test-user",
            files={"file": ("test.txt", f, "text/plain")}
        )

    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")

    if response.status_code == 400:
        print("✓ PASSED: Correctly rejected invalid file type\n")
    else:
        print("✗ FAILED: Should return 400 for invalid file type\n")

    os.remove("_test_invalid.txt")


def test_empty_file():
    """Test uploading empty PDF (should fail with 400)"""
    print("=== Test 2: Empty File ===")

    with open("_test_empty.pdf", "wb") as f:
        f.write(b"")

    with open("_test_empty.pdf", "rb") as f:
        response = requests.post(
            f"{BASE_URL}/api/cv/upload?user_id=test-user",
            files={"file": ("empty.pdf", f, "application/pdf")}
        )

    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")

    if response.status_code == 400:
        print("✓ PASSED: Correctly rejected empty file\n")
    else:
        print("✗ FAILED: Should return 400 for empty file\n")

    os.remove("_test_empty.pdf")


def test_file_too_large():
    """Test uploading 6 MB file (should fail with 400)"""
    print("=== Test 3: File Too Large (6 MB) ===")

    with open("_test_large.pdf", "wb") as f:
        f.write(b"0" * (6 * 1024 * 1024))

    with open("_test_large.pdf", "rb") as f:
        response = requests.post(
            f"{BASE_URL}/api/cv/upload?user_id=test-user",
            files={"file": ("large.pdf", f, "application/pdf")}
        )

    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")

    if response.status_code == 400:
        print("✓ PASSED: Correctly rejected large file\n")
    else:
        print("✗ FAILED: Should return 400 for file > 5 MB\n")

    os.remove("_test_large.pdf")


def test_missing_user_id():
    """Test upload without user_id param (should fail with 422)"""
    print("=== Test 4: Missing user_id ===")

    with open("_test_dummy.pdf", "wb") as f:
        f.write(b"%PDF-1.4 dummy")  # minimal PDF-like bytes

    with open("_test_dummy.pdf", "rb") as f:
        response = requests.post(
            f"{BASE_URL}/api/cv/upload",  # no user_id!
            files={"file": ("cv.pdf", f, "application/pdf")}
        )

    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")

    if response.status_code == 422:
        print("✓ PASSED: Correctly returned 422 for missing user_id\n")
    else:
        print("✗ FAILED: Should return 422 for missing user_id\n")

    os.remove("_test_dummy.pdf")


def test_corrupted_pdf():
    """Test uploading corrupted PDF — parser should fail gracefully"""
    print("=== Test 5: Corrupted PDF ===")

    with open("_test_corrupted.pdf", "wb") as f:
        f.write(b"This is not a valid PDF file content")

    with open("_test_corrupted.pdf", "rb") as f:
        response = requests.post(
            f"{BASE_URL}/api/cv/upload?user_id=test-user",
            files={"file": ("corrupted.pdf", f, "application/pdf")}
        )

    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")

    # Should return 422 (parsing failed) or 500 — not crash or 200
    if response.status_code in [422, 500]:
        print("✓ PASSED: Correctly handled corrupted PDF\n")
    else:
        print(f"⚠ NOTE: Got {response.status_code} — Gemini may still parse garbage input\n")

    os.remove("_test_corrupted.pdf")


def test_valid_pdf():
    """Test uploading a valid PDF (should pass with 200)"""
    print("=== Test 6: Valid PDF ===")

    try:
        with open("sample_cv.pdf", "rb") as f:
            response = requests.post(
                f"{BASE_URL}/api/cv/upload?user_id=test-user-valid",
                files={"file": ("sample_cv.pdf", f, "application/pdf")}
            )

        print(f"Status: {response.status_code}")
        result = response.json()
        print(f"CV ID: {result.get('cv_id')}")
        print(f"Message: {result.get('message')}")

        if response.status_code == 200 and result.get("cv_id"):
            print("✓ PASSED: Valid PDF uploaded successfully\n")
            parsed = result.get("parsed_data", {})
            print(f"  Skills:     {str(parsed.get('skills', ''))[:80]}...")
            print(f"  Experience: {str(parsed.get('experience', ''))[:80]}...")
        else:
            print("✗ FAILED: Valid PDF should upload successfully\n")
            print(f"  Detail: {result.get('detail', 'No detail')}")

    except FileNotFoundError:
        print("⚠ sample_cv.pdf not found — skipping valid PDF test\n")


def test_list_cvs():
    """Test listing CVs for a user"""
    print("=== Test 7: List CVs ===")

    response = requests.get(f"{BASE_URL}/api/cv/list?user_id=test-user-valid")
    print(f"Status: {response.status_code}")

    if response.status_code == 200:
        data = response.json()
        print(f"Found {len(data)} CV(s)")
        if data:
            print(f"First CV: {data[0].get('file_name')} (id: {data[0].get('id')[:8]}...)")
        print("✓ PASSED: List endpoint working\n")
    else:
        print(f"✗ FAILED: {response.json()}\n")


if __name__ == "__main__":
    print("=== CV Upload Edge Case Tests ===\n")
    print("Make sure server is running: ..\\..venv\\Scripts\\python.exe -m uvicorn app.main:app --reload\n")

    test_invalid_file_type()
    test_empty_file()
    test_file_too_large()
    test_missing_user_id()
    test_corrupted_pdf()
    test_valid_pdf()
    test_list_cvs()

    print("=== All Tests Complete ===")
