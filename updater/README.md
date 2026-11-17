# HLTB snapshot updater

The Python collector, extension, and signed snapshots are maintained together in this repository. Python 3.11+ is required; production workflows use Python 3.12.

## Automatic operation

`.github/workflows/update-data.yml` runs every six hours on a standard GitHub-hosted Ubuntu runner. Each serialized job allows 90 minutes of collection inside a 120-minute job limit, then validates and commits the signed channel (`docs/data/v2`) and packaged fallback (`public/data/hltb-snapshot`) together. The site and data channel are deployed explicitly through `pages.yml`, since pushes made with GITHUB_TOKEN do not start ordinary push workflows.

Collection remains sequential with 0.75–1.5-second pacing. Requests already completed are committed immediately to SQLite. The `updater-state` prerelease stores one compressed database checkpoint; its replacement is uploaded before the previous asset is removed. Checkpoints include parsed game data and scheduling/status metadata, without keys, raw HTML, images, or user data. They are public along with the repository. GitHub Actions caches and temporary artifacts are not the authoritative state store.

A collection error still saves progress, but prevents publication. HTTP 403, 429 and repeated parser errors stop collection; Retry-After survives between runs. A job reaching its time budget finishes the current response, saves the chunk and resumes eligible work in a later job. Completed catch-up cohorts retain the existing publication gate.

## Keys and recovery

The `SNAPSHOT_SIGNING_KEY` Actions secret holds a Base64-encoded PEM P-256 private key. Its public counterpart is `config/snapshot-public-key.json`; the previous channel's public key is retained in `config/legacy-snapshot-public-key.json`. No private key belongs in source or release assets.

If the state release has never existed, the workflow restores distributed records from a verified snapshot. It preserves each game's actual check date, Steam mappings available in that snapshot, and untimed rows with ambiguous mappings until a live refresh replaces them. Missing internal history and excluded records cannot be recovered from a public snapshot. An existing but corrupt state release stops the job instead of silently resetting progress.

The original external data channel remains frozen for old extension versions. New versions use this repository's `/data/v2/` channel and a new signing key.

## Local development

```sh
python -m venv .venv
. .venv/bin/activate
python -m pip install -e '.[test]'
pytest -q
```

Manual workflow dispatch accepts a collection budget (clamped to 1–5400 seconds) and maximum due records (clamped to 0–5000). Short dispatches are useful for validating deployment. To inspect current counts and successful-check dates, use `../docs/data/v2/stable.json` and its referenced manifest.

The existing CLI supports JSON import, canaries, bounded update cycles, catch-up cohorts, snapshot recovery, and signed candidate verification. Publication retains parser canaries, coverage and size checks, the 5% record-change guard, signature verification, and a recently completed successful-cycle requirement.
