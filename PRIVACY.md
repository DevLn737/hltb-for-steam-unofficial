# Privacy Policy

Last updated: July 18, 2026

HLTB for Steam — Unofficial does not collect, sell, transmit, or analyze personal information. It has no accounts, analytics, advertising, telemetry, or developer-operated server.

## Data processed

When a supported Steam game page is opened, the extension reads the public Steam App ID, game title, and artwork URL from that page. In Chrome and Firefox, the title is sent directly to HowLongToBeat to request current completion-time information. Inside Steam's embedded browser, lookup is performed against the packaged snapshot and the title is not sent to HowLongToBeat.

Successful network completion-time responses, the requested title, the Steam App ID, and extension preferences are stored locally through `chrome.storage.local`. Steam artwork is displayed from its existing URL and is not stored by the extension. Users can clear cached game data from the extension popup. This local data is not sent to the extension developer.

## Permissions

- `storage`: stores preferences and cached completion times locally.
- Access to Steam store/community game pages: reads the public game identifier/title and displays the card.
- Access to `howlongtobeat.com`: requests completion-time data.
- `declarativeNetRequestWithHostAccess`: applies required request headers only to the HLTB search endpoint.

Questions or security reports can be opened through the repository's documented support channels.
