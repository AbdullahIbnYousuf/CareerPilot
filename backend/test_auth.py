"""
Test Supabase Auth Configuration
Checks if signup/login is properly configured
"""

import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

def test_auth_config():
    """Test if Supabase Auth is properly configured"""
    
    print("=" * 80)
    print("CareerPilot Auth Configuration Check")
    print("=" * 80)
    
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    print(f"\n🔗 Connected to: {SUPABASE_URL}")
    
    # Check if we can access auth users
    try:
        # Try to list users (requires service role key)
        response = supabase.auth.admin.list_users()
        user_count = len(response) if isinstance(response, list) else 0
        
        print(f"\n✅ Auth is configured")
        print(f"📊 Current users: {user_count}")
        
        if user_count > 0:
            print("\n👥 Registered users:")
            for user in response[:5]:  # Show first 5
                email = user.email if hasattr(user, 'email') else user.get('email', 'N/A')
                created = user.created_at if hasattr(user, 'created_at') else user.get('created_at', 'N/A')
                print(f"   • {email} (created: {created})")
        
        print("\n" + "=" * 80)
        print("AUTH STATUS")
        print("=" * 80)
        print("✅ Supabase Auth is working")
        print("✅ Signup should work from frontend")
        
        print("\n📝 Important Auth Settings to Check:")
        print("   1. Email confirmation: Check if enabled")
        print("   2. Go to: https://supabase.com/dashboard/project/atwlzuxjblqlonrdbwtt/auth/users")
        print("   3. Settings → Auth → Email Auth → Confirm email")
        print("      - If ENABLED: Users must confirm email before login")
        print("      - If DISABLED: Users can login immediately after signup")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Error checking auth: {e}")
        print("\nThis might mean:")
        print("   1. Auth is not enabled in Supabase")
        print("   2. Service role key doesn't have admin permissions")
        print("\nCheck at: https://supabase.com/dashboard/project/atwlzuxjblqlonrdbwtt/auth/users")
        return False

if __name__ == "__main__":
    test_auth_config()
