// Lettering: the poster's type stack. A big arched Anton headline with a thick cream outline,
// a warm gradient fill and a dark drop shadow; a tracked Bebas Neue tagline helper; the letter
// palettes that tie type colours to the active look. The caption band composes these.

const LETTER_PALETTES = {
  sunset: { ink: '#251238', accent: '#ff7a3c', accent2: '#b3269c', quote: '#8a3c12' },
  neon: { ink: '#0c0a1e', accent: '#2ee6ff', accent2: '#ff20a0', quote: '#1c2f8f' },
  vice: { ink: '#1c1030', accent: '#ff77c8', accent2: '#22d3ee', quote: '#7a1e6e' },
  heat: { ink: '#20080a', accent: '#ffb54d', accent2: '#d94f1e', quote: '#8a2410' },
  noir: { ink: '#0b0b10', accent: '#c9cad6', accent2: '#6a6a78', quote: '#3c3c48' },
};

/** Palette for a look (the poster cream and the warm gradient are look-independent). */
export function letterPalette(lookName) {
  return LETTER_PALETTES[lookName] ?? LETTER_PALETTES.vice;
}

export const POSTER_CREAM = '#faf6ec';
export const OUTLINE_CREAM = '#fdf8ea';

/**
 * Fits one line of arched Anton inside maxW/maxH: returns the font size that fits both the
 * width (with tracking) and the block height (cap height + arc).
 */
export function fitArcLine(ctx, text, maxW, maxH, sagRatio = 0.08) {
  const probe = 100;
  ctx.font = `${probe}px Anton`;
  ctx.letterSpacing = `${probe * 0.015}px`;
  const w0 = ctx.measureText(text).width;
  const sizeW = w0 > 0 ? (probe * maxW) / w0 : probe;
  const sizeH = maxH / (1 + sagRatio + 0.04);
  ctx.letterSpacing = '0px';
  return Math.max(8, Math.min(sizeW, sizeH));
}

/**
 * Draws one arched line of Anton caps centred at cx with its cap tops starting at y. Paints a
 * dark drop shadow, the thick cream outline, the warm gradient fill and an inner highlight.
 * Returns the block height used (cap + arc).
 */
export function drawArcLine(ctx, raw, cx, y, size, opts = {}) {
  const text = String(raw || '').toUpperCase();
  if (!text) return 0;
  const sag = size * (opts.sagRatio ?? 0.08);
  const cap = size * 0.73;
  const outline = opts.outline ?? Math.max(2, size * 0.12);
  const grad = opts.gradient ?? [
    { at: 0, color: '#fff5d2' },
    { at: 0.48, color: '#ffbe62' },
    { at: 1, color: '#d84f18' },
  ];
  const ink = opts.ink ?? '#1d1026';

  ctx.save();
  ctx.font = `${size}px Anton`;
  ctx.letterSpacing = `${size * 0.012}px`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const track = size * 0.012;
  const total = widths.reduce((a, b) => a + b, 0) + track * (chars.length - 1);
  let x = cx - total / 2;

  for (let i = 0; i < chars.length; i++) {
    const tMid = total > 0 ? (x + widths[i] / 2 - (cx - total / 2)) / total : 0.5;
    const arc = 4 * sag * tMid * (1 - tMid); // parabola: 0 at the ends, sag at the centre
    const baseY = y + cap + sag - arc;
    const tilt = (0.5 - tMid) * 0.08; // glyphs lean with the arc tangent

    ctx.save();
    ctx.translate(x + widths[i] / 2, baseY);
    ctx.rotate(-tilt);
    ctx.transform(1, 0, -0.06, 1, 0, 0); // the poster's slight italic shear
    ctx.translate(-widths[i] / 2, 0);
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;

    // Drop shadow: the whole letter shape, dark, soft, offset down. A low blur and a stroke
    // barely wider than the cream outline keep the shadow from climbing above the cap height
    // into the row above.
    ctx.shadowColor = 'rgba(24,10,30,0.55)';
    ctx.shadowBlur = size * 0.05;
    ctx.shadowOffsetY = size * 0.07;
    ctx.strokeStyle = ink;
    ctx.lineWidth = outline * 1.25;
    ctx.strokeText(chars[i], 0, 0);
    ctx.shadowColor = 'rgba(24,10,30,0.3)';
    ctx.shadowBlur = size * 0.02;
    ctx.shadowOffsetY = size * 0.1;
    ctx.strokeText(chars[i], 0, 0);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Thick cream outline.
    ctx.strokeStyle = OUTLINE_CREAM;
    ctx.lineWidth = outline;
    ctx.strokeText(chars[i], 0, 0);

    // Warm gradient fill.
    const g = ctx.createLinearGradient(0, -cap, 0, size * 0.04);
    for (const stop of grad) g.addColorStop(stop.at, stop.color);
    ctx.fillStyle = g;
    ctx.fillText(chars[i], 0, 0);

    // Inner highlight: a light kiss along the top of each glyph.
    const hi = ctx.createLinearGradient(0, -cap, 0, -cap * 0.3);
    hi.addColorStop(0, 'rgba(255,255,255,0.5)');
    hi.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hi;
    ctx.fillText(chars[i], 0, 0);

    ctx.restore();
    x += widths[i] + track;
  }
  ctx.letterSpacing = '0px';
  ctx.restore();
  return cap + sag * 2 + size * 0.05;
}

/** The tagline helper: small tracked condensed caps, used by the credit strip. */
export function trackedCaps(ctx, text, size, trackRatio = 0.32) {
  ctx.font = `${size}px "Bebas Neue"`;
  ctx.letterSpacing = `${size * trackRatio}px`;
}
