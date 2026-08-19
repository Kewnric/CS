/* ============================================================
   NOTES.JS — Notebook Browsing for Training Grounds
   ============================================================ */

let activeNotebookId = null;
let activeNotebookFolderId = getSessionParam('studyOpenCat') || null;
let notebookCtxTargetNodeId = null; // Phase 4 FIX: Added Context Menu Target
let _notebookContainerCtxHandler = null;

// --- Init & Render ---
function notesInit() {
  notesRenderSidebar();
  notesRenderDetail();
}

/** Toggle visibility of individual notebook items in the study tree. */
function toggleStudyTreeItems() {
  const hidden = localStorage.getItem('studyHideItems') !== 'true';
  localStorage.setItem('studyHideItems', hidden);
  const container = document.getElementById('notes-sidebar-container');
  if (container) container.classList.toggle('hide-tree-items', hidden);
  const icon = document.getElementById('study-toggle-items-icon');
  if (icon) { icon.setAttribute('data-lucide', hidden ? 'eye-off' : 'eye'); if (typeof lucide !== 'undefined') lucide.createIcons({ root: icon.parentElement }); }
}

function notesRenderSidebar() {
  const container = document.getElementById('notes-sidebar-container');
  if (!container) return;

  const searchInput = document.getElementById('snippet-search');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  if (!state.notebooks || state.notebooks.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding: 2rem;">No notebooks available.</div>';
    return;
  }

  let html = renderNotebookTreeRecursive(null, 0, query);

  // The pseudo-folder: uncategorized notebooks, or your favourites (see libRootMode).
  const rootNotebooks = libRootItems('notes', state.notebooks);
  const rootMeta = libRootMeta('notes');
  let filteredRoot = rootNotebooks;
  if (query) {
    filteredRoot = rootNotebooks.filter(nb =>
      nb.title.toLowerCase().includes(query) || (nb.tags || []).some(t => t.toLowerCase().includes(query))
    );
  }
  
  if (filteredRoot.length > 0 || state.nodes.filter(n => n.scope === 'notebook').length === 0) {
    const isActive = !activeNotebookId && activeNotebookFolderId === '__root__';
    const count = filteredRoot.length;
    if (count > 0 || !html) {
      // A real row: expandable, droppable, with a menu (see browse.js).
      const rootOpen = isNodeExpanded('__root__');
      html += `
        <div class="tree-node" data-level="0" data-node-id="__root__">
          <div class="tree-node-row ${isActive ? 'active' : ''}"
               ${treeRowAttrs({ ns: 'notes', id: '__root__', kind: 'folder', level: 0, expanded: rootOpen, selected: isActive, draggable: false })}
               oncontextmenu="treeContextMenu(event, '__root__', 'notes')"
               onclick="selectNotebookFolder('__root__')">
            <i data-lucide="chevron-right" class="tree-node-chevron ${count > 0 ? (rootOpen ? 'expanded' : '') : 'invisible'}"
               onclick="toggleNotebookFolder('__root__', event)"></i>
            <i data-lucide="${rootMeta.icon}" class="tree-node-icon item-icon-color"></i>
            <span class="tree-node-label" title="${escapeHTML(rootMeta.hint)}">${rootMeta.label}</span>
            <span class="tree-node-badge">${count}</span>
          </div>
          <div class="tree-children ${rootOpen ? '' : 'collapsed'}" role="group">
            <div class="tree-children-inner">
              ${renderNotebookTreeRecursive(null, 0, query, true, filteredRoot)}
            </div>
          </div>
        </div>
      `;
    }
  }

  if (!html) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 2rem;">
        <p style="color:var(--text-tertiary); font-size:0.875rem;">No folders. Right-click to create one.</p>
      </div>`;
  } else {
    container.innerHTML = html + treeRootDropHTML('notes');
  }
  container.dataset.treeNs = 'notes';
  container.setAttribute('role', 'tree');
  container.setAttribute('aria-label', 'Notebook folders');
  container.classList.toggle('hide-tree-items', localStorage.getItem('studyHideItems') === 'true');

  // Folders use the shared menu (see the notes host below), so nothing here
  // attaches the legacy one. Every folder row already carries an inline
  // treeContextMenu AND matched the ":not(.tree-item-node)" selector this
  // delegation used, so one right-click opened two stacked menus.

  // Right-click the empty pane: new folders and the row display toggles.
  if (_notebookContainerCtxHandler) {
    container.removeEventListener('contextmenu', _notebookContainerCtxHandler);
  }
  _notebookContainerCtxHandler = (e) => {
    if (e.target === container || e.target.closest('.empty-state')) {
      treePaneContextMenu(e, 'notes');
    }
  };
  container.addEventListener('contextmenu', _notebookContainerCtxHandler);

  lucide.createIcons({ root: container });
}

/**
 * One pass in a single display order (see treeChildren), so a notebook dragged
 * above a folder stays above it instead of snapping back below.
 */
function renderNotebookTreeRecursive(parentId, depth, query, itemsOnly, rootList) {
  let html = '';

  // See browse.js: rootList is the pseudo-folder's contents.
  const entries = rootList ? rootList.map(n => ({ kind: 'item', node: n })) : treeChildren(parentId, 'notebook');

  entries.forEach(entry => {
    const node = entry.node;

    // See browse.js: the pseudo-folder lists root items only.
    if (itemsOnly && entry.kind === 'folder') return;

    if (entry.kind === 'folder') {
      const folder = node;
      const totalItems = countItemsRecursive(folder.id, 'notebook');
      const hasChildren = getChildFolders(folder.id, 'notebook').length > 0;
      const expanded = isNodeExpanded(folder.id);
      // Only one row highlights: the selected notebook, or (if none) the folder.
      const isActive = !activeNotebookId && activeNotebookFolderId === folder.id;
      if (query && !folderHasMatchingNotebooks(folder.id, query)) return;
      const chevronClass = (hasChildren || totalItems > 0) ? (expanded ? 'expanded' : '') : 'invisible';
      // "Set prerequisites..." has always been offered on notebook folders, but
      // nothing ever drew the lock, so a locked folder looked identical to an
      // open one. Same badge the coding tree uses.
      const lockIcon = notesFolderLocked(folder.id) ? '<i data-lucide="lock" class="tree-node-lock"></i>' : '';

      html += `
        <div class="tree-node" data-level="${depth}" data-node-id="${folder.id}">
          <div class="tree-node-row ${isActive ? 'active' : ''}"
               ${treeRowAttrs({ ns: 'notes', id: folder.id, kind: 'folder', level: depth, expanded: expanded, selected: isActive })}
               style="padding-left: calc(0.5rem + 0rem)"
               oncontextmenu="treeContextMenu(event, '${folder.id}', 'notes')"
               onclick="selectNotebookFolder('${folder.id}')">
            <i data-lucide="chevron-right" class="tree-node-chevron ${chevronClass}" onclick="toggleNotebookFolder('${folder.id}', event)"></i>
            <i data-lucide="${folder.icon || 'folder'}" class="tree-node-icon folder-icon-color"></i>
            <span class="tree-node-label">${escapeHTML(folder.name)}</span>
            ${lockIcon}
            ${typeof getTierBadgeHTML === 'function' ? getTierBadgeHTML(folder.tier) : ''}
            <span class="tree-node-badge">${totalItems}</span>
          </div>
          <div class="tree-children ${expanded || query ? '' : 'collapsed'}" role="group">
            <div class="tree-children-inner">
              ${renderNotebookTreeRecursive(folder.id, depth + 1, query)}
            </div>
          </div>
        </div>
      `;
      return;
    }

    // Notebook files — clicking one opens its detail view in pane 2.
    const nb = node;
    if (query && !libMatches(nb, query, 'notebook')) return;
    const isActive = activeNotebookId === nb.id;
    // A favourited notebook showed no star anywhere in the tree, and the
    // per-item colour the coding tree got was missing here entirely.
    const qCount = (nb.sections || []).reduce((n, sec) => n + ((sec.questions || []).length), 0);
    const hue = nb.color && typeof treeColorOf === 'function' ? ` style="--row-accent:${treeColorOf(nb.color)}"` : '';
    html += `
      <div class="tree-node tree-item-node${nb.color ? ' has-accent' : ''}" data-level="${depth + 1}" data-node-id="${nb.id}"${hue}>
        <div class="tree-node-row ${isActive ? 'active' : ''}"
             ${treeRowAttrs({ ns: 'notes', id: nb.id, kind: 'item', level: depth + 1, selected: isActive })}
             style="padding-left: calc(0.5rem + ${TREE_ITEM_INSET}rem)"
             oncontextmenu="treeContextMenu(event, '${nb.id}', 'notes')"
             onclick="notesSelectNotebook('${nb.id}')">
          <i class="tree-node-chevron invisible"></i>
          <i data-lucide="${nb.icon || 'book'}" class="tree-node-icon item-icon-color" style="width:14px;height:14px;"></i>
          <span class="tree-node-label" style="font-weight:400; font-size:0.875rem;">${escapeHTML(nb.title)}</span>
          ${notesShow('questions') && qCount ? `<span class="tree-badge-level">${qCount}Q</span>` : ''}
          ${notesShow('tags') && (nb.tags || []).length ? `<span class="tree-badge-tag">${escapeHTML(nb.tags[0])}</span>` : ''}
          ${nb.favorite ? '<i data-lucide="star" class="tree-node-star"></i>' : ''}
        </div>
      </div>
    `;
  });

  return html;
}

/**
 * A notebook folder's prerequisites, measured the way the rest of this page
 * measures a notebook: mastered is a best score of 80%+.
 */
function notesFolderLocked(folderId) {
  const req = (state.categoryRequirements || {})[folderId];
  if (!req) return false;
  const mastered = (id) => {
    const nb = (state.notebooks || []).find(n => n.id === id);
    return !!nb && _notebookStatus(nb) === 'mastered';
  };
  if (req.requiredChallengeIds && req.requiredChallengeIds.length) {
    return req.requiredChallengeIds.some(id => !mastered(id));
  }
  if (req.reqNodeId) {
    const done = (state.notebooks || []).filter(n => n.parentId === req.reqNodeId && mastered(n.id)).length;
    return done < (req.count || 0);
  }
  return false;
}

function folderHasMatchingNotebooks(folderId, query) {
  const items = getItemsInFolder(folderId, 'notebook');
  if (items.some(nb => libMatches(nb, query, 'notebook'))) return true;
  const childFolders = getChildFolders(folderId, 'notebook');
  return childFolders.some(cf => folderHasMatchingNotebooks(cf.id, query));
}

function renderNotebookItem(nb, depth) {
  return ''; // Deprecated: Notebooks are now rendered in the right pane via renderNotebookFolderOverview
}

function toggleNotebookFolder(nodeId, e) {
  if (e) { e.stopPropagation(); e.preventDefault(); }
  toggleNodeExpanded(nodeId);
  
  const nodeEl = document.querySelector(`.tree-node[data-node-id="${nodeId}"]`);
  if (nodeEl) {
    const childrenContainer = nodeEl.querySelector(':scope > .tree-children');
    const chevron = nodeEl.querySelector(':scope > .tree-node-row .tree-node-chevron');
    // Keep the accessible state in step with the visual one — this toggles in
    // place rather than re-rendering, so aria-expanded was left stale.
    const row = nodeEl.querySelector(':scope > .tree-node-row');
    if (row && row.hasAttribute('aria-expanded')) row.setAttribute('aria-expanded', String(isNodeExpanded(nodeId)));
    if (childrenContainer) {
      if (isNodeExpanded(nodeId)) {
        childrenContainer.classList.remove('collapsed');
        if (chevron) chevron.classList.add('expanded');
      } else {
        childrenContainer.classList.add('collapsed');
        if (chevron) chevron.classList.remove('expanded');
      }
    }
  } else {
    notesRenderSidebar();
  }
}

function selectNotebookFolder(folderId) {
  const pane1 = document.querySelector('.messenger-pane-1 .pane-1-content');
  if (pane1) setSessionParam('studySidebarScroll', pane1.scrollTop);

  activeNotebookFolderId = folderId;
  activeNotebookId = null;
  setSessionParam('activeNotebook', null);
  setSessionParam('studyOpenCat', folderId);
  setSessionParam('notebookPage', 1);

  notesRenderSidebar();
  notesRenderDetail();
}

// Filtered version called by the shared Training Grounds search bar
function notesRenderSidebarFiltered() {
  notesRenderSidebar();
  notesRenderDetail();
}

function notesSelectNotebook(id) {
  const searchInput = document.getElementById('snippet-search');
  const wasSearching = searchInput && searchInput.value.trim() !== '';

  if (wasSearching) {
    // Clear search
    searchInput.value = '';

    const nb = (state.notebooks || []).find(n => n.id === id);
    if (nb) {
      activeNotebookFolderId = nb.parentId || null;
      setSessionParam('studyOpenCat', activeNotebookFolderId);

      // Expand tree
      if (activeNotebookFolderId) {
        let curr = state.nodes.find(n => n.id === activeNotebookFolderId);
        while (curr) {
          if (!state.expandedNodes) state.expandedNodes = [];
          if (!state.expandedNodes.includes(curr.id)) {
            state.expandedNodes.push(curr.id);
          }
          curr = state.nodes.find(n => n.id === curr.parentId);
        }
      }
    }
  }

  activeNotebookId = id;
  notesRenderSidebar(); // Update active class
  
  if (wasSearching) {
    // Scroll to detail view
    setTimeout(() => {
      const detailHeader = document.querySelector('h1');
      if (detailHeader) {
        detailHeader.classList.add('pulse-highlight');
        setTimeout(() => detailHeader.classList.remove('pulse-highlight'), 2000);
      }
    }, 100);
  }

  notesRenderDetail();

  if (window.innerWidth <= 768) {
    document.querySelector('.messenger-pane-1').style.display = 'none';
    document.querySelector('.messenger-pane-2').style.display = 'flex';
  }
}

function notesRenderDetail() {
  const container = document.getElementById('notes-detail-container');
  const emptyState = document.getElementById('notes-empty-state');
  const sectionsArea = document.getElementById('notes-sections-area');

  if (!container || !emptyState || !sectionsArea) return;

  if (!activeNotebookId) {
    sectionsArea.innerHTML = '';
    if (activeNotebookFolderId) {
      emptyState.classList.add('hidden');
      renderNotebookFolderOverview(sectionsArea);
    } else {
      emptyState.classList.remove('hidden');
    }
    return;
  }

  const nb = (state?.notebooks ?? []).find(n => n.id === activeNotebookId);
  if (!nb) {
    activeNotebookId = null;
    notesRenderDetail();
    return;
  }

  emptyState.classList.add('hidden');

  const tagsHtml = (nb.tags || []).map(t => `<span class="tag">${escapeHTML(t)}</span>`).join('');

  const totalQs = (nb.sections || []).reduce((sum, sec) => sum + (sec.questions ? sec.questions.length : 0), 0);

  const isRoot = !nb.parentId;
  let breadcrumbHtml = `<nav class="breadcrumb-nav" style="margin-bottom: 1rem;">`;
  breadcrumbHtml += `<button class="breadcrumb-item" style="cursor:default;"><i data-lucide="home" style="width:12px;height:12px;"></i></button>`;
  
  if (isRoot) {
    breadcrumbHtml += `<span class="breadcrumb-separator"><i data-lucide="chevron-right"></i></span>`;
    breadcrumbHtml += `<span class="breadcrumb-current">Uncategorized</span>`;
  } else {
    const pathNodes = getBreadcrumbPath(nb.parentId);
    pathNodes.forEach((node, idx) => {
      breadcrumbHtml += `<span class="breadcrumb-separator"><i data-lucide="chevron-right"></i></span>`;
      breadcrumbHtml += `<button class="breadcrumb-item" onclick="toggleNotebookFolder('${node.id}')">${escapeHTML(node.name)}</button>`;
    });
  }
  breadcrumbHtml += `</nav>`;

  let html = `
    <div class="animate-fade-in" style="max-width: 800px; margin: 0 auto;">
      ${breadcrumbHtml}
      <div style="display:flex; align-items:flex-start; gap:1.5rem; margin-bottom:2rem;">
        <div style="width:64px; height:64px; border-radius:var(--radius-md); background:var(--color-primary-subtle); color:var(--color-primary); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
          <i data-lucide="${nb.icon || 'book'}" style="width:32px; height:32px;"></i>
        </div>
        <div style="flex:1;">
          <h1 style="font-size:2rem; font-weight:800; margin-bottom:0.5rem; color:var(--text-primary);">${escapeHTML(nb.title)}</h1>
          <div style="display:flex; gap:1rem; color:var(--text-tertiary); font-size:0.875rem; margin-bottom:1rem;">
            <span style="display:flex; align-items:center; gap:0.25rem;"><i data-lucide="layers" style="width:14px;height:14px;"></i> ${(nb.sections || []).length} Sections</span>
            <span style="display:flex; align-items:center; gap:0.25rem;"><i data-lucide="help-circle" style="width:14px;height:14px;"></i> ${totalQs} Questions</span>
          </div>
          ${tagsHtml ? `<div style="display:flex; flex-wrap:wrap; gap:0.5rem; margin-bottom:1rem;">${tagsHtml}</div>` : ''}
          <p style="color:var(--text-secondary); line-height:1.6;">${escapeHTML(nb.description || 'No description provided.')}</p>
        </div>
      </div>

      <div class="divider"></div>

      <div style="margin-bottom:2rem;">
        <h2 style="font-size:1.25rem; font-weight:700; margin-bottom:1rem;">Notebook Contents</h2>
        <div style="display:flex; flex-direction:column; gap:0.5rem;">
          ${(nb.sections || []).length === 0 ? '<div class="empty-state">No sections in this notebook.</div>' : ''}
          ${(nb.sections || []).map((sec, idx) => {
            // One overall best-% hid which section you actually keep failing.
            const st = _notebookSectionStats(nb, idx);
            const cls = st.pct < 0 ? '' : st.pct >= 80 ? 'score-perfect' : st.pct >= 50 ? 'score-partial' : 'score-low';
            return `
            <div class="card-flat nb-section-row">
              <div style="min-width:0;">
                <div style="font-weight:700; color:var(--text-primary); margin-bottom:0.25rem;">${escapeHTML(sec.label)}</div>
                <div style="font-size:0.8125rem; color:var(--text-tertiary);">
                  ${(sec.questions || []).length} Questions · ${sec.choices} Choices (A-${String.fromCharCode(64 + sec.choices)})
                </div>
              </div>
              <div class="nb-section-stat">
                ${st.pct < 0
                  ? '<span class="nb-section-untried">Not attempted</span>'
                  : `<span class="badge ${cls}">${st.pct}%</span>
                     <div class="nb-section-bar"><div class="nb-section-fill ${cls}" style="width:${st.pct}%;"></div></div>
                     <span class="nb-section-sub">best of ${st.runs} run${st.runs !== 1 ? 's' : ''}</span>`}
              </div>
              <div style="font-weight:800; color:var(--text-tertiary); font-size:1.5rem; opacity:0.3;">
                ${String(idx + 1).padStart(2, '0')}
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>

      ${(() => {
        const wrong = _notebookWrongQuestions(nb);
        if (!wrong.count) return '';
        return `<div class="nb-drill-callout">
          <div>
            <strong>${wrong.count} question${wrong.count === 1 ? '' : 's'} you got wrong last time</strong>
            <span>Run just those instead of the whole notebook.</span>
          </div>
          <button class="btn btn-secondary" onclick="notesStartDrill()">
            <i data-lucide="target" style="width:16px;height:16px;"></i> Drill wrong answers
          </button>
        </div>`;
      })()}

      <div style="display:flex; justify-content:flex-end; gap: 1rem;">
        <button class="btn btn-secondary btn-lg" onclick="shareNotebook('${nb.id}')">
          <i data-lucide="share-2" style="width:20px;height:20px;"></i> Share
        </button>
        <button class="btn btn-primary btn-lg" onclick="notesStartAttempt()" ${(nb.sections || []).length === 0 ? 'disabled' : ''}>
          <i data-lucide="play-circle" style="width:20px;height:20px;"></i> Start Attempt
        </button>
      </div>
    </div>
  `;

  sectionsArea.innerHTML = html;
  lucide.createIcons({ root: sectionsArea });
}

/** Best score you've ever posted on one SECTION, and how many runs cover it. */
function _notebookSectionStats(nb, sectionIdx) {
  const recs = _notebookFullRecords(nb);
  let best = -1, runs = 0;
  recs.forEach(r => {
    const s = (r.sections || [])[sectionIdx];
    if (!s || !s.total) return;
    runs++;
    const pct = Math.round(((s.correct || 0) / s.total) * 100);
    if (pct > best) best = pct;
  });
  return { pct: best, runs };
}

/**
 * Questions missed on the most recent attempt, grouped by section.
 * Records written before per-question verdicts existed fall back to re-grading
 * the stored answers against the stored key.
 */
function _notebookWrongQuestions(nb) {
  // Records old enough to predate both per-question verdicts and the stored key
  // can't tell us anything, so fall past them to the newest one that can.
  const gradeable = r => (r.sections || []).some(s => s && (s.results || s.keyMap));
  const recs = _notebookRecords(nb).slice()
    .sort((a, b) => (b.submitTime || 0) - (a.submitTime || 0))
    .filter(gradeable);
  const rec = recs[0];
  const bySection = {};
  let count = 0;
  if (!rec) return { count, bySection, recId: null };
  (rec.sections || []).forEach((s, idx) => {
    const list = [];
    if (s.results) {
      Object.keys(s.results).forEach(q => { if (s.results[q] !== 'correct') list.push(Number(q)); });
    } else if (s.keyMap) {
      Object.keys(s.keyMap).forEach(q => {
        const given = s.answers ? s.answers[q] : null;
        if (!given || (typeof npGradeEntry === 'function' ? !npGradeEntry(given, s.keyMap[q]) : given !== s.keyMap[q])) list.push(Number(q));
      });
    }
    if (list.length) { bySection[idx] = list.sort((a, b) => a - b); count += list.length; }
  });
  return { count, bySection, recId: rec.id };
}

/** Start an attempt restricted to the questions you missed last time. */
function notesStartDrill() {
  if (!activeNotebookId) return;
  const nb = state.notebooks.find(n => n.id === activeNotebookId);
  if (!nb) return;
  const wrong = _notebookWrongQuestions(nb);
  if (!wrong.count) return;
  setSessionParam('activeNotebook', activeNotebookId);
  setSessionParam('notebookTimeLimit', 0);
  setSessionParam('notebookDrill', { notebookId: nb.id, bySection: wrong.bySection, count: wrong.count });
  spaNavigate('notes-practice');
}

function notesStartAttempt() {
  clearSessionParam('notebookDrill');
  if (!activeNotebookId) return;
  const nb = state.notebooks.find(n => n.id === activeNotebookId);
  if (!nb || !nb.sections || nb.sections.length === 0) {
    showMessage("No Sections", "This notebook has no sections configured. Add sections in the Admin panel first.", true);
    return;
  }

  // Use the study.html's existing timer modal — repurpose it for notebooks
  const variantSelect = document.getElementById('timer-variant-select');
  if (variantSelect) {
    // Replace variant select with a simple minutes input for notebook timer
    variantSelect.closest('div').style.display = 'none';
  }

  const timerModal = document.getElementById('timer-modal');
  if (!timerModal) {
    // Fallback: prompt inline
    showInputDialog('Time Limit', 'Minutes (0 for untimed):', '0', '0', (val) => {
      const mins = parseInt(val) || 0;
      setSessionParam('activeNotebook', activeNotebookId);
      setSessionParam('notebookTimeLimit', mins);
      spaNavigate('notes-practice');
    });
    return;
  }

  // Update modal title and description for notebook context
  const modalTitle = timerModal.querySelector('.modal-title');
  const modalDesc = timerModal.querySelector('.modal-desc');
  if (modalTitle) modalTitle.textContent = 'Start Notebook Session';
  if (modalDesc) modalDesc.textContent = 'Set an optional time limit in minutes (0 for untimed).';

  document.getElementById('timer-h').value = '0';
  document.getElementById('timer-m').value = '0';
  document.getElementById('timer-s').value = '0';

  // Swap the confirm button action
  const confirmBtn = timerModal.querySelector('button[onclick="confirmStartPractice()"]');
  if (confirmBtn) confirmBtn.setAttribute('onclick', 'notesConfirmStart()');

  timerModal.classList.remove('hidden');
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: timerModal });
}

function notesConfirmStart() {
  const h = parseInt(document.getElementById('timer-h').value) || 0;
  const m = parseInt(document.getElementById('timer-m').value) || 0;
  const s = parseInt(document.getElementById('timer-s').value) || 0;
  const totalSeconds = (h * 3600) + (m * 60) + s;

  const timerModal = document.getElementById('timer-modal');
  if (timerModal) {
    timerModal.classList.add('hidden');
    // Restore the variant select visibility and confirm button
    const variantSelect = document.getElementById('timer-variant-select');
    if (variantSelect) variantSelect.closest('div').style.display = '';
    const confirmBtn = timerModal.querySelector('button[onclick="notesConfirmStart()"]');
    if (confirmBtn) confirmBtn.setAttribute('onclick', 'confirmStartPractice()');
    const modalTitle = timerModal.querySelector('.modal-title');
    if (modalTitle) modalTitle.textContent = 'Session Setup';
    const modalDesc = timerModal.querySelector('.modal-desc');
    if (modalDesc) modalDesc.textContent = 'Select a version and set an optional time limit.';
  }

  setSessionParam('activeNotebook', activeNotebookId);
  setSessionParam('notebookTimeLimit', totalSeconds);
  spaNavigate('notes-practice');
}

// ============================================================
// NOTEBOOK FILTER & SORT (parity with Coding Library)
// ============================================================
function _notebookRecords(nb) { return (state.notebookHistory || []).filter(r => r.notebookId === nb.id); }
/** Records that covered the WHOLE notebook. A drill only runs the questions you
    missed, so scoring 40% on three hard questions must not read as a 40% run. */
function _notebookFullRecords(nb) { return _notebookRecords(nb).filter(r => !r.isDrill); }
function _notebookBestPct(nb) {
  const recs = _notebookFullRecords(nb);
  if (!recs.length) return -1;
  let best = 0;
  recs.forEach(r => {
    let c = 0, t = 0;
    (r.sections || []).forEach(s => { c += s.correct || 0; t += s.total || 0; });
    const pct = t > 0 ? Math.round((c / t) * 100) : 0;
    if (pct > best) best = pct;
  });
  return best;
}
function _notebookStatus(nb) { const b = _notebookBestPct(nb); if (b < 0) return 'new'; return b >= 80 ? 'mastered' : 'attempted'; }
/** Prefer the stored timestamp; the id regex is only a fallback for records
    written before submitTime existed. */
function _notebookLastTs(nb) {
  const recs = _notebookRecords(nb);
  if (!recs.length) return 0;
  return Math.max(...recs.map(r => {
    if (r.submitTime) return r.submitTime;
    const m = /(\d{10,})/.exec(r.id || '');
    return m ? +m[1] : 0;
  }));
}
/** Most recent attempt's accuracy — best-ever alone hides a regression. */
function _notebookLastPct(nb) {
  const recs = _notebookFullRecords(nb).slice().sort((a, b) => {
    const ta = a.submitTime || 0, tb = b.submitTime || 0;
    return tb - ta;
  });
  const r = recs[0];
  if (!r) return -1;
  let c = 0, t = 0;
  (r.sections || []).forEach(s => { c += s.correct || 0; t += s.total || 0; });
  return t > 0 ? Math.round((c / t) * 100) : 0;
}

/** A notebook's difficulty / level, set in Admin (parity with programs). */
function getNotebookLevel(nb) { const n = parseInt(nb && nb.level, 10); return n > 0 ? Math.min(n, 100) : null; }
function getNotebookDifficulty(nb) { return (nb && nb.difficulty) || null; }

function _getNotebookStatusFilter() { return getLibPref('notebook.status', 'all'); }
function _getNotebookSort() { return getLibPref('notebook.sort', 'default'); }
function _getNotebookDiffFilter() { return getLibPref('notebook.diff', 'all'); }
function setNotebookStatusFilter(v) { setLibPref('notebook.status', v); setSessionParam('notebookPage', 1); notesRenderDetail(); }
function setNotebookSort(v) { setLibPref('notebook.sort', v); setSessionParam('notebookPage', 1); notesRenderDetail(); }
function setNotebookDiffFilter(v) { setLibPref('notebook.diff', v); setSessionParam('notebookPage', 1); notesRenderDetail(); }
function clearNotebookFilters() {
  setLibPref('notebook.status', 'all');
  setLibPref('notebook.diff', 'all');
  setLibPref('notebook.sort', 'default');
  libClearCommonFilters('notebook');
  setSessionParam('notebookPage', 1);
  notesRenderDetail();
}
function notebookPage(page) {
  const totalItems = (state.notebooks || []).length;
  const maxPage = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  page = Math.max(1, Math.min(page, maxPage));
  setSessionParam('notebookPage', page);
  notesRenderDetail();
}
function _applyNotebookFilterSort(list) {
  const status = _getNotebookStatusFilter();
  const diff = _getNotebookDiffFilter();
  const sort = _getNotebookSort();
  let out = libApplyCommonFilters('notebook', list.slice(), 'notebook');
  if (status !== 'all') out = out.filter(nb => _notebookStatus(nb) === status);
  if (diff !== 'all') out = out.filter(nb => getNotebookDifficulty(nb) === diff);
  if (sort === 'title') out.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  else if (sort === 'best') out.sort((a, b) => _notebookBestPct(b) - _notebookBestPct(a));
  else if (sort === 'weakest') out.sort((a, b) => _notebookBestPct(a) - _notebookBestPct(b));
  else if (sort === 'recent') out.sort((a, b) => _notebookLastTs(b) - _notebookLastTs(a));
  else if (sort === 'level') out.sort((a, b) => (getNotebookLevel(a) ?? Infinity) - (getNotebookLevel(b) ?? Infinity));
  else if (sort === 'due') {
    const overdue = nb => { const r = libReviewRec('notebook', nb.id); return (r && r.due) ? _revDaysBetween(r.due, _revToday()) : -Infinity; };
    out.sort((a, b) => overdue(b) - overdue(a));
  }
  // Direction is applied before favourites float, so starring something keeps
  // it on top whichever way the list is running.
  out = libApplySortDir('notebook', out);

  out.sort((a, b) => (libIsFavorite(b) ? 1 : 0) - (libIsFavorite(a) ? 1 : 0));
  return out;
}
function _renderNotebookFilterBar(total, shown, pool) {
  const status = _getNotebookStatusFilter();
  const diff = _getNotebookDiffFilter();
  const sort = _getNotebookSort();
  const chips = [['all', 'All'], ['new', 'New'], ['attempted', 'In progress'], ['mastered', 'Mastered']]
    .map(([v, l]) => libChipHTML(status === v, `setNotebookStatusFilter('${v}')`, l)).join('');
  const hasDiff = (pool || []).some(getNotebookDifficulty);
  const diffChips = hasDiff ? [['all', 'Any'], ['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']]
    .map(([v, l]) => libChipHTML(diff === v, `setNotebookDiffFilter('${v}')`, l)).join('') : '';
  const hasLevels = (pool || []).some(getNotebookLevel);
  const sortOpts = [['default', 'Folder order'], ['recent', 'Recent'], ['due', 'Most overdue'],
                    ['title', 'Title A–Z'], ['best', 'Best score'], ['weakest', 'Weakest first']];
  if (hasLevels) sortOpts.splice(1, 0, ['level', 'Level ↑']);
  const sortSel = `<select onchange="setNotebookSort(this.value)" class="form-select lib-sort-select" title="Sort order">${sortOpts.map(([v, l]) => `<option value="${v}"${sort === v ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
  const filtered = status !== 'all' || diff !== 'all' || libAnyCommonFilterActive('notebook');
  const tag = libGetTagFilter('notebook');
  const active = [];
  if (status !== 'all') active.push({ label: ({ new: 'New', attempted: 'In progress', mastered: 'Mastered' })[status] || status, clear: `setNotebookStatusFilter('all')` });
  if (diff !== 'all') active.push({ label: diff[0].toUpperCase() + diff.slice(1), clear: `setNotebookDiffFilter('all')` });
  if (getLibPref('notebook.fav', false)) active.push({ label: '★ Favourites', clear: `libToggleFlag('notebook','fav')` });
  if (getLibPref('notebook.due', false)) active.push({ label: 'Due', clear: `libToggleFlag('notebook','due')` });
  if (tag !== 'all') active.push({ label: '#' + escapeHTML(tag), clear: `libSetTagFilterExact('notebook','all')` });

  return libFilterShellHTML({
    ns: 'notebook',
    countLabel: filtered ? `${shown} of ${total}` : `${total} notebook${total !== 1 ? 's' : ''}`,
    active,
    onClear: 'clearNotebookFilters()',
    sort: sortSel,
    view: `<label class="lib-view-row">
      <input type="checkbox" ${getSessionParam('hideSubfolders') === 'false' ? 'checked' : ''}
             onchange="setSessionParam('hideSubfolders', this.checked ? 'false' : 'true'); notesRenderDetail();" />
      <span><strong>Subfolders</strong><em>Show subfolder tiles above the cards</em></span>
    </label>`,
    groups: [
      { icon: 'filter', chips },
      diffChips ? { icon: 'bar-chart-2', chips: diffChips } : null,
      { icon: 'star', chips: libCommonChipsHTML('notebook', 'notebook', pool) },
      { icon: 'list-ordered', chips: libSortTypeChipsHTML('notebook', 'setNotebookSort', sort, 'recent') },
      { icon: 'arrow-up-down', chips: libSortDirChipsHTML('notebook') },
      { icon: 'tag', chips: _libTagChipsOnly('notebook', pool) },
    ]
  });
}

registerLibAdapter('notebook', {
  scope: 'notebook',
  noun: 'notebook',
  list: () => state.notebooks || [],
  find: (id) => (state.notebooks || []).find(n => n.id === id),
  remove: (id) => { if (typeof softDeleteNotebook === 'function') softDeleteNotebook(id, () => {}); },
  rerender: () => { notesRenderSidebar(); notesRenderDetail(); },
  // The Coding Library has practice sets; this is the notebook equivalent —
  // several notebooks run back to back as one session.
  bulkExtra: (n) => `<button class="btn btn-secondary btn-sm" ${n > 1 ? '' : 'disabled'} onclick="notesRunSelectedAsSession()">
      <i data-lucide="layout-grid" style="width:13px;height:13px;"></i> Run as session</button>`
});

/* ── Multi-notebook sessions ──────────────────────────────────
   A queue in sessionStorage. Each notebook is still a normal attempt with its
   own record; the queue only decides what comes next and totals it up at the
   end, so nothing about grading or history had to change. */

function notesQueue() { return getSessionParam('notebookQueue') || null; }

function notesRunSelectedAsSession() {
  const ids = typeof libSelectedIds === 'function' ? libSelectedIds('notebook') : [];
  if (ids.length < 2) return;
  const titles = ids.map(id => (state.notebooks || []).find(n => n.id === id)).filter(Boolean).map(n => n.title);
  showConfirm('Run as one session',
    `${ids.length} notebooks, one after another: ${titles.slice(0, 3).join(', ')}${titles.length > 3 ? '…' : ''}. Each is still graded and recorded on its own.`,
    () => {
      setSessionParam('notebookQueue', { ids, index: 0, scores: [], startedAt: Date.now() });
      libToggleSelectMode('notebook');
      _notesQueueStart(0);
    });
}

function _notesQueueStart(index) {
  const q = notesQueue();
  if (!q || index >= q.ids.length) return;
  q.index = index;
  setSessionParam('notebookQueue', q);
  setSessionParam('activeNotebook', q.ids[index]);
  setSessionParam('notebookTimeLimit', 0);
  clearSessionParam('notebookDrill');
  spaNavigate('notes-practice');
}

/** Called from the results overlay when a session is running. */
function notesQueueAdvance(lastAccuracy) {
  const q = notesQueue();
  if (!q) return false;
  q.scores.push(Math.round(lastAccuracy || 0));
  const next = q.index + 1;
  if (next >= q.ids.length) {
    const avg = q.scores.length ? Math.round(q.scores.reduce((s, x) => s + x, 0) / q.scores.length) : 0;
    clearSessionParam('notebookQueue');
    if (typeof toast === 'function') {
      toast(`Session complete — ${q.ids.length} notebooks, ${avg}% average.`, { type: 'success', title: 'Done' });
    }
    spaNavigate('study');
    return true;
  }
  setSessionParam('notebookQueue', q);
  _notesQueueStart(next);
  return true;
}

function notesQueueCancel() {
  clearSessionParam('notebookQueue');
  spaNavigate('study');
}

// Inline folder name/description editing (parity with Coding Library).
function notebookEditFolderTitle(el, id) { inlineEditFolderTitle(el, id, () => { notesRenderSidebar(); notesRenderDetail(); }); }
function notebookEditFolderDesc(el, id) { inlineEditFolderDesc(el, id); }

/** Build one notebook card — same visual weight as the Coding Library's challenge cards. */
function _buildNotebookCard(nb) {
  const recs = _notebookRecords(nb);
  const attemptsCount = recs.length;
  const best = _notebookBestPct(nb);
  const isMastered = best >= 80;
  const scoreClass = best >= 80 ? 'score-perfect' : best >= 50 ? 'score-partial' : best >= 0 ? 'score-low' : '';
  const lastAttempt = recs.length > 0 ? recs[0].date : null; // history is unshifted — newest first
  const sectionCount = (nb.sections || []).length;
  const questionCount = (nb.sections || []).reduce((sum, s) => sum + (s.questions || []).length, 0);
  const tHtml = (nb.tags || []).map(t => libTagBadgeHTML('notebook', t)).join('');
  const coverHtml = nb.coverImage
    ? `<div class="nb-card-cover"><img src="${nb.coverImage}" alt="" loading="lazy" /></div>`
    : libCoverFallbackHTML(nb.title, nb.icon || 'book');
  const lastPct = _notebookLastPct(nb);
  const slipped = lastPct >= 0 && best >= 0 && lastPct < best;
  const lv = getNotebookLevel(nb);
  const diff = getNotebookDifficulty(nb);
  const selecting = libSelectMode('notebook');

  return `
    <div class="card card-enhanced has-cover${libIsSelected('notebook', nb.id) ? ' lib-selected' : ''}"
         onclick="${selecting ? `libToggleSelect('notebook','${nb.id}')` : `notesSelectNotebook('${nb.id}')`}" style="cursor: pointer;">
      ${coverHtml}
      ${libSelectBoxHTML('notebook', nb.id)}
      ${isMastered ? '<div class="card-completed-badge"><i data-lucide="check" style="width:10px;height:10px;"></i></div>' : ''}
      ${libFavButtonHTML('notebook', nb)}
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem; gap:0.5rem;">
        <h3 style="font-weight:700; font-size:1.1rem; color:var(--text-primary); flex:1; display:flex; align-items:center; gap:0.5rem; min-width:0;">
          <i data-lucide="${nb.icon || 'book'}" style="width:18px;height:18px;color:var(--color-primary);flex-shrink:0;"></i>
          <span style="overflow:hidden;text-overflow:ellipsis;">${escapeHTML(nb.title)}</span>
          ${lv ? `<span class="level-badge" title="Level ${lv}">LV.${lv}</span>` : ''}
          ${diff ? `<span class="difficulty-badge" style="--diff-color:${{ easy: '#10b981', medium: '#f59e0b', hard: '#ef4444' }[diff]};">${diff[0].toUpperCase() + diff.slice(1)}</span>` : ''}
        </h3>
        <span class="version-pill">${sectionCount} section${sectionCount !== 1 ? 's' : ''}</span>
      </div>
      <div style="display:flex; flex-wrap:wrap; gap:0.375rem; margin-bottom:0.75rem;">
        ${libReviewChipHTML('notebook', nb.id)}
        <span class="badge badge-neutral"><i data-lucide="rotate-ccw" style="width:12px;height:12px;margin-right:2px;"></i> ${attemptsCount} Attempt${attemptsCount !== 1 ? 's' : ''}</span>
        ${best >= 0 ? `<span class="badge ${scoreClass}"><i data-lucide="${isMastered ? 'trophy' : 'target'}" style="width:12px;height:12px;margin-right:2px;"></i> Best: ${best}%</span>` : ''}
        ${slipped ? `<span class="badge lib-last-badge" title="Your most recent attempt scored lower than your best">Last: ${lastPct}%</span>` : ''}
        <span class="badge badge-neutral"><i data-lucide="list-checks" style="width:12px;height:12px;margin-right:2px;"></i> ${questionCount} Q${questionCount !== 1 ? 's' : ''}</span>
        ${tHtml}
      </div>
      <p class="line-clamp-2" style="font-size:0.875rem; color:var(--text-secondary); margin-bottom:0.75rem; min-height:2.5rem;">
        ${escapeHTML(nb.description || 'No description.')}
      </p>
      ${best >= 0 ? `
      <div class="card-score-bar">
        <div class="card-score-fill ${scoreClass}" style="width: ${best}%;"></div>
      </div>` : ''}
      ${lastAttempt ? `<div class="card-last-attempt"><i data-lucide="clock" style="width:11px;height:11px;"></i> Last: ${lastAttempt}</div>` : ''}
      <div style="margin-top:auto; display:flex; gap:0.5rem; padding-top:0.5rem;">
        <button onclick="event.stopPropagation(); notesSelectNotebook('${nb.id}')" class="btn btn-practice" style="flex:1;">
          <i data-lucide="play" style="width:16px;height:16px;fill:currentColor;"></i> ${isMastered ? 'Review' : attemptsCount > 0 ? 'Continue' : 'Start'}
        </button>
        <button class="btn btn-ghost" title="Share Link" onclick="event.stopPropagation(); shareNotebook('${nb.id}')" style="padding:0.5rem;">
          <i data-lucide="share-2" style="width:16px;height:16px;"></i>
        </button>
      </div>
    </div>`;
}

function renderNotebookFolderOverview(container) {
  const searchInput = document.getElementById('snippet-search');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  const isRoot = activeNotebookFolderId === '__root__';
  const folder = isRoot ? null : state.nodes.find(n => n.id === activeNotebookFolderId);

  let breadcrumbHtml = `<nav class="breadcrumb-nav" style="margin-bottom: 1.5rem;">`;
  breadcrumbHtml += `<button class="breadcrumb-item" onclick="selectNotebookFolder('__root__')"><i data-lucide="home" style="width:12px;height:12px;"></i></button>`;
  
  if (isRoot) {
    breadcrumbHtml += `<span class="breadcrumb-separator"><i data-lucide="chevron-right"></i></span>`;
    breadcrumbHtml += `<span class="breadcrumb-current">Uncategorized</span>`;
  } else if (folder) {
    const pathNodes = getBreadcrumbPath(folder.id);
    pathNodes.forEach((node, idx) => {
      breadcrumbHtml += `<span class="breadcrumb-separator"><i data-lucide="chevron-right"></i></span>`;
      if (idx < pathNodes.length - 1) {
        breadcrumbHtml += `<button class="breadcrumb-item" onclick="selectNotebookFolder('${node.id}')">${escapeHTML(node.name)}</button>`;
      } else {
        breadcrumbHtml += `<span class="breadcrumb-current">${escapeHTML(node.name)}</span>`;
      }
    });
  }
  breadcrumbHtml += `</nav>`;

  const folderId = isRoot ? null : activeNotebookFolderId;
  let notebooks = [];
  let childFolders = [];

  if (query) {
    notebooks = (state.notebooks || []).filter(nb => libMatches(nb, query, 'notebook'));
  } else {
    notebooks = (state.notebooks || []).filter(nb => nb.parentId === folderId);
    childFolders = isRoot ? [] : getChildFolders(activeNotebookFolderId, 'notebook');
  }

  const _preFilterNotebooks = notebooks;
  notebooks = _applyNotebookFilterSort(notebooks);

  let subfoldersHtml = '';
  if (childFolders.length > 0) {
    subfoldersHtml = `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.75rem; margin-bottom: 1.5rem;">`;
    childFolders.forEach(sf => {
      const sfCount = countItemsRecursive(sf.id, 'notebook');
      subfoldersHtml += `
        <div class="subfolder-card" onclick="selectNotebookFolder('${sf.id}'); toggleNodeExpanded('${sf.id}');">
          <i data-lucide="${sf.icon || 'folder'}"></i>
          <span class="subfolder-card-label">${escapeHTML(sf.name)}</span>
          <span class="subfolder-card-count">${sfCount} item${sfCount !== 1 ? 's' : ''}</span>
        </div>
      `;
    });
    subfoldersHtml += `</div>`;
  }

  let folderName = isRoot ? 'Uncategorized' : (folder ? folder.name : 'Library');

  if (query) {
    breadcrumbHtml = `<nav class="breadcrumb-nav"><span class="breadcrumb-current">Search Results for "${escapeHTML(query)}"</span></nav>`;
    folderName = `Search Results`;
  }

  if (_preFilterNotebooks.length === 0 && childFolders.length === 0) {
    container.innerHTML = breadcrumbHtml + `
      <div class="empty-state" style="height: 60%; display: flex; align-items: center; justify-content: center; flex-direction: column;">
        <i data-lucide="folder-open" style="width: 48px; height: 48px; opacity: 0.5; margin-bottom: 1rem;"></i>
        <h2>No notebooks found</h2>
        <p style="font-size: 0.875rem; margin-top: 0.5rem; color: var(--text-tertiary);">
          ${query ? `No results for "${escapeHTML(query)}"` : `No notebooks available in ${escapeHTML(folderName)}.`}
        </p>
      </div>`;
  } else {
    const hideSubfolders = getSessionParam('hideSubfolders') !== 'false';
    const filterBarHtml = _preFilterNotebooks.length > 0 ? _renderNotebookFilterBar(_preFilterNotebooks.length, notebooks.length, _preFilterNotebooks) : '';

    let gridHtml = '';
    let pageIds = [];
    if (notebooks.length > 0) {
      let currentPage = parseInt(getSessionParam('notebookPage'), 10) || 1;
      const totalPages = Math.max(1, Math.ceil(notebooks.length / ITEMS_PER_PAGE));
      currentPage = Math.max(1, Math.min(currentPage, totalPages));
      const pageNotebooks = notebooks.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
      pageIds = pageNotebooks.map(nb => nb.id);
      gridHtml = `<div class="card-grid stagger-children">
          ${pageNotebooks.map(nb => _buildNotebookCard(nb)).join('')}
        </div>`
        + _buildPaginationBar(notebooks.length, currentPage, 'notebookPage');
    } else if (_preFilterNotebooks.length > 0) {
      gridHtml = `<div class="empty-state" style="padding:2.5rem 1rem; text-align:center; display:flex; flex-direction:column; align-items:center;">
            <i data-lucide="filter-x" style="width:36px;height:36px;opacity:0.5;margin-bottom:0.75rem;"></i>
            <h3 style="font-weight:700;">No notebooks match these filters</h3>
            <button class="btn btn-secondary btn-sm" onclick="clearNotebookFilters()" style="margin-top:0.75rem;"><i data-lucide="x" style="width:14px;height:14px;"></i> Clear filters</button>
          </div>`;
    }

    const canEdit = folder && !query;
    const titleAttrs = canEdit
      ? `class="browse-folder-title" onclick="notebookEditFolderTitle(this, '${folder.id}')" title="Click to edit name"`
      : `class="browse-folder-title" style="cursor:default;"`;
    const descAttrs = canEdit
      ? `class="browse-folder-desc" onclick="notebookEditFolderDesc(this, '${folder.id}')" title="Click to edit description"`
      : `class="browse-folder-desc" style="cursor:default;"`;
    const descInner = (folder && folder.description)
      ? escapeHTML(folder.description)
      : (canEdit ? '<span style="color:var(--text-tertiary);font-style:italic;">Click to add a description...</span>' : 'Select a notebook below to begin.');

    // Folder-level mastery (pre-filter set, like the Coding Library's progress bar)
    const masteredCount = _preFilterNotebooks.filter(nb => _notebookBestPct(nb) >= 80).length;
    const folderPct = _preFilterNotebooks.length > 0 ? Math.round((masteredCount / _preFilterNotebooks.length) * 100) : 0;
    const progressHtml = _preFilterNotebooks.length > 0 ? `
      <div class="browse-folder-progress" title="${masteredCount}/${_preFilterNotebooks.length} mastered (80%+)">
        <div class="folder-progress-bar">
          <div class="folder-progress-fill" style="width: ${folderPct}%;"></div>
        </div>
        <span class="folder-progress-label">${folderPct}%</span>
      </div>` : '';

    container.innerHTML = breadcrumbHtml + `
      <div class="animate-fade-in">
        <div class="browse-folder-header">
          <div class="browse-folder-info">
              <h2 ${titleAttrs}>${escapeHTML(folderName)}</h2>
              <p ${descAttrs}>${descInner}</p>
          </div>
          <div class="browse-folder-actions">
              ${progressHtml}
              ${libSelectToggleHTML('notebook')}
              <button class="btn btn-ghost" onclick="showConfirm('Toggle Visibility', 'Are you sure you want to ' + (${hideSubfolders} ? 'show' : 'hide') + ' subfolders?', () => { setSessionParam('hideSubfolders', '${!hideSubfolders}'); notesRenderDetail(); })" title="Toggle Subfolders" style="padding: 0.5rem;">
                  <i data-lucide="${hideSubfolders ? 'eye-off' : 'eye'}"></i>
              </button>
          </div>
      </div>
      ${filterBarHtml}
      ${hideSubfolders ? '' : subfoldersHtml}
      ${gridHtml}
      ${libSelectionBarHTML('notebook', pageIds)}
      </div>
    `;
  }

  if (typeof lucide !== 'undefined') lucide.createIcons({ root: container });
}


// ============================================================
// NOTEBOOK SHARING
// ============================================================

function shareNotebook(notebookId) {
  const notebook = state.notebooks.find(n => n.id === notebookId);
  if (!notebook) return;

  const shareable = {
    _type: 'notebook',
    title: notebook.title,
    tags: notebook.tags || [],
    description: notebook.description || '',
    icon: notebook.icon || 'book',
    sections: (notebook.sections || []).map(s => ({
      ...s,
      id: s.id || generateId()
    }))
  };

  const encoded = encodeShareData(shareable);
  if (!encoded) {
    if (typeof showMessage === 'function') showMessage('Error', 'Failed to encode notebook for sharing.', true);
    return;
  }

  const url = window.location.origin + window.location.pathname + '?data=' + encoded;
  warnIfShareUrlTooLong(url);

  copyShareLink(url, 'Notebook link copied!');
}

function checkSharedNotebook() {
  // See browse.js: the payload is captured at boot and applied once a storage
  // mode is known. This handles the case where the library mounts first.
  if (typeof hasPendingShare === 'function' && hasPendingShare()) {
    const pending = takePendingShare();
    if (pending && pending._type === 'notebook') importSharedNotebook(pending);
  }
}

/** Files a shared notebook into the current workspace and opens it. */
function importSharedNotebook(shared) {
  if (!shared) return null;
  const tempId = 'shared_notebook_' + Date.now();
  const tempNotebook = {
    id: tempId,
    title: '[Shared] ' + (shared.title || 'Notebook'),
    tags: shared.tags || [],
    description: shared.description || '',
    icon: shared.icon || 'book',
    parentId: null,
    sections: (shared.sections || []).map(sec => ({
      ...sec,
      id: sec.id || generateId(),
      questions: (sec.questions || []).map(q => ({ ...q, id: q.id || generateId() }))
    }))
  };

  if (!state.notebooks) state.notebooks = [];
  state.notebooks.unshift(tempNotebook);
  saveData();

  const qCount = tempNotebook.sections.reduce((n, sec) => n + ((sec.questions || []).length), 0);
  if (typeof showShareToast === 'function') {
    showShareToast('Added "' + tempNotebook.title + '"' + (qCount ? ' with ' + qCount + ' question' + (qCount !== 1 ? 's' : '') : ''));
  }

  setTimeout(() => {
    const notesTabBtn = document.getElementById('training-tab-notes');
    if (notesTabBtn) notesTabBtn.click();
    if (typeof notesSelectNotebook === 'function') notesSelectNotebook(tempId);
  }, 300);
  return tempId;
}

// ============================================================
// NOTEBOOK CONTEXT MENU 
// ============================================================

/* showNotebookCtxMenu() lived here. It opened a second, differently-styled menu
   over the shared one; its actions now hang off registerTreeHost('notes') and
   are reached through treeContextMenu like every other library. */

function notebookCtxSetTier(value) {
  if (!notebookCtxTargetNodeId) return;
  updateFolderTier(notebookCtxTargetNodeId, value || null);
  if (typeof renderNotes === 'function') renderNotes();
}

function nctxOpenTierPicker() {
  closeNotebookCtxMenu();
  if (!notebookCtxTargetNodeId) return;
  openTierPicker(notebookCtxTargetNodeId);
}

function nctxOpenLockPicker() {
  closeNotebookCtxMenu();
  if (!notebookCtxTargetNodeId) return;
  openLockPicker(notebookCtxTargetNodeId, 'notebook');
}

function closeNotebookCtxMenu() {
  const menu = document.getElementById('notebook-context-menu');
  if (menu) {
    menu.classList.add('hidden');
  }
}

function notebookCtxNewFolder() {
  closeNotebookCtxMenu();
  showInputDialog('New Folder', null, 'Folder name', '', (name) => {
    createNode(name.trim(), 'folder', notebookCtxTargetNodeId, 'notebook');
    if (notebookCtxTargetNodeId && !isNodeExpanded(notebookCtxTargetNodeId)) {
      toggleNodeExpanded(notebookCtxTargetNodeId);
    }
    saveData();
    notesRenderSidebar();
  });
}

function notebookCtxRename() {
  closeNotebookCtxMenu();
  if (!notebookCtxTargetNodeId) return;
  const folder = state.nodes.find(n => n.id === notebookCtxTargetNodeId);
  if (!folder) return;

  showInputDialog('Rename Folder', null, 'New name', folder.name, (newName) => {
    if (newName.trim() === folder.name) return;
    renameNode(notebookCtxTargetNodeId, newName.trim());
    notesRenderSidebar();
  });
}

function notebookCtxDelete() {
  closeNotebookCtxMenu();
  if (!notebookCtxTargetNodeId) return;
  const folder = state.nodes.find(n => n.id === notebookCtxTargetNodeId);
  if (!folder) return;
  const targetId = notebookCtxTargetNodeId;

  if (typeof showConfirm === 'function') {
    showConfirm('Delete Folder', `Delete "${escapeHTML(folder.name)}"? Items will become uncategorized. You can undo this.`, () => {
      softDeleteFolder(targetId, () => notesRenderSidebar());
    });
  } else {
    if (!confirm(`Delete "${folder.name}"? Items will become uncategorized.`)) return;
    softDeleteFolder(targetId, () => notesRenderSidebar());
  }
}

function notebookCtxMove() {
  closeNotebookCtxMenu();
  if (!notebookCtxTargetNodeId) return;
  const folder = state.nodes.find(n => n.id === notebookCtxTargetNodeId);
  if (!folder) return;

  const validFolders = state.nodes.filter(n =>
    n.type === 'folder' && n.scope === 'notebook' && n.id !== notebookCtxTargetNodeId && !isDescendantOf(n.id, notebookCtxTargetNodeId)
  );

  const options = validFolders.map(f => ({
    label: getBreadcrumbPath(f.id).map(n => n.name).join(' > '),
    value: f.id
  }));
  showListPickerDialog(`Move "${folder.name}"`, null, options, (newParentId) => {
    folder.parentId = newParentId;
    saveData();
    notesRenderSidebar();
  });
}

async function notebookCtxChangeIcon() {
  closeNotebookCtxMenu();
  if (!notebookCtxTargetNodeId) return;
  const folder = state.nodes.find(n => n.id === notebookCtxTargetNodeId);
  if (!folder) return;

  const currentIcon = folder.icon || 'folder';
  const newIcon = await openIconPicker(currentIcon);
  if (!newIcon || !newIcon.trim() || newIcon.trim() === currentIcon) return;

  folder.icon = newIcon.trim();
  saveData();
  notesRenderSidebar();
}

// ============================================================
// DRAG & DROP REORDERING
// ============================================================

/* Drag and drop lives in tree-dnd.js, shared with the other library trees.
   The four private copies could only reorder rows that already shared a parent. */
/* Row display toggles, same idea as the coding tree's. */
const NOTES_SHOW_KEY = 'notesRowShow';
function notesShow(what) {
  try { return (JSON.parse(localStorage.getItem(NOTES_SHOW_KEY)) || {})[what] === true; } catch (e) { return false; }
}
function notesToggleShow(what) {
  let o = {};
  try { o = JSON.parse(localStorage.getItem(NOTES_SHOW_KEY)) || {}; } catch (e) { o = {}; }
  o[what] = !o[what];
  try { localStorage.setItem(NOTES_SHOW_KEY, JSON.stringify(o)); } catch (e) { /* quota */ }
  notesRenderSidebar();
}

function notesFind(id) {
  return (state.notebooks || []).find(n => n.id === id) ||
         (state.nodes || []).find(n => n.id === id) || null;
}

function notesToggleFavorite(id) {
  const it = notesFind(id);
  if (!it) return;
  it.favorite = !it.favorite;
  saveData(); notesRenderSidebar();
  if (typeof toast === 'function') toast(it.favorite ? 'Added to favourites.' : 'Removed from favourites.', { type: 'info' });
}

function notesCollapseAll(collapse) {
  const folders = (state.nodes || []).filter(n => n.type === 'folder' && n.scope === 'notebook');
  state.expandedNodes = collapse ? [] : folders.map(f => f.id).concat('__root__');
  saveData(); notesRenderSidebar();
}

registerTreeHost('notes', {
  scope: 'notebook',
  container: '#notes-sidebar-container',
  selectNs: 'notes',
  rerender: () => notesRenderSidebar(),
  expand: (folderId) => {
    if (!state.expandedNodes) state.expandedNodes = [];
    if (!state.expandedNodes.includes(folderId)) { state.expandedNodes.push(folderId); notesRenderSidebar(); }
  },
  isExpanded: (id) => isNodeExpanded(id),
  toggle: (id) => toggleNotebookFolder(id, null),
  acceptsDrop: (targetId) => libRootAcceptsDrop('notes', targetId),
  onDropInto: (targetId, ids) => libRootDropInto('notes', targetId, ids,
    (id) => (state.notebooks || []).find(n => n.id === id)),

  /* Folders had no right-click menu at all here, and a notebook's menu offered
     only "Move to..." - so renaming or deleting either one was impossible from
     the tree. This is the same set the coding library has. */
  onRename: (id, kind) => {
    const it = notesFind(id);
    if (!it) return;
    const label = kind === 'folder' ? 'Rename folder' : 'Rename notebook';
    showInputDialog(label, null, 'Name', it.name || it.title || '', (v) => {
      const t = (v || '').trim();
      if (!t) return;
      if (kind === 'folder') it.name = t; else it.title = t;
      saveData(); notesRenderSidebar();
    });
  },
  onNewSubfolder: (id) => {
    showInputDialog('New folder', null, 'Folder name', '', (v) => {
      const name = (v || '').trim();
      if (!name || typeof createNode !== 'function') return;
      createNode(name, 'folder', id, 'notebook');
      if (id && !isNodeExpanded(id)) toggleNodeExpanded(id);
      saveData(); notesRenderSidebar();
    });
  },
  onDelete: (id, kind) => {
    const it = notesFind(id);
    if (!it) return;
    if (kind === 'folder') {
      const n = countItemsRecursive(id, 'notebook');
      showConfirm('Delete folder?',
        n ? `Delete "${it.name}"? The ${n} notebook${n !== 1 ? 's' : ''} inside move up a level.` : `Delete "${it.name}"?`,
        () => {
          (state.nodes || []).forEach(c => { if (c.parentId === id) c.parentId = it.parentId || null; });
          (state.notebooks || []).forEach(nb => { if (nb.parentId === id) nb.parentId = it.parentId || null; });
          state.nodes = (state.nodes || []).filter(x => x.id !== id);
          saveData(); notesRenderSidebar();
        });
      return;
    }
    showConfirm('Delete notebook?', `Delete "${it.title}"? You can undo this.`, () => {
      const at = state.notebooks.indexOf(it);
      state.notebooks = state.notebooks.filter(x => x.id !== id);
      saveData(); notesRenderSidebar();
      if (typeof toast === 'function') {
        toast(`Deleted "${it.title}".`, { type: 'info', duration: 8000,
          action: { label: 'Undo', onClick: () => { state.notebooks.splice(Math.min(at, state.notebooks.length), 0, it); saveData(); notesRenderSidebar(); } } });
      }
    });
  },
  extraActions: (id, kind) => {
    const it = notesFind(id);
    if (kind === 'folder') {
      // Tier and prerequisites came from the legacy folder menu; dropping that
      // menu must not drop what only it could do.
      return [
        { icon: 'image', label: 'Change icon...', fn: () => { if (typeof browseSetIcon === 'function') browseSetIcon(id); } },
        { icon: 'palette', label: 'Highlight colour...', fn: () => { if (typeof browseSetColor === 'function') browseSetColor(id); } },
        { icon: 'award', label: 'Set tier...', fn: () => { notebookCtxTargetNodeId = id; nctxOpenTierPicker(); } },
        { icon: 'lock', label: 'Set prerequisites...', fn: () => { notebookCtxTargetNodeId = id; nctxOpenLockPicker(); } }
      ];
    }
    const fav = !!(it && it.favorite);
    return [
      { icon: 'play', label: 'Start quiz', fn: () => { if (typeof startNotebookPractice === 'function') startNotebookPractice(id); else notesSelectNotebook(id); } },
      { icon: fav ? 'star-off' : 'star', label: fav ? 'Remove from favourites' : 'Add to favourites', fn: () => notesToggleFavorite(id) },
      { icon: 'palette', label: 'Highlight colour...', fn: () => { if (typeof browseSetColor === 'function') browseSetColor(id); } },
      { icon: 'image', label: 'Change icon...', fn: () => { if (typeof browseSetIcon === 'function') browseSetIcon(id); } },
      { icon: 'bar-chart-3', label: 'View history', fn: () => { spaNavigate('analytics-notes'); } }
    ];
  },
  paneActions: () => ([
    { icon: 'folder-plus', label: 'New root folder', fn: () => {
      showInputDialog('New folder', null, 'Folder name', '', (v) => {
        const name = (v || '').trim();
        if (!name || typeof createNode !== 'function') return;
        createNode(name, 'folder', null, 'notebook');
        saveData(); notesRenderSidebar();
      });
    } },
    { sep: true },
    { icon: notesShow('questions') ? 'check-square' : 'square', label: 'Show question count', fn: () => notesToggleShow('questions') },
    { icon: notesShow('tags') ? 'check-square' : 'square', label: 'Show topic badge', fn: () => notesToggleShow('tags') },
    { sep: true },
    { icon: 'chevrons-down-up', label: 'Collapse all folders', fn: () => notesCollapseAll(true) },
    { icon: 'chevrons-up-down', label: 'Expand all folders', fn: () => notesCollapseAll(false) }
  ]),
  // Moving between folders asks first; reordering inside one does not.
  confirmMove: true
});
