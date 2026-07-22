# Chrome Web Store preparation

This is a submission draft and checklist, not evidence that the extension is already published.

## Listing copy

**Name:** HLTB for Steam — Unofficial

**Short description:** See HowLongToBeat completion times directly on Steam game pages.

**Single purpose:** Display HowLongToBeat completion-time data on Steam game pages.

**Detailed description:**

HLTB for Steam — Unofficial adds a compact completion-time card to supported Steam game pages. It shows Main Story, Main + Extras, and Completionist estimates, with configurable categories and time formats.

Chrome requests current completion-time data from HowLongToBeat and keeps a local cache. If the service is unavailable, the extension can use a compact dated snapshot. Inside Steam's embedded browser, lookup is fully local because HLTB rejects that browser's requests. Matching is deliberately strict: the extension does not substitute an uncertain game's estimates.

English and Russian are selected automatically. The extension has no analytics, ads, accounts, remote executable code, or developer-operated backend. This independent project is not affiliated with Valve, Steam, or HowLongToBeat.

## Permission justifications

- `storage`: saves display settings and completion-time cache locally.
- `store.steampowered.com` and `steamcommunity.com`: reads the public App ID, title, and existing artwork on supported game pages and inserts the widget.
- `howlongtobeat.com`: requests current completion-time data in Chrome/Chromium.
- `declarativeNetRequestWithHostAccess`: applies the narrowly scoped request headers required by the HLTB search endpoint.

The dashboard privacy answers must disclose **website content** processing and the transmission of the game title to HowLongToBeat. They must remain consistent with [PRIVACY.md](../PRIVACY.md). Remote code: **No**.

## Before submission

- [x] Manifest V3 production ZIP with `manifest.json` at archive root.
- [x] Name, version, short description, icons, and narrow single purpose.
- [x] Public privacy-policy text and Limited Use statement.
- [x] No remote executable code, telemetry, advertising, or developer server.
- [x] Automated checks and manual Chrome/Steam smoke testing.
- [ ] Review whether every host permission and DNR header rewrite is still the minimum necessary.
- [ ] Complete a legal/redistribution review for the packaged HLTB-derived snapshot.
- [ ] Add original final store assets listed in [STORE_ASSETS.md](STORE_ASSETS.md).
- [ ] Register/verify the Chrome Web Store developer account and enable 2-Step Verification.
- [ ] Host the privacy-policy URL from the public repository.
- [ ] Fill the Listing, Privacy practices, Distribution, and support fields in the dashboard.
- [ ] Upload the exact `*-chrome.zip`, first as a controlled/private test if desired.
- [ ] Perform a final installed-from-store smoke test before public visibility.

Official references: [prepare an extension](https://developer.chrome.com/docs/webstore/prepare), [listing information](https://developer.chrome.com/docs/webstore/cws-dashboard-listing), and [privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy).
