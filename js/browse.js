/* ============================================================
   BROWSE.JS — Browse View Rendering (Recursive Tree + Dual-Pane)
   ============================================================ */

let browseActiveNodeId = getSessionParam('browseActiveNode') || null;
let browseActiveProgramId = getSessionParam('browseActiveProgram') || null;
let browseActiveSetId = getSessionParam('browseActiveSet') || null;
let ctxTargetNodeId = null; // For context menu
let _browseContainerCtxHandler = null; // Named reference for removing duplicate listeners
let _browseSearchTimer = null;

/** Debounced browse search — avoids re-rendering the entire tree on every keystroke. */
function debouncedBrowseSearch() {
  clearTimeout(_browseSearchTimer);
  _browseSearchTimer = setTimeout(() => { setSessionParam('browsePage', 1); renderBrowse(); }, 180);
}

function navigateToFolderAndFocus(parentId, itemId) {
  // Clear search
  const searchInput = document.getElementById('browse-search');
  if (searchInput) searchInput.value = '';

  window.disableNextStagger = true;

  // Select folder
  selectBrowseNode(parentId === '__root__' ? null : parentId);

  // Expand parent folders to ensure it is visible in the tree
  if (parentId && parentId !== '__root__') {
    let curr = state.nodes.find(n => n.id === parentId);
    while (curr) {
      if (!state.expandedNodes) state.expandedNodes = [];
      if (!state.expandedNodes.includes(curr.id)) {
        state.expandedNodes.push(curr.id);
      }
      curr = state.nodes.find(n => n.id === curr.parentId);
    }
    saveData();
    renderBrowseTree();
  }

  // Scroll to card
  setTimeout(() => {
    const card = document.getElementById(`card-${itemId}`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.classList.add('pulse-highlight');
      setTimeout(() => card.classList.remove('pulse-highlight'), 2000);
    }
  }, 100);
}

// ============================================================
// TREE RENDERING (LEFT PANE)
// ============================================================

let _completedCountMemo = {};
let _completedChallengesMap = null;

function getCompletedCount(folderId) {
  if (!_completedChallengesMap) {
    _completedChallengesMap = {};
    state.history.forEach(h => {
      if (!h.isArchived && h.score === 100) {
        _completedChallengesMap[h.challengeId] = true;
      }
    });
  }

  if (_completedCountMemo[folderId] !== undefined) return _completedCountMemo[folderId];

  const catChallenges = state.challenges.filter(c => c.parentId === folderId);
  let completed = 0;
  catChallenges.forEach(c => {
    if (_completedChallengesMap[c.id]) completed++;
  });
  
  // Also count recursively into child folders
  getChildFolders(folderId, 'challenge').forEach(child => {
    completed += getCompletedCount(child.id);
  });
  
  _completedCountMemo[folderId] = completed;
  return completed;
}

function browsePage(page) {
  // renderBrowseContent clamps to the real page count; just keep it >= 1 here.
  page = Math.max(1, Math.floor(page) || 1);
  setSessionParam('browsePage', page);
  renderBrowseContent();
}

function selectBrowseNode(nodeId) {
  browseActiveNodeId = nodeId;
  // Clicking a folder always returns from the program/set detail view to the cards.
  browseActiveProgramId = null;
  browseActiveSetId = null;
  setSessionParam('browseActiveProgram', null);
  setSessionParam('browseActiveSet', null);
  setSessionParam('browseActiveNode', nodeId);
  setSessionParam('browseScroll', 0);
  setSessionParam('browsePage', 1);
  renderBrowse();
}

/** Open the dedicated practice-set detail view in pane 2 (tree set click). */
function browseSelectSet(setId) {
  const set = (state.codingSets || []).find(s => s.id === setId);
  if (!set) return;

  browseActiveSetId = setId;
  browseActiveProgramId = null;
  browseActiveNodeId = set.parentId || '__root__';
  setSessionParam('browseActiveSet', setId);
  setSessionParam('browseActiveProgram', null);
  setSessionParam('browseActiveNode', browseActiveNodeId);
  setSessionParam('browseScroll', 0);

  let curr = state.nodes.find(n => n.id === set.parentId);
  while (curr) {
    if (!state.expandedNodes) state.expandedNodes = [];
    if (!state.expandedNodes.includes(curr.id)) state.expandedNodes.push(curr.id);
    curr = state.nodes.find(n => n.id === curr.parentId);
  }
  saveData();
  renderBrowse();
}

/** Open the dedicated program detail view in pane 2 (tree file click). */
function browseSelectProgram(programId) {
  const challenge = state.challenges.find(c => c.id === programId);
  if (!challenge) return;

  browseActiveProgramId = programId;
  browseActiveSetId = null;
  browseActiveNodeId = challenge.parentId || '__root__';
  setSessionParam('browseActiveProgram', programId);
  setSessionParam('browseActiveSet', null);
  setSessionParam('browseActiveNode', browseActiveNodeId);
  setSessionParam('browseScroll', 0);

  // Expand ancestor folders so the selected file is visible in the tree
  let curr = state.nodes.find(n => n.id === challenge.parentId);
  while (curr) {
    if (!state.expandedNodes) state.expandedNodes = [];
    if (!state.expandedNodes.includes(curr.id)) state.expandedNodes.push(curr.id);
    curr = state.nodes.find(n => n.id === curr.parentId);
  }
  saveData();
  renderBrowse();
}

/** Start practice on a specific variant directly from the program detail view. */
function browseStartVariant(challengeId, variantId) {
  setSessionParam('practiceChallenge', challengeId);
  setSessionParam('practiceVariant', variantId);
  setSessionParam('timeLimit', 0);
  spaNavigate('practice');
}

function toggleBrowseExpand(nodeId, e) {
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
    renderBrowseTree();
  }
}

let _browseHistoryIndex = null; // Pre-indexed map: challengeId → [history entries]

function renderBrowse() {
  _completedCountMemo = {};
  _completedChallengesMap = null;
  // Pre-index history by challengeId so card rendering is O(1) lookup instead of O(n) filter.
  // Each bucket is sorted NEWEST FIRST — "Last attempt" and "Recent Attempts" read
  // from the front. state.history is usually newest-first (unshift), but an undo of a
  // deletion pushes entries back onto the end, so sort explicitly rather than trust it.
  _browseHistoryIndex = {};
  state.history.forEach(h => {
    if (!_browseHistoryIndex[h.challengeId]) _browseHistoryIndex[h.challengeId] = [];
    _browseHistoryIndex[h.challengeId].push(h);
  });
  const _logTime = h => h.submitTime || h.startTime || 0;
  Object.keys(_browseHistoryIndex).forEach(k => {
    _browseHistoryIndex[k].sort((a, b) => _logTime(b) - _logTime(a));
  });
  renderBrowseTree();
  renderBrowseContent();
  if (typeof updateBrowseHeaderStats === 'function') updateBrowseHeaderStats();
  const browseRoot = document.getElementById('browse-view') || document.getElementById('main-content');
  if (typeof lucide !== 'undefined') lucide.createIcons(browseRoot ? { root: browseRoot } : undefined);
}

/**
 * Number of DISTINCT library programs fully completed.
 *
 * Must be counted against the live challenge list, not straight off history:
 * a manual practice-set problem is logged with `challengeId: null`, and history
 * for deleted programs sticks around — both used to be counted as "completed
 * programs" and pushed the Coding Library's Done/% stats above the real value.
 */
function countCompletedPrograms() {
  const perfect = new Set(
    state.history.filter(h => h.challengeId && h.score === 100 && !h.isArchived).map(h => h.challengeId)
  );
  if (perfect.size === 0) return 0;
  return state.challenges.filter(c => perfect.has(c.id)).length;
}

// Invalidate caches whenever history or challenges change externally
function invalidateBrowseCache() {
  _completedCountMemo = {};
  _completedChallengesMap = null;
}

/** Toggle visibility of individual file/program items in the browse tree. */
function toggleBrowseTreeItems() {
  const hidden = localStorage.getItem('browseHideItems') !== 'true';
  localStorage.setItem('browseHideItems', hidden);
  const container = document.getElementById('browse-category-list');
  if (container) container.classList.toggle('hide-tree-items', hidden);
  // Rebuild rather than re-point: lucide keeps the previous class, so the icon
  // ended up carrying both lucide-eye and lucide-eye-off.
  const btn = document.getElementById('browse-toggle-items-btn');
  if (btn) {
    btn.innerHTML = `<i data-lucide="${hidden ? 'eye-off' : 'eye'}" id="browse-toggle-items-icon"></i>`;
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: btn });
  }
}

function renderBrowseTree() {
  const container = document.getElementById('browse-category-list');
  if (!container) return;

  const searchInput = document.getElementById('browse-search');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  // Build tree HTML recursively. When a program/set is selected, only that row
  // highlights — passing null suppresses the folder highlight.
  let html = renderTreeRecursive(null, 'challenge', 0, query, (browseActiveProgramId || browseActiveSetId) ? null : browseActiveNodeId);

  // The pseudo-folder: uncategorized items, or your favourites — right-click
  // the row to switch (see libRootMode).
  const rootList = libRootItems('browse', state.challenges, state.codingSets || []);
  const rootMeta = libRootMeta('browse');
  if (rootList.length > 0 || state.nodes.filter(n => n.scope === 'challenge').length === 0) {
    const isActive = !browseActiveProgramId && !browseActiveSetId && browseActiveNodeId === '__root__';
    const count = rootList.length;
    if (count > 0 || !html) {
      // A real row: it expands, it takes drops, and it has a menu. It used to be
      // a bare label, so the one place items came FROM was the one place they
      // could never be dragged back to.
      const rootOpen = isNodeExpanded('__root__');
      html += `
        <div class="tree-node" data-level="0" data-node-id="__root__">
          <div class="tree-node-row ${isActive ? 'active' : ''}"
               ${treeRowAttrs({ ns: 'browse', id: '__root__', kind: 'folder', level: 0, expanded: rootOpen, selected: isActive, draggable: false })}
               oncontextmenu="treeContextMenu(event, '__root__', 'browse')"
               onclick="selectBrowseNode('__root__')">
            <i data-lucide="chevron-right" class="tree-node-chevron ${count > 0 ? (rootOpen ? 'expanded' : '') : 'invisible'}"
               onclick="toggleBrowseExpand('__root__', event)"></i>
            <i data-lucide="${rootMeta.icon}" class="tree-node-icon item-icon-color"></i>
            <span class="tree-node-label" title="${escapeHTML(rootMeta.hint)}">${rootMeta.label}</span>
            <span class="tree-node-badge">${count}</span>
          </div>
          <div class="tree-children ${rootOpen ? '' : 'collapsed'}" role="group">
            <div class="tree-children-inner">
              ${renderTreeRecursive(null, 'challenge', 0, query, null, true, rootList)}
            </div>
          </div>
        </div>
      `;
    }
  }

  if (!html) {
    html = `<div class="empty-state" style="padding: 2rem;">
      <p style="color:var(--text-tertiary); font-size:0.875rem;">No folders. Right-click to create one.</p>
    </div>`;
  }

  container.innerHTML = html + treeRootDropHTML('browse');
  container.dataset.treeNs = 'browse';
  container.setAttribute('role', 'tree');
  container.setAttribute('aria-label', 'Coding library folders');
  container.classList.toggle('hide-tree-items', localStorage.getItem('browseHideItems') === 'true');

  // Attach right-click context to folder rows only (program file rows are
  // items, not folders — the folder menu would misbehave on them)
  // Folders now use the shared menu too (see the browse host's extraActions),
  // so nothing here attaches the legacy one. Right-clicking Uncategorized used
  // to open BOTH: it carries an inline treeContextMenu AND matched the
  // ":not(.tree-item-node)" selector this delegation used.

  // Allow right-click on empty area to create root folder
  if (_browseContainerCtxHandler) {
    container.removeEventListener('contextmenu', _browseContainerCtxHandler);
  }
  _browseContainerCtxHandler = (e) => {
    if (e.target === container || e.target.closest('.empty-state')) {
      e.preventDefault();
      showTreeContextMenu(e, null); // null = root level
    }
  };
  container.addEventListener('contextmenu', _browseContainerCtxHandler);

  if (typeof lucide !== 'undefined') lucide.createIcons({ root: container });
}

/**
 * One pass over the folder's children in a single display order (see
 * treeChildren) rather than two passes that always drew folders first — a row
 * dragged above a folder used to be stored above it and still drawn below.
 */
function renderTreeRecursive(parentId, scope, depth, query, activeId, itemsOnly, rootList) {
  let html = '';

  // rootList is the pseudo-folder's contents, which in Favourites mode are
  // items from all over the tree rather than the children of one parent.
  const entries = rootList
    ? rootList.map(n => ({ kind: (state.codingSets || []).some(s => s.id === n.id) ? 'set' : 'item', node: n }))
    : treeChildren(parentId, scope);

  entries.forEach(entry => {
    const node = entry.node;

    // The Uncategorized pseudo-folder lists root ITEMS only — the root folders
    // are already siblings of it, not children.
    if (itemsOnly && entry.kind === 'folder') return;

    if (entry.kind === 'folder') {
      const folder = node;
      const totalItems = countItemsRecursive(folder.id, scope);
      const hasChildren = getChildFolders(folder.id, scope).length > 0;
      const expanded = isNodeExpanded(folder.id);
      const isActive = activeId === folder.id;

      // If searching, skip folders with no matching items
      if (query && !folderHasMatchingItems(folder.id, scope, query)) return;

      // Lock status
      let lockIcon = '';
      const req = state.categoryRequirements ? state.categoryRequirements[folder.id] : null;
      if (req) {
        let folderIsLocked = false;
        if (req.requiredChallengeIds && req.requiredChallengeIds.length > 0) {
          folderIsLocked = req.requiredChallengeIds.some(cId => !state.history.some(h => h.challengeId === cId && h.score === 100 && !h.isArchived));
        } else if (req.reqNodeId) {
          folderIsLocked = getCompletedCount(req.reqNodeId) < req.count;
        }
        if (folderIsLocked) lockIcon = `<i data-lucide="lock" class="tree-node-lock"></i>`;
      }

      const chevronClass = hasChildren || totalItems > 0 ? (expanded ? 'expanded' : '') : 'invisible';

      html += `
        <div class="tree-node" data-level="${depth}" data-node-id="${folder.id}">
          <div class="tree-node-row ${isActive ? 'active' : ''}"
               ${treeRowAttrs({ ns: 'browse', id: folder.id, kind: 'folder', level: depth, expanded, selected: isActive })}
               style="padding-left: calc(0.75rem + 0rem)"
               oncontextmenu="treeContextMenu(event, '${folder.id}', 'browse')"
               onclick="selectBrowseNode('${folder.id}')">
            <i data-lucide="chevron-right"
               class="tree-node-chevron ${chevronClass}"
               onclick="toggleBrowseExpand('${folder.id}', event)"></i>
            <i data-lucide="${folder.icon || 'folder'}" class="tree-node-icon folder-icon-color"></i>
            <span class="tree-node-label">${escapeHTML(folder.name)}</span>
            ${lockIcon}
            ${typeof getTierBadgeHTML === 'function' ? getTierBadgeHTML(folder.tier) : ''}
            <span class="tree-node-badge">${totalItems}</span>
          </div>
          <div class="tree-children ${expanded ? '' : 'collapsed'}" role="group">
            <div class="tree-children-inner">
              ${renderTreeRecursive(folder.id, scope, depth + 1, query, activeId)}
            </div>
          </div>
        </div>
      `;
      return;
    }

    // Root-level items are reached through the "Uncategorized" pseudo-folder,
    // which passes itemsOnly; listing them inline here as well duplicated them.
    if (!(query || depth > 0 || itemsOnly)) return;

    if (entry.kind === 'item') {
      const item = node;
      // Must use the same predicate as folderHasMatchingItems (title OR tag), or a
      // folder kept by a tag match renders with no rows under it.
      if (query && !itemMatchesQuery(item, query)) return;
      const isActive = browseActiveProgramId === item.id;
      // A favourited program showed no star anywhere in the tree — the only
      // clue was on its card. The row now carries the star, the per-item
      // highlight colour, and whichever badges the view toggles ask for.
      const hue = item.color ? ` style="--row-accent:${treeColorOf(item.color)}"` : '';
      html += `
        <div class="tree-node tree-item-node${item.color ? ' has-accent' : ''}" data-level="${depth + 1}" data-node-id="${item.id}"${hue}>
          <div class="tree-node-row ${isActive ? 'active' : ''}"
               ${treeRowAttrs({ ns: 'browse', id: item.id, kind: 'item', level: depth + 1, selected: isActive })}
               style="padding-left: calc(0.75rem + ${TREE_ITEM_INSET}rem)"
               oncontextmenu="treeContextMenu(event, '${item.id}', 'browse')"
               onclick="browseSelectProgram('${item.id}')">
            <i class="tree-node-chevron invisible"></i>
            <i data-lucide="${item.icon || 'file-code'}" class="tree-node-icon item-icon-color" style="width:14px;height:14px;"></i>
            <span class="tree-node-label" style="font-weight:400; font-size:0.875rem;">${escapeHTML(item.title)}</span>
            ${browseShow('level') && item.level != null ? `<span class="tree-badge-level">L${item.level}</span>` : ''}
            ${browseShow('tags') && (item.tags || []).length ? `<span class="tree-badge-tag">${escapeHTML(item.tags[0])}</span>` : ''}
            ${item.favorite ? '<i data-lucide="star" class="tree-node-star"></i>' : ''}
          </div>
        </div>
      `;
      return;
    }

    // Practice sets live in the challenge tree too — distinct grid icon.
    if (entry.kind === 'set') {
      const set = node;
      if (query && !fuzzyMatch(set.title, query)) return;
      const isActive = browseActiveSetId === set.id;
      const n = (set.problems || []).length;
      html += `
        <div class="tree-node tree-item-node tree-set-node" data-level="${depth + 1}" data-node-id="${set.id}">
          <div class="tree-node-row ${isActive ? 'active' : ''}"
               ${treeRowAttrs({ ns: 'browse', id: set.id, kind: 'set', level: depth + 1, selected: isActive })}
               style="padding-left: calc(0.75rem + ${TREE_ITEM_INSET}rem)"
               oncontextmenu="treeContextMenu(event, '${set.id}', 'browse')"
               onclick="browseSelectSet('${set.id}')">
            <i class="tree-node-chevron invisible"></i>
            <i data-lucide="layout-grid" class="tree-node-icon" style="width:14px;height:14px;color:var(--color-accent);"></i>
            <span class="tree-node-label" style="font-weight:400; font-size:0.875rem;">${escapeHTML(set.title)}</span>
            <span class="tree-node-badge" title="${n} problem${n !== 1 ? 's' : ''}">${n}</span>
          </div>
        </div>
      `;
    }
  });

  return html;
}

/** Single source of truth for "does this program match the search box?".
    Title and tags fuzzy-match; descriptions, version names and filenames are
    substring-matched (see libMatches) so search reaches past the title. */
function itemMatchesQuery(item, query) {
  return libMatches(item, query, 'challenge');
}

function folderHasMatchingItems(folderId, scope, query) {
  // Check direct items
  const items = getItemsInFolder(folderId, scope);
  if (items.some(item => itemMatchesQuery(item, query))) return true;

  // Practice sets live in the challenge tree too — a set title must keep its
  // folder visible, otherwise searching for a set name empties the whole tree.
  if (scope === 'challenge' && getSetsInFolder(folderId).some(s => fuzzyMatch(s.title, query))) return true;

  // Check child folders recursively
  const childFolders = getChildFolders(folderId, scope);
  return childFolders.some(cf => folderHasMatchingItems(cf.id, scope, query));
}

// ============================================================
// CONTENT RENDERING (RIGHT PANE)
// ============================================================

/* A card is a summary, not an inventory — past this many tags it says "+N". */
const CARD_TAGS_SHOWN = 3;

/** Build HTML for a single challenge card (extracted for progressive rendering). */
/** Is there an unfinished attempt of this program sitting in the autosave? */
function browseHasResumable(c) {
  const saved = getSessionParam('autoSavedFiles');
  return !!(saved && saved.challengeId === c.id);
}

function _buildChallengeCard(c, query) {
  const vCount = c.variants.length;
  const logs = (_browseHistoryIndex && _browseHistoryIndex[c.id]) || [];
  const attemptsCount = logs.length;
  const bestScore = logs.length > 0 ? Math.max(...logs.map(l => l.score)) : -1;
  const lastScore = logs.length > 0 ? logs[0].score : -1;   // logs are newest-first
  const isPerfect = bestScore === 100;
  const lastAttemptDate = logs.length > 0 ? logs[0].date : null;
  const scoreClass = bestScore === 100 ? 'score-perfect' : bestScore >= 50 ? 'score-partial' : bestScore >= 0 ? 'score-low' : '';
  // Best-ever alone hides a regression, so the last score rides alongside it
  // whenever the two disagree.
  const slipped = lastScore >= 0 && bestScore >= 0 && lastScore < bestScore;
  const coverHtml = c.coverImage
    ? `<div class="nb-card-cover"><img src="${c.coverImage}" alt="" loading="lazy" /></div>`
    : libCoverFallbackHTML(c.title, 'file-code');
  const resumable = browseHasResumable(c);
  const selecting = libSelectMode('browse');
  return `
    <div class="card card-enhanced has-cover${libIsSelected('browse', c.id) ? ' lib-selected' : ''}" id="card-${c.id}"
         onclick="${selecting ? `libToggleSelect('browse','${c.id}')` : `browseSelectProgram('${c.id}')`}" style="cursor: pointer;">
      ${coverHtml}
      ${libSelectBoxHTML('browse', c.id)}
      ${isPerfect ? '<div class="card-completed-badge"><i data-lucide="check" style="width:10px;height:10px;"></i></div>' : ''}
      ${libFavButtonHTML('browse', c)}
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem;">
        <h3 style="font-weight:700; font-size:1.1rem; color:var(--text-primary); flex:1;">${escapeHTML(c.title)} ${getLevelBadgeHTML(c)} ${typeof getDifficultyBadgeHTML === 'function' ? getDifficultyBadgeHTML(c) : ''}</h3>
        <span class="version-pill">${vCount} version${vCount !== 1 ? 's' : ''}</span>
      </div>
      ${/* Two rows, not one heap: what happened to you here, then what this
            program is about. Tags are capped so a heavily tagged program can't
            bury the description and the Resume button below the fold. */ ''}
      <div class="card-stat-row">
        ${libReviewChipHTML('challenge', c.id)}
        ${resumable ? '<span class="badge lib-resume-badge" title="You left an attempt unfinished"><i data-lucide="play-circle" style="width:12px;height:12px;margin-right:2px;"></i>In progress</span>' : ''}
        <span class="card-stat" title="${attemptsCount} attempt${attemptsCount !== 1 ? 's' : ''}"><i data-lucide="rotate-ccw" style="width:11px;height:11px;"></i>${attemptsCount}</span>
        ${bestScore >= 0 ? `<span class="card-stat ${scoreClass}" title="Best score"><i data-lucide="${isPerfect ? 'check-circle' : 'target'}" style="width:11px;height:11px;"></i>${bestScore}%</span>` : ''}
        ${slipped ? `<span class="card-stat lib-last-badge" title="Your most recent attempt scored lower than your best">Last ${lastScore}%</span>` : ''}
      </div>
      ${(c.tags || []).length ? `<div class="card-tag-row">
        ${(c.tags || []).slice(0, CARD_TAGS_SHOWN).map(t => libTagBadgeHTML('browse', t)).join('')}
        ${(c.tags || []).length > CARD_TAGS_SHOWN
          ? `<span class="card-tag-more" title="${escapeHTML((c.tags || []).slice(CARD_TAGS_SHOWN).join(', '))}">+${(c.tags || []).length - CARD_TAGS_SHOWN}</span>` : ''}
      </div>` : ''}
      <p class="line-clamp-2" style="font-size:0.875rem; color:var(--text-secondary); margin-bottom:0.75rem; min-height:2.5rem;">
        ${escapeHTML(c.coverDescription || c.variants[0]?.description || 'No description.')}
      </p>
      ${bestScore >= 0 ? `
      <div class="card-score-bar">
        <div class="card-score-fill ${scoreClass}" style="width: ${bestScore}%;"></div>
      </div>` : ''}
      ${lastAttemptDate ? `<div class="card-last-attempt"><i data-lucide="clock" style="width:11px;height:11px;"></i> Last: ${lastAttemptDate}</div>` : ''}
      <div style="margin-top:auto; display:flex; gap:0.5rem; padding-top:0.5rem;">
        <button onclick="event.stopPropagation(); ${resumable ? `browseResume('${c.id}')` : `browseStartFresh('${c.id}')`}" class="btn btn-practice" id="practice-btn-${c.id}" style="flex:1;">
          <i data-lucide="play" style="width:16px;height:16px;fill:currentColor;"></i> ${resumable ? 'Resume' : isPerfect ? 'Retry' : 'Practice'}
        </button>
        ${resumable ? `<button onclick="event.stopPropagation(); browseStartFresh('${c.id}')" class="btn btn-ghost" title="Discard the unfinished attempt and start again" style="padding:0.5rem;">
          <i data-lucide="rotate-ccw" style="width:16px;height:16px;"></i>
        </button>` : ''}
        <button onclick="event.stopPropagation(); shareChallenge('${c.id}')" class="btn btn-ghost" title="Share Link" style="padding:0.5rem;">
          <i data-lucide="share-2" style="width:16px;height:16px;"></i>
        </button>
      </div>
    </div>`;
}

// Lets the shared bulk bar move / tag / favourite / delete programs without
// knowing anything about the Coding Library.
registerLibAdapter('browse', {
  scope: 'challenge',
  noun: 'program',
  list: () => state.challenges || [],
  find: (id) => (state.challenges || []).find(c => c.id === id),
  remove: (id) => { if (typeof softDeleteChallenge === 'function') softDeleteChallenge(id, () => {}); },
  rerender: () => { invalidateBrowseCache(); renderBrowse(); }
});

/** Pick an abandoned attempt back up rather than starting a new one. */
function browseResume(challengeId) {
  const saved = getSessionParam('autoSavedFiles');
  const c = state.challenges.find(x => x.id === challengeId);
  if (!c || !saved || saved.challengeId !== challengeId) { browseStartFresh(challengeId); return; }
  const variant = c.variants.find(v => v.id === saved.variantId) || c.variants[0];
  setSessionParam('practiceChallenge', c.id);
  setSessionParam('practiceVariant', variant.id);
  spaNavigate('practice');
}

/**
 * Start Practice means START — a blank attempt from the starter code.
 * It used to walk into initPractice, find the autosave still sitting there and
 * silently resume, so there was no way to begin again without finishing or
 * abandoning the old attempt first. Resume is now its own button.
 */
function browseStartFresh(challengeId) {
  const saved = getSessionParam('autoSavedFiles');
  if (saved && saved.challengeId === challengeId) {
    const c = state.challenges.find(x => x.id === challengeId);
    const go = () => {
      clearSessionParam('autoSavedFiles');
      clearSessionParam('practiceStartTime');
      promptTimer(challengeId);
    };
    if (typeof showConfirm === 'function') {
      showConfirm('Start over?',
        `You have an unfinished attempt at "${(c && c.title) || 'this program'}". Starting a new one discards it — use Resume to carry on instead.`,
        go);
      return;
    }
    go();
    return;
  }
  promptTimer(challengeId);
}

// ============================================================
// FILTER & SORT (Coding Library)
// ============================================================
/* Filters and sorts persist in localStorage (see library-common.js): they are a
   stated preference, and living in sessionStorage meant every one of them reset
   when the browser closed. The page NUMBER stays per-session on purpose. */
function _getBrowseStatusFilter() { return getLibPref('browse.status', 'all'); }
function _getBrowseDiffFilter() { return getLibPref('browse.diff', 'all'); }
function _getBrowseLevelFilter() { return getLibPref('browse.level', 'all'); }
function _getBrowseSort() { return getLibPref('browse.sort', 'default'); }
function _getBrowseKind() { return getLibPref('browse.kind', 'all'); }   // all | programs | sets
function _getBrowseLadder() { return !!getLibPref('browse.ladder', false); }

function setBrowseStatusFilter(v) { setLibPref('browse.status', v); setSessionParam('browsePage', 1); renderBrowseContent(); }
function setBrowseDiffFilter(v) { setLibPref('browse.diff', v); setSessionParam('browsePage', 1); renderBrowseContent(); }
function setBrowseLevelFilter(v) { setLibPref('browse.level', v); setSessionParam('browsePage', 1); renderBrowseContent(); }

/**
 * Typed level box. Re-rendering the bar on every keystroke would tear the input
 * out from under the caret, so the filter is applied on a short debounce and the
 * field is put back with focus and cursor where they were.
 */
let _browseLevelTimer = null;
function setBrowseLevelFilterFromInput(raw) {
  const v = String(raw || '').trim();
  clearTimeout(_browseLevelTimer);
  _browseLevelTimer = setTimeout(() => {
    setLibPref('browse.level', v === '' ? 'all' : v);
    setSessionParam('browsePage', 1);
    renderBrowseContent();
    const el = document.querySelector('.lib-level-input input');
    if (!el) return;
    el.focus();
    // A number input has no selection API — asking for one throws InvalidStateError.
    if (el.type !== 'number') {
      try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) { /* not selectable */ }
    }
  }, 260);
}
function setBrowseSort(v) { setLibPref('browse.sort', v); setSessionParam('browsePage', 1); renderBrowseContent(); }
function setBrowseKind(v) { setLibPref('browse.kind', v); setSessionParam('browsePage', 1); renderBrowseContent(); }
function toggleBrowseLadder() { setLibPref('browse.ladder', !_getBrowseLadder()); setSessionParam('browsePage', 1); renderBrowseContent(); }
function clearBrowseFilters() {
  setLibPref('browse.status', 'all');
  setLibPref('browse.diff', 'all');
  setLibPref('browse.level', 'all');
  setLibPref('browse.kind', 'all');
  setLibPref('browse.sort', 'default');
  libClearCommonFilters('browse');
  setSessionParam('browsePage', 1);
  renderBrowseContent();
}

/** A program's boss level (1–100), set per-program in Admin. null when unset. */
function getProgramLevel(c) {
  const n = parseInt(c && c.level, 10);
  return n > 0 ? Math.min(n, 100) : null;
}

/** Short display name for the boss plate — the admin alias, else the title. */
function getProgramAlias(c) {
  if (!c) return '';
  const a = (c.alias || '').trim();
  return a || (c.title || '');
}

/** Whether this program offers a cheat sheet during an attempt (Admin switch). */
function programHasCheatsheet(c) {
  return !!(c && c.cheatsheet);
}

function getLevelBadgeHTML(c) {
  const lv = getProgramLevel(c);
  return lv ? `<span class="level-badge" title="Boss level ${lv}">LV.${lv}</span>` : '';
}

/** 'todo' (never attempted) | 'attempted' (best < 100) | 'done' (best = 100). */
function _challengeStatus(c) {
  const logs = (_browseHistoryIndex && _browseHistoryIndex[c.id]) || [];
  if (!logs.length) return 'todo';
  return Math.max(...logs.map(l => l.score)) === 100 ? 'done' : 'attempted';
}

function _applyBrowseFilterSort(list) {
  const status = _getBrowseStatusFilter();
  const diff = _getBrowseDiffFilter();
  const level = _getBrowseLevelFilter();
  const sort = _getBrowseSort();
  let out = list.slice();

  out = libApplyCommonFilters('browse', out, 'challenge');
  if (status !== 'all') out = out.filter(c => _challengeStatus(c) === status);
  if (diff !== 'all') out = out.filter(c => (typeof getDifficulty === 'function' ? getDifficulty(c) : null) === diff);
  if (level === 'none') out = out.filter(c => getProgramLevel(c) === null);
  else if (level !== 'all') out = out.filter(c => getProgramLevel(c) === parseInt(level, 10));

  const logsOf = c => (_browseHistoryIndex && _browseHistoryIndex[c.id]) || [];
  const bestScore = c => { const l = logsOf(c); return l.length ? Math.max(...l.map(x => x.score)) : -1; };
  const lastDate = c => { const l = logsOf(c); return l.length ? Math.max(...l.map(x => x.startTime || 0)) : 0; };
  const attempts = c => logsOf(c).length;

  if (sort === 'title') out.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  else if (sort === 'best') out.sort((a, b) => bestScore(b) - bestScore(a));
  else if (sort === 'weakest') out.sort((a, b) => bestScore(a) - bestScore(b));
  else if (sort === 'attempts') out.sort((a, b) => attempts(b) - attempts(a));
  else if (sort === 'recent') out.sort((a, b) => lastDate(b) - lastDate(a));
  else if (sort === 'due') {
    const overdue = c => {
      const r = libReviewRec('challenge', c.id);
      return (r && r.due) ? _revDaysBetween(r.due, _revToday()) : -Infinity;
    };
    out.sort((a, b) => overdue(b) - overdue(a));
  }
  // Unlevelled programs sort last so the levelled run reads as a ladder.
  else if (sort === 'level') out.sort((a, b) => (getProgramLevel(a) ?? Infinity) - (getProgramLevel(b) ?? Infinity));
  // 'default' preserves the folder/search order.

  // Direction is applied before favourites float, so starring something keeps
  // it on top whichever way the list is running.
  out = libApplySortDir('browse', out);

  // Favourites always float to the top of whatever order was chosen.
  out.sort((a, b) => (libIsFavorite(b) ? 1 : 0) - (libIsFavorite(a) ? 1 : 0));
  return out;
}

function _renderBrowseFilterBar(total, shown, pool) {
  const status = _getBrowseStatusFilter();
  const diff = _getBrowseDiffFilter();
  const level = _getBrowseLevelFilter();
  const sort = _getBrowseSort();
  const chip = (active, onclick, label) =>
    `<button onclick="${onclick}" class="browse-filter-chip${active ? ' active' : ''}" style="font-size:0.74rem;padding:0.22rem 0.6rem;border-radius:999px;border:1px solid ${active ? 'var(--color-primary)' : 'var(--border-color)'};background:${active ? 'var(--color-primary-subtle)' : 'transparent'};color:${active ? 'var(--color-primary)' : 'var(--text-secondary)'};cursor:pointer;font-weight:600;white-space:nowrap;">${label}</button>`;
  const statusChips = [['all', 'All'], ['todo', 'To do'], ['attempted', 'In progress'], ['done', 'Completed']]
    .map(([v, l]) => chip(status === v, `setBrowseStatusFilter('${v}')`, l)).join('');
  const diffChips = [['all', 'Any'], ['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']]
    .map(([v, l]) => chip(diff === v, `setBrowseDiffFilter('${v}')`, l)).join('');
  // Levels are typed, not listed. A chip per level was fine with three programs
  // and unusable with fifty — the row grew without limit and pushed everything
  // else off the bar. The range is still shown so you know what exists.
  const levels = [...new Set((pool || []).map(getProgramLevel).filter(n => n !== null))].sort((a, b) => a - b);
  const hasUnlevelled = (pool || []).some(c => getProgramLevel(c) === null);
  let levelChips = '';
  if (levels.length) {
    const typed = /^\d+$/.test(String(level)) ? level : '';
    levelChips =
      chip(level === 'all', `setBrowseLevelFilter('all')`, 'Any') +
      `<span class="lib-level-input">
         <span class="lib-level-prefix">LV.</span>
         <input type="number" min="${levels[0]}" max="${levels[levels.length - 1]}" step="1"
                value="${escapeHTML(String(typed))}" placeholder="—" aria-label="Filter by level"
                oninput="setBrowseLevelFilterFromInput(this.value)" />
       </span>` +
      `<span class="lib-level-range" title="Levels used in this folder">${levels[0]}–${levels[levels.length - 1]}</span>` +
      (hasUnlevelled ? chip(level === 'none', `setBrowseLevelFilter('none')`, 'Unset') : '');
  }

  const sortOpts = [['default', 'Folder order'], ['recent', 'Recent'], ['due', 'Most overdue'],
                    ['title', 'Title A–Z'], ['best', 'Best score'], ['weakest', 'Weakest first'], ['attempts', 'Most attempts']];
  if (levels.length) sortOpts.splice(1, 0, ['level', 'Level ↑']);
  const sortSel = `<select onchange="setBrowseSort(this.value)" class="form-select lib-sort-select" title="Sort order">${sortOpts.map(([v, l]) => `<option value="${v}"${sort === v ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
  const filtered = status !== 'all' || diff !== 'all' || level !== 'all' || libAnyCommonFilterActive('browse');

  // Ladder and the programs/sets split change the LAYOUT, not the contents, so
  // they belong in View rather than among the filters.
  const ladder = _getBrowseLadder();
  const kind = _getBrowseKind();
  const view = `
    ${levels.length ? `<label class="lib-view-row">
      <input type="checkbox" ${ladder ? 'checked' : ''} onchange="toggleBrowseLadder()" />
      <span><strong>Level ladder</strong><em>Group the programs by level instead of a card grid</em></span>
    </label>` : ''}
    <div class="lib-view-row lib-view-seg">
      <span><strong>Show</strong></span>
      <span class="lib-kind-toggle">
        ${libChipHTML(kind === 'all', "setBrowseKind('all')", 'All')}
        ${libChipHTML(kind === 'programs', "setBrowseKind('programs')", 'Programs')}
        ${libChipHTML(kind === 'sets', "setBrowseKind('sets')", 'Sets')}
      </span>
    </div>
    <label class="lib-view-row">
      <input type="checkbox" ${getSessionParam('hideSubfolders') === 'false' ? 'checked' : ''}
             onchange="setSessionParam('hideSubfolders', this.checked ? 'false' : 'true'); renderBrowseContent();" />
      <span><strong>Subfolders</strong><em>Show subfolder tiles above the cards</em></span>
    </label>`;

  // What's currently narrowing the list, each removable on its own.
  const tag = libGetTagFilter('browse');
  const active = [];
  if (status !== 'all') active.push({ label: ({ todo: 'To do', attempted: 'In progress', done: 'Completed' })[status] || status, clear: `setBrowseStatusFilter('all')` });
  if (diff !== 'all') active.push({ label: diff[0].toUpperCase() + diff.slice(1), clear: `setBrowseDiffFilter('all')` });
  if (level !== 'all') active.push({ label: level === 'none' ? 'No level' : 'LV.' + level, clear: `setBrowseLevelFilter('all')` });
  if (getLibPref('browse.fav', false)) active.push({ label: '★ Favourites', clear: `libToggleFlag('browse','fav')` });
  if (getLibPref('browse.due', false)) active.push({ label: 'Due', clear: `libToggleFlag('browse','due')` });
  if (tag !== 'all') active.push({ label: '#' + escapeHTML(tag), clear: `libSetTagFilterExact('browse','all')` });

  return libFilterShellHTML({
    ns: 'browse',
    countLabel: filtered ? `${shown} of ${total}` : `${total} program${total !== 1 ? 's' : ''}`,
    active,
    onClear: 'clearBrowseFilters()',
    view,
    sort: sortSel,
    groups: [
      { icon: 'filter', chips: statusChips },
      { icon: 'bar-chart-2', chips: diffChips },
      levelChips ? { icon: 'swords', chips: levelChips } : null,
      { icon: 'star', chips: libCommonChipsHTML('browse', 'challenge', pool) },
      { icon: 'list-ordered', chips: libSortTypeChipsHTML('browse', 'setBrowseSort', sort, 'recent') },
      { icon: 'arrow-up-down', chips: libSortDirChipsHTML('browse') },
      // Tags are unbounded, so this row folds after the first handful.
      { icon: 'tag', chips: libFoldChips(_libTagChipsOnly('browse', pool), 8), wrap: true },
    ]
  });
}

/* ── Level ladder view ────────────────────────────────────────
   The LV. badge was a label and a filter but never an ordering you could see.
   The ladder groups the folder's programs by level so the run reads as a
   progression, and marks the first unfinished rung as where you are. */
function _renderBrowseLadder(list) {
  const levelled = list.filter(c => getProgramLevel(c) !== null)
    .sort((a, b) => getProgramLevel(a) - getProgramLevel(b));
  const unlevelled = list.filter(c => getProgramLevel(c) === null);
  if (!levelled.length) return '';

  const groups = new Map();
  levelled.forEach(c => {
    const lv = getProgramLevel(c);
    if (!groups.has(lv)) groups.set(lv, []);
    groups.get(lv).push(c);
  });

  let reachedCurrent = false;
  let html = '<div class="lib-ladder">';
  [...groups.entries()].forEach(([lv, items]) => {
    const done = items.every(c => _challengeStatus(c) === 'done');
    const current = !done && !reachedCurrent;
    if (current) reachedCurrent = true;
    html += `<div class="lib-ladder-rung${done ? ' done' : ''}${current ? ' current' : ''}">
      <div class="lib-ladder-lv"><span>LV.${lv}</span>${done ? '<i data-lucide="check" style="width:12px;height:12px;"></i>' : ''}</div>
      <div class="lib-ladder-items">
        ${items.map(c => {
          const st = _challengeStatus(c);
          return `<button class="lib-ladder-item ${st}" onclick="browseSelectProgram('${c.id}')" title="${escapeHTML(c.title)}">
            ${libIsFavorite(c) ? '<i data-lucide="star" style="width:11px;height:11px;fill:currentColor;"></i>' : ''}
            <span>${escapeHTML(c.title)}</span>
          </button>`;
        }).join('')}
      </div>
    </div>`;
  });
  html += '</div>';
  if (unlevelled.length) {
    html += `<p class="lib-ladder-note"><i data-lucide="info" style="width:12px;height:12px;"></i>
      ${unlevelled.length} program${unlevelled.length === 1 ? ' has' : 's have'} no level set — set one in Admin, or from the LV. badge during an attempt.</p>`;
  }
  return html;
}

/** Summarize a practice set's problems for cards/detail. */
function _setProblemSummary(set) {
  return (set.problems || []).map((p, i) => {
    if (p.source === 'library') {
      const c = (state.challenges || []).find(ch => ch.id === p.challengeId);
      const v = c ? (c.variants || []).find(x => x.id === p.variantId) : null;
      return {
        n: i + 1, source: 'library',
        title: c ? c.title : '⚠️ Missing program',
        sub: v ? (v.name + ((v.tests || []).length ? ` · ${v.tests.length} test${v.tests.length !== 1 ? 's' : ''}` : ' · reference')) : 'version missing'
      };
    }
    const tCount = (p.tests || []).length;
    return {
      n: i + 1, source: 'manual',
      title: p.title || 'Untitled problem',
      sub: tCount ? `${tCount} test${tCount !== 1 ? 's' : ''}` : ((p.referenceCode || '').trim() ? 'reference' : 'compile check')
    };
  });
}

/**
 * Best recorded score for a practice set, and how many sessions you've run.
 *
 * One session writes one history log PER PROBLEM, all sharing that session's
 * startTime (see practice-set.js) — that is what groups them. Grouping by date
 * would fold two sessions on the same day into one.
 */
function _setProgress(set) {
  const logs = (state.history || []).filter(h => h.setId === set.id && !h.isArchived);
  if (!logs.length) return { runs: 0, best: -1 };
  const bySession = new Map();
  logs.forEach(l => {
    const k = String(l.startTime || l.submitTime || l.date);
    if (!bySession.has(k)) bySession.set(k, []);
    bySession.get(k).push(l.score || 0);
  });
  const runScores = [...bySession.values()].map(a => Math.round(a.reduce((s, x) => s + x, 0) / a.length));
  return { runs: bySession.size, best: runScores.length ? Math.max(...runScores) : -1 };
}

/** Card for a practice set inside the folder overview (alongside programs). */
function _buildSetCard(set) {
  const n = (set.problems || []).length;
  const libCount = (set.problems || []).filter(p => p.source === 'library').length;
  const manCount = n - libCount;
  const { runs, best } = _setProgress(set);
  const scoreClass = best === 100 ? 'score-perfect' : best >= 50 ? 'score-partial' : best >= 0 ? 'score-low' : '';
  return `
    <div class="card card-enhanced card-set" onclick="browseSelectSet('${set.id}')" style="cursor:pointer;">
      <div class="card-set-ribbon"><i data-lucide="layout-grid" style="width:11px;height:11px;"></i> Practice Set</div>
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem; gap:0.5rem;">
        <h3 style="font-weight:700; font-size:1.1rem; color:var(--text-primary); flex:1; min-width:0; display:flex; align-items:center; gap:0.5rem;">
          <i data-lucide="layout-grid" style="width:18px;height:18px;color:var(--color-accent);flex-shrink:0;"></i>
          <span style="overflow:hidden;text-overflow:ellipsis;">${escapeHTML(set.title)}</span>
        </h3>
        <span class="version-pill">${n} problem${n !== 1 ? 's' : ''}</span>
      </div>
      <div style="display:flex; flex-wrap:wrap; gap:0.375rem; margin-bottom:0.75rem;">
        <span class="badge badge-neutral"><i data-lucide="rotate-ccw" style="width:12px;height:12px;margin-right:2px;"></i> ${runs} session${runs !== 1 ? 's' : ''}</span>
        ${best >= 0 ? `<span class="badge ${scoreClass}"><i data-lucide="target" style="width:12px;height:12px;margin-right:2px;"></i> Best: ${best}%</span>` : ''}
        ${libCount ? `<span class="badge badge-neutral"><i data-lucide="file-code" style="width:12px;height:12px;margin-right:2px;"></i> ${libCount} from library</span>` : ''}
        ${manCount ? `<span class="badge badge-neutral"><i data-lucide="pen-line" style="width:12px;height:12px;margin-right:2px;"></i> ${manCount} manual</span>` : ''}
      </div>
      <p class="line-clamp-2" style="font-size:0.875rem; color:var(--text-secondary); margin-bottom:0.75rem; min-height:2.5rem;">
        ${escapeHTML(set.description || 'A multi-problem session — switch freely, check each, submit at the end.')}
      </p>
      ${best >= 0 ? `<div class="card-score-bar"><div class="card-score-fill ${scoreClass}" style="width:${best}%;"></div></div>` : ''}
      <div style="margin-top:auto; display:flex; gap:0.5rem; padding-top:0.5rem;">
        <button onclick="event.stopPropagation(); startCodingSet('${set.id}')" class="btn btn-practice" style="flex:1;">
          <i data-lucide="play" style="width:16px;height:16px;fill:currentColor;"></i> ${runs ? 'Run Again' : 'Start Session'}
        </button>
      </div>
    </div>`;
}

/** Dedicated full practice-set view shown in pane 2 when a tree set is clicked. */
/**
 * The back control that sits at the head of every breadcrumb in this library.
 * @param {string|null} folderId where "back" goes: null means the library root.
 */
function _browseBackBtn(folderId) {
  const arg = folderId === null || folderId === undefined ? 'null' : `'${folderId}'`;
  return `<button class="btn-back-dark browse-back-btn" onclick="selectBrowseNode(${arg})" title="Back">` +
    `<i data-lucide="chevron-left" style="width:15px;height:15px;"></i> Back</button>`;
}

function _renderSetDetail(container, set) {
  const folder = set.parentId ? state.nodes.find(n => n.id === set.parentId) : null;
  const folderId = set.parentId || '__root__';

  let breadcrumbHtml = `<nav class="breadcrumb-nav">`;
  breadcrumbHtml += _browseBackBtn(folder ? folder.id : '__root__');
  breadcrumbHtml += `<button class="breadcrumb-item" onclick="selectBrowseNode(null)"><i data-lucide="home" style="width:12px;height:12px;"></i></button>`;
  if (folder) {
    getBreadcrumbPath(folder.id).forEach(node => {
      breadcrumbHtml += `<span class="breadcrumb-separator"><i data-lucide="chevron-right"></i></span>`;
      breadcrumbHtml += `<button class="breadcrumb-item" onclick="selectBrowseNode('${node.id}')">${escapeHTML(node.name)}</button>`;
    });
  } else {
    breadcrumbHtml += `<span class="breadcrumb-separator"><i data-lucide="chevron-right"></i></span>`;
    breadcrumbHtml += `<button class="breadcrumb-item" onclick="selectBrowseNode('__root__')">Uncategorized</button>`;
  }
  breadcrumbHtml += `<span class="breadcrumb-separator"><i data-lucide="chevron-right"></i></span>`;
  breadcrumbHtml += `<span class="breadcrumb-current">${escapeHTML(set.title)}</span></nav>`;

  const items = _setProblemSummary(set);
  const problemsHtml = items.map(p => `
    <div class="prog-variant-row">
      <div class="prog-variant-num">${String(p.n).padStart(2, '0')}</div>
      <div class="prog-variant-info">
        <div class="prog-variant-name">${escapeHTML(p.title)}</div>
        <div class="prog-variant-meta">
          <span class="sb-problem-badge ${p.source}">${p.source === 'library' ? 'Library' : 'Manual'}</span>
          <span>${escapeHTML(p.sub)}</span>
        </div>
      </div>
    </div>`).join('');

  // Fetch set attempts history
  const setLogs = getHistoryForSet(set.id);
  const setAttempts = groupSetAttempts(setLogs);

  let recentHtml = '';
  if (setAttempts.length > 0) {
    recentHtml = setAttempts.slice(0, 5).map(att => {
      const cls = att.score === 100 ? 'score-perfect' : att.score >= 50 ? 'score-partial' : 'score-low';
      const timeDisplay = (typeof formatTimeDisplay === 'function') ? formatTimeDisplay(att.duration || 0) : att.duration + 's';
      return `
        <div class="prog-attempt-row">
          <span class="prog-attempt-date">${escapeHTML(att.date || '')}</span>
          <span class="prog-attempt-basis">Duration: ${timeDisplay}</span>
          <div class="card-score-bar" style="flex:1;"><div class="card-score-fill ${cls}" style="width:${att.score}%;"></div></div>
          <span class="badge ${cls}">${att.score}% avg</span>
        </div>`;
    }).join('');
  }

  container.innerHTML = breadcrumbHtml + `
    <div class="animate-fade-in prog-detail">
      <div class="prog-detail-header">
        <div class="prog-detail-icon" style="background:rgba(6,182,212,0.14); color:var(--color-accent);"><i data-lucide="layout-grid"></i></div>
        <div style="flex:1; min-width:0;">
          <h1 class="prog-detail-title">${escapeHTML(set.title)}</h1>
          <div style="display:flex; flex-wrap:wrap; gap:0.375rem; margin-top:0.5rem;">
            <span class="badge badge-neutral"><i data-lucide="layers" style="width:12px;height:12px;margin-right:2px;"></i> ${items.length} problem${items.length !== 1 ? 's' : ''}</span>
            <span class="badge badge-neutral" style="color:var(--color-accent);"><i data-lucide="layout-grid" style="width:12px;height:12px;margin-right:2px;"></i> Practice Set</span>
            ${setAttempts.length > 0 ? `<span class="badge badge-neutral"><i data-lucide="rotate-ccw" style="width:12px;height:12px;margin-right:2px;"></i> ${setAttempts.length} attempt${setAttempts.length !== 1 ? 's' : ''}</span>` : ''}
          </div>
        </div>
      </div>

      <p class="prog-detail-desc">${escapeHTML(set.description || 'A CodeChum-style multi-problem session — switch between problems freely, check each one, then submit the whole attempt at the end.')}</p>

      <div class="prog-detail-actions">
        <button class="btn btn-practice btn-lg" onclick="startCodingSet('${set.id}')" style="flex:1; max-width:280px;">
          <i data-lucide="play" style="width:18px;height:18px;fill:currentColor;"></i> Start Session
        </button>
        <button class="btn btn-secondary" onclick="openSetBuilder('${set.id}'); spaNavigate('admin');" title="Edit this set in the Admin panel">
          <i data-lucide="pencil" style="width:16px;height:16px;"></i> Edit
        </button>
        <button class="btn btn-ghost" onclick="selectBrowseNode('${folderId === '__root__' ? '__root__' : folderId}')" title="Back to folder">
          <i data-lucide="folder-open" style="width:16px;height:16px;"></i> ${escapeHTML(folder ? folder.name : 'Uncategorized')}
        </button>
      </div>

      <div class="divider"></div>

      <h2 class="prog-detail-section-title"><i data-lucide="list-checks"></i> Problems</h2>
      <div class="prog-variant-list">${problemsHtml || '<div class="empty-state">This set has no problems.</div>'}</div>

      ${recentHtml ? `
        <h2 class="prog-detail-section-title" style="margin-top:1.75rem;"><i data-lucide="history"></i> Recent Attempts</h2>
        <div class="prog-attempt-list">${recentHtml}</div>` : ''}
    </div>
  `;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: container });
}

/* ── Recent Attempts, paged ────────────────────────────────────
   The list used to stop dead at 5 with no way to see the sixth. It now pages,
   and the page number is per-program so opening a different one starts at the
   top rather than on page 4 of something else. */
const PROG_ATTEMPTS_PER_PAGE = 5;
let _progAttemptPage = {};

function progAttemptsGoTo(challengeId, page) {
  _progAttemptPage[challengeId] = page;
  const host = document.getElementById('prog-attempt-block');
  if (!host) return;
  const logs = (_browseHistoryIndex && _browseHistoryIndex[challengeId]) || [];
  host.innerHTML = _progAttemptsPageHTML(challengeId, logs);
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: host });
}

function _progAttemptsPageHTML(challengeId, logs) {
  if (!logs.length) return '';
  const pages = Math.max(1, Math.ceil(logs.length / PROG_ATTEMPTS_PER_PAGE));
  const page = Math.min(Math.max(1, _progAttemptPage[challengeId] || 1), pages);
  const from = (page - 1) * PROG_ATTEMPTS_PER_PAGE;
  const slice = logs.slice(from, from + PROG_ATTEMPTS_PER_PAGE);

  const rows = slice.map((l, i) => {
    const cls = l.score === 100 ? 'score-perfect' : l.score >= 50 ? 'score-partial' : 'score-low';
    return `
      <div class="prog-attempt-row">
        <span class="prog-attempt-no">#${logs.length - (from + i)}</span>
        <span class="prog-attempt-date">${escapeHTML(l.date || '')}</span>
        <span class="prog-attempt-basis">${l.scoreBasis === 'tests' ? `Tests ${l.testsPassed}/${l.testsTotal}` : 'Reference match'}</span>
        <div class="card-score-bar" style="flex:1;"><div class="card-score-fill ${cls}" style="width:${l.score}%;"></div></div>
        <span class="badge ${cls}">${l.score}%</span>
      </div>`;
  }).join('');

  const pager = pages > 1 ? `
    <div class="prog-attempt-pager">
      <button class="prog-page-btn" ${page === 1 ? 'disabled' : ''}
              onclick="progAttemptsGoTo('${challengeId}', ${page - 1})" aria-label="Previous attempts">
        <i data-lucide="chevron-left" style="width:14px;height:14px;"></i> Previous
      </button>
      <span class="prog-page-info">${from + 1}–${from + slice.length} of ${logs.length}</span>
      <button class="prog-page-btn" ${page === pages ? 'disabled' : ''}
              onclick="progAttemptsGoTo('${challengeId}', ${page + 1})" aria-label="Next attempts">
        Next <i data-lucide="chevron-right" style="width:14px;height:14px;"></i>
      </button>
    </div>` : '';

  return `<div class="prog-attempt-list">${rows}</div>${pager}`;
}

/**
 * The stats strip under a program's title. These used to be a flat wrap of
 * badges with the tags mixed in among them, so "9 attempts" and "Math" carried
 * exactly the same weight and a program with a few tags turned into a wall.
 * Facts about your progress are now a labelled strip; tags are their own row,
 * capped so twenty of them can't push the description off the page.
 */
const PROG_TAGS_SHOWN = 6;

function _progStatsHTML(c, o) {
  const stat = (icon, label, value, cls) => `
    <div class="prog-stat${cls ? ' ' + cls : ''}">
      <i data-lucide="${icon}" style="width:13px;height:13px;"></i>
      <span class="prog-stat-body"><em>${label}</em><strong>${value}</strong></span>
    </div>`;
  const vCount = (c.variants || []).length;
  return `
    <div class="prog-stats">
      ${stat('layers', 'Versions', vCount)}
      ${stat('rotate-ccw', 'Attempts', o.attempts)}
      ${o.best >= 0 ? stat(o.best === 100 ? 'check-circle' : 'target', 'Best', o.best + '%', o.scoreClass) : ''}
      ${o.lastScore >= 0 ? stat('activity', 'Last score', o.lastScore + '%') : ''}
      ${o.lastAttempt ? stat('clock', 'Last attempt', escapeHTML(o.lastAttempt)) : ''}
      ${o.resumable ? stat('play-circle', 'Status', 'In progress', 'prog-stat-live') : ''}
    </div>`;
}

function _progTagsHTML(c) {
  const tags = c.tags || [];
  if (!tags.length) return '';
  const shown = tags.slice(0, PROG_TAGS_SHOWN);
  const rest = tags.length - shown.length;
  return `
    <div class="prog-tags" id="prog-tags">
      <i data-lucide="tag" style="width:12px;height:12px;"></i>
      ${shown.map(t => `<span class="badge badge-primary">${escapeHTML(t)}</span>`).join('')}
      ${rest > 0 ? `<button class="prog-tag-more" onclick="progShowAllTags('${c.id}')">+${rest} more</button>` : ''}
    </div>`;
}

function progShowAllTags(challengeId) {
  const c = (state.challenges || []).find(x => x.id === challengeId);
  const host = document.getElementById('prog-tags');
  if (!c || !host) return;
  host.innerHTML = `<i data-lucide="tag" style="width:12px;height:12px;"></i>` +
    (c.tags || []).map(t => `<span class="badge badge-primary">${escapeHTML(t)}</span>`).join('');
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: host });
}

/** Dedicated full program view shown in pane 2 when a tree file is clicked. */
function _renderProgramDetail(container, c) {
  const logs = (_browseHistoryIndex && _browseHistoryIndex[c.id]) || [];
  const attemptsCount = logs.length;
  const bestScore = logs.length > 0 ? Math.max(...logs.map(l => l.score)) : -1;
  const lastScore = logs.length > 0 ? logs[0].score : -1;    // logs are newest-first
  const isPerfect = bestScore === 100;
  const lastAttempt = logs.length > 0 ? logs[0].date : null;
  const scoreClass = bestScore === 100 ? 'score-perfect' : bestScore >= 50 ? 'score-partial' : bestScore >= 0 ? 'score-low' : '';
  const resumable = browseHasResumable(c);
  const folderId = c.parentId || '__root__';
  const folder = c.parentId ? state.nodes.find(n => n.id === c.parentId) : null;

  // Breadcrumbs: Home › …folders… › Program
  let breadcrumbHtml = `<nav class="breadcrumb-nav">`;
  breadcrumbHtml += _browseBackBtn(folder ? folder.id : '__root__');
  breadcrumbHtml += `<button class="breadcrumb-item" onclick="selectBrowseNode(null)"><i data-lucide="home" style="width:12px;height:12px;"></i></button>`;
  if (folder) {
    getBreadcrumbPath(folder.id).forEach(node => {
      breadcrumbHtml += `<span class="breadcrumb-separator"><i data-lucide="chevron-right"></i></span>`;
      breadcrumbHtml += `<button class="breadcrumb-item" onclick="selectBrowseNode('${node.id}')">${escapeHTML(node.name)}</button>`;
    });
  } else {
    breadcrumbHtml += `<span class="breadcrumb-separator"><i data-lucide="chevron-right"></i></span>`;
    breadcrumbHtml += `<button class="breadcrumb-item" onclick="selectBrowseNode('__root__')">Uncategorized</button>`;
  }
  breadcrumbHtml += `<span class="breadcrumb-separator"><i data-lucide="chevron-right"></i></span>`;
  breadcrumbHtml += `<span class="breadcrumb-current">${escapeHTML(c.title)}</span></nav>`;

  const coverHtml = c.coverImage
    ? `<div class="prog-detail-cover"><img src="${c.coverImage}" alt="" /></div>`
    : '';

  const variantsHtml = (c.variants || []).map((v, i) => {
    const fileCount = (v.files || []).length || 1;
    const testCount = (v.tests || []).length;
    const vDesc = (v.description || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return `
      <div class="prog-variant-row">
        <div class="prog-variant-num">${String(i + 1).padStart(2, '0')}</div>
        <div class="prog-variant-info">
          <div class="prog-variant-name">${escapeHTML(v.name || 'Version ' + (i + 1))}</div>
          <div class="prog-variant-meta">
            <span><i data-lucide="file-code" style="width:11px;height:11px;"></i> ${fileCount} file${fileCount !== 1 ? 's' : ''}</span>
            ${testCount > 0 ? `<span><i data-lucide="flask-conical" style="width:11px;height:11px;"></i> ${testCount} test${testCount !== 1 ? 's' : ''}</span>` : ''}
            ${vDesc ? `<span class="prog-variant-desc">${escapeHTML(vDesc.slice(0, 90))}${vDesc.length > 90 ? '…' : ''}</span>` : ''}
          </div>
        </div>
        <button class="btn btn-practice btn-sm" onclick="browseStartVariant('${c.id}', '${v.id}')">
          <i data-lucide="play" style="width:14px;height:14px;fill:currentColor;"></i> Practice
        </button>
      </div>`;
  }).join('');

  const recentHtml = _progAttemptsPageHTML(c.id, logs);
  const dueText = typeof agDeadlineTextHTML === 'function' ? agDeadlineTextHTML('challenge', c.id) : '';
  const hasDeadline = !!dueText;

  container.innerHTML = breadcrumbHtml + `
    <div class="animate-fade-in prog-detail">
      ${coverHtml}
      <div class="prog-detail-header">
        <div class="prog-detail-icon"><i data-lucide="file-code"></i></div>
        <div style="flex:1; min-width:0;">
          <h1 class="prog-detail-title">${escapeHTML(c.title)} ${getLevelBadgeHTML(c)} ${typeof getDifficultyBadgeHTML === 'function' ? getDifficultyBadgeHTML(c) : ''}</h1>
          ${_progStatsHTML(c, { attempts: attemptsCount, best: bestScore, lastScore: lastScore,
                                lastAttempt: lastAttempt, scoreClass: scoreClass, resumable: resumable })}
          ${_progTagsHTML(c)}
        </div>
        ${dueText ? `<div class="prog-detail-due">${dueText}</div>` : ''}
        ${isPerfect ? '<div class="card-completed-badge" style="position:static;flex-shrink:0;"><i data-lucide="check" style="width:12px;height:12px;"></i></div>' : ''}
      </div>

      <p class="prog-detail-desc">${escapeHTML(c.coverDescription || c.variants[0]?.description || 'No description.')}</p>

      <div class="prog-detail-actions">
        ${resumable ? `
        <button class="btn btn-practice btn-lg" onclick="browseResume('${c.id}')" style="flex:1; max-width:280px;">
          <i data-lucide="play" style="width:18px;height:18px;fill:currentColor;"></i> Resume attempt
        </button>
        <button class="btn btn-secondary btn-lg" onclick="browseStartFresh('${c.id}')" title="Discard the unfinished attempt and begin again from the starter code">
          <i data-lucide="rotate-ccw" style="width:16px;height:16px;"></i> Start over
        </button>` : `
        <button class="btn btn-practice btn-lg" onclick="browseStartFresh('${c.id}')" style="flex:1; max-width:280px;">
          <i data-lucide="play" style="width:18px;height:18px;fill:currentColor;"></i> ${isPerfect ? 'Practice Again' : 'Start Practice'}
        </button>`}
        <button class="btn btn-secondary" onclick="agOpenDeadlineModal('challenge', '${c.id}')"
                title="${hasDeadline ? 'Change or clear the deadline on this program' : 'Put a due date on this program'}">
          <i data-lucide="flag" style="width:16px;height:16px;"></i> ${hasDeadline ? 'Deadline' : 'Set Deadline'}
        </button>
        <button class="btn btn-secondary" onclick="shareChallenge('${c.id}')">
          <i data-lucide="share-2" style="width:16px;height:16px;"></i> Share
        </button>
        <button class="btn btn-ghost" onclick="selectBrowseNode('${folderId === '__root__' ? '__root__' : folderId}')" title="Back to folder">
          <i data-lucide="folder-open" style="width:16px;height:16px;"></i> ${escapeHTML(folder ? folder.name : 'Uncategorized')}
        </button>
      </div>

      <div class="divider"></div>

      <h2 class="prog-detail-section-title"><i data-lucide="layers"></i> Versions</h2>
      <div class="prog-variant-list">${variantsHtml || '<div class="empty-state">No versions configured.</div>'}</div>

      ${(() => {
        // The snippet → challenge link was one-directional: a snippet knew its
        // programs, but a program never said which snippets were relevant to it.
        const rel = typeof snippetsForChallenge === 'function' ? snippetsForChallenge(c.id) : [];
        if (!rel.length) return '';
        return `
        <h2 class="prog-detail-section-title" style="margin-top:1.75rem;"><i data-lucide="code"></i> Relevant snippets</h2>
        <div class="prog-snippet-list">
          ${rel.map(s => `
            <button class="prog-snippet-row" onclick="setSessionParam('activeSnippetId','${s.id}'); spaNavigate('snippets');" title="Open in the Snippet Library">
              <i data-lucide="code" style="width:15px;height:15px;"></i>
              <span class="prog-snippet-name">${escapeHTML(s.title)}</span>
              ${getSnippetLanguage(s) ? `<span class="lib-lang-badge">${escapeHTML(getSnippetLanguage(s).toUpperCase())}</span>` : ''}
              <i data-lucide="arrow-up-right" style="width:14px;height:14px;opacity:0.6;"></i>
            </button>`).join('')}
        </div>`;
      })()}

      ${recentHtml ? `
        <h2 class="prog-detail-section-title" style="margin-top:1.75rem;"><i data-lucide="history"></i> Recent Attempts</h2>
        <div id="prog-attempt-block">${recentHtml}</div>` : ''}
    </div>
  `;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: container });
}

function renderBrowseContent() {
  const container = document.getElementById('browse-challenges-container');
  if (!container) return;

  const searchInput = document.getElementById('browse-search');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  // Dedicated practice-set detail view (opened by clicking a set in the tree)
  if (browseActiveSetId) {
    const set = (state.codingSets || []).find(s => s.id === browseActiveSetId);
    if (set) {
      _renderSetDetail(container, set);
      return;
    }
    browseActiveSetId = null;
    setSessionParam('browseActiveSet', null);
  }

  // Dedicated program detail view (opened by clicking a file in the tree)
  if (browseActiveProgramId) {
    const prog = state.challenges.find(c => c.id === browseActiveProgramId);
    if (prog) {
      _renderProgramDetail(container, prog);
      return;
    }
    // Stale id (program deleted) — fall through to the folder view
    browseActiveProgramId = null;
    setSessionParam('browseActiveProgram', null);
  }

  if (!browseActiveNodeId) {
    container.innerHTML = `
      <div class="empty-state" style="height: 100%; display: flex; align-items: center; justify-content: center; flex-direction: column;">
        <i data-lucide="folder-open" style="width: 48px; height: 48px; opacity: 0.5; margin-bottom: 1rem;"></i>
        <h2>Select a folder</h2>
        <p style="font-size: 0.875rem; color: var(--text-tertiary); margin-top: 0.5rem;">Choose a folder from the left pane to view its programs.</p>
      </div>`;
    return;
  }

  // Get folder info for breadcrumbs
  const isRoot = browseActiveNodeId === '__root__';
  const currentFolder = isRoot ? null : state.nodes.find(n => n.id === browseActiveNodeId);

  // Breadcrumbs
  let breadcrumbHtml = `<nav class="breadcrumb-nav">`;
  // A folder can go up to its own parent; the root has nowhere above it.
  breadcrumbHtml += (!isRoot && currentFolder && currentFolder.parentId)
    ? _browseBackBtn(currentFolder.parentId)
    : (!isRoot && currentFolder ? _browseBackBtn(null) : '');
  breadcrumbHtml += `<button class="breadcrumb-item" onclick="selectBrowseNode(null)">
    <i data-lucide="home" style="width:12px;height:12px;"></i>
  </button>`;

  if (isRoot) {
    breadcrumbHtml += `<span class="breadcrumb-separator"><i data-lucide="chevron-right"></i></span>`;
    breadcrumbHtml += `<span class="breadcrumb-current">Uncategorized</span>`;
  } else if (currentFolder) {
    const path = getBreadcrumbPath(browseActiveNodeId);
    path.forEach((node, idx) => {
      breadcrumbHtml += `<span class="breadcrumb-separator"><i data-lucide="chevron-right"></i></span>`;
      if (idx < path.length - 1) {
        breadcrumbHtml += `<button class="breadcrumb-item" onclick="selectBrowseNode('${node.id}')">${escapeHTML(node.name)}</button>`;
      } else {
        breadcrumbHtml += `<span class="breadcrumb-current">${escapeHTML(node.name)}</span>`;
      }
    });
  }
  breadcrumbHtml += `</nav>`;

  // Check lock status
  let isLocked = false;
  let lockMessage = '';
  if (!isRoot && currentFolder) {
    const req = state.categoryRequirements ? state.categoryRequirements[currentFolder.id] : null;
    if (req) {
      if (req.requiredChallengeIds && req.requiredChallengeIds.length > 0) {
        const incomplete = req.requiredChallengeIds.filter(cId => !state.history.some(h => h.challengeId === cId && h.score === 100 && !h.isArchived));
        if (incomplete.length > 0) {
          isLocked = true;
          const names = incomplete.map(cId => { const c = state.challenges.find(ch => ch.id === cId); return c ? c.title : '???'; });
          lockMessage = `Complete these programs first: ${names.map(n => '"' + escapeHTML(n) + '"').join(', ')}`;
        }
      } else if (req.reqNodeId) {
        const completed = getCompletedCount(req.reqNodeId);
        if (completed < req.count) {
          isLocked = true;
          const reqFolder = state.nodes.find(n => n.id === req.reqNodeId);
          const reqName = reqFolder ? reqFolder.name : req.reqCat || 'Unknown';
          lockMessage = `Requires ${req.count} completed program(s) in "${escapeHTML(reqName)}" (Currently: ${completed})`;
        }
      }
    }
  }

  if (isLocked) {
    container.innerHTML = breadcrumbHtml + `
      <div class="empty-state" style="height: 80%; display: flex; align-items: center; justify-content: center; flex-direction: column;">
        <i data-lucide="lock" style="width: 48px; height: 48px; color: var(--color-warning); margin-bottom: 1rem;"></i>
        <h2 style="color: var(--color-warning);">Folder Locked</h2>
        <p style="font-size: 0.875rem; margin-top: 0.5rem; color: var(--text-tertiary);">${lockMessage}</p>
      </div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: container });
    return;
  }

  // Apply search filter globally if query exists
  let challenges = [];
  let childFolders = [];

  let sets = [];
  if (query) {
    challenges = state.challenges.filter(c => itemMatchesQuery(c, query));
    sets = (state.codingSets || []).filter(s => fuzzyMatch(s.title, query));
  } else {
    const folderId = isRoot ? null : browseActiveNodeId;
    // Normalize parentId: legacy/imported programs can carry `undefined` instead of
    // null, which used to make them count towards "Uncategorized" without ever listing.
    challenges = state.challenges.filter(c => (c.parentId || null) === folderId);
    childFolders = isRoot ? [] : getChildFolders(browseActiveNodeId, 'challenge');
    sets = getSetsInFolder(folderId);
  }

  // Filter & sort the program list (status / difficulty / sort). Keep the
  // pre-filter set for folder stats and the "truly empty" check.
  const _preFilterChallenges = challenges;
  challenges = _applyBrowseFilterSort(challenges);

  // Subfolders cards
  let subfoldersHtml = '';
  if (childFolders.length > 0) {
    subfoldersHtml = `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.75rem; margin-bottom: 1.5rem;">`;
    childFolders.forEach(sf => {
      const sfCount = countItemsRecursive(sf.id, 'challenge');
      subfoldersHtml += `
        <div class="subfolder-card" onclick="selectBrowseNode('${sf.id}'); toggleNodeExpanded('${sf.id}');">
          <i data-lucide="folder"></i>
          <span class="subfolder-card-label">${escapeHTML(sf.name)}</span>
          <span class="subfolder-card-count">${sfCount} item${sfCount !== 1 ? 's' : ''}</span>
        </div>
      `;
    });
    subfoldersHtml += `</div>`;
  }

  let folderName = isRoot ? 'Uncategorized' : (currentFolder ? currentFolder.name : 'Library');

  if (query) {
    breadcrumbHtml = `<nav class="breadcrumb-nav"><span class="breadcrumb-current">Search Results for "${escapeHTML(query)}"</span></nav>`;
    folderName = `Search Results`;
  }

  if (_preFilterChallenges.length === 0 && childFolders.length === 0 && sets.length === 0) {
    container.innerHTML = breadcrumbHtml + `
      <div class="empty-state" style="height: 80%; display: flex; align-items: center; justify-content: center; flex-direction: column;">
        <div class="empty-state-icon-animated">
          <i data-lucide="folder-open" style="width: 48px; height: 48px; opacity: 0.5;"></i>
          <div class="empty-state-pulse-ring"></div>
        </div>
        <h2>No programs found</h2>
        <p style="font-size: 0.875rem; margin-top: 0.5rem;">
          ${query ? `No results for "${escapeHTML(query)}"` : `No programs available in ${escapeHTML(folderName)}.`}
        </p>
      </div>`;
  } else {
    const hideSubfolders = getSessionParam('hideSubfolders') !== 'false';

    // In search mode the heading is "Search Results", so it must NOT carry the
    // previously-selected folder's description, progress bar or click-to-edit
    // handlers — editing there silently renamed a folder you weren't looking at.
    const headerFolder = query ? null : currentFolder;

    // Folder-level stats use the full (pre-filter) set so the progress bar
    // reflects the folder, not the current filter view.
    const folderChallenges = _preFilterChallenges;
    const folderCompleted = folderChallenges.filter(c =>
      state.history.some(h => h.challengeId === c.id && h.score === 100 && !h.isArchived)
    ).length;
    const folderPct = folderChallenges.length > 0 ? Math.round((folderCompleted / folderChallenges.length) * 100) : 0;

    const filterBarHtml = _preFilterChallenges.length > 0
      ? _renderBrowseFilterBar(_preFilterChallenges.length, challenges.length, _preFilterChallenges)
      : '';

    // Pagination: slice challenges for current page
    const totalChallenges = challenges.length;
    const totalPages = Math.max(1, Math.ceil(totalChallenges / ITEMS_PER_PAGE));
    let currentPage = parseInt(getSessionParam('browsePage'), 10) || 1;
    currentPage = Math.max(1, Math.min(currentPage, totalPages));
    const pageStart = (currentPage - 1) * ITEMS_PER_PAGE;
    const pageChallenges = challenges.slice(pageStart, pageStart + ITEMS_PER_PAGE);

    // Practice-set cards render first in the grid so a folder's sessions sit above
    // its individual programs — but only on page 1, otherwise every page repeats them.
    const kind = _getBrowseKind();
    const showSets = kind !== 'programs';
    const showProgs = kind !== 'sets';
    const setCardsHtml = (showSets && currentPage === 1) ? sets.map(s => _buildSetCard(s)).join('') : '';
    const progCardsHtml = showProgs ? pageChallenges.map(c => _buildChallengeCard(c, query)).join('') : '';

    // The ladder replaces the card grid — it IS the alternative reading of the
    // same list, not a decoration on top of it.
    const ladderHtml = _getBrowseLadder() ? _renderBrowseLadder(challenges) : '';

    const gridHtml = ladderHtml
      ? ladderHtml
      : (progCardsHtml || setCardsHtml)
        ? `<div class="card-grid ${window.disableNextStagger ? '' : 'stagger-children'}" id="browse-card-grid">
            ${setCardsHtml}${progCardsHtml}
          </div>`
        : (_preFilterChallenges.length > 0
          ? `<div class="empty-state" style="padding:2.5rem 1rem; text-align:center; display:flex; flex-direction:column; align-items:center;">
              <i data-lucide="filter-x" style="width:36px;height:36px;opacity:0.5;margin-bottom:0.75rem;"></i>
              <h3 style="font-weight:700;">No programs match these filters</h3>
              <button class="btn btn-secondary btn-sm" onclick="clearBrowseFilters()" style="margin-top:0.75rem;">
                <i data-lucide="x" style="width:14px;height:14px;"></i> Clear filters
              </button>
            </div>`
          : '');

    const paginationHtml = ladderHtml ? '' : _buildPaginationBar(totalChallenges, currentPage, 'browsePage');
    const bulkBarHtml = libSelectionBarHTML('browse', pageChallenges.map(c => c.id));

    container.innerHTML = breadcrumbHtml + `
      <div class="animate-fade-in">
        <div class="browse-folder-header">
          <div class="browse-folder-info">
            <h2 class="browse-folder-title" ${headerFolder ? `onclick="browseEditFolderTitle('${headerFolder.id}')" title="Click to edit title"` : ''}>${escapeHTML(folderName)}</h2>
            <p class="browse-folder-desc" ${headerFolder ? `onclick="browseEditFolderDesc('${headerFolder.id}')" title="Click to edit description"` : ''}>${
              query
                ? `<span style="color:var(--text-tertiary);">${_preFilterChallenges.length} program${_preFilterChallenges.length !== 1 ? 's' : ''}${sets.length ? ` and ${sets.length} practice set${sets.length !== 1 ? 's' : ''}` : ''} matching &ldquo;${escapeHTML(query)}&rdquo;</span>`
                : (headerFolder && headerFolder.description
                  ? escapeHTML(headerFolder.description)
                  : '<span style="color:var(--text-tertiary);font-style:italic;">Click to add a description...</span>')
            }</p>
          </div>
          <div class="browse-folder-actions">
            ${query ? '' : `<div class="browse-folder-progress" title="${folderCompleted}/${folderChallenges.length} completed">
              <div class="folder-progress-bar">
                <div class="folder-progress-fill" style="width: ${folderPct}%;"></div>
              </div>
              <span class="folder-progress-label">${folderPct}%</span>
            </div>`}
            ${libSelectToggleHTML('browse')}
          </div>
        </div>
        ${filterBarHtml}
        ${hideSubfolders ? '' : subfoldersHtml}
        ${gridHtml}
        ${paginationHtml}
        ${bulkBarHtml}
      </div>
    `;
  }

  // Restore scroll
  setTimeout(() => {
    const pane2 = document.querySelector('.messenger-pane-2');
    if (pane2) pane2.scrollTop = getSessionParam('browseScroll') || 0;
  }, 50);

  if (typeof lucide !== 'undefined') lucide.createIcons({ root: container });
  window.disableNextStagger = false;
}

// ============================================================
// CONTEXT MENU
// ============================================================

function showTreeContextMenu(e, nodeId) {
  ctxTargetNodeId = nodeId;
  const menu = document.getElementById('tree-context-menu');
  if (!menu) return;

  // Position menu
  menu.style.left = e.clientX + 'px';
  menu.style.top = e.clientY + 'px';
  menu.classList.remove('hidden');

  // Adjust menu label based on context
  const isRoot = nodeId === null;
  const newFolderBtn = document.getElementById('ctx-new-folder');
  const renameBtn = document.getElementById('ctx-rename');
  const moveBtn = document.getElementById('ctx-move');
  const deleteBtn = document.getElementById('ctx-delete');

  if (isRoot) {
    if (newFolderBtn) newFolderBtn.innerHTML = `<i data-lucide="folder-plus"></i> New Root Folder`;
    if (renameBtn) renameBtn.style.display = 'none';
    if (moveBtn) moveBtn.style.display = 'none';
    if (deleteBtn) deleteBtn.style.display = 'none';
  } else {
    if (newFolderBtn) newFolderBtn.innerHTML = `<i data-lucide="folder-plus"></i> New Subfolder`;
    if (renameBtn) renameBtn.style.display = '';
    if (moveBtn) moveBtn.style.display = '';
    if (deleteBtn) deleteBtn.style.display = '';
  }

  // Hide tier/lock buttons for root
  const tierBtn = document.getElementById('ctx-tier');
  const lockBtn = document.getElementById('ctx-lock');
  if (tierBtn) tierBtn.style.display = isRoot ? 'none' : '';
  if (lockBtn) lockBtn.style.display = isRoot ? 'none' : '';

  if (typeof lucide !== 'undefined') lucide.createIcons({ root: menu });

  // Close menu on outside click
  setTimeout(() => {
    document.addEventListener('click', closeTreeContextMenu, { once: true });
  }, 10);
}

function ctxSetTier(value) {
  if (!ctxTargetNodeId) return;
  updateFolderTier(ctxTargetNodeId, value || null);
  renderBrowse();
}

function ctxOpenTierPicker() {
  closeTreeContextMenu();
  if (!ctxTargetNodeId) return;
  openTierPicker(ctxTargetNodeId);
}

function ctxOpenLockPicker() {
  closeTreeContextMenu();
  if (!ctxTargetNodeId) return;
  openLockPicker(ctxTargetNodeId, 'challenge');
}

function closeTreeContextMenu() {
  const menu = document.getElementById('tree-context-menu');
  if (menu) menu.classList.add('hidden');
}

function ctxNewFolder() {
  closeTreeContextMenu();

  // Determine scope from parent before opening dialog
  let scope = 'challenge';
  if (ctxTargetNodeId) {
    const parent = state.nodes.find(n => n.id === ctxTargetNodeId);
    if (parent) scope = parent.scope;
  }
  const parentId = ctxTargetNodeId;

  showInputDialog('New Folder', null, 'Folder name', '', (name) => {
    const node = createNode(name, 'folder', parentId, scope);
    if (parentId && !isNodeExpanded(parentId)) toggleNodeExpanded(parentId);
    renderBrowse();
  });
}

function ctxRenameFolder() {
  closeTreeContextMenu();
  if (!ctxTargetNodeId) return;
  const folder = state.nodes.find(n => n.id === ctxTargetNodeId);
  if (!folder) return;

  const nodeId = ctxTargetNodeId;
  showInputDialog('Rename Folder', null, 'New name', folder.name, (newName) => {
    if (newName === folder.name) return;
    renameNode(nodeId, newName);
    renderBrowse();
  });
}

function ctxMoveFolder() {
  closeTreeContextMenu();
  if (!ctxTargetNodeId) return;
  const folder = state.nodes.find(n => n.id === ctxTargetNodeId);
  if (!folder) return;

  const nodeId = ctxTargetNodeId;

  // Valid targets: same scope, not self, not a descendant
  const validTargets = state.nodes.filter(n =>
    n.type === 'folder' &&
    n.scope === folder.scope &&
    n.id !== nodeId &&
    !isDescendantOf(n.id, nodeId)
  );

  const options = validTargets.map(t => ({
    label: getBreadcrumbPath(t.id).map(n => escapeHTML(n.name)).join(' › '),
    value: t.id
  }));

  showListPickerDialog(
    'Move Folder',
    `Move "${escapeHTML(folder.name)}" to:`,
    options,
    (newParentId) => {
      moveNode(nodeId, newParentId);
      renderBrowse();
    }
  );
}

function ctxDeleteFolder() {
  closeTreeContextMenu();
  if (!ctxTargetNodeId) return;
  const folder = state.nodes.find(n => n.id === ctxTargetNodeId);
  if (!folder) return;
  const targetId = ctxTargetNodeId;

  if (typeof showConfirm === 'function') {
    showConfirm("Delete Folder", `Delete "${escapeHTML(folder.name)}"? Items will become uncategorized. You can undo this.`, () => {
      if (browseActiveNodeId === targetId) browseActiveNodeId = null;
      softDeleteFolder(targetId, () => renderBrowse());
    });
  } else {
    if (!confirm(`Delete "${folder.name}"? Items will become uncategorized.`)) return;
    if (browseActiveNodeId === targetId) browseActiveNodeId = null;
    softDeleteFolder(targetId, () => renderBrowse());
  }
}

async function ctxChangeIcon() {
  closeTreeContextMenu();
  if (!ctxTargetNodeId) return;
  const folder = state.nodes.find(n => n.id === ctxTargetNodeId);
  if (!folder) return;

  const currentIcon = folder.icon || 'folder';
  const newIcon = await openIconPicker(currentIcon);
  if (!newIcon || !newIcon.trim() || newIcon.trim() === currentIcon) return;

  folder.icon = newIcon.trim();
  saveData();
  renderBrowse();
}

// ============================================================
// TIMER MODAL LOGIC
// ============================================================
// promptTimer(), closeTimerModal() and confirmStartPractice() are defined once
// in study.js (loaded after this file) and shared across the Coding Library and
// Training Grounds. The duplicate copies that used to live here were dead code
// (overwritten at load time) and have been removed to avoid divergence.

// ============================================================
// SHAREABLE CHALLENGES (Workstream 4)
// ============================================================

function shareChallenge(challengeId) {
  const challenge = state.challenges.find(c => c.id === challengeId);
  if (!challenge) return;

  /* Everything that defines the program travels. The old payload carried only
     title/tags/cover and a variant's name+code, so a shared program arrived
     with no test cases, no minimum requirements and a single flattened file —
     it looked complete and then failed the moment you pressed Check Code.
     Only the recipient's own progress is left behind. */
  const shareable = {
    _type: 'challenge',
    _v: 2,
    title: challenge.title,
    tags: challenge.tags || [],
    coverDescription: challenge.coverDescription || '',
    level: challenge.level != null ? challenge.level : null,
    icon: challenge.icon || null,
    color: challenge.color || null,
    alias: challenge.alias || null,
    cheatsheet: !!challenge.cheatsheet,
    variants: (challenge.variants || []).map(v => ({
      id: v.id,
      name: v.name,
      description: v.description || '',
      code: v.code || '',
      starterCode: v.starterCode || '',
      samples: v.samples || [],
      tests: (v.tests || []).map(t => ({
        name: t.name || '',
        stdin: t.stdin || '',
        expected: t.expected || '',
        hidden: !!t.hidden
      })),
      minRequirements: (v.minRequirements || []).map(r => ({ type: r.type })),
      files: (v.files || []).map(f => ({
        name: f.name,
        ext: f.ext,
        code: f.code || '',
        starterCode: f.starterCode || ''
      }))
    }))
  };

  const encoded = encodeShareData(shareable);
  if (!encoded) {
    if (typeof showMessage === 'function') showMessage('Error', 'Failed to encode challenge for sharing.', true);
    return;
  }

  const url = window.location.origin + window.location.pathname + '?data=' + encoded;
  warnIfShareUrlTooLong(url);
  copyShareLink(url, 'Link copied to clipboard!');
}

function showShareToast(message) {
  let toast = document.getElementById('share-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'share-toast';
    toast.style.cssText = 'position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);background:var(--color-primary);color:#fff;padding:0.75rem 1.5rem;border-radius:var(--radius-md);font-weight:600;font-size:0.875rem;z-index:9999;opacity:0;transition:opacity 0.3s ease;pointer-events:none;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.opacity = '1';
  setTimeout(() => { toast.style.opacity = '0'; }, 2500);
}

function checkSharedChallenge() {
  // Nothing is read from the URL here any more: captureSharePayload() lifted it
  // out at boot and applyPendingShare() files it the moment a storage mode is
  // known. This remains so a share can still be handled if the library mounts
  // first (e.g. a link opened in a session that already had a mode).
  if (typeof hasPendingShare === 'function' && hasPendingShare()) {
    const pending = takePendingShare();
    if (pending && pending._type === 'challenge') importSharedChallenge(pending);
  }
}

/**
 * Files a shared program into the current workspace and shows it.
 * @returns {string|null} the new id
 */
function importSharedChallenge(shared) {
  if (!shared) return null;
  const tempId = 'shared_' + Date.now();
  const tempChallenge = {
    id: tempId,
    title: '[Shared] ' + (shared.title || 'Challenge'),
    tags: shared.tags || [],
    coverDescription: shared.coverDescription || '',
    level: shared.level != null ? shared.level : null,
    icon: shared.icon || null,
    color: shared.color || null,
    alias: shared.alias || null,
    cheatsheet: !!shared.cheatsheet,
    parentId: null,
    variants: (shared.variants || []).map(v => ({
      id: v.id || generateId(),
      name: v.name || 'Version 1',
      description: v.description || '',
      code: v.code || '',
      starterCode: v.starterCode || '',
      samples: v.samples || [],
      tests: v.tests || [],
      minRequirements: v.minRequirements || [],
      activeFileIndex: 0,
      // Older links carry no files array; rebuild one from the flat code so the
      // editor always has something to open.
      files: (v.files && v.files.length)
        ? v.files.map(f => ({ id: generateId(), name: f.name || 'main', ext: f.ext || '.c',
                              code: f.code || '', starterCode: f.starterCode || '' }))
        : [{ id: generateId(), name: 'main', ext: '.c', code: v.code || '', starterCode: v.starterCode || '' }]
    }))
  };

  if (!state.challenges) state.challenges = [];
  state.challenges.unshift(tempChallenge);
  saveData();

  const testCount = tempChallenge.variants.reduce((n, v) => n + (v.tests || []).length, 0);
  if (typeof showShareToast === 'function') {
    showShareToast('Added "' + tempChallenge.title + '"' + (testCount ? ' with ' + testCount + ' test case' + (testCount !== 1 ? 's' : '') : ''));
  }

  setTimeout(() => {
    if (typeof selectBrowseNode === 'function') selectBrowseNode('__root__');
    setTimeout(() => {
      const card = document.getElementById('card-' + tempId);
      if (card) {
        card.style.boxShadow = '0 0 0 2px var(--color-primary)';
        card.style.transition = 'box-shadow 0.3s ease';
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 120);
  }, 300);
  return tempId;
}

// ============================================================
// DRAG & DROP REORDERING
// ============================================================

/* Drag and drop now lives in tree-dnd.js, shared with the Notebook, Snippet and
   Visualize trees. This is only the Coding Library's half of the contract. */
/* -- Tree view toggles + per-item colour -----------------------
   Reached from the pane's right-click menu, so the tree can show as much or as
   little as you want without a settings page. */
const BROWSE_SHOW_KEY = 'browseRowShow';
function browseShow(what) {
  try { return (JSON.parse(localStorage.getItem(BROWSE_SHOW_KEY)) || {})[what] === true; } catch (e) { return false; }
}
function browseToggleShow(what) {
  let o = {};
  try { o = JSON.parse(localStorage.getItem(BROWSE_SHOW_KEY)) || {}; } catch (e) { o = {}; }
  o[what] = !o[what];
  try { localStorage.setItem(BROWSE_SHOW_KEY, JSON.stringify(o)); } catch (e) { /* quota */ }
  invalidateBrowseCache(); renderBrowse();
}

const TREE_COLORS = [
  { id: '', name: 'None', css: 'transparent' },
  { id: 'red', name: 'Red', css: '#ef4444' },
  { id: 'orange', name: 'Orange', css: '#f97316' },
  { id: 'yellow', name: 'Yellow', css: '#eab308' },
  { id: 'green', name: 'Green', css: '#22c55e' },
  { id: 'blue', name: 'Blue', css: '#3b82f6' },
  { id: 'purple', name: 'Purple', css: '#a855f7' },
  { id: 'pink', name: 'Pink', css: '#ec4899' },
  { id: 'cyan', name: 'Cyan', css: '#06b6d4' }
];
function treeColorOf(id) { const c = TREE_COLORS.find(x => x.id === id); return c ? c.css : 'transparent'; }

function browseFindItem(id) {
  return (state.challenges || []).find(c => c.id === id) ||
         (state.codingSets || []).find(x => x.id === id) ||
         (state.nodes || []).find(n => n.id === id) || null;
}

/** A small swatch grid, opened from the row menu. */
function browseSetColor(id) {
  const it = browseFindItem(id);
  if (!it) return;
  const swatches = TREE_COLORS.map(function (c) {
    return '<button class="tree-color-swatch ' + ((it.color || '') === c.id ? 'active' : '') + '"' +
      ' title="' + c.name + '" style="background:' + (c.id ? c.css : 'var(--bg-surface-hover)') + '"' +
      ' onclick="browseApplyColor(\'' + id + '\',\'' + c.id + '\')">' + (c.id ? '' : '\u2715') + '</button>';
  }).join('');
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay fd-overlay';
  overlay.id = 'tree-color-dlg';
  overlay.innerHTML = '<div class="modal-content fd-box" role="dialog" aria-label="Highlight colour">' +
    '<h3 class="fd-title"><i data-lucide="palette"></i> Highlight colour</h3>' +
    '<div class="tree-color-grid">' + swatches + '</div>' +
    '<div class="fd-actions"><button class="btn btn-secondary btn-sm" onclick="document.getElementById(\'tree-color-dlg\').remove()">Close</button></div></div>';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: overlay });
}
window.browseApplyColor = function (id, color) {
  const it = browseFindItem(id);
  if (!it) return;
  if (color) it.color = color; else delete it.color;
  saveData();
  const dlg = document.getElementById('tree-color-dlg');
  if (dlg) dlg.remove();
  invalidateBrowseCache(); renderBrowse();
};

function browseToggleFavorite(id) {
  const it = browseFindItem(id);
  if (!it) return;
  it.favorite = !it.favorite;
  saveData();
  invalidateBrowseCache(); renderBrowse();
  if (typeof toast === 'function') toast(it.favorite ? 'Added to favourites.' : 'Removed from favourites.', { type: 'info' });
}

function browseSetLevel(id) {
  const it = browseFindItem(id);
  if (!it) return;
  showInputDialog('Set level', 'A number used for sorting and filtering.', 'Level',
    it.level != null ? String(it.level) : '', function (v) {
      const n = parseInt(v, 10);
      if (isNaN(n)) delete it.level; else it.level = n;
      saveData(); invalidateBrowseCache(); renderBrowse();
    });
}

function browseSetIcon(id) {
  const it = browseFindItem(id);
  if (!it) return;
  showInputDialog('Change icon', 'A Lucide icon name, for example "rocket".', 'Icon', it.icon || '', function (v) {
    const name = (v || '').trim();
    if (name) it.icon = name; else delete it.icon;
    saveData(); invalidateBrowseCache(); renderBrowse();
  });
}

function browseCollapseAll(collapse) {
  const folders = (state.nodes || []).filter(function (n) { return n.type === 'folder' && n.scope === 'challenge'; });
  state.expandedNodes = collapse ? [] : folders.map(function (f) { return f.id; }).concat('__root__');
  saveData();
  invalidateBrowseCache(); renderBrowse();
}

registerTreeHost('browse', {
  scope: 'challenge',
  container: '#browse-category-list',
  selectNs: 'browse',
  rerender: () => { invalidateBrowseCache(); renderBrowse(); },
  expand: (folderId) => {
    if (!state.expandedNodes) state.expandedNodes = [];
    if (!state.expandedNodes.includes(folderId)) {
      state.expandedNodes.push(folderId);
      renderBrowseTree();
    }
  },
  isExpanded: (id) => isNodeExpanded(id),
  toggle: (id) => toggleBrowseExpand(id, null),
  acceptsDrop: (targetId) => libRootAcceptsDrop('browse', targetId),
  onDropInto: (targetId, ids) => libRootDropInto('browse', targetId, ids,
    (id) => (state.challenges || []).find(c => c.id === id) || (state.codingSets || []).find(s => s.id === id)),
  /* One menu for everything. Folders used to open a separate legacy menu with a
     different look and different mechanics, and programs got a nearly empty
     shared one - the two did not even resemble each other. */
  onRename: (id, kind) => {
    if (kind === 'folder') { ctxTargetNodeId = id; ctxRenameFolder(); return; }
    const it = browseFindItem(id);
    if (!it) return;
    showInputDialog('Rename', null, 'Title', it.title || '', (v) => {
      const t = (v || '').trim();
      if (t) { it.title = t; saveData(); invalidateBrowseCache(); renderBrowse(); }
    });
  },
  onNewSubfolder: (id) => { ctxTargetNodeId = id; ctxNewFolder(); },
  extraActions: (id, kind) => {
    const it = browseFindItem(id);
    if (kind === 'folder') {
      return [
        { icon: 'image', label: 'Change icon...', fn: () => browseSetIcon(id) },
        { icon: 'palette', label: 'Highlight colour...', fn: () => browseSetColor(id) },
        { icon: 'award', label: 'Set tier...', fn: () => { ctxTargetNodeId = id; ctxOpenTierPicker(); } },
        { icon: 'lock', label: 'Set prerequisites...', fn: () => { ctxTargetNodeId = id; ctxOpenLockPicker(); } }
      ];
    }
    const fav = !!(it && it.favorite);
    return [
      { icon: 'play', label: 'Practice', fn: () => { if (typeof promptTimer === 'function') promptTimer(id); } },
      { icon: fav ? 'star-off' : 'star', label: fav ? 'Remove from favourites' : 'Add to favourites', fn: () => browseToggleFavorite(id) },
      { icon: 'palette', label: 'Highlight colour...', fn: () => browseSetColor(id) },
      { icon: 'image', label: 'Change icon...', fn: () => browseSetIcon(id) },
      { icon: 'hash', label: 'Set level...', fn: () => browseSetLevel(id) },
      { icon: 'git-compare', label: 'Compare with solution', fn: () => { if (typeof anOpenReview === 'function') anOpenReview(id); } }
    ];
  },
  // Right-click the empty pane: what the rows show, and new folders.
  paneActions: () => ([
    { icon: 'folder-plus', label: 'New root folder', fn: () => { ctxTargetNodeId = null; ctxNewFolder(); } },
    { sep: true },
    { icon: browseShow('level') ? 'check-square' : 'square', label: 'Show level badge', fn: () => browseToggleShow('level') },
    { icon: browseShow('tags') ? 'check-square' : 'square', label: 'Show topic badge', fn: () => browseToggleShow('tags') },
    { sep: true },
    { icon: 'chevrons-down-up', label: 'Collapse all folders', fn: () => browseCollapseAll(true) },
    { icon: 'chevrons-up-down', label: 'Expand all folders', fn: () => browseCollapseAll(false) }
  ]),
  // Moving between folders asks first; reordering inside one does not.
  confirmMove: true,
  onDelete: (id, kind) => {
    if (kind === 'folder') { ctxTargetNodeId = id; if (typeof ctxDeleteFolder === 'function') ctxDeleteFolder(); return; }
    if (typeof softDeleteChallenge === 'function') {
      softDeleteChallenge(id, () => { invalidateBrowseCache(); renderBrowse(); });
    }
  }
});

/* ============================================================
   INLINE FOLDER TITLE / DESC EDITING
   ============================================================ */

function browseEditFolderDesc(folderId) {
  const folder = state.nodes.find(n => n.id === folderId);
  if (!folder) return;
  const el = document.querySelector('.browse-folder-desc');
  if (!el || el.contentEditable === 'true') return;

  const original = folder.description || '';
  el.textContent = original;
  el.contentEditable = 'true';
  el.focus();
  // Place cursor at end
  const range = document.createRange();
  const sel = window.getSelection();
  range.selectNodeContents(el);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);

  function commit() {
    el.contentEditable = 'false';
    const newVal = el.textContent.trim();
    if (newVal !== folder.description) {
      folder.description = newVal;
      saveData();
    }
    if (!newVal) {
      el.innerHTML = '<span style="color:var(--text-tertiary);font-style:italic;">Click to add a description...</span>';
    }
    el.removeEventListener('blur', commit);
    el.removeEventListener('keydown', onKey);
  }

  function onKey(e) {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') {
      el.textContent = original;
      el.contentEditable = 'false';
      el.removeEventListener('blur', commit);
      el.removeEventListener('keydown', onKey);
    }
  }

  el.addEventListener('blur', commit);
  el.addEventListener('keydown', onKey);
}

function browseEditFolderTitle(folderId) {
  const folder = state.nodes.find(n => n.id === folderId);
  if (!folder) return;
  const el = document.querySelector('.browse-folder-title');
  if (!el || el.contentEditable === 'true') return;

  const original = folder.name || '';
  el.textContent = original;
  el.contentEditable = 'true';
  el.focus();
  const range = document.createRange();
  const sel = window.getSelection();
  range.selectNodeContents(el);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);

  function commit() {
    el.contentEditable = 'false';
    const newVal = el.textContent.trim();
    if (newVal && newVal !== folder.name) {
      folder.name = newVal;
      saveData();
      renderBrowse();
    } else if (!newVal) {
      el.textContent = original;
    }
    el.removeEventListener('blur', commit);
    el.removeEventListener('keydown', onKey);
  }

  function onKey(e) {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') {
      el.textContent = original;
      el.contentEditable = 'false';
      el.removeEventListener('blur', commit);
      el.removeEventListener('keydown', onKey);
    }
  }

  el.addEventListener('blur', commit);
  el.addEventListener('keydown', onKey);
}