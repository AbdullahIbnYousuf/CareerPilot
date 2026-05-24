"""
Manually confirm user email for development
Bypasses email confirmation requirement
"""

import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

def confirm_all_users():
    """Confirm all unconfirmed users"""
    
    print("=" * 80)
    print("CareerPilot User Email Confirmation")
    print("=" * 80)
    
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    print(f"\n🔗 Connected to: {SUPABASE_URL}")
    
    try:
        # List all users
        response = supabase.auth.admin.list_users()
        
        print(f"\n📊 Found {len(response)} user(s)\n")
        
        confirmed_count = 0
        
        for user in response:
            user_id = user.id if hasattr(user, 'id') else user.get('id')
            email = user.email if hasattr(user, 'email') else user.get('email')
            email_confirmed = user.email_confirmed_at if hasattr(user, 'email_confirmed_at') else user.get('email_confirmed_at')
            
            if not email_confirmed:
                print(f"⚠️  User {email} - NOT CONFIRMED")
                print(f"   Confirming...")
                
                try:
                    # Update user to confirm email
                    supabase.auth.admin.update_user_by_id(
                        user_id,
                        {"email_confirm": True}
                    )
                    print(f"   ✅ Confirmed!")
                    confirmed_count += 1
                except Exception as e:
                    print(f"   ❌ Error: {e}")
            else:
                print(f"✅ User {email} - Already confirmed")
        
        print("\n" + "=" * 80)
        print("SUMMARY")
        print("=" * 80)
        print(f"✅ Confirmed {confirmed_count} user(s)")
        print("\n🎉 All users can now login without email confirmation!")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        return False

if __name__ == "__main__":
    confirm_all_users()
