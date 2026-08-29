/* ============================================================
   WING.JS — the generic list library
   ------------------------------------------------------------
   Seven wings — Mindset, Insights, Remembrance, Diary, Collection,
   Progression, Roadmap — share one engine: titled entries with a body, tags
   and folders, plus the folder system, the search, the favourites, the tag
   filter and the bulk bar every other library uses.

   What makes them different from each other is NOT here. Each wing owns one
   file in js/wings/ and one in css/wings/, registers itself through
   wing-common.js, and brings its own fields, its own card and its own reader
   sections. This file is only what they genuinely share, and it asks the
   registry whenever the answer differs per wing.

   To work on one wing, open its two files. Nothing here should need touching,
   and no other wing can break because of it.

   Storage:  state.wings = { <key>: [ { id, title, body, data{}, tags[],
                                        parentId, favorite, createdAt, updatedAt } ] }
             `data` holds the schema fields — everything above it is shared.
   Folders:  ordinary state.nodes with scope 'wing:<key>'.
   ============================================================ */

let _wingKey = 'language';
let _wingFolderId = null;      // null = every entry
let _wingActiveId = null;
let _wingEditing = null;       // id being edited, or 'new'

function wingConfig(key) {
  const list = (typeof LIBRARY_WINGS !== 'undefined') ? LIBRARY_WINGS : [];
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
  const keys = (typeof LIBRARY_WINGS !== 'undefined' ? LIBRARY_WINGS : []).map(p => p.key);
  keys.forEach(k => wingItems(k).forEach(item => out.push({ key: k, item })));
  return out;
}

function wingFind(id) { return wingItems().find(w => w.id === id) || null; }

/** Only the legacy #/wing?k=diary address carries the key in a query string. */
function _wingKeyFromHash() {
  const m = /[?&]k=([\w-]+)/.exec(window.location.hash || '');
  return m ? m[1] : null;
}

/* An entry to open as soon as the wing mounts. Set by wingGoTo before it
   navigates, and consumed by the init below — which is what replaced a
   setTimeout that guessed at how long the route would take to build. */
let _wingPendingOpen = null;

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

/** Mount a named wing. Each wing's route calls this with its own key. */
function wingInitFor(key) {
  if (key) _wingKey = key;
  _wingFolderId = null;
  _wingEditing = null;
  // A pending entry survives exactly one mount, so arriving from a cross-link
  // opens that entry and arriving any other way opens the list.
  _wingActiveId = _wingPendingOpen;
  _wingPendingOpen = null;
  wingItems();                       // ensure the bucket exists
  wingRenderSidebar();
  wingRenderDetail();
  wingUpdateHeader();
}

/** #/wing?k=diary — send it on to #/diary and keep the old links working. */
function wingInitLegacy() {
  const k = _wingKeyFromHash();
  const known = (typeof LIBRARY_WINGS !== 'undefined' ? LIBRARY_WINGS : []).some(w => w.key === k);
  if (known) { window.location.hash = '#/' + k; return; }
  wingInitFor(k || _wingKey);
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
  const sc = wingSchema(_wingKey);
  const noun = items.length === 1 ? sc.noun : sc.nounPlural;
  if (sub) sub.textContent = `${items.length} ${noun} across ${folders.length} folder${folders.length !== 1 ? 's' : ''}`;
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

  const schema = wingSchema(_wingKey);
  const prefiltered = pool;
  let list = libApplyCommonFilters('wing', pool.slice(), null);
  const sort = getLibPref('wing.sort', 'recent');
  // A wing with its own date sorts on THAT: a diary ordered by when you last
  // touched an entry is not a diary, it is a list of recent edits.
  if (sort === 'title') list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  else if (sort === 'oldest') list.sort((a, b) => wingSortStamp(a, schema) - wingSortStamp(b, schema));
  else list.sort((a, b) => wingSortStamp(b, schema) - wingSortStamp(a, schema));
  list.sort((a, b) => (libIsFavorite(b) ? 1 : 0) - (libIsFavorite(a) ? 1 : 0));

  const folder = _wingFolderId ? state.nodes.find(n => n.id === _wingFolderId) : null;
  const heading = query ? `Search results for “${escapeHTML(query)}”` : (folder ? escapeHTML(folder.name) : 'All entries');

  const sortOpts = schema.sortKey
    ? [['recent', 'Newest first'], ['oldest', 'Oldest first'], ['title', 'Title A–Z']]
    : [['recent', 'Recently updated'], ['oldest', 'Oldest first'], ['title', 'Title A–Z']];
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
          <button class="btn btn-primary" onclick="wingNewEntry()"><i data-lucide="plus" style="width:16px;height:16px;"></i> New ${escapeHTML(schema.noun)}</button>
        </div>
      </div>
      ${filterBar}
      ${list.length ? _wingGroupedHTML(list, schema) : `
        <div class="empty-state" style="padding:3rem 1rem; text-align:center; display:flex; flex-direction:column; align-items:center;">
          <i data-lucide="${cfg.icon}" style="width:44px;height:44px;opacity:0.45;margin-bottom:0.75rem;"></i>
          <h3 style="font-weight:700;">${prefiltered.length ? 'Nothing matches these filters' : 'Nothing here yet'}</h3>
          <p style="font-size:0.85rem;color:var(--text-tertiary);margin-top:0.35rem;">${prefiltered.length ? '' : escapeHTML(cfg.tagline)}</p>
          <button class="btn btn-primary" style="margin-top:1rem;" onclick="${prefiltered.length ? `clearWingFilters()` : `wingNewEntry()`}">
            <i data-lucide="${prefiltered.length ? 'x' : 'plus'}" style="width:15px;height:15px;"></i> ${prefiltered.length ? 'Clear filters' : 'Add the first ' + escapeHTML(schema.noun)}
          </button>
        </div>`}
      ${libSelectionBarHTML('wing', list.map(w => w.id))}
    </div>`;
  _wingAfterRender(host);
}

function clearWingFilters() { libClearCommonFilters('wing'); wingRenderDetail(); }

/**
 * The list, under its group headings.
 *
 * Grouping is what turns a pile into a museum, a rulebook or a chronology —
 * the same entries under "Core / Settled / Working / Testing" read completely
 * differently from the same entries in one undifferentiated grid.
 */
function _wingGroupedHTML(list, schema) {
  const groups = wingGroupList(list, schema);
  const wrap = wingIsRowLayout(schema) ? 'wing-rows' : 'card-grid stagger-children';
  // The index runs across the whole list rather than restarting per group, so
  // a numbered wing gives an entry one number in the book, not one per
  // section. The wing decides whether to use it.
  let counter = 0;
  return groups.map(g => {
    const body = g.items.map(w => schema.card(w, { index: ++counter })).join('');
    return (g.label
      ? `<h3 class="wing-group-h"><span class="wing-group-name">${escapeHTML(g.label)}</span>
           <span class="wing-group-count">${g.items.length}</span></h3>`
      : '') + `<div class="${wrap}">${body}</div>`;
  }).join('');
}

function _wingAfterRender(host) {
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: host });
}

function _wingSnippet(body, n) {
  return String(body || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n || 160);
}

/* The card is the wing’s own — see card() in its file under js/wings/. */

function _wingReaderHTML(w) {
  const when = w.updatedAt || w.createdAt;
  const schema = wingSchema(_wingKey);
  return `
    <div class="animate-fade-in wing-reader wing-reader-${escapeHTML(schema.layout)}" style="max-width:780px;margin:0 auto;">
      <button class="btn btn-ghost btn-sm" onclick="wingBack()" style="margin-bottom:1rem;">
        <i data-lucide="chevron-left" style="width:14px;height:14px;"></i> Back to ${escapeHTML(schema.nounPlural)}
      </button>
      <h1 class="wing-reader-title">${escapeHTML(w.title || 'Untitled')}</h1>
      <div style="display:flex;flex-wrap:wrap;gap:0.4rem;align-items:center;margin-bottom:1.25rem;">
        ${(w.tags || []).map(t => libTagBadgeHTML('wing', t)).join('')}
        ${when ? `<span style="font-size:0.75rem;color:var(--text-tertiary);">Updated ${new Date(when).toLocaleString()}</span>` : ''}
      </div>
      ${wingReaderMetaHTML(w, schema)}
      ${w.body ? `<section class="wing-sec"><h3 class="wing-sec-h">${escapeHTML(schema.bodyLabel)}</h3>
        <div class="wing-body">${escapeHTML(w.body).replace(/\n/g, '<br/>')}</div></section>` : ''}
      ${schema.readerExtras ? schema.readerExtras(w) : ''}
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
  const schema = wingSchema(_wingKey);
  const w = isNew ? { title: '', body: '', tags: [], data: {}, parentId: _wingFolderId }
                  : (wingFind(_wingEditing) || { title: '', body: '', tags: [], data: {} });
  const folders = [];
  const walk = (pid, d) => getChildFolders(pid, wingScope()).forEach(f => { folders.push({ id: f.id, label: '— '.repeat(d) + f.name }); walk(f.id, d + 1); });
  walk(null, 0);
  return `
    <div class="animate-fade-in" style="max-width:780px;margin:0 auto;">
      <button class="btn btn-ghost btn-sm" onclick="wingBack()" style="margin-bottom:1rem;">
        <i data-lucide="chevron-left" style="width:14px;height:14px;"></i> Cancel
      </button>
      <h2 style="font-size:1.35rem;font-weight:800;margin-bottom:1.25rem;">${isNew ? 'New ' + escapeHTML(schema.noun) : 'Edit ' + escapeHTML(schema.noun)}</h2>
      <div class="af-field"><label class="form-label">${escapeHTML(schema.titleLabel)}</label>
        <input id="wing-f-title" class="form-input af-input-bold" value="${escapeHTML(w.title || '')}" placeholder="${escapeHTML(schema.titlePlaceholder)}" /></div>
      <div class="af-field"><label class="form-label">Folder</label>
        <select id="wing-f-folder" class="form-select">
          <option value="">Uncategorized</option>
          ${folders.map(f => `<option value="${f.id}"${(w.parentId || '') === f.id ? ' selected' : ''}>${escapeHTML(f.label)}</option>`).join('')}
        </select></div>
      <div class="af-field"><label class="form-label">Tags <span class="af-label-hint">(comma separated)</span></label>
        <input id="wing-f-tags" class="form-input" value="${escapeHTML((w.tags || []).join(', '))}" /></div>
      ${(schema.fields || []).map(f => wingFieldEditorHTML(f, w)).join('')}
      <div class="af-field"><label class="form-label">${escapeHTML(schema.bodyLabel)}</label>
        <textarea id="wing-f-body" class="form-textarea" rows="12" placeholder="${escapeHTML(schema.bodyPlaceholder)}">${escapeHTML(w.body || '')}</textarea></div>
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

  const schema = wingSchema(_wingKey);
  const items = wingItems();
  if (_wingEditing === 'new') {
    const item = { id: generateId(), title: title.trim(), body, tags, parentId, favorite: false,
                   data: wingReadFieldValues(schema, { data: {} }),
                   createdAt: Date.now(), updatedAt: Date.now() };
    items.push(item);
    _wingActiveId = item.id;
  } else {
    const item = wingFind(_wingEditing);
    if (item) {
      // Read against the item as it stands, so a checklist keeps what was
      // ticked when only its wording changed.
      const data = wingReadFieldValues(schema, item);
      Object.assign(item, { title: title.trim(), body, tags, parentId, data, updatedAt: Date.now() });
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
  get noun() { return wingSchema(_wingKey).noun; },
  list: () => wingItems(),
  find: (id) => wingFind(id),
  remove: (id) => { const items = wingItems(); const i = items.findIndex(w => w.id === id); if (i >= 0) items.splice(i, 1); },
  rerender: () => { wingRenderSidebar(); wingRenderDetail(); wingUpdateHeader(); }
});
