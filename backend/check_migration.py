"""
Check if database migration has been completed
Verifies that all required tables exist in Supabase
"""

import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

# Expected tables from migration
EXPECTED_TABLES = [
    "cvs",
    "cv_chunks",
    "jobs",
    "applications",
    "chat_messages",
    "goals",
    "todos",
    "nudges",
    "progress_snapshots"
]

def check_migration():
    """Check if all tables exist"""
    
    print("=" * 80)
    print("CareerPilot Database Migration Status Check")
    print("=" * 80)
    
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    print(f"\n🔗 Connected to: {SUPABASE_URL}")
    print(f"\n📋 Checking for {len(EXPECTED_TABLES)} required tables...\n")
    
    tables_found = []
    tables_missing = []
    
    for table_name in EXPECTED_TABLES:
        try:
            # Try to query the table (limit 0 to avoid loading data)
            result = supabase.table(table_name).select("*").limit(0).execute()
            print(f"  ✅ {table_name:<25} EXISTS")
            tables_found.append(table_name)
        except Exception as e:
            error_msg = str(e)
            if "does not exist" in error_msg or "relation" in error_msg or "404" in error_msg:
                print(f"  ❌ {table_name:<25} MISSING")
                tables_missing.append(table_name)
            else:
                print(f"  ⚠️  {table_name:<25} ERROR: {error_msg[:50]}")
                tables_missing.append(table_name)
    
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"✅ Tables found:   {len(tables_found)}/{len(EXPECTED_TABLES)}")
    print(f"❌ Tables missing: {len(tables_missing)}/{len(EXPECTED_TABLES)}")
    
    if tables_missing:
        print(f"\n⚠️  Missing tables: {', '.join(tables_missing)}")
        print("\n📝 Migration NOT complete. Please run the SQL migration:")
        print("   Go to: https://supabase.com/dashboard/project/atwlzuxjblqlonrdbwtt/editor")
        print("   Copy SQL from: supabase/migrations/20260524_init.sql")
        print("   Paste and run in SQL Editor")
        return False
    else:
        print("\n🎉 Migration COMPLETE! All tables exist.")
        print("✅ Database is ready to use!")
        return True

if __name__ == "__main__":
    check_migration()
