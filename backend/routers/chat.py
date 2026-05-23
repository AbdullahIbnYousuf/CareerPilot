"""
Chat Router — CareerPilot (Pillar 3: AI Assistant)

Streaming chat via Server-Sent Events (SSE).
LLM: Llama 3.3 70B via Groq (NEVER use Gemini for chat).
RAG: hybrid_search over user's cv_chunks for context injection.
Memory: last N messages fetched from chat_messages table.
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from services.searcher import hybrid_search
from services.chat import stream_chat

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    user_id: str
    session_id: str
    message: str


@router.post("/")
async def chat_endpoint(req: ChatRequest):
    """
    Streaming SSE chat endpoint.
    1. Fetch CV context via hybrid_search (RAG)
    2. Delegate conversation memory and streaming to Chat Service
    """
    # 1. RAG — get CV context
    try:
        cv_chunks = await hybrid_search(
            query=req.message,
            user_id=req.user_id,
            match_count=5,
        )
        cv_context = "\n".join(c["content"] for c in cv_chunks)
    except Exception:
        cv_context = "No CV uploaded yet."

    # 2. Return SSE streaming response from service
    async def event_generator():
        async for chunk in stream_chat(
            user_id=req.user_id,
            session_id=req.session_id,
            message=req.message,
            cv_context=cv_context
        ):
            yield chunk

    return StreamingResponse(event_generator(), media_type="text/event-stream")
