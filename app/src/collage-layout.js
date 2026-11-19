// Collage layouts: each returns panel rectangles in normalised unit space [0,1]x[0,1] of the
// panel region, plus the slot where the procedurally drawn sunset art panel goes. Rectangles
// are chosen per orientation so the collage composes well square, portrait and landscape.

const PORTRAIT = 'portrait';
const LANDSCAPE = 'landscape';

function mode(aspect) {
  return aspect >= 1 ? LANDSCAPE : PORTRAIT;
}

/** The flagship poster grid: six mixed-size panels, a magazine collage. */
function posterGrid(aspect) {
  if (mode(aspect) === PORTRAIT) {
    return {
      artSlot: 1,
      panels: [
        { x: 0.00, y: 0.00, w: 0.40, h: 0.52 },
        { x: 0.40, y: 0.00, w: 0.60, h: 0.25 },
        { x: 0.40, y: 0.25, w: 0.30, h: 0.27 },
        { x: 0.70, y: 0.25, w: 0.30, h: 0.27 },
        { x: 0.00, y: 0.52, w: 0.60, h: 0.48 },
        { x: 0.60, y: 0.52, w: 0.40, h: 0.48 },
      ],
    };
  }
  return {
    artSlot: 4,
    panels: [
      { x: 0.00, y: 0.00, w: 0.34, h: 1.00 },
      { x: 0.34, y: 0.00, w: 0.33, h: 0.50 },
      { x: 0.34, y: 0.50, w: 0.33, h: 0.50 },
      { x: 0.67, y: 0.00, w: 0.33, h: 0.34 },
      { x: 0.67, y: 0.34, w: 0.33, h: 0.33 },
      { x: 0.67, y: 0.67, w: 0.33, h: 0.33 },
    ],
  };
}

/** Triptych: three wide panels. */
function triptych(aspect) {
  if (mode(aspect) === PORTRAIT) {
    return {
      artSlot: 1,
      panels: [
        { x: 0.00, y: 0.00, w: 1 / 3, h: 1.00 },
        { x: 1 / 3, y: 0.00, w: 1 / 3, h: 1.00 },
        { x: 2 / 3, y: 0.00, w: 1 / 3, h: 1.00 },
      ],
    };
  }
  return {
    artSlot: 1,
    panels: [
      { x: 0.00, y: 0.00, w: 1.00, h: 1 / 3 },
      { x: 0.00, y: 1 / 3, w: 1.00, h: 1 / 3 },
      { x: 0.00, y: 2 / 3, w: 1.00, h: 1 / 3 },
    ],
  };
}

/** Hero: one big panel over three small ones. */
function hero(aspect) {
  if (mode(aspect) === PORTRAIT) {
    return {
      artSlot: 1,
      panels: [
        { x: 0.00, y: 0.00, w: 0.63, h: 1.00 },
        { x: 0.63, y: 0.00, w: 0.37, h: 1 / 3 },
        { x: 0.63, y: 1 / 3, w: 0.37, h: 1 / 3 },
        { x: 0.63, y: 2 / 3, w: 0.37, h: 1 / 3 },
      ],
    };
  }
  return {
    artSlot: 1,
    panels: [
      { x: 0.00, y: 0.00, w: 1.00, h: 0.63 },
      { x: 0.00, y: 0.63, w: 1 / 3, h: 0.37 },
      { x: 1 / 3, y: 0.63, w: 1 / 3, h: 0.37 },
      { x: 2 / 3, y: 0.63, w: 1 / 3, h: 0.37 },
    ],
  };
}

const LAYOUT_FNS = { 'poster-grid': posterGrid, triptych, hero };

/** Panels for a layout name at a region aspect (width/height), with the art panel's slot. */
export function layoutPanels(name, aspect) {
  const fn = LAYOUT_FNS[name] ?? posterGrid;
  return fn(aspect);
}
