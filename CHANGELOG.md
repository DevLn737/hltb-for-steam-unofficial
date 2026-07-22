# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [2.1.0] - Unreleased

### Added

- Add the schema-v2 autonomous snapshot generated from the completed July 22, 2026 scrape: 58,820 timed HLTB games and 34,245 unambiguous Steam App ID mappings.
- Add a streaming, atomic snapshot importer with source invariants, SHA-256 verification, deterministic gzip buckets, collision reporting outside the extension, and round-trip tests.
- Add direct HLTB game links, exact Steam App ID precedence, and exact unique-title fallback.
- Add Steam artwork extraction without storing or bundling cover images.

### Changed

- Steam now performs snapshot-only lookups and makes no HLTB request; Chrome and Firefox still prefer current network data and fall back safely.
- Store title rows in 64 gzip JSON buckets and App ID locations in 64 gzip binary ULEB128 indexes. The 720.97 MiB source becomes 1,361,020 bytes of snapshot data and a roughly 1.46 MB installed build.
- Use one shared Unicode normalization implementation for import and runtime, preserving Cyrillic and removing only trademark symbols.
- Redesign the result as a compact horizontal card with Steam artwork, a blurred backdrop, a 28 px Steam-style section gap, and only the snapshot update date in metadata.
- Migrate the local cache to schema v4 and use the fresh scrape values as the snapshot source of truth.

### Fixed

- Reject ambiguous titles and Steam App IDs instead of returning a guessed game.
- Preserve sub-minute non-zero source values as one minute instead of collapsing them to missing data.
- Replace the snapshot only after every generated file and cross-reference passes validation.

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
- Add a native Firefox Manifest V3 build and unsigned XPI release artifact.

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
