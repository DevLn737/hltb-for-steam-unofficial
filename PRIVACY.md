# Privacy Policy

Last updated: July 22, 2026

HLTB for Steam — Unofficial has no accounts, analytics, advertising, telemetry, or developer-operated server. The developer does not receive, collect, sell, or analyze user data.

## Data processed

When a supported Steam game page is opened, the extension processes website content: the public Steam App ID, game title, and artwork URL. In Chrome and Firefox, the game title is sent over HTTPS directly to HowLongToBeat to request current completion-time information. This necessarily tells HowLongToBeat which title is being looked up; HowLongToBeat processes that request under its own privacy practices. Inside Steam's embedded browser, lookup is performed against the packaged snapshot and the title is not sent to HowLongToBeat.

Successful network completion-time responses, the requested title, the Steam App ID, and extension preferences are stored locally through `chrome.storage.local`. Cache retention is configurable to 1, 7, or 30 days; an expired entry may be retained locally as a stale fallback until it is replaced or the user clears the cache. Steam artwork is displayed from its existing HTTPS URL and is not stored by the extension. Users can clear cached game data from the extension popup. This local data is never sent to the extension developer.

The extension uses this data only to display completion times and operate its user-facing settings and cache. It does not use or transfer data for advertising, profiling, credit decisions, or sale. Its use of information complies with the Chrome Web Store User Data Policy, including the Limited Use requirements.

## Permissions

- `storage`: stores preferences and cached completion times locally.
- Access to Steam store/community game pages: reads the public game identifier/title and displays the card.
- Access to `howlongtobeat.com`: requests completion-time data.
- `declarativeNetRequestWithHostAccess`: applies required request headers only to the HLTB search endpoint.

Questions or security reports can be opened through the repository's documented support channels.
