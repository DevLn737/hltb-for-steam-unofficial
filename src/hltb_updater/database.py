from __future__ import annotations

from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
import sqlite3
from typing import Iterator

from .model import GameRecord


SCHEMA = """
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS games (
    hltb_id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    main_minutes INTEGER,
    extra_minutes INTEGER,
    completion_minutes INTEGER,
    steam_app_id INTEGER,
    steam_alt_app_id INTEGER,
    first_seen_at TEXT NOT NULL,
    last_checked_at TEXT NOT NULL,
    last_success_at TEXT NOT NULL,
    last_changed_at TEXT NOT NULL,
    next_refresh_at TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    last_status TEXT NOT NULL DEFAULT 'ok',
    status_code INTEGER,
    error_count INTEGER NOT NULL DEFAULT 0,
    missing_count INTEGER NOT NULL DEFAULT 0,
    first_missing_at TEXT,
    last_missing_at TEXT,
    tombstoned INTEGER NOT NULL DEFAULT 0 CHECK (tombstoned IN (0, 1))
);
CREATE INDEX IF NOT EXISTS games_due ON games(tombstoned, next_refresh_at, hltb_id);
CREATE INDEX IF NOT EXISTS games_steam ON games(steam_app_id, steam_alt_app_id);
CREATE TABLE IF NOT EXISTS metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS catch_up_runs (
    cutoff_date TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    completed_at TEXT
);
CREATE TABLE IF NOT EXISTS catch_up_members (
    cutoff_date TEXT NOT NULL REFERENCES catch_up_runs(cutoff_date) ON DELETE CASCADE,
    hltb_id INTEGER NOT NULL REFERENCES games(hltb_id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'missing')),
    attempts INTEGER NOT NULL DEFAULT 0,
    last_attempt_at TEXT,
    last_error TEXT,
    PRIMARY KEY (cutoff_date, hltb_id)
);
CREATE INDEX IF NOT EXISTS catch_up_pending
    ON catch_up_members(cutoff_date, status, hltb_id);
"""


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_day(value: datetime | date) -> str:
    return value.date().isoformat() if isinstance(value, datetime) else value.isoformat()


def next_refresh(record: GameRecord, checked_at: datetime, changed: bool, first_seen_at: str) -> str:
    age_days = max(0, (checked_at.date() - date.fromisoformat(first_seen_at)).days)
    if changed or age_days <= 30:
        days = 14
    elif record.has_steam and not record.has_times:
        days = 60 if age_days <= 180 else 180
    elif record.has_steam:
        days = 120
    else:
        days = 365
    return iso_day(checked_at + timedelta(days=days))


def initial_refresh(record: GameRecord, checked_at: datetime) -> str:
    """Spread imported records without delaying the highest-value rows for a year."""
    if record.has_steam and not record.has_times:
        days = record.hltb_id % 14
    elif record.has_steam:
        days = record.hltb_id % 120
    else:
        days = record.hltb_id % 365
    return iso_day(checked_at + timedelta(days=days))


class Database:
    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.path, timeout=30)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA busy_timeout=30000")
        try:
            yield connection
        finally:
            connection.close()

    def initialize(self) -> None:
        with self.connect() as connection:
            connection.executescript(SCHEMA)
            columns = {str(row[1]) for row in connection.execute("PRAGMA table_info(games)")}
            if "last_success_at" not in columns:
                connection.execute("ALTER TABLE games ADD COLUMN last_success_at TEXT")
                connection.execute(
                    "UPDATE games SET last_success_at=CASE WHEN last_status='ok' THEN last_checked_at ELSE last_changed_at END"
                )
            connection.commit()

    def upsert(self, record: GameRecord, checked_at: datetime, initial: bool = False) -> bool:
        checked_day = iso_day(checked_at)
        with self.connect() as connection:
            existing = connection.execute(
                "SELECT content_hash, first_seen_at FROM games WHERE hltb_id = ?", (record.hltb_id,)
            ).fetchone()
            changed = existing is None or existing["content_hash"] != record.content_hash
            first_seen = existing["first_seen_at"] if existing else checked_day
            if initial and existing is None:
                due = initial_refresh(record, checked_at)
            else:
                due = next_refresh(record, checked_at, changed, first_seen)
            connection.execute(
                """
                INSERT INTO games (
                    hltb_id, title, main_minutes, extra_minutes, completion_minutes,
                    steam_app_id, steam_alt_app_id, first_seen_at, last_checked_at,
                    last_success_at, last_changed_at, next_refresh_at, content_hash, last_status,
                    status_code, error_count, missing_count, first_missing_at,
                    last_missing_at, tombstoned
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ok', 200, 0, 0, NULL, NULL, 0)
                ON CONFLICT(hltb_id) DO UPDATE SET
                    title=excluded.title,
                    main_minutes=excluded.main_minutes,
                    extra_minutes=excluded.extra_minutes,
                    completion_minutes=excluded.completion_minutes,
                    steam_app_id=excluded.steam_app_id,
                    steam_alt_app_id=excluded.steam_alt_app_id,
                    last_checked_at=excluded.last_checked_at,
                    last_success_at=excluded.last_success_at,
                    last_changed_at=CASE WHEN games.content_hash <> excluded.content_hash THEN excluded.last_changed_at ELSE games.last_changed_at END,
                    next_refresh_at=excluded.next_refresh_at,
                    content_hash=excluded.content_hash,
                    last_status='ok', status_code=200, error_count=0, missing_count=0,
                    first_missing_at=NULL, last_missing_at=NULL, tombstoned=0
                """,
                (
                    record.hltb_id, record.title, record.main_minutes, record.extra_minutes,
                    record.completion_minutes, record.steam_app_id, record.steam_alt_app_id,
                    first_seen, checked_day, checked_day, checked_day, due, record.content_hash,
                ),
            )
            connection.commit()
            return changed

    def import_batch(self, records: list[GameRecord], checked_at: datetime) -> None:
        if not records:
            return
        checked_day = iso_day(checked_at)
        values = []
        for record in records:
            due = initial_refresh(record, checked_at)
            values.append((
                record.hltb_id, record.title, record.main_minutes, record.extra_minutes,
                record.completion_minutes, record.steam_app_id, record.steam_alt_app_id,
                checked_day, checked_day, checked_day, checked_day, due, record.content_hash,
            ))
        with self.connect() as connection:
            connection.executemany(
                """
                INSERT INTO games (
                    hltb_id, title, main_minutes, extra_minutes, completion_minutes,
                    steam_app_id, steam_alt_app_id, first_seen_at, last_checked_at,
                    last_success_at, last_changed_at, next_refresh_at, content_hash, last_status,
                    status_code, error_count, missing_count, first_missing_at,
                    last_missing_at, tombstoned
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ok', 200, 0, 0, NULL, NULL, 0)
                ON CONFLICT(hltb_id) DO UPDATE SET
                    title=excluded.title, main_minutes=excluded.main_minutes,
                    extra_minutes=excluded.extra_minutes, completion_minutes=excluded.completion_minutes,
                    steam_app_id=excluded.steam_app_id, steam_alt_app_id=excluded.steam_alt_app_id,
                    last_checked_at=excluded.last_checked_at,
                    last_success_at=excluded.last_success_at,
                    last_changed_at=CASE WHEN games.content_hash <> excluded.content_hash THEN excluded.last_changed_at ELSE games.last_changed_at END,
                    next_refresh_at=excluded.next_refresh_at, content_hash=excluded.content_hash,
                    last_status='ok', status_code=200, error_count=0, missing_count=0,
                    first_missing_at=NULL, last_missing_at=NULL, tombstoned=0
                """,
                values,
            )
            connection.commit()

    def rebalance_legacy_import_schedule(self) -> int:
        """Replace only the old ID%365 import schedule, preserving live backoff state."""
        changed = 0
        with self.connect() as connection:
            rows = connection.execute(
                """SELECT hltb_id, title, main_minutes, extra_minutes, completion_minutes,
                steam_app_id, steam_alt_app_id, first_seen_at, next_refresh_at
                FROM games WHERE last_status='ok' AND last_checked_at=first_seen_at"""
            ).fetchall()
            for row in rows:
                imported_at = datetime.combine(date.fromisoformat(row["first_seen_at"]), datetime.min.time(), timezone.utc)
                legacy_due = iso_day(imported_at + timedelta(days=int(row["hltb_id"]) % 365))
                if row["next_refresh_at"] != legacy_due:
                    continue
                record = GameRecord(
                    hltb_id=int(row["hltb_id"]), title=str(row["title"]),
                    main_minutes=row["main_minutes"], extra_minutes=row["extra_minutes"],
                    completion_minutes=row["completion_minutes"], steam_app_id=row["steam_app_id"],
                    steam_alt_app_id=row["steam_alt_app_id"],
                )
                due = initial_refresh(record, imported_at)
                if due != row["next_refresh_at"]:
                    connection.execute("UPDATE games SET next_refresh_at=? WHERE hltb_id=?", (due, record.hltb_id))
                    changed += 1
            connection.commit()
        return changed

    def mark_missing(self, hltb_id: int, checked_at: datetime) -> None:
        checked_day = iso_day(checked_at)
        with self.connect() as connection:
            row = connection.execute(
                "SELECT missing_count, first_missing_at, last_missing_at FROM games WHERE hltb_id = ?", (hltb_id,)
            ).fetchone()
            if row is None:
                return
            count = row["missing_count"] + (0 if row["last_missing_at"] == checked_day else 1)
            first = row["first_missing_at"] or checked_day
            old_enough = (date.fromisoformat(checked_day) - date.fromisoformat(first)).days >= 30
            tombstoned = 1 if count >= 3 and old_enough else 0
            connection.execute(
                """UPDATE games SET last_checked_at=?, last_status='missing', status_code=404,
                missing_count=?, first_missing_at=?, last_missing_at=?, tombstoned=?,
                next_refresh_at=? WHERE hltb_id=?""",
                (checked_day, count, first, checked_day, tombstoned,
                 iso_day(checked_at + timedelta(days=15)), hltb_id),
            )
            connection.commit()

    def mark_error(self, hltb_id: int, status: str, status_code: int | None, checked_at: datetime) -> None:
        with self.connect() as connection:
            row = connection.execute("SELECT error_count FROM games WHERE hltb_id=?", (hltb_id,)).fetchone()
            if row is None:
                return
            errors = row["error_count"] + 1
            delay = min(30, 2 ** min(errors, 5))
            connection.execute(
                """UPDATE games SET last_checked_at=?, last_status=?, status_code=?, error_count=?,
                next_refresh_at=? WHERE hltb_id=?""",
                (iso_day(checked_at), status, status_code, errors,
                 iso_day(checked_at + timedelta(days=delay)), hltb_id),
            )
            connection.commit()

    def max_id(self) -> int:
        with self.connect() as connection:
            row = connection.execute("SELECT COALESCE(MAX(hltb_id), 0) AS value FROM games").fetchone()
            return int(row["value"])

    def due_ids(self, today: date, limit: int, excluded: set[int]) -> list[int]:
        with self.connect() as connection:
            rows = connection.execute(
                """SELECT hltb_id FROM games WHERE tombstoned=0 AND next_refresh_at <= ?
                ORDER BY CASE WHEN steam_app_id IS NOT NULL OR steam_alt_app_id IS NOT NULL THEN 0 ELSE 1 END,
                next_refresh_at,
                hltb_id LIMIT ?""",
                (today.isoformat(), limit + len(excluded)),
            ).fetchall()
        return [int(row["hltb_id"]) for row in rows if int(row["hltb_id"]) not in excluded][:limit]

    def initialize_catch_up(self, cutoff: date, created_at: datetime) -> dict[str, int | str | None]:
        cutoff_day = iso_day(cutoff)
        with self.connect() as connection:
            existing = connection.execute(
                "SELECT cutoff_date FROM catch_up_runs WHERE cutoff_date=?", (cutoff_day,)
            ).fetchone()
            if existing is None:
                connection.execute(
                    "INSERT INTO catch_up_runs(cutoff_date, created_at) VALUES(?, ?)",
                    (cutoff_day, created_at.isoformat()),
                )
                connection.execute(
                    """INSERT INTO catch_up_members(cutoff_date, hltb_id)
                    SELECT ?, hltb_id FROM games
                    WHERE tombstoned=0 AND next_refresh_at <= ?""",
                    (cutoff_day, cutoff_day),
                )
                member_count = int(connection.execute(
                    "SELECT COUNT(*) FROM catch_up_members WHERE cutoff_date=?", (cutoff_day,)
                ).fetchone()[0])
                if member_count == 0:
                    connection.execute(
                        "UPDATE catch_up_runs SET completed_at=? WHERE cutoff_date=?",
                        (created_at.isoformat(), cutoff_day),
                    )
                connection.commit()
        return self.catch_up_status(cutoff)

    def active_catch_up(self) -> date | None:
        with self.connect() as connection:
            row = connection.execute(
                """SELECT cutoff_date FROM catch_up_runs
                WHERE completed_at IS NULL ORDER BY cutoff_date LIMIT 1"""
            ).fetchone()
        return date.fromisoformat(str(row["cutoff_date"])) if row else None

    def catch_up_ids(self, cutoff: date, today: date, limit: int) -> list[int]:
        if limit <= 0:
            return []
        with self.connect() as connection:
            rows = connection.execute(
                """SELECT members.hltb_id
                FROM catch_up_members AS members
                JOIN games ON games.hltb_id=members.hltb_id
                WHERE members.cutoff_date=? AND members.status='pending'
                  AND (members.last_attempt_at IS NULL OR games.next_refresh_at <= ?)
                ORDER BY CASE WHEN games.steam_app_id IS NOT NULL OR games.steam_alt_app_id IS NOT NULL THEN 0 ELSE 1 END,
                         games.next_refresh_at, members.hltb_id
                LIMIT ?""",
                (iso_day(cutoff), iso_day(today), limit),
            ).fetchall()
        return [int(row["hltb_id"]) for row in rows]

    def record_catch_up_result(self, cutoff: date, hltb_id: int, status: str, attempted_at: datetime) -> None:
        if status == "ok":
            member_status, error = "success", None
        elif status == "missing":
            member_status, error = "missing", None
        else:
            member_status, error = "pending", status
        cutoff_day = iso_day(cutoff)
        with self.connect() as connection:
            connection.execute(
                """UPDATE catch_up_members
                SET status=?, attempts=attempts+1, last_attempt_at=?, last_error=?
                WHERE cutoff_date=? AND hltb_id=?""",
                (member_status, attempted_at.isoformat(), error, cutoff_day, hltb_id),
            )
            pending = int(connection.execute(
                "SELECT COUNT(*) FROM catch_up_members WHERE cutoff_date=? AND status='pending'",
                (cutoff_day,),
            ).fetchone()[0])
            if pending == 0:
                connection.execute(
                    "UPDATE catch_up_runs SET completed_at=COALESCE(completed_at, ?) WHERE cutoff_date=?",
                    (attempted_at.isoformat(), cutoff_day),
                )
            connection.commit()

    def catch_up_status(
        self,
        cutoff: date | None = None,
        today: date | None = None,
    ) -> dict[str, int | str | None]:
        with self.connect() as connection:
            if cutoff is None:
                run = connection.execute(
                    "SELECT * FROM catch_up_runs ORDER BY cutoff_date DESC LIMIT 1"
                ).fetchone()
            else:
                run = connection.execute(
                    "SELECT * FROM catch_up_runs WHERE cutoff_date=?", (iso_day(cutoff),)
                ).fetchone()
            if run is None:
                return {
                    "cutoffDate": iso_day(cutoff) if cutoff else None,
                    "createdAt": None,
                    "completedAt": None,
                    "total": 0,
                    "pending": 0,
                    "successful": 0,
                    "missing": 0,
                    "failedPending": 0,
                    "readyPending": 0,
                }
            counts = {
                str(row["status"]): int(row["count"])
                for row in connection.execute(
                    """SELECT status, COUNT(*) AS count FROM catch_up_members
                    WHERE cutoff_date=? GROUP BY status""",
                    (run["cutoff_date"],),
                ).fetchall()
            }
            failed_pending = int(connection.execute(
                """SELECT COUNT(*) FROM catch_up_members
                WHERE cutoff_date=? AND status='pending' AND last_error IS NOT NULL""",
                (run["cutoff_date"],),
            ).fetchone()[0])
            ready_pending = int(connection.execute(
                """SELECT COUNT(*) FROM catch_up_members AS members
                JOIN games ON games.hltb_id=members.hltb_id
                WHERE members.cutoff_date=? AND members.status='pending'
                  AND (members.last_attempt_at IS NULL OR games.next_refresh_at <= ?)""",
                (run["cutoff_date"], iso_day(today or utc_now().date())),
            ).fetchone()[0])
        total = sum(counts.values())
        return {
            "cutoffDate": str(run["cutoff_date"]),
            "createdAt": str(run["created_at"]),
            "completedAt": str(run["completed_at"]) if run["completed_at"] else None,
            "total": total,
            "pending": counts.get("pending", 0),
            "successful": counts.get("success", 0),
            "missing": counts.get("missing", 0),
            "failedPending": failed_pending,
            "readyPending": ready_pending,
        }

    def records(self) -> list[sqlite3.Row]:
        with self.connect() as connection:
            return connection.execute(
                "SELECT * FROM games WHERE tombstoned=0 ORDER BY hltb_id"
            ).fetchall()

    def set_metadata(self, key: str, value: str) -> None:
        with self.connect() as connection:
            connection.execute(
                "INSERT INTO metadata(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                (key, value),
            )
            connection.commit()

    def get_metadata(self, key: str) -> str | None:
        with self.connect() as connection:
            row = connection.execute("SELECT value FROM metadata WHERE key=?", (key,)).fetchone()
            return str(row["value"]) if row else None
