/* ============================================================
   MISTAKES.JS — what went wrong, kept
   ------------------------------------------------------------
   A finished attempt used to record score, duration, attempt number and how
   many tests passed. That is a scoreboard: it says you got 60%, never that you
   got 60% because you forgot the & in scanf for the ninth time this month.

   The richest signal this app produces is the stream of compile errors and
   failed runs during an attempt, and it was being thrown away — _practiceExecs
   caps at 20 and lives in sessionStorage, so it died with the tab.

   So every diagnostic is classified into a stable code and kept. The codes are
   the point: "3 errors" is noise, "you have made the same three mistakes for a
   month" is a study plan.

   ONE RECORD PER MISTAKE PER ATTEMPT, not per occurrence. Hammering one typo
   through six recompiles is one mistake that cost you an attempt, not six
   mistakes; the repeats are kept as `hits` so the difference is still visible.
   ============================================================ */

/* Each rule turns a compiler's words into a code, a name for it, and the thing
   worth knowing. `test` runs against the raw diagnostic text — GCC's, or the
   offline interpreter's translated one, or a runtime signal line.

   Order matters: the first match wins per line, so the specific patterns are
   above the general ones they would otherwise be swallowed by. */
const MISTAKE_RULES = [
  {
    code: 'scanf-no-ampersand',
    label: 'scanf without &',
    why: 'scanf writes THROUGH an address. Given the value instead, it treats whatever number is in the variable as a location and writes there.',
    fix: 'Pass &name, not name — except for arrays, which are already addresses.',
    concept: 'scanf',
    /* THE CONVERSION HAS TO BE ONE THAT TAKES A VALUE. "expects argument of
       type 'something *'" was enough on its own, and it is not: %s expects
       char * and %p expects void * in printf too, so printf("%s", n) was
       being reported as a missing & -- telling the reader to pass &name for a
       bug where that is not the fix. Measured: 3 of 16 real GCC wordings
       landed on the wrong rule, every one of them a printf.
       Requiring a numeric or char conversion separates them, because those
       expect a pointer ONLY under scanf. The cost is that scanf("%s", &arr)
       now reads as a format mismatch rather than an & problem; its advice is
       generic there instead of wrong, which is the better way round. */
    test: /format '%[^']*[diuoxXfFeEgGaAc]' expects argument of type '[^']*\*'[^\n]*but argument \d+ has type|scanf is missing an &|missing an & before/i
  },
  {
    code: 'format-percent',
    label: 'stray % in a format string',
    why: 'A lone % starts a conversion, so printf goes looking for an argument that was never passed. It is undefined behaviour, and it often still prints something plausible.',
    fix: 'Write a literal percent sign twice: %%.',
    concept: 'printf',
    test: /spurious trailing '%'|conversion lacks type at end of format|that % is not a conversion/i
  },
  {
    code: 'format-mismatch',
    label: 'wrong format specifier',
    why: 'The conversion and the argument disagree, so printf reads the wrong number of bytes and prints nonsense.',
    fix: '%d for int, %f for double, %c for char, %s for a string, %zu for size_t.',
    concept: 'printf',
    test: /format '[^']*' expects argument of type|too few arguments for format|too many arguments for format|format '[^']*' expects a matching/i
  },
  {
    code: 'missing-semicolon',
    label: 'missing semicolon',
    why: 'C ends every statement with one. The compiler only notices on the following line, so the line it blames is the one after the mistake.',
    fix: 'Look at the end of the line ABOVE the one reported.',
    concept: 'syntax',
    test: /expected ';'|Missing semicolon at the end of line/i
  },
  {
    code: 'unclosed-brace',
    label: 'unclosed brace or bracket',
    why: 'A block was opened and never closed, so the parser runs to the end of the file still waiting for it.',
    fix: 'Match every { with a } — the line reported is where it ran out, not where it went wrong.',
    concept: 'syntax',
    test: /expected declaration or statement at end of input|expected '\}'|is never closed|A closing \) is missing/i
  },
  {
    code: 'assign-in-condition',
    label: '= where == was meant',
    why: 'An assignment inside a condition stores the value and then tests it, so the branch is almost always taken.',
    fix: 'Use == to compare. One = means "put this there".',
    concept: 'operators',
    test: /suggest parentheses around assignment used as truth value|assigns, it does not compare/i
  },
  {
    code: 'undeclared',
    label: 'name used before it is declared',
    why: 'The compiler reads top to bottom; a name has to exist before it is used.',
    fix: 'Declare the variable above its first use, and check the spelling and the case.',
    concept: 'variables',
    test: /undeclared \(first use|was not declared in this scope|does not exist/i
  },
  {
    code: 'implicit-decl',
    label: 'function used without its header',
    why: 'C will guess a function it has never seen, and the guess is usually wrong about the return type.',
    fix: '#include the header that declares it — <stdio.h>, <stdlib.h>, <string.h>, <math.h>.',
    concept: 'includes',
    test: /implicit declaration of function/i
  },
  {
    code: 'uninitialised',
    label: 'variable used before it is set',
    why: 'An uninitialised local holds whatever was in that memory. It often works by luck and then stops working.',
    fix: 'Give it a starting value where you declare it.',
    concept: 'variables',
    test: /is used uninitialized|may be used uninitialized/i
  },
  {
    code: 'missing-return',
    label: 'function can end without returning',
    why: 'A path through the function reaches the closing brace with no return, so the caller receives whatever happened to be in the return register.',
    fix: 'Return a value on every path, including the last one.',
    concept: 'functions',
    test: /control reaches end of non-void function/i
  },
  {
    code: 'int-conversion',
    label: 'pointer and integer mixed up',
    why: 'A pointer was used where a number was wanted, or the reverse. This is the shape of a missing & or a stray *.',
    fix: 'Check the level of indirection: is this the value, or where the value lives?',
    concept: 'pointers',
    test: /makes integer from pointer|makes pointer from integer|invalid conversion from|incompatible pointer type/i
  },
  {
    code: 'unused-var',
    label: 'variable declared and never used',
    why: 'Harmless on its own, but it usually means a line was half-rewritten and something is now being computed into the wrong place.',
    fix: 'Remove it, or find the line that was supposed to use it.',
    concept: 'variables',
    test: /unused variable|set but not used/i
  },
  {
    code: 'array-bounds',
    label: 'reading or writing past the end',
    why: 'C does not check bounds. Past the end is someone else\'s memory, and the damage often shows up somewhere unrelated.',
    fix: 'A loop over n items runs 0 to n-1. Check the < against the <=.',
    concept: 'arrays',
    test: /array subscript \d+ is (?:above|below)|stack smashing|beyond the end of|AddressSanitizer/i
  },
  {
    code: 'segfault',
    label: 'segmentation fault',
    why: 'The program touched memory it does not own — a NULL pointer, a freed one, or past the end of an array.',
    fix: 'Look at every pointer on the line it died on. Was it ever given a value?',
    concept: 'pointers',
    test: /Segmentation Fault|SIGSEGV/i
  },
  {
    code: 'timeout',
    label: 'program never finished',
    why: 'A loop whose condition never becomes false. The sandbox kills it, which is why the run takes the full time limit.',
    fix: 'Check that the loop variable actually changes, and in the direction the test expects.',
    concept: 'loops',
    test: /Time Limit Exceeded|SIGALRM|Signal 124|keeps running instead of stopping/i
  },
  {
    code: 'div-zero',
    label: 'division by zero',
    why: 'Integer division by zero is undefined; on most machines it kills the program.',
    fix: 'Guard the divisor before dividing.',
    concept: 'operators',
    test: /division by zero|SIGFPE|Floating Point Exception/i
  },
  {
    code: 'wrong-output',
    label: 'output did not match',
    why: 'It compiled and ran; the text it produced is not the text expected. Most often a missing newline, an extra space, or a wrong prompt.',
    fix: 'Compare the two side by side — the difference is usually whitespace.',
    concept: 'output',
    test: /__ssp_wrong_output__/    // raised directly, never from compiler text
  }
];

const MISTAKE_BY_CODE = MISTAKE_RULES.reduce((m, r) => { m[r.code] = r; return m; }, {});

/** Every distinct mistake a blob of diagnostics contains. @returns {string[]} */
function mistakeClassify(text) {
  const s = String(text || '');
  if (!s.trim()) return [];
  const found = [];
  /* Per LINE, so one build reporting three different problems yields three
     codes rather than only the first rule that matches anywhere in it. */
  s.split('\n').forEach(line => {
    if (!line.trim()) return;
    const hit = MISTAKE_RULES.find(r => r.test.test(line));
    if (hit && found.indexOf(hit.code) === -1) found.push(hit.code);
  });
  return found;
}

/* ── The current attempt ───────────────────────────────────────
   Held here rather than in state: it is flushed when the attempt is graded, and
   an abandoned attempt should leave nothing behind. */
let _mistakeNow = Object.create(null);

/** Note one mistake against the attempt in progress. */
function mistakeNote(code, ctx) {
  if (!code || !MISTAKE_BY_CODE[code]) return;
  const rec = _mistakeNow[code] || (_mistakeNow[code] = { code: code, hits: 0, line: null });
  rec.hits++;
  if (rec.line == null && ctx && ctx.line) rec.line = ctx.line;
}

/** Classify a blob of compiler output and note everything in it. */
function mistakeNoteText(text, ctx) {
  mistakeClassify(text).forEach(code => mistakeNote(code, ctx));
}

/** Start of an attempt: nothing carried over from the last one. */
function mistakeResetAttempt() { _mistakeNow = Object.create(null); }

/** What has been noted so far, newest counts included. */
function mistakeAttemptSoFar() { return Object.values(_mistakeNow); }

const MISTAKE_LOG_MAX = 600;

/**
 * Write the attempt's mistakes into the permanent log and hand them back for
 * the history entry.
 * @returns {Array<{code:string,hits:number}>}
 */
function mistakeFlush(challengeId) {
  const list = Object.values(_mistakeNow);
  mistakeResetAttempt();
  if (!list.length) return [];
  if (!Array.isArray(state.mistakes)) state.mistakes = [];
  const at = Date.now();
  list.forEach(m => state.mistakes.push({
    code: m.code, hits: m.hits, at: at, challengeId: challengeId || null
  }));
  // Oldest first out. A month of study is worth keeping; a year is not.
  if (state.mistakes.length > MISTAKE_LOG_MAX) {
    state.mistakes.splice(0, state.mistakes.length - MISTAKE_LOG_MAX);
  }
  return list.map(m => ({ code: m.code, hits: m.hits }));
}

/**
 * The log, grouped and ranked.
 *
 * Ranked by ATTEMPTS, not by raw hits: a mistake that cost you ten separate
 * attempts is a habit, while one that produced ten recompiles inside a single
 * attempt is one bad afternoon.
 *
 * @param {number} [days] only count the last N days
 * @returns {Array<{code,label,why,fix,concept,attempts,hits,last}>}
 */
function mistakeRanked(days) {
  const log = Array.isArray(state.mistakes) ? state.mistakes : [];
  const since = days ? Date.now() - days * 86400000 : 0;
  const by = Object.create(null);
  log.forEach(m => {
    if (m.at < since) return;
    const meta = MISTAKE_BY_CODE[m.code];
    if (!meta) return;                       // a code from an older build
    const g = by[m.code] || (by[m.code] = {
      code: m.code, label: meta.label, why: meta.why, fix: meta.fix,
      concept: meta.concept, attempts: 0, hits: 0, last: 0
    });
    g.attempts++;
    g.hits += (m.hits || 1);
    if (m.at > g.last) g.last = m.at;
  });
  return Object.values(by).sort((a, b) => b.attempts - a.attempts || b.hits - a.hits);
}

/** Nothing to show is worth saying differently from "you have no mistakes". */
function mistakeHasLog() {
  return Array.isArray(state.mistakes) && state.mistakes.length > 0;
}

/* ── The panel ─────────────────────────────────────────────────
   Ranked by how many ATTEMPTS each mistake cost, with the reason and the fix
   on the card. A count on its own is a scoreboard again; the point of keeping
   these is that the next time you meet one you know what it was. */

/** Rough "when", without a date library. */
function _mistakeAgo(ts) {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 60) return mins <= 1 ? 'just now' : mins + ' min ago';
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  const days = Math.round(hrs / 24);
  return days === 1 ? 'yesterday' : days + 'd ago';
}

/**
 * The recurring-mistakes card for Coding Analytics.
 * @param {number} [limit] how many to show
 * @returns {string} HTML
 */
function mistakesPanelHTML(limit) {
  const top = mistakeRanked().slice(0, limit || 6);
  if (!top.length) {
    return '<div class="mk-empty">'
      + (mistakeHasLog()
        ? 'Nothing from the current build of the classifier yet.'
        : 'No mistakes recorded yet. Run a program that does not compile and the reason will be kept here.')
      + '</div>';
  }
  const worst = top[0].attempts;
  return '<div class="mk-list">' + top.map(m => `
    <div class="mk-row">
      <div class="mk-bar" style="--mk-w:${Math.round((m.attempts / worst) * 100)}%"></div>
      <div class="mk-main">
        <div class="mk-head">
          <span class="mk-label">${escapeHTML(m.label)}</span>
          <span class="mk-count" title="${m.hits} time${m.hits !== 1 ? 's' : ''} in total">
            ${m.attempts} attempt${m.attempts !== 1 ? 's' : ''}</span>
        </div>
        <div class="mk-why">${escapeHTML(m.why)}</div>
        <div class="mk-fix"><i data-lucide="wrench"></i><span>${escapeHTML(m.fix)}</span></div>
        <div class="mk-foot">
          <span class="mk-concept">${escapeHTML(m.concept)}</span>
          <span class="mk-last">last ${escapeHTML(_mistakeAgo(m.last))}</span>
        </div>
      </div>
    </div>`).join('') + '</div>';
}
