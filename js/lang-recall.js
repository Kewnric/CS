/* ============================================================
   LANG-RECALL.JS — what the library knows about each word
   ------------------------------------------------------------
   The Language Library had no per-word memory at all. langHistory recorded
   whole attempts -- kind, refId, score -- so it could tell you that you got
   7/10 on "Starter 3", and nothing whatever about which word you keep
   missing. With ten authored questions that was survivable. With a thousand
   words in the dictionary it is the difference between a vocabulary and a
   list.

   So: one small record per word you have actually been asked about, holding
   the SM-2 numbers the coding library already uses in spirit -- an ease, an
   interval in days, and the day it comes back. Words you have never been
   asked about have no record and cost nothing; the store only grows as you
   practise.

   WHY NOT REUSE THE CODING LIBRARY'S SCHEDULER. Its unit is a program you
   attempt for twenty minutes and either finish or do not. The unit here is a
   word you answer in two seconds, dozens per session, and the answer is
   graded by a drill that already knows whether it was right. Same algorithm,
   different granularity, and forcing one record shape over both would make
   the shared part harder to read than the duplicate.
   ============================================================ */

/* SM-2, with the usual floor on the ease so a word you keep failing does not
   become permanently unschedulable. */
const LANG_RECALL_EASE_MIN = 1.3;
const LANG_RECALL_EASE_START = 2.5;
/* First two intervals are fixed rather than computed -- SM-2's own rule, and
   the reason a new word comes back the same session rather than in a week. */
const LANG_RECALL_STEPS = [0, 1];      // days: same day, then tomorrow
const LANG_RECALL_KNOWN_DAYS = 21;     // an interval this long reads as "known"

function langRecallStore() {
  if (!state.langRecall || typeof state.langRecall !== 'object') state.langRecall = {};
  return state.langRecall;
}

/**
 * @returns {number} whole days since the epoch, counted in LOCAL time
 *
 * Date.now()/86400000 counts UTC days, and that is not what "tomorrow" means
 * to the person using this. Measured on the machine this was written on --
 * UTC+8, the Philippines, which is exactly where a Cebuano learner is -- the
 * review day rolled over at 16:00 local. A word scheduled for tomorrow came
 * due mid-afternoon today, and anything practised after four in the afternoon
 * was filed under the next day. Subtracting the offset makes the boundary
 * local midnight, where the user's own idea of a day already is.
 */
function langToday() {
  const now = new Date();
  return Math.floor((now.getTime() - now.getTimezoneOffset() * 60000) / 86400000);
}

/** The record for a word, or null when it has never been asked. */
function langRecall(wordId) {
  const rec = langRecallStore()[wordId];
  return (rec && typeof rec === 'object') ? rec : null;
}

/**
 * Grade one answer.
 *
 * @param {string} wordId
 * @param {boolean} correct
 * @param {boolean} [hard] right, but slowly or with a hint -- schedules shorter
 * @returns {object} the updated record
 */
function langRecallGrade(wordId, correct, hard) {
  if (!wordId) return null;
  const store = langRecallStore();
  const now = langToday();
  const r = store[wordId] || { n: 0, ease: LANG_RECALL_EASE_START, days: 0, due: now, seen: 0, wrong: 0 };
  r.seen = (r.seen || 0) + 1;

  if (!correct) {
    /* A miss resets the streak but NOT the ease all the way -- dropping ease
       to the floor on one slip makes a word you actually know behave like a
       word you never learnt. */
    r.wrong = (r.wrong || 0) + 1;
    r.n = 0;
    r.ease = Math.max(LANG_RECALL_EASE_MIN, (r.ease || LANG_RECALL_EASE_START) - 0.2);
    r.days = 0;
    r.due = now;                      // again today
  } else {
    r.ease = Math.max(LANG_RECALL_EASE_MIN,
      (r.ease || LANG_RECALL_EASE_START) + (hard ? -0.15 : 0.1));
    if (r.n < LANG_RECALL_STEPS.length) r.days = LANG_RECALL_STEPS[r.n];
    else r.days = Math.max(1, Math.round((r.days || 1) * r.ease));
    r.n = (r.n || 0) + 1;
    r.due = now + r.days;
  }
  r.last = Date.now();
  store[wordId] = r;
  saveData();
  return r;
}

/** new | due | learning | known — the four states the badge shows. */
function langRecallState(wordId) {
  const r = langRecall(wordId);
  if (!r) return 'new';
  if (r.due <= langToday()) return 'due';
  return (r.days >= LANG_RECALL_KNOWN_DAYS) ? 'known' : 'learning';
}

const LANG_RECALL_LABELS = {
  'new':      { label: 'new',      icon: 'sparkle',     title: 'Not asked yet' },
  'due':      { label: 'due',      icon: 'alarm-clock', title: 'Due for review' },
  'learning': { label: 'learning', icon: 'trending-up', title: 'Coming back soon' },
  'known':    { label: 'known',    icon: 'check',       title: 'Held for three weeks or more' }
};

/**
 * The badge on a dictionary row.
 *
 * A word nobody has practised shows nothing at all: with a fresh 1,008-word
 * pack, a "new" badge on every single row is a thousand badges saying the
 * same thing, which is a pattern, not information.
 */
function langRecallBadgeHTML(w) {
  const id = w && w.id;
  if (!id) return '';
  const st = langRecallState(id);
  if (st === 'new') return '';
  const meta = LANG_RECALL_LABELS[st];
  const r = langRecall(id);
  const detail = meta.title + (r && r.seen ? ' — asked ' + r.seen + (r.seen === 1 ? ' time' : ' times') : '');
  return '<span class="lang-recall-badge lang-recall-' + st + '" title="' + escapeHTML(detail) + '">'
       + langIcon(meta.icon) + meta.label + '</span>';
}

/** Every word due today or overdue, hardest first. */
function langDueWords() {
  const today = langToday();
  const store = langRecallStore();
  return langWords()
    .filter(w => { const r = store[w.id]; return r && r.due <= today; })
    .sort((a, b) => {
      const ra = store[a.id], rb = store[b.id];
      // Most overdue first; ties broken by the one you have missed most.
      return (ra.due - rb.due) || ((rb.wrong || 0) - (ra.wrong || 0));
    });
}

/** The counts behind the review card. */
function langRecallSummary() {
  const today = langToday();
  const store = langRecallStore();
  const out = { total: langWords().length, tracked: 0, due: 0, learning: 0, known: 0, new: 0 };
  langWords().forEach(w => {
    const r = store[w.id];
    if (!r) { out.new++; return; }
    out.tracked++;
    if (r.due <= today) out.due++;
    else if (r.days >= LANG_RECALL_KNOWN_DAYS) out.known++;
    else out.learning++;
  });
  return out;
}

/** Forget everything about one word — used when the word itself is deleted. */
function langRecallForget(wordId) {
  const store = langRecallStore();
  if (store[wordId]) { delete store[wordId]; saveData(); }
}

/**
 * Drop records for words that are no longer there.
 *
 * langDeleteWord takes its own record with it, and gives it back on undo. But
 * a word can also leave by routes that never touch this: an import replacing
 * the store, a starter pack being swapped out, a record hand-edited in a
 * backup file. Those leave a record keyed to nothing -- invisible, harmless
 * to read, and permanent, in a document whose whole problem is bytes.
 *
 * @returns {number} how many were dropped
 */
function langRecallPrune() {
  const store = langRecallStore();
  const ids = Object.keys(store);
  if (!ids.length) return 0;
  const live = {};
  langWords().forEach(w => { live[w.id] = true; });
  let n = 0;
  ids.forEach(id => { if (!live[id]) { delete store[id]; n++; } });
  if (n) saveData();
  return n;
}
