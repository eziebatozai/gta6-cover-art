// Deterministic screenshot mode: URL query parameters set up a fixed scene with no interaction.
//   ?shot=cover&size=1920x1080&layout=collage&seed=7&plates=car,marina,neon,carlyle,motel,pier26,water
//   ?shot=editor&photo=samples/route-motel.jpg&panel=1
// `cover` hides both sidebars and fits the finished cover in the viewport (letterboxed);
// `editor` shows the full editor with the photos loaded, a panel preselected and the live
// preview. Parameters: size, layout, look, seed, headline, script, quote, cite, chips, credit,
// stars=0, art=0, plates (comma list of plate keys / 'art' / 'user' in panel order), looks
// (comma list of look names per panel), crops (semicolon list of "i:cx,cy,zoom" pins per
// panel, for recipes that must pin an exact frame), photo (app-relative path, repeatable,
// loaded as the person's own photo), panel (preselect index, default 0 in the editor).
// Everything renders
// from the seed, never the platform's random, so the same URL always paints the same pixels.
// Locator labels follow the fills automatically (each plate owns its name and time line), so
// a recipe never has to spell them out. window.__shotReady is set once the canvas has painted.

import { seedFromString } from './rng.js';
import { LOOKS, rebuildPanels, cropForFill, clampCrop } from './state.js';
import { PLATES } from './plates.js';

export async function runShot(shot, query, editor) {
  const { state } = editor;

  if (shot === 'cover') document.body.classList.add('shot-cover');
  if (shot === 'editor') document.body.classList.add('shot-editor');

  const size = query.get('size');
  if (size && ['1080x1080', '1080x1350', '1920x1080'].includes(size)) state.size = size;
  const layout = query.get('layout');
  if (layout && ['collage', 'poster-grid', 'triptych'].includes(layout)) state.layout = layout;
  const look = query.get('look');
  if (look && LOOKS.includes(look)) state.look = look;
  if (query.get('art') === '0') state.artPanel = false;
  if (query.get('stars') === '0') state.stars = false;
  const seed = query.get('seed');
  if (seed) {
    const n = Number(seed);
    state.seed = Number.isFinite(n) && n >= 0 ? n >>> 0 : seedFromString(seed);
  }

  const text = (key, max) => {
    const v = query.get(key);
    if (v !== null) state[key] = v.slice(0, max);
  };
  text('headline', 40);
  text('script', 42);
  text('quote', 60);
  text('cite', 30);
  text('chips', 80);
  text('credit', 72);

  // The person's own photos for this shot (loaded from the app's own sample files).
  await editor.addPhotoPaths(query.getAll('photo'));

  // Rebuild panels with the new seed, then apply the forced fills / looks in panel order.
  rebuildPanels(state);

  const plateKeys = new Set(PLATES.map((p) => p.key));
  const plates = query.get('plates');
  const plateList = plates ? plates.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const looks = query.get('looks');
  const lookList = looks ? looks.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const zooms = query.get('zooms');
  const zoomList = zooms ? zooms.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n >= 1) : [];
  // Exact frame pins: "crops=0:0.5,0.5,1.0;4:0.46,0.56,1.05".
  const cropsRaw = query.get('crops');
  const cropPins = new Map();
  for (const part of (cropsRaw ? cropsRaw.split(';') : [])) {
    const m = /^\s*(\d+)\s*:\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*$/.exec(part);
    if (m) cropPins.set(Number(m[1]), { cx: Number(m[2]), cy: Number(m[3]), zoom: Number(m[4]) });
  }
  let userIndex = 0;
  const forced = [];
  state.panels.forEach((panel, i) => {
    const fill = plateList[i];
    if (fill) {
      forced[i] = true;
      if (fill === 'user') {
        const photo = state.photos[userIndex++];
        if (photo) {
          panel.fill = photo.id;
          panel.label = { name: (photo.name || 'YOUR PHOTO').toUpperCase(), sub: 'FROM YOUR CAMERA ROLL' };
        }
      } else if (fill === 'art') {
        panel.fill = 'art';
        panel.label = { name: 'VICE SUNSET', sub: 'NOW SHOWING · ALL NIGHT' };
      } else if (plateKeys.has(fill)) {
        // Just set the fill: the label is derived from the plate at draw time, so it can
        // never drift away from the photo beside it.
        panel.fill = fill;
        panel.label = null;
      }
    }
    if (lookList[i] && LOOKS.includes(lookList[i])) panel.look = lookList[i];
  });
  // A forced fill re-seeds the crop for the plate actually shown, so a panel never keeps the
  // framing of a different photo.
  state.panels.forEach((panel, i) => {
    if (forced[i] && panel.fill !== 'wash') panel.crop = cropForFill(panel.fill, state.seed + i * 131);
    // A recipe-pinned zoom wins, clamped like any crop so the frame stays on the photo.
    if (zoomList[i] !== undefined) panel.crop = clampCrop({ ...panel.crop, zoom: zoomList[i] });
    // An exact frame pin wins over everything, clamped like any crop.
    const pin = cropPins.get(i);
    if (pin) panel.crop = clampCrop(pin);
  });

  // Preselect a panel so the editor shot shows the selection outline and panel controls.
  const panelRaw = query.get('panel');
  const panel = panelRaw === null ? (shot === 'editor' ? 0 : NaN) : Number(panelRaw);
  if (Number.isInteger(panel) && panel >= 0 && panel < state.panels.length) {
    state.selectedPanel = panel;
  }

  editor.renderTray();
  editor.render();

  // Wait for the fonts and two frames, then tell the screenshot driver the canvas is set.
  await document.fonts.ready;
  await nextFrame();
  await nextFrame();
  window.__shotReady = true;
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
