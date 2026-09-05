/* ============================================================
   BADGES.JS — the achievement catalogue
   ------------------------------------------------------------
   There were seven badges, all of them about the coding library, so notebooks
   and snippets earned nothing and the whole shelf was full within a week. This
   is fifty, drawn from things the app actually records: the three attempt
   histories, the libraries themselves, the folder tree, practice sets,
   prerequisites and the spaced-repetition schedule.

   Every badge is { id, icon, name, hint, goal, get() }. `get` returns how much
   of the goal is done, so a partly-finished badge can show 7/25 rather than
   just being locked. Nothing here writes state — a badge is derived, so it can
   never disagree with the data behind it.
   ============================================================ */

/* One pass over everything, reused by all fifty getters. Recomputed at most
   once a second: anBadgeState() calls every get() in a row, and each of these
   would otherwise walk the full history on its own. */
let _badgeCache = null;
let _badgeCacheAt = 0;

function badgeStats() {
  if (_badgeCache && Date.now() - _badgeCacheAt < 1000) return _badgeCache;

  const hist = (state.history || []).filter(h => !h.isArchived);
  const nbHist = (state.notebookHistory || []).filter(h => !h.isArchived);
  const snHist = (state.snippetHistory || []).filter(h => !h.isArchived);

  const nbPct = (h) => {
    let c = 0, t = 0;
    (h.sections || []).forEach(s => { c += s.correct || 0; t += s.total || 0; });
    return t ? Math.round((c / t) * 100) : 0;
  };

  // Best and worst score per item, for "finished" and "comeback".
  const bestC = {}, worstC = {};
  hist.forEach(h => {
    if (!h.challengeId) return;
    const s = h.score || 0;
    bestC[h.challengeId] = Math.max(bestC[h.challengeId] ?? -1, s);
    worstC[h.challengeId] = Math.min(worstC[h.challengeId] ?? 101, s);
  });
  const bestN = {};
  nbHist.forEach(h => { if (h.notebookId) bestN[h.notebookId] = Math.max(bestN[h.notebookId] ?? -1, nbPct(h)); });
  const bestS = {};
  snHist.forEach(h => { if (h.snippetId) bestS[h.snippetId] = Math.max(bestS[h.snippetId] ?? -1, h.score || 0); });

  // Active days across every library, and the longest run of them.
  const dayCounts = new Map();
  const addDay = (ts) => { if (ts) { const d = _toLocalDate(ts); dayCounts.set(d, (dayCounts.get(d) || 0) + 1); } };
  hist.forEach(h => addDay(h.submitTime || h.startTime));
  nbHist.forEach(h => addDay(h.submitTime));
  snHist.forEach(h => addDay(h.submitTime || Date.parse((h.date || '') + ' ' + (h.time || '')) || 0));
  const days = [...dayCounts.keys()].sort();
  let longest = days.length ? 1 : 0, run = days.length ? 1 : 0;
  for (let i = 1; i < days.length; i++) {
    run = ((new Date(days[i]) - new Date(days[i - 1])) / 86400000 === 1) ? run + 1 : 1;
    if (run > longest) longest = run;
  }
  let currentStreak = 0;
  if (days.length && days[days.length - 1] === _toLocalDate(new Date())) {
    currentStreak = 1;
    for (let i = days.length - 2; i >= 0; i--) {
      if ((new Date(days[i + 1]) - new Date(days[i])) / 86400000 === 1) currentStreak++; else break;
    }
  }
  const weekendDays = days.filter(d => { const g = new Date(d).getDay(); return g === 0 || g === 6; }).length;

  // Hours of the day attempts land in.
  const hourOf = (h) => new Date(h.submitTime || h.startTime || 0).getHours();
  const lateNight = hist.filter(h => { const x = hourOf(h); return x >= 0 && x < 5; }).length
    + nbHist.filter(h => { const x = hourOf(h); return x >= 0 && x < 5; }).length;
  const earlyBird = hist.filter(h => { const x = hourOf(h); return x >= 4 && x < 7; }).length
    + nbHist.filter(h => { const x = hourOf(h); return x >= 4 && x < 7; }).length;

  // The folder tree.
  const folders = (state.nodes || []).filter(n => n && n.type === 'folder');
  const depthOf = (id, guard) => {
    let d = 1, cur = (state.nodes || []).find(n => n.id === id);
    const seen = guard || new Set();
    while (cur && cur.parentId && !seen.has(cur.id)) {
      seen.add(cur.id);
      cur = (state.nodes || []).find(n => n.id === cur.parentId);
      if (cur) d++;
    }
    return d;
  };
  const deepest = folders.reduce((mx, f) => Math.max(mx, depthOf(f.id)), 0);

  // Tags and languages.
  const tags = new Set();
  [...(state.challenges || []), ...(state.snippets || []), ...(state.notebooks || [])]
    .forEach(x => (x.tags || []).forEach(t => tags.add(String(t).toLowerCase())));
  const langs = new Set((state.snippets || []).map(s => (s.language || '').toLowerCase()).filter(Boolean));

  const totalSeconds = hist.reduce((n, h) => n + (h.duration || 0), 0)
    + nbHist.reduce((n, h) => n + (h.duration || 0), 0);
  const longestAttempt = Math.max(0, ...hist.map(h => h.duration || 0), ...nbHist.map(h => h.duration || 0));

  const questionsAnswered = nbHist.reduce((n, h) =>
    n + (h.sections || []).reduce((m, s) => m + (s.total || 0), 0), 0);

  const doneC = (state.challenges || []).filter(c => bestC[c.id] === 100).length;
  const doneN = (state.notebooks || []).filter(n => bestN[n.id] === 100).length;
  const doneS = (state.snippets || []).filter(s => bestS[s.id] === 100).length;

  _badgeCache = {
    hist, nbHist, snHist, nbPct,
    bestC, worstC, bestN, bestS,
    doneC, doneN, doneS,
    activeDays: days.length, longestStreak: longest, currentStreak, weekendDays,
    lateNight, earlyBird,
    folders, deepest, tags, langs,
    totalSeconds, longestAttempt, questionsAnswered,
    firstTry: hist.filter(h => (h.attemptNumber === 1) && h.score === 100).length,
    perfects: hist.filter(h => h.score === 100).length + snHist.filter(h => (h.score || 0) === 100).length
      + nbHist.filter(h => nbPct(h) === 100).length,
    quickPerfect: hist.filter(h => h.score === 100 && (h.duration || 0) > 0 && h.duration < 120).length,
    comeback: Object.keys(bestC).filter(id => (bestC[id] - worstC[id]) >= 50).length,
    reviewCount: Object.keys(state.review || {}).length,
    lockedCats: Object.keys(state.categoryRequirements || {}).filter(k => (state.categoryRequirements || {})[k]).length,
    sets: (state.codingSets || []).length,
    setProblems: (state.codingSets || []).reduce((n, s) => n + ((s.problems || []).length), 0),
    libTotal: (state.challenges || []).length + (state.notebooks || []).length + (state.snippets || []).length
  };
  _badgeCacheAt = Date.now();
  return _badgeCache;
}

const BADGE_CATALOG = [
  /* ── Coding library ───────────────────────────────────── */
  { id: 'c_first', icon: 'flag', name: 'First Steps', hint: 'Finish one program', goal: 1, get: () => badgeStats().doneC },
  { id: 'c_ten', icon: 'trophy', name: 'Ten Down', hint: 'Finish ten programs', goal: 10, get: () => badgeStats().doneC },
  { id: 'c_25', icon: 'medal', name: 'Quarter Century', hint: 'Finish 25 programs', goal: 25, get: () => badgeStats().doneC },
  { id: 'c_50', icon: 'crown', name: 'Half Century', hint: 'Finish 50 programs', goal: 50, get: () => badgeStats().doneC },
  { id: 'c_100', icon: 'gem', name: 'Centurion', hint: 'Finish 100 programs', goal: 100, get: () => badgeStats().doneC },
  { id: 'c_flawless', icon: 'sparkles', name: 'Flawless', hint: 'Score 100% on a first attempt', goal: 1, get: () => badgeStats().firstTry },
  { id: 'c_untouchable', icon: 'shield-check', name: 'Untouchable', hint: 'Ten first-attempt perfects', goal: 10, get: () => badgeStats().firstTry },
  { id: 'c_persistent', icon: 'repeat', name: 'Persistent', hint: '25 coding attempts logged', goal: 25, get: () => badgeStats().hist.length },
  { id: 'c_marathon', icon: 'infinity', name: 'Marathon', hint: '200 coding attempts logged', goal: 200, get: () => badgeStats().hist.length },
  { id: 'c_quick', icon: 'zap', name: 'Quick Draw', hint: 'A perfect run in under two minutes', goal: 1, get: () => badgeStats().quickPerfect },

  /* ── Notebooks ────────────────────────────────────────── */
  { id: 'n_first', icon: 'book-open', name: 'Open Book', hint: 'Finish one notebook', goal: 1, get: () => badgeStats().doneN },
  { id: 'n_ten', icon: 'library', name: 'Bookworm', hint: 'Finish ten notebooks', goal: 10, get: () => badgeStats().doneN },
  { id: 'n_25', icon: 'graduation-cap', name: 'Scholar', hint: 'Finish 25 notebooks', goal: 25, get: () => badgeStats().doneN },
  { id: 'n_perfect', icon: 'brain', name: 'Perfect Recall', hint: 'Answer a whole notebook correctly', goal: 1,
    get: () => badgeStats().nbHist.filter(h => badgeStats().nbPct(h) === 100).length },
  { id: 'n_attempts', icon: 'clipboard-list', name: 'Quiz Runner', hint: '50 notebook attempts', goal: 50, get: () => badgeStats().nbHist.length },
  { id: 'n_questions', icon: 'help-circle', name: 'Question Master', hint: 'Answer 500 questions', goal: 500, get: () => badgeStats().questionsAnswered },
  { id: 'n_questions2', icon: 'list-checks', name: 'Interrogator', hint: 'Answer 2,000 questions', goal: 2000, get: () => badgeStats().questionsAnswered },
  { id: 'n_built', icon: 'notebook-pen', name: 'Note Taker', hint: 'Have ten notebooks in the library', goal: 10, get: () => (state.notebooks || []).length },

  /* ── Snippets ─────────────────────────────────────────── */
  { id: 's_first', icon: 'file-code', name: 'Snippet Starter', hint: 'Finish one snippet', goal: 1, get: () => badgeStats().doneS },
  { id: 's_ten', icon: 'code', name: 'Snippet Scholar', hint: 'Finish ten snippets', goal: 10, get: () => badgeStats().doneS },
  { id: 's_collect', icon: 'folder-code', name: 'Snippet Collector', hint: '25 snippets in the library', goal: 25, get: () => (state.snippets || []).length },
  { id: 's_desk', icon: 'archive', name: 'Reference Desk', hint: '50 snippets in the library', goal: 50, get: () => (state.snippets || []).length },
  { id: 's_polyglot', icon: 'languages', name: 'Polyglot', hint: 'Snippets in five languages', goal: 5, get: () => badgeStats().langs.size },
  { id: 's_attempts', icon: 'terminal', name: 'Try Hard', hint: '25 snippet attempts', goal: 25, get: () => badgeStats().snHist.length },
  { id: 's_perfect', icon: 'check-check', name: 'Snippet Perfect', hint: 'Ten snippets at 100%', goal: 10, get: () => badgeStats().doneS },

  /* ── Streaks and timing ───────────────────────────────── */
  { id: 'k_roll', icon: 'flame', name: 'On a Roll', hint: 'Practice five days running', goal: 5, get: () => badgeStats().longestStreak },
  { id: 'k_fortnight', icon: 'calendar-check', name: 'Fortnight', hint: 'A fourteen-day streak', goal: 14, get: () => badgeStats().longestStreak },
  { id: 'k_iron', icon: 'shield', name: 'Iron Will', hint: 'A thirty-day streak', goal: 30, get: () => badgeStats().longestStreak },
  { id: 'k_hundred', icon: 'flame-kindling', name: 'Unbroken', hint: 'A hundred-day streak', goal: 100, get: () => badgeStats().longestStreak },
  { id: 'k_current', icon: 'trending-up', name: 'Warm', hint: 'Be on a seven-day streak right now', goal: 7, get: () => badgeStats().currentStreak },
  { id: 'k_night', icon: 'moon', name: 'Night Owl', hint: 'Practice after midnight', goal: 1, get: () => badgeStats().lateNight },
  { id: 'k_night10', icon: 'moon-star', name: 'Nocturnal', hint: 'Ten sessions after midnight', goal: 10, get: () => badgeStats().lateNight },
  { id: 'k_early', icon: 'sunrise', name: 'Early Bird', hint: 'Practice before seven in the morning', goal: 1, get: () => badgeStats().earlyBird },
  { id: 'k_weekend', icon: 'calendar-days', name: 'Weekend Warrior', hint: 'Practice on ten weekend days', goal: 10, get: () => badgeStats().weekendDays },
  { id: 'k_days50', icon: 'calendar-range', name: 'Regular', hint: 'Fifty active days', goal: 50, get: () => badgeStats().activeDays },
  { id: 'k_days200', icon: 'calendar-heart', name: 'Devoted', hint: 'Two hundred active days', goal: 200, get: () => badgeStats().activeDays },

  /* ── Building the library ─────────────────────────────── */
  { id: 'b_folder', icon: 'folder-plus', name: 'Organiser', hint: 'Create three folders', goal: 3, get: () => badgeStats().folders.length },
  { id: 'b_arch', icon: 'network', name: 'Architect', hint: 'Create ten folders', goal: 10, get: () => badgeStats().folders.length },
  { id: 'b_city', icon: 'building-2', name: 'City Planner', hint: 'Create 25 folders', goal: 25, get: () => badgeStats().folders.length },
  { id: 'b_nested', icon: 'folder-tree', name: 'Deep Filing', hint: 'Nest a folder three levels down', goal: 3, get: () => badgeStats().deepest },
  { id: 'b_curator', icon: 'boxes', name: 'Curator', hint: 'Fifty programs in the library', goal: 50, get: () => (state.challenges || []).length },
  { id: 'b_grand', icon: 'landmark', name: 'Grand Library', hint: 'A hundred items across all libraries', goal: 100, get: () => badgeStats().libTotal },
  { id: 'b_set', icon: 'layout-grid', name: 'Set Builder', hint: 'Build a practice set', goal: 1, get: () => badgeStats().sets },
  { id: 'b_set5', icon: 'layers', name: 'Set Designer', hint: 'Build five practice sets', goal: 5, get: () => badgeStats().sets },
  { id: 'b_setbig', icon: 'list-ordered', name: 'Course Author', hint: 'Twenty problems across your sets', goal: 20, get: () => badgeStats().setProblems },
  { id: 'b_lock', icon: 'lock', name: 'Gatekeeper', hint: 'Put prerequisites on three categories', goal: 3, get: () => badgeStats().lockedCats },
  { id: 'b_tags', icon: 'tags', name: 'Well Labelled', hint: 'Use twenty distinct tags', goal: 20, get: () => badgeStats().tags.size },

  /* ── Mastery and review ───────────────────────────────── */
  { id: 'm_review', icon: 'rotate-ccw', name: 'Reviewer', hint: 'Ten items in spaced repetition', goal: 10, get: () => badgeStats().reviewCount },
  { id: 'm_review50', icon: 'calendar-clock', name: 'Scheduled', hint: 'Fifty items in spaced repetition', goal: 50, get: () => badgeStats().reviewCount },
  { id: 'm_comeback', icon: 'trending-up', name: 'Comeback', hint: 'Improve a program by 50 points', goal: 1, get: () => badgeStats().comeback },
  { id: 'm_perfect25', icon: 'star', name: 'Perfectionist', hint: '25 perfect attempts in total', goal: 25, get: () => badgeStats().perfects },
  { id: 'm_all', icon: 'orbit', name: 'All-Rounder', hint: 'Finish something in all three libraries', goal: 3,
    get: () => { const s = badgeStats(); return (s.doneC > 0 ? 1 : 0) + (s.doneN > 0 ? 1 : 0) + (s.doneS > 0 ? 1 : 0); } },
  { id: 'm_hours', icon: 'hourglass', name: 'Time Served', hint: 'Ten hours of recorded practice', goal: 36000, get: () => badgeStats().totalSeconds,
    fmt: (v) => Math.round(v / 3600) + 'h' },
  { id: 'm_deep', icon: 'timer', name: 'Deep Work', hint: 'A single session over thirty minutes', goal: 1800, get: () => badgeStats().longestAttempt,
    fmt: (v) => Math.round(v / 60) + 'm' }
];

/** Every badge with its progress. Sorted by the caller, not here. */
function badgeState() {
  return BADGE_CATALOG.map(b => {
    let have = 0;
    try { have = b.get() || 0; } catch (e) { have = 0; }
    const pct = b.goal ? Math.min(100, Math.round((have / b.goal) * 100)) : 0;
    return { ...b, have, pct, earned: have >= b.goal };
  });
}

/** "7/25", or "3h/10h" for the ones measured in seconds. */
function badgeProgressLabel(b) {
  if (b.earned) return 'Earned';
  return b.fmt ? b.fmt(b.have) + '/' + b.fmt(b.goal) : b.have + '/' + b.goal;
}
