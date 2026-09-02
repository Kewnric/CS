/* ============================================================
   PRACTICE-SFX.JS — the attempt's cues
   ------------------------------------------------------------
   Sounds for the moments the attempt already marks visually: waiting on a
   build, a test case failing, one passing, every one passing, and finishing
   the attempt. Each is tied to the effect it belongs to, so the
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
let _psfxWorkVoice = null;   // the live graph while a build runs
let _psfxWorkCap = null;

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
   A warm, slowly breathing hum that holds until the check finishes.

   IT USED TO BE A CLOCK, and that is the thing being fixed. Two notes, 262
   and 196, alternating on a setInterval every 340ms: a fixed period with two
   pitches in it is a tick-tock however it is described, and once the ear has
   named it a clock the sound is telling you that time is passing rather than
   that work is happening. Waiting for a compiler is already the part of the
   loop that feels slow; a metronome counting it out makes it worse.

   So there is no repeating event here at all. One sustained voice starts when
   the build does and stops when it ends, and everything that moves in it is
   driven by two LFOs at 0.24 and 0.17 Hz -- deliberately not multiples of
   each other, so the filter sweep and the level swell drift in and out of
   phase and the sound never repeats a state. Nothing has an onset, so there
   is nothing for the ear to count.

   Low and quiet on purpose: it says the machine is still thinking, and it may
   run for several seconds, so anything that asks for attention would be the
   wrong sound. The two near-unison voices a whisker apart (116 and 116.9 Hz)
   beat against each other about once a second, which is what gives it life
   without giving it a pulse.
   ------------------------------------------------------------ */
function psfxWorkStart() {
  if (!_psfxOn()) return;
  psfxWorkStop();
  const bus = _psfxBus();
  if (!bus) return;
  const ctx = _sfxContext();
  const t = ctx.currentTime;

  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.linearRampToValueAtTime(0.052, t + 0.35);   // fade in, never a click

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(560, t);
  /* Q of 1.1, not 5. A resonant peak sweeping across the octave at 232 Hz
     boosted it every time it passed, so the sweep itself became a pulse --
     measured as part of an 11x swing between peak and trough. Gentle here;
     the movement should be felt, not heard arriving. */
  lp.Q.value = 1.1;

  /* Two voices a fraction apart, plus a quiet octave for body.
     THE PAIR IS DELIBERATELY UNEQUAL. At matched amplitude, 116 and 116.9 Hz
     beat all the way to full cancellation roughly once a second -- the hum
     dropped to near silence and came back, which is a slow throb and exactly
     the kind of countable pulse this sound exists to avoid. At 0.45 the
     second voice the beat runs between about 1.45 and 0.55 of the first:
     audible as shimmer, never as a gap. */
  const a = ctx.createOscillator(); a.type = 'sine';     a.frequency.value = 116;
  const b = ctx.createOscillator(); b.type = 'sine';     b.frequency.value = 116.9;
  const bGain = ctx.createGain(); bGain.gain.value = 0.45;
  const c = ctx.createOscillator(); c.type = 'triangle'; c.frequency.value = 232;
  const cGain = ctx.createGain(); cGain.gain.value = 0.26;

  // The sweep. Slow enough that no single pass reads as an event.
  const lfoF = ctx.createOscillator(); lfoF.type = 'sine'; lfoF.frequency.value = 0.24;
  const lfoFAmt = ctx.createGain(); lfoFAmt.gain.value = 170;
  lfoF.connect(lfoFAmt); lfoFAmt.connect(lp.frequency);

  // The swell, on its own unrelated period so the two never line up.
  const lfoG = ctx.createOscillator(); lfoG.type = 'sine'; lfoG.frequency.value = 0.17;
  const lfoGAmt = ctx.createGain(); lfoGAmt.gain.value = 0.011;
  lfoG.connect(lfoGAmt); lfoGAmt.connect(out.gain);

  a.connect(lp); b.connect(bGain); bGain.connect(lp); c.connect(cGain); cGain.connect(lp);
  lp.connect(out); out.connect(bus);

  const voices = [a, b, c, lfoF, lfoG];
  voices.forEach(n => n.start(t));
  _psfxWorkVoice = { out, voices };

  /* A cap, because "started" and "finished" are wired at different call sites
     and a build has several ways to end — an exception, a navigation, an
     engine that never answers. A hum still going a minute later would be
     worse than one that stops slightly early.

     The handle is KEPT, which it was not. An uncancelled cap belongs to the
     session that scheduled it and fires 25 seconds later regardless of what
     is running by then — so a check, a stop, and a second check one second
     later left the first cap alive to silence the second one mid-build. */
  clearTimeout(_psfxWorkCap);
  _psfxWorkCap = setTimeout(psfxWorkStop, 25000);
}

function psfxWorkStop() {
  clearTimeout(_psfxWorkCap);
  _psfxWorkCap = null;
  const v = _psfxWorkVoice;
  _psfxWorkVoice = null;
  if (!v) return;
  const ctx = (typeof _sfxContext === 'function') ? _sfxContext() : null;
  if (!ctx) return;
  const t = ctx.currentTime;
  try {
    /* Released rather than cut. Stopping the oscillators outright ends the
       waveform mid-cycle, and a hum that stops at a non-zero sample is a
       click — the one thing a sound this quiet cannot afford. */
    v.out.gain.cancelScheduledValues(t);
    v.out.gain.setValueAtTime(Math.max(0.0001, v.out.gain.value), t);
    v.out.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    v.voices.forEach(n => { try { n.stop(t + 0.3); } catch (e) { /* already stopped */ } });
  } catch (e) { /* context closed under us */ }
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
   audio/potion.MP3. The file, played — there is no synthesised version behind
   this any more, because a recording and an imitation of it are two different
   sounds and only one of them was asked for.

   If the file has not decoded yet the play is QUEUED rather than dropped: with
   nothing to fall back to, dropping it would mean the first run of a session
   is silent, which is exactly the run you most want to hear.
   ------------------------------------------------------------ */
function psfxLevelUp() {
  if (!_psfxOn()) return;
  samplePlay('potion', _psfxBus(), { gain: 0.0624 });
}

/* ── A run that would not compile, or fell over ───────────────
   audio/punch.MP3, on the same terms as the potion above.
   ------------------------------------------------------------ */
function psfxPunch() {
  if (!_psfxOn()) return;
  samplePlay('punch', _psfxBus(), { gain: 0.144 });
}
