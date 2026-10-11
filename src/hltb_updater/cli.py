from __future__ import annotations

import argparse
from dataclasses import asdict
from datetime import date
import json
from pathlib import Path

from .backup import create_backup
from .client import HltbClient
from .database import Database
from .importer import import_json
from .scheduler import (
    UpdateStats,
    apply_result,
    check_canaries,
    check_publication_readiness,
    refresh_catch_up,
    run_update_cycle,
    update_database,
)
from .snapshot import build_snapshot, generate_key, verify_candidate


def positive_int(value: str) -> int:
    parsed = int(value)
    if parsed < 1:
        raise argparse.ArgumentTypeError("value must be a positive integer")
    return parsed


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
    canary.add_argument("--save-results", action="store_true")
    publication = commands.add_parser("check-publication")
    publication.add_argument("--database", required=True)
    publication.add_argument("--max-age-hours", type=positive_int, default=36)
    update = commands.add_parser("update")
    update.add_argument("--database", required=True)
    update.add_argument("--max-tail", type=int, default=2000)
    update.add_argument("--max-refresh", type=int, default=1000)
    cycle = commands.add_parser("update-cycle")
    cycle.add_argument("--database", required=True)
    cycle.add_argument("--max-tail", type=int, default=2000)
    cycle.add_argument("--max-refresh", type=int, default=1000)
    cycle.add_argument("--catch-up-limit", type=positive_int, default=5000)
    catch_up_init = commands.add_parser("catch-up-init")
    catch_up_init.add_argument("--database", required=True)
    catch_up_init.add_argument("--cutoff", required=True, type=date.fromisoformat)
    catch_up_run = commands.add_parser("catch-up-run")
    catch_up_run.add_argument("--database", required=True)
    catch_up_run.add_argument("--cutoff", required=True, type=date.fromisoformat)
    catch_up_run.add_argument("--max-refresh", type=positive_int, default=5000)
    catch_up_status = commands.add_parser("catch-up-status")
    catch_up_status.add_argument("--database", required=True)
    catch_up_status.add_argument("--cutoff", required=True, type=date.fromisoformat)
    refresh = commands.add_parser("refresh-id")
    refresh.add_argument("--database", required=True)
    refresh.add_argument("--game-id", required=True, type=int)
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
    elif arguments.command == "check-publication":
        from datetime import timedelta
        updated = check_publication_readiness(database, timedelta(hours=arguments.max_age_hours))
        print(json.dumps({"lastUpdateAt": updated.isoformat(), "ready": True}, sort_keys=True))
    elif arguments.command == "canary":
        config = json.loads(Path(arguments.config).read_text(encoding="utf-8"))
        if config.get("schema") != 1 or not isinstance(config.get("games"), list):
            raise SystemExit("Invalid canary config")
        with HltbClient() as client:
            records = check_canaries(client, config["games"])
        if arguments.save_results:
            from .database import utc_now
            checked_at = utc_now()
            for record in records:
                database.upsert(record, checked_at)
        print(f"Verified {len(config['games'])} canaries")
    elif arguments.command == "update":
        with HltbClient() as client:
            stats = update_database(database, client, arguments.max_tail, arguments.max_refresh)
        print(json.dumps(asdict(stats), sort_keys=True))
    elif arguments.command == "update-cycle":
        with HltbClient() as client:
            mode, cutoff, stats = run_update_cycle(
                database, client, arguments.max_tail, arguments.max_refresh, arguments.catch_up_limit,
            )
        output = {"mode": mode, "cutoffDate": cutoff.isoformat() if cutoff else None, **asdict(stats)}
        if cutoff is not None:
            output["catchUp"] = database.catch_up_status(cutoff)
        print(json.dumps(output, sort_keys=True))
    elif arguments.command == "catch-up-init":
        from .database import utc_now
        print(json.dumps(database.initialize_catch_up(arguments.cutoff, utc_now()), sort_keys=True))
    elif arguments.command == "catch-up-run":
        status = database.catch_up_status(arguments.cutoff)
        if status["createdAt"] is None:
            raise SystemExit(f"Catch-up {arguments.cutoff.isoformat()} has not been initialized")
        with HltbClient() as client:
            stats = refresh_catch_up(database, client, arguments.cutoff, arguments.max_refresh)
        print(json.dumps({**asdict(stats), "catchUp": database.catch_up_status(arguments.cutoff)}, sort_keys=True))
    elif arguments.command == "catch-up-status":
        print(json.dumps(database.catch_up_status(arguments.cutoff), sort_keys=True))
    elif arguments.command == "refresh-id":
        from .database import utc_now
        if arguments.game_id <= 0:
            raise SystemExit("--game-id must be a positive integer")
        with HltbClient() as client:
            result = client.fetch(arguments.game_id)
        stats = UpdateStats(highest_id=database.max_id())
        apply_result(database, arguments.game_id, result, utc_now(), stats)
        print(json.dumps({"gameId": arguments.game_id, "status": result.status, **asdict(stats)}, sort_keys=True))
        if result.status != "ok":
            raise SystemExit(f"HLTB ID {arguments.game_id} refresh failed with {result.status}")
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
