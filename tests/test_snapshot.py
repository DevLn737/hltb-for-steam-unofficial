import base64
import gzip
import json

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature

from hltb_updater.database import Database
from hltb_updater.model import GameRecord
from hltb_updater.snapshot import build_snapshot, encode_time_change, encode_unsigned, generate_key, load_previous_times, normalize_title, snapshot_bucket, validate_delta, verify_candidate


def legacy_normalization_and_utf16_bucket_fixture() -> None:
    assert normalize_title("Pokémon™ & Test") == "poke mon and test"
    assert snapshot_bucket(normalize_title("😀 Game")) == snapshot_bucket(normalize_title("😀 Game"))


def test_unicode_normalization_preserves_letters_and_removes_marks() -> None:
    assert normalize_title("Pokémon™ & Test") == "pokemon and test"
    assert normalize_title("Щёлк") == "щелк"
    assert snapshot_bucket(normalize_title("😀 Game")) == snapshot_bucket(normalize_title("😀 Game"))


def test_builds_signed_data_only_snapshot(tmp_path) -> None:
    database = Database(tmp_path / "state.sqlite")
    database.initialize()
    from datetime import datetime, timezone
    checked = datetime(2026, 8, 10, tzinfo=timezone.utc)
    database.upsert(GameRecord(1, "First", 60, 90, 120, 10, None), checked)
    database.upsert(GameRecord(2, "Without Times", None, None, None, 11, None), checked)
    database.upsert(GameRecord(3, "Empty and unlinked", None, None, None, None, None), checked)
    private = tmp_path / "key.pem"
    public = tmp_path / "public.json"
    generate_key(private, public)
    output = tmp_path / "candidate"
    manifest = build_snapshot(database, output, "2026.09.01.1", private, source_updated_at="2026-08-10")
    assert manifest["entryCount"] == 2
    assert manifest["originalEntryCount"] == 3
    assert manifest["excludedEntryCount"] == 1
    assert manifest["timedEntryCount"] == 1
    assert manifest["steamMappingCount"] == 2
    assert manifest["schema"] == 7
    assert manifest["format"] == "front-coded-uleb128-delta-v3"
    assert manifest["checkedDates"] == ["2026-08-10"]
    assert manifest["baselineUpdatedAt"] == "2026-08-10"
    assert len(manifest["entries"]) == 32
    assert (output / "versions/2026.09.01.1/snapshot.pack").stat().st_size == manifest["pack"]["bytes"]

    pointer_bytes = (output / "stable.json").read_bytes()
    signature = base64.b64decode((output / "stable.sig").read_text().strip())
    r, s = int.from_bytes(signature[:32], "big"), int.from_bytes(signature[32:], "big")
    private_key = serialization.load_pem_private_key(private.read_bytes(), password=None)
    private_key.public_key().verify(encode_dss_signature(r, s), pointer_bytes, ec.ECDSA(hashes.SHA256()))
    pointer = json.loads(pointer_bytes)
    assert pointer["manifestPath"] == "versions/2026.09.01.1/manifest.json"
    assert verify_candidate(output, public)["entryCount"] == 2


def test_candidate_verifier_rejects_corrupt_pack(tmp_path) -> None:
    database = Database(tmp_path / "state.sqlite")
    database.initialize()
    from datetime import datetime, timezone
    database.upsert(GameRecord(1, "First", 60, 90, 120, 10, None), datetime(2026, 8, 10, tzinfo=timezone.utc))
    private, public = tmp_path / "key.pem", tmp_path / "public.json"
    generate_key(private, public)
    output = tmp_path / "candidate"
    build_snapshot(database, output, "2026.09.01.1", private)
    pack = output / "versions/2026.09.01.1/snapshot.pack"
    pack.write_bytes(pack.read_bytes()[:-1])
    import pytest
    with pytest.raises(ValueError, match="pack checksum"):
        verify_candidate(output, public)


def test_format_migration_allows_expected_size_reduction() -> None:
    previous = {"schema": 4, "timedEntryCount": 100, "steamMappingCount": 100, "pack": {"bytes": 3_000_000}}
    candidate = {"schema": 5, "timedEntryCount": 100, "steamMappingCount": 100, "pack": {"bytes": 1_500_000}}
    validate_delta(previous, candidate)


def test_delta_gate_blocks_mass_record_changes() -> None:
    import pytest
    previous = {
        "schema": 7,
        "entryCount": 100,
        "timedEntryCount": 100,
        "steamMappingCount": 100,
        "pack": {"bytes": 1000},
    }
    candidate = {
        "schema": 7,
        "timedEntryCount": 100,
        "steamMappingCount": 100,
        "pack": {"bytes": 1000},
        "changeSummary": {
            "addedRecordCount": 0,
            "removedRecordCount": 1,
            "changedRecordCount": 5,
            "changedOrRemovedRatio": 0.06,
        },
    }
    with pytest.raises(ValueError, match="More than 5%"):
        validate_delta(previous, candidate)


def test_time_change_codes_cover_delta_new_removed_and_unchanged() -> None:
    assert encode_time_change(60, 90) > 2
    assert encode_time_change(90, 60) > 2
    assert encode_time_change(None, 60) == 1
    assert encode_time_change(60, None) == 122
    assert encode_time_change(60, 60) == 0


def test_loads_schema_v5_as_first_history_baseline(tmp_path) -> None:
    raw = bytearray(b"HT5T")
    raw.extend(encode_unsigned(1))
    title = b"First"
    raw.extend(encode_unsigned(0))
    raw.extend(encode_unsigned(len(title)))
    raw.extend(title)
    for value in (7, 60, 90, 120):
        raw.extend(encode_unsigned(value))
    compressed = gzip.compress(bytes(raw), compresslevel=9, mtime=0)
    pack = tmp_path / "snapshot.pack"
    pack.write_bytes(compressed)
    manifest = tmp_path / "manifest.json"
    manifest.write_text(json.dumps({
        "schema": 5,
        "sourceUpdatedAt": "2026-08-01",
        "pack": {"path": "snapshot.pack"},
        "entries": [{
            "kind": "title",
            "offset": 0,
            "compressedBytes": len(compressed),
        }],
    }), encoding="utf-8")

    times, baseline_updated_at = load_previous_times(manifest)

    assert times == {7: (60, 90, 120)}
    assert baseline_updated_at == "2026-08-01"


def test_build_compares_against_previous_v6_snapshot(tmp_path) -> None:
    from datetime import datetime, timezone
    database = Database(tmp_path / "state.sqlite")
    database.initialize()
    checked = datetime(2026, 8, 10, tzinfo=timezone.utc)
    database.upsert(GameRecord(1, "First", 60, None, 120, 10, None), checked)
    private, public = tmp_path / "key.pem", tmp_path / "public.json"
    generate_key(private, public)
    baseline = tmp_path / "baseline"
    build_snapshot(database, baseline, "2026.08.01.1", private, source_updated_at="2026-08-01")
    database.upsert(GameRecord(1, "First", 90, 45, None, 10, None), checked)
    candidate = tmp_path / "candidate"
    manifest = build_snapshot(
        database, candidate, "2026.09.01.1", private,
        previous_manifest_path=baseline / "versions/2026.08.01.1/manifest.json",
        source_updated_at="2026-09-01",
    )
    assert manifest["baselineUpdatedAt"] == "2026-08-01"
    assert verify_candidate(candidate, public)["schema"] == 7


def test_verifier_does_not_count_removed_only_history_as_current_time(tmp_path) -> None:
    from datetime import datetime, timezone
    database = Database(tmp_path / "state.sqlite")
    database.initialize()
    checked = datetime(2026, 8, 10, tzinfo=timezone.utc)
    for game_id in range(1, 102):
        database.upsert(GameRecord(game_id, f"Game {game_id}", 60, None, None, game_id + 100, None), checked)
    private, public = tmp_path / "key.pem", tmp_path / "public.json"
    generate_key(private, public)
    baseline = tmp_path / "baseline"
    build_snapshot(database, baseline, "2026.08.01.1", private, source_updated_at="2026-08-01")
    database.upsert(GameRecord(1, "Game 1", None, None, None, 101, None), checked)
    candidate = tmp_path / "candidate"
    manifest = build_snapshot(
        database, candidate, "2026.09.01.1", private,
        previous_manifest_path=baseline / "versions/2026.08.01.1/manifest.json",
        source_updated_at="2026-09-01",
    )

    assert manifest["timedEntryCount"] == 100
    assert verify_candidate(candidate, public)["timedEntryCount"] == 100
