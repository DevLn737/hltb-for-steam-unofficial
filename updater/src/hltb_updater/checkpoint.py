from __future__ import annotations

import gzip
from contextlib import closing
from pathlib import Path
import shutil
import sqlite3
import tempfile


def write_checkpoint(database_path: Path, output_path: Path) -> None:
    with tempfile.TemporaryDirectory() as temporary:
        snapshot = Path(temporary) / 'state.sqlite'
        with closing(sqlite3.connect(database_path)) as source, closing(sqlite3.connect(snapshot)) as target:
            source.backup(target)
        with snapshot.open('rb') as source, gzip.open(output_path, 'wb') as target:
            shutil.copyfileobj(source, target)


def read_checkpoint(compressed_path: Path, database_path: Path) -> None:
    database_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=database_path.parent) as temporary:
        restored = Path(temporary) / 'state.sqlite'
        with gzip.open(compressed_path, 'rb') as source, restored.open('wb') as target:
            shutil.copyfileobj(source, target)
        with closing(sqlite3.connect(restored)) as connection:
            if connection.execute('PRAGMA quick_check').fetchone()[0] != 'ok':
                raise ValueError('Invalid SQLite checkpoint')
        restored.replace(database_path)
