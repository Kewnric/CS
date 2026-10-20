/* ============================================================
   TYPING-PANELS.JS — everything around the Memorization Typing test
   ------------------------------------------------------------
   Themes, fonts and sounds; the settings page, the command line, the entry
   picker and the custom-text box; the result chart and the screenshot.
   The test itself is typing-attempt.js and shares its `_mt` state.
   ============================================================ */

/* ── Themes ───────────────────────────────────────────────── */

/* The typing screen has its own palettes, the way a typing site does: a
   test is read at a glance and wants its own contrast, not the app's. The
   first one follows whatever the app is wearing. Each is six colours: the
   page, the panels, the ghost text, the typed text, the accent (caret, timer,
   wpm) and the error. */
const MT_THEMES = [
  { key: 'app',      name: 'app',      bg: 'var(--bg-body)', alt: 'var(--bg-surface)', sub: 'var(--text-tertiary)', text: 'var(--text-primary)', main: 'var(--color-primary)', error: 'var(--color-danger)', extra: '#7f1d1d' },
  { key: 'graphite', name: 'graphite', bg: '#2c2e31', alt: '#25272a', sub: '#646669', text: '#d1d0c5', main: '#e2b714', error: '#ca4754', extra: '#7e2a33', dark: true },
  { key: 'midnight', name: 'midnight', bg: '#0b1120', alt: '#131c31', sub: '#3d4b66', text: '#e2e8f0', main: '#818cf8', error: '#f87171', extra: '#7f1d1d', dark: true },
  { key: 'ember',    name: 'ember',    bg: '#1b1311', alt: '#251a17', sub: '#6e5249', text: '#f3e6d8', main: '#ff8f3f', error: '#ff4d5e', extra: '#7a2531', dark: true },
  { key: 'matcha',   name: 'matcha',   bg: '#1d2621', alt: '#243029', sub: '#5a7563', text: '#e0ebe3', main: '#a3d47f', error: '#ef6f6c', extra: '#7d3634', dark: true },
  { key: 'lagoon',   name: 'lagoon',   bg: '#0e2230', alt: '#132b3c', sub: '#44687c', text: '#d7edf5', main: '#4fd1c5', error: '#ff6b6b', extra: '#7d3240', dark: true },
  { key: 'sakura',   name: 'sakura',   bg: '#2a1f2c', alt: '#332636', sub: '#7a6380', text: '#f4e6f0', main: '#f59ac4', error: '#ff5a7a', extra: '#803249', dark: true },
  { key: 'terminal', name: 'terminal', bg: '#0a0f0a', alt: '#111a11', sub: '#2f5a33', text: '#b8f5b0', main: '#39ff6a', error: '#ff4040', extra: '#6b1a1a', dark: true },
  { key: 'paper',    name: 'paper',    bg: '#f3eee3', alt: '#e8e1d2', sub: '#b0a794', text: '#3b3830', main: '#c2410c', error: '#dc2626', extra: '#fca5a5', dark: false },
  { key: 'snow',     name: 'snow',     bg: '#f8fafc', alt: '#eef2f7', sub: '#a7b0bf', text: '#1e293b', main: '#4f46e5', error: '#e11d48', extra: '#fda4af', dark: false }
];

function mtTheme() {
  return MT_THEMES.find(t => t.key === mtConfig().theme) || MT_THEMES[1];
}

/** The app theme is dark unless the app is wearing its light one. */
function _mtThemeIsDark(t) {
  if (t.dark !== undefined) return t.dark;
  return (document.documentElement.getAttribute('data-theme') || 'dark') !== 'light';
}

/* ── Fonts ────────────────────────────────────────────────── */

const MT_FONTS = [
  { key: 'jetbrains',   name: 'JetBrains Mono',  css: "'JetBrains Mono', monospace" },
  { key: 'roboto',      name: 'Roboto Mono',     css: "'Roboto Mono', monospace", g: 'Roboto+Mono:wght@400;600' },
  { key: 'fira',        name: 'Fira Code',       css: "'Fira Code', monospace", g: 'Fira+Code:wght@400;600' },
  { key: 'source',      name: 'Source Code Pro', css: "'Source Code Pro', monospace", g: 'Source+Code+Pro:wght@400;600' },
  { key: 'ibm',         name: 'IBM Plex Mono',   css: "'IBM Plex Mono', monospace", g: 'IBM+Plex+Mono:wght@400;600' },
  { key: 'ubuntu',      name: 'Ubuntu Mono',     css: "'Ubuntu Mono', monospace", g: 'Ubuntu+Mono:wght@400;700' },
  { key: 'space',       name: 'Space Mono',      css: "'Space Mono', monospace", g: 'Space+Mono:wght@400;700' },
  { key: 'inconsolata', name: 'Inconsolata',     css: "'Inconsolata', monospace", g: 'Inconsolata:wght@400;700' },
  { key: 'inter',       name: 'Inter',           css: "'Inter', sans-serif" },
  { key: 'lexend',      name: 'Lexend Deca',     css: "'Lexend Deca', sans-serif", g: 'Lexend+Deca:wght@400;600' },
  { key: 'nunito',      name: 'Nunito',          css: "'Nunito', sans-serif", g: 'Nunito:wght@400;700' },
  { key: 'pixel',       name: 'Pixelify Sans',   css: "'Pixelify Sans', sans-serif" }
];

function mtFont() {
  return MT_FONTS.find(f => f.key === mtConfig().fontFamily) || MT_FONTS[0];
}

/** Fetch a Google font the first time it is picked. */
function _mtLoadFont(f) {
  if (!f.g) return;
  const id = 'mt-font-' + f.key;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=' + f.g + '&display=swap';
  link.onload = () => { if (_mt && _mt.view === 'test') { mtMeasure(); mtAfterChange(true); } };
  document.head.appendChild(link);
}

/* ── Applying the look ────────────────────────────────────── */

function mtApplyLook() {
  const shell = document.getElementById('mt-shell');
  if (!shell) return;
  const cfg = mtConfig();
  const t = mtTheme();
  const f = mtFont();
  _mtLoadFont(f);
  const st = shell.style;
  st.setProperty('--mt-bg', t.bg);
  st.setProperty('--mt-alt', t.alt);
  st.setProperty('--mt-sub', t.sub);
  st.setProperty('--mt-text', t.text);
  st.setProperty('--mt-main', t.main);
  st.setProperty('--mt-error', t.error);
  st.setProperty('--mt-extra', t.extra);
  st.setProperty('--mt-font', f.css);
  st.setProperty('--mt-size', cfg.fontSize + 'rem');
  st.setProperty('--mt-width', cfg.pageWidth ? cfg.pageWidth + 'px' : 'none');
  const src = _mt && _mt.source;
  const code = src ? src.kind === 'code' : false;
  const fb = cfg.funbox;
  const cls = {
    'mt-dark': _mtThemeIsDark(t),
    'mt-light': !_mtThemeIsDark(t),
    'mt-code': code,
    'mt-text': !code,
    'mt-syntax': code && cfg.syntaxColors,
    'mt-blind': cfg.blindMode,
    'mt-flip': cfg.flipColors,
    'mt-colorful': cfg.colorfulMode,
    'mt-tape': !code && cfg.tapeMode !== 'off',
    'mt-typo-below': cfg.indicateTypos === 'below',
    'mt-nl-shown': cfg.showNewlines,
    'mt-fb-mirror': fb.indexOf('mirror') !== -1,
    'mt-fb-upside': fb.indexOf('upside_down') !== -1,
    'mt-fb-nausea': fb.indexOf('nausea') !== -1,
    'mt-zenmode': cfg.mode === 'zen'
  };
  Object.keys(cls).forEach(k => shell.classList.toggle(k, !!cls[k]));
  ['line', 'block', 'outline', 'underline', 'off'].forEach(s => shell.classList.toggle('mt-caret-' + s, cfg.caretStyle === s));
}

/* ── Sounds ───────────────────────────────────────────────── */

let _mtAudio = null;

function _mtAudioCtx() {
  if (_mtAudio) return _mtAudio;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  try { _mtAudio = new Ctor(); } catch (e) { _mtAudio = null; }
  return _mtAudio;
}

/** A short synthesised tone: wave, start and end pitch, length in seconds. */
function _mtTone(ctx, type, f0, f1, len, gain) {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + len);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + 0.004);
  env.gain.exponentialRampToValueAtTime(0.0001, t + len);
  osc.connect(env); env.connect(ctx.destination);
  osc.start(t); osc.stop(t + len + 0.02);
}

/** A burst of filtered noise — the body of a click. */
function _mtNoise(ctx, len, freq, q, gain) {
  const t = ctx.currentTime;
  const n = Math.max(1, Math.floor(ctx.sampleRate * len));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass'; band.frequency.value = freq; band.Q.value = q;
  const env = ctx.createGain();
  env.gain.value = gain;
  src.connect(band); band.connect(env); env.connect(ctx.destination);
  src.start(t);
}

const MT_CLICK_SOUNDS = [
  ['off', 'off'], ['click', 'click'], ['beep', 'beep'], ['pop', 'pop'], ['thock', 'thock'],
  ['typewriter', 'typewriter'], ['app', 'app voice']
];
const MT_ERROR_SOUNDS = [['off', 'off'], ['damage', 'damage'], ['buzz', 'buzz'], ['blip', 'blip']];

function mtPlaySound(kind, key) {
  const cfg = mtConfig();
  const which = kind === 'error' ? cfg.soundOnError : kind === 'pb' ? 'pb' : cfg.soundOnClick;
  if (!which || which === 'off') return;
  if (kind === 'pb' && cfg.soundOnClick === 'off' && cfg.soundOnError === 'off') return;
  if (which === 'app') {
    if (typeof sfxBlip === 'function' && typeof sfxKeyVoice === 'function') {
      const v = sfxKeyVoice(key === ' ' ? ' ' : key || 'a');
      sfxBlip(v[0], v[1], v[2], v[3]);
    }
    return;
  }
  const ctx = _mtAudioCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  const g = Math.max(0.01, cfg.soundVolume) * 0.5;
  const jitter = 1 + (Math.random() - 0.5) * 0.08;
  switch (which) {
    case 'click': _mtNoise(ctx, 0.03, 2600 * jitter, 1.2, g * 1.6); break;
    case 'beep': _mtTone(ctx, 'sine', 880 * jitter, 870, 0.05, g * 0.5); break;
    case 'pop': _mtTone(ctx, 'sine', 700 * jitter, 180, 0.06, g * 0.8); break;
    case 'thock': _mtTone(ctx, 'triangle', 190 * jitter, 90, 0.07, g * 0.9); _mtNoise(ctx, 0.02, 1200, 0.8, g * 0.8); break;
    case 'typewriter': _mtNoise(ctx, 0.05, 3600 * jitter, 2, g * 1.8); _mtTone(ctx, 'square', 120, 60, 0.03, g * 0.15); break;
    case 'damage': _mtTone(ctx, 'square', 120, 70, 0.12, g * 0.35); break;
    case 'buzz': _mtTone(ctx, 'sawtooth', 160, 140, 0.09, g * 0.3); break;
    case 'blip': _mtTone(ctx, 'triangle', 420, 210, 0.08, g * 0.6); break;
    case 'pb': [523, 659, 784].forEach((f, i) => setTimeout(() => _mtTone(ctx, 'triangle', f, f, 0.16, g * 0.7), i * 90)); break;
  }
}

/* ── The pace caret ───────────────────────────────────────── */

function mtPaceWpm() {
  const cfg = mtConfig();
  if (cfg.paceCaret === 'off' || !_mt || !_mt.source) return 0;
  if (cfg.paceCaret === 'custom') return Math.max(1, cfg.paceCaretWpm || 0);
  const src = _mt.source;
  const key = mtPbKey({
    itemId: src.itemId, kind: src.kind, mode: cfg.mode, punctuation: cfg.punctuation, numbers: cfg.numbers,
    mode2: cfg.mode === 'time' ? cfg.time : cfg.mode === 'words' ? (src.kind === 'code' ? cfg.lines : cfg.words) : 'full'
  });
  if (cfg.paceCaret === 'pb') { const pb = mtPersonalBest(key); return pb ? pb.wpm : 0; }
  if (cfg.paceCaret === 'last') { const l = mtLastFor(key); return l ? l.wpm : 0; }
  return mtAverageFor(key, 10);
}

/* ── Settings ─────────────────────────────────────────────── */

const MT_ON_OFF = [[false, 'off'], [true, 'on']];

const MT_SETTINGS = [
  { section: 'behavior', key: 'difficulty', label: 'test difficulty', desc: 'Normal is the classic test. Expert fails the test if you submit (press space or enter on) a word with a mistake. Master fails it on a single wrong key.',
    options: [['normal', 'normal'], ['expert', 'expert'], ['master', 'master']] },
  { section: 'behavior', key: 'quickRestart', label: 'quick restart', desc: 'Restart with a single key. With it off, tab then enter restarts. Tab still indents in code when indentation is expected.',
    options: [['off', 'off'], ['tab', 'tab'], ['esc', 'esc']] },
  { section: 'behavior', key: 'blindMode', label: 'blind mode', desc: 'No mistakes are shown while you type. You find out at the end.', options: MT_ON_OFF },
  { section: 'behavior', key: 'freedomMode', label: 'freedom mode', desc: 'Backspace into any earlier word, even one you typed correctly.', options: MT_ON_OFF },
  { section: 'behavior', key: 'strictSpace', label: 'strict space', desc: 'Pressing space before you have typed any of a word counts as a mistake instead of being ignored.', options: MT_ON_OFF },
  { section: 'behavior', key: 'stopOnError', label: 'stop on error', desc: 'Letter: the caret will not move past a wrong letter. Word: you cannot leave a word until it is right.',
    options: [['off', 'off'], ['letter', 'letter'], ['word', 'word']] },
  { section: 'behavior', key: 'confidenceMode', label: 'confidence mode', desc: 'On: you cannot go back to earlier words. Max: no backspace at all.',
    options: [['off', 'off'], ['on', 'on'], ['max', 'max']] },
  { section: 'behavior', key: 'indicateTypos', label: 'indicate typos', desc: 'Show what you actually typed: under the letter, or in its place.',
    options: [['off', 'off'], ['below', 'below'], ['replace', 'replace']] },
  { section: 'behavior', key: 'lazyMode', label: 'lazy mode', desc: 'Accented letters accept their plain versions — á takes a, ñ takes n.', options: MT_ON_OFF },
  { section: 'behavior', key: 'minWpm', label: 'min speed', desc: 'Fail the test if your speed drops below this after the first five seconds. 0 is off.', number: true, suffix: 'wpm' },
  { section: 'behavior', key: 'minAcc', label: 'min accuracy', desc: 'Fail the test if your accuracy drops below this. 0 is off.', number: true, suffix: '%' },

  { section: 'code', key: 'autoIndent', label: 'auto indent', desc: 'After Enter the next line’s indentation fills itself in, as an editor does. Off: type the spaces yourself (tab jumps four).', options: MT_ON_OFF },
  { section: 'code', key: 'autoClose', label: 'auto close', desc: 'Typing an opening bracket, quote or HTML tag fills in its closer. Type the closer anyway and it overtypes, or keep going and the caret steps past it.', options: MT_ON_OFF },
  { section: 'code', key: 'syntaxColors', label: 'syntax highlighting', desc: 'Colour code the way VS Code does. Off: plain test colours.', options: MT_ON_OFF },
  { section: 'code', key: 'codeLines', label: 'code window', desc: 'How many lines of code are on screen at once. Long code scrolls with you as you type.',
    options: [[8, '8'], [12, '12'], [16, '16'], [24, '24'], [0, 'all']] },
  { section: 'code', key: 'showNewlines', label: 'line ends', desc: 'Show a faint ↵ where Enter is expected.', options: MT_ON_OFF },

  { section: 'caret', key: 'caretStyle', label: 'caret style', desc: 'The shape of the caret.',
    options: [['off', 'off'], ['line', '|'], ['block', '▮'], ['outline', '▯'], ['underline', '_']] },
  { section: 'caret', key: 'smoothCaret', label: 'smooth caret', desc: 'How quickly the caret glides to the next letter.',
    options: [['off', 'off'], ['slow', 'slow'], ['medium', 'medium'], ['fast', 'fast']] },
  { section: 'caret', key: 'paceCaret', label: 'pace caret', desc: 'A second caret moving at a set speed to race against: your average, your best, your last, or a number.',
    options: [['off', 'off'], ['average', 'avg'], ['pb', 'pb'], ['last', 'last'], ['custom', 'custom']] },
  { section: 'caret', key: 'paceCaretWpm', label: 'custom pace', desc: 'The speed of the pace caret when it is set to custom.', number: true, suffix: 'wpm' },
  { section: 'caret', key: 'paceCaretStyle', label: 'pace caret style', desc: 'The shape of the pace caret.',
    options: [['line', '|'], ['block', '▮'], ['outline', '▯'], ['underline', '_']] },

  { section: 'sound', key: 'soundVolume', label: 'sound volume', desc: 'How loud the sounds below are.',
    options: [[0.1, 'quiet'], [0.25, 'low'], [0.5, 'medium'], [0.75, 'loud'], [1, 'max']] },
  { section: 'sound', key: 'soundOnClick', label: 'play sound on click', desc: 'A sound on every key. App voice uses the typing sound you picked for the practice editor.', options: MT_CLICK_SOUNDS },
  { section: 'sound', key: 'soundOnError', label: 'play sound on error', desc: 'A different sound on a wrong key.', options: MT_ERROR_SOUNDS },

  { section: 'appearance', key: 'fontSize', label: 'font size', desc: 'Size of the text you type.',
    options: [[1, '1'], [1.25, '1.25'], [1.5, '1.5'], [2, '2'], [2.5, '2.5'], [3, '3'], [4, '4']] },
  { section: 'appearance', key: 'fontFamily', label: 'font family', desc: 'Fonts other than JetBrains Mono and Inter load the first time you pick them.',
    options: MT_FONTS.map(f => [f.key, f.name]), fonts: true },
  { section: 'appearance', key: 'timerStyle', label: 'timer / progress', desc: 'How the time left (or how far you are) is shown.',
    options: [['off', 'off'], ['bar', 'bar'], ['text', 'text'], ['mini', 'mini']] },
  { section: 'appearance', key: 'liveSpeed', label: 'live speed', desc: 'Your speed while you type.', options: [['off', 'off'], ['text', 'text'], ['mini', 'mini']] },
  { section: 'appearance', key: 'liveAcc', label: 'live accuracy', desc: 'Your accuracy while you type.', options: [['off', 'off'], ['text', 'text'], ['mini', 'mini']] },
  { section: 'appearance', key: 'liveBurst', label: 'live burst', desc: 'The speed of the word you just finished.', options: [['off', 'off'], ['text', 'text'], ['mini', 'mini']] },
  { section: 'appearance', key: 'speedUnit', label: 'typing speed unit', desc: 'Words per minute, characters per minute, words per second or per hour.',
    options: [['wpm', 'wpm'], ['cpm', 'cpm'], ['wps', 'wps'], ['wph', 'wph']] },
  { section: 'appearance', key: 'alwaysShowDecimals', label: 'always show decimals', desc: 'Speeds and accuracy with two decimals.', options: MT_ON_OFF },
  { section: 'appearance', key: 'tapeMode', label: 'tape mode', desc: 'Prose on one line that scrolls sideways, by letter or by word.',
    options: [['off', 'off'], ['letter', 'letter'], ['word', 'word']] },
  { section: 'appearance', key: 'textLines', label: 'lines shown', desc: 'How many lines of prose are on screen at once. Three is the classic typing test; more lets you read further ahead. The mouse wheel scrolls back and forward either way.',
    options: [[3, '3'], [4, '4'], [5, '5'], [8, '8'], [12, '12'], [0, 'all']] },
  { section: 'appearance', key: 'pageWidth', label: 'page width', desc: 'How wide the text runs before it wraps to the next line.',
    options: [[1000, 'narrow'], [1300, 'normal'], [1600, 'wide'], [0, 'full']] },
  { section: 'appearance', key: 'smoothLineScroll', label: 'smooth line scroll', desc: 'Lines slide up instead of jumping.', options: MT_ON_OFF },
  { section: 'appearance', key: 'flipColors', label: 'flip test colors', desc: 'The ghost text is bright and what you have typed dims.', options: MT_ON_OFF },
  { section: 'appearance', key: 'colorfulMode', label: 'colorful mode', desc: 'Typed letters take the accent colour.', options: MT_ON_OFF },
  { section: 'appearance', key: 'focusMode', label: 'focus mode', desc: 'Everything but the text fades away once you start. Move the mouse to bring it back.', options: MT_ON_OFF },
  { section: 'appearance', key: 'outOfFocusWarning', label: 'out of focus warning', desc: 'Blur the text and say so when the test has lost the keyboard.', options: MT_ON_OFF },
  { section: 'appearance', key: 'capsLockWarning', label: 'caps lock warning', desc: 'A warning while caps lock is on.', options: MT_ON_OFF },
  { section: 'appearance', key: 'keyTips', label: 'key tips', desc: 'The shortcut hints at the bottom.', options: MT_ON_OFF },

  { section: 'theme', key: 'theme', label: 'theme', desc: 'Colours for the typing screen. "app" follows the app’s own theme.', themes: true },
  { section: 'funbox', key: 'funbox', label: 'funbox', desc: 'Twists on the test. Pick any number. Tests with a funbox still save, marked as such.', funbox: true }
];

const MT_FUNBOX = [
  { key: 'memory', name: 'memory', desc: 'The text shows for a few seconds, then disappears. Type it from memory.' },
  { key: 'read_ahead', name: 'read ahead', desc: 'The word you are typing is invisible — read ahead.' },
  { key: 'mirror', name: 'mirror', desc: 'Everything flipped left to right.' },
  { key: 'upside_down', name: 'upside down', desc: 'Everything upside down.' },
  { key: 'nausea', name: 'nausea', desc: 'The text sways.' },
  { key: 'tts', name: 'tts', desc: 'Each word is read aloud as you reach it.' },
  { key: 'all_caps', name: 'ALL CAPS', desc: 'Prose only.', text: true },
  { key: 'random_case', name: 'rAnDoM cAsE', desc: 'Prose only.', text: true },
  { key: 'backwards', name: 'sdrawkcab', desc: 'Every word spelled backwards. Prose only.', text: true }
];

const MT_SECTIONS = [
  ['behavior', 'behavior', 'sliders-horizontal'],
  ['code', 'code', 'code-2'],
  ['caret', 'caret', 'text-cursor'],
  ['sound', 'sound', 'volume-2'],
  ['appearance', 'appearance', 'eye'],
  ['theme', 'theme', 'palette'],
  ['funbox', 'funbox', 'party-popper']
];

/** Settings that change the words themselves need a new test; the rest apply live. */
const MT_RESTART_KEYS = new Set(['difficulty', 'stopOnError', 'confidenceMode', 'freedomMode', 'strictSpace',
  'lazyMode', 'autoIndent', 'autoClose', 'funbox', 'codeLines', 'tapeMode', 'textLines', 'pageWidth', 'fontSize', 'fontFamily',
  'indicateTypos', 'minWpm', 'minAcc']);

function mtChangeSetting(key, value) {
  mtSetConfig({ [key]: value });
  mtApplyLook();
  if (!_mt) return;
  mtRenderFoot();
  if (_mt.view === 'test' && (MT_RESTART_KEYS.has(key) || !_mt.eng || !_mt.eng.started)) {
    // nothing typed yet, or the change reshapes the test: start it over
    mtRestart(key === 'funbox' ? undefined : 'keep');
    if (_mt.overlay) { const input = document.getElementById('mt-input'); if (input) input.blur(); }
  } else if (_mt.view === 'test') {
    mtViewRender(_mt.v);
    mtMeasure();
    mtAfterChange(true);
  } else if (_mt.view === 'result' && _mt.lastResult) {
    mtShowResult(_mt.lastResult);
  }
}

function mtToggleFunbox(key) {
  const cur = mtConfig().funbox.slice();
  const i = cur.indexOf(key);
  if (i > -1) cur.splice(i, 1); else cur.push(key);
  mtChangeSetting('funbox', cur);
  _mtPaintSettings();
}

/* The overlays: one at a time, each a full-screen layer inside the shell. */
function _mtOverlay(kind, html, cls) {
  mtCloseOverlay();
  const shell = document.getElementById('mt-shell');
  if (!shell) return null;
  const el = document.createElement('div');
  el.className = 'mt-overlay ' + (cls || '');
  el.id = 'mt-overlay';
  el.innerHTML = html;
  el.addEventListener('mousedown', (e) => { if (e.target === el) mtCloseOverlay(); });
  shell.appendChild(el);
  _mt.overlay = kind;
  const input = document.getElementById('mt-input');
  if (input) input.blur();
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: el });
  return el;
}

function mtCloseOverlay() {
  const el = document.getElementById('mt-overlay');
  if (el) el.remove();
  if (_mt) {
    _mt.overlay = null;
    if (_mt.view === 'test') setTimeout(mtFocus, 0);
  }
}

/** Esc inside an overlay: out of a command's options first, then closed. */
function mtOverlayBack() {
  if (_mt && _mt.overlay === 'cmd' && _mt.cmd && _mt.cmd.sub) {
    _mt.cmd.sub = null;
    _mt.cmd.q = '';
    const q = document.getElementById('mt-cmd-q');
    if (q) q.value = '';
    _mtPaintCommands();
    return;
  }
  mtCloseOverlay();
}

function mtOpenSettings() {
  if (!_mt) return;
  _mtOverlay('settings', `
    <div class="mt-panel mt-settings" role="dialog" aria-label="Typing settings">
      <div class="mt-panel-head">
        <h2><i data-lucide="settings"></i> settings</h2>
        <nav class="mt-settings-nav">${MT_SECTIONS.map(s => `<button class="mt-cbtn" type="button" onclick="mtJumpSection('${s[0]}')"><i data-lucide="${s[2]}"></i>${s[1]}</button>`).join('')}</nav>
        <button class="mt-icon" type="button" onclick="mtCloseOverlay()" title="Close (esc)" aria-label="Close"><i data-lucide="x"></i></button>
      </div>
      <div class="mt-panel-body" id="mt-settings-body"></div>
      <div class="mt-panel-foot">
        <button class="mt-btn" type="button" onclick="mtResetSettingsAsk()"><i data-lucide="rotate-ccw"></i> reset settings</button>
        <span class="mt-hint">Settings are saved on this device.</span>
      </div>
    </div>`, 'is-settings');
  _mtPaintSettings();
}

function mtJumpSection(key) {
  const el = document.getElementById('mt-sec-' + key);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function _mtSettingRow(s) {
  const cfg = mtConfig();
  const cur = cfg[s.key];
  let control = '';
  if (s.number) {
    control = `<div class="mt-numrow"><input class="mt-num" type="number" min="0" value="${escapeHTML(String(cur))}"
      onchange="mtChangeSetting('${s.key}', Math.max(0, parseFloat(this.value) || 0))" /><span>${escapeHTML(s.suffix || '')}</span></div>`;
  } else if (s.themes) {
    control = `<div class="mt-swatches">${MT_THEMES.map(t => `
      <button class="mt-swatch${cur === t.key ? ' is-on' : ''}" type="button" onclick="mtChangeSetting('theme', '${t.key}'); _mtPaintSettings()"
              style="--sw-bg:${t.bg}; --sw-main:${t.main}; --sw-sub:${t.sub}; --sw-text:${t.text};">
        <span class="mt-swatch-name">${escapeHTML(t.name)}</span>
        <span class="mt-swatch-dots"><i></i><i></i><i></i></span>
      </button>`).join('')}</div>`;
  } else if (s.funbox) {
    control = `<div class="mt-opts mt-opts-wrap">${MT_FUNBOX.map(f => `
      <button class="mt-opt${cur.indexOf(f.key) !== -1 ? ' is-on' : ''}" type="button" onclick="mtToggleFunbox('${f.key}')" title="${escapeHTML(f.desc)}">${escapeHTML(f.name)}</button>`).join('')}</div>`;
  } else {
    control = `<div class="mt-opts${s.options.length > 5 ? ' mt-opts-wrap' : ''}">${s.options.map(([v, label]) => {
      const on = cur === v;
      const val = typeof v === 'string' ? `'${v}'` : String(v);
      const style = s.fonts ? ` style="font-family:${escapeHTML((MT_FONTS.find(f => f.key === v) || {}).css || 'inherit')}"` : '';
      return `<button class="mt-opt${on ? ' is-on' : ''}" type="button"${style} onclick="mtChangeSetting('${s.key}', ${val}); _mtPaintSettings()">${escapeHTML(label)}</button>`;
    }).join('')}</div>`;
  }
  return `
    <div class="mt-set${s.themes || s.funbox || s.fonts ? ' is-wide' : ''}">
      <div class="mt-set-text"><h4>${escapeHTML(s.label)}</h4><p>${escapeHTML(s.desc)}</p></div>
      <div class="mt-set-ctl">${control}</div>
    </div>`;
}

function _mtPaintSettings() {
  const body = document.getElementById('mt-settings-body');
  if (!body) return;
  const top = body.scrollTop;
  body.innerHTML = MT_SECTIONS.map(([key, label, icon]) => `
    <section class="mt-sec" id="mt-sec-${key}">
      <h3><i data-lucide="${icon}"></i> ${label}</h3>
      ${MT_SETTINGS.filter(s => s.section === key).map(_mtSettingRow).join('')}
    </section>`).join('');
  body.scrollTop = top;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: body });
}

function mtResetSettingsAsk() {
  const go = () => { mtResetConfig(); mtApplyLook(); _mtPaintSettings(); mtRenderFoot(); if (_mt && _mt.view === 'test') mtRestart('keep'); };
  if (typeof showConfirm === 'function') showConfirm('Reset typing settings?', 'Every setting on this screen goes back to its default. Your entries and results are not touched.', go);
  else go();
}

/* ── The command line ─────────────────────────────────────── */

/**
 * Every command. A command either runs, or opens a list of options (a
 * setting's values). Settings come straight from MT_SETTINGS, so nothing on
 * the settings page is missing here.
 */
function _mtCommandList() {
  const cfg = mtConfig();
  const code = _mt && _mt.source && _mt.source.kind === 'code';
  const list = [
    { label: 'restart test', icon: 'rotate-cw', run: () => mtRestart() },
    { label: 'repeat test', icon: 'refresh-cw', run: () => mtRestart(true) },
    { label: 'pick entry…', icon: 'library-big', run: () => mtOpenPicker() },
    { label: 'custom text…', icon: 'wrench', run: () => mtOpenCustom() },
    { label: 'mode…', icon: 'list', key: 'mode', options: [['time', 'time'], ['words', code ? 'lines' : 'words'], ['quote', 'full'], ['zen', 'zen'], ['custom', 'custom']], set: (v) => mtSetMode(v) },
    { label: 'time…', icon: 'clock', key: 'time', options: [[15, '15'], [30, '30'], [60, '60'], [120, '120']], set: (v) => { mtSetConfig({ mode: 'time' }); mtSetValue('time', v); } },
    { label: 'words…', icon: 'a-large-small', key: 'words', options: [[10, '10'], [25, '25'], [50, '50'], [100, '100']], set: (v) => { mtSetConfig({ mode: 'words' }); mtSetValue('words', v); } },
    { label: 'lines…', icon: 'list-ordered', key: 'lines', options: [[5, '5'], [10, '10'], [25, '25'], [50, '50']], set: (v) => { mtSetConfig({ mode: 'words' }); mtSetValue('lines', v); } },
    { label: 'full length…', icon: 'quote', key: 'quoteLength', options: [['this', 'this entry'], ['all', 'any']].concat(MT_LENGTHS.map(g => [g.key, g.name])), set: (v) => { mtSetConfig({ mode: 'quote' }); mtSetValue('quoteLength', v); } },
    { label: 'punctuation', icon: 'at-sign', toggle: 'punctuation', run: () => mtToggle('punctuation') },
    { label: 'numbers', icon: 'hash', toggle: 'numbers', run: () => mtToggle('numbers') },
    { label: 'settings', icon: 'settings', run: () => mtOpenSettings() },
    { label: 'back to library', icon: 'library-big', run: () => mtLeave() },
    { label: 'write entries in admin', icon: 'pencil-line', run: () => spaNavigate('admin-typing') }
  ];
  MT_SETTINGS.forEach(s => {
    if (s.funbox) {
      list.push({ label: 'funbox…', icon: 'party-popper', key: 'funbox', multi: true,
        options: MT_FUNBOX.map(f => [f.key, f.name]), set: (v) => mtToggleFunbox(v) });
    } else if (s.themes) {
      list.push({ label: 'theme…', icon: 'palette', key: 'theme', options: MT_THEMES.map(t => [t.key, t.name]),
        set: (v) => mtChangeSetting('theme', v), preview: true });
    } else if (s.number) {
      list.push({ label: s.label + '…', icon: 'hash', run: () => {
        const apply = (v) => mtChangeSetting(s.key, Math.max(0, parseFloat(v) || 0));
        const input = document.getElementById('mt-input');
        if (input) input.blur();
        if (typeof showInputDialog === 'function') showInputDialog(s.label, s.desc, s.suffix || '', String(cfg[s.key]), apply);
        else { const v = window.prompt(s.label, String(cfg[s.key])); if (v !== null) apply(v); }
      } });
    } else {
      list.push({ label: s.label + '…', icon: 'sliders-horizontal', key: s.key, options: s.options, set: (v) => mtChangeSetting(s.key, v) });
    }
  });
  return list;
}

function mtOpenCommandLine(subKey) {
  if (!_mt) return;
  _mt.cmd = { q: '', sel: 0, sub: null, list: _mtCommandList() };
  _mtOverlay('cmd', `
    <div class="mt-cmd" role="dialog" aria-label="Command line">
      <div class="mt-cmd-in"><i data-lucide="chevron-right"></i>
        <input id="mt-cmd-q" type="text" autocomplete="off" spellcheck="false" placeholder="Type a command…" /></div>
      <div class="mt-cmd-list" id="mt-cmd-list" role="listbox"></div>
    </div>`, 'is-cmd');
  if (subKey) {
    const c = _mt.cmd.list.find(x => x.key === subKey);
    if (c) _mt.cmd.sub = c;
  }
  const q = document.getElementById('mt-cmd-q');
  q.addEventListener('input', () => { _mt.cmd.q = q.value; _mt.cmd.sel = 0; _mtPaintCommands(); });
  q.addEventListener('keydown', _mtCmdKey);
  _mtPaintCommands();
  setTimeout(() => q.focus(), 0);
}

function _mtCmdRows() {
  const c = _mt.cmd;
  const q = c.q.trim().toLowerCase();
  const cfg = mtConfig();
  if (c.sub) {
    return c.sub.options
      .map(([v, label]) => ({ v, label, on: c.sub.multi ? cfg[c.sub.key].indexOf(v) !== -1 : cfg[c.sub.key] === v }))
      .filter(r => !q || String(r.label).toLowerCase().includes(q));
  }
  return c.list
    .filter(x => !q || x.label.toLowerCase().includes(q) || q.split(' ').every(w => x.label.toLowerCase().includes(w)))
    .map(x => ({ cmd: x, label: x.label, on: x.toggle ? !!cfg[x.toggle] : null }));
}

function _mtPaintCommands() {
  const host = document.getElementById('mt-cmd-list');
  if (!host || !_mt.cmd) return;
  const rows = _mtCmdRows();
  const c = _mt.cmd;
  if (c.sel >= rows.length) c.sel = Math.max(0, rows.length - 1);
  const head = c.sub ? `<div class="mt-cmd-crumb">${escapeHTML(c.sub.label.replace('…', ''))}</div>` : '';
  host.innerHTML = head + (rows.map((r, i) => `
    <button class="mt-cmd-row${i === c.sel ? ' is-sel' : ''}" type="button" role="option" data-i="${i}"
            onmousemove="_mtCmdHover(${i})" onclick="_mtCmdPick(${i})">
      ${c.sub ? `<i data-lucide="${r.on ? 'check' : 'dot'}" class="mt-cmd-tick${r.on ? ' is-on' : ''}"></i>`
              : `<i data-lucide="${r.cmd.icon || 'chevron-right'}"></i>`}
      <span>${escapeHTML(String(r.label))}</span>
      ${!c.sub && r.on !== null ? `<em>${r.on ? 'on' : 'off'}</em>` : ''}
    </button>`).join('') || '<div class="mt-cmd-none">Nothing matches.</div>');
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: host });
  const sel = host.querySelector('.is-sel');
  if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: 'nearest' });
  // a theme previews as you move over it
  if (c.sub && c.sub.preview) {
    const r = rows[c.sel];
    if (r) _mtPreviewTheme(r.v);
  }
}

function _mtPreviewTheme(key) {
  const shell = document.getElementById('mt-shell');
  const t = MT_THEMES.find(x => x.key === key);
  if (!shell || !t) return;
  shell.style.setProperty('--mt-bg', t.bg);
  shell.style.setProperty('--mt-alt', t.alt);
  shell.style.setProperty('--mt-sub', t.sub);
  shell.style.setProperty('--mt-text', t.text);
  shell.style.setProperty('--mt-main', t.main);
  shell.style.setProperty('--mt-error', t.error);
}

function _mtCmdHover(i) {
  if (!_mt.cmd || _mt.cmd.sel === i) return;
  _mt.cmd.sel = i;
  const host = document.getElementById('mt-cmd-list');
  if (host) host.querySelectorAll('.mt-cmd-row').forEach(el => el.classList.toggle('is-sel', +el.dataset.i === i));
  if (_mt.cmd.sub && _mt.cmd.sub.preview) { const r = _mtCmdRows()[i]; if (r) _mtPreviewTheme(r.v); }
}

function _mtCmdPick(i) {
  const c = _mt.cmd;
  const rows = _mtCmdRows();
  const r = rows[i];
  if (!r) return;
  if (c.sub) {
    const sub = c.sub;
    if (sub.multi) { sub.set(r.v); _mtPaintCommands(); return; }
    mtCloseOverlay();
    sub.set(r.v);
    return;
  }
  if (r.cmd.options) {
    c.sub = r.cmd; c.q = ''; c.sel = Math.max(0, r.cmd.options.findIndex(o => o[0] === mtConfig()[r.cmd.key]));
    const q = document.getElementById('mt-cmd-q');
    if (q) { q.value = ''; q.focus(); }
    _mtPaintCommands();
    return;
  }
  mtCloseOverlay();
  r.cmd.run();
}

function _mtCmdKey(e) {
  const c = _mt.cmd;
  if (!c) return;
  const n = _mtCmdRows().length;
  if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) { e.preventDefault(); c.sel = n ? (c.sel + 1) % n : 0; _mtPaintCommands(); }
  else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) { e.preventDefault(); c.sel = n ? (c.sel - 1 + n) % n : 0; _mtPaintCommands(); }
  else if (e.key === 'Enter') { e.preventDefault(); _mtCmdPick(c.sel); }
  else if (e.key === 'Backspace' && !c.q && c.sub) { e.preventDefault(); mtOverlayBack(); }
}

/* ── Picking an entry ─────────────────────────────────────── */

function mtOpenPicker() {
  if (!_mt) return;
  _mt.pick = { q: '', kind: 'all' };
  _mtOverlay('picker', `
    <div class="mt-panel mt-picker" role="dialog" aria-label="Pick an entry">
      <div class="mt-panel-head">
        <h2><i data-lucide="library-big"></i> pick an entry</h2>
        <button class="mt-icon" type="button" onclick="mtCloseOverlay()" title="Close (esc)" aria-label="Close"><i data-lucide="x"></i></button>
      </div>
      <div class="mt-pick-bar">
        <div class="mt-pick-search"><i data-lucide="search"></i><input id="mt-pick-q" type="text" autocomplete="off" placeholder="Search your entries…" /></div>
        <div class="mt-opts" id="mt-pick-kinds"></div>
      </div>
      <div class="mt-panel-body" id="mt-pick-list"></div>
    </div>`, 'is-picker');
  const q = document.getElementById('mt-pick-q');
  q.addEventListener('input', () => { _mt.pick.q = q.value; _mtPaintPicker(); });
  q.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { const first = document.querySelector('#mt-pick-list .mt-pick-row'); if (first) first.click(); }
  });
  _mtPaintPicker();
  setTimeout(() => q.focus(), 0);
}

function _mtPaintPicker() {
  const host = document.getElementById('mt-pick-list');
  const kinds = document.getElementById('mt-pick-kinds');
  if (!host || !_mt.pick) return;
  const p = _mt.pick;
  const filters = [['all', 'all'], ['text', 'text']].concat(MT_LANGS.map(l => [l.key, l.short.toLowerCase()]));
  kinds.innerHTML = filters.map(([k, label]) => `<button class="mt-opt${p.kind === k ? ' is-on' : ''}" type="button" onclick="_mt.pick.kind='${k}'; _mtPaintPicker()">${label}</button>`).join('');
  const q = p.q.trim().toLowerCase();
  const items = mtItems().filter(it => {
    if (p.kind === 'text' && it.kind !== 'text') return false;
    if (p.kind !== 'all' && p.kind !== 'text' && (it.kind !== 'code' || it.lang !== p.kind)) return false;
    if (!q) return true;
    return (it.title || '').toLowerCase().includes(q) || (it.tags || []).some(t => t.toLowerCase().includes(q)) || (it.content || '').toLowerCase().includes(q);
  });
  const cur = _mt.source && _mt.source.itemId;
  host.innerHTML = items.map(it => {
    const sz = mtItemSize(it);
    const best = mtBestFor(it.id);
    return `
      <button class="mt-pick-row${it.id === cur ? ' is-on' : ''}" type="button" onclick="mtPickItem('${it.id}')">
        <i data-lucide="${it.kind === 'code' ? mtLangMeta(it.lang).icon : 'file-text'}"></i>
        <span class="mt-pick-title">${escapeHTML(it.title || 'Untitled')}</span>
        <span class="mt-pick-meta">${it.kind === 'code' ? escapeHTML(mtLangMeta(it.lang).name) + ' · ' + sz.lines + ' line' + (sz.lines !== 1 ? 's' : '') : sz.words + ' word' + (sz.words !== 1 ? 's' : '')} · ${mtLengthGroup(it)}</span>
        <span class="mt-pick-best">${best ? mtSpeed(best.wpm) + ' ' + mtUnitLabel() : ''}</span>
      </button>`;
  }).join('') || `<div class="mt-cmd-none">${mtItems().length ? 'Nothing matches.' : 'No entries yet — write some in Admin.'}</div>`;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: host });
}

function mtPickItem(id) {
  mtCloseOverlay();
  _mt.temp = null;
  const patch = { lastItem: id, quoteLength: 'this' };
  if (mtConfig().mode === 'custom') patch.mode = 'quote';
  mtSetConfig(patch);
  mtRestart();
}

/* ── Custom text ──────────────────────────────────────────── */

function mtOpenCustom() {
  if (!_mt) return;
  const cfg = mtConfig();
  _mtOverlay('custom', `
    <div class="mt-panel mt-custom" role="dialog" aria-label="Custom text">
      <div class="mt-panel-head">
        <h2><i data-lucide="wrench"></i> custom text</h2>
        <button class="mt-icon" type="button" onclick="mtCloseOverlay()" title="Close (esc)" aria-label="Close"><i data-lucide="x"></i></button>
      </div>
      <div class="mt-panel-body">
        <div class="mt-custom-row">
          <div class="mt-opts" id="mt-custom-kind">
            <button class="mt-opt${cfg.customKind !== 'code' ? ' is-on' : ''}" type="button" data-kind="text" onclick="_mtCustomKind('text')"><i data-lucide="file-text"></i> text</button>
            <button class="mt-opt${cfg.customKind === 'code' ? ' is-on' : ''}" type="button" data-kind="code" onclick="_mtCustomKind('code')"><i data-lucide="code-2"></i> code</button>
          </div>
          <div class="mt-opts" id="mt-custom-lang"${cfg.customKind === 'code' ? '' : ' hidden'}>
            ${MT_LANGS.map(l => `<button class="mt-opt${cfg.customLang === l.key ? ' is-on' : ''}" type="button" data-lang="${l.key}" onclick="_mtCustomLang('${l.key}')">${l.name}</button>`).join('')}
          </div>
        </div>
        <textarea id="mt-custom-text" class="mt-textarea${cfg.customKind === 'code' ? ' is-code' : ''}" spellcheck="false" rows="10">${escapeHTML(cfg.customText || '')}</textarea>
        <div class="mt-custom-row" id="mt-custom-textopts"${cfg.customKind === 'code' ? ' hidden' : ''}>
          <label class="mt-check"><input type="checkbox" id="mt-custom-shuffle"${cfg.customShuffle ? ' checked' : ''}/> shuffle the words</label>
          <label class="mt-check"><input type="checkbox" id="mt-custom-nl"${cfg.customNewlines === 'space' ? ' checked' : ''}/> line breaks become spaces</label>
        </div>
      </div>
      <div class="mt-panel-foot">
        <button class="mt-btn" type="button" onclick="mtSaveCustomToLibrary()" title="Keep it as a library entry"><i data-lucide="bookmark-plus"></i> save to library</button>
        <span class="mt-grow"></span>
        <button class="mt-btn is-main" type="button" onclick="mtApplyCustom()"><i data-lucide="check"></i> apply</button>
      </div>
    </div>`, 'is-custom');
  const ta = document.getElementById('mt-custom-text');
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && !e.shiftKey && ta.classList.contains('is-code')) {
      e.preventDefault();
      const s = ta.selectionStart;
      ta.setRangeText('    ', s, ta.selectionEnd, 'end');
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); mtApplyCustom(); }
  });
  setTimeout(() => ta.focus(), 0);
}

function _mtCustomKind(kind) {
  document.querySelectorAll('#mt-custom-kind .mt-opt').forEach(b => b.classList.toggle('is-on', b.dataset.kind === kind));
  const lang = document.getElementById('mt-custom-lang');
  const opts = document.getElementById('mt-custom-textopts');
  const ta = document.getElementById('mt-custom-text');
  if (lang) lang.hidden = kind !== 'code';
  if (opts) opts.hidden = kind === 'code';
  if (ta) ta.classList.toggle('is-code', kind === 'code');
}

function _mtCustomLang(key) {
  document.querySelectorAll('#mt-custom-lang .mt-opt').forEach(b => b.classList.toggle('is-on', b.dataset.lang === key));
}

function _mtReadCustom() {
  const kindBtn = document.querySelector('#mt-custom-kind .mt-opt.is-on');
  const langBtn = document.querySelector('#mt-custom-lang .mt-opt.is-on');
  const ta = document.getElementById('mt-custom-text');
  return {
    customKind: kindBtn ? kindBtn.dataset.kind : 'text',
    customLang: langBtn ? langBtn.dataset.lang : 'c',
    customText: ta ? ta.value : '',
    customShuffle: !!(document.getElementById('mt-custom-shuffle') || {}).checked,
    customNewlines: (document.getElementById('mt-custom-nl') || {}).checked ? 'space' : 'keep'
  };
}

function mtApplyCustom() {
  const patch = _mtReadCustom();
  if (!mtCleanContent(patch.customText, patch.customKind).trim()) {
    if (typeof toast === 'function') toast('Type or paste something first.', { type: 'warning' });
    return;
  }
  patch.mode = 'custom';
  mtSetConfig(patch);
  _mt.temp = null;
  mtCloseOverlay();
  mtRestart();
}

function mtSaveCustomToLibrary() {
  const p = _mtReadCustom();
  const draft = mtBlankItem(p.customKind);
  draft.lang = p.customLang;
  draft.content = p.customText;
  const it = mtSaveItem(draft);
  if (!it) { if (typeof toast === 'function') toast('Type or paste something first.', { type: 'warning' }); return; }
  if (typeof toast === 'function') toast('Saved to the library as "' + it.title + '". Rename it in Admin.', { type: 'success' });
  mtCloseOverlay();
  mtSetConfig({ mode: 'quote', lastItem: it.id, quoteLength: 'this' });
  _mt.temp = null;
  mtRestart();
}

/* ── The result chart ─────────────────────────────────────── */

/**
 * Speed and raw speed per second on one axis (the same unit, so one scale),
 * with each second's mistakes as a cross on the speed line rather than on a
 * second axis. A crosshair and a tooltip read any second exactly.
 */
function mtRenderChart(r) {
  const host = document.getElementById('mt-chart');
  const legend = document.getElementById('mt-legend');
  if (!host) return;
  const S = r.samples || [];
  if (legend) {
    legend.innerHTML = `
      <span class="mt-lg"><i class="mt-lg-line is-wpm"></i>${mtUnitLabel()}</span>
      <span class="mt-lg"><i class="mt-lg-line is-raw"></i>raw</span>
      <span class="mt-lg"><i class="mt-lg-x">×</i>errors</span>`;
  }
  if (S.length < 1) { host.innerHTML = '<div class="mt-chart-empty">Too short to chart.</div>'; return; }
  const W = Math.max(280, host.clientWidth || 600);
  const H = 190;
  const pad = { l: 36, r: 12, t: 10, b: 24 };
  const f = (MT_UNITS[mtConfig().speedUnit] || MT_UNITS.wpm).f;
  const vals = S.map(s => s.wpm * f).concat(S.map(s => s.raw * f));
  const top = Math.max(10, ...vals);
  const step = _mtNiceStep(top / 4);
  const yMax = Math.ceil(top / step) * step;
  const n = S.length;
  const x = (i) => pad.l + (n === 1 ? (W - pad.l - pad.r) / 2 : (i / (n - 1)) * (W - pad.l - pad.r));
  const y = (v) => pad.t + (1 - v / yMax) * (H - pad.t - pad.b);
  const path = (key) => S.map((s, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(s[key] * f).toFixed(1)).join(' ');
  let grid = '';
  for (let v = 0; v <= yMax + 0.001; v += step) {
    grid += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}" class="mt-ch-grid"/>`;
    grid += `<text x="${pad.l - 6}" y="${y(v) + 3.5}" class="mt-ch-tick" text-anchor="end">${Math.round(v)}</text>`;
  }
  const every = Math.max(1, Math.ceil(n / 10));
  let xt = '';
  for (let i = 0; i < n; i += every) {
    xt += `<text x="${x(i)}" y="${H - 6}" class="mt-ch-tick" text-anchor="middle">${S[i].partial ? r.time.toFixed(1) : i + 1}</text>`;
  }
  let errs = '';
  S.forEach((s, i) => {
    if (!s.err) return;
    const cx = x(i), cy = y(s.wpm * f), k = 4 + Math.min(3, s.err - 1);
    errs += `<path d="M${cx - k} ${cy - k}L${cx + k} ${cy + k}M${cx + k} ${cy - k}L${cx - k} ${cy + k}" class="mt-ch-err"/>`;
  });
  const dots = S.length <= 60 ? S.map((s, i) => `<circle cx="${x(i)}" cy="${y(s.wpm * f)}" r="2.5" class="mt-ch-dot"/>`).join('') : '';
  host.innerHTML = `
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" class="mt-ch" role="img" aria-label="Speed and raw speed per second">
      ${grid}${xt}
      <path d="${path('raw')}" class="mt-ch-raw"/>
      <path d="${path('wpm')}" class="mt-ch-wpm"/>
      ${dots}${errs}
      <line class="mt-ch-cross" id="mt-ch-cross" x1="0" x2="0" y1="${pad.t}" y2="${H - pad.b}" visibility="hidden"/>
      <rect x="${pad.l}" y="${pad.t}" width="${W - pad.l - pad.r}" height="${H - pad.t - pad.b}" fill="transparent" id="mt-ch-hit"/>
    </svg>
    <div class="mt-ch-tip" id="mt-ch-tip" hidden></div>`;
  const hit = document.getElementById('mt-ch-hit');
  const cross = document.getElementById('mt-ch-cross');
  const tip = document.getElementById('mt-ch-tip');
  const show = (ev) => {
    const box = hit.getBoundingClientRect();
    const px = ev.clientX - box.left + pad.l;
    const i = Math.max(0, Math.min(n - 1, Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (n - 1))));
    const s = S[i];
    cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i));
    cross.setAttribute('visibility', 'visible');
    tip.hidden = false;
    tip.innerHTML = `<strong>${s.partial ? r.time.toFixed(1) : i + 1}s</strong>
      <span><i class="mt-lg-line is-wpm"></i>${mtUnitLabel()} ${mtSpeed(s.wpm)}</span>
      <span><i class="mt-lg-line is-raw"></i>raw ${mtSpeed(s.raw)}</span>
      <span><i class="mt-lg-x">×</i>errors ${s.err}</span>`;
    const left = Math.min(W - tip.offsetWidth - 4, Math.max(0, x(i) + 10));
    tip.style.transform = `translate(${left}px, 6px)`;
  };
  hit.addEventListener('mousemove', show);
  hit.addEventListener('mouseleave', () => { cross.setAttribute('visibility', 'hidden'); tip.hidden = true; });
}

function _mtNiceStep(raw) {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))));
  const m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}

/* ── Screenshot ───────────────────────────────────────────── */

/** Draws the result onto a canvas — no screenshot library — and saves a PNG. */
function mtSaveScreenshot() {
  const r = _mt && _mt.lastResult;
  if (!r) return;
  const shell = document.getElementById('mt-shell');
  const cs = getComputedStyle(shell);
  const col = (v) => cs.getPropertyValue(v).trim() || '#888';
  const bg = col('--mt-bg'), sub = col('--mt-sub'), text = col('--mt-text'), main = col('--mt-main'), err = col('--mt-error');
  const W = 1000, H = 420, dpr = 2;
  const cv = document.createElement('canvas');
  cv.width = W * dpr; cv.height = H * dpr;
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);
  // a resolved colour for the canvas, even when the theme names a CSS variable
  const probe = document.createElement('span');
  shell.appendChild(probe);
  const resolve = (c) => { probe.style.color = c; return getComputedStyle(probe).color; };
  const BG = resolve(bg), SUB = resolve(sub), TEXT = resolve(text), MAIN = resolve(main), ERR = resolve(err);
  probe.remove();
  g.fillStyle = BG; g.fillRect(0, 0, W, H);
  const font = (size, w) => `${w || 400} ${size}px 'JetBrains Mono', monospace`;
  g.fillStyle = SUB; g.font = font(13); g.fillText('memorization typing', 32, 36);
  g.fillStyle = TEXT; g.font = font(15, 600); g.fillText((r.title || '').slice(0, 60), 32, 58);
  g.fillStyle = SUB; g.font = font(22); g.fillText(mtUnitLabel(), 32, 110);
  g.fillStyle = MAIN; g.font = font(64, 600); g.fillText(mtSpeed(r.wpm), 32, 168);
  g.fillStyle = SUB; g.font = font(22); g.fillText('acc', 32, 212);
  g.fillStyle = MAIN; g.font = font(64, 600); g.fillText(Math.floor(r.acc) + '%', 32, 270);
  // chart
  const S = r.samples || [];
  const cx = 260, cy = 80, cw = 700, ch = 200;
  const f = (MT_UNITS[mtConfig().speedUnit] || MT_UNITS.wpm).f;
  const top = Math.max(10, ...S.map(s => Math.max(s.wpm, s.raw) * f));
  const X = (i) => cx + (S.length <= 1 ? cw / 2 : (i / (S.length - 1)) * cw);
  const Y = (v) => cy + (1 - v / top) * ch;
  g.strokeStyle = SUB; g.globalAlpha = 0.25; g.lineWidth = 1;
  for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(cx, cy + (k / 4) * ch); g.lineTo(cx + cw, cy + (k / 4) * ch); g.stroke(); }
  g.globalAlpha = 1;
  const line = (key, color) => {
    g.strokeStyle = color; g.lineWidth = 2; g.beginPath();
    S.forEach((s, i) => { const px = X(i), py = Y(s[key] * f); if (i) g.lineTo(px, py); else g.moveTo(px, py); });
    g.stroke();
  };
  line('raw', SUB); line('wpm', MAIN);
  g.strokeStyle = ERR; g.lineWidth = 2;
  S.forEach((s, i) => { if (!s.err) return; const px = X(i), py = Y(s.wpm * f); g.beginPath(); g.moveTo(px - 4, py - 4); g.lineTo(px + 4, py + 4); g.moveTo(px + 4, py - 4); g.lineTo(px - 4, py + 4); g.stroke(); });
  // stats row
  const stats = [
    ['test type', (r.mode === 'quote' ? 'full' : r.mode) + (r.mode === 'time' || r.mode === 'words' ? ' ' + r.mode2 : '')],
    ['raw', mtSpeed(r.raw)],
    ['characters', `${r.chars.correct}/${r.chars.incorrect}/${r.chars.extra}/${r.chars.missed}`],
    ['consistency', Math.round(r.consistency) + '%'],
    ['time', Math.round(r.time) + 's']
  ];
  stats.forEach(([k, v], i) => {
    const px = 32 + i * 190;
    g.fillStyle = SUB; g.font = font(14); g.fillText(k, px, 334);
    g.fillStyle = MAIN; g.font = font(26, 600); g.fillText(v, px, 368);
  });
  g.fillStyle = SUB; g.font = font(12);
  g.fillText(new Date(r.date).toLocaleString(), 32, 402);
  cv.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'typing-result-' + new Date(r.date).toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.png';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }, 'image/png');
}
