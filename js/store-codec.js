/* ============================================================
   STORE-CODEC.JS — big saves are kept compressed
   ============================================================

   localStorage gives a site about 5 MB, counted in characters (see
   storage-meter.js). The library is JSON: the same field names thousands of
   times over, and the same code in a program's starter, its reference and
   every attempt at it. Deflate takes that to about a seventh of its bytes,
   and two of those bytes then go into each stored character, so the saved
   text is about thirteen times shorter (measured on the 159-program starter
   pack: 439,566 characters -> 32,981).

   NOTHING IS DROPPED. What comes back is the same JSON, character for
   character, and every compressed copy is read back and compared before it
   is written; if the two differ, the plain text is written instead. A save
   that cannot be read is worse than a big one.

   Format:   ~z1:<deflated bytes>:<original characters>:<checksum>:<packed>
   Raw deflate carries no checksum, and a flipped bit in it can inflate into
   different text without an error, so the header carries one (FNV-1a over
   the deflated bytes) and a mismatch is a read failure, not wrong data.
   Anything that does not start with "~z1:" is plain JSON and is read as it
   is, so every save written before this stays readable.

   Packing: 15 bits per character, stored as value + 0x20. The largest is
   0x801F, below the surrogate range, so every browser keeps it intact.

   Synchronous on purpose (vendor/fflate): the save made while the tab closes
   must finish before the page goes, and one code path for every save keeps
   them all the same.
   ============================================================ */

const STORE_Z_TAG = '~z1:';
const STORE_Z_MIN = 4096;          // shorter than this stays plain: not worth it

function storeIsPacked(raw) {
  return typeof raw === 'string' && raw.charCodeAt(0) === 126 && raw.startsWith(STORE_Z_TAG);
}

/** Bytes -> characters, 15 bits each. */
function _storePack(bytes) {
  const parts = [];
  let chunk = new Array(0);
  let acc = 0, bits = 0;
  for (let i = 0; i < bytes.length; i++) {
    acc = (acc << 8) | bytes[i];
    bits += 8;
    if (bits >= 15) {
      bits -= 15;
      chunk.push(((acc >>> bits) & 0x7fff) + 0x20);
      acc &= (1 << bits) - 1;
      if (chunk.length === 8192) { parts.push(String.fromCharCode.apply(null, chunk)); chunk = []; }
    }
  }
  if (bits > 0) chunk.push(((acc << (15 - bits)) & 0x7fff) + 0x20);
  if (chunk.length) parts.push(String.fromCharCode.apply(null, chunk));
  return parts.join('');
}

/** Characters -> bytes; throws if the text is not what _storePack wrote. */
function _storeUnpack(str, from, byteLen) {
  const out = new Uint8Array(byteLen);
  let acc = 0, bits = 0, o = 0;
  for (let i = from; i < str.length && o < byteLen; i++) {
    const v = str.charCodeAt(i) - 0x20;
    if (v < 0 || v > 0x7fff) throw new Error('compressed save is damaged');
    acc = (acc << 15) | v;
    bits += 15;
    while (bits >= 8 && o < byteLen) {
      bits -= 8;
      out[o++] = (acc >>> bits) & 0xff;
    }
    acc &= (1 << bits) - 1;
  }
  if (o !== byteLen) throw new Error('compressed save is cut short');
  return out;
}

/** FNV-1a over bytes, as base-36 text. */
function _storeHash(bytes) {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}

/** Header fields of a packed string, or null. */
function _storeHeader(raw) {
  if (!storeIsPacked(raw)) return null;
  const a = raw.indexOf(':', STORE_Z_TAG.length);
  const b = a > 0 ? raw.indexOf(':', a + 1) : -1;
  const c = b > 0 ? raw.indexOf(':', b + 1) : -1;
  if (a < 0 || b < 0 || c < 0 || c - b > 9) return null;
  const zLen = parseInt(raw.slice(STORE_Z_TAG.length, a), 10);
  const origLen = parseInt(raw.slice(a + 1, b), 10);
  if (!(zLen >= 0) || !(origLen >= 0)) return null;
  return { zLen, origLen, hash: raw.slice(b + 1, c), body: c + 1 };
}

/** How long the text was before it was packed (its own length if it is plain). */
function storeOriginalLength(raw) {
  if (typeof raw !== 'string') return 0;
  const h = _storeHeader(raw);
  return h ? h.origLen : raw.length;
}

/**
 * Read a stored value: packed text comes back as the JSON it was made from,
 * plain text comes back as it is. Throws on a damaged packed value, so the
 * caller's own "could not read" handling runs.
 */
function storeDecode(raw) {
  if (!storeIsPacked(raw)) return raw;
  if (typeof fflate === 'undefined') throw new Error('the compressor did not load, so this save cannot be read');
  const h = _storeHeader(raw);
  if (!h) throw new Error('compressed save has no header');
  if (raw.length - h.body !== Math.ceil(h.zLen * 8 / 15)) throw new Error('compressed save is the wrong size');
  const z = _storeUnpack(raw, h.body, h.zLen);
  if (_storeHash(z) !== h.hash) throw new Error('compressed save does not match its checksum');
  const bytes = fflate.inflateSync(z);
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (text.length !== h.origLen) throw new Error('compressed save is the wrong length');
  return text;
}

/** Pack bytes already deflated from `json`, with the header. */
function _storeWrap(z, json) {
  return STORE_Z_TAG + z.length + ':' + json.length + ':' + _storeHash(z) + ':' + _storePack(z);
}

/**
 * The text to store for `json`: packed when that is shorter and reads back
 * exactly, otherwise `json` itself. Synchronous; `level` defaults to the fast
 * one, because the synchronous saves are the ones made as the tab hides or
 * closes, when there is no time to spare.
 */
function storeEncode(json, level) {
  if (typeof json !== 'string' || json.length < STORE_Z_MIN || typeof fflate === 'undefined' || typeof TextEncoder === 'undefined') return json;
  try {
    const z = fflate.deflateSync(new TextEncoder().encode(json), { level: level || STORE_Z_LEVEL_NOW });
    const packed = _storeWrap(z, json);
    if (packed.length >= json.length) return json;
    if (storeDecode(packed) !== json) {
      console.error('[store] compressed copy did not read back the same; saving it plain');
      return json;
    }
    return packed;
  } catch (e) {
    console.error('[store] could not compress; saving it plain', e);
    return json;
  }
}

/* ── Writing ──────────────────────────────────────────────
   Compressing a 2.4 MB library on the page costs about 55 ms, and four times
   that on a slow laptop -- after every change, which is the kind of stall the
   app had just been cleared of. So the ordinary save (the debounced one)
   compresses and checks it in fflate's background workers, and the page only
   packs the result and stores it.

   Every write to a key takes the next number for that key. A background
   write lands only if no write to the same key has started since, so an
   older save can never land on top of a newer one. The synchronous write
   (tab hiding or closing, or any caller that needs it stored now) takes a
   number too, which drops anything still in flight. */

const STORE_Z_LEVEL_NOW = 1;       // synchronous: about half the time of level 6, a little bigger
const STORE_Z_LEVEL_BG = 6;        // in the background: time is not the page's, so pack tighter
const _storeGen = Object.create(null);
let _storeInFlight = 0;

/** True while a background write has not landed yet. */
function storeBusy() { return _storeInFlight > 0; }

/** Store `json` under `key` now (compressed when worth it). Throws what setItem throws. */
function storeWriteSync(key, json) {
  _storeGen[key] = (_storeGen[key] || 0) + 1;
  localStorage.setItem(key, storeEncode(json));
}

function _storeSameBytes(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Store `json` under `key`, compressed and checked off the page. done(err)
 * runs once it is stored, or skipped because a newer write took over; err is
 * what setItem threw (a full quota). With no background workers it is the
 * synchronous write.
 *
 * opts.ifUnchanged: a re-store of what is already there (packing an old plain
 * save). It takes no number of its own, so it can never cancel a real save,
 * and it writes only if nothing has started since and the stored text is
 * still exactly `json`.
 */
function storeWriteAsync(key, json, done, opts) {
  const yieldToOthers = !!(opts && opts.ifUnchanged);
  const gen = yieldToOthers ? (_storeGen[key] || 0) : (_storeGen[key] = (_storeGen[key] || 0) + 1);
  let settled = false;
  const finish = (err) => { if (settled) return; settled = true; _storeInFlight--; if (done) done(err || null); };
  // `|| 0`: a key not written yet this session has no number at all, and
  // `undefined === 0` is false -- which made every re-store of an untouched
  // key think a newer write had overtaken it, and quietly skip.
  const current = () => (_storeGen[key] || 0) === gen;
  const put = (text) => {
    if (!current()) { finish(null); return; }
    try {
      if (yieldToOthers && localStorage.getItem(key) !== json) { finish(null); return; }
      localStorage.setItem(key, text);
      finish(null);
    } catch (e) { finish(e); }
  };
  _storeInFlight++;
  if (typeof json !== 'string' || json.length < STORE_Z_MIN || typeof fflate === 'undefined' ||
      typeof fflate.deflate !== 'function' || typeof Worker === 'undefined') {
    put(storeEncode(json));
    return;
  }
  let bytes;
  try { bytes = new TextEncoder().encode(json); } catch (e) { put(json); return; }
  const fallback = () => { if (current()) put(storeEncode(json)); else finish(null); };
  try {
    fflate.deflate(bytes, { level: STORE_Z_LEVEL_BG }, (err, z) => {
      if (!current()) { finish(null); return; }
      if (err || !z) { fallback(); return; }
      // Read it back in the background too, and compare byte for byte.
      fflate.inflate(z, (err2, back) => {
        if (!current()) { finish(null); return; }
        if (err2 || !_storeSameBytes(back, bytes)) {
          console.error('[store] compressed copy did not read back the same; saving it plain');
          put(json);
          return;
        }
        const packed = _storeWrap(z, json);
        put(packed.length < json.length ? packed : json);
      });
    });
  } catch (e) {
    fallback();
  }
}

/** localStorage.setItem(key, JSON.stringify(value)), compressed. Throws what setItem throws (a full quota). */
function storeSetJSON(key, value) {
  storeWriteSync(key, JSON.stringify(value));
}

/** The stored JSON text for `key`, unpacked; null when there is none. Throws on a damaged packed value. */
function storeGetText(key) {
  return storeDecode(localStorage.getItem(key));
}

/** Keep an unreadable save under <key>.corrupt.<time> before anything can overwrite it. */
function storeSetAside(key, raw) {
  if (!raw) return;
  try { localStorage.setItem(key + '.corrupt.' + new Date().toISOString().replace(/[:.]/g, '-'), raw); }
  catch (e) { console.error('[store] no room to keep a copy of the unreadable ' + key, e); }
}

/* Saves written before this are plain until something changes them. The big
   ones are packed once, shortly after start (or from "Compress now" in
   Settings), in the background: the same text re-stored, never re-built from
   the app's state -- so a save that would not parse is kept exactly as it
   was, and nothing is sent to the cloud. If the app saves the same key
   meanwhile, its newer write wins.

   ONLY WHEN EVERY READER OF THE KEY IS THIS VERSION. The first load after an
   update can be half old: index.html comes from the network, but the service
   worker still hands out its cached copies of the other scripts until the new
   worker takes over. This file and fflate are new, so they arrive fresh --
   and packing the library under an old state.js would leave the next load
   that is still old looking at a save it cannot read. Each reader declares
   itself (STATE_READS_PACKED and friends); a key is packed only when all of
   its readers have. */
const STORE_COMPACT_GROUPS = [
  { keys: ['codePlatformData', 'codePlatformData_online'],
    ready: () => typeof STATE_READS_PACKED !== 'undefined' && typeof FB_READS_PACKED !== 'undefined' },
  { keys: ['vizCanvasData', 'vizCanvasData_online'], ready: () => typeof VIZ_READS_PACKED !== 'undefined' },
  { keys: ['brainCanvasData', 'brainCanvasData_online'], ready: () => typeof BRAIN_READS_PACKED !== 'undefined' },
];

/** Saves that are big and still plain: { key, chars, ready } for each. */
function storeUnpackedSaves() {
  const out = [];
  STORE_COMPACT_GROUPS.forEach(g => g.keys.forEach(k => {
    let raw = null;
    try { raw = localStorage.getItem(k); } catch (e) { return; }
    if (raw && !storeIsPacked(raw) && raw.length >= STORE_Z_MIN) out.push({ key: k, chars: raw.length, ready: g.ready() });
  }));
  return out;
}

/** Pack every big plain save whose readers are all this version. Resolves once each has landed (or stood aside). */
function storeCompactExisting() {
  const jobs = storeUnpackedSaves().filter(u => u.ready).map(u => new Promise(resolve => {
    let raw = null;
    try { raw = localStorage.getItem(u.key); } catch (e) { resolve(); return; }
    if (!raw || storeIsPacked(raw)) { resolve(); return; }
    storeWriteAsync(u.key, raw, (err) => {
      const now = !err && localStorage.getItem(u.key);
      if (storeIsPacked(now)) console.log('[store] packed ' + u.key + ': ' + Math.round(raw.length / 1024) + ' KB -> ' + Math.round(now.length / 1024) + ' KB');
      resolve();
    }, { ifUnchanged: true });
  }));
  return Promise.all(jobs);
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(storeCompactExisting, { timeout: 5000 });
    else storeCompactExisting();
  }, 4000);
});
