/* Unit tests for the Card Characters pictures (no browser): node tools/test-lib-holo-pics.js
   js/lib-holo-pics.js's pure part -- the saved settings, background removal,
   auto-crop bounds, the outline, placement in the hologram box, and the GIF
   decoder -- run in a vm context with no DOM. GIF fixtures are built here by
   a tiny encoder that sends a clear code every two literals, so the LZW code
   size never grows and the bytes are easy to reason about. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let failed = 0, passed = 0;
function ok(cond, name) {
  if (cond) { passed++; return; }
  failed++;
  console.log('FAIL ' + name);
}
function eq(a, b, name) {
  const same = JSON.stringify(a) === JSON.stringify(b);
  if (!same) console.log('  got      ' + JSON.stringify(a) + '\n  expected ' + JSON.stringify(b));
  ok(same, name);
}

const JS = (f) => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');
const ctx = { console: { log() {}, warn() {}, error: console.error } };
vm.createContext(ctx);
vm.runInContext(JS('lib-holo-pics.js'), ctx);
const L = (name) => vm.runInContext(name, ctx);

/** An RGBA image; `fill(x, y)` gives [r,g,b,a]. */
function img(w, h, fill) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(fill(x, y), (y * w + x) * 4);
  return { data, width: w, height: h };
}
const A = (im, x, y) => im.data[(y * im.width + x) * 4 + 3];

/* ── Saved settings ─────────────────────────────────────────── */
{
  const norm = L('lhpNormalize');
  const out = norm({
    v: 1,
    cards: {
      study: { src: 'media:m1_a', w: 100, h: 80, fit: { scale: 9, dx: 500 }, bg: { on: 1, tol: -5, color: 'red' },
        outline: { width: 99, color: '#ABCDEF' }, look: { opacity: 3, speed: 0 }, crop: { x: -4, y: 2, w: 500, h: 10 } },
      mindset: { src: 'media:m2_b' },
      placeholder: { src: 'media:m3_c' },
      coding: { src: 'https://example.com/x.gif' },
      snippets: 'not a picture',
      __proto__x: { src: 'media:m4_d' }
    }
  });
  const s = out.cards.study;
  eq(Object.keys(out.cards).sort(), ['mindset', 'study'], 'normalize: keeps real cards, drops placeholder, bad src, non-objects and odd keys');
  eq([s.fit.scale, s.fit.dx, s.bg.tol, s.bg.on, s.bg.color], [1.6, 100, 0, true, 'auto'], 'normalize: clamps numbers, coerces flags, unknown colour is auto');
  eq([s.outline.width, s.outline.color, s.look.opacity, s.look.speed], [8, '#abcdef', 40, 0.25], 'normalize: outline and look clamped');
  eq(s.crop, { x: 0, y: 2, w: 100, h: 10 }, 'normalize: crop clamped inside the picture');
  eq(out.cards.mindset.look, { tint: 25, scan: true, opacity: 100, speed: 1 }, 'normalize: missing fields get the defaults');
  eq(norm('garbage').cards, {}, 'normalize: anything else is an empty store');
  eq(L('lhpNormalizePic({ src: "media:m1_a", crop: { x: 1 } })').crop, null, 'normalize: a crop without a size is the whole frame');
}

/* ── Colours ────────────────────────────────────────────────── */
{
  eq(L('lhpHexToRgb("#10ff0a")'), [16, 255, 10], 'hex to rgb');
  eq(L('lhpHexToRgb("nope")'), null, 'bad hex is null');
  eq(L('lhpRgbToHex([16, 255, 10])'), '#10ff0a', 'rgb to hex');
  eq(Math.round(L('lhpDist(0,0,0,255,255,255)')), 100, 'black to white is 100');
  eq(L('lhpDist(9,9,9,9,9,9)'), 0, 'same colour is 0');
}

/* ── Background guess ───────────────────────────────────────── */
{
  const white = img(6, 6, (x, y) => (x > 1 && x < 4 && y > 1 && y < 4 ? [200, 0, 0, 255] : [255, 255, 255, 255]));
  const g = ctx.lhpGuessBg(white);
  eq([g.hex, g.flat, g.transparent], ['#ffffff', true, false], 'guess: a white border is a flat white background, no transparency');
  const noisy = img(6, 6, (x, y) => [(x * 40) % 256, (y * 70) % 256, (x * y * 30) % 256, 255]);
  eq(ctx.lhpGuessBg(noisy).flat, false, 'guess: a busy border is not flat');
  const cut = img(6, 6, (x, y) => (x > 1 && x < 4 ? [0, 0, 255, 255] : [0, 0, 0, 0]));
  eq(ctx.lhpGuessBg(cut).transparent, true, 'guess: a cut-out picture reports transparency');
}

/* ── Background removal ─────────────────────────────────────── */
{
  // White ground, a black ring, white inside the ring (an eye).
  const eye = () => img(7, 7, (x, y) => {
    const ring = x >= 2 && x <= 4 && y >= 2 && y <= 4;
    return ring && !(x === 3 && y === 3) ? [0, 0, 0, 255] : [255, 255, 255, 255];
  });
  const a = ctx.lhpKey(eye(), { rgb: [255, 255, 255], tol: 10, soft: 0, edges: true });
  eq([A(a, 0, 0), A(a, 6, 3), A(a, 3, 3), A(a, 2, 2)], [0, 0, 255, 255], 'key: edges mode keeps enclosed same-colour pixels');
  const b = ctx.lhpKey(eye(), { rgb: [255, 255, 255], tol: 10, soft: 0, edges: false });
  eq([A(b, 0, 0), A(b, 3, 3), A(b, 2, 2)], [0, 0, 255], 'key: everywhere mode removes them too');
  // A grey a little past the tolerance sits in the soft band: partly see-through.
  const band = img(3, 1, (x) => (x === 1 ? [235, 235, 235, 255] : [255, 255, 255, 255]));
  ctx.lhpKey(band, { rgb: [255, 255, 255], tol: 2, soft: 10, edges: false });
  const mid = A(band, 1, 0);
  ok(mid > 0 && mid < 255, 'key: the soft band gives partial alpha (got ' + mid + ')');
}

/* ── Auto-crop bounds ───────────────────────────────────────── */
{
  const f1 = img(10, 10, (x, y) => (x === 2 && y === 3 ? [9, 9, 9, 255] : [0, 0, 0, 0]));
  const f2 = img(10, 10, (x, y) => (x === 7 && y === 8 ? [9, 9, 9, 255] : [0, 0, 0, 0]));
  eq(ctx.lhpBounds([f1, f2]), { x: 2, y: 3, w: 6, h: 6 }, 'bounds: union across frames');
  eq(ctx.lhpBounds([img(4, 4, () => [1, 2, 3, 255])]), null, 'bounds: fully opaque frames give null');
  eq(ctx.lhpBounds([img(4, 4, () => [0, 0, 0, 0])]), null, 'bounds: nothing visible gives null');
  // Frame by frame, so an upload's frames need not all be kept: an opaque frame among cut-out ones still counts.
  const acc = ctx.lhpBoundsAcc();
  acc.add(f1);
  acc.add(img(10, 10, () => [5, 5, 5, 255]));
  eq(acc.result(), { x: 0, y: 0, w: 10, h: 10 }, 'boundsAcc: an opaque frame widens the box to the whole picture');
  const acc2 = ctx.lhpBoundsAcc();
  [f1, f2].forEach(acc2.add);
  eq(acc2.result(), { x: 2, y: 3, w: 6, h: 6 }, 'boundsAcc: the same union as lhpBounds');
  eq(ctx.lhpPadBox({ x: 2, y: 3, w: 6, h: 6 }, 10, 10, 50), { x: 0, y: 0, w: 10, h: 10 }, 'pad: clamped to the picture');
  eq(ctx.lhpPadBox({ x: 40, y: 40, w: 20, h: 10 }, 100, 100, 10), { x: 38, y: 38, w: 24, h: 14 }, 'pad: a share of the larger side');
}

/* ── Outline ────────────────────────────────────────────────── */
{
  const dot = img(9, 9, (x, y) => (x === 4 && y === 4 ? [255, 255, 255, 255] : [0, 0, 0, 0]));
  const o = ctx.lhpOutline(dot, 2, [255, 0, 0]);
  ok(A(o, 6, 4) > 0, 'outline: reaches 2 px out');
  eq(A(o, 7, 4), 0, 'outline: not 3 px out');
  eq(Array.from(o.data.slice((4 * 9 + 6) * 4, (4 * 9 + 6) * 4 + 3)), [255, 0, 0], 'outline: in its colour');
}

/* ── Placement ──────────────────────────────────────────────── */
{
  const f = ctx.lhpFit(100, 100, { scale: 1, dx: 0, dy: 0, flip: false });
  eq([f.w, f.h, f.y + f.h, f.x], [138, 138, 146, 31], 'fit: contained, standing on the floor, centred');
  const g = ctx.lhpFit(400, 100, { scale: 0.5, dx: 10, dy: -4, flip: true });
  eq([g.w, g.h, g.x, g.y + g.h], [92, 23, 64, 142], 'fit: scaled and nudged');
}

/* ── GIF decoding ───────────────────────────────────────────── */

/** LZW for GIF, never growing the code size: a clear code every two literals. */
function lzw(indices, min) {
  const clear = 1 << min, eoi = clear + 1, size = min + 1;
  const codes = [clear];
  indices.forEach((v, i) => { if (i && i % (clear - 2) === 0) codes.push(clear); codes.push(v); });
  codes.push(eoi);
  const out = [];
  let acc = 0, bits = 0;
  codes.forEach(c => { acc |= c << bits; bits += size; while (bits >= 8) { out.push(acc & 255); acc >>= 8; bits -= 8; } });
  if (bits) out.push(acc & 255);
  return out;
}
function blocks(bytes) {
  const out = [];
  for (let i = 0; i < bytes.length; i += 255) { const part = bytes.slice(i, i + 255); out.push(part.length, ...part); }
  out.push(0);
  return out;
}
const le = (n) => [n & 255, (n >> 8) & 255];
/** frames: [{ x, y, w, h, px, delay (cs), disposal, trans, interlace }]; palette of 4 colours. */
function gif(w, h, palette, frames) {
  const b = [...Buffer.from('GIF89a'), ...le(w), ...le(h), 0x80 | 0x70 | 1, 0, 0];
  palette.forEach(c => b.push(...c));
  frames.forEach(f => {
    const trans = f.trans === undefined ? 0 : 1;
    b.push(0x21, 0xF9, 4, ((f.disposal || 0) << 2) | trans, ...le(f.delay || 0), f.trans || 0, 0);
    b.push(0x2C, ...le(f.x || 0), ...le(f.y || 0), ...le(f.w), ...le(f.h), f.interlace ? 0x40 : 0);
    b.push(2, ...blocks(lzw(f.px, 2)));
  });
  b.push(0x3B);
  return Uint8Array.from(b);
}
const PAL = [[0, 0, 0], [255, 0, 0], [0, 255, 0], [0, 0, 255]];
const px = (rgba, w, x, y) => Array.from(rgba.slice((y * w + x) * 4, (y * w + x) * 4 + 4));

{
  const bytes = gif(2, 2, PAL, [
    { w: 2, h: 2, px: [1, 2, 3, 1], delay: 5 },
    { x: 1, y: 1, w: 1, h: 1, px: [2], delay: 0 }
  ]);
  const seen = [];
  const info = ctx.lhpGifEach(bytes, (rgba, delay, i) => seen.push({ i, delay, a: px(rgba, 2, 0, 0), d: px(rgba, 2, 1, 1) }));
  eq([info.width, info.height, info.count], [2, 2, 2], 'gif: size and frame count');
  eq(seen[0], { i: 0, delay: 50, a: [255, 0, 0, 255], d: [255, 0, 0, 255] }, 'gif: first frame and its delay');
  eq(seen[1], { i: 1, delay: 100, a: [255, 0, 0, 255], d: [0, 255, 0, 255] }, 'gif: a patch frame drawn over the last, a 0 delay plays as 100 ms');
}

{
  // Frame 1 disposal 2: its area goes transparent before frame 2.
  const two = gif(2, 1, PAL, [
    { w: 2, h: 1, px: [1, 1] },
    { w: 1, h: 1, px: [3], disposal: 2 },
    { x: 1, w: 1, h: 1, px: [2] }
  ]);
  const last = [];
  ctx.lhpGifEach(two, (rgba) => last.push([px(rgba, 2, 0, 0), px(rgba, 2, 1, 0)]));
  eq(last[2], [[0, 0, 0, 0], [0, 255, 0, 255]], 'gif: disposal 2 restores background');
  // Frame 1 disposal 3: the picture before it comes back.
  const three = gif(2, 1, PAL, [
    { w: 2, h: 1, px: [1, 1] },
    { w: 1, h: 1, px: [3], disposal: 3 },
    { x: 1, w: 1, h: 1, px: [2] }
  ]);
  const back = [];
  ctx.lhpGifEach(three, (rgba) => back.push([px(rgba, 2, 0, 0), px(rgba, 2, 1, 0)]));
  eq(back[2], [[255, 0, 0, 255], [0, 255, 0, 255]], 'gif: disposal 3 restores previous');
}

{
  // The transparent index leaves what is underneath.
  const t = gif(2, 1, PAL, [{ w: 2, h: 1, px: [1, 1] }, { w: 2, h: 1, px: [0, 3], trans: 0 }]);
  const f = [];
  ctx.lhpGifEach(t, (rgba) => f.push(px(rgba, 2, 0, 0)));
  eq(f[1], [255, 0, 0, 255], 'gif: the transparent index shows the frame below');
  // Interlaced: rows arrive 0, 2, 1, 3.
  const il = gif(1, 4, PAL, [{ w: 1, h: 4, px: [1, 2, 3, 0], interlace: true }]);
  let rows = null;
  ctx.lhpGifEach(il, (rgba) => { rows = [0, 1, 2, 3].map(y => px(rgba, 1, 0, y).slice(0, 3)); });
  eq(rows, [[255, 0, 0], [0, 0, 255], [0, 255, 0], [0, 0, 0]], 'gif: interlaced rows land in place');
  // maxFrames stops early.
  eq(ctx.lhpGifEach(t, () => {}, 1).count, 1, 'gif: maxFrames stops early');
}

{
  const good = gif(2, 2, PAL, [{ w: 2, h: 2, px: [1, 2, 3, 1] }]);
  let threw = false;
  try { ctx.lhpGifEach(good.slice(0, good.length - 6), () => {}); } catch (e) { threw = true; }
  ok(threw, 'gif: truncated file throws');
  threw = false;
  try { ctx.lhpGifEach(Uint8Array.from(Buffer.from('PNG not a gif')), () => {}); } catch (e) { threw = true; }
  ok(threw, 'gif: not a GIF throws');
}

{
  // The reader hands frames over one at a time, so a long GIF can be processed between other work.
  const bytes = gif(2, 1, PAL, [{ w: 2, h: 1, px: [1, 2], delay: 3 }, { w: 1, h: 1, px: [3] }]);
  const rd = ctx.lhpGifReader(bytes);
  eq([rd.width, rd.height], [2, 1], 'reader: size known before any frame');
  const f0 = rd.next();
  eq([px(f0.rgba, 2, 1, 0), f0.delay, f0.index], [[0, 255, 0, 255], 30, 0], 'reader: first frame, its own delay');
  const f1 = rd.next();
  eq(px(f1.rgba, 2, 0, 0), [0, 0, 255, 255], 'reader: second frame');
  eq(rd.next(), null, 'reader: null at the end');
}

/* ── Memory and drawing ─────────────────────────────────────── */
{
  const pic = (o) => ctx.lhpNormalizePic(Object.assign({ src: 'media:m1_a' }, o));
  eq(ctx.lhpBudget(10, 100, 100, pic({}), 2), { dpr: 2, every: 1 }, 'budget: a short GIF keeps full sharpness');
  eq(ctx.lhpBudget(400, 100, 100, pic({ fit: { scale: 1.6 } }), 2), { dpr: 1, every: 2 }, 'budget: a long big GIF drops to 1x, then every second frame');
  eq(ctx.lhpBudget(300, 100, 100, pic({}), 2), { dpr: 1, every: 1 }, 'budget: 1x alone is enough when it fits');

  // Least recently used first, never the card being shown.
  const m = new Map([['a', { bytes: 50 }], ['b', { bytes: 50 }], ['c', { bytes: 50 }]]);
  eq(ctx.lhpEvictKeys(m, 100, 'a'), ['b'], 'evict: oldest first, skipping the card in use');
  eq(ctx.lhpEvictKeys(m, 200, 'c'), [], 'evict: nothing under the budget');

  // Nudge and flip are applied when drawing, so changing them never re-prepares.
  const base = pic({ fit: { scale: 1.2 }, bg: { on: true } });
  const moved = pic({ fit: { scale: 1.2, dx: 30, dy: -5, flip: true }, bg: { on: true } });
  eq(ctx.lhpSig(base, [1, 2, 3], 2), ctx.lhpSig(moved, [1, 2, 3], 2), 'sig: nudge and flip do not change what is prepared');
  ok(ctx.lhpSig(base, [1, 2, 3], 2) !== ctx.lhpSig(pic({ fit: { scale: 1 } }), [1, 2, 3], 2), 'sig: size does');
  ok(ctx.lhpSig(base, [1, 2, 3], 2) !== ctx.lhpSig(base, [9, 9, 9], 2), 'sig: the card colour does (tint)');

  const r = ctx.lhpDrawRect({ cw: 100, ch: 100, pad: 3 }, pic({ fit: { dx: 10, dy: -4 } }));
  eq(r, { x: 31 + 10 - 3, y: 8 - 4 - 3, w: 138 + 6, h: 138 + 6, cx: 31 + 10 + 69 }, 'drawRect: the bitmap with its outline margin, nudged');
}

/* ── Cloud copies and sync ──────────────────────────────────── */
{
  // media-store.js's list of pictures to copy to the cloud must include the cards' pictures.
  const src = JS('media-store.js');
  const fnSrc = src.match(/function _mdLiveIds\(\) \{[\s\S]*?\n\}\n/)[0];
  const mctx = {
    MEDIA_PREFIX: 'media:', MEDIA_REF_RE: /media:(m[0-9a-z]+_[0-9a-z]+)/g,
    state: { challenges: [{ cover: 'media:m1_lib' }] },
    localStorage: { getItem: (k) => (k === 'ssp.libHoloPics' ? JSON.stringify({ v: 1, cards: { study: { src: 'media:m9_card' } } }) : null) }
  };
  vm.createContext(mctx);
  vm.runInContext(fnSrc, mctx);
  const ids = Array.from(vm.runInContext('_mdLiveIds()', mctx)).sort();
  eq(ids, ['m1_lib', 'm9_card'], 'media: the cards\' pictures go to the cloud with the library\'s');
  ok(/'ssp\.libHoloPics'/.test(JS('firebase-auth.js').match(/const SYNC_PREF_KEYS = \[[\s\S]*?\];/)[0]), 'sync: ssp.libHoloPics follows the account');
}

console.log((failed ? 'FAILED ' + failed + ', ' : '') + passed + ' passed');
process.exit(failed ? 1 : 0);
