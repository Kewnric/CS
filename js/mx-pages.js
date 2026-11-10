/* MX-PAGES.JS — launch and result sequences, boot, theme reveal. One closure; adds to Motion. */
(function () {
  'use strict';
  const M = window.Motion;
  if (!M) return;
  // The boot class is set in index.html before first paint; it comes off once
  // the first route has drawn, so nothing replays the boot sequence later.
  const done = function () { document.documentElement.classList.remove('mx-boot'); };
  window.addEventListener('load', function () { setTimeout(done, 1600); });
})();
