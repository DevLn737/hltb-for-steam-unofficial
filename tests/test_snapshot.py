import base64
import json

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature

from hltb_updater.database import Database
from hltb_updater.model import GameRecord
from hltb_updater.snapshot import build_snapshot, generate_key, normalize_title, snapshot_bucket, verify_candidate


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
    private = tmp_path / "key.pem"
    public = tmp_path / "public.json"
    generate_key(private, public)
    output = tmp_path / "candidate"
    manifest = build_snapshot(database, output, "2026.09.01.1", private, source_updated_at="2026-08-10")
    assert manifest["entryCount"] == 2
    assert manifest["timedEntryCount"] == 1
    assert manifest["steamMappingCount"] == 2
    assert len(manifest["entries"]) == 128
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
