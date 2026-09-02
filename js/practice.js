/* ============================================================
   PRACTICE.JS — Practice Session + Timer Logic
   ============================================================ */

window.activeTimerInterval = null;
let _submitInProgress = false;
let _practiceSubmitted = false; // graded already — don't resurrect the autosave on exit
let _autoSaveInterval = null;
// Single-practice third-window state (Check Code results + restore points).
let _practiceCheck = null;
let _practiceExecs = [];

/** The submit/finish button — the top-bar Submit, or the panel's Finish button. */
function _practiceSubmitBtn() {
  return document.getElementById('submit-btn') || document.getElementById('pp-finish-btn');
}

function initPractice() {
  const challengeId = getSessionParam('practiceChallenge');
  const variantId = getSessionParam('practiceVariant');
  const timeLimit = getSessionParam('timeLimit') || 0;

  if (!challengeId || !variantId) { spaNavigate('browse'); return; }

  const challenge = state.challenges.find(c => c.id === challengeId);
  const variant = challenge ? challenge.variants.find(v => v.id === variantId) : null;

  if (!challenge || !variant) { spaNavigate('browse'); return; }

  // Ensure files[] exists
  if (!variant.files || variant.files.length === 0) {
    variant.files = [{ id: generateId(), name: 'main', ext: '.c', starterCode: variant.starterCode || '', code: variant.code || '' }];
  }

  state.activeChallenge = challenge;
  state.activeVariant = variant;
  state.userCode = variant.files[0].starterCode || '';
  // Per-file user code storage — restore auto-saved code ONLY if it belongs to
  // this exact challenge+variant (matching by filename alone restored code from
  // a different challenge's main.c into this one).
  const autoSavedRaw = getSessionParam('autoSavedFiles');
  let autoSaved = (autoSavedRaw && autoSavedRaw.challengeId === challengeId && autoSavedRaw.variantId === variantId)
    ? autoSavedRaw.files
    : null;
  // Which tab was open travels with the files it refers to, and only with them.
  let autoSavedTab = autoSaved ? autoSavedRaw.activeFileIndex : null;
  if (autoSavedRaw && !autoSaved) clearSessionParam('autoSavedFiles'); // stale, different attempt

  // Nothing in this tab's session: the tab was closed, or the browser restarted.
  // The disk copy is the only thing left, so use it and say so.
  let _restoredFromDisk = null;
  if (!autoSaved) {
    const disk = _practiceReadDraft(challengeId, variantId);
    if (disk && (disk.files || []).some(f => (f.userCode || '').trim())) {
      autoSaved = disk.files;
      autoSavedTab = disk.activeFileIndex;
      _restoredFromDisk = disk;
    }
  }
  /* WHICH files exist is the save's business, not the variant's.

     This used to rebuild the list by walking variant.files and looking up each
     one's saved text, which quietly made the variant authoritative over the
     student's own file list. Everything they could do to that list was undone
     by a reload:

       added   a header you created was not in variant.files, so it vanished --
               and the next autosave then wrote the shorter list back over the
               draft, so it was destroyed rather than merely hidden
       renamed the saved name did not match, so the file came back under its
               original name holding its original starter code
       deleted a file you removed had no saved entry, so it was resurrected

     So the saved list decides which files there are and what order they are
     in, and the variant is consulted only for what it actually owns: the
     starter code behind each file, for the per-file Reset. Matching prefers
     the id, so a renamed file is still recognised as the same file; drafts
     written before ids were saved fall back to the name. */
  const usedSaves = new Set();
  const variantFor = (sv) => {
    let v = sv.id && variant.files.find(f => f.id === sv.id);
    if (!v) v = variant.files.find(f => f.name === sv.name && f.ext === sv.ext && !usedSaves.has(f));
    if (v) usedSaves.add(v);
    return v || null;
  };
  state.userFiles = (autoSaved && autoSaved.length)
    ? autoSaved.map(sv => {
        const v = variantFor(sv);
        return v
          ? { ...v, name: sv.name, ext: sv.ext, userCode: sv.userCode || '' }
          : { id: sv.id || generateId(), name: sv.name, ext: sv.ext,
              starterCode: '', code: '', userCode: sv.userCode || '' };
      })
    : variant.files.map(f => ({ ...f, userCode: f.starterCode || '' }));
  /* Back to the file you were actually in. Clamped against the list that was
     just rebuilt rather than the one that was saved, because a file may have
     been deleted since and an index past the end would load nothing at all. */
  state.activeFileIndex = Math.max(0, Math.min(
    parseInt(autoSavedTab, 10) || 0, state.userFiles.length - 1));
  _submitInProgress = false;
  _practiceSubmitted = false;
  state.timeLimit = timeLimit;
  // Resume the timer across accidental reloads of the same attempt; otherwise start fresh.
  const savedStart = autoSaved
    ? (parseInt(getSessionParam('practiceStartTime')) || (_restoredFromDisk && _restoredFromDisk.startTime) || null)
    : null;
  if (_restoredFromDisk) {
    const mins = Math.max(1, Math.round((Date.now() - (_restoredFromDisk.savedAt || Date.now())) / 60000));
    setTimeout(() => {
      if (typeof toast === 'function') {
        toast('Restored the code you had open ' + mins + ' minute' + (mins !== 1 ? 's' : '') + ' ago. Retry starts fresh.',
          { type: 'info', duration: 7000 });
      }
    }, 700);
  }
  state.sessionData = { startTime: savedStart || Date.now(), timeLimit: timeLimit, attemptsThisSession: 1, paused: false, pausedAt: null, hintsUsed: 0 };
  setSessionParam('practiceStartTime', state.sessionData.startTime);

  // Populate sidebar
  // The full program name lives above the Description; the boss plate carries the
  // short alias, so a long title can't squeeze the HP bar.
  const progTitleEl = document.getElementById('practice-program-title');
  if (progTitleEl) {
    progTitleEl.innerHTML = `${escapeHTML(challenge.title)} ${getDifficultyBadgeHTML(challenge)}`;
  }
  const versionEl = document.getElementById('practice-program-version');
  if (versionEl) versionEl.textContent = variant.name || '';
  bossSetName(typeof getProgramAlias === 'function' ? getProgramAlias(challenge) : challenge.title);
  document.getElementById('practice-desc').innerHTML = formatRichText(variant.description || challenge.description) || 'No description provided.';

  const samplesContainer = document.getElementById('practice-samples-container');
  if (variant.samples && variant.samples.length > 0) {
    samplesContainer.innerHTML = variant.samples.map((s, si) => {
      // If the sample carries an Input: block, offer to run with it rather than
      // making the student retype it into the terminal every time.
      const stdin = _sampleStdin(s.content);
      return `
      <div style="margin-bottom:0.5rem;">
        <div class="sample-head">
          <h3 class="sample-title">${escapeHTML(s.title)}</h3>
          ${stdin ? `<button class="sample-run-btn" onclick="practiceRunSample(${si})" title="Run your code with this sample's input">
            <i data-lucide="play" style="width:11px;height:11px;"></i> Run this
          </button>` : ''}
        </div>
        <div class="sample-content">${formatSampleText(s.content)}</div>
      </div>`;
    }).join('');
  } else {
    samplesContainer.innerHTML = '';
  }

  // Hints
  state.sessionData.hintsUsed = 0;
  renderHintsBlock('practice-hints-container', variant.hints || [], 0, 'revealNextHint');

  renderPracticeFileTabs();
  // `restored` tells the first load not to save the (still empty) editor over the
  // code we just pulled out of the autosave — see loadPracticeFile().
  loadPracticeFile(state.activeFileIndex, { restored: !!autoSaved });

  // Boss bar — LV. comes from the program's level, set in Admin or by clicking it.
  bossSetLevel(typeof getProgramLevel === 'function' ? getProgramLevel(challenge) : challenge.level);
  _bossResetCombo();
  _bossSeedLowest(challenge);
  const bossBarEnabled = sessionStorage.getItem('bossBarEnabled') !== 'false';
  bossSetVisible(bossBarEnabled);
  const bossToggleBtn = document.getElementById('boss-bar-toggle-btn');
  if (bossToggleBtn) bossToggleBtn.style.color = bossBarEnabled ? 'var(--color-warning)' : 'var(--text-tertiary)';
  syncCheatsheetBtn(challenge);

  // Line numbers visibility
  if (typeof initLineNumbersState === 'function') initLineNumbersState();

  // Timer
  _practiceStartTimerTicker();

  // Auto-save: persist user code every 30 s so a tab close doesn't lose work
  if (_autoSaveInterval) clearInterval(_autoSaveInterval);
  _autoSaveInterval = setInterval(_practiceAutoSave, 30000);

  // 30 seconds is a long time to lose. Also write when the page is hidden or
  // closed, which is exactly when the sessionStorage copy is about to vanish.
  if (!window._practiceDraftFlush) {
    window._practiceDraftFlush = function () {
      if (_practiceSubmitted) return;
      try { _practiceAutoSave(); } catch (e) { /* leaving anyway */ }
    };
    window.addEventListener('pagehide', window._practiceDraftFlush);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') window._practiceDraftFlush();
    });
  }

  // Keyboard shortcuts. Ctrl+Enter is CHECK on both this page and the
  // practice-set page — it used to submit here and check there, so the same
  // reflex ended your attempt on one screen and not the other. Finishing is
  // deliberately a two-hand chord.
  window._practiceShortcutHandler = function(e) {
    /* Ctrl+S is answered BEFORE the three guards below, and that placement is
       the whole fix. Those guards hand the keyboard to an open modal, to the
       terminal and to the find bar -- so while you were reading run output,
       the one shortcut you reach for did nothing here and fell through to the
       browser's "Save page" dialog instead.

       Saving is safe from all three: it reads the editor and writes a draft,
       and none of those states change what that means. */
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey &&
        (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      if (practiceSaveNow() && typeof toast === 'function') {
        toast('Saved', { type: 'success', duration: 1400 });
      }
      return;
    }
    if (document.querySelector('.modal-overlay:not(.hidden)')) return;
    if (document.getElementById('run-code-overlay')) return;
    const findBar = document.getElementById('ed-find-bar');
    if (findBar && findBar.classList.contains('open') && findBar.contains(document.activeElement)) return;

    if (e.ctrlKey && e.shiftKey && e.key === 'Enter') {
      e.preventDefault();
      confirmFinishAttempt();
    } else if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      if (typeof ppRunAllChecks === 'function') ppRunAllChecks();
    } else if (e.ctrlKey && e.shiftKey && (e.key === 'R' || e.key === 'r')) {
      e.preventDefault();
      retryPractice();
    } else if (e.ctrlKey && (e.key === 'b' || e.key === 'B')) {
      e.preventDefault();
      toggleBossHealthBar();
    } else if (e.ctrlKey && e.key === '\\') {
      e.preventDefault();
      toggleZenMode();
    } else if (e.key === 'Escape') {
      // In full screen the browser handles Esc itself — don't also offer to
      // abandon the attempt just because the user wanted their window back.
      if (isFullscreen()) return;
      e.preventDefault();
      if (findBar && findBar.classList.contains('open')) { edCloseFind(); return; }
      if (isZenMode()) { toggleZenMode(); return; }
      practiceConfirmExit();
    }
  };
  document.addEventListener('keydown', window._practiceShortcutHandler);

  // Third-window panel (Problems / Tests / Executions). Single problem here.
  _practiceCheck = null;
  _practiceLoadExecs();
  if (typeof setPracticePanelCtx === 'function') {
    setPracticePanelCtx({
      mode: 'practice',
      finishLabel: 'Finish attempt…',
      problems: () => [{ title: (state.activeChallenge && state.activeChallenge.title) || 'Problem' }],
      current: () => 0,
      status: () => {
        if (_practiceCheck && _practiceCheck.codeKey === _buildSubmissionSource()) return _practiceCheck.allPass ? 'pass' : 'fail';
        return '';
      },
      onSwitch: () => {},
      tests: () => (state.activeVariant && state.activeVariant.tests) || [],
      minReqs: () => (state.activeVariant && state.activeVariant.minRequirements) || [],
      code: () => (typeof _buildSubmissionSource === 'function') ? _buildSubmissionSource() : (document.getElementById('editor-textarea') || {}).value || '',
      getCheck: () => _practiceCheck,
      setCheck: (obj) => { _practiceCheck = obj; },
      // The best previous graded attempt rides along as a read-only restore
      // point, so "go back to the version that scored well" spans sessions.
      getExecs: () => { const b = _practiceBestAttemptExec(); return b ? [b, ..._practiceExecs] : _practiceExecs; },
      pushExec: (e) => {
        _practiceExecs.push(e);
        if (_practiceExecs.length > 20) _practiceExecs.shift();
        _practiceSaveExecs();
      },
      snapshot: () => { savePracticeFileCode(); return { files: JSON.parse(JSON.stringify(state.userFiles || [])), activeFileIndex: state.activeFileIndex || 0 }; },
      onRestore: (snap) => {
        if (!snap || !snap.files) return;
        state.userFiles = JSON.parse(JSON.stringify(snap.files));
        state.activeFileIndex = Math.min(snap.activeFileIndex || 0, state.userFiles.length - 1);
        loadPracticeFile(state.activeFileIndex);
      },
      onFinish: () => confirmFinishAttempt()
    });
    if (typeof renderPracticePanel === 'function') renderPracticePanel();
  }

  applyEditorViewSettings();
  initPracticePanes();
  initZenState();
  _syncFullscreenBtn();   // the template renders fresh; carry over any active full screen
  _renderSavedState();
  _practiceApplyJump();

  const practiceRoot = document.getElementById('practice-view') || document.getElementById('main-content');
  if (typeof lucide !== 'undefined') lucide.createIcons(practiceRoot ? { root: practiceRoot } : undefined);
}

/**
 * "Open in editor at line N" from the solution page. The code itself arrives
 * through the normal autosave-restore path; this only has to land the caret on
 * the line, scroll it into view and mark it in the gutter so it's obvious which
 * line you came here to fix.
 */
function _practiceApplyJump() {
  const jump = getSessionParam('practiceJumpLine');
  clearSessionParam('practiceJumpLine');
  if (!jump || !(jump.line > 0)) return;

  const fi = jump.fileIndex || 0;
  if (fi > 0 && state.userFiles && fi < state.userFiles.length) loadPracticeFile(fi);

  const ta = document.getElementById('editor-textarea');
  if (!ta) return;
  const lines = ta.value.split('\n');
  const n = Math.min(jump.line, lines.length);
  const start = lines.slice(0, n - 1).reduce((acc, l) => acc + l.length + 1, 0);

  ta.focus();
  ta.setSelectionRange(start, start + (lines[n - 1] || '').length);
  const lh = parseFloat(getComputedStyle(ta).lineHeight) || 21;
  ta.scrollTop = Math.max(0, (n - 4) * lh);
  ta.dispatchEvent(new Event('scroll'));

  // Mark it, unless it already carries one — this is a pointer, not a toggle.
  if (typeof edGetMarks === 'function' && typeof edToggleMark === 'function') {
    if (!edGetMarks().includes(n)) edToggleMark(n);
    else if (typeof updateLineNumbers === 'function') updateLineNumbers(ta);
  }
}

/** Persist the in-progress attempt (keyed by challenge+variant so it can never
    be restored into a different program that happens to share filenames). */
/* The draft used to live only in sessionStorage, which the browser throws away
   when the tab closes. A refresh kept your work; a closed tab, a crash or a
   reboot did not — on the screen where you type the most. It is mirrored to
   localStorage now, keyed by challenge+variant, and cleared when the attempt is
   graded. */
const PRACTICE_DRAFT_KEY = 'ssp.practiceDraft';

function _practiceWriteDraft() {
  try {
    if (!state.activeChallenge || !state.activeVariant) return;
    localStorage.setItem(PRACTICE_DRAFT_KEY, JSON.stringify({
      challengeId: state.activeChallenge.id,
      variantId: state.activeVariant.id,
      title: state.activeChallenge.title || '',
      savedAt: Date.now(),
      startTime: (state.sessionData || {}).startTime || Date.now(),
      // Which tab was open is part of where you were, the same as the text in
      // it: coming back to main.c after a reload means finding your place again
      // every time.
      activeFileIndex: state.activeFileIndex || 0,
      // id as well as name: it is what lets a renamed file still be matched to
      // the variant file it came from, and so keep its starter code.
      files: (state.userFiles || []).map(f => ({ id: f.id, name: f.name, ext: f.ext, userCode: f.userCode || '' }))
    }));
  } catch (e) { /* quota — the session copy still covers a reload */ }
}

function _practiceReadDraft(challengeId, variantId) {
  try {
    const d = JSON.parse(localStorage.getItem(PRACTICE_DRAFT_KEY) || 'null');
    if (!d || d.challengeId !== challengeId || d.variantId !== variantId) return null;
    return d;
  } catch (e) { return null; }
}

function _practiceClearDraft() {
  try { localStorage.removeItem(PRACTICE_DRAFT_KEY); } catch (e) { /* nothing to clear */ }
}

function _practiceAutoSave() {
  if (!state.userFiles || !state.activeChallenge || !state.activeVariant) return;
  savePracticeFileCode();
  _practiceWriteDraft();
  setSessionParam('autoSavedFiles', {
    challengeId: state.activeChallenge.id,
    variantId: state.activeVariant.id,
    activeFileIndex: state.activeFileIndex || 0,
    files: state.userFiles.map(f => ({ id: f.id, name: f.name, ext: f.ext, userCode: f.userCode || '' }))
  });
  _practiceSaveExecs();
  _bossMarkSaved();
}

/* ── Check-Code restore points, kept across leaving the page ───────────── */
/**
 * Save on demand (Ctrl+S).
 *
 * Deliberately the SAME call the autosave makes rather than a second write
 * that does most of it: _practiceAutoSave already pulls the editor into
 * state, writes the draft, records the session copy and stamps the toolbar
 * chip. A separate path would be a second place for those steps to fall out
 * of step, and the chip disagreeing with what is on disk is exactly the bug
 * this shortcut exists to remove.
 */
function practiceSaveNow() {
  if (!state.userFiles || !state.activeChallenge || !state.activeVariant) return false;
  _practiceAutoSave();          // ends in _bossMarkSaved(), which paints #ed-save-state
  return true;
}

function _practiceExecKey() {
  return (state.activeChallenge && state.activeVariant)
    ? state.activeChallenge.id + '::' + state.activeVariant.id : null;
}

function _practiceSaveExecs() {
  const key = _practiceExecKey();
  if (!key) return;
  try { setSessionParam('practiceExecs', { key, execs: _practiceExecs }); }
  catch (e) { /* snapshots too large for sessionStorage — not worth failing over */ }
}

function _practiceLoadExecs() {
  const key = _practiceExecKey();
  const saved = getSessionParam('practiceExecs');
  _practiceExecs = (saved && saved.key === key && Array.isArray(saved.execs)) ? saved.execs : [];
}

/**
 * The best previously GRADED attempt at this program, as a restore point.
 * History stores full userFiles per attempt, so this is real code you can
 * return to — not just a score.
 */
function _practiceBestAttemptExec() {
  const ch = state.activeChallenge;
  if (!ch || !Array.isArray(state.history)) return null;
  const logs = state.history.filter(h =>
    h.challengeId === ch.id && Array.isArray(h.userFiles) && h.userFiles.length);
  if (!logs.length) return null;
  const best = logs.reduce((a, b) => (b.score > a.score ? b : a));
  return {
    score: best.score,
    ts: best.submitTime || best.startTime || Date.now(),
    snapshot: { files: best.userFiles, activeFileIndex: 0 },
    label: 'Best past attempt' + (best.date ? ' · ' + best.date : ''),
    historical: true
  };
}

/** "Saved · Ns ago" chip in the editor toolbar, so the autosave is visible. */
let _bossSavedAt = 0;
let _savedTickInterval = null;

function _bossMarkSaved() {
  _bossSavedAt = Date.now();
  _renderSavedState();
  if (!_savedTickInterval) _savedTickInterval = setInterval(_renderSavedState, 5000);
}

function _renderSavedState() {
  const el = document.getElementById('ed-save-state');
  if (!el) return;
  if (!_bossSavedAt) { el.textContent = ''; return; }
  const secs = Math.round((Date.now() - _bossSavedAt) / 1000);
  const when = secs < 5 ? 'just now' : secs < 60 ? secs + 's ago' : Math.round(secs / 60) + 'm ago';
  el.innerHTML = `<i data-lucide="check-circle-2" style="width:12px;height:12px;"></i> Saved ${when}`;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: el });
}

function _stopSavedTicker() {
  if (_savedTickInterval) { clearInterval(_savedTickInterval); _savedTickInterval = null; }
  _bossSavedAt = 0;
}

/* ── Collapse either side panel independently ──────────────── */

/** @param {'left'|'right'} side */
function togglePracticePane(side) {
  const layout = document.querySelector('.practice-layout');
  if (!layout) return;
  const cls = side === 'left' ? 'hide-left' : 'hide-right';
  const on = layout.classList.toggle(cls);
  localStorage.setItem('practicePane_' + side, on ? '1' : '0');
  _syncPaneButtons();
  window.dispatchEvent(new Event('resize'));
}

/**
 * Point each divider's arrow at whatever it will do next: away from the editor
 * to fold a pane out of the way, back toward it to bring the pane in again.
 */
function _syncPaneButtons() {
  const layout = document.querySelector('.practice-layout');
  if (!layout) return;
  [['left', 'description panel'], ['right', 'results panel']].forEach(([side, label]) => {
    const btn = document.getElementById('rz-' + side + '-btn');
    if (!btn) return;
    const hidden = layout.classList.contains(side === 'left' ? 'hide-left' : 'hide-right');
    // Collapsed: the arrow points back into the gap the pane came out of.
    const dir = side === 'left' ? (hidden ? 'right' : 'left') : (hidden ? 'left' : 'right');
    const divider = btn.closest('.resizer-divider');
    if (divider) divider.classList.toggle('collapsed', hidden);
    btn.classList.toggle('active', hidden);
    btn.title = (hidden ? 'Show the ' : 'Collapse the ') + label;
    btn.setAttribute('aria-label', btn.title);
    // Rebuild the icon rather than re-pointing the existing <svg>: lucide keeps
    // the element's old classes when it re-renders, so flipping in place left
    // both lucide-chevron-left and lucide-chevron-right stacked up on it.
    if (btn.dataset.dir !== dir) {
      btn.dataset.dir = dir;
      btn.innerHTML = '<i data-lucide="chevron-' + dir + '"></i>';
      if (typeof lucide !== 'undefined') lucide.createIcons({ root: btn });
    }
  });
}

function initPracticePanes() {
  const layout = document.querySelector('.practice-layout');
  if (!layout) return;
  layout.classList.toggle('hide-left', localStorage.getItem('practicePane_left') === '1');
  layout.classList.toggle('hide-right', localStorage.getItem('practicePane_right') === '1');
  _syncPaneButtons();
}

/* ── Zen mode: collapse the description and results panels ── */
function isZenMode() {
  const layout = document.querySelector('.practice-layout');
  return !!layout && layout.classList.contains('zen');
}

function toggleZenMode() {
  const layout = document.querySelector('.practice-layout');
  if (!layout) return;
  const on = layout.classList.toggle('zen');
  localStorage.setItem('practiceZen', on ? '1' : '0');
  const btn = document.getElementById('ed-zen-btn');
  if (btn) {
    btn.classList.toggle('active', on);
    const ic = btn.querySelector('[data-lucide], svg');
    if (ic) { ic.setAttribute('data-lucide', on ? 'minimize-2' : 'maximize-2'); if (typeof lucide !== 'undefined') lucide.createIcons({ root: btn }); }
  }
  window.dispatchEvent(new Event('resize'));
}

function initZenState() {
  if (localStorage.getItem('practiceZen') === '1' && !isZenMode()) toggleZenMode();
}

/** Leaving mid-attempt — the code is autosaved, but say so rather than just vanishing. */
function practiceConfirmExit() {
  if (_practiceSubmitted || !state.sessionData) { spaNavigate('browse'); return; }
  if (typeof showConfirm !== 'function') { spaNavigate('browse'); return; }
  showConfirm('Leave attempt?',
    'Your code is saved and the timer will pick up where you left off, but nothing is graded until you finish the attempt. Leave anyway?',
    () => spaNavigate('browse'));
}

/** Finish button / Ctrl+Shift+Enter — confirm, then grade. */
function confirmFinishAttempt() {
  if (_submitInProgress || _practiceSubmitted) return;
  if (typeof showConfirm !== 'function') { submitCode(); return; }
  const chk = _practiceCheck;
  const fresh = chk && chk.codeKey != null && chk.codeKey === _buildSubmissionSource();
  const detail = fresh
    ? `Your last check scored ${chk.passed}/${chk.total} and still matches this code — it'll be used as your result.`
    : 'You haven\'t checked this code yet, so it will be graded on how closely it matches the reference solution.';
  showConfirm('Finish attempt?', detail + ' This records the attempt and stops the timer.', () => submitCode());
}

/** Pull the stdin out of a sample's "Input: … Output: …" body. */
function _sampleStdin(content) {
  const m = String(content || '').match(/input\s*:?[ \t]*\r?\n([\s\S]*?)(?:\r?\n[ \t]*output\s*:|$)/i);
  if (!m) return '';
  const body = m[1].replace(/\s+$/, '');
  return body ? body + '\n' : '';
}

/** Open the run terminal already fed with a sample's input. */
function practiceRunSample(si) {
  const s = (state.activeVariant && state.activeVariant.samples || [])[si];
  if (!s) return;
  runCodeWithPiston(_sampleStdin(s.content));
}

function switchPracticeFile(fi) { loadPracticeFile(fi); }

function renderPracticeFileTabs() {
  const tabBar = document.getElementById('practice-file-tabs');
  if (!tabBar || !state.userFiles) return;
  // The main file (index 0) can be reset but never deleted — everything else is
  // a companion file you added, so it gets a remove button instead.
  tabBar.innerHTML = state.userFiles.map((f, fi) => `
    <div class="file-tab ${fi === state.activeFileIndex ? 'active' : ''}" onclick="switchPracticeFile(${fi})" oncontextmenu="event.preventDefault(); practiceRenameFile(${fi}, this)" title="${fi === 0 ? 'Main file (right-click to rename)' : 'Companion file (right-click to rename)'}">
      <span class="file-tab-name">${escapeHTML(f.name + f.ext)}</span>
      ${fi === 0
        ? `<button class="file-tab-reset" onclick="event.stopPropagation(); resetSingleFile(${fi})" title="Reset this file to starter code">
             <i data-lucide="rotate-ccw" style="width:11px;height:11px;"></i>
           </button>`
        : `<button class="file-tab-reset" onclick="event.stopPropagation(); practiceDeleteFile(${fi})" title="Delete this file">
             <i data-lucide="x" style="width:11px;height:11px;"></i>
           </button>`}
    </div>
  `).join('') + `<button class="file-tab-add" onclick="practiceAddFile(this)" title="Add a header / companion file"><i data-lucide="plus" style="width:13px;height:13px;"></i></button>`;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: tabBar });
}

function savePracticeFileCode() {
  const textarea = document.getElementById('editor-textarea');
  if (!textarea || !state.userFiles) return;
  // Never textarea.value — a collapsed block is not in it. This is the funnel
  // Run, Check, Finish and autosave all reach the code through.
  const full = (typeof edFullSource === 'function') ? edFullSource(textarea) : textarea.value;
  state.userFiles[state.activeFileIndex].userCode = full;
  state.userCode = full; // keep legacy field in sync
}

function loadPracticeFile(fi, opts) {
  if (!state.userFiles || fi >= state.userFiles.length) return;
  // Normally this persists the file we're switching AWAY from. On the very first
  // load of a RESTORED attempt there is no such file — the editor still holds the
  // empty template — so saving it wrote '' over the code initPractice just restored,
  // and the next autosave tick then persisted that loss. Skip it in that one case.
  if (!(opts && opts.restored)) savePracticeFileCode();
  state.activeFileIndex = fi;
  const file = state.userFiles[fi];
  const textarea = document.getElementById('editor-textarea');
  const preCode = document.getElementById('editor-code');
  if (!textarea || !preCode) return;

  if (_starterAnimator) _starterAnimator.abort();

  const code = file.userCode || '';
  if (!code && file.starterCode && typeof SyntaxTextAnimator !== 'undefined') {
    // Only animate on first load (no user code yet)
    state.userFiles[fi].userCode = file.starterCode;
    textarea.value = '';
    preCode.innerHTML = '<br/>';
    animateStarterCode(file.starterCode, textarea, preCode);
  } else {
    textarea.value = code;
    preCode.innerHTML = syntaxHighlight(code) + '<br/>';
  }

  if (typeof setupSpecificEditor === 'function') {
    setupSpecificEditor('editor-textarea', 'editor-pre', 'editor-code', true);
  }

  // Update boss bar for this file. Both reads go through the reconstructed
  // source: with a block collapsed the textarea is only part of the file, and
  // writing that into userCode would delete the folded lines for good.
  const handler = () => {
    const full = (typeof edFullSource === 'function') ? edFullSource(textarea) : textarea.value;
    state.userFiles[state.activeFileIndex].userCode = full;
    updateBossHealthBar(full);
  };
  textarea.removeEventListener('input', textarea._inputHandler);
  textarea._inputHandler = handler;
  textarea.addEventListener('input', handler);

  // The editor now holds the whole file — put this file's folds back on screen.
  if (typeof edFoldReapply === 'function') edFoldReapply(textarea);

  updateBossHealthBar((typeof edFullSource === 'function') ? edFullSource(textarea) : textarea.value);
  if (typeof updateLineNumbers === 'function') updateLineNumbers(textarea);
  renderPracticeFileTabs();
  textarea.focus();
}



/* Add / Rename / Delete a companion file. The dialog itself lives in
   file-dialog.js — this is only the practice page's half of the contract. */

function practiceAddFile(anchor) {
  if (!state.userFiles) return;
  savePracticeFileCode();
  openFileDialog({
    mode: 'add',
    files: state.userFiles,
    mainCode: (state.userFiles[0] || {}).userCode || '',
    canPair: true,
    anchor: anchor || document.querySelector('.file-tab-add'),
    onSubmit: (r) => {
      const made = [{ name: r.name, ext: r.ext, body: r.guard ? fdGuardText(r.name) : '' }];
      if (r.pair) made.push({ name: r.name, ext: '.c', body: fdPairText(r.name) });
      made.forEach(f => {
        if (state.userFiles.some(x => x.name === f.name && x.ext === f.ext)) return;
        state.userFiles.push({ id: generateId(), name: f.name, ext: f.ext, starterCode: '', code: '', userCode: f.body });
      });
      // Wire it in, or the new file is never part of the translation unit.
      if (r.include && state.userFiles[0]) {
        state.userFiles[0].userCode = fdInsertInclude(state.userFiles[0].userCode, r.name + r.ext);
        if (state.activeFileIndex === 0) {
          const ta = document.getElementById('editor-textarea');
          if (ta) { ta.value = state.userFiles[0].userCode; ta.dispatchEvent(new Event('input', { bubbles: true })); }
        }
      }
      loadPracticeFile(state.userFiles.length - 1);
      renderPracticeFileTabs();
    }
  });
}

function practiceRenameFile(fi, anchor) {
  if (!state.userFiles || fi >= state.userFiles.length) return;
  savePracticeFileCode();
  openFileDialog({
    mode: 'rename',
    files: state.userFiles,
    index: fi,
    anchor: anchor,
    onSubmit: (r) => {
      state.userFiles[fi].name = r.name;
      state.userFiles[fi].ext = r.ext;
      renderPracticeFileTabs();
      if (typeof _practiceAutoSave === 'function') _practiceAutoSave();
    }
  });
}

/**
 * Remove a companion file. The main file stays — every other file is optional,
 * but without main there is nothing to compile. A stray .c gets appended to the
 * translation unit, so being unable to delete one meant a single typo could
 * break every Run for the rest of the attempt.
 */
function practiceDeleteFile(fi) {
  if (!state.userFiles || fi <= 0 || fi >= state.userFiles.length) return;
  const f = state.userFiles[fi];
  const label = f.name + f.ext;
  const go = () => {
    savePracticeFileCode();          // keep edits to whatever is on screen now
    state.userFiles.splice(fi, 1);
    state.activeFileIndex = Math.max(0, Math.min(state.activeFileIndex, state.userFiles.length - 1));
    // `restored` skips loadPracticeFile's own save — the editor still holds the
    // DELETED file's text, and saving it now would write it over its neighbour.
    loadPracticeFile(state.activeFileIndex, { restored: true });
    renderPracticeFileTabs();
    if (typeof _practiceAutoSave === 'function') _practiceAutoSave();
  };
  const written = (f.userCode || '').trim().length > 0;
  if (written && typeof showConfirm === 'function') {
    showConfirm('Delete file?', `Delete ${label}? The code in it is lost, and any #include "${label}" left behind will stop the program compiling.`, go);
  } else {
    go();
  }
}


let _starterAnimAborted = false;
let _starterAnimator = null;

/** Is a starter-code fill actually running right now? */
function _starterAnimRunning() {
  return !!(_starterAnimator && _starterAnimator._aborted === false && !_starterAnimator._forceComplete);
}

/**
 * Skip the fill.
 *
 * The guard on createdAt is against the very click that opened the attempt
 * also finishing the animation before it has drawn a character.
 */
function _starterAnimSkip() {
  if (!_starterAnimRunning()) return;
  if (_starterAnimator.createdAt && (Date.now() - _starterAnimator.createdAt < 50)) return;
  _starterAnimator.complete();
}

document.addEventListener('click', (e) => {
  if (!e.target) return;
  /* THE EDITOR IS NOT AN EXCEPTION. It used to be — 'textarea' sat in this
     list — which meant clicking the one place you would naturally click while
     watching code fill itself in was the one place that did nothing. Other
     textareas still are exceptions, because clicking into the description
     editor is not a request to skip anything. */
  const inEditor = e.target.closest('#editor-textarea');
  if (!inEditor && (e.target.closest('button') || e.target.closest('select') ||
                    e.target.closest('input') || e.target.closest('textarea') ||
                    e.target.closest('.file-tab'))) {
    return;
  }
  _starterAnimSkip();
});

/* Typing skips it too, and this one is not just impatience being served: the
   fill writes the whole of textarea.value on every frame, so a keystroke
   landing mid-animation was overwritten and lost. Finishing first means what
   you typed survives. */
document.addEventListener('keydown', (e) => {
  if (!_starterAnimRunning()) return;
  if (e.key === 'Escape' || e.key === 'Tab') return;   // leaving or moving on, not typing
  _starterAnimSkip();
}, true);

/** MiSide-style animation for starter code appearing in the editor (DOM-safe) */
async function animateStarterCode(code, textarea, preCode) {
  _starterAnimAborted = false;

  // Abort any previous animator
  if (_starterAnimator) _starterAnimator.abort();

  if (typeof SyntaxTextAnimator !== 'undefined') {
    _starterAnimator = new SyntaxTextAnimator({
      speed: 18,
      onProgress: (typed) => {
        updateBossHealthBar(typed);
        if (typeof updateLineNumbers === 'function') updateLineNumbers(textarea);
      },
      onComplete: () => {
        if (typeof state !== 'undefined') state.userCode = code;
        updateBossHealthBar(code);
        if (typeof updateLineNumbers === 'function') updateLineNumbers(textarea);
      }
    });
    _starterAnimator.createdAt = Date.now();

    // Sync state as animation progresses
    await _starterAnimator.animate(code, preCode, textarea, syntaxHighlight);
    /* Released once it is over. Neither _aborted nor _forceComplete is set by
       a natural finish, so without this the animator sat there looking like a
       live one and every later click called complete() on a corpse. */
    _starterAnimator = null;
  } else {
    // Fallback if animation class is missing
    textarea.value = code;
    preCode.innerHTML = syntaxHighlight(code) + '<br/>';
  }

  if (!_starterAnimAborted && typeof state !== 'undefined') {
    state.userCode = code;
  }
}

/**
 * Write the clock. Counting UP is a stopwatch, so it gets a millisecond field;
 * counting DOWN reads better as whole seconds (a countdown's last digits are
 * just noise, and the auto-submit fires on the second anyway).
 *
 * The ms live in their own element rather than the same string so they can be
 * styled down — three digits at full weight dominated the topbar.
 */
function _paintTimer(el, main, ms) {
  const split = el.children.length === 2 && el.firstElementChild.classList.contains('timer-main');
  if (ms == null) {
    if (split) el.textContent = main;
    else if (el.textContent !== main) el.textContent = main;
    return;
  }
  if (!split) el.innerHTML = '<span class="timer-main"></span><span class="timer-ms"></span>';
  const [a, b] = el.children;
  if (a.textContent !== main) a.textContent = main;
  const msText = '.' + String(ms).padStart(3, '0');
  if (b.textContent !== msText) b.textContent = msText;
}

/**
 * Counting up refreshes ~30×/s so the millisecond field actually moves; a
 * countdown only changes once a second, so it stays on a 1 s tick.
 */
function _practiceStartTimerTicker() {
  if (window.activeTimerInterval) clearInterval(window.activeTimerInterval);
  const countingDown = !!(state.sessionData && state.sessionData.timeLimit > 0);
  updatePracticeTimerDisplay();
  window.activeTimerInterval = setInterval(updatePracticeTimerDisplay, countingDown ? 1000 : 33);
}

function updatePracticeTimerDisplay() {
  if (!state.sessionData) {
    if (window.activeTimerInterval) clearInterval(window.activeTimerInterval);
    return;
  }
  if (state.sessionData.paused) return;

  const elapsedMs = Date.now() - state.sessionData.startTime;
  const elapsed = Math.floor(elapsedMs / 1000);
  const displayEl = document.getElementById('practice-timer');
  if (!displayEl) return;

  if (state.sessionData.timeLimit > 0) {
    const remaining = state.sessionData.timeLimit - elapsed;
    if (remaining <= 0) {
      _paintTimer(displayEl, '00:00', null);
      displayEl.classList.add('timer-expired');
      displayEl.classList.remove('timer-warning');
      if (window.activeTimerInterval) clearInterval(window.activeTimerInterval);
      _showTimesUpFlash();
      submitCode();
    } else {
      _paintTimer(displayEl, formatTimeDisplay(remaining), null);
      displayEl.classList.remove('timer-expired');
      // Last-minute warning: pulse the timer so the user notices time slipping
      displayEl.classList.toggle('timer-warning', remaining <= 60);
    }
  } else {
    _paintTimer(displayEl, formatTimeDisplay(elapsed), elapsedMs % 1000);
    displayEl.classList.remove('timer-expired', 'timer-warning');
  }
}

/* ── Right-click the clock to change the timer mid-attempt ──────
   The timer is chosen once in the Session Setup dialog before the attempt
   starts, which left no way to switch to a countdown (or clear one) without
   abandoning the attempt. */

function _timerMenuClose() {
  const el = document.getElementById('timer-menu');
  if (el) el.remove();
  document.removeEventListener('mousedown', _timerMenuOutside, true);
  document.removeEventListener('keydown', _timerMenuKey, true);
}

function _timerMenuOutside(e) {
  const el = document.getElementById('timer-menu');
  if (!el) return;
  // A press on the clock itself is the toggle. Without this exemption the
  // right-click closed the menu here on mousedown and openTimerMenu then
  // reopened it on contextmenu, so it never appeared to close.
  if (e.target.closest && e.target.closest('.timer-display')) return;
  if (!el.contains(e.target)) _timerMenuClose();
}

function _timerMenuKey(e) {
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); _timerMenuClose(); }
}

/** @param {MouseEvent} e right-click on the timer chip */
function openTimerMenu(e) {
  if (e) e.preventDefault();
  if (!state.sessionData) return;
  // Right-clicking again is "put it away", not "open it a second time".
  if (document.getElementById('timer-menu')) { _timerMenuClose(); return; }

  const limit = state.sessionData.timeLimit || 0;
  const h = Math.floor(limit / 3600), m = Math.floor((limit % 3600) / 60), s = limit % 60;
  const mode = limit > 0 ? 'down' : 'up';

  const el = document.createElement('div');
  el.id = 'timer-menu';
  el.className = 'timer-menu';
  el.innerHTML = `
    <div class="timer-menu-title"><i data-lucide="timer" style="width:13px;height:13px;"></i> Timer</div>
    <div class="timer-menu-modes" role="radiogroup" aria-label="Timer mode">
      <button type="button" class="timer-mode${mode === 'up' ? ' active' : ''}" data-mode="up" role="radio" aria-checked="${mode === 'up'}">
        <i data-lucide="arrow-up-circle" style="width:13px;height:13px;"></i> Count up
      </button>
      <button type="button" class="timer-mode${mode === 'down' ? ' active' : ''}" data-mode="down" role="radio" aria-checked="${mode === 'down'}">
        <i data-lucide="arrow-down-circle" style="width:13px;height:13px;"></i> Countdown
      </button>
    </div>
    <div class="timer-menu-fields" id="timer-menu-fields">
      <label>H <input type="number" id="tm-h" min="0" max="23" value="${h}"></label>
      <label>M <input type="number" id="tm-m" min="0" max="59" value="${m}"></label>
      <label>S <input type="number" id="tm-s" min="0" max="59" value="${s}"></label>
    </div>
    <div class="timer-menu-presets" id="timer-menu-presets">
      ${[5, 15, 30, 60].map(mins => `<button type="button" class="timer-preset" data-mins="${mins}">${mins < 60 ? mins + 'm' : '1h'}</button>`).join('')}
    </div>
    <label class="timer-menu-restart">
      <input type="checkbox" id="tm-restart"> Restart the clock from zero
    </label>
    <p class="timer-menu-note" id="tm-note"></p>
    <div class="timer-menu-actions">
      <button type="button" class="btn btn-ghost btn-sm" id="tm-cancel">Cancel</button>
      <button type="button" class="btn btn-primary btn-sm" id="tm-apply">Apply</button>
    </div>`;
  document.body.appendChild(el);

  // Anchor under the clock, clamped to the viewport so it can't run off-screen.
  const anchor = (e && e.currentTarget && e.currentTarget.getBoundingClientRect)
    ? e.currentTarget.getBoundingClientRect()
    : { left: window.innerWidth - 280, bottom: 56 };
  const w = el.offsetWidth;
  el.style.left = Math.max(8, Math.min(anchor.left, window.innerWidth - w - 8)) + 'px';
  el.style.top = (anchor.bottom + 8) + 'px';

  let picked = mode;
  const fields = el.querySelector('#timer-menu-fields');
  const presets = el.querySelector('#timer-menu-presets');
  const restart = el.querySelector('#tm-restart');
  const note = el.querySelector('#tm-note');

  const paint = () => {
    const down = picked === 'down';
    fields.classList.toggle('disabled', !down);
    presets.classList.toggle('disabled', !down);
    fields.querySelectorAll('input').forEach(i => { i.disabled = !down; });
    presets.querySelectorAll('button').forEach(b => { b.disabled = !down; });
    el.querySelectorAll('.timer-mode').forEach(b => {
      const on = b.dataset.mode === picked;
      b.classList.toggle('active', on);
      b.setAttribute('aria-checked', String(on));
    });
    note.textContent = down
      ? (restart.checked
        ? 'The countdown starts now with the full time.'
        : 'The countdown continues from the time already spent — it may end immediately.')
      : (restart.checked
        ? 'The stopwatch starts again from 00:00.'
        : 'The stopwatch keeps the time already spent.');
  };

  el.querySelectorAll('.timer-mode').forEach(b => {
    b.onclick = () => {
      picked = b.dataset.mode;
      // A countdown measured from an attempt already underway would usually be
      // over before it started, so default that switch to a fresh clock.
      if (picked === 'down' && mode !== 'down') restart.checked = true;
      paint();
    };
  });
  presets.querySelectorAll('.timer-preset').forEach(b => {
    b.onclick = () => {
      const mins = parseInt(b.dataset.mins, 10);
      el.querySelector('#tm-h').value = Math.floor(mins / 60);
      el.querySelector('#tm-m').value = mins % 60;
      el.querySelector('#tm-s').value = 0;
    };
  });
  restart.onchange = paint;
  el.querySelector('#tm-cancel').onclick = _timerMenuClose;
  el.querySelector('#tm-apply').onclick = () => {
    const secs = picked === 'down'
      ? (parseInt(el.querySelector('#tm-h').value, 10) || 0) * 3600 +
        (parseInt(el.querySelector('#tm-m').value, 10) || 0) * 60 +
        (parseInt(el.querySelector('#tm-s').value, 10) || 0)
      : 0;
    applyPracticeTimer(secs, restart.checked);
    _timerMenuClose();
  };

  paint();
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: el });
  document.addEventListener('mousedown', _timerMenuOutside, true);
  document.addEventListener('keydown', _timerMenuKey, true);
  const first = el.querySelector('.timer-mode.active');
  if (first) first.focus();
}

/**
 * @param {number} seconds 0 counts up, anything else counts down from there
 * @param {boolean} restart start the clock again from zero
 */
function applyPracticeTimer(seconds, restart) {
  if (!state.sessionData) return;
  state.sessionData.timeLimit = seconds;
  state.timeLimit = seconds;
  setSessionParam('timeLimit', seconds);

  if (restart) {
    state.sessionData.startTime = Date.now();
    // A paused clock must not bank the time it spent paused before the reset.
    if (state.sessionData.paused) state.sessionData.pausedAt = state.sessionData.startTime;
    setSessionParam('practiceStartTime', state.sessionData.startTime);
  }

  const displayEl = document.getElementById('practice-timer');
  if (displayEl) {
    displayEl.classList.remove('timer-expired', 'timer-warning');
    displayEl.textContent = '';       // drop the old structure so _paintTimer rebuilds
  }
  // Paused stays paused: applying a setting shouldn't secretly resume the clock.
  if (state.sessionData.paused) {
    if (displayEl) displayEl.innerText = 'PAUSED';
    return;
  }
  _practiceStartTimerTicker();
}

/** Brief full-screen "TIME'S UP" flash shown right before the auto-submit result. */
function _showTimesUpFlash() {
  let el = document.getElementById('times-up-flash');
  if (el) el.remove();
  el = document.createElement('div');
  el.id = 'times-up-flash';
  el.className = 'times-up-flash';
  el.innerHTML = '<span>TIME\'S UP</span>';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

async function submitCode() {
  if (!state.activeVariant) return;
  if (_submitInProgress) return;
  _submitInProgress = true;

  // Disable submit button visually
  const submitBtn = _practiceSubmitBtn();
  if (submitBtn) { submitBtn.disabled = true; submitBtn.style.opacity = '0.6'; }

  _practiceSubmitted = true;
  if (typeof psfxWorkStop === 'function') psfxWorkStop();
  if (typeof psfxPowerUp === 'function') psfxPowerUp();
  if (window.activeTimerInterval) clearInterval(window.activeTimerInterval);
  if (_autoSaveInterval) { clearInterval(_autoSaveInterval); _autoSaveInterval = null; }
  clearSessionParam('autoSavedFiles');
  clearSessionParam('practiceStartTime');

  // Save the currently active file's code
  savePracticeFileCode();

  const variant = state.activeVariant;
  const files = variant.files && variant.files.length > 0 ? variant.files : null;

  // Build per-file diffs array: [{ fileName, diffs }]
  let allFileDiffs = [];
  let totalScore = 0, totalLines = 0;

  // Each entry carries the RAW sources as well as the diff rows: the solution
  // page re-diffs from them when you change the comparison options, and copies
  // from them — rebuilding source out of diff rows loses comments and blank
  // lines and gives you something that doesn't compile.
  if (files && state.userFiles) {
    files.forEach((targetFile, fi) => {
      const userFile = state.userFiles.find(uf => uf.name === targetFile.name && uf.ext === targetFile.ext) ||
                       state.userFiles[fi] || { userCode: '' };
      const userCode = userFile.userCode || '';
      const expectedCode = targetFile.code || '';
      const { diffs, scoreCount, cLinesLen } = computeDiffs(userCode, expectedCode);
      allFileDiffs.push({
        fileName: targetFile.name + targetFile.ext,
        name: targetFile.name, ext: targetFile.ext,
        diffs, userCode, expectedCode
      });
      totalScore += scoreCount;
      totalLines += cLinesLen;
    });
  } else {
    const textarea = document.getElementById('editor-textarea');
    if (textarea) state.userCode = textarea.value;
    const expectedCode = variant.code || '';
    const { diffs, scoreCount, cLinesLen } = computeDiffs(state.userCode, expectedCode);
    allFileDiffs.push({
      fileName: 'main.c', name: 'main', ext: '.c',
      diffs, userCode: state.userCode || '', expectedCode
    });
    totalScore += scoreCount;
    totalLines += cLinesLen;
  }

  const percentage = totalLines > 0 ? Math.round((totalScore / totalLines) * 100) : 0;

  // ── Grading ──
  // Finishing an attempt NEVER compiles or runs anything: test cases are run on
  // demand with "Check Code", so the results modal opens immediately. If the last
  // manual check still matches the code being submitted we reuse its pass rate
  // (nothing is re-run); otherwise the score is the reference-code match.
  let testResults = null;
  let scoreBasis = 'reference';
  let baseScore = percentage;

  const cachedCheck = _practiceCheck;
  if (cachedCheck && cachedCheck.codeKey != null && cachedCheck.codeKey === _buildSubmissionSource() &&
      Array.isArray(cachedCheck.tests) && cachedCheck.tests.length > 0) {
    // testScore is the tests-only pass rate (check.passed/total also folds in
    // the minimum-requirement checks, which aren't part of the score).
    testResults = cachedCheck.tests.filter(Boolean);
    baseScore = typeof cachedCheck.testScore === 'number' ? cachedCheck.testScore : percentage;
    scoreBasis = 'tests';
  }

  const hintPenalty = (state.sessionData.hintsUsed || 0) * 5;
  const finalPercentage = Math.max(0, Math.min(baseScore, 100) - hintPenalty);
  const isPerfect = finalPercentage === 100;
  const submitTime = Date.now();
  const durationSeconds = Math.round((submitTime - state.sessionData.startTime) / 1000);
  const primaryUserCode = state.userFiles ? (state.userFiles[0]?.userCode || '') : state.userCode;

  const attemptCounter = (state.activeAttempts[state.activeChallenge.id] || 0) + 1;

  // FIX: Capture all files safely instead of just file[0]
  const savedUserFiles = state.userFiles ? JSON.parse(JSON.stringify(state.userFiles)) : null;
  const savedTargetFiles = variant.files ? JSON.parse(JSON.stringify(variant.files)) : null;

  const historyEntry = {
    id: generateId(),
    challengeId: state.activeChallenge.id,
    challengeTitle: `${state.activeChallenge.title} - ${state.activeVariant.name}`,
    // Stored explicitly so analytics never has to parse it back out of the title.
    variantName: state.activeVariant.name || '',
    category: (() => { const folder = state.nodes.find(n => n.id === state.activeChallenge.parentId); return folder ? folder.name : 'Uncategorized'; })(),
    date: new Date().toLocaleDateString(),
    startTime: state.sessionData.startTime,
    submitTime: submitTime,
    duration: durationSeconds,
    score: finalPercentage,
    attemptNumber: attemptCounter,
    
    // FIX: Store the arrays instead of a single string, fallback to strings for legacy
    userCode: primaryUserCode,
    expectedCode: variant.files ? variant.files[0]?.code || '' : variant.code || '',
    userFiles: savedUserFiles,     // NEW: Required to prevent data loss in history
    targetFiles: savedTargetFiles, // NEW: Required to prevent data loss in history
    scoreBasis: scoreBasis,
    testsPassed: testResults ? testResults.filter(r => r.passed).length : null,
    testsTotal: testResults ? testResults.length : null
  };

  // Gamification badges
  const earnedBadges = [];
  const hour = new Date().getHours();
  if (!state.badges) state.badges = [];
  if (isPerfect && attemptCounter === 1 && !state.badges.includes('Flawless')) { state.badges.push('Flawless'); earnedBadges.push({ name: 'Flawless', icon: '🎯', desc: '100% on First Try' }); }
  if (isPerfect && durationSeconds < 60 && !state.badges.includes('Speed Demon')) { state.badges.push('Speed Demon'); earnedBadges.push({ name: 'Speed Demon', icon: '⚡', desc: 'Perfect in Under 60s' }); }
  if ((hour >= 22 || hour < 4) && !state.badges.includes('Night Owl')) { state.badges.push('Night Owl'); earnedBadges.push({ name: 'Night Owl', icon: '🦉', desc: 'Late Night Coder' }); }
  if (attemptCounter >= 5 && !state.badges.includes('Persistent')) { state.badges.push('Persistent'); earnedBadges.push({ name: 'Persistent', icon: '💪', desc: '5+ Attempts on One Challenge' }); }
  if (state.history.length >= 49 && !state.badges.includes('Marathoner')) { state.badges.push('Marathoner'); earnedBadges.push({ name: 'Marathoner', icon: '🏃', desc: '50+ Total Submissions' }); }

  state.history.unshift(historyEntry);
  state.activeAttempts[state.activeChallenge.id] = isPerfect ? 0 : attemptCounter;
  _practiceClearDraft();   // graded: the draft is not wanted on the next visit
  // Spaced-repetition: schedule the next review based on this attempt's score.
  if (typeof recordReview === 'function') recordReview('challenge', state.activeChallenge.id, finalPercentage);
  // Quest penalties: a verified completion (≥ threshold) auto-clears matching penalties.
  if (window.questPenalty && window.questPenalty.notifyActivity) {
    window.questPenalty.notifyActivity('coding', state.activeChallenge.id, finalPercentage);
  }
  state.lastDiffs = allFileDiffs[0]?.diffs || []; // legacy single-file compat
  state.lastFileDiffs = allFileDiffs;
  saveData();

  setSessionParam('lastDiffs', allFileDiffs[0]?.diffs || []);
  setSessionParam('lastFileDiffs', allFileDiffs);

  const perFileScores = allFileDiffs.map((fd) => {
    const fileDiffLines = fd.diffs || [];
    const totalL = fileDiffLines.length || 1;
    const matchedL = fileDiffLines.filter(d => d.status === 'perfect').length;
    return { name: fd.fileName, score: Math.round((matchedL / totalL) * 100) };
  });
  const prevLogs = state.history.filter(h => h.challengeId === state.activeChallenge.id && h.id !== historyEntry.id);
  const prevScore = prevLogs.length > 0 ? prevLogs[0].score : null;
  const bestScore = prevLogs.length > 0 ? Math.max(...prevLogs.map(l => l.score || 0), finalPercentage) : finalPercentage;

  // Everything the solution page needs to introduce this attempt — it has no
  // other way to know what you scored or how long it took.
  setSessionParam('solutionSummary', {
    challengeId: state.activeChallenge.id,
    variantId: state.activeVariant.id,
    title: state.activeChallenge.title,
    variantName: state.activeVariant.name || '',
    historyId: historyEntry.id,
    score: finalPercentage,
    referenceScore: percentage,
    scoreBasis,
    duration: durationSeconds,
    attemptNumber: attemptCounter,
    prevScore,
    bestScore,
    hintsUsed: state.sessionData.hintsUsed || 0,
    testsPassed: historyEntry.testsPassed,
    testsTotal: historyEntry.testsTotal,
    ts: submitTime
  });
  setSessionParam('solutionChallengeId', state.activeChallenge.id);

  try {
    if (typeof showResultModal === 'function') showResultModal({
      score: finalPercentage,
      isPerfect,
      earnedBadges,
      perFileScores,
      duration: durationSeconds,
      linesMatched: totalScore,
      linesTotal: totalLines,
      attemptNumber: attemptCounter,
      prevScore,
      hintsUsed: state.sessionData.hintsUsed || 0,
      testResults: testResults,
      scoreBasis: scoreBasis,
      referenceScore: percentage
    });
  } finally {
    // Always re-enable submit — a render error here used to leave the button stuck
    const submitBtnPost = _practiceSubmitBtn();
    if (submitBtnPost) { submitBtnPost.disabled = false; submitBtnPost.style.opacity = ''; }
    _submitInProgress = false;
  }
}

function retryPractice() {
  _starterAnimAborted = true;
  if (_starterAnimator) _starterAnimator.abort();
  if (typeof closeResultModal === 'function') closeResultModal();

  const variant = state.activeVariant;
  if (!variant) return;

  // Reset all files to starter code
  if (state.userFiles) {
    state.userFiles = variant.files ? variant.files.map(f => ({ ...f, userCode: f.starterCode || '' })) :
                      [{ id: generateId(), name: 'main', ext: '.c', starterCode: variant.starterCode || '', code: variant.code || '', userCode: variant.starterCode || '' }];
    state.activeFileIndex = 0;
  }
  state.userCode = variant.files ? (variant.files[0]?.starterCode || '') : (variant.starterCode || '');

  const textarea = document.getElementById('editor-textarea');
  const preCode = document.getElementById('editor-code');
  const starterCode = state.userCode;

  // A fresh attempt: the old folds describe code that no longer exists.
  if (typeof edFoldReset === 'function') edFoldReset();

  if (starterCode && typeof SyntaxTextAnimator !== 'undefined') {
    textarea.value = '';
    preCode.innerHTML = '<br/>';
    animateStarterCode(starterCode, textarea, preCode);
  } else {
    textarea.value = starterCode;
    preCode.innerHTML = typeof syntaxHighlight === 'function' ? syntaxHighlight(starterCode) + '<br/>' : starterCode + '<br/>';
  }

  renderPracticeFileTabs();
  state.sessionData.startTime = Date.now();
  state.sessionData.attemptsThisSession++;

  // A retry is a FRESH attempt: clear the hint penalty and re-arm the hint UI.
  // Without this the new attempt was still docked 5% per hint revealed during the
  // previous one, and the button stayed stuck on "All hints revealed".
  _resetHintsForNewAttempt();

  // The previous attempt's Check results / restore points don't describe this code.
  _practiceCheck = null;
  _practiceExecs = [];
  if (typeof renderPracticePanel === 'function') renderPracticePanel();

  _practiceStartTimerTicker();

  if (_autoSaveInterval) clearInterval(_autoSaveInterval);
  _autoSaveInterval = setInterval(_practiceAutoSave, 30000);

  // Fresh attempt: reset the persisted timer anchor too
  setSessionParam('practiceStartTime', state.sessionData.startTime);
  clearSessionParam('autoSavedFiles');

  _submitInProgress = false;
  _practiceSubmitted = false;
  updateBossHealthBar(textarea.value);
  textarea.focus();
}

// Strip comments + whitespace so the health bar measures real code similarity,
// matching how submissions are actually graded (computeDiffs strips comments too).
// Otherwise comments would move the boss health bar.
function _bossNormalize(code) {
  const stripped = (typeof stripComments === 'function') ? stripComments(code || '') : (code || '');
  return stripped.replace(/\s+/g, '');
}

let _bossBarDebounce = null;

/** Debounced wrapper: the similarity check is an O(n·m) LCS over the whole
    file — running it on every keystroke made typing janky in larger files. */
function updateBossHealthBar(currentCode) {
  clearTimeout(_bossBarDebounce);
  _bossBarDebounce = setTimeout(() => _updateBossHealthBarNow(currentCode), 120);
}

function _updateBossHealthBarNow(currentCode) {
  const bar = document.getElementById('boss-health-bar');
  if (!bar || !state.activeVariant) return;

  // 1. Ensure the currently typing file is updated in the state BEFORE calculating global health
  if (state.userFiles && state.activeFileIndex !== undefined) {
    state.userFiles[state.activeFileIndex].userCode = currentCode;
  }

  let totalSim = 0;
  let totalWeight = 0;

  // 2. Aggregate similarity across ALL files in the challenge
  if (state.activeVariant.files && state.activeVariant.files.length > 0 && state.userFiles) {
    state.activeVariant.files.forEach((targetFile, index) => {
      const userFile = state.userFiles.find(uf => uf.name === targetFile.name && uf.ext === targetFile.ext) || state.userFiles[index];
      const uCode = userFile ? (userFile.userCode || '') : '';
      const tCode = targetFile.code || '';
      
      // Normalize by stripping comments + whitespace so neither indentation nor
      // comments move the health bar.
      const normalizedCurrent = _bossNormalize(uCode);
      const normalizedTarget = _bossNormalize(tCode);

      const weight = normalizedTarget.length || 1;
      let sim = 0;
      if (typeof calculateSimilarity === 'function') {
        sim = calculateSimilarity(normalizedCurrent, normalizedTarget);
      } else {
        sim = normalizedCurrent === normalizedTarget ? 1 : 0;
      }
      
      totalSim += (sim * weight);
      totalWeight += weight;
    });
  } else {
    // Legacy single-file fallback
    const targetCode = state.activeVariant.code || '';
    if (!targetCode) return;

    const normalizedCurrent = _bossNormalize(currentCode);
    const normalizedTarget = _bossNormalize(targetCode);

    totalWeight = normalizedTarget.length || 1;
    let sim = 0;
    if (typeof calculateSimilarity === 'function') {
      sim = calculateSimilarity(normalizedCurrent, normalizedTarget);
    } else {
      sim = normalizedCurrent === normalizedTarget ? 1 : 0;
    }
    totalSim = sim * totalWeight;
  }

  // 3. Calculate final global percentage.
  // totalWeight is the reference's significant-character count — that IS the
  // boss's max HP, so the readout counts real characters left to match.
  const overallSim = totalWeight > 0 ? (totalSim / totalWeight) : 0;
  const healthPercent = Math.max(0, 100 - (overallSim * 100));

  _bossBarPaint(healthPercent, { maxHp: totalWeight });
}

/* ============================================================
   SAO BOSS HEALTH BAR
   ------------------------------------------------------------
   Sword Art Online-style boss nameplate that lives in the topbar of both
   attempt pages: a glowing crystal marker, an angular gunmetal plate with the
   boss name, a segmented HP track with a lagging "damage ghost", and a readout
   box showing HP numbers + percent.

   The boss's HP is the INVERSE of how close your code is to the reference —
   you damage it by writing the solution, and it shatters at 0.
   ============================================================ */

/** Hue of a full HP bar — a vivid true green. Ramps to 0 (red) as HP drains. */
const BOSS_FULL_HUE = 118;
/** Program levels run 1–100 (set per-program in the Coding Library admin). */
const BOSS_MAX_LEVEL = 100;
let _bossMaxHp = 0;      // characters in the reference solution — set by the painter
let _bossGhostTimer = null;  // holds the red damage chunk before it recedes
let _bossShatterAt = 0;      // last break, so a flicker at 0 HP can't stack them

/**
 * Markup for the boss bar, shared by the practice and practice-set templates so
 * the two can never drift apart. The ids are the contract with the painter:
 *   #boss-crystal        — the marker gem (leftmost, hidden with the bar)
 *   #boss-health-wrapper — the nameplate, shown/hidden by the toggle
 *   #boss-health-bar     — the fill (width + --sao-hue drive the look)
 *   #boss-health-hp      — the "current / max" HP numbers
 *   #boss-health-lv      — the program's level
 */
/**
 * The crystal is built as a bipyramid out of BLADES intersecting planes, each
 * rotated 180/BLADES degrees about the vertical axis. A single plane (or even
 * two at 90°) collapses to a hairline as it turns edge-on, which reads as the
 * gem shrinking; four planes keep the silhouette within ~8% of full width
 * through a whole revolution, so it reads as a solid turning in place.
 */
function bossCrystalTemplate() {
  const BLADES = 4;
  const defs = `
    <defs>
      <linearGradient id="saoGemLight" x1="0" y1="0" x2="0.85" y2="1">
        <stop offset="0%" stop-color="#ffe1ec"/>
        <stop offset="38%" stop-color="#ff5f93"/>
        <stop offset="100%" stop-color="#d40049"/>
      </linearGradient>
      <linearGradient id="saoGemDark" x1="1" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#e82a66"/>
        <stop offset="55%" stop-color="#9d0033"/>
        <stop offset="100%" stop-color="#4c001a"/>
      </linearGradient>
      <linearGradient id="saoGemBase" x1="0.5" y1="0" x2="0.5" y2="1">
        <stop offset="0%" stop-color="#f04378"/>
        <stop offset="70%" stop-color="#8d002e"/>
        <stop offset="100%" stop-color="#ffc3d8"/>
      </linearGradient>
    </defs>`;

  let blades = '';
  for (let i = 0; i < BLADES; i++) {
    const angle = (180 / BLADES) * i;          // 0°, 45°, 90°, 135°
    // Planes off the primary axis sit narrower and darker, so the intersections
    // read as facets rather than four identical diamonds stacked up.
    const half = i % 2 === 0 ? 12 : 8;
    const dim = i % 2 === 0 ? '' : ' style="opacity:0.9;"';
    blades += `
      <div class="sao-crystal-blade" style="transform: rotateY(${angle}deg);">
        <svg class="sao-crystal-gem"${dim} viewBox="0 0 24 40" preserveAspectRatio="xMidYMid meet">
          ${i === 0 ? defs : ''}
          <polygon points="12,0 ${12 - half},14 12,19" fill="url(#saoGemLight)"/>
          <polygon points="12,0 ${12 + half},14 12,19" fill="url(#saoGemDark)"/>
          <polygon points="${12 - half},14 12,19 12,40" fill="url(#saoGemDark)"/>
          <polygon points="${12 + half},14 12,19 12,40" fill="url(#saoGemBase)"/>
          <path d="M12 0 L${12 - half} 14 L12 40 L${12 + half} 14 Z M${12 - half} 14 L${12 + half} 14"
                fill="none" stroke="rgba(255,225,238,0.5)" stroke-width="0.7" stroke-linejoin="round"/>
          ${i === 0 ? '<polygon class="sao-crystal-shine" points="12,2.5 4,13.4 12,16.5" fill="#fff"/>' : ''}
        </svg>
      </div>`;
  }

  return `
    <div class="sao-crystal" id="boss-crystal" aria-hidden="true" style="display:none;">
      <div class="sao-crystal-spin">${blades}</div>
    </div>`;
}

function bossBarTemplate() {
  return `
    <div class="sao-boss" id="boss-health-wrapper" role="img" aria-label="Boss health" style="display:none;">
      <span class="sao-plate-cap" aria-hidden="true"></span>
      <div class="sao-plate">
        <span class="sao-plate-name" id="boss-plate-name"></span>
        <div class="sao-track">
          <div class="sao-well">
            <div class="sao-ghost" id="boss-health-ghost"></div>
            <div class="sao-fill" id="boss-health-bar"></div>
            <div class="sao-best" id="boss-best-mark" title="Lowest HP you've driven this boss to"></div>
            <div class="sao-ticks" aria-hidden="true"></div>
            <div class="sao-gloss" aria-hidden="true"></div>
          </div>
        </div>
      </div>
      <div class="sao-combo" id="boss-combo" aria-hidden="true"></div>
      <div class="sao-readout">
        <span class="sao-hp" id="boss-health-hp">— / —</span>
        <span class="sao-lv" id="boss-health-lv" onclick="bossPromptLevel()" title="Click to set this program's level">LV. 1</span>
      </div>
    </div>`;
}

/** Show/hide the crystal + nameplate together (they're siblings in the topbar). */
function bossSetVisible(on) {
  const crystal = document.getElementById('boss-crystal');
  const wrap = document.getElementById('boss-health-wrapper');
  if (crystal) crystal.style.display = on ? '' : 'none';
  if (wrap) wrap.style.display = on ? '' : 'none';
  // The difficulty badge and the boss plate compete for the same strip of
  // topbar, so the badge only appears when the bar is switched off.
  const center = document.querySelector('.practice-topbar-center');
  if (center) center.classList.toggle('boss-on', !!on);
}

function bossIsVisible() {
  const wrap = document.getElementById('boss-health-wrapper');
  return !!wrap && wrap.style.display !== 'none';
}

/**
 * HP still on the clock, in reference characters — the number the readout shows.
 * This, not a percentage, is what decides whether the boss is alive: rounding
 * means a fraction of a percent can still be a whole character of HP.
 */
function _bossHpLeft(pct) {
  const p = Math.max(0, Math.min(100, pct));
  if (_bossMaxHp > 0) return Math.round((_bossMaxHp * p) / 100);
  return p <= 0.5 ? 0 : 1;      // no character count yet — fall back to percent
}

/** LV. cell in the readout — the program's level (1–100), set per-program in Admin. */
function bossSetLevel(level) {
  const lvEl = document.getElementById('boss-health-lv');
  if (!lvEl) return;
  const n = parseInt(level, 10);
  lvEl.textContent = n > 0 ? 'LV. ' + Math.min(n, BOSS_MAX_LEVEL) : 'LV. —';
  lvEl.classList.toggle('unset', !(n > 0));
}

/** The name plate at the left of the bar — the program's alias, or its title. */
function bossSetName(text) {
  const el = document.getElementById('boss-plate-name');
  if (!el) return;
  const name = (text || '').trim();
  el.textContent = name;
  el.title = name;
  el.style.display = name ? '' : 'none';
}

/** Click the LV. cell to set the level without going to Admin. */
function bossPromptLevel() {
  const ch = state.activeChallenge;
  if (!ch || typeof showInputDialog !== 'function') return;
  const current = (typeof getProgramLevel === 'function' ? getProgramLevel(ch) : null);
  // Suggest a level scaled off the reference size when there isn't one yet.
  const suggested = current || Math.max(1, Math.min(BOSS_MAX_LEVEL, Math.round((_bossMaxHp || 25) / 25)));
  showInputDialog('Boss level',
    `1–${BOSS_MAX_LEVEL}. Shows as the LV. badge and groups this program in the Coding Library.`,
    'e.g. 12', String(suggested), (val) => {
      const n = parseInt(val, 10);
      ch.level = n > 0 ? Math.min(n, BOSS_MAX_LEVEL) : null;
      saveData();
      bossSetLevel(ch.level);
      if (typeof toast === 'function') {
        toast(ch.level ? `Level set to ${ch.level}.` : 'Level cleared.', { type: 'success' });
      }
    });
}

/* ── Combo counter ─────────────────────────────────────────────
   The chip types itself in a letter at a time and comes apart when it goes,
   after the dialogue in MiSide. Every character is its own span so it can be
   animated on its own; the chip used to be one text node that faded.
   ------------------------------------------------------------ */
let _bossCombo = 0;
let _bossComboTimer = null;
let _bossComboClear = null;

const COMBO_STEP_MS = 45;     // gap between letters landing
const COMBO_HOLD_MS = 2200;   // how long the finished line sits there
const COMBO_FLY_MS = 700;     // one letter: jump, then tumble away
/* The gap between letters LEAVING. It was 18ms, which is below the point
   where the eye reads a sequence — eight letters inside 150ms is one event,
   and the line appeared to burst rather than come apart. At 70ms you watch it
   happen letter by letter, which is the whole idea. */
const COMBO_EXIT_STEP_MS = 70;

/**
 * Write the chip one letter at a time.
 *
 * The "leading letter is bigger" part is not a special case and there is no
 * code for it: every letter starts oversized and shrinks over 300ms while the
 * next one starts 45ms later, so whichever arrived last is always the largest
 * thing on screen. It falls out of the stagger.
 */
function _bossComboWrite(el, text) {
  clearTimeout(_bossComboClear);
  el.classList.remove('leaving');
  el.innerHTML = '';
  Array.from(text).forEach((ch, i) => {
    const s = document.createElement('span');
    s.className = 'cl';
    s.textContent = ch;
    s.style.animationDelay = (i * COMBO_STEP_MS) + 'ms';
    el.appendChild(s);
  });
  el.classList.add('show');
}

/**
 * The exit: each letter jumps, then falls apart, one after another.
 *
 * The jump belongs to the LETTER, not the line. Hopping the whole chip and
 * then scattering it is one movement followed by another; giving each letter
 * its own little launch is what makes the word look like it is coming apart
 * rather than being thrown.
 *
 * Each letter gets its own drift, spin and scale rather than a shared one, so
 * the same combo value never comes apart the same way twice. Letters mostly
 * drop, a few go up, and they spread outward from the middle of the word —
 * dir is the letter's position either side of centre.
 */
function _bossComboScatter(el) {
  if (!el || !el.classList.contains('show')) return;
  // Already coming apart. Re-running would re-roll every letter and restart
  // the flight from the top, which reads as the word snapping back together.
  if (el.classList.contains('leaving')) return;
  clearTimeout(_bossComboTimer);
  el.classList.add('leaving');
  const letters = el.querySelectorAll('.cl');
  const last = Math.max(1, letters.length - 1);
  letters.forEach((s, i) => {
    const dir = (i / last) - 0.5;
    s.style.setProperty('--dx', (dir * 2.8 + (Math.random() - 0.5) * 1.4).toFixed(2) + 'em');
    s.style.setProperty('--dy', (Math.random() < 0.28
      ? -(0.6 + Math.random() * 1.1)
      : (1 + Math.random() * 2.2)).toFixed(2) + 'em');
    s.style.setProperty('--rot', ((Math.random() - 0.5) * 280).toFixed(0) + 'deg');
    s.style.setProperty('--sc', (0.7 + Math.random() * 0.5).toFixed(2));
    s.style.animationDelay = (i * COMBO_EXIT_STEP_MS) + 'ms';
    s.classList.add('fly');
  });
  _bossComboClear = setTimeout(() => {
    el.classList.remove('show', 'leaving');
    el.innerHTML = '';
  }, letters.length * COMBO_EXIT_STEP_MS + COMBO_FLY_MS + 60);
}

function _bossBumpCombo() {
  _bossCombo++;
  const el = document.getElementById('boss-combo');
  if (!el) return;
  if (_bossCombo < 2) return;            // "1 combo" isn't a combo
  // Rewritten from scratch each bump, which also cancels a scatter already in
  // flight — landing a hit while the last chip is coming apart should put a
  // fresh one up, not animate the wreckage.
  _bossComboWrite(el, _bossCombo + '× COMBO');
  clearTimeout(_bossComboTimer);
  _bossComboTimer = setTimeout(() => _bossComboScatter(el), COMBO_HOLD_MS);
}

function _bossResetCombo() {
  _bossCombo = 0;
  const el = document.getElementById('boss-combo');
  if (!el) return;
  clearTimeout(_bossComboTimer);
  // A broken combo gets the same send-off as one that timed out.
  _bossComboScatter(el);
}

/* ── Personal-best HP marker ───────────────────────────────── */
let _bossLowest = 100;

/** Seed the marker from the best score ever recorded on this program. */
function _bossSeedLowest(challenge) {
  _bossLowest = 100;
  if (!challenge || !Array.isArray(state.history)) return;
  const logs = state.history.filter(h => h.challengeId === challenge.id);
  if (logs.length) {
    const bestScore = Math.max(...logs.map(l => l.score || 0));
    _bossLowest = Math.max(0, 100 - bestScore);
  }
}

function _bossPaintBestMark() {
  const mark = document.getElementById('boss-best-mark');
  if (!mark) return;
  const show = _bossLowest < 99.5;
  mark.style.display = show ? '' : 'none';
  if (show) {
    mark.style.left = _bossLowest + '%';
    mark.title = `Best: driven to ${_bossHpLeft(_bossLowest)} HP`;
  }
}

/* ── Segment ticks ─────────────────────────────────────────────
   SAO health bars are divided into segments. A single divider says nothing
   about a 122 HP boss, so the track is notched every ROUND number of HP
   instead: the step is picked so any reference size lands on roughly 8–24
   segments, with a brighter line every fifth notch to count by. */
const BOSS_TICK_STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2500, 5000];
const BOSS_TICK_MAX = 24;

/** Smallest round step that keeps the notch count sane for this boss. */
function _bossTickStep(maxHp) {
  for (let i = 0; i < BOSS_TICK_STEPS.length; i++) {
    if (maxHp / BOSS_TICK_STEPS[i] <= BOSS_TICK_MAX) return BOSS_TICK_STEPS[i];
  }
  return Math.ceil(maxHp / BOSS_TICK_MAX);
}

function _bossPaintTicks() {
  const ticks = document.querySelector('#boss-health-wrapper .sao-ticks');
  if (!ticks) return;
  const step = _bossMaxHp > 4 ? _bossTickStep(_bossMaxHp) : 0;
  const seg = step ? (step / _bossMaxHp) * 100 : 0;   // one segment, as % of the track
  if (!(seg > 0) || seg >= 50) { ticks.style.display = 'none'; return; }
  ticks.style.display = 'block';   // the stylesheet keeps it off by default
  ticks.style.setProperty('--sao-seg', seg.toFixed(4) + '%');
  ticks.style.setProperty('--sao-seg-major', (seg * 5).toFixed(4) + '%');
}

/**
 * Shared boss-bar painter (single-practice page + multi-problem session).
 *
 * HP is literal, not cosmetic: max HP is the number of significant characters in
 * the reference solution (comments and whitespace stripped, exactly as the
 * similarity check sees it), and current HP is how many of those you haven't
 * matched yet. Writing correct code is what deals damage.
 *
 * @param {number} healthPercent 0–100
 * @param {object} [opts] .instant skips the hit reaction; .maxHp sets the character total
 */
function _bossBarPaint(healthPercent, opts) {
  const bar = document.getElementById('boss-health-bar');
  if (!bar) return;
  const instant = !!(opts && opts.instant);
  const wrap = document.getElementById('boss-health-wrapper');
  const clamped = Math.max(0, Math.min(100, healthPercent));
  const prev = parseFloat(bar.dataset.prevHealth || '100');
  if (opts && opts.maxHp != null) _bossMaxHp = Math.max(0, Math.round(opts.maxHp));

  // ── RPG damage read ──
  // The green fill goes straight to the new (lower) value and STAYS there. The
  // chunk that was just lost is left standing in red behind it, then recedes
  // back down to the new value a moment later. Nothing ever animates upward.
  const dropped = prev - clamped;
  bar.style.width = clamped + '%';

  const ghost = document.getElementById('boss-health-ghost');
  if (ghost) {
    clearTimeout(_bossGhostTimer);
    if (instant || clamped >= prev) {
      // No damage (or a reset) — park the red flush with the fill, silently.
      ghost.style.transition = 'none';
      ghost.style.width = clamped + '%';
      ghost.dataset.pct = String(clamped);
    } else {
      // Pin the red to where HP was — or to where it still is if an earlier hit
      // hasn't finished receding, so a burst of typing builds one red chunk
      // instead of each hit clipping the last one short.
      const pinTo = Math.max(prev, parseFloat(ghost.dataset.pct || '0'));
      ghost.style.transition = 'none';
      ghost.style.width = pinTo + '%';
      ghost.dataset.pct = String(pinTo);
      void ghost.offsetWidth;          // commit the pin before scheduling the recede
      _bossGhostTimer = setTimeout(() => {
        const g = document.getElementById('boss-health-ghost');
        if (!g) return;
        g.style.transition = 'width 0.5s cubic-bezier(0.33, 1, 0.68, 1)';
        g.style.width = clamped + '%';
        g.dataset.pct = String(clamped);
      }, 300);
    }
  }

  /* Glass shards burst off the damage boundary, SAO-style -- and green motes
     off the same boundary when it travels the other way.

     Note which direction is which here: the boss's HP is the INVERSE of your
     progress, so HP going UP means the reference is being matched LESS well
     than it was. Green for the rise and red for the fall is what was asked
     for and it is also the honest signal -- the bar is the boss's health, and
     the boss recovering is the thing you just undid. */
  if (instant) {
    _bossHealAccum = _bossDmgAccum = 0;      // a reset is not a hit
  } else {
    const delta = clamped - prev;            // + = the boss recovered
    if (delta > 0) { _bossHealAccum += delta; _bossDmgAccum = 0; }
    else if (delta < 0) { _bossDmgAccum -= delta; _bossHealAccum = 0; }

    /* Scaled to the program, not to the bar. _bossMaxHp IS the reference's
       significant-character count, so 100/_bossMaxHp is what one character is
       worth in percentage points; firing at nine tenths of that means any
       single character you add or delete shows, on a short program and a long
       one alike. The 220ms cooldown inside the burst still caps the rate, and
       because the accumulator is only cleared when a burst actually EMITS, a
       change refused by that cooldown is kept and spent on the next one. */
    const perChar = _bossMaxHp > 0 ? 100 / _bossMaxHp : 1.2;
    const trigger = Math.max(0.05, perChar * 0.9);
    if (_bossDmgAccum >= trigger) {
      if (_bossDamageShards(clamped, _bossDmgAccum, 'damage')) _bossDmgAccum = 0;
    } else if (_bossHealAccum >= trigger) {
      if (_bossDamageShards(clamped, _bossHealAccum, 'heal')) _bossHealAccum = 0;
    }
  }

  // Combo: consecutive hits with no healing in between.
  if (!instant) {
    if (dropped > 0.8) _bossBumpCombo();
    else if (clamped > prev + 0.8) _bossResetCombo();
  }

  // Lowest HP ever driven to on this program — a line to beat.
  if (clamped < _bossLowest) _bossLowest = clamped;
  _bossPaintBestMark();
  _bossPaintTicks();

  // Colour ramp handed to CSS as a hue so fill, glow and outline stay in step.
  if (wrap) wrap.style.setProperty('--sao-hue', String(Math.round(clamped * (BOSS_FULL_HUE / 100))));

  // The readout is HP numbers + level; the percentage lives only in the fill width.
  const hpEl = document.getElementById('boss-health-hp');
  if (hpEl) {
    hpEl.textContent = _bossMaxHp > 0
      ? _bossHpLeft(clamped).toLocaleString() + ' / ' + _bossMaxHp.toLocaleString()
      : '— / —';
  }

  // The crystal no longer flares on damage — see bossLockOn(). Losing HP happens
  // on every keystroke, so flashing there meant it strobed the whole time you
  // were typing; the flash now marks re-acquiring the target instead.
  const crystal = document.getElementById('boss-crystal');
  bar.dataset.prevHealth = clamped;

  // Life and death are judged on the HP READOUT, never on a percentage — with a
  // 119-character reference, 0.45% still reads "1 / 119", and the boss must not
  // be dead while a character is still showing.
  const dead = _bossHpLeft(clamped) <= 0;
  const wasDead = _bossHpLeft(prev) <= 0;

  if (wrap) wrap.classList.toggle('boss-critical', !dead && clamped <= 25);

  // Boss defeated → SAO-style glass shatter across the whole page.
  if (instant) {
    // A silent repaint (problem switch, restore) still has to settle the slain
    // look, or a revived boss keeps the dead grey crystal.
    if (wrap) wrap.classList.toggle('boss-slain', dead);
    if (crystal) crystal.classList.toggle('boss-slain', dead);
    return;
  }
  if (dead && !wasDead) {
    // Fires on every crossing from alive to dead, so reviving the boss and
    // killing it again replays the break — same as the crystal relighting.
    // The cooldown only stops it stacking on itself if HP flickers at zero.
    const now = Date.now();
    if (now - _bossShatterAt > 1100) {
      _bossShatterAt = now;
      _bossDefeatShatter();
    }
    if (wrap) wrap.classList.add('boss-slain');
    if (crystal) crystal.classList.add('boss-slain');
  } else if (!dead) {
    // Deleting a single character revives the boss — relight immediately.
    if (wrap) wrap.classList.remove('boss-slain');
    if (crystal) crystal.classList.remove('boss-slain');
  }
}

/**
 * Re-acquire the target: the crystal flashes and a reticle snaps in around it.
 *
 * Fired when your attention comes BACK to the editor — closing the Run Code
 * terminal, or switching problems in a set — not while you type. Damage used to
 * drive it, which made the gem strobe continuously as the HP bar drained.
 */
function bossLockOn() {
  const crystal = document.getElementById('boss-crystal');
  if (!crystal || crystal.style.display === 'none') return;
  if (crystal.classList.contains('boss-slain')) return;   // nothing left to lock onto
  crystal.classList.remove('boss-lock');
  void crystal.offsetWidth;                                // restart the animation
  crystal.classList.add('boss-lock');
  clearTimeout(crystal._lockT);
  crystal._lockT = setTimeout(() => crystal.classList.remove('boss-lock'), 700);
}

/**
 * Small SAO-style glass burst at the point on the track where HP was just lost.
 * Shards are appended to the nameplate (not the track — that clips its children)
 * and remove themselves when the animation ends.
 */
let _bossShardCooldown = 0;
/* Un-emitted HP movement, in percentage points, kept per direction.

   A single keystroke moves the bar by one character's worth of the reference:
   about 0.9 points on a 111-character program and under 0.2 on a long one.
   The old flat 1.2-point gate was above BOTH, so holding a key down changed
   the bar continuously and never once threw a particle. Small changes now add
   up here until they are worth a burst, and the total is what sizes it -- so
   eight taps that each move a fifth of a point produce one burst of the size
   those eight taps earned, rather than nothing at all. */
let _bossHealAccum = 0;
let _bossDmgAccum = 0;
/**
 * The burst off the HP boundary, in one of two moods.
 *
 * 'damage' is the original: hot pink-to-crimson glass flung up and to the
 * right, shed by a hit. 'heal' is the same machinery with green motes that
 * rise nearly straight and slower -- HP coming BACK should look like it is
 * gathering, not like more of the boss breaking off, so the lean is dropped
 * and the drift is softened rather than just recolouring the debris.
 *
 * @param {number} healthPercent where the boundary is now
 * @param {number} amount        size of the change, drives how many fly
 * @param {'damage'|'heal'} [kind='damage']
 */
function _bossDamageShards(healthPercent, damage, kind) {
  const heal = kind === 'heal';
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  const now = Date.now();
  if (now - _bossShardCooldown < 220) return false;   // typing fires damage constantly
  _bossShardCooldown = now;

  const wrap = document.getElementById('boss-health-wrapper');
  const track = wrap && wrap.querySelector('.sao-track');
  if (!wrap || !track) return false;

  const tr = track.getBoundingClientRect();
  const wr = wrap.getBoundingClientRect();
  if (!tr.width) return false;
  const x = (tr.left - wr.left) + tr.width * (Math.max(0, Math.min(100, healthPercent)) / 100);
  const yTop = tr.top - wr.top;
  const yBot = yTop + tr.height;

  // They linger for ~2s each, so cap how many can be in the air at once.
  if (wrap.querySelectorAll('.sao-shard').length > 55) return false;

  // Bigger hits shed more petals.
  const COUNT = Math.max(5, Math.min(13, Math.round(4 + (damage || 2) * 0.8)));
  const frag = document.createDocumentFragment();
  for (let i = 0; i < COUNT; i++) {
    const s = document.createElement('div');
    s.className = 'sao-shard';
    // Alternate between the top and bottom edge of the wound; both sets drift
    // upward, so the ones from the bottom edge rise past the bar.
    const y = (i % 2 === 0 ? yTop + 1 : yBot - 1) + (Math.random() - 0.5) * 3;
    const w = heal ? 3.5 + Math.random() * 4.5 : 5 + Math.random() * 7;
    // Round-ish when healing, jagged when breaking.
    const h = w * (heal ? 0.9 + Math.random() * 0.4 : 1.05 + Math.random() * 0.85);
    s.style.cssText =
      `left:${x + (Math.random() - 0.5) * 14}px; top:${y}px; width:${w.toFixed(1)}px; height:${h.toFixed(1)}px;` +
      // A straight diagonal drift up and to the right — no wobble, no tumbling,
      // just a slight turn of the petal itself as it goes.
      `--pt-y:${(heal ? -26 - Math.random() * 22 : -22 - Math.random() * 26).toFixed(1)}px;` +
      // Barely any sideways travel when healing: motes rising off the bar, not
      // fragments thrown clear of it.
      `--pt-lean:${(heal ? (Math.random() - 0.5) * 16 : 16 + Math.random() * 30).toFixed(1)}px;` +
      `--pt-rot:${((Math.random() - 0.5) * (heal ? 26 : 60)).toFixed(0)}deg;` +
      `--pt-dur:${(heal ? 1.25 + Math.random() * 0.7 : 0.95 + Math.random() * 0.65).toFixed(2)}s;` +
      `--pt-delay:${(Math.random() * (heal ? 0.18 : 0.11)).toFixed(2)}s;` +
      `background:linear-gradient(${Math.round(Math.random() * 360)}deg, ${heal
        ? '#d1fae5 0%, #10b981 46%, #065f46 100%'
        : '#ff9dba 0%, #f5194b 48%, #93002a 100%'});` +
      `clip-path:${_bossShardShape()};`;
    s.addEventListener('animationend', () => s.remove(), { once: true });
    frag.appendChild(s);
  }
  wrap.appendChild(frag);
  return true;
}

/**
 * An irregular petal outline — 5 to 7 points on a jittered radius, so no two
 * are alike and none of them read as a plain triangle.
 */
function _bossShardShape() {
  const n = 5 + Math.floor(Math.random() * 3);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n + (Math.random() - 0.5) * 0.55;
    const r = 30 + Math.random() * 20;
    pts.push(`${(50 + Math.cos(a) * r).toFixed(0)}% ${(50 + Math.sin(a) * r).toFixed(0)}%`);
  }
  return `polygon(${pts.join(', ')})`;
}

/** Paint the bar to a neutral full state — used when there's no reference to fight. */
function _bossBarNoTarget() {
  const bar = document.getElementById('boss-health-bar');
  const wrap = document.getElementById('boss-health-wrapper');
  if (!bar) return;
  _bossMaxHp = 0;
  bar.style.width = '100%';
  bar.dataset.prevHealth = '100';
  if (wrap) {
    wrap.style.setProperty('--sao-hue', String(BOSS_FULL_HUE));
    wrap.classList.remove('boss-critical', 'boss-slain');
  }
  const crystalEl = document.getElementById('boss-crystal');
  if (crystalEl) crystalEl.classList.remove('boss-slain');
  clearTimeout(_bossGhostTimer);
  const ghost = document.getElementById('boss-health-ghost');
  if (ghost) { ghost.style.transition = 'none'; ghost.style.width = '100%'; ghost.dataset.pct = '100'; }
  const hpEl = document.getElementById('boss-health-hp');
  if (hpEl) hpEl.textContent = 'no target';
  const mark = document.getElementById('boss-best-mark');
  if (mark) mark.style.display = 'none';
  _bossResetCombo();
}

/**
 * Full-page "boss defeated" shatter: the screen flashes, then dozens of glassy
 * cyan polygon shards burst outward and rain down — Sword Art Online style.
 * Pure DOM/CSS, removes itself when finished. Honors prefers-reduced-motion.
 */
function _bossDefeatShatter() {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let overlay = document.getElementById('boss-shatter-overlay');
  if (overlay) overlay.remove();

  overlay = document.createElement('div');
  overlay.id = 'boss-shatter-overlay';
  overlay.className = 'boss-shatter-overlay';

  // Flash, shockwave rings, and the crack lines that precede the burst
  overlay.innerHTML =
    '<div class="boss-shatter-flash"></div>' +
    '<div class="boss-shatter-ring"></div>' +
    '<div class="boss-shatter-ring boss-shatter-ring-2"></div>' +
    '<div class="boss-shatter-text" data-text="BREAK">BREAK</div>';

  // Hairline cracks radiating from the impact point just before the glass goes
  let cracksHtml = '';
  const CRACKS = 14;
  for (let i = 0; i < CRACKS; i++) {
    const a = (360 / CRACKS) * i + (Math.random() - 0.5) * 14;
    cracksHtml += `<div class="boss-crack" style="
      --crack-rot:${a.toFixed(1)}deg;
      --crack-len:${(30 + Math.random() * 45).toFixed(0)}vmax;
      --crack-delay:${(Math.random() * 0.1).toFixed(2)}s;"></div>`;
  }
  overlay.insertAdjacentHTML('beforeend', cracksHtml);

  // Shards: glassy polygons bursting from the centre of the viewport. Sizes are
  // weighted so a few large plates carry the silhouette and a spray of small
  // splinters fills between them, instead of one uniform confetti cloud.
  const SHARDS = 96;
  const vw = window.innerWidth, vh = window.innerHeight;
  let shardsHtml = '';
  for (let i = 0; i < SHARDS; i++) {
    const angle = (Math.PI * 2 * i) / SHARDS + (Math.random() - 0.5) * 0.7;
    const big = i % 6 === 0;
    const dist = (big ? 180 : 260) + Math.random() * Math.max(vw, vh) * (big ? 0.4 : 0.7);
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist + 140 + Math.random() * 260; // gravity pull
    const size = big ? 46 + Math.random() * 52 : 8 + Math.random() * 26;
    const rot = (Math.random() - 0.5) * 900;
    const delay = Math.random() * 0.07;   // near-simultaneous; long stagger reads as a trickle
    const dur = 1.2 + Math.random() * 0.9;
    const p1 = Math.round(Math.random() * 40), p2 = Math.round(60 + Math.random() * 40);
    const clip = Math.random() < 0.5
      ? `polygon(${p1}% 0%, 100% ${p2}%, 0% 100%)`
      : `polygon(50% 0%, 100% ${p1}%, ${p2}% 100%, 0% ${100 - p1}%)`;
    const hue = 185 + Math.random() * 35; // icy cyan→blue
    // Scatter the origins over a real area — spawning them all on one point is
    // what made the first moments look like a solid clump.
    shardsHtml += `<div class="boss-shard" style="
      left:${(48 + (Math.random() - 0.5) * (big ? 30 : 44)).toFixed(1)}%;
      top:${(44 + (Math.random() - 0.5) * (big ? 26 : 38)).toFixed(1)}%;
      width:${size.toFixed(0)}px; height:${(size * (0.55 + Math.random() * 0.9)).toFixed(0)}px;
      --shard-dx:${dx.toFixed(0)}px; --shard-dy:${dy.toFixed(0)}px; --shard-rot:${rot.toFixed(0)}deg;
      --shard-delay:${delay.toFixed(2)}s; --shard-dur:${dur.toFixed(2)}s;
      clip-path:${clip};
      background:linear-gradient(135deg, hsl(${hue} 100% 92% / 0.98), hsl(${hue} 95% 72% / 0.85) 45%, hsl(${hue + 16} 90% 48% / 0.5));
      box-shadow:0 0 14px hsl(${hue} 95% 70% / 0.85), inset 0 0 8px hsl(${hue} 100% 95% / 0.6);"></div>`;
  }
  overlay.insertAdjacentHTML('beforeend', shardsHtml);
  document.body.appendChild(overlay);

  // Screen shake on the practice layout for impact
  const layout = document.querySelector('.practice-layout');
  if (layout) {
    layout.classList.remove('boss-shake');
    void layout.offsetWidth;
    layout.classList.add('boss-shake');
  }

  setTimeout(() => {
    overlay.remove();
    if (layout) layout.classList.remove('boss-shake');
  }, 2600);
}

/* ── Browser full screen ───────────────────────────────────────
   Kept vendor-prefixed: Safari still only ships the webkit- names. */
function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

function toggleFullscreen() {
  if (isFullscreen()) {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (exit) { try { Promise.resolve(exit.call(document)).catch(() => {}); } catch (e) { /* ignore */ } }
    return;
  }
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req) {
    if (typeof toast === 'function') toast('Full screen isn\'t available in this browser.', { type: 'warning' });
    return;
  }
  try {
    Promise.resolve(req.call(el)).catch(() => {
      // Blocked (permissions policy, or not treated as a user gesture)
      if (typeof toast === 'function') toast('The browser blocked full screen. Try F11 instead.', { type: 'warning' });
    });
  } catch (e) { /* ignore */ }
}

/** Keep the button's icon and pressed state in step, including F11/Esc exits
    that never go through our click handler. */
/**
 * Point an already-rendered lucide icon at a different glyph.
 *
 * lucide replaces the <i> with an <svg> and adds a lucide-<name> class. Asking
 * it to re-render the same element swaps the paths but leaves the old name
 * class behind, so a minimize icon ends up also classed lucide-maximize. The
 * drawing is right either way; the class is not, and anything selecting on it
 * would pick the wrong element.
 */
function _setLucideIcon(el, name) {
  if (!el) return;
  [...el.classList].forEach(c => { if (c.indexOf('lucide-') === 0) el.classList.remove(c); });
  el.setAttribute('data-lucide', name);
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: el.parentElement || el });
}

function _syncFullscreenBtn() {
  const on = isFullscreen();
  const label = on ? 'Exit full screen' : 'Full screen';

  const btn = document.getElementById('fullscreen-toggle-btn');
  if (btn) {
    btn.title = label;
    btn.setAttribute('aria-label', label);
    btn.setAttribute('aria-pressed', String(on));
    btn.style.color = on ? 'var(--color-primary)' : '';
    _setLucideIcon(btn.querySelector('[data-lucide], svg'), on ? 'minimize' : 'maximize');
  }

  // The same control in Settings, for the routes with no attempt topbar. Both
  // are driven from here because F11 and Esc never reach a click handler, and
  // a row still reading "Full Screen" while already full screen is worse than
  // having no row at all.
  const item = document.getElementById('settings-fullscreen-item');
  if (item) {
    item.setAttribute('aria-label', label);
    item.setAttribute('aria-pressed', String(on));
    const lab = document.getElementById('settings-fullscreen-label');
    const desc = document.getElementById('settings-fullscreen-desc');
    if (lab) lab.textContent = on ? 'Exit Full Screen' : 'Full Screen';
    if (desc) desc.textContent = on ? 'Return to the windowed view' : 'Fill the display';
    _setLucideIcon(document.getElementById('settings-fullscreen-icon'), on ? 'minimize' : 'maximize');
  }
}
window._syncFullscreenBtn = _syncFullscreenBtn;

['fullscreenchange', 'webkitfullscreenchange'].forEach(ev =>
  document.addEventListener(ev, _syncFullscreenBtn));

/* ============================================================
   CHEAT SHEET
   ------------------------------------------------------------
   A per-program reference sheet, switched on for a program in the Coding
   Library admin. The sheet itself is deliberately blank for now — this lays in
   the toolbar button, the admin switch and the presentation (blurred backdrop,
   the page scaling up from small, warm off-white paper rather than a glaring
   white) so the content can be dropped straight into #cheat-body later.
   ============================================================ */

let _cheatKeyHandler = null;

/** The button only exists for programs whose cheat sheet is switched on. */
function syncCheatsheetBtn(challenge) {
  const btn = document.getElementById('cheatsheet-toggle-btn');
  if (!btn) return;
  const on = typeof programHasCheatsheet === 'function'
    ? programHasCheatsheet(challenge)
    : !!(challenge && challenge.cheatsheet);
  btn.style.display = on ? '' : 'none';
  if (!on) closeCheatsheet();
}

/**
 * @param {string} [programId] which program's linked sheet to open. Defaults to
 *   the attempt in progress; passing it explicitly makes the behaviour usable
 *   (and testable) outside an attempt.
 */
function openCheatsheet(programId) {
  if (document.getElementById('cheat-overlay')) return;
  const ov = document.createElement('div');
  ov.id = 'cheat-overlay';
  ov.className = 'cheat-overlay';
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-modal', 'true');
  ov.setAttribute('aria-label', 'Cheat sheet');
  ov.innerHTML = `
    <div class="cheat-page">
      <button class="cheat-close" onclick="closeCheatsheet()" title="Close (Esc)" aria-label="Close cheat sheet">
        <i data-lucide="x"></i>
      </button>
      <div class="cheat-body" id="cheat-body"></div>
    </div>`;
  // mousedown, not click: a drag that starts on the page and ends on the
  // backdrop shouldn't count as clicking away.
  ov.addEventListener('mousedown', (e) => { if (e.target === ov) closeCheatsheet(); });
  document.body.classList.add('cheat-open');
  document.body.appendChild(ov);
  // The sheet body is no longer a placeholder: it shows your Cheat Sheet
  // Library, read-only, so a reference is one keypress away mid-attempt.
  if (typeof csFillOverlay === 'function') {
    const ch = programId || ((typeof getSessionParam === 'function') ? getSessionParam('practiceChallenge') : null);
    csFillOverlay(ch);
  }
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: ov });

  // Capture phase: Escape has to close the sheet, not reach the attempt's own
  // Escape handler and offer to abandon the attempt.
  _cheatKeyHandler = (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    closeCheatsheet();
  };
  document.addEventListener('keydown', _cheatKeyHandler, true);
  const closeBtn = ov.querySelector('.cheat-close');
  if (closeBtn) closeBtn.focus();
}

function closeCheatsheet() {
  if (_cheatKeyHandler) {
    document.removeEventListener('keydown', _cheatKeyHandler, true);
    _cheatKeyHandler = null;
  }
  document.body.classList.remove('cheat-open');
  const ov = document.getElementById('cheat-overlay');
  if (!ov) return;
  ov.classList.add('closing');
  setTimeout(() => ov.remove(), 170);
  const ta = document.getElementById('editor-textarea');
  if (ta) ta.focus();
}

function toggleBossHealthBar() {
  const wrapper = document.getElementById('boss-health-wrapper');
  const btn = document.getElementById('boss-bar-toggle-btn');
  if (!wrapper) return;
  const isVisible = bossIsVisible();
  bossSetVisible(!isVisible);
  sessionStorage.setItem('bossBarEnabled', isVisible ? 'false' : 'true');
  if (btn) btn.style.color = isVisible ? 'var(--text-tertiary)' : 'var(--color-warning)';
}

function goToSolution() {
  setSessionParam('solutionBack', 'practice');
  setSessionParam('lastDiffs', state.lastDiffs);
  spaNavigate('solution');
}

// ── Lazy-load JSCPP on first Run Code click (Item #10) ──
function ensureJSCPP(callback) {
  if (typeof JSCPP !== 'undefined') { callback(); return; }

  const outputEl = document.getElementById('run-code-output');
  const statusEl = document.getElementById('run-code-status');
  if (outputEl) outputEl.innerHTML = '<span class="run-code-compiling"><i data-lucide="loader" class="run-code-spinner"></i> Loading C interpreter…</span>';
  if (statusEl) statusEl.textContent = '⏳ Loading interpreter (first run only)…';
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: outputEl });

  const script = document.createElement('script');
  script.src = typeof JSCPP_SRC !== 'undefined' ? JSCPP_SRC : 'js/JSCPP.es5.min.js';
  script.onload = callback;
  script.onerror = () => {
    if (outputEl) { outputEl.textContent = 'Error: Could not load the C interpreter.\nCheck your network connection and try again.'; outputEl.className = 'run-code-output run-code-error'; }
    if (statusEl) statusEl.textContent = '❌ Interpreter load failed';
  };
  document.head.appendChild(script);
}

// ── Interactive Terminal ──
let _term = null;

/**
 * @param {boolean} [byUser] the terminal was dismissed on purpose (close button,
 *   backdrop, Esc) rather than torn down by a problem switch or by leaving the
 *   page. Only that case means "attention is back on the editor", so only that
 *   case re-acquires the boss — otherwise the crystal flashed on a page that was
 *   already unmounting, and left a stray timer behind it.
 */
function _termClose(byUser) {
  _term = null;
  if (window._termEscHandler) {
    document.removeEventListener('keydown', window._termEscHandler);
    window._termEscHandler = null;
  }
  const overlay = document.getElementById('run-code-overlay');
  if (overlay) overlay.remove();
  const toast = document.getElementById('run-code-toast');
  if (toast) toast.remove();
  if (byUser && overlay) bossLockOn();
}

function runCodeWithPiston(seedStdin) {
  const textarea = document.getElementById('editor-textarea');
  if (!textarea) return;
  if (typeof psfxWorkStart === 'function') psfxWorkStart();
  // The whole file, not what happens to be on screen — a collapsed block is
  // parked outside the textarea (see fold.js).
  const code = (typeof edFullSource === 'function') ? edFullSource(textarea) : textarea.value;

  let overlay = document.getElementById('run-code-overlay');
  if (overlay) overlay.remove();

  overlay = document.createElement('div');
  overlay.id = 'run-code-overlay';
  overlay.className = 'run-code-overlay';
  document.body.appendChild(overlay);

  overlay.innerHTML = `
    <div class="run-code-window">
      <div class="run-code-header">
        <div class="run-code-header-left">
          <i data-lucide="terminal"></i>
          <span>Terminal</span>
        </div>
        <button class="run-code-close-btn" id="run-code-close-btn"><i data-lucide="x"></i></button>
      </div>
      <div class="run-code-body" style="flex-direction:column; padding:0;">
        <!-- One surface. You type INTO the transcript, right after the prompt —
             the field itself is invisible (see .term-hidden-input). -->
        <div class="term-output-area term-surface" id="term-output-area">
          <!-- Only #term-lines is ever re-rendered. The input must NOT be moved
               or re-inserted: re-parenting a node blurs it, which silently ate
               every keystroke. -->
          <div class="term-lines" id="term-lines"></div>
          <input type="text" id="term-input" class="term-hidden-input" autocomplete="off"
                 autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Program input" />
        </div>
      </div>
      <div class="term-stdin-panel" id="term-stdin-panel" style="display:none;">
        <label for="term-seed">Input to feed the program, one entry per line. It is
          replayed one prompt at a time, so the transcript still reads normally.</label>
        <textarea id="term-seed" class="form-textarea" rows="4" spellcheck="false"
                  placeholder="2&#10;Kenric&#10;1"></textarea>
        <div class="term-stdin-actions">
          <button class="btn btn-primary btn-sm" id="term-seed-run"><i data-lucide="play" style="width:13px;height:13px;"></i> Run with this input</button>
          <button class="btn btn-ghost btn-sm" id="term-seed-close">Close</button>
        </div>
      </div>
      ${termOptionsPanelHTML('term')}
      <div class="term-history-panel" id="term-history-panel" style="display:none;"></div>
      <div class="run-code-footer">
        <div class="run-code-footer-left">
          <span class="run-code-status" id="run-code-status">⏳ Compiling...</span>
          <span class="term-elapsed" id="term-elapsed"></span>
          <span id="run-code-engine" class="term-engine-badge"></span>
          <span class="term-queue-chip" id="term-queue-chip" style="display:none;"></span>
        </div>
        <div class="run-code-footer-right">
          <button class="btn btn-ghost btn-sm term-icon-btn" id="term-stdin-btn" title="Supply input up front"><i data-lucide="file-input" style="width:14px;height:14px;"></i></button>
          <button class="btn btn-ghost btn-sm term-icon-btn" id="term-opts-btn" title="Compiler options"><i data-lucide="settings-2" style="width:14px;height:14px;"></i></button>
          <button class="btn btn-ghost btn-sm term-icon-btn" id="term-history-btn" title="Previous runs"><i data-lucide="history" style="width:14px;height:14px;"></i></button>
          <button class="btn btn-ghost btn-sm term-icon-btn" id="term-clear-btn" title="Clear the screen"><i data-lucide="eraser" style="width:14px;height:14px;"></i></button>
          <span class="term-footer-sep" aria-hidden="true"></span>
          <button class="btn btn-danger btn-sm" id="term-stop-btn" title="Stop this run" style="display:none;"><i data-lucide="square" style="width:13px;height:13px;"></i> Stop</button>
          <button class="btn btn-secondary btn-sm" id="run-code-restart-btn" title="Restart program"><i data-lucide="rotate-ccw" style="width:14px;height:14px;"></i> Restart</button>
          <button class="btn btn-primary btn-sm" id="run-code-rerun-btn"><i data-lucide="play" style="width:14px;height:14px;fill:currentColor;"></i> Run</button>
        </div>
      </div>
    </div>
  `;

  if (typeof lucide !== 'undefined') lucide.createIcons({ root: overlay });

  document.getElementById('run-code-close-btn').onclick = () => _termClose(true);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) _termClose(true); });

  const freshSource = () => {
    const ta = document.getElementById('editor-textarea');
    if (!ta) return '';
    return (typeof edFullSource === 'function') ? edFullSource(ta) : ta.value;
  };
  document.getElementById('run-code-rerun-btn').onclick = () => _termInit(freshSource());
  document.getElementById('run-code-restart-btn').onclick = () => _termInit(freshSource());

  // Typing goes straight into the transcript (see terminal-io.js).
  termBindInput({
    areaId: 'term-output-area',
    inputId: 'term-input',
    onInput: (v) => { if (_term) { _term.pending = v; _termRender(); } },
    onSubmit: (v) => _termHandleInput(v),
    onEscape: () => _termClose(true)
  });

  // Pasting several lines queues them instead of jamming them onto one line.
  const inputEl = document.getElementById('term-input');
  if (inputEl) {
    inputEl.addEventListener('paste', (e) => {
      const text = (e.clipboardData || window.clipboardData).getData('text') || '';
      if (!text.includes('\n') || !_term) return;
      e.preventDefault();
      termQueueSet(_term, inputEl.value + text);
      inputEl.value = '';
      _term.pending = '';
      _termDrainQueue();
    });
  }

  const on = (id, fn) => { const b = document.getElementById(id); if (b) b.onclick = fn; };
  on('term-stop-btn', () => _termStop());
  on('term-clear-btn', () => _termClear());
  on('term-stdin-btn', () => _termTogglePanel('term-stdin-panel'));
  on('term-opts-btn', () => _termTogglePanel('term-opts'));
  on('term-history-btn', () => { _termRenderHistory(); _termTogglePanel('term-history-panel'); });
  on('term-seed-close', () => _termTogglePanel('term-stdin-panel', false));
  on('term-seed-run', () => {
    const seed = document.getElementById('term-seed');
    _termTogglePanel('term-stdin-panel', false);
    _termInit(freshSource(), seed ? seed.value : '');
  });

  // Esc closes the terminal even when the stdin input doesn't have focus
  if (window._termEscHandler) document.removeEventListener('keydown', window._termEscHandler);
  window._termEscHandler = (e) => {
    if (e.key === 'Escape' && document.getElementById('run-code-overlay')) {
      e.preventDefault();
      e.stopPropagation();
      _termClose(true);
    }
  };
  document.addEventListener('keydown', window._termEscHandler);

  _termInit(code, seedStdin);
}

// Sentinel stdin appended to the "probe" run: where the two runs' outputs
// diverge is exactly where the next (not-yet-typed) input starts to matter.
const TERM_SENTINEL_STDIN = '54321\n54321\n54321\n54321\n54321\n54321\n';

/** Static check: does this code read from stdin at all? */
function _termExpectsInput(code) {
  return /\b(scanf|fscanf|gets|fgets|getchar|getline)\s*\(|\bcin\s*>>/.test(code || '');
}

/** Longest common prefix of two strings. */
function _termLCP(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return a.slice(0, i);
}

/** Transcripts of earlier runs, newest first (see the History button). */
let _termHistory = [];
let _termViewingHistory = null;

function _termInit(code, seedStdin) {
  // Keep the run you're replacing so you can compare before/after an edit.
  if (_term && _term.lines && _term.lines.length) termHistoryPush(_termHistory, _term);
  _termViewingHistory = null;

  // Seeded stdin is REPLAYED one entry per step rather than dumped in at once,
  // so every value still shows up echoed against the prompt that asked for it.
  const seed = typeof seedStdin === 'string' ? seedStdin : '';
  // Merge the companion files up front. "Does this program read stdin?" has to
  // be asked of the WHOLE translation unit: main.c may contain no scanf at all
  // while the read lives in an inlined header, and answering "no" skipped the
  // interactive stepping entirely — every prompt appeared at once.
  const merged = code ? preprocessMultiFile(code) : code;
  _term = {
    code: code,
    merged: merged,
    accStdin: '',
    inputs: [],
    queue: [],          // input waiting to be fed, one entry per step
    lines: [],          // { type:'stdout'|'stdin'|…, text, echo? }
    lineOpen: false,    // the program's last write had no trailing newline
    pending: '',        // keystrokes not yet entered, drawn inline at the caret
    waiting: false,     // blocked on a read
    displayed: '',      // stdout already shown on screen (trusted prefix)
    echoCount: 0,       // how many user inputs have been echoed
    completed: false,
    running: false,
    stopped: false,     // user pressed Stop
    aborter: null,      // in-flight request, so Stop can cancel it
    startedAt: 0,
    warnedLoop: false,  // "this never terminates" notice, shown at most once
    engine: 'GCC',
    exitCode: null,
    expectsInput: _termExpectsInput(merged),
    instrumented: undefined,  // probe build, compiled lazily on first step
    noInstrument: false,      // the probe build wouldn't compile — use the fallback
  };
  if (seed.trim()) termQueueSet(_term, seed);
  if (!code || code.trim() === '') {
    _term.lines.push({ type: 'info', text: 'Nothing to run — the editor is empty.' });
    _term.completed = true;
    const statusEl = document.getElementById('run-code-status');
    if (statusEl) statusEl.textContent = 'Idle';
    _termRender();
    return;
  }
  _termRender();
  _termRunStep();
}

/* ── Terminal controls ─────────────────────────────────────── */

function _termTogglePanel(id, force) {
  // The three drawers are mutually exclusive; two open at once just crowds it.
  let anyOpen = false;
  ['term-stdin-panel', 'term-opts', 'term-history-panel'].forEach(p => {
    const el = document.getElementById(p);
    if (!el) return;
    if (p === id) el.style.display = (force != null ? force : el.style.display === 'none') ? '' : 'none';
    else el.style.display = 'none';
    if (el.style.display !== 'none') anyOpen = true;
  });
  // Clicking a footer button moves focus onto the button, so the next thing you
  // type goes nowhere. Hand the caret to whatever you just opened — or back to
  // the program once every drawer is shut.
  if (!anyOpen) termFocusInput('term-input');
  else if (id === 'term-stdin-panel') {
    const seed = document.getElementById('term-seed');
    if (seed) seed.focus();
  }
}

/** Cancel the request in flight. The 25 s abort controller was already there. */
function _termStop() {
  if (!_term || !_term.running) return;
  _term.stopped = true;
  if (_term.aborter) { try { _term.aborter.abort(); } catch (e) { /* already gone */ } }
}

/** Wipe the screen without restarting the program. */
function _termClear() {
  if (!_term) return;
  _term.lines = [];
  _term.lineOpen = false;
  _termRender();
  termFocusInput('term-input');
}

/** Feed the next queued entry, if the program is sitting at a prompt. */
function _termDrainQueue() {
  if (!_term || !_term.waiting || !_term.queue || !_term.queue.length) { _termPaintQueueChip(); return; }
  const next = termQueueTake(_term);
  _termPaintQueueChip();
  _termHandleInput(next);
}

function _termPaintQueueChip() {
  const chip = document.getElementById('term-queue-chip');
  if (!chip) return;
  const n = (_term && _term.queue) ? _term.queue.length : 0;
  chip.style.display = n ? '' : 'none';
  chip.textContent = n ? `${n} queued` : '';
}

/** Recompile when the flags change — the old binary no longer matches. */
function _termOptsChanged() {
  const panel = document.getElementById('term-opts');
  if (panel) {
    const args = panel.querySelector('.term-opt-args code');
    if (args) args.textContent = termCompilerArgs();
  }
  if (_term && !_term.running) {
    const ta = document.getElementById('editor-textarea');
    const code = ta ? ((typeof edFullSource === 'function') ? edFullSource(ta) : ta.value) : _term.code;
    _termInit(code);
  }
}

function _termRenderHistory() {
  const host = document.getElementById('term-history-panel');
  if (!host) return;
  if (!_termHistory.length) {
    host.innerHTML = '<p class="term-history-empty">No earlier runs yet. Each time you press Run, the transcript you are replacing is kept here.</p>';
    return;
  }
  host.innerHTML = `
    <div class="term-history-list">
      ${_termHistory.map((h, i) => `
        <button class="term-history-row${_termViewingHistory === i ? ' active' : ''}" onclick="_termViewHistory(${i})">
          <i data-lucide="${h.exitCode === 0 ? 'check-circle-2' : 'alert-circle'}" style="width:13px;height:13px;"></i>
          <span class="term-history-when">${escapeHTML(h.label)}</span>
          <span class="term-history-exit">${h.exitCode == null ? '—' : 'exit ' + h.exitCode}</span>
          <span class="term-history-size">${h.lines.length} lines</span>
        </button>`).join('')}
      ${_termViewingHistory !== null ? '<button class="term-history-back" onclick="_termViewHistory(null)">← Back to the current run</button>' : ''}
    </div>`;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: host });
}

/** Show an earlier transcript read-only; null returns to the live one. */
function _termViewHistory(index) {
  _termViewingHistory = index;
  _termRenderHistory();
  _termRender();
}

/**
 * Compile+run one step, served from cache when the exact (flags, source, stdin)
 * triple has been seen before. Restarting and retyping the same answers then
 * replays instantly instead of paying a round trip per prompt.
 */
async function _termCompile(session, source, stdin) {
  const args = termCompilerArgs();
  const key = termCacheKey(source, stdin, args);
  const hit = termCacheGet(key);
  if (hit) { session.cacheHits = (session.cacheHits || 0) + 1; return hit; }
  const res = await _godboltCompileRun(source, stdin, session.aborter, args);
  termCacheSet(key, res);
  return res;
}

/** Live "…1.8s" next to the status, so a slow step reads as progress. */
function _termStartClock(session) {
  _termStopClock(session);
  session.startedAt = Date.now();
  const el = document.getElementById('term-elapsed');
  const tick = () => {
    if (!el || _term !== session || !session.running) return;
    el.textContent = ((Date.now() - session.startedAt) / 1000).toFixed(1) + 's';
  };
  tick();
  session.clock = setInterval(tick, 100);
}

function _termStopClock(session) {
  if (session && session.clock) { clearInterval(session.clock); session.clock = null; }
  if (typeof psfxWorkStop === 'function') psfxWorkStop();
  const el = document.getElementById('term-elapsed');
  if (el) el.textContent = '';
}

function _termShowStop(on) {
  const stop = document.getElementById('term-stop-btn');
  if (stop) stop.style.display = on ? '' : 'none';
}

/**
 * Say it once: a program that keeps looping when input runs out gets killed by
 * the sandbox on EVERY step, so each prompt costs the full time limit. Without
 * this the terminal just feels inexplicably slow.
 */
function _termWarnRunaway(session, exitCode) {
  if (session.warnedLoop) return;
  if (![124, 137, 143].includes(exitCode)) return;
  session.warnedLoop = true;
  session.lines.push({
    type: 'warning',
    text: 'Note: with no more input this program keeps running instead of stopping, so each step waits for the sandbox time limit. That is why prompts are slow to appear.'
  });
}

/** Enable/disable the terminal's Run + Restart buttons while a run is in flight. */
function _termSetButtonsRunning(running) {
  ['run-code-rerun-btn', 'run-code-restart-btn'].forEach(id => {
    const b = document.getElementById(id);
    if (b) { b.disabled = running; b.style.opacity = running ? '0.55' : ''; }
  });
}

async function _termRunStep() {
  if (!_term || _term.completed || _term.running) return;
  _term.running = true;
  // Snapshot the session: if the user clicks Run/Restart mid-flight, _term is
  // replaced and this stale step must not write into the new terminal.
  const session = _term;
  _termSetButtonsRunning(true);

  const statusEl = document.getElementById('run-code-status');
  const engineEl = document.getElementById('run-code-engine');

  session.waiting = false;        // no caret while a run is in flight
  session.stopped = false;
  session.aborter = new AbortController();
  _termShowStop(true);

  const firstRun = session.displayed === '' && session.inputs.length === 0;

  // Show spinner line while compiling
  const spinIdx = session.lines.length;
  session.lines.push({ type: 'info', text: firstRun ? '⏳ Compiling & running...' : '⏳ Running...' });
  _termRender();

  if (statusEl) statusEl.textContent = firstRun ? '⏳ Compiling with GCC...' : '⏳ Re-running with input...';
  if (engineEl) engineEl.textContent = 'GCC';
  session.engine = 'GCC';
  _termStartClock(session);

  // Interactive stepping: a probe build reports each stdin read (see
  // termInstrumentC), so the FIRST read that comes up empty is exactly where a
  // real terminal would block. That is precise where the old two-run
  // common-prefix trick over-reported — `printf("Enter Age: "); scanf(...);
  // printf("Your Age is: %d", age)` prints "Your Age is: " in every run, so the
  // common prefix swallowed it and both printfs appeared at once.
  // The two-run method stays as the fallback for C++ streams and for anything
  // the instrumented build refuses to compile.
  const interactive = session.expectsInput;

  let resA = null, resB = null, probe = null;
  try {
    if (interactive && !session.noInstrument) {
      if (session.instrumented === undefined) {
        // Instrument the MERGED translation unit, not the raw editor buffer:
        // companion files are inlined by preprocessMultiFile, and a read inside
        // an inlined header would otherwise sit above the shim's #defines and
        // never be wrapped.
        if (session.merged === undefined) session.merged = preprocessMultiFile(session.code);
        session.instrumented = termInstrumentC(session.merged);
      }
      if (session.instrumented) {
        probe = await _termCompile(session, session.instrumented, session.accStdin);
        // A build that only fails WITH the shim means the shim is the problem
        // (an odd use of one of the wrapped names) — drop back to the old way.
        if (!probe.didExecute) { session.noInstrument = true; probe = null; }
      } else {
        session.noInstrument = true;
      }
    }
    if (probe) {
      resA = probe;
    } else {
      if (session.merged === undefined) session.merged = preprocessMultiFile(session.code);
      if (interactive) {
        [resA, resB] = await Promise.all([
          _termCompile(session, session.merged, session.accStdin),
          _termCompile(session, session.merged, session.accStdin + TERM_SENTINEL_STDIN)
        ]);
      } else {
        resA = await _termCompile(session, session.merged, session.accStdin);
      }
    }
  } catch (err) {
    if (_term !== session) return; // user restarted mid-flight — discard this run
    if (session.stopped) {         // the user pressed Stop, not a real failure
      session.lines.splice(spinIdx, 1);
      session.lines.push({ type: 'warning', text: 'Stopped.' });
      session.running = false;
      session.completed = true;
      _termStopClock(session);
      _termShowStop(false);
      _termSetButtonsRunning(false);
      if (statusEl) statusEl.textContent = '■ Stopped';
      _termRender();
      return;
    }
    // Godbolt failed — try JSCPP fallback (its EOF abort yields an accurate
    // partial output, so no probe run is needed).
    session.engine = 'JSCPP';
    if (engineEl) engineEl.textContent = 'JSCPP';
    if (statusEl) statusEl.textContent = '⚠️ Compiler offline — using interpreter';
    resB = null;
    probe = null;
    try {
      resA = await _termRunJSCPP(session.code, session.accStdin);
    } catch (err2) {
      if (_term !== session) return;
      session.lines.splice(spinIdx, 1);
      _termCue(session, 'punch');
      session.lines.push({ type: 'error', text: 'Error: ' + (err2.message || err2) });
      session.completed = true;
      session.running = false;
      _termSetButtonsRunning(false);
      if (statusEl) statusEl.textContent = '❌ Execution failed';
      _termRender();
      return;
    }
  }
  if (_term !== session) return; // user restarted mid-flight — discard this run

  // Remove spinner
  session.lines.splice(spinIdx, 1);
  _termSetButtonsRunning(false);
  _termStopClock(session);
  _termShowStop(false);

  // Handle compilation failure
  if (!resA.didExecute) {
    _termCue(session, 'punch');
    session.lines.push({ type: 'error', text: 'Compilation Error:\n' + (termCleanDiagnostics(resA.buildStderr || resA.stderr, session.code) || 'Unknown error') });
    session.completed = true;
    session.running = false;
    session.exitCode = -1;
    if (statusEl) statusEl.textContent = '❌ Compilation Error';
    _termRender();
    return;
  }

  /* It compiled and it started. That is the moment the potion is for, and it
     is the only moment: an interactive program reaches here again after every
     line you type, which is what used to replay the sound mid-conversation. */
  _termCue(session, 'potion');

  const exitCode = resA.exitCode;
  session.exitCode = exitCode;
  const outA = resA.stdout || '';

  // ── Decide how much of the output is trustworthy & whether we must wait ──
  let waitingForInput = false;
  let safe = outA;
  let exact = false;          // did the probe tell us the read point precisely?

  if (probe) {
    // The instrumented build marks every read, so this boundary is not a guess:
    // everything before the first empty read is exactly what a real terminal
    // would have printed. The markers are stripped back out here.
    const split = termSplitAtBlockingRead(outA);
    safe = split.safe;
    waitingForInput = split.blocked;
    exact = split.instrumented;
  } else if (session.engine === 'GCC' && interactive && resB) {
    const outB = resB.stdout || '';
    if (outA !== outB || resA.exitCode !== resB.exitCode) {
      // The next (missing) input changes behavior → the program is waiting.
      safe = _termLCP(outA, outB);
      waitingForInput = true;
    }
  } else if (session.engine === 'JSCPP') {
    // _termRunJSCPP maps an EOF abort to exitCode 1 with accurate partial output.
    waitingForInput = exitCode !== 0 && session.expectsInput;
  }

  // A console shows your keystrokes ON the prompt line, and the newline that
  // appears right after a blocking read is really the echo of your Enter key.
  // Both probe runs emit that newline (they take different branches after the
  // read, but both branches start with one), so it lands inside the common
  // prefix and would otherwise close the prompt line and push the caret down a
  // row. Hold it back while we wait — the next step delivers it, which is when
  // Enter is actually pressed. The cost is that a prompt genuinely ending in a
  // newline also keeps its caret on the prompt line.
  if (!exact && waitingForInput && safe.endsWith('\n')) safe = safe.slice(0, -1);

  // Echo what was just typed. termEchoInput puts it on the prompt line when the
  // program left one open, which is where a real terminal shows it.
  if (session.inputs.length > session.echoCount) {
    termEchoInput(session, session.inputs[session.inputs.length - 1]);
    session.echoCount = session.inputs.length;
  }

  // ── Append only the new, trusted output ──
  let delta;
  if (safe.startsWith(session.displayed)) {
    delta = safe.slice(session.displayed.length);
  } else {
    delta = safe.slice(_termLCP(safe, session.displayed).length);
  }
  session.displayed = safe;
  _termAppendStdout(delta);

  if (waitingForInput) {
    session.running = false;
    // Keeps anything typed while the step was still computing.
    _termWarnRunaway(session, exitCode);
    termResumeInput(session, 'term-input');
    if (statusEl) statusEl.textContent = session.queue.length ? '⏳ Replaying input…' : '⏳ Waiting for input...';
    _termRender();
    _termPaintQueueChip();
    if (session.queue.length) setTimeout(() => { if (_term === session) _termDrainQueue(); }, 30);
    return;
  }

  // ── Program finished (or crashed) — show stderr/warnings + exit state ──
  if (exitCode < 0) {
    const sig = Math.abs(exitCode);
    const signalMap = {
      6: 'Aborted (SIGABRT)', 8: 'Floating Point Exception (SIGFPE)',
      9: 'Killed (SIGKILL)', 11: 'Segmentation Fault (SIGSEGV)',
      14: 'Time Limit Exceeded (SIGALRM)'
    };
    _termCue(session, 'punch');
    session.lines.push({ type: 'error', text: 'Runtime Error: ' + (signalMap[sig] || 'Signal ' + sig) });
    const errText = termCleanDiagnostics(resA.stderr, session.code);
    if (errText) session.lines.push({ type: 'error', text: errText });
    session.completed = true;
    session.running = false;
    if (statusEl) statusEl.textContent = '❌ ' + (signalMap[sig] || 'Signal ' + sig);
    _termRender();
    return;
  }

  const errText = termCleanDiagnostics(resA.stderr, session.code);
    if (errText) session.lines.push({ type: 'error', text: errText });
  const warnText = termCleanDiagnostics(resA.buildStderr, session.code);
  if (warnText) session.lines.push({ type: 'warning', text: '⚠️ ' + warnText });

  session.completed = true;
  session.running = false;
  // 143/137/124 mean the sandbox killed it — say so, rather than printing a
  // bare number that looks like the program chose to return it.
  const note = termExitNote(exitCode);
  // No cue here. The build was announced when it succeeded; a bad exit code
  // is reported in the line below and by the status, not by a second sound.
  session.lines.push({ type: note.ok ? 'info' : 'warning', text: note.line });
  if (statusEl) statusEl.textContent = note.status + (resA.execTime ? ' · ' + resA.execTime + 'ms' : '');
  _termRender();
}

/** Append raw text as stdout lines to the terminal */
function _termAppendStdout(text) {
  if (_term) termAppendStdout(_term, text);
}

function _termHandleInput(value) {
  if (!_term || _term.completed || _term.running || !_term.waiting) return;
  _term.pending = '';
  _term.waiting = false;

  // Accumulate stdin (newline-separated)
  _term.inputs.push(value);
  _term.accStdin = _term.inputs.join('\n') + '\n';

  // Re-run with accumulated stdin
  _termRunStep();
}

/**
 * Mirror the terminal's transcript into the strip under the editor, so the last
 * run stays readable after the modal is closed instead of the space sitting empty.
 */
function _mirrorRunOutput() {
  const strip = document.getElementById('editor-output-body');
  const wrap = document.getElementById('editor-output');
  if (!strip || !wrap || !_term) return;
  wrap.classList.add('has-output');
  strip.innerHTML = termMirrorHTML(_term);
  strip.scrollTop = strip.scrollHeight;
  const status = document.getElementById('editor-output-status');
  if (status) {
    status.textContent = _term.completed
      ? (_term.exitCode === 0 ? '✅ exit 0' : _term.exitCode == null ? '' : '⚠️ exit ' + _term.exitCode)
      : '⏳ running…';
  }
}

function clearRunOutput() {
  const strip = document.getElementById('editor-output-body');
  const wrap = document.getElementById('editor-output');
  if (strip) strip.innerHTML = '';
  if (wrap) wrap.classList.remove('has-output');
  const status = document.getElementById('editor-output-status');
  if (status) status.textContent = '';
}

function toggleRunOutput() {
  const wrap = document.getElementById('editor-output');
  if (!wrap) return;
  const collapsed = wrap.classList.toggle('collapsed');
  localStorage.setItem('practiceOutputCollapsed', collapsed ? '1' : '0');
  const ic = document.querySelector('#editor-output-toggle [data-lucide], #editor-output-toggle svg');
  if (ic) { ic.setAttribute('data-lucide', collapsed ? 'chevron-up' : 'chevron-down'); if (typeof lucide !== 'undefined') lucide.createIcons({ root: document.getElementById('editor-output-toggle') }); }
}

function _termRender() {
  const area = document.getElementById('term-output-area');
  _mirrorRunOutput();
  if (!area) return;

  // Follow the tail only if you were already at it. Pinning to the bottom on
  // every render meant scrolling up to read earlier output was undone instantly.
  const following = termAtBottom(area);

  // Replace ONLY the transcript. The hidden input is a sibling and is never
  // touched — moving it would blur it and swallow the next keystroke.
  const host = document.getElementById('term-lines');
  if (host) {
    const past = _termViewingHistory !== null ? _termHistory[_termViewingHistory] : null;
    host.innerHTML = past
      ? `<div class="term-line term-info">— run from ${escapeHTML(past.label)}, read-only —</div>` +
        termTranscriptHTML(past, '', false)
      : termTranscriptHTML(_term, _term.pending, _term.waiting);
  }
  // A render can land while the program is waiting (e.g. the first paint after
  // a step); make sure the caret is live.
  if (_term && _term.waiting && _termViewingHistory === null) termFocusInput('term-input');
  termScrollIfFollowing(area, following);
}

/** JSCPP fallback — returns same shape as Godbolt result */
function _termRunJSCPP(code, stdin) {
  return new Promise((resolve, reject) => {
    ensureJSCPP(() => {
      let output = '';
      try {
        const merged = preprocessMultiFile(code);
        const processed = preprocessCForJSCPP(merged);
        const exitCode = JSCPP.run(processed, stdin || '', {
          stdio: { write: (s) => { output += s; } },
          unsigned_overflow: 'warn'
        });
        resolve({ didExecute: true, exitCode: exitCode, stdout: output, stderr: '', buildStderr: '', execTime: null });
      } catch (err) {
        const msg = err.message || String(err);
        if (msg.includes('EOF') || msg.includes('Memory overflow')) {
          // Program needs more input — partial output already captured
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

/**
 * Comprehensive C → JSCPP Preprocessor.
 *
 * JSCPP is a C++ interpreter. It does NOT support:
 *   - malloc / calloc / realloc / free (no heap allocator)
 *   - sizeof (except as a compile-time literal we inject)
 *   - struct / union / enum as typedef patterns
 *   - goto, file I/O (fopen etc.)
 *
 * This preprocessor converts idiomatic C code into a form that JSCPP
 * can actually interpret, covering the patterns students encounter
 * in introductory C programming courses.
 */
/**
 * JSCPP drops every space that immediately follows a comma inside a string
 * literal: printf("Hello, World!") prints "Hello,World!". Measured behaviour:
 *
 *   "a, b"   -> "a,b"        "a ,b"  -> "a ,b"   (only AFTER a comma)
 *   "a,  b"  -> "a,b"        "a; b"  -> "a; b"   (only commas)
 *   printf("%d, %d", 1, 2) -> "1,2"  (format strings too)
 *
 * It is the literal that is damaged, not the output: the same text printed from
 * a variable comes out intact. Writing the space as its hex escape gets it past
 * whatever splits on commas, and JSCPP unescapes \x20 back to a space itself,
 * so the program prints exactly what the author wrote.
 *
 * Only Godbolt-less runs go through here, so real GCC output is untouched.
 */
function _jscppProtectCommaSpaces(code) {
  let out = '';
  let i = 0;
  const n = code.length;
  let inStr = false, inChar = false, inLine = false, inBlock = false;

  while (i < n) {
    const c = code[i];
    const next = code[i + 1];

    if (inLine) { out += c; if (c === '\n') inLine = false; i++; continue; }
    if (inBlock) { out += c; if (c === '*' && next === '/') { out += next; i += 2; inBlock = false; continue; } i++; continue; }

    if (!inStr && !inChar && c === '/' && next === '/') { out += c + next; i += 2; inLine = true; continue; }
    if (!inStr && !inChar && c === '/' && next === '*') { out += c + next; i += 2; inBlock = true; continue; }

    // Escapes pass through as a pair so a \" can't be mistaken for the end.
    if ((inStr || inChar) && c === '\\') { out += c + (next || ''); i += 2; continue; }

    if (!inChar && c === '"') { inStr = !inStr; out += c; i++; continue; }
    if (!inStr && c === "'") { inChar = !inChar; out += c; i++; continue; }

    if (inStr && c === ',') {
      out += c;
      i++;
      let spaces = 0;
      while (i < n && code[i] === ' ') { spaces++; i++; }
      out += '\\x20'.repeat(spaces);
      continue;
    }

    out += c;
    i++;
  }
  return out;
}

function preprocessCForJSCPP(code) {
  // ── 0. Work around the interpreter's comma-space bug first ──
  code = _jscppProtectCommaSpaces(code);

  // ── 1. Header mapping (C → C++) ──
  const headerMap = {
    '<stdio.h>': '<cstdio>',
    '<stdlib.h>': '<cstdlib>',
    '<string.h>': '<cstring>',
    '<math.h>': '<cmath>',
    '<ctype.h>': '<cctype>',
    '<limits.h>': '<climits>',
    '<stdbool.h>': '',
    '<assert.h>': '<cassert>',
    '<float.h>': '<cfloat>',
    '<time.h>': '<ctime>',
    '<stddef.h>': '',
    '<errno.h>': '',
    '<signal.h>': '',
    '<stdarg.h>': '',
  };

  let p = code;

  for (const [cH, cppH] of Object.entries(headerMap)) {
    const re = new RegExp('#\\s*include\\s*' + escapeRegex(cH), 'g');
    p = cppH ? p.replace(re, `#include ${cppH}`) : p.replace(new RegExp(re.source + '\\s*\\n?', 'g'), '');
  }

  // ── 2. Add 'using namespace std;' ──
  if (!p.includes('using namespace std')) {
    const li = p.lastIndexOf('#include');
    if (li !== -1) {
      const le = p.indexOf('\n', li);
      if (le !== -1) p = p.slice(0, le + 1) + 'using namespace std;\n' + p.slice(le + 1);
    }
  }

  // If no includes at all, add the basics
  if (!p.includes('#include')) {
    p = '#include <cstdio>\n#include <cstdlib>\nusing namespace std;\n' + p;
  }

  // ── 3. sizeof → numeric literals ──
  const sizeofMap = {
    'int': 4, 'unsigned int': 4, 'signed int': 4,
    'short': 2, 'unsigned short': 2, 'signed short': 2,
    'long': 4, 'unsigned long': 4, 'signed long': 4,
    'long long': 8, 'unsigned long long': 8,
    'char': 1, 'unsigned char': 1, 'signed char': 1,
    'float': 4, 'double': 8,
    'bool': 1,
    'int*': 4, 'char*': 4, 'float*': 4, 'double*': 4, 'void*': 4,
  };
  // sizeof(type)
  p = p.replace(/sizeof\s*\(\s*([^)]+?)\s*\)/g, (match, typeExpr) => {
    const t = typeExpr.replace(/\s+/g, ' ').trim();
    if (sizeofMap[t] !== undefined) return String(sizeofMap[t]);
    // sizeof(type *) → 4
    if (t.endsWith('*')) return '4';
    // sizeof(variable) – leave as-is for JSCPP to handle, but most likely it's a type
    return match;
  });

  // ── 4. Dynamic memory: malloc / calloc → VLA (Variable-Length Array) ──
  // Pattern: type *name = (type*)malloc(expr * sizeof(type));
  // → type name[expr];
  // Also: type *name = (type*)calloc(n, sizeof(type));
  // → type name[n]; memset-equivalent not needed, JSCPP zero-inits

  // malloc with sizeof already resolved (sizeof replaced to number above)
  // e.g. int *arr = (int*)malloc(n * 4);
  p = p.replace(
    /(\w[\w\s]*?)\s*\*\s*(\w+)\s*=\s*\([^)]*\)\s*malloc\s*\(\s*(.+?)\s*\*\s*\d+\s*\)\s*;/g,
    (match, type, name, countExpr) => {
      const t = type.trim();
      return `${t} ${name}[${countExpr.trim()}];`;
    }
  );
  // malloc with just an expression: int *arr = (int*)malloc(n);
  p = p.replace(
    /(\w[\w\s]*?)\s*\*\s*(\w+)\s*=\s*\([^)]*\)\s*malloc\s*\(\s*(.+?)\s*\)\s*;/g,
    (match, type, name, expr) => {
      const t = type.trim();
      return `${t} ${name}[${expr.trim()}];`;
    }
  );
  // malloc without cast: int *arr = malloc(expr);
  p = p.replace(
    /(\w[\w\s]*?)\s*\*\s*(\w+)\s*=\s*malloc\s*\(\s*(.+?)\s*\)\s*;/g,
    (match, type, name, expr) => {
      const t = type.trim();
      // Try to extract count from expr like "n * sizeof(int)" → n
      const countMatch = expr.match(/^(.+?)\s*\*\s*\d+$/);
      const count = countMatch ? countMatch[1].trim() : expr.trim();
      return `${t} ${name}[${count}];`;
    }
  );
  // calloc: int *arr = (int*)calloc(n, sizeof(int));
  p = p.replace(
    /(\w[\w\s]*?)\s*\*\s*(\w+)\s*=\s*(?:\([^)]*\)\s*)?calloc\s*\(\s*(.+?)\s*,\s*(?:sizeof\s*\([^)]*\)|\d+)\s*\)\s*;/g,
    (match, type, name, countExpr) => {
      const t = type.trim();
      return `${t} ${name}[${countExpr.trim()}];`;
    }
  );
  // realloc – just leave the variable as-is (best-effort)
  p = p.replace(
    /(\w+)\s*=\s*(?:\([^)]*\)\s*)?realloc\s*\([^)]*\)\s*;/g,
    '/* realloc not supported in browser interpreter */'
  );

  // ── 5. Remove free() calls ──
  p = p.replace(/\bfree\s*\([^)]*\)\s*;/g, '/* free removed – browser interpreter */');

  // ── 6. Remove system("pause") and similar ──
  p = p.replace(/\bsystem\s*\(\s*"pause"\s*\)\s*;/g, '');
  p = p.replace(/\bgetch\s*\(\s*\)\s*;/g, '');

  // ── 7. Handle typedef struct patterns ──
  // typedef struct { ... } Name;  →  (JSCPP doesn't support this)
  // We'll try to convert simple struct usage but complex ones will still fail

  // ── 8. Convert C99 bool to C++ bool ──
  // (stdbool.h removed above, so true/false/bool should work natively)

  // ── 9. Handle void main() → int main() ──
  p = p.replace(/\bvoid\s+main\s*\(/g, 'int main(');

  return p;
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Execute C code in the browser using JSCPP.
 * Handles stdin consumption and echoes input values into the output
 * to mimic a real terminal experience.
 */
function executeBrowserCode(code, stdin = '') {
  const outputEl = document.getElementById('run-code-output');
  const statusEl = document.getElementById('run-code-status');
  if (!outputEl || !statusEl) return;

  outputEl.innerHTML = '<span class="run-code-compiling"><i data-lucide="loader" class="run-code-spinner"></i> Compiling & Running...</span>';
  statusEl.textContent = '⏳ Interpreting code...';
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: outputEl });

  setTimeout(() => {
    if (typeof JSCPP === 'undefined') {
      outputEl.textContent = 'Error: JSCPP library not loaded.\n\nMake sure you have internet connection on first load\nto download the interpreter engine.';
      outputEl.className = 'run-code-output run-code-error';
      statusEl.textContent = '❌ Interpreter not available';
      return;
    }

    let capturedOutput = '';

    try {
      const processedCode = preprocessCForJSCPP(code);

      const exitCode = JSCPP.run(processedCode, stdin, {
        stdio: {
          write: function (s) {
            capturedOutput += s;
          }
        },
        unsigned_overflow: 'warn'
      });

      // ── Build terminal-style output with echoed stdin ──
      const finalOutput = buildTerminalOutput(capturedOutput, stdin, code);

      if (finalOutput.length === 0) {
        outputEl.textContent = '(No output)\n\nProgram exited with code ' + exitCode;
        outputEl.className = 'run-code-output run-code-success';
      } else {
        outputEl.textContent = finalOutput;
        outputEl.className = 'run-code-output run-code-success';
      }
      statusEl.textContent = '✅ Executed Successfully (exit code: ' + exitCode + ')';

    } catch (err) {
      const errMsg = err.message || String(err);

      // ── Friendly error mapping ──
      if (errMsg.includes('parse') || errMsg.includes('unexpected') || errMsg.includes('Syntax') || errMsg.includes('missing')) {
        outputEl.textContent = 'Compilation Error:\n\n' + errMsg;
        outputEl.className = 'run-code-output run-code-error';
        statusEl.textContent = '❌ Syntax / Compilation Error';
      } else if (errMsg.includes('variable malloc does not exist') || errMsg.includes('variable calloc does not exist') || errMsg.includes('variable realloc does not exist')) {
        outputEl.textContent = 'Unsupported Feature: Dynamic Memory Allocation\n\nThe browser interpreter does not support malloc/calloc/realloc.\nYour code has been auto-converted to use stack arrays where possible,\nbut this pattern could not be converted automatically.\n\nTip: Use fixed-size arrays instead, e.g.:\n  int arr[100]; instead of int *arr = (int*)malloc(100 * sizeof(int));';
        outputEl.className = 'run-code-output run-code-warning';
        statusEl.textContent = '⚠️ Unsupported Feature';
      } else if (errMsg.includes('does not exist')) {
        const varMatch = errMsg.match(/variable (\w+) does not exist/);
        const varName = varMatch ? varMatch[1] : 'unknown';
        outputEl.textContent = `Unsupported Feature:\n\n"${varName}" is not available in the browser interpreter.\n\nSupported libraries: stdio (printf, scanf, getchar, gets, puts),\nstdlib (rand, srand, atoi, abs, qsort), cmath, cstring, cctype, ctime.\n\nUnsupported: malloc/free, file I/O (fopen/fclose), threads, networking.`;
        outputEl.className = 'run-code-output run-code-warning';
        statusEl.textContent = '⚠️ Unsupported Feature';
      } else if (errMsg.includes('not supported') || errMsg.includes('not implemented')) {
        outputEl.textContent = 'Unsupported Feature:\n\n' + errMsg + '\n\n(The browser interpreter supports most standard C constructs\nbut some advanced features may not be available.)';
        outputEl.className = 'run-code-output run-code-warning';
        statusEl.textContent = '⚠️ Unsupported Feature';
      } else if (errMsg.includes('Memory overflow') || errMsg.includes('EOF')) {
        // Program ran out of stdin – show what it printed so far + blinking cursor
        const partialOutput = buildTerminalOutput(capturedOutput, stdin, code);
        outputEl.innerHTML = escapeHTML(partialOutput) + '<span class="run-code-cursor"></span>';
        outputEl.className = 'run-code-output run-code-success';
        statusEl.textContent = '⏳ Waiting for input...';

        // Show floating toast
        const existingToast = document.getElementById('run-code-toast');
        if (existingToast) existingToast.remove();

        const toast = document.createElement('div');
        toast.id = 'run-code-toast';
        toast.className = 'run-code-toast run-code-toast-warning';
        toast.innerHTML = `
          <div style="display:flex; align-items:flex-start; gap:0.5rem; line-height: 1.4;">
            <i data-lucide="alert-triangle" style="margin-top:2px;"></i>
            <span>Program paused: Waiting for input... Please enter it in the Standard Input box and click Run.</span>
          </div>
          <button onclick="this.parentElement.remove()" style="background:none; border:none; color:inherit; cursor:pointer; padding:0; margin-left:1rem; opacity:0.8;"><i data-lucide="x" style="width:16px;height:16px;"></i></button>
        `;
        document.body.appendChild(toast);
        if (typeof lucide !== 'undefined') lucide.createIcons({ root: toast });

        setTimeout(() => {
          if (document.body.contains(toast)) toast.remove();
        }, 7000);
      } else {
        outputEl.textContent = 'Runtime Error:\n\n' + errMsg;
        outputEl.className = 'run-code-output run-code-error';
        statusEl.textContent = '❌ Runtime Error';
      }
    }
  }, 50);
}

/**
 * Build terminal-style output by interleaving program output with echoed stdin.
 *
 * In a real terminal, when scanf reads input, the user's typed value is echoed
 * on-screen followed by a newline (from pressing Enter). JSCPP doesn't do this,
 * so we reconstruct it by detecting where each scanf consumed a value and
 * injecting the input tokens into the output stream at the correct positions.
 */
function buildTerminalOutput(rawOutput, stdin, originalCode) {
  if (!stdin || !stdin.trim()) return rawOutput;

  // Count how many scanf / cin reads the code has
  const scanfMatches = originalCode.match(/scanf\s*\(/g);
  const cinMatches = originalCode.match(/cin\s*>>/g);

  if (!scanfMatches && !cinMatches) return rawOutput;

  // Count the total number of format specifiers across all scanf calls
  let totalReads = 0;
  if (scanfMatches) {
    // For each scanf call, count format specifiers like %d, %f, %s, %c, etc.
    const scanfCalls = originalCode.match(/scanf\s*\(\s*"([^"]*)"/g);
    if (scanfCalls) {
      for (const call of scanfCalls) {
        const fmtMatch = call.match(/"([^"]*)"/);
        if (fmtMatch) {
          const specs = fmtMatch[1].match(/%[*]?[0-9]*[diouxXeEfFgGaAcspn]/g);
          totalReads += specs ? specs.length : 0;
        }
      }
    }
  }
  if (cinMatches) {
    totalReads += cinMatches.length;
  }

  if (totalReads === 0) return rawOutput;

  // Split stdin into individual tokens (by whitespace/newlines)
  const inputTokens = stdin.trim().split(/[\s]+/);
  const tokensToEcho = inputTokens.slice(0, totalReads);

  if (tokensToEcho.length === 0) return rawOutput;

  // Strategy: Insert each input token + newline into the raw output
  // at the boundaries where printf output segments meet.
  // 
  // The raw output from JSCPP contains all printf output concatenated.
  // For a typical pattern like:
  //   printf("Enter: "); scanf("%d",&n); printf("%d", n);
  // The rawOutput would be: "Enter: 5"
  // We want:                "Enter: 5\n5"
  // 
  // We detect printf output segments by looking at the source code structure.
  // Simple approach: append echo after each newline-less prompt that precedes a scanf.

  // Build a simple interleaved version
  let result = rawOutput;

  // For each input token, find where it appears in the output and add a newline after it
  // This handles the common case where printf prints the value right after scanf consumed it
  for (let i = 0; i < tokensToEcho.length; i++) {
    const token = tokensToEcho[i];
    // Find the first occurrence of this token in the remaining result that doesn't 
    // already have a newline after it
    const idx = result.indexOf(token);
    if (idx !== -1) {
      const afterIdx = idx + token.length;
      // If the character right after the token is NOT already a newline, insert one
      if (afterIdx < result.length && result[afterIdx] !== '\n') {
        result = result.slice(0, afterIdx) + '\n' + result.slice(afterIdx);
      }
    }
  }

  return result;
}

// ── Remote Compiler Engine (Godbolt Compiler Explorer — free, no key) ──

/**
 * Build a single translation unit from all user files so GCC compiles everything.
 *
 * 1. Save the active editor to state so all files have latest code.
 * 2. Recursively inline every #include "localfile" (with include-guard to avoid dupes).
 * 3. Append every .c source file that ISN'T the main file and wasn't already inlined,
 *    so function implementations in companion .c files get compiled too.
 */
function preprocessMultiFile(code) {
  if (!state.userFiles || state.userFiles.length <= 1) return code;

  // Persist current editor content so we get the latest for every file
  savePracticeFileCode();

  const included = new Set(); // track filenames already inlined

  /** Recursively resolve #include "file" directives against userFiles */
  function inlineIncludes(src) {
    return src.replace(/#include\s*"([^"]+)"/g, (match, filename) => {
      // Skip if already inlined (include-guard)
      if (included.has(filename)) return '/* already included ' + filename + ' */';
      const file = state.userFiles.find(f => (f.name + f.ext) === filename);
      if (file && file.userCode != null) {
        included.add(filename);
        // Recursively resolve nested local includes inside this file
        const resolved = inlineIncludes(file.userCode);
        return '/* ── ' + filename + ' ── */\n' + resolved + '\n/* ── end ' + filename + ' ── */';
      }
      return match; // not a local file — leave for the system include path
    });
  }

  // Inline includes in the main file
  let result = inlineIncludes(code);

  // The file you pressed Run on is already here; don't append it again.
  const activeFile = state.userFiles[state.activeFileIndex];
  if (activeFile) included.add(activeFile.name + activeFile.ext);

  const isSource = (f) => f.ext === '.c' || f.ext === '.cpp';
  const hasBody = (f) => f.userCode != null && f.userCode.trim() !== '';
  /* A DEFINITION of main, not a mention of one. Anchored to the start of a
     line because that is where a definition is written, which keeps
     printf("main") and a commented-out one out of it. */
  const DEFINES_MAIN = /^[\t ]*(?:int|void)\s+main\s*\(/m;

  const append = (f, why) => {
    included.add(f.name + f.ext);
    result += '\n\n/* ── ' + f.name + f.ext + ' (' + why + ') ── */\n'
            + inlineIncludes(f.userCode)
            + '\n/* ── end ' + f.name + f.ext + ' ── */';
  };

  /* Link a companion .c to the HEADER THAT DECLARES IT, and to nothing else.

     This used to append every .c file in the attempt, related or not, which is
     how running a self-contained header ended up compiling main.c beside it:
     two definitions of main in one translation unit, and a wall of errors
     about a file you were not even looking at.

     The pairing used here is the one C itself uses -- utils.c is the
     implementation of utils.h, so it belongs in the unit exactly when utils.h
     is in the unit. A file that nothing includes is not part of this program.

     Repeated until nothing new arrives, since a file linked this way can
     include a header whose own .c then belongs here too. */
  const linkPass = () => {
    let added = false;
    for (const f of state.userFiles) {
      if (included.has(f.name + f.ext) || !isSource(f) || !hasBody(f)) continue;
      if (!included.has(f.name + '.h') && !included.has(f.name + '.hpp')) continue;
      append(f, 'linked: implements ' + f.name + '.h');
      added = true;
    }
    return added;
  };
  while (linkPass()) { /* until stable */ }

  /* Nothing in here can start. A companion file has no main of its own, and
     running one should still run the program it belongs to rather than fail to
     link -- so the file that does define main is brought in, and its headers
     get their partners linked in turn.

     A file that DOES define its own main never reaches this, which is what
     lets a self-contained header run on its own. */
  if (!DEFINES_MAIN.test(result)) {
    const starter = state.userFiles.find(f =>
      !included.has(f.name + f.ext) && isSource(f) && hasBody(f) && DEFINES_MAIN.test(f.userCode));
    if (starter) {
      append(starter, 'linked: defines main');
      while (linkPass()) { /* headers the starter pulled in */ }
    }
  }

  return result;
}

/** Raw Godbolt compile+run on an already-merged translation unit (no preprocessing).
 *  Aborts after 25s so a hung request can't leave the UI spinning forever. */
async function _godboltCompileRun(processedCode, stdin, externalAborter, userArgs) {
  // Reuse the caller's controller when given one, so a Stop button can cancel
  // the request. The 25 s guard still applies either way.
  const aborter = externalAborter || new AbortController();
  const timeoutId = setTimeout(() => aborter.abort(), 25000);
  let response;
  try {
    response = await fetch('https://godbolt.org/api/compiler/cg132/compile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      signal: aborter.signal,
      body: JSON.stringify({
        source: processedCode,
        options: {
          userArguments: userArgs || (typeof termCompilerArgs === 'function' ? termCompilerArgs() : '-Wall -lm'),
          executeParameters: { args: [], stdin: stdin || '' },
          compilerOptions: { executorRequest: true },
          filters: { execute: true }
        },
        lang: 'c'
      })
    });
  } catch (e) {
    throw (e && e.name === 'AbortError') ? new Error('TIMEOUT') : e;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) throw new Error('HTTP_' + response.status);

  const r = await response.json();
  const joinText = (arr) => (arr || []).map(o => o.text || '').join('\n');

  return {
    didExecute: r.didExecute !== false,
    exitCode: r.code != null ? r.code : (r.didExecute === false ? -1 : 0),
    stdout: joinText(r.stdout),
    stderr: joinText(r.stderr),
    buildStderr: joinText(r.buildResult ? r.buildResult.stderr : null),
    execTime: r.execTime
  };
}

async function executeWithGodbolt(code, stdin) {
  return _godboltCompileRun(preprocessMultiFile(code), stdin);
}

// ============================================================
// TEST-CASE GRADING (Submit runs authored stdin→stdout tests)
// ============================================================

/** Normalize program output for comparison: CRLF→LF, strip trailing ws per line and overall. */
function _normalizeOutput(s) {
  return String(s == null ? '' : s).replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').replace(/\s+$/, '');
}

/** Merge the user's files into one translation unit for grading (savePracticeFileCode already ran). */
function _buildSubmissionSource() {
  const entry = (state.userFiles && state.userFiles[state.activeFileIndex]) || null;
  const base = entry ? (entry.userCode || '') : (state.userCode || '');
  return preprocessMultiFile(base);
}

/** JSCPP fallback for grading — source is already merged. Same result shape as Godbolt. */
function _gradeRunJSCPP(processedSource, stdin) {
  return new Promise((resolve, reject) => {
    ensureJSCPP(() => {
      let output = '';
      try {
        const processed = preprocessCForJSCPP(processedSource);
        const exitCode = JSCPP.run(processed, stdin || '', { stdio: { write: (s) => { output += s; } }, unsigned_overflow: 'warn' });
        resolve({ didExecute: true, exitCode: exitCode, stdout: output, stderr: '', buildStderr: '' });
      } catch (err) {
        const msg = err.message || String(err);
        if (msg.includes('EOF') || msg.includes('Memory overflow')) {
          resolve({ didExecute: true, exitCode: 1, stdout: output, stderr: 'Program asked for more input than the test provided.', buildStderr: '' });
        } else if (msg.includes('parse') || msg.includes('Syntax') || msg.includes('unexpected')) {
          resolve({ didExecute: false, exitCode: -1, stdout: '', stderr: msg, buildStderr: msg });
        } else {
          reject(err);
        }
      }
    });
  });
}

/**
 * Run the submission against each authored test case.
 * Prefers Godbolt (real GCC); if it's unreachable, falls back to the local JSCPP
 * interpreter for the remaining tests.
 * @param {Array} tests  [{ name, stdin, expected, hidden }]
 * @returns {Promise<Array<{name,hidden,passed,stdin,expected,actual,error}>>}
 */
async function runTestCases(tests, sourceOverride) {
  const merged = sourceOverride != null ? sourceOverride : _buildSubmissionSource();
  let useJSCPP = false;
  const results = new Array(tests.length);
  let done = 0;

  async function runOne(i) {
    const t = tests[i];
    const stdin = t.stdin || '';
    let res = null, error = '';

    try {
      if (!useJSCPP) {
        try {
          res = await _godboltCompileRun(merged, stdin);
        } catch (e) {
          useJSCPP = true; // Godbolt down — switch engines for this and remaining tests
        }
      }
      if (useJSCPP) {
        res = await _gradeRunJSCPP(merged, stdin);
      }
    } catch (e) {
      res = null;
      error = (e && e.message) ? e.message : String(e);
    }

    let passed = false, actual = '';
    if (res && res.didExecute) {
      actual = res.stdout || '';
      if (typeof res.exitCode === 'number' && res.exitCode < 0) {
        const sig = Math.abs(res.exitCode);
        error = sig === 11 ? 'Segmentation fault' : sig === 8 ? 'Arithmetic error' : 'Runtime error (signal ' + sig + ')';
      }
      passed = _normalizeOutput(actual) === _normalizeOutput(t.expected || '');
    } else if (res && !res.didExecute) {
      error = 'Compilation error';
      actual = res.buildStderr || res.stderr || '';
    } else if (!error) {
      error = 'Could not run this test';
    }

    results[i] = {
      name: t.name || ('Case ' + (i + 1)), hidden: !!t.hidden,
      passed, stdin, expected: t.expected || '', actual, error
    };
    done++;
    _setSubmitProgress(done, tests.length);
  }

  // Run up to 3 tests at a time — each is an independent compile+run, so
  // parallelism cuts multi-test grading time roughly 3x without hammering Godbolt.
  const CONCURRENCY = 3;
  let next = 0;
  async function worker() {
    while (next < tests.length) {
      const i = next++;
      await runOne(i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, tests.length) }, worker));
  return results;
}

/** Update the submit button's "Running tests…" label with live progress. */
function _setSubmitProgress(done, total) {
  const btn = _practiceSubmitBtn();
  if (!btn || btn._origHTML == null) return; // not in running state
  const label = btn.querySelector('.submit-progress-label');
  if (label) label.textContent = `Running tests… ${done}/${total}`;
}

/** Toggle the Submit button into a "running tests" spinner state. */
function _setSubmitRunning(running) {
  const btn = _practiceSubmitBtn();
  if (!btn) return;
  if (running) {
    if (btn._origHTML == null) btn._origHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader" class="run-code-spinner" style="width:16px;height:16px;"></i> <span class="submit-progress-label">Running tests…</span>';
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: btn });
  } else {
    if (btn._origHTML != null) { btn.innerHTML = btn._origHTML; btn._origHTML = null; }
    btn.disabled = false;
  }
}

/* executeCode and _displayGodboltResult removed — interactive terminal (_termRunStep) handles all display */

// ── Pause/Resume Timer ──
function togglePauseTimer() {
  if (!state.sessionData) return;

  const icon = document.getElementById('pause-timer-icon');
  const editorArea = document.querySelector('.practice-editor-area');
  const timerEl = document.getElementById('practice-timer');

  if (state.sessionData.paused) {
    const pauseDuration = Date.now() - state.sessionData.pausedAt;
    state.sessionData.startTime += pauseDuration;
    state.sessionData.paused = false;
    state.sessionData.pausedAt = null;

    if (editorArea) editorArea.classList.remove('editor-paused');
    if (icon) icon.setAttribute('data-lucide', 'pause');
    // 'PAUSED' left a bare text node behind; clear it so the ms field rebuilds.
    if (timerEl) { timerEl.classList.remove('timer-paused'); timerEl.textContent = ''; }

    _practiceStartTimerTicker();
  } else {
    state.sessionData.paused = true;
    state.sessionData.pausedAt = Date.now();

    if (window.activeTimerInterval) clearInterval(window.activeTimerInterval);
    if (editorArea) editorArea.classList.add('editor-paused');
    if (icon) icon.setAttribute('data-lucide', 'play');
    if (timerEl) {
      timerEl.classList.add('timer-paused');
      timerEl.innerText = 'PAUSED';
    }
  }

  const pauseBtn = document.getElementById('pause-timer-btn');
  if (typeof lucide !== 'undefined') lucide.createIcons(pauseBtn ? { root: pauseBtn } : undefined);
}

// ── Per-File Reset ──
function resetSingleFile(fi) {
  if (!state.userFiles || fi >= state.userFiles.length) return;
  const file = state.userFiles[fi];
  const fileName = file.name + file.ext;

  showConfirm('Reset File', `Reset "${fileName}" to its starter code? This won't affect other files or the timer.`, () => {
    // This file's text is being replaced, so its folds no longer describe it.
    if (typeof edFoldReset === 'function') edFoldReset();
    const variant = state.activeVariant;
    const originalFile = variant.files ? variant.files[fi] : null;
    state.userFiles[fi].userCode = originalFile ? (originalFile.starterCode || '') : '';

    if (fi === state.activeFileIndex) {
      loadPracticeFile(fi);
    } else {
      renderPracticeFileTabs();
    }

    const textarea = document.getElementById('editor-textarea');
    if (textarea) updateBossHealthBar(textarea.value);
  });
}

// ── Hint System ──

/**
 * Render the hints block. Shared by the single-program page and the practice-set
 * page — sets used to have no hints UI at all, so putting a program with hints
 * into a set silently threw them away.
 * @param {string} hostId container id
 * @param {string[]} hints
 * @param {number} used how many are already revealed
 * @param {string} revealFn name of the global click handler
 */
function renderHintsBlock(hostId, hints, used, revealFn) {
  const host = document.getElementById(hostId);
  if (!host) return;
  hints = hints || [];
  if (!hints.length) { host.innerHTML = ''; return; }
  used = Math.max(0, Math.min(used || 0, hints.length));
  const done = used >= hints.length;

  host.innerHTML = `
    <div style="margin-top:0.5rem;">
      <h2 style="font-size:0.875rem; font-weight:700; color:#e6edf3; margin-bottom:0.5rem;">Hints</h2>
      <div id="hints-revealed-list">${
        hints.slice(0, used).map((h, i) =>
          `<div class="hint-item"><span class="hint-number">${i + 1}</span> ${escapeHTML(h)}</div>`).join('')
      }</div>
      <button id="hint-reveal-btn" class="btn btn-secondary btn-sm" onclick="${revealFn}()"
              style="width:100%; margin-top:0.5rem;${done ? 'opacity:0.5;' : ''}" ${done ? 'disabled' : ''}>
        <i data-lucide="lightbulb" style="width:14px;height:14px;"></i>
        ${done ? 'All hints revealed' : `Show Hint (−5%) · <span id="hint-count">${used}</span>/${hints.length} used`}
      </button>
    </div>`;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: host });
}

/** Wipe the revealed-hint list, counter and score penalty so a retry starts clean. */
function _resetHintsForNewAttempt() {
  if (state.sessionData) state.sessionData.hintsUsed = 0;
  renderHintsBlock('practice-hints-container',
    (state.activeVariant && state.activeVariant.hints) || [], 0, 'revealNextHint');
}

function revealNextHint() {
  if (!state.activeVariant || !state.activeVariant.hints) return;
  const hints = state.activeVariant.hints;
  const used = state.sessionData.hintsUsed || 0;
  if (used >= hints.length) return;
  state.sessionData.hintsUsed = used + 1;
  renderHintsBlock('practice-hints-container', hints, state.sessionData.hintsUsed, 'revealNextHint');
}

// ── Difficulty Badge ──
function getDifficulty(challenge) {
  if (challenge.difficulty) return challenge.difficulty;
  const logs = state.history.filter(h => h.challengeId === challenge.id);
  if (logs.length < 2) return null;
  const avg = logs.reduce((s, l) => s + l.score, 0) / logs.length;
  if (avg > 80) return 'easy';
  if (avg >= 50) return 'medium';
  return 'hard';
}

function getDifficultyBadgeHTML(challenge) {
  const diff = getDifficulty(challenge);
  if (!diff) return '';
  const colors = { easy: '#10b981', medium: '#f59e0b', hard: '#ef4444' };
  const labels = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
  return `<span class="difficulty-badge" style="--diff-color:${colors[diff]};">${labels[diff]}</span>`;
}


/* ── Editing the description mid-attempt ──────────────────────
   A description that turns out to be wrong, or missing the one constraint that
   matters, used to mean abandoning the attempt, going to the admin form, fixing
   it and starting again. The same editor the admin form uses opens over the
   attempt instead. It writes to the program itself, so the correction is there
   next time too — that is the point of fixing it rather than noting it. */

let _pdQuill = null;

window.practiceEditDescription = function () {
  const variant = state.activeVariant;
  if (!variant) return;

  let ov = document.getElementById('practice-desc-modal');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'practice-desc-modal';
    ov.className = 'modal-overlay';
    document.body.appendChild(ov);
  }
  ov.classList.remove('hidden');
  // af-rich-block carries the editor's chrome and its toolbar tooltips, so the
  // control looks and behaves the same here as in the admin form.
  ov.innerHTML = `
    <div class="modal-content pd-modal af-rich-block" onclick="event.stopPropagation()">
      <div class="pd-head">
        <h2><i data-lucide="pencil"></i> Edit description</h2>
        <button class="btn btn-ghost pd-close" onclick="practiceCloseDescription()" aria-label="Close">
          <i data-lucide="x"></i>
        </button>
      </div>
      <div class="af-rich" id="practice-desc-editor"></div>
      <p class="pd-note">
        <i data-lucide="info"></i>
        Saved to the program, so the correction is there on your next attempt too.
      </p>
      <div class="pd-actions">
        <button class="btn btn-secondary" onclick="practiceCloseDescription()">Cancel</button>
        <button class="btn btn-primary" onclick="practiceSaveDescription()">
          <i data-lucide="check"></i> Save description
        </button>
      </div>
    </div>`;

  ov.onclick = () => practiceCloseDescription();

  if (window.Quill) {
    const q = new Quill('#practice-desc-editor', {
      theme: 'snow',
      placeholder: 'What should this program do?',
      modules: { toolbar: typeof AF_DESC_TOOLBAR !== 'undefined' ? AF_DESC_TOOLBAR : true }
    });
    _pdQuill = q;
    const current = variant.description || (state.activeChallenge && state.activeChallenge.description) || '';
    q.clipboard.dangerouslyPasteHTML(
      typeof afDescToHTML === 'function' ? afDescToHTML(current) : current, 'silent');
    if (typeof afLabelToolbar === 'function') afLabelToolbar(q.getModule('toolbar').container);
    q.focus();
  }

  if (typeof lucide !== 'undefined') lucide.createIcons({ el: ov });
};

window.practiceSaveDescription = function () {
  const variant = state.activeVariant;
  if (!variant) { practiceCloseDescription(); return; }
  if (_pdQuill) {
    // Same rule as the admin form: an empty Quill document is "<p><br></p>",
    // which would read as a description that exists and says nothing.
    variant.description = _pdQuill.getText().trim() ? _pdQuill.root.innerHTML : '';
  }
  if (typeof saveData === 'function') saveData();

  const el = document.getElementById('practice-desc');
  if (el) {
    el.innerHTML = (typeof formatRichText === 'function'
      ? formatRichText(variant.description)
      : escapeHTML(variant.description)) || 'No description provided.';
  }
  practiceCloseDescription();
  if (typeof toast === 'function') toast('Description updated.', { type: 'success' });
};

window.practiceCloseDescription = function () {
  const ov = document.getElementById('practice-desc-modal');
  _pdQuill = null;
  if (ov) { ov.classList.add('hidden'); ov.innerHTML = ''; ov.onclick = null; }
};

/* Escape closes this before anything else on the practice screen acts on it —
   otherwise it would fall through to zen mode or the terminal. */
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const ov = document.getElementById('practice-desc-modal');
  if (!ov || ov.classList.contains('hidden')) return;
  e.stopPropagation();
  practiceCloseDescription();
}, true);

/**
 * The run's verdict, said once.
 *
 * An interactive program is compiled and run repeatedly: once to reach the
 * first prompt, then again after each thing you type, each pass replaying the
 * whole program from the top with more stdin. Every one of those passes ends,
 * so the cue fired on every one of them — a potion after each keystroke of
 * input, which is both wrong and maddening.
 *
 * A run has one outcome, so it gets one sound. The flag lives on the session,
 * which is replaced whenever Run or Restart is pressed, so a genuinely new
 * run does announce itself again.
 */
function _termCue(session, which) {
  if (!session) return;
  if (which === 'potion') {
    if (session.cuedOk) return;
    session.cuedOk = true;
    if (typeof psfxLevelUp === 'function') psfxLevelUp();
    return;
  }
  /* Tracked separately from the potion rather than sharing one flag. A program
     that builds cleanly and then segfaults has done two distinct things, and
     collapsing them would let a crash pass in silence behind the sound that
     said the build was fine. */
  if (session.cuedBad) return;
  session.cuedBad = true;
  if (typeof psfxPunch === 'function') psfxPunch();
}
