# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased] — 2.2.0 development

### Added

- Add independently versioned, ECDSA P-256 signed schema-v4 snapshot updates from a static GitHub Pages data channel.
- Add atomic IndexedDB installation with active/previous remote versions and packaged-snapshot fallback.
- Add strict pointer, manifest, pack, bucket, SHA-256, and signature validation with no remote executable logic.
- Add a separate private Forgejo/SQLite updater foundation for incremental ID discovery, adaptive refresh, retained backups, guarded monthly publication, and data-only pack generation.

### Changed

- Steam prefers the newest verified remote snapshot and remains fully functional offline through stored and packaged snapshots.
- Chrome and Firefox retain live HLTB lookup while adding the verified current snapshot before the packaged fallback.
- Snapshot update checks use fixed URLs at most once every 24 hours and never send a Steam App ID or title to the data host.

## [2.1.4] - 2026-08-02

### Added

- Add the selected 128×128 extension icon and 440×280 Chrome Web Store promotional tile.
- Add complete English and Russian README files with a language switcher.
- Add standard Chrome extension i18n catalogs for localized store listings, manifest metadata, and toolbar titles in 14 languages.
- Add complete widget and settings translations for German, French, Spanish, Brazilian Portuguese, Italian, Polish, Ukrainian, Turkish, Japanese, Korean, Simplified Chinese, and Traditional Chinese.

### Changed

- Replace the extension icons at every packaged size with the selected visual identity.
- Refresh the README widget screenshot and make its capture wait for rendered completion times.

### Fixed

- Rename the packaged snapshot metadata from `manifest.json` to `snapshot.json`, leaving exactly one extension manifest in Chrome Web Store upload archives.
- Reject nested `manifest.json` files during package verification to prevent the upload error from recurring.
- Raise the declared minimum Chrome version to 88, as required for Chrome Web Store Manifest V3 publication.

## [2.1.2] - 2026-08-02

### Added

- Retain all 171,888 valid HLTB cards in snapshot schema v3, including games with no submitted completion times, with 58,288 unambiguous Steam App ID mappings.
- Add tested Steam Client detection for representative Steam, Chrome, Firefox, and Edge user agents.

### Changed

- Make Steam strictly snapshot-only; normal browsers continue to use fresh cache, HLTB network data, and safe stale-cache/snapshot fallback.
- Hide fetch timestamps for live network results, while keeping meaningful snapshot and cache dates.
- Fall back from unavailable vertical Steam artwork to allowlisted horizontal header/OpenGraph artwork without distortion.
- Migrate cached game records to schema v5 with a typed `timed` or `known_without_times` availability state.

### Fixed

- Preserve direct HLTB links and neutral gray time blocks for known games without completion-time submissions, including AV Director Life!.
- Remove the text-only artwork fallback on Steam pages where a safe horizontal image is already available.

## [2.1.1] - 2026-07-28

### Fixed

- Render unknown games and known HLTB games without completion-time submissions in the same horizontal card, using neutral gray `—` values instead of an inaccurate title-match error.
- Render only missing categories in gray when HLTB provides a partial set of completion times.

## [2.1.0] - 2026-07-22

### Added

- Add the schema-v2 autonomous snapshot generated from the completed July 22, 2026 scrape: 58,820 timed HLTB games and 34,245 unambiguous Steam App ID mappings.
- Add a streaming, atomic snapshot importer with source invariants, SHA-256 verification, deterministic gzip buckets, collision reporting outside the extension, and round-trip tests.
- Add direct HLTB game links, exact Steam App ID precedence, and exact unique-title fallback.
- Add Steam artwork extraction without storing or bundling cover images.
- Add clean Mozilla reviewer source packaging, reproducible build instructions, and an archive-content verifier.
- Add separate Chrome Web Store, Firefox AMO, and future store-asset checklists.

### Changed

- Steam now performs snapshot-only lookups and makes no HLTB request; Chrome and Firefox still prefer current network data and fall back safely.
- Store title rows in 64 gzip JSON buckets and App ID locations in 64 gzip binary ULEB128 indexes. The 720.97 MiB source becomes 1,361,020 bytes of snapshot data and a roughly 1.46 MB installed build.
- Use one shared Unicode normalization implementation for import and runtime, preserving Cyrillic and removing only trademark symbols.
- Redesign the result as a compact horizontal card with Steam artwork, a blurred backdrop, a 28 px Steam-style section gap, and only the snapshot update date in metadata.
- Migrate the local cache to schema v4 and use the fresh scrape values as the snapshot source of truth.
- Label Firefox development XPI files explicitly as unsigned and publish the AMO submission ZIP separately.
- Expand the README and privacy policy with exact browser-specific data flow and publication status.

### Fixed

- Reject ambiguous titles and Steam App IDs instead of returning a guessed game.
- Preserve sub-minute non-zero source values as one minute instead of collapsing them to missing data.
- Replace the snapshot only after every generated file and cross-reference passes validation.
- Exclude local Steam diagnostics, smoke screenshots, raw scrape data, credentials, and generated packages from reviewer sources.

### Removed

- Remove schema-v1 JSON buckets, packaged collision reports, and manual time overrides.

## [2.0.5] - 2026-07-18

### Fixed

- Normalize the User-Agent only for HLTB API requests so its anti-bot layer does not reject Steam's embedded Chromium with HTTP 403.
- Keep the same browser identity across HLTB initialization and search requests.
- Restore a Steam-sized gap between the HLTB card and the first purchase section.

### Changed

- Reduce the result card dimensions and typography by roughly 12–15% while retaining the HLTB-inspired layout.
- Add a live smoke-test mode that launches Chromium with a Steam-like User-Agent and fails if a real HLTB result is not rendered.

## [2.0.4] - 2026-07-18

### Fixed

- Bind the native service-worker `fetch` to the browser global so real HLTB requests are actually sent instead of failing locally.
- Match the current HLTB request payload and separate initialization/search header rules.
- Round estimates to the half-hour presentation used by HLTB.

### Added

- Add an opt-in live Chromium smoke test against a real Steam page and HLTB response.
- Show the safe failing HLTB stage and HTTP status when a network request is rejected.
- Add a native Firefox Manifest V3 build and unsigned XPI development artifact.

## [2.0.3] - 2026-07-18

### Fixed

- Restored live lookups with HLTB's current `init → bleed` request flow.
- Fixed asynchronous responses on Chrome versions that do not support Promise-returning message listeners.

### Changed

- Added HLTB cover art and an HLTB-inspired result card with colored time bars and a blurred cover backdrop.
- Bumped the game cache schema so incomplete older records cannot suppress a refreshed lookup.

## [2.0.2] - 2026-07-18

### Fixed

- Validate runtime message responses before reading discriminant fields.
- Treat an undefined settings response as defaults and an undefined lookup response as a controlled service error.
- Prevent uncaught popup message errors when the extension context is unavailable.

## [2.0.1] - 2026-07-18

### Fixed

- Loading now always resolves to a result or an error, even when the extension message channel never settles.
- Restored the legacy Steam placement immediately before the purchase area instead of the top of the right column.
- Repositions an already mounted card when Steam finishes rendering a preferred anchor later.

## [2.0.0] - 2026-07-18

### Added

- Clean WXT and TypeScript Manifest V3 implementation.
- Current HLTB initialization/search adapter with strict title matching.
- Versioned cache, stale-result fallback, and request concurrency control.
- Shadow DOM Steam card and compact settings popup in English and Russian.
- Unit, DOM, contract, package, and real Chromium smoke tests.

### Removed

- Bundled game-time database, fuzzy fallback estimates, HTML scraper, legacy services, and keep-alive alarms.
