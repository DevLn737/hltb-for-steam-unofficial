from datetime import datetime, timezone

import pytest
from cryptography.exceptions import InvalidSignature

from hltb_updater.database import Database
from hltb_updater.model import GameRecord
from hltb_updater.snapshot import build_snapshot, generate_key


def signed_source(tmp_path):
    source = Database(tmp_path / 'original.sqlite')
    source.initialize()
    source.upsert(GameRecord(1, 'Timed', 60, None, 120, 100, 101), datetime(2026, 7, 22, tzinfo=timezone.utc))
    for game_id, app_id in [(2, 200), (3, 300), (4, 300)]:
        source.upsert(GameRecord(game_id, f'Untimed {game_id}', None, None, None, app_id, None),
                      datetime(2026, 11, 1, tzinfo=timezone.utc))
    private, public = tmp_path / 'key.pem', tmp_path / 'public.json'
    generate_key(private, public)
    candidate = tmp_path / 'source'
    build_snapshot(source, candidate, '2026.11.01.1', private)
    return candidate, private, public


def test_restores_real_check_dates_and_steam_mappings(tmp_path):
    from hltb_updater.restore import restore_snapshot
    candidate, _, public = signed_source(tmp_path)
    target = Database(tmp_path / 'restored.sqlite')
    target.initialize()
    assert restore_snapshot(target, candidate, public) == 4
    rows = {row['hltb_id']: row for row in target.records()}
    assert rows[1]['last_success_at'] == '2026-07-22'
    assert rows[2]['last_success_at'] == '2026-11-01'
    assert (rows[1]['steam_app_id'], rows[1]['steam_alt_app_id']) == (100, 101)
    assert rows[2]['steam_app_id'] == 200
    assert rows[2]['main_minutes'] is None
    assert target.get_metadata('last_update_at') is None


def test_keeps_untimed_rows_whose_steam_mapping_was_ambiguous(tmp_path):
    from hltb_updater.restore import restore_snapshot
    candidate, private, public = signed_source(tmp_path)
    target = Database(tmp_path / 'restored.sqlite')
    target.initialize()
    restore_snapshot(target, candidate, public)
    manifest = build_snapshot(target, tmp_path / 'rebuilt', '2026.11.17.1', private,
                              previous_manifest_path=candidate / 'versions/2026.11.01.1/manifest.json')
    assert manifest['entryCount'] == 4
    assert manifest['steamMappingCount'] == 3


def test_refuses_to_overwrite_working_state(tmp_path):
    from hltb_updater.restore import restore_snapshot
    candidate, _, public = signed_source(tmp_path)
    target = Database(tmp_path / 'restored.sqlite')
    target.initialize()
    target.upsert(GameRecord(9, 'Existing', 5, None, None, None, None), datetime(2026, 11, 17, tzinfo=timezone.utc))
    with pytest.raises(ValueError, match='empty'):
        restore_snapshot(target, candidate, public)
    assert target.max_id() == 9


def test_rejects_unsigned_source_before_importing_anything(tmp_path):
    from hltb_updater.restore import restore_snapshot
    candidate, _, public = signed_source(tmp_path)
    (candidate / 'stable.json').write_bytes((candidate / 'stable.json').read_bytes() + b' ')
    target = Database(tmp_path / 'restored.sqlite')
    target.initialize()
    with pytest.raises(InvalidSignature):
        restore_snapshot(target, candidate, public)
    assert not target.records()
