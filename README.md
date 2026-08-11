# HLTB snapshot updater

Private updater for the signed data channel used by HLTB for Steam — Unofficial v2.2. It keeps the canonical working dataset in SQLite, incrementally discovers new HLTB IDs, refreshes existing records on an adaptive schedule, and emits a strict data-only snapshot. It is intentionally separate from the public extension repository.

## Requirements

- Python 3.11+
- A persistent directory mounted at `/var/lib/hltb-updater` on the Forgejo runner
- A fine-grained GitHub token limited to the public data repository
- An ECDSA P-256 private key stored as a Forgejo secret or protected runner file

The dedicated runner job image is built from `runner/Dockerfile`. It combines Node.js 22 for JavaScript-based Forgejo actions with an isolated Python 3.11 environment for the updater.
`runner/docker-compose.override.yaml` creates a repository-scoped runner with its own Docker-in-Docker daemon, image cache, TLS certificates, and private network. The SQLite state is never mounted into the shared runner or its Docker daemon.

## Bootstrap

```bash
python -m venv .venv
. .venv/bin/activate
python -m pip install -e '.[test]'
hltb-updater init-db --database state/hltb.sqlite
hltb-updater import-json --database state/hltb.sqlite --source /archive/hltb_data.json --source-date 2026-07-22
pytest
```

The importer streams the top-level JSON array and never loads the source file into memory. It stores only the fields required by the extension.

## Shadow-mode operations

```bash
hltb-updater canary --database state/hltb.sqlite --config config/canaries.json
hltb-updater update --database state/hltb.sqlite --max-tail 2000 --max-refresh 1000
hltb-updater backup --database state/hltb.sqlite --directory state/backups
hltb-updater build --database state/hltb.sqlite --output candidate --version 2026.09.01.1 --private-key state/secrets/snapshot-signing-key.pem
```

`build` creates `stable.json`, `stable.sig`, and an immutable `versions/<version>/` directory. It does not publish anything by itself. The Forgejo publish workflow pushes the verified candidate to the dedicated GitHub Pages repository only after all gates pass.

## Forgejo configuration

Register a self-hosted runner with the dedicated `hltb-updater` label and mount its persistent state at `/var/lib/hltb-updater`. Configure these repository secrets:

- `SNAPSHOT_SIGNING_KEY`: the PEM ECDSA P-256 private key matching `config/snapshot-public-key.json`;
- `DATA_REPOSITORY_URL`: the HTTPS clone URL of the dedicated public data repository;
- `DATA_REPOSITORY_TOKEN`: a fine-grained GitHub token limited to that repository;
- `ISSUE_REPORT_TOKEN`: a token allowed to create issues only in this private updater repository.

Nightly runs update SQLite, create retained backups, and build a fully verified shadow candidate without publishing it. Stable publication is disabled by default. Set the Forgejo repository variable `ENABLE_STABLE_PUBLISH=true` only after the planned shadow period and data-channel acceptance. A failed publication job creates an internal issue and leaves the current stable channel untouched.

## Safety

- One HTTP request at a time with 0.75–1.5 second jitter.
- `429` honors `Retry-After`; `403`, repeated parse errors, and canary failures stop the run.
- A game becomes a tombstone only after three 404 responses on separate days over at least 30 days.
- The stable channel is not modified when coverage, size, parser, checksum, or contract gates fail.
- Raw HTML, descriptions, reviews, and images are never stored.
