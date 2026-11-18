/* ============================================================
   DIFF.JS — Character-Level Diff Engine with Comment Stripping
   ============================================================ */

// --- Comment Stripping (Feature 2) ---
function stripComments(code) {
  if (!code) return '';
  let result = '';
  let i = 0;
  let inString = false;
  let stringChar = '';

  while (i < code.length) {
    // Handle string literals (don't strip comments inside strings)
    if (!inString && (code[i] === '"' || code[i] === "'")) {
      inString = true;
      stringChar = code[i];
      result += code[i];
      i++;
      continue;
    }

    if (inString) {
      if (code[i] === '\\' && i + 1 < code.length) {
        result += code[i] + code[i + 1];
        i += 2;
        continue;
      }
      if (code[i] === stringChar) {
        inString = false;
      }
      result += code[i];
      i++;
      continue;
    }

    // Single-line comment
    if (code[i] === '/' && i + 1 < code.length && code[i + 1] === '/') {
      // Skip until end of line (do not consume the newline character)
      while (i < code.length && code[i] !== '\n') i++;
      continue;
    }

    // Multi-line comment
    if (code[i] === '/' && i + 1 < code.length && code[i + 1] === '*') {
      i += 2;
      while (i < code.length && !(code[i] === '*' && i + 1 < code.length && code[i + 1] === '/')) {
        if (code[i] === '\n') result += '\n'; // Preserve newlines to keep lines synced!
        i++;
      }
      if (i < code.length) i += 2; // skip */
      continue;
    }

    result += code[i];
    i++;
  }

  return result;
}

// --- Character-Level LCS (Feature 1) ---
function computeCharLCS(a, b) {
  const n = a.length;
  const m = b.length;

  const dp = [];
  for (let i = 0; i <= n; i++) {
    dp[i] = new Array(m + 1).fill(0);
  }

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const matchA = new Set();
  const matchB = new Set();
  let i = n, j = m;

  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      matchA.add(i - 1);
      matchB.add(j - 1);
      i--; j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return { matchA, matchB, lcsLength: dp[n][m] };
}

/**
 * The part of a raw source line that stripComments() removed — the trailing
 * `// …` or `/* … *\/`. Used to show the reference's comments beside the diff
 * without letting them take part in the comparison.
 */
function diffLineComment(raw, stripped) {
  if (!raw) return '';
  const r = raw, s = stripped || '';
  if (r.trimEnd() === s.trimEnd()) return '';
  let i = 0;
  while (i < r.length && i < s.length && r[i] === s[i]) i++;
  return r.slice(i).trim();
}

/* --- Word-level granularity -------------------------------------------------
   Character LCS is precise but noisy: rename `celsius` to `temp` and you get a
   scatter of red letters instead of one changed word. Tokenising first makes
   the diff read the way a person reads code. */
function diffTokenize(line) {
  // identifiers/numbers, whitespace runs, then any single other character
  return line.match(/[A-Za-z_]\w*|\d+(?:\.\d+)?|\s+|[^\s\w]/g) || [];
}

function computeWordDiffs(actualLine, expectedLine) {
  const ta = diffTokenize(actualLine);
  const te = diffTokenize(expectedLine);
  // Compare on the non-whitespace tokens only, exactly as the char path ignores
  // spaces, then map the verdicts back onto the full token list.
  const idxA = [], idxE = [];
  ta.forEach((t, i) => { if (t.trim()) idxA.push(i); });
  te.forEach((t, i) => { if (t.trim()) idxE.push(i); });
  const { matchA, matchB } = computeCharLCS(idxA.map(i => ta[i]), idxE.map(i => te[i]));

  const expectedSet = new Set(idxE.map(i => te[i]));
  const actualChars = [];
  let k = 0;
  ta.forEach((t) => {
    if (!t.trim()) { actualChars.push({ char: t, status: 'neutral' }); return; }
    if (matchA.has(k)) actualChars.push({ char: t, status: 'match' });
    else actualChars.push({ char: t, status: expectedSet.has(t) ? 'offset' : 'wrong' });
    k++;
  });

  const expectedChars = [];
  k = 0;
  te.forEach((t) => {
    if (!t.trim()) { expectedChars.push({ char: t, status: 'neutral' }); return; }
    expectedChars.push({ char: t, status: matchB.has(k) ? 'match' : 'missing' });
    k++;
  });

  const total = Math.max(idxA.length, idxE.length) || 1;
  return { actualChars, expectedChars, ratio: matchA.size / total };
}

/**
 * Char- or word-level diff for one line pair, per the caller's granularity.
 * Pass computeDiffs' `names` when it compared with names ignored, so the
 * highlight agrees with the comparison: a paired name is then a match.
 */
function computeLineDiffs(actualLine, expectedLine, granularity, names) {
  if (names && names.user && names.expected) {
    return _diffNamedLineDiffs(actualLine, expectedLine, granularity, names);
  }
  return granularity === 'word'
    ? computeWordDiffs(actualLine, expectedLine)
    : computeCharDiffs(actualLine, expectedLine);
}

function computeCharDiffs(actualLine, expectedLine) {
  const normA = actualLine.replace(/\s/g, '');
  const normE = expectedLine.replace(/\s/g, '');

  const mapA = [];
  for (let i = 0; i < actualLine.length; i++) {
    if (actualLine[i] !== ' ' && actualLine[i] !== '\t') {
      mapA.push(i);
    }
  }

  const mapE = [];
  for (let i = 0; i < expectedLine.length; i++) {
    if (expectedLine[i] !== ' ' && expectedLine[i] !== '\t') {
      mapE.push(i);
    }
  }

  const { matchA, matchB } = computeCharLCS(normA, normE);

  const actualChars = [];
  let normIdx = 0;
  for (let i = 0; i < actualLine.length; i++) {
    if (actualLine[i] === ' ' || actualLine[i] === '\t') {
      actualChars.push({ char: actualLine[i], status: 'neutral' });
    } else {
      if (matchA.has(normIdx)) {
        actualChars.push({ char: actualLine[i], status: 'match' });
      } else {
        const ch = actualLine[i];
        const existsInExpected = normE.includes(ch);
        actualChars.push({ char: ch, status: existsInExpected ? 'offset' : 'wrong' });
      }
      normIdx++;
    }
  }

  const expectedChars = [];
  normIdx = 0;
  for (let i = 0; i < expectedLine.length; i++) {
    if (expectedLine[i] === ' ' || expectedLine[i] === '\t') {
      expectedChars.push({ char: expectedLine[i], status: 'neutral' });
    } else {
      if (matchB.has(normIdx)) {
        expectedChars.push({ char: expectedLine[i], status: 'match' });
      } else {
        expectedChars.push({ char: expectedLine[i], status: 'missing' });
      }
      normIdx++;
    }
  }

  const matchCount = matchA.size;
  const totalChars = Math.max(normA.length, normE.length) || 1;
  const ratio = matchCount / totalChars;

  return { actualChars, expectedChars, ratio };
}

/* ============================================================
   NAMES ARE NOT THE ANSWER
   ------------------------------------------------------------
   A submission that passes every test and scores 100% was still being shown
   as five "minor differences", because it declared `int x, y` where the
   reference declared `int a, b`. Nothing was wrong with it. The comparison
   was reading identifiers literally, so every line mentioning a variable came
   back as almost-but-not-quite, and the one screen whose job is to tell you
   what you got wrong was pointing at things you got right.

   Alpha-renaming fixes that properly rather than by loosening the threshold.
   Each side is walked once, its own identifiers are numbered in order of
   first appearance, and the comparison runs on the numbered form:

       int x, y;  scanf("%d", &x);   ->   int v1, v2;  scanf("%d", &v1);
       int a, b;  scanf("%d", &a);   ->   int v1, v2;  scanf("%d", &v1);

   Identical, which is what they always were. Note that this is CONSISTENT
   renaming, not blanking: a program that swaps two variables' roles still
   differs, because v1 and v2 land in different places. Blanking every name to
   the same token would have called those equal, which would be worse than the
   bug being fixed.

   WHAT IS LEFT ALONE. Keywords and the standard library keep their names, or
   `printf` would match `scanf` and a wrong call would read as right. String
   and character literals are untouched, so a prompt is still compared word
   for word and `"%d"` never becomes `"%v1"`. Preprocessor lines are skipped
   whole, because `#include <stdio.h>` is not a variable declaration.
   ============================================================ */

/* Renaming these would let one stand in for another, which is the one thing
   this must never do. Types are included: `int` matching `float` would hide a
   real mistake. */
const DIFF_C_RESERVED = new Set((
  'auto break case char const continue default do double else enum extern float for goto if ' +
  'inline int long register restrict return short signed sizeof static struct switch typedef ' +
  'union unsigned void volatile while bool true false NULL EOF size_t FILE ' +
  'main printf scanf fprintf fscanf sprintf sscanf snprintf puts gets putchar getchar fgets fputs ' +
  'fopen fclose fread fwrite fseek ftell rewind fflush feof remove rename tmpfile ' +
  'malloc calloc realloc free exit abort atexit system qsort bsearch abs labs rand srand ' +
  'strlen strcpy strncpy strcat strncat strcmp strncmp strchr strrchr strstr strtok ' +
  'memcpy memset memmove memcmp atoi atof atol strtol strtod ' +
  'sqrt pow ceil floor round fabs log log10 sin cos tan time clock ' +
  'isalpha isdigit isalnum isupper islower isspace toupper tolower ' +
  /* The rest of what a C course reaches for. A library name that is not on
     this list gets paired with whatever sits in its place on the other side,
     so `fmod` against `remainder` would have read as the same call. */
  '_Bool defined stdin stdout stderr perror getc putc fgetc fputc ungetc freopen setbuf setvbuf getenv ' +
  'strdup strspn strcspn strpbrk memchr atoll strtoul strtoll div ldiv labs llabs ' +
  'isprint ispunct isxdigit iscntrl isgraph isblank ' +
  'exp exp2 log2 cbrt fmod fmin fmax hypot trunc lround atan atan2 asin acos sinh cosh tanh isnan isinf ' +
  'INT_MAX INT_MIN UINT_MAX LONG_MAX LONG_MIN LLONG_MAX LLONG_MIN CHAR_MAX CHAR_MIN SHRT_MAX SHRT_MIN ' +
  'FLT_MAX FLT_MIN DBL_MAX DBL_MIN RAND_MAX EXIT_SUCCESS EXIT_FAILURE SEEK_SET SEEK_CUR SEEK_END BUFSIZ ' +
  'CLOCKS_PER_SEC M_PI NAN INFINITY time_t clock_t tm localtime gmtime mktime strftime difftime ctime asctime ' +
  'int8_t int16_t int32_t int64_t uint8_t uint16_t uint32_t uint64_t intptr_t uintptr_t ptrdiff_t ' +
  'va_list va_start va_arg va_end assert'
).split(' '));

/**
 * Number every user-chosen identifier by order of first appearance.
 * Newlines are preserved exactly, so line i of the result is still line i.
 */
function alphaNormalizeC(code) {
  const src = String(code || '');
  const map = new Map();
  let next = 1;
  return src.replace(
    /("(?:[^"\\\n]|\\.)*")|('(?:[^'\\\n]|\\.)*')|(^[ \t]*#[^\n]*)|\b([A-Za-z_]\w*)\b/gm,
    (m, str, chr, pre, id) => {
      if (str || chr || pre) return m;          // literals and directives: as written
      if (DIFF_C_RESERVED.has(id)) return m;
      let to = map.get(id);
      if (!to) { to = 'v' + (next++); map.set(id, to); }
      return to;
    }
  );
}

/* ── C as tokens ──────────────────────────────────────────────
   Joining every token's text gives the source back exactly, newlines and all,
   so anything rewritten through these keeps line i on line i. Kinds:
     id   an identifier
     lit  a string, a character literal or a comment: compared as written
     pp   a directive that holds no names (`#include <stdio.h>`, `#pragma`),
          or the head of one that does (`#define`, `#ifndef`): the names after
          the head are ordinary ids, so `#define MAX 10` pairs with
          `#define SIZE 10` the way `int x` pairs with `int n`
     nl   a newline
     ws   other whitespace
     op   a number, an operator or a punctuation mark */
const _DIFF_LEX_RE = new RegExp([
  /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$(?![\s\S])))/.source,
  /("(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?)/.source,
  /(^[ \t]*#[ \t]*(?:define|undef|ifdef|ifndef|if|elif)\b)/.source,
  /(^[ \t]*#[^\n]*)/.source,
  /([A-Za-z_]\w*)/.source,
  /(\n)/.source,
  /([^\S\n]+)/.source,
  /(\d[\w.]*|\+\+|--|->|&&|\|\||<<=?|>>=?|[-+*\/%&|^!=<>]=|[^\s\w"'])/.source
].join('|'), 'gm');

function _diffLexC(src) {
  const s = String(src || '');
  const out = [];
  const re = _DIFF_LEX_RE;
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(s))) {
    out.push({
      t: m[0],
      k: m[1] || m[2] ? 'lit' : m[3] || m[4] ? 'pp' : m[5] ? 'id' : m[6] ? 'nl' : m[7] ? 'ws' : 'op'
    });
  }
  return out;
}

function _diffRenamable(tok) {
  return tok.k === 'id' && !DIFF_C_RESERVED.has(tok.t);
}

/* ── Code that is the same program written another way ─────────
   Each of these was being shown as a difference on a submission that passed
   every test, and the pack's own references use both forms of most of them,
   so whichever one a learner wrote, some program marked it:

     int main()  /  int main(void)               the same function
     ++i;  /  i += 1;  /  i = i + 1;  /  i++;    the same statement
     for (...; ...; ++i)  /  (...; i++)          the same loop
     sum = sum + a[i];  /  sum += a[i];          the same assignment
     return (x);  /  return x;                   the same return

   An increment is only rewritten where its value is thrown away -- a whole
   statement, or a for loop's step -- because that is the only place the forms
   agree: `printf("%d", ++i)` and `printf("%d", i++)` print different numbers
   and must stay different. `x = x op E` becomes `x op= E` only when E binds
   tighter than op, since `x = x - a + b` is not `x -= a + b`. Nothing here
   crosses a newline, so line i stays line i, and literals are never touched. */

/** The token stream with what each pass needs to know about where a token sits. */
function _diffStmtView(code) {
  const toks = _diffLexC(code);
  const sig = [];                                   // indices of the tokens that carry meaning
  toks.forEach((t, i) => { if (t.k !== 'ws' && t.k !== 'nl' && !(t.k === 'lit' && t.t[0] === '/')) sig.push(i); });
  const T = p => (p >= 0 && p < sig.length ? toks[sig[p]] : null);
  const txt = p => { const t = T(p); return t ? t.t : ''; };

  /* Where a value is discarded: the start of a statement (never inside
     parentheses, so a for loop's condition is not one), or a for loop's step,
     which runs from its second `;` to its `)`, each comma at that level
     starting another piece of it. */
  const parens = [];                                // per open '(': { kw, semis, from }
  const depth = new Array(sig.length).fill(0);      // parentheses open around each token
  const match = new Map();                          // '(' <-> ')'
  const ctrlClose = new Set();                      // ')' closing an if/while/for/switch header
  const stepOf = new Map();                         // a step-clause token -> the ')' that ends it
  for (let p = 0; p < sig.length; p++) {
    const t = txt(p);
    depth[p] = parens.length;
    if (t === '(') {
      const before = txt(p - 1);
      parens.push({ kw: /^(if|while|for|switch)$/.test(before) ? before : '', semis: 0, from: -1, at: p });
    } else if (t === ')') {
      const o = parens.pop();
      if (!o) continue;
      match.set(o.at, p); match.set(p, o.at);
      if (o.kw) ctrlClose.add(p);
      if (o.kw === 'for' && o.from >= 0) {
        for (let q = o.from; q < p; q++) if (depth[q] === depth[o.from]) stepOf.set(q, p);
      }
    } else if (t === ';' && parens.length) {
      const o = parens[parens.length - 1];
      if (o.kw === 'for' && ++o.semis === 2) o.from = p + 1;
    }
  }
  const atStatement = p => {
    if (depth[p] !== 0) return false;
    const b = txt(p - 1);
    // `:` ends a `case 1:` or a label; at the top level it cannot be a ?: that an assignment follows.
    return p === 0 || b === ';' || b === '{' || b === '}' || b === ':' || b === 'else' || b === 'do' || ctrlClose.has(p - 1);
  };
  /** How the expression starting at p ends, when its value is discarded there. */
  const endsAt = p => {
    const close = stepOf.get(p);
    if (close != null && (stepOf.get(p - 1) == null || txt(p - 1) === ',')) {
      return q => q === close || (txt(q) === ',' && stepOf.get(q) === close);
    }
    return atStatement(p) ? (q => txt(q) === ';') : null;
  };
  return {
    toks, sig, T, txt, match, endsAt,
    /* No newline between two tokens, so blanking what lies between keeps the lines. */
    sameLine: (p, q) => { for (let i = sig[p]; i <= sig[q]; i++) if (toks[i].k === 'nl' || toks[i].t.includes('\n')) return false; return true; },
    blank: (p, q) => { for (let i = sig[p] + 1; i <= sig[q]; i++) toks[i].t = ''; },
    text: () => toks.map(t => t.t).join('')
  };
}

const _DIFF_BINARY = new Set(['+', '-', '*', '/', '%', '<<', '>>', '<', '>', '<=', '>=', '==', '!=',
  '&', '^', '|', '&&', '||', '?', ':', '=', '+=', '-=', '*=', '/=', '%=', '&=', '^=', '|=', '<<=', '>>=', ',']);

/* x = x op E  ->  x op= E, when nothing at E's top level binds as loosely as op. */
function _diffCanonCompound(code) {
  const v = _diffStmtView(code);
  const { T, txt } = v;
  for (let p = 0; p < v.sig.length; p++) {
    const a = T(p);
    if (!a || a.k !== 'id' || DIFF_C_RESERVED.has(a.t) || txt(p + 1) !== '=' || txt(p + 2) !== a.t) continue;
    const op = txt(p + 3);
    if (!/^([-+*\/%&|^]|<<|>>)$/.test(op)) continue;
    const ends = v.endsAt(p);
    if (!ends) continue;
    const tighter = op === '+' || op === '-' ? new Set(['*', '/', '%']) : new Set();
    let q = p + 4, nest = 0, ok = q < v.sig.length, prevOperand = false;
    for (; q < v.sig.length; q++) {
      const t = txt(q), k = T(q).k;
      if (nest === 0 && q > p + 4 && ends(q)) break;
      if (t === '{' || t === '}' || t === ';') { ok = false; break; }
      if (t === '(' || t === '[') { nest++; prevOperand = false; continue; }
      if (t === ')' || t === ']') { if (--nest < 0) { ok = false; break; } prevOperand = true; continue; }
      if (nest === 0 && prevOperand && _DIFF_BINARY.has(t) && !tighter.has(t)) { ok = false; break; }
      if (k === 'id' || k === 'lit' || /^\d/.test(t)) prevOperand = true;
      else if (t !== '++' && t !== '--') prevOperand = false;   // a postfix ++ keeps the operand, a prefix one has none yet
    }
    if (!ok || q >= v.sig.length || q === p + 4 || !v.sameLine(p, q)) continue;
    v.T(p + 1).t = op + '=';
    v.blank(p + 1, p + 3);
    p = q;
  }
  return v.text();
}

/* ++i, i += 1, i -= 1  ->  i++, i--, where the value is discarded. */
function _diffCanonIncrement(code) {
  const v = _diffStmtView(code);
  const { T, txt } = v;
  for (let p = 0; p < v.sig.length; p++) {
    const ends = v.endsAt(p);
    if (!ends) continue;
    const a = T(p), b = T(p + 1);
    if (!a || !b) continue;
    let id = null, op = null, last = -1;
    if ((a.t === '++' || a.t === '--') && b.k === 'id' && ends(p + 2)) {                          // ++i
      id = b.t; op = a.t; last = p + 1;
    } else if (a.k === 'id' && (b.t === '+=' || b.t === '-=') && txt(p + 2) === '1' && ends(p + 3)) { // i += 1
      id = a.t; op = b.t[0] + b.t[0]; last = p + 2;
    }
    if (id && !DIFF_C_RESERVED.has(id) && v.sameLine(p, last)) {
      a.t = id + op;
      v.blank(p, last);
      p = last;
    }
  }
  return v.text();
}

/* `name(void)` declares the same function as `name()`; `return (x);` is `return x;`. */
function _diffCanonParens(code) {
  const v = _diffStmtView(code);
  const { T, txt, toks, sig } = v;
  for (let p = 1; p + 2 < sig.length; p++) {
    if (txt(p) === '(' && txt(p + 1) === 'void' && txt(p + 2) === ')' && T(p - 1).k === 'id' && v.sameLine(p, p + 2)) {
      v.blank(p, p + 2);
      T(p + 2).t = ')';
    }
  }
  for (let p = 0; p + 1 < sig.length; p++) {
    if (txt(p) !== 'return' || txt(p + 1) !== '(') continue;
    const c = v.match.get(p + 1);
    if (c == null || txt(c + 1) !== ';' || !v.sameLine(p, c)) continue;
    // `return(x)` has nothing between return and x once the bracket goes, so leave a space.
    T(p + 1).t = sig[p + 1] === sig[p] + 1 ? ' ' : '';
    T(c).t = '';
  }
  return toks.map(t => t.t).join('');
}

function _diffCanonC(code) {
  return _diffCanonParens(_diffCanonIncrement(_diffCanonCompound(String(code || ''))));
}

/* ============================================================
   PAIRING NAMES, NOT NUMBERING THEM
   ------------------------------------------------------------
   Numbering names by first appearance (alphaNormalizeC, still what the boss
   bar uses) is right only while both programs mention their names in the
   same order. One extra variable broke it:

       int r, x;  scanf("%d", &x);   ->   int v1, v2;  scanf("%d", &v2);
       int n;     scanf("%d", &n);   ->   int v1;      scanf("%d", &v1);

   and from there every line that used x was reported as "Different name: the
   reference calls this n, you wrote x" -- with "Ignore variable names" on. A
   different declaration order (`int b, a;`) did the same.

   So the names are paired by WHERE THEY ARE USED. Both programs are lined up
   token by token with any name allowed to stand against any other (keywords,
   the library, numbers and punctuation must match exactly), every place
   where your name sits against one of the reference's is a vote for that
   pair, and the pairs are taken strongest first, one partner each. x sat
   against n in every line, so x is n. A name of yours with no partner gets a
   name of its own that nothing in the reference has, so it still differs.

   Still consistent, never blanking: two variables used in each other's
   places are still a difference, because each can only be paired once.
   ============================================================ */

const _DIFF_PAIR_CELLS = 4000000;   // the token-alignment table, at most (8 MB)

/**
 * Pair the user's names with the reference's.
 * @returns {{user: Map<string,string>, expected: Map<string,string>}}
 *   each side's name -> the shared name it is compared under
 */
function diffPairNames(userCode, expectedCode) {
  const sig = src => _diffLexC(src).filter(t => t.k !== 'ws' && t.k !== 'nl');
  const A = sig(userCode), B = sig(expectedCode);
  const ANY = '\u0001';
  const ka = A.map(t => (_diffRenamable(t) ? ANY : t.t));
  const kb = B.map(t => (_diffRenamable(t) ? ANY : t.t));

  const votes = new Map();
  const vote = (i, j) => {
    if (ka[i] !== ANY) return;
    const key = A[i].t + '\u0000' + B[j].t;
    const v = votes.get(key);
    if (v) v.n++; else votes.set(key, { u: A[i].t, e: B[j].t, n: 1, at: j });
  };

  // What both share at the ends needs no table.
  let lo = 0;
  while (lo < ka.length && lo < kb.length && ka[lo] === kb[lo]) { vote(lo, lo); lo++; }
  let hiA = ka.length, hiB = kb.length;
  while (hiA > lo && hiB > lo && ka[hiA - 1] === kb[hiB - 1]) { hiA--; hiB--; vote(hiA, hiB); }

  const n = hiA - lo, m = hiB - lo;
  const aligned = !(n > 0 && m > 0) || n * m <= _DIFF_PAIR_CELLS;
  if (n > 0 && m > 0 && aligned) {
    const W = m + 1;
    const dp = new Uint16Array((n + 1) * W);        // LCS of the suffixes; min(n, m) <= 2000 here
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i * W + j] = ka[lo + i] === kb[lo + j]
          ? dp[(i + 1) * W + j + 1] + 1
          : Math.max(dp[(i + 1) * W + j], dp[i * W + j + 1]);
      }
    }
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (ka[lo + i] === kb[lo + j]) { vote(lo + i, lo + j); i++; j++; }
      else if (dp[(i + 1) * W + j] >= dp[i * W + j + 1]) i++;
      else j++;
    }
  }

  const u2e = new Map(), taken = new Set();
  [...votes.values()]
    .sort((x, y) => y.n - x.n || x.at - y.at)
    .forEach(v => { if (!u2e.has(v.u) && !taken.has(v.e)) { u2e.set(v.u, v.e); taken.add(v.e); } });

  const order = toks => [...new Set(toks.filter(_diffRenamable).map(t => t.t))];
  const uOrder = order(A), eOrder = order(B);
  if (!aligned) {
    // Too long to line up: what is left is paired by order of first appearance.
    const ul = uOrder.filter(x => !u2e.has(x)), el = eOrder.filter(x => !taken.has(x));
    for (let k = 0; k < Math.min(ul.length, el.length); k++) u2e.set(ul[k], el[k]);
  }

  const expected = new Map(), user = new Map();
  eOrder.forEach((name, k) => expected.set(name, 'v' + (k + 1)));
  let own = 0;
  uOrder.forEach(name => {
    const partner = u2e.get(name);
    user.set(name, partner != null ? expected.get(partner) : 'u' + (++own));
  });
  return { user, expected };
}

/** The source with every name replaced by the one it is compared under. */
function diffRenameC(code, names) {
  let out = '';
  for (const t of _diffLexC(code)) out += (t.k === 'id' && names.has(t.t)) ? names.get(t.t) : t.t;
  return out;
}

/* ── Line breaks are whitespace too ───────────────────────────
   With whitespace ignored, where a line breaks should not matter either, and
   the one place C programs disagree about it is the brace:

       if (n % 2 == 0) {          if (x % 2 == 0)
           ...                    {
       } else {                       ...
                                  }
                                  else
                                  {

   The right-hand one is a correct program and was coming back as seven
   differences. A line that is only `{` therefore joins the line above it, and
   so do an `else` after a closing brace and a do-while's `while (...);`.
   Both programs go through the same joins, so this can only remove a
   difference of layout, never hide one of content. The joined row keeps the
   first line's number. */
function _diffJoinsUp(prev, row) {
  if (row.norm === '{') return !/^#/.test(prev.norm);
  if (/^else\b/.test(row.stripped.trim())) return /\}$/.test(prev.norm);
  if (/^while\(.*\);$/.test(row.norm)) return prev.norm === '}';
  return false;
}

function _diffJoinLayout(rows, normalizeLine) {
  const glue = (x, y) => String(x).replace(/\s+$/, '') + ' ' + String(y).replace(/^\s+/, '');
  const out = [];
  rows.forEach(r => {
    const prev = out[out.length - 1];
    if (!prev || !_diffJoinsUp(prev, r)) { out.push(r); return; }
    // Comments stay beside the joined row: rebuild raw as the code plus them.
    const notes = [diffLineComment(prev.raw, prev.plain), diffLineComment(r.raw, r.plain)].filter(Boolean);
    prev.stripped = glue(prev.stripped, r.stripped);
    prev.norm = normalizeLine(prev.stripped);
    prev.plain = glue(prev.plain, r.plain);
    prev.raw = notes.length ? prev.plain + ' ' + notes.join(' ') : prev.plain;
  });
  return out;
}

/* `#include <stdlib.h>` above `#include <stdio.h>` is the same program as
   below it, but a line alignment cannot see a swap: it came back as one
   missing line and one extra. So the includes at the top of your file are
   put in the reference's order before aligning, any the reference does not
   have after them. Each row keeps its own line number, so the left panel
   can read 2, 1 there -- which is what you wrote. */
function _diffAlignIncludes(uRows, cRows) {
  const isInc = r => /^\s*#\s*include\b/.test(r.norm);
  const block = rows => {
    const s = rows.findIndex(isInc);
    if (s < 0) return null;
    let e = s;
    while (e < rows.length && isInc(rows[e])) e++;
    return { s, e };
  };
  const bu = block(uRows), bc = block(cRows);
  if (!bu || !bc) return uRows;
  const pool = uRows.slice(bu.s, bu.e), ordered = [];
  cRows.slice(bc.s, bc.e).forEach(t => {
    const i = pool.findIndex(r => r.norm === t.norm);
    if (i >= 0) ordered.push(pool.splice(i, 1)[0]);
  });
  return uRows.slice(0, bu.s).concat(ordered, pool, uRows.slice(bu.e));
}

/* ── Highlighting under paired names ──────────────────────────
   The line comparison was renaming and the highlight inside a line was not:
   `printf("%d is Even", x);` against `printf("%d is Even\n", n);` was paired
   correctly as one changed line, then drawn with `x` and `n` in red beside
   the `\n` that was the real difference. Here a paired name is one unit,
   compared under its shared name, so x against n is a match and only the
   `\n` is marked. Names inside quotes are text, as everywhere else. */
function _diffLineUnits(line, names, granularity) {
  const units = [];
  _diffLexC(line).forEach(tok => {
    if (tok.k === 'ws' || tok.k === 'nl') { units.push({ text: tok.t, key: null }); return; }
    if (tok.k === 'id' && names.has(tok.t)) { units.push({ text: tok.t, key: '\u0001' + names.get(tok.t) }); return; }
    const pieces = granularity === 'word' ? diffTokenize(tok.t) : Array.from(tok.t);
    pieces.forEach(p => units.push({ text: p, key: /^\s+$/.test(p) ? null : p }));
  });
  return units;
}

/* The same LCS as computeCharLCS, walked from the front, so among equally long
   answers the one that keeps the shared beginning together wins. Walked from
   the back, `"%d is Even"` against `"%d is Even\n"` matched your final n to
   the n of `\n` and marked the n of "Even" as missing, beside the backslash. */
function _diffLcsFromFront(a, b) {
  const n = a.length, m = b.length, W = m + 1;
  const dp = new Uint16Array((n + 1) * W);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * W + j] = a[i] === b[j] ? dp[(i + 1) * W + j + 1] + 1 : Math.max(dp[(i + 1) * W + j], dp[i * W + j + 1]);
    }
  }
  const matchA = new Set(), matchB = new Set();
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { matchA.add(i++); matchB.add(j++); }
    else if (dp[(i + 1) * W + j] >= dp[i * W + j + 1]) i++;
    else j++;
  }
  return { matchA, matchB, lcsLength: dp[0] };
}

function _diffNamedLineDiffs(actualLine, expectedLine, granularity, names) {
  const ua = _diffLineUnits(actualLine, names.user, granularity);
  const ue = _diffLineUnits(expectedLine, names.expected, granularity);
  const ia = [], ie = [];
  ua.forEach((u, i) => { if (u.key != null) ia.push(i); });
  ue.forEach((u, i) => { if (u.key != null) ie.push(i); });
  const ka = ia.map(i => ua[i].key), ke = ie.map(i => ue[i].key);
  const { matchA, matchB } = _diffLcsFromFront(ka, ke);
  const keysE = new Set(ke);

  const stA = ua.map(() => 'neutral'), stE = ue.map(() => 'neutral');
  ia.forEach((ui, k) => { stA[ui] = matchA.has(k) ? 'match' : (keysE.has(ka[k]) ? 'offset' : 'wrong'); });
  ie.forEach((ui, k) => { stE[ui] = matchB.has(k) ? 'match' : 'missing'; });
  return {
    actualChars: ua.map((u, i) => ({ char: u.text, status: stA[i] })),
    expectedChars: ue.map((u, i) => ({ char: u.text, status: stE[i] })),
    ratio: matchA.size / (Math.max(ka.length, ke.length) || 1)
  };
}

/**
 * Line-level alignment.
 *
 * @param {string} userCode
 * @param {string} expectedCode
 * @param {object} [opts]
 *   .ignoreComments  strip `//` and `/* *\/` before comparing (default true)
 *   .ignoreWhitespace  collapse all whitespace before comparing (default true);
 *                      when false, indentation and inner spacing count
 *   .ignoreNames     pair each of your names with the reference's by where it
 *                      is used (default true), so `int x, y` matches `int a, b`;
 *                      the pairs come back as `names` for the highlight
 *                      (computeLineDiffs) and the explanations to use too
 *
 * Every returned row carries the ORIGINAL 1-based line number it came from in
 * each file (actualLine / expectedLine) plus the untouched source line
 * (actualRaw / expectedRaw). Blank lines and comments are dropped from the
 * comparison, so the row index is NOT a line number — anything that wants to
 * point back at the editor has to use these.
 */
function computeDiffs(userCode, expectedCode, opts) {
  const o = opts || {};
  const ignoreComments = o.ignoreComments !== false;
  const ignoreWhitespace = o.ignoreWhitespace !== false;
  const ignoreNames = o.ignoreNames !== false;

  const rawULines = String(userCode || '').split('\n');
  const rawCLines = String(expectedCode || '').split('\n');
  // stripComments preserves newlines, so stripped line i is still raw line i.
  let strippedUser = ignoreComments ? stripComments(userCode) : String(userCode || '');
  let strippedExpected = ignoreComments ? stripComments(expectedCode) : String(expectedCode || '');
  /* Only what is COMPARED is renamed. rawULines / rawCLines below are the
     untouched source and are what gets displayed, so the panels still show
     the names you actually wrote. Both passes preserve newlines, so line i
     here is still line i there. */
  /* Snapshot before the renaming: comments gone, names as written. THIS is
     what the panels display and what the explanations quote. Rendering the
     renamed form instead is what put `int v1;` on screen where the student
     wrote `int score;`, and, worse, made diffLineComment below hand back the
     whole rest of the line as if it were a trailing comment -- it recovers a
     comment by walking the common prefix of raw and stripped, and renaming
     ends that prefix at the first identifier. Both panels were showing the
     comparison's own scratch names plus a fake comment made of the real ones. */
  const plainULines = strippedUser.split('\n');
  const plainCLines = strippedExpected.split('\n');

  let names = null;
  if (ignoreNames) {
    strippedUser = _diffCanonC(strippedUser);
    strippedExpected = _diffCanonC(strippedExpected);
    names = diffPairNames(strippedUser, strippedExpected);
    strippedUser = diffRenameC(strippedUser, names.user);
    strippedExpected = diffRenameC(strippedExpected, names.expected);
  }

  const normalizeLine = ignoreWhitespace
    ? (s => s.replace(/\s+/g, '').trim())
    : (s => s.replace(/\s+$/, ''));

  // Process data using strictly the stripped versions
  const stripULines = strippedUser.split('\n');
  let uLinesData = [];
  for (let i = 0; i < stripULines.length; i++) {
    const stripped = stripULines[i];
    const norm = normalizeLine(stripped);
    if (norm.trim() !== '') {
      uLinesData.push({ stripped: stripped, norm: norm, raw: rawULines[i] != null ? rawULines[i] : stripped, plain: plainULines[i] != null ? plainULines[i] : stripped, lineNo: i + 1 });
    }
  }

  const stripCLines = strippedExpected.split('\n');
  let cLinesData = [];
  for (let i = 0; i < stripCLines.length; i++) {
    const stripped = stripCLines[i];
    const norm = normalizeLine(stripped);
    if (norm.trim() !== '') {
      cLinesData.push({ stripped: stripped, norm: norm, raw: rawCLines[i] != null ? rawCLines[i] : stripped, plain: plainCLines[i] != null ? plainCLines[i] : stripped, lineNo: i + 1 });
    }
  }

  // Where a brace or an else sits is layout, once whitespace is ignored (see _diffJoinLayout).
  if (ignoreWhitespace) {
    uLinesData = _diffJoinLayout(uLinesData, normalizeLine);
    cLinesData = _diffJoinLayout(cLinesData, normalizeLine);
  }
  uLinesData = _diffAlignIncludes(uLinesData, cLinesData);

  const n = uLinesData.length;
  const m = cLinesData.length;

  /* Memoize per-pair line similarity: each pair is needed once in the DP fill
     and again during traceback, and the underlying char-LCS is expensive.
     The cheap upper bound (2·min/(len sum) — the best LCS can ever score)
     skips the char-LCS entirely when even a perfect subsequence couldn't
     clear the 0.5 "partial" threshold.

     KEYED BY CONTENT, NOT POSITION. Indices made every pair look distinct, so
     a program that says `printf("%d\n", x);` in ten places compared ten
     identical pairs against each of the reference's. Interning the compared
     text to an integer collapses those to one char-LCS while keeping the key a
     number, which real code hits constantly — the repeated line is the norm in
     a teaching exercise, not the exception. */
  const uIntern = new Map(), cIntern = new Map();
  const uId = new Array(n), cId = new Array(m);
  for (let i = 0; i < n; i++) {
    const t = uLinesData[i].stripped;
    let id = uIntern.get(t);
    if (id === undefined) { id = uIntern.size; uIntern.set(t, id); }
    uId[i] = id;
  }
  for (let j = 0; j < m; j++) {
    const t = cLinesData[j].stripped;
    let id = cIntern.get(t);
    if (id === undefined) { id = cIntern.size; cIntern.set(t, id); }
    cId[j] = id;
  }
  const cSpan = cIntern.size + 1;

  const simCache = new Map();
  function simAt(i, j) {
    const key = uId[i] * cSpan + cId[j];
    let s = simCache.get(key);
    if (s === undefined) {
      const a = uLinesData[i].norm, b = cLinesData[j].norm;
      const upperBound = (a.length + b.length) > 0 ? (2 * Math.min(a.length, b.length)) / (a.length + b.length) : 1;
      s = upperBound <= 0.5 ? 0 : calculateSimilarity(uLinesData[i].stripped, cLinesData[j].stripped);
      simCache.set(key, s);
    }
    return s;
  }

  const dp = Array(n + 1).fill(null).map(() => Array(m + 1).fill(0));

  for (let i = 1; i <= n; i++) dp[i][0] = i;
  for (let j = 1; j <= m; j++) dp[0][j] = j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const normU = uLinesData[i - 1].norm;
      const normC = cLinesData[j - 1].norm;

      if (normU === normC) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        /* DO NOT MEASURE A SIMILARITY THAT CANNOT CHANGE THE ANSWER.
           Substitution costs 0.5 at best and 2 at worst, so when even the best
           of those cannot beat inserting or deleting, the cell is `best`
           whatever the similarity turns out to be — and the char-LCS behind it
           is the expensive part of this whole function. The traceback asks for
           the ones it actually walks, which is O(n+m) cells, and the memo
           serves them then.

           Exact, not an approximation: skipping only where both possible
           substitution costs land on or above `best` leaves every dp value
           identical to what the unconditional version produced. */
        const best = Math.min(dp[i - 1][j], dp[i][j - 1]) + 1;
        if (dp[i - 1][j - 1] + 0.5 >= best) {
          dp[i][j] = best;
        } else {
          const sim = simAt(i - 1, j - 1);
          const subCost = sim > 0.5 ? 0.5 : 2;
          dp[i][j] = Math.min(best, dp[i - 1][j - 1] + subCost);
        }
      }
    }
  }

  let i2 = n, j2 = m;
  const diffs = [];
  let totalScore = 0;

  while (i2 > 0 || j2 > 0) {
    if (i2 > 0 && j2 > 0) {
      const uData = uLinesData[i2 - 1];
      const cData = cLinesData[j2 - 1];

      if (uData.norm === cData.norm && dp[i2][j2] === dp[i2 - 1][j2 - 1]) {
        diffs.unshift({
          status: 'perfect',
          actual: uData.stripped,
          expected: cData.stripped,
          actualLine: uData.lineNo, expectedLine: cData.lineNo,
          actualRaw: uData.raw, expectedRaw: cData.raw,
          actualPlain: uData.plain, expectedPlain: cData.plain
        });
        totalScore += 1;
        i2--; j2--;
        continue;
      }

      const sim = simAt(i2 - 1, j2 - 1);
      const subCost = sim > 0.5 ? 0.5 : 2;

      if (dp[i2][j2] === dp[i2 - 1][j2 - 1] + subCost) {
        const lineStatus = sim > 0.5 ? 'partial' : 'wrong';

        diffs.unshift({
          status: lineStatus,
          actual: uData.stripped,
          expected: cData.stripped,
          actualLine: uData.lineNo, expectedLine: cData.lineNo,
          actualRaw: uData.raw, expectedRaw: cData.raw,
          actualPlain: uData.plain, expectedPlain: cData.plain
        });
        totalScore += (sim > 0.5 ? 0.8 : 0);
        i2--; j2--;
        continue;
      }
    }

    if (i2 > 0 && (j2 === 0 || dp[i2][j2] === dp[i2 - 1][j2] + 1)) {
      diffs.unshift({
        status: 'extra',
        actual: uLinesData[i2 - 1].stripped,
        expected: null,
        actualLine: uLinesData[i2 - 1].lineNo, expectedLine: null,
        actualRaw: uLinesData[i2 - 1].raw, expectedRaw: null,
        actualPlain: uLinesData[i2 - 1].plain, expectedPlain: null
      });
      i2--;
    } else {
      diffs.unshift({
        status: 'missing',
        actual: null,
        expected: cLinesData[j2 - 1].stripped,
        actualLine: null, expectedLine: cLinesData[j2 - 1].lineNo,
        actualRaw: null, expectedRaw: cLinesData[j2 - 1].raw,
        actualPlain: null, expectedPlain: cLinesData[j2 - 1].plain
      });
      j2--;
    }
  }

  return { diffs, scoreCount: totalScore, cLinesLen: cLinesData.length || 1, names };
}

/* ============================================================
   MISTAKE EXPLANATIONS
   ------------------------------------------------------------
   A rule-based read of a single mismatched line. These are the C mistakes that
   actually recur — a missing `&` in scanf, `%d` where `%f` belongs, `=` for
   `==` — and naming them is worth more than the red highlight alone.

   Rules are ordered most-specific first and the first hit wins, so a line with
   two problems reports the one that is most likely the real cause. Returns null
   when nothing beyond "these differ" can be said honestly.
   ============================================================ */

/** All printf/scanf conversion specifiers in a line, e.g. ['%.2f', '%d']. */
function _diffSpecifiers(s) {
  return (s.match(/%[-+ #0]*[\d.*]*(?:hh|h|ll|l|L|z|j|t)?[diouxXeEfgGaAcspn%]/g) || [])
    .filter(x => x !== '%%');
}

function _diffIdents(s) {
  return (s.match(/[A-Za-z_]\w*/g) || []);
}

function _diffCount(s, ch) {
  let n = 0;
  for (let i = 0; i < s.length; i++) if (s[i] === ch) n++;
  return n;
}

/**
 * @param {object} row a diff row from computeDiffs
 * @param {{bracesBalanced:boolean, userLines:string[], names?:object}} [ctx] the whole submission,
 *   whitespace-stripped, and computeDiffs' `names` when it compared with names ignored
 * @returns {?{text:string, kind:string}} short explanation, or null
 */
function explainDiffLine(row, ctx) {
  if (!row || row.status === 'perfect') return null;
  /* Read the names as written. On the renamed form the one rule that quotes
     identifiers could only ever say "the reference calls this v1, you wrote
     v1" -- true of the comparison, meaningless to the reader. */
  const a = (row.actualPlain != null ? row.actualPlain : (row.actual || '')).trim();
  const e = (row.expectedPlain != null ? row.expectedPlain : (row.expected || '')).trim();

  if (row.status === 'missing') {
    if (/^#include/.test(e)) {
      const h = (e.match(/<([^>]+)>|"([^"]+)"/) || [])[0] || 'the header';
      return { kind: 'missing', text: `Missing \`#include ${h}\` — the library functions below need it declared.` };
    }
    if (/^\s*}\s*$/.test(e)) {
      // Braces that balance mean the code is shaped differently (an if with no
      // braces), not broken -- and it may well have passed every test.
      if (ctx && ctx.bracesBalanced) {
        return { kind: 'missing', text: 'The reference closes a block here. Your braces still balance, so your code is laid out differently rather than missing one.' };
      }
      return { kind: 'missing', text: 'A closing brace is missing — a block you opened is never closed.' };
    }
    if (/\breturn\b/.test(e)) return { kind: 'missing', text: 'The reference returns a value here; your function ends without it.' };
    const head = e.replace(/\s+/g, '').replace(/\{$/, '');
    if (ctx && head.length >= 6 && (ctx.userLines || []).some(l => l.startsWith(head))) {
      return { kind: 'missing', text: 'You have this line in another form — it starts the same way and continues differently, so it was paired with a different line.' };
    }
    return { kind: 'missing', text: "This line isn't in your code at all." };
  }
  if (row.status === 'extra') {
    return { kind: 'extra', text: "This line isn't in the reference solution — it may be left over or doing work that belongs elsewhere." };
  }

  // ── Both sides exist: find what changed ──

  // scanf without the address-of operator
  if (/\bscanf\s*\(/.test(e) && /\bscanf\s*\(/.test(a)) {
    const ampE = _diffCount(e, '&'), ampA = _diffCount(a, '&');
    if (ampE > ampA) {
      return { kind: 'scanf', text: 'scanf needs the ADDRESS of the variable — write `&name`, not `name`. Without `&` it reads into a garbage location.' };
    }
  }

  // Format-specifier mismatch
  const specE = _diffSpecifiers(e), specA = _diffSpecifiers(a);
  if (specE.length && specA.length && specE.join() !== specA.join()) {
    const bad = specA.find((s, i) => s !== specE[i]) || specA[0];
    const good = specE[specA.indexOf(bad)] || specE[0];
    return { kind: 'format', text: `Wrong conversion specifier: the reference uses \`${good}\` where you wrote \`${bad}\`.` };
  }
  if (specE.length && !specA.length && /printf|scanf/.test(a)) {
    return { kind: 'format', text: `This call needs a conversion specifier — the reference uses \`${specE[0]}\`.` };
  }

  // Trailing newline in printf
  if (/printf/.test(e) && /\\n/.test(e) && /printf/.test(a) && !/\\n/.test(a)) {
    return { kind: 'newline', text: 'The reference ends its output with `\\n`; yours does not, so the next output runs onto the same line.' };
  }

  // Assignment where a comparison belongs
  if (/\b(if|while)\s*\(/.test(e) && /[^=!<>]=[^=]/.test(a) && /==/.test(e) && !/==/.test(a)) {
    return { kind: 'assign', text: '`=` assigns, `==` compares. Inside a condition you almost always want `==`.' };
  }

  // Integer division where the reference forces floating point
  if (/\d+\.\d+/.test(e) && !/\d+\.\d+/.test(a) && /[/*]/.test(e)) {
    return { kind: 'intdiv', text: 'The reference uses floating-point literals (e.g. `9.0 / 5.0`). With two integers, C throws the fraction away before the assignment.' };
  }

  // Missing statement terminator
  if (/;\s*$/.test(e) && !/;\s*$/.test(a) && !/[{}]\s*$/.test(a)) {
    return { kind: 'semicolon', text: 'This statement is missing its closing `;`.' };
  }

  // Declaration type changed
  const typeRe = /\b(?:unsigned\s+|signed\s+)?(?:long\s+long|long|short|int|char|float|double|void)\b/;
  const tE = (e.match(typeRe) || [])[0], tA = (a.match(typeRe) || [])[0];
  if (tE && tA && tE !== tA && /[A-Za-z_]\w*\s*[;=,)]/.test(e)) {
    return { kind: 'type', text: `Type mismatch: the reference declares this as \`${tE}\`, you used \`${tA}\`.` };
  }

  // Unbalanced brackets
  for (const [open, close, name] of [['(', ')', 'parenthesis'], ['{', '}', 'brace'], ['[', ']', 'bracket']]) {
    if (_diffCount(a, open) !== _diffCount(a, close) && _diffCount(e, open) === _diffCount(e, close)) {
      return { kind: 'balance', text: `Unbalanced ${name} on this line — every \`${open}\` needs a matching \`${close}\`.` };
    }
  }

  /* A single different name. With names ignored, a name is only "different"
     when it is not the reference's name's partner: x against n, once x is
     paired with n, is the same variable, and saying "the reference calls this
     n, you wrote x" was telling the reader to fix something that was right. */
  const names = ctx && ctx.names && ctx.names.user && ctx.names.expected ? ctx.names : null;
  if (names) {
    const ids = s => _diffLexC(s).filter(t => t.k === 'id').map(t => t.t);
    const nA = ids(a), nE = ids(e);
    if (nA.length === nE.length) {
      const changed = [];
      for (let i = 0; i < nE.length; i++) {
        const ka = names.user.has(nA[i]) ? names.user.get(nA[i]) : nA[i];
        const ke = names.expected.has(nE[i]) ? names.expected.get(nE[i]) : nE[i];
        if (ka !== ke) changed.push([nA[i], nE[i], ke]);
      }
      if (changed.length === 1) {
        const [wrote, refName, shared] = changed[0];
        let yours = null;
        names.user.forEach((to, from) => { if (yours == null && to === shared) yours = from; });
        return yours
          ? { kind: 'name', text: `Different variable: the reference uses \`${refName}\` here, which is your \`${yours}\`, but you wrote \`${wrote}\`.` }
          : { kind: 'name', text: `Different name here: the reference uses \`${refName}\`, you wrote \`${wrote}\`.` };
      }
    }
  }

  // A single renamed identifier
  const idE = _diffIdents(e), idA = _diffIdents(a);
  if (!names && idE.length === idA.length) {
    const changed = [];
    for (let i = 0; i < idE.length; i++) if (idE[i] !== idA[i]) changed.push([idA[i], idE[i]]);
    if (changed.length === 1) {
      return { kind: 'name', text: `Different name: the reference calls this \`${changed[0][1]}\`, you wrote \`${changed[0][0]}\`.` };
    }
  }

  // Control-flow construct swapped
  const kwRe = /\b(for|while|do|switch|if)\b/;
  const kE = (e.match(kwRe) || [])[0], kA = (a.match(kwRe) || [])[0];
  if (kE && kA && kE !== kA) {
    return { kind: 'control', text: `The reference uses \`${kE}\` here, your code uses \`${kA}\`.` };
  }

  return null;
}