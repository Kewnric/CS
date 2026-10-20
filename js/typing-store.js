/* ============================================================
   TYPING-STORE.JS — data for the Memorization Typing Library
   ------------------------------------------------------------
   Entries live in state.typeItems and results in state.typeHistory, saved
   and synced with everything else. Entries are only written from the
   library's Admin page; the library and the attempt screen read them.

   An entry: { id, title, kind: 'text'|'code', lang: 'c'|'html'|'css'|'js',
               content, tags[], notes, createdAt, updatedAt }

   The typing screen's own preferences (mode, caret, theme, sounds…) are a
   per-device setting, like every other ssp.* preference, so they live in
   localStorage under ssp.typeConfig rather than in the synced save.
   ============================================================ */

function mtStore() {
  if (!Array.isArray(state.typeItems)) state.typeItems = [];
  if (!Array.isArray(state.typeHistory)) state.typeHistory = [];
}

function mtItems() { mtStore(); return state.typeItems; }
function mtFindItem(id) { return id ? (mtItems().find(x => x.id === id) || null) : null; }

function mtBlankItem(kind) {
  return {
    id: generateId(), title: '', kind: kind === 'code' ? 'code' : 'text', lang: 'c',
    content: '', tags: [], notes: '', createdAt: Date.now(), updatedAt: Date.now()
  };
}

function mtNormItem(it) {
  const out = Object.assign(mtBlankItem(), it || {});
  out.kind = out.kind === 'code' ? 'code' : 'text';
  if (!MT_LANGS.some(l => l.key === out.lang)) out.lang = 'c';
  out.tags = Array.isArray(out.tags) ? out.tags.filter(Boolean) : [];
  out.content = String(out.content || '');
  out.title = String(out.title || '');
  return out;
}

/** Saves a draft. Returns the saved entry, or null when there is nothing to type. */
function mtSaveItem(draft) {
  mtStore();
  const it = mtNormItem(draft);
  if (!mtCleanContent(it.content, it.kind).trim()) return null;
  if (!it.title.trim()) {
    const first = mtCleanContent(it.content, it.kind).split('\n')[0].trim();
    it.title = first.length > 48 ? first.slice(0, 45) + '…' : first;
  }
  it.updatedAt = Date.now();
  const i = state.typeItems.findIndex(x => x.id === it.id);
  if (i > -1) state.typeItems[i] = it;
  else state.typeItems.push(it);
  saveData();
  return it;
}

/**
 * Turn a Text entry into a Code one. Code pasted into a Text entry types as
 * prose — no colours, no indentation, no auto close — and the only way the
 * library could tell you was a count of 0 under the language you meant.
 */
function mtConvertToCode(id, lang) {
  const it = mtFindItem(id);
  if (!it) return null;
  it.kind = 'code';
  it.lang = MT_LANGS.some(l => l.key === lang) ? lang : 'c';
  it.updatedAt = Date.now();
  saveData();
  return it;
}

/** Text entries whose content looks like code, optionally of one language. */
function mtMisfiled(lang) {
  return mtItems().filter(it => {
    if (it.kind !== 'text') return false;
    const g = mtGuessLang(it.content);
    return g && (!lang || g === lang);
  });
}

function mtDeleteItem(id, after) {
  mtStore();
  const i = state.typeItems.findIndex(x => x.id === id);
  if (i === -1) return;
  const rec = state.typeItems[i];
  // a deadline belongs to its entry, the way it does to a program
  const deadline = typeof agDetachDeadline === 'function' ? agDetachDeadline('typing', id) : null;
  state.typeItems.splice(i, 1);
  saveData();
  if (after) after();
  if (typeof pushUndo === 'function') {
    pushUndo('Deleted "' + (rec.title || 'Untitled') + '"', () => {
      mtStore();
      state.typeItems.splice(Math.min(i, state.typeItems.length), 0, rec);
      if (deadline && typeof agAttachDeadline === 'function') agAttachDeadline(deadline);
      saveData();
      if (after) after();
    });
  }
}

/* ── Text preparation ─────────────────────────────────────── */

/** Tabs to spaces, to the next four-column stop. */
function _mtExpandTabs(line) {
  if (line.indexOf('\t') === -1) return line;
  let out = '';
  for (const c of line) {
    if (c === '\t') out += ' '.repeat(4 - (out.length % 4));
    else out += c;
  }
  return out;
}

/**
 * What actually gets typed. Curly quotes, dashes and ellipses become their
 * keyboard versions (nobody memorises the typographer's version of a quote),
 * trailing spaces go, and code keeps its indentation with tabs expanded.
 * Prose keeps its line breaks but loses blank lines between paragraphs.
 */
function mtCleanContent(raw, kind) {
  let s = String(raw || '').replace(/\r\n?/g, '\n')
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/…/g, '...')
    .replace(/[   ]/g, ' ')
    .replace(/[​﻿]/g, '');
  if (kind === 'code') {
    s = s.split('\n').map(l => _mtExpandTabs(l).replace(/\s+$/, '')).join('\n');
    s = s.replace(/^\n+/, '').replace(/\n+$/, '');
  } else {
    s = s.replace(/\t/g, ' ').split('\n').map(l => l.replace(/ {2,}/g, ' ').trim()).filter(Boolean).join('\n');
  }
  return s;
}

function mtItemSize(it) {
  const s = mtCleanContent(it.content, it.kind);
  return {
    chars: s.length,
    words: s.split(/\s+/).filter(Boolean).length,
    lines: s ? s.split('\n').length : 0
  };
}

/* The four lengths a "full" test can draw from, by characters. */
const MT_LENGTHS = [
  { key: 'short',  name: 'short',  max: 150 },
  { key: 'medium', name: 'medium', max: 500 },
  { key: 'long',   name: 'long',   max: 1500 },
  { key: 'thicc',  name: 'thicc',  max: Infinity }
];

function mtLengthGroup(it) {
  const n = mtItemSize(it).chars;
  return (MT_LENGTHS.find(g => n <= g.max) || MT_LENGTHS[3]).key;
}

/* ── Results ──────────────────────────────────────────────── */

const MT_HISTORY_CAP = 3000;

/** One key per kind of test, so a personal best compares like with like. */
function mtPbKey(r) {
  const extras = r.kind === 'text' ? ((r.punctuation ? 'p' : '') + (r.numbers ? 'n' : '')) : '';
  return [r.itemId || 'custom', r.mode, r.mode2, extras].join('|');
}

function mtHistory() { mtStore(); return state.typeHistory; }

function mtResultsFor(itemId) {
  return mtHistory().filter(r => r.itemId === itemId);
}

function mtBestFor(itemId) {
  let best = null;
  mtResultsFor(itemId).forEach(r => { if (!best || r.wpm > best.wpm) best = r; });
  return best;
}

function mtPersonalBest(key) {
  let best = null;
  mtHistory().forEach(r => { if (mtPbKey(r) === key && (!best || r.wpm > best.wpm)) best = r; });
  return best;
}

function mtAverageFor(key, n) {
  const list = mtHistory().filter(r => mtPbKey(r) === key).slice(-(n || 10));
  if (!list.length) return 0;
  return list.reduce((a, r) => a + r.wpm, 0) / list.length;
}

function mtLastFor(key) {
  const list = mtHistory().filter(r => mtPbKey(r) === key);
  return list.length ? list[list.length - 1] : null;
}

function mtRecordResult(r) {
  mtStore();
  state.typeHistory.push(r);
  if (state.typeHistory.length > MT_HISTORY_CAP) state.typeHistory.splice(0, state.typeHistory.length - MT_HISTORY_CAP);
  saveData();
}

/* ── The typing screen's preferences ──────────────────────── */

const MT_CONFIG_KEY = 'ssp.typeConfig';

const MT_CONFIG_DEFAULTS = {
  // test
  mode: 'quote', time: 30, words: 25, lines: 10, quoteLength: 'this',
  punctuation: true, numbers: true,
  lastItem: null,
  // code
  autoIndent: true, autoClose: true, syntaxColors: true, codeLines: 12,
  // behaviour
  difficulty: 'normal', quickRestart: 'off', blindMode: false, freedomMode: false,
  strictSpace: false, stopOnError: 'off', confidenceMode: 'off', indicateTypos: 'off',
  lazyMode: false, minWpm: 0, minAcc: 0,
  // caret
  caretStyle: 'line', smoothCaret: 'medium', paceCaret: 'off', paceCaretWpm: 100, paceCaretStyle: 'line',
  // sound
  soundOnClick: 'off', soundOnError: 'off', soundVolume: 0.5,
  // appearance
  fontSize: 2, fontFamily: 'jetbrains', liveSpeed: 'off', liveAcc: 'off', liveBurst: 'off',
  timerStyle: 'mini', speedUnit: 'wpm', tapeMode: 'off', flipColors: false, colorfulMode: false,
  // prose lines on screen (0 = all of it), and how wide it runs (0 = the full width)
  textLines: 5, pageWidth: 0,
  smoothLineScroll: true, focusMode: true, outOfFocusWarning: true,
  capsLockWarning: true, keyTips: true, alwaysShowDecimals: false, showNewlines: true,
  // theme & fun
  theme: 'graphite', funbox: [],
  // custom text
  customText: 'Paste or type any text here, then press apply. Switch it to code to practise a snippet with its own highlighting.',
  customKind: 'text', customLang: 'c', customShuffle: false, customNewlines: 'keep'
};

let _mtConfigCache = null;

function mtConfig() {
  if (_mtConfigCache) return _mtConfigCache;
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(MT_CONFIG_KEY)) || {}; } catch (e) { saved = {}; }
  _mtConfigCache = Object.assign({}, MT_CONFIG_DEFAULTS, saved);
  if (!Array.isArray(_mtConfigCache.funbox)) _mtConfigCache.funbox = [];
  // "show all lines" was an on/off switch before the line count could be chosen
  if (saved.showAllLines && saved.textLines === undefined) _mtConfigCache.textLines = 0;
  delete _mtConfigCache.showAllLines;
  return _mtConfigCache;
}

function mtSetConfig(patch) {
  const cfg = mtConfig();
  Object.assign(cfg, patch);
  try { localStorage.setItem(MT_CONFIG_KEY, JSON.stringify(cfg)); } catch (e) { /* private mode */ }
  return cfg;
}

function mtResetConfig() {
  const keep = { lastItem: mtConfig().lastItem, customText: mtConfig().customText };
  _mtConfigCache = Object.assign({}, MT_CONFIG_DEFAULTS, keep);
  try { localStorage.setItem(MT_CONFIG_KEY, JSON.stringify(_mtConfigCache)); } catch (e) { /* private mode */ }
  return _mtConfigCache;
}

/* ── Speed units ──────────────────────────────────────────── */

const MT_UNITS = {
  wpm: { label: 'wpm', f: 1 },
  cpm: { label: 'cpm', f: 5 },
  wps: { label: 'wps', f: 1 / 60 },
  wph: { label: 'wph', f: 60 }
};

/** A speed in the chosen unit, rounded the way the settings ask. */
function mtSpeed(wpm, decimals) {
  const cfg = mtConfig();
  const u = MT_UNITS[cfg.speedUnit] || MT_UNITS.wpm;
  const v = (wpm || 0) * u.f;
  const d = decimals !== undefined ? decimals : (cfg.alwaysShowDecimals || u === MT_UNITS.wps ? 2 : 0);
  return d ? v.toFixed(d) : String(Math.round(v));
}

function mtUnitLabel() {
  return (MT_UNITS[mtConfig().speedUnit] || MT_UNITS.wpm).label;
}
