// Export: the cover rendered at the exact chosen size, downloaded as a PNG with a sensible name.

import { renderCover } from './cover-renderer.js';
import { SIZES, slug } from './state.js';

/** Renders the cover off-screen at the state's exact export size and returns a PNG blob. */
export async function renderExportBlob(state) {
  await document.fonts.ready;
  const { w, h } = SIZES[state.size] ?? SIZES['1080x1080'];
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  renderCover(canvas, state);
  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG encoding failed'))), 'image/png');
  });
}

/** Renders and downloads the cover; returns the filename it was saved as. */
export async function downloadCover(state) {
  const blob = await renderExportBlob(state);
  const name = `vice-forge-${state.size}-${slug(state.headline)}.png`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return name;
}
