"""
Chat Service — CareerPilot (Pillar 3: AI Assistant)

Handles business logic for conversational assistant:
  - Fetches message history
  - Saves message logs
  - Streams conversational response from Groq Llama 3.3 70B using session history and RAG context
"""

import os
import json
import re
from datetime import datetime, timezone
from typing import Any, AsyncGenerator, Optional
from groq import Groq
from db.supabase import supabase

_groq = Groq(api_key=os.environ.get("GROQ_API_KEY", ""))
_MODEL = "llama-3.3-70b-versatile"
_MEMORY_LIMIT = 10
_DEFAULT_SESSION_TITLE = "New conversation"
_SESSION_TITLE_LIMIT = 42
_ACTION_PATTERN = re.compile(
    r"<careerpilot_action>\s*[\s\S]*?\s*</careerpilot_action>",
    re.MULTILINE,
)


def _now_iso() -> str:
    """Return a timezone-aware timestamp for Supabase updates."""
    return datetime.now(timezone.utc).isoformat()


def _title_from_message(message: str) -> str:
    """Derive the persisted session title from the first user message."""
    title = " ".join(message.strip().split())
    if not title:
        return _DEFAULT_SESSION_TITLE
    if len(title) > _SESSION_TITLE_LIMIT:
        return f"{title[:_SESSION_TITLE_LIMIT]}..."
    return title


def _strip_copilot_actions(content: str) -> str:
    """Remove hidden UI action directives before persisting assistant memory."""
    return _ACTION_PATTERN.sub("", content).strip()


def _format_client_context(client_context: Optional[dict[str, Any]]) -> str:
    if not client_context:
        return ""

    allowed_keys = {
        "current_path",
        "current_page_label",
        "profile_status",
        "onboarding",
        "app_map",
    }
    compact_context = {
        key: value
        for key, value in client_context.items()
        if key in allowed_keys
    }
    return json.dumps(compact_context, ensure_ascii=True, indent=2)[:6000]


async def ensure_chat_session(user_id: str, session_id: str, message: str) -> None:
    """Create or refresh the durable chat session row."""
    existing = await supabase.table("chat_sessions").select(
        "title"
    ).eq("id", session_id).eq("user_id", user_id).limit(1).execute()

    rows = existing.data or []
    if rows:
        update_payload = {"updated_at": _now_iso()}
        if rows[0].get("title") == _DEFAULT_SESSION_TITLE:
            update_payload["title"] = _title_from_message(message)

        await supabase.table("chat_sessions").update(
            update_payload
        ).eq("id", session_id).eq("user_id", user_id).execute()
        return

    await supabase.table("chat_sessions").insert({
        "id":         session_id,
        "user_id":    user_id,
        "title":      _title_from_message(message),
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }).execute()


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
    cv_context: str,
    client_context: Optional[dict[str, Any]] = None,
) -> AsyncGenerator[str, None]:
    """
    Stream chat response from Groq Llama 3.3 70B.
    Yields Server-Sent Events (SSE) compatible string tokens.
    """
    # 1. Fetch chat history
    history = await get_chat_history(user_id, session_id)

    # 2. Build system and conversation prompt
    formatted_client_context = _format_client_context(client_context)
    action_rules = ""
    if formatted_client_context:
        action_rules = f"""

Product context from the CareerPilot app:
{formatted_client_context}

You are also the user's in-app product guide. You may recommend safe navigation,
prepared job searches, and goal/task proposals using a hidden action directive at
the very end of a response. Never claim an action has been completed unless the
UI has confirmed it after the user clicks.

Allowed hidden action directive format:
<careerpilot_action>
{{"type":"open_route","label":"Upload your CV","href":"/cv?upload=1"}}
</careerpilot_action>

Allowed action types:
- open_route: href must be a CareerPilot route from the app map.
- prefill_job_search: include label, query, optional location, optional auto.
- create_goal_with_todos: include one goal and at most five todos. This only proposes; the user must confirm.
- create_todo: include one todo. This only proposes; the user must confirm.

Do not show or explain the hidden directive in visible text. Keep visible replies
concise, practical, and page-aware.
"""

    system_prompt = (
        "You are CareerPilot, an expert career co-pilot. "
        "You help users find jobs, improve their CVs, write cover letters, and plan their careers. "
        "Always ground your answers in the user's actual CV context when available. "
        "Only reference experience, skills, education, or projects that appear in the CV context. "
        "If CV context is missing, say what you can do after a CV is uploaded instead of inventing background.\n\n"
        f"User CV context:\n{cv_context or 'No CV data available.'}"
        f"{action_rules}"
    )

    groq_messages = [{"role": "system", "content": system_prompt}]
    for msg in history:
        groq_messages.append({"role": msg["role"], "content": msg["content"]})
    groq_messages.append({"role": "user", "content": message})

    # 3. Ensure durable session tab and save user's question to Supabase
    await ensure_chat_session(user_id, session_id, message)
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
        await save_message(
            user_id,
            session_id,
            "assistant",
            _strip_copilot_actions("".join(full_reply)),
        )
        yield "data: [DONE]\n\n"

    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
