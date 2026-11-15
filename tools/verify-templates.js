/* ============================================================
   VERIFY-TEMPLATES.JS — compile and run every starter template with gcc
   ------------------------------------------------------------
   For each template with a harness: the canonical form, and twenty seeded
   variations, are compiled inside the harness and must print exactly its
   expected output. A template without a harness must at least compile.
   A variation that broke the code would mark a correct answer wrong in the
   drill, silently -- this is what stops that.

   node tools/verify-templates.js          (needs gcc on PATH)
   ============================================================ */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const T = require(path.join(__dirname, '..', 'js', 'templates.js'));
const { TPL_STARTER } = require(path.join(__dirname, '..', 'js', 'templates-starter.js'));

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tplv-'));
const HEADERS = '#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n#include <ctype.h>\n';
let bad = 0, runs = 0;

function compile(src, objOnly) {
  const c = path.join(dir, 't.c');
  const exe = path.join(dir, objOnly ? 't.o' : 't.exe');
  fs.writeFileSync(c, src);
  const args = ['-std=c11', '-Wall', '-Wno-unused-function', '-Wno-unused-variable', c, '-o', exe];
  if (objOnly) args.unshift('-c');
  const r = spawnSync('gcc', args, { encoding: 'utf8' });
  return { ok: r.status === 0, err: (r.stderr || '') + (r.error ? String(r.error) : ''), exe };
}

function run(exe, stdin) {
  const r = spawnSync(exe, [], { input: stdin || '', encoding: 'utf8', timeout: 5000, cwd: dir });
  return (r.stdout || '').replace(/\r\n/g, '\n');
}

function check(t, values, label) {
  runs++;
  const answer = T.tplFill(t.body, values);
  if (!t.harness) {
    const c = compile(HEADERS + answer, true);
    if (!c.ok) { bad++; console.log('FAIL ' + label + ': does not compile\n' + c.err); }
    else if (/warning/.test(c.err)) console.log('WARN ' + label + ':\n' + c.err);
    return;
  }
  const src = T.tplHarnessSource(t, answer, values);
  const c = compile(src, false);
  if (!c.ok) { bad++; console.log('FAIL ' + label + ': does not compile\n' + c.err + '\n' + src); return; }
  if (/warning/.test(c.err)) console.log('WARN ' + label + ':\n' + c.err);
  const out = run(c.exe, t.harness.stdin);
  if (out !== t.harness.expect) {
    bad++;
    console.log('FAIL ' + label + ': printed ' + JSON.stringify(out) + ', expected ' + JSON.stringify(t.harness.expect));
  }
}

TPL_STARTER.forEach(raw => {
  const t = T.tplNormal(raw);
  check(t, {}, t.id + ' (canonical)');
  for (let seed = 1; seed <= 20; seed++) {
    const v = T.tplVariation(t, seed);
    if (v) check(t, v.values, t.id + ' (seed ' + seed + ': ' + JSON.stringify(v.values) + ')');
  }
});

fs.rmSync(dir, { recursive: true, force: true });
console.log(TPL_STARTER.length + ' templates, ' + runs + ' builds, ' + bad + ' failed');
process.exit(bad ? 1 : 0);
