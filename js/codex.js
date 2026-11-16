/* ============================================================
   CODEX.JS — the C Codex's rules: entries, usage, progress, notes
   ------------------------------------------------------------
   The built-in entries are js/codex-data.js (never stored: they cost no
   storage and improve with the app). Your side is state.codex:
     notes  { entryId: text }     seen  { entryId: 'YYYY-MM-DD' }
   plus the compiler errors, read live from mistakes.js so the two can never
   disagree.

   PROGRESS IS DERIVED, never stored. An entry is
     seen      once you have opened it
     used      when it appears, as code, in a program you have passed or a
               template you have learned (stage 4)
     mastered  when it appears in five or more of them
   Usage is counted once per visit from tokens (so `for` in a comment or
   inside "format" does not count) and kept until the history changes.
   ============================================================ */

let _cdxUsage = null;     // { key, counts: { entryId: [sourceTitle] } }

function codexStore() {
  if (!state.codex || typeof state.codex !== 'object') state.codex = { notes: {}, edits: {}, custom: [], seen: {} };
  ['notes', 'edits', 'seen'].forEach(k => { if (!state.codex[k] || typeof state.codex[k] !== 'object') state.codex[k] = {}; });
  if (!Array.isArray(state.codex.custom)) state.codex.custom = [];
  return state.codex;
}

/** Every entry: the built-ins and the compiler errors, in category order. */
function codexAll() {
  const errs = (typeof MISTAKE_RULES !== 'undefined' ? MISTAKE_RULES : []).map(r => ({
    id: 'err-' + r.code, n: r.label, c: 'errors', s: '', d: r.why, x: r.fix ? 'Fix: ' + r.fix : '',
    k: r.concept ? [r.concept] : [], mistakeCode: r.code
  }));
  return (typeof CODEX_ENTRIES !== 'undefined' ? CODEX_ENTRIES : []).concat(errs);
}

function codexFind(id) { return codexAll().find(e => e.id === id) || null; }

/* Name -> entries. A few names are shared (an operator written two ways). */
function codexByName(name) {
  const n = String(name || '');
  return codexAll().filter(e => e.n === n);
}

/** Mark an entry as opened (its first star). */
function codexMarkSeen(id) {
  const s = codexStore();
  if (s.seen[id]) return;
  s.seen[id] = typeof _revToday === 'function' ? _revToday() : new Date().toISOString().slice(0, 10);
  if (typeof saveData === 'function') saveData();
}

/* Code without its preprocessor lines: only the directive entries look at those. */
function _cdxNoDirectives(code) { return String(code || '').replace(/^[ \t]*#.*$/gm, ''); }

/* Does an entry's matcher need the directive lines? */
function _cdxWantsDirectives(e) { return /^#/.test(e.n); }

/* What counts as using an entry, as a test over a source's tokens. */
function _cdxMatcher(e) {
  if (e.c === 'formats') {
    const pat = e.n === '%.2f' ? /%\.\d+l?f/ : e.n === '%5d' ? /%-?0?\d+d/ : null;
    return (toks) => toks.some(t => t[0] === '"' && (pat ? pat.test(t) : t.indexOf(e.n) !== -1));
  }
  if (e.c === 'escapes') return (toks) => toks.some(t => (t[0] === '"' || t[0] === "'") && t.indexOf(e.n) !== -1);
  if (e.c === 'errors' || /^(array|string|pointer)$/.test(e.n)) return null;
  if (e.n === 'long long') return (toks) => toks.some((t, i) => t === 'long' && toks[i + 1] === 'long');
  if (e.n === '(type)') return (toks) => toks.some((t, i) => t === '(' && /^(int|double|float|char|long)$/.test(toks[i + 1] || '') && toks[i + 2] === ')');
  if (e.n === '?:') return (toks) => toks.indexOf('?') !== -1;
  if (e.n === '[]') return (toks) => toks.indexOf('[') !== -1;
  if (e.n === '()') return null;
  if (e.n === '#include' || e.n === '#define' || e.n === '#ifndef' || e.n === '#if') {
    const word = e.n.slice(1);
    return (toks) => toks.some((t, i) => t === '#' && toks[i + 1] === word);
  }
  return (toks) => toks.indexOf(e.n) !== -1;
}

/* The code that counts: programs you passed, templates you learned. */
function _cdxSources() {
  const out = [];
  (state.challenges || []).forEach(c => {
    if (typeof programPassed !== 'function' || !programPassed(c.id)) return;
    const v = (c.variants || [])[0];
    const files = v ? (v.files && v.files.length ? v.files : [{ code: v.code }]) : [];
    out.push({ title: c.title, code: files.map(f => f.code || '').join('\n') });
  });
  (state.templates || []).forEach(t => {
    if (typeof tplStatus === 'function' && tplStatus(t.id).stage >= 4) out.push({ title: t.title, code: tplCanonical(t) });
  });
  return out;
}

/** entryId -> the titles of programs and templates that use it. */
function codexUsage() {
  const key = (state.history || []).length + ':' + (state.templateHistory || []).length + ':' + (state.challenges || []).length + ':' + (state.templates || []).length;
  if (_cdxUsage && _cdxUsage.key === key) return _cdxUsage.counts;
  const counts = {};
  const sources = _cdxSources().map(s => ({ title: s.title, toks: tplTokens(s.code), plain: tplTokens(_cdxNoDirectives(s.code)) }));
  codexAll().forEach(e => {
    const m = _cdxMatcher(e);
    if (!m) return;
    const pp = _cdxWantsDirectives(e);
    const hits = sources.filter(s => m(pp ? s.toks : s.plain)).map(s => s.title);
    if (hits.length) counts[e.id] = hits;
  });
  _cdxUsage = { key, counts };
  return counts;
}

/** 0 not opened, 1 seen, 2 used, 3 mastered. */
function codexStars(id) {
  const used = (codexUsage()[id] || []).length;
  if (used >= 5) return 3;
  if (used >= 1) return 2;
  return codexStore().seen[id] ? 1 : 0;
}

function codexStarsHTML(id) {
  const n = codexStars(id);
  const word = ['Not opened yet', 'Seen', 'Used in your code', 'Mastered: used in five or more'][n];
  return `<span class="cdx-stars" title="${word}" aria-label="${word}">${[1, 2, 3].map(i => `<span class="${i <= n ? 'is-on' : ''}">★</span>`).join('')}</span>`;
}

function codexSetNote(id, text) {
  const s = codexStore();
  const t = String(text || '');
  if (t.trim()) s.notes[id] = t; else delete s.notes[id];
  if (typeof saveData === 'function') saveData();
}

/** The example as a whole runnable program, or '' when there is none. */
function codexProgram(e) {
  return e && e.ex ? codexWrap(e.ex) : '';
}

/**
 * Put an entry on a cheat sheet called "C Codex notes" (made the first time):
 * its summary as a note and its example as a code block, on the first page.
 */
function codexToCheatSheet(id) {
  const e = codexFind(id);
  if (!e || typeof cs === 'undefined' || typeof csCreate !== 'function') return false;
  if (typeof csLoad === 'function' && !cs.sheets.length) csLoad();
  let sheet = cs.sheets.find(s => s.title === 'C Codex notes');
  if (!sheet) sheet = csCreate('C Codex notes');
  const page = sheet.pages[0] || (sheet.pages[0] = csNewPage('Page 1'));
  const note = csNewBlock('callout');
  note.kind = 'note';
  note.text = e.n + (e.h ? ' (' + e.h + ')' : '') + ': ' + e.d + (codexStore().notes[id] ? '\n' + codexStore().notes[id] : '');
  page.blocks.push(note);
  if (e.ex) {
    const code = csNewBlock('code');
    code.code = e.ex;
    code.caption = e.s || e.n;
    page.blocks.push(code);
  }
  sheet.updatedAt = Date.now();
  csSave();
  return true;
}

/** Text search over names, signatures and descriptions; names first. */
function codexSearch(q) {
  const s = String(q || '').trim().toLowerCase();
  if (!s) return [];
  const all = codexAll();
  const exact = all.filter(e => e.n.toLowerCase() === s);
  const starts = all.filter(e => exact.indexOf(e) === -1 && e.n.toLowerCase().startsWith(s));
  const rest = all.filter(e => exact.indexOf(e) === -1 && starts.indexOf(e) === -1
    && ((e.s || '').toLowerCase().includes(s) || e.d.toLowerCase().includes(s) || (e.h || '').toLowerCase().includes(s)));
  return exact.concat(starts, rest);
}
