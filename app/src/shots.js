// Deterministic screenshot mode: URL query parameters set up a fixed scene with no interaction.
//   ?shot=cover&size=1920x1080&look=vice&photo=samples/pier.jpg&caption=Neon%20Vice
//   ?shot=editor&photo=samples/boulevard.jpg&caption=Boulevard%20Queen
// `cover` hides the sidebar and fits the finished cover in the viewport (letterboxed);
// `editor` shows the full editor with the photos loaded and a rendered preview. Everything
// renders from the seed (or the default seed when none is given), never Math.random, so the
// same URL always paints the same pixels. window.__shotReady is set once painted.

import { seedFromString } from './rng.js';

export async function runShot(shot, query, editor) {
  const { state } = editor;

  if (shot === 'cover') document.body.classList.add('shot-cover');

  const size = query.get('size');
  if (size && stateSizeOk(size)) state.size = size;
  const look = query.get('look');
  if (look) state.look = look;
  const layout = query.get('layout');
  if (layout) state.layout = layout;
  const art = query.get('art');
  if (art === '0') state.artPanel = false;
  const seed = query.get('seed');
  if (seed) {
    const n = Number(seed);
    state.seed = Number.isFinite(n) && n >= 0 ? n >>> 0 : hashSeed(seed);
  }

  const caption = query.get('caption');
  if (caption !== null) state.headline = caption.slice(0, 26);
  const tagline = query.get('tagline');
  if (tagline !== null) state.tagline = tagline.slice(0, 64);
  const credit = query.get('credit');
  if (credit !== null) state.credit = credit.slice(0, 64);

  await editor.addPhotoUrls(query.getAll('photo').map(pathToAppUrl));
  if (caption !== null || tagline !== null || credit !== null) editor.render();

  // Wait for the fonts and two frames, then tell the screenshot driver the canvas is set.
  await document.fonts.ready;
  await nextFrame();
  await nextFrame();
  window.__shotReady = true;
}

function stateSizeOk(size) {
  return ['1080x1080', '1080x1350', '1920x1080'].includes(size);
}

function pathToAppUrl(path) {
  if (/^data:/i.test(path)) return path;
  // Sample paths and any app-relative path resolve against the app root (index.html's folder).
  return new URL(`../${path.replace(/^\.?\//, '')}`, import.meta.url).href;
}

function hashSeed(text) {
  return seedFromString(text);
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
