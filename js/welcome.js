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

/* Version-suffixed on purpose.
   The first build of this marked the opening seen on the way IN rather than on
   completion, and fired from a code path where the picker was already being
   dismissed. Anyone who loaded that build is carrying a flag saying they have
   seen something that never reached the screen, and fixing the write does not
   undo the write that already happened. A new key owes them the showing once.
   The old one is cleared below so it is not left behind forever. */
const SW_SEEN_KEY = 'ssp.welcomeSeen.v2';
const SW_SEEN_KEY_LEGACY = 'ssp.welcomeSeen';

try { localStorage.removeItem(SW_SEEN_KEY_LEGACY); } catch (e) { /* ignore */ }
const SW_ASSETS = 'assets/sao/';

/* ── Sound ────────────────────────────────────────────────── */

const SW_SOUND_KEY = 'ssp.soundOn';

/** Off unless explicitly turned on: an app should not make noise uninvited. */
function swSoundOn() {
  try { return localStorage.getItem(SW_SOUND_KEY) === '1'; } catch (e) { return false; }
}
window.swSoundOn = swSoundOn;

function swSetSound(on) {
  try { localStorage.setItem(SW_SOUND_KEY, on ? '1' : '0'); } catch (e) { /* quota */ }
  // Both places that show this preference stay in step, wherever it was
  // changed from.
  swPaintSoundToggle();
  if (typeof swPaintSoundSetting === 'function') swPaintSoundSetting();
}
window.swSetSound = swSetSound;

window.swToggleSound = function () {
  const on = !swSoundOn();
  swSetSound(on);
  // Turning it ON plays the sound, so the switch proves itself. Turning it off
  // stays silent, which is the whole point.
  if (on) swPlaySound();
};

/** Repaint the toggle inside the welcome window, if it is on screen. */
function swPaintSoundToggle() {
  const btn = document.getElementById('sw-sound');
  if (!btn) return;
  const on = swSoundOn();
  btn.classList.toggle('is-on', on);
  btn.setAttribute('aria-pressed', String(on));
  btn.setAttribute('aria-label', on ? 'Sound on' : 'Sound off');
  btn.innerHTML = '<i data-lucide="' + (on ? 'volume-2' : 'volume-x') + '"></i>' +
                  '<span>' + (on ? 'SOUND ON' : 'SOUND OFF') + '</span>';
  if (typeof lucide !== 'undefined') lucide.createIcons({ el: btn });
}
window.swPaintSoundToggle = swPaintSoundToggle;

let _swSound = null;

/**
 * The NerveGear startup, on the button press.
 *
 * Browsers refuse audio before a user gesture, so there is no attempt to play
 * it as the window appears — that would fail silently and look like a bug. The
 * press is the gesture, which is where the source project plays it too.
 */
function swPlaySound() {
  if (!swSoundOn()) return;
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
      <button class="sw-sound" id="sw-sound" type="button" onclick="swToggleSound()"
              title="Sound is off by default" aria-pressed="false" aria-label="Sound off"></button>
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

  swPaintSoundToggle();
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

/**
 * The same preference as it appears in Settings.
 *
 * Kept in step with the toggle inside the welcome window rather than being a
 * second switch: both call swSetSound, and both are repainted from it.
 */
function swPaintSoundSetting() {
  const item = document.getElementById('settings-sound-item');
  if (!item) return;
  const on = swSoundOn();
  item.setAttribute('aria-pressed', String(on));
  item.setAttribute('aria-label', on ? 'Sound on' : 'Sound off');
  const desc = document.getElementById('settings-sound-desc');
  if (desc) desc.textContent = on ? 'On — interface sounds play' : 'Off — no sounds play';
  const icon = document.getElementById('settings-sound-icon');
  if (icon && typeof _setLucideIcon === 'function') {
    _setLucideIcon(icon, on ? 'volume-2' : 'volume-x');
  } else if (icon) {
    icon.setAttribute('data-lucide', on ? 'volume-2' : 'volume-x');
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: item });
  }
}
window.swPaintSoundSetting = swPaintSoundSetting;
