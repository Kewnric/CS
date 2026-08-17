/* ============================================================
   VIZ-UI.JS — Context Menus, Popups, Panels & UI Interactions
   ============================================================ */

/* --- Pane Swap --- */
function vizSwapPanes() {
  const workspace = document.querySelector('.viz-workspace');
  if (!workspace) return;

  viz.panesSwapped = !viz.panesSwapped;

  // Brief swapping class triggers the fade-scale-out transition
  workspace.classList.add('swapping');
  setTimeout(() => {
    workspace.classList.toggle('panes-swapped', viz.panesSwapped);
    workspace.classList.remove('swapping');
  }, 180);
  vizSave();
}

/* --- Collapsible Module Tabs --- */
function vizToggleModuleTabs() {
  viz.tabsCollapsed = !viz.tabsCollapsed;
  const tabs = document.getElementById('viz-module-tabs');
  const btn = document.getElementById('viz-tabs-toggle-btn');
  if (tabs) tabs.classList.toggle('collapsed', viz.tabsCollapsed);
  if (btn) btn.classList.toggle('collapsed', viz.tabsCollapsed);
  vizSave();
}

/* --- Collapsible Canvas Toolbar --- */
function vizToggleCanvasToolbar() {
  viz.toolbarCollapsed = !viz.toolbarCollapsed;
  const toolbar = document.getElementById('viz-canvas-toolbar');
  const wrap = document.getElementById('viz-canvas-toolbar-wrap');
  const btn = document.getElementById('viz-toolbar-collapse-btn');
  if (toolbar) toolbar.classList.toggle('collapsed', viz.toolbarCollapsed);
  if (wrap) wrap.classList.toggle('toolbar-collapsed', viz.toolbarCollapsed);
  if (btn) btn.title = viz.toolbarCollapsed ? 'Show toolbar' : 'Hide toolbar';
  vizSave();
}

/* --- Restore UI state after init --- */
function vizRestoreUiState() {
  if (viz.panesSwapped) {
    const workspace = document.querySelector('.viz-workspace');
    if (workspace) workspace.classList.add('panes-swapped');
  }
  if (viz.tabsCollapsed) {
    const tabs = document.getElementById('viz-module-tabs');
    const btn = document.getElementById('viz-tabs-toggle-btn');
    if (tabs) tabs.classList.add('collapsed');
    if (btn) btn.classList.add('collapsed');
  }
  if (viz.toolbarCollapsed) {
    const toolbar = document.getElementById('viz-canvas-toolbar');
    const wrap = document.getElementById('viz-canvas-toolbar-wrap');
    const btn = document.getElementById('viz-toolbar-collapse-btn');
    if (toolbar) toolbar.classList.add('collapsed');
    if (wrap) wrap.classList.add('toolbar-collapsed');
    if (btn) btn.title = 'Show toolbar';
  }
}

function vizSwitchModule(mod) {
  viz._undoStack = [];
  brain._undoStack = [];
  const btn = document.getElementById('viz-undo-btn');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; }
  
  const leavingBrain = viz.activeModule === 'brain' && mod !== 'brain';
  if (leavingBrain) {
    brainSaveCurrentVersion();
    // Fully reset brain link mode: clear state, hint, and container class
    if (brain.linkModeEnabled || brain.linkingFrom) {
      brain.linkingFrom = null;
      brain.linkModeEnabled = false;
      const hint = document.getElementById('viz-linking-hint');
      if (hint) hint.classList.add('hidden');
    }
    // Reset container classes that brain may have set
    const container = document.getElementById('viz-canvas-container');
    if (container) container.classList.remove('linking-mode', 'color-paint-mode');
  }

  viz.folderStatePerModule[viz.activeModule] = viz.selectedFolderId;
  viz.activeModule = mod;
  viz.selectedFolderId = viz.folderStatePerModule[mod] || null;
  viz.selectedNodeId = null;

  // Turn off viz-side link mode if active (only relevant for non-brain modules)
  if (viz.linkModeEnabled) vizToggleLinkMode();

  // Turn off color paint mode when switching modules
  if (viz.colorModeEnabled) {
    viz.colorModeEnabled = false;
    const colorBtn = document.getElementById('viz-color-toggle-btn');
    if (colorBtn) { colorBtn.classList.remove('is-active'); colorBtn.style.color = ''; colorBtn.style.borderColor = ''; }
    const colorPopup = document.getElementById('viz-color-mode-popup');
    if (colorPopup) colorPopup.classList.add('hidden');
  }

  document.querySelectorAll('.viz-module-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.module === mod);
  });

  // Always reset link button visual to off when switching
  const linkBtn = document.getElementById('viz-link-toggle-btn');
  if (linkBtn) { linkBtn.classList.remove('is-active'); linkBtn.style.color = ''; linkBtn.style.borderColor = ''; }

  // Fog is main-canvas-only (brain has no fog-of-war); globe and flow work in all modes
  const fogBtn = document.getElementById('viz-fog-toggle-btn');
  if (fogBtn) fogBtn.style.display = mod === 'brain' ? 'none' : '';

  // The search box is per-pane; carrying a query across modules left a list
  // filtered by a word that was no longer written anywhere.
  viz.paneQuery = '';
  const searchInput = document.getElementById('viz-search-input');
  if (searchInput) searchInput.value = '';
  viz.searchQuery = '';
  viz.highlightedNodeIds = new Set();

  if (mod === 'brain') {
    initBrain();
  } else {
    // Reset toolbar label when leaving brain module
    const labelEl = document.getElementById('viz-canvas-toolbar-label');
    const labelMap = { challenge: 'Programs Canvas', snippet: 'Snippets Canvas', notebook: 'Notebooks Canvas', general: 'General Canvas' };
    if (labelEl) labelEl.textContent = labelMap[mod] || 'Mindmap Canvas';
    // Fill this library's own canvas on first visit. General is the union view,
    // so it shows whatever the others have placed and never drags all three
    // libraries on by itself — that was 80 nodes at 32% zoom.
    if (mod !== 'general') vizAutoPopulate([mod]);
    vizSyncDepthBtn();
    vizRenderContentPane();
    vizRenderCanvas();
    setTimeout(() => vizCenterCanvas(), 50);
  }
}

function vizRenderContentPane() {
  vizSyncModuleTools();
  if (viz.activeModule === 'brain') { brainRenderSidebar(); return; }
  const body = document.getElementById('viz-content-body');
  const titleEl = document.getElementById('viz-content-scope-label');
  const breadcrumbEl = document.getElementById('viz-content-breadcrumb');
  if (!body) return;

  vizUpdateHeaderStats();
  if (breadcrumbEl) {
    breadcrumbEl.innerHTML = `<span class="viz-breadcrumb-item" style="cursor:default;color:var(--text-primary)">${viz.activeModule === 'general' ? 'All libraries' : 'Root'}</span>`;
  }

  if (viz.activeModule === 'general') { vizRenderGeneralTree(body); return; }

  const scope = viz.activeModule;
  const query = (viz.paneQuery || '').trim().toLowerCase();
  // The pane's search box sat above a list it had no effect on — it only
  // highlighted canvas nodes.
  const rowMatches = (o) => !query || String(o.title || o.name || '').toLowerCase().includes(query);
  const folderMatches = (fid, sc) => {
    if (!query) return true;
    const kids = treeChildren(fid, sc);
    return kids.some(k => k.kind === 'folder' ? folderMatches(k.node.id, sc) : rowMatches(k.node));
  };
  const iconMap = { challenge: 'code', snippet: 'file-text', notebook: 'book' };

  function renderVizTree(parentId, depth) {
    let html = '';
    const indent = depth * 0.75;
    // One display order for folders and items (see treeChildren), so a row
    // dragged above a folder is actually drawn above it.
    const kids = treeChildren(parentId, scope);
    const folders = kids.filter(k => k.kind === 'folder').map(k => k.node);
    const items = kids.filter(k => k.kind !== 'folder').map(k => k.node);

    folders.forEach(f => {
      const isExpanded = viz.expandedFolderIds.has(f.id);
      const count = typeof countItemsRecursive === 'function' ? countItemsRecursive(f.id, scope) : 0;
      const hasChildren = state.nodes.some(n => n.type === 'folder' && n.scope === scope && n.parentId === f.id) ||
        (typeof getItemsForScope === 'function' ? getItemsForScope(scope) : []).some(it => it.parentId === f.id);
      const isActive = viz.selectedFolderId === f.id;
      const chevronClass = hasChildren ? (isExpanded || query ? 'expanded' : '') : 'invisible';
      if (query && !folderMatches(f.id, scope)) return;

      html += `<div class="tree-node" data-level="${depth}" data-node-id="${f.id}">
        <div class="tree-node-row ${isActive ? 'active' : ''}" data-node-id="${f.id}"
             style="padding-left: calc(0.75rem + 0rem)"
             ${treeRowAttrs({ ns: 'viz', id: f.id, kind: 'folder', level: depth, expanded: isExpanded, selected: isActive, dragStart: `vizTreeDragStart(event,'${f.id}','folder')` })}
             onclick="vizContentClickFolder('${f.id}')"
             oncontextmenu="vizContentCtx(event,'${f.id}','folder')">
          <i data-lucide="chevron-right" class="tree-node-chevron ${chevronClass}"
             onclick="event.stopPropagation();vizContentToggleFolder('${f.id}')"></i>
          <i data-lucide="${f.icon || 'folder'}" class="tree-node-icon folder-icon-color" style="width:14px;height:14px;"></i>
          <span class="tree-node-label">${escapeHTML(f.name)}</span>
          <span class="tree-node-badge">${count}</span>
        </div>
        <div class="tree-children ${isExpanded || query ? '' : 'collapsed'}">
          <div class="tree-children-inner">
            ${renderVizTree(f.id, depth + 1)}
          </div>
        </div>
      </div>`;
    });

    // At the top level the loose items live under the pseudo-folder below, the
    // same as every library tree — listing them inline here as well would show
    // each of them twice.
    (depth === 0 ? [] : items).filter(rowMatches).forEach(it => {
      const title = it.title || it.name || 'Untitled';
      const icon = it.icon || iconMap[scope] || 'file';
      const isActive = viz.selectedNodeId && viz.nodes.find(n => n.id === viz.selectedNodeId)?.dataId === it.id;
      html += `<div class="tree-node tree-item-node" data-level="${depth + 1}" data-node-id="${it.id}">
        <div class="tree-node-row ${isActive ? 'active' : ''}" data-node-id="${it.id}"
             style="padding-left: calc(0.75rem + ${TREE_ITEM_INSET}rem)"
             ${treeRowAttrs({ ns: 'viz', id: it.id, kind: 'item', level: depth + 1, selected: isActive, dragStart: `vizTreeDragStart(event,'${it.id}','item')` })}
             onclick="vizContentClickItem('${it.id}','${scope}')"
             oncontextmenu="vizContentCtx(event,'${it.id}','item')">
          <i data-lucide="chevron-right" class="tree-node-chevron invisible"></i>
          <i data-lucide="${icon}" class="tree-node-icon item-icon-color" style="width:14px;height:14px;"></i>
          <span class="tree-node-label" style="font-weight:400; font-size:0.875rem;">${escapeHTML(title)}</span>
        </div>
      </div>`;
    });

    return html;
  }

  /** A leaf row, shared by the tree and the pseudo-folder below it. */
  function vizItemRowHTML(it, level) {
    const title = it.title || it.name || 'Untitled';
    const icon = it.icon || iconMap[scope] || 'file';
    const isActive = viz.selectedNodeId && viz.nodes.find(n => n.id === viz.selectedNodeId)?.dataId === it.id;
    return `<div class="tree-node tree-item-node" data-level="${level}" data-node-id="${it.id}">
      <div class="tree-node-row ${isActive ? 'active' : ''}"
           style="padding-left: calc(0.75rem + ${TREE_ITEM_INSET}rem)"
           ${treeRowAttrs({ ns: 'viz', id: it.id, kind: 'item', level: level, selected: isActive, dragStart: `vizTreeDragStart(event,'${it.id}','item')` })}
           onclick="vizContentClickItem('${it.id}','${scope}')"
           oncontextmenu="vizContentCtx(event,'${it.id}','item')">
        <i data-lucide="chevron-right" class="tree-node-chevron invisible"></i>
        <i data-lucide="${icon}" class="tree-node-icon item-icon-color" style="width:14px;height:14px;"></i>
        <span class="tree-node-label" style="font-weight:400; font-size:0.875rem;">${escapeHTML(title)}</span>
      </div>
    </div>`;
  }

  let html = renderVizTree(null, 0);

  // The same Uncategorized / Favourites row the libraries have — right-click it
  // to switch which one it shows.
  const allItems = (typeof getItemsForScope === 'function' ? getItemsForScope(scope) : []) || [];
  const rootList = ((typeof libRootItems === 'function') ? libRootItems('viz', allItems) : allItems.filter(i => !i.parentId)).filter(rowMatches);
  const rootMeta = (typeof libRootMeta === 'function') ? libRootMeta('viz') : { label: 'Uncategorized', icon: 'inbox', hint: '' };
  if (rootList.length) {
    const rootOpen = viz.expandedFolderIds.has('__root__') || !!query;
    const rootActive = viz.selectedFolderId === '__root__';
    html += `<div class="tree-node" data-level="0" data-node-id="__root__">
      <div class="tree-node-row ${rootActive ? 'active' : ''}"
           ${treeRowAttrs({ ns: 'viz', id: '__root__', kind: 'folder', level: 0, expanded: rootOpen, selected: rootActive, draggable: false })}
           style="padding-left: calc(0.75rem + 0rem)"
           oncontextmenu="treeContextMenu(event, '__root__', 'viz')"
           onclick="vizContentToggleFolder('__root__')">
        <i data-lucide="chevron-right" class="tree-node-chevron ${rootOpen ? 'expanded' : ''}"
           onclick="event.stopPropagation();vizContentToggleFolder('__root__')"></i>
        <i data-lucide="${rootMeta.icon}" class="tree-node-icon item-icon-color" style="width:14px;height:14px;"></i>
        <span class="tree-node-label" title="${escapeHTML(rootMeta.hint)}">${rootMeta.label}</span>
        <span class="tree-node-badge">${rootList.length}</span>
      </div>
      <div class="tree-children ${rootOpen ? '' : 'collapsed'}" role="group">
        <div class="tree-children-inner">
          ${rootList.map(it => vizItemRowHTML(it, 1)).join('')}
        </div>
      </div>
    </div>`;
  }

  body.dataset.treeNs = 'viz';
  body.classList.toggle('hide-tree-items', localStorage.getItem('vizHideItems') === 'true');
  body.setAttribute('role', 'tree');
  body.setAttribute('aria-label', 'Visualize library');
  // General installs its own pane menu on this element; leaving it behind meant
  // right-clicking a Programs pane opened the General one.
  body.removeAttribute('oncontextmenu');
  body.innerHTML = html
    ? html + treeRootDropHTML('viz')
    : (query
      ? `<div class="viz-content-empty"><i data-lucide="search-x"></i><p>Nothing matches “${escapeHTML(viz.paneQuery || '')}”.</p></div>`
      : `<div class="viz-content-empty"><i data-lucide="inbox"></i><p>No items yet. Right-click the canvas to add nodes.</p></div>`);
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: body });
}

/* ══ General ═══════════════════════════════════════════════════
   General is the union of the three libraries, and it used to be the only
   module whose pane was not a tree: a hand-rolled flat list of every item with
   no folders (it drew none of the 23 that existed), no ids on the rows, no
   drag, no right-click, a dead eye toggle, a search box that did not filter it,
   and a "C"/"S"/"N" badge you had to decode. It is a tree host now, so all of
   that comes from the same engine every other pane uses.

   Shape: three library headings at the top level, each holding that library's
   real folder tree; then one Starred row gathering favourites from all three.  */

const VIZ_GEN_SCOPES = [
  { id: '__sc_challenge__', scope: 'challenge', label: 'Programs', icon: 'file-code' },
  { id: '__sc_snippet__', scope: 'snippet', label: 'Snippets', icon: 'code' },
  { id: '__sc_notebook__', scope: 'notebook', label: 'Notebooks', icon: 'book-open' }
];
const VIZ_GEN_BY_ID = {};
const VIZ_GEN_BY_SCOPE = {};
VIZ_GEN_SCOPES.forEach((s, i) => { s.order = i; VIZ_GEN_BY_ID[s.id] = s; VIZ_GEN_BY_SCOPE[s.scope] = s; });

function vizGenItems(scope) {
  return (typeof getItemsForScope === 'function' ? getItemsForScope(scope) : []) || [];
}

/* id → node, rebuilt per render. Every engine helper below takes only an id and
   has to answer "which library is this in?", so a linear scan each time would
   be O(n) inside treeIsAncestor's loop. */
let _vizGenIndex = null;
function _vizGenIdx() {
  if (_vizGenIndex) return _vizGenIndex;
  const idx = { folder: new Map(), item: new Map(), scopeOf: new Map() };
  (state.nodes || []).forEach(n => {
    if (n.type === 'folder' && VIZ_GEN_BY_SCOPE[n.scope]) { idx.folder.set(n.id, n); idx.scopeOf.set(n.id, n.scope); }
  });
  VIZ_GEN_SCOPES.forEach(s => vizGenItems(s.scope).forEach(it => { idx.item.set(it.id, it); idx.scopeOf.set(it.id, s.scope); }));
  _vizGenIndex = idx;
  return idx;
}
function vizGenInvalidate() { _vizGenIndex = null; }
function vizGenNode(id) { const i = _vizGenIdx(); return i.folder.get(id) || i.item.get(id) || null; }
function vizGenScopeOf(id) {
  if (VIZ_GEN_BY_ID[id]) return VIZ_GEN_BY_ID[id].scope;
  return _vizGenIdx().scopeOf.get(id) || null;
}

registerTreeHost('vizgen', {
  scope: 'general',
  container: '#viz-content-body',
  rerender: () => vizRenderContentPane(),
  data: {
    folders: (parentId) => {
      if (!parentId) return VIZ_GEN_SCOPES.map(s => ({ id: s.id, name: s.label, parentId: null, order: s.order }));
      const sc = VIZ_GEN_BY_ID[parentId];
      const scope = sc ? sc.scope : vizGenScopeOf(parentId);
      if (!scope) return [];
      const under = sc ? null : parentId;
      return (state.nodes || []).filter(n => n.type === 'folder' && n.scope === scope && (n.parentId || null) === under);
    },
    items: (parentId) => {
      if (!parentId) return [];              // the headings are the only top-level rows
      const sc = VIZ_GEN_BY_ID[parentId];
      const scope = sc ? sc.scope : vizGenScopeOf(parentId);
      if (!scope) return [];
      const under = sc ? null : parentId;
      return vizGenItems(scope).filter(it => (it.parentId || null) === under);
    },
    find: (id) => {
      const sc = VIZ_GEN_BY_ID[id];
      if (sc) return { kind: 'folder', node: { id, name: sc.label, parentId: null, order: sc.order }, pseudo: true };
      const idx = _vizGenIdx();
      const folder = idx.folder.get(id);
      const real = folder || idx.item.get(id);
      if (!real) return null;
      const head = VIZ_GEN_BY_SCOPE[idx.scopeOf.get(id)];
      // A top-level program hangs off the Programs heading, not off nothing.
      // The engine walks parentId to find a row's siblings, and a null there
      // made every loose item a sibling of the three headings themselves.
      return {
        kind: folder ? 'folder' : 'item',
        node: new Proxy(real, {
          get: (t, k) => (k === 'parentId' ? (t.parentId || (head ? head.id : null)) : t[k]),
          set: (t, k, v) => {
            if (k === 'parentId') t.parentId = VIZ_GEN_BY_ID[v] ? null : (v || null);
            else t[k] = v;
            return true;
          }
        })
      };
    },
    setOrder: (parentId, ids) => {
      const under = VIZ_GEN_BY_ID[parentId] ? null : (parentId || null);
      ids.forEach((id, i) => {
        const n = vizGenNode(id);
        if (n) { n.order = i; n.parentId = under; }
      });
      if (typeof saveData === 'function') saveData();
    }
  },
  canMove: (id) => !VIZ_GEN_BY_ID[id],       // the headings themselves never move
  canMoveInto: (id, newParentId) => {
    const n = vizGenNode(id);
    if (!n) return false;
    if (!newParentId) return !!n.parentId;   // already at its library's top level
    const from = vizGenScopeOf(id);
    const to = vizGenScopeOf(newParentId);
    return !!from && from === to;
  },
  isExpanded: (id) => viz.expandedFolderIds.has(id),
  expand: (id) => { if (!viz.expandedFolderIds.has(id)) vizContentToggleFolder(id); },
  toggle: (id) => vizContentToggleFolder(id),
  // Dropping on the Starred row stars — favourites is a view, not a location.
  acceptsDrop: (targetId) => targetId === '__root__',
  onDropInto: (targetId, ids) => {
    if (targetId !== '__root__') return false;
    let added = 0;
    ids.forEach(id => { const it = _vizGenIdx().item.get(id); if (it && !it.favorite) { it.favorite = true; added++; } });
    if (added && typeof saveData === 'function') saveData();
    vizRenderContentPane();
    if (typeof toast === 'function') {
      toast(added ? `Starred ${added} item${added !== 1 ? 's' : ''}.` : 'Already starred.', { type: added ? 'success' : 'info' });
    }
    return true;
  },
  pseudoActions: (id) => (VIZ_GEN_BY_ID[id]
    ? [{ sep: true }, { icon: 'git-branch', label: 'Add this library to the canvas', fn: () => vizGenAddScope(VIZ_GEN_BY_ID[id].scope) }]
    : []),
  extraActions: (id, kind) => {
    const onCanvas = viz.nodes.some(n => n.dataId === id);
    const acts = [{
      icon: onCanvas ? 'crosshair' : 'git-branch',
      label: onCanvas ? 'Find on canvas' : 'Add to canvas',
      fn: () => vizGenRevealOnCanvas(id)
    }];
    if (kind !== 'folder') {
      const it = _vizGenIdx().item.get(id);
      // The one thing General is uniquely for: joining a notebook to the
      // program it explains. There was no way to start that from this pane.
      acts.push({ icon: 'link', label: 'Link to…', fn: () => vizGenStartLink(id) });
      acts.push({
        icon: it && it.favorite ? 'star-off' : 'star',
        label: it && it.favorite ? 'Remove star' : 'Star',
        fn: () => vizGenToggleStar(id)
      });
    }
    return acts;
  },
  paneActions: () => ([
    { icon: 'chevrons-up-down', label: 'Expand all libraries', fn: () => vizGenExpandAll(true) },
    { icon: 'chevrons-down-up', label: 'Collapse all libraries', fn: () => vizGenExpandAll(false) },
    { sep: true },
    { icon: 'refresh-cw', label: 'Add everything to the canvas', fn: () => vizAutoPopulateForce() }
  ])
});

/** One row for a library heading or a real folder. */
function _vizGenFolderRow(o) {
  return `
    <div class="tree-node${o.head ? ' viz-gen-head' : ''}" data-level="${o.level}" data-node-id="${o.id}">
      <div class="tree-node-row"
           ${treeRowAttrs({
    ns: 'vizgen', id: o.id, kind: 'folder', level: o.level, expanded: o.open,
    draggable: !o.head && o.id !== '__root__',
    dragStart: o.head || o.id === '__root__' ? undefined : `vizGenDragStart(event,'${o.id}')`
  })}
           style="padding-left: calc(0.75rem + 0rem)"
           oncontextmenu="treeContextMenu(event, '${o.id}', 'vizgen')"
           onclick="vizContentToggleFolder('${o.id}')">
        <i data-lucide="chevron-right" class="tree-node-chevron ${o.kids ? (o.open ? 'expanded' : '') : 'invisible'}"
           onclick="event.stopPropagation();vizContentToggleFolder('${o.id}')"></i>
        <i data-lucide="${o.icon}" class="tree-node-icon ${o.head ? 'viz-gen-head-icon' : 'folder-icon-color'}"${o.head ? '' : ' style="width:14px;height:14px;"'}></i>
        <span class="tree-node-label"${o.hint ? ` title="${escapeHTML(o.hint)}"` : ''}>${escapeHTML(o.label)}</span>
        <span class="tree-node-badge">${o.count}</span>
      </div>
      <div class="tree-children ${o.open ? '' : 'collapsed'}" role="group">
        <div class="tree-children-inner">${o.children}</div>
      </div>
    </div>`;
}

function vizRenderGeneralTree(body) {
  vizGenInvalidate();
  const query = (viz.paneQuery || '').trim().toLowerCase();
  const matches = (it) => !query || String(it.title || it.name || '').toLowerCase().includes(query);
  const iconOf = (scope, it) => it.icon || { challenge: 'file-code', snippet: 'code', notebook: 'book-open' }[scope] || 'file';

  const itemRow = (it, scope, level) => {
    const isActive = viz.selectedNodeId && (viz.nodes.find(n => n.id === viz.selectedNodeId) || {}).dataId === it.id;
    const onCanvas = viz.nodes.some(n => n.dataId === it.id);
    return `
      <div class="tree-node tree-item-node" data-level="${level}" data-node-id="${it.id}" data-scope="${scope}">
        <div class="tree-node-row ${isActive ? 'active' : ''}"
             ${treeRowAttrs({ ns: 'vizgen', id: it.id, kind: 'item', level, selected: isActive, dragStart: `vizGenDragStart(event,'${it.id}')` })}
             style="padding-left: calc(0.75rem + ${TREE_ITEM_INSET}rem)"
             oncontextmenu="treeContextMenu(event, '${it.id}', 'vizgen')"
             onclick="vizContentClickItem('${it.id}','${scope}')">
          <i class="tree-node-chevron invisible"></i>
          <i data-lucide="${iconOf(scope, it)}" class="tree-node-icon viz-gen-item-icon" style="width:14px;height:14px;"></i>
          <span class="tree-node-label" style="font-weight:400; font-size:0.875rem;">${escapeHTML(it.title || it.name || 'Untitled')}</span>
          ${it.favorite ? '<i data-lucide="star" class="viz-gen-star"></i>' : ''}
          ${onCanvas ? '<span class="viz-gen-dot" title="On the canvas"></span>' : ''}
        </div>
      </div>`;
  };

  const folderMatches = (fid, scope) => {
    if (!query) return true;
    if (vizGenItems(scope).some(it => (it.parentId || null) === fid && matches(it))) return true;
    return (state.nodes || []).some(n => n.type === 'folder' && n.scope === scope && n.parentId === fid && folderMatches(n.id, scope));
  };

  function renderUnder(parentId, scope, level) {
    let html = '';
    treeChildren(parentId, 'general', 'vizgen').forEach(entry => {
      const n = entry.node;
      if (entry.kind === 'folder') {
        if (query && !folderMatches(n.id, scope)) return;
        const count = typeof countItemsRecursive === 'function' ? countItemsRecursive(n.id, scope) : 0;
        const kids = count > 0 || (state.nodes || []).some(f => f.type === 'folder' && f.scope === scope && f.parentId === n.id);
        html += _vizGenFolderRow({
          id: n.id, level, label: n.name, icon: n.icon || 'folder', count, kids,
          open: viz.expandedFolderIds.has(n.id) || !!query,
          children: renderUnder(n.id, scope, level + 1)
        });
        return;
      }
      if (!matches(n)) return;
      html += itemRow(n, scope, level + 1);
    });
    return html;
  }

  let html = '';
  VIZ_GEN_SCOPES.forEach(head => {
    const all = vizGenItems(head.scope);
    const shown = query ? all.filter(matches).length : all.length;
    if (query && !shown) return;
    html += _vizGenFolderRow({
      id: head.id, level: 0, label: head.label, icon: head.icon, head: true,
      count: shown, kids: all.length > 0 || (state.nodes || []).some(n => n.type === 'folder' && n.scope === head.scope),
      hint: `Everything in your ${head.label} library`,
      // Collapsed on a first visit: all three expanded is 2700px of list in a
      // 600px pane. The set is remembered from then on (see vizSave).
      open: viz.expandedFolderIds.has(head.id) || !!query,
      children: renderUnder(head.id, head.scope, 1)
    });
  });

  // Favourites across all three libraries — General has no "uncategorized",
  // because every item already sits under its own library heading.
  const starred = [];
  VIZ_GEN_SCOPES.forEach(s => vizGenItems(s.scope).forEach(it => {
    if (it.favorite && matches(it)) starred.push({ it, scope: s.scope });
  }));
  if (starred.length || !query) {
    html += _vizGenFolderRow({
      id: '__root__', level: 0, label: 'Starred', icon: 'star', count: starred.length,
      kids: starred.length > 0, hint: 'Everything you have starred, in any library. Drop a row here to star it.',
      open: viz.expandedFolderIds.has('__root__') || !!query,
      children: starred.map(s => itemRow(s.it, s.scope, 1)).join('')
    });
  }

  body.dataset.treeNs = 'vizgen';
  body.setAttribute('role', 'tree');
  body.setAttribute('aria-label', 'All libraries');
  body.classList.toggle('hide-tree-items', localStorage.getItem('vizHideItems') === 'true');
  body.setAttribute('oncontextmenu', "treePaneContextMenu(event, 'vizgen')");
  body.innerHTML = html
    ? html + treeRootDropHTML('vizgen')
    : `<div class="viz-content-empty"><i data-lucide="search-x"></i><p>Nothing matches “${escapeHTML(viz.paneQuery || '')}”.</p></div>`;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: body });
}

/** A General row is draggable onto the canvas AND within the tree. */
function vizGenDragStart(e, id) {
  const kind = _vizGenIdx().folder.get(id) ? 'folder' : 'item';
  if (typeof vizSidebarDragStart === 'function') vizSidebarDragStart(e, id, kind);
  if (typeof treeDragStart === 'function') treeDragStart(e, id, 'vizgen');
}

function vizGenExpandAll(open) {
  VIZ_GEN_SCOPES.forEach(s => {
    if (open) viz.expandedFolderIds.add(s.id); else viz.expandedFolderIds.delete(s.id);
  });
  if (open) viz.expandedFolderIds.add('__root__'); else viz.expandedFolderIds.delete('__root__');
  vizSave();
  vizRenderContentPane();
}

function vizGenToggleStar(id) {
  const it = _vizGenIdx().item.get(id);
  if (!it) return;
  it.favorite = !it.favorite;
  if (typeof saveData === 'function') saveData();
  vizRenderContentPane();
}

/** Put an item on the canvas if it isn't there, then select and centre it. */
function vizGenEnsureCanvasNode(id) {
  let node = viz.nodes.find(n => n.dataId === id);
  if (node) return node;
  const idx = _vizGenIdx();
  const real = idx.folder.get(id) || idx.item.get(id);
  if (!real) return null;
  const scope = vizGenScopeOf(id);
  vizPushUndo();
  node = vizAddCanvasNode(real.title || real.name || 'Untitled', idx.folder.get(id) ? 'folder' : scope, id, scope);
  return node;
}

function vizGenRevealOnCanvas(id) {
  const node = vizGenEnsureCanvasNode(id);
  if (!node) return;
  viz.selectedNodeId = node.id;
  const container = document.getElementById('viz-canvas-container');
  if (container) {
    viz.pan.x = container.offsetWidth / 2 - (node.x + 90) * viz.zoom;
    viz.pan.y = container.offsetHeight / 2 - (node.y + 30) * viz.zoom;
  }
  vizRenderCanvas();
  vizSave();
}

function vizGenStartLink(id) {
  const node = vizGenEnsureCanvasNode(id);
  if (!node) return;
  vizStartLinking(node.id);
  if (typeof toast === 'function') toast('Now click the node to connect it to.', { type: 'info' });
}

/** Everything in one library onto the canvas, without touching the other two. */
function vizGenAddScope(scope) {
  vizPushUndo();
  vizAutoPopulate([scope]);
  vizRenderContentPane();
  vizRenderCanvas();
  setTimeout(() => vizCenterCanvas(), 50);
}

/* Drag and drop lives in tree-dnd.js, shared with the library trees. The
   right-click menu here stays the Visualize one (vizContentCtx). */
registerTreeHost('viz', {
  get scope() { return viz.activeModule; },
  container: '#viz-content-body',
  selectNs: 'viz',
  rerender: () => vizRenderContentPane(),
  expand: (folderId) => {
    if (!viz.expandedFolderIds.has(folderId)) { viz.expandedFolderIds.add(folderId); vizRenderContentPane(); }
  },
  isExpanded: (id) => viz.expandedFolderIds.has(id),
  toggle: (id) => vizContentToggleFolder(id),
  acceptsDrop: (targetId) => libRootAcceptsDrop('viz', targetId),
  onDropInto: (targetId, ids) => libRootDropInto('viz', targetId, ids,
    (id) => ((typeof getItemsForScope === 'function' ? getItemsForScope(viz.activeModule) : []) || []).find(x => x.id === id))
});

function vizContentToggleFolder(folderId) {
  const wasExpanded = viz.expandedFolderIds.has(folderId);
  if (wasExpanded) {
    viz.expandedFolderIds.delete(folderId);
  } else {
    viz.expandedFolderIds.add(folderId);
  }
  vizSave();   // remembered across mounts, so "collapsed" is a first-visit default
  const expanded = !wasExpanded;
  const body = document.getElementById('viz-content-body');
  const nodeEl = body ? body.querySelector(`.tree-node[data-node-id="${folderId}"]`) : null;
  if (nodeEl) {
    const childrenContainer = nodeEl.querySelector(':scope > .tree-children');
    const chevron = nodeEl.querySelector(':scope > .tree-node-row .tree-node-chevron');
    // Toggling in place leaves aria-expanded stale unless it is set here too.
    const row = nodeEl.querySelector(':scope > .tree-node-row');
    if (row && row.hasAttribute('aria-expanded')) row.setAttribute('aria-expanded', String(expanded));
    if (childrenContainer) childrenContainer.classList.toggle('collapsed', !expanded);
    if (chevron) chevron.classList.toggle('expanded', expanded);
  } else {
    vizRenderContentPane();
  }
}

function vizContentClickFolder(folderId) {
  const wasExpanded = viz.expandedFolderIds.has(folderId);
  if (wasExpanded) {
    viz.expandedFolderIds.delete(folderId);
  } else {
    viz.expandedFolderIds.add(folderId);
  }
  const expanded = !wasExpanded;
  viz.selectedFolderId = folderId;
  const canvasNode = viz.nodes.find(n => n.dataId === folderId);
  viz.selectedNodeId = canvasNode ? canvasNode.id : null;

  const body = document.getElementById('viz-content-body');
  const nodeEl = body ? body.querySelector(`.tree-node[data-node-id="${folderId}"]`) : null;
  if (nodeEl) {
    // Update active state across all rows
    body.querySelectorAll('.tree-node-row').forEach(r => r.classList.remove('active'));
    const row = nodeEl.querySelector(':scope > .tree-node-row');
    if (row) row.classList.add('active');
    // Surgical expand/collapse
    const childrenContainer = nodeEl.querySelector(':scope > .tree-children');
    const chevron = nodeEl.querySelector(':scope > .tree-node-row .tree-node-chevron');
    if (childrenContainer) childrenContainer.classList.toggle('collapsed', !expanded);
    if (chevron) chevron.classList.toggle('expanded', expanded);
  } else {
    vizRenderContentPane();
  }
  vizRenderCanvas();
}

function vizContentClickItem(itemId, scope) {
  const canvasNode = viz.nodes.find(n => n.dataId === itemId);
  viz.selectedNodeId = canvasNode ? canvasNode.id : null;
  // Surgical active state update
  const body = document.getElementById('viz-content-body');
  if (body) {
    body.querySelectorAll('.tree-node-row').forEach(r => r.classList.remove('active'));
    const itemEl = body.querySelector(`.tree-item-node[data-node-id="${itemId}"] > .tree-node-row`);
    if (itemEl) itemEl.classList.add('active');
  }
  vizRenderCanvas();
}

function vizContentCtx(e, id, type) {
  e.preventDefault();
  if (viz.activeModule === 'general') return;
  const scope = viz.activeModule;
  if (viz.nodes.find(n => n.dataId === id)) return;

  if (type === 'folder') {
    const folder = state.nodes.find(n => n.id === id);
    if (folder) {
      const newNode = vizAddCanvasNode(folder.name, 'folder', id, scope);
      const parentId = folder.parentId || 'root';
      const parentViz = viz.nodes.find(n => n.dataId === parentId && n.scope === scope);
      if (parentViz) vizAddLink(parentViz.id, newNode.id);
    }
  } else {
    const items = getItemsForScope(scope);
    const item = items.find(it => it.id === id);
    if (item) {
      const newNode = vizAddCanvasNode(item.title || item.name || 'Untitled', scope, id, scope);
      const parentId = item.parentId || 'root';
      const parentViz = viz.nodes.find(n => n.dataId === parentId && n.scope === scope);
      if (parentViz) vizAddLink(parentViz.id, newNode.id);
    }
  }
  vizRenderContentPane();
}

function vizContentDragOver(e) {
  e.preventDefault();
  const row = e.target.closest('.tree-node-row');
  if (row) row.classList.add('drag-over');
}

function vizContentDragLeave(e) {
  const row = e.target.closest('.tree-node-row');
  if (row) row.classList.remove('drag-over');
}

function vizNodeClick(e, nodeId) {
  e.stopPropagation();

  const nodeEl = e.target.closest('.viz-node');
  const isFogged = nodeEl && nodeEl.classList.contains('viz-fog-of-war');

  if (viz.colorModeEnabled && !isFogged) {
    vizEditNodeColor(nodeId, viz.colorPaintColor || null);
    return;
  }

  if (viz.linkingFrom) {
    // Port drag completes via its own mouseup listener — ignore clicks from it
    if (viz.portDrag) return;
    if (viz.linkingFrom !== nodeId) {
      // Detect if clicked on a specific port circle
      const portEl = e.target.closest('.viz-port');
      vizPushUndo();
      const link = vizAddLink(viz.linkingFrom, nodeId);
      if (link) {
        if (viz._linkFromSide) link.fromSide = viz._linkFromSide;
        if (portEl && portEl.dataset.side) {
          link.toSide = portEl.dataset.side;
        } else {
          // Use cursor position relative to target node (3-tier logic)
          const nodeEl = e.target.closest('.viz-node');
          if (nodeEl) {
            const rect = nodeEl.getBoundingClientRect();
            const lx = e.clientX - rect.left, ly = e.clientY - rect.top;
            const w = rect.width, h = rect.height;
            const ef = 0.25;
            const inCenterX = lx > w * ef && lx < w * (1 - ef);
            const inCenterY = ly > h * ef && ly < h * (1 - ef);
            if (!(inCenterX && inCenterY)) {
              const dTop = ly, dBottom = h - ly, dLeft = lx, dRight = w - lx;
              const minDist = Math.min(dTop, dBottom, dLeft, dRight);
              link.toSide = minDist === dTop ? 'top' : minDist === dBottom ? 'bottom' : minDist === dLeft ? 'left' : 'right';
            }
          }
        }
      }
    }
    viz._linkFromSide = null;
    vizCancelLinking();
    return;
  }

  if (viz.linkModeEnabled) {
    // Port clicks are handled separately in vizPortDragStart — only trigger from node body
    if (!e.target.closest('.viz-port')) {
      viz._linkFromSide = null;
      vizStartLinking(nodeId);
    }
    return;
  }

  viz.selectedNodeId = nodeId;

  const node = viz.nodes.find(n => n.id === nodeId);
  if (node && node.type === 'folder' && node.dataId) {
    viz.selectedFolderId = node.dataId === 'root' ? null : node.dataId;
    if (node.dataId && node.dataId !== 'root') viz.expandedFolderIds.add(node.dataId);
    vizRenderContentPane();
    vizHideNodePopup();
  } else if (node && ['challenge', 'snippet', 'notebook'].includes(node.type)) {
    if (isFogged) {
      vizHideNodePopup();
    } else {
      vizShowNodePopup(node, e.clientX, e.clientY);
    }
  } else {
    vizHideNodePopup();
  }

  vizRenderCanvas();
}

function vizHideAllMenus() {
  document.querySelectorAll('.viz-context-menu, .viz-link-menu, #brain-canvas-ctx, #brain-node-ctx, #brain-link-ctx, #brain-version-ctx').forEach(m => m.classList.add('hidden'));
  document.getElementById('viz-link-type-popup')?.classList.add('hidden');
}

/** Position a context menu at the click point, clamped so it never overflows the viewport. */
function vizPositionMenu(menu, clientX, clientY) {
  // Place offscreen first to measure natural size
  menu.style.left = '-9999px';
  menu.style.top = '-9999px';
  menu.classList.remove('hidden');

  const mw = menu.offsetWidth;
  const mh = menu.offsetHeight;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const pad = 6; // px gap from viewport edge
  // Was -240, which put the menu a quarter of a screen to the LEFT of the
  // pointer. That was compensating for the containing-block bug above (see
  // .route-enter in global.css) — with the coordinates correct, the menu opens
  // at the pointer and only flips when it would run off the edge.
  let left = clientX + 4;
  if (left + mw > vw - pad) left = clientX - mw - 4;
  let top = clientY + 4;
  if (top + mh > vh - pad) top = clientY - mh - 4;

  menu.style.left = Math.max(pad, Math.min(left, vw - mw - pad)) + 'px';
  menu.style.top = Math.max(pad, Math.min(top, vh - mh - pad)) + 'px';
}

function vizCanvasCtx(e) {
  if (viz.activeModule === 'brain') { brainCanvasCtx(e); return; }
  if (e.target.closest('.viz-node')) return;
  e.preventDefault();
  vizHideAllMenus();

  const menu = document.getElementById('viz-canvas-ctx');
  if (!menu) return;

  const scopeLabels = { challenge: 'Program', snippet: 'Snippet', notebook: 'Notebook', general: 'Node' };
  const currentScope = scopeLabels[viz.activeModule] || 'Node';

  const addNodeBtn = menu.querySelector('[onclick="vizCtxAddNode()"]');
  if (addNodeBtn) addNodeBtn.innerHTML = `<i data-lucide="plus-circle"></i> <span>Add ${escapeHTML(currentScope)}</span>`;

  const addFolderBtn = menu.querySelector('[onclick="vizCtxAddFolder()"]');
  if (addFolderBtn) addFolderBtn.innerHTML = `<i data-lucide="folder-plus"></i> <span>Add Category</span>`;

  lucide.createIcons({ root: menu });

  const container = document.getElementById('viz-canvas-container');
  const rect = container ? container.getBoundingClientRect() : { left: 0, top: 0 };

  viz.contextPos = {
    x: (e.clientX - rect.left - viz.pan.x) / viz.zoom,
    y: (e.clientY - rect.top - viz.pan.y) / viz.zoom
  };

  vizPositionMenu(menu, e.clientX, e.clientY);
}

function vizCtxAddNode() {
  showInputDialog('Add Node', null, 'Node name', '', (label) => {
    vizPushUndo();
    const scope = viz.activeModule === 'general' ? 'challenge' : viz.activeModule;
    const newNode = vizAddCanvasNode(label.trim(), scope, null, scope, viz.contextPos?.x, viz.contextPos?.y);
    newNode.isDraft = true;
    vizCommitDraftNode(newNode, null);
    vizRenderContentPane();
    vizRenderCanvas();
    vizSave();
    vizHideAllMenus();
  });
}

function vizCtxAddFolder() {
  showInputDialog('Add Folder', null, 'Folder name', '', (label) => {
    vizPushUndo();
    const scope = viz.activeModule === 'general' ? 'challenge' : viz.activeModule;
    const node = vizAddCanvasNode(label.trim(), 'folder', null, scope, viz.contextPos?.x, viz.contextPos?.y);
    node.isDraft = true;
    vizCommitDraftNode(node, null);
    vizRenderContentPane();
    vizRenderCanvas();
    vizSave();
    vizHideAllMenus();
  });
}

function vizCtxAddComment() {
  vizPushUndo();
  const scope = viz.activeModule === 'general' ? 'challenge' : viz.activeModule;
  const cx = viz.contextPos?.x ?? ((-viz.pan.x / viz.zoom) + 200);
  const cy = viz.contextPos?.y ?? ((-viz.pan.y / viz.zoom) + 200);
  const newNode = vizAddCanvasNode('Comment', 'comment', null, scope, cx, cy);
  newNode.commentTitle = '';
  newNode.commentContent = '';
  vizHideAllMenus();
  vizOpenCommentEditor(newNode);
}

function vizNodeCtx(e, nodeId) {
  e.preventDefault();
  e.stopPropagation();
  vizHideAllMenus();

  const el = document.querySelector(`.viz-node[data-node-id="${nodeId}"]`);
  if (el && el.classList.contains('viz-fog-of-war')) return;

  viz.contextNodeId = nodeId;

  const menu = document.getElementById('viz-node-ctx');
  if (!menu) return;

  const node = viz.nodes.find(n => n.id === nodeId);

  const deleteBtn = menu.querySelector('.viz-ctx-item.danger');
  if (deleteBtn) {
    deleteBtn.style.display = node.dataId === 'root' ? 'none' : 'flex';
  }

  const editCommentBtn = document.getElementById('viz-ctx-edit-comment-btn');
  if (editCommentBtn) {
    editCommentBtn.style.display = node.type === 'comment' ? 'flex' : 'none';
  }

  const resizeBtn = document.getElementById('viz-ctx-resize-btn');
  if (resizeBtn) {
    resizeBtn.style.display = node.type === 'root' ? 'none' : 'flex';
  }

  const collapseBtn = document.getElementById('viz-ctx-collapse-btn');
  const expandBtn = document.getElementById('viz-ctx-expand-btn');
  if (collapseBtn && expandBtn) {
    const hasChildren = viz.links.some(l => l.from === nodeId && !l.isCustom);
    if (node.collapsed) {
      collapseBtn.style.display = 'none';
      expandBtn.style.display = 'flex';
    } else if (hasChildren) {
      collapseBtn.style.display = 'flex';
      expandBtn.style.display = 'none';
    } else {
      collapseBtn.style.display = 'none';
      expandBtn.style.display = 'none';
    }
  }

  vizPositionMenu(menu, e.clientX, e.clientY);

  menu.querySelectorAll('.viz-color-swatch').forEach(sw => {
    sw.classList.toggle('active', sw.dataset.color === (node?.color || ''));
  });
}

function vizCtxEditColor(color) {
  vizPushUndo();
  if (viz.contextNodeId) vizEditNodeColor(viz.contextNodeId, color);
  vizHideAllMenus();
}

function vizCtxDeleteNode() {
  if (viz.contextNodeId) vizDeleteNode(viz.contextNodeId);
  vizHideAllMenus();
}

function vizCtxEditComment() {
  if (viz.contextNodeId) {
    const node = viz.nodes.find(n => n.id === viz.contextNodeId);
    if (node && node.type === 'comment') {
      vizOpenCommentEditor(node);
    }
  }
  vizHideAllMenus();
}

function vizOpenCommentEditor(node) {
  if (typeof vizHoverClear === 'function') vizHoverClear();
  let overlay = document.getElementById('viz-comment-editor-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'viz-comment-editor-overlay';
    overlay.className = 'viz-comment-editor-overlay';
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="viz-comment-editor-window">
      <div class="viz-comment-editor-header">
        <i data-lucide="terminal"></i>
        <span>Edit Comment</span>
        <button class="viz-comment-editor-close" onclick="document.getElementById('viz-comment-editor-overlay').remove(); if(typeof vizHoverClear==='function')vizHoverClear();"><i data-lucide="x"></i></button>
      </div>
      <div class="viz-comment-editor-body">
        <textarea id="viz-comment-editor-textarea" class="viz-comment-editor-textarea" spellcheck="false" placeholder="Enter context here...">${escapeHTML(node.commentContent || '')}</textarea>
      </div>
      <div class="viz-comment-editor-footer">
        <button class="btn btn-primary" id="viz-comment-editor-save">Save & Close</button>
      </div>
    </div>
  `;

  lucide.createIcons({ root: overlay });

  const saveBtn = document.getElementById('viz-comment-editor-save');
  saveBtn.onclick = () => {
    vizPushUndo();
    node.commentContent = document.getElementById('viz-comment-editor-textarea').value;
    vizRenderCanvas();
    vizSave();
    overlay.remove();
    if (typeof vizHoverClear === 'function') vizHoverClear();
  };
}

function vizCtxAddChild() {
  if (viz.contextNodeId) vizAddChildNode(viz.contextNodeId);
  vizHideAllMenus();
}

function vizCtxAddChildFolder() {
  if (viz.contextNodeId) vizAddChildFolder(viz.contextNodeId);
  vizHideAllMenus();
}

function vizCtxAddLink() {
  if (viz.contextNodeId) vizStartLinking(viz.contextNodeId);
  vizHideAllMenus();
}

function vizCtxCollapseChildren() {
  if (viz.contextNodeId) vizCollapseChildren(viz.contextNodeId);
  vizHideAllMenus();
}

function vizCtxExpandChildren() {
  if (viz.contextNodeId) vizExpandChildren(viz.contextNodeId);
  vizHideAllMenus();
}

function vizLinkCtx(e, linkId) {
  e.preventDefault();
  e.stopPropagation();
  vizHideAllMenus();
  viz.contextLinkId = linkId;
  const menu = document.getElementById('viz-link-ctx');
  if (!menu) return;
  const link = viz.links.find(l => l.id === linkId);
  const lockBtn = menu.querySelector('[data-action="toggle-lock"]');
  if (lockBtn && link) lockBtn.innerHTML = `<i data-lucide="${link.locked ? 'unlock' : 'lock'}"></i> ${link.locked ? 'Unlock' : 'Lock'}`;
  menu.querySelectorAll('.viz-color-swatch').forEach(sw => {
    sw.classList.toggle('active', sw.dataset.color === (link?.color || ''));
  });
  lucide.createIcons({ root: menu });
  vizPositionMenu(menu, e.clientX, e.clientY);
}

function vizCtxToggleLock() {
  if (viz.contextLinkId) vizToggleLinkLock(viz.contextLinkId);
  vizHideAllMenus();
}

function vizCtxDeleteLink() {
  if (viz.contextLinkId) vizDeleteLink(viz.contextLinkId);
  vizHideAllMenus();
}

function vizCtxRenameNode() {
  vizHideAllMenus();
  if (!viz.contextNodeId) return;
  const node = viz.nodes.find(n => n.id === viz.contextNodeId);
  if (!node) return;
  showInputDialog('Rename Node', null, 'Name', node.label, (newLabel) => {
    node.label = newLabel.trim();
    if (node.dataId && node.type === 'folder') {
      const folder = state.nodes.find(n => n.id === node.dataId);
      if (folder) { folder.name = node.label; saveData(); }
    }
    vizRenderCanvas();
    vizRenderContentPane();
    vizSave();
  });
}

function vizCtxEditLinkColor(color) {
  vizPushUndo();
  if (!viz.contextLinkId) return;
  const link = viz.links.find(l => l.id === viz.contextLinkId);
  if (link) {
    link.color = color;
    vizRenderCanvas();
    vizSave();
  }
  vizHideAllMenus();
}

function vizCtxSetLinkArrow(type) {
  if (!viz.contextLinkId) return;
  const link = viz.links.find(l => l.id === viz.contextLinkId);
  if (link) {
    link.arrowType = type;
    vizRenderCanvas();
    vizSave();
  }
  vizHideAllMenus();
}

function vizSearchNodes(query) {
  if (viz.activeModule === 'brain') { brainSearchNodes(query); const cb = document.getElementById('viz-search-clear'); if (cb) cb.classList.toggle('hidden', !query); return; }
  viz.searchQuery = (query || '').toLowerCase().trim();
  const clearBtn = document.getElementById('viz-search-clear');
  if (clearBtn) clearBtn.classList.toggle('hidden', !viz.searchQuery);

  const scopes = vizGetVisibleScopes();
  viz.highlightedNodeIds = new Set();
  if (viz.searchQuery) {
    viz.nodes.filter(n => scopes.includes(n.scope)).forEach(n => {
      if ((n.label || '').toLowerCase().includes(viz.searchQuery)) viz.highlightedNodeIds.add(n.id);
    });
  }
  vizRenderContentPane();
  vizRenderCanvas();
}

function vizClearSearch() {
  const inp = document.getElementById('viz-search-input');
  if (inp) inp.value = '';
  // In Brain the box filters the VERSION LIST (vizPaneSearch → brainSearchSidebar).
  // Clearing it only reset the canvas highlight, so the box went empty while the
  // list stayed filtered by a word that was no longer written anywhere.
  if (viz.activeModule === 'brain') { brainSearchSidebar(''); brainSearchNodes(''); return; }
  viz.paneQuery = '';
  vizRenderContentPane();
  vizSearchNodes('');
}

function vizShowNodePopup(node, x, y) {
  const popup = document.getElementById('viz-node-details-popup');
  if (!popup) return;
  vizHideAllMenus();

  viz.popupTargetNode = node;
  document.getElementById('viz-popup-title').textContent = node.label;

  const typeBadge = document.getElementById('viz-popup-type-badge');
  if (typeBadge) {
    const typeLabels = { challenge: 'Program', snippet: 'Snippet', notebook: 'Notebook' };
    typeBadge.textContent = typeLabels[node.type] || node.type || '';
  }

  const actionsEl = document.getElementById('viz-popup-actions');
  if (actionsEl) {
    let btns = '';
    if (node.type === 'challenge') {
      btns = `<button class="btn btn-ghost btn-sm" onclick="vizPopupPlay()" title="Practice" style="padding:0.25rem;"><i data-lucide="play" style="width:16px;height:16px;color:var(--color-success);"></i></button>
        <button class="btn btn-ghost btn-sm" onclick="vizPopupEdit()" title="Edit" style="padding:0.25rem;"><i data-lucide="edit-2" style="width:16px;height:16px;color:var(--color-primary);"></i></button>`;
    } else if (node.type === 'snippet') {
      btns = `<button class="btn btn-ghost btn-sm" onclick="vizPopupPlay()" title="View in Library" style="padding:0.25rem;"><i data-lucide="eye" style="width:16px;height:16px;color:var(--color-success);"></i></button>`;
    } else if (node.type === 'notebook') {
      btns = `<button class="btn btn-ghost btn-sm" onclick="vizPopupPlay()" title="Open Notebook" style="padding:0.25rem;"><i data-lucide="play" style="width:16px;height:16px;color:var(--color-success);"></i></button>
        <button class="btn btn-ghost btn-sm" onclick="vizPopupEdit()" title="Edit Notebook" style="padding:0.25rem;"><i data-lucide="edit-2" style="width:16px;height:16px;color:var(--color-primary);"></i></button>`;
    }
    actionsEl.innerHTML = btns;
  }

  const statsEl = document.getElementById('viz-popup-stats');
  if (statsEl) {
    if (node.type === 'challenge' && node.dataId) {
      const attempts = (state.history || []).filter(h => h.challengeId === node.dataId && !h.isArchived);
      const perfect = attempts.filter(h => h.score === 100);
      const bestScore = attempts.length ? Math.max(...attempts.map(h => h.score || 0)) : null;
      statsEl.innerHTML = `
        <div class="viz-popup-stat"><span class="viz-popup-stat-val">${attempts.length}</span><span class="viz-popup-stat-label">Attempts</span></div>
        <div class="viz-popup-stat"><span class="viz-popup-stat-val" style="color:var(--color-success)">${perfect.length}</span><span class="viz-popup-stat-label">Perfect</span></div>
        <div class="viz-popup-stat"><span class="viz-popup-stat-val" style="color:var(--color-warning)">${bestScore !== null ? bestScore + '%' : '—'}</span><span class="viz-popup-stat-label">Best</span></div>
      `;
      statsEl.style.display = 'flex';
    } else {
      statsEl.style.display = 'none';
    }
  }

  const locksList = document.getElementById('viz-popup-locks-list');
  if (locksList) {
    const allPrograms = viz.nodes.filter(n => ['challenge', 'snippet', 'notebook'].includes(n.type) && n.id !== node.id);
    locksList.innerHTML = allPrograms.map(p => {
      const isLocked = viz.links.some(l => l.locked && ((l.from === p.id && l.to === node.id) || (l.to === p.id && l.from === node.id)));
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:0.375rem 0.5rem;background:var(--bg-surface);border-radius:var(--radius-sm);border:1px solid ${isLocked ? 'var(--color-warning)' : 'var(--border-color)'};opacity:${isLocked ? '1' : '0.6'};cursor:pointer;transition:all 0.2s ease;" onclick="vizPopupToggleLock('${p.id}')">
        <span style="font-size:0.75rem;">${escapeHTML(p.label)}</span>
        <i data-lucide="${isLocked ? 'lock' : 'unlock'}" style="width:12px;height:12px;color:${isLocked ? 'var(--color-warning)' : 'var(--text-tertiary)'}"></i>
      </div>`;
    }).join('');
    if (allPrograms.length === 0) locksList.innerHTML = '<div style="font-size:0.7rem;color:var(--text-tertiary);padding:0.5rem;">No other nodes available</div>';
  }

  lucide.createIcons({ root: popup });

  // Measure popup size by showing it offscreen first
  popup.style.left = '-9999px';
  popup.style.top = '-9999px';
  popup.classList.remove('hidden');

  const popupW = popup.offsetWidth || 300;
  const popupH = popup.offsetHeight || 320;
  const pad = 8;
  let popupLeft = x + 12;
  // Open beside the pointer, and flip to the other side rather than sliding to
  // the screen edge — sliding is what made it feel detached from the click.
  let popupTop = y - 12;
  if (popupLeft + popupW > window.innerWidth - pad) popupLeft = x - popupW - 12;
  if (popupTop + popupH > window.innerHeight - pad) popupTop = y - popupH + 12;
  popupLeft = Math.max(pad, Math.min(popupLeft, window.innerWidth - popupW - pad));
  popupTop = Math.max(pad, Math.min(popupTop, window.innerHeight - popupH - pad));

  popup.style.left = popupLeft + 'px';
  popup.style.top = popupTop + 'px';
}

function vizHideNodePopup() {
  const popup = document.getElementById('viz-node-details-popup');
  if (popup) popup.classList.add('hidden');
  viz.popupTargetNode = null;
}

function vizPopupPlay() {
  if (!viz.popupTargetNode || !viz.popupTargetNode.dataId) return;
  const node = viz.popupTargetNode;

  vizHideNodePopup();

  if (node.type === 'challenge') {
    if (typeof promptTimer === 'function') {
      promptTimer(node.dataId);
    } else {
      setSessionParam('practiceChallenge', node.dataId);
      const c = state.challenges.find(ch => ch.id === node.dataId);
      if (c && c.variants && c.variants.length > 0) {
        setSessionParam('practiceVariant', c.variants[0].id);
      }
      setSessionParam('timeLimit', 0);
      spaNavigate('practice');
    }
  } else if (node.type === 'snippet') {
    spaNavigate('study');
  } else if (node.type === 'notebook') {
    setSessionParam('activeNotebook', node.dataId);
    setSessionParam('notebookTimeLimit', 0);
    spaNavigate('notes-practice');
  }
}

function vizPopupEdit() {
  if (!viz.popupTargetNode || !viz.popupTargetNode.dataId) return;
  const node = viz.popupTargetNode;
  const modal = document.getElementById('viz-admin-modal');
  if (!modal) return;

  const titleEl = document.getElementById('viz-modal-form-title');
  const bodyEl = document.getElementById('viz-admin-modal-body');
  if (!bodyEl) return;

  vizHideNodePopup();

  if (node.type === 'challenge') {
    if (titleEl) titleEl.innerHTML = '<i data-lucide="edit-3" style="color:var(--color-primary);"></i> Edit Program';
    bodyEl.innerHTML = getAdminFormHTML();
    modal.classList.remove('hidden');
    lucide.createIcons({ root: modal });
    setTimeout(() => {
      const formEl = bodyEl.querySelector('#admin-form-container');
      if (formEl) formEl.classList.remove('hidden');
      if (typeof window.currentAdminMode === 'undefined') window.currentAdminMode = 'practice';
      window.currentAdminMode = 'practice';
      if (typeof openAdminForm === 'function') openAdminForm(node.dataId);
    }, 50);
  } else if (node.type === 'notebook') {
    if (titleEl) titleEl.innerHTML = '<i data-lucide="book" style="color:var(--color-primary);"></i> Edit Notebook';
    if (typeof getNotebookFormHTML === 'function') {
      bodyEl.innerHTML = getNotebookFormHTML();
      modal.classList.remove('hidden');
      lucide.createIcons({ root: modal });
      setTimeout(() => {
        if (typeof openNotebookForm === 'function') openNotebookForm(node.dataId);
        const saveBtn = document.getElementById('save-notebook-btn');
        if (saveBtn) {
          saveBtn.onclick = function () {
            if (typeof saveNotebookForm === 'function') {
              const ok = saveNotebookForm();
              if (ok !== false) {
                vizCloseAdminModal();
                vizRenderContentPane();
              }
            }
          };
        }
      }, 60);
    } else {
      if (typeof setSessionParam === 'function') setSessionParam('adminActiveTab', 'notebooks');
      spaNavigate('admin');
    }
  } else {
    spaNavigate('admin');
  }
}

function vizCloseAdminModal() {
  const modal = document.getElementById('viz-admin-modal');
  if (modal) modal.classList.add('hidden');
  if (typeof closeAdminForm === 'function') closeAdminForm();
  if (typeof closeNotebookForm === 'function') closeNotebookForm();
  vizRenderCanvas();
}

function vizPopupToggleLock(otherNodeId) {
  if (!viz.popupTargetNode) return;
  const currentId = viz.popupTargetNode.id;

  const existingLinkIdx = viz.links.findIndex(l => l.locked && ((l.from === otherNodeId && l.to === currentId) || (l.to === otherNodeId && l.from === currentId)));

  if (existingLinkIdx >= 0) {
    viz.links.splice(existingLinkIdx, 1);
  } else {
    viz.links.push({
      id: generateId(),
      from: otherNodeId,
      to: currentId,
      locked: true
    });
  }
  vizRenderCanvas();
  vizSave();

  const popup = document.getElementById('viz-node-details-popup');
  if (popup && !popup.classList.contains('hidden')) {
    vizShowNodePopup(viz.popupTargetNode, parseFloat(popup.style.left) - 20, parseFloat(popup.style.top));
  }
}

function vizToggleFlowyDrag() {
  viz.flowyDragEnabled = !viz.flowyDragEnabled;
  const btn = document.getElementById('viz-flow-toggle-btn');
  if (btn) {
    btn.classList.toggle('is-active', viz.flowyDragEnabled);
    btn.classList.add('viz-state-flow');
    btn.style.color = '';
    btn.style.borderColor = '';
  }
  vizSave();
}

function vizToggleColorMode() {
  viz.colorModeEnabled = !viz.colorModeEnabled;

  // Turn off link mode for the currently active module
  if (viz.colorModeEnabled) {
    if (viz.activeModule === 'brain') {
      if (typeof brain !== 'undefined' && brain.linkModeEnabled && typeof brainToggleLinkMode === 'function') brainToggleLinkMode();
    } else {
      if (viz.linkModeEnabled) vizToggleLinkMode();
    }
  }

  const btn = document.getElementById('viz-color-toggle-btn');
  if (btn) {
    btn.classList.toggle('is-active', viz.colorModeEnabled);
    btn.classList.add('viz-state-color');
    btn.style.color = '';
    if (!viz.colorModeEnabled) {
      btn.style.borderColor = '';
      btn.style.boxShadow = '';
      const linkBtn = document.getElementById('viz-link-toggle-btn');
      if (linkBtn) { linkBtn.style.borderColor = ''; linkBtn.style.boxShadow = ''; }
    } else if (viz.colorPaintColor) {
      // Re-apply the paint color tint when turning on
      vizSetPaintColor(viz.colorPaintColor);
    }
  }
  const popup = document.getElementById('viz-color-mode-popup');
  if (popup) popup.classList.toggle('hidden', !viz.colorModeEnabled);
  const container = document.getElementById('viz-canvas-container');
  if (container) container.classList.toggle('color-paint-mode', viz.colorModeEnabled);
}

function vizSetPaintColor(color) {
  viz.colorPaintColor = color;
  document.querySelectorAll('#viz-color-mode-popup .viz-color-swatch').forEach(sw => {
    sw.classList.toggle('active', sw.dataset.color === (color || ''));
  });
  const colorMap = { red: '#ef4444', orange: '#f97316', yellow: '#eab308', green: '#22c55e', blue: '#3b82f6', purple: '#a855f7', pink: '#ec4899', cyan: '#06b6d4' };
  const hex = color ? (colorMap[color] || '') : '';
  // Tint both the color button and the link button with the selected paint color
  const colorBtn = document.getElementById('viz-color-toggle-btn');
  const linkBtn = document.getElementById('viz-link-toggle-btn');
  if (viz.colorModeEnabled && hex) {
    if (colorBtn) { colorBtn.style.borderColor = hex; colorBtn.style.boxShadow = `0 0 0 2px ${hex}40`; }
    if (linkBtn) { linkBtn.style.borderColor = hex; linkBtn.style.boxShadow = `0 0 0 2px ${hex}40`; }
  } else {
    if (colorBtn) { colorBtn.style.borderColor = ''; colorBtn.style.boxShadow = ''; }
    if (linkBtn) { linkBtn.style.borderColor = ''; linkBtn.style.boxShadow = ''; }
  }
}

function vizToggleLinkTypeDropdown() {
  const popup = document.getElementById('viz-link-type-popup');
  if (!popup) return;
  const isHidden = popup.classList.contains('hidden');
  vizHideAllMenus();
  document.getElementById('viz-color-mode-popup')?.classList.add('hidden');
  if (isHidden) {
    popup.classList.remove('hidden');
    lucide.createIcons({ root: popup });
  }
}

function vizSetLinkArrowType(type) {
  viz.defaultLinkArrowType = type;
  document.querySelectorAll('#viz-link-type-popup .viz-link-type-option').forEach(opt => {
    opt.classList.toggle('active', opt.dataset.type === type);
  });
  const popup = document.getElementById('viz-link-type-popup');
  if (popup) popup.classList.add('hidden');
  // Update label on the Link button to show current type
  const linkBtn = document.getElementById('viz-link-toggle-btn');
  if (linkBtn) {
    const iconMap = { 'arrow': 'arrow-right', 'double-arrow': 'arrow-left-right', 'none': 'minus' };
    const iconName = iconMap[type] || 'link';
    const chevron = linkBtn.querySelector('.viz-pill-chevron');
    linkBtn.innerHTML = `<i data-lucide="${iconName}" style="width:12px;height:12px;"></i> Link `;
    if (chevron) linkBtn.appendChild(chevron);
    else {
      const newChevron = document.createElement('span');
      newChevron.className = 'viz-pill-chevron';
      newChevron.setAttribute('onclick', 'event.stopPropagation();vizToggleLinkTypeDropdown()');
      newChevron.innerHTML = '<i data-lucide="chevron-down" style="width:10px;height:10px;"></i>';
      linkBtn.appendChild(newChevron);
    }
    if (typeof lucide !== 'undefined') lucide.createIcons({ el: linkBtn });
  }
}

function vizCtxChangeIcon() {
  if (!viz.contextNodeId) return;
  const node = viz.nodes.find(n => n.id === viz.contextNodeId);
  if (!node) return;
  vizHideAllMenus();

  if (typeof openIconPicker === 'function') {
    openIconPicker(node.icon || 'file').then(newIcon => {
      if (newIcon) {
        node.icon = newIcon;
        if (node.dataId && node.type === 'folder') {
          const folder = state.nodes.find(n => n.id === node.dataId);
          if (folder) { folder.icon = newIcon; saveData(); }
        }
        vizRenderCanvas();
        vizSave();
      }
    });
  }
}

function vizToggleGlobeMode() {
  viz.globeModeEnabled = !viz.globeModeEnabled;
  const btn = document.getElementById('viz-globe-toggle-btn');
  if (btn) {
    btn.classList.toggle('is-active', viz.globeModeEnabled);
    btn.classList.add('viz-state-globe');
  }
  const container = document.getElementById('viz-canvas-container');
  if (container) container.classList.toggle('globe-mode', viz.globeModeEnabled);
  if (viz.activeModule === 'brain') brainRenderCanvas();
  else vizRenderCanvas();
  vizSave();
}

/** The refresh button: an explicit "sync from data", so here General DOES mean
 *  all three libraries — it just no longer happens merely by opening the page. */
function vizAutoPopulateForce() {
  vizAutoPopulate(vizGetVisibleScopes());
  vizRenderContentPane();
  vizRenderCanvas();
  setTimeout(() => vizCenterCanvas(), 50);
}

/* ── Pane header ───────────────────────────────────────────────
   The identity line, subtitle and stat chips, filled per module. The pane used
   to show only an uppercase word and a breadcrumb, so it read as a different
   kind of surface from the library panes it is a copy of. */

const VIZ_HEADER_META = {
  challenge: { label: 'Programs', icon: 'file-code', noun: 'program' },
  snippet: { label: 'Snippets', icon: 'code', noun: 'snippet' },
  notebook: { label: 'Notebooks', icon: 'book-open', noun: 'notebook' },
  general: { label: 'General', icon: 'layers', noun: 'item' },
  brain: { label: 'Brain', icon: 'brain-circuit', noun: 'version' }
};

/** Show or hide the leaf rows, the same toggle the libraries have. */
function vizToggleTreeItems() {
  const hidden = localStorage.getItem('vizHideItems') !== 'true';
  localStorage.setItem('vizHideItems', hidden);
  const body = document.getElementById('viz-content-body');
  if (body) body.classList.toggle('hide-tree-items', hidden);
  const btn = document.getElementById('viz-toggle-items-btn');
  if (btn) {
    btn.innerHTML = `<i data-lucide="${hidden ? 'eye-off' : 'eye'}" id="viz-toggle-items-icon"></i>`;
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: btn });
  }
}

function _vizChip(stat, icon, value, label, cls, title) {
  return `<div class="mini-stat-chip${cls ? ' ' + cls : ''}" data-stat="${stat}" title="${escapeHTML(title || label)}">
    <i data-lucide="${icon}" style="width:12px;height:12px;"></i>
    <span class="mini-stat-value">${value}</span>
    <span class="mini-stat-label">${label}</span>
  </div>`;
}

/**
 * @param {object} o .label .icon .subtitle .chips (HTML)
 */
function vizPaintHeader(o) {
  const title = document.getElementById('viz-content-scope-label');
  const sub = document.getElementById('viz-header-stats');
  const icon = document.getElementById('viz-header-icon');
  const stats = document.getElementById('viz-mini-stats');
  if (title) title.textContent = o.label;
  if (sub) sub.textContent = o.subtitle;
  // Rebuild rather than re-point: lucide keeps the old class, so switching
  // modules stacked lucide-file-code + lucide-code + lucide-book-open.
  if (icon && icon.dataset.shown !== o.icon) {
    const wrap = icon.parentElement;
    icon.remove();
    wrap.insertAdjacentHTML('afterbegin', `<i data-lucide="${o.icon}" id="viz-header-icon" data-shown="${o.icon}"></i>`);
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: wrap });
    const fresh = document.getElementById('viz-header-icon');
    if (fresh) fresh.dataset.shown = o.icon;
  }
  // Only rebuild when the numbers actually changed. This is called on every
  // sidebar render, so expanding a folder used to tear down and re-create the
  // stat chips — a visible blink of the whole row for no change at all.
  if (stats && stats.__chipSig !== o.chips) {
    stats.__chipSig = o.chips;
    stats.innerHTML = o.chips || '';
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: stats });
  }
}

/** Header for one of the library-backed modules. */
function vizUpdateHeaderStats() {
  const mod = viz.activeModule;
  const meta = VIZ_HEADER_META[mod] || VIZ_HEADER_META.general;
  const scopes = (mod === 'general') ? ['challenge', 'snippet', 'notebook'] : [mod];
  let items = 0, folders = 0, favs = 0;
  scopes.forEach(sc => {
    const list = (typeof getItemsForScope === 'function' ? getItemsForScope(sc) : []) || [];
    items += list.length;
    favs += list.filter(x => x && x.favorite).length;
    folders += (state.nodes || []).filter(n => n.type === 'folder' && n.scope === sc).length;
  });
  // Only THIS module's items that are on the canvas, counted once each — the
  // node list spans every module, so a raw count ran past the total.
  const ids = new Set();
  scopes.forEach(sc => {
    ((typeof getItemsForScope === 'function' ? getItemsForScope(sc) : []) || []).forEach(x => ids.add(x.id));
  });
  const placedIds = new Set();
  (viz.nodes || []).forEach(n => { if (n.dataId && ids.has(n.dataId)) placedIds.add(n.dataId); });
  const placed = placedIds.size;
  const pct = items > 0 ? Math.min(100, Math.round((placed / items) * 100)) : 0;

  // In General, "On canvas 100%" was a restatement of auto-populate, not a
  // statistic. What is worth counting there is the thing only General can do:
  // a link whose two ends live in different libraries.
  let lastChip;
  if (mod === 'general') {
    const scopeById = new Map((viz.nodes || []).map(n => [n.id, n.scope]));
    const cross = (viz.links || []).filter(l => {
      const a = scopeById.get(l.from), b = scopeById.get(l.to);
      return a && b && a !== b;
    }).length;
    lastChip = _vizChip('cross', 'link', cross, 'Cross-links', cross ? 'completed' : '',
      'Links joining two different libraries — drag a row onto a node to make one');
  } else {
    lastChip = `<div class="mini-stat-chip mini-progress-chip" data-stat="progress" title="${placed} of ${items} placed">
        <i data-lucide="trending-up" style="width:12px;height:12px;"></i>
        <span class="mini-bar-pct mini-stat-value">${pct}%</span>
        <div class="mini-bar"><div class="mini-bar-fill" style="width:${pct}%;"></div></div>
      </div>`;
  }

  vizPaintHeader({
    label: meta.label,
    icon: meta.icon,
    subtitle: mod === 'general'
      ? `${items} items in 3 libraries · ${folders} folders`
      : `${items} ${meta.noun}${items !== 1 ? 's' : ''} across ${folders} folder${folders !== 1 ? 's' : ''}`,
    chips:
      _vizChip('total', meta.icon, items, 'Total', '', `Total ${meta.noun}s`) +
      _vizChip('placed', 'git-branch', placed, 'On canvas', 'completed', 'Items already placed on this canvas') +
      _vizChip('fav', 'star', favs, 'Starred', '', 'Favourites in this module') +
      lastChip
  });
}

/**
 * The pane's search box. In Brain it filters the version list; everywhere else
 * it highlights canvas nodes as before. It used to sit above a list it had no
 * effect on.
 */
function vizPaneSearch(q) {
  if (viz.activeModule === 'brain') {
    if (typeof brainSearchSidebar === 'function') brainSearchSidebar(q);
    return;
  }
  // It filters the list AND highlights the canvas. It used to do only the
  // second, so typing into it left the 54 rows below completely untouched.
  viz.paneQuery = q || '';
  vizRenderContentPane();
  vizSearchNodes(q);
}

/** Brain's arrange menu. */
function brainToggleLayoutMenu() {
  const el = document.getElementById('brain-layout-popup');
  if (el) el.classList.toggle('hidden');
}

/** Brain's toolbar options only apply to Brain. */
function vizSyncModuleTools() {
  const tools = document.getElementById('brain-only-tools');
  const chip = document.getElementById('brain-saved-chip');
  const isBrain = viz.activeModule === 'brain';
  const depth = document.getElementById('viz-depth-btn');
  if (depth && depth.parentElement) depth.parentElement.classList.toggle('hidden', isBrain);
  const legend = document.getElementById('viz-scope-legend');
  if (legend) legend.classList.toggle('hidden', viz.activeModule !== 'general');
  if (tools) tools.classList.toggle('hidden', !isBrain);
  if (chip) chip.classList.toggle('hidden', !isBrain);
  const popup = document.getElementById('brain-layout-popup');
  if (popup && !isBrain) popup.classList.add('hidden');
  // Creating a version moved into the right-click menu; this keeps one visible
  // way in, so the feature is not discoverable only by guessing.
  const newBtn = document.getElementById('brain-new-btn');
  if (newBtn) newBtn.classList.toggle('hidden', !isBrain);
}
