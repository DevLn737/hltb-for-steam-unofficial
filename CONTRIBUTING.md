# Contributing

1. Create a focused branch from `main`.
2. Run `npm ci` and `npm run prepare:wxt`.
3. Make a small, typed change with tests.
4. Run `npm run check` and, for browser-facing changes, `npm run test:browser`.
5. Open a pull request explaining the user impact and validation.

Do not add scraped completion-time databases, telemetry, remote executable code, or permissive title matching. App ID aliases may correct names but must never contain time estimates.

