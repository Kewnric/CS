/* ============================================================
   MX-PAGES.JS — the staged moments: launch, results, boot
   ------------------------------------------------------------
   Most of each sequence is CSS (css/mx-pages.css), keyed on the direction
   the router puts on <html data-nav-dir>. This file does what CSS cannot:
   end a sequence early, count a score up, bump a value that changed.

   One closure, nothing at the top level. Adds to Motion.
   ============================================================ */
(function () {
  'use strict';
  const M = window.Motion;
  if (!M) return;
  const root = document.documentElement;

  /* ---------- Boot ------------------------------------------ */
  // index.html sets .mx-boot before first paint. It comes off once the app
  // has drawn, so the boot staging can never replay on a later navigation.
  function endBoot() { root.classList.remove('mx-boot'); }
  window.addEventListener('load', function () { setTimeout(endBoot, 1800); });

  /* ---------- Any key ends a long transition ---------------- */
  // Launching an attempt holds a View Transition for up to 700 ms, and the
  // page under one does not take clicks. Typing already reaches the editor;
  // this makes the first key or click also drop the curtain.
  function skip() {
    const dir = root.getAttribute('data-nav-dir');
    if (dir === 'launch' || dir === 'land') M.skipTransition();
  }
  document.addEventListener('keydown', skip, true);
  document.addEventListener('pointerdown', skip, true);

  /* ---------- The result window ----------------------------- */
  // Percentages in the result count up from zero as the window lands. Only
  // leaf text that is exactly a number with a % is touched.
  function countResult(modal) {
    if (!M.isFull()) return;
    const nodes = modal.querySelectorAll('#rm-title, #rm-desc *');
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i];
      if (el.children.length) continue;
      const m = /^\s*(\d{1,3})(\.\d+)?%\s*$/.exec(el.textContent || '');
      if (!m) continue;
      const target = parseFloat(m[1] + (m[2] || ''));
      M.countUp(el, target, { suffix: '%', decimals: m[2] ? m[2].length - 1 : 0, duration: 900 });
    }
  }

  function watchResult() {
    const modal = document.getElementById('result-modal');
    if (!modal) return;
    let was = modal.classList.contains('hidden');
    new MutationObserver(function () {
      const now = modal.classList.contains('hidden');
      if (now === was) return;
      was = now;
      if (!now) countResult(modal);
    }).observe(modal, { attributes: true, attributeFilter: ['class'] });
  }

  /* ---------- Values that step ------------------------------ */
  // Steppers and the time fields in Session Setup: the number that changed
  // gives a small pop, so a click on + or a preset is seen to have landed.
  function watchSteppers() {
    const modal = document.getElementById('timer-modal');
    if (!modal) return;
    const last = new WeakMap();
    const bump = function (input) {
      if (last.get(input) === input.value) return;
      last.set(input, input.value);
      if (typeof M.replay === 'function') M.replay(input, 'mx-bump');
    };
    modal.addEventListener('click', function (e) {
      if (!e.target.closest || !e.target.closest('button')) return;
      modal.querySelectorAll('input[type="number"]').forEach(bump);
    });
    modal.querySelectorAll('input[type="number"]').forEach(function (i) { last.set(i, i.value); });
  }

  /* ---------- Old page, new page ----------------------------- */
  // The router calls Motion.scan once the new page is drawn, inside the
  // transition's update. From then until the transition settles <html> carries
  // .mx-vt-new, so a rule can name an element in the old page or the new one
  // but never both.
  const scan = M.scan;
  M.scan = function () {
    if (root.hasAttribute('data-nav-dir')) root.classList.add('mx-vt-new');
    return scan.apply(this, arguments);
  };
  const afterNav = M.afterNav;
  M.afterNav = function () {
    root.classList.remove('mx-vt-new');
    if (typeof afterNav === 'function') return afterNav.apply(this, arguments);
  };

  function mount() {
    watchResult();
    watchSteppers();
  }

  if (document.readyState === 'complete') mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
