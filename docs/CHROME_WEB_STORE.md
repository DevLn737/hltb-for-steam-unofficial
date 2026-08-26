# Chrome Web Store preparation

This is a submission draft and checklist, not evidence that the extension is already published.

## Listing copy

**Name:** HLTB for Steam

**Short description:** See HowLongToBeat completion times directly on Steam game pages.

**Single purpose:** Display HowLongToBeat completion-time data on Steam game pages.

**Detailed description:**

HLTB for Steam adds a compact completion-time card to supported Steam game pages. It shows Main Story, Main + Extras, and Completionist estimates, with configurable categories and time formats.

Chrome requests current completion-time data from HowLongToBeat and keeps a local cache. If the service is unavailable, the extension can use an independently versioned, signed static snapshot. Inside Steam's embedded browser, lookup uses the verified current snapshot and packaged fallback because HLTB rejects that browser's requests. Matching is deliberately strict: the extension does not substitute an uncertain game's estimates.

English and Russian are selected automatically. The extension has no analytics, ads, accounts, remote executable code, or developer-operated backend. This independent project is not affiliated with Valve, Steam, or HowLongToBeat.

## Permission justifications

- `storage`: saves display settings and completion-time cache locally.
- Steam Store and Steam Community content-script matches: run only on declared `/app/*` game pages to read the public App ID, title, and existing artwork and insert the widget. No separate Steam host permission is requested.
- `howlongtobeat.com`: requests current completion-time data in Chrome/Chromium.
- `devln737.github.io/hltb-for-steam-data`: downloads fixed signed snapshot files; no opened-game identifier or title is sent to this host.
- `declarativeNetRequestWithHostAccess`: applies the narrowly scoped request headers required by the HLTB search endpoint.

The dashboard privacy answers must disclose **website content** processing, transmission of the game title to HowLongToBeat, and the fixed static snapshot host. They must remain consistent with [PRIVACY.md](../PRIVACY.md). Remote code: **No**; the external resource is a signed, fixed-schema data file and cannot change extension logic.

## Before submission

- [x] Manifest V3 production ZIP with `manifest.json` at archive root.
- [x] Name, version, short description, icons, and narrow single purpose.
- [x] Public privacy-policy text and Limited Use statement.
- [x] No remote executable code, telemetry, advertising, or developer server.
- [x] Automated checks and manual Chrome/Steam smoke testing.
- [x] Review every host permission and DNR header rewrite. Steam host permissions were removed; HLTB access is the only host permission, and DNR filters are pinned to HTTPS API endpoints.
- [x] Record the publication decision for the packaged HLTB-derived snapshot: publish while knowingly accepting the risk of a complaint, rejection, or removal. This is a project-owner risk decision, not legal clearance.
- [ ] Add original final store assets listed in [STORE_ASSETS.md](STORE_ASSETS.md).
- [x] Register/verify the Chrome Web Store developer account and enable 2-Step Verification.
- [x] Add public privacy and support pages under `docs/`, ready for GitHub Pages at the URLs below. Repository Pages still has to be enabled and the live URLs checked.
- [ ] Fill the Listing, Privacy practices, Distribution, and support fields in the dashboard.
- [ ] Upload the exact `*-chrome.zip`, first as a controlled/private test if desired.
- [ ] Perform a final installed-from-store smoke test before public visibility.

Official references: [prepare an extension](https://developer.chrome.com/docs/webstore/prepare), [listing information](https://developer.chrome.com/docs/webstore/cws-dashboard-listing), and [privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy).

Planned public URLs:

- Privacy policy: `https://devln737.github.io/hltb-for-steam-unofficial/privacy.html`
- Support: `https://devln737.github.io/hltb-for-steam-unofficial/support.html`
