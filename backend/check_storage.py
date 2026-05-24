"""
Check if Supabase Storage bucket 'cvs' exists
"""

import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

def check_storage_bucket():
    """Check if the 'cvs' storage bucket exists"""
    
    print("=" * 80)
    print("CareerPilot Storage Bucket Check")
    print("=" * 80)
    
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    print(f"\n🔗 Connected to: {SUPABASE_URL}")
    print(f"\n📦 Checking for 'cvs' storage bucket...\n")
    
    try:
        # List all buckets
        buckets = supabase.storage.list_buckets()
        
        print(f"Found {len(buckets)} bucket(s):")
        for bucket in buckets:
            # Handle both dict and object types
            if hasattr(bucket, 'name'):
                bucket_name = bucket.name
                is_public = getattr(bucket, 'public', False)
            else:
                bucket_name = bucket.get('name', bucket.get('id', 'unknown'))
                is_public = bucket.get('public', False)
            print(f"  • {bucket_name} ({'public' if is_public else 'private'})")
        
        # Check if 'cvs' bucket exists
        cvs_bucket = None
        for b in buckets:
            name = b.name if hasattr(b, 'name') else b.get('name', b.get('id'))
            if name == 'cvs':
                cvs_bucket = b
                break
        
        print("\n" + "=" * 80)
        
        if cvs_bucket:
            is_public = getattr(cvs_bucket, 'public', False) if hasattr(cvs_bucket, 'public') else cvs_bucket.get('public', False)
            print("✅ 'cvs' bucket EXISTS")
            print(f"   Visibility: {'PUBLIC' if is_public else 'PRIVATE'}")
            
            if is_public:
                print("\n⚠️  WARNING: Bucket is PUBLIC. For security, it should be PRIVATE.")
                print("   Change it at: https://supabase.com/dashboard/project/atwlzuxjblqlonrdbwtt/storage/buckets")
            else:
                print("   ✅ Correctly set to PRIVATE")
            
            print("\n🎉 Storage is ready for CV uploads!")
            return True
        else:
            print("❌ 'cvs' bucket NOT FOUND")
            print("\n📝 Please create the bucket:")
            print("   1. Go to: https://supabase.com/dashboard/project/atwlzuxjblqlonrdbwtt/storage/buckets")
            print("   2. Click 'New bucket'")
            print("   3. Name: cvs")
            print("   4. Set to PRIVATE (not public)")
            print("   5. Click 'Create bucket'")
            return False
            
    except Exception as e:
        print(f"❌ Error checking storage: {e}")
        print("\nTry checking manually at:")
        print("https://supabase.com/dashboard/project/atwlzuxjblqlonrdbwtt/storage/buckets")
        return False

if __name__ == "__main__":
    check_storage_bucket()
