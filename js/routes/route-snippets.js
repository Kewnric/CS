/* Route: snippets (Snippet Library — split out of the old combined Notes Library) */
function snippetsTemplate() {
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
                <span class="section-header-icon-wrap snippets-icon-wrap">
                  <i data-lucide="code"></i>
                  <span class="section-header-icon-ring"></span>
                </span>
                <span class="section-header-text">
                  <span class="section-header-title">Snippet Library</span>
                  <span class="section-header-subtitle" id="snippets-header-stats">Loading...</span>
                </span>
              </h2>
            </div>
            <div style="display: flex; align-items: center; gap: 0.35rem; flex-shrink: 0;">
              <button class="tutorial-trigger-btn" id="snippets-toggle-items-btn" onclick="toggleSnippetsTreeItems()" title="Toggle snippet visibility">
                <i data-lucide="${localStorage.getItem('snippetsHideItems') === 'true' ? 'eye-off' : 'eye'}" id="snippets-toggle-items-icon"></i>
              </button>
              <button class="tutorial-trigger-btn" onclick="GuidedTutorial.start()" title="Show Page Tour">
                <i data-lucide="graduation-cap"></i>
              </button>
            </div>
          </div>
          <div class="search-container search-animated" style="width: 100%;">
            <i data-lucide="search"></i>
            <input type="text" id="snippet-search" oninput="handleTrainingGroundsSearch()" placeholder="Search snippets..." class="search-input">
            <span class="search-shortcut-hint">Ctrl+K</span>
          </div>
          <div class="browse-mini-stats" id="snippets-mini-stats"></div>
        </div>
        <div class="pane-1-content tree-container" id="snippet-list-container"></div>
      </main>
      <div class="resizer-divider" onmousedown="initResizerDrag(event, this)"></div>
      <section class="messenger-pane-2">
        <div id="snippet-detail-container" style="padding: 2rem; min-height: 100%;">
          <div class="empty-state" style="height: 100%; display: flex; align-items: center; justify-content: center; flex-direction: column;">
            <div class="empty-state-icon-animated">
              <i data-lucide="mouse-pointer-click" style="width: 48px; height: 48px; opacity: 0.5;"></i>
              <div class="empty-state-pulse-ring"></div>
            </div>
            <h2>Select a snippet</h2>
            <p style="font-size: 0.875rem; color: var(--text-tertiary); margin-top: 0.5rem;">Choose a code snippet or folder from the left pane to view its details.</p>
          </div>
        </div>
      </section>
    </div>

    <div id="snippet-context-menu" class="tree-context-menu hidden">
      <button class="tree-context-item" id="sctx-new-folder" onclick="snippetCtxNewFolder()"><i data-lucide="folder-plus"></i> New Subfolder</button>
      <button class="tree-context-item" id="sctx-rename" onclick="snippetCtxRename()"><i data-lucide="pencil"></i> Rename</button>
      <button class="tree-context-item" id="sctx-move" onclick="snippetCtxMove()"><i data-lucide="move"></i> Move to...</button>
      <button class="tree-context-item" id="sctx-icon" onclick="snippetCtxChangeIcon()"><i data-lucide="image"></i> Change Icon</button>
      <button class="tree-context-item" id="sctx-tier" onclick="sctxOpenTierPicker()"><i data-lucide="bar-chart-2"></i> Set Tier</button>
      <button class="tree-context-item" id="sctx-lock" onclick="sctxOpenLockPicker()"><i data-lucide="lock"></i> Set Prerequisites</button>
      <div class="tree-context-divider"></div>
      <button class="tree-context-item danger" id="sctx-delete" onclick="snippetCtxDelete()"><i data-lucide="trash-2"></i> Delete Folder</button>
    </div>

    <div id="examples-modal" class="modal-overlay hidden">
      <div class="modal-content modal-content-lg" style="max-width: 800px; text-align: left;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h2 id="examples-modal-title" class="modal-title" style="margin: 0;">Snippet Examples</h2>
          <button onclick="closeExamplesModal()" class="btn btn-ghost"><i data-lucide="x"></i></button>
        </div>
        <div class="variant-tabs" id="examples-tabs"></div>
        <div id="examples-content" style="min-height: 200px;"></div>
      </div>
    </div>

    <div id="try-coding-modal" class="modal-overlay hidden">
      <div class="modal-content modal-content-lg" style="max-width: 900px; text-align: left; max-height: 90vh; display: flex; flex-direction: column;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h2 id="try-coding-title" class="modal-title" style="margin: 0;"><i data-lucide="terminal" style="width:24px; height:24px; display:inline; vertical-align:middle; margin-right:0.5rem;"></i> Try Coding</h2>
          <button onclick="closeTryCodingModal()" class="btn btn-ghost"><i data-lucide="x"></i></button>
        </div>
        <div id="try-coding-desc" style="font-size: 0.8125rem; color: var(--text-secondary); margin-bottom: 1rem; padding: 0.75rem; background: var(--bg-surface-hover); border-radius: var(--radius-md); border-left: 3px solid var(--color-primary);"></div>
        <div class="editor-container" style="flex: 1; min-height: 280px; max-height: 400px;">
          <pre id="try-coding-pre" class="editor-pre"><code id="try-coding-code"></code></pre>
          <textarea id="try-coding-textarea" spellcheck="false" class="editor-textarea" placeholder="// Type your code here..."></textarea>
        </div>
        <div id="try-coding-result" style="margin-top: 1rem; display: none;"></div>
        <div style="display: flex; gap: 0.75rem; margin-top: 1rem;">
          <button onclick="resetTryCoding()" class="btn btn-secondary" style="flex: 1;"><i data-lucide="rotate-ccw" style="width:16px;height:16px;"></i> Reset</button>
          <button onclick="runSnippetCodeWithPiston()" class="btn btn-secondary" style="flex: 1;"><i data-lucide="play" style="width:16px;height:16px;"></i> Run Code</button>
          <button onclick="checkTryCoding()" class="btn btn-primary" style="flex: 2;"><i data-lucide="check-circle" style="width:16px;height:16px;"></i> Check Code</button>
        </div>
      </div>
    </div>

    <div id="related-challenges-modal" class="modal-overlay hidden">
      <div class="modal-content modal-content-lg" style="max-width: 650px; text-align: left; max-height: 80vh; display: flex; flex-direction: column;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h2 class="modal-title" style="margin: 0;"><i data-lucide="link" style="width:24px; height:24px; display:inline; vertical-align:middle; margin-right:0.5rem;"></i> Related Challenges</h2>
          <button onclick="closeRelatedChallengesModal()" class="btn btn-ghost"><i data-lucide="x"></i></button>
        </div>
        <div class="search-container" style="margin-bottom: 1rem;">
          <i data-lucide="search"></i>
          <input type="text" id="related-search" oninput="renderRelatedChallengesList()" placeholder="Search challenges..." class="search-input">
        </div>
        <div id="related-challenges-list" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem;"></div>
      </div>
    </div>
  `;
}

function snippetsInit() {
  renderSnippetList();

  const targetSnippetId = getSessionParam('activeSnippetId');
  if (targetSnippetId && (state.snippets || []).some(s => s.id === targetSnippetId)) {
    selectSnippet(targetSnippetId);
  } else {
    renderSnippetDetail();
  }

  updateSnippetsHeaderStats();
  checkSharedSnippet();
  // The other two libraries have had a page tour since they were split apart;
  // this one never got one.
  if (typeof GuidedTutorial !== 'undefined' && GuidedTutorial.init) GuidedTutorial.init('snippets');
}

function snippetsDestroy() { }

function updateSnippetsHeaderStats() {
  const snippets = state.snippets || [];
  const total = snippets.length;
  const folders = state.nodes.filter(n => n.scope === 'snippet' && n.type === 'folder').length;

  let due = 0, learning = 0;
  if (typeof _snippetStatus === 'function') {
    snippets.forEach(s => {
      const st = _snippetStatus(s);
      if (st === 'due') due++;
      else if (st === 'learning') learning++;
    });
  }
  const tracked = due + learning;
  const pct = total > 0 ? Math.round((tracked / total) * 100) : 0;

  const headerSub = document.getElementById('snippets-header-stats');
  if (headerSub) {
    headerSub.textContent = `${total} snippet${total !== 1 ? 's' : ''} across ${folders} folder${folders !== 1 ? 's' : ''}`;
  }

  const miniStats = document.getElementById('snippets-mini-stats');
  if (miniStats) {
    miniStats.innerHTML = `
      <div class="mini-stat-chip" data-stat="total" title="Total snippets">
        <i data-lucide="code" style="width:12px;height:12px;"></i>
        <span class="mini-stat-value">${total}</span>
        <span class="mini-stat-label">Total</span>
      </div>
      <div class="mini-stat-chip ${due > 0 ? 'due' : ''}" data-stat="due" title="Snippets due for review">
        <i data-lucide="brain" style="width:12px;height:12px;"></i>
        <span class="mini-stat-value">${due}</span>
        <span class="mini-stat-label">Due</span>
      </div>
      <div class="mini-stat-chip mini-progress-chip" data-stat="progress" title="${tracked} of ${total} in your review rotation">
        <i data-lucide="trending-up" style="width:12px;height:12px;"></i>
        <span class="mini-bar-pct mini-stat-value">${pct}%</span>
        <div class="mini-bar"><div class="mini-bar-fill" style="width:${pct}%;"></div></div>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: miniStats });
  }
}
