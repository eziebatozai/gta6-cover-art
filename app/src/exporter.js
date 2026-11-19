// Export: the cover rendered at the exact chosen size, downloaded as a PNG with a sensible
// name (headline, the poster's key-light look and the pixel size). `onPhase` lets the editor
// show progress during the work, and the rendered canvas is created fresh per export so the
// editor preview never shares buffers with the file.

import { renderCover } from './cover-renderer.js';
import { SIZES, slug } from './state.js';

/** Renders the cover off-screen at the state's exact export size and returns a PNG blob. */
export async function renderExportBlob(state, onPhase) {
  await document.fonts.ready;
  const { w, h } = SIZES[state.size] ?? SIZES['1080x1080'];
  onPhase?.('render');
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  renderCover(canvas, state);
  onPhase?.('encode');
  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG encoding failed'))), 'image/png');
  });
}

/** Renders and downloads the cover; returns the filename it was saved as. */
export async function downloadCover(state, onPhase) {
  const blob = await renderExportBlob(state, onPhase);
  const { w, h } = SIZES[state.size] ?? SIZES['1080x1080'];
  const name = `vice-forge-${slug(state.headline)}-${state.look ?? 'vice'}-${w}x${h}.png`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return name;
}
