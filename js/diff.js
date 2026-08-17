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

/** Char- or word-level diff for one line pair, per the caller's granularity. */
function computeLineDiffs(actualLine, expectedLine, granularity) {
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

/**
 * Line-level alignment.
 *
 * @param {string} userCode
 * @param {string} expectedCode
 * @param {object} [opts]
 *   .ignoreComments  strip `//` and `/* *\/` before comparing (default true)
 *   .ignoreWhitespace  collapse all whitespace before comparing (default true);
 *                      when false, indentation and inner spacing count
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

  const rawULines = String(userCode || '').split('\n');
  const rawCLines = String(expectedCode || '').split('\n');
  // stripComments preserves newlines, so stripped line i is still raw line i.
  const strippedUser = ignoreComments ? stripComments(userCode) : String(userCode || '');
  const strippedExpected = ignoreComments ? stripComments(expectedCode) : String(expectedCode || '');

  const normalizeLine = ignoreWhitespace
    ? (s => s.replace(/\s+/g, '').trim())
    : (s => s.replace(/\s+$/, ''));

  // Process data using strictly the stripped versions
  const stripULines = strippedUser.split('\n');
  const uLinesData = [];
  for (let i = 0; i < stripULines.length; i++) {
    const stripped = stripULines[i];
    const norm = normalizeLine(stripped);
    if (norm.trim() !== '') {
      uLinesData.push({ stripped: stripped, norm: norm, raw: rawULines[i] != null ? rawULines[i] : stripped, lineNo: i + 1 });
    }
  }

  const stripCLines = strippedExpected.split('\n');
  const cLinesData = [];
  for (let i = 0; i < stripCLines.length; i++) {
    const stripped = stripCLines[i];
    const norm = normalizeLine(stripped);
    if (norm.trim() !== '') {
      cLinesData.push({ stripped: stripped, norm: norm, raw: rawCLines[i] != null ? rawCLines[i] : stripped, lineNo: i + 1 });
    }
  }

  const n = uLinesData.length;
  const m = cLinesData.length;

  // Memoize per-pair line similarity: each pair is needed once in the DP fill
  // and again during traceback, and the underlying char-LCS is expensive.
  // The cheap upper bound (2·min/(len sum) — the best LCS can ever score)
  // skips the char-LCS entirely when even a perfect subsequence couldn't
  // clear the 0.5 "partial" threshold.
  const simCache = new Map();
  function simAt(i, j) {
    const key = i * (m + 1) + j;
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
        const sim = simAt(i - 1, j - 1);
        const subCost = sim > 0.5 ? 0.5 : 2;

        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + subCost
        );
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
          actualRaw: uData.raw, expectedRaw: cData.raw
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
          actualRaw: uData.raw, expectedRaw: cData.raw
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
        actualRaw: uLinesData[i2 - 1].raw, expectedRaw: null
      });
      i2--;
    } else {
      diffs.unshift({
        status: 'missing',
        actual: null,
        expected: cLinesData[j2 - 1].stripped,
        actualLine: null, expectedLine: cLinesData[j2 - 1].lineNo,
        actualRaw: null, expectedRaw: cLinesData[j2 - 1].raw
      });
      j2--;
    }
  }

  return { diffs, scoreCount: totalScore, cLinesLen: cLinesData.length || 1 };
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
 * @returns {?{text:string, kind:string}} short explanation, or null
 */
function explainDiffLine(row) {
  if (!row || row.status === 'perfect') return null;
  const a = (row.actual || '').trim();
  const e = (row.expected || '').trim();

  if (row.status === 'missing') {
    if (/^#include/.test(e)) {
      const h = (e.match(/<([^>]+)>|"([^"]+)"/) || [])[0] || 'the header';
      return { kind: 'missing', text: `Missing \`#include ${h}\` — the library functions below need it declared.` };
    }
    if (/^\s*}\s*$/.test(e)) return { kind: 'missing', text: 'A closing brace is missing — a block you opened is never closed.' };
    if (/\breturn\b/.test(e)) return { kind: 'missing', text: 'The reference returns a value here; your function ends without it.' };
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

  // A single renamed identifier
  const idE = _diffIdents(e), idA = _diffIdents(a);
  if (idE.length === idA.length) {
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