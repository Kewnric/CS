/* ============================================================
   WELCOME.JS — the opening sequence
   ------------------------------------------------------------
   Black, then the Status Window message, then the storage picker. The app used
   to snap straight to the picker over a dark page; this gives it a beat before
   it asks you anything.

   Assembled from the real assets in assets/sao/ rather than drawn in CSS:
   message.png is the window frame, ok/cancel.png are the buttons with their
   own -hovered variants, saoui-regular is the type, and nervegear.mp3 is the
   sound. Everything is positioned as a percentage of the frame so the whole
   window scales as one piece — the source project used fixed pixel offsets
   tied to its own page, which do not transplant.
   ============================================================ */

const SW_SEEN_KEY = 'ssp.welcomeSeen';
const SW_ASSETS = 'assets/sao/';

/* ── Sound ────────────────────────────────────────────────── */

let _swSound = null;

/**
 * The NerveGear startup, on the button press.
 *
 * Browsers refuse audio before a user gesture, so there is no attempt to play
 * it as the window appears — that would fail silently and look like a bug. The
 * press is the gesture, which is where the source project plays it too.
 */
function swPlaySound() {
  try {
    if (!_swSound) {
      _swSound = new Audio(SW_ASSETS + 'nervegear.mp3');
      _swSound.preload = 'auto';
    }
    _swSound.currentTime = 0;
    const p = _swSound.play();
    // A rejected play is not an error worth surfacing: the sequence still works
    // without sound, and the browser is entitled to refuse.
    if (p && p.catch) p.catch(() => {});
  } catch (e) { /* no audio available */ }
}
window.swPlaySound = swPlaySound;

/* ── The sequence ─────────────────────────────────────────── */

/**
 * Run the opening, then hand back.
 * @param {Function} onDone called once the message is dismissed
 */
window.swRunWelcome = function (onDone) {
  const finish = () => { if (typeof onDone === 'function') onDone(); };

  let veil = document.getElementById('sw-veil');
  if (!veil) {
    veil = document.createElement('div');
    veil.id = 'sw-veil';
    veil.className = 'sw-veil';
    document.body.appendChild(veil);
  }

  // The frame is an <img> rather than a background, so the window sizes itself
  // from the artwork and everything laid over it can be positioned against
  // that same box.
  veil.innerHTML = `
    <div class="sw-window" role="alertdialog" aria-modal="true"
         aria-labelledby="sw-title" aria-describedby="sw-msg">
      <img class="sw-frame" src="${SW_ASSETS}message.png" alt="" draggable="false">
      <div class="sw-title" id="sw-title">Message</div>
      <div class="sw-msg" id="sw-msg">Welcome to StudySession Pro !</div>
      <button class="sw-btn sw-ok" id="sw-ok" type="button" title="Continue" aria-label="Continue"></button>
      <button class="sw-btn sw-no" id="sw-no" type="button" title="Skip" aria-label="Skip"></button>
    </div>`;

  // Black first: the window is only faded up a beat later, so the page opens
  // on nothing rather than on a half-painted card.
  veil.classList.remove('is-open', 'is-leaving');
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    veil.classList.add('is-open');
  } else {
    requestAnimationFrame(() => requestAnimationFrame(() => veil.classList.add('is-open')));
  }

  let done = false;
  const close = (affirm) => {
    if (done) return;
    done = true;
    if (affirm) swPlaySound();
    veil.classList.add('is-leaving');
    document.removeEventListener('keydown', onKey, true);
    // Matches the CSS fade, then the veil goes rather than sitting over the app.
    setTimeout(() => { if (veil.parentNode) veil.remove(); finish(); }, 420);
  };

  function onKey(e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); close(true); }
    else if (e.key === 'Escape') { e.preventDefault(); close(false); }
  }

  veil.querySelector('#sw-ok').onclick = () => close(true);
  veil.querySelector('#sw-no').onclick = () => close(false);
  document.addEventListener('keydown', onKey, true);
  setTimeout(() => { const b = document.getElementById('sw-ok'); if (b) b.focus(); }, reduced ? 0 : 340);
};

/** Whether the opening should run at all. */
window.swShouldWelcome = function () {
  try { return localStorage.getItem(SW_SEEN_KEY) !== '1'; } catch (e) { return true; }
};

window.swMarkWelcomed = function () {
  try { localStorage.setItem(SW_SEEN_KEY, '1'); } catch (e) { /* quota */ }
};

/**
 * Play the opening again, now.
 *
 * Useful because the sequence is meant to be seen once: without this the only
 * way back to it is clearing a localStorage key by hand.
 */
window.swReplayWelcome = function () {
  try { localStorage.removeItem(SW_SEEN_KEY); } catch (e) { /* ignore */ }
  const popup = document.getElementById('storage-mode-popup');
  if (popup) popup.classList.add('sw-holding');
  swRunWelcome(() => {
    swMarkWelcomed();
    if (popup) { popup.classList.remove('sw-holding'); popup.classList.add('sw-revealed'); }
  });
};
