// Neon Sunset Cover Studio — render engine.
// Draws the multi-panel poster cover onto any canvas at any pixel size:
// layouts, sunset gradient-map grades, bold condensed lettering, grain,
// vignette and halftone. Photos are drawn per panel with per-panel zoom
// and offset (crop / position). No network, no Rockstar assets.

/** One panel: fractions of the cover (x, y, w, h) and a tilt in degrees. */
export const LAYOUTS = {
  hero: {
    label: 'Hero',
    panels: [{ x: 0, y: 0, w: 1, h: 1, tilt: 0, focus: 0.25 }],
  },
  hero3: {
    label: 'Hero + 3',
    panels: [
      { x: 0, y: 0, w: 1, h: 0.62, tilt: 0, focus: 0.2 },
      { x: 0, y: 0.62, w: 1 / 3, h: 0.38, tilt: 0, focus: 0.4 },
      { x: 1 / 3, y: 0.62, w: 1 / 3, h: 0.38, tilt: 0, focus: 0.4 },
      { x: 2 / 3, y: 0.62, w: 1 / 3, h: 0.38, tilt: 0, focus: 0.4 },
    ],
  },
  grid: {
    label: '2 × 2 grid',
    panels: [
      { x: 0, y: 0, w: 0.5, h: 0.5, tilt: 0, focus: 0.35 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5, tilt: 0, focus: 0.35 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5, tilt: 0, focus: 0.35 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5, tilt: 0, focus: 0.35 },
    ],
  },
  mosaic: {
    label: '9-panel mosaic',
    panels: [
      { x: 0, y: 0, w: 1 / 3, h: 1 / 3, tilt: 0 },
      { x: 1 / 3, y: 0, w: 1 / 3, h: 1 / 3, tilt: 0 },
      { x: 2 / 3, y: 0, w: 1 / 3, h: 1 / 3, tilt: 0 },
      { x: 0, y: 1 / 3, w: 1 / 3, h: 1 / 3, tilt: 0 },
      { x: 1 / 3, y: 1 / 3, w: 1 / 3, h: 1 / 3, tilt: 0 },
      { x: 2 / 3, y: 1 / 3, w: 1 / 3, h: 1 / 3, tilt: 0 },
      { x: 0, y: 2 / 3, w: 1 / 3, h: 1 / 3, tilt: 0 },
      { x: 1 / 3, y: 2 / 3, w: 1 / 3, h: 1 / 3, tilt: 0 },
      { x: 2 / 3, y: 2 / 3, w: 1 / 3, h: 1 / 3, tilt: 0 },
    ],
  },
  strip: {
    label: 'Tilted strip',
    panels: [
      { x: 0.04, y: 0.06, w: 0.30, h: 0.66, tilt: -4, focus: 0.3 },
      { x: 0.35, y: 0.10, w: 0.30, h: 0.66, tilt: 2, focus: 0.3 },
      { x: 0.66, y: 0.05, w: 0.30, h: 0.66, tilt: 5, focus: 0.3 },
    ],
  },
};

/** Sunset grades: shadow / mid / highlight colours a pixel's tone maps through. */
export const GRADES = [
  { id: 'vice', label: 'Vice Sunset', shadow: [26, 8, 54], mid: [214, 74, 120], high: [255, 205, 110], sat: 1.25 },
  { id: 'neon', label: 'Neon Pink', shadow: [16, 4, 40], mid: [255, 46, 136], high: [255, 150, 220], sat: 1.35 },
  { id: 'dusk', label: 'Palm Dusk', shadow: [10, 18, 46], mid: [120, 70, 160], high: [255, 150, 90], sat: 1.2 },
  { id: 'haze', label: 'Heat Haze', shadow: [40, 20, 10], mid: [240, 120, 40], high: [255, 230, 170], sat: 1.15 },
  { id: 'noir', label: 'Noir Heat', shadow: [8, 8, 14], mid: [90, 40, 70], high: [255, 190, 120], sat: 1.1 },
  { id: 'gold', label: 'Golden Hour', shadow: [30, 16, 8], mid: [210, 130, 50], high: [255, 235, 180], sat: 1.2 },
];

/** A blank cover state: photos are { img, name } entries, panels point at them. */
export function blankState() {
  return {
    layout: 'hero3',
    grade: 'vice',
    title: 'Sunset Heist',
    subtitle: 'Neon Nights · 2026',
    titleScale: 1,
    grain: true,
    vignette: true,
    halftone: false,
    photos: [],
    panels: Array.from({ length: 9 }, () => ({ photo: -1, zoom: 1.2, ox: 0, oy: 0 })),
    selected: 0,
  };
}

/** Builds a 256-entry per-channel lookup for a grade: tone 0 -> shadow, 0.5 -> mid, 1 -> highlight. */
function gradeLUT(grade) {
  const lut = [new Uint8Array(256), new Uint8Array(256), new Uint8Array(256)];
  for (let c = 0; c < 3; c++) {
    for (let v = 0; v < 256; v++) {
      const t = v / 255;
      let out;
      if (t < 0.5) {
        const k = t / 0.5;
        out = grade.shadow[c] + (grade.mid[c] - grade.shadow[c]) * k;
      } else {
        const k = (t - 0.5) / 0.5;
        out = grade.mid[c] + (grade.high[c] - grade.mid[c]) * k;
      }
      lut[c][v] = Math.max(0, Math.min(255, Math.round(out)));
    }
  }
  return lut;
}

/** Applies a grade's LUT in place on an ImageData, with a saturation lift. */
function applyGradeToPixels(data, lut, sat) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    let nr = lut[0][r];
    let ng = lut[1][g];
    let nb = lut[2][b];
    nr = lum + (nr - lum) * sat;
    ng = lum + (ng - lum) * sat;
    nb = lum + (nb - lum) * sat;
    data[i] = Math.max(0, Math.min(255, nr));
    data[i + 1] = Math.max(0, Math.min(255, ng));
    data[i + 2] = Math.max(0, Math.min(255, nb));
  }
}

/** Draws one photo into a panel rect, cover-fit, with the panel's zoom and offset. */
function drawPanelPhoto(ctx, img, rect, panel, w, h) {
  // Vertical crop anchor: faces sit near the top of a photo, so the hero
  // panel looks up (focus < 0.5) instead of always centring the crop.
  const px = rect.x * w;
  const py = rect.y * h;
  const pw = rect.w * w;
  const ph = rect.h * h;
  // Offscreen at panel size: draw the photo, grade its pixels, then stamp it in.
  const off = document.createElement('canvas');
  off.width = Math.max(2, Math.round(pw));
  off.height = Math.max(2, Math.round(ph));
  const octx = off.getContext('2d');
  const base = Math.max(pw / img.naturalWidth, ph / img.naturalHeight) * panel.zoom;
  const dw = img.naturalWidth * base;
  const dh = img.naturalHeight * base;
  const dx = (pw - dw) / 2 + panel.ox * pw;
  const dy = (ph - dh) * (rect.focus ?? 0.5) + panel.oy * ph;
  octx.drawImage(img, dx, dy, dw, dh);
  return { off, octx, px, py, pw, ph };
}

/** A small pre-made film-grain tile, drawn tiled at low alpha. */
let grainTile = null;
function getGrainTile() {
  if (grainTile) return grainTile;
  grainTile = document.createElement('canvas');
  grainTile.width = 128;
  grainTile.height = 128;
  const g = grainTile.getContext('2d');
  const img = g.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(Math.random() * 255);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 22;
  }
  g.putImageData(img, 0, 0);
  return grainTile;
}

/** The cover's caption zone: the bottom band the scrim and lettering sit in. */
export function captionZone(w, h) {
  return { x: 0, y: h * 0.78, w, h: h * 0.22 };
}

/**
 * Draws the whole cover onto `canvas` at its own pixel size, from `state`.
 * Photos are graded per panel; then the sunset sun, scrim, frame, lettering
 * and effects are layered on top.
 */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const layout = LAYOUTS[state.layout] ?? LAYOUTS.hero3;
  const grade = GRADES.find((g) => g.id === state.grade) ?? GRADES[0];
  const lut = gradeLUT(grade);

  // Deep dusk backdrop (shows through the strip layout's gaps).
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#1b0b33');
  bg.addColorStop(0.55, '#3d1457');
  bg.addColorStop(1, '#12081f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const gap = Math.max(2, Math.round(w * 0.004));
  layout.panels.forEach((rect, i) => {
    const panel = state.panels[i];
    const px = rect.x * w;
    const py = rect.y * h;
    const pw = rect.w * w;
    const ph = rect.h * h;
    ctx.save();
    if (rect.tilt) {
      ctx.translate(px + pw / 2, py + ph / 2);
      ctx.rotate((rect.tilt * Math.PI) / 180);
      ctx.translate(-pw / 2, -ph / 2);
    } else {
      ctx.translate(px, py);
    }
    ctx.beginPath();
    ctx.rect(0, 0, pw, ph);
    ctx.clip();
    const photo = panel && panel.photo >= 0 ? state.photos[panel.photo] : null;
    if (photo) {
      const drawn = drawPanelPhoto(ctx, photo.img, { x: 0, y: 0, w: rect.w, h: rect.h, focus: rect.focus }, panel, w, h);
      const imgData = drawn.octx.getImageData(0, 0, drawn.off.width, drawn.off.height);
      applyGradeToPixels(imgData.data, lut, grade.sat);
      drawn.octx.putImageData(imgData, 0, 0);
      ctx.drawImage(drawn.off, 0, 0, pw, ph);
      // Warm wash over the photo so the grade reads as sunset, not just tint.
      const wash = ctx.createLinearGradient(0, 0, 0, ph);
      wash.addColorStop(0, 'rgba(255, 120, 60, 0.06)');
      wash.addColorStop(1, 'rgba(255, 46, 136, 0.16)');
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, pw, ph);
    } else {
      // Empty panel: a sunset placeholder so the poster still reads.
      const ph2 = ctx.createLinearGradient(0, 0, pw, ph);
      ph2.addColorStop(0, '#ff7a18');
      ph2.addColorStop(0.6, '#ff2e88');
      ph2.addColorStop(1, '#2b0f4d');
      ctx.fillStyle = ph2;
      ctx.fillRect(0, 0, pw, ph);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = `400 ${Math.round(ph * 0.07)}px 'Bebas Neue', sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('ADD A PHOTO', pw / 2, ph / 2);
    }
    ctx.restore();
    // White hairline between panels.
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = gap;
    ctx.strokeRect(px + gap / 2, py + gap / 2, pw - gap, ph - gap);
    ctx.restore();
  });

  // The rising sun: a gradient disc behind the caption, half sunk below the frame.
  const zone = captionZone(w, h);
  const sunR = w * 0.30;
  const sunX = w * 0.5;
  const sunY = h + sunR * 0.28;
  const sun = ctx.createRadialGradient(sunX, sunY - sunR * 0.4, sunR * 0.1, sunX, sunY, sunR);
  sun.addColorStop(0, 'rgba(255, 214, 110, 0.95)');
  sun.addColorStop(0.45, 'rgba(255, 122, 24, 0.85)');
  sun.addColorStop(0.8, 'rgba(255, 46, 136, 0.55)');
  sun.addColorStop(1, 'rgba(255, 46, 136, 0)');
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();

  // Bottom scrim so the lettering always reads.
  const scrim = ctx.createLinearGradient(0, zone.y - h * 0.06, 0, h);
  scrim.addColorStop(0, 'rgba(10, 4, 24, 0)');
  scrim.addColorStop(0.45, 'rgba(10, 4, 24, 0.55)');
  scrim.addColorStop(1, 'rgba(10, 4, 24, 0.88)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, zone.y - h * 0.06, w, h - zone.y + h * 0.06);

  // Lettering: condensed Anton title, Bebas subtitle, gold rule above.
  const title = (state.title || '').trim().toUpperCase();
  if (title) {
    let size = h * 0.115 * state.titleScale;
    ctx.font = `${size}px Anton, 'Arial Narrow', sans-serif`;
    while (ctx.measureText(title).width > w * 0.92 && size > 10) {
      size -= 2;
      ctx.font = `${size}px Anton, 'Arial Narrow', sans-serif`;
    }
    const ty = h - h * 0.075;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    // Neon outline + hard drop shadow for the poster look.
    ctx.lineWidth = Math.max(2, size * 0.09);
    ctx.strokeStyle = '#ff2e88';
    ctx.strokeText(title, w / 2, ty);
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = size * 0.18;
    ctx.shadowOffsetY = size * 0.05;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(title, w / 2, ty);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    // Gold rule above the title.
    const ruleW = Math.min(w * 0.5, ctx.measureText(title).width * 0.7);
    ctx.fillStyle = '#ffc93c';
    ctx.fillRect((w - ruleW) / 2, ty - size * 1.18, ruleW, Math.max(2, h * 0.004));
  }
  const sub = (state.subtitle || '').trim();
  if (sub) {
    const subSize = Math.max(10, h * 0.028);
    ctx.font = `${subSize}px 'Bebas Neue', sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255, 240, 220, 0.95)';
    ctx.fillText(sub.toUpperCase(), w / 2, h - h * 0.032);
  }

  // Neon frame: hot-pink outer line, white inner line.
  ctx.strokeStyle = '#ff2e88';
  ctx.lineWidth = Math.max(3, w * 0.006);
  ctx.strokeRect(w * 0.012, h * 0.012, w * 0.976, h * 0.976);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = Math.max(1, w * 0.002);
  ctx.strokeRect(w * 0.026, h * 0.026, w * 0.948, h * 0.948);

  // Effects.
  if (state.halftone) {
    const step = Math.max(6, Math.round(w * 0.012));
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    for (let y = step / 2; y < h; y += step) {
      for (let x = step / 2; x < w; x += step) {
        ctx.beginPath();
        ctx.arc(x, y, Math.max(1, step * 0.14), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  if (state.vignette) {
    const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.72);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(8,2,18,0.5)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }
  if (state.grain) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = ctx.createPattern(getGrainTile(), 'repeat');
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  return canvas;
}

/** Renders the cover at exact export pixels on a fresh canvas. */
export function exportCover(state, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  drawCover(canvas, state);
  return canvas;
}

/** The panel index under a point (in canvas pixels), or -1. Tilted panels use their unrotated box. */
export function panelAt(state, x, y, w, h) {
  const layout = LAYOUTS[state.layout] ?? LAYOUTS.hero3;
  for (let i = layout.panels.length - 1; i >= 0; i--) {
    const r = layout.panels[i];
    if (x >= r.x * w && x <= (r.x + r.w) * w && y >= r.y * h && y <= (r.y + r.h) * h) return i;
  }
  return -1;
}
