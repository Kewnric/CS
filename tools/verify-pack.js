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
  'js/coding-starter-core-solutions.js',
  'js/coding-starter-ptr-solutions.js',
  'js/coding-starter-arr-solutions.js',
  'js/coding-starter-loop-solutions.js',
  'js/coding-starter-workshop-files.js',
  'js/coding-starter.js',
  'js/coding-starter-core.js',
  'js/coding-starter-ptr.js',
  'js/coding-starter-arr.js',
  'js/coding-starter-loop.js',
  'js/coding-starter-workshop.js',
  'js/coding-starter-c.js',
  'js/coding-starter-advanced-solutions.js',
  'js/coding-starter-advanced.js',
  'js/coding-starter-lists-expected.js',
  'js/coding-starter-lists.js',
  // Walkthrough coverage is part of what "the pack is finished" now means.
  'js/demo-lessons.js'
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

/* Two programs sharing an id is silent and nasty: _csProgram resolves the
   reference by id, so the second one gets the first one's solution and the
   library holds two entries the dedupe cannot tell apart. Caught here. */
const seenIds = new Map();
const duplicateIds = [];
pack.challenges.forEach(c => {
  if (seenIds.has(c.id)) duplicateIds.push({ id: c.id, titles: [seenIds.get(c.id), c.title] });
  else seenIds.set(c.id, c.title);
});

let progs = 0, ran = 0, passed = 0;
const failures = [];
const skipped = [];

/* ── Coverage, as opposed to correctness ───────────────────────
   The checks above ask "is the pack right". These ask "is it finished": a
   program with no tests cannot be marked, one with no minimum requirements
   contributes nothing to the concept model, and one with no walkthrough has no
   demonstration to send a stuck learner to. Each is a silent gap — nothing
   breaks, the program is simply worth less than the ones beside it. */
const coverage = { noTests: [], noRequirements: [], noSamples: [], noWalkthrough: [] };
const lessons = (() => {
  try { return vm.runInContext('DEMO_LESSONS', sandbox) || []; } catch (e) { return []; }
})();

/** The concepts a variant declares, in either of the two stored shapes. */
const reqTypes = (v) => ((v && v.minRequirements) || [])
  .map(r => (typeof r === 'string' ? r : (r && (r.type || r.name || r.id)) || ''))
  .filter(Boolean);

/* The rule demo.js matches by, reduced to what is knowable here: the folder
   chain and the requirements. The scoring is not reproduced — this only asks
   whether ANY lesson claims the program, which is the gap worth naming. */
function hasWalkthrough(ch, v) {
  const reqs = reqTypes(v);
  const chain = [];
  let cur = ch.parentId;
  let guard = 0;
  while (cur && guard++ < 30) {
    chain.push(cur);
    cur = (pack.nodes.find(nd => nd.id === cur) || {}).parentId;
  }
  return lessons.some(l => {
    if (ch.demoId === l.id || (v && v.demoId === l.id)) return true;
    const m = l.match || {};
    if (m.folders && m.folders.some(f => chain.indexOf(f) !== -1)) return true;
    if (m.requires && m.requires.length && m.requires.every(r => reqs.indexOf(r) !== -1)) return true;
    return false;
  });
}

/* ── Do the samples still describe the program? ────────────────
   A sample is the first thing a learner reads and the last thing anyone
   updates. Every sample that declares an Input and an Output is replayed
   against the reference here, so one that has drifted from what the program
   actually prints is reported rather than left to confuse someone. */
const sampleChecks = { checked: 0, matched: 0, drifted: [], unparsed: 0 };

const RE_OUT = /^Output:[ \t]*$/m;
const RE_IN = /^Input:[ \t]*$/m;

function parseSample(content) {
  const text = String(content || '').replace(/\r\n/g, '\n');
  const oi = text.search(RE_OUT);
  if (oi === -1) return null;
  const ii = text.search(RE_IN);
  const expected = text.slice(oi).replace(/^Output:[ \t]*\n?/, '');
  if (ii === -1) return { stdin: '', expected: expected };
  if (ii > oi) return null;                    // Output before Input — not this shape
  const raw = text.slice(ii, oi).replace(/^Input:[ \t]*\n?/, '');
  return { stdin: raw.replace(/\s+$/, '') + '\n', expected: expected };
}

for (const ch of pack.challenges) {
  progs++;
  const v = (ch.variants || [])[0];
  if (!v) continue;
  if (!reqTypes(v).length) coverage.noRequirements.push(ch.title);
  if (!((v.samples || []).length)) coverage.noSamples.push(ch.title);
  if (!hasWalkthrough(ch, v)) coverage.noWalkthrough.push(ch.title);
  const tests = v.tests || [];
  if (!tests.length) { coverage.noTests.push(ch.title); skipped.push(ch.title + ' (no tests)'); continue; }

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

  /* Replay each sample against the reference that the tests just proved
     correct, so a sample that no longer matches the program is named. The
     comparison is the app's own normalisation, for the same reason the test
     comparison is: a verifier stricter than the checker tests a different
     program. */
  for (const smp of (v.samples || [])) {
    const parsed = parseSample(smp.content);
    if (!parsed) { sampleChecks.unparsed++; continue; }
    sampleChecks.checked++;
    const r = spawnSync(exe, [], { cwd: dir, input: parsed.stdin,
                                   encoding: 'utf8', timeout: 5000 });
    const norm = (x) => String(x == null ? '' : x)
      .replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').replace(/\s+$/, '');
    const got = norm(r.stdout);
    const want = norm(parsed.expected);
    if (got === want) { sampleChecks.matched++; continue; }
    sampleChecks.drifted.push({
      prog: ch.title, id: ch.id, sample: smp.title || 'sample',
      stdin: parsed.stdin.replace(/\n/g, '\\n'),
      sampleSays: want.slice(0, 160),
      programPrints: got.slice(0, 160)
    });
  }

  for (const t of tests) {
    ran++;
    const r = spawnSync(exe, [], { cwd: dir, input: t.stdin || '',
                                   encoding: 'utf8', timeout: 5000 });
    /* The same normalisation the app applies (_normalizeOutput in
       practice.js): trailing whitespace goes, per line and at the end. This
       was a bare trim(), which made the verifier STRICTER than the checker a
       student is marked by -- a reference printing "1 2 3 " per row was
       rejected here and accepted there. The verifier has to ask exactly what
       the app asks, or it is testing a different program. */
    const norm = (x) => String(x == null ? '' : x)
      .replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').replace(/\s+$/, '');
    const got = norm(r.stdout);
    const want = norm(t.expected);
    if (got === want) { passed++; }
    else failures.push({ prog: ch.title, id: ch.id, test: t.name,
                         want, got: got.slice(0, 200) });
  }
}

console.log(JSON.stringify({
  programs: progs,
  duplicateIds,
  testsRun: ran,
  testsPassed: passed,
  testsFailed: ran - passed,
  compileFailures: failures.filter(f => f.stage === 'compile').length,
  requirementFailures: failures.filter(f => f.stage === 'minRequirement').length,
  /* Counts first, names after. A gap of one is worth reading in full; a gap of
     forty is a job, and the number is what says which it is. */
  coverage: {
    noTests: coverage.noTests.length,
    noRequirements: coverage.noRequirements.length,
    noSamples: coverage.noSamples.length,
    noWalkthrough: coverage.noWalkthrough.length,
    lessonsLoaded: lessons.length,
    names: {
      noTests: coverage.noTests,
      noRequirements: coverage.noRequirements.slice(0, 20),
      noSamples: coverage.noSamples.slice(0, 20),
      noWalkthrough: coverage.noWalkthrough.slice(0, 20)
    }
  },
  samples: {
    checked: sampleChecks.checked,
    matched: sampleChecks.matched,
    drifted: sampleChecks.checked - sampleChecks.matched,
    unparsed: sampleChecks.unparsed,
    examples: sampleChecks.drifted.slice(0, 12)
  },
  skipped,
  failures: failures.slice(0, 25)
}, null, 2));
