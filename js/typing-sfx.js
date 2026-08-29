/* ============================================================
   TYPING-SFX.JS — the attempt's typing voice
   ------------------------------------------------------------
   A short blip per keystroke, in the manner of MiSide's dialogue: the
   voiceless "talking" sound that plays per character while Mita speaks.

   Synthesised rather than sampled. One recorded blip repeated at typing speed
   turns into a machine-gun very quickly — the ear picks out the identical
   attack and it stops sounding like a voice. Every blip here is built fresh
   with its own pitch, so a burst of fast typing comes out as patter.

   What makes it read as a voice rather than a beep:
     · a TRIANGLE oscillator, not a square — soft harmonics, no chiptune edge
     · a BANDPASS around the low formants, which is the nasal, vowel-ish colour
     · a short DOWNWARD pitch glide, the way a spoken syllable falls
     · a soft attack, so there is no click at the front

   Nothing is created until the first keystroke, which is itself the user
   gesture the autoplay policy wants — building the AudioContext at load would
   leave it suspended and silent.
   ============================================================ */

const SFX_KEY = 'ssp.typingSfx';

/* Two blips closer together than this are one blip. Holding a key down
   repeats at ~30ms, which without this becomes a buzz rather than a voice. */
const SFX_MIN_GAP_MS = 34;

/* Quiet on purpose: this plays on every keystroke for as long as someone is
   working, and anything louder stops being texture and becomes an intrusion.

   Not as low as it looks. The bandpass and lowpass take most of the amplitude
   out before this stage — the shaped blip reaching the bus peaks at about 0.18
   — so the figure here is close to a straight multiplier on that. At 0.16 the
   measured output was 0.028, roughly -31 dBFS, which is inaudible over a
   laptop fan. 0.8 lands it near 0.15 peak: present, and still well under a
   notification. */
const SFX_VOLUME = 0.8;

let _sfxCtx = null;
let _sfxBus = null;
let _sfxLast = 0;

/** On unless it has been switched off. The feature is the point of the button. */
function sfxEnabled() {
  try { return localStorage.getItem(SFX_KEY) !== '0'; } catch (e) { return true; }
}

/** The routes that talk. Typing in the library or the admin stays silent. */
function sfxRouteWantsSound() {
  const r = document.body.dataset.route;
  return r === 'practice' || r === 'practice-set';
}

function _sfxContext() {
  if (_sfxCtx) return _sfxCtx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  try {
    _sfxCtx = new Ctor();
    _sfxBus = _sfxCtx.createGain();
    _sfxBus.gain.value = SFX_VOLUME;
    _sfxBus.connect(_sfxCtx.destination);
  } catch (e) {
    _sfxCtx = null;
  }
  return _sfxCtx;
}

/**
 * One blip.
 *
 * @param {number} pitch  base frequency in Hz — the key class picks this
 * @param {number} length seconds; longer reads as a heavier key
 * @param {number} colour bandpass centre in Hz — lower is duller
 */
function sfxBlip(pitch, length, colour) {
  const ctx = _sfxContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const sub = ctx.createOscillator();
  const band = ctx.createBiquadFilter();
  const tame = ctx.createBiquadFilter();
  const env = ctx.createGain();

  // ±9% per blip. Without the jitter twenty keystrokes in a row are audibly
  // the same note and the whole thing sounds mechanical.
  const f = pitch * (0.91 + Math.random() * 0.18);

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(f, t);
  // The fall. A syllable drops as it ends; a beep holds its pitch.
  osc.frequency.exponentialRampToValueAtTime(f * 0.82, t + length);

  // An octave down underneath, quietly, for body.
  sub.type = 'sine';
  sub.frequency.setValueAtTime(f * 0.5, t);
  sub.frequency.exponentialRampToValueAtTime(f * 0.42, t + length);
  const subGain = ctx.createGain();
  subGain.gain.value = 0.35;

  band.type = 'bandpass';
  band.frequency.setValueAtTime(colour * (0.9 + Math.random() * 0.2), t);
  band.Q.value = 1.4;

  tame.type = 'lowpass';
  tame.frequency.value = 2600;

  // Soft in, then down in two stages. A single exponential to silence
  // collapses the blip in its first third — measured, it left 27ms audible out
  // of a 62ms envelope, which lands as a tick rather than a voice. Dropping to
  // a knee first and decaying from there keeps the body: same peak, roughly
  // twice the RMS through the middle. The linear attack is what stops the
  // front of the sound clicking.
  env.gain.setValueAtTime(0.0001, t);
  env.gain.linearRampToValueAtTime(1, t + 0.005);
  env.gain.exponentialRampToValueAtTime(0.3, t + length * 0.35);
  env.gain.exponentialRampToValueAtTime(0.0001, t + length);

  osc.connect(band);
  sub.connect(subGain);
  subGain.connect(band);
  band.connect(tame);
  tame.connect(env);
  env.connect(_sfxBus);

  osc.start(t); sub.start(t);
  osc.stop(t + length + 0.02); sub.stop(t + length + 0.02);
}

/**
 * What a key sounds like.
 *
 * Every key giving the identical blip is the thing that makes a typing sound
 * tiring. The heavy keys sit lower and last longer, so a line of code has some
 * shape to it: the return at the end of a line lands differently from the
 * letters before it.
 */
function sfxKeyVoice(key) {
  if (key === 'Enter')     return [168, 0.115, 780];   // lower, longer — a full stop
  if (key === 'Backspace') return [150, 0.075, 620];   // dull, swallowed
  if (key === 'Delete')    return [150, 0.075, 620];
  if (key === ' ')         return [196, 0.075, 820];   // the gap between words
  if (key === 'Tab')       return [180, 0.095, 700];
  return [232, 0.090, 980];                            // an ordinary character
}

/** Keys that are navigation or command, not speech. */
function sfxIsSilentKey(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return true;   // a shortcut, not typing
  const k = e.key;
  if (!k) return true;
  if (k.length === 1) return false;
  return ['Enter', 'Backspace', 'Delete', 'Tab', ' '].indexOf(k) === -1;
}

/** Only where text is actually being written. */
function sfxIsTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'TEXTAREA') return true;
  if (tag === 'INPUT') {
    const t = (el.type || 'text').toLowerCase();
    return ['text', 'search', 'url', 'email', 'number', 'tel', 'password'].indexOf(t) !== -1;
  }
  return el.isContentEditable === true;
}

/* One delegated listener for the whole app rather than a hook inside the
   editor's handler set: the editor is attached and detached per file tab, and
   the terminal, the description editor and the rename fields are all typing
   too. Capture phase so a handler that stops propagation cannot mute it. */
document.addEventListener('keydown', function (e) {
  if (e.repeat && (Date.now() - _sfxLast) < SFX_MIN_GAP_MS) return;
  if (!sfxEnabled() || !sfxRouteWantsSound()) return;
  if (sfxIsSilentKey(e) || !sfxIsTypingTarget(e.target)) return;

  const now = Date.now();
  if (now - _sfxLast < SFX_MIN_GAP_MS) return;
  _sfxLast = now;

  const voice = sfxKeyVoice(e.key);
  sfxBlip(voice[0], voice[1], voice[2]);
}, true);

/* Leaving the tab mid-sentence should not leave an oscillator running. */
document.addEventListener('visibilitychange', function () {
  if (!_sfxCtx) return;
  if (document.hidden) _sfxCtx.suspend().catch(() => {});
  else if (sfxEnabled()) _sfxCtx.resume().catch(() => {});
});

/* ── The toggle ───────────────────────────────────────────── */

function toggleTypingSfx() {
  const next = !sfxEnabled();
  try { localStorage.setItem(SFX_KEY, next ? '1' : '0'); } catch (e) { /* private mode */ }
  _syncTypingSfxBtn();
  if (next) {
    // Play the thing being switched on, so the button proves itself.
    sfxBlip(232, 0.090, 980);
    setTimeout(() => sfxBlip(210, 0.100, 900), 95);
  } else if (_sfxCtx) {
    _sfxCtx.suspend().catch(() => {});
  }
  if (typeof toast === 'function') {
    toast(next ? 'Typing sound on' : 'Typing sound off', { type: 'info', duration: 1800 });
  }
}

function _syncTypingSfxBtn() {
  const on = sfxEnabled();
  const label = on ? 'Typing sound on' : 'Typing sound off';
  const btn = document.getElementById('typing-sfx-btn');
  if (!btn) return;
  btn.title = label;
  btn.setAttribute('aria-label', label);
  btn.setAttribute('aria-pressed', String(on));
  btn.style.color = on ? 'var(--color-primary)' : '';
  const icon = btn.querySelector('[data-lucide], svg');
  if (typeof _setLucideIcon === 'function') _setLucideIcon(icon, on ? 'volume-2' : 'volume-x');
}

/** The button, for whichever attempt topbar is being built. */
function typingSfxButtonTemplate() {
  const on = sfxEnabled();
  const label = on ? 'Typing sound on' : 'Typing sound off';
  return `
    <button class="btn btn-ghost practice-icon-btn" onclick="toggleTypingSfx()"
            title="${label}" id="typing-sfx-btn" aria-label="${label}" aria-pressed="${on}"
            style="${on ? 'color:var(--color-primary);' : ''}">
      <i data-lucide="${on ? 'volume-2' : 'volume-x'}" style="width:16px;height:16px;" aria-hidden="true"></i>
    </button>`;
}
