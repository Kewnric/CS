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
function termCleanDiagnostics(text) {
  const clean = termStripAnsi(text);
  if (!clean.trim()) return '';
  // Drop each diagnostic block that names one of the injected helpers.
  const blocks = clean.split(/\n(?=\S)/);
  return blocks.filter(b => !/__ssp_[ipl]/.test(b)).join('\n').trim();
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
