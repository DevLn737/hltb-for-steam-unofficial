from datetime import date, datetime, timezone
from pathlib import Path
import tempfile
import unittest

from hltb_updater.database import Database
from hltb_updater.model import GameRecord
from hltb_updater.progress import snapshot_progress


class ProgressTests(unittest.TestCase):
    def test_queue_refresh_through_preserves_checks_and_retry_dates(self):
        with tempfile.TemporaryDirectory() as temporary:
            database = Database(Path(temporary) / 'state.sqlite')
            database.initialize()
            for game_id in range(1, 6):
                month = 8 if game_id == 2 else 7
                database.upsert(GameRecord(game_id, f'Game {game_id}', 60, None, None, None, None),
                                datetime(2026, month, 31, tzinfo=timezone.utc))
            with database.connect() as connection:
                connection.execute("UPDATE games SET next_refresh_at='2027-07-31'")
                connection.execute("UPDATE games SET last_status='network_error' WHERE hltb_id=3")
                connection.execute('UPDATE games SET tombstoned=1 WHERE hltb_id=4')
                connection.execute("UPDATE games SET next_refresh_at='2026-11-25' WHERE hltb_id=5")
                connection.commit()
            cutoff, today = date(2026, 7, 31), date(2026, 11, 26)
            self.assertEqual(database.queue_refresh_through(cutoff, today), 1)
            self.assertEqual(database.due_ids(today, 10, set()), [5, 1])
            self.assertEqual(database.queue_refresh_through(cutoff, today), 0)
            with database.connect() as connection:
                game = connection.execute('SELECT * FROM games WHERE hltb_id=1').fetchone()
            self.assertEqual(game['last_success_at'], '2026-07-31')
            with self.assertRaises(ValueError):
                database.queue_refresh_through(today, today)

    def test_counts_only_eligible_active_records_without_relabeling_checks(self):
        with tempfile.TemporaryDirectory() as temporary:
            database = Database(Path(temporary) / 'state.sqlite')
            database.initialize()
            old = datetime(2026, 1, 1, tzinfo=timezone.utc)
            now = datetime(2026, 11, 22, 5, tzinfo=timezone.utc)
            for game_id, checked in [(1, old), (2, now), (3, old)]:
                database.upsert(GameRecord(game_id, f'Game {game_id}', 60, None, None, game_id, None), checked)
            with database.connect() as connection:
                connection.execute('UPDATE games SET tombstoned=1 WHERE hltb_id=3')
                connection.commit()
            result = snapshot_progress(database, 'state-123-1.sqlite.gz', now)
            self.assertEqual(result['dueCount'], 1)
            self.assertEqual(result['checkpoint'], 'state-123-1.sqlite.gz')
            self.assertEqual(result['schema'], 1)
            self.assertEqual(result['checkedAt'], '2026-11-22T05:00:00+00:00')
            self.assertEqual(database.records()[0]['last_success_at'], '2026-01-01')
