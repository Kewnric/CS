/* ============================================================
   MX-CONTROLS.JS — what a press feels like, and what it did
   ------------------------------------------------------------
   - Release: the pressable thing springs back (the squash is CSS).
   - Feedback: when a success or an error toast follows a click, the control
     that was clicked shows it too -- a tick or a shake where the hand is,
     not only a message in the corner. That covers every button that already
     reports through toast(), without touching any of them.
   - Glow: one soft light follows the pointer across cards. It is a single
     element in a fixed layer, clipped to the card under it as that card is
     now (cards move under a still pointer, see follow()); no card's own
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
  let clip = '', still = 0, spa = null, mo = null, ro = null;

  /* The light follows its card, not only the pointer.

     It is drawn where the pointer is and clipped to where the card is, but
     the pointer only reports when IT moves, and cards move under a still
     pointer: the card's own hover lift, the grid's entrance coming back from
     an attempt, a pane drawn again, the sidebar folding. Clipped once and
     left, the light kept the card's old box and showed outside it -- a pale
     band under the card, over whatever was there now -- until the mouse
     moved. So it is checked again every frame until its card has held still
     for STILL_FRAMES frames, and woken whenever the page changes under it.
     It goes out when its card is gone or no longer under the pointer. */
  const STILL_FRAMES = 8;

  // Clip the light to the card as it is now. True if nothing moved.
  function place() {
    const r = card.getBoundingClientRect();
    glow.style.translate = px + 'px ' + py + 'px';
    // Keep the light inside the card it is over, corners included.
    const rad = parseFloat(getComputedStyle(card).borderTopLeftRadius) || 0;
    const next = 'inset(' + r.top + 'px ' + (window.innerWidth - r.right) + 'px ' +
      (window.innerHeight - r.bottom) + 'px ' + r.left + 'px round ' + rad + 'px)';
    if (next === clip) return true;
    clip = next;
    glow.parentNode.style.clipPath = next;
    return false;
  }

  function follow() {
    frame = 0;
    if (!glow || !card) return;
    // The fx layer takes no pointer events, so it is not what this finds.
    const top = card.isConnected ? document.elementFromPoint(px, py) : null;
    if (!top || !card.contains(top)) { douse(); return; }
    still = place() ? still + 1 : 0;
    if (still < STILL_FRAMES) frame = requestAnimationFrame(follow);
  }

  function wake() {
    if (!card) return;
    still = 0;
    if (!frame) frame = requestAnimationFrame(follow);
  }

  // What can move a card without a pointermove is watched only while one is lit.
  function watch(on) {
    if (!spa || !spa.isConnected) spa = document.getElementById('spa-content');
    if (!spa) return;
    if (!on) { if (mo) mo.disconnect(); if (ro) ro.disconnect(); return; }
    if (!mo && typeof MutationObserver !== 'undefined') mo = new MutationObserver(wake);
    if (!ro && typeof ResizeObserver !== 'undefined') ro = new ResizeObserver(wake);
    if (mo) mo.observe(spa, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    if (ro) ro.observe(spa);
  }

  function leave() {
    if (card) watch(false);
    card = null;
    if (glow) glow.classList.remove('is-on');
  }

  /* The card is no longer what the pointer is over, and the pointer has not
     moved to say so: a click opened Session Setup over it, re-drew the pane,
     or went to another page. The layer is above every popup, so the light
     stayed on top of the dialog until the mouse moved. Out at once, not by
     the 260 ms fade, which would play over the popup's entrance. The next
     pointermove over a card lights it again. */
  function douse() {
    if (!glow || !card) return;
    leave();
    glow.style.visibility = 'hidden';
  }

  // mx-popups.js calls this as any popup opens, whatever opened it (a click,
  // a shortcut, something that finished loading).
  M.glowOff = douse;

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
      if (!card) watch(true);
      card = c;
      px = e.clientX;
      py = e.clientY;
      if (glow.style.visibility) glow.style.visibility = '';
      glow.classList.add('is-on');
      wake();
    }, { passive: true });
    document.addEventListener('scroll', function () { if (card) leave(); }, { capture: true, passive: true });
    document.addEventListener('pointerleave', leave);
    // After a click, once its handlers have run; and as anything starts to
    // animate (an entrance, the hover lift, the sidebar's width).
    document.addEventListener('click', wake, true);
    const moving = function (e) { if (card && e.target !== glow) wake(); };
    document.addEventListener('animationstart', moving, true);
    document.addEventListener('transitionstart', moving, true);
    window.addEventListener('hashchange', douse);
  }

  if (document.readyState === 'complete') mountGlow();
  else document.addEventListener('DOMContentLoaded', mountGlow);
})();
