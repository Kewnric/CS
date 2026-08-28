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

  // Clone to avoid mutating state when shuffling questions
  activeNotebook = JSON.parse(JSON.stringify(origNb));

  const titleEl = document.getElementById('np-notebook-title');
  if (titleEl) titleEl.textContent = activeNotebook.title;

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

  if (_npResume && _npResume.notebookId === activeNotebook.id && !reviewRecord && _npAutoResume) {
    if (npApplyProgress(_npResume)) {
      initTimer();
      renderSidebar();
      renderQuestion();
      npPaintFlagBtn();
    }
  } else if (_npResume && _npResume.notebookId === activeNotebook.id && !reviewRecord) {
    const mins = Math.max(1, Math.round((Date.now() - (_npResume.savedAt || Date.now())) / 60000));
    const answered = (_npResume.answers || []).reduce(
      (n, sec) => n + Object.values(sec || {}).filter(v => v != null && v !== '').length, 0);
    _showThreeButtonDialog('Unfinished attempt',
      `You left "${_npResume.title || activeNotebook.title}" about ${mins} minute${mins !== 1 ? 's' : ''} ago with ${answered} question${answered !== 1 ? 's' : ''} answered.`,
      [
        { label: 'Resume', primary: true, action: 'resume' },
        { label: 'Start over', danger: true, action: 'fresh' }
      ],
      (choice) => {
        if (choice === 'resume' && npApplyProgress(_npResume)) {
          initTimer();
          renderSidebar();
          renderQuestion();
          npPaintFlagBtn();
        } else {
          npClearProgress();
        }
      });
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

function initSessionState() {
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

  activeNotebook.sections.forEach((sec, idx) => {
    if (!reviewRecord && sec.questions) {
      // Fisher–Yates (unbiased) — `sort(() => Math.random() - 0.5)` is not uniform.
      for (let j = sec.questions.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [sec.questions[j], sec.questions[k]] = [sec.questions[k], sec.questions[j]];
      }
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
    sessionStatus.push(st);
    gradeResults.push(gr);

    // Parse answer key
    const keyMap = {};
    if (sec.answerKeysData && sec.answerKeysData.length > 0) {
      sec.answerKeysData.forEach(d => {
        const entry = { answer: d.answer, type: d.type || 'mcq', explanation: d.explanation, question: d.question, hint: d.hint, image: d.image || '', choices: d.choices || {}, pairs: d.pairs || [] };
        // Matching: build shuffled right-column order
        if (entry.type === 'matching' && entry.pairs.length > 0) {
          const rightItems = entry.pairs.map((p, i) => ({ text: p.right, origIdx: i }));
          for (let j = rightItems.length - 1; j > 0; j--) {
            const k = Math.floor(Math.random() * (j + 1));
            [rightItems[j], rightItems[k]] = [rightItems[k], rightItems[j]];
          }
          entry._shuffledRight = rightItems;
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
    answerKeys.push(keyMap);

    // Reconcile questions[] with the answer key: drop question numbers that have
    // no key entry. Without a key they can't be graded and would render with
    // generic A–D choices that always score "wrong". (Skip in review mode so the
    // saved record stays intact.)
    if (!reviewRecord && sec.questions) {
      sec.questions = sec.questions.filter(q => keyMap[q]);
    }
  });
}

/* ----------------------------------------------------------
   TIMER
   ---------------------------------------------------------- */
function initTimer() {
  if (timerInterval) clearInterval(timerInterval);
  const display = document.getElementById('np-timer-display');
  if (!display) return;

  if (timeLimit <= 0) {
    timeRemaining = 0;
    updateTimerDisplay();
    timerInterval = setInterval(() => {
      timeRemaining++;
      updateTimerDisplay();
    }, 1000);
    return;
  }

  timeRemaining = timeLimit;
  updateTimerDisplay();

  timerInterval = setInterval(() => {
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

function npPrevQuestion() {
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
  const withText = (letter) => {
    const t = choices && choices[letter] ? choices[letter] : '';
    return t ? `${letter} — ${t}` : letter;
  };
  if (type === 'matching') {
    const pairs = keyEntry && Array.isArray(keyEntry.pairs) ? keyEntry.pairs : [];
    return pairs.length ? pairs.map(p => `${p.left} → ${p.right}`).join(' · ') : '—';
  }
  if (!answer || (Array.isArray(answer) && answer.length === 0)) return '—';
  if (type === 'checkbox' && Array.isArray(answer)) return answer.map(withText).join(', ');
  if (type === 'truefalse') return _npNormTF(answer) === 'A' ? 'True' : _npNormTF(answer) === 'B' ? 'False' : String(answer);
  if (type === 'mcq' || type === undefined) return withText(String(answer));
  return String(answer);
}

/* ----------------------------------------------------------
   ANSWER SELECTION (Practice Mode Only)
   ---------------------------------------------------------- */
function selectAnswer(letter) {
  if (reviewMode || currentQuestionNum === null || isCheckingAnswer) return;
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
    renderQuestion();
    return;
  }

  // MCQ: immediate grade
  sessionAnswers[currentSectionIdx][currentQuestionNum] = letter; npSaveProgress();
  sessionStatus[currentSectionIdx][currentQuestionNum] = 'answered';
  gradeAndAdvance();
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
    if (typeof confetti === 'function') confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    gradeAdvanceTimer = setTimeout(() => {
      gradeAdvanceTimer = null;
      isCheckingAnswer = false;
      renderSidebar();
      npNextQuestion();
    }, 1500);
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
  if (modal) { modal.classList.remove('hidden'); if (typeof lucide !== 'undefined') lucide.createIcons({ root: modal }); }
}

function closeWrongAnswerPopupAndNext() {
  const modal = document.getElementById('dialog-modal');
  if (modal) modal.classList.add('hidden');
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
    let scoreHtml = '';
    if (reviewMode) {
      const gr = gradeResults[idx];
      const qList = sec.questions || [];
      const correct = qList.filter(q => gr[q] === 'correct').length;
      const total = qList.length;
      const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
      const color = pct === 100 ? '#10b981' : pct >= 70 ? '#fbbf24' : '#ef4444';
      scoreHtml = `<span style="font-size:0.6875rem; font-weight:700; color:${color}; margin-left:auto;">${correct}/${total}</span>`;
    } else {
      scoreHtml = `<span style="font-size:0.6875rem; opacity:0.6; margin-top:0.125rem;">${(sec.questions || []).length} Qs</span>`;
    }

    return `
      <button class="np-sidebar-tab-dark ${isActive ? 'active' : ''}" onclick="switchSection(${idx})">
        <div style="display:flex; align-items:center; gap:0.5rem; flex:1;">
          <span style="font-family:var(--font-mono); font-size:0.6875rem; opacity:0.5;">${String(idx + 1).padStart(2, '0')}</span>
          <span style="font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${escapeHTML(sec.label)}
          </span>
        </div>
        ${scoreHtml}
      </button>
    `;
  }).join('');

  // Grid
  const sec = activeNotebook.sections[currentSectionIdx];
  const sectionTitle = document.getElementById('np-current-section-title');
  if (sectionTitle) sectionTitle.textContent = sec.label;

  const gridContainer = document.getElementById('np-question-grid');
  if (!gridContainer) return;

  // The grid used to print the AUTHORED number. Questions are shuffled, so it
  // read "2 1 5 3 4" while the header said "1 / 5" — the first button was the
  // first question but was labelled 2. Position is what the header counts, so
  // position is what the button shows; the original number is on the tooltip.
  gridContainer.innerHTML = (sec.questions || []).map((qNum, pos) => {
    let cls = 'np-grid-box';

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

    const flagged = npIsFlagged(currentSectionIdx, qNum);
    return `<button class="${cls}" onclick="jumpToQuestion(${qNum})"
              title="Question ${pos + 1}${flagged ? ' — flagged for review' : ''}"
              aria-label="Go to question ${pos + 1}${flagged ? ', flagged' : ''}">${pos + 1}${flagged ? '<span class="np-grid-flag"></span>' : ''}</button>`;
  }).join('');
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
  if (reviewMode || !activeNotebook) return;
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
      timeLimit: timeLimit || 0
    }));
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

/** Puts a saved attempt back exactly where it was. */
function npApplyProgress(d) {
  if (!d || !activeNotebook) return false;
  try {
    (activeNotebook.sections || []).forEach((sec, i) => {
      if (d.order && d.order[i] && d.order[i].length === (sec.questions || []).length) {
        sec.questions = d.order[i].slice();   // the shuffle it was taken with
      }
    });
    if (d.answers) sessionAnswers = d.answers;
    if (d.status) sessionStatus = d.status;
    npFlags = (d.flags || []).map(arr => new Set(arr || []));
    currentSectionIdx = d.sectionIdx || 0;
    currentQuestionNum = d.questionNum != null ? d.questionNum : null;
    if (d.timeLimit > 0 && typeof d.timeRemaining === 'number') {
      timeLimit = d.timeLimit;
      timeRemaining = d.timeRemaining;
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
    const el = document.activeElement;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((el || {}).tagName || '') || (el || {}).isContentEditable;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (typing && e.key !== 'Escape') return;

    const k = e.key.toLowerCase();
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
  qLabelEl.innerHTML = `Question ${escapeHTML(currentQuestionNum.toString())} <span class="np-qtype-badge ${escapeHTML(qType)}">${escapeHTML(typeBadgeMap[qType] || 'MCQ')}</span>`;

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
    if (result === 'correct') { heading.textContent = 'Correct!'; heading.style.color = '#10b981'; }
    else if (result === 'wrong') { heading.textContent = 'Incorrect'; heading.style.color = '#ef4444'; }
    else { heading.textContent = 'Skipped'; heading.style.color = '#8b949e'; }

    // Only show full review status when NOT in the grading animation delay
    if (!isCheckingAnswer) {
      const userAns = selected;
      const userDisp = formatAnswerDisplay(userAns, qType, correctObj);
      const correctDisp = formatAnswerDisplay(correctAns, qType, correctObj);
      let statusHtml = '';
      if (result === 'correct') {
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
    heading.style.color = '#e6edf3';
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

  const qTextDiv = document.getElementById('np-q-text');
  const hintBtn = document.getElementById('np-hint-btn');
  if (qTextDiv) {
    if (correctObj && correctObj.question && correctObj.question.trim() !== '') {
      const qTrackerId = currentSectionIdx + '-' + currentQuestionNum;
      if (qTextDiv.dataset.currentQId !== qTrackerId) {
        qTextDiv.dataset.currentQId = qTrackerId;
        qTextDiv.textContent = '';
        qTextDiv.classList.remove('hidden');
        if (window.npQuestionAnimator) { window.npQuestionAnimator.abort(); window.npQuestionAnimator.removeCursor(); }
        window.npQuestionAnimator = new TextAnimator(qTextDiv, {
          speed: 7, blur: true, glow: false, chromatic: false, cursor: true,
          onComplete: () => { window.npQuestionAnimator.removeCursor(); }
        });
        window.npQuestionAnimator.createdAt = Date.now();
        window.npQuestionAnimator.type(correctObj.question);
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

    bubblesContainer.innerHTML = `
      <textarea id="np-text-answer-input" class="np-text-input-area" placeholder="Type your answer here... (Enter to submit)"
        style="border-color:${borderColor};" ${isAnswered || reviewMode ? 'disabled' : ''}>${escapeHTML(textVal)}</textarea>
      ${!isAnswered && !reviewMode ? `<button class="np-confirm-btn" onclick="confirmTextAnswer()"><i data-lucide="check" style="width:18px;height:18px;"></i> Submit Answer</button>` : ''}
      ${reviewMode && correctAns ? `<div class="np-text-compare" style="margin-top:0.5rem;"><span class="np-text-compare-label" style="color:#10b981;">Expected Answer</span>${escapeHTML(String(correctAns))}</div>` : ''}
    `;
    const textInput = document.getElementById('np-text-answer-input');
    if (textInput && !isAnswered && !reviewMode) {
      textInput.addEventListener('keydown', (e) => {
        // Enter submits, Shift+Enter inserts a newline
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); confirmTextAnswer(); }
      });
      textInput.focus();
    }
  }
  // === CHECKBOX TYPE ===
  else if (qType === 'checkbox') {
    // Per-question adaptive choices
    const qChoices = correctObj && correctObj.choices ? Object.keys(correctObj.choices).sort() : [];
    const letters = qChoices.length > 0 ? qChoices : Array.from({ length: sec.choices || 4 }, (_, i) => String.fromCharCode(65 + i));
    const selectedArr = Array.isArray(selected) ? selected : [];
    const correctArr = Array.isArray(correctAns) ? correctAns : [];
    const isAnswered = sessionStatus[currentSectionIdx][currentQuestionNum] === 'answered';

    bubblesContainer.innerHTML = letters.map(letter => {
      let cls = 'ns-bubble checkbox-mode';
      const isSelected = selectedArr.includes(letter);

      if (reviewMode) {
        cls += ' review-locked';
        if (isSelected && correctArr.includes(letter)) cls += ' review-correct';
        else if (isSelected && !correctArr.includes(letter)) cls += ' review-wrong';
        else if (!isSelected && correctArr.includes(letter)) cls += ' review-correct';
      } else {
        const showResult = isCheckingAnswer || isAnswered;
        if (isSelected) {
          cls += ' selected';
          if (showResult) {
            if (correctArr.includes(letter)) cls += ' review-correct';
            else cls += ' review-wrong';
          }
        } else if (showResult && correctArr.includes(letter)) {
          cls += ' review-correct';
        }
      }

      const choiceText = correctObj && correctObj.choices && correctObj.choices[letter] ? correctObj.choices[letter] : '';
      const onclick = (reviewMode || isAnswered) ? '' : `onclick="selectAnswer('${letter}')"`;
      return `
        <div style="display:flex; flex-direction:column; gap:0.25rem; text-align:left; width: 100%;">
          <span style="font-size:0.75rem; font-weight:700; color:var(--text-tertiary); margin-left:0.25rem;">${letter}.</span>
          <button class="${cls}" style="width:100%; height:auto; border-radius:var(--radius-md); padding:1rem 1.25rem 1rem 2.25rem; text-align:${npTextAlignCenter ? 'center' : 'left'}; font-size:1rem; min-height:54px; display:flex; justify-content:${npTextAlignCenter ? 'center' : 'flex-start'}; align-items:center; white-space:normal; word-wrap:break-word; overflow-wrap:break-word;" ${onclick}>
            ${choiceText ? escapeHTML(choiceText) : letter}
          </button>
        </div>
      `;
    }).join('');

    if (!isAnswered && !reviewMode && !isCheckingAnswer) {
      bubblesContainer.innerHTML += `<button class="np-confirm-btn" onclick="confirmCheckboxAnswer()" ${selectedArr.length === 0 ? 'disabled' : ''}><i data-lucide="check" style="width:18px;height:18px;"></i> Confirm Selection (${selectedArr.length} chosen)</button>`;
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
      let cls = 'np-match-item np-match-left';
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
      let cls = 'np-match-item np-match-right';
      if (isUsed) cls += ' np-match-connected';
      const onclick = (reviewMode || isAnswered) ? '' : `onclick="selectMatchingRight(${item.origIdx})"`;
      
      let inlineStyle = '';
      if (isUsed && !isAnswered && !reviewMode) {
        const colorObj = MATCH_PAIR_COLORS[matchingLeftIdx % MATCH_PAIR_COLORS.length];
        inlineStyle = `style="border-color: ${colorObj.border} !important; background: ${colorObj.bg} !important;"`;
      }
      return `<div id="np-match-right-${item.origIdx}" class="${cls}" ${inlineStyle} ${onclick}>${escapeHTML(item.text)}</div>`;
    }).join('');

    bubblesContainer.innerHTML = `
      <div class="np-matching-grid" style="position: relative;">
        <!-- SVG Canvas for Connecting Lines -->
        <svg id="np-matching-svg" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 5;"></svg>
        
        <div class="np-matching-col"><h5 style="font-size:0.75rem; color:var(--text-tertiary); margin-bottom:0.5rem; text-transform:uppercase;">Terms</h5>${leftHtml}</div>
        <div class="np-matching-col"><h5 style="font-size:0.75rem; color:var(--text-tertiary); margin-bottom:0.5rem; text-transform:uppercase;">Definitions</h5>${rightHtml}</div>
      </div>
      ${!isAnswered && !reviewMode && !isCheckingAnswer ? `<button class="np-confirm-btn" onclick="confirmMatchingAnswer()" ${matchedCount < pairs.length ? 'disabled' : ''}><i data-lucide="check" style="width:18px;height:18px;"></i> Confirm Matches (${matchedCount}/${pairs.length})</button>` : ''}
      ${(isAnswered || reviewMode) ? `
        <div style="margin-top:1rem; padding:0.75rem; background:var(--bg-surface); border-radius:var(--radius-sm); border:1px solid var(--border-color);">
          <h5 style="font-size:0.75rem; color:var(--text-tertiary); margin-bottom:0.5rem;">Correct Pairings:</h5>
          ${pairs.map((p, i) => `<div style="font-size:0.85rem; padding:0.2rem 0;">${escapeHTML(p.left)} <span style="color:#f472b6; font-weight:700;">→</span> ${escapeHTML(p.right)}</div>`).join('')}
        </div>
      ` : ''}
    `;
  }
  // === TRUE/FALSE TYPE ===
  else if (qType === 'truefalse') {
    const isAnswered = sessionStatus[currentSectionIdx][currentQuestionNum] === 'answered';
    const correctLetter = _npNormTF(correctAns);

    const buttonsHtml = ['A', 'B'].map(letter => {
      const label = letter === 'A' ? 'True' : 'False';
      const color = letter === 'A' ? '#10b981' : '#ef4444';
      let cls = 'ns-bubble np-tf-bubble';
      if (reviewMode) {
        cls += ' review-locked';
        if (letter === correctLetter && selected === correctLetter) cls += ' review-correct';
        else if (letter === selected && selected !== correctLetter) cls += ' review-wrong';
        else if (letter === correctLetter && selected !== correctLetter) cls += ' review-correct';
      } else {
        const showResult = isCheckingAnswer || isAnswered;
        if (selected === letter) {
          cls += ' selected';
          if (showResult) {
            cls += (letter === correctLetter) ? ' review-correct' : ' review-wrong';
          }
        } else if (showResult && letter === correctLetter) {
          cls += ' review-correct';
        }
      }
      const onclick = (reviewMode || isAnswered) ? '' : `onclick="selectAnswer('${letter}')"`;
      return `
        <button class="${cls}" style="flex: 1; height: auto; border-radius:var(--radius-md); padding:1.5rem; text-align:center; font-size:1.25rem; font-weight:700; min-height:80px; color:${color}; border:2px solid ${color}33;" ${onclick}>
          ${label}
        </button>
      `;
    }).join('');

    bubblesContainer.innerHTML = `
      <div style="display: flex; flex-direction: row; gap: 1.25rem; width: 100%; max-width: 600px; justify-content: center; align-items: center; padding: 0.5rem 0;">
        ${buttonsHtml}
      </div>
    `;
  }
  // === MCQ TYPE (default) ===
  else {
    // Per-question adaptive choices
    const qChoices = correctObj && correctObj.choices ? Object.keys(correctObj.choices).sort() : [];
    const letters = qChoices.length > 0 ? qChoices : Array.from({ length: sec.choices || 4 }, (_, i) => String.fromCharCode(65 + i));

    const isAnswered = sessionStatus[currentSectionIdx][currentQuestionNum] === 'answered';
    // Normalize the stored key ('b' / ' B ') so highlight matches grading
    const correctLetter = String(correctAns == null ? '' : correctAns).trim().toUpperCase();

    bubblesContainer.innerHTML = letters.map(letter => {
      let cls = 'ns-bubble';
      if (reviewMode) {
        cls += ' review-locked';
        if (letter === correctLetter && selected === correctLetter) cls += ' review-correct';
        else if (letter === selected && selected !== correctLetter) cls += ' review-wrong';
        else if (letter === correctLetter && selected !== correctLetter) cls += ' review-correct';
      } else {
        const showResult = isCheckingAnswer || isAnswered;
        if (selected === letter) {
          cls += ' selected';
          if (showResult) {
            if (letter === correctLetter) cls += ' review-correct';
            else cls += ' review-wrong';
          }
        } else if (showResult && letter === correctLetter) {
          cls += ' review-correct';
        }
      }
      const choiceText = correctObj && correctObj.choices && correctObj.choices[letter] ? correctObj.choices[letter] : '';
      const onclick = (reviewMode || (sessionStatus[currentSectionIdx][currentQuestionNum] === 'answered')) ? '' : `onclick="selectAnswer('${letter}')"`;
      return `
        <div style="display:flex; flex-direction:column; gap:0.25rem; text-align:left; width: 100%;">
          <span style="font-size:0.75rem; font-weight:700; color:var(--text-tertiary); margin-left:0.25rem;">${letter}.</span>
          <button class="${cls}" style="width:100%; height:auto; border-radius:var(--radius-md); padding:1rem 1.25rem; text-align:${npTextAlignCenter ? 'center' : 'left'}; font-size:1rem; min-height:54px; display:flex; justify-content:${npTextAlignCenter ? 'center' : 'flex-start'}; align-items:center; white-space:normal; word-wrap:break-word; overflow-wrap:break-word;" ${onclick}>
            ${choiceText ? escapeHTML(choiceText) : letter}
          </button>
        </div>
      `;
    }).join('');
  }

  // Update nav buttons
  const btnPrev = document.getElementById('np-btn-prev');
  const btnNext = document.getElementById('np-btn-next');
  if (btnPrev) btnPrev.disabled = (currentSectionIdx === 0 && idx === 0);
  if (btnNext) btnNext.disabled = (currentSectionIdx === activeNotebook.sections.length - 1 && idx === qList.length - 1);

  const questionArea = document.getElementById('np-question-area') || document.getElementById('main-content');
  if (typeof lucide !== 'undefined') lucide.createIcons(questionArea ? { root: questionArea } : undefined);

  // Trigger SVG lines for matching questions
  if (qType === 'matching') {
    setTimeout(drawMatchingLines, 40);
    window.removeEventListener('resize', drawMatchingLines);
    window.addEventListener('resize', drawMatchingLines);
  } else {
    window.removeEventListener('resize', drawMatchingLines);
  }
}

/* Draw SVG connecting lines between matched terms and definitions */
function drawMatchingLines() {
  const svg = document.getElementById('np-matching-svg');
  if (!svg) return;
  svg.innerHTML = ''; // Clear previous lines

  const grid = document.querySelector('.np-matching-grid');
  if (!grid) return;
  const gridRect = grid.getBoundingClientRect();

  const sec = activeNotebook.sections[currentSectionIdx];
  const pairs = answerKeys[currentSectionIdx][currentQuestionNum]?.pairs || [];
  const userMatches = sessionAnswers[currentSectionIdx][currentQuestionNum] || {};
  const isAnswered = sessionStatus[currentSectionIdx][currentQuestionNum] === 'answered';

  const MATCH_PAIR_COLORS = [
    { border: '#818cf8', bg: 'rgba(99, 102, 241, 0.08)' }, // Indigo
    { border: '#34d399', bg: 'rgba(52, 211, 153, 0.08)' }, // Emerald
    { border: '#fbbf24', bg: 'rgba(251, 191, 36, 0.08)' }, // Amber
    { border: '#38bdf8', bg: 'rgba(56, 189, 248, 0.08)' }, // Sky
    { border: '#fb7185', bg: 'rgba(251, 113, 133, 0.08)' }, // Rose
    { border: '#c084fc', bg: 'rgba(192, 132, 252, 0.08)' }  // Purple
  ];

  Object.keys(userMatches).forEach(leftKey => {
    const li = parseInt(leftKey);
    const ri = userMatches[leftKey];
    if (ri === undefined || ri === null) return;

    const elLeft = document.getElementById(`np-match-left-${li}`);
    const elRight = document.getElementById(`np-match-right-${ri}`);

    if (elLeft && elRight) {
      const rectLeft = elLeft.getBoundingClientRect();
      const rectRight = elRight.getBoundingClientRect();

      // Start point: center-right edge of left item
      const x1 = rectLeft.right - gridRect.left;
      const y1 = (rectLeft.top + rectLeft.bottom) / 2 - gridRect.top;

      // End point: center-left edge of right item
      const x2 = rectRight.left - gridRect.left;
      const y2 = (rectRight.top + rectRight.bottom) / 2 - gridRect.top;

      // Bezier curve calculations for a smooth S-curve
      const cx1 = x1 + (x2 - x1) * 0.45;
      const cy1 = y1;
      const cx2 = x2 - (x2 - x1) * 0.45;
      const cy2 = y2;

      // Determine match line color
      let strokeColor = MATCH_PAIR_COLORS[li % MATCH_PAIR_COLORS.length].border;
      if (isAnswered || reviewMode) {
        const isCorrect = ri === li;
        strokeColor = isCorrect ? '#10b981' : '#ef4444'; // Green for correct, Red for wrong
      }

      // Create smooth Bezier path
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`);
      path.setAttribute('stroke', strokeColor);
      path.setAttribute('stroke-width', '3');
      path.setAttribute('fill', 'none');
      path.setAttribute('style', `filter: drop-shadow(0 0 2px ${strokeColor}66); transition: stroke 0.3s ease;`);
      svg.appendChild(path);

      // Start circle anchor
      const dot1 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot1.setAttribute('cx', x1);
      dot1.setAttribute('cy', y1);
      dot1.setAttribute('r', '4.5');
      dot1.setAttribute('fill', strokeColor);
      svg.appendChild(dot1);

      // End circle anchor
      const dot2 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot2.setAttribute('cx', x2);
      dot2.setAttribute('cy', y2);
      dot2.setAttribute('r', '4.5');
      dot2.setAttribute('fill', strokeColor);
      svg.appendChild(dot2);
    }
  });
}

/* ----------------------------------------------------------
   SUBMISSION
   ---------------------------------------------------------- */
function npSubmitAttempt(force = false) {
  if (reviewMode) return;

  if (!force) {
    let unanswered = 0;
    sessionStatus.forEach(st => Object.values(st).forEach(s => { if (s !== 'answered') unanswered++; }));

    if (unanswered > 0) {
      showConfirm('Unanswered Questions', `You have ${unanswered} unanswered question${unanswered !== 1 ? 's' : ''}. Submit anyway?`, () => {
        processSubmission();
      });
      return;
    }

    showConfirm('Submit Attempt', 'Are you sure you want to submit your answers?', () => {
      processSubmission();
    });
    return;
  }

  processSubmission();
}

function processSubmission() {
  if (timerInterval) clearInterval(timerInterval);

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
      const userAns = userAnswers[qNum];
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
  state.notebookHistory.unshift(record);
  saveData();
  // The attempt is finished, so the in-progress copy is no longer wanted.
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
   RESULTS OVERLAY
   ---------------------------------------------------------- */
function showResultsOverlay(correct, total, accuracy, elapsed, record) {
  const overlay = document.getElementById('np-results-overlay');
  if (!overlay) return;

  const iconEl = document.getElementById('np-results-icon');
  const titleEl = document.getElementById('np-results-title');
  const descEl = document.getElementById('np-results-desc');
  const breakdownEl = document.getElementById('np-results-breakdown');

  // Icon
  let iconColor, iconName, titleText;
  if (accuracy === 100) {
    iconColor = 'var(--color-success)';
    iconName = 'trophy';
    titleText = 'Perfect Score! 🎉';
  } else if (accuracy >= 80) {
    iconColor = 'var(--color-success)';
    iconName = 'check-circle-2';
    titleText = 'Great Job!';
  } else if (accuracy >= 50) {
    iconColor = 'var(--color-warning)';
    iconName = 'alert-circle';
    titleText = 'Good Effort';
  } else {
    iconColor = 'var(--color-danger)';
    iconName = 'x-circle';
    titleText = 'Keep Practicing';
  }

  iconEl.innerHTML = `<i data-lucide="${iconName}" style="width:56px;height:56px;color:${iconColor};"></i>`;
  titleEl.textContent = titleText;
  titleEl.style.color = iconColor;
  descEl.innerHTML = `You scored <strong style="font-size:1.25em;color:${iconColor};">${correct}/${total}</strong> (${accuracy}%) in ${formatTimeDisplay(elapsed)}`;

  // Section breakdown
  let breakdownHtml = '<div style="display:flex; flex-direction:column; gap:0.5rem;">';
  record.sections.forEach(sec => {
    const pct = sec.total > 0 ? Math.round((sec.correct / sec.total) * 100) : 0;
    const barColor = pct === 100 ? 'var(--color-success)' : pct >= 70 ? 'var(--color-warning)' : 'var(--color-danger)';
    breakdownHtml += `
      <div style="background:var(--bg-surface-hover); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:0.625rem 0.875rem;">
        <div style="display:flex; justify-content:space-between; margin-bottom:0.375rem;">
          <span style="font-weight:600; font-size:0.8125rem;">${escapeHTML(sec.label)}</span>
          <span style="font-weight:700; font-size:0.8125rem; color:${barColor};">${sec.correct}/${sec.total}</span>
        </div>
        <div style="height:4px; background:var(--border-color); border-radius:4px; overflow:hidden;">
          <div style="height:100%; width:${pct}%; background:${barColor}; border-radius:4px; transition:width 0.5s ease;"></div>
        </div>
      </div>
    `;
  });
  breakdownHtml += '</div>';

  // Multi-notebook session: say where you are and offer the next one, rather
  // than dropping you back at the library after every notebook.
  const queue = typeof getSessionParam === 'function' ? getSessionParam('notebookQueue') : null;
  if (queue && Array.isArray(queue.ids)) {
    const at = (queue.index || 0) + 1;
    const last = at >= queue.ids.length;
    breakdownHtml += `
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
  breakdownEl.innerHTML = breakdownHtml;

  overlay.classList.remove('hidden');
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: overlay });
}

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
    const color = accuracy === 100 ? '#10b981' : accuracy >= 70 ? '#fbbf24' : '#ef4444';
    scoreEl.innerHTML = `
      <span style="color:#8b949e;">Score:</span>
      <span style="font-family:var(--font-mono); font-size:1.25rem; color:${color};">${totalCorrect}/${totalQs}</span>
      <span style="font-family:var(--font-mono); color:${color};">(${accuracy}%)</span>
    `;
  }

  // Update footer
  const footer = document.getElementById('np-footer-text');
  if (footer) footer.innerHTML = '<p style="color:#10b981;">Review mode — navigate questions to see correct answers highlighted.</p>';

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
