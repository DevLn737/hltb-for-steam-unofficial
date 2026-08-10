from __future__ import annotations

from datetime import datetime, timezone
import gzip
from pathlib import Path
import shutil
import sqlite3


def create_backup(database_path: str | Path, directory: str | Path, now: datetime | None = None) -> Path:
    source_path = Path(database_path)
    target_directory = Path(directory)
    target_directory.mkdir(parents=True, exist_ok=True)
    now = now or datetime.now(timezone.utc)
    temporary = target_directory / ".backup.sqlite"
    with sqlite3.connect(source_path) as source, sqlite3.connect(temporary) as target:
        source.backup(target)
    output = target_directory / f"hltb-{now.strftime('%Y%m%dT%H%M%SZ')}.sqlite.gz"
    with temporary.open("rb") as source, output.open("wb") as raw_target:
        with gzip.GzipFile(fileobj=raw_target, mode="wb", compresslevel=9, mtime=0) as target:
            shutil.copyfileobj(source, target)
    temporary.unlink(missing_ok=True)

    backups = sorted(target_directory.glob("hltb-*.sqlite.gz"), reverse=True)
    monthly: set[tuple[int, int]] = set()
    keep: set[Path] = set(backups[:7])
    for path in backups:
        stamp = datetime.strptime(path.name[5:20], "%Y%m%dT%H%M%S")
        key = (stamp.year, stamp.month)
        if key not in monthly and len(monthly) < 6:
            monthly.add(key)
            keep.add(path)
    for path in backups:
        if path not in keep:
            path.unlink()
    return output
