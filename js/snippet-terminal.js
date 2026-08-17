/* ============================================================
   SNIPPET-TERMINAL.JS — Dedicated Snippet Library Terminal
   ============================================================ */

let _snipTerm = null;

function _snipTermClose() {
  _snipTerm = null;
  if (window._snipTermEscHandler) {
    document.removeEventListener('keydown', window._snipTermEscHandler);
    window._snipTermEscHandler = null;
  }
  const overlay = document.getElementById('snip-run-code-overlay');
  if (overlay) overlay.remove();
  const toast = document.getElementById('snip-run-code-toast');
  if (toast) toast.remove();
}

function runSnippetCodeWithPiston() {
  const textarea = document.getElementById('try-coding-textarea');
  if (!textarea) return;
  const code = textarea.value;

  let overlay = document.getElementById('snip-run-code-overlay');
  if (overlay) overlay.remove();

  overlay = document.createElement('div');
  overlay.id = 'snip-run-code-overlay';
  overlay.className = 'run-code-overlay';
  document.body.appendChild(overlay);

  overlay.innerHTML = `
    <div class="run-code-window">
      <div class="run-code-header">
        <div class="run-code-header-left">
          <i data-lucide="terminal"></i>
          <span>Snippet Terminal</span>
        </div>
        <button class="run-code-close-btn" id="snip-run-code-close-btn"><i data-lucide="x"></i></button>
      </div>
      <div class="run-code-body" style="flex-direction:column; padding:0;">
        <!-- One surface: you type INTO the transcript, right after the prompt. -->
        <div class="term-output-area term-surface" id="snip-term-output-area">
          <!-- Only #snip-term-lines is re-rendered; moving the input would blur it. -->
          <div class="term-lines" id="snip-term-lines"></div>
          <input type="text" id="snip-term-input" class="term-hidden-input" autocomplete="off"
                 autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Program input" />
        </div>
      </div>
      ${termOptionsPanelHTML('snip-term')}
      <div class="run-code-footer">
        <div class="run-code-footer-left">
          <span class="run-code-status" id="snip-run-code-status">⏳ Compiling...</span>
          <span class="term-elapsed" id="snip-term-elapsed"></span>
          <span id="snip-run-code-engine" style="font-size:0.6875rem;color:#484f58;font-family:var(--font-mono);background:#0d1117;padding:2px 8px;border-radius:4px;border:1px solid #21262d;"></span>
        </div>
        <div class="run-code-footer-right">
          <button class="btn btn-ghost btn-sm term-icon-btn" id="snip-term-opts-btn" title="Compiler options"><i data-lucide="settings-2" style="width:14px;height:14px;"></i></button>
          <button class="btn btn-ghost btn-sm term-icon-btn" id="snip-term-clear-btn" title="Clear the screen"><i data-lucide="eraser" style="width:14px;height:14px;"></i></button>
          <span class="term-footer-sep" aria-hidden="true"></span>
          <button class="btn btn-danger btn-sm" id="snip-term-stop-btn" title="Stop this run" style="display:none;"><i data-lucide="square" style="width:13px;height:13px;"></i> Stop</button>
          <button class="btn btn-secondary btn-sm" id="snip-run-code-restart-btn" title="Restart program"><i data-lucide="rotate-ccw" style="width:14px;height:14px;"></i> Restart</button>
          <button class="btn btn-primary btn-sm" id="snip-run-code-rerun-btn"><i data-lucide="play" style="width:14px;height:14px;fill:currentColor;"></i> Run</button>
        </div>
      </div>
    </div>
  `;

  if (typeof lucide !== 'undefined') lucide.createIcons({ root: overlay });

  document.getElementById('snip-run-code-close-btn').onclick = _snipTermClose;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) _snipTermClose(); });

  document.getElementById('snip-run-code-rerun-btn').onclick = () => {
    const freshCode = document.getElementById('try-coding-textarea')?.value || '';
    _snipTermInit(freshCode);
  };
  document.getElementById('snip-run-code-restart-btn').onclick = () => {
    const freshCode = document.getElementById('try-coding-textarea')?.value || '';
    _snipTermInit(freshCode);
  };

  // Typing goes straight into the transcript (see terminal-io.js).
  termBindInput({
    areaId: 'snip-term-output-area',
    inputId: 'snip-term-input',
    onInput: (v) => { if (_snipTerm) { _snipTerm.pending = v; _snipTermRender(); } },
    onSubmit: (v) => _snipTermHandleInput(v),
    onEscape: () => _snipTermClose()
  });
  const sOn = (id, fn) => { const b = document.getElementById(id); if (b) b.onclick = fn; };
  sOn('snip-term-stop-btn', () => _snipTermStop());
  sOn('snip-term-clear-btn', () => {
    if (!_snipTerm) return;
    _snipTerm.lines = []; _snipTerm.lineOpen = false;
    _snipTermRender(); termFocusInput('snip-term-input');
  });
  sOn('snip-term-opts-btn', () => {
    const el = document.getElementById('snip-term-opts');
    if (!el) return;
    el.style.display = el.style.display === 'none' ? '' : 'none';
    // Closing it hands the caret back to the program (see _termTogglePanel).
    if (el.style.display === 'none') termFocusInput('snip-term-input');
  });

  // Esc closes the terminal even when the stdin input doesn't have focus
  if (window._snipTermEscHandler) document.removeEventListener('keydown', window._snipTermEscHandler);
  window._snipTermEscHandler = (e) => {
    if (e.key === 'Escape' && document.getElementById('snip-run-code-overlay')) {
      e.preventDefault();
      e.stopPropagation();
      _snipTermClose();
    }
  };
  document.addEventListener('keydown', window._snipTermEscHandler);

  _snipTermInit(code);
}

const SNIP_TERM_SENTINEL_STDIN = '54321\n54321\n54321\n54321\n54321\n54321\n';

function _snipTermExpectsInput(code) {
  return /\b(scanf|fscanf|gets|fgets|getchar|getline)\s*\(|\bcin\s*>>/.test(code || '');
}

function _snipTermLCP(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return a.slice(0, i);
}

function _snipTermInit(code) {
  _snipTerm = {
    code: code,
    accStdin: '',
    inputs: [],
    lines: [],          // { type:'stdout'|'stdin'|…, text, echo? }
    lineOpen: false,    // the program's last write had no trailing newline
    pending: '',        // keystrokes not yet entered, drawn inline at the caret
    waiting: false,     // blocked on a read
    displayed: '',      // stdout already shown on screen (trusted prefix)
    echoCount: 0,       // how many user inputs have been echoed
    completed: false,
    running: false,
    engine: 'GCC',
    exitCode: null,
    expectsInput: _snipTermExpectsInput(code),
    instrumented: undefined,
    noInstrument: false,
    merged: undefined,
    stopped: false,
    aborter: null,      // in-flight request, so Stop can cancel it
    warnedLoop: false,
  };
  if (!code || code.trim() === '') {
    _snipTerm.lines.push({ type: 'info', text: 'Nothing to run — the editor is empty.' });
    _snipTerm.completed = true;
    const statusEl = document.getElementById('snip-run-code-status');
    if (statusEl) statusEl.textContent = 'Idle';
    _snipTermRender();
    return;
  }
  _snipTermRender();
  _snipTermRunStep();
}

async function _snipTermCompile(session, source, stdin) {
  const args = termCompilerArgs();
  const key = termCacheKey(source, stdin, args);
  const hit = termCacheGet(key);
  if (hit) return hit;
  const res = await _godboltCompileRun(source, stdin, session.aborter, args);
  termCacheSet(key, res);
  return res;
}

function _snipTermStop() {
  if (!_snipTerm || !_snipTerm.running) return;
  _snipTerm.stopped = true;
  if (_snipTerm.aborter) { try { _snipTerm.aborter.abort(); } catch (e) { /* already gone */ } }
}

function _snipTermShowStop(on) {
  const b = document.getElementById('snip-term-stop-btn');
  if (b) b.style.display = on ? '' : 'none';
}

function _snipTermStartClock(session) {
  _snipTermStopClock(session);
  session.startedAt = Date.now();
  const el = document.getElementById('snip-term-elapsed');
  const tick = () => {
    if (!el || _snipTerm !== session || !session.running) return;
    el.textContent = ((Date.now() - session.startedAt) / 1000).toFixed(1) + 's';
  };
  tick();
  session.clock = setInterval(tick, 100);
}

function _snipTermStopClock(session) {
  if (session && session.clock) { clearInterval(session.clock); session.clock = null; }
  const el = document.getElementById('snip-term-elapsed');
  if (el) el.textContent = '';
}

function _snipTermWarnRunaway(session, exitCode) {
  if (session.warnedLoop || [124, 137, 143].indexOf(exitCode) === -1) return;
  session.warnedLoop = true;
  session.lines.push({ type: 'warning', text: 'Note: with no more input this program keeps running instead of stopping, so each step waits for the sandbox time limit.' });
}

/** Recompile when the flags change — the old binary no longer matches. */
function _snipTermOptsChanged() {
  const panel = document.getElementById('snip-term-opts');
  if (panel) {
    const args = panel.querySelector('.term-opt-args code');
    if (args) args.textContent = termCompilerArgs();
  }
  if (_snipTerm && !_snipTerm.running) {
    const el = document.getElementById('try-coding-textarea');
    _snipTermInit(el ? el.value : _snipTerm.code);
  }
}

function _snipTermSetButtonsRunning(running) {
  ['snip-run-code-rerun-btn', 'snip-run-code-restart-btn'].forEach(id => {
    const b = document.getElementById(id);
    if (b) { b.disabled = running; b.style.opacity = running ? '0.55' : ''; }
  });
}

async function _snipTermRunStep() {
  if (!_snipTerm || _snipTerm.completed || _snipTerm.running) return;
  _snipTerm.running = true;
  const session = _snipTerm;
  _snipTermSetButtonsRunning(true);

  const statusEl = document.getElementById('snip-run-code-status');
  const engineEl = document.getElementById('snip-run-code-engine');
  session.waiting = false;        // no caret while a run is in flight
  session.stopped = false;
  session.aborter = new AbortController();
  _snipTermShowStop(true);

  const firstRun = session.displayed === '' && session.inputs.length === 0;

  const spinIdx = session.lines.length;
  session.lines.push({ type: 'info', text: firstRun ? '⏳ Compiling & running...' : '⏳ Running...' });
  _snipTermRender();

  if (statusEl) statusEl.textContent = firstRun ? '⏳ Compiling with GCC...' : '⏳ Re-running with input...';
  if (engineEl) engineEl.textContent = 'GCC';
  session.engine = 'GCC';
  _snipTermStartClock(session);

  // See the note in practice.js: a probe build reports each stdin read, so the
  // first read that comes up empty is exactly where the program blocks. The
  // two-run common-prefix method is the fallback.
  const interactive = session.expectsInput;

  let resA = null, resB = null, probe = null;
  try {
    if (interactive && !session.noInstrument) {
      if (session.instrumented === undefined) {
        // The Try Coding editor is a single buffer — no companion files to
        // merge, and state.userFiles here is whatever a previous Practice
        // attempt left behind, so it must NOT be pulled in.
        session.merged = session.code;
        session.instrumented = termInstrumentC(session.merged);
      }
      if (session.instrumented) {
        probe = await _snipTermCompile(session, session.instrumented, session.accStdin);
        if (!probe.didExecute) { session.noInstrument = true; probe = null; }
      } else {
        session.noInstrument = true;
      }
    }
    if (probe) {
      resA = probe;
    } else {
      if (session.merged === undefined) session.merged = session.code;
      if (interactive) {
        [resA, resB] = await Promise.all([
          _snipTermCompile(session, session.merged, session.accStdin),
          _snipTermCompile(session, session.merged, session.accStdin + SNIP_TERM_SENTINEL_STDIN)
        ]);
      } else {
        resA = await _snipTermCompile(session, session.merged, session.accStdin);
      }
    }
  } catch (err) {
    if (_snipTerm === session && session.stopped) {
      session.lines.splice(spinIdx, 1);
      session.lines.push({ type: 'warning', text: 'Stopped.' });
      session.running = false; session.completed = true;
      _snipTermStopClock(session); _snipTermShowStop(false); _snipTermSetButtonsRunning(false);
      if (statusEl) statusEl.textContent = '■ Stopped';
      _snipTermRender();
      return;
    }
    if (_snipTerm !== session) return;
    session.engine = 'JSCPP';
    if (engineEl) engineEl.textContent = 'JSCPP';
    if (statusEl) statusEl.textContent = '⚠️ Compiler offline — using interpreter';
    resB = null;
    probe = null;
    try {
      resA = await _snipTermRunJSCPP(session.code, session.accStdin);
    } catch (err2) {
      if (_snipTerm !== session) return;
      session.lines.splice(spinIdx, 1);
      session.lines.push({ type: 'error', text: 'Error: ' + (err2.message || err2) });
      session.completed = true;
      session.running = false;
      _snipTermSetButtonsRunning(false);
      if (statusEl) statusEl.textContent = '❌ Execution failed';
      _snipTermRender();
      return;
    }
  }
  if (_snipTerm !== session) return;

  session.lines.splice(spinIdx, 1);
  _snipTermSetButtonsRunning(false);
  _snipTermStopClock(session);
  _snipTermShowStop(false);

  if (!resA.didExecute) {
    session.lines.push({ type: 'error', text: 'Compilation Error:\n' + (termCleanDiagnostics(resA.buildStderr || resA.stderr) || 'Unknown error') });
    session.completed = true;
    session.running = false;
    session.exitCode = -1;
    if (statusEl) statusEl.textContent = '❌ Compilation Error';
    _snipTermRender();
    return;
  }

  const exitCode = resA.exitCode;
  session.exitCode = exitCode;
  const outA = resA.stdout || '';

  let waitingForInput = false;
  let safe = outA;
  let exact = false;

  if (probe) {
    // See practice.js — the instrumented build makes the read point exact.
    const split = termSplitAtBlockingRead(outA);
    safe = split.safe;
    waitingForInput = split.blocked;
    exact = split.instrumented;
  } else if (session.engine === 'GCC' && interactive && resB) {
    const outB = resB.stdout || '';
    if (outA !== outB || resA.exitCode !== resB.exitCode) {
      safe = _snipTermLCP(outA, outB);
      waitingForInput = true;
    }
  } else if (session.engine === 'JSCPP') {
    waitingForInput = exitCode !== 0 && session.expectsInput;
  }

  // See the matching note in practice.js: the newline that follows a blocking
  // read is the echo of your Enter key, so hold it back while we wait.
  if (!exact && waitingForInput && safe.endsWith('\n')) safe = safe.slice(0, -1);

  // Echo onto the open prompt line, where a real terminal shows it.
  if (session.inputs.length > session.echoCount) {
    termEchoInput(session, session.inputs[session.inputs.length - 1]);
    session.echoCount = session.inputs.length;
  }

  let delta;
  if (safe.startsWith(session.displayed)) {
    delta = safe.slice(session.displayed.length);
  } else {
    delta = safe.slice(_snipTermLCP(safe, session.displayed).length);
  }
  session.displayed = safe;
  _snipTermAppendStdout(delta);

  if (waitingForInput) {
    session.running = false;
    _snipTermWarnRunaway(session, exitCode);
    termResumeInput(session, 'snip-term-input');
    if (statusEl) statusEl.textContent = '⏳ Waiting for input...';
    _snipTermRender();
    return;
  }

  if (exitCode < 0) {
    const sig = Math.abs(exitCode);
    const signalMap = {
      6: 'Aborted (SIGABRT)', 8: 'Floating Point Exception (SIGFPE)',
      9: 'Killed (SIGKILL)', 11: 'Segmentation Fault (SIGSEGV)',
      14: 'Time Limit Exceeded (SIGALRM)'
    };
    session.lines.push({ type: 'error', text: 'Runtime Error: ' + (signalMap[sig] || 'Signal ' + sig) });
    const errText = termCleanDiagnostics(resA.stderr);
    if (errText) session.lines.push({ type: 'error', text: errText });
    session.completed = true;
    session.running = false;
    if (statusEl) statusEl.textContent = '❌ ' + (signalMap[sig] || 'Signal ' + sig);
    _snipTermRender();
    return;
  }

  const errText = termCleanDiagnostics(resA.stderr);
    if (errText) session.lines.push({ type: 'error', text: errText });
  const warnText = termCleanDiagnostics(resA.buildStderr);
  if (warnText) session.lines.push({ type: 'warning', text: '⚠️ ' + warnText });

  session.completed = true;
  session.running = false;
  const note = termExitNote(exitCode);
  session.lines.push({ type: note.ok ? 'info' : 'warning', text: note.line });
  if (statusEl) statusEl.textContent = note.status + (resA.execTime ? ' · ' + resA.execTime + 'ms' : '');
  _snipTermRender();
}

function _snipTermAppendStdout(text) {
  if (_snipTerm) termAppendStdout(_snipTerm, text);
}

function _snipTermHandleInput(value) {
  if (!_snipTerm || _snipTerm.completed || _snipTerm.running || !_snipTerm.waiting) return;
  _snipTerm.pending = '';
  _snipTerm.waiting = false;

  _snipTerm.inputs.push(value);
  _snipTerm.accStdin = _snipTerm.inputs.join('\n') + '\n';

  _snipTermRunStep();
}

function _snipTermRender() {
  const area = document.getElementById('snip-term-output-area');
  if (!area) return;

  // Replace ONLY the transcript — the hidden input must not be re-inserted.
  // Follow the tail only when already at it (see practice.js).
  const following = termAtBottom(area);
  const host = document.getElementById('snip-term-lines');
  if (host) host.innerHTML = termTranscriptHTML(_snipTerm, _snipTerm.pending, _snipTerm.waiting);
  if (_snipTerm && _snipTerm.waiting) termFocusInput('snip-term-input');
  termScrollIfFollowing(area, following);
}

function _snipTermRunJSCPP(code, stdin) {
  return new Promise((resolve, reject) => {
    ensureJSCPP(() => {
      let output = '';
      try {
        const processed = preprocessCForJSCPP(code);
        const exitCode = JSCPP.run(processed, stdin || '', {
          stdio: { write: (s) => { output += s; } },
          unsigned_overflow: 'warn'
        });
        resolve({ didExecute: true, exitCode: exitCode, stdout: output, stderr: '', buildStderr: '', execTime: null });
      } catch (err) {
        const msg = err.message || String(err);
        if (msg.includes('EOF') || msg.includes('Memory overflow')) {
          resolve({ didExecute: true, exitCode: 1, stdout: output, stderr: '', buildStderr: '', execTime: null });
        } else if (msg.includes('parse') || msg.includes('Syntax') || msg.includes('unexpected')) {
          resolve({ didExecute: false, exitCode: -1, stdout: '', stderr: msg, buildStderr: msg, execTime: null });
        } else {
          reject(err);
        }
      }
    });
  });
}
