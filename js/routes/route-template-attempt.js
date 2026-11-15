/* ============================================================
   Route: template-attempt — learning one template by heart
   ------------------------------------------------------------
   Five stages, each asking for a little more from memory:

     1 Copy     the template is on the left; type it
     2 Half     about half its lines are gone (the rest locked in place)
     3 Outline  only the top level is left
     4 Recall   only its one-line label
     5 Vary     the label and new names ("for Book, key isbn")

   The editor is the attempt's own (as in Freeground), on a stand-in program
   flagged `notAttempt`, so nothing here is ever an attempt's draft, history
   or exam. The file's `code` is the stage's target, which is what makes
   Ctrl+Space peek work here unchanged; the lines a stage gives you are its
   starter, locked by starter-lock.js.

   MARKING (js/templates.js). A stage is passed at 95% (Settings) of the
   target's C tokens, so spacing and comments never count. Each peek in
   stages 2-5 costs 10. A template with a harness is also compiled and run:
   printing the right output passes the stage even when the tokens differ,
   because a different correct answer is still correct. And "Accept my
   answer" counts a stage you know you got right at 80.

   SCHEDULE. The first check at Recall or Vary in a session is the honest
   measure of memory, so it alone goes to the review scheduler (review.js,
   type 'template'). Accepting that same answer replaces it.
   ============================================================ */

let _td = null;

function templateAttemptTemplate() {
  return `
    <div class="practice-layout td-layout" id="td-layout" data-zen-key="tdZen">
      <div class="practice-topbar td-topbar">
        <div class="practice-topbar-left">
          <button onclick="tdBack()" class="btn-back-dark" id="td-back-btn">
            <i data-lucide="chevron-left" style="width:18px;height:18px;"></i> Back
          </button>
        </div>
        <div class="td-stages" id="td-stages" role="tablist" aria-label="Stages"></div>
        <div class="practice-topbar-right">
          <div class="td-meter" id="td-meter" title="How close your code is to the target, in C tokens">
            <div class="td-meter-bar"><div class="td-meter-fill" id="td-meter-fill"></div></div>
            <span class="td-meter-text" id="td-meter-text">0%</span>
          </div>
          ${typeof feelButtonTemplate === 'function' ? feelButtonTemplate() : ''}
          ${typeof ostButtonTemplate === 'function' ? ostButtonTemplate() : ''}
          <span class="topbar-div" aria-hidden="true"></span>
          <div class="timer-display" title="Time on this stage">
            <i data-lucide="clock"></i><span id="td-timer">00:00</span>
          </div>
          <button class="btn btn-ghost practice-icon-btn" id="td-peek-btn" title="Hold to peek at the target (or hold Ctrl+Space). Each peek costs 10 points from stage 2 on." aria-label="Peek at the target">
            <i data-lucide="eye" style="width:16px;height:16px;" aria-hidden="true"></i>
          </button>
          <button class="btn btn-primary practice-action-btn" id="td-check-btn" onclick="tdCheck()" title="Check (Ctrl+Enter)">
            <i data-lucide="check-circle"></i> Check
          </button>
        </div>
      </div>
      <div class="practice-body">
        <aside class="practice-sidebar td-side" id="td-side"></aside>
        <div class="practice-editor-area" style="display:flex; flex-direction:column;">
          <div class="editor-toolbar-row">
            <div class="file-tab-bar" id="practice-file-tabs"></div>
            ${editorToolbarTemplate()}
          </div>
          <div style="flex:1; position:relative; min-height:0; display:flex;">
            <div class="editor-line-numbers" id="editor-line-numbers"></div>
            <div style="flex:1; position:relative; min-height:0;" id="td-editor-box">
              <pre id="editor-pre" class="editor-pre"><code id="editor-code"></code></pre>
              <textarea id="editor-textarea" spellcheck="false" class="editor-textarea" placeholder="// Write it here."></textarea>
            </div>
          </div>
        </div>
      </div>
      <div class="td-result" id="td-result" role="dialog" aria-modal="false" aria-labelledby="td-result-title" hidden></div>
    </div>`;
}

function templateAttemptInit() {
  const p = getSessionParam('tplDrill');
  if (typeof tplEnsureStarters === 'function') tplEnsureStarters();
  const t = p && tplFind(p.id);
  if (!t) { spaNavigate('training'); return; }
  if (typeof GuidedTutorial !== 'undefined' && GuidedTutorial.end) GuidedTutorial.end();
  _td = {
    tpl: t, stage: 1, seed: p.seed || 1, review: !!p.review, back: p.back || 'training',
    values: null, target: '', starter: '', peeks: 0, startedAt: Date.now(), timer: 0, meterTimer: 0,
    passedNow: new Set(), reviewDone: false, reviewBefore: undefined, lastCheck: null, checking: false,
    prev: { challenge: state.activeChallenge, variant: state.activeVariant, files: state.userFiles, idx: state.activeFileIndex }
  };
  const ta = document.getElementById('editor-textarea');
  if (ta) ta.addEventListener('input', _tdOnInput);
  const peek = document.getElementById('td-peek-btn');
  if (peek) {
    const show = (e) => { e.preventDefault(); if (typeof codePeekShow === 'function') codePeekShow(); };
    const hide = () => { if (typeof codePeekHide === 'function') codePeekHide(); };
    peek.addEventListener('pointerdown', show);
    peek.addEventListener('pointerup', hide);
    peek.addEventListener('pointerleave', hide);
    peek.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') show(e); });
    peek.addEventListener('keyup', hide);
  }
  // A peek is counted when its layer appears, however it was opened.
  const box = document.getElementById('td-editor-box');
  if (box && box.parentElement) {
    _td.peekObs = new MutationObserver((muts) => {
      muts.forEach(m => m.addedNodes.forEach(n => {
        if (n.id === 'code-peek' && _td) { _td.peeks++; _tdPaintSide(); }
      }));
    });
    _td.peekObs.observe(box.parentElement, { childList: true, subtree: true });
  }
  if (typeof applyEditorViewSettings === 'function') applyEditorViewSettings();
  const layout = document.getElementById('td-layout');
  if (typeof zdockConfigure === 'function') {
    zdockConfigure(layout, { run: false, check: () => tdCheck(), finish: false, timerId: 'td-timer', hp: false });
  }
  if (typeof initZenState === 'function') initZenState();
  if (typeof _syncFullscreenBtn === 'function') _syncFullscreenBtn();
  if (typeof ostMount === 'function') ostMount();
  _td.onKey = _tdKeydown;
  document.addEventListener('keydown', _td.onKey);
  _td.timer = setInterval(_tdTick, 1000);
  tdSetStage(p.stage || 1);
}

function templateAttemptDestroy() {
  if (!_td) return;
  const d = _td;
  _td = null;
  document.removeEventListener('keydown', d.onKey);
  clearInterval(d.timer);
  clearTimeout(d.meterTimer);
  if (d.peekObs) d.peekObs.disconnect();
  if (typeof codePeekHide === 'function') codePeekHide();
  if (typeof zdockUnmount === 'function') zdockUnmount();
  if (typeof skDestroy === 'function') skDestroy();
  if (typeof edCloseFind === 'function') edCloseFind();
  if (typeof ostStop === 'function') ostStop();
  state.activeChallenge = d.prev.challenge;
  state.activeVariant = d.prev.variant;
  state.userFiles = d.prev.files;
  state.activeFileIndex = d.prev.idx;
}

function tdBack() {
  const back = _td ? _td.back : 'training';
  // Part of the daily mix: on to its next step.
  if (back === 'mix' && typeof thubMixNext === 'function') { thubMixNext(); return; }
  spaNavigate(back && back !== 'template-attempt' ? back : 'training');
}

/* ── A stage ───────────────────────────────────────────────── */

function _tdHasVary() {
  return !!(_td && tplVariation(_td.tpl, _td.seed));
}

/** Put stage `n` on screen: its target, what it gives you, a fresh clock. */
function tdSetStage(n) {
  if (!_td) return;
  const t = _td.tpl;
  let stage = Math.min(5, Math.max(1, n | 0));
  if (stage === 5 && !_tdHasVary()) stage = 4;
  _td.stage = stage;
  _td.values = null;
  if (stage === 5) {
    const v = tplVariation(t, _td.seed);
    _td.values = v ? v.values : null;
  }
  _td.target = _td.values ? tplFill(t.body, _td.values) : tplCanonical(t);
  _td.starter = stage === 2 ? tplHalf(t, _td.seed).text : stage === 3 ? tplOutline(t) : '';
  _td.peeks = 0;
  _td.startedAt = Date.now();
  _td.lastCheck = null;

  state.activeChallenge = {
    id: 'tpl:' + t.id, notAttempt: true, title: t.title, tags: [],
    variants: [{ id: 'tpl', name: '', description: '', starterCode: _td.starter, code: _td.target,
      lockStarter: stage === 2 || stage === 3, files: [], tests: [], samples: [], minRequirements: [], hints: [] }]
  };
  state.activeVariant = state.activeChallenge.variants[0];
  state.userFiles = [{ id: 'tpl-main', name: 'main', ext: '.c', starterCode: _td.starter, code: _td.target, userCode: _td.starter }];
  state.activeFileIndex = 0;
  _tdHideResult();
  loadPracticeFile(0, { restored: true });
  _tdPaintStages();
  _tdPaintSide();
  _tdPaintMeter();
  _tdTick();
  const ta = document.getElementById('editor-textarea');
  if (ta) {
    ta.focus();
    // In a stage that gives lines, start on the first empty one.
    if (_td.starter) {
      const lines = ta.value.split('\n');
      let at = 0, pos = 0;
      for (; at < lines.length; at++) { if (!lines[at].trim()) break; pos += lines[at].length + 1; }
      if (at < lines.length) { pos += lines[at].length; ta.setSelectionRange(pos, pos); }
    }
  }
}

function _tdAnswer() {
  if (typeof savePracticeFileCode === 'function') savePracticeFileCode();
  const f = state.userFiles && state.userFiles[0];
  return f ? String(f.userCode || '') : '';
}

function _tdOnInput() {
  if (!_td) return;
  clearTimeout(_td.meterTimer);
  _td.meterTimer = setTimeout(_tdPaintMeter, 150);
}

function _tdPaintMeter() {
  if (!_td) return;
  const pct = tplScore(_tdAnswer(), _td.target);
  const fill = document.getElementById('td-meter-fill');
  const text = document.getElementById('td-meter-text');
  if (fill) {
    fill.style.width = pct + '%';
    fill.classList.toggle('is-pass', pct >= tplPassMark());
  }
  if (text) text.textContent = pct + '%';
}

function _tdTick() {
  if (!_td) return;
  const s = Math.max(0, Math.floor((Date.now() - _td.startedAt) / 1000));
  const el = document.getElementById('td-timer');
  if (el) el.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

function _tdPaintStages() {
  const host = document.getElementById('td-stages');
  if (!host || !_td) return;
  const st = tplStatus(_td.tpl.id);
  const vary = _tdHasVary();
  host.innerHTML = TPL_STAGES.map(s => {
    const on = s.n === _td.stage;
    const done = _td.passedNow.has(s.n) || st.stage >= s.n;
    const off = s.n === 5 && !vary;
    return `
      <button type="button" class="td-stage${on ? ' is-on' : ''}${done ? ' is-done' : ''}" role="tab" aria-selected="${on}"
              ${off ? 'disabled title="This template has nothing to vary"' : `title="${escapeHTML(s.hint)}"`}
              onclick="tdSetStage(${s.n})">
        <span class="td-stage-n">${done && !on ? '<i data-lucide="check"></i>' : s.n}</span>
        <span class="td-stage-name">${s.name}</span>
      </button>`;
  }).join('<span class="td-stage-line" aria-hidden="true"></span>');
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: host });
}

function _tdPaintSide() {
  const host = document.getElementById('td-side');
  if (!host || !_td) return;
  const t = _td.tpl;
  const stage = TPL_STAGES[_td.stage - 1];
  const st = tplStatus(t.id);
  const changes = _td.values ? tplDescribeValues(t, _td.values) : [];
  const hl = (code) => (typeof syntaxHighlight === 'function' ? syntaxHighlight(code) : escapeHTML(code));
  host.innerHTML = `
    <header class="td-head">
      <span class="td-kicker">${_td.review ? 'Review' : 'Template'} · stage ${_td.stage} of 5</span>
      <h1 class="td-title">${escapeHTML(t.title)}</h1>
      ${t.label ? `<p class="td-label">${escapeHTML(t.label)}</p>` : ''}
    </header>
    <div class="td-hint"><i data-lucide="info" aria-hidden="true"></i> ${escapeHTML(stage.hint)}</div>
    ${_td.stage === 1 ? `<pre class="td-target"><code>${hl(_td.target)}</code></pre>` : ''}
    ${changes.length ? `
      <div class="td-vary">
        <div class="td-vary-title">Use these names</div>
        ${changes.map(c => `<div class="td-vary-row"><code>${escapeHTML(c.from)}</code><i data-lucide="arrow-right"></i><code class="is-new">${escapeHTML(c.to)}</code></div>`).join('')}
        <button class="btn btn-ghost btn-sm" onclick="tdNewNames()"><i data-lucide="shuffle"></i> Other names</button>
      </div>` : ''}
    <div class="td-facts">
      <span title="Peeks this stage">${_td.stage >= 2 ? `<i data-lucide="eye"></i> ${_td.peeks} peek${_td.peeks === 1 ? '' : 's'}${_td.peeks ? ' (−' + (_td.peeks * TPL_PEEK_COST) + ')' : ''}` : ''}</span>
      <span><i data-lucide="trophy"></i> best ${st.best}%</span>
      <span><i data-lucide="calendar"></i> ${st.due ? 'review ' + escapeHTML(st.due) : 'not scheduled yet'}</span>
    </div>
    ${t.harness ? '<div class="td-harness-note"><i data-lucide="flask-conical"></i> Check also compiles and runs it: the right output passes even if you wrote it differently.</div>' : ''}`;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: host });
}

function tdNewNames() {
  if (!_td) return;
  _td.seed = (_td.seed % 1000000) + 1;
  tdSetStage(5);
}

/* ── Checking ──────────────────────────────────────────────── */

async function _tdRunHarness(answer) {
  const t = _td.tpl;
  if (!t.harness || !answer.trim() || typeof _rtcRun !== 'function') return null;
  try {
    const src = tplHarnessSource(t, answer, _td.values || {});
    const got = await _rtcRun(src, t.harness.stdin || '', { offline: !navigator.onLine });
    const r = got && got.res;
    if (!r) return { verdict: 'error', note: (got && got.error) || 'No compiler could be reached.' };
    if (r.didExecute === false || (r.buildStderr && !r.stdout && r.exitCode !== 0)) {
      // The online compiler colours its messages; show the words, and the error lines first.
      const raw = String(r.buildStderr || r.stderr || 'It did not compile.');
      const clean = typeof termStripAnsi === 'function' ? termStripAnsi(raw) : raw;
      const lines = clean.split('\n');
      const errs = lines.filter(l => /\b(error|warning)\b/i.test(l));
      return { verdict: 'build', note: (errs.length ? errs : lines).slice(0, 3).join('\n') };
    }
    const out = String(r.stdout || '').replace(/\r\n/g, '\n');
    return { verdict: tplSameOutput(out, t.harness.expect) ? 'pass' : 'fail', out };
  } catch (e) {
    return { verdict: 'error', note: (e && e.message) || String(e) };
  }
}

/** Mark the stage: tokens, peeks, and the harness when there is one. */
async function tdCheck() {
  if (!_td || _td.checking) return;
  const answer = _tdAnswer();
  if (!answer.trim()) { if (typeof toast === 'function') toast('Write something first.', { type: 'info', duration: 1600 }); return; }
  _td.checking = true;
  const btn = document.getElementById('td-check-btn');
  if (btn) { btn.disabled = true; btn.classList.add('is-busy'); }
  const tokens = tplScore(answer, _td.target);
  const cost = _td.stage >= 2 ? _td.peeks * TPL_PEEK_COST : 0;
  const harness = await _tdRunHarness(answer);
  if (!_td) return;
  _td.checking = false;
  if (btn) { btn.disabled = false; btn.classList.remove('is-busy'); }
  const pass = tplPassMark();
  let score = Math.max(0, tokens - cost);
  if (harness && harness.verdict === 'pass') score = Math.max(score, Math.max(0, pass - cost));
  const passed = score >= pass;
  const seconds = Math.round((Date.now() - _td.startedAt) / 1000);
  _td.lastCheck = { tokens, cost, score, passed, harness, seconds, answer };
  tplRecord({ templateId: _td.tpl.id, stage: _td.stage, score, passed, seconds, peeks: _td.peeks,
    seed: _td.seed, answer, harness: harness ? harness.verdict : null });
  if (passed) _td.passedNow.add(_td.stage);
  _tdSchedule(score, false);
  if (passed && _td.stage >= 4 && _td.tpl.relearn) { _td.tpl.relearn = false; if (typeof saveData === 'function') saveData(); }
  _tdSound(passed);
  _tdShowResult();
  _tdPaintStages();
}

/* The first Recall or Vary check of a session goes to the scheduler. */
function _tdSchedule(score, replace) {
  if (!_td || _td.stage < 4 || typeof recordReview !== 'function') return;
  const key = 'template:' + _td.tpl.id;
  if (replace) {
    if (!_td.reviewDone) return;
    if (_td.reviewBefore === undefined) delete state.review[key];
    else state.review[key] = _td.reviewBefore;
  } else {
    if (_td.reviewDone) return;
    _td.reviewBefore = state.review && state.review[key] ? JSON.parse(JSON.stringify(state.review[key])) : undefined;
    _td.reviewDone = true;
  }
  recordReview('template', _td.tpl.id, score);
}

function _tdSound(passed) {
  try {
    if (!passed) { if (typeof psfxFail === 'function') psfxFail(); return; }
    if (_td.stage === 5 || (_td.stage === 4 && !_tdHasVary())) { if (typeof psfxLevelUp === 'function') psfxLevelUp(); }
    else if (typeof psfxPass === 'function') psfxPass();
  } catch (e) { /* sound is never worth an error */ }
}

/** "I know this is right": counted at 80, and it moves you on. */
function tdAccept() {
  if (!_td || !_td.lastCheck || _td.lastCheck.passed) return;
  const c = _td.lastCheck;
  c.passed = true; c.score = 80; c.self = true;
  tplRecord({ templateId: _td.tpl.id, stage: _td.stage, score: 80, passed: true, seconds: c.seconds,
    peeks: _td.peeks, seed: _td.seed, self: true, harness: c.harness ? c.harness.verdict : null });
  _td.passedNow.add(_td.stage);
  _tdSchedule(80, true);
  _tdShowResult();
  _tdPaintStages();
}

function _tdHideResult() {
  const el = document.getElementById('td-result');
  if (el) { el.hidden = true; el.innerHTML = ''; }
  if (typeof codePeekHide === 'function') codePeekHide();
}

function _tdShowResult() {
  const el = document.getElementById('td-result');
  if (!el || !_td || !_td.lastCheck) return;
  const c = _td.lastCheck;
  const last = _td.stage === 5 || (_td.stage === 4 && !_tdHasVary());
  const h = c.harness;
  const hLine = !h ? '' : h.verdict === 'pass' ? '<li class="ok"><i data-lucide="check"></i> It compiles and prints the right output.</li>'
    : h.verdict === 'fail' ? `<li class="bad"><i data-lucide="x"></i> It runs, but prints something else:<pre>${escapeHTML((h.out || '').slice(0, 400)) || '(nothing)'}</pre></li>`
    : h.verdict === 'build' ? `<li class="bad"><i data-lucide="x"></i> It does not compile:<pre>${escapeHTML(h.note || '')}</pre></li>`
    : `<li class="meh"><i data-lucide="wifi-off"></i> Not run: ${escapeHTML(h.note || 'no compiler')}</li>`;
  const rev = state.review && state.review['template:' + _td.tpl.id];
  const next = rev && _td.reviewDone ? `<p class="td-next"><i data-lucide="calendar"></i> Next review: ${escapeHTML(rev.due)}${rev.intervalDays ? ' (in ' + rev.intervalDays + ' day' + (rev.intervalDays === 1 ? '' : 's') + ')' : ''}</p>` : '';
  el.innerHTML = `
    <div class="td-result-card ${c.passed ? 'is-pass' : 'is-fail'}">
      <div class="td-result-score">${c.score}<small>%</small></div>
      <div class="td-result-body">
        <h2 id="td-result-title">${c.self ? 'Counted as right' : c.passed ? (last ? 'Learned. All stages done.' : 'Stage passed') : 'Not yet'}</h2>
        <ul class="td-result-facts">
          <li><i data-lucide="code"></i> ${c.tokens}% of the target's tokens match${c.cost ? `, −${c.cost} for peeking` : ''}.</li>
          ${hLine}
        </ul>
        ${next}
        <div class="td-result-actions">
          ${c.passed && !last ? `<button class="btn btn-primary" onclick="tdSetStage(${_td.stage + 1})">Next: ${TPL_STAGES[_td.stage].name} <i data-lucide="arrow-right"></i></button>` : ''}
          ${!c.passed ? '<button class="btn btn-primary" onclick="tdCompare()"><i data-lucide="eye"></i> Show what differs</button>' : ''}
          <button class="btn btn-secondary" onclick="tdSetStage(${_td.stage})"><i data-lucide="rotate-ccw"></i> Again</button>
          ${!c.passed && _td.stage >= 4 ? `<button class="btn btn-secondary" onclick="tdSetStage(3)"><i data-lucide="arrow-down"></i> Back to Outline</button>` : ''}
          ${_td.stage === 5 ? '<button class="btn btn-secondary" onclick="tdNewNames()"><i data-lucide="shuffle"></i> New names</button>' : ''}
          ${!c.passed ? '<button class="btn btn-ghost" onclick="tdAccept()" title="When you are sure your answer is right: it counts at 80">Accept my answer</button>' : ''}
          <button class="btn btn-ghost" onclick="tdBack()">Done</button>
        </div>
      </div>
      <button class="td-result-x" onclick="_tdHideResult()" aria-label="Close" title="Close (Esc)"><i data-lucide="x"></i></button>
    </div>`;
  el.hidden = false;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: el });
  const first = el.querySelector('.td-result-actions .btn');
  if (first) first.focus();
}

/** The merge of your answer and the target, until the next key or click. */
function tdCompare() {
  const el = document.getElementById('td-result');
  if (el) el.hidden = true;
  if (typeof codePeekShow !== 'function') return;
  // Comparing after a check is not a peek: undo the count it is about to add.
  if (_td) _td.peeks = Math.max(0, _td.peeks - 1);
  codePeekShow();
  const off = () => {
    if (typeof codePeekHide === 'function') codePeekHide();
    document.removeEventListener('keydown', off, true);
    document.removeEventListener('pointerdown', off, true);
  };
  setTimeout(() => {
    document.addEventListener('keydown', off, true);
    document.addEventListener('pointerdown', off, true);
  }, 0);
}

/* ── Keys ──────────────────────────────────────────────────── */

function _tdKeydown(e) {
  if (!_td || document.body.dataset.route !== 'template-attempt') return;
  const ctrl = e.ctrlKey || e.metaKey;
  if (document.querySelector('.modal-overlay:not(.hidden):not([data-mx-ghost])')) return;
  if (ctrl && !e.shiftKey && !e.altKey && e.key === 'Enter') { e.preventDefault(); tdCheck(); return; }
  if (ctrl && !e.altKey && e.key === '\\') { e.preventDefault(); toggleZenMode(); return; }
  if (ctrl && !e.shiftKey && !e.altKey && e.code === 'KeyS') { e.preventDefault(); return; }   // nothing to save; not the browser's dialog
  if (e.key === 'Escape') {
    const res = document.getElementById('td-result');
    const findBar = document.getElementById('ed-find-bar');
    if (res && !res.hidden) { e.preventDefault(); _tdHideResult(); return; }
    if (findBar && findBar.classList.contains('open')) { e.preventDefault(); if (typeof edCloseFind === 'function') edCloseFind(); return; }
    if (typeof isZenMode === 'function' && isZenMode()) { e.preventDefault(); toggleZenMode(); }
  }
}
