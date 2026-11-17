from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
import gzip
import json
from pathlib import Path

from .database import Database
from .model import GameRecord
from .snapshot import STEAM_MAGIC, decode_header, decode_title_bucket, decode_unsigned, verify_candidate


def restore_snapshot(database: Database, candidate: str | Path, public_key: str | Path) -> int:
    """Recover distributed records without inventing fresh checks or lost state."""
    if database.records():
        raise ValueError('Snapshot recovery requires an empty database')
    root = Path(candidate)
    manifest = verify_candidate(root, public_key)
    pointer = json.loads((root / 'stable.json').read_bytes())
    pack = (root / pointer['manifestPath']).parent.joinpath('snapshot.pack').read_bytes()
    titles = {}
    mappings: dict[int, list[int]] = defaultdict(list)
    for entry in manifest['entries']:
        raw = gzip.decompress(pack[entry['offset']:entry['offset'] + entry['compressedBytes']])
        if entry['kind'] == 'title':
            titles[int(entry['name'], 16)] = decode_title_bucket(raw)
        else:
            count, offset = decode_header(raw, STEAM_MAGIC)
            app_id = 0
            for _ in range(count):
                delta, offset = decode_unsigned(raw, offset)
                location, offset = decode_unsigned(raw, offset)
                app_id += delta
                mappings[location].append(app_id)
    if any(len(app_ids) > 2 for app_ids in mappings.values()):
        raise ValueError('Snapshot contains more Steam aliases than the database can preserve')
    batches: dict[str, list[GameRecord]] = defaultdict(list)
    for bucket, rows in titles.items():
        for index, row in enumerate(rows):
            app_ids = mappings[(bucket << 16) | index]
            padded = app_ids + [None, None]
            record = GameRecord(row[1], row[0], *row[2:5], *padded[:2])
            batches[manifest['checkedDates'][row[5]]].append(record)
    for checked_date, records in batches.items():
        database.import_batch(records, datetime.fromisoformat(checked_date).replace(tzinfo=timezone.utc))
    with database.connect() as connection:
        # Ambiguous Steam links are deliberately omitted from the public index.
        # Keep their untimed title rows until an actual HLTB response replaces them.
        connection.execute('INSERT INTO restored_snapshot_entries SELECT hltb_id FROM games')
        connection.commit()
    database.set_metadata('restored_snapshot_version', manifest['snapshotVersion'])
    return sum(len(records) for records in batches.values())
