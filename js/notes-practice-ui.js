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
  reveal:  [['off', 'Off', 'Shown at once'], ['fast', 'Fast'], ['normal', 'Normal'], ['slow', 'Slow']],
  spatial: [['off', 'Off'], ['subtle', 'Subtle'], ['full', 'Full']],
  theme:   [['app', 'App', 'Same as the app'], ['dark', 'Night'], ['light', 'Day'], ['purple', 'Purple'], ['green', 'Green']]
};

function _npUiReducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
}

/** The defaults, with motion stood down for anyone who asked their system for less. */
function _npUiDefaults() {
  const calm = _npUiReducedMotion();
  return {
    text: 'md', size: 'comfy', width: 'normal', grid: 'md',
    reveal: calm ? 'off' : 'normal', theme: 'app',
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
    grid: pick('grid'), reveal: pick('reveal'), theme: pick('theme'),
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
  if (key === 'theme') _npUiApplyTheme();
  // Switching the reveal off mid-sentence finishes the sentence.
  if (key === 'reveal' && value === 'off' && window.npQuestionAnimator && !window.npQuestionAnimator._aborted) {
    try { window.npQuestionAnimator.complete(); } catch (e) { /* already done */ }
  }
  // The lines follow sizes through their ResizeObserver; this is the fallback.
  if ((key === 'text' || key === 'size' || key === 'width') && typeof drawMatchingLines === 'function') {
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

  // A wrong answer: a red X drops onto what was picked.
  if (info && info.grading && info.result === 'wrong' && _npUiXKey !== info.key) {
    _npUiXKey = info.key;
    _npUiDropX(info.type);
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

/* ── The falling X ──────────────────────────────────────────────
   A wrong answer used to shake. Now a red X falls onto the choice that was
   picked, lands with a thump and drops away. Body-level, because grading
   re-renders the choices underneath it. */
let _npUiXKey = '';

function _npUiDropX(type) {
  const root = _npUiRoot;
  if (!root || root.dataset.npMotion === 'off') return;
  let targets = Array.from(document.querySelectorAll('#np-bubbles-container .np-choice.is-wrong'));
  if (!targets.length && type === 'checkbox') targets = Array.from(document.querySelectorAll('#np-bubbles-container .np-choice.is-missed'));
  if (!targets.length && type === 'matching') targets = Array.from(document.querySelectorAll('#np-bubbles-container .np-match-left.np-match-wrong'));
  if (!targets.length && type === 'text') targets = [document.getElementById('np-text-answer-input')].filter(Boolean);
  targets.slice(0, 4).forEach((t, i) => {
    const r = t.getBoundingClientRect();
    if (!r.width) return;
    const size = Math.round(Math.max(40, Math.min(76, r.height * 1.05)));
    const x = document.createElement('div');
    x.className = 'np-xfall';
    x.style.left = (r.left + r.width / 2) + 'px';
    x.style.top = (r.top + r.height / 2) + 'px';
    x.style.width = size + 'px';
    x.style.height = size + 'px';
    x.style.animationDelay = (i * 90) + 'ms';
    x.innerHTML = '<svg viewBox="0 0 48 48" aria-hidden="true">'
      + '<path d="M12 12 L36 36 M36 12 L12 36" /></svg>';
    document.body.appendChild(x);
    setTimeout(() => x.remove(), 1500 + i * 90);
    // The card takes the hit as the X lands.
    setTimeout(() => {
      t.classList.remove('np-hit');
      void t.offsetWidth;
      t.classList.add('np-hit');
    }, 380 + i * 90);
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
  ov.className = 'np-wrong-overlay';
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

function _npUiPanelHTML() {
  const p = npUiPrefs();
  const center = typeof npTextAlignCenter === 'undefined' ? true : npTextAlignCenter;
  const ambOn = typeof ambEnabled === 'function' && ambEnabled();
  const ambCur = typeof ambTheme === 'function' ? ambTheme() : '';
  const backs = [['off', 'Off']].concat(typeof AMB_THEMES !== 'undefined' ? AMB_THEMES.map(t => [t.id, t.name]) : []);
  const backCur = ambOn ? ambCur : 'off';

  const themeSeg = _npUiSeg('theme', p.theme, NP_UI_OPTIONS.theme, 'np-seg-5');
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
    + _npUiRow('grid-3x3', 'Question grid boxes', _npUiNameOf('grid', p.grid), _npUiSeg('grid', p.grid, NP_UI_OPTIONS.grid))
    + _npUiRow('text-quote', 'Alignment', center ? 'Centre' : 'Left', alignSeg)
    + '<div class="np-ui-group-title">Effects</div>'
    + _npUiRow('text-cursor-input', 'Question typing effect', _npUiNameOf('reveal', p.reveal), _npUiSeg('reveal', p.reveal, NP_UI_OPTIONS.reveal))
    + _npUiRow('rotate-3d', 'Spatial effects', _npUiNameOf('spatial', p.spatial), _npUiSeg('spatial', p.spatial, NP_UI_OPTIONS.spatial))
    + '<div class="np-ui-switches">'
    + _npUiSwitch('motion', p.motion, 'Animations', 'Cards slide in, answers pop and shake')
    + _npUiSwitch('keys', p.keys, 'Letter keys on choices', 'The A, B, C you can press')
    + _npUiSwitch('rclick', p.rclick, 'Right-click to move', 'Left half back, right half on')
    + '</div>'
    + '<div class="np-ui-group-title">Look</div>'
    + _npUiRow('palette', 'Theme in this attempt', _npUiNameOf('theme', p.theme), themeSeg)
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
  _npUiXKey = '';
  _npKb.key = '';
  _npKb.idx = -1;
  npUiApply();
  _npUiApplyTheme();
  _npUiRestorePane();
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
}

function npUiUnmount() {
  _npUiPanelClose();
  npUiCloseWrong();
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
  if (_npUiFrame) cancelAnimationFrame(_npUiFrame);
  _npUiFrame = 0;
  _npUiRoot = null;
  _npUiHot = null;
  _npUiPt = null;
  clearTimeout(_npUiStaggerTimer);
  document.querySelectorAll('.np-edge-flash, .np-burst, .np-xfall').forEach(n => n.remove());
}
