# Firefox AMO preparation

The repository can build a Firefox extension and a clean matching source archive. The local `.xpi` is **unsigned**; only Mozilla can produce the permanently installable signed XPI.

## Current baseline

- Manifest V3 Firefox build.
- Stable Gecko ID: `hltb-for-steam-unofficial@devln737.github.io`.
- Firefox Desktop 140 minimum version; Android compatibility is not declared or selected for this desktop-only release.
- `websiteContent` data-transmission declaration.
- Privacy policy describing the title sent to HowLongToBeat.
- Reproducible reviewer instructions in the [README Development section](../README.md#development).
- WXT source ZIP excludes local diagnostics, raw scrape data, credentials, and generated packages.
- Dedicated 64-pixel Retina icon.

## Artifact meanings

- `*-firefox.zip`: unsigned extension archive to upload to AMO.
- `*-sources.zip`: matching source archive for Mozilla review.
- `*-firefox-unsigned.xpi`: development convenience copy for temporary loading; it is not Mozilla-signed.

## Before AMO submission

- [ ] Create or verify the Mozilla/AMO developer account and accept the current agreements.
- [x] Run Mozilla `web-ext lint` with zero errors. Review its Android data-collection-version warning; Android is intentionally not a supported submission platform.
- [ ] Test the exact build on current Firefox Release and the oldest declared compatible version; add ESR coverage if ESR support is claimed.
- [x] Confirm Firefox Desktop 140 as the intentional minimum version.
- [ ] Complete a legal/redistribution review for the packaged HLTB-derived snapshot.
- [x] Add final icon, listing artwork, and three 1280x800 screenshots.
- [x] Prepare name, summary, description, category, support URL, MIT license, privacy-policy URL, and reviewer notes. A support email must be supplied by the AMO account owner.
- [ ] Upload both `*-firefox.zip` and the matching `*-sources.zip` for a listed AMO release, or choose unlisted signing for self-distribution.
- [ ] Download Mozilla's signed XPI and verify a permanent clean-profile installation.

Mozilla signs both listed and self-distributed extensions. A GitHub release or renamed ZIP cannot replace that signature. See Mozilla's [signing and distribution overview](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/), [submission guide](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/), and [source-code requirements](https://extensionworkshop.com/documentation/publish/source-code-submission/).

## Listing metadata

- Channel: listed on addons.mozilla.org
- Platform: Firefox Desktop only
- Name: `HLTB for Steam`
- Summary: `Shows HowLongToBeat completion times directly on Steam game pages.`
- Category: Games & Entertainment
- Experimental: no
- Requires payment, non-free services, software, or additional hardware: no
- License: MIT
- Homepage: `https://github.com/DevLn737/hltb-for-steam-unofficial`
- Support: `https://devln737.github.io/hltb-for-steam-unofficial/support.html`
- Privacy policy: `https://devln737.github.io/hltb-for-steam-unofficial/privacy.html`

Use the localized descriptions from the Chrome Web Store listing. Upload the screenshots from `docs/store-assets/chrome/screenshots` in filename order.

## Data collection

The Firefox manifest declares required `websiteContent` collection. In regular Firefox, the public Steam game title is sent over HTTPS to HowLongToBeat to request current completion-time data. The extension does not transmit the Steam page URL, browsing history, analytics, telemetry, advertising identifiers, or personally identifying information.

## Notes for reviewers

The extension requires no account or credentials.

To test:

1. Install the extension in Firefox Desktop 140 or later.
2. Open `https://store.steampowered.com/app/413150/Stardew_Valley/`.
3. A HowLongToBeat card should appear below the main Steam game section.
4. Open the toolbar popup to test category visibility, time format, cache duration, and cache clearing.

In regular Firefox, the public game title is sent over HTTPS to HowLongToBeat to obtain current completion-time data. If the request fails, a verified signed snapshot and then the packaged local snapshot are used. At most once every 24 hours the extension checks fixed snapshot URLs that contain no page URL, App ID, title, browsing history, or persistent identifier. No analytics, advertising, telemetry, remote executable code, or dynamic developer-operated backend is used.

The declarative network request rules only set the required `Origin` and `Referer` headers for the HowLongToBeat initialization and search endpoints.

Generated JavaScript is bundled from TypeScript by WXT. The matching source archive contains complete build instructions in `README.md`. Reproduce the Firefox build with:

```sh
npm ci
npm run build:firefox
npm run verify:firefox
```

## Files to upload

- Extension: `.output/hltb-for-steam-unofficial-2.2.5-firefox.zip`
- Reviewer sources: `.output/hltb-for-steam-unofficial-2.2.5-sources.zip`

The `firefox-unsigned.xpi` artifact is for temporary local testing only. Mozilla produces the installable signed XPI after submission.
