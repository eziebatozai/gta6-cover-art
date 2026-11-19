// Screenshot driver: serves app/ on a free port, opens each recipe from shots.json in headless
// Chromium (Playwright), waits for window.__shotReady, and writes the JPEGs into screenshots/.
// Every written JPEG is checked against the entry's caps — ≤ 256 KiB, long side ≤ 1280,
// short side ≥ 480 — and against the recipe's own declared dimensions (parsed from the JPEG's
// SOF marker, so a driver bug can never silently rescale a shot). The driver fails loudly
// when a recipe breaks any of those.
// `node tools/shots.mjs --exports` additionally verifies the export path: in the editor it
// clicks Export for all three sizes and checks each downloaded PNG's IHDR dimensions.

import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readFileSync, mkdirSync, existsSync, statSync } from 'node:fs';

const here = fileURLToPath(new URL('..', import.meta.url));
const appRoot = join(here, 'app');
const shotsDir = join(here, 'screenshots');

const MAX_BYTES = 256 * 1024;
const MAX_LONG = 1280;
const MIN_SHORT = 480;

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  // The npm package may live in a global or npx cache rather than beside this repo.
  const { execSync } = await import('node:child_process');
  const candidates = [];
  try {
    candidates.push(join(execSync('npm root -g').toString().trim(), 'playwright'));
  } catch {}
  try {
    for (const hash of readdirSync('/home/amoy/.npm/_npx')) {
      candidates.push(join('/home/amoy/.npm/_npx', hash, 'node_modules', 'playwright'));
    }
  } catch {}
  for (const candidate of candidates) {
    try {
      const pkg = JSON.parse(readFileSync(join(candidate, 'package.json'), 'utf8'));
      const entry = pkg.exports?.['.']?.import ?? pkg.main ?? 'index.mjs';
      ({ chromium } = await import(join(candidate, entry)));
      break;
    } catch {}
  }
  if (!chromium) {
    console.error('tools/shots.mjs: playwright is not importable. Run: npx --yes playwright@1.65.1 install chromium');
    process.exit(1);
  }
}

// --- tiny static server for app/ ---
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
  '.md': 'text/markdown; charset=utf-8',
};

const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = join(appRoot, path === '/' ? 'index.html' : path);
  try {
    const data = readFileSync(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
console.log(`serving app/ on http://127.0.0.1:${port}`);

const browser = await chromium.launch();

async function open(query, width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${port}/${query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 30000 });
  return page;
}

if (process.argv.includes('--exports')) {
  // Export test: load the editor in each size, click Export, capture the download, check the PNG.
  for (const size of ['1080x1080', '1080x1350', '1920x1080']) {
    const [w, h] = size.split('x').map(Number);
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    await page.goto(`http://127.0.0.1:${port}/?shot=editor&size=${size}&photo=samples/boulevard.jpg&headline=Export%20Test`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 30000 });
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      page.click('#export'),
    ]);
    const tmp = `/tmp/vice-forge-export-${size}.png`;
    await download.saveAs(tmp);
    const ok = checkPngSize(tmp, w, h);
    console.log(`export ${size}: ${download.suggestedFilename()} ${ok ? 'OK' : 'WRONG SIZE'}`);
    if (!ok) process.exitCode = 1;
    await page.close();
  }
} else {
  const recipesFile = process.env.SHOTS_FILE ?? join(here, 'shots.json');
  const outDir = process.env.SHOTS_DIR ?? shotsDir;
  mkdirSync(outDir, { recursive: true });
  const recipes = JSON.parse(readFileSync(recipesFile, 'utf8'));
  for (const r of recipes) {
    const page = await open(r.query, r.w, r.h);
    const out = join(outDir, r.name);
    await page.screenshot({ path: out, type: 'jpeg', quality: r.quality ?? 88 });
    const bytes = statSync(out).size;
    const problems = [];
    if (bytes > MAX_BYTES) problems.push(`over the 256 KiB cap (${(bytes / 1024).toFixed(0)} KiB)`);
    const long = Math.max(r.w, r.h);
    const short = Math.min(r.w, r.h);
    if (long > MAX_LONG) problems.push(`long side ${long} > ${MAX_LONG}`);
    if (short < MIN_SHORT) problems.push(`short side ${short} < ${MIN_SHORT}`);
    // The pixels on disk must really be the recipe's size: parse the JPEG's SOF marker.
    const dims = jpegSize(out);
    if (!dims) problems.push('not a decodable JPEG');
    else if (dims.w !== r.w || dims.h !== r.h) problems.push(`SOF says ${dims.w}x${dims.h}, recipe says ${r.w}x${r.h}`);
    console.log(`${r.name}: ${r.w}x${r.h}, ${(bytes / 1024).toFixed(0)} KiB${problems.length ? ` — FAIL: ${problems.join(', ')}` : ''}`);
    if (problems.length) process.exitCode = 1;
    await page.close();
  }
}

await browser.close();
server.close();

/** Reads a PNG's IHDR and compares it with the expected width and height. */
function checkPngSize(file, w, h) {
  if (!existsSync(file)) return false;
  const buf = readFileSync(file);
  if (buf.readUInt32BE(0) !== 0x89504e47) return false;
  const iw = buf.readUInt32BE(16);
  const ih = buf.readUInt32BE(20);
  return iw === w && ih === h;
}

/** Reads a JPEG's SOF0/SOF2 frame header for its real pixel dimensions, or null. */
function jpegSize(file) {
  const buf = readFileSync(file);
  if (buf.readUInt16BE(0) !== 0xffd8) return null;
  let off = 2;
  while (off + 9 < buf.length) {
    if (buf[off] !== 0xff) return null;
    const marker = buf[off + 1];
    const len = buf.readUInt16BE(off + 2);
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      return { h: buf.readUInt16BE(off + 5), w: buf.readUInt16BE(off + 7) };
    }
    off += 2 + len;
  }
  return null;
}
