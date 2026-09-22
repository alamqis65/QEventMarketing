"""
EventQ Backend API

Thin bridge between the EventQ frontend and PostgreSQL.
The frontend uses logical state keys (qis_users, qis_events, etc.)
and writes the full JSON payload for each key. The backend projects
normalized relational data into those shapes.

Run directly for local testing:
    uvicorn app.main:app --host 0.0.0.0 --port 3000 --reload

Run in production via IIS reverse proxy at /EventQ/api.
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Union

from . import db, config

app = FastAPI(title="EventQ Backend", version="2.0.0")

origins = ["*"] if config.CORS_ORIGINS.strip() == "*" else [
    o.strip() for o in config.CORS_ORIGINS.split(",") if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Valid state keys the frontend may use
VALID_STATE_KEYS = {
    'qis_users', 'qis_events', 'qis_custom_qrs', 'qis_custom_barcodes',
    'qis_setting_bg_login_list',
}
# Pattern-validated keys: qis_guests_<eventId>, qis_setting_<settingKey>

import re
_GUESTS_KEY_RE = re.compile(r'^qis_guests_[A-Za-z0-9_-]+$')
_SETTINGS_KEY_RE = re.compile(r'^qis_setting_[a-z_]+$')


def _is_valid_key(key: str) -> bool:
    if key in VALID_STATE_KEYS:
        return True
    if _GUESTS_KEY_RE.match(key):
        return True
    if _SETTINGS_KEY_RE.match(key):
        return True
    return False


@app.on_event("startup")
def on_startup():
    db.init_pool()
    db.init_db()


class StateBody(BaseModel):
    value: Union[str, list, dict, None] = None


# ─── Health check ───────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok"}


# ─── State endpoints (logical keys → normalized tables) ──────────────────

@app.get("/api/state")
def get_all_state():
    """Return the full application state projected into the legacy frontend shape."""
    try:
        return db.state_get_all()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")


@app.get("/api/state/{key}")
def get_state(key: str):
    """Return one logical state key's value."""
    if not _is_valid_key(key):
        raise HTTPException(status_code=400, detail=f"Invalid key: {key}")
    try:
        all_state = db.state_get_all()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")
    if key not in all_state:
        raise HTTPException(status_code=404, detail="Key not found")
    return {"key": key, "value": all_state[key]}


@app.put("/api/state/{key}")
def put_state(key: str, body: StateBody):
    """Import a full JSON payload for a logical state key."""
    if not _is_valid_key(key):
        raise HTTPException(status_code=400, detail=f"Invalid key: {key}")
    if body.value is None:
        raise HTTPException(status_code=400, detail="Missing 'value' field")
    try:
        db.state_set(key, body.value)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")
    return {"key": key, "saved": True}


@app.delete("/api/state/{key}")
def delete_state(key: str):
    """Remove data for a logical state key."""
    if not _is_valid_key(key):
        raise HTTPException(status_code=400, detail=f"Invalid key: {key}")
    try:
        db.state_delete(key)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")
    return {"key": key, "deleted": True}
