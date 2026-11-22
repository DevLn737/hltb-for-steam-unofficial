from datetime import datetime, timezone
import unittest
from unittest.mock import patch
import io
import json
import subprocess

from hltb_updater.schedule import backlog_pending, collection_due, main


class ScheduleTests(unittest.TestCase):
    def test_published_pending_work_continues_without_waiting_six_hours(self):
        self.assertTrue(collection_due('2026-11-22T02:00:00Z', datetime(2026, 11, 22, 4, tzinfo=timezone.utc), backlog=True))

    def test_only_the_current_checkpoint_can_enable_acceleration(self):
        self.assertTrue(backlog_pending({'schema': 1, 'checkpoint': 'state-123-1.sqlite.gz', 'dueCount': 14}, 'state-123-1.sqlite.gz'))
        self.assertFalse(backlog_pending({'schema': 1, 'checkpoint': 'state-122-1.sqlite.gz', 'dueCount': 14}, 'state-123-1.sqlite.gz'))
        self.assertFalse(backlog_pending(None, 'state-123-1.sqlite.gz'))

    def test_drained_queue_returns_to_regular_interval(self):
        self.assertFalse(backlog_pending({'schema': 1, 'checkpoint': 'state-123-1.sqlite.gz', 'dueCount': 0}, 'state-123-1.sqlite.gz'))
        self.assertFalse(collection_due('2026-11-22T02:00:00Z', datetime(2026, 11, 22, 4, tzinfo=timezone.utc), backlog=False))

    def test_corrupt_pending_count_fails_closed(self):
        for count in [-1, True, '14', None]:
            with self.assertRaises(ValueError):
                backlog_pending({'schema': 1, 'checkpoint': 'state-123-1.sqlite.gz', 'dueCount': count}, 'state-123-1.sqlite.gz')

    def test_missing_checkpoint_is_due(self):
        self.assertTrue(collection_due(None, datetime(2026, 11, 18, tzinfo=timezone.utc)))

    def test_recent_actual_collection_skips_redundant_tick(self):
        self.assertFalse(collection_due('2026-11-17T20:53:20Z', datetime(2026, 11, 18, 1, 17, tzinfo=timezone.utc)))

    def test_six_hour_boundary_and_later_retry_are_due(self):
        for hour, minute in [(2, 53), (3, 37), (9, 37)]:
            self.assertTrue(collection_due('2026-11-17T20:53:00Z', datetime(2026, 11, 18, hour, minute, tzinfo=timezone.utc)))

    def test_explicit_manual_override_runs_early(self):
        self.assertTrue(collection_due('2026-11-18T01:00:00Z', datetime(2026, 11, 18, 1, 17, tzinfo=timezone.utc), force=True))

    def test_invalid_or_future_state_does_not_silently_restart(self):
        for value in ['invalid', '2026-11-18T10:00:00Z', '2026-11-17T20:00:00']:
            with self.assertRaises(ValueError):
                collection_due(value, datetime(2026, 11, 18, tzinfo=timezone.utc))

    def test_rerunning_without_a_checkpoint_does_not_postpone_collection(self):
        class Clock(datetime):
            @classmethod
            def now(cls, tz=None):
                return cls(2026, 11, 18, 3, tzinfo=timezone.utc)

        release = subprocess.CompletedProcess([], 0, json.dumps({'assets': [{
            'name': 'state-123-1.sqlite.gz', 'id': 1, 'created_at': '2026-11-17T21:30:00Z',
        }]}), '')

        def api(command, **_kwargs):
            started = '2026-11-17T20:00:00Z' if command[-1].endswith('/attempts/1') else '2026-11-18T02:30:00Z'
            return json.dumps({'run_started_at': started})

        output = io.StringIO()
        with patch.dict('os.environ', {'GITHUB_REPOSITORY': 'owner/repo'}, clear=True), \
                patch('hltb_updater.schedule.datetime', Clock), \
                patch('hltb_updater.schedule.subprocess.run', return_value=release), \
                patch('hltb_updater.schedule.subprocess.check_output', side_effect=api), \
                patch('sys.stdout', output):
            main()
        self.assertIn('Collect: True', output.getvalue())
