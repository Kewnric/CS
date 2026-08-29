/* ============================================================
   PRACTICE-PANEL.JS — Shared right-hand "third window" for both the
   single-practice page and the multi-problem practice-set page.
   ------------------------------------------------------------
   Contains: Finish-attempt button, a "Problems" switcher grid,
   and two tabs — Tests (Minimum Requirements + Test Cases, each
   runnable) and Executions (Check-Code restore points). No Help Bot.

   Each host page supplies a context object via setPracticePanelCtx():
     {
       mode: 'practice' | 'set',
       finishLabel: string,
       problems(): [{ title }],
       current(): index,
       status(i): 'pass'|'fail'|'edited'|'',
       onSwitch(i),
       tests(): [{ name, stdin, expected, hidden }],
       minReqs(): [{ type }],
       code(): merged source for the current problem,
       getCheck(): last check result object | null,
       setCheck(obj|null),
       getExecs(): [{ score, ts, snapshot, label }],
       pushExec(entry),
       snapshot(): opaque snapshot of the current editor/files,
       onRestore(snapshot),
       onFinish()
     }
   ============================================================ */

let _ppCtx = null;
let _ppActiveTab = 'tests';

function setPracticePanelCtx(ctx) { _ppCtx = ctx; }

/** Resizer for the 3rd window — resizes the panel (the element AFTER the divider). */
function initPanelResizerDrag(e, resizer) {
  e.preventDefault();
  // Its pane is folded away — the seam is only the expand arrow now.
  if (resizer.classList.contains('collapsed')) return;
  const panel = resizer.nextElementSibling;
  const parent = resizer.parentElement;
  if (!panel || !parent) return;
  const startX = e.clientX;
  const startWidth = panel.getBoundingClientRect().width;
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:999999;cursor:col-resize;';
  document.body.appendChild(overlay);
  // Suspend the pane's fold-away transition, or the edge trails the cursor.
  document.body.classList.add('is-resizing');

  // Coalesce to one write per frame — see initResizerDrag.
  let pending = null, raf = 0;
  const paint = () => {
    raf = 0;
    if (pending == null) return;
    panel.style.width = pending + 'px';
    panel.style.flexBasis = pending + 'px';
    panel.style.flexShrink = '0';
    panel.style.maxWidth = 'none';
    pending = null;
  };
  const move = (ev) => {
    // See initResizerDrag: a release outside the window may never reach us.
    if (ev.buttons === 0) { up(); return; }
    const delta = ev.clientX - startX;           // dragging left → negative → wider panel
    let w = Math.max(240, startWidth - delta);
    pending = Math.min(w, parent.getBoundingClientRect().width - 360);
    if (!raf) raf = requestAnimationFrame(paint);
  };
  const up = () => {
    if (raf) { cancelAnimationFrame(raf); paint(); }
    document.body.classList.remove('is-resizing');
    if (overlay.parentNode) document.body.removeChild(overlay);
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', up);
    window.removeEventListener('blur', up);
    window.dispatchEvent(new Event('resize'));
  };
  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', up);
  window.addEventListener('blur', up);           // alt-tabbed away mid-drag
}

function renderPracticePanel() {
  const host = document.getElementById('practice-panel');
  if (!host || !_ppCtx) return;
  // Finish sits at the very bottom of the panel: it's the end of the flow, and
  // pinning it to the top put the most destructive action under the cursor while
  // reading test results.
  host.innerHTML = `
    ${(_ppCtx.problems() || []).length > 1 ? `
    <div class="pp-section pp-problems-section">
      <div class="pp-section-title"><i data-lucide="layout-grid" style="width:13px;height:13px;"></i> Problems</div>
      <div class="pp-problem-grid" id="pp-problem-grid"></div>
    </div>` : ''}
    <div class="pp-tabs">
      <button class="pp-tab ${_ppActiveTab === 'tests' ? 'active' : ''}" onclick="ppSwitchTab('tests')"><i data-lucide="flask-conical" style="width:13px;height:13px;"></i> Tests</button>
      <button class="pp-tab ${_ppActiveTab === 'exec' ? 'active' : ''}" onclick="ppSwitchTab('exec')"><i data-lucide="git-commit-horizontal" style="width:13px;height:13px;"></i> Executions</button>
    </div>
    <div class="pp-tab-body" id="pp-tab-body"></div>
    <div class="pp-footer">
      <button class="btn btn-run-code pp-runcode-btn${_ppCtx.runDisabled ? ' is-unavailable' : ''}"
              id="pp-runcode-btn"
              onclick="${_ppCtx.runDisabled ? 'ppRunUnavailable()' : 'runCodeWithPiston()'}"
              ${_ppCtx.runDisabled ? 'aria-disabled="true"' : ''}
              title="${_ppCtx.runDisabled ? escapeHTML(_ppCtx.runDisabled) : 'Run this code in the terminal'}">
        <i data-lucide="${_ppCtx.runDisabled ? 'lock' : 'play'}" style="width:15px;height:15px;"></i> Run Code
      </button>
      <button class="btn btn-primary pp-finish-btn" id="pp-finish-btn" onclick="ppFinish()">
        <i data-lucide="flag" style="width:15px;height:15px;"></i> ${escapeHTML(_ppCtx.finishLabel || 'Finish attempt…')}
      </button>
    </div>
  `;
  _ppRenderProblems();
  _ppRenderTabBody();
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: host });
}

/** Only rendered when there's more than one problem — a lone "1" box is noise
    on a single-program attempt, where there is nowhere to switch to. */
function _ppRenderProblems() {
  const grid = document.getElementById('pp-problem-grid');
  if (!grid || !_ppCtx) return;
  const probs = _ppCtx.problems() || [];
  const cur = _ppCtx.current();
  grid.innerHTML = probs.map((p, i) => {
    const status = _ppCtx.status ? _ppCtx.status(i) : '';
    const current = i === cur ? ' current' : '';
    let badge = '';
    if (status === 'pass') badge = '<i data-lucide="check" class="pset-box-badge"></i>';
    else if (status === 'fail') badge = '<i data-lucide="x" class="pset-box-badge"></i>';
    return `<button class="pset-box ${status}${current}" onclick="ppSwitchProblem(${i})" title="${escapeHTML(p.title || ('Problem ' + (i + 1)))}"><span>${i + 1}</span>${badge}</button>`;
  }).join('');
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: grid });
}

function ppSwitchProblem(i) {
  if (!_ppCtx || !_ppCtx.onSwitch) return;
  _ppRowChoice = {};          // row indices mean a different test on the next problem
  _ppCtx.onSwitch(i);
}

function ppSwitchTab(tab) {
  _ppActiveTab = tab;
  const host = document.getElementById('practice-panel');
  if (host) host.querySelectorAll('.pp-tab').forEach(b => b.classList.toggle('active', b.getAttribute('onclick').includes(`'${tab}'`)));
  _ppRenderTabBody();
}

function _ppRenderTabBody() {
  const body = document.getElementById('pp-tab-body');
  if (!body || !_ppCtx) return;
  body.innerHTML = _ppActiveTab === 'exec' ? _ppExecHtml() : _ppTestsHtml();
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: body });
  // One paint only — a later re-render (a test run, a tab switch) must not
  // replay the roll-down on a panel that has been sitting open all along.
  _ppJustOpened = null;
}

/* ── Expandable test rows ──────────────────────────────────────
   A failing test opens itself, because that's the one you need to read. Any
   other row opens on demand. _ppRowChoice records only the rows you've clicked,
   so an explicit collapse survives a re-render without freezing every other row
   at whatever it happened to be when you clicked. */
let _ppRowChoice = {};

/* Which row's panel should play its open animation on the next paint. The tab
   body is re-rendered whole, so without this every panel already on screen was
   destroyed and rebuilt — and replayed its roll-down — each time another row was
   opened, which read as both of them flickering. */
let _ppJustOpened = null;

function _ppRowIsOpen(ti, res, t) {
  if (Object.prototype.hasOwnProperty.call(_ppRowChoice, ti)) return _ppRowChoice[ti];
  return !!(res && !res.passed && !t.hidden);
}

function ppToggleTestDetail(ti) {
  const tests = (_ppCtx && _ppCtx.tests ? _ppCtx.tests() : []) || [];
  const check = _ppCtx && _ppCtx.getCheck ? _ppCtx.getCheck() : null;
  const res = check && check.tests ? check.tests[ti] : null;
  const willOpen = !_ppRowIsOpen(ti, res, tests[ti] || {});
  _ppRowChoice[ti] = willOpen;

  // Only THIS row rolls down; every other open panel is redrawn as-is.
  _ppJustOpened = willOpen ? ti : null;

  // Opening animates itself on insert (see .pp-test-detail). Closing has to be
  // played BEFORE the re-render, which deletes the element it would play on.
  const wrap = document.querySelector(`.pp-row-wrap[data-ti="${ti}"]`);
  const detail = wrap && wrap.querySelector('.pp-test-detail');
  if (!willOpen && detail && !_ppReduceMotion()) {
    detail.classList.add('closing');
    const tog = wrap.querySelector('.pp-row-toggle');
    if (tog) tog.setAttribute('aria-expanded', 'false');   // flip the arrow now, not in 200ms
    setTimeout(() => _ppRenderTabBody(), 190);
    return;
  }
  _ppRenderTabBody();
}

/**
 * Your output and the expected output, side by side.
 * @param {boolean} fresh this row was just opened, so it plays the roll-down
 */
function _ppTestDetailHtml(t, res, fresh) {
  const cls = 'pp-test-detail' + (fresh ? ' just-opened' : '');
  if (t.hidden) {
    return `<div class="${cls}"><div class="pp-io-note">Hidden test — its input and expected output stay hidden.</div></div>`;
  }
  const expected = (res && res.expected != null && res.expected !== '') ? res.expected : (t.expected || '');
  const hasRun = !!res;
  const actual = hasRun ? (res.actual || '') : '';
  const ok = !!(res && res.passed);
  return `<div class="${cls}">
    ${t.stdin ? `<div class="pp-io-stdin"><span class="pp-io-tag">stdin</span><pre class="pp-io-body">${escapeHTML(t.stdin)}</pre></div>` : ''}
    <div class="pp-io-grid">
      <div class="pp-io ${hasRun ? (ok ? 'ok' : 'no') : ''}">
        <div class="pp-io-head">Your output</div>
        <pre class="pp-io-body">${hasRun ? (actual ? escapeHTML(actual) : '<em class="pp-io-empty">(no output)</em>') : '<em class="pp-io-empty">Not run yet</em>'}</pre>
      </div>
      <div class="pp-io">
        <div class="pp-io-head">Expected output</div>
        <pre class="pp-io-body">${expected ? escapeHTML(expected) : '<em class="pp-io-empty">(none)</em>'}</pre>
      </div>
    </div>
    ${res && res.error ? `<div class="pp-test-err">${escapeHTML(res.error)}</div>` : ''}
  </div>`;
}

function _ppReqIcon(state) {
  if (state === 'ok') return '<i data-lucide="check-circle-2" class="pp-row-ic ok"></i>';
  if (state === 'no') return '<i data-lucide="x-circle" class="pp-row-ic no"></i>';
  return '<i data-lucide="circle" class="pp-row-ic idle"></i>';
}

function _ppTestsHtml() {
  const check = _ppCtx.getCheck ? _ppCtx.getCheck() : null;
  const stale = check && check.codeKey != null && check.codeKey !== _ppCtx.code();
  const reqs = _ppCtx.minReqs ? (_ppCtx.minReqs() || []) : [];
  const tests = _ppCtx.tests ? (_ppCtx.tests() || []) : [];

  // Minimum Requirements
  let reqHtml = '';
  if (reqs.length) {
    reqHtml = `<div class="pp-block-title"><i data-lucide="list-checks" style="width:13px;height:13px;color:var(--color-warning);"></i> Minimum Requirements</div>` +
      reqs.map((r, ri) => {
        const res = check && check.reqs ? check.reqs.find(x => x.type === r.type) : null;
        const state = res ? (res.ok ? 'ok' : 'no') : 'idle';
        return `<div class="pp-row ${state}">
          ${_ppReqIcon(state)}
          <span class="pp-row-label">${escapeHTML(minReqLabel(r.type))}</span>
          <button class="pp-run-btn" onclick="ppRunMinReq(${ri})" title="Check this requirement"><i data-lucide="play" style="width:12px;height:12px;"></i></button>
        </div>`;
      }).join('');
  }

  // Test Cases — each row expands to your output beside the expected output.
  let testHtml = '';
  if (tests.length) {
    testHtml = `<div class="pp-block-title" style="margin-top:0.75rem;"><i data-lucide="check-circle" style="width:13px;height:13px;color:var(--color-success);"></i> Test Cases</div>` +
      tests.map((t, ti) => {
        const res = check && check.tests ? check.tests[ti] : null;
        const state = res ? (res.passed ? 'ok' : 'no') : 'idle';
        const open = _ppRowIsOpen(ti, res, t);
        return `<div class="pp-row-wrap" data-ti="${ti}">
          <div class="pp-row ${state}">
            ${_ppReqIcon(state)}
            <span class="pp-row-label">${escapeHTML(t.name || ('Test case ' + (ti + 1)))}${t.hidden ? ' <em class="pp-hidden">(hidden)</em>' : ''}</span>
            <button class="pp-row-toggle" onclick="ppToggleTestDetail(${ti})" aria-expanded="${open}"
                    title="${open ? 'Hide' : 'Show'} this test's output">
              <i data-lucide="chevron-${open ? 'down' : 'up'}" style="width:13px;height:13px;"></i>
            </button>
            <button class="pp-run-btn" onclick="ppRunTest(${ti})" title="Run this test"><i data-lucide="play" style="width:12px;height:12px;"></i></button>
          </div>
          ${open ? _ppTestDetailHtml(t, res, _ppJustOpened === ti) : ''}
        </div>`;
      }).join('');
  }

  if (!reqs.length && !tests.length) {
    return `<div class="pp-empty"><i data-lucide="flask-conical"></i><p>No tests or requirements for this problem.</p><p class="pp-empty-sub">It's graded by reference-code match. Use <strong>Check Code</strong> to compile-check.</p></div>`;
  }

  const scoreLine = check
    ? `<div class="pp-score ${check.allPass ? 'pass' : 'fail'}">Score: ${check.passed}/${check.total}${stale ? ' <span class="pp-stale">· code changed, re-check</span>' : ''}</div>`
    : `<div class="pp-score idle">Not checked yet — press <strong>Check Code</strong>.</div>`;

  return `<div class="pp-tests">${reqHtml}${testHtml}${scoreLine}</div>`;
}

function _ppExecHtml() {
  const execs = _ppCtx.getExecs ? (_ppCtx.getExecs() || []) : [];
  if (!execs.length) {
    return `<div class="pp-empty"><i data-lucide="git-commit-horizontal"></i><p>No executions yet.</p><p class="pp-empty-sub">Each <strong>Check Code</strong> is saved here as a restore point — jump back to any earlier version (e.g. when you scored higher).</p></div>`;
  }
  const best = Math.max(...execs.map(e => e.score));
  // Newest first
  return `<div class="pp-execs">` + execs.slice().reverse().map((e, ri) => {
    const realIdx = execs.length - 1 - ri;
    const cls = e.score === 100 ? 'pass' : e.score >= 50 ? 'mid' : 'fail';
    const isBest = e.score === best;
    const t = new Date(e.ts);
    const timeStr = t.toLocaleTimeString();
    return `<div class="pp-exec-row ${isBest ? 'best' : ''}">
      <span class="badge ${e.score === 100 ? 'score-perfect' : e.score >= 50 ? 'score-partial' : 'score-low'}">${e.score}%</span>
      <div class="pp-exec-info">
        <div class="pp-exec-label">${escapeHTML(e.label || ('Check ' + (realIdx + 1)))}${isBest ? ' <span class="pp-best-tag">BEST</span>' : ''}</div>
        <div class="pp-exec-time">${timeStr}</div>
      </div>
      <button class="btn btn-secondary btn-sm pp-restore-btn" onclick="ppRestore(${realIdx})" title="Restore this version's code"><i data-lucide="rotate-ccw" style="width:13px;height:13px;"></i> Restore</button>
    </div>`;
  }).join('') + `</div>`;
}

// ── Actions ──

/** Top-bar "Check Code" → run all minimum requirements + test cases for the current problem. */
async function ppRunAllChecks() {
  if (!_ppCtx) return;
  if (typeof psfxWorkStart === 'function') psfxWorkStart();
  // A mode whose answers are not compiled brings its own checker. SQL practice
  // compares text against a reference answer; there is nothing to build and
  // nothing to run, so none of the machinery below applies to it.
  if (_ppCtx.runChecks) {
    if (typeof psfxWorkStop === 'function') psfxWorkStop();
    return _ppCtx.runChecks();
  }
  const codeNow = _ppCtx.code();
  if (!codeNow || !codeNow.trim()) {
    if (typeof toast === 'function') toast('Write some code first.', { type: 'warning' });
    return;
  }
  // Check Code now lives in the panel footer; the old topbar ids are kept as a
  // fallback so nothing breaks if a template still carries one.
  const checkBtn = document.getElementById('pp-check-btn')
    || document.getElementById(_ppCtx.mode === 'set' ? 'pset-check-btn' : 'practice-check-btn');
  if (checkBtn) { checkBtn.disabled = true; checkBtn._orig = checkBtn.innerHTML; checkBtn.innerHTML = '<i data-lucide="loader" class="run-code-spinner" style="width:16px;height:16px;"></i> Checking…'; if (typeof lucide !== 'undefined') lucide.createIcons({ root: checkBtn }); }

  const reqs = (_ppCtx.minReqs() || []).map(r => ({ type: r.type, ok: evalMinRequirement(r.type, codeNow) }));
  const tests = _ppCtx.tests() || [];
  let testResults = [];
  let testsPassed = 0;
  let compileOk;
  if (tests.length) {
    try { testResults = await runTestCases(tests, codeNow); }
    catch (e) { testResults = tests.map(t => ({ name: t.name, hidden: t.hidden, passed: false, expected: t.expected, actual: '', error: 'Could not run' })); }
    testsPassed = testResults.filter(r => r.passed).length;
  } else {
    // No tests → compile-check so the score still means something.
    let ok = false;
    try { const res = await _godboltCompileRun(codeNow, ''); ok = !!(res && res.didExecute); }
    catch (e) { try { const r2 = await _gradeRunJSCPP(codeNow, ''); ok = !!(r2 && r2.didExecute); } catch (e2) { ok = false; } }
    testResults = [{ name: 'Compiles & runs', hidden: false, passed: ok, expected: '', actual: '', error: ok ? '' : 'Does not compile' }];
    testsPassed = ok ? 1 : 0;
    compileOk = ok;   // remembered so a later per-row ▶ can't zero this half (_ppRecount)
  }

  const reqsOk = reqs.filter(r => r.ok).length;
  const total = (tests.length || 1) + reqs.length;
  const passed = testsPassed + reqsOk;
  const allPass = passed === total;

  const check = { ts: Date.now(), codeKey: codeNow, reqs, tests: tests.length ? testResults : [], passed, total, allPass, compileOk,
                  testScore: tests.length ? Math.round((testsPassed / tests.length) * 100) : (testsPassed ? 100 : 0) };
  if (_ppCtx.setCheck) _ppCtx.setCheck(check);
  // Fresh results — let the new failures open themselves again.
  _ppRowChoice = {};

  // Save a restore point keyed to this check's overall score (reqs + tests).
  if (_ppCtx.pushExec && _ppCtx.snapshot) {
    const overall = total > 0 ? Math.round((passed / total) * 100) : 0;
    _ppCtx.pushExec({ score: overall, ts: check.ts, snapshot: _ppCtx.snapshot(), label: `Check · ${passed}/${total} passed` });
  }

  if (checkBtn && checkBtn._orig != null) {
    checkBtn.disabled = false;
    checkBtn.innerHTML = checkBtn._orig;
    checkBtn._orig = null;
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: checkBtn });
  }
  renderPracticePanel();

  if (typeof psfxWorkStop === 'function') psfxWorkStop();

  // React per row, then once for the whole run if everything landed.
  if (tests.length) {
    testResults.forEach((r, ti) => ppCelebrateRow(ti, !!r.passed, ti * 90));
    if (testsPassed === tests.length) ppStarfall();
  }
}

/**
 * Recompute passed/total on a check that was built one row at a time.
 *
 * The per-row ▶ buttons used to leave the score fields at their `0` initial
 * value, so a check assembled that way reported "0/0" — most visibly in the
 * Finish attempt dialog, which quotes them back at you. The denominators here
 * match ppRunAllChecks exactly: every test case (or the single implicit
 * compile check when a problem has none) plus every minimum requirement,
 * whether or not it has actually been run yet.
 */
function _ppRecount(check) {
  if (!check || !_ppCtx) return check;
  const tests = (_ppCtx.tests && _ppCtx.tests()) || [];
  const reqs = (_ppCtx.minReqs && _ppCtx.minReqs()) || [];
  const testsPassed = tests.length
    ? (check.tests || []).filter(r => r && r.passed).length
    // No test cases → the test half of the score is the compile check, which
    // only a full Check Code can run. A row ▶ must not silently zero it.
    : (check.compileOk ? 1 : 0);
  const reqsOk = (check.reqs || []).filter(r => r && r.ok).length;
  check.total = (tests.length || 1) + reqs.length;
  check.passed = testsPassed + reqsOk;
  check.allPass = check.total > 0 && check.passed === check.total;
  if (tests.length) check.testScore = Math.round((testsPassed / tests.length) * 100);
  return check;
}

/** Run a single test case (▶ on the row). */
async function ppRunTest(ti) {
  if (!_ppCtx) return;
  const tests = _ppCtx.tests() || [];
  const t = tests[ti];
  if (!t) return;
  const codeNow = _ppCtx.code();
  let res;
  try { res = (await runTestCases([t], codeNow))[0]; }
  catch (e) { res = { name: t.name, hidden: t.hidden, passed: false, expected: t.expected, actual: '', error: 'Could not run' }; }

  const check = (_ppCtx.getCheck && _ppCtx.getCheck()) || { ts: Date.now(), codeKey: codeNow, reqs: [], tests: tests.map(() => null), passed: 0, total: 0 };
  if (!Array.isArray(check.tests) || check.tests.length !== tests.length) check.tests = tests.map(() => null);
  check.tests[ti] = res;
  check.codeKey = codeNow;
  _ppRecount(check);
  if (_ppCtx.setCheck) _ppCtx.setCheck(check);
  _ppRenderTabBody();
  _ppRenderProblems();
  ppCelebrateRow(ti, !!res.passed);
}

/** Check a single minimum requirement (instant, no compile). */
function ppRunMinReq(ri) {
  if (!_ppCtx) return;
  const reqs = _ppCtx.minReqs() || [];
  const r = reqs[ri];
  if (!r) return;
  const codeNow = _ppCtx.code();
  const ok = evalMinRequirement(r.type, codeNow);
  const check = (_ppCtx.getCheck && _ppCtx.getCheck()) || { ts: Date.now(), codeKey: codeNow, reqs: [], tests: [], passed: 0, total: 0 };
  if (!Array.isArray(check.reqs)) check.reqs = [];
  const existing = check.reqs.find(x => x.type === r.type);
  if (existing) existing.ok = ok; else check.reqs.push({ type: r.type, ok });
  check.codeKey = codeNow;
  _ppRecount(check);
  if (_ppCtx.setCheck) _ppCtx.setCheck(check);
  _ppRenderTabBody();
}

function ppRestore(execIdx) {
  if (!_ppCtx || !_ppCtx.getExecs) return;
  const execs = _ppCtx.getExecs();
  const e = execs[execIdx];
  if (!e || !_ppCtx.onRestore) return;
  showConfirm('Restore version', `Restore the code from this checkpoint (scored ${e.score}%)? Your current code for this problem will be replaced.`, () => {
    _ppCtx.onRestore(e.snapshot);
    renderPracticePanel();
  });
}

function ppFinish() {
  if (_ppCtx && _ppCtx.onFinish) _ppCtx.onFinish();
}

/* ── Result feedback ───────────────────────────────────────────
   A pass/fail icon changing colour is easy to miss when the panel is off to
   one side and your eyes are on the code, so the result is thrown at you: a
   confetti burst out of the row that passed, a shower of ✕ down from the one
   that failed, and stars across the whole page when every case passes.

   Particles live in a fixed, full-window layer rather than inside the row —
   .practice-panel scrolls and clips its children, so anything spawned in place
   would be cut off at the panel edge. */

function _ppReduceMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function _ppFxLayer() {
  let layer = document.getElementById('pp-fx');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'pp-fx';
    layer.className = 'pp-fx';
    document.body.appendChild(layer);
  }
  return layer;
}

/** Drop a particle in and bin it once its animation is over. */
function _ppFxAdd(layer, el, ttl) {
  layer.appendChild(el);
  const done = () => el.remove();
  el.addEventListener('animationend', done, { once: true });
  setTimeout(done, ttl);            // animationend never fires on a hidden tab
}

const PP_CONFETTI_COLORS = ['#34d399', '#22d3ee', '#a78bfa', '#fbbf24', '#f472b6',
                            '#60a5fa', '#fb7185', '#facc15', '#4ade80'];

/**
 * @param {number} ti   index of the test row
 * @param {boolean} ok  passed → confetti, failed → falling ✕
 * @param {number} [delay] stagger when a whole run reports at once
 */
function ppCelebrateRow(ti, ok, delay) {
  /* The cue comes first, and on its own schedule. Everything below this line
     can decline to draw — reduced motion, a row scrolled out of view — and
     none of those are reasons to go quiet. Asking not to see animation is not
     asking not to hear the result, and a row you cannot see is exactly the
     one worth hearing about. */
  const say = () => {
    if (typeof psfxPass !== 'function') return;
    ok ? psfxPass() : psfxFail();
  };
  if (delay) setTimeout(say, delay); else say();

  if (_ppReduceMotion()) return;
  const wrap = document.querySelector(`.pp-row-wrap[data-ti="${ti}"]`);
  if (!wrap) return;
  const r = wrap.getBoundingClientRect();
  if (!r.width || r.bottom < 0 || r.top > window.innerHeight) return;   // scrolled out of view
  const run = () => (ok ? _ppConfettiBurst(r) : _ppCrossRain(r));
  if (delay) setTimeout(run, delay); else run();
}

/**
 * One row's worth of confetti.
 *
 * THREE NESTED ELEMENTS PER PIECE, and that is the whole point. Confetti
 * needs three motions at once that do not share a curve: sideways travel
 * that SLOWS (air resistance), a fall that SPEEDS UP (gravity), and a tumble
 * that does neither and simply keeps going. One element can only carry one
 * timing function, which is why the old single-span version appeared to hit
 * the brakes — everything on it decelerated together, and the rotation
 * stopped outright halfway through because it held the same value at 55% and
 * 100%.
 *
 * So: the outer drifts and fades, the middle handles the arc, and the inner
 * spins. Each with its own easing, and the spin runs linear and infinite so
 * nothing ever coasts to a halt.
 */
function _ppConfettiBurst(r) {
  const layer = _ppFxLayer();
  const cx = r.left + r.width / 2;
  const cy = r.top + Math.min(18, r.height / 2);
  const vh = window.innerHeight;

  for (let i = 0; i < 34; i++) {
    const piece = document.createElement('i');
    piece.className = 'pp-confetti';
    const arc = document.createElement('span');
    arc.className = 'pp-conf-arc';
    const paper = document.createElement('b');
    paper.className = 'pp-conf-paper';

    // Thrown up and out. Mostly sideways, because the row it comes from is a
    // wide, short strip and a vertical spout would look like a fountain.
    const dir = Math.random() < 0.5 ? -1 : 1;
    const spread = 60 + Math.random() * 190;
    const rise = 55 + Math.random() * 95;
    // Far enough below the fold that every piece leaves the screen still
    // travelling. Nothing should be caught stopping.
    const fall = (cy < vh ? vh - cy : 0) + 140 + Math.random() * 220;

    piece.style.left = cx + 'px';
    piece.style.top = cy + 'px';
    piece.style.setProperty('--dx', (dir * spread).toFixed(0) + 'px');
    piece.style.setProperty('--rise', (-rise).toFixed(0) + 'px');
    piece.style.setProperty('--fall', fall.toFixed(0) + 'px');
    piece.style.setProperty('--life', (1.5 + Math.random() * 0.9).toFixed(2) + 's');
    piece.style.animationDelay = (Math.random() * 120) + 'ms';

    // Tumble. Two axes: the Z turn is what you read as spin, the Y turn is
    // what makes a piece flash edge-on and read as PAPER rather than a dot.
    paper.style.setProperty('--turn', (dir * (360 + Math.random() * 540)).toFixed(0) + 'deg');
    paper.style.setProperty('--flip', (720 + Math.random() * 1080).toFixed(0) + 'deg');
    paper.style.setProperty('--spin', (0.5 + Math.random() * 0.7).toFixed(2) + 's');
    paper.style.background = PP_CONFETTI_COLORS[Math.floor(Math.random() * PP_CONFETTI_COLORS.length)];

    // Three shapes, so a burst is not 34 copies of one rectangle.
    const shape = Math.random();
    if (shape < 0.18) {
      paper.style.borderRadius = '50%';
      paper.style.width = paper.style.height = (4 + Math.random() * 4).toFixed(0) + 'px';
    } else if (shape < 0.38) {
      // A ribbon: long, thin, and the most convincing thing in the burst when
      // it turns edge-on.
      paper.style.width = (2 + Math.random() * 2).toFixed(0) + 'px';
      paper.style.height = (10 + Math.random() * 8).toFixed(0) + 'px';
      paper.style.borderRadius = '1px';
    } else {
      paper.style.width = (5 + Math.random() * 4).toFixed(0) + 'px';
      paper.style.height = (3 + Math.random() * 3).toFixed(0) + 'px';
    }

    arc.appendChild(paper);
    piece.appendChild(arc);
    _ppFxAdd(layer, piece, 2600);
  }
}

function _ppCrossRain(r) {
  const layer = _ppFxLayer();
  for (let i = 0; i < 16; i++) {
    const x = document.createElement('i');
    x.className = 'pp-cross';
    x.textContent = '✕';
    x.style.left = (r.left + 8 + Math.random() * Math.max(20, r.width - 16)) + 'px';
    x.style.top = (r.top + Math.random() * Math.min(24, r.height)) + 'px';
    x.style.fontSize = (9 + Math.random() * 7) + 'px';
    x.style.setProperty('--drift', (Math.random() * 26 - 13) + 'px');
    x.style.setProperty('--fall', (70 + Math.random() * 90) + 'px');
    x.style.animationDelay = (Math.random() * 260) + 'ms';
    _ppFxAdd(layer, x, 1800);
  }
}

/** Every test case passed — stars down the whole window, not just the row. */
function ppStarfall() {
  // Before the motion check, for the same reason as the row cues.
  if (typeof psfxStarfall === 'function') psfxStarfall();
  if (_ppReduceMotion()) return;
  const layer = _ppFxLayer();
  const w = window.innerWidth;
  for (let i = 0; i < 46; i++) {
    const s = document.createElement('i');
    s.className = 'pp-star';
    s.textContent = '★';
    s.style.left = (Math.random() * w) + 'px';
    s.style.top = (-30 - Math.random() * 140) + 'px';
    s.style.fontSize = (10 + Math.random() * 16) + 'px';
    s.style.setProperty('--drift', (Math.random() * 90 - 45) + 'px');
    s.style.setProperty('--fall', (window.innerHeight + 120) + 'px');
    s.style.animationDuration = (2.1 + Math.random() * 1.6) + 's';
    s.style.animationDelay = (Math.random() * 900) + 'ms';
    _ppFxAdd(layer, s, 5200);
  }
}

/** Nothing should still be falling after you leave the page. */
function ppClearFx() {
  const layer = document.getElementById('pp-fx');
  if (layer) layer.remove();
}


/**
 * Run Code where there is no engine behind it. Left visible rather than hidden:
 * the button not being there reads as a layout that forgot it, whereas a locked
 * one says the feature is known about and is not ready.
 */
function ppRunUnavailable() {
  const why = (_ppCtx && _ppCtx.runDisabled) || 'Running is not available here yet.';
  if (typeof toast === 'function') toast(why, { type: 'info', duration: 6000 });
}
window.ppRunUnavailable = ppRunUnavailable;
