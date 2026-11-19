// The editor: builds every control, wires the canvas preview interactions (click to select a
// panel, drag to pan its crop, wheel to zoom, double-click to reset it, keyboard shortcuts)
// and keeps the state and the live render in step. Shot mode reuses the same editor object,
// so screenshots exercise exactly what a judge would click.

import { SIZES, LAYOUTS, makeState, makePhoto, clampCrop, reshuffle, rebuildPanels, cropForFill } from './state.js';
import { layoutPanels } from './collage-layout.js';
import { LOOK_DEFS } from './color-grade.js';
import { PLATES, ART_PLATE, plateByKey, plateImage } from './plates.js';
import { renderCover } from './cover-renderer.js';
import { downloadCover } from './exporter.js';
import { loadImage, loadImageFromFile } from './media.js';
import { panCrop, zoomCrop, autoFrame } from './crop-transform.js';

const LOOK_LABELS = Object.fromEntries(Object.entries(LOOK_DEFS).map(([k, v]) => [k, v.label]));

export function createEditor(canvas) {
  const state = makeState();
  const ui = { state, canvas };
  const $ = (id) => document.getElementById(id);

  // ---------- render ----------

  let rects = [];
  ui.render = () => {
    const out = renderCover(canvas, state, { showSelection: true });
    rects = out.rects;
    fitCanvas();
    syncPanelEditor();
    syncReadouts();
  };

  /** Fits the canvas into the stage box at the cover's aspect, letterboxed. */
  function fitCanvas() {
    const inner = $('stageInner');
    if (!inner) return;
    const cs = getComputedStyle(inner);
    const availW = inner.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const availH = inner.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const { w, h } = SIZES[state.size];
    const s = Math.max(0.05, Math.min(availW / w, availH / h));
    canvas.style.width = `${Math.round(w * s)}px`;
    canvas.style.height = `${Math.round(h * s)}px`;
  }
  window.addEventListener('resize', fitCanvas);

  function syncReadouts() {
    const size = SIZES[state.size];
    $('status').textContent = `Ready — ${size.w} × ${size.h} PNG`;
    $('exportMeta').textContent = `${size.w} × ${size.h} · ${state.layout.toUpperCase()}`;
    document.querySelectorAll('#layoutSeg button').forEach((b) => b.classList.toggle('on', b.dataset.value === state.layout));
    document.querySelectorAll('#sizeSeg button').forEach((b) => b.classList.toggle('on', b.dataset.value === state.size));
    document.querySelectorAll('#lookSeg button').forEach((b) => b.classList.toggle('on', b.dataset.value === state.look));
  }

  // ---------- sidebar controls ----------

  function buildSeg(id, entries, current, label) {
    const box = $(id);
    box.textContent = '';
    for (const value of entries) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.value = value;
      b.textContent = label(value);
      if (value === current) b.classList.add('on');
      box.appendChild(b);
    }
  }

  buildSeg('layoutSeg', LAYOUTS, state.layout, (v) => ({ collage: 'Collage', 'poster-grid': 'Poster grid', triptych: 'Triptych' }[v]));
  buildSeg('sizeSeg', Object.keys(SIZES), state.size, (v) => v.replace('x', ' × '));

  $('layoutSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    state.layout = b.dataset.value;
    rebuildPanels(state);
    state.selectedPanel = -1;
    renderTray();
    ui.render();
  });

  $('sizeSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    state.size = b.dataset.value;
    rebuildPanels(state);
    state.selectedPanel = -1;
    renderTray();
    ui.render();
  });

  const lookBox = $('lookSeg');
  for (const [key, def] of Object.entries(LOOK_DEFS)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.value = key;
    b.title = LOOK_LABELS[key];
    b.style.setProperty('--c1', def.accent);
    b.style.setProperty('--c2', def.map[0]);
    b.innerHTML = `<span>${def.label}</span>`;
    if (key === state.look) b.classList.add('on');
    lookBox.appendChild(b);
  }
  lookBox.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    state.look = b.dataset.value;
    ui.render();
  });

  $('artToggle').addEventListener('change', (e) => {
    state.artPanel = e.target.checked;
    rebuildPanels(state);
    renderTray();
    ui.render();
  });

  $('reshuffle').addEventListener('click', () => {
    reshuffle(state);
    renderTray();
    ui.render();
  });

  // ---------- caption fields ----------

  const textFields = [
    ['headline', 'headline', 40],
    ['script', 'script', 42],
    ['quote', 'quote', 60],
    ['cite', 'cite', 30],
    ['chips', 'chips', 80],
    ['credit', 'credit', 72],
  ];
  for (const [id, key, max] of textFields) {
    const el = $(id);
    el.value = state[key];
    el.maxLength = max;
    el.addEventListener('input', () => {
      state[key] = el.value;
      ui.render();
    });
  }

  $('starsToggle').addEventListener('change', (e) => {
    state.stars = e.target.checked;
    ui.render();
  });

  // ---------- photo tray ----------

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.multiple = true;
  $('addPhotos').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    await addPhotoFiles([...fileInput.files]);
    fileInput.value = '';
  });

  async function addPhotoFiles(files) {
    const status = $('status');
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue;
      try {
        state.photos.push(makePhoto(await loadImageFromFile(f), f.name.replace(/\.[^.]+$/, '')));
      } catch {
        status.textContent = `Could not read ${f.name}`;
      }
    }
    renderTray();
    syncPanelEditor();
    ui.render();
  }
  ui.addPhotoFiles = addPhotoFiles;

  /** Loads one or more in-app images by path (used by shot mode). */
  ui.addPhotoPaths = async (paths) => {
    for (const path of paths) {
      try {
        const url = new URL(`../${path.replace(/^\.?\//, '')}`, import.meta.url).href;
        state.photos.push(makePhoto(await loadImage(url), path.split('/').pop().replace(/\.[^.]+$/, '')));
      } catch {
        $('status').textContent = `Could not load ${path}`;
      }
    }
    renderTray();
    ui.render();
  };

  function thumbStyle(el, img) {
    if (!el.dataset.thumb) {
      const c = document.createElement('canvas');
      c.width = 96;
      c.height = 96;
      const cx = c.getContext('2d');
      const s = Math.max(96 / img.naturalWidth, 96 / img.naturalHeight);
      cx.drawImage(img, (img.naturalWidth - 96 / s) / 2, (img.naturalHeight - 96 / s) / 2, 96 / s, 96 / s, 0, 0, 96, 96);
      el.dataset.thumb = c.toDataURL('image/jpeg', 0.72);
    }
    el.style.backgroundImage = `url(${el.dataset.thumb})`;
  }

  /** The tray: the eight scene plates, then the person's own photos. */
  function renderTray() {
    const grid = $('plateGrid');
    grid.textContent = '';
    for (const plate of PLATES) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'plate';
      cell.title = `${plate.name} — click to fill the selected panel`;
      const im = document.createElement('img');
      im.src = plate.file;
      im.alt = plate.name;
      im.loading = 'eager';
      cell.appendChild(im);
      const cap = document.createElement('span');
      cap.textContent = plate.name;
      cell.appendChild(cap);
      cell.addEventListener('click', () => assignFill(plate.key));
      grid.appendChild(cell);
    }
    for (const p of state.photos) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'plate user-plate';
      cell.title = `${p.name} — click to fill the selected panel`;
      thumbStyle(cell, p.img);
      const cap = document.createElement('span');
      cap.textContent = (p.name || 'YOUR PHOTO').toUpperCase();
      cell.appendChild(cap);
      const x = document.createElement('span');
      x.className = 'plate-remove';
      x.textContent = '×';
      x.title = 'Remove photo';
      x.addEventListener('click', (e) => {
        e.stopPropagation();
        state.photos = state.photos.filter((q) => q.id !== p.id);
        rebuildPanels(state);
        renderTray();
        ui.render();
      });
      cell.appendChild(x);
      cell.addEventListener('click', () => assignFill(p.id));
      grid.appendChild(cell);
    }
  }
  ui.renderTray = renderTray;

  function assignFill(fill) {
    const sel = state.selectedPanel;
    if (sel < 0 || !state.panels[sel]) {
      $('status').textContent = 'Select a panel on the preview first.';
      return;
    }
    state.panels[sel].fill = fill;
    // The crop re-seeds for the plate actually shown, so its framing matches the new photo.
    if (typeof fill === 'string' && (fill === 'art' || PLATES.some((p) => p.key === fill))) {
      state.panels[sel].crop = cropForFill(fill, state.seed + sel * 131);
    }
    // The locator label follows the plate shown (resolved at draw time); only user photos
    // need an explicit caption, and a hand-edited label (label.user) is never overwritten.
    const panel = state.panels[sel];
    if (String(fill).startsWith('photo:')) {
      const photo = state.photos.find((p) => p.id === fill);
      if (photo && !(panel.label?.user)) {
        panel.label = { name: (photo.name || 'YOUR PHOTO').toUpperCase(), sub: 'FROM YOUR CAMERA ROLL' };
      }
    } else if (fill === 'wash' && !(panel.label?.user)) {
      panel.label = null;
    }
    ui.render();
  }

  // ---------- panel inspector ----------

  function syncPanelEditor() {
    const sel = state.selectedPanel;
    const panel = sel >= 0 ? state.panels[sel] : null;
    $('panelId').textContent = panel ? `#${sel + 1}` : 'none';
    for (const id of ['inspectorBody']) $('inspectorBody').classList.toggle('disabled', !panel);

    const fillSel = $('panelFill');
    fillSel.textContent = '';
    const opts = [
      ['', panel ? 'Choose a fill…' : 'Select a panel on the preview'],
    ];
    if (panel) {
      opts.push(['art', 'VICE SUNSET (drawn)']);
      for (const p of PLATES) opts.push([p.key, p.name]);
      for (const p of state.photos) opts.push([p.id, `YOUR PHOTO: ${(p.name || '').toUpperCase()}`]);
      opts.push(['wash', 'COLOUR WASH']);
    }
    for (const [value, text] of opts) {
      const o = document.createElement('option');
      o.value = value;
      o.textContent = text;
      fillSel.appendChild(o);
    }
    fillSel.disabled = !panel;
    fillSel.value = panel && [...fillSel.options].some((o) => o.value === panel.fill) ? panel.fill : '';

    const lookSel = $('panelLook');
    lookSel.disabled = !panel;
    lookSel.value = panel ? panel.look : '';
    // The inspector shows the label that will actually draw: the plate's own caption.
    const shown = panel ? resolveShownLabel(panel) : null;
    $('labelName').value = shown ? shown.name ?? '' : '';
    $('labelSub').value = shown ? shown.sub ?? '' : '';
    $('labelName').disabled = !panel;
    $('labelSub').disabled = !panel;
  }

  function resolveShownLabel(panel) {
    if (panel.label?.user) return panel.label;
    if (panel.fill === 'art') return { name: 'VICE SUNSET', sub: 'NOW SHOWING · ALL NIGHT' };
    const plate = typeof panel.fill === 'string' ? plateByKey(panel.fill) : null;
    if (plate) return { name: plate.name, sub: plate.time };
    if (String(panel.fill).startsWith('photo:')) {
      return panel.label ?? { name: 'YOUR PHOTO', sub: 'FROM YOUR CAMERA ROLL' };
    }
    return null;
  }

  $('panelFill').addEventListener('change', (e) => {
    if (e.target.value) assignFill(e.target.value);
  });

  const lookSel = $('panelLook');
  for (const [key, def] of Object.entries(LOOK_DEFS)) {
    const o = document.createElement('option');
    o.value = key;
    o.textContent = def.label;
    lookSel.appendChild(o);
  }
  lookSel.addEventListener('change', () => {
    const panel = state.panels[state.selectedPanel];
    if (panel && lookSel.value) {
      panel.look = lookSel.value;
      ui.render();
    }
  });

  for (const [id, key] of [['labelName', 'name'], ['labelSub', 'sub']]) {
    $(id).addEventListener('input', (e) => {
      const panel = state.panels[state.selectedPanel];
      if (!panel) return;
      // A hand edit takes ownership of the label so re-renders never clobber it.
      panel.label = { ...panel.label, [key]: e.target.value, user: true };
      ui.render();
    });
  }

  function autoFrameSelected() {
    const panel = state.panels[state.selectedPanel];
    if (panel) {
      const plate = typeof panel.fill === 'string' ? plateByKey(panel.fill) : null;
      panel.crop = autoFrame(panel.crop, {
        framing: plate?.framing,
        focus: plate?.focus,
        zoom: plate?.zoom,
      });
      ui.render();
    }
  }
  $('autoFrame').addEventListener('click', autoFrameSelected);

  function resetCropSelected() {
    const panel = state.panels[state.selectedPanel];
    if (panel) {
      panel.crop = { cx: 0.5, cy: 0.5, zoom: 1 };
      ui.render();
    }
  }
  $('resetCrop').addEventListener('click', resetCropSelected);

  // ---------- canvas interactions ----------

  function toCanvas(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * canvas.width,
      y: ((e.clientY - r.top) / r.height) * canvas.height,
    };
  }

  function panelAt(px, py) {
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return i;
    }
    return -1;
  }

  function select(idx) {
    state.selectedPanel = idx;
    syncPanelEditor();
    ui.render();
  }

  let dragging = null;
  canvas.addEventListener('pointerdown', (e) => {
    const { x, y } = toCanvas(e);
    const idx = panelAt(x, y);
    select(idx);
    if (idx >= 0) {
      dragging = { idx, x, y, rect: rects[idx] };
      canvas.setPointerCapture(e.pointerId);
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const { x, y } = toCanvas(e);
    const panel = state.panels[dragging.idx];
    const fill = panel?.fill ?? '';
    const img = fill.startsWith('photo:') ? state.photos.find((p) => p.id === fill)?.img : plateImage(fill);
    if (!img || !panel) return;
    const r = dragging.rect;
    panel.crop = clampCrop(panCrop(panel.crop, (x - dragging.x) / r.w, (y - dragging.y) / r.h, r.w / r.h, img));
    dragging.x = x;
    dragging.y = y;
    ui.render();
  });

  canvas.addEventListener('pointerup', () => {
    dragging = null;
  });

  // Double-click resets the selected panel's crop to the plain cover fit.
  canvas.addEventListener('dblclick', (e) => {
    const { x, y } = toCanvas(e);
    const idx = panelAt(x, y);
    if (idx >= 0) {
      select(idx);
      resetCropSelected();
    }
  });

  canvas.addEventListener('wheel', (e) => {
    const { x, y } = toCanvas(e);
    const idx = panelAt(x, y);
    if (idx < 0) return;
    e.preventDefault();
    if (idx !== state.selectedPanel) select(idx);
    const panel = state.panels[idx];
    const fill = panel?.fill ?? '';
    const img = fill.startsWith('photo:') ? state.photos.find((p) => p.id === fill)?.img : plateImage(fill);
    if (!img || !panel) return;
    const r = rects[idx];
    panel.crop = clampCrop(zoomCrop(panel.crop, e.deltaY < 0 ? 1.08 : 1 / 1.08, img, r.w / r.h, (x - r.x) / r.w, (y - r.y) / r.h));
    ui.render();
  }, { passive: false });

  // Keyboard: E exports, F auto-frames the selected panel, arrows nudge the selected crop,
  // Tab cycles panels.
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === 'e' || e.key === 'E') {
      e.preventDefault();
      exportCover();
      return;
    }
    if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      autoFrameSelected();
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const n = rects.length;
      if (n) select(((state.selectedPanel < 0 ? -1 : state.selectedPanel) + 1) % n);
      return;
    }
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (arrows[e.key]) {
      e.preventDefault();
      const panel = state.panels[state.selectedPanel];
      if (!panel) return;
      const step = e.shiftKey ? 0.05 : 0.012;
      // Nudges are clamped like a drag, so the crop can never leave its photo.
      panel.crop = clampCrop({
        ...panel.crop,
        cx: panel.crop.cx + arrows[e.key][0] * step,
        cy: panel.crop.cy + arrows[e.key][1] * step,
      });
      ui.render();
    }
  });

  // ---------- drag & drop ----------

  const stage = $('stage');
  const drop = (e) => {
    e.preventDefault();
    stage.classList.remove('drop-target');
    if (e.dataTransfer?.files?.length) addPhotoFiles([...e.dataTransfer.files]);
  };
  for (const el of [stage, $('leftbar')]) {
    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (el === stage) stage.classList.add('drop-target');
    });
    el.addEventListener('dragleave', () => stage.classList.remove('drop-target'));
    el.addEventListener('drop', drop);
  }

  // ---------- export ----------

  async function exportCover() {
    const status = $('status');
    const btn = $('export');
    status.textContent = 'Rendering PNG…';
    btn.classList.add('busy');
    try {
      const name = await downloadCover(state);
      status.textContent = `Saved ${name}`;
    } catch (err) {
      status.textContent = `Export failed: ${err.message}`;
    } finally {
      btn.classList.remove('busy');
    }
  }
  $('export').addEventListener('click', exportCover);

  // ---------- boot ----------

  syncPanelEditor();
  syncReadouts();
  renderTray();
  ui.render();

  return ui;
}
