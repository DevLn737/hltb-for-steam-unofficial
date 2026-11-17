from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Callable
import time

from .client import FetchResult, HltbClient
from .database import Database, utc_now
from .model import GameRecord


class CircuitBreakerError(RuntimeError):
    pass


def check_publication_readiness(
    database: Database,
    maximum_age: timedelta = timedelta(hours=36),
    now: datetime | None = None,
) -> datetime:
    now = now or datetime.now(timezone.utc)
    value = database.get_metadata("last_update_at")
    try:
        updated = datetime.fromisoformat(value or "")
    except ValueError as error:
        raise ValueError("Publication requires a completed updater cycle") from error
    if updated.tzinfo is None or updated > now + timedelta(minutes=5):
        raise ValueError("The completed updater timestamp is invalid")
    if now - updated > maximum_age:
        raise ValueError(f"The last completed updater cycle is too old: {value}")
    if database.active_catch_up() is not None:
        raise ValueError("Publication must wait for the active catch-up cohort to complete")
    started_value = database.get_metadata("last_update_started_at")
    started = updated
    if started_value:
        try:
            started = datetime.fromisoformat(started_value)
        except ValueError as error:
            raise ValueError("The updater start timestamp is invalid") from error
        if started.tzinfo is None or started > updated:
            raise ValueError("Publication must wait for the latest updater cycle to complete")
        if updated - started > maximum_age:
            raise ValueError("The updater cycle started too long ago to publish")
    with database.connect() as connection:
        latest_success = connection.execute("SELECT MAX(last_success_at) FROM games WHERE tombstoned=0").fetchone()[0]
    if latest_success is None or date.fromisoformat(latest_success) < started.date():
        raise ValueError("The completed cycle contains no successful game refresh")
    return updated


@dataclass(slots=True)
class UpdateStats:
    budget_exhausted: bool = False
    attempted: int = 0
    found: int = 0
    changed: int = 0
    missing: int = 0
    errors: int = 0
    highest_id: int = 0


def apply_result(database: Database, game_id: int, result: FetchResult, now: datetime, stats: UpdateStats) -> None:
    stats.attempted += 1
    if result.status == "ok" and result.record is not None:
        stats.found += 1
        stats.highest_id = max(stats.highest_id, result.record.hltb_id)
        if database.upsert(result.record, now):
            stats.changed += 1
    elif result.status == "missing":
        stats.missing += 1
        database.mark_missing(game_id, now)
    else:
        stats.errors += 1
        database.mark_error(game_id, result.status, result.status_code, now)


def update_database(
    database: Database,
    client: HltbClient,
    max_tail: int = 2000,
    max_refresh: int = 1000,
    on_result: Callable[[int, FetchResult], None] | None = None,
    max_seconds: int | None = None,
) -> UpdateStats:
    deadline = time.monotonic() + max_seconds if max_seconds is not None else float('inf')
    now = utc_now()
    retry_after_until = database.get_metadata("retry_after_until")
    if retry_after_until:
        try:
            if datetime.fromisoformat(retry_after_until) > now:
                raise CircuitBreakerError(f"HLTB Retry-After remains active until {retry_after_until}")
            database.set_metadata("retry_after_until", "")
        except ValueError:
            database.set_metadata("retry_after_until", "")
    database.set_metadata("last_update_started_at", now.isoformat())
    original_max = database.max_id()
    stats = UpdateStats(highest_id=original_max)
    touched: set[int] = set()
    consecutive_forward_404 = 0
    consecutive_parser_errors = 0
    tail_start = max(1, original_max - 249)
    tail_end = original_max + max_tail

    for game_id in range(tail_start, tail_end + 1):
        if time.monotonic() >= deadline:
            stats.budget_exhausted = True
            break
        result = client.fetch(game_id)
        checked_at = utc_now()
        on_result and on_result(game_id, result)
        touched.add(game_id)
        if result.status == "rate_limited":
            apply_result(database, game_id, result, checked_at, stats)
            retry_seconds = max(60, result.retry_after or 3600)
            limited_at = datetime.now(timezone.utc)
            database.set_metadata("retry_after_until", (limited_at + timedelta(seconds=retry_seconds)).isoformat())
            raise CircuitBreakerError(f"HLTB rate limit is active for {retry_seconds} seconds")
        if result.status == "forbidden":
            apply_result(database, game_id, result, checked_at, stats)
            raise CircuitBreakerError(f"HLTB stopped the updater with {result.status_code}")
        if result.status == "parse_error":
            consecutive_parser_errors += 1
            if consecutive_parser_errors >= 5:
                apply_result(database, game_id, result, checked_at, stats)
                raise CircuitBreakerError("Five consecutive HLTB parser failures")
        else:
            consecutive_parser_errors = 0
        if game_id > original_max:
            if result.status == "missing":
                consecutive_forward_404 += 1
            else:
                consecutive_forward_404 = 0
            if consecutive_forward_404 >= 500:
                apply_result(database, game_id, result, checked_at, stats)
                break
        apply_result(database, game_id, result, checked_at, stats)

    due = database.due_ids(now.date(), max_refresh, touched)
    consecutive_parser_errors = 0
    for game_id in due:
        if time.monotonic() >= deadline:
            stats.budget_exhausted = True
            break
        result = client.fetch(game_id)
        checked_at = utc_now()
        on_result and on_result(game_id, result)
        if result.status == "rate_limited":
            apply_result(database, game_id, result, checked_at, stats)
            retry_seconds = max(60, result.retry_after or 3600)
            limited_at = datetime.now(timezone.utc)
            database.set_metadata("retry_after_until", (limited_at + timedelta(seconds=retry_seconds)).isoformat())
            raise CircuitBreakerError(f"HLTB rate limit is active for {retry_seconds} seconds")
        if result.status == "forbidden":
            apply_result(database, game_id, result, checked_at, stats)
            raise CircuitBreakerError(f"HLTB stopped the updater with {result.status_code}")
        if result.status == "parse_error":
            consecutive_parser_errors += 1
            if consecutive_parser_errors >= 5:
                apply_result(database, game_id, result, checked_at, stats)
                raise CircuitBreakerError("Five consecutive HLTB parser failures")
        else:
            consecutive_parser_errors = 0
        apply_result(database, game_id, result, checked_at, stats)
    database.set_metadata("last_update_at", utc_now().isoformat())
    database.set_metadata("highest_seen_id", str(stats.highest_id))
    return stats


def refresh_catch_up(
    database: Database,
    client: HltbClient,
    cutoff: date,
    max_refresh: int = 5000,
    on_result: Callable[[int, FetchResult], None] | None = None,
    max_seconds: int | None = None,
) -> UpdateStats:
    deadline = time.monotonic() + max_seconds if max_seconds is not None else float('inf')
    now = utc_now()
    retry_after_until = database.get_metadata("retry_after_until")
    if retry_after_until:
        try:
            if datetime.fromisoformat(retry_after_until) > now:
                raise CircuitBreakerError(f"HLTB Retry-After remains active until {retry_after_until}")
            database.set_metadata("retry_after_until", "")
        except ValueError:
            database.set_metadata("retry_after_until", "")

    database.set_metadata("last_update_started_at", now.isoformat())
    stats = UpdateStats(highest_id=database.max_id())
    consecutive_parser_errors = 0
    for game_id in database.catch_up_ids(cutoff, now.date(), max_refresh):
        if time.monotonic() >= deadline:
            stats.budget_exhausted = True
            break
        result = client.fetch(game_id)
        checked_at = utc_now()
        on_result and on_result(game_id, result)
        apply_result(database, game_id, result, checked_at, stats)
        database.record_catch_up_result(cutoff, game_id, result.status, checked_at)
        if result.status == "rate_limited":
            retry_seconds = max(60, result.retry_after or 3600)
            limited_at = datetime.now(timezone.utc)
            database.set_metadata("retry_after_until", (limited_at + timedelta(seconds=retry_seconds)).isoformat())
            raise CircuitBreakerError(f"HLTB rate limit is active for {retry_seconds} seconds")
        if result.status == "forbidden":
            raise CircuitBreakerError(f"HLTB stopped the updater with {result.status_code}")
        if result.status == "parse_error":
            consecutive_parser_errors += 1
            if consecutive_parser_errors >= 5:
                raise CircuitBreakerError("Five consecutive HLTB parser failures")
        else:
            consecutive_parser_errors = 0

    database.set_metadata("last_update_at", utc_now().isoformat())
    return stats


def run_update_cycle(
    database: Database,
    client: HltbClient,
    max_tail: int = 2000,
    max_refresh: int = 1000,
    catch_up_limit: int = 5000,
    max_seconds: int | None = None,
) -> tuple[str, date | None, UpdateStats]:
    cutoff = database.active_catch_up()
    if cutoff is not None:
        return "catch_up", cutoff, refresh_catch_up(database, client, cutoff, catch_up_limit, max_seconds=max_seconds)
    return "normal", None, update_database(database, client, max_tail, max_refresh, max_seconds=max_seconds)


def check_canaries(client: HltbClient, canaries: list[dict[str, object]]) -> list[GameRecord]:
    records = []
    for canary in canaries:
        game_id = int(canary["hltbGameId"])
        result = client.fetch(game_id)
        if result.status != "ok" or result.record is None:
            raise CircuitBreakerError(f"Canary {game_id} failed with {result.status}")
        expected = canary.get("title")
        if expected is not None and result.record.title != expected:
            raise CircuitBreakerError(f"Canary {game_id} title changed: {result.record.title!r}")
        records.append(result.record)
    return records
