/* ============================================================
   TYPING-SFX.JS — the attempt's typing voice
   ------------------------------------------------------------
   A short blip per keystroke, in the manner of MiSide's dialogue: the
   voiceless "talking" sound that plays per character while Mita speaks.

   Synthesised rather than sampled, so there is no binary asset in a repo that
   is served as-is and the shape stays adjustable.

   MONOTONE, deliberately. Every blip is the same pitch, because the game plays
   one sample over and over. It did not start that way: there was a random
   wobble of nine percent per blip, plus a table giving each key its own pitch,
   on the theory that identical repeats sound mechanical. They do — but nine
   percent is a semitone and a half, which is not texture, it is the sound
   going out of tune with itself. Sameness is the point.

   What makes it read as a voice rather than a beep:
     · a TRIANGLE oscillator, not a square — soft harmonics, no chiptune edge
     · a BANDPASS around the formants, which is the vowel-ish colour
     · a soft attack, so there is no click at the front
     · a two-stage decay, which carries the body

   With the pitch flat the character has to come from the filter and the
   envelope, and it does — the formant is what makes this a voice rather than
   a beep, and that was true before the glide came out.

   Tuned to the standard Mita rather than the darker one she turns into.

   PITCH AND COLOUR ARE SEPARATE KNOBS, and conflating them is how this got
   set wrong twice. At 232Hz with the formants left low it read as the dark
   Mita; at 440Hz with them raised it read as squeaky, because 440 is close to
   an octave above where a person actually speaks.

   The pitch is no longer a guess. The game's own blip was put through a pitch
   tracker and reads D#4, 311Hz, sitting just under the E4 line — so that is
   the target, and this is tuned to hit it rather than to sound plausible.

   The number below is 311 and not 335. It was 335 while the pitch glided
   downward, because the blip then spent its life falling and the dominant
   landed below where it started. With the glide gone the nominal IS the
   measured pitch, so the tuned figure and the target are the same number
   again. Leaving 335 would have put it on E4, a semitone sharp — taking the
   glide out silently retunes the whole thing.

   How the earlier guesses did against that target:
     232Hz -> f0 215Hz  C#4   a fourth flat, and dark with it
     440Hz -> f0 422Hz  G#4   a fifth sharp
     270Hz -> f0 258Hz  C4    a minor third flat
     311Hz -> f0 311Hz  D#4   the reading, and flat across every key

   The dives to C4 in that trace are the tracker losing lock as each blip
   decays rather than pitch content — they sit at the tail, where there is
   least signal to follow. The trustworthy part was always the sustained band
   just under E4, and a flat blip is what puts us on it.

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
   laptop fan. Dropping the fundamental back into speaking range costs a
   little amplitude — the shaped blip now peaks nearer 0.13 than 0.18 — so this
   went up to hold the output where it was. Raising the pitch to the measured
   D#4 gave some of that amplitude back, so it comes down again — the level has
   been held at about -15.5 dBFS across all of these changes on purpose, since
   the loudness was settled before the voice was. */

/**
 * The voice, in one place. One sound, used for every key.
 *
 * There used to be a ratio table here giving return, space, backspace and tab
 * their own pitch, length and colour. It is gone: the game plays one sample
 * whatever is happening, and per-key pitches were the second source of the
 * wobble this was meant to lose.
 */
const SFX_VOICE = {
  pitch:   311,     // Hz — D#4, straight off the tracker reading
  length:  0.080,   // seconds
  formant: 1600,    // Hz, the bandpass centre — the colour of the voice
  ceiling: 4600,    // Hz, the lowpass above it
  weight:  0.18,    // the octave-down sine underneath
  q:       1.4,     // how sharp the formant is
  volume:  1.0      // the tuned level; the slider scales this
};

const SFX_VOL_KEY = 'ssp.typingSfxVol';

let _sfxCtx = null;
let _sfxBus = null;
let _sfxLast = 0;
let _sfxVolPreview = null;

/** The user's scale on top of the tuned level. 1 is the tuned level. */
function sfxVolume() {
  try {
    const v = parseFloat(localStorage.getItem(SFX_VOL_KEY));
    return isNaN(v) ? 1 : Math.max(0, Math.min(1.5, v));
  } catch (e) { return 1; }
}

function sfxBusGain() { return SFX_VOICE.volume * sfxVolume(); }

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
    _sfxBus.gain.value = sfxBusGain();
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

  // Flat, and identical every time. No jitter and no glide — see the header.
  const f = pitch;

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(f, t);

  // An octave down underneath, quietly, for body. Kept light — this is the
  // weight in the sound, and weight is most of what made it read as the
  // wrong Mita.
  sub.type = 'sine';
  sub.frequency.setValueAtTime(f * 0.5, t);
  const subGain = ctx.createGain();
  subGain.gain.value = SFX_VOICE.weight;

  band.type = 'bandpass';
  band.frequency.setValueAtTime(colour, t);
  band.Q.value = SFX_VOICE.q;

  // High enough to let the brightness through. At 2600 the ceiling sat on top
  // of the formants and dragged the whole voice back down however high the
  // fundamental went.
  tame.type = 'lowpass';
  tame.frequency.value = SFX_VOICE.ceiling;

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

/** One sound, whatever was pressed. */
function sfxKeyVoice() {
  return [SFX_VOICE.pitch, SFX_VOICE.length, SFX_VOICE.formant];
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

  const voice = sfxKeyVoice();
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
    const v = sfxKeyVoice('a'), w = sfxKeyVoice(' ');
    sfxBlip(v[0], v[1], v[2]);
    setTimeout(() => sfxBlip(w[0], w[1] * 1.15, w[2]), 95);
  } else if (_sfxCtx) {
    _sfxCtx.suspend().catch(() => {});
  }
  if (typeof toast === 'function') {
    toast(next ? 'Typing sound on' : 'Typing sound off', { type: 'info', duration: 1800 });
  }
}

/**
 * Live from the slider.
 *
 * The preview blip is debounced rather than fired per input event: dragging a
 * range emits dozens of those a second, and one blip per event is a buzz that
 * tells you nothing about the level you are setting.
 */
function sfxSetVolume(v) {
  const val = Math.max(0, Math.min(1.5, parseFloat(v) || 0));
  try { localStorage.setItem(SFX_VOL_KEY, String(val)); } catch (e) { /* private mode */ }
  if (_sfxBus) _sfxBus.gain.value = sfxBusGain();
  const label = document.getElementById('sfx-vol-label');
  if (label) label.textContent = Math.round(val * 100) + '%';
  _syncTypingSfxBtn();
  clearTimeout(_sfxVolPreview);
  _sfxVolPreview = setTimeout(() => {
    if (val > 0 && sfxEnabled()) {
      const voice = sfxKeyVoice();
      sfxBlip(voice[0], voice[1], voice[2]);
    }
  }, 140);
}

function _syncTypingSfxBtn() {
  // Silent is silent, however it was reached — a speaker icon with waves
  // coming off it while the slider sits at zero is just wrong.
  const on = sfxEnabled() && sfxVolume() > 0;
  const label = sfxEnabled() ? 'Typing sound on' : 'Typing sound off';
  const btn = document.getElementById('typing-sfx-btn');
  if (!btn) return;
  btn.title = label;
  btn.setAttribute('aria-label', label);
  btn.setAttribute('aria-pressed', String(on));
  btn.style.color = on ? 'var(--color-primary)' : '';
  const icon = btn.querySelector('[data-lucide], svg');
  if (typeof _setLucideIcon === 'function') _setLucideIcon(icon, on ? 'volume-2' : 'volume-x');
}

/**
 * The button and its volume slider, for whichever attempt topbar is being built.
 *
 * The click still toggles, because muting in a hurry is the common case and
 * putting that behind a popover would be a downgrade. The slider comes in on
 * hover or keyboard focus instead, and stays while the pointer is over either
 * half, so it can actually be reached.
 */
function typingSfxButtonTemplate() {
  const enabled = sfxEnabled();
  const vol = Math.round(sfxVolume() * 100);
  const lit = enabled && vol > 0;
  const label = enabled ? 'Typing sound on' : 'Typing sound off';
  return `
    <div class="sfx-control">
      <button class="btn btn-ghost practice-icon-btn" onclick="toggleTypingSfx()"
              title="${label}" id="typing-sfx-btn" aria-label="${label}" aria-pressed="${enabled}"
              style="${lit ? 'color:var(--color-primary);' : ''}">
        <i data-lucide="${lit ? 'volume-2' : 'volume-x'}" style="width:16px;height:16px;" aria-hidden="true"></i>
      </button>
      <div class="sfx-vol-pop">
        <input type="range" id="sfx-vol" class="sfx-vol-range"
               min="0" max="150" step="5" value="${vol}"
               aria-label="Typing sound volume"
               oninput="sfxSetVolume(this.value / 100)">
        <span class="sfx-vol-label" id="sfx-vol-label">${vol}%</span>
      </div>
    </div>`;
}
