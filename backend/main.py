"""NagarLens API. Run from the repo root:

    .venv/Scripts/python -m uvicorn backend.main:app --reload --port 8000

Docs at http://localhost:8000/docs. The frontend (Next.js, localhost:3000) is the only intended client.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import init_db
from .deps import DATA_LAYER, state
from .routers import ai, audit, cases, overview, plan, roads, scorecards, wards


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    state()          # load the dataset and run the audit once, at start-up
    yield


app = FastAPI(title="NagarLens API", version="0.1.0", lifespan=lifespan,
              description="Follow every rupee from a complaint to a fix that held. Synthetic organizer data.")
# Local-only app: allow the web app from any localhost port (3000 by default, 3001 if 3000 is busy, ...).
app.add_middleware(CORSMiddleware, allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
                   allow_methods=["*"], allow_headers=["*"])

# Order matters: plan and ai declare /wards/{ward}/plan and /wards/{ward}/brief, which must be matched before
# the catch-all /wards/{ward} in the wards router (ward codes such as F/N contain a slash).
for r in (plan, ai, overview, audit, scorecards, cases, roads, wards):
    app.include_router(r.router, prefix="/api")


@app.get("/api/health")
def health():
    from src import ai as claude
    return {"status": "ok", "data_layer": DATA_LAYER, "ai_available": claude.available(),
            "ai_engine": claude.engine_name() if claude.available() else "offline: cached answers + templates"}
