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
})();
