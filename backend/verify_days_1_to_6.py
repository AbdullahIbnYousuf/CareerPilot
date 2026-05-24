"""
Comprehensive verification of Days 1-6 completion status
"""

import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

def check_day_1():
    """Day 1: Foundation Setup"""
    print("\n" + "=" * 80)
    print("DAY 1 — Foundation Setup")
    print("=" * 80)
    
    checks = []
    
    # Database tables
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    required_tables = ["cvs", "cv_chunks", "jobs", "applications", "chat_messages", 
                      "goals", "todos", "nudges", "progress_snapshots"]
    
    print("\n📊 Database Tables:")
    for table in required_tables:
        try:
            supabase.table(table).select("*").limit(0).execute()
            print(f"  ✅ {table}")
            checks.append(True)
        except:
            print(f"  ❌ {table}")
            checks.append(False)
    
    # Storage bucket
    print("\n📦 Storage:")
    try:
        buckets = supabase.storage.list_buckets()
        cvs_exists = any(b.name == 'cvs' if hasattr(b, 'name') else b.get('name') == 'cvs' for b in buckets)
        if cvs_exists:
            print("  ✅ cvs bucket")
            checks.append(True)
        else:
            print("  ❌ cvs bucket")
            checks.append(False)
    except:
        print("  ❌ Storage check failed")
        checks.append(False)
    
    # Environment variables
    print("\n🔑 Backend Environment Variables:")
    required_env = ["GROQ_API_KEY", "GOOGLE_API_KEY", "VOYAGE_API_KEY", 
                   "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY",
                   "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN",
                   "JSEARCH_API_KEY", "TAVILY_API_KEY"]
    
    for var in required_env:
        value = os.environ.get(var, "")
        if value and "placeholder" not in value.lower():
            print(f"  ✅ {var}")
            checks.append(True)
        else:
            print(f"  ❌ {var}")
            checks.append(False)
    
    # Frontend env
    print("\n🔑 Frontend Environment Variables:")
    frontend_env = Path(__file__).parent.parent / "frontend" / ".env.local"
    if frontend_env.exists():
        with open(frontend_env) as f:
            content = f.read()
            if "placeholder" not in content.lower():
                print("  ✅ .env.local configured")
                checks.append(True)
            else:
                print("  ❌ .env.local has placeholders")
                checks.append(False)
    else:
        print("  ❌ .env.local not found")
        checks.append(False)
    
    return all(checks)

def check_day_2():
    """Day 2: CV Parsing Pipeline"""
    print("\n" + "=" * 80)
    print("DAY 2 — CV Parsing Pipeline")
    print("=" * 80)
    
    checks = []
    
    # Check parser.py exists
    parser_file = Path(__file__).parent / "services" / "parser.py"
    print("\n📄 Parser Service:")
    if parser_file.exists():
        with open(parser_file) as f:
            content = f.read()
            if "parse_pdf_cv" in content and "parse_docx_cv" in content:
                print("  ✅ parser.py with PDF and DOCX support")
                checks.append(True)
            else:
                print("  ❌ parser.py missing functions")
                checks.append(False)
    else:
        print("  ❌ parser.py not found")
        checks.append(False)
    
    # Check cv router
    cv_router = Path(__file__).parent / "routers" / "cv.py"
    print("\n🛣️  CV Router:")
    if cv_router.exists():
        with open(cv_router) as f:
            content = f.read()
            if "POST" in content and "/upload" in content:
                print("  ✅ cv.py with upload endpoint")
                checks.append(True)
            else:
                print("  ❌ cv.py missing upload endpoint")
                checks.append(False)
    else:
        print("  ❌ cv.py not found")
        checks.append(False)
    
    return all(checks)

def check_day_3():
    """Day 3: Embeddings & Vector Storage"""
    print("\n" + "=" * 80)
    print("DAY 3 — Embeddings & Vector Storage")
    print("=" * 80)
    
    checks = []
    
    # Check embedder.py
    embedder_file = Path(__file__).parent / "services" / "embedder.py"
    print("\n🔢 Embedder Service:")
    if embedder_file.exists():
        with open(embedder_file) as f:
            content = f.read()
            if "voyage" in content.lower() and "embed" in content:
                print("  ✅ embedder.py with Voyage AI")
                checks.append(True)
            else:
                print("  ❌ embedder.py incomplete")
                checks.append(False)
    else:
        print("  ❌ embedder.py not found")
        checks.append(False)
    
    # Check searcher.py
    searcher_file = Path(__file__).parent / "services" / "searcher.py"
    print("\n🔍 Searcher Service:")
    if searcher_file.exists():
        with open(searcher_file) as f:
            content = f.read()
            if "hybrid_search" in content:
                print("  ✅ searcher.py with hybrid search")
                checks.append(True)
            else:
                print("  ❌ searcher.py incomplete")
                checks.append(False)
    else:
        print("  ❌ searcher.py not found")
        checks.append(False)
    
    # Check chunker.py
    chunker_file = Path(__file__).parent / "services" / "chunker.py"
    print("\n✂️  Chunker Service:")
    if chunker_file.exists():
        print("  ✅ chunker.py exists")
        checks.append(True)
    else:
        print("  ❌ chunker.py not found")
        checks.append(False)
    
    return all(checks)

def check_day_4():
    """Day 4: Fit Score & Job Search"""
    print("\n" + "=" * 80)
    print("DAY 4 — Fit Score & Job Search")
    print("=" * 80)
    
    checks = []
    
    # Check fit_score.py
    fit_score_file = Path(__file__).parent / "services" / "fit_score.py"
    print("\n🎯 Fit Score Service:")
    if fit_score_file.exists():
        with open(fit_score_file) as f:
            content = f.read()
            if "compute_fit_score" in content:
                print("  ✅ fit_score.py with algorithm")
                checks.append(True)
            else:
                print("  ❌ fit_score.py incomplete")
                checks.append(False)
    else:
        print("  ❌ fit_score.py not found")
        checks.append(False)
    
    # Check cache.py
    cache_file = Path(__file__).parent / "services" / "cache.py"
    print("\n💾 Cache Service:")
    if cache_file.exists():
        print("  ✅ cache.py exists")
        checks.append(True)
    else:
        print("  ❌ cache.py not found")
        checks.append(False)
    
    # Check jobs router
    jobs_router = Path(__file__).parent / "routers" / "jobs.py"
    print("\n🛣️  Jobs Router:")
    if jobs_router.exists():
        with open(jobs_router) as f:
            content = f.read()
            if "hunt" in content or "search" in content:
                print("  ✅ jobs.py with search endpoint")
                checks.append(True)
            else:
                print("  ❌ jobs.py incomplete")
                checks.append(False)
    else:
        print("  ❌ jobs.py not found")
        checks.append(False)
    
    return all(checks)

def check_day_5():
    """Day 5: LangGraph Agent & Chat Memory"""
    print("\n" + "=" * 80)
    print("DAY 5 — LangGraph Agent & Chat Memory")
    print("=" * 80)
    
    checks = []
    
    # Check agent.py
    agent_file = Path(__file__).parent / "services" / "agent.py"
    print("\n🤖 Agent Service:")
    if agent_file.exists():
        with open(agent_file) as f:
            content = f.read()
            if "langgraph" in content.lower() or "StateGraph" in content:
                print("  ✅ agent.py with LangGraph")
                checks.append(True)
            else:
                print("  ❌ agent.py missing LangGraph")
                checks.append(False)
    else:
        print("  ❌ agent.py not found")
        checks.append(False)
    
    # Check chat.py service
    chat_service = Path(__file__).parent / "services" / "chat.py"
    print("\n💬 Chat Service:")
    if chat_service.exists():
        with open(chat_service) as f:
            content = f.read()
            if "stream" in content:
                print("  ✅ chat.py with streaming")
                checks.append(True)
            else:
                print("  ❌ chat.py incomplete")
                checks.append(False)
    else:
        print("  ❌ chat.py not found")
        checks.append(False)
    
    # Check chat router
    chat_router = Path(__file__).parent / "routers" / "chat.py"
    print("\n🛣️  Chat Router:")
    if chat_router.exists():
        with open(chat_router) as f:
            content = f.read()
            if "StreamingResponse" in content or "SSE" in content:
                print("  ✅ chat.py with SSE streaming")
                checks.append(True)
            else:
                print("  ❌ chat.py missing streaming")
                checks.append(False)
    else:
        print("  ❌ chat.py not found")
        checks.append(False)
    
    return all(checks)

def check_day_6():
    """Day 6: Frontend Scaffold"""
    print("\n" + "=" * 80)
    print("DAY 6 — Frontend Scaffold")
    print("=" * 80)
    
    checks = []
    
    frontend_dir = Path(__file__).parent.parent / "frontend"
    
    # Check package.json
    package_json = frontend_dir / "package.json"
    print("\n📦 Frontend Dependencies:")
    if package_json.exists():
        with open(package_json) as f:
            content = f.read()
            required_deps = ["@supabase/ssr", "@tanstack/react-query", "ai", "@dnd-kit/core", "recharts"]
            missing = [dep for dep in required_deps if dep not in content]
            if not missing:
                print("  ✅ All required dependencies installed")
                checks.append(True)
            else:
                print(f"  ❌ Missing: {', '.join(missing)}")
                checks.append(False)
    else:
        print("  ❌ package.json not found")
        checks.append(False)
    
    # Check auth pages
    print("\n🔐 Auth Pages:")
    login_page = frontend_dir / "app" / "(auth)" / "login" / "page.tsx"
    signup_page = frontend_dir / "app" / "(auth)" / "signup" / "page.tsx"
    
    if login_page.exists():
        print("  ✅ login/page.tsx")
        checks.append(True)
    else:
        print("  ❌ login/page.tsx")
        checks.append(False)
    
    if signup_page.exists():
        print("  ✅ signup/page.tsx")
        checks.append(True)
    else:
        print("  ❌ signup/page.tsx")
        checks.append(False)
    
    # Check dashboard pages
    print("\n📊 Dashboard Pages:")
    dashboard_pages = ["jobs", "cv", "chat", "tracker"]
    for page in dashboard_pages:
        page_file = frontend_dir / "app" / "(dashboard)" / page / "page.tsx"
        if page_file.exists():
            print(f"  ✅ {page}/page.tsx")
            checks.append(True)
        else:
            print(f"  ❌ {page}/page.tsx")
            checks.append(False)
    
    return all(checks)

def main():
    print("=" * 80)
    print("CAREERPILOT — DAYS 1-6 VERIFICATION")
    print("=" * 80)
    
    results = {
        "Day 1": check_day_1(),
        "Day 2": check_day_2(),
        "Day 3": check_day_3(),
        "Day 4": check_day_4(),
        "Day 5": check_day_5(),
        "Day 6": check_day_6(),
    }
    
    print("\n" + "=" * 80)
    print("FINAL SUMMARY")
    print("=" * 80)
    
    for day, status in results.items():
        status_icon = "✅" if status else "❌"
        print(f"{status_icon} {day}: {'COMPLETE' if status else 'INCOMPLETE'}")
    
    all_complete = all(results.values())
    
    print("\n" + "=" * 80)
    if all_complete:
        print("🎉 ALL DAYS 1-6 COMPLETE!")
        print("✅ Ready to proceed to Day 7 (Deployment)")
    else:
        incomplete = [day for day, status in results.items() if not status]
        print(f"⚠️  INCOMPLETE: {', '.join(incomplete)}")
        print("📝 Review the checks above and complete missing items")
    print("=" * 80)

if __name__ == "__main__":
    main()
