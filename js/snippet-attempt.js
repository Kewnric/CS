/* ============================================================
   SNIPPET-ATTEMPT.JS — SQL practice
   ------------------------------------------------------------
   The coding attempt is one editor holding one program. A SQL exercise is not
   that shape: it is a dozen short answers against one schema, and writing them
   into a single buffer means the student invents their own numbering and the
   grader has to guess where one answer ends.

   So the editor area — and only the editor area — is replaced by one box per
   test case, each with the question above it. Everything around it is the
   practice-set chrome unchanged: the same topbar, boss bar, timer, panel,
   Check Code button and Finish dialog.

   There is no SQL engine here yet, so Run Code is disabled and says so, and
   Check compares the submitted text against the reference answer rather than
   running either. That comparison is deliberately forgiving about the things
   SQL does not care about (keyword case, whitespace, a trailing semicolon) and
   strict about the things it does (the contents of a string literal).
   ============================================================ */

let _sqa = null;

/* ── Starting one ─────────────────────────────────────────── */

/** From the snippet library's Start attempt button. */
window.sqaStart = function (snippetId) {
  const s = (state.snippets || []).find(x => x.id === snippetId);
  if (!s) return;
  // The button always says Start attempt, because that is what you came to do.
  // With nothing to attempt it offers the one thing that would fix that,
  // rather than being a button that quietly does nothing.
  if (!sqaHasPractice(s)) {
    if (typeof showConfirm === 'function') {
      showConfirm('No test cases yet',
        'This snippet has nothing to attempt. Open it in the admin form to write the questions and their reference answers?',
        () => { if (typeof snippetSetupSql === 'function') snippetSetupSql(snippetId); });
    } else if (typeof toast === 'function') {
      toast('This snippet has no test cases yet.', { type: 'warning' });
    }
    return;
  }
  setSessionParam('sqaSnippet', snippetId);
  spaNavigate('snippet-attempt');
};

/** A snippet is attemptable once it has at least one case with an answer. */
function sqaHasPractice(s) {
  const p = s && s.sqlPractice;
  return !!(p && (p.cases || []).some(c => (c.answer || '').trim()));
}
window.sqaHasPractice = sqaHasPractice;

/* ── Route ────────────────────────────────────────────────── */

function snippetAttemptInit() {
  const id = getSessionParam('sqaSnippet');
  const snippet = (state.snippets || []).find(x => x.id === id);
  if (!snippet || !sqaHasPractice(snippet)) { spaNavigate('snippets'); return; }

  const p = snippet.sqlPractice;
  _sqa = {
    snippetId: id,
    snippet: snippet,
    dialect: p.dialect || 'MySQL',
    initSql: p.initSql || '',
    activeTab: 'main',
    // Only cases that HAVE a reference answer. Check compares against that
    // answer, so a case without one can never be passed no matter what the
    // student writes — showing it would be asking a question with no right
    // answer and then marking it wrong. The admin flags these instead.
    cases: (p.cases || []).filter(c => (c.answer || '').trim()).map((c, i) => ({
      id: c.id || ('c' + i),
      prompt: c.prompt || ('Test Case ' + (i + 1)),
      answer: c.answer || '',
      user: ''
    })),
    startTime: Date.now(),
    paused: false,
    pausedAt: null,
    check: null,
    execs: [],
    submitted: false
  };

  // Anything typed before a reload is still worth having back.
  sqaRestoreDraft();

  const titleEl = document.getElementById('sqa-title');
  if (titleEl) titleEl.textContent = snippet.title || 'SQL Practice';
  const setEl = document.getElementById('sqa-subtitle');
  if (setEl) setEl.textContent = _sqa.dialect;
  const dialectEl = document.getElementById('sqa-dialect-label');
  if (dialectEl) dialectEl.textContent = _sqa.dialect;
  const descEl = document.getElementById('sqa-desc');
  if (descEl) {
    descEl.innerHTML = (typeof formatRichText === 'function'
      ? formatRichText(snippet.description)
      : escapeHTML(snippet.description || '')) || 'No description provided.';
  }
  if (typeof bossSetName === 'function') bossSetName(snippet.title || 'SQL Practice');

  sqaRenderSchema();
  sqaRenderTabs();
  sqaRenderAnswers();
  sqaStartTimer();

  // The bar is hidden until a screen turns it on — practice-set does this on
  // its own init. Without it the wrapper stays display:none and every attempt
  // to paint bails out, which is why the bar sat at a flat 100%.
  const bossOn = sessionStorage.getItem('bossBarEnabled') !== 'false';
  if (typeof bossSetVisible === 'function') bossSetVisible(bossOn);
  const bossBtn = document.getElementById('boss-bar-toggle-btn');
  if (bossBtn) bossBtn.style.color = bossOn ? 'var(--color-warning)' : 'var(--text-tertiary)';

  // The bar starts on the first question rather than empty.
  sqaFocusCase(0);

  // The panel is the coding attempt's, unchanged — it just gets its data from
  // here. runChecks is the one hook: there is nothing to compile.
  if (typeof setPracticePanelCtx === 'function') {
    setPracticePanelCtx({
      mode: 'sql',
      finishLabel: 'Finish attempt…',
      runChecks: () => sqaCheckAll(),
      // Shown as a locked button rather than removed — see ppRunUnavailable.
      runDisabled: 'Running SQL is coming in a future update. The app has no database engine yet, so Check Code compares your answers against the reference instead.',
      problems: () => [{ title: snippet.title || 'SQL Practice' }],
      current: () => 0,
      status: () => _sqa && _sqa.check ? (_sqa.check.allPass ? 'pass' : 'fail') : '',
      onSwitch: () => {},
      tests: () => _sqa ? _sqa.cases.map((c, i) => ({
        name: 'Test case ' + (i + 1), hidden: false, expected: c.answer, stdin: ''
      })) : [],
      minReqs: () => [],
      code: () => _sqa ? _sqa.cases.map(c => c.user).join('\n') : '',
      getCheck: () => _sqa ? _sqa.check : null,
      setCheck: (o) => { if (_sqa) _sqa.check = o; },
      getExecs: () => _sqa ? _sqa.execs : [],
      pushExec: (e) => { if (_sqa) { _sqa.execs.push(e); if (_sqa.execs.length > 20) _sqa.execs.shift(); } },
      snapshot: () => _sqa ? { answers: _sqa.cases.map(c => c.user) } : null,
      onRestore: (snap) => {
        if (!_sqa || !snap) return;
        (snap.answers || []).forEach((v, i) => { if (_sqa.cases[i]) _sqa.cases[i].user = v; });
        sqaRenderAnswers();
      },
      onFinish: () => sqaFinish()
    });
    renderPracticePanel();
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function snippetAttemptDestroy() {
  // An expanded box lives in an overlay outside this route's DOM. Leaving it
  // there would destroy the textarea with the overlay and lose the answer.
  if (typeof sqaCollapse === 'function') sqaCollapse();
  sqaStopTimer();
  sqaSaveDraft();
  _sqa = null;
}

/* ── The file tabs ────────────────────────────────────────── */

/* The coding attempt's own .file-tab markup, not a lookalike. The first pass
   invented .sqa-tab, which drifted from it on every metric — indigo instead of
   the accent cyan, no divider between tabs, no active wash, a different height.
   Reusing the class means it cannot drift again. Extensions come from the
   dialect, so a JavaScript set reads main.js rather than main.sql. */
function sqaRenderTabs() {
  const host = document.getElementById('sqa-file-tabs');
  if (!host || !_sqa) return;
  const ext = sqaExtension(_sqa.dialect);
  const tab = (key, name, locked) => `
    <div class="file-tab${_sqa.activeTab === key ? ' active' : ''}" onclick="sqaSwitchTab('${key}')"
         title="${locked ? 'Provided for you — read only' : 'Your answers'}">
      <span class="file-tab-name">${escapeHTML(name + ext)}</span>
      ${locked ? '<i data-lucide="lock" class="sqa-tab-lock" aria-label="Read only"></i>' : ''}
    </div>`;
  host.innerHTML =
    (_sqa.initSql.trim() ? tab('init', 'init', true) : '') +
    tab('main', 'main', false);
  if (typeof lucide !== 'undefined') lucide.createIcons({ el: host });
}

/* One place deciding what a set's files are called. */
const SQA_EXTENSIONS = {
  'MySQL': '.sql', 'PostgreSQL': '.sql', 'SQLite': '.sql',
  'SQL Server': '.sql', 'Oracle': '.sql',
  'JavaScript': '.js', 'HTML': '.html', 'CSS': '.css',
  'C': '.c', 'C programming': '.c', 'Python': '.py'
};
function sqaExtension(dialect) {
  return SQA_EXTENSIONS[dialect] || '.txt';
}
window.sqaExtension = sqaExtension;

/**
 * The painter for a set's language. Only SQL and C have one; the rest render
 * as escaped plain text rather than being painted with the wrong grammar,
 * which is worse than no colour — a JS answer run through the SQL highlighter
 * gets `IN`, `AS` and `END` lit up as keywords they are not.
 */
function sqaPaintCode(text) {
  const lang = (_sqa && _sqa.dialect) || '';
  if (/SQL|MySQL|Postgre|SQLite|Oracle/i.test(lang)) {
    return typeof sqlHighlight === 'function' ? sqlHighlight(text) : escapeHTML(text);
  }
  if (/^C(\s|$)|^C programming$/i.test(lang)) {
    return typeof syntaxHighlight === 'function' ? syntaxHighlight(text) : escapeHTML(text);
  }
  return escapeHTML(text);
}

window.sqaSwitchTab = function (key) {
  if (!_sqa) return;
  _sqa.activeTab = key;
  sqaRenderTabs();
  const answers = document.getElementById('sqa-answers');
  const init = document.getElementById('sqa-init-view');
  if (answers) answers.classList.toggle('hidden', key !== 'main');
  if (init) init.classList.toggle('hidden', key !== 'init');
};

/** The schema is read-only reference, so it is shown highlighted, not editable. */
function sqaRenderSchema() {
  const host = document.getElementById('sqa-init-code');
  if (!host || !_sqa) return;
  host.innerHTML = sqaPaintCode(_sqa.initSql);
}

/* ── The answer boxes ─────────────────────────────────────── */

function sqaRenderAnswers() {
  const host = document.getElementById('sqa-answers');
  if (!host || !_sqa) return;

  host.innerHTML = _sqa.cases.map((c, i) => `
    <section class="sqa-case" data-case="${i}">
      <div class="sqa-case-top">
        <h3 class="sqa-case-head">Answer for Test Case ${i + 1}:</h3>
        <button type="button" class="sqa-expand" onclick="sqaExpand(${i})"
                title="Open this answer full screen" aria-label="Expand answer ${i + 1}">
          <i data-lucide="maximize-2"></i>
        </button>
      </div>
      <p class="sqa-case-prompt">${escapeHTML(c.prompt)}</p>
      <div class="sqa-box" id="sqa-box-${i}">
        <div class="sqa-lines" id="sqa-lines-${i}"></div>
        <div class="sqa-code-wrap">
          <pre class="sqa-pre"><code id="sqa-hl-${i}"></code></pre>
          <textarea id="sqa-ta-${i}" class="sqa-ta" spellcheck="false" rows="1"
                    aria-label="Answer for test case ${i + 1}"
                    oninput="sqaOnInput(${i})" onscroll="sqaSyncScroll(${i})"
                    onfocus="sqaFocusCase(${i})" onkeydown="sqaKeydown(event, ${i})">${escapeHTML(c.user)}</textarea>
        </div>
      </div>
    </section>`).join('');

  _sqa.cases.forEach((c, i) => sqaPaint(i));
}

window.sqaOnInput = function (i) {
  if (!_sqa || !_sqa.cases[i]) return;
  const ta = document.getElementById('sqa-ta-' + i);
  if (!ta) return;
  _sqa.cases[i].user = ta.value;
  sqaPaint(i);
  sqaUpdateBoss(i);
  sqaSaveDraftSoon();
};

/** Tab inserts two spaces rather than leaving the box — this is an editor. */
window.sqaKeydown = function (e, i) {
  if (e.key !== 'Tab' || e.shiftKey) return;
  e.preventDefault();
  const ta = e.target;
  const s = ta.selectionStart, en = ta.selectionEnd;
  ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(en);
  ta.selectionStart = ta.selectionEnd = s + 2;
  sqaOnInput(i);
};

/** Repaint the highlight, the gutter, and the height, from the textarea. */
function sqaPaint(i) {
  const ta = document.getElementById('sqa-ta-' + i);
  const hl = document.getElementById('sqa-hl-' + i);
  const ln = document.getElementById('sqa-lines-' + i);
  if (!ta || !hl || !ln) return;

  const val = ta.value;
  // The trailing break keeps the last line visible when the value ends in \n.
  hl.innerHTML = sqaPaintCode(val) + '<br/>';

  // The gutter is the editor's, not a column of digits: each row can be
  // marked, the way you flag a line to come back to. Marks are held per case
  // so a repaint does not lose them.
  const lines = val.split('\n').length;
  const marks = _sqa.cases[i].marks || (_sqa.cases[i].marks = {});
  let out = '';
  for (let n = 1; n <= lines; n++) {
    out += '<span class="sqa-line-num' + (marks[n] ? ' marked' : '') + '" data-line="' + n + '"'
        +  ' onclick="sqaToggleMark(' + i + ',' + n + ')" title="Mark this line">'
        +  '<span class="sqa-mark-col">' + (marks[n] ? '<span class="sqa-line-mark"></span>' : '') + '</span>'
        +  '<span class="sqa-ln-no">' + n + '</span></span>';
  }
  ln.innerHTML = out;

  // Grow with the content. height:auto first, or scrollHeight can only ever
  // report the height it already has.
  ta.style.height = 'auto';
  const h = Math.max(ta.scrollHeight, 24);
  ta.style.height = h + 'px';
  hl.parentElement.style.height = h + 'px';
}

window.sqaSyncScroll = function (i) {
  const ta = document.getElementById('sqa-ta-' + i);
  const pre = ta && ta.previousElementSibling;
  if (pre) pre.scrollLeft = ta.scrollLeft;
};

/* ── Run: not yet ─────────────────────────────────────────── */

window.sqaRunDisabled = function () {
  if (typeof toast === 'function') {
    toast('Running SQL is not available yet — there is no database engine in the app. Use Check Code to compare your answers.',
      { type: 'info', duration: 6000 });
  }
};

/* ── Checking, all of them at once ────────────────────────── */

/**
 * What SQL would consider the same statement.
 *
 * String literals are pulled out before the rest is folded to upper case, so
 * `WHERE name = 'All Clear'` and `where NAME = 'All Clear'` match while
 * `'all clear'` does not — keyword case is noise, data case is not.
 */
function sqaNormalise(sql) {
  const held = [];
  let t = String(sql || '')
    .replace(/'(?:[^'\\]|\\.|'')*'|"(?:[^"\\]|\\.)*"/g, (m) => {
      held.push(m);
      return '\u0001' + (held.length - 1) + '\u0002';
    })
    .replace(/--[^\n]*/g, ' ')
    .replace(/#[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    // Spacing around punctuation and operators carries no meaning.
    .replace(/\s*([(),;])\s*/g, '$1')
    .replace(/\s*(<=|>=|<>|!=|=|<|>|\+|\*|\/)\s*/g, '$1')
    .replace(/;+\s*$/, '')
    .trim();
  return t.replace(/\u0001(\d+)\u0002/g, (m, i) => held[Number(i)]);
}
window.sqaNormalise = sqaNormalise;

window.sqaCheckAll = function () {
  if (!_sqa) return;
  const btn = document.getElementById('pp-check-btn');
  if (btn) {
    btn.disabled = true;
    btn._orig = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader" class="run-code-spinner" style="width:16px;height:16px;"></i> Checking…';
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: btn });
  }

  // Every case in one pass — the whole set is graded together, not one box at
  // a time, so the score always describes the same submission.
  const results = _sqa.cases.map((c, i) => {
    const mine = (c.user || '').trim();
    const want = (c.answer || '').trim();
    const passed = !!mine && sqaNormalise(mine) === sqaNormalise(want);
    return {
      name: 'Test case ' + (i + 1),
      hidden: false,
      passed: passed,
      expected: want,
      actual: mine,
      error: mine ? (passed ? '' : 'Does not match the reference answer') : 'No answer written'
    };
  });

  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  _sqa.check = {
    ts: Date.now(),
    codeKey: _sqa.cases.map(c => c.user).join('\n'),
    reqs: [],
    tests: results,
    passed: passed,
    total: total,
    allPass: passed === total,
    testScore: total ? Math.round((passed / total) * 100) : 0
  };
  _sqa.execs.push({
    score: _sqa.check.testScore, ts: _sqa.check.ts,
    snapshot: { answers: _sqa.cases.map(c => c.user) },
    label: 'Check · ' + passed + '/' + total + ' passed'
  });
  if (_sqa.execs.length > 20) _sqa.execs.shift();

  if (btn && btn._orig != null) {
    btn.disabled = false;
    btn.innerHTML = btn._orig;
    btn._orig = null;
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: btn });
  }
  if (typeof renderPracticePanel === 'function') renderPracticePanel();
  if (typeof ppCelebrateRow === 'function') results.forEach((r, i) => ppCelebrateRow(i, !!r.passed, i * 90));
  if (passed === total && typeof ppStarfall === 'function') ppStarfall();
  sqaSaveDraft();
};

/* ── Finishing ────────────────────────────────────────────── */

window.sqaFinish = function () {
  if (!_sqa || _sqa.submitted) return;
  const chk = _sqa.check;
  const detail = chk
    ? `Your last check scored ${chk.passed}/${chk.total}.`
    : 'You have not checked these answers yet, so they will be compared when you finish.';
  const go = () => {
    if (!_sqa.check) sqaCheckAll();
    _sqa.submitted = true;
    sqaRecord();
    sqaClearDraft();
    if (typeof toast === 'function') {
      toast('Attempt recorded — ' + _sqa.check.passed + '/' + _sqa.check.total + ' correct.',
        { type: _sqa.check.allPass ? 'success' : 'info' });
    }
    sqaStopTimer();
    spaNavigate('snippets');
  };
  if (typeof showConfirm === 'function') {
    showConfirm('Finish attempt?', detail + ' This records the attempt and stops the timer.', go);
  } else { go(); }
};

/** Log it where the rest of the app looks for snippet history. */
function sqaRecord() {
  if (!_sqa || !_sqa.check) return;
  if (!state.snippetHistory) state.snippetHistory = [];
  const secs = Math.round((Date.now() - _sqa.startTime) / 1000);
  state.snippetHistory.push({
    id: typeof generateId === 'function' ? generateId() : String(Date.now()),
    snippetId: _sqa.snippetId,
    // Both keys: Try Coding writes snippetTitle and everything reading this
    // log already expects it. Dropping one shape on top of another is how a
    // history list ends up saying "Unknown Snippet".
    snippetTitle: _sqa.snippet.title || 'SQL Practice',
    title: _sqa.snippet.title || 'SQL Practice',
    kind: 'sql',
    language: _sqa.dialect,
    // Per case, so analytics can say WHICH question keeps being missed rather
    // than only how many were.
    cases: (_sqa.check.tests || []).map((t, i) => ({
      prompt: (_sqa.cases[i] || {}).prompt || t.name,
      passed: !!t.passed
    })),
    score: _sqa.check.testScore,
    passed: _sqa.check.passed,
    total: _sqa.check.total,
    duration: secs,
    date: typeof _toLocalDate === 'function' ? _toLocalDate(new Date()) : new Date().toISOString().slice(0, 10),
    ts: Date.now()
  });
  if (typeof saveData === 'function') saveData();
}

/* ── The clock ────────────────────────────────────────────── */

let _sqaTimer = null;

function sqaStartTimer() {
  sqaStopTimer();
  _sqaTimer = setInterval(() => {
    if (!_sqa || _sqa.paused) return;
    const el = document.getElementById('sqa-timer');
    if (!el) return;
    const s = Math.floor((Date.now() - _sqa.startTime) / 1000);
    el.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }, 250);
}

function sqaStopTimer() {
  if (_sqaTimer) { clearInterval(_sqaTimer); _sqaTimer = null; }
}

window.sqaTogglePause = function () {
  if (!_sqa) return;
  if (_sqa.paused) {
    _sqa.startTime += Date.now() - _sqa.pausedAt;
    _sqa.paused = false;
    _sqa.pausedAt = null;
  } else {
    _sqa.paused = true;
    _sqa.pausedAt = Date.now();
  }
  const icon = document.getElementById('sqa-pause-icon');
  if (icon) {
    icon.setAttribute('data-lucide', _sqa.paused ? 'play' : 'pause');
    if (typeof lucide !== 'undefined') lucide.createIcons({ el: icon.parentElement });
  }
};

window.sqaExit = function () {
  sqaSaveDraft();
  spaNavigate('snippets');
};

/* ── Drafts ───────────────────────────────────────────────── */

const SQA_DRAFT_KEY = 'ssp.sqlAttemptDraft';
let _sqaSaveTimer = null;

function sqaSaveDraftSoon() {
  clearTimeout(_sqaSaveTimer);
  _sqaSaveTimer = setTimeout(sqaSaveDraft, 600);
}

function sqaSaveDraft() {
  if (!_sqa || _sqa.submitted) return;
  try {
    localStorage.setItem(SQA_DRAFT_KEY, JSON.stringify({
      snippetId: _sqa.snippetId,
      answers: _sqa.cases.map(c => c.user),
      startTime: _sqa.startTime,
      savedAt: Date.now()
    }));
  } catch (e) { /* quota */ }
}

function sqaRestoreDraft() {
  try {
    const d = JSON.parse(localStorage.getItem(SQA_DRAFT_KEY) || 'null');
    if (!d || d.snippetId !== _sqa.snippetId) return;
    (d.answers || []).forEach((v, i) => { if (_sqa.cases[i]) _sqa.cases[i].user = v || ''; });
    if (d.startTime) _sqa.startTime = d.startTime;
  } catch (e) { /* nothing saved */ }
}

function sqaClearDraft() {
  try { localStorage.removeItem(SQA_DRAFT_KEY); } catch (e) { /* ignore */ }
}

/* ── Marking a line ───────────────────────────────────────────
   Same gesture as the code editor's gutter: click a number to flag the line.
   On an answer that has grown to a dozen rows it is the only way to keep your
   place while reading the schema in the other tab. */
window.sqaToggleMark = function (i, n) {
  if (!_sqa || !_sqa.cases[i]) return;
  const marks = _sqa.cases[i].marks || (_sqa.cases[i].marks = {});
  if (marks[n]) delete marks[n]; else marks[n] = true;
  sqaPaint(i);
};

/* ── One answer, full screen ──────────────────────────────────
   The box is MOVED into the overlay and moved back on close rather than
   copied — one textarea, one value, nothing to keep in sync. The same approach
   the admin form's expanded editor uses. */

let _sqaExpandedFrom = null;
let _sqaExpandedEl = null;
let _sqaExpandedIdx = null;

window.sqaExpand = function (i) {
  if (_sqaExpandedEl || !_sqa || !_sqa.cases[i]) return;
  const box = document.getElementById('sqa-box-' + i);
  if (!box) return;

  let ov = document.getElementById('sqa-expand-modal');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'sqa-expand-modal';
    ov.className = 'modal-overlay';
    document.body.appendChild(ov);
  }
  ov.classList.remove('hidden');
  ov.style.opacity = '';
  ov.innerHTML = `
    <div class="modal-content sqa-expand-modal" onclick="event.stopPropagation()">
      <div class="sqa-expand-head">
        <div class="sqa-expand-title">
          <h2>Answer for Test Case ${i + 1}</h2>
          <p>${escapeHTML(_sqa.cases[i].prompt)}</p>
        </div>
        <button class="btn btn-ghost" onclick="sqaCollapse()" aria-label="Close full screen">
          <i data-lucide="minimize-2"></i> Exit full screen
        </button>
      </div>
      <div class="sqa-expand-slot" id="sqa-expand-slot"></div>
    </div>`;

  const marker = document.createElement('div');
  marker.id = 'sqa-expand-placeholder';
  box.parentNode.insertBefore(marker, box);
  _sqaExpandedFrom = marker;
  _sqaExpandedEl = box;
  _sqaExpandedIdx = i;

  box.classList.add('is-expanded');
  document.getElementById('sqa-expand-slot').appendChild(box);
  ov.onclick = () => sqaCollapse();
  if (typeof lucide !== 'undefined') lucide.createIcons({ el: ov });

  const ta = document.getElementById('sqa-ta-' + i);
  if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
  sqaPaint(i);
};

window.sqaCollapse = function () {
  const ov = document.getElementById('sqa-expand-modal');
  const i = _sqaExpandedIdx;
  if (_sqaExpandedEl && _sqaExpandedFrom && _sqaExpandedFrom.parentNode) {
    _sqaExpandedEl.classList.remove('is-expanded');
    _sqaExpandedFrom.parentNode.insertBefore(_sqaExpandedEl, _sqaExpandedFrom);
    _sqaExpandedFrom.remove();
  }
  _sqaExpandedEl = null;
  _sqaExpandedFrom = null;
  _sqaExpandedIdx = null;
  if (ov) { ov.classList.add('hidden'); ov.innerHTML = ''; ov.onclick = null; }
  if (i != null) sqaPaint(i);
};

/* Escape closes it before anything else on this screen acts on the key, and
   the box must go home before the route is torn down — otherwise it would be
   destroyed inside the overlay and the answer lost with it. */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && _sqaExpandedEl) {
    e.stopPropagation();
    sqaCollapse();
  }
}, true);


/* ── The boss bar, per question ───────────────────────────────
   One question is one fight. The bar belongs to whichever answer box has the
   cursor and measures that answer against its own reference — so moving to
   case 3 shows case 3's health, not an average across the set. Averaging was
   the wrong reading anyway: a set is not one enemy, it is several.

   Same painter, normaliser and green-to-red ramp the coding attempt uses. */

let _sqaBossCase = 0;

window.sqaFocusCase = function (i) {
  if (!_sqa || !_sqa.cases[i]) return;
  _sqaBossCase = i;
  if (typeof bossSetName === 'function') {
    bossSetName('Test Case ' + (i + 1));
  }
  sqaUpdateBoss(i);
};

/** Repaint only when the change belongs to the case the bar is showing. */
function sqaUpdateBoss(i) {
  if (!_sqa || (i != null && i !== _sqaBossCase)) return;
  const wrap = document.getElementById('boss-health-wrapper');
  const bar = document.getElementById('boss-health-bar');
  if (!wrap || !bar || wrap.style.display === 'none') return;

  const c = _sqa.cases[_sqaBossCase];
  if (!c) return;
  const target = (c.answer || '').trim();
  if (!target) {
    if (typeof _bossBarNoTarget === 'function') _bossBarNoTarget();
    return;
  }

  const norm = (t) => (typeof _bossNormalize === 'function')
    ? _bossNormalize(t) : String(t || '').replace(/\s+/g, '');
  const cur = norm(c.user), tgt = norm(target);
  let sim = 0;
  if (typeof calculateSimilarity === 'function') sim = calculateSimilarity(cur, tgt);
  else sim = cur === tgt ? 1 : 0;

  if (typeof _bossBarPaint === 'function') {
    _bossBarPaint(Math.max(0, 100 - sim * 100), { maxHp: tgt.length });
  }
}
window.sqaUpdateBoss = sqaUpdateBoss;


/** The topbar toggle. It pointed at practice-set's handler, which reads _pset —
    null on this route, so the button toggled the bar and then left it blank. */
window.sqaToggleBoss = function () {
  if (typeof toggleBossHealthBar === 'function') toggleBossHealthBar();
  sqaUpdateBoss(_sqaBossCase);
};
