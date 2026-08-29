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
  if (e.target.closest('.admin-panel-tools')) return;
  const det = e.currentTarget.closest('details.admin-panel');
  if (!det) return;

  // <details> is left permanently open and collapsing is done with a class:
  // a closed <details> sets display:none on its content, which cannot be
  // transitioned, so the panel could never slide. preventDefault stops the
  // element toggling itself back.
  e.preventDefault();

  if (e.target.closest('.admin-panel-chev')) {
    det.classList.toggle('collapsed');
    return;
  }
  det.classList.remove('collapsed');
  const key = det.getAttribute('data-collection');
  if (key) adminShowCollection(key);
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

/** The category tree in the General panel's body. */
function _adminRenderGeneralNav() {
  const host = document.getElementById('admin-general-nav');
  if (!host) return;
  _adminValidateNav();
  const q = _adminGenQuery();

  // Categories only. Listing every program under every folder as well turned a
  // seven-item library into a wall of rows in a 300px pane, and the items are
  // already one click away as cards in the second pane.
  const body = _adminGenBranch(null) +
    (_adminItemsIn(ADMIN_UNCAT).filter(it => _adminGenItemMatches(it, q)).length
      ? _adminGenNodeHTML(ADMIN_UNCAT, 'Uncategorized', 'inbox',
          _adminItemsIn(ADMIN_UNCAT).length, '')
      : '');

  host.innerHTML = body ||
    `<p class="admin-gen-empty">${q ? 'Nothing matches that search.' : 'No categories yet.'}</p>`;
  if (typeof lucide !== 'undefined') lucide.createIcons({ el: host });
}
/** Whatever is typed in the first pane's search box. */
function _adminGenQuery() {
  const el = document.getElementById('admin-search-input');
  return (el ? el.value : '').trim().toLowerCase();
}

function _adminGenItemTitle(item) {
  return String(_adminCollectionSet()[0].card(item).title || '');
}

function _adminGenItemMatches(item, q) {
  return !q || _adminGenItemTitle(item).toLowerCase().includes(q);
}

/**
 * A folder survives a search if it matches by name, holds a matching item, or
 * has a descendant that does — otherwise narrowing the list would hide the very
 * branch the match sits in.
 */
function _adminGenBranchMatches(folderId, q) {
  if (!q) return true;
  const f = (state.nodes || []).find(n => n.id === folderId);
  if (f && String(f.name || '').toLowerCase().includes(q)) return true;
  if (_adminItemsIn(folderId).some(it => _adminGenItemMatches(it, q))) return true;
  return _adminChildFolders(folderId).some(c => _adminGenBranchMatches(c.id, q));
}

/** One level of the tree, and every category nested under it. */
function _adminGenBranch(parentId, showAll) {
  // Matching a folder BY NAME shows its whole subtree; otherwise a branch is
  // kept only while it, or something under it, matches.
  const q = showAll ? '' : _adminGenQuery();
  return _adminChildFolders(parentId)
    .filter(f => _adminGenBranchMatches(f.id, q))
    .map(f => {
      const byName = !!q && String(f.name || '').toLowerCase().includes(q);
      const inner = showAll || byName;
      const kids = _adminGenBranch(f.id, inner);
      // The count still reports what is inside, including the items the tree
      // no longer lists — it is the reason to open the folder.
      const n = _adminFolderCount(f.id, _adminScope().scope) + _adminChildFolders(f.id).length;
      return _adminGenNodeHTML(f.id, f.name || 'Untitled', f.icon || 'folder', n, kids);
    }).join('');
}
/** Expansion is remembered, so the tree does not reset on every rerender. */
function _adminGenOpen(id) {
  try { return (JSON.parse(localStorage.getItem('adminGenOpen') || '[]')).includes(String(id)); }
  catch (e) { return false; }
}

function _adminGenRemember() {
  // Everything is force-opened during a search; recording that would wipe what
  // the reader had actually expanded.
  if (_adminGenQuery()) return;
  const open = [...document.querySelectorAll('#admin-general-nav .admin-gen-node')]
    .filter(n => {
      const kids = n.querySelector(':scope > .admin-gen-children');
      return kids && !kids.classList.contains('collapsed');
    })
    .map(n => n.getAttribute('data-folder'));
  try { localStorage.setItem('adminGenOpen', JSON.stringify(open)); } catch (e) { /* quota */ }
}
function _adminGenNodeHTML(id, name, icon, count, kids) {
  const showing = _adminCollection === 'general' && String(_adminNavFolderId) === String(id);
  // Searching forces every surviving branch open: a result inside a collapsed
  // branch is a result you cannot see. The stored set is left untouched.
  const open = _adminGenQuery() ? true : _adminGenOpen(id);
  const sid = escapeHTML(String(id));
  return `
    <div class="admin-gen-node" data-folder="${sid}">
      <div class="admin-gen-row${showing ? ' current' : ''}" onclick="_adminGenRowClick(event, '${sid}')">
        ${kids
          ? `<button class="admin-gen-chev${open ? ' open' : ''}" aria-expanded="${open}"
                     aria-label="Expand ${escapeHTML(name)}" onclick="_adminGenToggle(event, '${sid}')">
               <i data-lucide="chevron-right"></i>
             </button>`
          : '<span class="admin-gen-chev-spacer"></span>'}
        <i data-lucide="${escapeHTML(icon)}" class="admin-gen-icon"></i>
        <span class="admin-gen-name">${escapeHTML(name)}</span>
        <span class="admin-group-count">${count}</span>
      </div>
      ${kids ? `<div class="admin-gen-children${open ? '' : ' collapsed'}">
        <div class="admin-gen-children-inner">${kids}</div>
      </div>` : ''}
    </div>`;
}

/** Expand or collapse one branch, without disturbing the second pane. */
function _adminGenToggle(e, folderId) {
  e.preventDefault();
  e.stopPropagation();
  const node = e.currentTarget.closest('.admin-gen-node');
  const kids = node && node.querySelector(':scope > .admin-gen-children');
  if (!kids) return;
  const nowOpen = kids.classList.toggle('collapsed') === false;
  e.currentTarget.classList.toggle('open', nowOpen);
  e.currentTarget.setAttribute('aria-expanded', String(nowOpen));
  _adminGenRemember();
}

/**
 * The chevron expands the branch; the rest of the row opens that folder in the
 * second pane. Two jobs on one row, split the way the section headers are.
 */
function _adminGenRowClick(e, folderId) {
  if (e.target.closest('.admin-gen-chev')) return;   // the chevron handles itself
  // Navigating rebuilds this tree from the stored open set, so the set has to
  // be written first, or a branch just expanded would come back shut.
  _adminGenRemember();
  adminNavTo(folderId);
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
    _adminStaggerCards(host);
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
  _adminStaggerCards(host);
}

/**
 * Stagger the cards in, in reading order. The delay is written per element
 * rather than baked into CSS so it can be capped: a folder of sixty items
 * should not spend three seconds arriving.
 */
function _adminStaggerCards(host) {
  // Cards load in when the pane starts showing something else — a different
  // collection, or a different folder. Replaying it on every redraw made
  // entering arrange mode, or placing a single card, flash the whole grid.
  const key = String(_adminCollection) + '|' + String(_adminNavFolderId);
  if (key === _adminViewKey) return;
  _adminViewKey = key;

  host.classList.add('admin-cards-animate');
  const cards = host.querySelectorAll('.admin-cards-grid > *, .admin-nav-grid > *');
  const step = cards.length > 24 ? 12 : 34;
  cards.forEach((c, i) => {
    c.style.setProperty('--card-in-delay', Math.min(i * step, 420) + 'ms');
  });
  clearTimeout(_adminAnimTimer);
  _adminAnimTimer = setTimeout(() => host.classList.remove('admin-cards-animate'), 900);
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
  _adminRenderGeneralNav();   // mark the row the editor is now holding
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

/**
 * Redraw the card browser if it happens to be on screen. Practice sets and
 * locks are edited in modals that open OVER the cards, so their save paths
 * finish with the stale grid still visible behind them.
 */
function adminRefreshCardsIfOpen() {
  if (_adminCollection) adminRenderCards();
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
  _adminViewKey = null;
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
let _adminOrderMode = false;        // placing cards by clicking them, in order
let _adminOrderSeq = [];            // ids in the order they were clicked
let _adminViewKey = null;           // what the pane last showed, so the load-in
let _adminAnimTimer = null;         // only plays when that actually changes

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
  // An unfinished arrangement belongs to the folder it was started in.
  _adminOrderMode = false;
  _adminOrderSeq = [];
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

function _adminOrderStart() {
  _adminOrderMode = true;
  _adminOrderSeq = [];
  adminRenderCards();
}

function _adminOrderCancel() {
  _adminOrderMode = false;
  _adminOrderSeq = [];
  adminRenderCards();
}

/**
 * Clicking a card places it next in the sequence; clicking one already placed
 * takes it back out, and everything after it moves up. Nothing is written
 * until Done, so a half-finished ordering can be abandoned.
 */
function _adminOrderPick(id) {
  const at = _adminOrderSeq.indexOf(id);
  if (at === -1) _adminOrderSeq.push(id);
  else _adminOrderSeq.splice(at, 1);
  // Rebuilding the grid for one click threw away every card and replayed the
  // load-in, which read as a flash. Only the badges and the counter change.
  _adminOrderRefresh();
}

/** Re-label the cards from the sequence, without touching the DOM structure. */
function _adminOrderRefresh() {
  const host = document.getElementById('admin-card-browser');
  if (!host) return;
  const cards = [...host.querySelectorAll('.admin-nav-card[data-item-id]')];
  cards.forEach(card => {
    const place = _adminOrderSeq.indexOf(card.getAttribute('data-item-id'));
    const wasPlaced = card.classList.contains('placed');
    card.classList.toggle('placed', place > -1);
    card.title = place > -1 ? 'Click to unplace' : 'Click to place next';
    const badge = card.querySelector('.admin-nav-number');
    if (!badge) return;
    badge.textContent = place > -1 ? String(place + 1) : '';
    badge.classList.toggle('unplaced', place === -1);
    // Replay the pop only for a card that has just been placed; assigning
    // textContent alone does not restart a CSS animation.
    if (place > -1 && !wasPlaced) {
      badge.style.animation = 'none';
      void badge.offsetWidth;
      badge.style.animation = '';
    }
  });
  const msg = host.querySelector('.admin-order-msg');
  if (msg) {
    msg.innerHTML = '<strong>Click the cards in the order you want.</strong> ' +
      _adminOrderSeq.length + ' of ' + cards.length + ' placed';
  }
  const done = host.querySelector('.admin-order-bar .btn-primary');
  if (done) done.disabled = !_adminOrderSeq.length;
}
/**
 * Write the sequence back. Cards clicked keep their click order; anything left
 * unplaced follows, in the order it already had, rather than being shuffled.
 */
function _adminOrderApply() {
  const key = _adminScope().key;
  const arr = state[key] || [];
  const here = _adminNavFolderId === ADMIN_UNCAT ? null : (_adminNavFolderId || null);
  const siblings = arr.filter(x => (x.parentId || null) === here);
  if (!siblings.length || !_adminOrderSeq.length) return _adminOrderCancel();

  const placed = _adminOrderSeq
    .map(id => siblings.find(x => String(x.id) === String(id)))
    .filter(Boolean);
  const rest = siblings.filter(x => !_adminOrderSeq.includes(String(x.id)));
  _adminWriteSiblingOrder(arr, here, placed.concat(rest));

  saveData();
  _adminOrderMode = false;
  _adminOrderSeq = [];
  if (typeof renderAdmin === 'function') renderAdmin();
  adminRenderCards();
  if (typeof toast === 'function') toast('Order saved.', { type: 'success' });
}

/** Put `ordered` back into `arr`, leaving every other folder's items alone. */
function _adminWriteSiblingOrder(arr, parentId, ordered) {
  const slots = [];
  arr.forEach((x, i) => { if ((x.parentId || null) === parentId) slots.push(i); });
  slots.forEach((slot, i) => { arr[slot] = ordered[i]; });
}

/** The sort choices in the Order menu. */
function _adminOrderSort(kind) {
  const sc = _adminScope();
  const arr = state[sc.key] || [];
  const here = _adminNavFolderId === ADMIN_UNCAT ? null : (_adminNavFolderId || null);
  const siblings = arr.filter(x => (x.parentId || null) === here);
  if (siblings.length < 2) return;

  const title = (x) => String(_adminCollectionSet()[0].card(x).title || '').toLowerCase();
  const made = (x) => x.createdAt || 0;
  const sorted = siblings.slice();
  if (kind === 'az') sorted.sort((a, b) => title(a).localeCompare(title(b)));
  else if (kind === 'za') sorted.sort((a, b) => title(b).localeCompare(title(a)));
  else if (kind === 'new') sorted.sort((a, b) => made(b) - made(a));
  else if (kind === 'old') sorted.sort((a, b) => made(a) - made(b));
  else if (kind === 'reverse') sorted.reverse();
  else return;

  _adminWriteSiblingOrder(arr, here, sorted);
  saveData();
  if (typeof renderAdmin === 'function') renderAdmin();
  adminRenderCards();
  const label = { az: 'A to Z', za: 'Z to A', 'new': 'newest first',
                  old: 'oldest first', reverse: 'reversed' }[kind];
  if (typeof toast === 'function') toast('Ordered ' + label + '.', { type: 'success' });
}


/* ── the cards ────────────────────────────────────────────── */

function _adminNavFolderCardHTML(f) {
  const sc = _adminScope();
  const direct = _adminFolderCount(f.id, sc.scope);
  const subs = _adminChildFolders(f.id).length;
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
  const col = _adminCollectionSet()[0];
  const c = col.card(item);
  const id = escapeHTML(String(item.id));
  const cover = typeof libCoverFallbackHTML === 'function'
    ? libCoverFallbackHTML(c.title, c.icon) : '';

  // Outside ordering there is no number on the card at all: the grid is
  // already in order, so stamping every card with one was noise.
  const place = _adminOrderMode ? _adminOrderSeq.indexOf(String(item.id)) : -1;
  const badge = _adminOrderMode
    ? `<span class="admin-nav-number${place === -1 ? ' unplaced' : ''}">${place === -1 ? '' : place + 1}</span>`
    : '';

  const body = `
      ${cover}
      ${badge}
      <div class="admin-nav-head">
        <h3>${escapeHTML(c.title)}</h3>
      </div>
      <p class="admin-nav-sub">${escapeHTML(c.sub || '')}</p>
      <div class="card-stat-row">
        ${(c.meta || []).map(m => `<span class="card-stat"><i data-lucide="${m.icon}"></i>${escapeHTML(String(m.text))}</span>`).join('')}
      </div>`;

  if (_adminOrderMode) {
    return `
      <div class="card card-enhanced has-cover admin-nav-card admin-nav-ordering${place > -1 ? ' placed' : ''}"
           data-item-id="${id}"
           onclick="_adminOrderPick('${id}')" title="${place > -1 ? 'Click to unplace' : 'Click to place next'}">
        ${body}
      </div>`;
  }

  return `
    <div class="card card-enhanced has-cover admin-nav-card" onclick="adminOpenFromCard('${id}')" style="cursor:pointer;">
      ${body}
      <div class="admin-nav-actions">
        <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); adminOpenFromCard('${id}')">
          <i data-lucide="pencil"></i> Edit
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
    if (_adminNavFolderId === id) _adminNavFolderId = up;
    const repaint = () => {
      if (typeof renderAdmin === 'function') renderAdmin();
      adminRenderCards();
    };
    // Through the shared helper, which promotes the children exactly the same
    // way and raises the undo toast this path never had.
    if (typeof softDeleteFolder === 'function') {
      softDeleteFolder(id, repaint);
    } else {
      (state.nodes || []).forEach(c => { if (c.parentId === id) c.parentId = up; });
      (state[sc.key] || []).forEach(x => { if (x.parentId === id) x.parentId = up; });
      delete (state.categoryRequirements || {})[id];
      state.nodes = (state.nodes || []).filter(x => x.id !== id);
      saveData();
      repaint();
    }
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

  const cards = _adminOrderMode
    ? items.map((it, i) => _adminNavItemCardHTML(it, i + 1)).join('')
    : folders.map(_adminNavFolderCardHTML).join('') +
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
        ${items.length > 1 ? `
        <details class="lib-view admin-order-menu">
          <summary title="How the ${escapeHTML(sc.noun)}s in this folder are ordered">
            <i data-lucide="arrow-up-down" style="width:13px;height:13px;"></i> Order
            <i data-lucide="chevron-down" class="lib-view-chev" style="width:12px;height:12px;"></i>
          </summary>
          <div class="lib-view-pop">
            <div class="lib-view-title">Order</div>
            <button class="admin-order-opt" onclick="_adminOrderStart()">
              <i data-lucide="mouse-pointer-click"></i>
              <span><strong>Arrange by hand</strong><em>Click the cards one by one, in the order you want</em></span>
            </button>
            <div class="lib-view-sep"></div>
            <button class="admin-order-opt" onclick="_adminOrderSort('az')">
              <i data-lucide="arrow-down-a-z"></i><span><strong>A to Z</strong></span>
            </button>
            <button class="admin-order-opt" onclick="_adminOrderSort('za')">
              <i data-lucide="arrow-up-a-z"></i><span><strong>Z to A</strong></span>
            </button>
            <button class="admin-order-opt" onclick="_adminOrderSort('new')">
              <i data-lucide="clock"></i><span><strong>Newest first</strong></span>
            </button>
            <button class="admin-order-opt" onclick="_adminOrderSort('old')">
              <i data-lucide="history"></i><span><strong>Oldest first</strong></span>
            </button>
            <div class="lib-view-sep"></div>
            <button class="admin-order-opt" onclick="_adminOrderSort('reverse')">
              <i data-lucide="flip-vertical-2"></i><span><strong>Reverse</strong></span>
            </button>
          </div>
        </details>` : ''}
        <button class="btn btn-secondary btn-sm" onclick="_adminNewFolderIn()">
          <i data-lucide="folder-plus"></i> New category
        </button>
      </div>
    </div>
    ${_adminOrderMode ? `
    <div class="admin-order-bar" role="status">
      <i data-lucide="mouse-pointer-click"></i>
      <span class="admin-order-msg">
        <strong>Click the cards in the order you want.</strong>
        ${_adminOrderSeq.length} of ${items.length} placed
      </span>
      <button class="btn btn-ghost btn-sm" onclick="_adminOrderCancel()">Cancel</button>
      <button class="btn btn-primary btn-sm" onclick="_adminOrderApply()"
              ${_adminOrderSeq.length ? '' : 'disabled'}>Done</button>
    </div>` : ''}
    <div class="admin-nav-grid">
      ${cards}
      ${here !== null && !_adminOrderMode ? `<button class="admin-card admin-card-add" onclick="adminCreateFromCard()" title="New ${escapeHTML(sc.noun)}">
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
