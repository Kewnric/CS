/* ============================================================
   FREEGROUND.JS — saved scratch programs: the data, no screen
   ------------------------------------------------------------
   A freeground is a tab: a name, one or more files, and the last run's
   output. It lives in state.freeground (js/train-store.js), so it is saved,
   exported and synced like the library, in a cloud document of its own.

     state.freeground = { tabs: [tab], activeId, cats: [cat], ver: 2 }
     tab = { id, name, lang, files: [{ id, name, ext, code }], activeFile, lastRun,
             pinned, shelved, kept, catId, from, createdAt, updatedAt }
     cat = { id, name, parentId }      a shelf category; parentId null at the top

   LANGUAGES. Each tab has one (FG_LANGS): C (the default, and what a tab
   with no `lang` is), JavaScript, HTML, Assembly (8086, A86-style DOS .COM).
   MySQL is listed as coming soon and never set. The language picks the
   starter, the files' extension, the highlighting and what Run does
   (route-freeground.js fgRun).

   THE SHELF HOLDS WHAT YOU KEPT. Save to shelf marks a tab `kept` (it stays
   open and keeps saving). Closing a kept tab puts it away on the shelf;
   closing one that was never kept discards it, with an Undo. Only the shelf
   deletes a kept one, behind a question and an Undo. Open tabs keep the order
   of the array, pinned ones first.

   CATEGORIES nest (8 levels, 100 in all). Deleting one moves what it held up
   to its parent. Which ones are folded open is the screen's, per device.

   ver 2 is the kept/categories format. A store without it (an old save, or an
   old device's cloud document) is migrated when first read: shelved tabs that
   are still an untouched starter go, everything else was kept before, so it
   stays kept. ver is NOT in the field's empty value (train-store.js), or an old
   document would be stamped as migrated without being migrated.

   The screen is js/routes/route-freeground.js. This file never touches the
   editor, so its rules can be read (and tested) on their own.
   ============================================================ */

const FG_LIMITS = {
  tabs: 60,            // open and shelved together
  files: 12,           // per freeground
  chars: 200000,       // per freeground
  total: 600000,       // every freeground together, so the cloud document fits
  lastRunLines: 200,
  nameMax: 40,
  cats: 100,           // shelf categories, every level together
  catDepth: 8          // levels of categories
};

const FG_DEFAULT_STARTER = '/**\n *    author:\n**/\n#include <stdio.h>\nint main(){\n\t\n\treturn 0;\n}';
/** The default until 2026-11-18. Settings saved a copy of it; that copy still means "the default". */
const FG_OLD_STARTER = '#include <stdio.h>\n\nint main(void) {\n    \n    return 0;\n}\n';

function fgStore() {
  if (!state.freeground || typeof state.freeground !== 'object' || !Array.isArray(state.freeground.tabs)) {
    state.freeground = { tabs: [], activeId: null, cats: [], ver: 2 };
  }
  const s = state.freeground;
  if (s.ver !== 2) _fgMigrate(s);
  return s;
}

/* ── Languages ─────────────────────────────────────────────── */

const FG_LANGS = {
  c: { id: 'c', name: 'C Programming', short: 'C', icon: 'file-code', ext: '.c', main: 'main',
    hint: 'The default. Compiled in your browser, or by GCC online.' },
  js: { id: 'js', name: 'JavaScript', short: 'JS', icon: 'braces', ext: '.js', main: 'main',
    hint: 'Runs in your browser, like Node: console.log prints, prompt() reads a line.' },
  html: { id: 'html', name: 'HTML', short: 'HTML', icon: 'globe', ext: '.html', main: 'index',
    hint: 'A live preview beside the code. Add .css and .js files and link them.' },
  asm: { id: 'asm', name: 'Assembly (8086)', short: 'ASM', icon: 'cpu', ext: '.asm', main: 'main',
    hint: 'A86-style DOS .COM on an 80x25 screen: INT 21h, B800h video memory, keys.' },
  mysql: { id: 'mysql', name: 'MySQL', short: 'SQL', icon: 'database', ext: '.sql', main: 'main', soon: true,
    hint: 'Coming soon.' }
};
const FG_LANG_ORDER = ['c', 'js', 'html', 'asm', 'mysql'];
const FG_LANG_STARTERS = {
  js: '/**\n *    author:\n**/\n\n',
  html: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n'
    + '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Freeground</title>\n'
    + '  <style>\n    body { font-family: system-ui, sans-serif; }\n  </style>\n</head>\n<body>\n  \n</body>\n</html>\n',
  asm: ';    author:\n\t\n\tint 20h\n'
};

/** A tab's language: one FG_LANGS can run, C when it has none. */
function fgLangOf(tab) {
  const l = tab && tab.lang;
  return l && FG_LANGS[l] && !FG_LANGS[l].soon ? l : 'c';
}

/** What a new tab in `lang` opens with. */
function fgLangStarter(lang) {
  return FG_LANG_STARTERS[lang] || fgDefaultStarter();
}

/** A new tab's files in `lang`: one main file holding the starter. */
function fgLangFiles(lang) {
  const L = FG_LANGS[lang] && !FG_LANGS[lang].soon ? FG_LANGS[lang] : FG_LANGS.c;
  return [{ name: L.main, ext: L.ext, code: fgLangStarter(L.id) }];
}

/** Where the caret goes in a starter: C inside main; the others on the first indented blank line, else the end. */
function fgLangCaret(lang, code) {
  const s = String(code == null ? '' : code);
  if (lang === 'c' || !FG_LANG_STARTERS[lang]) return fgStarterCaret(s);
  const m = /^[ \t]+$/m.exec(s);
  return m ? m.index + m[0].length : s.length;
}

/**
 * Change a tab's language. An untouched starter (or an empty tab) gets the
 * new language's starter; code you wrote stays, and the files written in the
 * old language take the new extension.
 * @returns {'starter'|'kept'|'same'|false}
 */
function fgSetTabLang(id, lang) {
  const t = fgFindTab(id);
  const L = FG_LANGS[lang];
  if (!t || !L || L.soon) return false;
  const was = fgLangOf(t);
  if (was === lang) return 'same';
  let how;
  if (_fgIsBlankStarter(t) || !fgTabChars(t)) {
    t.files = fgLangFiles(lang).map(f => ({ id: generateId(), name: f.name, ext: f.ext, code: f.code }));
    t.activeFile = 0;
    t.lastRun = '';
    how = 'starter';
  } else {
    const oldExt = FG_LANGS[was].ext;
    t.files.forEach((f, i) => {
      if (i !== 0 && f.ext !== oldExt) return;
      if (!t.files.some(o => o !== f && o.name === f.name && o.ext === L.ext)) f.ext = L.ext;
    });
    how = 'kept';
  }
  t.lang = lang;
  t.updatedAt = Date.now();
  if (typeof saveData === 'function') saveData();
  return how;
}

/** A tab that is nothing but a starter nobody typed in. */
function _fgIsBlankStarter(t) {
  const files = (t && t.files) || [];
  if (files.length !== 1) return false;
  const code = String(files[0].code || '').replace(/\s+$/, '');
  return [FG_DEFAULT_STARTER, FG_OLD_STARTER, fgDefaultStarter()].concat(Object.values(FG_LANG_STARTERS))
    .some(s => String(s).replace(/\s+$/, '') === code);
}

/* Once per store without ver 2. Not saved here: the next save carries it, and
   until then it is simply done again on the next read. */
function _fgMigrate(s) {
  const seen = new Set();
  s.tabs = s.tabs.filter(t => {
    if (!t || typeof t !== 'object' || !t.id || seen.has(t.id)) return false;
    seen.add(t.id);
    const blank = _fgIsBlankStarter(t);
    if (blank && t.shelved) return false;
    if (typeof t.kept !== 'boolean') t.kept = !blank;
    if (t.catId === undefined) t.catId = null;
    return true;
  });
  if (!Array.isArray(s.cats)) s.cats = [];
  if (s.activeId && !s.tabs.some(t => t.id === s.activeId)) s.activeId = null;
  s.ver = 2;
}

function fgTabs() { return fgStore().tabs; }

function fgFindTab(id) { return id ? (fgTabs().find(t => t.id === id) || null) : null; }

/** Open tabs in strip order: pinned first, otherwise as stored. */
function fgOpenTabs() {
  const open = fgTabs().filter(t => !t.shelved);
  return open.filter(t => t.pinned).concat(open.filter(t => !t.pinned));
}

/** Shelved tabs, most recently used first. */
function fgShelfTabs() {
  return fgTabs().filter(t => t.shelved).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/** The tab on screen, if it is still open. */
function fgActiveTab() {
  const t = fgFindTab(fgStore().activeId);
  return t && !t.shelved ? t : null;
}

function fgTabChars(tab) {
  return ((tab && tab.files) || []).reduce((n, f) => n + String(f.code || '').length, 0);
}

function fgTotalChars() { return fgTabs().reduce((n, t) => n + fgTabChars(t), 0); }

/** The starter a new freeground opens with (Settings may change it later). */
function fgDefaultStarter() {
  const p = state.trainPrefs && state.trainPrefs.fgStarter;
  return typeof p === 'string' && p !== FG_OLD_STARTER ? p : FG_DEFAULT_STARTER;
}

/**
 * Where the caret goes in starter code: the end of the first blank line in
 * main's body, after its indent (line 6 of the default). -1 if there is none.
 */
function fgStarterCaret(code) {
  const s = String(code == null ? '' : code);
  const m = /\bmain\s*\([^)]*\)\s*\{/.exec(s);
  if (!m) return -1;
  let nl = s.indexOf('\n', m.index + m[0].length);
  while (nl !== -1) {
    const end = s.indexOf('\n', nl + 1);
    const line = s.slice(nl + 1, end === -1 ? s.length : end);
    if (/^[ \t]*$/.test(line)) return nl + 1 + line.length;
    if (line.indexOf('}') !== -1) return -1;
    nl = end;
  }
  return -1;
}

/** A name as stored: trimmed, single-spaced, at most 40 characters. '' if blank. */
function fgCleanName(name) {
  return String(name == null ? '' : name).replace(/\s+/g, ' ').trim().slice(0, FG_LIMITS.nameMax).trim();
}

/** scratch-N, one past the highest scratch number in use. */
function fgNextName() {
  let n = 0;
  fgTabs().forEach(t => { const m = /^scratch-(\d+)$/.exec(t.name || ''); if (m) n = Math.max(n, +m[1]); });
  return 'scratch-' + (n + 1);
}

function _fgNote(msg, type) {
  if (typeof toast === 'function') toast(msg, { type: type || 'warning', duration: 3200 });
}

/**
 * Make a freeground and make it the active one.
 * @param {{name?: string, lang?: string, files?: Array<{name?: string, ext?: string, code?: string}>, from?: string}} [opts]
 * @returns {object|null} the tab, or null at a limit (the user is told which)
 */
function fgNewTab(opts) {
  const o = opts || {};
  if (fgTabs().length >= FG_LIMITS.tabs) {
    _fgNote('You have ' + FG_LIMITS.tabs + ' freegrounds, the most there can be. Delete some from the shelf first.');
    return null;
  }
  const lang = fgLangOf({ lang: o.lang });
  const src = Array.isArray(o.files) && o.files.length ? o.files : fgLangFiles(lang);
  const files = src.slice(0, FG_LIMITS.files).map(f => ({
    id: generateId(), name: String(f.name || FG_LANGS[lang].main), ext: f.ext || FG_LANGS[lang].ext, code: String(f.code == null ? '' : f.code)
  }));
  const size = files.reduce((n, f) => n + f.code.length, 0);
  if (size > FG_LIMITS.chars) {
    _fgNote('That is more code than one freeground holds (' + FG_LIMITS.chars.toLocaleString() + ' characters).');
    return null;
  }
  if (fgTotalChars() + size > FG_LIMITS.total) {
    _fgNote('Freeground is full. Delete freegrounds you no longer need from the shelf.');
    return null;
  }
  const now = Date.now();
  const tab = {
    id: generateId(), name: fgCleanName(o.name) || fgNextName(), lang, files, activeFile: 0, lastRun: '',
    pinned: false, shelved: false, kept: false, catId: null, from: o.from || null, createdAt: now, updatedAt: now
  };
  fgTabs().push(tab);
  fgStore().activeId = tab.id;
  if (typeof saveData === 'function') saveData();
  return tab;
}

/** Rename. Returns false (and changes nothing) for a blank name. */
function fgRenameTab(id, name) {
  const t = fgFindTab(id);
  const clean = fgCleanName(name);
  if (!t || !clean) return false;
  if (t.name !== clean) { t.name = clean; t.updatedAt = Date.now(); if (typeof saveData === 'function') saveData(); }
  return true;
}

/**
 * Take tabs out, with one Undo that puts each back where it was (once, however
 * often the Undo runs). A restored scratch-N whose name was taken meanwhile
 * gets the next free one.
 * @param {object[]} list
 * @param {string} label  the Undo's label
 * @param {boolean} [show] the Undo asks the screen to show the first one again
 */
function _fgDiscard(list, label, show) {
  const tabs = fgTabs();
  const gone = list.map(t => ({ t, i: tabs.indexOf(t) })).filter(x => x.i !== -1).sort((a, b) => a.i - b.i);
  for (let k = gone.length - 1; k >= 0; k--) tabs.splice(gone[k].i, 1);
  if (!gone.length || typeof pushUndo !== 'function') return;
  pushUndo(label, () => {
    const now = fgTabs();
    let back = 0;
    gone.forEach(({ t, i }) => {
      if (now.some(x => x.id === t.id)) return;
      if (/^scratch-\d+$/.test(t.name) && now.some(x => x.name === t.name)) t.name = fgNextName();
      t.shelved = false;
      now.splice(Math.min(i, now.length), 0, t);
      back++;
    });
    if (!back) return;
    if (typeof saveData === 'function') saveData();
    if (typeof fgOnStoreChanged === 'function') fgOnStoreChanged(show ? gone[0].t.id : null);
  });
}

/**
 * Close a tab. A kept one goes on the shelf; one never kept is discarded,
 * with an Undo. If it was the active one, its open neighbour takes over; with
 * no open tab left a new one is made first, so the strip is never empty.
 * @returns {string|null} the id that is active now
 */
function fgCloseTab(id) {
  const t = fgFindTab(id);
  const s = fgStore();
  if (!t) return s.activeId;
  const open = fgOpenTabs();
  const at = open.indexOf(t);
  const rest = open.filter(x => x !== t);
  if (s.activeId === id) {
    const next = rest[Math.min(Math.max(at, 0), rest.length - 1)] || null;
    s.activeId = next ? next.id : null;
    // Made before the old one goes, so it does not take the old one's name.
    if (!next && fgTabs().length < FG_LIMITS.tabs) fgNewTab({});
  }
  if (t.kept) {
    t.shelved = true;
    t.pinned = false;
    t.updatedAt = Date.now();
  } else {
    _fgDiscard([t], 'Closed "' + t.name + '" (not on the shelf)', true);
  }
  // At the limit there was no room until the old one went.
  if (!s.activeId || !fgFindTab(s.activeId) || fgFindTab(s.activeId).shelved) fgNewTab({});
  if (typeof saveData === 'function') saveData();
  return s.activeId;
}

/** Take a tab off the shelf and make it the active one. */
function fgReopenTab(id) {
  const t = fgFindTab(id);
  if (!t) return false;
  t.shelved = false;
  fgStore().activeId = id;
  if (typeof saveData === 'function') saveData();
  return true;
}

/** Close every open, unpinned tab except `keepId`: kept ones to the shelf, the rest discarded (one Undo). */
function fgCloseOthers(keepId) {
  const others = fgOpenTabs().filter(t => t.id !== keepId && !t.pinned);
  const now = Date.now();
  others.forEach(t => { if (t.kept) { t.shelved = true; t.updatedAt = now; } });
  const drop = others.filter(t => !t.kept);
  if (drop.length) {
    _fgDiscard(drop, drop.length === 1 ? 'Closed "' + drop[0].name + '" (not on the shelf)'
      : 'Closed ' + drop.length + ' freegrounds not on the shelf');
  }
  fgStore().activeId = keepId;
  if (typeof saveData === 'function') saveData();
  return drop.length;
}

/* ── Keeping and categories ───────────────────────────────── */

/** Mark a tab kept, in category `catId` (null, or one that is gone: no category). */
function fgKeepTab(id, catId) {
  const t = fgFindTab(id);
  if (!t) return false;
  t.kept = true;
  t.catId = catId && fgFindCat(catId) ? catId : null;
  t.updatedAt = Date.now();
  if (typeof saveData === 'function') saveData();
  return true;
}

/** Off the shelf: an ordinary open scratch again, discarded when closed. */
function fgUnkeepTab(id) {
  const t = fgFindTab(id);
  if (!t) return false;
  t.kept = false;
  t.catId = null;
  t.shelved = false;
  if (typeof saveData === 'function') saveData();
  return true;
}

function fgCats() {
  const s = fgStore();
  if (!Array.isArray(s.cats)) s.cats = [];
  return s.cats;
}

function fgFindCat(id) { return id ? (fgCats().find(c => c.id === id) || null) : null; }

/** The category and its parents, top first. Stops at a loop or a missing parent. */
function fgCatPath(id) {
  const out = [];
  const seen = new Set();
  let c = fgFindCat(id);
  while (c && !seen.has(c.id)) {
    seen.add(c.id);
    out.unshift(c);
    c = fgFindCat(c.parentId);
  }
  return out;
}

/** "Arrays / Sorting", or '' for no category. */
function fgCatLabel(id) { return fgCatPath(id).map(c => c.name).join(' / '); }

/** A new category under `parentId` (null: at the top). Null for a blank name or at a limit. */
function fgNewCat(name, parentId) {
  const clean = fgCleanName(name);
  if (!clean) return null;
  if (fgCats().length >= FG_LIMITS.cats) {
    _fgNote('The shelf has ' + FG_LIMITS.cats + ' categories, the most there can be.');
    return null;
  }
  const parent = fgFindCat(parentId);
  if (parent && fgCatPath(parent.id).length >= FG_LIMITS.catDepth) {
    _fgNote('Categories go ' + FG_LIMITS.catDepth + ' levels deep at most.');
    return null;
  }
  const cat = { id: generateId(), name: clean, parentId: parent ? parent.id : null };
  fgCats().push(cat);
  if (typeof saveData === 'function') saveData();
  return cat;
}

function fgRenameCat(id, name) {
  const c = fgFindCat(id);
  const clean = fgCleanName(name);
  if (!c || !clean) return false;
  if (c.name !== clean) { c.name = clean; if (typeof saveData === 'function') saveData(); }
  return true;
}

/** Delete a category. What it held (subcategories and scratches) moves up to its parent. Undo puts it all back. */
function fgDeleteCat(id) {
  const cats = fgCats();
  const i = cats.findIndex(c => c.id === id);
  if (i === -1) return false;
  const cat = cats[i];
  const up = fgFindCat(cat.parentId) ? cat.parentId : null;
  const kidCats = cats.filter(c => c.parentId === id).map(c => c.id);
  const kidTabs = fgTabs().filter(t => t.catId === id).map(t => t.id);
  kidCats.forEach(k => { fgFindCat(k).parentId = up; });
  kidTabs.forEach(k => { fgFindTab(k).catId = up; });
  cats.splice(i, 1);
  if (typeof saveData === 'function') saveData();
  if (typeof pushUndo === 'function') {
    pushUndo('Delete category "' + cat.name + '"', () => {
      if (fgFindCat(id)) return;
      fgCats().splice(Math.min(i, fgCats().length), 0, cat);
      kidCats.forEach(k => { const c = fgFindCat(k); if (c) c.parentId = id; });
      kidTabs.forEach(k => { const t = fgFindTab(k); if (t) t.catId = id; });
      if (typeof saveData === 'function') saveData();
      if (typeof fgOnStoreChanged === 'function') fgOnStoreChanged(null);
    });
  }
  return true;
}

/** Does a tab's name or code contain `q` (already lower case)? */
function fgTabMatches(t, q) {
  return !q || String(t.name || '').toLowerCase().includes(q)
    || (t.files || []).some(f => String(f.code || '').toLowerCase().includes(q));
}

/**
 * The shelf as rows to draw: each category (natural name order), then what is
 * inside it if it is open (subcategories, then its scratches newest first),
 * then the scratches with no category. Only kept tabs.
 * With a search: every kept tab that matches, flat, with its category's path.
 * @param {Set<string>} openSet  ids of the categories folded open
 * @param {string} query
 * @returns {Array<{kind:'cat', cat, depth, count, open} | {kind:'tab', tab, depth, path}>}
 */
function fgShelfRows(openSet, query) {
  const open = openSet instanceof Set ? openSet : new Set(openSet || []);
  const recent = (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0);
  const kept = fgTabs().filter(t => t.kept);
  const q = String(query || '').trim().toLowerCase();
  if (q) {
    return kept.filter(t => fgTabMatches(t, q)).sort(recent)
      .map(t => ({ kind: 'tab', tab: t, depth: 0, path: fgCatLabel(t.catId) }));
  }
  const cats = fgCats();
  const byName = (a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true, sensitivity: 'base' });
  const kids = (pid) => cats.filter(c => (fgFindCat(c.parentId) ? c.parentId : null) === pid).sort(byName);
  const tabsIn = (cid) => kept.filter(t => (fgFindCat(t.catId) ? t.catId : null) === cid).sort(recent);
  const seen = new Set();
  const count = (c, path) => {
    if (path.has(c.id)) return 0;
    path.add(c.id);
    const n = tabsIn(c.id).length + kids(c.id).reduce((s, k) => s + count(k, path), 0);
    path.delete(c.id);
    return n;
  };
  const rows = [];
  const walk = (c, depth) => {
    if (seen.has(c.id)) return;
    seen.add(c.id);
    const isOpen = open.has(c.id);
    rows.push({ kind: 'cat', cat: c, depth, count: count(c, new Set()), open: isOpen });
    if (!isOpen) { kids(c.id).forEach(k => _fgMarkSeen(k, seen, kids)); return; }
    kids(c.id).forEach(k => walk(k, depth + 1));
    tabsIn(c.id).forEach(t => rows.push({ kind: 'tab', tab: t, depth: depth + 1, path: '' }));
  };
  kids(null).forEach(c => walk(c, 0));
  // A loop in a damaged save leaves categories no top one reaches: show them at the top.
  cats.filter(c => !seen.has(c.id)).sort(byName).forEach(c => walk(c, 0));
  tabsIn(null).forEach(t => rows.push({ kind: 'tab', tab: t, depth: 0, path: '' }));
  return rows;
}

/* A folded category's subcategories are reached, just not drawn. */
function _fgMarkSeen(c, seen, kids) {
  if (seen.has(c.id)) return;
  seen.add(c.id);
  kids(c.id).forEach(k => _fgMarkSeen(k, seen, kids));
}

/** Delete for good, with an Undo that puts it back where it was. */
function fgDeleteTab(id) {
  const tabs = fgTabs();
  const i = tabs.findIndex(t => t.id === id);
  if (i === -1) return false;
  const [gone] = tabs.splice(i, 1);
  const s = fgStore();
  if (s.activeId === id) {
    const open = fgOpenTabs();
    s.activeId = open.length ? open[0].id : null;
  }
  if (typeof saveData === 'function') saveData();
  if (typeof pushUndo === 'function') {
    pushUndo('Delete freeground "' + gone.name + '"', () => {
      if (fgFindTab(gone.id)) return;
      fgTabs().splice(Math.min(i, fgTabs().length), 0, gone);
      if (typeof saveData === 'function') saveData();
      if (typeof fgOnStoreChanged === 'function') fgOnStoreChanged();
    });
  }
  return true;
}

/** A copy beside the original, named "<name> copy". */
function fgDuplicateTab(id) {
  const t = fgFindTab(id);
  if (!t) return null;
  return fgNewTab({ name: fgCleanName(t.name + ' copy'), lang: fgLangOf(t), files: t.files.map(f => ({ name: f.name, ext: f.ext, code: f.code })), from: t.from });
}

function fgPinTab(id, on) {
  const t = fgFindTab(id);
  if (!t) return;
  t.pinned = !!on;
  if (typeof saveData === 'function') saveData();
}

/** Move an open tab one place left (-1) or right (+1) among the open tabs of its kind. */
function fgMoveTab(id, delta) {
  const tabs = fgTabs();
  const t = fgFindTab(id);
  if (!t || t.shelved) return;
  const peers = fgOpenTabs().filter(x => !!x.pinned === !!t.pinned);
  const j = peers.indexOf(t) + delta;
  if (j < 0 || j >= peers.length) return;
  const other = peers[j];
  const a = tabs.indexOf(t), b = tabs.indexOf(other);
  tabs[a] = other; tabs[b] = t;
  if (typeof saveData === 'function') saveData();
}
