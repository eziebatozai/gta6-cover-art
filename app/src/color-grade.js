// Colour grades: the cinematic looks applied to every photo panel. The chain, in order, all on
// a scratch canvas at panel resolution:
//   1. histogram normalisation — 2nd/98th luminance percentiles mapped to ~0.05/0.95, which is
//      what pulls milky lifted blacks and pale grey skies back into a full film range;
//   2. an S-curve (smooth sigmoid around 0.5, strength per look) plus a tiny gamma lift on mids;
//   3. a split-tone — shadows toward the look's shadow hue, highlights toward its warm tint,
//      kept under ~25% so a face still reads as a face (skin takes only a fraction of the tint);
//   4. a saturation boost with a skin-tone guard (hue 15-45° caps the boost at 1.12) and a
//      highlight guard (pixels above 0.92 luminance keep their hue instead of clipping to white);
//   5. a per-look tritone gradient map at low strength — neon and vice push it, sunset and heat
//      stay photographic;
//   6. per-plate treatments, bloom on bright pixels only, a vignette and fine grain. (The
//      chromatic fringe runs first, on the raw photo, so the shadow toe re-crushes any edge
//      bleed.)
// Two plates carry their own dusk treatment on top of whatever look the panel wears: DECO
// CARLYLE gets an indigo-to-magenta dusk sky, a lifted white facade, a warm parapet rim light
// and a neon entrance glow; ROUTE MOTEL gets an amber-dusk lift that keeps its red/green neon.
// Sky-heavy plates (SUNSET WATER, MARINA NIGHTS) take a soft gradient wash keyed to their look,
// so every sky on the poster sits in one palette family. Every look is tuned so the darkest
// decile lands near true black and highlights keep a hue.

export const LOOK_DEFS = {
  sunset: {
    label: 'Sunset',
    curve: 0.52,          // S-curve strength
    gamma: 0.975,        // tiny mid lift
    shadowTint: '#1b0b2e', // deep violet shadows
    highlightTint: '#ffd9a0', // warm gold highlights
    tint: 0.22,
    sat: 1.28,
    map: ['#0d0620', '#a12871', '#ffc27a'],
    mapAlpha: 0.1,       // photographic: barely any gradient map
    bloom: 0.16,
    fringe: 0.8,
    vig: 0.22,
    grain: 0.035,
    accent: '#ffab5e',
  },
  neon: {
    label: 'Neon',
    curve: 0.6,
    gamma: 0.97,
    shadowTint: '#06202a', // deep teal shadows
    highlightTint: '#ff9ecb', // hot pink highlights
    tint: 0.25,
    sat: 1.32,
    map: ['#04070f', '#d81fa0', '#6ff0ff'], // emphatic magenta + cyan split
    mapAlpha: 0.5,       // neon may push the map
    bloom: 0.18,
    fringe: 1.4,
    vig: 0.24,
    grain: 0.033,
    accent: '#54e8ff',
  },
  vice: {
    label: 'Vice',
    curve: 0.58,
    gamma: 0.975,
    shadowTint: '#1b0b2e', // violet shadows
    highlightTint: '#ff8fc0', // pink highlights
    tint: 0.25,
    sat: 1.3,
    map: ['#12082a', '#1c6f8e', '#ffa0cc'], // teal mids
    mapAlpha: 0.36,      // vice may push the map
    bloom: 0.15,
    fringe: 1.1,
    vig: 0.23,
    grain: 0.034,
    accent: '#ff86cf',
  },
  heat: {
    label: 'Heat',
    curve: 0.56,
    gamma: 0.97,
    shadowTint: '#2a0f08', // dark brown shadows
    highlightTint: '#ffd9a0',
    tint: 0.2,
    sat: 1.26,
    map: ['#1c0604', '#a03018', '#ffd97e'],
    mapAlpha: 0.08,      // photographic
    bloom: 0.14,
    fringe: 0.9,
    vig: 0.25,
    grain: 0.04,
    accent: '#ffc45e',
  },
  noir: {
    label: 'Noir',
    curve: 0.6,
    gamma: 0.96,
    shadowTint: '#0d0b09',
    highlightTint: '#f5e9d2', // warm paper white
    tint: 0.18,
    sat: 0.1,            // mono: near-desaturated, then warm-tinted
    map: ['#0c0a08', '#5a5148', '#f7ecd8'],
    mapAlpha: 0.25,
    bloom: 0.12,
    fringe: 0.5,
    vig: 0.25,
    grain: 0.04,
    accent: '#d5d9ea',
  },
};

export function lookDef(name) {
  return LOOK_DEFS[name] ?? LOOK_DEFS.vice;
}

// --- per-plate tone overrides: a plate can pull the look's split-tone toward its own story ---

const PLATE_TONES = {
  // The deco facade must stay dusk-white: cool near-white highlights, barely any map.
  carlyle: { shadowTint: '#1a0f42', highlightTint: '#f2ecff', tint: 0.15, sat: 1.2, mapAlpha: 0.05 },
  // Warm dusk on the route: indigo shadows, amber highlights, the tritone pulled warm so the
  // red and green neon read as the brightest thing in frame.
  motel: {
    shadowTint: '#150e3c',
    highlightTint: '#ffce8a',
    tint: 0.27,
    sat: 1.32,
    map: ['#0e0826', '#8a4a24', '#ffd9a0'],
    mapAlpha: 0.14,
  },
};

// --- scratch canvases for the grade chain, grown on demand and shared across panels ---
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

// Fine noise tile for grain, generated once (deterministic xorshift, no platform random).
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

// --- the tone LUT: histogram normalisation + S-curve + gamma, precomputed per panel ---

/** Luminance percentile of the panel's pixels, sampled on a small copy. */
function luminanceRange(ctx, w, h) {
  const sw = Math.max(24, Math.min(120, w >> 2));
  const sh = Math.max(18, Math.round((h * sw) / w));
  const small = getScratch(5, sw, sh);
  const sctx = small.getContext('2d', { willReadFrequently: true });
  sctx.globalCompositeOperation = 'source-over';
  sctx.drawImage(ctx.canvas, 0, 0, w, h, 0, 0, sw, sh);
  const d = sctx.getImageData(0, 0, sw, sh).data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    hist[(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0]++;
  }
  const total = sw * sh;
  const at = (p) => {
    let acc = 0;
    const want = total * p;
    for (let v = 0; v < 256; v++) {
      acc += hist[v];
      if (acc >= want) return v / 255;
    }
    return 1;
  };
  return { lo: at(0.02), hi: at(0.98) };
}

/**
 * Builds the 256-entry tone curve: histogram normalisation (2nd/98th percentile to
 * ~0.05/0.95), then the look's S-curve sigmoid around 0.5, then the tiny gamma lift.
 */
function buildToneLut(ctx, w, h, def) {
  const { lo, hi } = luminanceRange(ctx, w, h);
  const loOut = 0.05;
  const hiOut = 0.95;
  // Gain is clamped so a near-mono source never explodes into noise.
  const gain = Math.min(2.6, Math.max(0.75, (hiOut - loOut) / Math.max(0.06, hi - lo)));
  const toeStart = 0.36; // below this, values fall harder — film blacks, never milky grey
  const k = 6.2; // sigmoid steepness
  const sig = (v) => 1 / (1 + Math.exp(-k * (v - 0.5)));
  const s0 = sig(0);
  const s1 = sig(1);
  const lut = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    let v = i / 255;
    // 1. levels: linear map of the measured range onto the film range (below p2 keeps falling
    //    proportionally, so the true blacks reach zero instead of lifting).
    v = v <= lo ? (v / Math.max(0.004, lo)) * loOut : loOut + (v - lo) * gain;
    v = Math.min(1.06, v);
    // 1b. shadow toe: the deepest third of the range falls harder still, so the darkest decile
    // lands near true black while mids keep their footing.
    if (v < toeStart) v *= 0.3 + 0.7 * (v / toeStart) ** 3;
    // 2. S-curve, strength-blended, then renormalised so 0 and 1 stay fixed.
    const s = (sig(clamp01(v)) - s0) / (s1 - s0);
    v = v + (s - v) * def.curve;
    // 3. tiny gamma lift on the mids, then a hard black-floor crush so nothing in the bottom
    //    of the range can sit as milky grey.
    v = Math.pow(clamp01(v), def.gamma);
    if (v < 0.18) v *= 0.5 + 0.5 * (v / 0.18);
    lut[i] = v;
  }
  return lut;
}

// --- gradient-map LUT: shadows -> map[0], mids -> map[1], highlights -> map[2] ---
function buildMapLut(map) {
  const stops = map.map(hexToRgb);
  const lut = new Uint8ClampedArray(768);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    const seg = t < 0.55 ? [stops[0], stops[1], t / 0.55] : [stops[1], stops[2], (t - 0.55) / 0.45];
    for (let k = 0; k < 3; k++) lut[i * 3 + k] = seg[0][k] + (seg[1][k] - seg[0][k]) * seg[2];
  }
  return lut;
}

/** How "skin" a pixel is: warm hue in the 15-45° band with mid saturation, 0..1. */
function skinFactor(hue, sat, l, r, g, b) {
  if (r < 70 || r <= g || g < b * 0.82 || r - b < 16) return 0;
  if (hue < 12 || hue > 48) return 0;
  if (sat < 0.12 || sat > 0.78) return 0;
  if (l < 0.18 || l > 0.92) return 0;
  return clamp01((48 - hue) / 20) * clamp01((r - b) / 40);
}

/**
 * The single per-pixel pass: applies the tone LUT, the split-tone with skin guard, the
 * gradient map at its (low) strength, then the guarded saturation boost. One read/one write
 * of the panel's ImageData. `opts` may override any part of the split-tone/map — the
 * per-plate dusk tones use that to pull a look toward the plate's own story.
 */
function tonePass(ctx, w, h, def, opts = {}) {
  const lut = buildToneLut(ctx, w, h, def);
  const mapLut = buildMapLut(opts.map ?? def.map);
  const mapAlpha = opts.mapAlpha ?? def.mapAlpha;
  const tint = opts.tint ?? def.tint;
  const satBoost = opts.sat ?? def.sat;
  const shadow = hexToRgb(opts.shadowTint ?? def.shadowTint);
  const highlight = hexToRgb(opts.highlightTint ?? def.highlightTint);

  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    // --- tone curve through the LUT (same curve on all channels keeps hues) ---
    let r = lut[px[i]] * 255;
    let g = lut[px[i + 1]] * 255;
    let b = lut[px[i + 2]] * 255;

    let l = (r * 0.299 + g * 0.587 + b * 0.114) / 255;

    // --- split-tone: shadows toward the shadow hue, highlights toward the warm tint. The
    // target colour is rescaled to the pixel's own luminance, so the tint moves hue without
    // ever lifting a black or dimming a highlight.
    const tR0 = shadow[0] + (highlight[0] - shadow[0]) * l;
    const tG0 = shadow[1] + (highlight[1] - shadow[1]) * l;
    const tB0 = shadow[2] + (highlight[2] - shadow[2]) * l;
    const tLuma = (tR0 * 0.299 + tG0 * 0.587 + tB0 * 0.114) / 255;
    const keep = tLuma > 0.004 ? Math.min(2.5, l / tLuma) : 1;
    const tR = tR0 * keep;
    const tG = tG0 * keep;
    const tB = tB0 * keep;
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const sat = mx > 0 ? (mx - mn) / mx : 0;
    let hue = 0;
    if (mx > mn) {
      const d = mx - mn;
      if (mx === r) hue = 60 * (((g - b) / d) % 6);
      else if (mx === g) hue = 60 * ((b - r) / d + 2);
      else hue = 60 * ((r - g) / d + 4);
      if (hue < 0) hue += 360;
    }
    const skin = skinFactor(hue, sat, l, r, g, b);
    const a = tint * (1 - 0.8 * skin);
    r += (tR - r) * a;
    g += (tG - g) * a;
    b += (tB - b) * a;

    // --- tritone gradient map at low strength (skipped on faces) ---
    if (mapAlpha > 0) {
      const mI = (clamp01(l) * 255) | 0;
      const mA = mapAlpha * (1 - 0.6 * skin);
      r += (mapLut[mI * 3] - r) * mA;
      g += (mapLut[mI * 3 + 1] - g) * mA;
      b += (mapLut[mI * 3 + 2] - b) * mA;
    }

    // --- saturation boost with skin + highlight guards ---
    l = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
    let boost = satBoost;
    if (skin > 0) boost = Math.min(boost, 1.12); // faces keep at most a gentle boost
    if (l > 0.92) boost = 1 + (boost - 1) * clamp01(1 - (l - 0.92) / 0.08); // highlights keep hue
    if (boost !== 1) {
      const luma = r * 0.299 + g * 0.587 + b * 0.114;
      r = luma + (r - luma) * boost;
      g = luma + (g - luma) * boost;
      b = luma + (b - luma) * boost;
      // highlight guard: never let a channel clip to flat white — pull back keeping hue.
      const mx3 = Math.max(r, g, b);
      if (mx3 > 247) {
        const f = 247 / mx3;
        r *= f;
        g *= f;
        b *= f;
      }
    }

    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
  }
  ctx.putImageData(data, 0, 0);
}

// ---------------------------------------------------------------------------
// per-plate dusk treatments: drawn on the graded panel, photographic, subtle.
// ---------------------------------------------------------------------------

/**
 * DECO CARLYLE: an indigo-to-magenta dusk sky (a `lighten` gradient, so only the dark sky
 * picks it up and the bright facade stays white), a crisp facade lift with deeper window
 * shadows, a warm rim light traced along the parapet (found per column as the dark-to-bright
 * edge), and a neon wash at the entrance.
 */
function duskDeco(ctx, w, h) {
  // 1. dusk sky: a vertical lighten gradient from deep indigo through violet into magenta,
  // gone by ~60% down where the facade begins. Bright pixels are untouched by `lighten`.
  ctx.globalCompositeOperation = 'lighten';
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.62);
  sky.addColorStop(0, 'rgba(34,12,92,0.96)');
  sky.addColorStop(0.28, 'rgba(104,26,124,0.8)');
  sky.addColorStop(0.48, 'rgba(198,58,140,0.5)');
  sky.addColorStop(0.62, 'rgba(0,0,0,0)');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // 2. facade: bright pixels lift toward crisp white, the window shadows deepen a touch —
  // real shadow gradients, not a posterised filter.
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const lum = new Float32Array(w * h);
  for (let i = 0, p = 0; i < px.length; i += 4, p++) {
    const l = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) / 255;
    lum[p] = l;
    if (l > 0.45) {
      // The lift target is a warm paper-white, so the facade comes up crisp and sun-kissed
      // instead of keeping the cool cast of the dusk sky.
      const k = Math.min(1, (l - 0.45) / 0.4) * 0.42;
      px[i] += (255 - px[i]) * k;
      px[i + 1] += (250 - px[i + 1]) * k;
      px[i + 2] += (240 - px[i + 2]) * k;
    } else if (l < 0.28) {
      const k = 0.92 + 0.08 * (l / 0.28);
      px[i] *= k;
      px[i + 1] *= k;
      px[i + 2] *= k;
    }
  }

  // 3. parapet rim light: the first dark-to-bright edge in each column, inside the top 60%,
  // traced with a 3px warm additive falloff. A slow deterministic ripple keeps it organic.
  const scanEnd = Math.round(h * 0.6);
  ctx.globalCompositeOperation = 'lighter';
  for (let x = 0; x < w; x++) {
    let ry = -1;
    for (let y = 1; y < scanEnd; y++) {
      if (lum[(y - 1) * w + x] < 0.35 && lum[y * w + x] >= 0.55) {
        ry = y;
        break;
      }
    }
    if (ry < 0) continue;
    const ripple = 0.7 + 0.3 * (((x * 7919) % 17) / 17);
    for (let dy = 0; dy < 3; dy++) {
      const y = ry + dy;
      if (y >= h) break;
      const f = (1 - dy / 3) * 0.5 * ripple;
      const i = (y * w + x) * 4;
      px[i] = Math.min(255, px[i] + 235 * f);
      px[i + 1] = Math.min(255, px[i + 1] + 165 * f);
      px[i + 2] = Math.min(255, px[i + 2] + 95 * f);
    }
  }
  ctx.putImageData(data, 0, 0);
  ctx.globalCompositeOperation = 'source-over';

  // 4. entrance: a neon wash rising from the bottom edge, screen-blended so only the dark
  // doorway and lower facade glow.
  ctx.globalCompositeOperation = 'screen';
  const glow = ctx.createRadialGradient(w * 0.5, h * 1.08, h * 0.04, w * 0.5, h * 1.08, h * 0.55);
  glow.addColorStop(0, 'rgba(255,104,158,0.34)');
  glow.addColorStop(0.55, 'rgba(255,104,158,0.1)');
  glow.addColorStop(1, 'rgba(255,104,158,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, h * 0.45, w, h * 0.55);
  ctx.globalCompositeOperation = 'source-over';
}

/**
 * ROUTE MOTEL: an amber-dusk lift over the whole frame — a `lighten` gradient (indigo at the
 * top of the sky through amber at the horizon, transparent over the bright neon) so the big
 * dark sky and the dark ground fall into one dusk palette while the red/green neon, the
 * brightest pixels in frame, are untouched and stay the story.
 */
function duskRoute(ctx, w, h) {
  ctx.globalCompositeOperation = 'lighten';
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, 'rgba(30,20,80,0.92)');
  sky.addColorStop(0.36, 'rgba(92,42,100,0.5)');
  sky.addColorStop(0.56, 'rgba(200,102,46,0.46)');
  sky.addColorStop(0.78, 'rgba(150,82,36,0.26)');
  sky.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  // A soft warm screen over the lower third: the dark desert ground picks up the last of the
  // dusk without dimming the neon above it.
  ctx.globalCompositeOperation = 'screen';
  const ground = ctx.createLinearGradient(0, h * 0.62, 0, h);
  ground.addColorStop(0, 'rgba(96,52,26,0)');
  ground.addColorStop(1, 'rgba(96,52,26,0.35)');
  ctx.fillStyle = ground;
  ctx.fillRect(0, h * 0.62, w, h * 0.38);
  ctx.globalCompositeOperation = 'source-over';
}

/**
 * Sky-heavy plates (SUNSET WATER, MARINA NIGHTS): a soft gradient wash keyed to the panel's
 * look — its shadow hue over the top of the frame, its warm highlight tint across the horizon
 * band — so every sky on the poster shares one palette family without flattening the photo.
 */
function skyWash(ctx, w, h, def) {
  const shadow = hexToRgb(def.shadowTint);
  const warm = hexToRgb(def.highlightTint);
  ctx.globalCompositeOperation = 'soft-light';
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, `rgba(${shadow[0]},${shadow[1]},${shadow[2]},0.4)`);
  g.addColorStop(0.38, `rgba(${shadow[0]},${shadow[1]},${shadow[2]},0.16)`);
  g.addColorStop(0.58, `rgba(${warm[0]},${warm[1]},${warm[2]},0.2)`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // A second, fainter overlay pass ties the wash into the midtones as well.
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

/** Zeros every pixel below the bloom knee and soft-knees the rest, in place. */
function bloomMask(ctx, w, h) {
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const l = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) / 255;
    const f = clamp01((l - 0.76) / 0.14);
    const s = f * f;
    px[i] *= s;
    px[i + 1] *= s;
    px[i + 2] *= s;
  }
  ctx.putImageData(data, 0, 0);
}

/**
 * Draws `img` through the crop source rect into a scratch canvas at panel size (pw, ph), runs
 * the full grade chain and returns that canvas ready to blit into the cover. `opts` carries
 *   treat — 'grade' (the film chain) or 'duotone' (a hard two-tone print of the palette);
 *   plate — the plate definition actually shown, for its dusk treatment, sky wash and
 *           per-plate tone overrides. Anything else falls back to the plain grade.
 */
export function gradePhoto(img, src, pw, ph, lookName, seed, opts = {}) {
  const def = lookDef(lookName);
  const plate = opts.plate ?? null;
  const w = Math.max(2, Math.round(pw));
  const h = Math.max(2, Math.round(ph));
  const base = getScratch(0, w, h);
  const bctx = base.getContext('2d', { willReadFrequently: true });
  bctx.globalCompositeOperation = 'source-over';
  bctx.globalAlpha = 1;
  bctx.filter = 'none';

  // --- the photo itself, then the chromatic fringe while it is still raw: red shifts left,
  // cyan shifts right, masked to the panel's edges so the centre stays clean. Fringing before
  // the grade means the shadow toe below re-crushes any edge bleed, so the lens aberration
  // never lifts the blacks.
  bctx.drawImage(img, src.sx, src.sy, src.sw, src.sh, 0, 0, w, h);
  if (def.fringe > 0) {
    const shift = Math.max(1, Math.round((def.fringe * w) / 900));
    const red = getScratch(2, w, h);
    const rctx = red.getContext('2d');
    rctx.globalCompositeOperation = 'source-over';
    rctx.drawImage(base, 0, 0);
    rctx.globalCompositeOperation = 'multiply';
    rctx.fillStyle = '#ff0000';
    rctx.fillRect(0, 0, w, h);
    const cyan = getScratch(3, w, h);
    const cctx = cyan.getContext('2d');
    cctx.globalCompositeOperation = 'source-over';
    cctx.drawImage(base, 0, 0);
    cctx.globalCompositeOperation = 'multiply';
    cctx.fillStyle = '#00ffff';
    cctx.fillRect(0, 0, w, h);

    const fr = getScratch(6, w, h);
    const fctx = fr.getContext('2d');
    fctx.globalCompositeOperation = 'source-over';
    fctx.fillStyle = '#000';
    fctx.fillRect(0, 0, w, h);
    fctx.globalCompositeOperation = 'lighter';
    fctx.drawImage(red, -shift, 0);
    fctx.drawImage(cyan, shift, 0);
    // Edge mask: transparent in the middle, opaque at the frame's border.
    fctx.globalCompositeOperation = 'destination-in';
    const mask = fctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.34, w / 2, h / 2, Math.max(w, h) * 0.62);
    mask.addColorStop(0, 'rgba(0,0,0,0)');
    mask.addColorStop(1, 'rgba(0,0,0,1)');
    fctx.fillStyle = mask;
    fctx.fillRect(0, 0, w, h);

    bctx.globalCompositeOperation = 'source-over';
    bctx.drawImage(fr, 0, 0);
    bctx.globalCompositeOperation = 'source-over';
  }

  // --- 1-5: levels, curve, split-tone, gradient map, guarded saturation (one pixel pass) ---
  const duo = opts.treat === 'duotone';
  const plateTone = plate ? PLATE_TONES[plate.treat] ?? null : null;
  const tone = duo
    ? { map: [def.map[0], def.map[0], def.map[2]], mapAlpha: 0.85, tint: def.tint * 0.6 }
    : plateTone
      ? {
          map: plateTone.map ?? def.map,
          mapAlpha: plateTone.mapAlpha ?? def.mapAlpha,
          tint: plateTone.tint ?? def.tint,
          sat: plateTone.sat ?? def.sat,
          shadowTint: plateTone.shadowTint ?? def.shadowTint,
          highlightTint: plateTone.highlightTint ?? def.highlightTint,
        }
      : {};
  tonePass(bctx, w, h, def, tone);

  // --- per-plate dusk treatments and the sky wash, before bloom so new highlights glow too ---
  if (plate?.treat === 'dusk-deco') duskDeco(bctx, w, h);
  if (plate?.treat === 'dusk-route') duskRoute(bctx, w, h);
  if (plate?.skyWash) skyWash(bctx, w, h, def);

  // --- 6a: bloom, only on bright pixels. First a hard threshold pass keeps just the pixels
  // above the bloom knee (~0.78 luminance), then that highlight mask is blurred and
  // screen-added — so glow halos the lights without ever washing the shadows.
  if (def.bloom > 0) {
    const hi = getScratch(7, w, h);
    const hctx = hi.getContext('2d', { willReadFrequently: true });
    hctx.globalCompositeOperation = 'source-over';
    hctx.drawImage(base, 0, 0);
    bloomMask(hctx, w, h);
    const glow = getScratch(4, w, h);
    const gctx = glow.getContext('2d');
    gctx.globalCompositeOperation = 'source-over';
    gctx.filter = `blur(${Math.max(2, w * 0.006)}px) saturate(1.15)`;
    gctx.drawImage(hi, 0, 0);
    gctx.filter = 'none';
    bctx.globalCompositeOperation = 'lighter';
    bctx.globalAlpha = def.bloom;
    bctx.drawImage(glow, 0, 0);
    bctx.globalAlpha = 1;
    bctx.globalCompositeOperation = 'source-over';
  }

  // --- 6b: vignette.
  const vig = bctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.78);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, `rgba(0,0,0,${def.vig})`);
  bctx.fillStyle = vig;
  bctx.fillRect(0, 0, w, h);

  // --- 6d: fine grain, seeded per panel so a given cover is always the same pixels.
  bctx.globalCompositeOperation = 'overlay';
  bctx.globalAlpha = def.grain;
  const tile = getNoiseTile();
  const ox = ((seed >>> 4) % tile.width) * -1;
  const oy = ((seed >>> 9) % tile.height) * -1;
  for (let y = oy; y < h; y += tile.height) {
    for (let x = ox; x < w; x += tile.width) bctx.drawImage(tile, x, y);
  }
  bctx.globalAlpha = 1;
  bctx.globalCompositeOperation = 'source-over';

  return base;
}
