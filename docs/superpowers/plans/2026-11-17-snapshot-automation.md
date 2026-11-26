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

- Final fresh-data browser run exposed one more October-only assertion (39.5/57 hours versus current 41/58). Updated the smoke test to check all category labels, valid duration format, and the exact game identity; all 3 browser tests pass. Publish patch 2.2.7 rather than rewriting the already published 2.2.6 tag.

## Readiness audit — 2026-11-17

- Repository is public and active; all four project workflows are enabled. Default workflow token is read-only; update/release and Pages jobs explicitly request the required permissions. Pages uses workflow deployment, and SNAPSHOT_SIGNING_KEY is configured.
- Latest main CI, Pages and v2.2.7 release runs passed. The release contains Chrome ZIP, Firefox ZIP, unsigned XPI, and reviewer sources.
- Live ECDSA signature, manifest/pack SHA-256, all packaged snapshot buckets, 72-hour freshness gate, privacy page and support page verified successfully. Current version: 2026.11.17.201, source date 2026-11-17, 85,186 distributed games and 59,683 Steam mappings.
- Restored SQLite checkpoint passes quick_check. It contains 85,237 internal rows; 80 were successfully checked today, and 58,457 are currently due. No catch-up cohort is active. The two integration collection runs used 90-second budgets, not full 90-minute scheduled collection.
- Scheduled collection: 00:17/06:17/12:17/18:17 UTC; at this audit, next expected start is November 17 at 13:17 Europe/Berlin. A full-budget run should finish around 14:50 local time, subject to queue and network delays.
- Recommendation: observe 2–4 full scheduled runs (12–24 hours) before a broad store rollout. At roughly 15,000–20,000 requests/day, the currently due queue is several days of work (roughly 4–7 days allowing overhead), not a 12-hour guarantee. Older individual record dates remain valid and are not relabeled by publication.
- Nonblocking documentation drift: docs/FIREFOX_AMO.md still names 2.2.5 upload artifacts; current release artifacts are 2.2.7. Main is not branch-protected; the data workflow currently requires direct pushes.

## Runner and database audit — 2026-11-18

- Full scheduled run 44174002500 succeeded: November 17, 21:53–23:25 Europe/Berlin. Collection consumed its 90-minute budget; total update job took 91m44s, followed by a successful Pages deployment.
- Collection: 4,002 attempts, 3,996 successful responses, 358 changed records, 6 missing responses, zero network/parser errors. Python 59 tests and TypeScript 110 tests passed before publication.
- Saved checkpoint state-44174002500-1.sqlite.gz passes SQLite quick_check. Internal rows increased from 85,237 to 85,446; 4,074 records have successful checks dated November 17 (previous audit: 80). At November 18 audit time, 55,063 records are due. No November 18 successful checks yet; the latest completed cycle remains November 17 22:23 UTC. Frontier cursor completed and was cleared.
- Published signed snapshot 2026.11.17.301 contains 85,225 distributed games and 59,713 Steam mappings (+39/+30). Live ECDSA signature and SHA-256 verified; committed packaged bucket hashes match the live channel. Data commit ca44d41.
- Scheduling caveat: only one schedule-triggered run is visible despite the six-hour cron. At 02:39 Europe/Berlin on November 18, no 00:17 UTC invocation appears. Workflow is active, and GitHub reports Actions operational; exact delay/omission cause is not established. GitHub documents schedule delays and possible dropped jobs under load. Full-run health is confirmed, but four daily starts are not yet demonstrated; the earlier 4–7-day backlog estimate assumes that cadence.

## Schedule recovery — 2026-11-18

- Confirmed the missing invocation has no workflow run at all; it did not reach runner allocation. Workflow is enabled, cron is valid on main, and the previous scheduled run succeeded. GitHub does not expose an internal reason for an omitted schedule event; no specific outage or configuration failure is established.
- Replace a single six-hour cron opportunity with hourly eligibility checks. Determine actual collection age from the latest checkpoint asset's producing run. Skipped checks never reset that age; retain the single-writer concurrency group and explicit manual override. Changing cron also refreshes the schedule actor association.
- Five regression tests cover initial bootstrap, early skip, six-hour boundary/late retry, forced manual invocation, and malformed/future timestamps. Tests failed before schedule.py existed and pass after implementation. Read-only execution against the real checkpoint correctly skipped an early repeat.
- Scope: push a normal source commit and validate Actions. Do not create a new extension version, release tag, or GitHub Release; the user explicitly requires separate authorization for those.

## Progress and stability audit — 2026-11-22

- Audited all 15 workflow runs since November 18: all succeeded. There were 11 full scheduled collection runs, 2 scheduled eligibility skips, 1 short manual collection and 1 manual eligibility skip. All 12 collection runs published successfully; no failed or cancelled runs in this period.
- Aggregate collection statistics: 45,175 attempts, 45,008 successful game responses, 6,543 change events (may repeat a game), 166 missing responses, 1 network/parser error. Missing HTTP responses are not counted as transport/parser failures.
- Current SQLite passes quick_check: 86,396 active rows; 42,520 distinct games successfully checked since November 18, 5,578 previously known rows changed, 950 new working rows. Due queue: 14,288, versus 55,063 in the previous audit (74.1% net reduction). Statuses: 86,385 ok, 10 missing, 1 network_error.
- Live signed snapshot 2026.11.22.1801 is dated November 22 and contains 85,546 distributed games and 60,046 Steam mappings (+321/+333 since the November 18 baseline). ECDSA signature, manifest/pack SHA-256, and correspondence with committed packaged bucket hashes verified.
- Latest scheduled collection finished November 22 at 05:08 Europe/Berlin; checkpoint saved at 05:07 local. Last successful collection metadata and checkpoint agree.
- Throughput is stable around 4,000 requests per 90-minute chunk. Schedule remains approximate: full collection start gaps range 6.19–13.90 hours, averaging about 8.8 hours rather than 6. Hourly eligibility events are not being created hourly by GitHub; do not describe this as strict scheduling reliability. At observed throughput the current due queue is roughly 1–2 further days of work, subject to incoming due records and GitHub/HLTB delays.
- No source, Actions, version, or release changes made during this audit. Results recorded in the existing journal only.

## Backlog acceleration implementation — 2026-11-22

User authorized immediate backlog acceleration and stronger scheduling, explicitly forbidding extension versions and releases.

Plan: test checkpoint-linked backlog eligibility and read-only queue counting; publish progress with both data forms and self-dispatch successful jobs until the queue is empty; retain hourly recovery, singleton collection, current pacing and safety gates; run full tests, review, deploy a normal commit and verify a real continuation. No package version, tag, extension release, signing key, request parallelism or request interval changes.

Design choice: use GitHub's documented GITHUB_TOKEN workflow_dispatch exception, so successful collection does not wait for another best-effort cron event. A matching durable checkpoint is required for accelerated eligibility; failed jobs do not dispatch successors. A replaced pending continuation remains recoverable through the hourly gate.

- New regression tests failed before implementation (missing backlog/progress APIs) and pass afterward: 10 schedule tests plus one SQLite eligibility test. Queue exhaustion restores normal timing; stale checkpoints cannot enable acceleration; malformed queue counts fail closed; progress observation preserves actual game-check dates.
- Full local Python suite: 70 passed. Additional runtime dependencies were installed only into a temporary test environment for verification.

- Deployment verification: commit 200a006 and CI run 44986563006 succeeded. Probe collection 44986563761 passed data checks, both builds, coupled commit 5316c14, Pages, and its continuation job. It published checkpoint-linked progress with 14,288 pending records.
- The continuation itself created workflow_dispatch run 44986834848 as github-actions[bot], without a human dispatch or cron event. Its due gate passed within minutes of the previous collection and it entered the next update job using normal default limits. This confirms immediate real chaining; normal 90-minute collection is now in progress. Queue-empty stop is covered by regression tests; the real backlog is not yet empty.
- Extension remains 2.2.7. No extension version changes, release tags, or GitHub extension releases created. Temporary test environment and generated local test caches removed. This verification note is kept locally while the chain runs, avoiding a main-branch push racing the collector's data commit.

## Pages deployment recovery — 2026-11-26

Four failed data workflows (44993648353, 45052511093, 45594549243, 45691970701) succeeded through collection, verification and commit. Pages failed to list the artifact immediately after upload. The latest upload reported artifact ID 15060300679, which the Actions API subsequently returned as available. Before repair, Pages served snapshot 2026.11.25.3001 while main contained 2026.11.25.3201.

The Pages workflow waits for the exact uploaded artifact, uses run-attempt-specific artifact names and retries deployment twice with delays. If a later collection check skips collection while the public snapshot differs from main, it retries Pages alone. This lets publication recover without another HLTB scan. Updated store checklists to reference matching current artifacts and the actual host permissions.

Local actionlint, packaged snapshot validation and the 72-hour release freshness gate passed. A normal main push exercises Pages and the CI packaging path. No version bump or release tag is part of this change.

Verification: Pages run 45745856849 deployed the already committed snapshot .3201 on its first attempt. CI run 45745856919 passed 70 Python, 110 extension and 3 browser tests, plus Chrome/Firefox/source packaging. All four downloaded archives pass ZIP integrity, and the extension packages have matching snapshot/version metadata. Local shell regression checks exercised previously missing and delayed artifacts and matching, stale, and unreachable Pages snapshots. Full updater run 45745903690 succeeded through publication and follow-up dispatch, and its SQLite checkpoint passed quick_check. Public snapshot 2026.11.26.3301 (85,583 games, 60,301 Steam mappings) matches the packaged snapshot and passed ECDSA and SHA-256 verification. Last extension release remains 2.2.7.

Coverage audit at 2026-11-26 04:10 Europe/Berlin used published snapshot 2026.11.26.3301 and intact checkpoint 45745903690. SQLite holds 86,537 active games. The snapshot exposes 85,583 records (98.91% of working rows), 60,364 with timing estimates and 60,301 Steam mappings. Across the working database, 41,638 (48.12%) have successful check dates November 20–26 and 65,296 (75.45%) October 28–November 26. Among 59,941 Steam-linked working rows, 55,733 (92.98%) were checked in the last 30 UTC calendar days. The oldest successful check date, July 22, applies to 16,257 records. 134 active rows are currently due, including 63 linked to Steam. The sequel run 45746337921 was collecting at audit time. Working-row retention is not a measure of coverage of the full current HLTB catalog. The historical prefilter source counted 176,106 rows and excluded 90,922 from its public snapshot.

July cohort audit: all 16,257 active rows with last_success_at on or before July 31 inherited the July 22 date from the restored snapshot. Of these, 16,251 have no later attempt (16,185 not yet due, 66 already due), and six later attempts returned 404 with retries due December 2–7. Only two of the 16,257 have a Steam mapping in the working database. Separately, 12,976 rows have a July or older last_changed_at and a newer last_success_at, confirming that fresh checks and unchanged data are tracked separately.

Added a one-off refresh_through workflow input. It changes only eligibility dates for matching active rows without deferred retries. The usual sequential collector performs real checks and the existing continuation handles the resulting backlog. The regression test verifies date boundaries, tombstones, retry preservation, idempotence, and unchanged last_success_at. No extension version or release changes.
