/* ============================================================
   ADMIN-WINGS.JS — the admin the seven wings never had
   ------------------------------------------------------------
   Mindset, Insights, Remembrance, Diary, Collection, Progression and Roadmap
   sat in the Admin Panel under "Other Wings" as cards that opened the library
   itself and said entries were managed in there. That was true, and it was
   also the only thing in the panel that was not an admin: no table, no bulk
   edit, no folder management, and no form of the kind every other wing gets.

   ONE ENGINE, NOT SEVEN PAGES. Every wing already declares what it is through
   wing-common.js — its noun, its fields, their types. That is enough to build
   a table with the right columns and a form with the right editors, so this
   asks the registry instead of hardcoding anything. A wing added later gets
   its admin the moment it registers, with nothing here to change.

   It shares wingFieldEditorHTML and wingReadFieldValues with the in-library
   editor deliberately: the same field, edited in two places, should be the
   same control with the same behaviour and the same saved shape.
   ============================================================ */

let _awxKey = 'mindset';
let _awxTab = 'entries';
let _awxEditing = null;        // id, 'new', or null
let _awxSearch = '';
let _awxFolderFilter = '';     // '' = all, '__none' = uncategorized
let _awxSelected = [];

function awxConfig() {
  const list = (typeof LIBRARY_WINGS !== 'undefined') ? LIBRARY_WINGS : [];
  return list.find(w => w.key === _awxKey) || { key: _awxKey, name: 'Wing', icon: 'library', accent: '#8b5cf6' };
}

function awxSchema() { return wingSchema(_awxKey); }
function awxItems() { return wingItems(_awxKey); }
function awxScope() { return 'wing:' + _awxKey; }

function awxFolders() {
  const out = [];
  const walk = (pid, d) => getChildFolders(pid, awxScope()).forEach(f => {
    out.push({ id: f.id, name: f.name, depth: d });
    walk(f.id, d + 1);
  });
  walk(null, 0);
  return out;
}

function awxFolderName(id) {
  if (!id) return '';
  const n = state.nodes.find(x => x.id === id);
  return n ? n.name : '';
}

function _awxCap(s) { return String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1); }

/* ── Route ────────────────────────────────────────────────── */

function adminWingTemplate() {
  return `
    <div class="home-content">
      <div class="home-scroll" id="awx-root" style="padding:1.5rem 2rem 4rem;">
        <div class="admin-hub-head">
          <button onclick="awxLeave('admin')" class="btn-back-dark" style="padding:0.25rem 0.5rem; font-size:0.75rem;">
            <i data-lucide="chevron-left" style="width:14px;height:14px;"></i> Back
          </button>
          <h1 class="lib-hub-title" style="font-size:1.6rem; margin-left:0.75rem;" id="awx-title">Wing Admin</h1>
        </div>
        <div class="awx-head">
          <div class="lang-tabs lang-tabs-admin" id="awx-tabs"></div>
          <button class="btn btn-secondary btn-sm" type="button" onclick="awxSeedPack()"
                  title="Add worked examples that use this wing's own fields"
                  id="awx-seed-btn">
            <i data-lucide="sparkles" style="width:14px;height:14px;"></i> Add starter pack
          </button>
          <button class="btn btn-secondary btn-sm" type="button" onclick="awxOpenLibrary()"
                  title="Open the library this configures">
            <i data-lucide="external-link" style="width:14px;height:14px;"></i> Open library
          </button>
        </div>
        <div id="awx-body"></div>
      </div>
    </div>`;
}

/** Each wing's admin route calls this with its own key. */
function adminWingInitFor(key) {
  _awxKey = key;
  _awxTab = 'entries';
  _awxEditing = null;
  _awxSearch = '';
  _awxFolderFilter = '';
  _awxSelected = [];
  wingItems(key);                       // make sure the bucket exists
  renderAwx();
}

function adminWingDestroy() {
  _awxEditing = null;
  _awxSelected = [];
  wingFormEnd();
}

/** Leaving with an open form asks first, like every other admin does. */
function awxLeave(route) {
  if (_awxEditing) {
    wingConfirmDiscard(() => spaNavigate(route), (o) => awxSave(o));
    return;
  }
  spaNavigate(route);
}

function awxOpenLibrary() { awxLeave(_awxKey); }

/** Worked examples, so a brand new wing is not an empty grid. */
function awxSeedPack() {
  if (typeof wingLoadSeedPack !== 'function') return;
  wingLoadSeedPack(_awxKey, () => renderAwx());
}

function awxSetTab(tab) {
  const go = () => { _awxTab = tab; _awxEditing = null; _awxSelected = []; renderAwx(); };
  if (_awxEditing) { wingConfirmDiscard(go, (o) => awxSave(o)); return; }
  go();
}

function renderAwx() {
  const cfg = awxConfig();
  const schema = awxSchema();
  const root = document.getElementById('awx-root');
  const title = document.getElementById('awx-title');
  const tabs = document.getElementById('awx-tabs');
  const body = document.getElementById('awx-body');
  if (!root || !body) return;

  root.style.setProperty('--wing-accent', cfg.accent || '#8b5cf6');
  if (title) title.textContent = cfg.name + ' Admin';

  if (tabs) {
    tabs.innerHTML = [
      ['entries', _awxCap(schema.nounPlural), cfg.icon || 'file-text', awxItems().length],
      ['folders', 'Folders', 'folder', awxFolders().length]
    ].map(([k, label, icon, n]) => `
      <button class="lang-tab${_awxTab === k ? ' is-active' : ''}" type="button" onclick="awxSetTab('${k}')">
        <i data-lucide="${icon}"></i> ${escapeHTML(label)} <span class="awx-tab-n">${n}</span>
      </button>`).join('');
  }

  if (_awxEditing) body.innerHTML = awxFormHTML();
  else if (_awxTab === 'folders') body.innerHTML = awxFoldersHTML();
  else body.innerHTML = awxListHTML();

  // Nothing left to add means the button has nothing to say; hiding it beats
  // a control that only ever tells you it did nothing.
  const seedBtn = document.getElementById('awx-seed-btn');
  if (seedBtn) {
    const left = (typeof wingSeedAvailable === 'function') ? wingSeedAvailable(_awxKey) : 0;
    seedBtn.style.display = left ? '' : 'none';
  }

  if (typeof lucide !== 'undefined') lucide.createIcons({ root });

  if (_awxEditing) {
    wingRenderTags();
    wingBindFormDirty(document.getElementById('awx-form'));
    const t = document.getElementById('wing-f-title');
    if (t) t.focus();
  }
}

/* ── The table ────────────────────────────────────────────────
   Columns come from the schema. Only the field types that read as one short
   value get a column — a textarea, a checklist or a set of stages would turn
   every row into a paragraph, so those are left to the form and the reader.
   ------------------------------------------------------------ */

const AWX_COLUMN_TYPES = ['select', 'date', 'text', 'rating'];

function awxColumns() {
  return (awxSchema().fields || [])
    .filter(f => AWX_COLUMN_TYPES.indexOf(f.type) >= 0)
    .slice(0, 3);
}

function awxCellValue(w, f) {
  const v = wingVal(w, f.key);
  if (v === '' || v === null || v === undefined) return '<em class="awx-dim">—</em>';
  if (f.type === 'rating') {
    const n = parseInt(v, 10) || 0;
    if (!n) return '<em class="awx-dim">—</em>';
    return `<span class="awx-rate">${'★'.repeat(n)}<span class="awx-dim">${'★'.repeat(Math.max(0, (f.max || 5) - n))}</span></span>`;
  }
  if (f.type === 'date') return escapeHTML(wingDateLabel(v) || v);
  return escapeHTML(String(v));
}

function awxFiltered() {
  const q = _awxSearch.trim().toLowerCase();
  return awxItems().filter(w => {
    if (_awxFolderFilter === '__none' && w.parentId) return false;
    if (_awxFolderFilter && _awxFolderFilter !== '__none' && w.parentId !== _awxFolderFilter) return false;
    if (!q) return true;
    const data = w.data || {};
    const hay = [w.title, w.body, (w.tags || []).join(' '),
                 Object.keys(data).map(k => data[k]).join(' ')].join(' ').toLowerCase();
    return hay.indexOf(q) >= 0;
  });
}

function awxListHTML() {
  const schema = awxSchema();
  const cols = awxColumns();
  const list = awxFiltered().slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const total = awxItems().length;
  const folders = awxFolders();

  const rows = list.map(w => {
    const sel = _awxSelected.indexOf(w.id) >= 0;
    const tags = w.tags || [];
    return `
      <tr class="${sel ? 'is-selected' : ''}">
        <td class="awx-check-cell">
          <input type="checkbox" ${sel ? 'checked' : ''} onchange="awxToggleSelect('${w.id}')"
                 aria-label="Select ${escapeHTML(w.title || 'Untitled')}" />
        </td>
        <td>
          <button class="awx-title-btn" onclick="awxEdit('${w.id}')">${escapeHTML(w.title || 'Untitled')}</button>
          ${tags.length ? `<div class="awx-row-tags">${tags.slice(0, 4).map(t => `<span class="awx-mini-tag">${escapeHTML(t)}</span>`).join('')}</div>` : ''}
        </td>
        <td>${w.parentId ? escapeHTML(awxFolderName(w.parentId)) : '<em class="awx-dim">Uncategorized</em>'}</td>
        ${cols.map(f => `<td>${awxCellValue(w, f)}</td>`).join('')}
        <td class="awx-dim">${w.updatedAt ? escapeHTML(new Date(w.updatedAt).toLocaleDateString()) : '—'}</td>
        <td class="awx-actions">
          <button class="btn btn-ghost btn-sm" onclick="awxEdit('${w.id}')" title="Edit"><i data-lucide="pencil"></i></button>
          <button class="btn btn-ghost btn-sm" onclick="awxOpenInLibrary('${w.id}')" title="View in library"><i data-lucide="external-link"></i></button>
          <button class="btn btn-ghost btn-sm" onclick="awxDelete('${w.id}')" title="Delete"><i data-lucide="trash-2"></i></button>
        </td>
      </tr>`;
  }).join('');

  const allShown = list.length > 0 && list.every(w => _awxSelected.indexOf(w.id) >= 0);

  return `
    <div class="awx-bar">
      <button class="btn btn-primary" onclick="awxNew()">
        <i data-lucide="plus" style="width:15px;height:15px;"></i> New ${escapeHTML(schema.noun)}
      </button>
      <div class="awx-search">
        <i data-lucide="search"></i>
        <input class="form-input" id="awx-search" value="${escapeHTML(_awxSearch)}"
               placeholder="Search ${escapeHTML(schema.nounPlural)}..." oninput="awxSearch(this.value)" />
      </div>
      <select class="form-select awx-folder-filter" onchange="awxFilterFolder(this.value)">
        <option value=""${_awxFolderFilter === '' ? ' selected' : ''}>All folders</option>
        <option value="__none"${_awxFolderFilter === '__none' ? ' selected' : ''}>Uncategorized</option>
        ${folders.map(f => `<option value="${f.id}"${_awxFolderFilter === f.id ? ' selected' : ''}>${escapeHTML('— '.repeat(f.depth) + f.name)}</option>`).join('')}
      </select>
      <span class="awx-count">${list.length}${list.length !== total ? ' of ' + total : ''} ${escapeHTML(list.length === 1 ? schema.noun : schema.nounPlural)}</span>
    </div>

    ${_awxSelected.length ? awxBulkBarHTML(folders) : ''}

    ${list.length ? `
      <div class="awx-table-wrap">
        <table class="awx-table">
          <thead>
            <tr>
              <th class="awx-check-cell">
                <input type="checkbox" ${allShown ? 'checked' : ''} onchange="awxToggleAll()" aria-label="Select all" />
              </th>
              <th>${escapeHTML(schema.titleLabel)}</th>
              <th>Folder</th>
              ${cols.map(f => `<th>${escapeHTML(f.label)}</th>`).join('')}
              <th>Updated</th>
              <th class="awx-actions">Actions</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`
    : awxEmptyHTML(total)}`;
}

function awxEmptyHTML(total) {
  const schema = awxSchema();
  const searching = !!(_awxSearch.trim() || _awxFolderFilter);
  const noun = total === 1 ? schema.noun : schema.nounPlural;
  return `
    <div class="awx-empty">
      <div class="awx-empty-icon"><i data-lucide="${searching ? 'search-x' : (awxConfig().icon || 'file-text')}"></i></div>
      <h3>${searching ? 'Nothing matches' : 'No ' + escapeHTML(schema.nounPlural) + ' yet'}</h3>
      <p>${searching
            ? 'There ' + (total === 1 ? 'is' : 'are') + ' ' + total + ' ' + escapeHTML(noun) + ' in this wing, but none match what you are filtering by.'
            : 'Write the first one here, or in the library itself — they are the same ' + escapeHTML(schema.nounPlural) + '.'}</p>
      ${searching
        ? `<button class="btn btn-secondary" onclick="awxClearFilters()"><i data-lucide="x" style="width:15px;height:15px;"></i> Clear filters</button>`
        : `<button class="btn btn-primary" onclick="awxNew()"><i data-lucide="plus" style="width:15px;height:15px;"></i> New ${escapeHTML(schema.noun)}</button>`}
    </div>`;
}

function awxBulkBarHTML(folders) {
  const n = _awxSelected.length;
  return `
    <div class="awx-bulk">
      <span class="awx-bulk-n">${n} selected</span>
      <select class="form-select" onchange="awxBulkMove(this.value); this.value='';">
        <option value="">Move to folder...</option>
        <option value="__none">Uncategorized</option>
        ${folders.map(f => `<option value="${f.id}">${escapeHTML('— '.repeat(f.depth) + f.name)}</option>`).join('')}
      </select>
      <button class="btn btn-danger btn-sm" onclick="awxBulkDelete()">
        <i data-lucide="trash-2" style="width:14px;height:14px;"></i> Delete
      </button>
      <button class="btn btn-ghost btn-sm" onclick="awxClearSelection()">Clear</button>
    </div>`;
}

/* ── List actions ─────────────────────────────────────────── */

/**
 * Repaint on every keystroke, then put the caret back.
 *
 * The whole body is rebuilt because the count and the empty state are part of
 * the same markup as the table; restoring the selection afterwards is what
 * keeps that from throwing you out of the box you are typing in.
 */
function awxSearch(v) {
  _awxSearch = v;
  const body = document.getElementById('awx-body');
  if (!body) return;
  const active = document.activeElement;
  const caret = (active && active.id === 'awx-search') ? active.selectionStart : null;
  body.innerHTML = awxListHTML();
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: body });
  const box = document.getElementById('awx-search');
  if (box && caret !== null) {
    box.focus();
    try { box.setSelectionRange(caret, caret); } catch (e) {}
  }
}

function awxFilterFolder(v) { _awxFolderFilter = v; _awxSelected = []; renderAwx(); }
function awxClearFilters() { _awxSearch = ''; _awxFolderFilter = ''; renderAwx(); }
function awxClearSelection() { _awxSelected = []; renderAwx(); }

function awxToggleSelect(id) {
  const i = _awxSelected.indexOf(id);
  if (i >= 0) _awxSelected.splice(i, 1); else _awxSelected.push(id);
  renderAwx();
}

function awxToggleAll() {
  const shown = awxFiltered().map(w => w.id);
  const all = shown.length && shown.every(id => _awxSelected.indexOf(id) >= 0);
  _awxSelected = all ? [] : shown;
  renderAwx();
}

function awxBulkMove(folderId) {
  if (!folderId || !_awxSelected.length) return;
  const target = folderId === '__none' ? null : folderId;
  const key = _awxKey;
  const items = awxItems();
  // Where each one was, so Undo is a real undo and not a move to the root.
  const before = _awxSelected.map(id => {
    const w = items.find(x => x.id === id);
    return w ? { id: id, parentId: w.parentId || null } : null;
  }).filter(Boolean);

  before.forEach(b => {
    const w = items.find(x => x.id === b.id);
    if (w) { w.parentId = target; w.updatedAt = Date.now(); }
  });
  const label = target ? awxFolderName(target) : 'Uncategorized';
  saveData();
  _awxSelected = [];
  renderAwx();

  if (typeof pushUndo === 'function') {
    pushUndo('Moved ' + before.length + ' to ' + label, () => {
      const list = wingItems(key);
      before.forEach(b => { const w = list.find(x => x.id === b.id); if (w) w.parentId = b.parentId; });
      saveData();
      renderAwx();
    });
  }
  if (typeof toast === 'function') toast('Moved ' + before.length + ' to ' + label + '.', { type: 'success' });
}

function awxBulkDelete() {
  if (!_awxSelected.length) return;
  const n = _awxSelected.length;
  const schema = awxSchema();
  const key = _awxKey;
  const noun = n === 1 ? schema.noun : schema.nounPlural;
  showConfirm('Delete ' + n + ' ' + noun,
    'They can be put back with Undo straight afterwards.', () => {
      const items = wingItems(key);
      // Snapshot with positions, so Undo puts them back where they were rather
      // than in a heap at the end of the list.
      const removed = [];
      _awxSelected.forEach(id => {
        const i = items.findIndex(w => w.id === id);
        if (i >= 0) removed.push({ at: i, item: JSON.parse(JSON.stringify(items[i])) });
      });
      removed.slice().sort((a, b) => b.at - a.at).forEach(r => items.splice(r.at, 1));
      _awxSelected = [];
      const cleared = wingClearDeadGoalRefs();
      saveData();
      renderAwx();

      if (typeof pushUndo === 'function') {
        pushUndo('Deleted ' + n + ' ' + noun, () => {
          const list = wingItems(key);
          removed.slice().sort((a, b) => a.at - b.at)
            .forEach(r => list.splice(Math.min(r.at, list.length), 0, r.item));
          wingRestoreGoalRefs(cleared);
          saveData();
          renderAwx();
        });
      }
    });
}

function awxDelete(id) {
  const key = _awxKey;
  const items = wingItems(key);
  const i = items.findIndex(w => w.id === id);
  if (i < 0) return;
  const snapshot = JSON.parse(JSON.stringify(items[i]));
  showConfirm('Delete ' + awxSchema().noun, 'Delete "' + (snapshot.title || 'Untitled') + '"?', () => {
    const list = wingItems(key);
    const at = list.findIndex(w => w.id === id);
    if (at < 0) return;
    list.splice(at, 1);
    // Otherwise the bulk bar goes on counting it: select three, delete one
    // from its own row, and the bar still claimed "3 selected" over two
    // ticked boxes.
    const sel = _awxSelected.indexOf(id);
    if (sel >= 0) _awxSelected.splice(sel, 1);
    const cleared = wingClearDeadGoalRefs();
    saveData();
    renderAwx();
    if (typeof pushUndo === 'function') {
      pushUndo('Deleted "' + (snapshot.title || 'Untitled') + '"', () => {
        const l = wingItems(key);
        l.splice(Math.min(at, l.length), 0, snapshot);
        wingRestoreGoalRefs(cleared);
        saveData();
        renderAwx();
      });
    }
  });
}

function awxOpenInLibrary(id) {
  const key = _awxKey;
  const go = () => { if (typeof wingGoTo === 'function') wingGoTo(key, id); };
  if (_awxEditing) { wingConfirmDiscard(go, (o) => awxSave(o)); return; }
  go();
}

/* ── Folders ──────────────────────────────────────────────── */

function awxFoldersHTML() {
  const folders = awxFolders();
  const items = awxItems();
  const countIn = (id) => items.filter(w => w.parentId === id).length;
  const loose = items.filter(w => !w.parentId).length;

  return `
    <div class="awx-bar">
      <button class="btn btn-primary" onclick="awxNewFolder()">
        <i data-lucide="folder-plus" style="width:15px;height:15px;"></i> New folder
      </button>
      <span class="awx-count">${folders.length} folder${folders.length !== 1 ? 's' : ''}</span>
    </div>

    <div class="awx-folder-list">
      <div class="awx-folder-row is-loose">
        <i data-lucide="inbox"></i>
        <span class="awx-folder-name">Uncategorized</span>
        <span class="awx-folder-n">${loose}</span>
      </div>
      ${folders.map(f => `
        <div class="awx-folder-row" style="--awx-depth:${f.depth};">
          <i data-lucide="folder"></i>
          <span class="awx-folder-name">${escapeHTML(f.name)}</span>
          <span class="awx-folder-n">${countIn(f.id)}</span>
          <div class="awx-folder-actions">
            <button class="btn btn-ghost btn-sm" onclick="awxRenameFolder('${f.id}')" title="Rename"><i data-lucide="pencil"></i></button>
            <button class="btn btn-ghost btn-sm" onclick="awxAddSubfolder('${f.id}')" title="Add a folder inside"><i data-lucide="folder-plus"></i></button>
            <button class="btn btn-ghost btn-sm" onclick="awxDeleteFolder('${f.id}')" title="Delete"><i data-lucide="trash-2"></i></button>
          </div>
        </div>`).join('')}
      ${folders.length ? '' : '<p class="awx-dim" style="padding:0.9rem 0.2rem;">No folders yet. Entries without one are Uncategorized.</p>'}
    </div>`;
}

function awxNewFolder(parentId) {
  showInputDialog('New folder', 'A folder inside ' + awxConfig().name + '.', 'Folder name', '', (name) => {
    if (!name || !name.trim()) return;
    state.nodes.push({
      id: generateId(), name: name.trim(), type: 'folder',
      parentId: parentId || null, scope: awxScope(), order: state.nodes.length
    });
    saveData();
    renderAwx();
  });
}

function awxAddSubfolder(id) { awxNewFolder(id); }

function awxRenameFolder(id) {
  const node = state.nodes.find(n => n.id === id);
  if (!node) return;
  showInputDialog('Rename folder', 'A new name for this folder.', 'Folder name', node.name, (name) => {
    if (!name || !name.trim()) return;
    node.name = name.trim();
    saveData();
    renderAwx();
  });
}

/**
 * Deleting a folder never deletes what is in it.
 *
 * Its entries and any folders inside it move up to where it was, so a tidy-up
 * cannot cost you an entry. The dialog says so with the real numbers: the word
 * "delete" beside a folder holding forty entries should say what it does to
 * the forty.
 */
function awxDeleteFolder(id) {
  const node = state.nodes.find(n => n.id === id);
  if (!node) return;
  const schema = awxSchema();
  const items = awxItems();
  const n = items.filter(w => w.parentId === id).length;
  const kids = getChildFolders(id, awxScope()).length;
  const parts = [];
  if (n) parts.push(n + ' ' + (n === 1 ? schema.noun : schema.nounPlural));
  if (kids) parts.push(kids + ' folder' + (kids === 1 ? '' : 's'));
  const msg = parts.length
    ? 'The ' + parts.join(' and ') + ' inside will move up a level, not be deleted.'
    : 'This folder is empty.';

  showConfirm('Delete folder', msg, () => {
    const up = node.parentId || null;
    const scope = awxScope();
    items.forEach(w => { if (w.parentId === id) w.parentId = up; });
    state.nodes.forEach(x => { if (x.parentId === id && x.scope === scope) x.parentId = up; });
    state.nodes = state.nodes.filter(x => x.id !== id);
    if (_awxFolderFilter === id) _awxFolderFilter = '';
    saveData();
    renderAwx();
  });
}

/* ── The form ─────────────────────────────────────────────────
   The admin form chrome, not the bare stack the wings had: a header that says
   what is being edited with a live save status, the fields in sections rather
   than one column of twelve, a required marker on the one field that really is
   required, and the keyboard shortcuts the rest of the admin uses.
   ------------------------------------------------------------ */

function awxNew() {
  _awxEditing = 'new';
  wingTagsBegin([], _awxKey);
  wingFormBegin('awx-save-status', awxSave);
  renderAwx();
}

function awxEdit(id) {
  const w = awxItems().find(x => x.id === id);
  if (!w) return;
  _awxEditing = id;
  wingTagsBegin(w.tags || [], _awxKey);
  wingFormBegin('awx-save-status', awxSave);
  renderAwx();
}

function awxCancel() {
  wingConfirmDiscard(() => { _awxEditing = null; wingFormEnd(); renderAwx(); }, (o) => awxSave(o));
}

function awxFormHTML() {
  const schema = awxSchema();
  const cfg = awxConfig();
  const isNew = _awxEditing === 'new';
  const w = isNew
    ? { title: '', body: '', tags: [], data: {},
        parentId: (_awxFolderFilter && _awxFolderFilter !== '__none') ? _awxFolderFilter : null }
    : (awxItems().find(x => x.id === _awxEditing) || { title: '', body: '', tags: [], data: {} });
  const folders = awxFolders();
  const fieldHTML = (schema.fields || []).map(f => wingFieldEditorHTML(f, w)).join('');

  return `
    <div class="admin-form-panel awx-form" id="awx-form">
      <div class="admin-form-header">
        <div class="af-header-left">
          <div class="af-header-badge"><i data-lucide="${cfg.icon || 'file-text'}"></i></div>
          <div class="af-header-text">
            <h2>${isNew ? 'New ' + escapeHTML(schema.noun) : 'Edit ' + escapeHTML(schema.noun)}</h2>
            <p>${escapeHTML(cfg.name)}</p>
          </div>
        </div>
        <span class="af-save-status" id="awx-save-status"></span>
        <button class="af-close-btn" onclick="awxCancel()" title="Close" aria-label="Close">
          <i data-lucide="x"></i>
        </button>
      </div>

      <div class="af-section">
        <div class="af-section-header">
          <span class="af-section-icon"><i data-lucide="pen-line"></i></span>
          <h3>Essentials</h3>
        </div>
        <div class="af-section-body">
          <div class="af-field af-field-wide">
            <label class="form-label" for="wing-f-title">${escapeHTML(schema.titleLabel)}
              <span class="af-req${String(w.title || '').trim() ? ' is-filled' : ''}" id="awx-req-title">Required</span></label>
            <input id="wing-f-title" class="form-input af-input-bold" value="${escapeHTML(w.title || '')}"
                   placeholder="${escapeHTML(schema.titlePlaceholder)}"
                   oninput="awxTitleTyped(this.value)" />
          </div>
          <div class="af-field">
            <label class="form-label" for="wing-f-folder">Folder</label>
            <select id="wing-f-folder" class="form-select">
              <option value="">Uncategorized</option>
              ${folders.map(f => `<option value="${f.id}"${(w.parentId || '') === f.id ? ' selected' : ''}>${escapeHTML('— '.repeat(f.depth) + f.name)}</option>`).join('')}
            </select>
          </div>
          ${wingTagEditorHTML(_awxKey)}
        </div>
      </div>

      ${fieldHTML ? `
      <div class="af-section">
        <div class="af-section-header">
          <span class="af-section-icon"><i data-lucide="sliders"></i></span>
          <h3>${escapeHTML(_awxCap(schema.noun))} details</h3>
        </div>
        <div class="af-section-body">${fieldHTML}</div>
      </div>` : ''}

      <div class="af-section">
        <div class="af-section-header">
          <span class="af-section-icon"><i data-lucide="align-left"></i></span>
          <h3>${escapeHTML(schema.bodyLabel)}</h3>
        </div>
        <div class="af-section-body">
          <div class="af-field af-field-wide">
            <textarea id="wing-f-body" class="form-textarea" rows="12"
                      placeholder="${escapeHTML(schema.bodyPlaceholder)}">${escapeHTML(w.body || '')}</textarea>
          </div>
        </div>
      </div>

      <div class="admin-form-footer">
        <span class="af-footer-hint"><kbd>Ctrl</kbd>+<kbd>S</kbd> to save · <kbd>Esc</kbd> to close</span>
        <div class="af-footer-actions">
          <button class="btn btn-secondary" onclick="awxCancel()">
            <i data-lucide="x" style="width:15px;height:15px;"></i> Discard
          </button>
          <button class="btn btn-primary" onclick="awxSave()">
            <i data-lucide="save" style="width:15px;height:15px;"></i> Save ${escapeHTML(schema.noun)}
          </button>
        </div>
      </div>
    </div>`;
}

/** The required marker goes as soon as the field stops being empty. */
function awxTitleTyped(v) {
  const req = document.getElementById('awx-req-title');
  if (req) req.classList.toggle('is-filled', !!String(v || '').trim());
  wingMarkDirty();
}

/**
 * @param   {object} [opts]  opts.silent keeps the form open (the unsaved
 *                           dialog's "save" path).
 * @returns {boolean} false when validation failed, so that dialog knows to
 *                    keep the form open rather than close over an error.
 */
function awxSave(opts) {
  const silent = !!(opts && opts.silent);
  const schema = awxSchema();
  const titleEl = document.getElementById('wing-f-title');
  const title = String((titleEl || {}).value || '').trim();
  if (!title) {
    if (typeof showValidationError === 'function') showValidationError(titleEl);
    if (typeof toast === 'function') toast('Give it a title first.', { type: 'warning' });
    return false;
  }

  const body = String((document.getElementById('wing-f-body') || {}).value || '');
  const parentId = (document.getElementById('wing-f-folder') || {}).value || null;
  const tags = wingTagsRead();
  const items = awxItems();

  if (_awxEditing === 'new') {
    const item = {
      id: generateId(), title: title, body: body, tags: tags, parentId: parentId, favorite: false,
      data: wingReadFieldValues(schema, { data: {} }),
      createdAt: Date.now(), updatedAt: Date.now()
    };
    items.push(item);
    _awxEditing = item.id;
  } else {
    const item = items.find(x => x.id === _awxEditing);
    if (item) {
      // Read against the item as it stands, so a checklist keeps what was
      // ticked when only its wording changed.
      const data = wingReadFieldValues(schema, item);
      Object.assign(item, { title: title, body: body, tags: tags, parentId: parentId, data: data, updatedAt: Date.now() });
    }
  }

  saveData();
  wingFormClean(true);
  if (!silent) {
    _awxEditing = null;
    renderAwx();
    if (typeof toast === 'function') toast('Saved.', { type: 'success' });
  }
  return true;
}

/* Ctrl+S saves and Esc closes, the same keys the rest of the admin uses.
   Bound once on the document and gated on a wing form actually being open, so
   it cannot fight the other admin screens over the same shortcut. */
document.addEventListener('keydown', function (e) {
  if (!_awxEditing || !document.getElementById('awx-form')) return;
  if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 's') {
    e.preventDefault();
    e.stopPropagation();
    awxSave();
    return;
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    awxCancel();
  }
}, true);
