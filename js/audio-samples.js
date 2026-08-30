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

const SAMPLE_FILES = {
  voice:  'audio/voice.MP3',
  potion: 'audio/potion.MP3',
  punch:  'audio/punch.MP3'
};

/** name -> AudioBuffer once decoded, or null while a fetch is in flight. */
const _sampleBuf = {};
const _sampleTried = {};
/** name -> { peak } measured once at decode, for levelling only. */
const _sampleMeta = {};

/**
 * How loud the file is, so it can be levelled without being altered.
 *
 * Only the peak now. The three files peak between 0.026 and 0.1, where the
 * rest of the app's cues sit between 0.33 and 0.62 — at face value the potion
 * would be inaudible under the typing. Levelling is a volume control, which is
 * the one thing that does have to be applied; the audio itself is untouched
 * and plays end to end.
 */
function _sampleMeasure(buf) {
  const d = buf.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < d.length; i++) {
    const a = Math.abs(d[i]);
    if (a > peak) peak = a;
  }
  return { peak: peak || 1 };
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
  const meta = _sampleMeta[name] || { peak: 1 };

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

  /* The whole file, from the top. An earlier version started at the first
     audible sample and stopped after the last, on the measurement that
     voice.MP3 opens with 104ms below the threshold — but the threshold was
     11% of that file's peak, so what it called silence was really a soft
     attack, and cutting it removed the front of the sound. These are cut the
     way they are meant to be heard; the player's job is to play them. */
  src.start(ctx.currentTime);
  return true;
}

/* Warm the cache as soon as there is a context to decode with, so the first
   keystroke is not the one that misses. Cheap: three files, ~40KB total. */
function samplePrewarm() {
  Object.keys(SAMPLE_FILES).forEach(sampleLoad);
}
