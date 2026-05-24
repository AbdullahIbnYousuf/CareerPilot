"""
CareerPilot — FastAPI Application Entry Point

Routers (one per pillar, as per AGENTS.md):
  /cv        → Pillar 2: CV Intelligence
  /jobs      → Pillar 1: Job Hunter Agent
  /chat      → Pillar 3: AI Assistant (Groq streaming SSE)
  /tracker   → Pillar 4: Kanban Tracker
  /dashboard → Pillar 4: Progress Dashboard + Nudges
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import cv, jobs, chat, tracker, dashboard

app = FastAPI(
    title="CareerPilot API",
    description="AI-powered career co-pilot — job hunting, CV intelligence, streaming chat, and productivity tracking.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register pillar routers
app.include_router(cv.router)
app.include_router(jobs.router)
app.include_router(chat.router)
app.include_router(tracker.router)
app.include_router(dashboard.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "careerpilot-api"}