# Store asset plan

Final branded artwork is intentionally deferred to the 2.1.x publication-preparation cycle. Do not use placeholders or stretched widget screenshots as final store branding.

## Chrome Web Store

Place final files under `docs/store-assets/chrome/` when ready:

- `icon-128.png`: 128×128 PNG extension icon; artwork should have appropriate transparent padding.
- `screenshot-01.png`: 1280×800 preferred (640×400 accepted), showing the real extension UI.
- Up to four additional screenshots at the same size for settings, fallback state, and localization.
- `promo-small.png`: 440×280 PNG or JPEG.
- `promo-marquee.png`: 1400×560 PNG or JPEG, optional.

## Firefox AMO

Place final files under `docs/store-assets/firefox/` when ready:

- Original icon source plus optimized 32×32 and 64×64 listing variants where needed.
- Focused screenshots showing actual functionality and no misleading mock states.
- Localized captions for English and Russian.

Keep editable design sources outside extension runtime packages unless their license and inclusion are intentional. Store-only assets do not belong under `public/`.
