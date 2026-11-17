/* ============================================================
   LIB-HOLO.JS — the holograms over the Library hub's cards

   Hover a collection card (or reach it with the keyboard) and a little
   scene rises out of the glow in the card's top-right corner and plays just
   above it, like a hologram coming out of the card. While it rises (and
   while it sinks back) the page behind its outline is blurred; once it
   settles the blur goes and the scene simply shows.

   One mechanism, one scene per library. Everything is inline SVG (plus a
   little HTML for the cheat sheets' 3D ring): no GIF, no video, no network,
   so it works offline. The motion is CSS in css/lib-holo.css.

   NOTHING RUNS UNTIL A CARD IS HOVERED. A card's hologram is built the first
   time it is wanted and is display:none the rest of the time, which stops
   every animation in it. Every animated rule in lib-holo.css is keyed on
   .holo-run, which only a live card carries.

   Classes on the card:
     holo-live  the hologram is displayed (on the way up, up, or sinking back)
     holo-on    risen
     holo-run   motion allowed: the scene plays
     holo-still reduced motion (the system setting, or Motion: Calm / Off):
                no rise, no loops, no blur -- the scene fades in as a still.
                The still pose is the SVG's own transform/opacity attributes,
                which the CSS animations override while they run.

   Scene drawing conventions: every animated group is drawn around its own
   pivot at (0,0) and placed by an outer <g transform="translate(x,y)">
   (_lhAt), so a CSS rotate/scale on the inner group turns about the pivot
   (an SVG element's default transform-origin is its local 0,0). All
   characters are original.
   ============================================================ */

const LIB_HOLO_OUT_MS = 440;   // the sink transition, then display:none
const LH_SKIN = '#ffe2cf';
const LH_SKIN_SH = '#f3c4ac';
const LH_INK = '#1f1a2e';
const LH_LIP = '#8a2f3e';

/* Reduced motion: the system setting, or the app's own Motion level when it
   is anything but Full ("Calm: fades only, nothing travels"). */
function libHoloStill() {
  if (typeof Motion !== 'undefined' && Motion && typeof Motion.level === 'function') {
    return Motion.prefersReducedMotion() || Motion.level() !== 'full';
  }
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

/* ── The Settings switch ──────────────────────────────────────
   "Card Characters" in Settings, per device (ssp.libHolo, '0' = off). Off,
   nothing is bound and nothing is built: no listeners, no layers, no
   animation, no blur. Switched off while the Library is on screen, every
   hologram and listener there is taken down at once; switched on, they are
   bound again. */
const LIB_HOLO_KEY = 'ssp.libHolo';

function libHoloEnabled() {
  try { return localStorage.getItem(LIB_HOLO_KEY) !== '0'; } catch (e) { return true; }
}

function toggleLibHolo() {
  const next = !libHoloEnabled();
  try { localStorage.setItem(LIB_HOLO_KEY, next ? '1' : '0'); } catch (e) { /* private mode */ }
  _libHoloApply(next);
  _syncLibHoloRow();
  if (typeof toast === 'function') toast(next ? 'Card characters on' : 'Card characters off', { type: 'info', duration: 1600 });
}

function _libHoloApply(on) {
  const root = document.querySelector('.lib-hub');
  if (!root) return;
  if (on) libHoloBind(root);
  else libHoloUnbind(root);
}

/* The Settings row reads what the switch is: on toggle, at start, and when
   another tab changes it. */
function _syncLibHoloRow() {
  const row = document.getElementById('settings-libholo-item');
  if (!row) return;
  const on = libHoloEnabled();
  row.setAttribute('aria-pressed', String(on));
  const label = document.getElementById('settings-libholo-label');
  const desc = document.getElementById('settings-libholo-desc');
  if (label) label.textContent = on ? 'Card Characters On' : 'Card Characters Off';
  if (desc) desc.textContent = on ? 'Little scenes rise over Library cards on hover' : 'Library cards stay still';
  if (typeof _setLucideIcon === 'function') {
    _setLucideIcon(document.getElementById('settings-libholo-icon'), on ? 'ghost' : 'eye-off');
  }
}
document.addEventListener('DOMContentLoaded', _syncLibHoloRow);
window.addEventListener('storage', e => {
  if (e.key !== LIB_HOLO_KEY) return;
  _libHoloApply(libHoloEnabled());
  _syncLibHoloRow();
});

function libHoloBind(root) {
  if (!root || !libHoloEnabled()) return;
  root.querySelectorAll('.lib-card[data-scene]').forEach(card => {
    if (card._libHolo || !LIB_HOLO_SCENES[card.dataset.scene]) return;
    const h = card._libHolo = { hover: false, focus: false, on: false, timer: 0, off: [] };
    const sync = () => _libHoloSet(card, h.hover || h.focus);
    const on = (type, fn) => { card.addEventListener(type, fn); h.off.push([type, fn]); };
    // Mouse and pen only: a finger has no hover, and a tap navigates away.
    on('pointerenter', e => { if (e.pointerType === 'touch') return; h.hover = true; sync(); });
    on('pointerleave', () => { h.hover = false; sync(); });
    on('focus', () => {
      let kb = true;
      try { kb = card.matches(':focus-visible'); } catch (e) { /* old engine: treat as keyboard */ }
      h.focus = kb; sync();
    });
    on('blur', () => { h.focus = false; sync(); });
  });
}

/* Everything libHoloBind and a hover put there, gone. */
function libHoloUnbind(root) {
  if (!root) return;
  root.querySelectorAll('.lib-card[data-scene]').forEach(card => {
    const h = card._libHolo;
    if (!h) return;
    clearTimeout(h.timer);
    h.off.forEach(([type, fn]) => card.removeEventListener(type, fn));
    card._libHolo = null;
    card.classList.remove('holo-live', 'holo-on', 'holo-run', 'holo-still');
    const holo = card.querySelector(':scope > .lib-holo');
    if (holo) holo.remove();
  });
}

function _libHoloSet(card, on) {
  const h = card._libHolo;
  if (!h || on === h.on) return;
  h.on = on;
  clearTimeout(h.timer);
  if (on) {
    let holo = card.querySelector(':scope > .lib-holo');
    if (!holo) {
      card.insertAdjacentHTML('beforeend', libHoloHTML(card.dataset.scene));
      holo = card.lastElementChild;
      holo.querySelectorAll('svg.lh-svg, svg.lhx-svg').forEach(_lhLift);
    }
    const still = libHoloStill();
    card.classList.toggle('holo-still', still);
    card.classList.toggle('holo-run', !still);
    if (!card.classList.contains('holo-live')) {
      card.classList.add('holo-live');
      // The sunk pose has to be computed before the card can rise from it.
      void holo.offsetWidth;
    }
    card.classList.add('holo-on');
  } else {
    card.classList.remove('holo-on');
    h.timer = setTimeout(() => card.classList.remove('holo-live', 'holo-run', 'holo-still'), LIB_HOLO_OUT_MS);
  }
}

/* The frame every scene sits in. The aura (the blur) is a SIBLING of the
   stage, never inside it: the stage fades, and an ancestor below opacity 1
   walls a backdrop-filter off from the page behind it. */
function libHoloHTML(key) {
  const scene = LIB_HOLO_SCENES[key];
  if (!scene) return '';
  return `<div class="lib-holo lh-${key}" aria-hidden="true">` +
    '<div class="lib-holo-aura"></div>' +
    '<div class="lib-holo-stage"><div class="lib-holo-beam"></div><div class="lib-holo-floor"></div>' +
    `<div class="lib-holo-scene">${scene()}</div><div class="lib-holo-sweep"></div></div></div>`;
}

/* ── Lifting a scene onto the compositor ──────────────────────
   The scenes are written as one SVG each, but a CSS animation on an SVG
   element runs on the main thread: every frame restyles it, lays the SVG
   out again and repaints it. Measured with the CPU slowed 4x, a still
   pointer over the Coding card cost 2.5 s of main-thread work in 3 s (the
   same card without its hologram: 0.4 s).
   So when a hologram is built, each moving part becomes an HTML layer and
   the GPU moves it, and the parts that do not move are drawn once. The SVG
   is walked in paint order: runs of still elements go into small
   overflow-visible <svg>s, and every element whose class animates becomes a
   <div> that takes its class, style, transform and opacity, with what it
   draws inside. A moving group's children are walked the same way, so parts
   that move inside moving parts nest as they did. The div sits at its
   parent's origin with transform-origin 0 0, which is exactly where an SVG
   element turns and scales from, so the keyframes in lib-holo.css apply
   unchanged and the SVG's transform/opacity attributes (the still pose for
   reduced motion) become its inline style, which the animations override. */
const LH_SVGNS = 'http://www.w3.org/2000/svg';
// Hologram classes that only style; any other lh*- class animates.
const LH_STILL = new Set(['lh-svg', 'lh-mono', 'lh-jp', 'lh-hand', 'lhc-cov', 'lhd-cov', 'lhs-c', 'lhs-p',
  'lhw-pin', 'lhx-stage', 'lhx-svg', 'lhx-win', 'lhx-world']);
// Presentation attributes a <g> hands down; a part lifted out of the group takes them along.
const LH_INHERIT = ['fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap',
  'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-miterlimit', 'font-family', 'font-size',
  'font-weight', 'font-style', 'text-anchor', 'dominant-baseline', 'letter-spacing', 'paint-order', 'visibility', 'color'];

function _lhMoves(el) {
  const c = el.classList;
  for (let i = 0; i < c.length; i++) if (/^lh[a-z]?-/.test(c[i]) && !LH_STILL.has(c[i])) return true;
  return false;
}

function _lhHasMover(el) {
  if (_lhMoves(el)) return true;
  for (let i = 0; i < el.children.length; i++) if (_lhHasMover(el.children[i])) return true;
  return false;
}

/* An SVG transform attribute as a CSS transform: the same functions, with units. */
function _lhCssTransform(t) {
  if (!t) return '';
  const out = [];
  t.replace(/([a-zA-Z]+)\s*\(([^)]*)\)/g, (m, fn, args) => {
    const a = args.trim().split(/[\s,]+/).map(Number);
    if (fn === 'translate') out.push(`translate(${a[0]}px,${a[1] || 0}px)`);
    else if (fn === 'scale') out.push(`scale(${a[0]},${a.length > 1 ? a[1] : a[0]})`);
    else if (fn === 'rotate') out.push(a.length > 2
      ? `translate(${a[1]}px,${a[2]}px) rotate(${a[0]}deg) translate(${-a[1]}px,${-a[2]}px)`
      : `rotate(${a[0]}deg)`);
    else if (fn === 'skewX' || fn === 'skewY') out.push(`${fn}(${a[0]}deg)`);
    else if (fn === 'matrix') out.push(`matrix(${a.join(',')})`);
    return '';
  });
  return out.join(' ');
}

function _lhAttrs(el, inh) {
  const next = Object.assign({}, inh);
  LH_INHERIT.forEach(a => { const v = el.getAttribute(a); if (v !== null) next[a] = v; });
  return next;
}

function _lhRun(inh) {
  const s = document.createElementNS(LH_SVGNS, 'svg');
  s.setAttribute('class', 'lh-s');
  s.setAttribute('width', '1');
  s.setAttribute('height', '1');
  s.setAttribute('overflow', 'visible');
  s.setAttribute('aria-hidden', 'true');
  Object.keys(inh).forEach(a => s.setAttribute(a, inh[a]));
  return s;
}

function _lhEmit(node, into, inh) {
  let run = null;
  Array.from(node.children).forEach(k => {
    if (!_lhHasMover(k)) {
      if (!run) { run = _lhRun(inh); into.appendChild(run); }
      run.appendChild(k);
      return;
    }
    run = null;
    const layer = document.createElement('div');
    layer.className = 'lh-l' + (k.getAttribute('class') ? ' ' + k.getAttribute('class') : '');
    const style = k.getAttribute('style');
    if (style) layer.style.cssText = style;
    const tf = _lhCssTransform(k.getAttribute('transform'));
    if (tf) layer.style.transform = tf;
    const op = k.getAttribute('opacity');
    if (op !== null) layer.style.opacity = op;
    into.appendChild(layer);
    if (k.tagName.toLowerCase() === 'g') {
      _lhEmit(k, layer, _lhAttrs(k, inh));
    } else {
      // A moving shape: drawn as it was, in its own little svg.
      ['class', 'style', 'transform', 'opacity'].forEach(a => k.removeAttribute(a));
      const s = _lhRun(inh);
      s.appendChild(k);
      layer.appendChild(s);
    }
  });
}

function _lhLift(svg) {
  const w = svg.width.baseVal.value, h = svg.height.baseVal.value;
  const vb = svg.viewBox && svg.viewBox.baseVal;
  const host = document.createElement('div');
  host.className = 'lh-lift ' + (svg.getAttribute('class') || '');
  host.style.width = w + 'px';
  host.style.height = h + 'px';
  if (getComputedStyle(svg).position === 'static') host.style.position = 'relative';
  const view = document.createElement('div');
  view.className = 'lh-view';
  if (vb && vb.width && vb.height && (vb.width !== w || vb.height !== h || vb.x || vb.y)) {
    view.style.transform = `scale(${w / vb.width},${h / vb.height}) translate(${-vb.x}px,${-vb.y}px)`;
  }
  host.appendChild(view);
  _lhEmit(svg, view, _lhAttrs(svg, {}));
  svg.replaceWith(host);
}

/* ── Drawing helpers ─────────────────────────────────────────── */

/* A group placed at (x,y) whose inner group is the one that animates. */
function _lhAt(x, y, inner, cls, extra) {
  return `<g transform="translate(${x},${y})"><g${cls ? ` class="${cls}"` : ''}${extra ? ' ' + extra : ''}>${inner}</g></g>`;
}

function _lhSvg(inner) {
  return `<svg class="lh-svg" viewBox="0 0 200 150" width="200" height="150" focusable="false">${inner}</svg>`;
}

/* A four-point sparkle of radius r. */
function _lhStar(r, fill) {
  const a = (r * 0.28).toFixed(2);
  return `<path d="M0,${-r} L${a},${-a} ${r},0 ${a},${a} 0,${r} ${-a},${a} ${-r},0 ${-a},${-a}Z" fill="${fill}"/>`;
}

const LH_BACK = {
  short: 'M-18.5,6 C-21,-12 -12,-23.5 0,-23.5 C12,-23.5 21,-12 18.5,6 C17,12 14,14 12,13 L-12,13 C-14,14 -17,12 -18.5,6Z',
  bob: 'M-19.5,4 C-22,-12 -12,-24 0,-24 C12,-24 22,-12 19.5,4 L20.5,17 Q16,19.5 13.5,15 L-13.5,15 Q-16,19.5 -20.5,17Z',
  long: 'M-19.5,4 C-22,-12 -12,-24 0,-24 C12,-24 22,-12 19.5,4 L22.5,36 Q15,39 12,31 L-12,31 Q-15,39 -22.5,36Z',
};
const LH_FRONT = {
  spiky: 'M-17.6,3 C-19.5,-13 -10.5,-23 0,-23 C10.5,-23 19.5,-13 17.6,3 L14.6,-6 L12.4,-1 L10.2,-8 L8.2,-3.2 L5.6,-9.5 L3,-4.5 L0.4,-10 L-2.4,-4.6 L-5.2,-9.4 L-7.8,-3.4 L-10.4,-8 L-12.6,-1 L-14.8,-6Z',
  soft: 'M-17.8,4 C-19.6,-13 -10.5,-23.2 0,-23.2 C10.5,-23.2 19.6,-13 17.8,4 Q16.5,-2 14.5,-3 Q12.5,-6.5 10,-3.6 Q8,-7.5 5,-4.2 Q2.5,-8 0,-4.4 Q-2.5,-8 -5,-4.2 Q-8,-7.5 -10,-3.6 Q-12.5,-6.5 -14.5,-3 Q-16.5,-2 -17.8,4Z',
};

/* One anime eye at (0,0). side: -1 the viewer's left eye, 1 the right. */
function _lhEye(kind, iris, side) {
  const ink = LH_INK;
  if (kind === 'closed') return `<path d="M-3.1,-.2 Q0,2.5 3.1,-.2" stroke="${ink}" stroke-width="1.25" fill="none" stroke-linecap="round"/>`;
  if (kind === 'happy') return `<path d="M-3,1.3 Q0,-2.3 3,1.3" stroke="${ink}" stroke-width="1.3" fill="none" stroke-linecap="round"/>`;
  const lid = kind === 'focus' ? -1.7 : kind === 'down' ? 0.2 : null;
  const iy = kind === 'up' ? -0.9 : 0;
  let s = `<ellipse cy="${iy}" rx="2.9" ry="3.8" fill="${iris}"/>` +
    `<ellipse cy="${iy + 0.9}" rx="1.6" ry="2.2" fill="${ink}" opacity=".5"/>` +
    `<circle cx="-1" cy="${iy - 1.4}" r="1.05" fill="#fff"/>` +
    `<circle cx="1.1" cy="${iy + 1.6}" r=".5" fill="#fff" opacity=".85"/>`;
  if (kind === 'sparkle') s += '<path d="M1.3,-2.9 l.5,1.2 1.2,.5 -1.2,.5 -.5,1.2 -.5,-1.2 -1.2,-.5 1.2,-.5Z" fill="#fff"/>';
  if (lid !== null) {
    s += `<path d="M-4,-5 L4,-5 L4,${lid + 0.2} Q0,${lid - 1} -4,${lid + 0.4}Z" fill="${LH_SKIN}"/>` +
      `<path d="M-3.9,${lid + 0.4} Q0,${lid - 1} 3.9,${lid + 0.2}" stroke="${ink}" stroke-width="1.35" fill="none" stroke-linecap="round"/>`;
  } else {
    s += `<path d="M-3.7,-2.7 Q0,-5.5 3.7,-2.9" stroke="${ink}" stroke-width="1.35" fill="none" stroke-linecap="round"/>`;
  }
  return s + `<path d="M${side * 3.4},${lid === null ? -3 : lid} l${side * 1.4},-1" stroke="${ink}" stroke-width=".9" stroke-linecap="round"/>`;
}

function _lhMouth(kind) {
  switch (kind) {
    case 'grin': return `<path d="M-2.7,-.6 Q0,3.8 2.7,-.6Z" fill="${LH_LIP}"/><path d="M-1.4,1.3 Q0,2.5 1.4,1.3Z" fill="#f47a8c"/>`;
    case 'o': return `<ellipse rx="1.5" ry="1.9" fill="${LH_LIP}"/>`;
    case 'sing': return `<ellipse rx="2.3" ry="2.7" fill="${LH_LIP}"/><ellipse cy="1.3" rx="1.4" ry=".9" fill="#f47a8c"/>`;
    case 'grit': return `<path d="M-2.5,-.8 L2.5,-.8 L1.9,1.3 L-1.9,1.3Z" fill="#fff" stroke="${LH_LIP}" stroke-width=".7" stroke-linejoin="round"/>`;
    case 'flat': return `<path d="M-1.6,.3 L1.6,0" stroke="${LH_LIP}" stroke-width="1" stroke-linecap="round"/>`;
    case 'cat': return `<path d="M-2.4,-.2 Q-1.2,1.4 0,0 Q1.2,1.4 2.4,-.2" stroke="${LH_LIP}" stroke-width="1" fill="none" stroke-linecap="round"/>`;
    default: return `<path d="M-2.2,-.2 Q0,1.9 2.2,-.2" stroke="${LH_LIP}" stroke-width="1" fill="none" stroke-linecap="round"/>`;
  }
}

/* Eyes, mouth and blush. o.look (-1..1) slides them toward where the head
   is turned. Eyes that are open blink. */
function _lhFace(o) {
  const lx = (o.look || 0) * 3, iris = o.iris || '#4f46e5', kind = o.eyes || 'open';
  const blink = o.blink !== false && kind !== 'closed' && kind !== 'happy';
  const eye = side => _lhAt(side * 6.3 + lx, 3.2, _lhEye(kind, iris, side), blink ? 'lh-blink' : '');
  return `<ellipse cx="${-9.4 + lx * 0.6}" cy="9" rx="2.7" ry="1.3" fill="#ff7a93" opacity=".42"/>` +
    `<ellipse cx="${9.4 + lx * 0.6}" cy="9" rx="2.7" ry="1.3" fill="#ff7a93" opacity=".42"/>` +
    eye(-1) + eye(1) + _lhAt(lx * 0.8, 11.8, _lhMouth(o.mouth), o.mouthCls || '');
}

/* A chibi head centred at (0,0): about 40 wide and 47 tall with its hair.
   o.face may be markup to draw in place of the usual face (face variants
   that cross-fade). o.under goes behind the hair, o.over on top of it. */
function _lhHead(o) {
  o = o || {};
  const hair = o.hair || '#2b2f66';
  const style = o.style || 'spiky';
  const lx = (o.look || 0) * 3;
  let s = (o.under || '') +
    `<path d="${LH_BACK[o.back || (style === 'spiky' ? 'short' : 'bob')]}" fill="${hair}"/>` +
    `<path d="M-15.5,-3 C-15.8,8 -8,17.5 0,18.5 C8,17.5 15.8,8 15.5,-3 C15,-14 8,-19.5 0,-19.5 C-8,-19.5 -15,-14 -15.5,-3Z" fill="${LH_SKIN}"/>`;
  s += typeof o.face === 'string' ? o.face : _lhFace(o);
  if (o.glasses) {
    s += `<circle cx="${-6.3 + lx}" cy="3.4" r="4.4" fill="#fff" fill-opacity=".12" stroke="${o.glasses}" stroke-width=".9"/>` +
      `<circle cx="${6.3 + lx}" cy="3.4" r="4.4" fill="#fff" fill-opacity=".12" stroke="${o.glasses}" stroke-width=".9"/>` +
      `<path d="M${-1.9 + lx},3 Q${lx},2 ${1.9 + lx},3" stroke="${o.glasses}" stroke-width=".8" fill="none"/>`;
  }
  s += `<path d="${LH_FRONT[style]}" fill="${hair}"/>`;
  if (style === 'soft') {
    s += `<path d="M-17.8,0 Q-19,10 -15.6,18 Q-14.6,9 -14.4,1Z" fill="${hair}"/><path d="M17.8,0 Q19,10 15.6,18 Q14.6,9 14.4,1Z" fill="${hair}"/>`;
  }
  if (o.ahoge) s += `<path d="M.5,-22.5 C2,-29 7.5,-31 9.5,-28 C6.5,-28.6 3.6,-27 2.8,-22.5Z" fill="${hair}"/>`;
  s += '<path d="M-10,-15.5 Q-4,-20.5 3,-20" stroke="#fff" stroke-opacity=".35" stroke-width="1.5" fill="none" stroke-linecap="round"/>';
  return s + (o.over || '');
}

/* A small whole character, feet at (0,0), about 46 tall. o.legA / o.legB
   animate the legs about the hips; o.downCls / o.upCls give two arm poses
   to cross-fade (o.upOn: the raised pair is the still pose). */
function _lhMini(o) {
  const out = o.outfit || '#38bdf8', sh = o.shade || out, pants = o.pants || '#334155';
  const leg = (x, cls) => _lhAt(x, -8.5, `<path d="M0,0 L0,7" stroke="${pants}" stroke-width="3.6" stroke-linecap="round"/><ellipse cx=".9" cy="8.2" rx="2.6" ry="1.4" fill="#f8fafc"/>`, cls || '');
  const arm = (x1, y1, x2, y2, skin) => `<path d="M${x1},${y1} L${x2},${y2}" stroke="${sh}" stroke-width="3.2" stroke-linecap="round"/><circle cx="${x2 + (x2 > 0 ? 0.3 : -0.3)}" cy="${y2 + (y2 > y1 ? 1 : -1.4)}" r="1.9" fill="${skin}"/>`;
  const down = arm(-6.6, -18, -9.4, -10, LH_SKIN_SH) + arm(6.6, -18, 9.4, -10, LH_SKIN);
  const up = arm(-6.6, -18, -10.6, -26.5, LH_SKIN_SH) + arm(6.6, -18, 10.6, -26.5, LH_SKIN);
  const arms = o.upCls
    ? `<g class="${o.downCls}" opacity="${o.upOn ? 0 : 1}">${down}</g><g class="${o.upCls}" opacity="${o.upOn ? 1 : 0}">${up}</g>`
    : down;
  return (o.behind || '') + leg(-2.8, o.legA) + leg(2.8, o.legB) +
    `<path d="M-7,-19.5 Q0,-23 7,-19.5 L8,-7.5 Q0,-5.5 -8,-7.5Z" fill="${out}"/>` + arms +
    _lhAt(0, -31.5, `<g transform="scale(.62)">${_lhHead(o)}</g>`, o.headCls || '');
}

/* ── The scenes ─────────────────────────────────────────────────
   200 x 150, the floor of the projection at about y 140. */
const LIB_HOLO_SCENES = {

  /* Coding Library: a coder on an office chair typing hard; the monitor
     types C with syntax colours, and Japanese erupts out of it like a
     volcano, each word on its own arc. */
  coding() {
    const hoodie = '#fb7185', hoodieSh = '#e0566e', jeans = '#3b4a6b';
    const code = [
      [117, 43, 58, '<tspan fill="#f472b6">#include</tspan> <tspan fill="#86efac">&lt;stdio.h&gt;</tspan>'],
      [117, 50.2, 52, '<tspan fill="#c084fc">int</tspan> <tspan fill="#60a5fa">main</tspan>(<tspan fill="#c084fc">void</tspan>) {'],
      [123.5, 57.4, 36, '<tspan fill="#c084fc">int</tspan> n = <tspan fill="#fdba74">42</tspan>;'],
      [123.5, 64.6, 36, '<tspan fill="#c084fc">while</tspan> (n--)'],
      [130, 71.8, 51, '<tspan fill="#60a5fa">puts</tspan>(<tspan fill="#86efac">"がんばれ"</tspan>);'],
      [123.5, 79, 30, '<tspan fill="#c084fc">return</tspan> <tspan fill="#fdba74">0</tspan>;'],
      [117, 86.2, 4, '}'],
    ];
    // Each line hides under its own cover, which shrinks toward the line's
    // end to type it out; the attribute leaves it open for the still pose.
    const lines = code.map(([x, y, w, html], i) =>
      `<text x="${x}" y="${y}" class="lh-mono" font-size="5.4" fill="#cbd5e1">${html}</text>` +
      _lhAt(x + w + 1.5, y - 5.3, `<rect x="${-(w + 3)}" width="${w + 3}" height="7.1" fill="#0b1022"/>`, `lhc-cov lhc-l${i}`, 'transform="scale(0,1)"')
    ).join('');
    // text, colour, size, dx, apex dy, landing dy, spin, seconds, delay, still [x, y, opacity]
    const jp = [
      ['コード', '#22d3ee', 9, -98, -50, 58, -40, 2.3, 0, [-46, -40, 1]],
      ['関数', '#fde047', 10, 52, -38, 60, 30, 1.9, 0.35, [28, -32, 1]],
      ['変数', '#f472b6', 9.5, -62, -64, 66, -25, 2.5, 0.7, [-14, -60, 1]],
      ['ポインタ', '#86efac', 8, 34, -60, 62, 20, 2.2, 1.05, [0, 0, 0]],
      ['メモリ', '#fdba74', 8.5, -124, -36, 50, -50, 2.4, 1.4, [0, 0, 0]],
      ['バグ!?', '#f87171', 9, 64, -26, 56, 45, 1.8, 1.7, [0, 0, 0]],
      ['完成!', '#c4b5fd', 10, -28, -72, 70, -15, 2.6, 1.95, [0, 0, 0]],
      ['ループ', '#7dd3fc', 8.5, -86, -66, 64, -30, 2.3, 0.55, [0, 0, 0]],
    ].map(([t, c, fs, dx, h, f, r, dur, d, st]) => {
      const tm = `animation-duration:${dur}s;animation-delay:${d}s`;
      return _lhAt(150, 30,
        `<g class="lhc-jy" style="--h:${h}px;--f:${f}px;--r:${r}deg;${tm}" transform="translate(0,${st[1]}) rotate(${Math.round(r * 0.3)})" opacity="${st[2]}">` +
        `<text class="lh-jp" font-size="${fs}" fill="${c}" text-anchor="middle" dominant-baseline="central" stroke="#0f172a" stroke-width="2" stroke-linejoin="round" paint-order="stroke">${t}</text></g>`,
        'lhc-jx', `style="--dx:${dx}px;${tm}" transform="translate(${st[0]},0)"`);
    }).join('');
    const head = _lhHead({
      hair: '#272a5c', iris: '#6366f1', style: 'spiky', look: 0.75, eyes: 'focus', mouth: 'grit', ahoge: true,
      over: '<path d="M-19.5,1 C-21,-24 21,-24 19.5,1" stroke="#334155" stroke-width="3" fill="none" stroke-linecap="round"/>' +
        '<rect x="-23" y="-5" width="7.5" height="13" rx="3.4" fill="#6366f1"/><rect x="-21.4" y="-3" width="3" height="9" rx="1.5" fill="#a5b4fc"/>',
    });
    return _lhSvg(
      '<ellipse cx="150" cy="62" rx="54" ry="42" fill="#6366f1" opacity=".2"/>' +
      // desk, monitor, code
      '<rect x="98" y="105" width="98" height="5" rx="2.5" fill="#64748b"/>' +
      '<rect x="104" y="110" width="4" height="27" rx="1" fill="#475569"/><rect x="186" y="110" width="4" height="27" rx="1" fill="#475569"/>' +
      '<rect x="146" y="92" width="8" height="10" fill="#475569"/><rect x="136" y="101" width="28" height="4" rx="2" fill="#64748b"/>' +
      '<rect x="110" y="30" width="80" height="63" rx="5" fill="#1e293b" stroke="#94a3b8" stroke-width="1"/>' +
      '<rect x="114" y="34" width="72" height="55" rx="2" fill="#0b1022"/>' +
      lines +
      '<rect x="173" y="96" width="9" height="9" rx="2" fill="#e0e7ff"/><path d="M182,98.5 q3.6,1.2 0,4.6" stroke="#e0e7ff" stroke-width="1.4" fill="none"/>' +
      '<rect x="85" y="101.5" width="37" height="4" rx="1.4" fill="#cbd5e1"/><path d="M88,103.5 H119" stroke="#94a3b8" stroke-width=".9" stroke-dasharray="2 1.1"/>' +
      // chair
      '<rect x="24" y="60" width="20" height="42" rx="8" fill="#3b3b5c"/><rect x="31" y="98" width="6" height="6" fill="#3b3b5c"/>' +
      '<rect x="30" y="99" width="44" height="6" rx="3" fill="#4c4c70"/><rect x="49" y="105" width="5" height="16" fill="#52525b"/>' +
      '<path d="M33,128 L51.5,121 L70,128" stroke="#52525b" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="33" cy="130" r="2.6" fill="#27272a"/><circle cx="70" cy="130" r="2.6" fill="#27272a"/><circle cx="51.5" cy="131.5" r="2.6" fill="#27272a"/>' +
      // far arm, behind the body
      `<path d="M64,73 L78,88" stroke="${hoodieSh}" stroke-width="6.5" stroke-linecap="round"/>` +
      _lhAt(78, 88, `<path d="M0,0 L22,12" stroke="${hoodieSh}" stroke-width="6" stroke-linecap="round"/><circle cx="23.6" cy="12.8" r="3" fill="${LH_SKIN_SH}"/>`, 'lhc-fore', 'style="animation-delay:-.065s"') +
      // legs, body, head
      `<path d="M40,92 L74,93 Q80,94 79,101 L42,101 Q37,99 40,92Z" fill="${jeans}"/>` +
      `<path d="M72,97 L79.5,97 L80.5,121 L73,121Z" fill="${jeans}"/>` +
      '<path d="M71,119.5 L81.5,119.5 Q87,120.5 87,125.5 L71,125.5Z" fill="#f8fafc"/>' +
      `<rect x="54.5" y="60" width="6" height="9" rx="2" fill="${LH_SKIN_SH}"/>` +
      `<path d="M40,70 Q53,62 66,68 L73,94 Q57,99 40,95Z" fill="${hoodie}"/>` +
      `<path d="M44,70 Q49,62 57.5,63 L55.5,70Z" fill="${hoodieSh}"/>` +
      '<path d="M61,70 l1.2,8 M64.4,69.5 l1.8,7.6" stroke="#fff" stroke-width=".9" stroke-linecap="round"/>' +
      _lhAt(58, 45, head, 'lhc-head') +
      // near arm
      `<path d="M55,75 L68,90" stroke="${hoodie}" stroke-width="7" stroke-linecap="round"/>` +
      _lhAt(68, 90, `<path d="M0,0 L21,10" stroke="${hoodie}" stroke-width="6.2" stroke-linecap="round"/><circle cx="22.8" cy="10.8" r="3.1" fill="${LH_SKIN}"/>`, 'lhc-fore') +
      // effort: impact ticks, a sweat drop, the vent the words come out of
      '<g class="lhc-hit"><path d="M86,95 l-2.6,-3 M91.5,93 l.2,-3.8 M106,95 l2.4,-3" stroke="#fde047" stroke-width="1.1" stroke-linecap="round"/></g>' +
      '<g class="lhc-hit lhc-hit-b"><path d="M83,99 l-3.6,-.6 M98,93.5 l1,-3.6 M110.5,97.5 l3.6,-1.6" stroke="#fde047" stroke-width="1.1" stroke-linecap="round"/></g>' +
      _lhAt(77, 35, '<path d="M0,-3 Q2.4,.6 0,2.6 Q-2.4,.6 0,-3Z" fill="#7dd3fc"/>', 'lhc-sweat', 'opacity="0"') +
      _lhAt(150, 31, '<ellipse rx="11" ry="3" fill="#a5b4fc"/>', 'lhc-vent', 'opacity="0"') +
      jp
    );
  },

  /* Notes Library: a girl with glasses, hand on her chin, watching her
     answers grade themselves -- tiles flip to green or red, one by one. */
  study() {
    const res = [1, 1, 0, 1, 1, 1, 0, 1, 1];
    const lab = ['A', 'C', 'B', 'D', 'A', 'B', 'C', 'D', 'A'];
    const tiles = res.map((ok, k) => {
      const face = ok
        ? '<rect x="-12" y="-10" width="24" height="20" rx="4" fill="#16a34a" stroke="#86efac" stroke-width=".9"/><path d="M-4.6,.2 L-1.4,3.4 L4.8,-3.4" stroke="#fff" stroke-width="2.1" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
        : '<rect x="-12" y="-10" width="24" height="20" rx="4" fill="#dc2626" stroke="#fca5a5" stroke-width=".9"/><path d="M-3.6,-3.6 L3.6,3.6 M3.6,-3.6 L-3.6,3.6" stroke="#fff" stroke-width="2.1" stroke-linecap="round"/>';
      return _lhAt(110 + (k % 3) * 28, 46 + Math.floor(k / 3) * 26,
        '<rect x="-12" y="-10" width="24" height="20" rx="4" fill="#334155" stroke="#94a3b8" stroke-width=".8"/>' +
        `<text y="3" font-size="8.5" font-weight="800" text-anchor="middle" fill="#e2e8f0">${lab[k]}</text>` +
        `<g class="lhn-res" style="--i:${k}">${face}</g>`, 'lhn-flip', `style="--i:${k}"`);
    }).join('');
    const amber = '#f59e0b', amberSh = '#d97706';
    const mark = (t, c) => `<text font-size="11" font-weight="900" text-anchor="middle" dominant-baseline="central" fill="${c}">${t}</text>`;
    return _lhSvg(
      '<rect x="94" y="32" width="88" height="80" rx="9" fill="#f59e0b" fill-opacity=".08" stroke="#f59e0b" stroke-opacity=".4"/>' +
      tiles +
      _lhAt(138, 21, '<rect x="-18" y="-7" width="36" height="13" rx="6.5" fill="#f59e0b"/><text y="2.8" font-size="7.4" font-weight="800" text-anchor="middle" fill="#1f1300">7 / 9 ★</text>', 'lhn-score') +
      // thought bubble
      '<circle cx="27.5" cy="30.5" r="1.5" fill="#fde68a" opacity=".85"/><circle cx="24" cy="25" r="2.2" fill="#fde68a" opacity=".85"/>' +
      '<ellipse cx="16" cy="13" rx="11" ry="8.5" fill="#fde68a" opacity=".92"/>' +
      _lhAt(16, 13, mark('?', '#92400e'), 'lhn-q') + _lhAt(16, 13, mark('!', '#15803d'), 'lhn-ex', 'opacity="0"') +
      // the arm with the notebook
      `<path d="M34,76 L28,94" stroke="${amberSh}" stroke-width="6" stroke-linecap="round"/>` +
      '<g transform="rotate(-8 25 95)"><rect x="17" y="85" width="15" height="19" rx="1.6" fill="#fde68a" stroke="#b45309" stroke-width=".9"/><path d="M20,90 h9 M20,93.5 h9 M20,97 h6" stroke="#d97706" stroke-width=".7"/></g>' +
      `<circle cx="29" cy="95" r="3" fill="${LH_SKIN}"/>` +
      // legs, skirt, body
      `<rect x="37" y="113" width="6.5" height="19" rx="3" fill="${LH_SKIN}"/><rect x="50" y="113" width="6.5" height="19" rx="3" fill="${LH_SKIN}"/>` +
      '<path d="M35,130 h9.5 v4.5 h-11 Q33.5,131 35,130Z" fill="#292524"/><path d="M48.5,130 h9.5 v4.5 h-11 Q47,131 48.5,130Z" fill="#292524"/>' +
      '<path d="M33,100 L61,100 L66,117 L28,117Z" fill="#57534e"/>' +
      `<rect x="43.5" y="62" width="6" height="9" rx="2" fill="${LH_SKIN_SH}"/>` +
      `<path d="M33,72 Q46.5,65 60,72 L63,103 Q46.5,107 30,103Z" fill="${amber}"/>` +
      '<path d="M43.5,70.5 L46.5,84 L49.5,70.5Z" fill="#fff7ed"/><path d="M46.5,84 V102" stroke="#b45309" stroke-width=".8"/>' +
      '<circle cx="44.6" cy="89" r=".9" fill="#78350f"/><circle cx="44.6" cy="95" r=".9" fill="#78350f"/>' +
      _lhAt(46.5, 47, _lhHead({ hair: '#7a4a2c', iris: '#b45309', style: 'soft', look: 0.7, glasses: '#78350f', mouth: 'cat' }), 'lhn-head') +
      // hand on her chin
      `<path d="M58,75 L64,93 L57.5,69.5" stroke="${amber}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>` +
      `<circle cx="57" cy="67.6" r="3.1" fill="${LH_SKIN}"/>`
    );
  },

  /* Snippet Library: someone dragging hologram tiles into the slots of a
     curved rack. The arm turns about the shoulder; the tile it carries
     turns back the other way, so it stays upright. */
  snippets() {
    const jacket = '#a78bfa', jacketSh = '#8b6fe8';
    const tile = l => '<rect x="-12" y="-7.5" width="24" height="15" rx="3" fill="#0e7490" fill-opacity=".6" stroke="#67e8f9" stroke-width="1"/>' +
      `<text class="lh-mono" y="2.4" font-size="6.6" font-weight="700" text-anchor="middle" fill="#ecfeff">${l}</text>`;
    const labels = ['{ }', 'fn()', '&lt;/&gt;'];
    // On a circle of radius 58 round the shoulder (56,74), at -48, -18 and 12 degrees.
    const slots = [[94.8, 30.9], [111.2, 56.1], [112.7, 86.1]];
    const slotBox = '<rect x="-13.5" y="-9" width="27" height="18" rx="3.5" fill="#083344" fill-opacity=".45" stroke="#22d3ee" stroke-opacity=".75" stroke-dasharray="2.5 2"/>';
    const rack = 'M83.2,22.8 A58,58 0 0 1 108.1,99.4';
    const arm = `<path d="M0,0 L35,0" stroke="${jacket}" stroke-width="6.4" stroke-linecap="round"/>` +
      '<rect x="30" y="-3.3" width="4.5" height="6.6" rx="1" fill="#22d3ee" opacity=".85"/>' +
      `<circle cx="38" cy="0" r="3.4" fill="${LH_SKIN}"/>` +
      `<path d="M39.5,-2.4 l3.4,-1.4 M40.6,0 l3.8,0 M39.5,2.4 l3.4,1.4" stroke="${LH_SKIN}" stroke-width="1.5" stroke-linecap="round"/>` +
      '<path d="M44.6,0 H46.4" stroke="#a5f3fc" stroke-width="1.2"/>' +
      _lhAt(58, 0, labels.map((l, i) => `<g class="lhs-c lhs-c${i + 1}" opacity="${i === 1 ? 1 : 0}">${tile(l)}</g>`).join(''), 'lhs-carry', 'transform="rotate(18)"');
    return _lhSvg(
      `<path d="${rack}" stroke="#06b6d4" stroke-opacity=".14" stroke-width="28" fill="none" stroke-linecap="round"/>` +
      `<path class="lhs-rack" d="${rack}" stroke="#67e8f9" stroke-width="28" fill="none" stroke-linecap="round" opacity="0"/>` +
      slots.map(([x, y]) => _lhAt(x, y, slotBox)).join('') +
      // the tray the tiles come from
      '<ellipse cx="74" cy="137" rx="18" ry="3.8" fill="#22d3ee" opacity=".35"/>' +
      _lhAt(74, 133, tile(''), '', 'opacity=".25"') +
      slots.map(([x, y], i) => _lhAt(x, y, tile(labels[i]), `lhs-p lhs-p${i + 1}`, `opacity="${i === 1 ? 0 : 1}"`)).join('') +
      // legs, back arm, ponytail, body, head
      '<path d="M37,104 L45,104 L44,132 L37,132Z" fill="#475569"/><path d="M48,104 L56,104 L58,132 L51,132Z" fill="#475569"/>' +
      '<path d="M35,131 h10 q2.2,0 2.2,3.5 h-12.2Z" fill="#e2e8f0"/><path d="M50,131 h10 q2.6,0 2.6,3.5 h-12.6Z" fill="#e2e8f0"/>' +
      `<path d="M38,76 L30,92 L33,103" stroke="${jacketSh}" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="33" cy="105" r="3" fill="${LH_SKIN_SH}"/>` +
      _lhAt(31, 36, '<path d="M0,0 C-9,3 -13,15 -9,28 C-5,19 -1,11 5,5Z" fill="#0f3b4c"/><circle cx="1.5" cy="2" r="2.2" fill="#22d3ee"/>', 'lhs-tail') +
      `<rect x="43" y="59" width="6" height="9" rx="2" fill="${LH_SKIN_SH}"/>` +
      `<path d="M35,70 Q46,63 58,69 L60,104 Q46,108 33,104Z" fill="${jacket}"/>` +
      '<path d="M47,68 V104" stroke="#22d3ee" stroke-width="1.1" opacity=".9"/>' +
      _lhAt(46, 43, _lhHead({ hair: '#0f3b4c', iris: '#0891b2', style: 'soft', back: 'short', look: 0.6 }), 'lh-breathe') +
      _lhAt(56, 74, arm, 'lhs-arm', 'transform="rotate(-18)"')
    );
  },

  /* Memorization Typing: a ghost word typed over letter by letter, keys
     lighting under the fingers, a speed gauge swinging up. */
  typing() {
    const hood = '#38bdf8', hoodSh = '#0ea5e9';
    const letters = [...'remember'].map((ch, k) => {
      const x = (114 + k * 9.6).toFixed(1);
      return `<text x="${x}" y="40" text-anchor="middle" class="lh-mono" font-size="12" font-weight="700" fill="#e2e8f0" opacity=".22">${ch}</text>` +
        `<text x="${x}" y="40" text-anchor="middle" class="lh-mono lht-ch" style="--i:${k}" font-size="12" font-weight="700" fill="#fde047">${ch}</text>`;
    }).join('');
    const lit = { 2: [0.9, 0.1], 5: [1.3, 0.5], 8: [0.7, 0.25], 11: [1.1, 0.7], 14: [1.5, 0.05], 16: [0.8, 0.4], 19: [1.2, 0.85] };
    let keys = '';
    for (let k = 0; k < 20; k++) {
      const row = k < 10 ? 0 : 1, c = k % 10;
      const x = row ? 27 + c * 7.6 : 32 + c * 7, y = row ? 112.5 : 106, w = row ? 6.6 : 6, hgt = row ? 4.8 : 4.4;
      keys += `<rect x="${x.toFixed(1)}" y="${y}" width="${w}" height="${hgt}" rx="1" fill="#475569"/>`;
      if (lit[k]) keys += `<rect class="lht-key" x="${x.toFixed(1)}" y="${y}" width="${w}" height="${hgt}" rx="1" fill="#fde047" opacity="0" style="animation-duration:${lit[k][0]}s;animation-delay:${lit[k][1]}s"/>`;
    }
    const head = _lhHead({
      hair: '#1f2937', iris: '#d97706', style: 'spiky', ahoge: true, eyes: 'focus',
      over: '<path d="M10.5,-14.5 l1.2,2.6 2.8,.3 -2.1,1.9 .6,2.8 -2.5,-1.4 -2.5,1.4 .6,-2.8 -2.1,-1.9 2.8,-.3Z" fill="#fde047"/>',
    });
    return _lhSvg(
      '<rect x="104" y="20" width="88" height="30" rx="7" fill="#0f172a" fill-opacity=".72" stroke="#e2b714" stroke-opacity=".7"/>' +
      letters +
      _lhAt(109.2, 0, '<rect x="-.8" y="29.5" width="1.6" height="13" rx=".8" fill="#fde047"/>', 'lht-caret', 'transform="translate(76.8,0)"') +
      _lhAt(186, 17, '<circle r="7" fill="#e2b714"/><path d="M-3,0 L-1,2.4 L3.2,-2.4" stroke="#1f1300" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>', 'lht-ok') +
      // the gauge
      '<path d="M130,98 A26,26 0 0 1 182,98" stroke="#334155" stroke-width="5" fill="none" stroke-linecap="round"/>' +
      '<path d="M130,98 A26,26 0 0 1 182,98" stroke="#e2b714" stroke-width="5" fill="none" stroke-linecap="round" stroke-dasharray="64 100" opacity=".85"/>' +
      _lhAt(156, 98, '<path d="M0,-1.9 L-23,0 L0,1.9Z" fill="#fde047"/><circle r="3.4" fill="#e2b714"/><circle r="1.3" fill="#1e293b"/>', 'lht-needle', 'transform="rotate(146)"') +
      '<text x="156" y="114" font-size="10" font-weight="900" text-anchor="middle" fill="#fde047" class="lh-mono">96</text>' +
      '<text x="156" y="121.5" font-size="5.2" font-weight="700" text-anchor="middle" fill="#cbd5e1" letter-spacing=".8">WPM</text>' +
      // the typist
      `<rect x="63" y="64" width="6" height="9" rx="2" fill="${LH_SKIN_SH}"/>` +
      `<path d="M48,75 Q66,67 84,75 L88,108 L44,108Z" fill="${hood}"/>` +
      `<path d="M60,72 Q66,77 72,72" stroke="${hoodSh}" stroke-width="1.6" fill="none"/>` +
      _lhAt(66, 48, head, 'lht-head') +
      `<path d="M50,79 Q41,92 49,103" stroke="${hoodSh}" stroke-width="6.2" fill="none" stroke-linecap="round"/>` +
      `<path d="M82,79 Q91,92 83,103" stroke="${hoodSh}" stroke-width="6.2" fill="none" stroke-linecap="round"/>` +
      '<path d="M28,103 L104,103 L112,121 L20,121Z" fill="#1e293b" stroke="#e2b714" stroke-opacity=".55" stroke-width="1"/>' +
      keys +
      _lhAt(50, 104, `<circle r="3.2" fill="${LH_SKIN}"/>`, 'lht-hand') +
      _lhAt(82, 104, `<circle r="3.2" fill="${LH_SKIN}"/>`, 'lht-hand', 'style="animation-delay:-.14s"')
    );
  },

  /* Cheat Sheet Library: a character materialises first, then status
     windows open one by one around them on a slowly turning cylinder. Real
     3D (HTML, not SVG), so the windows pass behind them. */
  cheatsheet() {
    const head = _lhHead({ hair: '#155e75', iris: '#06b6d4', style: 'spiky', ahoge: true });
    const char = '<svg class="lhx-svg" viewBox="0 0 80 100" width="80" height="100" focusable="false">' +
      '<rect x="31" y="88" width="7" height="9" fill="#1e293b"/><rect x="42" y="88" width="7" height="9" fill="#1e293b"/>' +
      '<path d="M29,96 h10 v3.5 h-11.5Z" fill="#0f172a"/><path d="M41,96 h10 q1.5,0 1.5,3.5 h-11.5Z" fill="#0f172a"/>' +
      `<path d="M28,58 L21,75 L23,83" stroke="#e2e8f0" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="23.5" cy="84.5" r="2.9" fill="${LH_SKIN_SH}"/>` +
      `<rect x="37" y="44" width="6" height="9" rx="2" fill="${LH_SKIN_SH}"/>` +
      '<path d="M26,53 Q40,46 54,53 L60,91 Q40,94 20,91Z" fill="#f1f5f9"/>' +
      '<path d="M35.5,51.5 L40,68 L44.5,51.5Z" fill="#0e7490"/>' +
      '<path d="M40,68 V91 M21,89 Q40,92 59,89" stroke="#22d3ee" stroke-width="1.2" fill="none"/>' +
      _lhAt(40, 28, head) +
      `<path d="M52,58 L62,67 L66,57" stroke="#e2e8f0" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="66.4" cy="55" r="2.9" fill="${LH_SKIN}"/>` +
      _lhAt(66.5, 45, '<path d="M0,-4.5 L4,-2.2 L4,2.2 L0,4.5 L-4,2.2 L-4,-2.2Z" fill="#22d3ee" fill-opacity=".35" stroke="#67e8f9" stroke-width=".9"/><path d="M-4,-2.2 L0,0 L4,-2.2 M0,0 V4.5" stroke="#67e8f9" stroke-width=".7" fill="none"/>', 'lhx-cube') +
      '</svg>';
    const wins = [
      ['STATUS', 'LV 12', 'HP ▮▮▮▮▯'], ['int', '4 bytes', '%d'], ['char *', '"text"', '%s'],
      ['pointer', '*p = &amp;x', '→ 0x7ffc'], ['for', 'i &lt; n', 'i++'], ['malloc', 'free(p)', 'NULL?'],
      ['O(n)', 'linear', 'one pass'], ['#define', 'MAX 100', 'no ;'], ['switch', 'case 1:', 'break;'],
      ['ステータス', 'ちから +5', 'すばやさ 9'],
    ];
    const T = 24;   // seconds a turn: matches .lhx-ring and .lhx-face in the CSS
    const ring = wins.map((w, i) => {
      const a = i * 36;
      return `<div class="lhx-win" style="--a:${a}deg;--y:${i % 2 ? 9 : -13}px">` +
        `<div class="lhx-pop" style="animation-delay:${(0.55 + i * 0.08).toFixed(2)}s">` +
        // The dimming is phased to the window's place on the ring: brightest in front.
        `<div class="lhx-face" style="animation-delay:${(-(1 - a / 360) * T).toFixed(2)}s"><b>${w[0]}</b><span>${w[1]}</span><span>${w[2]}</span></div>` +
        '</div></div>';
    }).join('');
    return `<div class="lhx-stage"><div class="lhx-world"><div class="lhx-char">${char}</div><div class="lhx-ring">${ring}</div></div></div>`;
  },

  /* Language Library: an original girl (no existing character) singing with
     her eyes closed, the words of four languages floating up out of her. */
  language() {
    const hood = '#f5f3ff', hoodSh = '#ddd6fe', sleeve = '#ede9fe', lilac = '#a855f7', hair = '#f9a8d4', hairSh = '#f472b6';
    const head = _lhHead({
      hair, iris: '#a855f7', style: 'soft', back: 'bob', eyes: 'closed', mouth: 'sing', mouthCls: 'lhl-mouth',
      under: `<path d="M15,-10 C30,-8 35,7 29,22 C27,12 22,4 13,-1Z" fill="${hairSh}"/>`,
      over: '<path d="M13,-15.5 l1.3,2.7 3,.3 -2.2,2 .6,2.9 -2.7,-1.5 -2.6,1.5 .6,-2.9 -2.2,-2 3,-.3Z" fill="#fde047" stroke="#f59e0b" stroke-width=".5"/>',
    });
    // word, drift right, rise, is a note
    const words = [
      ['la♪', 30, -66, 0], ['あ', 54, -80, 0], ['hola', 72, -58, 0], ['안녕', 40, -86, 0], ['ça va', 86, -64, 0],
      ['你好', 62, -76, 0], ['♫', 20, -90, 1], ['ciao', 80, -52, 0], ['ことば', 48, -70, 0],
    ];
    const still = { 0: [24, -40], 3: [34, -62], 5: [58, -52] };
    const w = words.map(([t, dx, rise, note], k) => {
      const d = (k * 0.36).toFixed(2), s = still[k];
      return _lhAt(94, 81,
        `<g class="lhl-wy" style="--h:${rise}px;animation-delay:${d}s" transform="translate(0,${s ? s[1] : 0})" opacity="${s ? 1 : 0}">` +
        `<text class="lh-jp" font-size="${note ? 11 : 8.5}" fill="${note ? '#a855f7' : '#18181b'}" stroke="#fff" stroke-opacity=".92" stroke-width="2.4" stroke-linejoin="round" paint-order="stroke" dominant-baseline="central">${t}</text></g>`,
        'lhl-wx', `style="--dx:${dx}px;animation-delay:${d}s" transform="translate(${s ? s[0] : 0},0)"`);
    }).join('');
    const sparkles = [[30, 30], [150, 40], [164, 112], [26, 96]].map(([x, y], i) =>
      _lhAt(x, y, _lhStar(4, '#e9d5ff'), 'lh-twinkle', `style="animation-delay:${(i * 0.5).toFixed(1)}s"`)).join('');
    return _lhSvg(
      sparkles +
      `<path d="M56,104 Q84,90 112,104 L104,112 Q84,104 64,112Z" fill="${hoodSh}"/>` +
      `<path d="M40,150 Q42,108 84,100 Q126,108 128,150Z" fill="${hood}" stroke="#c4b5fd" stroke-width="1"/>` +
      // shade down her right side, and the hood's pocket seam
      `<path d="M106,104 Q125,110 128,150 L112,150 Q114,122 106,104Z" fill="${hoodSh}" opacity=".8"/>` +
      '<path d="M62,138 Q84,132 106,138" stroke="#c4b5fd" stroke-width="1" fill="none"/>' +
      `<path d="M77,104 l-2,17 M91,104 l2,17" stroke="${lilac}" stroke-width="1.6" stroke-linecap="round"/><circle cx="75" cy="122" r="1.6" fill="${lilac}"/><circle cx="93" cy="122" r="1.6" fill="${lilac}"/>` +
      `<text x="104" y="137" font-size="13" fill="${lilac}" opacity=".85">♪</text>` +
      `<rect x="80" y="88" width="8" height="14" rx="3" fill="${LH_SKIN_SH}"/>` +
      _lhAt(84, 96, `<g transform="translate(0,-30) scale(1.32)">${head}</g>`, 'lhl-sway') +
      // the hand with the microphone
      '<path d="M54,128 Q54,110 63,104" stroke="#c4b5fd" stroke-width="10" fill="none" stroke-linecap="round"/>' +
      `<path d="M54,128 Q54,110 63,104" stroke="${sleeve}" stroke-width="8" fill="none" stroke-linecap="round"/>` +
      '<path d="M63,107 L71,91" stroke="#475569" stroke-width="3.2" stroke-linecap="round"/>' +
      `<circle cx="64" cy="103" r="3.6" fill="${LH_SKIN}"/>` +
      '<circle cx="72.5" cy="88" r="5" fill="#a855f7"/><path d="M68.5,86.5 h8 M68.2,88.8 h8.6" stroke="#e9d5ff" stroke-width=".7"/>' +
      w
    );
  },

  /* Mindset: floating cross-legged, eyes closed, principles orbiting on two
     tilted rings. Each token is drawn twice, behind and in front of the
     body, and the two copies trade places as it goes round. */
  mindset() {
    const tok = g => '<circle r="6.4" fill="#ede9fe" stroke="#8b5cf6" stroke-width="1"/>' +
      `<text y=".4" font-size="7.6" font-weight="800" text-anchor="middle" dominant-baseline="central" fill="#6d28d9">${g}</text>`;
    const orbit = (cx, cy, rx, ry, T, glyphs, rev, layer) => glyphs.map((g, k) => {
      const ph = k / glyphs.length, a = ph * 2 * Math.PI;
      const sx = (rev ? 1 : -1) * rx * Math.cos(a), sy = ry * Math.sin(a);
      const vis = (layer === 'f' ? sy >= 0 : sy < 0) ? 1 : 0;
      return _lhAt(cx, cy,
        `<g class="lhm-oy-${layer}" style="--ry:${ry}px;animation-duration:${T / 2}s;animation-delay:${(-(ph * T) - T / 4).toFixed(2)}s" transform="translate(0,${sy.toFixed(1)})" opacity="${vis}">${tok(g)}</g>`,
        'lhm-ox', `style="--rx:${rev ? -rx : rx}px;animation-duration:${T / 2}s;animation-delay:${(-(ph * T)).toFixed(2)}s" transform="translate(${sx.toFixed(1)},0)"`);
    }).join('');
    const o1 = [100, 40, 44, 10, 6, ['∞', '♥', '★'], false];
    const o2 = [100, 98, 62, 14, 9, ['✓', '◆', '☾'], true];
    const robe = '#ede9fe', robeSh = '#ddd6fe';
    const body =
      '<ellipse cx="100" cy="127" rx="33" ry="6.5" fill="#7c3aed" opacity=".55"/>' +
      '<path d="M70,112 Q100,100 130,112 Q133,121 120,122.5 L80,122.5 Q67,121 70,112Z" fill="#c4b5fd"/>' +
      `<ellipse cx="86" cy="117" rx="5.2" ry="2.6" fill="${LH_SKIN}"/><ellipse cx="114" cy="117" rx="5.2" ry="2.6" fill="${LH_SKIN}"/>` +
      `<rect x="97" y="62" width="6" height="9" rx="2" fill="${LH_SKIN_SH}"/>` +
      `<path d="M85,71 Q100,64 115,71 L120,108 Q100,113 80,108Z" fill="${robe}"/>` +
      '<path d="M95,69 L100,81 L105,69" stroke="#a78bfa" stroke-width="1.2" fill="none"/>' +
      '<path d="M82,97 Q100,101 118,97" stroke="#8b5cf6" stroke-width="3" fill="none"/>' +
      `<path d="M87,75 Q76,91 81,107" stroke="${robeSh}" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M113,75 Q124,91 119,107" stroke="${robeSh}" stroke-width="6" fill="none" stroke-linecap="round"/>` +
      `<circle cx="81" cy="108.5" r="3.2" fill="${LH_SKIN}"/><circle cx="119" cy="108.5" r="3.2" fill="${LH_SKIN}"/>` +
      '<circle cx="81" cy="108.5" r="1.2" fill="none" stroke="#a78bfa" stroke-width=".7"/><circle cx="119" cy="108.5" r="1.2" fill="none" stroke="#a78bfa" stroke-width=".7"/>' +
      _lhAt(100, 46, _lhHead({ hair: '#312e81', iris: '#8b5cf6', style: 'soft', back: 'long', eyes: 'closed' }));
    const tracks = '<ellipse cx="100" cy="40" rx="44" ry="10" fill="none" stroke="#a78bfa" stroke-opacity=".5" stroke-dasharray="2 3"/>' +
      '<ellipse cx="100" cy="98" rx="62" ry="14" fill="none" stroke="#a78bfa" stroke-opacity=".5" stroke-dasharray="2 3"/>';
    const up = [[92, 24, 0], [106, 20, 1], [113, 27, 2]].map(([x, y, i]) =>
      _lhAt(x, y, _lhStar(3, '#c4b5fd'), 'lhm-up', `style="--i:${i}" opacity="0"`)).join('');
    return _lhSvg(
      _lhAt(100, 84, '<circle r="50" fill="#8b5cf6" opacity=".14"/><circle r="32" fill="#a78bfa" opacity=".14"/>', 'lhm-aura') +
      _lhAt(0, 0, tracks + orbit(...o1, 'b') + orbit(...o2, 'b') + body + orbit(...o1, 'f') + orbit(...o2, 'f') + up, 'lhm-float')
    );
  },

  /* Insights: thinking, hand on chin... then the lightbulb. */
  insights() {
    const hood = '#fdf2f8', pink = '#ec4899', sleeve = '#fbcfe8';
    const head = _lhHead({
      hair: '#f97316', style: 'spiky', ahoge: true,
      face: `<g class="lhi-fa" opacity="0">${_lhFace({ eyes: 'up', mouth: 'flat', iris: '#be185d', blink: false })}</g>` +
        `<g class="lhi-fb">${_lhFace({ eyes: 'sparkle', mouth: 'grin', iris: '#be185d' })}</g>`,
    });
    const bulb = '<circle cy="-3" r="17" fill="#fde68a" opacity=".28"/><circle cy="-3" r="11" fill="#fef3c7" opacity=".55"/>' +
      '<circle cy="-3" r="8.5" fill="#fde047" stroke="#f59e0b" stroke-width=".9"/>' +
      '<path d="M-4.6,3 Q-4,5.5 -4,7 L4,7 Q4,5.5 4.6,3Z" fill="#fde047"/>' +
      '<path d="M-2.4,5 L-1.2,-1 L0,2 L1.2,-1 L2.4,5" stroke="#b45309" stroke-width=".8" fill="none"/>' +
      '<rect x="-4" y="7" width="8" height="5" rx="1" fill="#94a3b8"/><path d="M-4,9 H4 M-3.4,11 H3.4" stroke="#64748b" stroke-width=".7"/>';
    const rays = '<path d="M0,-13 V-18 M9.2,-9.2 L12.7,-12.7 M13,0 H18 M9.2,9.2 L12.7,12.7 M0,13 V18 M-9.2,9.2 L-12.7,12.7 M-13,0 H-18 M-9.2,-9.2 L-12.7,-12.7" stroke="#fde047" stroke-width="1.8" stroke-linecap="round"/>';
    const sparks = Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * 2 * Math.PI + 0.3;
      return _lhAt(80, 24, _lhStar(2.6, i % 2 ? '#f9a8d4' : '#fde047'), 'lhi-spark',
        `style="--sx:${(Math.cos(a) * 34).toFixed(1)}px;--sy:${(Math.sin(a) * 30).toFixed(1)}px" opacity="0"`);
    }).join('');
    const dots = [0, 1, 2].map(i => _lhAt(116 + i * 5.5, 35, '<circle r="1.6" fill="#be185d"/>', 'lhi-dot', `style="animation-delay:${(i * 0.15).toFixed(2)}s"`)).join('');
    return _lhSvg(
      `<g class="lhi-think" opacity="0"><circle cx="99" cy="55" r="1.6" fill="#fce7f3"/><circle cx="104" cy="48" r="2.4" fill="#fce7f3"/>` +
      `<ellipse cx="121.5" cy="35" rx="14" ry="9" fill="#fce7f3"/>${dots}</g>` +
      _lhAt(80, 24, _lhAt(0, 0, rays, 'lhi-spin'), 'lhi-rays') +
      _lhAt(80, 27, bulb, 'lhi-bulb') +
      sparks +
      // legs, idle arm, body, head
      '<rect x="72" y="118" width="7" height="16" rx="2" fill="#334155"/><rect x="83" y="118" width="7" height="16" rx="2" fill="#334155"/>' +
      '<path d="M70,132 h10 v3.6 h-11.5Z" fill="#f8fafc"/><path d="M82,132 h10 q1.6,0 1.6,3.6 h-11.6Z" fill="#f8fafc"/>' +
      `<path d="M67,99 L60,112 L63,121" stroke="${sleeve}" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="63.5" cy="122.5" r="3" fill="${LH_SKIN_SH}"/>` +
      `<rect x="77" y="88" width="6" height="9" rx="2" fill="${LH_SKIN_SH}"/>` +
      `<path d="M66,96 Q80,89 94,96 L97,122 L63,122Z" fill="${hood}" stroke="#f9a8d4" stroke-width=".8"/>` +
      `<path d="M71,111 H89" stroke="${pink}" stroke-width="1.4" stroke-linecap="round"/>` +
      _lhAt(80, 72, head, 'lhi-head') +
      // the near arm: on the chin while thinking, a finger up for the idea
      `<g class="lhi-aa" opacity="0"><path d="M93,100 L98,113 L88,92" stroke="${sleeve}" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="87" cy="90.2" r="3" fill="${LH_SKIN}"/></g>` +
      `<g class="lhi-ab"><path d="M93,100 L103,93 L104,77" stroke="${sleeve}" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="104" cy="75" r="3" fill="${LH_SKIN}"/><path d="M104,72.5 V66.5" stroke="${LH_SKIN}" stroke-width="1.9" stroke-linecap="round"/></g>` +
      _lhAt(112, 60, '<text font-size="17" font-weight="900" text-anchor="middle" dominant-baseline="central" fill="#ec4899" stroke="#fff" stroke-width="1.8" paint-order="stroke">!</text>', 'lhi-ex')
    );
  },

  /* Remembrance: a quiet night; she catches falling stars in a glass jar,
     which glows a little brighter with each one. */
  remembrance() {
    const card = '#fbbf24', cardSh = '#f59e0b';
    const twinkles = [[60, 14, 2.4], [150, 20, 3], [176, 52, 2.2], [20, 60, 2.2], [132, 8, 2], [182, 92, 2.4]].map(([x, y, r], i) =>
      _lhAt(x, y, _lhStar(r, '#fef3c7'), 'lh-twinkle', `style="animation-delay:${(i * 0.37).toFixed(2)}s"`)).join('');
    // Negative delays space the arrivals 0.7 s apart, in step with the jar's pulse.
    const stillPose = [[0, 0, 0], [24, 48, 1], [0, 0, 0], [-46, 30, 1], [0, 0, 0]];
    const falls = [24, 58, 150, 182, 124].map((sx, k) => {
      const d = (-k * 0.7).toFixed(2), st = stillPose[k];
      return _lhAt(sx, -6,
        `<g class="lhr-fy" style="--dy:98px;--r:${k % 2 ? 160 : -160}deg;animation-delay:${d}s" transform="translate(0,${st[1]})" opacity="${st[2]}">` +
        `<circle r="5" fill="#fde68a" opacity=".3"/>${_lhStar(4.2, '#fde047')}</g>`,
        'lhr-fx', `style="--dx:${100 - sx}px;animation-delay:${d}s" transform="translate(${st[0]},0)"`);
    }).join('');
    const head = _lhHead({ hair: '#1e3a5f', iris: '#d97706', style: 'soft', back: 'long', eyes: 'up' });
    return _lhSvg(
      '<path d="M38,10 A13,13 0 0 0 38,36 A16,16 0 0 1 38,10Z" fill="#fde68a"/>' +
      twinkles +
      '<path d="M84,104 L116,104 L121,127 L79,127Z" fill="#fef3c7"/>' +
      `<rect x="88" y="126" width="6" height="8" fill="${LH_SKIN}"/><rect x="106" y="126" width="6" height="8" fill="${LH_SKIN}"/>` +
      '<path d="M86,133 h9 v3 h-10Z" fill="#78350f"/><path d="M105,133 h9 q1,0 1,3 h-10Z" fill="#78350f"/>' +
      `<rect x="97" y="62" width="6" height="9" rx="2" fill="${LH_SKIN_SH}"/>` +
      `<path d="M84,71 Q100,64 116,71 L119,106 Q100,110 81,106Z" fill="${card}"/>` +
      '<path d="M95,69 L100,84 L105,69Z" fill="#fef3c7"/>' +
      _lhAt(100, 46, head, 'lh-breathe') +
      `<path d="M86,75 Q77,92 88,104" stroke="${cardSh}" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M114,75 Q123,92 112,104" stroke="${cardSh}" stroke-width="6" fill="none" stroke-linecap="round"/>` +
      // the jar, glowing
      _lhAt(100, 110, '<circle r="12" fill="#fbbf24" opacity=".5"/><circle r="6.5" fill="#fde68a" opacity=".75"/>', 'lhr-glow') +
      _lhAt(95, 115, _lhStar(2, '#fff'), 'lhr-in') + _lhAt(105, 107, _lhStar(1.6, '#fff'), 'lhr-in', 'style="animation-delay:-.6s"') +
      '<path d="M90,92 L110,92 Q113,95 114,100 L114,119 Q114,124 109,124 L91,124 Q86,124 86,119 L86,100 Q87,95 90,92Z" fill="#fef9c3" fill-opacity=".16" stroke="#fde68a" stroke-width="1.1"/>' +
      '<ellipse cx="100" cy="92" rx="10.5" ry="2.2" fill="none" stroke="#fde68a" stroke-width="1"/>' +
      '<path d="M89,99 V116" stroke="#fff" stroke-opacity=".5" stroke-width="1.4" stroke-linecap="round"/>' +
      `<circle cx="87.5" cy="106" r="3.1" fill="${LH_SKIN}"/><circle cx="112.5" cy="106" r="3.1" fill="${LH_SKIN}"/>` +
      falls
    );
  },

  /* Diary: writing in a little book on her knees while the page is
     projected large beside her; three lines, a doodle, turn the page. */
  diary() {
    const pj = '#fde68a', pjSh = '#facc15';
    const lines = [['today I learned', 24], ['pointers ≠ scary', 40], ['keep going ♡', 56]];
    const page =
      '<rect width="84" height="90" rx="5" fill="#fefce8" stroke="#eab308" stroke-width="1"/>' +
      '<path d="M8,26.5 H76 M8,42.5 H76 M8,58.5 H76 M8,74.5 H76" stroke="#fde68a" stroke-width=".8"/>' +
      '<text x="8" y="15" class="lh-hand" font-size="8.6" fill="#a16207">Nov 18 ✦</text>' +
      lines.map(([t, y], i) => `<text x="8" y="${y}" class="lh-hand" font-size="7.4" fill="#3f2d14">${t}</text>` +
        _lhAt(78, y - 7, '<rect x="-72" width="72" height="9.4" fill="#fefce8"/>', `lhd-cov lhd-l${i}`, 'transform="scale(0,1)"')).join('') +
      _lhAt(66, 72, '<path d="M0,3 C-6,-1 -5,-6 -1.6,-5 Q-.4,-4.6 0,-3 Q.4,-4.6 1.6,-5 C5,-6 6,-1 0,3Z" fill="#f472b6"/>', 'lhd-heart') +
      _lhAt(0, 0, '<path d="M0,0 L2,-1.4 L10,-9.4 L8.6,-10.8 L.6,-2.8Z" fill="#334155"/><path d="M8.6,-10.8 L10,-9.4 L12.4,-11.8 L11,-13.2Z" fill="#f472b6"/>', 'lhd-pen', 'transform="translate(72,74)"');
    const head = _lhHead({
      hair: '#9a3412', iris: '#a16207', style: 'soft', back: 'short', eyes: 'down',
      under: '<circle cx="-5" cy="-22" r="8" fill="#9a3412"/><path d="M-11,-25 Q-5,-31 1,-25" stroke="#facc15" stroke-width="1.6" fill="none"/>',
    });
    const steam = '<path d="M0,0 q-2,-3 0,-6 q2,-3 0,-6" stroke="#e2e8f0" stroke-width="1.2" fill="none" stroke-linecap="round"/>';
    return _lhSvg(
      '<path d="M70,96 Q88,78 104,66" stroke="#fde047" stroke-width="1" stroke-dasharray="1.5 2.5" fill="none" opacity=".7"/>' +
      _lhAt(104, 22, page, 'lhd-page') +
      '<ellipse cx="50" cy="126" rx="32" ry="13" fill="#a16207" opacity=".85"/>' +
      `<rect x="47" y="70" width="6" height="9" rx="2" fill="${LH_SKIN_SH}"/>` +
      `<path d="M36,80 Q50,73 64,80 L66,108 L34,108Z" fill="${pj}"/>` +
      '<circle cx="42" cy="88" r="1.2" fill="#f59e0b"/><circle cx="55" cy="94" r="1.2" fill="#f59e0b"/><circle cx="46" cy="101" r="1.2" fill="#f59e0b"/>' +
      _lhAt(50, 56, head, 'lh-breathe') +
      `<path d="M30,108 Q50,94 74,104 L75,116 Q52,121 29,117Z" fill="${pjSh}"/>` +
      '<path d="M44,100 L58,96 L72,100 L72,108 L58,104 L44,108Z" fill="#fff7ed" stroke="#b45309" stroke-width=".8"/>' +
      `<path d="M38,84 Q34,98 46,104" stroke="${pjSh}" stroke-width="5.6" fill="none" stroke-linecap="round"/><circle cx="46" cy="104" r="2.8" fill="${LH_SKIN}"/>` +
      `<path d="M62,84 Q68,94 62,100" stroke="${pjSh}" stroke-width="5.6" fill="none" stroke-linecap="round"/>` +
      _lhAt(63, 100, `<circle r="3" fill="${LH_SKIN}"/><path d="M1,1 L-4,6.4" stroke="#1e293b" stroke-width="1.4" stroke-linecap="round"/>`, 'lhd-hand') +
      '<rect x="82" y="118" width="10" height="11" rx="2" fill="#f8fafc"/><path d="M92,121 q3.6,1.4 0,5" stroke="#f8fafc" stroke-width="1.4" fill="none"/>' +
      _lhAt(85, 115, steam, 'lhd-steam', 'opacity="0"') + _lhAt(89, 115, steam, 'lhd-steam', 'style="animation-delay:-1s" opacity="0"')
    );
  },

  /* Collection: a kid with a box of treasures, each one arcing into its own
     cubby of a display cabinet. */
  collection() {
    const ITEMS = {
      gem: '<path d="M-6.5,-2 L-3.5,-6.5 L3.5,-6.5 L6.5,-2 L0,7Z" fill="#67e8f9" stroke="#0891b2" stroke-width=".8" stroke-linejoin="round"/><path d="M-6.5,-2 H6.5 M-3.5,-6.5 L-1.5,-2 L0,7 M3.5,-6.5 L1.5,-2" stroke="#0891b2" stroke-width=".5" fill="none"/>',
      coin: '<circle r="6.5" fill="#fbbf24" stroke="#b45309" stroke-width="1"/><path d="M0,-3.5 l1,2.2 2.4,.2 -1.8,1.6 .6,2.4 -2.2,-1.3 -2.2,1.3 .6,-2.4 -1.8,-1.6 2.4,-.2Z" fill="#fef3c7"/>',
      trophy: '<path d="M-5,-6 H5 V-1 Q5,3 0,3.5 Q-5,3 -5,-1Z" fill="#facc15" stroke="#a16207" stroke-width=".7"/><path d="M-5,-4.5 Q-8.5,-4 -7,-.5 L-4.6,0 M5,-4.5 Q8.5,-4 7,-.5 L4.6,0" stroke="#a16207" stroke-width="1" fill="none"/><rect x="-1.2" y="3.4" width="2.4" height="2.6" fill="#a16207"/><rect x="-4" y="5.8" width="8" height="2" rx=".6" fill="#a16207"/>',
      potion: '<path d="M-2,-7 H2 V-3 Q6.5,-1 6.5,3 Q6.5,7.5 0,7.5 Q-6.5,7.5 -6.5,3 Q-6.5,-1 -2,-3Z" fill="#fce7f3" fill-opacity=".5" stroke="#db2777" stroke-width=".8"/><path d="M-6.2,2.4 Q0,.4 6.2,2.4 Q6,7.2 0,7.2 Q-6,7.2 -6.2,2.4Z" fill="#ec4899"/><rect x="-2.6" y="-8.5" width="5.2" height="2" rx=".6" fill="#a16207"/>',
      cube: '<path d="M0,-7 L6.5,-3.4 L0,.2 L-6.5,-3.4Z" fill="#a78bfa"/><path d="M-6.5,-3.4 L0,.2 L0,7.5 L-6.5,3.9Z" fill="#7c3aed"/><path d="M6.5,-3.4 L0,.2 L0,7.5 L6.5,3.9Z" fill="#6d28d9"/>',
      plant: '<path d="M-4.5,1.5 H4.5 L3.5,7.5 H-3.5Z" fill="#c2410c"/><path d="M0,1.5 Q-1,-4 -6,-6 Q-2,-2 0,1.5 M0,1.5 Q1,-5 5.5,-7.5 Q2.5,-2.5 0,1.5 M0,1.5 Q0,-6 0,-8" stroke="#16a34a" stroke-width="1.6" fill="#22c55e" stroke-linecap="round"/>',
    };
    const slots = [['gem', 120, 65], ['coin', 147, 65], ['trophy', 174, 65], ['potion', 120, 107], ['cube', 147, 107], ['plant', 174, 107]];
    const bx = 59, by = 90;   // the mouth of the box
    const items = slots.map(([k, x, y], i) => {
      const dx = x - bx, dy = y - by, rise = Math.min(dy, 0) - 24, d = (i * 0.5).toFixed(2);
      return _lhAt(bx, by,
        `<g class="lhk-fy" style="--dy:${dy}px;--h:${rise}px;animation-delay:${d}s" transform="translate(0,${dy})">${ITEMS[k]}</g>`,
        'lhk-fx', `style="--dx:${dx}px;animation-delay:${d}s" transform="translate(${dx},0)"`) +
        _lhAt(x, y - 2, _lhStar(6, '#a7f3d0'), 'lhk-spark', `style="animation-delay:${d}s" opacity="0"`);
    }).join('');
    let cabinet = '<rect x="104" y="120" width="4" height="9" fill="#065f46"/><rect x="186" y="120" width="4" height="9" fill="#065f46"/>' +
      '<rect x="102" y="28" width="90" height="92" rx="5" fill="#064e3b" stroke="#10b981" stroke-width="1.2"/>';
    [34, 76].forEach(y => [108, 135, 162].forEach(x => {
      cabinet += `<rect x="${x}" y="${y}" width="24" height="38" rx="2" fill="#022c22" stroke="#047857" stroke-width=".6"/>`;
    }));
    cabinet += '<path d="M106,30 L114,30 L106,40Z" fill="#fff" opacity=".12"/>';
    const head = _lhHead({
      hair: '#3f2a1d', iris: '#059669', style: 'spiky', eyes: 'happy', mouth: 'grin',
      over: '<path d="M-17.5,-8 C-17,-29 17,-29 17.5,-8Z" fill="#059669"/><path d="M4,-11 Q16,-13 25,-8.5 Q15,-6.5 2,-7Z" fill="#047857"/><circle cx="0" cy="-23.5" r="1.6" fill="#047857"/>',
    });
    return _lhSvg(
      cabinet +
      '<rect x="51" y="112" width="7" height="20" rx="2" fill="#334155"/><rect x="61" y="112" width="7" height="20" rx="2" fill="#334155"/>' +
      '<path d="M49,130 h10 v4 h-11.5Z" fill="#f8fafc"/><path d="M60,130 h10 q1.6,0 1.6,4 h-11.6Z" fill="#f8fafc"/>' +
      `<rect x="55.5" y="64" width="6" height="9" rx="2" fill="${LH_SKIN_SH}"/>` +
      '<path d="M45,74 Q58.5,67 72,74 L74,113 L43,113Z" fill="#f0fdf4" stroke="#a7f3d0" stroke-width=".8"/>' +
      '<path d="M44,90 H73" stroke="#10b981" stroke-width="3"/>' +
      _lhAt(58.5, 48, head, 'lh-breathe') +
      `<path d="M47,78 Q40,92 46,99" stroke="${LH_SKIN_SH}" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M70,78 Q77,92 72,99" stroke="${LH_SKIN}" stroke-width="5" fill="none" stroke-linecap="round"/>` +
      _lhAt(44, 90, '<path d="M0,0 L-9,-7 L-1,-8.5 L6,0Z" fill="#c8915a" stroke="#a16207" stroke-width=".6"/>', 'lhk-flap') +
      _lhAt(74, 90, '<path d="M0,0 L9,-7 L1,-8.5 L-6,0Z" fill="#c8915a" stroke="#a16207" stroke-width=".6"/>', 'lhk-flap lhk-flap-r') +
      '<path d="M44,90 H74 L72,112 H46Z" fill="#d6a46c" stroke="#a16207" stroke-width=".8"/><path d="M52,96 H66" stroke="#a16207" stroke-width="1.2" opacity=".6"/>' +
      `<circle cx="45.5" cy="99" r="3" fill="${LH_SKIN_SH}"/><circle cx="72.5" cy="99" r="3" fill="${LH_SKIN}"/>` +
      items
    );
  },

  /* Progression: the bars of a chart grow into a staircase, and a little
     climber hops up them to LEVEL UP. */
  progression() {
    const bars = [[70, 22], [96, 38], [122, 56], [148, 76]].map(([x, h], i) => _lhAt(x, 136,
      `<rect y="${-h}" width="20" height="${h}" rx="2.5" fill="#0e7490" stroke="#22d3ee" stroke-width="1"/>` +
      `<rect x="2" y="${-h + 2}" width="16" height="3" rx="1.5" fill="#67e8f9" opacity=".8"/>` +
      `<text x="10" y="${-h + 13}" font-size="6.4" font-weight="800" text-anchor="middle" fill="#cffafe">${i + 1}</text>`,
      'lhp-bar', `style="--i:${i}"`)).join('');
    const climber = _lhMini({
      hair: '#0f172a', style: 'spiky', iris: '#0891b2', mouth: 'grin', look: 0.5, outfit: '#f97316', shade: '#ea580c',
      over: '<path d="M-17.5,-9.5 Q0,-16 17.5,-9.5 L17.5,-6 Q0,-12.5 -17.5,-6Z" fill="#06b6d4"/>',
      downCls: 'lhp-ad', upCls: 'lhp-au', upOn: true,
    });
    const sparks = Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * 2 * Math.PI - Math.PI / 2;
      return _lhAt(158, 34, _lhStar(2.8, i % 2 ? '#fde047' : '#67e8f9'), 'lhp-sp',
        `style="--sx:${(Math.cos(a) * 26).toFixed(1)}px;--sy:${(Math.sin(a) * 22).toFixed(1)}px" opacity="0"`);
    }).join('');
    return _lhSvg(
      '<path d="M20,136.5 H180" stroke="#22d3ee" stroke-opacity=".45"/><rect x="30" y="134" width="22" height="3" rx="1.5" fill="#22d3ee" opacity=".5"/>' +
      '<text x="14" y="21" font-size="6" font-weight="800" fill="#67e8f9">XP</text>' +
      '<rect x="26" y="16.5" width="50" height="5" rx="2.5" fill="#164e63"/>' +
      _lhAt(26, 16.5, '<rect width="50" height="5" rx="2.5" fill="#22d3ee"/>', 'lhp-xp', 'transform="scale(.12,1)"') +
      '<text x="80" y="21.2" font-size="6" font-weight="800" fill="#cffafe" class="lhp-l4" opacity="0">Lv 4</text>' +
      '<text x="80" y="21.2" font-size="6" font-weight="800" fill="#fde047" class="lhp-l5">Lv 5</text>' +
      bars +
      `<g class="lhp-x" transform="translate(158,0)"><g class="lhp-y" transform="translate(0,60)"><g class="lhp-fade">${climber}</g></g></g>` +
      sparks +
      _lhAt(108, 34, '<text font-size="10.5" font-weight="900" text-anchor="middle" dominant-baseline="central" fill="#67e8f9" stroke="#083344" stroke-width="2.4" stroke-linejoin="round" paint-order="stroke">LEVEL UP!</text>', 'lhp-lv')
    );
  },

  /* Roadmap: a little traveller walks a dashed route across a map plate,
     lighting each waypoint, to the flag at the end. */
  roadmap() {
    const pts = [[30, 124], [66, 112], [80, 84], [118, 90], [140, 58], [170, 40]];
    const pinBase = '<path d="M0,0 C-2,-4 -5,-6 -5,-9.5 A5,5 0 1 1 5,-9.5 C5,-6 2,-4 0,0Z" fill="#334155" stroke="#93c5fd" stroke-width=".8"/><circle cy="-9.6" r="2" fill="#93c5fd"/>';
    const pinLit = '<circle cy="-9.6" r="8" fill="#facc15" opacity=".25"/><path d="M0,0 C-2,-4 -5,-6 -5,-9.5 A5,5 0 1 1 5,-9.5 C5,-6 2,-4 0,0Z" fill="#facc15" stroke="#fef3c7" stroke-width=".8"/><circle cy="-9.6" r="2" fill="#fff"/>';
    const pins = pts.slice(1, 5).map(([x, y], i) => _lhAt(x, y, pinBase) + _lhAt(x, y, pinLit, `lhw-pin lhw-p${i + 1}`)).join('');
    const walker = _lhMini({
      hair: '#422006', style: 'spiky', iris: '#2563eb', look: 0.8, outfit: '#3b82f6', shade: '#2563eb', pants: '#1e293b',
      legA: 'lhw-leg', legB: 'lhw-leg lhw-leg-b', behind: '<rect x="-11" y="-20" width="6" height="11" rx="2" fill="#b45309"/>',
    });
    const conf = ['#f87171', '#fde047', '#4ade80', '#60a5fa', '#f472b6', '#fde047', '#a78bfa'].map((c, i) => {
      const a = -Math.PI / 2 + (i - 3) * 0.42;
      return _lhAt(170, 26, `<rect x="-1.4" y="-.8" width="2.8" height="1.6" fill="${c}"/>`, 'lhw-conf',
        `style="--sx:${(Math.cos(a) * 24).toFixed(1)}px;--sy:${(Math.sin(a) * 20 + 10).toFixed(1)}px" opacity="0"`);
    }).join('');
    return _lhSvg(
      '<rect x="12" y="18" width="178" height="120" rx="9" fill="#1e3a8a" fill-opacity=".38" stroke="#60a5fa" stroke-opacity=".7"/>' +
      '<path d="M12,48 H190 M12,78 H190 M12,108 H190 M56,18 V138 M100,18 V138 M144,18 V138" stroke="#93c5fd" stroke-opacity=".12"/>' +
      '<path d="M126,108 Q140,96 160,104 Q176,112 166,124 Q146,132 130,124 Q118,118 126,108Z" fill="#3b82f6" opacity=".45"/>' +
      '<path d="M34,70 L44,54 L54,70Z M46,70 L58,48 L70,70Z" fill="#60a5fa" opacity=".3"/>' +
      '<circle cx="98" cy="118" r="4" fill="#34d399" opacity=".5"/><circle cx="106" cy="122" r="4" fill="#34d399" opacity=".5"/><circle cx="92" cy="124" r="4" fill="#34d399" opacity=".5"/>' +
      '<circle cx="28" cy="34" r="7" fill="none" stroke="#93c5fd" stroke-opacity=".6"/><path d="M28,27 L30,34 L28,41 L26,34Z" fill="#93c5fd" opacity=".8"/><text x="28" y="25.2" font-size="5" text-anchor="middle" fill="#bfdbfe">N</text>' +
      `<path d="M${pts.map(p => p.join(',')).join(' L')}" stroke="#bfdbfe" stroke-width="2" stroke-dasharray="4 3" fill="none" stroke-linejoin="round" stroke-linecap="round" opacity=".85"/>` +
      '<circle cx="30" cy="124" r="3" fill="#bfdbfe"/>' +
      pins +
      '<path d="M170,40 V18" stroke="#e2e8f0" stroke-width="1.4" stroke-linecap="round"/>' +
      _lhAt(170, 19, '<path d="M0,0 L14,3.5 L0,8Z" fill="#f87171"/>', 'lhw-flag') +
      `<g class="lhw-walk" transform="translate(140,58)"><g class="lhw-fade"><g class="lhw-bob"><g transform="scale(.82)">${walker}</g></g></g></g>` +
      conf
    );
  },

  /* Placeholder Library: a builder robot welding the next wing together, a
     wireframe crate edge by edge; it dissolves and starts again. */
  placeholder() {
    const E = [
      [109, 93, 128, 104, 0], [128, 104, 147, 93, 0], [147, 93, 128, 82, 1], [128, 82, 109, 93, 1],
      [109, 69, 109, 93, 0], [128, 80, 128, 104, 0], [147, 69, 147, 93, 0], [128, 58, 128, 82, 1],
      [109, 69, 128, 80, 0], [128, 80, 147, 69, 0], [147, 69, 128, 58, 0], [128, 58, 109, 69, 0],
    ];
    const edges = E.map(([x1, y1, x2, y2, hid], i) =>
      `<path class="lhz-e" style="--i:${i}" d="M${x1},${y1} L${x2},${y2}" stroke="#cbd5e1" stroke-width="${hid ? 1 : 1.6}"${hid ? ' stroke-dasharray="2 2" stroke-opacity=".55"' : ''} stroke-linecap="round"/>`).join('');
    const sparks = [[10, -10, 0], [14, -2, 0.1], [9, 8, 0.2], [4, -14, 0.3], [16, 4, 0.4], [6, 12, 0.15]].map(([sx, sy, d]) =>
      _lhAt(101, 89, '<circle r="1.1" fill="#fde047"/>', 'lhz-sp', `style="--sx:${sx}px;--sy:${sy}px;animation-delay:${d}s" opacity="0"`)).join('');
    const eye = '<rect x="-2.2" y="-3" width="4.4" height="6" rx="2" fill="#67e8f9"/>';
    const bot =
      _lhAt(54, 111, '<path d="M-4.5,0 Q0,10 4.5,0Z" fill="#fb923c"/><path d="M-2.2,0 Q0,5.5 2.2,0Z" fill="#fde047"/>', 'lhz-jet') +
      '<rect x="48" y="104" width="12" height="7" rx="2" fill="#64748b"/>' +
      '<circle cx="54" cy="90" r="17" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1.2"/>' +
      '<rect x="42" y="83" width="24" height="14" rx="6" fill="#0f172a"/>' +
      _lhAt(49, 90, eye, 'lh-blink') + _lhAt(59, 90, eye, 'lh-blink') +
      '<path d="M35,79 Q54,58 73,79Z" fill="#facc15"/><rect x="32" y="77.5" width="44" height="4" rx="2" fill="#eab308"/>' +
      '<path d="M54,68.5 V62" stroke="#94a3b8" stroke-width="1.4"/>' + _lhAt(54, 60.5, '<circle r="2.1" fill="#f87171"/>', 'lhz-led') +
      '<path d="M68,97 L82,100 L93,93" stroke="#94a3b8" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<rect x="91" y="89" width="9" height="5" rx="1.5" fill="#475569" transform="rotate(-25 95.5 91.5)"/>';
    return _lhSvg(
      '<path d="M84,134 H176 M96,128 H164 M130,124 V138 M110,126 L104,138 M150,126 L156,138" stroke="#94a3b8" stroke-opacity=".2"/>' +
      '<path d="M102,110 L106,126 H150 L154,110Z" fill="#475569"/>' +
      '<ellipse cx="128" cy="110" rx="26" ry="6" fill="#64748b"/><ellipse cx="128" cy="110" rx="26" ry="6" fill="#94a3b8" opacity=".35"/>' +
      '<text x="128" y="121" font-size="5.4" font-weight="800" text-anchor="middle" fill="#cbd5e1" letter-spacing=".6">NEXT WING</text>' +
      edges +
      _lhAt(128, 82, '<text font-size="15" font-weight="900" text-anchor="middle" dominant-baseline="central" fill="#e2e8f0">?</text>', 'lhz-q') +
      _lhAt(0, 0, bot, 'lhz-float') +
      _lhAt(101, 89, '<circle r="4" fill="#fef08a" opacity=".7"/>', 'lhz-flash', 'opacity="0"') +
      sparks
    );
  },
};
