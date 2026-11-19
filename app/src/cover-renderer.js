// The cover renderer: assembles the whole poster on one canvas at the exact export size.
// Cream poster stock, a thin dark keyline around the panel region, the layout's panel collage
// (each panel its own colour grade over its photo or plate, plus a locator label resolved from
// the plate actually shown), the drawn art panel where chosen, the caption band and the credit
// strip. Also returns the panel rectangles in canvas coordinates so the editor can hit-test
// and select panels.

import { layoutPanels } from './collage-layout.js';
import { cropToDraw } from './crop-transform.js';
import { gradePhoto, lookDef } from './color-grade.js';
import { drawArtPanel } from './art-panel.js';
import { plateImage, plateByKey } from './plates.js';
import { drawLocatorLabel, resolveLabel } from './labels.js';
import { captionGeometry, drawCaptionBand, drawCreditStrip } from './caption-band.js';
import { letterPalette, POSTER_CREAM } from './lettering.js';
import { SIZES, photoForFill, clampCrop } from './state.js';
import { makeRng, between } from './rng.js';

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
  // ~21% of the poster so the collage owns it.
  const { bandH, creditH } = captionGeometry(W, H);
  const margin = Math.round(minWH * 0.024);
  const gutter = Math.max(8, Math.min(14, Math.round(W * 0.0068)));
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
      const graded = gradePhoto(img, src, r.w, r.h, panel.look, state.seed + i * 131);
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

/** Diagonal light-leak streaks across the panel region, screen-blended. */
function drawLightLeaks(ctx, x, y, w, h, pal, rng) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 2; i++) {
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
    g.addColorStop(0.5, hexWithAlpha(pal.accent, 0.05 + rng() * 0.05));
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

/** Faint grain over the panels so the print feels like film, not a web page. */
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
  ctx.globalAlpha = 0.05;
  for (let ty = Math.floor(y / 96) * 96; ty < y + h; ty += 96) {
    for (let tx = Math.floor(x / 96) * 96; tx < x + w; tx += 96) ctx.drawImage(grainTile, tx, ty);
  }
  ctx.restore();
}
