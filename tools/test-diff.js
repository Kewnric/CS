#!/usr/bin/env node
/* ============================================================
   TEST-DIFF.JS — the solution page's comparison, run under Node
   ------------------------------------------------------------
   js/diff.js decides what the solution page calls a difference. Each case
   here is a correct program that was once shown as wrong (or a wrong one
   that must stay wrong), plus three checks over every reference in the
   starter pack: compared with itself, with every name changed, and with its
   braces moved to their own lines, a reference must come back all matching.

     node tools/test-diff.js .
   ============================================================ */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

const root = path.resolve(process.argv[2] || '.');
const ctx = {
  console,
  state: { challenges: [], nodes: [], codingSets: [] },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} },
  saveData: () => {}, toast: () => {}, renderBrowse: () => {},
  invalidateBrowseCache: () => {}, clearSessionParam: () => {},
  escapeHTML: s => String(s), generateId: () => 'id' + Math.random()
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
const PACK = [
  'js/coding-starter-solutions.js', 'js/coding-starter-core-solutions.js', 'js/coding-starter-ptr-solutions.js',
  'js/coding-starter-arr-solutions.js', 'js/coding-starter-loop-solutions.js', 'js/coding-starter-workshop-files.js',
  'js/coding-starter.js', 'js/coding-starter-core.js', 'js/coding-starter-ptr.js', 'js/coding-starter-arr.js',
  'js/coding-starter-loop.js', 'js/coding-starter-workshop.js', 'js/coding-starter-c.js',
  'js/coding-starter-advanced-solutions.js', 'js/coding-starter-advanced.js', 'js/coding-starter-lists-expected.js',
  'js/coding-starter-lists.js', 'js/coding-starter-prefinal-files.js', 'js/coding-starter-prefinal.js'
];
for (const f of ['js/utils.js', 'js/diff.js', ...PACK]) {
  const p = path.join(root, f);
  if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f });
}
const G = name => vm.runInContext(name, ctx);
const computeDiffs = G('computeDiffs'), computeLineDiffs = G('computeLineDiffs'), explainDiffLine = G('explainDiffLine');
const lex = G('_diffLexC'), canon = G('_diffCanonC'), renameC = G('diffRenameC'), RESERVED = G('DIFF_C_RESERVED');

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; return; }
  fail++;
  console.log('FAIL  ' + name + (detail ? '\n      ' + detail : ''));
}
const L = (...lines) => lines.join('\n');
const bad = r => r.diffs.filter(d => d.status !== 'perfect');
const show = rows => rows.map(d => `${d.status}: ${JSON.stringify(d.actualPlain)} | ${JSON.stringify(d.expectedPlain)}`).join('\n      ');
/** What the highlight marks on each side of a row, as text. */
function marks(row, names, gran) {
  const c = computeLineDiffs(row.actualPlain, row.expectedPlain, gran || 'char', names);
  return {
    a: c.actualChars.filter(x => x.status === 'wrong' || x.status === 'offset').map(x => x.char).join(''),
    e: c.expectedChars.filter(x => x.status === 'missing').map(x => x.char).join('')
  };
}
const why = (r, row) => explainDiffLine(row, { bracesBalanced: true, userLines: [], names: r.names });

/* ── The program from the report ───────────────────────────── */

const ODD_EVEN = L('#include <stdio.h>', '', 'int main(void) {', '    int n;', '',
  '    printf("Enter a number: ");', '    scanf("%d", &n);', '',
  '    if (n % 2 == 0) {', '        printf("%d is Even\\n", n);', '    } else {',
  '        printf("%d is Odd\\n", n);', '    }', '    return 0;', '}', '');

{
  const user = L('#include <stdio.h>', 'int main(){', '\tint x;', '\tprintf("Enter a number: ");', '\tscanf("%d", &x);', '',
    '\tif(x % 2 == 0){', '\t\tprintf("%d is Even", x);', '\t} else {', '\t\tprintf("%d is Odd", x);', '\t}', '\treturn 0;', '}');
  const r = computeDiffs(user, ODD_EVEN);
  const rows = bad(r);
  check('report: only the two printf lines differ', rows.length === 2 && rows.every(d => d.status === 'partial'), show(rows));
  rows.forEach(d => {
    for (const g of ['char', 'word']) {
      const m = marks(d, r.names, g);
      check(`report (${g}): x is not marked against n`, m.a === '', `marked on your side: ${JSON.stringify(m.a)}`);
      check(`report (${g}): only \\n is missing`, m.e === '\\n', `marked missing: ${JSON.stringify(m.e)}`);
    }
    const w = why(r, d);
    check('report: explained as the missing newline', w && w.kind === 'newline', w && w.text);
  });
}

/* ── Names ─────────────────────────────────────────────────── */

{ // one extra variable used to shift every later name
  const user = L('#include <stdio.h>', 'int main(){', '\tint r, x;', '\tprintf("Enter a number: ");', '\tscanf("%d", &x);', '\tr = x % 2;',
    '\tif (x % 2 == 0) {', '\t\tprintf("%d is Even\\n", x);', '\t} else {', '\t\tprintf("%d is Odd\\n", x);', '\t}', '\treturn 0;', '}');
  const r = computeDiffs(user, ODD_EVEN);
  const rows = bad(r);
  check('extra variable: only its declaration and its line differ',
    rows.length === 2 && rows[0].actualLine === 3 && rows[1].status === 'extra' && rows[1].actualLine === 6, show(rows));
  check('extra variable: no "different name" notes', !rows.some(d => (why(r, d) || {}).kind === 'name'));
  const m = marks(rows[0], r.names);
  check('extra variable: the extra name is what is marked', m.a.replace(/\s/g, '') === 'r,', JSON.stringify(m));
}

{ // declared in another order
  const ref = L('int main(void) {', '    int a, b;', '    scanf("%d %d", &a, &b);', '    printf("%d\\n", a * 2 + b);', '    return 0;', '}');
  const user = L('int main(void) {', '    int y, x;', '    scanf("%d %d", &x, &y);', '    printf("%d\\n", x * 2 + y);', '    return 0;', '}');
  const r = computeDiffs(user, ref);
  const rows = bad(r);
  check('declaration order: only the declaration differs', rows.length === 1 && rows[0].actualLine === 2, show(rows));
}

{ // two variables in each other's places are still a difference
  const ref = L('int main(void) {', '    int a, b;', '    scanf("%d %d", &a, &b);', '    printf("%d\\n", a - b);', '    return 0;', '}');
  const user = L('int main(void) {', '    int a, b;', '    scanf("%d %d", &a, &b);', '    printf("%d\\n", b - a);', '    return 0;', '}');
  const r = computeDiffs(user, ref);
  const rows = bad(r);
  check('swapped roles: the subtraction still differs', rows.length === 1 && rows[0].actualLine === 4, show(rows));
  const m = rows[0] ? marks(rows[0], r.names) : { a: '' };
  check('swapped roles: the names are marked', /a|b/.test(m.a), JSON.stringify(m));
}

{ // a wrong variable is named as one, with the reader's own name for the right one
  const ref = L('int main(void) {', '    int total, count;', '    scanf("%d %d", &total, &count);', '    printf("%d\\n", total);', '    printf("%d\\n", count);', '    return 0;', '}');
  const user = L('int main(void) {', '    int sum, n;', '    scanf("%d %d", &sum, &n);', '    printf("%d\\n", sum);', '    printf("%d\\n", sum);', '    return 0;', '}');
  const r = computeDiffs(user, ref);
  const rows = bad(r);
  const w = rows[0] && why(r, rows[0]);
  check('wrong variable: one row', rows.length === 1, show(rows));
  check('wrong variable: explained with your own name for it',
    w && w.kind === 'name' && /`count`/.test(w.text) && /your `n`/.test(w.text) && /wrote `sum`/.test(w.text), w && w.text);
}

{ // one of your variables doing two of the reference's jobs (reported: "Count down with a for")
  const ref = L('#include <stdio.h>', '', 'int main(void) {', '    int n;', '    scanf("%d", &n);', '    for (int i = n; i >= 1; i--) {',
    '        printf("%d\\n", i);', '    }', '    return 0;', '}');
  const user = L('#include <stdio.h>', 'int main(){', '\tint x;', '\tscanf("%d", &x);', '\tfor(int i = 1; i <= x; x--){',
    '\t\tprintf("%d\\n", x);', '\t}', '\treturn 0;', '}');
  const r = computeDiffs(user, ref);
  const rows = bad(r);
  check('two jobs: only the loop header differs', rows.length === 1 && rows[0].actualLine === 5, show(rows));
  if (rows[0]) {
    for (const g of ['char', 'word']) {
      const m = marks(rows[0], r.names, g);
      // `1 ; i <= x` against `n ; i >= 1`: the 1, the < and the x facing the reference's 1, never your i.
      check(`two jobs (${g}): no name of yours is marked against a name`,
        !/i/.test(m.a) && (m.a.match(/x/g) || []).length <= 1, JSON.stringify(m));
      check(`two jobs (${g}): the reference's names are not marked missing`, !/i/.test(m.e), JSON.stringify(m));
    }
    const w = why(r, rows[0]);
    check('two jobs: the header is not explained as a different variable', !w || w.kind !== 'name', w && w.text);
  }
}

{ // a name in another's place on ONE line is a slip, even when it is there twice
  const ref = L('int main(void) {', '    int a, b;', '    scanf("%d %d", &a, &b);', '    printf("%d\\n", a * a);', '    return 0;', '}');
  const user = L('int main(void) {', '    int a, b;', '    scanf("%d %d", &a, &b);', '    printf("%d\\n", b * b);', '    return 0;', '}');
  const r = computeDiffs(user, ref);
  const rows = bad(r);
  check('one-line slip: still a difference', rows.length === 1 && rows[0].actualLine === 4, show(rows));
}

{ // functions, parameters and macros pair like variables
  const ref = L('#include <stdio.h>', '#define SIZE 5', 'int square(int v) {', '    return v * v;', '}',
    'int main(void) {', '    int i;', '    for (i = 0; i < SIZE; i++) {', '        printf("%d\\n", square(i));', '    }', '    return 0;', '}');
  const user = L('#include <stdio.h>', '#define MAX 5', 'int sq(int num) {', '    return num * num;', '}',
    'int main(void) {', '    int k;', '    for (k = 0; k < MAX; k++) {', '        printf("%d\\n", sq(k));', '    }', '    return 0;', '}');
  const r = computeDiffs(user, ref);
  check('functions, parameters and #define names pair', bad(r).length === 0, show(bad(r)));
}

{ // what must never be renamed
  const ref = L('#include <stdio.h>', 'int main(void) {', '    int n = 1;', '    printf("n = %d\\n", n);', '    return 0;', '}');
  const user = L('#include <stdio.h>', 'int main(void) {', '    int h = 1;', '    printf("x = %d\\n", h);', '    return 0;', '}');
  const r = computeDiffs(user, ref);
  const rows = bad(r);
  check('quoted text is compared as written', rows.length === 1 && rows[0].actualLine === 4, show(rows));
  check('#include is untouched by a variable named h', rows.every(d => d.actualLine !== 1));
  const u2 = L('int main(void) {', '    float n = 1;', '    printf("%d", n);', '    return 0;', '}');
  const r2 = computeDiffs(u2, L('int main(void) {', '    int n = 1;', '    printf("%d", n);', '    return 0;', '}'));
  check('a type is not a name', bad(r2).length === 1, show(bad(r2)));
  const r3 = computeDiffs(L('int main(void) {', '    puts("hi");', '}'), L('int main(void) {', '    printf("hi");', '}'));
  check('a library call is not a name', bad(r3).length === 1, show(bad(r3)));
}

{ // with the option off, names count again
  const r = computeDiffs(L('int main(void) {', '    int x;', '    return x;', '}'), L('int main(void) {', '    int n;', '    return n;', '}'), { ignoreNames: false });
  check('ignoreNames off: names differ', bad(r).length === 2 && r.names === null, show(bad(r)));
  const m = marks(bad(r)[0], r.names);
  check('ignoreNames off: the name is marked', m.a === 'x' && m.e === 'n', JSON.stringify(m));
}

/* ── Layout ────────────────────────────────────────────────── */

{
  const user = L('#include <stdio.h>', 'int main()', '{', '\tint x;', '\tprintf("Enter a number: ");', '\tscanf("%d", &x);',
    '\tif (x % 2 == 0)', '\t{', '\t\tprintf("%d is Even\\n", x);', '\t}', '\telse', '\t{', '\t\tprintf("%d is Odd\\n", x);', '\t}', '\treturn 0;', '}');
  const r = computeDiffs(user, ODD_EVEN);
  check('braces on their own lines: no differences', bad(r).length === 0, show(bad(r)));
  const ifRow = r.diffs.find(d => /if \(x/.test(d.actualPlain || ''));
  check('a joined row keeps its first line number', ifRow && ifRow.actualLine === 7 && ifRow.expectedLine === 9,
    ifRow && `${ifRow.actualLine} / ${ifRow.expectedLine}`);
  const r2 = computeDiffs(user, ODD_EVEN, { ignoreWhitespace: false });
  check('whitespace counted: layout counts too', bad(r2).length > 0);

  const dw = computeDiffs(L('int main(void) {', '    int i = 0;', '    do {', '        i++;', '    }', '    while (i < 3);', '    return 0;', '}'),
                          L('int main(void) {', '    int i = 0;', '    do {', '        i++;', '    } while (i < 3);', '    return 0;', '}'));
  check('do-while: the while may sit under the brace', bad(dw).length === 0, show(bad(dw)));

  const cm = computeDiffs(L('int main(void)', '{   // start', '    return 0;', '}'), L('int main(void) {', '    return 0;', '}'));
  const row = cm.diffs[0];
  check('a joined brace keeps its comment beside the row', row && /\/\/ start/.test(row.actualRaw) && G('diffLineComment')(row.actualRaw, row.actualPlain) === '// start',
    row && JSON.stringify(row.actualRaw));
}

/* ── The same statement written another way ───────────────── */

{
  const ref = L('int main(void) {', '    int i, c = 0;', '    for (i = 0; i < 9; i++) {', '        c++;', '    }', '    c--;', '    return c;', '}');
  for (const [label, user] of [
    ['++i / ++c', L('int main(void) {', '    int i, c = 0;', '    for (i = 0; i < 9; ++i) {', '        ++c;', '    }', '    --c;', '    return c;', '}')],
    ['+= 1', L('int main(void) {', '    int i, c = 0;', '    for (i = 0; i < 9; i += 1) {', '        c += 1;', '    }', '    c -= 1;', '    return c;', '}')],
    ['x = x + 1', L('int main(void) {', '    int i, c = 0;', '    for (i = 0; i < 9; i = i + 1) {', '        c = c + 1;', '    }', '    c = c - 1;', '    return c;', '}')]
  ]) {
    const r = computeDiffs(user, ref);
    check(`increments: ${label} matches`, bad(r).length === 0, show(bad(r)));
  }
  const r = computeDiffs(L('int main(void) {', '    int i = 0;', '    printf("%d", ++i);', '    if (++i > 2) return 1;', '    return 0;', '}'),
                         L('int main(void) {', '    int i = 0;', '    printf("%d", i++);', '    if (i++ > 2) return 1;', '    return 0;', '}'));
  check('increments: where the value is used, ++i and i++ still differ', bad(r).length === 2, show(bad(r)));
  const r2 = computeDiffs(L('int main(void) {', '    for (i = 0; i < n; i++) printf("%d, ", ++x);', '}'),
                          L('int main(void) {', '    for (i = 0; i < n; i++) printf("%d, ", x++);', '}'));
  check('increments: an argument after a for header is not its step', bad(r2).length === 1, show(bad(r2)));
  const r3 = computeDiffs(L('void f(void);', 'int main(void) { f(); return 0; }'), L('void f();', 'int main() { f(); return 0; }'));
  check('name(void) and name() are the same declaration', bad(r3).length === 0, show(bad(r3)));
}

{ // x = x op E is x op= E only when E binds tighter than op
  const wrap = body => L('int main(void) {', '    int x = 1, a = 2, b = 3, s[4] = {0};', '    ' + body, '    return x;', '}');
  const same = (u, e, label) => { const r = computeDiffs(wrap(u), wrap(e)); check(`compound: ${label}`, bad(r).length === 0, show(bad(r))); };
  const diff = (u, e, label) => { const r = computeDiffs(wrap(u), wrap(e)); check(`compound: ${label}`, bad(r).length === 1, show(bad(r))); };
  same('x = x + s[a];', 'x += s[a];', 'x = x + s[a] is x += s[a]');
  same('x = x - a * b;', 'x -= a * b;', 'x = x - a * b is x -= a * b');
  same('x = x * 2;', 'x *= 2;', 'x = x * 2 is x *= 2');
  same('x = x / (a + b);', 'x /= (a + b);', 'a bracketed right side');
  same('x = x + f(a, b);', 'x += f(a, b);', 'a call on the right');
  diff('x = x - a + b;', 'x -= a + b;', 'x = x - a + b is not x -= a + b');
  diff('x = x * a + b;', 'x *= a + b;', 'x = x * a + b is not x *= a + b');
  diff('x = x + 1 > a;', 'x += 1 > a;', 'a comparison on the right is not folded');
  same('for (a = 0; a < 4; a = a + 2) x++;', 'for (a = 0; a < 4; a += 2) x++;', 'in a for step');
  same('switch (a) { case 2: x = x + 5; a++; break; }', 'switch (a) { case 2: x += 5; ++a; break; }', 'after a case label');
  same('return (x);', 'return x;', 'return (x) is return x');
  same('return(x + 1);', 'return x + 1;', 'return(x + 1) is return x + 1');
}

{ // includes in another order
  const body = L('int main(void) {', '    printf("%d", abs(-1));', '    return 0;', '}');
  const r = computeDiffs(L('#include <stdlib.h>', '#include <stdio.h>', body), L('#include <stdio.h>', '#include <stdlib.h>', body));
  check('includes in another order: no differences', bad(r).length === 0, show(bad(r)));
  check('includes in another order: rows keep their own line numbers',
    r.diffs[0].actualLine === 2 && r.diffs[1].actualLine === 1, `${r.diffs[0].actualLine}, ${r.diffs[1].actualLine}`);
  const r2 = computeDiffs(L('#include <string.h>', '#include <stdlib.h>', '#include <stdio.h>', body), L('#include <stdio.h>', '#include <stdlib.h>', body));
  check('an include the reference lacks is still extra', bad(r2).length === 1 && bad(r2)[0].status === 'extra' && bad(r2)[0].actualLine === 1, show(bad(r2)));
}

/* ── Every reference in the pack ──────────────────────────── */

const pack = vm.runInContext('typeof codingStarterPack === "function" ? codingStarterPack() : null', ctx);
const sources = [];
if (pack) {
  pack.challenges.forEach(c => (c.variants || []).forEach(v => {
    const files = (v.files || []).filter(f => (f.code || '').trim());
    if (files.length) files.forEach(f => sources.push({ id: c.id + '/' + (f.name || 'main') + (f.ext || '.c'), code: f.code }));
    else if ((v.code || '').trim()) sources.push({ id: c.id, code: v.code });
  }));
}
check('the pack loaded', sources.length > 100, `${sources.length} reference files`);

/** Every name changed, through the lexer so quotes and directives are left alone. */
function renamed(code) {
  const map = new Map();
  lex(code).forEach(t => { if (t.k === 'id' && !RESERVED.has(t.t)) map.set(t.t, t.t + '_q'); });
  return renameC(code, map);
}
/** Braces moved to their own lines, `} else {` split in three. */
function allman(code) {
  return code.split('\n').map(line => {
    let m = line.match(/^(\s*)\}\s*else\b(.*?)\s*\{\s*$/);
    if (m) return `${m[1]}}\n${m[1]}else${m[2]}\n${m[1]}{`;
    m = line.match(/^(\s*)(\S.*?)\s*\{\s*$/);
    if (m && !/^#/.test(m[2]) && !/\/\/|\/\*/.test(m[2])) return `${m[1]}${m[2]}\n${m[1]}{`;
    return line;
  }).join('\n');
}

/** The other way of writing the same statements: x += y <-> x = x + y, i++ <-> ++i, return x <-> return (x). */
let flips = 0;
function otherStyle(code) {
  return code.split('\n').map(line => {
    let m = line.match(/^(\s*)([A-Za-z_]\w*) ([-+*\/%])= ([A-Za-z_]\w*|\d+);(\s*)$/);
    if (m && !RESERVED.has(m[2])) { flips++; return `${m[1]}${m[2]} = ${m[2]} ${m[3]} ${m[4]};${m[5]}`; }
    m = line.match(/^(\s*)([A-Za-z_]\w*) = \2 ([-+*\/%]) ([A-Za-z_]\w*|\d+);(\s*)$/);
    if (m && !RESERVED.has(m[2])) { flips++; return `${m[1]}${m[2]} ${m[3]}= ${m[4]};${m[5]}`; }
    m = line.match(/^(\s*)([A-Za-z_]\w*)(\+\+|--);(\s*)$/);
    if (m && !RESERVED.has(m[2])) { flips++; return `${m[1]}${m[3]}${m[2]};${m[4]}`; }
    m = line.match(/^(\s*)return ([^;()"']+);(\s*)$/);
    if (m) { flips++; return `${m[1]}return (${m[2]});${m[3]}`; }
    m = line.match(/^(\s*for \(.*;.*; )([A-Za-z_]\w*)\+\+(\).*)$/);
    if (m) { flips++; return `${m[1]}++${m[2]}${m[3]}`; }
    return line;
  }).join('\n');
}

let worst = 0;
sources.forEach(s => {
  const toks = lex(s.code);
  check(`lexer gives back ${s.id}`, toks.map(t => t.t).join('') === s.code);
  check(`canon keeps the lines of ${s.id}`, canon(s.code).split('\n').length === s.code.split('\n').length);
  const t0 = Date.now();
  const same = computeDiffs(s.code, s.code);
  const ren = computeDiffs(renamed(s.code), s.code);
  const lay = computeDiffs(allman(renamed(s.code)), s.code);
  const sty = computeDiffs(otherStyle(allman(renamed(s.code))), s.code);
  worst = Math.max(worst, Date.now() - t0);
  check(`${s.id} against itself`, bad(same).length === 0, show(bad(same)));
  check(`${s.id} with every name changed`, bad(ren).length === 0, show(bad(ren).slice(0, 4)));
  check(`${s.id} renamed, braces on their own lines`, bad(lay).length === 0, show(bad(lay).slice(0, 4)));
  check(`${s.id} renamed, braces moved, other statement style`, bad(sty).length === 0, show(bad(sty).slice(0, 4)));
});
check('the other-style pass rewrote something', flips > 100, `${flips} lines rewritten`);

{ // a long program still compares quickly
  let a = 'int main(void) {\n', b = 'int main(void) {\n';
  for (let i = 0; i < 400; i++) {
    a += `    int v${i} = ${i};\n    printf("%d\\n", v${i} * 2);\n`;
    b += `    int w${i} = ${i};\n    printf("%d\\n", w${i} * 2);\n`;
  }
  const t0 = Date.now();
  const r = computeDiffs(a + '}\n', b + '}\n');
  const ms = Date.now() - t0;
  check('800-line program with every name changed', bad(r).length === 0, show(bad(r).slice(0, 3)));
  check('800-line program in under 3 s', ms < 3000, ms + ' ms');
}

console.log(`${pass} passed, ${fail} failed  (${sources.length} pack references, slowest ${worst} ms)`);
process.exit(fail ? 1 : 0);
