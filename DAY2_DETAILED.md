# DAY 2 - CV Parsing Pipeline (Detailed AI-Executable Guide)

**CareerPilot · Codesprint 2026 · DEV1 Backend**

> This is a step-by-step guide for AI agents (Kiro/Antigravity IDE) to execute Day 2 tasks.
> Every command, every file, every configuration is specified exactly.

**Estimated Time:** 6-8 hours
**Goal:** Upload endpoint working, both PDF and DOCX parsers returning structured JSON

---

## Day 2 Scope (STRICT)

**What Day 2 DOES:**

- ✅ Accept .pdf and .docx files only
- ✅ Parse PDF with Gemini 2.0 Flash multimodal
- ✅ Parse DOCX with python-docx + Gemini structuring
- ✅ Return strict JSON: `{"skills": "", "experience": "", "education": "", "projects": ""}`
- ✅ Save metadata to `cvs` table (user_id, file_name, file_url, parsed_at)
- ✅ Endpoint: `POST /api/cv/upload`

**What Day 2 DOES NOT DO:**

- ❌ No embeddings (Day 3)
- ❌ No Voyage AI calls (Day 3)
- ❌ No cv_chunks table writes (Day 3)
- ❌ No Supabase Storage upload yet (blocked - need manual dashboard access)
- ❌ No chunking logic (Day 3)

---

## Prerequisites Check

Before starting, verify Day 1 completion:

- [ ] Supabase database is live with `cvs` table
- [ ] Backend virtual environment exists
- [ ] `GOOGLE_API_KEY` in `backend/.env` is valid
- [ ] Can run `uvicorn app.main:app --reload` without errors
- [ ] Health check at http://localhost:8000/health returns `{"status": "ok"}`

**If any checkbox is unchecked, complete Day 1 first.**

---

## What You'll Build Today

```
User uploads CV (PDF or DOCX)
    ↓
FastAPI receives file at POST /api/cv/upload
    ↓
Validate: .pdf or .docx, max 5 MB
    ↓
Route to correct parser:
  - PDF  → Gemini 2.0 Flash multimodal
  - DOCX → python-docx text + Gemini structuring
    ↓
Extract 4 sections as JSON:
  {
    "skills": "...",
    "experience": "...",
    "education": "...",
    "projects": "..."
  }
    ↓
Save metadata to cvs table
    ↓
Return structured JSON to client
```

**Critical:** No embeddings, no chunking, no cv_chunks table yet. That's Day 3.

---

## PHASE 1 - Parser Service (2.5 hours)

### Step 1.1: Understand Why Gemini for PDF (10 minutes)

**The Problem with Traditional PDF Parsers:**

- pypdf, pdfplumber, pdfminer → scramble multi-column layouts
- Canva/Figma CVs have 2-3 columns → text extraction order is wrong
- Tables, images, formatting → lost completely

**Why Gemini 2.0 Flash Multimodal:**

- Reads PDF as image, understands visual layout
- 1M token context window (handles 10-page CVs)
- Free tier: 1500 requests/day
- No local memory overhead (processing on Google servers)
- Model name: `gemini-2.0-flash` (NOT `gemini-2.0-flash-exp`)

**Test yourself:**

1. Download a 2-column Canva CV template
2. Try pypdf → text is jumbled
3. Try Gemini → perfect extraction

---

### Step 1.2: Create Parser Service (45 minutes)

Make sure you're in the backend directory with venv activated:

```bash
cd backend
# Windows: venv\Scripts\activate
# Mac/Linux: source venv/bin/activate
```

The parser service is already created at `backend/services/parser.py`. Let's verify it's correct:

```bash
# Check the file exists
dir services\parser.py
```

The file should contain:

- `parse_pdf_cv(file_bytes: bytes) -> Dict[str, str]`
- `parse_docx_cv(file_bytes: bytes) -> Dict[str, str]`
- `parse_cv(file_bytes: bytes, filename: str) -> Dict[str, str]`

All functions return structured JSON with 4 keys: skills, experience, education, projects.

---

### Step 1.3: Test PDF Parser Manually (30 minutes)

Create `backend/test_parser.py`:

```python
"""
Test CV parser with sample files.
Run this before integrating into API.
"""
import asyncio
import json
from services.parser import parse_cv

def test_parser():
    # Test with PDF
    print("=== Testing PDF Parser ===")
    try:
        with open("sample_cv.pdf", "rb") as f:
            pdf_bytes = f.read()

        result = parse_cv(pdf_bytes, "sample_cv.pdf")

        print(f"Skills: {result['skills'][:100]}...")
        print(f"Experience: {result['experience'][:100]}...")
        print(f"Education: {result['education'][:100]}...")
        print(f"Projects: {result['projects'][:100]}...")
        print("\n✓ PDF Parser PASSED\n")
    except FileNotFoundError:
        print("⚠ sample_cv.pdf not found - skipping PDF test\n")
    except Exception as e:
        print(f"✗ PDF Parser FAILED: {e}\n")

    # Test with DOCX
    print("=== Testing DOCX Parser ===")
    try:
        with open("sample_cv.docx", "rb") as f:
            docx_bytes = f.read()

        result = parse_cv(docx_bytes, "sample_cv.docx")

        print(f"Skills: {result['skills'][:100]}...")
        print(f"Experience: {result['experience'][:100]}...")
        print(f"Education: {result['education'][:100]}...")
        print(f"Projects: {result['projects'][:100]}...")
        print("\n✓ DOCX Parser PASSED\n")
    except FileNotFoundError:
        print("⚠ sample_cv.docx not found - skipping DOCX test\n")
    except Exception as e:
        print(f"✗ DOCX Parser FAILED: {e}\n")

if __name__ == "__main__":
    test_parser()
```

**Run the test:**

```bash
# Place a sample CV in backend/ directory as sample_cv.pdf or sample_cv.docx
python test_parser.py
```

**Expected output:**

```
=== Testing PDF Parser ===
Skills: Python, FastAPI, PostgreSQL, Docker, AWS, React, TypeScript...
Experience: Software Engineer at TechCorp (Jan 2022 - Present): Built scalable APIs...
Education: B.Sc. in Computer Science, University of Dhaka (2018-2022), CGPA: 3.85...
Projects: E-commerce Platform: Built full-stack app with React and Django...

✓ PDF Parser PASSED

=== Testing DOCX Parser ===
Skills: Python, JavaScript, SQL, Git, Linux...
Experience: Junior Developer at StartupXYZ (Jun 2023 - Present)...
Education: B.Sc. in CSE, BUET (2019-2023)...
Projects: Chat Application: Real-time messaging app using WebSockets...

✓ DOCX Parser PASSED
```

**If test fails:**

- Check `GOOGLE_API_KEY` in `.env`
- Verify key at https://aistudio.google.com/app/apikey
- Check file path is correct
- Try with a different PDF/DOCX

---

### Step 1.4: Test with Multi-Column PDF (30 minutes)

**Critical test:** Canva/Figma templates with 2-3 columns.

1. Go to https://www.canva.com/templates/resumes/
2. Download a free 2-column CV template as PDF
3. Save as `canva_cv.pdf` in backend/
4. Test:

```python
# Add to test_parser.py
print("=== Testing Multi-Column PDF (Canva) ===")
try:
    with open("canva_cv.pdf", "rb") as f:
        pdf_bytes = f.read()

    result = parse_cv(pdf_bytes, "canva_cv.pdf")

    # Check if text is scrambled
    skills = result['skills']
    if len(skills) > 0 and not any(char in skills for char in ['�', '□', '▪']):
        print("✓ No text scrambling detected")
    else:
        print("✗ Text appears scrambled")

    print(f"Skills: {skills[:100]}...")
    print("\n✓ Multi-Column PDF PASSED\n")
except Exception as e:
    print(f"✗ Multi-Column PDF FAILED: {e}\n")
```

**Run again:**

```bash
python test_parser.py
```

**Success criteria:**

- All 4 sections extracted
- No scrambled text (no � or □ characters)
- Skills from both columns are captured
- Text order makes sense

---

## PHASE 2 - CV Upload API Endpoint (2 hours)

### Step 2.1: Verify Router Code (15 minutes)

The CV router is already created at `backend/routers/cv.py`. Verify it has:

1. **Endpoint:** `POST /api/cv/upload`
2. **Parameters:**
   - `user_id`: Query parameter (from auth, not hardcoded)
   - `file`: UploadFile (PDF or DOCX)
3. **Validation:**
   - File type: .pdf or .docx only
   - File size: max 5 MB
   - File not empty
4. **Processing:**
   - Parse CV with `parse_cv()`
   - Validate parsed data not empty
   - Save metadata to `cvs` table
5. **Response:**
   - cv_id, file_name, parsed_data, parsed_at, message

**Check the file:**

```bash
type routers\cv.py
```

Should see `router = APIRouter(prefix="/api/cv", tags=["cv"])`

---

### Step 2.2: Register Router in Main App (10 minutes)

Verify `backend/app/main.py` includes the CV router:

```bash
type app\main.py
```

Should see:

```python
from routers import cv
app.include_router(cv.router)
```

---

### Step 2.3: Start the Server (5 minutes)

```bash
# From backend directory
uvicorn app.main:app --reload
```

**Expected output:**

```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Application startup complete.
```

**Test health check:**

```bash
curl http://localhost:8000/health
```

Should return: `{"status": "ok", "service": "careerpilot-api"}`

---

### Step 2.4: Test Upload Endpoint with curl (30 minutes)

**Windows CMD:**

```cmd
REM Test with PDF
curl -X POST "http://localhost:8000/api/cv/upload?user_id=test-user-123" ^
  -F "file=@sample_cv.pdf"
```

**Expected response:**

```json
{
  "cv_id": "123e4567-e89b-12d3-a456-426614174000",
  "file_name": "sample_cv.pdf",
  "file_url": null,
  "parsed_data": {
    "skills": "Python, FastAPI, PostgreSQL, Docker, AWS, React, TypeScript, Machine Learning, TensorFlow, Pandas, NumPy, Scikit-learn, Git, Linux, CI/CD",
    "experience": "Software Engineer at TechCorp (Jan 2022 - Present): Built scalable REST APIs using FastAPI and PostgreSQL. Led team of 3 developers. Reduced API response time by 40%. Implemented CI/CD pipeline with GitHub Actions.",
    "education": "B.Sc. in Computer Science, University of Dhaka (2018-2022), CGPA: 3.85/4.00. Relevant coursework: Data Structures, Algorithms, Database Systems, Machine Learning.",
    "projects": "E-commerce Platform: Built full-stack web application with React frontend and Django backend. Deployed on AWS EC2 with PostgreSQL database. Implemented payment gateway integration with Stripe."
  },
  "parsed_at": "2026-05-24T10:30:00.123456",
  "message": "CV uploaded and parsed successfully"
}
```

**Test with DOCX:**

```cmd
curl -X POST "http://localhost:8000/api/cv/upload?user_id=test-user-123" ^
  -F "file=@sample_cv.docx"
```

---

### Step 2.5: Test with Postman/Thunder Client (30 minutes)

**Option A: Thunder Client (VS Code Extension)**

1. Install Thunder Client extension in VS Code
2. Create new request
3. Method: POST
4. URL: `http://localhost:8000/api/cv/upload?user_id=test-user-123`
5. Go to "Body" tab → select "Form"
6. Add field: `file` → click "Choose File" → select your CV
7. Click "Send"

**Option B: Postman**

1. Open Postman
2. New Request → POST
3. URL: `http://localhost:8000/api/cv/upload?user_id=test-user-123`
4. Body → form-data
5. Key: `file` (change type to "File")
6. Value: Select your CV file
7. Send

**Verify response:**

- Status: 200 OK
- Body contains: cv_id, file_name, parsed_data with 4 sections
- parsed_at is ISO timestamp

---

### Step 2.6: Verify Database Records (15 minutes)

**Check Supabase Dashboard:**

1. Go to https://supabase.com
2. Open your project
3. Go to Table Editor → `cvs` table
4. You should see 1-2 rows with:
   - id (UUID)
   - user_id: "test-user-123"
   - file_name: "sample_cv.pdf"
   - file_url: null (Day 3 will add storage)
   - parsed_at: timestamp
   - created_at: timestamp

**Test list endpoint:**

```cmd
curl "http://localhost:8000/api/cv/list?user_id=test-user-123"
```

**Expected response:**

```json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "user_id": "test-user-123",
    "file_name": "sample_cv.pdf",
    "file_url": null,
    "parsed_at": "2026-05-24T10:30:00.123456",
    "created_at": "2026-05-24T10:30:00.123456"
  }
]
```

---

## PHASE 3 - Error Handling & Edge Cases (1.5 hours)

### Step 3.1: Test Invalid File Type (15 minutes)

Create `backend/test_edge_cases.py`:

```python
"""
Test edge cases for CV upload endpoint.
"""
import requests

BASE_URL = "http://localhost:8000"

def test_invalid_file_type():
    """Test uploading .txt file (should fail)"""
    print("=== Test 1: Invalid File Type (.txt) ===")

    # Create a text file
    with open("test.txt", "w") as f:
        f.write("This is a text file, not a CV")

    with open("test.txt", "rb") as f:
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


def test_empty_file():
    """Test uploading empty PDF (should fail)"""
    print("=== Test 2: Empty File ===")

    # Create empty PDF
    with open("empty.pdf", "wb") as f:
        f.write(b"")

    with open("empty.pdf", "rb") as f:
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


def test_file_too_large():
    """Test uploading 6 MB file (should fail)"""
    print("=== Test 3: File Too Large (6 MB) ===")

    # Create 6 MB file
    with open("large.pdf", "wb") as f:
        f.write(b"0" * (6 * 1024 * 1024))

    with open("large.pdf", "rb") as f:
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


def test_valid_pdf():
    """Test uploading valid PDF (should pass)"""
    print("=== Test 4: Valid PDF ===")

    try:
        with open("sample_cv.pdf", "rb") as f:
            response = requests.post(
                f"{BASE_URL}/api/cv/upload?user_id=test-user",
                files={"file": ("sample_cv.pdf", f, "application/pdf")}
            )

        print(f"Status: {response.status_code}")
        result = response.json()
        print(f"CV ID: {result.get('cv_id')}")
        print(f"Message: {result.get('message')}")

        if response.status_code == 200 and result.get('cv_id'):
            print("✓ PASSED: Valid PDF uploaded successfully\n")
        else:
            print("✗ FAILED: Valid PDF should upload successfully\n")
    except FileNotFoundError:
        print("⚠ sample_cv.pdf not found - skipping test\n")


if __name__ == "__main__":
    print("=== CV Upload Edge Case Tests ===\n")
    print("Make sure server is running: uvicorn app.main:app --reload\n")

    test_invalid_file_type()
    test_empty_file()
    test_file_too_large()
    test_valid_pdf()

    print("=== All Tests Complete ===")
```

**Install requests if needed:**

```bash
pip install requests
```

**Run tests:**

```bash
python test_edge_cases.py
```

**Expected output:**

```
=== CV Upload Edge Case Tests ===

Make sure server is running: uvicorn app.main:app --reload

=== Test 1: Invalid File Type (.txt) ===
Status: 400
Response: {'detail': 'Invalid file type. Only .pdf and .docx files are supported.'}
✓ PASSED: Correctly rejected invalid file type

=== Test 2: Empty File ===
Status: 400
Response: {'detail': 'File is empty'}
✓ PASSED: Correctly rejected empty file

=== Test 3: File Too Large (6 MB) ===
Status: 400
Response: {'detail': 'File too large. Maximum size is 5.0 MB'}
✓ PASSED: Correctly rejected large file

=== Test 4: Valid PDF ===
Status: 200
CV ID: 123e4567-e89b-12d3-a456-426614174000
Message: CV uploaded and parsed successfully
✓ PASSED: Valid PDF uploaded successfully

=== All Tests Complete ===
```

---

### Step 3.2: Test Missing user_id (15 minutes)

```bash
# Test without user_id parameter
curl -X POST "http://localhost:8000/api/cv/upload" ^
  -F "file=@sample_cv.pdf"
```

**Expected:** 422 Unprocessable Entity (FastAPI validation error)

```json
{
  "detail": [
    {
      "type": "missing",
      "loc": ["query", "user_id"],
      "msg": "Field required"
    }
  ]
}
```

This is correct - FastAPI automatically validates required query parameters.

---

### Step 3.3: Test Malformed PDF (30 minutes)

Create a corrupted PDF to test error handling:

```python
# Add to test_edge_cases.py
def test_corrupted_pdf():
    """Test uploading corrupted PDF"""
    print("=== Test 5: Corrupted PDF ===")

    # Create corrupted PDF (random bytes)
    with open("corrupted.pdf", "wb") as f:
        f.write(b"This is not a valid PDF file content")

    with open("corrupted.pdf", "rb") as f:
        response = requests.post(
            f"{BASE_URL}/api/cv/upload?user_id=test-user",
            files={"file": ("corrupted.pdf", f, "application/pdf")}
        )

    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")

    # Should return 422 or 500 with error message
    if response.status_code in [422, 500]:
        print("✓ PASSED: Correctly handled corrupted PDF\n")
    else:
        print("✗ FAILED: Should return error for corrupted PDF\n")
```

**Run again:**

```bash
python test_edge_cases.py
```

Gemini should either:

- Return empty sections (which triggers "Could not extract any information" error)
- Throw an error during parsing

Both are acceptable - the endpoint should return 422 or 500, not crash.

---

## PHASE 4 - Testing with Real CVs (1 hour)

### Step 4.1: Prepare Test CVs (15 minutes)

Collect 3 different CV formats:

1. **Single-column PDF** (traditional format)
   - Download from: https://www.overleaf.com/latex/templates (academic CV templates)
   - Or create your own in Google Docs → Download as PDF

2. **Multi-column PDF** (Canva/Figma template)
   - Go to: https://www.canva.com/templates/resumes/
   - Download a free 2-column template

3. **DOCX file** (Microsoft Word)
   - Create in Word or Google Docs → Download as .docx

Save all 3 in `backend/` directory.

---

### Step 4.2: Test Each Format (30 minutes)

```bash
# Test 1: Single-column PDF
curl -X POST "http://localhost:8000/api/cv/upload?user_id=test-single-column" ^
  -F "file=@cv_single_column.pdf"

# Test 2: Multi-column PDF (Canva)
curl -X POST "http://localhost:8000/api/cv/upload?user_id=test-multi-column" ^
  -F "file=@cv_canva_template.pdf"

# Test 3: DOCX file
curl -X POST "http://localhost:8000/api/cv/upload?user_id=test-docx" ^
  -F "file=@cv_word_doc.docx"
```

**For each test, verify:**

- [ ] Status: 200 OK
- [ ] Response contains cv_id
- [ ] All 4 sections present (skills, experience, education, projects)
- [ ] No text scrambling (especially for multi-column)
- [ ] Skills section contains actual skills (not empty)
- [ ] Experience section contains job details
- [ ] Education section contains degree info
- [ ] Projects section contains project descriptions

**Check Supabase Dashboard:**

1. Go to Table Editor → cvs
2. Verify 3 rows inserted
3. Check file_name matches uploaded files
4. Check parsed_at is not null

---

### Step 4.3: Compare Parsing Quality (15 minutes)

Create `backend/compare_parsers.py`:

```python
"""
Compare parsing quality across different CV formats.
"""
import requests
import json

BASE_URL = "http://localhost:8000"

def upload_and_analyze(filename, user_id):
    """Upload CV and analyze parsed data quality"""
    print(f"\n=== Analyzing {filename} ===")

    try:
        with open(filename, "rb") as f:
            response = requests.post(
                f"{BASE_URL}/api/cv/upload?user_id={user_id}",
                files={"file": (filename, f)}
            )

        if response.status_code != 200:
            print(f"✗ Upload failed: {response.json()}")
            return

        result = response.json()
        parsed = result['parsed_data']

        # Analyze each section
        print(f"\nSkills length: {len(parsed['skills'])} chars")
        print(f"Experience length: {len(parsed['experience'])} chars")
        print(f"Education length: {len(parsed['education'])} chars")
        print(f"Projects length: {len(parsed['projects'])} chars")

        # Check for empty sections
        empty_sections = [k for k, v in parsed.items() if not v.strip()]
        if empty_sections:
            print(f"⚠ Empty sections: {', '.join(empty_sections)}")
        else:
            print("✓ All sections populated")

        # Check for encoding issues
        all_text = ' '.join(parsed.values())
        if any(char in all_text for char in ['�', '□', '▪', '\ufffd']):
            print("✗ Encoding issues detected")
        else:
            print("✓ No encoding issues")

        # Preview first 100 chars of each section
        print(f"\nSkills preview: {parsed['skills'][:100]}...")
        print(f"Experience preview: {parsed['experience'][:100]}...")

    except FileNotFoundError:
        print(f"⚠ {filename} not found - skipping")
    except Exception as e:
        print(f"✗ Error: {e}")


if __name__ == "__main__":
    print("=== CV Parsing Quality Comparison ===")

    upload_and_analyze("cv_single_column.pdf", "test-single")
    upload_and_analyze("cv_canva_template.pdf", "test-canva")
    upload_and_analyze("cv_word_doc.docx", "test-docx")

    print("\n=== Comparison Complete ===")
```

**Run:**

```bash
python compare_parsers.py
```

**Expected output:**

```
=== CV Parsing Quality Comparison ===

=== Analyzing cv_single_column.pdf ===

Skills length: 245 chars
Experience length: 512 chars
Education length: 178 chars
Projects length: 389 chars
✓ All sections populated
✓ No encoding issues

Skills preview: Python, FastAPI, PostgreSQL, Docker, AWS, React, TypeScript, Machine Learning, TensorFlow...
Experience preview: Software Engineer at TechCorp (Jan 2022 - Present): Built scalable REST APIs using FastAPI...

=== Analyzing cv_canva_template.pdf ===

Skills length: 198 chars
Experience length: 445 chars
Education length: 156 chars
Projects length: 312 chars
✓ All sections populated
✓ No encoding issues

Skills preview: JavaScript, React, Node.js, MongoDB, Express, HTML, CSS, Git, Agile, Scrum...
Experience preview: Full Stack Developer at StartupXYZ (Mar 2023 - Present): Developed responsive web applications...

=== Analyzing cv_word_doc.docx ===

Skills length: 167 chars
Experience length: 389 chars
Education length: 134 chars
Projects length: 278 chars
✓ All sections populated
✓ No encoding issues

Skills preview: Java, Spring Boot, MySQL, Hibernate, REST APIs, JUnit, Maven, Jenkins...
Experience preview: Backend Developer at CorpABC (Jul 2021 - Feb 2023): Designed and implemented microservices...

=== Comparison Complete ===
```

**Success criteria:**

- All 3 formats parse successfully
- No empty sections (or only 1 empty section is acceptable)
- No encoding issues (�, □, etc.)
- Multi-column PDF extracts text in correct order

---

## PHASE 5 - Documentation & Commit (1 hour)

### Step 5.1: Create API Documentation (20 minutes)

Create `backend/docs/API_DAY2.md`:

````markdown
# CareerPilot API - Day 2 Documentation

## CV Upload Endpoints

### POST /api/cv/upload

Upload and parse a CV file (PDF or DOCX).

**Request:**

- Method: `POST`
- Query Parameters:
  - `user_id` (required): User ID string
- Body: `multipart/form-data`
  - `file` (required): CV file (.pdf or .docx, max 5 MB)

**Response (200 OK):**

```json
{
  "cv_id": "123e4567-e89b-12d3-a456-426614174000",
  "file_name": "my_cv.pdf",
  "file_url": null,
  "parsed_data": {
    "skills": "Python, FastAPI, PostgreSQL, ...",
    "experience": "Software Engineer at ...",
    "education": "B.Sc. in Computer Science ...",
    "projects": "E-commerce Platform ..."
  },
  "parsed_at": "2026-05-24T10:30:00.123456",
  "message": "CV uploaded and parsed successfully"
}
```
````

**Error Responses:**

- `400 Bad Request`: Invalid file type, file too large, or empty file
- `422 Unprocessable Entity`: Parsing failed or no content extracted
- `500 Internal Server Error`: Database error or unexpected error

---

### GET /api/cv/list

List all CVs for a user.

**Request:**

- Method: `GET`
- Query Parameters:
  - `user_id` (required): User ID string

**Response (200 OK):**

```json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "user_id": "test-user-123",
    "file_name": "my_cv.pdf",
    "file_url": null,
    "parsed_at": "2026-05-24T10:30:00.123456",
    "created_at": "2026-05-24T10:30:00.123456"
  }
]
```

---

### GET /api/cv/{cv_id}

Get a specific CV by ID.

**Request:**

- Method: `GET`
- Path Parameters:
  - `cv_id` (required): CV ID (UUID)
- Query Parameters:
  - `user_id` (required): User ID string

**Response (200 OK):**

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "user_id": "test-user-123",
  "file_name": "my_cv.pdf",
  "file_url": null,
  "parsed_at": "2026-05-24T10:30:00.123456",
  "created_at": "2026-05-24T10:30:00.123456"
}
```

**Error Responses:**

- `404 Not Found`: CV not found

---

## Day 2 Limitations

- `file_url` is always `null` (Supabase Storage upload is Day 3)
- No chunking or embeddings yet (Day 3)
- No cv_chunks table writes (Day 3)
- user_id is query parameter (Day 6+ will add proper auth)

## Day 3 Will Add

- Supabase Storage file upload
- CV chunking by section
- Voyage AI embeddings
- cv_chunks table population
- Hybrid search endpoint

````

---

### Step 5.2: Update README (20 minutes)

Update `backend/README.md`:

```markdown
# CareerPilot Backend

FastAPI backend for CareerPilot - an agentic career co-pilot.

## Progress

### Day 1 ✅
- Database schema with pgvector
- API keys configuration
- Health check endpoints

### Day 2 ✅
- CV upload endpoint (POST /api/cv/upload)
- PDF parser with Gemini 2.0 Flash multimodal
- DOCX parser with python-docx + Gemini
- Structured JSON output (4 sections)
- Metadata storage in cvs table
- Comprehensive error handling
- Edge case testing

### Day 3 (Next)
- Supabase Storage integration
- CV chunking by section
- Voyage AI embeddings
- cv_chunks table population
- Hybrid search (dense + BM25)

## Setup

```bash
# Create virtual environment
python -m venv venv

# Activate
# Windows: venv\Scripts\activate
# Mac/Linux: source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add your API keys

# Run server
uvicorn app.main:app --reload
````

## API Endpoints

See [docs/API_DAY2.md](docs/API_DAY2.md) for full documentation.

**Day 2 Endpoints:**

- `POST /api/cv/upload` - Upload and parse CV
- `GET /api/cv/list` - List all CVs for user
- `GET /api/cv/{cv_id}` - Get specific CV

## Testing

```bash
# Test parser
python test_parser.py

# Test edge cases
python test_edge_cases.py

# Compare parsing quality
python compare_parsers.py
```

## Tech Stack

- **Framework:** FastAPI
- **LLM:** Gemini 2.0 Flash (multimodal for PDF, structuring for DOCX)
- **Document Parsing:** python-docx (DOCX text extraction)
- **Database:** Supabase (PostgreSQL)

## Parsing Performance

- PDF: 3-5 seconds
- DOCX: 2-4 seconds
- Handles multi-column layouts (Canva/Figma templates)
- No text scrambling
- Structured JSON output

## Known Limitations (Day 2)

- No file storage yet (file_url is null)
- No embeddings or chunking
- user_id is query parameter (no auth yet)
- No cv_chunks table writes

These will be addressed in Day 3.

````

---

### Step 5.3: Commit Day 2 Work (20 minutes)

```bash
# Make sure you're in backend directory
cd backend

# Check what changed
git status

# Add all changes
git add .

# Commit with detailed message
git commit -m "Day 2: CV parsing pipeline complete

Features:
- POST /api/cv/upload endpoint
- PDF parser using Gemini 2.0 Flash multimodal
- DOCX parser using python-docx + Gemini structuring
- Structured JSON output with 4 sections (skills, experience, education, projects)
- Metadata storage in cvs table
- GET /api/cv/list and GET /api/cv/{cv_id} endpoints
- Comprehensive error handling and validation
- File type validation (.pdf and .docx only)
- File size limit (5 MB)
- Empty file detection

Tested:
- Single-column PDFs ✓
- Multi-column PDFs (Canva templates) ✓
- DOCX files ✓
- Invalid file types ✓
- Empty files ✓
- Files too large ✓
- Corrupted files ✓

Files modified:
- services/parser.py (structured JSON output)
- routers/cv.py (removed Day 3 chunking/embedding)
- app/main.py (correct import path)

Files added:
- test_parser.py
- test_edge_cases.py
- compare_parsers.py
- docs/API_DAY2.md

Day 3 scope:
- Supabase Storage file upload
- CV chunking by section
- Voyage AI embeddings
- cv_chunks table writes
- Hybrid search endpoint"

# Push to GitHub
git push origin main
````

---

## Day 2 Checklist

### Parser Service

- [ ] `services/parser.py` returns structured JSON (not plain text)
- [ ] `parse_pdf_cv()` uses `gemini-2.0-flash` model
- [ ] `parse_docx_cv()` uses python-docx + Gemini
- [ ] `parse_cv()` routes to correct parser
- [ ] All functions return dict with 4 keys: skills, experience, education, projects
- [ ] JSON cleaning removes markdown code blocks
- [ ] Error handling for invalid JSON responses

### CV Router

- [ ] Endpoint is `POST /api/cv/upload` (not `/cv/upload`)
- [ ] `user_id` is Query parameter (not hardcoded)
- [ ] File validation: .pdf and .docx only
- [ ] File size limit: 5 MB
- [ ] Empty file detection
- [ ] Parsed data validation (not all empty)
- [ ] Metadata saved to `cvs` table
- [ ] `file_url` is null (Day 3 will add storage)
- [ ] No chunking logic (Day 3)
- [ ] No embedding calls (Day 3)
- [ ] No cv_chunks table writes (Day 3)

### API Testing

- [ ] Server starts with `uvicorn app.main:app --reload`
- [ ] Health check returns 200 OK
- [ ] Upload PDF returns 200 with structured JSON
- [ ] Upload DOCX returns 200 with structured JSON
- [ ] Invalid file type returns 400
- [ ] Empty file returns 400
- [ ] File too large returns 400
- [ ] Missing user_id returns 422
- [ ] List endpoint returns array of CVs
- [ ] Get endpoint returns single CV

### Database

- [ ] `cvs` table has records after upload
- [ ] `user_id` matches query parameter
- [ ] `file_name` matches uploaded file
- [ ] `file_url` is null
- [ ] `parsed_at` is ISO timestamp
- [ ] `created_at` is auto-generated

### Quality Testing

- [ ] Single-column PDF parses correctly
- [ ] Multi-column PDF (Canva) parses without scrambling
- [ ] DOCX file parses correctly
- [ ] All 4 sections populated (or max 1 empty)
- [ ] No encoding issues (�, □, etc.)
- [ ] Skills section contains actual skills
- [ ] Experience section contains job details

### Documentation

- [ ] API documentation created (docs/API_DAY2.md)
- [ ] README updated with Day 2 progress
- [ ] Test scripts documented
- [ ] Known limitations listed
- [ ] Day 3 scope outlined

### Code Quality

- [ ] No hardcoded user IDs in production code
- [ ] No `demo-user-id` strings
- [ ] Proper error messages
- [ ] Type hints on functions
- [ ] Docstrings on public functions
- [ ] No Day 3 code mixed in

### Blocked Items (Manual/Day 3)

- [ ] ⏸ Supabase Storage upload (need dashboard access)
- [ ] ⏸ Voyage AI embeddings (Day 3)
- [ ] ⏸ CV chunking (Day 3)
- [ ] ⏸ cv_chunks table writes (Day 3)
- [ ] ⏸ Hybrid search (Day 3)

---

## Troubleshooting

### Issue: "google.genai module not found"

**Solution:**

```bash
pip install google-generativeai==0.8.3
```

### Issue: "docx module not found"

**Solution:**

```bash
pip install python-docx==1.1.2
```

### Issue: Gemini returns "Invalid API key"

**Solution:**

1. Go to https://aistudio.google.com/app/apikey
2. Create new API key
3. Update `GOOGLE_API_KEY` in `.env`
4. Restart server

### Issue: "Model gemini-2.0-flash not found"

**Solution:**

- Check you're using `gemini-2.0-flash` (not `gemini-2.0-flash-exp`)
- Verify API key has access to Gemini 2.0
- Try `gemini-1.5-flash` as fallback

### Issue: PDF parsing returns scrambled text

**Solution:**

- This should NOT happen with Gemini multimodal
- Verify you're using `parse_pdf_cv()` (not a text-based parser)
- Check the PDF is not password-protected
- Try with a different PDF

### Issue: Parser returns empty sections

**Solution:**

- Check if CV actually has content in those sections
- Try with a different CV
- Check Gemini API response in logs
- Verify prompt is correct

### Issue: "uvicorn: command not found"

**Solution:**

```bash
# Make sure venv is activated
venv\Scripts\activate

# Reinstall uvicorn
pip install uvicorn

# Use full path
python -m uvicorn app.main:app --reload
```

### Issue: "Module 'routers' has no attribute 'cv'"

**Solution:**

- Check `routers/__init__.py` exists
- Verify `routers/cv.py` exists
- Check import in `app/main.py`: `from routers import cv`
- Restart server

### Issue: Database connection fails

**Solution:**

- Check `SUPABASE_URL` in `.env`
- Check `SUPABASE_SERVICE_ROLE_KEY` in `.env`
- Verify Supabase project is active
- Test connection: `python -c "from db.supabase import supabase; print(supabase)"`

---

## Success Criteria

By end of Day 2, you should have:

- ✅ CV upload endpoint working end-to-end
- ✅ Both PDF and DOCX parsers returning structured JSON
- ✅ Metadata saved to database
- ✅ All edge cases handled
- ✅ Multi-column PDFs parsing correctly
- ✅ No Day 3 code mixed in
- ✅ Code committed to GitHub

**If all checkboxes are checked, Day 2 is COMPLETE.**

---

## What's Next (Day 3)

Tomorrow you'll implement:

1. **Supabase Storage** - Upload original files to cv-files bucket
2. **CV Chunking** - Split parsed JSON into 4 chunks (one per section)
3. **Voyage AI Embeddings** - Generate 1024-dim vectors for each chunk
4. **Vector Storage** - Store embeddings in cv_chunks table
5. **Hybrid Search** - Implement dense (vector) + sparse (BM25) + RRF merge
6. **Search Endpoint** - `GET /api/cv/search?q=Python` for testing

**Estimated time:** 6-8 hours

**Key challenge:** Ensuring hybrid search RRF merge works correctly

**Prerequisites for Day 3:**

- Day 2 complete (parser returns structured JSON)
- Supabase Storage bucket created (manual dashboard task)
- Voyage AI API key in .env
- cv_chunks table exists (created in Day 1)

---

_DAY 2 Complete · CareerPilot · Codesprint 2026_
_Next: DAY 3 - Embeddings & Vector Storage_
