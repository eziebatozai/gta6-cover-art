// Crop transforms: where a photo sits inside a panel. The crop is a centre (cx, cy in image
// units 0..1) plus a zoom (1 = cover fit). The renderer derives a cover source rect from it,
// honouring the pan and zoom, and clips the drawing to the panel. Crops live on each panel in
// state.panels; these helpers work on any crop object, so the same maths drives drag, wheel
// and keyboard editing.

/**
 * The source rect (in image pixels) that covers a panel of aspect pw/ph for a photo crop, so
 * `drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)` fills the panel exactly.
 */
export function cropToDraw(img, crop, pw, ph) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const panelAspect = pw / ph;
  const imageAspect = iw / ih;

  // Cover fit: the source rect has the panel's aspect and the widest size the image allows.
  let sw;
  let sh;
  if (imageAspect > panelAspect) {
    sh = ih;
    sw = ih * panelAspect;
  } else {
    sw = iw;
    sh = iw / panelAspect;
  }

  const z = Math.max(1, crop.zoom || 1);
  sw /= z;
  sh /= z;

  // Pan: the crop centre (0..1 in image units), clamped so the window stays inside the image.
  const overX = Math.max(0, (iw - sw) / 2);
  const overY = Math.max(0, (ih - sh) / 2);
  const cx = ((crop.cx ?? 0.5) - 0.5) * iw;
  const cy = ((crop.cy ?? 0.5) - 0.5) * ih;
  const sx = Math.min(overX, Math.max(-overX, cx)) + (iw - sw) / 2;
  const sy = Math.min(overY, Math.max(-overY, cy)) + (ih - sh) / 2;

  return { sx, sy, sw, sh };
}

/** Nudges a crop by a drag in panel space (dx, dy in panel units) for a given panel aspect. */
export function panCrop(crop, dxPanel, dyPanel, panelAspect, img) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const z = Math.max(1, crop.zoom || 1);
  const imageAspect = iw / ih;
  // Panel units to image units: moving one panel-width drags the source window by 1/z of the image.
  let dx = dxPanel / z;
  let dy = dyPanel / z;
  if (imageAspect > panelAspect) dx *= imageAspect / panelAspect;
  else dy *= panelAspect / imageAspect;
  return { ...crop, cx: (crop.cx ?? 0.5) + dx, cy: (crop.cy ?? 0.5) + dy };
}

/**
 * Zooms a crop around the panel anchor (fx, fy in panel units 0..1), keeping that image point
 * still under the cursor. clampCrop then bounds the result.
 */
export function zoomCrop(crop, factor, img, panelAspect, fx = 0.5, fy = 0.5) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const z0 = Math.max(1, crop.zoom || 1);
  const z1 = Math.min(4, Math.max(1, z0 * factor));
  if (z1 === z0) return crop;

  const windowAt = (z) => {
    const imageAspect = iw / ih;
    if (imageAspect > panelAspect) return { w: (ih * panelAspect) / z, h: ih / z };
    return { w: iw / z, h: (iw / panelAspect) / z };
  };
  const w0 = windowAt(z0);
  const w1 = windowAt(z1);

  // Window left edge is centre - half width; the anchor sits at left + f * width.
  const centreX0 = (crop.cx ?? 0.5) * iw;
  const centreY0 = (crop.cy ?? 0.5) * ih;
  const anchorX = centreX0 - w0.w / 2 + fx * w0.w;
  const anchorY = centreY0 - w0.h / 2 + fy * w0.h;
  const centreX1 = anchorX - fx * w1.w + w1.w / 2;
  const centreY1 = anchorY - fy * w1.h + w1.h / 2;

  return { cx: centreX1 / iw, cy: centreY1 / ih, zoom: z1 };
}

/**
 * Auto-frame: a starting point that flatters the plate actually shown. `hint` carries the
 * plate's framing bias, its focus point and its zoom range:
 *   - 'low'  (water, road, motel plates): the story sits in the lower two thirds — the frame
 *     centres there and stays wide, so a wide panel never crops the story away;
 *   - 'high' (neon signs, deco parapets): the frame centres just above mid, in the sign band;
 *   - 'centre' (faces, interiors): keep the plate's own focus, mid-frame.
 * The zoom comes from the plate's own range: the frame tightens to the plate, and a hand
 * zoom-out is respected up to the plate's widest storytelling frame.
 */
export function autoFrame(crop, hint = {}) {
  const bias = hint.framing ?? 'centre';
  const fx = hint.focus?.[0] ?? 0.5;
  const fy = hint.focus?.[1] ?? 0.5;
  // Where the frame's centre should sit, in image units, per bias.
  const cyByBias = { low: 0.58, high: 0.42, centre: 0.5 };
  const targetCy = bias === 'centre' ? Math.min(0.66, Math.max(0.36, fy)) : cyByBias[bias] ?? 0.5;
  const zr = hint.zoom ?? [1.12, 1.4];
  const z = Math.max(zr[0], Math.min(zr[1], crop.zoom ?? (zr[0] + zr[1]) / 2));
  return {
    cx: Math.min(0.62, Math.max(0.38, fx + ((crop.cx ?? 0.5) - 0.5) * 0.25)),
    cy: Math.min(0.7, Math.max(0.3, targetCy + ((crop.cy ?? 0.5) - 0.5) * 0.25)),
    zoom: z,
  };
}
