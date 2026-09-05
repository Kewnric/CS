/* ============================================================
   SOLUTION.JS — the post-attempt diff view
   ------------------------------------------------------------
   Shows your submission against the reference (or against one of your own
   earlier attempts), line-aligned, with character- or word-level highlighting.

   Two things about this page are easy to get wrong and are worth stating:

   1. THE ROW INDEX IS NOT A LINE NUMBER. computeDiffs drops blank lines and
      comments before aligning, and inserts rows for missing/extra lines, so the
      Nth row is almost never line N of either file. Every row carries the real
      1-based line numbers it came from (actualLine / expectedLine) and those
      are what gets displayed — otherwise nothing on this page can be mapped
      back to the editor.

   2. THE TWO PANELS MUST STAY ROW-ALIGNED. They scroll in lockstep, so every
      row emitted into one panel has to be emitted into the other. Explanation
      rows are therefore written into both and simply made invisible on the
      right: identical text at identical width wraps to an identical height,
      which no amount of spacer-fudging would guarantee.
   ============================================================ */

/* ── View state ───────────────────────────────────────────── */
let _solFiles = [];              // [{ fileName, name, ext, userCode, expectedCode, diffs }]
let _solActiveFile = 0;
let _diffMode = 'side-by-side';
let _diffFilterActive = false;
let _solGran = 'char';           // 'char' | 'word'
let _solOpts = { ignoreComments: true, ignoreWhitespace: true, ignoreNames: true, showComments: true, explain: true };
let _solSummary = null;
let _solHistoryOptions = [];
let _solCompareAgainst = 'reference';   // 'reference' | a history entry id
let _solSourceAttempt = 'current';      // 'current'   | a history entry id
let _solRows = [];               // per rendered row: { i, status, line, expLine }
let _solNavIdx = -1;
let _solSearch = { q: '', matches: [], idx: -1 };
let _solKeyHandler = null;
let _solResizeHandler = null;

/* Kept under their old names — other pages and the templates reach for these. */
let _solutionFileDiffs = [];
let _solutionActiveFile = 0;
let _solutionSetAttempt = null;
let _solutionSetActiveQ = 0;

const SOL_PREF_KEY = 'solutionDiffPrefs';

function _solLoadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(SOL_PREF_KEY)) || {};
    if (p.mode === 'unified' || p.mode === 'side-by-side') _diffMode = p.mode;
    _diffFilterActive = !!p.filter;
    if (p.gran === 'word' || p.gran === 'char') _solGran = p.gran;
    if (p.opts && typeof p.opts === 'object') Object.assign(_solOpts, p.opts);
  } catch (e) { /* first run */ }
}

function _solSavePrefs() {
  try {
    localStorage.setItem(SOL_PREF_KEY, JSON.stringify({
      mode: _diffMode, filter: _diffFilterActive, gran: _solGran, opts: _solOpts
    }));
  } catch (e) { /* quota */ }
}

/* ── Entry ────────────────────────────────────────────────── */

function initSolution() {
  const fileDiffs = getSessionParam('lastFileDiffs');
  const diffs = getSessionParam('lastDiffs');
  const setAttempt = getSessionParam('solutionSetAttempt');
  _solSummary = getSessionParam('solutionSummary') || null;

  if ((!fileDiffs || fileDiffs.length === 0) && (!diffs || diffs.length === 0) && !setAttempt) {
    spaNavigate('home');
    return;
  }

  const backType = getSessionParam('solutionBack') || 'practice';
  const backBtn = document.getElementById('solution-back-btn');
  if (backType.startsWith('analytics')) {
    backBtn.onclick = () => { clearSessionParam('solutionSetAttempt'); spaNavigate(backType); };
    backBtn.innerHTML = '<i data-lucide="chevron-left" style="width:18px;height:18px;"></i> Back to History';
  } else {
    backBtn.onclick = () => spaNavigate('practice');
    backBtn.innerHTML = '<i data-lucide="chevron-left" style="width:18px;height:18px;"></i> Back to Practice';
  }

  _solLoadPrefs();
  _solCompareAgainst = 'reference';
  _solSourceAttempt = 'current';
  _solSearch = { q: '', matches: [], idx: -1 };

  _solutionSetAttempt = setAttempt || null;
  _solutionSetActiveQ = 0;

  if (_solutionSetAttempt && _solutionSetAttempt.length > 0) {
    renderSetQuestionSwitcher(_solutionSetAttempt);
    const first = _solutionSetAttempt[0];
    _solFiles = [_solFile(first.title || 'Problem 1', first.userCode, first.expectedCode)];
  } else {
    const switcherEl = document.getElementById('set-question-switcher');
    if (switcherEl) switcherEl.style.display = 'none';

    if (fileDiffs && fileDiffs.length > 0) {
      _solFiles = fileDiffs.map(fd => {
        const f = _solFile(fd.fileName || 'main.c', fd.userCode, fd.expectedCode);
        f.name = fd.name; f.ext = fd.ext;
        if (!f.canRecompute) f.diffs = fd.diffs || [];   // legacy entry: diffs only
        return f;
      });
    } else {
      const f = _solFile('main.c', null, null);
      f.diffs = diffs || [];
      _solFiles = [f];
    }
  }

  _solActiveFile = 0;
  _solutionActiveFile = 0;
  _solBuildHistoryOptions();
  _solRenderSummary();
  _solRenderCompareBar();
  _solRenderOptions();
  _solApplyModeUI();
  renderSolutionFileTabs();
  _solRecompute();
  _solBindScrollSync();
  _solBindKeys();
  _solBindResize();
  _solScrollToFirstDiff();

  const solRoot = document.getElementById('solution-view') || document.getElementById('main-content');
  if (typeof lucide !== 'undefined') lucide.createIcons(solRoot ? { root: solRoot } : undefined);
}

function destroySolution() {
  if (_solKeyHandler) {
    document.removeEventListener('keydown', _solKeyHandler);
    _solKeyHandler = null;
  }
  if (_solResizeHandler) {
    window.removeEventListener('resize', _solResizeHandler);
    _solResizeHandler = null;
  }
}

/** A file entry. Raw sources are what make re-diffing (and an honest Copy) possible. */
function _solFile(fileName, userCode, expectedCode) {
  return {
    fileName,
    name: null, ext: null,
    userCode: userCode != null ? userCode : null,
    expectedCode: expectedCode != null ? expectedCode : null,
    canRecompute: userCode != null && expectedCode != null,
    diffs: []
  };
}

/* ── Comparison sources ───────────────────────────────────── */

/** The program + version this page is about, when it can be resolved. */
function _solResolveTarget() {
  const cid = (_solSummary && _solSummary.challengeId) || getSessionParam('solutionChallengeId');
  if (!cid || !state.challenges) return null;
  const challenge = state.challenges.find(c => c.id === cid);
  if (!challenge || !challenge.variants || !challenge.variants.length) return null;
  const vid = _solSummary && _solSummary.variantId;
  const vname = _solSummary && _solSummary.variantName;
  const variant = (vid && challenge.variants.find(v => v.id === vid))
    || (vname && challenge.variants.find(v => v.name === vname))
    || challenge.variants[0];
  return { challenge, variant };
}

/** Past attempts on this program, newest first, excluding the one on screen. */
function _solBuildHistoryOptions() {
  _solHistoryOptions = [];
  const cid = (_solSummary && _solSummary.challengeId) || getSessionParam('solutionChallengeId');
  if (!cid || !Array.isArray(state.history)) return;
  const curId = _solSummary && _solSummary.historyId;
  _solHistoryOptions = state.history
    .filter(h => h.challengeId === cid && h.id !== curId && (h.userCode || (h.userFiles && h.userFiles.length)))
    .slice()
    .sort((a, b) => (b.submitTime || 0) - (a.submitTime || 0));
}

function _solHistoryCode(id, fileName) {
  const h = _solHistoryOptions.find(x => x.id === id) || (state.history || []).find(x => x.id === id);
  if (!h) return null;
  if (Array.isArray(h.userFiles) && h.userFiles.length) {
    const m = h.userFiles.find(uf => (uf.name || '') + (uf.ext || '') === fileName);
    if (m) return m.userCode || '';
  }
  return h.userCode || '';
}

function _solHistoryLabel(h) {
  const d = h.submitTime ? new Date(h.submitTime) : null;
  const when = d ? `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : (h.date || 'earlier');
  return `${when} · ${h.score}%`;
}

/** Left-hand source: this attempt, or one of your earlier ones. */
function _solLeftCode(f) {
  if (_solSourceAttempt !== 'current') {
    const c = _solHistoryCode(_solSourceAttempt, f.fileName);
    if (c != null) return c;
  }
  return f.userCode || '';
}

/** Right-hand source: the reference, or one of your earlier attempts. */
function _solRightCode(f) {
  if (_solCompareAgainst !== 'reference') {
    const c = _solHistoryCode(_solCompareAgainst, f.fileName);
    if (c != null) return c;
  }
  return f.expectedCode || '';
}

/* ── Recompute + render ───────────────────────────────────── */

function _solRecompute(opts) {
  const o = opts || {};
  _solFiles.forEach(f => {
    if (!f.canRecompute) return;
    f.diffs = computeDiffs(_solLeftCode(f), _solRightCode(f), {
      ignoreComments: _solOpts.ignoreComments,
      ignoreWhitespace: _solOpts.ignoreWhitespace,
      ignoreNames: _solOpts.ignoreNames
    }).diffs;
  });
  _solutionFileDiffs = _solFiles;
  _solutionActiveFile = _solActiveFile;

  const f = _solFiles[_solActiveFile];
  _solPaintPanelTitles();
  renderSolutionFileTabs();
  renderDiffPanels((f && f.diffs) || []);
  _solRenderBreakdown();
  if (_solSearch.q) solRunSearch(true);
  if (o.scrollToFirst) _solScrollToFirstDiff();
}

function _solPaintPanelTitles() {
  const a = document.getElementById('diff-actual-title');
  const e = document.getElementById('diff-expected-title');
  if (a) {
    const h = _solSourceAttempt !== 'current' && _solHistoryOptions.find(x => x.id === _solSourceAttempt);
    a.textContent = h ? `Your attempt — ${_solHistoryLabel(h)}` : 'Your Submission';
  }
  if (e) {
    const h = _solCompareAgainst !== 'reference' && _solHistoryOptions.find(x => x.id === _solCompareAgainst);
    e.textContent = h ? `Your attempt — ${_solHistoryLabel(h)}` : 'Correct Solution';
  }
}

/* ── Summary strip (score, time, tests) + breakdown bar ────── */

function _solFmtDuration(s) {
  if (s == null) return '—';
  const m = Math.floor(s / 60), sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function _solRenderSummary() {
  const host = document.getElementById('sol-summary');
  if (!host) return;
  const s = _solSummary;
  if (!s) { host.style.display = 'none'; return; }
  host.style.display = '';

  const delta = (s.prevScore != null) ? (s.score - s.prevScore) : null;
  const deltaHTML = delta == null ? ''
    : `<span class="sol-delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'}">
         ${delta > 0 ? '▲' : delta < 0 ? '▼' : '='} ${Math.abs(delta)} vs last</span>`;

  const cells = [];
  cells.push(`<div class="sol-stat sol-score ${s.score === 100 ? 'perfect' : s.score >= 50 ? 'mid' : 'low'}">
      <span class="sol-stat-v">${s.score}%</span><span class="sol-stat-k">Score ${deltaHTML}</span></div>`);
  cells.push(`<div class="sol-stat"><span class="sol-stat-v">${_solFmtDuration(s.duration)}</span><span class="sol-stat-k">Time</span></div>`);
  if (s.attemptNumber) cells.push(`<div class="sol-stat"><span class="sol-stat-v">#${s.attemptNumber}</span><span class="sol-stat-k">Attempt</span></div>`);
  if (s.testsTotal) cells.push(`<div class="sol-stat"><span class="sol-stat-v">${s.testsPassed}/${s.testsTotal}</span><span class="sol-stat-k">Tests passed</span></div>`);
  if (s.hintsUsed) cells.push(`<div class="sol-stat"><span class="sol-stat-v">−${s.hintsUsed * 5}%</span><span class="sol-stat-k">${s.hintsUsed} hint${s.hintsUsed > 1 ? 's' : ''}</span></div>`);
  if (s.bestScore != null) cells.push(`<div class="sol-stat"><span class="sol-stat-v">${s.bestScore}%</span><span class="sol-stat-k">Your best</span></div>`);
  if (s.scoreBasis) {
    cells.push(`<div class="sol-stat"><span class="sol-stat-v sol-basis">${s.scoreBasis === 'tests' ? 'Test cases' : 'Reference match'}</span><span class="sol-stat-k">Graded on</span></div>`);
  }

  const target = _solResolveTarget();
  const actions = target ? `
    <div class="sol-actions">
      <button class="btn btn-secondary btn-sm" onclick="solOpenInEditor(null)" title="Reopen the editor with this submission loaded">
        <i data-lucide="pencil" style="width:13px;height:13px;"></i> Open in editor
      </button>
      <button class="btn btn-secondary btn-sm" onclick="solRetry()" title="Start this program again from the starter code">
        <i data-lucide="rotate-ccw" style="width:13px;height:13px;"></i> Retry
      </button>
    </div>` : '';

  host.innerHTML = `
    <div class="sol-summary-head">
      <div class="sol-title">${escapeHTML(s.title || '')}${s.variantName ? ` <span class="sol-variant">${escapeHTML(s.variantName)}</span>` : ''}</div>
      ${actions}
    </div>
    <div class="sol-stats">${cells.join('')}</div>
    <div class="sol-breakdown" id="sol-breakdown"></div>`;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: host });
}

/** How the gap is made up — missing vs wrong vs extra is a different lesson each. */
function _solRenderBreakdown() {
  const host = document.getElementById('sol-breakdown');
  if (!host) return;
  const diffs = (_solFiles[_solActiveFile] && _solFiles[_solActiveFile].diffs) || [];
  if (!diffs.length) { host.innerHTML = ''; return; }
  const counts = { perfect: 0, partial: 0, wrong: 0, missing: 0, extra: 0 };
  diffs.forEach(d => { if (counts[d.status] != null) counts[d.status]++; });
  const total = diffs.length || 1;
  const seg = [
    ['perfect', 'Matching', counts.perfect],
    ['partial', 'Minor differences', counts.partial],
    ['wrong', 'Wrong', counts.wrong],
    ['missing', 'Missing', counts.missing],
    ['extra', 'Extra', counts.extra],
  ].filter(([, , n]) => n > 0);

  host.innerHTML = `
    <div class="sol-bar" role="img" aria-label="Breakdown of this file's lines">
      ${seg.map(([k, label, n]) => `<span class="sol-bar-seg ${k}" style="width:${(n / total) * 100}%" title="${label}: ${n} line${n > 1 ? 's' : ''}"></span>`).join('')}
    </div>
    <div class="sol-bar-key">
      ${seg.map(([k, label, n]) => `<span class="sol-bar-key-item"><span class="sol-bar-dot ${k}"></span>${label} <b>${n}</b></span>`).join('')}
    </div>`;
}

/* ── Compare bar: which attempt, against what ─────────────── */

function _solRenderCompareBar() {
  const host = document.getElementById('sol-compare');
  if (!host) return;
  if (!_solHistoryOptions.length) { host.style.display = 'none'; return; }
  host.style.display = '';
  const opts = _solHistoryOptions.map(h => ({ id: h.id, label: _solHistoryLabel(h) }));
  host.innerHTML = `
    <label class="sol-cmp-field">
      <span>Left</span>
      <select class="form-select sol-cmp-select" id="sol-src-select" onchange="solSetSource(this.value)">
        <option value="current"${_solSourceAttempt === 'current' ? ' selected' : ''}>This submission</option>
        ${opts.map(o => `<option value="${escapeHTML(o.id)}"${_solSourceAttempt === o.id ? ' selected' : ''}>${escapeHTML(o.label)}</option>`).join('')}
      </select>
    </label>
    <i data-lucide="arrow-left-right" style="width:14px;height:14px;color:#6e7681;"></i>
    <label class="sol-cmp-field">
      <span>Right</span>
      <select class="form-select sol-cmp-select" id="sol-cmp-select" onchange="solSetCompare(this.value)">
        <option value="reference"${_solCompareAgainst === 'reference' ? ' selected' : ''}>Reference solution</option>
        ${opts.map(o => `<option value="${escapeHTML(o.id)}"${_solCompareAgainst === o.id ? ' selected' : ''}>${escapeHTML(o.label)}</option>`).join('')}
      </select>
    </label>
    <span class="sol-cmp-hint" id="sol-cmp-hint"></span>`;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: host });
  _solCompareHint();
}

function _solCompareHint() {
  const el = document.getElementById('sol-cmp-hint');
  if (!el) return;
  el.textContent = (_solCompareAgainst === 'reference' && _solSourceAttempt === 'current')
    ? '' : 'Comparing two of your own attempts — the right panel is not the reference.';
}

function solSetSource(v) {
  _solSourceAttempt = v;
  _solCompareHint();
  _solRecompute({ scrollToFirst: true });
}

function solSetCompare(v) {
  _solCompareAgainst = v;
  _solCompareHint();
  _solRecompute({ scrollToFirst: true });
}

/* ── Comparison options ───────────────────────────────────── */

function solToggleOptions(force) {
  const el = document.getElementById('diff-options');
  const btn = document.getElementById('diff-opts-btn');
  if (!el) return;
  const open = force != null ? force : el.style.display === 'none';
  el.style.display = open ? '' : 'none';
  if (btn) btn.classList.toggle('active', open);
}

function _solRenderOptions() {
  const host = document.getElementById('diff-options');
  if (!host) return;
  const canRecompute = _solFiles.some(f => f.canRecompute);
  const row = (id, label, on, hint, disabled) => `
    <label class="sol-opt${disabled ? ' disabled' : ''}" title="${escapeHTML(hint)}">
      <input type="checkbox" id="${id}" ${on ? 'checked' : ''} ${disabled ? 'disabled' : ''}
             onchange="solSetOpt('${id}', this.checked)" />
      <span>${escapeHTML(label)}</span>
    </label>`;
  host.innerHTML = `
    <span class="sol-opt-label">Compare</span>
    ${row('opt-ignore-comments', 'Ignore comments', _solOpts.ignoreComments, 'Strip // and /* */ before comparing. Off means comments must match too.', !canRecompute)}
    ${row('opt-ignore-ws', 'Ignore whitespace', _solOpts.ignoreWhitespace, 'Collapse all spacing before comparing. Off means indentation counts.', !canRecompute)}
    ${row('opt-ignore-names', 'Ignore variable names', _solOpts.ignoreNames, 'Number identifiers by first appearance, so int x, y matches int a, b. Keywords, the standard library and text inside quotes are never renamed.', !canRecompute)}
    <span class="ed-tool-sep" aria-hidden="true"></span>
    <span class="sol-opt-label">Show</span>
    ${row('opt-show-comments', "Reference's comments", _solOpts.showComments, "Display comments from the source beside each line, greyed out — they never affect the comparison.")}
    ${row('opt-explain', 'Explanations', _solOpts.explain, 'Add a short note under each mismatched line naming the likely mistake.')}
    <span class="ed-tool-sep" aria-hidden="true"></span>
    <span class="sol-opt-label">Granularity</span>
    <span class="sol-seg" role="group" aria-label="Diff granularity">
      <button class="sol-seg-btn${_solGran === 'char' ? ' active' : ''}" onclick="solSetGranularity('char')" title="Highlight individual characters">Character</button>
      <button class="sol-seg-btn${_solGran === 'word' ? ' active' : ''}" onclick="solSetGranularity('word')" title="Highlight whole tokens — quieter on renamed identifiers">Word</button>
    </span>
    ${canRecompute ? '' : '<span class="sol-opt-note">This is an older saved diff, so the comparison rules can\'t be changed.</span>'}`;
}

function solSetOpt(id, val) {
  const map = {
    'opt-ignore-comments': 'ignoreComments',
    'opt-ignore-ws': 'ignoreWhitespace',
    'opt-ignore-names': 'ignoreNames',
    'opt-show-comments': 'showComments',
    'opt-explain': 'explain'
  };
  const key = map[id];
  if (!key) return;
  _solOpts[key] = !!val;
  _solSavePrefs();
  _solRecompute();
}

function solSetGranularity(g) {
  _solGran = g === 'word' ? 'word' : 'char';
  _solSavePrefs();
  _solRenderOptions();
  // Cached per-line highlighting was computed at the old granularity.
  _solFiles.forEach(f => (f.diffs || []).forEach(d => { d.actualChars = null; d.expectedChars = null; }));
  _solRecompute();
}

/* ── Set-attempt question switcher ────────────────────────── */

function renderSetQuestionSwitcher(attemptData) {
  const host = document.getElementById('set-question-switcher');
  if (!host) return;
  host.style.display = '';

  host.innerHTML = `
    <div class="set-q-switcher-bar">
      <span class="set-q-switcher-label">
        <i data-lucide="layout-grid" style="width:13px;height:13px;"></i> Questions
      </span>
      <div class="set-q-switcher-grid">
        ${attemptData.map((q, i) => {
          const cls = q.score === 100 ? 'pass' : q.score >= 50 ? 'partial' : 'fail';
          const active = i === _solutionSetActiveQ ? ' active' : '';
          return `<button class="set-q-btn ${cls}${active}" onclick="switchSetQuestion(${i})" title="${escapeHTML(q.title)} — ${q.score}%">
            <span>${i + 1}</span>
          </button>`;
        }).join('')}
      </div>
      <span class="set-q-switcher-title" id="set-q-active-title">${escapeHTML(attemptData[_solutionSetActiveQ]?.title || 'Problem 1')}
        <span class="badge ${attemptData[_solutionSetActiveQ]?.score === 100 ? 'score-perfect' : 'score-partial'}" style="font-size:0.65rem; margin-left:0.375rem;">${attemptData[_solutionSetActiveQ]?.score ?? 0}%</span>
      </span>
    </div>
  `;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: host });
}

function switchSetQuestion(index) {
  if (!_solutionSetAttempt || index < 0 || index >= _solutionSetAttempt.length) return;
  _solutionSetActiveQ = index;
  const q = _solutionSetAttempt[index];
  _solFiles = [_solFile(q.title || `Problem ${index + 1}`, q.userCode, q.expectedCode)];
  _solActiveFile = 0;
  renderSetQuestionSwitcher(_solutionSetAttempt);
  _solRecompute({ scrollToFirst: true });
}

/* ── File tabs (with a per-file difference count) ──────────── */

function renderSolutionFileTabs() {
  const tabBar = document.getElementById('solution-file-tabs');
  if (!tabBar) return;
  if (_solFiles.length <= 1) { tabBar.innerHTML = ''; return; }
  tabBar.innerHTML = _solFiles.map((fd, fi) => {
    const bad = (fd.diffs || []).filter(d => d.status !== 'perfect').length;
    const badge = bad
      ? `<span class="file-tab-diffs" title="${bad} line${bad > 1 ? 's' : ''} differ">${bad}</span>`
      : `<span class="file-tab-diffs ok" title="This file matches">✓</span>`;
    return `<div class="file-tab ${fi === _solActiveFile ? 'active' : ''}" onclick="switchSolutionFile(${fi})">
      <span class="file-tab-name">${escapeHTML(fd.fileName)}</span>${badge}
    </div>`;
  }).join('');
}

function switchSolutionFile(fi) {
  _solActiveFile = fi;
  _solutionActiveFile = fi;
  _solRecompute({ scrollToFirst: true });
}

/* ── Rendering ────────────────────────────────────────────── */

function renderCharSpans(chars, fallbackText) {
  if (!chars || chars.length === 0) {
    if (fallbackText) {
      return `<span class="diff-char-wrong">${escapeHTML(fallbackText)}</span>`;
    }
    return '<span class="diff-char-neutral">&nbsp;</span>';
  }

  let html = '';
  let currentStatus = null;
  let buffer = '';

  // Group consecutive same-status chars for cleaner HTML
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    const status = c.status || 'neutral';

    if (status !== currentStatus) {
      if (buffer) {
        html += `<span class="diff-char-${currentStatus}">${escapeHTML(buffer)}</span>`;
      }
      currentStatus = status;
      buffer = c.char;
    } else {
      buffer += c.char;
    }
  }

  if (buffer) {
    html += `<span class="diff-char-${currentStatus}">${escapeHTML(buffer)}</span>`;
  }

  return html;
}

/** Greyed-out trailing comment from the original source, when it was stripped. */
/* WHAT A PANEL SHOWS is the code minus its comments, with the names as they
   were written -- never the comparison's renamed form. The rename exists so
   `int x` and `int score` line up as the same line; it was never meant to
   reach the screen, and when it did it also broke the comment slot below,
   which recovers a trailing comment by walking the common prefix of the raw
   line and this one. Handed the renamed text, that prefix ended at the first
   identifier and the whole rest of the line came back as a fake comment. */
function _solText(line, side) {
  if (side === 'actual') {
    if (line.actualPlain != null) return line.actualPlain;
    return line.actualRaw != null ? line.actualRaw : (line.actual || '');
  }
  if (line.expectedPlain != null) return line.expectedPlain;
  return line.expectedRaw != null ? line.expectedRaw : (line.expected || '');
}

function _solCommentHTML(raw, stripped) {
  if (!_solOpts.showComments || !raw) return '';
  const c = typeof diffLineComment === 'function' ? diffLineComment(raw, stripped || '') : '';
  return c ? ` <span class="diff-comment">${escapeHTML(c)}</span>` : '';
}

/** The clickable line-number cell. Clicking a line of YOUR code reopens it. */
function _solNumHTML(n, side) {
  if (n == null) return '<span class="diff-line-number"></span>';
  if (side === 'actual' && _solResolveTarget()) {
    return `<span class="diff-line-number linkable" onclick="event.stopPropagation(); solOpenInEditor(${n})" title="Open the editor at line ${n}">${n}</span>`;
  }
  return `<span class="diff-line-number">${n}</span>`;
}

function renderDiffPanels(diffs) {
  const actualContainer = document.getElementById('diff-actual');
  const expectedContainer = document.getElementById('diff-expected');

  let actualHTML = '';
  let expectedHTML = '';
  let unifiedHTML = '';
  _solRows = [];

  // Build filtered/grouped list
  let items;
  if (_diffFilterActive) {
    items = [];
    let perfectRun = 0;
    for (let i = 0; i < diffs.length; i++) {
      if (diffs[i].status === 'perfect') {
        perfectRun++;
      } else {
        if (perfectRun > 0) {
          items.push({ type: 'collapsed', count: perfectRun });
          perfectRun = 0;
        }
        items.push({ type: 'line', line: diffs[i], index: i });
      }
    }
    if (perfectRun > 0) items.push({ type: 'collapsed', count: perfectRun });
  } else {
    items = diffs.map((line, i) => ({ type: 'line', line, index: i }));
  }

  items.forEach((item) => {
    if (item.type === 'collapsed') {
      const placeholder = `<div class="diff-line diff-collapsed">··· ${item.count} matching line${item.count > 1 ? 's' : ''} ···</div>`;
      actualHTML += placeholder;
      expectedHTML += placeholder;
      unifiedHTML += placeholder;
      return;
    }

    const line = item.line;
    const i = item.index;
    const lineStatus = line.status;

    if (!line.actualChars && !line.expectedChars) {
      if (lineStatus === 'partial' || lineStatus === 'wrong') {
        const aTxt = _solText(line, 'actual'), eTxt = _solText(line, 'expected');
        const charResult = typeof computeLineDiffs === 'function'
          ? computeLineDiffs(aTxt, eTxt, _solGran)
          : computeCharDiffs(aTxt, eTxt);
        line.actualChars = charResult.actualChars;
        line.expectedChars = charResult.expectedChars;
      } else if (lineStatus === 'perfect') {
        line.actualChars = _solText(line, 'actual').split('').map(c => ({ char: c, status: 'match' }));
      } else if (lineStatus === 'extra') {
        line.actualChars = _solText(line, 'actual').split('').map(c => ({ char: c, status: 'wrong' }));
      } else if (lineStatus === 'missing') {
        line.expectedChars = _solText(line, 'expected').split('').map(c => ({ char: c, status: 'missing' }));
      }
    }

    _solRows.push({ i, status: lineStatus, line: line.actualLine, expLine: line.expectedLine, diff: lineStatus !== 'perfect' });

    // ACTUAL PANEL
    if (lineStatus === 'missing') {
      actualHTML += `<div class="diff-line missing" data-row="${i}"><span class="diff-line-number"></span><span class="diff-line-content diff-char-placeholder">— missing —</span></div>`;
    } else {
      const charHTML = line.actualChars ? renderCharSpans(line.actualChars) : `<span class="diff-char-neutral">${escapeHTML(_solText(line, 'actual'))}</span>`;
      actualHTML += `<div class="diff-line ${lineStatus}" data-row="${i}">${_solNumHTML(line.actualLine, 'actual')}<span class="diff-line-content">${charHTML || '&nbsp;'}${_solCommentHTML(line.actualRaw, _solText(line, 'actual'))}</span></div>`;
    }

    // EXPECTED PANEL
    if (lineStatus === 'extra') {
      expectedHTML += `<div class="diff-line extra-expected" data-row="${i}"><span class="diff-line-number"></span><span class="diff-line-content diff-char-placeholder">— extra line —</span></div>`;
    } else if (lineStatus === 'perfect') {
      const syntaxHTML = typeof syntaxHighlight === 'function' ? syntaxHighlight(_solText(line, 'expected')) : escapeHTML(_solText(line, 'expected'));
      expectedHTML += `<div class="diff-line perfect" data-row="${i}">${_solNumHTML(line.expectedLine, 'expected')}<span class="diff-line-content">${syntaxHTML || '&nbsp;'}${_solCommentHTML(line.expectedRaw, _solText(line, 'expected'))}</span></div>`;
    } else {
      const charHTML = line.expectedChars ? renderCharSpans(line.expectedChars) : `<span class="diff-char-neutral">${escapeHTML(_solText(line, 'expected'))}</span>`;
      expectedHTML += `<div class="diff-line expected-highlight ${lineStatus}" data-row="${i}">${_solNumHTML(line.expectedLine, 'expected')}<span class="diff-line-content">${charHTML || '&nbsp;'}${_solCommentHTML(line.expectedRaw, _solText(line, 'expected'))}</span></div>`;
    }

    // UNIFIED PANEL — each side keeps its own line number, so a - row and the
    // + row that replaces it no longer both claim to be the same line.
    const aNum = line.actualLine != null ? line.actualLine : '';
    const eNum = line.expectedLine != null ? line.expectedLine : '';
    if (lineStatus === 'perfect') {
      unifiedHTML += `<div class="diff-line perfect" data-row="${i}"><span class="diff-line-number">${eNum}</span><span class="diff-line-prefix"> </span><span class="diff-line-content">${typeof syntaxHighlight === 'function' ? syntaxHighlight(_solText(line, 'expected')) : escapeHTML(_solText(line, 'expected'))}${_solCommentHTML(line.expectedRaw, _solText(line, 'expected'))}</span></div>`;
    } else if (lineStatus === 'missing') {
      unifiedHTML += `<div class="diff-line missing" data-row="${i}"><span class="diff-line-number">${eNum}</span><span class="diff-line-prefix add">+</span><span class="diff-line-content">${renderCharSpans(line.expectedChars) || escapeHTML(_solText(line, 'expected'))}</span></div>`;
    } else if (lineStatus === 'extra') {
      unifiedHTML += `<div class="diff-line extra" data-row="${i}"><span class="diff-line-number">${aNum}</span><span class="diff-line-prefix del">-</span><span class="diff-line-content">${renderCharSpans(line.actualChars) || escapeHTML(_solText(line, 'actual'))}</span></div>`;
    } else {
      unifiedHTML += `<div class="diff-line wrong" data-row="${i}"><span class="diff-line-number">${aNum}</span><span class="diff-line-prefix del">-</span><span class="diff-line-content">${renderCharSpans(line.actualChars) || escapeHTML(_solText(line, 'actual'))}</span></div>`;
      unifiedHTML += `<div class="diff-line expected-highlight" data-row="${i}"><span class="diff-line-number">${eNum}</span><span class="diff-line-prefix add">+</span><span class="diff-line-content">${renderCharSpans(line.expectedChars) || escapeHTML(_solText(line, 'expected'))}</span></div>`;
    }

    // EXPLANATION — written into BOTH side-by-side panels so the rows stay
    // aligned; the copy on the right is hidden, not omitted (see the note at the
    // top of the file).
    const why = _solOpts.explain && typeof explainDiffLine === 'function' ? explainDiffLine(line) : null;
    if (why) {
      const body = `<span class="diff-line-number"></span><span class="diff-explain-text"><i class="diff-explain-mark">!</i>${escapeHTML(why.text)}</span>`;
      actualHTML += `<div class="diff-explain ${why.kind}" data-row="${i}">${body}</div>`;
      expectedHTML += `<div class="diff-explain ${why.kind} ghost" aria-hidden="true" data-row="${i}">${body}</div>`;
      unifiedHTML += `<div class="diff-explain ${why.kind}" data-row="${i}">${body}</div>`;
    }
  });

  if (actualContainer) actualContainer.innerHTML = actualHTML;
  if (expectedContainer) expectedContainer.innerHTML = expectedHTML;

  const unifiedContainer = document.getElementById('diff-unified');
  if (unifiedContainer) unifiedContainer.innerHTML = unifiedHTML;

  _solEqualizeRows();
  _solNavIdx = -1;
  _solUpdateNavCount();
  _solRenderRuler();
}

/**
 * Give every row pair the same height.
 *
 * Both panels emit the same number of rows, but a long reference line wraps to
 * two lines while the "— missing —" opposite it stays at one, and from there
 * down the two sides no longer describe the same code — which defeats both the
 * locked scrolling and the whole point of a side-by-side view. Measuring is
 * more reliable than any CSS arrangement here, since it also absorbs the
 * sans-serif explanation rows and the smaller placeholder text.
 *
 * Reads are batched before writes so this costs one layout, not one per row.
 */
function _solEqualizeRows() {
  if (_diffMode === 'unified') return;
  const a = document.getElementById('diff-actual');
  const b = document.getElementById('diff-expected');
  if (!a || !b) return;
  const ra = a.children, rb = b.children;
  const n = Math.min(ra.length, rb.length);
  for (let i = 0; i < n; i++) { ra[i].style.minHeight = ''; rb[i].style.minHeight = ''; }
  const heights = [];
  for (let i = 0; i < n; i++) heights.push(Math.max(ra[i].offsetHeight, rb[i].offsetHeight));
  for (let i = 0; i < n; i++) {
    ra[i].style.minHeight = heights[i] + 'px';
    rb[i].style.minHeight = heights[i] + 'px';
  }
}

/* ── Mode + filter ────────────────────────────────────────── */

function _solApplyModeUI() {
  const sideBySide = document.getElementById('diff-panels-container');
  const unified = document.getElementById('diff-unified-container');
  if (_diffMode === 'unified') {
    if (sideBySide) sideBySide.style.display = 'none';
    if (unified) unified.style.display = 'flex';
  } else {
    if (sideBySide) sideBySide.style.display = '';
    if (unified) unified.style.display = 'none';
  }
  const modeBtn = document.getElementById('diff-mode-toggle');
  if (modeBtn) {
    modeBtn.classList.toggle('active', _diffMode === 'unified');
    modeBtn.title = _diffMode === 'unified' ? 'Unified — switch to side-by-side (u)' : 'Side-by-side — switch to unified (u)';
    const ic = modeBtn.querySelector('[data-lucide], svg');
    if (ic) { ic.setAttribute('data-lucide', _diffMode === 'unified' ? 'rows-3' : 'columns'); if (typeof lucide !== 'undefined') lucide.createIcons({ root: modeBtn }); }
  }
  const filterBtn = document.getElementById('diff-filter-toggle');
  if (filterBtn) {
    filterBtn.classList.toggle('active', _diffFilterActive);
    filterBtn.title = _diffFilterActive ? 'Differences only — show everything (f)' : 'Showing everything — differences only (f)';
  }
}

function toggleDiffMode() {
  _diffMode = _diffMode === 'side-by-side' ? 'unified' : 'side-by-side';
  _solSavePrefs();
  _solApplyModeUI();
  _solRecompute();
}

function toggleDiffFilter() {
  _diffFilterActive = !_diffFilterActive;
  _solSavePrefs();
  _solApplyModeUI();
  _solRecompute();
}

/* ── Copy: the REAL source, not a reconstruction ──────────── */

function _solFlashLabel(id, text) {
  const label = document.getElementById(id);
  if (!label) return;
  const old = label.textContent;
  label.textContent = text;
  setTimeout(() => { label.textContent = old; }, 1500);
}

/** Rebuilding from diff rows loses comments, blank lines and indentation — only
    fall back to it when there is genuinely no source to copy. */
function _solReconstruct(diffs, side) {
  return (diffs || [])
    .filter(d => (side === 'expected' ? d.status !== 'extra' : d.status !== 'missing'))
    .map(d => (side === 'expected' ? (d.expectedRaw != null ? d.expectedRaw : d.expected) : (d.actualRaw != null ? d.actualRaw : d.actual)) || '')
    .join('\n');
}

function copyExpectedCode() {
  const f = _solFiles[_solActiveFile];
  if (!f) return;
  const code = _solRightCode(f) || _solReconstruct(f.diffs, 'expected');
  navigator.clipboard.writeText(code).then(() => _solFlashLabel('copy-btn-label', 'Copied!'))
    .catch(() => _solFlashLabel('copy-btn-label', 'Failed'));
}

function copyMyCode() {
  const f = _solFiles[_solActiveFile];
  if (!f) return;
  const code = _solLeftCode(f) || _solReconstruct(f.diffs, 'actual');
  navigator.clipboard.writeText(code).then(() => _solFlashLabel('copy-mine-label', 'Copied!'))
    .catch(() => _solFlashLabel('copy-mine-label', 'Failed'));
}

/* ── Navigation between differences ───────────────────────── */

function _solScroller() {
  return _diffMode === 'unified'
    ? document.getElementById('diff-unified')
    : document.getElementById('diff-actual');
}

function _solDiffRows() {
  return _solRows.filter(r => r.diff);
}

function _solUpdateNavCount() {
  const el = document.getElementById('diff-nav-count');
  if (!el) return;
  const rows = _solDiffRows();
  el.textContent = rows.length ? `${_solNavIdx >= 0 ? _solNavIdx + 1 : 0} / ${rows.length}` : '0 / 0';
  el.classList.toggle('clean', rows.length === 0);
}

function solStepDiff(dir) {
  const rows = _solDiffRows();
  if (!rows.length) return;
  _solNavIdx = _solNavIdx < 0
    ? (dir > 0 ? 0 : rows.length - 1)
    : (_solNavIdx + dir + rows.length) % rows.length;
  _solFocusRow(rows[_solNavIdx].i);
  _solUpdateNavCount();
}

function _solFocusRow(rowIndex) {
  const scroller = _solScroller();
  if (!scroller) return;
  document.querySelectorAll('.diff-line.row-focus').forEach(el => el.classList.remove('row-focus'));
  const targets = document.querySelectorAll(`.diff-line[data-row="${rowIndex}"]`);
  targets.forEach(el => el.classList.add('row-focus'));
  const el = scroller.querySelector(`.diff-line[data-row="${rowIndex}"]`);
  if (!el) return;
  const top = el.offsetTop - (scroller.clientHeight / 2) + (el.offsetHeight / 2);
  scroller.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}

/** Land on the first thing that's actually wrong rather than at the top. */
function _solScrollToFirstDiff() {
  const rows = _solDiffRows();
  if (!rows.length) return;
  _solNavIdx = 0;
  _solFocusRow(rows[0].i);
  _solUpdateNavCount();
}

/* ── Overview ruler ───────────────────────────────────────── */

function _solRenderRuler() {
  const ruler = document.getElementById('diff-ruler');
  const scroller = _solScroller();
  if (!ruler) return;
  if (!scroller) { ruler.innerHTML = ''; return; }
  const h = scroller.scrollHeight || 1;
  const ticks = _solDiffRows().map(r => {
    const el = scroller.querySelector(`.diff-line[data-row="${r.i}"]`);
    const top = el ? (el.offsetTop / h) * 100 : 0;
    const where = r.line != null ? `Line ${r.line}` : (r.expLine != null ? `Reference line ${r.expLine}` : 'Line ?');
    return `<span class="diff-ruler-tick ${r.status}" style="top:${Math.min(99.4, top).toFixed(2)}%" data-row="${r.i}" title="${where} — ${r.status}"></span>`;
  }).join('');
  ruler.innerHTML = ticks + '<span class="diff-ruler-view" id="diff-ruler-view"></span>';
  ruler.onclick = (e) => {
    const t = e.target.closest && e.target.closest('.diff-ruler-tick');
    if (!t) return;
    const rowIndex = parseInt(t.dataset.row, 10);
    const at = _solDiffRows().findIndex(r => r.i === rowIndex);
    if (at >= 0) { _solNavIdx = at; _solUpdateNavCount(); }
    _solFocusRow(rowIndex);
  };
  _solUpdateRulerView();
}

function _solUpdateRulerView() {
  const view = document.getElementById('diff-ruler-view');
  const scroller = _solScroller();
  if (!view || !scroller) return;
  const h = scroller.scrollHeight || 1;
  view.style.top = ((scroller.scrollTop / h) * 100).toFixed(2) + '%';
  view.style.height = Math.min(100, (scroller.clientHeight / h) * 100).toFixed(2) + '%';
}

/* ── Locked scrolling between the two panels ──────────────── */

function _solBindScrollSync() {
  const a = document.getElementById('diff-actual');
  const b = document.getElementById('diff-expected');
  const u = document.getElementById('diff-unified');
  if (u) u.addEventListener('scroll', _solUpdateRulerView);
  if (!a || !b) return;
  let lock = false;
  const mirror = (from, to) => () => {
    _solUpdateRulerView();
    if (lock) return;                     // we're inside the partner's own event
    lock = true;
    to.scrollTop = from.scrollTop;
    to.scrollLeft = from.scrollLeft;
    requestAnimationFrame(() => { lock = false; });
  };
  a.addEventListener('scroll', mirror(a, b));
  b.addEventListener('scroll', mirror(b, a));
}

/* ── Search across both panels ────────────────────────────── */

function solToggleSearch(force) {
  const bar = document.getElementById('diff-search-bar');
  const btn = document.getElementById('diff-search-btn');
  if (!bar) return;
  const open = force != null ? force : bar.style.display === 'none';
  bar.style.display = open ? '' : 'none';
  if (btn) btn.classList.toggle('active', open);
  const input = document.getElementById('diff-search-input');
  if (open) {
    if (input) { input.focus(); input.select(); }
    if (!bar._bound) {
      bar._bound = true;
      input.addEventListener('input', () => solRunSearch());
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); solSearchStep(e.shiftKey ? -1 : 1); }
        if (e.key === 'Escape') { e.preventDefault(); solToggleSearch(false); }
      });
    }
  } else {
    _solSearch.q = '';
    _solClearSearchMarks();
    _solSearchCount();
    const ta = _solScroller();
    if (ta) ta.focus();
  }
}

function _solClearSearchMarks() {
  document.querySelectorAll('.diff-stage mark.diff-hit').forEach(m => {
    const parent = m.parentNode;
    if (!parent) return;
    parent.replaceChild(document.createTextNode(m.textContent), m);
    parent.normalize();
  });
  _solSearch.matches = [];
  _solSearch.idx = -1;
}

/** Wrap hits in <mark> by walking text nodes, so the diff's own span structure
    (which carries every per-character verdict) survives untouched. */
function solRunSearch(keepIndex) {
  const input = document.getElementById('diff-search-input');
  if (!input) return;
  const needle = input.value;
  _solClearSearchMarks();
  _solSearch.q = needle;
  if (!needle) { _solSearchCount(); input.classList.remove('no-match'); return; }

  const roots = _diffMode === 'unified'
    ? [document.getElementById('diff-unified')]
    : [document.getElementById('diff-actual'), document.getElementById('diff-expected')];
  const lower = needle.toLowerCase();

  roots.filter(Boolean).forEach(root => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) if (n.nodeValue && n.nodeValue.toLowerCase().includes(lower)) nodes.push(n);
    nodes.forEach(node => {
      const text = node.nodeValue;
      const frag = document.createDocumentFragment();
      let from = 0, at;
      while ((at = text.toLowerCase().indexOf(lower, from)) !== -1) {
        if (at > from) frag.appendChild(document.createTextNode(text.slice(from, at)));
        const mark = document.createElement('mark');
        mark.className = 'diff-hit';
        mark.textContent = text.slice(at, at + needle.length);
        frag.appendChild(mark);
        _solSearch.matches.push(mark);
        from = at + needle.length;
      }
      if (from < text.length) frag.appendChild(document.createTextNode(text.slice(from)));
      if (node.parentNode) node.parentNode.replaceChild(frag, node);
    });
  });

  input.classList.toggle('no-match', !_solSearch.matches.length);
  _solSearch.idx = _solSearch.matches.length ? (keepIndex ? Math.min(_solSearch.idx, _solSearch.matches.length - 1) : 0) : -1;
  if (_solSearch.idx >= 0) _solFocusMatch();
  _solSearchCount();
}

function _solSearchCount() {
  const el = document.getElementById('diff-search-count');
  if (el) el.textContent = `${_solSearch.matches.length ? _solSearch.idx + 1 : 0}/${_solSearch.matches.length}`;
}

function _solFocusMatch() {
  _solSearch.matches.forEach(m => m.classList.remove('current'));
  const m = _solSearch.matches[_solSearch.idx];
  if (!m) return;
  m.classList.add('current');
  m.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function solSearchStep(dir) {
  if (!_solSearch.matches.length) return;
  _solSearch.idx = (_solSearch.idx + dir + _solSearch.matches.length) % _solSearch.matches.length;
  _solFocusMatch();
  _solSearchCount();
}

/* ── Back into the editor ─────────────────────────────────── */

/**
 * Reopen the attempt with THIS submission's code restored, optionally with a
 * marker on one line. It writes the same autosave record the practice page
 * already knows how to restore, rather than inventing a second restore path.
 */
function solOpenInEditor(lineNo) {
  const target = _solResolveTarget();
  if (!target) return;
  const files = _solFiles
    .filter(f => f.userCode != null)
    .map((f, i) => {
      let name = f.name, ext = f.ext;
      if (!name) {
        const dot = f.fileName.lastIndexOf('.');
        name = dot > 0 ? f.fileName.slice(0, dot) : f.fileName;
        ext = dot > 0 ? f.fileName.slice(dot) : '.c';
      }
      return { name, ext, userCode: _solLeftCode(f), _i: i };
    });
  if (files.length) {
    setSessionParam('autoSavedFiles', {
      challengeId: target.challenge.id,
      variantId: target.variant.id,
      files: files.map(f => ({ name: f.name, ext: f.ext, userCode: f.userCode }))
    });
  }
  setSessionParam('practiceChallenge', target.challenge.id);
  setSessionParam('practiceVariant', target.variant.id);
  clearSessionParam('practiceStartTime');
  if (lineNo) {
    setSessionParam('practiceJumpLine', { line: lineNo, fileIndex: _solActiveFile });
  } else {
    clearSessionParam('practiceJumpLine');
  }
  spaNavigate('practice');
}

/** Start over from the starter code. */
function solRetry() {
  const target = _solResolveTarget();
  if (!target) return;
  const go = () => {
    clearSessionParam('autoSavedFiles');
    clearSessionParam('practiceStartTime');
    clearSessionParam('practiceExecs');
    clearSessionParam('practiceJumpLine');
    setSessionParam('practiceChallenge', target.challenge.id);
    setSessionParam('practiceVariant', target.variant.id);
    spaNavigate('practice');
  };
  if (typeof showConfirm === 'function') {
    showConfirm('Retry this program', 'Start again from the starter code? This attempt is already saved in your history.', go);
  } else {
    go();
  }
}

/* ── Export ───────────────────────────────────────────────── */

/** A standalone copy of the current diff, styles inlined, for revising later. */
function solExportDiff() {
  const f = _solFiles[_solActiveFile];
  if (!f) return;
  const title = `${(_solSummary && _solSummary.title) || 'Solution'} — ${f.fileName}`;
  const panels = _diffMode === 'unified'
    ? `<div class="p"><h2>Unified diff</h2>${(document.getElementById('diff-unified') || {}).innerHTML || ''}</div>`
    : `<div class="cols">
         <div class="p"><h2>Your submission</h2>${(document.getElementById('diff-actual') || {}).innerHTML || ''}</div>
         <div class="p"><h2>${escapeHTML(_solCompareAgainst === 'reference' ? 'Correct solution' : 'Compared attempt')}</h2>${(document.getElementById('diff-expected') || {}).innerHTML || ''}</div>
       </div>`;
  const summary = document.getElementById('sol-summary');
  const doc = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHTML(title)}</title><style>
    body{margin:0;padding:24px;background:#0d1117;color:#c9d1d9;font-family:ui-monospace,Consolas,monospace;font-size:13px;line-height:1.7;}
    h1{font-size:18px;margin:0 0 4px;color:#e6edf3;} .meta{color:#8b949e;font-size:12px;margin-bottom:18px;}
    .cols{display:flex;gap:18px;align-items:flex-start;} .p{flex:1;min-width:0;background:#161b22;border:1px solid #30363d;border-radius:8px;padding:10px;}
    h2{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#8b949e;margin:0 0 8px;}
    .diff-line{display:flex;padding:1px 6px;} .diff-line-number{width:44px;color:#484f58;text-align:right;padding-right:10px;flex-shrink:0;}
    .diff-line-content{white-space:pre-wrap;word-break:break-word;}
    .diff-line.perfect{background:rgba(63,185,80,.07);} .diff-line.partial{background:rgba(210,153,34,.12);}
    .diff-line.wrong,.diff-line.missing,.diff-line.extra,.diff-line.extra-expected{background:rgba(248,81,73,.12);}
    .diff-char-match{color:#7ee787;} .diff-char-offset{color:#e3b341;} .diff-char-wrong,.diff-char-missing{color:#ff7b72;font-weight:700;}
    .diff-char-neutral{color:#8b949e;} .diff-char-placeholder{color:#6e7681;font-style:italic;}
    .diff-comment{color:#6a9955;font-style:italic;} .diff-collapsed{color:#484f58;font-style:italic;justify-content:center;}
    .diff-explain{display:flex;padding:2px 6px 6px;color:#d29922;font-family:system-ui,sans-serif;font-size:12px;}
    .diff-explain.ghost{display:none;} .diff-explain-mark{font-style:normal;font-weight:800;margin-right:6px;}
    .diff-explain-text{display:block;} mark.diff-hit{background:#3b3016;color:inherit;}
    .diff-line-prefix{width:14px;flex-shrink:0;} .diff-line-number.linkable{cursor:default;}
  </style></head><body>
    <h1>${escapeHTML(title)}</h1>
    <div class="meta">${escapeHTML(summary && summary.innerText ? summary.innerText.replace(/\s*\n\s*/g, ' · ').trim() : '')}
      ${escapeHTML(new Date().toLocaleString())}</div>
    ${panels}
  </body></html>`;

  try {
    const blob = new Blob([doc], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = title.replace(/[^\w.\- ]+/g, '_') + '.html';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    if (typeof toast === 'function') toast('Diff exported.', { type: 'success' });
  } catch (e) {
    if (typeof toast === 'function') toast('Could not export the diff.', { type: 'error' });
  }
}

/* ── Keyboard ─────────────────────────────────────────────── */

/** Row heights are measured, so a resize has to re-measure them. */
function _solBindResize() {
  if (_solResizeHandler) window.removeEventListener('resize', _solResizeHandler);
  let t = null;
  _solResizeHandler = () => {
    clearTimeout(t);
    t = setTimeout(() => { _solEqualizeRows(); _solRenderRuler(); }, 120);
  };
  window.addEventListener('resize', _solResizeHandler);
}

function _solBindKeys() {
  if (_solKeyHandler) document.removeEventListener('keydown', _solKeyHandler);
  _solKeyHandler = (e) => {
    if (document.querySelector('.modal-overlay:not(.hidden)')) return;
    const t = e.target;
    const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);

    if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault(); solToggleSearch(true); return;
    }
    if (typing) return;

    if (e.key === 'n' || (e.key === 'Enter' && !e.shiftKey)) { e.preventDefault(); solStepDiff(1); }
    else if (e.key === 'p' || (e.key === 'Enter' && e.shiftKey)) { e.preventDefault(); solStepDiff(-1); }
    else if (e.key === 'u' || e.key === 'U') { e.preventDefault(); toggleDiffMode(); }
    else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); toggleDiffFilter(); }
    else if (e.key === '/') { e.preventDefault(); solToggleSearch(true); }
    else if (e.key === 'Escape') {
      const bar = document.getElementById('diff-search-bar');
      if (bar && bar.style.display !== 'none') { e.preventDefault(); solToggleSearch(false); return; }
      const back = document.getElementById('solution-back-btn');
      if (back && back.onclick) { e.preventDefault(); back.onclick(); }
    }
  };
  document.addEventListener('keydown', _solKeyHandler);
}
