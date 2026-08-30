/* ============================================================
   PRACTICE-SFX.JS — the attempt's cues
   ------------------------------------------------------------
   Five sounds, for the five moments the attempt already marks visually:
   waiting on a build, a test case failing, one passing, every one passing,
   and finishing the attempt. Each is tied to the effect it belongs to, so the
   sound and the picture are the same event rather than two things that
   happen to coincide.

   Synthesised, like the typing voice, for the same reasons: no binary asset
   in a repo that is served as-is, and every parameter stays adjustable.

   IT SHARES THE TYPING VOICE'S AudioContext AND ITS SWITCH. One speaker
   button and one slider govern everything the attempt says — two independent
   sound controls for one screen would be a worse answer than either. But it
   gets its OWN bus, because these are events and the typing is texture: a
   cue that arrives at the level of a keystroke is not a cue.
   ============================================================ */

/* Events sit above the typing, which runs at about -15 dBFS. */
const PSFX_LEVEL = 2.6;

let _psfxOut = null;
let _psfxWorkTimer = null;
let _psfxWorkCap = null;
let _psfxWorkStep = 0;

/** The cue bus, kept in step with the shared volume slider on every use. */
function _psfxBus() {
  const ctx = (typeof _sfxContext === 'function') ? _sfxContext() : null;
  if (!ctx) return null;
  if (!_psfxOut) {
    _psfxOut = ctx.createGain();
    _psfxOut.connect(ctx.destination);
  }
  // Read rather than cache: the slider can move between one cue and the next,
  // and there is no event to subscribe to for it.
  const user = (typeof sfxVolume === 'function') ? sfxVolume() : 1;
  _psfxOut.gain.value = PSFX_LEVEL * user;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return _psfxOut;
}

function _psfxOn() {
  return typeof sfxEnabled !== 'function' || sfxEnabled();
}

/**
 * One shaped note.
 *
 * @param {object} o  freq, to (sweep target), type, at (offset seconds),
 *                    dur, gain, and an optional lowpass.
 */
function psfxTone(o) {
  const bus = _psfxBus();
  if (!bus) return;
  const ctx = _sfxContext();
  const t = ctx.currentTime + (o.at || 0);
  const dur = o.dur || 0.18;

  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = o.type || 'triangle';
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);

  // Soft in, soft out. A cue that clicks at either end reads as a glitch
  // rather than as a sound the app meant to make.
  env.gain.setValueAtTime(0.0001, t);
  env.gain.linearRampToValueAtTime(o.gain || 0.2, t + Math.min(0.012, dur * 0.2));
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  let tail = env;
  if (o.lowpass) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = o.lowpass;
    env.connect(lp);
    tail = lp;
  }
  osc.connect(env);
  tail.connect(bus);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/* ── Waiting on a build ───────────────────────────────────────
   A quiet two-note pulse that repeats until the check finishes. Deliberately
   low and soft: it is there to say the machine is still thinking, and
   anything attention-grabbing would be wrong for a sound that might run for
   several seconds.
   ------------------------------------------------------------ */
function psfxWorkStart() {
  if (!_psfxOn()) return;
  psfxWorkStop();
  _psfxWorkStep = 0;
  const tick = () => {
    // Alternating, so it reads as a loop turning over rather than a metronome.
    const up = (_psfxWorkStep++ % 2) === 0;
    psfxTone({ freq: up ? 262 : 196, type: 'sine', dur: 0.1, gain: 0.075, lowpass: 1200 });
  };
  tick();
  _psfxWorkTimer = setInterval(tick, 340);
  /* A cap, because "started" and "finished" are wired at different call sites
     and a build has several ways to end — an exception, a navigation, an
     engine that never answers. A pulse still going a minute later would be
     worse than one that stops slightly early.

     The handle is KEPT, which it was not. An uncancelled cap belongs to the
     session that scheduled it and fires 25 seconds later regardless of what
     is running by then — so a check, a stop, and a second check one second
     later left the first cap alive to silence the second one mid-build. */
  clearTimeout(_psfxWorkCap);
  _psfxWorkCap = setTimeout(psfxWorkStop, 25000);
}

function psfxWorkStop() {
  if (_psfxWorkTimer) { clearInterval(_psfxWorkTimer); _psfxWorkTimer = null; }
  clearTimeout(_psfxWorkCap);
  _psfxWorkCap = null;
}

/* ── A test case failed ───────────────────────────────────────
   Two notes falling a tritone, detuned against each other. The interval is
   the point: nothing in the pass cues uses it, so a failure is recognisable
   before you have looked at the screen.
   ------------------------------------------------------------ */
function psfxFail() {
  if (!_psfxOn()) return;
  psfxTone({ freq: 311, to: 233, type: 'sawtooth', dur: 0.17, gain: 0.13, lowpass: 1500 });
  psfxTone({ freq: 208, to: 155, type: 'square', dur: 0.22, gain: 0.075, lowpass: 900, at: 0.055 });
}

/* ── A test case passed ───────────────────────────────────────
   A rising third, short and bright. Rows report one at a time and are
   staggered 90ms apart, so this has to survive being played in a run without
   turning into a chord.
   ------------------------------------------------------------ */
function psfxPass() {
  if (!_psfxOn()) return;
  psfxTone({ freq: 523, type: 'triangle', dur: 0.09, gain: 0.13 });
  psfxTone({ freq: 659, type: 'triangle', dur: 0.13, gain: 0.12, at: 0.07 });
}

/* ── Every test case passed ───────────────────────────────────
   The stars falling, in sound: high bells scattered across a second and a
   half, matched to how the starfall is scattered across the window. Random
   timing rather than a tune, because a fixed melody heard on every clean run
   would wear out fast.
   ------------------------------------------------------------ */
function psfxStarfall() {
  if (!_psfxOn()) return;
  // The chord underneath, so the sparkle has something to sit on.
  [523, 659, 784, 1047].forEach((f, i) =>
    psfxTone({ freq: f, type: 'triangle', dur: 0.5, gain: 0.1, at: i * 0.075 }));
  const notes = [1047, 1319, 1568, 2093, 1760, 1319];
  for (let i = 0; i < 14; i++) {
    psfxTone({
      freq: notes[Math.floor(Math.random() * notes.length)],
      type: 'sine',
      dur: 0.28,
      gain: 0.05 + Math.random() * 0.04,
      at: 0.15 + Math.random() * 1.35
    });
  }
}

/* ── Finishing the attempt ────────────────────────────────────
   A power-up: a sweep with the octave above it, then a short fanfare landing
   on the fifth. Longer and louder than anything else here, because it only
   happens once and it is the end of the thing.
   ------------------------------------------------------------ */
function psfxPowerUp() {
  if (!_psfxOn()) return;
  psfxTone({ freq: 196, to: 784, type: 'sawtooth', dur: 0.42, gain: 0.1, lowpass: 2600 });
  psfxTone({ freq: 392, to: 1568, type: 'triangle', dur: 0.42, gain: 0.07 });
  [[523, 0.4], [659, 0.5], [784, 0.6], [1047, 0.7]].forEach(([f, at]) =>
    psfxTone({ freq: f, type: 'triangle', dur: 0.3, gain: 0.14, at }));
  psfxTone({ freq: 1568, type: 'sine', dur: 0.55, gain: 0.09, at: 0.72 });
}

/* Leaving the page mid-build should not leave the pulse running. */
document.addEventListener('visibilitychange', function () {
  if (document.hidden) psfxWorkStop();
});

/* ── A run that compiled and finished ─────────────────────────
   The Pokemon potion: what you hear when an item is used and the bar refills.

   It is not a fanfare — a fanfare is what you get for winning, and this
   happens every time the code runs. It is a fast rising bubble: a run of very
   short blips climbing a scale, each one bending up inside itself, which is
   the "glug" of the thing being drunk. Then it settles rather than lands.

   Square waves and no filter, because the reference is a Game Boy. The things
   that would make this sound expensive - a sweep, a reverb tail, velocity
   shaping - are exactly the things that would stop it sounding like Pokemon.
   ------------------------------------------------------------ */
function psfxLevelUp() {
  if (!_psfxOn()) return;
  // TEMPORARY: audio/potion.MP3 when it is decoded, the synthesised bubble
  // otherwise. Turning SAMPLES_ENABLED off in js/audio-samples.js restores
  // the synth everywhere with no other change.
  if (typeof samplePlay === 'function' && samplePlay('potion', _psfxBus(), { gain: 0.13 })) return;
  /* Ten steps over about a third of a second. Fewer reads as an arpeggio and
     more as a siren; this is the density that reads as bubbling.

     The blips barely overlap, so the peak is close to one blip's own level
     rather than their sum — at 0.055 each the whole cue measured 0.19, half
     of what the cues around it peak at. */
  const steps = [392, 466, 523, 587, 659, 740, 831, 932, 1047, 1175];
  steps.forEach((f, i) => {
    psfxTone({ freq: f, to: f * 1.06, type: 'square', dur: 0.05, gain: 0.095, at: i * 0.032 });
  });
  // The last swallow, softer and rounder, so it stops rather than cuts off.
  psfxTone({ freq: 1319, to: 1397, type: 'square',   dur: 0.10, gain: 0.10, at: 0.33 });
  psfxTone({ freq: 659,               type: 'triangle', dur: 0.22, gain: 0.08, at: 0.34 });
}

/* ── A run that would not compile, or fell over ───────────────
   "Pak" — a crack, not a thud.

   The first version of this was a kick drum and sounded like hitting a box,
   for two reasons that are worth keeping written down. A sine falling to 45Hz
   IS a boom: that frequency is the body of a drum, and no amount of shortening
   it changes what it is. And the noise burst was low-passed down to 320Hz,
   which threw away every part of the sound that makes a crack a crack.

   So: no sub-bass at all, and the noise is BANDPASSED high and wide rather
   than low-passed. The weight comes from a short mid-range transient around
   400Hz instead — enough to feel like contact, well above where a room starts
   ringing. And the whole thing is 50ms rather than 160, because a "pak" that
   lasts long enough to have a tail is a "boom".
   ------------------------------------------------------------ */
function psfxPunch() {
  if (!_psfxOn()) return;
  const bus = _psfxBus();
  if (!bus) return;
  // TEMPORARY: audio/punch.MP3 when it is decoded, the synthesised crack
  // otherwise. See psfxLevelUp above.
  if (typeof samplePlay === 'function' && samplePlay('punch', bus, { gain: 0.24 })) return;
  const ctx = _sfxContext();
  const t = ctx.currentTime;

  // The crack. Short, steep, and up where the ear hears "sharp".
  const len = Math.floor(ctx.sampleRate * 0.035);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    // A steeper curve than the old thud: almost all the energy in the first
    // few milliseconds is what makes it a snap.
    d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 5);
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2200;
  bp.Q.value = 0.7;          // wide: a narrow one whistles instead of cracking
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 700;  // nothing below this, or the box comes back
  const ngain = ctx.createGain();
  // A crack concentrates its energy into a few milliseconds, so the same gain
  // that was safe on the old spread-out thud peaked at 0.94 here.
  ngain.gain.value = 0.25;
  noise.connect(bp); bp.connect(hp); hp.connect(ngain); ngain.connect(bus);
  noise.start(t);

  // The contact. Mid, not sub — this is the "pa", and it is over in 30ms.
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  const lp = ctx.createBiquadFilter();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(420, t);
  osc.frequency.exponentialRampToValueAtTime(180, t + 0.03);
  lp.type = 'lowpass';
  lp.frequency.value = 2400;
  env.gain.setValueAtTime(0.0001, t);
  env.gain.linearRampToValueAtTime(0.18, t + 0.003);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  osc.connect(lp); lp.connect(env); env.connect(bus);
  osc.start(t);
  osc.stop(t + 0.08);
}
