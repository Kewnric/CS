/* ============================================================
   ADMIN-CARDS.JS — the card browser that fills the admin's second pane
   ------------------------------------------------------------
   The second pane used to hold one thing: the edit form, behind an empty state
   that said "select something on the left". Every admin therefore had exactly
   one way in — hunt through the left-hand list — and the libraries' own card
   grids, which are the nicer way to look at a collection, existed nowhere in
   the admin.

   Each admin now declares its collections. Clicking a section header in pane 1
   shows that collection as cards in pane 2; clicking a card opens the editor;
   the editor has a Back button that returns to the cards it came from.

   A collection is:
     key      stable id, also the pane-1 section's data-collection
     label    plural, shown as the browser's title
     icon     lucide name
     accent   CSS colour for the card's icon chip
     newLabel wording on the dashed add card
     items()  the records
     card(x)  { id, title, sub, meta:[{icon,text}], icon }
     open(id) show the editor for one record
     create() start a new one
   ============================================================ */

let _adminCollection = null;   // which collection pane 2 is showing, if any
let _adminCardQuery = '';

const ADMIN_COLLECTIONS = {
  coding: [
    {
      key: 'programs', label: 'Programs', icon: 'code', accent: 'var(--color-primary)',
      newLabel: 'New program',
      items: () => state.challenges || [],
      card: (c) => ({
        id: c.id, icon: c.icon || 'code', title: c.title || 'Untitled program',
        sub: c.coverDescription || _adminFolderName(c.parentId) || 'Uncategorized',
        meta: [
          { icon: 'layers', text: (c.variants || []).length + ' version' + ((c.variants || []).length !== 1 ? 's' : '') },
          { icon: 'flask-conical', text: _adminCountTests(c) + ' test' + (_adminCountTests(c) !== 1 ? 's' : '') }
        ]
      }),
      open: (id) => openAdminForm(id),
      create: () => openAdminForm('new')
    },
    {
      key: 'sets', label: 'Practice Sets', icon: 'layout-grid', accent: 'var(--color-accent)',
      newLabel: 'New practice set',
      items: () => state.codingSets || [],
      card: (s) => ({
        id: s.id, icon: 'layout-grid', title: s.title || 'Untitled set',
        sub: s.description || _adminFolderName(s.parentId) || 'Uncategorized',
        meta: [{ icon: 'list', text: (s.problems || []).length + ' problem' + ((s.problems || []).length !== 1 ? 's' : '') }]
      }),
      open: (id) => openSetBuilder(id),
      create: () => openSetBuilder('new')
    },
    {
      key: 'cats', label: 'Categories', icon: 'folder', accent: 'var(--color-warning)',
      newLabel: 'New category',
      items: () => _adminFolders('challenge'),
      card: (f) => _adminFolderCard(f, 'challenge'),
      open: (id) => _adminRenameFolder(id),
      create: () => _adminNewFolder('challenge')
    },
    {
      key: 'locks', label: 'Skill Tree Locks', icon: 'lock', accent: 'var(--text-tertiary)',
      newLabel: 'Lock a category',
      items: () => _adminLockedFolders('challenge'),
      card: (f) => ({
        id: f.id, icon: 'lock', title: f.name || 'Untitled folder',
        sub: _adminLockSummary(f.id),
        meta: [{ icon: 'folder', text: _adminFolderName(f.parentId) || 'Top level' }]
      }),
      open: (id) => openLockPicker(id, 'challenge'),
      create: () => _adminPickFolderToLock('challenge')
    }
  ],

  notes: [
    {
      key: 'notebooks', label: 'Notebooks', icon: 'book-open', accent: 'var(--color-primary)',
      newLabel: 'New notebook',
      items: () => state.notebooks || [],
      card: (n) => ({
        id: n.id, icon: n.icon || 'book-open', title: n.title || 'Untitled notebook',
        sub: n.description || _adminFolderName(n.parentId) || 'Uncategorized',
        meta: [
          { icon: 'layers', text: (n.sections || []).length + ' section' + ((n.sections || []).length !== 1 ? 's' : '') },
          { icon: 'help-circle', text: _adminCountQuestions(n) + ' question' + (_adminCountQuestions(n) !== 1 ? 's' : '') }
        ]
      }),
      open: (id) => openNotebookForm(id),
      create: () => openNotebookForm('new')
    },
    {
      key: 'cats', label: 'Categories', icon: 'folder', accent: 'var(--color-warning)',
      newLabel: 'New category',
      items: () => _adminFolders('notebook'),
      card: (f) => _adminFolderCard(f, 'notebook'),
      open: (id) => _adminRenameFolder(id),
      create: () => _adminNewFolder('notebook')
    }
  ],

  snippets: [
    {
      key: 'snippets', label: 'Snippets', icon: 'code', accent: 'var(--color-accent)',
      newLabel: 'New snippet',
      items: () => state.snippets || [],
      card: (s) => ({
        id: s.id, icon: s.icon || 'file-code', title: s.title || 'Untitled snippet',
        sub: s.description || _adminFolderName(s.parentId) || 'Uncategorized',
        meta: [
          { icon: 'terminal', text: s.language || 'plain' },
          { icon: 'tag', text: (s.tags || []).length + ' tag' + ((s.tags || []).length !== 1 ? 's' : '') }
        ]
      }),
      open: (id) => openStudyForm(id),
      create: () => openStudyForm('new')
    },
    {
      key: 'cats', label: 'Categories', icon: 'folder', accent: 'var(--color-warning)',
      newLabel: 'New category',
      items: () => _adminFolders('snippet'),
      card: (f) => _adminFolderCard(f, 'snippet'),
      open: (id) => _adminRenameFolder(id),
      create: () => _adminNewFolder('snippet')
    }
  ]
};

/* ── small shared readers ─────────────────────────────────── */

function _adminFolders(scope) {
  return (state.nodes || []).filter(n => n && n.type === 'folder' && n.scope === scope);
}

function _adminFolderName(parentId) {
  if (!parentId) return '';
  const f = (state.nodes || []).find(n => n.id === parentId);
  return f ? f.name : '';
}

function _adminCountTests(c) {
  return (c.variants || []).reduce((n, v) => n + ((v.tests || []).length), 0);
}

function _adminCountQuestions(nb) {
  return (nb.sections || []).reduce((t, s) => t + ((s.questions || []).length), 0);
}

/** How many items of `scope` sit directly in this folder. */
function _adminFolderCount(folderId, scope) {
  const key = scope === 'challenge' ? 'challenges' : scope === 'notebook' ? 'notebooks' : 'snippets';
  return (state[key] || []).filter(x => x.parentId === folderId).length;
}

function _adminFolderCard(f, scope) {
  const n = _adminFolderCount(f.id, scope);
  const noun = scope === 'challenge' ? 'program' : scope === 'notebook' ? 'notebook' : 'snippet';
  const parent = _adminFolderName(f.parentId);
  return {
    id: f.id, icon: f.icon || 'folder', title: f.name || 'Untitled folder',
    sub: parent ? 'in ' + parent : 'Top level',
    meta: [{ icon: 'file', text: n + ' ' + noun + (n !== 1 ? 's' : '') }]
  };
}

function _adminLockedFolders(scope) {
  const req = state.categoryRequirements || {};
  return _adminFolders(scope).filter(f => req[f.id]);
}

function _adminLockSummary(folderId) {
  const r = (state.categoryRequirements || {})[folderId];
  if (!r) return 'No requirement';
  if (r.reqNodeId) return 'Needs ' + (_adminFolderName(r.reqNodeId) || 'another folder');
  const ids = r.requiredChallengeIds || [];
  if (ids.length) return 'Needs ' + ids.length + ' program' + (ids.length !== 1 ? 's' : '') + ' completed';
  return 'No requirement';
}

/* ── the actions the folder cards need ────────────────────── */

function _adminRenameFolder(id) {
  const f = (state.nodes || []).find(n => n.id === id);
  if (!f) return;
  showInputDialog('Rename category', null, 'Name', f.name || '', (v) => {
    const t = (v || '').trim();
    if (!t) return;
    f.name = t;
    saveData();
    if (typeof renderAdmin === 'function') renderAdmin();
    adminRenderCards();
  });
}

function _adminNewFolder(scope) {
  showInputDialog('New category', null, 'Category name', '', (v) => {
    const name = (v || '').trim();
    if (!name || typeof createNode !== 'function') return;
    createNode(name, 'folder', null, scope);
    saveData();
    if (typeof renderAdmin === 'function') renderAdmin();
    adminRenderCards();
  });
}

/** No folder is locked yet, so there is nothing to click — pick one first. */
function _adminPickFolderToLock(scope) {
  const free = _adminFolders(scope).filter(f => !(state.categoryRequirements || {})[f.id]);
  if (!free.length) {
    if (typeof toast === 'function') toast('Every category already has a lock.', { type: 'info' });
    return;
  }
  showListPickerDialog('Lock a category', 'Which category should require something first?',
    free.map(f => ({ value: f.id, label: f.name || 'Untitled' })),
    (id) => { if (id) adminEditPrereqs(id); });
}

/* ── the browser itself ───────────────────────────────────── */

function _adminCollectionSet() {
  if (window.currentAdminMode === 'practice') return ADMIN_COLLECTIONS.coding;
  return currentAdminStudyTab === 'snippets' ? ADMIN_COLLECTIONS.snippets : ADMIN_COLLECTIONS.notes;
}

function _adminFindCollection(key) {
  return _adminCollectionSet().find(c => c.key === key) || null;
}

/**
 * A pane-1 section header was clicked. The chevron still collapses the section,
 * and the tool buttons in the header still do their own thing; clicking
 * anywhere else shows that collection as cards in the second pane, and expands
 * the section rather than collapsing it out from under the click.
 */
function adminSectionClick(e) {
  if (e.target.closest('.admin-panel-chev') || e.target.closest('.admin-panel-tools')) return;
  const det = e.currentTarget.closest('details.admin-panel');
  if (!det) return;
  const key = det.getAttribute('data-collection');
  if (!key) return;
  e.preventDefault();          // do not let the header toggle itself shut
  if (!det.open) det.open = true;
  adminShowCollection(key);
}

/** Keep the panel counts honest for the sections the other admins now have. */
function adminSyncPanelCounts() {
  const put = (id, n) => { const el = document.getElementById(id); if (el) el.textContent = n; };
  put('admin-notebooks-count', (state.notebooks || []).length);
  put('admin-nb-cats-count', _adminFolders('notebook').length);
  put('admin-snippets-count', (state.snippets || []).length);
  put('admin-snip-cats-count', _adminFolders('snippet').length);

  // General counts the top level: the categories you can open, plus
  // Uncategorized when anything is sitting in it.
  const tops = _adminChildFolders(null).length;
  const loose = _adminItemsIn(ADMIN_UNCAT).length ? 1 : 0;
  put('admin-general-count', tops + loose);
  _adminRenderGeneralNav();
}

/** A shortcut list of the top-level categories, in the General panel body. */
function _adminRenderGeneralNav() {
  const host = document.getElementById('admin-general-nav');
  if (!host) return;
  _adminValidateNav();
  const loose = _adminItemsIn(ADMIN_UNCAT);

  host.innerHTML =
    _adminGenBranch(null, 0) +
    (loose.length ? _adminGenGroupHTML(ADMIN_UNCAT, 'Uncategorized', 'inbox', loose.length,
      loose.map(it => _adminGenItemHTML(it)).join(''), 0) : '') +
    (!_adminChildFolders(null).length && !loose.length
      ? '<p class="admin-gen-empty">No categories yet.</p>' : '');

  if (typeof lucide !== 'undefined') lucide.createIcons({ el: host });
}

/**
 * One level of the tree, and everything under it. A folder's body holds its
 * subfolders first and then the items filed directly in it, so the panel
 * mirrors the shape of the library rather than flattening it.
 */
function _adminGenBranch(parentId, depth) {
  return _adminChildFolders(parentId).map(f => {
    const subs = _adminChildFolders(f.id);
    const items = _adminItemsIn(f.id);
    const body = _adminGenBranch(f.id, depth + 1) + items.map(it => _adminGenItemHTML(it, depth + 1)).join('') +
      (!subs.length && !items.length ? '<p class="admin-gen-empty">Empty</p>' : '');
    return _adminGenGroupHTML(f.id, f.name || 'Untitled', f.icon || 'folder',
      items.length + subs.length, body, depth);
  }).join('');
}

/** Expansion is remembered, so the tree does not reset on every rerender. */
function _adminGenOpen(id) {
  try { return (JSON.parse(localStorage.getItem('adminGenOpen') || '[]')).includes(id); }
  catch (e) { return false; }
}

function _adminGenRemember() {
  const open = [...document.querySelectorAll('#admin-general-nav details.admin-gen-group[open]')]
    .map(d => d.getAttribute('data-folder'));
  try { localStorage.setItem('adminGenOpen', JSON.stringify(open)); } catch (e) { /* quota */ }
}

function _adminGenGroupHTML(id, name, icon, count, body, depth) {
  const showing = _adminCollection === 'general' && String(_adminNavFolderId) === String(id);
  return `
    <details class="admin-group admin-gen-group${showing ? ' current' : ''}"
             data-folder="${escapeHTML(String(id))}"${_adminGenOpen(id) ? ' open' : ''}>
      <summary style="padding-left:${0.3 + depth * 0.75}rem;" onclick="_adminGenSummaryClick(event, '${escapeHTML(String(id))}')">
        <i data-lucide="chevron-right" class="admin-group-chev"></i>
        <i data-lucide="${escapeHTML(icon)}" style="width:14px;height:14px;"></i>
        <span class="admin-group-name">${escapeHTML(name)}</span>
        <span class="admin-group-count">${count}</span>
      </summary>
      <div class="admin-group-body">${body}</div>
    </details>`;
}

/**
 * The chevron expands the branch; the name opens that folder in the second
 * pane. Two jobs on one row, split the same way the section headers are.
 */
function _adminGenSummaryClick(e, folderId) {
  // The chevron is the plain <details> toggle; `open` only changes after the
  // event, so the new state has to be read on the next tick.
  if (e.target.closest('.admin-group-chev')) { setTimeout(_adminGenRemember, 0); return; }

  e.preventDefault();
  const det = e.currentTarget.closest('details');
  if (det && !det.open) det.open = true;
  // Navigating rebuilds this tree from the stored open set, so the set has to
  // be written first — otherwise the branch just expanded would come back shut.
  _adminGenRemember();
  adminNavTo(folderId);
}

function _adminGenItemHTML(item, depth) {
  const c = _adminCollectionSet()[0].card(item);
  const id = escapeHTML(String(item.id));
  return `
    <button class="admin-gen-item" style="padding-left:${1.35 + (depth || 0) * 0.75}rem;"
            title="${escapeHTML(c.title)}" onclick="adminOpenFromCard('${id}')">
      <i data-lucide="${escapeHTML(c.icon || 'file')}"></i>
      <span class="admin-gen-name">${escapeHTML(c.title)}</span>
    </button>`;
}

/** Open a collection as cards in pane 2. Called by the pane-1 section headers. */
function adminShowCollection(key) {
  if (key !== 'general' && !_adminFindCollection(key)) return;
  _adminCollection = key;

  // The editor and the browser are alternatives, not layers.
  ['admin-form-container', 'study-form-container', 'notebook-form-container'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
  const empty = document.getElementById('admin-empty-state');
  if (empty) empty.classList.add('hidden');

  adminRenderCards();
  _adminMarkActiveSection(key);
  _adminRenderGeneralNav();   // the tree highlights the folder now on screen
}

function _adminMarkActiveSection(key) {
  document.querySelectorAll('.admin-panel[data-collection]').forEach(d => {
    d.classList.toggle('is-showing', d.getAttribute('data-collection') === key);
  });
}

function adminRenderCards() {
  const host = document.getElementById('admin-card-browser');
  if (!host) return;

  // General navigates folders instead of listing one flat collection.
  if (_adminCollection === 'general') {
    host.innerHTML = _adminGeneralHTML();
    host.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons({ el: host });
    return;
  }

  const col = _adminFindCollection(_adminCollection);
  if (!col) { host.classList.add('hidden'); return; }

  const items = (col.items() || []).map(col.card);
  const q = (_adminCardQuery || '').trim().toLowerCase();
  const shown = q ? items.filter(c => (c.title + ' ' + (c.sub || '')).toLowerCase().includes(q)) : items;
  const label = escapeHTML(col.label);
  const lower = escapeHTML(col.label.toLowerCase());

  host.innerHTML = `
    <div class="admin-cards-head">
      <button class="btn-back-dark admin-cards-back" onclick="adminCardsExit()" title="Back to the editor pane">
        <i data-lucide="chevron-left" style="width:14px;height:14px;"></i> Back
      </button>
      <div class="admin-cards-titles">
        <h2><i data-lucide="${col.icon}" style="width:17px;height:17px;color:${col.accent};"></i> ${label}</h2>
        <p>${shown.length}${q && shown.length !== items.length ? ' of ' + items.length : ''} item${shown.length !== 1 ? 's' : ''} — pick one to edit</p>
      </div>
      <div class="admin-cards-search search-container">
        <i data-lucide="search"></i>
        <input type="text" class="search-input" placeholder="Filter ${lower}..."
               value="${escapeHTML(_adminCardQuery || '')}" aria-label="Filter ${lower}"
               oninput="_adminCardsFilter(this.value)" />
      </div>
    </div>
    <div class="admin-cards-grid">
      ${shown.map(c => `
        <button class="admin-card" onclick="adminOpenFromCard('${escapeHTML(String(c.id))}')" title="${escapeHTML(c.title)}">
          <span class="admin-card-chip" style="background:color-mix(in srgb, ${col.accent} 18%, transparent);">
            <i data-lucide="${escapeHTML(c.icon || col.icon)}" style="color:${col.accent};"></i>
          </span>
          <span class="admin-card-title">${escapeHTML(c.title)}</span>
          ${c.sub ? `<span class="admin-card-sub">${escapeHTML(c.sub)}</span>` : ''}
          <span class="admin-card-meta">
            ${(c.meta || []).map(m => `<span><i data-lucide="${m.icon}"></i>${escapeHTML(String(m.text))}</span>`).join('')}
          </span>
        </button>`).join('')}
      <button class="admin-card admin-card-add" onclick="adminCreateFromCard()" title="${escapeHTML(col.newLabel)}">
        <i data-lucide="plus"></i>
        <span>${escapeHTML(col.newLabel)}</span>
      </button>
    </div>
    ${!items.length ? '<p class="admin-cards-none">Nothing here yet — the dashed card starts your first one.</p>' : ''}
    ${items.length && !shown.length ? `<p class="admin-cards-none">No ${lower} match that search.</p>` : ''}
  `;
  host.classList.remove('hidden');
  if (typeof lucide !== 'undefined') lucide.createIcons({ el: host });
}

/** Re-rendering replaces the box being typed in, so the caret is put back. */
function _adminCardsFilter(value) {
  _adminCardQuery = value;
  adminRenderCards();
  const box = document.querySelector('.admin-cards-search input');
  if (box) { box.focus(); box.setSelectionRange(box.value.length, box.value.length); }
}

function adminOpenFromCard(id) {
  const col = _adminCollection === 'general' ? _adminCollectionSet()[0] : _adminFindCollection(_adminCollection);
  if (!col) return;
  // Practice sets and locks open in their own modal over pane 2, so the cards
  // stay behind them; the rest replace the pane with a form.
  const overlays = col.key === 'sets' || col.key === 'locks' || col.key === 'cats';
  const host = document.getElementById('admin-card-browser');
  if (host && !overlays) host.classList.add('hidden');
  col.open(id);
}

function adminCreateFromCard() {
  // Inside General the collection is implied: it is whatever this admin edits.
  const col = _adminCollection === 'general' ? _adminCollectionSet()[0] : _adminFindCollection(_adminCollection);
  if (!col) return;
  const overlays = col.key === 'sets' || col.key === 'locks' || col.key === 'cats';
  const host = document.getElementById('admin-card-browser');
  if (host && !overlays) host.classList.add('hidden');
  col.create();
  _adminPlaceNewInOpenFolder();
}

/**
 * A new item opened from inside a folder defaults to the first folder in the
 * tree, which is rarely the one being looked at. Point it at the open folder
 * instead — both the form's picker and the state behind it.
 */
function _adminPlaceNewInOpenFolder() {
  if (_adminCollection !== 'general') return;
  const target = (_adminNavFolderId === ADMIN_UNCAT) ? '' : (_adminNavFolderId || '');
  const sel = document.querySelector(
    '#admin-form-container:not(.hidden) #admin-category,' +
    '#notebook-form-container:not(.hidden) #notebook-category,' +
    '#study-form-container:not(.hidden) #study-category');
  if (sel) sel.value = target;
  // These are top-level `let` bindings, so they are lexical, not properties of
  // window — they have to be named directly.
  if (typeof adminState !== 'undefined' && adminState) adminState.parentId = target || null;
  if (typeof notebookAdminState !== 'undefined' && notebookAdminState) notebookAdminState.parentId = target || null;
  if (typeof studyModeState !== 'undefined' && studyModeState) studyModeState.parentId = target || null;
}

/** The editor's Back button: return to the cards it was opened from. */
function adminBackToCards() {
  if (!_adminCollection) return false;
  adminShowCollection(_adminCollection);
  return true;
}

/** Leave the browser entirely, back to the pane's normal empty state. */
function adminCardsExit() {
  _adminCollection = null;
  _adminCardQuery = '';
  _adminNavFolderId = null;
  const host = document.getElementById('admin-card-browser');
  if (host) { host.classList.add('hidden'); host.innerHTML = ''; }
  const empty = document.getElementById('admin-empty-state');
  if (empty) empty.classList.remove('hidden');
  _adminMarkActiveSection(null);
}

/** Shown in every editor header, next to the close button. */
function adminFormBackButtonHTML() {
  return `<button class="btn btn-ghost af-back-btn" onclick="adminFormBack()"
                  aria-label="Back to the list" title="Back to the list">
            <i data-lucide="chevron-left" style="width:16px;height:16px;" aria-hidden="true"></i>
            <span>Back</span>
          </button>`;
}

/** Back out of an editor, asking about unsaved work exactly as the X does. */
function adminFormBack() {
  const done = () => { if (!adminBackToCards()) adminCardsExit(); };
  const closeFn = window.currentAdminMode === 'study'
    ? (currentAdminStudyTab === 'snippets' ? closeStudyForm : closeNotebookForm)
    : closeAdminForm;
  const saveFn = window.saveCurrentAdminForm;
  if (typeof confirmCloseAdminForm === 'function') {
    confirmCloseAdminForm(() => { closeFn(); done(); }, saveFn);
  } else {
    closeFn();
    done();
  }
}

/* ============================================================
   GENERAL — the navigable folder browser
   ------------------------------------------------------------
   The collections above are flat: one list of everything, wherever it lives.
   General is the admin's version of the library's own view — categories as
   cards you can open, Uncategorized among them, and the items inside a folder
   shown the way the library shows them, with the admin's actions on each card.
   ============================================================ */

const ADMIN_UNCAT = '__uncat__';    // the pseudo-folder holding parentless items
let _adminNavFolderId = null;       // null = the top level

/** Which library this admin edits, as the tree's scope + the state key. */
function _adminScope() {
  if (window.currentAdminMode === 'practice') return { scope: 'challenge', key: 'challenges', noun: 'program' };
  return currentAdminStudyTab === 'snippets'
    ? { scope: 'snippet', key: 'snippets', noun: 'snippet' }
    : { scope: 'notebook', key: 'notebooks', noun: 'notebook' };
}

function _adminItems() {
  return state[_adminScope().key] || [];
}

/** Folders directly inside `parentId` (null for the top level). */
function _adminChildFolders(parentId) {
  const sc = _adminScope().scope;
  return (state.nodes || []).filter(n =>
    n && n.type === 'folder' && n.scope === sc && (n.parentId || null) === (parentId || null));
}

/** Items directly inside `parentId`, in the array order the libraries sort by. */
function _adminItemsIn(parentId) {
  const want = parentId === ADMIN_UNCAT ? null : (parentId || null);
  return _adminItems().filter(x => (x.parentId || null) === want);
}

/** Root -> ... -> here, for the breadcrumb. */
function _adminNavTrail(folderId) {
  if (folderId === ADMIN_UNCAT) return [{ id: ADMIN_UNCAT, name: 'Uncategorized' }];
  const trail = [];
  let id = folderId;
  const guard = new Set();          // a cycle in parentId must not hang the page
  while (id && !guard.has(id)) {
    guard.add(id);
    const f = (state.nodes || []).find(n => n.id === id);
    if (!f) break;
    trail.unshift({ id: f.id, name: f.name || 'Untitled folder' });
    id = f.parentId || null;
  }
  return trail;
}

function _adminParentOf(folderId) {
  if (folderId === ADMIN_UNCAT) return null;
  const f = (state.nodes || []).find(n => n.id === folderId);
  return (f && f.parentId) ? f.parentId : null;
}

function adminNavTo(folderId) {
  _adminNavFolderId = (folderId === null || folderId === 'null' || folderId === '') ? null : folderId;
  adminShowCollection('general');
}

/**
 * Every library's folders share one state.nodes, so a folder id left over from
 * a different admin still resolves — it just belongs to another tree, and
 * nothing here would ever be inside it. Switching admins therefore opened a
 * folder by name with no contents. Anything out of scope drops back to root.
 */
function _adminValidateNav() {
  if (!_adminNavFolderId || _adminNavFolderId === ADMIN_UNCAT) return;
  const f = (state.nodes || []).find(n => n.id === _adminNavFolderId);
  if (!f || f.scope !== _adminScope().scope) _adminNavFolderId = null;
}

/* ── numbering ────────────────────────────────────────────────
   Order inside a folder was only ever changeable by dragging in the tree,
   which is awkward past a handful of items and impossible to do precisely.
   A number can be typed instead; it moves the item among its siblings, so
   every "Folder order" sort in the app reflects it. */

function _adminSetNumber(id) {
  const key = _adminScope().key;
  const arr = state[key] || [];
  const item = arr.find(x => x.id === id);
  if (!item) return;
  const parent = item.parentId || null;
  const siblings = arr.filter(x => (x.parentId || null) === parent);
  const total = siblings.length;
  const current = siblings.findIndex(x => x.id === id) + 1;

  showInputDialog('Set number',
    'Where this sits among the ' + total + ' item' + (total !== 1 ? 's' : '') + ' in this folder.',
    'Number 1-' + total, String(current), (v) => {
      let target = parseInt(String(v).trim(), 10);
      if (!isFinite(target)) return;
      target = Math.max(1, Math.min(total, target));
      if (target === current) return;

      // Pull it out, then put it back in front of whoever now holds that slot.
      arr.splice(arr.indexOf(item), 1);
      const rest = arr.filter(x => (x.parentId || null) === parent);
      if (target > rest.length) {
        const last = rest[rest.length - 1];
        arr.splice(last ? arr.indexOf(last) + 1 : arr.length, 0, item);
      } else {
        arr.splice(arr.indexOf(rest[target - 1]), 0, item);
      }
      saveData();
      if (typeof renderAdmin === 'function') renderAdmin();
      adminRenderCards();
      if (typeof toast === 'function') toast('Moved to #' + target + '.', { type: 'success' });
    });
}

function _adminNumbersHelp() {
  if (typeof toast === 'function') {
    toast('Click the # on any card to move it to that position. That order is what "Folder order" sorts by everywhere else.',
      { type: 'info', duration: 7000 });
  }
}

/* ── the cards ────────────────────────────────────────────── */

function _adminNavFolderCardHTML(f) {
  const sc = _adminScope();
  const direct = _adminFolderCount(f.id, sc.scope);
  const subs = _adminChildFolders(f.id).length;
  const total = direct + subs;
  const locked = !!(state.categoryRequirements || {})[f.id];
  const cover = typeof libCoverFallbackHTML === 'function'
    ? libCoverFallbackHTML(f.name || 'Folder', f.icon || 'folder')
    : '';
  return `
    <div class="card card-enhanced has-cover admin-nav-card" onclick="adminNavTo('${f.id}')" style="cursor:pointer;">
      ${cover}
      ${locked ? '<div class="admin-nav-lock" title="This category has prerequisites"><i data-lucide="lock"></i></div>' : ''}
      <div class="admin-nav-head">
        <h3>${escapeHTML(f.name || 'Untitled folder')}</h3>
        <span class="version-pill">${total} item${total !== 1 ? 's' : ''}</span>
      </div>
      <p class="admin-nav-sub">${direct} ${sc.noun}${direct !== 1 ? 's' : ''} &middot; ${subs} subfolder${subs !== 1 ? 's' : ''}</p>
      <div class="admin-nav-actions">
        <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); adminNavTo('${f.id}')">
          <i data-lucide="folder-open"></i> Open
        </button>
        <button class="btn btn-ghost btn-sm" title="Rename this category"
                onclick="event.stopPropagation(); _adminRenameFolder('${f.id}')">
          <i data-lucide="pencil"></i>
        </button>
        <button class="btn btn-ghost btn-sm" title="Prerequisites — what must be finished before this unlocks"
                onclick="event.stopPropagation(); adminEditPrereqs('${f.id}')">
          <i data-lucide="lock"></i>
        </button>
        <button class="btn btn-ghost btn-sm admin-nav-danger" title="Delete this category"
                onclick="event.stopPropagation(); adminDeleteFolder('${f.id}')">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
    </div>`;
}

/** The Uncategorized tile: a place items live, but not a real folder. */
function _adminUncatCardHTML() {
  const noun = _adminScope().noun;
  const n = _adminItemsIn(ADMIN_UNCAT).length;
  const cover = typeof libCoverFallbackHTML === 'function'
    ? libCoverFallbackHTML('Uncategorized', 'inbox') : '';
  return `
    <div class="card card-enhanced has-cover admin-nav-card" onclick="adminNavTo('${ADMIN_UNCAT}')" style="cursor:pointer;">
      ${cover}
      <div class="admin-nav-head">
        <h3>Uncategorized</h3>
        <span class="version-pill">${n} item${n !== 1 ? 's' : ''}</span>
      </div>
      <p class="admin-nav-sub">${noun.charAt(0).toUpperCase() + noun.slice(1)}s that are not filed in any category.</p>
      <div class="admin-nav-actions">
        <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); adminNavTo('${ADMIN_UNCAT}')">
          <i data-lucide="folder-open"></i> Open
        </button>
      </div>
    </div>`;
}

function _adminNavItemCardHTML(item, n) {
  const col = _adminCollectionSet()[0];       // programs / notebooks / snippets
  const c = col.card(item);
  const id = escapeHTML(String(item.id));
  const cover = typeof libCoverFallbackHTML === 'function'
    ? libCoverFallbackHTML(c.title, c.icon) : '';
  const tags = (item.tags || []).slice(0, 3);
  return `
    <div class="card card-enhanced has-cover admin-nav-card" onclick="adminOpenFromCard('${id}')" style="cursor:pointer;">
      ${cover}
      <button class="admin-nav-number" title="Position in this folder — click to change"
              onclick="event.stopPropagation(); _adminSetNumber('${id}')">#${n}</button>
      <div class="admin-nav-head">
        <h3>${escapeHTML(c.title)}</h3>
      </div>
      ${tags.length ? `<div class="card-tag-row">${tags.map(t => `<span class="badge">${escapeHTML(t)}</span>`).join('')}</div>` : ''}
      <p class="admin-nav-sub">${escapeHTML(c.sub || '')}</p>
      <div class="card-stat-row">
        ${(c.meta || []).map(m => `<span class="card-stat"><i data-lucide="${m.icon}"></i>${escapeHTML(String(m.text))}</span>`).join('')}
      </div>
      <div class="admin-nav-actions">
        <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); adminOpenFromCard('${id}')">
          <i data-lucide="pencil"></i> Edit
        </button>
        <button class="btn btn-ghost btn-sm" title="Set this item's number in the folder"
                onclick="event.stopPropagation(); _adminSetNumber('${id}')">
          <i data-lucide="hash"></i>
        </button>
        <button class="btn btn-ghost btn-sm" title="Move to another category"
                onclick="event.stopPropagation(); adminMoveItem('${id}')">
          <i data-lucide="folder-input"></i>
        </button>
      </div>
    </div>`;
}

/** Prerequisites live on the folder; which picker depends on the library. */
function adminEditPrereqs(folderId) {
  const sc = _adminScope().scope;
  if (sc === 'challenge' && typeof openPrereqPicker === 'function') return openPrereqPicker(folderId);
  if (typeof openLockPicker === 'function') return openLockPicker(folderId, sc);
}

/** Delete a category, keeping everything that was inside it. */
function adminDeleteFolder(id) {
  const f = (state.nodes || []).find(n => n.id === id);
  if (!f) return;
  const sc = _adminScope();
  const n = _adminFolderCount(id, sc.scope);
  const kids = _adminChildFolders(id).length;
  const detail = (n || kids)
    ? 'The ' + [n ? n + ' ' + sc.noun + (n !== 1 ? 's' : '') : '', kids ? kids + ' subfolder' + (kids !== 1 ? 's' : '') : '']
        .filter(Boolean).join(' and ') + ' inside move up a level.'
    : 'It is empty.';
  showConfirm('Delete "' + (f.name || 'category') + '"?', detail, () => {
    const up = f.parentId || null;
    (state.nodes || []).forEach(c => { if (c.parentId === id) c.parentId = up; });
    (state[sc.key] || []).forEach(x => { if (x.parentId === id) x.parentId = up; });
    delete (state.categoryRequirements || {})[id];
    state.nodes = (state.nodes || []).filter(x => x.id !== id);
    if (_adminNavFolderId === id) _adminNavFolderId = up;
    saveData();
    if (typeof renderAdmin === 'function') renderAdmin();
    adminRenderCards();
  });
}

/** Refile one item without opening its whole editor. */
function adminMoveItem(id) {
  const sc = _adminScope();
  const item = (state[sc.key] || []).find(x => x.id === id);
  if (!item) return;
  // showListPickerDialog supplies its own "Root (no parent)" entry, which is
  // Uncategorized here, so this list is folders only.
  const opts = [];
  (function walk(pid, depth) {
    (state.nodes || []).filter(n => n.type === 'folder' && n.scope === sc.scope && (n.parentId || null) === pid)
      .forEach(f => {
        opts.push({ value: f.id, label: ' '.repeat(depth * 3) + (f.name || 'Untitled') });
        walk(f.id, depth + 1);
      });
  })(null, 0);

  showListPickerDialog('Move ' + (item.title || 'item'), 'Which category should it live in?', opts, (v) => {
    item.parentId = v || null;
    saveData();
    if (typeof renderAdmin === 'function') renderAdmin();
    adminRenderCards();
    if (typeof toast === 'function') {
      toast('Moved to ' + (v ? (_adminFolderName(v) || 'that category') : 'Uncategorized') + '.', { type: 'success' });
    }
  });
}

function _adminGeneralHTML() {
  _adminValidateNav();
  const sc = _adminScope();
  const here = _adminNavFolderId;
  const trail = _adminNavTrail(here);
  const folders = here === ADMIN_UNCAT ? [] : _adminChildFolders(here);
  const items = here === null ? [] : _adminItemsIn(here);
  const rootUncat = here === null ? _adminItemsIn(ADMIN_UNCAT).length : 0;

  const crumbs = `
    <nav class="admin-nav-crumbs" aria-label="Breadcrumb">
      <button class="admin-crumb" onclick="adminNavTo(null)" title="All categories" aria-label="All categories">
        <i data-lucide="home"></i>
      </button>
      ${trail.map((t, i) => `<span class="admin-crumb-sep">/</span>
        <button class="admin-crumb${i === trail.length - 1 ? ' current' : ''}" onclick="adminNavTo('${t.id}')">${escapeHTML(t.name)}</button>`).join('')}
    </nav>`;

  const title = here === null ? 'All categories' : (trail.length ? trail[trail.length - 1].name : 'Folder');
  const upTarget = here === null ? null : _adminParentOf(here);
  const backCall = here === null ? 'adminCardsExit()' : 'adminNavTo(' + (upTarget ? "'" + upTarget + "'" : 'null') + ')';

  const counts = [
    folders.length ? folders.length + ' categor' + (folders.length !== 1 ? 'ies' : 'y') : '',
    here === null ? '' : items.length + ' ' + sc.noun + (items.length !== 1 ? 's' : ''),
    rootUncat ? rootUncat + ' uncategorized' : ''
  ].filter(Boolean).join(' · ');

  const cards =
    folders.map(_adminNavFolderCardHTML).join('') +
    (here === null && rootUncat ? _adminUncatCardHTML() : '') +
    items.map((it, i) => _adminNavItemCardHTML(it, i + 1)).join('');

  const empty = !folders.length && !items.length && !rootUncat;

  return `
    <div class="admin-cards-head admin-nav-bar">
      <button class="btn-back-dark admin-cards-back" onclick="${backCall}"
              title="${here === null ? 'Back to the editor pane' : 'Up one level'}">
        <i data-lucide="chevron-left" style="width:14px;height:14px;"></i> Back
      </button>
      ${crumbs}
    </div>
    <div class="admin-nav-title">
      <div>
        <h2>${escapeHTML(title)}</h2>
        <p>${counts || 'Empty'}</p>
      </div>
      <div class="admin-nav-tools">
        <button class="btn btn-ghost btn-sm" onclick="_adminNumbersHelp()" title="How numbering works">
          <i data-lucide="hash"></i> Numbering
        </button>
        <button class="btn btn-secondary btn-sm" onclick="_adminNewFolderIn()">
          <i data-lucide="folder-plus"></i> New category
        </button>
      </div>
    </div>
    <div class="admin-nav-grid">
      ${cards}
      ${here !== null ? `<button class="admin-card admin-card-add" onclick="adminCreateFromCard()" title="New ${escapeHTML(sc.noun)}">
        <i data-lucide="plus"></i><span>New ${escapeHTML(sc.noun)}</span>
      </button>` : ''}
    </div>
    ${empty ? '<p class="admin-cards-none">Nothing here yet. Add a category above, or a ' + escapeHTML(sc.noun) + ' with the dashed card.</p>' : ''}`;
}

/** New category, created inside whatever folder is open. */
function _adminNewFolderIn() {
  const sc = _adminScope().scope;
  const parent = (_adminNavFolderId === ADMIN_UNCAT) ? null : _adminNavFolderId;
  showInputDialog('New category', null, 'Category name', '', (v) => {
    const name = (v || '').trim();
    if (!name || typeof createNode !== 'function') return;
    createNode(name, 'folder', parent, sc);
    saveData();
    if (typeof renderAdmin === 'function') renderAdmin();
    adminRenderCards();
  });
}
