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
   audio/potion.MP3. The file, played — there is no synthesised version behind
   this any more, because a recording and an imitation of it are two different
   sounds and only one of them was asked for.

   If the file has not decoded yet the play is QUEUED rather than dropped: with
   nothing to fall back to, dropping it would mean the first run of a session
   is silent, which is exactly the run you most want to hear.
   ------------------------------------------------------------ */
function psfxLevelUp() {
  if (!_psfxOn()) return;
  samplePlay('potion', _psfxBus(), { gain: 0.13 });
}

/* ── A run that would not compile, or fell over ───────────────
   audio/punch.MP3, on the same terms as the potion above.
   ------------------------------------------------------------ */
function psfxPunch() {
  if (!_psfxOn()) return;
  samplePlay('punch', _psfxBus(), { gain: 0.24 });
}
