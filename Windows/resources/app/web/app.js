import { createView } from './widgets.js';

const $ = id => document.getElementById(id);
const editor = location.pathname === '/editor';
const COLUMNS = 24;
const ROWS = 12;
const stage = $('stage');
const viewport = $('viewport');
const clip = $('stage-clip');
const track = $('track');
document.body.classList.add(editor ? 'editor' : 'display');

let layout;
let catalog;
let canvases;
let activePage;
let selection;
let stats;
let revision = -1;
let saving = false;
let dirty = false;
let layoutFromHost;
let fitScale = 1;
let pointer;
let wallpaperKey;
let palette;
let toastTimer;
let pairTimer;
const history = [];
const pageViews = new Map();
const localWidgets = new Map();
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

const page = () => layout?.pages.find(item => item.id === activePage);
const canUsePointer = event => event.isPrimary && event.button === 0;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const uuid = () => globalThis.crypto?.randomUUID?.() || Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function notify(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3200);
}

function saved(text, error = false) {
  $('save-state').textContent = text;
  $('save-state').dataset.error = String(error);
}

async function request(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error), { status: response.status, data });
  return data;
}

function post(url, value) {
  return request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
}

function findSpot(widget, occupied) {
  let best = null;
  let distance = Infinity;
  for (let y = 0; y <= ROWS - widget.h; y++) {
    for (let x = 0; x <= COLUMNS - widget.w; x++) {
      const d = Math.abs(x - widget.x) + Math.abs(y - widget.y) * 1.25;
      if (d >= distance) continue;
      const candidate = { ...widget, x, y };
      if (!occupied.some(other => overlaps(other, candidate))) {
        best = candidate;
        distance = d;
      }
    }
  }
  return best;
}

function trimToFit(widget, moved, occupied) {
  if (widget.minimized) return null;
  const right = widget.x + widget.w;
  const bottom = widget.y + widget.h;
  const splitX = moved.x + moved.w;
  const splitY = moved.y + moved.h;
  const sections = [
    { ...widget, w: moved.x - widget.x },
    { ...widget, x: splitX, w: right - splitX },
    { ...widget, h: moved.y - widget.y },
    { ...widget, y: splitY, h: bottom - splitY },
  ];
  return sections
    .filter(section => section.w >= 4 && section.h >= 2 && !occupied.some(other => overlaps(section, other)))
    .sort((a, b) => b.w * b.h - a.w * a.h)[0] || null;
}

function resolveDrop(widgets, moved, allowTrim = false) {
  const remaining = widgets.filter(widget => widget.id !== moved.id);
  const placed = [moved, ...remaining.filter(widget => !overlaps(widget, moved))];
  for (const widget of remaining.filter(widget => overlaps(widget, moved))) {
    const free = findSpot(widget, placed) || (allowTrim && trimToFit(widget, moved, placed));
    if (!free) return null;
    placed.push(free);
  }
  const byId = new Map(placed.map(widget => [widget.id, widget]));
  return widgets.map(widget => byId.get(widget.id));
}

function arrange(widgets) {
  const ordered = [...widgets].sort((a, b) => a.y - b.y || a.x - b.x);
  const normal = ordered.filter(widget => !widget.minimized);
  const small = ordered.filter(widget => widget.minimized);
  const miniRows = Math.ceil(small.length / 6);
  const normalRows = ROWS - miniRows;
  const cols = normal.length <= 2 ? normal.length || 1 : normal.length <= 6 ? 3 : normal.length <= 12 ? 4 : 6;
  const rowCount = Math.ceil(normal.length / cols);
  const positions = new Map();
  for (let row = 0; row < rowCount; row++) {
    const slice = normal.slice(row * cols, (row + 1) * cols);
    const y = Math.floor(row * normalRows / rowCount);
    const h = Math.floor((row + 1) * normalRows / rowCount) - y;
    slice.forEach((widget, index) => {
      const x = Math.floor(index * COLUMNS / slice.length);
      positions.set(widget.id, { x, y, w: Math.floor((index + 1) * COLUMNS / slice.length) - x, h });
    });
  }
  small.forEach((widget, index) => positions.set(widget.id, { x: (index % 6) * 4, y: normalRows + Math.floor(index / 6), w: 4, h: 1 }));
  return widgets.map(widget => ({ ...widget, ...positions.get(widget.id) }));
}

function applySnapshot(snapshot) {
  if (!snapshot?.state || snapshot.state.revision < revision) return;
  if (saving || dirty || pointer?.mode === 'widget') {
    if (!layoutFromHost || snapshot.state.revision >= layoutFromHost.state.revision) layoutFromHost = snapshot;
    return;
  }
  const before = layout && snapshot.state.revision > revision && !reduceMotion.matches ? widgetBounds() : null;
  revision = snapshot.state.revision;
  layout = snapshot.state;
  catalog = snapshot.catalog;
  canvases = snapshot.canvases;
  if (!page()) activePage = layout.pages[0].id;
  render();
  if (before) animatePositions(before);
}

async function save() {
  if (saving || !dirty) return;
  saving = true;
  dirty = false;
  saved('Saving');
  try {
    const result = await post('/api/state', { baseRevision: revision, state: layout });
    revision = result.state.revision;
    if (!dirty) saved('Saved locally');
  } catch (error) {
    dirty = false;
    saved('Changes were not saved', true);
    notify(error.message || 'Could not save the layout.');
    if (error.status === 409) layoutFromHost = error.data;
    else layoutFromHost = await request('/api/state').catch(() => null);
  } finally {
    saving = false;
    if (dirty) save();
    else if (layoutFromHost) {
      const incoming = layoutFromHost;
      layoutFromHost = null;
      applySnapshot(incoming);
    }
  }
}

function mutate(change, animation = false) {
  if (!editor || !layout) return;
  const before = animation && !reduceMotion.matches ? widgetBounds() : null;
  change();
  dirty = true;
  render();
  if (before) animatePositions(before);
  save();
}

function widgetBounds() {
  const current = pageViews.get(activePage);
  return new Map([...current?.widgets.entries() || []].map(([id, entry]) => [id, entry.element.getBoundingClientRect()]));
}

function animatePositions(previous) {
  const widgets = pageViews.get(activePage)?.widgets;
  if (!widgets) return;
  widgets.forEach(({ element }, id) => {
    const before = previous.get(id);
    if (!before) {
      element.animate([{ opacity: 0, transform: 'scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 230 });
      return;
    }
    const after = element.getBoundingClientRect();
    if (!after.width || !after.height) return;
    const x = (before.x - after.x) / fitScale;
    const y = (before.y - after.y) / fitScale;
    const sx = before.width / after.width;
    const sy = before.height / after.height;
    if (Math.abs(x) + Math.abs(y) + Math.abs(sx - 1) + Math.abs(sy - 1) < .01) return;
    element.animate(
      [{ transformOrigin: 'top left', transform: 'translate(' + x + 'px,' + y + 'px) scale(' + sx + ',' + sy + ')' },
        { transformOrigin: 'top left', transform: 'none' }],
      { duration: 270, easing: 'cubic-bezier(.18,.72,.26,1)' },
    );
  });
}

function addWidget(type) {
  const current = page();
  if (current.widgets.length >= 24) return notify('This page is full. Add another page.');
  const def = catalog[type];
  const item = { id: uuid(), type, x: 0, y: 0, w: def.width, h: def.height, minimized: false };
  const spot = findSpot(item, current.widgets);
  selection = item.id;
  mutate(() => { current.widgets = spot ? [...current.widgets, spot] : arrange([...current.widgets, item]); }, true);
  if (!spot) notify('Widgets arranged to make room.');
}

function minimize(widget) {
  const current = page();
  const next = { ...widget, h: widget.minimized ? widget.restoreHeight : 1, minimized: !widget.minimized };
  if (next.minimized) next.restoreHeight = widget.h;
  else delete next.restoreHeight;
  next.y = Math.min(next.y, ROWS - next.h);
  selection = widget.id;
  const placed = resolveDrop(current.widgets, next) || arrange(current.widgets.map(item => item.id === next.id ? next : item));
  mutate(() => { current.widgets = placed; }, true);
}

function selectPage(id) {
  if (!layout?.pages.some(item => item.id === id) || id === activePage) return;
  activePage = id;
  selection = null;
  updatePageNav();
  tick();
}

function addPage() {
  if (layout.pages.length >= 8) return notify('Eight pages are available.');
  const item = { id: uuid(), name: 'Page ' + (layout.pages.length + 1), widgets: [] };
  mutate(() => { layout.pages.push(item); activePage = item.id; selection = null; });
  $('page-name').focus();
  $('page-name').select();
}

function fit() {
  if (!layout || !canvases) return;
  const size = canvases[layout.canvas];
  stage.style.setProperty('--wide', size.width + 'px');
  stage.style.setProperty('--tall', size.height + 'px');
  stage.style.setProperty('--gutter', layout.gap + 'px');
  const room = viewport.getBoundingClientRect();
  fitScale = Math.min(room.width / size.width, room.height / size.height);
  if (!fitScale) return;
  stage.style.setProperty('--scale', fitScale.toFixed(6));
  $('canvas-metrics').textContent = size.label + ' · ' + Math.round(fitScale * 100) + '%';
}

function setWallpaper() {
  const url = layout.wallpaper ? '/wallpaper/' + layout.wallpaper : '/assets/alpine-dusk.png';
  if (url === wallpaperKey) return;
  wallpaperKey = url;
  $('wallpaper').style.backgroundImage = 'url("' + url + '")';
  const image = new Image();
  image.onload = () => {
    if (url !== wallpaperKey) return;
    const sample = document.createElement('canvas');
    sample.width = 48; sample.height = 30;
    const ctx = sample.getContext('2d', { willReadFrequently: true });
    const cover = Math.max(sample.width / image.width, sample.height / image.height);
    const w = image.width * cover, h = image.height * cover;
    ctx.drawImage(image, (48 - w) / 2, (30 - h) / 2, w, h);
    palette = ctx.getImageData(0, 0, 48, 30).data;
    pageViews.forEach(entry => entry.widgets.forEach(rect => colorWidget(rect.element, rect.widget)));
  };
  image.src = url;
}

function colorWidget(element, widget) {
  if (!palette) return;
  const cx = Math.floor(48 * (widget.x + widget.w / 2) / COLUMNS);
  const cy = Math.floor(30 * (widget.y + widget.h / 2) / ROWS);
  const color = [0, 0, 0];
  let pixels = 0;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const offset = (clamp(cy + dy, 0, 29) * 48 + clamp(cx + dx, 0, 47)) * 4;
    for (let channel = 0; channel < 3; channel++) color[channel] += palette[offset + channel];
    pixels++;
  }
  const top = Math.max(...color) / pixels;
  const lift = Math.max(0, 200 - top);
  element.style.setProperty('--edge', color.map(value => Math.round(clamp(value / pixels + lift + 17, 90, 247))).join(', '));
}

function createWidget(widget) {
  const element = document.createElement('article');
  element.className = 'widget';
  element.dataset.widget = widget.id;
  element.dataset.type = widget.type;
  const head = document.createElement('header');
  head.className = 'widget-head';
  head.dataset.drag = 'move';
  const mark = document.createElement('i');
  mark.textContent = catalog[widget.type].mark;
  mark.setAttribute('aria-hidden', 'true');
  const title = document.createElement('span');
  title.className = 'widget-label';
  title.textContent = catalog[widget.type].label;
  head.append(mark, title);
  const body = document.createElement('div');
  body.className = 'widget-body';
  element.append(head, body);
  let minimizeButton;
  if (editor) {
    const tools = document.createElement('span');
    tools.className = 'widget-tools';
    minimizeButton = document.createElement('button');
    minimizeButton.type = 'button';
    minimizeButton.addEventListener('click', () => minimize(entry.widget));
    const remove = document.createElement('button');
    remove.type = 'button'; remove.textContent = '×';
    remove.title = 'Remove widget'; remove.setAttribute('aria-label', 'Remove ' + title.textContent);
    remove.addEventListener('click', () => {
      const current = page();
      mutate(() => { current.widgets = arrange(current.widgets.filter(item => item.id !== entry.widget.id)); selection = null; }, true);
    });
    tools.append(minimizeButton, remove);
    head.append(tools);
    const grip = document.createElement('span');
    grip.className = 'resize-handle'; grip.dataset.drag = 'resize'; grip.title = 'Resize widget';
    element.append(grip);
    element.addEventListener('pointerdown', () => { selection = entry.widget.id; refreshSelection(); });
  }
  if (!localWidgets.has(widget.id)) localWidgets.set(widget.id, {});
  const view = createView(body, widget, localWidgets.get(widget.id), editor, text => {
    mutate(() => { entry.widget.text = text; });
  });
  const entry = { element, body, view, widget, minimizeButton };
  return entry;
}

function refreshSelection() {
  pageViews.forEach(entry => entry.widgets.forEach(rect => rect.element.classList.toggle('selected', editor && selection === rect.widget.id)));
}

function mountPages() {
  const ids = new Set(layout.pages.map(item => item.id));
  const widgetIds = new Set(layout.pages.flatMap(item => item.widgets.map(w => w.id)));
  for (const id of localWidgets.keys()) if (!widgetIds.has(id)) localWidgets.delete(id);
  for (const [id, entry] of pageViews) if (!ids.has(id)) {
    entry.element.remove();
    pageViews.delete(id);
  }
  layout.pages.forEach((item, index) => {
    let entry = pageViews.get(item.id);
    if (!entry) {
      const element = document.createElement('section');
      element.className = 'page';
      element.dataset.page = item.id;
      const grid = document.createElement('div');
      grid.className = 'grid';
      const empty = document.createElement('p');
      empty.className = 'empty-page';
      empty.textContent = editor ? 'Choose a widget from the library.' : 'This page is empty.';
      element.append(grid, empty);
      entry = { element, grid, empty, widgets: new Map() };
      pageViews.set(item.id, entry);
    }
    if (track.children[index] !== entry.element) track.insertBefore(entry.element, track.children[index] || null);
    const wanted = new Set(item.widgets.map(w => w.id));
    for (const [id, rect] of entry.widgets) if (!wanted.has(id)) {
      rect.element.remove();
      entry.widgets.delete(id);
    }
    item.widgets.forEach(widget => {
      let rect = entry.widgets.get(widget.id);
      if (!rect || rect.widget.type !== widget.type || (!editor && rect.widget.text !== widget.text)) {
        rect?.element.remove();
        rect = createWidget(widget);
        entry.widgets.set(widget.id, rect);
        entry.grid.append(rect.element);
      }
      rect.widget = widget;
      rect.element.style.gridColumn = (widget.x + 1) + ' / span ' + widget.w;
      rect.element.style.gridRow = (widget.y + 1) + ' / span ' + widget.h;
      rect.element.classList.toggle('minimized', widget.minimized);
      if (rect.minimizeButton) {
        const label = widget.minimized ? 'Restore widget' : 'Minimize widget';
        rect.minimizeButton.textContent = widget.minimized ? '+' : '−';
        rect.minimizeButton.title = label;
        rect.minimizeButton.setAttribute('aria-label', label);
      }
      colorWidget(rect.element, widget);
    });
    entry.empty.hidden = item.widgets.length > 0;
  });
}

function updatePageNav() {
  const index = layout.pages.findIndex(item => item.id === activePage);
  track.style.setProperty('--page-offset', (-100 * index) + '%');
  layout.pages.forEach(item => {
    pageViews.get(item.id).element.inert = item.id !== activePage;
  });
  for (const nav of [$('stage-pages'), $('editor-pages')]) {
    const names = layout.pages.map(item => item.id + ':' + item.name).join('|');
    if (nav.dataset.names !== names) {
      nav.replaceChildren(...layout.pages.map(item => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = item.name;
        button.dataset.page = item.id;
        button.addEventListener('click', () => selectPage(item.id));
        return button;
      }));
      nav.dataset.names = names;
    }
    for (const button of nav.children) button.setAttribute('aria-current', button.dataset.page === activePage ? 'page' : 'false');
  }
  $('caption-title').textContent = page().name + ' canvas';
  if (document.activeElement !== $('page-name')) $('page-name').value = page().name;
  refreshSelection();
}

function render() {
  fit();
  setWallpaper();
  mountPages();
  updatePageNav();
  $('canvas-size').value = layout.canvas;
  stage.dataset.surface = layout.surface;
  stage.style.setProperty('--surface-color', layout.color);
  $('surface').value = layout.surface;
  $('surface-color').value = layout.color;
  $('color-field').hidden = layout.surface !== 'solid';
  $('gap').value = layout.gap;
  $('gap-value').value = layout.gap + ' px';
  $('wallpaper-reset').disabled = !layout.wallpaper;
  $('add-page').disabled = layout.pages.length >= 8;
  tick();
}

function tick() {
  if (document.hidden) return;
  const active = pageViews.get(activePage);
  const data = { now: Date.now(), stats, history };
  active?.widgets.forEach(rect => { if (!rect.widget.minimized) rect.view.update(data); });
}

function gotoNeighbor(step) {
  const index = layout.pages.findIndex(item => item.id === activePage);
  const next = layout.pages[index + step];
  if (next) selectPage(next.id);
}

function showGhost(gesture, candidate, valid) {
  const grid = gesture.grid;
  const cellW = grid.clientWidth / COLUMNS;
  const cellH = grid.clientHeight / ROWS;
  const gap = layout.gap;
  const ghost = gesture.ghost;
  ghost.dataset.valid = String(valid);
  ghost.style.left = (grid.offsetLeft + candidate.x * cellW + gap / 2) + 'px';
  ghost.style.top = (grid.offsetTop + candidate.y * cellH + gap / 2) + 'px';
  ghost.style.width = (candidate.w * cellW - gap) + 'px';
  ghost.style.height = (candidate.h * cellH - gap) + 'px';
}

clip.addEventListener('pointerdown', event => {
  if (!layout || pointer || !canUsePointer(event) || event.target.closest('button,input,textarea,select,a')) return;
  const drag = event.target.closest('[data-drag]');
  const widgetElement = event.target.closest('[data-widget]');
  const origin = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  if (editor && drag && widgetElement) {
    const grid = pageViews.get(activePage).grid;
    const widget = page().widgets.find(item => item.id === widgetElement.dataset.widget);
    const ghost = document.createElement('div');
    ghost.className = 'ghost'; ghost.hidden = true;
    grid.parentElement.append(ghost);
    pointer = { ...origin, mode: 'widget', kind: drag.dataset.drag, widgetElement, widget, ghost, grid };
  } else pointer = { ...origin, mode: 'swipe' };
  clip.setPointerCapture(event.pointerId);
});

clip.addEventListener('pointermove', event => {
  if (pointer?.pointerId !== event.pointerId) return;
  const x = (event.clientX - pointer.x) / fitScale;
  const y = (event.clientY - pointer.y) / fitScale;
  if (pointer.mode === 'swipe') {
    if (!pointer.moved && (Math.abs(x) < 12 || Math.abs(x) < Math.abs(y))) return;
    pointer.moved = true;
    pointer.swipe = x;
    const at = layout.pages.findIndex(item => item.id === activePage);
    const edge = (x > 0 && at === 0) || (x < 0 && at === layout.pages.length - 1);
    track.classList.add('is-swiping');
    track.style.setProperty('--swipe', (edge ? x * .18 : x) + 'px');
    return;
  }
  if (!pointer.moved && Math.hypot(x, y) < 5) return;
  pointer.moved = true;
  const { grid, widget, widgetElement } = pointer;
  const dx = Math.round(x / (grid.clientWidth / COLUMNS));
  const dy = Math.round(y / (grid.clientHeight / ROWS));
  const candidate = { ...widget };
  if (pointer.kind === 'resize') {
    candidate.w = clamp(widget.w + dx, 4, COLUMNS - widget.x);
    candidate.h = clamp(widget.h + dy, 2, ROWS - widget.y);
  } else {
    candidate.x = clamp(widget.x + dx, 0, COLUMNS - widget.w);
    candidate.y = clamp(widget.y + dy, 0, ROWS - widget.h);
    widgetElement.classList.add('dragging');
    widgetElement.style.transform = 'translate(' + x + 'px,' + y + 'px)';
  }
  pointer.placed = resolveDrop(page().widgets, candidate, pointer.kind === 'resize');
  pointer.ghost.hidden = false;
  showGhost(pointer, candidate, !!pointer.placed);
});

function finishGesture(event, cancelled) {
  if (pointer?.pointerId !== event.pointerId) return;
  const gesture = pointer;
  pointer = null;
  if (gesture.mode === 'swipe') {
    track.classList.remove('is-swiping');
    track.style.removeProperty('--swipe');
    if (!cancelled && Math.abs(gesture.swipe) > 65) gotoNeighbor(gesture.swipe > 0 ? -1 : 1);
    return;
  }
  gesture.ghost.remove();
  gesture.widgetElement.classList.remove('dragging');
  const before = !cancelled && gesture.placed && !reduceMotion.matches ? widgetBounds() : null;
  gesture.widgetElement.style.transform = '';
  if (!cancelled && gesture.placed) {
    const current = page();
    mutate(() => { current.widgets = gesture.placed; });
    if (before) animatePositions(before);
  } else {
    if (!cancelled && gesture.moved) notify('That position would overlap another widget.');
    if (layoutFromHost && !saving && !dirty) {
      const incoming = layoutFromHost;
      layoutFromHost = null;
      applySnapshot(incoming);
    }
  }
}
clip.addEventListener('pointerup', event => finishGesture(event, false));
clip.addEventListener('pointercancel', event => finishGesture(event, true));
clip.addEventListener('lostpointercapture', event => finishGesture(event, true));
window.addEventListener('keydown', event => {
  if (!layout || $('pair-dialog').open || (event.target instanceof Element && event.target.closest('input,textarea,select,button'))) return;
  if (event.key === 'ArrowLeft') gotoNeighbor(-1);
  else if (event.key === 'ArrowRight') gotoNeighbor(1);
});

function showOnline(online) {
  $('connection').dataset.online = String(online);
  $('connection').lastElementChild.textContent = online ? 'Connected to Windows' : 'Reconnecting';
}

function fillEditor() {
  if (!editor) return;
  for (const [type, meta] of Object.entries(catalog)) {
    const add = document.createElement('button');
    add.type = 'button';
    add.setAttribute('aria-label', 'Add ' + meta.label);
    const mark = document.createElement('i');
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = meta.mark;
    const name = document.createElement('span');
    name.textContent = meta.label;
    add.append(mark, name);
    add.addEventListener('click', () => addWidget(type));
    $('catalog').append(add);
  }
  for (const [id, size] of Object.entries(canvases)) $('canvas-size').add(new Option(size.label, id));
  $('canvas-size').value = layout.canvas;
}

function renderPair(info) {
  const addresses = info.addresses.length ? info.addresses : ['127.0.0.1'];
  $('pair-addresses').replaceChildren(...addresses.map(ip => {
    const code = document.createElement('code');
    code.textContent = ip + ':' + info.port;
    return code;
  }));
  $('pair-code').textContent = info.code || '—';
  $('pair-status').textContent = (info.code ? 'Code expires in ' + Math.max(0, Math.ceil((info.expires - Date.now()) / 1000)) + 's. ' : '') +
    info.viewers + (info.viewers === 1 ? ' viewer' : ' viewers') + ' paired.';
  $('unpair').disabled = !info.viewers && !info.code;
}

async function newPair() {
  try { renderPair(await post('/api/pair', {})); }
  catch (error) { $('pair-status').textContent = error.message || 'Pairing could not start.'; }
}

function bindEditor() {
  $('surface').onchange = event => mutate(() => { layout.surface = event.target.value; });
  $('surface-color').onchange = event => mutate(() => { layout.color = event.target.value; });
  $('toggle-library').onclick = () => document.body.classList.toggle('library-hidden');
  $('open-display').onclick = () => window.glassDeck ? window.glassDeck.openDisplay() : window.open('/display', '_blank', 'noopener');
  $('canvas-size').onchange = event => mutate(() => { layout.canvas = event.target.value; });
  $('gap').oninput = event => {
    const gap = Number(event.target.value);
    stage.style.setProperty('--gutter', gap + 'px');
    $('gap-value').value = gap + ' px';
  };
  $('gap').onchange = event => mutate(() => { layout.gap = Number(event.target.value); });
  $('arrange').onclick = () => mutate(() => { page().widgets = arrange(page().widgets); }, true);
  $('add-page').onclick = addPage;
  $('page-name').onchange = event => {
    const name = event.target.value.trim();
    if (name) mutate(() => { page().name = name; });
    else event.target.value = page().name;
  };
  $('wallpaper-pick').onclick = () => $('wallpaper-file').click();
  $('wallpaper-reset').onclick = () => mutate(() => { layout.wallpaper = null; });
  $('wallpaper-file').onchange = async event => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) return notify('Choose an image under 6 MB.');
    try {
      const uploaded = await request('/api/wallpaper', { method: 'POST', body: file });
      mutate(() => { layout.wallpaper = uploaded.file; });
    } catch (error) { notify(error.message); }
  };
  $('pair-tablet').onclick = async () => {
    if (!$('pair-dialog').open) $('pair-dialog').showModal();
    await newPair();
    if (!$('pair-dialog').open || pairTimer) return;
    pairTimer = setInterval(() => request('/api/pair').then(renderPair).catch(() => {}), 1000);
  };
  $('close-pair').onclick = () => $('pair-dialog').close();
  $('pair-dialog').addEventListener('close', () => { clearInterval(pairTimer); pairTimer = null; });
  $('new-code').onclick = newPair;
  $('unpair').onclick = () => post('/api/unpair', {}).then(renderPair).catch(error => notify(error.message));
}

async function start() {
  try {
    applySnapshot(await request('/api/state'));
    fillEditor();
    if (editor) { bindEditor(); saved('Saved locally'); }
    const events = new EventSource('/api/events');
    events.onopen = () => showOnline(true);
    events.onerror = () => showOnline(false);
    events.addEventListener('layout', event => applySnapshot(JSON.parse(event.data)));
    events.addEventListener('stats', event => {
      stats = JSON.parse(event.data);
      history.push(stats.cpu);
      if (history.length > 36) history.shift();
      tick();
    });
    if ('ResizeObserver' in window) new ResizeObserver(fit).observe(viewport);
    else window.addEventListener('resize', fit);
    setInterval(tick, 250);
    document.addEventListener('visibilitychange', tick);
  } catch (error) {
    saved('Could not open the layout', true);
    notify(error.message || 'Could not connect to Windows.');
  }
}

start();
