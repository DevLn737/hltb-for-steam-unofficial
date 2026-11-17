from datetime import date, datetime, timezone
import time

import pytest

from hltb_updater import scheduler
from hltb_updater.client import FetchResult
from hltb_updater.database import Database
from hltb_updater.model import GameRecord


@pytest.mark.parametrize('catch_up', [False, True])
def test_time_budget_finishes_response_and_resumes_remaining_work(tmp_path, monkeypatch, catch_up):
    database = Database(tmp_path / 'state.sqlite')
    database.initialize()
    for game_id in [1, 2]:
        database.upsert(GameRecord(game_id, f'Game {game_id}', 60, None, None, game_id, None),
                        datetime(2025, 1, 1, tzinfo=timezone.utc))
    elapsed = [0.0]
    calls = []

    class Client:
        def fetch(self, game_id):
            calls.append(game_id)
            elapsed[0] += 2
            return FetchResult('ok', GameRecord(game_id, f'Game {game_id}', 90, None, None, game_id, None), 200)

    monkeypatch.setattr(time, 'monotonic', lambda: elapsed[0])
    if catch_up:
        database.initialize_catch_up(date(2026, 11, 17), datetime.now(timezone.utc))
    mode, cutoff, stats = scheduler.run_update_cycle(database, Client(), max_tail=0, max_refresh=2,
                                                     catch_up_limit=2, max_seconds=1)
    assert calls == [1]
    assert stats.budget_exhausted
    rows = {row['hltb_id']: row for row in database.records()}
    assert rows[1]['main_minutes'] == 90
    assert rows[2]['main_minutes'] == 60
    if catch_up:
        assert database.catch_up_status(cutoff)['pending'] == 1
        scheduler.run_update_cycle(database, Client(), max_seconds=100)
        assert calls == [1, 2]
