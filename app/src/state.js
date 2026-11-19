// The cover's editable state: photos with crops, panel assignment, layout, size, look and
// lettering. The renderer reads this object and nothing else, so every control just edits it.

import { layoutPanels } from './collage-layout.js';

export const SIZES = {
  '1080x1080': { w: 1080, h: 1080 },
  '1080x1350': { w: 1080, h: 1350 },
  '1920x1080': { w: 1920, h: 1080 },
};

export const LAYOUTS = ['poster-grid', 'triptych', 'hero'];

export const LOOKS = ['sunset', 'neon', 'vice', 'heat', 'noir'];

export const MAX_PHOTOS = 8;

export const DEFAULT_TEXT = {
  headline: 'VICE CITY HEIST',
  tagline: 'ONE NIGHT. TWO KEYS. NO MERCY.',
  credit: 'VICE FORGE \u00b7 ISSUE 01 \u00b7 2026',
};

/** A fresh state with no photos. */
export function makeState() {
  return {
    layout: 'poster-grid',
    size: '1080x1080',
    look: 'vice',
    seed: 0x5eed1a6,
    artPanel: true,
    headline: DEFAULT_TEXT.headline,
    tagline: DEFAULT_TEXT.tagline,
    credit: DEFAULT_TEXT.credit,
    photos: [], // { id, name, img, crop: { cx, cy, zoom } }
    fills: [], // per panel index: photo id | 'art' | 'color'
    selectedPanel: -1,
  };
}

let nextPhotoId = 1;

/** Wraps a loaded image in a photo record with a centred cover crop. */
export function makePhoto(img, name) {
  return {
    id: `p${nextPhotoId++}`,
    name,
    img,
    crop: { cx: 0.5, cy: 0.45, zoom: 1.12 },
  };
}

/** Rebuilds the default panel fills for the current layout: photos in order, art panel in its slot. */
export function refillFills(state, panelCount, artSlot) {
  const fills = new Array(panelCount).fill('color');
  if (state.artPanel && artSlot >= 0) fills[artSlot] = 'art';
  let i = 0;
  for (let p = 0; p < panelCount; p++) {
    if (fills[p] !== 'art' && state.photos.length) {
      fills[p] = state.photos[i % state.photos.length].id;
      i++;
    }
  }
  state.fills = fills;
}

/**
 * Re-assigns fills after a layout or photo change, keeping every choice that still means
 * something (art stays art, loaded photos stay put) and giving the rest a photo in order.
 */
export function reassignFills(state, panelCount, artSlot) {
  const keep = state.photos.map((p) => p.id);
  const old = state.fills ?? [];
  const fills = new Array(panelCount).fill('color');
  if (state.artPanel && artSlot >= 0 && artSlot < panelCount) fills[artSlot] = 'art';
  let next = 0;
  for (let p = 0; p < panelCount; p++) {
    if (fills[p] === 'art') continue;
    const prev = old[p];
    if (keep.includes(prev)) fills[p] = prev;
    else if (state.photos.length) fills[p] = state.photos[next++ % state.photos.length].id;
  }
  state.fills = fills;
}

/** The art panel's slot for a layout at the current aspect. */
export function artSlotFor(layoutName, aspect) {
  return layoutPanels(layoutName, aspect).artSlot;
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
