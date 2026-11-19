// Lettering: the poster type stack. A big arched Anton headline with a thick ink stroke, a
// vertical gradient fill and an inner highlight; a tracked Bebas Neue tagline; a small badge
// pill and the bottom credit strip. Colours follow the active look so the type sits in the art.

const LETTER_PALETTES = {
  sunset: { top: '#fff3d6', mid: '#ffb457', deep: '#93360f', ink: '#251238', stroke: '#251238', accent: '#ff7a3c', accent2: '#b3269c' },
  neon: { top: '#e8fbff', mid: '#2ee6ff', deep: '#274bd6', ink: '#0c0a1e', stroke: '#0c0a1e', accent: '#2ee6ff', accent2: '#ff20a0' },
  vice: { top: '#ffe3f1', mid: '#ff77c8', deep: '#8a1e6e', ink: '#1c1030', stroke: '#1c1030', accent: '#ff77c8', accent2: '#22d3ee' },
  heat: { top: '#fff0d0', mid: '#ff9b3d', deep: '#8a2410', ink: '#20080a', stroke: '#20080a', accent: '#ffb54d', accent2: '#d94f1e' },
  noir: { top: '#ffffff', mid: '#c9cad6', deep: '#4a4a58', ink: '#0b0b10', stroke: '#0b0b10', accent: '#c9cad6', accent2: '#6a6a78' },
};

/** Palette for a look. */
export function letterPalette(lookName) {
  return LETTER_PALETTES[lookName] ?? LETTER_PALETTES.vice;
}

const MAX_HEADLINE = 26;

/** The headline text, guarded to a sane length and uppercase. */
export function headlineText(raw) {
  return String(raw || '').toUpperCase().slice(0, MAX_HEADLINE);
}

/**
 * Draws the arched headline centred at (cx) with the cap tops starting at y. Fits the text
 * inside maxW and a block height of maxH (arc included), arcs each glyph over the block
 * (centre highest), and paints shadow, ink stroke, gradient fill and an inner highlight.
 * Returns the block height used.
 */
export function drawHeadline(ctx, raw, cx, y, maxW, maxH, lookName) {
  const text = headlineText(raw);
  if (!text) return 0;
  const pal = letterPalette(lookName);

  ctx.save();
  const size0 = Math.max(12, maxW);
  ctx.font = `${size0}px Anton`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.letterSpacing = `${size0 * 0.015}px`;
  const w0 = ctx.measureText(text).width;
  // Fit by width (with tracking) and by height: the arched block is about 1.15 em tall.
  const size = Math.max(8, Math.min(size0, (size0 * maxW) / Math.max(1, w0), maxH / 1.15));
  ctx.font = `${size}px Anton`;
  ctx.letterSpacing = `${size * 0.03}px`;

  // Per-character geometry along a gentle arc that rises in the middle.
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const track = size * 0.03;
  const total = widths.reduce((a, b) => a + b, 0) + track * (chars.length - 1);
  let x = cx - total / 2;
  const sag = size * 0.13; // the arc's drop from centre to ends
  const cap = size * 0.73; // Anton's cap height
  let maxY = y;

  for (let i = 0; i < chars.length; i++) {
    const tMid = (x + widths[i] / 2 - (cx - total / 2)) / Math.max(1, total); // 0..1 across
    const arc = 4 * sag * tMid * (1 - tMid); // parabola: 0 at ends, sag at centre
    // The cap top follows the arc (highest at centre), so the baseline rides it too.
    const baseY = y + cap + sag - arc;
    const tilt = (0.5 - tMid) * 0.10; // radians, glyphs lean with the arc tangent
    maxY = Math.max(maxY, baseY);

    ctx.save();
    ctx.translate(x + widths[i] / 2, baseY);
    ctx.rotate(-tilt);
    ctx.transform(1, 0, -0.07, 1, 0, 0); // the poster's slight italic shear
    ctx.translate(-widths[i] / 2, 0);

    // Drop shadow behind the stroke.
    ctx.shadowColor = 'rgba(15,6,28,0.42)';
    ctx.shadowBlur = size * 0.07;
    ctx.shadowOffsetY = size * 0.035;
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeStyle = pal.stroke;
    ctx.lineWidth = size * 0.12;
    ctx.strokeText(chars[i], 0, 0);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Gradient fill: bright top, mid tone, deep base.
    const g = ctx.createLinearGradient(0, -cap, 0, size * 0.04);
    g.addColorStop(0, pal.top);
    g.addColorStop(0.55, pal.mid);
    g.addColorStop(1, pal.deep);
    ctx.fillStyle = g;
    ctx.fillText(chars[i], 0, 0);

    // Inner highlight: a light kiss along the top of each glyph.
    const hi = ctx.createLinearGradient(0, -cap, 0, -cap * 0.35);
    hi.addColorStop(0, 'rgba(255,255,255,0.5)');
    hi.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hi;
    ctx.fillText(chars[i], 0, 0);

    ctx.restore();
    x += widths[i] + track;
  }
  ctx.restore();
  return maxY - y + size * 0.16;
}

/** The tagline: small tracked condensed caps. `size0` is the desired font size before fitting. */
export function drawTagline(ctx, raw, cx, y, maxW, lookName, size0) {
  const text = String(raw || '').trim().slice(0, 64);
  if (!text) return 0;
  const pal = letterPalette(lookName);
  ctx.save();
  ctx.font = `${size0}px "Bebas Neue"`;
  ctx.letterSpacing = `${size0 * 0.42}px`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const w0 = ctx.measureText(text).width;
  const size = Math.max(7, Math.min(size0, (size0 * maxW) / Math.max(1, w0)));
  ctx.font = `${size}px "Bebas Neue"`;
  ctx.letterSpacing = `${size * 0.42}px`;
  ctx.fillStyle = pal.ink;
  ctx.globalAlpha = 0.85;
  ctx.fillText(text, cx, y + size);
  ctx.globalAlpha = 1;
  ctx.restore();
  return size * 1.15;
}

/** The badge pill above the headline: a small original blurb drawn as shapes + text. */
export function drawBadge(ctx, text, cx, y, h, lookName) {
  const pal = letterPalette(lookName);
  const size = h * 0.52;
  ctx.save();
  ctx.font = `${size}px "Bebas Neue"`;
  ctx.letterSpacing = `${size * 0.3}px`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = String(text || '').slice(0, 32);
  const tw = ctx.measureText(label).width;
  const padX = size * 0.9;
  const bw = tw + padX * 2 + size * 0.3;
  const bh = size * 1.7;
  const bx = cx - bw / 2;
  const by = y - bh / 2;
  const r = bh / 2;

  const g = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
  g.addColorStop(0, pal.accent);
  g.addColorStop(1, pal.accent2);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, r);
  ctx.fill();

  // A thin keyline and a notch, so it reads as printed matter, not a web chip.
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = Math.max(1, h * 0.03);
  ctx.stroke();

  ctx.fillStyle = '#fff';
  ctx.fillText(label, cx, y + size * 0.08);
  ctx.restore();
  return bh;
}

/** The credit strip: a full-bleed dark bar at the very bottom with small tracked caps. */
export function drawCreditStrip(ctx, w, h, raw, lookName) {
  const pal = letterPalette(lookName);
  const text = String(raw || '').trim().slice(0, 64);
  const barH = Math.max(18, Math.round(h * 0.034));
  ctx.save();
  ctx.fillStyle = pal.ink;
  ctx.fillRect(0, h - barH, w, barH);
  if (text) {
    const size = barH * 0.5;
    ctx.font = `${size}px "Bebas Neue"`;
    ctx.letterSpacing = `${size * 0.42}px`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(text, w / 2, h - barH * 0.52, w * 0.94);
  }
  ctx.restore();
  return barH;
}
