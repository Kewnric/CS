/* ============================================================
   VERIFY-PACK.JS — compile every starter-pack reference, run its own tests
   ------------------------------------------------------------
   Run from the repo root:   node tools/verify-pack.js .

   A reference that fails its own tests marks correct work wrong, and it does
   it quietly -- the learner sees a red cross on a correct answer and has no
   way to tell it is the pack that is broken. So every reference is compiled
   with gcc and run against every test the program ships with.

   It matters most when pack I/O changes. The solution's output and the
   expected string in the test have to move together, and by hand that is a
   silent way to break a dozen programs at once.

   Loads the pack the way the app does -- the same four files, evaluated in
   one shared scope, then codingStarterPack() -- so what is checked is what
   ships, not a copy of it that can drift.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const os = require('os');
const vm = require('vm');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = process.argv[2] || '.';
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'packverify-'));

const files = [
  'js/utils.js',
  'js/coding-starter-solutions.js',
  'js/coding-starter.js',
  'js/coding-starter-c.js',
  'js/coding-starter-advanced-solutions.js',
  'js/coding-starter-advanced.js',
  'js/coding-starter-lists-expected.js',
  'js/coding-starter-lists.js'
];

const sandbox = {
  console,
  state: { challenges: [], nodes: [], codingSets: [] },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  document: { getElementById: () => null, querySelector: () => null,
              querySelectorAll: () => [] },
  saveData: () => {}, toast: () => {}, renderBrowse: () => {},
  invalidateBrowseCache: () => {}, clearSessionParam: () => {},
  escapeHTML: s => String(s), generateId: () => 'id' + Math.random(),
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

for (const f of files) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) { console.error('missing ' + f); continue; }
  vm.runInContext(fs.readFileSync(p, 'utf8'), sandbox, { filename: f });
}

const pack = vm.runInContext('codingStarterPack()', sandbox);
const folders = {};
pack.nodes.forEach(n => { folders[n.id] = n.name; });

let progs = 0, ran = 0, passed = 0;
const failures = [];
const skipped = [];

for (const ch of pack.challenges) {
  progs++;
  const v = (ch.variants || [])[0];
  if (!v) continue;
  const tests = v.tests || [];
  if (!tests.length) { skipped.push(ch.title + ' (no tests)'); continue; }

  const srcFiles = (v.files || []).filter(f => (f.code || '').trim());
  if (!srcFiles.length) { skipped.push(ch.title + ' (no reference)'); continue; }

  const dir = path.join(OUT, ch.id.replace(/[^a-z0-9-]/gi, '_'));
  fs.mkdirSync(dir, { recursive: true });
  const cFiles = [];
  for (const f of srcFiles) {
    const name = (f.name || 'main') + (f.ext || '.c');
    fs.writeFileSync(path.join(dir, name), f.code);
    if (/\.c$/i.test(name)) cFiles.push(name);
  }
  if (!cFiles.length) { skipped.push(ch.title + ' (headers only)'); continue; }

  const exe = path.join(dir, 'a.exe');
  const cc = spawnSync('gcc', ['-std=c11', '-w', ...cFiles, '-o', exe],
                       { cwd: dir, encoding: 'utf8' });
  if (cc.status !== 0) {
    failures.push({ prog: ch.title, id: ch.id, stage: 'compile',
                    detail: (cc.stderr || '').split('\n').slice(0, 4).join(' | ') });
    continue;
  }

  /* A minimum requirement the reference itself fails would mark correct work
     wrong -- the student writes the right thing, the checker demands a
     construct the model answer does not use, and the cross is unexplainable.
     So every requirement is run against its own reference here. */
  const reqs = (v.minRequirements || []).map(r => r.type);
  for (const rq of reqs) {
    let ok = true;
    try { ok = vm.runInContext('evalMinRequirement(' + JSON.stringify(rq) + ', ' +
                               JSON.stringify(srcFiles[0].code) + ')', sandbox); }
    catch (e) { ok = 'threw: ' + e.message; }
    if (ok !== true) {
      failures.push({ prog: ch.title, id: ch.id, stage: 'minRequirement',
                      detail: 'reference does not satisfy "' + rq + '"' });
    }
  }

  for (const t of tests) {
    ran++;
    const r = spawnSync(exe, [], { cwd: dir, input: t.stdin || '',
                                   encoding: 'utf8', timeout: 5000 });
    const got = (r.stdout || '').replace(/\r\n/g, '\n').trim();
    const want = String(t.expected == null ? '' : t.expected).replace(/\r\n/g, '\n').trim();
    if (got === want) { passed++; }
    else failures.push({ prog: ch.title, id: ch.id, test: t.name,
                         want, got: got.slice(0, 200) });
  }
}

console.log(JSON.stringify({
  programs: progs,
  testsRun: ran,
  testsPassed: passed,
  testsFailed: ran - passed,
  compileFailures: failures.filter(f => f.stage === 'compile').length,
  requirementFailures: failures.filter(f => f.stage === 'minRequirement').length,
  skipped,
  failures: failures.slice(0, 25)
}, null, 2));
