# HLTB for Steam — Unofficial

An independent, privacy-friendly Chromium extension that adds HowLongToBeat completion times to Steam game pages.

![HLTB-inspired completion-time card with cover art and a blurred backdrop](docs/screenshots/widget.png)

## Features

- Main Story, Main + Extras, and Completionist estimates.
- HLTB-inspired card with cover art, colored time bars, and a blurred cover backdrop.
- Compatibility rule for Steam's embedded Chromium, scoped only to the HLTB API.
- Strict title matching: uncertain results are never shown as facts.
- Seven-day local cache with a saved-result fallback during temporary outages.
- English and Russian interface selected from the browser language.
- Configurable categories, time format, cache duration, and cache clearing.
- Manifest V3, no analytics, ads, remote code, backend, or bundled game database.

## Install

Download the Chrome ZIP from the latest [GitHub Release](../../releases/latest), extract it, open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the extracted folder.

Firefox releases also include an unsigned `.xpi` development build. Load it temporarily from `about:debugging#/runtime/this-firefox` using **Load Temporary Add-on**. Permanent installation in regular Firefox requires Mozilla AMO signing; the package already contains its stable Gecko ID and current data-transmission declaration.

For development:

```sh
npm ci
npm run dev
```

Production checks and packaging:

```sh
npm run check
npx playwright install chromium
npm run test:browser
npm run test:live -- 2258500 CRYMACHINA
npm run test:live -- 2258500 CRYMACHINA steam
npm run build:firefox
npm run verify:firefox
npm run zip:all
```

The unpacked extension is written to `.output/chrome-mv3`; the release ZIP is written to `.output/`.
The opt-in live smoke test loads the built extension in an isolated Chromium profile, opens the real Steam page, and saves its widget screenshot under `live-smoke/`. Pass `steam` as the final argument to reproduce the nonstandard user agent used by Steam's embedded browser.

## Architecture

The Steam content script extracts the App ID and visible title, then renders an isolated Shadow DOM card. A short-lived Manifest V3 service worker owns the HLTB adapter, strict matcher, request concurrency, and versioned `chrome.storage.local` cache. HLTB-specific request details are contained in `src/hltb`, so site changes do not leak into UI or storage code.

No offline game-time database is shipped. A tiny App ID alias map may correct naming differences, but never contains completion times.

## Privacy and independence

The extension sends the Steam game title to HowLongToBeat only when a game page needs data. It has no telemetry or user accounts. See [PRIVACY.md](PRIVACY.md) for details.

This project is not affiliated with, endorsed by, or sponsored by Valve Corporation, Steam, or HowLongToBeat. Product names and trademarks belong to their respective owners.

Inspired by the original [k4sr4/hltbsteam](https://github.com/k4sr4/hltbsteam) project and rebuilt from a clean codebase for current Manifest V3 browsers.

## Русский

Расширение добавляет на страницы игр Steam время прохождения HowLongToBeat. Интерфейс автоматически переключается на русский язык браузера. Расширение не содержит локальной базы игр, аналитики или рекламы; при сомнительном совпадении оно предлагает открыть поиск HLTB вместо показа чужого времени.

## License

[MIT](LICENSE)
