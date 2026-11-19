// Deterministic screenshot mode: URL query parameters set up a fixed scene with no interaction.
//   ?shot=cover&size=1920x1080&layout=collage&seed=7&plates=car,marina,neon,carlyle,motel,pier26,water
//   ?shot=editor&photo=samples/route-motel.jpg&panel=1
// `cover` hides both sidebars and fits the finished cover in the viewport (letterboxed);
// `editor` shows the full editor with the photos loaded, a panel preselected and the live
// preview. Parameters: size, layout, look, seed, headline, script, quote, cite, chips, credit,
// stars=0, art=0, plates (comma list of plate keys / 'art' / 'user' in panel order), looks
// (comma list of look names per panel), photo (app-relative path, repeatable, loaded as the
// person's own photo), panel (preselect index). Everything renders from the seed, never
// Math.random, so the same URL always paints the same pixels. window.__shotReady is set once
// the canvas has painted.

import { seedFromString } from './rng.js';
import { LOOKS, rebuildPanels } from './state.js';
import { PLATES, ART_PLATE, plateByKey } from './plates.js';

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
  let userIndex = 0;
  state.panels.forEach((panel, i) => {
    const fill = plateList[i];
    if (fill) {
      if (fill === 'user') {
        const photo = state.photos[userIndex++];
        if (photo) {
          panel.fill = photo.id;
          panel.label = { name: (photo.name || 'YOUR PHOTO').toUpperCase(), sub: 'FROM YOUR CAMERA ROLL' };
        }
      } else if (fill === 'art') {
        panel.fill = 'art';
        panel.label = { name: ART_PLATE.name, sub: ART_PLATE.time };
      } else if (plateKeys.has(fill)) {
        panel.fill = fill;
        const plate = plateByKey(fill);
        panel.label = { name: plate.name, sub: plate.time };
      }
    }
    if (lookList[i] && LOOKS.includes(lookList[i])) panel.look = lookList[i];
  });

  // Preselect a panel so the editor shot shows the selection outline and panel controls.
  const panelRaw = query.get('panel');
  const panel = panelRaw === null ? NaN : Number(panelRaw);
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
