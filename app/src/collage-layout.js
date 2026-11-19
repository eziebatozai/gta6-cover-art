// Collage layouts: each returns the panel rectangles in normalised unit space [0,1]x[0,1] of
// the panel region. Rectangles are tight and adjacent; the renderer insets each one by half a
// gutter, so the white gutters between panels are uniform everywhere. The first rect of every
// layout is the hero panel (the big one, top of the poster's reading order).
//
// The flagship "Collage" follows the classic game-poster grid: one big portrait hero panel on
// the left (roughly 40% of the width, the full panel-region height) and a mosaic on the right —
// a wide landscape across the top, two square-ish frames in the middle, a wide one at the
// bottom and a tall narrow strip. Three arrangements, chosen by the region's aspect, so the
// same composition adapts to 1920x1080, 1080x1080 and 1080x1350.

/** Wide-cinema arrangement for a landscape region (the 1920x1080 cover). */
function collageLandscape() {
  return [
    { x: 0.00, y: 0.00, w: 0.38, h: 1.00 }, // hero
    { x: 0.38, y: 0.00, w: 0.62, h: 0.40 }, // wide landscape, top right
    { x: 0.38, y: 0.40, w: 0.22, h: 0.33 }, // square-ish, middle left
    { x: 0.60, y: 0.40, w: 0.22, h: 0.33 }, // square-ish, middle right
    { x: 0.82, y: 0.40, w: 0.18, h: 0.60 }, // tall narrow strip
    { x: 0.38, y: 0.73, w: 0.44, h: 0.27 }, // wide, bottom right
  ];
}

/** Tighter mosaic for a square-ish region (1080x1080) or a portrait one (1080x1350). */
function collageSquare() {
  return [
    { x: 0.00, y: 0.00, w: 0.40, h: 1.00 }, // hero
    { x: 0.40, y: 0.00, w: 0.60, h: 0.30 }, // wide landscape, top right
    { x: 0.40, y: 0.30, w: 0.30, h: 0.38 }, // square-ish, middle left
    { x: 0.70, y: 0.30, w: 0.30, h: 0.38 }, // square-ish, middle right
    { x: 0.40, y: 0.68, w: 0.17, h: 0.32 }, // tall narrow strip
    { x: 0.57, y: 0.68, w: 0.43, h: 0.32 }, // wide, bottom right
  ];
}

/** The flagship poster grid: six mixed-size panels, a magazine collage, hero third from left. */
function posterGrid(aspect) {
  if (aspect < 1.05) {
    return [
      { x: 0.00, y: 0.00, w: 0.40, h: 0.52 },
      { x: 0.40, y: 0.00, w: 0.60, h: 0.25 },
      { x: 0.40, y: 0.25, w: 0.30, h: 0.27 },
      { x: 0.70, y: 0.25, w: 0.30, h: 0.27 },
      { x: 0.00, y: 0.52, w: 0.60, h: 0.48 },
      { x: 0.60, y: 0.52, w: 0.40, h: 0.48 },
    ];
  }
  return [
    { x: 0.00, y: 0.00, w: 0.34, h: 1.00 },
    { x: 0.34, y: 0.00, w: 0.33, h: 0.50 },
    { x: 0.34, y: 0.50, w: 0.33, h: 0.50 },
    { x: 0.67, y: 0.00, w: 0.33, h: 0.34 },
    { x: 0.67, y: 0.34, w: 0.33, h: 0.33 },
    { x: 0.67, y: 0.67, w: 0.33, h: 0.33 },
  ];
}

/** Triptych: three full-height (or full-width) bands. */
function triptych(aspect) {
  if (aspect < 1.05) {
    return [
      { x: 0.00, y: 0.00, w: 1 / 3, h: 1.00 },
      { x: 1 / 3, y: 0.00, w: 1 / 3, h: 1.00 },
      { x: 2 / 3, y: 0.00, w: 1 / 3, h: 1.00 },
    ];
  }
  return [
    { x: 0.00, y: 0.00, w: 1.00, h: 1 / 3 },
    { x: 0.00, y: 1 / 3, w: 1.00, h: 1 / 3 },
    { x: 0.00, y: 2 / 3, w: 1.00, h: 1 / 3 },
  ];
}

const LAYOUT_FNS = {
  collage(aspect) {
    return aspect >= 1.7 ? collageLandscape() : collageSquare();
  },
  'poster-grid': posterGrid,
  triptych,
};

/** Panels for a layout name at a region aspect (width/height). Index 0 is the hero. */
export function layoutPanels(name, aspect) {
  const fn = LAYOUT_FNS[name] ?? LAYOUT_FNS.collage;
  return fn(aspect);
}
