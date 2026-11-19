// Page entry: builds the editor, or runs deterministic shot mode when ?shot= is present.
// The three poster faces ship under app/fonts (OFL-licensed, see app/fonts/LICENSES.md), and
// the eight scene plates under app/samples — we wait for both before the first paint, so the
// arched headline measures in the real Anton and no panel starts blank. If loading stalls, a
// timeout renders anyway rather than showing nothing; the export strip reports the wait.

import { createEditor } from './ui.js';
import { preloadPlates } from './plates.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const editor = createEditor(canvas);
const query = new URLSearchParams(location.search);
const shot = query.get('shot');

const statusEl = document.getElementById('status');
if (statusEl) statusEl.textContent = 'Warming the darkroom — fonts & plates…';

const fontsReady = Promise.all([
  document.fonts.load('100px Anton'),
  document.fonts.load('100px "Bebas Neue"'),
  document.fonts.load('100px Pacifico'),
  document.fonts.ready,
]).catch(() => {}); // a stalled font must never blank the poster

await Promise.race([
  Promise.all([fontsReady, preloadPlates()]),
  new Promise((resolve) => setTimeout(resolve, 4000)),
]);
editor.render();

if (shot) {
  await runShot(shot, query, editor);
}
