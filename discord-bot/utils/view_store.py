"""Saves the state of each interactive message (which page, which section…)
in a small SQLite file, so the buttons keep working after the bot restarts."""

import json
import logging
import time

import aiosqlite

logger = logging.getLogger('policyspot.view_store')

_database_path = 'view_states.db'


async def init_db(path: str = 'view_states.db') -> None:
    """Create the view_states table if it does not exist yet."""
    global _database_path
    _database_path = path
    async with aiosqlite.connect(_database_path) as connection:
        await connection.execute(
            '''CREATE TABLE IF NOT EXISTS view_states (
                   message_id INTEGER PRIMARY KEY,
                   view_type  TEXT    NOT NULL,
                   state      TEXT    NOT NULL,
                   saved_at   REAL    NOT NULL
               )'''
        )
        await connection.commit()
    logger.info('View-state DB initialised at %s', path)


async def save(message_id: int, view_type: str, state: dict) -> None:
    """Insert or replace the saved state for one message."""
    async with aiosqlite.connect(_database_path) as connection:
        await connection.execute(
            '''INSERT INTO view_states (message_id, view_type, state, saved_at)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(message_id) DO UPDATE SET
                   view_type = excluded.view_type,
                   state     = excluded.state,
                   saved_at  = excluded.saved_at''',
            (message_id, view_type, json.dumps(state), time.time()),
        )
        await connection.commit()


async def delete(message_id: int) -> None:
    """Forget the saved state for one message."""
    async with aiosqlite.connect(_database_path) as connection:
        await connection.execute('DELETE FROM view_states WHERE message_id = ?', (message_id,))
        await connection.commit()


async def load_all() -> list[tuple[int, str, dict]]:
    """Return every saved (message_id, view_type, state), oldest first."""
    async with aiosqlite.connect(_database_path) as connection:
        async with connection.execute(
            'SELECT message_id, view_type, state FROM view_states ORDER BY saved_at'
        ) as cursor:
            rows = await cursor.fetchall()
    saved_views = []
    for message_id, view_type, state_json in rows:
        saved_views.append((int(message_id), view_type, json.loads(state_json)))
    return saved_views
