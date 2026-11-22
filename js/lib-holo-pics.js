/* ============================================================
   LIB-HOLO-PICS.JS — your own pictures as the Library cards' holograms

   Settings > Card Characters (js/lib-holo-studio.js) lets each Library hub
   card project a picture you upload -- a GIF, PNG, WebP or JPG -- instead of
   its drawn scene (js/lib-holo.js). The file is kept exactly as uploaded in
   the picture store (js/media-store.js); what is saved is a reference to it
   and a small settings object per card, in localStorage `ssp.libHoloPics`:

     { v: 1, cards: { <sceneKey>: Pic } }     sceneKey = the card's data-scene

   A Pic says how to show the file: crop, background removal (optional --
   an already cut-out picture needs none), outline and glow, size and place
   in the hologram box, tint, scanlines, opacity and speed (lhpDefaults).

   HOW IT IS DRAWN. Frames are decoded (ImageDecoder where the browser has
   it, else this file's own GIF decoder, else one still), and each frame
   goes crop -> background removal -> scale to the box -> tint -> outline,
   into an ImageBitmap. They play on a <canvas> inside the hologram's usual
   beam and floor, only while the card is hovered. Nothing is decoded until
   the Library is on screen (first frames, in idle time) or a card is hovered
   (the whole animation); prepared cards are dropped least-recently-used
   first past LHP_BUDGET bytes, and all of them when the Library goes.

   The top half of this file is pure (no DOM): the settings, colour maths,
   background removal, auto-crop bounds, the outline, placement, and the GIF
   decoder. node tools/test-lib-holo-pics.js tests it after any change.
   ============================================================ */

const LHP_KEY = 'ssp.libHoloPics';
const LHP_BOX_W = 200;
const LHP_BOX_H = 150;
const LHP_FLOOR_Y = 146;          // where a picture's feet stand: on the floor disc
const LHP_FIT_W = 184;            // the most of the box a picture may fill at size 1
const LHP_FIT_H = 138;
const LHP_MAX_BYTES = 15e6;
const LHP_MAX_FRAMES = 400;
const LHP_NO_PIC = new Set(['placeholder']);   // "nothing here yet": no picture

/* ── Settings ─────────────────────────────────────────────── */

function lhpDefaults() {
  return {
    src: '', name: '', type: '', w: 0, h: 0, frames: 1, ms: 0,
    crop: null,
    bg: { on: false, color: 'auto', tol: 12, soft: 8, edges: true },
    outline: { on: false, color: 'card', width: 2, glow: 0 },
    fit: { scale: 1, dx: 0, dy: 0, flip: false },
    look: { tint: 25, scan: true, opacity: 100, speed: 1 },
    at: 0
  };
}

function _lhpNum(v, lo, hi, dflt) {
  const n = Number(v);
  if (v === null || v === '' || typeof v === 'boolean' || !isFinite(n)) return dflt;
  return Math.min(hi, Math.max(lo, n));
}
function _lhpHex(v, dflt, word) {
  if (v === word) return word;
  return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : dflt;
}

/** One card's picture with every value in range, or null when it cannot be shown. */
function lhpNormalizePic(p) {
  if (!p || typeof p !== 'object') return null;
  const src = typeof p.src === 'string' ? p.src : '';
  if (src.lastIndexOf('media:', 0) !== 0 && src.lastIndexOf('data:image/', 0) !== 0) return null;
  const d = lhpDefaults();
  const bg = p.bg || {}, ol = p.outline || {}, fit = p.fit || {}, look = p.look || {};
  const out = {
    src,
    name: typeof p.name === 'string' ? p.name.slice(0, 120) : '',
    type: typeof p.type === 'string' ? p.type.slice(0, 40) : '',
    w: Math.round(_lhpNum(p.w, 0, 65535, 0)),
    h: Math.round(_lhpNum(p.h, 0, 65535, 0)),
    frames: Math.round(_lhpNum(p.frames, 1, LHP_MAX_FRAMES, 1)),
    ms: Math.round(_lhpNum(p.ms, 0, 36e5, 0)),
    crop: null,
    bg: {
      on: !!bg.on,
      color: _lhpHex(bg.color, 'auto', 'auto'),
      tol: _lhpNum(bg.tol, 0, 100, d.bg.tol),
      soft: _lhpNum(bg.soft, 0, 100, d.bg.soft),
      edges: bg.edges === undefined ? true : !!bg.edges
    },
    outline: {
      on: !!ol.on,
      color: _lhpHex(ol.color, 'card', 'card'),
      width: _lhpNum(ol.width, 0, 8, d.outline.width),
      glow: _lhpNum(ol.glow, 0, 12, d.outline.glow)
    },
    fit: {
      scale: _lhpNum(fit.scale, 0.5, 1.6, 1),
      dx: _lhpNum(fit.dx, -100, 100, 0),
      dy: _lhpNum(fit.dy, -75, 75, 0),
      flip: !!fit.flip
    },
    look: {
      tint: _lhpNum(look.tint, 0, 100, d.look.tint),
      scan: look.scan === undefined ? true : !!look.scan,
      opacity: _lhpNum(look.opacity, 40, 100, 100),
      speed: _lhpNum(look.speed, 0.25, 2, 1)
    },
    at: Math.round(_lhpNum(p.at, 0, 1e15, 0))
  };
  const c = p.crop;
  if (c && typeof c === 'object' && isFinite(c.w) && isFinite(c.h) && c.w >= 1 && c.h >= 1) {
    const maxW = out.w || 65535, maxH = out.h || 65535;
    const x = Math.round(_lhpNum(c.x, 0, maxW - 1, 0));
    const y = Math.round(_lhpNum(c.y, 0, maxH - 1, 0));
    out.crop = { x, y, w: Math.round(Math.min(c.w, maxW - x)), h: Math.round(Math.min(c.h, maxH - y)) };
  }
  return out;
}

/** The whole saved store, cleaned: unknown or broken entries are dropped, never thrown on. */
function lhpNormalize(raw) {
  const out = { v: 1, cards: {} };
  const cards = raw && typeof raw === 'object' && raw.cards && typeof raw.cards === 'object' ? raw.cards : {};
  Object.keys(cards).forEach(k => {
    if (!/^[a-z][a-z0-9-]{0,30}$/.test(k) || LHP_NO_PIC.has(k)) return;
    const p = lhpNormalizePic(cards[k]);
    if (p) out.cards[k] = p;
  });
  return out;
}

/* ── Colours ──────────────────────────────────────────────── */

function lhpHexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lhpRgbToHex(rgb) {
  return '#' + rgb.slice(0, 3).map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

/** How far apart two colours are, 0 (same) to 100 (black and white). */
function lhpDist(r, g, b, r2, g2, b2) {
  const dr = r - r2, dg = g - g2, db = b - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db) / 4.41673;
}

/* ── Background ───────────────────────────────────────────── */

/**
 * What the picture's background probably is: the commonest colour on its
 * border (rgb/hex, null when the border is see-through), whether that border
 * is one flat colour (70% of it close to that colour), and whether the
 * picture has any transparency at all.
 */
function lhpGuessBg(img) {
  const { data, width: w, height: h } = img;
  let transparent = false;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 250) { transparent = true; break; }
  const counts = new Map();
  const border = [];
  let all = 0;
  const take = (x, y) => {
    all++;
    const i = (y * w + x) * 4;
    if (data[i + 3] < 128) return;
    border.push(i);
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    counts.set(key, (counts.get(key) || 0) + 1);
  };
  for (let x = 0; x < w; x++) { take(x, 0); if (h > 1) take(x, h - 1); }
  for (let y = 1; y < h - 1; y++) { take(0, y); if (w > 1) take(w - 1, y); }
  if (!border.length) return { rgb: null, hex: null, flat: false, transparent };
  let best = -1, bestN = -1;
  counts.forEach((n, k) => { if (n > bestN) { best = k; bestN = n; } });
  let r = 0, g = 0, b = 0, n = 0;
  border.forEach(i => {
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    if (key === best) { r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
  });
  const rgb = [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
  let near = 0;
  border.forEach(i => { if (lhpDist(data[i], data[i + 1], data[i + 2], rgb[0], rgb[1], rgb[2]) <= 10) near++; });
  return { rgb, hex: lhpRgbToHex(rgb), flat: near / Math.max(1, all) >= 0.7, transparent };
}

/**
 * Background removal, in place. Within `tol` of the colour: see-through;
 * within `tol + soft`: partly (a soft edge). With `edges`, only pixels joined
 * to the picture's border are removed, so the same colour inside the
 * character (the whites of its eyes) stays.
 */
function lhpKey(img, o) {
  const { data, width: w, height: h } = img;
  const [kr, kg, kb] = o.rgb;
  const tol = Math.max(0, +o.tol || 0), soft = Math.max(0, +o.soft || 0);
  const lim = tol + soft;
  const n = w * h;
  const near = (p) => {
    const i = p * 4;
    return data[i + 3] === 0 || lhpDist(data[i], data[i + 1], data[i + 2], kr, kg, kb) <= lim;
  };
  const apply = (p) => {
    const i = p * 4;
    if (data[i + 3] === 0) return;
    const d = lhpDist(data[i], data[i + 1], data[i + 2], kr, kg, kb);
    if (d <= tol) data[i + 3] = 0;
    else if (d < lim) data[i + 3] = Math.round(data[i + 3] * (d - tol) / soft);
  };
  if (!o.edges) {
    for (let p = 0; p < n; p++) apply(p);
    return img;
  }
  const seen = new Uint8Array(n);
  const queue = new Int32Array(n);
  let head = 0, tail = 0;
  const push = (p) => { if (!seen[p] && near(p)) { seen[p] = 1; queue[tail++] = p; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (head < tail) {
    const p = queue[head++];
    const x = p % w;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (p >= w) push(p - w);
    if (p < n - w) push(p + w);
  }
  for (let i = 0; i < tail; i++) apply(queue[i]);
  return img;
}

/* ── Auto-crop ────────────────────────────────────────────── */

/**
 * The box round everything visible in any of the frames, or null when there
 * is nothing to crop to: no pixel is see-through anywhere (the picture is
 * its own rectangle), or nothing is visible at all.
 */
function lhpBounds(imgs, alphaMin) {
  const acc = lhpBoundsAcc(alphaMin);
  imgs.forEach(acc.add);
  return acc.result();
}

/** lhpBounds one frame at a time: add(img) each frame, then result(). */
function lhpBoundsAcc(alphaMin) {
  const amin = alphaMin === undefined ? 16 : alphaMin;
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1, anyClear = false;
  return {
    add(im) {
      const { data, width: w, height: h } = im;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (data[(y * w + x) * 4 + 3] < amin) { anyClear = true; continue; }
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    },
    result() {
      if (!anyClear || x1 < 0) return null;
      return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    }
  };
}

/** `box` grown by `pct`% of its larger side, inside a w x h picture. */
function lhpPadBox(box, w, h, pct) {
  const p = Math.round(Math.max(box.w, box.h) * pct / 100);
  const x = Math.max(0, box.x - p), y = Math.max(0, box.y - p);
  return { x, y, w: Math.min(w, box.x + box.w + p) - x, h: Math.min(h, box.y + box.h + p) - y };
}

/* ── Outline ──────────────────────────────────────────────── */

/**
 * A layer the size of `img`, in `rgb`, covering everything within `width` px
 * of the picture's solid pixels (alpha >= 128), soft at its outer edge. It is
 * drawn under the picture. Chamfer distance: two passes, any width, same cost.
 */
function lhpOutline(img, width, rgb) {
  const { data, width: w, height: h } = img;
  const n = w * h;
  const BIG = 1e9, D = Math.SQRT2;
  const dist = new Float32Array(n);
  for (let p = 0; p < n; p++) dist[p] = data[p * 4 + 3] >= 128 ? 0 : BIG;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      let d = dist[p];
      if (x > 0 && dist[p - 1] + 1 < d) d = dist[p - 1] + 1;
      if (y > 0) {
        if (dist[p - w] + 1 < d) d = dist[p - w] + 1;
        if (x > 0 && dist[p - w - 1] + D < d) d = dist[p - w - 1] + D;
        if (x < w - 1 && dist[p - w + 1] + D < d) d = dist[p - w + 1] + D;
      }
      dist[p] = d;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const p = y * w + x;
      let d = dist[p];
      if (x < w - 1 && dist[p + 1] + 1 < d) d = dist[p + 1] + 1;
      if (y < h - 1) {
        if (dist[p + w] + 1 < d) d = dist[p + w] + 1;
        if (x < w - 1 && dist[p + w + 1] + D < d) d = dist[p + w + 1] + D;
        if (x > 0 && dist[p + w - 1] + D < d) d = dist[p + w - 1] + D;
      }
      dist[p] = d;
    }
  }
  const out = new Uint8ClampedArray(n * 4);
  for (let p = 0; p < n; p++) {
    const a = Math.max(0, Math.min(1, width + 0.5 - dist[p]));
    if (!a) continue;
    out[p * 4] = rgb[0]; out[p * 4 + 1] = rgb[1]; out[p * 4 + 2] = rgb[2]; out[p * 4 + 3] = Math.round(a * 255);
  }
  return { data: out, width: w, height: h };
}

/* ── Placement ────────────────────────────────────────────── */

/**
 * Where a cw x ch picture goes in the 200 x 150 hologram box: as large as
 * fits LHP_FIT_W x LHP_FIT_H, standing on the floor disc, centred, then
 * scaled and nudged. (Flipping is the player's: it mirrors in place.)
 */
function lhpFit(cw, ch, fit) {
  const f = fit || {};
  const s = Math.min(LHP_FIT_W / cw, LHP_FIT_H / ch) * (f.scale || 1);
  const w = Math.round(cw * s * 100) / 100, h = Math.round(ch * s * 100) / 100;
  return { x: (LHP_BOX_W - w) / 2 + (f.dx || 0), y: LHP_FLOOR_Y - h + (f.dy || 0), w, h };
}

/* ── GIF decoding ─────────────────────────────────────────── */

/* For browsers without ImageDecoder. lhpGifReader(bytes) reads the header at
   once (width, height) and then hands over one frame per next() --
   { rgba, delay, index }, or null at the end -- composited as a browser shows
   it (disposal 2 clears the frame's area, 3 puts back what was under it).
   `rgba` is one buffer reused for every frame: copy it to keep it. Throws on
   anything that is not a whole GIF. */
function lhpGifReader(bytes) {
  const b = bytes;
  let pos = 0;
  const need = (k) => { if (pos + k > b.length) throw new Error('This GIF is cut short.'); };
  const u8 = () => { need(1); return b[pos++]; };
  const u16 = () => { need(2); const v = b[pos] | (b[pos + 1] << 8); pos += 2; return v; };
  const table = (size) => { need(size * 3); const t = b.subarray(pos, pos + size * 3); pos += size * 3; return t; };
  const subBlocks = () => {
    const parts = [];
    let total = 0;
    for (;;) {
      const len = u8();
      if (!len) break;
      need(len);
      parts.push(b.subarray(pos, pos + len));
      total += len;
      pos += len;
    }
    const out = new Uint8Array(total);
    let o = 0;
    parts.forEach(q => { out.set(q, o); o += q.length; });
    return out;
  };

  need(13);
  if (String.fromCharCode(b[0], b[1], b[2], b[3]) !== 'GIF8') throw new Error('Not a GIF.');
  pos = 6;
  const W = u16(), H = u16();
  const flags = u8();
  u8(); u8();   // background index, aspect: browsers clear to transparent
  if (!W || !H) throw new Error('This GIF has no size.');
  const gct = flags & 0x80 ? table(1 << ((flags & 7) + 1)) : null;
  const canvas = new Uint8ClampedArray(W * H * 4);
  let saved = null, lastRect = null, lastDisposal = 0, count = 0, done = false;

  function next() {
    if (done) return null;
    let delay = 0, disposal = 0, trans = -1;
    for (;;) {
      const block = u8();
      if (block === 0x3B) { done = true; return null; }
      if (block === 0x21) {
        const label = u8();
        if (label === 0xF9) {
          const body = subBlocks();
          if (body.length >= 4) {
            disposal = (body[0] >> 2) & 7;
            trans = body[0] & 1 ? body[3] : -1;
            delay = (body[1] | (body[2] << 8)) * 10;
          }
        } else {
          subBlocks();
        }
        continue;
      }
      if (block !== 0x2C) throw new Error('This GIF is damaged.');
      break;
    }
    const fx = u16(), fy = u16(), fw = u16(), fh = u16();
    const iflags = u8();
    const lct = iflags & 0x80 ? table(1 << ((iflags & 7) + 1)) : null;
    const pal = lct || gct;
    const minSize = u8();
    const data = subBlocks();
    if (!pal) throw new Error('This GIF has no colours.');

    // What the frame before asked to be done once it had been seen.
    if (lastDisposal === 2 && lastRect) _lhpClearRect(canvas, W, H, lastRect);
    else if (lastDisposal === 3 && saved) canvas.set(saved);
    if (disposal === 3) saved = canvas.slice();

    const idx = _lhpLzw(data, minSize, fw * fh);
    const rows = iflags & 0x40 ? _lhpInterlaceRows(fh) : null;
    for (let r = 0; r < fh; r++) {
      const y = fy + (rows ? rows[r] : r);
      if (y >= H) continue;
      for (let x = 0; x < fw; x++) {
        const cx = fx + x;
        if (cx >= W) continue;
        const ci = idx[r * fw + x];
        if (ci === trans || ci * 3 + 2 >= pal.length) continue;
        const o = (y * W + cx) * 4;
        canvas[o] = pal[ci * 3]; canvas[o + 1] = pal[ci * 3 + 1]; canvas[o + 2] = pal[ci * 3 + 2]; canvas[o + 3] = 255;
      }
    }
    lastRect = { x: fx, y: fy, w: fw, h: fh };
    lastDisposal = disposal;
    return { rgba: canvas, delay: delay < 20 ? 100 : delay, index: count++ };
  }
  return { width: W, height: H, next };
}

/** Every frame of a GIF through fn(rgba, delayMs, index), up to maxFrames. */
function lhpGifEach(bytes, fn, maxFrames) {
  const rd = lhpGifReader(bytes);
  const max = maxFrames || Infinity;
  let count = 0, f;
  while (count < max && (f = rd.next())) { fn(f.rgba, f.delay, f.index); count++; }
  if (!count) throw new Error('This GIF has no frames.');
  return { width: rd.width, height: rd.height, count };
}

function _lhpClearRect(buf, W, H, r) {
  for (let y = r.y; y < Math.min(H, r.y + r.h); y++) {
    buf.fill(0, (y * W + r.x) * 4, (y * W + Math.min(W, r.x + r.w)) * 4);
  }
}

/** Row r of an interlaced image is which row on screen. */
function _lhpInterlaceRows(h) {
  const rows = [];
  [[0, 8], [4, 8], [2, 4], [1, 2]].forEach(([start, step]) => { for (let y = start; y < h; y += step) rows.push(y); });
  return rows;
}

/** GIF's LZW: `count` colour indices from the joined data sub-blocks. */
function _lhpLzw(data, minSize, count) {
  const out = new Uint8Array(count);
  if (minSize < 1 || minSize > 11) throw new Error('This GIF is damaged.');
  const clear = 1 << minSize, eoi = clear + 1;
  const prefix = new Int16Array(4096), suffix = new Uint8Array(4096), first = new Uint8Array(4096);
  const stack = new Uint8Array(4097);
  for (let i = 0; i < clear; i++) { prefix[i] = -1; suffix[i] = i; first[i] = i; }
  let size = minSize + 1, next = eoi + 1, old = -1;
  let acc = 0, bits = 0, pos = 0, o = 0;
  while (o < count) {
    while (bits < size) {
      if (pos >= data.length) return out;   // short data: the rest stays index 0, as browsers draw it
      acc |= data[pos++] << bits;
      bits += 8;
    }
    const code = acc & ((1 << size) - 1);
    acc >>>= size;
    bits -= size;
    if (code === clear) { size = minSize + 1; next = eoi + 1; old = -1; continue; }
    if (code === eoi) break;
    if (old === -1) {
      if (code >= clear) throw new Error('This GIF is damaged.');
      out[o++] = code;
      old = code;
      continue;
    }
    let c = code, sp = 0;
    if (code > next) throw new Error('This GIF is damaged.');
    if (code === next) { stack[sp++] = first[old]; c = old; }
    while (c >= clear) { stack[sp++] = suffix[c]; c = prefix[c]; }
    stack[sp++] = c;
    const head = c;
    while (sp && o < count) out[o++] = stack[--sp];
    if (next < 4096) {
      prefix[next] = old;
      suffix[next] = head;
      first[next] = first[old];
      next++;
      if (next === (1 << size) && size < 12) size++;
    }
    old = code;
  }
  return out;
}

/* ============================================================
   RUNTIME: preparing frames, playing them, and the cards
   ============================================================ */

const LHP_CARD_BYTES = 64 * 1024 * 1024;   // one card's frames
const LHP_BUDGET = 160 * 1024 * 1024;      // every prepared card together
const LHP_WORK_PX = 1.5e6;                 // a crop bigger than this is scaled down before background removal
const _LHP_STALE = { lhpStale: true };     // thrown when a newer request replaced this one

/** The outline and glow's margin round the picture, in box px. */
function _lhpPad(pic) {
  return pic.outline.on && pic.outline.width > 0 ? Math.ceil(pic.outline.width + pic.outline.glow * 1.5) + 1 : 0;
}

/**
 * How sharp, and how many frames, a card can keep inside LHP_CARD_BYTES:
 * { dpr, every }. Full sharpness first; else 1x; else every Nth frame.
 */
function lhpBudget(frames, cw, ch, pic, dprWanted) {
  const fit = lhpFit(cw, ch, { scale: pic.fit.scale });
  const pad = _lhpPad(pic);
  const bytes = (d) => (Math.round(fit.w * d) + 2 * Math.ceil(pad * d)) *
    (Math.round(fit.h * d) + 2 * Math.ceil(pad * d)) * 4 * frames;
  if (bytes(dprWanted) <= LHP_CARD_BYTES) return { dpr: dprWanted, every: 1 };
  if (bytes(1) <= LHP_CARD_BYTES) return { dpr: 1, every: 1 };
  return { dpr: 1, every: Math.ceil(bytes(1) / LHP_CARD_BYTES) };
}

/** Which prepared cards to drop to get under `budget`: least recently used first, never `keep`. */
function lhpEvictKeys(entries, budget, keep) {
  let total = 0;
  entries.forEach(e => { total += e.bytes || 0; });
  const out = [];
  for (const [k, e] of entries) {
    if (total <= budget) break;
    if (k === keep) continue;
    out.push(k);
    total -= e.bytes || 0;
  }
  return out;
}

/** What a prepared set of frames depends on. Nudge, flip, opacity and speed are the player's. */
function lhpSig(pic, rgb, dpr) {
  return JSON.stringify([pic.src, pic.crop, pic.bg, pic.outline, pic.fit.scale, pic.look.tint, rgb, dpr]);
}

/** Where a prepared frame (with its outline margin) is drawn in the box, and the centre it flips about. */
function lhpDrawRect(prep, pic) {
  const f = lhpFit(prep.cw, prep.ch, pic.fit);
  return { x: f.x - prep.pad, y: f.y - prep.pad, w: f.w + 2 * prep.pad, h: f.h + 2 * prep.pad, cx: f.x + f.w / 2 };
}

/* ── The saved store ──────────────────────────────────────── */

let _lhpRaw = null;
let _lhpVal = null;
const _lhpBroken = new Set();   // pictures not on this device (yet): their cards show the drawn scene

function _lhpStoreRO() {
  let raw = null;
  try { raw = localStorage.getItem(LHP_KEY); } catch (e) { raw = null; }
  if (raw !== _lhpRaw || !_lhpVal) {
    let parsed = null;
    try { parsed = raw ? JSON.parse(raw) : null; } catch (e) { parsed = null; }
    _lhpRaw = raw;
    _lhpVal = lhpNormalize(parsed);
  }
  return _lhpVal;
}

/** A copy of the saved store, safe to change. */
function lhpStore() { return JSON.parse(JSON.stringify(_lhpStoreRO())); }

/** Saves the store (cleaned) and refreshes the cards. Throws when storage is full. */
function lhpSaveStore(store) {
  const clean = lhpNormalize(store);
  localStorage.setItem(LHP_KEY, JSON.stringify(clean));
  lhpRefreshCards();
  return clean;
}

/** The picture a card projects, or null for its drawn scene. */
function lhpFor(key) {
  if (LHP_NO_PIC.has(key)) return null;
  const p = _lhpStoreRO().cards[key];
  return p && !_lhpBroken.has(p.src) ? p : null;
}

function lhpCount() { return Object.keys(_lhpStoreRO().cards).length; }

/* ── Reading the file ─────────────────────────────────────── */

const _lhpYield = () => new Promise(r => setTimeout(r, 0));

/** The stored file behind a picture value. */
async function lhpBlobOf(src) {
  if (src.lastIndexOf('data:', 0) === 0) return _mdDataUrlToBlob(src);
  if (typeof mediaReady === 'function') await mediaReady();
  if (typeof _mdIdb === 'function') {
    const rec = await _mdIdb('readonly', st => st.get(src.slice(MEDIA_PREFIX.length)));
    if (rec && rec.blob) return rec.blob;
  }
  throw new Error('This picture is not on this device yet.');
}

function _lhpCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
function _lhpCtx(c) { return c.getContext('2d', { willReadFrequently: true }); }

/**
 * Every frame of a picture file through `await fn(imageData, delayMs, index)`:
 * ImageDecoder where the browser has one for the type (GIF, animated WebP and
 * PNG), else this file's GIF reader, else the picture as one still.
 * opts: { max, every } -- stop after `max` frames; hand over only every Nth
 * (its delay multiplied to match). Resolves to { width, height, count, ms }.
 */
async function lhpDecodeEach(blob, fn, opts) {
  const o = opts || {};
  const max = Math.min(o.max || LHP_MAX_FRAMES, LHP_MAX_FRAMES);
  const every = Math.max(1, o.every || 1);
  const type = blob.type || '';
  let supported = false;
  if (typeof ImageDecoder !== 'undefined' && type) {
    try { supported = await ImageDecoder.isTypeSupported(type); } catch (e) { supported = false; }
  }
  if (supported) return _lhpDecodeWith(blob, type, fn, max, every);

  const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
  if (/gif/i.test(type) || (head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46)) {
    const rd = lhpGifReader(new Uint8Array(await blob.arrayBuffer()));
    let f, n = 0, ms = 0, held = null;
    // One frame is held back: a GIF with a single frame has no delay at all.
    while (n < max && (f = rd.next())) {
      ms += f.delay;
      if (n % every === 0) {
        if (held) await fn(new ImageData(held.data, rd.width, rd.height), held.delay, held.index);
        held = { data: new Uint8ClampedArray(f.rgba), delay: f.delay * every, index: f.index };
      }
      n++;
    }
    if (!n) throw new Error('This GIF has no frames.');
    if (held) await fn(new ImageData(held.data, rd.width, rd.height), n > 1 ? held.delay : 0, held.index);
    return { width: rd.width, height: rd.height, count: n, ms: n > 1 ? ms : 0 };
  }

  const bmp = await createImageBitmap(blob);
  const c = _lhpCanvas(bmp.width, bmp.height);
  const x = _lhpCtx(c);
  x.drawImage(bmp, 0, 0);
  if (bmp.close) bmp.close();
  await fn(x.getImageData(0, 0, c.width, c.height), 0, 0);
  return { width: c.width, height: c.height, count: 1, ms: 0 };
}

async function _lhpDecodeWith(blob, type, fn, max, every) {
  const dec = new ImageDecoder({ data: await blob.arrayBuffer(), type });
  try {
    await dec.tracks.ready;
    try { await dec.completed; } catch (e) { /* the frames read so far still count */ }
    const track = dec.tracks.selectedTrack;
    const n = Math.max(1, Math.min(track ? track.frameCount : 1, max));
    let W = 0, H = 0, ms = 0, c = null, x = null;
    for (let i = 0; i < n; i++) {
      const { image } = await dec.decode({ frameIndex: i });
      const raw = image.duration ? image.duration / 1000 : 0;
      const delay = n > 1 ? (raw < 20 ? 100 : raw) : 0;
      ms += delay;
      if (i % every) { image.close(); continue; }
      W = image.displayWidth;
      H = image.displayHeight;
      if (!c || c.width !== W || c.height !== H) { c = _lhpCanvas(W, H); x = _lhpCtx(c); }
      x.clearRect(0, 0, W, H);
      x.drawImage(image, 0, 0);
      image.close();
      await fn(x.getImageData(0, 0, W, H), delay * every, i);
    }
    return { width: W, height: H, count: n, ms };
  } finally {
    dec.close();
  }
}

/* ── Preparing frames ─────────────────────────────────────── */

function _lhpCropOf(pic, W, H) {
  const c = pic.crop;
  if (!c) return { x: 0, y: 0, w: W, h: H };
  const x = Math.min(c.x, W - 1), y = Math.min(c.y, H - 1);
  return { x, y, w: Math.max(1, Math.min(c.w, W - x)), h: Math.max(1, Math.min(c.h, H - y)) };
}

/** The crop of `im` as its own ImageData, scaled by k (< 1 for a huge crop). */
function _lhpCut(im, c, k) {
  if (k === 1) {
    if (c.x === 0 && c.y === 0 && c.w === im.width && c.h === im.height) return im;
    const out = new ImageData(c.w, c.h);
    for (let y = 0; y < c.h; y++) {
      const from = ((c.y + y) * im.width + c.x) * 4;
      out.data.set(im.data.subarray(from, from + c.w * 4), y * c.w * 4);
    }
    return out;
  }
  const full = _lhpCanvas(im.width, im.height);
  _lhpCtx(full).putImageData(im, 0, 0);
  const ww = Math.max(1, Math.round(c.w * k)), wh = Math.max(1, Math.round(c.h * k));
  const work = _lhpCanvas(ww, wh);
  const wx = _lhpCtx(work);
  wx.imageSmoothingQuality = 'high';
  wx.drawImage(full, c.x, c.y, c.w, c.h, 0, 0, ww, wh);
  return wx.getImageData(0, 0, ww, wh);
}

/**
 * The picture's frames, ready to draw: crop -> background removal -> scaled
 * into the box -> tint (the card's colour `rgb`) -> outline and glow, each an
 * ImageBitmap. opts: { stillOnly, dpr, onFirst(prep), isStale() }.
 * Resolves to { frames: [{ bmp, delay }], cw, ch, pad, dpr, bytes }.
 */
async function lhpPrepare(pic, rgb, opts) {
  const o = opts || {};
  const want = o.dpr || Math.min(2, Math.max(1, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1));
  const blob = await lhpBlobOf(pic.src);
  let plan = { dpr: want, every: 1 };
  if (!o.stillOnly && pic.w && pic.h) {
    const c0 = _lhpCropOf(pic, pic.w, pic.h);
    plan = lhpBudget(pic.frames || 1, c0.w, c0.h, pic, want);
  }
  const dpr = plan.dpr;
  const prep = { frames: [], cw: 1, ch: 1, pad: _lhpPad(pic), dpr, bytes: 0 };
  const padPx = Math.ceil(prep.pad * dpr);
  const olRgb = pic.outline.color === 'card' ? rgb : (lhpHexToRgb(pic.outline.color) || rgb);
  let keyRgb = pic.bg.on && pic.bg.color !== 'auto' ? lhpHexToRgb(pic.bg.color) : null;

  await lhpDecodeEach(blob, async (im, delay) => {
    if (o.isStale && o.isStale()) throw _LHP_STALE;
    const c = _lhpCropOf(pic, im.width, im.height);
    if (pic.bg.on && !keyRgb) keyRgb = lhpGuessBg(im).rgb || [255, 255, 255];
    const k = Math.min(1, Math.sqrt(LHP_WORK_PX / (c.w * c.h)));
    const cut = _lhpCut(im, c, k);
    if (pic.bg.on) lhpKey(cut, { rgb: keyRgb, tol: pic.bg.tol, soft: pic.bg.soft, edges: pic.bg.edges });
    prep.cw = c.w;
    prep.ch = c.h;

    const fit = lhpFit(c.w, c.h, { scale: pic.fit.scale });
    const tw = Math.max(1, Math.round(fit.w * dpr)), th = Math.max(1, Math.round(fit.h * dpr));
    const src = _lhpCanvas(cut.width, cut.height);
    _lhpCtx(src).putImageData(cut, 0, 0);
    const out = _lhpCanvas(tw + 2 * padPx, th + 2 * padPx);
    const ox = _lhpCtx(out);
    ox.imageSmoothingQuality = 'high';
    ox.drawImage(src, padPx, padPx, tw, th);
    if (pic.look.tint > 0) {
      ox.globalCompositeOperation = 'source-atop';
      ox.fillStyle = 'rgba(' + rgb.join(',') + ',' + (pic.look.tint / 100 * 0.55) + ')';
      ox.fillRect(0, 0, out.width, out.height);
      ox.globalCompositeOperation = 'source-over';
    }
    let fin = out;
    if (pic.outline.on && pic.outline.width > 0) {
      const layer = lhpOutline(ox.getImageData(0, 0, out.width, out.height), pic.outline.width * dpr, olRgb);
      const lc = _lhpCanvas(out.width, out.height);
      _lhpCtx(lc).putImageData(new ImageData(layer.data, layer.width, layer.height), 0, 0);
      fin = _lhpCanvas(out.width, out.height);
      const fx = _lhpCtx(fin);
      if (pic.outline.glow > 0) {
        fx.shadowColor = 'rgba(' + olRgb.join(',') + ',0.95)';
        fx.shadowBlur = pic.outline.glow * dpr * 1.5;
      }
      fx.drawImage(lc, 0, 0);
      fx.shadowBlur = 0;
      fx.shadowColor = 'transparent';
      fx.drawImage(out, 0, 0);
    }
    const bmp = typeof createImageBitmap === 'function' ? await createImageBitmap(fin) : fin;
    prep.frames.push({ bmp, delay });
    prep.bytes += fin.width * fin.height * 4;
    if (prep.frames.length === 1 && o.onFirst) o.onFirst(prep);
    await _lhpYield();
  }, { max: o.stillOnly ? 1 : LHP_MAX_FRAMES, every: plan.every });
  if (o.isStale && o.isStale()) { _lhpFree(prep); throw _LHP_STALE; }
  return prep;
}

function _lhpFree(prep) {
  if (prep) prep.frames.forEach(f => { if (f.bmp && f.bmp.close) f.bmp.close(); });
}

/* ── Playing ──────────────────────────────────────────────── */

/** Draws prepared frames on a 200 x 150 canvas; plays them on their own delays / speed. */
function lhpPlayer(canvas) {
  const g = canvas.getContext('2d');
  let prep = null, pic = null, i = 0, timer = 0, speed = 1, on = false;
  const draw = () => {
    const d = prep ? prep.dpr : 1;
    const w = Math.round(LHP_BOX_W * d), h = Math.round(LHP_BOX_H * d);
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    g.clearRect(0, 0, w, h);
    if (!prep || !pic || !prep.frames.length) return;
    const f = prep.frames[Math.min(i, prep.frames.length - 1)];
    const r = lhpDrawRect(prep, pic);
    g.save();
    if (pic.fit.flip) { g.translate(2 * r.cx * d, 0); g.scale(-1, 1); }
    try { g.drawImage(f.bmp, Math.round(r.x * d), Math.round(r.y * d)); } catch (e) { /* a frame released meanwhile */ }
    g.restore();
    canvas.style.opacity = String(pic.look.opacity / 100);
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = 0;
    if (!on || !prep || prep.frames.length < 2) return;
    timer = setTimeout(() => {
      timer = 0;
      if (!on || !prep) return;
      i = (i + 1) % prep.frames.length;
      draw();
      schedule();
    }, Math.max(16, prep.frames[i].delay / speed));
  };
  return {
    canvas,
    show(p, pc) {
      prep = p;
      pic = pc || pic;
      if (!prep || i >= prep.frames.length) i = 0;
      draw();
      if (on) schedule();
    },
    play(s) { speed = s || (pic ? pic.look.speed : 1); on = true; schedule(); },
    stop() { on = false; clearTimeout(timer); timer = 0; },
    seek(n) { i = Math.max(0, Math.min(n, (prep ? prep.frames.length : 1) - 1)); draw(); if (on) schedule(); },
    index() { return i; },
    frameCount() { return prep ? prep.frames.length : 0; },
    isPlaying() { return on; },
    destroy() { on = false; clearTimeout(timer); prep = null; pic = null; }
  };
}

/* ── The cards ────────────────────────────────────────────── */

const _lhpCache = new Map();   // card key -> { sig, full, prep, bytes, promise, dead }
const _lhpRgbMemo = new Map();

function _lhpDrop(key) {
  const e = _lhpCache.get(key);
  if (!e) return;
  _lhpCache.delete(key);
  e.dead = true;
  _lhpFree(e.prep);
}

/** A card's prepared frames: from the cache when still right, else prepared (the still first, if asked). */
function _lhpWant(key, pic, rgb, full, onFirst) {
  const dpr = Math.min(2, Math.max(1, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1));
  const sig = lhpSig(pic, rgb, dpr);
  const e = _lhpCache.get(key);
  if (e && e.sig === sig && (e.full || !full)) {
    _lhpCache.delete(key);
    _lhpCache.set(key, e);
    return e;
  }
  // The still of the same picture keeps showing until the animation is ready.
  const still = e && e.sig === sig && e.prep ? e.prep : null;
  if (e) {
    _lhpCache.delete(key);
    e.dead = true;
    if (e.prep !== still) _lhpFree(e.prep);
  }
  const ne = { sig, full, prep: still, bytes: still ? still.bytes : 0, dead: false };
  ne.promise = lhpPrepare(pic, rgb, { stillOnly: !full, dpr, onFirst, isStale: () => ne.dead }).then(p => {
    if (ne.dead) { _lhpFree(p); throw _LHP_STALE; }
    ne.prep = p;
    ne.bytes = p.bytes;
    // Released after the card has drawn the new frames, never while it may still draw the old.
    if (still && still !== p) setTimeout(() => _lhpFree(still), 0);
    lhpEvictKeys(_lhpCache, LHP_BUDGET, key).forEach(_lhpDrop);
    return p;
  });
  ne.promise.catch(() => {});
  _lhpCache.set(key, ne);
  return ne;
}

function _lhpResolveColor(str) {
  const s = String(str || '').trim();
  if (!s) return null;
  if (_lhpRgbMemo.has(s)) return _lhpRgbMemo.get(s);
  let rgb = null;
  try {
    const x = _lhpCtx(_lhpCanvas(1, 1));
    x.fillStyle = '#010203';
    x.fillStyle = s;
    if (x.fillStyle !== '#010203') {
      x.fillRect(0, 0, 1, 1);
      const d = x.getImageData(0, 0, 1, 1).data;
      rgb = [d[0], d[1], d[2]];
    }
  } catch (e) { rgb = null; }
  _lhpRgbMemo.set(s, rgb);
  return rgb;
}

/** The colour a card's hologram glows in, as rgb: its accent (the cheat sheets' is cyan). */
function lhpCardRgb(card) {
  if (card && card.dataset && card.dataset.scene === 'cheatsheet') return [34, 211, 238];
  let v = '';
  try {
    v = card ? getComputedStyle(card).getPropertyValue('--lib-accent') : '';
    if (!v.trim()) v = getComputedStyle(document.documentElement).getPropertyValue('--color-primary');
  } catch (e) { v = ''; }
  return _lhpResolveColor(v) || [99, 102, 241];
}

/** What libHoloHTML puts in the scene for a card with a picture. */
function lhpSceneHTML() {
  return '<canvas class="lhp-canvas" aria-hidden="true"></canvas>';
}

/** The card's hologram has risen (or is rising): show the picture, and play it unless motion is reduced. */
function lhpCardOn(card) {
  const key = card.dataset.scene;
  const pic = lhpFor(key);
  const canvas = card.querySelector(':scope > .lib-holo .lhp-canvas');
  if (!pic || !canvas) return;
  const still = card.classList.contains('holo-still');
  if (!card._lhpPlayer || card._lhpPlayer.canvas !== canvas) card._lhpPlayer = lhpPlayer(canvas);
  const pl = card._lhpPlayer;
  let e = null;
  e = _lhpWant(key, pic, lhpCardRgb(card), !still, (first) => { if (e && !e.prep) pl.show(first, pic); });
  if (e.prep) pl.show(e.prep, pic);
  e.promise.then(p => {
    if (card._lhpPlayer !== pl || !card.classList.contains('holo-live')) return;
    pl.show(p, pic);
    if (!still && card.classList.contains('holo-on')) pl.play(pic.look.speed);
  }, err => {
    if (err === _LHP_STALE) return;
    console.warn('[Card Characters] ' + key + ': the picture could not be shown; using the drawn one.', err);
    _lhpBroken.add(pic.src);
    const holo = card.querySelector(':scope > .lib-holo');
    if (holo) holo.remove();
    card._lhpPlayer = null;
    const h = card._libHolo;
    if (h && typeof _libHoloSet === 'function') { h.on = false; _libHoloSet(card, h.hover || h.focus); }
  });
}

/** The hologram has sunk away: stop playing. */
function lhpCardOff(card) {
  if (card && card._lhpPlayer) card._lhpPlayer.stop();
}

/** When the Library opens: each picture's first frame, in idle time, so a first hover is instant. */
function lhpWarm(root) {
  if (!root) return;
  const cards = Array.from(root.querySelectorAll('.lib-card[data-scene]')).filter(c => lhpFor(c.dataset.scene));
  if (!cards.length) return;
  const idle = typeof requestIdleCallback === 'function' ? requestIdleCallback : (fn) => setTimeout(fn, 300);
  idle(async () => {
    for (const card of cards) {
      if (!card.isConnected) return;
      const pic = lhpFor(card.dataset.scene);
      if (!pic) continue;
      try { await _lhpWant(card.dataset.scene, pic, lhpCardRgb(card), false).promise; } catch (e) { /* said on hover */ }
    }
  });
}

/** Every prepared picture and player let go (leaving the Library, switching holograms off). */
function lhpRelease() {
  Array.from(_lhpCache.keys()).forEach(_lhpDrop);
  if (typeof document === 'undefined') return;
  document.querySelectorAll('.lib-card[data-scene]').forEach(c => {
    if (c._lhpPlayer) { c._lhpPlayer.destroy(); c._lhpPlayer = null; }
  });
}

/** The pictures changed: every built hologram on screen is taken down, to be rebuilt on the next hover. */
function lhpRefreshCards() {
  _lhpBroken.clear();
  lhpRelease();
  const root = document.querySelector('.lib-hub');
  if (!root) return;
  root.querySelectorAll('.lib-card[data-scene]').forEach(card => {
    const holo = card.querySelector(':scope > .lib-holo');
    if (holo) holo.remove();
    const h = card._libHolo;
    if (h) {
      clearTimeout(h.timer);
      h.on = false;
      card.classList.remove('holo-live', 'holo-on', 'holo-run', 'holo-still');
    }
  });
  if (typeof libHoloEnabled !== 'function' || libHoloEnabled()) lhpWarm(root);
}

if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('storage', e => {
    if (e.key !== LHP_KEY) return;
    lhpRefreshCards();
    if (typeof _syncLibHoloRow === 'function') _syncLibHoloRow();
  });
}
