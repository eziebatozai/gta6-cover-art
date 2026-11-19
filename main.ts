// VICE FORGE — a GTA-style poster cover maker (the app is this repository's app/ folder: plain
// static files, ES modules, no library, no network). This program hands the entry in: it checks
// the app is really there, copies app/ and screenshots/ to /output, and writes /output/dossier.json
// with the vendored make.fun library. Outside the grader's container, MAKEFUN_OUTPUT_DIR stands
// in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Serve it locally with `node serve.ts`, then open http://localhost:8080. Regenerate the three
// screenshots (and verify PNG exports) with `node tools/shots.mjs` / `node tools/shots.mjs --exports`.
import { cpSync, existsSync, readdirSync, statSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fail loudly if the app is missing: a silent empty hand-in is the worst outcome.
const appDir = join(here, 'app');
const indexHtml = join(appDir, 'index.html');
if (!statIsFile(indexHtml)) {
  console.error('main.ts: app/index.html is missing — the app was not built or was moved.');
  console.error(`main.ts: expected the cover maker at ${indexHtml}`);
  process.exit(1);
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others
// refuse an entry the scorer would refuse (more than 4 screenshots or one over 256 KiB; more
// than 993 files in app/ or 48 MiB of app files, in all, or a path under app/ over 1000 bytes).
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

const screenshotsDir = join(here, 'screenshots');
if (!existsSync(screenshotsDir)) {
  console.error('main.ts: screenshots/ is missing — run node tools/shots.mjs first.');
  process.exit(1);
}

// The screenshots must sit inside the scorer's caps too: at most 256 KiB each, long side at
// most 1280 and short side at least 480. A JPEG that slipped past the driver is refused here,
// before it can reach the dossier.
const screenshotCaps = { max_bytes: DOSSIER_CAPS.screenshots.max_bytes, max_long: 1280, min_short: 480 };
for (const file of listFiles(screenshotsDir)) {
  const dims = jpegSize(join(screenshotsDir, file));
  const bytes = statSync(join(screenshotsDir, file)).size;
  if (!dims) {
    console.error(`main.ts: ${file} is not a decodable JPEG.`);
    process.exit(1);
  }
  const long = Math.max(dims.w, dims.h);
  const short = Math.min(dims.w, dims.h);
  if (bytes > screenshotCaps.max_bytes || long > screenshotCaps.max_long || short < screenshotCaps.min_short) {
    console.error(
      `main.ts: ${file} is ${dims.w}x${dims.h}, ${(bytes / 1024).toFixed(0)} KiB — outside the caps ` +
      `(<= ${screenshotCaps.max_bytes} bytes, long <= ${screenshotCaps.max_long}, short >= ${screenshotCaps.min_short}).`,
    );
    process.exit(1);
  }
}

mkdirSync(out, { recursive: true });
cpSync(appDir, join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(screenshotsDir, join(out, 'screenshots'), { recursive: true });

const dossier = buildDossier(out, DOSSIER_CAPS);
writeFileSync(join(out, 'dossier.json'), dossier);

// A short summary of what was handed in, so a human eye sees the shape of the entry.
const appFiles = listFiles(appDir).length;
const shots = listFiles(screenshotsDir);
console.log(`VICE FORGE handed in: ${appFiles} app files, ${shots.length} screenshots.`);
for (const s of shots) console.log(`  ${s}`);
console.log(`dossier.json: ${(dossier.length / 1024).toFixed(1)} KiB -> ${join(out, 'dossier.json')}`);

function statIsFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/** Reads a JPEG's SOF0/SOF2 marker for its dimensions, or null when it is not a JPEG. */
function jpegSize(file) {
  try {
    const buf = readFileSync(file);
    if (buf.readUInt16BE(0) !== 0xffd8) return null;
    let off = 2;
    while (off + 9 < buf.length) {
      if (buf[off] !== 0xff) return null;
      const marker = buf[off + 1];
      const len = buf.readUInt16BE(off + 2);
      if ((marker >= 0xc0 && marker <= 0xc3) || marker === 0xc5 || marker === 0xc6 || marker === 0xc7 ||
          (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
        return { h: buf.readUInt16BE(off + 5), w: buf.readUInt16BE(off + 7) };
      }
      off += 2 + len;
    }
    return null;
  } catch {
    return null;
  }
}

function listFiles(dir) {
  const found = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else found.push(p.slice(dir.length + 1));
    }
  };
  walk(dir);
  return found;
}
