/* ============================================================
   NOTES-PRACTICE.JS — MCQ Notebook Practice + Inline Review
   ============================================================ */

let activeNotebook = null;
let timeLimit = 0;
let timeRemaining = 0;
let timerInterval = null;
let practiceStartTime = null;
let npFinishedAt = null;   // set when every question is answered — timer pauses here

let currentSectionIdx = 0;
let currentQuestionNum = 1;

// Session tracking
let sessionAnswers = [];   // answers[secIdx][qNum] = 'A'
let sessionStatus = [];    // status[secIdx][qNum] = 'unopened'|'opened'|'answered'

// Review mode
let reviewMode = false;
let isCheckingAnswer = false; // Flag to lock UI during grading delay
let gradeAdvanceTimer = null;  // setTimeout ID for auto-advance after correct answer
let gradeResults = [];     // gradeResults[secIdx][qNum] = 'correct'|'wrong'|'skipped'
let answerKeys = [];       // answerKeys[secIdx] = { qNum: { answer: 'A', explanation: '...' }, ... }
let reviewRecord = null;   // The saved record for review
let npTextAlignCenter = localStorage.getItem('npTextAlign') !== 'left'; // default centered

/* Text typed into an answer box but not submitted yet, per section and
   question. It used to live only in the textarea, so moving to another
   question or reloading emptied it. Saved with the progress, put back when
   the question is shown, and graded at submission if it was never sent. */
let npTextDrafts = [];

/* Chosen at the start (notes.js notesConfirmStart): no going back to a
   question once it is behind you, and optionally a number of seconds for each
   one. The per-question clock only exists with no backtracking -- with
   backtracking, running out could be undone by coming back. */
let npNoBack = false;
let npQSec = 0;
let npQLeft = 0;        // seconds left on the question in npQKey
let npQKey = '';
let npQTimer = null;

/* Paused from the clock in the topbar. Both clocks stop, the question is
   veiled, and the paused stretch is taken out of the recorded duration. */
let npPaused = false;
let _npPausedAt = 0;

/* "Confirm before grading": the picked choice, waiting for a second press. */
let npPendingPick = null;   // { key: 'sec-q', letter }

/* Set once the attempt is submitted. Leaving the screen (and pagehide) saves
   the progress draft; after a submission that wrote the finished attempt back
   as "unfinished", and the next visit offered to resume it. */
let npSubmitted = false;

/* ----------------------------------------------------------
   INITIALIZATION
   ---------------------------------------------------------- */
function initNotesPracticeSession() {
  // NOTE: do not call loadData() here. State is already loaded by the SPA boot,
  // and re-reading localStorage mid-session can clobber freshly cloud-synced data.

  // Reset session state from any previous practice/review
  reviewMode = false;
  reviewRecord = null;
  isCheckingAnswer = false;
  npFlags = [];
  npBindKeys();
  if (gradeAdvanceTimer !== null) { clearTimeout(gradeAdvanceTimer); gradeAdvanceTimer = null; }

  const npRoot = document.getElementById('notes-practice-view') || document.getElementById('main-content');
  if (typeof lucide !== 'undefined') lucide.createIcons(npRoot ? { root: npRoot } : undefined);

  let nbId = getSessionParam('activeNotebook');
  const reviewRecordId = getSessionParam('reviewNotebookRecordId');

  if (reviewRecordId && state.notebookHistory) {
    reviewRecord = state.notebookHistory.find(h => h.id === reviewRecordId);
    if (reviewRecord) {
      nbId = reviewRecord.notebookId;
      clearSessionParam('reviewNotebookRecordId');
    }
  }

  timeLimit = getSessionParam('notebookTimeLimit') || 0;
  // Read once and cleared, so a drill or a preview started later does not
  // inherit them; a resumed attempt gets them back from its draft.
  npNoBack = !reviewRecordId && !!getSessionParam('notebookNoBack');
  npQSec = npNoBack ? Math.max(0, Math.min(600, parseInt(getSessionParam('notebookQSec'), 10) || 0)) : 0;
  clearSessionParam('notebookNoBack');
  clearSessionParam('notebookQSec');
  npQLeft = 0; npQKey = ''; npPendingPick = null; npSubmitted = false;
  npPaused = false; _npPausedAt = 0;
  if (npQTimer) { clearInterval(npQTimer); npQTimer = null; }
  const _npResume = reviewRecordId ? null : npReadProgress();

  if (!nbId || !state.notebooks) {
    spaNavigate('study');
    return;
  }

  const origNb = (state?.notebooks ?? []).find(n => n.id === nbId);
  if (!origNb || !origNb.sections || origNb.sections.length === 0) {
    spaNavigate('study');
    return;
  }
  // However it was reached (queue, resume, preview), an empty draft has
  // nothing to show: go back and say why rather than open a blank attempt.
  if (typeof nbQuestionTotal === 'function' && !nbQuestionTotal(origNb)) {
    if (typeof toast === 'function') toast('"' + (origNb.title || 'This notebook') + '" has no questions yet.', { type: 'warning' });
    spaNavigate('study');
    return;
  }

  // Clone to avoid mutating state when shuffling questions
  activeNotebook = JSON.parse(JSON.stringify(origNb));

  const titleEl = document.getElementById('np-notebook-title');
  if (titleEl) titleEl.textContent = activeNotebook.title;
  // The whole name on hover, for a title long enough to be cut off.
  const titleChip = document.getElementById('np-title-chip');
  if (titleChip) titleChip.title = activeNotebook.title || '';

  practiceStartTime = Date.now();
  npFinishedAt = null;
  initSessionState();
  initTimer();

  currentSectionIdx = 0;
  const firstSec = activeNotebook.sections[0];
  if (firstSec.questions && firstSec.questions.length > 0) {
    currentQuestionNum = firstSec.questions[0];
  }

  renderSidebar();
  renderQuestion();

  // An unfinished attempt on this notebook is offered back rather than
  // overwritten. Answering anything replaces it, so the offer has to come now.
  // The library's own "Resume attempt" button has already put the question,
  // so it says so and this dialog is skipped. Read once and cleared either
  // way, so a later plain entry still gets asked.
  const _npAutoResume = getSessionParam('npAutoResume');
  if (_npAutoResume) clearSessionParam('npAutoResume');

  /* A REFRESH IS NOT LEAVING. `npLive` is set while this attempt is on screen
     and cleared when the route is left (notesPracticeDestroy), and it lives
     in sessionStorage -- so it survives a reload of this tab and nothing
     else. Finding it set for this notebook means the page was reloaded mid-
     attempt: carry on where it was, with no question asked. */
  const _npReloaded = !reviewRecord && getSessionParam('npLive') === activeNotebook.id;
  // Nothing worth offering back: no answers and no flags. Start clean, quietly.
  const _npDraftEmpty = !!_npResume && !_npResume.answers?.some(sec => Object.values(sec || {}).some(_npHasAnswer))
    && !(_npResume.flags || []).some(f => f && f.length);

  if (_npResume && _npResume.notebookId === activeNotebook.id && !reviewRecord && (_npAutoResume || _npReloaded)) {
    if (npApplyProgress(_npResume)) {
      initTimer(true);
      renderSidebar();
      renderQuestion();
      npPaintFlagBtn();
      _npPauseTimerIfDone();
    }
  } else if (_npResume && _npResume.notebookId === activeNotebook.id && !reviewRecord && _npDraftEmpty) {
    npClearProgress();
  } else if (_npResume && _npResume.notebookId === activeNotebook.id && !reviewRecord) {
    const mins = Math.max(1, Math.round((Date.now() - (_npResume.savedAt || Date.now())) / 60000));
    const answered = (_npResume.answers || []).reduce(
      (n, sec) => n + Object.values(sec || {}).filter(v => v != null && v !== '').length, 0);
    const ask = typeof npUiSheet === 'function' ? npUiSheet : null;
    const onChoice = (choice) => {
        if (choice === 'resume' && npApplyProgress(_npResume)) {
          initTimer(true);
          renderSidebar();
          renderQuestion();
          npPaintFlagBtn();
          _npPauseTimerIfDone();
        } else {
          npClearProgress();
        }
      };
    const said = `You left "${_npResume.title || activeNotebook.title}" about ${mins} minute${mins !== 1 ? 's' : ''} ago with ${answered} question${answered !== 1 ? 's' : ''} answered.`;
    if (ask) {
      ask({
        icon: 'history', tone: 'info', title: 'Unfinished attempt', body: escapeHTML(said), dismissable: false,
        actions: [
          { label: 'Start over', kind: 'ghost', value: 'fresh' },
          { label: 'Resume', kind: 'primary', value: 'resume', key: 'Enter' }
        ],
        onChoose: onChoice
      });
    } else {
      _showThreeButtonDialog('Unfinished attempt', said,
        [{ label: 'Resume', primary: true, action: 'resume' }, { label: 'Start over', danger: true, action: 'fresh' }], onChoice);
    }
  } else if (_npResume) {
    npClearProgress();   // a draft for a different notebook is stale
  }

  // Initialize theme selector
  const savedTheme = localStorage.getItem('theme') || 'dark';
  const selector = document.getElementById('theme-selector');
  if (selector) {
    selector.value = savedTheme;
  }

  if (reviewRecord) {
    enterReviewMode();
  } else {
    setSessionParam('npLive', activeNotebook.id);
  }
}

function changeTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
}

document.addEventListener('click', (e) => {
  if (e.target && (e.target.closest('button') || e.target.closest('select') || e.target.closest('input') || e.target.closest('textarea') || e.target.closest('.np-match-item'))) {
    return;
  }
  if (window.npQuestionAnimator && window.npQuestionAnimator._aborted === false && !window.npQuestionAnimator._forceComplete) {
    if (window.npQuestionAnimator.createdAt && (Date.now() - window.npQuestionAnimator.createdAt < 50)) {
      return;
    }
    window.npQuestionAnimator.complete();
  }
});

/**
 * One section's answer key, by question number. Shared by the start of an
 * attempt and by the live edit (npApplyNotebookUpdate), which passes the old
 * map so a matching question whose pairs did not change keeps the column
 * order the student is already looking at.
 */
function _npBuildKeyMap(sec, oldMap) {
  const keyMap = {};
  if (sec.answerKeysData && sec.answerKeysData.length > 0) {
    sec.answerKeysData.forEach(d => {
      const entry = { answer: d.answer, type: d.type || 'mcq', explanation: d.explanation, question: d.question, hint: d.hint, image: d.image || '', choices: d.choices || {}, pairs: d.pairs || [] };
      // Matching: build shuffled right-column order
      if (entry.type === 'matching' && entry.pairs.length > 0) {
        const prev = oldMap && oldMap[d.qNum];
        const same = prev && prev.type === 'matching' && Array.isArray(prev._shuffledRight)
          && prev.pairs && prev.pairs.length === entry.pairs.length;
        if (same) {
          entry._shuffledRight = prev._shuffledRight.map(it => ({ text: entry.pairs[it.origIdx].right, origIdx: it.origIdx }));
        } else {
          const rightItems = entry.pairs.map((p, i) => ({ text: p.right, origIdx: i }));
          for (let j = rightItems.length - 1; j > 0; j--) {
            const k = Math.floor(Math.random() * (j + 1));
            [rightItems[j], rightItems[k]] = [rightItems[k], rightItems[j]];
          }
          entry._shuffledRight = rightItems;
        }
      }
      keyMap[d.qNum] = entry;
    });
  } else {
    const keyText = (sec.answerKey || '').trim();
    keyText.split('\n').forEach(line => {
      const match = line.trim().match(/^(\d+)\s*[=:]\s*([A-Ea-e])$/);
      if (match) keyMap[parseInt(match[1])] = { answer: match[2].toUpperCase(), explanation: '' };
    });
  }
  return keyMap;
}

/**
 * The notebook was edited while this attempt is open (the editor drawer):
 * bring the attempt in line without losing anything already done.
 *
 * Sections are matched by id where both sides have one, by position
 * otherwise. Inside a section the order on screen is kept for questions that
 * still exist; new ones are added at the end, removed ones go. Answers stay,
 * and anything already answered is graded again against the new key -- so
 * fixing a wrong key fixes the mark.
 */
function npApplyNotebookUpdate(nb) {
  if (!activeNotebook || !nb || nb.id !== activeNotebook.id || reviewMode) return false;
  const fresh = JSON.parse(JSON.stringify(nb));
  const oldSecs = activeNotebook.sections || [];
  const curSecId = oldSecs[currentSectionIdx] && oldSecs[currentSectionIdx].id;
  const curQ = currentQuestionNum;
  const oldText = answerKeys[currentSectionIdx] && answerKeys[currentSectionIdx][curQ]
    ? answerKeys[currentSectionIdx][curQ].question : null;

  // A drill is the questions missed last time: it takes edits to those, and
  // does not grow back the ones it left out.
  const drill = !!activeNotebook.isDrill;
  const ans = [], st = [], gr = [], keys = [], flags = [], drafts = [];
  const kept = [];
  (fresh.sections || []).forEach((sec, i) => {
    let oi = sec.id ? oldSecs.findIndex(o => o.id === sec.id) : -1;
    if (oi < 0 && !sec.id && i < oldSecs.length && !oldSecs[i].id) oi = i;
    if (drill && oi < 0) return;
    kept.push(sec);
    const keyMap = _npBuildKeyMap(sec, oi >= 0 ? answerKeys[oi] : null);
    const valid = (sec.questions || []).filter(q => keyMap[q]);
    const prevOrder = oi >= 0 ? (oldSecs[oi].questions || []) : [];
    sec.questions = prevOrder.filter(q => valid.includes(q))
      .concat(drill ? [] : valid.filter(q => !prevOrder.includes(q)));
    const a = {}, s = {}, g = {};
    sec.questions.forEach(q => {
      const had = oi >= 0 && sessionStatus[oi] && q in sessionStatus[oi];
      a[q] = had ? sessionAnswers[oi][q] : null;
      s[q] = had ? sessionStatus[oi][q] : 'unopened';
      g[q] = 'skipped';
      if (s[q] === 'answered' && _npHasAnswer(a[q])) g[q] = npGradeEntry(a[q], keyMap[q]) ? 'correct' : 'wrong';
      else if (s[q] === 'answered') s[q] = 'opened';
    });
    ans.push(a); st.push(s); gr.push(g); keys.push(keyMap);
    const dr = {};
    if (oi >= 0 && npTextDrafts[oi]) sec.questions.forEach(q => { if (typeof npTextDrafts[oi][q] === 'string') dr[q] = npTextDrafts[oi][q]; });
    drafts.push(dr);
    flags.push(new Set(oi >= 0 && npFlags[oi] ? [...npFlags[oi]].filter(q => sec.questions.includes(q)) : []));
  });

  if (!kept.length) return false;    // nothing left to show; keep what is on screen
  fresh.sections = kept;
  if (drill) fresh.isDrill = true;
  activeNotebook = fresh;
  sessionAnswers = ans; sessionStatus = st; gradeResults = gr; answerKeys = keys; npFlags = flags; npTextDrafts = drafts;
  npApplyChoiceOrder();

  // Stay on the same question if it is still there.
  let si = curSecId ? fresh.sections.findIndex(s => s.id === curSecId) : -1;
  if (si < 0) si = Math.min(currentSectionIdx, fresh.sections.length - 1);
  currentSectionIdx = Math.max(0, si);
  const qs = (fresh.sections[currentSectionIdx] && fresh.sections[currentSectionIdx].questions) || [];
  currentQuestionNum = qs.includes(curQ) ? curQ : (qs.length ? qs[0] : null);

  const titleEl = document.getElementById('np-notebook-title');
  if (titleEl) titleEl.textContent = fresh.title;
  const chip = document.getElementById('np-title-chip');
  if (chip) chip.title = fresh.title || '';
  // Re-type the question only if its words changed.
  const nowText = currentQuestionNum != null && answerKeys[currentSectionIdx][currentQuestionNum]
    ? answerKeys[currentSectionIdx][currentQuestionNum].question : null;
  const qTextDiv = document.getElementById('np-q-text');
  if (qTextDiv && (nowText !== oldText || currentQuestionNum !== curQ)) qTextDiv.dataset.currentQId = '';

  renderSidebar();
  renderQuestion();
  npPaintFlagBtn();
  npSaveProgress();
  return true;
}

function initSessionState() {
  npTextDrafts = [];
  sessionAnswers = [];
  sessionStatus = [];
  answerKeys = [];
  gradeResults = [];

  // Drill mode: narrow the notebook to the questions missed last time BEFORE
  // anything else is built, so every per-section array below lines up without
  // needing to be reindexed afterwards. Sections left empty are dropped.
  const drill = typeof getSessionParam === 'function' ? getSessionParam('notebookDrill') : null;
  if (!reviewRecord && drill && drill.notebookId === activeNotebook.id && drill.bySection) {
    activeNotebook.sections.forEach((sec, idx) => {
      const keep = drill.bySection[idx] || drill.bySection[String(idx)] || [];
      sec.questions = (sec.questions || []).filter(q => keep.includes(q));
    });
    const kept = activeNotebook.sections.filter(s => (s.questions || []).length);
    if (kept.length) {
      activeNotebook.sections = kept;
      activeNotebook.isDrill = true;
    } else if (typeof clearSessionParam === 'function') {
      clearSessionParam('notebookDrill');   // nothing survived — run the whole notebook
    }
  }

  // A new seed per attempt: it fixes the choice order for this attempt, so a
  // re-render (or a resume) shows the options where they were.
  npShuffleSeed = Math.floor(Math.random() * 1e9) + 1;
  const shuffleQuestions = npShufflePrefs().questions;

  activeNotebook.sections.forEach((sec, idx) => {
    if (!reviewRecord && sec.questions && shuffleQuestions) {
      sec.questions = _npShuffled(sec.questions, Math.random);
    }

    const ans = {};
    const st = {};
    const gr = {};
    if (!npFlags[idx]) npFlags[idx] = new Set();
    (sec.questions || []).forEach(q => {
      ans[q] = reviewRecord ? (reviewRecord.sections[idx]?.answers?.[q] || null) : null;
      st[q] = 'unopened';
      if (reviewRecord) {
        const rUserAns = reviewRecord.sections[idx]?.answers?.[q];
        const rKeyEntry = reviewRecord.sections[idx]?.keyMap?.[q];
        gr[q] = rUserAns ? (npGradeEntry(rUserAns, rKeyEntry) ? 'correct' : 'wrong') : 'skipped';
      } else {
        gr[q] = 'skipped';
      }
    });
    sessionAnswers.push(ans);
    npTextDrafts.push({});
    sessionStatus.push(st);
    gradeResults.push(gr);

    // Parse answer key
    const keyMap = _npBuildKeyMap(sec);
    answerKeys.push(keyMap);

    // Reconcile questions[] with the answer key: drop question numbers that have
    // no key entry. Without a key they can't be graded and would render with
    // generic A–D choices that always score "wrong". (Skip in review mode so the
    // saved record stays intact.)
    if (!reviewRecord && sec.questions) {
      sec.questions = sec.questions.filter(q => keyMap[q]);
    }
  });
  npApplyChoiceOrder();
}

/* ----------------------------------------------------------
   TIMER
   ---------------------------------------------------------- */
/**
 * @param {boolean} [keep] carry on from the restored clock instead of starting
 *   over. Resuming used to call this straight after putting the saved time
 *   back, and it reset it -- so a refresh restarted the count-up at 00:00 and
 *   a countdown at its full limit.
 */
function initTimer(keep) {
  if (timerInterval) clearInterval(timerInterval);
  const display = document.getElementById('np-timer-display');
  if (!display) return;
  const kept = keep && typeof timeRemaining === 'number' && timeRemaining >= 0;

  if (timeLimit <= 0) {
    if (!kept) timeRemaining = 0;
    updateTimerDisplay();
    timerInterval = setInterval(() => {
      if (npPaused) return;
      timeRemaining++;
      updateTimerDisplay();
    }, 1000);
    return;
  }

  if (!kept || timeRemaining > timeLimit) timeRemaining = timeLimit;
  updateTimerDisplay();

  timerInterval = setInterval(() => {
    if (npPaused) return;
    timeRemaining--;
    if (timeRemaining <= 0) {
      clearInterval(timerInterval);
      timeRemaining = 0;
      updateTimerDisplay();
      if (typeof showMessage === 'function') {
        showMessage("Time's Up!", 'Your time has expired. Submitting automatically...', true);
      }
      setTimeout(() => npSubmitAttempt(true), 2000);
    } else {
      updateTimerDisplay();
    }
  }, 1000);
}

/* ----------------------------------------------------------
   TIMER MENU — right-click, as on the coding attempt
   ---------------------------------------------------------- */
function _npTimerMenuClose() {
  document.getElementById('np-timer-menu')?.remove();
}

function npTimerMenu(e) {
  if (e) e.preventDefault();
  if (reviewMode) return;
  if (document.getElementById('np-timer-menu')) { _npTimerMenuClose(); return; }

  const limit = timeLimit || 0;
  const h = Math.floor(limit / 3600), m = Math.floor((limit % 3600) / 60), sec = limit % 60;
  const mode = limit > 0 ? 'down' : 'up';

  const el = document.createElement('div');
  el.id = 'np-timer-menu';
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
    <div class="timer-menu-fields" id="np-tm-fields">
      <label>H <input type="number" id="np-tm-h" min="0" max="23" value="${h}"></label>
      <label>M <input type="number" id="np-tm-m" min="0" max="59" value="${m}"></label>
      <label>S <input type="number" id="np-tm-s" min="0" max="59" value="${sec}"></label>
    </div>
    <div class="timer-menu-presets">
      ${[5, 15, 30, 60].map(mins => `<button type="button" class="timer-preset" data-mins="${mins}">${mins < 60 ? mins + 'm' : '1h'}</button>`).join('')}
    </div>
    <label class="timer-menu-restart"><input type="checkbox" id="np-tm-restart"> Restart the clock from zero</label>
    <p class="timer-menu-note" id="np-tm-note"></p>
    <div class="timer-menu-actions">
      <button type="button" class="btn btn-secondary btn-sm" id="np-tm-cancel">Cancel</button>
      <button type="button" class="btn btn-primary btn-sm" id="np-tm-apply">Apply</button>
    </div>`;
  document.body.appendChild(el);
  if (typeof lucide !== 'undefined') lucide.createIcons({ el });

  const anchor = document.getElementById('np-timer-container');
  const r = anchor ? anchor.getBoundingClientRect() : { left: 20, bottom: 60 };
  const box = el.getBoundingClientRect();
  el.style.left = Math.max(8, Math.min(r.left, window.innerWidth - box.width - 8)) + 'px';
  el.style.top = (r.bottom + box.height > window.innerHeight ? Math.max(8, r.top - box.height - 6) : r.bottom + 6) + 'px';

  let chosen = mode;
  const fields = el.querySelector('#np-tm-fields');
  const note = el.querySelector('#np-tm-note');
  const paint = () => {
    fields.style.opacity = chosen === 'down' ? '1' : '0.4';
    fields.style.pointerEvents = chosen === 'down' ? '' : 'none';
    note.textContent = chosen === 'down'
      ? 'Submits automatically when it reaches zero.'
      : 'Counts up with no limit.';
  };
  paint();

  el.querySelectorAll('.timer-mode').forEach(b => b.addEventListener('click', () => {
    chosen = b.dataset.mode;
    el.querySelectorAll('.timer-mode').forEach(x => x.classList.toggle('active', x === b));
    paint();
  }));
  el.querySelectorAll('.timer-preset').forEach(b => b.addEventListener('click', () => {
    chosen = 'down';
    el.querySelectorAll('.timer-mode').forEach(x => x.classList.toggle('active', x.dataset.mode === 'down'));
    const mins = parseInt(b.dataset.mins, 10);
    el.querySelector('#np-tm-h').value = Math.floor(mins / 60);
    el.querySelector('#np-tm-m').value = mins % 60;
    el.querySelector('#np-tm-s').value = 0;
    paint();
  }));
  el.querySelector('#np-tm-cancel').addEventListener('click', _npTimerMenuClose);
  el.querySelector('#np-tm-apply').addEventListener('click', () => {
    const restart = el.querySelector('#np-tm-restart').checked;
    if (chosen === 'up') {
      timeLimit = 0;
      if (restart) timeRemaining = 0;
    } else {
      const hh = parseInt(el.querySelector('#np-tm-h').value, 10) || 0;
      const mm = parseInt(el.querySelector('#np-tm-m').value, 10) || 0;
      const ss = parseInt(el.querySelector('#np-tm-s').value, 10) || 0;
      const total = hh * 3600 + mm * 60 + ss;
      if (total <= 0) { note.textContent = 'Set a time above zero, or choose Count up.'; return; }
      timeLimit = total;
      timeRemaining = total;
    }
    if (typeof setSessionParam === 'function') setSessionParam('notebookTimeLimit', timeLimit);
    initTimer();
    npSaveProgress();
    _npTimerMenuClose();
  });

  setTimeout(() => document.addEventListener('click', function once(ev) {
    if (el.contains(ev.target)) { document.addEventListener('click', once, { once: true }); return; }
    _npTimerMenuClose();
  }, { once: true }), 0);
}

function updateTimerDisplay() {
  const display = document.getElementById('np-timer-display');
  if (!display) return;
  const m = Math.floor(timeRemaining / 60);
  const s = timeRemaining % 60;
  display.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');

  if (timeRemaining <= 60 && timeLimit > 0) {
    display.style.color = 'var(--color-danger)';
  }
}

/** True when every question in every section has been answered. */
function _npAllAnswered() {
  return sessionStatus.length > 0 &&
    sessionStatus.every(st => Object.values(st).every(s => s === 'answered'));
}

/**
 * Once the last question is answered there is nothing left to race against —
 * stop the clock (count-up stops growing, countdown stops auto-submitting)
 * and record the finish time so the saved duration matches what's displayed.
 */
function _npPauseTimerIfDone() {
  if (reviewMode || npFinishedAt || !_npAllAnswered()) return;
  npFinishedAt = Date.now();
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  const display = document.getElementById('np-timer-display');
  if (display) {
    display.style.color = 'var(--color-success)';
    display.title = 'Timer paused — all questions answered';
  }
}

/* ----------------------------------------------------------
   NAVIGATION
   ---------------------------------------------------------- */
function switchSection(idx) {
  if (npNoBack && idx < currentSectionIdx) { _npNoBackSay(); return; }
  if (gradeAdvanceTimer !== null) {
    clearTimeout(gradeAdvanceTimer);
    gradeAdvanceTimer = null;
    isCheckingAnswer = false;
  }
  currentSectionIdx = idx;
  const sec = activeNotebook.sections[idx];
  if (sec.questions && sec.questions.length > 0) {
    currentQuestionNum = sec.questions[0];
  } else {
    currentQuestionNum = null;
  }
  renderSidebar();
  renderQuestion();
}

function jumpToQuestion(qNum) {
  // No backtracking: only forward, within the section on screen.
  if (npNoBack) {
    const list = (activeNotebook.sections[currentSectionIdx].questions || []);
    if (list.indexOf(qNum) < list.indexOf(currentQuestionNum)) { _npNoBackSay(); return; }
  }
  npSaveProgress();
  // Cancel any pending auto-advance timer so it doesn't double-skip
  if (gradeAdvanceTimer !== null) {
    clearTimeout(gradeAdvanceTimer);
    gradeAdvanceTimer = null;
    isCheckingAnswer = false;
  }
  currentQuestionNum = qNum;
  renderSidebar();
  renderQuestion();
}

/** Said once in a while, not on every blocked press. */
let _npNoBackSaid = 0;
function _npNoBackSay() {
  if (Date.now() - _npNoBackSaid < 2500) return;
  _npNoBackSaid = Date.now();
  if (typeof toast === 'function') toast('No backtracking in this attempt', { type: 'info', duration: 1800 });
}

function npPrevQuestion() {
  if (npNoBack) { _npNoBackSay(); return; }
  // Cancel any pending auto-advance timer
  if (gradeAdvanceTimer !== null) {
    clearTimeout(gradeAdvanceTimer);
    gradeAdvanceTimer = null;
    isCheckingAnswer = false;
  }
  const sec = activeNotebook.sections[currentSectionIdx];
  const qList = sec.questions || [];
  const idx = qList.indexOf(currentQuestionNum);
  if (idx > 0) {
    jumpToQuestion(qList[idx - 1]);
  } else if (currentSectionIdx > 0) {
    const prevSec = activeNotebook.sections[currentSectionIdx - 1];
    currentSectionIdx = currentSectionIdx - 1;
    const prevQList = prevSec.questions || [];
    if (prevQList.length > 0) {
      currentQuestionNum = prevQList[prevQList.length - 1];
    }
    renderSidebar();
    renderQuestion();
  }
}

function npNextQuestion() {
  // Cancel any pending auto-advance timer
  if (gradeAdvanceTimer !== null) {
    clearTimeout(gradeAdvanceTimer);
    gradeAdvanceTimer = null;
    isCheckingAnswer = false;
  }
  const sec = activeNotebook.sections[currentSectionIdx];
  const qList = sec.questions || [];
  const idx = qList.indexOf(currentQuestionNum);
  if (idx < qList.length - 1) {
    jumpToQuestion(qList[idx + 1]);
  } else if (currentSectionIdx < activeNotebook.sections.length - 1) {
    switchSection(currentSectionIdx + 1);
  }
}

/* ----------------------------------------------------------
   QUESTION TYPE HELPERS
   ---------------------------------------------------------- */
function getQuestionType(secIdx, qNum) {
  const keyObj = answerKeys[secIdx] && answerKeys[secIdx][qNum];
  if (keyObj && keyObj.type) return keyObj.type;
  return 'mcq';
}

/** Collapse whitespace, lowercase, and strip trailing punctuation for text answers. */
function _npNormText(s) {
  return String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.!?]+$/, '');
}

/** Map T/F answers stored in any historical format ('A'/'B', 'True', 'T') to 'A'/'B'. */
function _npNormTF(v) {
  const s = String(v == null ? '' : v).trim().toUpperCase();
  if (s === 'A' || s === 'TRUE' || s === 'T') return 'A';
  if (s === 'B' || s === 'FALSE' || s === 'F') return 'B';
  return s;
}

function gradeAnswer(userAns, correctAns, type) {
  if (!userAns || (correctAns == null || correctAns === '') && type !== 'matching') return false;
  if (type === 'checkbox') {
    if (!Array.isArray(userAns) || !Array.isArray(correctAns)) return false;
    const u = [...userAns].sort();
    const c = [...correctAns].sort();
    return u.length === c.length && u.every((v, i) => v === c[i]);
  }
  if (type === 'text') {
    // Authors can list several accepted answers separated by "|".
    const accepted = String(correctAns).split('|').map(_npNormText).filter(Boolean);
    return accepted.includes(_npNormText(userAns));
  }
  if (type === 'matching') {
    // userAns is an object { leftIdx: rightOrigIdx, ... }, correctAns is the pairs array
    if (typeof userAns !== 'object' || !Array.isArray(correctAns) || correctAns.length === 0) return false;
    return correctAns.every((_, i) => parseInt(userAns[i]) === i);
  }
  if (type === 'truefalse') {
    return _npNormTF(userAns) === _npNormTF(correctAns);
  }
  // MCQ: tolerate case/whitespace drift in stored keys ('b' vs 'B')
  return String(userAns).trim().toUpperCase() === String(correctAns).trim().toUpperCase();
}

/**
 * Grade a user answer against a full answer-key entry.
 * Matching questions keep their correct data in `pairs` (answer is ''), so callers
 * must NOT pass keyEntry.answer directly — that made matching ungradeable.
 */
function npGradeEntry(userAns, keyEntry) {
  if (!keyEntry) return false;
  const type = keyEntry.type || 'mcq';
  const correct = type === 'matching' ? (keyEntry.pairs || []) : keyEntry.answer;
  return gradeAnswer(userAns, correct, type);
}

function formatAnswerDisplay(answer, type, keyEntry) {
  const choices = keyEntry && keyEntry.choices ? keyEntry.choices : null;
  // Named by the letter it was shown under, so "You answered B" points at the
  // second option on screen even when the choices were shuffled.
  const withText = (letter) => {
    const t = choices && choices[letter] ? choices[letter] : '';
    const shown = npShownLetter(keyEntry, letter);
    return t ? `${shown} — ${t}` : shown;
  };
  if (type === 'matching') {
    const pairs = keyEntry && Array.isArray(keyEntry.pairs) ? keyEntry.pairs : [];
    if (!pairs.length) return '—';
    // A student's answer is a map { leftIdx: rightIdx }. This used to print the
    // KEY's pairs whatever it was given, so "You answered" showed the correct
    // pairing beside an Incorrect verdict.
    if (answer && typeof answer === 'object' && !Array.isArray(answer)) {
      return pairs.map((p, i) => {
        const ri = parseInt(answer[i], 10);
        const to = Number.isInteger(ri) && pairs[ri] ? pairs[ri].right : '—';
        return `${p.left} → ${to}`;
      }).join(' · ');
    }
    return pairs.map(p => `${p.left} → ${p.right}`).join(' · ');
  }
  if (!answer || (Array.isArray(answer) && answer.length === 0)) return '—';
  if (type === 'checkbox' && Array.isArray(answer)) {
    return [...answer].sort((a, b) => npShownLetter(keyEntry, a).localeCompare(npShownLetter(keyEntry, b))).map(withText).join(', ');
  }
  if (type === 'truefalse') return _npNormTF(answer) === 'A' ? 'True' : _npNormTF(answer) === 'B' ? 'False' : String(answer);
  if (type === 'mcq' || type === undefined) return withText(String(answer));
  return String(answer);
}

/* ----------------------------------------------------------
   ANSWER SELECTION (Practice Mode Only)
   ---------------------------------------------------------- */
function selectAnswer(letter) {
  if (reviewMode || currentQuestionNum === null || isCheckingAnswer || npPaused) return;
  if (sessionStatus[currentSectionIdx][currentQuestionNum] === 'answered') return;

  const qType = getQuestionType(currentSectionIdx, currentQuestionNum);

  if (qType === 'checkbox') {
    // Toggle letter in array
    let current = sessionAnswers[currentSectionIdx][currentQuestionNum];
    if (!Array.isArray(current)) current = [];
    const idx = current.indexOf(letter);
    if (idx >= 0) current.splice(idx, 1);
    else current.push(letter);
    sessionAnswers[currentSectionIdx][currentQuestionNum] = current; npSaveProgress();
    sessionStatus[currentSectionIdx][currentQuestionNum] = 'opened';
    if (typeof npUiSfx === 'function') npUiSfx(idx >= 0 ? 'untick' : 'tick');
    renderQuestion();
    return;
  }

  /* Confirm before grading (Display > Text): the first press only picks, a
     second press on the same choice -- or Enter, or the Confirm button --
     grades it. Without it a stray click was a graded wrong answer. */
  const pickKey = currentSectionIdx + '-' + currentQuestionNum;
  if (typeof npUiPrefs === 'function' && npUiPrefs().confirm
      && !(npPendingPick && npPendingPick.key === pickKey && npPendingPick.letter === letter)) {
    npPendingPick = { key: pickKey, letter };
    if (typeof npUiSfx === 'function') npUiSfx('tick');
    renderQuestion();
    return;
  }
  npPendingPick = null;

  // MCQ: immediate grade
  sessionAnswers[currentSectionIdx][currentQuestionNum] = letter; npSaveProgress();
  sessionStatus[currentSectionIdx][currentQuestionNum] = 'answered';
  gradeAndAdvance();
}

/** The Confirm button (or Enter) for a picked choice. */
function npConfirmPick() {
  const key = currentSectionIdx + '-' + currentQuestionNum;
  if (!npPendingPick || npPendingPick.key !== key) return;
  selectAnswer(npPendingPick.letter);
}

function confirmCheckboxAnswer() {
  if (reviewMode || currentQuestionNum === null || isCheckingAnswer) return;
  if (sessionStatus[currentSectionIdx][currentQuestionNum] === 'answered') return;
  const ans = sessionAnswers[currentSectionIdx][currentQuestionNum];
  if (!Array.isArray(ans) || ans.length === 0) return;
  sessionStatus[currentSectionIdx][currentQuestionNum] = 'answered';
  gradeAndAdvance();
}

function confirmTextAnswer() {
  if (reviewMode || currentQuestionNum === null || isCheckingAnswer) return;
  if (sessionStatus[currentSectionIdx][currentQuestionNum] === 'answered') return;
  const ta = document.getElementById('np-text-answer-input');
  if (!ta || !ta.value.trim()) return;
  sessionAnswers[currentSectionIdx][currentQuestionNum] = ta.value.trim(); npSaveProgress();
  sessionStatus[currentSectionIdx][currentQuestionNum] = 'answered';
  if (npTextDrafts[currentSectionIdx]) delete npTextDrafts[currentSectionIdx][currentQuestionNum];
  gradeAndAdvance();
}

/* Matching type: click left item then click right item */
window._matchingSelectedLeft = null;
function selectMatchingLeft(leftIdx) {
  if (reviewMode || currentQuestionNum === null || isCheckingAnswer) return;
  if (sessionStatus[currentSectionIdx][currentQuestionNum] === 'answered') return;
  
  let current = sessionAnswers[currentSectionIdx][currentQuestionNum];
  if (typeof current !== 'object' || current === null) current = {};

  if (window._matchingSelectedLeft === leftIdx) {
    // Clicking the active term again deselects it
    window._matchingSelectedLeft = null;
  } else {
    // If it was already matched, clear the match so user can redo it or leave it unmatched
    if (current[leftIdx] !== undefined) {
      delete current[leftIdx];
      sessionAnswers[currentSectionIdx][currentQuestionNum] = current; npSaveProgress();
    }
    window._matchingSelectedLeft = leftIdx;
  }
  renderQuestion();
}

function selectMatchingRight(rightOrigIdx) {
  if (reviewMode || currentQuestionNum === null || isCheckingAnswer) return;
  if (sessionStatus[currentSectionIdx][currentQuestionNum] === 'answered') return;
  
  let current = sessionAnswers[currentSectionIdx][currentQuestionNum];
  if (typeof current !== 'object' || current === null) current = {};

  if (window._matchingSelectedLeft === null) {
    // If no left item is selected, and they click a matched right item, unmatch it!
    let foundLeftKey = null;
    Object.keys(current).forEach(k => {
      if (current[k] === rightOrigIdx) foundLeftKey = k;
    });
    if (foundLeftKey !== null) {
      delete current[foundLeftKey];
      sessionAnswers[currentSectionIdx][currentQuestionNum] = current; npSaveProgress();
      renderQuestion();
    }
    return;
  }

  // Each definition can match only one term — steal it from any previous owner,
  // otherwise two terms could share one definition and the rest become unmatchable.
  Object.keys(current).forEach(k => {
    if (current[k] === rightOrigIdx) delete current[k];
  });
  current[window._matchingSelectedLeft] = rightOrigIdx;
  sessionAnswers[currentSectionIdx][currentQuestionNum] = current; npSaveProgress();
  sessionStatus[currentSectionIdx][currentQuestionNum] = 'opened';
  window._matchingSelectedLeft = null;
  if (typeof npUiSfx === 'function') npUiSfx('link');
  renderQuestion();
}

function confirmMatchingAnswer() {
  if (reviewMode || currentQuestionNum === null || isCheckingAnswer) return;
  if (sessionStatus[currentSectionIdx][currentQuestionNum] === 'answered') return;
  const correctObj = answerKeys[currentSectionIdx][currentQuestionNum];
  const pairs = correctObj ? correctObj.pairs : [];
  const ans = sessionAnswers[currentSectionIdx][currentQuestionNum];
  if (typeof ans !== 'object' || Object.keys(ans || {}).length < pairs.length) return;
  sessionStatus[currentSectionIdx][currentQuestionNum] = 'answered';
  gradeAndAdvance();
}

function gradeAndAdvance() {
  const correctObj = answerKeys[currentSectionIdx][currentQuestionNum];
  const explanation = correctObj ? correctObj.explanation : '';
  const qType = getQuestionType(currentSectionIdx, currentQuestionNum);
  const userAns = sessionAnswers[currentSectionIdx][currentQuestionNum];

  // Grade BEFORE rendering so the heading/grid can show the outcome immediately
  const isCorrect = npGradeEntry(userAns, correctObj);
  gradeResults[currentSectionIdx][currentQuestionNum] = isCorrect ? 'correct' : 'wrong';
  _npPauseTimerIfDone();

  isCheckingAnswer = true;
  renderSidebar();
  renderQuestion();

  if (isCorrect) {
    const prefs = typeof npUiPrefs === 'function' ? npUiPrefs() : { motion: true, advance: 'normal' };
    // Animations off means no confetti either; it was the one effect that
    // ignored the switch.
    if (prefs.motion && typeof confetti === 'function') confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    /* Auto-advance (Display > Text): Normal moves on after 1.5s, Slow after
       3s, Off stays so the explanation can be read and Next moves on. */
    const wait = prefs.advance === 'off' ? 900 : prefs.advance === 'slow' ? 3000 : 1500;
    gradeAdvanceTimer = setTimeout(() => {
      gradeAdvanceTimer = null;
      isCheckingAnswer = false;
      renderSidebar();
      if (prefs.advance === 'off') renderQuestion();
      else npNextQuestion();
    }, wait);
  } else {
    const hurtOverlay = document.getElementById('hurt-overlay');
    if (hurtOverlay) { hurtOverlay.classList.remove('hurt-active'); void hurtOverlay.offsetWidth; hurtOverlay.classList.add('hurt-active'); }
    gradeAdvanceTimer = setTimeout(() => {
      gradeAdvanceTimer = null;
      isCheckingAnswer = false;
      renderSidebar();
      showWrongAnswerPopup(correctObj, explanation, qType);
    }, 1500);
  }
}

function showWrongAnswerPopup(keyEntry, explanation, qType) {
  // The attempt's own sheet: your answer beside the right one, Enter to go on.
  if (typeof npUiShowWrong === 'function') {
    const type = qType || 'mcq';
    const userAns = sessionAnswers[currentSectionIdx][currentQuestionNum];
    const sec = activeNotebook.sections[currentSectionIdx];
    const qList = sec.questions || [];
    const pairs = keyEntry && Array.isArray(keyEntry.pairs) ? keyEntry.pairs : [];
    npUiShowWrong({
      type,
      position: (qList.indexOf(currentQuestionNum) + 1) + ' of ' + qList.length,
      question: (keyEntry && keyEntry.question) || '',
      yours: type === 'matching' ? '' : formatAnswerDisplay(userAns, type, keyEntry),
      correct: type === 'matching' ? '' : formatAnswerDisplay(keyEntry ? keyEntry.answer : null, type, keyEntry),
      pairs: type === 'matching' ? pairs.map((p, i) => {
        const ri = parseInt((userAns || {})[i], 10);
        return { left: p.left, right: p.right, yours: Number.isInteger(ri) && pairs[ri] ? pairs[ri].right : '', ok: ri === i };
      }) : null,
      explanation: explanation || ''
    });
    return;
  }
  const dialogIcon = document.getElementById('dialog-icon');
  const dialogTitle = document.getElementById('dialog-title');
  const dialogMsg = document.getElementById('dialog-msg');
  const dialogActions = document.getElementById('dialog-actions');

  if (dialogIcon) dialogIcon.innerHTML = '<i data-lucide="x-circle" style="width:48px;height:48px;color:var(--color-danger);"></i>';
  if (dialogTitle) dialogTitle.textContent = 'Incorrect';
  if (dialogMsg) {
    const type = qType || 'mcq';
    let answerHtml;
    if (type === 'matching') {
      const pairs = keyEntry && Array.isArray(keyEntry.pairs) ? keyEntry.pairs : [];
      answerHtml = `<p style="margin-bottom:0.25rem; color:var(--text-primary);"><strong>Correct Pairings:</strong></p>
        <div style="text-align:left; display:inline-block; margin:0 auto;">
          ${pairs.map(p => `<div style="font-size:0.875rem; padding:0.15rem 0;">${escapeHTML(p.left)} <span style="color:#f472b6; font-weight:700;">→</span> ${escapeHTML(p.right)}</div>`).join('')}
        </div>`;
    } else {
      const displayAns = formatAnswerDisplay(keyEntry ? keyEntry.answer : null, type, keyEntry);
      answerHtml = `<p style="margin-bottom: 0.5rem; color: var(--text-primary);"><strong>Correct Answer:</strong> ${escapeHTML(displayAns)}</p>`;
    }
    dialogMsg.innerHTML = `
      ${answerHtml}
      ${explanation ? `<div style="background: #111111; color: #ffffff; padding: 1rem; border-radius: var(--radius-md); margin-top: 1rem; font-family: var(--font-mono); font-size: 0.875rem; text-align: left; border: 1px solid #333;"><strong style="color: var(--color-primary); margin-bottom: 0.5rem; display: block; font-family: var(--font-sans);">Explanation</strong>${escapeHTML(explanation).replace(/\n/g, '<br/>')}</div>` : ''}
    `;
  }
  if (dialogActions) {
    dialogActions.innerHTML = `<button onclick="closeWrongAnswerPopupAndNext()" class="btn btn-primary" style="width:100%;">Continue to Next Question</button>`;
  }
  const modal = document.getElementById('dialog-modal');
  if (modal) { _dlgOpen(modal); if (typeof lucide !== 'undefined') lucide.createIcons({ root: modal }); }
}

function closeWrongAnswerPopupAndNext() {
  const modal = document.getElementById('dialog-modal');
  if (modal) modal.classList.add('hidden');
  if (typeof npUiCloseWrong === 'function') npUiCloseWrong();
  npNextQuestion();
}

/* ----------------------------------------------------------
   RENDERING — SIDEBAR
   ---------------------------------------------------------- */
function renderSidebar() {
  const tabsContainer = document.getElementById('np-sections-tabs');
  if (!tabsContainer) return;

  tabsContainer.innerHTML = activeNotebook.sections.map((sec, idx) => {
    const isActive = idx === currentSectionIdx;

    // In review mode, show per-section score
    const qList = sec.questions || [];
    const total = qList.length;
    let scoreHtml = '';
    let pct = 0;
    let tone = '';
    if (reviewMode) {
      const gr = gradeResults[idx];
      const correct = qList.filter(q => gr[q] === 'correct').length;
      pct = total > 0 ? Math.round((correct / total) * 100) : 0;
      tone = pct === 100 ? 'good' : pct >= 70 ? 'warn' : 'bad';
      scoreHtml = `<span class="np-tab-count" data-tone="${tone}">${correct}/${total}</span>`;
    } else {
      const st = sessionStatus[idx] || {};
      const done = qList.filter(q => st[q] === 'answered').length;
      pct = total > 0 ? Math.round((done / total) * 100) : 0;
      tone = done === total && total ? 'good' : '';
      scoreHtml = `<span class="np-tab-count" data-tone="${tone}">${done}/${total}</span>`;
    }

    return `
      <button class="np-sidebar-tab-dark np-sp ${isActive ? 'active' : ''}${npNoBack && !reviewMode && idx < currentSectionIdx ? ' is-past' : ''}" onclick="switchSection(${idx})" title="${escapeHTML(sec.label || ('Section ' + (idx + 1)))}">
        <span class="np-tab-top">
          <span class="np-tab-num">${String(idx + 1).padStart(2, '0')}</span>
          <span class="np-tab-name">${escapeHTML(sec.label || ('Section ' + (idx + 1)))}</span>
          ${scoreHtml}
        </span>
        <span class="np-tab-bar" data-tone="${tone}"><span style="width:${pct}%"></span></span>
      </button>
    `;
  }).join('');

  /* The section switcher earns its space only when there is somewhere to
     switch TO. Its buttons call switchSection(idx); with a single section the
     only one on offer is the section already open, so the card sits there
     costing height and doing nothing -- and the heading below it already names
     the current section. Hidden in that case, on every screen, since it is
     redundant rather than merely cramped.

     The class goes on the panel so the divider under the strip can go with it;
     left alone it would draw a rule across the top of an empty panel. */
  const oneSection = (activeNotebook.sections || []).length < 2;
  tabsContainer.style.display = oneSection ? 'none' : '';
  const panel = tabsContainer.closest('.practice-sidebar');
  if (panel) panel.classList.toggle('np-single-section', oneSection);

  // Grid
  const sec = activeNotebook.sections[currentSectionIdx];
  const sectionTitle = document.getElementById('np-current-section-title');
  if (sectionTitle) sectionTitle.textContent = sec.label || ('Section ' + (currentSectionIdx + 1));

  const gridContainer = document.getElementById('np-question-grid');
  if (!gridContainer) return;

  // The grid used to print the AUTHORED number. Questions are shuffled, so it
  // read "2 1 5 3 4" while the header said "1 / 5" — the first button was the
  // first question but was labelled 2. Position is what the header counts, so
  // position is what the button shows; the original number is on the tooltip.
  gridContainer.innerHTML = (sec.questions || []).map((qNum, pos) => {
    let cls = 'np-grid-box np-sp';

    if (reviewMode) {
      const result = gradeResults[currentSectionIdx][qNum];
      if (result === 'correct') cls += ' review-correct';
      else if (result === 'wrong') cls += ' review-wrong';
      else cls += ' review-skipped';
    } else {
      const status = sessionStatus[currentSectionIdx][qNum];
      if (status === 'answered') {
        const result = gradeResults[currentSectionIdx][qNum];
        if (result === 'correct') cls += ' review-correct';
        else if (result === 'wrong') cls += ' review-wrong';
        else cls += ' answered';
      }
      else if (status === 'opened') cls += ' opened';
    }

    if (qNum === currentQuestionNum) cls += ' active';
    if (npIsFlagged(currentSectionIdx, qNum)) cls += ' flagged';
    if (npNoBack && !reviewMode && pos < (sec.questions || []).indexOf(currentQuestionNum)) cls += ' is-past';

    const flagged = npIsFlagged(currentSectionIdx, qNum);
    return `<button class="${cls}" onclick="jumpToQuestion(${qNum})"
              title="Question ${pos + 1}${flagged ? ' — flagged for review' : ''}"
              aria-label="Go to question ${pos + 1}${flagged ? ', flagged' : ''}">${pos + 1}${flagged ? '<span class="np-grid-flag"></span>' : ''}</button>`;
  }).join('');

  // The title chip's counter and the rail under the topbar.
  if (typeof npUiPaintProgress === 'function') npUiPaintProgress();
}

/* ============================================================
   IN-PROGRESS ATTEMPT — saved as you go
   ------------------------------------------------------------
   saveData() only ran AFTER submitting, so closing the tab, a crash or a flat
   battery lost the whole attempt. Answers, flags, position and the clock are
   written to localStorage on every change, and offered back on return.
   ============================================================ */
const NP_RESUME_KEY = 'npAttemptInProgress';
let npFlags = [];          // flags[secIdx] = Set of qNum
let _npSaveTimer = null;

function npIsFlagged(secIdx, qNum) {
  return !!(npFlags[secIdx] && npFlags[secIdx].has(qNum));
}

function npToggleFlag(secIdx, qNum) {
  if (secIdx == null || qNum == null) return;
  if (!npFlags[secIdx]) npFlags[secIdx] = new Set();
  if (npFlags[secIdx].has(qNum)) npFlags[secIdx].delete(qNum);
  else npFlags[secIdx].add(qNum);
  npSaveProgress();
  renderSidebar();     // the grid is drawn there
  npPaintFlagBtn();
}

function npPaintFlagBtn() {
  const btn = document.getElementById('np-flag-btn');
  if (!btn) return;
  const on = npIsFlagged(currentSectionIdx, currentQuestionNum);
  btn.classList.toggle('is-flagged', on);
  btn.title = on ? 'Unflag this question (F)' : 'Flag for review (F)';
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
}

/** Debounced: typing an identification answer should not write on every key. */
function npSaveProgress() {
  clearTimeout(_npSaveTimer);
  _npSaveTimer = setTimeout(npFlushProgress, 400);
}

function npFlushProgress() {
  if (reviewMode || !activeNotebook || npSubmitted) return;
  try {
    localStorage.setItem(NP_RESUME_KEY, JSON.stringify({
      notebookId: activeNotebook.id,
      title: activeNotebook.title,
      savedAt: Date.now(),
      sectionIdx: currentSectionIdx,
      questionNum: currentQuestionNum,
      order: (activeNotebook.sections || []).map(sec => (sec.questions || []).slice()),
      answers: sessionAnswers,
      status: sessionStatus,
      flags: npFlags.map(set => set ? [...set] : []),
      timeRemaining: typeof timeRemaining === 'number' ? timeRemaining : null,
      timeLimit: timeLimit || 0,
      shuffleSeed: npShuffleSeed,
      textDrafts: npTextDrafts,
      noBack: npNoBack,
      qSec: npQSec,
      qLeft: npQLeft,
      qKey: npQKey
    }));
    // The "Saved just now" chip beside the shortcuts, as the coding attempt has.
    if (typeof npUiMarkSaved === 'function') npUiMarkSaved();
  } catch (e) { /* quota — the attempt still works, it just will not resume */ }
}

function npClearProgress() {
  try { localStorage.removeItem(NP_RESUME_KEY); } catch (e) { /* nothing to clear */ }
}

function npReadProgress() {
  try {
    const raw = localStorage.getItem(NP_RESUME_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return (d && d.notebookId) ? d : null;
  } catch (e) { return null; }
}

/** True when an answer has actually been given (not null, '', [] or {}). */
function _npHasAnswer(v) {
  if (v == null || v === '') return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
}

/**
 * Make "answered" mean answered. A question is only locked and only shows its
 * key once it has an answer AND a grade; one that was skipped stays open, so
 * going back to it lets you answer it.
 */
function _npHealAnswered(si, q) {
  if (reviewMode || !sessionStatus[si] || sessionStatus[si][q] !== 'answered') return;
  if (!gradeResults[si]) gradeResults[si] = {};
  const g = gradeResults[si][q];
  if (g === 'correct' || g === 'wrong') return;
  const ans = sessionAnswers[si] ? sessionAnswers[si][q] : null;
  if (_npHasAnswer(ans)) {
    gradeResults[si][q] = npGradeEntry(ans, answerKeys[si] && answerKeys[si][q]) ? 'correct' : 'wrong';
  } else {
    sessionStatus[si][q] = 'opened';
  }
}

/** Puts a saved attempt back exactly where it was. */
function npApplyProgress(d) {
  if (!d || !activeNotebook) return false;
  try {
    (activeNotebook.sections || []).forEach((sec, i) => {
      if (d.order && d.order[i] && d.order[i].length === (sec.questions || []).length) {
        sec.questions = d.order[i].slice();   // the shuffle it was taken with
      }
    });
    // The same seed puts every question's choices back where they were.
    if (d.shuffleSeed) { npShuffleSeed = d.shuffleSeed; npApplyChoiceOrder(); }
    if (Array.isArray(d.textDrafts)) npTextDrafts = d.textDrafts.map(x => (x && typeof x === 'object') ? x : {});
    while (npTextDrafts.length < (activeNotebook.sections || []).length) npTextDrafts.push({});
    // The rules it was started under, and where its question clock had got to.
    npNoBack = !!d.noBack;
    npQSec = npNoBack ? (parseInt(d.qSec, 10) || 0) : 0;
    npQKey = d.qKey || '';
    npQLeft = typeof d.qLeft === 'number' ? d.qLeft : 0;
    if (d.answers) sessionAnswers = d.answers;
    if (d.status) sessionStatus = d.status;
    /* The grades are not in the draft, and were never worked out again, so a
       resumed attempt showed every question you had answered as "Skipped" --
       locked, with the right answer on display. They are re-graded from the
       answers here; anything marked answered with no answer behind it goes
       back to being a question you can answer. */
    (activeNotebook.sections || []).forEach((sec, si) => {
      (sec.questions || []).forEach(q => _npHealAnswered(si, q));
    });
    npFlags = (d.flags || []).map(arr => new Set(arr || []));
    currentSectionIdx = d.sectionIdx || 0;
    currentQuestionNum = d.questionNum != null ? d.questionNum : null;
    /* The clock, both kinds. The count-up's elapsed seconds were saved but
       never read back, so it always restarted; and the start time the saved
       duration is worked out from is moved back to match, or a resumed
       attempt would report only the time since the refresh. */
    if (typeof d.timeRemaining === 'number' && d.timeRemaining >= 0) {
      if (d.timeLimit > 0) timeLimit = d.timeLimit;
      timeRemaining = d.timeRemaining;
      const elapsed = timeLimit > 0 ? Math.max(0, timeLimit - timeRemaining) : timeRemaining;
      practiceStartTime = Date.now() - elapsed * 1000;
    }
    return true;
  } catch (e) { return false; }
}

/* ---------- Keyboard ----------
   The page was mouse-only apart from Enter in a text answer. On a fifty
   question set that is a lot of clicking. */
let _npKeyHandler = null;

function npBindKeys() {
  if (_npKeyHandler) return;
  _npKeyHandler = (e) => {
    if (reviewMode) return;
    // The notebook editor drawer is open: its keys are the form's.
    if (document.getElementById('np-edit')) return;
    if (npPaused) return;
    const el = document.activeElement;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((el || {}).tagName || '') || (el || {}).isContentEditable;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (typing && e.key !== 'Escape') return;

    const k = e.key.toLowerCase();
    /* Up and down walk the choices; Enter (or Space) takes the one you are on.
       Focus does the work: the choices are buttons, so a focused one answers
       to Enter by itself, and its ring is the cursor. For multi-select the
       Confirm button is the last stop, and Enter with no choice focused
       confirms whatever is ticked. */
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (typeof npKbMove === 'function' && npKbMove(e.key === 'ArrowDown' ? 1 : -1)) e.preventDefault();
      return;
    }
    if (e.key === 'Enter') {
      const inChoices = el && el.closest && el.closest('#np-bubbles-container');
      // Only when nothing else has focus: Enter on a topbar button is that button's.
      const free = !el || el === document.body || (el.closest && el.closest('#np-question-area'));
      if (!inChoices && free && npPendingPick) { e.preventDefault(); npConfirmPick(); return; }
      if (!inChoices && free && getQuestionType(currentSectionIdx, currentQuestionNum) === 'checkbox') {
        e.preventDefault();
        confirmCheckboxAnswer();
      }
      return;
    }
    if (k === 'n' || e.key === 'ArrowRight') { e.preventDefault(); npNextQuestion(); }
    else if (k === 'p' || e.key === 'ArrowLeft') { e.preventDefault(); npPrevQuestion(); }
    else if (k === 'f') { e.preventDefault(); npToggleFlag(currentSectionIdx, currentQuestionNum); }
    else if (k === 'h') { e.preventDefault(); if (typeof showHintModal === 'function') showHintModal(); }
    else if (/^[1-9]$/.test(k) || /^[a-e]$/.test(k)) {
      // A number or a letter picks that choice, whichever the student thinks in.
      const idx = /^[1-9]$/.test(k) ? parseInt(k, 10) - 1 : k.charCodeAt(0) - 97;
      // The choices are buttons carrying selectAnswer('X') — match on that
      // rather than on a class, which is generated inline here.
      const boxes = [...document.querySelectorAll('#np-bubbles-container button[onclick^="selectAnswer"]')];
      if (boxes[idx]) { e.preventDefault(); boxes[idx].click(); }
    }
  };
  document.addEventListener('keydown', _npKeyHandler);
}

function npUnbindKeys() {
  if (!_npKeyHandler) return;
  document.removeEventListener('keydown', _npKeyHandler);
  _npKeyHandler = null;
}

/* ----------------------------------------------------------
   RENDERING — QUESTION + BUBBLES
   ---------------------------------------------------------- */
/* ── Reading the questions out ──────────────────────────────────────────────
   The same switch Free run has: with it on, each question reads itself as it
   arrives and an answer speaks when the pointer lands on it, so a notebook can
   be worked through by ear.

   Per device rather than per notebook, because it is about how you want to
   study rather than anything about the material. */
/* ── Shuffle ────────────────────────────────────────────────────────────────
   Questions were always shuffled and choices never were, with no say in
   either. Two switches now, from the shuffle button in the top bar, kept per
   device. Either can be flipped mid-attempt without losing anything: answers
   are stored by question number and by the choice's own letter, so only the
   order on screen changes. */
const NP_SHUFFLE_KEY = 'ssp.np.shuffle';
let npShuffleSeed = 1;

function npShufflePrefs() {
  try {
    const v = JSON.parse(localStorage.getItem(NP_SHUFFLE_KEY) || 'null');
    if (v && typeof v === 'object') return { questions: v.questions !== false, choices: !!v.choices };
  } catch (e) { /* private mode, or a bad value */ }
  return { questions: true, choices: false };
}

function _npSetShufflePrefs(p) {
  try { localStorage.setItem(NP_SHUFFLE_KEY, JSON.stringify({ questions: !!p.questions, choices: !!p.choices })); } catch (e) { /* private mode */ }
}

/** A repeatable random sequence from a string (mulberry32 over a string hash). */
function _npRand(seedStr) {
  const s = String(seedStr);
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates on a copy — `sort(() => Math.random() - 0.5)` is not uniform. */
function _npShuffled(arr, rand) {
  const a = (arr || []).slice();
  for (let j = a.length - 1; j > 0; j--) {
    const k = Math.floor(rand() * (j + 1));
    [a[j], a[k]] = [a[k], a[j]];
  }
  return a;
}

/** Works out the on-screen order of every choice question's options. */
function npApplyChoiceOrder() {
  const on = !reviewMode && !reviewRecord && npShufflePrefs().choices;
  (answerKeys || []).forEach((keyMap, si) => Object.keys(keyMap || {}).forEach(q => {
    const e = keyMap[q];
    const t = (e && e.type) || 'mcq';
    if (!e || (t !== 'mcq' && t !== 'checkbox')) return;
    const letters = Object.keys(e.choices || {}).sort();
    e._order = on && letters.length > 1 ? _npShuffled(letters, _npRand(npShuffleSeed + ':' + si + ':' + q)) : letters;
  }));
}

/** A choice question's letters in the order they are shown. */
function npChoiceOrder(entry, sec) {
  if (entry && Array.isArray(entry._order) && entry._order.length) return entry._order;
  const keys = entry && entry.choices ? Object.keys(entry.choices).sort() : [];
  return keys.length ? keys : Array.from({ length: (sec && sec.choices) || 4 }, (_, i) => String.fromCharCode(65 + i));
}

/** The letter a choice is shown under: the first option on screen is always A. */
function npShownLetter(entry, letter) {
  const order = entry && entry._order;
  const i = order ? order.indexOf(letter) : -1;
  return i >= 0 ? String.fromCharCode(65 + i) : letter;
}

function npSetQuestionShuffle(on) {
  const p = npShufflePrefs(); p.questions = !!on; _npSetShufflePrefs(p);
  if (activeNotebook && !reviewMode) {
    activeNotebook.sections.forEach(sec => {
      const qs = (sec.questions || []).slice();
      sec.questions = on ? _npShuffled(qs, Math.random) : qs.sort((a, b) => a - b);
    });
    renderSidebar();
    renderQuestion();
    npSaveProgress();
  }
  _npPaintShuffleBtn();
}

function npSetChoiceShuffle(on) {
  const p = npShufflePrefs(); p.choices = !!on; _npSetShufflePrefs(p);
  if (activeNotebook && !reviewMode) {
    /* A fresh seed each time it is switched on. The seed was fixed for the
       attempt, so off-then-on brought back exactly the order it had before,
       which is not a shuffle. It is saved with the progress, so a resume
       still shows the order you left. */
    if (on) npShuffleSeed = Math.floor(Math.random() * 1e9) + 1;
    npApplyChoiceOrder();
    renderQuestion();
    npSaveProgress();
  }
  _npPaintShuffleBtn();
}

function _npPaintShuffleBtn() {
  const btn = document.getElementById('np-shuffle-btn');
  if (!btn) return;
  const p = npShufflePrefs();
  const on = p.questions || p.choices;
  btn.classList.toggle('is-on', on);
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  btn.title = `Shuffle: questions ${p.questions ? 'on' : 'off'}, choices ${p.choices ? 'on' : 'off'}`;
}

function _npShuffleMenuClose() {
  document.getElementById('np-shuffle-menu')?.remove();
}

function npShuffleMenu(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  if (reviewMode) return;
  if (document.getElementById('np-shuffle-menu')) { _npShuffleMenuClose(); return; }
  const p = npShufflePrefs();
  const el = document.createElement('div');
  el.id = 'np-shuffle-menu';
  el.className = 'timer-menu np-shuffle-menu';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Shuffle settings');
  el.innerHTML = `
    <div class="timer-menu-title"><i data-lucide="shuffle" style="width:13px;height:13px;"></i> Shuffle</div>
    <label class="np-switch-row">
      <span><strong>Questions</strong><em>A different order in each section</em></span>
      <input type="checkbox" class="np-switch" id="np-sh-q" ${p.questions ? 'checked' : ''} onchange="npSetQuestionShuffle(this.checked)" />
    </label>
    <label class="np-switch-row">
      <span><strong>Choices</strong><em>Options move around inside each question</em></span>
      <input type="checkbox" class="np-switch" id="np-sh-c" ${p.choices ? 'checked' : ''} onchange="npSetChoiceShuffle(this.checked)" />
    </label>
    <p class="timer-menu-note">Kept on this device. Answers you have given stay put.</p>`;
  document.body.appendChild(el);
  if (typeof lucide !== 'undefined') lucide.createIcons({ el });
  const anchor = document.getElementById('np-shuffle-btn');
  const r = anchor ? anchor.getBoundingClientRect() : { left: 20, right: 20, top: 40, bottom: 60 };
  const box = el.getBoundingClientRect();
  el.style.left = Math.max(8, Math.min(r.right - box.width, window.innerWidth - box.width - 8)) + 'px';
  el.style.top = (r.bottom + box.height > window.innerHeight ? Math.max(8, r.top - box.height - 6) : r.bottom + 6) + 'px';
  setTimeout(() => document.addEventListener('click', function once(ev) {
    if (el.contains(ev.target)) { document.addEventListener('click', once, { once: true }); return; }
    _npShuffleMenuClose();
  }, { once: true }), 0);
}

const NP_VOICE_KEY = 'ssp.np.autoVoice';

/** The question last read, so a repaint does not read it again. */
let _npSpokenQ = '';

function npAutoVoice() {
  try { return localStorage.getItem(NP_VOICE_KEY) === '1'; } catch (e) { return false; }
}

function npToggleAutoVoice() {
  const next = !npAutoVoice();
  try { localStorage.setItem(NP_VOICE_KEY, next ? '1' : '0'); } catch (e) { /* private mode */ }
  if (!next && typeof speechStop === 'function') speechStop();
  _npSyncVoiceBtn();
  // Turning it on should prove itself rather than wait for the next question.
  if (next) { _npSpokenQ = ''; npSpeakQuestion(); }
}

function _npSyncVoiceBtn() {
  const btn = document.getElementById('np-voice-btn');
  if (!btn) return;
  const on = npAutoVoice();
  btn.setAttribute('aria-pressed', String(on));
  btn.classList.toggle('is-on', on);
  btn.title = on ? 'Reading questions aloud — click to stop' : 'Read questions aloud';
  // Only the glyph is swapped; the label and the level meter beside it stay.
  const old = btn.querySelector('svg, i[data-lucide]');
  const icon = document.createElement('i');
  icon.setAttribute('data-lucide', on ? 'volume-2' : 'volume-x');
  if (old) old.replaceWith(icon); else btn.prepend(icon);
  const label = btn.querySelector('.np-voice-label');
  if (label) label.textContent = on ? 'Reading aloud' : 'Read aloud';
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: btn });
}

/**
 * Read the question on screen, once.
 *
 * Guarded on the question id rather than the text: renderQuestion runs again
 * for a selection, a grade and the timer, and speaking on each would restart
 * the same sentence. Two questions can also share wording, so the id is what
 * distinguishes them.
 */
function npSpeakQuestion(text) {
  if (!npAutoVoice() || typeof speak !== 'function') return;
  const key = currentSectionIdx + '-' + currentQuestionNum;
  if (key === _npSpokenQ) return;
  /* Taken from the answer key, not from the element. The question is typed out
     a character at a time by npQuestionAnimator, so reading the DOM here would
     catch it empty or halfway through. */
  let said = String(text == null ? '' : text).trim();
  if (!said) {
    const el = document.getElementById('np-q-text');
    said = (el && el.textContent || '').trim();
  }
  if (!said) return;
  _npSpokenQ = key;
  speak(said);
}

/** An answer speaks when the pointer reaches it. Mouse only: on a touch screen
    the tap IS the answer, and reading each one on the way past would be noise. */
function npHoverSpeak(el) {
  if (!npAutoVoice() || typeof speak !== 'function' || !el) return;
  // The card also holds its keycap letter and a result mark; read the answer.
  const textEl = el.querySelector('.np-choice-text');
  const said = ((textEl || el).textContent || '').trim();
  if (said) speak(said);
}

function renderQuestion() {
  const heading = document.getElementById('np-q-heading');
  const reviewStatus = document.getElementById('np-review-status');

  if (currentQuestionNum === null) {
    document.getElementById('np-q-label').textContent = 'No Questions';
    document.getElementById('np-q-progress').textContent = '0 / 0';
    document.getElementById('np-bubbles-container').innerHTML = '<div style="color:#8b949e; font-size:0.875rem; text-align:center; padding:2rem;">This section has no questions configured.</div>';
    const btnPrev = document.getElementById('np-btn-prev');
    const btnNext = document.getElementById('np-btn-next');
    if (btnPrev) btnPrev.disabled = true;
    if (btnNext) btnNext.disabled = true;
    if (heading) heading.textContent = 'No Questions';
    if (reviewStatus) reviewStatus.classList.add('hidden');
    return;
  }

  // Never show a key for a question that has no graded answer (see _npHealAnswered).
  _npHealAnswered(currentSectionIdx, currentQuestionNum);

  // Mark as opened if not answered (practice mode only)
  if (!reviewMode && sessionStatus[currentSectionIdx][currentQuestionNum] === 'unopened') {
    sessionStatus[currentSectionIdx][currentQuestionNum] = 'opened';
    renderSidebar();
  }

  const sec = activeNotebook.sections[currentSectionIdx];
  const qList = sec.questions || [];
  const idx = qList.indexOf(currentQuestionNum);

  document.getElementById('np-q-label').textContent = `Question ${currentQuestionNum}`;
  document.getElementById('np-q-progress').textContent = `${idx + 1} / ${qList.length}`;

  const correctObj = answerKeys[currentSectionIdx][currentQuestionNum];
  const correctAns = correctObj ? correctObj.answer : null;
  const qType = getQuestionType(currentSectionIdx, currentQuestionNum);
  const selected = sessionAnswers[currentSectionIdx][currentQuestionNum];

  // Question type badge
  const typeBadgeMap = { mcq: 'MCQ', checkbox: 'Multi-Select', text: 'Text', matching: 'Matching', truefalse: 'True/False' };
  const qLabelEl = document.getElementById('np-q-label');
  // Position, not the authored number: questions are shuffled, and the grid and
  // the counter both count by position, so "Question 3" on the first card of a
  // shuffled section disagreed with everything around it.
  qLabelEl.innerHTML = `<span class="np-q-label-text">Question ${idx + 1}</span> <span class="np-qtype-badge ${escapeHTML(qType)}">${escapeHTML(typeBadgeMap[qType] || 'MCQ')}</span>`;

  // Heading text — review mode AND already-answered questions in practice mode
  // both show the outcome with the correct answer + explanation.
  // During isCheckingAnswer (the 1.5s grading animation), only update the heading
  // text — do NOT show the full review status (badge/explanation) yet, so the
  // content area doesn't grow and push the prev/next buttons off screen.
  const practiceResult = !reviewMode && sessionStatus[currentSectionIdx][currentQuestionNum] === 'answered'
    ? gradeResults[currentSectionIdx][currentQuestionNum] : null;
  const explanationHtml = correctObj && correctObj.explanation && String(correctObj.explanation).trim() !== ''
    ? `<div class="np-text-compare" style="margin-top:0.75rem;"><span class="np-text-compare-label" style="color:var(--color-primary);">Explanation</span>${escapeHTML(String(correctObj.explanation)).replace(/\n/g, '<br/>')}</div>`
    : '';

  if (reviewMode || practiceResult) {
    const result = reviewMode ? gradeResults[currentSectionIdx][currentQuestionNum] : practiceResult;
    if (result === 'correct') { heading.textContent = 'Correct'; heading.dataset.tone = 'correct'; }
    else if (result === 'wrong') { heading.textContent = 'Incorrect'; heading.dataset.tone = 'wrong'; }
    else { heading.textContent = 'Skipped'; heading.dataset.tone = 'skipped'; }

    // Only show full review status when NOT in the grading animation delay
    if (!isCheckingAnswer) {
      const userAns = selected;
      const userDisp = formatAnswerDisplay(userAns, qType, correctObj);
      const correctDisp = formatAnswerDisplay(correctAns, qType, correctObj);
      let statusHtml = '';
      if (qType === 'matching') {
        // A sentence listing every pair twice was a paragraph of red text; the
        // count says it, and the pair list below the columns shows which.
        const pairs = (correctObj && correctObj.pairs) || [];
        const map = (selected && typeof selected === 'object') ? selected : {};
        const right = pairs.filter((_, i) => parseInt(map[i], 10) === i).length;
        const tone = result === 'correct' ? 'correct' : (result === 'wrong' ? 'wrong' : 'skipped');
        const icon = tone === 'correct' ? 'check-circle-2' : (tone === 'wrong' ? 'x-circle' : 'minus-circle');
        const said = result === 'skipped' || !Object.keys(map).length
          ? 'Not answered'
          : `${right} of ${pairs.length} pair${pairs.length === 1 ? '' : 's'} matched correctly`;
        statusHtml = `<div class="np-review-badge np-review-badge-${tone}"><i data-lucide="${icon}" style="width:16px;height:16px;"></i> ${escapeHTML(said)}</div>`;
      } else if (result === 'correct') {
        statusHtml = `<div class="np-review-badge np-review-badge-correct"><i data-lucide="check-circle-2" style="width:16px;height:16px;"></i> You answered ${escapeHTML(userDisp)} — Correct!</div>`;
      } else if (result === 'wrong') {
        statusHtml = `<div class="np-review-badge np-review-badge-wrong"><i data-lucide="x-circle" style="width:16px;height:16px;"></i> You answered ${escapeHTML(userDisp)} · Correct: ${escapeHTML(correctDisp)}</div>`;
      } else {
        statusHtml = `<div class="np-review-badge np-review-badge-skipped"><i data-lucide="minus-circle" style="width:16px;height:16px;"></i> Not answered · Correct: ${escapeHTML(correctDisp)}</div>`;
      }
      if (qType === 'text' && result === 'wrong' && userAns) {
        statusHtml += `<div class="np-text-compare" style="margin-top:0.75rem;"><span class="np-text-compare-label" style="color:#ef4444;">Your Answer</span>${escapeHTML(String(userAns))}</div>`;
        statusHtml += `<div class="np-text-compare" style="margin-top:0.5rem;"><span class="np-text-compare-label" style="color:#10b981;">Correct Answer</span>${escapeHTML(String(correctAns))}</div>`;
      }
      statusHtml += explanationHtml;
      if (reviewStatus) { reviewStatus.innerHTML = statusHtml; reviewStatus.classList.remove('hidden'); }
    } else {
      // During grading animation, hide review status to keep layout compact
      if (reviewStatus) reviewStatus.classList.add('hidden');
    }
  } else {
    const headingMap = { mcq: 'Select your answer', checkbox: 'Select all correct answers', text: 'Type your answer', matching: 'Match the pairs', truefalse: 'True or False?' };
    heading.textContent = headingMap[qType] || 'Select your answer';
    heading.dataset.tone = '';
    if (reviewStatus) reviewStatus.classList.add('hidden');
  }

  // Update Question Image, Text & Hint Button
  const qImageContainer = document.getElementById('np-q-image-container');
  const qImage = document.getElementById('np-q-image');
  if (qImageContainer && qImage) {
    if (correctObj && correctObj.image && correctObj.image.trim() !== '') {
      qImage.src = correctObj.image.trim();
      qImageContainer.classList.remove('hidden');
    } else {
      qImage.src = '';
      qImageContainer.classList.add('hidden');
    }
  }

  // Read it as it arrives, if that is switched on. Guarded on the question id,
  // so the repaints for a selection, a grade or the clock do not restart it.
  if (typeof npSpeakQuestion === 'function') {
    npSpeakQuestion(correctObj && correctObj.question);
  }

  const qTextDiv = document.getElementById('np-q-text');
  const hintBtn = document.getElementById('np-hint-btn');
  if (qTextDiv) {
    if (correctObj && correctObj.question && correctObj.question.trim() !== '') {
      const qTrackerId = currentSectionIdx + '-' + currentQuestionNum;
      if (qTextDiv.dataset.currentQId !== qTrackerId) {
        qTextDiv.dataset.currentQId = qTrackerId;
        qTextDiv.classList.remove('hidden');
        if (window.npQuestionAnimator) { window.npQuestionAnimator.abort(); window.npQuestionAnimator.removeCursor(); }
        // The reveal is a display preference: Off shows the question at once.
        const reveal = typeof npUiPrefs === 'function' ? npUiPrefs().reveal : 'normal';
        const speed = { fast: 3, normal: 7, slow: 16 }[reveal];
        if (!speed || typeof TextAnimator === 'undefined') {
          window.npQuestionAnimator = null;
          qTextDiv.style.minHeight = '';
          qTextDiv.textContent = correctObj.question;
        } else {
          /* Hold the space the finished question will take. Typed a word at a
             time it grew a line at a time, and everything under it -- the
             choices, the matching grid and its lines -- slid down as it went. */
          qTextDiv.style.minHeight = '';
          qTextDiv.textContent = correctObj.question;
          qTextDiv.style.minHeight = qTextDiv.offsetHeight + 'px';
          qTextDiv.textContent = '';
          /* The callback answers only for its own animator. An aborted one
             (the question you just left) still finishes and calls back, and
             it used to act on whichever animator was current -- removing the
             new question's cursor and dropping its reserved height mid-type. */
          const anim = new TextAnimator(qTextDiv, {
            speed, blur: true, glow: false, chromatic: false, cursor: true,
            onComplete: () => {
              if (window.npQuestionAnimator !== anim) return;
              anim.removeCursor();
              qTextDiv.style.minHeight = '';
            }
          });
          window.npQuestionAnimator = anim;
          window.npQuestionAnimator.createdAt = Date.now();
          window.npQuestionAnimator.type(correctObj.question);
        }
      }
    } else {
      qTextDiv.dataset.currentQId = '';
      qTextDiv.classList.add('hidden');
      if (window.npQuestionAnimator) { window.npQuestionAnimator.abort(); window.npQuestionAnimator.removeCursor(); }
    }
  }
  if (hintBtn) {
    if (reviewMode) {
      hintBtn.classList.add('hidden');
    } else {
      hintBtn.classList.remove('hidden');
      const hasHint = correctObj && correctObj.hint && correctObj.hint.trim() !== '';
      hintBtn.disabled = !hasHint;
      hintBtn.style.opacity = hasHint ? '1' : '0.35';
      hintBtn.style.pointerEvents = hasHint ? '' : 'none';
    }
  }

  const bubblesContainer = document.getElementById('np-bubbles-container');
  if (!bubblesContainer) return;

  // === TEXT TYPE ===
  if (qType === 'text') {
    const isAnswered = sessionStatus[currentSectionIdx][currentQuestionNum] === 'answered';
    const isCorrect = isCheckingAnswer && gradeResults[currentSectionIdx][currentQuestionNum] === 'correct';
    const isWrong = isCheckingAnswer && gradeResults[currentSectionIdx][currentQuestionNum] === 'wrong';
    let borderColor = '#30363d';
    if (isCorrect) borderColor = 'var(--color-success)';
    if (isWrong) borderColor = 'var(--color-danger)';

    let textVal = '';
    if (typeof selected === 'string') textVal = selected;
    else if (npTextDrafts[currentSectionIdx] && typeof npTextDrafts[currentSectionIdx][currentQuestionNum] === 'string') {
      textVal = npTextDrafts[currentSectionIdx][currentQuestionNum];
    }

    bubblesContainer.innerHTML = `
      <textarea id="np-text-answer-input" class="np-text-input-area" placeholder="Type your answer here... (Enter to submit)"
        style="border-color:${borderColor};" ${isAnswered || reviewMode ? 'disabled' : ''}>${escapeHTML(textVal)}</textarea>
      ${!isAnswered && !reviewMode ? `<button class="np-confirm-btn np-sp" onclick="confirmTextAnswer()"><i data-lucide="send-horizontal" style="width:18px;height:18px;"></i> Submit answer <kbd>Enter</kbd></button>` : ''}
      ${reviewMode && correctAns ? `<div class="np-text-compare" style="margin-top:0.5rem;"><span class="np-text-compare-label" style="color:#10b981;">Expected Answer</span>${escapeHTML(String(correctAns))}</div>` : ''}
    `;
    const textInput = document.getElementById('np-text-answer-input');
    if (textInput && !isAnswered && !reviewMode) {
      const draftSec = currentSectionIdx, draftQ = currentQuestionNum;
      textInput.addEventListener('input', () => {
        if (!npTextDrafts[draftSec]) npTextDrafts[draftSec] = {};
        npTextDrafts[draftSec][draftQ] = textInput.value;
        npSaveProgress();
      });
      textInput.addEventListener('keydown', (e) => {
        // Enter submits, Shift+Enter inserts a newline
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); confirmTextAnswer(); return; }
        /* The box takes focus by itself, so left and right were swallowed by
           it and the question could not be changed from the keyboard. Now an
           arrow that has nowhere left to go -- the box is empty, or the caret
           is already at that end -- steps OUT of the box instead, and the
           next press moves question as it does everywhere else. Inside the
           text the arrows still move the caret. Escape always steps out. */
        const ta = e.currentTarget;
        const caretAt = ta.selectionStart === ta.selectionEnd ? ta.selectionStart : -1;
        const atEdge = (e.key === 'ArrowRight' && caretAt === ta.value.length)
                    || (e.key === 'ArrowLeft' && caretAt === 0);
        if (atEdge || e.key === 'Escape') {
          e.preventDefault();
          // Not this press as well: the page's own handler would see the box
          // already blurred and move on the same keystroke.
          e.stopPropagation();
          ta.blur();
          if (typeof npUiNudgeNav === 'function' && e.key !== 'Escape') npUiNudgeNav(e.key === 'ArrowRight' ? 1 : -1);
        }
      });
      textInput.focus();
    }
  }
  // === CHECKBOX TYPE ===
  else if (qType === 'checkbox') {
    // Per-question adaptive choices, in the shuffled order when that is on.
    const letters = npChoiceOrder(correctObj, sec);
    const selectedArr = Array.isArray(selected) ? selected : [];
    const correctArr = Array.isArray(correctAns) ? correctAns : [];
    const isAnswered = sessionStatus[currentSectionIdx][currentQuestionNum] === 'answered';

    const showResult = reviewMode || isCheckingAnswer || isAnswered;
    bubblesContainer.innerHTML = letters.map((letter, pos) => {
      const isSelected = selectedArr.includes(letter);
      const isKey = correctArr.includes(letter);
      let state = '';
      if (showResult) {
        // A right answer that was not ticked is still shown as right, dashed,
        // so a partial selection reads as "missed one" rather than as correct.
        if (isKey) state = isSelected ? 'is-correct' : 'is-correct is-missed';
        else if (isSelected) state = 'is-wrong';
        else state = 'is-dim';
      }
      if (isSelected) state += ' is-selected';
      const choiceText = correctObj && correctObj.choices && correctObj.choices[letter] ? correctObj.choices[letter] : '';
      const locked = reviewMode || isAnswered;
      return _npChoiceHTML({
        letter, pos, text: choiceText, kind: 'checkbox', state, locked,
        mark: showResult ? (isKey ? 'check' : (isSelected ? 'x' : '')) : (isSelected ? 'check' : '')
      });
    }).join('');

    if (!isAnswered && !reviewMode && !isCheckingAnswer) {
      bubblesContainer.innerHTML += `<button class="np-confirm-btn np-sp" onclick="confirmCheckboxAnswer()" ${selectedArr.length === 0 ? 'disabled' : ''}><i data-lucide="check-check" style="width:18px;height:18px;"></i> Confirm selection <span class="np-confirm-count">${selectedArr.length}</span></button>`;
    }
  }
  // === MATCHING TYPE ===
  else if (qType === 'matching') {
    const pairs = correctObj ? (correctObj.pairs || []) : [];
    const shuffled = correctObj ? (correctObj._shuffledRight || []) : [];
    const userMatches = (typeof selected === 'object' && selected !== null) ? selected : {};
    const isAnswered = sessionStatus[currentSectionIdx][currentQuestionNum] === 'answered';
    const matchedCount = Object.keys(userMatches).length;

    const MATCH_PAIR_COLORS = [
      { border: '#818cf8', bg: 'rgba(99, 102, 241, 0.08)' }, // Indigo
      { border: '#34d399', bg: 'rgba(52, 211, 153, 0.08)' }, // Emerald
      { border: '#fbbf24', bg: 'rgba(251, 191, 36, 0.08)' }, // Amber
      { border: '#38bdf8', bg: 'rgba(56, 189, 248, 0.08)' }, // Sky
      { border: '#fb7185', bg: 'rgba(251, 113, 133, 0.08)' }, // Rose
      { border: '#c084fc', bg: 'rgba(192, 132, 252, 0.08)' }  // Purple
    ];

    let leftHtml = pairs.map((p, li) => {
      const isActive = window._matchingSelectedLeft === li;
      const matchedRightIdx = userMatches[li];
      const hasMatch = matchedRightIdx !== undefined;
      let cls = 'np-match-item np-match-left np-sp';
      if (isActive) cls += ' np-match-active';
      if (hasMatch) cls += ' np-match-connected';
      if (isAnswered || reviewMode) {
        const isCorrect = parseInt(matchedRightIdx) === li;
        cls += isCorrect ? ' np-match-correct' : ' np-match-wrong';
      }
      const onclick = (reviewMode || isAnswered) ? '' : `onclick="selectMatchingLeft(${li})"`;
      
      let inlineStyle = '';
      if (hasMatch && !isAnswered && !reviewMode) {
        const colorObj = MATCH_PAIR_COLORS[li % MATCH_PAIR_COLORS.length];
        inlineStyle = `style="border-color: ${colorObj.border} !important; background: ${colorObj.bg} !important;"`;
      }
      return `<div id="np-match-left-${li}" class="${cls}" ${inlineStyle} ${onclick}>${escapeHTML(p.left)}</div>`;
    }).join('');

    let rightHtml = shuffled.map((item) => {
      // Check if this right item is already matched
      let matchingLeftIdx = null;
      Object.keys(userMatches).forEach(k => {
        if (userMatches[k] === item.origIdx) {
          matchingLeftIdx = parseInt(k);
        }
      });
      const isUsed = matchingLeftIdx !== null;
      let cls = 'np-match-item np-match-right np-sp';
      if (isUsed) cls += ' np-match-connected';
      const onclick = (reviewMode || isAnswered) ? '' : `onclick="selectMatchingRight(${item.origIdx})"`;
      
      let inlineStyle = '';
      if (isUsed && !isAnswered && !reviewMode) {
        const colorObj = MATCH_PAIR_COLORS[matchingLeftIdx % MATCH_PAIR_COLORS.length];
        inlineStyle = `style="border-color: ${colorObj.border} !important; background: ${colorObj.bg} !important;"`;
      }
      return `<div id="np-match-right-${item.origIdx}" class="${cls}" ${inlineStyle} ${onclick}>${escapeHTML(item.text)}</div>`;
    }).join('');

    const locked = isAnswered || reviewMode;
    bubblesContainer.innerHTML = `
      <div class="np-matching-grid${locked ? ' is-locked' : ''}" style="position: relative;">
        <!-- SVG Canvas for Connecting Lines -->
        <svg id="np-matching-svg" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 5; overflow: visible;"></svg>

        <div class="np-matching-col"><h5 class="np-match-head">Terms</h5>${leftHtml}</div>
        <div class="np-matching-col"><h5 class="np-match-head">Definitions</h5>${rightHtml}</div>
      </div>
      ${!locked && !isCheckingAnswer ? `<div class="np-match-tip"><i data-lucide="mouse-pointer-2"></i> Drag a term onto its definition, or click one then the other</div><button class="np-confirm-btn np-sp" onclick="confirmMatchingAnswer()" ${matchedCount < pairs.length ? 'disabled' : ''}><i data-lucide="check" style="width:18px;height:18px;"></i> Confirm matches <span class="np-confirm-count">${matchedCount}/${pairs.length}</span></button>` : ''}
      ${locked ? `
        <div class="np-pairs-key">
          <div class="np-pairs-key-title">Correct pairings</div>
          ${pairs.map((p, i) => {
            const ok = parseInt(userMatches[i], 10) === i;
            const ri = parseInt(userMatches[i], 10);
            const theirs = Number.isInteger(ri) && pairs[ri] && !ok ? `<span class="np-pairs-yours">${escapeHTML(pairs[ri].right)}</span>` : '';
            return `<div class="np-pairs-row ${ok ? 'is-ok' : 'is-bad'}">
              <i data-lucide="${ok ? 'check' : 'x'}"></i>
              <span class="np-pairs-left">${escapeHTML(p.left)}</span>
              <span class="np-pairs-arrow">→</span>
              <span class="np-pairs-right">${theirs}${escapeHTML(p.right)}</span>
            </div>`;
          }).join('')}
        </div>
      ` : ''}
    `;
  }
  // === TRUE/FALSE TYPE ===
  else if (qType === 'truefalse') {
    const isAnswered = sessionStatus[currentSectionIdx][currentQuestionNum] === 'answered';
    const correctLetter = _npNormTF(correctAns);

    const showResult = reviewMode || isCheckingAnswer || isAnswered;
    const locked = reviewMode || isAnswered;
    const buttonsHtml = ['A', 'B'].map((letter, pos) => {
      const isTrue = letter === 'A';
      let state = '';
      if (showResult) {
        if (letter === correctLetter) state = 'is-correct';
        else if (letter === selected) state = 'is-wrong';
        else state = 'is-dim';
      }
      if (selected === letter || (!showResult && _npIsPending(letter))) state += ' is-selected';
      const onclick = locked ? '' : `onclick="selectAnswer('${letter}')"`;
      return `
        <button type="button" class="np-choice np-tf np-sp ${state}${locked ? ' is-locked' : ''}" data-tone="${isTrue ? 'true' : 'false'}"
                style="--i:${pos}" ${onclick} aria-pressed="${selected === letter}"
                onpointerenter="if(event.pointerType==='mouse') npHoverSpeak(this)">
          <span class="np-choice-key" title="Press ${pos + 1}">${pos + 1}</span>
          <span class="np-tf-icon" aria-hidden="true"><i data-lucide="${isTrue ? 'circle-check-big' : 'circle-x'}"></i></span>
          <span class="np-choice-text">${isTrue ? 'True' : 'False'}</span>
        </button>`;
    }).join('');

    bubblesContainer.innerHTML = `<div class="np-tf-row">${buttonsHtml}</div>` + _npPendingConfirmHTML(showResult);
  }
  // === MCQ TYPE (default) ===
  else {
    // Per-question adaptive choices, in the shuffled order when that is on.
    const letters = npChoiceOrder(correctObj, sec);

    const isAnswered = sessionStatus[currentSectionIdx][currentQuestionNum] === 'answered';
    // Normalize the stored key ('b' / ' B ') so highlight matches grading
    const correctLetter = String(correctAns == null ? '' : correctAns).trim().toUpperCase();

    const showResult = reviewMode || isCheckingAnswer || isAnswered;
    bubblesContainer.innerHTML = letters.map((letter, pos) => {
      let state = '';
      if (showResult) {
        if (letter === correctLetter) state = 'is-correct';
        else if (letter === selected) state = 'is-wrong';
        else state = 'is-dim';
      }
      if (selected === letter || (!showResult && _npIsPending(letter))) state += ' is-selected';
      const choiceText = correctObj && correctObj.choices && correctObj.choices[letter] ? correctObj.choices[letter] : '';
      return _npChoiceHTML({
        letter, pos, text: choiceText, kind: 'mcq', state, locked: reviewMode || isAnswered,
        mark: showResult ? (letter === correctLetter ? 'check' : (letter === selected ? 'x' : '')) : ''
      });
    }).join('') + _npPendingConfirmHTML(showResult);
  }

  bubblesContainer.classList.toggle('np-align-left', !npTextAlignCenter);
  // Grading animations (the pop on a right answer, the shake on a wrong one)
  // belong to the moment of answering. Revisiting an answered question draws
  // the same classes, and should not replay them.
  bubblesContainer.classList.toggle('np-grading', !!isCheckingAnswer);

  // Update nav buttons
  const btnPrev = document.getElementById('np-btn-prev');
  const btnNext = document.getElementById('np-btn-next');
  if (btnPrev) {
    btnPrev.disabled = npNoBack || (currentSectionIdx === 0 && idx === 0);
    btnPrev.title = npNoBack ? 'No backtracking in this attempt' : '';
  }
  if (btnNext) btnNext.disabled = (currentSectionIdx === activeNotebook.sections.length - 1 && idx === qList.length - 1);

  const questionArea = document.getElementById('np-question-area') || document.getElementById('main-content');
  if (typeof lucide !== 'undefined') lucide.createIcons(questionArea ? { root: questionArea } : undefined);

  // Trigger SVG lines for matching questions
  // Drawn now, from layout offsets, so they are right on the first frame; the
  // observer keeps them right as anything above or beside them resizes.
  if (qType === 'matching') {
    drawMatchingLines();
    _npWatchMatching(true);
    window.removeEventListener('resize', drawMatchingLines);
    window.addEventListener('resize', drawMatchingLines);
  } else {
    _npWatchMatching(false);
    window.removeEventListener('resize', drawMatchingLines);
  }

  // The flag button describes the question on screen. It was only repainted
  // when the flag was toggled, so it stayed lit on the next question.
  npPaintFlagBtn();

  // An open hint belongs to the question it was opened on.
  const hintInline = document.getElementById('np-hint-inline');
  if (hintInline && hintInline.dataset.qid && hintInline.dataset.qid !== currentSectionIdx + '-' + currentQuestionNum) {
    hintInline.classList.remove('is-open');
    hintInline.innerHTML = '';
    hintInline.dataset.qid = '';
    const hb = document.getElementById('np-hint-btn');
    if (hb) hb.classList.remove('is-on');
  }

  // The per-question clock (no backtracking only).
  _npQClockSync();

  // Entry animation (only when the question changed), the section meter, the
  // falling X on a wrong answer, and the spatial hover state under the pointer.
  if (typeof npUiOnRender === 'function') {
    npUiOnRender({
      key: currentSectionIdx + '-' + currentQuestionNum,
      ord: currentSectionIdx * 100000 + idx,
      pos: idx,
      total: qList.length,
      type: qType,
      grading: !!isCheckingAnswer,
      result: gradeResults[currentSectionIdx] ? gradeResults[currentSectionIdx][currentQuestionNum] : null
    });
  }
}

/** Is this letter the one picked and waiting for confirmation, on this question? */
function _npIsPending(letter) {
  return !!npPendingPick && npPendingPick.key === currentSectionIdx + '-' + currentQuestionNum
    && npPendingPick.letter === letter;
}

/** The Confirm button for a waiting pick (Confirm before grading). */
function _npPendingConfirmHTML(showResult) {
  if (showResult || reviewMode || !npPendingPick || npPendingPick.key !== currentSectionIdx + '-' + currentQuestionNum) return '';
  return `<button class="np-confirm-btn np-sp np-pick-confirm" onclick="npConfirmPick()"><i data-lucide="check" style="width:18px;height:18px;"></i> Confirm answer <kbd>Enter</kbd></button>`;
}

/**
 * One choice card, for multiple choice and multi-select.
 *
 * The onclick stays `selectAnswer('X')` as the first thing on the button:
 * the keyboard handler finds the choices by that attribute prefix.
 */
function _npChoiceHTML(o) {
  const shown = String.fromCharCode(65 + o.pos);
  const onclick = o.locked ? '' : `onclick="selectAnswer('${o.letter}')"`;
  const mark = o.mark ? `<i data-lucide="${o.mark}"></i>` : '';
  const label = escapeHTML(o.text || o.letter);
  return `
    <button type="button" ${onclick} class="np-choice np-sp${o.kind === 'checkbox' ? ' np-choice-multi' : ''} ${o.state || ''}${o.locked ? ' is-locked' : ''}"
            style="--i:${o.pos}" aria-pressed="${/\bis-selected\b/.test(o.state || '')}"
            aria-label="${shown}: ${label}"
            onpointerenter="if(event.pointerType==='mouse') npHoverSpeak(this)">
      <span class="np-choice-key" title="Press ${shown} or ${o.pos + 1}">${shown}</span>
      <span class="np-choice-text">${label}</span>
      <span class="np-choice-mark" aria-hidden="true">${mark}</span>
    </button>`;
}

/* Draw SVG connecting lines between matched terms and definitions.

   Positions come from the layout (offsetLeft/offsetTop up to the grid), not
   from getBoundingClientRect. A rect is the box as painted, so it moved with
   everything that animates here: the card sliding in, the grid rising, the
   lean on a hovered term. The lines used to be measured 40ms into that slide
   and sat in the wrong place until a later redraw. Layout offsets ignore
   transforms, and the SVG lives inside the grid, so the lines are right from
   the first frame and ride along with the animation instead of fighting it. */
function _npMatchPos(el, grid) {
  let x = 0, y = 0, n = el;
  while (n && n !== grid) {
    x += n.offsetLeft;
    y += n.offsetTop;
    n = n.offsetParent;
  }
  if (n !== grid) {
    // An unexpected offsetParent chain; fall back to painted boxes.
    const g = grid.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: r.left - g.left, y: r.top - g.top, w: r.width, h: r.height };
  }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

/** The anchor a line leaves from: the inner edge of a term or a definition. */
function _npMatchAnchor(el, grid) {
  const p = _npMatchPos(el, grid);
  const isLeft = el.classList.contains('np-match-left');
  return { x: isLeft ? p.x + p.w : p.x, y: p.y + p.h / 2 };
}

function _npMatchCurve(a, b) {
  const dx = (b.x - a.x) * 0.5;
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
}

const NP_MATCH_COLORS = ['#818cf8', '#34d399', '#fbbf24', '#38bdf8', '#fb7185', '#c084fc'];

function drawMatchingLines() {
  const svg = document.getElementById('np-matching-svg');
  if (!svg) return;
  const grid = svg.closest('.np-matching-grid');
  if (!grid || !activeNotebook) return;
  const drag = svg.querySelector('#np-match-drag');
  svg.innerHTML = '';

  const userMatches = sessionAnswers[currentSectionIdx][currentQuestionNum] || {};
  const isAnswered = sessionStatus[currentSectionIdx][currentQuestionNum] === 'answered';
  const NS = 'http://www.w3.org/2000/svg';

  Object.keys(userMatches).forEach(leftKey => {
    const li = parseInt(leftKey, 10);
    const ri = parseInt(userMatches[leftKey], 10);
    if (!Number.isInteger(li) || !Number.isInteger(ri)) return;
    const elLeft = document.getElementById(`np-match-left-${li}`);
    const elRight = document.getElementById(`np-match-right-${ri}`);
    if (!elLeft || !elRight) return;

    const a = _npMatchAnchor(elLeft, grid);
    const b = _npMatchAnchor(elRight, grid);
    let stroke = NP_MATCH_COLORS[li % NP_MATCH_COLORS.length];
    if (isAnswered || reviewMode) stroke = ri === li ? '#10b981' : '#ef4444';

    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', _npMatchCurve(a, b));
    path.setAttribute('stroke', stroke);
    path.setAttribute('stroke-width', '3');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('fill', 'none');
    path.setAttribute('class', 'np-match-line');
    path.setAttribute('style', `filter: drop-shadow(0 0 4px ${stroke}88);`);
    svg.appendChild(path);
    [a, b].forEach(pt => {
      const dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('cx', pt.x);
      dot.setAttribute('cy', pt.y);
      dot.setAttribute('r', '5');
      dot.setAttribute('fill', stroke);
      dot.setAttribute('stroke', '#0d1117');
      dot.setAttribute('stroke-width', '2');
      svg.appendChild(dot);
    });
  });
  // A drag in progress keeps its line through a redraw.
  if (drag) svg.appendChild(drag);
}

/* Redrawn whenever anything changes size: the question text typing itself
   out above, a font arriving, the sidebar being dragged wider, a text-size
   change. The old resize listener only caught the window. */
let _npMatchRO = null;
function _npWatchMatching(on) {
  if (_npMatchRO) { _npMatchRO.disconnect(); _npMatchRO = null; }
  if (!on || typeof ResizeObserver === 'undefined') return;
  const grid = document.querySelector('#np-bubbles-container .np-matching-grid');
  if (!grid) return;
  let raf = 0;
  _npMatchRO = new ResizeObserver(() => {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; drawMatchingLines(); });
  });
  _npMatchRO.observe(grid);
  grid.querySelectorAll('.np-match-item').forEach(el => _npMatchRO.observe(el));
}

/** Pair a term with a definition directly (the drag's drop). */
function npMatchPair(li, ri) {
  if (reviewMode || currentQuestionNum === null || isCheckingAnswer) return;
  if (sessionStatus[currentSectionIdx][currentQuestionNum] === 'answered') return;
  let current = sessionAnswers[currentSectionIdx][currentQuestionNum];
  if (typeof current !== 'object' || current === null) current = {};
  // One definition per term and one term per definition.
  Object.keys(current).forEach(k => { if (parseInt(current[k], 10) === ri) delete current[k]; });
  current[li] = ri;
  sessionAnswers[currentSectionIdx][currentQuestionNum] = current;
  sessionStatus[currentSectionIdx][currentQuestionNum] = 'opened';
  window._matchingSelectedLeft = null;
  npSaveProgress();
  if (typeof npUiSfx === 'function') npUiSfx('link');
  renderQuestion();
}

/* ── Drag to match ──────────────────────────────────────────────
   Press on a term (or a definition) and drag: a connector leaves its edge and
   stays on the pointer, the item under the pointer on the other side lights
   up, and letting go there makes the pair. A press that does not travel is a
   click, which still works the old way. */
let _npDrag = null;
let _npDragEatClick = false;

function _npDragIdx(el) {
  const m = /np-match-(left|right)-(\d+)/.exec(el.id || '');
  return m ? { side: m[1], idx: parseInt(m[2], 10) } : null;
}

function npDragDown(e) {
  if (e.button !== 0 || reviewMode || isCheckingAnswer) return;
  const item = e.target.closest && e.target.closest('.np-match-item');
  const grid = item && item.closest('.np-matching-grid');
  if (!item || !grid || grid.classList.contains('is-locked')) return;
  const id = _npDragIdx(item);
  if (!id) return;
  _npDrag = { item, grid, id, x0: e.clientX, y0: e.clientY, pid: e.pointerId, live: false, target: null };
  document.addEventListener('pointermove', _npDragMove);
  document.addEventListener('pointerup', _npDragUp);
  document.addEventListener('pointercancel', _npDragCancel);
}

function _npDragMove(e) {
  const d = _npDrag;
  if (!d || e.pointerId !== d.pid) return;
  if (!d.live) {
    if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 6) return;
    d.live = true;
    try { d.item.setPointerCapture(d.pid); } catch (err) { /* already released */ }
    d.item.classList.add('is-drag-src');
    d.grid.classList.add('is-dragging');
    const layout = document.getElementById('np-layout');
    if (layout) layout.classList.add('np-dragging');
    const svg = document.getElementById('np-matching-svg');
    if (svg) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.id = 'np-match-drag';
      path.setAttribute('class', 'np-match-drag');
      path.setAttribute('fill', 'none');
      svg.appendChild(path);
    }
  }
  e.preventDefault();
  // What is under the pointer, on the other side.
  const under = document.elementFromPoint(e.clientX, e.clientY);
  let target = under && under.closest ? under.closest('.np-match-item') : null;
  const tid = target ? _npDragIdx(target) : null;
  if (!tid || tid.side === d.id.side || !d.grid.contains(target)) target = null;
  if (target !== d.target) {
    if (d.target) d.target.classList.remove('is-drop');
    if (target) target.classList.add('is-drop');
    d.target = target;
  }
  const path = document.getElementById('np-match-drag');
  if (path) {
    const g = d.grid.getBoundingClientRect();
    const a = _npMatchAnchor(d.item, d.grid);
    // On the pointer the whole way; it snaps to the target's edge once you are on it.
    const b = target ? _npMatchAnchor(target, d.grid) : { x: e.clientX - g.left, y: e.clientY - g.top };
    path.setAttribute('d', d.id.side === 'left' ? _npMatchCurve(a, b) : _npMatchCurve(b, a));
    path.classList.toggle('is-on-target', !!target);
  }
}

function _npDragEnd() {
  const d = _npDrag;
  _npDrag = null;
  document.removeEventListener('pointermove', _npDragMove);
  document.removeEventListener('pointerup', _npDragUp);
  document.removeEventListener('pointercancel', _npDragCancel);
  if (!d) return null;
  try { d.item.releasePointerCapture(d.pid); } catch (err) { /* not captured */ }
  d.item.classList.remove('is-drag-src');
  d.grid.classList.remove('is-dragging');
  if (d.target) d.target.classList.remove('is-drop');
  const layout = document.getElementById('np-layout');
  if (layout) layout.classList.remove('np-dragging');
  const path = document.getElementById('np-match-drag');
  if (path) path.remove();
  return d;
}

function _npDragUp(e) {
  const d = _npDrag;
  if (!d || e.pointerId !== d.pid) return;
  const live = d.live;
  const target = d.target;
  _npDragEnd();
  if (!live) return;               // a plain click: the onclick handles it
  _npDragEatClick = true;          // the click that follows a drag is not a click
  setTimeout(() => { _npDragEatClick = false; }, 0);
  if (target) {
    const a = d.id;
    const b = _npDragIdx(target);
    const li = a.side === 'left' ? a.idx : b.idx;
    const ri = a.side === 'left' ? b.idx : a.idx;
    npMatchPair(li, ri);
  } else {
    drawMatchingLines();
  }
}

function _npDragCancel() { if (_npDragEnd()) drawMatchingLines(); }

/** Capture-phase click on the choices: swallows the click a drag leaves behind. */
function npDragClick(e) {
  if (!_npDragEatClick) return;
  _npDragEatClick = false;
  e.stopPropagation();
  e.preventDefault();
}

/* ----------------------------------------------------------
   SUBMISSION
   ---------------------------------------------------------- */
function npSubmitAttempt(force = false) {
  if (reviewMode) return;
  if (force) { processSubmission(); return; }

  // Unanswered, by section, in the order they are on screen. A typed but
  // unsent text answer counts as answered: it is graded at submission.
  const missing = [];
  let flagged = 0;
  activeNotebook.sections.forEach((sec, si) => {
    const list = [];
    (sec.questions || []).forEach((q, pos) => {
      const st = sessionStatus[si] && sessionStatus[si][q];
      const draft = npTextDrafts[si] && String(npTextDrafts[si][q] || '').trim();
      if (st !== 'answered' && !draft) list.push({ q, pos });
    });
    if (list.length) missing.push({ si, label: sec.label || ('Section ' + (si + 1)), list });
    flagged += npFlags[si] ? npFlags[si].size : 0;
  });
  const count = missing.reduce((n, m) => n + m.list.length, 0);

  if (typeof npUiSheet !== 'function') {
    showConfirm(count ? 'Unanswered Questions' : 'Submit Attempt',
      count ? `You have ${count} unanswered question${count !== 1 ? 's' : ''}. Submit anyway?` : 'Are you sure you want to submit your answers?',
      () => processSubmission(), { tone: 'primary', confirmLabel: 'Submit' });
    return;
  }

  if (!count) {
    npUiSheet({
      icon: 'send', tone: 'info', title: 'Submit attempt?',
      body: 'Every question is answered.' + (flagged ? ` ${flagged} still flagged for review.` : ''),
      actions: [
        { label: 'Keep going', kind: 'ghost', value: 'stay', key: 'Escape' },
        { label: 'Submit', kind: 'primary', value: 'submit', key: 'Enter' }
      ],
      onChoose: (v) => { if (v === 'submit') processSubmission(); }
    });
    return;
  }

  const list = missing.map(m => '<div class="np-sheet-row"><b>' + escapeHTML(m.label) + '</b><span>'
    + m.list.slice(0, 24).map(x => 'Q' + (x.pos + 1)).join(', ') + (m.list.length > 24 ? ', \u2026' : '')
    + '</span></div>').join('');
  // The first one still reachable: anywhere, or only ahead with no backtracking.
  const curPos = (activeNotebook.sections[currentSectionIdx].questions || []).indexOf(currentQuestionNum);
  const reach = missing.map(m => ({ si: m.si, hit: m.list.find(x => !npNoBack || m.si > currentSectionIdx || (m.si === currentSectionIdx && x.pos >= curPos)) }))
    .find(r => r.hit && (!npNoBack || r.si >= currentSectionIdx));
  const actions = [{ label: 'Submit anyway', kind: 'ghost', value: 'submit' }];
  if (reach) actions.push({ label: 'Go to Q' + (reach.hit.pos + 1), kind: 'primary', value: 'go', key: 'Enter', icon: 'arrow-right' });
  else actions.push({ label: 'Keep going', kind: 'primary', value: 'stay', key: 'Enter' });
  npUiSheet({
    icon: 'circle-help', tone: 'warn',
    title: count + ' unanswered question' + (count !== 1 ? 's' : ''),
    body: '<div class="np-sheet-list">' + list + '</div>'
      + (flagged ? '<p class="np-sheet-note">' + flagged + ' flagged for review.</p>' : '')
      + (npNoBack ? '<p class="np-sheet-note">No backtracking: only the ones ahead can still be answered.</p>' : ''),
    actions,
    onChoose: (v) => {
      if (v === 'submit') processSubmission();
      else if (v === 'go' && reach) {
        if (reach.si !== currentSectionIdx) switchSection(reach.si);
        jumpToQuestion(reach.hit.q);
      }
    }
  });
}

function processSubmission() {
  if (timerInterval) clearInterval(timerInterval);
  _npQClockStop();
  if (npPaused && typeof npTogglePause === 'function') npTogglePause();

  // If the timer paused when the last question was answered, the recorded
  // duration ends there too — browsing before pressing Submit costs nothing.
  const endTime = npFinishedAt || Date.now();
  const elapsed = Math.round((endTime - (practiceStartTime || endTime)) / 1000);

  // Grade all answers
  let totalCorrect = 0;
  let totalQuestions = 0;

  const record = {
    id: 'nr_' + Date.now(),
    notebookId: activeNotebook.id,
    notebookTitle: activeNotebook.title,
    date: new Date().toLocaleDateString(),
    time: new Date().toLocaleTimeString(),
    // Stored explicitly. "Recent" sorting used to regex a timestamp back out of
    // the id, which silently breaks the moment the id format changes.
    submitTime: Date.now(),
    duration: elapsed,
    // How it was taken, for the history.
    noBacktracking: npNoBack || undefined,
    secondsPerQuestion: npQSec || undefined,
    sections: []
  };

  activeNotebook.sections.forEach((sec, idx) => {
    const keyMap = answerKeys[idx];
    const userAnswers = sessionAnswers[idx];
    let correct = 0;
    const qList = sec.questions || [];
    const total = qList.length;

    qList.forEach(qNum => {
      const keyEntry = keyMap[qNum];
      let userAns = userAnswers[qNum];
      // Typed into the box and never sent: it is still your answer.
      const draft = npTextDrafts[idx] && typeof npTextDrafts[idx][qNum] === 'string' ? npTextDrafts[idx][qNum].trim() : '';
      if (!userAns && draft && keyEntry && keyEntry.type === 'text') { userAns = draft; userAnswers[qNum] = draft; }
      if (userAns && npGradeEntry(userAns, keyEntry)) {
        gradeResults[idx][qNum] = 'correct';
        correct++;
      } else if (userAns) {
        gradeResults[idx][qNum] = 'wrong';
      } else {
        gradeResults[idx][qNum] = 'skipped';
      }
    });

    totalCorrect += correct;
    totalQuestions += total;

    record.sections.push({
      label: sec.label,
      correct: correct,
      total: total,
      questionsCount: total,
      answers: { ...userAnswers },
      keyMap: { ...keyMap },
      // Per-question verdicts, so the library can offer "drill what I got wrong"
      // without re-deriving them from answers + key.
      results: { ...gradeResults[idx] }
    });
  });

  // A drill is a one-shot narrowing — clear it so the next attempt is the
  // whole notebook again, and mark the record so history can tell them apart.
  if (activeNotebook.isDrill) record.isDrill = true;
  if (typeof clearSessionParam === 'function') clearSessionParam('notebookDrill');

  // Save to history
  if (!state.notebookHistory) state.notebookHistory = [];
  if (typeof langRunEarnStamina === 'function') langRunEarnStamina(1);
  state.notebookHistory.unshift(record);
  saveData();
  // The attempt is finished, so the in-progress copy is no longer wanted --
  // and nothing may write it back (see npSubmitted).
  npSubmitted = true;
  clearTimeout(_npSaveTimer);
  npClearProgress();
  npUnbindKeys();

  reviewRecord = record;

  // Show results overlay
  const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  // Spaced-repetition: schedule the next review of this notebook by accuracy.
  if (typeof recordReview === 'function') recordReview('notebook', activeNotebook.id, accuracy);
  // Quest penalties: a verified notebook completion (≥ threshold) auto-clears matching penalties.
  if (window.questPenalty && window.questPenalty.notifyActivity) {
    window.questPenalty.notifyActivity('notes', activeNotebook.id, accuracy);
  }
  showResultsOverlay(totalCorrect, totalQuestions, accuracy, elapsed, record);
}

/* ----------------------------------------------------------
   PER-QUESTION CLOCK (no backtracking only)
   ----------------------------------------------------------
   Each question you reach gets npQSec seconds. The count is shown on the
   card; run out and the question is left unanswered and the attempt moves
   on -- on the last question, it is submitted. Answering stops it. Kept in
   the progress draft, so reloading does not hand you a fresh count. */
function _npQClockStop() {
  if (npQTimer) { clearInterval(npQTimer); npQTimer = null; }
}

function _npQClockSync() {
  const pill = document.getElementById('np-qclock');
  if (!npNoBack || !npQSec || reviewMode || currentQuestionNum === null) {
    _npQClockStop();
    if (pill) pill.hidden = true;
    return;
  }
  const key = currentSectionIdx + '-' + currentQuestionNum;
  const answered = sessionStatus[currentSectionIdx] && sessionStatus[currentSectionIdx][currentQuestionNum] === 'answered';
  if (key !== npQKey) { npQKey = key; npQLeft = npQSec; }
  if (answered || isCheckingAnswer) _npQClockStop();
  else if (!npQTimer) npQTimer = setInterval(_npQClockTick, 1000);
  if (pill) pill.hidden = false;
  _npQClockPaint(answered);
}

function _npQClockTick() {
  if (npPaused || isCheckingAnswer) return;
  npQLeft = Math.max(0, npQLeft - 1);
  _npQClockPaint(false);
  if (npQLeft > 0 && npQLeft <= 3 && typeof npUiSfx === 'function') npUiSfx('untick');
  if (npQLeft <= 0) { _npQClockStop(); _npQTimeUp(); }
}

function _npQClockPaint(done) {
  const pill = document.getElementById('np-qclock');
  if (!pill) return;
  const n = pill.querySelector('b');
  if (n) n.textContent = Math.max(0, npQLeft);
  pill.style.setProperty('--np-qfrac', npQSec ? (Math.max(0, npQLeft) / npQSec).toFixed(3) : '0');
  pill.classList.toggle('is-low', !done && npQLeft <= 5);
  pill.classList.toggle('is-done', !!done);
  pill.title = done ? 'Answered' : npQLeft + ' seconds left on this question';
}

function _npQTimeUp() {
  if (reviewMode) return;
  if (typeof npUiSfx === 'function') npUiSfx('wrong');
  if (typeof toast === 'function') toast("Time's up on that one", { type: 'warning', duration: 1600 });
  const sec = activeNotebook.sections[currentSectionIdx];
  const list = sec.questions || [];
  const last = currentSectionIdx === activeNotebook.sections.length - 1 && list.indexOf(currentQuestionNum) === list.length - 1;
  npPendingPick = null;
  npSaveProgress();
  if (last) processSubmission();
  else npNextQuestion();
}

/* The pause: click the clock. */
function npTogglePause() {
  if (reviewMode) return;
  npPaused = !npPaused;
  if (npPaused) {
    _npPausedAt = Date.now();
  } else if (_npPausedAt) {
    // The paused stretch is not time spent on the attempt.
    if (practiceStartTime) practiceStartTime += Date.now() - _npPausedAt;
    _npPausedAt = 0;
  }
  if (typeof npUiPaintPause === 'function') npUiPaintPause(npPaused);
}

/* ----------------------------------------------------------
   RESULTS OVERLAY
   ---------------------------------------------------------- */
function showResultsOverlay(correct, total, accuracy, elapsed, record) {
  const overlay = document.getElementById('np-results-overlay');
  if (!overlay) return;
  // The end of the attempt: a full sweep of bells for a perfect score, the
  // finishing fanfare otherwise.
  if (typeof npUiSfx === 'function') npUiSfx(total > 0 && correct === total ? 'perfect' : 'finish');

  let wrong = 0, skipped = 0;
  (record.sections || []).forEach(sec => Object.values(sec.results || {}).forEach(r => {
    if (r === 'wrong') wrong++;
    else if (r === 'skipped') skipped++;
  }));

  // Multi-notebook session: say where you are and offer the next one, rather
  // than dropping you back at the library after every notebook.
  let queueHtml = '';
  const queue = typeof getSessionParam === 'function' ? getSessionParam('notebookQueue') : null;
  if (queue && Array.isArray(queue.ids)) {
    const at = (queue.index || 0) + 1;
    const last = at >= queue.ids.length;
    queueHtml = `
      <div class="np-queue-bar">
        <span><i data-lucide="layout-grid" style="width:14px;height:14px;"></i> Session — notebook ${at} of ${queue.ids.length}</span>
        <div>
          <button class="btn btn-ghost btn-sm" onclick="notesQueueCancel()">End session</button>
          <button class="btn btn-primary btn-sm" onclick="notesQueueAdvance(${accuracy})">
            ${last ? 'Finish session' : 'Next notebook'} <i data-lucide="arrow-right" style="width:14px;height:14px;"></i>
          </button>
        </div>
      </div>`;
  }

  if (typeof npUiResultsHTML === 'function') {
    overlay.innerHTML = npUiResultsHTML({
      correct, total, wrong, skipped, missed: wrong + skipped,
      time: formatTimeDisplay(elapsed), sections: record.sections, queue: queueHtml
    });
  }
  overlay.classList.remove('hidden');
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: overlay });
  const first = overlay.querySelector('.np-res-btn.is-primary');
  if (first) setTimeout(() => first.focus({ preventScroll: true }), 60);
}

/* Again, from the results. Same time limit and rules as this attempt.

   Retry missed is a drill over what was wrong or skipped. The drill is keyed
   by the notebook's OWN section order, and this attempt may itself have been
   a drill over fewer sections, so each section is found again by id (or
   label) before its questions are listed. */
function _npRestartWith(drill) {
  const id = activeNotebook && activeNotebook.id;
  if (!id) return;
  setSessionParam('activeNotebook', id);
  setSessionParam('notebookTimeLimit', timeLimit || 0);
  setSessionParam('notebookNoBack', npNoBack);
  setSessionParam('notebookQSec', npQSec);
  if (drill) setSessionParam('notebookDrill', drill);
  else clearSessionParam('notebookDrill');
  // A query keeps the router from treating it as the screen already open.
  spaNavigate('notes-practice?again=' + Date.now());
}

function npRetryMissed() {
  if (!reviewRecord || !activeNotebook) return;
  const full = (state.notebooks || []).find(n => n.id === activeNotebook.id);
  if (!full) return;
  const bySection = {};
  let count = 0;
  (reviewRecord.sections || []).forEach((rs, i) => {
    const live = activeNotebook.sections[i] || {};
    let fi = live.id ? full.sections.findIndex(s => s.id === live.id) : -1;
    if (fi < 0) fi = full.sections.findIndex(s => s.label === rs.label);
    if (fi < 0) return;
    const list = Object.keys(rs.results || {}).filter(q => rs.results[q] !== 'correct').map(q => parseInt(q, 10));
    if (!list.length) return;
    bySection[fi] = (bySection[fi] || []).concat(list).sort((a, b) => a - b);
    count += list.length;
  });
  if (!count) return;
  _npRestartWith({ notebookId: full.id, bySection, count });
}

function npTryAgain() { _npRestartWith(null); }

/* ----------------------------------------------------------
   REVIEW MODE
   ---------------------------------------------------------- */
function enterReviewMode() {
  const overlay = document.getElementById('np-results-overlay');
  if (overlay) overlay.classList.add('hidden');

  reviewMode = true;

  // Swap topbars
  const pracTopbar = document.getElementById('np-topbar-practice');
  const revTopbar = document.getElementById('np-topbar-review');
  if (pracTopbar) pracTopbar.classList.add('hidden');
  if (revTopbar) revTopbar.classList.remove('hidden');

  // Show score in review topbar
  const scoreEl = document.getElementById('np-review-score');
  if (scoreEl && reviewRecord) {
    let totalCorrect = 0, totalQs = 0;
    (reviewRecord.sections || []).forEach(s => {
      totalCorrect += s.correct || 0;
      totalQs += s.total || 0;
    });
    const accuracy = totalQs > 0 ? Math.round((totalCorrect / totalQs) * 100) : 0;
    // Amber for a partial score, never red: there is no failed state.
    const tone = accuracy === 100 ? 'perfect' : accuracy >= 80 ? 'good' : 'warn';
    scoreEl.className = 'np-review-score';
    scoreEl.removeAttribute('style');
    scoreEl.dataset.tone = tone;
    scoreEl.innerHTML = `
      <span class="np-rs-label">Score</span>
      <span class="np-rs-num">${totalCorrect}<em>/ ${totalQs}</em></span>
      <span class="np-rs-bar"><i style="width:${accuracy}%"></i></span>
      <span class="np-rs-pct">${accuracy}%</span>
    `;
  }

  // Update footer
  // A note above the shortcuts dropdown, not in place of it: the grid's
  // colour key is in there, and review is when right and wrong matter most.
  const footer = document.getElementById('np-footer-text');
  if (footer && !footer.querySelector('.np-review-note')) {
    footer.insertAdjacentHTML('afterbegin', '<p class="np-review-note">Review mode — move through the questions to see the right answers marked.</p>');
  }

  // Re-render with review styling
  currentSectionIdx = 0;
  const firstSec = activeNotebook.sections[0];
  if (firstSec.questions && firstSec.questions.length > 0) {
    currentQuestionNum = firstSec.questions[0];
  }

  renderSidebar();
  renderQuestion();
}

function exitReview() {
  spaNavigate('study');
}

/* ----------------------------------------------------------
   HINT MODAL
   ---------------------------------------------------------- */
function showHintModal() {
  const correctObj = answerKeys[currentSectionIdx][currentQuestionNum];
  if (!correctObj || !correctObj.hint) return;
  // Inline, under the question it is a hint for. The modal covered the very
  // question you needed it for; it is kept only as a fallback.
  const inline = document.getElementById('np-hint-inline');
  if (inline) {
    const open = inline.classList.toggle('is-open');
    inline.innerHTML = open
      ? '<i data-lucide="lightbulb"></i><span>' + escapeHTML(correctObj.hint).replace(/\n/g, '<br/>') + '</span>'
      : '';
    inline.dataset.qid = open ? currentSectionIdx + '-' + currentQuestionNum : '';
    const btn = document.getElementById('np-hint-btn');
    if (btn) btn.classList.toggle('is-on', open);
    if (open && typeof lucide !== 'undefined') lucide.createIcons({ root: inline });
    return;
  }

  const textEl = document.getElementById('hint-modal-text');
  if (textEl) {
    textEl.innerHTML = escapeHTML(correctObj.hint).replace(/\n/g, '<br/>');
  }

  const modal = document.getElementById('hint-modal');
  if (modal) {
    modal.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: modal });
  }
}

function closeHintModal() {
  const modal = document.getElementById('hint-modal');
  if (modal) modal.classList.add('hidden');
}

/* ----------------------------------------------------------
   TEXT ALIGNMENT TOGGLE
   ---------------------------------------------------------- */
function toggleNpTextAlign() {
  npTextAlignCenter = !npTextAlignCenter;
  localStorage.setItem('npTextAlign', npTextAlignCenter ? 'center' : 'left');
  const btn = document.getElementById('np-align-btn');
  if (btn) {
    btn.innerHTML = npTextAlignCenter
      ? '<i data-lucide="align-center"></i>'
      : '<i data-lucide="align-left"></i>';
    btn.title = npTextAlignCenter ? 'Text: Centered' : 'Text: Left-aligned';
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: btn });
  }
  renderQuestion();
}
