# HLTB for Steam — Unofficial

An independent, privacy-conscious Chrome and Firefox extension that shows HowLongToBeat completion times directly on Steam game pages — including pages opened inside the Steam desktop client.

![HLTB completion-time card on a Steam game page](docs/screenshots/widget.png)

## What it does

- Shows Main Story, Main + Extras, and Completionist estimates.
- Uses a compact horizontal card, Steam artwork, and an isolated Shadow DOM.
- Supports Steam page changes without a full reload.
- Matches exact titles only; an uncertain match is reported as not found.
- Provides English and Russian UI, configurable categories, time format, and cache lifetime.
- Contains no analytics, advertising, accounts, remote executable code, or developer backend.

## Data sources

| Environment | Preferred source | Fallback |
| --- | --- | --- |
| Chrome / Chromium | Current HowLongToBeat response | Local cache, then packaged snapshot |
| Firefox | Current HowLongToBeat response | Local cache, then packaged snapshot |
| Steam desktop client | Local cache | Packaged snapshot |

Steam's embedded Chromium receives HTTP 403 responses from HLTB, so it never makes an HLTB API request. Its packaged snapshot is dated July 22, 2026. Network browsers send only the Steam game title to HowLongToBeat over HTTPS when current data is requested. See [Privacy Policy](PRIVACY.md).

## Install a development build

These are sideload packages, not store-signed installations.

### Chrome and Chromium

1. Extract `hltb-for-steam-unofficial-2.1.0-chrome.zip`.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Choose **Load unpacked** and select the extracted directory.

### Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Choose **Load Temporary Add-on**.
3. Select the manifest from the extracted Firefox ZIP, or select the explicitly named `firefox-unsigned.xpi` development artifact.

The unsigned XPI is temporary-development material. Permanent installation in standard Firefox requires Mozilla signing through AMO. The extension already has a stable Gecko ID and a data-transmission declaration; see [Firefox publishing checklist](docs/FIREFOX_AMO.md).

## Develop and verify

Requirements: Node.js 22 or newer and npm.

```sh
npm ci
npm run dev
```

Run the complete automated checks:

```sh
npm run check
npx playwright install chromium
npm run test:browser
npm run build:firefox
npm run verify:firefox
npm run zip:all
```

An optional live smoke test opens a real Steam page in an isolated Chromium profile and writes local screenshots under the ignored `live-smoke/` directory:

```sh
npm run test:live -- 2258500 CRYMACHINA
```

### Package outputs

`npm run zip:all` writes these files to the ignored `.output/` directory:

- `*-chrome.zip` — Chrome/Chromium sideload and Chrome Web Store upload archive;
- `*-firefox.zip` — unsigned Firefox archive intended for AMO submission;
- `*-firefox-unsigned.xpi` — identical unsigned development package, clearly labeled;
- `*-sources.zip` — clean, matching Mozilla reviewer sources.

The source archive excludes local diagnostics, smoke screenshots, collision reports, raw scrape files, credentials, and generated artifacts. Mozilla signing is intentionally not automated yet.

## Architecture

The content script extracts the Steam App ID, visible title, and an existing Steam artwork URL, then renders the widget inside Shadow DOM. A Manifest V3 service worker owns the HLTB adapter, strict matching, request concurrency, versioned `storage.local` cache, and snapshot lookup.

The schema-v2 snapshot contains 58,820 HLTB games with at least one non-zero completion time and 34,245 unambiguous Steam App ID mappings. Title data is split into 64 gzip JSON buckets; App IDs use 64 gzip-compressed binary ULEB128 indexes. A lookup decompresses only the relevant buckets and retains them only for the service worker lifetime. Images, descriptions, reviews, and the 755,986,614-byte raw scrape are not packaged.

Snapshot updates are manual and reviewable:

```sh
npm run snapshot:import -- path/to/hltb_data.json
npm run verify:snapshot
```

CI validates committed data and never scrapes HLTB. More detail is in the [reviewer build instructions](SOURCE_BUILD.md).

## Publication status

Version 2.1.0 is functionally validated in the Steam client, Chrome, and Firefox. The repository and artifacts are prepared for public source hosting, but browser-store submission remains a separate manual stage.

- Chrome: package, manifest, privacy text, and listing draft are prepared; final branded assets, account setup, final permission/legal review, and dashboard submission remain. See [Chrome Web Store checklist](docs/CHROME_WEB_STORE.md).
- Firefox: package, stable ID, source archive, and reviewer build instructions are prepared; AMO validation, listing metadata, final compatibility testing, and Mozilla signing remain. See [Firefox AMO checklist](docs/FIREFOX_AMO.md).
- Known non-blocking issues, including rare missing Steam artwork, are tracked in [Known issues](docs/KNOWN_ISSUES.md).

Store artwork is intentionally not fabricated in this release. The required sizes and planned files are documented in [Store assets](docs/STORE_ASSETS.md) so original branding can be added during the 2.1.x cycle.

## Privacy and independence

This project is not affiliated with, endorsed by, or sponsored by Valve Corporation, Steam, or HowLongToBeat. Product names and trademarks belong to their respective owners.

Inspired by the original [k4sr4/hltbsteam](https://github.com/k4sr4/hltbsteam) project and rebuilt from a clean TypeScript/WXT codebase for current Manifest V3 browsers.

## Русский

Расширение показывает время прохождения HowLongToBeat на страницах игр Steam. В Chrome и Firefox оно запрашивает свежие данные и использует локальный fallback, а внутри клиента Steam работает автономно по компактному снимку. Совпадения строго точные: при сомнении чужое время не показывается.

## License

[MIT](LICENSE)
