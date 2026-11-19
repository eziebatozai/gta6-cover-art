// Scene plates: the eight built-in photographs the poster collage draws from, plus the one
// procedural "VICE SUNSET" art panel as an optional extra choice. Plates are plain image files
// under ./samples; they are preloaded once into an image cache the renderer reads from.
// Each plate also carries a framing hint ('centre' faces, 'low' water/road/pier shots whose
// interest sits in the lower-middle third, 'high' neon signs and skylines) so crops and
// auto-frame keep the empty-sky bands out of wide panels.

import { loadImage } from './media.js';

export const PLATES = [
  { key: 'car',     name: 'IN THE CAR',     file: 'samples/boulevard.jpg',      time: '9:40 PM · LAST LAP',       framing: 'centre', focus: [0.52, 0.45] },
  { key: 'angler',  name: 'THE ANGLER',     file: 'samples/pier.jpg',           time: '6:12 PM · LAST CAST',      framing: 'centre', focus: [0.42, 0.45] },
  { key: 'neon',    name: 'NEON BOULEVARD', file: 'samples/neon-boulevard.jpg', time: '11:05 PM · OCEAN DRIVE',   framing: 'high',   focus: [0.5, 0.38], zoom: [1.0, 1.12] },
  { key: 'carlyle', name: 'DECO CARLYLE',   file: 'samples/deco-carlyle.jpg',   time: 'MIDNIGHT · DECO DISTRICT', framing: 'high',   focus: [0.5, 0.5] },
  { key: 'motel',   name: 'ROUTE MOTEL',    file: 'samples/route-motel.jpg',    time: '7:58 PM · VACANCY',        framing: 'high',   focus: [0.44, 0.36] },
  { key: 'pier26',  name: 'PIER 26',        file: 'samples/pier-26.jpg',        time: 'SUNSET · PIER 26',         framing: 'low',    focus: [0.5, 0.62] },
  { key: 'marina',  name: 'MARINA NIGHTS',  file: 'samples/marina-nights.jpg',  time: '2:14 AM · DOCK 7',         framing: 'low',    focus: [0.5, 0.68] },
  { key: 'water',   name: 'SUNSET WATER',   file: 'samples/sunset-water.jpg',   time: '8:31 PM · GOLDEN HOUR',    framing: 'low',    focus: [0.5, 0.55] },
];

/** The procedural extra: the drawn sunset panel's plate identity. */
export const ART_PLATE = { key: 'art', name: 'VICE SUNSET', file: null, time: 'NOW SHOWING · ALL NIGHT', framing: 'centre', focus: [0.5, 0.5] };

/** Every fill choice the panel inspector offers, in tray order (art last). */
export function allPlateChoices() {
  return [...PLATES, ART_PLATE];
}

export function plateByKey(key) {
  return PLATES.find((p) => p.key === key) ?? null;
}

const cache = new Map();

/** Preloads every plate image; the first render waits for this so no panel starts blank. */
export async function preloadPlates() {
  await Promise.all(
    PLATES.map(async (p) => {
      if (!cache.has(p.key)) cache.set(p.key, await loadImage(p.file));
    }),
  );
}

/** The decoded image for a plate key, or null if it is not (yet) loaded. */
export function plateImage(key) {
  return cache.get(key) ?? null;
}
