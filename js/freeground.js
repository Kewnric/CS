/* ============================================================
   FREEGROUND.JS — saved scratch programs: the data, no screen
   ------------------------------------------------------------
   A freeground is a tab: a name, one or more files, and the last run's
   output. It lives in state.freeground (js/train-store.js), so it is saved,
   exported and synced like the library, in a cloud document of its own.

     state.freeground = { tabs: [tab], activeId }
     tab = { id, name, files: [{ id, name, ext, code }], activeFile, lastRun,
             pinned, shelved, from, createdAt, updatedAt }

   CLOSING IS NOT DELETING. Closing a tab puts it on the shelf; only the shelf
   can delete one, behind a question and an Undo. Open tabs keep the order of
   the array, pinned ones first.

   The screen is js/routes/route-freeground.js. This file never touches the
   editor, so its rules can be read (and tested) on their own.
   ============================================================ */

const FG_LIMITS = {
  tabs: 60,            // open and shelved together
  files: 12,           // per freeground
  chars: 200000,       // per freeground
  total: 600000,       // every freeground together, so the cloud document fits
  lastRunLines: 200,
  nameMax: 40
};

const FG_DEFAULT_STARTER = '/**\n *    author:\n**/\n#include <stdio.h>\nint main(){\n\t\n\treturn 0;\n}';
/** The default until 2026-11-18. Settings saved a copy of it; that copy still means "the default". */
const FG_OLD_STARTER = '#include <stdio.h>\n\nint main(void) {\n    \n    return 0;\n}\n';

function fgStore() {
  if (!state.freeground || typeof state.freeground !== 'object' || !Array.isArray(state.freeground.tabs)) {
    state.freeground = { tabs: [], activeId: null };
  }
  return state.freeground;
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
 * @param {{name?: string, files?: Array<{name?: string, ext?: string, code?: string}>, from?: string}} [opts]
 * @returns {object|null} the tab, or null at a limit (the user is told which)
 */
function fgNewTab(opts) {
  const o = opts || {};
  if (fgTabs().length >= FG_LIMITS.tabs) {
    _fgNote('You have ' + FG_LIMITS.tabs + ' freegrounds, the most there can be. Delete some from the shelf first.');
    return null;
  }
  const src = Array.isArray(o.files) && o.files.length ? o.files : [{ name: 'main', ext: '.c', code: fgDefaultStarter() }];
  const files = src.slice(0, FG_LIMITS.files).map(f => ({
    id: generateId(), name: String(f.name || 'main'), ext: f.ext || '.c', code: String(f.code == null ? '' : f.code)
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
    id: generateId(), name: fgCleanName(o.name) || fgNextName(), files, activeFile: 0, lastRun: '',
    pinned: false, shelved: false, from: o.from || null, createdAt: now, updatedAt: now
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
 * Put a tab on the shelf. If it was the active one, its open neighbour takes
 * over; with no open tab left a new one is made, so the strip is never empty.
 * @returns {string|null} the id that is active now
 */
function fgCloseTab(id) {
  const t = fgFindTab(id);
  if (!t) return fgStore().activeId;
  const open = fgOpenTabs();
  const at = open.indexOf(t);
  t.shelved = true;
  t.pinned = false;
  t.updatedAt = Date.now();
  const s = fgStore();
  if (s.activeId === id) {
    const rest = fgOpenTabs();
    const next = rest[Math.min(Math.max(at, 0), rest.length - 1)] || null;
    s.activeId = next ? next.id : null;
    if (!next) fgNewTab({});
  }
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

/** Shelve every open, unpinned tab except `keepId`. */
function fgCloseOthers(keepId) {
  fgOpenTabs().forEach(t => { if (t.id !== keepId && !t.pinned) { t.shelved = true; t.updatedAt = Date.now(); } });
  fgStore().activeId = keepId;
  if (typeof saveData === 'function') saveData();
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
  return fgNewTab({ name: fgCleanName(t.name + ' copy'), files: t.files.map(f => ({ name: f.name, ext: f.ext, code: f.code })), from: t.from });
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
