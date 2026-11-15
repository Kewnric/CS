/* ============================================================
   ZEN-DOCK.JS — Run, Check and Finish while zen mode is on
   ------------------------------------------------------------
   Zen (Ctrl+\) folds the topbar and both side panels away. Run Code lives in
   the right panel, Check Code, the timer and the boss bar in the topbar, so in
   zen none of them could be reached without leaving zen. The dock is a small
   pill at the bottom right of the editor that carries them while zen is on.

   IT PRESSES THE REAL BUTTONS. Nothing here re-implements Run, Check or
   Finish: each dock button clicks the hidden original by id, so the run lock,
   the exam run count and Finish's own confirmation all behave exactly as they
   do from the panel. The timer and the boss HP are read-only mirrors of the
   originals, kept in step by observers rather than by a second clock.

   IT LIVES INSIDE .practice-layout, the element zen folds, so it is in the
   page that goes full screen and is thrown away with the route. A screen can
   replace the buttons it presses (Freeground has only Run) with
   zdockConfigure(layout, { run: fn, check: false, finish: false }).

   Per device: ssp.zenDock = { on, fade, pos: { x, y } }, where x and y are the
   gap from the layout's right and bottom edges.
   ============================================================ */

const ZDOCK_KEY = 'ssp.zenDock';
const ZDOCK_MARGIN = 16;
const ZDOCK_FADE_AFTER_MS = 600;     // typing this long fades it
const ZDOCK_UNFADE_AFTER_MS = 1500;  // and this long after the last key brings it back
const ZDOCK_NEAR_PX = 120;           // a pointer this close brings it back

let _zdock = null;

function zdockPrefs() {
  const base = { on: true, fade: true, pos: null };
  try {
    const v = JSON.parse(localStorage.getItem(ZDOCK_KEY) || '{}');
    return Object.assign(base, v && typeof v === 'object' ? v : {});
  } catch (e) { return base; }
}

function _zdockSavePrefs(patch) {
  try { localStorage.setItem(ZDOCK_KEY, JSON.stringify(Object.assign(zdockPrefs(), patch))); } catch (e) { /* private mode */ }
}

/**
 * Tell the dock which actions a screen has. Call before or after zen is on.
 * @param {Element} layout the screen's .practice-layout
 * @param {{run?: Function|false, check?: Function|false, finish?: Function|false,
 *          timerId?: string|false, hp?: boolean, runTitle?: string}} cfg
 *   A function replaces the default (pressing #pp-runcode-btn, #pp-check-btn,
 *   #pp-finish-btn); false leaves the button out.
 */
function zdockConfigure(layout, cfg) {
  if (!layout) return;
  layout._zdockCfg = cfg || {};
  if (_zdock && _zdock.layout === layout) { zdockUnmount(); zdockSync(); }
}

/** Mount or remove the dock to match zen. Called by toggleZenMode. */
function zdockSync() {
  const layout = document.querySelector('.practice-layout');
  const want = !!layout && layout.classList.contains('zen') && zdockPrefs().on;
  if (!want) { zdockUnmount(); return; }
  if (_zdock && _zdock.layout === layout && _zdock.el.isConnected) { _zdockPaint(); return; }
  zdockUnmount();
  _zdockMount(layout);
}

/** Is the dock on screen? */
function zdockActive() { return !!(_zdock && _zdock.el.isConnected); }

/** Remove the dock and everything it listens to. Safe to call any time. */
function zdockUnmount() {
  if (!_zdock) return;
  const z = _zdock;
  _zdock = null;
  z.observers.forEach(o => { try { o.disconnect(); } catch (e) { /* gone */ } });
  z.cleanup.forEach(fn => { try { fn(); } catch (e) { /* gone */ } });
  clearTimeout(z.fadeTimer); clearTimeout(z.unfadeTimer);
  if (z.el && z.el.parentNode) z.el.parentNode.removeChild(z.el);
}

/* What each button does on this screen: the configured function, or a click
   on the original. null means the button is left out. */
function _zdockAction(name) {
  const cfg = (_zdock && _zdock.cfg) || {};
  if (cfg[name] === false) return null;
  if (typeof cfg[name] === 'function') return { fn: cfg[name], target: null };
  const id = { run: 'pp-runcode-btn', check: 'pp-check-btn', finish: 'pp-finish-btn' }[name];
  if (!document.getElementById(id)) return null;
  return { fn: () => { const b = document.getElementById(id); if (b) b.click(); }, target: id };
}

function _zdockTimerEl() {
  const cfg = (_zdock && _zdock.cfg) || {};
  if (cfg.timerId === false) return null;
  if (cfg.timerId) return document.getElementById(cfg.timerId);
  return document.getElementById('practice-timer') || document.getElementById('pset-timer');
}

/* The boss bar's HP, when the bar is showing at all. Off in recall, off when
   the program has no reference, off when the player switched it off. */
function _zdockHpText() {
  const cfg = (_zdock && _zdock.cfg) || {};
  if (cfg.hp === false) return '';
  if (typeof examRecallOn === 'function' && examRecallOn()) return '';
  const wrap = document.getElementById('boss-health-wrapper');
  const hp = document.getElementById('boss-health-hp');
  if (!wrap || !hp || wrap.style.display === 'none') return '';
  const t = (hp.textContent || '').trim();
  return t && t.indexOf('—') === -1 ? t : '';
}

function _zdockMount(layout) {
  const el = document.createElement('div');
  el.className = 'zdock';
  el.id = 'zen-dock';
  el.setAttribute('role', 'toolbar');
  el.setAttribute('aria-label', 'Zen mode actions');
  _zdock = { el, layout, cfg: layout._zdockCfg || {}, observers: [], cleanup: [], fadeTimer: 0, unfadeTimer: 0 };

  const run = _zdockAction('run');
  const check = _zdockAction('check');
  const finish = _zdockAction('finish');
  const btn = (name, icon, label, title, primary) => `
    <button type="button" class="zdock-btn${primary ? ' is-primary' : ''}" data-zdock="${name}" title="${title}" aria-label="${label}">
      <i data-lucide="${icon}" aria-hidden="true"></i><span class="zdock-label">${label}</span>
    </button>`;
  el.innerHTML = `
    <span class="zdock-grip" title="Drag to move" aria-hidden="true"><i data-lucide="grip-vertical"></i></span>
    <span class="zdock-seg zdock-timer" data-zdock-seg="timer"><i data-lucide="clock" aria-hidden="true"></i><span class="zdock-timer-text"></span></span>
    <span class="zdock-seg zdock-hp" data-zdock-seg="hp" title="Boss HP"><i data-lucide="swords" aria-hidden="true"></i><span class="zdock-hp-text"></span></span>
    ${run ? btn('run', 'play', 'Run', _zdock.cfg.runTitle || 'Run Code', false) : ''}
    ${check ? btn('check', 'check-circle', 'Check', 'Check Code (Ctrl+Enter)', false) : ''}
    ${finish ? btn('finish', 'flag', 'Finish', 'Finish attempt (Ctrl+Shift+Enter)', true) : ''}`;
  layout.appendChild(el);
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: el });

  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-zdock]');
    if (!b || b.getAttribute('aria-disabled') === 'true') return;
    const a = _zdockAction(b.dataset.zdock);
    if (a) a.fn();
  });

  _zdockPlace();
  _zdockWatch();
  _zdockWireDrag();
  _zdockWireFade();
  _zdockPaint();
}

/* Keep the mirrors and the disabled states current. One observer per source,
   so the dock never polls. */
function _zdockWatch() {
  const z = _zdock;
  const paintSoon = () => { if (z === _zdock) _zdockPaint(); };
  const watch = (node, opts) => {
    if (!node) return;
    const o = new MutationObserver(paintSoon);
    o.observe(node, opts);
    z.observers.push(o);
  };
  watch(_zdockTimerEl(), { childList: true, characterData: true, subtree: true });
  watch(document.getElementById('boss-health-hp'), { childList: true, characterData: true, subtree: true });
  watch(document.getElementById('boss-health-wrapper'), { attributes: true, attributeFilter: ['style'] });
  // The panel re-renders its buttons (renderPracticePanel), so watch the host.
  watch(document.getElementById('practice-panel'), { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-disabled', 'disabled', 'class'] });
  watch(document.getElementById('pp-check-btn'), { attributes: true, attributeFilter: ['aria-disabled', 'disabled', 'class'] });
  const onResize = () => _zdockPlace();
  window.addEventListener('resize', onResize);
  z.cleanup.push(() => window.removeEventListener('resize', onResize));
}

function _zdockPaint() {
  const z = _zdock;
  if (!z) return;
  const timerEl = _zdockTimerEl();
  const tSeg = z.el.querySelector('[data-zdock-seg="timer"]');
  if (tSeg) {
    tSeg.hidden = !timerEl;
    if (timerEl) z.el.querySelector('.zdock-timer-text').textContent = timerEl.textContent;
  }
  const hpSeg = z.el.querySelector('[data-zdock-seg="hp"]');
  const hp = _zdockHpText();
  if (hpSeg) {
    hpSeg.hidden = !hp;
    z.el.querySelector('.zdock-hp-text').textContent = hp;
  }
  z.el.querySelectorAll('[data-zdock]').forEach(b => {
    const a = _zdockAction(b.dataset.zdock);
    const t = a && a.target ? document.getElementById(a.target) : null;
    const off = !!t && (t.disabled || t.getAttribute('aria-disabled') === 'true' || t.classList.contains('is-unavailable'));
    b.setAttribute('aria-disabled', off ? 'true' : 'false');
    b.classList.toggle('is-unavailable', off);
    if (t && t.title && b.dataset.zdock === 'run') b.title = t.title;
  });
}

/* ── Where it sits ─────────────────────────────────────────── */

function _zdockClamp(x, y) {
  const z = _zdock;
  const L = z.layout.getBoundingClientRect();
  const D = z.el.getBoundingClientRect();
  const maxX = Math.max(0, L.width - D.width - 4);
  const maxY = Math.max(0, L.height - D.height - 4);
  return { x: Math.min(Math.max(4, x), maxX), y: Math.min(Math.max(4, y), maxY) };
}

function _zdockApply(x, y) {
  const p = _zdockClamp(x, y);
  _zdock.el.style.right = p.x + 'px';
  _zdock.el.style.bottom = p.y + 'px';
  _zdock.x = p.x; _zdock.y = p.y;
}

function _zdockOverlaps(a, b) {
  return !!a && !!b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/* The saved place, or bottom right -- unless the Quest HUD is sitting there,
   in which case bottom left. Chosen once; after that it is wherever it was
   dragged to. */
function _zdockPlace() {
  const z = _zdock;
  if (!z) return;
  const saved = zdockPrefs().pos;
  if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') { _zdockApply(saved.x, saved.y); return; }
  _zdockApply(ZDOCK_MARGIN, ZDOCK_MARGIN);
  const hud = document.getElementById('quest-hud-root');
  if (hud && hud.offsetParent !== null && _zdockOverlaps(hud.getBoundingClientRect(), z.el.getBoundingClientRect())) {
    const L = z.layout.getBoundingClientRect();
    const D = z.el.getBoundingClientRect();
    _zdockApply(L.width - D.width - ZDOCK_MARGIN, ZDOCK_MARGIN);
  }
}

function _zdockWireDrag() {
  const z = _zdock;
  const grip = z.el.querySelector('.zdock-grip');
  if (!grip) return;
  grip.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY, ox = z.x || 0, oy = z.y || 0;
    z.el.classList.add('is-dragging');
    try { grip.setPointerCapture(e.pointerId); } catch (err) { /* old browser */ }
    const move = (ev) => { if (z === _zdock) _zdockApply(ox - (ev.clientX - sx), oy - (ev.clientY - sy)); };
    const up = () => {
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', up);
      grip.removeEventListener('pointercancel', up);
      z.el.classList.remove('is-dragging');
      if (z === _zdock) _zdockSavePrefs({ pos: { x: z.x, y: z.y } });
    };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', up);
    grip.addEventListener('pointercancel', up);
  });
}

/* ── Out of the way while typing ───────────────────────────── */

function _zdockWireFade() {
  const z = _zdock;
  const setFaded = (on) => { if (z === _zdock) z.el.classList.toggle('is-faded', on); };
  const onKey = (e) => {
    if (!zdockPrefs().fade) return;
    const t = e.target;
    if (!t || t.id !== 'editor-textarea') return;
    if (!z.fadeTimer && !z.el.classList.contains('is-faded')) {
      z.fadeTimer = setTimeout(() => { z.fadeTimer = 0; setFaded(true); }, ZDOCK_FADE_AFTER_MS);
    }
    clearTimeout(z.unfadeTimer);
    z.unfadeTimer = setTimeout(() => { clearTimeout(z.fadeTimer); z.fadeTimer = 0; setFaded(false); }, ZDOCK_UNFADE_AFTER_MS);
    _zdockAvoidCaret(t);
  };
  const onMove = (e) => {
    if (!z.el.classList.contains('is-faded')) return;
    const r = z.el.getBoundingClientRect();
    const dx = Math.max(r.left - e.clientX, 0, e.clientX - r.right);
    const dy = Math.max(r.top - e.clientY, 0, e.clientY - r.bottom);
    if (Math.hypot(dx, dy) < ZDOCK_NEAR_PX) setFaded(false);
  };
  const onCaret = (e) => { if (e.target && e.target.id === 'editor-textarea') _zdockAvoidCaret(e.target); };
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('click', onCaret, true);
  z.cleanup.push(() => {
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('click', onCaret, true);
  });
}

/* If the caret's line runs under the dock, lift the dock to the top of the
   layout until it no longer does. The line is found from the text before the
   caret, so with word wrap on it is an estimate; it errs toward lifting. */
function _zdockAvoidCaret(ta) {
  const z = _zdock;
  if (!z || !ta) return;
  setTimeout(() => {
    if (z !== _zdock) return;
    const cs = getComputedStyle(ta);
    const lh = parseFloat(cs.lineHeight) || 21;
    const line = ta.value.slice(0, ta.selectionStart || 0).split('\n').length;
    const top = ta.getBoundingClientRect().top + (parseFloat(cs.paddingTop) || 0) + (line - 1) * lh - ta.scrollTop;
    z.el.classList.remove('is-raised');
    const r = z.el.getBoundingClientRect();
    const under = top + lh > r.top - 4 && top < r.bottom + 4;
    z.el.classList.toggle('is-raised', under);
  }, 0);
}
