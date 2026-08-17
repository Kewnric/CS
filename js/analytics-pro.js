/* ============================================================
   ANALYTICS-PRO.JS — the coding-analytics data layer and the
   widgets built on top of it.
   ------------------------------------------------------------
   Everything that counts attempts goes through anAttempts(). The
   page used to count them three different ways in three places:
   the header line included archived and orphaned attempts, the
   completion figure excluded them, and the chart included them —
   so the same card could say "8 attempts total (2 programs
   completed)" about six real ones.
   ============================================================ */

/** One page of anything in Analytics. */
const AN_PAGE = 15;

const AN_RANGES = [
  { id: '7', label: '7d', days: 7 },
  { id: '30', label: '30d', days: 30 },
  { id: '90', label: '90d', days: 90 },
  { id: 'all', label: 'All', days: 0 }
];

function anRange() {
  const v = localStorage.getItem('anRange') || 'all';
  return AN_RANGES.some(r => r.id === v) ? v : 'all';
}

function anSetRange(id) {
  localStorage.setItem('anRange', id);
  if (typeof renderAnalyticsOverview === 'function') renderAnalyticsOverview();
}

/**
 * The canonical attempt list. Excludes:
 *   - archived attempts (you deleted them; they should not shape your stats)
 *   - attempts whose program no longer exists (nothing to review or improve)
 *   - records with no numeric score
 * @param {object} [o] .range ('7'|'30'|'90'|'all'|null to ignore) .challengeId .folderId
 * @returns {Array} chronological, oldest first
 */
function anAttempts(o) {
  o = o || {};
  const live = new Set((state.challenges || []).map(c => c.id));
  let list = (state.history || []).filter(h =>
    h && typeof h.score === 'number' && !h.isArchived &&
    (!h.challengeId || live.has(h.challengeId))
  );
  if (o.challengeId) list = list.filter(h => h.challengeId === o.challengeId);
  const range = o.range === null ? 'all' : (o.range || anRange());
  const days = (AN_RANGES.find(r => r.id === range) || {}).days || 0;
  if (days) {
    const cutoff = Date.now() - days * 86400000;
    list = list.filter(h => (h.submitTime || h.startTime || 0) >= cutoff);
  }
  return list.slice().sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
}

/** How many attempts the filters are hiding, so the number is never a mystery. */
function anExcludedCount() {
  const live = new Set((state.challenges || []).map(c => c.id));
  return (state.history || []).filter(h =>
    h && typeof h.score === 'number' &&
    (h.isArchived || (h.challengeId && !live.has(h.challengeId)))
  ).length;
}

function anDuration(h) { return Math.max(0, Number(h && h.duration) || 0); }

function anFmtTime(s) {
  return typeof formatTimeDisplay === 'function' ? formatTimeDisplay(s) : Math.round(s) + 's';
}

function anMedian(nums) {
  if (!nums.length) return 0;
  const a = nums.slice().sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2);
}

/**
 * Per-program roll-up: attempts, best, first-try success, time to first 100%.
 * This is the unit that actually matters for coding practice — a single global
 * average over every program tells you nothing about which one to work on.
 */
function anByProgram(range) {
  const map = new Map();
  anAttempts({ range }).forEach(h => {
    if (!h.challengeId) return;
    let r = map.get(h.challengeId);
    if (!r) {
      const c = (state.challenges || []).find(x => x.id === h.challengeId);
      r = { id: h.challengeId, title: c ? c.title : 'Unknown', tags: (c && c.tags) || [],
        attempts: [], best: 0, solved: false, firstScore: null, timeToSolve: 0 };
      map.set(h.challengeId, r);
    }
    r.attempts.push(h);
  });
  map.forEach(r => {
    r.attempts.sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
    r.best = Math.max(...r.attempts.map(a => a.score));
    r.firstScore = r.attempts[0].score;
    r.solved = r.best === 100;
    r.firstTry = r.firstScore === 100;
    const solveIdx = r.attempts.findIndex(a => a.score === 100);
    r.attemptsToSolve = solveIdx === -1 ? null : solveIdx + 1;
    r.timeToSolve = r.attempts.slice(0, solveIdx === -1 ? r.attempts.length : solveIdx + 1)
      .reduce((s, a) => s + anDuration(a), 0);
    r.totalTime = r.attempts.reduce((s, a) => s + anDuration(a), 0);
    r.last = r.attempts[r.attempts.length - 1];
  });
  return [...map.values()];
}

/** Attempts per day, for the heatmap and the streak. */
function anDayMap(range) {
  const m = new Map();
  anAttempts({ range: range || 'all' }).forEach(h => {
    const t = h.submitTime || h.startTime;
    if (!t) return;
    const d = new Date(t);
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const e = m.get(key) || { n: 0, best: 0 };
    e.n++;
    e.best = Math.max(e.best, h.score);
    m.set(key, e);
  });
  return m;
}

function anStreaks() {
  const days = anDayMap('all');
  if (!days.size) return { current: 0, longest: 0 };
  const keyOf = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  let current = 0;
  const cursor = new Date();
  // Today not being practised yet shouldn't read as a broken streak.
  if (!days.has(keyOf(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(keyOf(cursor))) { current++; cursor.setDate(cursor.getDate() - 1); }
  const sorted = [...days.keys()].sort();
  let longest = 0, run = 0, prev = null;
  sorted.forEach(k => {
    const d = new Date(k + 'T00:00:00');
    run = (prev && (d - prev) === 86400000) ? run + 1 : 1;
    prev = d;
    if (run > longest) longest = run;
  });
  return { current, longest };
}

/** Average best-score per tag — "loops are fine, pointers are not". */
function anByTag(range) {
  const tags = new Map();
  anByProgram(range).forEach(p => {
    (p.tags || []).forEach(t => {
      const e = tags.get(t) || { tag: t, programs: 0, solved: 0, bestSum: 0, attempts: 0 };
      e.programs++;
      if (p.solved) e.solved++;
      e.bestSum += p.best;
      e.attempts += p.attempts.length;
      tags.set(t, e);
    });
  });
  return [...tags.values()]
    .map(e => ({ ...e, avgBest: Math.round(e.bestSum / e.programs) }))
    .sort((a, b) => a.avgBest - b.avgBest);
}

/* ── Spaced repetition ─────────────────────────────────────────
   The old "Daily Review (SRS)" was `three lowest best-scores`: no intervals, no
   due dates, nothing that decays. The same two cards sat there permanently. */

const AN_SRS_KEY = 'anSrsState';
const AN_SRS_STEPS = [1, 3, 7, 16, 35];   // days, by consecutive good reviews

function anSrsLoad() {
  try { return JSON.parse(localStorage.getItem(AN_SRS_KEY)) || {}; } catch (e) { return {}; }
}
function anSrsSave(s) {
  try { localStorage.setItem(AN_SRS_KEY, JSON.stringify(s)); } catch (e) { /* quota */ }
}

/**
 * Fold every attempt into a due date per program. A score of 100 promotes it to
 * the next interval; anything less drops it back to the first.
 */
function anSrsSchedule() {
  const saved = anSrsLoad();
  const out = [];
  anByProgram('all').forEach(p => {
    const rec = saved[p.id] || { box: 0, seen: 0 };
    // Re-derive from history so the queue is correct even on a fresh device.
    let box = 0, lastAt = 0;
    p.attempts.forEach(a => {
      box = a.score === 100 ? Math.min(box + 1, AN_SRS_STEPS.length) : 0;
      lastAt = a.submitTime || a.startTime || lastAt;
    });
    if (rec.box > box && rec.reviewedAt && rec.reviewedAt > lastAt) { box = rec.box; lastAt = rec.reviewedAt; }
    const interval = AN_SRS_STEPS[Math.max(0, Math.min(box, AN_SRS_STEPS.length - 1))];
    const due = lastAt + interval * 86400000;
    out.push({ ...p, box, due, lastAt, overdueDays: Math.floor((Date.now() - due) / 86400000) });
  });
  // Overdue first, then the weakest.
  return out.sort((a, b) => (a.due - b.due) || (a.best - b.best));
}

function anSrsDue(limit) {
  const now = Date.now();
  const all = anSrsSchedule();
  const due = all.filter(p => p.due <= now);
  const queue = due.length ? due : all.filter(p => !p.solved);
  return { queue: queue.slice(0, limit || 3), dueCount: due.length, total: all.length };
}

/* ── Badges ────────────────────────────────────────────────────
   These were bare strings in state.badges with no criteria and no progress, so
   "Night Owl" told you nothing about how it was earned or what was next. */

const AN_BADGES = [
  { id: 'first', icon: 'flag', name: 'First Steps', hint: 'Finish one program',
    goal: 1, get: () => anByProgram('all').filter(p => p.solved).length },
  { id: 'flawless', icon: 'sparkles', name: 'Flawless', hint: 'Score 100% on the first try',
    goal: 1, get: () => anByProgram('all').filter(p => p.firstTry).length },
  { id: 'persistent', icon: 'repeat', name: 'Persistent', hint: '25 attempts logged',
    goal: 25, get: () => anAttempts({ range: 'all' }).length },
  { id: 'streak', icon: 'flame', name: 'On a Roll', hint: 'Practise 5 days in a row',
    goal: 5, get: () => anStreaks().longest },
  { id: 'nightowl', icon: 'moon', name: 'Night Owl', hint: 'An attempt after midnight',
    goal: 1, get: () => anAttempts({ range: 'all' }).filter(h => {
      const hr = new Date(h.submitTime || h.startTime || 0).getHours();
      return hr >= 0 && hr < 5;
    }).length },
  { id: 'speed', icon: 'zap', name: 'Quick Draw', hint: 'Solve one in under two minutes',
    goal: 1, get: () => anAttempts({ range: 'all' }).filter(h => h.score === 100 && anDuration(h) > 0 && anDuration(h) < 120).length },
  { id: 'tenner', icon: 'trophy', name: 'Ten Down', hint: 'Finish ten programs',
    goal: 10, get: () => anByProgram('all').filter(p => p.solved).length }
];

function anBadgeState() {
  return AN_BADGES.map(b => {
    let have = 0;
    try { have = b.get() || 0; } catch (e) { have = 0; }
    return { ...b, have, pct: Math.min(100, Math.round((have / b.goal) * 100)), earned: have >= b.goal };
  });
}

function anBadgesHTML() {
  const list = anBadgeState().sort((a, b) => (b.earned - a.earned) || (b.pct - a.pct));
  return `<div class="an-badges">${list.map(b => `
    <div class="an-badge ${b.earned ? 'earned' : ''}" title="${_an_esc(b.hint)} — ${b.have}/${b.goal}">
      <i data-lucide="${b.icon}"></i>
      <span class="an-badge-name">${_an_esc(b.name)}</span>
      <span class="an-badge-meta">${b.earned ? 'Earned' : b.have + '/' + b.goal}</span>
      ${b.earned ? '' : `<span class="an-badge-bar"><span style="width:${b.pct}%"></span></span>`}
    </div>`).join('')}</div>`;
}

function _an_esc(s) { return typeof escapeHTML === 'function' ? escapeHTML(String(s)) : String(s); }

/* ── Export ────────────────────────────────────────────────────
   This is the only place the attempt log is aggregated, and there was no way to
   get the numbers out of it. */

function anExportCsv() {
  const rows = [['date', 'time', 'program', 'version', 'score', 'duration_seconds', 'tests_passed', 'tests_total', 'attempt_number']];
  anAttempts({ range: null }).slice().reverse().forEach(h => {
    const c = (state.challenges || []).find(x => x.id === h.challengeId);
    const d = new Date(h.submitTime || h.startTime || 0);
    rows.push([
      d.toLocaleDateString(), d.toLocaleTimeString(),
      (c ? c.title : h.challengeTitle || ''),
      (typeof _historyVersionLabel === 'function' ? _historyVersionLabel(h) : ''),
      h.score, anDuration(h), h.testsPassed != null ? h.testsPassed : '', h.testsTotal != null ? h.testsTotal : '',
      h.attemptNumber != null ? h.attemptNumber : ''
    ]);
  });
  const csv = rows.map(r => r.map(v => {
    const s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'coding-attempts-' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  if (typeof toast === 'function') toast(`Exported ${rows.length - 1} attempts.`, { type: 'success' });
}

/* ── Widgets ───────────────────────────────────────────────── */

function anRangeChipsHTML() {
  const cur = anRange();
  const hidden = anExcludedCount();
  return `<div class="an-range">
    ${AN_RANGES.map(r => `<button class="an-range-chip ${r.id === cur ? 'active' : ''}" onclick="anSetRange('${r.id}')">${r.label}</button>`).join('')}
    ${hidden ? `<span class="an-range-note" title="Archived attempts, and attempts on programs that no longer exist, are left out of every figure on this page.">${hidden} excluded</span>` : ''}
    <button class="an-range-chip an-export" onclick="anExportCsv()" title="Download every attempt as CSV"><i data-lucide="download" style="width:11px;height:11px;"></i> CSV</button>
  </div>`;
}

/** Attempts per day for the last 26 weeks. */
function anHeatmapHTML() {
  const days = anDayMap('all');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - (25 * 7 + today.getDay()));
  const cells = [];
  let max = 1;
  days.forEach(v => { if (v.n > max) max = v.n; });
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const e = days.get(key);
    const lvl = !e ? 0 : e.n >= max ? 4 : e.n >= max * 0.6 ? 3 : e.n >= max * 0.3 ? 2 : 1;
    cells.push(`<span class="an-hm-cell" data-lvl="${lvl}" title="${key}: ${e ? e.n + ' attempt' + (e.n !== 1 ? 's' : '') + ', best ' + e.best + '%' : 'no attempts'}"></span>`);
  }
  const s = anStreaks();
  return `<div class="an-hm-wrap">
    <div class="an-hm">${cells.join('')}</div>
    <div class="an-hm-legend">
      <span><strong>${s.current}</strong> day streak</span>
      <span>longest <strong>${s.longest}</strong></span>
      <span class="an-hm-scale">less <i data-lvl="0"></i><i data-lvl="1"></i><i data-lvl="2"></i><i data-lvl="3"></i><i data-lvl="4"></i> more</span>
    </div>
  </div>`;
}

function anTagsHTML() {
  const tags = anByTag(anRange());
  if (!tags.length) return '<p class="an-empty">No tags on your attempted programs yet.</p>';
  return `<div class="an-tags">${tags.slice(0, 8).map(t => `
    <div class="an-tag-row" title="${t.solved}/${t.programs} solved across ${t.attempts} attempts">
      <span class="an-tag-name">${_an_esc(t.tag)}</span>
      <span class="an-tag-track"><span class="an-tag-fill" style="width:${t.avgBest}%;background:${t.avgBest >= 80 ? 'var(--color-success)' : t.avgBest >= 50 ? 'var(--color-warning)' : 'var(--color-danger)'}"></span></span>
      <span class="an-tag-val">${t.avgBest}%</span>
    </div>`).join('')}</div>`;
}

/** Weakest programs first — the actual "what should I work on" list. */
function anWeakestHTML() {
  const progs = anByProgram(anRange()).filter(p => !p.solved).sort((a, b) => a.best - b.best).slice(0, 6);
  if (!progs.length) return '<p class="an-empty">Every program you have attempted in this range is finished.</p>';
  return `<div class="an-weak">${progs.map(p => `
    <button class="an-weak-row" onclick="anOpenReview('${p.id}')" title="Compare your attempt against the solution">
      <span class="an-weak-title">${_an_esc(p.title)}</span>
      <span class="an-weak-attempts">${p.attempts.length}×</span>
      <span class="an-weak-track"><span style="width:${p.best}%"></span></span>
      <span class="an-weak-best">${p.best}%</span>
      <i data-lucide="git-compare" style="width:13px;height:13px;"></i>
    </button>`).join('')}</div>`;
}

window.anAttempts = anAttempts;
window.anSetRange = anSetRange;
window.anExportCsv = anExportCsv;
window.anByProgram = anByProgram;
window.anSrsDue = anSrsDue;
window.anBadgesHTML = anBadgesHTML;
