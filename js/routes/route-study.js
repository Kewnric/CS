/* Route: study (Notes Library — notebooks only; snippets live in #/snippets) */
function studyTemplate() {
  return `
    <div class="messenger-layout">
      <main class="messenger-pane-1">
        <div class="pane-1-header">
          <div style="display: flex; align-items: center; gap: 0.5rem; width: 100%; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1; min-width: 0;">
              <button onclick="spaNavigate('library')" class="btn-back-dark" style="margin-right: 0.5rem; padding: 0.25rem 0.5rem; font-size: 0.75rem; flex-shrink: 0;">
                <i data-lucide="chevron-left" style="width:14px;height:14px;"></i> Back
              </button>
              <h2 class="section-header-animated" style="margin: 0; display: flex; align-items: center;">
                <span class="section-header-icon-wrap study-icon-wrap">
                  <i data-lucide="book-open"></i>
                  <span class="section-header-icon-ring"></span>
                </span>
                <span class="section-header-text">
                  <span class="section-header-title">Notes Library</span>
                  <span class="section-header-subtitle" id="study-header-stats">Loading...</span>
                </span>
              </h2>
            </div>
            <div style="display: flex; align-items: center; gap: 0.35rem; flex-shrink: 0;">
              <button class="tutorial-trigger-btn" id="study-toggle-items-btn" onclick="toggleStudyTreeItems()" title="Toggle notebook visibility">
                <i data-lucide="${localStorage.getItem('studyHideItems') === 'true' ? 'eye-off' : 'eye'}" id="study-toggle-items-icon"></i>
              </button>
              <button class="tutorial-trigger-btn" onclick="GuidedTutorial.start()" title="Show Page Tour">
                <i data-lucide="graduation-cap"></i>
              </button>
            </div>
          </div>
          <div class="search-container search-animated" style="width: 100%;">
            <i data-lucide="search"></i>
            <input type="text" id="snippet-search" oninput="handleTrainingGroundsSearch()" placeholder="Search notebooks..." class="search-input">
            <span class="search-shortcut-hint">Ctrl+K</span>
          </div>
          <div class="browse-mini-stats" id="study-mini-stats"></div>
        </div>
        <div class="pane-1-content tree-container" id="notes-sidebar-container"></div>
      </main>
      <div class="resizer-divider" onmousedown="initResizerDrag(event, this)"></div>
      <section class="messenger-pane-2">
        <div id="notes-detail-container" style="padding: 2rem; overflow-y: auto; height: 100%;">
          <div id="notes-sections-area"></div>
          <div id="notes-empty-state" class="empty-state" style="height:100%; display:flex; align-items:center; justify-content:center; flex-direction:column;">
            <div class="empty-state-icon-animated">
              <i data-lucide="book-open" style="width:48px;height:48px;opacity:0.5;"></i>
              <div class="empty-state-pulse-ring"></div>
            </div>
            <h2>Select a Notebook</h2>
            <p style="font-size:0.875rem;color:var(--text-tertiary);margin-top:0.5rem;">Choose a notebook or folder from the left panel to begin your session.</p>
          </div>
        </div>
      </section>
    </div>

  `;
}

function studyInit() {
  // Snippet share links belong to the Snippet Library — bounce there. The
  // payload now lives in the pending-share store, not in the URL (the URL is
  // cleaned at boot), so read it from there without consuming it.
  try {
    if (typeof hasPendingShare === 'function' && hasPendingShare()) {
      const raw = sessionStorage.getItem(PENDING_SHARE_KEY);
      const shared = raw ? JSON.parse(raw) : null;
      if (shared && shared._type === 'snippet') { spaNavigate('snippets'); return; }
    }
  } catch (e) { /* malformed share data — ignore */ }

  notesInit();

  const targetNotebookId = getSessionParam('activeNotebook');
  if (targetNotebookId && (state.notebooks || []).some(n => n.id === targetNotebookId)) {
    notesSelectNotebook(targetNotebookId);
    clearSessionParam('activeNotebook');
    clearSessionParam('studyTab');
  }

  updateStudyHeaderStats();
  checkSharedNotebook();
  GuidedTutorial.init('study');
}

function studyDestroy() { }

function updateStudyHeaderStats() {
  const notebooks = state.notebooks || [];
  const totalNotebooks = notebooks.length;
  const notebookFolders = state.nodes.filter(n => n.scope === 'notebook' && n.type === 'folder').length;
  const mastered = (typeof _notebookBestPct === 'function')
    ? notebooks.filter(nb => _notebookBestPct(nb) >= 80).length
    : 0;
  const pct = totalNotebooks > 0 ? Math.round((mastered / totalNotebooks) * 100) : 0;

  const headerSub = document.getElementById('study-header-stats');
  if (headerSub) {
    headerSub.textContent = `${totalNotebooks} notebook${totalNotebooks !== 1 ? 's' : ''} across ${notebookFolders} folder${notebookFolders !== 1 ? 's' : ''}`;
  }

  const miniStats = document.getElementById('study-mini-stats');
  if (miniStats) {
    // Notebooks have always been scheduled by review.js; this library just
    // never showed it.
    const due = typeof libDueCount === 'function' ? libDueCount('notebook', notebooks) : 0;
    const totalVal = miniStats.querySelector('[data-stat="total"] .mini-stat-value');
    const doneVal = miniStats.querySelector('[data-stat="done"] .mini-stat-value');
    const dueVal = miniStats.querySelector('[data-stat="due"] .mini-stat-value');
    const pctVal = miniStats.querySelector('[data-stat="progress"] .mini-bar-pct');
    const barFill = miniStats.querySelector('[data-stat="progress"] .mini-bar-fill');
    if (totalVal && doneVal && dueVal && pctVal && barFill) {
      totalVal.textContent = totalNotebooks;
      doneVal.textContent = mastered;
      dueVal.textContent = due;
      dueVal.parentElement.classList.toggle('due', due > 0);
      pctVal.textContent = `${pct}%`;
      barFill.style.width = `${pct}%`;
    } else {
      miniStats.innerHTML = `
        <div class="mini-stat-chip" data-stat="total" title="Total notebooks">
          <i data-lucide="book-open" style="width:12px;height:12px;"></i>
          <span class="mini-stat-value">${totalNotebooks}</span>
          <span class="mini-stat-label">Total</span>
        </div>
        <div class="mini-stat-chip completed" data-stat="done" title="Mastered (best score 80%+)">
          <i data-lucide="trophy" style="width:12px;height:12px;"></i>
          <span class="mini-stat-value">${mastered}</span>
          <span class="mini-stat-label">Mastered</span>
        </div>
        <div class="mini-stat-chip${due > 0 ? ' due' : ''}" data-stat="due" title="Notebooks spaced repetition says are due today" onclick="libToggleFlag('notebook','due')" style="cursor:pointer;">
          <i data-lucide="brain" style="width:12px;height:12px;"></i>
          <span class="mini-stat-value">${due}</span>
          <span class="mini-stat-label">Due</span>
        </div>
        <div class="mini-stat-chip mini-progress-chip" data-stat="progress" title="${mastered} of ${totalNotebooks} mastered">
          <i data-lucide="trending-up" style="width:12px;height:12px;"></i>
          <span class="mini-bar-pct mini-stat-value">${pct}%</span>
          <div class="mini-bar"><div class="mini-bar-fill" style="width:${pct}%;"></div></div>
        </div>
      `;
      if (typeof lucide !== 'undefined') lucide.createIcons({ root: miniStats });
    }
  }
}
