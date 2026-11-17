# Snapshot automation implementation plan

**Goal:** Run collection unattended on GitHub and keep the extension's committed fallback current.

**Architecture / spec:** User additionally authorized consolidating all HLTB repositories. Preserve imported histories in one public extension repository: Python code in `updater/`, historical data in `docs/data/`, new signed channel in `docs/data/v2/`, packaged fallback in `public/data/hltb-snapshot/`. Run sequential collection every six hours on standard public GitHub-hosted runners, with a 90-minute collection budget and 120-minute job limit. Persist SQLite in an `updater-state` prerelease between chunks, including collection failures. Keep the legacy external channel unchanged for existing versions. Generate a new P-256 signing key held only in Actions secrets. Verify/import signed local data, run full extension checks and Firefox verification, commit both data forms together, and explicitly deploy Pages. Standard public runners avoid private-repository compute limits.

**Tech stack:** Python 3.12, SQLite, existing schema-v7 codec, GitHub Actions, Node.js 22, WXT.

**Execution:** Inline; user delegated platform and implementation choices and authorized deployment. Edit in place, retain existing work, create no duplicate worktrees, and never expose private keys. Record product changes in CHANGELOG.md. Deployment, secrets, workflow dispatch, and necessary commits/pushes are within the requested scope.

## Tasks

- [x] Confirm HLTB canaries work from a GitHub-hosted runner before committing to this host.
- [x] Add failing recovery tests for checked-date preservation, Steam mappings, invalid signatures, nonempty databases, and empty Steam-linked records. Implement `restore_snapshot(database, candidate, public_key)` using verified schema-v7 data without inventing fresh checks.
- [x] Verify Python recovery, time-budget, and checkpoint tests. Neutralize source metadata and replace obsolete runner configuration with GitHub workflows.
- [x] Generate/store the new signing key as an Actions secret and keep public keys in source. Consolidation removes the need for cross-repository credentials. Persist state before publication and after collection failures; never use an expiring cache as the only state copy.
- [x] Deploy daily collection with serialized runs, bounded requests, existing canary/rate-limit/publication gates, durable state recovery, versioned publication, and fixed new-channel URLs. Verify a real run, live source date, checksums, and signature.
- [x] Switch the extension to the new key/channel. Import and validate the signed local channel in the same scheduled/manual update job, then commit both forms of data together. Update documentation and CHANGELOG.md.
- [x] Run extension checks, Firefox build verification, and a live import. Publish changes, dispatch the sync workflow, and inspect completion and committed data in both repositories.

## Review focus

- Failed collection must retain progress but must not publish stale data.
- A restored game's last-successful-check date must remain its original date.
- A missing state release is bootstrapped from verified data; a corrupt existing state must fail closed.
- Legacy clients must retain access to the old signed channel.
- Workflow commits using GITHUB_TOKEN must be validated in the workflow itself because they do not trigger push CI.

## Progress

- Restored source archive and complete Git history; private repository created. Hosted access probe prepared.

- Hosted access probe passed all four control games on GitHub Actions.
- Python suite: 56 passing tests. Extension: 109 passing tests, typecheck/lint/Chrome build/package verification passed.
- Ruling: use a public monorepository after the user's consolidation request; keep parsed SQLite checkpoints public and signing material secret. This removes private Actions compute costs but exposes game-collection status metadata.
- Ruling: keep the old data endpoint frozen for installed clients; publish the rotated key under a new path. Old clients require an extension upgrade to consume new data.

- Final review: two important issues fixed with failing regression tests followed by a green 59-test Python suite: persisted canary Retry-After and canary dates falsely satisfying unsuccessful collection publication.
- Browser validation: all three Playwright tests passed; Firefox build and package verification passed.
- Ruling: isolated network failures may coexist with publishable successful collection responses; a chunk with no successful collection never advances completion metadata or publishes. This permits useful partial updates while failing fully unsuccessful runs.
- Final review deliberately did not verify remote settings or old Git objects; deployment checks below cover remote permissions, signature, state resume, and Pages. Archive inventory and Git-bundle path inspection found no private-key or state paths in imported history.

- Live deployment found hard-coded October values in packaged-snapshot tests. Pinned exact reader regressions to the retained October fixture and added a separate current-package lookup check; 110 TypeScript tests and npm check pass.
- Strengthened interruption regression to prove normal frontier scans resume at the next ID. It failed on repeated ID 1, then passed after checkpointing the frontier cursor. Full Python suite: 59 passing tests.
- First live collection checkpoint was retained despite publication tests failing, confirming failed validation does not publish or lose collection state.

- Deployment complete: Update HLTB data run 44057153956 passed collection, recovery from the previous saved state, signature/import checks, 110 TypeScript tests, fresh-data release gate, Chrome/Firefox builds, coupled data commit, and Pages deployment.
- Live HTTPS channel verified by the Node importer: snapshot 2026.11.17.201, 85,186 distributed games and 59,683 Steam mappings; source date 2026-11-17. Individual record dates remain historical unless actually checked.
- Both obsolete repositories are archived. The legacy data repository contains a migration notice and still serves its original signed pointer byte-for-byte. The unified repository preserves both imported histories.
- Local release packaging and reviewer-source archive checks passed. Final review findings were fixed; no deferred review minors.
