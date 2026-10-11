# HLTB snapshot updater

Private updater for the signed data channel used by HLTB for Steam v2.2. It keeps the canonical working dataset in SQLite, incrementally discovers new HLTB IDs, refreshes existing records on an adaptive schedule, and emits a strict data-only snapshot. It is intentionally separate from the public extension repository.

## Requirements

- Python 3.11+
- A persistent directory mounted at `/var/lib/hltb-updater` on the Forgejo runner
- A fine-grained GitHub token limited to the public data repository
- An ECDSA P-256 private key stored as a Forgejo secret or protected runner file

The dedicated runner job image is built from `runner/Dockerfile`. It combines Node.js 22 for JavaScript-based Forgejo actions with an isolated Python 3.11 environment for the updater.
`runner/docker-compose.override.yaml` creates a repository-scoped runner with its own Docker-in-Docker daemon, image cache, TLS certificates, and private network. The SQLite state is never mounted into the shared runner or its Docker daemon.

The updater DinD and runner use fixed frontend addresses `172.30.50.6` and `172.30.50.7`. Addresses `.2` through `.5` belong to the Forgejo proxy, server, shared DinD, and shared runner; dynamic allocation in this network can otherwise take the stopped server's address and prevent it from restarting.

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

Nightly parser canaries include Crimson Desert. With `canary --save-results`, the validated responses are retained in the database only after all canaries pass, so these control games are refreshed on each successful nightly check instead of waiting in the regular due queue.

```bash
hltb-updater canary --database state/hltb.sqlite --config config/canaries.json
hltb-updater update --database state/hltb.sqlite --max-tail 2000 --max-refresh 1000
hltb-updater backup --database state/hltb.sqlite --directory state/backups
hltb-updater build --database state/hltb.sqlite --output candidate --version 2026.09.01.1 --private-key state/secrets/snapshot-signing-key.pem
```

For a one-time full refresh, freeze the overdue cohort and let the nightly workflow process it in resumable chunks:

```bash
hltb-updater catch-up-init --database state/hltb.sqlite --cutoff 2026-09-04
hltb-updater catch-up-status --database state/hltb.sqlite --cutoff 2026-09-04
hltb-updater catch-up-run --database state/hltb.sqlite --cutoff 2026-09-04 --max-refresh 5000
```

Transient failures remain pending and obey the normal retry schedule. Successful responses and genuine 404 responses complete a cohort member. `update-cycle` automatically processes the oldest active catch-up instead of the regular tail/due queues and returns to normal operation when the cohort is complete.

The same operation is available from Forgejo through the nightly workflow's optional `catchUpCutoff` input. Initializing an existing cutoff is idempotent, so retrying a failed dispatch does not duplicate or reset the cohort. For a one-time accelerated drain, enable `continueCatchUp`: after each successful bounded chunk, the workflow queues exactly one successor while eligible records remain. Progress is committed after every response, and all request pacing and circuit breakers still apply. A transiently failed record under backoff stops the chain when it is the only remaining work and is retried by a later nightly run.

`build` creates `stable.json`, `stable.sig`, and an immutable `versions/<version>/` directory. Schema v7 stores a compact per-record last-successful-check date; failed HTTP or parser attempts never make stale completion times appear fresh. It does not publish anything by itself. The Forgejo publish workflow pushes the verified candidate to the dedicated GitHub Pages repository only after all gates pass. The initial public schema-v7 snapshot compares against the retained July 2026 schema-v6 baseline; later snapshots compare against the previous public stable version. Publication uses a write-enabled GitHub deploy key scoped only to the data repository; no account-wide GitHub token is stored in Forgejo.

## Forgejo configuration

Register a self-hosted runner with the dedicated `hltb-updater` label and mount its persistent state at `/var/lib/hltb-updater`. Configure these repository secrets:

- `SNAPSHOT_SIGNING_KEY`: the Base64-encoded PEM ECDSA P-256 private key matching `config/snapshot-public-key.json`;
- `DATA_REPOSITORY_URL`: the HTTPS clone URL of the dedicated public data repository;
- `DATA_REPOSITORY_TOKEN`: a fine-grained GitHub token limited to that repository;
- `ISSUE_REPORT_TOKEN`: a token allowed to create issues only in this private updater repository.

Nightly runs update SQLite, create retained backups, and build a fully verified shadow candidate without publishing it. Successful job startup proves access to the isolated Docker daemon; the in-job preflight then checks Forgejo, persistent storage, and required DNS before touching the database. Nightly and publication failures leave the current stable channel untouched and are reported by the independent monitor. Stable publication is disabled by default. Set the Forgejo repository variable `ENABLE_STABLE_PUBLISH=true` only after the planned shadow period and data-channel acceptance.

Workflows fetch this private repository directly over Forgejo's internal network with the run-scoped ephemeral token. They do not depend on an externally hosted checkout action, a long-lived repository credential, or public access to updater sources.

An independent ten-minute health monitor runs on the shared `docker` runner. It opens one deduplicated internal issue when the dedicated runner queue is stalled, a nightly exceeds 3 hours 15 minutes, or no successful nightly has completed within 36 hours. It closes that issue automatically after recovery.

## Safety

- One HTTP request at a time with 0.75–1.5 second jitter.
- `429` honors `Retry-After`; `403`, repeated parse errors, and canary failures stop the run.
- A game becomes a tombstone only after three 404 responses on separate days over at least 30 days.
- The stable channel is not modified when coverage, size, parser, checksum, or contract gates fail.
- Publication requires a completed updater cycle within the last 36 hours, a successful game refresh from that cycle, and no unfinished catch-up cohort. A server restart cannot republish old database contents under a new calendar version.
- Publication stops when changed or removed records exceed 5% of the previous stable snapshot.
- Raw HTML, descriptions, reviews, and images are never stored.
