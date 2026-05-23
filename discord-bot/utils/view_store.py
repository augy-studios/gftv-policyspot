import json
import logging
import time

import aiosqlite

log = logging.getLogger('policyspot.view_store')

_DB_PATH = 'view_states.db'


async def init_db(path: str = 'view_states.db') -> None:
    global _DB_PATH
    _DB_PATH = path
    async with aiosqlite.connect(_DB_PATH) as db:
        await db.execute(
            '''CREATE TABLE IF NOT EXISTS view_states (
                   message_id INTEGER PRIMARY KEY,
                   view_type  TEXT    NOT NULL,
                   state      TEXT    NOT NULL,
                   saved_at   REAL    NOT NULL
               )'''
        )
        await db.commit()
    log.info('View-state DB initialised at %s', path)


async def save(message_id: int, view_type: str, state: dict) -> None:
    async with aiosqlite.connect(_DB_PATH) as db:
        await db.execute(
            '''INSERT INTO view_states (message_id, view_type, state, saved_at)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(message_id) DO UPDATE SET
                   view_type = excluded.view_type,
                   state     = excluded.state,
                   saved_at  = excluded.saved_at''',
            (message_id, view_type, json.dumps(state), time.time()),
        )
        await db.commit()


async def delete(message_id: int) -> None:
    async with aiosqlite.connect(_DB_PATH) as db:
        await db.execute('DELETE FROM view_states WHERE message_id = ?', (message_id,))
        await db.commit()


async def load_all() -> list[tuple[int, str, dict]]:
    async with aiosqlite.connect(_DB_PATH) as db:
        async with db.execute(
            'SELECT message_id, view_type, state FROM view_states ORDER BY saved_at'
        ) as cursor:
            rows = await cursor.fetchall()
    return [(int(row[0]), row[1], json.loads(row[2])) for row in rows]
