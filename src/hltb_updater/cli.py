from __future__ import annotations

import argparse
from dataclasses import asdict
import json
from pathlib import Path

from .backup import create_backup
from .client import HltbClient
from .database import Database
from .importer import import_json
from .scheduler import check_canaries, update_database
from .snapshot import build_snapshot, generate_key, verify_candidate


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(prog="hltb-updater")
    commands = root.add_subparsers(dest="command", required=True)
    init = commands.add_parser("init-db")
    init.add_argument("--database", required=True)
    import_command = commands.add_parser("import-json")
    import_command.add_argument("--database", required=True)
    import_command.add_argument("--source", required=True)
    import_command.add_argument("--source-date", required=True)
    rebalance = commands.add_parser("rebalance-schedule")
    rebalance.add_argument("--database", required=True)
    canary = commands.add_parser("canary")
    canary.add_argument("--database", required=True)
    canary.add_argument("--config", required=True)
    update = commands.add_parser("update")
    update.add_argument("--database", required=True)
    update.add_argument("--max-tail", type=int, default=2000)
    update.add_argument("--max-refresh", type=int, default=1000)
    backup = commands.add_parser("backup")
    backup.add_argument("--database", required=True)
    backup.add_argument("--directory", required=True)
    build = commands.add_parser("build")
    build.add_argument("--database", required=True)
    build.add_argument("--output", required=True)
    build.add_argument("--version", required=True)
    build.add_argument("--private-key", required=True)
    build.add_argument("--overrides", default="config/overrides.json")
    build.add_argument("--previous-manifest")
    build.add_argument("--source-date")
    verify = commands.add_parser("verify-candidate")
    verify.add_argument("--candidate", required=True)
    verify.add_argument("--public-key", required=True)
    key = commands.add_parser("generate-key")
    key.add_argument("--private-key", required=True)
    key.add_argument("--public-key", required=True)
    return root


def main() -> None:
    arguments = parser().parse_args()
    if arguments.command == "generate-key":
        generate_key(arguments.private_key, arguments.public_key)
        return
    if arguments.command == "verify-candidate":
        manifest = verify_candidate(arguments.candidate, arguments.public_key)
        print(json.dumps({
            "snapshotVersion": manifest["snapshotVersion"],
            "entryCount": manifest["entryCount"],
            "packBytes": manifest["pack"]["bytes"],
        }, sort_keys=True))
        return
    database = Database(arguments.database)
    database.initialize()
    if arguments.command == "init-db":
        print(f"Initialized {database.path}")
    elif arguments.command == "import-json":
        source_count, imported = import_json(
            database, arguments.source, arguments.source_date,
            progress=lambda count: print(f"Read {count} source entries", flush=True),
        )
        print(f"Imported {imported} games from {source_count} source entries")
    elif arguments.command == "rebalance-schedule":
        print(json.dumps({"rescheduled": database.rebalance_legacy_import_schedule()}, sort_keys=True))
    elif arguments.command == "canary":
        config = json.loads(Path(arguments.config).read_text(encoding="utf-8"))
        if config.get("schema") != 1 or not isinstance(config.get("games"), list):
            raise SystemExit("Invalid canary config")
        with HltbClient() as client:
            check_canaries(client, config["games"])
        print(f"Verified {len(config['games'])} canaries")
    elif arguments.command == "update":
        with HltbClient() as client:
            stats = update_database(database, client, arguments.max_tail, arguments.max_refresh)
        print(json.dumps(asdict(stats), sort_keys=True))
    elif arguments.command == "backup":
        print(create_backup(arguments.database, arguments.directory))
    elif arguments.command == "build":
        manifest = build_snapshot(
            database, arguments.output, arguments.version, arguments.private_key,
            arguments.overrides, arguments.previous_manifest, arguments.source_date,
        )
        print(json.dumps({
            "snapshotVersion": manifest["snapshotVersion"],
            "entryCount": manifest["entryCount"],
            "timedEntryCount": manifest["timedEntryCount"],
            "steamMappingCount": manifest["steamMappingCount"],
            "packBytes": manifest["pack"]["bytes"],
        }, sort_keys=True))


if __name__ == "__main__":
    main()
