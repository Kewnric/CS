/* ============================================================
   MX-NAV.JS — which way a navigation goes, and what travels with it
   ------------------------------------------------------------
   The router asks Motion.navDir() before every route change and hands the
   answer to the View Transition, where mx-nav.css picks keyframes by it:

     forward  deeper into the app            (Library -> Coding Library)
     back     shallower, or history Back     (Coding Library -> Library)
     up/down  between the sidebar's sections, the way the rail runs
     launch   into an attempt (sidebar goes) (Coding Library -> Practice)
     land     out of an attempt
     same     the page re-rendering itself   (SpaRouter.refresh)
     boot     the first route of a page load

   One closure, nothing at the top level. Must load before router.js.
   ============================================================ */
(function () {
  'use strict';
  const M = window.Motion;
  if (!M) return;

  // The sidebar's own sections, in the order the rail shows them.
  const SECTIONS = ['home', 'library', 'analytics', 'admin', 'visualization', 'quests'];
  const RESULTS = ['solution', 'notes-solution'];

  function depthOf(name, cfg) {
    if (cfg && typeof cfg.depth === 'number') return cfg.depth;
    if (cfg && cfg.sidebarVisible === false) return RESULTS.indexOf(name) !== -1 ? 3 : 2;
    return SECTIONS.indexOf(name) !== -1 ? 0 : 1;
  }

  // Our own record of where the user has been, because the History API does
  // not say whether a hashchange was Back, Forward or a new entry.
  const trail = [];

  M.lastNavDir = null;

  M.navDir = function (from, to, fromCfg, toCfg) {
    const isBack = trail.length >= 2 && trail[trail.length - 2] === to;
    if (isBack) trail.pop();
    else if (trail[trail.length - 1] !== to) trail.push(to);
    if (trail.length > 60) trail.shift();

    let dir;
    if (!from) dir = 'boot';
    else if (from === to) dir = 'same';
    else {
      const fromFocused = !!fromCfg && fromCfg.sidebarVisible === false;
      const toFocused = !!toCfg && toCfg.sidebarVisible === false;
      const fd = depthOf(from, fromCfg);
      const td = depthOf(to, toCfg);
      if (toFocused && !fromFocused) dir = 'launch';
      else if (fromFocused && !toFocused) dir = 'land';
      else if (td > fd) dir = 'forward';
      else if (td < fd) dir = 'back';
      else if (fd === 0) dir = SECTIONS.indexOf(to) > SECTIONS.indexOf(from) ? 'down' : 'up';
      else dir = isBack ? 'back' : 'forward';
    }
    M.lastNavDir = dir;
    return dir;
  };

  /* ---------- Morph ----------------------------------------- */
  // The icon of the card you click travels and becomes the next page's
  // header icon. One View Transition name, lent to one element at each end.
  const MORPH = 'mx-morph';
  const CARD_SEL = '.card, .quick-action-card, [class*="hub-card"], .lib-card, .wing-row';
  const HEAD_SEL = '.section-header-icon-wrap, .lib-hub-hero-icon';
  let morphSrc = null, morphDst = null, morphTimer = 0;

  function clearMorph() {
    clearTimeout(morphTimer);
    if (morphSrc) morphSrc.style.viewTransitionName = '';
    if (morphDst) morphDst.style.viewTransitionName = '';
    morphSrc = morphDst = null;
  }

  document.addEventListener('click', function (e) {
    if (!M.isFull() || !e.target.closest) return;
    const card = e.target.closest(CARD_SEL);
    if (!card || !card.closest('#spa-content')) return;
    const icon = card.querySelector('svg.lucide');
    if (!icon) return;
    clearMorph();
    morphSrc = icon.parentElement && icon.parentElement !== card ? icon.parentElement : icon;
    morphSrc.style.viewTransitionName = MORPH;
    // No navigation followed: give the name back.
    morphTimer = setTimeout(clearMorph, 700);
  }, true);

  // The router calls Motion.scan once the new page is drawn, still inside the
  // transition's update -- the moment to name the far end.
  const scan = M.scan;
  M.scan = function (root) {
    if (morphSrc) {
      clearTimeout(morphTimer);
      // The old page is gone from the document; its snapshot is already taken.
      if (!morphSrc.isConnected) {
        morphDst = (root || document).querySelector(HEAD_SEL);
        if (morphDst) morphDst.style.viewTransitionName = MORPH;
        morphSrc = null;
      }
    }
    return scan.apply(this, arguments);
  };

  /* ---------- After a navigation ---------------------------- */
  M.afterNav = function (route, dir) {
    clearMorph();
    paintRail();
    hideTop();
    // Out of an attempt: pulse the selected row once so the eye lands on it.
    if (dir === 'land' && M.isFull()) {
      setTimeout(function () {
        const row = document.querySelector('#spa-content .tree-node-row.active, #spa-content .card.active, #spa-content .is-selected');
        if (!row) return;
        row.classList.add('mx-land');
        setTimeout(function () { row.classList.remove('mx-land'); }, 2000);
      }, 120);
    }
  };

  /* ---------- Sidebar rail ---------------------------------- */
  let rail = null, menu = null;

  function paintRail() {
    if (!rail || !menu) return;
    const on = menu.querySelector('.sidebar-link.active');
    // Writing a class that is already there still counts as an attribute
    // change, and this runs from an observer of exactly that. Only real changes.
    if (!on) { if (rail.classList.contains('is-on')) rail.classList.remove('is-on'); return; }
    const h = Math.round(on.offsetHeight * 0.72);
    rail.style.height = h + 'px';
    rail.style.translate = on.offsetLeft + 'px ' + Math.round(on.offsetTop + (on.offsetHeight - h) / 2) + 'px';
    if (!rail.classList.contains('is-on')) rail.classList.add('is-on');
  }

  /* ---------- Labels for the collapsed rail ------------------ */
  let tip = null;
  function showTip(link) {
    const bar = document.querySelector('.app-sidebar');
    if (!tip || !bar || bar.classList.contains('expanded') || window.innerWidth < 768) return;
    const text = link.getAttribute('aria-label') || link.textContent.trim();
    if (!text) return;
    const r = link.getBoundingClientRect();
    tip.textContent = text;
    tip.style.left = Math.round(r.right + 10) + 'px';
    tip.style.top = Math.round(r.top + r.height / 2 - 15) + 'px';
    tip.classList.add('is-on');
  }
  function hideTip() { if (tip) tip.classList.remove('is-on'); }

  /* ---------- Back to top ------------------------------------ */
  let topBtn = null, topTarget = null;
  function hideTop() { if (topBtn) topBtn.classList.remove('is-on'); topTarget = null; }

  function mount() {
    menu = document.querySelector('.sidebar-menu');
    if (menu) {
      rail = document.createElement('span');
      rail.className = 'mx-rail';
      rail.setAttribute('aria-hidden', 'true');
      menu.appendChild(rail);
      menu.classList.add('mx-has-rail');
      new MutationObserver(function (records) {
        for (let i = 0; i < records.length; i++) {
          if (records[i].target !== rail) { paintRail(); return; }
        }
      }).observe(menu, { attributes: true, attributeFilter: ['class'], subtree: true });
      window.addEventListener('resize', paintRail);
      paintRail();

      tip = document.createElement('div');
      tip.className = 'mx-rail-tip';
      tip.setAttribute('aria-hidden', 'true');
      document.body.appendChild(tip);
      menu.addEventListener('pointerover', function (e) {
        const link = e.target.closest && e.target.closest('.sidebar-link');
        if (link) showTip(link);
      });
      menu.addEventListener('pointerleave', hideTip);
      menu.addEventListener('focusin', function (e) {
        const link = e.target.closest && e.target.closest('.sidebar-link');
        if (link && link.matches(':focus-visible')) showTip(link);
      });
      menu.addEventListener('focusout', hideTip);
      menu.addEventListener('click', hideTip);
    }

    topBtn = document.createElement('button');
    topBtn.type = 'button';
    topBtn.className = 'mx-top-btn';
    topBtn.setAttribute('aria-label', 'Back to top');
    topBtn.title = 'Back to top';
    topBtn.innerHTML = '<i data-lucide="arrow-up" aria-hidden="true"></i>';
    topBtn.addEventListener('click', function () {
      if (topTarget) topTarget.scrollTo({ top: 0, behavior: M.prefersReducedMotion() ? 'auto' : 'smooth' });
    });
    document.body.appendChild(topBtn);
    if (typeof lucide !== 'undefined') lucide.createIcons();

    let ticking = false;
    document.addEventListener('scroll', function (e) {
      const el = e.target;
      if (ticking || !el || el.nodeType !== 1 || !el.closest('#spa-content')) return;
      // Only tall reading panes; never the code editor or a small list.
      if (el.clientHeight < 320 || el.closest('.editor-container, textarea, .modal-overlay')) return;
      ticking = true;
      setTimeout(function () {
        ticking = false;
        if (el.scrollTop > 700) { topTarget = el; topBtn.classList.add('is-on'); }
        else if (topTarget === el) hideTop();
      }, 120);
    }, true);
  }

  if (document.readyState === 'complete') mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
