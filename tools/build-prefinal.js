/* ============================================================
   BUILD-PREFINAL.JS — turn tools/prefinal/* into the pack's data file
   ------------------------------------------------------------
   Run from the repo root:   node tools/build-prefinal.js

   Each folder in tools/prefinal/ is one program, three files:

     starter.c    what the editor opens with, verbatim from the exam --
                  the function to write has an EMPTY body ("{", blank
                  lines, "}")
     answer.c     that one function, written out in full
     tests.json   [{ "name": ..., "stdin": ... }, ...]

   The reference is the starter with answer.c spliced over the empty stub, so
   the given code in the two can never drift apart. It is compiled with gcc
   and run on every test's stdin, and what it prints IS the expected output --
   nothing in the generated file is typed by hand.

   Writes js/coding-starter-prefinal-files.js. The titles, descriptions and
   folder order live in js/coding-starter-prefinal.js. To add a program: add a
   folder here, run this, then add its entry to CSP_PROGRAMS there.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const SRC = path.join(__dirname, 'prefinal');
const OUT_FILE = path.join(__dirname, '..', 'js', 'coding-starter-prefinal-files.js');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'prefinal-'));

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

/** The starter with its one empty stub replaced by the answer. */
function splice(id, starter, answer) {
  const lines = starter.split('\n');
  const ans = answer.replace(/\s+$/, '').split('\n');
  const sig = ans[0];
  const at = lines.indexOf(sig);
  if (at === -1) throw new Error(id + ': answer.c\'s first line is not in starter.c: ' + sig);
  if (lines[at + 1] !== '{') throw new Error(id + ': expected "{" on the line after ' + sig);
  let close = at + 2;
  while (close < lines.length && lines[close] !== '}') {
    if (lines[close].trim()) throw new Error(id + ': the stub is not empty -- line ' + (close + 1));
    close++;
  }
  if (close === lines.length) throw new Error(id + ': no closing "}" for ' + sig);
  return lines.slice(0, at).concat(ans, lines.slice(close + 1)).join('\n');
}

const files = {};
const tests = {};
let failed = false;

for (const id of fs.readdirSync(SRC).sort()) {
  const dir = path.join(SRC, id);
  if (!fs.statSync(dir).isDirectory()) continue;
  const starter = read(path.join(dir, 'starter.c'));
  const code = splice(id, starter, read(path.join(dir, 'answer.c')));
  const cases = JSON.parse(read(path.join(dir, 'tests.json')));

  const work = path.join(TMP, id);
  fs.mkdirSync(work);
  fs.writeFileSync(path.join(work, 'main.c'), code);
  const exe = path.join(work, 'a.exe');
  const cc = spawnSync('gcc', ['-std=c11', '-Wall', '-Wextra', 'main.c', '-o', exe],
                       { cwd: work, encoding: 'utf8' });
  if (cc.status !== 0 || (cc.stderr || '').trim()) {
    console.error(id + ': gcc ' + (cc.status !== 0 ? 'failed' : 'warned') + '\n' + cc.stderr);
    if (cc.status !== 0) { failed = true; continue; }
  }

  files[id] = { starter: starter, code: code };
  tests[id] = cases.map((t) => {
    const r = spawnSync(exe, [], { cwd: work, input: t.stdin, encoding: 'utf8', timeout: 5000 });
    if (r.status !== 0) {
      console.error(id + ' / ' + t.name + ': exited ' + r.status);
      failed = true;
    }
    const expected = String(r.stdout || '').replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').replace(/\s+$/, '');
    return { name: t.name, stdin: t.stdin, expected: expected };
  });
  console.log(id + ': ' + cases.length + ' tests');
}

if (failed) { console.error('Not written: fix the errors above.'); process.exit(1); }

const out =
  '/* ============================================================\n'
+ '   CODING-STARTER-PREFINAL-FILES.JS — GENERATED, do not edit by hand\n'
+ '   ------------------------------------------------------------\n'
+ '   Written by tools/build-prefinal.js from tools/prefinal/*. Every expected\n'
+ '   output below is what the reference printed when gcc compiled and ran it.\n'
+ '   Change the sources there and run the script again.\n'
+ '   ============================================================ */\n\n'
+ 'const CSPF_FILES = ' + JSON.stringify(files, null, 2) + ';\n\n'
+ 'const CSPF_TESTS = ' + JSON.stringify(tests, null, 2) + ';\n';
fs.writeFileSync(OUT_FILE, out);
console.log('wrote ' + path.relative(process.cwd(), OUT_FILE));
