/* Unit tests for js/freeground.js (no browser): node tools/test-freeground.js
   Kept scratches, closing, shelf categories, the shelf tree and the one-time
   migration. The file shares the app's global scope, so it runs in a vm
   context with the few globals it reaches for stubbed. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let failed = 0, passed = 0;
function ok(cond, name) {
  if (cond) { passed++; return; }
  failed++;
  console.log('FAIL ' + name);
}
function eq(a, b, name) {
  const same = JSON.stringify(a) === JSON.stringify(b);
  if (!same) console.log('  got      ' + JSON.stringify(a) + '\n  expected ' + JSON.stringify(b));
  ok(same, name);
}

const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'freeground.js'), 'utf8');

/** A fresh app: the file loaded into its own context, with a store to start from. */
function app(store) {
  let n = 0;
  const ctx = {
    console,
    state: { freeground: store === undefined ? { tabs: [], activeId: null, ver: 2 } : store },
    undos: [], notes: [], changed: [],
    generateId: () => 'id' + (++n),
    saveData() {},
    toast(msg) { ctx.notes.push(msg); }
  };
  ctx.pushUndo = (label, fn) => ctx.undos.push({ label, fn });
  ctx.fgOnStoreChanged = (id) => ctx.changed.push(id || null);
  vm.createContext(ctx);
  vm.runInContext(SRC + '\n;this.FG_DEFAULT_STARTER = FG_DEFAULT_STARTER; this.FG_OLD_STARTER = FG_OLD_STARTER; this.FG_LIMITS = FG_LIMITS;', ctx);
  return ctx;
}
const names = (c) => c.fgTabs().map(t => t.name);
const tab = (id, name, code, extra) => Object.assign({ id, name, files: [{ id: 'f' + id, name: 'main', ext: '.c', code }], activeFile: 0, lastRun: '', pinned: false, shelved: false, updatedAt: 1 }, extra || {});

/* ── Migration ─────────────────────────────────────────────── */
{
  const c = app({ tabs: [], activeId: null });
  const S = c.FG_DEFAULT_STARTER, O = c.FG_OLD_STARTER;
  c.state.freeground = {
    activeId: 'a',
    tabs: [
      tab('a', 'scratch-1', S),                                  // open, untouched
      tab('b', 'scratch-2', O, { shelved: true }),               // shelved, untouched old starter
      tab('c', 'scratch-3', S, { shelved: true }),               // shelved, untouched new starter
      tab('d', 'scratch-4', 'int main(){ puts("hi"); }', { shelved: true }), // shelved, written
      tab('e', 'mine', 'int x;'),                                // open, written
      tab('d', 'scratch-4', 'int main(){ puts("hi"); }', { shelved: true })  // the same id twice
    ]
  };
  const s = c.fgStore();
  eq(names(c), ['scratch-1', 'scratch-4', 'mine'], 'migrate: untouched shelved dropped, duplicate id dropped');
  eq(c.fgTabs().map(t => !!t.kept), [false, true, true], 'migrate: written tabs kept, untouched open one not');
  ok(Array.isArray(s.cats) && s.ver === 2, 'migrate: cats made and version set');
  // A cloud load of an old document after this page migrated: migrates again.
  c.state.freeground = { activeId: null, tabs: [tab('z', 'old', 'int y;', { shelved: true })] };
  c.fgStore();
  eq(c.fgTabs().map(t => [t.name, t.kept]), [['old', true]], 'migrate: runs again on a store without the version');
  // An already migrated store is left alone: an unkept written tab stays unkept.
  c.state.freeground = { ver: 2, cats: [], activeId: 'q', tabs: [tab('q', 'q', 'int z;', { kept: false })] };
  c.fgStore();
  eq(c.fgTabs()[0].kept, false, 'migrate: never re-run on a migrated store');
}

/* ── New tabs, keep, unkeep ────────────────────────────────── */
{
  const c = app();
  const t = c.fgNewTab({});
  ok(t.kept === false && t.catId === null, 'new tab starts unkept, no category');
  const cat = c.fgNewCat('Arrays', null);
  ok(c.fgKeepTab(t.id, cat.id) && t.kept && t.catId === cat.id, 'keep with a category');
  ok(c.fgKeepTab(t.id, 'nope') && t.catId === null, 'keep with an unknown category: none');
  const d = c.fgDuplicateTab(t.id);
  ok(d.kept === false && d.catId === null, 'a duplicate starts unkept');
  t.shelved = true;
  ok(c.fgUnkeepTab(t.id) && t.kept === false && t.catId === null && t.shelved === false, 'unkeep: back to an open scratch');
}

/* ── Closing ───────────────────────────────────────────────── */
{
  const c = app();
  const a = c.fgNewTab({}), b = c.fgNewTab({}), k = c.fgNewTab({});
  c.fgKeepTab(k.id, null);
  // Close a kept one: it goes on the shelf.
  c.fgCloseTab(k.id);
  ok(k.shelved && c.fgFindTab(k.id), 'close kept: shelved, still there');
  eq(c.undos.length, 0, 'close kept: no undo needed');
  // Close an unkept one: gone, with an Undo that brings it back where it was.
  c.state.freeground.activeId = a.id;
  const next = c.fgCloseTab(a.id);
  ok(!c.fgFindTab(a.id), 'close unkept: removed');
  eq(next, b.id, 'close unkept active: its neighbour takes over');
  eq(c.undos.length, 1, 'close unkept: one undo');
  c.undos[0].fn();
  eq(names(c)[0], a.name, 'undo: back at its place');
  eq(c.changed[c.changed.length - 1], a.id, 'undo: asks the screen to show it');
  c.undos[0].fn();
  eq(c.fgTabs().filter(t => t.id === a.id).length, 1, 'undo twice: still one copy');
}
{
  const c = app();
  const only = c.fgNewTab({});
  c.fgCloseTab(only.id);
  const open = c.fgOpenTabs();
  ok(open.length === 1 && open[0].id !== only.id, 'close the last unkept tab: a fresh one is made');
  c.undos[0].fn();
  eq(c.fgOpenTabs().length, 2, 'undo: the old one is back beside the fresh one');
  eq(new Set(c.fgTabs().map(t => t.name)).size, 2, 'undo: the fresh one did not take the old one\'s name');
}
{
  // At the 60-tab limit, closing the last open (unkept) tab still leaves one open.
  const c = app();
  for (let i = 0; i < c.FG_LIMITS.tabs - 1; i++) { const t = c.fgNewTab({}); c.fgKeepTab(t.id, null); t.shelved = true; }
  const last = c.fgNewTab({});
  eq(c.fgTabs().length, c.FG_LIMITS.tabs, 'limit: full');
  c.state.freeground.activeId = last.id;
  c.fgCloseTab(last.id);
  const open = c.fgOpenTabs();
  ok(open.length === 1 && open[0].id !== last.id, 'limit: closing the last unkept tab still leaves a fresh one');
  eq(c.notes.length, 0, 'limit: no "too many" note on the way');
}
{
  const c = app();
  const keep = c.fgNewTab({}), u1 = c.fgNewTab({}), k1 = c.fgNewTab({}), u2 = c.fgNewTab({}), pin = c.fgNewTab({});
  c.fgKeepTab(k1.id, null);
  c.fgPinTab(pin.id, true);
  c.fgCloseOthers(keep.id);
  eq(c.fgOpenTabs().map(t => t.id), [pin.id, keep.id], 'close others: pinned and the kept-open one stay');
  ok(k1.shelved && c.fgFindTab(k1.id), 'close others: kept one shelved');
  ok(!c.fgFindTab(u1.id) && !c.fgFindTab(u2.id), 'close others: unkept ones removed');
  eq(c.undos.length, 1, 'close others: one undo for all');
  c.undos[0].fn();
  ok(c.fgFindTab(u1.id) && c.fgFindTab(u2.id), 'close others undo: both back');
}

/* ── Categories ────────────────────────────────────────────── */
{
  const c = app();
  eq(c.fgNewCat('   ', null), null, 'category: blank name refused');
  const a = c.fgNewCat('Arrays', null);
  const b = c.fgNewCat('Sorting', a.id);
  const d = c.fgNewCat('Bubble', b.id);
  eq(c.fgCatPath(d.id).map(x => x.name), ['Arrays', 'Sorting', 'Bubble'], 'path root first');
  eq(c.fgCatLabel(d.id), 'Arrays / Sorting / Bubble', 'label');
  eq(c.fgCatLabel(null), '', 'label of none');
  ok(c.fgRenameCat(b.id, 'Sorts') && b.name === 'Sorts', 'rename');
  ok(!c.fgRenameCat(b.id, '  ') && b.name === 'Sorts', 'rename blank refused');
  // Depth: 8 levels at most.
  let p = null;
  const chain = [];
  for (let i = 0; i < 8; i++) { const x = c.fgNewCat('L' + i, p); chain.push(x); p = x && x.id; }
  ok(chain.every(Boolean), 'eight levels allowed');
  eq(c.fgNewCat('L8', p), null, 'a ninth level refused');
  // A cycle (a damaged save) does not hang the walks.
  a.parentId = d.id;
  ok(c.fgCatPath(d.id).length <= c.fgCats().length, 'cycle: path walk stops');
  a.parentId = null;
}
{
  const c = app();
  for (let i = 0; i < 100; i++) c.fgNewCat('c' + i, null);
  eq(c.fgNewCat('one too many', null), null, '100 categories at most');
}
{
  const c = app();
  const a = c.fgNewCat('A', null), b = c.fgNewCat('B', a.id), e = c.fgNewCat('E', b.id);
  const t1 = c.fgNewTab({ name: 'in B' }), t2 = c.fgNewTab({ name: 'in A' });
  c.fgKeepTab(t1.id, b.id); c.fgKeepTab(t2.id, a.id);
  ok(c.fgDeleteCat(b.id), 'delete category');
  ok(!c.fgFindCat(b.id), 'delete: gone');
  eq([e.parentId, t1.catId], [a.id, a.id], 'delete: its subcategory and scratches move up to its parent');
  c.undos[c.undos.length - 1].fn();
  ok(c.fgFindCat(b.id), 'delete undo: back');
  eq([e.parentId, t1.catId], [b.id, b.id], 'delete undo: contents back inside it');
  const top = c.fgNewCat('Top', null), t3 = c.fgNewTab({ name: 'top one' });
  c.fgKeepTab(t3.id, top.id);
  c.fgDeleteCat(top.id);
  eq(t3.catId, null, 'delete a top category: its scratches have no category');
}

/* ── The shelf tree ────────────────────────────────────────── */
{
  const c = app();
  const z = c.fgNewCat('Zeta', null), a = c.fgNewCat('alpha 10', null), a2 = c.fgNewCat('alpha 9', null);
  const sub = c.fgNewCat('Inner', a2.id);
  const mk = (name, cat, at, code) => { const t = c.fgNewTab({ name, files: [{ name: 'main', ext: '.c', code: code || 'int x;' }] }); c.fgKeepTab(t.id, cat); t.updatedAt = at; return t; };
  mk('old', sub.id, 1); mk('new', sub.id, 5); mk('loose', null, 3); mk('zz', z.id, 2, 'needle here');
  c.fgNewTab({ name: 'not kept' });
  const all = new Set([z.id, a.id, a2.id, sub.id]);
  const rows = c.fgShelfRows(all, '');
  eq(rows.map(r => (r.kind === 'cat' ? '#' : '') + (r.kind === 'cat' ? r.cat.name : r.tab.name) + '@' + r.depth),
    ['#alpha 9@0', '#Inner@1', 'new@2', 'old@2', '#alpha 10@0', '#Zeta@0', 'zz@1', 'loose@0'],
    'tree: natural order, newest scratch first, loose ones last, unkept left out');
  eq(rows.filter(r => r.kind === 'cat').map(r => r.count), [2, 2, 0, 1], 'tree: counts include subcategories');
  const folded = c.fgShelfRows(new Set([z.id]), '');
  eq(folded.map(r => r.kind === 'cat' ? r.cat.name + (r.open ? '+' : '-') : r.tab.name),
    ['alpha 9-', 'alpha 10-', 'Zeta+', 'zz', 'loose'], 'tree: a folded category hides what is inside');
  const found = c.fgShelfRows(new Set(), 'NEW');
  eq(found.map(r => [r.tab.name, r.path, r.depth]), [['new', 'alpha 9 / Inner', 0]], 'search: finds inside folded categories, with the path');
  eq(c.fgShelfRows(new Set(), 'needle').map(r => r.tab.name), ['zz'], 'search: matches code too');
}

console.log((failed ? 'FAILED ' + failed + ', ' : '') + passed + ' passed');
process.exit(failed ? 1 : 0);
