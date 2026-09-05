/* ============================================================
   PRACTICE-SET.JS — Multi-problem session runtime (CodeChum-style)
   ------------------------------------------------------------
   Drives the #/practice-set route. The student gets a strip of
   numbered problem boxes; switching problems keeps each editor's
   code. "Run Code" uses the shared interactive terminal,
   "Check Code" runs the current problem's tests (marking the box
   green on full pass) WITHOUT submitting, and "Submit Attempt"
   grades every problem and records history.
   ============================================================ */

let _pset = null;
let _psetTimerInterval = null;
let _psetAutosaveInterval = null;

// ── Init / teardown ──
function psetInit() {
  const setId = getSessionParam('activeCodingSet');
  const set = (state.codingSets || []).find(s => s.id === setId);
  if (!set || !(set.problems || []).length) { _psetGoLibrary(setId); return; }

  // Neutralize single-practice state so shared helpers (run terminal,
  // preprocessMultiFile, boss bar) operate on the raw editor content only.
  state.activeChallenge = null;
  state.activeVariant = null;
  state.userFiles = null;

  // Restore an in-progress attempt of this same set (refresh-proof)
  const saved = getSessionParam('psetAutosave');
  const restore = saved && saved.setId === set.id ? saved : null;
  if (saved && !restore) clearSessionParam('psetAutosave');

  // Fresh attempt, fresh music -- same rule as the single-program screen.
  if (!restore && typeof ostRewind === 'function') ostRewind();

  const problems = _psetResolveProblems(set, restore);
  if (!problems.length) {
    if (typeof showMessage === 'function') showMessage('Unavailable', 'None of the problems in this set could be loaded (programs may have been deleted).', true);
    _psetGoLibrary(setId);
    return;
  }

  problems.forEach(p => {
    p.edited = _psetIsEdited(p);
    p.check = null; // last Check Code result
  });

  _pset = {
    set,
    problems,
    current: 0,
    startTime: (restore && restore.startTime) || Date.now(),
    timeLimit: parseInt(getSessionParam('codingSetTimeLimit')) || 0,
    submitted: false
  };

  if (typeof initLineNumbersState === 'function') initLineNumbersState();
  if (typeof setupSpecificEditor === 'function') {
    setupSpecificEditor('editor-textarea', 'editor-pre', 'editor-code', true);
  }

  // Per-problem code capture
  const textarea = document.getElementById('editor-textarea');
  if (textarea) {
    const handler = (e) => {
      if (!_pset) return;
      const p = _pset.problems[_pset.current];
      const f = _psetActiveFile(p);
      // Not e.target.value — a collapsed block is outside the textarea, and
      // storing the view would delete those lines permanently.
      if (f) f.userCode = (typeof edFullSource === 'function') ? edFullSource(e.target) : e.target.value;
      if (p.activeFileIndex === 0 && p.files[0]) p.userCode = p.files[0].userCode;
      const wasEdited = p.edited;
      if (!p.edited && _psetIsEdited(p)) p.edited = true;
      // Re-render the panel only on a state transition (edited / check went stale).
      const nowStale = !!(p.check && p.check.codeKey != null && p.check.codeKey !== _psetMerge(p));
      if ((!wasEdited && p.edited) || (nowStale !== !!p._staleShown)) {
        p._staleShown = nowStale;
        if (typeof renderPracticePanel === 'function') renderPracticePanel();
      }
      // Debounced: the similarity check is an O(n·m) LCS over the whole file, and
      // running it on every keystroke (as this did) made typing janky in larger
      // problems. The single-program page has always debounced it.
      _psetUpdateBossBarDebounced();
    };
    textarea.removeEventListener('input', textarea._psetHandler || (() => {}));
    textarea._psetHandler = handler;
    textarea.addEventListener('input', handler);
  }

  // Boss health bar (per-problem) — restore enabled state like the practice page
  const bossBarEnabled = sessionStorage.getItem('bossBarEnabled') !== 'false';
  if (typeof bossSetVisible === 'function') bossSetVisible(bossBarEnabled);
  const bossToggleBtn = document.getElementById('boss-bar-toggle-btn');
  if (bossToggleBtn) bossToggleBtn.style.color = bossBarEnabled ? 'var(--color-warning)' : 'var(--text-tertiary)';

  // Timer (count-up)
  if (_psetTimerInterval) clearInterval(_psetTimerInterval);
  _psetTick();
  _psetTimerInterval = setInterval(_psetTick, 1000);

  // Autosave every 20 s
  if (_psetAutosaveInterval) clearInterval(_psetAutosaveInterval);
  _psetAutosaveInterval = setInterval(_psetAutosave, 20000);

  // Keyboard: Ctrl+Enter = check, Ctrl+Shift+Enter = finish, Alt+←/→ = switch
  window._psetKeyHandler = function (e) {
    /* Answered BEFORE the guards below, same as the program screen. Those
       guards hand the keyboard to an open modal, the run terminal and the find
       bar -- so while you were reading run output, Ctrl+S fell through to the
       browser's "Save page" dialog. Saving is safe from all three: it reads the
       editor and writes a draft. */
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey &&
        (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      if (psetSaveNow() && typeof toast === 'function') {
        toast('Saved', { type: 'success', duration: 1400 });
      }
      return;
    }
    if (document.querySelector('.modal-overlay:not(.hidden)')) return;
    if (document.getElementById('run-code-overlay')) return;
    const findBar = document.getElementById('ed-find-bar');
    if (findBar && findBar.classList.contains('open') && findBar.contains(document.activeElement)) return;

    if (e.ctrlKey && e.shiftKey && e.key === 'Enter') { e.preventDefault(); psetSubmitAll(); }
    else if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); ppRunAllChecks(); }
    else if (e.ctrlKey && (e.key === 'b' || e.key === 'B')) { e.preventDefault(); psetToggleBoss(); }
    else if (e.ctrlKey && e.key === '\\') { e.preventDefault(); toggleZenMode(); }
    else if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); psetSwitch(Math.min(_pset.current + 1, _pset.problems.length - 1)); }
    else if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); psetSwitch(Math.max(_pset.current - 1, 0)); }
    else if (e.key === 'Escape') {
      if (typeof isFullscreen === 'function' && isFullscreen()) return;  // browser exits full screen
      if (findBar && findBar.classList.contains('open')) { e.preventDefault(); edCloseFind(); }
      else if (isZenMode()) { e.preventDefault(); toggleZenMode(); }
    }
  };
  document.addEventListener('keydown', window._psetKeyHandler);

  // Wire the shared third-window panel (Problems / Tests / Executions).
  if (typeof setPracticePanelCtx === 'function') {
    setPracticePanelCtx({
      mode: 'set',
      finishLabel: 'Finish attempt…',
      problems: () => _pset ? _pset.problems.map(p => ({ title: p.title })) : [],
      current: () => _pset ? _pset.current : 0,
      status: (i) => (_pset && _pset.problems[i]) ? _psetProblemStatus(_pset.problems[i]) : '',
      onSwitch: (i) => psetSwitch(i),
      tests: () => { const p = _pset && _pset.problems[_pset.current]; return p ? (p.tests || []) : []; },
      minReqs: () => { const p = _pset && _pset.problems[_pset.current]; return p ? (p.minRequirements || []) : []; },
      code: () => { const p = _pset && _pset.problems[_pset.current]; return p ? _psetMerge(p) : ''; },
      getCheck: () => { const p = _pset && _pset.problems[_pset.current]; return p ? p.check : null; },
      setCheck: (obj) => { const p = _pset && _pset.problems[_pset.current]; if (p) p.check = obj; },
      getExecs: () => { const p = _pset && _pset.problems[_pset.current]; return p ? (p.execs || []) : []; },
      pushExec: (e) => { const p = _pset && _pset.problems[_pset.current]; if (p) { if (!p.execs) p.execs = []; p.execs.push(e); if (p.execs.length > 20) p.execs.shift(); } },
      snapshot: () => { const p = _pset && _pset.problems[_pset.current]; if (!p) return null; _psetSyncEditor(); return { files: JSON.parse(JSON.stringify(p.files)), activeFileIndex: p.activeFileIndex }; },
      onRestore: (snap) => {
        const p = _pset && _pset.problems[_pset.current];
        if (!p || !snap) return;
        p.files = JSON.parse(JSON.stringify(snap.files));
        p.activeFileIndex = Math.min(snap.activeFileIndex || 0, p.files.length - 1);
        p.userCode = p.files[0].userCode;
        state.userFiles = p.files;
        state.activeFileIndex = p.activeFileIndex;
        _psetLoadActiveIntoEditor(p);
        _psetRenderFileTabs(p);
        _psetUpdateBossBar(null, { instant: true });
      },
      onFinish: () => psetSubmitAll()
    });
  }

  // The shared timer menu edits whichever clock is registered here.
  if (typeof setPracticeTimerCtx === 'function') {
    setPracticeTimerCtx({
      active: () => !!_pset,
      getLimit: () => (_pset && _pset.timeLimit) || 0,
      apply: (secs, restart) => psetApplyTimer(secs, restart)
    });
  }

  _psetLoadProblem(0);
  if (typeof renderPracticePanel === 'function') renderPracticePanel();
  if (typeof applyEditorViewSettings === 'function') applyEditorViewSettings();
  if (typeof initPracticePanes === 'function') initPracticePanes();
  if (typeof initZenState === 'function') initZenState();
  if (typeof _syncFullscreenBtn === 'function') _syncFullscreenBtn();

  const root = document.querySelector('.practice-layout');
  if (typeof lucide !== 'undefined') lucide.createIcons(root ? { root } : undefined);
}

function psetDestroy() {
  clearTimeout(_psetBossDebounce);
  // Flush before tearing down. psetExit() autosaves on its way out, but the sidebar
  // links and the browser Back button bypass it, dropping up to 20 s of work.
  // Skipped while discarding, where this would write back the draft that was
  // just deleted -- the same trap the program screen hit.
  if (_pset && !_pset.submitted && !_psetDiscarding) {
    try { _psetAutosave(); } catch (e) { console.error('[PracticeSet] Autosave on exit failed:', e); }
  }
  if (typeof setPracticeTimerCtx === 'function') setPracticeTimerCtx(null);
  if (typeof _stopSavedTicker === 'function') _stopSavedTicker();
  _psetStopLoops();
  if (typeof edCloseFind === 'function') edCloseFind();
  if (typeof closeCheatsheet === 'function') closeCheatsheet();   // it lives on <body>, not in the route
  if (window._psetKeyHandler) { document.removeEventListener('keydown', window._psetKeyHandler); window._psetKeyHandler = null; }
  if (typeof _termClose === 'function') {
    _termClose();
  }
  _pset = null;
  state.activeChallenge = null;
  state.activeVariant = null;
  state.userFiles = null;
}

/**
 * Build the per-problem files[] (main solution file + any header/companion files
 * the student added). Restores from autosave when present. file[0] is always the
 * main solution; p.userCode mirrors it for boss-bar/similarity/history.
 */
function _psetBuildFiles(mainName, mainExt, mainStarter, mainRef, restored) {
  // restored may be: string (legacy main-only), {files:[...],activeFileIndex}, or {fileKey:code}
  if (restored && Array.isArray(restored.files) && restored.files.length) {
    const files = restored.files.map(f => {
      const isMain = f.name === mainName && f.ext === mainExt;
      return {
        id: generateId(),
        name: f.name || 'file', ext: f.ext || '.c',
        starterCode: isMain ? mainStarter : '',
        code: isMain ? mainRef : '',
        userCode: typeof f.userCode === 'string' ? f.userCode : ''
      };
    });
    // Guarantee the main file exists at index 0
    let mainIdx = files.findIndex(f => f.name === mainName && f.ext === mainExt);
    if (mainIdx === -1) {
      files.unshift({ id: generateId(), name: mainName, ext: mainExt, starterCode: mainStarter, code: mainRef, userCode: mainStarter });
      mainIdx = 0;
    } else if (mainIdx !== 0) {
      const [m] = files.splice(mainIdx, 1); files.unshift(m); mainIdx = 0;
    }
    let activeFileIndex = Math.max(0, Math.min(restored.activeFileIndex || 0, files.length - 1));
    return { files, activeFileIndex };
  }

  const files = [{ id: generateId(), name: mainName, ext: mainExt, starterCode: mainStarter, code: mainRef, userCode: mainStarter }];
  if (typeof restored === 'string') files[0].userCode = restored;
  else if (restored && typeof restored === 'object' && typeof restored[mainName + mainExt] === 'string') files[0].userCode = restored[mainName + mainExt];
  return { files, activeFileIndex: 0 };
}

/** Materialize the set's problems (library refs are resolved to live data). */
function _psetResolveProblems(set, restore) {
  const out = [];
  (set.problems || []).forEach((p, pi) => {
    // Sets authored before problems carried ids (or imported from an older backup)
    // have `id: undefined` on every problem, which collapsed the whole autosave map
    // onto one key and restored the same code into every problem. Fall back to the
    // position, which is stable for as long as the attempt runs.
    const key = p.id || ('idx_' + pi);
    const restored = restore && restore.codes ? restore.codes[key] : null;
    if (p.source === 'library') {
      const c = (state.challenges || []).find(ch => ch.id === p.challengeId);
      if (!c) return; // program deleted — skip
      const v = (c.variants || []).find(x => x.id === p.variantId) || c.variants[0];
      if (!v) return;
      const file0 = (v.files && v.files[0]) || {};
      const mainName = file0.name || 'main';
      const mainExt = file0.ext || '.c';
      const mainStarter = file0.starterCode || v.starterCode || '';
      const mainRef = file0.code || v.code || '';
      const { files, activeFileIndex } = _psetBuildFiles(mainName, mainExt, mainStarter, mainRef, restored);

      out.push({
        key,
        srcIndex: pi,
        source: 'library',
        challengeId: c.id,
        variantId: v.id,
        title: c.title,
        variantName: v.name || '',
        description: v.description || c.coverDescription || '',
        starterCode: mainStarter,
        referenceCode: mainRef,
        tests: (v.tests || []).filter(t => t && typeof t.expected === 'string'),
        minRequirements: (v.minRequirements || []).slice(),
        samples: v.samples || [],
        // Hints used to be dropped here, so a program with hints lost them the
        // moment it was added to a set.
        hints: (v.hints || []).slice(),
        hintsUsed: 0,
        files, activeFileIndex, execs: [],
        userCode: files[0].userCode
      });
    } else {
      const mainStarter = p.starterCode || '';
      const { files, activeFileIndex } = _psetBuildFiles('solution', '.c', mainStarter, p.referenceCode || '', restored);
      out.push({
        key,
        srcIndex: pi,
        source: 'manual',
        title: p.title || 'Untitled problem',
        variantName: '',
        description: p.description || '',
        starterCode: mainStarter,
        referenceCode: p.referenceCode || '',
        tests: (p.tests || []).filter(t => t && (typeof t.expected === 'string')),
        minRequirements: (p.minRequirements || []).slice(),
        samples: [],
        hints: (p.hints || []).slice(),
        hintsUsed: 0,
        files, activeFileIndex, execs: [],
        userCode: files[0].userCode
      });
    }
  });
  return out;
}

/* ── Per-problem file helpers ────────────────────────────── */
function _psetActiveFile(p) { return (p.files && p.files[p.activeFileIndex]) || (p.files && p.files[0]) || null; }

/** True if the student has changed the main file or added any companion file. */
function _psetIsEdited(p) {
  if (!p.files || !p.files.length) return false;
  if (p.files.length > 1) return true;
  return (p.files[0].userCode || '') !== (p.files[0].starterCode || '');
}

/** Save the editor's current text into the active file (and mirror p.userCode if it's the main file). */
function _psetSyncEditor() {
  if (!_pset) return;
  const ta = document.getElementById('editor-textarea');
  const p = _pset.problems[_pset.current];
  if (!ta || !p) return;
  const f = _psetActiveFile(p);
  // Never ta.value — a collapsed block is not in it (see savePracticeFileCode).
  if (f) f.userCode = (typeof edFullSource === 'function') ? edFullSource(ta) : ta.value;
  if (p.activeFileIndex === 0 && p.files[0]) p.userCode = p.files[0].userCode;
}

/** Merge a problem's files into one translation unit (inline #include "local" +
    append companion .c) — pure, never touches the editor (safe for grading any problem). */
function _psetMerge(p) {
  const files = p.files || [];
  const main = files[0] || { userCode: p.userCode || '' };
  if (files.length <= 1) return main.userCode || '';
  const included = new Set();
  function inline(src) {
    return (src || '').replace(/#include\s*"([^"]+)"/g, (m, fn) => {
      if (included.has(fn)) return '/* already included ' + fn + ' */';
      const f = files.find(x => (x.name + x.ext) === fn);
      if (f && f.userCode != null) { included.add(fn); return inline(f.userCode); }
      return m;
    });
  }
  let result = inline(main.userCode || '');
  included.add(main.name + main.ext);
  for (const f of files) {
    const full = f.name + f.ext;
    if (included.has(full)) continue;
    if (f.ext !== '.c' && f.ext !== '.cpp') continue;
    if (!f.userCode || !f.userCode.trim()) continue;
    included.add(full);
    result += '\n\n/* ── ' + full + ' (auto-linked) ── */\n' + inline(f.userCode);
  }
  return result;
}

function _psetFmt(secs) {
  return (typeof formatTimeDisplay === 'function')
    ? formatTimeDisplay(secs)
    : String(Math.floor(secs / 60)).padStart(2, '0') + ':' + String(secs % 60).padStart(2, '0');
}

function _psetTick() {
  if (!_pset) { if (_psetTimerInterval) clearInterval(_psetTimerInterval); return; }
  if (_pset.paused) return;
  const el = document.getElementById('pset-timer');
  if (!el) return;
  const elapsed = Math.floor((Date.now() - _pset.startTime) / 1000);

  if (_pset.timeLimit > 0) {
    const remaining = _pset.timeLimit - elapsed;
    if (remaining <= 0) {
      el.innerText = '00:00';
      el.classList.add('timer-expired');
      el.classList.remove('timer-warning');
      if (_psetTimerInterval) { clearInterval(_psetTimerInterval); _psetTimerInterval = null; }
      if (typeof _showTimesUpFlash === 'function') _showTimesUpFlash();
      _psetAutoSubmit();
      return;
    }
    el.innerText = _psetFmt(remaining);
    el.classList.toggle('timer-warning', remaining <= 60); // last-minute pulse
    el.classList.remove('timer-expired');
  } else {
    el.innerText = _psetFmt(elapsed);
  }
}

/** Time-limit reached — grade everything as-is (no confirm prompt). */
function _psetAutoSubmit() {
  if (!_pset || _pset.submitted) return;
  _psetSyncEditor();
  _psetDoSubmit();
}

/** Pause/resume the session timer (mirrors the single-practice page). */
function psetTogglePause() {
  if (!_pset) return;
  const icon = document.getElementById('pset-pause-icon');
  const timerEl = document.getElementById('pset-timer');
  const editorArea = document.querySelector('.practice-editor-area');
  if (_pset.paused) {
    _pset.startTime += Date.now() - _pset.pausedAt;
    _pset.paused = false;
    _pset.pausedAt = null;
    if (icon) icon.setAttribute('data-lucide', 'pause');
    if (timerEl) timerEl.classList.remove('timer-paused');
    if (editorArea) editorArea.classList.remove('editor-paused');
    _psetTick();
  } else {
    _pset.paused = true;
    _pset.pausedAt = Date.now();
    if (icon) icon.setAttribute('data-lucide', 'play');
    if (timerEl) { timerEl.classList.add('timer-paused'); timerEl.innerText = 'PAUSED'; }
    if (editorArea) editorArea.classList.add('editor-paused');
  }
  const btn = document.getElementById('pset-pause-btn');
  if (typeof lucide !== 'undefined') lucide.createIcons(btn ? { root: btn } : undefined);
}

/** Reveal the next hint for the CURRENT problem (each problem tracks its own). */
function psetRevealNextHint() {
  if (!_pset) return;
  const p = _pset.problems[_pset.current];
  const hints = (p && p.hints) || [];
  const used = p.hintsUsed || 0;
  if (used >= hints.length) return;
  p.hintsUsed = used + 1;
  renderHintsBlock('pset-hints-container', hints, p.hintsUsed, 'psetRevealNextHint');
}

/** Toggle the boss bar (shared global) then repaint it for the current problem. */
function psetToggleBoss() {
  if (typeof toggleBossHealthBar === 'function') toggleBossHealthBar();
  const ta = document.getElementById('editor-textarea');
  _psetUpdateBossBar(ta ? ta.value : '', { instant: true });
}

/**
 * Per-problem boss health bar: similarity of the current code vs the problem's
 * reference solution (manual problems may have none → bar reads "no target").
 * Reuses the shared painter + green→red ramp + shatter from practice.js.
 */
let _psetBossDebounce = null;

/** Typing-rate wrapper around _psetUpdateBossBar (see the input handler). */
function _psetUpdateBossBarDebounced() {
  clearTimeout(_psetBossDebounce);
  _psetBossDebounce = setTimeout(() => _psetUpdateBossBar(), 120);
}

function _psetUpdateBossBar(_ignoredCode, opts) {
  const wrap = document.getElementById('boss-health-wrapper');
  const bar = document.getElementById('boss-health-bar');
  if (!wrap || !bar || wrap.style.display === 'none' || !_pset) return;

  const p = _pset.problems[_pset.current];
  const target = (p && p.referenceCode) || '';
  // The boss is always measured against the MAIN solution file (headers excluded).
  const mainCode = (p && p.files && p.files[0]) ? (p.files[0].userCode || '') : (p && p.userCode) || '';

  if (!target.trim()) {
    // No reference to fight against — show a neutral full bar.
    if (typeof _bossBarNoTarget === 'function') _bossBarNoTarget();
    return;
  }

  const normCur = (typeof _bossNormalize === 'function') ? _bossNormalize(mainCode) : (mainCode).replace(/\s+/g, '');
  const normTgt = (typeof _bossNormalize === 'function') ? _bossNormalize(target) : target.replace(/\s+/g, '');
  let sim = 0;
  if (typeof calculateSimilarity === 'function') sim = calculateSimilarity(normCur, normTgt);
  else sim = normCur === normTgt ? 1 : 0;

  const healthPercent = Math.max(0, 100 - sim * 100);
  // Max HP = the reference's significant-character count, so the readout counts
  // real characters still to match rather than an arbitrary number.
  if (typeof _bossBarPaint === 'function') {
    _bossBarPaint(healthPercent, Object.assign({ maxHp: normTgt.length }, opts || {}));
  }
}

function _psetAutosave() {
  if (!_pset) return;
  _psetSyncEditor();
  const codes = {};
  _pset.problems.forEach(p => {
    codes[p.key] = {
      activeFileIndex: p.activeFileIndex || 0,
      files: (p.files || []).map(f => ({ name: f.name, ext: f.ext, userCode: f.userCode || '' }))
    };
  });
  setSessionParam('psetAutosave', { setId: _pset.set.id, codes, startTime: _pset.startTime });
  // Drive the same "Saved · Ns ago" chip the single-program page uses — it was
  // rendered here but never fed, so it sat blank for the whole session.
  if (typeof _bossMarkSaved === 'function') _bossMarkSaved();
}

// ── Problem switching (code retained per problem) ──
function psetSwitch(i) {
  if (!_pset || i === _pset.current || i < 0 || i >= _pset.problems.length) return;
  _psetSyncEditor();
  // Close the run terminal so problem A's output can't leak into problem B.
  if (typeof _termClose === 'function') _termClose();
  _psetAutosave();
  _psetLoadProblem(i);
}

/** Render the file-tab bar for the current problem: tabs + reset + "Add Header File". */
function _psetRenderFileTabs(p) {
  const host = document.getElementById('pset-file-label');
  if (!host) return;
  const tabs = (p.files || []).map((f, fi) => `
    <div class="file-tab ${fi === p.activeFileIndex ? 'active' : ''}" onclick="psetSwitchFile(${fi})" oncontextmenu="event.preventDefault(); ${fi === 0 ? '' : `psetRenameFile(${fi}, this)`}" title="${fi === 0 ? 'Main solution file' : 'Header / companion file (right-click to rename)'}">
      <span class="file-tab-name">${escapeHTML(f.name + f.ext)}</span>
      <button class="file-tab-reset" onclick="event.stopPropagation(); psetResetFile(${fi})" title="${fi === 0 ? 'Reset to starter code' : 'Remove this file'}">
        <i data-lucide="${fi === 0 ? 'rotate-ccw' : 'x'}" style="width:11px;height:11px;"></i>
      </button>
    </div>
  `).join('');
  host.innerHTML = tabs +
    `<button class="file-tab-add" onclick="psetAddFile(this)" title="Add a header / companion file"><i data-lucide="plus" style="width:13px;height:13px;"></i></button>`;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: host });
}

/** Switch the active file within the current problem (code retained per file). */
function psetSwitchFile(fi) {
  if (!_pset) return;
  const p = _pset.problems[_pset.current];
  if (!p.files || fi < 0 || fi >= p.files.length || fi === p.activeFileIndex) return;
  _psetSyncEditor();
  p.activeFileIndex = fi;
  state.activeFileIndex = fi;
  const f = _psetActiveFile(p);
  const textarea = document.getElementById('editor-textarea');
  const preCode = document.getElementById('editor-code');
  if (textarea && preCode && f) {
    textarea.value = f.userCode || '';
    // The editor holds the whole file again — put this file's folds back.
    if (typeof edFoldReapply === 'function') edFoldReapply(textarea);
    preCode.innerHTML = (typeof syntaxHighlight === 'function' ? syntaxHighlight(textarea.value) : escapeHTML(textarea.value)) + '<br/>';
    if (typeof updateLineNumbers === 'function') updateLineNumbers(textarea);
    textarea.focus();
  }
  _psetRenderFileTabs(p);
}

/* Add / rename a companion file. The dialog lives in file-dialog.js — this is
   only the set page's half of the contract. */

function psetAddFile(anchor) {
  if (!_pset) return;
  const p = _pset.problems[_pset.current];
  _psetSyncEditor();
  openFileDialog({
    mode: 'add',
    files: p.files,
    mainCode: (p.files[0] || {}).userCode || '',
    canPair: true,
    anchor: anchor || document.querySelector('.file-tab-add'),
    onSubmit: (r) => {
      const made = [{ name: r.name, ext: r.ext, body: r.guard ? fdGuardText(r.name) : '' }];
      if (r.pair) made.push({ name: r.name, ext: '.c', body: fdPairText(r.name) });
      made.forEach(f => {
        if (p.files.some(x => x.name === f.name && x.ext === f.ext)) return;
        p.files.push({ id: generateId(), name: f.name, ext: f.ext, starterCode: '', code: '', userCode: f.body });
      });
      if (r.include && p.files[0]) {
        p.files[0].userCode = fdInsertInclude(p.files[0].userCode, r.name + r.ext);
        if (p.activeFileIndex === 0) {
          const ta = document.getElementById('editor-textarea');
          if (ta) { ta.value = p.files[0].userCode; ta.dispatchEvent(new Event('input', { bubbles: true })); }
        }
      }
      p.edited = true;
      psetSwitchFile(p.files.length - 1);
      psetRenderSwitcher();
    }
  });
}

function psetRenameFile(fi, anchor) {
  if (!_pset) return;
  const p = _pset.problems[_pset.current];
  if (!p.files[fi] || fi === 0) return;   // the main file keeps its name
  _psetSyncEditor();
  openFileDialog({
    mode: 'rename',
    files: p.files,
    index: fi,
    anchor: anchor,
    onSubmit: (r) => {
      p.files[fi].name = r.name;
      p.files[fi].ext = r.ext;
      p.edited = true;
      _psetRenderFileTabs(p);
    }
  });
}

/** Reset (main) or remove (companion) a file. */
function psetResetFile(fi) {
  if (!_pset) return;
  const p = _pset.problems[_pset.current];
  const file = p.files[fi];
  if (!file) return;

  if (fi === 0) {
    showConfirm('Reset Code', 'Reset the main file to its starter code? Any changes will be lost.', () => {
      file.userCode = file.starterCode || '';
      p.userCode = file.userCode;
      p.activeFileIndex = 0;
      state.activeFileIndex = 0;
      p.edited = _psetIsEdited(p);
      p.check = null;
      _psetLoadActiveIntoEditor(p);
      psetRenderSwitcher();
      _psetRenderCheckResults();
      _psetUpdateBossBar(null, { instant: true });
    });
  } else {
    showConfirm('Remove File', `Remove "${escapeHTML(file.name + file.ext)}" from this problem?`, () => {
      p.files.splice(fi, 1);
      p.activeFileIndex = 0;
      state.activeFileIndex = 0;
      p.edited = _psetIsEdited(p);
      p.check = null;
      _psetLoadActiveIntoEditor(p);
      _psetRenderFileTabs(p);
      psetRenderSwitcher();
      _psetRenderCheckResults();
    });
  }
}

/** Load the active file's code into the editor (no tab re-render). */
function _psetLoadActiveIntoEditor(p) {
  const f = _psetActiveFile(p);
  const textarea = document.getElementById('editor-textarea');
  const preCode = document.getElementById('editor-code');
  if (textarea && preCode && f) {
    textarea.value = f.userCode || '';
    // The editor holds the whole file again — put this file's folds back.
    if (typeof edFoldReapply === 'function') edFoldReapply(textarea);
    preCode.innerHTML = (typeof syntaxHighlight === 'function' ? syntaxHighlight(textarea.value) : escapeHTML(textarea.value)) + '<br/>';
    if (typeof updateLineNumbers === 'function') updateLineNumbers(textarea);
    textarea.focus();
  }
}

function _psetLoadProblem(i) {
  if (!_pset) return;
  _pset.current = i;
  const p = _pset.problems[i];

  // Full problem name above the Description; the boss plate takes the short alias.
  const titleEl = document.getElementById('pset-problem-title');
  if (titleEl) titleEl.textContent = `${i + 1}. ${p.title}${p.variantName ? ' — ' + p.variantName : ''}`;

  const setNameEl = document.getElementById('pset-set-name');
  if (setNameEl) setNameEl.textContent = _pset.set.title;

  if (typeof bossSetName === 'function') {
    const libCh = p.source === 'library' ? (state.challenges || []).find(x => x.id === p.challengeId) : null;
    const alias = libCh && typeof getProgramAlias === 'function' ? getProgramAlias(libCh) : p.title;
    bossSetName(`${i + 1}. ${alias}`);
  }
  const descEl = document.getElementById('pset-desc');
  if (descEl) descEl.innerHTML = (typeof formatRichText === 'function' ? formatRichText(p.description) : escapeHTML(p.description)) || 'No description provided.';

  psetRenderSamples(p);

  if (typeof renderHintsBlock === 'function') {
    renderHintsBlock('pset-hints-container', p.hints || [], p.hintsUsed || 0, 'psetRevealNextHint');
  }

  // Point the shared compile helpers (preprocessMultiFile / Run Code) at THIS
  // problem's files so headers are inlined and nothing leaks across problems.
  state.userFiles = p.files;
  state.activeFileIndex = p.activeFileIndex || 0;

  // Load the active file into the editor.
  const textarea = document.getElementById('editor-textarea');
  const preCode = document.getElementById('editor-code');
  const f = _psetActiveFile(p);
  if (textarea && preCode && f) {
    textarea.value = f.userCode || '';
    // The editor holds the whole file again — put this file's folds back.
    if (typeof edFoldReapply === 'function') edFoldReapply(textarea);
    preCode.innerHTML = (typeof syntaxHighlight === 'function' ? syntaxHighlight(textarea.value) : escapeHTML(textarea.value)) + '<br/>';
    if (typeof updateLineNumbers === 'function') updateLineNumbers(textarea);
    textarea.focus();
  }

  if (typeof setupSpecificEditor === 'function') {
    setupSpecificEditor('editor-textarea', 'editor-pre', 'editor-code', true);
  }

  _psetRenderFileTabs(p);

  // LV. comes from the library program's own level where there is one; manual
  // problems fall back to their position in the set.
  const libCh = p.source === 'library' ? (state.challenges || []).find(x => x.id === p.challengeId) : null;
  if (typeof bossSetLevel === 'function') {
    const lvl = (libCh && typeof getProgramLevel === 'function' && getProgramLevel(libCh)) || (i + 1);
    bossSetLevel(lvl);
  }
  // The cheat sheet is a property of the library program, so it comes and goes
  // as you move between problems in the set.
  if (typeof syncCheatsheetBtn === 'function') syncCheatsheetBtn(libCh);

  psetRenderSwitcher();
  _psetRenderCheckResults();
  // Repaint the boss bar for THIS problem (no shatter on a plain switch)…
  _psetUpdateBossBar(null, { instant: true });
  // …then take aim at the new one, so switching questions reads as re-targeting.
  if (typeof bossLockOn === 'function') bossLockOn();
  const root = document.querySelector('.practice-sidebar');
  if (typeof lucide !== 'undefined' && root) lucide.createIcons({ root });
}

/** Status used for the problem-box color: '' | 'edited' | 'pass' | 'fail'.
    A check counts only while it matches the current merged code (else it's stale). */
function _psetProblemStatus(p) {
  if (p && p.check && p.check.codeKey != null && p.check.codeKey === _psetMerge(p)) {
    return p.check.allPass ? 'pass' : 'fail';
  }
  return (p && p.edited) ? 'edited' : '';
}

// The Problems grid + check results now live in the shared third-window panel.
function psetRenderSwitcher() {
  if (typeof renderPracticePanel === 'function') renderPracticePanel();
}

// ── Check Code (per problem, no submission) ──
// "Check Code" is handled by the shared panel (ppRunAllChecks); kept as a thin
// alias for any legacy callers / the editor sync before checking.
function psetCheckCurrent() {
  _psetSyncEditor();
  if (typeof ppRunAllChecks === 'function') ppRunAllChecks();
}

/** Grade one problem → { kind:'tests', results, passed, total } |
    { kind:'similarity', pct } | { kind:'compile', ok, detail } */
async function _psetGradeProblem(p) {
  // Sync current editor if grading the current problem
  if (_pset && _pset.problems[_pset.current] === p) _psetSyncEditor();

  let result;
  const merged = _psetMerge(p);          // full translation unit (headers inlined)
  const mainCode = (p.files && p.files[0]) ? (p.files[0].userCode || '') : (p.userCode || '');

  // Submitting never compiles or runs anything — tests are run on demand with
  // "Check Code". A manual check that still matches this problem's code is
  // reused as-is; otherwise the problem falls back to reference similarity.
  const chk = p.check;
  if (chk && chk.codeKey != null && chk.codeKey === merged &&
      Array.isArray(chk.tests) && chk.tests.length > 0) {
    const results = chk.tests.filter(Boolean);
    result = { kind: 'tests', results, passed: results.filter(r => r.passed).length, total: results.length };
  } else if ((p.referenceCode || '').trim()) {
    // Similarity is judged on the MAIN solution file vs its reference.
    const { scoreCount, cLinesLen } = computeDiffs(mainCode, p.referenceCode);
    const pct = cLinesLen > 0 ? Math.min(Math.round((scoreCount / cLinesLen) * 100), 100) : 0;
    result = { kind: 'similarity', pct };
  } else if (chk && chk.codeKey === merged && Array.isArray(chk.reqs) && chk.reqs.length) {
    // No tests and no reference — credit the last manual check's compile result.
    result = { kind: 'compile', ok: chk.allPass, detail: '' };
  } else {
    // Nothing to grade against and nothing checked yet: don't compile on submit,
    // just record it as unverified rather than stalling the modal on a network call.
    result = { kind: 'unchecked' };
  }
  return result;
}

// Check results now render inside the shared third-window panel.
function _psetRenderCheckResults() {
  if (typeof renderPracticePanel === 'function') renderPracticePanel();
}

// ── Submit the whole attempt ──
function psetSubmitAll() {
  if (!_pset || _pset.submitted) return;
  _psetSyncEditor();

  const unchecked = _pset.problems.filter(p => _psetProblemStatus(p) !== 'pass').length;
  const msg = unchecked > 0
    ? `${unchecked} of ${_pset.problems.length} problems aren't fully green yet. Every problem will be graded as-is — submit anyway?`
    : 'All problems are green. Submit the attempt and record your scores?';

  showConfirm('Submit Attempt', msg, () => { _psetDoSubmit(); });
}

/** Stop the session clock + autosave loop. Called on submit and on teardown. */
function _psetStopLoops() {
  if (_psetTimerInterval) { clearInterval(_psetTimerInterval); _psetTimerInterval = null; }
  if (_psetAutosaveInterval) { clearInterval(_psetAutosaveInterval); _psetAutosaveInterval = null; }
}

async function _psetDoSubmit() {
  if (!_pset || _pset.submitted) return;
  _pset.submitted = true;

  // The attempt is over: stop the clock and the autosave loop. Leaving them
  // running meant the next autosave tick re-created the `psetAutosave` entry this
  // function clears below (so a reload restored an already-graded session, timer
  // and all), and a time limit could still fire "TIME'S UP" over the summary.
  _psetStopLoops();

  const submitBtn = document.getElementById('pset-submit-btn');
  const setRunning = (label) => {
    if (!submitBtn) return;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i data-lucide="loader" class="run-code-spinner" style="width:16px;height:16px;"></i> ${label}`;
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: submitBtn });
  };

  const submitTime = Date.now();
  const durationSeconds = Math.round((submitTime - _pset.startTime) / 1000);
  const summary = [];

  for (let i = 0; i < _pset.problems.length; i++) {
    const p = _pset.problems[i];
    setRunning(`Grading ${i + 1}/${_pset.problems.length}…`);

    let grade;
    try { grade = await _psetGradeProblem(p); }
    catch (e) { grade = { kind: 'error', error: (e && e.message) || String(e) }; }

    let score = 0, basis = 'reference', testsPassed = null, testsTotal = null;
    if (grade.kind === 'tests') {
      score = grade.total > 0 ? Math.round((grade.passed / grade.total) * 100) : 0;
      basis = 'tests'; testsPassed = grade.passed; testsTotal = grade.total;
    } else if (grade.kind === 'similarity') {
      score = grade.pct; basis = 'reference';
    } else if (grade.kind === 'compile') {
      score = grade.ok ? 100 : 0; basis = 'compile';
    } else if (grade.kind === 'unchecked') {
      score = 0; basis = 'unchecked';
    }

    // Minimum requirements gate the score: a missing required construct = 0.
    const reqs = p.minRequirements || [];
    let reqsMet = true;
    if (reqs.length) {
      const merged = _psetMerge(p);
      reqsMet = reqs.every(r => evalMinRequirement(r.type, merged));
      if (!reqsMet) score = 0;
    }

    // Same −5% per hint as a single-program attempt.
    const hintPenalty = (p.hintsUsed || 0) * 5;
    if (hintPenalty) score = Math.max(0, score - hintPenalty);

    summary.push({ title: p.title, score, basis, testsPassed, testsTotal, source: p.source,
                   reqsMet, reqCount: reqs.length, hintsUsed: p.hintsUsed || 0 });

    // Record EVERY problem against the set so the set's history is complete
    // (library problems also feed the individual-challenge history, SRS & quests).
    const isLib = p.source === 'library' && p.challengeId;
    const attemptCounter = isLib ? (state.activeAttempts[p.challengeId] || 0) + 1 : 1;
    state.history.unshift({
      id: generateId(),
      challengeId: isLib ? p.challengeId : null,
      setId: _pset.set.id,
      challengeTitle: `${p.title}${p.variantName ? ' - ' + p.variantName : ''} (Set: ${_pset.set.title})`,
      variantName: p.variantName || '',
      category: (() => {
        if (isLib) { const ch = state.challenges.find(x => x.id === p.challengeId); const f = ch ? state.nodes.find(n => n.id === ch.parentId) : null; return f ? f.name : 'Uncategorized'; }
        const f = state.nodes.find(n => n.id === _pset.set.parentId); return f ? f.name : 'Uncategorized';
      })(),
      date: new Date().toLocaleDateString(),
      startTime: _pset.startTime,
      submitTime,
      duration: durationSeconds,
      score,
      attemptNumber: attemptCounter,
      userCode: (p.files && p.files[0]) ? (p.files[0].userCode || '') : (p.userCode || ''),
      expectedCode: p.referenceCode || '',
      scoreBasis: basis,
      testsPassed,
      testsTotal
    });
    /* The same trim as the single-problem page; a set can add several
       entries in one sitting. */
    if (typeof _practiceTrimHistoryCode === 'function') _practiceTrimHistoryCode();
    if (isLib) {
      state.activeAttempts[p.challengeId] = score === 100 ? 0 : attemptCounter;
      if (typeof recordReview === 'function') recordReview('challenge', p.challengeId, score);
      if (window.questPenalty && window.questPenalty.notifyActivity) {
        window.questPenalty.notifyActivity('coding', p.challengeId, score);
      }
    }
  }

  saveData();
  clearSessionParam('psetAutosave');
  clearSessionParam('codingSetTimeLimit');

  if (submitBtn) {
    submitBtn.innerHTML = '<i data-lucide="check" style="width:16px;height:16px;"></i> Submitted';
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: submitBtn });
  }

  _psetShowSummary(summary, durationSeconds);
}

function _psetShowSummary(summary, durationSeconds) {
  const avg = summary.length ? Math.round(summary.reduce((s, r) => s + r.score, 0) / summary.length) : 0;
  const allPerfect = summary.every(r => r.score === 100);
  if (allPerfect && typeof confetti === 'function') {
    try { confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 } }); } catch (e) {}
  }

  let overlay = document.getElementById('pset-summary-overlay');
  if (overlay) overlay.remove();
  overlay = document.createElement('div');
  overlay.id = 'pset-summary-overlay';
  overlay.className = 'set-builder-overlay';
  overlay.innerHTML = `
    <div class="set-builder-window" style="max-width:560px;">
      <div class="set-builder-header">
        <h3><i data-lucide="flag" style="width:18px;height:18px;color:var(--color-primary);"></i> Attempt Complete</h3>
      </div>
      <div class="set-builder-body">
        <div class="pset-summary-avg ${avg === 100 ? 'pass' : avg >= 50 ? 'mid' : 'fail'}">
          <span class="pset-summary-avg-num">${avg}%</span>
          <span>average across ${summary.length} problem${summary.length !== 1 ? 's' : ''} · ${typeof formatTimeDisplay === 'function' ? formatTimeDisplay(durationSeconds) : durationSeconds + 's'}</span>
        </div>
        ${summary.map((r, i) => `
          <div class="pset-summary-row">
            <span class="pset-summary-num">${i + 1}</span>
            <span class="pset-summary-title">${escapeHTML(r.title)}</span>
            <span class="pset-summary-basis">${(r.reqCount && !r.reqsMet) ? '⚠ missing required construct' : r.basis === 'tests' ? `tests ${r.testsPassed}/${r.testsTotal}` : r.basis === 'compile' ? 'compile check' : r.basis === 'unchecked' ? 'not checked' : 'reference match'}</span>
            <span class="badge ${r.score === 100 ? 'score-perfect' : r.score >= 50 ? 'score-partial' : 'score-low'}">${r.score}%</span>
          </div>
        `).join('')}
        <p style="font-size:0.75rem;color:var(--text-tertiary);margin-top:0.75rem;">This session was saved to your set history. Library problems also feed the individual-challenge analytics and your review schedule.</p>
      </div>
      <div class="set-builder-footer">
        <button class="btn btn-secondary" onclick="document.getElementById('pset-summary-overlay').remove()">Stay here</button>
        <button class="btn btn-primary" onclick="document.getElementById('pset-summary-overlay').remove(); _psetGoLibrary();">Done</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: overlay });
}

/** Return to the Coding Library, reopening this set's detail when possible. */
function _psetGoLibrary(setId) {
  const id = setId || (_pset && _pset.set && _pset.set.id) || null;
  if (id && (state.codingSets || []).some(s => s.id === id)) {
    setSessionParam('browseActiveSet', id);
  } else {
    clearSessionParam('browseActiveSet');
  }
  spaNavigate('browse');
}

/** Ctrl+S. Returns false when there is nothing to save, so the toast is honest. */
function psetSaveNow() {
  if (!_pset) return false;
  _psetAutosave();        // ends in _bossMarkSaved(), which paints #ed-save-state
  return true;
}

/** The timer menu's Apply, for this screen's clock. */
function psetApplyTimer(secs, restart) {
  if (!_pset) return;
  _pset.timeLimit = secs || 0;
  if (restart) _pset.startTime = Date.now();
  try { setSessionParam('codingSetTimeLimit', String(_pset.timeLimit)); } catch (e) { /* full */ }
  _psetTick();
  if (typeof toast === 'function') {
    toast(secs ? 'Countdown set.' : 'Counting up.', { type: 'success', duration: 1600 });
  }
}

/* ── Editing the description mid-attempt ──────────────────────
   The same editor the program screen opens, pointed at this problem. A set
   problem can come from the library or be written into the set itself, and the
   correction is written back to whichever one it actually came from -- so it is
   still there next time, which is the point of fixing it rather than noting it. */
/* Samples are editable here too, through the same editor the single-program
   attempt uses. The write-back is the description's, note for note: a problem
   pulled from the library owns nothing, so the edit has to land on the variant
   it came from, and a problem written into the set lands on the set. */
function _psetSampleTarget(p) {
  return {
    read: () => (p.samples || (p.samples = [])),
    write: (list) => {
      p.samples = list;
      if (p.source === 'library') {
        const c = (state.challenges || []).find(ch => ch.id === p.challengeId);
        const v = c && (c.variants || []).find(x => x.id === p.variantId);
        if (v) v.samples = list;
      } else if (_pset && _pset.set && _pset.set.problems) {
        const entry = _pset.set.problems[p.srcIndex];
        if (entry) entry.samples = list;
      }
    },
    repaint: () => psetRenderSamples(p)
  };
}

/** Paint the set screen's sample list, with the same edit affordances. */
function psetRenderSamples(p) {
  const host = document.getElementById('pset-samples');
  if (!host || !p) return;
  const samples = p.samples || [];
  const fmt = (c) => (typeof formatSampleText === 'function' ? formatSampleText(c) : escapeHTML(c));
  host.innerHTML = samples.map((s, si) => `
      <div style="margin-bottom:0.5rem;">
        <div class="sample-head">
          <h3 class="sample-title">${escapeHTML(s.title)}</h3>
          <button class="sample-edit-btn is-first" onclick="psetEditSample(${si})"
                  title="Edit this sample" aria-label="Edit this sample">
            <i data-lucide="pencil" style="width:11px;height:11px;"></i>
          </button>
        </div>
        <div class="sample-content">${fmt(s.content)}</div>
      </div>`).join('');
  if (typeof lucide !== 'undefined') lucide.createIcons({ el: host });
}

window.psetEditSample = function (si) {
  const p = _pset && _pset.problems[_pset.current];
  if (!p || typeof practiceEditSample !== 'function') return;
  practiceEditSample(si, _psetSampleTarget(p));
};


function _psetDescTarget(p) {
  return {
    read: () => p.description || '',
    write: (html) => {
      p.description = html;
      if (p.source === 'library') {
        const c = (state.challenges || []).find(ch => ch.id === p.challengeId);
        const v = c && (c.variants || []).find(x => x.id === p.variantId);
        if (v) v.description = html;
      } else if (_pset && _pset.set && _pset.set.problems) {
        const entry = _pset.set.problems[p.srcIndex];
        if (entry) entry.description = html;
      }
    },
    paintInto: 'pset-desc'
  };
}

function psetEditDescription() {
  const p = _pset && _pset.problems[_pset.current];
  if (!p || typeof practiceEditDescription !== 'function') return;
  practiceEditDescription(_psetDescTarget(p));
}

/* Set while an attempt is being thrown away, and read by psetDestroy: the
   route's teardown flushes an autosave on the way out, so without this the
   draft just deleted would be written straight back. */
let _psetDiscarding = false;

/** Throw this attempt away: the draft and the clock. Nothing graded is touched. */
function psetDiscardAttempt() {
  _psetDiscarding = true;
  try {
    clearSessionParam('psetAutosave');
    _psetStopLoops();
    if (_pset) _pset.submitted = true;   // belt and braces against a late flush
  } catch (e) {
    console.error('[PracticeSet] Discard failed:', e);
  }
  if (typeof toast === 'function') {
    toast('Attempt discarded — nothing was saved.', { type: 'info', duration: 3000 });
  }
  _psetGoLibrary();
  setTimeout(() => { _psetDiscarding = false; }, 0);
}

function psetExit() {
  if (!_pset || _pset.submitted) { _psetGoLibrary(); return; }

  /* Two real answers, so two buttons -- the program screen already asks it this
     way. Leaving used to always leave a resumable attempt behind, and starting
     genuinely fresh meant finding your way back and clearing it by hand. Keep is
     the primary because it is the one you can still undo: work kept can be
     discarded later, work discarded cannot be brought back. */
  if (typeof showChoice !== 'function') {
    showConfirm('Leave session?',
      'Your code is auto-saved for this set, but nothing will be graded until you submit. Leave anyway?',
      () => { _psetAutosave(); _psetGoLibrary(); });
    return;
  }
  showChoice({
    title: 'Leave attempt?',
    message: 'Keep it and the code, timer and restore points are all waiting when you come back. '
           + 'Discard and this attempt is gone — nothing is graded either way.',
    secondary: 'Discard attempt',
    primary: 'Keep and leave',
    danger: true,
    onSecondary: () => psetDiscardAttempt(),
    onPrimary: () => { _psetAutosave(); _psetGoLibrary(); }
  });
}
