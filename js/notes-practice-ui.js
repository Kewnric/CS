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
  grid:    [['sm', 'S', 'Small'], ['md', 'M', 'Medium'], ['lg', 'L', 'Large'], ['xl', 'XL', 'Extra large']],
  answers: [['same', 'Same', 'Same as the question'], ['narrow', 'Narrow'], ['medium', 'Medium'], ['wide', 'Wide']],
  skin:    [['system', 'System', 'System window'], ['glass', 'Glass', 'Glass card']],
  reveal:  [['off', 'Off', 'Shown at once'], ['fast', 'Fast'], ['normal', 'Normal'], ['slow', 'Slow']],
  spatial: [['off', 'Off'], ['subtle', 'Subtle'], ['full', 'Full']],
  /* No Day: the attempt is drawn dark throughout (the System window most of
     all), so a light theme only ever changed its accent and read as broken.
     Purple and Green recolour the whole attempt (css .np-pal-*). */
  theme:   [['app', 'App', 'Same as the app'], ['dark', 'Night'], ['purple', 'Purple'], ['green', 'Green']],
  advance: [['normal', 'Move on', 'Next question after 1.5s'], ['slow', 'Wait', 'Next question after 3s'], ['off', 'Stay', 'Stay; press Next to move on']]
};

function _npUiReducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
}

/** The defaults, with motion stood down for anyone who asked their system for less. */
function _npUiDefaults() {
  const calm = _npUiReducedMotion();
  return {
    text: 'md', size: 'comfy', width: 'normal', grid: 'md', answers: 'same', skin: 'system',
    reveal: calm ? 'off' : 'normal', theme: 'app',
    spatial: calm ? 'off' : 'full', lastSpatial: 'full',
    motion: !calm, keys: true, rclick: true, sfx: true,
    confirm: false, advance: 'normal', vol: 100
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
    grid: pick('grid'), reveal: pick('reveal'), theme: pick('theme'), answers: pick('answers'), skin: pick('skin'),
    lastSpatial: (v.lastSpatial === 'subtle' || v.lastSpatial === 'full') ? v.lastSpatial : d.lastSpatial,
    motion: typeof v.motion === 'boolean' ? v.motion : d.motion,
    keys: typeof v.keys === 'boolean' ? v.keys : d.keys,
    rclick: typeof v.rclick === 'boolean' ? v.rclick : d.rclick,
    sfx: typeof v.sfx === 'boolean' ? v.sfx : d.sfx,
    confirm: typeof v.confirm === 'boolean' ? v.confirm : d.confirm,
    advance: NP_UI_OPTIONS.advance.some(o => o[0] === v.advance) ? v.advance : d.advance,
    vol: Number.isFinite(+v.vol) ? Math.max(0, Math.min(150, +v.vol)) : d.vol
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
  if (key === 'theme') _npUiApplyTheme();
  // Switching the reveal off mid-sentence finishes the sentence.
  if (key === 'reveal' && value === 'off' && window.npQuestionAnimator && !window.npQuestionAnimator._aborted) {
    try { window.npQuestionAnimator.complete(); } catch (e) { /* already done */ }
  }
  // The lines follow sizes through their ResizeObserver; this is the fallback.
  if ((key === 'text' || key === 'size' || key === 'width' || key === 'answers') && typeof drawMatchingLines === 'function') {
    setTimeout(drawMatchingLines, 380);
  }
  _npUiRenderPanel();
}

function npUiReset() {
  try { localStorage.removeItem(NP_UI_KEY); } catch (e) { /* private mode */ }
  if (typeof npTextAlignCenter !== 'undefined' && !npTextAlignCenter) npUiSetAlign(true);
  npUiApply();
  _npUiApplyTheme();
  _npUiClearHot();
  _npUiRenderPanel();
}

/* ── The attempt's own theme ─────────────────────────────────────
   Picking a theme in here used to call the app's changeTheme, which saves it
   for the whole app -- so the library came back green after the attempt was
   left. It is now kept apart: the attempt paints its own pick while it is on
   screen and hands the app's theme back on the way out. "App" follows
   whatever the app is set to. */
function _npUiAppTheme() {
  try { return localStorage.getItem('theme') || 'dark'; } catch (e) { return 'dark'; }
}

function _npUiApplyTheme() {
  const want = npUiPrefs().theme;
  const t = want && want !== 'app' ? want : _npUiAppTheme();
  const root = document.documentElement;
  if (root.getAttribute('data-theme') !== t) root.setAttribute('data-theme', t);
  const layout = document.getElementById('np-layout');
  if (layout) layout.dataset.npPal = (t === 'purple' || t === 'green') ? t : 'night';
}

function _npUiRestoreTheme() {
  const t = _npUiAppTheme();
  const root = document.documentElement;
  if (root.getAttribute('data-theme') !== t) root.setAttribute('data-theme', t);
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
  root.dataset.npGrid = p.grid;
  root.dataset.npAnswers = p.answers;
  root.dataset.npSkin = p.skin;
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
  _npKb.idx = -1;               // the mouse took over from the keyboard cursor
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
    + '<em>' + (blocked ? (back ? (typeof npNoBack !== 'undefined' && npNoBack ? 'No going back' : 'First question') : 'Last question') : (back ? 'Previous' : 'Next')) + '</em></span>';
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
  } else if (choices && choices.classList.contains('np-stagger')) {
    /* Same question, drawn again (a box ticked, a pair made) while the entry
       was still playing: the new buttons would rise in from nothing a second
       time and flicker. Only a new question animates in. */
    clearTimeout(_npUiStaggerTimer);
    choices.classList.remove('np-stagger');
  }

  // A re-render (ticking a box, say) replaced the button the keyboard was on;
  // put the cursor back on the same spot.
  if (info && _npKb.key === info.key && _npKb.idx >= 0) {
    const list = _npKbList();
    const el = list[Math.min(_npKb.idx, list.length - 1)];
    if (el) el.focus({ preventScroll: true });
  } else if (info) {
    _npKb.key = info.key;
    _npKb.idx = -1;
  }

  // The moment of grading, once per answer: a sound either way, and for a
  // wrong one the crosses raining out of what was picked.
  if (info && info.grading && (info.result === 'wrong' || info.result === 'correct') && _npUiXKey !== info.key) {
    _npUiXKey = info.key;
    if (info.result === 'wrong') {
      npUiSfx('wrong');
      _npUiDropX(info.type);
      _npUiSay('Incorrect.');
    } else {
      npUiSfx(_npUiAllCorrectSoFar() ? 'streak' : 'correct');
      _npUiSay('Correct.');
    }
  } else if (info && !info.grading) {
    _npUiXKey = '';
  }

  // The element under a resting pointer was just replaced; light the new one.
  _npUiHot = null;
  if (_npUiPt && !_npUiFrame) _npUiFrame = requestAnimationFrame(_npUiSpatialFrame);
}

/* ── Keyboard cursor over the choices ───────────────────────────── */

const _npKb = { key: '', idx: -1 };

function _npKbList() {
  return Array.from(document.querySelectorAll(
    '#np-bubbles-container .np-choice:not(.is-locked), #np-bubbles-container .np-confirm-btn:not(:disabled)'));
}

/** Move the cursor one choice up or down. Returns false when there is nothing to move over. */
function npKbMove(delta) {
  const list = _npKbList();
  if (!list.length) return false;
  let i = list.indexOf(document.activeElement);
  if (i < 0) i = delta > 0 ? 0 : list.length - 1;
  else i = (i + delta + list.length) % list.length;
  const el = list[i];
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  _npKb.idx = i;
  if (typeof npHoverSpeak === 'function' && el.classList.contains('np-choice')) npHoverSpeak(el);
  return true;
}

/* ── "Saved · Ns ago", beside the shortcuts ─────────────────────
   The coding attempt's chip (practice.js _bossMarkSaved / _renderSavedState),
   with its own clock so the two screens never share a timestamp. */
let _npUiSavedAt = 0;
let _npUiSavedTick = null;

function npUiMarkSaved() {
  // Leaving the attempt saves one last time after the screen is torn down;
  // that save must not start a ticker for a chip that no longer exists.
  if (!_npUiRoot) return;
  _npUiSavedAt = Date.now();
  _npUiPaintSaved();
  if (!_npUiSavedTick) _npUiSavedTick = setInterval(_npUiPaintSaved, 5000);
}

function _npUiPaintSaved() {
  const el = document.getElementById('np-save-state');
  if (!el) return;
  if (!_npUiSavedAt) { el.textContent = ''; return; }
  const secs = Math.round((Date.now() - _npUiSavedAt) / 1000);
  const when = secs < 5 ? 'just now' : secs < 60 ? secs + 's ago' : Math.round(secs / 60) + 'm ago';
  el.innerHTML = '<i data-lucide="check-circle-2" style="width:12px;height:12px;"></i> Saved ' + when;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: el });
}

function _npUiStopSaved() {
  if (_npUiSavedTick) { clearInterval(_npUiSavedTick); _npUiSavedTick = null; }
  _npUiSavedAt = 0;
}

/** Stepping out of the answer box: light the button the next arrow will press. */
function npUiNudgeNav(dir) {
  const btn = document.getElementById(dir > 0 ? 'np-btn-next' : 'np-btn-prev');
  if (!btn || btn.disabled) return;
  btn.classList.remove('np-nudge');
  void btn.offsetWidth;
  btn.classList.add('np-nudge');
  setTimeout(() => btn.classList.remove('np-nudge'), 900);
}

/* ── Wrong answer: the cross rain ───────────────────────────────── */
let _npUiXKey = '';

function _npUiDropX(type) {
  const root = _npUiRoot;
  if (!root || root.dataset.npMotion === 'off') return;
  /* The coding attempt's own failed-test effect (practice-panel.js
     _ppCrossRain): a shower of small crosses falling out of the thing that
     was wrong. Called, not copied, so the two screens can never drift apart.
     Its layer is fixed over the whole window, so the choices re-rendering
     underneath it during grading does not cut it short. */
  if (typeof _ppCrossRain !== 'function') return;
  let targets = Array.from(document.querySelectorAll('#np-bubbles-container .np-choice.is-wrong'));
  if (!targets.length && type === 'checkbox') targets = Array.from(document.querySelectorAll('#np-bubbles-container .np-choice.is-missed'));
  if (!targets.length && type === 'matching') targets = Array.from(document.querySelectorAll('#np-bubbles-container .np-match-left.np-match-wrong'));
  if (!targets.length && type === 'text') targets = [document.getElementById('np-text-answer-input')].filter(Boolean);
  targets.slice(0, 4).forEach((t, i) => {
    const r = t.getBoundingClientRect();
    if (!r.width || r.bottom < 0 || r.top > window.innerHeight) return;
    setTimeout(() => _ppCrossRain(r), i * 90);
  });
}

/* ── The Incorrect sheet ────────────────────────────────────────
   Replaces the shared dialog for this screen: the question, your answer and
   the right one side by side (or pair by pair for matching), the explanation,
   and Continue -- which Enter presses. Escape closes it and stays on the
   question, so the marked-up card can be read. */
function npUiShowWrong(o) {
  npUiCloseWrong();
  const esc = (s) => escapeHTML(String(s == null ? '' : s));
  let body = '';
  if (o.type === 'matching' && Array.isArray(o.pairs)) {
    body = '<div class="np-wrong-pairs">' + o.pairs.map(p =>
      '<div class="np-wrong-pair ' + (p.ok ? 'is-ok' : 'is-bad') + '">'
      + '<span class="np-wrong-pair-left">' + esc(p.left) + '</span>'
      + '<i data-lucide="arrow-right"></i>'
      + '<span class="np-wrong-pair-right">'
      + (!p.ok && p.yours ? '<s>' + esc(p.yours) + '</s>' : '')
      + '<b>' + esc(p.right) + '</b></span>'
      + '<i data-lucide="' + (p.ok ? 'check' : 'x') + '" class="np-wrong-pair-mark"></i>'
      + '</div>').join('') + '</div>';
  } else {
    body = '<div class="np-wrong-compare">'
      + '<div class="np-wrong-row is-yours"><span class="np-wrong-ico"><i data-lucide="x"></i></span>'
      + '<span class="np-wrong-txt"><em>Your answer</em><strong>' + esc(o.yours || '—') + '</strong></span></div>'
      + '<div class="np-wrong-row is-right"><span class="np-wrong-ico"><i data-lucide="check"></i></span>'
      + '<span class="np-wrong-txt"><em>Correct answer</em><strong>' + esc(o.correct || '—') + '</strong></span></div>'
      + '</div>';
  }
  const expl = o.explanation && String(o.explanation).trim()
    ? '<div class="np-wrong-expl"><div class="np-wrong-expl-title"><i data-lucide="lightbulb"></i> Explanation</div>'
      + '<div class="np-wrong-expl-body">' + esc(o.explanation).replace(/\n/g, '<br>') + '</div></div>'
    : '';
  const ov = document.createElement('div');
  ov.id = 'np-wrong';
  ov.className = 'np-wrong-overlay' + (_npUiIsSystem() ? ' is-system' : '');
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-modal', 'true');
  ov.setAttribute('aria-labelledby', 'np-wrong-title');
  ov.innerHTML = '<div class="np-wrong-card">'
    + '<div class="np-wrong-badge" aria-hidden="true"><span class="np-wrong-ring"></span>'
    + '<svg viewBox="0 0 48 48"><path d="M16 16 L32 32 M32 16 L16 32" /></svg></div>'
    + '<div class="np-wrong-kicker">Question ' + esc(o.position) + '</div>'
    + '<h2 class="np-wrong-title" id="np-wrong-title">Incorrect</h2>'
    + (o.question ? '<p class="np-wrong-q">' + esc(o.question) + '</p>' : '')
    + body + expl
    + '<div class="np-wrong-actions">'
    + '<button type="button" class="np-wrong-stay" onclick="npUiCloseWrong()">Stay here <kbd>Esc</kbd></button>'
    + '<button type="button" class="np-wrong-go" id="np-wrong-go" onclick="closeWrongAnswerPopupAndNext()">'
    + 'Continue <kbd>Enter</kbd><i data-lucide="arrow-right"></i></button>'
    + '</div></div>';
  ov.addEventListener('pointerdown', (e) => { if (e.target === ov) npUiCloseWrong(); });
  document.body.appendChild(ov);
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: ov });
  document.addEventListener('keydown', _npUiWrongKey, true);
  const go = document.getElementById('np-wrong-go');
  if (go) setTimeout(() => go.focus({ preventScroll: true }), 30);
}

function _npUiWrongKey(e) {
  if (!document.getElementById('np-wrong')) return;
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    e.stopImmediatePropagation();
    closeWrongAnswerPopupAndNext();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    e.stopImmediatePropagation();
    npUiCloseWrong();
  } else if (e.key !== 'Tab') {
    // Nothing behind the sheet answers keys while it is up.
    e.stopImmediatePropagation();
  }
}

function npUiCloseWrong() {
  document.removeEventListener('keydown', _npUiWrongKey, true);
  const ov = document.getElementById('np-wrong');
  if (ov) ov.remove();
}

/* ── The sidebar's seam: drag to size, arrow to fold away ─────────
   The same divider the coding attempt has (paneDividerTemplate), with its own
   keys so folding one screen's sidebar does not fold the other's. */
const NP_PANE_KEY = 'ssp.np.paneLeft';
const NP_SIDE_W_KEY = 'ssp.np.sideWidth';

function npUiTogglePane() {
  const root = document.getElementById('np-layout');
  if (!root) return;
  const on = !root.classList.contains('hide-left');
  root.classList.toggle('hide-left', on);
  try { localStorage.setItem(NP_PANE_KEY, on ? '1' : '0'); } catch (e) { /* private mode */ }
  _npUiSyncPaneBtn();
  window.dispatchEvent(new Event('resize'));
}

function _npUiSyncPaneBtn() {
  const root = document.getElementById('np-layout');
  const btn = document.getElementById('np-rz-btn');
  if (!root || !btn) return;
  const hidden = root.classList.contains('hide-left');
  const dir = hidden ? 'right' : 'left';
  const divider = btn.closest('.resizer-divider');
  if (divider) divider.classList.toggle('collapsed', hidden);
  btn.classList.toggle('active', hidden);
  btn.title = hidden ? 'Show the sections panel' : 'Collapse the sections panel';
  btn.setAttribute('aria-label', btn.title);
  if (btn.dataset.dir !== dir) {
    btn.dataset.dir = dir;
    btn.innerHTML = '<i data-lucide="chevron-' + dir + '"></i>';
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: btn });
  }
}

/** After a drag, keep the width the sidebar was left at. */
function _npUiSaveSideWidth() {
  const side = document.querySelector('#np-layout .np-sidebar');
  if (!side || !side.style.width || document.body.classList.contains('is-resizing')) return;
  try { localStorage.setItem(NP_SIDE_W_KEY, String(parseInt(side.style.width, 10))); } catch (e) { /* private mode */ }
}

function _npUiRestorePane() {
  const root = document.getElementById('np-layout');
  const side = root && root.querySelector('.np-sidebar');
  if (!root || !side) return;
  let w = 0;
  try { w = parseInt(localStorage.getItem(NP_SIDE_W_KEY) || '0', 10) || 0; } catch (e) { /* private mode */ }
  if (w >= 200 && w <= 640) {
    side.style.width = w + 'px';
    side.style.flexBasis = w + 'px';
  }
  let hidden = false;
  try { hidden = localStorage.getItem(NP_PANE_KEY) === '1'; } catch (e) { /* private mode */ }
  root.classList.toggle('hide-left', hidden);
  _npUiSyncPaneBtn();
}

/** Answered so far, in the title chip and along the bottom of the topbar. */
function npUiPaintProgress() {
  if (typeof activeNotebook === 'undefined' || !activeNotebook) return;
  let done = 0;
  let total = 0;
  let right = 0;
  let wrong = 0;
  (activeNotebook.sections || []).forEach((sec, si) => {
    (sec.questions || []).forEach(q => {
      total++;
      const g = gradeResults[si] && gradeResults[si][q];
      const answered = (typeof reviewMode !== 'undefined' && reviewMode)
        ? (g && g !== 'skipped')
        : (sessionStatus[si] && sessionStatus[si][q] === 'answered');
      if (!answered) return;
      done++;
      if (g === 'correct') right++;
      else if (g === 'wrong') wrong++;
    });
  });
  _npUiPaintScore(right, wrong, total);
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

/** The live score in the sidebar head: right over all, a bar, the percentage. */
function _npUiPaintScore(right, wrong, total) {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('np-score-correct', right);
  set('np-score-total', total);
  const pct = total ? Math.round((right / total) * 100) : 0;
  set('np-score-pct', pct + '%');
  const ok = document.getElementById('np-score-ok');
  const bad = document.getElementById('np-score-bad');
  if (ok) ok.style.width = (total ? (right / total) * 100 : 0).toFixed(2) + '%';
  if (bad) bad.style.width = (total ? (wrong / total) * 100 : 0).toFixed(2) + '%';
  const box = document.getElementById('np-score');
  if (box) {
    const answered = right + wrong;
    const acc = answered ? Math.round((right / answered) * 100) : 0;
    box.title = right + ' right, ' + wrong + ' wrong, ' + (total - answered) + ' to go'
      + (answered ? ' — ' + acc + '% of answered' : '');
    box.dataset.tone = !answered ? '' : (acc >= 80 ? 'good' : acc >= 50 ? 'warn' : 'bad');
  }
}

/* ── The display panel ────────────────────────────────────────── */

function _npUiSeg(key, current, opts, extraCls) {
  return '<div class="np-seg' + (extraCls ? ' ' + extraCls : '') + '" role="radiogroup">' + opts.map(o => {
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

/* The panel is four short pages rather than one long column. Stacked, its
   twelve settings ran past 1000px and read as a wall of labels; a page is a
   single decision ("how big is the text", "how wide is the layout") and fits
   without scrolling. The header steps through them (‹ › or ← →), and the
   tabs under it jump straight to one. */
const NP_UI_PAGES = [
  { id: 'text',    name: 'Text',    icon: 'type' },
  { id: 'layout',  name: 'Layout',  icon: 'layout-template' },
  { id: 'effects', name: 'Effects', icon: 'sparkles' },
  { id: 'look',    name: 'Look',    icon: 'palette' }
];
// Kept across opens: coming back to the page you were on is nearly always right.
let _npUiPage = 0;

function npUiPageGo(delta) {
  const n = NP_UI_PAGES.length;
  _npUiPage = ((_npUiPage + delta) % n + n) % n;
  _npUiRenderPanel();
}

function npUiPageSet(i) {
  if (i < 0 || i >= NP_UI_PAGES.length) return;
  _npUiPage = i;
  _npUiRenderPanel();
}

function _npUiPageBody(id, p) {
  const center = typeof npTextAlignCenter === 'undefined' ? true : npTextAlignCenter;
  if (id === 'text') {
    const alignSeg = '<div class="np-seg" role="radiogroup">'
      + '<button type="button" role="radio" aria-checked="' + center + '" class="np-seg-btn' + (center ? ' is-on' : '') + '" onclick="npUiSetAlign(true)"><i data-lucide="align-center"></i> Centre</button>'
      + '<button type="button" role="radio" aria-checked="' + !center + '" class="np-seg-btn' + (!center ? ' is-on' : '') + '" onclick="npUiSetAlign(false)"><i data-lucide="align-left"></i> Left</button>'
      + '</div>';
    return _npUiRow('a-large-small', 'Text size', _npUiNameOf('text', p.text), _npUiSeg('text', p.text, NP_UI_OPTIONS.text))
      + _npUiRow('text-quote', 'Alignment', center ? 'Centre' : 'Left', alignSeg)
      + _npUiRow('text-cursor-input', 'Question typing effect', _npUiNameOf('reveal', p.reveal), _npUiSeg('reveal', p.reveal, NP_UI_OPTIONS.reveal))
      + '<div class="np-ui-switches">'
      + _npUiSwitch('keys', p.keys, 'Letter keys on choices', 'The A, B, C you can press')
      + _npUiSwitch('confirm', p.confirm, 'Confirm before grading', 'Pick, then press again or Enter')
      + '</div>'
      + _npUiRow('skip-forward', 'After a right answer', _npUiNameOf('advance', p.advance), _npUiSeg('advance', p.advance, NP_UI_OPTIONS.advance));
  }
  if (id === 'layout') {
    return _npUiRow('scaling', 'Element size', _npUiNameOf('size', p.size), _npUiSeg('size', p.size, NP_UI_OPTIONS.size))
      + _npUiRow('stretch-horizontal', 'Question width', _npUiNameOf('width', p.width), _npUiSeg('width', p.width, NP_UI_OPTIONS.width))
      + _npUiRow('rows-3', 'Answer width', _npUiNameOf('answers', p.answers), _npUiSeg('answers', p.answers, NP_UI_OPTIONS.answers))
      + _npUiRow('grid-3x3', 'Question grid boxes', _npUiNameOf('grid', p.grid), _npUiSeg('grid', p.grid, NP_UI_OPTIONS.grid));
  }
  if (id === 'effects') {
    return _npUiRow('rotate-3d', 'Spatial effects', _npUiNameOf('spatial', p.spatial), _npUiSeg('spatial', p.spatial, NP_UI_OPTIONS.spatial))
      + '<div class="np-ui-switches">'
      + _npUiSwitch('motion', p.motion, 'Animations', 'Cards slide in, answers pop')
      + _npUiSwitch('rclick', p.rclick, 'Right-click to move', 'Left half back, right half on')
      + _npUiSwitch('sfx', p.sfx, 'Sound effects', 'Right, wrong, ticks and the finish')
      + '</div>'
      + _npUiRow('volume-2', 'Sound volume', p.vol + '%',
          '<div class="np-ui-vol"><input type="range" min="0" max="150" step="5" value="' + p.vol + '"'
          + ' aria-label="Sound volume" oninput="npUiSetVolume(this.value)" onchange="npUiSfx(\'correct\')"'
          + (p.sfx ? '' : ' disabled') + '></div>');
  }
  // look
  const ambOn = typeof ambEnabled === 'function' && ambEnabled();
  const ambCur = typeof ambTheme === 'function' ? ambTheme() : '';
  const backs = [['off', 'Off']].concat(typeof AMB_THEMES !== 'undefined' ? AMB_THEMES.map(t => [t.id, t.name]) : []);
  const backCur = ambOn ? ambCur : 'off';
  const backSeg = '<div class="np-seg np-seg-wrap" role="radiogroup">' + backs.map(b =>
    '<button type="button" role="radio" aria-checked="' + (b[0] === backCur) + '" class="np-seg-btn' + (b[0] === backCur ? ' is-on' : '') + '"'
    + ' onclick="npUiSetBackground(\'' + b[0] + '\')">' + escapeHTML(b[1]) + '</button>').join('') + '</div>';
  return _npUiRow('panels-top-left', 'Card style', _npUiNameOf('skin', p.skin), _npUiSeg('skin', p.skin, NP_UI_OPTIONS.skin))
    + _npUiRow('palette', 'Theme in this attempt', _npUiNameOf('theme', p.theme), _npUiSeg('theme', p.theme, NP_UI_OPTIONS.theme, 'np-seg-5'))
    + _npUiRow('sparkles', 'Background', backCur === 'off' ? 'Off' : (backs.find(b => b[0] === backCur) || [, ''])[1], backSeg);
}

function _npUiPanelHTML() {
  const p = npUiPrefs();
  const page = NP_UI_PAGES[_npUiPage] || NP_UI_PAGES[0];
  const tabs = NP_UI_PAGES.map((pg, i) =>
    '<button type="button" role="tab" class="np-ui-tab' + (i === _npUiPage ? ' is-on' : '') + '"'
    + ' aria-selected="' + (i === _npUiPage) + '" onclick="npUiPageSet(' + i + ')">'
    + '<i data-lucide="' + pg.icon + '"></i><span>' + pg.name + '</span></button>').join('');
  return '<div class="np-ui-head">'
    + '<span class="np-ui-title"><i data-lucide="sliders-horizontal"></i> Display</span>'
    + '<span class="np-ui-head-actions">'
    + '<button type="button" class="np-ui-edit" onclick="npUiOpenEditor()" title="Edit this notebook" aria-label="Edit this notebook"><i data-lucide="pencil"></i></button>'
    + '<button type="button" class="np-ui-reset" onclick="npUiReset()" title="Back to the defaults"><i data-lucide="rotate-ccw"></i> Reset</button>'
    + '</span>'
    + '</div>'
    + '<div class="np-ui-pager">'
    + '<button type="button" class="np-ui-step" onclick="npUiPageGo(-1)" title="Previous page (←)" aria-label="Previous page"><i data-lucide="chevron-left"></i></button>'
    + '<div class="np-ui-tabs" role="tablist" aria-label="Display settings pages">' + tabs + '</div>'
    + '<button type="button" class="np-ui-step" onclick="npUiPageGo(1)" title="Next page (→)" aria-label="Next page"><i data-lucide="chevron-right"></i></button>'
    + '</div>'
    + '<div class="np-ui-scroll" role="tabpanel" aria-label="' + page.name + '">'
    + '<div class="np-ui-page" data-page="' + page.id + '">' + _npUiPageBody(page.id, p) + '</div>'
    + '</div>'
    + '<div class="np-ui-foot"><span>' + (_npUiPage + 1) + ' of ' + NP_UI_PAGES.length + '</span>'
    + '<span>Kept on this device</span></div>';
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
  // While the panel is open, left and right turn its pages (as the Feel panel's do).
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    e.stopImmediatePropagation();
    npUiPageGo(e.key === 'ArrowRight' ? 1 : -1);
    return;
  }
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

/* ── Sound ──────────────────────────────────────────────────────
   Built from the coding attempt's tone engine (practice-sfx.js psfxTone), so
   they share its bus and its volume. Their own switch, though: the shared one
   lives with the typing sound in the coding editor's panel, which is not on
   this screen, and a notebook should not go silent because of a keyboard
   setting made somewhere else. */
function npUiSfx(kind) {
  const prefs = npUiPrefs();
  if (!prefs.sfx || typeof psfxTone !== 'function') return;
  // Its own volume, on top of the engine's (which follows the coding
  // attempt's typing slider, not reachable from here).
  const v = prefs.vol / 100;
  if (v <= 0) return;
  const t = (o) => psfxTone(Object.assign({}, o, { gain: (o.gain || 0.1) * v }));
  try {
    if (kind === 'correct' || kind === 'streak') {
      // A rising major triad, bright and short; a streak adds the octave.
      t({ freq: 659, type: 'triangle', dur: 0.1, gain: 0.12 });
      t({ freq: 784, type: 'triangle', dur: 0.1, gain: 0.11, at: 0.07 });
      t({ freq: 1047, type: 'triangle', dur: 0.2, gain: 0.12, at: 0.14 });
      t({ freq: 2093, type: 'sine', dur: 0.25, gain: 0.035, at: 0.16 });
      if (kind === 'streak') t({ freq: 1319, type: 'sine', dur: 0.32, gain: 0.07, at: 0.26 });
    } else if (kind === 'wrong') {
      // Falling and detuned, as the coding attempt's failed test is, but softer.
      t({ freq: 330, to: 247, type: 'sawtooth', dur: 0.2, gain: 0.1, lowpass: 1300 });
      t({ freq: 220, to: 165, type: 'square', dur: 0.26, gain: 0.06, lowpass: 800, at: 0.06 });
    } else if (kind === 'tick') {
      t({ freq: 1250, type: 'sine', dur: 0.045, gain: 0.05 });
    } else if (kind === 'untick') {
      t({ freq: 880, type: 'sine', dur: 0.045, gain: 0.04 });
    } else if (kind === 'link') {
      t({ freq: 880, type: 'triangle', dur: 0.06, gain: 0.07 });
      t({ freq: 1175, type: 'triangle', dur: 0.09, gain: 0.07, at: 0.05 });
    } else if (kind === 'finish' || kind === 'perfect') {
      // A sweep up, then a short fanfare landing on the octave.
      t({ freq: 196, to: 784, type: 'sawtooth', dur: 0.42, gain: 0.08, lowpass: 2600 });
      t({ freq: 392, to: 1568, type: 'triangle', dur: 0.42, gain: 0.06 });
      [523, 659, 784].forEach((f, i) => t({ freq: f, type: 'triangle', dur: 0.16, gain: 0.1, at: 0.45 + i * 0.1 }));
      t({ freq: 1047, type: 'triangle', dur: 0.5, gain: 0.11, at: 0.78 });
      if (kind === 'perfect') {
        const bells = [1319, 1568, 2093, 1760];
        for (let i = 0; i < 10; i++) {
          t({ freq: bells[i % bells.length], type: 'sine', dur: 0.26, gain: 0.045, at: 0.95 + Math.random() * 1.1 });
        }
      }
    }
  } catch (e) { /* no audio here; the attempt does not depend on it */ }
}

/** The volume slider: saved as it moves, without rebuilding the panel under the thumb. */
function npUiSetVolume(val) {
  const p = npUiPrefs();
  p.vol = Math.max(0, Math.min(150, parseInt(val, 10) || 0));
  _npUiSave(p);
  const em = document.querySelector('#np-ui-pop .np-ui-vol')?.closest('.np-ui-sec')?.querySelector('.np-ui-label em');
  if (em) em.textContent = p.vol + '%';
}

/** Three or more answered and not one of them wrong. */
function _npUiAllCorrectSoFar() {
  if (typeof gradeResults === 'undefined' || !activeNotebook) return false;
  let right = 0;
  for (let si = 0; si < (activeNotebook.sections || []).length; si++) {
    const sec = activeNotebook.sections[si];
    for (const q of (sec.questions || [])) {
      if (!sessionStatus[si] || sessionStatus[si][q] !== 'answered') continue;
      if (gradeResults[si][q] === 'wrong') return false;
      if (gradeResults[si][q] === 'correct') right++;
    }
  }
  return right >= 3;
}

/* ── The topbar folds away ──────────────────────────────────────
   The coding attempt's seam and dock (practice.js togglePracticeTopbar), on
   this screen's own key. The dock hangs from the top of the question pane;
   it is placed by measuring the pane, because the sidebar beside it is
   resizable and can be folded away too. */
const NP_TOP_KEY = 'ssp.np.paneTop';

function npUiToggleTop() {
  const root = document.getElementById('np-layout');
  if (!root) return;
  if (typeof _tbPrepareFold === 'function') _tbPrepareFold(root);
  const on = !root.classList.contains('hide-top');
  root.classList.toggle('hide-top', on);
  try { localStorage.setItem(NP_TOP_KEY, on ? '1' : '0'); } catch (e) { /* private mode */ }
  _npUiSyncTop();
  window.dispatchEvent(new Event('resize'));
}

function _npUiSyncTop() {
  const root = document.getElementById('np-layout');
  if (!root) return;
  const hidden = root.classList.contains('hide-top');
  root.classList.toggle('tb-folded', hidden);
  ['np-rz-top-btn', 'np-rz-top-dock-btn'].forEach(id => {
    const b = document.getElementById(id);
    if (b && document.activeElement === b) b.blur();
  });
  _npUiPlaceDock();
}

function _npUiPlaceDock() {
  const pane = document.getElementById('np-question-area');
  const dock = document.getElementById('np-tb-dock');
  if (!pane || !dock) return;
  dock.style.left = (pane.offsetLeft + pane.offsetWidth / 2) + 'px';
}

function _npUiRestoreTop() {
  const root = document.getElementById('np-layout');
  if (!root) return;
  let hidden = false;
  try { hidden = localStorage.getItem(NP_TOP_KEY) === '1'; } catch (e) { /* private mode */ }
  root.classList.toggle('hide-top', hidden);
  _npUiSyncTop();
}

/* ── Edit this notebook, without leaving it ─────────────────────
   The admin's own notebook form (route-admin.js getNotebookFormHTML, filled
   by admin-notebooks.js _openNotebookFormNow) in a drawer over the attempt.
   The attempt follows the form LIVE: every change to the form's draft is
   applied to what is on screen (npApplyNotebookUpdate keeps answers and
   regrades them). Saving keeps the changes; closing without saving puts the
   attempt back on the saved notebook.

   Three things in the form act on the admin page and are taken over here:
   Back (it would go to the admin list), Preview (it would restart this very
   attempt) and Escape. Save, Discard and the X are the form's own. */
let _npEdit = null;

function npUiOpenEditor() {
  if (typeof getNotebookFormHTML !== 'function' || typeof _openNotebookFormNow !== 'function'
      || typeof activeNotebook === 'undefined' || !activeNotebook) {
    if (typeof toast === 'function') toast('The notebook editor is not available here', { type: 'warning' });
    return;
  }
  if (typeof reviewMode !== 'undefined' && reviewMode) {
    if (typeof toast === 'function') toast('Editing is off while you review an attempt', { type: 'info' });
    return;
  }
  if (!(state.notebooks || []).some(n => n.id === activeNotebook.id)) return;
  _npUiPanelClose();
  if (document.getElementById('np-edit')) return;

  const ov = document.createElement('div');
  ov.id = 'np-edit';
  ov.className = 'np-edit-overlay';
  ov.innerHTML = '<div class="np-edit-backdrop"></div>'
    + '<aside class="np-edit-drawer" role="dialog" aria-modal="true" aria-label="Edit this notebook">'
    + '<div class="np-edit-bar">'
    + '<span class="np-edit-bar-title"><i data-lucide="pencil"></i> Editing while you practise</span>'
    + '<span class="np-edit-live" title="Changes show in the attempt as you make them. Save keeps them; closing without saving puts it back.">'
    + '<i></i> Live</span>'
    + '</div>'
    + '<div class="np-edit-scroll">' + getNotebookFormHTML() + '</div>'
    + '</aside>';
  document.body.appendChild(ov);
  ov.querySelector('.np-edit-backdrop').addEventListener('click', () => npUiCloseEditor());

  try { _openNotebookFormNow(activeNotebook.id); }
  catch (e) {
    ov.remove();
    if (typeof toast === 'function') toast('Could not open the editor', { type: 'error' });
    return;
  }
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: ov });

  const form = document.getElementById('notebook-form-container');
  const obs = new MutationObserver(() => {
    if (form && form.classList.contains('hidden')) npUiCloseEditor(true);
  });
  if (form) obs.observe(form, { attributes: true, attributeFilter: ['class'] });

  _npEdit = { ov, obs, sig: _npUiDraftSig(), timer: setInterval(_npUiEditSync, 600) };
  ov.addEventListener('click', _npUiEditClick, true);
  ov.addEventListener('input', _npUiEditSoon, true);
  ov.addEventListener('change', _npUiEditSoon, true);
  document.addEventListener('keydown', _npUiEditKey, true);
}

/** A cheap fingerprint of the draft, to tell when it changed. */
function _npUiDraftSig() {
  if (typeof notebookAdminState === 'undefined' || !notebookAdminState) return '';
  try { return JSON.stringify([notebookAdminState.title, notebookAdminState.sections]); } catch (e) { return ''; }
}

let _npUiEditSoonTimer = null;
function _npUiEditSoon() {
  /* The admin page marks a form dirty through listeners it binds on its own
     route (bindAdminFormListeners), which are not bound here. Without this,
     closing the drawer would drop an edit without asking first. */
  window.adminIsDirty = true;
  clearTimeout(_npUiEditSoonTimer);
  _npUiEditSoonTimer = setTimeout(_npUiEditSync, 250);
}

/* Polled as well as event-driven: the Edit Questions and Import windows are
   separate dialogs, and they write the draft when they close rather than as
   you type in this drawer. */
function _npUiEditSync() {
  if (!_npEdit || typeof notebookAdminState === 'undefined' || !notebookAdminState) return;
  const sig = _npUiDraftSig();
  if (sig === _npEdit.sig) return;
  _npEdit.sig = sig;
  // A change made in one of the form's own windows (Edit Questions, Import).
  window.adminIsDirty = true;
  const draft = JSON.parse(JSON.stringify(notebookAdminState));
  if (typeof npApplyNotebookUpdate === 'function' && npApplyNotebookUpdate(draft)) {
    const live = _npEdit.ov.querySelector('.np-edit-live');
    if (live) { live.classList.remove('is-pulse'); void live.offsetWidth; live.classList.add('is-pulse'); }
  }
}

function _npUiEditClick(e) {
  const t = e.target;
  if (!t || !t.closest) return;
  // Back would leave for the admin list; here it closes the drawer instead.
  if (t.closest('.af-back-btn')) {
    e.preventDefault();
    e.stopPropagation();
    npUiCloseEditor();
  }
}

function _npUiEditKey(e) {
  if (!_npEdit) return;
  // A dialog of the form's own (unsaved changes, tags, import, questions) is
  // up: it has the keys.
  if (document.querySelector('#dialog-modal:not(.hidden), .modal-overlay:not(.hidden):not(#np-results-overlay), #nb-tags-overlay, .nb-import-overlay, .cs-backdrop')) return;
  if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
    e.preventDefault();
    e.stopPropagation();
    if (typeof saveNotebookForm === 'function' && saveNotebookForm({ silent: true }) !== false) {
      _npUiEditSync();
      if (typeof toast === 'function') toast('Notebook saved', { type: 'success', duration: 1600 });
    }
    return;
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    npUiCloseEditor();
  }
  // Everything else reaches the form untouched. The attempt's own shortcuts
  // stand down while the drawer is open (npBindKeys checks for #np-edit).
}

/**
 * Close the drawer. From the backdrop, Back or Escape it goes through the
 * form's own unsaved-changes question; once the form has closed itself
 * (`formClosed`), the drawer goes and the attempt is put on the saved copy.
 */
function npUiCloseEditor(formClosed) {
  if (!_npEdit) return;
  if (!formClosed) {
    if (typeof confirmCloseAdminForm === 'function' && typeof closeNotebookForm === 'function') {
      confirmCloseAdminForm(closeNotebookForm, typeof saveNotebookForm === 'function' ? saveNotebookForm : null);
    } else {
      npUiCloseEditor(true);
    }
    return;
  }
  const ed = _npEdit;
  _npEdit = null;
  clearInterval(ed.timer);
  clearTimeout(_npUiEditSoonTimer);
  ed.obs.disconnect();
  ed.ov.removeEventListener('click', _npUiEditClick, true);
  document.removeEventListener('keydown', _npUiEditKey, true);
  if (typeof nbCloseTagsWindow === 'function') nbCloseTagsWindow();
  if (typeof closeBulkQuestionImport === 'function') closeBulkQuestionImport();
  ed.ov.remove();
  if (typeof notebookAdminState !== 'undefined') notebookAdminState = null;
  window.adminIsDirty = false;
  window.saveCurrentAdminForm = null;
  // Whatever was saved is what the attempt runs on now; an unsaved draft goes.
  const saved = typeof activeNotebook !== 'undefined' && activeNotebook
    ? (state.notebooks || []).find(n => n.id === activeNotebook.id) : null;
  if (saved && typeof npApplyNotebookUpdate === 'function') npApplyNotebookUpdate(saved);
}

/** Leaving the attempt with the drawer open: no questions asked, nothing kept. */
function _npUiDropEditor() {
  if (!_npEdit) return;
  const ed = _npEdit;
  _npEdit = null;
  clearInterval(ed.timer);
  clearTimeout(_npUiEditSoonTimer);
  ed.obs.disconnect();
  document.removeEventListener('keydown', _npUiEditKey, true);
  ed.ov.remove();
  if (typeof notebookAdminState !== 'undefined') notebookAdminState = null;
  window.adminIsDirty = false;
  window.saveCurrentAdminForm = null;
}

/* ── Said aloud by screen readers (an aria-live region in the template) ── */
function _npUiSay(text) {
  const el = document.getElementById('np-live');
  if (!el) return;
  el.textContent = '';
  setTimeout(() => { el.textContent = text; }, 30);
}

function _npUiIsSystem() {
  const r = document.getElementById('np-layout');
  return !!r && r.dataset.npSkin === 'system';
}

/* ── One sheet for the attempt's questions to you ──────────────────
   "Submit?", "Unfinished attempt", and anything else that needs a choice,
   in the attempt's own look instead of the app's shared dialog. Enter and
   Escape map to the actions that name them; nothing behind it takes keys. */
let _npUiSheetDone = null;

function npUiSheet(o) {
  npUiCloseSheet();
  const tone = o.tone || 'info';
  const ov = document.createElement('div');
  ov.id = 'np-sheet';
  ov.className = 'np-sheet-overlay' + (_npUiIsSystem() ? ' is-system' : '');
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-modal', 'true');
  ov.setAttribute('aria-labelledby', 'np-sheet-title');
  const acts = (o.actions || []).map((a, i) =>
    '<button type="button" class="np-sheet-btn is-' + (a.kind || 'ghost') + '" data-i="' + i + '">'
    + escapeHTML(a.label) + (a.key ? ' <kbd>' + (a.key === 'Escape' ? 'Esc' : a.key) + '</kbd>' : '')
    + (a.icon ? '<i data-lucide="' + a.icon + '"></i>' : '') + '</button>').join('');
  ov.innerHTML = '<div class="np-sheet-card" data-tone="' + tone + '">'
    + '<div class="np-sheet-badge"><i data-lucide="' + (o.icon || 'info') + '"></i></div>'
    + '<h2 class="np-sheet-title" id="np-sheet-title">' + escapeHTML(o.title || '') + '</h2>'
    + (o.body ? '<div class="np-sheet-body">' + o.body + '</div>' : '')
    + '<div class="np-sheet-actions">' + acts + '</div></div>';
  const choose = (i) => {
    const a = (o.actions || [])[i];
    npUiCloseSheet();
    if (a && typeof o.onChoose === 'function') o.onChoose(a.value);
  };
  ov.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('.np-sheet-btn');
    if (b) { choose(parseInt(b.dataset.i, 10)); return; }
    if (e.target === ov && o.dismissable !== false) npUiCloseSheet();
  });
  _npUiSheetDone = (e) => {
    if (!document.getElementById('np-sheet')) return;
    const acts2 = o.actions || [];
    if (e.key === 'Enter' || e.key === 'Escape') {
      const i = acts2.findIndex(a => a.key === e.key);
      e.preventDefault();
      e.stopImmediatePropagation();
      if (i >= 0) choose(i);
      else if (e.key === 'Escape' && o.dismissable !== false) npUiCloseSheet();
    } else if (e.key !== 'Tab') {
      e.stopImmediatePropagation();
    }
  };
  document.addEventListener('keydown', _npUiSheetDone, true);
  document.body.appendChild(ov);
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: ov });
  const first = ov.querySelector('.np-sheet-btn.is-primary') || ov.querySelector('.np-sheet-btn');
  if (first) setTimeout(() => first.focus({ preventScroll: true }), 30);
}

function npUiCloseSheet() {
  if (_npUiSheetDone) document.removeEventListener('keydown', _npUiSheetDone, true);
  _npUiSheetDone = null;
  const ov = document.getElementById('np-sheet');
  if (ov) ov.remove();
}

/* ── Question images, enlarged ───────────────────────────────────── */
function npUiZoomImage(img) {
  if (!img || !img.src) return;
  const ov = document.createElement('div');
  ov.id = 'np-zoom';
  ov.className = 'np-zoom-overlay';
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-label', 'Question image, enlarged');
  ov.innerHTML = '<img src="' + img.src.replace(/"/g, '&quot;') + '" alt="' + escapeHTML(img.alt || 'Question image') + '">'
    + '<button type="button" class="np-zoom-close" aria-label="Close"><i data-lucide="x"></i></button>';
  const close = () => { ov.remove(); document.removeEventListener('keydown', key, true); };
  const key = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); } };
  ov.addEventListener('click', close);
  document.addEventListener('keydown', key, true);
  document.body.appendChild(ov);
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: ov });
}

/* ── The pause, drawn ────────────────────────────────────────────── */
function npUiPaintPause(on) {
  const veil = document.getElementById('np-pause-veil');
  if (veil) veil.hidden = !on;
  const root = document.getElementById('np-layout');
  if (root) root.classList.toggle('np-paused', !!on);
  const clock = document.getElementById('np-timer-container');
  if (clock) {
    clock.classList.toggle('is-paused', !!on);
    clock.title = on ? 'Paused — click to resume' : 'Click to pause · right-click to change the timer';
    const old = clock.querySelector('svg, i[data-lucide]');
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', on ? 'pause' : 'clock');
    if (old) old.replaceWith(icon); else clock.prepend(icon);
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: clock });
  }
  if (on) {
    const go = document.querySelector('#np-pause-veil .np-pause-go');
    if (go) setTimeout(() => go.focus({ preventScroll: true }), 30);
    if (typeof lucide !== 'undefined' && veil) lucide.createIcons({ root: veil });
  }
  _npUiSay(on ? 'Paused.' : 'Resumed.');
}

/* ── The results ────────────────────────────────────────────────────
   A score ring, the counts, the time, each section, and what to do next:
   retry what you missed, take it again, review, or go back. Partial scores
   are amber and never red -- there is no failed state in this app. */
function npUiResultsHTML(o) {
  const pct = o.total ? Math.round((o.correct / o.total) * 100) : 0;
  const tone = pct === 100 ? 'perfect' : pct >= 80 ? 'good' : 'warn';
  const title = pct === 100 ? 'Perfect score' : pct >= 80 ? 'Great work' : pct >= 50 ? 'Good effort' : 'Keep going';
  const sub = pct === 100 ? 'Every question right.'
    : o.missed ? o.missed + ' to go over again — retry just those, or take the whole set.' : '';
  const C = 2 * Math.PI * 52;
  const secs = (o.sections || []).map(sec => {
    const sp = sec.total ? Math.round((sec.correct / sec.total) * 100) : 0;
    const st = sp === 100 ? 'perfect' : sp >= 80 ? 'good' : 'warn';
    return '<div class="np-res-sec" data-tone="' + st + '"><div class="np-res-sec-top"><span>' + escapeHTML(sec.label || 'Section')
      + '</span><b>' + sec.correct + '/' + sec.total + '</b></div><span class="np-res-sec-bar"><i style="width:' + sp + '%"></i></span></div>';
  }).join('');
  const stat = (cls, icon, n, label) => '<div class="np-res-stat ' + cls + '"><i data-lucide="' + icon + '"></i><b>' + n + '</b><em>' + label + '</em></div>';
  return '<div class="np-res-card' + (_npUiIsSystem() ? ' is-system' : '') + '" data-tone="' + tone + '">'
    + '<div class="np-res-ring" style="--np-res-c:' + C.toFixed(2) + ';--np-res-off:' + (C * (1 - pct / 100)).toFixed(2) + '">'
    + '<svg viewBox="0 0 120 120" aria-hidden="true"><circle class="np-res-track" cx="60" cy="60" r="52"></circle>'
    + '<circle class="np-res-fill" cx="60" cy="60" r="52"></circle></svg>'
    + '<div class="np-res-pct"><b>' + pct + '<small>%</small></b><em>' + o.correct + ' of ' + o.total + '</em></div></div>'
    + '<h2 class="np-res-title" id="np-results-title">' + title + '</h2>'
    + (sub ? '<p class="np-res-sub">' + sub + '</p>' : '')
    + '<div class="np-res-stats">'
    + stat('is-ok', 'check', o.correct, 'right')
    + stat('is-bad', 'x', o.wrong, 'wrong')
    + stat('is-skip', 'minus', o.skipped, 'skipped')
    + stat('is-time', 'clock', o.time, 'time')
    + '</div>'
    + (secs ? '<div class="np-res-secs">' + secs + '</div>' : '')
    + (o.queue || '')
    + '<div class="np-res-actions">'
    + (o.missed ? '<button type="button" class="np-res-btn is-primary" onclick="npRetryMissed()"><i data-lucide="rotate-ccw"></i> Retry the ' + o.missed + ' missed</button>' : '')
    + '<button type="button" class="np-res-btn ' + (o.missed ? 'is-ghost' : 'is-primary') + '" onclick="npTryAgain()"><i data-lucide="repeat"></i> Try again</button>'
    + '<button type="button" class="np-res-btn is-ghost" onclick="enterReviewMode()"><i data-lucide="eye"></i> Review answers</button>'
    + '<button type="button" class="np-res-btn is-quiet" onclick="spaNavigate(\'study\')"><i data-lucide="arrow-left"></i> Back to the library</button>'
    + '</div></div>';
}

/* ── Mount / unmount, from the route ──────────────────────────── */

function npUiMount() {
  npUiUnmount();
  const root = document.getElementById('np-layout');
  if (!root) return;
  _npUiRoot = root;
  _npUiLastKey = '';
  _npUiLastOrd = -1;
  _npUiXKey = '';
  _npKb.key = '';
  _npKb.idx = -1;
  npUiApply();
  _npUiApplyTheme();
  _npUiRestorePane();
  _npUiRestoreTop();
  root.addEventListener('pointermove', _npUiMove, { passive: true });
  root.addEventListener('pointerleave', _npUiLeave);
  root.addEventListener('pointerdown', _npUiDown);
  const pane = document.getElementById('np-question-area');
  if (pane) pane.addEventListener('contextmenu', _npUiContext);
  // Drag-to-match. The container outlives every re-render of its contents.
  const choices = document.getElementById('np-bubbles-container');
  if (choices) {
    if (typeof npDragDown === 'function') choices.addEventListener('pointerdown', npDragDown);
    if (typeof npDragClick === 'function') choices.addEventListener('click', npDragClick, true);
  }
  window.addEventListener('resize', _npUiSaveSideWidth);
  window.addEventListener('resize', _npUiPlaceDock);
}

function npUiUnmount() {
  _npUiPanelClose();
  npUiCloseWrong();
  npUiCloseSheet();
  document.getElementById('np-zoom')?.remove();
  if (_npUiRoot) {
    _npUiRoot.removeEventListener('pointermove', _npUiMove);
    _npUiRoot.removeEventListener('pointerleave', _npUiLeave);
    _npUiRoot.removeEventListener('pointerdown', _npUiDown);
    // The attempt's theme goes with it; the app gets its own back.
    _npUiRestoreTheme();
  }
  const pane = document.getElementById('np-question-area');
  if (pane) pane.removeEventListener('contextmenu', _npUiContext);
  const choices = document.getElementById('np-bubbles-container');
  if (choices) {
    if (typeof npDragDown === 'function') choices.removeEventListener('pointerdown', npDragDown);
    if (typeof npDragClick === 'function') choices.removeEventListener('click', npDragClick, true);
  }
  if (typeof _npDragCancel === 'function') _npDragCancel();
  if (typeof _npWatchMatching === 'function') _npWatchMatching(false);
  window.removeEventListener('resize', _npUiSaveSideWidth);
  window.removeEventListener('resize', _npUiPlaceDock);
  _npUiDropEditor();
  _npUiStopSaved();
  if (_npUiFrame) cancelAnimationFrame(_npUiFrame);
  _npUiFrame = 0;
  _npUiRoot = null;
  _npUiHot = null;
  _npUiPt = null;
  clearTimeout(_npUiStaggerTimer);
  document.querySelectorAll('.np-edge-flash, .np-burst').forEach(n => n.remove());
}
