'use strict';

const { randomUUID } = require('node:crypto');

const COLUMNS = 24;
const ROWS = 12;
const CANVASES = Object.freeze({
  tablet: { width: 1280, height: 800, label: '1280 × 800' },
  wide: { width: 1280, height: 720, label: '1280 × 720' },
});
const CATALOG = Object.freeze({
  clock: { label: 'Clock', mark: '◷', width: 7, height: 5 },
  telemetry: { label: 'Performance', mark: '⌁', width: 10, height: 5 },
  mixer: { label: 'Audio preview', mark: '≋', width: 7, height: 5 },
  media: { label: 'Now playing', mark: '♪', width: 8, height: 7 },
  shortcuts: { label: 'Quick controls', mark: '⊞', width: 8, height: 7 },
  focus: { label: 'Focus timer', mark: '◉', width: 8, height: 7 },
  notes: { label: 'Notes', mark: '≡', width: 7, height: 5 },
  weather: { label: 'Weather preview', mark: '☼', width: 7, height: 5 },
});

const place = (type, x, y, w, h) => ({ id: randomUUID(), type, x, y, w, h, minimized: false });
function defaults() {
  return {
    version: 1, revision: 0, canvas: 'tablet', gap: .1, surface: "glass", color: "#353538", appearanceVersion: 2, wallpaper: null,
    pages: [
      {
        id: 'desk', name: 'Desk',
        widgets: [
          place('clock', 0, 0, 7, 5), place('telemetry', 7, 0, 10, 5), place('mixer', 17, 0, 7, 5),
          place('media', 0, 5, 8, 7), place('shortcuts', 8, 5, 8, 7), place('focus', 16, 5, 8, 7),
        ],
      },
      {
        id: 'studio', name: 'Studio',
        widgets: [
          place('weather', 0, 0, 7, 5), place('notes', 7, 0, 10, 5), place('clock', 17, 0, 7, 5),
          place('telemetry', 0, 5, 12, 7), place('shortcuts', 12, 5, 12, 7),
        ],
      },
    ],
  };
}

const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x &&
  a.y < b.y + b.h && a.y + a.h > b.y;
const idPattern = /^[a-zA-Z0-9_-]{1,64}$/;
const wallpaperPattern = /^wall-[a-f0-9]{24}\.(?:jpg|png|webp)$/;
const between = (n, low, high) => Number.isInteger(n) && n >= low && n <= high;

function normalize(input, revision) {
  if (!input || input.version !== 1 || !Object.hasOwn(CANVASES, input.canvas)
    || !(Number.isFinite(input.gap) && input.gap >= .1 && input.gap <= 28) || !Array.isArray(input.pages) || !between(input.pages.length, 1, 8)) {
    throw new Error('Invalid canvas or pages.');
  }
  const ids = new Set();
  const pages = input.pages.map(page => {
    if (!page || typeof page.id !== 'string' || !idPattern.test(page.id) || ids.has(page.id)
      || typeof page.name !== 'string' || !page.name.trim() || page.name.length > 24
      || !Array.isArray(page.widgets) || page.widgets.length > 24) throw new Error('Invalid page.');
    ids.add(page.id);
    const widgets = [];
    for (const w of page.widgets) {
      if (!w || typeof w.id !== 'string' || !idPattern.test(w.id) || ids.has(w.id) || !Object.hasOwn(CATALOG, w.type)
        || !between(w.w, 4, COLUMNS) || !between(w.h, w.minimized === true ? 1 : 2, ROWS)
        || !between(w.x, 0, COLUMNS - w.w) || !between(w.y, 0, ROWS - w.h)
        || widgets.some(other => overlaps(other, w))) throw new Error('Widgets must fit without overlapping.');
      ids.add(w.id);
      const widget = { id: w.id, type: w.type, x: w.x, y: w.y, w: w.w, h: w.h, minimized: w.minimized === true };
      if (widget.minimized) {
        if (widget.h !== 1 || !between(w.restoreHeight, 2, ROWS)) throw new Error('Invalid minimized widget.');
        widget.restoreHeight = w.restoreHeight;
      }
      if (w.type === 'notes' && typeof w.text === 'string') widget.text = w.text.slice(0, 600);
      widgets.push(widget);
    }
    return { id: page.id, name: page.name.trim(), widgets };
  });
  if (input.wallpaper !== null && (typeof input.wallpaper !== 'string' || !wallpaperPattern.test(input.wallpaper))) {
    throw new Error('Invalid wallpaper.');
  }
  return { version: 1, revision, canvas: input.canvas, gap: input.appearanceVersion === 2 ? input.gap : .1, appearanceVersion: 2, surface: input.surface === "solid" ? "solid" : "glass", color: /^#[0-9a-f]{6}$/i.test(input.color) ? input.color : "#353538", wallpaper: input.wallpaper, pages };
}

module.exports = { defaults, normalize, CATALOG, CANVASES, COLUMNS, ROWS, wallpaperPattern };
