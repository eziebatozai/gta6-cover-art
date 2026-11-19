// The cover renderer: assembles the whole poster on one canvas at the exact export size.
// Cream poster stock, a thin dark keyline around the panel region, the layout's panel collage
// (each panel its own colour grade over its photo or plate, plus a locator label resolved from
// the plate actually shown), the drawn art panel where chosen — then one global print pass
// over the whole poster (a gentle S-curve, a saturation lift, a warm highlight gain, a soft
// border vignette and paper grain) so the differently-graded panels read as one printed
// sheet — the caption band, the credit strip and a hairline white keyline inside the
// collage's outer edge. Also returns the panel rectangles in canvas coordinates so the editor
// can hit-test and select panels.

import { layoutPanels } from './collage-layout.js';
import { cropToDraw } from './crop-transform.js';
import { gradePhoto, lookDef } from './color-grade.js';
import { drawArtPanel } from './art-panel.js';
import { plateImage, plateByKey } from './plates.js';
import { drawLocatorLabel, resolveLabel } from './labels.js';
import { captionGeometry, drawCaptionBand, drawCreditStrip } from './caption-band.js';
import { letterPalette, POSTER_CREAM } from './lettering.js';
import { SIZES, photoForFill, clampCrop } from './state.js';
import { makeRng, between, chance } from './rng.js';

const PANEL_EDGE = '#160d20';

/**
 * Renders the cover for `state` onto `canvas`, resizing it to the chosen export size first.
 * `opts.showSelection` draws the editor's selection outline on the chosen panel. Returns the
 * panel rects in canvas coordinates.
 */
export function renderCover(canvas, state, opts = {}) {
  const { w: W, h: H } = SIZES[state.size] ?? SIZES['1080x1080'];
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  const ctx = canvas.getContext('2d');
  const minWH = Math.min(W, H);

  const rng = makeRng(state.seed ^ 0xa17);
  const pal = letterPalette(state.look ?? 'vice');

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = POSTER_CREAM;
  ctx.fillRect(0, 0, W, H);

  // Vertical rhythm: top margin, panels, caption band, full-bleed credit strip. The band keeps
  // ~20% of the poster so the collage owns it.
  const { bandH, creditH } = captionGeometry(W, H);
  const margin = Math.round(minWH * 0.024);
  // Print feel: tight gutters (a third slimmer than the first cut) between the panels.
  const gutter = Math.max(5, Math.min(9, Math.round(W * 0.0045)));
  const panelsX = margin;
  const panelsY = margin;
  const panelsW = W - margin * 2;
  const panelsH = H - margin - bandH - creditH;
  const regionAspect = panelsW / panelsH;

  const base = layoutPanels(state.layout, regionAspect);
  const rects = base.map((p) => ({
    x: panelsX + p.x * panelsW + gutter / 2,
    y: panelsY + p.y * panelsH + gutter / 2,
    w: p.w * panelsW - gutter,
    h: p.h * panelsH - gutter,
  }));

  // A thin keyline around the whole collage, like a print margin rule.
  ctx.strokeStyle = 'rgba(22,13,32,0.9)';
  ctx.lineWidth = Math.max(2, Math.round(minWH * 0.0035));
  ctx.strokeRect(panelsX - ctx.lineWidth / 2, panelsY - ctx.lineWidth / 2, panelsW + ctx.lineWidth, panelsH + ctx.lineWidth);

  state.panels = state.panels && state.panels.length === rects.length
    ? state.panels
    : state.panels.concat(new Array(Math.max(0, rects.length - state.panels.length)).fill(null));

  // Panels: dark bases, then content (graded photo / art / wash), then the dark inner border.
  ctx.fillStyle = PANEL_EDGE;
  for (const r of rects) ctx.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);

  rects.forEach((r, i) => {
    const panel = state.panels[i] ?? { fill: 'wash', look: 'vice', label: null, crop: { cx: 0.5, cy: 0.5, zoom: 1.1 } };
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();

    let drew = false;
    const img = imageForFill(state, panel.fill);
    if (panel.fill === 'art') {
      drawArtPanel(ctx, r.x, r.y, r.w, r.h, panel.look, state.seed + i * 97);
      drew = true;
    } else if (img) {
      const src = cropToDraw(img, clampCrop(panel.crop), r.w, r.h);
      const graded = gradePhoto(img, src, r.w, r.h, panel.look, state.seed + i * 131, {
        plate: plateByKey(panel.fill),
      });
      ctx.drawImage(graded, r.x, r.y, r.w, r.h);
      drew = true;
    }
    if (!drew) drawWashPanel(ctx, r, panel.look);

    // The label names the plate actually shown (resolved from the panel's fill, not from a
    // stale stored label), unless the person edited it by hand.
    drawLocatorLabel(ctx, r, resolveLabel(panel.fill, panel.label));
    ctx.restore();

    // Dark border inside the white gutter.
    const bw = Math.max(2, Math.round(minWH * 0.0032));
    ctx.strokeStyle = PANEL_EDGE;
    ctx.lineWidth = bw;
    ctx.strokeRect(r.x + bw / 2, r.y + bw / 2, r.w - bw, r.h - bw);
  });

  // Chrome: light-leak streaks and a whisper of grain over the panel region only.
  drawLightLeaks(ctx, panelsX, panelsY, panelsW, panelsH, pal, rng);
  drawChromeGrain(ctx, panelsX, panelsY, panelsW, panelsH);

  // The unified print pass: one gentle grade + paper feel over everything composited so far,
  // before any lettering — the eight panel grades then read as one printed poster.
  printPass(ctx, W, H);

  // Hairline white keyline just inside the collage's outer edge, like a trimmed print rule.
  const keyW = Math.max(1, Math.round(minWH * 0.0014));
  ctx.strokeStyle = 'rgba(252,248,238,0.85)';
  ctx.lineWidth = keyW;
  ctx.strokeRect(panelsX + gutter / 2 + keyW, panelsY + gutter / 2 + keyW, panelsW - gutter - keyW * 2, panelsH - gutter - keyW * 2);

  // Caption band + credit strip.
  const bandY = panelsY + panelsH;
  drawCaptionBand(ctx, 0, bandY, W, bandH, state, pal);
  drawCreditStrip(ctx, W, H, state.credit, pal);

  // Editor selection outline.
  if (opts.showSelection && state.selectedPanel >= 0 && state.selectedPanel < rects.length) {
    const s = rects[state.selectedPanel];
    ctx.save();
    ctx.strokeStyle = '#3ee6ff';
    ctx.lineWidth = Math.max(3, Math.round(minWH * 0.007));
    ctx.setLineDash([minWH * 0.028, minWH * 0.018]);
    ctx.strokeRect(s.x - ctx.lineWidth, s.y - ctx.lineWidth, s.w + ctx.lineWidth * 2, s.h + ctx.lineWidth * 2);
    ctx.restore();
  }

  ctx.restore();
  return { rects };
}

// --- the unified print pass ---------------------------------------------------------------

let printLut = null;
let paperTile = null;

/** The print pass tone LUT: a gentle S-curve around 0.5, cached across renders. */
function getPrintLut() {
  if (printLut) return printLut;
  const k = 4.4;
  const sig = (v) => 1 / (1 + Math.exp(-k * (v - 0.5)));
  const s0 = sig(0);
  const s1 = sig(1);
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) {
    const v = i / 255;
    const s = (sig(v) - s0) / (s1 - s0);
    lut[i] = (v + (s - v) * 0.15) * 255; // one gentle unified S, never crushing the panel grades
  }
  printLut = lut;
  return lut;
}

/** Fine paper grain tile (deterministic xorshift), tiled with a pattern fill. */
function getPaperTile() {
  if (paperTile) return paperTile;
  const N = 128;
  const c = document.createElement('canvas');
  c.width = N;
  c.height = N;
  const g = c.getContext('2d');
  const img = g.createImageData(N, N);
  let a = 0x2545f491;
  for (let i = 0; i < N * N; i++) {
    a ^= a << 13;
    a ^= a >>> 17;
    a ^= a << 5;
    const v = 118 + ((a >>> 24) % 21);
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  paperTile = c;
  return c;
}

/**
 * One global print grade over the whole poster, after the panels are composited and before
 * the lettering: a gentle S-curve, a +7% saturation lift, a warm gain on the highlights, a
 * very soft vignette at the poster border and a fine paper grain. Subtle by design — it must
 * unify the eight panel grades, not crush them.
 */
function printPass(ctx, W, H) {
  const lut = getPrintLut();
  const img = ctx.getImageData(0, 0, W, H);
  const px = img.data;
  for (let i = 0; i < px.length; i += 4) {
    let r = lut[px[i]];
    let g = lut[px[i + 1]];
    let b = lut[px[i + 2]];
    // Warm highlight gain: the brightest fifth of the poster drifts a touch toward amber.
    const l = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
    const hi = l > 0.6 ? (l - 0.6) / 0.4 : 0;
    if (hi > 0) {
      r += (255 - r) * 0.045 * hi;
      b *= 1 - 0.035 * hi;
    }
    // Unified saturation lift, +7%.
    const l2 = r * 0.299 + g * 0.587 + b * 0.114;
    r = l2 + (r - l2) * 1.07;
    g = l2 + (g - l2) * 1.07;
    b = l2 + (b - l2) * 1.07;
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
  }
  ctx.putImageData(img, 0, 0);

  // Very soft vignette at the poster border: the sheet darkens a touch toward its trim.
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.62, W / 2, H / 2, Math.hypot(W, H) * 0.6);
  vg.addColorStop(0, 'rgba(18,8,22,0)');
  vg.addColorStop(1, 'rgba(18,8,22,0.15)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  // Paper grain over the whole sheet, tiled from a fixed origin so renders stay deterministic.
  if (!printPattern) printPattern = ctx.createPattern(getPaperTile(), 'repeat');
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.045;
  ctx.fillStyle = printPattern;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

let printPattern = null;

/** The image a panel's fill points at: a plate or one of the person's photos. */
function imageForFill(state, fill) {
  if (typeof fill !== 'string') return null;
  if (fill.startsWith('photo:')) return photoForFill(state, fill)?.img ?? null;
  const plate = plateByKey(fill);
  return plate ? plateImage(plate.key) : null;
}

/** A panel with no photo: a graded duotone wash with poster stripes, intentional-looking. */
function drawWashPanel(ctx, r, lookName) {
  const def = lookDef(lookName);
  const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
  g.addColorStop(0, def.map[0]);
  g.addColorStop(0.6, def.map[1]);
  g.addColorStop(1, def.map[2]);
  ctx.fillStyle = g;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = def.map[2];
  const n = 6;
  for (let i = -r.h; i < r.w; i += (r.w + r.h) / n) {
    ctx.beginPath();
    ctx.moveTo(r.x + i, r.y + r.h);
    ctx.lineTo(r.x + i + r.h * 0.35, r.y);
    ctx.lineTo(r.x + i + r.h * 0.35 + r.w * 0.02, r.y);
    ctx.lineTo(r.x + i + r.w * 0.02, r.y + r.h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Diagonal light-leak streaks across the panel region, screen-blended, whisper-quiet. */
function drawLightLeaks(ctx, x, y, w, h, pal, rng) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 2; i++) {
    // The second streak only lands when the seed says so, keeping renders deterministic.
    if (i > 0 && !chance(rng, 0.6)) break;
    const cx = x + w * rng();
    const cy = y + h * rng();
    const len = Math.max(w, h) * between(rng, 0.9, 1.5);
    const wid = Math.max(w, h) * between(rng, 0.08, 0.16);
    const ang = (rng() - 0.5) * 1.2 + (i === 0 ? -0.7 : 0.5);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    const g = ctx.createLinearGradient(-len / 2, 0, len / 2, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, hexWithAlpha(pal.accent, 0.04 + rng() * 0.04));
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-len / 2, -wid / 2, len, wid);
    ctx.restore();
  }
  ctx.restore();
}

function hexWithAlpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Faint film grain over the panels (the paper grain of the print pass covers the sheet). */
let grainTile = null;
function drawChromeGrain(ctx, x, y, w, h) {
  if (!grainTile) {
    const N = 96;
    grainTile = document.createElement('canvas');
    grainTile.width = N;
    grainTile.height = N;
    const gctx = grainTile.getContext('2d');
    const img = gctx.createImageData(N, N);
    let a = 0x85ebca6b;
    for (let i = 0; i < N * N; i++) {
      a ^= a << 13;
      a ^= a >>> 17;
      a ^= a << 5;
      const v = 118 + ((a >>> 24) % 21);
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v;
      img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    gctx.putImageData(img, 0, 0);
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.035;
  for (let ty = Math.floor(y / 96) * 96; ty < y + h; ty += 96) {
    for (let tx = Math.floor(x / 96) * 96; tx < x + w; tx += 96) ctx.drawImage(grainTile, tx, ty);
  }
  ctx.restore();
}
