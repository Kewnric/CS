/* Route: browse */
function browseTemplate() {
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
                <span class="section-header-icon-wrap browse-icon-wrap">
                  <i data-lucide="layout-template"></i>
                  <span class="section-header-icon-ring"></span>
                </span>
                <span class="section-header-text">
                  <span class="section-header-title">Coding Library</span>
                  <span class="section-header-subtitle" id="browse-header-stats">0 programs</span>
                </span>
              </h2>
            </div>
            <div style="display: flex; align-items: center; gap: 0.35rem; flex-shrink: 0;">
              <button class="tutorial-trigger-btn" id="browse-toggle-items-btn" onclick="toggleBrowseTreeItems()" title="Toggle file visibility">
                <i data-lucide="${localStorage.getItem('browseHideItems') === 'true' ? 'eye-off' : 'eye'}" id="browse-toggle-items-icon"></i>
              </button>
              ${typeof codingStarterButtonTemplate === 'function' ? codingStarterButtonTemplate() : ''}
              <button class="tutorial-trigger-btn" onclick="GuidedTutorial.start()" title="Show Page Tour">
                <i data-lucide="graduation-cap"></i>
              </button>
            </div>
          </div>
          <div class="search-container search-animated" style="width: 100%;">
            <i data-lucide="search"></i>
            <input type="text" id="browse-search" oninput="debouncedBrowseSearch()" placeholder="Search programs..." class="search-input">
            <span class="search-shortcut-hint">Ctrl+K</span>
          </div>
          <div class="browse-mini-stats" id="browse-mini-stats"></div>
          <div id="browse-starter-banner">${typeof codingStarterBannerTemplate === 'function' ? codingStarterBannerTemplate() : ''}</div>
        </div>
        <div class="pane-1-content tree-container" id="browse-category-list"></div>
      </main>
      <div class="resizer-divider" onmousedown="initResizerDrag(event, this)"></div>
      <section class="messenger-pane-2">
        <div id="browse-challenges-container" style="padding: 2rem; min-height: 100%;">
          <div class="empty-state" style="height: 100%; display: flex; align-items: center; justify-content: center; flex-direction: column;">
            <div class="empty-state-icon-animated">
              <i data-lucide="folder-open" style="width: 48px; height: 48px; opacity: 0.5;"></i>
              <div class="empty-state-pulse-ring"></div>
            </div>
            <h2>Select a folder</h2>
            <p style="font-size: 0.875rem; color: var(--text-tertiary); margin-top: 0.5rem;">Choose a folder from the left pane to view its programs.</p>
          </div>
        </div>
      </section>
    </div>

    <div id="tree-context-menu" class="tree-context-menu hidden">
      <button class="tree-context-item" id="ctx-new-folder" onclick="ctxNewFolder()"><i data-lucide="folder-plus"></i> New Subfolder</button>
      <button class="tree-context-item" id="ctx-rename" onclick="ctxRenameFolder()"><i data-lucide="pencil"></i> Rename</button>
      <button class="tree-context-item" id="ctx-move" onclick="ctxMoveFolder()"><i data-lucide="move"></i> Move to...</button>
      <button class="tree-context-item" id="ctx-icon" onclick="ctxChangeIcon()"><i data-lucide="image"></i> Change Icon</button>
      <button class="tree-context-item" id="ctx-tier" onclick="ctxOpenTierPicker()"><i data-lucide="bar-chart-2"></i> Set Tier</button>
      <button class="tree-context-item" id="ctx-lock" onclick="ctxOpenLockPicker()"><i data-lucide="lock"></i> Set Prerequisites</button>
      <div class="tree-context-divider"></div>
      <button class="tree-context-item danger" id="ctx-delete" onclick="ctxDeleteFolder()"><i data-lucide="trash-2"></i> Delete Folder</button>
    </div>

    <div id="share-toast" style="position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);background:var(--color-primary);color:#fff;padding:0.75rem 1.5rem;border-radius:var(--radius-md);font-weight:600;font-size:0.875rem;z-index:9999;opacity:0;transition:opacity 0.3s ease;pointer-events:none;box-shadow:0 4px 12px rgba(0,0,0,0.3);"></div>
  `;
}

function browseInit() {
  // Sync any detail target set by another page (home carousel, search, or
  // returning from a practice/practice-set attempt). A practice set takes
  // priority, then a single program; otherwise show the folder view.
  const targetSet = getSessionParam('browseActiveSet') || null;
  const targetProgram = getSessionParam('browseActiveProgram') || null;
  if (targetSet && (state.codingSets || []).some(s => s.id === targetSet)) {
    browseSelectSet(targetSet);
  } else if (targetProgram && state.challenges.some(c => c.id === targetProgram)) {
    browseActiveSetId = null;
    browseSelectProgram(targetProgram);
  } else {
    browseActiveProgramId = null;
    browseActiveSetId = null;
    renderBrowse();
  }
  updateBrowseHeaderStats();
  checkSharedChallenge();
  GuidedTutorial.init('browse');
}

function browseDestroy() { }

function updateBrowseHeaderStats() {
  const totalPrograms = state.challenges.length;
  const completedPrograms = countCompletedPrograms();
  const folders = state.nodes.filter(n => n.scope === 'challenge' && n.type === 'folder').length;

  const headerSub = document.getElementById('browse-header-stats');
  if (headerSub) {
    headerSub.textContent = `${totalPrograms} program${totalPrograms !== 1 ? 's' : ''} across ${folders} folder${folders !== 1 ? 's' : ''}`;
  }

  const miniStats = document.getElementById('browse-mini-stats');
  if (miniStats) {
    const pct = totalPrograms > 0 ? Math.round((completedPrograms / totalPrograms) * 100) : 0;
    // review.js has always scheduled challenges too — this library just never
    // showed it, so "what should I redo today?" had no answer here.
    const due = typeof libDueCount === 'function' ? libDueCount('challenge', state.challenges) : 0;

    // Surgical update (by data-stat) to avoid re-triggering the chip pop-in.
    const totalVal = miniStats.querySelector('[data-stat="total"] .mini-stat-value');
    const doneVal = miniStats.querySelector('[data-stat="done"] .mini-stat-value');
    const dueVal = miniStats.querySelector('[data-stat="due"] .mini-stat-value');
    const pctVal = miniStats.querySelector('[data-stat="progress"] .mini-bar-pct');
    const barFill = miniStats.querySelector('[data-stat="progress"] .mini-bar-fill');

    if (totalVal && doneVal && dueVal && pctVal && barFill) {
      totalVal.textContent = totalPrograms;
      doneVal.textContent = completedPrograms;
      dueVal.textContent = due;
      dueVal.parentElement.classList.toggle('due', due > 0);
      pctVal.textContent = `${pct}%`;
      barFill.style.width = `${pct}%`;
    } else {
      miniStats.innerHTML = `
        <div class="mini-stat-chip" data-stat="total" title="Total programs">
          <i data-lucide="file-code" style="width:12px;height:12px;"></i>
          <span class="mini-stat-value">${totalPrograms}</span>
          <span class="mini-stat-label">Total</span>
        </div>
        <div class="mini-stat-chip completed" data-stat="done" title="Completed programs">
          <i data-lucide="check-circle" style="width:12px;height:12px;"></i>
          <span class="mini-stat-value">${completedPrograms}</span>
          <span class="mini-stat-label">Done</span>
        </div>
        <div class="mini-stat-chip${due > 0 ? ' due' : ''}" data-stat="due" title="Programs spaced repetition says are due today" onclick="libToggleFlag('browse','due')" style="cursor:pointer;">
          <i data-lucide="brain" style="width:12px;height:12px;"></i>
          <span class="mini-stat-value">${due}</span>
          <span class="mini-stat-label">Due</span>
        </div>
        <div class="mini-stat-chip mini-progress-chip" data-stat="progress" title="${completedPrograms} of ${totalPrograms} complete">
          <i data-lucide="trending-up" style="width:12px;height:12px;"></i>
          <span class="mini-bar-pct mini-stat-value">${pct}%</span>
          <div class="mini-bar"><div class="mini-bar-fill" style="width:${pct}%;"></div></div>
        </div>
      `;
      if (typeof lucide !== 'undefined') lucide.createIcons({ root: miniStats });
    }
  }
}
