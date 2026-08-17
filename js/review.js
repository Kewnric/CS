/* ============================================================
   REVIEW.JS — Spaced-Repetition Scheduler (SM-2)
   ------------------------------------------------------------
   Tracks review state for every practiced item (challenge / snippet /
   notebook) and surfaces what's "due today" on the Home dashboard.

   Persisted as state.review:
     { "<type>:<id>": { type, id, ease, intervalDays, reps, due, last, lastScore } }
   where `due` / `last` are local 'YYYY-MM-DD' strings.

   Records are fed by the existing result flows:
     - practice.js submitCode()        → recordReview('challenge', id, scorePct)
     - notes-practice processSubmission → recordReview('notebook', id, accuracyPct)
     - study.js checkTryCoding()        → recordReview('snippet', id, bestPct)
   ============================================================ */

// ── Local date helpers (avoid UTC shift from toISOString) ──
function _revToday() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function _revAddDays(baseDateStr, days) {
  const d = baseDateStr ? new Date(baseDateStr + 'T00:00:00') : new Date();
  d.setDate(d.getDate() + days);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/** Days between two 'YYYY-MM-DD' strings (b - a). Negative = a is in the future. */
function _revDaysBetween(a, b) {
  const da = new Date(a + 'T00:00:00');
  const db = new Date(b + 'T00:00:00');
  return Math.round((db - da) / 86400000);
}

/** Map a 0–100 performance score to an SM-2 quality grade (0–5). */
function _revScoreToQuality(pct) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  if (p >= 95) return 5;
  if (p >= 85) return 4;
  if (p >= 70) return 3;
  if (p >= 50) return 2;
  if (p >= 30) return 1;
  return 0;
}

const _REV_TYPES = ['challenge', 'snippet', 'notebook'];

/**
 * Record a review result and reschedule via SM-2.
 * @param {'challenge'|'snippet'|'notebook'} type
 * @param {string} id  item id
 * @param {number} scorePct  0–100
 */
function recordReview(type, id, scorePct) {
  if (!type || !id || _REV_TYPES.indexOf(type) === -1) return;
  if (!state.review || typeof state.review !== 'object') state.review = {};

  const key = type + ':' + id;
  const rec = state.review[key] || { type, id, ease: 2.5, intervalDays: 0, reps: 0, due: null, last: null, lastScore: 0 };

  const q = _revScoreToQuality(scorePct);
  const prevInterval = rec.intervalDays || 0;

  // SM-2: update easiness factor every review, clamp to a sane range.
  let ease = (rec.ease || 2.5) + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  ease = Math.max(1.3, Math.min(3.5, ease));

  let reps, intervalDays;
  if (q < 3) {
    // Lapse — see it again tomorrow, keep the (lowered) ease.
    reps = 0;
    intervalDays = 1;
  } else {
    reps = (rec.reps || 0) + 1;
    if (reps === 1) intervalDays = 1;
    else if (reps === 2) intervalDays = 6;
    else intervalDays = Math.max(1, Math.round((prevInterval || 6) * ease));
  }

  const today = _revToday();
  state.review[key] = {
    type, id,
    ease: +ease.toFixed(3),
    intervalDays,
    reps,
    due: _revAddDays(today, intervalDays),
    last: today,
    lastScore: Math.round(Math.max(0, Math.min(100, Number(scorePct) || 0)))
  };

  if (typeof saveData === 'function') saveData();
}

/** Resolve a review record to its live item + display title, or null if deleted. */
function _revResolveItem(rec) {
  let item = null, title = '';
  if (rec.type === 'challenge') {
    item = (state.challenges || []).find(c => c.id === rec.id);
    title = item ? item.title : '';
  } else if (rec.type === 'snippet') {
    item = (state.snippets || []).find(s => s.id === rec.id);
    title = item ? item.title : '';
  } else if (rec.type === 'notebook') {
    item = (state.notebooks || []).find(n => n.id === rec.id);
    title = item ? item.title : '';
  }
  return item ? { item, title } : null;
}

/**
 * Items due for review (due date on or before today), resolved to live items
 * and sorted most-overdue first, then weakest score first.
 * @param {number} [limit]
 * @returns {Array<{type,id,title,due,daysOverdue,lastScore}>}
 */
function getDueReviewItems(limit) {
  if (!state.review) return [];
  const today = _revToday();
  const out = [];
  Object.values(state.review).forEach(rec => {
    if (!rec || !rec.due) return;
    if (_revDaysBetween(rec.due, today) < 0) return; // due is in the future
    const resolved = _revResolveItem(rec);
    if (!resolved) return; // item was deleted
    out.push({
      type: rec.type, id: rec.id, title: resolved.title,
      due: rec.due, daysOverdue: _revDaysBetween(rec.due, today),
      lastScore: rec.lastScore || 0
    });
  });
  out.sort((a, b) => (b.daysOverdue - a.daysOverdue) || (a.lastScore - b.lastScore));
  return typeof limit === 'number' ? out.slice(0, limit) : out;
}

/** Headline counts for badges / summaries. */
function getReviewSummary() {
  if (!state.review) return { due: 0, tracked: 0, nextDue: null };
  const today = _revToday();
  let due = 0, tracked = 0, nextDue = null;
  Object.values(state.review).forEach(rec => {
    if (!rec || !rec.due) return;
    if (!_revResolveItem(rec)) return;
    tracked++;
    const delta = _revDaysBetween(rec.due, today);
    if (delta >= 0) due++;
    else if (nextDue === null || rec.due < nextDue) nextDue = rec.due;
  });
  return { due, tracked, nextDue };
}

/** Open the right place to review a given item from anywhere in the app. */
function reviewNavigateTo(type, id) {
  if (type === 'challenge') {
    if (typeof promptTimer === 'function') promptTimer(id);
    else { setSessionParam('browseActiveNode', null); spaNavigate('browse'); }
  } else if (type === 'snippet') {
    setSessionParam('activeSnippetId', id);
    spaNavigate('snippets');
  } else if (type === 'notebook') {
    setSessionParam('activeNotebook', id);
    spaNavigate('study');
  }
}

/** Human label for a due item ("Due today" / "N days overdue"). */
function reviewDueLabel(daysOverdue) {
  if (daysOverdue <= 0) return 'Due today';
  if (daysOverdue === 1) return '1 day overdue';
  return daysOverdue + ' days overdue';
}
