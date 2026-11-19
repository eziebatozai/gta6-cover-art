// Scene plates: the eight built-in photographs the poster collage draws from, plus the one
// procedural "VICE SUNSET" art panel as an optional extra choice. Plates are plain image files
// under ./samples; they are preloaded once into an image cache the renderer reads from.

import { loadImage } from './media.js';

export const PLATES = [
  { key: 'car',     name: 'IN THE CAR',      file: 'samples/boulevard.jpg',     time: '9:40 PM · LAST LAP',              focus: [0.52, 0.42] },
  { key: 'angler',  name: 'THE ANGLER',      file: 'samples/pier.jpg',          time: '6:12 PM · LAST CAST',             focus: [0.5, 0.4] },
  { key: 'neon',    name: 'NEON BOULEVARD',  file: 'samples/neon-boulevard.jpg', time: '11:05 PM · OCEAN DRIVE',         focus: [0.5, 0.42] },
  { key: 'carlyle', name: 'DECO CARLYLE',    file: 'samples/deco-carlyle.jpg',  time: 'MIDNIGHT · DECO DISTRICT',        focus: [0.5, 0.58] },
  { key: 'motel',   name: 'ROUTE MOTEL',     file: 'samples/route-motel.jpg',   time: '7:58 PM · VACANCY',               focus: [0.52, 0.38] },
  { key: 'pier26',  name: 'PIER 26',         file: 'samples/pier-26.jpg',       time: 'SUNSET · PIER 26',                focus: [0.5, 0.42] },
  { key: 'marina',  name: 'MARINA NIGHTS',   file: 'samples/marina-nights.jpg', time: '2:14 AM · DOCK 7',                focus: [0.5, 0.62] },
  { key: 'water',   name: 'SUNSET WATER',    file: 'samples/sunset-water.jpg',  time: '8:31 PM · GOLDEN HOUR',           focus: [0.5, 0.52] },
];

/** The procedural extra: the drawn sunset panel's plate identity. */
export const ART_PLATE = { key: 'art', name: 'VICE SUNSET', file: null, time: 'NOW SHOWING · ALL NIGHT' };

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
