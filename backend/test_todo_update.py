import asyncio
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from db.supabase import supabase

async def test_update():
    print("Fetching todos...")
    res = await supabase.table("todos").select("*").limit(5).execute()
    print("Todos in database:", res.data)
    if not res.data:
        print("No todos found. Creating a test todo...")
        # Let's find a user first
        users_res = await supabase.table("goals").select("user_id").limit(1).execute()
        if not users_res.data:
            print("No goals/user found in database to link todo to.")
            # Let's try to fetch an auth user or just insert with a random uuid if RLS is off
            user_id = "00000000-0000-0000-0000-000000000000" # dummy
        else:
            user_id = users_res.data[0]["user_id"]
        
        insert_res = await supabase.table("todos").insert({
            "user_id": user_id,
            "title": "Test todo task",
            "completed": False
        }).execute()
        print("Inserted todo:", insert_res.data)
        todo = insert_res.data[0]
    else:
        todo = res.data[0]
    
    todo_id = todo["id"]
    completed_status = todo.get("completed", False)
    new_status = not completed_status
    print(f"Toggling todo {todo_id} from {completed_status} to {new_status}...")
    
    try:
        from datetime import datetime, timezone
        update_data = {
            "completed": new_status,
        }
        if new_status:
            update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
        else:
            update_data["completed_at"] = None
            
        print("Update payload:", update_data)
        update_res = await supabase.table("todos").update(update_data).eq("id", todo_id).execute()
        print("Update response:", update_res.data)
        if update_res.data:
            print("Success! Todo was successfully updated.")
        else:
            print("Failure! No data returned. Possible RLS or mismatch issue.")
    except Exception as e:
        print("Error during update:", e)

if __name__ == "__main__":
    asyncio.run(test_update())
