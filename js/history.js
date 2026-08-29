/* ============================================================
   HISTORY.JS — Analytics / History Rendering (Dual-Pane)
   ============================================================ */

let activeHistoryChallengeId = null;
let activeHistorySetId = null;
let activeAnalyticsTab = 'training';
let activeNotebookHistoryId = null;
let activeSnippetHistoryId = null;
let _snippetHistoryItemMap = {};
let activeAnalyticsFolderId = null;
let activeAnalyticsFolderScope = null;
let historyDetailPage = 1;
let analyticsFolderPage = 1;   // the card grid in the folder detail view

let _preservedScrollLeft = 0;
let _preservedScrollRight = 0;
let _hasPreservedScroll = false;

window.saveAnalyticsScrollPositions = function() {
  const leftPane = document.querySelector('.pane-1-content');
  const rightPane = document.querySelector('.messenger-pane-2');
  _preservedScrollLeft = leftPane ? leftPane.scrollTop : 0;
  _preservedScrollRight = rightPane ? rightPane.scrollTop : 0;
  _hasPreservedScroll = true;
};

window.restoreAnalyticsScrollPositions = function() {
  if (!_hasPreservedScroll) return;
  const leftPane = document.querySelector('.pane-1-content');
  const rightPane = document.querySelector('.messenger-pane-2');
  if (leftPane) leftPane.scrollTop = _preservedScrollLeft;
  if (rightPane) rightPane.scrollTop = _preservedScrollRight;
};

window.clearAnalyticsScrollPositions = function() {
  _preservedScrollLeft = 0;
  _preservedScrollRight = 0;
  _hasPreservedScroll = false;
};

window.flushActiveAnalyticsState = function() {
  activeHistoryChallengeId = null;
  activeHistorySetId = null;
  activeNotebookHistoryId = null;
  activeSnippetHistoryId = null;
  activeAnalyticsFolderId = null;
  activeAnalyticsFolderScope = null;
  historyDetailPage = 1;

  if (typeof state !== 'undefined' && state && Array.isArray(state.expandedNodes)) {
    state.expandedNodes = state.expandedNodes.filter(key => !key.includes('_analytics_'));
    if (typeof saveData === 'function') {
      saveData();
    }
  }
};

let _analyticsSearchTimer = null;
window.debouncedAnalyticsSearch = function() {
  clearTimeout(_analyticsSearchTimer);
  _analyticsSearchTimer = setTimeout(() => {
    if (activeAnalyticsTab === 'practice') renderCodingAnalytics();
    else if (activeAnalyticsTab === 'training') renderNotesAnalytics();
    else if (activeAnalyticsTab === 'snippets') renderSnippetAnalytics();
  }, 180);
};

let bulkResetMode = false;

let _historySortCol = 'date';
let _historySortDir = 'desc';
let _historyScoreFilter = 'all';

function setHistorySort(col) {
  if (_historySortCol === col) {
    _historySortDir = _historySortDir === 'desc' ? 'asc' : 'desc';
  } else {
    _historySortCol = col;
    _historySortDir = 'desc';
  }
  historyDetailPage = 1;   // re-sorting invalidates the page you were on
  if (activeHistoryChallengeId) renderHistoryDetail(activeHistoryChallengeId);
}

function setHistoryScoreFilter(filter) {
  _historyScoreFilter = filter;
  // Without this, filtering while on (say) page 3 of 25 down to 1 match left the
  // table empty AND hid the pager, so there was no control left to get back.
  historyDetailPage = 1;
  if (activeHistoryChallengeId) renderHistoryDetail(activeHistoryChallengeId);
}

/** Clamp the page to the rows that actually exist — belt and braces. */
function _clampHistoryPage(totalItems, pageSize) {
  const totalPages = Math.max(1, Math.ceil(totalItems / (pageSize || AN_PAGE)));
  if (historyDetailPage > totalPages) historyDetailPage = totalPages;
  if (historyDetailPage < 1) historyDetailPage = 1;
  return historyDetailPage;
}

/**
 * The version label for a history row.
 *
 * Rows store challengeTitle as "<program> - <version>", optionally suffixed with
 * " (Set: <set>)" for practice-set attempts. Splitting on the FIRST " - " broke
 * on any program whose own title contains " - " and dragged the set suffix into
 * the version. Newer entries carry variantName directly.
 */
function _historyVersionLabel(entry) {
  if (entry && entry.variantName) return entry.variantName;
  let t = String((entry && entry.challengeTitle) || '');
  t = t.replace(/\s*\(Set:\s*[^)]*\)\s*$/, '');   // drop the set suffix
  const i = t.lastIndexOf(' - ');
  const v = i === -1 ? '' : t.slice(i + 3).trim();
  return v || '—';
}

function applyHistoryFilters(logs) {
  let filtered = logs;
  if (_historyScoreFilter === 'perfect') filtered = filtered.filter(l => l.score === 100);
  else if (_historyScoreFilter === 'mid') filtered = filtered.filter(l => l.score >= 50 && l.score < 100);
  else if (_historyScoreFilter === 'low') filtered = filtered.filter(l => l.score < 50);

  const sortKey = _historySortCol;
  const dir = _historySortDir === 'asc' ? 1 : -1;
  filtered.sort((a, b) => {
    if (sortKey === 'date') return dir * ((a.startTime || 0) - (b.startTime || 0));
    if (sortKey === 'score') return dir * (a.score - b.score);
    if (sortKey === 'time') return dir * ((a.duration || 0) - (b.duration || 0));
    return 0;
  });

  return filtered;
}

function sortArrow(col) {
  if (_historySortCol !== col) return '';
  return _historySortDir === 'asc' ? ' &#9650;' : ' &#9660;';
}

window.switchAnalyticsTab = function (tab) {
  activeAnalyticsTab = tab;
  bulkResetMode = false;

  // Update toggle group active state + aria-pressed
  const toggleGroup = document.getElementById('analytics-toggles');
  if (toggleGroup) {
    toggleGroup.dataset.active = tab === 'training' ? 'training' : 'practice';
    const trainingBtn = document.getElementById('toggle-training');
    const practiceBtn = document.getElementById('toggle-practice');
    if (trainingBtn) trainingBtn.setAttribute('aria-pressed', String(tab === 'training'));
    if (practiceBtn) practiceBtn.setAttribute('aria-pressed', String(tab === 'practice'));
  }

  activeHistoryChallengeId = null;
  activeHistorySetId = null;
  activeNotebookHistoryId = null;
  activeSnippetHistoryId = null;
  activeAnalyticsFolderId = null;
  activeAnalyticsFolderScope = null;
  historyDetailPage = 1;

  const container = document.getElementById('analytics-detail-container');
  if (container && typeof renderAnalyticsOverview === 'function') {
    // Show the mode-appropriate Performance Overview as the default detail view.
    renderAnalyticsOverview(container);
  } else if (container) {
    container.innerHTML = `<div class="empty-state" style="height: 100%; display: flex; align-items: center; justify-content: center; flex-direction: column;"><i data-lucide="bar-chart-3" style="width: 48px; height: 48px; opacity: 0.5; margin-bottom: 1rem;"></i><h2>Select an item</h2><p style="font-size: 0.875rem; color: var(--text-tertiary); margin-top: 0.5rem;">Choose an item from the left pane to view its practice history.</p></div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: container });
  }

  renderHistory();
};

/** Return the right pane to the default Performance Overview and unfocus any selected attempt. */
function backToAnalyticsOverview() {
  activeHistoryChallengeId = null;
  activeHistorySetId = null;
  activeNotebookHistoryId = null;
  activeSnippetHistoryId = null;
  activeAnalyticsFolderId = null;
  activeAnalyticsFolderScope = null;
  historyDetailPage = 1;
  renderHistory(); // refresh sidebar active state
  const container = document.getElementById('analytics-detail-container');
  if (container && typeof renderAnalyticsOverview === 'function') {
    renderAnalyticsOverview(container);
  }
}
window.backToAnalyticsOverview = backToAnalyticsOverview;

/**
 * A real review queue. This was "the three lowest best-scores": no intervals,
 * no due dates, nothing that decayed — so the same two cards sat there forever
 * under a heading that said SRS. Now every program carries a box (1/3/7/16/35
 * days); scoring 100% promotes it, anything less sends it back to the start.
 */
function renderSRSQueue() {
  if (typeof anSrsDue !== 'function') return '';
  const { queue, dueCount, total } = anSrsDue(3);

  if (!queue.length) {
    return `<div class="empty-state" style="padding: 1rem;"><p>Nothing due. ${total} program${total !== 1 ? 's' : ''} scheduled.</p></div>`;
  }

  const head = `<div class="an-srs-head">${dueCount
    ? `<strong>${dueCount}</strong> due now`
    : 'Nothing overdue — showing what is weakest'}</div>`;

  return head + queue.map(p => {
    const overdue = p.overdueDays;
    const when = overdue >= 0
      ? (overdue === 0 ? 'due today' : overdue + ' day' + (overdue !== 1 ? 's' : '') + ' overdue')
      : 'due in ' + Math.abs(overdue) + ' day' + (Math.abs(overdue) !== 1 ? 's' : '');
    const colour = overdue > 2 ? 'var(--color-danger)' : overdue >= 0 ? 'var(--color-warning)' : 'var(--color-primary)';
    return `
      <div class="card an-srs-card" style="border-left: 4px solid ${colour};">
        <div class="an-srs-top">
          <h3>${escapeHTML(p.title)}</h3>
          <span class="an-srs-box" title="Review interval step ${p.box + 1} of 5">${'●'.repeat(Math.max(1, p.box + 1))}</span>
        </div>
        <p class="an-srs-meta">
          Best <span style="color:${p.best === 100 ? 'var(--color-success)' : 'var(--color-warning)'};font-weight:700;">${p.best}%</span>
          · ${p.attempts.length} attempt${p.attempts.length !== 1 ? 's' : ''}
          · <span style="color:${colour};">${when}</span>
        </p>
        <div class="an-srs-actions">
          <button onclick="promptTimer('${p.id}')" class="btn btn-secondary btn-sm">
            <i data-lucide="refresh-cw" style="width:14px;height:14px;"></i> Review Now
          </button>
          <button onclick="anOpenReview('${p.id}')" class="btn btn-ghost btn-sm" title="See your attempt beside the solution">
            <i data-lucide="git-compare" style="width:14px;height:14px;"></i> Compare
          </button>
        </div>
      </div>`;
  }).join('');
}

function renderBadges() {
  // Criteria and progress, not bare strings — "Night Owl" said nothing about
  // how it was earned or what was next.
  if (typeof anBadgesHTML === 'function') return anBadgesHTML();
  if (!state.badges || state.badges.length === 0) return '';
  return `
    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
      ${state.badges.map(b => `
        <div style="background: var(--color-primary-subtle); color: var(--color-primary); padding: 0.5rem 0.75rem; border-radius: var(--radius-md); border: 1px solid rgba(99, 102, 241, 0.2); display: flex; align-items: center; gap: 0.375rem; font-weight: 700; font-size: 0.8125rem;">
          <i data-lucide="award" style="width: 16px; height: 16px;"></i> ${escapeHTML(b)}
        </div>
      `).join('')}
    </div>
  `;
}

// Recursive tree rendering for history overview (reusing the Browse tree structure)
function renderAnalyticsTreeRecursive(parentId, scope, depth, query) {
  const folders = getChildFolders(parentId, scope);
  let html = '';

  folders.forEach(folder => {
    // Only show folders that have history somewhere inside them and match search if active
    if (query) {
      if (!folderHasMatchingHistory(folder.id, scope, query)) return;
    } else {
      if (!folderHasHistory(folder.id, scope)) return;
    }

    // Use a specific suffix for analytics expansion state to keep it distinct
    const expandedKey = folder.id + '_analytics_' + scope;
    const expanded = isNodeExpanded(expandedKey) || !!query;
    const indent = depth * 0.75;
    const chevronClass = (expanded ? 'expanded' : '');
    const isActive = activeAnalyticsFolderId === folder.id && activeAnalyticsFolderScope === scope;

    html += `
      <div class="tree-node" data-level="${depth}" data-node-id="${folder.id}">
        <div class="tree-node-row ${isActive ? 'active' : ''}" 
             data-node-id="${folder.id}"
             style="padding-left: calc(0.75rem + ${indent}rem)"
             onclick="selectAnalyticsFolder('${folder.id}', '${scope}')">
          <i data-lucide="chevron-right" 
             class="tree-node-chevron ${chevronClass}"
             onclick="toggleAnalyticsExpand('${folder.id}', '${scope}', event)"></i>
          <i data-lucide="${folder.icon || 'folder'}" class="tree-node-icon folder-icon-color"></i>
          <span class="tree-node-label">${escapeHTML(folder.name)}</span>
          <span class="tree-node-badge">${countItemsWithHistory(folder.id, scope)}</span>
        </div>
        <div class="tree-children ${expanded ? '' : 'collapsed'}">
          <div class="tree-children-inner">
            ${renderAnalyticsTreeRecursive(folder.id, scope, depth + 1, query)}
          </div>
        </div>
      </div>
    `;
  });

  // Render items in this folder that have history
  const items = getItemsInFolder(parentId, scope);
  items.forEach(item => {
    const logs = scope === 'challenge'
      ? (_historyItemMap[item.id] || [])
      : (scope === 'notebook' ? (_notebookHistoryItemMap[item.id] || []) : (_snippetHistoryItemMap[item.id] || []));

    if (logs.length > 0) {
      if (query) {
        const title = scope === 'challenge'
          ? item.title
          : (scope === 'notebook' ? (item.title || logs[0].notebookTitle || 'Unknown Notebook') : (item.title || logs[0].snippetTitle || 'Unknown Snippet'));
        if (!title.toLowerCase().includes(query)) return;
      }
      html += renderAnalyticsTreeItem(item, logs, scope, depth);
    }
  });

  // Render practice sets in this folder that have history
  if (scope === 'challenge') {
    const sets = getSetsInFolder(parentId);
    sets.forEach(set => {
      const setLogs = getHistoryForSet(set.id);
      if (setLogs.length > 0) {
        if (query) {
          if (!set.title.toLowerCase().includes(query)) return;
        }
        html += renderAnalyticsTreeSetItem(set, setLogs, depth);
      }
    });
  }

  return html;
}

let _historyItemMap = {};
let _notebookHistoryItemMap = {};
let _folderHasHistoryMemo = {};

function countItemsWithHistory(folderId, scope) {
  let count = 0;
  const items = getItemsInFolder(folderId, scope);
  items.forEach(item => {
    const logs = scope === 'challenge'
      ? (_historyItemMap[item.id] || [])
      : (scope === 'notebook' ? (_notebookHistoryItemMap[item.id] || []) : (_snippetHistoryItemMap[item.id] || []));
    if (logs.length > 0) count++;
  });
  
  if (scope === 'challenge') {
    const sets = getSetsInFolder(folderId);
    sets.forEach(set => {
      if (getHistoryForSet(set.id).length > 0) count++;
    });
  }
  
  const childFolders = getChildFolders(folderId, scope);
  childFolders.forEach(cf => {
    count += countItemsWithHistory(cf.id, scope);
  });
  return count;
}

function folderHasHistory(folderId, scope) {
  const memoKey = folderId + '_' + scope;
  if (_folderHasHistoryMemo[memoKey] !== undefined) return _folderHasHistoryMemo[memoKey];

  const items = getItemsInFolder(folderId, scope);
  let hasDirect = items.some(item => {
    if (scope === 'challenge') return !!_historyItemMap[item.id];
    if (scope === 'notebook') return !!_notebookHistoryItemMap[item.id];
    if (scope === 'snippet') return !!_snippetHistoryItemMap[item.id];
    return false;
  });
  if (!hasDirect && scope === 'challenge') {
    const sets = getSetsInFolder(folderId);
    hasDirect = sets.some(set => getHistoryForSet(set.id).length > 0);
  }
  if (hasDirect) {
    _folderHasHistoryMemo[memoKey] = true;
    return true;
  }
  const childFolders = getChildFolders(folderId, scope);
  const hasChild = childFolders.some(cf => folderHasHistory(cf.id, scope));
  _folderHasHistoryMemo[memoKey] = hasChild;
  return hasChild;
}

function folderHasMatchingHistory(folderId, scope, query) {
  const items = getItemsInFolder(folderId, scope);
  const hasDirect = items.some(item => {
    const logs = scope === 'challenge'
      ? (_historyItemMap[item.id] || [])
      : (scope === 'notebook' ? (_notebookHistoryItemMap[item.id] || []) : (_snippetHistoryItemMap[item.id] || []));
    if (logs.length === 0) return false;
    const title = scope === 'challenge'
      ? item.title
      : (scope === 'notebook' ? (item.title || logs[0].notebookTitle || 'Unknown Notebook') : (item.title || logs[0].snippetTitle || 'Unknown Snippet'));
    return title.toLowerCase().includes(query);
  });
  if (hasDirect) return true;

  if (scope === 'challenge') {
    const sets = getSetsInFolder(folderId);
    const hasSetMatch = sets.some(set => {
      const setLogs = getHistoryForSet(set.id);
      if (setLogs.length === 0) return false;
      return set.title.toLowerCase().includes(query);
    });
    if (hasSetMatch) return true;
  }

  const childFolders = getChildFolders(folderId, scope);
  return childFolders.some(cf => folderHasMatchingHistory(cf.id, scope, query));
}

function renderAnalyticsTreeItem(item, logs, scope, depth) {
  const bestScore = scope === 'challenge'
    ? Math.max(...logs.map(l => l.score))
    : (scope === 'notebook' ? getBestNotebookScore(logs) : Math.max(...logs.map(l => l.score)));
  const completions = scope === 'challenge'
    ? logs.filter(l => l.score === 100).length
    : (scope === 'notebook'
        ? logs.filter(l => l.score === 100 || l.progress === 100).length
        : logs.filter(l => l.score === 100).length);
  
  const isActive = scope === 'challenge'
    ? activeHistoryChallengeId === item.id
    : (scope === 'notebook' ? activeNotebookHistoryId === item.id : activeSnippetHistoryId === item.id);
  const onClick = bulkResetMode ? '' : (scope === 'challenge' ? `showHistoryDetail('${item.id}')` : (scope === 'notebook' ? `showNotebookHistoryDetail('${item.id}')` : `showSnippetHistoryDetail('${item.id}')`));
  const title = scope === 'challenge'
    ? item.title
    : (scope === 'notebook' ? (item.title || logs[0].notebookTitle || 'Unknown Notebook') : (item.title || logs[0].snippetTitle || 'Unknown Snippet'));

  const completionBadge = completions > 1 ? `<span style="font-size:0.65rem; color:var(--color-primary); background:rgba(59,130,246,0.1); padding:2px 6px; border-radius:12px; margin-right:0.5rem; font-weight:700;">${completions}x Completed</span>` : '';
  const indent = (depth + 1) * 0.75;
  const itemIcon = scope === 'challenge' ? 'file-code' : (scope === 'notebook' ? 'book' : 'code');

  return `<div class="tree-node tree-item-node ${isActive ? 'active' : ''} ${bulkResetMode ? 'bulk-mode' : ''}" data-level="${depth + 1}" data-node-id="${item.id}">
      <div class="tree-node-row ${isActive ? 'active' : ''}"
           data-node-id="${item.id}"
           style="padding-left: calc(0.75rem + ${indent}rem)"
           onclick="${onClick}">
        <i class="tree-node-chevron invisible"></i>
        ${bulkResetMode ? `<input type="checkbox" class="bulk-reset-cb" value="${item.id}" style="width:14px;height:14px;accent-color:var(--color-danger);cursor:pointer;margin-right:0.375rem;">` : ''}
        <i data-lucide="${itemIcon}" class="tree-node-icon item-icon-color" style="width:14px;height:14px;"></i>
        <span class="tree-node-label" style="font-weight:400; font-size:0.875rem; flex:1;">${escapeHTML(title)}</span>
        <div style="display:flex; align-items:center; flex-shrink:0;">
          ${completionBadge}
          <span class="score-badge ${bestScore === 100 ? 'score-perfect' : 'score-partial'}" style="font-size:0.65rem;">${bestScore}%</span>
        </div>
      </div>
    </div>`;
}

function renderAnalyticsTreeSetItem(set, logs, depth) {
  const attempts = groupSetAttempts(logs);
  if (attempts.length === 0) return '';
  const bestScore = Math.max(...attempts.map(a => a.score));
  const completions = attempts.filter(a => a.score === 100).length;
  
  const isActive = activeHistorySetId === set.id;
  const onClick = bulkResetMode ? '' : `showSetHistoryDetail('${set.id}')`;
  const title = set.title || 'Untitled Practice Set';

  const completionBadge = completions > 1 ? `<span style="font-size:0.65rem; color:var(--color-primary); background:rgba(59,130,246,0.1); padding:2px 6px; border-radius:12px; margin-right:0.5rem; font-weight:700;">${completions}x Completed</span>` : '';
  const indent = (depth + 1) * 0.75;

  return `<div class="tree-node tree-item-node ${isActive ? 'active' : ''} ${bulkResetMode ? 'bulk-mode' : ''}" data-level="${depth + 1}" data-node-id="${set.id}">
      <div class="tree-node-row ${isActive ? 'active' : ''}"
           data-node-id="${set.id}"
           style="padding-left: calc(0.75rem + ${indent}rem)"
           onclick="${onClick}">
        <i class="tree-node-chevron invisible"></i>
        ${bulkResetMode ? `<input type="checkbox" class="bulk-reset-cb" value="${set.id}" style="width:14px;height:14px;accent-color:var(--color-danger);cursor:pointer;margin-right:0.375rem;">` : ''}
        <i data-lucide="layout-grid" class="tree-node-icon" style="width:14px;height:14px;color:var(--color-accent);"></i>
        <span class="tree-node-label" style="font-weight:400; font-size:0.875rem; flex:1;">${escapeHTML(title)}</span>
        <div style="display:flex; align-items:center; flex-shrink:0;">
          ${completionBadge}
          <span class="score-badge ${bestScore === 100 ? 'score-perfect' : 'score-partial'}" style="font-size:0.65rem;">${bestScore}%</span>
        </div>
      </div>
    </div>`;
}

function getBestNotebookScore(logs) {
  let best = 0;
  logs.forEach(l => {
    let c = 0, q = 0;
    if (l.sections) l.sections.forEach(s => { c += (s.correct || 0); q += (s.total || 0); });
    let pct = q > 0 ? Math.round((c / q) * 100) : 0;
    if (pct > best) best = pct;
  });
  return best;
}

function renderHistory() {
  let containerId = 'analytics-sidebar-content';
  let scope = 'challenge';
  if (activeAnalyticsTab === 'practice') { containerId = 'analytics-coding-sidebar-content'; scope = 'challenge'; }
  else if (activeAnalyticsTab === 'training') { containerId = 'analytics-notes-sidebar-content'; scope = 'notebook'; }
  else if (activeAnalyticsTab === 'snippets') { containerId = 'analytics-snippets-sidebar-content'; scope = 'snippet'; }

  const container = document.getElementById(containerId);
  if (!container) return;

  const isHidden = localStorage.getItem('analyticsHideItems') === 'true';
  container.classList.toggle('hide-tree-items', isHidden);

  const searchInput = document.getElementById('analytics-search');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  _historyItemMap = {};
  state.history.forEach(h => {
    if (!_historyItemMap[h.challengeId]) _historyItemMap[h.challengeId] = [];
    _historyItemMap[h.challengeId].push(h);
  });
  
  _notebookHistoryItemMap = {};
  if (state.notebookHistory) {
    state.notebookHistory.forEach(h => {
      if (!_notebookHistoryItemMap[h.notebookId]) _notebookHistoryItemMap[h.notebookId] = [];
      _notebookHistoryItemMap[h.notebookId].push(h);
    });
  }

  _snippetHistoryItemMap = {};
  if (state.snippetHistory) {
    state.snippetHistory.forEach(h => {
      if (!_snippetHistoryItemMap[h.snippetId]) _snippetHistoryItemMap[h.snippetId] = [];
      _snippetHistoryItemMap[h.snippetId].push(h);
    });
  }
  
  _folderHasHistoryMemo = {};

  let sidebarHTML = '';

  if (activeAnalyticsTab === 'practice') {
    if (state.badges && state.badges.length > 0) {
      sidebarHTML += `<div style="margin-bottom: 0.5rem;"><div class="analytics-section-label"><i data-lucide="award" style="width:14px;height:14px;"></i> Achievement Badges</div>${renderBadges()}</div>`;
    }

    sidebarHTML += `<div style="margin-bottom: 0.5rem;"><div class="analytics-section-label" style="color: var(--color-warning);"><i data-lucide="brain" style="width:14px;height:14px;"></i> Daily Review (SRS)</div><p style="font-size: 0.75rem; color: var(--text-tertiary); margin-bottom: 0.75rem;">Challenges you scored lowest on.</p>${renderSRSQueue()}</div>`;

    sidebarHTML += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
      <div class="analytics-section-label"><i data-lucide="folder" style="width:14px;height:14px;"></i> Full History</div>
      <button onclick="toggleBulkResetMode()" class="btn btn-ghost btn-sm" style="font-size:0.7rem; padding:0.25rem 0.5rem; color:${bulkResetMode ? 'var(--color-danger)' : 'var(--text-tertiary)'};">
        <i data-lucide="${bulkResetMode ? 'x' : 'trash-2'}" style="width:12px;height:12px;"></i> ${bulkResetMode ? 'Cancel' : 'Bulk Reset'}
      </button>
    </div>`;
    
    if (bulkResetMode) {
      sidebarHTML += `<div style="margin-bottom:1rem; padding:0.75rem; background:rgba(239, 68, 68, 0.1); border-radius:var(--radius-md); border:1px solid rgba(239, 68, 68, 0.2);">
        <p style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:0.5rem;">Select items below to completely wipe their history.</p>
        <div style="display:flex; gap:0.5rem;">
          <button onclick="selectAllBulkReset()" class="btn btn-secondary btn-sm" style="flex:1;">Select All</button>
          <button onclick="executeBulkReset()" class="btn btn-danger btn-sm" style="flex:1;"><i data-lucide="trash-2" style="width:14px;height:14px;"></i> Delete</button>
        </div>
      </div>`;
    }

    sidebarHTML += `<div class="tree-children-inner">`;
    sidebarHTML += renderAnalyticsTreeRecursive(null, 'challenge', 0, query);

    // Uncategorized challenges/sets
    const rootChallenges = state.challenges.filter(c => !c.parentId);
    const rootSets = (state.codingSets || []).filter(s => !s.parentId);
    
    let filteredOrphanCount = 0;
    rootChallenges.forEach(c => {
      const logs = _historyItemMap[c.id] || [];
      if (logs.length > 0) {
        if (!query || c.title.toLowerCase().includes(query)) {
          filteredOrphanCount++;
        }
      }
    });
    rootSets.forEach(s => {
      if (getHistoryForSet(s.id).length > 0) {
        if (!query || s.title.toLowerCase().includes(query)) {
          filteredOrphanCount++;
        }
      }
    });

    if (filteredOrphanCount > 0) {
      const activeUncategorizedKey = '__root__analytics_challenge';
      const expanded = isNodeExpanded(activeUncategorizedKey) || !!query;
      const isActive = activeAnalyticsFolderId === '__root__' && activeAnalyticsFolderScope === 'challenge';
      sidebarHTML += `
        <div class="tree-node" data-level="0" data-node-id="__root__">
          <div class="tree-node-row ${isActive ? 'active' : ''}" style="padding-left: 0.75rem;" onclick="selectAnalyticsFolder('__root__', 'challenge')">
            <i data-lucide="chevron-right" class="tree-node-chevron ${expanded ? 'expanded' : ''}" onclick="toggleAnalyticsExpand('__root__', 'challenge', event)"></i>
            <i data-lucide="inbox" class="tree-node-icon item-icon-color"></i>
            <span class="tree-node-label">Uncategorized</span>
            <span class="tree-node-badge">${filteredOrphanCount}</span>
          </div>
          <div class="tree-children ${expanded ? '' : 'collapsed'}">
            <div class="tree-children-inner">
      `;
      rootChallenges.forEach(c => {
        const logs = _historyItemMap[c.id] || [];
        if (logs.length > 0) {
          if (!query || c.title.toLowerCase().includes(query)) {
            sidebarHTML += renderAnalyticsTreeItem(c, logs, 'challenge', 0);
          }
        }
      });
      rootSets.forEach(set => {
        const setLogs = getHistoryForSet(set.id);
        if (setLogs.length > 0) {
          if (!query || set.title.toLowerCase().includes(query)) {
            sidebarHTML += renderAnalyticsTreeSetItem(set, setLogs, 0);
          }
        }
      });
      sidebarHTML += `
            </div>
          </div>
        </div>
      `;
    }
    sidebarHTML += `</div>`;

    if (state.history.length === 0) {
      sidebarHTML += '<div class="empty-state" style="padding: 1rem;"><p>No history entries yet. Start practicing!</p></div>';
    }
  } else if (activeAnalyticsTab === 'training') {
    sidebarHTML += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
      <div class="analytics-section-label"><i data-lucide="book" style="width:14px;height:14px;"></i> Notebook History</div>
      <button onclick="toggleBulkResetMode()" class="btn btn-ghost btn-sm" style="font-size:0.7rem; padding:0.25rem 0.5rem; color:${bulkResetMode ? 'var(--color-danger)' : 'var(--text-tertiary)'};">
        <i data-lucide="${bulkResetMode ? 'x' : 'trash-2'}" style="width:12px;height:12px;"></i> ${bulkResetMode ? 'Cancel' : 'Bulk Reset'}
      </button>
    </div>`;
    
    if (bulkResetMode && state.notebookHistory && state.notebookHistory.length > 0) {
      sidebarHTML += `<div style="margin-bottom:1rem; padding:0.75rem; background:rgba(239, 68, 68, 0.1); border-radius:var(--radius-md); border:1px solid rgba(239, 68, 68, 0.2);">
        <p style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:0.5rem;">Select notebooks below to completely wipe their history.</p>
        <div style="display:flex; gap:0.5rem;">
          <button onclick="selectAllBulkReset()" class="btn btn-secondary btn-sm" style="flex:1;">Select All</button>
          <button onclick="executeBulkReset()" class="btn btn-danger btn-sm" style="flex:1;"><i data-lucide="trash-2" style="width:14px;height:14px;"></i> Delete</button>
        </div>
      </div>`;
    }

    sidebarHTML += `<div class="tree-children-inner">`;

    if (!state.notebookHistory || state.notebookHistory.length === 0) {
      sidebarHTML += '<div class="empty-state" style="padding: 1rem;"><p>No notebook attempts yet. Go to Notes Library and start a session!</p></div>';
    } else {
      sidebarHTML += renderAnalyticsTreeRecursive(null, 'notebook', 0, query);

      // Uncategorized notebooks
      const rootNotebooks = state.notebooks.filter(n => !n.parentId);
      let filteredOrphanNotebooksCount = 0;
      rootNotebooks.forEach(n => {
        const logs = _notebookHistoryItemMap[n.id] || [];
        if (logs.length > 0) {
          const title = n.title || logs[0].notebookTitle || 'Unknown Notebook';
          if (!query || title.toLowerCase().includes(query)) {
            filteredOrphanNotebooksCount++;
          }
        }
      });

      if (filteredOrphanNotebooksCount > 0) {
        const activeUncategorizedKey = '__root__analytics_notebook';
        const expanded = isNodeExpanded(activeUncategorizedKey) || !!query;
        const isActive = activeAnalyticsFolderId === '__root__' && activeAnalyticsFolderScope === 'notebook';
        sidebarHTML += `
          <div class="tree-node" data-level="0" data-node-id="__root__">
            <div class="tree-node-row ${isActive ? 'active' : ''}" style="padding-left: 0.75rem;" onclick="selectAnalyticsFolder('__root__', 'notebook')">
              <i data-lucide="chevron-right" class="tree-node-chevron ${expanded ? 'expanded' : ''}" onclick="toggleAnalyticsExpand('__root__', 'notebook', event)"></i>
              <i data-lucide="inbox" class="tree-node-icon item-icon-color"></i>
              <span class="tree-node-label">Uncategorized</span>
              <span class="tree-node-badge">${filteredOrphanNotebooksCount}</span>
            </div>
            <div class="tree-children ${expanded ? '' : 'collapsed'}">
              <div class="tree-children-inner">
        `;
        rootNotebooks.forEach(n => {
          const logs = _notebookHistoryItemMap[n.id] || [];
          if (logs.length > 0) {
            const title = n.title || logs[0].notebookTitle || 'Unknown Notebook';
            if (!query || title.toLowerCase().includes(query)) {
              sidebarHTML += renderAnalyticsTreeItem(n, logs, 'notebook', 0);
            }
          }
        });
        sidebarHTML += `
              </div>
            </div>
          </div>
        `;
      }
    }
    sidebarHTML += `</div>`;
  } else if (activeAnalyticsTab === 'snippets') {
    sidebarHTML += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
      <div class="analytics-section-label"><i data-lucide="code" style="width:14px;height:14px;"></i> Snippet History</div>
      <button onclick="toggleBulkResetMode()" class="btn btn-ghost btn-sm" style="font-size:0.7rem; padding:0.25rem 0.5rem; color:${bulkResetMode ? 'var(--color-danger)' : 'var(--text-tertiary)'};">
        <i data-lucide="${bulkResetMode ? 'x' : 'trash-2'}" style="width:12px;height:12px;"></i> ${bulkResetMode ? 'Cancel' : 'Bulk Reset'}
      </button>
    </div>`;
    
    const snippetHistory = state.snippetHistory || [];
    if (bulkResetMode && snippetHistory.length > 0) {
      sidebarHTML += `<div style="margin-bottom:1rem; padding:0.75rem; background:rgba(239, 68, 68, 0.1); border-radius:var(--radius-md); border:1px solid rgba(239, 68, 68, 0.2);">
        <p style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:0.5rem;">Select snippets below to completely wipe their history.</p>
        <div style="display:flex; gap:0.5rem;">
          <button onclick="selectAllBulkReset()" class="btn btn-secondary btn-sm" style="flex:1;">Select All</button>
          <button onclick="executeBulkReset()" class="btn btn-danger btn-sm" style="flex:1;"><i data-lucide="trash-2" style="width:14px;height:14px;"></i> Delete</button>
        </div>
      </div>`;
    }

    sidebarHTML += `<div class="tree-children-inner">`;

    if (snippetHistory.length === 0) {
      sidebarHTML += '<div class="empty-state" style="padding: 1rem;"><p>No snippet attempts yet. Go to Snippet Library and check some code!</p></div>';
    } else {
      sidebarHTML += renderAnalyticsTreeRecursive(null, 'snippet', 0, query);

      // Uncategorized snippets
      const rootSnippets = state.snippets.filter(s => !s.parentId);
      let filteredOrphanSnippetsCount = 0;
      rootSnippets.forEach(s => {
        const logs = _snippetHistoryItemMap[s.id] || [];
        if (logs.length > 0) {
          const title = s.title || logs[0].snippetTitle || 'Unknown Snippet';
          if (!query || title.toLowerCase().includes(query)) {
            filteredOrphanSnippetsCount++;
          }
        }
      });

      if (filteredOrphanSnippetsCount > 0) {
        const activeUncategorizedKey = '__root__analytics_snippet';
        const expanded = isNodeExpanded(activeUncategorizedKey) || !!query;
        const isActive = activeAnalyticsFolderId === '__root__' && activeAnalyticsFolderScope === 'snippet';
        sidebarHTML += `
          <div class="tree-node" data-level="0" data-node-id="__root__">
            <div class="tree-node-row ${isActive ? 'active' : ''}" style="padding-left: 0.75rem;" onclick="selectAnalyticsFolder('__root__', 'snippet')">
              <i data-lucide="chevron-right" class="tree-node-chevron ${expanded ? 'expanded' : ''}" onclick="toggleAnalyticsExpand('__root__', 'snippet', event)"></i>
              <i data-lucide="inbox" class="tree-node-icon item-icon-color"></i>
              <span class="tree-node-label">Uncategorized</span>
              <span class="tree-node-badge">${filteredOrphanSnippetsCount}</span>
            </div>
            <div class="tree-children ${expanded ? '' : 'collapsed'}">
              <div class="tree-children-inner">
        `;
        rootSnippets.forEach(s => {
          const logs = _snippetHistoryItemMap[s.id] || [];
          if (logs.length > 0) {
            const title = s.title || logs[0].snippetTitle || 'Unknown Snippet';
            if (!query || title.toLowerCase().includes(query)) {
              sidebarHTML += renderAnalyticsTreeItem(s, logs, 'snippet', 0);
            }
          }
        });
        sidebarHTML += `
              </div>
            </div>
          </div>
        `;
      }
    }
    sidebarHTML += `</div>`;
  }

  container.innerHTML = sidebarHTML;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: container });
  // (The old updateAnalyticsSummary() call was removed — it targeted ids that
  // don't exist. Each renderXAnalytics() calls updateAnalyticsSubSummary(type).)
}

function showHistoryDetail(challengeId) {
  activeHistoryChallengeId = challengeId;
  activeHistorySetId = null;
  activeAnalyticsFolderId = null;
  activeAnalyticsFolderScope = null;
  historyDetailPage = 1;
  renderHistory(); // Re-render sidebar to update active state
  renderHistoryDetail(challengeId);
}

function backToHistoryOverview() {
  // Return to the (mode-aware) Performance Overview rather than a dead-end empty state.
  backToAnalyticsOverview();
}

// Bind globally for checkbox actions
window.toggleAllBulk = function (source) {
  const cbs = document.querySelectorAll('.bulk-history-cb');
  cbs.forEach(cb => cb.checked = source.checked);
};

function renderHistoryDetail(challengeId) {
  const challenge = state.challenges.find(c => c.id === challengeId);
  if (!challenge) return;

  const container = document.getElementById('analytics-detail-container');
  if (!container) return;   // called off-route (e.g. a stray sort/filter) — nothing to draw
  // Sorted newest-first explicitly: state.history is usually in that order via
  // unshift, but undoing a history deletion pushes entries back onto the END, so
  // the "recent 10" chart and the trend badge below can't just trust insertion order.
  const logs = state.history
    .filter(h => h.challengeId === challengeId)
    .sort((a, b) => (b.submitTime || b.startTime || 0) - (a.submitTime || a.startTime || 0));

  if (logs.length === 0) {
    container.innerHTML = `
      <div style="padding: 2rem;">
        <button onclick="backToHistoryOverview()" class="btn btn-ghost" style="margin-bottom:1.5rem; color:var(--text-secondary);" id="back-to-overview-btn">
          <i data-lucide="chevron-left" style="width:18px;height:18px;"></i> Back to Categories
        </button>
        <div class="empty-state" style="border:2px dashed var(--border-color); border-radius:var(--radius-lg); background:var(--bg-surface);">
          <i data-lucide="history"></i>
          <h2>No History Yet</h2>
          <p>You haven't practiced this program yet.</p>
        </div>
      </div>
    `;
  } else {
    const filteredLogs = applyHistoryFilters([...logs]);
    const bestScore = Math.max(...logs.map(l => l.score));
    const totalAttempts = logs.length;
    const avgScore = Math.round(logs.reduce((sum, l) => sum + l.score, 0) / totalAttempts);
    const totalTime = logs.reduce((sum, l) => sum + (l.duration || 0), 0);

    // Resolve category name from parentId
    const parentFolder = state.nodes.find(n => n.id === challenge.parentId);
    const catName = parentFolder ? parentFolder.name : 'Uncategorized';

    // Build Score Over Time chart series for _ac_trendSvg (most recent 10, chronological)
    const chartSeries = logs.slice(0, 10).reverse().map((l, i) => ({
      x: i, score: Math.max(0, Math.min(100, l.score)),
      label: l.date || '#' + (i + 1)
    }));

    // Determine improvement trend
    const recentScores = logs.slice(0, 5).map(l => l.score);
    const olderScores = logs.slice(5, 10).map(l => l.score);
    const recentAvg = recentScores.length > 0 ? recentScores.reduce((a,b)=>a+b,0)/recentScores.length : 0;
    const olderAvg = olderScores.length > 0 ? olderScores.reduce((a,b)=>a+b,0)/olderScores.length : recentAvg;
    const trend = recentAvg > olderAvg ? 'up' : recentAvg < olderAvg ? 'down' : 'flat';
    const trendIcon = trend === 'up' ? 'trending-up' : trend === 'down' ? 'trending-down' : 'minus';
    const trendColor = trend === 'up' ? 'var(--color-success)' : trend === 'down' ? 'var(--color-danger)' : 'var(--text-tertiary)';

    container.innerHTML = `
      <div style="padding: 2rem;" class="animate-fade-in">
        <button onclick="backToAnalyticsOverview()" class="btn btn-ghost" style="margin-bottom:1.25rem; color:var(--text-secondary);">
          <i data-lucide="chevron-left" style="width:18px;height:18px;"></i> Back to overview
        </button>
        <div class="analytics-detail-header">
          <div>
            <h2 class="analytics-detail-title">${escapeHTML(challenge.title)}</h2>
            <p class="analytics-detail-category">
              <i data-lucide="folder" style="width:13px;height:13px;"></i> ${escapeHTML(catName)}
              <span class="analytics-trend-badge" style="color:${trendColor};">
                <i data-lucide="${trendIcon}" style="width:13px;height:13px;"></i> ${trend === 'up' ? 'Improving' : trend === 'down' ? 'Declining' : 'Steady'}
              </span>
            </p>
          </div>
          <div class="analytics-score-ring-lg" title="Best Score: ${bestScore}%">
            <svg viewBox="0 0 36 36">
              <path class="score-ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
              <path class="score-ring-fill ${bestScore === 100 ? 'perfect' : ''}" stroke-dasharray="${bestScore}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
            </svg>
            <span class="score-ring-text">${bestScore}%</span>
          </div>
        </div>

        <div class="analytics-stat-grid">
          <div class="analytics-stat-card-enhanced" style="--stat-accent: var(--color-success);">
            <div class="stat-card-icon"><i data-lucide="trophy" style="width:18px;height:18px;"></i></div>
            <div class="analytics-stat-value" style="color:var(--color-success);">${bestScore}%</div>
            <div class="analytics-stat-label">Best Score</div>
          </div>
          <div class="analytics-stat-card-enhanced" style="--stat-accent: var(--color-primary);">
            <div class="stat-card-icon"><i data-lucide="calculator" style="width:18px;height:18px;"></i></div>
            <div class="analytics-stat-value">${avgScore}%</div>
            <div class="analytics-stat-label">Avg Score</div>
          </div>
          <div class="analytics-stat-card-enhanced" style="--stat-accent: var(--color-accent);">
            <div class="stat-card-icon"><i data-lucide="repeat" style="width:18px;height:18px;"></i></div>
            <div class="analytics-stat-value">${totalAttempts}</div>
            <div class="analytics-stat-label">Attempts</div>
          </div>
          <div class="analytics-stat-card-enhanced" style="--stat-accent: var(--color-warning);">
            <div class="stat-card-icon"><i data-lucide="timer" style="width:18px;height:18px;"></i></div>
            <div class="analytics-stat-value">${formatTimeDisplay(totalTime)}</div>
            <div class="analytics-stat-label">Total Time</div>
          </div>
        </div>

        ${logs.length >= 2 ? `
        <div class="ac-card">
          <div class="ac-card-title">Score over time</div>
          ${_ac_trendSvg(chartSeries)}
        </div>` : ''}

        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem;">
          <div class="history-filter-bar">
            <select onchange="setHistoryScoreFilter(this.value)" class="form-select" style="font-size:0.75rem; padding:0.25rem 0.5rem; width:auto;">
              <option value="all" ${_historyScoreFilter === 'all' ? 'selected' : ''}>All Scores</option>
              <option value="perfect" ${_historyScoreFilter === 'perfect' ? 'selected' : ''}>100% Only</option>
              <option value="mid" ${_historyScoreFilter === 'mid' ? 'selected' : ''}>50-99%</option>
              <option value="low" ${_historyScoreFilter === 'low' ? 'selected' : ''}>&lt;50%</option>
            </select>
          </div>
          <div style="display:flex; gap:0.5rem;">
            <button onclick="document.getElementById('history-table').classList.toggle('show-bulk-actions')" class="btn btn-secondary btn-sm" id="toggle-bulk-btn">
              <i data-lucide="check-square" style="width:16px;height:16px;"></i> Toggle Bulk Actions
            </button>
            <button onclick="bulkDeleteSelected('${challengeId}')" class="btn btn-danger btn-sm bulk-delete-btn" id="bulk-delete-btn" style="display:none;">
              <i data-lucide="trash-2" style="width:16px;height:16px;"></i> Delete Selected
            </button>
          </div>
        </div>

        <div class="table-container">
          <table class="table" id="history-table">
            <thead>
              <tr>
                <th class="bulk-checkbox-col" style="padding-right:0;"><input type="checkbox" onclick="toggleAllBulk(this)"></th>
                <th class="sortable-th" onclick="setHistorySort('date')">Date${sortArrow('date')}</th>
                <th>Version</th>
                <th class="sortable-th" onclick="setHistorySort('score')">Score${sortArrow('score')}</th>
                <th class="sortable-th" onclick="setHistorySort('time')" style="text-align:right;">Time${sortArrow('time')}</th>
                <th style="text-align:center;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${(() => {
                const avgDuration = logs.reduce((s, l) => s + (l.duration || 0), 0) / (logs.length || 1);
                let currentCompletion = filteredLogs.filter(l => l.score === 100).length;
                const pageSize = AN_PAGE;
                const pageStart = (_clampHistoryPage(filteredLogs.length, pageSize) - 1) * pageSize;

                return filteredLogs.map((entry, idx) => {
                  let compLabel = '';
                  if (entry.score === 100) {
                    if (currentCompletion > 1) compLabel = `<span style="font-size:0.6rem; opacity:0.8; margin-left:4px;">(#${currentCompletion})</span>`;
                    currentCompletion--;
                  }
                  if (idx < pageStart || idx >= pageStart + pageSize) return '';

                  const entryIndex = logs.indexOf(entry);
                  const prevEntry = logs[entryIndex + 1];
                  let trendHTML = '';
                  if (prevEntry) {
                    const diff = entry.score - prevEntry.score;
                    if (diff > 0) trendHTML = '<i data-lucide="trending-up" style="width:12px;height:12px;color:var(--color-success);margin-left:4px;"></i>';
                    else if (diff < 0) trendHTML = '<i data-lucide="trending-down" style="width:12px;height:12px;color:var(--color-danger);margin-left:4px;"></i>';
                    else trendHTML = '<i data-lucide="minus" style="width:12px;height:12px;color:var(--text-tertiary);margin-left:4px;"></i>';
                  }
                  const timeColor = entry.duration < avgDuration * 0.75 ? 'var(--color-success)' : entry.duration > avgDuration * 1.25 ? 'var(--color-danger)' : 'var(--text-secondary)';
                  return `
                <tr>
                  <td class="bulk-checkbox-col" style="padding-right:0;"><input type="checkbox" class="bulk-history-cb" value="${entry.id}"></td>
                  <td style="color:var(--text-secondary);">
                    ${entry.date}
                    <span style="display:block; font-size:0.75rem; opacity:0.7;">${new Date(entry.startTime).toLocaleTimeString()}</span>
                  </td>
                  <td style="font-weight:600;">${escapeHTML(_historyVersionLabel(entry))}
                    ${entry.setId ? '<span class="badge badge-neutral" style="font-size:0.6rem;">Set</span>' : ''}
                    ${entry.isArchived ? '<span class="badge badge-neutral" style="font-size:0.6rem;">Archived</span>' : ''}</td>
                  <td>
                    <span class="score-badge ${entry.score === 100 ? 'score-perfect' : 'score-partial'}">
                      ${entry.score}% ${compLabel}
                    </span>${trendHTML}
                  </td>
                  <td style="text-align:right; color:${timeColor}; font-weight:600;">${formatTimeDisplay(entry.duration)}</td>
                  <td style="text-align:center;">
                    <button onclick="viewHistoricalDiff('${entry.id}', '${challengeId}')" class="btn btn-ghost" title="View Code Comparison" id="view-diff-${entry.id}">
                      <i data-lucide="eye" style="width:16px;height:16px;color:var(--color-primary);"></i>
                    </button>
                    <button onclick="deleteHistoryLog('${entry.id}', '${challengeId}')" class="btn btn-ghost" title="Delete Log" id="delete-log-${entry.id}">
                      <i data-lucide="trash-2" style="width:16px;height:16px;color:var(--color-danger);"></i>
                    </button>
                  </td>
                </tr>
              `;}).join('');
              })()}
            </tbody>
          </table>
        </div>
        ${_buildHistoryPaginationBar(filteredLogs.length, historyDetailPage, 'changeHistoryDetailPage')}
      </div>
    `;
  }
  lucide.createIcons({ root: container });

  // Wire up bulk toggle visibility
  const toggleBtn = document.getElementById('toggle-bulk-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const delBtn = document.getElementById('bulk-delete-btn');
      if (delBtn) delBtn.style.display = delBtn.style.display === 'none' ? 'inline-flex' : 'none';
    });
  }
}

function viewHistoricalDiff(id, challengeId) {
  const entry = state.history.find(h => h.id === id);
  if (!entry) return;

  // Attempts recorded after multi-file support went in carry every file; older
  // ones only kept the main one. Rebuild whichever is available, with the raw
  // sources attached so the solution page can re-diff and copy honestly.
  let fileDiffs = null;
  if (Array.isArray(entry.targetFiles) && entry.targetFiles.length && Array.isArray(entry.userFiles)) {
    fileDiffs = entry.targetFiles.map((t, i) => {
      const u = entry.userFiles.find(f => f.name === t.name && f.ext === t.ext) || entry.userFiles[i] || {};
      const userCode = u.userCode || '';
      const expectedCode = t.code || '';
      return {
        fileName: (t.name || 'main') + (t.ext || '.c'), name: t.name, ext: t.ext,
        userCode, expectedCode, diffs: computeDiffs(userCode, expectedCode).diffs
      };
    });
  }
  if (!fileDiffs || !fileDiffs.length) {
    const userCode = entry.userCode || '', expectedCode = entry.expectedCode || '';
    fileDiffs = [{ fileName: 'main.c', name: 'main', ext: '.c', userCode, expectedCode,
                   diffs: computeDiffs(userCode, expectedCode).diffs }];
  }

  const siblings = state.history.filter(h => h.challengeId === entry.challengeId);
  const older = siblings.filter(h => (h.submitTime || 0) < (entry.submitTime || 0));
  setSessionParam('solutionSummary', {
    challengeId: entry.challengeId,
    variantName: entry.variantName || '',
    title: (entry.challengeTitle || '').replace(/\s*-\s*[^-]*$/, '') || entry.challengeTitle || '',
    historyId: entry.id,
    score: entry.score,
    scoreBasis: entry.scoreBasis || null,
    duration: entry.duration,
    attemptNumber: entry.attemptNumber,
    prevScore: older.length ? older.sort((a, b) => (b.submitTime || 0) - (a.submitTime || 0))[0].score : null,
    bestScore: siblings.length ? Math.max(...siblings.map(h => h.score || 0)) : null,
    hintsUsed: 0,
    testsPassed: entry.testsPassed,
    testsTotal: entry.testsTotal,
    ts: entry.submitTime
  });

  setSessionParam('lastFileDiffs', fileDiffs);
  setSessionParam('lastDiffs', fileDiffs[0].diffs);
  clearSessionParam('solutionSetAttempt');
  setSessionParam('solutionBack', 'analytics-coding');
  setSessionParam('solutionChallengeId', challengeId || entry.challengeId);
  if (typeof window.saveAnalyticsScrollPositions === 'function') {
    window.saveAnalyticsScrollPositions();
  }
  spaNavigate('solution');
}

function deleteHistoryLog(id, challengeId) {
  showConfirm("Delete Record", "Delete this history record? You can undo this.", () => {
    softDeleteHistory([id], () => {
      renderHistoryDetail(challengeId);
      renderHistory();
    });
  });
}

function bulkDeleteSelected(challengeId) {
  const selected = Array.from(document.querySelectorAll('.bulk-history-cb:checked')).map(cb => cb.value);
  if (selected.length === 0) {
    showMessage("No Selection", "Please select at least one history entry to delete.", true);
    return;
  }
  showConfirm("Delete Selected", `Delete ${selected.length} selected record(s)? You can undo this.`, () => {
    softDeleteHistory(selected, () => {
      renderHistoryDetail(challengeId);
      renderHistory();
    });
  });
}

// promptTimer(), closeTimerModal() and confirmStartPractice() live in study.js.
// This file used to redeclare them, and because history.js is loaded AFTER study.js
// (see index.html) those copies won -- silently disabling the canonical versions'
// self-heal for the shared timer modal (notesStartAttempt() repurposes it for
// notebooks and only restores it on confirm, so a dismissed notebook dialog left
// every Coding Library "Practice" button opening a notebook session) and their
// browse/study scroll-position capture. The duplicates are removed; the analytics
// page and SRS "Review Now" call the study.js versions.

function showNotebookHistoryDetail(notebookId) {
  activeNotebookHistoryId = notebookId;
  activeAnalyticsFolderId = null;
  activeAnalyticsFolderScope = null;
  historyDetailPage = 1;
  renderHistory();
  renderNotebookHistoryDetailView(notebookId);
}

function renderNotebookHistoryDetailView(notebookId) {
  const container = document.getElementById('analytics-detail-container');
  const logs = state.notebookHistory.filter(h => h.notebookId === notebookId);

  if (logs.length === 0) {
    container.innerHTML = `
      <div style="padding: 2rem;">
        <button onclick="window.switchAnalyticsTab('training')" class="btn btn-ghost" style="margin-bottom:1.5rem; color:var(--text-secondary);">
          <i data-lucide="chevron-left" style="width:18px;height:18px;"></i> Back to Notebooks
        </button>
        <div class="empty-state" style="border:2px dashed var(--border-color); border-radius:var(--radius-lg); background:var(--bg-surface);">
          <i data-lucide="history"></i>
          <h2>No History Yet</h2>
          <p>You haven't practiced this notebook yet.</p>
        </div>
      </div>
    `;
    lucide.createIcons({ root: container });
    return;
  }

  let bestScore = 0;
  let totalScoreSum = 0;
  let totalQsSum = 0;
  let totalTime = 0;

  logs.forEach(l => {
    let c = 0, q = 0;
    if (l.sections) l.sections.forEach(s => { c += (s.correct || 0); q += (s.total || 0); });
    let pct = q > 0 ? Math.round((c / q) * 100) : 0;
    if (pct > bestScore) bestScore = pct;
    totalScoreSum += pct;
    totalTime += (l.duration || 0);
  });

  const avgScore = Math.round(totalScoreSum / logs.length);
  const totalAttempts = logs.length;
  const title = logs[0].notebookTitle || 'Unknown Notebook';

  // BUG-07 FIX: Dynamically fetch proper notebook category instead of hardcoded 'Basics'
  const notebook = state.notebooks.find(n => n.id === notebookId);
  const parentFolder = notebook ? state.nodes.find(n => n.id === notebook.parentId) : null;
  const categoryName = parentFolder ? parentFolder.name : 'Uncategorized';

  container.innerHTML = `
    <div style="padding: 2rem;">
      <button onclick="backToAnalyticsOverview()" class="btn btn-ghost" style="margin-bottom:1.25rem; color:var(--text-secondary);">
        <i data-lucide="chevron-left" style="width:18px;height:18px;"></i> Back to overview
      </button>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
        <div>
          <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--text-primary); margin-bottom: 0.25rem;">
            ${escapeHTML(title)}
          </h2>
          <p style="font-size: 0.875rem; color: var(--text-secondary);">${escapeHTML(categoryName)}</p>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:0.75rem; margin-bottom:1.5rem;">
        <div class="analytics-stat-card"><div class="analytics-stat-value" style="color:var(--color-success);">${bestScore}%</div><div class="analytics-stat-label">Best Score</div></div>
        <div class="analytics-stat-card"><div class="analytics-stat-value">${avgScore}%</div><div class="analytics-stat-label">Avg Score</div></div>
        <div class="analytics-stat-card"><div class="analytics-stat-value">${totalAttempts}</div><div class="analytics-stat-label">Attempts</div></div>
        <div class="analytics-stat-card"><div class="analytics-stat-value">${formatTimeDisplay(totalTime)}</div><div class="analytics-stat-label">Total Time</div></div>
      </div>

      ${(() => {
        if (logs.length < 2) return '';
        const chartSeries = logs.slice().sort((a, b) => {
          const ta = ((/(\d{10,})/).exec(a.id || '') || [])[1] || 0;
          const tb = ((/(\d{10,})/).exec(b.id || '') || [])[1] || 0;
          return (+ta) - (+tb);
        }).slice(-10).map((l, i) => {
          let c = 0, q = 0;
          if (l.sections) l.sections.forEach(s => { c += (s.correct || 0); q += (s.total || 0); });
          const score = q > 0 ? Math.round((c / q) * 100) : 0;
          return { x: i, score: Math.max(0, Math.min(100, score)), label: l.date || '#' + (i + 1) };
        });
        return '<div class="ac-card" style="margin-bottom:1.5rem;"><div class="ac-card-title">Score over time</div>' + _ac_trendSvg(chartSeries) + '</div>';
      })()}

      <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-bottom: 1rem;">
        <button onclick="document.getElementById('history-table').classList.toggle('show-bulk-actions')" class="btn btn-secondary btn-sm" id="toggle-bulk-btn">
          <i data-lucide="check-square" style="width:16px;height:16px;"></i> Toggle Bulk Actions
        </button>
        <button onclick="bulkDeleteNotebookSelected('${notebookId}')" class="btn btn-danger btn-sm bulk-delete-btn" id="bulk-delete-btn" style="display:none;">
          <i data-lucide="trash-2" style="width:16px;height:16px;"></i> Delete Selected
        </button>
      </div>

      <div class="table-container">
        <table class="table" id="history-table">
          <thead>
            <tr>
              <th class="bulk-checkbox-col" style="padding-right:0;"><input type="checkbox" onclick="toggleAllBulk(this)"></th>
              <th>Date</th>
              <th>Version</th>
              <th>Score</th>
              <th style="text-align:right;">Time Spent</th>
              <th style="text-align:center;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${(() => {
              let currentCompletion = logs.filter((l) => {
                let cc = 0, qq = 0;
                if (l.sections) l.sections.forEach(s => { cc += (s.correct || 0); qq += (s.total || 0); });
                return qq > 0 && Math.round((cc / qq) * 100) === 100;
              }).length;
              
              const pageSize = AN_PAGE;
              const pageStart = (historyDetailPage - 1) * pageSize;

              return logs.map((entry, idx) => {
                let c = 0, q = 0;
                if (entry.sections) entry.sections.forEach(s => { c += (s.correct || 0); q += (s.total || 0); });
                let pct = q > 0 ? Math.round((c / q) * 100) : 0;
                
                let compLabel = '';
                if (pct === 100) {
                  if (currentCompletion > 1) compLabel = `<span style="font-size:0.6rem; opacity:0.8; margin-left:4px;">(#${currentCompletion})</span>`;
                  currentCompletion--;
                }
                if (idx < pageStart || idx >= pageStart + pageSize) return '';
                
                return `
              <tr>
                <td class="bulk-checkbox-col" style="padding-right:0;"><input type="checkbox" class="bulk-history-cb" value="${entry.id}"></td>
                <td style="color:var(--text-secondary);">
                  ${entry.date}
                  <span style="display:block; font-size:0.75rem; opacity:0.7;">${entry.time || ''}</span>
                </td>
                <td style="font-weight:600;">Version ${logs.length - idx} ${entry.isArchived ? '<span class="badge badge-neutral" style="font-size:0.6rem;">Archived</span>' : ''}</td>
                <td>
                  <span class="score-badge ${pct === 100 ? 'score-perfect' : 'score-partial'}">
                    ${pct}% ${compLabel}
                  </span>
                </td>
                <td style="text-align:right; color:var(--text-secondary);">${formatTimeDisplay(entry.duration)}</td>
                <td style="text-align:center;">
                  <button onclick="viewNotebookHistory('${entry.id}')" class="btn btn-ghost" title="View Attempt">
                    <i data-lucide="eye" style="width:16px;height:16px;color:var(--color-primary);"></i>
                  </button>
                  <button onclick="deleteNotebookHistoryLog('${entry.id}', '${notebookId}')" class="btn btn-ghost" title="Delete Log">
                    <i data-lucide="trash-2" style="width:16px;height:16px;color:var(--color-danger);"></i>
                  </button>
                </td>
              </tr>
            `;
              }).join('');
            })()}
          </tbody>
        </table>
      </div>
      ${_buildHistoryPaginationBar(logs.length, historyDetailPage, 'changeHistoryDetailPage')}
      </div>
    </div>
  `;
  lucide.createIcons({ root: container });

  const toggleBtn = document.getElementById('toggle-bulk-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const delBtn = document.getElementById('bulk-delete-btn');
      if (delBtn) delBtn.style.display = delBtn.style.display === 'none' ? 'inline-flex' : 'none';
    });
  }
}

function viewNotebookHistory(id) {
  setSessionParam('reviewNotebookRecordId', id);
  spaNavigate('notes-practice');
}

function deleteNotebookHistoryLog(id, notebookId) {
  showConfirm("Delete Record", "Delete this history record? You can undo this.", () => {
    softDeleteNotebookHistory([id], () => {
      renderNotebookHistoryDetailView(notebookId);
      renderHistory();
    });
  });
}

function bulkDeleteNotebookSelected(notebookId) {
  const selected = Array.from(document.querySelectorAll('.bulk-history-cb:checked')).map(cb => cb.value);
  if (selected.length === 0) {
    showMessage("No Selection", "Please select at least one history entry to delete.", true);
    return;
  }
  showConfirm("Delete Selected", `Delete ${selected.length} selected record(s)? You can undo this.`, () => {
    softDeleteNotebookHistory(selected, () => {
      renderNotebookHistoryDetailView(notebookId);
      renderHistory();
    });
  });
}

// ======================== BULK RESET LIBRARY ITEMS ========================
function toggleBulkResetMode() {
  bulkResetMode = !bulkResetMode;
  renderHistory();
}

function selectAllBulkReset() {
  const cbs = document.querySelectorAll('.bulk-reset-cb');
  const allChecked = Array.from(cbs).every(cb => cb.checked);
  cbs.forEach(cb => cb.checked = !allChecked);
}

function executeBulkReset() {
  const selectedIds = Array.from(document.querySelectorAll('.bulk-reset-cb:checked')).map(cb => cb.value);
  
  if (selectedIds.length === 0) {
    if (typeof showMessage === 'function') showMessage("No Selection", "Please select at least one item to reset.", true);
    return;
  }

  const typeLabel = activeAnalyticsTab === 'training' ? 'notebooks' : (activeAnalyticsTab === 'snippets' ? 'snippets' : 'challenges');

  if (typeof showConfirm === 'function') {
    showConfirm("Bulk Reset Progress", `Are you sure you want to reset the progress for ${selectedIds.length} selected ${typeLabel}?\n\nPast history will be kept, but the items will be marked as incomplete.`, () => {
      
      if (activeAnalyticsTab === 'practice') {
        state.history.forEach(h => {
          if (selectedIds.includes(h.challengeId)) h.isArchived = true;
        });
        // Reset active attempts too
        selectedIds.forEach(id => {
          if (state.activeAttempts) delete state.activeAttempts[id];
        });
      } else if (activeAnalyticsTab === 'training') {
        state.notebookHistory.forEach(h => {
          if (selectedIds.includes(h.notebookId)) h.isArchived = true;
        });
      } else if (activeAnalyticsTab === 'snippets') {
        if (state.snippetHistory) {
          state.snippetHistory = state.snippetHistory.filter(h => !selectedIds.includes(h.snippetId));
        }
      }
      
      saveData();
      bulkResetMode = false;
      
      // If we had a detail view open for one of the deleted items, clear it
      if (activeHistoryChallengeId && selectedIds.includes(activeHistoryChallengeId)) activeHistoryChallengeId = null;
      if (activeNotebookHistoryId && selectedIds.includes(activeNotebookHistoryId)) activeNotebookHistoryId = null;
      if (activeSnippetHistoryId && selectedIds.includes(activeSnippetHistoryId)) activeSnippetHistoryId = null;
      
      if (!activeHistoryChallengeId && !activeNotebookHistoryId && !activeSnippetHistoryId) {
        const container = document.getElementById('analytics-detail-container');
        if (container) {
          container.innerHTML = `<div class="empty-state" style="height: 100%; display: flex; align-items: center; justify-content: center; flex-direction: column;"><i data-lucide="bar-chart-3" style="width: 48px; height: 48px; opacity: 0.5; margin-bottom: 1rem;"></i><h2>Select an item</h2><p style="font-size: 0.875rem; color: var(--text-tertiary); margin-top: 0.5rem;">Choose an item from the left pane to view its practice history.</p></div>`;
          if (typeof lucide !== 'undefined') lucide.createIcons({ root: container });
        }
      } else {
        if (activeHistoryChallengeId) renderHistoryDetail(activeHistoryChallengeId);
        if (activeNotebookHistoryId) renderNotebookHistoryDetailView(activeNotebookHistoryId);
        if (activeSnippetHistoryId) renderSnippetHistoryDetailView(activeSnippetHistoryId);
      }
      
      renderHistory();
      if (typeof showMessage === 'function') showMessage("Progress Reset", `History for ${selectedIds.length} items has been wiped.`, false);
    });
  }
}

function renderAnalyticsSetItem(set, logs) {
  const attempts = groupSetAttempts(logs);
  if (attempts.length === 0) return '';
  const bestScore = Math.max(...attempts.map(a => a.score));
  const completions = attempts.filter(a => a.score === 100).length;
  
  const isActive = activeHistorySetId === set.id;
  const onClick = bulkResetMode ? '' : `showSetHistoryDetail('${set.id}')`;
  const title = set.title || 'Untitled Practice Set';

  const completionBadge = completions > 1 ? `<span style="font-size:0.65rem; color:var(--color-primary); background:rgba(59,130,246,0.1); padding:2px 6px; border-radius:12px; margin-right:0.5rem; font-weight:700;">${completions}x Completed</span>` : '';

  return `<div class="snippet-list-item ${isActive ? 'active' : ''} ${bulkResetMode ? 'bulk-mode' : ''}" onclick="${onClick}" style="margin-bottom:0.5rem; display:flex; gap:0.5rem; align-items:center;">
      ${bulkResetMode ? `<input type="checkbox" class="bulk-reset-cb" value="${set.id}" style="width:16px;height:16px;accent-color:var(--color-danger);cursor:pointer;">` : ''}
      <div style="flex:1;">
        <div class="snippet-list-title" style="display:flex; justify-content:space-between; align-items:center;">
          <span style="display:flex; align-items:center;">
            <i data-lucide="layout-grid" style="width:13px;height:13px;margin-right:0.375rem;color:var(--color-accent);"></i>
            ${escapeHTML(title)}
          </span>
          <div style="display:flex; align-items:center;">
            ${completionBadge}
            <span class="score-badge ${bestScore === 100 ? 'score-perfect' : 'score-partial'}" style="font-size:0.65rem;">${bestScore}%</span>
          </div>
        </div>
        <div style="font-size:0.7rem; color:var(--text-tertiary); margin-top:0.25rem;">${attempts.length} session${attempts.length !== 1 ? 's' : ''} total</div>
      </div>
    </div>`;
}

window.showSetHistoryDetail = function(setId) {
  activeHistorySetId = setId;
  activeHistoryChallengeId = null;
  activeNotebookHistoryId = null;
  activeAnalyticsFolderId = null;
  activeAnalyticsFolderScope = null;
  historyDetailPage = 1;
  renderHistory();
  renderSetHistoryDetail(setId);
};

function renderSetHistoryDetail(setId) {
  const set = (state.codingSets || []).find(s => s.id === setId);
  if (!set) return;

  const container = document.getElementById('analytics-detail-container');
  const logs = getHistoryForSet(setId);
  const attempts = groupSetAttempts(logs);

  if (attempts.length === 0) {
    container.innerHTML = `
      <div style="padding: 2rem;">
        <button onclick="backToHistoryOverview()" class="btn btn-ghost" style="margin-bottom:1.5rem; color:var(--text-secondary);" id="back-to-overview-btn">
          <i data-lucide="chevron-left" style="width:18px;height:18px;"></i> Back to Categories
        </button>
        <div class="empty-state" style="border:2px dashed var(--border-color); border-radius:var(--radius-lg); background:var(--bg-surface);">
          <i data-lucide="history"></i>
          <h2>No History Yet</h2>
          <p>You haven't practiced this set yet.</p>
        </div>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: container });
    return;
  }

  const bestScore = Math.max(...attempts.map(a => a.score));
  const totalAttempts = attempts.length;
  const avgScore = Math.round(attempts.reduce((sum, a) => sum + a.score, 0) / totalAttempts);
  const totalTime = attempts.reduce((sum, a) => sum + (a.duration || 0), 0);

  const parentFolder = state.nodes.find(n => n.id === set.parentId);
  const catName = parentFolder ? parentFolder.name : 'Uncategorized';

  const recentScores = attempts.slice(0, 5).map(a => a.score);
  const olderScores = attempts.slice(5, 10).map(a => a.score);
  const recentAvg = recentScores.length > 0 ? recentScores.reduce((a,b)=>a+b,0)/recentScores.length : 0;
  const olderAvg = olderScores.length > 0 ? olderScores.reduce((a,b)=>a+b,0)/olderScores.length : recentAvg;
  const trend = recentAvg > olderAvg ? 'up' : recentAvg < olderAvg ? 'down' : 'flat';
  const trendIcon = trend === 'up' ? 'trending-up' : trend === 'down' ? 'trending-down' : 'minus';
  const trendColor = trend === 'up' ? 'var(--color-success)' : trend === 'down' ? 'var(--color-danger)' : 'var(--text-tertiary)';

  // Build Score Over Time chart series for _ac_trendSvg (most recent 10, chronological)
  const chartSeries = attempts.slice().reverse().slice(-10).map((a, i) => ({
    x: i, score: Math.max(0, Math.min(100, a.score)),
    label: a.date || '#' + (i + 1)
  }));


  // Build table rows
  const pageSize = 10;
  const pageStart = (historyDetailPage - 1) * pageSize;

  const avgDuration = attempts.reduce((s, a) => s + (a.duration || 0), 0) / (attempts.length || 1);
  const tableRows = attempts.map((att, index) => {
    if (index < pageStart || index >= pageStart + pageSize) return '';
    const cls = att.score === 100 ? 'score-perfect' : att.score >= 50 ? 'score-partial' : 'score-low';
    const timeDisplay = (typeof formatTimeDisplay === 'function') ? formatTimeDisplay(att.duration || 0) : (att.duration || 0) + 's';
    const timeColor = att.duration < avgDuration * 0.75 ? 'var(--color-success)' : att.duration > avgDuration * 1.25 ? 'var(--color-danger)' : 'var(--text-secondary)';
    const dateStr = att.date || '';
    const timeStr = att.submitTime ? new Date(att.submitTime).toLocaleTimeString() : '';
    const problemCount = att.logs.length;

    // Trend arrow compared to next (older) attempt
    let trendHTML = '';
    if (index < attempts.length - 1) {
      const prevAtt = attempts[index + 1];
      const diff = att.score - prevAtt.score;
      if (diff > 0) trendHTML = '<i data-lucide="trending-up" style="width:12px;height:12px;color:var(--color-success);margin-left:4px;"></i>';
      else if (diff < 0) trendHTML = '<i data-lucide="trending-down" style="width:12px;height:12px;color:var(--color-danger);margin-left:4px;"></i>';
      else trendHTML = '<i data-lucide="minus" style="width:12px;height:12px;color:var(--text-tertiary);margin-left:4px;"></i>';
    }

    return `
      <tr>
        <td style="color:var(--text-secondary);">
          ${escapeHTML(dateStr)}
          <span style="display:block; font-size:0.75rem; opacity:0.7;">${timeStr}</span>
        </td>
        <td style="font-weight:600;">Session #${totalAttempts - index}
          <span style="display:block; font-size:0.7rem; color:var(--text-tertiary); font-weight:400;">${problemCount} problem${problemCount !== 1 ? 's' : ''}</span>
        </td>
        <td>
          <span class="score-badge ${cls}">${att.score}%</span>${trendHTML}
        </td>
        <td style="text-align:right; color:${timeColor}; font-weight:600;">${timeDisplay}</td>
        <td style="text-align:center;">
          <button onclick="viewSetHistoricalDiff(${index}, '${setId}')" class="btn btn-ghost" title="View Code Comparison">
            <i data-lucide="eye" style="width:16px;height:16px;color:var(--color-primary);"></i>
          </button>
          <button onclick="deleteSetHistorySession(${index}, '${setId}')" class="btn btn-ghost" title="Delete Session">
            <i data-lucide="trash-2" style="width:16px;height:16px;color:var(--color-danger);"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <div style="padding: 2rem;" class="animate-fade-in">
      <button onclick="backToAnalyticsOverview()" class="btn btn-ghost" style="margin-bottom:1.25rem; color:var(--text-secondary);">
        <i data-lucide="chevron-left" style="width:18px;height:18px;"></i> Back to overview
      </button>
      
      <div class="analytics-detail-header">
        <div>
          <h2 class="analytics-detail-title">${escapeHTML(set.title)}</h2>
          <p class="analytics-detail-category">
            <i data-lucide="layout-grid" style="width:13px;height:13px;color:var(--color-accent);"></i> Practice Set &middot; <i data-lucide="folder" style="width:13px;height:13px;"></i> ${escapeHTML(catName)}
            <span class="analytics-trend-badge" style="color:${trendColor};">
              <i data-lucide="${trendIcon}" style="width:13px;height:13px;"></i> ${trend === 'up' ? 'Improving' : trend === 'down' ? 'Declining' : 'Steady'}
            </span>
          </p>
        </div>
        <div class="analytics-score-ring-lg" title="Best Score: ${bestScore}%">
          <svg viewBox="0 0 36 36">
            <path class="score-ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
            <path class="score-ring-fill ${bestScore === 100 ? 'perfect' : ''}" stroke-dasharray="${bestScore}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
          </svg>
          <span class="score-ring-text">${bestScore}%</span>
        </div>
      </div>

      <div class="analytics-stat-grid">
        <div class="analytics-stat-card-enhanced" style="--stat-accent: var(--color-success);">
          <div class="stat-card-icon"><i data-lucide="trophy" style="width:18px;height:18px;"></i></div>
          <div class="analytics-stat-value" style="color:var(--color-success);">${bestScore}%</div>
          <div class="analytics-stat-label">Best Avg Score</div>
        </div>
        <div class="analytics-stat-card-enhanced" style="--stat-accent: var(--color-primary);">
          <div class="stat-card-icon"><i data-lucide="rotate-ccw" style="width:18px;height:18px;"></i></div>
          <div class="analytics-stat-value" style="color:var(--color-primary);">${totalAttempts}</div>
          <div class="analytics-stat-label">Total Sessions</div>
        </div>
        <div class="analytics-stat-card-enhanced" style="--stat-accent: var(--color-accent);">
          <div class="stat-card-icon"><i data-lucide="percent" style="width:18px;height:18px;"></i></div>
          <div class="analytics-stat-value" style="color:var(--color-accent);">${avgScore}%</div>
          <div class="analytics-stat-label">Overall Average</div>
        </div>
        <div class="analytics-stat-card-enhanced" style="--stat-accent: var(--color-warning);">
          <div class="stat-card-icon"><i data-lucide="clock" style="width:18px;height:18px;"></i></div>
          <div class="analytics-stat-value" style="color:var(--color-warning);">${(typeof formatTimeDisplay === 'function') ? formatTimeDisplay(totalTime) : totalTime + 's'}</div>
          <div class="analytics-stat-label">Total Time Spent</div>
        </div>
      </div>

      ${attempts.length >= 2 ? `
      <div class="ac-card">
        <div class="ac-card-title">Score over time</div>
        ${_ac_trendSvg(chartSeries)}
      </div>` : ''}

      <div class="analytics-detail-body" style="margin-top:2rem;">
        <h3 style="font-size:1rem; font-weight:700; color:var(--text-primary); margin-bottom:1rem; display:flex; align-items:center; gap:0.5rem;">
          <i data-lucide="history" style="width:16px;height:16px;"></i> Session History
        </h3>
        <div class="table-container">
          <table class="table" id="history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Session</th>
                <th>Avg Score</th>
                <th style="text-align:right;">Time</th>
                <th style="text-align:center;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>
        ${_buildHistoryPaginationBar(attempts.length, historyDetailPage, 'changeHistoryDetailPage')}
      </div>
    </div>
  `;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: container });
}

/** View code comparison for a specific practice set session attempt */
function viewSetHistoricalDiff(attemptIndex, setId) {
  const logs = getHistoryForSet(setId);
  const attempts = groupSetAttempts(logs);
  const att = attempts[attemptIndex];
  if (!att || !att.logs || att.logs.length === 0) return;

  // Build per-problem diff data for the solution page
  const setAttemptData = att.logs.map((l, i) => {
    const cleanTitle = (l.challengeTitle || '').replace(/\s*\(Set:[^)]*\)/g, '');
    return {
      index: i,
      title: cleanTitle || `Problem ${i + 1}`,
      userCode: l.userCode || '',
      expectedCode: l.expectedCode || '',
      score: l.score
    };
  });

  setSessionParam('solutionSetAttempt', setAttemptData);
  setSessionParam('solutionBack', 'analytics-coding');
  // Also set the default first problem's diff so the solution page has something to show
  const first = setAttemptData[0];
  const diffResults = computeDiffs(first.userCode, first.expectedCode);
  setSessionParam('lastDiffs', diffResults.diffs);
  clearSessionParam('lastFileDiffs');
  clearSessionParam('solutionChallengeId');
  const setScore = att.logs.length ? Math.round(att.logs.reduce((s, l) => s + (l.score || 0), 0) / att.logs.length) : 0;
  setSessionParam('solutionSummary', {
    title: att.setTitle || (att.logs[0] && att.logs[0].setTitle) || 'Practice set',
    variantName: `${att.logs.length} problem${att.logs.length > 1 ? 's' : ''}`,
    score: setScore,
    duration: att.logs.reduce((s, l) => s + (l.duration || 0), 0),
    ts: att.logs[0] && att.logs[0].submitTime
  });
  if (typeof window.saveAnalyticsScrollPositions === 'function') {
    window.saveAnalyticsScrollPositions();
  }
  spaNavigate('solution');
}

/** Delete all logs belonging to a specific practice set session */
function deleteSetHistorySession(attemptIndex, setId) {
  const logs = getHistoryForSet(setId);
  const attempts = groupSetAttempts(logs);
  const att = attempts[attemptIndex];
  if (!att || !att.logs) return;

  const count = att.logs.length;
  showConfirm("Delete Session", `Delete this entire session (${count} problem log${count !== 1 ? 's' : ''})? You can undo this.`, () => {
    const ids = att.logs.map(l => l.id);
    softDeleteHistory(ids, () => {
      renderSetHistoryDetail(setId);
      renderHistory();
    });
  });
}

// -------------------------------------------------------------
// SNIPPET ANALYTICS & RECURSIVE EXPANSION HELPERS
// -------------------------------------------------------------

window.toggleAnalyticsExpand = function(nodeId, scope, e) {
  if (e) { e.stopPropagation(); e.preventDefault(); }
  const expandedKey = nodeId + '_analytics_' + scope;
  toggleNodeExpanded(expandedKey);
  
  let containerId = 'analytics-sidebar-content';
  if (scope === 'challenge') containerId = 'analytics-coding-sidebar-content';
  else if (scope === 'notebook') containerId = 'analytics-notes-sidebar-content';
  else if (scope === 'snippet') containerId = 'analytics-snippets-sidebar-content';

  const container = document.getElementById(containerId);
  if (container) {
    const nodeEl = container.querySelector(`.tree-node[data-node-id="${nodeId}"]`);
    if (nodeEl) {
      const childrenContainer = nodeEl.querySelector(':scope > .tree-children');
      const chevron = nodeEl.querySelector(':scope > .tree-node-row .tree-node-chevron');
      if (childrenContainer) {
        if (isNodeExpanded(expandedKey)) {
          childrenContainer.classList.remove('collapsed');
          if (chevron) chevron.classList.add('expanded');
        } else {
          childrenContainer.classList.add('collapsed');
          if (chevron) chevron.classList.remove('expanded');
        }
        return;
      }
    }
  }
  
  if (scope === 'challenge') renderCodingAnalytics();
  else if (scope === 'notebook') renderNotesAnalytics();
  else if (scope === 'snippet') renderSnippetAnalytics();
};

window.renderCodingAnalytics = function() {
  activeAnalyticsTab = 'practice';
  renderHistory();
  updateAnalyticsSubSummary('coding');
  if (activeAnalyticsFolderId && activeAnalyticsFolderScope === 'challenge') {
    renderAnalyticsFolderDetail(activeAnalyticsFolderId, 'challenge');
  }
};

window.renderNotesAnalytics = function() {
  activeAnalyticsTab = 'training';
  renderHistory();
  updateAnalyticsSubSummary('notes');
  if (activeAnalyticsFolderId && activeAnalyticsFolderScope === 'notebook') {
    renderAnalyticsFolderDetail(activeAnalyticsFolderId, 'notebook');
  }
};

window.renderSnippetAnalytics = function() {
  activeAnalyticsTab = 'snippets';
  renderHistory();
  updateAnalyticsSubSummary('snippets');
  if (activeAnalyticsFolderId && activeAnalyticsFolderScope === 'snippet') {
    renderAnalyticsFolderDetail(activeAnalyticsFolderId, 'snippet');
  }
};

window.selectAnalyticsFolder = function(folderId, scope) {
  analyticsFolderPage = 1;   // a new folder always starts at page one
  activeAnalyticsFolderId = folderId;
  activeAnalyticsFolderScope = scope;
  
  // Clear other active selections
  activeHistoryChallengeId = null;
  activeHistorySetId = null;
  activeNotebookHistoryId = null;
  activeSnippetHistoryId = null;
  
  renderHistory();
  renderAnalyticsFolderDetail(folderId, scope);
};

window.renderAnalyticsFolderDetail = function(folderId, scope) {
  const container = document.getElementById('analytics-detail-container');
  if (!container) return;
  
  const isRoot = folderId === '__root__';
  const currentFolder = isRoot ? null : state.nodes.find(n => n.id === folderId);
  const folderName = isRoot ? 'Uncategorized' : (currentFolder ? currentFolder.name : 'Folder');
  const folderDesc = currentFolder && currentFolder.description ? currentFolder.description : 'No description.';

  // 1. Breadcrumbs
  let breadcrumbHtml = `<nav class="breadcrumb-nav">`;
  breadcrumbHtml += `<button class="breadcrumb-item" onclick="backToAnalyticsOverview()"><i data-lucide="home" style="width:12px;height:12px;"></i></button>`;
  
  if (isRoot) {
    breadcrumbHtml += `<span class="breadcrumb-separator"><i data-lucide="chevron-right"></i></span>`;
    breadcrumbHtml += `<span class="breadcrumb-current">Uncategorized</span>`;
  } else if (currentFolder) {
    const path = getBreadcrumbPath(folderId);
    path.forEach((node, idx) => {
      breadcrumbHtml += `<span class="breadcrumb-separator"><i data-lucide="chevron-right"></i></span>`;
      if (idx < path.length - 1) {
        breadcrumbHtml += `<button class="breadcrumb-item" onclick="selectAnalyticsFolder('${node.id}', '${scope}')">${escapeHTML(node.name)}</button>`;
      } else {
        breadcrumbHtml += `<span class="breadcrumb-current">${escapeHTML(node.name)}</span>`;
      }
    });
  }
  breadcrumbHtml += `</nav>`;

  // 2. Recursive items/completions/stats calculator
  let completedCount = 0;
  let masteredCount = 0;
  let rotationCount = 0;
  let totalCount = 0;

  function countChallengesInFolderRecursive(fId) {
    let list = state.challenges.filter(c => c.parentId === fId);
    const childFolders = getChildFolders(fId, 'challenge');
    childFolders.forEach(cf => {
      list = list.concat(countChallengesInFolderRecursive(cf.id));
    });
    return list;
  }

  function countNotebooksInFolderRecursive(fId) {
    let list = state.notebooks.filter(n => n.parentId === fId);
    const childFolders = getChildFolders(fId, 'notebook');
    childFolders.forEach(cf => {
      list = list.concat(countNotebooksInFolderRecursive(cf.id));
    });
    return list;
  }

  function countSnippetsInFolderRecursive(fId) {
    let list = state.snippets.filter(s => s.parentId === fId);
    const childFolders = getChildFolders(fId, 'snippet');
    childFolders.forEach(cf => {
      list = list.concat(countSnippetsInFolderRecursive(cf.id));
    });
    return list;
  }

  if (scope === 'challenge') {
    let folderChallenges = [];
    if (isRoot) {
      folderChallenges = state.challenges.filter(c => c.parentId === null || c.parentId === undefined);
    } else {
      folderChallenges = countChallengesInFolderRecursive(folderId);
    }
    completedCount = folderChallenges.filter(c => {
      const logs = _historyItemMap[c.id] || [];
      return logs.length > 0 && Math.max(...logs.map(l => l.score)) === 100;
    }).length;
    totalCount = folderChallenges.length;
  } else if (scope === 'notebook') {
    let folderNotebooks = [];
    if (isRoot) {
      folderNotebooks = state.notebooks.filter(n => n.parentId === null || n.parentId === undefined);
    } else {
      folderNotebooks = countNotebooksInFolderRecursive(folderId);
    }
    masteredCount = folderNotebooks.filter(n => {
      const logs = _notebookHistoryItemMap[n.id] || [];
      if (logs.length === 0) return false;
      return getBestNotebookScore(logs) >= 80;
    }).length;
    totalCount = folderNotebooks.length;
  } else if (scope === 'snippet') {
    let folderSnippets = [];
    if (isRoot) {
      folderSnippets = state.snippets.filter(s => s.parentId === null || s.parentId === undefined);
    } else {
      folderSnippets = countSnippetsInFolderRecursive(folderId);
    }
    rotationCount = folderSnippets.filter(s => {
      const logs = _snippetHistoryItemMap[s.id] || [];
      return logs.length > 0;
    }).length;
    totalCount = folderSnippets.length;
  }

  const folderPct = totalCount > 0 
    ? Math.round(((scope === 'challenge' ? completedCount : (scope === 'notebook' ? masteredCount : rotationCount)) / totalCount) * 100) 
    : 0;

  let pctLabel = '';
  if (scope === 'challenge') {
    pctLabel = `${completedCount}/${totalCount} completed`;
  } else if (scope === 'notebook') {
    pctLabel = `${masteredCount}/${totalCount} mastered`;
  } else {
    pctLabel = `${rotationCount}/${totalCount} tracked`;
  }

  let statsCircleHtml = `
    <div class="analytics-score-ring-lg" title="${pctLabel}">
      <svg viewBox="0 0 36 36">
        <path class="score-ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
        <path class="score-ring-fill ${folderPct === 100 ? 'perfect' : ''}" stroke-dasharray="${folderPct}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
      </svg>
      <span class="score-ring-text">${folderPct}%</span>
    </div>
  `;

  let headerHtml = `
    <div class="analytics-detail-header" style="margin-bottom: 2rem;">
      <div style="flex: 1; min-width: 0; padding-right: 1.5rem;">
        <h2 style="font-size: 1.75rem; font-weight: 800; color: var(--text-primary); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
          <i data-lucide="${isRoot ? 'inbox' : (currentFolder && currentFolder.icon ? currentFolder.icon : 'folder')}" style="color:var(--color-primary); width:28px; height:28px;"></i>
          ${escapeHTML(folderName)}
        </h2>
        <p style="font-size: 0.95rem; color: var(--text-secondary); line-height: 1.5;">${escapeHTML(folderDesc)}</p>
      </div>
      ${statsCircleHtml}
    </div>
  `;

  // 3. Subfolders grid
  let childFolders = [];
  if (!isRoot) {
    childFolders = getChildFolders(folderId, scope).filter(cf => folderHasHistory(cf.id, scope));
  }

  let subfoldersHtml = '';
  if (childFolders.length > 0) {
    subfoldersHtml += `<h3 style="font-size:1.1rem; font-weight:700; color:var(--text-primary); margin-bottom:0.75rem;">Folders</h3>`;
    subfoldersHtml += `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.75rem; margin-bottom: 2rem;">`;
    childFolders.forEach(sf => {
      const sfCount = countItemsWithHistory(sf.id, scope);
      subfoldersHtml += `
        <div class="subfolder-card" onclick="selectAnalyticsFolder('${sf.id}', '${scope}')" style="cursor:pointer;">
          <i data-lucide="${sf.icon || 'folder'}"></i>
          <span class="subfolder-card-label">${escapeHTML(sf.name)}</span>
          <span class="subfolder-card-count">${sfCount} item${sfCount !== 1 ? 's' : ''}</span>
        </div>
      `;
    });
    subfoldersHtml += `</div>`;
  }

  // 4. Retrieve direct items with history inside folder
  const searchInput = document.getElementById('analytics-search');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  let items = getItemsInFolder(isRoot ? null : folderId, scope);
  let sets = [];

  if (scope === 'challenge') {
    items = items.filter(c => (_historyItemMap[c.id] || []).length > 0);
    sets = getSetsInFolder(isRoot ? null : folderId).filter(s => getHistoryForSet(s.id).length > 0);
  } else if (scope === 'notebook') {
    items = items.filter(nb => (_notebookHistoryItemMap[nb.id] || []).length > 0);
  } else if (scope === 'snippet') {
    items = items.filter(snip => (_snippetHistoryItemMap[snip.id] || []).length > 0);
  }

  if (query) {
    items = items.filter(item => item.title.toLowerCase().includes(query));
    if (scope === 'challenge') {
      sets = sets.filter(s => s.title.toLowerCase().includes(query));
    }
  }

  let cardsHtml = '';
  
  if (scope === 'challenge') {
    // Sets
    sets.forEach(set => {
      const setLogs = getHistoryForSet(set.id);
      const setAttempts = groupSetAttempts(setLogs);
      const attemptsCount = setAttempts.length;
      const bestScore = attemptsCount > 0 ? Math.max(...setAttempts.map(a => a.score)) : -1;
      const isPerfect = bestScore === 100;
      const scoreClass = bestScore === 100 ? 'score-perfect' : bestScore >= 50 ? 'score-partial' : 'score-low';
      const n = (set.problems || []).length;

      cardsHtml += `
        <div class="card card-enhanced card-set" onclick="showSetHistoryDetail('${set.id}')" style="cursor:pointer;">
          <div class="card-set-ribbon"><i data-lucide="layout-grid" style="width:11px;height:11px;"></i> Practice Set</div>
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem; gap:0.5rem;">
            <h3 style="font-weight:700; font-size:1.1rem; color:var(--text-primary); flex:1; min-width:0; display:flex; align-items:center; gap:0.5rem;">
              <i data-lucide="layout-grid" style="width:18px;height:18px;color:var(--color-accent);flex-shrink:0;"></i>
              <span style="overflow:hidden;text-overflow:ellipsis;">${escapeHTML(set.title)}</span>
            </h3>
            <span class="version-pill">${n} problem${n !== 1 ? 's' : ''}</span>
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:0.375rem; margin-bottom:0.75rem;">
            <span class="badge badge-neutral"><i data-lucide="rotate-ccw" style="width:12px;height:12px;margin-right:2px;"></i> ${attemptsCount} Attempt${attemptsCount !== 1 ? 's' : ''}</span>
            ${bestScore >= 0 ? `<span class="badge ${scoreClass}"><i data-lucide="${isPerfect ? 'check-circle' : 'target'}" style="width:12px;height:12px;margin-right:2px;"></i> Best: ${bestScore}%</span>` : ''}
          </div>
          <p class="line-clamp-2" style="font-size:0.875rem; color:var(--text-secondary); margin-bottom:0.75rem; min-height:2.5rem;">
            ${escapeHTML(set.description || 'A multi-problem session — switch freely, check each, submit at the end.')}
          </p>
          <div style="margin-top:auto; display:flex; gap:0.5rem; padding-top:0.5rem;">
            <button onclick="event.stopPropagation(); showSetHistoryDetail('${set.id}')" class="btn btn-practice" style="flex:1;">
              <i data-lucide="history" style="width:16px;height:16px;"></i> View History
            </button>
          </div>
        </div>
      `;
    });

    // Challenges
    items.forEach(c => {
      const vCount = c.variants.length;
      const logs = _historyItemMap[c.id] || [];
      const attemptsCount = logs.length;
      const bestScore = attemptsCount > 0 ? Math.max(...logs.map(l => l.score)) : -1;
      const isPerfect = bestScore === 100;
      const scoreClass = bestScore === 100 ? 'score-perfect' : bestScore >= 50 ? 'score-partial' : 'score-low';
      const coverHtml = c.coverImage ? `<div class="nb-card-cover"><img src="${c.coverImage}" alt="" loading="lazy" /></div>` : '';

      cardsHtml += `
        <div class="card card-enhanced${c.coverImage ? ' has-cover' : ''}" onclick="showHistoryDetail('${c.id}')" style="cursor: pointer;">
          ${coverHtml}
          ${isPerfect ? '<div class="card-completed-badge"><i data-lucide="check" style="width:10px;height:10px;"></i></div>' : ''}
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem;">
            <h3 style="font-weight:700; font-size:1.1rem; color:var(--text-primary); flex:1;">${escapeHTML(c.title)} ${typeof getDifficultyBadgeHTML === 'function' ? getDifficultyBadgeHTML(c) : ''}</h3>
            <span class="version-pill">${vCount} version${vCount !== 1 ? 's' : ''}</span>
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:0.375rem; margin-bottom:0.75rem;">
            <span class="badge badge-neutral"><i data-lucide="rotate-ccw" style="width:12px;height:12px;margin-right:2px;"></i> ${attemptsCount} Attempt${attemptsCount !== 1 ? 's' : ''}</span>
            ${bestScore >= 0 ? `<span class="badge ${scoreClass}"><i data-lucide="${isPerfect ? 'check-circle' : 'target'}" style="width:12px;height:12px;margin-right:2px;"></i> Best: ${bestScore}%</span>` : ''}
            ${(c.tags || []).map(t => `<span class="badge badge-primary">${escapeHTML(t)}</span>`).join('')}
          </div>
          <p class="line-clamp-2" style="font-size:0.875rem; color:var(--text-secondary); margin-bottom:0.75rem; min-height:2.5rem;">
            ${escapeHTML(c.coverDescription || c.variants[0]?.description || 'No description.')}
          </p>
          <div style="margin-top:auto; display:flex; gap:0.5rem; padding-top:0.5rem;">
            <button onclick="event.stopPropagation(); showHistoryDetail('${c.id}')" class="btn btn-practice" style="flex:1;">
              <i data-lucide="history" style="width:16px;height:16px;"></i> View History
            </button>
          </div>
        </div>
      `;
    });
  } else if (scope === 'notebook') {
    items.forEach(nb => {
      const logs = _notebookHistoryItemMap[nb.id] || [];
      const attemptsCount = logs.length;
      const bestScore = getBestNotebookScore(logs);
      const isPerfect = bestScore === 100;
      const scoreClass = bestScore >= 80 ? 'score-perfect' : bestScore >= 50 ? 'score-partial' : 'score-low';
      const coverHtml = nb.coverImage ? `<div class="nb-card-cover"><img src="${nb.coverImage}" alt="" loading="lazy" /></div>` : '';

      cardsHtml += `
        <div class="card card-enhanced${nb.coverImage ? ' has-cover' : ''}" onclick="showNotebookHistoryDetail('${nb.id}')" style="cursor: pointer;">
          ${coverHtml}
          ${isPerfect ? '<div class="card-completed-badge"><i data-lucide="check" style="width:10px;height:10px;"></i></div>' : ''}
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem;">
            <h3 style="font-weight:700; font-size:1.1rem; color:var(--text-primary); flex:1;">${escapeHTML(nb.title)}</h3>
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:0.375rem; margin-bottom:0.75rem;">
            <span class="badge badge-neutral"><i data-lucide="rotate-ccw" style="width:12px;height:12px;margin-right:2px;"></i> ${attemptsCount} Attempt${attemptsCount !== 1 ? 's' : ''}</span>
            ${attemptsCount > 0 ? `<span class="badge ${scoreClass}"><i data-lucide="${isPerfect ? 'check-circle' : 'target'}" style="width:12px;height:12px;margin-right:2px;"></i> Best: ${bestScore}%</span>` : ''}
          </div>
          <p class="line-clamp-2" style="font-size:0.875rem; color:var(--text-secondary); margin-bottom:0.75rem; min-height:2.5rem;">
            ${escapeHTML(nb.description || 'No description.')}
          </p>
          <div style="margin-top:auto; display:flex; gap:0.5rem; padding-top:0.5rem;">
            <button onclick="event.stopPropagation(); showNotebookHistoryDetail('${nb.id}')" class="btn btn-practice" style="flex:1;">
              <i data-lucide="history" style="width:16px;height:16px;"></i> View History
            </button>
          </div>
        </div>
      `;
    });
  } else if (scope === 'snippet') {
    items.forEach(snip => {
      const logs = _snippetHistoryItemMap[snip.id] || [];
      const attemptsCount = logs.length;
      const bestScore = attemptsCount > 0 ? Math.max(...logs.map(l => l.score)) : -1;
      const isPerfect = bestScore === 100;
      const scoreClass = bestScore === 100 ? 'score-perfect' : bestScore >= 50 ? 'score-partial' : 'score-low';

      cardsHtml += `
        <div class="card card-enhanced" onclick="showSnippetHistoryDetail('${snip.id}')" style="cursor: pointer;">
          ${isPerfect ? '<div class="card-completed-badge"><i data-lucide="check" style="width:10px;height:10px;"></i></div>' : ''}
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem;">
            <h3 style="font-weight:700; font-size:1.1rem; color:var(--text-primary); flex:1;">${escapeHTML(snip.title)}</h3>
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:0.375rem; margin-bottom:0.75rem;">
            <span class="badge badge-neutral"><i data-lucide="rotate-ccw" style="width:12px;height:12px;margin-right:2px;"></i> ${attemptsCount} Attempt${attemptsCount !== 1 ? 's' : ''}</span>
            ${bestScore >= 0 ? `<span class="badge ${scoreClass}"><i data-lucide="${isPerfect ? 'check-circle' : 'target'}" style="width:12px;height:12px;margin-right:2px;"></i> Best: ${bestScore}%</span>` : ''}
          </div>
          <p class="line-clamp-2" style="font-size:0.875rem; color:var(--text-secondary); margin-bottom:0.75rem; min-height:2.5rem;">
            ${escapeHTML(snip.description || 'No description.')}
          </p>
          <div style="margin-top:auto; display:flex; gap:0.5rem; padding-top:0.5rem;">
            <button onclick="event.stopPropagation(); showSnippetHistoryDetail('${snip.id}')" class="btn btn-practice" style="flex:1;">
              <i data-lucide="history" style="width:16px;height:16px;"></i> View History
            </button>
          </div>
        </div>
      `;
    });
  }

  let gridHtml = '';
  if (items.length > 0 || (scope === 'challenge' && sets.length > 0)) {
    /* Paged at AN_PAGE. A folder with sixty attempted programs rendered sixty
       cards in one scroll with no way to move through them. The cards are built
       above as one HTML string, so the page is sliced out of the rendered
       elements rather than re-running the builders. */
    const total = (scope === 'challenge' ? sets.length : 0) + items.length;
    const totalPages = Math.max(1, Math.ceil(total / AN_PAGE));
    if (analyticsFolderPage > totalPages) analyticsFolderPage = totalPages;
    if (analyticsFolderPage < 1) analyticsFolderPage = 1;
    const from = (analyticsFolderPage - 1) * AN_PAGE;
    gridHtml = `<div class="card-grid stagger-children" id="analytics-folder-card-grid" data-page-from="${from}" data-page-size="${AN_PAGE}">
      ${cardsHtml}
    </div>
    ${total > AN_PAGE ? `<div class="an-page-info">Showing ${Math.min(from + 1, total)}–${Math.min(from + AN_PAGE, total)} of ${total}</div>` : ''}
    ${_buildHistoryPaginationBar(total, analyticsFolderPage, 'changeAnalyticsFolderPage')}`;
  } else {
    gridHtml = `
      <div class="empty-state" style="height: 60%; display: flex; align-items: center; justify-content: center; flex-direction: column;">
        <i data-lucide="history" style="width: 48px; height: 48px; opacity: 0.5; margin-bottom: 1rem;"></i>
        <h2>No attempted items found</h2>
        <p style="font-size: 0.875rem; color: var(--text-tertiary); margin-top: 0.5rem;">
          ${query ? `No attempted items matching "${escapeHTML(query)}"` : 'No items in this folder have been attempted yet.'}
        </p>
      </div>
    `;
  }

  container.innerHTML = `
    <div style="padding: 2rem;" class="animate-fade-in">
      ${breadcrumbHtml}
      ${headerHtml}
      ${subfoldersHtml}
      ${gridHtml}
    </div>
  `;

  // Hide everything outside the current page. Done after insertion so the card
  // builders above stay untouched and set/program ordering is preserved.
  const grid = container.querySelector('#analytics-folder-card-grid');
  if (grid && grid.dataset.pageFrom) {
    const from = Number(grid.dataset.pageFrom) || 0;
    const size = Number(grid.dataset.pageSize) || AN_PAGE;
    Array.from(grid.children).forEach((el, i) => {
      el.style.display = (i >= from && i < from + size) ? '' : 'none';
    });
  }

  if (typeof lucide !== 'undefined') lucide.createIcons({ root: container });
};

window.changeAnalyticsFolderPage = function(page) {
  analyticsFolderPage = page;
  if (activeAnalyticsFolderId) {
    renderAnalyticsFolderDetail(activeAnalyticsFolderId, activeAnalyticsFolderScope || 'challenge');
    const c = document.getElementById('analytics-detail-container');
    if (c) c.scrollTop = 0;
  }
};

/** Jump from a distribution bar to the attempts inside that score band. */
window.anFilterBucket = function(idx) {
  const map = ['low', 'low', 'mid', 'mid', 'perfect'];
  if (typeof setHistoryScoreFilter === 'function') setHistoryScoreFilter(map[idx] || 'all');
  if (typeof toast === 'function') {
    toast(idx >= 4 ? 'Showing perfect attempts.' : idx <= 1 ? 'Showing attempts below 50%.' : 'Showing attempts from 50-99%.', { type: 'info' });
  }
};

window.showSnippetHistoryDetail = function(snippetId) {
  activeSnippetHistoryId = snippetId;
  activeHistoryChallengeId = null;
  activeHistorySetId = null;
  activeNotebookHistoryId = null;
  activeAnalyticsFolderId = null;
  activeAnalyticsFolderScope = null;
  historyDetailPage = 1;
  renderSnippetAnalytics();
  renderSnippetHistoryDetailView(snippetId);
};

window.renderSnippetHistoryDetailView = function(snippetId) {
  const container = document.getElementById('analytics-detail-container');
  if (!container) return;

  const snippet = (state.snippets || []).find(s => s.id === snippetId);
  const logs = state.snippetHistory ? state.snippetHistory.filter(h => h.snippetId === snippetId) : [];

  if (logs.length === 0) {
    container.innerHTML = `
      <div style="padding: 2rem;">
        <button onclick="backToAnalyticsOverview()" class="btn btn-ghost" style="margin-bottom:1.5rem; color:var(--text-secondary);">
          <i data-lucide="chevron-left" style="width:18px;height:18px;"></i> Back to overview
        </button>
        <div class="empty-state" style="border:2px dashed var(--border-color); border-radius:var(--radius-lg); background:var(--bg-surface);">
          <i data-lucide="history"></i>
          <h2>No History Yet</h2>
          <p>You haven't practiced this snippet yet.</p>
        </div>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: container });
    return;
  }

  let bestScore = 0;
  let totalScoreSum = 0;
  let totalTime = 0;

  logs.forEach(l => {
    if (l.score > bestScore) bestScore = l.score;
    totalScoreSum += l.score;
    totalTime += (l.duration || 0);
  });

  const avgScore = Math.round(totalScoreSum / logs.length);
  const totalAttempts = logs.length;
  const title = snippet ? snippet.title : (logs[0].snippetTitle || 'Unknown Snippet');

  const parentFolder = snippet ? state.nodes.find(n => n.id === snippet.parentId) : null;
  const categoryName = parentFolder ? parentFolder.name : 'Uncategorized';

  container.innerHTML = `
    <div style="padding: 2rem;" class="animate-fade-in">
      <button onclick="backToAnalyticsOverview()" class="btn btn-ghost" style="margin-bottom:1.25rem; color:var(--text-secondary);">
        <i data-lucide="chevron-left" style="width:18px;height:18px;"></i> Back to overview
      </button>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
        <div>
          <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--text-primary); margin-bottom: 0.25rem;">
            ${escapeHTML(title)}
          </h2>
          <p style="font-size: 0.875rem; color: var(--text-secondary);">${escapeHTML(categoryName)}</p>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:0.75rem; margin-bottom:1.5rem;">
        <div class="analytics-stat-card"><div class="analytics-stat-value" style="color:var(--color-success);">${bestScore}%</div><div class="analytics-stat-label">Best Score</div></div>
        <div class="analytics-stat-card"><div class="analytics-stat-value">${avgScore}%</div><div class="analytics-stat-label">Avg Score</div></div>
        <div class="analytics-stat-card"><div class="analytics-stat-value">${totalAttempts}</div><div class="analytics-stat-label">Attempts</div></div>
        <div class="analytics-stat-card"><div class="analytics-stat-value">${formatTimeDisplay(totalTime)}</div><div class="analytics-stat-label">Total Time</div></div>
      </div>

      ${(() => {
        if (logs.length < 2) return '';
        const chartSeries = logs.slice(-10).map((l, i) => {
          return { x: i, score: Math.max(0, Math.min(100, l.score)), label: l.date || '#' + (i + 1) };
        });
        return '<div class="ac-card" style="margin-bottom:1.5rem;"><div class="ac-card-title">Score over time</div>' + _ac_trendSvg(chartSeries) + '</div>';
      })()}

      <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-bottom: 1rem;">
        <button onclick="document.getElementById('history-table').classList.toggle('show-bulk-actions')" class="btn btn-secondary btn-sm" id="toggle-bulk-btn">
          <i data-lucide="check-square" style="width:16px;height:16px;"></i> Toggle Bulk Actions
        </button>
        <button onclick="bulkDeleteSnippetSelected('${snippetId}')" class="btn btn-danger btn-sm bulk-delete-btn" id="bulk-delete-btn" style="display:none;">
          <i data-lucide="trash-2" style="width:16px;height:16px;"></i> Delete Selected
        </button>
      </div>

      <div class="table-container">
        <table class="table" id="history-table">
          <thead>
            <tr>
              <th class="bulk-checkbox-col" style="padding-right:0;"><input type="checkbox" onclick="toggleAllBulk(this)"></th>
              <th>Date</th>
              <th>Version</th>
              <th>Score</th>
              <th style="text-align:right;">Time Spent</th>
              <th style="text-align:center;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${(() => {
              const pageSize = AN_PAGE;
              const pageStart = (historyDetailPage - 1) * pageSize;
              return logs.map((entry, idx) => {
                if (idx < pageStart || idx >= pageStart + pageSize) return '';
                return `
              <tr>
                <td class="bulk-checkbox-col" style="padding-right:0;"><input type="checkbox" class="bulk-history-cb" value="${entry.id}"></td>
                <td style="color:var(--text-secondary);">
                  ${entry.date}
                  <span style="display:block; font-size:0.75rem; opacity:0.7;">${entry.time || ''}</span>
                </td>
                <td style="font-weight:600;">Attempt ${logs.length - idx}</td>
                <td>
                  <span class="score-badge ${entry.score === 100 ? 'score-perfect' : 'score-partial'}">
                    ${entry.score}%
                  </span>
                </td>
                <td style="text-align:right; color:var(--text-secondary);">${formatTimeDisplay(entry.duration)}</td>
                <td style="text-align:center;">
                  <button onclick="viewSnippetHistoricalDiff('${entry.id}', '${snippetId}')" class="btn btn-ghost" title="View Code Comparison">
                    <i data-lucide="eye" style="width:16px;height:16px;color:var(--color-primary);"></i>
                  </button>
                  <button onclick="deleteSnippetHistoryLog('${entry.id}', '${snippetId}')" class="btn btn-ghost" title="Delete Log">
                    <i data-lucide="trash-2" style="width:16px;height:16px;color:var(--color-danger);"></i>
                  </button>
                </td>
              </tr>
            `;
              }).join('');
            })()}
          </tbody>
        </table>
      </div>
      ${_buildHistoryPaginationBar(logs.length, historyDetailPage, 'changeHistoryDetailPage')}
    </div>
  `;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: container });

  const toggleBtn = document.getElementById('toggle-bulk-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const delBtn = document.getElementById('bulk-delete-btn');
      if (delBtn) delBtn.style.display = delBtn.style.display === 'none' ? 'inline-flex' : 'none';
    });
  }
};

window.viewSnippetHistoricalDiff = function(id, snippetId) {
  const entry = state.snippetHistory ? state.snippetHistory.find(h => h.id === id) : null;
  if (!entry) return;
  const userCode = entry.userCode || '', expectedCode = entry.expectedCode || '';
  const diffResults = computeDiffs(userCode, expectedCode);
  setSessionParam('lastDiffs', diffResults.diffs);
  setSessionParam('lastFileDiffs', [{ fileName: 'snippet', name: 'snippet', ext: '',
                                      userCode, expectedCode, diffs: diffResults.diffs }]);
  clearSessionParam('solutionSetAttempt');
  setSessionParam('solutionSummary', {
    title: entry.snippetTitle || 'Snippet',
    score: entry.score,
    duration: entry.duration,
    ts: entry.submitTime
  });
  setSessionParam('solutionBack', 'analytics-snippets');
  setSessionParam('solutionChallengeId', snippetId); // reuse challengeId parameter for snippetId
  if (typeof window.saveAnalyticsScrollPositions === 'function') {
    window.saveAnalyticsScrollPositions();
  }
  spaNavigate('solution');
};

window.deleteSnippetHistoryLog = function(id, snippetId) {
  showConfirm("Delete Record", "Delete this history record? You can undo this.", () => {
    softDeleteSnippetHistory([id], () => {
      renderSnippetHistoryDetailView(snippetId);
      renderSnippetAnalytics();
    });
  });
};

window.bulkDeleteSnippetSelected = function(snippetId) {
  const selected = Array.from(document.querySelectorAll('.bulk-history-cb:checked')).map(cb => cb.value);
  if (selected.length === 0) {
    showMessage("No Selection", "Please select at least one history entry to delete.", true);
    return;
  }
  showConfirm("Delete Selected", `Delete ${selected.length} selected record(s)? You can undo this.`, () => {
    softDeleteSnippetHistory(selected, () => {
      renderSnippetHistoryDetailView(snippetId);
      renderSnippetAnalytics();
    });
  });
};

/**
 * Soft-delete snippet history entries.
 *
 * This used to call registerUndo(), a function that exists nowhere in the app.
 * The `typeof` guard around it meant no error and no undo: deleting snippet
 * attempts was permanent while deleting coding or notebook attempts was not.
 * Shaped like softDeleteHistory() in undo.js now, snapshots and all.
 */
function softDeleteSnippetHistory(ids, callback) {
  if (!state.snippetHistory || !ids || !ids.length) return;
  const snapshots = state.snippetHistory
    .filter(h => ids.includes(h.id))
    .map(h => JSON.parse(JSON.stringify(h)));
  if (!snapshots.length) return;
  state.snippetHistory = state.snippetHistory.filter(h => !ids.includes(h.id));
  saveData();
  if (callback) callback();
  if (typeof pushUndo === 'function') {
    pushUndo('Deleted ' + snapshots.length + ' snippet history record' + (snapshots.length > 1 ? 's' : ''), () => {
      if (!state.snippetHistory) state.snippetHistory = [];
      snapshots.forEach(h => state.snippetHistory.push(h));
      saveData();
      if (callback) callback();
    });
  }
}
window.softDeleteSnippetHistory = softDeleteSnippetHistory;

window.updateAnalyticsSubSummary = function(type) {
  if (type === 'coding') {
    const strip = document.getElementById('analytics-coding-summary-strip');
    const headerSub = document.getElementById('analytics-coding-header-stats');
    if (!strip) return;
    // Through anAttempts(), so this line and the completion figure below it
    // count the same set. They used to disagree: the attempt total counted
    // archived attempts and attempts on deleted programs, the completion figure
    // excluded both, and they sat on the same card.
    const attempts = (typeof anAttempts === 'function') ? anAttempts({ range: null }) : (state.history || []);
    const totalAttempts = attempts.length;
    const perfectScores = attempts.filter(h => h.score === 100).length;
    const avgScore = totalAttempts > 0 ? Math.round(attempts.reduce((sum, h) => sum + h.score, 0) / totalAttempts) : 0;
    // Counted against the live challenge list so manual set problems
    // (challengeId: null) and deleted programs can't inflate it.
    const completedPrograms = (typeof countCompletedPrograms === 'function')
      ? countCompletedPrograms()
      : new Set(state.history.filter(h => h.challengeId && h.score === 100 && !h.isArchived).map(h => h.challengeId)).size;
    const codingPct = state.challenges.length ? Math.round((completedPrograms / state.challenges.length) * 100) : 0;

    if (headerSub) {
      headerSub.textContent = `${totalAttempts} attempt${totalAttempts !== 1 ? 's' : ''} total (${completedPrograms} program${completedPrograms !== 1 ? 's' : ''} completed)`;
    }

    strip.innerHTML = `
      <div class="analytics-mini-card" style="--card-accent: var(--color-primary);">
        <div class="analytics-mini-icon"><i data-lucide="target" style="width:14px;height:14px;"></i></div>
        <div class="analytics-mini-data">
          <span class="analytics-mini-value" data-count="${totalAttempts}">${totalAttempts}</span>
          <span class="analytics-mini-label">Attempts</span>
        </div>
      </div>
      <div class="analytics-mini-card" style="--card-accent: var(--color-success);">
        <div class="analytics-mini-icon"><i data-lucide="trophy" style="width:14px;height:14px;"></i></div>
        <div class="analytics-mini-data">
          <span class="analytics-mini-value" data-count="${perfectScores}">${perfectScores}</span>
          <span class="analytics-mini-label">Perfect</span>
        </div>
      </div>
      <div class="analytics-mini-card" style="--card-accent: var(--color-accent);">
        <div class="analytics-mini-icon"><i data-lucide="percent" style="width:14px;height:14px;"></i></div>
        <div class="analytics-mini-data">
          <span class="analytics-mini-value">${avgScore}%</span>
          <span class="analytics-mini-label">Avg Score</span>
        </div>
      </div>
      <div class="analytics-mini-card" style="--card-accent: var(--color-warning);">
        <div class="analytics-mini-icon"><i data-lucide="check-circle" style="width:14px;height:14px;"></i></div>
        <div class="analytics-mini-data">
          <span class="analytics-mini-value">${codingPct}%</span>
          <span class="analytics-mini-label">Completion</span>
        </div>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: strip });
    animateCounters(strip);
  } else if (type === 'notes') {
    const strip = document.getElementById('analytics-notes-summary-strip');
    const headerSub = document.getElementById('analytics-notes-header-stats');
    if (!strip) return;
    // Attempts for notebooks that have since been deleted were still counted
    // here, so the attempt total was inflated and — worse — every deleted
    // notebook's score kept dragging the average down forever. Coding analytics
    // already filters these out (see anAttempts); notes now matches it.
    const _liveNb = new Set((state.notebooks || []).map(n => n.id));
    const _nbHistory = (state.notebookHistory || []).filter(h => h && _liveNb.has(h.notebookId));
    const totalAttempts = _nbHistory.length;
    const mastered = (typeof _notebookBestPct === 'function') ? state.notebooks.filter(nb => _notebookBestPct(nb) >= 80).length : 0;
    const avgScore = totalAttempts > 0 ? Math.round(_nbHistory.reduce((sum, h) => {
      let c = 0, q = 0;
      if (h.sections) h.sections.forEach(s => { c += (s.correct || 0); q += (s.total || 0); });
      return sum + (q > 0 ? Math.round((c / q) * 100) : 0);
    }, 0) / totalAttempts) : 0;
    const notesPct = state.notebooks.length ? Math.round((mastered / state.notebooks.length) * 100) : 0;

    if (headerSub) {
      headerSub.textContent = `${totalAttempts} quiz attempt${totalAttempts !== 1 ? 's' : ''} total (${mastered} notebook${mastered !== 1 ? 's' : ''} mastered)`;
    }

    strip.innerHTML = `
      <div class="analytics-mini-card" style="--card-accent: var(--color-primary);">
        <div class="analytics-mini-icon"><i data-lucide="target" style="width:14px;height:14px;"></i></div>
        <div class="analytics-mini-data">
          <span class="analytics-mini-value" data-count="${totalAttempts}">${totalAttempts}</span>
          <span class="analytics-mini-label">Attempts</span>
        </div>
      </div>
      <div class="analytics-mini-card" style="--card-accent: var(--color-success);">
        <div class="analytics-mini-icon"><i data-lucide="trophy" style="width:14px;height:14px;"></i></div>
        <div class="analytics-mini-data">
          <span class="analytics-mini-value" data-count="${mastered}">${mastered}</span>
          <span class="analytics-mini-label">Mastered</span>
        </div>
      </div>
      <div class="analytics-mini-card" style="--card-accent: var(--color-accent);">
        <div class="analytics-mini-icon"><i data-lucide="percent" style="width:14px;height:14px;"></i></div>
        <div class="analytics-mini-data">
          <span class="analytics-mini-value">${avgScore}%</span>
          <span class="analytics-mini-label">Avg Score</span>
        </div>
      </div>
      <div class="analytics-mini-card" style="--card-accent: var(--color-warning);">
        <div class="analytics-mini-icon"><i data-lucide="check-circle" style="width:14px;height:14px;"></i></div>
        <div class="analytics-mini-data">
          <span class="analytics-mini-value">${notesPct}%</span>
          <span class="analytics-mini-label">Mastery Rate</span>
        </div>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: strip });
    animateCounters(strip);
  } else if (type === 'snippets') {
    const strip = document.getElementById('analytics-snippets-summary-strip');
    const headerSub = document.getElementById('analytics-snippets-header-stats');
    if (!strip) return;
    // Same filter as coding and notes: an attempt on a snippet that has since
    // been deleted should not inflate the count or move the average.
    const _liveSnip = new Set((state.snippets || []).map(x => x.id));
    const snippetHistory = (state.snippetHistory || []).filter(h => h && _liveSnip.has(h.snippetId));
    const totalAttempts = snippetHistory.length;
    const perfectScores = snippetHistory.filter(h => h.score === 100).length;
    const avgScore = totalAttempts > 0 ? Math.round(snippetHistory.reduce((sum, h) => sum + (h.score || 0), 0) / totalAttempts) : 0;
    
    let snippetTracked = 0;
    if (typeof _snippetStatus === 'function') {
      state.snippets.forEach(s => { if (_snippetStatus(s) !== 'new') snippetTracked++; });
    }
    const snipPct = state.snippets.length ? Math.round((snippetTracked / state.snippets.length) * 100) : 0;

    if (headerSub) {
      headerSub.textContent = `${totalAttempts} try-coding attempt${totalAttempts !== 1 ? 's' : ''} total (${snippetTracked} snippet${snippetTracked !== 1 ? 's' : ''} tracked)`;
    }

    strip.innerHTML = `
      <div class="analytics-mini-card" style="--card-accent: var(--color-primary);">
        <div class="analytics-mini-icon"><i data-lucide="target" style="width:14px;height:14px;"></i></div>
        <div class="analytics-mini-data">
          <span class="analytics-mini-value" data-count="${totalAttempts}">${totalAttempts}</span>
          <span class="analytics-mini-label">Attempts</span>
        </div>
      </div>
      <div class="analytics-mini-card" style="--card-accent: var(--color-success);">
        <div class="analytics-mini-icon"><i data-lucide="trophy" style="width:14px;height:14px;"></i></div>
        <div class="analytics-mini-data">
          <span class="analytics-mini-value" data-count="${perfectScores}">${perfectScores}</span>
          <span class="analytics-mini-label">Perfect</span>
        </div>
      </div>
      <div class="analytics-mini-card" style="--card-accent: var(--color-accent);">
        <div class="analytics-mini-icon"><i data-lucide="percent" style="width:14px;height:14px;"></i></div>
        <div class="analytics-mini-data">
          <span class="analytics-mini-value">${avgScore}%</span>
          <span class="analytics-mini-label">Avg Score</span>
        </div>
      </div>
      <div class="analytics-mini-card" style="--card-accent: var(--color-warning);">
        <div class="analytics-mini-icon"><i data-lucide="check-circle" style="width:14px;height:14px;"></i></div>
        <div class="analytics-mini-data">
          <span class="analytics-mini-value">${snipPct}%</span>
          <span class="analytics-mini-label">Tracked Rate</span>
        </div>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: strip });
    animateCounters(strip);
  }
};

window.toggleAnalyticsTreeItems = function() {
  const hidden = localStorage.getItem('analyticsHideItems') !== 'true';
  localStorage.setItem('analyticsHideItems', hidden);
  
  // Update containers for all three wings
  const codingContainer = document.getElementById('analytics-coding-sidebar-content');
  if (codingContainer) codingContainer.classList.toggle('hide-tree-items', hidden);
  
  const notesContainer = document.getElementById('analytics-notes-sidebar-content');
  if (notesContainer) notesContainer.classList.toggle('hide-tree-items', hidden);
  
  const snippetsContainer = document.getElementById('analytics-snippets-sidebar-content');
  if (snippetsContainer) snippetsContainer.classList.toggle('hide-tree-items', hidden);

  // Update icons for all three wings
  const codingIcon = document.getElementById('analytics-coding-toggle-items-icon');
  if (codingIcon) {
    codingIcon.setAttribute('data-lucide', hidden ? 'eye-off' : 'eye');
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: codingIcon.parentElement });
  }
  const notesIcon = document.getElementById('analytics-notes-toggle-items-icon');
  if (notesIcon) {
    notesIcon.setAttribute('data-lucide', hidden ? 'eye-off' : 'eye');
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: notesIcon.parentElement });
  }
  const snippetsIcon = document.getElementById('analytics-snippets-toggle-items-icon');
  if (snippetsIcon) {
    snippetsIcon.setAttribute('data-lucide', hidden ? 'eye-off' : 'eye');
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: snippetsIcon.parentElement });
  }
};

function _buildHistoryPaginationBar(totalItems, currentPage, onPageFn) {
  const pageSize = AN_PAGE;
  const totalPages = Math.ceil(totalItems / pageSize);
  if (totalPages <= 1) return '';

  let html = '<div class="pagination-bar" style="margin-top: 1.5rem; justify-content: center; display: flex; gap: 0.25rem;">';

  // Previous
  html += `<button class="page-btn page-arrow" onclick="${onPageFn}(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''} title="Previous page">&lsaquo;</button>`;

  // Page numbers with smart ellipsis
  const pages = typeof _paginationRange === 'function' ? _paginationRange(currentPage, totalPages) : Array.from({ length: totalPages }, (_, i) => i + 1);
  let prev = 0;
  pages.forEach(p => {
    if (p - prev > 1) html += '<span class="page-ellipsis">…</span>';
    html += `<button class="page-btn ${p === currentPage ? 'active' : ''}" onclick="${onPageFn}(${p})">${p}</button>`;
    prev = p;
  });

  // Next
  html += `<button class="page-btn page-arrow" onclick="${onPageFn}(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''} title="Next page">&rsaquo;</button>`;

  html += '</div>';
  return html;
}

window.changeHistoryDetailPage = function(page) {
  historyDetailPage = page;
  if (activeHistoryChallengeId) {
    renderHistoryDetail(activeHistoryChallengeId);
  } else if (activeHistorySetId) {
    renderSetHistoryDetail(activeHistorySetId);
  } else if (activeNotebookHistoryId) {
    renderNotebookHistoryDetailView(activeNotebookHistoryId);
  } else if (activeSnippetHistoryId) {
    renderSnippetHistoryDetailView(activeSnippetHistoryId);
  }
};