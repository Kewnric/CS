/* ============================================================
   ANALYTICS-SNIPPETS.JS — the snippet library's own analytics
   ------------------------------------------------------------
   This route used to render the coding library's tree-and-detail view against
   snippet data. It worked, but it answered coding questions: which attempt,
   what score, how long. A snippet library is a different thing and is used a
   different way, so it has different questions:

     · How much of the library have I actually touched, and what have I never
       opened? Coverage is the point of a reference library; a mean score
       across the handful you revisit says nothing about the rest.
     · How am I doing per language? Language is a first-class snippet field
       and appears in no other analytics in the app.
     · The library has TWO practice modes — Try Coding and SQL cases — and
       they are not comparable, so they are never averaged together.
     · Which individual question do I keep getting wrong? Per-case results are
       recorded now, so this is read, not guessed.

   Everything here is derived from state.snippets and state.snippetHistory.
   Nothing is invented: where there is no data the panel says so.
   ============================================================ */

/* ── Reading the log ──────────────────────────────────────── */

/**
 * What to call the snippet an entry is about.
 *
 * The live title first: a log stores the name the snippet had at the time, so
 * after a rename the analytics listed a title that no longer exists anywhere
 * in the library. Falls back to the stored name for entries whose snippet has
 * since been deleted, which is the only record of what it was.
 *
 * Try Coding writes snippetTitle and SQL practice writes both, so either shape
 * is accepted.
 */
function _snTitle(entry) {
  const live = (state.snippets || []).find(s => s.id === entry.snippetId);
  if (live && (live.title || '').trim()) return live.title;
  return entry.snippetTitle || entry.title || 'Untitled snippet';
}

/**
 * A sortable instant for an entry, whichever shape it is.
 *
 * Only SQL practice records a ts. Try Coding writes a date string and a locale
 * time, so treating a missing ts as 0 sorted every Try Coding attempt below
 * every SQL one no matter which actually happened first — a July attempt sat
 * above an August one in a list labelled most recent.
 */
function _snWhen(entry) {
  if (typeof entry.ts === 'number' && isFinite(entry.ts)) return entry.ts;
  const d = String(entry.date || '').trim();
  if (!d) return 0;
  // Two writers, two formats. SQL practice stores an ISO date; Try Coding
  // stores toLocaleDateString(), e.g. "8/29/2026" — and 8/29/2026T00:00:00 is
  // not a date, so every Try Coding record used to resolve to 0 and sort to
  // the bottom regardless of when it happened. Try ISO first because it is
  // unambiguous, then let Date have the locale form.
  let t = Date.parse(d + 'T00:00:00');
  if (!isFinite(t)) t = Date.parse(d);
  return isFinite(t) ? t : 0;
}

/** Entries older than the snippets they refer to are still worth counting. */
function snAnalyticsData() {
  const snippets = state.snippets || [];
  const log = (state.snippetHistory || []).filter(h => h && h.snippetId);

  const byId = {};
  log.forEach(h => {
    if (!byId[h.snippetId]) byId[h.snippetId] = [];
    byId[h.snippetId].push(h);
  });

  const practised = snippets.filter(s => (byId[s.id] || []).length);
  const never = snippets.filter(s => !(byId[s.id] || []).length);

  // The two modes are counted apart. A Try Coding score is similarity to a
  // reference; a SQL score is cases passed. Averaging them would produce a
  // number that means neither.
  const sqlRuns = log.filter(h => h.kind === 'sql');
  const tryRuns = log.filter(h => h.kind !== 'sql');

  return { snippets, log, byId, practised, never, sqlRuns, tryRuns };
}

/** Mean of a list, or null when there is nothing to average. */
function _snMean(nums) {
  const xs = nums.filter(n => typeof n === 'number' && isFinite(n));
  if (!xs.length) return null;
  return Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
}

/** A snippet's language, normalised for grouping. Untagged is its own bucket. */
function _snLang(s) {
  const l = (s.language || '').trim();
  return l || 'Untagged';
}

/* ── The dashboard ────────────────────────────────────────── */

window.renderSnippetAnalyticsDashboard = function () {
  const host = document.getElementById('an-sn-body');
  if (!host) return;
  const d = snAnalyticsData();

  if (!d.snippets.length) {
    host.innerHTML = _snEmpty('database', 'No snippets yet',
      'Add snippets to the library and this fills in as you practise them.');
    if (typeof lucide !== 'undefined') lucide.createIcons({ el: host });
    return;
  }

  host.innerHTML =
    _snTiles(d) +
    '<div class="an-sn-grid">' +
      _snLanguages(d) +
      _snModes(d) +
      _snHardestCases(d) +
      _snUntouched(d) +
    '</div>' +
    _snRecent(d);

  if (typeof lucide !== 'undefined') lucide.createIcons({ el: host });
};

function _snEmpty(icon, title, body) {
  return `
    <div class="an-sn-empty">
      <i data-lucide="${icon}"></i>
      <h4>${escapeHTML(title)}</h4>
      <p>${escapeHTML(body)}</p>
    </div>`;
}

/* ── Tiles: the four numbers worth leading with ───────────── */

function _snTiles(d) {
  const total = d.snippets.length;
  const covered = d.practised.length;
  const pct = total ? Math.round((covered / total) * 100) : 0;

  // Due comes from the shared review layer, so this agrees with the badge the
  // library itself shows rather than computing a second opinion.
  let due = 0;
  if (typeof libIsDue === 'function') {
    due = d.snippets.filter(s => libIsDue('snippet', s.id)).length;
  }

  const sqlCases = d.snippets.reduce((n, s) =>
    n + (((s.sqlPractice || {}).cases || []).filter(c => (c.answer || '').trim()).length), 0);

  const tile = (icon, value, label, sub, tone) => `
    <div class="an-sn-tile${tone ? ' ' + tone : ''}">
      <i data-lucide="${icon}"></i>
      <div class="an-sn-tile-v">${value}</div>
      <div class="an-sn-tile-l">${escapeHTML(label)}</div>
      ${sub ? `<div class="an-sn-tile-s">${escapeHTML(sub)}</div>` : ''}
    </div>`;

  return `
    <div class="an-sn-tiles">
      ${tile('library', total, 'Snippets', total === 1 ? 'in the library' : 'across the library')}
      ${tile('target', pct + '%', 'Covered', covered + ' of ' + total + ' practised', pct >= 60 ? 'good' : (pct >= 25 ? 'mid' : 'low'))}
      ${tile('brain', due, 'Due to review', due ? 'scheduled for today' : 'nothing scheduled', due ? 'warn' : '')}
      ${tile('list-checks', sqlCases, 'Test cases', sqlCases ? 'ready to attempt' : 'none written yet')}
    </div>`;
}

/* ── Per language ─────────────────────────────────────────── */

function _snLanguages(d) {
  const groups = {};
  d.snippets.forEach(s => {
    const k = _snLang(s);
    if (!groups[k]) groups[k] = { total: 0, practised: 0, scores: [] };
    groups[k].total++;
    const runs = d.byId[s.id] || [];
    if (runs.length) {
      groups[k].practised++;
      runs.forEach(r => { if (typeof r.score === 'number') groups[k].scores.push(r.score); });
    }
  });

  const rows = Object.keys(groups)
    .map(k => ({ lang: k, ...groups[k], avg: _snMean(groups[k].scores) }))
    .sort((a, b) => b.total - a.total);

  return `
    <section class="an-sn-card">
      <h3><i data-lucide="code-2"></i> By language</h3>
      <p class="an-sn-note">Language is how this library is organised, so it is how progress is read.</p>
      <div class="an-sn-rows">
        ${rows.map(r => {
          const pct = r.total ? Math.round((r.practised / r.total) * 100) : 0;
          return `
          <div class="an-sn-row">
            <span class="an-sn-row-k">${escapeHTML(r.lang)}</span>
            <span class="an-sn-bar"><span style="width:${pct}%"></span></span>
            <span class="an-sn-row-v">${r.practised}/${r.total}</span>
            <span class="an-sn-row-x">${r.avg === null ? '—' : r.avg + '%'}</span>
          </div>`;
        }).join('')}
      </div>
      <p class="an-sn-legend">practised / total · average score where there is one</p>
    </section>`;
}

/* ── The two practice modes, side by side, never summed ───── */

function _snModes(d) {
  const mode = (name, icon, runs, unit) => {
    const avg = _snMean(runs.map(r => r.score));
    const mins = Math.round(runs.reduce((n, r) => n + (r.duration || 0), 0) / 60);
    return `
      <div class="an-sn-mode">
        <div class="an-sn-mode-h"><i data-lucide="${icon}"></i> ${escapeHTML(name)}</div>
        ${runs.length ? `
          <div class="an-sn-mode-v">${avg === null ? '—' : avg + '%'}</div>
          <div class="an-sn-mode-s">${runs.length} ${runs.length === 1 ? 'attempt' : 'attempts'} · ${mins} min</div>
          <div class="an-sn-mode-u">${escapeHTML(unit)}</div>
        ` : `<div class="an-sn-mode-none">Never used</div>`}
      </div>`;
  };

  return `
    <section class="an-sn-card">
      <h3><i data-lucide="git-compare"></i> Practice modes</h3>
      <p class="an-sn-note">Kept apart on purpose — the two scores measure different things and a combined average would mean neither.</p>
      <div class="an-sn-modes">
        ${mode('Try Coding', 'terminal', d.tryRuns, 'similarity to the reference')}
        ${mode('Test cases', 'list-checks', d.sqlRuns, 'cases passed')}
      </div>
    </section>`;
}

/* ── Which question keeps being missed ────────────────────── */

function _snHardestCases(d) {
  const tally = {};
  d.sqlRuns.forEach(run => {
    (run.cases || []).forEach(c => {
      // Keyed by case id where the entry has one: keying on the prompt text
      // meant editing a question started its miss count over as a second row.
      const key = (run.snippetId || '') + '|' + (c.id || c.prompt || '');
      if (!tally[key]) {
        tally[key] = { prompt: c.prompt || 'Untitled case', snippet: _snTitle(run), seen: 0, missed: 0 };
      }
      tally[key].seen++;
      if (!c.passed) tally[key].missed++;
    });
  });

  const rows = Object.values(tally)
    .filter(t => t.missed > 0)
    .sort((a, b) => (b.missed / b.seen) - (a.missed / a.seen) || b.missed - a.missed)
    .slice(0, 6);

  return `
    <section class="an-sn-card">
      <h3><i data-lucide="alert-triangle"></i> Questions you keep missing</h3>
      ${rows.length ? `
        <p class="an-sn-note">Per case, across every attempt — not a per-attempt average.</p>
        <ul class="an-sn-list">
          ${rows.map(r => `
            <li>
              <span class="an-sn-miss">${r.missed}/${r.seen}</span>
              <span class="an-sn-list-t">
                ${escapeHTML(r.prompt.slice(0, 90))}
                <em>${escapeHTML(r.snippet)}</em>
              </span>
            </li>`).join('')}
        </ul>
      ` : `<p class="an-sn-note">${d.sqlRuns.length
            ? 'Nothing missed more than once yet.'
            : 'No test-case attempts recorded yet — this fills in after your first.'}</p>`}
    </section>`;
}

/* ── What has never been opened ───────────────────────────── */

function _snUntouched(d) {
  const list = d.never.slice(0, 8);
  return `
    <section class="an-sn-card">
      <h3><i data-lucide="circle-dashed"></i> Never practised</h3>
      ${d.never.length ? `
        <p class="an-sn-note">${d.never.length} of ${d.snippets.length} have no attempt against them.</p>
        <ul class="an-sn-list an-sn-list-links">
          ${list.map(s => `
            <li onclick="snAnalyticsOpen('${s.id}')" title="Open in the library">
              <span class="an-sn-list-t">
                ${escapeHTML(s.title || 'Untitled')}
                <em>${escapeHTML(_snLang(s))}</em>
              </span>
              <i data-lucide="chevron-right"></i>
            </li>`).join('')}
        </ul>
        ${d.never.length > list.length ? `<p class="an-sn-legend">and ${d.never.length - list.length} more</p>` : ''}
      ` : `<p class="an-sn-note">Every snippet has been practised at least once.</p>`}
    </section>`;
}

/* ── The log itself ───────────────────────────────────────── */

function _snRecent(d) {
  const rows = d.log.slice()
    .sort((a, b) => _snWhen(b) - _snWhen(a) || String(b.date || '').localeCompare(String(a.date || '')))
    .slice(0, 12);
  if (!rows.length) {
    return `<section class="an-sn-card an-sn-wide">
      <h3><i data-lucide="history"></i> Recent attempts</h3>
      <p class="an-sn-note">Nothing yet. Study a snippet or start an attempt and it appears here.</p>
    </section>`;
  }
  return `
    <section class="an-sn-card an-sn-wide">
      <h3><i data-lucide="history"></i> Recent attempts</h3>
      <table class="an-sn-table">
        <thead><tr><th>Snippet</th><th>Mode</th><th>Score</th><th>Time</th><th>Date</th></tr></thead>
        <tbody>
          ${rows.map(r => {
            const sql = r.kind === 'sql';
            const score = typeof r.score === 'number' ? r.score + '%' : '—';
            const detail = sql && r.total ? ` <span class="an-sn-sub">${r.passed}/${r.total}</span>` : '';
            return `
            <tr>
              <td>${escapeHTML(_snTitle(r))}</td>
              <td><span class="an-sn-chip${sql ? ' sql' : ''}">${sql ? 'Test cases' : 'Try Coding'}</span></td>
              <td class="${typeof r.score === 'number' ? (r.score >= 80 ? 'ok' : (r.score >= 50 ? 'mid' : 'bad')) : ''}">${score}${detail}</td>
              <td>${r.duration ? Math.max(1, Math.round(r.duration / 60)) + 'm' : '—'}</td>
              <td>${escapeHTML(r.date || '')}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </section>`;
}

/** Jump from a row to the snippet it is about. */
window.snAnalyticsOpen = function (id) {
  if (typeof setSessionParam === 'function') setSessionParam('activeSnippetId', id);
  spaNavigate('snippets');
  setTimeout(() => { if (typeof selectSnippet === 'function') selectSnippet(id); }, 320);
};


/* ── Staying current ──────────────────────────────────────────
   Everything that edits snippet history calls renderSnippetAnalytics — the
   old tree renderer, which quietly does nothing on this page because its DOM
   is not here. So deleting an attempt left the dashboard showing counts that
   were no longer true. Wrap it: the original still runs for the old view, and
   this one repaints when the dashboard is what is actually on screen. */
(function () {
  const prev = window.renderSnippetAnalytics;
  window.renderSnippetAnalytics = function () {
    if (typeof prev === 'function') {
      try { prev.apply(this, arguments); } catch (e) { /* old view not mounted */ }
    }
    if (document.getElementById('an-sn-body')) renderSnippetAnalyticsDashboard();
  };
})();
