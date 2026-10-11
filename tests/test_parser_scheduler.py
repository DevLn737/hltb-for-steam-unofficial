from collections import deque

import pytest

from hltb_updater.client import FetchResult
from hltb_updater.database import Database
from hltb_updater.model import GameRecord
from hltb_updater.parser import parse_game_page
from hltb_updater.scheduler import (
    CircuitBreakerError,
    check_canaries,
    refresh_catch_up,
    run_update_cycle,
    update_database,
)


def html(record: dict) -> str:
    import json
    payload = {"props": {"pageProps": {"game": {"data": {"game": [record]}}}}}
    return f'<html><script id="__NEXT_DATA__" type="application/json">{json.dumps(payload)}</script></html>'


def test_parses_next_data_payload() -> None:
    record = parse_game_page(html({
        "game_id": 123, "game_name": "Test Game", "comp_main": 3600,
        "comp_plus": 5400, "comp_100": 7200, "profile_steam": 500,
    }))
    assert record == GameRecord(123, "Test Game", 60, 90, 120, 500, None)


def test_rejects_page_without_game_payload() -> None:
    with pytest.raises(ValueError):
        parse_game_page("<html>blocked</html>")


class FakeClient:
    def __init__(self, results: list[FetchResult]) -> None:
        self.results = deque(results)

    def fetch(self, _game_id: int) -> FetchResult:
        return self.results.popleft() if self.results else FetchResult("missing", status_code=404)


def test_canary_breaks_on_parser_failure() -> None:
    with pytest.raises(CircuitBreakerError):
        check_canaries(FakeClient([FetchResult("parse_error")]), [{"hltbGameId": 1, "title": None}])  # type: ignore[arg-type]


def test_canaries_return_the_successfully_validated_records() -> None:
    record = GameRecord(1, "Game", 60, None, None, 1, None)
    client = FakeClient([FetchResult("ok", record, 200)])
    assert check_canaries(client, [{"hltbGameId": 1, "title": "Game"}]) == [record]  # type: ignore[arg-type]


def test_tail_scan_stops_after_500_forward_404s(tmp_path) -> None:
    database = Database(tmp_path / "state.sqlite")
    database.initialize()
    database.upsert(GameRecord(1000, "Frontier", 1, None, None, None, None), __import__("datetime").datetime.now(__import__("datetime").timezone.utc))
    results = [FetchResult("ok", GameRecord(1000, "Frontier", 1, None, None, None, None), 200)]
    # The overlap begins at 751; missing results are harmless, then ID 1000 resets the forward counter.
    client = FakeClient([FetchResult("missing", status_code=404)] * 249 + results + [FetchResult("missing", status_code=404)] * 500)
    stats = update_database(database, client, max_tail=2000, max_refresh=0)  # type: ignore[arg-type]
    assert stats.attempted == 750
    assert stats.highest_id == 1000


def test_rate_limit_persists_retry_after_and_stops_cycle(tmp_path) -> None:
    database = Database(tmp_path / "state.sqlite")
    database.initialize()
    database.upsert(GameRecord(1000, "Frontier", 1, None, None, None, None), __import__("datetime").datetime.now(__import__("datetime").timezone.utc))
    client = FakeClient([FetchResult("rate_limited", status_code=429, retry_after=7200)])
    with pytest.raises(CircuitBreakerError, match="7200 seconds"):
        update_database(database, client, max_tail=1, max_refresh=0)  # type: ignore[arg-type]
    assert database.get_metadata("retry_after_until")


def test_non_404_breaks_forward_missing_streak(tmp_path) -> None:
    database = Database(tmp_path / "state.sqlite")
    database.initialize()
    now = __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
    database.upsert(GameRecord(1000, "Frontier", 1, None, None, None, None), now)
    prefix = [FetchResult("missing", status_code=404)] * 249 + [
        FetchResult("ok", GameRecord(1000, "Frontier", 1, None, None, None, None), 200)
    ]
    results = prefix + [FetchResult("missing", status_code=404)] * 499 + [FetchResult("network_error")]
    results += [FetchResult("missing", status_code=404)] * 500
    stats = update_database(database, FakeClient(results), max_tail=2000, max_refresh=0)  # type: ignore[arg-type]
    assert stats.attempted == 1250


def test_refresh_parser_failures_open_circuit_breaker(tmp_path) -> None:
    database = Database(tmp_path / "state.sqlite")
    database.initialize()
    now = __import__("datetime").datetime(2025, 1, 1, tzinfo=__import__("datetime").timezone.utc)
    for game_id in range(1, 6):
        database.upsert(GameRecord(game_id, f"Game {game_id}", 1, None, None, 100 + game_id, None), now)
    database.upsert(GameRecord(1000, "Frontier", 1, None, None, None, None), now)
    tail = [FetchResult("ok", GameRecord(1000, "Frontier", 1, None, None, None, None), 200)]
    client = FakeClient([FetchResult("missing", status_code=404)] * 249 + tail + [FetchResult("parse_error")] * 5)
    with pytest.raises(CircuitBreakerError, match="parser failures"):
        update_database(database, client, max_tail=0, max_refresh=5)  # type: ignore[arg-type]


def test_catch_up_refresh_completes_success_and_missing_records(tmp_path) -> None:
    from datetime import date, datetime, timezone
    database = Database(tmp_path / "state.sqlite")
    database.initialize()
    checked = datetime(2025, 1, 1, tzinfo=timezone.utc)
    database.upsert(GameRecord(1, "First", 1, None, None, 101, None), checked)
    database.upsert(GameRecord(2, "Second", 1, None, None, 102, None), checked)
    cutoff = date(2026, 9, 4)
    database.initialize_catch_up(cutoff, datetime(2026, 9, 4, tzinfo=timezone.utc))
    client = FakeClient([
        FetchResult("ok", GameRecord(1, "First", 2, None, None, 101, None), 200),
        FetchResult("missing", status_code=404),
    ])

    stats = refresh_catch_up(database, client, cutoff, max_refresh=2)  # type: ignore[arg-type]

    assert stats.attempted == 2
    status = database.catch_up_status(cutoff)
    assert status["pending"] == 0
    assert status["successful"] == 1
    assert status["missing"] == 1


def test_catch_up_keeps_transient_failures_pending_and_obeys_circuit_breaker(tmp_path) -> None:
    from datetime import date, datetime, timezone
    database = Database(tmp_path / "state.sqlite")
    database.initialize()
    database.upsert(GameRecord(1, "First", 1, None, None, 101, None), datetime(2025, 1, 1, tzinfo=timezone.utc))
    cutoff = date(2026, 9, 4)
    database.initialize_catch_up(cutoff, datetime(2026, 9, 4, tzinfo=timezone.utc))

    with pytest.raises(CircuitBreakerError, match="rate limit"):
        refresh_catch_up(
            database,
            FakeClient([FetchResult("rate_limited", status_code=429, retry_after=60)]),
            cutoff,
            max_refresh=1,
        )  # type: ignore[arg-type]

    status = database.catch_up_status(cutoff)
    assert status["pending"] == 1
    assert status["failedPending"] == 1
    assert status["readyPending"] == 0


def test_update_cycle_prefers_an_active_catch_up(tmp_path) -> None:
    from datetime import date, datetime, timezone
    database = Database(tmp_path / "state.sqlite")
    database.initialize()
    database.upsert(GameRecord(1, "First", 1, None, None, 101, None), datetime(2025, 1, 1, tzinfo=timezone.utc))
    cutoff = date(2026, 9, 4)
    database.initialize_catch_up(cutoff, datetime(2026, 9, 4, tzinfo=timezone.utc))

    mode, selected_cutoff, stats = run_update_cycle(
        database,
        FakeClient([FetchResult("ok", GameRecord(1, "First", 1, None, None, 101, None), 200)]),
        catch_up_limit=1,
    )  # type: ignore[arg-type]

    assert mode == "catch_up"
    assert selected_cutoff == cutoff
    assert stats.attempted == 1
