# Store assets

Final branded artwork is stored here for publication. Store-only assets do not belong under `public/` and are not included in extension packages.

## Chrome Web Store

- `icon-128.png`: 128×128 PNG extension icon with transparent padding.
- `screenshots/01-how-long-will-this-game-take.png`: primary 1280×800 Steam screenshot explaining the core value.
- `screenshots/02-see-when-estimates-change.png`: Palworld screenshot showing the three categories and estimate-change badges.
- `screenshots/03-plan-your-backlog.png`: long-game example for backlog planning.
- `screenshots/04-show-only-what-matters.png`: settings and customization.
- `screenshots/05-no-account-no-ads-no-tracking.png`: privacy and trust summary.
- `promo-small-440x280.png`: selected 440×280 promotional tile.
- `promo-marquee.png`: 1400×560 PNG or JPEG, optional.

The five numbered screenshots above are the canonical Chrome Web Store gallery. They are rendered from real Steam/extension captures with a shared presentation layer; no completion-time values or product states are fabricated. Regenerate them with `npm run screenshot:store`.

The files directly under `screenshots/` are the global English gallery. Matching Russian-localized versions are stored under `screenshots/ru/` for the Russian Chrome Web Store listing.

## Firefox AMO

Place final files under `docs/store-assets/firefox/` when ready:

- Original icon source plus optimized 32×32 and 64×64 listing variants where needed.
- Focused screenshots showing actual functionality and no misleading mock states.
- Localized captions for English and Russian.

The Chrome icon, five screenshots, and small promotional tile are ready. The optional marquee tile remains to be supplied.
