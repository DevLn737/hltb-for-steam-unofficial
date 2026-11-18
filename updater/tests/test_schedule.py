from datetime import datetime, timezone
import unittest
from unittest.mock import patch
import io
import json
import subprocess

from hltb_updater.schedule import collection_due, main


class ScheduleTests(unittest.TestCase):
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
