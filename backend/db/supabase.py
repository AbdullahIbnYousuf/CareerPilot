"""
Database client module for CareerPilot backend.

This module provides a singleton Supabase client instance using the service role key
for full database access. All backend services should import the client from this module.

Usage:
    from db.supabase import supabase

    async def get_user_cv(user_id: str):
        result = await supabase.table("cvs").select("*").eq("user_id", user_id).execute()
        return result.data
"""

import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Get Supabase configuration from environment
SUPABASE_URL: str = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

# Normalize URL - remove trailing /rest/v1/ or /rest/v1 if present
# This ensures consistent URL format regardless of how it's configured
if SUPABASE_URL.endswith("/rest/v1/"):
    SUPABASE_URL = SUPABASE_URL.replace("/rest/v1/", "")
elif SUPABASE_URL.endswith("/rest/v1"):
    SUPABASE_URL = SUPABASE_URL.replace("/rest/v1", "")

# Create singleton Supabase client instance
# This client uses the service role key for full database access (bypasses RLS)
# WARNING: Only use this client in backend services, never expose to frontend
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
