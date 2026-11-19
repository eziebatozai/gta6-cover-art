// The cover's editable state: the panel list (each with its fill, look, locator label and
// crop), the user's photos, layout, size, seed and caption text. The renderer reads this
// object and nothing else, so every control just edits it and re-renders.

import { layoutPanels } from './collage-layout.js';
import { PLATES, ART_PLATE, plateByKey } from './plates.js';
import { makeRng, shuffled, between } from './rng.js';

export const SIZES = {
  '1080x1080': { w: 1080, h: 1080 },
  '1080x1350': { w: 1080, h: 1350 },
  '1920x1080': { w: 1920, h: 1080 },
};

export const LAYOUTS = ['collage', 'poster-grid', 'triptych'];

export const LOOKS = ['sunset', 'neon', 'vice', 'heat', 'noir'];

export const DEFAULT_TEXT = {
  headline: 'VICE CITY HEIST',
  script: 'one night in paradise',
  quote: 'A FEVER DREAM IN NEON',
  cite: 'THE COAST HERALD',
  chips: 'VOL. 06, COLLECTOR\u2019S EDITION',
  credit: 'VICE FORGE \u00b7 SHOT ON 35MM \u00b7 DEVELOPED IN THE DARK',
};

/** A fresh state: six panels of the collage, plates dealt from the seed, art panel on. */
export function makeState() {
  const state = {
    layout: 'collage',
    size: '1080x1080',
    look: 'vice',
    seed: 7,
    artPanel: true,
    stars: true,
    headline: DEFAULT_TEXT.headline,
    script: DEFAULT_TEXT.script,
    quote: DEFAULT_TEXT.quote,
    cite: DEFAULT_TEXT.cite,
    chips: DEFAULT_TEXT.chips,
    credit: DEFAULT_TEXT.credit,
    photos: [], // { id, name, img } — the person's own photos, never uploaded
    panels: [], // per panel: { fill, look, label: {name, sub}, crop: {cx, cy, zoom} }
    selectedPanel: -1,
  };
  rebuildPanels(state);
  return state;
}

let nextPhotoId = 1;

/** Wraps a loaded image in a photo record. */
export function makePhoto(img, name) {
  return {
    id: `photo:${nextPhotoId++}`,
    name,
    img,
  };
}

function panelCountOf(state) {
  const { w, h } = SIZES[state.size] ?? SIZES['1080x1080'];
  return layoutPanels(state.layout, w / h).length;
}

/** A believable default crop for a panel: around the plate's focus, a slight punch-in. */
function seededCrop(rng, plate) {
  const fx = plate?.focus?.[0] ?? 0.5;
  const fy = plate?.focus?.[1] ?? 0.44;
  return {
    cx: Math.min(0.62, Math.max(0.38, fx + between(rng, -0.03, 0.03))),
    cy: Math.min(0.66, Math.max(0.34, fy + between(rng, -0.025, 0.025))),
    zoom: between(rng, 1.06, 1.26),
  };
}

/**
 * Per-panel colour looks: a shuffled deck of the five looks dealt round-robin, swapping any
 * repeat that would sit right next to its twin, so neighbouring panels always differ strongly.
 */
function assignLooks(rng, n) {
  const deck = shuffled(rng, LOOKS);
  const looks = [];
  for (let i = 0; i < n; i++) {
    let look = deck[i % deck.length];
    if (i > 0 && look === looks[i - 1]) {
      const j = (i % deck.length + 1) % deck.length;
      look = deck[j];
    }
    looks.push(look);
  }
  // The hero panel carries the poster's key light: warm sunset two times in three.
  if (n > 0 && rng() < 0.72) looks[0] = rng() < 0.55 ? 'sunset' : 'heat';
  return looks;
}

/**
 * Rebuilds the whole panel list from the seed: the hero takes the first user photo when there
 * is one (the poster is the person's photo first), otherwise the IN THE CAR plate; the rest of
 * the mosaic is a seeded shuffle of plates, with the drawn art panel in the last slot when it
 * is switched on. Locator labels default to their plate's name and time line.
 */
export function rebuildPanels(state) {
  const n = panelCountOf(state);
  const rng = makeRng(state.seed ^ 0x5eed1);
  const plates = shuffled(rng, PLATES.map((p) => p.key));
  const pool = [...state.photos.map((p) => p.id), ...plates];

  const fills = new Array(n).fill('wash');
  const used = new Set();
  // Hero: the person's photo if there is one, else the plate that started the series.
  const heroDefault = state.photos.length ? state.photos[0].id : 'car';
  fills[0] = heroDefault;
  used.add(heroDefault);

  let pi = 0;
  for (let i = 1; i < n; i++) {
    while (pi < pool.length && used.has(pool[pi])) pi++;
    if (pi >= pool.length) break;
    fills[i] = pool[pi];
    used.add(pool[pi]);
    pi++;
  }
  if (state.artPanel && n > 1) fills[n - 1] = 'art';

  const looks = assignLooks(rng, n);
  state.panels = fills.map((fill, i) => {
    const plate = plateByKey(fill.replace(/^plate:/, ''));
    return {
      fill,
      look: looks[i],
      label: { name: plate ? plate.name : 'VICE SUNSET', sub: plate ? plate.time : ART_PLATE.time },
      crop: seededCrop(rng, plate),
    };
  });
  if (state.selectedPanel >= n) state.selectedPanel = -1;
}

/** Reshuffle: a new seed re-deals the plates, the looks and the label detail lines. */
export function reshuffle(state) {
  state.seed = (Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0;
  rebuildPanels(state);
}

/** The photo object behind a panel's fill id ('photo:N'), or null. */
export function photoForFill(state, fill) {
  if (typeof fill !== 'string' || !fill.startsWith('photo:')) return null;
  return state.photos.find((p) => p.id === fill) ?? null;
}

/** Clamps a crop so its photo always covers the panel (no white edges from panning). */
export function clampCrop(crop) {
  const z = Math.max(1, crop.zoom);
  const over = (z - 1) / 2; // how far the visible centre may drift, in image units
  return {
    zoom: z,
    cx: Math.min(0.5 + over, Math.max(0.5 - over, crop.cx)),
    cy: Math.min(0.5 + over, Math.max(0.5 - over, crop.cy)),
  };
}

/** Slug used in export filenames. */
export function slug(text) {
  return (text || 'cover').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'cover';
}
