/* ============================================================
   TERMINAL-IO.JS — transcript model shared by the practice
   terminal and the snippet terminal.
   ------------------------------------------------------------
   Both terminals used to keep a flat list of finished lines and put the caret
   in a separate input bar pinned to the bottom of the window. That is not how a
   console behaves: `printf("Enter your choice: ")` leaves the line OPEN, and
   whatever you type belongs on that same line, immediately after the colon.

   So a line here can be open — no trailing newline yet — and both the text you
   are typing and the echo of what you already entered are rendered inside it:

       Enter your choice (1-6): 2█
       ^ stdout, still open        ^ your keystrokes, inline

   The underlying execution model is unchanged: the program is re-run from the
   start with the accumulated stdin each time you press Enter, and the longest
   common prefix of two runs (one with a sentinel appended) tells us how much
   output is safe to show before the next read blocks.
   ============================================================ */

/* ── Finding the exact point a program blocks on input ─────────
   The old approach ran the program twice — once with the input typed so far,
   once with sentinel input appended — and displayed the longest common prefix
   of the two outputs. That over-reports whenever the text after a read doesn't
   depend on what was read:

       printf("Enter Age: "); scanf("%d", &age); printf("Your Age is: %d", age);

   Both runs print "Your Age is: " no matter what, so the common prefix swallows
   it and the terminal showed the whole program before you'd typed anything.

   Instead, compile a probe build in which every stdin read announces itself.
   Function-like macros are not re-expanded inside their own body, so wrapping
   the call is safe, and each wrapper prints a one-character marker recording
   whether the read succeeded. The first FAILED read is exactly where a real
   terminal would block, and everything printed before that marker is exactly
   what a real terminal would have shown. No guessing, and one run per step
   instead of two. */

const TERM_MARK = String.fromCharCode(1);   // SOH — never appears in ordinary output


/**
 * A probe build of `code` whose stdin reads report themselves.
 * @returns {?string} instrumented source, or null when this can't be done safely
 */
function termInstrumentC(code) {
  const src = String(code || '');
  // C++ streams can't be intercepted with macros; fall back for those.
  if (/#include\s*<iostream>|\bstd::cin\b|\bcin\s*>>/.test(src)) return null;
  if (!/\b(scanf|fscanf|fgets|gets|getchar|getline)\s*\(/.test(src)) return null;

  const shim = [
    '#include <stdio.h>',
    // `static inline`, not plain `static`: an unused plain static function
    // triggers -Wunused-function, and those warnings would surface in the
    // terminal as if they were the user's own.
    // The marker is split across string literals on purpose — "\x010" would be
    // read as a single hex escape.
    'static inline int __ssp_i(int r){ fputs(r==EOF?"\\x01" "0" "\\x01":"\\x01" "1" "\\x01", stdout); return r; }',
    'static inline char *__ssp_p(char *r){ fputs(r?"\\x01" "1" "\\x01":"\\x01" "0" "\\x01", stdout); return r; }',
    'static inline long __ssp_l(long r){ fputs(r<0?"\\x01" "0" "\\x01":"\\x01" "1" "\\x01", stdout); return r; }',
    '#undef scanf',
    '#define scanf(...) __ssp_i(scanf(__VA_ARGS__))',
    '#undef fscanf',
    '#define fscanf(...) __ssp_i(fscanf(__VA_ARGS__))',
    '#undef getchar',
    '#define getchar() __ssp_i(getchar())',
    '#undef fgets',
    '#define fgets(...) __ssp_p(fgets(__VA_ARGS__))',
    '#undef gets',
    '#define gets(...) __ssp_p(gets(__VA_ARGS__))',
    '#undef getline',
    '#define getline(...) __ssp_l(getline(__VA_ARGS__))'
  ];

  // Must land AFTER the includes: defining these before <stdio.h> is parsed
  // would macro-expand the header's own declarations.
  const lines = src.split('\n');
  let at = -1;
  for (let i = 0; i < lines.length; i++) if (/^\s*#\s*include\b/.test(lines[i])) at = i;
  // A #line directive puts the user's own diagnostics back on the line numbers
  // they wrote, instead of shifting everything down by the size of the shim.
  if (at === -1) {
    lines.unshift(...shim, '#line 1');
  } else {
    lines.splice(at + 1, 0, ...shim, '#line ' + (at + 2));
  }
  return lines.join('\n');
}

/** Strip the ANSI colour codes GCC puts in its diagnostics. */
function termStripAnsi(text) {
  // Written as \u001b escapes on purpose: a literal ESC byte in the source is
  // invisible in an editor and trivially mangled by tooling.
  return String(text || '')
    .replace(/\u001b\[[0-9;]*[A-Za-z]/g, '')          // SGR colour / cursor codes
    .replace(/\u001b\]8;;[^\u0007]*\u0007/g, '');     // OSC-8 hyperlinks
}

/** Diagnostics worth showing: the shim's own are noise the user can't act on. */
function termCleanDiagnostics(text, originalSource) {
  const clean = termStripAnsi(text);
  if (!clean.trim()) return '';
  // Drop each diagnostic block that names one of the injected helpers.
  const blocks = clean.split(/\n(?=\S)/);
  const kept = blocks.filter(b => !/__ssp_[ipl]/.test(b)).join('\n').trim();
  return originalSource ? termRepointExcerpts(kept, originalSource) : kept;
}

/**
 * Quote the user's source in a diagnostic, not the instrumented file's.
 *
 * The probe build injects a shim after the last #include and ends it with a
 * #line directive, so GCC REPORTS the right line number — a warning about the
 * user's line 8 does say 8. But the excerpt it prints underneath is fetched
 * from the file it actually compiled, and physical line 8 of that file is one
 * of the injected `#undef` lines. The result is a correct complaint quoting a
 * line the user never wrote:
 *
 *     <source>:8:6: warning: suggest parentheses around assignment ...
 *         8 | #undef fscanf
 *
 * The number is trustworthy, so the fix is to look line 8 up in what the user
 * actually typed and print that instead. The caret line has no line number of
 * its own and is left alone: its column was measured against the real line, so
 * it lands correctly once the real line is underneath it.
 */
function termRepointExcerpts(text, originalSource) {
  const src = String(originalSource || '').split('\n');
  if (!src.length) return text;
  return String(text).split('\n').map(line => {
    // "   8 | some code" — the number, the bar, then the quoted source.
    const m = /^(\s*)(\d+)(\s*\|)(.*)$/.exec(line);
    if (!m) return line;                       // caret rows and prose pass through
    const real = src[parseInt(m[2], 10) - 1];
    if (real === undefined) return line;
    return m[1] + m[2] + m[3] + (real ? ' ' + real : '');
  }).join('\n');
}

/**
 * Split instrumented output at the first read that came up empty.
 * @returns {{safe:string, blocked:boolean, instrumented:boolean}}
 */
function termSplitAtBlockingRead(stdout) {
  const out = String(stdout || '');
  if (out.indexOf(TERM_MARK) === -1) return { safe: out, blocked: false, instrumented: false };

  const parts = out.split(TERM_MARK);
  let safe = '';
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) { safe += parts[i]; continue; }
    if (parts[i] === '0') return { safe, blocked: true, instrumented: true };   // this read would block
    if (parts[i] !== '1') safe += TERM_MARK + parts[i];   // not ours — leave it be
  }
  return { safe, blocked: false, instrumented: true };
}

/**
 * Append program output, continuing the open line when there is one.
 * @param {object} session terminal session (needs .lines and .lineOpen)
 * @param {string} text raw stdout delta
 */
function termAppendStdout(session, text) {
  if (!text) return;
  const endsOpen = !text.endsWith('\n');
  const parts = text.split('\n');
  if (!endsOpen) parts.pop();          // drop the empty tail after the final \n

  parts.forEach((part, i) => {
    const last = session.lines[session.lines.length - 1];
    // Only the FIRST segment can continue a line the program left open, and
    // only if nothing has been echoed into it yet.
    if (i === 0 && session.lineOpen && last && last.type === 'stdout' && last.echo == null) {
      last.text += part;
    } else {
      session.lines.push({ type: 'stdout', text: part });
    }
  });
  session.lineOpen = endsOpen;
}

/**
 * Record what the user typed. It lands on the open prompt line when there is
 * one, exactly where a real terminal would put it; otherwise it becomes its
 * own line.
 */
function termEchoInput(session, value) {
  const last = session.lines[session.lines.length - 1];
  if (session.lineOpen && last && last.type === 'stdout' && last.echo == null) {
    last.echo = value;
  } else {
    session.lines.push({ type: 'stdin', text: value });
  }
  session.lineOpen = false;            // Enter closed the line
}

const TERM_LINE_CLASS = {
  stdout: 'term-stdout', stdin: 'term-stdin',
  error: 'term-error', warning: 'term-warning', info: 'term-info'
};

/**
 * The whole transcript, with the caret and the in-progress keystrokes drawn in
 * place rather than in a detached input box.
 *
 * @param {object} session
 * @param {string} pending what the user has typed but not yet entered
 * @param {boolean} waiting true when the program is blocked on a read
 */
function termTranscriptHTML(session, pending, waiting) {
  let html = '';
  const lines = session.lines || [];

  lines.forEach((line, i) => {
    const isLast = i === lines.length - 1;
    let inner = escapeHTML(line.text);
    if (line.echo != null) inner += `<span class="term-echo">${escapeHTML(line.echo)}</span>`;
    if (waiting && isLast && session.lineOpen && line.echo == null) {
      inner += `<span class="term-echo">${escapeHTML(pending || '')}</span><span class="run-code-cursor"></span>`;
    }
    html += `<div class="term-line ${TERM_LINE_CLASS[line.type] || 'term-stdout'}">${inner || '&nbsp;'}</div>`;
  });

  // The prompt ended with a newline, so the caret belongs on a fresh line.
  if (waiting && !session.lineOpen) {
    html += `<div class="term-line term-stdout"><span class="term-echo">${escapeHTML(pending || '')}</span><span class="run-code-cursor"></span></div>`;
  }
  return html;
}

/** Flat transcript for the read-only mirror under the editor (no caret). */
function termMirrorHTML(session) {
  return (session.lines || []).map(l => {
    const text = escapeHTML(l.text) + (l.echo != null ? `<span class="term-echo">${escapeHTML(l.echo)}</span>` : '');
    return `<div class="term-line ${TERM_LINE_CLASS[l.type] || 'term-stdout'}">${text || '&nbsp;'}</div>`;
  }).join('');
}

/**
 * Wire a hidden input so typing goes into the transcript.
 *
 * The field is real (so IMEs, mobile keyboards and paste all work) but has no
 * visual presence — what you see is the text rendered inline by
 * termTranscriptHTML. Clicking anywhere in the output focuses it, the way
 * clicking a terminal window does.
 *
 * @param {object} o .areaId .inputId .onInput .onSubmit .onEscape
 */
function termBindInput(o) {
  const area = document.getElementById(o.areaId);
  const input = document.getElementById(o.inputId);
  if (!area || !input) return;

  input.addEventListener('input', () => { if (o.onInput) o.onInput(input.value); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const v = input.value;
      input.value = '';
      if (o.onSubmit) o.onSubmit(v);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (o.onEscape) o.onEscape();
    }
  });

  // Don't steal a deliberate text selection — only focus on a plain click.
  area.addEventListener('mouseup', () => {
    const sel = window.getSelection();
    if (sel && String(sel).length) return;
    input.focus();
  });
}

/* ── Compile cache ─────────────────────────────────────────────
   Godbolt compiles AND runs in one request, so every Enter costs a round trip.
   Nothing about a (source, stdin) pair changes between requests, so the result
   is cacheable — which makes Restart plus retyping the same answers replay
   instantly instead of recompiling once per step. */

const TERM_CACHE_MAX = 40;
const _termCache = new Map();

function termCacheKey(code, stdin, args) {
  return (args || '') + ' ' + (stdin || '') + ' ' + code;
}

function termCacheGet(key) {
  if (!_termCache.has(key)) return null;
  const hit = _termCache.get(key);
  _termCache.delete(key);         // refresh LRU position
  _termCache.set(key, hit);
  return hit;
}

function termCacheSet(key, value) {
  _termCache.set(key, value);
  while (_termCache.size > TERM_CACHE_MAX) _termCache.delete(_termCache.keys().next().value);
}

function termCacheClear() { _termCache.clear(); }

/* ── Compiler options ──────────────────────────────────────────
   Hardcoded `-Wall -lm` gave a bare "Signal 11" for an out-of-bounds write.
   The sanitizers turn that into a named diagnostic with a line number, which
   is the whole difference between a puzzle and a lesson. */

const TERM_OPTS_KEY = 'terminalCompilerOpts';
const TERM_OPTS_DEFAULT = { std: 'gnu17', wextra: false, sanitize: false };

function termGetOpts() {
  try {
    const raw = JSON.parse(localStorage.getItem(TERM_OPTS_KEY));
    return Object.assign({}, TERM_OPTS_DEFAULT, raw && typeof raw === 'object' ? raw : {});
  } catch (e) {
    return Object.assign({}, TERM_OPTS_DEFAULT);
  }
}

function termSetOpt(key, value) {
  const o = termGetOpts();
  o[key] = value;
  try { localStorage.setItem(TERM_OPTS_KEY, JSON.stringify(o)); } catch (e) { /* quota */ }
}

/** The `userArguments` string handed to the compiler. */
function termCompilerArgs() {
  const o = termGetOpts();
  const args = ['-Wall', '-lm'];
  if (o.std && o.std !== 'default') args.push('-std=' + o.std);
  if (o.wextra) args.push('-Wextra');
  // -g keeps the sanitizer's report pointing at source lines.
  if (o.sanitize) args.push('-fsanitize=address,undefined', '-g');
  return args.join(' ');
}

function termOptionsPanelHTML(idPrefix) {
  const o = termGetOpts();
  const stds = ['gnu17', 'c17', 'c11', 'c99', 'c89'];
  return `
    <div class="term-opts" id="${idPrefix}-opts" style="display:none;">
      <label class="term-opt">
        <span>Standard</span>
        <select class="form-select" onchange="termSetOpt('std', this.value); ${idPrefix === 'term' ? '_termOptsChanged()' : '_snipTermOptsChanged()'}">
          ${stds.map(s => `<option value="${s}"${o.std === s ? ' selected' : ''}>${s}</option>`).join('')}
        </select>
      </label>
      <label class="term-opt">
        <input type="checkbox" ${o.wextra ? 'checked' : ''}
               onchange="termSetOpt('wextra', this.checked); ${idPrefix === 'term' ? '_termOptsChanged()' : '_snipTermOptsChanged()'}" />
        <span><strong>-Wextra</strong><em>More warnings than -Wall alone</em></span>
      </label>
      <label class="term-opt">
        <input type="checkbox" ${o.sanitize ? 'checked' : ''}
               onchange="termSetOpt('sanitize', this.checked); ${idPrefix === 'term' ? '_termOptsChanged()' : '_snipTermOptsChanged()'}" />
        <span><strong>Sanitizers</strong><em>Names the bug behind a crash — buffer overflows, bad frees, overflow. Slower.</em></span>
      </label>
      <div class="term-opt-args"><code>${escapeHTML(termCompilerArgs())}</code></div>
    </div>`;
}

/* ── Queued input ──────────────────────────────────────────────
   Backs both "paste several lines at once" and the canned-stdin box: lines are
   fed one per step so each still shows up echoed on its own prompt, and the
   cache keeps the replay quick. */

function termQueueSet(session, text) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  if (lines.length && lines[lines.length - 1] === '') lines.pop();   // trailing newline
  session.queue = lines;
}

function termQueueTake(session) {
  return (session.queue && session.queue.length) ? session.queue.shift() : null;
}

/* ── Scroll ────────────────────────────────────────────────────
   Auto-scrolling unconditionally meant scrolling up to read earlier output got
   yanked straight back to the bottom on the next render. */

function termAtBottom(area) {
  if (!area) return true;
  return area.scrollHeight - area.scrollTop - area.clientHeight < 24;
}

function termScrollIfFollowing(area, wasAtBottom) {
  if (area && wasAtBottom) area.scrollTop = area.scrollHeight;
}

/* ── Run history ───────────────────────────────────────────────
   Each Run used to discard the previous transcript, so you couldn't compare
   behaviour before and after an edit. */

const TERM_HISTORY_MAX = 5;

function termHistoryPush(store, session, label) {
  if (!session || !session.lines || !session.lines.length) return;
  store.unshift({
    at: Date.now(),
    label: label || new Date().toLocaleTimeString(),
    exitCode: session.exitCode,
    lines: JSON.parse(JSON.stringify(session.lines))
  });
  while (store.length > TERM_HISTORY_MAX) store.pop();
}

/** Put the caret back in the terminal and clear anything half-typed. */
function termFocusInput(inputId, clear) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (clear) input.value = '';
  input.focus();
}

/**
 * Hand control back to the user, keeping anything typed while the step was
 * still computing. A step takes a second or two (it recompiles), and a real
 * terminal buffers keystrokes typed during that window rather than dropping
 * them on the floor.
 */
function termResumeInput(session, inputId) {
  const input = document.getElementById(inputId);
  session.waiting = true;
  session.pending = input ? input.value : '';
  if (input) input.focus();
}

/**
 * How a run ended, in words.
 *
 * A program killed by the sandbox comes back as 128+signal (or 124 from
 * `timeout`), which the old code printed as a bare "Exit code 143" — no help at
 * all when the real story is "it never stopped on its own".
 */
function termExitNote(exitCode) {
  const SIGNALS = {
    124: 'timed out', 130: 'interrupted (SIGINT)', 134: 'aborted (SIGABRT)',
    136: 'floating point exception (SIGFPE)', 137: 'killed (SIGKILL)',
    139: 'segmentation fault (SIGSEGV)', 143: 'stopped at the time limit (SIGTERM)'
  };
  if (exitCode === 0) return { line: '\nProcess exited with code 0', status: '✅ Success', ok: true };
  const named = SIGNALS[exitCode];
  if (named) {
    return {
      line: `\nProcess ${named} — it never finished on its own. A loop that keeps going once input runs out will do this.`,
      status: '⚠️ ' + named.charAt(0).toUpperCase() + named.slice(1),
      ok: false
    };
  }
  return { line: '\nProcess exited with code ' + exitCode, status: '⚠️ Exit code ' + exitCode, ok: false };
}

/* ── Reading the fallback interpreter's complaints ─────────────
   When Godbolt is unreachable the local interpreter takes over, and what it
   says about a program that will not parse is this, in full:

     ERROR: Parsing Failure:
     line 5 (column 3): ("Battery 87%\n")\n  return 0;\n}
     ------------------------------------------------^
     Expected "!=", "%", "%=", "&", "&&", "&=", "(", "*", "*=", "+", "++",
     "+=", ",", "-", "--", "-=", "->", ".", "/", "/*", "//", "/=", ";", "<",
     … forty tokens … but "r" found.

   Three things are wrong with that. The line number is the PREPROCESSED line,
   not the one in the editor. The excerpt is the whole rest of the file printed
   on one row with its newlines escaped, so the caret under it points nowhere.
   And the one token that matters — ";" — is the twenty-third item of a list
   nobody is going to read.

   Everything below turns that into the line the user actually typed, a caret
   under the spot, and a sentence naming what is missing. */

/** A thrown interpreter message that means "this never compiled". */
function termIsBuildFailure(msg) {
  return /pars|syntax|unexpected|missing declarator|but .{0,40}found/i.test(String(msg || ''));
}

/**
 * Where a brace went wrong: the line of a `{` that is never closed, or of a
 * `}` that closes nothing. Strings, chars and comments are skipped, so a brace
 * inside printf("}") does not count.
 * @returns {{line:number, extra:boolean}|null}
 */
function termBraceFault(src) {
  const s = String(src || '');
  const open = [];
  let line = 1, i = 0;
  let inStr = false, inChar = false, inLine = false, inBlock = false;

  while (i < s.length) {
    const c = s[i], next = s[i + 1];
    if (c === '\n') { line++; i++; if (inLine) inLine = false; continue; }
    if (inLine) { i++; continue; }
    if (inBlock) { if (c === '*' && next === '/') { i += 2; inBlock = false; } else i++; continue; }
    if ((inStr || inChar) && c === '\\') { i += 2; continue; }
    if (inStr) { if (c === '"') inStr = false; i++; continue; }
    if (inChar) { if (c === "'") inChar = false; i++; continue; }
    if (c === '/' && next === '/') { inLine = true; i += 2; continue; }
    if (c === '/' && next === '*') { inBlock = true; i += 2; continue; }
    if (c === '"') { inStr = true; i++; continue; }
    if (c === "'") { inChar = true; i++; continue; }
    if (c === '{') open.push(line);
    else if (c === '}') { if (!open.length) return { line: line, extra: true }; open.pop(); }
    i++;
  }
  return open.length ? { line: open[open.length - 1], extra: false } : null;
}

/**
 * The offending line, quoted from the user's own file with a caret under it.
 * @param {string[]} lines the source, already split
 * @param {number} lineNo 1-based; 0 means "we could not place it"
 * @param {number} column 1-based, or 0 to omit the caret
 */
function termQuoteLine(lines, lineNo, column) {
  if (!lineNo || lineNo < 1 || lineNo > lines.length) return '';
  // Tabs are one character to the parser and several columns on screen, so the
  // caret can only line up if both sides agree. Expanding them makes it agree.
  const text = String(lines[lineNo - 1]).replace(/\t/g, '    ');
  const shift = String(lines[lineNo - 1]).slice(0, Math.max(0, column - 1)).split('\t').length - 1;
  const gutter = String(lineNo).padStart(4, ' ') + ' | ';
  let out = '\n' + gutter + text;
  if (column > 0) {
    out += '\n' + ' '.repeat(gutter.length - 2) + '| '
        + ' '.repeat(Math.max(0, column - 1 + shift * 3)) + '^';
  }
  return out;
}

/* Interpreter limits that are worth naming rather than leaking as a raw throw.
   Each of these is something real GCC compiles happily, so the honest thing to
   say is that the fallback cannot do it — not that the program is wrong. */
const TERM_JSCPP_LIMITS = [
  [/(?:variable|type) (?:FILE|fopen|fclose|fprintf|fread|fwrite|rewind|fseek|ftell|feof) (?:does not exist|is not defined)/i,
   'File input/output is not available in the offline interpreter.\nFILE and fopen need a real filesystem, and there is none in the browser.\nThis program will run properly once the compiler is reachable again.'],
  [/type struct/i,
   'The offline interpreter does not support struct.\nNothing is wrong with your program — the fallback simply cannot do\nstructs. It will compile and run once the compiler is reachable again.'],
  [/variable (?:malloc|calloc|realloc|free) does not exist/i,
   'This use of malloc could not be converted for the offline interpreter.\nIt has no heap. Simple cases are rewritten as fixed-size arrays\nautomatically; this one was too complex to rewrite.'],
  [/Invalid regular expression/i,
   'That scanf format is more than the offline interpreter can handle.\nIt builds a pattern out of the format string, and %* (skip this field)\nis not something it can express. The real compiler has no trouble with it.'],
  [/object null is not iterable/i,
   'The offline interpreter could not read input in that format.\nA scan set — %[^\\n] and the like — is the usual cause; it does not\nsupport them. The real compiler does.'],
  [/variable (\w+) does not exist/i,
   'The offline interpreter does not provide "$1".\nIt is a partial implementation of C, and this is one of the gaps.\nThe real compiler has it — try again when it is reachable.'],
  [/Memory overflow/i,
   'The program ran out of memory in the interpreter.\nAn unbounded loop or a very large array is the usual cause.']
];

/**
 * Translate an interpreter failure into something a student can act on.
 *
 * @param {string} raw       what the interpreter threw
 * @param {string} merged    the source it was handed (all files linked together)
 * @param {string} processed the source after preprocessCForJSCPP
 * @param {string} userSource the file the editor is showing, for the quote
 * @returns {string} plain text, or '' when nothing better than the raw message
 */
function termExplainJSCPP(raw, merged, processed, userSource) {
  const msg = String(raw || '').replace(/^ERROR:\s*/i, '');
  if (!msg.trim()) return '';

  for (const [re, text] of TERM_JSCPP_LIMITS) {
    const hit = re.exec(msg);
    if (hit) return text.replace('$1', hit[1] || '');
  }

  const user = String(userSource == null ? (merged || '') : userSource);
  const uLines = user.split('\n');
  const mLines = String(merged || user).split('\n');
  const pLines = String(processed || merged || user).split('\n');

  /* How far down the preprocessor pushed everything. It only ever adds or
     removes lines in the header region at the top — `using namespace std;`
     after the last include, a header block when there are none, an unsupported
     include dropped — and every other rewrite it does is in place, one line for
     one line. So the drift below the headers is a single constant, and that is
     the whole of the correction. */
  const drift = pLines.length - mLines.length;

  /** processed line (1-based) → the same line in the editor, or 0. */
  const toUser = (pLine) => {
    const idx = pLine - 1 - drift;
    if (idx < 0 || idx >= mLines.length) return 0;
    if (user === String(merged || user)) return idx + 1;
    // Several files were linked into one unit, so the line may not be in the
    // file on screen. Claim it only when its text appears there exactly once.
    if (mLines[idx] === uLines[idx]) return idx + 1;
    const want = mLines[idx].trim();
    if (!want) return 0;
    const hits = [];
    uLines.forEach((l, i) => { if (l.trim() === want) hits.push(i + 1); });
    return hits.length === 1 ? hits[0] : 0;
  };

  // "line 5 (column 3):" — a parse failure.
  const pos = msg.match(/line\s+(\d+)\s*\(column\s+(\d+)\)/i);
  if (pos) {
    const pLine = parseInt(pos[1], 10);
    const column = parseInt(pos[2], 10);
    const expected = (msg.match(/Expected([\s\S]*?)\bbut\b/i) || ['', ''])[1];
    const found = (msg.match(/\bbut\s+([\s\S]*?)\s*found/i) || ['', ''])[1];
    const at = toUser(pLine);
    // The column was measured against the preprocessed line. It only transfers
    // if that line came through the preprocessor untouched.
    const same = at > 0 && pLines[pLine - 1] === uLines[at - 1];

    // Ran off the end of the file: a block was never closed.
    if (/end of input/i.test(found)) {
      const fault = termBraceFault(user);
      if (fault && !fault.extra) {
        return 'The { opened on line ' + fault.line + ' is never closed.\n'
          + 'Every { needs a matching }.'
          + termQuoteLine(uLines, fault.line, 0);
      }
      return 'The file ends in the middle of something.\nA closing } or ) is missing.';
    }

    // An unbalanced bracket on the marked line.
    if (expected.indexOf('")"') !== -1) {
      return 'A closing ) is missing on line ' + (at || pLine) + '.\n'
        + 'Count the brackets along the line: every ( needs its ).'
        + termQuoteLine(uLines, at, same ? column : 0);
    }

    // The classic. The parser only complains once it reaches the NEXT
    // statement, so the semicolon belongs at the end of the line before.
    if (expected.indexOf('";"') !== -1) {
      let target = at - 1;
      while (target >= 1 && !uLines[target - 1].trim()) target--;
      if (target >= 1) {
        const text = uLines[target - 1];
        const col = text.replace(/\s+$/, '').length + 1;
        return 'Missing semicolon at the end of line ' + target + '.\n'
          + "C ends every statement with a ';'. The compiler doesn't notice until it\n"
          + 'reaches the next one, which is why line ' + at + ' is where it stopped.'
          + termQuoteLine(uLines, target, col);
      }
    }

    const extra = termBraceFault(user);
    if (extra && extra.extra) {
      return 'There is a } on line ' + extra.line + ' that closes nothing.'
        + termQuoteLine(uLines, extra.line, 0);
    }
    return 'Line ' + (at || pLine) + " doesn't parse.\n"
      + 'Something is wrong with the punctuation here or just above — a missing\n'
      + '; or ) or " is almost always the cause.'
      + termQuoteLine(uLines, at, same ? column : 0);
  }

  // "3:10 missing declarator for argument" — the short form.
  const short = msg.match(/^\s*(\d+):(\d+)\s+([\s\S]+)$/);
  if (short) {
    const at = toUser(parseInt(short[1], 10));
    return short[3].trim().replace(/\s+/g, ' ')
      + (at ? '\n' + termQuoteLine(uLines, at, 0).replace(/^\n/, '') : '');
  }
  return '';
}

/* ── The warnings the interpreter never gives ──────────────────
   Godbolt compiles with -Wall, so on a normal run real GCC has already said
   everything below. The fallback interpreter has no warnings at all: it runs
   the program and prints whatever comes out, which is how printf("87%\n")
   comes out looking right while being undefined behaviour.

   These three are the ones that produce plausible output while being wrong,
   which is exactly the kind that goes unnoticed. */

/**
 * @param {string} src the user's file
 * @returns {Array<{line:number, text:string}>}
 */
function termLintC(src) {
  const lines = String(src || '').split('\n');
  const notes = [];

  /* scanf("%d", p) is correct when p is already a pointer or an array, so the
     names declared that way are collected first and never warned about. */
  const indirect = new Set();
  const all = String(src || '');
  let m;
  const ptrDecl = /\b(?:char|int|short|long|float|double|unsigned|signed|void|size_t|FILE|[A-Z]\w*)\s*\*+\s*([A-Za-z_]\w*)/g;
  while ((m = ptrDecl.exec(all))) indirect.add(m[1]);
  const arrDecl = /\b([A-Za-z_]\w*)\s*\[\s*\w*\s*\]\s*(?:=|;|,|\))/g;
  while ((m = arrDecl.exec(all))) indirect.add(m[1]);

  /* A conversion is % then optional flags, width, precision and length, then
     the letter — or a scan set, %[^\n] and friends, whose closing ] may be the
     very first character inside the brackets. */
  const conv = /^[-+ #0]*\*?\d*(?:\.\d+)?(?:hh|h|ll|l|L|z|j|t)?(?:[diouxXeEfFgGaAcspn%]|\[\^?\]?[^\]]*\])/;

  lines.forEach((raw, i) => {
    const line = raw.replace(/\/\/.*$/, '');
    const at = i + 1;

    // A lone % in a format string. printf("87%\n") is undefined behaviour —
    // GCC calls it "spurious trailing %". A literal percent is written %%.
    const fmt = line.match(/\b(?:printf|fprintf|sprintf|snprintf|scanf|sscanf)\s*\([^"]*"((?:[^"\\]|\\.)*)"/);
    if (fmt) {
      const s = fmt[1];
      for (let k = 0; k < s.length; k++) {
        if (s[k] !== '%') continue;
        const rest = s.slice(k + 1);
        const hit = conv.exec(rest);
        if (hit) { k += hit[0].length; continue; }
        notes.push({
          line: at,
          text: 'line ' + at + ': that % is not a conversion.\n'
            + 'To print a percent sign, write it twice: %%. A single % makes printf\n'
            + 'look for an argument that was never passed.'
        });
        break;
      }
    }

    // if (x = 5) stores 5 and then tests it, so the branch is always taken.
    const assign = /\b(if|while)\s*\(\s*([A-Za-z_]\w*)\s*=(?!=)/.exec(line);
    if (assign) {
      notes.push({
        line: at,
        text: 'line ' + at + ': "' + assign[2] + ' =" assigns, it does not compare.\n'
          + 'This stores the value in ' + assign[2] + ' and then tests it, so the '
          + assign[1] + ' is\nalmost certainly always true. To compare, write ==.'
      });
    }

    // scanf needs the address of what it writes into.
    const sc = /\bscanf\s*\(\s*"([^"]*)"\s*,\s*([^;]*)\)\s*;/.exec(line);
    if (sc && /%[-0-9.*]*(?:hh|h|ll|l|L)?[diouxXeEfFgGac]/.test(sc[1])) {
      sc[2].split(',').map(a => a.trim()).forEach(a => {
        if (/^[A-Za-z_]\w*$/.test(a) && !indirect.has(a)) {
          notes.push({
            line: at,
            text: 'line ' + at + ': scanf is missing an & before ' + a + '.\n'
              + 'scanf writes THROUGH an address, so it needs &' + a + '. Given the value\n'
              + 'instead, it treats that number as a location and writes there.'
          });
        }
      });
    }
  });
  return notes;
}

/**
 * Say what -Wall would have said, on the runs where nobody said it.
 *
 * Godbolt compiles with -Wall, so a normal run has already been told about a
 * stray %, an `if (x = 5)` or a scanf missing its &. The fallback interpreter
 * has no warnings whatsoever — it runs the program and prints whatever comes
 * out, which is how `printf("87%\n")` comes out looking perfectly fine while
 * being undefined behaviour. So the check only runs when it is the one running.
 */
function termPushLint(session) {
  if (!session || session.engine !== 'JSCPP' || session.linted) return;
  session.linted = true;
  const notes = (typeof termLintC === 'function') ? termLintC(session.code) : [];
  notes.forEach(n => {
    session.lines.push({ type: 'warning', text: '⚠️ ' + n.text });
    // The lint IS the classifier for the offline engine -- GCC's own wording
    // never reaches mistakes.js on those runs, so the note stands in for it.
    if (typeof mistakeNoteText === 'function') mistakeNoteText(n.text, { line: n.line });
  });
}
