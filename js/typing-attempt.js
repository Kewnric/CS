/* ============================================================
   TYPING-ATTEMPT.JS — the Memorization Typing test screen
   ------------------------------------------------------------
   A typing test over your own entries: the whole text in ghost at low
   opacity, you type over it as fast and as accurately as you can, and the
   result screen shows speed, accuracy and how both moved second by second.

   Prose wraps and keeps three lines on screen, dropping a line as you reach
   the third, the way a typing test does. Code is shown as code — indentation,
   highlighting, line breaks — in a taller window that follows the caret, and
   adds auto indent and auto close (see typing-engine.js).

   Modes, on the bar above the text:
     time    type the entry over and over until the clock runs out
     words   (lines, for code) the first N words of it
     full    the whole entry once; or a random one of a length
     zen     a blank page: type it from memory, compared when you finish
     custom  any text you paste in

   The panels — settings, command line, the entry picker, custom text — and
   the sounds, themes and result chart live in typing-panels.js.
   ============================================================ */

let _mt = null;

function typingAttemptTemplate() {
  return `
    <div class="mt-shell" id="mt-shell">
      <header class="mt-nav">
        <button class="mt-icon" type="button" onclick="mtLeave()" title="Back to the library" aria-label="Back to the library">
          <i data-lucide="chevron-left"></i>
        </button>
        <button class="mt-brand" type="button" onclick="mtRestart()" title="New test">
          <span class="mt-brand-mark"><i data-lucide="keyboard"></i></span>
          <span class="mt-brand-text"><small>memorization</small><strong>typing</strong></span>
        </button>
        <nav class="mt-nav-icons">
          <button class="mt-icon" type="button" onclick="mtRestart()" title="New test" aria-label="New test"><i data-lucide="keyboard"></i></button>
          <button class="mt-icon" type="button" onclick="mtOpenPicker()" title="Pick an entry" aria-label="Pick an entry"><i data-lucide="library-big"></i></button>
          <button class="mt-icon" type="button" onclick="mtOpenCommandLine()" title="Command line (esc)" aria-label="Command line"><i data-lucide="terminal"></i></button>
          <button class="mt-icon" type="button" onclick="mtOpenSettings()" title="Settings" aria-label="Settings"><i data-lucide="settings"></i></button>
        </nav>
        <div class="mt-nav-right">
          <button class="mt-icon" type="button" onclick="spaNavigate('admin-typing')" title="Write entries in Admin" aria-label="Write entries in Admin"><i data-lucide="pencil-line"></i></button>
        </div>
      </header>

      <div class="mt-config" id="mt-config"></div>

      <main class="mt-stage" id="mt-stage">
        <section class="mt-test" id="mt-test">
          <div class="mt-capslock" id="mt-capslock"><i data-lucide="arrow-big-up"></i> Caps Lock</div>
          <button class="mt-source" id="mt-source" type="button" onclick="mtOpenPicker()"></button>
          <button class="mt-source-note" id="mt-source-note" type="button" onclick="mtEditAsCode()" hidden></button>
          <div class="mt-live" id="mt-live"></div>
          <div class="mt-peekhint" aria-live="polite"><i data-lucide="mouse"></i> scrolled away from the caret · type to jump back</div>
          <div class="mt-wrap" id="mt-wrap" onclick="mtFocus()">
            <div class="mt-words" id="mt-words">
              <div class="mt-letters" id="mt-letters"></div>
              <div class="mt-caret" id="mt-caret"></div>
              <div class="mt-caret mt-pace" id="mt-pace"></div>
            </div>
            <div class="mt-blurmsg"><i data-lucide="mouse-pointer-click"></i> Click here or press any key to focus</div>
          </div>
          <textarea id="mt-input" class="mt-input" autocomplete="off" autocorrect="off" autocapitalize="off"
                    spellcheck="false" aria-label="Type here" tabindex="0"></textarea>
          <div class="mt-under">
            <button class="mt-restart" id="mt-restart" type="button" onclick="mtRestart()" title="Restart test" aria-label="Restart test">
              <i data-lucide="rotate-cw"></i>
            </button>
          </div>
        </section>
        <section class="mt-result" id="mt-result" hidden></section>
        <section class="mt-empty" id="mt-empty" hidden></section>
      </main>

      <footer class="mt-foot" id="mt-foot"></footer>
      <div class="mt-bar" id="mt-bar"><div class="mt-bar-fill" id="mt-bar-fill"></div></div>
    </div>`;
}

function typingAttemptInit() {
  mtStore();
  const cfg = mtConfig();
  _mt = {
    cfg, view: 'test', eng: null, zen: null, v: null, source: null, temp: null,
    samples: [], afk: 0, tick: null, pace: null, memT: null, memHidden: false,
    overlay: null, lastResult: null, shiftX: 0, shiftY: 0, lineH: 0,
    loopChunk: null, ttsWord: -1, blurT: null, replay: null
  };
  // Arriving from a library Run: that entry, whole, unless a mode says otherwise.
  const want = getSessionParam('mtItem');
  if (want) {
    setSessionParam('mtItem', null);
    if (mtFindItem(want)) {
      mtSetConfig({ lastItem: want, quoteLength: 'this' });
      // custom text is not an entry; every other mode works on the one picked
      if (cfg.mode === 'custom') mtSetConfig({ mode: 'quote' });
    }
  }
  const startMode = getSessionParam('mtMode');
  if (startMode) { setSessionParam('mtMode', null); mtSetConfig({ mode: startMode }); }

  const input = document.getElementById('mt-input');
  if (input) {
    input.addEventListener('keydown', mtOnInputKey);
    input.addEventListener('input', mtOnInputText);
    input.addEventListener('focus', mtOnFocus);
    input.addEventListener('blur', mtOnBlur);
  }
  document.addEventListener('keydown', mtOnDocKey, true);
  document.addEventListener('mousemove', mtOnMouseMove);
  const wrap = document.getElementById('mt-wrap');
  // not passive: the wheel moves the text instead of the page while there is text to move
  if (wrap) wrap.addEventListener('wheel', mtOnWheel, { passive: false });
  window.addEventListener('resize', mtOnResize);
  mtApplyLook();
  mtRestart();
  // the library's "Custom text" card opens straight onto the box
  if (startMode === 'custom') mtOpenCustom();
}

function typingAttemptDestroy() {
  mtStopTimers();
  mtStopReplay();
  document.removeEventListener('keydown', mtOnDocKey, true);
  document.removeEventListener('mousemove', mtOnMouseMove);
  window.removeEventListener('resize', mtOnResize);
  if (typeof speechStop === 'function') speechStop();
  mtCloseOverlay();
  _mt = null;
}

function mtLeave() {
  mtStopTimers();
  spaNavigate('typing');
}

function mtStopTimers() {
  if (!_mt) return;
  if (_mt.tick) { clearTimeout(_mt.tick); _mt.tick = null; }
  if (_mt.pace) { clearInterval(_mt.pace); _mt.pace = null; }
  if (_mt.memT) { clearTimeout(_mt.memT); _mt.memT = null; }
  if (_mt.blurT) { clearTimeout(_mt.blurT); _mt.blurT = null; }
}

/* ── The source: which text this test is made of ───────────── */

/** The entry or text a fresh test should use. `keep` holds the current one. */
function mtResolveSource(keep) {
  const cfg = mtConfig();
  if (_mt.temp) return _mt.temp;
  if (cfg.mode === 'custom') {
    return { title: 'custom', kind: cfg.customKind === 'code' ? 'code' : 'text', lang: cfg.customLang || 'c',
             content: cfg.customText || '', itemId: null, custom: true };
  }
  const items = mtItems().filter(it => mtCleanContent(it.content, it.kind).trim());
  if (!items.length) return null;
  let item = null;
  if (cfg.mode === 'quote' && cfg.quoteLength !== 'this' && !keep) {
    const pool = items.filter(it => cfg.quoteLength === 'all' || mtLengthGroup(it) === cfg.quoteLength);
    if (pool.length) {
      // a different one from last time, when there is a choice
      const others = pool.filter(it => !_mt.source || it.id !== _mt.source.itemId);
      const from = others.length ? others : pool;
      item = from[Math.floor(Math.random() * from.length)];
    }
  }
  if (!item && keep && _mt.source && _mt.source.itemId) item = mtFindItem(_mt.source.itemId);
  if (!item) item = mtFindItem(cfg.lastItem);
  if (!item) item = items[0];
  if (item.id !== cfg.lastItem) mtSetConfig({ lastItem: item.id });
  return { title: item.title || 'Untitled', kind: item.kind, lang: item.lang, content: item.content, itemId: item.id, custom: false };
}

const MT_PUNCT_RE = /[^\p{L}\p{N}\s]/gu;

/** The text after the mode's and the funbox's changes, before slicing. */
function mtPrepare(src) {
  const cfg = mtConfig();
  let s = mtCleanContent(src.content, src.kind);
  if (src.kind !== 'text') return s;
  if (src.custom && cfg.customNewlines === 'space') s = s.replace(/\n/g, ' ');
  if ((cfg.mode === 'time' || cfg.mode === 'words' || cfg.mode === 'custom') && !cfg.punctuation) {
    s = s.toLowerCase().replace(/[-‐\/]/g, ' ').replace(MT_PUNCT_RE, '');
  }
  if ((cfg.mode === 'time' || cfg.mode === 'words' || cfg.mode === 'custom') && !cfg.numbers) {
    s = s.replace(/\d/g, '');
  }
  s = s.split('\n').map(l => l.replace(/ {2,}/g, ' ').trim()).filter(Boolean).join('\n');
  const fb = cfg.funbox;
  if (src.custom && cfg.customShuffle) {
    const words = s.split(/\s+/).filter(Boolean);
    for (let i = words.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [words[i], words[j]] = [words[j], words[i]]; }
    s = words.join(' ');
  }
  if (fb.indexOf('backwards') !== -1) s = s.split('\n').map(l => l.split(' ').map(w => [...w].reverse().join('')).join(' ')).join('\n');
  if (fb.indexOf('all_caps') !== -1) s = s.toUpperCase();
  if (fb.indexOf('random_case') !== -1) s = [...s].map(c => Math.random() < 0.5 ? c.toUpperCase() : c.toLowerCase()).join('');
  return s;
}

/** The first n words, repeating the text if it is shorter. */
function _mtFirstWords(s, n) {
  const out = [];
  const lines = s.split('\n').map(l => l.split(' ').filter(Boolean));
  let count = 0, guard = 0;
  while (count < n && guard++ < 1000) {
    for (const line of lines) {
      if (count >= n) break;
      const take = line.slice(0, n - count);
      out.push(take.join(' '));
      count += take.length;
    }
  }
  return out.filter(Boolean).join('\n');
}

/** The first n non-blank lines of code, repeating it if it is shorter. */
function _mtFirstLines(s, n) {
  const lines = s.split('\n');
  const out = [];
  let count = 0, guard = 0;
  while (count < n && guard++ < 1000) {
    for (const line of lines) {
      if (count >= n) break;
      out.push(line);
      if (line.trim()) count++;
    }
  }
  return out.join('\n').replace(/\n+$/, '');
}

/* ── Starting a test ───────────────────────────────────────── */

/**
 * A new test.
 *   mtRestart()        a new test: "full" with a length draws a fresh entry
 *   mtRestart('keep')  the same entry, prepared again for the current mode
 *   mtRestart(true)    exactly the same test again (same shuffle, same case)
 */
function mtRestart(how) {
  const repeat = how === true;
  const keep = how === true || how === 'keep';
  if (!_mt) return;
  mtStopTimers();
  mtStopReplay();
  const cfg = mtConfig();
  _mt.view = 'test';
  _mt.samples = [];
  _mt.afk = 0;
  _mt.memHidden = false;
  _mt.shiftX = 0; _mt.shiftY = 0;
  _mt.peek = null;
  _mt.ttsWord = -1;
  const shell = document.getElementById('mt-shell');
  if (!shell) return;
  shell.classList.remove('mt-peeking');
  // the last test's scroll position must not carry into this one
  const wordsEl = document.getElementById('mt-words');
  if (wordsEl) { wordsEl.style.transition = 'none'; wordsEl.style.transform = ''; }
  shell.classList.remove('mt-running', 'mt-typing', 'mt-done', 'mt-memory-hidden', 'mt-failed');

  const prevSource = _mt.source;
  const prevMode = _mt.preparedMode;
  const src = (keep && prevSource && (prevSource.temp || (prevSource.custom === (cfg.mode === 'custom'))))
    ? (prevSource.custom ? mtResolveSource(true) : prevSource)
    : mtResolveSource(false);
  _mt.source = src;

  document.getElementById('mt-result').hidden = true;
  const empty = document.getElementById('mt-empty');
  const test = document.getElementById('mt-test');
  mtRenderConfig();
  mtRenderFoot();

  if (!src || !mtCleanContent(src.content, src.kind).trim()) {
    test.hidden = true;
    empty.hidden = false;
    empty.innerHTML = mtEmptyHTML(src);
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: empty });
    return;
  }
  empty.hidden = true;
  test.hidden = false;

  const prepared = (repeat && _mt.lastPrepared && prevSource === src && prevMode === cfg.mode) ? _mt.lastPrepared : mtPrepare(src);
  _mt.lastPrepared = prepared;
  _mt.preparedMode = cfg.mode;

  const settings = {
    autoIndent: cfg.autoIndent, autoClose: cfg.autoClose, stopOnError: cfg.stopOnError,
    freedom: cfg.freedomMode, confidence: cfg.confidenceMode, strictSpace: cfg.strictSpace,
    lazy: cfg.lazyMode, difficulty: cfg.difficulty
  };

  if (cfg.mode === 'zen') {
    _mt.eng = null;
    _mt.zen = { ref: prepared, kind: src.kind, lang: src.lang, typed: '', started: false, t0: 0,
                keysOk: 0, keysBad: 0, secKeys: [], secErr: [], log: [], finished: false };
  } else {
    _mt.zen = null;
    let target = prepared;
    _mt.loopChunk = null;
    if (cfg.mode === 'words') {
      target = src.kind === 'code' ? _mtFirstLines(prepared, cfg.lines) : _mtFirstWords(prepared, cfg.words);
    } else if (cfg.mode === 'time') {
      // looped until the clock runs out; more is added as you near the end
      _mt.loopChunk = prepared;
      const sep = src.kind === 'code' ? '\n' : ' ';
      while (target.length < 1200) target += sep + prepared;
    }
    const tk = src.kind === 'code' ? mtTokenize(target, src.lang) : { cls: null, pairs: new Map() };
    _mt.eng = mtEngineCreate({ target, kind: src.kind, lang: src.lang, cls: tk.cls, pairs: tk.pairs, settings });
  }

  mtRenderSource();
  mtApplyLook();
  _mt.v = mtViewCreate(document.getElementById('mt-letters'), _mt.eng, { live: true });
  if (_mt.zen) mtZenRender();
  else mtViewRender(_mt.v);
  mtMeasure();
  mtAfterChange(true);
  mtRenderLive();
  mtPaintBar(0);

  // memory: shown for a moment, then gone
  if (cfg.funbox.indexOf('memory') !== -1 && _mt.eng) {
    const words = _mt.eng.target.split(/\s+/).length;
    const secs = Math.max(3, Math.min(20, Math.round(words * 0.4)));
    _mt.memLeft = secs;
    const step = () => {
      if (!_mt || _mt.memHidden) return;
      _mt.memLeft--;
      mtRenderLive();
      if (_mt.memLeft <= 0) mtMemoryHide();
      else _mt.memT = setTimeout(step, 1000);
    };
    _mt.memT = setTimeout(step, 1000);
  }

  mtFocus();
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: shell });
}

function mtMemoryHide() {
  if (!_mt || _mt.memHidden) return;
  _mt.memHidden = true;
  const shell = document.getElementById('mt-shell');
  if (shell) shell.classList.add('mt-memory-hidden');
  mtRenderLive();
}

function mtEmptyHTML(src) {
  const custom = mtConfig().mode === 'custom';
  return `
    <div class="mt-empty-card">
      <i data-lucide="${custom ? 'clipboard-paste' : 'library-big'}"></i>
      <h2>${custom ? 'No custom text yet' : 'Your library is empty'}</h2>
      <p>${custom
        ? 'Paste some text or code to type.'
        : 'Write an entry in Admin — a paragraph, a snippet or a whole program — and it shows up here to practise.'}</p>
      <div class="mt-empty-actions">
        <button class="mt-btn is-main" type="button" onclick="spaNavigate('admin-typing')"><i data-lucide="plus"></i> Add an entry</button>
        <button class="mt-btn" type="button" onclick="mtOpenCustom()"><i data-lucide="wrench"></i> Custom text</button>
      </div>
    </div>`;
}

/* ── The bar of modes above the text ───────────────────────── */

function _mtCfgBtn(label, icon, active, onclick, title) {
  return `<button class="mt-cbtn${active ? ' is-on' : ''}" type="button" onclick="${onclick}"${title ? ` title="${escapeHTML(title)}"` : ''}>${icon ? `<i data-lucide="${icon}"></i>` : ''}${label}</button>`;
}

function mtRenderConfig() {
  const host = document.getElementById('mt-config');
  if (!host || !_mt) return;
  const cfg = mtConfig();
  const src = _mt.source;
  const code = src ? src.kind === 'code' : cfg.customKind === 'code';
  const groups = [];

  if (code) {
    groups.push(
      _mtCfgBtn('auto indent', 'indent-increase', cfg.autoIndent, "mtToggle('autoIndent')", 'After Enter, the next line indents itself') +
      _mtCfgBtn('auto close', 'brackets', cfg.autoClose, "mtToggle('autoClose')", 'Typing an opening bracket, quote or tag fills in its closer'));
  } else if (cfg.mode === 'time' || cfg.mode === 'words' || cfg.mode === 'custom') {
    groups.push(
      _mtCfgBtn('punctuation', 'at-sign', cfg.punctuation, "mtToggle('punctuation')", 'Off: no punctuation, all lower case') +
      _mtCfgBtn('numbers', 'hash', cfg.numbers, "mtToggle('numbers')", 'Off: digits removed'));
  }

  groups.push(
    _mtCfgBtn('time', 'clock', cfg.mode === 'time', "mtSetMode('time')", 'Type it again and again until the clock runs out') +
    _mtCfgBtn(code ? 'lines' : 'words', code ? 'list-ordered' : 'a-large-small', cfg.mode === 'words', "mtSetMode('words')", code ? 'The first few lines' : 'The first few words') +
    _mtCfgBtn('full', 'quote', cfg.mode === 'quote', "mtSetMode('quote')", 'The whole entry, once') +
    _mtCfgBtn('zen', 'mountain', cfg.mode === 'zen', "mtSetMode('zen')", 'A blank page — type it from memory') +
    _mtCfgBtn('custom', 'wrench', cfg.mode === 'custom', "mtSetMode('custom')", 'Your own text'));

  let sub = '';
  if (cfg.mode === 'time') {
    sub = [15, 30, 60, 120].map(t => _mtCfgBtn(String(t), '', cfg.time === t, `mtSetValue('time', ${t})`)).join('') +
      _mtCfgBtn('', 'wrench', [15, 30, 60, 120].indexOf(cfg.time) === -1, "mtAskNumber('time')", 'Custom time (seconds)');
  } else if (cfg.mode === 'words') {
    const key = code ? 'lines' : 'words';
    const opts = code ? [5, 10, 25, 50] : [10, 25, 50, 100];
    sub = opts.map(n => _mtCfgBtn(String(n), '', cfg[key] === n, `mtSetValue('${key}', ${n})`)).join('') +
      _mtCfgBtn('', 'wrench', opts.indexOf(cfg[key]) === -1, `mtAskNumber('${key}')`, 'Custom amount');
  } else if (cfg.mode === 'quote') {
    sub = _mtCfgBtn('this', 'pin', cfg.quoteLength === 'this', "mtSetValue('quoteLength', 'this')", 'The entry you picked') +
      _mtCfgBtn('all', '', cfg.quoteLength === 'all', "mtSetValue('quoteLength', 'all')", 'A random entry') +
      MT_LENGTHS.map(g => _mtCfgBtn(g.name, '', cfg.quoteLength === g.key, `mtSetValue('quoteLength', '${g.key}')`, 'A random ' + g.name + ' entry')).join('') +
      _mtCfgBtn('', 'search', false, 'mtOpenPicker()', 'Search your entries');
  } else if (cfg.mode === 'zen') {
    sub = `<span class="mt-chint">shift + enter to finish</span>`;
  } else if (cfg.mode === 'custom') {
    sub = _mtCfgBtn('change', 'pencil', false, 'mtOpenCustom()', 'Change the custom text');
  }
  if (sub) groups.push(sub);

  host.innerHTML = groups.map(g => `<div class="mt-cgroup">${g}</div>`).join('<span class="mt-csep"></span>');
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: host });
}

function mtToggle(key) {
  mtSetConfig({ [key]: !mtConfig()[key] });
  mtRestart('keep');
}

function mtSetMode(mode) {
  const cfg = mtConfig();
  if (mode === 'custom' && cfg.mode === 'custom') { mtOpenCustom(); return; }
  _mt.temp = null;
  const from = cfg.mode;
  mtSetConfig({ mode });
  // the entry stays when only the way of typing it changes
  const stay = mode !== 'custom' && from !== 'custom' && !(mode === 'quote' && cfg.quoteLength !== 'this');
  mtRestart(stay ? 'keep' : undefined);
}

function mtSetValue(key, value) {
  mtSetConfig({ [key]: value });
  _mt.temp = null;
  mtRestart(key === 'quoteLength' ? undefined : 'keep');
}

function mtAskNumber(key) {
  const label = key === 'time' ? 'Seconds' : key === 'lines' ? 'Lines' : 'Words';
  const cur = mtConfig()[key];
  const apply = (v) => {
    const n = Math.max(1, Math.min(key === 'time' ? 3600 : 1000, parseInt(v, 10) || 0));
    if (n) mtSetValue(key, n);
  };
  const input = document.getElementById('mt-input');
  if (input) input.blur();
  if (typeof showInputDialog === 'function') {
    showInputDialog('Custom ' + label.toLowerCase(), label + ' for this mode', label, String(cur), (v) => { apply(v); setTimeout(mtFocus, 0); });
  } else {
    const v = window.prompt(label, String(cur));
    if (v !== null) apply(v);
  }
}

function mtRenderSource() {
  const el = document.getElementById('mt-source');
  if (!el || !_mt.source) return;
  const s = _mt.source;
  const lang = s.kind === 'code' ? mtLangMeta(s.lang).name : 'text';
  el.innerHTML = `<i data-lucide="${s.kind === 'code' ? mtLangMeta(s.lang).icon : 'globe'}"></i>
    <span class="mt-source-title">${escapeHTML(s.temp ? s.title : (s.custom ? 'custom' : s.title))}</span>
    <span class="mt-source-lang">${escapeHTML(lang)}</span>`;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: el });

  /* Code saved as Text types as prose: no colours, no indentation, three
     lines at a time. Easy to do by accident and hard to notice, so the test
     says so and offers the fix. */
  const note = document.getElementById('mt-source-note');
  if (!note) return;
  const guess = s.kind === 'text' && s.itemId && !s.temp ? mtGuessLang(s.content) : null;
  note.hidden = !guess;
  if (guess) {
    note.dataset.lang = guess;
    note.innerHTML = `<i data-lucide="code-2"></i> saved as text, but this looks like ${escapeHTML(mtLangMeta(guess).name)} code — click to make it a ${escapeHTML(mtLangMeta(guess).name)} entry`;
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: note });
  }
}

/** Make the entry a code entry on the spot, and start it again as code. */
function mtEditAsCode() {
  const note = document.getElementById('mt-source-note');
  if (!_mt || !_mt.source || !_mt.source.itemId) return;
  const it = mtConvertToCode(_mt.source.itemId, note ? note.dataset.lang : 'c');
  if (!it) return;
  if (typeof toast === 'function') toast(`"${it.title || 'Untitled'}" is now a ${mtLangMeta(it.lang).name} code entry.`, { type: 'success' });
  _mt.temp = null;
  mtSetConfig({ lastItem: it.id });
  mtRestart();
}

function mtRenderFoot() {
  const el = document.getElementById('mt-foot');
  if (!el) return;
  const cfg = mtConfig();
  const th = mtTheme();
  const tips = cfg.keyTips ? `
    <div class="mt-tips">
      <div><kbd>tab</kbd> + <kbd>enter</kbd> — restart test</div>
      <div><kbd>esc</kbd> or <kbd>ctrl</kbd> + <kbd>shift</kbd> + <kbd>p</kbd> — command line</div>
      ${cfg.mode === 'zen' ? '<div><kbd>shift</kbd> + <kbd>enter</kbd> — finish</div>' : ''}
    </div>` : '<div class="mt-tips"></div>';
  el.innerHTML = `
    ${tips}
    <div class="mt-foot-row">
      <span class="mt-foot-left">
        <button class="mt-link" type="button" onclick="mtLeave()"><i data-lucide="library-big"></i> library</button>
        <button class="mt-link" type="button" onclick="spaNavigate('admin-typing')"><i data-lucide="pencil-line"></i> admin</button>
        <button class="mt-link" type="button" onclick="mtOpenSettings()"><i data-lucide="settings"></i> settings</button>
      </span>
      <span class="mt-foot-right">
        <button class="mt-link" type="button" onclick="mtOpenCommandLine('theme')"><i data-lucide="palette"></i> ${escapeHTML(th.name)}</button>
        <button class="mt-link" type="button" onclick="mtOpenCommandLine('fontFamily')"><i data-lucide="type"></i> ${escapeHTML(mtFont().name)}</button>
      </span>
    </div>`;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: el });
}

/* ── Drawing the letters ───────────────────────────────────── */

function mtViewCreate(host, eng, opts) {
  return { host, eng, spans: [], slots: new Map(), opts: opts || {} };
}

function _mtEsc(c) {
  return c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;' : c === '"' ? '&quot;' : c;
}

const MT_STATUS_CLASS = ['', ' c-ok', ' c-bad', ' c-auto', ' c-pend', ' c-miss'];

function mtCharClass(eng, i) {
  const c = eng.target[i];
  let k = 'mt-c' + MT_STATUS_CLASS[eng.st[i]];
  if (c === ' ') k += ' sp';
  else if (c === '\n') k += ' nl';
  else if (eng.cls && eng.cls[i]) k += ' tk-' + eng.cls[i];
  return k;
}

function mtGlyph(eng, i) {
  const c = eng.target[i];
  if (c === '\n') return '↵';
  if (eng.st[i] === MT_BAD && mtConfig().indicateTypos === 'replace') {
    const t = eng.typed.get(i);
    if (t) return t === ' ' ? '·' : t;
  }
  return c;
}

function mtViewRender(v) {
  const eng = v.eng;
  if (!v.host || !eng) return;
  const T = eng.target;
  let html = '';
  let inWord = false;
  for (let i = 0; i < T.length; i++) {
    const ch = T[i];
    const ws = ch === ' ' || ch === '\n';
    if (!ws && !inWord) { html += '<span class="mt-w">'; inWord = true; }
    if (ws && inWord) { html += '</span>'; inWord = false; }
    const typedAttr = (eng.st[i] === MT_BAD && eng.typed.get(i)) ? ` data-t="${_mtEsc(eng.typed.get(i))}"` : '';
    html += `<span class="${mtCharClass(eng, i)}"${typedAttr}>${_mtEsc(mtGlyph(eng, i))}</span>`;
    if (ch === '\n') html += '<br class="mt-br">';
  }
  if (inWord) html += '</span>';
  v.host.innerHTML = html;
  v.spans = Array.from(v.host.querySelectorAll('.mt-c'));
  v.slots = new Map();
  eng.extras.forEach((_, k) => mtViewExtras(v, k));
  eng.dirty.clear();
  eng.dirtyExtras.clear();
}

/** Spans for characters appended in time mode. */
function mtViewAppend(v, from) {
  const eng = v.eng;
  const T = eng.target;
  let html = '';
  let inWord = false;
  for (let i = from; i < T.length; i++) {
    const ch = T[i];
    const ws = ch === ' ' || ch === '\n';
    if (!ws && !inWord) { html += '<span class="mt-w">'; inWord = true; }
    if (ws && inWord) { html += '</span>'; inWord = false; }
    html += `<span class="${mtCharClass(eng, i)}">${_mtEsc(mtGlyph(eng, i))}</span>`;
    if (ch === '\n') html += '<br class="mt-br">';
  }
  if (inWord) html += '</span>';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const add = Array.from(tmp.querySelectorAll('.mt-c'));
  while (tmp.firstChild) v.host.appendChild(tmp.firstChild);
  v.spans = v.spans.concat(add);
}

/** The letters typed past a word's end, drawn just after it. */
function mtViewExtras(v, k) {
  const eng = v.eng;
  const ex = eng.extras.get(k) || '';
  let slot = v.slots.get(k);
  if (!slot && !ex) return;
  if (!slot) {
    const prev = v.spans[k - 1];
    if (!prev) return;
    slot = document.createElement('span');
    slot.className = 'mt-xs';
    prev.parentNode.insertBefore(slot, prev.nextSibling);
    v.slots.set(k, slot);
  }
  slot.innerHTML = [...ex].map(c => `<span class="mt-x">${_mtEsc(c === ' ' ? '·' : c)}</span>`).join('');
}

function mtViewPaint(v) {
  const eng = v.eng;
  if (!eng) return;
  const replace = mtConfig().indicateTypos;
  eng.dirty.forEach(i => {
    const sp = v.spans[i];
    if (!sp) return;
    sp.className = mtCharClass(eng, i);
    const g = mtGlyph(eng, i);
    if (sp.textContent !== g) sp.textContent = g;
    const t = eng.st[i] === MT_BAD ? eng.typed.get(i) : null;
    if (t && replace === 'below') sp.dataset.t = t;
    else if (sp.dataset.t) delete sp.dataset.t;
  });
  eng.dirty.clear();
  eng.dirtyExtras.forEach(k => mtViewExtras(v, k));
  eng.dirtyExtras.clear();
}

/** Where the caret goes: in front of the next letter, or after the last extra. */
function mtViewCaretBox(v) {
  const eng = v.eng;
  const n = eng.target.length;
  let el = null, after = false;
  if ((eng.extras.get(eng.caret) || '').length) {
    const slot = v.slots.get(eng.caret);
    if (slot && slot.lastChild) { el = slot.lastChild; after = true; }
  }
  if (!el) {
    if (eng.caret < n) el = v.spans[eng.caret];
    else { el = v.spans[n - 1]; after = true; }
  }
  if (!el) return null;
  return { x: el.offsetLeft + (after ? el.offsetWidth : 0), y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
}

/* ── Measuring and scrolling ───────────────────────────────── */

function mtMeasure() {
  const letters = document.getElementById('mt-letters');
  const wrap = document.getElementById('mt-wrap');
  if (!letters || !wrap) return;
  const cs = getComputedStyle(letters);
  _mt.lineH = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5;
  const cfg = mtConfig();
  const code = _mt.source && _mt.source.kind === 'code';
  const tape = !code && cfg.tapeMode !== 'off';
  let h = '';
  if (tape) h = (_mt.lineH * 1.05) + 'px';
  else if (code) {
    // short code gets a window its own size; long code a fixed one that scrolls
    const lines = _mt.eng ? _mt.eng.target.split('\n').length : (_mt.zen ? Math.max(3, _mt.zen.ref.split('\n').length) : 3);
    const n = cfg.codeLines === 0 ? 0 : Math.min(cfg.codeLines, Math.max(lines, 3));
    h = n ? (n * _mt.lineH + 2) + 'px' : '';
  }
  else if (cfg.textLines) {
    // prose shorter than the window gets a window its own size
    const lines = Math.max(1, Math.round(letters.offsetHeight / _mt.lineH));
    h = (Math.min(cfg.textLines, lines) * _mt.lineH) + 'px';
  }
  wrap.style.height = h;
}

/* ── Looking back (and ahead) with the mouse wheel ─────────── */

/**
 * The text window follows the caret by itself, so it is not a scroll box —
 * but the wheel can still move it, to reread what you typed or look at what
 * is coming. The caret stays where it is; the next key snaps the view back.
 */
function mtOnWheel(e) {
  if (!_mt || _mt.view !== 'test') return;
  const words = document.getElementById('mt-words');
  const wrap = document.getElementById('mt-wrap');
  if (!words || !wrap) return;
  const cfg = mtConfig();
  const code = _mt.source && _mt.source.kind === 'code';
  const tape = !code && cfg.tapeMode !== 'off';
  const maxY = Math.max(0, words.scrollHeight - wrap.clientHeight);
  const maxX = Math.max(0, words.scrollWidth - wrap.clientWidth);
  if (!maxY && !maxX) return;                    // nothing hidden: the page can have the wheel
  const unit = e.deltaMode === 1 ? _mt.lineH : e.deltaMode === 2 ? wrap.clientHeight : 1;
  let dx = e.deltaX * unit, dy = e.deltaY * unit;
  if (e.shiftKey && !dx) { dx = dy; dy = 0; }   // shift + wheel goes sideways
  if (tape) { dx = dx || dy; dy = 0; }           // one line of tape only goes sideways
  const cur = _mt.peek || { x: _mt.shiftX, y: _mt.shiftY };
  const next = {
    x: Math.max(0, Math.min(maxX, cur.x + dx)),
    y: Math.max(0, Math.min(maxY, cur.y + dy))
  };
  if (next.x === cur.x && next.y === cur.y) return;   // at the end already: let the page scroll
  e.preventDefault();
  _mt.peek = next;
  words.style.transition = 'transform 0.1s ease-out';
  words.style.transform = `translate(${-next.x}px, ${-next.y}px)`;
  const shell = document.getElementById('mt-shell');
  if (shell) {
    shell.classList.add('mt-peeking');
    shell.classList.remove('mt-typing');
  }
}

/** Back to wherever the caret is. */
function mtEndPeek() {
  if (!_mt || !_mt.peek) return;
  _mt.peek = null;
  const shell = document.getElementById('mt-shell');
  if (shell) shell.classList.remove('mt-peeking');
  const words = document.getElementById('mt-words');
  if (!words) return;
  words.style.transition = 'transform 0.16s ease-out';
  words.style.transform = `translate(${-_mt.shiftX}px, ${-_mt.shiftY}px)`;
}

function mtScrollToCaret(box, instant) {
  const words = document.getElementById('mt-words');
  const wrap = document.getElementById('mt-wrap');
  if (!words || !wrap || !box) return;
  const cfg = mtConfig();
  const code = _mt.source && _mt.source.kind === 'code';
  const tape = !code && cfg.tapeMode !== 'off';
  const H = wrap.clientHeight, W = wrap.clientWidth;
  let sx = _mt.shiftX, sy = _mt.shiftY;
  if (tape) {
    sy = 0;
    const atWordStart = !_mt.eng || _mt.eng.caret === mtWordStart(_mt.eng, _mt.eng.caret);
    if (cfg.tapeMode === 'letter' || atWordStart) sx = Math.max(0, box.x - W * 0.4);
  } else if (code) {
    const contentH = words.scrollHeight;
    if (cfg.codeLines !== 0) {
      const want = box.y - H * 0.35;
      sy = Math.max(0, Math.min(want, Math.max(0, contentH - H)));
      sy = Math.round(sy / _mt.lineH) * _mt.lineH;
    } else sy = 0;
    if (box.x - sx > W - 48) sx = box.x - W * 0.6;
    else if (box.x - sx < 24) sx = Math.max(0, box.x - W * 0.3);
  } else if (cfg.textLines) {
    // the caret rides on the line above the middle (the second of three), and
    // the window stops at the end of the text rather than showing blank lines
    const line = Math.round(box.y / _mt.lineH);
    const keep = Math.floor((cfg.textLines - 1) / 2);
    const last = Math.max(0, Math.round(words.scrollHeight / _mt.lineH) - cfg.textLines);
    sy = Math.min(Math.max(0, line - keep), last) * _mt.lineH;
    sx = 0;
  } else { sy = 0; sx = 0; }
  if (sx === _mt.shiftX && sy === _mt.shiftY) return;
  _mt.shiftX = sx; _mt.shiftY = sy;
  if (_mt.peek) return;   // looking elsewhere with the wheel; the next key brings it back
  const smooth = !instant && (code || tape || cfg.smoothLineScroll);
  words.style.transition = smooth ? 'transform 0.16s ease-out' : 'none';
  words.style.transform = `translate(${-sx}px, ${-sy}px)`;
}

function mtPlaceCaret(instant) {
  const caret = document.getElementById('mt-caret');
  if (!caret || !_mt) return null;
  let box = null;
  if (_mt.zen) box = mtZenCaretBox();
  else if (_mt.v) box = mtViewCaretBox(_mt.v);
  if (!box) return null;
  const cfg = mtConfig();
  const style = cfg.caretStyle;
  caret.hidden = style === 'off';
  const w = style === 'block' || style === 'outline' || style === 'underline' ? Math.max(box.w, 8) : 2;
  caret.style.width = w + 'px';
  caret.style.height = (style === 'underline' ? 2 : box.h) + 'px';
  const y = style === 'underline' ? box.y + box.h - 2 : box.y;
  const dur = instant ? 0 : ({ off: 0, slow: 150, medium: 100, fast: 70 }[cfg.smoothCaret] || 0);
  caret.style.transitionDuration = dur + 'ms';
  caret.style.transform = `translate(${box.x - (style === 'line' ? 1 : 0)}px, ${y}px)`;
  return box;
}

function mtPlacePace() {
  const pace = document.getElementById('mt-pace');
  if (!pace || !_mt) return;
  const wpm = _mt.paceWpm || 0;
  const eng = _mt.eng;
  if (!wpm || !eng || !eng.started || _mt.view !== 'test') { pace.hidden = true; return; }
  const secs = (performance.now() - eng.t0) / 1000;
  const idx = Math.min(eng.target.length - 1, Math.floor(wpm * 5 / 60 * secs));
  const sp = _mt.v.spans[idx];
  if (!sp) { pace.hidden = true; return; }
  pace.hidden = false;
  const cfg = mtConfig();
  const style = cfg.paceCaretStyle;
  pace.style.width = (style === 'line' ? 2 : Math.max(sp.offsetWidth, 8)) + 'px';
  pace.style.height = (style === 'underline' ? 2 : sp.offsetHeight) + 'px';
  pace.dataset.style = style;
  pace.style.transform = `translate(${sp.offsetLeft}px, ${style === 'underline' ? sp.offsetTop + sp.offsetHeight - 2 : sp.offsetTop}px)`;
}

/** Everything that follows a key: caret, scroll, the hidden current word, tts. */
function mtAfterChange(instant) {
  const box = mtPlaceCaret(instant);
  mtScrollToCaret(box, instant);
  const cfg = mtConfig();
  const eng = _mt.eng;
  if (!eng || !_mt.v) return;
  // read ahead: the word you are on is invisible
  if (cfg.funbox.indexOf('read_ahead') !== -1) {
    (_mt.raSpans || []).forEach(sp => sp.classList.remove('mt-ra'));
    const s = eng.caret, e = mtWordEnd(eng, eng.caret);
    _mt.raSpans = _mt.v.spans.slice(s, e);
    _mt.raSpans.forEach(sp => sp.classList.add('mt-ra'));
  }
  // tts: say each word as you arrive at it
  if (cfg.funbox.indexOf('tts') !== -1 && typeof speak === 'function') {
    const ws = mtWordStart(eng, Math.min(eng.caret, eng.target.length - 1));
    if (ws !== _mt.ttsWord && eng.caret < eng.target.length) {
      _mt.ttsWord = ws;
      const word = eng.target.slice(ws, mtWordEnd(eng, ws));
      if (word.trim()) { try { if (typeof speechStop === 'function') speechStop(); speak(word, {}); } catch (e) { /* no voice */ } }
    }
  }
}

/* ── Keys ──────────────────────────────────────────────────── */

function mtFocus() {
  const input = document.getElementById('mt-input');
  if (input && _mt && _mt.view === 'test' && !_mt.overlay) input.focus({ preventScroll: true });
}

function mtOnFocus() {
  if (!_mt) return;
  if (_mt.blurT) { clearTimeout(_mt.blurT); _mt.blurT = null; }
  const shell = document.getElementById('mt-shell');
  if (shell) shell.classList.remove('mt-unfocused');
}

function mtOnBlur() {
  if (!_mt) return;
  if (_mt.blurT) clearTimeout(_mt.blurT);
  // a moment's grace, so clicking a button on the bar does not flash the warning
  _mt.blurT = setTimeout(() => {
    const shell = document.getElementById('mt-shell');
    if (!shell || !_mt || _mt.view !== 'test' || _mt.overlay) return;
    if (document.activeElement && document.activeElement.id === 'mt-input') return;
    // an app dialog (a custom number, a confirm) has the keyboard on purpose
    if (document.querySelector('.modal-overlay:not(.hidden)')) return;
    if (mtConfig().outOfFocusWarning) shell.classList.add('mt-unfocused');
  }, 600);
}

function mtOnMouseMove() {
  const shell = document.getElementById('mt-shell');
  if (shell && shell.classList.contains('mt-typing')) shell.classList.remove('mt-typing');
}

function mtOnResize() {
  if (!_mt || _mt.view !== 'test') {
    if (_mt && _mt.view === 'result' && _mt.lastResult) mtRenderChart(_mt.lastResult);
    return;
  }
  _mt.peek = null;
  const shell = document.getElementById('mt-shell');
  if (shell) shell.classList.remove('mt-peeking');
  mtMeasure();
  _mt.shiftX = -1;
  mtAfterChange(true);
}

function mtCapsLock(e) {
  const el = document.getElementById('mt-capslock');
  if (!el || !e.getModifierState) return;
  el.classList.toggle('is-on', mtConfig().capsLockWarning && e.getModifierState('CapsLock'));
}

function mtOnInputKey(e) {
  if (!_mt || _mt.view !== 'test' || _mt.overlay) return;
  if (e.isComposing || e.keyCode === 229) return;
  mtCapsLock(e);
  let key = null;
  if (e.key === 'Backspace') key = (e.ctrlKey || e.altKey || e.metaKey) ? 'CtrlBackspace' : 'Backspace';
  else if (e.key === 'Enter') {
    if (e.shiftKey && _mt.zen) { e.preventDefault(); mtZenFinish(); return; }
    if (e.ctrlKey || e.metaKey) return;
    key = 'Enter';
  }
  else if (e.key === 'Tab') {
    if (e.shiftKey) return;
    key = 'Tab';
  }
  else if (e.key === ' ') key = ' ';
  else if (e.key && e.key.length === 1 && ((!e.ctrlKey && !e.metaKey) || (e.ctrlKey && e.altKey))) key = e.key;
  if (!key) return;
  e.preventDefault();
  mtHandleKey(key);
}

/** Phones and IMEs: characters that arrive without a usable keydown. */
function mtOnInputText(e) {
  const input = e.target;
  const v = input.value;
  input.value = '';
  if (!_mt || _mt.view !== 'test' || !v) return;
  for (const ch of v) mtHandleKey(ch === '\n' ? 'Enter' : ch);
}

function mtOnDocKey(e) {
  if (!_mt || document.body.dataset.route !== 'typing-attempt') return;
  const cfg = mtConfig();
  const stop = () => { e.preventDefault(); e.stopImmediatePropagation(); };

  if (e.key === 'Escape') {
    if (_mt.overlay) { stop(); mtOverlayBack(); return; }
    // a dialog from the rest of the app (a confirm, a prompt) closes as usual
    if (document.querySelector('.modal-overlay:not(.hidden)')) return;
    stop();
    if (cfg.quickRestart === 'esc') { mtRestart(); return; }
    mtOpenCommandLine();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'P' || e.key === 'p')) { stop(); mtOpenCommandLine(); return; }
  if (_mt.overlay) return;
  if (document.querySelector('.modal-overlay:not(.hidden)')) return;

  const active = document.activeElement;
  if (_mt.view === 'result') {
    if (e.key === 'Tab' && !e.shiftKey) {
      if (cfg.quickRestart === 'tab') { stop(); mtNextTest(); return; }
      if (!active || !active.closest || !active.closest('.mt-result')) {
        stop();
        const next = document.getElementById('mt-next');
        if (next) next.focus();
      }
    }
    return;
  }
  if (_mt.view !== 'test') return;
  if (active && active.id === 'mt-input') return;
  if (active && active.id === 'mt-restart' && (e.key === 'Enter' || e.key === ' ')) return;
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key && (e.key.length === 1 || e.key === 'Enter' || e.key === 'Backspace')) {
    // press any key to focus — the key itself is not typed
    stop();
    mtFocus();
  }
}

function mtHandleKey(key) {
  if (!_mt || _mt.view !== 'test') return;
  mtEndPeek();
  if (_mt.zen) { mtZenKey(key); return; }
  const eng = _mt.eng;
  if (!eng) return;
  const cfg = mtConfig();
  const now = performance.now();
  const wasStarted = eng.started;
  const r = mtEngineKey(eng, key, now);

  if (r.action === 'tab') {
    if (cfg.quickRestart === 'tab') { mtRestart(); return; }
    const btn = document.getElementById('mt-restart');
    if (btn) btn.focus();
    return;
  }
  if (!wasStarted && eng.started) mtOnStart();
  if (r.result === 'bad' || r.result === 'stop') {
    mtPlaySound(cfg.soundOnError !== 'off' ? 'error' : 'click', key);
    if (r.result === 'stop') {
      const c = document.getElementById('mt-caret');
      if (c) { c.classList.remove('is-shake'); void c.offsetWidth; c.classList.add('is-shake'); }
    }
  } else if (r.result !== 'none') mtPlaySound('click', key);

  if (_mt.memT && !_mt.memHidden && eng.started) { clearTimeout(_mt.memT); _mt.memT = null; mtMemoryHide(); }

  mtViewPaint(_mt.v);
  // time mode keeps the text coming
  if (_mt.loopChunk && eng.target.length - eng.caret < 500) mtExtend();
  mtAfterChange(false);
  mtRenderLive();
  if (r.fail) { mtFinish(r.fail); return; }
  if (r.finished) mtFinish('');
}

function mtExtend() {
  const eng = _mt.eng;
  const sep = eng.kind === 'code' ? '\n' : ' ';
  const chunk = sep + _mt.loopChunk;
  const from = eng.target.length;
  let cls = null, pairs = null;
  if (eng.kind === 'code') {
    const tk = mtTokenize(_mt.loopChunk, eng.lang);
    cls = [''].concat(tk.cls);
    pairs = new Map();
    tk.pairs.forEach((v, k) => pairs.set(k + 1, [v[0] + 1, v[1] + 1]));
  }
  mtEngineAppend(eng, chunk, cls, pairs);
  mtViewAppend(_mt.v, from);
}

/* ── The clock ─────────────────────────────────────────────── */

function mtOnStart() {
  const shell = document.getElementById('mt-shell');
  const cfg = mtConfig();
  if (shell) {
    shell.classList.add('mt-running');
    if (cfg.focusMode) shell.classList.add('mt-typing');
  }
  _mt.paceWpm = mtPaceWpm();
  if (_mt.paceWpm) _mt.pace = setInterval(mtPlacePace, 60);
  mtScheduleTick();
}

function mtElapsed() {
  if (_mt.zen) return _mt.zen.started ? performance.now() - _mt.zen.t0 : 0;
  return _mt.eng && _mt.eng.started ? performance.now() - _mt.eng.t0 : 0;
}

function mtScheduleTick() {
  const el = mtElapsed();
  const next = 1000 - (el % 1000);
  _mt.tick = setTimeout(() => { if (!_mt || _mt.view !== 'test') return; mtTick(); if (_mt && _mt.view === 'test') mtScheduleTick(); }, next);
}

function mtTick() {
  const cfg = mtConfig();
  const sec = Math.round(mtElapsed() / 1000);
  const src = _mt.zen || _mt.eng;
  const keys = src.secKeys[sec - 1] || 0;
  if (!keys) _mt.afk++;
  let wpm;
  if (_mt.zen) wpm = (mtZenGood() / 5) / (sec / 60);
  else wpm = mtEngineStats(_mt.eng, sec * 1000).wpm;
  _mt.samples.push({ wpm, raw: keys * 12, err: src.secErr[sec - 1] || 0 });
  mtRenderLive();
  if (cfg.mode === 'time') {
    mtPaintBar(sec / cfg.time);
    if (sec >= cfg.time) { mtFinish(''); return; }
  } else mtPaintProgressBar();
  if (sec >= 5 && !_mt.zen) {
    const s = mtEngineStats(_mt.eng, sec * 1000);
    if (cfg.minWpm && s.wpm < cfg.minWpm) { mtFinish('min speed'); return; }
    if (cfg.minAcc && s.acc < cfg.minAcc) { mtFinish('min accuracy'); return; }
  }
}

function mtPaintBar(frac) {
  const fill = document.getElementById('mt-bar-fill');
  const bar = document.getElementById('mt-bar');
  if (!fill || !bar) return;
  bar.hidden = mtConfig().timerStyle !== 'bar';
  fill.style.width = (Math.max(0, Math.min(1, frac)) * 100) + '%';
}

function mtPaintProgressBar() {
  if (!_mt.eng) return;
  mtPaintBar(_mt.eng.caret / Math.max(1, _mt.eng.target.length));
}

/** The number above the text: time left, or how far through you are. */
function mtProgressText() {
  const cfg = mtConfig();
  if (cfg.mode === 'time') {
    const left = _mt.eng && _mt.eng.started ? Math.max(0, cfg.time - Math.floor(mtElapsed() / 1000)) : cfg.time;
    return String(left);
  }
  if (_mt.zen) return String(Math.floor(mtElapsed() / 1000));
  const eng = _mt.eng;
  if (!eng) return '';
  if (eng.kind === 'code') {
    const total = eng.target.split('\n').length;
    let done = 0;
    for (let i = 0; i < eng.caret && i < eng.target.length; i++) if (eng.target[i] === '\n') done++;
    return `${Math.min(done + (eng.caret >= eng.target.length ? 1 : 0), total)}/${total}`;
  }
  const s = mtEngineStats(eng, 1);
  return `${s.wordsDone}/${s.wordsTotal}`;
}

function mtRenderLive() {
  const el = document.getElementById('mt-live');
  if (!el || !_mt) return;
  const cfg = mtConfig();
  const running = _mt.zen ? _mt.zen.started : (_mt.eng && _mt.eng.started);
  const parts = [];
  if (_mt.memT && !_mt.memHidden && !running) {
    parts.push(`<span class="mt-live-mem"><i data-lucide="eye"></i> memorize ${_mt.memLeft}s</span>`);
  }
  if (cfg.timerStyle === 'mini' || cfg.timerStyle === 'text') {
    parts.push(`<span class="mt-live-timer${cfg.timerStyle === 'text' ? ' is-big' : ''}">${mtProgressText()}</span>`);
  }
  if (running) {
    const ms = Math.max(mtElapsed(), 1);
    if (cfg.liveSpeed !== 'off') {
      const wpm = _mt.zen ? (mtZenGood() / 5) / (ms / 60000) : mtEngineStats(_mt.eng, ms).wpm;
      parts.push(`<span class="mt-live-stat${cfg.liveSpeed === 'text' ? ' is-big' : ''}">${mtSpeed(wpm, 0)}<small>${mtUnitLabel()}</small></span>`);
    }
    if (cfg.liveAcc !== 'off') {
      const acc = _mt.zen ? 100 : mtEngineStats(_mt.eng, ms).acc;
      parts.push(`<span class="mt-live-stat${cfg.liveAcc === 'text' ? ' is-big' : ''}">${Math.floor(acc)}%</span>`);
    }
    if (cfg.liveBurst !== 'off' && _mt.eng) {
      const eng = _mt.eng;
      let e = eng.caret - 1;
      while (e > 0 && _mtWs(eng.target[e])) e--;
      const s = mtWordStart(eng, e);
      const b = e >= s ? mtWordBurst(eng, s, e + 1) : 0;
      parts.push(`<span class="mt-live-stat${cfg.liveBurst === 'text' ? ' is-big' : ''}">${mtSpeed(b, 0)}<small>burst</small></span>`);
    }
  }
  el.innerHTML = parts.join('');
  el.classList.toggle('is-hidden', !parts.length);
  if (_mt.memT && typeof lucide !== 'undefined') lucide.createIcons({ root: el });
}

/* ── Zen: a blank page ─────────────────────────────────────── */

function mtZenRender() {
  const z = _mt.zen;
  const host = document.getElementById('mt-letters');
  if (!host || !z) return;
  const body = z.kind === 'code' && mtConfig().syntaxColors
    ? mtHighlightHTML(z.typed, z.lang)
    : escapeHTML(z.typed);
  host.innerHTML = `<span class="mt-zen">${body}</span><span class="mt-zen-end" id="mt-zen-end">​</span>` +
    (z.typed ? '' : '<span class="mt-zen-hint">type it from memory…</span>');
}

function mtZenCaretBox() {
  const end = document.getElementById('mt-zen-end');
  if (!end) return null;
  const h = end.offsetHeight || _mt.lineH * 0.8;
  return { x: end.offsetLeft, y: end.offsetTop, w: 10, h };
}

function mtZenGood() {
  const z = _mt.zen;
  if (!z) return 0;
  // a live estimate: the longest prefix that matches the reference
  const a = z.ref, b = z.typed;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

function mtZenKey(key) {
  const z = _mt.zen;
  if (!z || z.finished) return;
  const now = performance.now();
  if (key === 'Backspace' || key === 'CtrlBackspace') {
    if (!z.typed) return;
    if (key === 'CtrlBackspace') z.typed = z.typed.replace(/\s*\S*$/, '');
    else z.typed = z.typed.slice(0, -1);
    if (z.started) z.log.push([now - z.t0, key]);
  } else {
    if (!z.started) { z.started = true; z.t0 = now; mtOnStart(); }
    const code = z.kind === 'code';
    if (key === 'Enter') {
      let add = '\n';
      if (code && mtConfig().autoIndent) {
        const line = z.typed.slice(z.typed.lastIndexOf('\n') + 1);
        let ind = (line.match(/^ */) || [''])[0];
        if (/[{\[(]\s*$/.test(line) || (z.lang === 'html' && /<([a-z][\w-]*)(?:\s[^>]*)?>\s*$/i.test(line) && !/<\//.test(line))) ind += '    ';
        add += ind;
      }
      z.typed += add;
    } else if (key === 'Tab') {
      z.typed += code ? '    ' : '';
    } else {
      // a closing bracket on a line of nothing but indentation steps back out
      if (code && mtConfig().autoIndent && /^[}\])]$/.test(key)) {
        const ls = z.typed.lastIndexOf('\n') + 1;
        const line = z.typed.slice(ls);
        if (/^ +$/.test(line)) z.typed = z.typed.slice(0, ls) + line.slice(Math.min(4, line.length));
      }
      z.typed += key;
    }
    const sec = Math.floor((now - z.t0) / 1000);
    z.secKeys[sec] = (z.secKeys[sec] || 0) + 1;
    z.log.push([now - z.t0, key]);
    mtPlaySound('click', key);
  }
  mtZenRender();
  mtAfterChange(false);
  mtRenderLive();
}

/** Compare the recall with the entry and show the result. */
function mtZenFinish() {
  const z = _mt.zen;
  if (!z || z.finished) return;
  if (!z.started) return;
  z.finished = true;
  mtFinish('');
}

/* ── Finishing ─────────────────────────────────────────────── */

function mtFinish(failed) {
  if (!_mt || _mt.view !== 'test') return;
  const cfg = mtConfig();
  const now = performance.now();
  const src = _mt.zen || _mt.eng;
  if (!src.started) return;
  mtStopTimers();
  let ms = now - src.t0;
  if (cfg.mode === 'time' && !failed) ms = Math.min(ms, cfg.time * 1000);
  ms = Math.max(ms, 1);

  // the last part-second, at the pace it was going
  const whole = _mt.samples.length;
  const restMs = ms - whole * 1000;
  if (restMs > 150) {
    const keys = src.secKeys[whole] || 0;
    const wpmNow = _mt.zen ? (mtZenGood() / 5) / (ms / 60000) : mtEngineStats(_mt.eng, ms).wpm;
    _mt.samples.push({ wpm: wpmNow, raw: keys * (60000 / restMs) / 5, err: src.secErr[whole] || 0, partial: true });
    if (!keys) _mt.afk++;
  }

  let result;
  const source = _mt.source;
  const base = {
    id: generateId(), itemId: source.itemId || null, title: source.title, kind: source.kind, lang: source.lang,
    mode: cfg.mode,
    mode2: cfg.mode === 'time' ? cfg.time : cfg.mode === 'words' ? (source.kind === 'code' ? cfg.lines : cfg.words) : 'full',
    punctuation: !!cfg.punctuation, numbers: !!cfg.numbers, difficulty: cfg.difficulty,
    funbox: cfg.funbox.slice(), date: Date.now(), time: Math.round(ms) / 1000,
    temp: !!source.temp
  };

  if (_mt.zen) {
    const z = _mt.zen;
    const ref = z.kind === 'text' ? z.ref.replace(/\n/g, ' ') : z.ref;
    let typed = mtCleanContent(z.typed, z.kind);
    if (z.kind === 'text') typed = typed.replace(/\n/g, ' ');
    const d = mtDiff(ref, typed);
    const ok = d.marks.filter(m => m === 'ok').length;
    const bad = d.marks.filter(m => m === 'bad').length;
    const miss = d.marks.filter(m => m === 'miss').length;
    let extra = 0;
    d.inserted.forEach(s => { extra += s.length; });
    const min = ms / 60000;
    result = Object.assign(base, {
      wpm: ok / 5 / min, raw: typed.length / 5 / min,
      acc: Math.max(ref.length, typed.length) ? (ok / Math.max(ref.length, typed.length)) * 100 : 100,
      chars: { correct: ok, incorrect: bad, extra, missed: miss }
    });
    _mt.zenDiff = { ref, typed, d };
  } else {
    const s = mtEngineStats(_mt.eng, ms);
    result = Object.assign(base, { wpm: s.wpm, raw: s.raw, acc: s.acc, chars: s.chars });
    _mt.zenDiff = null;
  }
  result.consistency = mtConsistency(_mt.samples.map(x => x.raw));
  result.afk = _mt.samples.length ? (_mt.afk / _mt.samples.length) * 100 : 0;
  result.failed = failed || '';
  const tooShort = ms < 2000;
  result.valid = !failed && !tooShort && result.afk < 50;
  result.notes = [];
  if (failed) result.notes.push('failed (' + failed + ')');
  if (tooShort) result.notes.push('test too short');
  if (result.afk >= 10) result.notes.push('afk detected');
  if (result.funbox.length) result.notes.push('funbox: ' + result.funbox.join(', '));
  if (result.difficulty !== 'normal') result.notes.push(result.difficulty);
  if (source.temp) result.notes.push('practice');

  const key = mtPbKey(result);
  const prevPb = mtPersonalBest(key);
  result.pb = result.valid && !source.temp && (!prevPb || result.wpm > prevPb.wpm);
  result.prevPb = prevPb ? prevPb.wpm : null;
  if (result.valid && !source.temp) {
    const save = Object.assign({}, result);
    delete save.notes; delete save.prevPb; delete save.pb; delete save.temp;
    save.wpm = Math.round(save.wpm * 100) / 100;
    save.raw = Math.round(save.raw * 100) / 100;
    save.acc = Math.round(save.acc * 100) / 100;
    save.consistency = Math.round(save.consistency * 100) / 100;
    save.afk = Math.round(save.afk * 10) / 10;
    mtRecordResult(save);
  }
  result.samples = _mt.samples.slice();
  _mt.lastResult = result;
  mtShowResult(result);
}

/* ── The result screen ─────────────────────────────────────── */

function _mtTip(text) { return ` data-tip="${escapeHTML(text)}"`; }

function mtShowResult(r) {
  _mt.view = 'result';
  const shell = document.getElementById('mt-shell');
  shell.classList.remove('mt-running', 'mt-typing', 'mt-unfocused');
  shell.classList.add('mt-done');
  shell.classList.toggle('mt-failed', !!r.failed);
  document.getElementById('mt-test').hidden = true;
  const host = document.getElementById('mt-result');
  host.hidden = false;
  const cfg = mtConfig();
  const unit = mtUnitLabel();
  const c = r.chars;
  const typeLabel = r.mode === 'quote' ? 'full' : r.mode === 'words' ? (r.kind === 'code' ? 'lines' : 'words') : r.mode;
  const mode2 = r.mode === 'time' || r.mode === 'words' ? ' ' + r.mode2 : '';
  const lang = r.kind === 'code' ? mtLangMeta(r.lang).name : (r.punctuation || r.numbers ? 'text' : 'text, plain');
  const other = r.notes.length ? r.notes : ['-'];
  const pbLine = r.pb
    ? `<span class="mt-pb"><i data-lucide="crown"></i> new personal best${r.prevPb ? ` (was ${mtSpeed(r.prevPb)})` : ''}</span>`
    : (r.prevPb && !r.temp ? `<span class="mt-pb-old"${_mtTip('your best for this test')}><i data-lucide="crown"></i> ${mtSpeed(r.prevPb)}</span>` : '');
  host.innerHTML = `
    <div class="mt-r-top">
      <div class="mt-r-big">
        <div class="mt-r-group"${_mtTip(mtSpeed(r.wpm, 2) + ' ' + unit)}>
          <div class="mt-r-label">${unit}</div>
          <div class="mt-r-value">${mtSpeed(r.wpm)}</div>
        </div>
        <div class="mt-r-group"${_mtTip(r.acc.toFixed(2) + '%')}>
          <div class="mt-r-label">acc</div>
          <div class="mt-r-value">${Math.floor(r.acc)}%</div>
        </div>
        ${pbLine}
      </div>
      <div class="mt-r-chartwrap">
        <div class="mt-legend" id="mt-legend"></div>
        <div class="mt-r-chart" id="mt-chart"></div>
      </div>
    </div>
    <div class="mt-r-stats">
      <div class="mt-r-stat"><div class="mt-r-label">test type</div>
        <div class="mt-r-small">${escapeHTML(typeLabel + mode2)}<br>${escapeHTML(lang)}<br><span class="mt-r-title">${escapeHTML(r.title || '')}</span></div></div>
      <div class="mt-r-stat"><div class="mt-r-label">other</div>
        <div class="mt-r-small">${other.map(escapeHTML).join('<br>')}</div></div>
      <div class="mt-r-stat"${_mtTip(mtSpeed(r.raw, 2) + ' ' + unit)}><div class="mt-r-label">raw</div>
        <div class="mt-r-mid">${mtSpeed(r.raw)}</div></div>
      <div class="mt-r-stat"${_mtTip('correct, incorrect, extra, and missed')}><div class="mt-r-label">characters</div>
        <div class="mt-r-mid">${c.correct}/${c.incorrect}/${c.extra}/${c.missed}</div></div>
      <div class="mt-r-stat"${_mtTip(r.consistency.toFixed(2) + '%')}><div class="mt-r-label">consistency</div>
        <div class="mt-r-mid">${Math.round(r.consistency)}%</div></div>
      <div class="mt-r-stat"${_mtTip(r.time.toFixed(2) + 's, ' + r.afk.toFixed(1) + '% afk')}><div class="mt-r-label">time</div>
        <div class="mt-r-mid">${Math.round(r.time)}s</div>
        <div class="mt-r-tiny">${r.afk.toFixed(2)}% afk</div></div>
    </div>
    ${r.valid || r.temp ? '' : `<div class="mt-r-note">Not saved — ${escapeHTML(r.failed ? 'the test failed' : r.time < 2 ? 'the test was too short' : 'mostly away from the keyboard')}.</div>`}
    <div class="mt-r-actions">
      <button class="mt-icon is-lg" id="mt-next" type="button" onclick="mtNextTest()"${_mtTip('Next test')} aria-label="Next test"><i data-lucide="chevron-right"></i></button>
      <button class="mt-icon is-lg" type="button" onclick="mtRestart(true)"${_mtTip('Repeat test')} aria-label="Repeat test"><i data-lucide="refresh-cw"></i></button>
      <button class="mt-icon is-lg" type="button" onclick="mtPracticeMistakes()"${_mtTip('Practise your mistakes')} aria-label="Practise your mistakes"><i data-lucide="triangle-alert"></i></button>
      <button class="mt-icon is-lg" type="button" onclick="mtToggleHistory()"${_mtTip('Toggle words history')} aria-label="Toggle words history"><i data-lucide="align-left"></i></button>
      <button class="mt-icon is-lg" type="button" onclick="mtToggleReplay()"${_mtTip('Watch replay')} aria-label="Watch replay"><i data-lucide="rewind"></i></button>
      <button class="mt-icon is-lg" type="button" onclick="mtSaveScreenshot()"${_mtTip('Save screenshot')} aria-label="Save screenshot"><i data-lucide="image"></i></button>
      <button class="mt-icon is-lg" type="button" onclick="mtLeave()"${_mtTip('Back to the library')} aria-label="Back to the library"><i data-lucide="library-big"></i></button>
    </div>
    <div class="mt-r-panel" id="mt-r-history" hidden></div>
    <div class="mt-r-panel" id="mt-r-replay" hidden></div>
    <details class="mt-r-table"><summary>per-second data</summary><div id="mt-r-table"></div></details>`;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: host });
  mtRenderChart(r);
  mtRenderTable(r);
  mtRenderFoot();
  if (r.pb) mtPlaySound('pb');
  const next = document.getElementById('mt-next');
  if (next) next.focus({ preventScroll: true });
}

function mtNextTest() {
  _mt.temp = null;
  mtRestart(false);
}

function mtRenderTable(r) {
  const el = document.getElementById('mt-r-table');
  if (!el) return;
  const unit = mtUnitLabel();
  el.innerHTML = `<table class="mt-table"><thead><tr><th>second</th><th>${unit}</th><th>raw</th><th>errors</th></tr></thead><tbody>${
    r.samples.map((s, i) => `<tr><td>${s.partial ? (r.time).toFixed(1) : i + 1}</td><td>${mtSpeed(s.wpm)}</td><td>${mtSpeed(s.raw)}</td><td>${s.err}</td></tr>`).join('')
  }</tbody></table>`;
}

/* ── Words history ─────────────────────────────────────────── */

function mtToggleHistory() {
  const el = document.getElementById('mt-r-history');
  if (!el) return;
  el.hidden = !el.hidden;
  if (!el.hidden) mtRenderHistory(el);
}

function mtRenderHistory(el) {
  const code = _mt.source && _mt.source.kind === 'code';
  el.className = 'mt-r-panel mt-history' + (code ? ' is-code' : ' is-text');
  if (_mt.zenDiff) {
    const { ref, d } = _mt.zenDiff;
    const tk = code ? mtTokenize(ref, _mt.source.lang).cls : null;
    let html = '';
    for (let i = 0; i <= ref.length; i++) {
      const ins = d.inserted.get(i);
      if (ins) html += `<span class="mt-xs">${[...ins].map(c => `<span class="mt-x">${_mtEsc(c === '\n' ? '↵' : c === ' ' ? '·' : c)}</span>`).join('')}</span>`;
      if (i === ref.length) break;
      const ch = ref[i];
      const cls = d.marks[i] === 'ok' ? ' c-ok' : d.marks[i] === 'bad' ? ' c-bad' : ' c-miss';
      const tok = tk && tk[i] && ch !== ' ' && ch !== '\n' ? ' tk-' + tk[i] : '';
      html += `<span class="mt-c${cls}${tok}${ch === ' ' ? ' sp' : ch === '\n' ? ' nl' : ''}">${_mtEsc(ch === '\n' ? '↵' : ch)}</span>`;
      if (ch === '\n') html += '<br class="mt-br">';
    }
    el.innerHTML = `<div class="mt-r-label">from memory, against the entry</div><div class="mt-letters mt-static">${html}</div>`;
    return;
  }
  const eng = _mt.eng;
  // only what was reached: in time mode the rest is padding
  const end = Math.min(eng.target.length, Math.max(eng.caret, 1));
  const view = { host: document.createElement('div'), eng, spans: [], slots: new Map(), opts: {} };
  mtViewRender(view);
  const words = view.host.querySelectorAll('.mt-w');
  // a burst on every word, for the hover
  let idx = 0;
  words.forEach(w => {
    const first = w.querySelector('.mt-c');
    const pos = view.spans.indexOf(first, idx);
    if (pos < 0) return;
    idx = pos;
    const e = mtWordEnd(eng, pos);
    if (pos >= end) { w.classList.add('mt-unreached'); return; }
    const b = mtWordBurst(eng, pos, e);
    let bad = false;
    for (let k = pos; k < e; k++) if (eng.st[k] === MT_BAD || eng.st[k] === MT_MISS) bad = true;
    if ((eng.extras.get(e) || '').length) bad = true;
    if (bad) w.classList.add('mt-wbad');
    w.setAttribute('data-tip', mtSpeed(b) + ' ' + mtUnitLabel());
  });
  el.innerHTML = '<div class="mt-r-label">words history</div>';
  view.host.className = 'mt-letters mt-static';
  // cut the untouched tail of a time test
  if (_mt.loopChunk) {
    const cut = view.spans[Math.min(end + 40, view.spans.length - 1)];
    if (cut) {
      let node = cut.closest('.mt-w') || cut;
      while (node && node.nextSibling) node.parentNode.removeChild(node.nextSibling);
    }
  }
  el.appendChild(view.host);
}

/* ── Practise the mistakes ─────────────────────────────────── */

function mtPracticeMistakes() {
  const src = _mt.source;
  let text = '';
  if (_mt.zenDiff) {
    const { ref, d } = _mt.zenDiff;
    const bad = new Set();
    let s = 0;
    for (let i = 0; i <= ref.length; i++) {
      if (i === ref.length || ref[i] === ' ' || ref[i] === '\n') {
        let wrong = false;
        for (let k = s; k < i; k++) if (d.marks[k] !== 'ok') wrong = true;
        if (d.inserted.get(i)) wrong = true;
        if (wrong) bad.add(src.kind === 'code' ? _mtLineAt(ref, s) : ref.slice(s, i));
        s = i + 1;
      }
    }
    text = [...bad].filter(Boolean).join(src.kind === 'code' ? '\n' : ' ');
  } else {
    const eng = _mt.eng;
    const T = eng.target;
    const bad = [];
    const seen = new Set();
    let i = 0;
    while (i < Math.min(eng.caret, T.length)) {
      if (_mtWs(T[i])) { i++; continue; }
      const e = mtWordEnd(eng, i);
      let wrong = (eng.extras.get(e) || '').length > 0;
      for (let k = i; k < e; k++) if (eng.st[k] === MT_BAD || eng.st[k] === MT_MISS) wrong = true;
      if (wrong) {
        const piece = src.kind === 'code' ? _mtLineAt(T, i) : T.slice(i, e);
        if (!seen.has(piece)) { seen.add(piece); bad.push(piece); }
      }
      i = e;
    }
    text = bad.join(src.kind === 'code' ? '\n' : ' ');
  }
  if (!text.trim()) {
    if (typeof toast === 'function') toast('No mistakes to practise — clean run.', { type: 'success' });
    return;
  }
  if (src.kind === 'text') {
    // each word three times, shuffled
    const words = [];
    text.split(' ').forEach(w => { words.push(w, w, w); });
    for (let i = words.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [words[i], words[j]] = [words[j], words[i]]; }
    text = words.join(' ');
  }
  _mt.temp = { title: 'practice: ' + (src.title || 'mistakes'), kind: src.kind, lang: src.lang, content: text, itemId: null, custom: false, temp: true };
  const cfg = mtConfig();
  if (cfg.mode !== 'quote') mtSetConfig({ mode: 'quote' });
  mtRestart(false);
}

/** The whole line of code around position i, trimmed of its indentation. */
function _mtLineAt(T, i) {
  const s = T.lastIndexOf('\n', i - 1) + 1;
  let e = T.indexOf('\n', i);
  if (e < 0) e = T.length;
  return T.slice(s, e).trim();
}

/* ── Replay ────────────────────────────────────────────────── */

function mtToggleReplay() {
  const el = document.getElementById('mt-r-replay');
  if (!el) return;
  if (!el.hidden) { mtStopReplay(); el.hidden = true; return; }
  el.hidden = false;
  if (_mt.zen) {
    el.innerHTML = '<div class="mt-r-label">replay</div><p class="mt-r-small">Zen keeps no replay — open the words history to see your recall against the entry.</p>';
    return;
  }
  const code = _mt.source.kind === 'code';
  el.className = 'mt-r-panel mt-replay' + (code ? ' is-code' : ' is-text');
  el.innerHTML = `
    <div class="mt-replay-head">
      <span class="mt-r-label">watch replay</span>
      <button class="mt-cbtn" type="button" id="mt-replay-play" onclick="mtPlayReplay()"><i data-lucide="play"></i> play</button>
      <span class="mt-replay-stat" id="mt-replay-stat"></span>
    </div>
    <div class="mt-replay-box"><div class="mt-words mt-replay-words"><div class="mt-letters" id="mt-replay-letters"></div><div class="mt-caret" id="mt-replay-caret"></div></div></div>`;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: el });
  mtResetReplay();
}

function mtResetReplay() {
  const src = _mt.eng;
  const host = document.getElementById('mt-replay-letters');
  if (!host || !src) return;
  const e = mtEngineCreate({ target: src.target, kind: src.kind, lang: src.lang, cls: src.cls, pairs: src.pairs, settings: src.settings });
  const v = mtViewCreate(host, e, {});
  mtViewRender(v);
  _mt.replay = { eng: e, v, i: 0, timer: null, t0: 0 };
  mtReplayCaret();
}

function mtReplayCaret() {
  const rp = _mt.replay;
  const caret = document.getElementById('mt-replay-caret');
  if (!rp || !caret) return;
  const box = mtViewCaretBox(rp.v);
  if (!box) return;
  caret.style.height = box.h + 'px';
  caret.style.transform = `translate(${box.x}px, ${box.y}px)`;
  // keep the caret in view inside the replay box
  const words = caret.parentNode;
  const outer = words.parentNode;
  const H = outer.clientHeight;
  const sy = Math.max(0, box.y - H * 0.4);
  words.style.transform = `translateY(${-sy}px)`;
}

function mtPlayReplay() {
  mtStopReplay();
  mtResetReplay();
  const rp = _mt.replay;
  const log = _mt.eng.log;
  if (!rp || !log.length) return;
  rp.t0 = performance.now();
  const step = () => {
    if (!_mt || !_mt.replay) return;
    const t = performance.now() - rp.t0;
    while (rp.i < log.length && log[rp.i][0] <= t) {
      mtEngineKey(rp.eng, log[rp.i][1], rp.eng.started ? rp.eng.t0 + log[rp.i][0] : performance.now());
      if (rp.i === 0 && rp.eng.started) rp.eng.t0 = performance.now() - log[0][0];
      rp.i++;
    }
    mtViewPaint(rp.v);
    mtReplayCaret();
    const st = document.getElementById('mt-replay-stat');
    if (st && rp.eng.started) {
      const s = mtEngineStats(rp.eng, Math.max(1, t));
      st.textContent = `${(t / 1000).toFixed(1)}s · ${mtSpeed(s.wpm)} ${mtUnitLabel()}`;
    }
    if (rp.i < log.length) rp.timer = setTimeout(step, 16);
  };
  step();
}

function mtStopReplay() {
  if (_mt && _mt.replay && _mt.replay.timer) { clearTimeout(_mt.replay.timer); _mt.replay.timer = null; }
}
