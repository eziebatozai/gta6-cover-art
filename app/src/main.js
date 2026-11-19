// Page entry: builds the editor, or runs deterministic shot mode when ?shot= is present.
// The two poster faces ship under app/fonts (OFL-licensed), so wait for them before the
// first paint — otherwise the arched headline measures in a fallback font.

import { createEditor } from './ui.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const editor = createEditor(canvas);
const query = new URLSearchParams(location.search);
const shot = query.get('shot');

await Promise.all([
  document.fonts.load('100px Anton'),
  document.fonts.load('100px "Bebas Neue"'),
]);
await document.fonts.ready;
editor.render();

if (shot) {
  await runShot(shot, query, editor);
}
