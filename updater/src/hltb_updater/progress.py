"""Describe published collection progress without modifying working records."""
from datetime import datetime

from .database import Database


def snapshot_progress(database: Database, checkpoint: str, now: datetime) -> dict:
    with database.connect() as connection:
        due = connection.execute(
            'SELECT COUNT(*) FROM games WHERE tombstoned=0 AND next_refresh_at<=?',
            (now.date().isoformat(),),
        ).fetchone()[0]
    return {'schema': 1, 'checkpoint': checkpoint, 'checkedAt': now.isoformat(), 'dueCount': due}
