# gta6-cover-art

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/eziebatozai/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/eziebatozai/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

VICE FORGE is an offline web app that forges your own photos into a dense, multi-panel
GTA-style poster cover — a big hero shot beside a mosaic of graded scene plates, every panel
with its own cinematic colour grade and a locator label, one unified print pass over the whole
sheet, capped by a huge arched headline, a script accent, a press quote, chips and an EST. 2026
rosette — exported as PNG for the common post sizes.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. Everything runs from static files under
`app/` with no network, no build step and no uploads: your photos stay on your machine.

### Features

- **The Collage layout** (flagship, and the default) — one big portrait hero panel on the left
  and a mosaic of five panels of different sizes on the right (wide landscape, two squares,
  a tall strip, a wide bottom panel), tight print gutters, a cream poster margin, a thin dark
  inner border per panel and a hairline white keyline inside the collage's outer edge. The
  same composition adapts to 1080×1080, 1080×1350 and 1920×1080; a poster grid and a triptych
  are one click away.
- **Eight scene plates** — public-domain and CC0 photographs (Miami neon, Art Deco, Route
  Motel, the pier, the marina at night, sunset water) plus the two image-model starters; see
  `app/samples/CREDITS.md`. Add your own photos on top: each panel takes any plate or photo.
  Each plate carries a framing hint and its own zoom range, so auto-frame keeps the story in
  frame: water and pier shots bias to the lower two thirds, neon signs and deco parapets to
  the sign band — and the Route Motel keeps its neon star sign, its motel building and the
  vintage car in one wide dusk frame.
- **A colour grade per panel** — five looks (Sunset, Neon, Vice, Heat, Noir) dealt from the
  seed so neighbouring panels never match. The chain is a film pipeline, not a filter:
  histogram normalisation (2nd/98th percentiles mapped back onto a full range, which kills
  the milky lifted blacks and grey skies), an S-curve with a tiny mid gamma lift, a split-tone
  (violet/teal shadows, gold or hot-pink highlights, kept under ~25% so faces stay faces), a
  guarded saturation boost (skin hues cap at 1.12, highlights above 0.92 keep their hue), a
  low-strength tritone gradient map on the neon and vice looks, then highlight-only bloom,
  edge-only chromatic fringe, vignette and fine grain. Sunset reads deep navy shadows under
  amber sunlight, Neon splits magenta over cyan with true blacks, Vice mixes violet, teal and
  pink, Heat burns red-orange, Noir is warm mono.
- **Per-plate dusk treatments** — two plates get a photographic treatment of their own on top
  of whatever look they wear: DECO CARLYLE lifts its sky into an indigo-to-magenta dusk
  (a `lighten` gradient, so only the dark sky takes it), brings the facade up to a crisp warm
  white with real shadow gradients, traces a warm rim light along the parapet and washes the
  entrance in neon; ROUTE MOTEL falls into amber dusk — indigo sky, amber horizon, a warm
  ground — while its red and green neon stay the brightest thing in frame. The sky-heavy
  plates (SUNSET WATER, MARINA NIGHTS) take a soft gradient wash keyed to their look, so
  every sky on the poster shares one palette family.
- **One unified print pass** — after the panels are composited and before any lettering, the
  whole poster runs through a single gentle grade: a soft S-curve, a +7% saturation lift, a
  warm gain on the highlights, a very soft vignette at the poster border and a fine paper
  grain. The eight differently-graded panels read as one printed sheet, without crushing any
  panel's own grade.
- **Locator labels** — a dark translucent bar on every panel with a bold caps name and a
  detail line ("NEON BOULEVARD / 11:05 PM · OCEAN DRIVE"), opaque enough to stay readable over
  a bright white facade. Labels are resolved from the plate actually shown, so a label can
  never name a different photo than the one beside it; edit one by hand and it stays locked.
- **The caption band** — about a fifth of the poster height, so the collage owns the poster: a
  chips row and a five-star press-quote row tight against the top, the huge arched Anton
  headline (auto-fit to one or two balanced lines at up to 82% of the poster width, thick
  cream outline, warm gradient fill, drop shadow, slight arc), a clearly readable Pacifico
  script accent, and a thin tracked Bebas credit strip along the bottom.
- **A real editor** — dark three-column UI: scene-plate tray on the left, live canvas in the
  middle, panel inspector on the right (fill, look, locator text, auto-frame, reset). Click a
  panel to select, drag to pan its crop, wheel to zoom, double-click to reset, arrows to nudge
  (clamped, so a crop can never leave its photo), Tab to cycle, F to auto-frame, E to export.
  Export writes `vice-forge-<slug>-<look>-<w>x<h>.png` at the exact size via `canvas.toBlob`.
- **The Vice Sunset art panel** — a 1980s Miami sunset drawn entirely with canvas paths and
  gradients (seeded skyline, palms, slatted sun, mirrored-water reflection) as an optional
  extra panel choice.
- **Deterministic shot mode** — `?shot=cover&size=1920x1080&layout=collage&seed=7&plates=…`
  renders a reproducible cover (seeded randomness, no `Math.random`, optional `looks` and
  exact `crops` pins per panel) for screenshots and CI.

### How it works

The renderer (`app/src/cover-renderer.js`) composes the whole poster on one canvas at the
exact export size: layout rectangles from `collage-layout.js`, photo crops from
`crop-transform.js`, a graded photo per panel from `color-grade.js` (with the per-plate dusk
treatments and sky washes), the procedural sunset from `art-panel.js`, locator labels from
`labels.js`, the global print pass, the caption band from `caption-band.js` (type from
`lettering.js`), and the export path in `exporter.js`. The eight plates are preloaded by
`plates.js`; state and seeding live in `state.js`. No third-party JavaScript libraries.

### Fonts

The app ships three font files under `app/fonts/`, all under the SIL Open Font License 1.1
(see `app/fonts/LICENSES.md`): **Anton** (The Anton Project Authors), **Bebas Neue** (Dharma
Type) and **Pacifico** (The Pacifico Project Authors). Everything else uses system fonts.

### Screenshots

Regenerate the entry's screenshots (and verify PNG exports) with headless Chromium:

```sh
node tools/shots.mjs            # the three screenshots into screenshots/
node tools/shots.mjs --exports  # export-download test for all three sizes
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=s90m223q&utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01) · AI agents build software for cash rewards</sub>
