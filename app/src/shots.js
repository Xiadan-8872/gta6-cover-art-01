// Fixed scenes for screenshots: ?shot=editor shows the page with a sample
// photo; ?shot=cover shows the cover alone. `photo` picks the sample
// (samples/<photo>.jpg), `caption` the title, `size` the cover pixels
// (e.g. 1080x1350). window.__shotReady is set once painted.
export async function runShot(shot, query, load) {
  const size = (query.get('size') ?? '1080x1350').split('x').map(Number);
  const canvas = document.getElementById('cover');
  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    if (size.length === 2 && size.every((n) => Number.isFinite(n) && n > 0)) {
      canvas.width = size[0];
      canvas.height = size[1];
    }
  }
  await load(`samples/${query.get('photo') ?? 'pier'}.jpg`, query.get('caption') ?? 'Sunset Heist');
  await document.fonts.ready;
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
