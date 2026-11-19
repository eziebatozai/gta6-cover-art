// The caption band: the bottom of the poster, where the cover sells itself. A top row of chips
// ("VOL. 06"), a 5-star row with a short press quote, an "EST. 2026" rosette badge, then the
// huge arched Anton headline with a thick cream outline and warm gradient fill, and a Pacifico
// script accent under it. Everything auto-fits: two long headline lines still fit the band at
// every poster size, with a guaranteed gap between the top row and the headline.
// Below the band sits a thin full-bleed credit strip in tracked Bebas caps.

import { drawArcLine, fitArcLine, trackedCaps, POSTER_CREAM } from './lettering.js';

/** Geometry: the band's height and the credit strip's height for a poster of W x H. */
export function captionGeometry(W, H) {
  const creditH = Math.max(22, Math.round(Math.min(W, H) * 0.032));
  const bandH = Math.round(H * (H > W ? 0.23 : 0.255));
  return { bandH, creditH };
}

/** The credit strip: a full-bleed dark bar at the very bottom with small tracked caps. */
export function drawCreditStrip(ctx, W, H, raw, pal) {
  const text = String(raw || '').trim().slice(0, 72);
  const barH = Math.max(20, Math.round(H * 0.031));
  ctx.save();
  ctx.fillStyle = pal.ink;
  ctx.fillRect(0, H - barH, W, barH);
  if (text) {
    const size = barH * 0.52;
    trackedCaps(ctx, text, size, 0.34);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(250,244,230,0.9)';
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
  ctx.font = `${R * 0.34}px "Bebas Neue"`;
  ctx.letterSpacing = `${R * 0.1}px`;
  ctx.fillText('EST.', cx, cy - R * 0.1);
  ctx.font = `${R * 0.52}px "Bebas Neue"`;
  ctx.letterSpacing = `${R * 0.06}px`;
  ctx.fillText('2026', cx, cy + R * 0.48);
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
 * Draws the whole caption band into rect (x, y, w, h) on the poster cream. Returns nothing;
 * geometry was fixed by captionGeometry, so the caller reserved exactly this space.
 */
export function drawCaptionBand(ctx, x, y, w, h, state, pal) {
  const cx = x + w / 2;
  const padTop = h * 0.05;
  const padBottom = h * 0.03;
  const topRowH = h * 0.2;
  const gap = h * 0.05; // the guaranteed gap between the top row and the headline
  const scriptH = h * 0.17;
  const topY = y + padTop;
  const topCy = topY + topRowH * 0.52;

  // --- top row: chips (left), stars + quote (centre), rosette (right).
  const rosetteR = topRowH * 0.46;
  const chipsTexts = String(state.chips ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const chipSize = Math.min(topRowH * 0.36, w * 0.017);
  let usedRight = 0;
  let usedLeft = 0;
  ctx.save();
  ctx.globalAlpha = 0.999; // measure with real fonts
  const chipW = chipsTexts.length ? (() => {
    const probe = document.createElement('canvas').getContext('2d');
    probe.font = `${chipSize}px "Bebas Neue"`;
    probe.letterSpacing = `${chipSize * 0.18}px`;
    return chipsTexts.reduce((a, t) => a + probe.measureText(t.toUpperCase()).width + chipSize * 2.5, chipSize * 0.7 * (chipsTexts.length - 1));
  })() : 0;
  usedLeft = chipW;
  usedRight = rosetteR * 2.24;
  ctx.restore();

  const quote = String(state.quote ?? '').trim().toUpperCase().slice(0, 60);
  const cite = String(state.cite ?? '').trim().toUpperCase().slice(0, 30);
  const quoteText = quote ? (cite ? `${quote} \u2014 ${cite}` : quote) : '';
  const starSize = topRowH * 0.36;
  const starsW = state.stars === false ? 0 : starSize * 5.6;
  const centreX0 = x + w * 0.06 + usedLeft + w * 0.02;
  const centreX1 = x + w * 0.94 - usedRight - w * 0.02;
  const centreW = Math.max(w * 0.2, centreX1 - centreX0);

  // Quote type fits its slice of the row, shrinking before it would ever collide.
  let qSize = topRowH * 0.4;
  ctx.save();
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

  if (chipsTexts.length) drawChips(ctx, x + w * 0.06, topCy, chipsTexts, chipSize, pal);
  drawRosette(ctx, x + w * 0.94 - rosetteR, topCy, rosetteR, pal);

  // --- headline: auto-fit, auto-shrink, one line or two balanced lines.
  const headY = topY + topRowH + gap;
  const headMaxH = h - (headY - y) - scriptH - gap - padBottom;
  const headMaxW = w * 0.94;
  const headline = String(state.headline ?? '').toUpperCase().slice(0, 40);
  let size = 0;
  if (headline) {
    let lines = [headline];
    let size = fitArcLine(ctx, headline, headMaxW, headMaxH);
    // Two long lines can be much larger than one: split at the space nearest the middle.
    if (size < headMaxH * 0.42 && headline.includes(' ')) {
      const words = headline.split(' ');
      let best = -1;
      let bestDiff = Infinity;
      let acc = 0;
      const half = [...headline].length / 2;
      for (let i = 0; i < words.length - 1; i++) {
        acc += words[i].length + 1;
        const diff = Math.abs(acc - half);
        if (diff < bestDiff) {
          bestDiff = diff;
          best = i;
        }
      }
      const two = [words.slice(0, best + 1).join(' '), words.slice(best + 1).join(' ')];
      const s2 = Math.min(fitArcLine(ctx, two[0], headMaxW, headMaxH * 0.52), fitArcLine(ctx, two[1], headMaxW, headMaxH * 0.52));
      if (s2 > size * 1.12) {
        lines = two;
        size = s2;
      }
    }
    const lineGap = size * 0.08;
    let by = headY;
    for (const line of lines) {
      drawArcLine(ctx, line, cx, by, size, { ink: pal.ink });
      by += size * 1.02 + lineGap;
    }
  }

  // --- script accent under the headline, Pacifico, warm pink, slightly rotated.
  const scriptText = String(state.script ?? '').trim().slice(0, 42);
  if (scriptText) {
    ctx.save();
    let sSize = Math.min(scriptH * 0.86, Math.max(12, size * 0.46));
    ctx.font = `${sSize}px Pacifico`;
    ctx.textAlign = 'center';
    let sw = ctx.measureText(scriptText).width;
    if (sw > headMaxW) {
      sSize = (sSize * headMaxW) / sw;
      ctx.font = `${sSize}px Pacifico`;
    }
    const sY = y + h - padBottom - scriptH * 0.28;
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
