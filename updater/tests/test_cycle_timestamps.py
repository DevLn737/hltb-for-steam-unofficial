from collections import deque
from datetime import date, datetime, timezone

import pytest

from hltb_updater import scheduler
from hltb_updater.client import FetchResult
from hltb_updater.database import Database
from hltb_updater.model import GameRecord


START = datetime(2026, 10, 11, 23, 59, 59, tzinfo=timezone.utc)
RESPONSE = datetime(2026, 10, 12, 0, 0, 1, tzinfo=timezone.utc)
COMPLETE = datetime(2026, 10, 12, 0, 0, 2, tzinfo=timezone.utc)


@pytest.mark.parametrize("catch_up", [False, True])
def test_midnight_checks_use_response_date_and_cycle_completion_time(tmp_path, monkeypatch, catch_up) -> None:
    database = Database(tmp_path / "state.sqlite")
    database.initialize()
    record = GameRecord(1, "Game", 60, None, None, 1, None)
    database.upsert(record, datetime(2026, 9, 5, tzinfo=timezone.utc))
    clock = deque([START, RESPONSE, COMPLETE])
    monkeypatch.setattr(scheduler, "utc_now", clock.popleft)

    class Client:
        def fetch(self, game_id):
            assert game_id == 1
            return FetchResult("ok", record, 200)

    if catch_up:
        cutoff = date(2026, 10, 11)
        database.initialize_catch_up(cutoff, START)
        scheduler.refresh_catch_up(database, Client(), cutoff, max_refresh=1)
    else:
        scheduler.update_database(database, Client(), max_tail=0, max_refresh=0)
    with database.connect() as connection:
        row = connection.execute("SELECT last_success_at,last_checked_at FROM games WHERE hltb_id=1").fetchone()
    assert tuple(row) == ("2026-10-12", "2026-10-12")
    assert database.get_metadata("last_update_started_at") == START.isoformat()
    assert database.get_metadata("last_update_at") == COMPLETE.isoformat()
    assert scheduler.check_publication_readiness(database, now=COMPLETE) == COMPLETE


def test_failed_cycle_preserves_previous_completion_and_blocks_publication(tmp_path, monkeypatch) -> None:
    database = Database(tmp_path / "state.sqlite")
    database.initialize()
    database.upsert(GameRecord(1, "Game", 60, None, None, 1, None), START)
    database.set_metadata("last_update_at", START.isoformat())
    monkeypatch.setattr(scheduler, "utc_now", lambda: RESPONSE)

    class Client:
        def fetch(self, _game_id):
            return FetchResult("forbidden", status_code=403)

    with pytest.raises(scheduler.CircuitBreakerError):
        scheduler.update_database(database, Client(), max_tail=0, max_refresh=0)
    assert database.get_metadata("last_update_at") == START.isoformat()
    with pytest.raises(ValueError, match="latest updater cycle"):
        scheduler.check_publication_readiness(database, now=COMPLETE)


def test_fresh_canary_cannot_make_an_unsuccessful_collection_publishable(tmp_path, monkeypatch):
    database = Database(tmp_path / 'state.sqlite')
    database.initialize()
    database.upsert(GameRecord(1, 'Fresh canary', 60, None, None, 1, None), RESPONSE)
    database.set_metadata('last_update_at', START.isoformat())
    monkeypatch.setattr(scheduler, 'utc_now', lambda: COMPLETE)

    class Client:
        def fetch(self, _game_id):
            return FetchResult('network_error', status_code=503)

    stats = scheduler.update_database(database, Client(), max_tail=0, max_refresh=0)
    assert stats.found == 0
    assert database.get_metadata('last_update_at') == START.isoformat()
    with pytest.raises(ValueError, match='latest updater cycle'):
        scheduler.check_publication_readiness(database, now=COMPLETE)
