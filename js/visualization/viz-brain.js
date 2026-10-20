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
    // Snapshotted before the move so Undo can put the folder back and return
    // everything that was inside it, the way brainDeleteVersion does.
    const at = brain.folders.indexOf(f);
    const snapshot = JSON.parse(JSON.stringify(f));
    const movedFolders = brain.folders.filter(c => c.parentId === id).map(c => c.id);
    const movedVersions = brain.versions.filter(v => v.folderId === id).map(v => v.id);
    // Child FOLDERS were left pointing at a folder that no longer exists, so
    // they and everything under them vanished from the tree for good. Both
    // kinds move up to the deleted folder's own parent.
    brain.folders.forEach(c => { if (c.parentId === id) c.parentId = parent; });
    brain.versions.forEach(v => { if (v.folderId === id) v.folderId = parent; });
    brain.folders = brain.folders.filter(x => x.id !== id);
    brainSave(); brainRenderSidebar();
    if (typeof toast === 'function') {
      toast('Deleted \u201c' + snapshot.name + '\u201d.', {
        type: 'info', duration: 8000,
        action: { label: 'Undo', onClick: () => {
          brain.folders.splice(Math.min(at, brain.folders.length), 0, snapshot);
          movedFolders.forEach(cid => {
            const c = brain.folders.find(x => x.id === cid);
            if (c) c.parentId = id;
          });
          movedVersions.forEach(vid => {
            const v = brain.versions.find(x => x.id === vid);
            if (v) v.folderId = id;
          });
          brainSave(); brainRenderSidebar();
        } }
      });
    }
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
  // The path to the open version's folder, or nothing at all. It used to be the
  // fixed word "Versions", which said nothing and could not be clicked.
  if (breadcrumbEl) brainPaintBreadcrumb(breadcrumbEl, active);

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
  /* This writes the container directly rather than through treeCommit, so the
     shared markup cache has to be told — otherwise the library pane's next
     render matches a cached string, skips its write, and Brain's list stays on
     screen under the library's own header. */
  if (typeof treeSyncMarkup === 'function') treeSyncMarkup(body, html);
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: body });
}

/** Open a brain folder and scroll its row into view. */
function brainRevealFolder(id) {
  const f = brain.folders.find(x => x.id === id);
  if (!f) return;
  if (f.collapsed) { f.collapsed = false; brainSave(); }
  if (!brainSetFolderOpen(id, true)) brainRenderSidebar();
  const row = document.querySelector('#viz-content-body .tree-node[data-node-id="' + id + '"] .tree-node-row');
  if (row) {
    row.scrollIntoView({ block: 'nearest', behavior: vizPrefersReducedMotion() ? 'auto' : 'smooth' });
    row.classList.add('viz-reveal-flash');
    setTimeout(() => row.classList.remove('viz-reveal-flash'), 1200);
  }
}

/** Where the open version lives, as a clickable path. */
function brainPaintBreadcrumb(el, active) {
  if (!active || !active.folderId) { el.classList.add('hidden'); el.innerHTML = ''; return; }
  const chain = [];
  let cur = brain.folders.find(f => f.id === active.folderId), guard = 0;
  while (cur && guard++ < 60) {
    chain.unshift(cur);
    cur = cur.parentId ? brain.folders.find(f => f.id === cur.parentId) : null;
  }
  if (!chain.length) { el.classList.add('hidden'); el.innerHTML = ''; return; }
  const sep = '<span class="viz-crumb-sep" aria-hidden="true">/</span>';
  el.classList.remove('hidden');
  el.setAttribute('aria-label', 'Folder path');
  el.innerHTML = '<button type="button" class="viz-breadcrumb-item" onclick="brainCollapseAll(false)" title="All versions">Brain</button>'
    + chain.map((f, i) => sep + '<button type="button" class="viz-breadcrumb-item"'
      + (i === chain.length - 1 ? ' aria-current="true"' : '')
      + ' onclick="brainRevealFolder(&quot;' + f.id + '&quot;)" title="' + escapeHTML(f.name) + '">'
      + escapeHTML(f.name) + '</button>').join('');
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
  // A folder's menu opens with what you make in it: a canvas, then a folder.
  leadActions: (id, kind) => kind !== 'folder' ? [] : [
    { icon: 'plus', label: 'New Canvas', fn: () => brainCreateVersion(id) },
    { icon: 'folder-plus', label: 'New subfolder', subfolder: true, fn: () => brainCreateFolder(id) }
  ],
  extraActions: (id, kind) => {
    if (kind === 'folder') return [];
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
  const v = brain.versions.find(v => v.id === brain.activeVersionId);
  vizSetCanvasTitle('Brain', v ? v.name : 'No version open', 'brain-circuit');
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

/* ── Brain's camera, through the shared one ───────────────────
   These were a second copy of the viz camera with a different zoom floor
   (0.2 vs 0.04) and no easing, so Fit here could not fit a large map either
   and every jump was a cut. They call the shared helpers now. */
function brainZoomIn() { vizZoomBy(1.2); }
function brainZoomOut() { vizZoomBy(1 / 1.2); }
function brainZoomReset() { brainCenterCanvas(); }

function brainUpdateZoomDisplay() {
  const el = document.getElementById('viz-zoom-level');
  if (el) el.textContent = Math.round(brain.zoom * 100) + '%';
}

function brainCenterCanvas(instant) {
  const container = document.getElementById('viz-canvas-container');
  const g = vizVisibleGraph();
  if (!container || !g.nodes.length) { brainRenderCanvas(); return; }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  g.nodes.forEach(n => {
    const w = n.w || 250, h = n.h || 80;
    minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x + w);
    minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y + h);
  });
  const pad = 90, cw = container.offsetWidth, ch = container.offsetHeight;
  const zoom = vizClampZoom(Math.min(cw / (maxX - minX + pad * 2), ch / (maxY - minY + pad * 2), 1.2));
  const pan = {
    x: cw / 2 - ((minX + (maxX - minX) / 2) * zoom),
    y: ch / 2 - ((minY + (maxY - minY) / 2) * zoom)
  };
  if (instant) { brain.pan = pan; brain.zoom = zoom; vizApplyTransform(); brainUpdateZoomDisplay(); }
  else vizTweenView(pan, zoom);
  brainSaveCurrentVersion();
}

function brainUpdateMinimap() {
  const canvas = document.getElementById('viz-minimap-canvas');
  const container = document.getElementById('viz-canvas-container');
  const viewportEl = document.getElementById('viz-minimap-viewport');
  if (!canvas || !container) return;
  const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  // Collapsed subtrees are not on screen, so they are not on the map either.
  const g = vizVisibleGraph();
  if (!g.nodes.length) { if (viewportEl) viewportEl.style.display = 'none'; return; }
  if (viewportEl) viewportEl.style.display = '';
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  g.nodes.forEach(n => { minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x + (n.w || 250)); minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y + (n.h || 80)); });
  const pad = 40, wW = Math.max(maxX - minX + pad * 2, 1), wH = Math.max(maxY - minY + pad * 2, 1);
  const scale = Math.min(W / wW, H / wH), ox = (W - wW * scale) / 2 - (minX - pad) * scale, oy = (H - wH * scale) / 2 - (minY - pad) * scale;
  canvas._mmScale = scale; canvas._mmOx = ox; canvas._mmOy = oy;
  ctx.strokeStyle = 'rgba(148,163,184,0.25)'; ctx.lineWidth = 1;
  ctx.beginPath();
  g.links.forEach(l => {
    const fn = g.nodeById.get(l.from), tn = g.nodeById.get(l.to);
    if (!fn || !tn) return;
    ctx.moveTo(fn.x * scale + ox, fn.y * scale + oy); ctx.lineTo(tn.x * scale + ox, tn.y * scale + oy);
  });
  ctx.stroke();
  g.nodes.forEach(n => {
    ctx.fillStyle = n.id === brain.selectedNodeId ? '#6366f1' : (n.color ? vizColorMap(n.color) : 'rgba(245,158,11,0.7)');
    ctx.globalAlpha = n.id === brain.selectedNodeId ? 1 : 0.7;
    ctx.beginPath(); ctx.roundRect(n.x * scale + ox, n.y * scale + oy, Math.max((n.w || 150) * scale, 4), Math.max((n.h || 48) * scale, 3), 2); ctx.fill();
    ctx.globalAlpha = 1;
  });
  const cW = container.offsetWidth, cH = container.offsetHeight;
  const vx = (-brain.pan.x / brain.zoom) * scale + ox, vy = (-brain.pan.y / brain.zoom) * scale + oy;
  const vw = (cW / brain.zoom) * scale, vh = (cH / brain.zoom) * scale;
  if (viewportEl) {
    const cx = Math.max(0, Math.min(vx, W)), cy = Math.max(0, Math.min(vy, H));
    viewportEl.style.left = cx + 'px'; viewportEl.style.top = cy + 'px';
    viewportEl.style.width = Math.max(Math.min(vw, W - cx), 4) + 'px';
    viewportEl.style.height = Math.max(Math.min(vh, H - cy), 4) + 'px';
  }
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
  const headsSvg = document.getElementById('viz-heads-svg');
  if (headsSvg && svg) headsSvg.style.transform = svg.style.transform;
  nodesLayer.innerHTML = '';
  // Manhua bubbles share one SVG under every note, so overlapping bubbles can
  // merge (brainPaintBubbles).
  const bubbleSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  bubbleSvg.id = 'brain-bubbles';
  bubbleSvg.setAttribute('class', 'brain-bubbles');
  bubbleSvg.setAttribute('aria-hidden', 'true');
  nodesLayer.appendChild(bubbleSvg);
  // Its own watcher: any size change of a Manhua note's box repaints the
  // bubbles. The note observer below returns early whenever it grows a note to
  // fit its text, and during a corner drag that meant the bubble was skipped
  // and left at its old size, wider or narrower than the note.
  if (_brainBubbleRO) _brainBubbleRO.disconnect();
  _brainBubbleRO = typeof ResizeObserver === 'function' ? new ResizeObserver(() => brainPaintBubbles()) : null;
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
    if (node.bg) el.dataset.bg = node.bg;
    // Text settings ride on custom properties the note's text reads.
    if (node.textColor) el.style.setProperty('--note-text', vizColorMap(node.textColor));
    if (node.textAlign) el.style.setProperty('--note-align', node.textAlign);
    if (node.lineSpacing) el.style.setProperty('--note-line', node.lineSpacing);
    if (node.paraSpacing) el.style.setProperty('--note-para', BRAIN_PARA_SPACING[node.paraSpacing] || '0');
    if (BRAIN_FONTS[node.fontFamily]) {
      el.style.setProperty('--note-font', BRAIN_FONTS[node.fontFamily]);
      // Manga lettering is set in capitals; the other faces are not.
      el.style.setProperty('--note-case', node.fontFamily === 'comic' ? 'uppercase' : 'none');
    }
    if (node.border && !isGlobe) el.dataset.border = node.border;
    if (node.shape && !isGlobe) {
      el.dataset.shape = node.shape;
      if (node.rot) el.dataset.rot = node.rot;   // text and the timeline's + follow it in CSS
      if (node.angle) el.style.rotate = node.angle + 'deg';   // turned by its handle
      // An object's fill is the full Background colour, not a note's dark tint.
      if (node.bg) el.style.setProperty('--shape-fill-c', vizColorMap(node.bg));
    }
    if (node.border === 'manhua' && !isGlobe) {
      el.dataset.bubble = BRAIN_BUBBLE_IDS.has(node.bubble) ? node.bubble : 'speech';
      if (_brainBubbleRO) _brainBubbleRO.observe(el);
    }
    const isElectric = node.border === 'electric' && !isGlobe;
    const isMedieval = node.border === 'medieval' && !isGlobe;
    if (isElectric) brainEnsureElectricFilter();
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
      // Objects draw under their label (the SVG comes first) and have no
      // placeholder: an arrow with no label is just an arrow.
      const objectLayer = node.shape ? '<svg class="shape-svg" aria-hidden="true"></svg>' : '';
      const objectTop = node.shape === 'timeline'
        ? '<div class="shape-tl-labels" aria-hidden="true"></div><button class="shape-tl-add" type="button" title="Extend the timeline" aria-label="Extend the timeline">+</button>' : '';
      el.innerHTML = `${isElectric ? BRAIN_ELECTRIC_BACK : ''}${objectLayer}<div class="viz-node-inner" style="${styleW}${styleH}">
        <div class="viz-comment-body">
          <div class="viz-comment-content">${brainNoteParagraphs(brainShownText(node) || (node.shape ? '' : 'Double-click or right-click to edit...'))}</div>
        </div>
      </div>${isElectric ? BRAIN_ELECTRIC_FRONT : ''}${isMedieval ? BRAIN_MEDIEVAL_FRONT : ''}${node.border === 'manhua' ? '<div class="bb-resize" title="Resize" aria-hidden="true"></div>' : ''}${brainCollapseBadge}`;
      const grip = el.querySelector('.bb-resize');
      if (grip) grip.addEventListener('pointerdown', e => brainBubbleResizeStart(e, node.id, el));
      if (objectTop) el.insertAdjacentHTML('beforeend', objectTop);
      if (node.shape) {
        el.insertAdjacentHTML('beforeend', '<button class="shape-rotate" type="button" title="Drag to rotate (Shift: 15° steps)" aria-label="Rotate"><i data-lucide="rotate-cw"></i></button>');
        el.querySelector(':scope > .shape-rotate').addEventListener('pointerdown', ev => brainShapeRotateStart(ev, node.id, el));
      }
      const extend = el.querySelector('.shape-tl-add');
      if (extend) {
        extend.addEventListener('pointerdown', e => e.stopPropagation());
        extend.addEventListener('click', e => { e.stopPropagation(); brainExtendTimeline(node.id); });
      }
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
      // A dragged height is the note's size while its text fits, never a cap
      // that hides the rest (vizFitNoteHeight). Before observing, so the fit
      // is part of the size the observer starts from. Links were drawn to the
      // old edge during render, so repaint them if it grew.
      const grew = vizFitNoteHeight(inner);
      if (brainFitBubble(el, inner) || grew) brainUpdateSVGLinks();
      else if (node.border === 'manhua') brainPaintBubbles();
      brainSizeElectric(el, inner);
      if (node.shape) brainPaintShape(el, node);
      // ResizeObserver always fires once for the current size the moment it
      // starts observing. Treating that as a resize baked the first layout's
      // height into the note for good, and the text was then clipped as soon as
      // it grew. Only later firings are a real drag of the corner handle.
      let initial = true;
      const obs = new ResizeObserver(() => {
        if (initial) { initial = false; return; }
        if (vizFitNoteHeight(inner)) {   // grew; the next callback records it
          if (node.border === 'manhua') brainPaintBubbles();
          return;
        }
        brainSizeElectric(el, inner);
        if (node.shape) brainPaintShape(el, node);
        if (brainFitBubble(el, inner)) brainUpdateSVGLinks();
        else if (node.border === 'manhua') brainPaintBubbles();
        // Typing in the open editor changes the size too; that is not a
        // resize by hand, and recording it would freeze the note's height.
        if (performance.now() - (el._liveEditAt || 0) < 250) return;
        if (inner.offsetWidth > 0) { node.w = inner.offsetWidth; node.h = inner.offsetHeight; node.userSized = true; }
      });
      obs.observe(inner);
      _brainObservers.set(node.id, obs);
    }, 0);
    if (!isGhost) {
      el.addEventListener('pointerdown', (e) => brainNodeMouseDown(e, node.id));
      el.addEventListener('click', (e) => brainNodeClick(e, node.id));
      el.addEventListener('contextmenu', (e) => brainNodeCtx(e, node.id));
      el.addEventListener('mouseenter', () => { if (typeof vizHoverFocus === 'function') vizHoverFocus(node.id); });
      el.addEventListener('mouseleave', () => { if (typeof vizHoverClear === 'function') vizHoverClear(); });
      el.addEventListener('dblclick', (e) => { e.stopPropagation(); brainHideAllMenus(); brainOpenEditor(node); });
      // Arrows, lines and timelines are drawings, not things to connect: no ports.
      if (!BRAIN_PORTLESS.has(node.shape)) ['top','right','bottom','left'].forEach(side => {
        const port = document.createElement('div');
        port.className = 'viz-port';
        port.dataset.side = side;
        port.dataset.nodeId = node.id;
        port.addEventListener('pointerdown', (e) => {
          if (e.pointerType === 'mouse' && e.button !== 0) return;
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
    // Older links have no arrowType; they were always drawn with one head.
    const arrowType = link.arrowType || 'arrow';
    const markerEnd = arrowType !== 'none' ? `marker-end="url(#${arrowId})"` : '';
    const markerStart = arrowType === 'double-arrow' ? `marker-start="url(#${arrowId}-back)"` : '';
    const isBridgeGhost = link.isBridge && (brainBridgeGhostIds.has(link.from) || brainBridgeGhostIds.has(link.to));
    const isFocusGhost = brain._focusedParentId && (!brainFocusIds.has(link.from) || !brainFocusIds.has(link.to));
    const isGhostLink = isBridgeGhost || isFocusGhost;
    const ghostStyle = isGhostLink ? 'opacity:0.3;stroke-dasharray:6,4;' : '';
    svgContent += `<g class="viz-link-group${isGhostLink ? ' viz-bridge-ghost-link' : ''}" data-link-id="${link.id}" oncontextmenu="brainLinkCtx(event,'${link.id}')">
      <path class="viz-link-hitbox" d="${d}"/>
      <path class="viz-link custom-link" d="${d}" style="${lc}${ghostStyle}" ${markerEnd} ${markerStart}/>
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
  if (svg) {
    svg.innerHTML = svgContent;
    // Brain draws with the main canvas's arrowhead markers, and switching
    // modules wipes the SVG (_vizResetRenderCache). Arriving at Brain that way
    // left no markers at all, so every link was drawn headless: it looked like
    // "None" while its real type, and the menu, said "Arrow".
    if (existingDefs && existingDefs.querySelector('marker')) svg.insertBefore(existingDefs, svg.firstChild);
    else if (typeof _vizBuildDefs === 'function') _vizBuildDefs(svg);
    vizSyncHeads();
    svg.querySelectorAll('g.viz-link-group').forEach(g => g.addEventListener('pointerdown', ev => brainLinkGrab(ev, g.dataset.linkId)));
  }
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: container });
  brainPaintBubbles();
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

/* ── Dragging and panning, on pointer events ──────────────────
   Brain had its own copy of all of this, bound to mouse events only and with
   the same read/write thrash in the link repaint. It shares the engine now:
   one geometry snapshot per drag, one repaint per frame, and a finger works. */

function brainNodeMouseDown(e, nodeId) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
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
  vizGeom.graph = vizVisibleGraph();
  vizGeomHold(vizGeom.graph);
  document.addEventListener('pointermove', brainNodeDrag);
  document.addEventListener('pointerup', brainNodeDragEnd);
  document.addEventListener('pointercancel', brainNodeDragEnd);
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
  vizSchedulePaint(() => { brainUpdateSVGLinks(); brainUpdateMinimap(); });
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

/** The shared painter: one read pass, one write pass. */
function brainUpdateSVGLinks() {
  vizPaintLinks(vizGeom.held && vizGeom.graph ? vizGeom.graph : null);
  brainPaintBubbles();   // bubbles follow their notes wherever links do
}

function brainNodeDragEnd() {
  vizCancelScheduledPaint();
  // Keep the id: the snap block below read brain.draggingNode AFTER it had been
  // set to null, so the condition was never true and Snap to grid did nothing
  // at all — the toolbar toggle was decorative.
  const droppedId = brain.draggingNode;
  if (droppedId) { const el = document.querySelector(`.viz-node[data-node-id="${droppedId}"]`); if (el) el.classList.remove('dragging'); }
  brain.draggingNode = null;
  brain._prevDragPos = null;
  document.removeEventListener('pointermove', brainNodeDrag);
  document.removeEventListener('pointerup', brainNodeDragEnd);
  document.removeEventListener('pointercancel', brainNodeDragEnd);
  vizGeomRelease();
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

const _brainPointers = new Map();
let _brainPinch = null;

function brainCanvasMouseDown(e) {
  if (e.target.closest('.viz-node') || e.target.closest('.viz-minimap')) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  _brainPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (_brainPointers.size === 2) {
    const pts = [..._brainPointers.values()];
    _brainPinch = {
      dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1,
      zoom: brain.zoom, cx: (pts[0].x + pts[1].x) / 2, cy: (pts[0].y + pts[1].y) / 2
    };
    brain.isPanning = false;
    return;
  }
  if (_brainPointers.size > 2) return;
  vizStopTween();
  brain.isPanning = true;
  brain.panStart = { x: e.clientX, y: e.clientY };
  brain.panStartOffset = { ...brain.pan };
  const container = document.getElementById('viz-canvas-container');
  if (container) container.classList.add('panning');
}

function brainCanvasMouseMove(e) {
  if (_brainPointers.has(e.pointerId)) _brainPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (_brainPinch && _brainPointers.size >= 2) {
    const pts = [..._brainPointers.values()];
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
    const container = document.getElementById('viz-canvas-container');
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const mx = _brainPinch.cx - rect.left, my = _brainPinch.cy - rect.top;
    const tx = (mx - brain.pan.x) / brain.zoom, ty = (my - brain.pan.y) / brain.zoom;
    brain.zoom = vizClampZoom(_brainPinch.zoom * (dist / _brainPinch.dist));
    brain.pan.x = mx - tx * brain.zoom;
    brain.pan.y = my - ty * brain.zoom;
    vizApplyTransform();
    brainUpdateZoomDisplay();
    return;
  }

  if (brain.linkingFrom) {
    const tempLink = document.getElementById('viz-temp-link');
    const container = document.getElementById('viz-canvas-container');
    if (tempLink && container) {
      const rect = container.getBoundingClientRect();
      const snap = brain._portDragging && brain._portSnap;
      const mx = ((snap ? snap.x : e.clientX) - rect.left - brain.pan.x) / brain.zoom;
      const my = ((snap ? snap.y : e.clientY) - rect.top - brain.pan.y) / brain.zoom;
      const d = tempLink.getAttribute('d') || '';
      const m = d.match(/M (\S+) (\S+)/);
      if (m) {
        const fx = parseFloat(m[1]), fy = parseFloat(m[2]);
        const cp = vizTempLinkCP(fx, fy, mx, my, brain._portDragSide || null, snap ? snap.side : null);
        tempLink.setAttribute('d', `M ${fx} ${fy} C ${cp.c1x} ${cp.c1y}, ${cp.c2x} ${cp.c2y}, ${mx} ${my}`);
      }
    }
  }
  if (!brain.isPanning) return;
  brain.pan.x = brain.panStartOffset.x + (e.clientX - brain.panStart.x);
  brain.pan.y = brain.panStartOffset.y + (e.clientY - brain.panStart.y);
  vizSchedulePaint(() => vizApplyTransform());
}

/**
 * Document-level: this runs for EVERY pointerup on the page while Brain is
 * open, not just ones on the canvas.
 *
 * It used to call brainSaveCurrentVersion() unconditionally, which repainted
 * the "Saved just now" chip in the canvas toolbar. That chip sits in the same
 * flex row as the Brain toolbar buttons, so rewriting it between mouseup and
 * click reflowed the row and the browser never dispatched the click at all —
 * which is why those buttons needed a second press to do anything.
 */
function brainCanvasMouseUp(e) {
  if (e && e.pointerId !== undefined) _brainPointers.delete(e.pointerId);
  if (_brainPointers.size < 2 && _brainPinch) { _brainPinch = null; brainSaveCurrentVersion(); }
  if (!brain.isPanning) return;
  vizCancelScheduledPaint();
  brain.isPanning = false;
  const container = document.getElementById('viz-canvas-container');
  if (container) container.classList.remove('panning');
  const moved = brain.pan.x !== brain.panStartOffset.x || brain.pan.y !== brain.panStartOffset.y;
  if (moved) { vizApplyTransform(); brainSaveCurrentVersion(); }
  // A click on empty canvas (a press that did not pan) deselects. Nothing did,
  // so a note's highlight or an object's dashed box stayed after clicking away.
  else if (brain.selectedNodeId) {
    brain.selectedNodeId = null;
    document.querySelectorAll('#viz-nodes-layer .viz-node.selected').forEach(n => n.classList.remove('selected'));
  }
}

let _brainWheelSaveTimer = null;

function brainCanvasWheel(e) {
  e.preventDefault();
  const container = document.getElementById('viz-canvas-container');
  if (!container) return;
  vizStopTween();
  const rect = container.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  const tx = (mx - brain.pan.x) / brain.zoom, ty = (my - brain.pan.y) / brain.zoom;
  const factor = e.deltaY > 0 ? 0.92 : 1.087;
  const newZoom = vizClampZoom(brain.zoom * factor);
  brain.pan.x = mx - tx * newZoom; brain.pan.y = my - ty * newZoom;
  brain.zoom = newZoom;
  // Transform-only (full re-render per wheel tick was rebuilding all nodes)
  vizApplyTransform();
  brainUpdateZoomDisplay();
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

/** Make sure there is a version to add to (a first note or object makes one). */
function _brainEnsureVersion() {
  if (brain.activeVersionId) return;
  const id = 'bv_' + generateId();
  brain.versions.push({ id, name: 'Default Version', folderId: null, nodes: [], links: [], pan: { x: 0, y: 0 }, zoom: 1 });
  brain.activeVersionId = id;
  brainSave();
  brainRenderSidebar();
  brainUpdateCanvasToolbar();
}

function brainAddCommentNode(x, y) {
  brainPushUndo();
  _brainEnsureVersion();

  const cx = x !== undefined ? x : ((-brain.pan.x / brain.zoom) + 200);
  const cy = y !== undefined ? y : ((-brain.pan.y / brain.zoom) + 200);
  const id = 'bn_' + generateId();
  const node = { id, commentContent: '', color: null, x: cx + (Math.random() - 0.5) * 40, y: cy + (Math.random() - 0.5) * 40 };
  Object.assign(node, _brainLastStyle());   // the look you last gave a note
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
  // Unblurred, the canvas behind takes clicks, so another note can be opened
  // while this one is. Only Save & Close keeps typing, so that note goes back
  // to its saved text; the window keeps its place and state.
  let carry = null;
  if (overlay) {
    if (typeof overlay._discard === 'function') overlay._discard();
    const prevWin = overlay.querySelector('.viz-comment-editor-window');
    carry = { floating: overlay.classList.contains('is-floating'), at: prevWin ? prevWin.style.translate : '' };
    overlay.remove();
  }
  overlay = document.createElement('div');
  overlay.id = 'viz-comment-editor-overlay';
  overlay.className = 'viz-comment-editor-overlay';
  document.body.appendChild(overlay);
  overlay.innerHTML = `<div class="viz-comment-editor-window">
    <div class="viz-comment-editor-header">
      <i data-lucide="brain-circuit"></i>
      <span>Brain Note</span>
      <button class="viz-comment-editor-close viz-comment-editor-min" id="viz-comment-editor-min" title="Unblur the canvas behind the note" aria-label="Unblur the canvas behind the note"><i data-lucide="minus"></i></button>
      <button class="viz-comment-editor-close" id="viz-comment-editor-x" title="Close" aria-label="Close"><i data-lucide="x"></i></button>
    </div>
    <div class="viz-comment-editor-body">
      <textarea id="viz-comment-editor-textarea" class="viz-comment-editor-textarea" spellcheck="false" placeholder="Enter your idea...">${escapeHTML(node.commentContent || '')}</textarea>
    </div>
    <div class="viz-comment-editor-footer">
      <button class="btn btn-secondary btn-sm" id="viz-comment-editor-reset" title="Put back the note's saved text"><i data-lucide="rotate-ccw" style="width:14px;height:14px;"></i> Reset</button>
      <button class="btn btn-primary btn-sm" id="viz-comment-editor-save"><i data-lucide="check" style="width:14px;height:14px;"></i> Save &amp; Close</button>
    </div>
  </div>`;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: overlay });
  // Ready to type the moment it opens, caret after any existing text. Deferred
  // a tick so the click or double-click that opened it has finished.
  const textarea = document.getElementById('viz-comment-editor-textarea');
  setTimeout(() => {
    if (!textarea.isConnected) return;
    textarea.focus({ preventScroll: true });
    const end = textarea.value.length;
    textarea.setSelectionRange(end, end);
  }, 0);
  const nodeId = node.id;
  const savedText = node.commentContent || '';

  /* Live preview: the note on the canvas shows each keystroke, so with the
     editor unblurred you watch it change as you type. It is only a preview
     (brain._livePreview, which rendering reads): nothing is written to the
     note, the undo history or storage until Save & Close. Close, opening
     another note, or leaving Visualize drops it and the note shows its saved
     text again. Only the one note's text is redrawn, so the editor keeps its
     focus and nothing flickers. */
  const applyLive = () => {
    brain._livePreview = { id: nodeId, text: textarea.value };
    const el = document.querySelector(`.viz-node[data-node-id="${nodeId}"]`);
    const inner = el && el.querySelector('.viz-node-inner');
    const content = el && el.querySelector('.viz-comment-content');
    if (!content) return;
    // Text-driven size changes are not a resize by hand (see the note's
    // ResizeObserver): mark them so the note's height is not frozen.
    el._liveEditAt = performance.now();
    content.innerHTML = brainNoteParagraphs(textarea.value || (el.dataset.shape ? '' : 'Double-click or right-click to edit...'));
    if (inner) { vizFitNoteHeight(inner); brainSizeElectric(el, inner); brainFitBubble(el, inner); }
    if (el.dataset.shape) { const n = brain.nodes.find(x => x.id === nodeId); if (n) brainPaintShape(el, n); }
    brainUpdateSVGLinks();
  };
  textarea.addEventListener('input', applyLive);
  textarea.addEventListener('keydown', e => _brainEditorTabKey(e, textarea));

  // Reset: back to the text the note had when this editor opened.
  document.getElementById('viz-comment-editor-reset').onclick = () => {
    textarea.value = savedText;
    applyLive();
    textarea.focus({ preventScroll: true });
    textarea.setSelectionRange(savedText.length, savedText.length);
  };
  // Not saved: drop the preview and redraw the note with its saved text.
  overlay._discard = () => {
    if (!brain._livePreview || brain._livePreview.id !== nodeId) return;
    brain._livePreview = null;
    brainRenderCanvas();
  };
  const finish = (keep) => {
    if (keep) {
      brain._livePreview = null;
      // Looked up by id: an undo replaces the node objects, and the one this
      // editor opened with may be stale by then.
      const target = brain.nodes.find(n => n.id === nodeId);
      if (target && (target.commentContent || '') !== textarea.value) {
        brainPushUndo();
        target.commentContent = textarea.value;
        brainSaveCurrentVersion();
      }
      brainRenderCanvas();
    } else {
      overlay._discard();
    }
    overlay.remove();
    if (typeof vizHoverClear === 'function') vizHoverClear();
  };
  document.getElementById('viz-comment-editor-save').onclick = () => finish(true);
  document.getElementById('viz-comment-editor-x').onclick = () => finish(false);
  overlay.classList.add('is-anchored');
  _brainCenterEditorWindow(overlay.querySelector('.viz-comment-editor-window'));
  _brainWireEditorFloat(overlay, textarea);
  if (carry) {
    if (carry.floating) _brainSetEditorFloating(overlay, true, textarea);
    const win = overlay.querySelector('.viz-comment-editor-window');
    if (win && carry.at) win.style.translate = carry.at;
  }
}

/* ── The note editor as a floating window ───────────────────────
   The Run Code terminal's pattern (practice.js _termWireFloat): the dash does
   not hide the note, it unblurs the canvas behind it and lets clicks through,
   so you can look at, pan and pick on the map while writing. It becomes a box,
   which puts the blur back and re-centres the window. The header drags the
   window in either state. */
function _brainWireEditorFloat(overlay, textarea) {
  const win = overlay.querySelector('.viz-comment-editor-window');
  const head = overlay.querySelector('.viz-comment-editor-header');
  const btn = overlay.querySelector('#viz-comment-editor-min');
  if (!win || !head || !btn) return;
  btn.onclick = () => _brainSetEditorFloating(overlay, !overlay.classList.contains('is-floating'), textarea);
  let drag = null;
  head.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.target.closest('button')) return;
    const [x, y] = (win.style.translate || '0px 0px').split(' ').map(parseFloat);
    drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x: x || 0, y: y || 0, r: win.getBoundingClientRect() };
    head.setPointerCapture(e.pointerId);
    head.classList.add('is-dragging');
    e.preventDefault();
  });
  head.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const r = drag.r;
    // Keep part of the header on screen, so the window can always be grabbed back.
    const dx = Math.max(80 - r.right, Math.min(innerWidth - 80 - r.left, e.clientX - drag.sx));
    const dy = Math.max(-r.top, Math.min(innerHeight - 48 - r.top, e.clientY - drag.sy));
    win.style.translate = (drag.x + dx) + 'px ' + (drag.y + dy) + 'px';
  });
  const end = e => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    head.classList.remove('is-dragging');
  };
  head.addEventListener('pointerup', end);
  head.addEventListener('pointercancel', end);
}

/* Tab in the note editor indents instead of moving focus to the Reset
   button. A caret gets a tab; a selection over several lines indents every
   line; Shift+Tab takes one tab (or up to four spaces) off the start of each
   line touched. insertText keeps the textarea's own undo, and fires the
   input event the live preview listens for. */
function _brainEditorTabKey(e, ta) {
  if (e.key !== 'Tab' || e.ctrlKey || e.altKey || e.metaKey) return;
  e.preventDefault();
  const insert = (text) => {
    if (!document.execCommand('insertText', false, text)) {
      ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end');
      ta.dispatchEvent(new Event('input'));
    }
  };
  const v = ta.value, s = ta.selectionStart, end = ta.selectionEnd;
  if (!e.shiftKey && !v.slice(s, end).includes('\n')) { insert('\t'); return; }
  const from = v.lastIndexOf('\n', s - 1) + 1;
  const nl = v.indexOf('\n', end);
  const to = (s === end || end === 0 || v[end - 1] !== '\n') ? (nl === -1 ? v.length : nl) : end - 1;
  const lines = v.slice(from, to).split('\n');
  let firstShift = 0;
  const out = lines.map((l, i) => {
    if (!e.shiftKey) { if (i === 0) firstShift = 1; return '\t' + l; }
    const m = l.match(/^(\t| {1,4})/);
    if (i === 0) firstShift = m ? -m[0].length : 0;
    return m ? l.slice(m[0].length) : l;
  }).join('\n');
  if (out === v.slice(from, to)) return;
  ta.setSelectionRange(from, to);
  insert(out);
  if (s === end) {
    const caret = Math.max(from, s + firstShift);
    ta.setSelectionRange(caret, caret);
  } else {
    ta.setSelectionRange(from, from + out.length);
  }
}

/* Placed by its top-left, centred once. Centred by flexbox instead, a resize
   from the corner grew the window on both sides at once, so the corner moved
   half as far as the pointer and drifted off it. */
function _brainCenterEditorWindow(win) {
  if (!win) return;
  win.style.left = Math.max(8, (innerWidth - win.offsetWidth) / 2) + 'px';
  win.style.top = Math.max(8, (innerHeight - win.offsetHeight) / 2) + 'px';
}

function _brainSetEditorFloating(overlay, on, textarea) {
  overlay.classList.toggle('is-floating', on);
  const win = overlay.querySelector('.viz-comment-editor-window');
  if (!on && win) { win.style.translate = ''; _brainCenterEditorWindow(win); }   // back to the centre, at its size now
  const btn = overlay.querySelector('#viz-comment-editor-min');
  if (btn) {
    btn.title = on ? 'Restore: blur the canvas and centre the note' : 'Unblur the canvas behind the note';
    btn.setAttribute('aria-label', btn.title);
    btn.innerHTML = '<i data-lucide="' + (on ? 'square' : 'minus') + '"></i>';
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: btn });
  }
  // Typing should still go to the note, not to the button just clicked.
  if (textarea && textarea.isConnected) textarea.focus({ preventScroll: true });
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
  if (typeof vizHoverClear === 'function') vizHoverClear();
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
  // The re-render below replaces the hovered node, so its mouseleave never
  // fires; a link dropped on empty canvas left every node dimmed by hover focus.
  if (typeof vizHoverClear === 'function') vizHoverClear();
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

function brainPortDragStart(e, nodeId, side, opts) {
  e.stopPropagation(); e.preventDefault();

  // ---- Link-toggle mode: treat port mousedown as a click, not a drag ----
  // (A link end grabbed off its node is always a drag: see brainLinkGrab.)
  if (!(opts && opts.regrab) && (brain.linkModeEnabled || brain.linkingFrom)) {
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
  if (typeof vizHoverClear === 'function') vizHoverClear();
  brainRenderCanvas();

  // Near a port: it shows, and the link end jumps onto it until you pull away.
  // Runs in the capture phase, so the snap is set before the canvas handler
  // redraws the temp link from it.
  function onMove(mv) {
    if (!brain._portDragging) return;
    const snap = brain._portSnap = vizNearestPort(mv.clientX, mv.clientY, nodeId);
    if (snap) vizPaintLinkTarget(snap.el, snap.side); else vizClearLinkTarget();
  }
  document.addEventListener('pointermove', onMove, true);

  function onUp(upEvent) {
    document.removeEventListener('pointerup', onUp, true);
    document.removeEventListener('pointercancel', onUp, true);
    document.removeEventListener('pointermove', onMove, true);
    brain._portSnap = null;
    vizClearLinkTarget();
    if (!brain.linkingFrom) return;
    const snap = vizNearestPort(upEvent.clientX, upEvent.clientY, nodeId);
    const els = document.elementsFromPoint(upEvent.clientX, upEvent.clientY);
    const targetEl = els.find(el => el.dataset && el.dataset.nodeId && el.dataset.nodeId !== nodeId);
    const targetNodeId = snap ? snap.nodeId : (targetEl ? targetEl.dataset.nodeId : null);
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

        if (snap) {
          toSide = snap.side;
        } else if (portEl) {
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
        const made = { id: 'bl_' + generateId(), from: nodeId, to: targetNodeId, color: null, fromSide: side, toSide, isBridge: isBridge || false, bridgeSourceId };
        // A link end grabbed and dropped here keeps the link's look, and its
        // direction when it was the start that moved (brainLinkGrab).
        if (opts && opts.carry) Object.assign(made, opts.carry);
        if (opts && opts.reverse) {
          [made.from, made.to] = [made.to, made.from];
          [made.fromSide, made.toSide] = [made.toSide, made.fromSide];
        }
        brain.links.push(made);
        brainRenderCanvas(); brainSaveCurrentVersion();
      }
    }
    brain._portDragSide = null;
    brain._portDragging = false;
    brainCancelLinking();
  }
  document.addEventListener('pointerup', onUp, true);
  document.addEventListener('pointercancel', onUp, true);
}

/* Grab a link by one of its ends to move that end. Pressed within the last
   10% of its length (the tip) or the first 30% (where it leaves), that end
   comes off its note and follows the pointer like a new connection, with the
   same port snapping: dropped on a note it reconnects there, keeping the
   link's colour, arrow type and direction; dropped on empty canvas it stays
   disconnected. One undo step either way. The middle of a link is left
   alone. It used to do nothing at all, so a link could only be deleted and
   drawn again. */
function brainLinkGrab(e, linkId) {
  if ((e.pointerType === 'mouse' && e.button !== 0) || brainIsLocked() || brain.linkModeEnabled || brain.linkingFrom) return;
  const link = brain.links.find(l => l.id === linkId);
  const path = e.currentTarget && e.currentTarget.querySelector('.viz-link-hitbox');
  const container = document.getElementById('viz-canvas-container');
  if (!link || !path || !container || typeof path.getTotalLength !== 'function') return;
  const L = path.getTotalLength();
  if (!L) return;
  // Where along the link the press landed, as a share of its length (0 at the
  // note it leaves, 1 at the tip). Paths are in canvas units.
  const r = container.getBoundingClientRect();
  const px = (e.clientX - r.left - brain.pan.x) / brain.zoom, py = (e.clientY - r.top - brain.pan.y) / brain.zoom;
  let at = 0, bestD = Infinity;
  for (let i = 0; i <= 60; i++) {
    const p = path.getPointAtLength(L * i / 60);
    const d = (p.x - px) ** 2 + (p.y - py) ** 2;
    if (d < bestD) { bestD = d; at = i / 60; }
  }
  const tip = at >= 0.9, start = at <= 0.3;
  if (!tip && !start) return;
  e.stopPropagation(); e.preventDefault();
  brainPushUndo();
  const carry = { color: link.color || null };
  if (link.arrowType) carry.arrowType = link.arrowType;
  brain.links = brain.links.filter(l => l.id !== linkId);
  brainSaveCurrentVersion();   // dropped on nothing, it stays disconnected
  if (tip) brainPortDragStart(e, link.from, link.fromSide || null, { regrab: true, carry });
  else brainPortDragStart(e, link.to, link.toSide || null, { regrab: true, carry, reverse: true });
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
  // Every dropdown opens collapsed, and before the menu is measured, so it is
  // placed at its real size.
  _brainCloseNodeSubs(null);
  _brainShowColorTargetList(false);
  if (typeof vizPositionMenu === 'function') vizPositionMenu(menu, e.clientX, e.clientY);
  else { menu.style.left = e.clientX + 'px'; menu.style.top = e.clientY + 'px'; menu.classList.remove('hidden'); }
  _brainMarkNodeMenu();
}

/* Personalize Color: one swatch row paints whichever of text / background /
   border edge is toggled on. The toggle stays where you left it. */
const BRAIN_COLOR_PROPS = { text: 'textColor', bg: 'bg', edge: 'color' };

const BRAIN_COLOR_TARGET_LABELS = { text: 'Text Color', bg: 'Background Color', edge: 'Border Edge Color' };

function brainSetColorTarget(target) {
  brain._colorTarget = target;
  _brainShowColorTargetList(false);
  _brainMarkNodeMenu();
}

/** The target dropdown: which part of the note the swatches paint. */
function brainToggleColorTargetList(e) {
  if (e) e.stopPropagation();
  const list = document.getElementById('brain-color-target-list');
  _brainShowColorTargetList(!!list && list.classList.contains('hidden'));
}
function _brainShowColorTargetList(open) {
  const list = document.getElementById('brain-color-target-list');
  const btn = document.getElementById('brain-color-target-btn');
  if (list) list.classList.toggle('hidden', !open);
  if (btn) btn.setAttribute('aria-expanded', String(open));
}

/** Applies to the toggled target and keeps the menu open, so you can switch
 *  target and pick again. */
function brainCtxPickColor(color) {
  const node = brain.contextNodeId && brain.nodes.find(n => n.id === brain.contextNodeId);
  if (!node) return;
  const prop = BRAIN_COLOR_PROPS[brain._colorTarget || 'edge'];
  if ((node[prop] || null) === (color || null)) return;
  brainPushUndo();
  if (color) node[prop] = color; else delete node[prop];
  _brainRememberStyle(node);
  brainRenderCanvas(); brainSaveCurrentVersion();
  _brainMarkNodeMenu();
}

/** Mark each control in the node menu with the context note's current value. */
function _brainMarkNodeMenu() {
  const menu = document.getElementById('brain-node-ctx');
  const node = menu && brain.contextNodeId && brain.nodes.find(n => n.id === brain.contextNodeId);
  if (!node) return;
  const mark = (sel, attr, value) => menu.querySelectorAll(sel).forEach(o => o.classList.toggle('active', o.dataset[attr] === value));
  const target = brain._colorTarget || 'edge';
  // The label says the current value too. Default text is near-white, so a
  // note can look white while its setting is Default; spelling it out stops
  // that reading as the menu getting it wrong.
  const current = node[BRAIN_COLOR_PROPS[target]];
  const label = document.getElementById('brain-color-target-label');
  if (label) label.textContent = BRAIN_COLOR_TARGET_LABELS[target] + ' · '
    + (current ? current.charAt(0).toUpperCase() + current.slice(1) : 'Default');
  menu.querySelectorAll('#brain-color-target-list [data-target]').forEach(o => {
    const on = o.dataset.target === target;
    o.classList.toggle('active', on);
    o.setAttribute('aria-selected', String(on));
  });
  mark('#brain-note-swatches .viz-color-swatch', 'color', node[BRAIN_COLOR_PROPS[target]] || '');
  mark('#brain-node-border-menu .viz-link-type-option', 'border', node?.border || '');
  const borderRow = document.getElementById('brain-node-border-toggle');
  if (borderRow) borderRow.classList.toggle('hidden', !!node.shape);
  // Manhua's dropdown (and Bubble Shape in it) only exists for a Manhua note:
  // any other border folds it away.
  if (node.border !== 'manhua') {
    ['manhua', 'bubble'].forEach(k => {
      const sub = document.getElementById('brain-node-' + k + '-menu');
      const toggle = document.getElementById('brain-node-' + k + '-toggle');
      if (sub) sub.classList.add('hidden');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    });
  }
  mark('#brain-node-bubble-menu .viz-link-type-option', 'bubble', BRAIN_BUBBLE_IDS.has(node.bubble) ? node.bubble : 'speech');
  // Unset is the border's own: centred lettering on Manhua, left elsewhere.
  mark('#brain-node-align-menu .viz-link-type-option', 'value', node?.textAlign || (node.border === 'manhua' ? 'center' : 'left'));
  mark('#brain-node-font-menu .viz-link-type-option', 'value', BRAIN_FONTS[node.fontFamily] ? node.fontFamily : '');
  mark('[data-prop="lineSpacing"] button', 'value', String(node?.lineSpacing || 1.5));
  mark('[data-prop="paraSpacing"] button', 'value', node?.paraSpacing || '');
}

/** What a note shows: the open editor's unsaved preview, or its saved text. */
function brainShownText(node) {
  const p = brain._livePreview;
  return p && p.id === node.id ? p.text : node.commentContent;
}

/* ── Objects ────────────────────────────────────────────────────
   Free-standing things to put on the map: arrows and lines that join nothing,
   a timeline, shapes and plain text. Each is a Brain note with a `shape`, so
   it moves, links, deletes, undoes, saves and resizes like any note, its label
   is the note's text (double-click to edit), and Personalize Color gives its
   stroke (Border Edge), fill (Background) and label (Text). It is drawn into
   an SVG sized to the note, repainted whenever the note changes size. */
const BRAIN_SHAPES = [
  ['arrow', 'Arrow', 'arrow-right', 200, 56], ['double', 'Double arrow', 'arrow-left-right', 200, 56],
  ['line', 'Line', 'minus', 200, 56], ['timeline', 'Timeline', 'git-commit-horizontal', 380, 84],
  ['rect', 'Rectangle', 'square', 160, 100], ['rounded', 'Rounded rectangle', 'rectangle-horizontal', 160, 100],
  ['ellipse', 'Ellipse', 'circle', 160, 100], ['diamond', 'Diamond', 'diamond', 150, 110],
  ['triangle', 'Triangle', 'triangle', 140, 110], ['star', 'Star', 'star', 130, 120],
  ['text', 'Text', 'type', 150, 50]
];
const BRAIN_PORTLESS = new Set(['arrow', 'double', 'line', 'timeline']);

function brainToggleInsertMenu() { vizTogglePopup('brain-insert-popup'); }

/** Drop an object in the middle of what is on screen. */
function brainInsertShape(kind) {
  const def = BRAIN_SHAPES.find(x => x[0] === kind);
  if (!def) return;
  vizClosePopups();
  brainPushUndo();
  _brainEnsureVersion();
  const c = document.getElementById('viz-canvas-container');
  const r = c ? c.getBoundingClientRect() : { width: 800, height: 600 };
  const [, , , w, h] = def;
  const node = {
    id: 'bn_' + generateId(), color: null, shape: kind,
    commentContent: kind === 'timeline' ? 'Step 1\nStep 2\nStep 3\nStep 4' : kind === 'text' ? 'Text' : '',
    x: Math.round((r.width / 2 - brain.pan.x) / brain.zoom - w / 2),
    y: Math.round((r.height / 2 - brain.pan.y) / brain.zoom - h / 2),
    w, h, userSized: true
  };
  if (kind === 'timeline') node.segs = 3;
  brain.nodes.push(node);
  brain.selectedNodeId = node.id;
  brainRenderCanvas(); brainSaveCurrentVersion();
}

/** Timeline +: one more segment, the timeline longer by one segment's length. */
function brainExtendTimeline(nodeId) {
  const node = brain.nodes.find(n => n.id === nodeId);
  if (!node) return;
  const inner = document.querySelector(`.viz-node[data-node-id="${nodeId}"] .viz-node-inner`);
  const segs = node.segs || 3;
  const w = (inner && inner.offsetWidth) || node.w || 380;
  const h = (inner && inner.offsetHeight) || node.h || 84;
  const vertical = (node.rot || 0) % 180 !== 0;   // turned, it grows downwards (or up)
  brainPushUndo();
  node.segs = segs + 1;
  if (vertical) { node.w = w; node.h = Math.round(h + (h - 2 * BRAIN_TL_PAD) / segs); }
  else { node.h = h; node.w = Math.round(w + (w - 2 * BRAIN_TL_PAD) / segs); }
  node.userSized = true;
  brainRenderCanvas(); brainSaveCurrentVersion();
}


const BRAIN_TL_PAD = 18;   // the timeline's line starts and ends this far in

/* Rotating an object: drag the round handle above a selected object, as in a
   drawing program. The angle follows the pointer round the object's centre,
   with Shift snapping to 15-degree steps, and is stored on the object
   (node.angle) and applied as a CSS rotate, so the drawing and its label turn
   together. One undo step per turn. */
function brainShapeRotateStart(e, nodeId, el) {
  if ((e.pointerType === 'mouse' && e.button !== 0) || brainIsLocked()) return;
  e.stopPropagation();
  e.preventDefault();
  const node = brain.nodes.find(n => n.id === nodeId);
  const handle = e.currentTarget;
  if (!node || !handle) return;
  // The centre does not move while turning, so measure it once.
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const angleAt = ev => Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI;
  const from = angleAt(e), base = node.angle || 0;
  let turned = false, angle = base;
  handle.setPointerCapture(e.pointerId);
  el.classList.add('is-rotating');
  const move = ev => {
    if (!turned) { brainPushUndo(); turned = true; }
    angle = base + (angleAt(ev) - from);
    if (ev.shiftKey) angle = Math.round(angle / 15) * 15;
    angle = ((angle % 360) + 360) % 360;
    el.style.rotate = angle + 'deg';
  };
  const up = () => {
    handle.removeEventListener('pointermove', move);
    handle.removeEventListener('pointerup', up);
    handle.removeEventListener('pointercancel', up);
    el.classList.remove('is-rotating');
    if (!turned) return;
    const target = brain.nodes.find(n => n.id === nodeId);
    if (target) { if (Math.round(angle) % 360) target.angle = Math.round(angle * 10) / 10; else delete target.angle; }
    brainSaveCurrentVersion();
  };
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', up);
  handle.addEventListener('pointercancel', up);
}

/** Draw an object into its SVG at the note's current size. */
function brainPaintShape(el, node) {
  const svg = el && el.querySelector(':scope > .shape-svg');
  if (!svg) return;
  const w = el.offsetWidth, h = el.offsetHeight;
  if (!w || !h) return;
  svg.setAttribute('width', w);
  svg.setAttribute('height', h);
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  const f = n => Math.round(n * 10) / 10;
  const rot = (((node.rot || 0) % 360) + 360) % 360;
  const kind = node.shape;
  const head = (x1, y1, x2, y2) => {   // a filled arrowhead at (x2, y2)
    const a = Math.atan2(y2 - y1, x2 - x1), L = 13, W = 6.5;
    const bx = x2 - L * Math.cos(a), by = y2 - L * Math.sin(a);
    return `<path class="shape-ink-fill" d="M${f(x2)} ${f(y2)}L${f(bx + W * Math.sin(a))} ${f(by - W * Math.cos(a))}L${f(bx - W * Math.sin(a))} ${f(by + W * Math.cos(a))}Z"/>`;
  };
  let out = '';
  if (kind === 'arrow' || kind === 'double' || kind === 'line') {
    // Horizontal ones run along the bottom with the label above; vertical ones
    // run down the middle.
    const p = 8, horiz = rot === 0 || rot === 180;
    const y = h - 14, x = w / 2;
    let [x1, y1, x2, y2] = horiz ? [p, y, w - p, y] : [x, p, x, h - p];
    if (rot === 180 || rot === 270) [x1, y1, x2, y2] = [x2, y2, x1, y1];
    // The shaft stops short of each head so it never pokes through its tip.
    const trim = (ax, ay, bx2, by2, d) => { const L = Math.hypot(bx2 - ax, by2 - ay) || 1; return [bx2 - (bx2 - ax) / L * d, by2 - (by2 - ay) / L * d]; };
    let [sx, sy] = [x1, y1], [ex, ey] = [x2, y2];
    if (kind !== 'line') [ex, ey] = trim(x1, y1, x2, y2, 10);
    if (kind === 'double') [sx, sy] = trim(x2, y2, x1, y1, 10);
    out = `<path class="shape-stroke" d="M${f(sx)} ${f(sy)}L${f(ex)} ${f(ey)}"/>`;
    if (kind !== 'line') out += head(x1, y1, x2, y2);
    if (kind === 'double') out += head(x2, y2, x1, y1);
  } else if (kind === 'timeline') {
    // Runs left to right; turned, top to bottom, right to left, bottom to top.
    // The labels sit below, beside, above or beside the dots to match.
    const segs = Math.max(1, node.segs || 3), p = BRAIN_TL_PAD;
    const vertical = rot === 90 || rot === 270;
    const len = vertical ? h : w, step = (len - 2 * p) / segs;
    const across = { 0: h * 0.38, 90: 28, 180: h * 0.62, 270: w - 28 }[rot];
    const at = i => {   // the i-th milestone's point
      const t = (rot === 180 || rot === 270) ? len - p - step * i : p + step * i;
      return vertical ? [across, t] : [t, across];
    };
    const [ax, ay] = at(0), [bx, by] = at(segs);
    out = `<path class="shape-stroke" d="M${f(ax)} ${f(ay)}L${f(bx)} ${f(by)}"/>`;
    const labels = String(brainShownText(node) || '').split('\n');
    const place = { 0: [0, 12, 'translateX(-50%)'], 180: [0, -12, 'translate(-50%, -100%)'],
      90: [14, 0, 'translateY(-50%)'], 270: [-14, 0, 'translate(-100%, -50%)'] }[rot];
    let html = '';
    for (let i = 0; i <= segs; i++) {
      const [cx, cy] = at(i);
      out += `<circle class="shape-ink-fill" cx="${f(cx)}" cy="${f(cy)}" r="5"/>`;
      if (labels[i]) html += `<span class="shape-tl-label" style="left:${f(cx + place[0])}px;top:${f(cy + place[1])}px;transform:${place[2]}">${escapeHTML(labels[i])}</span>`;
    }
    const lab = el.querySelector(':scope > .shape-tl-labels');
    if (lab) lab.innerHTML = html;
  } else if (kind === 'rect' || kind === 'rounded') {
    const r = kind === 'rounded' ? Math.min(16, h / 4) : 2;
    out = `<rect class="shape-shape" x="1.25" y="1.25" width="${f(w - 2.5)}" height="${f(h - 2.5)}" rx="${f(r)}"/>`;
  } else if (kind === 'ellipse') {
    out = `<ellipse class="shape-shape" cx="${f(w / 2)}" cy="${f(h / 2)}" rx="${f(w / 2 - 1.25)}" ry="${f(h / 2 - 1.25)}"/>`;
  } else if (kind === 'diamond') {
    out = `<path class="shape-shape" d="M${f(w / 2)} 1.25L${f(w - 1.25)} ${f(h / 2)}L${f(w / 2)} ${f(h - 1.25)}L1.25 ${f(h / 2)}Z"/>`;
  } else if (kind === 'triangle') {
    const e = 1.25;
    const pts = {
      0: [[w / 2, e], [w - e, h - e], [e, h - e]], 90: [[w - e, h / 2], [e, h - e], [e, e]],
      180: [[w / 2, h - e], [e, e], [w - e, e]], 270: [[e, h / 2], [w - e, e], [w - e, h - e]]
    }[rot];
    out = `<path class="shape-shape" d="M${pts.map(q => f(q[0]) + ' ' + f(q[1])).join('L')}Z"/>`;
  } else if (kind === 'star') {
    const cx = w / 2, cy = h / 2 + h * 0.04, rx = w / 2 - 1.5, ry = h / 2 - 1.5, pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + rot * Math.PI / 180 + i * Math.PI / 5, k = i % 2 ? 0.45 : 1;
      pts.push(f(cx + rx * k * Math.cos(a)) + ' ' + f(cy + ry * k * Math.sin(a)));
    }
    out = `<path class="shape-shape" d="M${pts.join('L')}Z"/>`;
  }
  svg.innerHTML = out;
}

/* ── The last look you gave a note ─────────────────────────────
   Changing a note's border, bubble, colours, alignment, font or spacing
   remembers that note's whole look, and the next note you make starts with
   it: switch one note to Manhua and the next one is Manhua too. Objects keep
   their own looks and are not remembered. */
const BRAIN_STYLE_KEYS = ['border', 'bubble', 'color', 'bg', 'textColor', 'textAlign', 'fontFamily', 'lineSpacing', 'paraSpacing'];
function _brainRememberStyle(node) {
  if (!node || node.shape) return;
  const style = {};
  BRAIN_STYLE_KEYS.forEach(k => { if (node[k] != null) style[k] = node[k]; });
  try { localStorage.setItem('ssp.brainNoteStyle', JSON.stringify(style)); } catch (_) { /* private mode */ }
}
function _brainLastStyle() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('ssp.brainNoteStyle') || '{}') || {}; } catch (_) { saved = {}; }
  const style = {};
  BRAIN_STYLE_KEYS.forEach(k => { if (saved[k] != null) style[k] = saved[k]; });
  return style;
}

/* -- Note text ----------------------------------------------------
   One <p> per line you typed, so each Enter starts a paragraph and paragraph
   spacing has something to space; an empty line keeps its height. */
const BRAIN_PARA_SPACING = { s: '0.35em', m: '0.75em', l: '1.25em' };
/* Font Family. Unset is the border's own default (CSS): the app's font, or
   comic lettering on Manhua. --font-comic is the stack in visualization.css. */
const BRAIN_FONTS = { arial: 'Arial, Helvetica, sans-serif', sans: 'sans-serif', comic: 'var(--font-comic)' };
function brainNoteParagraphs(text) {
  return String(text).split('\n').map(l => '<p>' + (l ? escapeHTML(l) : '<br>') + '</p>').join('');
}

/* The node menu's dropdowns, one open at a time. */
const BRAIN_NODE_SUBS = ['colors', 'border', 'manhua', 'bubble', 'align', 'font', 'spacing'];
function _brainCloseNodeSubs(except) {
  BRAIN_NODE_SUBS.forEach(k => {
    if (k === except) return;
    const sub = document.getElementById('brain-node-' + k + '-menu');
    const toggle = document.getElementById('brain-node-' + k + '-toggle');
    if (sub) sub.classList.add('hidden');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  });
}
/* Manhua Border and its Bubble Shape are nested inside Border Type, so they
   open on their own, without the one-at-a-time rule closing what they sit in. */
function brainToggleBubbleSub(e) {
  _brainToggleCtxSub(e, 'brain-node-ctx', 'brain-node-bubble-menu', 'brain-node-bubble-toggle');
}

/** Manhua Border: makes the note Manhua and opens its dropdown; on a note
 *  that already is, it just folds the dropdown open or shut. */
function brainCtxManhua(e) {
  if (e) e.stopPropagation();
  const node = brain.contextNodeId && brain.nodes.find(n => n.id === brain.contextNodeId);
  if (!node) return;
  const sub = document.getElementById('brain-node-manhua-menu');
  if (node.border !== 'manhua') {
    brainCtxSetBorder('manhua');
    if (sub && sub.classList.contains('hidden')) _brainToggleCtxSub(null, 'brain-node-ctx', 'brain-node-manhua-menu', 'brain-node-manhua-toggle');
    return;
  }
  _brainToggleCtxSub(null, 'brain-node-ctx', 'brain-node-manhua-menu', 'brain-node-manhua-toggle');
}
function brainToggleNodeSub(e, key) {
  _brainCloseNodeSubs(key);
  _brainToggleCtxSub(e, 'brain-node-ctx', 'brain-node-' + key + '-menu', 'brain-node-' + key + '-toggle');
}

/** Set (or with null, clear back to default) one of the context note's settings. */
function brainCtxSetNote(prop, value) {
  const node = brain.contextNodeId && brain.nodes.find(n => n.id === brain.contextNodeId);
  if (!node) { brainHideAllMenus(); return; }
  if ((node[prop] == null ? null : node[prop]) === (value == null ? null : value)) { brainHideAllMenus(); return; }
  brainPushUndo();
  if (value == null) delete node[prop]; else node[prop] = value;
  _brainRememberStyle(node);
  brainRenderCanvas(); brainSaveCurrentVersion();
  brainHideAllMenus();
}

/* -- Border types ----------------------------------------------
   Default is the extruded slab. Electric is a crackling line in the note's own
   colour: the border is pushed around by animated turbulence noise (an SVG
   displacement filter), with two blurred copies for glow, an overlay sheen and
   a soft halo behind. The filter lives once in the page; each note only draws
   the layers. */
const BRAIN_ELECTRIC_BACK = '<div class="viz-electric-bg" aria-hidden="true"></div>';
const BRAIN_ELECTRIC_FRONT = '<div class="viz-electric" aria-hidden="true">'
  + '<div class="viz-electric-glow-1"></div><div class="viz-electric-glow-2"></div>'
  + '<div class="viz-electric-line"></div></div>'
  // Siblings of the card, not inside .viz-electric, so their blend reaches it.
  + '<div class="viz-electric-sheens" aria-hidden="true">'
  + '<div class="viz-electric-sheen"></div><div class="viz-electric-sheen"></div></div>';

/* Medieval: the Art Deco card's corner ornaments, one per corner. Each is a
   small square just outside the corner with two brackets running along the
   edges from it (::before and ::after). Outside the card's clipped box, so
   they are siblings of it. */
const BRAIN_MEDIEVAL_FRONT = '<div class="viz-md" aria-hidden="true">'
  + ['is-top is-left', 'is-top is-right', 'is-bottom is-left', 'is-bottom is-right']
    .map(c => '<div class="viz-md-corner ' + c + '"></div>').join('')
  + '</div>';

/* Manhua: the bubble is sized round the text, so the text always sits inside
   it, however much is typed. An ellipse through a rectangle's corners is
   sqrt(2) times the rectangle's half-size, so each side gets about 21% of the
   text box; bursts letter inside their inner points, so they get more, and a
   caption hugs its text. Set as the text area's margins, which is what makes
   the note's box, and with it the bubble, that size. [x, y] per side. */
const BRAIN_BUBBLE_ROOM = {
  caption: [0, 0], yell: [0.33, 0.33], announce: [0.24, 0.24],
  'two-part': [0.3, 0.3], 'off-panel': [0.3, 0.3], 'speech-v': [0.14, 0.42]
};
function brainFitBubble(el, inner) {
  if (!el || el.dataset.border !== 'manhua') return false;
  const [kx, ky] = BRAIN_BUBBLE_ROOM[el.dataset.bubble] || [0.21, 0.21];
  const m = Math.round(inner.offsetHeight * ky + 6) + 'px ' + Math.round(inner.offsetWidth * kx + 8) + 'px';
  if (inner.style.margin === m) return false;
  inner.style.margin = m;
  return true;
}

/* Manhua's resize grip. The text area's own resize corner sat inside the
   balloon beside the words once the balloon was sized round the text, so a
   Manhua note hides it and carries this grip just inside the balloon's edge
   at its lower right (a caption's in its corner). Dragging resizes the text
   box and the balloon grows round it; the pointer is divided by how far the
   grip moves per pixel of text box (its place in the box times 1 + both
   margins) and by the zoom, so the grip stays under it. */
function brainBubbleResizeStart(e, nodeId, el) {
  if (e.button !== 0 || brainIsLocked()) return;
  e.stopPropagation();
  e.preventDefault();
  const inner = el.querySelector('.viz-node-inner');
  const grip = e.currentTarget;
  if (!inner || !grip) return;
  const [kx, ky] = BRAIN_BUBBLE_ROOM[el.dataset.bubble] || [0.21, 0.21];
  const at = el.dataset.bubble === 'caption' ? 1 : 0.8536;
  const z = brain.zoom || 1;
  const sx = e.clientX, sy = e.clientY, sw = inner.offsetWidth, sh = inner.offsetHeight;
  let moved = false;
  grip.setPointerCapture(e.pointerId);
  const move = ev => {
    if (!moved) { brainPushUndo(); moved = true; }
    inner.style.width = Math.max(100, sw + (ev.clientX - sx) / z / (at * (1 + 2 * kx))) + 'px';
    inner.style.height = Math.max(50, sh + (ev.clientY - sy) / z / (at * (1 + 2 * ky))) + 'px';
  };
  const up = () => {
    grip.removeEventListener('pointermove', move);
    grip.removeEventListener('pointerup', up);
    grip.removeEventListener('pointercancel', up);
    // The note's observer records the size; this keeps it.
    if (moved) {
      const node = brain.nodes.find(n => n.id === nodeId);
      if (node) { node.w = inner.offsetWidth; node.h = inner.offsetHeight; node.userSized = true; }
      brainSaveCurrentVersion();
    }
  };
  grip.addEventListener('pointermove', move);
  grip.addEventListener('pointerup', up);
  grip.addEventListener('pointercancel', up);
}

/** Electric's halo and sheen blur in proportion to the note (CSS --el-min). */
function brainSizeElectric(el, inner) {
  if (el.dataset.border !== 'electric') return;
  el.style.setProperty('--el-min', Math.min(inner.offsetWidth, inner.offsetHeight) + 'px');
}

function brainEnsureElectricFilter() {
  if (document.getElementById('viz-electric-defs')) return;
  // Four noise fields, scrolled in opposite directions and blended, displace the
  // border. Octaves past 6 are finer than a pixel at this base frequency, so 6
  // looks the same as 10 at a fraction of the cost.
  //
  // Each pair of fields is one noise scrolled by a period P and by P less, so
  // together they cover the filter area — but only if P is no bigger than that
  // area. The original scrolled 700px and 490px, exactly the area of its
  // 350x500 card; on a ~330x70 note that left most of the area with no noise,
  // and there the displacement map shifts the border a flat 15px instead of
  // crackling it. P is now under the smallest note's area (min 100x50 note ->
  // 140x90 here), and the loop is shortened to keep the original's speed
  // (about 117px/s down, 82px/s across).
  const PY = 80, PX = 120;
  const field = (seed, attr, from, to, dur, out, animate) =>
    `<feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="6" seed="${seed}"/>`
    + `<feOffset dx="0" dy="0" result="${out}">`
    + (animate ? `<animate attributeName="${attr}" values="${from}; ${to}" dur="${dur}s" repeatCount="indefinite" calcMode="linear"/>` : '')
    + '</feOffset>';
  const filter = (id, animate) =>
    `<filter id="${id}" color-interpolation-filters="sRGB" x="-20%" y="-40%" width="140%" height="180%">`
    + field(1, 'dy', PY, 0, 0.68, 'o1', animate) + field(1, 'dy', 0, -PY, 0.68, 'o2', animate)
    + field(2, 'dx', PX, 0, 1.46, 'o3', animate) + field(2, 'dx', 0, -PX, 1.46, 'o4', animate)
    + '<feComposite in="o1" in2="o2" result="p1"/><feComposite in="o3" in2="o4" result="p2"/>'
    + '<feBlend in="p1" in2="p2" mode="color-dodge" result="noise"/>'
    + '<feDisplacementMap in="SourceGraphic" in2="noise" scale="30" xChannelSelector="R" yChannelSelector="B"/>'
    + '</filter>';
  const holder = document.createElement('div');
  holder.innerHTML = '<svg id="viz-electric-defs" aria-hidden="true" focusable="false" width="0" height="0"'
    + ' style="position:absolute;width:0;height:0;overflow:hidden"><defs>'
    + filter('viz-electric-displace', true)
    + filter('viz-electric-still', false)   // reduced motion: jagged, but still
    + '</defs></svg>';
  document.body.appendChild(holder.firstElementChild);
}


function brainCtxSetBorder(type) {
  const node = brain.contextNodeId && brain.nodes.find(n => n.id === brain.contextNodeId);
  if (!node || (node.border || null) === (type || null)) return;
  brainPushUndo();
  if (type) node.border = type; else delete node.border;
  _brainRememberStyle(node);
  brainRenderCanvas(); brainSaveCurrentVersion();
  // The menu stays open: picking Manhua reveals its Bubble dropdown here.
  _brainMarkNodeMenu();
}

/* ── Manhua bubbles ─────────────────────────────────────────────
   The speech-bubble shapes of a comic page. Every Manhua note's bubble is
   drawn into one SVG under all the notes, in two passes: first every outline
   at double width, then every fill on top. A fill hides the inner half of its
   own outline and any part of another bubble's outline inside it, so where
   bubbles overlap only the outside edge of the union is left: they merge, the
   way lettered balloons do. */
const BRAIN_BUBBLES = [
  ['speech', 'Normal Speech'], ['speech-v', 'Speech (Vertical)'], ['two-part', 'Speech in Two Parts'],
  ['off-panel', 'Off-Panel Speech'], ['yell', 'Yelling'], ['weak', 'Weak or Fading'],
  ['whisper', 'Whispering'], ['announce', 'Announcement'], ['think', 'Thinking'],
  ['daydream', 'Daydreaming'], ['caption', 'Caption or Narration'], ['negative', 'Negative Emotions']
];
const BRAIN_BUBBLE_IDS = new Set(BRAIN_BUBBLES.map(b => b[0]));
let _brainBubbleRO = null;   // see brainRenderCanvas

function brainCtxSetBubble(id) {
  const node = brain.contextNodeId && brain.nodes.find(n => n.id === brain.contextNodeId);
  if (!node || (node.bubble || 'speech') === id) return;
  brainPushUndo();
  if (id === 'speech') delete node.bubble; else node.bubble = id;
  _brainRememberStyle(node);
  brainRenderCanvas(); brainSaveCurrentVersion();
  _brainMarkNodeMenu();
}

/** Repaint every Manhua bubble (cheap: only Manhua notes are measured). */
function brainPaintBubbles() {
  const svg = document.getElementById('brain-bubbles');
  if (!svg) return;
  let strokes = '', fills = '';
  brain.nodes.forEach(node => {
    if (node.border !== 'manhua') return;
    const el = svg.parentNode.querySelector(`.viz-node[data-node-id="${node.id}"]`);
    if (!el || el.classList.contains('viz-globe-node')) return;
    const shape = BRAIN_BUBBLE_IDS.has(node.bubble) ? node.bubble : 'speech';
    const parts = _brainBubbleShape(shape, node.x, node.y, el.offsetWidth, el.offsetHeight, _brainBubbleRand(node.id));
    const neg = shape === 'negative';
    const fill = node.bg ? vizColorMap(node.bg) : (neg ? '#0a0a0a' : '#ffffff');
    // Manhua's own default edge is the comic outline: black (light on the black
    // Negative balloon). Every border type keeps its own default.
    const stroke = node.color ? vizColorMap(node.color) : (neg ? '#f8fafc' : '#111111');
    const dash = shape === 'whisper' ? ';stroke-dasharray:8 6' : '';
    const ghost = el.classList.contains('viz-bridge-ghost') ? ' opacity="0.25"' : '';
    // Selection does not touch the bubble: no recoloured edge, no glow.
    // data-node-id lets hover focus fade a bubble with its note (vizHoverFocus).
    parts.forEach(d => {
      strokes += `<path data-node-id="${node.id}" d="${d}" style="stroke:${stroke}${dash}"${ghost}/>`;
      fills += `<path data-node-id="${node.id}" d="${d}" style="fill:${fill}"${ghost}/>`;
    });
  });
  svg.innerHTML = `<g class="bb-strokes">${strokes}</g><g class="bb-fills">${fills}</g>`;
}

/* Seeded per note, so a yell's spikes or a cloud's puffs keep their shape
   from one render to the next. */
function _brainBubbleRand(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => {
    h += 0x6D2B79F5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A bubble around a note's box, as separate closed paths (each filled on its
 *  own, so overlapping pieces never cancel out). Angles are clockwise from +x,
 *  screen y down; tails point down and to the right. */
function _brainBubbleShape(shape, x, y, w, h, rnd) {
  const f = n => Math.round(n * 10) / 10;
  const pt = p => f(p[0]) + ' ' + f(p[1]);
  const poly = pts => 'M' + pts.map(pt).join('L') + 'Z';
  const ellipse = (cx, cy, rx, ry) =>
    `M${f(cx - rx)} ${f(cy)}A${f(rx)} ${f(ry)} 0 1 1 ${f(cx + rx)} ${f(cy)}A${f(rx)} ${f(ry)} 0 1 1 ${f(cx - rx)} ${f(cy)}Z`;
  const deg = a => a * Math.PI / 180;
  const on = (cx, cy, rx, ry, a, k = 1) => [cx + rx * k * Math.cos(deg(a)), cy + ry * k * Math.sin(deg(a))];
  // The bubble fills the note's own box: the text area has a margin round it
  // (CSS, per shape), so the box is already bubble-sized. An ellipse fitted to
  // a box meets it at the middle of each side, which is where the ports sit
  // and where links end, so both land on the bubble's edge. Drawn outside the
  // box instead, they all sat inside the balloon.
  const box = () => ({ cx: x + w / 2, cy: y + h / 2, rx: w / 2, ry: h / 2 });
  const tail = (b, a1 = 52, a2 = 74, tip = [0.66, 1.42]) =>
    poly([on(b.cx, b.cy, b.rx, b.ry, a1, 0.8), [b.cx + b.rx * tip[0], b.cy + b.ry * tip[1]], on(b.cx, b.cy, b.rx, b.ry, a2, 0.8)]);
  const perim = (rx, ry) => Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
  // Puffs: arcs bulging outward between points round the ellipse.
  const cloud = (b, size, jitter) => {
    const n = Math.max(8, Math.min(40, Math.round(perim(b.rx, b.ry) / size)));
    const pts = [];
    for (let i = 0; i < n; i++) pts.push(on(b.cx, b.cy, b.rx, b.ry, (360 / n) * (i + (jitter ? (rnd() - 0.5) * 0.4 : 0))));
    let d = 'M' + pt(pts[0]);
    for (let i = 1; i <= n; i++) {
      const a = pts[i - 1], c = pts[i % n];
      const r = Math.hypot(c[0] - a[0], c[1] - a[1]) * (jitter ? 0.55 + rnd() * 0.25 : 0.62);
      d += `A${f(r)} ${f(r)} 0 0 1 ${pt(c)}`;
    }
    return d + 'Z';
  };
  // Spikes: alternating outer and inner points round the ellipse.
  const burst = (b, n, outer, inner, jitter) => {
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
      const a = (180 / n) * i + (jitter ? (rnd() - 0.5) * (120 / n) : 0);
      const k = i % 2 === 0 ? outer + (jitter ? rnd() * 0.3 : 0) : inner + (jitter ? rnd() * 0.06 : 0);
      pts.push(on(b.cx, b.cy, b.rx, b.ry, a, k));
    }
    return poly(pts);
  };
  const circle = (cx, cy, r) => `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;

  switch (shape) {
    case 'speech-v': {
      const b = box(0.06, 0.38);
      return [ellipse(b.cx, b.cy, b.rx, b.ry), tail(b)];
    }
    case 'two-part': {
      const b = box(0.1, 0.2);
      const X = b.cx - b.rx, Y = b.cy - b.ry, W = b.rx * 2, H = b.ry * 2;
      const B = { cx: X + W * 0.66, cy: Y + H * 0.6, rx: W * 0.36, ry: H * 0.45 };
      return [ellipse(X + W * 0.34, Y + H * 0.4, W * 0.36, H * 0.45), ellipse(B.cx, B.cy, B.rx, B.ry), tail(B)];
    }
    case 'off-panel': {
      // A notch cut into the edge instead of a tail: the speaker is off-panel.
      const b = box(0.1, 0.2);
      const g1 = on(b.cx, b.cy, b.rx, b.ry, 36), g2 = on(b.cx, b.cy, b.rx, b.ry, 54);
      const notch = on(b.cx, b.cy, b.rx, b.ry, 45, 0.74);
      return [`M${pt(g2)}A${f(b.rx)} ${f(b.ry)} 0 1 1 ${pt(g1)}L${pt(notch)}Z`];
    }
    case 'yell':
      return [burst(box(0.14, 0.26), 13, 1.12, 0.86, true)];
    case 'announce':
      return [burst(box(0.14, 0.26), 24, 1.2, 0.97, false)];
    case 'weak': {
      const b = box(0.1, 0.22);
      // A thin tail with a wobble in it, like the voice trailing off.
      const b1 = on(b.cx, b.cy, b.rx, b.ry, 58, 0.85), b2 = on(b.cx, b.cy, b.rx, b.ry, 66, 0.85);
      const tip = [b.cx + b.rx * 0.5, b.cy + b.ry * 1.6];
      const c1 = [b.cx + b.rx * 0.78, b.cy + b.ry * 1.18], c2 = [b.cx + b.rx * 0.68, b.cy + b.ry * 1.22];
      return [cloud(b, 26, true), `M${pt(b1)}Q${pt(c1)} ${pt(tip)}Q${pt(c2)} ${pt(b2)}Z`];
    }
    case 'whisper': {
      const b = box(0.1, 0.2);
      return [ellipse(b.cx, b.cy, b.rx, b.ry), tail(b, 56, 70, [0.6, 1.32])];
    }
    case 'think':
    case 'negative': {
      const b = box(0.1, 0.2);
      return [ellipse(b.cx, b.cy, b.rx, b.ry)];
    }
    case 'daydream': {
      const b = box(0.1, 0.22);
      const r = Math.min(b.rx, b.ry) * 0.17 + 3;
      return [cloud(b, 38, false),
        circle(b.cx + b.rx * 0.72, b.cy + b.ry * 1.14, r),
        circle(b.cx + b.rx * 0.92, b.cy + b.ry * 1.36, r * 0.66),
        circle(b.cx + b.rx * 1.06, b.cy + b.ry * 1.52, r * 0.42)];
    }
    case 'caption': {
      const X = x, Y = y, W = w, H = h, r = 8;
      return [`M${f(X + r)} ${f(Y)}H${f(X + W - r)}A${r} ${r} 0 0 1 ${f(X + W)} ${f(Y + r)}V${f(Y + H - r)}`
        + `A${r} ${r} 0 0 1 ${f(X + W - r)} ${f(Y + H)}H${f(X + r)}A${r} ${r} 0 0 1 ${f(X)} ${f(Y + H - r)}`
        + `V${f(Y + r)}A${r} ${r} 0 0 1 ${f(X + r)} ${f(Y)}Z`];
    }
    default: {   // speech
      const b = box(0.1, 0.2);
      return [ellipse(b.cx, b.cy, b.rx, b.ry), tail(b)];
    }
  }
}

function brainLinkCtx(e, linkId) {
  e.preventDefault(); e.stopPropagation();
  brainHideAllMenus();
  brain.contextLinkId = linkId;
  const menu = document.getElementById('brain-link-ctx');
  if (!menu) return;
  // Opens collapsed, and before it is measured, so it is placed at its real size.
  const sub = document.getElementById('brain-link-type-menu');
  const toggle = document.getElementById('brain-link-type-toggle');
  if (sub) sub.classList.add('hidden');
  if (toggle) toggle.setAttribute('aria-expanded', 'false');
  if (typeof vizPositionMenu === 'function') vizPositionMenu(menu, e.clientX, e.clientY);
  else { menu.style.left = e.clientX + 'px'; menu.style.top = e.clientY + 'px'; menu.classList.remove('hidden'); }
  const link = brain.links.find(l => l.id === linkId);
  menu.querySelectorAll('.viz-color-swatch').forEach(sw => { sw.classList.toggle('active', sw.dataset.color === (link?.color || '')); });
  const type = (link && link.arrowType) || 'arrow';
  menu.querySelectorAll('#brain-link-type-menu .viz-link-type-option').forEach(o => o.classList.toggle('active', o.dataset.type === type));
}

/** Connector Type: opens its options inside the link menu, below the row. */
function brainToggleConnectorType(e) {
  _brainToggleCtxSub(e, 'brain-link-ctx', 'brain-link-type-menu', 'brain-link-type-toggle');
}

/** A dropdown that opens inside a context menu, below its own row. */
function _brainToggleCtxSub(e, menuId, subId, toggleId) {
  if (e) e.stopPropagation();
  const menu = document.getElementById(menuId);
  const sub = document.getElementById(subId);
  const toggle = document.getElementById(toggleId);
  if (!menu || !sub) return;
  const open = !sub.classList.toggle('hidden');
  if (toggle) toggle.setAttribute('aria-expanded', String(open));
  // The menu just grew; opened near the bottom of the screen it would run off.
  const r = menu.getBoundingClientRect();
  const over = r.bottom - (window.innerHeight - 6);
  if (over > 0) menu.style.top = Math.max(6, r.top - over) + 'px';
}

function brainCtxSetLinkArrow(type) {
  const link = brain.contextLinkId && brain.links.find(l => l.id === brain.contextLinkId);
  if (!link || (link.arrowType || 'arrow') === type) { brainHideAllMenus(); return; }
  brainPushUndo();
  link.arrowType = type;
  brainRenderCanvas(); brainSaveCurrentVersion();
  brainHideAllMenus();
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


function brainCtxDeleteLink() {
  if (brain.contextLinkId) brainDeleteLink(brain.contextLinkId);
  brainHideAllMenus();
}

function brainCtxEditLinkColor(color) {
  if (!brain.contextLinkId) { brainHideAllMenus(); return; }
  const link = brain.links.find(l => l.id === brain.contextLinkId);
  if (!link) { brainHideAllMenus(); return; }
  brainPushUndo();
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
  // The minimap switch is shared with the library canvases now (it lives in
  // the toolbar's More menu), so Brain no longer owns it.
  if (typeof vizApplyMinimapVisibility === 'function') vizApplyMinimapVisibility();
  [['brain-snap-btn', o.snap], ['brain-links-btn', o.links],
   ['brain-lock-btn', brainIsLocked()]
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
    el.innerHTML = '<i data-lucide="check-circle-2" style="width:11px;height:11px;"></i><span class="brain-saved-text"></span>';
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
