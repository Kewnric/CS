/* ============================================================
   UI-SFX.JS — the interface's own small sounds
   ------------------------------------------------------------
   Clicks, hovers, navigation, toggles, dialogs. Everywhere except the
   Visualization canvas and the Quest Board, which are left silent on purpose:
   both are places you drag things around continuously, and a sound per
   interaction there would be a stream rather than a set of events.

   THREE RULES, because UI sound goes wrong in three predictable ways.

   QUIET. These sit well under the attempt's cues — roughly a third of the
   level — because a click is confirmation, not an announcement. Anything you
   notice individually after the first hour is too loud.

   RATE LIMITED. Hover especially: sweeping a pointer across a card grid can
   cross twenty targets in a second, and one tick each is a machine gun.

   DELEGATED. Two listeners on the document rather than wiring every button in
   the app, so nothing has to be remembered when a new screen is added.

   It shares the AudioContext, the mute and the volume with the typing voice
   and the attempt cues. One sound switch for the whole app.
   ============================================================ */

/* Under the attempt cues (2.6). Confirmation, not announcement. */
const UISFX_LEVEL = 0.85;

/* Where dragging is continuous, a sound per interaction becomes a texture. */
const UISFX_SILENT_ROUTES = ['visualization', 'quests'];

const UISFX_HOVER_GAP_MS = 110;
const UISFX_CLICK_GAP_MS = 45;

let _uisfxOut = null;
let _uisfxLastHover = 0;
let _uisfxLastClick = 0;
let _uisfxLastRoute = null;

function _uisfxBus() {
  const ctx = (typeof _sfxContext === 'function') ? _sfxContext() : null;
  if (!ctx) return null;
  if (!_uisfxOut) {
    _uisfxOut = ctx.createGain();
    _uisfxOut.connect(ctx.destination);
  }
  const user = (typeof sfxVolume === 'function') ? sfxVolume() : 1;
  _uisfxOut.gain.value = UISFX_LEVEL * user;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return _uisfxOut;
}

function uisfxOn() {
  if (typeof sfxEnabled === 'function' && !sfxEnabled()) return false;
  const r = document.body.dataset.route;
  if (!r) return false;
  return UISFX_SILENT_ROUTES.indexOf(r) === -1;
}

/**
 * One short shaped tone.
 *
 * Deliberately its own helper rather than the attempt's: these need to be
 * very short and very soft, where the attempt's cues sweep and ring. Sharing
 * one function would mean a pile of options that only ever take two shapes.
 */
function uisfxTone(freq, opts) {
  const bus = _uisfxBus();
  if (!bus) return;
  const o = opts || {};
  const ctx = _sfxContext();
  const t = ctx.currentTime + (o.at || 0);
  const dur = o.dur || 0.055;

  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  const lp = ctx.createBiquadFilter();

  osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(freq, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);

  lp.type = 'lowpass';
  lp.frequency.value = o.lowpass || 3200;

  // 3ms in, then straight out. Long enough not to click, short enough that
  // two in quick succession stay two sounds rather than one smear.
  env.gain.setValueAtTime(0.0001, t);
  env.gain.linearRampToValueAtTime(o.gain || 0.16, t + 0.003);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  osc.connect(lp); lp.connect(env); env.connect(bus);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/* ── The vocabulary ───────────────────────────────────────── */

/** A card, a row, a nav item — the lightest thing here by a distance. */
function uisfxHover() {
  if (!uisfxOn()) return;
  const now = Date.now();
  if (now - _uisfxLastHover < UISFX_HOVER_GAP_MS) return;
  _uisfxLastHover = now;
  uisfxTone(2100, { dur: 0.028, gain: 0.035, type: 'sine', lowpass: 5000 });
}

/** An ordinary press. */
function uisfxClick() {
  if (!uisfxOn()) return;
  const now = Date.now();
  if (now - _uisfxLastClick < UISFX_CLICK_GAP_MS) return;
  _uisfxLastClick = now;
  uisfxTone(880, { to: 1180, dur: 0.05, gain: 0.13, type: 'triangle' });
}

/** The button that actually does the thing on the screen. */
function uisfxPrimary() {
  if (!uisfxOn()) return;
  _uisfxLastClick = Date.now();          // so a navigation it causes stays quiet
  uisfxTone(660, { to: 990, dur: 0.06, gain: 0.15, type: 'triangle' });
  uisfxTone(1320, { dur: 0.05, gain: 0.06, at: 0.035 });
}

/** Delete, reset, anything you might regret. Lower, and it falls. */
function uisfxDanger() {
  if (!uisfxOn()) return;
  _uisfxLastClick = Date.now();
  uisfxTone(340, { to: 250, dur: 0.09, gain: 0.15, type: 'triangle', lowpass: 1600 });
}

function uisfxToggle(on) {
  if (!uisfxOn()) return;
  if (on) uisfxTone(700, { to: 1050, dur: 0.06, gain: 0.13, type: 'triangle' });
  else uisfxTone(700, { to: 480, dur: 0.06, gain: 0.11, type: 'triangle' });
}

/**
 * Moving between screens: two notes, so it reads as travel.
 *
 * Skipped when a click has just been acknowledged. Almost every navigation
 * starts with pressing something, and the press already made a sound — firing
 * both meant a click-then-chime on every single nav item and hub card, which
 * is twice as much sound as the event deserves. What is left for this cue is
 * the navigation you did NOT click: the back button, a keyboard shortcut,
 * anything the app does on your behalf.
 */
function uisfxNavigate() {
  if (!uisfxOn()) return;
  if (Date.now() - _uisfxLastClick < 450) return;
  uisfxTone(520, { dur: 0.05, gain: 0.1, type: 'sine' });
  uisfxTone(780, { dur: 0.07, gain: 0.09, type: 'sine', at: 0.045 });
}

function uisfxOpen() {
  if (!uisfxOn()) return;
  uisfxTone(420, { to: 840, dur: 0.1, gain: 0.12, type: 'sine' });
}

function uisfxClose() {
  if (!uisfxOn()) return;
  uisfxTone(720, { to: 380, dur: 0.09, gain: 0.1, type: 'sine' });
}

/** Typing into a search box, where the practice typing voice does not reach. */
function uisfxKey() {
  if (!uisfxOn()) return;
  uisfxTone(1500 + Math.random() * 260, { dur: 0.022, gain: 0.045, type: 'sine', lowpass: 4200 });
}

/* ── What a click was ─────────────────────────────────────────
   Read off the classes the app already uses, so nothing needs marking up.
   ------------------------------------------------------------ */
function _uisfxKindOf(el) {
  if (!el) return null;
  if (el.closest('.btn-danger, .settings-item-danger, [data-danger]')) return 'danger';
  if (el.closest('.btn-primary, .btn-practice, .pp-finish-btn')) return 'primary';
  if (el.closest('button, a, .card, .settings-item, .tree-node-row, .lib-card, ' +
                 '.mini-stat-chip, .lib-chip, .pp-tab, [role="button"]')) return 'click';
  return null;
}

document.addEventListener('click', function (e) {
  if (!uisfxOn() || !e.target) return;
  const el = e.target.closest ? e.target : null;
  if (!el) return;

  // A checkbox or a switch reports its new state rather than a generic press.
  const box = el.closest('input[type="checkbox"], [role="switch"], [aria-pressed]');
  if (box) {
    const on = box.type === 'checkbox' ? box.checked
             : box.getAttribute('aria-pressed') !== 'true';   // pre-toggle value
    uisfxToggle(on);
    return;
  }
  const kind = _uisfxKindOf(el);
  if (kind === 'danger') uisfxDanger();
  else if (kind === 'primary') uisfxPrimary();
  else if (kind === 'click') uisfxClick();
}, true);

/* Hover, on the things that are meant to feel pickable. Not on every button:
   a toolbar you sweep past on the way somewhere else should stay quiet. */
document.addEventListener('pointerenter', function (e) {
  if (!uisfxOn() || !e.target || !e.target.closest) return;
  if (e.pointerType === 'touch') return;                 // no hover on a finger
  if (e.target.closest('.card, .lib-card, .tree-node-row, .sidebar-item, .settings-item, .wing-row')) {
    uisfxHover();
  }
}, true);

/* Typing where the practice voice does not reach. */
document.addEventListener('input', function (e) {
  if (!uisfxOn() || !e.target) return;
  const el = e.target;
  if (el.id === 'editor-textarea') return;               // the typing voice owns that
  if (!el.matches || !el.matches('.search-input, input[type="search"], #lib-hub-search')) return;
  uisfxKey();
}, true);

/* Moving between screens. */
new MutationObserver(function () {
  const r = document.body.dataset.route;
  if (r && r !== _uisfxLastRoute) {
    const first = _uisfxLastRoute === null;
    _uisfxLastRoute = r;
    if (!first) uisfxNavigate();                         // not on the first paint
    _syncAppSoundRow();
  }
}).observe(document.body, { attributes: true, attributeFilter: ['data-route'] });

/* Dialogs. The app opens and closes them by toggling .hidden on a few known
   shells, so one observer covers all of them. */
['dialog-modal', 'timer-modal', 'settings-modal', 'global-search-modal',
 'result-modal', 'hint-modal', 'answer-key-modal', 'given-question-modal']
  .forEach(function (id) {
    const watch = () => {
      const el = document.getElementById(id);
      if (!el || el._uisfxWatched) return;
      el._uisfxWatched = true;
      let was = el.classList.contains('hidden');
      new MutationObserver(() => {
        const now = el.classList.contains('hidden');
        if (now === was) return;
        was = now;
        now ? uisfxClose() : uisfxOpen();
      }).observe(el, { attributes: true, attributeFilter: ['class'] });
    };
    watch();
    document.addEventListener('DOMContentLoaded', watch);
    setTimeout(watch, 1200);
  });

/* ── The site-wide switch ─────────────────────────────────────
   The only sound control used to live in the attempt topbar, which was fine
   while sound only happened there. Now that the whole app makes noise it
   needs to be reachable from anywhere, so it goes in Settings and drives the
   same key everything else reads.
   ------------------------------------------------------------ */
function toggleAppSound() {
  if (typeof toggleTypingSfx === 'function') toggleTypingSfx();
  _syncAppSoundRow();
}

function _syncAppSoundRow() {
  const on = typeof sfxEnabled === 'function' ? sfxEnabled() : true;
  const row = document.getElementById('settings-sound-item');
  if (!row) return;
  row.setAttribute('aria-pressed', String(on));
  const label = document.getElementById('settings-sound-label');
  const desc = document.getElementById('settings-sound-desc');
  if (label) label.textContent = on ? 'Sound On' : 'Sound Off';
  if (desc) desc.textContent = on ? 'Clicks, typing and cues' : 'Everything is silent';
  if (typeof _setLucideIcon === 'function') {
    _setLucideIcon(document.getElementById('settings-sound-icon'), on ? 'volume-2' : 'volume-x');
  }
}

document.addEventListener('DOMContentLoaded', () => setTimeout(_syncAppSoundRow, 400));
setTimeout(_syncAppSoundRow, 1200);
