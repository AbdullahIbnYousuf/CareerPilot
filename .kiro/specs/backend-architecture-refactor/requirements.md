# Requirements Document

## Introduction

This document specifies requirements for refactoring the CareerPilot backend to resolve architectural contradictions between the current implementation and the AGENTS.md specification. The refactor will migrate the codebase to the prescribed routers/services pattern, replace deprecated libraries with specified alternatives, and establish the correct database client structure. The refactor will be executed incrementally across four phases to maintain system stability.

## Glossary

- **Backend_System**: The FastAPI Python 3.11 application serving CareerPilot API endpoints
- **CV_Parser**: The service responsible for extracting text from PDF and DOCX resume files
- **Embedding_Service**: The service responsible for generating vector embeddings from text
- **Chat_Service**: The service responsible for streaming conversational responses
- **Fit_Score_Service**: The service responsible for calculating job-to-CV match scores
- **Job_Search_Service**: The service responsible for querying external job APIs
- **Database_Client**: The Supabase client instance used for database operations
- **Router**: A FastAPI router module that handles HTTP concerns for a specific feature domain
- **Service**: A module containing business logic and data operations for a specific feature domain
- **Gemini_Multimodal**: Google Gemini 2.0 Flash model accessed via google-generativeai library for PDF parsing
- **Voyage_AI**: Voyage AI voyage-3 embedding model accessed via voyageai library
- **Groq_Streaming**: Groq Llama 3.3 70B model accessed via groq library for streaming chat
- **JSearch_API**: RapidAPI job search service for Bangladesh/Dhaka job listings
- **Remotive_API**: Remote job listing API requiring no authentication
- **Tavily_API**: Web search API for local job board scraping
- **Upstash_Redis**: Redis caching service accessed via upstash_redis library
- **Hybrid_Search**: Supabase stored procedure combining pgvector dense search with BM25 and RRF
- **Section_Weighted_Scoring**: Fit score algorithm using weighted cosine similarity across CV sections

## Requirements

### Requirement 1: Database Client Migration

**User Story:** As a backend developer, I want a single centralized Supabase client using the service role key, so that all database operations use consistent authentication and the codebase follows the AGENTS.md specification.

#### Acceptance Criteria

1. THE Backend_System SHALL create a db/supabase.py module containing the Database_Client initialization
2. THE Database_Client SHALL use SUPABASE_SERVICE_ROLE_KEY environment variable for authentication
3. THE Database_Client SHALL use SUPABASE_URL environment variable for connection
4. WHEN any service module requires database access, THE Backend_System SHALL import the Database_Client from db/supabase.py
5. THE Backend_System SHALL remove the app/database.py module after migration completion
6. THE Database_Client SHALL NOT be re-initialized in any module other than db/supabase.py

### Requirement 2: CV Parser Service Migration

**User Story:** As a backend developer, I want CV parsing to use Gemini multimodal for PDFs and python-docx for DOCX files, so that the system handles complex multi-column resume layouts without memory overhead.

#### Acceptance Criteria

1. THE CV_Parser SHALL create a services/parser.py module
2. WHEN a PDF file is received, THE CV_Parser SHALL use Gemini 2.0 Flash multimodal with types.Part.from_bytes
3. WHEN a DOCX file is received, THE CV_Parser SHALL use python-docx library
4. THE CV_Parser SHALL NOT use pypdf library for any file type
5. THE CV_Parser SHALL accept file bytes and filename as input parameters
6. THE CV_Parser SHALL return extracted text as a string
7. THE CV_Parser SHALL add GOOGLE_API_KEY environment variable with TODO comment if missing
8. THE CV_Parser SHALL import genai from google.generativeai library

### Requirement 3: Embedding Service Migration

**User Story:** As a backend developer, I want embeddings generated using Voyage AI voyage-3 model, so that the system uses the specified embedding provider with correct input type parameters.

#### Acceptance Criteria

1. THE Embedding_Service SHALL create a services/embedder.py module
2. THE Embedding_Service SHALL use voyageai.Client for all embedding operations
3. WHEN embedding document text, THE Embedding_Service SHALL set input_type parameter to "document"
4. WHEN embedding query text, THE Embedding_Service SHALL set input_type parameter to "query"
5. THE Embedding_Service SHALL NOT use GoogleGenerativeAIEmbeddings or langchain_google_genai
6. THE Embedding_Service SHALL add VOYAGE_API_KEY environment variable with TODO comment if missing
7. THE Embedding_Service SHALL accept text and input_type as parameters
8. THE Embedding_Service SHALL return embedding vectors as list of floats

### Requirement 4: Chat Service Migration

**User Story:** As a backend developer, I want chat responses streamed using Groq Llama 3.3 70B, so that users receive real-time conversational feedback without blocking.

#### Acceptance Criteria

1. THE Chat_Service SHALL create a services/chat.py module
2. THE Chat_Service SHALL use Groq client from groq library
3. THE Chat_Service SHALL use Llama 3.3 70B model identifier
4. THE Chat_Service SHALL stream responses using async generator pattern
5. THE Chat_Service SHALL NOT use ChatGoogleGenerativeAI or non-streaming responses
6. THE Chat_Service SHALL retrieve CV context using Hybrid_Search via Database_Client RPC
7. THE Chat_Service SHALL add GROQ_API_KEY environment variable with TODO comment if missing
8. WHEN generating chat responses, THE Chat_Service SHALL yield tokens incrementally

### Requirement 5: Fit Score Service Migration

**User Story:** As a backend developer, I want fit scores calculated using section-aware weighted cosine similarity, so that job matches reflect the importance of skills, experience, education, and projects.

#### Acceptance Criteria

1. THE Fit_Score_Service SHALL create a services/fit_score.py module
2. THE Fit_Score_Service SHALL apply weights of 40% skills, 35% experience, 15% education, 10% projects
3. THE Fit_Score_Service SHALL perform Hybrid_Search for each section independently
4. THE Fit_Score_Service SHALL compute cosine similarity between job description embedding and each CV chunk
5. THE Fit_Score_Service SHALL calculate weighted average across all sections
6. THE Fit_Score_Service SHALL multiply final similarity by 100 to produce integer score 0-100
7. THE Fit_Score_Service SHALL pass score and evidence to Gemini for one-sentence explanation
8. THE Fit_Score_Service SHALL NOT delegate score calculation to an LLM

### Requirement 6: Job Search Service Migration

**User Story:** As a backend developer, I want job searches to query JSearch, Remotive, and Tavily with Redis caching, so that the system provides comprehensive job listings with reduced API costs.

#### Acceptance Criteria

1. THE Job_Search_Service SHALL create a services/searcher.py module
2. THE Job_Search_Service SHALL query JSearch_API as first priority
3. IF JSearch_API returns no results, THEN THE Job_Search_Service SHALL query Remotive_API
4. IF Remotive_API returns no results, THEN THE Job_Search_Service SHALL query Tavily_API
5. THE Job_Search_Service SHALL cache results in Upstash_Redis with key pattern jobs:{md5(query+location)}
6. THE Job_Search_Service SHALL set cache TTL to 7200 seconds
7. WHEN cached results exist, THE Job_Search_Service SHALL return cached data without API calls
8. THE Job_Search_Service SHALL add JSEARCH_API_KEY, TAVILY_API_KEY, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN environment variables with TODO comments if missing

### Requirement 7: Router Structure Migration

**User Story:** As a backend developer, I want API endpoints organized into routers for cv, jobs, chat, tracker, and dashboard, so that the codebase follows the prescribed architectural pattern.

#### Acceptance Criteria

1. THE Backend_System SHALL create routers/cv.py for CV upload and parsing endpoints
2. THE Backend_System SHALL create routers/jobs.py for job search and fit score endpoints
3. THE Backend_System SHALL create routers/chat.py for streaming chat endpoints
4. THE Backend_System SHALL create routers/tracker.py for application tracking endpoints
5. THE Backend_System SHALL create routers/dashboard.py for progress dashboard endpoints
6. THE Backend_System SHALL register all routers in main.py using app.include_router
7. WHEN a router receives a request, THE Backend_System SHALL delegate business logic to corresponding service module
8. THE Backend_System SHALL NOT contain database queries or business logic in router modules

### Requirement 8: Dependency Migration

**User Story:** As a backend developer, I want deprecated dependencies removed and replaced with specified alternatives, so that the codebase complies with AGENTS.md technology constraints.

#### Acceptance Criteria

1. THE Backend_System SHALL remove pypdf from requirements.txt
2. THE Backend_System SHALL remove langchain-google-genai from requirements.txt
3. THE Backend_System SHALL remove langchain-community from requirements.txt
4. THE Backend_System SHALL add voyageai to requirements.txt
5. THE Backend_System SHALL add groq to requirements.txt
6. THE Backend_System SHALL add google-generativeai to requirements.txt if not present
7. THE Backend_System SHALL add upstash-redis to requirements.txt
8. THE Backend_System SHALL retain python-docx in requirements.txt

### Requirement 9: Environment Variable Configuration

**User Story:** As a backend developer, I want all required API keys defined in .env with TODO comments for missing values, so that the system can be configured without code changes.

#### Acceptance Criteria

1. THE Backend_System SHALL define GROQ_API_KEY in backend/.env
2. THE Backend_System SHALL define GOOGLE_API_KEY in backend/.env
3. THE Backend_System SHALL define VOYAGE_API_KEY in backend/.env
4. THE Backend_System SHALL define SUPABASE_URL in backend/.env
5. THE Backend_System SHALL define SUPABASE_SERVICE_ROLE_KEY in backend/.env
6. THE Backend_System SHALL define UPSTASH_REDIS_REST_URL in backend/.env
7. THE Backend_System SHALL define UPSTASH_REDIS_REST_TOKEN in backend/.env
8. THE Backend_System SHALL define JSEARCH_API_KEY in backend/.env
9. THE Backend_System SHALL define TAVILY_API_KEY in backend/.env
10. WHERE an API key value is unknown, THE Backend_System SHALL set value to "# TODO: Add key"

### Requirement 10: Incremental Refactor Execution

**User Story:** As a backend developer, I want the refactor executed in four phases, so that the system remains functional throughout the migration process.

#### Acceptance Criteria

1. THE Backend_System SHALL execute Phase 1 creating db/supabase.py and services/ directory structure
2. THE Backend_System SHALL execute Phase 2 migrating CV_Parser and Embedding_Service
3. THE Backend_System SHALL execute Phase 3 migrating Chat_Service, Fit_Score_Service, and Job_Search_Service
4. THE Backend_System SHALL execute Phase 4 creating routers and updating main.py
5. WHEN each phase completes, THE Backend_System SHALL remain in a runnable state
6. THE Backend_System SHALL NOT delete legacy modules until replacement modules are verified functional
7. THE Backend_System SHALL maintain backward compatibility for existing API endpoints during migration

### Requirement 11: Legacy Code Removal

**User Story:** As a backend developer, I want legacy modules removed after migration completion, so that the codebase contains no contradictory implementations.

#### Acceptance Criteria

1. THE Backend_System SHALL remove app/core/parser.py after services/parser.py is verified
2. THE Backend_System SHALL remove app/core/embedding.py after services/embedder.py is verified
3. THE Backend_System SHALL remove app/agents/graph.py after services/agent.py is verified
4. THE Backend_System SHALL remove app/agents/matching.py after services/fit_score.py is verified
5. THE Backend_System SHALL remove app/database.py after db/supabase.py is verified
6. THE Backend_System SHALL remove app/core/ directory if empty after migration
7. THE Backend_System SHALL remove app/agents/ directory if empty after migration

### Requirement 12: Type Safety and Async Patterns

**User Story:** As a backend developer, I want all service functions to use type hints and async patterns, so that the codebase follows Python best practices and FastAPI conventions.

#### Acceptance Criteria

1. THE Backend_System SHALL define type hints for all function parameters in service modules
2. THE Backend_System SHALL define type hints for all function return values in service modules
3. THE Backend_System SHALL use async def for all service functions that perform I/O operations
4. THE Backend_System SHALL use await for all Database_Client operations
5. THE Backend_System SHALL use await for all external API calls
6. THE Backend_System SHALL use Pydantic models for all request and response bodies in routers
7. THE Backend_System SHALL NOT use raw dict types in router function signatures
