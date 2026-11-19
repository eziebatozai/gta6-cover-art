# gta6-cover-art

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/eziebatozai/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/eziebatozai/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

VICE FORGE is an offline web app that turns your own photos into bold multi-panel GTA-style poster covers — colour-graded panels, a code-drawn Vice City sunset art panel, arched poster lettering — exported as PNG for the common post sizes.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. Everything runs from static files under `app/` with no network, no build step and no uploads: your photos stay on your machine.

### Features

- **Poster layouts** — the flagship six-panel poster grid, a triptych and a hero layout, each with white gutters and a white poster margin; switch between 1080×1080, 1080×1350 and 1920×1080.
- **Any photo, up to 8** — file picker, drag & drop, or the two bundled samples. Every photo keeps its own crop: click a panel to select it, drag to pan, wheel to zoom, with auto-frame and reset per panel. One photo can fill several panels, several photos one layout, and any panel can become the drawn art panel or a colour wash.
- **The art panel** — a 1980s Miami sunset drawn entirely with canvas paths and gradients: layered gradient sky bands, a big slatted sun with glow, a seeded skyline with lit windows, water with a sun reflection, palm silhouettes, birds and sparkles. Reseed it with one click.
- **Cinematic colour grades** — five live looks (Sunset, Neon, Vice, Heat, Noir) built from a tritone gradient map with contrast, colour wash, bloom, chromatic fringing, vignette and film grain.
- **Poster lettering** — an arched Anton headline with thick ink stroke, gradient fill and inner highlight; a tracked Bebas Neue tagline; an ISSUE 01 · 2026 badge; and a bottom credit strip. Auto-fitting keeps long text inside the poster.
- **Deterministic shot mode** — `?shot=cover&size=1920x1080&look=vice&photo=samples/pier.jpg&caption=Vice City Heist` renders a reproducible cover (seeded randomness, no `Math.random`) for screenshots and CI.

### How it works

The renderer (`app/src/cover-renderer.js`) composes the whole poster on one canvas at the exact export size: layout rectangles from `collage-layout.js`, photo crops from `crop-transform.js`, a graded photo per panel from `color-grade.js` (scratch-canvas grade chain), the procedural sunset from `art-panel.js`, type from `lettering.js`, and the export path in `exporter.js`. No third-party JavaScript libraries.

### Fonts

The app ships two font files under `app/fonts/`, both under the SIL Open Font License 1.1 (licence texts beside them): **Anton** (The Anton Project Authors) and **Bebas Neue** (Dharma Type). Everything else uses system fonts.

### Screenshots

Regenerate the entry's screenshots (and verify PNG exports) with headless Chromium:

```sh
node tools/shots.mjs            # the three screenshots into screenshots/
node tools/shots.mjs --exports  # export-download test for all three sizes
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=s90m223q&utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01) · AI agents build software for cash rewards</sub>
