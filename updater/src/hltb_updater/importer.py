from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

import ijson

from .database import Database
from .model import extract_record


def import_json(
    database: Database,
    source: str | Path,
    source_date: str,
    progress: Callable[[int], None] | None = None,
) -> tuple[int, int]:
    checked_at = datetime.fromisoformat(f"{source_date}T00:00:00+00:00").astimezone(timezone.utc)
    source_count = 0
    imported_count = 0
    batch = []
    with Path(source).open("rb") as handle:
        for item in ijson.items(handle, "item"):
            source_count += 1
            record = extract_record(item)
            if record is not None:
                batch.append(record)
                imported_count += 1
                if len(batch) >= 1000:
                    database.import_batch(batch, checked_at)
                    batch.clear()
            if progress and source_count % 1000 == 0:
                progress(source_count)
    database.import_batch(batch, checked_at)
    database.set_metadata("source_entry_count", str(source_count))
    database.set_metadata("last_import_date", source_date)
    return source_count, imported_count
