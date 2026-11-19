// The art panel: a 1980s Miami sunset scene drawn entirely with canvas 2D paths and gradients —
// the optional "VICE SUNSET" plate among the photographic ones. Layered gradient sky, a big
// slatted sun with glow, a seeded skyline with lit windows, water with a mirrored-sky
// reflection, palm silhouettes, birds, stars and sparkles. Every hue comes from the active
// look's palette, and every random choice from the cover's seed, so it is reproducible.
// A soft vignette closes the panel edges so the drawn scene sits in the same print world as
// the photographed panels.

import { makeRng, chance } from './rng.js';

const ART_PALETTES = {
  sunset: {
    sky: ['#1c0b40', '#581d7e', '#b23a86', '#ff6d3f', '#ffb457'],
    sunTop: '#fff6d8',
    sunMid: '#ffd166',
    sunLow: '#ff7a3c',
    glow: 'rgba(255,150,80,',
    cloud: 'rgba(60,16,90,0.55)',
    water: ['#41104f', '#170840', '#0b0330'],
    wave: 'rgba(255,170,110,',
    silhouette: '#150425',
    window: '#ffb457',
    star: '#ffe9c9',
    sparkle: '#ffd166',
  },
  vice: {
    sky: ['#07203a', '#274b8f', '#8f4bd6', '#ff77c8', '#ffd3e8'],
    sunTop: '#fff3fa',
    sunMid: '#ff8ad4',
    sunLow: '#ff4f9e',
    glow: 'rgba(255,130,200,',
    cloud: 'rgba(16,40,80,0.55)',
    water: ['#12365e', '#0a1e40', '#051024'],
    wave: 'rgba(255,150,210,',
    silhouette: '#0a1526',
    window: '#ffd3e8',
    star: '#e9f4ff',
    sparkle: '#7de3ff',
  },
  neon: {
    sky: ['#050517', '#221059', '#5b2bd6', '#a63bff', '#2ee6ff'],
    sunTop: '#eaffff',
    sunMid: '#5fe6ff',
    sunLow: '#b64dff',
    glow: 'rgba(90,220,255,',
    cloud: 'rgba(12,8,40,0.6)',
    water: ['#0b1650', '#060c30', '#02050f'],
    wave: 'rgba(120,230,255,',
    silhouette: '#02030d',
    window: '#5fe6ff',
    star: '#d8f6ff',
    sparkle: '#5fe6ff',
  },
  heat: {
    sky: ['#1f0608', '#7a1e12', '#d94f1e', '#ff9b3d', '#ffd166'],
    sunTop: '#fff7e0',
    sunMid: '#ffc14d',
    sunLow: '#ff8c2e',
    glow: 'rgba(255,160,60,',
    cloud: 'rgba(60,10,10,0.5)',
    water: ['#61140a', '#330806', '#1a0302'],
    wave: 'rgba(255,190,120,',
    silhouette: '#1c0402',
    window: '#ffc14d',
    star: '#ffe9c9',
    sparkle: '#ffc14d',
  },
  noir: {
    sky: ['#0b0b10', '#2e2e38', '#5a5a68', '#9c9caa', '#d8d8e2'],
    sunTop: '#ffffff',
    sunMid: '#d8d8e2',
    sunLow: '#a8a8b4',
    glow: 'rgba(220,220,235,',
    cloud: 'rgba(10,10,16,0.5)',
    water: ['#20202c', '#12121a', '#08080c'],
    wave: 'rgba(220,220,235,',
    silhouette: '#050508',
    window: '#d8d8e2',
    star: '#eceef5',
    sparkle: '#eceef5',
  },
};

/** The palette for a look, with a sane default. */
export function artPalette(lookName) {
  return ART_PALETTES[lookName] ?? ART_PALETTES.vice;
}

/** Draws the whole sunset scene into ctx, filling the panel rect (x, y, w, h). */
export function drawArtPanel(ctx, x, y, w, h, lookName, seed) {
  const p = artPalette(lookName);
  const rng = makeRng(seed ^ 0x517c);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.translate(x, y);

  const horizon = h * (0.64 + rng() * 0.04);
  const sunX = w * (0.36 + rng() * 0.28);
  const sunR = Math.min(w * 0.55, h * 0.4);

  drawSky(ctx, w, horizon, p, rng);
  drawStars(ctx, w, horizon, p, rng);
  drawClouds(ctx, w, horizon, p, rng);
  drawBirds(ctx, w, horizon, rng, p);
  drawSkyline(ctx, w, horizon, h, p, rng, true);
  drawSun(ctx, sunX, horizon, sunR, p);
  drawWater(ctx, w, horizon, h, p, rng, x, y);
  drawSunReflection(ctx, sunX, horizon, sunR, h, p, rng);
  drawSkyline(ctx, w, horizon, h, p, rng, false);
  drawPalms(ctx, w, h, horizon, p, rng);
  drawSparkles(ctx, w, h, horizon, p, rng);
  drawScanlines(ctx, w, h);
  drawEdgeShade(ctx, w, h);

  ctx.restore();
}

/** Layered gradient sky with subtle poster-style bands near the horizon. */
function drawSky(ctx, w, horizon, p, rng) {
  const g = ctx.createLinearGradient(0, 0, 0, horizon);
  const stops = 5;
  for (let i = 0; i < stops; i++) g.addColorStop(i / (stops - 1), p.sky[i]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, horizon);

  ctx.globalAlpha = 0.1;
  const bands = 4;
  for (let i = 1; i <= bands; i++) {
    const by = horizon * (i / (bands + 1)) + horizon * 0.04 * rng();
    ctx.fillStyle = p.sky[Math.min(stops - 1, i + 1)];
    ctx.fillRect(0, by, w, Math.max(1, horizon * 0.012 * (1 + i * 0.3)));
  }
  ctx.globalAlpha = 1;
}

/** Seeded stars in the upper sky: bright dots. */
function drawStars(ctx, w, horizon, p, rng) {
  const count = Math.round((w * horizon) / 16000);
  ctx.fillStyle = p.star;
  for (let i = 0; i < count; i++) {
    const sx = rng() * w;
    const sy = rng() * horizon * 0.5;
    const r = 0.8 + rng() * 1.3;
    ctx.globalAlpha = 0.45 + rng() * 0.5;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** The big sun: glow, gradient disc, then slats cut by repainting the sky gradient. */
function drawSun(ctx, sunX, horizon, sunR, p) {
  const cy = horizon - sunR * 0.62;

  const glowR = sunR * 2.8;
  const glow = ctx.createRadialGradient(sunX, cy, sunR * 0.4, sunX, cy, glowR);
  glow.addColorStop(0, `${p.glow}0.58)`);
  glow.addColorStop(0.45, `${p.glow}0.18)`);
  glow.addColorStop(1, `${p.glow}0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - glowR, cy - glowR, glowR * 2, glowR * 2);

  const disc = ctx.createLinearGradient(0, cy - sunR, 0, cy + sunR);
  disc.addColorStop(0, p.sunTop);
  disc.addColorStop(0.55, p.sunMid);
  disc.addColorStop(1, p.sunLow);
  ctx.save();
  ctx.beginPath();
  ctx.arc(sunX, cy, sunR, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = disc;
  ctx.fillRect(sunX - sunR, cy - sunR, sunR * 2, sunR * 2);

  const slats = 5;
  let gap = sunR * 0.055;
  let yy = cy + sunR * 0.08;
  for (let i = 0; i < slats; i++) {
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    for (let s = 0; s < 5; s++) sky.addColorStop(s / 4, p.sky[s]);
    ctx.fillStyle = sky;
    ctx.fillRect(sunX - sunR, yy, sunR * 2, gap);
    yy += gap + sunR * (0.16 - i * 0.014);
    gap *= 1.45;
  }
  ctx.restore();
}

/** Skyline layers: seeded buildings with a few lit windows. The far layer sits behind the sun. */
function drawSkyline(ctx, w, horizon, h, p, rng, far) {
  const layerH = far ? h * 0.1 : h * 0.17;
  const baseY = horizon + (far ? 1 : 2);
  let bx = -w * 0.03;
  ctx.fillStyle = far ? withAlpha(p.silhouette, 0.55) : p.silhouette;
  while (bx < w + w * 0.03) {
    const bw = w * (0.03 + rng() * 0.075);
    const bh = layerH * (0.3 + rng() * 0.75);
    ctx.fillRect(bx, baseY - bh, bw, bh); // buildings stop at the horizon; the water runs in front
    if (!far && bh > layerH * 0.5 && chance(rng, 0.8)) {
      const cols = Math.max(1, Math.floor(bw / (w * 0.012)));
      const rows = Math.max(1, Math.floor(bh / (h * 0.02)));
      ctx.fillStyle = p.window;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (chance(rng, 0.16)) {
            ctx.globalAlpha = 0.35 + rng() * 0.5;
            ctx.fillRect(bx + c * (bw / cols) + bw / cols * 0.3, baseY - bh + r * (bh / rows) + bh / rows * 0.3, Math.max(1, w * 0.003), Math.max(1, h * 0.006));
          }
        }
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = p.silhouette;
    }
    bx += bw + w * (0.002 + rng() * 0.012);
  }
}

/** Water: dark gradient with faint horizon shimmer lines. */
function drawWater(ctx, w, horizon, h, p, rng, x, y) {
  const g = ctx.createLinearGradient(0, horizon, 0, h);
  g.addColorStop(0, p.water[0]);
  g.addColorStop(0.4, p.water[1]);
  g.addColorStop(1, p.water[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, horizon, w, h - horizon);

  // Mirrored sky: a wobbling, fading copy of the sky band just above the horizon, drawn as
  // horizontal slices so it reads as water catching the last light.
  const depth = Math.min(h - horizon, horizon * 0.5);
  const slices = 14;
  const scratch = document.createElement('canvas');
  scratch.width = Math.max(2, Math.round(w));
  scratch.height = Math.max(2, Math.round(depth));
  const sctx = scratch.getContext('2d');
  sctx.drawImage(ctx.canvas, x, y + horizon - depth, w, depth, 0, 0, w, depth);
  ctx.save();
  ctx.globalAlpha = 0.3;
  for (let i = 0; i < slices; i++) {
    const t = i / slices;
    const sy = depth * (1 - t) - depth / slices;
    const dy = horizon + t * depth;
    const sh = depth / slices;
    const dx = (rng() - 0.5) * w * 0.02 * (1 + t * 3);
    ctx.drawImage(scratch, 0, Math.max(0, sy), w, sh, dx, dy, w, sh * (0.5 + rng() * 0.5));
  }
  ctx.restore();

  ctx.fillStyle = `${p.wave}0.35)`;
  ctx.fillRect(0, horizon, w, Math.max(1, h * 0.003));
}

/** The sun's reflection: jittered horizontal streaks fading toward the viewer. */
function drawSunReflection(ctx, sunX, horizon, sunR, h, p, rng) {
  const depth = h - horizon;
  const rows = 16;
  for (let i = 0; i < rows; i++) {
    const t = i / rows;
    const ry = horizon + depth * 0.08 + t * depth * 0.7;
    const rw = sunR * (1.7 - t * 1.2) * (0.6 + rng() * 0.8);
    const rh = Math.max(1, depth * 0.014 * (1 - t * 0.5));
    ctx.globalAlpha = (0.5 - t * 0.4) * (0.6 + rng() * 0.4);
    ctx.fillStyle = `${p.wave}1)`;
    ctx.fillRect(sunX - rw / 2 + (rng() - 0.5) * sunR * 0.5, ry, rw, rh);
  }
  ctx.globalAlpha = 1;
}

/** Soft cloud slivers across the sky. */
function drawClouds(ctx, w, horizon, p, rng) {
  const count = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < count; i++) {
    const cy = horizon * (0.12 + rng() * 0.5);
    const cw = w * (0.2 + rng() * 0.4);
    const ch = horizon * (0.02 + rng() * 0.03);
    const cx = rng() * w - cw * 0.2;
    ctx.fillStyle = p.cloud;
    ctx.beginPath();
    ctx.ellipse(cx + cw / 2, cy, cw / 2, ch / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    if (chance(rng, 0.6)) {
      ctx.beginPath();
      ctx.ellipse(cx + cw * 0.75, cy + ch * 0.3, cw * 0.28, ch * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Palm silhouettes near the panel edges, seeded heights and leans. */
function drawPalms(ctx, w, h, horizon, p, rng) {
  const count = 2 + Math.floor(rng() * 2);
  const slots = count === 2 ? [0.1, 0.92] : [0.08, 0.42 + rng() * 0.08, 0.93];
  for (let i = 0; i < slots.length; i++) {
    const baseX = w * slots[i] + (rng() - 0.5) * w * 0.02;
    const palmH = (horizon + (h - horizon)) * (0.55 + rng() * 0.3);
    const lean = (slots[i] < 0.5 ? 1 : -1) * (0.04 + rng() * 0.1);
    drawPalm(ctx, baseX, h, palmH, lean, rng, p);
  }
}

/** One palm: tapered curved trunk plus a crown of bezier fronds, all silhouette. */
function drawPalm(ctx, baseX, baseY, height, lean, rng, p) {
  ctx.fillStyle = p.silhouette;
  const topX = baseX + lean * height;
  const topY = baseY - height;

  const segs = 9;
  const w0 = height * 0.045;
  const w1 = height * 0.016;
  const ctrlX = baseX + lean * height * 0.25;
  const ctrlY = baseY - height * 0.55;
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const ix = (1 - t) * (1 - t) * baseX + 2 * (1 - t) * t * ctrlX + t * t * topX;
    const iy = (1 - t) * (1 - t) * baseY + 2 * (1 - t) * t * ctrlY + t * t * topY;
    pts.push({ x: ix, y: iy, w: w0 + (w1 - w0) * t });
  }
  ctx.beginPath();
  for (let i = 0; i <= segs; i++) {
    const pt = pts[i];
    if (i === 0) ctx.moveTo(pt.x - pt.w / 2, pt.y);
    else ctx.lineTo(pt.x - pt.w / 2, pt.y);
  }
  for (let i = segs; i >= 0; i--) ctx.lineTo(pts[i].x + pts[i].w / 2, pts[i].y);
  ctx.closePath();
  ctx.fill();

  const fronds = 8;
  const L = height * (0.36 + rng() * 0.08);
  for (let i = 0; i < fronds; i++) {
    const t = i / (fronds - 1);
    const up = Math.PI * (0.08 + t * 1.15);
    const dir = t < 0.5 ? -1 : 1;
    const spread = dir < 0 ? up : Math.PI * 1.92 - up;
    const droop = 0.25 + rng() * 0.35;
    const tipX = topX + Math.cos(spread) * L * (0.85 + rng() * 0.3);
    const tipY = topY - Math.sin(spread) * L * 0.55 + droop * L * 0.5;
    const midX = topX + Math.cos(spread) * L * 0.45;
    const midY = topY - Math.sin(spread) * L * 0.42;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(midX, midY, tipX, tipY);
    ctx.quadraticCurveTo(midX, midY + L * 0.18, topX, topY + L * 0.04);
    ctx.closePath();
    ctx.fill();
  }

  const nuts = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < nuts; i++) {
    ctx.beginPath();
    ctx.arc(topX + (rng() - 0.5) * L * 0.14, topY + L * (0.03 + rng() * 0.05), height * 0.018, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A few birds as thin twin arcs, high in the sky. */
function drawBirds(ctx, w, horizon, rng, p) {
  const count = 2 + Math.floor(rng() * 2);
  ctx.strokeStyle = p.silhouette;
  for (let i = 0; i < count; i++) {
    const bx = w * (0.15 + rng() * 0.7);
    const by = horizon * (0.12 + rng() * 0.3);
    const s = w * (0.006 + rng() * 0.006);
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = Math.max(1, s * 0.22);
    ctx.beginPath();
    ctx.arc(bx - s * 0.9, by + s * 0.35, s, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(bx + s * 0.9, by + s * 0.35, s, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** Poster sparkles: four-point glints on the water. */
function drawSparkles(ctx, w, h, horizon, p, rng) {
  const count = 3 + Math.floor(rng() * 3);
  ctx.fillStyle = p.sparkle;
  for (let i = 0; i < count; i++) {
    const sx = rng() * w;
    const sy = horizon + (h - horizon) * (0.05 + rng() * 0.75);
    const s = w * (0.004 + rng() * 0.006);
    ctx.globalAlpha = 0.5 + rng() * 0.5;
    ctx.beginPath();
    ctx.moveTo(sx, sy - s * 2.4);
    ctx.quadraticCurveTo(sx + s * 0.2, sy - s * 0.2, sx + s * 2.4, sy);
    ctx.quadraticCurveTo(sx + s * 0.2, sy + s * 0.2, sx, sy + s * 2.4);
    ctx.quadraticCurveTo(sx - s * 0.2, sy + s * 0.2, sx - s * 2.4, sy);
    ctx.quadraticCurveTo(sx - s * 0.2, sy - s * 0.2, sx, sy - s * 2.4);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Subtle CRT scanlines, poster texture — fainter still so the sun stays the hero. */
function drawScanlines(ctx, w, h) {
  ctx.globalAlpha = 0.03;
  ctx.fillStyle = '#000';
  for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
  ctx.globalAlpha = 1;
}

/** A soft darkening at the panel's edges, so the drawn scene matches the photo vignettes. */
function drawEdgeShade(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.44, w / 2, h / 2, Math.max(w, h) * 0.76);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.2)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function withAlpha(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
