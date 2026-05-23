"""
Chat Service — CareerPilot (Pillar 3: AI Assistant)

Handles business logic for conversational assistant:
  - Fetches message history
  - Saves message logs
  - Streams conversational response from Groq Llama 3.3 70B using session history and RAG context
"""

import os
import json
from typing import AsyncGenerator
from groq import Groq
from db.supabase import supabase

_groq = Groq(api_key=os.environ.get("GROQ_API_KEY", ""))
_MODEL = "llama-3.3-70b-versatile"
_MEMORY_LIMIT = 10


async def get_chat_history(user_id: str, session_id: str) -> list[dict]:
    """Fetch last N messages for a chat session from Supabase in chronological order."""
    result = await supabase.table("chat_messages").select(
        "role, content"
    ).eq("user_id", user_id).eq("session_id", session_id).order(
        "created_at", desc=True
    ).limit(_MEMORY_LIMIT).execute()

    messages = result.data or []
    return list(reversed(messages))


async def save_message(user_id: str, session_id: str, role: str, content: str) -> None:
    """Persist a chat message to Supabase."""
    await supabase.table("chat_messages").insert({
        "user_id":    user_id,
        "session_id": session_id,
        "role":       role,
        "content":    content,
    }).execute()


async def stream_chat(
    user_id: str,
    session_id: str,
    message: str,
    cv_context: str
) -> AsyncGenerator[str, None]:
    """
    Stream chat response from Groq Llama 3.3 70B.
    Yields Server-Sent Events (SSE) compatible string tokens.
    """
    # 1. Fetch chat history
    history = await get_chat_history(user_id, session_id)

    # 2. Build system and conversation prompt
    system_prompt = (
        "You are CareerPilot AI, an expert career co-pilot. "
        "You help users find jobs, improve their CVs, write cover letters, and plan their careers. "
        "Always ground your answers in the user's actual CV context when available.\n\n"
        f"User CV context:\n{cv_context or 'No CV data available.'}"
    )

    groq_messages = [{"role": "system", "content": system_prompt}]
    for msg in history:
        groq_messages.append({"role": msg["role"], "content": msg["content"]})
    groq_messages.append({"role": "user", "content": message})

    # 3. Save user's question to Supabase
    await save_message(user_id, session_id, "user", message)

    # 4. Stream response from Groq
    full_reply = []
    try:
        stream = _groq.chat.completions.create(
            model=_MODEL,
            messages=groq_messages,
            stream=True,
            temperature=0.4,
            max_tokens=1024,
        )
        for chunk in stream:
            token = chunk.choices[0].delta.content or ""
            if token:
                full_reply.append(token)
                yield f"data: {json.dumps({'token': token})}\n\n"

        # 5. Save assistant's answer once fully streamed
        await save_message(user_id, session_id, "assistant", "".join(full_reply))
        yield "data: [DONE]\n\n"

    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
