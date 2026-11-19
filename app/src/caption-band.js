// The caption band: the bottom of the poster, where the cover sells itself. A top row of chips
// ("VOL. 06") and a 5-star row with a short press quote sit tight against the top of the band,
// then the huge arched Anton headline with a thick cream outline and warm gradient fill, a
// clearly readable Pacifico script accent, and (below the band) the thin credit strip.
// The band owns about 20% of the poster so the collage owns the rest. Everything is anchored
// to a 1080-unit scale so 1920x1080, 1080x1080 and 1080x1350 all compose properly instead of
// merely re-scaling.

import { drawArcLine, fitArcLine, trackedCaps, POSTER_CREAM } from './lettering.js';

/** Geometry: the band's height and the credit strip's height for a poster of W x H. */
export function captionGeometry(W, H) {
  const unit = Math.min(W, H) / 1080;
  const creditH = Math.max(22, Math.round(30 * unit));
  // The wide cinema cover gives the collage a little more room; the portrait formats keep a
  // touch more band so the headline never feels cramped.
  const bandH = Math.round(H * (H >= W ? 0.205 : 0.215));
  return { bandH, creditH };
}

/** The credit strip: a full-bleed dark bar at the very bottom with small tracked caps. */
export function drawCreditStrip(ctx, W, H, raw, pal) {
  const text = String(raw || '').trim().slice(0, 72);
  const unit = Math.min(W, H) / 1080;
  const barH = Math.max(20, Math.round(30 * unit));
  ctx.save();
  ctx.fillStyle = pal.ink;
  ctx.fillRect(0, H - barH, W, barH);
  // A hairline cream rule along the strip's top edge — a print detail tying it to the poster.
  ctx.fillStyle = 'rgba(250,244,230,0.28)';
  ctx.fillRect(0, H - barH, W, Math.max(1, Math.round(unit)));
  if (text) {
    const size = barH * 0.5;
    trackedCaps(ctx, text, size, 0.34);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(250,244,230,0.94)';
    ctx.fillText(text, W / 2, H - barH * 0.5, W * 0.95);
    ctx.letterSpacing = '0px';
  }
  ctx.restore();
  return barH;
}

/** One five-point star path, used by the rating row. */
function starPath(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(ang) * rad;
    const y = cy + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** The "EST. 2026" rosette: a scalloped seal with two lines of tiny caps inside. */
function drawRosette(ctx, cx, cy, R, pal) {
  ctx.save();
  // Scalloped outer edge: arcs bulging out around a circle.
  const bumps = 11;
  ctx.beginPath();
  for (let i = 0; i <= bumps; i++) {
    const a0 = (i / bumps) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 0.5) / bumps) * Math.PI * 2 - Math.PI / 2;
    const a2 = ((i + 1) / bumps) * Math.PI * 2 - Math.PI / 2;
    if (i === 0) ctx.moveTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R);
    ctx.quadraticCurveTo(
      cx + Math.cos(a1) * R * 1.12,
      cy + Math.sin(a1) * R * 1.12,
      cx + Math.cos(a2) * R,
      cy + Math.sin(a2) * R,
    );
  }
  ctx.closePath();
  ctx.fillStyle = pal.ink;
  ctx.fill();
  ctx.strokeStyle = POSTER_CREAM;
  ctx.lineWidth = Math.max(1.5, R * 0.07);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.8, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(250,244,230,0.55)';
  ctx.lineWidth = Math.max(1, R * 0.035);
  ctx.stroke();

  ctx.fillStyle = POSTER_CREAM;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `${R * 0.38}px "Bebas Neue"`;
  ctx.letterSpacing = `${R * 0.1}px`;
  ctx.fillText('EST.', cx, cy - R * 0.06);
  ctx.font = `${R * 0.56}px "Bebas Neue"`;
  ctx.letterSpacing = `${R * 0.06}px`;
  ctx.fillText('2026', cx, cy + R * 0.52);
  ctx.letterSpacing = '0px';
  ctx.restore();
}

/** A row of chips: dark pills with cream tracked caps. */
function drawChips(ctx, x, cy, chipTexts, size, pal) {
  let cx = x;
  ctx.save();
  ctx.textBaseline = 'middle';
  for (const raw of chipTexts) {
    const text = String(raw || '').trim().toUpperCase().slice(0, 24);
    if (!text) continue;
    ctx.font = `${size}px "Bebas Neue"`;
    ctx.letterSpacing = `${size * 0.18}px`;
    const tw = ctx.measureText(text).width;
    const padX = size * 0.8;
    const bw = tw + padX * 2 + size * 0.18;
    const bh = size * 1.9;
    const by = cy - bh / 2;
    ctx.fillStyle = pal.ink;
    ctx.beginPath();
    ctx.roundRect(cx, by, bw, bh, bh * 0.5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(29,16,38,0.25)';
    ctx.lineWidth = Math.max(1, size * 0.07);
    ctx.stroke();
    ctx.fillStyle = POSTER_CREAM;
    ctx.fillText(text, cx + padX, cy + size * 0.08);
    cx += bw + size * 0.7;
  }
  ctx.letterSpacing = '0px';
  ctx.restore();
  return cx - x;
}

/**
 * Fits the headline: the larger of a single line and a balanced two-line split, both within
 * the band's headline box (up to 82% of the poster width, tall enough for the band).
 */
function fitHeadline(ctx, headline, maxW, maxH) {
  const one = fitArcLine(ctx, headline, maxW, maxH);
  let best = { lines: [headline], size: one };
  if (!headline.includes(' ')) return best;
  const words = headline.split(' ');
  let bestAt = -1;
  let bestDiff = Infinity;
  let acc = 0;
  const half = [...headline].length / 2;
  for (let i = 0; i < words.length - 1; i++) {
    acc += words[i].length + 1;
    const diff = Math.abs(acc - half);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestAt = i;
    }
  }
  if (bestAt < 0) return best;
  const two = [words.slice(0, bestAt + 1).join(' '), words.slice(bestAt + 1).join(' ')];
  if (!two[0] || !two[1]) return best;
  const s2 = Math.min(fitArcLine(ctx, two[0], maxW, maxH * 0.52), fitArcLine(ctx, two[1], maxW, maxH * 0.52));
  if (s2 > best.size * 1.12) best = { lines: two, size: s2 };
  return best;
}

/**
 * Draws the whole caption band into rect (x, y, w, h) on the poster cream. Returns nothing;
 * geometry was fixed by captionGeometry, so the caller reserved exactly this space.
 */
export function drawCaptionBand(ctx, x, y, w, h, state, pal) {
  const cx = x + w / 2;
  // Anchor the band's type scale to the poster's short side, 1080 = 1:1.
  const unit = Math.min(w, ctx.canvas.height) / 1080;
  const padTop = Math.round(12 * unit);   // chips/stars tight against the top of the band
  const topRowH = Math.round(26 * unit);
  const gap = Math.round(26 * unit);      // the guaranteed gap under the top row
  const scriptH = Math.round(34 * unit);
  const padBottom = Math.round(8 * unit);
  const topY = y + padTop;
  const topCy = topY + topRowH * 0.5;

  // --- top row: chips (left), stars + quote (centre), rosette (right).
  const rosetteR = Math.max(topRowH * 0.62, 19 * unit);
  const chipsTexts = String(state.chips ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const chipSize = Math.min(topRowH * 0.52, 13.5 * unit);
  const usedRight = rosetteR * 2.3;

  const quote = String(state.quote ?? '').trim().toUpperCase().slice(0, 60);
  const cite = String(state.cite ?? '').trim().toUpperCase().slice(0, 30);
  const quoteText = quote ? (cite ? `${quote} \u2014 ${cite}` : quote) : '';
  const starSize = topRowH * 0.46;
  const starsW = state.stars === false ? 0 : starSize * 6.2;
  const centreX0 = x + w * 0.05 + (chipsTexts.length ? w * 0.16 : 0);
  const centreX1 = x + w * 0.95 - usedRight;
  const centreW = Math.max(w * 0.18, centreX1 - centreX0);

  // Quote type fits its slice of the row, shrinking before it would ever collide.
  let qSize = topRowH * 0.5;
  ctx.save();
  ctx.globalAlpha = 0.999; // measure with real fonts
  trackedCaps(ctx, quoteText, qSize, 0.14);
  const qw0 = ctx.measureText(quoteText).width + starsW;
  ctx.letterSpacing = '0px';
  if (qw0 > centreW) qSize = Math.max(8, (qSize * centreW) / qw0);
  const qW = (() => {
    trackedCaps(ctx, quoteText, qSize, 0.14);
    const tw = ctx.measureText(quoteText).width;
    ctx.letterSpacing = '0px';
    return tw;
  })();
  const starsStart = centreX0 + (centreW - (qW + starsW)) / 2;
  if (quoteText) {
    ctx.font = `${qSize}px "Bebas Neue"`;
    ctx.letterSpacing = `${qSize * 0.14}px`;
    ctx.fillStyle = pal.quote;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(quoteText, starsStart + starsW, topCy + qSize * 0.06);
    ctx.letterSpacing = '0px';
  }
  if (starsW) {
    ctx.fillStyle = '#e8a03c';
    for (let i = 0; i < 5; i++) {
      starPath(ctx, starsStart + starSize * (0.6 + i * 1.1), topCy, starSize * 0.55);
      ctx.fill();
    }
  }
  ctx.restore();

  if (chipsTexts.length) drawChips(ctx, x + w * 0.05, topCy, chipsTexts, chipSize, pal);
  drawRosette(ctx, x + w * 0.95 - rosetteR, topCy, rosetteR, pal);

  // --- headline: up to 82% of the poster width, auto-fit to one or two balanced lines.
  const headY = topY + topRowH + gap;
  const headMaxH = h - (headY - y) - scriptH - padBottom;
  const headMaxW = w * 0.82;
  const headline = String(state.headline ?? '').toUpperCase().slice(0, 40);
  if (headline) {
    const { lines, size } = fitHeadline(ctx, headline, headMaxW, headMaxH);
    const lineGap = size * 0.08;
    let by = headY;
    for (const line of lines) {
      drawArcLine(ctx, line, cx, by, size, { ink: pal.ink });
      by += size * 1.02 + lineGap;
    }
  }

  // --- script accent under the headline, Pacifico, readable at ~28-34 px on a 1080 poster.
  const scriptText = String(state.script ?? '').trim().slice(0, 42);
  if (scriptText) {
    ctx.save();
    const sBase = 31 * unit;
    let sSize = Math.max(27 * unit, Math.min(34 * unit, sBase));
    ctx.font = `${sSize}px Pacifico`;
    ctx.textAlign = 'center';
    let sw = ctx.measureText(scriptText).width;
    if (sw > headMaxW) {
      sSize = Math.max(22 * unit, (sSize * headMaxW) / sw);
      ctx.font = `${sSize}px Pacifico`;
    }
    const sY = y + h - padBottom - sSize * 0.18;
    ctx.translate(cx, sY);
    ctx.rotate(-0.022);
    ctx.shadowColor = 'rgba(30,10,30,0.28)';
    ctx.shadowBlur = sSize * 0.12;
    ctx.shadowOffsetY = sSize * 0.06;
    ctx.fillStyle = pal.accent;
    ctx.fillText(scriptText, 0, 0);
    ctx.shadowColor = 'transparent';
    ctx.restore();
  }
}
