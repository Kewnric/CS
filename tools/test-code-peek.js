#!/usr/bin/env node
/* ============================================================
   TEST-CODE-PEEK.JS — the target peek's merge, run under Node
   ------------------------------------------------------------
   js/code-peek.js decides, line by line and token by token, how your code
   and the target are drawn together. That half has no DOM, so it is loaded
   here with js/syntax.js into one context and checked against cases that
   were wrong once.

     node tools/test-code-peek.js .

   A row is written `kind|text`: in a merged line the target's missing pieces
   are ⟦faint⟧ and your different pieces are ⟪underlined⟫.
   ============================================================ */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

const root = path.resolve(process.argv[2] || '.');
const ctx = {
  console,
  document: { addEventListener() {}, body: { dataset: {} } },
  window: { addEventListener() {} }
};
vm.createContext(ctx);
for (const f of ['js/syntax.js', 'js/code-peek.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
const G = name => vm.runInContext(`typeof ${name} === 'undefined' ? undefined : ${name}`, ctx);

/* ── Reading what is drawn ─────────────────────────────────── */

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" };

/** Drawn HTML to text, with the faint and underlined pieces bracketed. */
function marks(html) {
  let out = '';
  const stack = [];
  const re = /<span class="([^"]*)">|<\/span>|<[^>]+>|&(amp|lt|gt|quot|#39);|[^<&]+|[\s\S]/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[1] !== undefined) {
      const close = /\bcp-ghost\b/.test(m[1]) ? '⟧' : /\bcp-wrong\b/.test(m[1]) ? '⟫' : '';
      out += close === '⟧' ? '⟦' : close === '⟫' ? '⟪' : '';
      stack.push(close);
    } else if (m[0] === '</span>') out += stack.pop() || '';
    else if (m[0][0] === '<') continue;
    else if (m[2]) out += ENT[m[2]];
    else out += m[0];
  }
  return out;
}

/** Each character's classes, outermost first: 'a.b|a.b|c|…' (a test's own reading of the HTML). */
function classesPerChar(html) {
  const out = [];
  const stack = [];
  const re = /<span class="([^"]*)">|<\/span>|<[^>]+>|&(amp|lt|gt|quot|#39);|[^<&]|[\s\S]/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[1] !== undefined) stack.push(m[1]);
    else if (m[0] === '</span>') stack.pop();
    else if (m[0][0] === '<') continue;
    else out.push(stack.filter(c => !/^cp-/.test(c)).join('.'));
  }
  return out.join('|');
}

/** The rows and each row's drawn code, the way the overlay draws them. */
function render(user, target, opts) {
  return G('peekRender')(user, target, opts);
}

const rowsOf = (user, target, opts) => {
  const r = render(user, target, opts);
  return r.rows.map((row, i) => row.kind + '|' + marks(r.codeHTML[i]));
};
const countsOf = (user, target, opts) => {
  const c = render(user, target, opts).counts || {};
  return { missing: c.missing, incomplete: c.incomplete, different: c.different };
};
const rowsHTMLOf = (user, target) => render(user, target).codeHTML;
const tokensOf = line => G('peekTokenize')(line)[0].filter(t => t.k === 'x').map(t => t.t);

/* ── Checks ────────────────────────────────────────────────── */

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; return; }
  fail++;
  console.log('FAIL  ' + name + (detail ? '\n      ' + detail : ''));
}
function eq(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  check(name, g === w, 'got  ' + g + '\n      want ' + w);
}
function run(name, fn) {
  try { fn(); } catch (e) { fail++; console.log('FAIL  ' + name + ' threw\n      ' + (e && e.stack || e)); }
}

const answer = fs.readFileSync(path.join(root, 'tools/prefinal/pf-concert-gate/answer.c'), 'utf8').replace(/\r\n/g, '\n');
const T = 'memmove(L->elems+i+1, L->elems+i, sizeof(Fan) * (L->count-i));';

/* Task 1: a half-typed line merges into its target line. */
run('pairing', () => {
  const pairs = l => rowsOf(l + '\n', T + '\n')[0].startsWith('pair|');
  for (const l of ['memmove', 'memmove(', 'memmove(L', 'memmove(L->elems', 'memmove(L->elems)',
                   'memmove(L->elems);', 'memmove(L->elems+', 'memmove(L->elems+i)'])
    check('pairs: ' + l, pairs(l), rowsOf(l + '\n', T + '\n').join('  /  '));
  check('gibberish does not pair', !pairs('mem'));
  check('lone brace does not pair', !pairs('}'));
  check('lone semicolon does not pair', !pairs(';'));
  eq('prefix takes the next missing line',
     rowsOf('L->\n', 'L->elems[i] = f;\nL->count++;\n').slice(0, 2).map(r => r.split('|')[0]),
     ['pair', 'ghost']);
  check('identical source is all same', rowsOf(answer, answer).every(r => r.startsWith('same|')));
  check('empty editor: no pair, no extra', rowsOf('', answer).every(r => /^(ghost|same)\|/.test(r)));
});

/* Task 2: brackets by depth, only code underlined, an honest badge. */
run('brackets, underline, badge', () => {
  eq('closing bracket lands at its own depth',
     rowsOf('memmove(L->elems)\n', T + '\n')[0],
     'pair|memmove(L->elems⟦+i+1, L->elems+i, sizeof(Fan) * (L->count-i)⟧)⟦;⟧');
  eq('extra row: indentation is not underlined',
     rowsOf('    foo();\n', 'bar = 1;\n').find(r => r.startsWith('extra|')), 'extra|    ⟪foo();⟫');
  eq('counts: half-typed line is incomplete, not different',
     countsOf('memmove(L->elems)\n', T + '\n'), { missing: 0, incomplete: 1, different: 0 });
  eq('counts: a wrong token makes it different',
     countsOf('x = a - b;\n', 'x = a + b;\n'), { missing: 0, incomplete: 0, different: 1 });
  eq('counts: a line not written yet is missing',
     countsOf('a = 1;\n', 'a = 1;\nb = 2;\n'), { missing: 1, incomplete: 0, different: 0 });
  eq('counts: identical is all zero', countsOf(answer, answer), { missing: 0, incomplete: 0, different: 0 });
});

/* Task 3: colours come from the whole file, as in the editor. */
run('colours', () => {
  const src = 'int f(List* L)\n{\n  int i, result = -1;\n  /* one\n     two */\n  result = 0;\n  memmove(L->elems)\n}\n';
  const ref = src.replace('memmove(L->elems)', 'memmove(L->elems+i, x);');
  const html = rowsHTMLOf(src, ref);
  check('variable keeps its colour on another line', html[5].includes('<span class="syntax-var">result</span>'), html[5]);
  check('block comment middle line is a comment', /syntax-comment[^<]*>\s*two \*\//.test(html[4]), html[4]);
  check('function keeps its colour in a merged line', html[6].includes('<span class="syntax-stdlib">memmove</span>'), html[6]);
  // A matching file is drawn exactly as the editor colours it, character by character.
  const lines = classesPerChar(G('syntaxHighlight')(answer)).split('|');
  const byLine = [];
  let cur = [], k = 0;
  for (const ch of answer) { if (ch === '\n') { byLine.push(cur.join('|')); cur = []; k++; continue; } cur.push(lines[k++]); }
  byLine.push(cur.join('|'));
  const drawn = rowsHTMLOf(answer, answer);
  let bad = -1;
  drawn.forEach((h, i) => { if (bad < 0 && byLine[i] && classesPerChar(h) !== byLine[i]) bad = i; });
  check('identical source is coloured as the editor colours it', bad < 0,
        bad < 0 ? '' : 'line ' + (bad + 1) + ': ' + classesPerChar(drawn[bad]) + '\n      want ' + byLine[bad]);
});

/* Task 4: one rule for comments and blank lines; missing lines at your indentation. */
run('comments, blanks, indentation', () => {
  const kinds = rows => rows.map(r => r.split('|')[0]);
  eq('your comment takes the target comment, text ignored',
     kinds(rowsOf('// mine\nx = 1;\n', '// theirs\nx = 1;\n')), ['same', 'same', 'same']);
  eq('a blank line does not absorb a target comment',
     kinds(rowsOf('\nx = 1;\n', '// theirs\nx = 1;\n')), ['ghost', 'same', 'same', 'same']);
  eq('blank target lines open no row', rowsOf('a = 1;\nb = 2;\n', 'a = 1;\n\n\nb = 2;\n').length, 3);
  eq('trailing newline adds no row', rowsOf('int a;', 'int a;\n').length, 1);
  eq('ghost row uses your indentation (2 spaces vs 4)',
     rowsOf('if(x){\n  a = 1;\n}\n', 'if(x){\n    a = 1;\n    b = 2;\n}\n')[2], 'ghost|  b = 2;');
  eq('ghost row: target tabs, your spaces',
     rowsOf('if(x){\n  a = 1;\n}\n', 'if(x){\n\ta = 1;\n\tb = 2;\n}\n')[2], 'ghost|  b = 2;');
  eq('ghost row: target spaces, your tabs',
     rowsOf('if(x){\n\ta = 1;\n}\n', 'if(x){\n    a = 1;\n    b = 2;\n}\n')[2], 'ghost|\tb = 2;');
  eq('ghost row: nothing indented yet keeps the target\'s',
     rowsOf('', 'if(x){\n    b = 2;\n}\n')[1], 'ghost|    b = 2;');
  eq('comment-only ghost rows are not counted',
     countsOf('x = 1;\n', '// note\nx = 1;\n'), { missing: 0, incomplete: 0, different: 0 });
});

/* Task 5: exponent literals; a brace on its own line is not a mistake. */
run('tokens and braces', () => {
  eq('exponent is one token', tokensOf('x = 1.5e-3;'), ['x', '=', '1.5e-3', ';']);
  eq('hex minus is three tokens', tokensOf('0x1e-3'), ['0x1e', '-', '3']);
  check('your brace on its own line is not wrong',
     rowsOf('if(x)\n{\n  y = 1;\n}\n', 'if(x){\n  y = 1;\n}\n').every(r => r.startsWith('same|')),
     rowsOf('if(x)\n{\n  y = 1;\n}\n', 'if(x){\n  y = 1;\n}\n').join('  /  '));
  check('their brace on its own line is not missing',
     rowsOf('if(x){\n  y = 1;\n}\n', 'if(x)\n{\n  y = 1;\n}\n').every(r => r.startsWith('same|')),
     rowsOf('if(x){\n  y = 1;\n}\n', 'if(x)\n{\n  y = 1;\n}\n').join('  /  '));
  eq('a block brace after a statement is still compared',
     rowsOf('x = 1;\n{\n', 'x = 1;\n')[1].split('|')[0], 'extra');
  eq('the brace you wrote on its own line is drawn, the moved one is not',
     rowsOf('if(x)\n{\n', 'if(x){\n').slice(0, 2), ['same|if(x)', 'same|{']);
  eq('function body brace on its own line', rowsOf(answer.replace(/\)\n\{/, ') {'), answer).every(r => r.startsWith('same|')), true);
});

/* Final review: a missing head keeps its own-line brace. */
run('final review', () => {
  eq('a missing Allman head is drawn with its brace',
     rowsOf('', 'if(x)\n{\n  y = 1;\n}\n').slice(0, 4),
     ['ghost|if(x)', 'ghost|{', 'ghost|  y = 1;', 'ghost|}']);
  eq('the brace is not counted on its own',
     countsOf('', 'if(x)\n{\n  y = 1;\n}\n'), { missing: 3, incomplete: 0, different: 0 });
  // Reported: an empty function body against returnAllBooks. Your `}` closes the
  // function, so it is the target's LAST `}`, not the one closing the else.
  const lib = fs.readFileSync(path.join(root, 'tools/prefinal/pf-library-returns/answer.c'), 'utf8').replace(/\r\n/g, '\n');
  const head = lib.split('\n')[0];
  const rows = rowsOf(head + '\n{\n\n}\n', lib);
  const mine = rows.findIndex(r => r === 'same|}');
  eq('a brace not written yet: the lines after it still match',
     rowsOf('void f(){\n  if(x){\n    a = 1;\n  b = 2;\n}\n', 'void f(){\n  if(x){\n    a = 1;\n  }\n  b = 2;\n}\n')
       .map(r => r.split('|')[0]),
     ['same', 'same', 'same', 'ghost', 'same', 'same', 'same']);
  check('your closing brace is the function\'s closing brace',
        mine === rows.length - 2 && rows.slice(mine + 1).every(r => r.startsWith('same|')),
        rows.join('  /  '));
});

/* Setting: hide the target's comments that the starter code does not have. */
run('hide target-only comments', () => {
  const starter = 'int f(void)\n{\n  // --- Your Implementation ---\n}\n';
  const target = 'int f(void)\n{\n  // --- Your Implementation ---\n  //Shift elements down.\n  x = 1;   /* why x is 1 */\n  /* a block\n     over two lines */\n  return x;\n}\n';
  const mine = 'int f(void)\n{\n}\n';
  const hide = { hideComments: true, starter };
  eq('comments on by default', rowsOf(mine, target).filter(r => /Shift|why x|a block|two lines/.test(r)).length, 4);
  eq('hidden: only the starter\'s comment and the code are left',
     rowsOf(mine, target, hide),
     ['same|int f(void)', 'same|{', 'ghost|  // --- Your Implementation ---', 'ghost|  x = 1;', 'ghost|  return x;', 'same|}', 'same|']);
  eq('the starter\'s comment matches however it is spaced',
     rowsOf(mine, target, { hideComments: true, starter: '//   --- Your   Implementation ---' }).filter(r => /Implementation|Shift/.test(r)),
     ['ghost|  // --- Your Implementation ---']);
  eq('hidden comments change no count', countsOf(mine, target, hide), countsOf(mine, target));
  eq('your own comments are always drawn',
     rowsOf('int f(void)\n{\n  // my note\n}\n', target, hide).filter(r => /my note/.test(r)).length, 1);
});

console.log(`${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
