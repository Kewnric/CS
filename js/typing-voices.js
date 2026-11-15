/* ============================================================
   TYPING-VOICES.JS — ten more typing voices, all synthesised
   ------------------------------------------------------------
   typing-sfx.js owns the keystroke listener, the bus, the volume and the
   picker; this file only adds voices to it. Each one is an engine — a
   function that is handed a context, somewhere to play into and the key that
   was pressed — and registers itself into SFX_VOICES / SFX_VOICE_ORDER at
   load, so the picker lists it without either file naming the other's voices.

   WHY SYNTHESISED, NOT DOWNLOADED. Every sound here is built from oscillators
   and noise at the moment of the keypress, like the Keys voice already was.
   That means no files to fetch (nothing goes silent offline or from disk —
   the failure audio-samples.js describes), no licence attached to any of
   it, and every press can vary a little, which a recording played twenty
   times a second cannot do without help.

   THE KEY IS PASSED THROUGH. The older engines only receive numbers — a
   pitch, a length — so a key's character is decided before the engine sees
   it. These receive the key itself, which is what lets the kalimba give each
   letter its own note, the drums put a kick on the space bar, and the
   typewriter ring its bell on return.

   LEVELS. Each engine is written at whatever gains made it sound right, and
   SFX_SYNTH_LEVEL then scales the whole voice so switching between voices is
   a change of character, not of volume. Those figures were measured, not
   guessed: every voice rendered offline and compared on a K-weighted
   short-term loudness against the Keys voice, the same way typing-sfx.js
   levelled Keys against Mita.
   ============================================================ */

/** The five shapes a key can have. Everything else is an ordinary character. */
function _tvClass(key) {
  if (key === 'Enter') return 'enter';
  if (key === 'Backspace' || key === 'Delete') return 'back';
  if (key === ' ') return 'space';
  if (key === 'Tab') return 'tab';
  return 'char';
}

/** v, give or take `amt` of itself. Per press, so no two are identical. */
function _tvJit(v, amt) { return v * (1 - amt + Math.random() * amt * 2); }

/** A stable small number for a character, for voices that pick by key. */
function _tvCode(key) {
  return (typeof key === 'string' && key.length === 1) ? key.toLowerCase().charCodeAt(0) : 0;
}

/* ── Shared material ──────────────────────────────────────────
   Made once per context and reused by every press. Keyed on the context
   rather than held in one variable because the offline renderer used to
   level these is a second context, and a buffer made for one sample rate
   played through another is resampled — harmless, but not what was measured. */
const _tvNoiseBufs = new WeakMap();
const _tvChipNoiseBufs = new WeakMap();
const _tvPulseWaves = new WeakMap();
const _tvCaves = new WeakMap();

/** A second of white noise. Each burst reads it from a random offset. */
function _tvNoise(ctx) {
  let b = _tvNoiseBufs.get(ctx);
  if (b) return b;
  b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  _tvNoiseBufs.set(ctx, b);
  return b;
}

/* The noise channel of an old console: a random level held for several
   samples at a time, which is what gives 8-bit hiss its grit instead of the
   smooth wash of real white noise. */
function _tvChipNoise(ctx) {
  let b = _tvChipNoiseBufs.get(ctx);
  if (b) return b;
  b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
  const d = b.getChannelData(0);
  let v = 0;
  for (let i = 0; i < d.length; i++) {
    if (i % 7 === 0) v = Math.random() < 0.5 ? -1 : 1;
    d[i] = v;
  }
  _tvChipNoiseBufs.set(ctx, b);
  return b;
}

/* A 25% pulse rather than the square Web Audio ships: the narrower duty is
   the reedy, nasal tone people hear as "retro game", where a 50% square is
   just a hollow beep. Built from its Fourier series. */
function _tvPulse(ctx) {
  let w = _tvPulseWaves.get(ctx);
  if (w) return w;
  const n = 40, duty = 0.25;
  const re = new Float32Array(n), im = new Float32Array(n);
  for (let k = 1; k < n; k++) {
    re[k] = Math.sin(2 * Math.PI * k * duty) / (k * Math.PI);
    im[k] = (1 - Math.cos(2 * Math.PI * k * duty)) / (k * Math.PI);
  }
  w = ctx.createPeriodicWave(re, im);
  _tvPulseWaves.set(ctx, w);
  return w;
}

/* A cave for the droplets: a convolver fed with a decaying, darkened noise
   tail, made once per bus. Without the space around it a drop is a blip; in
   one it is water. */
function _tvCave(ctx, bus) {
  let c = _tvCaves.get(bus);
  if (c) return c;
  const len = Math.floor(ctx.sampleRate * 1.6);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      // One-pole lowpass over the noise: stone swallows the highs first.
      lp += ((Math.random() * 2 - 1) - lp) * 0.35;
      d[i] = lp * Math.pow(1 - i / len, 3.4);
    }
  }
  const conv = ctx.createConvolver();
  conv.buffer = ir;
  const send = ctx.createGain();
  send.gain.value = 0.55;
  send.connect(conv);
  conv.connect(bus);
  _tvCaves.set(bus, send);
  return send;
}

/* ── Building blocks ──────────────────────────────────────────
   Two of them cover almost everything: a burst of filtered noise (anything
   struck, scraped or splashed) and a tone with a pitch move (anything that
   rings). The envelope is the same percussive shape in both — a linear
   attack so the front does not click, then an exponential fall. */

/**
 * A burst of filtered noise.
 * @param {object} o  dur, gain, freq, [type], [q], [freqEnd], [attack]
 */
function _tvBurst(ctx, out, t, o) {
  const src = ctx.createBufferSource();
  src.buffer = o.chip ? _tvChipNoise(ctx) : _tvNoise(ctx);
  const f = ctx.createBiquadFilter();
  f.type = o.type || 'bandpass';
  f.frequency.setValueAtTime(o.freq, t);
  if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(o.freqEnd, t + o.dur);
  f.Q.value = o.q == null ? 1 : o.q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(o.gain, t + (o.attack || 0.001));
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  src.connect(f); f.connect(g); g.connect(out);
  src.start(t, Math.random() * 0.4, o.dur + 0.03);
  return g;
}

/**
 * A tone that rings and falls.
 * @param {object} o  freq, dur, gain, [type], [wave], [freqEnd], [glide], [attack], [lp]
 */
function _tvTone(ctx, out, t, o) {
  const osc = ctx.createOscillator();
  if (o.wave) osc.setPeriodicWave(o.wave); else osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(o.freqEnd, t + (o.glide || o.dur));
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(o.gain, t + (o.attack || 0.002));
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  if (o.lp) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = o.lp;
    osc.connect(lp); lp.connect(g);
  } else {
    osc.connect(g);
  }
  g.connect(out);
  osc.start(t);
  osc.stop(t + o.dur + 0.03);
  return g;
}

/**
 * A struck bell, by FM: a sine whose pitch is wobbled by a second sine at a
 * non-whole ratio. The wobble dies away faster than the note does, which is
 * what a bell does — bright and clangy at the strike, pure as it rings out.
 * The ratio is the material: 1.4 is brass, 3.5 is glass.
 */
function _tvBell(ctx, out, t, f, dur, gain, ratio, index) {
  const car = ctx.createOscillator();
  const mod = ctx.createOscillator();
  const depth = ctx.createGain();
  const env = ctx.createGain();
  car.frequency.value = f;
  mod.frequency.value = f * ratio;
  depth.gain.setValueAtTime(f * index, t);
  depth.gain.exponentialRampToValueAtTime(f * index * 0.04, t + dur * 0.45);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.linearRampToValueAtTime(gain, t + 0.0015);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  mod.connect(depth); depth.connect(car.frequency);
  car.connect(env); env.connect(out);
  car.start(t); mod.start(t);
  car.stop(t + dur + 0.03); mod.stop(t + dur + 0.03);
}

/** Notes of a major pentatonic above `base`. Any two of them agree. */
const TV_PENTA = [0, 2, 4, 7, 9];
function _tvPentaNote(i, base) {
  const oct = Math.floor(i / 5);
  return base * Math.pow(2, (TV_PENTA[i % 5] + 12 * oct) / 12);
}

/* ============================================================
   THE VOICES
   ============================================================ */

/* ── Typewriter ───────────────────────────────────────────────
   A letter is the typebar hitting the platen — hard and bright, with a
   little metal ring — over the desk taking the blow, then the escapement
   stepping the carriage on one space a moment after. The space bar has no
   typebar, so it is only the carriage: a duller clunk. Return is the one
   everyone remembers: the bell, the ratchet of the carriage being thrown
   back, and the thud as it lands. */
function _tvTypewriter(ctx, out, key) {
  const t = ctx.currentTime;
  const c = _tvClass(key);

  if (c === 'enter') {
    _tvBell(ctx, out, t, _tvJit(2350, 0.01), 1.1, 0.11, 1.41, 1.1);
    for (let i = 0; i < 7; i++) {
      _tvBurst(ctx, out, t + 0.07 + i * 0.021, { freq: _tvJit(2300, 0.08), q: 3, dur: 0.012, gain: 0.55 - i * 0.03 });
    }
    _tvBurst(ctx, out, t + 0.235, { freq: 620, q: 1.1, dur: 0.07, gain: 1.1 });
    _tvTone(ctx, out, t + 0.235, { freq: 120, freqEnd: 62, dur: 0.09, gain: 0.34 });
    return;
  }

  if (c === 'space') {
    _tvBurst(ctx, out, t, { freq: _tvJit(720, 0.1), q: 1.3, dur: 0.05, gain: 1.0 });
    _tvTone(ctx, out, t, { freq: _tvJit(125, 0.06), freqEnd: 70, dur: 0.075, gain: 0.3 });
    _tvBurst(ctx, out, t + 0.03, { type: 'highpass', freq: 3400, q: 0.7, dur: 0.009, gain: 0.22 });
    return;
  }

  const dull = c === 'back';
  _tvBurst(ctx, out, t, { freq: _tvJit(dull ? 1700 : 2700, 0.12), q: 2.2, dur: 0.03, gain: 1.5 });
  _tvTone(ctx, out, t, { type: 'triangle', freq: _tvJit(dull ? 1250 : 1900, 0.05), dur: 0.04, gain: 0.06 });
  _tvTone(ctx, out, t, { freq: _tvJit(dull ? 95 : 140, 0.06), freqEnd: 60, dur: 0.065, gain: 0.3 });
  _tvBurst(ctx, out, t + _tvJit(0.024, 0.15), { type: 'highpass', freq: 3600, q: 0.7, dur: 0.008, gain: 0.26 });
  if (c === 'tab') {
    // A tab stop: the carriage runs on several spaces, so several steps.
    _tvBurst(ctx, out, t + 0.05, { type: 'highpass', freq: 3600, q: 0.7, dur: 0.008, gain: 0.2 });
    _tvBurst(ctx, out, t + 0.072, { type: 'highpass', freq: 3600, q: 0.7, dur: 0.008, gain: 0.16 });
  }
}

/* ── Thock ────────────────────────────────────────────────────
   The other kind of keyboard. Keys is a clicky switch: a bright snap with a
   body under it. This is a lubed linear in a dampened case — no click at
   all, just a round low knock where the case resonates and the keycap
   bottoms out. The space bar is a long key on stabilisers, so it lands
   deeper and with a second, smaller knock as the wire settles. */
const TV_THOCK_SHAPE = {
  //       pitch  length  loud
  char:  [1.00,  1.00,   1.00],
  space: [0.72,  1.40,   1.12],
  enter: [0.80,  1.25,   1.10],
  back:  [0.90,  0.90,   0.85],
  tab:   [0.86,  1.10,   1.00]
};
function _tvThock(ctx, out, key) {
  const t = ctx.currentTime;
  const c = _tvClass(key);
  const s = TV_THOCK_SHAPE[c];
  _tvBurst(ctx, out, t, { freq: _tvJit(440 * s[0], 0.1), q: 1.6, dur: 0.032 * s[1], gain: 1.7 * s[2] });
  _tvTone(ctx, out, t, { freq: _tvJit(190 * s[0], 0.05), freqEnd: 105 * s[0], dur: 0.05 * s[1], gain: 0.34 * s[2] });
  // A faint top so it reads as a key and not a drum — low-passed, nothing sharp.
  _tvBurst(ctx, out, t, { type: 'lowpass', freq: 2300, q: 0.5, dur: 0.006, gain: 0.2 * s[2] });
  if (c === 'space') _tvBurst(ctx, out, t + 0.011, { freq: 300, q: 2, dur: 0.04, gain: 0.9 });
}

/* ── Bubbles ──────────────────────────────────────────────────
   A bubble's pitch rises as it closes, so the sound is a sine sweeping UP —
   the "bloop" — which is the opposite of everything percussive here. The
   space bar is a bigger, lower one; return lets out two; backspace runs
   the sweep backwards, as if the bubble were sucked back in. */
function _tvBubbleOne(ctx, out, t, f, dur, rise, gain) {
  _tvTone(ctx, out, t, { freq: f, freqEnd: f * rise, glide: dur * 0.85, dur: dur, gain: gain, attack: 0.004 });
}
function _tvBubbles(ctx, out, key) {
  const t = ctx.currentTime;
  const c = _tvClass(key);
  if (c === 'enter') {
    _tvBubbleOne(ctx, out, t, _tvJit(290, 0.05), 0.09, 2.1, 0.34);
    _tvBubbleOne(ctx, out, t + 0.08, _tvJit(460, 0.05), 0.075, 2.2, 0.3);
    return;
  }
  if (c === 'back') {
    const f = _tvJit(820, 0.12);
    _tvTone(ctx, out, t, { freq: f, freqEnd: f * 0.5, glide: 0.055, dur: 0.065, gain: 0.3, attack: 0.004 });
    return;
  }
  if (c === 'space') { _tvBubbleOne(ctx, out, t, _tvJit(250, 0.1), 0.095, 2.2, 0.36); return; }
  if (c === 'tab') {
    _tvBubbleOne(ctx, out, t, _tvJit(380, 0.1), 0.06, 2.2, 0.3);
    _tvBubbleOne(ctx, out, t + 0.05, _tvJit(520, 0.1), 0.055, 2.2, 0.26);
    return;
  }
  _tvBubbleOne(ctx, out, t, _tvJit(440, 0.2), 0.065, 2.3, 0.32);
}

/* ── Kalimba ──────────────────────────────────────────────────
   The catchy one. Every letter is its own note of a G major pentatonic, so a
   word is a little tune and typing the same word plays the same tune again.
   Pentatonic because no two of its notes clash: however fast you type and
   however the notes overlap, it never sounds wrong.

   A tine is a pure tone that rings for half a second, with a brief metallic
   overtone at the moment of the pluck and the soft knock of the thumb. The
   space bar is the low root; return rolls a chord, which lands like the end
   of a phrase; backspace is a tine damped under the thumb at once. */
function _tvTine(ctx, out, t, f, decay, gain) {
  _tvTone(ctx, out, t, { freq: f, dur: decay, gain: gain, attack: 0.002 });
  _tvTone(ctx, out, t, { freq: f * 2, dur: decay * 0.3, gain: gain * 0.22 });
  _tvTone(ctx, out, t, { freq: f * 5.95, dur: 0.045, gain: gain * 0.2 });
  _tvBurst(ctx, out, t, { type: 'lowpass', freq: 2600, q: 0.6, dur: 0.005, gain: gain * 0.7 });
}
function _tvKalimba(ctx, out, key) {
  const t = ctx.currentTime;
  const c = _tvClass(key);
  const G4 = 392;
  if (c === 'enter') {
    [0, 2, 3, 5].forEach((n, i) => _tvTine(ctx, out, t + i * 0.05, _tvPentaNote(n, G4), 0.7, 0.16));
    return;
  }
  if (c === 'space') { _tvTine(ctx, out, t, G4 / 2, 0.55, 0.22); return; }
  if (c === 'back')  { _tvTine(ctx, out, t, _tvPentaNote(1, G4 / 2), 0.09, 0.32); return; }
  if (c === 'tab')   { _tvTine(ctx, out, t, _tvPentaNote(3, G4 / 2), 0.4, 0.2); return; }
  _tvTine(ctx, out, t, _tvPentaNote(_tvCode(key) % 10, G4), 0.42, 0.18);
}

/* ── 8-bit ────────────────────────────────────────────────────
   A pulse wave that jumps up a fifth partway through — two notes, one
   keystroke, the shape of every text box in an old console game. The space
   bar is the noise channel; return plays a rising arpeggio, the small
   fanfare of a line finished; backspace jumps down instead of up. Flat
   envelopes and hard edges on purpose: the hardware had nothing else. */
const TV_CHIP_NOTES = [659.25, 783.99, 880, 987.77, 1174.66];
function _tvChipNote(ctx, out, t, f, dur, gain, f2, at) {
  const osc = ctx.createOscillator();
  osc.setPeriodicWave(_tvPulse(ctx));
  osc.frequency.setValueAtTime(f, t);
  if (f2) osc.frequency.setValueAtTime(f2, t + at);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 6000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.001);
  g.gain.setValueAtTime(gain, t + dur - 0.012);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  osc.connect(lp); lp.connect(g); g.connect(out);
  osc.start(t); osc.stop(t + dur + 0.02);
}
function _tvChip(ctx, out, key) {
  const t = ctx.currentTime;
  const c = _tvClass(key);
  if (c === 'enter') {
    [1046.5, 1318.5, 1568, 2093].forEach((f, i) => _tvChipNote(ctx, out, t + i * 0.042, f, i === 3 ? 0.11 : 0.045, 0.1));
    return;
  }
  if (c === 'space') {
    _tvBurst(ctx, out, t, { chip: true, type: 'lowpass', freq: 5200, q: 0.5, dur: 0.045, gain: 0.18 });
    return;
  }
  const f = TV_CHIP_NOTES[Math.floor(Math.random() * TV_CHIP_NOTES.length)];
  if (c === 'back') { _tvChipNote(ctx, out, t, f, 0.055, 0.1, f * 0.667, 0.026); return; }
  if (c === 'tab')  { _tvChipNote(ctx, out, t, f, 0.07, 0.1, f * 2, 0.035); return; }
  _tvChipNote(ctx, out, t, f, 0.05, 0.1, f * 1.5, 0.022);
}

/* ── Woodblock ────────────────────────────────────────────────
   Hollow wood struck with a stick: a pitched knock whose overtone sits at a
   non-whole multiple — wood is inharmonic, which is why it is a "tok" and
   not a note. Three blocks, chosen by the key, like a set of temple blocks;
   the space bar is the big low one; return knocks low then high. */
const TV_WOOD_BLOCKS = [1250, 1000, 820];
function _tvBlock(ctx, out, t, f, dur, loud) {
  _tvTone(ctx, out, t, { freq: f, freqEnd: f * 0.97, dur: dur, gain: 0.34 * loud, attack: 0.001 });
  _tvTone(ctx, out, t, { freq: f * 2.84, dur: dur * 0.4, gain: 0.07 * loud, attack: 0.001 });
  _tvBurst(ctx, out, t, { freq: f * 1.5, q: 4, dur: 0.008, gain: 0.7 * loud });
}
function _tvWood(ctx, out, key) {
  const t = ctx.currentTime;
  const c = _tvClass(key);
  if (c === 'enter') {
    _tvBlock(ctx, out, t, 600, 0.09, 1.05);
    _tvBlock(ctx, out, t + 0.085, 1250, 0.06, 0.95);
    return;
  }
  if (c === 'space') { _tvBlock(ctx, out, t, _tvJit(560, 0.02), 0.085, 1.05); return; }
  if (c === 'back')  { _tvBlock(ctx, out, t, _tvJit(700, 0.02), 0.028, 0.95); return; }
  if (c === 'tab')   { _tvBlock(ctx, out, t, 820, 0.06, 1); _tvBlock(ctx, out, t + 0.06, 820, 0.05, 0.7); return; }
  const f = TV_WOOD_BLOCKS[_tvCode(key) % TV_WOOD_BLOCKS.length];
  _tvBlock(ctx, out, t, _tvJit(f, 0.015), 0.055, 1);
}

/* ── Droplets ─────────────────────────────────────────────────
   Water dripping in a cave. A drop is a very fast upward chirp — the bubble
   it traps under the surface closing — and the cave is what makes it water
   rather than a beep. High and quick where Bubbles is low and slow. */
function _tvDrop(ctx, out, t, f, gain, down) {
  _tvTone(ctx, out, t, {
    freq: f, freqEnd: down ? f * 0.55 : f * 2.6, glide: down ? 0.03 : 0.012,
    dur: down ? 0.06 : 0.05, gain: gain, attack: 0.001
  });
}
function _tvDroplets(ctx, out, key, bus) {
  const t = ctx.currentTime;
  const c = _tvClass(key);
  out.connect(_tvCave(ctx, bus));
  if (c === 'enter') {
    _tvDrop(ctx, out, t, 880, 0.3);
    _tvDrop(ctx, out, t + 0.11, 1320, 0.26);
    _tvDrop(ctx, out, t + 0.2, 1760, 0.18);
    return;
  }
  if (c === 'space') { _tvDrop(ctx, out, t, _tvJit(620, 0.08), 0.34); return; }
  if (c === 'back')  { _tvDrop(ctx, out, t, _tvJit(1500, 0.08), 0.28, true); return; }
  _tvDrop(ctx, out, t, _tvJit(1150, 0.22), 0.3);
}

/* ── Crystal ──────────────────────────────────────────────────
   Glass chimes. Each key strikes one at random from a high pentatonic, so it
   sparkles without repeating a tune the way the kalimba deliberately does.
   Return is a wind-chime run; backspace a short tick of glass on glass. */
function _tvCrystal(ctx, out, key) {
  const t = ctx.currentTime;
  const c = _tvClass(key);
  const C6 = 1046.5;
  const pick = () => _tvPentaNote(Math.floor(Math.random() * 8), C6);
  if (c === 'enter') {
    for (let i = 0; i < 5; i++) _tvBell(ctx, out, t + i * 0.045, pick(), 0.5, 0.09, 3.5, 0.6);
    return;
  }
  if (c === 'space') { _tvBell(ctx, out, t, _tvPentaNote(Math.floor(Math.random() * 3), C6 / 2), 0.55, 0.13, 3.5, 0.5); return; }
  if (c === 'back')  { _tvBell(ctx, out, t, _tvJit(1400, 0.05), 0.07, 0.2, 3.5, 0.9); return; }
  _tvBell(ctx, out, t, pick(), 0.38, 0.1, 3.5, 0.6);
}

/* ── Pencil ───────────────────────────────────────────────────
   Graphite on paper. A stroke is noise through a broad band that moves as
   the stroke does, broken up by the tooth of the paper — the gain is
   re-rolled every few milliseconds, which is the grain you hear in real
   writing. The space bar is the tip lifting and landing; return underlines
   the line; backspace is the eraser, two quick rubs. */
function _tvStroke(ctx, out, t, dur, from, to, gain) {
  const src = ctx.createBufferSource();
  src.buffer = _tvNoise(ctx);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 0.9;
  bp.frequency.setValueAtTime(from, t);
  bp.frequency.exponentialRampToValueAtTime(to, t + dur);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1100;
  const grain = ctx.createGain();
  for (let k = 0, n = Math.ceil(dur / 0.004); k < n; k++) {
    grain.gain.setValueAtTime(0.45 + Math.random() * 0.55, t + k * 0.004);
  }
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.linearRampToValueAtTime(gain, t + Math.min(0.01, dur * 0.25));
  env.gain.setValueAtTime(gain, t + dur * 0.55);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp); bp.connect(hp); hp.connect(grain); grain.connect(env); env.connect(out);
  src.start(t, Math.random() * 0.4, dur + 0.03);
}
function _tvPencil(ctx, out, key) {
  const t = ctx.currentTime;
  const c = _tvClass(key);
  if (c === 'enter') { _tvStroke(ctx, out, t, 0.17, 2300, 5200, 0.5); return; }
  if (c === 'space') {
    _tvBurst(ctx, out, t, { type: 'lowpass', freq: 1900, q: 0.7, dur: 0.012, gain: 2.4 });
    _tvTone(ctx, out, t, { freq: 320, freqEnd: 210, dur: 0.022, gain: 0.3 });
    return;
  }
  if (c === 'back') {
    _tvStroke(ctx, out, t, 0.05, 1500, 2000, 0.7);
    _tvStroke(ctx, out, t + 0.062, 0.05, 2000, 1500, 0.6);
    return;
  }
  const up = Math.random() < 0.5;
  const a = _tvJit(3000, 0.15), b = _tvJit(4300, 0.15);
  _tvStroke(ctx, out, t, _tvJit(0.045, 0.3), up ? a : b, up ? b : a, 0.7);
}

/* ── Drums ────────────────────────────────────────────────────
   A kit under your fingers: letters and digits are the closed hi-hat, the
   space bar is the kick, return is the snare, backspace a tom, tab an open
   hat and punctuation a rim click. Ordinary typing — words and the spaces
   between them — comes out as hats and kicks, which is a beat. */
function _tvKick(ctx, out, t) {
  _tvTone(ctx, out, t, { freq: 165, freqEnd: 48, glide: 0.075, dur: 0.24, gain: 0.25, attack: 0.001 });
  _tvBurst(ctx, out, t, { type: 'lowpass', freq: 1400, q: 0.7, dur: 0.006, gain: 0.12 });
}
function _tvDrums(ctx, out, key) {
  const t = ctx.currentTime;
  const c = _tvClass(key);
  if (c === 'space') { _tvKick(ctx, out, t); return; }
  if (c === 'enter') {
    _tvKick(ctx, out, t);
    _tvTone(ctx, out, t, { type: 'triangle', freq: 215, freqEnd: 170, dur: 0.09, gain: 0.11, attack: 0.001 });
    _tvBurst(ctx, out, t, { freq: 2100, q: 0.7, dur: 0.15, gain: 0.34 });
    _tvBurst(ctx, out, t, { type: 'highpass', freq: 6000, q: 0.7, dur: 0.1, gain: 0.14 });
    return;
  }
  if (c === 'back') {
    _tvTone(ctx, out, t, { freq: _tvJit(230, 0.03), freqEnd: 140, glide: 0.12, dur: 0.2, gain: 0.26, attack: 0.001 });
    return;
  }
  if (c === 'tab') { _tvBurst(ctx, out, t, { type: 'highpass', freq: 7000, q: 0.7, dur: 0.24, gain: 0.42 }); return; }
  if (!/^[a-z0-9]$/i.test(key || 'a')) {
    _tvBurst(ctx, out, t, { freq: 1800, q: 5, dur: 0.02, gain: 1.4 });
    _tvTone(ctx, out, t, { type: 'triangle', freq: 900, dur: 0.016, gain: 0.1 });
    return;
  }
  // A little accent per hit, so a run of hats grooves instead of ticking.
  _tvBurst(ctx, out, t, { type: 'highpass', freq: _tvJit(7200, 0.06), q: 0.7, dur: _tvJit(0.035, 0.2), gain: _tvJit(0.36, 0.18) });
}

/* ============================================================
   REGISTRATION
   ============================================================ */

const SFX_SYNTHS = {
  typewriter: _tvTypewriter,
  thock:      _tvThock,
  bubbles:    _tvBubbles,
  kalimba:    _tvKalimba,
  chip:       _tvChip,
  wood:       _tvWood,
  droplets:   _tvDroplets,
  crystal:    _tvCrystal,
  pencil:     _tvPencil,
  drums:      _tvDrums
};

/* Whole-voice trims, from the offline measurement described at the top. */
const SFX_SYNTH_LEVEL = {
  typewriter: 0.65, thock: 0.89, bubbles: 0.86, kalimba: 0.55, chip: 1,
  wood: 0.9, droplets: 0.85, crystal: 0.85, pencil: 0.45, drums: 1
};

/* `demo` is what plays when the voice is picked: the keys that show it off,
   rather than the same three letters for every voice — a typewriter is not
   a typewriter until the bell, and the drums are not drums until the kick. */
const SFX_SYNTH_VOICES = [
  { id: 'typewriter', label: 'Typewriter', hint: 'Clack, and a bell on return', demo: ['t', 'y', 'p', 'Enter'] },
  { id: 'thock',      label: 'Thock',      hint: 'Deep, creamy keyboard',       demo: ['a', 'e', ' ', 'k'] },
  { id: 'bubbles',    label: 'Bubbles',    hint: 'Soft little bloops',          demo: ['a', 'e', ' '] },
  { id: 'kalimba',    label: 'Kalimba',    hint: 'Every letter is a note',      demo: ['h', 'e', 'l', 'l', 'o'], demoGap: 120 },
  { id: 'chip',       label: '8-bit',      hint: 'Retro game blips',            demo: ['a', 'e', 'Enter'] },
  { id: 'wood',       label: 'Woodblock',  hint: 'Hollow wooden tok',           demo: ['a', 'b', 'c', ' '], demoGap: 110 },
  { id: 'droplets',   label: 'Droplets',   hint: 'Drips in a cave',             demo: ['a', ' ', 'e'], demoGap: 150 },
  { id: 'crystal',    label: 'Crystal',    hint: 'Glassy chimes',               demo: ['a', 'e', 'i'], demoGap: 110 },
  { id: 'pencil',     label: 'Pencil',     hint: 'Graphite on paper',           demo: ['a', 'e', ' ', 'o'] },
  { id: 'drums',      label: 'Drums',      hint: 'Type a beat',                 demo: [' ', 'a', 'Enter', 'a', ' ', ' ', 'Enter'], demoGap: 130 }
];

if (typeof SFX_VOICES !== 'undefined' && typeof SFX_VOICE_ORDER !== 'undefined') {
  SFX_SYNTH_VOICES.forEach(v => {
    SFX_VOICES[v.id] = { id: v.id, label: v.label, hint: v.hint, engine: v.id, demo: v.demo, demoGap: v.demoGap };
    if (SFX_VOICE_ORDER.indexOf(v.id) === -1) SFX_VOICE_ORDER.push(v.id);
  });
}

/** Whether `engine` is one of these. typing-sfx.js asks before it dispatches. */
function sfxIsSynth(engine) { return Object.prototype.hasOwnProperty.call(SFX_SYNTHS, engine); }

/**
 * Play one keystroke on a synthesised voice.
 *
 * Every press gets its own trim gain into the bus, so the level table above
 * applies without any engine knowing it exists — and the droplets can send
 * that same, already-trimmed signal to the cave.
 */
function sfxSynthPlay(engine, ctx, bus, key) {
  const fn = SFX_SYNTHS[engine];
  if (!fn || !ctx || !bus) return false;
  const out = ctx.createGain();
  out.gain.value = SFX_SYNTH_LEVEL[engine] || 1;
  out.connect(bus);
  fn(ctx, out, typeof key === 'string' && key ? key : 'a', bus);
  return true;
}
