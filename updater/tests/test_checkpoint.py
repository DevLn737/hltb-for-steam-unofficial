import gzip
import sqlite3

import pytest


def test_checkpoint_includes_committed_wal_data(tmp_path):
    from hltb_updater.checkpoint import read_checkpoint, write_checkpoint
    database = tmp_path / 'source.sqlite'
    with sqlite3.connect(database) as connection:
        connection.execute('PRAGMA journal_mode=WAL')
        connection.execute('CREATE TABLE example(value INTEGER)')
        connection.execute('INSERT INTO example VALUES(42)')
        connection.commit()
        write_checkpoint(database, tmp_path / 'state.sqlite.gz')
    restored = tmp_path / 'restored.sqlite'
    read_checkpoint(tmp_path / 'state.sqlite.gz', restored)
    with sqlite3.connect(restored) as connection:
        assert connection.execute('SELECT value FROM example').fetchone()[0] == 42


def test_corrupt_checkpoint_cannot_replace_existing_database(tmp_path):
    from hltb_updater.checkpoint import read_checkpoint
    compressed = tmp_path / 'corrupt.gz'
    compressed.write_bytes(gzip.compress(b'not a database'))
    database = tmp_path / 'existing.sqlite'
    database.write_bytes(b'keep existing state')
    with pytest.raises((sqlite3.DatabaseError, ValueError)):
        read_checkpoint(compressed, database)
    assert database.read_bytes() == b'keep existing state'
