# Privacy Policy

Last updated: August 10, 2026

HLTB for Steam — Unofficial has no accounts, analytics, advertising, telemetry, or dynamic developer-operated backend. The developer does not receive, collect, sell, or analyze user data. A public GitHub Pages endpoint distributes signed static snapshot files.

## Data processed

When a supported Steam game page is opened, the extension processes website content: the public Steam App ID, game title, and artwork URL. In Chrome and Firefox, the game title is sent over HTTPS directly to HowLongToBeat to request current completion-time information. This necessarily tells HowLongToBeat which title is being looked up; HowLongToBeat processes that request under its own privacy practices. Inside Steam's embedded browser, the title is not sent to HowLongToBeat.

At most once every 24 hours while the extension is in use, it requests the same fixed `stable.json` and `stable.sig` URLs from `devln737.github.io/hltb-for-steam-data`. If a newer signed data version exists, it downloads the corresponding fixed manifest and snapshot pack. These update requests do not contain the Steam page URL, Steam App ID, game title, browsing history, or a persistent user identifier. Snapshot files are data only and are accepted only after their embedded signature, fixed schema, and SHA-256 checks pass.

Successful network completion-time responses, the requested title, the Steam App ID, and extension preferences are stored locally through `chrome.storage.local`. Cache retention is configurable to 1, 7, or 30 days; an expired entry may be retained locally as a stale fallback until it is replaced or the user clears the cache. Signed snapshots are stored separately in IndexedDB; the active and previous remote versions are retained so a failed update cannot replace working data. Steam artwork is displayed from its existing HTTPS URL and is not stored by the extension. Users can clear cached game data from the extension popup. This local data is never sent to the extension developer.

The extension uses this data only to display completion times and operate its user-facing settings and cache. It does not use or transfer data for advertising, profiling, credit decisions, or sale. Its use of information complies with the Chrome Web Store User Data Policy, including the Limited Use requirements.

## Permissions

- `storage`: stores preferences and cached completion times locally.
- Content scripts on Steam store/community game pages: read the public game identifier/title and display the card. These scripts run only on declared Steam game-page URL patterns; the extension does not request separate Steam host access.
- Access to `howlongtobeat.com`: requests completion-time data.
- Access to `devln737.github.io/hltb-for-steam-data`: downloads fixed, signed snapshot data without transmitting the opened game.
- `declarativeNetRequestWithHostAccess`: applies required request headers only to the HLTB initialization and search endpoints.

Questions can be opened through the [public support page](https://devln737.github.io/hltb-for-steam-unofficial/support.html). Security reports should follow the private process described in the repository's [Security Policy](https://github.com/DevLn737/hltb-for-steam-unofficial/security/policy).
