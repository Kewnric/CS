/* ============================================================
   EXAM-MODE.JS — two constraints you can put on an attempt
   ------------------------------------------------------------
   Both are chosen in Session Setup, beside the time limit, because that is
   already the screen that asks how hard this attempt should be.

   RECALL. The attempt screen leaks the answer in two places that are useful
   while learning and dishonest while testing yourself: the starter code, and
   the boss bar — which measures how close your text is to the reference, so
   watching it rise IS being told you are on the right track. Recall starts you
   from an empty file with the bar switched off. The spec, the samples and the
   tests all stay: it is a memory exercise, not a guessing one.

   RUN BUDGET, AND IT NEVER BLOCKS. The first version of this disabled Run once
   the budget was spent, on the theory that a real exam has no Run button. That
   is not this course's exam: you compile and you check, and a screen that
   refuses to would be a worse rehearsal, not a harder one. So the budget
   counts and reports, and Run and Check Code keep working past it — the point
   is to notice that you have run eleven times, which is the habit worth
   changing, not to be stopped on the eleventh.
   ============================================================ */

const EXAM_RECALL_KEY = 'practiceRecall';
const EXAM_BUDGET_KEY = 'practiceRunBudget';
const EXAM_RUNS_KEY = 'practiceRunsUsed';

/** Is this attempt a recall attempt? @returns {boolean} */
function examRecallOn() {
  return getSessionParam(EXAM_RECALL_KEY) === true || getSessionParam(EXAM_RECALL_KEY) === 'true';
}

/** Runs this attempt is meant to take. 0 means "not counting". @returns {number} */
function examRunBudget() {
  const n = parseInt(getSessionParam(EXAM_BUDGET_KEY), 10);
  return n > 0 ? n : 0;
}

/** Runs actually spent so far. @returns {number} */
function examRunsUsed() {
  const n = parseInt(getSessionParam(EXAM_RUNS_KEY), 10);
  return n > 0 ? n : 0;
}

/** Start of an attempt: the count belongs to this attempt and no other. */
function examResetRuns() {
  setSessionParam(EXAM_RUNS_KEY, 0);
  examSyncRuns();
}

/**
 * One more run. Always returns true — the budget is advisory.
 * @returns {boolean} always true; kept as a return so callers read as a gate
 */
function examNoteRun() {
  setSessionParam(EXAM_RUNS_KEY, examRunsUsed() + 1);
  examSyncRuns();
  return true;
}

/** Sets the recall/budget choices for the attempt about to start. */
function examSetup(recall, budget) {
  setSessionParam(EXAM_RECALL_KEY, !!recall);
  setSessionParam(EXAM_BUDGET_KEY, parseInt(budget, 10) > 0 ? parseInt(budget, 10) : 0);
  setSessionParam(EXAM_RUNS_KEY, 0);
}

/** Nothing carried into an attempt that did not ask for it. */
function examClear() {
  clearSessionParam(EXAM_RECALL_KEY);
  clearSessionParam(EXAM_BUDGET_KEY);
  clearSessionParam(EXAM_RUNS_KEY);
}

/** What the graded record should carry about how the attempt was taken. */
function examRecord() {
  const budget = examRunBudget();
  const used = examRunsUsed();
  const out = { runs: used };
  if (budget) { out.runBudget = budget; out.overBudget = used > budget; }
  if (examRecallOn()) out.recall = true;
  return out;
}

/* ── The counter ───────────────────────────────────────────────
   Beside Run Code, because that is the button it is about. It goes amber past
   the budget rather than red: over budget is a thing worth seeing, not a
   failure — you were told it would still run. */

function examRunsHTML() {
  const budget = examRunBudget();
  if (!budget) return '';
  const used = examRunsUsed();
  const over = used > budget;
  return '<span class="pp-runs' + (over ? ' is-over' : '') + '" id="pp-runs"'
       + ' title="' + (over
          ? 'Past the budget you set. Still running — the count is the point.'
          : 'Runs used against the budget you set for this attempt.') + '">'
       + '<i data-lucide="' + (over ? 'alert-triangle' : 'play') + '"></i>'
       + used + ' / ' + budget + '</span>';
}

function examSyncRuns() {
  const el = document.getElementById('pp-runs');
  if (!el) return;
  const wrap = el.parentElement;
  el.outerHTML = examRunsHTML();
  if (wrap && typeof lucide !== 'undefined') lucide.createIcons({ root: wrap });
}

/** The badge in the topbar saying this attempt is under constraints. */
function examBadgeHTML() {
  const bits = [];
  if (examRecallOn()) bits.push('<span class="exam-chip" title="Started from an empty file, with the boss bar off"><i data-lucide="brain"></i>Recall</span>');
  const b = examRunBudget();
  if (b) bits.push('<span class="exam-chip" title="A run budget of ' + b + '. It counts; it does not block."><i data-lucide="play"></i>' + b + ' runs</span>');
  return bits.join('');
}
