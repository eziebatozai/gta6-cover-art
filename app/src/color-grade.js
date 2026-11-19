// Colour grades: the cinematic looks applied to every photo panel. Each look is a split-tone
// film chain — a cool shadow tint and a warm highlight tint blended over the photo's own
// colours (with a skin-tone guard so faces stay believable), a tritone gradient map mixed in
// at low strength for style, then a colour wash, bloom, chromatic fringing, vignette and grain.
// Photos are graded in a scratch canvas per panel, so blending never touches the white poster.

export const LOOK_DEFS = {
  sunset: {
    label: 'Sunset',
    contrast: 1.24,
    sat: 1.12,
    shadowTint: '#2a1a4e',
    highlightTint: '#ffb257',
    tint: 0.46,
    map: ['#231046', '#a12871', '#ffc27a'],
    mapAlpha: 0.22,
    wash: { from: 'rgba(255,140,70,0.22)', to: 'rgba(58,20,110,0.20)', angle: 'v' },
    bloom: 0.1,
    fringe: 0.9,
    vig: 0.46,
    grain: 0.07,
    accent: '#ffab5e',
  },
  neon: {
    label: 'Neon',
    contrast: 1.3,
    sat: 1.22,
    shadowTint: '#101a44',
    highlightTint: '#31e2ff',
    tint: 0.44,
    map: ['#070d2e', '#3b1b8f', '#54e8ff'],
    mapAlpha: 0.28,
    wash: { from: 'rgba(64,220,255,0.18)', to: 'rgba(236,44,150,0.22)', angle: 'd' },
    bloom: 0.13,
    fringe: 1.2,
    vig: 0.54,
    grain: 0.06,
    accent: '#54e8ff',
  },
  vice: {
    label: 'Vice',
    contrast: 1.24,
    sat: 1.18,
    shadowTint: '#0e2a3c',
    highlightTint: '#ff86cf',
    tint: 0.44,
    map: ['#0a2230', '#1c6f8e', '#ffa3d4'],
    mapAlpha: 0.24,
    wash: { from: 'rgba(255,120,190,0.20)', to: 'rgba(16,66,96,0.20)', angle: 'd' },
    bloom: 0.1,
    fringe: 1.0,
    vig: 0.5,
    grain: 0.06,
    accent: '#ff86cf',
  },
  heat: {
    label: 'Heat',
    contrast: 1.28,
    sat: 1.14,
    shadowTint: '#2a0c10',
    highlightTint: '#ffc45e',
    tint: 0.46,
    map: ['#280808', '#a03018', '#ffd97e'],
    mapAlpha: 0.22,
    wash: { from: 'rgba(255,180,80,0.20)', to: 'rgba(110,16,10,0.20)', angle: 'v' },
    bloom: 0.12,
    fringe: 1.0,
    vig: 0.52,
    grain: 0.09,
    accent: '#ffc45e',
  },
  noir: {
    label: 'Noir',
    contrast: 1.3,
    sat: 0.12,
    shadowTint: '#0d0d12',
    highlightTint: '#e8ebf5',
    tint: 0.3,
    map: ['#0a0a0e', '#4b4b58', '#f2f3fa'],
    mapAlpha: 0.3,
    wash: { from: 'rgba(210,220,250,0.10)', to: 'rgba(0,0,0,0.18)', angle: 'v' },
    bloom: 0.12,
    fringe: 0.4,
    vig: 0.56,
    grain: 0.12,
    accent: '#d5d9ea',
  },
};

export function lookDef(name) {
  return LOOK_DEFS[name] ?? LOOK_DEFS.vice;
}

// Scratch canvases for the grade chain, grown on demand and shared across panels.
const scratch = [];
function getScratch(i, w, h) {
  if (!scratch[i]) scratch[i] = document.createElement('canvas');
  const c = scratch[i];
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
  }
  return c;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// Fine noise tile for grain, generated once (deterministic xorshift, never Math.random).
let noiseTile = null;
function getNoiseTile() {
  if (noiseTile) return noiseTile;
  const N = 128;
  const c = document.createElement('canvas');
  c.width = N;
  c.height = N;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(N, N);
  let a = 0x9e3779b9;
  for (let i = 0; i < N * N; i++) {
    a ^= a << 13;
    a ^= a >>> 17;
    a ^= a << 5;
    const v = 128 + ((a >>> 24) - 128) * 0.9;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  noiseTile = c;
  return c;
}

/** A CSS gradient in a given direction across the panel, for washes. */
export function panelGradient(ctx, w, h, stops, angle = 'v') {
  let g;
  if (angle === 'v') g = ctx.createLinearGradient(0, 0, 0, h);
  else if (angle === 'h') g = ctx.createLinearGradient(0, 0, w, 0);
  else g = ctx.createLinearGradient(0, 0, w, h);
  for (const [pos, color] of stops) g.addColorStop(pos, color);
  return g;
}

/**
 * The split-tone pass, per pixel through one getImageData: shadows pull toward the look's cool
 * tint, highlights toward its warm tint, while a skin-tone guard keeps faces and warm wood
 * believable — skin pixels take only a fraction of the tint. The tritone gradient map is mixed
 * in at the same time at mapAlpha, for style without a flat single-hue wash. `opts` lets the
 * duotone treatment swap the map for a hard two-tone print ramp and mix it in strongly.
 */
function splitTonePass(ctx, w, h, def, opts = {}) {
  const shadow = hexToRgb(def.shadowTint);
  const highlight = hexToRgb(def.highlightTint);
  const map = (opts.map ?? def.map).map(hexToRgb);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;

  // Gradient-map LUT: shadows -> map[0], mids -> map[1], highlights -> map[2]. A duotone map is
  // [dark, dark, light], so both segments interpolate the same hard print ramp.
  const lut = new Uint8ClampedArray(768);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    const seg = t < 0.55 ? [map[0], map[1], t / 0.55] : [map[1], map[2], (t - 0.55) / 0.45];
    for (let k = 0; k < 3; k++) lut[i * 3 + k] = seg[0][k] + (seg[1][k] - seg[0][k]) * seg[2];
  }

  const tint = opts.tint ?? def.tint;
  const mapAlpha = opts.mapAlpha ?? def.mapAlpha;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    const l = (r * 0.299 + g * 0.587 + b * 0.114) / 255;

    // Skin guard: warm pixels in face range keep most of their own colour.
    const warm = r > g && g >= b * 0.92 && r - b > 18 && r > 88;
    const skin = warm ? clamp01((r - b - 18) / 42) : 0;

    // Split-tone target: cool at the bottom of the range, warm at the top.
    const tR = shadow[0] + (highlight[0] - shadow[0]) * l;
    const tG = shadow[1] + (highlight[1] - shadow[1]) * l;
    const tB = shadow[2] + (highlight[2] - shadow[2]) * l;
    const a = tint * (1 - 0.78 * skin);

    // Gradient-map colour at this luminance, mixed over the split tone.
    const mR = lut[(l * 255) | 0] ?? 0;
    const mG = lut[((l * 255) | 0) + 1] ?? 0;
    const mB = lut[((l * 255) | 0) + 2] ?? 0;

    px[i] = r + ((tR + (mR - tR) * mapAlpha - r) * a) | 0;
    px[i + 1] = g + ((tG + (mG - tG) * mapAlpha - g) * a) | 0;
    px[i + 2] = b + ((tB + (mB - tB) * mapAlpha - b) * a) | 0;
  }
  ctx.putImageData(data, 0, 0);
}

/**
 * The halftone screen treatment: sample each grid cell's luminance from the graded panel and
 * repaint the panel as light dots of the look's palette on its dark tone — a printed comic
 * screen. A seeded half-cell offset keeps panels from aligning mechanically.
 */
function applyHalftone(ctx, w, h, def, rng) {
  const src = ctx.getImageData(0, 0, w, h);
  const px = src.data;
  const cell = Math.max(4, Math.round(Math.min(w, h) / 30));
  const cols = Math.ceil(w / cell);
  const rows = Math.ceil(h / cell);
  const ox = Math.floor(rng() * cell);
  const oy = Math.floor(rng() * cell);

  // Average luminance per cell, from the already-graded pixels.
  const lum = new Float32Array(cols * rows);
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      let sum = 0;
      let n = 0;
      const y1 = Math.min(h, cy * cell + cell);
      const x1 = Math.min(w, cx * cell + cell);
      for (let y = cy * cell; y < y1; y++) {
        for (let x = cx * cell; x < x1; x++) {
          const i = (y * w + x) * 4;
          sum += (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) / 255;
          n++;
        }
      }
      lum[cy * cols + cx] = n ? sum / n : 0;
    }
  }

  // Repaint: dark paper, then round ink dots scaled by sqrt(luminance), mid stop at low lums.
  const mid = hexToRgb(def.map[1]);
  const light = hexToRgb(def.map[2]);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = def.map[0];
  ctx.fillRect(0, 0, w, h);
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const l = lum[cy * cols + cx];
      if (l < 0.06) continue;
      const t = clamp01((l - 0.3) / 0.55);
      ctx.fillStyle = `rgb(${mix(mid[0], light[0], t) | 0},${mix(mid[1], light[1], t) | 0},${mix(mid[2], light[2], t) | 0})`;
      const radius = cell * 0.62 * Math.sqrt(l);
      ctx.beginPath();
      ctx.arc(ox + cx * cell + cell / 2, oy + cy * cell + cell / 2, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Draws `img` through the crop source rect into a scratch canvas at panel size (pw, ph), runs
 * the look's full grade chain with the panel's treatment — 'grade' (full colour), 'duotone'
 * (a hard two-tone print of the look's palette) or 'halftone' (a printed dot screen) — and
 * returns that canvas ready to blit into the cover.
 */
export function gradePhoto(img, src, pw, ph, lookName, seed, treat = 'grade') {
  const def = lookDef(lookName);
  const duo = treat === 'duotone';
  const w = Math.max(2, Math.round(pw));
  const h = Math.max(2, Math.round(ph));
  const base = getScratch(0, w, h);
  const bctx = base.getContext('2d', { willReadFrequently: true });
  bctx.globalCompositeOperation = 'source-over';
  bctx.globalAlpha = 1;
  bctx.filter = 'none';

  // --- pass 1: the photo, then a true chromatic fringe: red shifted left, cyan shifted right,
  // summed on black, so edges catch a colour split without double-exposing the whole frame.
  const photo = getScratch(1, w, h);
  const pctx = photo.getContext('2d', { willReadFrequently: true });
  pctx.globalCompositeOperation = 'source-over';
  pctx.filter = `saturate(${def.sat}) contrast(${def.contrast})`;
  pctx.drawImage(img, src.sx, src.sy, src.sw, src.sh, 0, 0, w, h);
  pctx.filter = 'none';

  const red = getScratch(2, w, h);
  const rctx = red.getContext('2d');
  rctx.globalCompositeOperation = 'source-over';
  rctx.drawImage(photo, 0, 0);
  rctx.globalCompositeOperation = 'multiply';
  rctx.fillStyle = '#ff0000';
  rctx.fillRect(0, 0, w, h);

  const cyan = getScratch(3, w, h);
  const cctx = cyan.getContext('2d');
  cctx.globalCompositeOperation = 'source-over';
  cctx.drawImage(photo, 0, 0);
  cctx.globalCompositeOperation = 'multiply';
  cctx.fillStyle = '#00ffff';
  cctx.fillRect(0, 0, w, h);

  bctx.fillStyle = '#000';
  bctx.fillRect(0, 0, w, h);
  bctx.globalCompositeOperation = 'lighter';
  const shift = Math.max(1, (def.fringe * w) / 900);
  bctx.drawImage(red, -shift, 0);
  bctx.drawImage(cyan, shift, 0);
  bctx.globalCompositeOperation = 'source-over';

  // --- pass 2: the split-tone + gradient-map mix, with the skin guard. Duotone collapses the
  // map to a hard two-tone print ramp and lets it dominate.
  splitTonePass(bctx, w, h, def, duo
    ? { map: [def.map[0], def.map[0], def.map[2]], mapAlpha: 0.9, tint: def.tint * 0.6 }
    : {});

  // --- pass 3: a soft wash keeps shadows and highlights pulling apart, film style.
  bctx.globalCompositeOperation = 'soft-light';
  bctx.globalAlpha = duo ? 0.55 : 0.75;
  bctx.fillStyle = panelGradient(bctx, w, h, [
    [0, def.wash.from],
    [1, def.wash.to],
  ], def.wash.angle);
  bctx.fillRect(0, 0, w, h);
  bctx.globalAlpha = 1;
  bctx.globalCompositeOperation = 'source-over';

  // --- pass 4: bloom. A blurred, brightened copy screen-lightens the highlights — gently, so
  // the brightest skies stay readable instead of blowing out.
  if (def.bloom > 0 && treat !== 'halftone') {
    const glow = getScratch(4, w, h);
    const gctx = glow.getContext('2d');
    gctx.globalCompositeOperation = 'source-over';
    gctx.filter = `blur(${Math.max(2, w * 0.012)}px) brightness(1.18) saturate(1.12)`;
    gctx.drawImage(base, 0, 0);
    gctx.filter = 'none';
    bctx.globalCompositeOperation = 'lighter';
    bctx.globalAlpha = def.bloom;
    bctx.drawImage(glow, 0, 0);
    bctx.globalAlpha = 1;
    bctx.globalCompositeOperation = 'source-over';
  }

  // --- pass 4b: the halftone screen replaces luminance detail with printed dots of the look.
  if (treat === 'halftone') {
    applyHalftone(bctx, w, h, def, makeRng(seed ^ 0x2f4b));
  }

  // --- pass 5: vignette, then grain.
  const vig = bctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.4, w / 2, h / 2, Math.max(w, h) * 0.78);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, `rgba(0,0,0,${def.vig})`);
  bctx.fillStyle = vig;
  bctx.fillRect(0, 0, w, h);

  if (def.grain > 0 && treat !== 'halftone') {
    bctx.globalCompositeOperation = 'overlay';
    bctx.globalAlpha = def.grain;
    const tile = getNoiseTile();
    for (let y = 0; y < h; y += tile.height) {
      for (let x = 0; x < w; x += tile.width) bctx.drawImage(tile, x, y);
    }
    bctx.globalAlpha = 1;
    bctx.globalCompositeOperation = 'source-over';
  }

  void seed;
  return base;
}

// Local mulberry32 (mirrors rng.js) so the halftone jitter stays self-contained and seeded.
function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
