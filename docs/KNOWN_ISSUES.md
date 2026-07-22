# Known issues

## Steam artwork fallback

Some Steam store pages do not provide the optional vertical `library_600x900` artwork used by the widget. The affected card intentionally falls back to its compact text-only layout; completion-time lookup and direct HLTB links continue to work.

Confirmed examples:

- Steam App 3639650 — Kotama and Academy Citadel
- Steam App 223710 — Cry of Fear
- Steam App 263500 — Dragons and Titans
- Steam App 289520 — King's Bounty: Dark Side
- Steam App 3170 — King's Bounty: Armored Princess

A post-2.1.0 improvement should reuse the page's existing horizontal header when the vertical asset returns an error, without adding image storage, external image services, or new permissions.
