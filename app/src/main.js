// Neon Sunset Cover Studio — wires the page: photos in, caption typed,
// layout / grade / effects picked, PNG out in 1080x1080, 1080x1350 or
// 1920x1080. A `?shot=` query sets up a fixed scene for a screenshot
// instead (./shots.js). Photos are read on this machine and never uploaded.
import { blankState, drawCover, exportCover, LAYOUTS } from './cover.js';
import { attachDrag, buildPickers, renderThumbs, selectPanel } from './editor.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const els = {
  layouts: document.getElementById('layouts'),
  grades: document.getElementById('grades'),
  thumbs: document.getElementById('thumbs'),
  panelName: document.getElementById('panel-name'),
  zoom: document.getElementById('zoom'),
  zoomVal: document.getElementById('zoom-val'),
  title: document.getElementById('title'),
  subtitle: document.getElementById('subtitle'),
  titleSize: document.getElementById('title-size'),
  titleSizeVal: document.getElementById('title-size-val'),
  grain: document.getElementById('grain'),
  vignette: document.getElementById('vignette'),
  halftone: document.getElementById('halftone'),
  size: document.getElementById('size'),
  status: document.getElementById('status'),
};

const state = blankState();

/** Loads an image from a URL, resolving to the image once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function redraw() {
  drawCover(canvas, state);
  renderThumbs(state, els.thumbs, redraw);
}

/** Adds a loaded photo and fills every empty panel with it. */
async function addPhoto(img, name, url) {
  state.photos.push({ img, name, url });
  const idx = state.photos.length - 1;
  for (const panel of state.panels) {
    if (panel.photo < 0) panel.photo = idx;
  }
  redraw();
}

async function addFile(file) {
  const url = URL.createObjectURL(file);
  const img = await loadImage(url);
  await addPhoto(img, file.name, url);
}

async function addSample(name) {
  const url = `samples/${name}.jpg`;
  const img = await loadImage(url);
  await addPhoto(img, `${name}.jpg`, url);
}

document.getElementById('photo').addEventListener('change', async (e) => {
  for (const file of e.target.files) {
    try {
      await addFile(file);
    } catch {
      els.status.textContent = `Could not read ${file.name}.`;
    }
  }
  e.target.value = '';
});
document.getElementById('sample-boulevard').addEventListener('click', () => addSample('boulevard'));
document.getElementById('sample-pier').addEventListener('click', () => addSample('pier'));

els.title.addEventListener('input', () => { state.title = els.title.value; redraw(); });
els.subtitle.addEventListener('input', () => { state.subtitle = els.subtitle.value; redraw(); });
els.titleSize.addEventListener('input', () => {
  state.titleScale = Number(els.titleSize.value) / 100;
  els.titleSizeVal.textContent = `${els.titleSize.value}%`;
  redraw();
});
els.grain.addEventListener('change', () => { state.grain = els.grain.checked; redraw(); });
els.vignette.addEventListener('change', () => { state.vignette = els.vignette.checked; redraw(); });
els.halftone.addEventListener('change', () => { state.halftone = els.halftone.checked; redraw(); });

els.zoom.addEventListener('input', () => {
  state.panels[state.selected].zoom = Number(els.zoom.value);
  els.zoomVal.textContent = `${state.panels[state.selected].zoom.toFixed(2)}×`;
  redraw();
});
document.getElementById('center-photo').addEventListener('click', () => {
  const panel = state.panels[state.selected];
  panel.ox = 0;
  panel.oy = 0;
  redraw();
});
document.getElementById('fill-all').addEventListener('click', () => {
  const photo = state.panels[state.selected].photo;
  if (photo < 0) return;
  for (const panel of state.panels) panel.photo = photo;
  redraw();
});

els.size.addEventListener('change', () => {
  const [w, h] = els.size.value.split('x').map(Number);
  canvas.width = w;
  canvas.height = h;
  redraw();
});

/** Downloads one rendered cover as a PNG. */
function downloadCover(width, height) {
  return new Promise((resolve) => {
    const out = exportCover(state, width, height);
    out.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `neon-sunset-cover-${width}x${height}.png`;
      a.click();
      els.status.textContent = `Saved neon-sunset-cover-${width}x${height}.png`;
      resolve();
    }, 'image/png');
  });
}

document.getElementById('export').addEventListener('click', async () => {
  const [w, h] = els.size.value.split('x').map(Number);
  await downloadCover(w, h);
});
document.getElementById('export-all').addEventListener('click', async () => {
  for (const [w, h] of [[1080, 1080], [1080, 1350], [1920, 1080]]) {
    await downloadCover(w, h);
  }
  els.status.textContent = 'Saved all three sizes.';
});

buildPickers(state, els, redraw);
attachDrag(canvas, state, els, redraw);
selectPanel(state, 0, els, redraw);

const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  runShot(shot, new URLSearchParams(location.search), async (sample, text) => {
    const img = await loadImage(sample);
    state.photos.push({ img, name: sample, url: sample });
    for (const panel of state.panels) panel.photo = 0;
    state.title = text;
    els.title.value = text;
    // A two-photo shot scene: the second sample fills the odd panels.
    const other = sample.includes('pier') ? 'boulevard' : 'pier';
    const img2 = await loadImage(`samples/${other}.jpg`);
    state.photos.push({ img: img2, name: other, url: `samples/${other}.jpg` });
    state.panels.forEach((p, i) => { if (i % 2 === 1) p.photo = 1; });
    redraw();
  });
} else {
  // First paint: show the poster shape even before a photo is added.
  document.fonts.ready.then(redraw);
  redraw();
}
