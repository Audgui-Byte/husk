# Fonts

Husk's three faces — Bricolage Grotesque (display), Instrument Sans (UI) and
JetBrains Mono (machine speech) — are all SIL Open Font License 1.1, vendored
here and served from this origin. The licences sit next to the files.

They are **not** loaded from the Google Fonts CDN or any other third-party
origin. A product whose pitch is that nothing leaves your machine should not
open a connection to `fonts.gstatic.com` on its own homepage.

The files are the OFL releases published on npm as `@fontsource-variable/*`,
byte-identical to the copies in `apps/docs/public/fonts`. Both sites declare the
same `@font-face` rules — `apps/web/src/app/globals.css` and
`apps/docs/app/globals.css` — split latin / latin-ext by `unicode-range` so a
reader downloads only the subset their text needs.

`tokens.css` names all three families first in their stacks and drives the
display face's `opsz`, `wdth` and `GRAD` axes through `--font-variation-*`. The
fallback stacks behind them are not dead code: they are what renders during
`font-display: swap`, and what renders if a woff2 ever fails. They were chosen
to be metric-adjacent enough that the swap causes no visible reflow at body
sizes, and every fallback in the mono stack keeps a slashed or dotted zero so
terminal output stays unambiguous.

## History

This directory held nothing but this README for the site's first months, so
`--font-display`, `--font-ui` and `--font-mono` all resolved to those fallbacks:
the product site rendered in system faces while the docs site — which had
vendored the same files all along — rendered in the brand's.
