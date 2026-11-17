/* ============================================================
   PERF-FREEZE — nothing animates behind a blurred window
   ------------------------------------------------------------
   A backdrop blur is redrawn on every frame in which anything under it
   changes. The page has a few endless loops (the sidebar rail's glow, a
   header icon's ring, the attempt's crystal, the music beat...), so with a
   blurred window open the whole screen was re-blurred every frame: the
   Session Setup window took the Coding Library from 60 to ~22 fps, the Run
   Code window the attempt to ~35. Paused behind the window -- where they are
   blurred out of sight anyway -- the blur is drawn once and stays.

   An open window counts when it is fixed over (nearly) the whole screen and
   has a backdrop blur, on itself or on its ::before. A floating window
   (the terminal's dash, the note editor unblurred) has none, so the page
   behind keeps moving. Each frozen element gets an inline
   animation-play-state that is taken off again (so its own CSS, hover pauses
   included, rules it afterwards); animations on pseudo-elements and script
   animations are paused and played through the API.
   ============================================================ */

const PERF_FREEZE_SEL = '.modal-overlay, .smp-overlay, .run-code-overlay, .cheat-overlay, .viz-comment-editor-overlay, '
  + '.mx-overlay, .mt-overlay, .np-sheet-overlay, .np-zoom-overlay, .np-edit-overlay, .padm-overlay, '
  + '.set-builder-overlay, .prereq-picker-overlay, .nb-tags-overlay, .nb-import-overlay, .acct-recovery, .sw-overlay';

const _pf = { els: new Map(), anims: new Set(), queued: false, watched: new WeakSet(), open: false, thaw: 0 };
/* A closing window fades out over ~0.2-0.3 s, still blurred; letting the page
   move again during that fade re-blurred it every frame. */
const PERF_FREEZE_THAW_MS = 380;

/** Is a blurred window covering the page? Painters that tick fast (the
 *  stopwatch's milliseconds) hold still meanwhile. */
function perfFreezeActive() { return _pf.open; }

function _pfHasBlur(el) {
  const blurred = cs => {
    const v = cs && (cs.backdropFilter || cs.webkitBackdropFilter);
    return !!v && v !== 'none' && !/blur\(0(px)?\)/.test(v);
  };
  return blurred(getComputedStyle(el)) || blurred(getComputedStyle(el, '::before'));
}

/** The blurred windows covering the screen right now. */
function perfFreezeOpen() {
  const out = [];
  document.querySelectorAll(PERF_FREEZE_SEL).forEach(el => {
    if (el.hasAttribute('data-mx-ghost') || el.classList.contains('hidden') || el.classList.contains('is-floating')) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position !== 'fixed') return;
    const r = el.getBoundingClientRect();
    if (r.width < innerWidth * 0.9 || r.height < innerHeight * 0.9) return;
    if (_pfHasBlur(el)) out.push(el);
  });
  return out;
}

function _pfFreeze(open) {
  document.getAnimations().forEach(a => {
    const fx = a.effect;
    const t = fx && fx.target;
    if (!t || a.playState !== 'running' || fx.getTiming().iterations !== Infinity) return;
    if (open.some(o => o.contains(t))) return;
    if (typeof CSSAnimation !== 'undefined' && a instanceof CSSAnimation && !fx.pseudoElement) {
      if (_pf.els.has(t)) return;
      _pf.els.set(t, t.style.animationPlayState);
      t.style.animationPlayState = 'paused';
    } else if (!_pf.anims.has(a)) {
      _pf.anims.add(a);
      a.pause();
    }
  });
}

function _pfThaw() {
  _pf.els.forEach((prev, el) => { el.style.animationPlayState = prev || ''; });
  _pf.els.clear();
  _pf.anims.forEach(a => { try { a.play(); } catch (_) { /* gone */ } });
  _pf.anims.clear();
}

function perfFreezeCheck() {
  _pf.queued = false;
  const open = perfFreezeOpen();
  open.forEach(_pfWatch);
  if (open.length) {
    clearTimeout(_pf.thaw);
    _pf.thaw = 0;
    _pf.open = true;
    _pfFreeze(open);   // also catches loops that started behind it since
    return;
  }
  if (!_pf.els.size && !_pf.anims.size) { _pf.open = false; return; }
  if (_pf.thaw) return;
  _pf.thaw = setTimeout(() => {
    _pf.thaw = 0;
    if (perfFreezeOpen().length) return;
    _pf.open = false;
    _pfThaw();
  }, PERF_FREEZE_THAW_MS);
}

function _pfQueue() {
  if (_pf.queued) return;
  _pf.queued = true;
  // Before the next frame: the window's first frame is already a still page.
  // Reading its blur and display styles it now, which the frame needs anyway.
  queueMicrotask(perfFreezeCheck);
}

const _pfClassObs = new MutationObserver(_pfQueue);
function _pfWatch(el) {
  if (_pf.watched.has(el)) return;
  _pf.watched.add(el);
  _pfClassObs.observe(el, { attributes: true, attributeFilter: ['class', 'style'] });
}

(function perfFreezeWire() {
  if (typeof document.getAnimations !== 'function') return;
  document.querySelectorAll(PERF_FREEZE_SEL).forEach(_pfWatch);
  // Windows built on demand are put on <body>; one leaving is a close.
  new MutationObserver(records => {
    for (const r of records) {
      for (const n of r.addedNodes) if (n.nodeType === 1 && n.matches(PERF_FREEZE_SEL)) { _pfWatch(n); _pfQueue(); }
      for (const n of r.removedNodes) if (n.nodeType === 1 && n.matches(PERF_FREEZE_SEL)) _pfQueue();
    }
  }).observe(document.body, { childList: true });
})();
