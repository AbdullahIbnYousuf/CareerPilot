# Implementation Plan: Backend Architecture Refactor

## Overview

This plan refactors the CareerPilot backend from its current implementation to the prescribed routers/services pattern defined in AGENTS.md. The refactor addresses critical contradictions including deprecated library usage (pypdf, langchain-google-genai), incorrect database client configuration, and missing architectural separation between HTTP concerns and business logic.

The implementation follows a four-phase incremental migration strategy to maintain system stability throughout the refactor process. Each phase produces a runnable system state, allowing for validation before proceeding to the next phase.

## Tasks

- [ ] 1. Phase 1: Foundation - Database Client and Directory Structure
  - [-] 1.1 Create db/ directory and database client module
    - Create `backend/db/` directory
    - Create `backend/db/supabase.py` with singleton Supabase client using `SUPABASE_SERVICE_ROLE_KEY`
    - Add URL normalization logic to remove trailing `/rest/v1/` or `/rest/v1`
    - Export `supabase` client instance for import by services
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6_

  - [ ] 1.2 Create services/ and routers/ directory structure
    - Create `backend/services/` directory (empty for now)
    - Create `backend/routers/` directory (empty for now)
    - Keep existing `backend/app/` directory intact for backward compatibility
    - _Requirements: 10.1_

  - [ ] 1.3 Update environment variables configuration
    - Update `backend/.env` to include all required API keys: `GROQ_API_KEY`, `GOOGLE_API_KEY`, `VOYAGE_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `JSEARCH_API_KEY`, `TAVILY_API_KEY`
    - Set missing values to `# TODO: Add key` with descriptive comments
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10_

  - [ ] 1.4 Verify Phase 1 completion
    - Run backend with `uvicorn main:app --reload`
    - Verify backend starts successfully
    - Verify existing endpoints still work
    - _Requirements: 10.5_

- [ ] 2. Phase 2: Service Layer Migration - Parser and Embedder
  - [ ] 2.1 Create CV Parser service with Gemini multimodal and python-docx
    - Create `backend/services/parser.py`
    - Implement `parse_cv(file_bytes: bytes, filename: str) -> str` function
    - Implement `_parse_pdf_with_gemini(file_bytes: bytes) -> str` using Gemini 2.0 Flash with `types.Part.from_bytes`
    - Implement `_parse_docx(file_bytes: bytes) -> str` using python-docx
    - Add type hints to all function parameters and return values
    - Use `async def` for Gemini API call
    - Add error handling for unsupported file formats
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 12.1, 12.2, 12.3_

  - [ ] 2.2 Create Embedding service with Voyage AI
    - Create `backend/services/embedder.py`
    - Initialize Voyage AI client with `VOYAGE_API_KEY`
    - Implement `embed_text(text: str, input_type: Literal["document", "query"]) -> list[float]`
    - Implement `embed_documents(texts: list[str]) -> list[list[float]]` for batch embedding
    - Implement `embed_query(text: str) -> list[float]` convenience function
    - Use `async def` for all functions
    - Add type hints to all function parameters and return values
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 12.1, 12.2, 12.3_

  - [ ] 2.3 Update requirements.txt for Phase 2
    - Add `voyageai` to requirements.txt
    - Add `google-generativeai` to requirements.txt if not present
    - Add `httpx` to requirements.txt
    - Keep `pypdf` and `langchain-google-genai` for backward compatibility
    - Keep `python-docx` in requirements.txt
    - Run `pip install -r requirements.txt` to install new dependencies
    - _Requirements: 8.4, 8.6, 8.8_

  - [ ] 2.4 Test new parser and embedder services
    - Create test script to verify PDF parsing with sample PDF
    - Create test script to verify DOCX parsing with sample DOCX
    - Create test script to verify document embedding with input_type="document"
    - Create test script to verify query embedding with input_type="query"
    - Verify all services work correctly with test inputs
    - _Requirements: 10.5_

- [ ] 3. Phase 3: Business Logic Migration - Chat, Fit Score, and Job Search
  - [ ] 3.1 Create Chat service with Groq streaming
    - Create `backend/services/chat.py`
    - Initialize Groq client with `GROQ_API_KEY`
    - Implement `stream_chat_response(user_id: str, message: str, history: list[dict]) -> AsyncGenerator[str, None]`
    - Implement `_get_cv_context(user_id: str, query: str, top_k: int = 5) -> str` using hybrid_search RPC
    - Use `async def` and async generator pattern for streaming
    - Import embedder service for query embedding
    - Import database client from `db.supabase`
    - Add type hints to all function parameters and return values
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 12.1, 12.2, 12.3, 12.5_

  - [ ] 3.2 Create Fit Score service with section-weighted algorithm
    - Create `backend/services/fit_score.py`
    - Define `SECTION_WEIGHTS` constant with skills=0.40, experience=0.35, education=0.15, projects=0.10
    - Define `FitScoreResult` TypedDict with score, explanation, section_scores fields
    - Implement `calculate_fit_score(user_id: str, job_description: str, top_k_per_section: int = 3) -> FitScoreResult`
    - Implement `_get_section_chunks(user_id: str, section: str, query_embedding: list[float], top_k: int) -> list[dict]` using hybrid_search RPC with section filtering
    - Implement `_cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float` using numpy
    - Implement `_generate_explanation(job_description: str, evidence: list[str], score: int, section_scores: dict[str, float]) -> str` using Gemini
    - Use `async def` for all I/O operations
    - Add type hints to all function parameters and return values
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 12.1, 12.2, 12.3, 12.5_

  - [ ] 3.3 Create Job Search service with fallback chain and Redis caching
    - Create `backend/services/searcher.py`
    - Initialize Upstash Redis client with `Redis.from_env()`
    - Define `CACHE_TTL = 7200` constant
    - Implement `search_jobs(query: str, location: str = "", max_results: int = 10) -> list[dict]` with fallback chain
    - Implement `_generate_cache_key(query: str, location: str) -> str` using MD5 hash with pattern `jobs:{hash}`
    - Implement `_get_cached_results(cache_key: str) -> Optional[list[dict]]`
    - Implement `_cache_results(cache_key: str, jobs: list[dict]) -> None` with TTL
    - Implement `_search_jsearch(query: str, location: str, max_results: int) -> list[dict]` as first priority
    - Implement `_search_remotive(query: str, max_results: int) -> list[dict]` as second priority
    - Implement `_search_tavily(query: str, location: str, max_results: int) -> list[dict]` as third priority
    - Use httpx.AsyncClient for all HTTP requests
    - Add error handling to prevent cache failures from breaking search
    - Use `async def` for all I/O operations
    - Add type hints to all function parameters and return values
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 12.1, 12.2, 12.3, 12.5_

  - [ ] 3.4 Update requirements.txt for Phase 3
    - Add `groq` to requirements.txt
    - Add `upstash-redis` to requirements.txt
    - Add `numpy` to requirements.txt if not present
    - Remove `pypdf` from requirements.txt
    - Remove `langchain-google-genai` from requirements.txt
    - Remove `langchain-community` from requirements.txt
    - Run `pip install -r requirements.txt` to install new dependencies
    - _Requirements: 8.1, 8.2, 8.3, 8.5_

  - [ ] 3.5 Test new chat, fit score, and job search services
    - Create test script to verify streaming chat response
    - Create test script to verify fit score calculation with section weights
    - Create test script to verify job search fallback chain
    - Create test script to verify Redis caching behavior
    - Verify all services work correctly with test inputs
    - _Requirements: 10.5_

- [ ] 4. Checkpoint - Verify all services functional
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Phase 4: Router Layer and Cleanup
  - [ ] 5.1 Create CV router module
    - Create `backend/routers/cv.py`
    - Define `CVUploadResponse` Pydantic model
    - Implement `upload_cv(user_id: str, file: UploadFile) -> CVUploadResponse` endpoint
    - Import parser service from `services.parser`
    - Import embedder service from `services.embedder`
    - Import database client from `db.supabase`
    - Implement `_chunk_by_section(text: str) -> list[dict]` helper function
    - Use `async def` for route handler
    - Add error handling with HTTPException
    - _Requirements: 7.1, 7.7, 7.8, 12.6, 12.7_

  - [ ] 5.2 Create Jobs router module
    - Create `backend/routers/jobs.py`
    - Define `JobSearchRequest` and `JobSearchResponse` Pydantic models
    - Implement `search_jobs_endpoint(request: JobSearchRequest) -> JobSearchResponse` endpoint
    - Import searcher service from `services.searcher`
    - Import fit_score service from `services.fit_score`
    - Calculate fit scores for each job and sort by score descending
    - Use `async def` for route handler
    - Add error handling with HTTPException
    - _Requirements: 7.2, 7.7, 7.8, 12.6, 12.7_

  - [ ] 5.3 Create Chat router module
    - Create `backend/routers/chat.py`
    - Define `ChatRequest` Pydantic model
    - Implement `chat_stream(request: ChatRequest) -> StreamingResponse` endpoint
    - Import chat service from `services.chat`
    - Implement async generator to yield SSE formatted tokens
    - Return StreamingResponse with media_type="text/event-stream"
    - Use `async def` for route handler
    - Add error handling with HTTPException
    - _Requirements: 7.3, 7.7, 7.8, 12.6, 12.7_

  - [ ] 5.4 Create Tracker router module
    - Create `backend/routers/tracker.py`
    - Define `ApplicationStatus` Literal type with values: saved, applied, interviewing, offer, rejected
    - Define `ApplicationCreate` and `ApplicationUpdate` Pydantic models
    - Implement `create_application(app: ApplicationCreate)` POST endpoint
    - Implement `get_applications(user_id: str)` GET endpoint
    - Implement `update_application(application_id: str, update: ApplicationUpdate)` PATCH endpoint
    - Import database client from `db.supabase`
    - Use `async def` for all route handlers
    - Add error handling with HTTPException
    - _Requirements: 7.4, 7.7, 7.8, 12.6, 12.7_

  - [ ] 5.5 Create Dashboard router module
    - Create `backend/routers/dashboard.py`
    - Define `ProgressStats` Pydantic model
    - Implement `get_progress(user_id: str) -> ProgressStats` GET endpoint
    - Import database client from `db.supabase`
    - Query applications table and calculate statistics
    - Use `async def` for route handler
    - Add error handling with HTTPException
    - _Requirements: 7.5, 7.7, 7.8, 12.6, 12.7_

  - [ ] 5.6 Update main.py to register all routers
    - Import all router modules: cv, jobs, chat, tracker, dashboard
    - Register all routers using `app.include_router()`
    - Keep CORS configuration
    - Keep health check endpoints
    - Remove any business logic or endpoint definitions from main.py
    - _Requirements: 7.6_

  - [ ] 5.7 Test all router endpoints
    - Test CV upload endpoint with sample PDF and DOCX files
    - Test job search endpoint with sample query
    - Test chat streaming endpoint with sample message
    - Test tracker CRUD endpoints
    - Test dashboard progress endpoint
    - Verify all endpoints work correctly via new routers
    - _Requirements: 10.5_

- [ ] 6. Checkpoint - Verify all routers functional
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Phase 4 Cleanup: Remove legacy code
  - [ ] 7.1 Remove legacy database module
    - Delete `backend/app/database.py`
    - Verify no imports reference this file
    - _Requirements: 1.5, 11.5_

  - [ ] 7.2 Remove legacy parser module
    - Delete `backend/app/core/parser.py`
    - Verify no imports reference this file
    - _Requirements: 11.1_

  - [ ] 7.3 Remove legacy embedding module
    - Delete `backend/app/core/embedding.py`
    - Verify no imports reference this file
    - _Requirements: 11.2_

  - [ ] 7.4 Remove legacy agent modules
    - Delete `backend/app/agents/graph.py`
    - Delete `backend/app/agents/matching.py`
    - Verify no imports reference these files
    - _Requirements: 11.3, 11.4_

  - [ ] 7.5 Remove empty legacy directories
    - Delete `backend/app/core/` directory if empty
    - Delete `backend/app/agents/` directory if empty
    - _Requirements: 11.6, 11.7_

  - [ ] 7.6 Update all remaining imports
    - Search for any remaining imports from `app.database`, `app.core`, or `app.agents`
    - Update imports to use new `db.supabase`, `services.*`, or `routers.*` modules
    - Verify no import errors
    - _Requirements: 10.6_

- [ ] 8. Final verification and testing
  - [ ] 8.1 Run full integration tests
    - Test complete CV upload flow (upload → parse → embed → store)
    - Test complete job search flow (search → score → cache)
    - Test complete chat flow (message → context → stream)
    - Verify all flows work end-to-end
    - _Requirements: 10.5, 10.7_

  - [ ] 8.2 Verify backward compatibility
    - Verify existing API endpoints maintain same behavior
    - Verify response formats unchanged
    - Verify no breaking changes for frontend
    - _Requirements: 10.7_

  - [ ] 8.3 Run backend and verify startup
    - Run `uvicorn main:app --reload`
    - Verify backend starts without errors
    - Verify all routers registered correctly
    - Test health check endpoint
    - _Requirements: 10.5_

- [ ] 9. Final checkpoint - Refactor complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Each phase maintains backward compatibility until the next phase is verified
- Legacy modules are kept intact until Phase 4 cleanup to allow rollback if needed
- All service functions use type hints and async patterns per Python best practices
- All router endpoints use Pydantic models for request/response validation
- Environment variables are configured with TODO comments for missing values
- The refactor addresses all contradictions between current implementation and AGENTS.md specification

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["1.4"] },
    { "id": 2, "tasks": ["2.1", "2.2"] },
    { "id": 3, "tasks": ["2.3"] },
    { "id": 4, "tasks": ["2.4"] },
    { "id": 5, "tasks": ["3.1", "3.2", "3.3"] },
    { "id": 6, "tasks": ["3.4"] },
    { "id": 7, "tasks": ["3.5"] },
    { "id": 8, "tasks": ["5.1", "5.2", "5.3", "5.4", "5.5"] },
    { "id": 9, "tasks": ["5.6"] },
    { "id": 10, "tasks": ["5.7"] },
    { "id": 11, "tasks": ["7.1", "7.2", "7.3", "7.4"] },
    { "id": 12, "tasks": ["7.5", "7.6"] },
    { "id": 13, "tasks": ["8.1", "8.2", "8.3"] }
  ]
}
```
