/* ============================================================
   MX-CONTROLS.JS — what a press feels like, and what it did
   ------------------------------------------------------------
   - Release: the pressable thing springs back (the squash is CSS).
   - Feedback: when a success or an error toast follows a click, the control
     that was clicked shows it too -- a tick or a shake where the hand is,
     not only a message in the corner. That covers every button that already
     reports through toast(), without touching any of them.
   - Glow: one soft light follows the pointer across cards. It is a single
     element in a fixed layer, clipped to the card under it; no card's own
     markup or pseudo-elements are involved.

   One closure, nothing at the top level. Adds Motion.feedback, Motion.fx.
   ============================================================ */
(function () {
  'use strict';
  const M = window.Motion;
  if (!M) return;

  const PRESS_SEL = '.card, .settings-item, .quick-action-card, .ss-preset, .tree-node-row, ' +
    '.home-stat-card.is-clickable, .lib-stat-chip, .file-tab, .quest-tab, .lang-tab, .settings-fab, ' +
    '.mx-top-btn, .btn-icon, .hero-verse-btn';
  const BUTTON_SEL = 'button, a, [role="button"], .settings-item, label';
  const GLOW_SEL = '.card, .quick-action-card, .home-stat-card, .subfolder-card, .home-card';

  let layer = null;
  function fxLayer() {
    if (!layer || !layer.isConnected) {
      layer = document.createElement('div');
      layer.id = 'mx-fx';
      layer.setAttribute('aria-hidden', 'true');
      document.body.appendChild(layer);
    }
    return layer;
  }

  /* ---------- Marks ----------------------------------------- */
  // A tick (or a cross) at a point on screen.
  M.fx = function (x, y, kind) {
    if (M.prefersReducedMotion()) return;
    const el = document.createElement('span');
    el.className = 'mx-tick' + (kind === 'error' ? ' is-error' : '');
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.innerHTML = kind === 'error'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M7 7l10 10M17 7L7 17"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
    fxLayer().appendChild(el);
    setTimeout(function () { el.remove(); }, 1000);
  };

  // Say "done" or "no" at a control.
  M.feedback = function (el, kind) {
    if (!el || !el.isConnected || M.prefersReducedMotion()) return;
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) return;
    if (typeof M.replay === 'function') M.replay(el, kind === 'error' ? 'mx-did-error' : 'mx-did');
    // Above its top-right corner, clear of the label.
    M.fx(Math.min(r.right - 4, window.innerWidth - 16), Math.max(r.top + 2, 16), kind);
  };

  /* ---------- Press, release, last click -------------------- */
  let last = null, lastAt = 0;

  document.addEventListener('pointerup', function (e) {
    if (!e.target.closest) return;
    const p = e.target.closest(PRESS_SEL);
    if (p && typeof M.replay === 'function') M.replay(p, 'mx-release');
  }, true);

  document.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    const b = e.target.closest(BUTTON_SEL);
    if (b && !b.closest('.mx-toast')) { last = b; lastAt = performance.now(); }
  }, true);

  // Toasts that answer a click.
  const toast = M.toast;
  M.toast = function (message, opts) {
    const type = typeof opts === 'string' ? opts : (opts && opts.type);
    if ((type === 'success' || type === 'error') && last && performance.now() - lastAt < 1500) {
      M.feedback(last, type === 'error' ? 'error' : 'ok');
      last = null;
    }
    return toast.apply(this, arguments);
  };
  window.toast = M.toast;

  /* ---------- Pointer glow ---------------------------------- */
  let glow = null, card = null, frame = 0, px = 0, py = 0;

  function place() {
    frame = 0;
    if (!glow || !card) return;
    if (!card.isConnected) { leave(); return; }
    const r = card.getBoundingClientRect();
    glow.style.translate = px + 'px ' + py + 'px';
    // Keep the light inside the card it is over, corners included.
    const rad = parseFloat(getComputedStyle(card).borderTopLeftRadius) || 0;
    glow.parentNode.style.clipPath = 'inset(' + r.top + 'px ' + (window.innerWidth - r.right) + 'px ' +
      (window.innerHeight - r.bottom) + 'px ' + r.left + 'px round ' + rad + 'px)';
  }

  function leave() {
    card = null;
    if (glow) glow.classList.remove('is-on');
  }

  function mountGlow() {
    // Hover only exists with a fine pointer; a finger would leave it stranded.
    if (!window.matchMedia || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute;inset:0;';
    glow = document.createElement('div');
    glow.className = 'mx-glow';
    host.appendChild(glow);
    fxLayer().appendChild(host);

    document.addEventListener('pointermove', function (e) {
      if (!M.isFull()) { if (card) leave(); return; }
      let c = e.target.closest ? e.target.closest(GLOW_SEL) : null;
      // Home's Quick Actions panel is itself a .home-card, so the gaps between
      // its action cards lit the panel behind them. Only the actions glow.
      if (c && c.id === 'home-actions') c = null;
      if (!c || !c.closest('#spa-content')) { if (card) leave(); return; }
      card = c;
      px = e.clientX;
      py = e.clientY;
      glow.classList.add('is-on');
      if (!frame) frame = requestAnimationFrame(place);
    }, { passive: true });
    document.addEventListener('scroll', function () { if (card) leave(); }, { capture: true, passive: true });
    document.addEventListener('pointerleave', leave);
  }

  if (document.readyState === 'complete') mountGlow();
  else document.addEventListener('DOMContentLoaded', mountGlow);
})();
