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
     · a BANDPASS around the formants, which is the vowel-ish colour
     · a short DOWNWARD pitch glide, the way a spoken syllable falls
     · a soft attack, so there is no click at the front

   Tuned to the standard Mita rather than the darker one she turns into.

   PITCH AND COLOUR ARE SEPARATE KNOBS, and conflating them is how this got
   set wrong twice. At 232Hz with the formants left low it read as the dark
   Mita; at 440Hz with them raised it read as squeaky, because 440 is close to
   an octave above where a person actually speaks.

   The pitch is no longer a guess. The game's own blip was put through a pitch
   tracker and reads D#4, 311Hz, sitting just under the E4 line — so that is
   the target, and this is tuned to hit it rather than to sound plausible.

   The number below is 335 rather than 311 because it is where the blip
   STARTS, and the glide means it spends its life falling: measured, a nominal
   335 gives a dominant of 312Hz, which is D#4 within six cents. Setting 311
   here would land on D4 instead, a whole semitone flat.

   How the three earlier guesses did against that target:
     232Hz base -> f0 215Hz  C#4   a fourth flat, and dark with it
     440Hz base -> f0 422Hz  G#4   a fifth sharp
     270Hz base -> f0 258Hz  C4    a minor third flat
     335Hz base -> f0 312Hz  D#4   the reading

   What is NOT taken from the trace is the glide. It shows dives to C4 and
   below, but a pitch tracker loses lock as a sound decays, and those spikes
   sit at the tail of each blip where there is least to track. The trustworthy
   part is the sustained band just under E4. Reading the artefacts as pitch
   content would have doubled the fall for no reason.

   Nothing is created until the first keystroke, which is itself the user
   gesture the autoplay policy wants — building the AudioContext at load would
   leave it suspended and silent.

   TWO THINGS WERE TRIED AFTER THIS AND ROLLED BACK, so they do not get
   rediscovered as improvements:

   Making it monotone. The wobble and the glide were removed on the grounds
   that the game's blip is one sample repeated. Measured, that is exactly what
   it produced — every keystroke one pitch — and it sounded worse: a fixed
   frequency with an envelope on it IS a musical note, and it read as one.

   Then a formant pair on a sawtooth with a noise transient, which is textbook
   voice synthesis and measurably a vowel: real energy at F1 and at both
   harmonics either side of F2, where before there was a single peak. It was
   still not as good to listen to. The small pitch movement below is doing
   more work than the spectrum was.

   The lesson stuck to here: this is judged by ear, and the measurements are
   only there to tell me WHAT I changed, not whether it was better.
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
 * The voice, in one place.
 *
 * Every key is a ratio of this rather than its own row of numbers, so moving
 * the pitch moves the whole family together and keeps the shape: return still
 * lowest and longest, backspace still dullest. Five separate rows is what made
 * this awkward to tune — changing the voice meant editing five sets of three.
 */
const SFX_VOICE = {
  pitch:   335,     // Hz at the attack; measures D#4/311Hz, the game's reading
  length:  0.080,   // seconds
  formant: 1600,    // Hz, the bandpass centre — the colour of the voice
  ceiling: 4600,    // Hz, the lowpass above it
  weight:  0.18,    // the octave-down sine underneath
  glide:   0.82,    // where the pitch falls to by the end
  q:       1.4,     // how sharp the formant is
  volume:  1.0
};

/** pitch x, length x, formant x — relative to an ordinary character. */
const SFX_KEY_RATIOS = {
  'Enter':     [0.78, 1.25, 0.80],   // lower, longer — a full stop
  /* 0.72 put backspace a fourth below an ordinary character and dropped its
     formant to 1100, which is far enough that it stopped being the same voice
     and started being a thud every time you corrected a typo — the one key you
     hit most often after the letters. Under two semitones below an ordinary
     character now rather than nearly six. That does lift it above return and
     tab in pitch, so it is no longer the lowest of the set; it is still the
     dullest, and the dullness is what read as a correction rather than the
     depth. */
  'Backspace': [0.90, 0.85, 0.86],   // dull, swallowed
  'Delete':    [0.90, 0.85, 0.86],
  ' ':         [0.89, 0.85, 0.91],   // the gap between words
  'Tab':       [0.83, 1.06, 0.84]
};

const SFX_VOL_KEY = 'ssp.typingSfxVol';
const SFX_VOICE_KEY = 'ssp.typingSfxVoice';

/* ============================================================
   TWO VOICES
   ------------------------------------------------------------
   The Mita blip above is a voice, and a voice is a particular taste. The
   second one is a mechanical keyboard, which is the sound most people
   actually want under code: it rewards the keystroke instead of commenting
   on it, and it does not compete with thinking the way something speaking
   does.

   They are different ENGINES, not different numbers. Everything that makes
   the Mita blip work — the glide, the formant, the octave beneath — is what
   makes it a voice, and a keyswitch has none of those. It is a hard noise
   transient (the switch) over a fast low body (the keycap hitting the
   plate), which no amount of retuning a bandpassed triangle produces.

   Voices are per-key like the first: a spacebar is a longer keycap on a
   stabiliser and lands deeper, return is heavier still, and backspace is the
   dull one because it is the key you hit when something went wrong.
   ============================================================ */

const SFX_VOICES = {
  mita:   { id: 'mita',   label: 'Mita',   hint: 'The dialogue blip',      engine: 'voice' },
  keys:   { id: 'keys',   label: 'Keys',   hint: 'A mechanical keyboard',  engine: 'keys' },
  /* The recorded one: audio/voice.MP3, played whole. It does not fall back to
     a synthesised blip — this voice is the recording. See js/audio-samples.js. */
  sample: { id: 'sample', label: 'Recorded', hint: 'From audio/voice.MP3', engine: 'sample' }
};

const SFX_VOICE_ORDER = ['mita', 'keys', 'sample'];

/** Body pitch, length, click colour — relative to an ordinary character. */
const SFX_KEYBOARD = {
  thock:   150,     // Hz, the keycap bottoming out
  drop:    0.72,    // where that falls to by the end
  length:  0.055,
  click:   3200,    // Hz, the centre of the switch's click
  clickQ:  1.1,
  /* Levelled against the Mita blip, which peaks about 0.15. A keyswitch
     should be the more present of the two — that is most of why it is the
     satisfying one — but 0.42/0.46 measured 0.52, three and a half times the
     voice it sits beside, so switching voices was a jump in volume rather
     than a change of character. Twice is the difference; three and a half is
     a different setting. */
  clickAmt: 0.24,   // how much of the switch you hear against the board
  body:    0.27
};

const SFX_KEYBOARD_RATIOS = {
  'Enter':     [0.80, 1.30, 0.86, 1.10],   // the big one, and the end of a line
  'Backspace': [0.92, 0.92, 0.78, 0.86],   // dull, because it is a correction
  'Delete':    [0.92, 0.92, 0.78, 0.86],
  ' ':         [0.74, 1.18, 0.82, 1.16],   // stabilised, deeper, a touch louder
  'Tab':       [0.86, 1.05, 0.88, 0.96]
};

/** Which voice is speaking. Unknown or unset falls back to the original. */
function sfxVoiceId() {
  try {
    const v = localStorage.getItem(SFX_VOICE_KEY);
    return SFX_VOICES[v] ? v : 'mita';
  } catch (e) { return 'mita'; }
}

function sfxVoiceDef() { return SFX_VOICES[sfxVoiceId()]; }

/** Choose a voice outright, from the picker. */
function sfxPickVoice(id) {
  if (!SFX_VOICES[id] || sfxVoiceId() === id) return;
  _sfxApplyVoice(id);

  if (typeof feelSync === 'function') feelSync();
}

/** Cycle to the next voice, for a keyboard shortcut or a single-button UI. */
function cycleTypingSfxVoice() {
  const i = SFX_VOICE_ORDER.indexOf(sfxVoiceId());
  _sfxApplyVoice(SFX_VOICE_ORDER[(i + 1) % SFX_VOICE_ORDER.length]);
}

function _sfxApplyVoice(next) {
  try { localStorage.setItem(SFX_VOICE_KEY, next); } catch (e) { /* private mode */ }
  _syncTypingSfxBtn();
  // Switching voices while muted would be silent and look broken, so it
  // demonstrates the choice either way.
  if (!sfxEnabled()) { try { localStorage.setItem(SFX_KEY, '1'); } catch (e) {} _syncTypingSfxBtn(); }
  const a = sfxKeyVoice('a'), b = sfxKeyVoice('e'), sp = sfxKeyVoice(' ');
  sfxBlip(a[0], a[1], a[2], a[3]);
  setTimeout(() => sfxBlip(b[0], b[1], b[2], b[3]), 85);
  setTimeout(() => sfxBlip(sp[0], sp[1], sp[2], sp[3]), 170);
  if (typeof toast === 'function') {
    toast(SFX_VOICES[next].label + ' — ' + SFX_VOICES[next].hint, { type: 'info', duration: 1800 });
  }
}

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
  // Fetch and decode the recordings as soon as there is something to decode
  // with. Safe from recursion: _sfxCtx is already assigned, so the load path
  // calling back in here returns immediately. Three files, about 40KB.
  if (_sfxCtx && typeof samplePrewarm === 'function') samplePrewarm();
  return _sfxCtx;
}

/**
 * One blip.
 *
 * @param {number} pitch  base frequency in Hz — the key class picks this
 * @param {number} length seconds; longer reads as a heavier key
 * @param {number} colour bandpass centre in Hz — lower is duller
 */
function sfxBlip(pitch, length, colour, extra) {
  const ctx = _sfxContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  // One entry point, two engines. Everything that calls this — the keystroke
  // handler, the volume preview, the toggle's proof-of-life — gets whichever
  // voice is selected without knowing there is a choice.
  const engine = sfxVoiceDef().engine;
  if (engine === 'keys') { _sfxKeyPress(ctx, pitch, length, colour, extra); return; }
  if (engine === 'sample') {
    // audio/voice.MP3, and only that. It does not fall through to the Mita
    // blip if the file is slow: this voice is the recording, and substituting
    // a synthesised one for a few keystrokes would be the imitation the whole
    // point was to avoid. `extra` carries the per-key playback rate.
    samplePlay('voice', _sfxBus, { gain: 0.238, rate: extra || 1, rateJitter: 0.06 });
    return;
  }

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
  osc.frequency.exponentialRampToValueAtTime(f * SFX_VOICE.glide, t + length);

  // An octave down underneath, quietly, for body. Kept light — this is the
  // weight in the sound, and weight is most of what made it read as the
  // wrong Mita.
  sub.type = 'sine';
  sub.frequency.setValueAtTime(f * 0.5, t);
  sub.frequency.exponentialRampToValueAtTime(f * 0.5 * SFX_VOICE.glide, t + length);
  const subGain = ctx.createGain();
  subGain.gain.value = SFX_VOICE.weight;

  band.type = 'bandpass';
  band.frequency.setValueAtTime(colour * (0.9 + Math.random() * 0.2), t);
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

/**
 * What a key sounds like.
 *
 * Every key giving the identical blip is the thing that makes a typing sound
 * tiring. The heavy keys sit lower and last longer, so a line of code has some
 * shape to it: the return at the end of a line lands differently from the
 * letters before it.
 */
/* The recorded voice has no synthesis knobs, so the heavy keys are shaped by
   playback rate instead: slower is lower and longer, which is the same thing
   the other two voices do with pitch and length. */
const SFX_SAMPLE_RATES = {
  'Enter':     0.86,
  'Backspace': 0.94,
  'Delete':    0.94,
  ' ':         0.90,
  'Tab':       0.92
};

function sfxKeyVoice(key) {
  if (sfxVoiceDef().engine === 'sample') {
    // pitch/length/colour are unused by the sample engine; the fourth value is
    // the playback rate, which is the only knob a recording has.
    return [SFX_VOICE.pitch, SFX_VOICE.length, SFX_VOICE.formant, SFX_SAMPLE_RATES[key] || 1];
  }
  if (sfxVoiceDef().engine === 'keys') {
    const k = SFX_KEYBOARD;
    const r = SFX_KEYBOARD_RATIOS[key];
    if (!r) return [k.thock, k.length, k.click, 1];
    return [k.thock * r[0], k.length * r[1], k.click * r[2], r[3]];
  }
  const r = SFX_KEY_RATIOS[key];
  if (!r) return [SFX_VOICE.pitch, SFX_VOICE.length, SFX_VOICE.formant];
  return [SFX_VOICE.pitch * r[0], SFX_VOICE.length * r[1], SFX_VOICE.formant * r[2]];
}

/* ── The keyboard engine ──────────────────────────────────────
   Two things happening at once, which is what a keypress is:

   THE SWITCH — a very short noise burst through a bandpass, 6ms of it. This
   is the click, and it is what makes the sound feel like contact rather than
   a tone. Shaped in the buffer rather than with a gain node so the decay is
   sample-accurate at this length; a 6ms envelope drawn with ramps is mostly
   ramp.

   THE BOARD — a triangle at about 150Hz falling fast, low-passed. This is the
   keycap reaching the plate, and it is where the satisfaction lives. Take it
   away and you have a click; take the click away and you have a knock.

   Both jitter per press. The same two components at identical settings
   twenty times a second is a machine gun for exactly the reason the vocal
   engine jitters too.
   ------------------------------------------------------------ */
function _sfxKeyPress(ctx, thock, length, click, loud) {
  const t = ctx.currentTime;
  const k = SFX_KEYBOARD;
  const amp = (typeof loud === 'number' ? loud : 1);

  // The switch.
  const nlen = Math.max(1, Math.floor(ctx.sampleRate * 0.006));
  const buf = ctx.createBuffer(1, nlen, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < nlen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / nlen, 2);
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = click * (0.88 + Math.random() * 0.24);
  bp.Q.value = k.clickQ;
  const ng = ctx.createGain();
  ng.gain.value = k.clickAmt * amp;
  noise.connect(bp); bp.connect(ng); ng.connect(_sfxBus);
  noise.start(t);

  // The board.
  const f = thock * (0.94 + Math.random() * 0.12);
  const osc = ctx.createOscillator();
  const lp = ctx.createBiquadFilter();
  const env = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(f, t);
  osc.frequency.exponentialRampToValueAtTime(f * k.drop, t + length);
  lp.type = 'lowpass';
  lp.frequency.value = 1400;
  // Near-instant attack: a key either is or is not pressed, and any ramp long
  // enough to hear reads as a soft synth pad rather than a switch.
  env.gain.setValueAtTime(0.0001, t);
  env.gain.linearRampToValueAtTime(k.body * amp, t + 0.002);
  env.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(lp); lp.connect(env); env.connect(_sfxBus);
  osc.start(t);
  osc.stop(t + length + 0.02);
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
  /* The terminal is the program's input, not yours. Typing an answer to a
     scanf is talking to the running program — giving it the same voice as
     writing code puts a sound on the one moment the terminal is waiting for
     you, and the run's own cues are already speaking there. */
  if (el.id === 'term-input' || el.closest && el.closest('.run-code-overlay, .term-surface')) return false;
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
  sfxBlip(voice[0], voice[1], voice[2], voice[3]);
}, true);

/* ── The same thing again, for soft keyboards ─────────────────
   An Android keyboard does not report what you typed. Ordinary characters
   arrive as keydown with key "Unidentified" (keyCode 229) because the IME has
   not committed them yet, so the test above — which asks what the key WAS —
   rejected every letter. Backspace and Delete are reported properly, which is
   why deleting made a sound on a phone and typing made none.

   `input` is the event that does fire for those characters, so it is the
   fallback. There is no separate mobile path and no user-agent test: the
   dedupe is the gap that is already enforced between blips. On a desktop the
   keydown has just played, so this arrives inside that gap and is dropped; on
   a phone nothing played, the gap has long passed, and this is the sound.
   ------------------------------------------------------------ */
document.addEventListener('input', function (e) {
  if (!sfxEnabled() || !sfxRouteWantsSound()) return;
  if (!sfxIsTypingTarget(e.target)) return;

  const now = Date.now();
  if (now - _sfxLast < SFX_MIN_GAP_MS) return;   // the keydown already spoke
  _sfxLast = now;

  /* Which key it was is genuinely unknown here — that is the whole problem —
     so it gets the ordinary character's voice. A deletion is the one case
     that can be told apart, and it already came through keydown. */
  const isDelete = e.inputType && e.inputType.indexOf('delete') === 0;
  const voice = sfxKeyVoice(isDelete ? 'Backspace' : 'a');
  sfxBlip(voice[0], voice[1], voice[2], voice[3]);
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
  if (typeof feelSync === 'function') feelSync();
  if (next) {
    // Play the thing being switched on, so the button proves itself.
    const v = sfxKeyVoice('a'), w = sfxKeyVoice(' ');
    sfxBlip(v[0], v[1], v[2], v[3]);
    setTimeout(() => sfxBlip(w[0], w[1] * 1.15, w[2], w[3]), 95);
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
 * range emits dozens of those a second, and one blip each is a buzz that tells
 * you nothing about the level you are setting.
 */
function sfxSetVolume(v) {
  const val = Math.max(0, Math.min(1.5, parseFloat(v) || 0));
  try { localStorage.setItem(SFX_VOL_KEY, String(val)); } catch (e) { /* private mode */ }
  if (_sfxBus) _sfxBus.gain.value = sfxBusGain();
  const label = document.getElementById('sfx-vol-label');
  if (label) label.textContent = Math.round(val * 100) + '%';
  _syncTypingSfxBtn();
  // The Settings modal shows the same volume, so moving either control moves
  // both rather than leaving the other one describing a value that is no
  // longer stored.
  if (typeof _syncAppSoundRow === 'function') _syncAppSoundRow();
  clearTimeout(_sfxVolPreview);
  _sfxVolPreview = setTimeout(() => {
    if (val > 0 && sfxEnabled()) {
      const voice = sfxKeyVoice('a');
      sfxBlip(voice[0], voice[1], voice[2], voice[3]);
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

  // Keep the picker showing which voice is actually speaking, whether it was
  // changed from here, from the cycle, or in another tab.
  const cur = sfxVoiceId();
  document.querySelectorAll('.sfx-voice-opt').forEach(b => {
    const isOn = b.dataset.voice === cur;
    b.classList.toggle('is-on', isOn);
    b.setAttribute('aria-pressed', String(isOn));
  });
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
    <div class="sfx-control js-hold-pop">
      <button class="btn btn-ghost practice-icon-btn" onclick="toggleTypingSfx()"
              title="${label}" id="typing-sfx-btn" aria-label="${label}" aria-pressed="${enabled}"
              style="${lit ? 'color:var(--color-primary);' : ''}">
        <i data-lucide="${lit ? 'volume-2' : 'volume-x'}" style="width:16px;height:16px;" aria-hidden="true"></i>
      </button>
      <div class="sfx-vol-pop">
        <div class="sfx-vol-row">
          <input type="range" id="sfx-vol" class="sfx-vol-range"
                 min="0" max="150" step="5" value="${vol}"
                 aria-label="Typing sound volume"
                 oninput="sfxSetVolume(this.value / 100)">
          <span class="sfx-vol-label" id="sfx-vol-label">${vol}%</span>
        </div>
        <!-- The voice picker lives here rather than as a second topbar button:
             the strip already needs ten controls to fit on a phone, and this is
             something you set once, not something you reach for mid-attempt. -->
        <div class="sfx-voice-row" role="group" aria-label="Typing voice">
          ${SFX_VOICE_ORDER.map(id => `
            <button type="button" class="sfx-voice-opt${sfxVoiceId() === id ? ' is-on' : ''}"
                    data-voice="${id}" onclick="sfxPickVoice('${id}')"
                    title="${escapeHTML(SFX_VOICES[id].hint)}"
                    aria-pressed="${sfxVoiceId() === id}">${escapeHTML(SFX_VOICES[id].label)}</button>`).join('')}
        </div>
      </div>
    </div>`;
}

/* ── Opening the volume popover on a touch screen ─────────────
   The slider and the voice picker appeared on hover, which a phone does not
   have, and on focus-within, which a tap on the button does not produce
   before the click handler has already toggled mute. So on a phone the
   control was a mute button and nothing else: the volume and both other
   voices were unreachable.

   A long press opens it. Short press keeps its meaning — muting in a hurry is
   the common case and must not need a gesture — and the press that opens the
   panel deliberately suppresses that click, or letting go would mute at the
   same moment the slider appeared.
   ------------------------------------------------------------ */
(function () {
  const HOLD_MS = 350;      // long enough not to fire while scrolling past
  const MOVE_TOLERANCE = 10;
  let timer = null, startX = 0, startY = 0, opened = false;

  /* Any control that keeps options behind a long press, not just this one.
     The letter-animation button in the same strip needs exactly this gesture,
     and a second copy of the timing, the movement tolerance and the
     click-swallowing would be a second place for them to drift. */
  const control = (el) => (el && el.closest) ? el.closest('.js-hold-pop') : null;

  function closeAll(except) {
    document.querySelectorAll('.js-hold-pop.is-open').forEach(c => {
      if (c !== except) c.classList.remove('is-open');
    });
  }

  document.addEventListener('touchstart', function (e) {
    const c = control(e.target);
    if (!c) { closeAll(null); return; }
    const t = e.touches[0];
    startX = t.clientX; startY = t.clientY;
    opened = false;
    clearTimeout(timer);
    timer = setTimeout(() => {
      opened = true;
      closeAll(c);
      c.classList.add('is-open');
      // A short buzz where the platform offers one, so the press reads as
      // having done something even before the panel finishes appearing.
      if (navigator.vibrate) { try { navigator.vibrate(15); } catch (err) {} }
    }, HOLD_MS);
  }, { passive: true });

  document.addEventListener('touchmove', function (e) {
    if (!timer) return;
    const t = e.touches[0];
    // A scroll is not a press. Without this the panel opens whenever a finger
    // happens to start its swipe on the button.
    if (Math.abs(t.clientX - startX) > MOVE_TOLERANCE || Math.abs(t.clientY - startY) > MOVE_TOLERANCE) {
      clearTimeout(timer); timer = null;
    }
  }, { passive: true });

  document.addEventListener('touchend', function () {
    clearTimeout(timer); timer = null;
  }, { passive: true });

  /* Swallow the click the opening press would otherwise produce, so a long
     press shows the panel instead of showing it and muting at once. */
  document.addEventListener('click', function (e) {
    if (opened && control(e.target)) {
      opened = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (!control(e.target)) closeAll(null);
  }, true);
})();
