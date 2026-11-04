/* ============================================================
   TEST-CVM.JS — the stack window's interpreter against the starter pack
   ------------------------------------------------------------
   Run from the repo root:   node tools/test-cvm.js [filter]

   The stack window is only worth having if what it draws is what the program
   really does. So every reference solution in the starter pack is run through
   js/cvm-*.js with every one of its tests' input, and what it prints is
   compared with the expected output -- the same output gcc produced when the
   tests were written (tools/verify-pack.js checks that side).

   Then a handful of snapshot checks: that a cursor line gives the memory the
   program has at that point, with the values and frames it should have.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const CVM = require(path.join(ROOT, 'js', 'cvm-parse.js'));
require(path.join(ROOT, 'js', 'cvm-run.js'));
try { require(path.join(ROOT, 'js', 'cvm-view.js')); } catch (e) { if (!/Cannot find module/.test(e.message)) throw e; }
const filter = process.argv[2] || '';

const files = [
  'js/utils.js', 'js/coding-starter-solutions.js', 'js/coding-starter-core-solutions.js',
  'js/coding-starter-ptr-solutions.js', 'js/coding-starter-arr-solutions.js', 'js/coding-starter-loop-solutions.js',
  'js/coding-starter-workshop-files.js', 'js/coding-starter.js', 'js/coding-starter-core.js', 'js/coding-starter-ptr.js',
  'js/coding-starter-arr.js', 'js/coding-starter-loop.js', 'js/coding-starter-workshop.js', 'js/coding-starter-c.js',
  'js/coding-starter-advanced-solutions.js', 'js/coding-starter-advanced.js', 'js/coding-starter-lists-expected.js',
  'js/coding-starter-lists.js'
];
const sandbox = {
  console, state: { challenges: [], nodes: [], codingSets: [] },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] },
  saveData: () => {}, toast: () => {}, renderBrowse: () => {}, invalidateBrowseCache: () => {},
  clearSessionParam: () => {}, escapeHTML: s => String(s), generateId: () => 'id' + Math.random()
};
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of files) {
  const p = path.join(ROOT, f);
  if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), sandbox, { filename: f });
}
const pack = vm.runInContext('codingStarterPack()', sandbox);
const norm = (x) => String(x == null ? '' : x).replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').replace(/\s+$/, '');

let progs = 0, ran = 0, passed = 0;
const failures = [];
const t0 = Date.now();
for (const ch of pack.challenges) {
  if (filter && ch.id.indexOf(filter) === -1 && ch.title.indexOf(filter) === -1) continue;
  const v = (ch.variants || [])[0];
  if (!v || !(v.tests || []).length) continue;
  const srcFiles = (v.files || []).filter(f => (f.code || '').trim()).map(f => ({ name: (f.name || 'main') + (f.ext || '.c'), code: f.code }));
  if (!srcFiles.length) continue;
  progs++;
  let prog;
  try { prog = CVM.parseProgram(srcFiles); }
  catch (e) {
    failures.push({ prog: ch.title, id: ch.id, stage: 'parse', detail: e.message + (e.loc ? ' @line ' + e.loc.l : '') });
    continue;
  }
  for (const t of v.tests) {
    ran++;
    let r;
    try { r = CVM.runProgram(prog, { stdin: t.stdin || '', maxSteps: 5000000 }); }
    catch (e) { failures.push({ prog: ch.title, id: ch.id, test: t.name, stage: 'crash', detail: e.stack.split('\n').slice(0, 3).join(' | ') }); continue; }
    if (r.error) {
      failures.push({ prog: ch.title, id: ch.id, test: t.name, stage: 'run', detail: r.error.message + (r.error.loc ? ' @line ' + r.error.loc.l : '') });
      continue;
    }
    const got = norm(r.stdout), want = norm(t.expected);
    if (got === want) passed++;
    else {
      let k = 0;
      while (k < got.length && got[k] === want[k]) k++;
      failures.push({ prog: ch.title, id: ch.id, test: t.name, stage: 'output', at: k,
        want: JSON.stringify(want.slice(Math.max(0, k - 30), k + 50)), got: JSON.stringify(got.slice(Math.max(0, k - 30), k + 50)) });
    }
  }
}

/* ── Snapshots: memory at the cursor ── */
const snapFails = [];
let snapRan = 0;
function snapCase(name, code, cursorAfter, check, stdin) {
  if (!CVM.targetAt) return;
  snapRan++;
  const files = [{ name: 'main.c', code: code }];
  let prog;
  try { prog = CVM.parseProgram(files); } catch (e) { snapFails.push(name + ': parse: ' + e.message); return; }
  const off = code.indexOf(cursorAfter) + cursorAfter.length;
  const target = CVM.targetAt(prog, 0, off);
  const r = CVM.runProgram(prog, { stdin: stdin || '', target: target && target.target });
  const snap = r.snaps.length ? r.snaps[r.snaps.length - 1] : r.end;
  let view;
  try { view = CVM.describe(snap, prog); } catch (e) { snapFails.push(name + ': describe: ' + e.stack); return; }
  try {
    const msg = check(view, r, target);
    if (msg) snapFails.push(name + ': ' + msg);
  } catch (e) { snapFails.push(name + ': ' + e.stack); }
}
const find = (nodes, name) => nodes.find(n => n.name === name);

snapCase('struct person, after age',
  '#include <stdio.h>\n#include <string.h>\nstruct Person { char name[50]; int age; char address[50]; };\n'
  + 'int main(void) {\n  struct Person you;\n  strcpy(you.name, "Ken");\n  you.age = 21;\n  int nums[5] = {4, 8, 15};\n  return 0;\n}\n',
  'you.age = 21;',
  (v) => {
    const f = v.frames[0];
    if (!f || f.fn !== 'main') return 'expected main frame, got ' + (f && f.fn);
    const you = find(f.vars, 'you');
    if (!you) return 'no you';
    const age = you.children.find(c => c.name === 'age');
    if (!age || age.value !== '21' || !age.changed) return 'age wrong: ' + JSON.stringify(age && { value: age.value, changed: age.changed });
    const name = you.children.find(c => c.name === 'name');
    if (name.cells.slice(0, 4).map(c => c.value).join(',') !== "'K','e','n',\\0") return 'name cells: ' + name.cells.slice(0, 5).map(c => c.value).join(',');
    if (find(f.vars, 'nums')) return 'nums should not exist yet';
    return null;
  });

snapCase('list in a called function',
  '#include <stdio.h>\n#define MAX 10\ntypedef struct { int elem[MAX]; int count; } List;\n'
  + 'void initList(List *L) {\n  L->count = 0;\n}\n'
  + 'void insertLast(List *L, int x) {\n  L->elem[L->count] = x;\n  L->count++;\n}\n'
  + 'int main(void) {\n  List L;\n  initList(&L);\n  insertLast(&L, 7);\n  insertLast(&L, 9);\n  return 0;\n}\n',
  'L->count++;',
  (v, r) => {
    if (r.passes !== 2) return 'expected 2 passes, got ' + r.passes;
    if (v.frames.length !== 2 || v.frames[0].fn !== 'insertLast' || v.frames[1].fn !== 'main') return 'frames: ' + v.frames.map(f => f.fn).join(',');
    const L = find(v.frames[1].vars, 'L');
    const count = L.children.find(c => c.name === 'count');
    if (count.value !== '2') return 'count ' + count.value;
    const elem = L.children.find(c => c.name === 'elem');
    if (elem.cells[0].value !== '7' || elem.cells[1].value !== '9' || elem.cells[2].value !== '?') return 'elem ' + elem.cells.slice(0, 3).map(c => c.value);
    if (elem.lastLabel !== 'MAX-1') return 'last label ' + elem.lastLabel;
    const p = find(v.frames[0].vars, 'L');
    if (!p || p.kind !== 'ptr' || p.target !== L.addr) return 'param L should point at main L';
    return null;
  });

snapCase('linked list on the heap',
  '#include <stdio.h>\n#include <stdlib.h>\ntypedef struct node { int data; struct node *link; } *LIST;\n'
  + 'int main(void) {\n  LIST head = NULL;\n  for (int i = 3; i > 0; i--) {\n    LIST n = malloc(sizeof(struct node));\n    n->data = i;\n    n->link = head;\n    head = n;\n  }\n  return 0;\n}\n',
  '  return 0;',
  (v) => {
    if (v.heap.length !== 3) return 'heap blocks ' + v.heap.length;
    const head = find(v.frames[0].vars, 'head');
    if (head.target !== v.heap[0].addr) return 'head should point at the first block drawn';
    const d = v.heap.map(h => h.node.children.find(c => c.name === 'data').value).join(',');
    if (d !== '1,2,3') return 'order ' + d;
    return null;
  });

snapCase('end of a one-line loop body is inside the loop',
  'int main(void) {\n  int a[5] = {0};\n  for (int i = 0; i < 5; i++)\n    a[i] = i * i;\n  return 0;\n}\n',
  'a[i] = i * i;',
  (v, r) => {
    if (r.passes !== 5) return 'expected 5 passes, got ' + r.passes;
    const a = find(v.frames[0].vars, 'a');
    return a.cells.map(c => c.value).join(',') === '0,1,4,9,16' ? null : 'a ' + a.cells.map(c => c.value);
  });

snapCase('start of a function',
  'int sq(int x) {\n  int y = x * x;\n  return y;\n}\nint main(void) {\n  int r = sq(4);\n  return r;\n}\n',
  'int sq(int x) {',
  (v, r, t) => {
    if (!t || !t.entering) return 'expected the entry of sq';
    const f = v.frames[0];
    if (f.fn !== 'sq' || find(f.vars, 'x').value !== '4' || find(f.vars, 'y')) return 'sq frame wrong: ' + JSON.stringify(f.vars.map(x => x.name + '=' + x.value));
    return null;
  });

snapCase('index past the end stops',
  'int main(void) {\n  int a[3];\n  for (int i = 0; i <= 3; i++) a[i] = i;\n  return 0;\n}\n',
  'return 0;',
  (v, r) => {
    if (!r.error || !/outside the array/.test(r.error.message)) return 'expected an out-of-bounds error, got ' + (r.error && r.error.message);
    const ev = CVM.describe(r.errorSnap, null);
    const a = ev.frames[0] && find(ev.frames[0].vars, 'a');
    const i = ev.frames[0] && find(ev.frames[0].vars, 'i');
    return a && i && i.value === '3' ? null : 'where it stopped should still show a and i=3: ' + JSON.stringify(ev.frames.map(f => f.vars.map(x => x.name + '=' + x.value)));
  });

snapCase('end of the program keeps the variables of main',
  'int helper(int x) {\n  return x + 1;\n}\nint main(void) {\n  int y = 2;\n  return 0;\n}\n',
  'return x + 1;',
  (v, r) => {
    if (r.snaps.length) return 'helper never runs, so there should be no passes';
    const y = find(r.end && CVM.describe(r.end, null).frames[0].vars || [], 'y');
    return y && y.value === '2' ? null : 'y missing from the end of the program';
  });

snapCase('scanf from input',
  '#include <stdio.h>\nint main(void) {\n  int n;\n  scanf("%d", &n);\n  int sq = n * n;\n  return 0;\n}\n',
  'int sq = n * n;',
  (v) => { const sq = find(v.frames[0].vars, 'sq'); return sq && sq.value === '49' ? null : 'sq ' + (sq && sq.value); }, '7\n');

const res = {
  programs: progs, testsRun: ran, testsPassed: passed, testsFailed: ran - passed,
  ms: Date.now() - t0,
  snapshots: { ran: snapRan, failed: snapFails.length, detail: snapFails },
  failures: failures.slice(0, 40)
};
console.log(JSON.stringify(res, null, 2));
process.exitCode = (ran - passed) || snapFails.length ? 1 : 0;
