/* ============================================================
   ADMIN-LIST.JS — Challenge List, Folder Tree, Lock Rules
   ============================================================ */

function toggleAdminSection(sectionId, e) {
  if (e) { e.stopPropagation(); e.preventDefault(); }
  const container = document.getElementById(sectionId);
  if (!container) return;
  const chevron = e.currentTarget.querySelector('.tree-node-chevron');
  if (container.classList.contains('collapsed')) {
    container.classList.remove('collapsed');
    if (chevron) chevron.classList.add('expanded');
  } else {
    container.classList.add('collapsed');
    if (chevron) chevron.classList.remove('expanded');
  }
}

/** Expand every folder group, or collapse them all if they're already open. */
function adminToggleAllGroups() {
  const groups = [...document.querySelectorAll('.admin-group')];
  if (!groups.length) return;
  const anyClosed = groups.some(d => !d.open);
  groups.forEach(d => { d.open = anyClosed; });
  _adminRememberGroups();
}

/** Remember which folder groups you closed in the admin list, across renders. */
function _adminRememberGroups() {
  const groups = [...document.querySelectorAll('.admin-group')];
  const closed = groups.filter(d => !d.open).map(d => d.dataset.group);
  try { localStorage.setItem('adminGroupsCollapsed', JSON.stringify(closed)); }
  catch (e) { /* quota — the groups still work for this session */ }
  const btn = document.getElementById('admin-groups-btn');
  if (btn) btn.textContent = closed.length === groups.length ? 'Expand all' : 'Collapse all';
}

function renderAdmin() {
  if (window.currentAdminMode === 'study') {
    if (currentAdminStudyTab === 'snippets') return renderStudyAdmin();
    return renderNotebookAdmin();
  }

  // Defensive: ensure filter is valid on initial load
  if (!adminCategoryFilter) adminCategoryFilter = 'All';

  updateAdminFilter();

  const programsPreview = document.getElementById('admin-table-body-preview');
  if (!programsPreview) return;

  // Filter challenges based on dropdown (now uses parentId) and search query
  let filteredChallenges = state.challenges;

  const searchInput = document.getElementById('admin-search-input');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  if (query) {
    filteredChallenges = filteredChallenges.filter(c => fuzzyMatch(c.title, query) || (c.tags || []).some(t => fuzzyMatch(t, query)));
  }
  if (adminCategoryFilter === '__uncategorized__') {
    filteredChallenges = filteredChallenges.filter(c => c.parentId === null || c.parentId === undefined);
  } else if (adminCategoryFilter !== 'All') {
    // Filter by folder and all descendant folders
    const folderIds = new Set();
    function collectIds(id) {
      folderIds.add(id);
      getChildFolders(id, 'challenge').forEach(cf => collectIds(cf.id));
    }
    collectIds(adminCategoryFilter);
    filteredChallenges = filteredChallenges.filter(c => folderIds.has(c.parentId));
  }

  // Build folder picker options for category dropdown on each item
  const folderPickerOptions = [];
  function buildPickerOpts(parentId, depth) {
    getChildFolders(parentId, 'challenge').forEach(f => {
      const indent = '  '.repeat(depth);
      folderPickerOptions.push({ id: f.id, label: indent + f.name });
      buildPickerOpts(f.id, depth + 1);
    });
  }
  buildPickerOpts(null, 0);

  // Render program list
  const renderPrograms = (list) => {
    if (list.length === 0) return '';
    return list.map(c => `
      <div class="admin-list-item${adminState && adminState.id === c.id ? ' active' : ''}"
        role="button" tabindex="0"
        onclick="document.querySelectorAll('.admin-list-item').forEach(el=>el.classList.remove('active'));this.classList.add('active');openAdminForm('${c.id}')"
        onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();document.querySelectorAll('.admin-list-item').forEach(el=>el.classList.remove('active'));this.classList.add('active');openAdminForm('${c.id}')}"
        aria-label="${escapeHTML(c.title)}">
        <div class="admin-list-item-left">
          <div class="admin-list-item-title">${escapeHTML(c.title)}</div>
          <div class="admin-list-item-meta">
            <span>${c.variants.length} version${c.variants.length !== 1 ? 's' : ''}</span>
            <span class="admin-list-item-dot" aria-hidden="true">·</span>
            <button onclick="event.stopPropagation(); openListItemFolderPicker('${c.id}', 'challenge', this)" class="ali-folder-btn" title="Move to folder" aria-label="Move to folder">
              <i data-lucide="folder" style="width:11px;height:11px;"></i>
              <span>${c.parentId ? escapeHTML((folderPickerOptions.find(f=>f.id===c.parentId)||{label:'Folder'}).label.trim()) : 'Uncategorized'}</span>
              <i data-lucide="chevron-down" style="width:10px;height:10px;opacity:0.6;"></i>
            </button>
          </div>
        </div>
        <div class="admin-list-item-actions">
          <button onclick="event.stopPropagation(); openAdminForm('${c.id}')" class="btn btn-ghost" title="Edit" aria-label="Edit ${escapeHTML(c.title)}">
            <i data-lucide="pencil" style="width:16px;height:16px;color:var(--color-primary);" aria-hidden="true"></i>
          </button>
          <button onclick="event.stopPropagation(); deleteChallenge('${c.id}')" class="btn btn-ghost" title="Delete" aria-label="Delete ${escapeHTML(c.title)}">
            <i data-lucide="trash-2" style="width:16px;height:16px;color:var(--color-danger);" aria-hidden="true"></i>
          </button>
        </div>
      </div>
    `).join('');
  };

  /**
   * The whole list, grouped by folder under collapsible headers.
   *
   * It used to show TWO programs and bury everything else behind a
   * "Show N more programs…" disclosure, so reaching the third program in a
   * 15-program library took a click and a scroll, and the only way to move
   * between folders was the filter dropdown at the top. Grouping the full list
   * makes the folder structure the navigation.
   */
  const renderGrouped = (list) => {
    const groups = new Map();
    list.forEach(c => {
      const key = c.parentId || '__root__';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(c);
    });
    // Folder order first (so the panel matches the Library), Uncategorized last.
    const ordered = [];
    const walk = (pid) => getChildFolders(pid, 'challenge').forEach(f => {
      if (groups.has(f.id)) ordered.push([f.id, f.name, groups.get(f.id)]);
      walk(f.id);
    });
    walk(null);
    if (groups.has('__root__')) ordered.push(['__root__', 'Uncategorized', groups.get('__root__')]);
    // Any folder that got filtered out of the walk (e.g. an orphan parentId)
    groups.forEach((items, key) => {
      if (!ordered.some(([k]) => k === key)) {
        const f = state.nodes.find(n => n.id === key);
        ordered.push([key, f ? f.name : 'Uncategorized', items]);
      }
    });

    const collapsed = JSON.parse(localStorage.getItem('adminGroupsCollapsed') || '[]');
    return ordered.map(([key, name, items]) => `
      <details class="admin-group"${collapsed.includes(key) ? '' : ' open'} data-group="${escapeHTML(key)}">
        <summary onclick="setTimeout(() => _adminRememberGroups(), 0)">
          <i data-lucide="chevron-right" class="admin-group-chev"></i>
          <i data-lucide="${key === '__root__' ? 'inbox' : 'folder'}" style="width:14px;height:14px;"></i>
          <span class="admin-group-name">${escapeHTML(name)}</span>
          <span class="admin-group-count">${items.length}</span>
        </summary>
        <div class="admin-group-body">${renderPrograms(items)}</div>
      </details>`).join('');
  };

  const programsRest = document.getElementById('admin-table-body-rest');
  const programsDropdown = document.getElementById('admin-programs-dropdown-wrapper');

  if (programsPreview) {
    programsPreview.innerHTML = filteredChallenges.length === 0
      ? '<div class="empty-state" style="padding:1rem;"><p>No programs found.</p></div>'
      : renderGrouped(filteredChallenges);
    // The old preview/rest split is gone — everything is in the grouped list.
    if (programsRest) programsRest.innerHTML = '';
    if (programsDropdown) programsDropdown.style.display = 'none';
    _adminRememberGroups();   // keeps the Expand/Collapse-all label honest
  }

  // Counts on the collapsed panel headers, so you can see what's inside them
  // without opening each one.
  const setCount = document.getElementById('admin-sets-count');
  if (setCount) setCount.textContent = (state.codingSets || []).length;
  const catCount = document.getElementById('admin-cats-count');
  const allChallengeFolders = state.nodes.filter(n => n.type === 'folder' && n.scope === 'challenge');
  if (catCount) catCount.textContent = allChallengeFolders.length;
  const lockCount = document.getElementById('admin-locks-count');
  if (lockCount) {
    const req = state.categoryRequirements || {};
    lockCount.textContent = Object.keys(req).filter(k => req[k]).length;
  }

  // Folder list (tree view with rename/delete)
  const catListPreview = document.getElementById('admin-category-list-preview');
  const catListRest = document.getElementById('admin-category-list-rest');
  const catRestCount = document.getElementById('admin-categories-rest-count');
  const catDropdown = document.getElementById('admin-categories-dropdown-wrapper');
  const catFallbackAdd = document.getElementById('admin-categories-fallback-add');
  
  if (catListPreview && catListRest) {
    const rootFolders = getChildFolders(null, 'challenge');
    if (rootFolders.length === 0) {
      catListPreview.innerHTML = '<p style="font-size:0.8rem; color:var(--text-tertiary); padding:0.5rem;">No folders. Add one below.</p>';
      catDropdown.style.display = 'none';
      if (catFallbackAdd) catFallbackAdd.style.display = 'flex';
    } else {
      catListPreview.innerHTML = renderAdminFolderList(rootFolders.slice(0, 2), 'challenge', 0);
      if (rootFolders.length > 2) {
        catListRest.innerHTML = renderAdminFolderList(rootFolders.slice(2), 'challenge', 0);
        catRestCount.textContent = rootFolders.length - 2;
        catDropdown.style.display = 'block';
        if (catFallbackAdd) catFallbackAdd.style.display = 'none';
      } else {
        catDropdown.style.display = 'none';
        if (catFallbackAdd) catFallbackAdd.style.display = 'flex';
      }
    }
  }

  // Render Unlock Rules as collapsible tree
  const locksPreview = document.getElementById('admin-lock-rules-preview');
  const locksRest = document.getElementById('admin-lock-rules-rest');
  const locksRestCount = document.getElementById('admin-locks-rest-count');
  const locksDropdown = document.getElementById('admin-locks-dropdown-wrapper');
  
  if (locksPreview && locksRest) {
    const challengeFolders = state.nodes.filter(n => n.type === 'folder' && n.scope === 'challenge');
    const rootLockFolders = challengeFolders.filter(f => !f.parentId);
    
    if (rootLockFolders.length === 0) {
      locksPreview.innerHTML = '<p style="font-size:0.8rem; color:var(--text-tertiary); padding:0.5rem;">No categories available to lock.</p>';
      locksDropdown.style.display = 'none';
    } else {
      locksPreview.innerHTML = renderLockRulesList(rootLockFolders.slice(0, 2), 0, challengeFolders);
      if (rootLockFolders.length > 2) {
        locksRest.innerHTML = renderLockRulesList(rootLockFolders.slice(2), 0, challengeFolders);
        locksRestCount.textContent = rootLockFolders.length - 2;
        locksDropdown.style.display = 'block';
      } else {
        locksDropdown.style.display = 'none';
      }
    }
  }

  lucide.createIcons();
}

function renderLockRulesTree(parentId, depth, allFolders) {
  const folders = allFolders.filter(f => (f.parentId || null) === (parentId || null));
  return renderLockRulesList(folders, depth, allFolders);
}

function renderLockRulesList(folders, depth, allFolders) {
  if (folders.length === 0) return '';

  let html = '';
  folders.forEach(folder => {
    const req = state.categoryRequirements[folder.id] || { requiredChallengeIds: [] };
    // Backward compat: convert old format
    const reqIds = req.requiredChallengeIds || [];
    const isLocked = reqIds.length > 0;
    const indent = depth * 1;
    const hasChildren = allFolders.some(f => f.parentId === folder.id);
    const expanded = isNodeExpanded(folder.id);
    const chevronClass = hasChildren ? (expanded ? 'expanded' : '') : 'invisible';

    // Build the list of prerequisite challenge names
    let prereqList = '';
    if (isLocked) {
      prereqList = reqIds.map(cId => {
        const c = state.challenges.find(ch => ch.id === cId);
        return c ? `<span class="badge badge-warning" style="font-size:0.6rem; margin:0.125rem;">${escapeHTML(c.title)}</span>` : '';
      }).filter(Boolean).join('');
    }

    html += `
      <div style="margin-bottom: 0.25rem;">
        <div class="category-item" style="flex-direction: column; align-items: stretch; gap: 0.75rem; padding: 0.875rem; padding-left: calc(0.875rem + ${indent}rem);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display:flex; align-items:center; gap:0.375rem;">
              <i data-lucide="chevron-right" class="tree-node-chevron ${chevronClass}" style="width:14px;height:14px;" onclick="toggleAdminCatExpand('${folder.id}', 'challenge')"></i>
              <i data-lucide="${isLocked ? 'lock' : 'unlock'}" style="width:16px;height:16px;color:var(${isLocked ? '--color-warning' : '--text-tertiary'});"></i>
              <span style="font-weight:600; font-size:0.95rem;">${escapeHTML(folder.name)}</span>
              ${getTierBadgeHTML(folder.tier)}
            </div>
            <div style="display:flex; align-items:center; gap:0.5rem;">
              ${isLocked ? `<span class="badge badge-warning" style="font-size:0.6rem;">LOCKED (${reqIds.length})</span>` : `<span class="badge badge-neutral" style="font-size:0.6rem;">UNLOCKED</span>`}
              <button onclick="openPrereqPicker('${folder.id}')" class="btn btn-ghost btn-sm" style="padding:0.25rem 0.5rem; font-size:0.75rem; color:var(--color-warning); font-weight:600;" title="Set Prerequisites">
                <i data-lucide="shield" style="width:14px;height:14px;"></i> Edit
              </button>
            </div>
          </div>
          ${isLocked ? `<div style="display:flex; flex-wrap:wrap; gap:0.25rem; padding:0.375rem 0.5rem; background:rgba(245,158,11,0.05); border-radius:var(--radius-sm); border:1px solid rgba(245,158,11,0.15);">
            <span style="font-size:0.6875rem; color:var(--text-tertiary); font-weight:600; margin-right:0.25rem;">Requires:</span>
            ${prereqList}
          </div>` : ''}
        </div>
        <div class="tree-children ${expanded ? '' : 'collapsed'}" style="margin-left: ${indent + 1}rem; border-left: 1px solid var(--border-color);">
          <div class="tree-children-inner">
            ${renderLockRulesTree(folder.id, depth + 1, allFolders)}
          </div>
        </div>
      </div>
    `;
  });

  return html;
}

function addCategory() {
  const input = document.getElementById('new-category-input');
  const val = input.value.trim();
  if (val) {
    createNode(val, 'folder', null, 'challenge');
    input.value = '';
    renderAdmin();
  }
}

function removeCategory(nodeId) {
  const folder = state.nodes.find(n => n.id === nodeId);
  if (!folder) return;
  showConfirm("Delete Folder", `Are you sure? Items in "${escapeHTML(folder.name)}" will become uncategorized.`, () => {
    deleteNode(nodeId);
    renderAdmin();
  });
}

/* ============================================================
   LIST ITEM FOLDER PICKER — popup with search, keyboard nav, blur backdrop
   ============================================================ */
let _aliFolderPickerCleanup = null;

function openListItemFolderPicker(itemId, scope, triggerBtn) {
  // Remove any existing popup
  const existing = document.getElementById('ali-folder-popup');
  if (existing) existing.remove();
  if (_aliFolderPickerCleanup) { _aliFolderPickerCleanup(); _aliFolderPickerCleanup = null; }

  // Build options
  const opts = [{ value: '__none__', label: 'Uncategorized', icon: 'inbox' }];
  function buildOpts(pid, d) {
    getChildFolders(pid, scope).forEach(f => {
      opts.push({ value: f.id, label: '  '.repeat(d) + f.name, icon: 'folder', depth: d });
      buildOpts(f.id, d + 1);
    });
  }
  buildOpts(null, 0);

  // Detect current selection for highlighting
  let currentParentId = null;
  if (scope === 'challenge') currentParentId = (state.challenges.find(c => c.id === itemId) || {}).parentId || null;
  else if (scope === 'snippet') currentParentId = ((state.snippets || []).find(s => s.id === itemId) || {}).parentId || null;
  else if (scope === 'notebook') currentParentId = ((state.notebooks || []).find(n => n.id === itemId) || {}).parentId || null;

  const showSearch = opts.length > 7;

  const popup = document.createElement('div');
  popup.id = 'ali-folder-popup';
  popup.className = 'ali-folder-popup';
  popup.setAttribute('role', 'listbox');
  popup.innerHTML = `
    ${showSearch ? `
      <div class="ali-fp-search-wrap">
        <i data-lucide="search" style="width:13px;height:13px;color:var(--text-tertiary);flex-shrink:0;"></i>
        <input class="ali-fp-search" type="text" placeholder="Search folders..." aria-label="Search folders" />
      </div>
    ` : ''}
    <div class="ali-fp-list" id="ali-fp-list">
      ${renderRows(opts, currentParentId)}
    </div>
  `;

  function renderRows(items, sel) {
    if (items.length === 0) return '<div class="ali-fp-empty">No matches</div>';
    return items.map(o => {
      const isCurrent = (o.value === '__none__' && sel === null) || o.value === sel;
      const indent = (o.depth || 0) * 0.65;
      return `<div class="ali-fp-opt${isCurrent ? ' ali-fp-current' : ''}" data-value="${escapeHTML(o.value)}" role="option" aria-selected="${isCurrent ? 'true' : 'false'}" style="padding-left:${0.75 + indent}rem;">
        <i data-lucide="${o.icon}" style="width:13px;height:13px;color:var(--text-tertiary);flex-shrink:0;"></i>
        <span class="ali-fp-opt-label">${escapeHTML(o.label.trim())}</span>
        ${isCurrent ? '<i data-lucide="check" style="width:13px;height:13px;color:var(--color-primary);margin-left:auto;"></i>' : ''}
      </div>`;
    }).join('');
  }

  document.body.appendChild(popup);
  if (typeof lucide !== 'undefined') lucide.createIcons({ el: popup });

  // Position-aware (flip up if no space below)
  const rect = triggerBtn.getBoundingClientRect();
  const popH = Math.min(280, opts.length * 32 + (showSearch ? 44 : 0) + 8);
  const spaceBelow = window.innerHeight - rect.bottom;
  if (spaceBelow < popH && rect.top > popH) {
    popup.style.top = (rect.top - popH - 4) + 'px';
  } else {
    popup.style.top = (rect.bottom + 4) + 'px';
  }
  const leftPos = Math.max(8, Math.min(rect.left, window.innerWidth - 240 - 8));
  popup.style.left = leftPos + 'px';

  // Blur backdrop
  const backdrop = document.createElement('div');
  backdrop.id = 'ali-folder-backdrop';
  backdrop.className = 'ali-folder-backdrop';
  document.body.insertBefore(backdrop, popup);

  const searchEl = popup.querySelector('.ali-fp-search');
  const listEl = popup.querySelector('#ali-fp-list');
  let activeIdx = -1;
  let visibleOpts = opts.slice();

  function refresh() {
    const q = (searchEl ? searchEl.value : '').trim().toLowerCase();
    visibleOpts = q ? opts.filter(o => o.label.toLowerCase().includes(q)) : opts.slice();
    listEl.innerHTML = renderRows(visibleOpts, currentParentId);
    if (typeof lucide !== 'undefined') lucide.createIcons({ el: listEl });
    bindRows();
    // Highlight first or matching current
    const selIdx = visibleOpts.findIndex(o => (o.value === '__none__' && currentParentId === null) || o.value === currentParentId);
    activeIdx = selIdx >= 0 ? selIdx : 0;
    updateHover();
  }

  function bindRows() {
    listEl.querySelectorAll('.ali-fp-opt').forEach((opt, i) => {
      opt.addEventListener('mouseenter', () => { activeIdx = i; updateHover(); });
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        commit(opt.dataset.value);
      });
    });
  }

  function updateHover() {
    listEl.querySelectorAll('.ali-fp-opt').forEach((opt, i) => {
      opt.classList.toggle('ali-fp-hover', i === activeIdx);
    });
    const target = listEl.children[activeIdx];
    if (target) {
      const tRect = target.getBoundingClientRect();
      const lRect = listEl.getBoundingClientRect();
      if (tRect.top < lRect.top) listEl.scrollTop -= (lRect.top - tRect.top);
      else if (tRect.bottom > lRect.bottom) listEl.scrollTop += (tRect.bottom - lRect.bottom);
    }
  }

  function commit(val) {
    const newParent = val === '__none__' ? null : val;
    moveItemToFolder(itemId, scope, newParent);
    cleanup();
    renderAdmin();
  }

  function cleanup() {
    popup.remove();
    backdrop.remove();
    document.removeEventListener('keydown', keyHandler, true);
    _aliFolderPickerCleanup = null;
  }
  _aliFolderPickerCleanup = cleanup;

  backdrop.addEventListener('click', cleanup);

  function keyHandler(e) {
    if (!document.body.contains(popup)) return;
    if (e.key === 'Escape') { e.preventDefault(); cleanup(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); activeIdx = Math.min(visibleOpts.length - 1, activeIdx + 1); updateHover(); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx = Math.max(0, activeIdx - 1); updateHover(); return; }
    if (e.key === 'Home') { e.preventDefault(); activeIdx = 0; updateHover(); return; }
    if (e.key === 'End') { e.preventDefault(); activeIdx = visibleOpts.length - 1; updateHover(); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && visibleOpts[activeIdx]) commit(visibleOpts[activeIdx].value);
    }
  }
  document.addEventListener('keydown', keyHandler, true);

  if (searchEl) {
    searchEl.addEventListener('input', refresh);
    setTimeout(() => searchEl.focus(), 30);
  }

  bindRows();
  // Highlight currently-selected as starting point
  const initIdx = visibleOpts.findIndex(o => (o.value === '__none__' && currentParentId === null) || o.value === currentParentId);
  activeIdx = initIdx >= 0 ? initIdx : 0;
  updateHover();
}
