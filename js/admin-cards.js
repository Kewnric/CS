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
  openLockPicker(free[0].id, scope);
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
}

/** Open a collection as cards in pane 2. Called by the pane-1 section headers. */
function adminShowCollection(key) {
  const col = _adminFindCollection(key);
  if (!col) return;
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
}

function _adminMarkActiveSection(key) {
  document.querySelectorAll('.admin-panel[data-collection]').forEach(d => {
    d.classList.toggle('is-showing', d.getAttribute('data-collection') === key);
  });
}

function adminRenderCards() {
  const host = document.getElementById('admin-card-browser');
  if (!host) return;
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
  const col = _adminFindCollection(_adminCollection);
  if (!col) return;
  // Practice sets and locks open in their own modal over pane 2, so the cards
  // stay behind them; the rest replace the pane with a form.
  const overlays = col.key === 'sets' || col.key === 'locks' || col.key === 'cats';
  const host = document.getElementById('admin-card-browser');
  if (host && !overlays) host.classList.add('hidden');
  col.open(id);
}

function adminCreateFromCard() {
  const col = _adminFindCollection(_adminCollection);
  if (!col) return;
  const overlays = col.key === 'sets' || col.key === 'locks' || col.key === 'cats';
  const host = document.getElementById('admin-card-browser');
  if (host && !overlays) host.classList.add('hidden');
  col.create();
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
