/* DICTATION.JS — voice typing into a text box (the Brain Note editor).

   Right-click the note's text box: the menu's first item turns voice typing
   on and off (also Ctrl+Shift+Space while the editor has the keyboard). What
   you say goes in at the caret, phrase by phrase, as if typed.

   THE BROWSER'S RECOGNISER, NOT A SERVICE OF OURS. SpeechRecognition (the Web
   Speech API) is free and needs no key: Chrome sends the audio to Google's
   speech service, Edge to Microsoft's (which also punctuates on its own). The
   site itself never calls an AI and holds no secret -- this repo is public
   (see speech.js for the same reasoning on the reading-aloud side). Firefox
   has no recogniser, and Brave's always fails with 'network'; both get a plain
   message instead of a dead switch.

   WHAT MAKES IT ACCURATE, beyond the recogniser itself:
   - continuous with interim results, restarted the moment the browser ends a
     session (Chrome ends one after a pause or about a minute), so it keeps
     listening until you turn it off; a session's unfinished words are kept,
     not dropped, when it ends;
   - the language is yours to pick (a recogniser told the wrong language is
     the commonest cause of bad results);
   - the words are shaped to the text around the caret (dictShape, pure, so
     Node can test it): spacing, a capital after a full stop or at the start,
     "I" on its own, no space before punctuation, and spoken punctuation --
     "comma", "period", "question mark", "new line", "new paragraph" -- in
     English. Code notes get spacing only, never capitals.

   WHERE THE WORDS SHOW. The words still being heard are shown live in the
   bar at the foot of the editor; each phrase goes into the text once the
   recogniser settles it (a fraction of a second after you pause). Putting the
   half-heard words in the text box itself would mean rewriting it many times
   a second, which breaks Ctrl+Z (every rewrite an undo step, or the history
   dropped) and fights the caret when you type at the same time. A settled
   phrase goes in through execCommand('insertText') while the box has the
   keyboard, so it is one undo step, like typing; otherwise (the editor
   floating and you on the canvas) through setRangeText at the caret it had.

   One session at a time, app-wide: starting it on another box stops it here.
   Preferences: ssp.dictation ({ lang, punct }), synced with the account. */

const DICT_PREF_KEY = 'ssp.dictation';

// '' = the browser's own language. Chosen for this user's world first
// (English, Filipino), then the big ones.
const DICT_LANGS = [
  ['', 'Browser language'],
  ['en-US', 'English (US)'],
  ['en-GB', 'English (UK)'],
  ['en-PH', 'English (Philippines)'],
  ['en-AU', 'English (Australia)'],
  ['en-IN', 'English (India)'],
  ['fil-PH', 'Filipino'],
  ['es-ES', 'Español'],
  ['fr-FR', 'Français'],
  ['de-DE', 'Deutsch'],
  ['ja-JP', '日本語'],
  ['ko-KR', '한국어'],
  ['zh-CN', '中文 (普通话)']
];

/** A recogniser exists in this browser (Chrome, Edge, Safari). */
function dictSupported() {
  return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function dictPrefs() {
  let p = {};
  try { p = JSON.parse(localStorage.getItem(DICT_PREF_KEY) || '{}') || {}; } catch (_) { p = {}; }
  return {
    lang: typeof p.lang === 'string' && DICT_LANGS.some(l => l[0] === p.lang) ? p.lang : '',
    punct: p.punct !== false
  };
}

function dictSetPref(patch) {
  const next = Object.assign(dictPrefs(), patch || {});
  try { localStorage.setItem(DICT_PREF_KEY, JSON.stringify(next)); } catch (_) { /* private mode */ }
  return next;
}

/** The BCP 47 tag the recogniser is given. */
function dictLangTag() {
  return dictPrefs().lang || (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
}

/* ── Shaping a phrase to the text around the caret (pure) ─────────── */

// Longest first: "new paragraph" before "new line", "semi colon" before "colon".
const DICT_SPOKEN = [
  [/\bnew paragraph\b/gi, '\n\n'],
  [/\b(?:new line|newline|next line)\b/gi, '\n'],
  [/\bquestion mark\b/gi, '?'],
  [/\bexclamation (?:mark|point)\b/gi, '!'],
  [/\b(?:full stop|period)\b(?! of\b)/gi, '.'],
  [/\bcomma\b/gi, ','],
  [/\b(?:semicolon|semi colon)\b/gi, ';'],
  [/\bcolon\b/gi, ':'],
  [/\bopen (?:paren|parenthesis|bracket)\b/gi, '('],
  [/\bclose (?:paren|parenthesis|bracket)\b/gi, ')']
];

/**
 * The text to put in for one settled phrase, given what is before and after
 * the caret. Returns { text, eat } -- eat is how many characters just before
 * the caret to replace (the spaces in "word ," when the phrase starts with a
 * comma) -- or null when nothing is left to type.
 * opts: { punct: spoken punctuation, caps: sentence capitals, en: English rules }
 */
function dictShape(phrase, before, after, opts) {
  opts = opts || {};
  before = before || '';
  after = after || '';
  let t = String(phrase == null ? '' : phrase).replace(/[ \t ]+/g, ' ').trim();
  if (opts.punct) DICT_SPOKEN.forEach(([re, ch]) => { t = t.replace(re, ch); });
  // Tidy the marks: none of them takes a space before it, "(" takes none after,
  // and a line break takes no spaces either side.
  t = t.replace(/ *\n */g, '\n')
    .replace(/ +([.,?!;:)])/g, '$1')
    .replace(/\( +/g, '(')
    .replace(/ {2,}/g, ' ')
    .replace(/^ +| +$/g, '');
  if (!t) return null;

  if (opts.en) {
    t = t.replace(/(^|[^\w'’])i(?=$|[^\w'’]|['’](?:m|ve|ll|d)\b)/g, '$1I');
  }
  if (opts.caps) {
    const tail = before.replace(/[ \t]+$/, '');
    const startsSentence = !tail || /[.?!]["'’)\]]*$/.test(tail) || /\n$/.test(tail);
    if (startsSentence) t = t.replace(/^(\W*)(\p{Ll})/u, (m, lead, ch) => lead + ch.toUpperCase());
    t = t.replace(/([.?!]["'’)\]]*(?: +|\n+)|\n+)(\p{Ll})/gu, (m, mark, ch) => mark + ch.toUpperCase());
  }

  let eat = 0;
  const startsWithMark = /^[.,?!;:)\n]/.test(t);
  if (startsWithMark) {
    const m = before.match(/[ \t]+$/);
    eat = m ? m[0].length : 0;
  } else if (before && !/[\s(\[{"'“‘/]$/.test(before)) {
    t = ' ' + t;
  }
  if (after && /^[\p{L}\p{N}]/u.test(after) && !/[\s(]$/.test(t)) t += ' ';
  return { text: t, eat };
}

/* ── The session ───────────────────────────────────────────────────── */

// The one live session: { ta, ctx, rec, on, lang, punct, doneIdx, interim,
// startedAt, quick, meter, bar }
let _dict = null;

function dictIsOn(ta) { return !!(_dict && _dict.on && (!ta || _dict.ta === ta)); }

function dictToggle(ta, ctx) {
  if (dictIsOn(ta)) dictStop();
  else dictStart(ta, ctx);
}

function _dictToast(msg, type) {
  if (typeof toast === 'function') toast(msg, { type: type || 'error', duration: 5200 });
}

const _DICT_ERRORS = {
  'not-allowed': 'The microphone is blocked for this site. Allow it from the icon at the left of the address bar, then try again.',
  'service-not-allowed': 'This browser will not run speech recognition here. Voice typing works in Chrome and Edge.',
  'audio-capture': 'No microphone was found. Plug one in or pick it in your system sound settings.',
  'network': 'Voice typing could not reach the speech service. It needs the internet, and works in Chrome or Edge (Brave and Firefox have none).',
  'language-not-supported': 'That language is not available for voice typing in this browser. Pick another from the right-click menu.',
  'bad-grammar': 'Voice typing stopped (the recogniser refused its settings).'
};

/**
 * Start voice typing into `ta`.
 * ctx: { bar: element the listening bar goes into (first child),
 *        isCode: () => true when the box holds code (no capitals) }
 */
function dictStart(ta, ctx) {
  if (!ta) return;
  if (!dictSupported()) {
    _dictToast('This browser has no speech recognition. Voice typing works in Chrome and Edge.');
    return;
  }
  if (_dict) dictKill();
  const R = window.SpeechRecognition || window.webkitSpeechRecognition;
  const prefs = dictPrefs();
  const s = _dict = {
    ta, ctx: ctx || {}, rec: null, on: true,
    lang: dictLangTag(), punct: prefs.punct,
    doneIdx: 0, interim: '', startedAt: 0, quick: 0, fatal: false,
    meter: null, bar: null,
    // Android's Chrome repeats the whole session's words in every result when
    // continuous; there one utterance per session, restarted, is exact.
    mobile: /Android/i.test(navigator.userAgent || '')
  };
  let rec;
  try { rec = new R(); } catch (_) {
    _dict = null;
    _dictToast('Voice typing could not start in this browser.');
    return;
  }
  s.rec = rec;
  rec.lang = s.lang;
  rec.continuous = !s.mobile;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  rec.onstart = () => { if (_dict === s) _dictPaint(s, 'listening'); };
  rec.onaudiostart = () => { if (_dict === s && !s.mobile) _dictMeterStart(s); };
  rec.onresult = e => _dictResult(s, e);
  rec.onerror = e => _dictError(s, e);
  rec.onend = () => _dictEnded(s);
  _dictBarShow(s);
  _dictPaint(s, 'starting');
  _dictBegin(s);
}

function _dictBegin(s) {
  s.doneIdx = 0;
  s.startedAt = Date.now();
  try { s.rec.start(); } catch (err) {
    // InvalidStateError: still running from the last session. Its end restarts it.
    if (!err || err.name !== 'InvalidStateError') { _dictToast('Voice typing could not start: ' + ((err && err.message) || err)); dictKill(); }
  }
}

function _dictResult(s, e) {
  if (_dict !== s) return;
  if (!s.ta.isConnected) { dictKill(); return; }
  let interim = '';
  for (let i = e.resultIndex; i < e.results.length; i++) {
    const r = e.results[i];
    const words = r && r[0] ? r[0].transcript : '';
    if (r.isFinal) {
      if (i >= s.doneIdx) { s.doneIdx = i + 1; _dictCommit(s, words); }
    } else {
      interim += words;
    }
  }
  s.interim = interim;
  _dictPaintInterim(s);
}

function _dictError(s, e) {
  if (_dict !== s) return;
  const code = e && e.error;
  if (code === 'no-speech' || code === 'aborted') return;   // a quiet spell: the end restarts it
  s.fatal = true;
  s.on = false;
  _dictToast(_DICT_ERRORS[code] || ('Voice typing stopped' + (code ? ' (' + code + ')' : '') + '.'));
}

function _dictEnded(s) {
  if (_dict !== s) return;
  // Words still unsettled when a session ends are kept, not lost.
  if (s.interim && s.ta.isConnected) { const w = s.interim; s.interim = ''; _dictCommit(s, w); }
  s.interim = '';
  _dictPaintInterim(s);
  if (!s.on || !s.ta.isConnected) { _dictTeardown(s); return; }
  // Sessions that end as soon as they begin, again and again, are a
  // recogniser that will not work here; stop rather than spin.
  s.quick = Date.now() - s.startedAt < 1500 ? s.quick + 1 : 0;
  if (s.quick >= 5) {
    s.on = false;
    _dictToast('Voice typing keeps stopping by itself. Check the microphone and the internet connection.');
    _dictTeardown(s);
    return;
  }
  _dictPaint(s, 'listening');
  _dictBegin(s);
}

/** Turn voice typing off, keeping the words still being heard. */
function dictStop() {
  const s = _dict;
  if (!s) return;
  s.on = false;
  _dictPaint(s, 'stopping');
  try { s.rec.stop(); } catch (_) { _dictTeardown(s); return; }
  // A recogniser that never says it ended must not hold the mic.
  setTimeout(() => { if (_dict === s) { try { s.rec.abort(); } catch (_) { /* gone */ } _dictTeardown(s); } }, 2500);
}

/** Turn voice typing off at once (the box is going away). */
function dictKill() {
  const s = _dict;
  if (!s) return;
  s.on = false;
  if (s.interim && s.ta.isConnected) { const w = s.interim; s.interim = ''; _dictCommit(s, w); }
  try { s.rec.onend = null; s.rec.onresult = null; s.rec.onerror = null; s.rec.abort(); } catch (_) { /* gone */ }
  _dictTeardown(s);
}

/** For the editor: stop if voice typing is going into this box. */
function dictDetach(ta) { if (_dict && _dict.ta === ta) dictKill(); }

function _dictTeardown(s) {
  _dictMeterStop(s);
  if (s.bar) { s.bar.remove(); s.bar = null; }
  if (_dict === s) _dict = null;
  _dictMenuRefresh();
}

/** Put one settled phrase in at the caret, as typing would. */
function _dictCommit(s, words) {
  const ta = s.ta;
  if (!ta || !ta.isConnected || ta.disabled || ta.readOnly) return;
  const v = ta.value;
  const a = ta.selectionStart, b = ta.selectionEnd;
  const en = /^en\b/i.test(s.lang);
  const isCode = !!(s.ctx.isCode && s.ctx.isCode());
  const shaped = dictShape(words, v.slice(0, a), v.slice(b), { punct: s.punct && en, caps: !isCode, en: en && !isCode });
  if (!shaped) return;
  const from = a - shaped.eat;
  if (document.activeElement === ta && typeof document.execCommand === 'function') {
    ta.setSelectionRange(from, b);
    let ok = false;
    try { ok = document.execCommand('insertText', false, shaped.text); } catch (_) { ok = false; }
    if (ok) return;
    ta.setSelectionRange(a, b);
  }
  ta.setRangeText(shaped.text, from, b, 'end');
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}

/* ── The listening bar ─────────────────────────────────────────────── */

const _DICT_STOP_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor"/></svg>';

function _dictBarShow(s) {
  const host = s.ctx.bar;
  if (!host) return;
  const bar = document.createElement('div');
  bar.className = 'dict-bar';
  bar.setAttribute('role', 'status');
  bar.innerHTML = `<span class="dict-dot" aria-hidden="true"></span>
    <span class="dict-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
    <span class="dict-text"><span class="dict-state">Starting…</span><span class="dict-interim"></span></span>
    <span class="dict-lang"></span>
    <button type="button" class="dict-stop" title="Stop voice typing (Ctrl+Shift+Space)" aria-label="Stop voice typing">${_DICT_STOP_SVG}</button>`;
  // Not a press that takes the caret out of the text box.
  bar.addEventListener('mousedown', ev => ev.preventDefault());
  bar.querySelector('.dict-stop').onclick = () => dictStop();
  host.insertBefore(bar, host.firstChild);
  s.bar = bar;
  const name = (DICT_LANGS.find(l => l[0] === dictPrefs().lang) || [])[1];
  bar.querySelector('.dict-lang').textContent = dictPrefs().lang ? name : s.lang;
}

function _dictPaint(s, mode) {
  if (!s.bar) return;
  s.bar.dataset.mode = mode;
  const words = { starting: 'Starting…', listening: 'Listening…', stopping: 'Finishing…' }[mode] || '';
  s.bar.querySelector('.dict-state').textContent = words;
}

function _dictPaintInterim(s) {
  if (!s.bar) return;
  const el = s.bar.querySelector('.dict-interim');
  const t = (s.interim || '').trim();
  el.textContent = t;
  s.bar.classList.toggle('has-words', !!t);
}

/* The bars move with your voice: a second, quiet look at the microphone
   (the recogniser does not share its levels). If the browser refuses it the
   bars just breathe on their own. Transform only, one write per bar a frame,
   and only while listening. */
function _dictMeterStart(s) {
  if (s.meter || !s.bar || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (s.bar) s.bar.classList.add('no-meter');
    return;
  }
  s.meter = { stream: null, ctx: null, raf: 0, dead: false };
  const m = s.meter;
  navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }).then(stream => {
    if (m.dead || _dict !== s) { stream.getTracks().forEach(t => t.stop()); return; }
    m.stream = stream;
    const AC = window.AudioContext || window.webkitAudioContext;
    m.ctx = new AC();
    const src = m.ctx.createMediaStreamSource(stream);
    const an = m.ctx.createAnalyser();
    an.fftSize = 512;
    an.smoothingTimeConstant = 0.6;
    src.connect(an);
    const buf = new Uint8Array(an.fftSize);
    const bars = Array.from(s.bar ? s.bar.querySelectorAll('.dict-bars i') : []);
    const shape = [0.55, 0.85, 1, 0.8, 0.5];
    let level = 0;
    const tick = () => {
      if (m.dead) return;
      if (_dict !== s || !s.ta.isConnected) { dictKill(); return; }
      an.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) { const x = (buf[i] - 128) / 128; sum += x * x; }
      const rms = Math.sqrt(sum / buf.length);
      const target = Math.min(1, rms * 7);
      level += (target - level) * (target > level ? 0.55 : 0.18);
      const now = performance.now() / 160;
      bars.forEach((b, i) => {
        const wob = 0.8 + 0.2 * Math.sin(now + i * 1.7);
        b.style.transform = 'scaleY(' + (0.22 + 0.78 * level * shape[i] * wob).toFixed(3) + ')';
      });
      m.raf = requestAnimationFrame(tick);
    };
    m.raf = requestAnimationFrame(tick);
  }).catch(() => { if (s.bar) s.bar.classList.add('no-meter'); });
}

function _dictMeterStop(s) {
  const m = s.meter;
  if (!m) return;
  m.dead = true;
  cancelAnimationFrame(m.raf);
  if (m.stream) m.stream.getTracks().forEach(t => t.stop());
  if (m.ctx) { try { m.ctx.close(); } catch (_) { /* closed */ } }
  s.meter = null;
}

/* ── The right-click menu ──────────────────────────────────────────── */

let _dictMenuFor = null;   // { ta, ctx } the open menu acts on

const _DICT_ICONS = {
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>',
  punct: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 7h.01M7 12h.01M17 7l-3 10M11 17h.01"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>',
  cut: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
  paste: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>',
  all: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 3a2 2 0 0 0-2 2M19 3a2 2 0 0 1 2 2M21 19a2 2 0 0 1-2 2M5 21a2 2 0 0 1-2-2M9 3h1M9 21h1M14 3h1M14 21h1M3 9v1M21 9v1M3 14v1M21 14v1"/></svg>'
};

/**
 * Open the text box's menu at the pointer: voice typing, its language and
 * spoken punctuation, then the usual Cut / Copy / Paste / Select all (the
 * browser's own menu is still there on Shift+right-click).
 */
function dictMenu(e, ta, ctx) {
  e.preventDefault();
  e.stopPropagation();
  if (typeof brainHideAllMenus === 'function') brainHideAllMenus();
  let m = document.getElementById('dict-menu');
  if (!m) {
    m = document.createElement('div');
    m.id = 'dict-menu';
    m.className = 'viz-context-menu dict-menu hidden';
    m.setAttribute('role', 'menu');
    m.setAttribute('data-mx-skip', '');
    document.body.appendChild(m);
    // Pressing an item must not take the caret out of the text box (the
    // language list is the exception: it has to take the press to open).
    m.addEventListener('mousedown', ev => { if (!ev.target.closest('select')) ev.preventDefault(); });
    m.addEventListener('click', _dictMenuClick);
    m.addEventListener('change', ev => {
      if (ev.target.id !== 'dict-lang') return;
      dictSetPref({ lang: ev.target.value });
      const f = _dictMenuFor;
      // A new language starts a new session; the words so far are kept.
      if (f && dictIsOn(f.ta)) { dictKill(); dictStart(f.ta, f.ctx); }
      if (f) f.ta.focus({ preventScroll: true });
      _dictMenuRefresh();
    });
  }
  _dictMenuFor = { ta, ctx: ctx || {} };
  _dictMenuFill(m);
  if (typeof vizPositionMenu === 'function') vizPositionMenu(m, e.clientX, e.clientY);
  else { m.style.left = e.clientX + 'px'; m.style.top = e.clientY + 'px'; m.classList.remove('hidden'); }
  document.addEventListener('pointerdown', _dictMenuOutside, true);
  document.addEventListener('keydown', _dictMenuKey, true);
  window.addEventListener('resize', _dictMenuClose);
}

function _dictMenuFill(m) {
  const f = _dictMenuFor;
  if (!f) return;
  const ta = f.ta;
  const on = dictIsOn(ta);
  const ok = dictSupported();
  const p = dictPrefs();
  const en = /^en\b/i.test(dictLangTag());
  const hasSel = ta.selectionStart !== ta.selectionEnd;
  const item = (act, icon, label, extra, attrs) =>
    `<button type="button" class="viz-ctx-item${extra ? ' ' + extra : ''}" data-act="${act}" ${attrs || 'role="menuitem"'}>${_DICT_ICONS[icon]}<span>${label}</span></button>`;
  m.innerHTML = `
    <button type="button" class="viz-ctx-item dict-voice${on ? ' is-on' : ''}" data-act="voice" role="menuitemcheckbox" aria-checked="${on}"${ok ? '' : ' aria-disabled="true"'}>
      ${_DICT_ICONS.mic}<span>Voice typing</span><kbd>Ctrl+Shift+Space</kbd><span class="dict-switch" aria-hidden="true"></span>
    </button>
    ${ok ? '' : '<div class="dict-note">This browser has no speech recognition. Use Chrome or Edge.</div>'}
    <label class="dict-row" title="The language you will speak">
      ${_DICT_ICONS.globe}<span>Language</span>
      <select id="dict-lang" aria-label="Voice typing language">
        ${DICT_LANGS.map(([k, n]) => `<option value="${k}"${k === p.lang ? ' selected' : ''}>${n}</option>`).join('')}
      </select>
    </label>
    <button type="button" class="viz-ctx-item${en ? '' : ' is-off'}" data-act="punct" role="menuitemcheckbox" aria-checked="${p.punct}" title="${en ? 'Say “comma”, “period”, “question mark”, “new line”, “new paragraph”' : 'Spoken punctuation is for English'}">
      ${_DICT_ICONS.punct}<span>Spoken punctuation</span><span class="dict-switch" aria-hidden="true"></span>
    </button>
    <div class="viz-ctx-divider"></div>
    ${item('cut', 'cut', 'Cut', hasSel ? '' : 'is-off', 'role="menuitem"' + (hasSel ? '' : ' aria-disabled="true"'))}
    ${item('copy', 'copy', 'Copy', hasSel ? '' : 'is-off', 'role="menuitem"' + (hasSel ? '' : ' aria-disabled="true"'))}
    ${item('paste', 'paste', 'Paste')}
    ${item('all', 'all', 'Select all')}`;
}

function _dictMenuRefresh() {
  const m = document.getElementById('dict-menu');
  if (m && !m.classList.contains('hidden')) _dictMenuFill(m);
}

function _dictMenuClose() {
  const m = document.getElementById('dict-menu');
  if (m) m.classList.add('hidden');
  document.removeEventListener('pointerdown', _dictMenuOutside, true);
  document.removeEventListener('keydown', _dictMenuKey, true);
  window.removeEventListener('resize', _dictMenuClose);
}

function _dictMenuOutside(ev) {
  if (ev.target.closest && ev.target.closest('#dict-menu')) return;
  _dictMenuClose();
}

function _dictMenuKey(ev) {
  if (ev.key !== 'Escape') return;
  ev.preventDefault();
  ev.stopPropagation();
  _dictMenuClose();
}

function _dictMenuClick(ev) {
  const b = ev.target.closest('button[data-act]');
  const f = _dictMenuFor;
  if (!b || !f) return;
  const ta = f.ta;
  const act = b.dataset.act;
  if (b.getAttribute('aria-disabled') === 'true') return;
  if (act === 'punct') {
    const p = dictSetPref({ punct: !dictPrefs().punct });
    if (_dict && _dict.ta === ta) _dict.punct = p.punct;
    _dictMenuRefresh();
    return;
  }
  _dictMenuClose();
  ta.focus({ preventScroll: true });
  if (act === 'voice') { dictToggle(ta, f.ctx); return; }
  if (act === 'cut' || act === 'copy') {
    let done = false;
    try { done = document.execCommand(act); } catch (_) { done = false; }
    if (!done) _dictToast('Press Ctrl+' + (act === 'cut' ? 'X' : 'C') + ' to ' + act + '.', 'info');
    return;
  }
  if (act === 'all') { ta.select(); return; }
  if (act === 'paste') {
    const fail = () => _dictToast('Press Ctrl+V to paste (the browser did not allow reading the clipboard).', 'info');
    if (!navigator.clipboard || !navigator.clipboard.readText) { fail(); return; }
    navigator.clipboard.readText().then(text => {
      if (!text || !ta.isConnected) return;
      ta.focus({ preventScroll: true });
      let ok = false;
      try { ok = document.execCommand('insertText', false, text); } catch (_) { ok = false; }
      if (!ok) { ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input', { bubbles: true })); }
    }).catch(fail);
  }
}

/** Ctrl+Shift+Space (Cmd+Shift+Space on a Mac) toggles voice typing. */
function dictIsShortcut(e) {
  return (e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && (e.code === 'Space' || e.key === ' ');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { dictShape, DICT_SPOKEN, DICT_LANGS };
}
