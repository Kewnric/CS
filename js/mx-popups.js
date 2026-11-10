/* ============================================================
   MX-POPUPS.JS — where popups open from, and how they leave
   ------------------------------------------------------------
   Two jobs, both done from outside the eighty-odd popups rather than inside
   each one:

   1. ORIGIN. The last control pressed is remembered, and a popup that appears
      straight after gets that point as --mx-ox / --mx-oy on itself. The
      entrances in mx-core.css grow out of it and the exits fall back into it.
      Written on the popup, never on <html>: a custom property changed on the
      root restyles the whole document (measured: 6 ms a click on Home).

   2. EXITS. A popup closed with .hidden leaves by CSS alone (a `display`
      transition, mx-core.css). One closed with .remove() is gone the moment
      the app says so -- its id, its listeners, isConnected, all as before --
      and a short-lived inert copy plays the exit in its place. That copy is
      the "ghost". The app never waits on it and never sees it by id.

   One closure, nothing at the top level. Adds Motion.origin, Motion.dismiss.
   ============================================================ */
(function () {
  'use strict';
  const M = window.Motion;
  if (!M) return;

  /* ---------- Which popups ---------------------------------- */
  // Full-screen layers: a scrim with a card on it. These get the origin and,
  // when removed, a ghost. Each has matching rules in mx-core.css; a selector
  // listed here without them only costs a clone that is dropped at once.
  const OVERLAY_SEL = [
    '.modal-overlay', '.smp-overlay', '.mindmap-overlay',
    '.prereq-picker-overlay', '.set-builder-overlay', '.nb-tags-overlay', '.nb-import-overlay',
    '.np-sheet-overlay', '.np-zoom-overlay', '.np-wrong-overlay', '.np-edit-overlay',
    '.mt-overlay', '.run-code-overlay', '.demo-overlay', '.viz-comment-editor-overlay', '.mx-overlay',
  ].join(',');
  // Small anchored things: they keep their own corner as origin, and ghost out.
  const MENU_SEL = [
    '.timer-menu', '.file-menu', '.cs-table-menu', '.viz-build-menu', '.sk-win', '.mx-menu',
  ].join(',');
  // Layers that already stage their own way in and out, or are not popups at
  // all (effects drawn over the page). Left exactly as they are.
  const EXCLUDE_SEL = [
    '.cheat-overlay', '.blr-overlay', '.boss-shatter-overlay', '.system-overlay',
    '.tutorial-overlay', '.tutorial-complete-overlay', '.hud-layer',
    '#hurt-overlay', '#stk-float', '#mx-fx', '#mx-toast-container', '[data-mx-skip]',
  ].join(',');
  const GHOST_SEL = OVERLAY_SEL + ',' + MENU_SEL;
  const MAX_GHOST_NODES = 2500;

  // The exits for .hidden shells are a `display` transition (mx-core.css).
  // dialogs.js asks, so it can drop its own scripted fade where this works.
  M.cssExits = !!(window.CSS && CSS.supports && CSS.supports('transition-behavior', 'allow-discrete'));

  /* ---------- Origin ---------------------------------------- */
  const origin = { x: 0, y: 0, t: -1e9 };
  const TRIGGER_SEL = 'button, a, [role="button"], [role="link"], [role="menuitem"], [role="tab"], ' +
    'summary, label, select, [onclick], .card, .settings-item, .tree-node-row';

  function remember(el, px, py) {
    let x = px, y = py;
    const t = el && el.closest ? el.closest(TRIGGER_SEL) : null;
    if (t) {
      const r = t.getBoundingClientRect();
      // A button is a point; a wide card or row is not, so there the pointer
      // itself is the truer origin.
      if (r.width && r.width <= 260 && r.height <= 120) {
        x = r.left + r.width / 2;
        y = r.top + r.height / 2;
      } else if (x == null) {
        x = r.left + r.width / 2;
        y = r.top + r.height / 2;
      }
    }
    if (x == null || y == null) return;
    origin.x = x;
    origin.y = y;
    origin.t = performance.now();
  }

  document.addEventListener('pointerdown', function (e) {
    remember(e.target, e.clientX, e.clientY);
  }, true);

  document.addEventListener('keydown', function (e) {
    // Enter and Space press the focused control. Anything else that opens a
    // popup is a shortcut, which has no place on screen: let it go stale.
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const a = document.activeElement;
    if (a && a !== document.body) remember(a, null, null);
  }, true);

  // Give a popup the remembered point, or the middle of the screen when the
  // press is too old to have been what opened it.
  function stamp(el) {
    const fresh = performance.now() - origin.t < 1500;
    const x = fresh ? origin.x : window.innerWidth / 2;
    const y = fresh ? origin.y : window.innerHeight / 2;
    el.style.setProperty('--mx-ox', x.toFixed(1) + 'px');
    el.style.setProperty('--mx-oy', y.toFixed(1) + 'px');
  }

  function isGhost(el) {
    return el.hasAttribute('data-mx-ghost');
  }

  // Static shells toggle .hidden; coming back from hidden is "opening".
  const classObs = new MutationObserver(function (records) {
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const el = r.target;
      const was = (' ' + (r.oldValue || '') + ' ').indexOf(' hidden ') !== -1;
      if (was && !el.classList.contains('hidden')) stamp(el);
    }
  });

  function watch(el) {
    if (el._mxWatched) return;
    el._mxWatched = true;
    classObs.observe(el, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });
  }

  function cue(fn) {
    try {
      if (typeof uisfxOn === 'function' && uisfxOn() && typeof window[fn] === 'function') window[fn]();
    } catch (e) { /* sound is never worth an error */ }
  }

  /* A full-screen layer nobody listed. Anything fixed over (nearly) the whole
     viewport that takes clicks is a popup of some kind, so it joins in rather
     than being the one window that still snaps. It gets only what it lacks:
     a fade if the layer has no entrance of its own, and the origin growth on
     any child that has none. Nothing with an animation is overridden -- some
     rest invisible and rely on theirs to be seen at all. */
  function enlist(el) {
    if (M.prefersReducedMotion()) return false;
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' || cs.pointerEvents === 'none' || cs.display === 'none') return false;
    const r = el.getBoundingClientRect();
    if (r.width < window.innerWidth * 0.9 || r.height < window.innerHeight * 0.9) return false;
    el.classList.add('mx-overlay');
    if (cs.animationName === 'none') el.classList.add('mx-in-fade');
    for (let i = 0; i < el.children.length; i++) {
      const kid = el.children[i];
      if (getComputedStyle(kid).animationName === 'none') kid.classList.add('mx-in-origin');
    }
    return true;
  }

  function adopt(el) {
    if (el.nodeType !== 1 || isGhost(el) || el.matches(EXCLUDE_SEL)) return;
    if (!el.matches(OVERLAY_SEL) && !enlist(el)) return;
    watch(el);
    if (!el.classList.contains('hidden')) {
      stamp(el);
      // The eight shells ui-sfx watches are in the page from the start; the
      // ones built on demand had no cue at all.
      cue('uisfxOpen');
    }
  }

  function start() {
    if (!document.body) return;
    document.querySelectorAll(OVERLAY_SEL).forEach(watch);
    new MutationObserver(function (records) {
      for (let i = 0; i < records.length; i++) {
        const added = records[i].addedNodes;
        for (let j = 0; j < added.length; j++) adopt(added[j]);
      }
    }).observe(document.body, { childList: true });
  }

  /* ---------- Ghost exits ----------------------------------- */
  const nativeRemove = Element.prototype.remove;
  const nativeRemoveChild = Node.prototype.removeChild;

  function ghostable(el) {
    return el.nodeType === 1 && el.isConnected && !isGhost(el) &&
      el.matches(GHOST_SEL) && !M.prefersReducedMotion();
  }

  function leave(el) {
    let g = null;
    try {
      if (el.classList.contains('hidden')) return;
      const box = el.getBoundingClientRect();
      if (!box.width && !box.height) return;
      const src = el.getElementsByTagName('*');
      if (src.length > MAX_GHOST_NODES) return;

      // What a clone does not carry: how far things were scrolled, and what
      // was drawn on a canvas.
      const scrolled = [];
      if (el.scrollTop || el.scrollLeft) scrolled.push([-1, el.scrollTop, el.scrollLeft]);
      for (let i = 0; i < src.length; i++) {
        const n = src[i];
        if (n.scrollTop || n.scrollLeft) scrolled.push([i, n.scrollTop, n.scrollLeft]);
      }

      g = el.cloneNode(true);
      g.setAttribute('data-mx-ghost', '');
      g.setAttribute('aria-hidden', 'true');
      g.removeAttribute('id');
      g.inert = true;
      const all = g.getElementsByTagName('*');
      for (let i = 0; i < all.length; i++) {
        const n = all[i];
        if (n.id) n.removeAttribute('id');
        const tag = n.tagName;
        // A cloned radio that kept its name would join the original's group
        // and uncheck it, while the app may still read the original.
        if (tag === 'INPUT' && n.type === 'radio') n.removeAttribute('name');
        else if (tag === 'IFRAME' || tag === 'VIDEO' || tag === 'AUDIO') n.removeAttribute('src');
        else if (tag === 'CANVAS') {
          try { n.getContext('2d').drawImage(src[i], 0, 0); } catch (e) { /* tainted or not 2d */ }
        }
      }

      el.parentNode.insertBefore(g, el.nextSibling);
      for (let i = 0; i < scrolled.length; i++) {
        const s = scrolled[i];
        const n = s[0] === -1 ? g : all[s[0]];
        if (n) { n.scrollTop = s[1]; n.scrollLeft = s[2]; }
      }

      // The copy is a new element, so every entrance on it would play again.
      // Jump those to their end and keep only the exits (named mxOut*).
      const exits = [];
      const anims = g.getAnimations({ subtree: true });
      for (let i = 0; i < anims.length; i++) {
        const a = anims[i];
        if (a.animationName && a.animationName.indexOf('mxOut') === 0) { exits.push(a); continue; }
        try {
          const timing = a.effect && a.effect.getComputedTiming();
          if (timing && isFinite(timing.endTime)) a.finish();
        } catch (e) { /* an endless loop cannot be finished; leave it turning */ }
      }
      const ghost = g;
      const drop = function () { if (ghost.isConnected) nativeRemove.call(ghost); };
      if (!exits.length) { drop(); return; }
      if (el.matches(OVERLAY_SEL)) cue('uisfxClose');
      Promise.all(exits.map(function (a) { return a.finished; })).then(drop, drop);
      // Frames stop in a hidden tab, and with them the promise above.
      setTimeout(drop, 700);
    } catch (e) {
      if (g && g.isConnected) nativeRemove.call(g);
    }
  }

  Element.prototype.remove = function () {
    if (ghostable(this)) leave(this);
    return nativeRemove.call(this);
  };

  Node.prototype.removeChild = function (child) {
    if (child && child.parentNode === this && ghostable(child)) leave(child);
    return nativeRemoveChild.call(this, child);
  };

  /* ---------- Public ---------------------------------------- */
  M.origin = origin;
  M.stampOrigin = stamp;

  // Close a popup the way it is built to close: .hidden for the shells that
  // stay in the page, removal for the rest. Either way the exit plays.
  M.dismiss = function (el, opts) {
    if (!el) return;
    if (opts && opts.remove) { el.remove(); return; }
    el.classList.add('hidden');
  };

  /* ---------- Search results glide ------------------------- */
  // The palette redraws its whole list on every keystroke. Wrapped here so the
  // rows that survive a keystroke slide to their new places and only the new
  // ones fade in, instead of the list blinking. Rows are matched by what they
  // do (their onclick), which is unique per result.
  function wrapSearch() {
    const draw = window.renderGlobalSearchResults;
    if (typeof draw !== 'function' || draw._mx) return;
    const wrapped = function () {
      const list = document.getElementById('global-search-results');
      const modal = document.getElementById('global-search-modal');
      // Not on the first draw: that is the palette opening, staged in CSS.
      const open = modal && !modal.classList.contains('hidden') && list && list.children.length;
      if (!open || typeof M.flip !== 'function') return draw.apply(this, arguments);
      const self = this, args = arguments;
      M.flip(list, function () { draw.apply(self, args); }, {
        selector: '.global-search-result-item',
        key: function (el) { return el.getAttribute('onclick'); },
        duration: 260,
      });
    };
    wrapped._mx = true;
    window.renderGlobalSearchResults = wrapped;
  }

  /* ---------- Small confirmations --------------------------- */
  // Replay a one-shot class animation on an element.
  // The class comes off again afterwards: these outrank an element's own
  // entrance, and one left behind would play in its place next time.
  function replay(el, cls) {
    if (!el || M.prefersReducedMotion()) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    const timers = el._mxReplay || (el._mxReplay = {});
    clearTimeout(timers[cls]);
    timers[cls] = setTimeout(function () { el.classList.remove(cls); }, 800);
  }
  M.replay = replay;

  // Settings rows that switch something rewrite their own label ("Sound On"
  // -> "Sound Off"). The new words rise into place and the row's icon pops,
  // so a switch reads as having switched.
  function watchSettings() {
    const list = document.querySelector('#settings-modal .settings-items');
    if (!list) return;
    new MutationObserver(function (records) {
      const modal = document.getElementById('settings-modal');
      if (!modal || modal.classList.contains('hidden')) return;
      const seen = [];
      for (let i = 0; i < records.length; i++) {
        let t = records[i].target;
        if (t.nodeType === 3) t = t.parentNode;
        const label = t && t.closest ? t.closest('.settings-item-label, .settings-item-desc, .settings-vol-label') : null;
        if (!label || seen.indexOf(label) !== -1) continue;
        seen.push(label);
        replay(label, 'mx-swap');
        if (label.classList.contains('settings-item-label')) {
          const row = label.closest('.settings-item');
          replay(row && row.querySelector('.settings-item-icon'), 'mx-icon-pop');
        }
      }
    }).observe(list, { childList: true, characterData: true, subtree: true });
  }

  // Leaving with unsaved work: the window being left gives a small sideways
  // "no" as the question appears.
  function wrapUnsaved() {
    const ask = window.showUnsavedConfirm;
    if (typeof ask !== 'function' || ask._mx) return;
    const wrapped = function () {
      const open = document.querySelector(
        '.modal-overlay:not(.hidden):not(#dialog-modal) > .modal-content, .admin-form-panel:not(.hidden)'
      );
      replay(open, 'mx-resist');
      return ask.apply(this, arguments);
    };
    wrapped._mx = true;
    window.showUnsavedConfirm = wrapped;
  }

  function boot() {
    start();
    wrapSearch();
    watchSettings();
    wrapUnsaved();
  }

  // Deferred scripts run before DOMContentLoaded, and navigation.js (which
  // defines the search renderer) is one of the later ones.
  if (document.readyState === 'complete') boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
