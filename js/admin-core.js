/* ============================================================
   ADMIN-CORE.JS — Core Admin Panel State & Tree Rendering
   ============================================================ */

window.currentAdminMode = window.currentAdminMode || 'practice';
let adminCategoryFilter = 'All';
let currentAdminStudyTab = 'notes'; // 'snippets' or 'notes'

window.adminIsDirty = false;
window.saveCurrentAdminForm = null;

function isAdminFormOpen() {
  const forms = ['admin-form-container', 'study-form-container', 'notebook-form-container'];
  return forms.some(id => {
    const el = document.getElementById(id);
    return el && !el.classList.contains('hidden');
  });
}

function bindAdminFormListeners() {
  // Note: was previously bound only once at DOMContentLoaded — but admin route templates
  // are inserted lazily, so containers don't exist at DOMContentLoaded. Call this from
  // adminInit() to ensure listeners attach after the route has rendered.
  const adminContainers = [
    {
      id: 'admin-form-container',
      stateCheck: () => typeof adminState !== 'undefined' && adminState !== null,
      statusEl: 'admin-save-status'
    },
    {
      id: 'study-form-container',
      stateCheck: () => typeof studyModeState !== 'undefined' && studyModeState !== null,
      statusEl: 'study-save-status'
    },
    {
      id: 'notebook-form-container',
      stateCheck: () => typeof notebookAdminState !== 'undefined' && notebookAdminState !== null,
      statusEl: 'notebook-save-status'
    }
  ];
  adminContainers.forEach(c => {
    const el = document.getElementById(c.id);
    if (!el) return;
    if (el.__adminListenersBound) return;
    el.__adminListenersBound = true;
    const setDirty = () => {
      if (c.stateCheck()) {
        window.adminIsDirty = true;
        if (typeof setSaveStatus === 'function') setSaveStatus(c.statusEl, 'unsaved');
      }
    };
    el.addEventListener('input', setDirty);
  });
}

function updateAdminFilter() {
  const filterContainer = document.getElementById('admin-filter-container');
  if (!filterContainer) return;

  let scope = 'challenge';
  if (window.currentAdminMode === 'study') {
    scope = (currentAdminStudyTab === 'snippets') ? 'snippet' : 'notebook';
  }

  // Build folder options from tree
  const folderOptions = [];
  function buildOptions(parentId, depth) {
    const folders = getChildFolders(parentId, scope);
    folders.forEach(f => {
      const indent = '\u00A0\u00A0'.repeat(depth);
      folderOptions.push({ id: f.id, label: indent + f.name });
      buildOptions(f.id, depth + 1);
    });
  }
  buildOptions(null, 0);

  // Ensure current filter is valid
  if (adminCategoryFilter !== 'All' && adminCategoryFilter !== '__uncategorized__' && !folderOptions.some(f => f.id === adminCategoryFilter)) {
    adminCategoryFilter = 'All';
  }

  filterContainer.innerHTML = `
    <div class="admin-filter-wrap">
      <i data-lucide="filter" class="admin-filter-icon"></i>
      <span class="admin-filter-label">Filter</span>
      <div id="admin-filter-cs" class="admin-filter-cs"></div>
    </div>
  `;
  if (typeof lucide !== 'undefined') lucide.createIcons({ el: filterContainer });

  if (typeof renderCustomSelect === 'function') {
    const opts = [
      { value: 'All', label: 'All Folders', icon: 'folders' },
      { value: '__uncategorized__', label: 'Uncategorized', icon: 'inbox' }
    ].concat(folderOptions.map(f => ({ value: f.id, label: f.label.trim(), icon: 'folder' })));
    renderCustomSelect('admin-filter-cs', opts, adminCategoryFilter, (val) => {
      adminCategoryFilter = val;
      renderAdmin();
    }, 'All Folders');
  }
}

/** Keep the right-pane empty-state copy in sync with the active mode/tab. */
function updateAdminEmptyStateText() {
  const sub = document.querySelector('.admin-empty-subtitle');
  if (!sub) return;
  let noun = 'program';
  if (window.currentAdminMode === 'study') {
    noun = currentAdminStudyTab === 'snippets' ? 'snippet' : 'notebook';
  }
  sub.textContent = `Choose a ${noun} from the left panel, or create a new one.`;
}

function openNewAdminItem() {
  if (window.currentAdminMode === 'practice') {
    openAdminForm('new');
  } else if (window.currentAdminMode === 'study') {
    if (currentAdminStudyTab === 'snippets') {
      openStudyForm('new');
    } else {
      openNotebookForm('new');
    }
  }
}

// ============================================================
// COLLAPSIBLE ADMIN FOLDER TREE
// ============================================================
function renderAdminFolderTree(parentId, scope, depth) {
  const folders = getChildFolders(parentId, scope);
  return renderAdminFolderList(folders, scope, depth);
}

function renderAdminFolderList(folders, scope, depth) {
  let html = '';

  folders.forEach(folder => {
    const isEditing = window.editingCategory && window.editingCategory.nodeId === folder.id;
    const indent = depth * 0.75;
    const childCount = countItemsRecursive(folder.id, scope);
    const hasChildren = getChildFolders(folder.id, scope).length > 0;
    const expanded = isNodeExpanded(folder.id);
    const chevronClass = hasChildren ? (expanded ? 'expanded' : '') : 'invisible';

    // TIER_LEVELS and getTierBadgeHTML are now globally accessed from utils.js
    const tierBadge = getTierBadgeHTML(folder.tier);

    // Tier select options
    const tierOptions = TIER_LEVELS.map(t =>
      `<option value="${t.value}" ${(folder.tier || '') === t.value ? 'selected' : ''}>${t.value ? t.label + '-Tier' : '— None —'}</option>`
    ).join('');

    html += `
      <li class="category-item" style="flex-direction: column; align-items: stretch; padding: 0; border: none; background: none; margin-bottom: 0;">
        <div style="display: flex; align-items: center; background: var(--bg-surface); padding: 0.5rem 0.75rem; padding-left: calc(0.75rem + ${indent}rem); border: 1px solid var(--border-color); border-radius: var(--radius-md);">
          <i data-lucide="chevron-right" class="tree-node-chevron ${chevronClass}" style="margin-right: 0.25rem;" onclick="toggleAdminCatExpand('${folder.id}', '${scope}')"></i>
          ${isEditing ? `
            <div style="display:flex; gap:0.5rem; flex:1; align-items:center;">
              <input id="rename-input-${folder.id}" type="text" class="form-input" value="${escapeHTML(folder.name)}" style="flex:1; padding:0.25rem 0.5rem;" onkeydown="if(event.key==='Enter') adminSaveFolderRename('${folder.id}', this.value)" />
              <button onclick="adminSaveFolderRename('${folder.id}', document.getElementById('rename-input-${folder.id}').value)" class="btn btn-ghost" style="padding:0.25rem;" title="Save">
                <i data-lucide="check" style="width:16px;height:16px;color:var(--color-success);"></i>
              </button>
              <button onclick="window.editingCategory = null; renderAdmin();" class="btn btn-ghost" style="padding:0.25rem;" title="Cancel">
                <i data-lucide="x" style="width:16px;height:16px;color:var(--text-tertiary);"></i>
              </button>
            </div>
          ` : `
            <div style="display: flex; align-items: center; gap: 0.5rem; flex:1; min-width:0;">
              <i data-lucide="folder" style="width:16px;height:16px;color:var(--color-accent);flex-shrink:0;"></i>
              <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHTML(folder.name)}</span>
              ${tierBadge}
              <select class="tier-select" aria-label="Tier for ${escapeHTML(folder.name)}" title="Difficulty tier"
                      onclick="event.stopPropagation()" onchange="updateFolderTier('${folder.id}', this.value)">
                ${tierOptions}
              </select>
              <span style="font-size:0.65rem; color:var(--text-tertiary);">${childCount}</span>
            </div>
            <div style="display:flex; gap:0.25rem;">
              <button onclick="window.editingCategory = {nodeId: '${folder.id}'}; renderAdmin();" class="btn btn-ghost" style="padding:0.25rem;" title="Rename">
                <i data-lucide="pencil" style="width:16px;height:16px;color:var(--text-secondary);"></i>
              </button>
              <button onclick="removeCategory('${folder.id}')" class="btn btn-ghost" style="padding:0.25rem;" title="Remove">
                <i data-lucide="x" style="width:16px;height:16px;color:var(--color-danger);"></i>
              </button>
            </div>
          `}
        </div>
        ${!isEditing ? `
          <div style="padding-left: calc(1.5rem + ${indent}rem); margin-top: 0.125rem;">
            <textarea class="admin-cat-desc" rows="1" placeholder="Category description (shown on browse page)..." oninput="updateFolderDescription('${folder.id}', this.value)">${escapeHTML(folder.description || '')}</textarea>
          </div>
        ` : ''}
        <div class="tree-children ${expanded ? '' : 'collapsed'}" style="margin-left: 0; border-left: none;">
          <div class="tree-children-inner">
            <ul style="list-style:none; padding-left:0; margin:0;">
              ${renderAdminFolderTree(folder.id, scope, depth + 1)}
            </ul>
          </div>
        </div>
      </li>
    `;
  });

  return html;
}

function toggleAdminCatExpand(nodeId, scope) {
  toggleNodeExpanded(nodeId);
  renderAdmin();
}

function updateFolderTier(nodeId, tier) {
  const node = state.nodes.find(n => n.id === nodeId);
  if (node) {
    node.tier = tier || null;
    saveData();
    renderAdmin();
  }
}

function updateFolderDescription(nodeId, desc) {
  const node = state.nodes.find(n => n.id === nodeId);
  if (node) {
    node.description = desc;
    saveData();
  }
}

function adminSaveFolderRename(nodeId, newName) {
  if (!newName || !newName.trim()) {
    window.editingCategory = null;
    renderAdmin();
    return;
  }
  renameNode(nodeId, newName.trim());
  window.editingCategory = null;
  renderAdmin();
}

function toggleAdminMode(mode) {
  if (window.adminIsDirty && isAdminFormOpen()) {
    showUnsavedConfirm(
      () => { window.adminIsDirty = false; toggleAdminMode(mode); },
      () => {
        if (window.saveCurrentAdminForm) {
          const success = window.saveCurrentAdminForm({ silent: true });
          if (success === false) return; // validation failed
        }
        window.adminIsDirty = false; toggleAdminMode(mode);
      }
    );
    return;
  }

  window.currentAdminMode = mode;
  document.getElementById('admin-toggles').dataset.active = mode;
  const studyBtn = document.getElementById('toggle-study');
  const practiceBtn = document.getElementById('toggle-practice');
  if (studyBtn) studyBtn.setAttribute('aria-pressed', String(mode !== 'practice'));
  if (practiceBtn) practiceBtn.setAttribute('aria-pressed', String(mode === 'practice'));
  document.getElementById('admin-practice-wrapper').classList.toggle('hidden', mode !== 'practice');
  document.getElementById('admin-study-wrapper').classList.toggle('hidden', mode !== 'study');

  // Update create button text based on mode + sub-tab
  const btnText = document.getElementById('new-btn-text');
  if (btnText) {
    if (mode === 'practice') {
      btnText.innerText = 'Create New Program';
    } else if (currentAdminStudyTab === 'notes') {
      btnText.innerText = 'Create New Notebook';
    } else {
      btnText.innerText = 'Create New Snippet';
    }
  }

  // Ensure 2nd Window reverts to Empty State on tab switch
  if (typeof closeAdminForm === 'function') closeAdminForm();
  if (typeof closeStudyForm === 'function') closeStudyForm();
  if (typeof closeNotebookForm === 'function') closeNotebookForm();

  adminCategoryFilter = 'All';
  updateAdminFilter();
  updateAdminEmptyStateText();

  renderAdmin();
}