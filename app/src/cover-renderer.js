// The cover renderer: assembles the whole poster on a canvas at the chosen export size.
// White poster margin, the layout's panel collage (photos through their crops and grade, or
// the drawn art panel), light-leak chrome, then the caption block and credit strip. Also
// returns the panel rectangles so the editor can hit-test and select panels.

import { layoutPanels } from './collage-layout.js';
import { cropToDraw } from './crop-transform.js';
import { gradePhoto, LOOK_DEFS } from './color-grade.js';
import { drawArtPanel } from './art-panel.js';
import { drawBadge, drawHeadline, drawTagline, drawCreditStrip, letterPalette } from './lettering.js';
import { SIZES, clampCrop } from './state.js';
import { makeRng } from './rng.js';

const POSTER_WHITE = '#faf7f1';
const PANEL_EDGE = '#180d26';

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

  const rng = makeRng(state.seed);
  const pal = letterPalette(state.look);

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = POSTER_WHITE;
  ctx.fillRect(0, 0, W, H);

  // Vertical rhythm: top margin, panels, caption block, then the full-bleed credit strip.
  const M = Math.round(Math.min(W, H) * 0.03);
  const creditH = drawCreditStrip(ctx, W, H, state.credit, state.look);
  const capH = Math.round(Math.min(W, H) * 0.17);
  const panelsX = M;
  const panelsY = M;
  const panelsW = W - M * 2;
  const panelsH = H - M - capH - creditH;

  const layout = layoutPanels(state.layout, panelsW / panelsH);
  const gutter = Math.max(3, Math.round(Math.min(W, H) * 0.014));
  const rects = layout.panels.map((p) => ({
    x: panelsX + p.x * panelsW + gutter / 2,
    y: panelsY + p.y * panelsH + gutter / 2,
    w: p.w * panelsW - gutter,
    h: p.h * panelsH - gutter,
  }));

  // Panels first: dark bases, then content, then dark inner borders.
  ctx.fillStyle = PANEL_EDGE;
  for (const r of rects) ctx.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);

  state.fills = state.fills && state.fills.length === rects.length ? state.fills : new Array(rects.length).fill('color');
  rects.forEach((r, i) => {
    const fill = state.fills[i] ?? 'color';
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    if (fill === 'art') {
      drawArtPanel(ctx, r.x, r.y, r.w, r.h, state.look, state.seed + i * 97);
    } else {
      const photo = state.photos.find((ph) => ph.id === fill);
      if (photo) {
        const crop = clampCrop(photo.crop);
        const src = cropToDraw(photo.img, crop, r.x, r.y, r.w, r.h);
        const graded = gradePhoto(photo.img, src, r.w, r.h, state.look, state.seed + i * 131);
        ctx.drawImage(graded, r.x, r.y, r.w, r.h);
      } else {
        drawEmptyPanel(ctx, r, state.look, i);
      }
      // Tiny corner chip: the panel's index, like a contact-sheet print.
      drawPanelChip(ctx, r, i);
    }
    ctx.restore();
    // Dark border inside the white gutter.
    ctx.strokeStyle = PANEL_EDGE;
    ctx.lineWidth = Math.max(2, Math.round(Math.min(W, H) * 0.004));
    ctx.strokeRect(r.x + ctx.lineWidth / 2, r.y + ctx.lineWidth / 2, r.w - ctx.lineWidth, r.h - ctx.lineWidth);
  });

  // Chrome: light-leak streaks and a whisper of grain over the panel region only.
  drawLightLeaks(ctx, panelsX, panelsY, panelsW, panelsH, pal, rng);
  drawChromeGrain(ctx, panelsX, panelsY, panelsW, panelsH);

  // Caption block: badge, arched headline, tagline — each fitted inside its slice of the zone.
  const capY = panelsY + panelsH;
  drawBadge(ctx, 'ISSUE 01 \u00b7 2026', W / 2, capY + capH * 0.085, capH * 0.14, state.look);
  drawHeadline(ctx, state.headline, W / 2, capY + capH * 0.23, panelsW * 0.92, capH * 0.55, state.look);
  drawTagline(ctx, state.tagline, W / 2, capY + capH * 0.865, panelsW * 0.88, state.look, capH * 0.105);

  // Editor selection outline.
  if (opts.showSelection && state.selectedPanel >= 0 && state.selectedPanel < rects.length) {
    const s = rects[state.selectedPanel];
    ctx.save();
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = Math.max(3, Math.round(Math.min(W, H) * 0.008));
    ctx.setLineDash([Math.min(W, H) * 0.03, Math.min(W, H) * 0.02]);
    ctx.strokeRect(s.x, s.y, s.w, s.h);
    ctx.restore();
  }

  ctx.restore();
  return { rects, creditH };
}

/** A panel with no photo: a graded duotone wash with poster stripes, intentional-looking. */
function drawEmptyPanel(ctx, r, lookName, index) {
  const def = LOOK_DEFS[lookName] ?? LOOK_DEFS.vice;
  const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
  g.addColorStop(0, def.map[0]);
  g.addColorStop(0.6, def.map[1]);
  g.addColorStop(1, def.map[2]);
  ctx.fillStyle = g;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.globalAlpha = 0.16;
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

/** Small index chip in a panel's top-left corner. */
function drawPanelChip(ctx, r, index) {
  const size = Math.max(9, Math.min(r.w, r.h) * 0.055);
  const pad = size * 0.4;
  ctx.save();
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = '#160a24';
  ctx.beginPath();
  ctx.roundRect(r.x + pad, r.y + pad, size * 1.7, size * 1.15, size * 0.25);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = `${size * 0.8}px "Bebas Neue"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(index + 1).padStart(2, '0'), r.x + pad + size * 0.85, r.y + pad + size * 0.62);
  ctx.restore();
}

/** Diagonal light-leak streaks across the panel region, screen-blended. */
function drawLightLeaks(ctx, x, y, w, h, pal, rng) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.globalCompositeOperation = 'screen';
  const streaks = 2;
  for (let i = 0; i < streaks; i++) {
    const cx = x + w * rng();
    const cy = y + h * rng();
    const len = Math.max(w, h) * (0.9 + rng() * 0.6);
    const wid = Math.max(w, h) * (0.1 + rng() * 0.08);
    const ang = (rng() - 0.5) * 1.2 + (i === 0 ? -0.7 : 0.5);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    const g = ctx.createLinearGradient(-len / 2, 0, len / 2, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, hexWithAlpha(pal.mid, 0.06 + rng() * 0.05));
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
