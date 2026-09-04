/* SPEECH.JS — reading things out loud.

   THE WEB SPEECH API, NOT A SERVICE. speechSynthesis ships in the browser: no
   key, no network, no account, and it keeps working offline, which matters for
   an app that is a folder of files on GitHub Pages. A hosted TTS service would
   need a secret, and this repo is public — the same reason the Spotify support
   uses PKCE and never stores one.

   THE VOICE IS THE USER'S, CHOSEN FROM WHAT THEY HAVE. The list comes from the
   operating system, so it differs per machine and per browser; there is no
   bundled voice to pick a default from. Pitch and rate are exposed alongside it
   because they are what actually make a voice sound like a character — a stock
   voice at pitch 1.6 and rate 1.15 is a different thing from the same voice
   flat, and it is the part of "make it sound like X" that can honestly be
   offered. */

const SPEECH_PREF_KEY = 'ssp.speech';

const SPEECH_DEFAULTS = { voiceURI: '', pitch: 1, rate: 1, volume: 1, enabled: true };

function speechSupported() {
  return typeof window !== 'undefined'
      && typeof window.speechSynthesis !== 'undefined'
      && typeof window.SpeechSynthesisUtterance === 'function';
}

function speechPrefs() {
  try {
    const raw = localStorage.getItem(SPEECH_PREF_KEY);
    return Object.assign({}, SPEECH_DEFAULTS, raw ? JSON.parse(raw) : {});
  } catch (e) {
    return Object.assign({}, SPEECH_DEFAULTS);
  }
}

function speechSetPref(patch) {
  const next = Object.assign(speechPrefs(), patch || {});
  try { localStorage.setItem(SPEECH_PREF_KEY, JSON.stringify(next)); } catch (e) { /* private mode */ }
  return next;
}

/* The voice list arrives asynchronously in Chrome — getVoices() is empty on the
   first call of a page load and fills in once the engine has enumerated them,
   announced by voiceschanged. Anything that paints a picker has to wait for
   that or it paints an empty select. */
let _speechVoices = [];
let _speechVoicesReady = false;
const _speechVoiceWaiters = [];

function _speechCollectVoices() {
  if (!speechSupported()) return;
  const list = window.speechSynthesis.getVoices() || [];
  if (!list.length) return;
  _speechVoices = list;
  _speechVoicesReady = true;
  while (_speechVoiceWaiters.length) {
    const fn = _speechVoiceWaiters.shift();
    try { fn(_speechVoices); } catch (e) { console.error('[Speech] voice waiter:', e); }
  }
}

function speechVoices() { return _speechVoices.slice(); }

/** Call back with the voice list, now or as soon as the engine reports one. */
function speechOnVoices(fn) {
  if (typeof fn !== 'function') return;
  if (_speechVoicesReady) { fn(speechVoices()); return; }
  _speechVoiceWaiters.push(fn);
  _speechCollectVoices();
}

if (speechSupported()) {
  _speechCollectVoices();
  window.speechSynthesis.addEventListener('voiceschanged', _speechCollectVoices);
}

function _speechPickVoice(prefs) {
  if (!_speechVoices.length) return null;
  if (prefs.voiceURI) {
    const hit = _speechVoices.find(v => v.voiceURI === prefs.voiceURI);
    if (hit) return hit;
  }
  // Nothing chosen, or the chosen voice is gone (another machine, or a browser
  // that ships a different set): fall back to the platform default rather than
  // going silent.
  return _speechVoices.find(v => v.default) || _speechVoices[0];
}

/**
 * Say something.
 *
 * Cancels whatever is mid-sentence first — pressing a read button twice should
 * restart it, not queue a second copy behind the first, and speechSynthesis
 * queues by default.
 *
 * @param {string} text
 * @param {{lang?: string, onend?: Function, onstart?: Function}} [opts]
 * @returns {boolean} false when nothing was said
 */
function speak(text, opts) {
  opts = opts || {};
  if (!speechSupported()) return false;
  const prefs = speechPrefs();
  if (!prefs.enabled) return false;

  const clean = _speechPlainText(text);
  if (!clean) return false;

  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(clean);
  const voice = _speechPickVoice(prefs);
  if (voice) { u.voice = voice; u.lang = opts.lang || voice.lang; }
  else if (opts.lang) { u.lang = opts.lang; }
  // The spec's ranges: pitch 0–2, rate 0.1–10. Clamped because a stored value
  // outside them makes the whole utterance fail silently rather than clip.
  u.pitch = Math.min(2, Math.max(0, Number(prefs.pitch) || 1));
  u.rate = Math.min(4, Math.max(0.1, Number(prefs.rate) || 1));
  u.volume = Math.min(1, Math.max(0, Number(prefs.volume)));
  if (typeof opts.onstart === 'function') u.onstart = opts.onstart;
  if (typeof opts.onend === 'function') { u.onend = opts.onend; u.onerror = opts.onend; }
  window.speechSynthesis.speak(u);
  return true;
}

/** Stop mid-sentence. Safe to call when nothing is speaking. */
function speechStop() {
  if (!speechSupported()) return;
  try { window.speechSynthesis.cancel(); } catch (e) { /* nothing to cancel */ }
}

function speechIsSpeaking() {
  return speechSupported() && window.speechSynthesis.speaking;
}

/**
 * HTML in, something worth hearing out.
 *
 * Descriptions carry markup, code blocks and list bullets. Read verbatim they
 * become "less than p greater than" or a minute of punctuation, so the tags are
 * stripped, block boundaries become sentence breaks so the voice pauses where
 * the layout does, and inline code is kept but stripped of its backticks.
 */
function _speechPlainText(input) {
  let s = String(input == null ? '' : input);
  if (!s) return '';
  if (/[<&]/.test(s)) {
    // Block ends become full stops first: innerText on a detached node does not
    // reliably insert breaks for elements that were never laid out.
    s = s.replace(/<\/(p|div|li|h[1-6]|pre|tr)>/gi, '. ')
         .replace(/<br\s*\/?>/gi, '. ');
    const box = document.createElement('div');
    box.innerHTML = s;
    s = box.textContent || '';
  }
  s = s
    .replace(/`{1,3}/g, ' ')       // code fences and inline ticks
    .replace(/\s+/g, ' ')
    .replace(/(\.\s*){2,}/g, '. ') // the joins above can stack full stops
    .trim();
  /* An empty description is <p></p>, and the block-end rule above turns that
     into a lone full stop -- which the engine reads aloud as "dot". Nothing to
     say means nothing to say. */
  return /^[\s.]*$/.test(s) ? '' : s;
}

/* ── The voice panel ────────────────────────────────────────────────────────
   Built and torn down on demand rather than sitting in index.html, because its
   contents depend on the machine: the voice list is whatever the operating
   system installed, and it is not known until the engine reports it. */
function openSpeechPanel() {
  closeSpeechPanel();

  if (!speechSupported()) {
    if (typeof toast === 'function') {
      toast('This browser has no speech engine, so reading aloud is unavailable.', { type: 'warning', duration: 5000 });
    }
    return;
  }

  const overlay = document.createElement('div');
  overlay.id = 'speech-panel';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-content" style="max-width:520px;">
      <h2 class="modal-title" style="display:flex;align-items:center;gap:0.5rem;">
        <i data-lucide="mic-vocal"></i> Read Aloud
      </h2>
      <p class="modal-desc">Used by the coding attempt's description and the language library.</p>
      <div id="speech-panel-body" class="speech-body">
        <div class="speech-loading">Looking for voices…</div>
      </div>
      <div style="display:flex;gap:0.5rem;margin-top:1.25rem;">
        <button class="btn btn-secondary" style="flex:1;" onclick="closeSpeechPanel()">Done</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeSpeechPanel(); });
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: overlay });

  speechOnVoices(_speechPaintPanel);
}

function closeSpeechPanel() {
  speechStop();
  const el = document.getElementById('speech-panel');
  if (el) el.remove();
}

function _speechPaintPanel(voices) {
  const body = document.getElementById('speech-panel-body');
  if (!body) return;
  const p = speechPrefs();

  if (!voices.length) {
    body.innerHTML = '<div class="speech-loading">This device reports no installed voices.</div>';
    return;
  }

  /* Grouped by language, because the list is long on a desktop and the useful
     question is "which of my English voices", not "which of my sixty voices". */
  const groups = {};
  voices.forEach((v, i) => { (groups[v.lang] || (groups[v.lang] = [])).push({ v, i }); });
  const options = Object.keys(groups).sort().map(lang => (
    '<optgroup label="' + escapeHTML(lang) + '">'
    + groups[lang].map(({ v }) =>
        '<option value="' + escapeHTML(v.voiceURI) + '"'
        + (v.voiceURI === p.voiceURI ? ' selected' : '') + '>'
        + escapeHTML(v.name) + '</option>').join('')
    + '</optgroup>'
  )).join('');

  body.innerHTML = `
    <label class="speech-row">
      <span class="speech-row-label">Voice</span>
      <select id="speech-voice" class="form-select" onchange="speechSetPref({ voiceURI: this.value })">
        <option value=""${p.voiceURI ? '' : ' selected'}>System default</option>
        ${options}
      </select>
    </label>
    <label class="speech-row">
      <span class="speech-row-label">Pitch <em id="speech-pitch-val">${p.pitch}</em></span>
      <input type="range" id="speech-pitch" min="0" max="2" step="0.1" value="${p.pitch}"
             oninput="document.getElementById('speech-pitch-val').textContent = this.value; speechSetPref({ pitch: parseFloat(this.value) });" />
    </label>
    <label class="speech-row">
      <span class="speech-row-label">Speed <em id="speech-rate-val">${p.rate}</em></span>
      <input type="range" id="speech-rate" min="0.5" max="2" step="0.05" value="${p.rate}"
             oninput="document.getElementById('speech-rate-val').textContent = this.value; speechSetPref({ rate: parseFloat(this.value) });" />
    </label>
    <button class="btn btn-secondary" style="width:100%;margin-top:0.25rem;" onclick="speechPreview()">
      <i data-lucide="play"></i> Hear it
    </button>`;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: body });
}

/** Say a line in the current settings, so the sliders can be judged by ear. */
function speechPreview() {
  speak('Hi! This is how I will read your descriptions and words.');
}
