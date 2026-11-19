// Colour grades: the cinematic looks applied to every photo panel. Each look is a gradient-map
// duotone/tritone (shadows -> mids -> highlights, blended over the photo's own luminance), plus
// contrast/saturation, a colour wash, bloom, chromatic fringing, vignette and grain. Photos are
// graded in a scratch canvas per panel, so blending never touches the white poster.

export const LOOK_DEFS = {
  sunset: {
    label: 'Sunset',
    contrast: 1.24,
    sat: 1.15,
    map: ['#241046', '#a12871', '#ffab5e'],
    wash: { from: 'rgba(255,106,60,0.30)', to: 'rgba(64,16,120,0.34)', angle: 'v', alpha: 1 },
    bloom: 0.15,
    fringe: 1.1,
    vig: 0.55,
    grain: 0.10,
    edge: '#ff9e5e',
  },
  neon: {
    label: 'Neon',
    contrast: 1.5,
    sat: 1.35,
    map: ['#050d33', '#3b1b8f', '#2ee6ff'],
    wash: { from: 'rgba(46,230,255,0.26)', to: 'rgba(255,32,150,0.30)', angle: 'd', alpha: 1 },
    bloom: 0.2,
    fringe: 1.5,
    vig: 0.6,
    grain: 0.08,
    edge: '#2ee6ff',
  },
  vice: {
    label: 'Vice',
    contrast: 1.26,
    sat: 1.28,
    map: ['#071d2b', '#1c6f8e', '#ff77c8'],
    wash: { from: 'rgba(255,94,177,0.28)', to: 'rgba(12,60,92,0.30)', angle: 'd', alpha: 1 },
    bloom: 0.15,
    fringe: 1.3,
    vig: 0.58,
    grain: 0.09,
    edge: '#ff77c8',
  },
  heat: {
    label: 'Heat',
    contrast: 1.32,
    sat: 1.2,
    map: ['#200505', '#9c2312', '#ffd166'],
    wash: { from: 'rgba(255,170,60,0.26)', to: 'rgba(120,10,10,0.32)', angle: 'v', alpha: 1 },
    bloom: 0.19,
    fringe: 1.2,
    vig: 0.62,
    grain: 0.12,
    edge: '#ffd166',
  },
  noir: {
    label: 'Noir',
    contrast: 1.5,
    sat: 0.06,
    map: ['#070709', '#4b4b58', '#eef0ff'],
    wash: { from: 'rgba(200,215,255,0.16)', to: 'rgba(0,0,0,0.25)', angle: 'v', alpha: 1 },
    bloom: 0.15,
    fringe: 0.5,
    vig: 0.7,
    grain: 0.16,
    edge: '#cdd4ff',
  },
};

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

/** Remaps every pixel's luminance through the tritone palette (stops at 0, 0.55 and 1). */
function applyGradientMap(ctx, w, h, map) {
  const lut = new Uint8ClampedArray(768);
  const a = hexToRgb(map[0]);
  const b = hexToRgb(map[1]);
  const c = hexToRgb(map[2]);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    const seg = t < 0.55 ? [a, b, t / 0.55] : [b, c, (t - 0.55) / 0.45];
    for (let k = 0; k < 3; k++) lut[i * 3 + k] = seg[0][k] + (seg[1][k] - seg[0][k]) * seg[2];
  }
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const l = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) | 0;
    px[i] = lut[l * 3];
    px[i + 1] = lut[l * 3 + 1];
    px[i + 2] = lut[l * 3 + 2];
  }
  ctx.putImageData(data, 0, 0);
}

/** A CSS gradient in a given direction across the panel, for washes and duotone maps. */
export function panelGradient(ctx, w, h, stops, angle = 'v') {
  let g;
  if (angle === 'v') g = ctx.createLinearGradient(0, 0, 0, h);
  else if (angle === 'h') g = ctx.createLinearGradient(0, 0, w, 0);
  else g = ctx.createLinearGradient(0, 0, w, h);
  for (const [pos, color] of stops) g.addColorStop(pos, color);
  return g;
}

// A fine noise tile for grain, generated once (deterministic, no Math.random).
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

/**
 * Draws `img` through the crop transform into a scratch canvas at panel size (pw, ph), applies
 * the look's full grade chain, and returns that canvas ready to blit into the cover.
 */
export function gradePhoto(img, crop, pw, ph, lookName, seed) {
  const def = LOOK_DEFS[lookName] ?? LOOK_DEFS.vice;
  const w = Math.max(2, Math.round(pw));
  const h = Math.max(2, Math.round(ph));
  const base = getScratch(0, w, h);
  const bctx = base.getContext('2d');
  bctx.globalCompositeOperation = 'source-over';
  bctx.globalAlpha = 1;
  bctx.filter = 'none';

  // --- pass 1: chromatic channels. Red shifted left, cyan shifted right, summed on black.
  const photo = getScratch(1, w, h);
  const pctx = photo.getContext('2d');
  pctx.globalCompositeOperation = 'source-over';
  pctx.filter = `saturate(${def.sat}) contrast(${def.contrast})`;
  pctx.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, w, h);
  pctx.filter = 'none';
  pctx.globalCompositeOperation = 'multiply';
  pctx.fillStyle = '#ffffff';
  pctx.fillRect(0, 0, w, h); // reset composite state cleanly

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
  const shift = Math.max(1, (def.fringe * w) / 700);
  bctx.drawImage(red, -shift, 0);
  bctx.drawImage(cyan, shift, 0);
  bctx.globalCompositeOperation = 'source-over';

  // --- pass 2: a true tritone gradient map, per pixel through a 256-entry LUT: shadows take
  // map[0], mids map[1], highlights map[2] — the film-print look, highlights included.
  applyGradientMap(bctx, w, h, def.map);

  // A second, diagonal wash keeps shadows and highlights pulling apart, film-teal style.
  bctx.globalCompositeOperation = 'soft-light';
  bctx.fillStyle = panelGradient(bctx, w, h, [
    [0, def.wash.from],
    [1, def.wash.to],
  ], def.wash.angle);
  bctx.globalAlpha = def.wash.alpha;
  bctx.fillRect(0, 0, w, h);
  bctx.globalAlpha = 1;
  bctx.globalCompositeOperation = 'source-over';

  // --- pass 3: bloom. A blurred, brightened copy screen-lightens the highlights.
  if (def.bloom > 0) {
    const glow = getScratch(4, w, h);
    const gctx = glow.getContext('2d');
    gctx.globalCompositeOperation = 'source-over';
    gctx.filter = `blur(${Math.max(2, w * 0.014)}px) brightness(1.32) saturate(1.2)`;
    gctx.drawImage(base, 0, 0);
    gctx.filter = 'none';
    bctx.globalCompositeOperation = 'lighter';
    bctx.globalAlpha = def.bloom;
    bctx.drawImage(glow, 0, 0);
    bctx.globalAlpha = 1;
    bctx.globalCompositeOperation = 'source-over';
  }

  // --- pass 4: vignette, then grain.
  const vig = bctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, `rgba(0,0,0,${def.vig})`);
  bctx.fillStyle = vig;
  bctx.fillRect(0, 0, w, h);

  if (def.grain > 0) {
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
