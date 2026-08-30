/* ============================================================
   AUDIO-SAMPLES.JS — the recorded voice and cues
   ------------------------------------------------------------
   These three sounds ARE the files in audio/. Nothing here synthesises an
   imitation and nothing falls back to one: the recorded typing voice, the
   success cue and the failure cue play audio/voice.MP3, audio/potion.MP3 and
   audio/punch.MP3 respectively, and if a file cannot be played there is
   silence rather than a substitute.

   There is deliberately no on/off flag. One would now mean "play nothing",
   since there is no synthesised path behind these any more, and a switch
   whose off position is silence is a worse thing to leave lying around than
   no switch at all. To remove the feature, delete this file, its script tag,
   and the audio/ folder.

   WHY BUFFERS RATHER THAN <audio>. A keystroke sound has to be able to
   overlap itself — you type faster than the sample is long — and an <audio>
   element has one playback position, so fast typing would cut each blip off
   to restart it. Buffers also route through the same gain buses as
   everything else, so the mute and the volume slider keep working with no
   special case.
   ============================================================ */

/* ── Where the audio comes from ───────────────────────────────
   js/audio-data.js, embedded as base64, rather than fetched from audio/.

   Fetching worked over http and was silent everywhere else, which is the
   worst way for audio to fail: nothing throws, nothing logs, the sound simply
   never arrives. A page opened from disk cannot fetch its own neighbours at
   all, and a stale service worker or a case-mismatched path fail the same
   quiet way. None of that can happen to a string in a script.

   audio/ is still the source of truth; js/audio-data.js is generated from it.
   ------------------------------------------------------------ */

/** name -> AudioBuffer once decoded, or null while a fetch is in flight. */
const _sampleBuf = {};
const _sampleTried = {};
/** name -> { peak } measured once at decode, for levelling only. */
const _sampleMeta = {};

/* Digital silence, not "quiet". An earlier version trimmed at 11% of a file's
   own peak, which cut the front off a soft attack — that was wrong and this is
   deliberately far below anything audible. */
const SAMPLE_ZERO = 0.001;
/* However padded a file is, never cut more than this from the front. A safety
   rail against a file whose real content genuinely does start quietly. */
const SAMPLE_MAX_TRIM = 0.35;

/**
 * The peak, for levelling, and where the actual audio sits inside the file.
 *
 * voice.MP3 measures as 70ms of EXACT zeroes, then about 140ms of sound, then
 * about 340ms of exact zeroes again — a short blip inside a half-second file.
 * Played from the top, every keystroke's sound arrives some 90ms after the
 * key, which is what stops it tracking your typing: the sounds are all there,
 * they are just uniformly late.
 *
 * So the padding is skipped, and nothing else is. This is not the earlier trim
 * that cut into the attack: the threshold here is a thousandth of full scale,
 * about a fortieth of this file's own peak, so only true silence goes.
 *
 * Levelling is the other thing applied, and for the same kind of reason: the
 * three files peak between 0.026 and 0.1 where the app's other cues sit at
 * 0.33 to 0.62, so at face value the potion is inaudible under the typing.
 */
function _sampleMeasure(buf) {
  const d = buf.getChannelData(0);
  let peak = 0, first = -1, last = 0;
  for (let i = 0; i < d.length; i++) {
    const a = Math.abs(d[i]);
    if (a > peak) peak = a;
    if (a > SAMPLE_ZERO) { if (first < 0) first = i; last = i; }
  }
  if (first < 0) return { peak: peak || 1, startSec: 0, playSec: buf.duration };

  const sr = buf.sampleRate;
  // Back off a few milliseconds so the very first cycle of the attack survives.
  let startSec = Math.max(0, (first / sr) - 0.005);
  startSec = Math.min(startSec, buf.duration * SAMPLE_MAX_TRIM);
  // Keep a generous tail so a decay is never clipped.
  const endSec = Math.min(buf.duration, (last / sr) + 0.06);
  return { peak: peak || 1, startSec: startSec, playSec: Math.max(0.02, endSec - startSec) };
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
  if (_sampleBuf[name]) return _sampleBuf[name];
  if (_sampleTried[name]) return null;
  if (typeof AUDIO_DATA === 'undefined' || !AUDIO_DATA[name]) return null;

  const ctx = (typeof _sfxContext === 'function') ? _sfxContext() : null;
  if (!ctx) return null;                    // no gesture yet; try again next time
  _sampleTried[name] = true;

  let bytes;
  try {
    const bin = atob(AUDIO_DATA[name]);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } catch (e) { _sampleTried[name] = false; return null; }

  // Still asynchronous: decoding an MP3 is, wherever the bytes came from.
  ctx.decodeAudioData(bytes.buffer)
    .then(buf => { _sampleBuf[name] = buf; _sampleMeta[name] = _sampleMeasure(buf); })
    .catch(() => { _sampleTried[name] = false; });
  return null;
}

/** Is this sample ready to play right now? */
function sampleReady(name) {
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
  if (!bus) return false;
  const buf = _sampleBuf[name];
  if (!buf) {
    /* Not decoded yet. Queue it rather than drop it: with no synthesised
       sound behind these, dropping would make the first run of a session
       silent — which is the run you most want to hear. Capped, because a
       cue that arrives ten seconds after the thing it describes is worse
       than one that never came. */
    sampleLoad(name);
    const at = Date.now();
    const wait = setInterval(() => {
      if (_sampleBuf[name]) { clearInterval(wait); samplePlay(name, bus, opts); }
      else if (Date.now() - at > 2000) clearInterval(wait);
    }, 60);
    return false;
  }

  const ctx = _sfxContext();
  if (!ctx) return false;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const o = opts || {};
  const meta = _sampleMeta[name] || { peak: 1, startSec: 0, playSec: buf.duration };

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

  // All of the audio, none of the padding — see _sampleMeasure.
  src.start(ctx.currentTime, meta.startSec, meta.playSec);
  return true;
}

/* Warm the cache as soon as there is a context to decode with, so the first
   keystroke is not the one that misses. Cheap: three files, ~40KB total. */
function samplePrewarm() {
  Object.keys(AUDIO_DATA || {}).forEach(sampleLoad);
}
