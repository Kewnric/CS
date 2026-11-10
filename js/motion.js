/* ============================================================
   MOTION.JS — "Wow" interaction engine (Phase 1)
   Provides: scroll-reveal, animated count-up, stacking toasts,
   ripple, View-Transition helper, reduced-motion gate.
   No dependencies. Exposes window.Motion (+ a few global aliases).
   ============================================================ */
const Motion = (() => {
  'use strict';

  const reduceQuery =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : { matches: false };

  /* ---------- Motion level --------------------------------- */
  // 'full' | 'calm' | 'off', kept on <html data-motion> where the stylesheets
  // read it. index.html sets the attribute before first paint; this is the
  // same rule, for when the attribute is missing.
  const LEVEL_KEY = 'ssp.motion';
  const LEVELS = ['full', 'calm', 'off'];
  const LEVEL_COPY = {
    full: { label: 'Motion: Full', desc: 'Every transition and effect', icon: 'sparkles' },
    calm: { label: 'Motion: Calm', desc: 'Fades only, nothing travels', icon: 'feather' },
    off: { label: 'Motion: Off', desc: 'No animation', icon: 'ban' },
  };

  function defaultLevel() {
    if (reduceQuery.matches) return 'off';
    return window.innerWidth < 768 ? 'calm' : 'full';
  }

  function level() {
    const attr = document.documentElement.getAttribute('data-motion');
    if (LEVELS.indexOf(attr) !== -1) return attr;
    let saved = null;
    try { saved = localStorage.getItem(LEVEL_KEY); } catch (e) { /* private mode */ }
    return LEVELS.indexOf(saved) !== -1 ? saved : defaultLevel();
  }

  function setLevel(next) {
    if (LEVELS.indexOf(next) === -1) return;
    try { localStorage.setItem(LEVEL_KEY, next); } catch (e) { /* private mode */ }
    document.documentElement.setAttribute('data-motion', next);
    paintSetting();
  }

  function cycleLevel() {
    const next = LEVELS[(LEVELS.indexOf(level()) + 1) % LEVELS.length];
    setLevel(next);
    toast(LEVEL_COPY[next].label, { type: 'info', duration: 1600 });
  }

  // Keep the Settings row reading what the level actually is. Called on change
  // and again when Settings opens (another tab may have changed it).
  function paintSetting() {
    const row = document.getElementById('settings-motion-item');
    if (!row) return;
    const copy = LEVEL_COPY[level()];
    const label = document.getElementById('settings-motion-label');
    const desc = document.getElementById('settings-motion-desc');
    if (label) label.textContent = copy.label;
    if (desc) {
      // The system switch is read by the stylesheets directly, so it holds
      // whatever this row says. Say so rather than look broken.
      desc.textContent = reduceQuery.matches && level() !== 'off'
        ? 'Your system is set to reduce motion'
        : copy.desc;
    }
    if (typeof _setLucideIcon === 'function') {
      _setLucideIcon(document.getElementById('settings-motion-icon'), copy.icon);
    }
  }

  function prefersReducedMotion() {
    return !!reduceQuery.matches || level() === 'off';
  }

  // Travel, stagger and hero sequences: only at the full level.
  function isFull() {
    return !prefersReducedMotion() && level() === 'full';
  }

  /* ---------- Scroll reveal ---------------------------------- */
  let revealObserver = null;

  function ensureObserver() {
    if (revealObserver || typeof IntersectionObserver === 'undefined') return revealObserver;
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          revealNow(entry.target);
          revealObserver.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
    return revealObserver;
  }

  function revealNow(el) {
    el.classList.add('mx-revealed');
    const target = el.getAttribute('data-count-to');
    if (target !== null) countUp(el, parseFloat(target), countOptsFrom(el));
  }

  // Scan a root (default document) for [data-reveal] / [data-count-to] nodes.
  function scan(root) {
    root = root || document;
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      // Reveal + final values immediately.
      root.querySelectorAll('[data-reveal]:not(.mx-revealed)').forEach((el) => {
        el.classList.add('mx-revealed');
      });
      root.querySelectorAll('[data-count-to]').forEach((el) => {
        el.textContent = formatCount(parseFloat(el.getAttribute('data-count-to')), countOptsFrom(el));
      });
      return;
    }
    const obs = ensureObserver();
    // Stagger groups: a parent[data-reveal-stagger] gives its children an index delay.
    root.querySelectorAll('[data-reveal-stagger]').forEach((group) => {
      const step = parseInt(group.getAttribute('data-reveal-stagger'), 10) || 70;
      const kids = group.querySelectorAll(':scope > [data-reveal]');
      kids.forEach((kid, i) => {
        if (!kid.style.getPropertyValue('--mx-delay')) {
          kid.style.setProperty('--mx-delay', Math.min(i * step, 600) + 'ms');
        }
      });
    });
    root.querySelectorAll('[data-reveal]:not(.mx-revealed)').forEach((el) => obs.observe(el));
    // Count-up elements that are NOT gated behind a reveal animate on next scan tick.
    root.querySelectorAll('[data-count-to]:not([data-reveal])').forEach((el) => {
      if (el.dataset.mxCounted) return;
      el.dataset.mxCounted = '1';
      countUp(el, parseFloat(el.getAttribute('data-count-to')), countOptsFrom(el));
    });
  }

  /* ---------- Count-up ------------------------------------- */
  function countOptsFrom(el) {
    return {
      decimals: parseInt(el.getAttribute('data-count-decimals'), 10) || 0,
      suffix: el.getAttribute('data-count-suffix') || '',
      prefix: el.getAttribute('data-count-prefix') || '',
      duration: parseInt(el.getAttribute('data-count-duration'), 10) || 1100,
    };
  }

  function formatCount(value, opts) {
    opts = opts || {};
    const n = (value || 0).toFixed(opts.decimals || 0);
    return (opts.prefix || '') + Number(n).toLocaleString() + (opts.suffix || '');
  }

  function countUp(el, target, opts) {
    opts = opts || {};
    target = isFinite(target) ? target : 0;
    el.classList.add('mx-counting');
    if (prefersReducedMotion()) {
      el.textContent = formatCount(target, opts);
      return;
    }
    const duration = opts.duration || 1100;
    const start = performance.now();
    const from = 0;
    function frame(now) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      el.textContent = formatCount(from + (target - from) * eased, opts);
      if (t < 1) requestAnimationFrame(frame);
      else el.textContent = formatCount(target, opts);
    }
    requestAnimationFrame(frame);
  }

  /* ---------- Toasts --------------------------------------- */
  const TOAST_ICONS = {
    success: 'check-circle-2',
    error: 'alert-circle',
    warning: 'alert-triangle',
    info: 'info',
  };

  function toastContainer() {
    let c = document.getElementById('mx-toast-container');
    if (!c) {
      c = document.createElement('div');
      c.id = 'mx-toast-container';
      c.setAttribute('role', 'region');
      c.setAttribute('aria-label', 'Notifications');
      c.setAttribute('aria-live', 'polite');
      document.body.appendChild(c);
    }
    return c;
  }

  // toast('Saved!', { type:'success', title:'Done', duration:3500 })
  function toast(message, opts) {
    opts = typeof opts === 'string' ? { type: opts } : opts || {};
    const type = opts.type || 'info';
    const duration = opts.duration == null ? 3600 : opts.duration;
    const el = document.createElement('div');
    el.className = 'mx-toast ' + type;
    el.innerHTML =
      '<i class="mx-toast-icon" data-lucide="' +
      (TOAST_ICONS[type] || 'info') +
      '"></i>' +
      '<div class="mx-toast-body">' +
      (opts.title ? '<div class="mx-toast-title"></div>' : '') +
      '<div class="mx-toast-msg"></div>' +
      '</div>' +
      // An optional one-click follow-up, e.g. Undo on a move.
      (opts.action ? '<button class="mx-toast-action"></button>' : '') +
      '<button class="mx-toast-close" aria-label="Dismiss"><i data-lucide="x" style="width:14px;height:14px;"></i></button>';
    if (opts.title) el.querySelector('.mx-toast-title').textContent = opts.title;
    el.querySelector('.mx-toast-msg').textContent = message == null ? '' : String(message);
    if (opts.action) {
      const act = el.querySelector('.mx-toast-action');
      act.textContent = opts.action.label || 'Undo';
      act.addEventListener('click', () => {
        try { if (opts.action.onClick) opts.action.onClick(); } finally { dismissToast(el); }
      });
    }

    if (duration > 0 && !prefersReducedMotion()) {
      const prog = document.createElement('div');
      prog.className = 'mx-toast-progress';
      prog.style.animationDuration = duration + 'ms';
      el.appendChild(prog);
    }

    const close = () => dismissToast(el);
    el.querySelector('.mx-toast-close').addEventListener('click', close);
    let timer = duration > 0 ? setTimeout(close, duration) : null;
    el.addEventListener('mouseenter', () => timer && clearTimeout(timer));
    el.addEventListener('mouseleave', () => {
      if (duration > 0) timer = setTimeout(close, 1200);
    });

    toastContainer().appendChild(el);
    if (typeof lucide !== 'undefined') lucide.createIcons({ nameAttr: 'data-lucide', root: el });
    return { dismiss: close, el };
  }

  function dismissToast(el) {
    if (!el || el.classList.contains('mx-leaving')) return;
    el.classList.add('mx-leaving');
    el.addEventListener('animationend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 400); // safety net
  }

  /* ---------- Ripple (opt-in via .mx-ripple-host) ---------- */
  function attachRipple() {
    document.addEventListener(
      'pointerdown',
      (e) => {
        if (prefersReducedMotion()) return;
        const host = e.target.closest && e.target.closest('.mx-ripple-host, .btn-primary, .btn-practice, .btn-danger');
        if (!host) return;
        const rect = host.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const span = document.createElement('span');
        span.className = 'mx-ripple';
        span.style.width = span.style.height = size + 'px';
        span.style.left = e.clientX - rect.left - size / 2 + 'px';
        span.style.top = e.clientY - rect.top - size / 2 + 'px';
        host.appendChild(span);
        span.addEventListener('animationend', () => span.remove(), { once: true });
      },
      { passive: true }
    );
  }

  /* ---------- View Transition helper ----------------------- */
  // Run a DOM-updating callback inside a View Transition when supported.
  //
  // opts.rootClass: a class put on <html> for the life of THIS transition only,
  // so CSS can change how it is captured (motion.css uses it to keep the sidebar
  // in the page snapshot when the sidebar comes or goes). It goes on before
  // startViewTransition, so both the old and the new capture see it, and comes
  // off when the transition settles -- unless a newer transition has since
  // taken over the class, in which case that one decides.
  //
  // opts.dir: which way this navigation goes ('forward', 'back', 'up', 'down',
  // 'launch', 'land', ...). Kept on <html data-nav-dir> for the same span, by
  // the same rule, so mx-nav.css can pick the keyframes for that direction.
  //
  // opts.onDone: called once when the transition settles, however it ends.
  let vtClassSeq = 0;
  let vtClassOn = null;
  let vtDirOn = false;
  let vtCurrent = null;
  function withViewTransition(updateFn, opts) {
    const onDone = (opts && typeof opts.onDone === 'function') ? opts.onDone : null;
    if (prefersReducedMotion() || typeof document.startViewTransition !== 'function') {
      updateFn();
      if (onDone) onDone();
      return null;
    }
    const rootEl = document.documentElement;
    const rootClass = (opts && opts.rootClass) || null;
    const dir = (opts && opts.dir) || null;
    const classSeq = ++vtClassSeq;
    // Starting a transition skips the one before it, so its class goes now.
    if (vtClassOn) rootEl.classList.remove(vtClassOn);
    vtClassOn = rootClass;
    if (rootClass) rootEl.classList.add(rootClass);
    if (dir) rootEl.setAttribute('data-nav-dir', dir);
    else if (vtDirOn) rootEl.removeAttribute('data-nav-dir');
    vtDirOn = !!dir;
    let settled = false;
    const dropClass = () => {
      if (!settled) { settled = true; if (onDone) { try { onDone(); } catch (e) { console.error(e); } } }
      if (classSeq !== vtClassSeq) return;
      vtCurrent = null;
      if (dir) { rootEl.removeAttribute('data-nav-dir'); vtDirOn = false; }
      if (!rootClass) return;
      rootEl.classList.remove(rootClass);
      vtClassOn = null;
    };
    try {
      const vt = document.startViewTransition(updateFn);
      vtCurrent = vt;
      // finished settles once the transition is over -- run, skipped or failed.
      if (vt && vt.finished) vt.finished.then(dropClass, dropClass);
      else dropClass();
      // Navigating again before the current transition settles aborts it, and the
      // ViewTransition promises reject. Nobody awaits them here, so an unguarded
      // reject surfaced as "Uncaught (in promise) InvalidStateError" on every fast
      // Back / sidebar click. Abort rejections are expected — swallow those only,
      // and still report anything genuinely broken inside the update callback.
      if (vt) {
        const isAbort = (err) => err && (err.name === 'AbortError' || err.name === 'InvalidStateError');
        const quiet = (p) => { if (p && typeof p.catch === 'function') p.catch(() => {}); };
        quiet(vt.ready);
        quiet(vt.finished);
        if (vt.updateCallbackDone && typeof vt.updateCallbackDone.catch === 'function') {
          vt.updateCallbackDone.catch(err => {
            if (!isAbort(err)) console.error('[Motion] View transition update failed:', err);
          });
        }
      }
      return vt;
    } catch (e) {
      updateFn();
      dropClass();
      return null;
    }
  }

  // End the running View Transition now (a key or a click during a long one).
  function skipTransition() {
    if (vtCurrent && typeof vtCurrent.skipTransition === 'function') {
      try { vtCurrent.skipTransition(); } catch (e) { /* already over */ }
    }
  }

  /* ---------- FLIP ------------------------------------------ */
  // Let a list's items glide to their new places. `mutate` changes the DOM
  // (re-render, sort, filter, add, remove); items are matched before and after
  // by opts.key(el), or by the element itself when the nodes are kept.
  //   Motion.flip(grid, () => renderCards(), { key: el => el.dataset.id })
  function flip(container, mutate, opts) {
    opts = opts || {};
    if (!container || !isFull() || typeof container.animate !== 'function') { mutate(); return; }
    const keyOf = opts.key || ((el) => el);
    const pick = () => (opts.selector ? container.querySelectorAll(opts.selector) : container.children);
    const before = new Map();
    Array.prototype.forEach.call(pick(), (el) => {
      const k = keyOf(el);
      if (k != null && k !== '') before.set(k, el.getBoundingClientRect());
    });
    mutate();
    const items = pick();
    // Past a few hundred items the measuring costs more than the effect is worth.
    if (items.length > 400) return;
    const duration = opts.duration || 320;
    Array.prototype.forEach.call(items, (el, i) => {
      const k = keyOf(el);
      const a = (k != null && k !== '') ? before.get(k) : null;
      const b = el.getBoundingClientRect();
      if (!b.width && !b.height) return;
      if (!a) {
        el.animate(
          [{ opacity: 0, transform: 'scale(0.94)' }, { opacity: 1, transform: 'none' }],
          { duration: duration, delay: Math.min(i * 18, 180), easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'backwards' }
        );
        return;
      }
      const dx = a.left - b.left;
      const dy = a.top - b.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.animate(
        [{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }],
        { duration: duration, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
      );
    });
  }

  /* ---------- Init ----------------------------------------- */
  function init() {
    toastContainer();
    attachRipple();
    paintSetting();
    scan(document);
  }

  return {
    prefersReducedMotion,
    isFull,
    level,
    setLevel,
    cycleLevel,
    paintSetting,
    scan,
    countUp,
    toast,
    dismissToast,
    withViewTransition,
    skipTransition,
    flip,
    init,
  };
})();

// Global conveniences (back-compat friendly).
window.Motion = Motion;
window.toast = Motion.toast;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', Motion.init);
} else {
  Motion.init();
}
