"""
Chunker unit test - no API keys required.
Run: python test_chunker.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.chunker import chunk_cv_sections


def test_chunker():
    """Test section-aware chunking with a full mock parsed CV."""
    parsed = {
        "skills": "Python, FastAPI, PostgreSQL",
        "experience": "Backend Developer at Example Co (2022-2024)",
        "education": "BSc in Computer Science, BUET (2018-2022)",
        "projects": "",  # empty — should be skipped
    }

    chunks = chunk_cv_sections(parsed, cv_id="cv-test-id", user_id="user-test-id")

    assert len(chunks) == 3, f"Expected 3 chunks, got {len(chunks)}"
    sections = {c["section"] for c in chunks}
    assert sections == {"skills", "experience", "education"}, f"Unexpected sections: {sections}"
    assert all(c["content"] for c in chunks), "All chunks must have non-empty content"
    assert all(c["cv_id"] == "cv-test-id" for c in chunks), "cv_id must be set on all chunks"
    assert all(c["user_id"] == "user-test-id" for c in chunks), "user_id must be set on all chunks"

    print("✓ Chunker test PASSED")
    for c in chunks:
        print(f"  [{c['section']}] {c['content'][:60]}...")


def test_all_empty():
    """All-empty parsed CV should produce 0 chunks."""
    parsed = {"skills": "", "experience": "", "education": "", "projects": ""}
    chunks = chunk_cv_sections(parsed, cv_id="cv-id", user_id="user-id")
    assert len(chunks) == 0, f"Expected 0 chunks for all-empty CV, got {len(chunks)}"
    print("✓ All-empty test PASSED — 0 chunks produced")


def test_section_labels():
    """Section labels must exactly match the DB constraint."""
    from services.chunker import ALLOWED_SECTIONS
    assert set(ALLOWED_SECTIONS) == {"skills", "experience", "education", "projects"}, \
        f"Wrong section labels: {ALLOWED_SECTIONS}"
    print("✓ Section label test PASSED")


if __name__ == "__main__":
    print("=== Chunker Unit Tests ===\n")
    test_chunker()
    test_all_empty()
    test_section_labels()
    print("\n=== All Chunker Tests PASSED ===")
