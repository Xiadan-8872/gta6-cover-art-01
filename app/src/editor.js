// Neon Sunset Cover Studio — editor glue.
// Builds the layout / grade pickers and the photo thumbnails, and wires
// pointer drag on the preview canvas: click selects a panel, drag pans
// that panel's photo (crop / position). All state lives in the caller.
import { GRADES, LAYOUTS, panelAt } from './cover.js';

/** Human names for the panel slots, for the "Selected panel" label. */
export function panelName(layoutId, index) {
  if (layoutId === 'hero') return 'Hero';
  if (layoutId === 'hero3') return index === 0 ? 'Hero' : `Panel ${index}`;
  if (layoutId === 'grid') return `Panel ${['top-left', 'top-right', 'bottom-left', 'bottom-right'][index] ?? index}`;
  if (layoutId === 'mosaic') return `Panel ${index + 1} of 9`;
  if (layoutId === 'strip') return `Snapshot ${index + 1}`;
  return `Panel ${index + 1}`;
}

/** Builds the layout and grade picker buttons into their containers. */
export function buildPickers(state, els, redraw) {
  for (const [id, layout] of Object.entries(LAYOUTS)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = layout.label;
    b.setAttribute('aria-pressed', String(state.layout === id));
    b.addEventListener('click', () => {
      state.layout = id;
      state.selected = 0;
      els.layouts.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
      redraw();
    });
    els.layouts.appendChild(b);
  }
  for (const grade of GRADES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-pressed', String(state.grade === grade.id));
    const dot = document.createElement('span');
    dot.className = 'swatch';
    dot.style.background = `linear-gradient(135deg, rgb(${grade.mid.join(',')}), rgb(${grade.high.join(',')}))`;
    b.append(dot, document.createTextNode(grade.label));
    b.addEventListener('click', () => {
      state.grade = grade.id;
      els.grades.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
      redraw();
    });
    els.grades.appendChild(b);
  }
}

/** Renders the loaded-photo thumbnails; clicking one assigns it to the selected panel. */
export function renderThumbs(state, container, redraw) {
  container.replaceChildren();
  state.photos.forEach((photo, i) => {
    const img = document.createElement('img');
    img.src = photo.url;
    img.alt = photo.name;
    img.title = photo.name;
    const assigned = state.panels.some((p) => p.photo === i);
    img.classList.toggle('assigned', assigned);
    img.classList.toggle('selected', state.panels[state.selected]?.photo === i);
    img.addEventListener('click', () => {
      state.panels[state.selected].photo = i;
      redraw();
    });
    container.appendChild(img);
  });
  if (state.photos.length === 0) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = 'No photos yet — add your own, or try a sample.';
    container.appendChild(p);
  }
}

/** Selects a panel and refreshes the panel controls. */
export function selectPanel(state, index, els, redraw) {
  const layout = LAYOUTS[state.layout];
  state.selected = Math.max(0, Math.min(index, layout.panels.length - 1));
  els.panelName.textContent = panelName(state.layout, state.selected);
  const panel = state.panels[state.selected];
  els.zoom.value = String(panel.zoom);
  els.zoomVal.textContent = `${panel.zoom.toFixed(2)}×`;
  renderThumbs(state, els.thumbs, redraw);
}

/**
 * Pointer drag on the preview canvas: a click selects the panel under the
 * pointer; a drag pans that panel's photo. Coordinates are canvas pixels.
 */
export function attachDrag(canvas, state, els, redraw) {
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let moved = false;

  const toCanvas = (e) => {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * canvas.width,
      y: ((e.clientY - r.top) / r.height) * canvas.height,
    };
  };

  canvas.addEventListener('pointerdown', (e) => {
    const p = toCanvas(e);
    const hit = panelAt(state, p.x, p.y, canvas.width, canvas.height);
    if (hit < 0) return;
    selectPanel(state, hit, els, redraw);
    dragging = true;
    moved = false;
    lastX = p.x;
    lastY = p.y;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const p = toCanvas(e);
    const panel = state.panels[state.selected];
    const dx = (p.x - lastX) / canvas.width;
    const dy = (p.y - lastY) / canvas.height;
    if (Math.abs(dx) + Math.abs(dy) > 0.001) moved = true;
    panel.ox += dx;
    panel.oy += dy;
    lastX = p.x;
    lastY = p.y;
    if (moved) redraw();
  });
  canvas.addEventListener('pointerup', () => {
    dragging = false;
  });
}
