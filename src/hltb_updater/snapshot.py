from __future__ import annotations

import base64
from collections import defaultdict
from datetime import datetime, timezone
import gzip
from hashlib import sha256
import json
from pathlib import Path
import unicodedata
from typing import Any, Iterable

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature, encode_dss_signature

from .database import Database


BUCKET_COUNT = 64


def digest(value: bytes) -> str:
    return sha256(value).hexdigest()


def normalize_title(value: str) -> str:
    cleaned = value.translate(str.maketrans("", "", "™®©"))
    cleaned = unicodedata.normalize("NFKD", cleaned).replace("&", " and ")
    cleaned = "".join(
        "" if unicodedata.combining(character) else character if character.isalnum() else " "
        for character in cleaned
    )
    return " ".join(cleaned.lower().split())


def snapshot_bucket(normalized: str) -> int:
    value = 0x811C9DC5
    encoded = normalized.encode("utf-16-le")
    for index in range(0, len(encoded), 2):
        code_unit = encoded[index] | (encoded[index + 1] << 8)
        value ^= code_unit
        value = (value * 0x01000193) & 0xFFFFFFFF
    return value % BUCKET_COUNT


def encode_unsigned(value: int) -> bytes:
    output = bytearray()
    while True:
        byte = value & 0x7F
        value >>= 7
        if value:
            byte |= 0x80
        output.append(byte)
        if not value:
            return bytes(output)


def encode_steam_index(pairs: Iterable[tuple[int, int]]) -> bytes:
    output = bytearray()
    previous = 0
    for app_id, location in pairs:
        if app_id <= previous:
            raise ValueError("Steam App IDs must be strictly increasing")
        output.extend(encode_unsigned(app_id - previous))
        output.extend(encode_unsigned(location))
        previous = app_id
    return bytes(output)


def gzip_bytes(value: bytes) -> bytes:
    return gzip.compress(value, compresslevel=9, mtime=0)


def canonical_json(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")


def database_digest(rows: list[Any]) -> str:
    hasher = sha256()
    for row in rows:
        hasher.update(canonical_json([
            row["hltb_id"], row["title"], row["main_minutes"], row["extra_minutes"],
            row["completion_minutes"], row["steam_app_id"], row["steam_alt_app_id"],
        ]))
    return hasher.hexdigest()


def build_snapshot(
    database: Database,
    output: str | Path,
    version: str,
    private_key_path: str | Path,
    overrides_path: str | Path | None = None,
    previous_manifest_path: str | Path | None = None,
    source_updated_at: str | None = None,
) -> dict[str, Any]:
    if not __import__("re").fullmatch(r"\d{4}\.\d{2}\.\d{2}\.\d+", version):
        raise ValueError("Snapshot version must use YYYY.MM.DD.N")
    try:
        datetime.strptime(version.rsplit(".", 1)[0], "%Y.%m.%d")
    except ValueError as error:
        raise ValueError("Snapshot version contains an invalid calendar date") from error
    rows = database.records()
    if not rows:
        raise ValueError("Cannot build an empty snapshot")
    overrides = {"entries": []}
    if overrides_path:
        overrides = json.loads(Path(overrides_path).read_text(encoding="utf-8"))
        if overrides.get("schema") != 1 or not isinstance(overrides.get("entries"), list):
            raise ValueError("Invalid overrides file")

    records = {int(row["hltb_id"]): row for row in rows}
    title_candidates: dict[str, set[int]] = defaultdict(set)
    steam_candidates: dict[int, set[int]] = defaultdict(set)
    title_buckets: list[list[tuple[str, Any]]] = [[] for _ in range(BUCKET_COUNT)]
    for row in rows:
        normalized = normalize_title(str(row["title"]))
        title_candidates[normalized].add(int(row["hltb_id"]))
        title_buckets[snapshot_bucket(normalized)].append((normalized, row))
        for app_id in {row["steam_app_id"], row["steam_alt_app_id"]} - {None}:
            steam_candidates[int(app_id)].add(int(row["hltb_id"]))
    for override in overrides["entries"]:
        app_id = int(override["appId"])
        game_id = int(override["hltbGameId"])
        if game_id not in records:
            raise ValueError(f"Override points to unknown HLTB ID {game_id}")
        steam_candidates[app_id] = {game_id}

    locations: dict[int, int] = {}
    title_payloads: list[bytes] = []
    for bucket_index, bucket in enumerate(title_buckets):
        bucket.sort(key=lambda item: (item[0], int(item[1]["hltb_id"])))
        compact = []
        for row_index, (_, row) in enumerate(bucket):
            if row_index > 0xFFFF:
                raise ValueError(f"Title bucket {bucket_index} exceeds 65535 rows")
            game_id = int(row["hltb_id"])
            locations[game_id] = (bucket_index << 16) | row_index
            compact.append([
                row["title"], game_id, row["main_minutes"], row["extra_minutes"], row["completion_minutes"],
            ])
        title_payloads.append(json.dumps(compact, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))

    steam_buckets: list[list[tuple[int, int]]] = [[] for _ in range(BUCKET_COUNT)]
    steam_collisions = 0
    for app_id, game_ids in steam_candidates.items():
        if len(game_ids) != 1:
            steam_collisions += 1
            continue
        game_id = next(iter(game_ids))
        steam_buckets[app_id % BUCKET_COUNT].append((app_id, locations[game_id]))
    for bucket in steam_buckets:
        bucket.sort()

    pack = bytearray()
    entries: list[dict[str, Any]] = []

    def append_entry(kind: str, name: str, raw: bytes, count: int) -> None:
        compressed = gzip_bytes(raw)
        path = f"title/{name}.json.gz" if kind == "title" else f"steam/{name}.bin.gz"
        entries.append({
            "path": path, "kind": kind, "name": name, "offset": len(pack), "entries": count,
            "compressedBytes": len(compressed), "uncompressedBytes": len(raw),
            "sha256": digest(compressed), "uncompressedSha256": digest(raw),
        })
        pack.extend(compressed)

    for index, raw in enumerate(title_payloads):
        append_entry("title", f"{index:02x}", raw, len(title_buckets[index]))
    for index, pairs in enumerate(steam_buckets):
        append_entry("steam", f"{index:02x}", encode_steam_index(pairs), len(pairs))

    now = datetime.now(timezone.utc)
    source_date = source_updated_at or now.date().isoformat()
    title_collisions = [ids for ids in title_candidates.values() if len(ids) > 1]
    manifest = {
        "schema": 4,
        "snapshotVersion": version,
        "compression": "gzip",
        "sourceUpdatedAt": source_date,
        "generatedAt": now.isoformat().replace("+00:00", "Z"),
        "sourceEntryCount": len(rows),
        "timedEntryCount": sum(1 for row in rows if any(row[key] is not None for key in (
            "main_minutes", "extra_minutes", "completion_minutes"
        ))),
        "entryCount": len(rows),
        "normalizedTitleCount": len(title_candidates),
        "titleCollisionCount": len(title_collisions),
        "titleCollisionRecordCount": sum(len(ids) for ids in title_collisions),
        "steamMappingCount": sum(len(bucket) for bucket in steam_buckets),
        "steamCollisionCount": steam_collisions,
        "bucketCount": 64,
        "origin": "Incremental HLTB detail snapshot maintained by the private Forgejo updater",
        "source": {"lastGameId": max(records), "databaseSha256": database_digest(rows)},
        "pack": {"path": "snapshot.pack", "bytes": len(pack), "sha256": digest(pack)},
        "entries": entries,
    }
    if previous_manifest_path:
        previous = json.loads(Path(previous_manifest_path).read_text(encoding="utf-8"))
        validate_delta(previous, manifest)

    output_path = Path(output)
    version_path = output_path / "versions" / version
    version_path.mkdir(parents=True, exist_ok=True)
    manifest_bytes = canonical_json(manifest)
    (version_path / "manifest.json").write_bytes(manifest_bytes)
    (version_path / "snapshot.pack").write_bytes(pack)
    pointer = {
        "schema": 1,
        "snapshotVersion": version,
        "generatedAt": manifest["generatedAt"],
        "manifestPath": f"versions/{version}/manifest.json",
        "manifestSha256": digest(manifest_bytes),
    }
    pointer_bytes = canonical_json(pointer)
    private_key = serialization.load_pem_private_key(Path(private_key_path).read_bytes(), password=None)
    if not isinstance(private_key, ec.EllipticCurvePrivateKey) or not isinstance(private_key.curve, ec.SECP256R1):
        raise ValueError("Snapshot signing key must be ECDSA P-256")
    der_signature = private_key.sign(pointer_bytes, ec.ECDSA(hashes.SHA256()))
    r, s = decode_dss_signature(der_signature)
    signature = r.to_bytes(32, "big") + s.to_bytes(32, "big")
    output_path.mkdir(parents=True, exist_ok=True)
    (output_path / "stable.json").write_bytes(pointer_bytes)
    (output_path / "stable.sig").write_text(base64.b64encode(signature).decode("ascii") + "\n", encoding="ascii")
    return manifest


def validate_delta(previous: dict[str, Any], candidate: dict[str, Any]) -> None:
    for field in ("timedEntryCount", "steamMappingCount"):
        old = int(previous.get(field, 0))
        new = int(candidate[field])
        if old and new < old * 0.99:
            raise ValueError(f"{field} dropped by more than 1%")
    old_bytes = int(previous.get("pack", {}).get("bytes", 0))
    new_bytes = int(candidate["pack"]["bytes"])
    if old_bytes and not old_bytes * 0.8 <= new_bytes <= old_bytes * 1.2:
        raise ValueError("Snapshot pack size changed by more than 20%")


def decode_unsigned(value: bytes, offset: int) -> tuple[int, int]:
    result = 0
    shift = 0
    while offset < len(value) and shift <= 35:
        byte = value[offset]
        offset += 1
        result |= (byte & 0x7F) << shift
        if not byte & 0x80:
            return result, offset
        shift += 7
    raise ValueError("Invalid ULEB128 value")


def verify_candidate(candidate: str | Path, public_key_path: str | Path) -> dict[str, Any]:
    root = Path(candidate)
    pointer_bytes = (root / "stable.json").read_bytes()
    pointer = json.loads(pointer_bytes)
    version = pointer.get("snapshotVersion")
    if not isinstance(version, str) or not __import__("re").fullmatch(r"\d{4}\.\d{2}\.\d{2}\.\d+", version):
        raise ValueError("Invalid stable snapshot version")
    try:
        datetime.strptime(version.rsplit(".", 1)[0], "%Y.%m.%d")
    except ValueError as error:
        raise ValueError("Invalid stable snapshot calendar date") from error
    expected_manifest_path = f"versions/{version}/manifest.json"
    if pointer.get("schema") != 1 or pointer.get("manifestPath") != expected_manifest_path:
        raise ValueError("Invalid stable snapshot pointer")

    public_jwk = json.loads(Path(public_key_path).read_text(encoding="utf-8"))
    if public_jwk.get("kty") != "EC" or public_jwk.get("crv") != "P-256":
        raise ValueError("Snapshot public key must be ECDSA P-256")
    decode_coordinate = lambda value: int.from_bytes(base64.urlsafe_b64decode(value + "=" * (-len(value) % 4)), "big")
    public_key = ec.EllipticCurvePublicNumbers(
        decode_coordinate(public_jwk["x"]), decode_coordinate(public_jwk["y"]), ec.SECP256R1()
    ).public_key()
    signature = base64.b64decode((root / "stable.sig").read_text(encoding="ascii").strip(), validate=True)
    if len(signature) != 64:
        raise ValueError("Snapshot signature must contain two 32-byte coordinates")
    public_key.verify(
        encode_dss_signature(int.from_bytes(signature[:32], "big"), int.from_bytes(signature[32:], "big")),
        pointer_bytes,
        ec.ECDSA(hashes.SHA256()),
    )

    manifest_bytes = (root / expected_manifest_path).read_bytes()
    if digest(manifest_bytes) != pointer.get("manifestSha256"):
        raise ValueError("Snapshot manifest checksum mismatch")
    manifest = json.loads(manifest_bytes)
    if (manifest.get("schema"), manifest.get("snapshotVersion"), manifest.get("compression")) != (4, version, "gzip"):
        raise ValueError("Unsupported snapshot manifest")
    entries = manifest.get("entries")
    if not isinstance(entries, list) or len(entries) != 128:
        raise ValueError("Snapshot manifest must contain 128 pack entries")
    pack = (root / "versions" / version / "snapshot.pack").read_bytes()
    if len(pack) != manifest["pack"]["bytes"] or digest(pack) != manifest["pack"]["sha256"]:
        raise ValueError("Snapshot pack checksum mismatch")

    title_rows: dict[int, list[list[Any]]] = {}
    seen_entries: set[tuple[str, int]] = set()
    expected_offset = 0
    for entry in entries:
        if not isinstance(entry, dict) or entry.get("kind") not in {"title", "steam"}:
            raise ValueError("Invalid snapshot entry kind")
        if entry["offset"] != expected_offset:
            raise ValueError(f"Invalid offset for {entry['path']}")
        compressed = pack[entry["offset"]:entry["offset"] + entry["compressedBytes"]]
        if len(compressed) != entry["compressedBytes"] or digest(compressed) != entry["sha256"]:
            raise ValueError(f"Compressed checksum mismatch for {entry['path']}")
        raw = gzip.decompress(compressed)
        if len(raw) != entry["uncompressedBytes"] or digest(raw) != entry["uncompressedSha256"]:
            raise ValueError(f"Uncompressed checksum mismatch for {entry['path']}")
        bucket = int(entry["name"], 16)
        expected_path = f"{entry['kind']}/{entry['name']}.{'json' if entry['kind'] == 'title' else 'bin'}.gz"
        if not 0 <= bucket < BUCKET_COUNT or entry["path"] != expected_path:
            raise ValueError(f"Invalid snapshot entry path {entry['path']}")
        entry_key = (entry["kind"], bucket)
        if entry_key in seen_entries:
            raise ValueError(f"Duplicate snapshot entry {entry['path']}")
        seen_entries.add(entry_key)
        if entry["kind"] == "title":
            rows = json.loads(raw)
            if not isinstance(rows, list) or len(rows) != entry["entries"] or any(
                not isinstance(row, list) or len(row) != 5
                or not isinstance(row[0], str) or not row[0]
                or not isinstance(row[1], int) or isinstance(row[1], bool) or row[1] <= 0
                or any(value is not None and (not isinstance(value, int) or isinstance(value, bool) or value <= 0) for value in row[2:])
                for row in rows
            ):
                raise ValueError(f"Invalid title bucket {entry['path']}")
            title_rows[bucket] = rows
        else:
            pairs = []
            offset = 0
            previous_app_id = 0
            while offset < len(raw):
                delta, offset = decode_unsigned(raw, offset)
                location, offset = decode_unsigned(raw, offset)
                app_id = previous_app_id + delta
                if app_id <= previous_app_id or app_id % BUCKET_COUNT != bucket:
                    raise ValueError(f"Invalid Steam index ordering in {entry['path']}")
                pairs.append((app_id, location))
                previous_app_id = app_id
            if len(pairs) != entry["entries"]:
                raise ValueError(f"Invalid Steam index count in {entry['path']}")
            for _, location in pairs:
                title_bucket, row_index = location >> 16, location & 0xFFFF
                if title_bucket not in title_rows or row_index >= len(title_rows[title_bucket]):
                    raise ValueError(f"Invalid packed title location in {entry['path']}")
        expected_offset += entry["compressedBytes"]
    if expected_offset != len(pack) or len(seen_entries) != BUCKET_COUNT * 2:
        raise ValueError("Snapshot pack has trailing data or missing buckets")
    return manifest


def generate_key(private_path: str | Path, public_path: str | Path) -> None:
    private_key = ec.generate_private_key(ec.SECP256R1())
    Path(private_path).parent.mkdir(parents=True, exist_ok=True)
    Path(private_path).write_bytes(private_key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ))
    numbers = private_key.public_key().public_numbers()
    encoded = lambda value: base64.urlsafe_b64encode(value.to_bytes(32, "big")).decode("ascii").rstrip("=")
    public = {"kty": "EC", "crv": "P-256", "x": encoded(numbers.x), "y": encoded(numbers.y), "ext": True}
    Path(public_path).parent.mkdir(parents=True, exist_ok=True)
    Path(public_path).write_text(json.dumps(public, indent=2) + "\n", encoding="utf-8")
