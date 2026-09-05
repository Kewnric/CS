/* ============================================================
   VERIFY-PROGRESSION.JS — nothing before the folder that teaches it
   ------------------------------------------------------------
   Run from the repo root:   node tools/verify-progression.js .

   The pack's claim is that it is a PROGRESSION: each program is solvable with
   what the ones before it taught. That claim is easy to make and easy to break
   -- a folder gets reordered, a reference gets tidied into a loop, and now the
   fourth program in the course needs an idea from the ninth.

   So it is checked. Every reference is scanned for the constructs the course
   introduces, and each is compared against the order of the folder that
   introduces it. Anything used early is reported.

   It reads the REFERENCE, which is the strongest available proxy for "what
   this exercise needs" -- if the model answer cannot avoid a construct, a
   student cannot either.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.argv[2] || '.';

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
  'js/coding-starter-lists.js'
];

const sandbox = {
  console,
  state: { challenges: [], nodes: [], codingSets: [] },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] },
  saveData: () => {}, toast: () => {}, renderBrowse: () => {},
  invalidateBrowseCache: () => {}, clearSessionParam: () => {},
  escapeHTML: s => String(s), generateId: () => 'id'
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of files) {
  const p = path.join(ROOT, f);
  if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), sandbox, { filename: f });
}

const pack = vm.runInContext('codingStarterPack()', sandbox);
const node = {};
pack.nodes.forEach(n => { node[n.id] = n; });

/* A program's place in the course: the order of its top-level folder. Sub
   folders order within a tier, which is finer than this check needs. */
function tierOrder(parentId) {
  const n = node[parentId];
  if (!n) return 99;
  return n.parentId ? (node[n.parentId] ? node[n.parentId].order : 99) : n.order;
}

/* The folder order at which each construct becomes fair game. Keep in step
   with the folder orders in the pack modules. */
const TAUGHT = {
  'if / switch':   -9,
  'loop':          -8,
  'own function':  -7,
  'pointer':       -6,
  'array':         -5,
  'string.h':      -4,
  'struct':        -2,
  'malloc':        -3,
  'file i/o':       0
};

const DETECT = {
  'if / switch':  c => /\b(if|switch)\s*\(/.test(c),
  'loop':         c => /\b(for|while)\s*\(/.test(c),
  'own function': c => (c.match(/^[A-Za-z_][\w \t*]*?\**\s*([A-Za-z_]\w*)\s*\([^;{]*\)\s*\{/gm) || [])
                        .some(sig => !/\bmain\s*\(/.test(sig)),
  /* A star is only a pointer next to a TYPE. Matching a bare star called
     `n * n` multiplication a pointer and flagged half of tier 0. */
  'pointer':      c => /(int|char|float|double|void|unsigned|short|long|FILE|size_t|struct\s+\w+|ArrayList|Participant|FlightNode|FlightSearchResult|playerNode|PlayerList|PlayerDetails)\s*\*+\s*\**\s*[A-Za-z_(]/.test(c) || /->/.test(c),
  'array':        c => /[A-Za-z_]\w*\s*\[/.test(c),
  'string.h':     c => /\b(strlen|strcpy|strcmp|strcat|strncpy|sprintf)\s*\(/.test(c),
  'struct':       c => /\b(struct|typedef)\b/.test(c),
  'malloc':       c => /\b(malloc|calloc|realloc)\s*\(/.test(c),
  'file i/o':     c => /\b(fopen|fprintf|fscanf|fclose)\s*\(/.test(c)
};

const early = [];
let checked = 0;

pack.challenges.forEach(ch => {
  const v = (ch.variants || [])[0];
  if (!v) return;
  const code = (v.files || []).map(f => f.code || '').join('\n');
  if (!code.trim()) return;
  checked++;
  const at = tierOrder(ch.parentId);
  Object.keys(DETECT).forEach(k => {
    if (!DETECT[k](code)) return;
    if (at < TAUGHT[k]) {
      early.push({
        program: ch.title,
        folder: node[ch.parentId] ? node[ch.parentId].name : '(none)',
        uses: k, atOrder: at, taughtAtOrder: TAUGHT[k]
      });
    }
  });
});

console.log(JSON.stringify({
  referencesChecked: checked,
  usedBeforeTaught: early.length,
  detail: early.slice(0, 40)
}, null, 2));
