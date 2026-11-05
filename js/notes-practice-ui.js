/* ============================================================
   NOTES-PRACTICE-UI.JS — how the notebook attempt looks and moves
   ------------------------------------------------------------
   Four things live here, all of them about the screen rather than the
   attempt, so none of them touches an answer:

   1. DISPLAY PREFERENCES. Text size, element size, width, alignment, the
      spatial level, animations, keycap letters and right-click movement, per
      device in `ssp.np.ui`. They land as data attributes on #np-layout and the
      stylesheet (css/notes-practice-ui.css) does the rest, so changing one
      never re-renders the question.

   2. SPATIAL EFFECTS. Anything marked .np-sp tilts toward the pointer and
      catches a light where the pointer is. One delegated pointermove on the
      layout, folded into one write per frame; the element only receives four
      custom properties and a class. Mouse only: on a touch screen the press
      is the whole interaction, and a card leaning under a finger is noise.

   3. RIGHT-CLICK TO MOVE. A right-click on the left half of the question pane
      is Previous, on the right half Next. A text field keeps its own menu (that
      is where paste lives), and so does a right-click over selected text.

   4. THE DISPLAY PANEL, opened from the sliders button in the topbar. It
      replaced the Feel panel on this screen: typing sound, letter animation
      and the boss break all belong to the code editor and did nothing here.
   ============================================================ */

const NP_UI_KEY = 'ssp.np.ui';

const NP_UI_OPTIONS = {
  text:    [['sm', 'S', 'Small'], ['md', 'M', 'Medium'], ['lg', 'L', 'Large'], ['xl', 'XL', 'Extra large']],
  size:    [['compact', 'Compact'], ['comfy', 'Comfy', 'Comfortable'], ['large', 'Large'], ['huge', 'Huge']],
  width:   [['narrow', 'Narrow'], ['normal', 'Normal'], ['wide', 'Wide'], ['full', 'Full']],
  spatial: [['off', 'Off'], ['subtle', 'Subtle'], ['full', 'Full']]
};

function _npUiReducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
}

/** The defaults, with motion stood down for anyone who asked their system for less. */
function _npUiDefaults() {
  const calm = _npUiReducedMotion();
  return {
    text: 'md', size: 'comfy', width: 'normal',
    spatial: calm ? 'off' : 'full', lastSpatial: 'full',
    motion: !calm, keys: true, rclick: true
  };
}

function npUiPrefs() {
  const d = _npUiDefaults();
  let v = null;
  try { v = JSON.parse(localStorage.getItem(NP_UI_KEY) || 'null'); } catch (e) { /* private mode, or a bad value */ }
  if (!v || typeof v !== 'object') return d;
  const pick = (k) => (NP_UI_OPTIONS[k].some(o => o[0] === v[k]) ? v[k] : d[k]);
  return {
    text: pick('text'), size: pick('size'), width: pick('width'), spatial: pick('spatial'),
    lastSpatial: (v.lastSpatial === 'subtle' || v.lastSpatial === 'full') ? v.lastSpatial : d.lastSpatial,
    motion: typeof v.motion === 'boolean' ? v.motion : d.motion,
    keys: typeof v.keys === 'boolean' ? v.keys : d.keys,
    rclick: typeof v.rclick === 'boolean' ? v.rclick : d.rclick
  };
}

function _npUiSave(p) {
  try { localStorage.setItem(NP_UI_KEY, JSON.stringify(p)); } catch (e) { /* private mode */ }
}

/** Set one preference and show it. */
function npUiSet(key, value) {
  const p = npUiPrefs();
  p[key] = value;
  if (key === 'spatial' && value !== 'off') p.lastSpatial = value;
  _npUiSave(p);
  npUiApply();
  if (key === 'spatial' && value === 'off') _npUiClearHot();
  // The matching lines are drawn from measured boxes, so a size or width
  // change has to redraw them.
  if ((key === 'text' || key === 'size' || key === 'width') && typeof drawMatchingLines === 'function') {
    setTimeout(drawMatchingLines, 260);
  }
  _npUiRenderPanel();
}

function npUiReset() {
  try { localStorage.removeItem(NP_UI_KEY); } catch (e) { /* private mode */ }
  if (typeof npTextAlignCenter !== 'undefined' && !npTextAlignCenter) npUiSetAlign(true);
  npUiApply();
  _npUiClearHot();
  _npUiRenderPanel();
}

/** Centred or left-aligned questions and answers (the old topbar toggle). */
function npUiSetAlign(center) {
  if (typeof npTextAlignCenter === 'undefined') return;
  if (npTextAlignCenter !== !!center && typeof toggleNpTextAlign === 'function') toggleNpTextAlign();
  npUiApply();
  _npUiRenderPanel();
}

/** Write the preferences onto the layout. */
function npUiApply() {
  const root = document.getElementById('np-layout');
  if (!root) return;
  const p = npUiPrefs();
  root.dataset.npText = p.text;
  root.dataset.npSize = p.size;
  root.dataset.npWidth = p.width;
  root.dataset.npSpatial = p.spatial;
  root.dataset.npMotion = p.motion ? 'on' : 'off';
  root.dataset.npKeys = p.keys ? 'on' : 'off';
  root.dataset.npRclick = p.rclick ? 'on' : 'off';
  if (typeof npTextAlignCenter !== 'undefined') root.dataset.npAlign = npTextAlignCenter ? 'center' : 'left';
  _npUiPaintSpatialBtn();
}

function _npUiPaintSpatialBtn() {
  const btn = document.getElementById('np-spatial-btn');
  if (!btn) return;
  const lvl = npUiPrefs().spatial;
  const on = lvl !== 'off';
  btn.classList.toggle('is-on', on);
  btn.setAttribute('aria-pressed', String(on));
  btn.title = on ? 'Spatial effects: ' + (lvl === 'full' ? 'full' : 'subtle') + ' — click to turn off'
                 : 'Spatial effects: off — click to turn on';
}

/** The topbar switch: off, or back to the level that was last on. */
function npUiToggleSpatial() {
  const p = npUiPrefs();
  const next = p.spatial === 'off' ? (p.lastSpatial || 'full') : 'off';
  npUiSet('spatial', next);
  if (typeof toast === 'function') {
    toast(next === 'off' ? 'Spatial effects off' : 'Spatial effects on', { type: 'info', duration: 1600 });
  }
}

/* ── Spatial ─────────────────────────────────────────────────── */

let _npUiHot = null;          // the .np-sp element under the pointer
let _npUiPt = null;           // the last pointer position, client coords
let _npUiFrame = 0;
let _npUiRoot = null;         // the layout the listeners are on

/** How far each kind of thing leans, in degrees, at full. Small things lean
    more: two degrees on a 900px card already moves its far edge visibly, two
    degrees on a 36px button is nothing. */
function _npUiTiltFor(el) {
  if (el.classList.contains('np-choice')) return el.classList.contains('np-tf') ? 9 : 5;
  if (el.classList.contains('np-match-item')) return 6;
  if (el.classList.contains('np-confirm-btn')) return 5;
  if (el.classList.contains('np-sidebar-tab-dark')) return 6;
  return 14;
}

function _npUiClearHot() {
  if (!_npUiHot) return;
  const el = _npUiHot;
  _npUiHot = null;
  el.classList.remove('is-hot');
  el.style.removeProperty('--rx');
  el.style.removeProperty('--ry');
}

function _npUiSpatialFrame() {
  _npUiFrame = 0;
  const root = _npUiRoot;
  if (!root || !_npUiPt) return;
  const lvl = root.dataset.npSpatial;
  if (!lvl || lvl === 'off') { _npUiClearHot(); return; }

  const under = document.elementFromPoint(_npUiPt.x, _npUiPt.y);
  let el = under && under.closest ? under.closest('.np-sp') : null;
  // Nothing leans that cannot be pressed: an answered choice is a record now.
  if (el && (!root.contains(el) || el.disabled || el.classList.contains('is-locked'))) el = null;
  if (el !== _npUiHot) { _npUiClearHot(); _npUiHot = el; }

  // The card's light follows the pointer anywhere over it, choice or not.
  const card = document.getElementById('np-card');
  if (card) {
    const cr = card.getBoundingClientRect();
    const inCard = _npUiPt.x >= cr.left && _npUiPt.x <= cr.right && _npUiPt.y >= cr.top && _npUiPt.y <= cr.bottom;
    card.classList.toggle('is-lit', inCard);
    if (inCard) {
      card.style.setProperty('--cx', ((_npUiPt.x - cr.left) / cr.width * 100).toFixed(1) + '%');
      card.style.setProperty('--cy', ((_npUiPt.y - cr.top) / cr.height * 100).toFixed(1) + '%');
    }
  }

  if (!el) return;
  /* Measured from the centre against the untransformed size. The rect of a
     leaning box is its projection, which grows and shrinks as it leans, so
     reading the edges from it made the lean chase itself and jitter near them.
     A lean turns about the centre, which barely moves. */
  const r = el.getBoundingClientRect();
  const w = el.offsetWidth || r.width;
  const h = el.offsetHeight || r.height;
  if (!w || !h) return;
  const px = Math.min(1, Math.max(0, 0.5 + (_npUiPt.x - (r.left + r.width / 2)) / w));
  const py = Math.min(1, Math.max(0, 0.5 + (_npUiPt.y - (r.top + r.height / 2)) / h));
  const max = _npUiTiltFor(el) * (lvl === 'full' ? 1 : 0.45);
  el.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
  el.style.setProperty('--my', (py * 100).toFixed(1) + '%');
  el.style.setProperty('--rx', ((0.5 - py) * max).toFixed(2) + 'deg');
  el.style.setProperty('--ry', ((px - 0.5) * max).toFixed(2) + 'deg');
  el.classList.add('is-hot');
}

function _npUiMove(e) {
  if (e.pointerType && e.pointerType !== 'mouse') return;
  _npUiPt = { x: e.clientX, y: e.clientY };
  if (!_npUiFrame) _npUiFrame = requestAnimationFrame(_npUiSpatialFrame);
}

function _npUiLeave() {
  _npUiPt = null;
  _npUiClearHot();
  const card = document.getElementById('np-card');
  if (card) card.classList.remove('is-lit');
}

/** A ring that bursts from where you pressed. Drawn on the body, not in the
    button, because answering re-renders the button out from under it. */
function _npUiDown(e) {
  if (e.button !== 0) return;
  const root = _npUiRoot;
  if (!root || root.dataset.npSpatial === 'off' || root.dataset.npMotion === 'off') return;
  const el = e.target && e.target.closest ? e.target.closest('.np-sp') : null;
  if (!el || el.disabled || el.classList.contains('is-locked') || !root.contains(el)) return;
  const ring = document.createElement('span');
  ring.className = 'np-burst' + (el.classList.contains('np-choice') ? ' is-big' : '');
  ring.style.left = e.clientX + 'px';
  ring.style.top = e.clientY + 'px';
  document.body.appendChild(ring);
  setTimeout(() => ring.remove(), 700);
}

/* ── Right-click to move ──────────────────────────────────────── */

function _npUiContext(e) {
  if (!npUiPrefs().rclick) return;
  const t = e.target;
  // A text field keeps its menu: that is where paste is.
  if (t && t.closest && t.closest('input, textarea, select, [contenteditable="true"]')) return;
  // So does selected text, which someone is about to copy.
  const sel = window.getSelection ? String(window.getSelection() || '').trim() : '';
  if (sel) return;
  const pane = e.currentTarget;
  e.preventDefault();
  const r = pane.getBoundingClientRect();
  const back = e.clientX < r.left + r.width / 2;
  const btn = document.getElementById(back ? 'np-btn-prev' : 'np-btn-next');
  const blocked = !btn || btn.disabled;
  _npUiEdgeFlash(r, back, blocked);
  if (blocked) return;
  if (back) { if (typeof npPrevQuestion === 'function') npPrevQuestion(); }
  else if (typeof npNextQuestion === 'function') npNextQuestion();
}

/** Light the edge you moved toward, so a right-click visibly did something. */
function _npUiEdgeFlash(rect, back, blocked) {
  document.querySelectorAll('.np-edge-flash').forEach(n => n.remove());
  const el = document.createElement('div');
  el.className = 'np-edge-flash ' + (back ? 'is-back' : 'is-next') + (blocked ? ' is-blocked' : '');
  el.style.left = rect.left + 'px';
  el.style.top = rect.top + 'px';
  el.style.width = rect.width + 'px';
  el.style.height = rect.height + 'px';
  el.innerHTML = '<span class="np-edge-glyph"><i data-lucide="' + (blocked ? 'ban' : (back ? 'chevron-left' : 'chevron-right')) + '"></i>'
    + '<em>' + (blocked ? (back ? 'First question' : 'Last question') : (back ? 'Previous' : 'Next')) + '</em></span>';
  document.body.appendChild(el);
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: el });
  setTimeout(() => el.remove(), 650);
}

/* ── Per render ───────────────────────────────────────────────── */

let _npUiLastKey = '';
let _npUiLastOrd = -1;
let _npUiStaggerTimer = null;

/** Called at the end of renderQuestion. */
function npUiOnRender(info) {
  const card = document.getElementById('np-card');
  const choices = document.getElementById('np-bubbles-container');
  const fill = document.getElementById('np-card-meter-fill');
  if (fill && info && info.total) fill.style.width = (((info.pos + 1) / info.total) * 100).toFixed(2) + '%';

  if (info && info.key !== _npUiLastKey) {
    const dir = _npUiLastOrd < 0 ? 'none' : (info.ord < _npUiLastOrd ? 'back' : 'next');
    _npUiLastKey = info.key;
    _npUiLastOrd = info.ord;
    if (card) {
      card.classList.remove('np-in-next', 'np-in-back', 'np-in-none');
      void card.offsetWidth;           // restart the animation
      card.classList.add('np-in-' + dir);
    }
    if (choices) {
      choices.classList.add('np-stagger');
      clearTimeout(_npUiStaggerTimer);
      _npUiStaggerTimer = setTimeout(() => choices.classList.remove('np-stagger'), 900);
    }
    const pane = document.getElementById('np-question-area');
    if (pane && pane.scrollTop > 0) pane.scrollTop = 0;
    // Matching lines are measured 40ms in, while the card is still sliding;
    // draw them again once it has landed.
    if (document.getElementById('np-matching-svg') && typeof drawMatchingLines === 'function') {
      setTimeout(drawMatchingLines, 620);
    }
  }

  // The element under a resting pointer was just replaced; light the new one.
  _npUiHot = null;
  if (_npUiPt && !_npUiFrame) _npUiFrame = requestAnimationFrame(_npUiSpatialFrame);
}

/** Answered so far, in the title chip and along the bottom of the topbar. */
function npUiPaintProgress() {
  if (typeof activeNotebook === 'undefined' || !activeNotebook) return;
  let done = 0;
  let total = 0;
  (activeNotebook.sections || []).forEach((sec, si) => {
    (sec.questions || []).forEach(q => {
      total++;
      const answered = (typeof reviewMode !== 'undefined' && reviewMode)
        ? (gradeResults[si] && gradeResults[si][q] && gradeResults[si][q] !== 'skipped')
        : (sessionStatus[si] && sessionStatus[si][q] === 'answered');
      if (answered) done++;
    });
  });
  const count = document.getElementById('np-title-count');
  if (count) count.textContent = done + ' / ' + total;
  const rail = document.getElementById('np-top-rail-fill');
  if (rail) rail.style.width = (total ? (done / total) * 100 : 0).toFixed(2) + '%';
  const sub = document.getElementById('np-side-sub');
  if (sub) {
    const n = (activeNotebook.sections || []).length;
    sub.textContent = n + (n === 1 ? ' section' : ' sections') + ' · ' + total + (total === 1 ? ' question' : ' questions');
  }
}

/* ── The display panel ────────────────────────────────────────── */

function _npUiSeg(key, current, opts) {
  return '<div class="np-seg" role="radiogroup">' + opts.map(o => {
    const on = o[0] === current;
    return '<button type="button" role="radio" aria-checked="' + on + '" class="np-seg-btn' + (on ? ' is-on' : '') + '"'
      + ' title="' + escapeHTML(o[2] || o[1]) + '"'
      + ' onclick="npUiSet(\'' + key + '\', \'' + o[0] + '\')">' + escapeHTML(o[1]) + '</button>';
  }).join('') + '</div>';
}

function _npUiSwitch(key, on, name, hint) {
  return '<label class="np-ui-switch">'
    + '<span><strong>' + escapeHTML(name) + '</strong><em>' + escapeHTML(hint) + '</em></span>'
    + '<input type="checkbox" class="np-switch" ' + (on ? 'checked ' : '')
    + 'onchange="npUiSet(\'' + key + '\', this.checked)" /></label>';
}

function _npUiRow(icon, label, value, control) {
  return '<section class="np-ui-sec">'
    + '<div class="np-ui-label"><i data-lucide="' + icon + '"></i><span>' + escapeHTML(label) + '</span>'
    + (value ? '<em>' + escapeHTML(value) + '</em>' : '') + '</div>' + control + '</section>';
}

function _npUiNameOf(key, id) {
  const o = NP_UI_OPTIONS[key].find(x => x[0] === id);
  return o ? (o[2] || o[1]) : '';
}

function _npUiPanelHTML() {
  const p = npUiPrefs();
  const center = typeof npTextAlignCenter === 'undefined' ? true : npTextAlignCenter;
  const theme = document.documentElement.getAttribute('data-theme') || 'dark';
  const ambOn = typeof ambEnabled === 'function' && ambEnabled();
  const ambCur = typeof ambTheme === 'function' ? ambTheme() : '';
  const themes = [['dark', 'Night'], ['light', 'Day'], ['purple', 'Purple'], ['green', 'Green']];
  const backs = [['off', 'Off']].concat(typeof AMB_THEMES !== 'undefined' ? AMB_THEMES.map(t => [t.id, t.name]) : []);
  const backCur = ambOn ? ambCur : 'off';

  const themeSeg = '<div class="np-seg" role="radiogroup">' + themes.map(t =>
    '<button type="button" role="radio" aria-checked="' + (t[0] === theme) + '" class="np-seg-btn' + (t[0] === theme ? ' is-on' : '') + '"'
    + ' onclick="npUiSetTheme(\'' + t[0] + '\')">' + t[1] + '</button>').join('') + '</div>';
  const backSeg = '<div class="np-seg np-seg-wrap" role="radiogroup">' + backs.map(b =>
    '<button type="button" role="radio" aria-checked="' + (b[0] === backCur) + '" class="np-seg-btn' + (b[0] === backCur ? ' is-on' : '') + '"'
    + ' onclick="npUiSetBackground(\'' + b[0] + '\')">' + escapeHTML(b[1]) + '</button>').join('') + '</div>';
  const alignSeg = '<div class="np-seg" role="radiogroup">'
    + '<button type="button" role="radio" aria-checked="' + center + '" class="np-seg-btn' + (center ? ' is-on' : '') + '" onclick="npUiSetAlign(true)"><i data-lucide="align-center"></i> Centre</button>'
    + '<button type="button" role="radio" aria-checked="' + !center + '" class="np-seg-btn' + (!center ? ' is-on' : '') + '" onclick="npUiSetAlign(false)"><i data-lucide="align-left"></i> Left</button>'
    + '</div>';

  return '<div class="np-ui-head">'
    + '<span class="np-ui-title"><i data-lucide="sliders-horizontal"></i> Display</span>'
    + '<button type="button" class="np-ui-reset" onclick="npUiReset()" title="Back to the defaults"><i data-lucide="rotate-ccw"></i> Reset</button>'
    + '</div>'
    + '<div class="np-ui-scroll">'
    + '<div class="np-ui-group-title">Reading</div>'
    + _npUiRow('a-large-small', 'Text size', _npUiNameOf('text', p.text), _npUiSeg('text', p.text, NP_UI_OPTIONS.text))
    + _npUiRow('scaling', 'Element size', _npUiNameOf('size', p.size), _npUiSeg('size', p.size, NP_UI_OPTIONS.size))
    + _npUiRow('stretch-horizontal', 'Question width', _npUiNameOf('width', p.width), _npUiSeg('width', p.width, NP_UI_OPTIONS.width))
    + _npUiRow('text-quote', 'Alignment', center ? 'Centre' : 'Left', alignSeg)
    + '<div class="np-ui-group-title">Effects</div>'
    + _npUiRow('rotate-3d', 'Spatial effects', _npUiNameOf('spatial', p.spatial), _npUiSeg('spatial', p.spatial, NP_UI_OPTIONS.spatial))
    + '<div class="np-ui-switches">'
    + _npUiSwitch('motion', p.motion, 'Animations', 'Cards slide in, answers pop and shake')
    + _npUiSwitch('keys', p.keys, 'Letter keys on choices', 'The A, B, C you can press')
    + _npUiSwitch('rclick', p.rclick, 'Right-click to move', 'Left half back, right half on')
    + '</div>'
    + '<div class="np-ui-group-title">Look</div>'
    + _npUiRow('palette', 'Theme', '', themeSeg)
    + _npUiRow('sparkles', 'Background', '', backSeg)
    + '<p class="np-ui-note">Kept on this device.</p>'
    + '</div>';
}

function _npUiRenderPanel() {
  const pop = document.getElementById('np-ui-pop');
  if (!pop) return;
  const sc = pop.querySelector('.np-ui-scroll');
  const keep = sc ? sc.scrollTop : 0;
  pop.innerHTML = _npUiPanelHTML();
  const sc2 = pop.querySelector('.np-ui-scroll');
  if (sc2) sc2.scrollTop = keep;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: pop });
}

function npUiSetTheme(id) {
  if (typeof changeTheme === 'function') changeTheme(id);
  _npUiRenderPanel();
}

function npUiSetBackground(id) {
  if (id === 'off') {
    if (typeof ambEnabled === 'function' && ambEnabled() && typeof toggleAmbient === 'function') toggleAmbient();
  } else if (typeof setAmbTheme === 'function') {
    setAmbTheme(id);
  }
  _npUiRenderPanel();
}

function _npUiPanelClose() {
  const pop = document.getElementById('np-ui-pop');
  if (pop) pop.remove();
  document.removeEventListener('pointerdown', _npUiOutside, true);
  document.removeEventListener('keydown', _npUiPanelKey, true);
  window.removeEventListener('resize', _npUiPlacePanel);
  const btn = document.getElementById('np-display-btn');
  if (btn) { btn.setAttribute('aria-expanded', 'false'); btn.classList.remove('is-open'); }
}

function _npUiOutside(e) {
  const pop = document.getElementById('np-ui-pop');
  const btn = document.getElementById('np-display-btn');
  if (!pop) return;
  if (pop.contains(e.target) || (btn && btn.contains(e.target))) return;
  _npUiPanelClose();
}

function _npUiPanelKey(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    _npUiPanelClose();
    const btn = document.getElementById('np-display-btn');
    if (btn) btn.focus({ preventScroll: true });
  }
}

function _npUiPlacePanel() {
  const pop = document.getElementById('np-ui-pop');
  const btn = document.getElementById('np-display-btn');
  if (!pop || !btn) return;
  const r = btn.getBoundingClientRect();
  const w = pop.offsetWidth;
  const left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8));
  pop.style.left = left + 'px';
  pop.style.top = (r.bottom + 8) + 'px';
  pop.style.maxHeight = Math.max(220, window.innerHeight - r.bottom - 20) + 'px';
}

/** The sliders button. Opens and closes; it never changes a setting itself. */
function npUiTogglePanel(e) {
  if (e) e.stopPropagation();
  if (document.getElementById('np-ui-pop')) { _npUiPanelClose(); return; }
  // Only one topbar panel at a time.
  if (typeof _npShuffleMenuClose === 'function') _npShuffleMenuClose();
  document.querySelectorAll('.js-hold-pop.is-open').forEach(c => c.classList.remove('is-open'));
  const pop = document.createElement('div');
  pop.id = 'np-ui-pop';
  pop.className = 'np-ui-pop';
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-label', 'Display settings');
  document.body.appendChild(pop);
  _npUiRenderPanel();
  _npUiPlacePanel();
  const btn = document.getElementById('np-display-btn');
  if (btn) { btn.setAttribute('aria-expanded', 'true'); btn.classList.add('is-open'); }
  document.addEventListener('pointerdown', _npUiOutside, true);
  document.addEventListener('keydown', _npUiPanelKey, true);
  window.addEventListener('resize', _npUiPlacePanel);
}

/* ── Mount / unmount, from the route ──────────────────────────── */

function npUiMount() {
  npUiUnmount();
  const root = document.getElementById('np-layout');
  if (!root) return;
  _npUiRoot = root;
  _npUiLastKey = '';
  _npUiLastOrd = -1;
  npUiApply();
  root.addEventListener('pointermove', _npUiMove, { passive: true });
  root.addEventListener('pointerleave', _npUiLeave);
  root.addEventListener('pointerdown', _npUiDown);
  const pane = document.getElementById('np-question-area');
  if (pane) pane.addEventListener('contextmenu', _npUiContext);
}

function npUiUnmount() {
  _npUiPanelClose();
  if (_npUiRoot) {
    _npUiRoot.removeEventListener('pointermove', _npUiMove);
    _npUiRoot.removeEventListener('pointerleave', _npUiLeave);
    _npUiRoot.removeEventListener('pointerdown', _npUiDown);
  }
  const pane = document.getElementById('np-question-area');
  if (pane) pane.removeEventListener('contextmenu', _npUiContext);
  if (_npUiFrame) cancelAnimationFrame(_npUiFrame);
  _npUiFrame = 0;
  _npUiRoot = null;
  _npUiHot = null;
  _npUiPt = null;
  clearTimeout(_npUiStaggerTimer);
  document.querySelectorAll('.np-edge-flash, .np-burst').forEach(n => n.remove());
}
