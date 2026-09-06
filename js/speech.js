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

  /* A voice that already has these vowels beats the chosen one for a language
     it cannot read. Nobody has a Cebuano voice, but a Filipino, Spanish or
     Italian one reads the spelling almost correctly, and that is a far bigger
     improvement than anything done to the text. The chosen voice still wins
     for everything else, including English. */
  let voice = null;
  if (opts.langCode && prefs.matchVoice !== false) voice = speechVoiceForLang(opts.langCode);
  if (!voice) voice = _speechPickVoice(prefs);

  /* Only if we ended up somewhere that cannot read it: respell so the voice we
     do have produces the right sounds. */
  const said = opts.langCode ? speechShapeFor(clean, opts.langCode, voice) : clean;

  const u = new SpeechSynthesisUtterance(said);
  /* Assigning a voice the engine no longer recognises throws, and an exception
     here means nothing is said at all -- the whole feature goes silent because
     one voice went stale. Losing the voice is survivable; losing the speech is
     not, so it falls back to the engine default. */
  if (voice) {
    try { u.voice = voice; u.lang = opts.lang || voice.lang; }
    catch (e) { if (opts.lang) u.lang = opts.lang; }
  } else if (opts.lang) { u.lang = opts.lang; }
  // The spec's ranges: pitch 0–2, rate 0.1–10. Clamped because a stored value
  // outside them makes the whole utterance fail silently rather than clip.
  u.pitch = Math.min(2, Math.max(0, Number(prefs.pitch) || 1));
  u.rate = Math.min(4, Math.max(0.1, Number(prefs.rate) || 1));
  /* Not `|| 1`: a volume of 0 is a real setting -- silence -- and would be
     thrown away by a falsy check. NaN from a missing or corrupt value is the
     case that needs the fallback, and it is the only one. */
  const vol = Number(prefs.volume);
  u.volume = Math.min(1, Math.max(0, isFinite(vol) ? vol : 1));
  if (typeof opts.onstart === 'function') u.onstart = opts.onstart;
  /* Not every engine fires this -- Safari historically does not -- so anything
     that reads along has to work when it never arrives. */
  if (typeof opts.onboundary === 'function') u.onboundary = opts.onboundary;
  if (typeof opts.onend === 'function') { u.onend = opts.onend; u.onerror = opts.onend; }
  window.speechSynthesis.speak(u);
  return true;
}

/**
 * Stop mid-sentence. Safe to call when nothing is speaking.
 *
 * Takes the read-along markup down with it, so every route that stops speech
 * on the way out also hands its text back intact -- leaving mid-read would
 * otherwise strand a description as a pile of per-letter spans.
 */
function speechStop() {
  if (typeof speechReadAlongStop === 'function') speechReadAlongStop();
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
    /* DOMParser, NOT a detached div. Assigning HTML to an element runs its
       handlers even when it is not in the document -- measured: an
       <img onerror> fires on the assignment alone. Descriptions can arrive
       from someone else through a share link, so "just to read the text out"
       would have been enough to run their code. parseFromString builds an
       inert document: no handlers, no requests, same text back. */
    const doc = new DOMParser().parseFromString(s, 'text/html');
    /* Code is spoken as code, not as prose. Which text that is does not have to
       be guessed — the markup already says so. */
    doc.body.querySelectorAll('code, kbd, samp, pre').forEach((el) => {
      const said = speechSayCode(el.textContent);
      el.parentNode.replaceChild(doc.createTextNode(' ' + said + ' '), el);
    });
    s = doc.body.textContent || '';
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


/* ── Reading code out loud ──────────────────────────────────────────────────
   A speech engine reads prose. Handed code it does two things wrong, and both
   are fatal to a walkthrough whose whole subject is the code.

   IT DROPS THE PUNCTUATION. Punctuation is prosody to a TTS engine — a comma is
   a pause, a full stop is a longer one, and everything else is silence. So
   `if (x == 5)` is spoken "if x 5", `*p` is "p", `&score` is "score", and
   `a[i]` is "a i". The operators ARE the lesson; losing them leaves sentences
   that sound complete and say nothing.

   AND IT MISREADS THE NAMES. `printf` is a word to the engine and it will try
   to pronounce it as one. `char`, `argv`, `strlen`, `%d`, `\n` — none of these
   survive being treated as English.

   So a code fragment is tokenised and spoken deliberately: `*` is "star" where
   it makes a pointer and "times" where it multiplies, `&` is "ampersand",
   `->` is "arrow", `%d` is "percent D", `\n` is "backslash N". Brackets and
   quotes are dropped, because that is what a person reading code aloud does —
   `printf("%d\n", n)` is read "print F, percent D backslash N, N".

   The narration marks its code with <code>, so which text needs this is not a
   guess: it is already in the markup. */

/** Names an English voice cannot be trusted with. */
const SPEECH_CODE_SAY = {
  printf: 'print F', scanf: 'scan F', sprintf: 'S print F', snprintf: 'S N print F',
  fprintf: 'F print F', fscanf: 'F scan F', fgets: 'F gets', fputs: 'F puts',
  fopen: 'F open', fclose: 'F close', fread: 'F read', fwrite: 'F write',
  feof: 'F E O F', fseek: 'F seek', ftell: 'F tell', getchar: 'get char',
  putchar: 'put char', puts: 'puts', gets: 'gets', getline: 'get line',
  strlen: 'string length', strcpy: 'string copy', strncpy: 'string N copy',
  strcmp: 'string compare', strncmp: 'string N compare', strcat: 'string cat',
  strncat: 'string N cat', strchr: 'string char', strstr: 'string string',
  strtok: 'string toke', memset: 'mem set', memcpy: 'mem copy',
  malloc: 'malloc', calloc: 'C alloc', realloc: 'ree alloc', free: 'free',
  sizeof: 'size of', typedef: 'type def',
  atoi: 'A to I', atof: 'A to F', abs: 'abs', srand: 'S rand', qsort: 'Q sort',
  isalpha: 'is alpha', isdigit: 'is digit', isspace: 'is space',
  toupper: 'to upper', tolower: 'to lower',
  stdin: 'standard in', stdout: 'standard out', stderr: 'standard error',
  argc: 'arg C', argv: 'arg V',
  NULL: 'null', EOF: 'E O F', FILE: 'file',
  int: 'int', char: 'char', float: 'float', double: 'double', void: 'void',
  unsigned: 'unsigned', signed: 'signed', short: 'short', long: 'long'
};

/** Headers, which are read as names rather than spelled out. */
const SPEECH_CODE_HEADERS = {
  stdio: 'standard I O dot H', stdlib: 'standard lib dot H',
  string: 'string dot H', math: 'math dot H', ctype: 'C type dot H',
  stdbool: 'standard bool dot H', time: 'time dot H', limits: 'limits dot H'
};

/** Words that make the `*` after them a pointer rather than a multiplication. */
const SPEECH_CODE_TYPES = ['int', 'char', 'float', 'double', 'void', 'long', 'short',
  'unsigned', 'signed', 'struct', 'union', 'enum', 'const', 'static', 'FILE', 'size_t'];

const SPEECH_ESCAPE_SAY = {
  n: 'backslash N', t: 'backslash T', r: 'backslash R', 0: 'backslash zero',
  '\\': 'backslash backslash', '"': 'quote', "'": 'quote'
};

const SPEECH_ENTITIES = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' '
};

/** Fragments usually arrive already decoded; this is for callers passing raw HTML. */
function _speechDecodeEntities(s) {
  return String(s).replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39);/g, m => SPEECH_ENTITIES[m] || m);
}

/** "%5.2f" → "percent 5 point 2 F". */
function _speechSaySpec(spec) {
  const rest = spec.slice(1);
  if (rest === '%') return 'percent percent';
  /* The letters are spelled out BEFORE the dot becomes the word "point" —
     the other order spells "point" itself, and %5.2f came out "percent
     P O I N T 2 F". */
  return ('percent ' + rest
    .replace(/[A-Za-z]+/g, m => ' ' + m.toUpperCase().split('').join(' ') + ' ')
    .replace(/\./g, ' point '))
    .replace(/\s+/g, ' ').trim();
}

/** The inside of a string or char literal: escapes and conversions spoken, text kept. */
function _speechSayLiteral(body) {
  let out = '', plain = '';
  const flush = () => { if (plain.trim()) out += ' ' + plain.trim(); plain = ''; };
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '\\') {
      flush();
      const nx = body[i + 1] || '';
      out += ' ' + (SPEECH_ESCAPE_SAY[nx] || ('backslash ' + nx.toUpperCase()));
      i++;
      continue;
    }
    if (c === '%') {
      // m[0], not m[1]: _speechSaySpec expects the leading % and slices it off,
      // so handing it the group alone ate the conversion letter — "%d" inside a
      // string came out as "percent".
      const m = /^%(?:%|[-+ #0]*\*?\d*(?:\.\d+)?(?:hh|h|ll|l|L|z|j|t)?[diouxXeEfFgGaAcspn])/.exec(body.slice(i));
      if (m) { flush(); out += ' ' + _speechSaySpec(m[0]); i += m[0].length - 1; continue; }
    }
    plain += c;
  }
  flush();
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * A code fragment, spoken the way a person reads code aloud.
 * @param {string} code  e.g. `printf("%d\n", n)`
 * @returns {string} e.g. "print F , percent D backslash N , N"
 */
function speechSayCode(code) {
  const s = _speechDecodeEntities(String(code == null ? '' : code))
    // A construct whose name contains a hyphen, which is otherwise a minus.
    .replace(/\bdo-while\b/g, 'do while');
  if (!s.trim()) return '';

  const out = [];
  const push = (w) => { if (w) out.push(w); };
  let i = 0;
  let value = false;   // the previous token was something a value can come from
  let typed = false;   // ...and it was a type name, which makes a following * a pointer

  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }

    // ── literals ──
    if (c === '"' || c === "'") {
      let j = i + 1, body = '';
      while (j < s.length && s[j] !== c) {
        if (s[j] === '\\') { body += s[j] + (s[j + 1] || ''); j += 2; }
        else { body += s[j]; j++; }
      }
      i = j + 1;
      push(_speechSayLiteral(body));
      value = true; typed = false;
      continue;
    }

    // ── a bare escape, which is how the narration writes \n on its own ──
    if (c === '\\') {
      const nx = s[i + 1] || '';
      push(SPEECH_ESCAPE_SAY[nx] || 'backslash');
      i += SPEECH_ESCAPE_SAY[nx] ? 2 : 1;
      value = true; typed = false;
      continue;
    }

    // ── #include, and the <header.h> after it ──
    if (c === '#') {
      const m = /^#\s*([A-Za-z]+)/.exec(s.slice(i));
      if (m) { push(m[1]); i += m[0].length; value = false; typed = false; continue; }
      push('hash'); i++; continue;
    }
    if (c === '<') {
      const h = /^<\s*([A-Za-z_]\w*)\.h\s*>/.exec(s.slice(i));
      if (h) {
        push(SPEECH_CODE_HEADERS[h[1]] || (h[1] + ' dot H'));
        i += h[0].length; value = true; typed = false; continue;
      }
      if (s[i + 1] === '=') { push('less than or equal to'); i += 2; value = false; continue; }
      if (s[i + 1] === '<') { push('shifted left by'); i += 2; value = false; continue; }
      push('less than'); i++; value = false; continue;
    }

    // ── numbers ──
    if (/[0-9]/.test(c)) {
      const m = /^\d+(?:\.\d+)?/.exec(s.slice(i));
      push(m[0]); i += m[0].length; value = true; typed = false;
      continue;
    }

    // ── names ──
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_]\w*/.exec(s.slice(i));
      const word = m[0];
      i += word.length;
      // stdio.h and friends, when they arrive without the angle brackets.
      if (SPEECH_CODE_HEADERS[word] && s.slice(i, i + 2) === '.h') {
        push(SPEECH_CODE_HEADERS[word]); i += 2; value = true; typed = false; continue;
      }
      if (SPEECH_CODE_SAY[word]) push(SPEECH_CODE_SAY[word]);
      // A lone letter is a variable name, and read as prose "a" becomes the
      // article and "i" the pronoun. Spelled as a capital it stays a letter.
      else if (word.length === 1) push(word.toUpperCase());
      else push(word.replace(/_/g, ' '));
      value = true;
      typed = SPEECH_CODE_TYPES.indexOf(word) !== -1;
      continue;
    }

    // ── operators, longest first ──
    const two = s.slice(i, i + 2);
    const TWO = {
      '->': 'arrow', '==': 'double equals', '!=': 'not equals', '>=': 'greater than or equal to',
      '++': 'plus plus', '--': 'minus minus', '+=': 'plus equals', '-=': 'minus equals',
      '*=': 'times equals', '/=': 'divide equals', '%=': 'modulo equals',
      '&&': 'and', '||': 'or', '>>': 'shifted right by'
    };
    if (TWO[two]) { push(TWO[two]); i += 2; value = (two === '++' || two === '--'); typed = false; continue; }

    if (c === '*') {
      /* The one genuinely ambiguous character in C. Spaces on both sides and a
         value in front means multiplication — `n * sizeof(int)`. Anything else
         is a pointer: `int *n`, `*p`, `FILE *`. */
      const spaced = /\s/.test(s[i - 1] || '') && /\s/.test(s[i + 1] || '');
      push(spaced && value && !typed ? 'times' : 'star');
      i++; value = false; typed = false; continue;
    }
    if (c === '&') {
      push(value && /\s/.test(s[i - 1] || '') && /\s/.test(s[i + 1] || '') ? 'bitwise and' : 'ampersand');
      i++; value = false; typed = false; continue;
    }
    if (c === '%') {
      if (s[i + 1] === '%') { push('percent percent'); i += 2; value = true; continue; }
      const m = /^%[-+ #0]*\*?\d*(?:\.\d+)?(?:hh|h|ll|l|L|z|j|t)?[diouxXeEfFgGaAcspn]/.exec(s.slice(i));
      if (m) { push(_speechSaySpec(m[0])); i += m[0].length; value = true; typed = false; continue; }
      /* `%` on its own is the percent SIGN the printf lesson is about; `% 10`
         with an operand after it is the modulo OPERATOR. Both are written as a
         bare fragment in the narration, and the space is what separates them. */
      push(value || /^%\s+\S/.test(s.slice(i)) ? 'modulo' : 'percent sign');
      i++; value = false; continue;
    }

    const ONE = {
      '=': 'equals', '+': 'plus', '-': 'minus', '/': 'divided by', '!': 'not',
      '>': 'greater than', '.': 'dot', ';': ';', ',': ',', ':': 'colon',
      '?': 'question mark', '{': 'open brace', '}': 'close brace',
      '[': 'index', '|': 'bitwise or', '^': 'caret', '~': 'tilde'
    };
    // `int a[]` — empty brackets say "this is an array", not "index nothing".
    if (c === '[' && s[i + 1] === ']') { push('array'); i += 2; value = true; continue; }
    // Brackets are dropped, the way they are when a person reads code aloud.
    if (c === '(' || c === ')' || c === ']') { i++; value = (c !== '('); typed = false; continue; }
    if (ONE[c] !== undefined) { push(ONE[c]); i++; value = false; typed = false; continue; }
    i++;   // anything else has no sound worth making
  }

  return out.join(' ')
    .replace(/\s+([,;])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
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
      <p class="modal-desc">Used by the walkthroughs, the coding attempt's description and the language library.</p>
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
    <label class="speech-row">
      <span class="speech-row-label">Volume <em id="speech-vol-val">${Math.round(p.volume * 100)}%</em></span>
      <input type="range" id="speech-vol" min="0" max="100" step="5" value="${Math.round(p.volume * 100)}"
             oninput="document.getElementById('speech-vol-val').textContent = this.value + '%'; speechSetPref({ volume: parseInt(this.value, 10) / 100 });" />
    </label>
    <label class="speech-row speech-row-check">
      <input type="checkbox" id="speech-match" ${p.matchVoice === false ? '' : 'checked'}
             onchange="speechSetPref({ matchVoice: this.checked })" />
      <span><strong>Match the voice to the language</strong>
        <em>Bisaya, Waray and Filipino borrow a Filipino, Spanish or Italian voice if you have one &mdash;
        they share the same five vowels. Without one, the spelling is adjusted instead.</em></span>
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

/* ── Reading along ──────────────────────────────────────────────────────────
   speechSynthesis reports where it has got to through `boundary` events, which
   carry a charIndex into the text being spoken. That is the only real timing
   signal there is: it fires per WORD, and there is nothing per letter.

   So words are driven by the engine and letters are interpolated inside them.
   A word lights when its boundary arrives; its letters sweep across the gap
   until the next one, using a duration estimated from the word's length and the
   speaking rate. If the next boundary lands early the sweep is cut short, so
   the engine always wins the argument and the letters never run ahead of it.

   THE SPOKEN STRING IS BUILT FROM THE SPANS, not cleaned separately. charIndex
   is an offset into whatever was handed to the utterance, so the only way for
   it to point at the right word is for the text and the markup to come from one
   pass over the same nodes. */

let _readAlongHost = null;
let _readAlongHTML = '';
let _readAlongWords = [];
let _readAlongAt = -1;

/** Undo the markup and put the element back exactly as it was. */
function speechReadAlongStop() {
  /* Only ever restores something. This writes over the element it marked up,
     so an empty snapshot would erase the text rather than hand it back -- and
     a half-initialised state is exactly when this gets called by mistake. */
  if (_readAlongHost) {
    if (_readAlongHTML) _readAlongHost.innerHTML = _readAlongHTML;
    _readAlongHost.classList.remove('rp-reading');
  }
  _readAlongHost = null;
  _readAlongHTML = '';
  _readAlongWords = [];
  _readAlongAt = -1;
}

/* Whitespace is significant inside <pre>, and inline-block letters would change
   it, so those subtrees are spoken but never marked up. */
function _rpSkip(node) {
  for (let el = node.parentElement; el; el = el.parentElement) {
    if (el.tagName === 'PRE') return true;
    if (el === _readAlongHost) return false;
  }
  return false;
}

/**
 * Wrap every word in `host` and return the exact string those words spell.
 * Each entry records where its word starts in that string, so a charIndex can
 * be resolved back to the span that produced it.
 */
function _rpMarkUp(host) {
  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT, null);
  const texts = [];
  let n;
  while ((n = walker.nextNode())) texts.push(n);

  const words = [];
  let spoken = '';
  let lastBlock = null;

  /* Letters cost a span each, and past a certain length that stops being worth
     it: measured at 1200 words the split produced 8,490 spans and took 14ms,
     which is a visible hitch before the voice even starts. Long text keeps the
     word-level highlight -- which is the part the engine actually drives -- and
     drops the sweep inside each word. Short text, which is nearly everything,
     is unaffected. */
  const bulk = texts.reduce((n, t) => n + (t.nodeValue || '').length, 0);
  const perLetter = bulk <= 2600;

  /* A <code> span is one unit, not a row of words: it is spoken through
     speechSayCode — so what is said ("star P") and what is written ("*p") are
     different lengths and different counts, and only the span as a whole can
     be lit. Its own text nodes are skipped once it has been taken. */
  const codeTaken = new Set();

  texts.forEach((node) => {
    const raw = node.nodeValue;
    if (!raw || !raw.trim()) return;

    /* A sentence break where the layout has one: crossing into a new block
       should sound like a full stop, the way the eye reads it as a new line. */
    const block = node.parentElement && node.parentElement.closest('p,li,div,h1,h2,h3,h4,h5,h6,pre,td');
    if (lastBlock && block !== lastBlock && !/[.!?]\s*$/.test(spoken)) spoken += '. ';
    lastBlock = block;

    const codeEl = node.parentElement && node.parentElement.closest('code, kbd, samp');
    if (codeEl && host.contains(codeEl)) {
      if (codeTaken.has(codeEl)) return;
      codeTaken.add(codeEl);
      const said = speechSayCode(codeEl.textContent);
      if (!said) return;
      if (spoken && !/\s$/.test(spoken)) spoken += ' ';
      codeEl.classList.add('rp-w', 'rp-w-plain');
      words.push({ el: codeEl, at: spoken.length, len: said.length });
      spoken += said + ' ';
      return;
    }

    if (_rpSkip(node)) { spoken += raw.replace(/\s+/g, ' '); return; }

    const frag = document.createDocumentFragment();
    raw.split(/(\s+)/).forEach((tok) => {
      if (!tok) return;
      if (!tok.trim()) { frag.appendChild(document.createTextNode(tok)); spoken += ' '; return; }
      const w = document.createElement('span');
      w.className = 'rp-w';
      // Letters get their own spans so the sweep has something to move across.
      if (perLetter) {
        for (let i = 0; i < tok.length; i++) {
          const c = document.createElement('span');
          c.className = 'rp-c';
          c.style.setProperty('--rp-i', String(i));
          c.textContent = tok[i];
          w.appendChild(c);
        }
      } else {
        w.classList.add('rp-w-plain');
        w.textContent = tok;
      }
      words.push({ el: w, at: spoken.length, len: tok.length });
      spoken += tok;
      frag.appendChild(w);
    });
    node.parentNode.replaceChild(frag, node);
  });

  return { words, text: spoken.replace(/\s+/g, ' ').trim() ? spoken : '' };
}

/** The word a charIndex falls in: the last one that starts at or before it. */
function _rpWordAt(charIndex) {
  let lo = 0, hi = _readAlongWords.length - 1, hit = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (_readAlongWords[mid].at <= charIndex) { hit = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  return hit;
}

function _rpLight(idx, rate) {
  if (idx < 0 || idx === _readAlongAt) return;
  const prev = _readAlongWords[_readAlongAt];
  if (prev) { prev.el.classList.remove('is-now'); prev.el.classList.add('is-said'); }
  _readAlongAt = idx;
  const w = _readAlongWords[idx];
  if (!w) return;
  /* ~62ms per character at rate 1 is close to conversational pace; the sweep
     only has to look right, and the next boundary corrects it either way. */
  const per = 62 / Math.max(0.1, rate || 1);
  w.el.style.setProperty('--rp-step', per.toFixed(1) + 'ms');
  w.el.style.setProperty('--rp-dur', Math.max(180, per * 2.2).toFixed(0) + 'ms');
  w.el.classList.add('is-now');
}

/**
 * Read an element's text aloud and light it up as the voice moves through it.
 *
 * @param {Element} host
 * @param {{lang?: string, onend?: Function}} [opts]
 * @returns {boolean} false when there was nothing to read
 */
function speakElementAlong(host, opts) {
  opts = opts || {};
  if (!host || !speechSupported()) return false;
  speechReadAlongStop();

  const originalHTML = host.innerHTML;
  const built = _rpMarkUp(host);
  if (!built.text.trim() || !built.words.length) { host.innerHTML = originalHTML; return false; }

  _readAlongHost = host;
  _readAlongHTML = originalHTML;
  _readAlongWords = built.words;
  _readAlongAt = -1;
  host.classList.add('rp-reading');

  const prefs = speechPrefs();
  const done = () => { speechReadAlongStop(); if (typeof opts.onend === 'function') opts.onend(); };

  const said = speak(built.text, {
    lang: opts.lang,
    onend: done,
    onboundary: (e) => {
      if (e && e.name === 'sentence') return;   // words only; sentences double up
      _rpLight(_rpWordAt(e.charIndex), prefs.rate);
    }
  });
  if (!said) { speechReadAlongStop(); return false; }
  return true;
}

/* ── Making Bisaya sound like Bisaya ────────────────────────────────────────
   No platform ships a Cebuano or Waray voice, so asking for ceb-PH gets you
   whatever voice you had, reading Cebuano spelling with that language's rules.
   An English voice turns "maayong buntag" into something unrecognisable,
   because English vowels are diphthongs and Cebuano's are pure.

   Two answers, in order of how well they work.

   FIRST, BORROW A VOICE THAT ALREADY HAS THE RIGHT VOWELS. Cebuano, Waray and
   Filipino share a five-vowel system with Spanish and Italian, and a Tagalog
   voice is near enough to be the real thing. So the search runs down a chain of
   languages that read this orthography correctly rather than stopping at the
   one nobody has.

   SECOND, IF ONLY ENGLISH IS INSTALLED, CHANGE THE SPELLING. An English voice
   cannot be told to use different vowels, but it can be handed spelling that
   produces them: "salamat" read as "sah-lah-maht" comes out close. Syllable
   breaks are kept as hyphens because engines pause very slightly at them, which
   is what stops a word running together into one blur. */

const SPEECH_VOWELS = 'aeiou';

/* Ordered by how closely the language's own reading rules match Cebuano's. */
const SPEECH_VOICE_CHAIN = {
  ceb: ['ceb', 'fil', 'tl', 'es', 'it'],
  war: ['war', 'ceb', 'fil', 'tl', 'es', 'it'],
  fil: ['fil', 'tl', 'ceb', 'es', 'it'],
  en:  ['en']
};

/** Languages whose reading rules suit this orthography without respelling. */
const SPEECH_FRIENDLY = ['ceb', 'war', 'fil', 'tl', 'es', 'it'];

function _speechLangIs(tag, prefix) {
  return String(tag || '').toLowerCase().indexOf(prefix) === 0;
}

/**
 * The best installed voice for one of the app's languages.
 * @returns {SpeechSynthesisVoice|null} null when nothing in the chain exists
 */
function speechVoiceForLang(code) {
  const chain = SPEECH_VOICE_CHAIN[code];
  if (!chain || !_speechVoices.length) return null;
  for (let i = 0; i < chain.length; i++) {
    const hit = _speechVoices.find(v => _speechLangIs(v.lang, chain[i]));
    if (hit) return hit;
  }
  return null;
}

/**
 * Split a Cebuano/Waray/Filipino word into syllables.
 *
 * The rule these languages actually follow: every syllable is one vowel, with
 * at most one consonant in front and at most one behind. So between two vowels,
 * a single consonant belongs to the SECOND syllable (ba-lay, not bal-ay), two
 * consonants split one each (bun-tag), and none at all means the vowels are
 * separate syllables (ma-a-yong).
 *
 * "ng" is one consonant, not two -- treating it as two puts a break inside it
 * and turns "ngano" into "n-gano". The hyphen that marks a glottal stop in
 * spellings like "kanus-a" is already a syllable break, so it is kept as one.
 *
 * @returns {string[]}
 */
function speechSyllables(word) {
  const w = String(word || '').toLowerCase();
  if (!w) return [];

  // Units, so "ng" travels as a single consonant.
  const units = [];
  for (let i = 0; i < w.length; i++) {
    if (w[i] === 'n' && w[i + 1] === 'g') { units.push('ng'); i++; }
    else units.push(w[i]);
  }
  const isV = (u) => u.length === 1 && SPEECH_VOWELS.indexOf(u) > -1;
  const vowelAt = units.map(isV);
  if (!vowelAt.some(Boolean)) return [w];

  const out = [];
  let cur = '';
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (u === '-') { if (cur) { out.push(cur); cur = ''; } continue; }
    cur += u;
    if (!isV(u)) continue;

    // How many consonants until the next vowel decides where the break goes.
    let j = i + 1, cons = 0, dash = false;
    while (j < units.length && !vowelAt[j]) {
      if (units[j] === '-') { dash = true; break; }
      cons++; j++;
    }

    if (!dash && j >= units.length) {
      /* No vowel left, so everything after this one is the coda and the word
         ends here. Breaking out without taking it dropped the final consonant
         of every word that has one -- salamat came back as sa-la-ma. */
      cur += units.slice(i + 1).join('');
      break;
    }
    if (dash) {
      /* A written glottal stop is already a syllable break, and the
         consonants before it close the syllable: kanus-a is ka-nus-a. */
      cur += units.slice(i + 1, i + 1 + cons).join('');
      out.push(cur);
      cur = '';
      i += cons;
      continue;
    }
    if (cons >= 2) { cur += units[i + 1]; i += 1; }   // one consonant closes this syllable
    out.push(cur);
    cur = '';
  }
  if (cur) out.push(cur);
  return out.filter(Boolean);
}

/* Pure vowels, spelled the way an English voice reads them.

   ONE PASS, NOT A LIST OF PASSES. Running these in sequence re-processes what
   the earlier ones produced: ay -> ai, and then the a and the i rules turn
   that into "ahee", so balay came out bah-lahee. A single alternation consumes
   each letter once, and the diphthongs are listed first so they win over their
   own first vowel.

   ay is "ie" rather than "ai" because Cebuano /aj/ is the vowel in English
   "lie", not the one in "lay" -- balay is bah-LIE. */
const SPEECH_RESPELL_RE = /ay$|aw$|oy$|iw$|[aeiou]/g;
const SPEECH_RESPELL_MAP = {
  ay: 'ie', aw: 'ow', oy: 'oy', iw: 'ew',
  a: 'ah', e: 'eh', i: 'ee', o: 'oh', u: 'oo'
};

/**
 * Rewrite one word so an English voice reads it with Cebuano vowels.
 * Only ever a last resort — a voice that already has these vowels is better.
 */
function speechRespell(word) {
  return speechSyllables(word)
    .map(syl => syl.replace(SPEECH_RESPELL_RE, m => SPEECH_RESPELL_MAP[m] || m))
    .join('-');
}

/**
 * Prepare a phrase for whichever voice is going to read it.
 * Left alone when the voice's own language already reads this orthography.
 */
function speechShapeFor(text, code, voice) {
  const say = String(text == null ? '' : text);
  if (!say.trim() || !code || code === 'en') return say;
  const friendly = voice && SPEECH_FRIENDLY.some(p => _speechLangIs(voice.lang, p));
  if (friendly) return say;
  // Punctuation and spacing are kept; only the words are respelled.
  return say.replace(/[A-Za-z\u00C0-\u024F-]+/g, (w) => speechRespell(w));
}
