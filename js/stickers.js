/* ============================================================
   STICKERS.JS — your own pictures, stuck onto any screen
   ============================================================

   A sticker is a picture placed on a page. It can be dragged, resized,
   rotated, faded, locked, put behind or in front of the page's content, and
   either cut off at its pane's edges or allowed to spill over them.

   WHERE A STICKER BELONGS. Every sticker records the route it was placed on,
   the pane it was dropped in (its "host"), and — for the detail pane of a
   library — which folder, program or set that pane was showing (its "sub").
   It is shown again whenever all three match. So each folder of the Coding
   Library keeps its own stickers, the folder tree keeps one set for the whole
   library, and an attempt screen keeps one set for every attempt made on it,
   whatever the program.

   STUCK TO THE PAGE, NOT THE WINDOW. A cut-off sticker lives INSIDE its pane,
   so the browser scrolls it with the cards and text around it on the same
   frame. Behind = z-index -1 in a pane made a stacking context: above the
   pane's own background, under everything in it. In front = z-index 40.

   Each pane's stickers sit in a wrapper that is sized to the pane's content
   and clips (overflow: clip), so a sticker hanging past the end cannot grow
   the pane's scrollbars. The wrapper is NOT a stacking context, on purpose:
   one was, and Chrome then composited it as a single layer the size of the
   whole page (2 megapixels on Home). Without one, a sticker that needs a
   layer gets one the size of the sticker.

   The wrapper's height comes from a ResizeObserver on the pane and its
   children, read from their boxes. It used to be re-measured after DOM
   changes by collapsing the wrapper and reading scrollHeight, which forced a
   layout of the whole page several times a second on a busy screen.

   A sticker that spills over the edges cannot live inside the pane (a scroll
   container always clips what is in it), so it goes in one fixed layer over
   the whole app and follows its pane's scroll by transform.

   STORAGE. Placements are small and live in localStorage (ssp.stickers).
   Pictures are big and live in IndexedDB, on this device only.
   ============================================================ */

const STK_KEY = 'ssp.stickers';
const STK_TRAY_KEY = 'ssp.stickers.tray';
const STK_DB_NAME = 'ssp-stickers';
const STK_MAX_SIDE = 2000;          // pictures bigger than this are scaled down once, on the way in
const STK_START_SIDE = 220;         // a new sticker's longest side
const STK_MIN_SIDE = 16;
/* Panes that are always hosts, even when they do not scroll (the folder tree's
   header, the attempt's panes). Anything else qualifies by being a large
   scroll container — see _stkIsHost. */
const STK_PANE_SEL = '.messenger-pane-1, .messenger-pane-2, .practice-sidebar, .practice-panel, .practice-editor-area';
const STK_NEVER_HOST = 'textarea, input, select, pre, code, svg, canvas, iframe, video, button';
/* Classes that come and go on an element, so cannot name it. */
const STK_VOLATILE = /^(is-|has-|stk-|amb-|route-|fade|stagger|active$|open$|hidden$|show$|visible$|selected$|expanded$|collapsed$|zen$|loading|dragging|focus)/;

let _stkItems = [];                 // every placed sticker, on every page
const _stkImgs = new Map();         // picture id -> { id, url, w, h, name }
const _stkEls = new Map();          // sticker id -> its element (kept while off screen)
const _stkHosts = new Set();        // panes holding a sticker layer right now
const _stkKidsDirty = new Set();    // hosts whose direct children changed since the last sync
let _stkReady = false;
let _stkMode = false;               // the tray is open and every sticker can be picked
let _stkSel = null;                 // id of the selected sticker
let _stkDrag = null;                // the gesture in progress
let _stkQueued = false;
let _stkScrollQueued = false;
let _stkSaveTimer = null;
let _stkSaveWarned = false;
let _stkDbPromise = null;
let _stkRo = null;
let _stkLastPage = null;            // what the tray's page strip last showed; null = draw it next sync
let _stkTargetShown = null;         // the pane outlined while something is carried

/* ── Small helpers ───────────────────────────────────────── */

/* The storage picker covers the whole app while it is up, so it is a page of
   its own: its stickers belong to route 'picker', on the picker itself. */
function _stkPicker() {
  return !!(document.body && document.body.classList.contains('picker-open')) && document.getElementById('storage-mode-popup');
}
function _stkRoot() { return _stkPicker() || document.getElementById('spa-content'); }
function _stkRoute() { return _stkPicker() ? 'picker' : ((document.body && document.body.dataset.route) || ''); }
function _stkById(id) { return _stkItems.find(s => s.id === id) || null; }
function _stkUid(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

/** A Lucide icon as markup, for UI built here rather than by a route template. */
function _stkIco(name, size) {
  try {
    const key = name.replace(/(^|-)(\w)/g, (m, a, c) => c.toUpperCase());
    const node = (typeof lucide !== 'undefined') && lucide.icons && lucide.icons[key];
    if (node && lucide.createElement) {
      const svg = lucide.createElement(node);
      svg.setAttribute('width', size || 16);
      svg.setAttribute('height', size || 16);
      svg.setAttribute('aria-hidden', 'true');
      return svg.outerHTML;
    }
  } catch (e) { /* no icon is better than no button */ }
  return '';
}

function _stkTyping() {
  const a = document.activeElement;
  if (!a || a === document.body) return false;
  if (a.isContentEditable) return true;
  if (a.tagName === 'TEXTAREA' || a.tagName === 'SELECT') return true;
  if (a.tagName === 'INPUT') return !/^(range|checkbox|radio|button|submit|file|color)$/i.test(a.type);
  return false;
}

/* ── Storage: placements ─────────────────────────────────── */

function _stkLoad() {
  try {
    const raw = JSON.parse(localStorage.getItem(STK_KEY) || 'null');
    _stkItems = raw && Array.isArray(raw.items) ? raw.items.filter(s => s && s.id && s.img) : [];
  } catch (e) { _stkItems = []; }
}

function _stkSave() {
  clearTimeout(_stkSaveTimer);
  _stkSaveTimer = setTimeout(_stkSaveNow, 200);
}

function _stkSaveNow() {
  clearTimeout(_stkSaveTimer);
  _stkSaveTimer = null;
  try {
    localStorage.setItem(STK_KEY, JSON.stringify({ v: 1, items: _stkItems }));
    _stkSaveWarned = false;
  } catch (e) {
    console.warn('[Stickers] Could not save placements:', e);
    if (!_stkSaveWarned && typeof toast === 'function') {
      _stkSaveWarned = true;
      toast('Stickers could not be saved: the app\'s storage in this browser is full. Settings shows how much is used.', { type: 'error', duration: 7000 });
    }
  }
}

/* ── Storage: pictures (IndexedDB) ───────────────────────── */

function _stkDb() {
  if (_stkDbPromise) return _stkDbPromise;
  _stkDbPromise = new Promise((resolve, reject) => {
    let req;
    try { req = indexedDB.open(STK_DB_NAME, 1); } catch (e) { reject(e); return; }
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains('images')) req.result.createObjectStore('images', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
  _stkDbPromise.catch(() => {});
  return _stkDbPromise;
}

function _stkIdb(mode, fn) {
  return _stkDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction('images', mode);
    const req = fn(tx.objectStore('images'));
    tx.oncomplete = () => resolve(req && 'result' in req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

function _stkRememberImg(rec) {
  const old = _stkImgs.get(rec.id);
  if (old && old.url) URL.revokeObjectURL(old.url);
  _stkImgs.set(rec.id, { id: rec.id, url: URL.createObjectURL(rec.blob), w: rec.w, h: rec.h, name: rec.name || '', added: rec.added || 0 });
}

/** Read the pictures in. With `onlyNew`, keep the ones already in memory (another tab added some). */
async function _stkLoadImages(onlyNew) {
  try {
    const all = await _stkIdb('readonly', st => st.getAll());
    (all || []).forEach(rec => { if (!onlyNew || !_stkImgs.has(rec.id)) _stkRememberImg(rec); });
  } catch (e) {
    console.warn('[Stickers] Pictures could not be read:', e);
  }
}

/** Read a picture's size and, if it is huge, scale it down once so it is not decoded at full size on every page. */
function _stkPrepare(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      let w = im.naturalWidth || 300, h = im.naturalHeight || 300;
      const animated = /gif|svg/i.test(file.type);
      if (animated || Math.max(w, h) <= STK_MAX_SIDE) {
        URL.revokeObjectURL(url);
        resolve({ blob: file, w, h });
        return;
      }
      const k = STK_MAX_SIDE / Math.max(w, h);
      w = Math.round(w * k); h = Math.round(h * k);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(im, 0, 0, w, h);
      URL.revokeObjectURL(url);
      // WebP keeps a PNG's see-through background and is far smaller.
      c.toBlob(b => resolve({ blob: b || file, w, h }), 'image/webp', 0.92);
    };
    im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Not a picture this browser can read')); };
    im.src = url;
  });
}

async function _stkAddFiles(files) {
  const list = Array.from(files || []).filter(f => f && /^image\//.test(f.type));
  const added = [];
  for (const f of list) {
    try {
      const p = await _stkPrepare(f);
      const rec = { id: _stkUid('si_'), blob: p.blob, w: p.w, h: p.h, name: f.name || 'picture', added: Date.now() };
      try { await _stkIdb('readwrite', st => st.put(rec)); }
      catch (e) {
        if (typeof toast === 'function') toast('This picture can be used now, but this browser would not save it for next time.', { type: 'warning' });
      }
      _stkRememberImg(rec);
      added.push(rec.id);
    } catch (e) {
      if (typeof toast === 'function') toast((f.name || 'That file') + ' could not be read as a picture.', { type: 'error' });
    }
  }
  if (added.length) _stkTrayRender();
  return added;
}

async function _stkForgetImage(id) {
  const img = _stkImgs.get(id);
  if (img && img.url) URL.revokeObjectURL(img.url);
  _stkImgs.delete(id);
  try { await _stkIdb('readwrite', st => st.delete(id)); } catch (e) { /* already gone */ }
}

/** How many bytes the sticker pictures take (Settings' storage meter). */
function stkPictureBytes() {
  return _stkIdb('readonly', st => st.getAll())
    .then(all => (all || []).reduce((n, r) => n + ((r && r.blob && r.blob.size) || 0), 0))
    .catch(() => 0);
}

/** Every sticker and every picture, gone. Reset Data calls this. */
function stkResetAll() {
  clearTimeout(_stkSaveTimer);
  _stkSaveTimer = null;
  _stkItems = [];
  _stkSel = null;
  _stkEls.forEach(el => el.remove());
  _stkEls.clear();
  _stkImgs.forEach(m => { if (m.url) URL.revokeObjectURL(m.url); });
  _stkImgs.clear();
  try { localStorage.removeItem(STK_KEY); localStorage.removeItem(STK_TRAY_KEY); } catch (e) { /* nothing to remove */ }
  _stkSync();
  return _stkIdb('readwrite', st => st.clear()).catch(() => {});
}

/* ── Hosts: which pane a sticker belongs to ──────────────── */

function _stkIsHost(el) {
  if (el.matches(STK_PANE_SEL)) return true;
  if (el.matches(STK_NEVER_HOST)) return false;
  const cs = getComputedStyle(el);
  if (!/(auto|scroll)/.test(cs.overflowY)) return false;
  return el.clientWidth >= 280 && el.clientHeight >= 200;
}

/** The pane under a point: the nearest large scroll container or known pane, else the whole page.
 *  `cache` (a Map) remembers which elements are panes for the length of one drag. */
function _stkHostAt(x, y, cache) {
  const root = _stkRoot();
  if (!root) return null;
  // The topmost element is enough unless something outside the page is on top.
  let el = document.elementFromPoint(x, y);
  if (!el || !root.contains(el) || el === root) {
    el = document.elementsFromPoint(x, y).find(e => root.contains(e) && e !== root);
  }
  for (; el && el !== root; el = el.parentElement) {
    let ok = cache ? cache.get(el) : undefined;
    if (ok === undefined) {
      ok = _stkIsHost(el);
      if (cache) cache.set(el, ok);
    }
    if (ok) return el;
  }
  return root;
}

/** A name for a host that finds the same pane again after the page is rebuilt. */
function _stkHostKey(el) {
  const root = _stkRoot();
  if (!el || el === root) return 'page';
  if (el.id && !/\d{4,}/.test(el.id)) return '#' + el.id;
  const cls = Array.from(el.classList).find(c => !STK_VOLATILE.test(c));
  const sel = el.tagName.toLowerCase() + (cls ? '.' + CSS.escape(cls) : '');
  const i = Array.from(root.querySelectorAll(sel)).indexOf(el);
  return i > 0 ? sel + '@' + i : sel;
}

function _stkFindHost(key) {
  const root = _stkRoot();
  if (!root || !key) return null;
  if (key === 'page') return root;
  if (key[0] === '#') {
    const el = document.getElementById(key.slice(1));
    return el && root.contains(el) ? el : null;
  }
  const at = key.lastIndexOf('@');
  const sel = at > 0 ? key.slice(0, at) : key;
  const i = at > 0 ? parseInt(key.slice(at + 1), 10) || 0 : 0;
  try { return root.querySelectorAll(sel)[i] || null; } catch (e) { return null; }
}

/* What a library's detail pane is showing. Each library keeps its own
   selection in its own top-level variable; read them guarded, since a
   library's script may not be the one in use. */
const STK_SUBS = {
  browse: () => (typeof browseActiveSetId !== 'undefined' && browseActiveSetId) ? 's:' + browseActiveSetId
    : (typeof browseActiveProgramId !== 'undefined' && browseActiveProgramId) ? 'p:' + browseActiveProgramId
    : 'f:' + ((typeof browseActiveNodeId !== 'undefined' && browseActiveNodeId) || ''),
  study: () => 'f:' + ((typeof activeNotebookFolderId !== 'undefined' && activeNotebookFolderId) || ''),
  snippets: () => 'f:' + ((typeof activeSnippetFolderId !== 'undefined' && activeSnippetFolderId) || ''),
  typing: () => 'v:' + ((typeof mtlView !== 'undefined' && mtlView) || ''),
  language: () => 'v:' + ((typeof langView !== 'undefined' && langView) || '') + ':' + ((typeof langActiveWordId !== 'undefined' && langActiveWordId) || ''),
};

function _stkSubFn(route) {
  if (STK_SUBS[route]) return STK_SUBS[route];
  if (route.indexOf('analytics-') === 0) {
    return () => 'f:' + ((typeof activeAnalyticsFolderScope !== 'undefined' && activeAnalyticsFolderScope) || '') + ':' +
      ((typeof activeAnalyticsFolderId !== 'undefined' && activeAnalyticsFolderId) || '');
  }
  const isWing = typeof LIBRARY_WINGS !== 'undefined' && LIBRARY_WINGS.some(w => w.key === route);
  if (isWing) {
    return () => 'f:' + ((typeof _wingFolderId !== 'undefined' && _wingFolderId) || '') + ':' +
      ((typeof _wingActiveId !== 'undefined' && _wingActiveId) || '');
  }
  return null;
}

/** Only the detail pane changes with the selection; the tree and single-pane pages are one set each. */
function _stkSub(route, host) {
  if (!host || !host.closest || !host.closest('.messenger-pane-2')) return '';
  const fn = _stkSubFn(route);
  if (!fn) return '';
  try { return String(fn()); } catch (e) { return ''; }
}

/** Where (0,0) of a host's content is on screen right now. */
function _stkOrigin(host) {
  const r = host.getBoundingClientRect();
  return { x: r.left + host.clientLeft - host.scrollLeft, y: r.top + host.clientTop - host.scrollTop };
}

/* ── Which stickers are on screen ────────────────────────── */

function _stkVisible() {
  const route = _stkRoute();
  const hosts = new Map();
  const out = [];
  if (!route) return out;
  for (const it of _stkItems) {
    if (it.route !== route) continue;
    let h = hosts.get(it.host);
    if (h === undefined) {
      const el = _stkFindHost(it.host);
      h = el ? { el, sub: _stkSub(route, el) } : null;
      hosts.set(it.host, h);
    }
    if (!h || (it.sub || '') !== h.sub) continue;
    if (!_stkImgs.has(it.img)) continue;
    out.push({ it, host: h.el });
  }
  return out;
}

/* ── Panes that hold stickers ────────────────────────────── */

function _stkFloat() {
  let f = document.getElementById('stk-float');
  if (!f) {
    f = document.createElement('div');
    f.id = 'stk-float';
    f.setAttribute('aria-hidden', 'true');
    document.body.appendChild(f);
  }
  return f;
}

function _stkLayer(host, which) {
  let L = host.querySelector(':scope > .stk-layer-' + which);
  if (!L) {
    L = document.createElement('div');
    L.className = 'stk-layer stk-layer-' + which;
    L.setAttribute('aria-hidden', 'true');
    // Last, not first: some panes' children are styled by :first-child and
    // :nth-child, and the layers are absolute so their place in the list does
    // not move anything. Behind-stickers still paint over .amb-pin, which is
    // also z-index -1 and the pane's first child.
    host.appendChild(L);
    _stkSizeLayers(host);
  }
  return L;
}

function _stkAttach(host) {
  _stkHosts.add(host);
  host.classList.add('stk-host');
  if (getComputedStyle(host).position === 'static') host.classList.add('stk-host-rel');
  if (_stkRo) _stkRo.observe(host);
  _stkObserveKids(host);
  _stkSizeLayers(host);
}

function _stkDetach(host) {
  _stkHosts.delete(host);
  _stkKidsDirty.delete(host);
  host.querySelectorAll(':scope > .stk-layer').forEach(L => L.remove());
  host.classList.remove('stk-host', 'stk-host-rel', 'stk-host-back');
  if (_stkRo) {
    _stkRo.unobserve(host);
    (host._stkObs || []).forEach(c => _stkRo.unobserve(c));
  }
  host._stkObs = null;
}

/** Watch the host's own children: their size is the content's size, so they say when the layers must grow or shrink. */
function _stkObserveKids(host) {
  if (!_stkRo) return;
  const now = new Set(Array.from(host.children).filter(c => !c.classList.contains('stk-layer')));
  const was = host._stkObs || new Set();
  was.forEach(c => { if (!now.has(c)) _stkRo.unobserve(c); });
  now.forEach(c => { if (!was.has(c)) _stkRo.observe(c); });
  host._stkObs = now;
}

/** How tall a host's content is, from its children's boxes — never by collapsing the layers and reading scrollHeight. */
function _stkContentHeight(host) {
  const cs = getComputedStyle(host);
  let h = host.clientHeight;
  if (!/(auto|scroll)/.test(cs.overflowY)) return h;
  const pb = parseFloat(cs.paddingBottom) || 0;
  const visit = (parent) => {
    for (const c of parent.children) {
      if (c.classList.contains('stk-layer')) continue;
      const ccs = getComputedStyle(c);
      if (ccs.display === 'none' || ccs.position === 'fixed') continue;
      if (ccs.display === 'contents') { visit(c); continue; }
      const flowing = ccs.position !== 'absolute';
      h = Math.max(h, c.offsetTop + c.offsetHeight + (flowing ? (parseFloat(ccs.marginBottom) || 0) + pb : 0));
    }
  };
  visit(host);
  return Math.ceil(h);
}

function _stkSizeLayers(host) {
  const layers = host.querySelectorAll(':scope > .stk-layer');
  if (!layers.length) return;
  const w = host.clientWidth;
  const h = _stkContentHeight(host);
  layers.forEach(L => {
    if (L._w !== w) { L._w = w; L.style.width = w + 'px'; }
    if (L._h !== h) { L._h = h; L.style.height = h + 'px'; }
  });
}

/* ── Sticker elements ────────────────────────────────────── */

function _stkEl(it) {
  let el = _stkEls.get(it.id);
  if (!el) {
    el = document.createElement('div');
    el.className = 'stk-sticker';
    el.dataset.stk = it.id;
    el._stk = {};
    const im = document.createElement('img');
    im.alt = '';
    im.draggable = false;
    im.decoding = 'async';
    el.appendChild(im);
    el.addEventListener('pointerdown', _stkOnStickerDown);
    el.addEventListener('dblclick', e => { e.stopPropagation(); });
    _stkEls.set(it.id, el);
  }
  return el;
}

function _stkSpillTf(it, o) {
  return 'translate(' + (o.x + it.x) + 'px,' + (o.y + it.y) + 'px)' + (it.rot ? ' rotate(' + it.rot + 'deg)' : '');
}

/** Bring an element in line with its record, writing only what changed. */
function _stkApply(it, el) {
  const c = el._stk || (el._stk = {});
  const set = (k, v, write) => { if (c[k] !== v) { c[k] = v; write(v); } };
  const img = _stkImgs.get(it.img);
  if (img) set('src', img.url, v => el.firstChild.setAttribute('src', v));
  set('w', it.w, v => { el.style.width = v + 'px'; });
  set('h', it.h, v => { el.style.height = v + 'px'; });
  set('op', it.op == null ? 1 : it.op, v => { el.style.opacity = String(v); });
  const spill = it.edge === 'spill';
  const back = !spill && it.layer === 'back';
  set('zi', spill ? String(it.z || 1) : (back ? '-1' : '40'), v => { el.style.zIndex = v; });
  set('lock', !!it.lock, v => el.classList.toggle('is-locked', v));
  set('sel', it.id === _stkSel, v => el.classList.toggle('is-selected', v));
  set('behind', back, v => el.classList.toggle('is-behind', v));
  set('pos', spill ? 'spill' : 'clip', v => {
    if (v === 'spill') {
      // Placed by transform alone, so following a scroll moves no boxes.
      el.style.left = '0px';
      el.style.top = '0px';
      el.style.willChange = 'transform';
      // Over a spill-over sticker the wheel would scroll nothing — it lives outside the pane.
      el.addEventListener('wheel', _stkOnWheel, { passive: false });
      c.x = c.y = c.tf = undefined;
    } else {
      el.style.willChange = '';
      el.removeEventListener('wheel', _stkOnWheel, { passive: false });
      c.stf = undefined;
    }
  });
  if (!spill) {
    set('x', it.x, v => { el.style.left = v + 'px'; });
    set('y', it.y, v => { el.style.top = v + 'px'; });
    set('tf', it.rot ? 'rotate(' + it.rot + 'deg)' : '', v => { el.style.transform = v; });
  }
}

/** Spill-over stickers follow their panes: every origin read first, then every transform written. */
function _stkPlaceSpill() {
  const f = document.getElementById('stk-float');
  if (!f || !f.firstElementChild) return;
  const origins = new Map();
  const todo = [];
  for (const el of f.children) {
    if (_stkDrag && _stkDrag.lifted && _stkDrag.id === el.dataset.stk) continue;
    const it = _stkById(el.dataset.stk);
    if (!it || it.edge !== 'spill') continue;
    let o = origins.get(it.host);
    if (o === undefined) {
      const h = _stkFindHost(it.host);
      o = h ? _stkOrigin(h) : null;
      origins.set(it.host, o);
    }
    if (o) todo.push([el, it, o]);
  }
  todo.forEach(([el, it, o]) => {
    const v = _stkSpillTf(it, o);
    const c = el._stk || (el._stk = {});
    if (c.stf !== v) { c.stf = v; el.style.transform = v; }
  });
}

function _stkQueue() {
  if (_stkQueued) return;
  _stkQueued = true;
  requestAnimationFrame(_stkSync);
}

/** Put every sticker that belongs on this screen where it belongs, and take the rest away. */
function _stkSync() {
  _stkQueued = false;
  if (!_stkReady) return;
  // Panes that went away with a re-render or a route change.
  _stkHosts.forEach(h => { if (!h.isConnected) _stkDetach(h); });
  _stkKidsDirty.forEach(h => { if (h.isConnected && _stkHosts.has(h)) _stkObserveKids(h); });
  _stkKidsDirty.clear();

  const vis = _stkVisible();
  const shown = new Set();
  const used = new Map();       // host -> { back: [], front: [] }
  const spill = [];
  for (const v of vis) {
    shown.add(v.it.id);
    if (_stkDrag && _stkDrag.id === v.it.id && _stkDrag.lifted) continue;   // being carried
    if (v.it.edge === 'spill') { spill.push(v.it); continue; }
    let u = used.get(v.host);
    if (!u) used.set(v.host, u = { back: [], front: [] });
    u[v.it.layer === 'back' ? 'back' : 'front'].push(v.it);
  }

  // Each pane: its two layers, stickers in stacking order (document order
  // settles the tie between stickers on the same z-index).
  used.forEach((u, host) => {
    if (!_stkHosts.has(host)) _stkAttach(host);
    ['back', 'front'].forEach(which => {
      const list = u[which].sort((a, b) => (a.z || 0) - (b.z || 0));
      let L = host.querySelector(':scope > .stk-layer-' + which);
      if (!list.length) { if (L) L.remove(); return; }
      if (!L) L = _stkLayer(host, which);
      list.forEach((it, i) => {
        const el = _stkEl(it);
        if (L.children[i] !== el) L.insertBefore(el, L.children[i] || null);
        _stkApply(it, el);
      });
      while (L.children.length > list.length) L.lastElementChild.remove();
    });
    const hasBack = u.back.length > 0;
    if (host.classList.contains('stk-host-back') !== hasBack) host.classList.toggle('stk-host-back', hasBack);
  });

  if (spill.length) {
    const f = _stkFloat();
    spill.sort((a, b) => (a.z || 0) - (b.z || 0)).forEach(it => {
      const el = _stkEl(it);
      if (el.parentElement !== f) f.appendChild(el);
      _stkApply(it, el);
    });
  }
  _stkEls.forEach((el, id) => { if (!shown.has(id) && el.parentElement && !(_stkDrag && _stkDrag.id === id)) el.remove(); });
  _stkHosts.forEach(h => { if (!used.has(h)) _stkDetach(h); });
  const f = document.getElementById('stk-float');
  if (f && !f.firstChild && !_stkDrag) f.remove();
  _stkPlaceSpill();

  if (_stkSel && !shown.has(_stkSel)) _stkSel = null;
  if (_stkSel || document.querySelector('#stk-ui .stk-frame:not([hidden])')) _stkUiUpdate();
  _stkButtonsSync();
  if (_stkMode) {
    const sig = vis.map(v => v.it.id + (v.it.lock ? 'L' : '') + v.it.layer + v.it.edge).join(',');
    if (sig !== _stkLastPage) { _stkLastPage = sig; _stkTrayPageRender(vis); }
  }
}

/** Scroll moves spill-over stickers and the selection frame; everything else scrolls by itself. */
function _stkOnScroll() {
  if (_stkScrollQueued) return;
  if (!document.getElementById('stk-float') && !_stkSel) return;
  _stkScrollQueued = true;
  requestAnimationFrame(() => {
    _stkScrollQueued = false;
    _stkPlaceSpill();
    if (_stkSel) _stkUiUpdate();
  });
}

/** The wheel over the selection frame or a spill-over sticker scrolls the pane the sticker belongs to. */
function _stkOnWheel(e) {
  const t = e.currentTarget;
  const id = t.classList.contains('stk-frame') ? _stkSel : t.dataset.stk;
  const it = id && _stkById(id);
  if (!it) return;
  let h = _stkFindHost(it.host);
  const scrolls = el => el.scrollHeight > el.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(el).overflowY);
  while (h && h !== document.body && !scrolls(h)) h = h.parentElement;
  if (!h || h === document.body) return;
  const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? h.clientHeight : 1;
  h.scrollBy(e.deltaX * k, e.deltaY * k);
  e.preventDefault();
}

/* ── Selection frame and toolbar ─────────────────────────── */

function _stkUi() {
  let ui = document.getElementById('stk-ui');
  if (!ui) {
    ui = document.createElement('div');
    ui.id = 'stk-ui';
    ui.innerHTML =
      '<div class="stk-target" hidden><span class="stk-target-label"></span></div>' +
      '<div class="stk-frame" hidden>' +
        '<span class="stk-h" data-h="nw"></span><span class="stk-h" data-h="ne"></span>' +
        '<span class="stk-h" data-h="sw"></span><span class="stk-h" data-h="se"></span>' +
        '<span class="stk-rot" title="Drag to rotate · Shift snaps to 15° · double-click to straighten"></span>' +
      '</div>' +
      '<div class="stk-bar" role="toolbar" aria-label="Sticker" hidden>' +
        '<label class="stk-op" title="Opacity">' + _stkIco('blend', 15) +
          '<input type="range" min="5" max="100" step="1" aria-label="Opacity"><span class="stk-op-val">100%</span></label>' +
        '<span class="stk-sep"></span>' +
        '<button type="button" data-act="back" title="Send backward" aria-label="Send backward">' + _stkIco('chevrons-down') + '</button>' +
        '<button type="button" data-act="layer" class="stk-pill" title="Behind or in front of this pane\'s content"></button>' +
        '<button type="button" data-act="fwd" title="Bring forward" aria-label="Bring forward">' + _stkIco('chevrons-up') + '</button>' +
        '<span class="stk-sep"></span>' +
        '<button type="button" data-act="edge" class="stk-pill"></button>' +
        '<button type="button" data-act="lock"></button>' +
        '<button type="button" data-act="dup" title="Duplicate" aria-label="Duplicate">' + _stkIco('copy') + '</button>' +
        '<button type="button" data-act="del" class="is-danger" title="Remove (Delete)" aria-label="Remove">' + _stkIco('trash-2') + '</button>' +
      '</div>';
    document.body.appendChild(ui);
    const frame = ui.querySelector('.stk-frame');
    frame.addEventListener('pointerdown', _stkOnFrameDown);
    frame.addEventListener('wheel', _stkOnWheel, { passive: false });
    frame.querySelector('.stk-rot').addEventListener('dblclick', e => {
      e.stopPropagation();
      const it = _stkById(_stkSel);
      if (it && !it.lock) { it.rot = 0; _stkSave(); _stkQueue(); }
    });
    const bar = ui.querySelector('.stk-bar');
    bar.addEventListener('pointerdown', e => e.stopPropagation());
    bar.addEventListener('click', _stkOnBarClick);
    const range = bar.querySelector('input[type=range]');
    range.addEventListener('input', () => {
      const it = _stkById(_stkSel);
      if (!it) return;
      it.op = Math.max(0.05, Math.min(1, range.value / 100));
      bar.querySelector('.stk-op-val').textContent = Math.round(it.op * 100) + '%';
      const el = _stkEls.get(it.id);
      if (el) _stkApply(it, el);
      _stkSave();
    });
  }
  return ui;
}

/** The selected sticker's box on screen: top-left, size, angle. No layout is read while a gesture runs. */
function _stkScreenBox(it) {
  const d = _stkDrag;
  if (d && d.id === it.id) {
    if (d.lifted) return { x: d.left, y: d.top, w: it.w, h: it.h, rot: it.rot || 0 };
    return { x: d.ox + it.x, y: d.oy + it.y, w: it.w, h: it.h, rot: it.rot || 0 };
  }
  const host = _stkFindHost(it.host);
  if (!host) return null;
  const o = _stkOrigin(host);
  return { x: o.x + it.x, y: o.y + it.y, w: it.w, h: it.h, rot: it.rot || 0, host };
}

function _stkUiUpdate() {
  const ui = document.getElementById('stk-ui');
  const it = _stkSel ? _stkById(_stkSel) : null;
  const hide = () => {
    if (!ui) return;
    const fr = ui.querySelector('.stk-frame'), br = ui.querySelector('.stk-bar');
    if (!fr.hidden) fr.hidden = true;
    if (!br.hidden) br.hidden = true;
  };
  if (!it) { hide(); return; }
  const box = _stkScreenBox(it);
  if (!box) { hide(); return; }
  const th = (box.rot || 0) * Math.PI / 180;
  const bw = Math.abs(box.w * Math.cos(th)) + Math.abs(box.h * Math.sin(th));
  const bh = Math.abs(box.w * Math.sin(th)) + Math.abs(box.h * Math.cos(th));
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  // A cut-off sticker scrolled out of its pane takes its frame with it, rather
  // than leaving the frame and toolbar floating over the next pane.
  if (box.host && it.edge !== 'spill') {
    const r = box.host.getBoundingClientRect();
    if (cx + bw / 2 < r.left || cx - bw / 2 > r.right || cy + bh / 2 < r.top || cy - bh / 2 > r.bottom) { hide(); return; }
  }
  const u = _stkUi();
  const frame = u.querySelector('.stk-frame');
  const bar = u.querySelector('.stk-bar');
  frame.hidden = false;
  frame.classList.toggle('is-locked', !!it.lock);
  frame.style.left = box.x + 'px';
  frame.style.top = box.y + 'px';
  frame.style.width = box.w + 'px';
  frame.style.height = box.h + 'px';
  frame.style.transform = box.rot ? 'rotate(' + box.rot + 'deg)' : '';

  const busy = !!(_stkDrag && _stkDrag.active);
  if (bar.hidden !== busy) bar.hidden = busy;
  if (busy) return;
  _stkBarState(bar, it);
  // Above the sticker's rotated bounds, or under them when there is no room.
  const barW = bar.offsetWidth || 360, barH = bar.offsetHeight || 40;
  let top = cy - bh / 2 - barH - 44;
  if (top < 8) top = cy + bh / 2 + 14;
  top = Math.max(8, Math.min(window.innerHeight - barH - 8, top));
  const left = Math.max(8, Math.min(window.innerWidth - barW - 8, cx - barW / 2));
  bar.style.left = left + 'px';
  bar.style.top = top + 'px';
}

function _stkBarState(bar, it) {
  const spill = it.edge === 'spill';
  const range = bar.querySelector('input[type=range]');
  const op = Math.round((it.op == null ? 1 : it.op) * 100);
  if (document.activeElement !== range) range.value = op;
  bar.querySelector('.stk-op-val').textContent = op + '%';
  const layer = bar.querySelector('[data-act=layer]');
  const layerTxt = spill ? 'On top' : (it.layer === 'back' ? 'Behind content' : 'In front');
  if (layer.textContent !== layerTxt) layer.textContent = layerTxt;
  layer.disabled = spill;
  layer.title = spill ? 'A sticker that spills over the edges sits on top of the page' : 'Click to put it ' + (it.layer === 'back' ? 'in front of' : 'behind') + ' this pane\'s cards and text';
  const edge = bar.querySelector('[data-act=edge]');
  const edgeKey = spill ? 'spill' : 'clip';
  if (edge.dataset.state !== edgeKey) {
    edge.dataset.state = edgeKey;
    edge.innerHTML = _stkIco(spill ? 'maximize-2' : 'crop', 15) + '<span>' + (spill ? 'Spills over' : 'Cut at edges') + '</span>';
  }
  edge.title = spill ? 'Spills past the pane\'s edges. Click to cut it off at the pane instead'
    : 'Cut off at the pane\'s edges. Click to let it spill over them';
  const lock = bar.querySelector('[data-act=lock]');
  const lockKey = it.lock ? 'on' : 'off';
  if (lock.dataset.state !== lockKey) {
    lock.dataset.state = lockKey;
    lock.innerHTML = _stkIco(it.lock ? 'lock' : 'lock-open');
  }
  lock.classList.toggle('is-on', !!it.lock);
  lock.title = it.lock ? 'Locked: clicks go through it. Click to unlock' : 'Lock in place: it stops moving and clicks go through it';
  lock.setAttribute('aria-label', it.lock ? 'Unlock' : 'Lock');
  lock.setAttribute('aria-pressed', it.lock ? 'true' : 'false');
}

function _stkOnBarClick(e) {
  const b = e.target.closest('button[data-act]');
  const it = _stkById(_stkSel);
  if (!b || !it) return;
  const act = b.dataset.act;
  if (act === 'del') { stkRemove(it.id); return; }
  if (act === 'dup') { _stkDuplicate(it); return; }
  if (act === 'lock') {
    it.lock = !it.lock;
    if (it.lock && !_stkMode) {
      // Out of sticker mode a locked sticker cannot be picked, so let it go now.
      _stkSel = null;
      if (typeof toast === 'function') toast('Locked. Open Stickers to pick it again.', { type: 'info', duration: 2600 });
    }
  } else if (act === 'edge') {
    it.edge = it.edge === 'spill' ? 'clip' : 'spill';
    it.z = _stkTopZ(it) + 1;
  } else if (act === 'layer') {
    if (it.edge === 'spill') return;
    it.layer = it.layer === 'back' ? 'front' : 'back';
    it.z = _stkTopZ(it) + 1;
  } else if (act === 'fwd' || act === 'back') {
    _stkStep(it, act === 'fwd' ? 1 : -1);
  }
  _stkSave();
  _stkSync();
}

/* ── Layering ────────────────────────────────────────────── */

/** The stickers this one is stacked among: same pane, same view, same layer (or every spill-over on the page). */
function _stkPeers(it) {
  return _stkVisible().map(v => v.it).filter(o => it.edge === 'spill'
    ? o.edge === 'spill'
    : (o.edge !== 'spill' && o.host === it.host && (o.sub || '') === (it.sub || '') && (o.layer === 'back') === (it.layer === 'back')));
}

function _stkTopZ(it) {
  const peers = _stkPeers(it).filter(o => o.id !== it.id);
  return peers.reduce((m, o) => Math.max(m, o.z || 0), 0);
}

function _stkOverlap(a, b) {
  const ea = _stkEls.get(a.id), eb = _stkEls.get(b.id);
  if (!ea || !eb) return true;
  const r = ea.getBoundingClientRect(), s = eb.getBoundingClientRect();
  return r.left < s.right && s.left < r.right && r.top < s.bottom && s.top < r.bottom;
}

/** One step forward or back: past the next sticker it actually overlaps, then across to the other layer. */
function _stkStep(it, dir) {
  const peers = _stkPeers(it).sort((a, b) => (a.z || 0) - (b.z || 0));
  peers.forEach((p, i) => { p.z = i + 1; });
  const i = peers.indexOf(it);
  let j = i + dir;
  while (j >= 0 && j < peers.length && !_stkOverlap(it, peers[j])) j += dir;
  if (j >= 0 && j < peers.length) {
    const past = peers[j];
    peers.splice(i, 1);
    const k = peers.indexOf(past);
    peers.splice(dir > 0 ? k + 1 : k, 0, it);
    peers.forEach((p, n) => { p.z = n + 1; });
    return;
  }
  if (it.edge === 'spill') {
    if (typeof toast === 'function') toast(dir > 0 ? 'Already on top.' : 'A sticker that spills over stays on top. Cut it at the edges to put it behind.', { type: 'info', duration: 2600 });
    return;
  }
  if (dir > 0 && it.layer === 'back') {
    it.layer = 'front';
    const others = _stkPeers(it).filter(o => o.id !== it.id);
    it.z = others.reduce((m, o) => Math.min(m, o.z || 1), 1) - 1;
  } else if (dir < 0 && it.layer !== 'back') {
    it.layer = 'back';
    it.z = _stkTopZ(it) + 1;
  } else if (typeof toast === 'function') {
    toast(dir > 0 ? 'Already in front of everything here.' : 'Already behind everything here.', { type: 'info', duration: 2200 });
  }
  // Keep the numbers small and positive.
  const again = _stkPeers(it).sort((a, b) => (a.z || 0) - (b.z || 0));
  again.forEach((p, n) => { p.z = n + 1; });
}

/* ── Gestures ────────────────────────────────────────────── */

function stkSelect(id) {
  _stkSel = id;
  _stkEls.forEach((el, k) => {
    const on = k === id;
    const c = el._stk || (el._stk = {});
    if (c.sel !== on) { c.sel = on; el.classList.toggle('is-selected', on); }
  });
  document.querySelectorAll('#stk-page-list .stk-mini').forEach(b => b.classList.toggle('is-on', b.dataset.pick === id));
  _stkUiUpdate();
}

function _stkOnStickerDown(e) {
  if (e.button !== 0) return;
  const it = _stkById(e.currentTarget.dataset.stk);
  if (!it) return;
  if (it.lock && !_stkMode) return;
  e.preventDefault();
  e.stopPropagation();
  // The editor keeps focus through a click that does not move it, and Delete
  // there should not be the sticker's Delete. Picking a sticker takes focus.
  if (_stkTyping()) document.activeElement.blur();
  stkSelect(it.id);
  if (!it.lock) _stkBegin(e, it, 'move');
}

function _stkOnFrameDown(e) {
  if (e.button !== 0) return;
  const it = _stkById(_stkSel);
  if (!it) return;
  e.preventDefault();
  e.stopPropagation();
  if (it.lock) return;
  const h = e.target.closest('.stk-h');
  if (h) { _stkBegin(e, it, 'resize', h.dataset.h); return; }
  if (e.target.closest('.stk-rot')) { _stkBegin(e, it, 'rotate'); return; }
  _stkBegin(e, it, 'move');
}

function _stkBegin(e, it, kind, handle) {
  const host = _stkFindHost(it.host);
  if (!host) return;
  const o = _stkOrigin(host);
  const d = {
    id: it.id, kind, pid: e.pointerId, sx: e.clientX, sy: e.clientY, host, ox: o.x, oy: o.y,
    x0: it.x, y0: it.y, w0: it.w, h0: it.h, rot0: it.rot || 0, moved: false, active: false, lifted: false,
    ev: null, raf: 0, target: host, hostAt: 0, hx: e.clientX, hy: e.clientY, isHost: new Map(),
  };
  d.cx = o.x + it.x + it.w / 2;
  d.cy = o.y + it.y + it.h / 2;
  if (kind === 'resize') { d.sgx = handle.indexOf('e') >= 0 ? 1 : -1; d.sgy = handle.indexOf('s') >= 0 ? 1 : -1; }
  if (kind === 'rotate') d.a0 = Math.atan2(e.clientY - d.cy, e.clientX - d.cx);
  _stkDrag = d;
  window.addEventListener('pointermove', _stkOnMove, true);
  window.addEventListener('pointerup', _stkOnUp, true);
  window.addEventListener('pointercancel', _stkOnUp, true);
}

/** Pointer moves only record where the pointer is; the work happens once per frame. */
function _stkOnMove(e) {
  const d = _stkDrag;
  if (!d || e.pointerId !== d.pid) return;
  if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 3) return;
  e.preventDefault();
  d.ev = { x: e.clientX, y: e.clientY, shift: e.shiftKey };
  if (!d.raf) d.raf = requestAnimationFrame(_stkDragFrame);
}

function _stkDragFrame() {
  const d = _stkDrag;
  if (!d) return;
  d.raf = 0;
  const ev = d.ev;
  const it = _stkById(d.id);
  const el = _stkEls.get(d.id);
  if (!ev || !it || !el) return;
  if (!d.moved) {
    d.moved = true;
    d.active = true;
    document.body.classList.add('stk-dragging');
    if (d.kind === 'move') document.body.classList.add('stk-drag-move');
  }
  const dx = ev.x - d.sx, dy = ev.y - d.sy;
  if (d.kind === 'move') {
    // Reads first, while the layout from the last frame is still good.
    // Finding the pane under the pointer is the costly part of a drag, so it
    // is asked again only when the pointer has gone some way or some time.
    const now = performance.now();
    if (now - d.hostAt > 90 || Math.abs(ev.x - d.hx) + Math.abs(ev.y - d.hy) > 40) {
      d.hostAt = now; d.hx = ev.x; d.hy = ev.y;
      d.target = _stkHostAt(ev.x, ev.y, d.isHost) || d.host;
    }
    if (!d.lifted) {
      // Carried over the whole app, so it can be dropped into another pane,
      // and moved by transform alone, so carrying it lays nothing out.
      d.lifted = true;
      el.classList.add('is-lifted');
      _stkFloat().appendChild(el);
      el.style.left = (d.ox + d.x0) + 'px';
      el.style.top = (d.oy + d.y0) + 'px';
      el.style.zIndex = '1000';
      el.style.willChange = 'transform';
      el._stk = {};
    }
    d.left = d.ox + d.x0 + dx;
    d.top = d.oy + d.y0 + dy;
    el.style.transform = 'translate(' + dx + 'px,' + dy + 'px)' + (it.rot ? ' rotate(' + it.rot + 'deg)' : '');
    _stkShowTarget(d.target);
  } else if (d.kind === 'resize') {
    const th = d.rot0 * Math.PI / 180, cos = Math.cos(th), sin = Math.sin(th);
    // The corner across from the handle stays where it is.
    const lx = -d.sgx * d.w0 / 2, ly = -d.sgy * d.h0 / 2;
    const Ox = d.cx + lx * cos - ly * sin, Oy = d.cy + lx * sin + ly * cos;
    const px = ev.x - Ox, py = ev.y - Oy;
    const qx = px * cos + py * sin, qy = -px * sin + py * cos;
    const diag = d.w0 * d.w0 + d.h0 * d.h0;
    let s = (qx * d.sgx * d.w0 + qy * d.sgy * d.h0) / diag;
    s = Math.max(STK_MIN_SIDE / Math.min(d.w0, d.h0), Math.min(6000 / Math.max(d.w0, d.h0), s));
    const w = d.w0 * s, h = d.h0 * s;
    const mx = d.sgx * w / 2, my = d.sgy * h / 2;
    const ncx = Ox + mx * cos - my * sin, ncy = Oy + mx * sin + my * cos;
    it.w = w; it.h = h;
    it.x = ncx - d.ox - w / 2;
    it.y = ncy - d.oy - h / 2;
    _stkApplyLive(it, el, d);
  } else if (d.kind === 'rotate') {
    const a = Math.atan2(ev.y - d.cy, ev.x - d.cx);
    let r = d.rot0 + (a - d.a0) * 180 / Math.PI;
    if (ev.shift) r = Math.round(r / 15) * 15;
    r = ((r % 360) + 540) % 360 - 180;
    it.rot = Math.round(r * 10) / 10;
    _stkApplyLive(it, el, d);
  }
  _stkUiUpdate();
}

/** During a resize or turn: the record's new size and angle, placed from the origin read when the gesture began. */
function _stkApplyLive(it, el, d) {
  _stkApply(it, el);
  if (it.edge === 'spill') {
    const v = _stkSpillTf(it, { x: d.ox, y: d.oy });
    el._stk.stf = v;
    el.style.transform = v;
  }
}

function _stkOnUp(e) {
  const d = _stkDrag;
  if (!d || (e && e.pointerId !== undefined && e.pointerId !== d.pid)) return;
  const cancel = !!(e && e.type === 'pointercancel');
  // Land where the pointer last was, not a frame behind it.
  if (d.raf) { cancelAnimationFrame(d.raf); d.raf = 0; if (!cancel) _stkDragFrame(); }
  window.removeEventListener('pointermove', _stkOnMove, true);
  window.removeEventListener('pointerup', _stkOnUp, true);
  window.removeEventListener('pointercancel', _stkOnUp, true);
  document.body.classList.remove('stk-dragging', 'stk-drag-move');
  _stkShowTarget(null);
  const it = _stkById(d.id);
  const el = _stkEls.get(d.id);
  if (it && d.moved) {
    if (d.kind === 'move' && !cancel) {
      const at = d.ev || { x: d.sx, y: d.sy };
      let host = _stkHostAt(at.x, at.y) || d.host;
      if (!host.isConnected) host = d.host;
      const o = _stkOrigin(host);
      it.x = d.left - o.x;
      it.y = d.top - o.y;
      if (host !== d.host) {
        it.host = _stkHostKey(host);
        it.sub = _stkSub(_stkRoute(), host);
        it.z = _stkTopZ(it) + 1;
      }
    }
    if (cancel && d.kind !== 'move') {
      it.x = d.x0; it.y = d.y0; it.w = d.w0; it.h = d.h0; it.rot = d.rot0;
    }
    it.x = Math.round(it.x); it.y = Math.round(it.y);
    it.w = Math.round(it.w); it.h = Math.round(it.h);
    _stkSave();
  }
  if (el && d.lifted) {
    el.classList.remove('is-lifted');
    el.style.willChange = '';
    el.style.transform = '';
    el._stk = {};          // rewritten in full by the sync below
  }
  _stkDrag = null;
  _stkSync();
}

function _stkShowTarget(host) {
  if (host === _stkTargetShown) return;
  _stkTargetShown = host;
  const ui = _stkUi();
  const t = ui.querySelector('.stk-target');
  if (!host) { t.hidden = true; return; }
  const r = host.getBoundingClientRect();
  t.hidden = false;
  t.style.left = r.left + 'px';
  t.style.top = r.top + 'px';
  t.style.width = r.width + 'px';
  t.style.height = r.height + 'px';
  t.style.borderRadius = getComputedStyle(host).borderRadius;
  const label = host === _stkRoot() ? 'Whole page' : 'This pane';
  const lab = t.querySelector('.stk-target-label');
  if (lab.textContent !== label) lab.textContent = label;
}

/* ── Placing, duplicating, removing ──────────────────────── */

/** A new sticker of picture `imgId`, centred on a point of the screen. */
function _stkPlace(imgId, x, y) {
  const img = _stkImgs.get(imgId);
  const host = _stkHostAt(x, y);
  if (!img || !host) return null;
  const k = Math.min(1, STK_START_SIDE / Math.max(img.w, img.h));
  const w = Math.max(24, Math.round(img.w * k)), h = Math.max(24, Math.round(img.h * k));
  const o = _stkOrigin(host);
  const route = _stkRoute();
  const it = {
    id: _stkUid('st_'), img: imgId, route, host: _stkHostKey(host), sub: _stkSub(route, host),
    x: Math.round(x - o.x - w / 2), y: Math.round(y - o.y - h / 2), w, h,
    rot: 0, op: 1, lock: false, edge: 'clip', layer: 'front', z: 1,
  };
  it.z = _stkTopZ(it) + 1;
  _stkItems.push(it);
  _stkSave();
  _stkSync();
  stkSelect(it.id);
  return it;
}

/** The middle of the page's working area, for a picture placed by click rather than by drag. */
function _stkCentre() {
  const root = _stkRoot();
  const r = root ? root.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
  const tray = document.getElementById('stk-tray');
  let bottom = r.top + r.height;
  if (tray && !tray.hidden) bottom = Math.min(bottom, tray.getBoundingClientRect().top);
  return { x: r.left + r.width / 2, y: r.top + Math.max(80, (bottom - r.top) / 2) };
}

function _stkDuplicate(it) {
  const copy = Object.assign({}, it, { id: _stkUid('st_'), x: it.x + 24, y: it.y + 24, lock: false });
  copy.z = _stkTopZ(it) + 1;
  _stkItems.push(copy);
  _stkSave();
  _stkSync();
  stkSelect(copy.id);
}

function stkRemove(id) {
  const i = _stkItems.findIndex(s => s.id === id);
  if (i < 0) return;
  const [gone] = _stkItems.splice(i, 1);
  const el = _stkEls.get(id);
  if (el) el.remove();
  _stkEls.delete(id);
  if (_stkSel === id) _stkSel = null;
  _stkSave();
  _stkSync();
  if (typeof toast === 'function') {
    toast('Sticker removed.', { type: 'info', duration: 4000, action: { label: 'Undo', onClick: () => { _stkItems.splice(Math.min(i, _stkItems.length), 0, gone); _stkSave(); _stkSync(); } } });
  }
}

function _stkNudge(it, dx, dy) {
  it.x += dx; it.y += dy;
  _stkSave();
  const el = _stkEls.get(it.id);
  if (el) _stkApply(it, el);
  _stkPlaceSpill();
  _stkUiUpdate();
}

/* ── Sticker mode and its tray ───────────────────────────── */

/** Open or close sticker mode. With no argument it flips. */
function stkToggleMode(on) {
  _stkMode = typeof on === 'boolean' ? on : !_stkMode;
  document.body.classList.toggle('stk-editing', _stkMode);
  if (_stkMode) {
    _stkTrayOpen();
  } else {
    const tray = document.getElementById('stk-tray');
    if (tray) tray.hidden = true;
    const it = _stkSel ? _stkById(_stkSel) : null;
    if (it && it.lock) _stkSel = null;
  }
  _stkButtonsSync();
  _stkSync();
}

function _stkButtonsSync() {
  document.querySelectorAll('[data-stk-toggle]').forEach(b => {
    if (b.classList.contains('is-on') === _stkMode) return;
    b.classList.toggle('is-on', _stkMode);
    b.setAttribute('aria-pressed', _stkMode ? 'true' : 'false');
  });
}

function _stkTrayOpen() {
  let tray = document.getElementById('stk-tray');
  if (!tray) {
    tray = document.createElement('div');
    tray.id = 'stk-tray';
    tray.className = 'stk-tray';
    tray.setAttribute('role', 'dialog');
    tray.setAttribute('aria-label', 'Stickers');
    tray.innerHTML =
      '<div class="stk-tray-head">' +
        '<span class="stk-tray-grip" title="Drag to move">' + _stkIco('grip-horizontal', 16) + '</span>' +
        '<span class="stk-tray-title">' + _stkIco('sticker', 16) + 'Stickers</span>' +
        '<span class="stk-tray-count" id="stk-tray-count"></span>' +
        '<span class="stk-tray-gap"></span>' +
        '<button type="button" class="stk-tray-btn" data-tray="add">' + _stkIco('image-plus', 15) + 'Add pictures</button>' +
        '<button type="button" class="stk-tray-btn is-primary" data-tray="done">' + _stkIco('check', 15) + 'Done</button>' +
      '</div>' +
      '<div class="stk-tray-label">Your pictures</div>' +
      '<div class="stk-strip" id="stk-lib"></div>' +
      '<div class="stk-tray-label">On this page</div>' +
      '<div class="stk-strip stk-strip-page" id="stk-page-list"></div>' +
      '<div class="stk-tray-hint">Drag a picture onto the page, or click it to drop it in the middle. Drop or paste image files here too.</div>' +
      '<input type="file" accept="image/*" multiple hidden id="stk-file">';
    document.body.appendChild(tray);
    tray.addEventListener('pointerdown', _stkOnTrayDown);
    tray.addEventListener('click', _stkOnTrayClick);
    tray.addEventListener('contextmenu', _stkOnTrayContext);
    tray.querySelector('#stk-file').addEventListener('change', async e => {
      const ids = await _stkAddFiles(e.target.files);
      e.target.value = '';
      if (ids.length === 1) { const c = _stkCentre(); _stkPlace(ids[0], c.x, c.y); }
    });
  }
  tray.hidden = false;
  _stkTrayRender();
  _stkLastPage = null;
  _stkTrayPosition(tray);
}

function _stkTrayPosition(tray) {
  let pos = null;
  try { pos = JSON.parse(localStorage.getItem(STK_TRAY_KEY) || 'null'); } catch (e) { pos = null; }
  const w = tray.offsetWidth, h = tray.offsetHeight;
  let x = pos && isFinite(pos.x) ? pos.x : (window.innerWidth - w) / 2;
  let y = pos && isFinite(pos.y) ? pos.y : window.innerHeight - h - 16;
  x = Math.max(8, Math.min(window.innerWidth - w - 8, x));
  y = Math.max(8, Math.min(window.innerHeight - h - 8, y));
  tray.style.left = x + 'px';
  tray.style.top = y + 'px';
}

function _stkTrayRender() {
  const lib = document.getElementById('stk-lib');
  if (!lib) return;
  const imgs = Array.from(_stkImgs.values()).sort((a, b) => (b.added || 0) - (a.added || 0));
  if (!imgs.length) {
    lib.innerHTML = '<div class="stk-empty">No pictures yet. Add one to start. PNGs with see-through backgrounds look best.</div>';
    return;
  }
  lib.innerHTML = imgs.map(m =>
    '<div class="stk-thumb" data-img="' + m.id + '" title="' + _stkAttr(m.name || 'Picture') + '" role="button" tabindex="0">' +
      '<img src="' + m.url + '" alt="" draggable="false">' +
      '<button type="button" class="stk-thumb-x" data-forget="' + m.id + '" title="Remove this picture" aria-label="Remove this picture">' + _stkIco('x', 12) + '</button>' +
    '</div>').join('');
}

function _stkAttr(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

function _stkTrayPageRender(vis) {
  const box = document.getElementById('stk-page-list');
  const count = document.getElementById('stk-tray-count');
  if (count) count.textContent = vis.length === 1 ? '1 on this page' : vis.length + ' on this page';
  if (!box) return;
  if (!vis.length) { box.innerHTML = '<div class="stk-empty">Nothing on this page yet.</div>'; return; }
  box.innerHTML = vis.map(({ it }) => {
    const m = _stkImgs.get(it.img);
    const tags = (it.lock ? _stkIco('lock', 11) : '') + (it.edge !== 'spill' && it.layer === 'back' ? _stkIco('layers', 11) : '');
    return '<button type="button" class="stk-mini' + (it.id === _stkSel ? ' is-on' : '') + '" data-pick="' + it.id + '" title="Pick this sticker">' +
      '<img src="' + (m ? m.url : '') + '" alt="" draggable="false">' + (tags ? '<span class="stk-mini-tags">' + tags + '</span>' : '') + '</button>';
  }).join('');
}

/** Bring a sticker into view in its own pane, without scrolling anything else. */
function _stkReveal(it) {
  const host = _stkFindHost(it.host);
  if (!host || !/(auto|scroll)/.test(getComputedStyle(host).overflowY)) return;
  const top = it.y, bottom = it.y + it.h;
  if (top < host.scrollTop || bottom > host.scrollTop + host.clientHeight) {
    host.scrollTo({ top: Math.max(0, top - Math.max(16, (host.clientHeight - it.h) / 2)), behavior: 'smooth' });
  }
}

function _stkOnTrayClick(e) {
  const btn = e.target.closest('[data-tray]');
  if (btn) {
    if (btn.dataset.tray === 'add') document.getElementById('stk-file').click();
    if (btn.dataset.tray === 'done') stkToggleMode(false);
    return;
  }
  const forget = e.target.closest('[data-forget]');
  if (forget) { _stkAskForget(forget.dataset.forget); return; }
  const pick = e.target.closest('[data-pick]');
  if (pick) {
    const it = _stkById(pick.dataset.pick);
    if (!it) return;
    stkSelect(it.id);
    _stkReveal(it);
  }
}

/**
 * Right-click on a sticker under "On this page": a small menu for that
 * sticker -- find it, duplicate it, lock it, or delete it (Delete keeps the
 * Undo toast stkRemove gives). Uses the tree's menu, which sits above the
 * tray. The context-menu key opens it at the thumbnail.
 */
function _stkOnTrayContext(e) {
  const pick = e.target.closest('[data-pick]');
  if (!pick) return;
  const it = _stkById(pick.dataset.pick);
  if (!it) return;
  e.preventDefault();
  e.stopPropagation();
  const act = (fn) => () => { fn(); _stkSave(); _stkSync(); };
  const actions = [
    { icon: 'locate', label: 'Find on page', fn: () => { stkSelect(it.id); _stkReveal(it); } },
    { icon: 'copy', label: 'Duplicate', fn: () => _stkDuplicate(it) },
    { icon: it.lock ? 'lock-open' : 'lock', label: it.lock ? 'Unlock' : 'Lock', fn: act(() => { it.lock = !it.lock; }) },
    { sep: true },
    { icon: 'trash-2', label: 'Delete', danger: true, fn: () => stkRemove(it.id) }
  ];
  if (typeof _treeShowMenu !== 'function') { stkRemove(it.id); return; }
  if (typeof treeCloseMenu === 'function') treeCloseMenu();
  let at = e;
  if (!e.clientX && !e.clientY) {
    // From the keyboard: open beside the thumbnail, not in the corner.
    const r = pick.getBoundingClientRect();
    at = { clientX: r.left + r.width / 2, clientY: r.bottom };
  }
  _treeShowMenu(at, actions);
}

function _stkAskForget(imgId) {
  const uses = _stkItems.filter(s => s.img === imgId).length;
  const go = () => {
    _stkItems = _stkItems.filter(s => s.img !== imgId);
    _stkSave();
    _stkForgetImage(imgId).then(() => { _stkTrayRender(); _stkLastPage = null; _stkSync(); });
  };
  if (!uses) { go(); return; }
  const msg = uses === 1 ? 'It is on 1 sticker, which goes too.' : 'It is on ' + uses + ' stickers, across your pages. They go too.';
  if (typeof showConfirm === 'function') showConfirm('Remove this picture?', msg, go, { confirmLabel: 'Remove' });
  else if (confirm('Remove this picture? ' + msg)) go();
}

/** Pointer down in the tray: move the tray by its grip, or carry a picture out onto the page. */
function _stkOnTrayDown(e) {
  if (e.button !== 0) return;
  const tray = e.currentTarget;
  if (e.target.closest('.stk-tray-grip')) {
    e.preventDefault();
    const r = tray.getBoundingClientRect();
    const dx = e.clientX - r.left, dy = e.clientY - r.top;
    let raf = 0, last = null;
    const frame = () => {
      raf = 0;
      if (!last) return;
      const x = Math.max(8, Math.min(window.innerWidth - r.width - 8, last.x - dx));
      const y = Math.max(8, Math.min(window.innerHeight - r.height - 8, last.y - dy));
      tray.style.left = x + 'px';
      tray.style.top = y + 'px';
    };
    const move = ev => { last = { x: ev.clientX, y: ev.clientY }; if (!raf) raf = requestAnimationFrame(frame); };
    const up = () => {
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      if (raf) { cancelAnimationFrame(raf); frame(); }
      try { localStorage.setItem(STK_TRAY_KEY, JSON.stringify({ x: parseFloat(tray.style.left), y: parseFloat(tray.style.top) })); } catch (err) { /* position is a nicety */ }
    };
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    return;
  }
  const thumb = e.target.closest('.stk-thumb');
  if (!thumb || e.target.closest('.stk-thumb-x')) return;
  e.preventDefault();
  const imgId = thumb.dataset.img;
  const img = _stkImgs.get(imgId);
  if (!img) return;
  const sx = e.clientX, sy = e.clientY;
  let ghost = null, raf = 0, last = null, overTray = false, hostAt = 0, hostCache = new Map();
  const k = Math.min(1, STK_START_SIDE / Math.max(img.w, img.h));
  const gw = Math.max(24, img.w * k), gh = Math.max(24, img.h * k);
  const trayRect = tray.getBoundingClientRect();
  const inTray = (x, y) => x >= trayRect.left && x <= trayRect.right && y >= trayRect.top && y <= trayRect.bottom;
  const frame = () => {
    raf = 0;
    if (!last) return;
    if (!ghost) {
      ghost = document.createElement('div');
      ghost.className = 'stk-ghost';
      ghost.style.width = gw + 'px';
      ghost.style.height = gh + 'px';
      ghost.innerHTML = '<img src="' + img.url + '" alt="" draggable="false">';
      document.body.appendChild(ghost);
      document.body.classList.add('stk-dragging');
    }
    overTray = inTray(last.x, last.y);
    const now = performance.now();
    if (overTray) _stkShowTarget(null);
    else if (now - hostAt > 90) { hostAt = now; _stkShowTarget(_stkHostAt(last.x, last.y, hostCache)); }
    ghost.style.transform = 'translate(' + (last.x - gw / 2) + 'px,' + (last.y - gh / 2) + 'px)';
    ghost.classList.toggle('is-cancel', overTray);
  };
  const move = ev => {
    if (!ghost && !last && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
    last = { x: ev.clientX, y: ev.clientY };
    if (!raf) raf = requestAnimationFrame(frame);
  };
  const up = ev => {
    window.removeEventListener('pointermove', move, true);
    window.removeEventListener('pointerup', up, true);
    window.removeEventListener('pointercancel', up, true);
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    document.body.classList.remove('stk-dragging');
    _stkShowTarget(null);
    if (!ghost && !last) {
      if (ev.type !== 'pointercancel') { const c = _stkCentre(); _stkPlace(imgId, c.x, c.y); }
      return;
    }
    if (ghost) ghost.remove();
    if (ev.type === 'pointercancel') return;
    if (!inTray(ev.clientX, ev.clientY)) _stkPlace(imgId, ev.clientX, ev.clientY);
  };
  window.addEventListener('pointermove', move, true);
  window.addEventListener('pointerup', up, true);
  window.addEventListener('pointercancel', up, true);
}

/* ── Keys, outside clicks, files dropped or pasted ───────── */

function _stkOnKey(e) {
  if (e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyS') {
    e.preventDefault();
    e.stopPropagation();
    stkToggleMode();
    return;
  }
  if (!_stkSel && !_stkMode) return;
  if (_stkTyping()) return;
  // A dialog that is open owns its keys (Escape closes it, not the selection).
  if (document.querySelector('.modal-overlay:not(.hidden), #dialog-modal:not(.hidden)')) return;
  const it = _stkSel ? _stkById(_stkSel) : null;
  if (e.key === 'Escape') {
    if (it) { _stkSel = null; _stkSync(); }
    else if (_stkMode) stkToggleMode(false);
    else return;
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  if (!it || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault(); e.stopPropagation();
    stkRemove(it.id);
    return;
  }
  const step = e.shiftKey ? 10 : 1;
  const arrows = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
  if (arrows[e.key] && !it.lock) {
    e.preventDefault(); e.stopPropagation();
    _stkNudge(it, arrows[e.key][0], arrows[e.key][1]);
  }
}

function _stkOnDocDown(e) {
  const t = e.target;
  const ours = !!(t.closest && (t.closest('.stk-sticker') || t.closest('#stk-ui .stk-frame') || t.closest('#stk-ui .stk-bar') ||
      t.closest('#stk-tray') || t.closest('.mx-toast') || t.closest('#dialog-modal')));
  if (!ours && _stkMode && e.button === 0) {
    const hit = _stkBehindAt(e.clientX, e.clientY);
    if (hit) {
      e.preventDefault();
      e.stopPropagation();
      _stkSwallowClick();
      if (_stkTyping()) document.activeElement.blur();
      stkSelect(hit.id);
      if (!hit.lock) _stkBegin(e, hit, 'move');
      return;
    }
  }
  if (!_stkSel || ours) return;
  _stkSel = null;
  _stkSync();
}

/* A behind-sticker sits under its pane's own boxes — even a transparent grid
   or wrapper covers it — so the pointer never reaches it. In sticker mode it
   is found by where it is instead: the topmost one whose (turned) box holds
   the point, inside the part of its pane that shows. */
function _stkBehindAt(x, y) {
  let best = null;
  _stkEls.forEach((el, id) => {
    if (!el.isConnected || !el.classList.contains('is-behind')) return;
    const it = _stkById(id);
    if (!it) return;
    const r = el.getBoundingClientRect();
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) return;
    const th = -(it.rot || 0) * Math.PI / 180;
    const dx = x - (r.left + r.width / 2), dy = y - (r.top + r.height / 2);
    const lx = dx * Math.cos(th) - dy * Math.sin(th), ly = dx * Math.sin(th) + dy * Math.cos(th);
    if (Math.abs(lx) > it.w / 2 || Math.abs(ly) > it.h / 2) return;
    const host = el.parentElement && el.parentElement.parentElement;
    if (host) {
      const hr = host.getBoundingClientRect();
      if (x < hr.left || x > hr.right || y < hr.top || y > hr.bottom) return;
    }
    if (!best || (it.z || 0) >= (best.z || 0)) best = it;
  });
  return best;
}

/** The click that follows a pointerdown taken for a sticker is not the card's to have (it would open it). */
function _stkSwallowClick() {
  let timer = 0;
  const off = () => {
    clearTimeout(timer);
    window.removeEventListener('click', kill, true);
    window.removeEventListener('pointerup', later, true);
  };
  const kill = ev => { ev.preventDefault(); ev.stopPropagation(); off(); };
  // The click comes straight after pointerup, in the same turn; one tick later it is not coming.
  const later = () => { setTimeout(off, 0); };
  window.addEventListener('click', kill, true);
  window.addEventListener('pointerup', later, true);
  timer = setTimeout(off, 10000);
}

function _stkHasFiles(e) {
  const dt = e.dataTransfer;
  return !!(dt && Array.from(dt.types || []).indexOf('Files') >= 0);
}

let _stkDragOverAt = 0;
function _stkOnDragOver(e) {
  if (!_stkMode || !_stkHasFiles(e)) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  const now = performance.now();
  if (now - _stkDragOverAt < 90) return;
  _stkDragOverAt = now;
  _stkShowTarget(_stkHostAt(e.clientX, e.clientY));
}

async function _stkOnDrop(e) {
  if (!_stkMode || !_stkHasFiles(e)) return;
  e.preventDefault();
  e.stopPropagation();
  _stkShowTarget(null);
  const x = e.clientX, y = e.clientY;
  const tray = document.getElementById('stk-tray');
  const ontoTray = tray && tray.contains(document.elementFromPoint(x, y));
  const ids = await _stkAddFiles(e.dataTransfer.files);
  if (ontoTray) return;
  ids.forEach((id, n) => _stkPlace(id, x + n * 24, y + n * 24));
}

async function _stkOnPaste(e) {
  if (!_stkMode || _stkTyping()) return;
  const files = Array.from((e.clipboardData && e.clipboardData.files) || []).filter(f => /^image\//.test(f.type));
  if (!files.length) return;
  e.preventDefault();
  const ids = await _stkAddFiles(files);
  const c = _stkCentre();
  ids.forEach((id, n) => _stkPlace(id, c.x + n * 24, c.y + n * 24));
}

/** Another tab changed the stickers: take its list, and any pictures it added, rather than later saving over them. */
function _stkOnStorage(e) {
  if (e.key !== STK_KEY) return;
  _stkLoad();
  const missing = _stkItems.some(s => !_stkImgs.has(s.img));
  (missing ? _stkLoadImages(true) : Promise.resolve()).then(() => {
    _stkTrayRender();
    _stkLastPage = null;
    _stkSync();
  });
}

/* ── Start up ────────────────────────────────────────────── */

function _stkOwnNode(n) {
  return n.nodeType === 1 && (n.classList.contains('stk-layer') || n.classList.contains('stk-sticker'));
}

async function stkInit() {
  _stkLoad();
  await _stkLoadImages();
  _stkReady = true;

  if (typeof ResizeObserver !== 'undefined') {
    // Fires after layout, so reading boxes here costs nothing extra.
    _stkRo = new ResizeObserver(entries => {
      const hosts = new Set();
      entries.forEach(en => {
        const t = en.target;
        if (_stkHosts.has(t)) hosts.add(t);
        else if (t.parentElement && _stkHosts.has(t.parentElement)) hosts.add(t.parentElement);
      });
      hosts.forEach(h => { if (h.isConnected) _stkSizeLayers(h); });
      _stkOnScroll();
    });
  }
  // A page or pane rebuilt by its own code takes the layers with it; put them back.
  const mo = new MutationObserver(recs => {
    let again = false;
    for (const r of recs) {
      if (r.type === 'attributes') { again = true; continue; }
      const t = r.target;
      if (t.classList && (t.classList.contains('stk-layer') || (t.closest && t.closest('.stk-layer')))) continue;
      const nodes = Array.from(r.addedNodes).concat(Array.from(r.removedNodes));
      if (nodes.length && nodes.every(_stkOwnNode)) continue;
      if (_stkHosts.has(t)) _stkKidsDirty.add(t);
      again = true;
    }
    if (again) _stkQueue();
  });
  const root = _stkRoot();
  if (root) mo.observe(root, { childList: true, subtree: true });
  mo.observe(document.body, { attributes: true, attributeFilter: ['data-route'] });

  window.addEventListener('hashchange', _stkQueue);
  window.addEventListener('resize', () => {
    _stkQueue();
    const tray = document.getElementById('stk-tray');
    if (tray && !tray.hidden) _stkTrayPosition(tray);
  });
  document.addEventListener('scroll', _stkOnScroll, { capture: true, passive: true });
  window.addEventListener('keydown', _stkOnKey, true);
  window.addEventListener('pointerdown', _stkOnDocDown, true);
  window.addEventListener('dragover', _stkOnDragOver);
  window.addEventListener('dragleave', e => { if (_stkMode && !e.relatedTarget) _stkShowTarget(null); });
  window.addEventListener('drop', _stkOnDrop);
  window.addEventListener('paste', _stkOnPaste);
  window.addEventListener('storage', _stkOnStorage);
  // A gesture whose pointerup never arrives (the window lost focus mid-drag)
  // ends where it is instead of leaving the sticker stuck to the pointer.
  window.addEventListener('blur', () => { if (_stkDrag) _stkOnUp({ type: 'pointerup' }); });
  // Write a gesture's last state before the tab goes.
  window.addEventListener('pagehide', () => { if (_stkSaveTimer) _stkSaveNow(); });
  _stkSync();
}

document.addEventListener('DOMContentLoaded', () => { stkInit(); });
