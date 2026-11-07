/* ============================================================
   MEDIA-STORE.JS — uploaded pictures, kept out of "Your data"
   ============================================================

   Covers (programs, snippets, notebooks, the Collection wing), notebook
   question pictures and cheat-sheet images used to be saved as data: URLs
   inside the saves in localStorage, which every browser caps at about 5 MB of
   characters. So each picture ate into the same budget as the whole library,
   and a cheat-sheet image was stored up to eleven times over: the page, plus
   each of its ten revision snapshots.

   The bytes now live in IndexedDB `ssp-media`, the disk-sized allowance the
   sticker pictures already use (Settings > Storage > "Pictures and offline
   copy"), and the save holds a short reference:

       media:m<length>_<hash>

   The id is a hash of the picture's bytes, so a picture used twice is stored
   once, and an old save moved over on two devices gets the same id on both.

   SHOWING ONE: mediaSrc(value[, 'thumb']) wherever a picture is drawn.
     - a value that is not a reference (an old data: URL, a web address) comes
       back as it is, so old saves and backups still show;
     - a reference whose picture has been read comes back as its blob: URL;
     - one not read yet comes back as a see-through pixel tagged with its id,
       and is filled in once the pictures are read (once, at start).
   'thumb' asks for the small copy (MEDIA_THUMB_W wide) kept beside a bigger
   picture. Library cards use it, so a grid decodes a fraction of the pixels.

   MOVING OLD SAVES OVER (mediaSweep): a data: URL left in any picture field
   is stored and replaced by its reference. Runs a few seconds after start and
   after any save that still holds one (an import, a cloud copy from an older
   device, an older cached file) -- but only once every file that draws these
   pictures says it can read references (window.MEDIA_READERS), because the
   first load after a release can still run old cached copies of them.

   PICTURES NOTHING USES (mediaGc): looked for once a day. A picture that no
   save on this device mentions is marked, and deleted only after it has
   stayed unused for MEDIA_ORPHAN_DAYS: signing out removes the cloud copy of
   the library from this device, and its covers must still be here when you
   sign back in.

   Device only, like the sticker pictures: cloud sync carries the references,
   not the bytes (a Firestore document is capped at 1 MB, which ten covers
   would fill). Export writes the pictures back in as data: URLs, so a backup
   is complete on its own, and import moves them out again.
   ============================================================ */

const MEDIA_DB_NAME = 'ssp-media';
const MEDIA_PREFIX = 'media:';
const MEDIA_REF_RE = /media:(m[0-9a-z]+_[0-9a-z]+)/g;
const MEDIA_DATA_RE = /data:image\/[\w.+-]+(?:;[\w.+-]+=[\w.+%-]+)*;base64,[A-Za-z0-9+/=]+/g;
const MEDIA_TAG_RE = /data:image\/gif;base64,[A-Za-z0-9+/=]+#media=(m[0-9a-z]+_[0-9a-z]+)(;thumb)?/g;
const MEDIA_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const MEDIA_MAX_SIDE = 1600;     // longest side kept for an upload
const MEDIA_THUMB_W = 640;       // cards are ~300px wide; this is sharp at 2x
const MEDIA_ORPHAN_DAYS = 14;
const MEDIA_GC_KEY = 'ssp.media.gc';
/* Every file that draws one of these pictures. Each sets its own name in
   window.MEDIA_READERS; old saves are moved over only when all of them have. */
const MEDIA_READER_FILES = ['admin-form', 'admin-snippets', 'admin-notebooks', 'admin-notebook-questions',
  'browse', 'history', 'home', 'notes', 'study', 'notes-practice', 'cheatsheet', 'wings-registry', 'wings-collection'];

let _mdDbPromise = null;
const _mdPics = new Map();       // id -> { full, thumb, w, h, bytes }
let _mdReady = false;
let _mdReadyPromise = null;
let _mdSweepTimer = null;
let _mdSweeping = false;
let _mdKeepAsked = false;

/* ── IndexedDB ───────────────────────────────────────────── */

function _mdDb() {
  if (_mdDbPromise) return _mdDbPromise;
  _mdDbPromise = new Promise((resolve, reject) => {
    let req;
    try { req = indexedDB.open(MEDIA_DB_NAME, 1); } catch (e) { reject(e); return; }
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains('pics')) req.result.createObjectStore('pics', { keyPath: 'id' });
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { db.close(); _mdDbPromise = null; };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
  // A failure is not kept: the next call tries again.
  _mdDbPromise.catch(() => { _mdDbPromise = null; });
  return _mdDbPromise;
}

function _mdIdb(mode, fn) {
  return _mdDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction('pics', mode);
    const req = fn(tx.objectStore('pics'));
    tx.oncomplete = () => resolve(req && 'result' in req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('IndexedDB write aborted'));
  }));
}

function _mdRemember(rec) {
  const old = _mdPics.get(rec.id);
  if (old) { URL.revokeObjectURL(old.full); if (old.thumb) URL.revokeObjectURL(old.thumb); }
  _mdPics.set(rec.id, {
    full: URL.createObjectURL(rec.blob),
    thumb: rec.thumb ? URL.createObjectURL(rec.thumb) : null,
    w: rec.w || 0, h: rec.h || 0,
    bytes: (rec.blob ? rec.blob.size : 0) + (rec.thumb ? rec.thumb.size : 0)
  });
}

/** Read every picture's handle in (not its pixels). Resolves when done, or failed. */
function mediaReady() {
  if (_mdReadyPromise) return _mdReadyPromise;
  _mdReadyPromise = (typeof indexedDB === 'undefined' ? Promise.resolve([]) : _mdIdb('readonly', st => st.getAll()))
    .then(all => {
      // One stored meanwhile is already here; replacing it would revoke a URL in use.
      (all || []).forEach(r => { if (r && r.id && r.blob && !_mdPics.has(r.id)) _mdRemember(r); });
    })
    .catch(e => console.warn('[media] Pictures could not be read:', e))
    .then(() => { _mdReady = true; _mdPatch(); });
  return _mdReadyPromise;
}

/* ── Showing a picture ───────────────────────────────────── */

function mediaIsRef(v) {
  return typeof v === 'string' && v.lastIndexOf(MEDIA_PREFIX, 0) === 0;
}

/** What to put in src= (or url()) for a saved picture value. */
function mediaSrc(v, size) {
  if (!mediaIsRef(v)) return v || '';
  const id = v.slice(MEDIA_PREFIX.length);
  const p = _mdPics.get(id);
  if (p) return (size === 'thumb' && p.thumb) || p.full;
  if (_mdReady) return MEDIA_PIXEL;              // not on this device
  return MEDIA_PIXEL + '#media=' + id + (size === 'thumb' ? ';thumb' : '');
}

function _mdUntag(s) {
  return s.replace(MEDIA_TAG_RE, (m, id, th) => mediaSrc(MEDIA_PREFIX + id, th ? 'thumb' : ''));
}

/** Fill in pictures drawn before they had been read. */
function _mdPatch() {
  let els;
  try { els = document.querySelectorAll('img[src*="#media="], [style*="#media="]'); } catch (e) { return; }
  els.forEach(el => {
    const src = el.getAttribute('src');
    if (src && src.indexOf('#media=') !== -1) el.setAttribute('src', _mdUntag(src));
    const st = el.getAttribute('style');
    if (st && st.indexOf('#media=') !== -1) el.setAttribute('style', _mdUntag(st));
  });
}

/* ── Bytes ───────────────────────────────────────────────── */

/** 64 bits from two 32-bit lanes (cyrb53's mixing, kept to its full width). */
function _mdHash(bytes) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < bytes.length; i++) {
    const c = bytes[i];
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(36) + (h1 >>> 0).toString(36);
}

function _mdBytesOf(blob) {
  if (blob.arrayBuffer) return blob.arrayBuffer().then(b => new Uint8Array(b));
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(new Uint8Array(r.result));
    r.onerror = () => reject(r.error);
    r.readAsArrayBuffer(blob);
  });
}

function _mdBlobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function _mdDataUrlToBlob(u) {
  const comma = u.indexOf(',');
  const type = u.slice(5, comma).split(';')[0] || 'image/png';
  const bin = atob(u.slice(comma + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** Decode through an <img>: it also reads SVG. The caller revokes `url`. */
function _mdDecode(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const im = new Image();
    im.onload = () => resolve({ im, url });
    im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Not a picture this browser can read')); };
    im.src = url;
  });
}

/** Draw at w x h and encode, or null if this browser cannot make `type`. */
function _mdEncode(im, w, h, type, q) {
  return new Promise(resolve => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    try { c.getContext('2d').drawImage(im, 0, 0, w, h); } catch (e) { resolve(null); return; }
    try { c.toBlob(b => resolve(b && b.type === type ? b : null), type, q); } catch (e) { resolve(null); }
  });
}

/* WebP keeps a PNG's see-through background and is far smaller than either.
   Where it cannot be made, a JPEG stays JPEG and anything else goes to PNG,
   so transparency is never flattened to black. */
async function _mdEncodeBest(im, w, h, srcType, q) {
  return (await _mdEncode(im, w, h, 'image/webp', q)) ||
    (await _mdEncode(im, w, h, /jpe?g/i.test(srcType || '') ? 'image/jpeg' : 'image/png', q));
}

/** Scale a chosen file down once, to what it will ever be shown at. */
async function _mdPrepare(file, maxSide) {
  const { im, url } = await _mdDecode(file);
  try {
    const w = im.naturalWidth || 0, h = im.naturalHeight || 0;
    // A GIF may be animated and an SVG is drawn at any size: kept as they are.
    if (/gif|svg/i.test(file.type) || !w || !h) return { blob: file, w: w || 300, h: h || 300 };
    const k = Math.min(1, maxSide / Math.max(w, h));
    const tw = Math.max(1, Math.round(w * k)), th = Math.max(1, Math.round(h * k));
    const out = await _mdEncodeBest(im, tw, th, file.type, 0.86);
    // Small enough already, and re-encoding would not make it smaller: keep the file.
    if (k === 1 && (!out || out.size >= file.size)) return { blob: file, w, h };
    return out ? { blob: out, w: tw, h: th } : { blob: file, w, h };
  } finally { URL.revokeObjectURL(url); }
}

/** The small copy for cards, or null when the picture is small already. */
async function _mdThumb(blob, w) {
  if (!w || w <= MEDIA_THUMB_W * 1.25 || /gif|svg/i.test(blob.type || '')) return null;
  const { im, url } = await _mdDecode(blob);
  try {
    const tw = MEDIA_THUMB_W;
    const th = Math.max(1, Math.round((im.naturalHeight || 1) * tw / (im.naturalWidth || tw)));
    const t = await _mdEncodeBest(im, tw, th, blob.type, 0.8);
    return t && t.size < blob.size * 0.8 ? t : null;
  } finally { URL.revokeObjectURL(url); }
}

/* ── Storing ─────────────────────────────────────────────── */

/** Store a picture's bytes as they are; resolves to its reference. */
async function mediaPut(blob, w, h) {
  await mediaReady();
  const bytes = await _mdBytesOf(blob);
  const id = 'm' + bytes.length.toString(36) + '_' + _mdHash(bytes);
  if (_mdPics.has(id)) { _mdUnorphan(id); return MEDIA_PREFIX + id; }
  if (!w || !h) {
    try { const d = await _mdDecode(blob); w = d.im.naturalWidth; h = d.im.naturalHeight; URL.revokeObjectURL(d.url); }
    catch (e) { w = w || 0; h = h || 0; }
  }
  let thumb = null;
  try { thumb = await _mdThumb(blob, w); } catch (e) { /* the full picture will do */ }
  const rec = { id, blob, thumb, type: blob.type || '', w, h, added: Date.now() };
  await _mdIdb('readwrite', st => st.put(rec));
  _mdRemember(rec);
  _mdUnorphan(id);
  return MEDIA_PREFIX + id;
}

/* What the old upload path saved, for a browser that will not keep the
   picture apart (IndexedDB off in some private windows): small, inside the save. */
async function _mdSmallDataUrl(blob) {
  try {
    const { im, url } = await _mdDecode(blob);
    try {
      const k = Math.min(1, 960 / (im.naturalWidth || 960));
      const out = await _mdEncode(im, Math.max(1, Math.round(im.naturalWidth * k)),
        Math.max(1, Math.round(im.naturalHeight * k)), 'image/jpeg', 0.82);
      if (out) return _mdBlobToDataUrl(out);
    } finally { URL.revokeObjectURL(url); }
  } catch (e) { /* fall through */ }
  return _mdBlobToDataUrl(blob);
}

/**
 * A picture the person chose: scaled to `opts.maxSide`, stored, and resolved
 * to the value to save -- its reference, or, where it cannot be stored apart,
 * a small data: URL as before. Rejects only when the file is not a picture.
 */
async function mediaUpload(file, opts) {
  if (!file || !/^image\//.test(file.type || '')) throw new Error('That is not an image file.');
  const p = await _mdPrepare(file, (opts && opts.maxSide) || MEDIA_MAX_SIDE);
  try {
    const ref = await mediaPut(p.blob, p.w, p.h);
    _mdAskToKeep();
    return ref;
  } catch (e) {
    console.warn('[media] Could not store the picture apart; keeping it inside the save:', e);
    if (typeof toast === 'function') {
      toast('This browser would not store the picture separately, so it is saved inside your data.', { type: 'warning' });
    }
    return _mdSmallDataUrl(p.blob);
  }
}

/* Ask the browser to keep this site's storage when the disk runs low. Chrome
   and Edge answer on their own (no prompt) from how much the site is used;
   Firefox asks. Asked once, at the first picture, when it starts to matter. */
function _mdAskToKeep() {
  if (_mdKeepAsked) return;
  _mdKeepAsked = true;
  try {
    if (navigator.storage && navigator.storage.persisted && navigator.storage.persist) {
      navigator.storage.persisted().then(p => (p ? true : navigator.storage.persist())).catch(() => {});
    }
  } catch (e) { /* not offered here */ }
}

async function mediaForget(id) {
  const p = _mdPics.get(id);
  if (p) { URL.revokeObjectURL(p.full); if (p.thumb) URL.revokeObjectURL(p.thumb); }
  _mdPics.delete(id);
  try { await _mdIdb('readwrite', st => st.delete(id)); } catch (e) { /* already gone */ }
}

/* ── Where pictures are saved ────────────────────────────── */

/** fn(obj, key) for every field that may hold a picture, in a library save
 *  (`app`: the state, or a parsed backup) and the cheat sheets. */
function _mdSlots(app, sheets, fn) {
  const covers = list => {
    if (Array.isArray(list)) list.forEach(o => { if (o && typeof o === 'object') fn(o, 'coverImage'); });
  };
  if (app && typeof app === 'object') {
    covers(app.challenges);
    if (app.codingStash) covers(app.codingStash.challenges);
    covers(app.snippets);
    covers(app.notebooks);
    (app.notebooks || []).forEach(nb => ((nb && nb.sections) || []).forEach(sec =>
      ((sec && sec.answerKeysData) || []).forEach(d => { if (d && typeof d === 'object') fn(d, 'image'); })));
    const wings = app.wings && typeof app.wings === 'object' ? app.wings : {};
    Object.keys(wings).forEach(key => {
      if (!Array.isArray(wings[key]) || typeof wingSchema !== 'function') return;
      const keys = (wingSchema(key).fields || []).filter(f => f.type === 'image').map(f => f.key);
      if (keys.length) wings[key].forEach(w => { if (w && w.data) keys.forEach(k => fn(w.data, k)); });
    });
  }
  (Array.isArray(sheets) ? sheets : []).forEach(s => {
    if (!s) return;
    (s.pages || []).forEach(p => ((p && p.blocks) || []).forEach(b => { if (b && b.type === 'image') fn(b, 'src'); }));
    // Revision snapshots are the pages as JSON text; the pictures sit inside it.
    (s.history || []).forEach(h => { if (h && typeof h.body === 'string') fn(h, 'body'); });
  });
}

function _mdReadersReady() {
  const r = window.MEDIA_READERS || {};
  return MEDIA_READER_FILES.every(f => r[f]);
}

/**
 * Store every data: URL picture in `app` / `sheets` and put its reference in
 * its place, in place. Resolves to how many fields changed in each.
 */
async function mediaAbsorb(app, sheets) {
  const found = new Set();
  const look = (o, k) => {
    const v = o[k];
    if (typeof v === 'string' && v.indexOf('data:image/') !== -1) (v.match(MEDIA_DATA_RE) || []).forEach(u => found.add(u));
  };
  _mdSlots(app, null, look);
  _mdSlots(null, sheets, look);
  if (!found.size) return { app: 0, sheets: 0 };
  const refs = new Map();
  for (const u of found) {
    try { refs.set(u, await mediaPut(_mdDataUrlToBlob(u))); }
    catch (e) { console.warn('[media] A saved picture could not be moved; it stays inside the save.', e); }
  }
  // Swapped in on what is there NOW: anything edited meanwhile keeps its edit.
  const swap = counter => (o, k) => {
    const v = o[k];
    if (typeof v !== 'string' || v.indexOf('data:image/') === -1) return;
    const next = v.replace(MEDIA_DATA_RE, u => refs.get(u) || u);
    if (next !== v) { o[k] = next; counter.n++; }
  };
  const a = { n: 0 }, s = { n: 0 };
  _mdSlots(app, null, swap(a));
  _mdSlots(null, sheets, swap(s));
  return { app: a.n, sheets: s.n };
}

/** The same for a backup being imported, before any of it is written. */
function mediaAbsorbBackup(parsed) {
  if (!parsed || !_mdReadersReady()) return Promise.resolve({ app: 0, sheets: 0 });
  return mediaAbsorb(parsed, Array.isArray(parsed.cheatsheets) ? parsed.cheatsheets : null);
}

/** Move the pictures still inside this device's saves out of them. */
async function mediaSweep() {
  if (_mdSweeping || typeof state === 'undefined' || !_mdReadersReady()) return 0;
  // Never touch a save that could not be read: what is in memory is not it.
  if (typeof _loadFailed !== 'undefined' && _loadFailed) return 0;
  _mdSweeping = true;
  try {
    let sheets = null;
    if (typeof cs !== 'undefined' && cs && Array.isArray(cs.sheets)) {
      // Kept in step with storage on every edit (csTouch saves), so reading it in is safe.
      if (!cs.sheets.length && typeof csLoad === 'function') csLoad();
      sheets = cs.sheets;
    }
    const n = await mediaAbsorb(state, sheets);
    if (n.app && typeof saveData === 'function') saveData();
    if (n.sheets && typeof csSave === 'function') csSave();
    if (n.app + n.sheets) console.log('[media] Moved', n.app + n.sheets, 'saved picture(s) out of the 5 MB store.');
    return n.app + n.sheets;
  } finally { _mdSweeping = false; }
}

/** A save just wrote a data: URL picture: move it out shortly. */
function mediaSweepSoon() {
  clearTimeout(_mdSweepTimer);
  _mdSweepTimer = setTimeout(() => { mediaSweep().catch(e => console.warn('[media] sweep failed', e)); }, 1500);
}

/* ── Backups ─────────────────────────────────────────────── */

/** JSON text with each reference written back as its picture, so a backup carries them. */
async function mediaInlineText(json) {
  const ids = new Set();
  let m;
  MEDIA_REF_RE.lastIndex = 0;
  while ((m = MEDIA_REF_RE.exec(json))) ids.add(m[1]);
  if (!ids.size) return json;
  const urls = new Map();
  for (const id of ids) {
    try {
      const rec = await _mdIdb('readonly', st => st.get(id));
      if (rec && rec.blob) urls.set(id, await _mdBlobToDataUrl(rec.blob));
    } catch (e) { /* not on this device: the reference stays */ }
  }
  return json.replace(MEDIA_REF_RE, (s, id) => urls.get(id) || s);
}

/* ── Pictures nothing uses ───────────────────────────────── */

function _mdGcState() {
  try {
    const v = JSON.parse(localStorage.getItem(MEDIA_GC_KEY) || 'null');
    if (v && typeof v === 'object') return { last: v.last || 0, orphans: v.orphans || {} };
  } catch (e) { /* start over */ }
  return { last: 0, orphans: {} };
}

function _mdGcSave(v) {
  try { localStorage.setItem(MEDIA_GC_KEY, JSON.stringify(v)); } catch (e) { /* full; tried again tomorrow */ }
}

function _mdUnorphan(id) {
  const g = _mdGcState();
  if (g.orphans[id]) { delete g.orphans[id]; _mdGcSave(g); }
}

/** Every id any save on this device, or anything open now, mentions; null if a save could not be read. */
function _mdUsedIds() {
  const used = new Set();
  const scan = s => {
    if (typeof s !== 'string' || s.indexOf(MEDIA_PREFIX) === -1) return;
    let m;
    MEDIA_REF_RE.lastIndex = 0;
    while ((m = MEDIA_REF_RE.exec(s))) used.add(m[1]);
  };
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || k === MEDIA_GC_KEY) continue;
      const raw = localStorage.getItem(k) || '';
      scan(typeof storeDecode === 'function' ? storeDecode(raw) : raw);
    }
  } catch (e) {
    console.warn('[media] A save could not be read, so no picture is removed today.', e);
    return null;
  }
  const live = [
    typeof state !== 'undefined' ? state : null,
    typeof cs !== 'undefined' && cs ? cs.sheets : null,
    typeof adminState !== 'undefined' ? adminState : null,
    typeof studyModeState !== 'undefined' ? studyModeState : null,
    typeof notebookAdminState !== 'undefined' ? notebookAdminState : null,
    typeof nbqDraft !== 'undefined' ? nbqDraft : null,
  ];
  live.forEach(o => { if (o) { try { scan(JSON.stringify(o)); } catch (e) { /* circular: skip */ } } });
  return used;
}

/**
 * Mark the pictures nothing uses, and delete those unused for
 * MEDIA_ORPHAN_DAYS. Resolves to { removed, unused, unusedBytes }.
 */
async function mediaGc() {
  await mediaReady();
  const g = _mdGcState();
  const out = { removed: 0, unused: 0, unusedBytes: 0 };
  if (typeof _loadFailed !== 'undefined' && _loadFailed) return out;
  const used = _mdUsedIds();
  if (!used) return out;
  const now = Date.now(), orphans = {}, doomed = [];
  _mdPics.forEach((p, id) => {
    if (used.has(id)) return;
    orphans[id] = g.orphans[id] || now;
    if (now - orphans[id] >= MEDIA_ORPHAN_DAYS * 86400000) doomed.push(id);
    else { out.unused++; out.unusedBytes += p.bytes; }
  });
  for (const id of doomed) { await mediaForget(id); delete orphans[id]; }
  out.removed = doomed.length;
  _mdGcSave({ last: now, orphans });
  return out;
}

/** How many pictures, and how many bytes, are stored (Settings' storage meter). */
async function mediaUsage() {
  await mediaReady();
  let bytes = 0;
  _mdPics.forEach(p => { bytes += p.bytes; });
  return { count: _mdPics.size, bytes };
}

/* ── Start ───────────────────────────────────────────────── */

mediaReady();
setTimeout(() => { mediaSweep().catch(e => console.warn('[media] sweep failed', e)); }, 4000);
setTimeout(() => {
  if (Date.now() - _mdGcState().last < 86400000) return;
  const run = () => mediaGc().catch(e => console.warn('[media] clean-up failed', e));
  if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 10000 }); else run();
}, 30000);
