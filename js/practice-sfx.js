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

/* ── Sending a build ──────────────────────────────────────────
   One hammer blow on an anvil, struck as the check goes out.

   METAL IS INHARMONIC, and that is what makes this sound struck rather than
   played. A pitched instrument's partials are whole multiples of its
   fundamental; a struck bar's are not -- roughly 1 : 2.76 : 5.40 : 8.93.
   Sound those ratios and the ear hears metal even though every one of them
   is a plain sine. Whole multiples here would give a note, not a clang.

   Three parts to the strike: the ring above, a very short filtered noise
   burst for the chink of impact, and a low thud that falls in pitch as it
   decays -- the anvil's own mass moving. The `thud` and `ring` arguments stay
   parameters rather than being folded in, so a lighter tap is one call away
   if this ever wants a second voice.
   ------------------------------------------------------------ */

/** Ratios of a struck bar's modes. Not harmonics; that is the point. */
const PSFX_METAL = [1, 2.76, 5.40, 8.93];

function _psfxAnvilHit(o) {
  const bus = _psfxBus();
  if (!bus) return;
  const ctx = _sfxContext();
  const t = ctx.currentTime;
  const g = o.gain;

  PSFX_METAL.forEach((ratio, i) => {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    // A hair off exact, per partial per strike, so two hits are never twins.
    osc.frequency.setValueAtTime(o.freq * ratio * (1 + (Math.random() - 0.5) * 0.012), t);
    // Higher modes shed their energy first, which is why a clang brightens at
    // the moment of impact and darkens as it rings out.
    const dur = o.ring * [1, 0.62, 0.38, 0.24][i];
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(g / (i + 1.5), t + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(env); env.connect(bus);
    osc.start(t); osc.stop(t + dur + 0.02);
  });

  /* The impact itself. Noise shaped by a cubic fall, so it is a chink rather
     than a hiss -- without it the partials alone sound like a bell being
     rung, not like something being hit with a hammer. */
  const len = Math.floor(ctx.sampleRate * 0.045);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const k = 1 - i / len;
    ch[i] = (Math.random() * 2 - 1) * k * k * k;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = o.freq * 3.1;
  bp.Q.value = 1.1;
  const ng = ctx.createGain();
  ng.gain.value = g * 0.8;
  noise.connect(bp); bp.connect(ng); ng.connect(bus);
  noise.start(t);

  // The anvil's mass, on the heavy blow only.
  if (o.thud) {
    const low = ctx.createOscillator();
    const le = ctx.createGain();
    low.type = 'sine';
    low.frequency.setValueAtTime(160, t);
    low.frequency.exponentialRampToValueAtTime(72, t + 0.09);
    le.gain.setValueAtTime(0.0001, t);
    le.gain.linearRampToValueAtTime(g * 0.95, t + 0.004);
    le.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    low.connect(le); le.connect(bus);
    low.start(t); low.stop(t + 0.17);
  }
}

/* ONE STRIKE, not a loop. The cue marks the moment the check is sent, the
   way the fail and pass cues mark their moments -- it is not a progress
   indicator, and it does not try to fill the wait.

   That is the third shape this has taken and the first that is a cue at all.
   A repeating sound has to answer "how long does it run for", and every
   answer was wrong: a fixed interval became a clock, a sustained drone became
   ominous, and hammering on a loop turned a workshop into a factory floor.
   A single strike has no duration to get wrong.

   It also removes the machinery that existed only to stop the loop -- the
   pending-strike list and the 25-second cap. Nothing needs cancelling when
   the sound is over before the build is. */
function psfxWorkStart() {
  if (!_psfxOn()) return;
  // A little more weight and ring than a strike in a sequence would carry,
  // because nothing follows it.
  _psfxAnvilHit({ freq: 585, gain: 0.10, ring: 1.15, thud: true });
}

/**
 * Kept, and deliberately empty.
 *
 * Four call sites stop the cue when a build ends, aborts or the page leaves,
 * and they were right to when there was something running. There is not any
 * more. Removing the function would mean editing all four and losing the
 * hook, so it stays as the place a future sustained cue would be turned off.
 */
function psfxWorkStop() { /* a single strike finishes on its own */ }

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
