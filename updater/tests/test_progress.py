from datetime import datetime, timezone
from pathlib import Path
import tempfile
import unittest

from hltb_updater.database import Database
from hltb_updater.model import GameRecord
from hltb_updater.progress import snapshot_progress


class ProgressTests(unittest.TestCase):
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
