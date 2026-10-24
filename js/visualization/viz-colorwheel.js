/* ============================================================
   THE COLOUR WHEEL
   ------------------------------------------------------------
   The rainbow swatch at the end of every palette row (vizSwatchesHTML) opens
   this: a wheel where the angle is the hue and the distance from the middle
   the saturation, a brightness slider under it, a hex box, the browser's
   eyedropper where it has one, and the last colours you picked. Apply hands
   the hex code to the same function the swatches call -- a note's edge,
   fill, text, button or tag, a link, paint mode -- so a colour from here is
   stored and drawn exactly like a palette one (vizColorMap passes hex codes
   through). It sits outside the context menus and swallows its own clicks
   and keys, so using it neither closes the menu behind it nor reaches the
   canvas's shortcuts.
   ============================================================ */

const VIZ_RECENT_COLORS_KEY = 'ssp.vizRecentColors';
const _vizWheel = { fn: null, h: 239, s: 0.6, v: 0.95, el: null, outside: null };

function vizRecentColors() {
  try {
    const list = JSON.parse(localStorage.getItem(VIZ_RECENT_COLORS_KEY) || '[]');
    return Array.isArray(list) ? list.filter(vizIsHexColor).slice(0, 8) : [];
  } catch (e) { return []; }
}

function _vizRememberColor(hex) {
  const list = [hex].concat(vizRecentColors().filter(c => c.toLowerCase() !== hex.toLowerCase())).slice(0, 8);
  try { localStorage.setItem(VIZ_RECENT_COLORS_KEY, JSON.stringify(list)); } catch (e) { /* private mode */ }
}

/* ── Colour arithmetic ─────────────────────────────────────── */

function vizHsvToHex(h, s, v) {
  const f = n => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return '#' + [f(5), f(3), f(1)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}

function vizHexToHsv(hex) {
  let c = String(hex || '').trim().replace(/^#/, '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  if (!/^[0-9a-f]{6}$/i.test(c)) return null;
  const [r, g, b] = [0, 2, 4].map(i => parseInt(c.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  return { h: (h + 360) % 360, s: max ? d / max : 0, v: max };
}

/** "#abc" or "abc" or "#AABBCC" -> "#aabbcc"; anything else -> null. */
function vizNormalizeHex(text) {
  let c = String(text || '').trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(c)) c = c.split('').map(x => x + x).join('');
  return /^[0-9a-f]{6}$/i.test(c) ? '#' + c.toLowerCase() : null;
}

/* ── Opening and closing ───────────────────────────────────── */

/** The rainbow swatch: open the wheel beside it, for the function its row calls. */
function vizOpenColorWheel(e, fn) {
  if (e) e.stopPropagation();
  if (typeof window[fn] !== 'function') return;
  vizCloseColorWheel();
  _vizWheel.fn = fn;
  const start = vizHexToHsv(vizRecentColors()[0] || '#6366f1');
  Object.assign(_vizWheel, start);

  const el = document.createElement('div');
  el.id = 'viz-wheel';
  el.className = 'viz-wheel';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Pick a colour');
  const recents = vizRecentColors();
  el.innerHTML = `
    <div class="vw-head"><span class="vw-title"><i data-lucide="palette"></i> Custom colour</span>
      <button type="button" class="vw-x" title="Close (Esc)" aria-label="Close" data-vw="close"><i data-lucide="x"></i></button></div>
    <div class="vw-disc" data-vw="disc" role="slider" tabindex="0" aria-label="Hue and saturation">
      <div class="vw-disc-dim"></div>
      <span class="vw-thumb" data-vw="thumb"></span>
    </div>
    <div class="vw-bright" data-vw="bright" role="slider" tabindex="0" aria-label="Brightness" aria-valuemin="0" aria-valuemax="100">
      <span class="vw-bright-thumb" data-vw="bthumb"></span>
    </div>
    <div class="vw-row">
      <span class="vw-preview" data-vw="preview"></span>
      <label class="vw-hex"><span>#</span><input type="text" maxlength="7" spellcheck="false" autocomplete="off" aria-label="Hex code" data-vw="hex" /></label>
      ${typeof window.EyeDropper === 'function'
        ? '<button type="button" class="vw-icon" title="Pick a colour from the screen" aria-label="Eyedropper" data-vw="drop"><i data-lucide="pipette"></i></button>' : ''}
    </div>
    ${recents.length ? `<div class="vw-recent"><span>Recent</span>${recents.map(c =>
      `<button type="button" class="vw-chip" style="background:${c};" title="${c}" aria-label="Use ${c}" data-vw="recent" data-hex="${c}"></button>`).join('')}</div>` : ''}
    <div class="vw-actions">
      <button type="button" class="vw-btn" data-vw="close">Cancel</button>
      <button type="button" class="vw-btn is-primary" data-vw="apply"><i data-lucide="check"></i> Apply</button>
    </div>`;
  document.body.appendChild(el);
  _vizWheel.el = el;

  // Its own clicks, presses and keys stay its own: the context menu behind it
  // stays open and the canvas never sees a Delete typed into the hex box.
  ['click', 'pointerdown', 'mousedown', 'contextmenu', 'wheel'].forEach(t => el.addEventListener(t, ev => ev.stopPropagation()));
  el.addEventListener('keydown', ev => {
    ev.stopPropagation();
    if (ev.key === 'Escape') { ev.preventDefault(); vizCloseColorWheel(); }
    else if (ev.key === 'Enter') { ev.preventDefault(); _vizWheelApply(); }
    else if (ev.target.dataset.vw === 'disc' || ev.target.dataset.vw === 'bright') _vizWheelKey(ev);
  });
  el.addEventListener('click', ev => {
    const t = ev.target.closest('[data-vw]');
    if (!t) return;
    const what = t.dataset.vw;
    if (what === 'close') vizCloseColorWheel();
    else if (what === 'apply') _vizWheelApply();
    else if (what === 'recent') { _vizWheelSetHex(t.dataset.hex); _vizWheelApply(); }
    else if (what === 'drop') _vizWheelEyedropper();
  });
  const disc = el.querySelector('[data-vw="disc"]');
  const bright = el.querySelector('[data-vw="bright"]');
  disc.addEventListener('pointerdown', ev => _vizWheelDrag(ev, disc, _vizWheelFromDisc));
  bright.addEventListener('pointerdown', ev => _vizWheelDrag(ev, bright, _vizWheelFromBright));
  const hex = el.querySelector('[data-vw="hex"]');
  hex.addEventListener('input', () => {
    const v = vizNormalizeHex(hex.value);
    hex.classList.toggle('is-bad', !v && hex.value.trim() !== '');
    if (v) { Object.assign(_vizWheel, vizHexToHsv(v)); _vizWheelPaint(true); }
  });

  if (typeof lucide !== 'undefined') lucide.createIcons({ root: el });
  _vizWheelPaint();
  _vizWheelPlace(el, e && e.currentTarget ? e.currentTarget : e && e.target);
  setTimeout(() => { const h = el.querySelector('[data-vw="hex"]'); if (h) { h.focus({ preventScroll: true }); h.select(); } }, 30);

  // A press anywhere else closes it (added after this click has finished).
  setTimeout(() => {
    _vizWheel.outside = ev => { if (_vizWheel.el && !_vizWheel.el.contains(ev.target)) vizCloseColorWheel(); };
    document.addEventListener('pointerdown', _vizWheel.outside, true);
  }, 0);
}

function vizCloseColorWheel() {
  if (_vizWheel.outside) document.removeEventListener('pointerdown', _vizWheel.outside, true);
  _vizWheel.outside = null;
  const el = _vizWheel.el || document.getElementById('viz-wheel');
  _vizWheel.el = null;
  if (!el) return;
  el.classList.add('is-closing');
  setTimeout(() => el.remove(), 150);
}

/** Beside the swatch that opened it, kept on screen. */
function _vizWheelPlace(el, anchor) {
  const W = el.offsetWidth || 248, H = el.offsetHeight || 380;
  const r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: 100, right: 120, top: 100, bottom: 120 };
  let x = r.right + 12, y = r.top - 40;
  if (x + W > window.innerWidth - 8) x = r.left - W - 12;
  x = Math.max(8, Math.min(x, window.innerWidth - W - 8));
  y = Math.max(8, Math.min(y, window.innerHeight - H - 8));
  el.style.left = Math.round(x) + 'px';
  el.style.top = Math.round(y) + 'px';
}

/* ── Picking ───────────────────────────────────────────────── */

function _vizWheelHex() { return vizHsvToHex(_vizWheel.h, _vizWheel.s, _vizWheel.v); }

function _vizWheelSetHex(hex) {
  const hsv = vizHexToHsv(hex);
  if (hsv) { Object.assign(_vizWheel, hsv); _vizWheelPaint(); }
}

/** Draw the thumbs, the brightness bar and the preview from h, s, v. */
function _vizWheelPaint(fromHexBox) {
  const el = _vizWheel.el;
  if (!el) return;
  const { h, s, v } = _vizWheel;
  const hex = _vizWheelHex();
  const disc = el.querySelector('[data-vw="disc"]');
  el.style.setProperty('--vw-color', hex);
  el.style.setProperty('--vw-pure', vizHsvToHex(h, s, 1));
  el.style.setProperty('--vw-dim', String(1 - v));
  const rad = h * Math.PI / 180;
  const thumb = el.querySelector('[data-vw="thumb"]');
  if (thumb) {
    thumb.style.left = (50 + Math.sin(rad) * s * 50) + '%';
    thumb.style.top = (50 - Math.cos(rad) * s * 50) + '%';
  }
  const bthumb = el.querySelector('[data-vw="bthumb"]');
  if (bthumb) bthumb.style.left = (v * 100) + '%';
  const bright = el.querySelector('[data-vw="bright"]');
  if (bright) bright.setAttribute('aria-valuenow', String(Math.round(v * 100)));
  if (disc) disc.setAttribute('aria-valuetext', `hue ${Math.round(h)}, saturation ${Math.round(s * 100)}%`);
  const box = el.querySelector('[data-vw="hex"]');
  if (box && !fromHexBox) { box.value = hex.slice(1); box.classList.remove('is-bad'); }
}

/** Follow the pointer across the disc or the bar until it lets go. */
function _vizWheelDrag(ev, target, from) {
  ev.preventDefault();
  if (target.setPointerCapture && ev.pointerId !== undefined) { try { target.setPointerCapture(ev.pointerId); } catch (_) { /* not capturable */ } }
  from(ev, target);
  const move = m => from(m, target);
  const up = () => { target.removeEventListener('pointermove', move); target.removeEventListener('pointerup', up); target.removeEventListener('pointercancel', up); };
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerup', up);
  target.addEventListener('pointercancel', up);
}

/** Angle from twelve o'clock, clockwise, is the hue; distance out is the saturation. */
function _vizWheelFromDisc(ev, disc) {
  const r = disc.getBoundingClientRect();
  if (!r.width) return;
  const dx = ev.clientX - (r.left + r.width / 2), dy = ev.clientY - (r.top + r.height / 2);
  _vizWheel.h = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
  _vizWheel.s = Math.min(1, Math.hypot(dx, dy) / (r.width / 2));
  _vizWheelPaint();
}

function _vizWheelFromBright(ev, bar) {
  const r = bar.getBoundingClientRect();
  if (!r.width) return;
  _vizWheel.v = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
  _vizWheelPaint();
}

/** Arrow keys: round the wheel and in and out on the disc, along the bar. */
function _vizWheelKey(ev) {
  const step = ev.shiftKey ? 10 : 2;
  if (ev.target.dataset.vw === 'disc') {
    if (ev.key === 'ArrowLeft') _vizWheel.h = (_vizWheel.h - step + 360) % 360;
    else if (ev.key === 'ArrowRight') _vizWheel.h = (_vizWheel.h + step) % 360;
    else if (ev.key === 'ArrowUp') _vizWheel.s = Math.min(1, _vizWheel.s + step / 100);
    else if (ev.key === 'ArrowDown') _vizWheel.s = Math.max(0, _vizWheel.s - step / 100);
    else return;
  } else {
    if (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') _vizWheel.v = Math.max(0, _vizWheel.v - step / 100);
    else if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') _vizWheel.v = Math.min(1, _vizWheel.v + step / 100);
    else return;
  }
  ev.preventDefault();
  _vizWheelPaint();
}

function _vizWheelEyedropper() {
  if (typeof window.EyeDropper !== 'function') return;
  new window.EyeDropper().open()
    .then(res => { if (res && res.sRGBHex) _vizWheelSetHex(vizNormalizeHex(res.sRGBHex) || res.sRGBHex); })
    .catch(() => { /* cancelled */ });
}

/** Hand the colour to the row's own function, remember it, close. */
function _vizWheelApply() {
  const box = _vizWheel.el && _vizWheel.el.querySelector('[data-vw="hex"]');
  const typed = box ? vizNormalizeHex(box.value) : null;
  if (box && box.value.trim() && !typed) { box.classList.add('is-bad'); box.focus(); return; }
  const hex = typed || _vizWheelHex();
  const fn = _vizWheel.fn;
  _vizRememberColor(hex);
  vizCloseColorWheel();
  if (fn && typeof window[fn] === 'function') window[fn](hex);
}
