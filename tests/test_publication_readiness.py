from datetime import date, datetime, timedelta, timezone

import pytest

from hltb_updater.database import Database
from hltb_updater.model import GameRecord
from hltb_updater.scheduler import check_publication_readiness

NOW = datetime(2026, 10, 12, 0, 0, tzinfo=timezone.utc)


def database_with_cycle(tmp_path, completed_at: datetime) -> Database:
    database = Database(tmp_path / "state.sqlite")
    database.initialize()
    database.upsert(GameRecord(1, "Game", 60, None, None, 1, None), completed_at)
    database.set_metadata("last_update_at", completed_at.isoformat())
    return database


def test_rejects_september_data_during_october_publication(tmp_path) -> None:
    database = database_with_cycle(tmp_path, datetime(2026, 9, 7, tzinfo=timezone.utc))
    with pytest.raises(ValueError, match="too old"):
        check_publication_readiness(database, now=NOW)


def test_accepts_recent_completed_refresh(tmp_path) -> None:
    completed = NOW - timedelta(hours=2)
    database = database_with_cycle(tmp_path, completed)
    assert check_publication_readiness(database, now=NOW) == completed


@pytest.mark.parametrize("timestamp", [None, "invalid", "2026-10-12T00:00:00", "2026-10-13T00:00:00+00:00"])
def test_rejects_missing_or_invalid_cycle_timestamp(tmp_path, timestamp) -> None:
    database = database_with_cycle(tmp_path, NOW)
    database.set_metadata("last_update_at", timestamp or "")
    with pytest.raises(ValueError):
        check_publication_readiness(database, now=NOW)


def test_rejects_a_cycle_with_only_failed_refreshes(tmp_path) -> None:
    database = database_with_cycle(tmp_path, NOW - timedelta(days=2))
    database.set_metadata("last_update_at", NOW.isoformat())
    with pytest.raises(ValueError, match="no successful"):
        check_publication_readiness(database, now=NOW)


def test_waits_for_an_incomplete_catch_up_cohort(tmp_path) -> None:
    database = database_with_cycle(tmp_path, NOW - timedelta(hours=2))
    database.upsert(GameRecord(2, "Overdue Game", 60, None, None, 2, None), NOW - timedelta(days=40))
    database.initialize_catch_up(date(2026, 10, 12), NOW)
    with pytest.raises(ValueError, match="catch-up"):
        check_publication_readiness(database, now=NOW)
