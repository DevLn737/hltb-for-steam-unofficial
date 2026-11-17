# Snapshot automation implementation plan

**Goal:** Run collection unattended on GitHub and keep the extension's committed fallback current.

**Architecture / spec:** Restore the supplied Python updater into a private GitHub repository. GitHub Actions owns daily bounded collection, durable SQLite state stored in a private release, and publication into a new `v2/` channel in the existing data repository. Use a newly generated P-256 key because the previous private key is lost. Preserve the legacy channel. The extension uses the new public key/channel and a scheduled workflow that verifies, imports, tests, and commits current packaged data. Existing protection against stale release data remains enabled.

**Tech stack:** Python 3.12, SQLite, existing schema-v7 codec, GitHub Actions, Node.js 22, WXT.

**Execution:** Inline; user delegated platform and implementation choices and authorized deployment. Edit in place, retain existing work, create no duplicate worktrees, and never expose private keys. Record product changes in CHANGELOG.md. Deployment, secrets, workflow dispatch, and necessary commits/pushes are within the requested scope.

## Tasks

- [ ] Confirm HLTB canaries work from a GitHub-hosted runner before committing to this host.
- [ ] Add failing recovery tests for checked-date preservation, Steam mappings, invalid signatures, nonempty databases, and empty Steam-linked records. Implement `restore_snapshot(database, candidate, public_key)` using verified schema-v7 data without inventing fresh checks.
- [ ] Verify the existing Python suite plus recovery tests. Neutralize source metadata and replace Forgejo-specific operations with a GitHub workflow.
- [ ] Generate/store the signing key as an Actions secret, and install a repository-scoped data deploy key. Keep the matching public key in source. Persist state before publication and after collection failures; never use an expiring cache as the only state copy.
- [ ] Deploy daily collection with serialized runs, bounded requests, existing canary/rate-limit/publication gates, private state recovery, versioned publication, and fixed new-channel URLs. Verify a real run, live source date, checksums, and signature.
- [ ] Switch the extension to the new key/channel. Add scheduled/manual snapshot import and validation followed by a commit only when data changed. Update documentation and CHANGELOG.md.
- [ ] Run extension checks, Firefox build verification, and a live import. Publish changes, dispatch the sync workflow, and inspect completion and committed data in both repositories.

## Review focus

- Failed collection must retain progress but must not publish stale data.
- A restored game's last-successful-check date must remain its original date.
- A missing state release is bootstrapped from verified data; a corrupt existing state must fail closed.
- Legacy clients must retain access to the old signed channel.
- Workflow commits using GITHUB_TOKEN must be validated in the workflow itself because they do not trigger push CI.

## Progress

- Restored source archive and complete Git history; private repository created. Hosted access probe prepared.
