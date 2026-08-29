/* ============================================================
   WING.JS — the generic list library
   ------------------------------------------------------------
   The Library hub advertised eight "coming soon" wings — Language, Mindset,
   Insights, Remembrance, Diary, Collection, Progression, Roadmap — that did
   nothing but raise a toast. They are all the same shape: titled entries with a
   body, tags and folders. So there is ONE implementation and the eight are
   configuration, sharing the folder system, the search, the favourites, the
   tag filter and the bulk bar with every other library.

   Storage:  state.wings = { <key>: [ { id, title, body, tags[], parentId,
                                        favorite, createdAt, updatedAt } ] }
   Folders:  ordinary state.nodes with scope 'wing:<key>'.
   ============================================================ */

let _wingKey = 'language';
let _wingFolderId = null;      // null = every entry
let _wingActiveId = null;
let _wingEditing = null;       // id being edited, or 'new'

function wingConfig(key) {
  const list = (typeof LIBRARY_PLACEHOLDERS !== 'undefined') ? LIBRARY_PLACEHOLDERS : [];
  return list.find(p => p.key === key) || { key, name: 'Library', icon: 'library', tagline: '' };
}

function wingScope(key) { return 'wing:' + (key || _wingKey); }

function wingItems(key) {
  if (!state.wings || typeof state.wings !== 'object') state.wings = {};
  const k = key || _wingKey;
  if (!Array.isArray(state.wings[k])) state.wings[k] = [];
  return state.wings[k];
}

/** Every wing's entries at once, for the hub's cross-library search. */
function wingAllItems() {
  const out = [];
  const keys = (typeof LIBRARY_PLACEHOLDERS !== 'undefined' ? LIBRARY_PLACEHOLDERS : []).map(p => p.key);
  keys.forEach(k => wingItems(k).forEach(item => out.push({ key: k, item })));
  return out;
}

function wingFind(id) { return wingItems().find(w => w.id === id) || null; }

/** The wing key rides in the hash (#/wing?k=diary) so links are shareable. */
function _wingKeyFromHash() {
  const m = /[?&]k=([\w-]+)/.exec(window.location.hash || '');
  return m ? m[1] : null;
}

/* ── Route ────────────────────────────────────────────────── */

function wingTemplate() {
  return `
    <div class="messenger-layout">
      <main class="messenger-pane-1">
        <div class="pane-1-header">
          <div style="display:flex; align-items:center; gap:0.5rem; width:100%; justify-content:space-between;">
            <div style="display:flex; align-items:center; gap:0.5rem; flex:1; min-width:0;">
              <button onclick="spaNavigate('library')" class="btn-back-dark" style="margin-right:0.5rem; padding:0.25rem 0.5rem; font-size:0.75rem; flex-shrink:0;">
                <i data-lucide="chevron-left" style="width:14px;height:14px;"></i> Back
              </button>
              <h2 class="section-header-animated" style="margin:0; display:flex; align-items:center;">
                <span class="section-header-icon-wrap browse-icon-wrap">
                  <i data-lucide="library" id="wing-header-icon"></i>
                  <span class="section-header-icon-ring"></span>
                </span>
                <span class="section-header-text">
                  <span class="section-header-title" id="wing-header-title">Library</span>
                  <span class="section-header-subtitle" id="wing-header-stats"></span>
                </span>
              </h2>
            </div>
            <button class="tutorial-trigger-btn" onclick="wingNewFolder()" title="New folder">
              <i data-lucide="folder-plus"></i>
            </button>
          </div>
          <div class="search-container search-animated" style="width:100%;">
            <i data-lucide="search"></i>
            <input type="text" id="wing-search" oninput="wingRenderDetail()" placeholder="Search entries..." class="search-input">
          </div>
          <div class="browse-mini-stats" id="wing-mini-stats"></div>
        </div>
        <div class="pane-1-content tree-container" id="wing-folder-list"></div>
      </main>
      <div class="resizer-divider" onmousedown="initResizerDrag(event, this)"></div>
      <section class="messenger-pane-2">
        <div id="wing-detail" style="padding:2rem; min-height:100%;"></div>
      </section>
    </div>`;
}

function wingInit() {
  const k = _wingKeyFromHash();
  if (k) _wingKey = k;
  _wingFolderId = null;
  _wingActiveId = null;
  _wingEditing = null;
  wingItems();                       // ensure the bucket exists
  wingRenderSidebar();
  wingRenderDetail();
  wingUpdateHeader();
}

function wingDestroy() { _wingEditing = null; }

function wingUpdateHeader() {
  const cfg = wingConfig(_wingKey);
  const items = wingItems();
  const folders = state.nodes.filter(n => n.type === 'folder' && n.scope === wingScope());
  const title = document.getElementById('wing-header-title');
  const sub = document.getElementById('wing-header-stats');
  const icon = document.getElementById('wing-header-icon');
  if (title) title.textContent = cfg.name;
  if (sub) sub.textContent = `${items.length} entr${items.length === 1 ? 'y' : 'ies'} across ${folders.length} folder${folders.length !== 1 ? 's' : ''}`;
  if (icon) { icon.setAttribute('data-lucide', cfg.icon); if (typeof lucide !== 'undefined') lucide.createIcons({ root: icon.parentElement }); }

  const mini = document.getElementById('wing-mini-stats');
  if (mini) {
    const favs = items.filter(libIsFavorite).length;
    mini.innerHTML = `
      <div class="mini-stat-chip" title="Total entries"><i data-lucide="file-text" style="width:12px;height:12px;"></i>
        <span class="mini-stat-value">${items.length}</span><span class="mini-stat-label">Total</span></div>
      <div class="mini-stat-chip${favs ? ' completed' : ''}" title="Favourites"><i data-lucide="star" style="width:12px;height:12px;"></i>
        <span class="mini-stat-value">${favs}</span><span class="mini-stat-label">Starred</span></div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: mini });
  }
}

function wingRenderSidebar() {
  const host = document.getElementById('wing-folder-list');
  if (!host) return;
  const all = wingItems();
  const rows = [`
    <div class="tree-node">
      <div class="tree-node-row ${_wingFolderId === null ? 'active' : ''}" onclick="wingSelectFolder(null)">
        <i class="tree-node-chevron invisible"></i>
        <i data-lucide="layers" class="tree-node-icon" style="width:14px;height:14px;"></i>
        <span class="tree-node-label">All entries</span>
        <span class="tree-node-count">${all.length}</span>
      </div>
    </div>`];

  const walk = (parentId, depth) => {
    getChildFolders(parentId, wingScope()).forEach(f => {
      const count = all.filter(w => (w.parentId || null) === f.id).length;
      rows.push(`
        <div class="tree-node" data-node-id="${f.id}">
          <div class="tree-node-row ${_wingFolderId === f.id ? 'active' : ''}"
               style="padding-left: calc(0.5rem + ${depth * 0.75}rem)"
               onclick="wingSelectFolder('${f.id}')"
               oncontextmenu="event.preventDefault(); wingFolderMenu('${f.id}')">
            <i class="tree-node-chevron invisible"></i>
            <i data-lucide="${f.icon || 'folder'}" class="tree-node-icon" style="width:14px;height:14px;"></i>
            <span class="tree-node-label">${escapeHTML(f.name)}</span>
            <span class="tree-node-count">${count}</span>
          </div>
        </div>`);
      walk(f.id, depth + 1);
    });
  };
  walk(null, 1);

  host.innerHTML = rows.join('');
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: host });
}

function wingSelectFolder(id) {
  _wingFolderId = id;
  _wingActiveId = null;
  _wingEditing = null;
  wingRenderSidebar();
  wingRenderDetail();
}

/* ── Detail pane: list, reader, editor ────────────────────── */

function wingRenderDetail() {
  const host = document.getElementById('wing-detail');
  if (!host) return;

  if (_wingEditing) { host.innerHTML = _wingEditorHTML(); _wingAfterRender(host); return; }
  if (_wingActiveId) {
    const item = wingFind(_wingActiveId);
    if (item) { host.innerHTML = _wingReaderHTML(item); _wingAfterRender(host); return; }
    _wingActiveId = null;
  }

  const cfg = wingConfig(_wingKey);
  const searchEl = document.getElementById('wing-search');
  const query = searchEl ? searchEl.value.trim() : '';

  let pool = wingItems();
  if (query) pool = pool.filter(w => libMatches(w, query, 'wing'));
  else if (_wingFolderId !== null) pool = pool.filter(w => (w.parentId || null) === _wingFolderId);

  const prefiltered = pool;
  let list = libApplyCommonFilters('wing', pool.slice(), null);
  const sort = getLibPref('wing.sort', 'recent');
  if (sort === 'title') list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  else if (sort === 'oldest') list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  else list.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
  list.sort((a, b) => (libIsFavorite(b) ? 1 : 0) - (libIsFavorite(a) ? 1 : 0));

  const folder = _wingFolderId ? state.nodes.find(n => n.id === _wingFolderId) : null;
  const heading = query ? `Search results for “${escapeHTML(query)}”` : (folder ? escapeHTML(folder.name) : 'All entries');

  const sortOpts = [['recent', 'Recently updated'], ['oldest', 'Oldest first'], ['title', 'Title A–Z']];
  const filterBar = prefiltered.length ? `
    <div style="display:flex;flex-wrap:wrap;align-items:center;gap:0.5rem;margin-bottom:1rem;">
      ${(() => { const c = libCommonChipsHTML('wing', null, prefiltered); return c ? `<div class="lib-chip-row">${c}</div>` : ''; })()}
      ${libTagChipsHTML('wing', prefiltered)}
      <div style="display:flex;gap:0.4rem;align-items:center;margin-left:auto;">
        <span style="font-size:0.72rem;color:var(--text-tertiary);">${list.length} of ${prefiltered.length}</span>
        <i data-lucide="arrow-down-up" style="width:13px;height:13px;color:var(--text-tertiary);"></i>
        <select class="form-select" style="font-size:0.74rem;padding:0.22rem 1.5rem 0.22rem 0.5rem;height:auto;width:auto;"
                onchange="setLibPref('wing.sort', this.value); wingRenderDetail();">
          ${sortOpts.map(([v, l]) => `<option value="${v}"${sort === v ? ' selected' : ''}>${l}</option>`).join('')}
        </select>
      </div>
    </div>` : '';

  host.innerHTML = `
    <div class="animate-fade-in">
      <div class="browse-folder-header">
        <div class="browse-folder-info">
          <h2 class="browse-folder-title" style="cursor:default;">${heading}</h2>
          <p class="browse-folder-desc" style="cursor:default;">${escapeHTML(cfg.tagline)}</p>
        </div>
        <div class="browse-folder-actions">
          ${libSelectToggleHTML('wing')}
          <button class="btn btn-primary" onclick="wingNewEntry()"><i data-lucide="plus" style="width:16px;height:16px;"></i> New entry</button>
        </div>
      </div>
      ${filterBar}
      ${list.length ? `<div class="card-grid stagger-children">${list.map(_wingCardHTML).join('')}</div>` : `
        <div class="empty-state" style="padding:3rem 1rem; text-align:center; display:flex; flex-direction:column; align-items:center;">
          <i data-lucide="${cfg.icon}" style="width:44px;height:44px;opacity:0.45;margin-bottom:0.75rem;"></i>
          <h3 style="font-weight:700;">${prefiltered.length ? 'Nothing matches these filters' : 'Nothing here yet'}</h3>
          <p style="font-size:0.85rem;color:var(--text-tertiary);margin-top:0.35rem;">${prefiltered.length ? '' : escapeHTML(cfg.tagline)}</p>
          <button class="btn btn-primary" style="margin-top:1rem;" onclick="${prefiltered.length ? `clearWingFilters()` : `wingNewEntry()`}">
            <i data-lucide="${prefiltered.length ? 'x' : 'plus'}" style="width:15px;height:15px;"></i> ${prefiltered.length ? 'Clear filters' : 'Add the first entry'}
          </button>
        </div>`}
      ${libSelectionBarHTML('wing', list.map(w => w.id))}
    </div>`;
  _wingAfterRender(host);
}

function clearWingFilters() { libClearCommonFilters('wing'); wingRenderDetail(); }

function _wingAfterRender(host) {
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: host });
}

function _wingSnippet(body, n) {
  return String(body || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n || 160);
}

function _wingCardHTML(w) {
  const selecting = libSelectMode('wing');
  const when = w.updatedAt || w.createdAt;
  return `
    <div class="card card-enhanced${libIsSelected('wing', w.id) ? ' lib-selected' : ''}"
         onclick="${selecting ? `libToggleSelect('wing','${w.id}')` : `wingOpen('${w.id}')`}" style="cursor:pointer;">
      ${libSelectBoxHTML('wing', w.id)}
      ${libFavButtonHTML('wing', w)}
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem; gap:0.5rem;">
        <h3 style="font-weight:700; font-size:1.05rem; color:var(--text-primary); flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis;">
          ${escapeHTML(w.title || 'Untitled')}
        </h3>
      </div>
      ${(w.tags || []).length ? `<div style="display:flex; flex-wrap:wrap; gap:0.375rem; margin-bottom:0.75rem;">
        ${(w.tags || []).map(t => libTagBadgeHTML('wing', t)).join('')}</div>` : ''}
      <p class="line-clamp-2" style="font-size:0.875rem; color:var(--text-secondary); margin-bottom:0.75rem; min-height:2.5rem;">
        ${escapeHTML(_wingSnippet(w.body) || 'No content yet.')}
      </p>
      ${when ? `<div class="card-last-attempt"><i data-lucide="clock" style="width:11px;height:11px;"></i> ${new Date(when).toLocaleDateString()}</div>` : ''}
      <div style="margin-top:auto; display:flex; gap:0.5rem; padding-top:0.5rem;">
        <button class="btn btn-practice" style="flex:1;" onclick="event.stopPropagation(); wingOpen('${w.id}')">
          <i data-lucide="book-open" style="width:16px;height:16px;"></i> Read
        </button>
        <button class="btn btn-ghost" title="Edit" style="padding:0.5rem;" onclick="event.stopPropagation(); wingEdit('${w.id}')">
          <i data-lucide="pencil" style="width:16px;height:16px;"></i>
        </button>
      </div>
    </div>`;
}

function _wingReaderHTML(w) {
  const when = w.updatedAt || w.createdAt;
  return `
    <div class="animate-fade-in" style="max-width:780px;margin:0 auto;">
      <button class="btn btn-ghost btn-sm" onclick="wingBack()" style="margin-bottom:1rem;">
        <i data-lucide="chevron-left" style="width:14px;height:14px;"></i> Back to entries
      </button>
      <h1 style="font-size:1.9rem;font-weight:800;color:var(--text-primary);margin-bottom:0.5rem;">${escapeHTML(w.title || 'Untitled')}</h1>
      <div style="display:flex;flex-wrap:wrap;gap:0.4rem;align-items:center;margin-bottom:1.25rem;">
        ${(w.tags || []).map(t => libTagBadgeHTML('wing', t)).join('')}
        ${when ? `<span style="font-size:0.75rem;color:var(--text-tertiary);">Updated ${new Date(when).toLocaleString()}</span>` : ''}
      </div>
      <div class="wing-body">${w.body ? escapeHTML(w.body).replace(/\n/g, '<br/>') : '<em style="color:var(--text-tertiary);">No content yet.</em>'}</div>
      <div style="display:flex;gap:0.6rem;margin-top:2rem;">
        <button class="btn btn-primary" onclick="wingEdit('${w.id}')"><i data-lucide="pencil" style="width:16px;height:16px;"></i> Edit</button>
        <button class="btn btn-secondary" onclick="libToggleFavorite('wing','${w.id}')">
          <i data-lucide="star" style="width:16px;height:16px;${libIsFavorite(w) ? 'fill:currentColor;' : ''}"></i> ${libIsFavorite(w) ? 'Starred' : 'Star'}
        </button>
        <button class="btn btn-danger" style="margin-left:auto;" onclick="wingDelete('${w.id}')"><i data-lucide="trash-2" style="width:16px;height:16px;"></i> Delete</button>
      </div>
    </div>`;
}

function _wingEditorHTML() {
  const isNew = _wingEditing === 'new';
  const w = isNew ? { title: '', body: '', tags: [], parentId: _wingFolderId } : (wingFind(_wingEditing) || { title: '', body: '', tags: [] });
  const folders = [];
  const walk = (pid, d) => getChildFolders(pid, wingScope()).forEach(f => { folders.push({ id: f.id, label: '— '.repeat(d) + f.name }); walk(f.id, d + 1); });
  walk(null, 0);
  return `
    <div class="animate-fade-in" style="max-width:780px;margin:0 auto;">
      <button class="btn btn-ghost btn-sm" onclick="wingBack()" style="margin-bottom:1rem;">
        <i data-lucide="chevron-left" style="width:14px;height:14px;"></i> Cancel
      </button>
      <h2 style="font-size:1.35rem;font-weight:800;margin-bottom:1.25rem;">${isNew ? 'New entry' : 'Edit entry'}</h2>
      <div class="af-field"><label class="form-label">Title</label>
        <input id="wing-f-title" class="form-input af-input-bold" value="${escapeHTML(w.title || '')}" placeholder="Give it a name…" /></div>
      <div class="af-field"><label class="form-label">Folder</label>
        <select id="wing-f-folder" class="form-select">
          <option value="">Uncategorized</option>
          ${folders.map(f => `<option value="${f.id}"${(w.parentId || '') === f.id ? ' selected' : ''}>${escapeHTML(f.label)}</option>`).join('')}
        </select></div>
      <div class="af-field"><label class="form-label">Tags <span class="af-label-hint">(comma separated)</span></label>
        <input id="wing-f-tags" class="form-input" value="${escapeHTML((w.tags || []).join(', '))}" placeholder="e.g. grammar, verbs" /></div>
      <div class="af-field"><label class="form-label">Content</label>
        <textarea id="wing-f-body" class="form-textarea" rows="14" placeholder="Write it out…">${escapeHTML(w.body || '')}</textarea></div>
      <div style="display:flex;gap:0.6rem;margin-top:1rem;">
        <button class="btn btn-primary" onclick="wingSave()"><i data-lucide="save" style="width:16px;height:16px;"></i> Save</button>
        <button class="btn btn-secondary" onclick="wingBack()">Cancel</button>
      </div>
    </div>`;
}

/* ── Actions ──────────────────────────────────────────────── */

function wingOpen(id) { _wingActiveId = id; _wingEditing = null; wingRenderDetail(); }
function wingEdit(id) { _wingEditing = id; wingRenderDetail(); }
function wingNewEntry() { _wingEditing = 'new'; _wingActiveId = null; wingRenderDetail(); }
function wingBack() { _wingEditing = null; _wingActiveId = null; wingRenderDetail(); }

function wingSave() {
  const title = (document.getElementById('wing-f-title') || {}).value || '';
  if (!title.trim()) { if (typeof toast === 'function') toast('Give it a title first.', { type: 'warning' }); return; }
  const body = (document.getElementById('wing-f-body') || {}).value || '';
  const tags = String((document.getElementById('wing-f-tags') || {}).value || '')
    .split(',').map(t => t.trim()).filter(Boolean);
  const parentId = (document.getElementById('wing-f-folder') || {}).value || null;

  const items = wingItems();
  if (_wingEditing === 'new') {
    const item = { id: generateId(), title: title.trim(), body, tags, parentId, favorite: false,
                   createdAt: Date.now(), updatedAt: Date.now() };
    items.push(item);
    _wingActiveId = item.id;
  } else {
    const item = wingFind(_wingEditing);
    if (item) {
      Object.assign(item, { title: title.trim(), body, tags, parentId, updatedAt: Date.now() });
      _wingActiveId = item.id;
    }
  }
  _wingEditing = null;
  saveData();
  wingRenderSidebar();
  wingRenderDetail();
  wingUpdateHeader();
  if (typeof toast === 'function') toast('Saved.', { type: 'success' });
}

function wingDelete(id) {
  const item = wingFind(id);
  if (!item) return;
  const key = _wingKey;
  showConfirm('Delete entry', `Delete “${item.title || 'Untitled'}”?`, () => {
    const items = wingItems(key);
    const i = items.findIndex(w => w.id === id);
    if (i < 0) return;
    const snapshot = JSON.parse(JSON.stringify(items[i]));
    items.splice(i, 1);
    _wingActiveId = null;
    saveData();
    wingRenderSidebar();
    wingRenderDetail();
    wingUpdateHeader();
    // It used to say "This can't be undone from here", which was true and is
    // the only delete left in the app that had to admit it.
    if (typeof pushUndo === 'function') {
      pushUndo('Deleted "' + (snapshot.title || 'Untitled') + '"', () => {
        const list = wingItems(key);
        list.splice(Math.min(i, list.length), 0, snapshot);
        saveData();
        wingRenderSidebar();
        wingRenderDetail();
        wingUpdateHeader();
      });
    }
  });
}

function wingNewFolder() {
  showInputDialog('New folder', `A folder inside ${wingConfig(_wingKey).name}.`, 'Folder name', '', (name) => {
    if (!name || !name.trim()) return;
    state.nodes.push({
      id: generateId(), name: name.trim(), type: 'folder',
      parentId: _wingFolderId || null, scope: wingScope(), order: state.nodes.length
    });
    saveData();
    wingRenderSidebar();
    wingUpdateHeader();
  });
}

function wingFolderMenu(id) {
  const node = state.nodes.find(n => n.id === id);
  if (!node) return;
  showInputDialog('Rename folder', 'Leave empty to delete this folder (its entries move to Uncategorized).',
    'Folder name', node.name, (name) => {
      if (name && name.trim()) {
        node.name = name.trim();
      } else {
        wingItems().forEach(w => { if (w.parentId === id) w.parentId = null; });
        state.nodes = state.nodes.filter(n => n.id !== id);
        if (_wingFolderId === id) _wingFolderId = null;
      }
      saveData();
      wingRenderSidebar();
      wingRenderDetail();
      wingUpdateHeader();
    });
}

registerLibAdapter('wing', {
  // A getter, not a value: one adapter serves all eight wings, and which one is
  // open changes as you navigate.
  get scope() { return wingScope(); },
  noun: 'entry',
  list: () => wingItems(),
  find: (id) => wingFind(id),
  remove: (id) => { const items = wingItems(); const i = items.findIndex(w => w.id === id); if (i >= 0) items.splice(i, 1); },
  rerender: () => { wingRenderSidebar(); wingRenderDetail(); wingUpdateHeader(); }
});
