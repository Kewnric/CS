/* ============================================================
   VERIFY-CODEX.JS — every Codex example compiles and prints what it says
   ------------------------------------------------------------
   Each entry's example is wrapped the way the Codex shows and opens it
   (codexWrap), compiled with gcc -Wall, run, and compared to its `out`
   exactly. Also: ids unique, every related id exists, every category known.

   node tools/verify-codex.js          (needs gcc on PATH)
   ============================================================ */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { CODEX_CATS, CODEX_ENTRIES, codexWrap } = require(path.join(__dirname, '..', 'js', 'codex-data.js'));

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdx-'));
let bad = 0, runs = 0;
const ids = new Set();
const cats = new Set(CODEX_CATS.map(c => c.id));

CODEX_ENTRIES.forEach(e => {
  if (ids.has(e.id)) { bad++; console.log('FAIL duplicate id ' + e.id); }
  ids.add(e.id);
  if (!cats.has(e.c)) { bad++; console.log('FAIL ' + e.id + ': unknown category ' + e.c); }
  if (!e.n || !e.d) { bad++; console.log('FAIL ' + e.id + ': needs a name and a description'); }
});
CODEX_ENTRIES.forEach(e => (e.r || []).forEach(r => {
  if (!ids.has(r)) { bad++; console.log('FAIL ' + e.id + ': related id ' + r + ' does not exist'); }
}));

CODEX_ENTRIES.forEach(e => {
  if (!e.ex) return;
  runs++;
  const c = path.join(dir, 'e.c');
  const exe = path.join(dir, 'e.exe');
  fs.writeFileSync(c, codexWrap(e.ex));
  const cc = spawnSync('gcc', ['-std=c11', '-Wall', '-Wno-unused-variable', c, '-o', exe, '-lm'], { encoding: 'utf8' });
  if (cc.status !== 0) { bad++; console.log('FAIL ' + e.id + ': does not compile\n' + cc.stderr); return; }
  if (/warning/.test(cc.stderr || '')) console.log('WARN ' + e.id + ':\n' + cc.stderr);
  if (e.out === null) return;   // varies from run to run (an address)
  const r = spawnSync(exe, [], { encoding: 'utf8', timeout: 5000, cwd: dir });
  const got = (r.stdout || '').replace(/\r\n/g, '\n');
  if (got !== e.out) { bad++; console.log('FAIL ' + e.id + ': printed ' + JSON.stringify(got) + ', expected ' + JSON.stringify(e.out)); }
});

fs.rmSync(dir, { recursive: true, force: true });
console.log(CODEX_ENTRIES.length + ' entries, ' + runs + ' examples, ' + bad + ' failed');
process.exit(bad ? 1 : 0);
