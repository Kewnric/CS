/* Route: analytics & sub-routes */

function analyticsTemplate() {
  return `
    <div class="home-content">
      <div class="home-scroll lib-hub">
        <section class="lib-hub-hero fade-in-up">
          <div class="lib-hub-hero-icon"><i data-lucide="bar-chart-3"></i></div>
          <h1 class="lib-hub-title">Analytics</h1>
          <p class="lib-hub-subtitle">Every performance record in one place — select a wing to view its metrics.</p>
          <div class="lib-hub-totals" id="analytics-hub-totals"></div>
        </section>

        <section>
          <h2 class="lib-hub-section-title"><i data-lucide="bar-chart-2"></i> Performance Wings</h2>
          <div class="lib-hub-grid stagger-children" id="analytics-hub-active"></div>
        </section>
      </div>
    </div>
  `;
}

function _analyticsStatChip(icon, label) {
  return `<span class="lib-stat-chip"><i data-lucide="${icon}"></i> ${label}</span>`;
}

function analyticsInit() {
  const challenges = state.challenges || [];
  const notebooks = state.notebooks || [];
  const snippets = state.snippets || [];
  const codingHistory = state.history || [];
  const notebookHistory = state.notebookHistory || [];
  const snippetHistory = state.snippetHistory || [];

  // Coding completion. Must be counted against the live challenge list — history
  // holds manual practice-set problems (challengeId: null) and attempts at
  // programs that have since been deleted, both of which inflated this.
  const completedPrograms = (typeof countCompletedPrograms === 'function')
    ? countCompletedPrograms()
    : new Set(codingHistory.filter(h => h.challengeId && h.score === 100 && !h.isArchived).map(h => h.challengeId)).size;
  const codingPct = challenges.length ? Math.round((completedPrograms / challenges.length) * 100) : 0;

  // Notes mastery
  const mastered = (typeof _notebookBestPct === 'function')
    ? notebooks.filter(nb => _notebookBestPct(nb) >= 80).length : 0;
  const notesPct = notebooks.length ? Math.round((mastered / notebooks.length) * 100) : 0;

  // Snippets rotation/review
  let snippetTracked = 0;
  if (typeof _snippetStatus === 'function') {
    snippets.forEach(s => { if (_snippetStatus(s) !== 'new') snippetTracked++; });
  }
  const snipPct = snippets.length ? Math.round((snippetTracked / snippets.length) * 100) : 0;

  const totals = document.getElementById('analytics-hub-totals');
  if (totals) {
    const totalAttempts = codingHistory.length + notebookHistory.length + snippetHistory.length;
    const streakDays = calcStudyStreak();
    totals.innerHTML = `
      ${_analyticsStatChip('target', `${totalAttempts} total attempts`)}
      ${_analyticsStatChip('flame', `${streakDays} day streak`)}
      ${_analyticsStatChip('award', `${state.badges ? state.badges.length : 0} badges mastered`)}
    `;
  }

  const active = document.getElementById('analytics-hub-active');
  if (active) {
    const card = (route, cls, icon, name, desc, chips, pct, pctLabel) => `
      <div class="lib-card ${cls}" onclick="spaNavigate('${route}')" role="link" tabindex="0"
           onkeydown="if(event.key==='Enter')spaNavigate('${route}')">
        <div class="lib-card-glow"></div>
        <div class="lib-card-head">
          <div class="lib-card-icon"><i data-lucide="${icon}"></i></div>
          <i data-lucide="arrow-up-right" class="lib-card-arrow"></i>
        </div>
        <h3 class="lib-card-name">${name}</h3>
        <p class="lib-card-desc">${desc}</p>
        <div class="lib-card-chips">${chips}</div>
        <div class="lib-card-progress" title="${pctLabel}">
          <div class="folder-progress-bar"><div class="folder-progress-fill" style="width:${pct}%;"></div></div>
          <span class="folder-progress-label">${pct}%</span>
        </div>
      </div>`;

    active.innerHTML =
      card('analytics-coding', 'lib-card-coding', 'code-2', 'Coding Analytics',
        'Detailed history, scores, and completion trends for coding programs and sets.',
        _analyticsStatChip('file-code', `${codingHistory.length} attempts`) + _analyticsStatChip('check-circle', `${completedPrograms} completed`),
        codingPct, `${completedPrograms}/${challenges.length} completed`) +
      card('analytics-notes', 'lib-card-notes', 'book-open', 'Notes Analytics',
        'Concept mastery tracking, notebook accuracy, and quiz attempt charts.',
        _analyticsStatChip('book-open', `${notebookHistory.length} attempts`) + _analyticsStatChip('trophy', `${mastered} mastered`),
        notesPct, `${mastered}/${notebooks.length} mastered (80%+)`) +
      card('analytics-snippets', 'lib-card-snippets', 'code', 'Snippet Analytics',
        'Snippet try-coding attempt logs, spaced-repetition schedules, and metrics.',
        _analyticsStatChip('code', `${snippetHistory.length} attempts`) + _analyticsStatChip('brain', `${snippetTracked} in rotation`),
        snipPct, `${snippetTracked}/${snippets.length} in rotation`);
  }

  const libRoot = document.querySelector('.lib-hub');
  if (typeof lucide !== 'undefined') lucide.createIcons(libRoot ? { root: libRoot } : undefined);
}

function analyticsDestroy() { }


/* -------------------------------------------------------------
   CODING LIBRARY ANALYTICS
   ------------------------------------------------------------- */
function analyticsCodingTemplate() {
  return `
    <div class="messenger-layout">
      <main class="messenger-pane-1">
        <div class="pane-1-header">
          <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
            <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1; min-width: 0;">
              <button onclick="spaNavigate('analytics')" class="btn-back-dark" style="margin-right: 0.5rem; padding: 0.25rem 0.5rem; font-size: 0.75rem; flex-shrink: 0;">
                <i data-lucide="chevron-left" style="width:14px;height:14px;"></i> Back
              </button>
              <h2 class="section-header-animated" style="margin: 0; display: flex; align-items: center;">
                <span class="section-header-icon-wrap analytics-icon-wrap" style="background:rgba(99,102,241,0.14); color:var(--color-primary);">
                  <i data-lucide="code-2"></i>
                  <span class="section-header-icon-ring"></span>
                </span>
                <span class="section-header-text">
                  <span class="section-header-title">Coding Analytics</span>
                  <span class="section-header-subtitle" id="analytics-coding-header-stats">Loading...</span>
                </span>
              </h2>
            </div>
            <div style="display: flex; align-items: center; gap: 0.35rem; flex-shrink: 0;">
              <button class="tutorial-trigger-btn" id="analytics-coding-toggle-items-btn" onclick="toggleAnalyticsTreeItems()" title="Toggle file visibility">
                <i data-lucide="${localStorage.getItem('analyticsHideItems') === 'true' ? 'eye-off' : 'eye'}" id="analytics-coding-toggle-items-icon"></i>
              </button>
            </div>
          </div>
          <div class="analytics-summary-strip" id="analytics-coding-summary-strip"></div>
          <div class="search-container search-animated" style="width: 100%; margin-top: 0.75rem;">
            <i data-lucide="search"></i>
            <input type="text" id="analytics-search" oninput="debouncedAnalyticsSearch()" placeholder="Search coding history..." class="search-input">
          </div>
        </div>
        <div class="pane-1-content tree-container" id="analytics-coding-sidebar-content"></div>
      </main>
      <div class="resizer-divider" onmousedown="initResizerDrag(event, this)"></div>
      <section class="messenger-pane-2">
        <div id="analytics-detail-container" style="height: 100%;"></div>
      </section>
    </div>
  `;
}

function analyticsCodingInit() {
  activeAnalyticsTab = 'practice';
  bulkResetMode = false;
  activeNotebookHistoryId = null;
  activeSnippetHistoryId = null;

  const container = document.getElementById('analytics-detail-container');
  if (container) {
    if (activeHistoryChallengeId && typeof renderHistoryDetail === 'function') {
      renderHistoryDetail(activeHistoryChallengeId);
    } else if (activeHistorySetId && typeof renderSetHistoryDetail === 'function') {
      renderSetHistoryDetail(activeHistorySetId);
    } else if (activeAnalyticsFolderId && activeAnalyticsFolderScope === 'challenge' && typeof renderAnalyticsFolderDetail === 'function') {
      renderAnalyticsFolderDetail(activeAnalyticsFolderId, 'challenge');
    } else if (typeof renderAnalyticsOverview === 'function') {
      renderAnalyticsOverview(container);
    }
  }

  renderCodingAnalytics();

  if (typeof window.restoreAnalyticsScrollPositions === 'function') {
    window.restoreAnalyticsScrollPositions();
    setTimeout(window.restoreAnalyticsScrollPositions, 0);
  }
}

function analyticsCodingDestroy() { }


/* -------------------------------------------------------------
   NOTES LIBRARY ANALYTICS
   ------------------------------------------------------------- */
function analyticsNotesTemplate() {
  return `
    <div class="messenger-layout">
      <main class="messenger-pane-1">
        <div class="pane-1-header">
          <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
            <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1; min-width: 0;">
              <button onclick="spaNavigate('analytics')" class="btn-back-dark" style="margin-right: 0.5rem; padding: 0.25rem 0.5rem; font-size: 0.75rem; flex-shrink: 0;">
                <i data-lucide="chevron-left" style="width:14px;height:14px;"></i> Back
              </button>
              <h2 class="section-header-animated" style="margin: 0; display: flex; align-items: center;">
                <span class="section-header-icon-wrap analytics-icon-wrap" style="background:rgba(34,197,94,0.14); color:var(--color-success);">
                  <i data-lucide="book-open"></i>
                  <span class="section-header-icon-ring"></span>
                </span>
                <span class="section-header-text">
                  <span class="section-header-title">Notes Analytics</span>
                  <span class="section-header-subtitle" id="analytics-notes-header-stats">Loading...</span>
                </span>
              </h2>
            </div>
            <div style="display: flex; align-items: center; gap: 0.35rem; flex-shrink: 0;">
              <button class="tutorial-trigger-btn" id="analytics-notes-toggle-items-btn" onclick="toggleAnalyticsTreeItems()" title="Toggle file visibility">
                <i data-lucide="${localStorage.getItem('analyticsHideItems') === 'true' ? 'eye-off' : 'eye'}" id="analytics-notes-toggle-items-icon"></i>
              </button>
            </div>
          </div>
          <div class="analytics-summary-strip" id="analytics-notes-summary-strip"></div>
          <div class="search-container search-animated" style="width: 100%; margin-top: 0.75rem;">
            <i data-lucide="search"></i>
            <input type="text" id="analytics-search" oninput="debouncedAnalyticsSearch()" placeholder="Search notebook history..." class="search-input">
          </div>
        </div>
        <div class="pane-1-content tree-container" id="analytics-notes-sidebar-content"></div>
      </main>
      <div class="resizer-divider" onmousedown="initResizerDrag(event, this)"></div>
      <section class="messenger-pane-2">
        <div id="analytics-detail-container" style="height: 100%;"></div>
      </section>
    </div>
  `;
}

function analyticsNotesInit() {
  activeAnalyticsTab = 'training';
  bulkResetMode = false;
  activeHistoryChallengeId = null;
  activeHistorySetId = null;
  activeSnippetHistoryId = null;

  const container = document.getElementById('analytics-detail-container');
  if (container) {
    if (activeNotebookHistoryId && typeof renderNotebookHistoryDetailView === 'function') {
      renderNotebookHistoryDetailView(activeNotebookHistoryId);
    } else if (activeAnalyticsFolderId && activeAnalyticsFolderScope === 'notebook' && typeof renderAnalyticsFolderDetail === 'function') {
      renderAnalyticsFolderDetail(activeAnalyticsFolderId, 'notebook');
    } else if (typeof renderAnalyticsOverview === 'function') {
      renderAnalyticsOverview(container);
    }
  }

  renderNotesAnalytics();

  if (typeof window.restoreAnalyticsScrollPositions === 'function') {
    window.restoreAnalyticsScrollPositions();
    setTimeout(window.restoreAnalyticsScrollPositions, 0);
  }
}

function analyticsNotesDestroy() { }


/* -------------------------------------------------------------
   SNIPPET LIBRARY ANALYTICS
   ------------------------------------------------------------- */
/* The snippets route no longer borrows the coding library's tree-and-detail
   shell. That shell answers "which attempt, what score" — the right questions
   for one program, the wrong ones for a reference library, where what matters
   is how much of it you have touched and what you have never opened. */
function analyticsSnippetsTemplate() {
  return `
    <div class="an-sn-page">
      <header class="an-sn-head">
        <button onclick="spaNavigate('analytics')" class="btn-back-dark" title="Back">
          <i data-lucide="chevron-left" style="width:14px;height:14px;"></i> Back
        </button>
        <h2 class="section-header-animated" style="margin:0; display:flex; align-items:center;">
          <span class="section-header-icon-wrap analytics-icon-wrap" style="background:rgba(6,182,212,0.14); color:var(--color-accent);">
            <i data-lucide="code"></i>
            <span class="section-header-icon-ring"></span>
          </span>
          <span class="section-header-text">
            <span class="section-header-title">Snippet Analytics</span>
            <span class="section-header-subtitle" id="an-sn-sub">Coverage, languages and the questions you keep missing</span>
          </span>
        </h2>
      </header>
      <div class="an-sn-body" id="an-sn-body"></div>
    </div>
  `;
}

function analyticsSnippetsInit() {
  activeAnalyticsTab = 'snippets';
  if (typeof renderSnippetAnalyticsDashboard === 'function') renderSnippetAnalyticsDashboard();
  const sub = document.getElementById('an-sn-sub');
  if (sub) {
    const n = (state.snippets || []).length;
    const runs = (state.snippetHistory || []).length;
    sub.textContent = n + (n === 1 ? ' snippet' : ' snippets') + ' · ' +
      runs + (runs === 1 ? ' attempt' : ' attempts') + ' logged';
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function analyticsSnippetsDestroy() { }

/* updateAnalyticsSummary() used to live here. It queried #analytics-summary-strip
   and #analytics-header-stats — ids that exist nowhere in the templates (they are
   #analytics-coding-summary-strip etc.), so it bailed on its first line every time
   renderHistory() called it. Worse, route files load after history.js, so this
   no-op shadowed nothing but wasted a call on every render. The working
   implementation is updateAnalyticsSubSummary(type) in history.js. */

/**
 * A calendar-day key ("YYYY-MM-DD") for any history record.
 *
 * Records store `date` as toLocaleDateString() output ("8/15/2026"), which cannot
 * be compared or sorted as a string — "10/2/2026" sorts BEFORE "9/30/2026". Prefer
 * the real epoch fields; coding attempts carry submitTime/startTime and notebook
 * records embed a timestamp in their id. Fall back to parsing the display string.
 */
function _historyDayKey(rec) {
  if (!rec) return null;
  let ms = rec.submitTime || rec.startTime || null;
  if (!ms && typeof rec.id === 'string') {
    const m = rec.id.match(/(\d{10,})/);
    if (m) ms = Number(m[1]);
  }
  let d = ms ? new Date(Number(ms)) : null;
  if ((!d || isNaN(d.getTime())) && rec.date) {
    d = new Date(rec.date);
    if (isNaN(d.getTime())) {
      // Last resort: M/D/YYYY, the shape toLocaleDateString() produces here.
      const p = String(rec.date).split(/[/\-.]/).map(Number);
      if (p.length === 3 && p.every(n => !isNaN(n))) d = new Date(p[2], p[0] - 1, p[1]);
    }
  }
  if (!d || isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Consecutive days with any recorded activity, ending today or yesterday. */
function calcStudyStreak() {
  const days = new Set();
  [state.history, state.notebookHistory, state.snippetHistory].forEach(list => {
    (list || []).forEach(rec => { const k = _historyDayKey(rec); if (k) days.add(k); });
  });
  if (days.size === 0) return 0;

  // ISO keys DO sort correctly as strings, unlike the raw locale dates.
  const sorted = Array.from(days).sort().reverse();
  const DAY = 86400000;
  const toDate = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const gapToLatest = Math.round((today - toDate(sorted[0])) / DAY);
  if (gapToLatest > 1) return 0;   // nothing today or yesterday — streak is broken

  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (Math.round((toDate(sorted[i - 1]) - toDate(sorted[i])) / DAY) === 1) streak++;
    else break;
  }
  return streak;
}

function animateCounters(container) {
  container.querySelectorAll('[data-count]').forEach(el => {
    const target = parseInt(el.dataset.count);
    if (isNaN(target) || target === 0) return;
    let current = 0;
    const step = Math.max(1, Math.ceil(target / 30));
    const interval = setInterval(() => {
      current += step;
      if (current >= target) { current = target; clearInterval(interval); }
      el.textContent = current;
    }, 25);
  });
}
