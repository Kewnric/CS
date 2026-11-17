/* ============================================================
   BRAIN BORDERS — nine animated borders for notes
   ------------------------------------------------------------
   Neon, Aurora, Holo, Ember, Circuit, Frost, Arcane, Pixel, Galaxy, beside
   the first three (Electric, Medieval, Manhua, in viz-brain.js). Each is
   the card restyled (css/brain-borders.css, keyed on .bfx-card and
   data-border) plus one layer of its own, .bfx-<id>, laid over the note
   by brainRenderCanvas. Parts of a layer may sit behind the card
   (z-index -1: the note is the stacking context) or in front of it.

   Rules every one keeps: loops animate transform and opacity only, every
   loop ends on the frame it starts with (or invisible), no forwards fills,
   and each animated part carries .bfx-a, which stops when the canvas is
   zoomed far out and under reduced motion. A picked Border Edge colour
   (--viz-node-accent) recolours the border; a picked Background replaces
   the card's own.

   Two need the note's size in px (brainSizeBorderFx): Circuit's pulses run
   the length of each edge (--bfx-w, --bfx-h), and Aurora's colour wheel is
   a square as wide as the note's diagonal (--bfx-d), so it covers the
   ring at every angle without being any larger than that.
   ============================================================ */

/** [id, label, lucide icon, tile colour] -- the order of the menu's tiles. */
const BRAIN_BORDER_FX_LIST = [
  ['neon', 'Neon', 'lightbulb', '#ff2bd6'],
  ['aurora', 'Aurora', 'waves', '#34d399'],
  ['holo', 'Holo', 'gem', '#a5b4fc'],
  ['ember', 'Ember', 'flame', '#ff7a18'],
  ['circuit', 'Circuit', 'cpu', '#22c55e'],
  ['frost', 'Frost', 'snowflake', '#9be7ff'],
  ['arcane', 'Arcane', 'sparkles', '#a855f7'],
  ['pixel', 'Pixel', 'gamepad-2', '#facc15'],
  ['galaxy', 'Galaxy', 'orbit', '#818cf8'],
];

/* A four-point star, a snowflake and a magic seal, drawn once. */
const _BFX_STAR = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 0 12 8 20 10 12 12 10 20 8 12 0 10 8 8Z" fill="currentColor"/></svg>';
const _BFX_FLAKE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">'
  + '<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7"/><path d="m9.5 3.5 2.5 2 2.5-2M9.5 20.5l2.5-2 2.5 2M4 10.3l3.1-.6-.6-3.1M20 13.7l-3.1.6.6 3.1M4 13.7l3.1.6-.6 3.1M20 10.3l-3.1-.6.6-3.1"/></svg>';
const _BFX_SEAL_OUTER = '<svg class="bfx-a" viewBox="0 0 100 100" fill="none" stroke="currentColor" aria-hidden="true">'
  + '<circle cx="50" cy="50" r="47" stroke-width="1.2"/><circle cx="50" cy="50" r="41" stroke-width="0.6" stroke-dasharray="2 3"/>'
  + Array.from({ length: 24 }, (_, i) => {
    const a = i * Math.PI / 12, r1 = 41, r2 = i % 2 ? 44 : 47;
    return `<line x1="${(50 + r1 * Math.cos(a)).toFixed(2)}" y1="${(50 + r1 * Math.sin(a)).toFixed(2)}" x2="${(50 + r2 * Math.cos(a)).toFixed(2)}" y2="${(50 + r2 * Math.sin(a)).toFixed(2)}" stroke-width="0.9"/>`;
  }).join('') + '</svg>';
const _BFX_SEAL_INNER = '<svg class="bfx-a" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true">'
  + '<path d="M50 18 77.7 66H22.3Z"/><path d="M50 82 22.3 34h55.4Z"/><circle cx="50" cy="50" r="13"/><circle cx="50" cy="50" r="3" fill="currentColor"/></svg>';

const _bfxStars = (n) => '<div class="bfx-stars">'
  + Array.from({ length: n }, (_, i) => `<i class="bfx-star bfx-a" style="--i:${i}">${_BFX_STAR}</i>`).join('') + '</div>';

/** Each border's own layer, laid over the note. */
const BRAIN_BORDER_FX = {
  neon: '<div class="bfx bfx-neon" aria-hidden="true"><i class="bfx-neon-floor bfx-a"></i><i class="bfx-neon-tube bfx-a"></i>'
    + '<i class="bfx-neon-cap is-l"></i><i class="bfx-neon-cap is-r"></i></div>',
  aurora: '<div class="bfx bfx-aurora" aria-hidden="true"><div class="bfx-aurora-halo"><i class="bfx-a"></i></div>'
    + '<div class="bfx-veil"><i class="bfx-a"></i></div><div class="bfx-ring"><i class="bfx-a"></i></div></div>',
  holo: '<div class="bfx bfx-holo" aria-hidden="true"><div class="bfx-ring bfx-holo-rim"></div>'
    + '<div class="bfx-holo-foil"><i class="bfx-a"></i></div>' + _bfxStars(4) + '</div>',
  ember: '<div class="bfx bfx-ember" aria-hidden="true"><i class="bfx-ember-heat bfx-a"></i><i class="bfx-ember-rim bfx-a"></i><div class="bfx-ember-sparks">'
    + Array.from({ length: 8 }, (_, i) => `<i class="bfx-a" style="--i:${i}"></i>`).join('') + '</div></div>',
  circuit: '<div class="bfx bfx-circuit" aria-hidden="true">'
    + ['is-tl', 'is-tr', 'is-bl', 'is-br'].map(c => `<i class="bfx-circ-trace ${c}"><b class="bfx-a"></b></i>`).join('')
    + ['is-top', 'is-right', 'is-bottom', 'is-left'].map(c => `<i class="bfx-circ-pulse ${c} bfx-a"></i>`).join('') + '</div>',
  frost: '<div class="bfx bfx-frost" aria-hidden="true"><div class="bfx-ring bfx-frost-ring"><i class="bfx-a"></i></div>'
    + ['is-tl', 'is-tr', 'is-bl', 'is-br'].map(c => `<i class="bfx-flake ${c}">${_BFX_FLAKE}</i>`).join('') + _bfxStars(5) + '</div>',
  arcane: '<div class="bfx bfx-arcane" aria-hidden="true">'
    + ['is-l', 'is-r'].map(c => `<div class="bfx-seal ${c}">${_BFX_SEAL_OUTER}${_BFX_SEAL_INNER}</div>`).join('')
    + ['is-tl', 'is-tr', 'is-bl', 'is-br'].map((c, i) => `<i class="bfx-rune ${c} bfx-a" style="--i:${i}"></i>`).join('') + '</div>',
  pixel: '<div class="bfx bfx-pixel" aria-hidden="true"><i class="bfx-pixel-shadow"></i>'
    + ['is-top', 'is-right', 'is-bottom', 'is-left'].map(c => `<div class="bfx-pixel-edge ${c}"><i class="bfx-a"></i></div>`).join('')
    + ['is-tl', 'is-tr', 'is-bl', 'is-br'].map(c => `<i class="bfx-pixel-corner ${c}"></i>`).join('')
    + '<i class="bfx-pixel-cursor bfx-a"></i></div>',
  galaxy: '<div class="bfx bfx-galaxy" aria-hidden="true"><div class="bfx-galaxy-sky"><i class="bfx-galaxy-far bfx-a"></i><i class="bfx-galaxy-near bfx-a"></i>'
    + '<i class="bfx-galaxy-shoot bfx-a"></i></div>' + _bfxStars(3) + '</div>',
};

/** Is this one of the nine? */
function brainBorderFx(border) {
  return Object.prototype.hasOwnProperty.call(BRAIN_BORDER_FX, border) ? border : null;
}

/** The note's size in px, for the borders that move along it or turn round it. */
function brainSizeBorderFx(el, inner) {
  if (!el || !inner || !el.classList.contains('bfx-card')) return;
  const w = inner.offsetWidth, h = inner.offsetHeight;
  if (!w) return;
  el.style.setProperty('--bfx-w', w + 'px');
  el.style.setProperty('--bfx-h', h + 'px');
  el.style.setProperty('--bfx-d', Math.ceil(Math.hypot(w, h)) + 8 + 'px');
}

/** The Border menu's "Animated" tiles. */
function brainBorderTilesHTML() {
  return '<div class="viz-popup-title bfx-menu-title">Animated</div><div class="bfx-tiles">'
    + BRAIN_BORDER_FX_LIST.map(([id, label, icon, c]) =>
      `<div class="viz-link-type-option bfx-tile" role="menuitem" data-border="${id}" style="--tc:${c}" onclick="brainCtxSetBorder('${id}')">`
      + `<i data-lucide="${icon}"></i><span>${label}</span></div>`).join('')
    + '</div>';
}
