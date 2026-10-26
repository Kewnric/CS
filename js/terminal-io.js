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
    '#include <stdlib.h>',
    // `static inline`, not plain `static`: an unused plain static function
    // triggers -Wunused-function, and those warnings would surface in the
    // terminal as if they were the user's own.
    // The marker is split across string literals on purpose — "\x010" would be
    // read as a single hex escape.
    //
    // STDIN RAN DRY: that is exactly where a real terminal would block, so mark
    // it and STOP. The old shim marked it and let the program carry on, which
    // was harmless only when nothing after the read mattered. `scanf("%d", &x)`
    // failing leaves x uninitialised, so a following `for (i = 1; i <= x; i++)`
    // counted to a garbage bound until the sandbox killed it -- exit 143, every
    // prompt paying the full time limit, and a false "this program keeps
    // running instead of stopping" note. Measured on that program: 32,780 bytes
    // of output generated and thrown away before the prompt could appear.
    // termSplitAtBlockingRead never reads past the first "0" marker, so ending
    // the run here changes nothing that is shown.
    'static inline void __ssp_dry(void){ fputs("\\x01" "0" "\\x01", stdout); fflush(stdout); exit(0); }',
    'static inline int __ssp_i(int r){ if (r==EOF) __ssp_dry(); fputs("\\x01" "1" "\\x01", stdout); return r; }',
    'static inline char *__ssp_p(char *r){ if (!r) __ssp_dry(); fputs("\\x01" "1" "\\x01", stdout); return r; }',
    'static inline long __ssp_l(long r){ if (r<0) __ssp_dry(); fputs("\\x01" "1" "\\x01", stdout); return r; }',
    // ONLY STDIN IS THE TERMINAL. fscanf, fgets and getline take a stream, and
    // the old shim marked the end of EVERY stream as a blocking read -- so a
    // program that reads a file to its end was reported as waiting for input
    // and showed nothing at all. Measured: a write-then-read-to-EOF program
    // that prints "sum=6" displayed "" and sat on "Waiting for input". A file
    // reaching its end is ordinary; only stdin running dry is a prompt.
    // The stream is evaluated once, inside a GCC statement expression, so
    // fscanf(fopen(...), ...) cannot open the file twice. Warning-free under
    // every flag set termCompilerArgs can produce -- none of them is -pedantic.
    'static inline int __ssp_fi(FILE *s, int r){ return s == stdin ? __ssp_i(r) : r; }',
    'static inline char *__ssp_fp(FILE *s, char *r){ return s == stdin ? __ssp_p(r) : r; }',
    'static inline long __ssp_fl(FILE *s, long r){ return s == stdin ? __ssp_l(r) : r; }',
    '#undef scanf',
    '#define scanf(...) __ssp_i(scanf(__VA_ARGS__))',
    '#undef getchar',
    '#define getchar() __ssp_i(getchar())',
    '#undef gets',
    '#define gets(...) __ssp_p(gets(__VA_ARGS__))',
    '#undef fscanf',
    '#define fscanf(s, ...) ({ FILE *__ssp_s = (s); __ssp_fi(__ssp_s, fscanf(__ssp_s, __VA_ARGS__)); })',
    '#undef fgets',
    '#define fgets(b, n, s) ({ FILE *__ssp_s = (s); __ssp_fp(__ssp_s, fgets((b), (n), __ssp_s)); })',
    '#undef getline',
    '#define getline(p, n, s) ({ FILE *__ssp_s = (s); __ssp_fl(__ssp_s, getline((p), (n), __ssp_s)); })'
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
  const kept = termExplainLinkErrors(blocks.filter(b => !/__ssp_[ipl]/.test(b)).join('\n').trim());
  return originalSource ? termRepointExcerpts(kept, originalSource) : kept;
}

/* ── Link errors, in words ─────────────────────────────────────
   What the linker says when a function was never written is this:

     /cefs/73/7357..._consolidated/compilers_c++_x86_gcc_13.2.0/bin/../lib/gcc/
     x86_64-linux-gnu/13.2.0/../../../../x86_64-linux-gnu/bin/ld:
     /lib/x86_64-linux-gnu/crt1.o: in function `_start':
     (.text+0x1b): undefined reference to `main'
     collect2: error: ld returned 1 exit status

   and xcc says "Unresolved: env.foo". The machine paths go, and each missing
   name becomes one sentence about what is wrong and where to look. */
function termExplainLinkErrors(text) {
  const names = [];
  // xcc calls a missing main by its startup names, __main_argc_argv or __main_void.
  const add = n => { n = /^__main_(?:argc_argv|void)$/.test(n) ? 'main' : n; if (n && !names.includes(n)) names.push(n); };
  let m;
  const gcc = /undefined reference to [`'\u2018"]([A-Za-z_$][\w$]*)['\u2019`"]/g;
  while ((m = gcc.exec(text))) add(m[1]);
  const xcc = /Unresolved: env\.([A-Za-z_$][\w$]*)/g;
  while ((m = xcc.exec(text))) add(m[1]);
  if (!names.length) return text;
  const noise = /(^|\/)ld(\.exe)?: |collect2: |undefined reference to|^\s*\(\.text[^)]*\)|Unresolved: env\.|: in function [`'\u2018]/;
  const kept = String(text).split('\n').filter(l => !noise.test(l)).join('\n').trim();
  const said = names.map(n => n === 'main'
    ? 'There is no main() in this program, so it has nowhere to start.\n'
      + 'Every C program needs one: int main(void) { ... }. Check that it exists and is\n'
      + 'spelled main -- C is case-sensitive, so Main or mian will not do.'
    : '"' + n + '" is used but never defined.\n'
      + 'Check the spelling (C is case-sensitive). If it is written in another .c file,\n'
      + 'that file is only built when its matching header is #included -- utils.c\n'
      + 'comes along with #include "utils.h".');
  return (kept ? kept + '\n\n' : '') + said.join('\n\n');
}

/** Neither compiler could run the program. */
function termNoCompilerText(err) {
  const why = (err && err.message) ? String(err.message).replace(/^XCC_UNAVAILABLE:\s*/, '') : '';
  return 'Could not compile: the online compiler is out of reach, and the in-browser\n'
    + 'compiler did not start' + (why ? ' (' + why + ')' : '') + '. Reload the page and try again.';
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
  /* Where to type was easy to miss: a prompt like "Enter Shelf ID:" with a
     thin caret after it, in a window that does not look like it takes input.
     Until the first answer, the caret carries a quiet note saying so. */
  const hint = (waiting && !pending && !(session.inputs && session.inputs.length))
    ? '<span class="term-hint">type here, then Enter</span>' : '';
  const caret = `<span class="term-echo">${escapeHTML(pending || '')}</span><span class="run-code-cursor"></span>${hint}`;

  lines.forEach((line, i) => {
    const isLast = i === lines.length - 1;
    let inner = escapeHTML(line.text);
    if (session.linkLocations && (line.type === 'error' || line.type === 'warning')) inner = termLinkLocations(inner);
    if (line.echo != null) inner += `<span class="term-echo">${escapeHTML(line.echo)}</span>`;
    if (waiting && isLast && session.lineOpen && line.echo == null) inner += caret;
    html += `<div class="term-line ${TERM_LINE_CLASS[line.type] || 'term-stdout'}">${inner || '&nbsp;'}</div>`;
  });

  // The prompt ended with a newline, so the caret belongs on a fresh line.
  if (waiting && !session.lineOpen) html += `<div class="term-line term-stdout">${caret}</div>`;
  return html;
}

/* "main.c:12:5" in an error, as something to click: it takes the editor to
   that line. A span rather than <a href="#">, because an empty hash is a
   navigation to the dashboard in this app's router. */
function termLinkLocations(html) {
  return html.replace(/([A-Za-z0-9_.\-]+\.(?:c|h|cpp)):(\d+)(?::(\d+))?/g, (m, file, line) =>
    `<span class="term-loc" role="link" tabindex="0" data-file="${file}" data-line="${line}" title="Show line ${line} in the editor">${m}</span>`);
}

/** The transcript as plain text, for Copy: what was printed and typed. */
function termTranscriptText(session) {
  return (session.lines || [])
    .filter(l => l.type !== 'info')
    .map(l => l.text + (l.echo != null ? l.echo : ''))
    .join('\n');
}

/** Put text on the clipboard; resolves to whether it worked. */
function termCopyText(text) {
  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  };
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text).then(() => true, () => fallback());
  }
  return Promise.resolve(fallback());
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
 * ↑ and ↓ walk back through what was entered before (o.history, an array the
 * caller keeps, so it outlives one run), the way a shell does. Ctrl+C calls
 * o.onInterrupt, unless text in the field is selected, which is a copy.
 *
 * @param {object} o .areaId .inputId .onInput .onSubmit .onEscape .onInterrupt .history
 */
function termBindInput(o) {
  const area = document.getElementById(o.areaId);
  const input = document.getElementById(o.inputId);
  if (!area || !input) return;
  const hist = o.history || null;
  let hIdx = null, draft = '';

  input.addEventListener('input', () => { hIdx = null; if (o.onInput) o.onInput(input.value); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const v = input.value;
      input.value = '';
      if (hist && v.trim() && hist[hist.length - 1] !== v) {
        hist.push(v);
        if (hist.length > 50) hist.shift();
      }
      hIdx = null;
      if (o.onSubmit) o.onSubmit(v);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (o.onEscape) o.onEscape();
    } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && hist && hist.length && !e.altKey && !e.shiftKey) {
      if (e.key === 'ArrowDown' && hIdx === null) return;
      e.preventDefault();
      if (e.key === 'ArrowUp') {
        if (hIdx === null) { draft = input.value; hIdx = hist.length; }
        if (hIdx > 0) hIdx--;
      } else {
        hIdx++;
      }
      let val;
      if (hIdx >= hist.length) { hIdx = null; val = draft; } else val = hist[hIdx];
      input.value = val;
      input.setSelectionRange(val.length, val.length);
      if (o.onInput) o.onInput(val);
    } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === 'c' || e.key === 'C') && o.onInterrupt) {
      if (input.selectionStart !== input.selectionEnd) return;   // a copy, not an interrupt
      e.preventDefault();
      o.onInterrupt();
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

/* ── Which compiler Run Code uses ──────────────────────────────
   'xcc' (the default): the in-browser compiler -- about 50 ms a run, each
   input step just as quick, and it works offline. 'gcc': real GCC over the
   network -- -Wall warnings, 64-bit types, a NULL dereference that crashes as
   it should -- at one to two seconds a step. Each falls back to the other when
   it cannot run. Check Code does not follow this: it grades on GCC whenever
   GCC can be reached, so the verdict comes from the real compiler. */
const TERM_ENGINE_KEY = 'ssp.termEngine';

function termEnginePref() {
  try { return localStorage.getItem(TERM_ENGINE_KEY) === 'gcc' ? 'gcc' : 'xcc'; } catch (e) { return 'xcc'; }
}
function termSetEnginePref(v) {
  try { localStorage.setItem(TERM_ENGINE_KEY, v === 'gcc' ? 'gcc' : 'xcc'); } catch (e) { /* private mode */ }
}
function termEngineLabel(pref) { return pref === 'gcc' ? 'GCC' : 'XCC'; }

/** The engine badge in the status bar: click to switch, and re-run. */
function termToggleEngine(idPrefix) {
  termSetEnginePref(termEnginePref() === 'gcc' ? 'xcc' : 'gcc');
  document.querySelectorAll('input[name="' + idPrefix + '-engine"]').forEach(r => { r.checked = r.value === termEnginePref(); });
  if (typeof toast === 'function') {
    toast(termEnginePref() === 'gcc' ? 'Run Code now uses GCC (online)' : 'Run Code now uses the instant in-browser compiler',
      { type: 'info', duration: 1800 });
  }
  const changed = idPrefix === 'term' ? window._termOptsChanged : window._snipTermOptsChanged;
  if (typeof changed === 'function') changed();
}

function termOptionsPanelHTML(idPrefix) {
  const o = termGetOpts();
  const stds = ['gnu17', 'c17', 'c11', 'c99', 'c89'];
  const changed = idPrefix === 'term' ? '_termOptsChanged()' : '_snipTermOptsChanged()';
  const pref = termEnginePref();
  return `
    <div class="term-opts" id="${idPrefix}-opts" style="display:none;">
      <div class="term-opt term-opt-engine" role="radiogroup" aria-label="Compiler">
        <span>Compiler</span>
        <label class="term-engine-choice">
          <input type="radio" name="${idPrefix}-engine" value="xcc" ${pref === 'xcc' ? 'checked' : ''}
                 onchange="termSetEnginePref('xcc'); ${changed}" />
          <span><strong>Instant</strong><em>In your browser. Works offline, no warnings, 32-bit.</em></span>
        </label>
        <label class="term-engine-choice">
          <input type="radio" name="${idPrefix}-engine" value="gcc" ${pref === 'gcc' ? 'checked' : ''}
                 onchange="termSetEnginePref('gcc'); ${changed}" />
          <span><strong>GCC</strong><em>Online. -Wall warnings, 64-bit, a bad pointer crashes. 1-2 s a step.</em></span>
        </label>
      </div>
      <div class="term-opt-sub">GCC options</div>
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

/* ── The warnings the in-browser compiler never gives ──────────
   GCC compiles with -Wall, so on a GCC run it has already said everything
   below. xcc, the in-browser compiler, gives no warnings at all: it runs the
   program and prints whatever comes out, which is how printf("87%\n") comes
   out looking right while being undefined behaviour.

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
  if (!session || session.engine !== 'XCC' || session.linted) return;
  session.linted = true;
  const notes = (typeof termLintC === 'function') ? termLintC(session.code) : [];
  notes.forEach(n => {
    session.lines.push({ type: 'warning', text: '⚠️ ' + n.text });
    // The lint IS the classifier for the offline engine -- GCC's own wording
    // never reaches mistakes.js on those runs, so the note stands in for it.
    if (typeof mistakeNoteText === 'function') mistakeNoteText(n.text, { line: n.line });
  });
}
