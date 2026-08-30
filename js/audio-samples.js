/* ============================================================
   AUDIO-SAMPLES.JS — the recorded voice and cues
   ------------------------------------------------------------
   TEMPORARY, and built to be easy to take back out. Everything synthesised
   is still there and still works: this adds a third typing voice and lets the
   two run cues prefer a recording when one is available.

   TO REVERT: set SAMPLES_ENABLED to false. The third voice disappears from
   the picker, the run cues go back to the synthesised potion and crack, and
   nothing else changes. To remove it for good, delete this file, its script
   tag, and the audio/ folder.

   WHY BUFFERS RATHER THAN <audio>. A keystroke sound has to be able to
   overlap itself — you type faster than the sample is long — and an <audio>
   element can only be at one position at a time, so fast typing would cut
   each blip off to restart it. Decoding once into an AudioBuffer and firing a
   fresh BufferSource per press is the only way the overlap sounds right, and
   it routes through the same gain buses as everything else, so the mute and
   the volume slider keep working without special cases.
   ============================================================ */

const SAMPLES_ENABLED = true;

/* The names are the files. Case included: GitHub Pages serves from a
   case-sensitive filesystem, so audio/voice.mp3 would 404 in production while
   working perfectly on Windows. */
const SAMPLE_FILES = {
  voice:  'audio/voice.MP3',
  potion: 'audio/potion.MP3',
  punch:  'audio/punch.MP3'
};

/** name -> AudioBuffer once decoded, or null while a fetch is in flight. */
const _sampleBuf = {};
const _sampleTried = {};
/** name -> { leadSec, endSec, peak } measured once at decode. */
const _sampleMeta = {};

/* Anything below this counts as silence rather than signal. Low enough to keep
   a soft attack, high enough to ignore encoder noise in a quiet lead-in. */
const SAMPLE_SILENCE = 0.01;

/**
 * Where the sound actually starts and stops, and how loud it is.
 *
 * Both matter, and both were wrong when played raw. voice.MP3 carries 104ms of
 * silence before its 80ms of sound: started at zero, every keystroke would
 * arrive a tenth of a second after the key, which reads as the app lagging
 * rather than as a voice. And the three files peak between 0.026 and 0.1,
 * where the synthesised cues sit at 0.33 to 0.62 — played at face value the
 * potion would be inaudible under the typing.
 */
function _sampleMeasure(buf) {
  const d = buf.getChannelData(0);
  let first = -1, last = 0, peak = 0;
  for (let i = 0; i < d.length; i++) {
    const a = Math.abs(d[i]);
    if (a > peak) peak = a;
    if (a > SAMPLE_SILENCE) { if (first < 0) first = i; last = i; }
  }
  if (first < 0) { first = 0; last = d.length - 1; }
  return {
    leadSec: first / buf.sampleRate,
    // A little tail past the last audible sample, so a decay is not clipped.
    endSec: Math.min(buf.duration, (last / buf.sampleRate) + 0.04),
    peak: peak || 1
  };
}

/**
 * Decode a sample, once.
 *
 * Deliberately fire-and-forget: the first keystroke or first run may arrive
 * before the file is decoded, and the right behaviour then is to fall back to
 * the synthesised sound rather than to delay the sound until it is ready. A
 * typing blip that arrives 200ms late is worse than one that is synthesised.
 */
function sampleLoad(name) {
  if (!SAMPLES_ENABLED) return null;
  if (_sampleBuf[name]) return _sampleBuf[name];
  if (_sampleTried[name]) return null;

  const ctx = (typeof _sfxContext === 'function') ? _sfxContext() : null;
  if (!ctx) return null;                    // no gesture yet; try again next time
  _sampleTried[name] = true;

  fetch(SAMPLE_FILES[name])
    .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('HTTP ' + r.status))))
    .then(b => ctx.decodeAudioData(b))
    .then(buf => { _sampleBuf[name] = buf; _sampleMeta[name] = _sampleMeasure(buf); })
    .catch(() => {
      // A missing or unreadable file is not an error worth interrupting anyone
      // over — the synthesised sound covers it. Allowed to be retried, since
      // the usual cause is a fetch that raced the service worker.
      _sampleTried[name] = false;
    });
  return null;
}

/** Is this sample ready to play right now? */
function sampleReady(name) {
  if (!SAMPLES_ENABLED) return false;
  if (_sampleBuf[name]) return true;
  sampleLoad(name);
  return false;
}

/**
 * Play a decoded sample on a given bus.
 *
 * @param {string} name
 * @param {AudioNode} bus     which gain to go through, so mute and volume apply
 * @param {object} [opts]     gain, rate, and rateJitter for per-press variation
 * @returns {boolean} whether it played, so callers can fall back
 */
function samplePlay(name, bus, opts) {
  if (!SAMPLES_ENABLED || !bus) return false;
  const buf = _sampleBuf[name];
  if (!buf) { sampleLoad(name); return false; }

  const ctx = _sfxContext();
  if (!ctx) return false;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const o = opts || {};
  const meta = _sampleMeta[name] || { leadSec: 0, endSec: buf.duration, peak: 1 };

  const src = ctx.createBufferSource();
  src.buffer = buf;
  // A recording played back identically twenty times a second is the machine
  // gun the synthesised voices jitter to avoid; the same fix works here.
  const jitter = o.rateJitter || 0;
  const rate = (o.rate || 1) * (1 - jitter / 2 + Math.random() * jitter);
  src.playbackRate.value = rate;

  const g = ctx.createGain();
  // Normalised to unit peak first, so the gain a caller passes means the same
  // thing it means for a synthesised sound rather than depending on how hot
  // the file happens to have been recorded.
  g.gain.value = (o.gain == null ? 1 : o.gain) / meta.peak;
  src.connect(g); g.connect(bus);

  // Start where the sound starts, not where the file starts, and stop at the
  // end of it rather than playing out the dead tail.
  src.start(ctx.currentTime, meta.leadSec, meta.endSec - meta.leadSec);
  return true;
}

/* Warm the cache as soon as there is a context to decode with, so the first
   keystroke is not the one that misses. Cheap: three files, ~40KB total. */
function samplePrewarm() {
  if (!SAMPLES_ENABLED) return;
  Object.keys(SAMPLE_FILES).forEach(sampleLoad);
}
