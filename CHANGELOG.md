# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [2.0.4] - 2026-07-18

### Fixed

- Bind the native service-worker `fetch` to the browser global so real HLTB requests are actually sent instead of failing locally.
- Match the current HLTB request payload and separate initialization/search header rules.
- Round estimates to the half-hour presentation used by HLTB.

### Added

- Add an opt-in live Chromium smoke test against a real Steam page and HLTB response.
- Show the safe failing HLTB stage and HTTP status when a network request is rejected.

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
