"""
EventQ Backend - Configuration
Reads all settings from environment variables (loaded from .env by python-dotenv).
Fill in the real DB_USER / DB_PASSWORD in your .env on the server - never commit real
credentials to source control.
"""
import os
from dotenv import load_dotenv

load_dotenv()

def _bool(val, default=False):
    if val is None:
        return default
    return str(val).strip().lower() in ("1", "true", "yes", "on")

# --- PostgreSQL connection (DB server: 192.168.90.93) ---
DB_HOST = os.getenv("DB_HOST", "192.168.90.93")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "eventq")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")

# --- API server ---
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "3000"))

# Comma separated list of allowed origins for CORS.
# Example: "http://192.168.90.23,https://your-public-domain.com"
# Use "*" only for quick testing - tighten this once IIS/ARR is in front of it.
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")

DEBUG = _bool(os.getenv("DEBUG"), False)

# Large-removal guard: when a save would drop more than 20% of existing rows the API answers
# 409 and the frontend asks for confirmation again. The app has no bulk-delete feature and
# every delete already has its own confirmation dialog, so the extra prompt only got in the
# way (deleting 1 of 2 guests = 50%). Set REMOVAL_GUARD=true in .env to bring it back.
REMOVAL_GUARD = _bool(os.getenv("REMOVAL_GUARD"), False)
