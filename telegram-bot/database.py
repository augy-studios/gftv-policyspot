import json
import sqlite3
import time
from pathlib import Path

DB_PATH = Path(__file__).parent / "data" / "bot.db"


def _conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(exist_ok=True)
    return sqlite3.connect(DB_PATH)


def init_db() -> None:
    with _conn() as con:
        con.executescript("""
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

            CREATE TABLE IF NOT EXISTS user_state (
                user_id    INTEGER PRIMARY KEY,
                state      TEXT    NOT NULL,
                updated_at INTEGER NOT NULL
            );
        """)


# ── Cache ─────────────────────────────────────────────────────────────────────

def cache_get(key: str):
    with _conn() as con:
        row = con.execute(
            "SELECT value, expires_at FROM cache WHERE key = ?", (key,)
        ).fetchone()
    if row and row[1] > int(time.time()):
        return json.loads(row[0])
    return None


def cache_set(key: str, value, ttl: int = 300) -> None:
    with _conn() as con:
        con.execute(
            "INSERT OR REPLACE INTO cache (key, value, expires_at) VALUES (?, ?, ?)",
            (key, json.dumps(value), int(time.time()) + ttl),
        )


def cache_purge_expired() -> None:
    with _conn() as con:
        con.execute("DELETE FROM cache WHERE expires_at <= ?", (int(time.time()),))


# ── Search state ──────────────────────────────────────────────────────────────

def save_search(user_id: int, query: str, results: list) -> None:
    with _conn() as con:
        con.execute(
            "INSERT OR REPLACE INTO user_search (user_id, query, results, updated_at)"
            " VALUES (?, ?, ?, ?)",
            (user_id, query, json.dumps(results), int(time.time())),
        )


def get_search(user_id: int) -> tuple[str | None, list]:
    with _conn() as con:
        row = con.execute(
            "SELECT query, results FROM user_search WHERE user_id = ?", (user_id,)
        ).fetchone()
    if row:
        return row[0], json.loads(row[1])
    return None, []


# ── User state ────────────────────────────────────────────────────────────────

def set_user_state(user_id: int, state: str) -> None:
    with _conn() as con:
        con.execute(
            "INSERT OR REPLACE INTO user_state (user_id, state, updated_at) VALUES (?, ?, ?)",
            (user_id, state, int(time.time())),
        )


def get_user_state(user_id: int) -> str | None:
    with _conn() as con:
        row = con.execute(
            "SELECT state FROM user_state WHERE user_id = ?", (user_id,)
        ).fetchone()
    return row[0] if row else None


def clear_user_state(user_id: int) -> None:
    with _conn() as con:
        con.execute("DELETE FROM user_state WHERE user_id = ?", (user_id,))
