# HLTB for Steam — Unofficial

**English** | [Русский](README.ru.md)

An independent, privacy-conscious Chrome and Firefox extension that displays HowLongToBeat completion times directly on Steam game pages, including pages opened in the Steam desktop client.

<p align="center">
  <img src="docs/store-assets/chrome/promo-small-440x280.png" alt="HLTB for Steam — Unofficial" width="440">
</p>

## Features

- Main Story, Main + Extras, and Completionist estimates.
- Compact Steam-style card using artwork already loaded by the Steam page.
- Automatic interface localization for 14 widely used browser languages, with English fallback.
- Configurable categories, time format, and cache lifetime.
- Strict title matching: the extension never substitutes an uncertain game's times.
- No analytics, ads, accounts, remote executable code, or developer-operated backend.

Supported interfaces and store listings: English, Russian, German, French, Spanish, Brazilian Portuguese, Italian, Polish, Ukrainian, Turkish, Japanese, Korean, Simplified Chinese, and Traditional Chinese.

## Interface

<p align="center">
  <img src="docs/screenshots/widget.png" alt="Completion-time card displayed on a Steam game page">
</p>

## Data sources

| Environment | Preferred source | Fallback |
| --- | --- | --- |
| Chrome / Chromium | Current HowLongToBeat response | Local cache, then packaged snapshot |
| Firefox | Current HowLongToBeat response | Local cache, then packaged snapshot |
| Steam desktop client | Packaged snapshot | None |

HLTB rejects requests from Steam's embedded Chromium, so Steam mode never contacts its API. The packaged snapshot is dated July 22, 2026. In regular browsers, only the current Steam game title is sent to HowLongToBeat over HTTPS. See the [Privacy Policy](https://devln737.github.io/hltb-for-steam-unofficial/privacy.html) and its [repository source](PRIVACY.md).

## Install a development build

The downloadable packages are sideload builds until the extension is published and signed by the stores.

### Chrome and Chromium

1. Extract `hltb-for-steam-unofficial-<version>-chrome.zip`.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Select **Load unpacked** and choose the extracted directory.

### Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Select **Load Temporary Add-on**.
3. Select `manifest.json` from the extracted Firefox ZIP, or the explicitly named unsigned development XPI.

Permanent installation in standard Firefox requires Mozilla signing through AMO. See the [Firefox publishing checklist](docs/FIREFOX_AMO.md).

## Development

Requirements: Node.js 22 or newer and npm.

```sh
npm ci
npm run dev
```

Run the automated checks and build both browser packages:

```sh
npm run check
npx playwright install chromium
npm run test:browser
npm run build:firefox
npm run verify:firefox
npm run zip:all
```

Package outputs are written to the ignored `.output/` directory:

- `*-chrome.zip` — Chrome/Chromium and Chrome Web Store package;
- `*-firefox.zip` — AMO submission package;
- `*-firefox-unsigned.xpi` — temporary development package;
- `*-sources.zip` — matching reviewer source archive.

## Architecture

The content script reads the Steam App ID, visible title, and an existing Steam artwork URL, then renders the card inside Shadow DOM. A Manifest V3 service worker handles the HLTB adapter, strict matching, request concurrency, versioned local cache, and snapshot lookup.

The compact schema-v3 snapshot contains 171,888 known HLTB games, including 58,820 with completion-time data and 58,288 unambiguous Steam App ID mappings. It is split into 64 gzip title buckets and 64 gzip binary App ID indexes. Images, descriptions, reviews, and the 755,986,614-byte source scrape are not packaged.

Snapshot updates are manual and reviewable:

```sh
npm run snapshot:import -- path/to/hltb_data.json
npm run verify:snapshot
```

CI validates committed data and never scrapes HLTB. Reviewer build details are available in [SOURCE_BUILD.md](SOURCE_BUILD.md).

## Publishing

- [Chrome Web Store checklist](docs/CHROME_WEB_STORE.md)
- [Firefox AMO checklist](docs/FIREFOX_AMO.md)
- [Store assets](docs/STORE_ASSETS.md)
- [Known issues](docs/KNOWN_ISSUES.md)

## Privacy and independence

This project is not affiliated with, endorsed by, or sponsored by Valve Corporation, Steam, or HowLongToBeat. Product names and trademarks belong to their respective owners.

Inspired by the original [k4sr4/hltbsteam](https://github.com/k4sr4/hltbsteam) project and rebuilt as a clean TypeScript/WXT Manifest V3 extension.

## License

[MIT](LICENSE)
