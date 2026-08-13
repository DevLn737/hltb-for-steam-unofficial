from datetime import datetime, timedelta, timezone
import json

from hltb_updater.database import Database, initial_refresh
from hltb_updater.importer import import_json
from hltb_updater.model import GameRecord, extract_record


def source(game_id: int = 1, title: str = "Example") -> dict:
    return {"game": [{
        "game_id": game_id,
        "game_name": title,
        "comp_main": 3600,
        "comp_plus": 0,
        "comp_100": 7260,
        "profile_steam": 100,
        "profile_steam_alt": None,
    }]}


def test_extracts_only_extension_fields() -> None:
    record = extract_record(source())
    assert record == GameRecord(1, "Example", 60, None, 121, 100, None)


def test_streaming_import_populates_sqlite(tmp_path) -> None:
    raw = tmp_path / "source.json"
    raw.write_text(json.dumps([source(1), source(2, "Second"), {"game": []}]), encoding="utf-8")
    database = Database(tmp_path / "state.sqlite")
    database.initialize()
    assert import_json(database, raw, "2026-07-22") == (3, 2)
    assert database.max_id() == 2
    assert len(database.records()) == 2
    assert database.get_metadata("source_entry_count") == "3"


def test_initial_import_prioritizes_steam_games_without_times(tmp_path) -> None:
    database = Database(tmp_path / "state.sqlite")
    database.initialize()
    checked = datetime(2026, 7, 22, tzinfo=timezone.utc)
    record = GameRecord(187956, "Succubus Successor", None, None, None, 3628950, None)
    database.upsert(record, checked, initial=True)
    row = database.records()[0]
    assert row["next_refresh_at"] == initial_refresh(record, checked)
    assert datetime.fromisoformat(row["next_refresh_at"]).date() <= checked.date() + timedelta(days=13)


def test_rebalances_only_legacy_import_schedule(tmp_path) -> None:
    database = Database(tmp_path / "state.sqlite")
    database.initialize()
    checked = datetime(2026, 7, 22, tzinfo=timezone.utc)
    record = GameRecord(187956, "Succubus Successor", None, None, None, 3628950, None)
    database.upsert(record, checked, initial=True)
    legacy_due = (checked + timedelta(days=record.hltb_id % 365)).date().isoformat()
    with database.connect() as connection:
        connection.execute("UPDATE games SET next_refresh_at=? WHERE hltb_id=?", (legacy_due, record.hltb_id))
        connection.commit()
    assert database.rebalance_legacy_import_schedule() == 1
    assert database.records()[0]["next_refresh_at"] == initial_refresh(record, checked)
    assert database.rebalance_legacy_import_schedule() == 0


def test_tombstone_requires_three_separate_404_days_over_thirty_days(tmp_path) -> None:
    database = Database(tmp_path / "state.sqlite")
    database.initialize()
    record = GameRecord(1, "Example", 60, None, None, 100, None)
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    database.upsert(record, start)
    database.mark_missing(1, start)
    database.mark_missing(1, start)
    database.mark_missing(1, start + timedelta(days=10))
    assert len(database.records()) == 1
    database.mark_missing(1, start + timedelta(days=31))
    assert database.records() == []


def test_failed_checks_do_not_advance_last_success_date(tmp_path) -> None:
    database = Database(tmp_path / "state.sqlite")
    database.initialize()
    record = GameRecord(1, "Example", 60, None, None, 100, None)
    success = datetime(2026, 1, 1, tzinfo=timezone.utc)
    database.upsert(record, success)
    database.mark_error(1, "rate_limited", 429, success + timedelta(days=5))
    row = database.records()[0]
    assert row["last_checked_at"] == "2026-01-06"
    assert row["last_success_at"] == "2026-01-01"
    database.mark_missing(1, success + timedelta(days=10))
    row = database.records()[0]
    assert row["last_checked_at"] == "2026-01-11"
    assert row["last_success_at"] == "2026-01-01"


def test_initialize_migrates_existing_database_with_conservative_success_date(tmp_path) -> None:
    database = Database(tmp_path / "state.sqlite")
    database.initialize()
    with database.connect() as connection:
        connection.execute("ALTER TABLE games RENAME TO games_current")
        connection.execute("CREATE TABLE games AS SELECT hltb_id,title,main_minutes,extra_minutes,completion_minutes,steam_app_id,steam_alt_app_id,first_seen_at,last_checked_at,last_changed_at,next_refresh_at,content_hash,last_status,status_code,error_count,missing_count,first_missing_at,last_missing_at,tombstoned FROM games_current")
        connection.execute("DROP TABLE games_current")
        connection.execute("INSERT INTO games VALUES (1,'Example',60,NULL,NULL,100,NULL,'2026-01-01','2026-01-10','2026-01-01','2026-02-01','hash','error',403,1,0,NULL,NULL,0)")
        connection.commit()
    database.initialize()
    row = database.records()[0]
    assert row["last_success_at"] == "2026-01-01"
