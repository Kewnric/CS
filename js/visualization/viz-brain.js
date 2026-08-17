/* ============================================================
   VIZ-BRAIN.JS — The Versioned Comment Brain System
   ============================================================ */

const brain = {
  versions: [],
  folders: [],
  activeVersionId: null,
  nodes: [],
  links: [],
  pan: { x: 0, y: 0 },
  zoom: 1,
  selectedNodeId: null,
  linkingFrom: null,
  linkModeEnabled: false,
  draggingNode: null,
  dragOffset: { x: 0, y: 0 },
  isPanning: false,
  panStart: { x: 0, y: 0 },
  panStartOffset: { x: 0, y: 0 },
  contextPos: null,
  contextNodeId: null,
  contextLinkId: null,
  _ctxVersionId: null,
  _dragStartPos: null,
  _hasDragged: false,
  _undoStack: [],
  searchQuery: '',
  _highlightedIds: new Set(),
  _focusedParentId: null,
};

// (Removed BRAIN_STORAGE_KEY constant, using getBrainStorageKey() instead)

let _brainSaveFailed = false;

function brainSave() {
  try {
    localStorage.setItem(getBrainStorageKey(), JSON.stringify({
      versions: brain.versions,
      folders: brain.folders,
      activeVersionId: brain.activeVersionId,
      // Collapsing the pseudo-folder wrote brain.rootOpen and then never saved
      // it, so it sprang back open on every reload.
      rootOpen: brain.rootOpen !== false,
    }));
    _brainSaveFailed = false;
  } catch (e) {
    // A failed write here used to be a console warning and nothing else, so a
    // full quota looked exactly like a successful save while the work was lost.
    console.warn('[Brain] save failed', e);
    if (!_brainSaveFailed && typeof toast === 'function') {
      toast('Could not save the brain — browser storage is full. Export a backup before you lose work.',
        { type: 'error', duration: 12000 });
    }
    _brainSaveFailed = true;
    const chip = document.getElementById('brain-saved-chip');
    if (chip) {
      chip.dataset.label = 'Not saved';
      chip.classList.remove('is-empty');
      chip.innerHTML = '<i data-lucide="alert-triangle" style="width:11px;height:11px;"></i><span class="brain-saved-text">Not saved</span>';
      if (typeof lucide !== 'undefined') lucide.createIcons({ root: chip });
    }
    return;
  }
  if (typeof scheduleCloudSave === 'function') scheduleCloudSave();
}

function brainLoad() {
  const raw = localStorage.getItem(getBrainStorageKey());
  if (!raw) return;
  try {
    const d = JSON.parse(raw);
    brain.versions = d.versions || [];
    brain.folders = d.folders || [];
    brain.activeVersionId = d.activeVersionId || null;
    brain.rootOpen = d.rootOpen !== false;
  } catch (e) { console.warn('[Brain] load failed', e); }
}

function brainSaveCurrentVersion() {
  if (!brain.activeVersionId) return;
  const v = brain.versions.find(v => v.id === brain.activeVersionId);
  if (!v) return;
  v.nodes = JSON.parse(JSON.stringify(brain.nodes.map(n => {
    const { _resizeObserver, ...rest } = n;   // strip anything an older build left
    return rest;
  })));
  v.links = JSON.parse(JSON.stringify(brain.links));
  v.pan = { ...brain.pan };
  v.zoom = brain.zoom;
  brainSave();
  brainMarkSaved();
}

function brainSwitchVersion(id) {
  brainSaveCurrentVersion();
  brain._undoStack = [];
  const btn = document.getElementById('viz-undo-btn');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; }
  const v = brain.versions.find(v => v.id === id);
  if (!v) return;
  brain.activeVersionId = id;
  brain.nodes = JSON.parse(JSON.stringify(v.nodes || []));
  brain.links = JSON.parse(JSON.stringify(v.links || []));
  brain.pan = v.pan ? { ...v.pan } : { x: 0, y: 0 };
  brain.zoom = v.zoom || 1;
  brain.selectedNodeId = null;
  brain.linkingFrom = null;
  brain.linkModeEnabled = false;
  v.openedAt = Date.now();          // drives the "most recent first" order
  brainSave();
  brainClearObservers();
  brainStopSavedTicker();
  brainRenderSidebar();
  brainRenderCanvas();
  setTimeout(() => brainUpdateMinimap(), 50);
}

function brainCreateVersion(folderId) {
  showInputDialog('New Version', null, 'Version name', 'New Version', (name) => {
    const clean = (name || '').trim() || 'Untitled version';   // never a blank row
    const id = 'bv_' + generateId();
    brain.versions.push({ id, name: clean, folderId: folderId || null, nodes: [], links: [], pan: { x: 0, y: 0 }, zoom: 1 });
    brainSave();
    brainRenderSidebar();
    if (!brain.activeVersionId) brainSwitchVersion(id);
  });
}

function brainDeleteVersion(id) {
  const v = brain.versions.find(x => x.id === id);
  if (!v) return;
  const go = () => {
    // Keep the whole record and its position so Undo is exact. This was the
    // only destructive action in the app with no way back.
    const at = brain.versions.indexOf(v);
    const snapshot = JSON.parse(JSON.stringify(v));
    const wasActive = brain.activeVersionId === id;
    brain.versions = brain.versions.filter(x => x.id !== id);
    if (wasActive) {
      brain.activeVersionId = null;
      brain.nodes = []; brain.links = [];
      brain.pan = { x: 0, y: 0 }; brain.zoom = 1;
    }
    brainSave(); brainRenderSidebar(); brainRenderCanvas();
    if (typeof toast === 'function') {
      toast(`Deleted “${snapshot.name}”.`, {
        type: 'info', duration: 8000,
        action: { label: 'Undo', onClick: () => {
          brain.versions.splice(Math.min(at, brain.versions.length), 0, snapshot);
          brainSave();
          if (wasActive) brainSwitchVersion(snapshot.id); else brainRenderSidebar();
        } }
      });
    }
  };
  if (typeof showConfirm === 'function') {
    showConfirm('Delete version?', `Delete “${v.name}”? You can undo this from the toast that follows.`, go);
  } else { go(); }
}

function brainRenameVersion(id) {
  const v = brain.versions.find(v => v.id === id);
  if (!v) return;
  showInputDialog('Rename Version', null, 'Version name', v.name, (name) => {
    v.name = (name || '').trim() || v.name; brainSave(); brainRenderSidebar(); brainUpdateCanvasToolbar();
  });
}

function brainDuplicateVersion(id) {
  const src = brain.versions.find(v => v.id === id);
  if (!src) return;
  const newId = 'bv_' + generateId();
  // A second duplicate used to produce a second "(Copy)" with the same name.
  const base = src.name.replace(/\s*\(Copy(?: \d+)?\)$/, '');
  let name = base + ' (Copy)';
  for (let n = 2; brain.versions.some(v => v.name === name); n++) name = `${base} (Copy ${n})`;
  brain.versions.push({
    id: newId, name: name, folderId: src.folderId,
    nodes: JSON.parse(JSON.stringify(src.nodes || [])),
    links: JSON.parse(JSON.stringify(src.links || [])),
    pan: { ...src.pan }, zoom: src.zoom,
  });
  brainSave(); brainRenderSidebar();
}

function brainCreateFolder(parentId) {
  showInputDialog('New Folder', null, 'Folder name', 'New Folder', (name) => {
    const id = 'bf_' + generateId();
    brain.folders.push({ id, name: (name || '').trim() || 'Untitled folder', parentId: parentId || null, collapsed: false });
    brainSave(); brainRenderSidebar();
  });
}

function brainDeleteFolder(id) {
  const f = brain.folders.find(x => x.id === id);
  if (!f) return;
  const kids = brain.folders.filter(c => c.parentId === id).length +
               brain.versions.filter(v => v.folderId === id).length;
  const go = () => {
    const parent = f.parentId || null;
    // Child FOLDERS were left pointing at a folder that no longer exists, so
    // they and everything under them vanished from the tree for good. Both
    // kinds move up to the deleted folder's own parent.
    brain.folders.forEach(c => { if (c.parentId === id) c.parentId = parent; });
    brain.versions.forEach(v => { if (v.folderId === id) v.folderId = parent; });
    brain.folders = brain.folders.filter(x => x.id !== id);
    brainSave(); brainRenderSidebar();
  };
  const where = f.parentId ? 'the folder above' : 'the top level';
  if (typeof showConfirm === 'function') {
    showConfirm('Delete folder?',
      kids ? `Delete “${f.name}”? The ${kids} item${kids !== 1 ? 's' : ''} inside move to ${where}.`
           : `Delete “${f.name}”?`, go);
  } else { go(); }
}

function brainRenameFolder(id) {
  const f = brain.folders.find(f => f.id === id);
  if (!f) return;
  showInputDialog('Rename Folder', null, 'Folder name', f.name, (name) => {
    f.name = (name || '').trim() || f.name; brainSave(); brainRenderSidebar();
  });
}

/**
 * @param {string} id folder id, or '__root__' for the loose-versions row
 * @param {Event} [e] the chevron's click. The row and the chevron both toggle,
 *   so without stopping propagation here the two fired in turn and cancelled
 *   each other out — the folder never opened.
 */
function brainToggleFolder(id, e) {
  if (e) { e.stopPropagation(); e.preventDefault(); }
  let open;
  if (id === '__root__') {          // the loose-versions pseudo-folder
    brain.rootOpen = brain.rootOpen === false;
    open = brain.rootOpen;
  } else {
    const f = brain.folders.find(f => f.id === id);
    if (!f) return;
    f.collapsed = !f.collapsed;
    open = !f.collapsed;
  }
  brainSave();
  // Flip the classes on the rows that are already there. Re-rendering the pane
  // threw the .tree-children element away in the same frame, so the
  // grid-template-rows transition never got to run and the header's stat chips
  // were rebuilt on every toggle — a visible blink. This is what the library
  // trees do (see toggleBrowseExpand).
  if (!brainSetFolderOpen(id, open)) brainRenderSidebar();
}

/**
 * Apply an expanded/collapsed state to a folder row that is already on screen.
 * @returns {boolean} false when the row isn't rendered and a redraw is needed
 */
function brainSetFolderOpen(id, open) {
  const body = document.getElementById('viz-content-body');
  if (!body) return false;
  const sel = (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(id) : id;
  const nodeEl = body.querySelector(`.tree-node[data-node-id="${sel}"]`);
  if (!nodeEl) return false;
  const kids = nodeEl.querySelector(':scope > .tree-children');
  if (!kids) return false;
  const row = nodeEl.querySelector(':scope > .tree-node-row');
  const chev = row && row.querySelector('.tree-node-chevron');
  kids.classList.toggle('collapsed', !open);
  if (chev) chev.classList.toggle('expanded', open);
  // Toggling in place used to leave the accessible state stale.
  if (row && row.hasAttribute('aria-expanded')) row.setAttribute('aria-expanded', String(open));
  return true;
}

/* ── Sidebar ───────────────────────────────────────────────────
   Brain used to draw its own rows with a hand-rolled `depth * 14px` indent, so
   it had no drag-and-drop, no ARIA, no shared menu and looked nothing like the
   library trees. It is a tree host now (see registerTreeHost below) and gets
   all of that from tree-dnd.js — the only Brain-specific part is where the data
   comes from, which the host's `data` adapter supplies.

   Creating things lives in the right-click menu and one compact header button,
   not in three full-width buttons stacked above the list. */

function brainRenderSidebar() {
  if (typeof vizSyncModuleTools === 'function') vizSyncModuleTools();
  const body = document.getElementById('viz-content-body');
  const titleEl = document.getElementById('viz-content-scope-label');
  const breadcrumbEl = document.getElementById('viz-content-breadcrumb');
  if (!body) return;

  const active = brain.versions.find(v => v.id === brain.activeVersionId);
  const nodeCount = active ? (active.nodes || []).length : 0;
  const linkCount = active ? (active.links || []).length : 0;
  if (typeof vizPaintHeader === 'function') {
    vizPaintHeader({
      label: 'Brain',
      icon: 'brain-circuit',
      subtitle: `${brain.versions.length} version${brain.versions.length !== 1 ? 's' : ''} across ${brain.folders.length} folder${brain.folders.length !== 1 ? 's' : ''}`,
      chips:
        _vizChip('total', 'file-text', brain.versions.length, 'Versions', '', 'Saved brain versions') +
        _vizChip('folders', 'folder', brain.folders.length, 'Folders') +
        _vizChip('nodes', 'circle-dot', nodeCount, 'Nodes', 'completed', 'Nodes in the version you are viewing') +
        _vizChip('links', 'git-branch', linkCount, 'Links', '', 'Connections in the version you are viewing')
    });
  } else if (titleEl) {
    titleEl.textContent = 'Brain';
  }
  if (breadcrumbEl) breadcrumbEl.innerHTML = '<span class="viz-breadcrumb-item" style="cursor:default;color:var(--text-primary)">Versions</span>';

  // The search box filters the version list, not just canvas nodes — it sat
  // above a list it had no effect on.
  const q = (brain.sidebarQuery || '').trim().toLowerCase();
  const matches = (v) => !q || (v.name || '').toLowerCase().includes(q);
  const folderHasMatch = (fid) => brain.versions.some(v => v.folderId === fid && matches(v)) ||
    brain.folders.filter(f => f.parentId === fid).some(c => folderHasMatch(c.id));

  function versionRow(v, depth) {
    const isActive = v.id === brain.activeVersionId;
    const nodes = (v.nodes || []).length;
    const links = (v.links || []).length;
    const icon = v.locked ? 'lock' : (v.pinned ? 'pin' : 'file-text');
    return `
      <div class="tree-node tree-item-node" data-level="${depth}" data-node-id="${v.id}">
        <div class="tree-node-row ${isActive ? 'active' : ''}"
             ${treeRowAttrs({ ns: 'brain', id: v.id, kind: 'item', level: depth, selected: isActive })}
             style="padding-left: calc(0.75rem + ${TREE_ITEM_INSET}rem)"
             oncontextmenu="treeContextMenu(event, '${v.id}', 'brain')"
             title="${escapeHTML(brainVersionTooltip(v))}"
             onclick="brainSwitchVersion('${v.id}')">
          <i class="tree-node-chevron invisible"></i>
          <i data-lucide="${icon}" class="tree-node-icon item-icon-color" style="width:14px;height:14px;"></i>
          <span class="tree-node-label" style="font-weight:400; font-size:0.875rem;">${escapeHTML(v.name)}</span>
          <span class="brain-version-size" title="${nodes} node${nodes !== 1 ? 's' : ''}, ${links} link${links !== 1 ? 's' : ''}">${nodes}·${links}</span>
          ${isActive ? '<span class="brain-active-dot"></span>' : ''}
        </div>
      </div>`;
  }

  function render(parentId, depth) {
    let html = '';
    treeChildren(parentId, 'brain', 'brain').forEach(entry => {
      const n = entry.node;
      if (entry.kind === 'folder') {
        if (q && !folderHasMatch(n.id)) return;
        const open = !n.collapsed || !!q;
        // Everything underneath, not just direct children — the library badge
        // (countItemsRecursive) has always counted the whole subtree, so a
        // folder of folders read "0" here and non-zero there.
        const count = brainFolderCount(n.id);
        const hasKids = count > 0 || brain.folders.some(f => (f.parentId || null) === n.id);
        html += `
          <div class="tree-node" data-level="${depth}" data-node-id="${n.id}">
            <div class="tree-node-row"
                 ${treeRowAttrs({ ns: 'brain', id: n.id, kind: 'folder', level: depth, expanded: open })}
                 style="padding-left: calc(0.75rem + 0rem)"
                 oncontextmenu="treeContextMenu(event, '${n.id}', 'brain')"
                 onclick="brainToggleFolder('${n.id}')">
              <i data-lucide="chevron-right" class="tree-node-chevron ${hasKids ? (open ? 'expanded' : '') : 'invisible'}"
                 onclick="brainToggleFolder('${n.id}', event)"></i>
              <i data-lucide="folder" class="tree-node-icon folder-icon-color"></i>
              <span class="tree-node-label" ondblclick="event.stopPropagation();brainRenameFolder('${n.id}')">${escapeHTML(n.name)}</span>
              <span class="tree-node-badge">${count}</span>
            </div>
            <div class="tree-children ${open ? '' : 'collapsed'}" role="group">
              <div class="tree-children-inner">${render(n.id, depth + 1)}</div>
            </div>
          </div>`;
        return;
      }
      // A loose version belongs to the pseudo-folder below, not to the top
      // level as well — rendering both listed every one of them twice.
      if (depth === 0 && !parentId) return;
      if (!matches(n)) return;
      html += versionRow(n, depth + 1);
    });
    return html;
  }

  let html = render(null, 0);

  // Loose versions hang off a pseudo-folder, exactly like the libraries, so the
  // pane reads as a tree of folders even with none of your own. Right-click it
  // to switch it to your starred versions.
  //
  // It is drawn even when it holds nothing (the library does the same): it is
  // the drop target for "put this back at the top level" and the only way to
  // reach the Favourites cycle, and hiding it took both away exactly when you
  // had just dragged the last version out of it.
  const loose = brainRootVersions().filter(matches);
  if (!q || loose.length) {
    const meta = (typeof libRootMeta === 'function') ? libRootMeta('brain') : { label: 'Uncategorized', icon: 'inbox', hint: '' };
    const open = brain.rootOpen !== false;
    html += `
      <div class="tree-node" data-level="0" data-node-id="__root__">
        <div class="tree-node-row"
             ${treeRowAttrs({ ns: 'brain', id: '__root__', kind: 'folder', level: 0, expanded: open, draggable: false })}
             style="padding-left: calc(0.75rem + 0rem)"
             oncontextmenu="treeContextMenu(event, '__root__', 'brain')"
             onclick="brainToggleFolder('__root__')">
          <i data-lucide="chevron-right" class="tree-node-chevron ${loose.length ? (open ? 'expanded' : '') : 'invisible'}"
             onclick="brainToggleFolder('__root__', event)"></i>
          <i data-lucide="${meta.icon}" class="tree-node-icon item-icon-color"></i>
          <span class="tree-node-label" title="${escapeHTML(meta.hint)}">${meta.label}</span>
          <span class="tree-node-badge">${loose.length}</span>
        </div>
        <div class="tree-children ${open ? '' : 'collapsed'}" role="group">
          <div class="tree-children-inner">${loose.map(v => versionRow(v, 1)).join('')}</div>
        </div>
      </div>`;
  }

  if (!brain.versions.length && !brain.folders.length) {
    html = `<div class="viz-content-empty brain-empty">
      <i data-lucide="brain-circuit"></i>
      <p>No versions yet.</p>
      <button type="button" class="btn btn-primary btn-sm" onclick="brainCreateVersion(null)">
        <i data-lucide="plus" style="width:13px;height:13px;"></i> New version
      </button>
      <p class="brain-empty-hint">Right-click anywhere in this pane for folders and import.</p>
    </div>`;
  } else if (!html) {
    html = `<div class="viz-content-empty"><i data-lucide="search-x"></i><p>No version matches “${escapeHTML(brain.sidebarQuery || '')}”.</p></div>`;
  } else {
    html += treeRootDropHTML('brain');
  }

  body.dataset.treeNs = 'brain';
  body.setAttribute('role', 'tree');
  body.setAttribute('aria-label', 'Brain versions');
  body.classList.toggle('hide-tree-items', localStorage.getItem('vizHideItems') === 'true');
  body.setAttribute('oncontextmenu', "treePaneContextMenu(event, 'brain')");
  body.innerHTML = html;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: body });
}

/** Versions in a folder and every folder under it — the library's badge rule. */
function brainFolderCount(fid) {
  let n = brain.versions.filter(v => (v.folderId || null) === fid).length;
  brain.folders.filter(f => (f.parentId || null) === fid).forEach(f => { n += brainFolderCount(f.id); });
  return n;
}

/** What the pseudo-folder holds: loose versions, or your starred ones. */
function brainRootVersions() {
  const fav = (typeof libRootMode === 'function') && libRootMode('brain') === 'favorites';
  const list = fav ? brain.versions.filter(v => v.favorite) : brain.versions.filter(v => !v.folderId);
  // Pinned first, then most recently opened, then by name.
  return list.slice().sort(brainVersionSort);
}

function brainVersionSort(a, b) {
  if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
  // A version you dragged into place keeps that place. The drop writes `order`
  // through the host's setOrder, but nothing read it back, so reordering a
  // folder by hand appeared to do nothing at all — the list re-sorted itself by
  // last-opened the moment it redrew.
  if (typeof a.order === 'number' && typeof b.order === 'number' && a.order !== b.order) return a.order - b.order;
  const ao = a.openedAt || 0, bo = b.openedAt || 0;
  if (ao !== bo) return bo - ao;
  return (a.name || '').localeCompare(b.name || '');
}

function brainVersionTooltip(v) {
  const bits = [];
  if (v.pinned) bits.push('Pinned');
  if (v.locked) bits.push('Locked');
  if (v.openedAt) bits.push('Last opened ' + new Date(v.openedAt).toLocaleString());
  return bits.join(' · ') || v.name;
}

/* Brain keeps its versions and folders in its own store, so it supplies the
   accessors the engine would otherwise take from state.nodes. */
registerTreeHost('brain', {
  scope: 'brain',
  container: '#viz-content-body',
  selectNs: 'brain',
  rerender: () => brainRenderSidebar(),
  data: {
    folders: (parentId) => brain.folders.filter(f => (f.parentId || null) === (parentId || null))
      .slice().sort((a, b) => (a.order || 0) - (b.order || 0)),
    items: (parentId) => brain.versions.filter(v => (v.folderId || null) === (parentId || null))
      .slice().sort(brainVersionSort),
    find: (id) => {
      const f = brain.folders.find(x => x.id === id);
      if (f) return { kind: 'folder', node: f };
      const v = brain.versions.find(x => x.id === id);
      // The engine reads `parentId`; a version calls it folderId.
      if (v) return { kind: 'item', node: new Proxy(v, {
        get: (t, k) => k === 'parentId' ? (t.folderId || null) : t[k],
        set: (t, k, val) => { if (k === 'parentId') t.folderId = val; else t[k] = val; return true; }
      }) };
      return null;
    },
    setOrder: (parentId, ids) => {
      ids.forEach((id, i) => {
        const f = brain.folders.find(x => x.id === id);
        if (f) { f.order = i; f.parentId = parentId || null; return; }
        const v = brain.versions.find(x => x.id === id);
        if (v) { v.order = i; v.folderId = parentId || null; }
      });
      brainSave();
    }
  },
  // Brain lives in its own store, so the engine's saveData() would not persist
  // anything it changes (an undone move, a star from a drop onto Favourites).
  save: () => brainSave(),
  expand: (id) => {
    // In place: this fires mid-drag, and re-rendering the tree under the
    // pointer replaces the rows the drag is tracking.
    if (id === '__root__') {
      if (brain.rootOpen === false) { brain.rootOpen = true; brainSave(); if (!brainSetFolderOpen(id, true)) brainRenderSidebar(); }
      return;
    }
    const f = brain.folders.find(x => x.id === id);
    if (f && f.collapsed) { f.collapsed = false; brainSave(); if (!brainSetFolderOpen(id, true)) brainRenderSidebar(); }
  },
  isExpanded: (id) => {
    if (id === '__root__') return brain.rootOpen !== false;
    const f = brain.folders.find(x => x.id === id);
    return !!f && !f.collapsed;
  },
  toggle: (id) => brainToggleFolder(id),
  onRename: (id, kind) => (kind === 'folder' ? brainRenameFolder(id) : brainRenameVersion(id)),
  onNewSubfolder: (id) => brainCreateFolder(id),
  onDelete: (id, kind) => (kind === 'folder' ? brainDeleteFolder(id) : brainDeleteVersion(id)),
  acceptsDrop: (targetId) => (typeof libRootAcceptsDrop === 'function') && libRootAcceptsDrop('brain', targetId),
  onDropInto: (targetId, ids) => (typeof libRootDropInto === 'function') &&
    libRootDropInto('brain', targetId, ids, (id) => brain.versions.find(v => v.id === id)),
  // Right-click on the empty pane: this is where creating things lives now.
  paneActions: () => ([
    { icon: 'plus', label: 'New version', fn: () => brainCreateVersion(null) },
    { icon: 'folder-plus', label: 'New folder', fn: () => brainCreateFolder(null) },
    { icon: 'download', label: 'Import shared version…', fn: () => brainImportVersion() },
    { sep: true },
    { icon: 'chevrons-down-up', label: 'Collapse all folders', fn: () => brainCollapseAll(true) },
    { icon: 'chevrons-up-down', label: 'Expand all folders', fn: () => brainCollapseAll(false) }
  ]),
  extraActions: (id, kind) => {
    if (kind === 'folder') {
      return [{ icon: 'plus', label: 'New version here', fn: () => brainCreateVersion(id) }];
    }
    const v = brain.versions.find(x => x.id === id);
    if (!v) return [];
    return [
      { icon: 'copy', label: 'Duplicate', fn: () => brainDuplicateVersion(id) },
      { icon: v.pinned ? 'pin-off' : 'pin', label: v.pinned ? 'Unpin' : 'Pin to top', fn: () => brainTogglePin(id) },
      { icon: v.favorite ? 'star-off' : 'star', label: v.favorite ? 'Remove star' : 'Star', fn: () => brainToggleStar(id) },
      { icon: v.locked ? 'unlock' : 'lock', label: v.locked ? 'Unlock' : 'Lock (read-only)', fn: () => brainSetLocked(id, !v.locked) },
      { icon: 'git-compare', label: 'Compare with open version', fn: () => brainCompareVersions(id) },
      { icon: 'share-2', label: 'Share', fn: () => { brain._ctxVersionId = id; brainCtxVersionShare(); } }
    ];
  }
});

/** Filter the version list (see brainRenderSidebar). */
function brainSearchSidebar(q) {
  brain.sidebarQuery = q || '';
  brainRenderSidebar();
}

function brainCollapseAll(collapsed) {
  brain.folders.forEach(f => { f.collapsed = collapsed; });
  brain.rootOpen = !collapsed;
  brainSave();
  // Drive the rows that are already on screen so this animates like a single
  // toggle does, instead of the whole list blinking out and back.
  let painted = true;
  brain.folders.forEach(f => { if (!brainSetFolderOpen(f.id, !collapsed)) painted = false; });
  if (!brainSetFolderOpen('__root__', !collapsed)) painted = false;
  if (!painted) brainRenderSidebar();
}

function brainTogglePin(id) {
  const v = brain.versions.find(x => x.id === id);
  if (!v) return;
  v.pinned = !v.pinned;
  brainSave(); brainRenderSidebar();
}

function brainToggleStar(id) {
  const v = brain.versions.find(x => x.id === id);
  if (!v) return;
  v.favorite = !v.favorite;
  brainSave(); brainRenderSidebar();
}

function brainSetLocked(id, locked) {
  const v = brain.versions.find(x => x.id === id);
  if (!v) return;
  v.locked = locked;
  brainSave(); brainRenderSidebar();
  if (id === brain.activeVersionId) brainApplyOpts();
}

/**
 * What changed between two versions. A "versioned brain" with no way to see the
 * difference between two versions is just a list of files.
 */
function brainCompareVersions(id) {
  const other = brain.versions.find(v => v.id === id);
  const cur = brain.versions.find(v => v.id === brain.activeVersionId);
  if (!other) return;
  if (!cur || cur.id === other.id) {
    if (typeof showMessage === 'function') showMessage('Compare', 'Open a different version first, then compare against it.', true);
    return;
  }
  const text = n => (n.commentContent || n.title || n.id || '').trim();
  const a = new Map((cur.nodes || []).map(n => [text(n), n]));
  const b = new Map((other.nodes || []).map(n => [text(n), n]));
  const added = [...b.keys()].filter(k => k && !a.has(k));
  const removed = [...a.keys()].filter(k => k && !b.has(k));
  const list = (arr) => arr.length
    ? '<ul class="brain-diff-list">' + arr.slice(0, 12).map(t =>
      `<li>${escapeHTML(t.length > 70 ? t.slice(0, 70) + '…' : t)}</li>`).join('') +
      (arr.length > 12 ? `<li class="brain-diff-more">+${arr.length - 12} more</li>` : '') + '</ul>'
    : '<p class="brain-diff-none">None</p>';

  const html = `
    <div class="brain-diff">
      <div class="brain-diff-head">
        <span><strong>${escapeHTML(cur.name)}</strong> <em>(open)</em></span>
        <i data-lucide="arrow-right" style="width:14px;height:14px;"></i>
        <span><strong>${escapeHTML(other.name)}</strong></span>
      </div>
      <div class="brain-diff-counts">
        <span>${(cur.nodes || []).length} → ${(other.nodes || []).length} nodes</span>
        <span>${(cur.links || []).length} → ${(other.links || []).length} links</span>
      </div>
      <h4 class="brain-diff-title added">Only in “${escapeHTML(other.name)}” (${added.length})</h4>
      ${list(added)}
      <h4 class="brain-diff-title removed">Only in “${escapeHTML(cur.name)}” (${removed.length})</h4>
      ${list(removed)}
    </div>`;
  // showMessage writes with innerText, so this gets its own small surface
  // rather than printing markup at the user.
  const overlay = document.createElement('div');
  overlay.id = 'brain-diff-dlg';
  overlay.className = 'modal-overlay fd-overlay';
  overlay.innerHTML = `
    <div class="modal-content fd-box" role="dialog" aria-modal="true" aria-label="Compare versions">
      <h3 class="fd-title"><i data-lucide="git-compare"></i> Compare versions</h3>
      ${html}
      <div class="fd-actions"><button class="btn btn-secondary btn-sm" id="brain-diff-close">Close</button></div>
    </div>`;
  document.body.appendChild(overlay);
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: overlay });
  const close = () => overlay.remove();
  overlay.querySelector('#brain-diff-close').onclick = close;
  overlay.addEventListener('click', ev => { if (ev.target === overlay) close(); });
  document.addEventListener('keydown', function esc(ev) {
    if (ev.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });
}

function brainVersionCtx(e, id) {
  e.preventDefault(); e.stopPropagation();
  brain._ctxVersionId = id;
  const menu = document.getElementById('brain-version-ctx');
  if (!menu) return;
  if (typeof vizPositionMenu === 'function') vizPositionMenu(menu, e.clientX, e.clientY);
  else { menu.style.left = e.clientX + 'px'; menu.style.top = e.clientY + 'px'; menu.classList.remove('hidden'); }
}
function brainCtxVersionRename() { if (brain._ctxVersionId) brainRenameVersion(brain._ctxVersionId); brainHideAllMenus(); }
function brainCtxVersionDelete() { if (brain._ctxVersionId) brainDeleteVersion(brain._ctxVersionId); brainHideAllMenus(); }
function brainCtxVersionDuplicate() { if (brain._ctxVersionId) brainDuplicateVersion(brain._ctxVersionId); brainHideAllMenus(); }

function brainCtxVersionShare() {
  const v = brain.versions.find(v => v.id === brain._ctxVersionId);
  if (!v) return;
  brainHideAllMenus();
  const shareable = {
    _type: 'brain-version',
    name: v.name,
    nodes: v.nodes || [],
    links: v.links || [],
    pan: v.pan || { x: 0, y: 0 },
    zoom: v.zoom || 1
  };
  const encoded = encodeShareData(shareable);
  if (!encoded) {
    if (typeof showMessage === 'function') showMessage('Error', 'Failed to encode version for sharing.', true);
    return;
  }
  navigator.clipboard.writeText(encoded).then(() => {
    showShareToast('Brain version copied to clipboard!');
  }).catch(() => {
    prompt('Copy this share data:', encoded);
  });
}

function brainImportVersion() {
  showInputDialog('Import Brain Version', null, 'Paste shared data here', '', (pasted) => {
    if (!pasted || !pasted.trim()) return;
    const shared = decodeShareData(pasted.trim());
    if (!shared || shared._type !== 'brain-version') {
      if (typeof showMessage === 'function') showMessage('Error', 'Invalid brain version data.', true);
      return;
    }
    const id = 'bv_' + generateId();
    brain.versions.push({
      id,
      name: '[Shared] ' + (shared.name || 'Version'),
      folderId: null,
      nodes: shared.nodes || [],
      links: shared.links || [],
      pan: shared.pan || { x: 0, y: 0 },
      zoom: shared.zoom || 1
    });
    brainSave();
    brainSwitchVersion(id);
    if (typeof vizSwitchModule === 'function') vizSwitchModule('brain');
    showShareToast('Brain version imported!');
  });
}

function brainUpdateCanvasToolbar() {
  const el = document.getElementById('viz-canvas-toolbar-label');
  if (!el) return;
  const v = brain.versions.find(v => v.id === brain.activeVersionId);
  el.textContent = v ? 'Brain — ' + v.name : 'Brain Canvas';
}

function brainPushUndo() {
  brain._undoStack.push(JSON.stringify({ 
    nodes: JSON.parse(JSON.stringify(brain.nodes)), 
    links: JSON.parse(JSON.stringify(brain.links)) 
  }));
  if (brain._undoStack.length > 40) brain._undoStack.shift();
}

function brainUndo() {
  if (!brain._undoStack.length) return;
  const snap = JSON.parse(brain._undoStack.pop());
  brain.nodes = snap.nodes;
  brain.links = snap.links;
  brainRenderCanvas(); brainSaveCurrentVersion();
}

function brainZoomIn() { brain.zoom = Math.min(3, brain.zoom + 0.15); brainRenderCanvas(); brainSaveCurrentVersion(); }
function brainZoomOut() { brain.zoom = Math.max(0.2, brain.zoom - 0.15); brainRenderCanvas(); brainSaveCurrentVersion(); }
function brainZoomReset() { brain.zoom = 1; brain.pan = { x: 0, y: 0 }; brainCenterCanvas(); }
function brainUpdateZoomDisplay() {
  const el = document.getElementById('viz-zoom-level');
  if (el) el.textContent = Math.round(brain.zoom * 100) + '%';
}

function brainCenterCanvas() {
  const container = document.getElementById('viz-canvas-container');
  if (!container || brain.nodes.length === 0) { brainRenderCanvas(); return; }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  brain.nodes.forEach(n => {
    const w = n.w || 250, h = n.h || 80;
    minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x + w);
    minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y + h);
  });
  const pad = 100, cw = container.offsetWidth, ch = container.offsetHeight;
  const scaleX = cw / (maxX - minX + pad * 2), scaleY = ch / (maxY - minY + pad * 2);
  brain.zoom = Math.min(Math.max(Math.min(scaleX, scaleY, 1.2), 0.2), 3);
  brain.pan.x = cw / 2 - ((minX + (maxX - minX) / 2) * brain.zoom);
  brain.pan.y = ch / 2 - ((minY + (maxY - minY) / 2) * brain.zoom);
  brainRenderCanvas(); brainSaveCurrentVersion();
}

function brainUpdateMinimap() {
  const canvas = document.getElementById('viz-minimap-canvas');
  const container = document.getElementById('viz-canvas-container');
  const viewportEl = document.getElementById('viz-minimap-viewport');
  if (!canvas || !container) return;
  const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  if (brain.nodes.length === 0) return;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  brain.nodes.forEach(n => { minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x + (n.w || 250)); minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y + (n.h || 80)); });
  const pad = 40, wW = Math.max(maxX - minX + pad * 2, 1), wH = Math.max(maxY - minY + pad * 2, 1);
  const scale = Math.min(W / wW, H / wH), ox = (W - wW * scale) / 2 - (minX - pad) * scale, oy = (H - wH * scale) / 2 - (minY - pad) * scale;
  ctx.strokeStyle = 'rgba(148,163,184,0.25)'; ctx.lineWidth = 1;
  brain.links.forEach(l => {
    const fn = brain.nodes.find(n => n.id === l.from), tn = brain.nodes.find(n => n.id === l.to);
    if (!fn || !tn) return;
    ctx.beginPath(); ctx.moveTo(fn.x * scale + ox, fn.y * scale + oy); ctx.lineTo(tn.x * scale + ox, tn.y * scale + oy); ctx.stroke();
  });
  brain.nodes.forEach(n => {
    ctx.fillStyle = n.id === brain.selectedNodeId ? '#6366f1' : 'rgba(245,158,11,0.7)';
    ctx.globalAlpha = n.id === brain.selectedNodeId ? 1 : 0.7;
    ctx.beginPath(); ctx.roundRect(n.x * scale + ox, n.y * scale + oy, Math.max((n.w || 150) * scale, 4), Math.max((n.h || 48) * scale, 3), 2); ctx.fill();
    ctx.globalAlpha = 1;
  });
  const cW = container.offsetWidth, cH = container.offsetHeight;
  const vx = (-brain.pan.x / brain.zoom) * scale + ox, vy = (-brain.pan.y / brain.zoom) * scale + oy;
  const vw = (cW / brain.zoom) * scale, vh = (cH / brain.zoom) * scale;
  if (viewportEl) { viewportEl.style.left = Math.max(0, vx) + 'px'; viewportEl.style.top = Math.max(0, vy) + 'px'; viewportEl.style.width = Math.min(vw, W) + 'px'; viewportEl.style.height = Math.min(vh, H) + 'px'; }
}

function brainRenderCanvas() {
  const container = document.getElementById('viz-canvas-container');
  const svg = document.getElementById('viz-canvas-svg');
  const nodesLayer = document.getElementById('viz-nodes-layer');
  const emptyState = document.getElementById('viz-canvas-empty');
  if (!container || !nodesLayer) return;

  brainUpdateCanvasToolbar();

  if (!brain.activeVersionId) {
    if (emptyState) {
      emptyState.classList.remove('hidden');
      emptyState.querySelector('h3') && (emptyState.querySelector('h3').textContent = 'Brain Canvas');
      const p = emptyState.querySelector('p');
      if (p) p.textContent = 'Select or create a version from the left pane.';
    }
    nodesLayer.innerHTML = '';
    if (svg) svg.innerHTML = '';
    brainUpdateZoomDisplay();
    return;
  }
  if (emptyState) emptyState.classList.toggle('hidden', brain.nodes.length > 0);
  brainApplyOpts();

  nodesLayer.style.transform = `translate(${brain.pan.x}px, ${brain.pan.y}px) scale(${brain.zoom})`;
  if (svg) svg.style.transform = `translate(${brain.pan.x}px, ${brain.pan.y}px) scale(${brain.zoom})`;
  nodesLayer.innerHTML = '';
  const renderedNodeMap = new Map();

  const brainHiddenByCollapse = new Set();
  brain.nodes.forEach(n => {
    if (n.collapsed) {
      vizGetAllDescendants(n.id, brain.nodes, brain.links).forEach(d => brainHiddenByCollapse.add(d));
    }
  });
  const brainBridgeGhostIds = new Set();
  brain.links.filter(l => l.isBridge && l.bridgeSourceId).forEach(l => {
    const sourceNode = brain.nodes.find(n => n.id === l.bridgeSourceId);
    if (!sourceNode) return;
    if (!sourceNode.collapsed && !brainHiddenByCollapse.has(l.bridgeSourceId)) {
      const targetId = l.from === l.bridgeSourceId ? l.to : l.from;
      brainBridgeGhostIds.add(targetId);
    }
  });
  const brainFocusIds = new Set();
  if (brain._focusedParentId) {
    brainFocusIds.add(brain._focusedParentId);
    vizGetAllDescendants(brain._focusedParentId, brain.nodes, brain.links).forEach(d => brainFocusIds.add(d));
  }
  const brainVisibleNodes = brain.nodes.filter(n => !brainHiddenByCollapse.has(n.id));
  const brainVisibleIds = new Set(brainVisibleNodes.map(n => n.id));

  brainVisibleNodes.forEach(node => {
    const el = document.createElement('div');
    const isGlobe = viz.globeModeEnabled;
    const isGhost = brainBridgeGhostIds.has(node.id) || (brain._focusedParentId && !brainFocusIds.has(node.id));
    el.className = `viz-node ${node.id === brain.selectedNodeId ? 'selected' : ''}${isGlobe ? ' viz-globe-node' : ''}${isGhost ? ' viz-bridge-ghost' : ''}`;
    el.dataset.type = 'comment';
    if (node.color) el.dataset.color = node.color;
    el.style.left = node.x + 'px';
    el.style.top = node.y + 'px';
    el.dataset.nodeId = node.id;
    const isHighlighted = brain.searchQuery && brain._highlightedIds && brain._highlightedIds.has(node.id);
    const isDimmed = brain.searchQuery && brain._highlightedIds && !brain._highlightedIds.has(node.id);
    if (isHighlighted) el.classList.add('viz-search-match');
    if (isDimmed) el.classList.add('viz-search-dim');
    // Only a size you actually dragged is honoured. The observer below used to
    // write w/h on its very first callback — the initial layout pass — so every
    // note silently froze at whatever its first render produced.
    const styleW = (node.userSized && node.w) ? `width:${node.w}px;` : 'width:250px;';
    const styleH = (node.userSized && node.h) ? `height:${node.h}px;` : '';
    let brainCollapseBadge = '';
    if (node.collapsed) {
      const cnt = (node._collapsedChildren || []).length;
      brainCollapseBadge = `<span class="viz-collapse-badge" title="${cnt} hidden children">+${cnt}</span>`;
    }
    if (isGlobe) {
      const text = node.commentContent || '';
      const displayLabel = text.trim() ? (text.length > 30 ? text.substring(0, 30) + '...' : text) : 'Idea Node';
      el.innerHTML = `
        <div class="viz-globe-circle" title="${escapeHTML(displayLabel)}">
          <i data-lucide="brain"></i>
        </div>
        <div class="viz-globe-expand" style="${styleW}">
          <div class="viz-node-header" style="align-items: flex-start;">
            <i data-lucide="brain" style="margin-top: 2px;"></i>
            <span class="viz-node-title" style="white-space: normal; overflow: visible; word-break: break-word; max-height: none;">${escapeHTML(text || 'Double-click or right-click to edit...')}</span>
          </div>
          <div class="viz-node-subtitle" style="margin-top: 4px;">Comment</div>
        </div>
        ${brainCollapseBadge}
      `;
    } else {
      el.innerHTML = `<div class="viz-node-inner" style="${styleW}${styleH}">
        <div class="viz-comment-body">
          <div class="viz-comment-content">${escapeHTML(node.commentContent || 'Double-click or right-click to edit...')}</div>
        </div>
      </div>${brainCollapseBadge}`;
    }
    setTimeout(() => {
      const inner = el.querySelector('.viz-node-inner');
      if (!inner) return;
      // The observer is kept OFF the node. Storing it there meant it went
      // through brainSaveCurrentVersion's JSON round-trip, so it was written
      // into localStorage as an empty object and came back as one — and the
      // next render then called .disconnect() on a plain object and threw.
      const prev = _brainObservers.get(node.id);
      if (prev) prev.disconnect();                  // no per-render leak
      // ResizeObserver always fires once for the current size the moment it
      // starts observing. Treating that as a resize baked the first layout's
      // height into the note for good, and the text was then clipped as soon as
      // it grew. Only later firings are a real drag of the corner handle.
      let initial = true;
      const obs = new ResizeObserver(() => {
        if (initial) { initial = false; return; }
        if (inner.offsetWidth > 0) { node.w = inner.offsetWidth; node.h = inner.offsetHeight; node.userSized = true; }
      });
      obs.observe(inner);
      _brainObservers.set(node.id, obs);
    }, 0);
    if (!isGhost) {
      el.addEventListener('mousedown', (e) => brainNodeMouseDown(e, node.id));
      el.addEventListener('click', (e) => brainNodeClick(e, node.id));
      el.addEventListener('contextmenu', (e) => brainNodeCtx(e, node.id));
      el.addEventListener('mouseenter', () => { if (typeof vizHoverFocus === 'function') vizHoverFocus(node.id); });
      el.addEventListener('mouseleave', () => { if (typeof vizHoverClear === 'function') vizHoverClear(); });
      el.addEventListener('dblclick', (e) => { e.stopPropagation(); brainHideAllMenus(); brainOpenEditor(node); });
      ['top','right','bottom','left'].forEach(side => {
        const port = document.createElement('div');
        port.className = 'viz-port';
        port.dataset.side = side;
        port.dataset.nodeId = node.id;
        port.addEventListener('mousedown', (e) => {
          e.stopPropagation(); e.preventDefault();
          brainPortDragStart(e, node.id, side);
        });
        el.appendChild(port);
      });
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const lx = e.clientX - r.left, ly = e.clientY - r.top;
        const w = r.width, h = r.height;
        const dTop = ly, dBottom = h - ly, dLeft = lx, dRight = w - lx;
        const min = Math.min(dTop, dBottom, dLeft, dRight);
        el.dataset.nearSide = min === dTop ? 'top' : min === dBottom ? 'bottom' : min === dLeft ? 'left' : 'right';
      });
      el.addEventListener('mouseleave', () => { delete el.dataset.nearSide; });
    }
    nodesLayer.appendChild(el);
    renderedNodeMap.set(node.id, el);
  });

  let svgContent = '';
  brain.links.filter(l => brainVisibleIds.has(l.from) && brainVisibleIds.has(l.to)).forEach(link => {
    const fn = brain.nodes.find(n => n.id === link.from), tn = brain.nodes.find(n => n.id === link.to);
    if (!fn || !tn) return;
    const fEl = renderedNodeMap.get(link.from), tEl = renderedNodeMap.get(link.to);
    const fw = fEl ? fEl.offsetWidth : 250, fh = fEl ? fEl.offsetHeight : 80;
    const tw = tEl ? tEl.offsetWidth : 250, th = tEl ? tEl.offsetHeight : 80;
    const d = typeof vizBezierPath === 'function'
      ? vizBezierPath(fn.x, fn.y, fw, fh, tn.x, tn.y, tw, th, link.fromSide, link.toSide)
      : `M ${fn.x + fw/2} ${fn.y + fh/2} L ${tn.x + tw/2} ${tn.y + th/2}`;
    const lc = link.color ? `stroke:${vizColorMap(link.color)};` : '';
    const arrowId = link.color ? `viz-arrowhead-col-${link.color}` : 'viz-arrowhead-custom';
    const isBridgeGhost = link.isBridge && (brainBridgeGhostIds.has(link.from) || brainBridgeGhostIds.has(link.to));
    const isFocusGhost = brain._focusedParentId && (!brainFocusIds.has(link.from) || !brainFocusIds.has(link.to));
    const isGhostLink = isBridgeGhost || isFocusGhost;
    const ghostStyle = isGhostLink ? 'opacity:0.3;stroke-dasharray:6,4;' : '';
    svgContent += `<g class="viz-link-group${isGhostLink ? ' viz-bridge-ghost-link' : ''}" data-link-id="${link.id}" oncontextmenu="brainLinkCtx(event,'${link.id}')">
      <path class="viz-link-hitbox" d="${d}"/>
      <path class="viz-link custom-link" d="${d}" style="${lc}${ghostStyle}" marker-end="url(#${arrowId})"/>
    </g>`;
  });
  if (brain.linkingFrom) {
    const fn = brain.nodes.find(n => n.id === brain.linkingFrom);
    if (fn) {
      const fEl = renderedNodeMap.get(brain.linkingFrom);
      const fw = fEl ? fEl.offsetWidth : 250, fh = fEl ? fEl.offsetHeight : 80;
      const side = brain._portDragSide || brain._linkFromSide || 'right';
      const port = typeof vizPortCenter === 'function' ? vizPortCenter(fn.x, fn.y, fw, fh, side) : { x: fn.x + fw / 2, y: fn.y + fh / 2 };
      svgContent += `<path id="viz-temp-link" class="viz-link custom-link" d="M ${port.x} ${port.y} L ${port.x} ${port.y}" style="pointer-events:none;"/>`;
    }
  }
  const existingDefs = svg ? svg.querySelector('defs') : null;
  if (svg) { svg.innerHTML = svgContent; if (existingDefs) svg.insertBefore(existingDefs, svg.firstChild); }
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: container });
  brainUpdateZoomDisplay();
  brainUpdateMinimap();
  if (typeof vizForce !== 'undefined' && vizForce.enabled) vizForceWake();
}

function brainNodeClick(e, nodeId) {
  e.stopPropagation();
  // Color paint mode (shared with viz canvas)
  if (typeof viz !== 'undefined' && viz.colorModeEnabled) {
    const node = brain.nodes.find(n => n.id === nodeId);
    if (node) { node.color = viz.colorPaintColor || null; brainRenderCanvas(); brainSaveCurrentVersion(); }
    return;
  }
  if (brain.linkingFrom) {
    // Port drag completes via its own mouseup listener — skip if an actual drag is in progress
    if (brain._portDragging) return;
    if (brain.linkingFrom !== nodeId) {
      // Detect if the click was on a specific port circle
      const portEl = e.target.closest('.viz-port');
      brainPushUndo();
      const fromId = brain.linkingFrom;
      const fromSide = brain._linkFromSide || null;

      // Build the link with side info
      if (!brain.links.find(l =>
        (l.from === fromId && l.to === nodeId) ||
        (l.from === nodeId && l.to === fromId)
      )) {
        const fromNode = brain.nodes.find(n => n.id === fromId);
        const toNode   = brain.nodes.find(n => n.id === nodeId);
        const toFEl    = document.querySelector(`.viz-node[data-node-id="${nodeId}"]`);
        let toSide;

        if (portEl && portEl.dataset.side) {
          // Clicked directly on a port circle
          toSide = portEl.dataset.side;
        } else if (toFEl) {
          const rect = toFEl.getBoundingClientRect();
          const lx = e.clientX - rect.left, ly = e.clientY - rect.top;
          const w = rect.width, h = rect.height;
          const ef = 0.25;
          const inCX = lx > w * ef && lx < w * (1 - ef);
          const inCY = ly > h * ef && ly < h * (1 - ef);
          if (inCX && inCY) {
            // Center zone — auto from node centers
            const tw = toFEl.offsetWidth, th = toFEl.offsetHeight;
            const dx = (toNode.x + tw / 2) - (fromNode.x + tw / 2);
            const dy = (toNode.y + th / 2) - (fromNode.y + th / 2);
            toSide = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'left' : 'right') : (dy >= 0 ? 'top' : 'bottom');
          } else {
            const dTop = ly, dBottom = h - ly, dLeft = lx, dRight = w - lx;
            const minD = Math.min(dTop, dBottom, dLeft, dRight);
            toSide = minD === dTop ? 'top' : minD === dBottom ? 'bottom' : minD === dLeft ? 'left' : 'right';
          }
        } else {
          const tw = 250, th = 80;
          const dx = (toNode.x + tw / 2) - (fromNode.x + 125);
          const dy = (toNode.y + th / 2) - (fromNode.y + 40);
          toSide = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'left' : 'right') : (dy >= 0 ? 'top' : 'bottom');
        }

        const isBridge = (fromNode && fromNode.collapsed) || (toNode && toNode.collapsed);
        const bridgeSrc = isBridge ? (fromNode && fromNode.collapsed ? fromId : nodeId) : null;
        brain.links.push({
          id: 'bl_' + generateId(), from: fromId, to: nodeId,
          color: null, fromSide, toSide,
          isBridge: isBridge || false, bridgeSourceId: bridgeSrc
        });
        brainRenderCanvas(); brainSaveCurrentVersion();
      }
    }
    brain._linkFromSide = null;
    brainCancelLinking();
    return;
  }
  if (brain.linkModeEnabled) {
    // Port clicks are handled separately in brainPortDragStart
    if (!e.target.closest('.viz-port')) {
      brain._linkFromSide = null;
      brainStartLinking(nodeId);
    }
    return;
  }
  brain.selectedNodeId = nodeId;
  brainRenderCanvas();
}

function brainNodeMouseDown(e, nodeId) {
  if (e.button !== 0) return;
  e.stopPropagation();
  if (typeof viz !== 'undefined' && viz.colorModeEnabled) return;
  const node = brain.nodes.find(n => n.id === nodeId);
  if (!node) return;
  const inner = e.target.closest('.viz-node-inner');
  if (inner) {
    const rect = inner.getBoundingClientRect();
    if ((e.clientX - rect.left) / brain.zoom > inner.offsetWidth - 25 && (e.clientY - rect.top) / brain.zoom > inner.offsetHeight - 25) return;
  }
  const container = document.getElementById('viz-canvas-container');
  const rect = container ? container.getBoundingClientRect() : { left: 0, top: 0 };
  // Undo is pushed on the first actual MOVE, not here — pressing on a node to
  // select it used to bank a snapshot, so after clicking a few nodes Ctrl+Z
  // did nothing visible several times in a row before it reached a real edit.
  brain._undoArmed = true;
  brain.draggingNode = nodeId; brain._hasDragged = false; brain._dragStartPos = { x: e.clientX, y: e.clientY };
  brain.dragOffset.x = (e.clientX - rect.left - brain.pan.x) / brain.zoom - node.x;
  brain.dragOffset.y = (e.clientY - rect.top - brain.pan.y) / brain.zoom - node.y;
  document.addEventListener('mousemove', brainNodeDrag);
  document.addEventListener('mouseup', brainNodeDragEnd);
}

function brainNodeDrag(e) {
  if (brainIsLocked()) return;          // read-only version
  if (!brain.draggingNode) return;
  if (!brain._hasDragged) {
    if (brain._dragStartPos && Math.abs(e.clientX - brain._dragStartPos.x) < 3 && Math.abs(e.clientY - brain._dragStartPos.y) < 3) return;
    brain._hasDragged = true;
    if (brain._undoArmed) { brainPushUndo(); brain._undoArmed = false; }
    brain._prevDragPos = { x: e.clientX, y: e.clientY };
  }
  const node = brain.nodes.find(n => n.id === brain.draggingNode);
  if (!node) return;
  const container = document.getElementById('viz-canvas-container');
  const rect = container ? container.getBoundingClientRect() : { left: 0, top: 0 };
  const newX = (e.clientX - rect.left - brain.pan.x) / brain.zoom - brain.dragOffset.x;
  const newY = (e.clientY - rect.top - brain.pan.y) / brain.zoom - brain.dragOffset.y;

  if (viz.flowyDragEnabled && brain._prevDragPos) {
    const dx = (e.clientX - brain._prevDragPos.x) / brain.zoom;
    const dy = (e.clientY - brain._prevDragPos.y) / brain.zoom;
    brainFlowDragConnected(brain.draggingNode, dx, dy, new Set([brain.draggingNode]));
  }
  brain._prevDragPos = { x: e.clientX, y: e.clientY };

  node.x = newX;
  node.y = newY;
  const el = document.querySelector(`.viz-node[data-node-id="${node.id}"]`);
  if (el) { el.style.left = node.x + 'px'; el.style.top = node.y + 'px'; el.classList.add('dragging'); }
  brainUpdateSVGLinks();
}

function brainFlowDragConnected(nodeId, dx, dy, visited) {
  const connected = brain.links
    .filter(l => l.from === nodeId || l.to === nodeId)
    .map(l => l.from === nodeId ? l.to : l.from)
    .filter(id => !visited.has(id));
  connected.forEach(id => {
    visited.add(id);
    const n = brain.nodes.find(n => n.id === id);
    if (n) {
      n.x += dx; n.y += dy;
      const el = document.querySelector(`.viz-node[data-node-id="${id}"]`);
      if (el) { el.style.left = n.x + 'px'; el.style.top = n.y + 'px'; }
    }
    brainFlowDragConnected(id, dx, dy, visited);
  });
}

function brainUpdateSVGLinks() {
  const svg = document.getElementById('viz-canvas-svg');
  const nodesLayer = document.getElementById('viz-nodes-layer');
  if (!svg || !nodesLayer) return;
  brain.links.forEach(link => {
    const fn = brain.nodes.find(n => n.id === link.from);
    const tn = brain.nodes.find(n => n.id === link.to);
    if (!fn || !tn) return;
    const fEl = nodesLayer.querySelector(`[data-node-id="${link.from}"]`);
    const tEl = nodesLayer.querySelector(`[data-node-id="${link.to}"]`);
    const fw = fEl ? fEl.offsetWidth : 250, fh = fEl ? fEl.offsetHeight : 80;
    const tw = tEl ? tEl.offsetWidth : 250, th = tEl ? tEl.offsetHeight : 80;
    const d = typeof vizBezierPath === 'function'
      ? vizBezierPath(fn.x, fn.y, fw, fh, tn.x, tn.y, tw, th, link.fromSide, link.toSide)
      : `M ${fn.x + fw/2} ${fn.y + fh/2} L ${tn.x + tw/2} ${tn.y + th/2}`;
    const group = svg.querySelector(`g[data-link-id="${link.id}"]`);
    if (group) group.querySelectorAll('path').forEach(p => p.setAttribute('d', d));
  });
}

function brainNodeDragEnd() {
  // Keep the id: the snap block below read brain.draggingNode AFTER it had been
  // set to null, so the condition was never true and Snap to grid did nothing
  // at all — the toolbar toggle was decorative.
  const droppedId = brain.draggingNode;
  if (droppedId) { const el = document.querySelector(`.viz-node[data-node-id="${droppedId}"]`); if (el) el.classList.remove('dragging'); }
  brain.draggingNode = null;
  brain._prevDragPos = null;
  document.removeEventListener('mousemove', brainNodeDrag);
  document.removeEventListener('mouseup', brainNodeDragEnd);
  if (brain._hasDragged) {
    // Land on the grid the canvas draws, when snapping is on.
    if (brainOpts().snap && droppedId) {
      const n = brain.nodes.find(x => x.id === droppedId);
      if (n) { n.x = brainSnap(n.x); n.y = brainSnap(n.y); }
    }
    brainRenderCanvas(); brainSaveCurrentVersion();
  }
  brain._hasDragged = false;
  brain._undoArmed = false;
}

function brainCanvasMouseDown(e) {
  if (e.target.closest('.viz-node') || e.button !== 0) return;
  brain.isPanning = true;
  brain.panStart = { x: e.clientX, y: e.clientY };
  brain.panStartOffset = { ...brain.pan };
  const container = document.getElementById('viz-canvas-container');
  if (container) container.classList.add('panning');
}

function brainCanvasMouseMove(e) {
  if (brain.linkingFrom) {
    const tempLink = document.getElementById('viz-temp-link');
    const container = document.getElementById('viz-canvas-container');
    if (tempLink && container) {
      const rect = container.getBoundingClientRect();
      const mx = (e.clientX - rect.left - brain.pan.x) / brain.zoom;
      const my = (e.clientY - rect.top - brain.pan.y) / brain.zoom;
      const d = tempLink.getAttribute('d') || '';
      const m = d.match(/M (\S+) (\S+)/);
      if (m) {
        const fx = parseFloat(m[1]), fy = parseFloat(m[2]);
        const fromSide = brain._portDragSide || null;
        if (typeof vizTempLinkCP === 'function') {
          const cp = vizTempLinkCP(fx, fy, mx, my, fromSide);
          tempLink.setAttribute('d', `M ${fx} ${fy} C ${cp.c1x} ${cp.c1y}, ${cp.c2x} ${cp.c2y}, ${mx} ${my}`);
        } else {
          const bend = Math.min(Math.max(Math.abs(my - fy) * 0.5, 40), 180);
          tempLink.setAttribute('d', `M ${fx} ${fy} C ${fx} ${fy + bend}, ${mx} ${my - bend}, ${mx} ${my}`);
        }
      }
    }
  }
  if (!brain.isPanning) return;
  brain.pan.x = brain.panStartOffset.x + (e.clientX - brain.panStart.x);
  brain.pan.y = brain.panStartOffset.y + (e.clientY - brain.panStart.y);
  const nodesLayer = document.getElementById('viz-nodes-layer');
  const svg = document.getElementById('viz-canvas-svg');
  if (nodesLayer) nodesLayer.style.transform = `translate(${brain.pan.x}px, ${brain.pan.y}px) scale(${brain.zoom})`;
  if (svg) svg.style.transform = `translate(${brain.pan.x}px, ${brain.pan.y}px) scale(${brain.zoom})`;
  brainUpdateMinimap();
}

/**
 * Document-level: this runs for EVERY mouseup on the page while Brain is open,
 * not just ones on the canvas.
 *
 * It used to call brainSaveCurrentVersion() unconditionally, which repainted
 * the "Saved just now" chip in the canvas toolbar. That chip sits in the same
 * flex row as the Brain toolbar buttons, so rewriting it between mouseup and
 * click reflowed the row and the browser never dispatched the click at all —
 * which is why those buttons needed a second press to do anything. It also
 * meant a full deep-clone and localStorage write on every click anywhere.
 */
function brainCanvasMouseUp() {
  if (!brain.isPanning) return;
  brain.isPanning = false;
  const container = document.getElementById('viz-canvas-container');
  if (container) container.classList.remove('panning');
  const moved = brain.pan.x !== brain.panStartOffset.x || brain.pan.y !== brain.panStartOffset.y;
  if (moved) brainSaveCurrentVersion();
}

let _brainWheelSaveTimer = null;

function brainCanvasWheel(e) {
  e.preventDefault();
  const container = document.getElementById('viz-canvas-container');
  if (!container) return;
  const rect = container.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  const tx = (mx - brain.pan.x) / brain.zoom, ty = (my - brain.pan.y) / brain.zoom;
  const factor = e.deltaY > 0 ? 0.92 : 1.087;
  const newZoom = Math.min(3, Math.max(0.2, brain.zoom * factor));
  brain.pan.x = mx - tx * newZoom; brain.pan.y = my - ty * newZoom;
  brain.zoom = newZoom;
  // Transform-only (full re-render per wheel tick was rebuilding all nodes)
  const nodesLayer = document.getElementById('viz-nodes-layer');
  const svg = document.getElementById('viz-canvas-svg');
  const tf = `translate(${brain.pan.x}px, ${brain.pan.y}px) scale(${brain.zoom})`;
  if (nodesLayer) nodesLayer.style.transform = tf;
  if (svg) svg.style.transform = tf;
  brainUpdateZoomDisplay();
  brainUpdateMinimap();
  clearTimeout(_brainWheelSaveTimer);
  _brainWheelSaveTimer = setTimeout(() => brainSaveCurrentVersion(), 400);
}

function brainCanvasDblClick(e) {
  if (!brain.activeVersionId) return;
  if (e.target.closest('.viz-node') || e.target.closest('.viz-minimap')) return;
  const container = document.getElementById('viz-canvas-container');
  if (!container) return;
  const rect = container.getBoundingClientRect();
  const x = (e.clientX - rect.left - brain.pan.x) / brain.zoom;
  const y = (e.clientY - rect.top - brain.pan.y) / brain.zoom;
  brainAddCommentNode(x, y);
}

function brainCanvasCtx(e) {
  if (e.target.closest('.viz-node')) return;
  e.preventDefault();
  brainHideAllMenus();
  const menu = document.getElementById('brain-canvas-ctx');
  if (!menu) return;
  const container = document.getElementById('viz-canvas-container');
  const rect = container ? container.getBoundingClientRect() : { left: 0, top: 0 };
  brain.contextPos = { x: (e.clientX - rect.left - brain.pan.x) / brain.zoom, y: (e.clientY - rect.top - brain.pan.y) / brain.zoom };
  if (typeof vizPositionMenu === 'function') vizPositionMenu(menu, e.clientX, e.clientY);
  else { menu.style.left = e.clientX + 'px'; menu.style.top = e.clientY + 'px'; menu.classList.remove('hidden'); }
}

function brainAddCommentNode(x, y) {
  brainPushUndo();
  if (!brain.activeVersionId) {
    const id = 'bv_' + generateId();
    brain.versions.push({ id, name: 'Default Version', folderId: null, nodes: [], links: [], pan: { x: 0, y: 0 }, zoom: 1 });
    brain.activeVersionId = id;
    brainSave();
    brainRenderSidebar();
    brainUpdateCanvasToolbar();
  }

  const cx = x !== undefined ? x : ((-brain.pan.x / brain.zoom) + 200);
  const cy = y !== undefined ? y : ((-brain.pan.y / brain.zoom) + 200);
  const id = 'bn_' + generateId();
  const node = { id, commentContent: '', color: null, x: cx + (Math.random() - 0.5) * 40, y: cy + (Math.random() - 0.5) * 40 };
  brain.nodes.push(node);
  brain.selectedNodeId = id;
  brainRenderCanvas();
  brainOpenEditor(node);
}

function brainDeleteNode(nodeId) {
  brainPushUndo();
  brain.nodes = brain.nodes.filter(n => n.id !== nodeId);
  brain.links = brain.links.filter(l => l.from !== nodeId && l.to !== nodeId);
  if (brain.selectedNodeId === nodeId) brain.selectedNodeId = null;
  if (brain._focusedParentId) {
    const desc = vizGetAllDescendants(brain._focusedParentId, brain.nodes, brain.links);
    if (desc.size === 0) brain._focusedParentId = null;
  }
  brainRenderCanvas(); brainSaveCurrentVersion();
}

function brainOpenEditor(node) {
  if (typeof vizHoverClear === 'function') vizHoverClear();
  let overlay = document.getElementById('viz-comment-editor-overlay');
  if (overlay) overlay.remove();
  overlay = document.createElement('div');
  overlay.id = 'viz-comment-editor-overlay';
  overlay.className = 'viz-comment-editor-overlay';
  document.body.appendChild(overlay);
  overlay.innerHTML = `<div class="viz-comment-editor-window">
    <div class="viz-comment-editor-header">
      <i data-lucide="brain-circuit"></i>
      <span>Brain Note</span>
      <button class="viz-comment-editor-close" onclick="document.getElementById('viz-comment-editor-overlay').remove(); if(typeof vizHoverClear==='function')vizHoverClear();"><i data-lucide="x"></i></button>
    </div>
    <div class="viz-comment-editor-body">
      <textarea id="viz-comment-editor-textarea" class="viz-comment-editor-textarea" spellcheck="false" placeholder="Enter your idea...">${escapeHTML(node.commentContent || '')}</textarea>
    </div>
    <div class="viz-comment-editor-footer">
      <button class="btn btn-primary" id="viz-comment-editor-save">Save &amp; Close</button>
    </div>
  </div>`;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: overlay });
  document.getElementById('viz-comment-editor-save').onclick = () => {
    brainPushUndo();
    node.commentContent = document.getElementById('viz-comment-editor-textarea').value;
    brainRenderCanvas(); brainSaveCurrentVersion(); overlay.remove();
    if (typeof vizHoverClear === 'function') vizHoverClear();
  };
}

function brainAddLink(fromId, toId) {
  brainPushUndo();
  if (brain.links.find(l => (l.from === fromId && l.to === toId) || (l.from === toId && l.to === fromId))) return;
  const fromNode = brain.nodes.find(n => n.id === fromId);
  const toNode = brain.nodes.find(n => n.id === toId);
  const isBridge = (fromNode && fromNode.collapsed) || (toNode && toNode.collapsed);
  const bridgeSourceId = isBridge ? (fromNode && fromNode.collapsed ? fromId : toId) : null;
  brain.links.push({ id: 'bl_' + generateId(), from: fromId, to: toId, color: null, isBridge: isBridge || false, bridgeSourceId });
  brainRenderCanvas(); brainSaveCurrentVersion();
}

function brainDeleteLink(linkId) {
  brainPushUndo();
  brain.links = brain.links.filter(l => l.id !== linkId);
  brainRenderCanvas(); brainSaveCurrentVersion();
}

function brainStartLinking(nodeId) {
  brain.linkingFrom = nodeId;
  const container = document.getElementById('viz-canvas-container');
  if (container) container.classList.add('linking-mode');
  let hint = document.getElementById('viz-linking-hint');
  if (!hint) {
    hint = document.createElement('div'); hint.id = 'viz-linking-hint'; hint.className = 'viz-linking-hint';
    hint.innerHTML = '<i data-lucide="link"></i> Click another node to connect';
    container.appendChild(hint); if (typeof lucide !== 'undefined') lucide.createIcons({ root: hint });
  }
  hint.classList.remove('hidden');
  brainRenderCanvas();
}

function brainCancelLinking() {
  brain.linkingFrom = null;
  const container = document.getElementById('viz-canvas-container');
  if (container) container.classList.remove('linking-mode');
  const hint = document.getElementById('viz-linking-hint');
  if (hint) hint.classList.add('hidden');
  brainRenderCanvas();
}

function brainToggleLinkMode() {
  brain.linkModeEnabled = !brain.linkModeEnabled;

  // Mirror vizToggleLinkMode: turn off color paint mode when enabling link mode
  if (brain.linkModeEnabled && viz.colorModeEnabled) {
    viz.colorModeEnabled = false;
    const colorBtn = document.getElementById('viz-color-toggle-btn');
    if (colorBtn) { colorBtn.classList.remove('is-active'); colorBtn.style.color = ''; colorBtn.style.borderColor = ''; }
    const colorPopup = document.getElementById('viz-color-mode-popup');
    if (colorPopup) colorPopup.classList.add('hidden');
    const container = document.getElementById('viz-canvas-container');
    if (container) container.classList.remove('color-paint-mode');
  }

  if (!brain.linkModeEnabled && brain.linkingFrom) brainCancelLinking();

  const btn = document.getElementById('viz-link-toggle-btn');
  if (btn) {
    btn.classList.toggle('is-active', brain.linkModeEnabled);
    btn.style.color = '';
    btn.style.borderColor = '';
  }

  // Apply cursor hint on canvas container
  const container = document.getElementById('viz-canvas-container');
  if (container) container.classList.toggle('linking-mode', brain.linkModeEnabled);
}

function brainPortDragStart(e, nodeId, side) {
  e.stopPropagation(); e.preventDefault();

  // ---- Link-toggle mode: treat port mousedown as a click, not a drag ----
  if (brain.linkModeEnabled || brain.linkingFrom) {
    if (brain.linkingFrom) {
      // Already linking — complete to this specific port side
      if (brain._portDragging) return;
      if (brain.linkingFrom !== nodeId) {
        brainPushUndo();
        const fromId   = brain.linkingFrom;
        const fromSide = brain._linkFromSide || null;
        if (!brain.links.find(l =>
          (l.from === fromId && l.to === nodeId) ||
          (l.from === nodeId && l.to === fromId)
        )) {
          const fromNode = brain.nodes.find(n => n.id === fromId);
          const toNode   = brain.nodes.find(n => n.id === nodeId);
          const isBridge = (fromNode && fromNode.collapsed) || (toNode && toNode.collapsed);
          const bridgeSrc = isBridge ? (fromNode && fromNode.collapsed ? fromId : nodeId) : null;
          brain.links.push({
            id: 'bl_' + generateId(), from: fromId, to: nodeId,
            color: null, fromSide, toSide: side,
            isBridge: isBridge || false, bridgeSourceId: bridgeSrc
          });
          brainRenderCanvas(); brainSaveCurrentVersion();
        }
      }
      brain._linkFromSide = null;
      brainCancelLinking();
    } else {
      // Not yet linking — start from this specific port side
      brain._linkFromSide = side;
      brainStartLinking(nodeId);
    }
    return;
  }

  // ---- Normal drag-to-link mode ----
  brain._portDragging = true;
  brain.linkingFrom = nodeId;
  brain._portDragSide = side;
  const container = document.getElementById('viz-canvas-container');
  if (container) container.classList.add('linking-mode');
  brainRenderCanvas();

  function onUp(upEvent) {
    document.removeEventListener('mouseup', onUp, true);
    if (!brain.linkingFrom) return;
    const els = document.elementsFromPoint(upEvent.clientX, upEvent.clientY);
    const targetEl = els.find(el => el.dataset && el.dataset.nodeId && el.dataset.nodeId !== nodeId);
    const targetNodeId = targetEl ? targetEl.dataset.nodeId : null;
    if (targetNodeId && brain.nodes.find(n => n.id === targetNodeId)) {
      // Avoid duplicate links
      const exists = brain.links.find(l =>
        (l.from === nodeId && l.to === targetNodeId) ||
        (l.from === targetNodeId && l.to === nodeId)
      );
      if (!exists) {
        const fromNode = brain.nodes.find(n => n.id === nodeId);
        const toNode   = brain.nodes.find(n => n.id === targetNodeId);
        const toFEl    = toNode ? document.querySelector(`.viz-node[data-node-id="${targetNodeId}"]`) : null;

        // --- Determine toSide from where the cursor actually landed ---
        let toSide;

        // 1. Dropped directly on a port circle of the target node
        const portEl = els.find(el =>
          el.classList && el.classList.contains('viz-port') &&
          el.dataset.nodeId === targetNodeId &&
          el.dataset.side
        );

        if (portEl) {
          toSide = portEl.dataset.side;
        } else if (toFEl) {
          const rect = toFEl.getBoundingClientRect();
          const lx = upEvent.clientX - rect.left;
          const ly = upEvent.clientY - rect.top;
          const w = rect.width, h = rect.height;

          // 2. Dropped in the outer 25% edge zone → snap to nearest edge
          // 3. Dropped in the center 50% zone → auto center-to-center
          const edgeFraction = 0.25;
          const inCenterX = lx > w * edgeFraction && lx < w * (1 - edgeFraction);
          const inCenterY = ly > h * edgeFraction && ly < h * (1 - edgeFraction);

          if (inCenterX && inCenterY) {
            // Center zone — auto from node centers
            const tw = toFEl.offsetWidth, th = toFEl.offsetHeight;
            const dx = (toNode.x + tw / 2) - (fromNode.x + (toFEl.offsetWidth  / 2));
            const dy = (toNode.y + th / 2) - (fromNode.y + (toFEl.offsetHeight / 2));
            toSide = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'left' : 'right') : (dy >= 0 ? 'top' : 'bottom');
          } else {
            // Edge zone — nearest side
            const dTop = ly, dBottom = h - ly, dLeft = lx, dRight = w - lx;
            const minDist = Math.min(dTop, dBottom, dLeft, dRight);
            toSide = minDist === dTop    ? 'top'
                   : minDist === dBottom ? 'bottom'
                   : minDist === dLeft   ? 'left'
                   :                       'right';
          }
        } else {
          // Fallback — auto from node centers
          const tw = 250, th = 80;
          const dx = (toNode.x + tw / 2) - (fromNode.x + 125);
          const dy = (toNode.y + th / 2) - (fromNode.y + 40);
          toSide = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'left' : 'right') : (dy >= 0 ? 'top' : 'bottom');
        }

        const isBridge = (fromNode && fromNode.collapsed) || (toNode && toNode.collapsed);
        const bridgeSourceId = isBridge ? (fromNode && fromNode.collapsed ? nodeId : targetNodeId) : null;
        brain.links.push({ id: 'bl_' + generateId(), from: nodeId, to: targetNodeId, color: null, fromSide: side, toSide, isBridge: isBridge || false, bridgeSourceId });
        brainRenderCanvas(); brainSaveCurrentVersion();
      }
    }
    brain._portDragSide = null;
    brain._portDragging = false;
    brainCancelLinking();
  }
  document.addEventListener('mouseup', onUp, true);
}

function brainHideAllMenus() {
  document.querySelectorAll('.viz-context-menu, .viz-link-menu, #brain-canvas-ctx, #brain-node-ctx, #brain-link-ctx, #brain-version-ctx').forEach(m => m.classList.add('hidden'));
}

function brainNodeCtx(e, nodeId) {
  e.preventDefault(); e.stopPropagation();
  brainHideAllMenus();
  brain.contextNodeId = nodeId;
  const menu = document.getElementById('brain-node-ctx');
  if (!menu) return;
  const node = brain.nodes.find(n => n.id === nodeId);
  const collapseBtn = document.getElementById('brain-ctx-collapse-btn');
  const expandBtn = document.getElementById('brain-ctx-expand-btn');
  if (collapseBtn && expandBtn) {
    const hasChildren = brain.links.some(l => l.from === nodeId);
    if (node && node.collapsed) {
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
  if (typeof vizPositionMenu === 'function') vizPositionMenu(menu, e.clientX, e.clientY);
  else { menu.style.left = e.clientX + 'px'; menu.style.top = e.clientY + 'px'; menu.classList.remove('hidden'); }
  menu.querySelectorAll('.viz-color-swatch').forEach(sw => {
    sw.classList.toggle('active', sw.dataset.color === (node?.color || ''));
  });
}

function brainLinkCtx(e, linkId) {
  e.preventDefault(); e.stopPropagation();
  brainHideAllMenus();
  brain.contextLinkId = linkId;
  const menu = document.getElementById('brain-link-ctx');
  if (!menu) return;
  if (typeof vizPositionMenu === 'function') vizPositionMenu(menu, e.clientX, e.clientY);
  else { menu.style.left = e.clientX + 'px'; menu.style.top = e.clientY + 'px'; menu.classList.remove('hidden'); }
  const link = brain.links.find(l => l.id === linkId);
  menu.querySelectorAll('.viz-color-swatch').forEach(sw => { sw.classList.toggle('active', sw.dataset.color === (link?.color || '')); });
}

function brainCtxAddComment() {
  brainHideAllMenus();
  brainAddCommentNode(brain.contextPos?.x, brain.contextPos?.y);
}

function brainCtxEditComment() {
  if (!brain.contextNodeId) return;
  const node = brain.nodes.find(n => n.id === brain.contextNodeId);
  if (node) brainOpenEditor(node);
  brainHideAllMenus();
}

function brainCtxDeleteNode() {
  if (brain.contextNodeId) brainDeleteNode(brain.contextNodeId);
  brainHideAllMenus();
}

function brainCtxEditColor(color) {
  brainPushUndo();
  if (!brain.contextNodeId) return;
  const node = brain.nodes.find(n => n.id === brain.contextNodeId);
  if (node) { node.color = color; brainRenderCanvas(); brainSaveCurrentVersion(); }
  brainHideAllMenus();
}

function brainCtxDeleteLink() {
  if (brain.contextLinkId) brainDeleteLink(brain.contextLinkId);
  brainHideAllMenus();
}

function brainCtxEditLinkColor(color) {
  brainPushUndo();
  if (!brain.contextLinkId) return;
  const link = brain.links.find(l => l.id === brain.contextLinkId);
  if (link) { link.color = color; brainRenderCanvas(); brainSaveCurrentVersion(); }
  brainHideAllMenus();
}

function brainCtxCollapseChildren() {
  if (!brain.contextNodeId) { brainHideAllMenus(); return; }
  const node = brain.nodes.find(n => n.id === brain.contextNodeId);
  if (!node) { brainHideAllMenus(); return; }
  const descIds = vizGetAllDescendants(node.id, brain.nodes, brain.links);
  if (descIds.size === 0) { brainHideAllMenus(); return; }
  brainPushUndo();
  node._collapsedChildren = [];
  descIds.forEach(cid => {
    const child = brain.nodes.find(n => n.id === cid);
    if (child) node._collapsedChildren.push({ id: cid, dx: child.x - node.x, dy: child.y - node.y });
  });
  node.collapsed = true;
  brain._focusedParentId = null;
  brainRenderCanvas();
  brainSaveCurrentVersion();
  brainHideAllMenus();
}

function brainCtxExpandChildren() {
  if (!brain.contextNodeId) { brainHideAllMenus(); return; }
  const node = brain.nodes.find(n => n.id === brain.contextNodeId);
  if (!node || !node.collapsed) { brainHideAllMenus(); return; }
  brainPushUndo();
  const descIds = vizGetAllDescendants(node.id, brain.nodes, brain.links);
  if (node._collapsedChildren) {
    node._collapsedChildren.forEach(snap => {
      const child = brain.nodes.find(n => n.id === snap.id);
      if (child) { child.x = node.x + snap.dx; child.y = node.y + snap.dy; }
    });
  }
  const restoredBoxes = [];
  descIds.forEach(cid => {
    const c = brain.nodes.find(n => n.id === cid);
    if (c) restoredBoxes.push({ x: c.x, y: c.y, w: c.w || 250, h: c.h || 80 });
  });
  if (restoredBoxes.length > 0) {
    const pad = 20;
    const envX = Math.min(...restoredBoxes.map(b => b.x)) - pad;
    const envY = Math.min(...restoredBoxes.map(b => b.y)) - pad;
    const envR = Math.max(...restoredBoxes.map(b => b.x + b.w)) + pad;
    const envB = Math.max(...restoredBoxes.map(b => b.y + b.h)) + pad;
    brain.nodes.forEach(n => {
      if (n.id === node.id || descIds.has(n.id)) return;
      const nw = n.w || 250, nh = n.h || 80;
      const nx2 = n.x + nw, ny2 = n.y + nh;
      if (n.x < envR && nx2 > envX && n.y < envB && ny2 > envY) {
        n.y = envB + 30;
      }
    });
  }
  node.collapsed = false;
  delete node._collapsedChildren;
  brain._focusedParentId = node.id;
  brainRenderCanvas();
  brainSaveCurrentVersion();
  brainHideAllMenus();
}

function brainCtxStartLink() {
  if (brain.contextNodeId) brainStartLinking(brain.contextNodeId);
  brainHideAllMenus();
}

/* (An older brainAutoLayout lived here. It was shadowed by the one further down
   — same name, later declaration — so it had not run since the arrange menu
   was added. Removed rather than left to look live.) */

function brainSearchNodes(query) {
  brain.searchQuery = (query || '').toLowerCase().trim();
  brain._highlightedIds = new Set();
  if (brain.searchQuery) {
    brain.nodes.forEach(n => { if ((n.commentContent || '').toLowerCase().includes(brain.searchQuery)) brain._highlightedIds.add(n.id); });
  }
  brainRenderCanvas();
}

function brainClearSearch() {
  const inp = document.getElementById('viz-search-input');
  if (inp) inp.value = '';
  brainSearchNodes('');
}

function initBrain() {
  brainLoad();
  // The pane's search box is shared with the other modules and comes back
  // empty; the version filter did not, so the list stayed filtered by a word
  // that was no longer written anywhere.
  brain.sidebarQuery = '';
  const inp = document.getElementById('viz-search-input');
  if (inp) inp.value = '';
  // Without this the option buttons showed their defaults rather than what is
  // stored, so the first press of one looked like it had done nothing.
  brainApplyOpts();
  if (brain.activeVersionId) {
    const v = brain.versions.find(v => v.id === brain.activeVersionId);
    if (v) {
      brain.nodes = JSON.parse(JSON.stringify(v.nodes || []));
      brain.links = JSON.parse(JSON.stringify(v.links || []));
      brain.pan = v.pan ? { ...v.pan } : { x: 0, y: 0 };
      brain.zoom = v.zoom || 1;
    } else { brain.activeVersionId = null; }
  }
  brainRenderSidebar();
  brainRenderCanvas();
  brainPaintSaved();   // build the chip now so its width is settled before use
  setTimeout(() => { if (brain.nodes.length > 0) brainCenterCanvas(); else brainUpdateMinimap(); }, 50);
}

/* ============================================================
   BRAIN — canvas options
   ------------------------------------------------------------
   Everything here is a per-user preference rather than part of a
   version, so it lives in localStorage and applies to whichever
   map you open. The grid was already drawn on the canvas but
   nothing snapped to it; the minimap could not be dismissed; and
   a map you only wanted to READ was one stray drag away from
   being rearranged.
   ============================================================ */

/* Live ResizeObservers, keyed by node id — never stored on the node itself. */
const _brainObservers = new Map();

function brainClearObservers() {
  _brainObservers.forEach(o => { try { o.disconnect(); } catch (e) { /* gone */ } });
  _brainObservers.clear();
}

const BRAIN_GRID = 24;                 // matches .viz-canvas-container's grid
const BRAIN_OPT_KEY = 'brainCanvasOpts';

function brainOpts() {
  try {
    const raw = JSON.parse(localStorage.getItem(BRAIN_OPT_KEY));
    return Object.assign({ snap: false, links: true, minimap: true }, raw || {});
  } catch (e) {
    return { snap: false, links: true, minimap: true };
  }
}

function brainSetOpt(key, value) {
  const o = brainOpts();
  o[key] = value;
  try { localStorage.setItem(BRAIN_OPT_KEY, JSON.stringify(o)); } catch (e) { /* quota */ }
  brainApplyOpts();
}

function brainToggleOpt(key) { brainSetOpt(key, !brainOpts()[key]); }

/** Round a coordinate onto the grid the canvas already draws. */
function brainSnap(v) {
  return brainOpts().snap ? Math.round(v / BRAIN_GRID) * BRAIN_GRID : v;
}

/** Is the version you are looking at read-only? */
function brainIsLocked() {
  const v = brain.versions.find(x => x.id === brain.activeVersionId);
  return !!(v && v.locked);
}

function brainToggleLock() {
  const v = brain.versions.find(x => x.id === brain.activeVersionId);
  if (!v) {
    // Pressing this with nothing open used to be completely silent.
    if (typeof toast === 'function') toast('Open a version first.', { type: 'info' });
    return;
  }
  v.locked = !v.locked;
  brainSave();
  brainRenderSidebar();
  brainApplyOpts();
  if (typeof toast === 'function') {
    toast(v.locked ? `“${v.name}” is locked — nodes can't be moved.` : `“${v.name}” unlocked.`, { type: 'info' });
  }
}

/** Push the current options onto the DOM. */
function brainApplyOpts() {
  const o = brainOpts();
  const container = document.getElementById('viz-canvas-container');
  if (container) {
    container.classList.toggle('brain-hide-links', !o.links);
    container.classList.toggle('brain-locked', brainIsLocked());
  }
  const mini = document.getElementById('viz-minimap');
  if (mini) mini.classList.toggle('hidden', !o.minimap);
  [['brain-snap-btn', o.snap], ['brain-links-btn', o.links],
   ['brain-minimap-btn', o.minimap], ['brain-lock-btn', brainIsLocked()]
  ].forEach(([id, on]) => {
    const b = document.getElementById(id);
    if (b) b.classList.toggle('active', !!on);
  });
}

/* ── Auto-layout ───────────────────────────────────────────────
   Placing every node by hand is the main cost of using this canvas. These are
   one-shot arrangements, undoable like any other edit. */

function brainAutoLayout(kind) {
  if (!brain.activeVersionId) return;
  if (brainIsLocked()) {
    if (typeof toast === 'function') toast('This version is locked.', { type: 'warning' });
    return;
  }
  const nodes = brain.nodes;
  if (!nodes.length) return;
  brainPushUndo();

  if (kind === 'grid') {
    const cols = Math.ceil(Math.sqrt(nodes.length));
    nodes.forEach((n, i) => {
      n.x = (i % cols) * 260;
      n.y = Math.floor(i / cols) * 170;
    });
  } else if (kind === 'radial') {
    const cx = 0, cy = 0;
    const r = Math.max(240, nodes.length * 34);
    nodes.forEach((n, i) => {
      const a = (i / nodes.length) * Math.PI * 2;
      n.x = cx + Math.cos(a) * r;
      n.y = cy + Math.sin(a) * r;
    });
  } else {
    // 'tree': lay each connected component out in depth bands, so a map built
    // by linking one node to the next reads top-to-bottom.
    const children = new Map();
    const indeg = new Map();
    nodes.forEach(n => { children.set(n.id, []); indeg.set(n.id, 0); });
    brain.links.forEach(l => {
      if (!children.has(l.from) || !indeg.has(l.to)) return;
      children.get(l.from).push(l.to);
      indeg.set(l.to, indeg.get(l.to) + 1);
    });
    const roots = nodes.filter(n => indeg.get(n.id) === 0);
    const seen = new Set();
    let col = 0;
    const place = (id, depth) => {
      if (seen.has(id)) return;
      seen.add(id);
      const n = nodes.find(x => x.id === id);
      if (n) { n.x = col * 240; n.y = depth * 150; col++; }
      children.get(id).forEach(c => place(c, depth + 1));
    };
    (roots.length ? roots : [nodes[0]]).forEach(r => place(r.id, 0));
    nodes.forEach(n => { if (!seen.has(n.id)) { n.x = col * 240; n.y = 0; col++; } });
  }

  if (brainOpts().snap) nodes.forEach(n => { n.x = brainSnap(n.x); n.y = brainSnap(n.y); });
  brainRenderCanvas();
  brainSaveCurrentVersion();
  brainCenterCanvas();
  if (typeof toast === 'function') toast('Nodes arranged.', { type: 'success' });
}

/* ── "Saved" indicator ─────────────────────────────────────────
   Every drag, zoom and pan writes to storage, but nothing said so — there was
   no way to tell a saved map from an unsaved one. */

let _brainSavedAt = 0;
let _brainSavedTick = null;

function brainMarkSaved() {
  if (_brainSaveFailed) return;
  _brainSavedAt = Date.now();
  brainPaintSaved();
  if (!_brainSavedTick) _brainSavedTick = setInterval(brainPaintSaved, 5000);
}

/**
 * Only the words change. Rebuilding the chip's innerHTML on every tick threw
 * away and re-created the icon, which relaid out the whole toolbar row — see
 * brainCanvasMouseUp for what that cost. The chip also reserves its width in
 * CSS so going from empty to "Saved just now" cannot shift the buttons beside
 * it either.
 */
function brainPaintSaved() {
  const el = document.getElementById('brain-saved-chip');
  if (!el) return;
  const label = _brainSavedAt ? (() => {
    const secs = Math.round((Date.now() - _brainSavedAt) / 1000);
    return 'Saved ' + (secs < 5 ? 'just now' : secs < 60 ? secs + 's ago' : Math.round(secs / 60) + 'm ago');
  })() : '';
  if (el.dataset.label === label) return;
  el.dataset.label = label;
  if (!el.querySelector('.brain-saved-text')) {
    el.innerHTML = '<i data-lucide="cloud-check" style="width:11px;height:11px;"></i><span class="brain-saved-text"></span>';
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: el });
  }
  el.classList.toggle('is-empty', !label);
  const span = el.querySelector('.brain-saved-text');
  if (span) span.textContent = label;
}

function brainStopSavedTicker() {
  if (_brainSavedTick) { clearInterval(_brainSavedTick); _brainSavedTick = null; }
  _brainSavedAt = 0;
  brainPaintSaved();   // the chip kept the previous version's "Saved 4m ago"
}
