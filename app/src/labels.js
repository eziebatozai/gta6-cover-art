// Locator labels: every panel carries a small caption bar — a dark translucent strip along the
// panel's bottom edge with a bold caps name and a smaller detail line under it, like a contact
// sheet's margin notes. The label always names the plate actually shown: it is resolved from
// the panel's fill at draw time (plates.js keeps the seeded time line per plate), and only an
// explicit inspector edit (label.user) can override it. Defaults are seeded per panel.
// The bar is opaque enough (0.9 at its left edge, 0.74 at its right) and carries a soft blend
// shadow above it, so the cream text stays readable even over a bright white facade.

import { plateByKey, ART_PLATE } from './plates.js';

export function makeLabel(name, sub) {
  return { name, sub };
}

/**
 * The label for a panel's fill, whatever it currently is: a plate key resolves to that plate's
 * name and seeded time line, 'art' to the drawn panel's identity, a user photo to its camera-
 * roll caption, and anything fill-less (a wash) to nothing. An inspector edit on the panel
 * (label.user) wins over every default, so hand-written labels never get clobbered.
 */
export function resolveLabel(fill, label) {
  if (label && label.user && (label.name || label.sub)) return label;
  if (fill === 'art') return { name: ART_PLATE.name, sub: ART_PLATE.time };
  const plate = typeof fill === 'string' ? plateByKey(fill) : null;
  if (plate) return { name: plate.name, sub: plate.time };
  if (typeof fill === 'string' && fill.startsWith('photo:')) {
    return label && (label.name || label.sub)
      ? label
      : { name: 'YOUR PHOTO', sub: 'FROM YOUR CAMERA ROLL' };
  }
  return null;
}

/** Draws the locator bar inside panel rect r. Never drawn above r (it hugs the bottom edge). */
export function drawLocatorLabel(ctx, r, label) {
  if (!label || !label.name) return;
  const barH = Math.max(20, Math.min(r.h * 0.26, Math.max(30, r.h * 0.155)));
  const padX = Math.max(8, barH * 0.34);
  const nameSize = Math.max(10, Math.min(barH * 0.5, r.w * 0.09));
  const subSize = nameSize * 0.62;
  const textW = (size, text, track) => {
    ctx.font = `${size}px "Bebas Neue"`;
    ctx.letterSpacing = `${track}px`;
    const w = ctx.measureText(text).width;
    ctx.letterSpacing = '0px';
    return w;
  };

  const nameText = String(label.name).toUpperCase().slice(0, 30);
  const subText = String(label.sub ?? '').toUpperCase().slice(0, 36);
  const showSub = subText && barH >= 30 && r.h > barH * 1.6;
  const nameW = textW(nameSize, nameText, nameSize * 0.09);
  const subW = showSub ? textW(subSize, subText, subSize * 0.22) : 0;
  const need = padX * 2 + Math.max(nameW, subW);

  // Shrink to fit narrow strips rather than spill over the panel's edge.
  let scale = 1;
  if (need > r.w * 0.96) scale = (r.w * 0.96) / need;
  const nSize = nameSize * scale;
  const sSize = subSize * scale;

  const y = r.y + r.h - barH;
  ctx.save();

  // A soft blend shadow above the bar, so it sits in the photo instead of pasted on it.
  const blend = ctx.createLinearGradient(r.x, y - barH * 0.45, r.x, y);
  blend.addColorStop(0, 'rgba(10,6,16,0)');
  blend.addColorStop(1, 'rgba(10,6,16,0.4)');
  ctx.fillStyle = blend;
  ctx.fillRect(r.x, y - barH * 0.45, r.w, barH * 0.45);

  // The bar: a dark translucent gradient, darkest at its left edge — readable on any photo.
  const g = ctx.createLinearGradient(r.x, y, r.x + r.w, y);
  g.addColorStop(0, 'rgba(10,6,16,0.9)');
  g.addColorStop(1, 'rgba(10,6,16,0.74)');
  ctx.fillStyle = g;
  ctx.fillRect(r.x, y, r.w, barH);
  // Warm keyline on top of the bar, a print detail.
  ctx.fillStyle = 'rgba(255,180,110,0.55)';
  ctx.fillRect(r.x, y, r.w, Math.max(1, barH * 0.035));

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const baseY = y + barH * (showSub ? 0.48 : 0.62);
  ctx.font = `${nSize}px "Bebas Neue"`;
  ctx.letterSpacing = `${nSize * 0.09}px`;
  ctx.shadowColor = 'rgba(8,4,12,0.55)';
  ctx.shadowBlur = nSize * 0.18;
  ctx.shadowOffsetY = Math.max(1, nSize * 0.06);
  ctx.fillStyle = '#f6efdf';
  ctx.fillText(nameText, r.x + padX, baseY);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  if (showSub) {
    ctx.font = `${sSize}px "Bebas Neue"`;
    ctx.letterSpacing = `${sSize * 0.22}px`;
    ctx.fillStyle = 'rgba(255,205,150,0.92)';
    ctx.fillText(subText, r.x + padX, baseY + sSize * 1.28);
  }
  ctx.letterSpacing = '0px';
  ctx.restore();
}
