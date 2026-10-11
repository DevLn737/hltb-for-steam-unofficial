import json
import sys
from datetime import datetime, timezone

import pytest

from hltb_updater import cli
from hltb_updater.client import FetchResult
from hltb_updater.database import Database
from hltb_updater.model import GameRecord
from hltb_updater.scheduler import CircuitBreakerError


@pytest.mark.parametrize("save_results", [False, True])
def test_canary_storage_is_explicit(tmp_path, monkeypatch, save_results) -> None:
    record = GameRecord(1, "Game", 120, None, None, 1, None)
    config = tmp_path / "canaries.json"
    config.write_text(json.dumps({"schema": 1, "games": [{"hltbGameId": 1, "title": "Game"}]}))
    database = Database(tmp_path / "state.sqlite")
    database.initialize()
    database.upsert(GameRecord(1, "Game", 60, None, None, 1, None), datetime(2026, 9, 5, tzinfo=timezone.utc))

    class Client:
        def __enter__(self): return self
        def __exit__(self, *_args): pass
        def fetch(self, _game_id): return FetchResult("ok", record, 200)

    monkeypatch.setattr(cli, "HltbClient", Client)
    monkeypatch.setattr("hltb_updater.database.utc_now", lambda: datetime(2026, 10, 12, tzinfo=timezone.utc))
    argv = ["hltb-updater", "canary", "--database", str(database.path), "--config", str(config)]
    monkeypatch.setattr(sys, "argv", argv + (["--save-results"] if save_results else []))
    cli.main()
    with database.connect() as connection:
        minutes, checked = connection.execute("SELECT main_minutes,last_success_at FROM games WHERE hltb_id=1").fetchone()
    assert minutes == (120 if save_results else 60)
    assert checked == ("2026-10-12" if save_results else "2026-09-05")
    assert database.get_metadata("last_update_at") is None


def test_failed_canaries_do_not_save_a_partial_set(tmp_path, monkeypatch) -> None:
    config = tmp_path / "canaries.json"
    config.write_text(json.dumps({"schema": 1, "games": [{"hltbGameId": 1}, {"hltbGameId": 2}]}))
    database = Database(tmp_path / "state.sqlite")

    class Client:
        def __enter__(self): return self
        def __exit__(self, *_args): pass
        def fetch(self, game_id):
            return FetchResult("ok", GameRecord(1, "Game", 120, None, None, 1, None), 200) if game_id == 1 else FetchResult("parse_error")

    monkeypatch.setattr(cli, "HltbClient", Client)
    monkeypatch.setattr(sys, "argv", ["hltb-updater", "canary", "--database", str(database.path), "--config", str(config), "--save-results"])
    with pytest.raises(CircuitBreakerError):
        cli.main()
    with database.connect() as connection:
        assert connection.execute("SELECT COUNT(*) FROM games").fetchone()[0] == 0
