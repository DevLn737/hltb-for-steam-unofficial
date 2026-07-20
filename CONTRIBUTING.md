# Contributing

1. Create a focused branch from `main`.
2. Run `npm ci` and `npm run prepare:wxt`.
3. Make a small, typed change with tests.
4. Run `npm run check` and, for browser-facing changes, `npm run test:browser`.
5. Open a pull request explaining the user impact and validation.

Do not add automated HLTB scraping, telemetry, remote executable code, or permissive title matching. Snapshot updates must use a reviewed input file, `npm run snapshot:import`, and `npm run verify:snapshot`; never commit the raw legacy JSON or any cover images. App ID aliases remain naming corrections, while reviewed time corrections belong only in `data/snapshot-overrides.json`.
