/* ============================================================
   STUDY.JS — Training Grounds (Dual-Pane Layout)
   ============================================================ */

let activeSnippetId = null;
let activeSnippetFolderId = getSessionParam('studyOpenCat') || null;
let currentSnippetVariants = [];
let activeExampleIndex = 0;
let tryCodingTargetCodes = [];
let tryCodingTargetStarterCode = '';
let snippetCtxTargetNodeId = null;
let _snippetContainerCtxHandler = null;
let tryCodingStartTime = null;

// --- Search routing ---
// The Notes Library (#/study) and Snippet Library (#/snippets) are separate
// routes now, but they share the same search-input id. Route to whichever
// sidebar exists on the current page.
function handleTrainingGroundsSearch() {
  const notesSidebar = document.getElementById('notes-sidebar-container');
  if (notesSidebar) {
    setSessionParam('notebookPage', 1);
    if (typeof notesRenderSidebarFiltered === 'function') notesRenderSidebarFiltered();
  } else {
    setSessionParam('snippetPage', 1);
    renderSnippetList();
    renderSnippetDetail();
  }
}

/** Toggle visibility of individual snippet items in the snippets tree. */
function toggleSnippetsTreeItems() {
  const hidden = localStorage.getItem('snippetsHideItems') !== 'true';
  localStorage.setItem('snippetsHideItems', hidden);
  const container = document.getElementById('snippet-list-container');
  if (container) container.classList.toggle('hide-tree-items', hidden);
  const icon = document.getElementById('snippets-toggle-items-icon');
  if (icon) { icon.setAttribute('data-lucide', hidden ? 'eye-off' : 'eye'); if (typeof lucide !== 'undefined') lucide.createIcons({ root: icon.parentElement }); }
}

function renderSnippetList() {
  const container = document.getElementById('snippet-list-container');
  if (!container) return;

  const searchInput = document.getElementById('snippet-search');
  const query = searchInput ? searchInput.value.trim() : '';

  let html = renderSnippetTreeRecursive(null, 0, query);

  // The pseudo-folder: uncategorized snippets, or your favourites (see libRootMode).
  const rootSnippets = libRootItems('snippets', state.snippets || []);
  const rootMeta = libRootMeta('snippets');
  let filteredRoot = rootSnippets;
  if (query) {
    filteredRoot = rootSnippets.filter(s =>
      libMatches(s, query, 'snippet')
    );
  }

  if (filteredRoot.length > 0 || state.nodes.filter(n => n.scope === 'snippet').length === 0) {
    const isActive = !activeSnippetId && activeSnippetFolderId === '__root__';
    const count = filteredRoot.length;
    if (count > 0 || !html) {
      // A real row: expandable, droppable, with a menu (see browse.js).
      const rootOpen = isNodeExpanded('__root__');
      html += `
        <div class="tree-node" data-level="0" data-node-id="__root__">
          <div class="tree-node-row ${isActive ? 'active' : ''}"
               ${treeRowAttrs({ ns: 'snippets', id: '__root__', kind: 'folder', level: 0, expanded: rootOpen, selected: isActive, draggable: false })}
               oncontextmenu="treeContextMenu(event, '__root__', 'snippets')"
               onclick="selectSnippetFolder('__root__')">
            <i data-lucide="chevron-right" class="tree-node-chevron ${count > 0 ? (rootOpen ? 'expanded' : '') : 'invisible'}"
               onclick="toggleSnippetFolder('__root__', event)"></i>
            <i data-lucide="${rootMeta.icon}" class="tree-node-icon item-icon-color"></i>
            <span class="tree-node-label" title="${escapeHTML(rootMeta.hint)}">${rootMeta.label}</span>
            <span class="tree-node-badge">${count}</span>
          </div>
          <div class="tree-children ${rootOpen ? '' : 'collapsed'}" role="group">
            <div class="tree-children-inner">
              ${renderSnippetTreeRecursive(null, 0, query, true, filteredRoot)}
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
    container.innerHTML = html + treeRootDropHTML('snippets');
  }
  container.dataset.treeNs = 'snippets';
  container.setAttribute('role', 'tree');
  container.setAttribute('aria-label', 'Snippet folders');
  container.classList.toggle('hide-tree-items', localStorage.getItem('snippetsHideItems') === 'true');

  // Attach right-click context to folder rows only (snippet file rows are
  // Folders use the shared menu (see the snippets host below). Attaching the
  // legacy one here as well meant one right-click opened two stacked menus —
  // the same bug the coding and notes trees had.

  // Right-click the empty pane: new folders and the row display toggles.
  if (_snippetContainerCtxHandler) {
    container.removeEventListener('contextmenu', _snippetContainerCtxHandler);
  }
  _snippetContainerCtxHandler = (e) => {
    if (e.target === container || e.target.closest('.empty-state')) {
      treePaneContextMenu(e, 'snippets');
    }
  };
  container.addEventListener('contextmenu', _snippetContainerCtxHandler);

  // Restore Window 1 Scroll Position
  setTimeout(() => {
    const pane1 = document.querySelector('.messenger-pane-1 .pane-1-content');
    if (pane1) pane1.scrollTop = getSessionParam('studySidebarScroll') || 0;
  }, 50);

  if (typeof lucide !== 'undefined') lucide.createIcons({ root: container });
}

/**
 * One pass in a single display order (see treeChildren), so a snippet dragged
 * above a folder stays above it instead of snapping back below.
 */
function renderSnippetTreeRecursive(parentId, depth, query, itemsOnly, rootList) {
  let html = '';

  // See browse.js: rootList is the pseudo-folder's contents.
  const entries = rootList ? rootList.map(n => ({ kind: 'item', node: n })) : treeChildren(parentId, 'snippet');

  entries.forEach(entry => {
    const node = entry.node;

    // See browse.js: the pseudo-folder lists root items only.
    if (itemsOnly && entry.kind === 'folder') return;

    if (entry.kind === 'folder') {
      const folder = node;
      const totalItems = countItemsRecursive(folder.id, 'snippet');
      const hasChildren = getChildFolders(folder.id, 'snippet').length > 0;
      const expanded = isNodeExpanded(folder.id);
      const isActive = !activeSnippetId && activeSnippetFolderId === folder.id;
      if (query && !folderHasMatchingSnippets(folder.id, query)) return;
      const chevronClass = (hasChildren || totalItems > 0) ? (expanded ? 'expanded' : '') : 'invisible';

      html += `
        <div class="tree-node" data-level="${depth}" data-node-id="${folder.id}">
          <div class="tree-node-row ${isActive ? 'active' : ''}"
               ${treeRowAttrs({ ns: 'snippets', id: folder.id, kind: 'folder', level: depth, expanded: expanded, selected: isActive })}
               style="padding-left: calc(0.5rem + 0rem)"
               oncontextmenu="treeContextMenu(event, '${folder.id}', 'snippets')"
               onclick="selectSnippetFolder('${folder.id}')">
            <i data-lucide="chevron-right" class="tree-node-chevron ${chevronClass}" onclick="toggleSnippetFolder('${folder.id}', event)"></i>
            <i data-lucide="${folder.icon || 'folder'}" class="tree-node-icon folder-icon-color"></i>
            <span class="tree-node-label">${escapeHTML(folder.name)}</span>
            ${typeof getTierBadgeHTML === 'function' ? getTierBadgeHTML(folder.tier) : ''}
            <span class="tree-node-badge">${totalItems}</span>
          </div>
          <div class="tree-children ${expanded || query ? '' : 'collapsed'}" role="group">
            <div class="tree-children-inner">
              ${renderSnippetTreeRecursive(folder.id, depth + 1, query)}
            </div>
          </div>
        </div>
      `;
      return;
    }

    // Snippet files — clicking one opens its detail view in pane 2.
    const sn = node;
    if (query && !libMatches(sn, query, 'snippet')) return;
    const isActive = activeSnippetId === sn.id;
    html += `
      <div class="tree-node tree-item-node${sn.color ? ' has-accent' : ''}" data-level="${depth + 1}" data-node-id="${sn.id}"${sn.color && typeof treeColorOf === 'function' ? ` style="--row-accent:${treeColorOf(sn.color)}"` : ''}>
        <div class="tree-node-row ${isActive ? 'active' : ''}"
             ${treeRowAttrs({ ns: 'snippets', id: sn.id, kind: 'item', level: depth + 1, selected: isActive })}
             style="padding-left: calc(0.5rem + ${TREE_ITEM_INSET}rem)"
             oncontextmenu="treeContextMenu(event, '${sn.id}', 'snippets')"
             onclick="selectSnippet('${sn.id}')">
          <i class="tree-node-chevron invisible"></i>
          <i data-lucide="code" class="tree-node-icon item-icon-color" style="width:14px;height:14px;"></i>
          <span class="tree-node-label" style="font-weight:400; font-size:0.875rem;">${escapeHTML(sn.title)}</span>
          ${snipShow('tags') && (sn.tags || []).length ? `<span class="tree-badge-tag">${escapeHTML(sn.tags[0])}</span>` : ''}
          ${sn.favorite ? '<i data-lucide="star" class="tree-node-star"></i>' : ''}
        </div>
      </div>
    `;
  });

  return html;
}

function folderHasMatchingSnippets(folderId, query) {
  const items = getItemsInFolder(folderId, 'snippet');
  if (items.some(s => libMatches(s, query, 'snippet'))) return true;
  const childFolders = getChildFolders(folderId, 'snippet');
  return childFolders.some(cf => folderHasMatchingSnippets(cf.id, query));
}

function renderSnippetItem(s, depth) {
  return ''; // Deprecated: Snippets are now rendered in the right pane via renderSnippetFolderOverview
}

function toggleSnippetFolder(nodeId, e) {
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
    renderSnippetList();
  }
}

function selectSnippetFolder(folderId) {
  const pane1 = document.querySelector('.messenger-pane-1 .pane-1-content');
  if (pane1) setSessionParam('studySidebarScroll', pane1.scrollTop);

  activeSnippetFolderId = folderId;
  activeSnippetId = null;
  setSessionParam('activeSnippetId', null);
  setSessionParam('studyOpenCat', folderId);
  setSessionParam('snippetPage', 1);

  renderSnippetList();
  renderSnippetDetail();
}


function selectSnippet(id) {
  const pane1 = document.querySelector('.messenger-pane-1 .pane-1-content');
  if (pane1) setSessionParam('studySidebarScroll', pane1.scrollTop);

  const searchInput = document.getElementById('snippet-search');
  const wasSearching = searchInput && searchInput.value.trim() !== '';

  if (wasSearching) {
    // Clear search
    searchInput.value = '';

    const snippet = (state.snippets || []).find(s => s.id === id);
    if (snippet) {
      activeSnippetFolderId = snippet.parentId || null;
      setSessionParam('studyOpenCat', activeSnippetFolderId);

      // Expand tree
      if (activeSnippetFolderId) {
        let curr = state.nodes.find(n => n.id === activeSnippetFolderId);
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

  activeSnippetId = id;
  setSessionParam('activeSnippetId', id);

  if (wasSearching) {
    // Scroll to card
    setTimeout(() => {
      const detailHeader = document.querySelector('.snippet-detail');
      if (detailHeader) {
        detailHeader.classList.add('pulse-highlight');
        setTimeout(() => detailHeader.classList.remove('pulse-highlight'), 2000);
      }
    }, 100);
  }

  renderSnippetList();
  renderSnippetDetail();
}

function renderSnippetDetail() {
  const container = document.getElementById('snippet-detail-container');
  const snippet = (state.snippets || []).find(s => s.id === activeSnippetId);

  if (!snippet) {
    if (activeSnippetFolderId) {
      renderSnippetFolderOverview(container);
    } else {
      container.innerHTML = `
        <div class="empty-state" style="height: 100%; display: flex; align-items: center; justify-content: center; flex-direction: column;">
          <i data-lucide="folder-open" style="width: 48px; height: 48px; opacity: 0.5; margin-bottom: 1rem;"></i>
          <h2>Select a folder</h2>
          <p style="font-size: 0.875rem; color: var(--text-tertiary); margin-top: 0.5rem;">Choose a folder from the left pane to view its snippets.</p>
        </div>
      `;
      if (typeof lucide !== 'undefined') lucide.createIcons({ root: container });
    }
    return;
  }

  // Comments may be Quill HTML or legacy plain text. Sanitize the HTML branch
  // (prevents XSS from shared snippets); escape the plain-text branch.
  const commentsContent = snippet.comments
    ? (snippet.comments.trim().startsWith('<') ? sanitizeUserHTML(snippet.comments) : escapeHTML(snippet.comments))
    : '<p>No specific comments attached to this snippet.</p>';

  const isRoot = !snippet.parentId;
  let breadcrumbHtml = `<nav class="breadcrumb-nav" style="margin-bottom: 1rem;">`;
  breadcrumbHtml += `<button class="breadcrumb-item" style="cursor:default;"><i data-lucide="home" style="width:12px;height:12px;"></i></button>`;

  if (isRoot) {
    breadcrumbHtml += `<span class="breadcrumb-separator"><i data-lucide="chevron-right"></i></span>`;
    breadcrumbHtml += `<span class="breadcrumb-current">Uncategorized</span>`;
  } else {
    const pathNodes = getBreadcrumbPath(snippet.parentId);
    pathNodes.forEach((node, idx) => {
      breadcrumbHtml += `<span class="breadcrumb-separator"><i data-lucide="chevron-right"></i></span>`;
      breadcrumbHtml += `<button class="breadcrumb-item" onclick="toggleSnippetFolder('${node.id}')">${escapeHTML(node.name)}</button>`;
    });
  }
  breadcrumbHtml += `</nav>`;

  container.innerHTML = `
    <div class="snippet-detail animate-fade-in">
      <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 1.5rem; margin-bottom: 1.5rem;">
        ${breadcrumbHtml}
        <h2 style="font-size: 1.75rem; font-weight: 800; color: var(--text-primary); margin-bottom: 0.75rem;">${escapeHTML(snippet.title)}</h2>
        <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
          ${(snippet.tags || []).map(t => `<span class="badge badge-primary">${escapeHTML(t)}</span>`).join('')}
        </div>
      </div>
      
      <div class="snippet-detail-body">
        
        ${snippet.description ? `
          <div class="snippet-rich-desc ql-snow" style="line-height: 1.6; color: var(--text-secondary); margin-bottom: 2.5rem;">
            <div class="ql-editor" style="padding:0;">
               ${sanitizeUserHTML(snippet.description)}
            </div>
          </div>
        ` : ''}
        
        <div style="margin-bottom: 2.5rem;">
          <h3 style="font-size: 1.125rem; font-weight: 700; margin-bottom: 0.75rem; color: var(--text-primary); display: flex; align-items: center; gap: 0.5rem;">
            <i data-lucide="message-square" style="width:18px;height:18px;color:var(--text-tertiary);"></i> Comments & Notes
          </h3>
          <div class="snippet-comments-display ql-snow" style="background: var(--bg-surface-hover); border: 1px solid var(--border-color); border-left: 3px solid var(--color-accent); padding: 1rem 1.25rem; border-radius: var(--radius-md); font-size: 0.9rem; color: var(--text-secondary); line-height: 1.6;">
            <div class="ql-editor" style="padding:0; font-family: inherit; font-size: inherit;">
               ${commentsContent}
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 1rem; flex-wrap: wrap; background: var(--bg-surface-hover); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
          <button class="btn btn-primary" onclick="openExamplesModal()" id="view-examples-btn">
            <i data-lucide="code" style="width: 16px; height: 16px;"></i> View Examples (${(snippet.examples || []).length})
          </button>
          <button class="btn btn-secondary" onclick="openTryCodingModal()" id="try-coding-btn" style="border-color: var(--color-accent); color: var(--color-accent);">
            <i data-lucide="terminal" style="width: 16px; height: 16px;"></i> Try Coding
          </button>
          <button class="btn btn-secondary" onclick="openRelatedChallengesModal()" id="related-challenges-btn">
            <i data-lucide="link" style="width: 16px; height: 16px;"></i> Linked Challenges
          </button>
          <button class="btn btn-secondary" onclick="shareSnippet('${snippet.id}')" id="share-snippet-btn">
            <i data-lucide="share-2" style="width: 16px; height: 16px;"></i> Share
          </button>
        </div>
      </div>
    </div>
  `;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: container });
}

// ============================================================
// SNIPPET FILTER & SORT (parity with Coding Library)
// ============================================================
function _getSnippetStatusFilter() { return getLibPref('snippet.status', 'all'); }
function _getSnippetSort() { return getLibPref('snippet.sort', 'default'); }
function _getSnippetLangFilter() { return getLibPref('snippet.lang', 'all'); }
function setSnippetStatusFilter(v) { setLibPref('snippet.status', v); setSessionParam('snippetPage', 1); renderSnippetDetail(); }
function setSnippetSort(v) { setLibPref('snippet.sort', v); setSessionParam('snippetPage', 1); renderSnippetDetail(); }
function setSnippetLangFilter(v) { setLibPref('snippet.lang', v); setSessionParam('snippetPage', 1); renderSnippetDetail(); }
function clearSnippetFilters() {
  setLibPref('snippet.status', 'all');
  setLibPref('snippet.lang', 'all');
  setLibPref('snippet.sort', 'default');
  libClearCommonFilters('snippet');
  setSessionParam('snippetPage', 1);
  renderSnippetDetail();
}

/** A snippet's language, for grouping. Falls back to the file extension. */
function getSnippetLanguage(s) {
  const l = (s && s.language || '').trim();
  if (l) return l.toLowerCase();
  const ext = (s && s.ext || '').replace('.', '').toLowerCase();
  return ext || '';
}

/** Try-Coding attempts recorded against this snippet. */
function _snippetAttempts(s) {
  return (state.snippetHistory || []).filter(h => h.snippetId === s.id && !h.isArchived);
}
function _snippetBestPct(s) {
  const a = _snippetAttempts(s);
  return a.length ? Math.max(...a.map(x => x.score || 0)) : -1;
}

function snippetPage(page) {
  const totalItems = (state.snippets || []).length;
  const maxPage = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  page = Math.max(1, Math.min(page, maxPage));
  setSessionParam('snippetPage', page);
  renderSnippetDetail();
}

function _snippetReviewRec(s) { return (state.review && state.review['snippet:' + s.id]) || null; }
function _snippetStatus(s) {
  const r = _snippetReviewRec(s);
  if (!r) return 'new';
  if (r.due && typeof _revToday === 'function' && r.due <= _revToday()) return 'due';
  return 'learning';
}
function _applySnippetFilterSort(list) {
  const status = _getSnippetStatusFilter();
  const lang = _getSnippetLangFilter();
  const sort = _getSnippetSort();
  let out = libApplyCommonFilters('snippet', list.slice(), 'snippet');
  if (status !== 'all') out = out.filter(s => _snippetStatus(s) === status);
  if (lang !== 'all') out = out.filter(s => getSnippetLanguage(s) === lang);
  if (sort === 'title') out.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  else if (sort === 'reviewed') out.sort((a, b) => { const ra = _snippetReviewRec(a), rb = _snippetReviewRec(b); return ((rb && rb.last) || '').localeCompare((ra && ra.last) || ''); });
  else if (sort === 'attempts') out.sort((a, b) => _snippetAttempts(b).length - _snippetAttempts(a).length);
  else if (sort === 'best') out.sort((a, b) => _snippetBestPct(b) - _snippetBestPct(a));
  else if (sort === 'weakest') out.sort((a, b) => _snippetBestPct(a) - _snippetBestPct(b));
  else if (sort === 'due') {
    const overdue = s => { const r = _snippetReviewRec(s); return (r && r.due) ? _revDaysBetween(r.due, _revToday()) : -Infinity; };
    out.sort((a, b) => overdue(b) - overdue(a));
  }
  // Direction is applied before favourites float, so starring something keeps
  // it on top whichever way the list is running.
  out = libApplySortDir('snippet', out);

  out.sort((a, b) => (libIsFavorite(b) ? 1 : 0) - (libIsFavorite(a) ? 1 : 0));
  return out;
}
function _renderSnippetFilterBar(total, shown, pool) {
  const status = _getSnippetStatusFilter();
  const lang = _getSnippetLangFilter();
  const sort = _getSnippetSort();
  const chips = [['all', 'All'], ['new', 'New'], ['due', 'Due'], ['learning', 'Learning']]
    .map(([v, l]) => libChipHTML(status === v, `setSnippetStatusFilter('${v}')`, l)).join('');
  // Language chips are built from what's actually in the pool.
  const langs = [...new Set((pool || []).map(getSnippetLanguage).filter(Boolean))].sort();
  const langChips = langs.length
    ? libChipHTML(lang === 'all', `setSnippetLangFilter('all')`, 'Any') +
      langs.map(l => libChipHTML(lang === l, `setSnippetLangFilter('${l}')`, escapeHTML(l.toUpperCase()))).join('')
    : '';
  const sortOpts = [['default', 'Folder order'], ['due', 'Most overdue'], ['reviewed', 'Recently reviewed'],
                    ['title', 'Title A–Z'], ['attempts', 'Most attempts'], ['best', 'Best score'], ['weakest', 'Weakest first']];
  const sortSel = `<select onchange="setSnippetSort(this.value)" class="form-select lib-sort-select" title="Sort order">${sortOpts.map(([v, l]) => `<option value="${v}"${sort === v ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
  const filtered = status !== 'all' || lang !== 'all' || libAnyCommonFilterActive('snippet');
  const tag = libGetTagFilter('snippet');
  const active = [];
  if (status !== 'all') active.push({ label: status[0].toUpperCase() + status.slice(1), clear: `setSnippetStatusFilter('all')` });
  if (lang !== 'all') active.push({ label: lang.toUpperCase(), clear: `setSnippetLangFilter('all')` });
  if (getLibPref('snippet.fav', false)) active.push({ label: '★ Favourites', clear: `libToggleFlag('snippet','fav')` });
  if (getLibPref('snippet.due', false)) active.push({ label: 'Due', clear: `libToggleFlag('snippet','due')` });
  if (tag !== 'all') active.push({ label: '#' + escapeHTML(tag), clear: `libSetTagFilterExact('snippet','all')` });

  return libFilterShellHTML({
    ns: 'snippet',
    countLabel: filtered ? `${shown} of ${total}` : `${total} snippet${total !== 1 ? 's' : ''}`,
    active,
    onClear: 'clearSnippetFilters()',
    sort: sortSel,
    view: `<label class="lib-view-row">
      <input type="checkbox" ${getSessionParam('hideSubfolders') === 'false' ? 'checked' : ''}
             onchange="setSessionParam('hideSubfolders', this.checked ? 'false' : 'true'); renderSnippetDetail();" />
      <span><strong>Subfolders</strong><em>Show subfolder tiles above the cards</em></span>
    </label>`,
    groups: [
      { icon: 'filter', chips },
      langChips ? { icon: 'code', chips: langChips } : null,
      { icon: 'star', chips: libCommonChipsHTML('snippet', 'snippet', pool) },
      { icon: 'list-ordered', chips: libSortTypeChipsHTML('snippet', 'setSnippetSort', sort, 'reviewed') },
      { icon: 'arrow-up-down', chips: libSortDirChipsHTML('snippet') },
      { icon: 'tag', chips: _libTagChipsOnly('snippet', pool) },
    ]
  });
}

registerLibAdapter('snippet', {
  scope: 'snippet',
  noun: 'snippet',
  list: () => state.snippets || [],
  find: (id) => (state.snippets || []).find(s => s.id === id),
  remove: (id) => { if (typeof softDeleteSnippet === 'function') softDeleteSnippet(id, () => {}); },
  rerender: () => { renderSnippetList(); renderSnippetDetail(); }
});

/** Copy a snippet's code. This is a REFERENCE library — copying is the point,
    and until now it wasn't even an action. */
function copySnippetCode(id, btn) {
  const s = (state.snippets || []).find(x => x.id === id);
  if (!s) return;
  const code = s.code || (s.examples && s.examples[0] && s.examples[0].code) || '';
  if (!code) { if (typeof toast === 'function') toast('This snippet has no code to copy.', { type: 'warning' }); return; }
  navigator.clipboard.writeText(code).then(() => {
    if (btn) {
      const old = btn.innerHTML;
      btn.innerHTML = '<i data-lucide="check" style="width:14px;height:14px;"></i> Copied';
      if (typeof lucide !== 'undefined') lucide.createIcons({ root: btn });
      setTimeout(() => { btn.innerHTML = old; if (typeof lucide !== 'undefined') lucide.createIcons({ root: btn }); }, 1500);
    } else if (typeof toast === 'function') { toast('Copied.', { type: 'success' }); }
  }).catch(() => { if (typeof toast === 'function') toast('Could not copy.', { type: 'error' }); });
}

/** Snippets that name this challenge in their Related Challenges list.
    The link was one-directional: a snippet knew its programs, never the reverse. */
function snippetsForChallenge(challengeId) {
  return (state.snippets || []).filter(s => (s.relatedChallenges || []).includes(challengeId));
}

// Inline folder name/description editing (parity with Coding Library).
function snippetEditFolderTitle(el, id) { inlineEditFolderTitle(el, id, () => { renderSnippetList(); renderSnippetDetail(); }); }
function snippetEditFolderDesc(el, id) { inlineEditFolderDesc(el, id); }

function renderSnippetFolderOverview(container) {
  const searchInput = document.getElementById('snippet-search');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  const isRoot = activeSnippetFolderId === '__root__';
  const folder = isRoot ? null : state.nodes.find(n => n.id === activeSnippetFolderId);

  let breadcrumbHtml = `<nav class="breadcrumb-nav" style="margin-bottom: 1.5rem;">`;
  breadcrumbHtml += `<button class="breadcrumb-item" onclick="selectSnippetFolder('__root__')"><i data-lucide="home" style="width:12px;height:12px;"></i></button>`;

  if (isRoot) {
    breadcrumbHtml += `<span class="breadcrumb-separator"><i data-lucide="chevron-right"></i></span>`;
    breadcrumbHtml += `<span class="breadcrumb-current">Uncategorized</span>`;
  } else if (folder) {
    const pathNodes = getBreadcrumbPath(folder.id);
    pathNodes.forEach((node, idx) => {
      breadcrumbHtml += `<span class="breadcrumb-separator"><i data-lucide="chevron-right"></i></span>`;
      if (idx < pathNodes.length - 1) {
        breadcrumbHtml += `<button class="breadcrumb-item" onclick="selectSnippetFolder('${node.id}')">${escapeHTML(node.name)}</button>`;
      } else {
        breadcrumbHtml += `<span class="breadcrumb-current">${escapeHTML(node.name)}</span>`;
      }
    });
  }
  breadcrumbHtml += `</nav>`;

  const folderId = isRoot ? null : activeSnippetFolderId;
  let snippets = [];
  let childFolders = [];

  if (query) {
    snippets = (state.snippets || []).filter(s => libMatches(s, query, 'snippet'));
  } else {
    snippets = (state.snippets || []).filter(s => s.parentId === folderId);
    childFolders = isRoot ? [] : getChildFolders(activeSnippetFolderId, 'snippet');
  }

  const _preFilterSnippets = snippets;
  snippets = _applySnippetFilterSort(snippets);

  let subfoldersHtml = '';
  if (childFolders.length > 0) {
    subfoldersHtml = `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.75rem; margin-bottom: 1.5rem;">`;
    childFolders.forEach(sf => {
      const sfCount = countItemsRecursive(sf.id, 'snippet');
      subfoldersHtml += `
        <div class="subfolder-card" onclick="selectSnippetFolder('${sf.id}'); toggleNodeExpanded('${sf.id}');">
          <div style="display:flex; align-items:center; gap:0.5rem; font-weight: 600;">
            <i data-lucide="${sf.icon || 'folder'}" style="color:var(--color-primary); width: 18px; height: 18px;"></i>
            ${escapeHTML(sf.name)}
          </div>
          <span style="font-size: 0.8rem; color: var(--text-tertiary);">${sfCount} item${sfCount !== 1 ? 's' : ''}</span>
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

  if (_preFilterSnippets.length === 0 && childFolders.length === 0) {
    container.innerHTML = breadcrumbHtml + `
      <div class="empty-state" style="height: 60%; display: flex; align-items: center; justify-content: center; flex-direction: column;">
        <i data-lucide="folder-open" style="width: 48px; height: 48px; opacity: 0.5; margin-bottom: 1rem;"></i>
        <h2>No snippets found</h2>
        <p style="font-size: 0.875rem; margin-top: 0.5rem; color: var(--text-tertiary);">
          ${query ? `No results for "${escapeHTML(query)}"` : `No snippets available in ${escapeHTML(folderName)}.`}
        </p>
      </div>`;
  } else {
    const hideSubfolders = getSessionParam('hideSubfolders') !== 'false';
    const filterBarHtml = _preFilterSnippets.length > 0 ? _renderSnippetFilterBar(_preFilterSnippets.length, snippets.length, _preFilterSnippets) : '';

    // ---- Pagination ----
    let currentSnippetPage = parseInt(getSessionParam('snippetPage'), 10) || 1;
    const totalSnippetPages = Math.max(1, Math.ceil(snippets.length / ITEMS_PER_PAGE));
    if (currentSnippetPage > totalSnippetPages) currentSnippetPage = totalSnippetPages;
    if (currentSnippetPage < 1) currentSnippetPage = 1;
    const pagedSnippets = snippets.slice((currentSnippetPage - 1) * ITEMS_PER_PAGE, currentSnippetPage * ITEMS_PER_PAGE);

    const gridHtml = snippets.length > 0
      ? `<div class="card-grid stagger-children">
          ${pagedSnippets.map(s => {
            const tHtml = (s.tags || []).map(t => libTagBadgeHTML('snippet', t)).join('');
            const exCount = (s.examples || []).length;
            const linkedCount = (s.relatedChallenges || []).length;
            // Quill stores rich HTML — strip tags for a plain-text preview
            const descText = (s.description || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
            const canTry = (s.tryCodingTargetIndices || []).length > 0 || (s.examples || []).some(e => (e.code || '').trim());
            const attempts = _snippetAttempts(s).length;
            const best = _snippetBestPct(s);
            const scoreClass = best === 100 ? 'score-perfect' : best >= 50 ? 'score-partial' : best >= 0 ? 'score-low' : '';
            const lang = getSnippetLanguage(s);
            const selecting = libSelectMode('snippet');
            return `
              <div class="card card-enhanced${libIsSelected('snippet', s.id) ? ' lib-selected' : ''}"
                   onclick="${selecting ? `libToggleSelect('snippet','${s.id}')` : `selectSnippet('${s.id}')`}" style="cursor: pointer;">
                ${libSelectBoxHTML('snippet', s.id)}
                ${libFavButtonHTML('snippet', s)}
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem; gap:0.5rem;">
                  <h3 style="font-weight:700; font-size:1.1rem; color:var(--text-primary); flex:1; display:flex; align-items:center; gap:0.5rem; min-width:0;">
                    <i data-lucide="code" style="width:18px;height:18px;color:var(--color-accent);flex-shrink:0;"></i>
                    <span style="overflow:hidden;text-overflow:ellipsis;">${escapeHTML(s.title)}</span>
                    ${lang ? `<span class="lib-lang-badge">${escapeHTML(lang.toUpperCase())}</span>` : ''}
                  </h3>
                  <span class="version-pill">${exCount} example${exCount !== 1 ? 's' : ''}</span>
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:0.375rem; margin-bottom:0.75rem;">
                  ${libReviewChipHTML('snippet', s.id)}
                  ${attempts ? `<span class="badge badge-neutral"><i data-lucide="rotate-ccw" style="width:12px;height:12px;margin-right:2px;"></i> ${attempts} Attempt${attempts !== 1 ? 's' : ''}</span>` : ''}
                  ${best >= 0 ? `<span class="badge ${scoreClass}"><i data-lucide="target" style="width:12px;height:12px;margin-right:2px;"></i> Best: ${best}%</span>` : ''}
                  ${canTry ? '<span class="badge badge-neutral"><i data-lucide="terminal" style="width:12px;height:12px;margin-right:2px;"></i> Try Coding</span>' : ''}
                  ${linkedCount > 0 ? `<span class="badge badge-neutral"><i data-lucide="link-2" style="width:12px;height:12px;margin-right:2px;"></i> ${linkedCount} Linked</span>` : ''}
                  ${tHtml}
                </div>
                <p class="line-clamp-2" style="font-size:0.875rem; color:var(--text-secondary); margin-bottom:0.75rem; min-height:2.5rem;">
                  ${escapeHTML(descText || 'No description.')}
                </p>
                ${best >= 0 ? `<div class="card-score-bar"><div class="card-score-fill ${scoreClass}" style="width:${best}%;"></div></div>` : ''}
                <div style="margin-top:auto; display:flex; gap:0.5rem; padding-top:0.5rem;">
                  <button onclick="event.stopPropagation(); selectSnippet('${s.id}')" class="btn btn-practice" style="flex:1;">
                    <i data-lucide="book-open" style="width:16px;height:16px;"></i> Study
                  </button>
                  <button class="btn btn-ghost" title="Copy the code" onclick="event.stopPropagation(); copySnippetCode('${s.id}', this)" style="padding:0.5rem;">
                    <i data-lucide="copy" style="width:16px;height:16px;"></i>
                  </button>
                  <button class="btn btn-ghost" title="Share Link" onclick="event.stopPropagation(); shareSnippet('${s.id}')" style="padding:0.5rem;">
                    <i data-lucide="share-2" style="width:16px;height:16px;"></i>
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
        ${_buildPaginationBar(snippets.length, currentSnippetPage, 'snippetPage')}
        ${libSelectionBarHTML('snippet', pagedSnippets.map(s => s.id))}`
      : (_preFilterSnippets.length > 0
        ? `<div class="empty-state" style="padding:2.5rem 1rem; text-align:center; display:flex; flex-direction:column; align-items:center;">
            <i data-lucide="filter-x" style="width:36px;height:36px;opacity:0.5;margin-bottom:0.75rem;"></i>
            <h3 style="font-weight:700;">No snippets match these filters</h3>
            <button class="btn btn-secondary btn-sm" onclick="clearSnippetFilters()" style="margin-top:0.75rem;"><i data-lucide="x" style="width:14px;height:14px;"></i> Clear filters</button>
          </div>`
        : '');

    const canEdit = folder && !query;
    const titleAttrs = canEdit
      ? `class="browse-folder-title" onclick="snippetEditFolderTitle(this, '${folder.id}')" title="Click to edit name"`
      : `class="browse-folder-title" style="cursor:default;"`;
    const descAttrs = canEdit
      ? `class="browse-folder-desc" onclick="snippetEditFolderDesc(this, '${folder.id}')" title="Click to edit description"`
      : `class="browse-folder-desc" style="cursor:default;"`;
    const descInner = (folder && folder.description)
      ? escapeHTML(folder.description)
      : (canEdit ? '<span style="color:var(--text-tertiary);font-style:italic;">Click to add a description...</span>' : 'Select a snippet below to view its details.');

    container.innerHTML = breadcrumbHtml + `
      <div class="animate-fade-in">
        <div class="browse-folder-header">
          <div class="browse-folder-info">
              <h2 ${titleAttrs}>${escapeHTML(folderName)}</h2>
              <p ${descAttrs}>${descInner}</p>
          </div>
          <div class="browse-folder-actions">
              ${libSelectToggleHTML('snippet')}
              <button class="btn btn-ghost" onclick="showConfirm('Toggle Visibility', 'Are you sure you want to ' + (${hideSubfolders} ? 'show' : 'hide') + ' subfolders?', () => { setSessionParam('hideSubfolders', '${!hideSubfolders}'); renderSnippetDetail(); })" title="Toggle Subfolders" style="padding: 0.5rem;">
                  <i data-lucide="${hideSubfolders ? 'eye-off' : 'eye'}"></i>
              </button>
          </div>
      </div>
      ${filterBarHtml}
      ${hideSubfolders ? '' : subfoldersHtml}
      ${gridHtml}
      </div>
    `;
  }

  if (typeof lucide !== 'undefined') lucide.createIcons({ root: container });
}

// === EXAMPLES MODAL ===
function openExamplesModal() {
  const snippet = (state.snippets || []).find(s => s.id === activeSnippetId);
  if (!snippet) return;

  currentSnippetVariants = snippet.examples || [];
  activeExampleIndex = 0;

  document.getElementById('examples-modal-title').innerText = `${snippet.title} — Examples`;
  const modal = document.getElementById('examples-modal');
  modal.classList.remove('hidden');

  renderExamplesModal();
}

function closeExamplesModal() {
  document.getElementById('examples-modal').classList.add('hidden');
}

function renderExamplesModal() {
  const tabsContainer = document.getElementById('examples-tabs');
  const contentContainer = document.getElementById('examples-content');

  if (currentSnippetVariants.length === 0) {
    tabsContainer.innerHTML = '';
    contentContainer.innerHTML = `<div class="empty-state" style="padding: 2rem;">
      <i data-lucide="code" style="width: 32px; height: 32px; margin-bottom: 1rem; opacity: 0.5;"></i>
      <h3 style="font-weight: 600;">No examples</h3>
      <p style="font-size: 0.875rem; color: var(--text-tertiary);">No code examples have been added to this snippet yet.</p>
    </div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: contentContainer });
    return;
  }

  tabsContainer.innerHTML = currentSnippetVariants.map((ex, i) => `
    <div onclick="switchExampleTab(${i})" class="variant-tab ${i === activeExampleIndex ? 'active' : ''}">
      ${escapeHTML(ex.name || 'Example ' + (i + 1))}
    </div>
  `).join('');

  const activeEx = currentSnippetVariants[activeExampleIndex];
  const codeStr = activeEx.code || '';

  const highlightSet = new Set();
  if (activeEx.highlightLines) {
    activeEx.highlightLines.split(',').forEach(part => {
      const p = part.trim();
      if (p.includes('-')) {
        const [start, end] = p.split('-').map(Number);
        if (!isNaN(start) && !isNaN(end)) {
          for (let l = start; l <= end; l++) highlightSet.add(l);
        }
      } else {
        const num = Number(p);
        if (!isNaN(num)) highlightSet.add(num);
      }
    });
  }

  const lines = codeStr.split('\n');
  const highlightedLines = lines.map((line, idx) => {
    const lineNum = idx + 1;
    const highlighted = syntaxHighlight(line);
    if (highlightSet.has(lineNum)) {
      return `<span class="example-line example-line-highlight">${highlighted}\n</span>`;
    }
    return `<span class="example-line">${highlighted}\n</span>`;
  }).join('');

  contentContainer.innerHTML = `
    <div class="editor-container" style="min-height: 200px; border-radius: var(--radius-md); height: auto; display: block; overflow: hidden;">
      <pre id="example-view-pre" class="editor-pre" style="position: relative; height: auto; overflow-x: auto; overflow-y: hidden;"><code id="example-view-code" style="height: auto;">${highlightedLines}</code></pre>
    </div>
  `;
  // (The examples view is a read-only <pre>; there is no textarea to sync scroll with.)
}

function switchExampleTab(idx) {
  activeExampleIndex = idx;
  renderExamplesModal();
}

// === TRY CODING MODAL ===
function openTryCodingModal() {
  const snippet = (state.snippets || []).find(s => s.id === activeSnippetId);
  if (!snippet) return;

  const examples = snippet.examples || [];
  if (examples.length === 0) {
    if (typeof showMessage === 'function') {
      showMessage("No Examples", "This snippet has no code examples to practice with. Add examples in the Admin panel first.", true);
    }
    return;
  }

  let targetIndices = snippet.tryCodingTargetIndices;
  if (!targetIndices || targetIndices.length === 0) {
    targetIndices = [snippet.tryCodingExampleIndex || 0];
  }

  targetIndices = targetIndices.filter(idx => idx >= 0 && idx < examples.length);
  if (targetIndices.length === 0) targetIndices = [0];

  tryCodingTargetCodes = targetIndices.map(idx => examples[idx].code || '');
  tryCodingTargetStarterCode = snippet.starterCode || '';
  tryCodingStartTime = Date.now();

  const targetNames = targetIndices.map(idx => examples[idx].name || ('Example ' + (idx + 1))).join(' OR ');

  document.getElementById('try-coding-title').innerHTML = `
    <i data-lucide="terminal" style="width:24px; height:24px; display:inline; vertical-align:middle; margin-right:0.5rem;"></i>
    Try Coding — ${escapeHTML(snippet.title)}
  `;
  document.getElementById('try-coding-desc').innerHTML = `
    <strong>Target:</strong> ${escapeHTML(targetNames)} — Type the code from memory, then click <strong>Check Code</strong> to compare.
  `;

  const textarea = document.getElementById('try-coding-textarea');
  const codeEl = document.getElementById('try-coding-code');
  textarea.value = tryCodingTargetStarterCode;
  codeEl.innerHTML = syntaxHighlight(tryCodingTargetStarterCode) + '<br/>';

  const resultEl = document.getElementById('try-coding-result');
  resultEl.style.display = 'none';
  resultEl.innerHTML = '';

  document.getElementById('try-coding-modal').classList.remove('hidden');

  if (typeof setupSpecificEditor === 'function') {
    setupSpecificEditor('try-coding-textarea', 'try-coding-pre', 'try-coding-code', false);
  }

  const finalTA = document.getElementById('try-coding-textarea');
  finalTA.addEventListener('input', () => {
    const codePreEl = document.getElementById('try-coding-code');
    if (codePreEl) {
      codePreEl.innerHTML = syntaxHighlight(finalTA.value) + '<br/>';
    }
  });

  const tryCodingModal = document.getElementById('try-coding-modal');
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: tryCodingModal });
  finalTA.focus();
}

function closeTryCodingModal() {
  document.getElementById('try-coding-modal').classList.add('hidden');
  if (typeof _snipTermClose === 'function') {
    _snipTermClose();
  }
}

function resetTryCoding() {
  const textarea = document.getElementById('try-coding-textarea');
  const codeEl = document.getElementById('try-coding-code');

  textarea.value = tryCodingTargetStarterCode;
  codeEl.innerHTML = syntaxHighlight(tryCodingTargetStarterCode) + '<br/>';

  const resultEl = document.getElementById('try-coding-result');
  resultEl.style.display = 'none';
  resultEl.innerHTML = '';
  textarea.focus();
}

function checkTryCoding() {
  const textarea = document.getElementById('try-coding-textarea');
  const userCode = textarea.value;

  if (!userCode.trim()) {
    if (typeof showMessage === 'function') {
      showMessage("Empty Code", "Please type some code before checking.", true);
    }
    return;
  }

  let bestPercentage = -1;
  let isPerfect = false;
  let matchedTargetCode = '';

  for (const targetCode of tryCodingTargetCodes) {
    const { diffs, scoreCount, cLinesLen } = computeDiffs(userCode, targetCode);
    const percentage = Math.min(Math.round((scoreCount / cLinesLen) * 100), 100);

    if (percentage > bestPercentage) {
      bestPercentage = percentage;
      matchedTargetCode = targetCode;
    }
  }

  isPerfect = bestPercentage === 100;
  const percentage = bestPercentage;

  // Spaced-repetition: a "Try Coding" attempt counts as a snippet review.
  if (typeof recordReview === 'function' && activeSnippetId) recordReview('snippet', activeSnippetId, bestPercentage);

  // Record snippet attempt history log
  if (!state.snippetHistory) state.snippetHistory = [];
  const duration = tryCodingStartTime ? Math.round((Date.now() - tryCodingStartTime) / 1000) : 0;
  const today = new Date();
  const dateStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
  const timeStr = today.toLocaleTimeString();

  const snippet = (state.snippets || []).find(s => s.id === activeSnippetId);

  state.snippetHistory.unshift({
    id: generateId(),
    snippetId: activeSnippetId,
    snippetTitle: snippet ? snippet.title : 'Unknown Snippet',
    score: bestPercentage,
    date: dateStr,
    time: timeStr,
    duration: duration,
    userCode: userCode,
    expectedCode: matchedTargetCode || tryCodingTargetCodes[0] || ''
  });
  saveData();

  const resultEl = document.getElementById('try-coding-result');
  resultEl.style.display = 'block';

  if (isPerfect) {
    resultEl.innerHTML = `
      <div style="background: var(--color-success-bg); border: 1px solid var(--color-success); border-radius: var(--radius-md); padding: 1rem; display: flex; align-items: center; gap: 0.75rem;">
        <i data-lucide="check-circle-2" style="width:28px; height:28px; color: var(--color-success); flex-shrink:0;"></i>
        <div>
          <div style="font-weight: 700; color: var(--color-success); font-size: 1.125rem;">Perfect Match! 🎉</div>
          <div style="font-size: 0.8125rem; color: var(--text-secondary);">Your code matches the target exactly. Well done!</div>
        </div>
      </div>
    `;
  } else {
    resultEl.innerHTML = `
      <div style="background: var(--color-warning-bg); border: 1px solid var(--color-warning); border-radius: var(--radius-md); padding: 1rem; display: flex; align-items: center; gap: 0.75rem;">
        <div style="background: var(--color-warning); color: white; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.875rem; flex-shrink:0;">${percentage}%</div>
        <div>
          <div style="font-weight: 700; color: var(--color-warning); font-size: 1.125rem;">${percentage}% Match</div>
          <div style="font-size: 0.8125rem; color: var(--text-secondary);">Keep practicing! Review your code and try again.</div>
        </div>
      </div>
    `;
  }

  const tryCodingResult = document.getElementById('try-coding-result') || document.getElementById('try-coding-modal');
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: tryCodingResult });
}

// === RELATED CHALLENGES MODAL ===
function openRelatedChallengesModal() {
  const relModal = document.getElementById('related-challenges-modal');
  relModal.classList.remove('hidden');
  const searchInput = document.getElementById('related-search');
  if (searchInput) searchInput.value = '';
  renderRelatedChallengesList();
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: relModal });
}

function closeRelatedChallengesModal() {
  document.getElementById('related-challenges-modal').classList.add('hidden');
}

function renderRelatedChallengesList() {
  const container = document.getElementById('related-challenges-list');
  const searchInput = document.getElementById('related-search');
  const query = searchInput ? searchInput.value.trim() : '';

  const snippet = (state.snippets || []).find(s => s.id === activeSnippetId);
  if (!snippet) return;

  const linkedIds = snippet.relatedChallenges || [];
  let challenges = state.challenges.filter(c => linkedIds.includes(c.id));

  if (query) {
    challenges = challenges.filter(c =>
      fuzzyMatch(c.title, query) ||
      (c.tags || []).some(t => fuzzyMatch(t, query)) ||
      (() => { const f = state.nodes.find(n => n.id === c.parentId); return fuzzyMatch(f ? f.name : 'Uncategorized', query); })()
    );
  }

  if (challenges.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 2rem;">
        <i data-lucide="search-x" style="width: 32px; height: 32px; margin-bottom: 0.75rem; opacity: 0.5;"></i>
        <h3 style="font-weight: 600;">No linked challenges found</h3>
        <p style="font-size: 0.8125rem; color: var(--text-tertiary);">
          ${query ? `No results for "${escapeHTML(query)}"` : 'No related challenges have been linked to this snippet yet.'}
        </p>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: container });
    return;
  }

  container.innerHTML = challenges.map(c => `
    <div class="related-challenge-item" style="display: flex; align-items: center; gap: 1rem; padding: 0.875rem 1rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); transition: all 150ms ease; cursor: pointer;" onmouseover="this.style.borderColor='var(--color-primary)'; this.style.background='var(--color-primary-subtle)'" onmouseout="this.style.borderColor='var(--border-color)'; this.style.background='var(--bg-surface)'">
      <div style="flex: 1;">
        <div style="font-weight: 700; font-size: 0.9375rem; color: var(--text-primary); margin-bottom: 0.25rem;">${escapeHTML(c.title)}</div>
        <div style="display: flex; gap: 0.375rem; align-items: center; flex-wrap: wrap;">
          <span class="badge badge-neutral" style="font-size: 0.625rem;">${escapeHTML((() => { const f = state.nodes.find(n => n.id === c.parentId); return f ? f.name : 'Uncategorized'; })())}</span>
          ${(c.tags || []).slice(0, 3).map(t => `<span class="badge badge-primary" style="font-size: 0.6rem;">${escapeHTML(t)}</span>`).join('')}
          <span style="font-size: 0.75rem; color: var(--text-tertiary); margin-left: auto;">${c.variants.length} version${c.variants.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
      <button onclick="event.stopPropagation(); navigateToChallenge('${c.id}')" class="btn btn-practice" style="width: auto; padding: 0.5rem 1rem; font-size: 0.8125rem;">
        <i data-lucide="play" style="width:14px;height:14px;fill:currentColor;"></i> Practice
      </button>
    </div>
  `).join('');

  if (typeof lucide !== 'undefined') lucide.createIcons({ root: container });
}

function navigateToChallenge(challengeId) {
  const pane1 = document.querySelector('.messenger-pane-1 .pane-1-content');
  if (pane1) setSessionParam('studySidebarScroll', pane1.scrollTop);

  closeRelatedChallengesModal();
  promptTimer(challengeId);
}

// === TIMER MODAL (For Practice Links) ===
// Canonical timer-modal opener (shared by Coding Library + Training Grounds).
// browse.js no longer defines its own copy — this is the single source of truth.
function promptTimer(challengeId) {
  const pane1 = document.querySelector('.messenger-pane-1 .pane-1-content');
  if (pane1) setSessionParam('studySidebarScroll', pane1.scrollTop);
  const pane2 = document.querySelector('.messenger-pane-2');
  if (pane2) setSessionParam('browseScroll', pane2.scrollTop);

  pendingChallengeId = challengeId;
  const challenge = (state?.challenges ?? []).find(c => c.id === challengeId);
  if (!challenge) return;

  const timerModal = document.getElementById('timer-modal');
  // Self-heal: notesStartAttempt() repurposes this shared modal for notebooks and
  // only restores it on confirm. If the user dismissed it via X/backdrop it's left
  // in notebook mode (variant select hidden, confirm wired to notesConfirmStart).
  // Repair it here so challenge practice always opens correctly.
  if (timerModal) {
    const vsel = document.getElementById('timer-variant-select');
    if (vsel && vsel.closest('div')) vsel.closest('div').style.display = '';
    const cBtn = timerModal.querySelector('button[onclick="notesConfirmStart()"]');
    if (cBtn) cBtn.setAttribute('onclick', 'confirmStartPractice()');
    const mTitle = timerModal.querySelector('.modal-title');
    if (mTitle) mTitle.textContent = 'Session Setup';
    const mDesc = timerModal.querySelector('.modal-desc');
    if (mDesc) mDesc.textContent = 'Select a version and set an optional time limit.';
  }

  const variantSelect = document.getElementById('timer-variant-select');
  if (!variantSelect) return;
  variantSelect.innerHTML = (challenge?.variants ?? []).map(v =>
    `<option value="${v.id}">${escapeHTML(v.name)}</option>`
  ).join('');

  document.getElementById('timer-h').value = '0';
  document.getElementById('timer-m').value = '0';
  document.getElementById('timer-s').value = '0';
  if (timerModal) timerModal.classList.remove('hidden');
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: timerModal });
}

function closeTimerModal() {
  document.getElementById('timer-modal').classList.add('hidden');
}

function confirmStartPractice() {
  const pane1 = document.querySelector('.messenger-pane-1 .pane-1-content');
  if (pane1) setSessionParam('studySidebarScroll', pane1.scrollTop);
  const pane2 = document.querySelector('.messenger-pane-2');
  if (pane2) setSessionParam('browseScroll', pane2.scrollTop);

  const h = parseInt(document.getElementById('timer-h').value) || 0;
  const m = parseInt(document.getElementById('timer-m').value) || 0;
  const s = parseInt(document.getElementById('timer-s').value) || 0;
  const vId = document.getElementById('timer-variant-select').value;

  closeTimerModal();

  setSessionParam('practiceChallenge', pendingChallengeId);
  setSessionParam('practiceVariant', vId);
  setSessionParam('timeLimit', (h * 3600) + (m * 60) + s);

  spaNavigate('practice');
}

// ============================================================
// SHAREABLE SNIPPETS
// ============================================================

function shareSnippet(snippetId) {
  const snippet = (state.snippets || []).find(s => s.id === snippetId);
  if (!snippet) return;

  const shareable = {
    _type: 'snippet',
    title: snippet.title,
    tags: snippet.tags || [],
    description: snippet.description || '',
    comments: snippet.comments || '',
    examples: (snippet.examples || []).map(ex => ({
      name: ex.name,
      code: ex.code || '',
      highlightLines: ex.highlightLines || ''
    }))
  };

  const encoded = encodeShareData(shareable);
  if (!encoded) {
    if (typeof showMessage === 'function') showMessage('Error', 'Failed to encode snippet for sharing.', true);
    return;
  }

  const url = window.location.origin + window.location.pathname + '?data=' + encoded;
  warnIfShareUrlTooLong(url);
  copyShareLink(url, 'Snippet link copied!');
}

// ============================================================
// DRAG & DROP REORDERING
// ============================================================

/* Drag and drop lives in tree-dnd.js, shared with the other library trees. */
/* Row display toggles, matching the coding and notes trees. */
const SNIP_SHOW_KEY = 'snipRowShow';
function snipShow(what) {
  try { return (JSON.parse(localStorage.getItem(SNIP_SHOW_KEY)) || {})[what] === true; } catch (e) { return false; }
}
function snipToggleShow(what) {
  let o = {};
  try { o = JSON.parse(localStorage.getItem(SNIP_SHOW_KEY)) || {}; } catch (e) { o = {}; }
  o[what] = !o[what];
  try { localStorage.setItem(SNIP_SHOW_KEY, JSON.stringify(o)); } catch (e) { /* quota */ }
  renderSnippetList();
}

function snipFind(id) {
  return (state.snippets || []).find(s => s.id === id) ||
         (state.nodes || []).find(n => n.id === id) || null;
}

function snipToggleFavorite(id) {
  const it = snipFind(id);
  if (!it) return;
  it.favorite = !it.favorite;
  saveData(); renderSnippetList();
  if (typeof toast === 'function') toast(it.favorite ? 'Added to favourites.' : 'Removed from favourites.', { type: 'info' });
}

function snipCollapseAll(collapse) {
  const folders = (state.nodes || []).filter(n => n.type === 'folder' && n.scope === 'snippet');
  state.expandedNodes = collapse ? [] : folders.map(f => f.id).concat('__root__');
  saveData(); renderSnippetList();
}

registerTreeHost('snippets', {
  scope: 'snippet',
  container: '#snippet-list-container',
  selectNs: 'snippets',
  rerender: () => renderSnippetList(),
  expand: (folderId) => {
    if (!state.expandedNodes) state.expandedNodes = [];
    if (!state.expandedNodes.includes(folderId)) { state.expandedNodes.push(folderId); renderSnippetList(); }
  },
  isExpanded: (id) => isNodeExpanded(id),
  toggle: (id) => toggleSnippetFolder(id, null),
  acceptsDrop: (targetId) => libRootAcceptsDrop('snippets', targetId),
  onDropInto: (targetId, ids) => libRootDropInto('snippets', targetId, ids,
    (id) => (state.snippets || []).find(s => s.id === id)),

  /* Folders had no menu at all here, and a snippet's offered only "Move to…" —
     so renaming or deleting either one was impossible from the tree. */
  onRename: (id, kind) => {
    const it = snipFind(id);
    if (!it) return;
    showInputDialog(kind === 'folder' ? 'Rename folder' : 'Rename snippet', null, 'Name',
      it.name || it.title || '', (v) => {
        const t = (v || '').trim();
        if (!t) return;
        if (kind === 'folder') it.name = t; else it.title = t;
        saveData(); renderSnippetList();
      });
  },
  onNewSubfolder: (id) => {
    showInputDialog('New folder', null, 'Folder name', '', (v) => {
      const name = (v || '').trim();
      if (!name || typeof createNode !== 'function') return;
      createNode(name, 'folder', id, 'snippet');
      if (id && !isNodeExpanded(id)) toggleNodeExpanded(id);
      saveData(); renderSnippetList();
    });
  },
  onDelete: (id, kind) => {
    const it = snipFind(id);
    if (!it) return;
    if (kind === 'folder') {
      const n = countItemsRecursive(id, 'snippet');
      showConfirm('Delete folder?',
        n ? `Delete "${it.name}"? The ${n} snippet${n !== 1 ? 's' : ''} inside move up a level.` : `Delete "${it.name}"?`,
        () => {
          (state.nodes || []).forEach(c => { if (c.parentId === id) c.parentId = it.parentId || null; });
          (state.snippets || []).forEach(sn => { if (sn.parentId === id) sn.parentId = it.parentId || null; });
          state.nodes = (state.nodes || []).filter(x => x.id !== id);
          saveData(); renderSnippetList();
        });
      return;
    }
    if (typeof softDeleteSnippet === 'function') softDeleteSnippet(id, () => renderSnippetList());
  },
  extraActions: (id, kind) => {
    const it = snipFind(id);
    if (kind === 'folder') {
      return [
        { icon: 'image', label: 'Change icon...', fn: () => { if (typeof browseSetIcon === 'function') browseSetIcon(id); } },
        { icon: 'palette', label: 'Highlight colour...', fn: () => { if (typeof browseSetColor === 'function') browseSetColor(id); } }
      ];
    }
    const fav = !!(it && it.favorite);
    return [
      { icon: fav ? 'star-off' : 'star', label: fav ? 'Remove from favourites' : 'Add to favourites', fn: () => snipToggleFavorite(id) },
      { icon: 'palette', label: 'Highlight colour...', fn: () => { if (typeof browseSetColor === 'function') browseSetColor(id); } },
      { icon: 'image', label: 'Change icon...', fn: () => { if (typeof browseSetIcon === 'function') browseSetIcon(id); } },
      { icon: 'share-2', label: 'Share link', fn: () => { if (typeof shareSnippet === 'function') shareSnippet(id); } }
    ];
  },
  paneActions: () => ([
    { icon: 'folder-plus', label: 'New root folder', fn: () => {
      showInputDialog('New folder', null, 'Folder name', '', (v) => {
        const name = (v || '').trim();
        if (!name || typeof createNode !== 'function') return;
        createNode(name, 'folder', null, 'snippet');
        saveData(); renderSnippetList();
      });
    } },
    { sep: true },
    { icon: snipShow('tags') ? 'check-square' : 'square', label: 'Show topic badge', fn: () => snipToggleShow('tags') },
    { sep: true },
    { icon: 'chevrons-down-up', label: 'Collapse all folders', fn: () => snipCollapseAll(true) },
    { icon: 'chevrons-up-down', label: 'Expand all folders', fn: () => snipCollapseAll(false) }
  ]),
  // Moving between folders asks first; reordering inside one does not.
  confirmMove: true
});

function checkSharedSnippet() {
  // See browse.js: captured at boot, applied once a storage mode is known.
  if (typeof hasPendingShare === 'function' && hasPendingShare()) {
    const pending = takePendingShare();
    if (pending && pending._type === 'snippet') importSharedSnippet(pending);
  }
}

/** Files a shared snippet into the current workspace and opens it. */
function importSharedSnippet(shared) {
  if (!shared) return null;
  const tempId = 'shared_snippet_' + Date.now();
  const tempSnippet = {
    id: tempId,
    title: '[Shared] ' + (shared.title || 'Snippet'),
    tags: shared.tags || [],
    description: shared.description || '',
    comments: shared.comments || '',
    parentId: null,
    examples: (shared.examples || []).map(ex => ({
      ...ex,
      id: ex.id || generateId()
    }))
  };

  if (!state.snippets) state.snippets = [];
  state.snippets.unshift(tempSnippet);
  saveData();

  if (typeof showShareToast === 'function') showShareToast('Added "' + tempSnippet.title + '"');
  setTimeout(() => { if (typeof selectSnippet === 'function') selectSnippet(tempId); }, 300);
  return tempId;
}

// ============================================================
// SNIPPET CONTEXT MENU 
// ============================================================

/* showSnippetCtxMenu() lived here. It opened a second, differently-styled menu
   over the shared one; its actions hang off registerTreeHost('snippets') now
   and are reached through treeContextMenu like every other library. */


function snippetCtxSetTier(value) {
  if (!snippetCtxTargetNodeId) return;
  updateFolderTier(snippetCtxTargetNodeId, value || null);
  if (typeof renderStudy === 'function') renderStudy();
}

function sctxOpenTierPicker() {
  closeSnippetCtxMenu();
  if (!snippetCtxTargetNodeId) return;
  openTierPicker(snippetCtxTargetNodeId);
}

function sctxOpenLockPicker() {
  closeSnippetCtxMenu();
  if (!snippetCtxTargetNodeId) return;
  openLockPicker(snippetCtxTargetNodeId, 'snippet');
}

function closeSnippetCtxMenu() {
  const menu = document.getElementById('snippet-context-menu');
  if (menu) menu.classList.add('hidden');
}

function snippetCtxNewFolder() {
  closeSnippetCtxMenu();
  showInputDialog('New Folder', null, 'Folder name', '', (name) => {
    const newNode = createNode(name.trim(), 'folder', snippetCtxTargetNodeId, 'snippet');
    if (snippetCtxTargetNodeId && !isNodeExpanded(snippetCtxTargetNodeId)) {
      toggleNodeExpanded(snippetCtxTargetNodeId);
    }
    saveData();
    renderSnippetList();
  });
}

function snippetCtxRename() {
  closeSnippetCtxMenu();
  if (!snippetCtxTargetNodeId) return;
  const folder = state.nodes.find(n => n.id === snippetCtxTargetNodeId);
  if (!folder) return;

  showInputDialog('Rename Folder', null, 'New name', folder.name, (newName) => {
    if (newName.trim() === folder.name) return;
    renameNode(snippetCtxTargetNodeId, newName.trim());
    renderSnippetList();
  });
}

function snippetCtxDelete() {
  closeSnippetCtxMenu();
  if (!snippetCtxTargetNodeId) return;
  const folder = state.nodes.find(n => n.id === snippetCtxTargetNodeId);
  if (!folder) return;
  const targetId = snippetCtxTargetNodeId;

  if (typeof showConfirm === 'function') {
    showConfirm('Delete Folder', `Delete "${escapeHTML(folder.name)}"? Items will become uncategorized. You can undo this.`, () => {
      softDeleteFolder(targetId, () => renderSnippetList());
    });
  } else {
    if (!confirm(`Delete "${folder.name}"? Items will become uncategorized.`)) return;
    softDeleteFolder(targetId, () => renderSnippetList());
  }
}

function snippetCtxMove() {
  closeSnippetCtxMenu();
  if (!snippetCtxTargetNodeId) return;
  const folder = state.nodes.find(n => n.id === snippetCtxTargetNodeId);
  if (!folder) return;

  const validFolders = state.nodes.filter(n =>
    n.type === 'folder' && n.scope === 'snippet' && n.id !== snippetCtxTargetNodeId && !isDescendantOf(n.id, snippetCtxTargetNodeId)
  );

  const options = validFolders.map(f => ({
    label: getBreadcrumbPath(f.id).map(n => n.name).join(' > '),
    value: f.id
  }));
  showListPickerDialog(`Move "${folder.name}"`, null, options, (newParentId) => {
    folder.parentId = newParentId;
    saveData();
    renderSnippetList();
  });
}

async function snippetCtxChangeIcon() {
  closeSnippetCtxMenu();
  if (!snippetCtxTargetNodeId) return;
  const folder = state.nodes.find(n => n.id === snippetCtxTargetNodeId);
  if (!folder) return;

  const currentIcon = folder.icon || 'folder';
  const newIcon = await openIconPicker(currentIcon);
  if (!newIcon || !newIcon.trim() || newIcon.trim() === currentIcon) return;

  folder.icon = newIcon.trim();
  saveData();
  renderSnippetList();
}