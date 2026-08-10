from datetime import datetime, timedelta, timezone
import json

from hltb_updater.database import Database
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

