"""Small SQLite store for the bot: a cache of Supabase data and each user's
most recent search (so search result buttons keep working)."""

import json
import sqlite3
import time
from pathlib import Path

DATABASE_PATH = Path(__file__).parent / "data" / "bot.db"


def _connect() -> sqlite3.Connection:
    """Open the SQLite database file, creating its folder if needed."""
    DATABASE_PATH.parent.mkdir(exist_ok=True)
    return sqlite3.connect(DATABASE_PATH)


def init_db() -> None:
    """Create the database tables if they do not exist yet."""
    with _connect() as connection:
        connection.executescript("""
            CREATE TABLE IF NOT EXISTS cache (
                key        TEXT    PRIMARY KEY,
                value      TEXT    NOT NULL,
                expires_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS user_search (
                user_id    INTEGER PRIMARY KEY,
                query      TEXT    NOT NULL,
                results    TEXT    NOT NULL,
                updated_at INTEGER NOT NULL
            );
        """)


# ── Cache ─────────────────────────────────────────────────────────────────────

def cache_get(key: str):
    """Return the cached value for "key", or None if it is missing or expired."""
    with _connect() as connection:
        row = connection.execute(
            "SELECT value, expires_at FROM cache WHERE key = ?", (key,)
        ).fetchone()
    if row:
        stored_value, expires_at = row
        if expires_at > int(time.time()):
            return json.loads(stored_value)
    return None


def cache_set(key: str, value, time_to_live_seconds: int = 300) -> None:
    """Store "value" (as JSON) under "key" for the given number of seconds."""
    with _connect() as connection:
        connection.execute(
            "INSERT OR REPLACE INTO cache (key, value, expires_at) VALUES (?, ?, ?)",
            (key, json.dumps(value), int(time.time()) + time_to_live_seconds),
        )


def cache_purge_expired() -> None:
    """Delete every cache entry whose time has run out."""
    with _connect() as connection:
        connection.execute("DELETE FROM cache WHERE expires_at <= ?", (int(time.time()),))


# ── Search state ──────────────────────────────────────────────────────────────

def save_search(user_id: int, query: str, results: list) -> None:
    """Remember a user's latest search so its result buttons can be used later."""
    with _connect() as connection:
        connection.execute(
            "INSERT OR REPLACE INTO user_search (user_id, query, results, updated_at)"
            " VALUES (?, ?, ?, ?)",
            (user_id, query, json.dumps(results), int(time.time())),
        )


def get_search(user_id: int) -> tuple[str | None, list]:
    """Return (query, results) of the user's latest search, or (None, []) if none."""
    with _connect() as connection:
        row = connection.execute(
            "SELECT query, results FROM user_search WHERE user_id = ?", (user_id,)
        ).fetchone()
    if row:
        saved_query, saved_results_json = row
        return saved_query, json.loads(saved_results_json)
    return None, []
