/* ============================================================
   ADMIN-NOTEBOOKS.JS — Notes Admin: the notebook editor
   (Answer Key Modal, Given Question Modal)
   ============================================================ */

let notebookAdminState = null;

function switchAdminStudyTab(tabId, btnEl) {
  if (window.adminIsDirty && isAdminFormOpen()) {
    showUnsavedConfirm(
      () => { window.adminIsDirty = false; switchAdminStudyTab(tabId, btnEl); },
      () => {
        if (window.saveCurrentAdminForm) {
          const success = window.saveCurrentAdminForm({ silent: true });
          if (success === false) return; // validation failed
        }
        window.adminIsDirty = false; switchAdminStudyTab(tabId, btnEl);
      }
    );
    return;
  }

  document.querySelectorAll('#admin-study-wrapper .study-tab').forEach(el => el.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');

  currentAdminStudyTab = tabId;
  const snippetTbody = document.getElementById('study-table-body');
  const notebookTbody = document.getElementById('notebook-table-body');
  const studyCatContainer = document.getElementById('study-category-container');
  const notebookCatContainer = document.getElementById('notebook-category-container');
  const newProgramBtnText = document.getElementById('new-btn-text');

  if (tabId === 'snippets') {
    snippetTbody.classList.remove('hidden');
    notebookTbody.classList.add('hidden');
    studyCatContainer.classList.remove('hidden');
    notebookCatContainer.classList.add('hidden');
    if (newProgramBtnText) newProgramBtnText.textContent = 'Create New Snippet';
  } else {
    snippetTbody.classList.add('hidden');
    notebookTbody.classList.remove('hidden');
    studyCatContainer.classList.add('hidden');
    notebookCatContainer.classList.remove('hidden');
    if (newProgramBtnText) newProgramBtnText.textContent = 'Create New Notebook';
  }

  closeAdminForm();
  closeStudyForm();
  if (typeof closeNotebookForm === 'function') closeNotebookForm();

  adminCategoryFilter = 'All';
  updateAdminFilter();
  if (typeof updateAdminEmptyStateText === 'function') updateAdminEmptyStateText();

  if (tabId === 'snippets') renderStudyAdmin();
  else renderNotebookAdmin();
}

/* ============================================================
   NOTES PANE 1 — MULTI-SELECT
   ------------------------------------------------------------
   Same behaviour the coding list has: click opens, ctrl/cmd toggles, shift
   takes a range, and the bar acts on everything at once. Deleting ten
   notebooks was ten separate confirmations.
   ============================================================ */
const nbSelection = new Set();
let _nbLastPickedId = null;

function _nbVisibleIds() {
  return [...document.querySelectorAll('#notebook-table-body .admin-list-item[data-nb-id]')].map(el => el.dataset.nbId);
}

function nbRowClick(e, id) {
  if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
    document.querySelectorAll('#notebook-table-body .admin-list-item').forEach(el => el.classList.remove('active'));
    const row = document.querySelector(`#notebook-table-body .admin-list-item[data-nb-id="${id}"]`);
    if (row) row.classList.add('active');
    _nbLastPickedId = id;
    openNotebookForm(id);
    return;
  }
  e.preventDefault();
  if (e.shiftKey && _nbLastPickedId) {
    const ids = _nbVisibleIds();
    const a = ids.indexOf(_nbLastPickedId), b = ids.indexOf(id);
    if (a !== -1 && b !== -1) ids.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(x => nbSelection.add(x));
  } else if (nbSelection.has(id)) nbSelection.delete(id);
  else nbSelection.add(id);
  _nbLastPickedId = id;
  renderNotebookAdmin();
}

function nbToggleSelect(id, on) {
  if (on) nbSelection.add(id); else nbSelection.delete(id);
  _nbLastPickedId = id;
  renderNotebookAdmin();
}

function nbSelectAllVisible() {
  const ids = _nbVisibleIds();
  const allOn = ids.length && ids.every(x => nbSelection.has(x));
  if (allOn) ids.forEach(x => nbSelection.delete(x));
  else ids.forEach(x => nbSelection.add(x));
  renderNotebookAdmin();
}

function nbClearSelection() {
  if (!nbSelection.size) return;
  nbSelection.clear();
  renderNotebookAdmin();
}

function _nbRenderSelectionBar() {
  const host = document.getElementById('nb-selection-bar');
  if (!host) return;
  const live = new Set((state.notebooks || []).map(n => n.id));
  [...nbSelection].forEach(id => { if (!live.has(id)) nbSelection.delete(id); });

  const n = nbSelection.size;
  const selBtn = document.getElementById('nb-select-all-btn');
  if (selBtn) {
    const ids = _nbVisibleIds();
    const allOn = ids.length > 0 && ids.every(x => nbSelection.has(x));
    const sp = selBtn.querySelector('span');
    if (sp) sp.textContent = allOn ? 'Deselect all' : 'Select all';
    selBtn.classList.toggle('is-on', allOn);
  }

  if (!n) { host.classList.add('hidden'); host.innerHTML = ''; return; }
  host.classList.remove('hidden');
  host.innerHTML = `
    <span class="asb-count">${n} selected</span>
    <button class="asb-btn" onclick="nbBulkMove(this)"><i data-lucide="folder-input" style="width:13px;height:13px;"></i> Move to…</button>
    <button class="asb-btn" onclick="nbBulkExport()"><i data-lucide="download" style="width:13px;height:13px;"></i> Export</button>
    <button class="asb-btn asb-danger" onclick="nbBulkDelete()"><i data-lucide="trash-2" style="width:13px;height:13px;"></i> Delete</button>
    <button class="asb-btn asb-ghost" onclick="nbClearSelection()">Clear</button>`;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: host });
}

function nbBulkDelete() {
  const ids = [...nbSelection];
  if (!ids.length) return;
  const items = (state.notebooks || []).filter(n => ids.includes(n.id));
  const names = items.slice(0, 3).map(n => n.title).join(', ');
  showConfirm('Delete ' + ids.length + ' notebook' + (ids.length !== 1 ? 's' : '') + '?',
    names + (items.length > 3 ? ' and ' + (items.length - 3) + ' more' : '') + '. You can undo this.',
    () => {
      const snapshot = JSON.parse(JSON.stringify(items));
      state.notebooks = (state.notebooks || []).filter(n => !ids.includes(n.id));
      nbSelection.clear();
      saveData();
      renderNotebookAdmin();
      if (typeof pushUndo === 'function') {
        pushUndo('Deleted ' + snapshot.length + ' notebooks', () => {
          snapshot.forEach(n => state.notebooks.push(n));
          saveData(); renderNotebookAdmin();
        });
      }
    });
}

function nbBulkMove(triggerBtn) {
  if (!nbSelection.size) return;
  openListItemFolderPicker('__bulk_nb__', 'notebook', triggerBtn);
}

function _nbApplyBulkMove(folderId) {
  const ids = [...nbSelection];
  const target = folderId === '__none__' ? null : folderId;
  (state.notebooks || []).forEach(n => { if (ids.includes(n.id)) n.parentId = target; });
  saveData();
  renderNotebookAdmin();
  const name = target ? ((state.nodes || []).find(x => x.id === target) || {}).name : 'Uncategorized';
  if (typeof toast === 'function') toast('Moved ' + ids.length + ' to "' + (name || 'Uncategorized') + '".', { type: 'success' });
}

function nbBulkExport() {
  const ids = [...nbSelection];
  if (!ids.length) return;
  const picked = (state.notebooks || []).filter(n => ids.includes(n.id));
  const folderIds = new Set(picked.map(n => n.parentId).filter(Boolean));
  const payload = {
    _export: 'studysession-notebooks',
    exportedAt: new Date().toISOString(),
    nodes: (state.nodes || []).filter(n => folderIds.has(n.id)),
    notebooks: picked
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'notebooks-' + picked.length + '-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  if (typeof toast === 'function') toast('Exported ' + picked.length + ' notebook' + (picked.length !== 1 ? 's' : '') + '.', { type: 'success' });
}

document.addEventListener('keydown', (e) => {
  if (!document.getElementById('nb-selection-bar')) return;
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '') ||
                 (document.activeElement || {}).isContentEditable;
  if (typing) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); nbSelectAllVisible(); }
  else if (e.key === 'Escape' && nbSelection.size) nbClearSelection();
});

function renderNotebookAdmin() {
  updateAdminFilter();

  const tbody = document.getElementById('notebook-table-body');
  if (!tbody) return;

  if (!state.notebooks || state.notebooks.length === 0) {
    tbody.innerHTML = `<div class="empty-state nb-list-empty">
      <p>No notebooks yet.</p>
      <button type="button" class="btn btn-primary btn-sm" onclick="openNotebookForm('new')"><i data-lucide="plus" style="width:14px;height:14px;"></i> Create a notebook</button>
    </div>`;
  } else {
    // Build notebook folder picker
    const nfpOpts = [];
    function buildNFP(pid, d) {
      getChildFolders(pid, 'notebook').forEach(f => {
        nfpOpts.push({ id: f.id, label: '  '.repeat(d) + f.name });
        buildNFP(f.id, d + 1);
      });
    }
    buildNFP(null, 0);

    let filteredNotebooks = state.notebooks;

    const searchInput = document.getElementById('admin-search-input');
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

    if (query) {
      filteredNotebooks = filteredNotebooks.filter(nb => fuzzyMatch(nb.title, query) || (nb.tags || []).some(t => fuzzyMatch(t, query)));
    }

    if (adminCategoryFilter === '__uncategorized__') {
      filteredNotebooks = filteredNotebooks.filter(nb => nb.parentId === null || nb.parentId === undefined);
    } else if (adminCategoryFilter !== 'All') {
      const fids = new Set();
      function collectNFIds(id) { fids.add(id); getChildFolders(id, 'notebook').forEach(cf => collectNFIds(cf.id)); }
      collectNFIds(adminCategoryFilter);
      filteredNotebooks = filteredNotebooks.filter(nb => fids.has(nb.parentId));
    }

    tbody.innerHTML = filteredNotebooks.map(nb => `
      <div class="admin-list-item${notebookAdminState && notebookAdminState.id === nb.id ? ' active' : ''}${nbSelection.has(nb.id) ? ' is-selected' : ''}" data-nb-id="${nb.id}"
        role="button" tabindex="0"
        onclick="nbRowClick(event, '${nb.id}')"
        onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();nbRowClick(event, '${nb.id}')}"
        aria-label="${escapeHTML(nb.title)}">
        <label class="ali-check" onclick="event.stopPropagation()" title="Select">
          <input type="checkbox" ${nbSelection.has(nb.id) ? 'checked' : ''}
                 onchange="nbToggleSelect('${nb.id}', this.checked)"
                 aria-label="Select ${escapeHTML(nb.title)}">
        </label>
        <div class="admin-list-item-left">
          <div class="admin-list-item-title" style="display:flex; align-items:center; gap:0.5rem;">
            <i data-lucide="${nb.icon || 'book'}" style="width:16px;height:16px;color:var(--color-primary);"></i>
            ${escapeHTML(nb.title)}
          </div>
          <div class="admin-list-item-meta">
            <span>${(() => {
              // Section count was identical on every row (all 17 notebooks have
              // exactly one), so it carried no information. Questions is the
              // number that actually differs and that you edit here.
              const secs = (nb.sections || []).length;
              const qs = (nb.sections || []).reduce((n, sec) => n + ((sec.questions || []).length), 0);
              if (!qs) return `<span class="nb-row-flag is-draft" title="No questions yet, so it cannot be started">Draft</span>`;
              // How many will not grade, so a half-finished notebook is visible
              // from the list instead of only after opening it.
              const missing = (nb.sections || []).reduce((n, sec) => n + validateNotebookSection(sec).errors, 0);
              return `${qs} question${qs !== 1 ? 's' : ''}` + (secs > 1 ? ` in ${secs} sections` : '') +
                (missing ? ` <span class="nb-row-flag is-warn" title="Questions with no correct answer set">${missing} need${missing === 1 ? 's' : ''} an answer</span>` : '');
            })()}</span>
            <span class="admin-list-item-dot" aria-hidden="true">·</span>
            <button onclick="event.stopPropagation(); openListItemFolderPicker('${nb.id}', 'notebook', this)" class="ali-folder-btn" title="Move to folder" aria-label="Move to folder">
              <i data-lucide="folder" style="width:11px;height:11px;"></i>
              <span>${nb.parentId ? escapeHTML((nfpOpts.find(f=>f.id===nb.parentId)||{label:'Folder'}).label.trim()) : 'Uncategorized'}</span>
              <i data-lucide="chevron-down" style="width:10px;height:10px;opacity:0.6;"></i>
            </button>
          </div>
        </div>
        <div class="admin-list-item-actions">
          <button onclick="event.stopPropagation(); openNotebookForm('${nb.id}')" class="btn btn-ghost" title="Edit" aria-label="Edit ${escapeHTML(nb.title)}">
            <i data-lucide="pencil" style="width:16px;height:16px;color:var(--color-primary);" aria-hidden="true"></i>
          </button>
          <button onclick="event.stopPropagation(); deleteNotebook('${nb.id}')" class="btn btn-ghost" title="Delete" aria-label="Delete ${escapeHTML(nb.title)}">
            <i data-lucide="trash-2" style="width:16px;height:16px;color:var(--color-danger);" aria-hidden="true"></i>
          </button>
        </div>
      </div>
    `).join('');
  }

  _nbRenderSelectionBar();

  // Folder list (tree view)
  const catList = document.getElementById('notebook-category-list');
  if (catList) {
    catList.innerHTML = renderAdminFolderTree(null, 'notebook', 0);
    if (!catList.innerHTML) {
      catList.innerHTML = '<p style="font-size:0.8rem; color:var(--text-tertiary); padding:0.5rem;">No folders. Add one below.</p>';
    }
  }

  lucide.createIcons();
}

/**
 * Opens a notebook for editing, asking first if the open one has unsaved edits.
 * Switching used to discard them silently: type a title, click another row in
 * the list, and the work was gone with no prompt and no undo.
 */
function openNotebookForm(id) {
  if (window.adminIsDirty && notebookAdminState && notebookAdminState.id !== id) {
    const from = (notebookAdminState.title || 'this notebook').trim() || 'this notebook';
    _showThreeButtonDialog('Unsaved changes',
      `"${from}" has changes you have not saved yet.`,
      [
        { label: 'Save & continue', primary: true, action: 'save' },
        { label: 'Discard changes', danger: true, action: 'discard' },
        { label: 'Cancel', action: 'cancel' }
      ],
      (choice) => {
        if (choice === 'cancel') return;
        if (choice === 'save' && saveNotebookForm({ silent: true }) === false) return;
        window.adminIsDirty = false;
        openNotebookForm(id);
      });
    return;
  }
  _openNotebookFormNow(id);
}

function _openNotebookFormNow(id) {
  _nbCollapsedSections.clear();
  const emptyState = document.getElementById('admin-empty-state');
  if (emptyState) emptyState.classList.add('hidden');
  // The cards and the editor are alternatives: put the cards away, or the
  // editor opens behind them and the click looks like it did nothing.
  if (typeof adminHideCardBrowser === 'function') adminHideCardBrowser();
  const formContainer = document.getElementById('notebook-form-container');
  if (formContainer) {
    formContainer.classList.remove('hidden');
    if (formContainer.parentElement) formContainer.parentElement.scrollTop = 0;
  }

  window.adminIsDirty = false;
  window.saveCurrentAdminForm = saveNotebookForm;
  if (typeof setSaveStatus === 'function') setSaveStatus('notebook-save-status', '');

  // Build notebook folder picker
  const catSelect = document.getElementById('notebook-category');
  const nbFpOpts = [];
  function buildNFP2(pid, d) {
    getChildFolders(pid, 'notebook').forEach(f => {
      nbFpOpts.push({ id: f.id, label: '  '.repeat(d) + f.name });
      buildNFP2(f.id, d + 1);
    });
  }
  buildNFP2(null, 0);
  catSelect.innerHTML = `<option value="">Uncategorized</option>` + nbFpOpts.map(f => `<option value="${escapeHTML(f.id)}">${escapeHTML(f.label)}</option>`).join('');

  if (id === 'new') {
    // Always Uncategorized: it used to take the first notebook folder, so a new
    // notebook landed somewhere you never picked. It opens with one empty
    // section, so Import is one click away instead of two.
    notebookAdminState = {
      id: 'new', title: '', parentId: null,
      icon: 'book', tags: [], description: '', sections: [nbNewSection('Section 1')]
    };
  } else {
    const existing = state.notebooks.find(n => n.id === id);
    notebookAdminState = JSON.parse(JSON.stringify(existing));
    if (!notebookAdminState.tags) notebookAdminState.tags = [];
    if (!notebookAdminState.sections) notebookAdminState.sections = [];
  }

  document.getElementById('notebook-form-title').textContent = id === 'new' ? 'New Notebook' : 'Edit Notebook';
  document.getElementById('notebook-title').value = notebookAdminState.title;
  document.getElementById('notebook-category').value = notebookAdminState.parentId || '';

  // Render custom category dropdown
  if (typeof renderCustomSelect === 'function') {
    const _nbFpOpts = [{ value: '', label: 'Uncategorized', icon: 'inbox' }].concat(
      nbFpOpts.map(f => ({ value: f.id, label: f.label.trim(), icon: 'folder' }))
    );
    renderCustomSelect('notebook-category-cs', _nbFpOpts, notebookAdminState.parentId || '', (val) => {
      notebookAdminState.parentId = val || null;
      document.getElementById('notebook-category').value = val;
      nbMarkDirty();
    }, 'Select category...');
  }

  renderIconDropdown('notebook-icon-picker-container', notebookAdminState.icon || 'book', (newIcon) => {
    notebookAdminState.icon = newIcon;
    nbMarkDirty();
  });
  document.getElementById('notebook-desc').value = notebookAdminState.description || '';
  const nbDiff = document.getElementById('notebook-difficulty');
  if (nbDiff) nbDiff.value = notebookAdminState.difficulty || '';
  const nbLevel = document.getElementById('notebook-level');
  if (nbLevel) nbLevel.value = notebookAdminState.level != null ? notebookAdminState.level : '';

  document.getElementById('notebook-title-req')?.classList.toggle('is-filled', !!String(notebookAdminState.title || '').trim());

  renderNotebookTags();
  renderNotebookSectionsForm();
  renderNotebookCover();
  // The description grows with its text; size it for what was loaded.
  setTimeout(() => { if (typeof afAutosizeAll === 'function') afAutosizeAll(document.getElementById('notebook-form-container')); }, 0);

  if (id === 'new') {
    setTimeout(() => document.getElementById('notebook-title')?.focus(), 60);
  }
}

function closeNotebookForm() {
  // Its windows belong to it: they would otherwise outlive the form and edit
  // a notebook that is no longer open.
  if (typeof nbCloseTagsWindow === 'function') nbCloseTagsWindow();
  if (typeof closeBulkQuestionImport === 'function') closeBulkQuestionImport();
  notebookAdminState = null;
  window.adminIsDirty = false;
  const form = document.getElementById('notebook-form-container');
  if (form) form.classList.add('hidden');
  const emptyState = document.getElementById('admin-empty-state');
  if (emptyState) emptyState.classList.remove('hidden');
}

/* ---- Notebook cover image (in the picture store, js/media-store.js) ---- */
(window.MEDIA_READERS = window.MEDIA_READERS || {})['admin-notebooks'] = true;

function renderNotebookCover() {
  const host = document.getElementById('notebook-cover-field');
  if (!host || !notebookAdminState) return;
  const img = notebookAdminState.coverImage;
  host.innerHTML = `
    <input type="file" id="notebook-cover-input" accept="image/*" class="hidden" onchange="handleNotebookCoverUpload(this)" />
    ${img ? `
      <div class="nb-cover-preview">
        <img src="${mediaSrc(img, 'thumb')}" alt="Cover preview" />
        <div class="nb-cover-actions">
          <button type="button" class="btn btn-sm" onclick="document.getElementById('notebook-cover-input').click()"><i data-lucide="repeat" style="width:13px;height:13px;"></i> Replace</button>
          <button type="button" class="btn btn-sm nb-cover-remove" onclick="removeNotebookCover()"><i data-lucide="trash-2" style="width:13px;height:13px;"></i> Remove</button>
        </div>
      </div>
    ` : `
      <button type="button" class="nb-cover-drop" onclick="document.getElementById('notebook-cover-input').click()">
        <i data-lucide="image-plus"></i>
        <span>Upload a cover image</span>
        <small>PNG, JPG or WebP. Kept with your pictures, not in your 5 MB of data</small>
      </button>
    `}
  `;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: host });
}

function handleNotebookCoverUpload(input) {
  const file = input.files && input.files[0];
  if (!file || !notebookAdminState) return;
  if (!/^image\//.test(file.type)) {
    if (typeof showMessage === 'function') showMessage('Error', 'Please choose an image file.', true);
    return;
  }
  const target = notebookAdminState;
  input.value = '';
  mediaUpload(file).then((ref) => {
    if (notebookAdminState !== target) return;
    notebookAdminState.coverImage = ref;
    nbMarkDirty();
    renderNotebookCover();
  }).catch(() => {
    if (typeof showMessage === 'function') showMessage('Error', 'That picture could not be read. Try a PNG, JPG or WebP file.', true);
  });
}

function removeNotebookCover() {
  if (!notebookAdminState) return;
  delete notebookAdminState.coverImage;
  nbMarkDirty();
  renderNotebookCover();
}

// Resize a data-URL image to a max width via canvas, returning a JPEG data URL.
// No longer used by this app's uploads (they go through mediaUpload); kept for
// an older cached copy of a neighbouring file that still calls it.
function _downscaleImage(src, maxW, quality, cb) {
  const im = new Image();
  im.onload = () => {
    const scale = Math.min(1, maxW / (im.width || maxW));
    const w = Math.max(1, Math.round(im.width * scale));
    const h = Math.max(1, Math.round(im.height * scale));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    try {
      c.getContext('2d').drawImage(im, 0, 0, w, h);
      cb(c.toDataURL('image/jpeg', quality));
    } catch (err) {
      cb(src); // fall back to original (e.g. SVG/tainted)
    }
  };
  im.onerror = () => cb(src);
  im.src = src;
}

function saveNotebookForm(opts = {}) {
  // Sync DOM fields back to state before saving
  const titleEl = document.getElementById('notebook-title');
  const catEl = document.getElementById('notebook-category');
  const descEl = document.getElementById('notebook-desc');
  if (titleEl) notebookAdminState.title = titleEl.value;
  if (catEl) notebookAdminState.parentId = catEl.value || null;
  if (descEl) notebookAdminState.description = descEl.value;
  const diffEl = document.getElementById('notebook-difficulty');
  if (diffEl) notebookAdminState.difficulty = diffEl.value || null;
  const lvEl = document.getElementById('notebook-level');
  if (lvEl) { const lv = parseInt(lvEl.value, 10); notebookAdminState.level = lv > 0 ? Math.min(lv, 100) : null; }

  if (!notebookAdminState.title.trim()) {
    if (typeof showValidationError === 'function') showValidationError(titleEl, 'Title is required');
    if (!opts.silent) showMessage('Error', 'Title is required', true);
    return false;
  }

  // Update sections with current input values (same sync the live form uses)
  syncAllNotebookSections();

  // The banner called these "blocking" while save went through regardless.
  // A deliberate save now has to acknowledge them; autosaves never interrupt.
  if (!opts.silent && !opts.force) {
    const v = (typeof _notebookValidationSummary === 'function') ? _notebookValidationSummary() : { errors: 0 };
    if (v.errors > 0) {
      _showThreeButtonDialog('Save with unanswerable questions?',
        `${v.errors} question${v.errors !== 1 ? 's have' : ' has'} no correct answer set, so ${v.errors !== 1 ? 'they' : 'it'} cannot be graded. Students will still see ${v.errors !== 1 ? 'them' : 'it'}.`,
        [
          { label: 'Fix them first', primary: true, action: 'fix' },
          { label: 'Save anyway', danger: true, action: 'save' }
        ],
        (choice) => {
          if (choice === 'save') saveNotebookForm({ ...opts, force: true });
          else _nbJumpToFirstIssue();
        });
      return false;
    }
  }

  if (notebookAdminState.id === 'new') notebookAdminState.id = 'nb_' + Date.now();
  // Deep-clone into state: silent saves keep the form open, and sharing the
  // object meant later UNSAVED edits mutated state directly.
  const savedNb = JSON.parse(JSON.stringify(notebookAdminState));
  const index = state.notebooks.findIndex(n => n.id === savedNb.id);
  if (index !== -1) state.notebooks[index] = savedNb;
  else state.notebooks.unshift(savedNb);

  saveData();
  if (typeof setSaveStatus === 'function') setSaveStatus('notebook-save-status', 'saved');
  if (opts.silent) {
    window.adminIsDirty = false;
  } else {
    const _vErrors = (typeof _notebookValidationSummary === 'function') ? _notebookValidationSummary().errors : 0;
    closeNotebookForm();
    window.adminIsDirty = false;
    if (_vErrors > 0) {
      // Only reachable via "Save anyway" — the user already chose this.
      showMessage('Saved — needs attention', `Notebook saved, but ${_vErrors} question${_vErrors !== 1 ? 's have' : ' has'} no answer key and won't be graded. Reopen this notebook to fix the highlighted sections.`, true);
    } else {
      showMessage('Success', 'Notebook saved successfully!');
    }
    renderNotebookAdmin();
  }
  return true;
}

/**
 * Saves, then opens the notebook as a student sees it. Authoring blind and
 * finding out later was the only option before — there was no way to look at a
 * section without leaving Admin and hunting for it in the Library.
 */
function nbPreviewNotebook() {
  if (!notebookAdminState) return;
  syncAllNotebookSections();
  if (!nbQuestionTotal(notebookAdminState)) {
    showMessage('Nothing to preview', 'Add at least one question first. Import Questions is the quickest way.', true);
    return;
  }
  if (saveNotebookForm({ silent: true, force: true }) === false) return;
  if (typeof setSessionParam === 'function') {
    setSessionParam('activeNotebook', notebookAdminState.id);
    setSessionParam('notebookTimeLimit', 0);
    if (typeof clearSessionParam === 'function') clearSessionParam('notebookDrill');
  }
  window.adminIsDirty = false;
  if (typeof spaNavigate === 'function') spaNavigate('notes-practice');
}

function deleteNotebook(id) {
  showConfirm('Delete Notebook', 'Are you sure you want to delete this notebook?', () => {
    softDeleteNotebook(id, () => renderNotebookAdmin());
  });
}

function addNotebookCategory() {
  const input = document.getElementById('new-notebook-category-input');
  const cat = input.value.trim();
  if (cat) {
    createNode(cat, 'folder', null, 'notebook');
    input.value = '';
    renderNotebookAdmin();
  }
}

function removeNotebookCategory(nodeId) {
  const folder = state.nodes.find(n => n.id === nodeId);
  if (!folder) return;
  showConfirm("Delete Folder", `Delete "${escapeHTML(folder.name)}"? Items will become uncategorized.`, () => {
    deleteNode(nodeId);
    renderNotebookAdmin();
  });
}

/* ============================================================
   TAGS — chips in the form, a full window to pick them
   ------------------------------------------------------------
   The form used to hold a text box, an Add button and a row of suggestions in
   one narrow column, which cut the button off. Now the form shows only what
   is chosen; picking happens in a window big enough to show every tag the app
   already uses, so the same few names get reused instead of retyped.
   Clicks apply at once (the notebook's Discard still undoes all of it).
   ============================================================ */

function renderNotebookTags() {
  const list = document.getElementById('notebook-tags-list');
  if (!list || !notebookAdminState) return;
  const tags = notebookAdminState.tags || [];
  list.innerHTML = tags.length
    ? tags.map(t => `
      <span class="tag nb-tag-picked">
        ${escapeHTML(t)}
        <button type="button" data-tag="${escapeHTML(t)}" onclick="removeNotebookTag(this.dataset.tag)" title="Remove tag" aria-label="Remove tag ${escapeHTML(t)}"><i data-lucide="x" style="width:12px;height:12px;"></i></button>
      </span>`).join('')
    : '<span class="nb-tags-none">No tags yet</span>';
  if (typeof lucide !== 'undefined') lucide.createIcons({ el: list });
  const label = document.getElementById('nb-tags-open-label');
  if (label) label.textContent = tags.length ? `Edit tags (${tags.length})` : 'Add tags';
}

function removeNotebookTag(tag) {
  if (!notebookAdminState) return;
  notebookAdminState.tags = (notebookAdminState.tags || []).filter(t => t !== tag);
  renderNotebookTags();
  if (document.getElementById('nb-tags-overlay')) _nbTagsRender();
  nbMarkDirty();
}

/**
 * Every tag in use, notebooks first. Keyed without case, so "Pointers" and
 * "pointers" are offered once, in the spelling the notebooks use most.
 * @returns {{notebook: Array<{tag,count}>, other: Array<{tag,count,where}>}}
 */
function _nbTagPool() {
  const pools = [
    ['notebook', 'Notebooks', state.notebooks],
    ['challenge', 'Coding', state.challenges],
    ['snippet', 'Snippets', state.snippets],
    ['typing', 'Typing', state.typeItems]
  ];
  const byKey = new Map();
  pools.forEach(([scope, where, items]) => {
    (items || []).forEach(it => (it && it.tags || []).forEach(raw => {
      const tag = String(raw || '').trim();
      if (!tag) return;
      const key = tag.toLowerCase();
      let e = byKey.get(key);
      if (!e) { e = { tag, nbCount: 0, count: 0, where: new Set(), spellings: new Map() }; byKey.set(key, e); }
      e.count++;
      if (scope === 'notebook') e.nbCount++;
      e.where.add(where);
      e.spellings.set(tag, (e.spellings.get(tag) || 0) + (scope === 'notebook' ? 10 : 1));
    }));
  });
  const all = [...byKey.values()].map(e => {
    e.tag = [...e.spellings.entries()].sort((a, b) => b[1] - a[1])[0][0];
    return e;
  });
  const sort = (a, b) => b.count - a.count || a.tag.localeCompare(b.tag);
  return {
    notebook: all.filter(e => e.nbCount > 0).sort((a, b) => b.nbCount - a.nbCount || a.tag.localeCompare(b.tag)),
    other: all.filter(e => e.nbCount === 0).sort(sort).map(e => ({ ...e, where: [...e.where].join(', ') }))
  };
}

let _nbTagsKeys = null;

function nbOpenTagsWindow() {
  if (!notebookAdminState) return;
  nbCloseTagsWindow();
  const overlay = document.createElement('div');
  overlay.id = 'nb-tags-overlay';
  overlay.className = 'nb-tags-overlay';
  overlay.innerHTML = `
    <div class="nb-tags-dialog" role="dialog" aria-modal="true" aria-labelledby="nb-tags-title">
      <div class="nb-tags-head">
        <div class="nb-tags-titles">
          <h3 id="nb-tags-title"><i data-lucide="tags"></i> Tags</h3>
          <span class="nb-tags-for">${escapeHTML((notebookAdminState.title || '').trim() || 'New notebook')}</span>
        </div>
        <span class="nb-tags-count" id="nb-tags-count"></span>
        <button type="button" class="btn btn-ghost btn-sm nb-tags-x" onclick="nbCloseTagsWindow()" aria-label="Close" title="Done (Esc)"><i data-lucide="x"></i></button>
      </div>
      <div class="nb-tags-search">
        <i data-lucide="search"></i>
        <input id="nb-tags-q" type="text" autocomplete="off" spellcheck="false"
               placeholder="Find a tag, or type a new one and press Enter (commas for several)"
               oninput="_nbTagsRender()" onkeydown="_nbTagsSearchKey(event)" aria-label="Find or create a tag" />
      </div>
      <div class="nb-tags-body" id="nb-tags-body"></div>
      <div class="nb-tags-foot">
        <button type="button" class="btn btn-ghost btn-sm" onclick="nbTagsClearAll()" id="nb-tags-clear">Clear all</button>
        <span class="nb-tags-tip">Click a tag to add or remove it</span>
        <button type="button" class="btn btn-primary btn-sm" onclick="nbCloseTagsWindow()"><i data-lucide="check"></i> Done</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('mousedown', e => { if (e.target === overlay) overlay.dataset.downOutside = '1'; });
  overlay.addEventListener('click', e => {
    if (e.target === overlay && overlay.dataset.downOutside === '1') nbCloseTagsWindow();
    delete overlay.dataset.downOutside;
  });
  // Ahead of the admin page's Esc, which would close the notebook behind this.
  _nbTagsKeys = (e) => {
    if (!document.getElementById('nb-tags-overlay')) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); nbCloseTagsWindow(); }
  };
  window.addEventListener('keydown', _nbTagsKeys, true);
  _nbTagsRender();
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: overlay });
  setTimeout(() => document.getElementById('nb-tags-q')?.focus(), 40);
}

function nbCloseTagsWindow() {
  document.getElementById('nb-tags-overlay')?.remove();
  if (_nbTagsKeys) window.removeEventListener('keydown', _nbTagsKeys, true);
  _nbTagsKeys = null;
  // Focus back on the button that opened it.
  const btn = document.querySelector('.nb-tags-open');
  if (btn && document.getElementById('notebook-form-container')) { try { btn.focus({ preventScroll: true }); } catch (e) { /* gone */ } }
}

function _nbTagChip(tag, on, sub) {
  return `<button type="button" class="nb-tag-chip${on ? ' is-on' : ''}" data-tag="${escapeHTML(tag)}"
            onclick="nbTagsToggle(this.dataset.tag)" aria-pressed="${on ? 'true' : 'false'}">
            ${on ? '<i data-lucide="check"></i>' : ''}<span>${escapeHTML(tag)}</span>${sub ? `<em>${escapeHTML(String(sub))}</em>` : ''}
          </button>`;
}

function _nbTagsRender() {
  const body = document.getElementById('nb-tags-body');
  if (!body || !notebookAdminState) return;
  const chosen = notebookAdminState.tags || [];
  const chosenKeys = new Set(chosen.map(t => t.toLowerCase()));
  const q = (document.getElementById('nb-tags-q')?.value || '').trim();
  const words = q.split(',').map(w => w.trim()).filter(Boolean);
  const last = words.length ? words[words.length - 1].toLowerCase() : '';
  const match = (t) => !last || t.toLowerCase().includes(last);

  const pool = _nbTagPool();
  const known = new Set(pool.notebook.concat(pool.other).map(e => e.tag.toLowerCase()));
  const fresh = words.filter(w => !known.has(w.toLowerCase()) && !chosenKeys.has(w.toLowerCase()));

  let html = '';
  if (fresh.length) {
    html += `<div class="nb-tags-group">
      <div class="nb-tags-group-head">New</div>
      <div class="nb-tags-chips-wrap">
        <button type="button" class="nb-tag-chip nb-tag-create" onclick="nbTagsCreateFromQuery()">
          <i data-lucide="plus"></i><span>Create ${fresh.map(w => '"' + escapeHTML(w) + '"').join(', ')}</span><em>Enter</em>
        </button>
      </div></div>`;
  }
  if (chosen.length) {
    html += `<div class="nb-tags-group">
      <div class="nb-tags-group-head">On this notebook <span>${chosen.length}</span></div>
      <div class="nb-tags-chips-wrap">${chosen.map(t => _nbTagChip(t, true)).join('')}</div></div>`;
  }
  const nb = pool.notebook.filter(e => !chosenKeys.has(e.tag.toLowerCase()) && match(e.tag));
  html += `<div class="nb-tags-group">
    <div class="nb-tags-group-head">Used in your notebooks <span>${nb.length}</span></div>
    <div class="nb-tags-chips-wrap">${nb.length ? nb.map(e => _nbTagChip(e.tag, false, e.nbCount)).join('') : `<span class="nb-tags-empty">${last ? 'No notebook tag matches.' : 'No other notebook has tags yet.'}</span>`}</div></div>`;
  const other = pool.other.filter(e => !chosenKeys.has(e.tag.toLowerCase()) && match(e.tag));
  if (other.length) {
    html += `<div class="nb-tags-group">
      <div class="nb-tags-group-head">From your other libraries <span>${other.length}</span></div>
      <div class="nb-tags-chips-wrap">${other.map(e => _nbTagChip(e.tag, false, e.where)).join('')}</div></div>`;
  }
  body.innerHTML = html;
  if (typeof lucide !== 'undefined') lucide.createIcons({ el: body });
  const count = document.getElementById('nb-tags-count');
  if (count) count.textContent = chosen.length ? `${chosen.length} selected` : 'None selected';
  const clear = document.getElementById('nb-tags-clear');
  if (clear) clear.disabled = !chosen.length;
}

function nbTagsToggle(tag) {
  if (!notebookAdminState || !tag) return;
  const tags = notebookAdminState.tags || (notebookAdminState.tags = []);
  const i = tags.findIndex(t => t.toLowerCase() === tag.toLowerCase());
  if (i === -1) tags.push(tag); else tags.splice(i, 1);
  renderNotebookTags();
  _nbTagsRender();
  nbMarkDirty();
}

/** Adds what is typed in the search box, each comma-separated word a tag. */
function nbTagsCreateFromQuery() {
  const input = document.getElementById('nb-tags-q');
  if (!input || !notebookAdminState) return;
  const words = input.value.split(',').map(w => w.trim().replace(/\s+/g, ' ')).filter(Boolean).map(w => w.slice(0, 40));
  if (!words.length) return;
  const tags = notebookAdminState.tags || (notebookAdminState.tags = []);
  // A word that already exists somewhere is reused in that spelling.
  const pool = _nbTagPool();
  const spelled = new Map(pool.notebook.concat(pool.other).map(e => [e.tag.toLowerCase(), e.tag]));
  words.forEach(w => {
    const t = spelled.get(w.toLowerCase()) || w;
    if (!tags.some(x => x.toLowerCase() === t.toLowerCase())) tags.push(t);
  });
  input.value = '';
  renderNotebookTags();
  _nbTagsRender();
  nbMarkDirty();
  input.focus();
}

function _nbTagsSearchKey(e) {
  if (e.key === 'Enter') { e.preventDefault(); nbTagsCreateFromQuery(); }
  else if (e.key === 'Backspace' && !e.target.value && notebookAdminState && (notebookAdminState.tags || []).length) {
    // Empty box + Backspace takes the last tag off, as in the old field.
    e.preventDefault();
    notebookAdminState.tags.pop();
    renderNotebookTags();
    _nbTagsRender();
    nbMarkDirty();
  }
}

function nbTagsClearAll() {
  if (!notebookAdminState || !(notebookAdminState.tags || []).length) return;
  const before = notebookAdminState.tags.slice();
  const owner = notebookAdminState;
  notebookAdminState.tags = [];
  renderNotebookTags();
  _nbTagsRender();
  nbMarkDirty();
  if (typeof pushUndo === 'function') {
    pushUndo(`Cleared ${before.length} tag${before.length !== 1 ? 's' : ''}`, () => {
      if (notebookAdminState !== owner) return;
      notebookAdminState.tags = before;
      renderNotebookTags();
      if (document.getElementById('nb-tags-overlay')) _nbTagsRender();
      nbMarkDirty();
    });
  }
}

/** Marks the open notebook as edited. Was the same two lines in 19 places. */
function nbMarkDirty() {
  window.adminIsDirty = true;
  if (typeof setSaveStatus === 'function') setSaveStatus('notebook-save-status', 'unsaved');
}

/** Most questions one notebook section can hold (count field, Bulk Add, paste, the editor). */
const NB_MAX_QUESTIONS = 500;

/**
 * An empty section. It used to arrive with five blank questions, so a notebook
 * you had not touched yet already showed "5 blocking issues".
 * @param {string} label
 * @param {number} [count] blank questions to start with (Bulk Add asks for some)
 * @param {number} [choices] choices per blank question
 */
function nbNewSection(label, count, choices) {
  const sec = {
    id: 'sec_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    label: label || 'Section',
    questions: [],
    answerKey: '',
    answerKeysData: []
  };
  const n = Math.max(0, Math.min(NB_MAX_QUESTIONS, count || 0));
  if (choices) sec.choices = choices;
  sec.questions = Array.from({ length: n }, (_, i) => i + 1);
  sec.answerKeysData = sec.questions.map(q => nbBlankQuestion(q, 'mcq', choices));
  return sec;
}

function addNotebookSection() {
  syncAllNotebookSections();
  const labelEl = document.getElementById('new-sec-label');
  const typed = labelEl ? labelEl.value.trim() : '';
  const label = typed || 'Section ' + (notebookAdminState.sections.length + 1);

  notebookAdminState.sections.push(nbNewSection(label));
  if (labelEl) labelEl.value = '';
  renderNotebookSectionsForm();
  nbMarkDirty();
  // Land on the new card, ready to import into.
  const cards = document.querySelectorAll('.nb-section-card');
  const last = cards[cards.length - 1];
  if (last) last.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// BUG-23 FIX applied inside this function (.slice instead of .substr)
function bulkAddNotebookSections() {
  syncAllNotebookSections();
  const input = document.getElementById('bulk-add-sec-input')?.value.trim();
  if (!input) return;

  // Format: Math 10 | Science 5 (A-E)
  const parts = input.split('|').map(p => p.trim());
  parts.forEach(part => {
    if (!part) return;
    // Extract choices e.g. (A-E)
    let choices = 4;
    const choiceMatch = part.match(/\([A-Fa-f]-[A-Fa-f]\)/);
    let label = part;
    if (choiceMatch) {
      const charStr = choiceMatch[0].toUpperCase();
      if (charStr === '(A-B)') choices = 2;
      else if (charStr === '(A-C)') choices = 3;
      else if (charStr === '(A-D)') choices = 4;
      else if (charStr === '(A-E)') choices = 5;
      else if (charStr === '(A-F)') choices = 6;
      label = part.replace(choiceMatch[0], '').trim();
    }

    // Extract count e.g. 10. No number means an empty section, like Add.
    const countMatch = label.match(/\d+$/);
    let count = 0;
    if (countMatch) {
      count = parseInt(countMatch[0]);
      label = label.replace(/\d+$/, '').trim();
    }

    // The blank questions are built with the asked-for number of choices.
    // "(A-E)" used to set sec.choices only, and every question still got A-D.
    notebookAdminState.sections.push(nbNewSection(label || 'Section', count, choices));
  });
  const bulkInput = document.getElementById('bulk-add-sec-input');
  if (bulkInput) bulkInput.value = '';
  renderNotebookSectionsForm();
  nbMarkDirty();
}

/**
 * Removing a section took its questions and answer keys with it on one click,
 * with no confirmation and nothing to undo. Now it asks when there is something
 * to lose, and always leaves an undo behind.
 */
function removeNotebookSection(idx) {
  const sec = notebookAdminState.sections[idx];
  if (!sec) return;
  const qn = (sec.questions || []).length;
  const kn = (sec.answerKeysData || []).length;

  const drop = () => {
    const snapshot = JSON.parse(JSON.stringify(sec));
    notebookAdminState.sections.splice(idx, 1);
    renderNotebookSectionsForm();
    nbMarkDirty();
    if (typeof pushUndo === 'function') {
      pushUndo(`Removed section "${snapshot.label || 'Untitled'}"`, () => {
        notebookAdminState.sections.splice(Math.min(idx, notebookAdminState.sections.length), 0, snapshot);
        renderNotebookSectionsForm();
        window.adminIsDirty = true;
      });
    }
  };

  // An empty section is not worth a dialog.
  if (!qn && !kn) { drop(); return; }
  const what = [];
  if (qn) what.push(qn + ' question' + (qn !== 1 ? 's' : ''));
  if (kn) what.push(kn + ' answer key' + (kn !== 1 ? 's' : ''));
  showConfirm('Remove this section?',
    `"${sec.label || 'Section ' + (idx + 1)}" contains ${what.join(' and ')}. You can undo this.`,
    drop);
}

/** Copy a section, questions and answer keys included, right below the original. */
function duplicateNotebookSection(idx) {
  const sec = notebookAdminState.sections[idx];
  if (!sec) return;
  syncAllNotebookSections();
  const copy = JSON.parse(JSON.stringify(sec));
  copy.id = (typeof generateId === 'function') ? generateId() : 'sec_' + Date.now();
  copy.label = (sec.label || 'Section') + ' (copy)';
  notebookAdminState.sections.splice(idx + 1, 0, copy);
  renderNotebookSectionsForm();
  nbMarkDirty();
  if (typeof toast === 'function') toast('Section duplicated.', { type: 'success' });
}

/* ============================================================
   NOTEBOOK VALIDATION — flags question/answer-key desyncs (audit B6)
   so authors fix broken sections before students hit them.
   ============================================================ */
function validateNotebookSection(sec) {
  const issues = [];
  const qNums = (sec.questions || []).map(q => +q);
  const akData = sec.answerKeysData || [];
  const keyByNum = {};
  akData.forEach(d => { if (d && d.qNum != null) keyByNum[+d.qNum] = d; });

  // Questions with no answer-key entry → can't be graded (the B6 root cause).
  const missing = qNums.filter(q => !keyByNum[q]);
  if (missing.length) {
    issues.push({ level: 'error', msg: `${missing.length} question${missing.length > 1 ? 's' : ''} with no answer key (${missing.map(q => 'Q' + q).join(', ')}) — won't be graded` });
  }

  // Answer keys whose qNum is outside the question range → orphaned/ignored.
  const qSet = new Set(qNums);
  const orphans = akData.map(d => +d.qNum).filter(n => !isNaN(n) && !qSet.has(n));
  if (orphans.length) {
    issues.push({ level: 'warn', msg: `Answer key for ${orphans.map(q => 'Q' + q).join(', ')} but the section only has ${qNums.length} question${qNums.length !== 1 ? 's' : ''}` });
  }

  // Per-question: a key exists but no correct answer is set.
  qNums.forEach(q => {
    const d = keyByNum[q];
    if (!d) return;
    const type = d.type || 'mcq';
    let empty;
    if (type === 'checkbox') empty = !(Array.isArray(d.answer) && d.answer.length);
    else if (type === 'matching') empty = !(Array.isArray(d.pairs) && d.pairs.length);
    else empty = (d.answer == null || String(d.answer).trim() === '');
    if (empty) issues.push({ level: 'error', msg: `Q${q}: no correct answer set` });
  });

  return {
    ok: issues.length === 0,
    // An empty section is a draft, not a mistake: nothing to grade yet.
    empty: qNums.length === 0,
    errors: issues.filter(i => i.level === 'error').length,
    warns: issues.filter(i => i.level === 'warn').length,
    issues
  };
}

function _nbSecValidationInner(sec) {
  const v = validateNotebookSection(sec);
  if (v.empty && v.ok) {
    return `<span class="nb-sec-empty-note"><i data-lucide="inbox" style="width:13px;height:13px;"></i> No questions yet. Import them, or add them one by one.</span>`;
  }
  if (v.ok) {
    return `<span style="display:inline-flex;align-items:center;gap:0.35rem;color:var(--color-success);font-size:0.72rem;font-weight:600;"><i data-lucide="check-circle-2" style="width:13px;height:13px;"></i> Answer key complete</span>`;
  }
  return v.issues.map(i => {
    const color = i.level === 'error' ? 'var(--color-danger)' : 'var(--color-warning)';
    const icon = i.level === 'error' ? 'alert-circle' : 'alert-triangle';
    return `<div style="display:flex;align-items:flex-start;gap:0.35rem;color:${color};font-size:0.72rem;line-height:1.35;"><i data-lucide="${icon}" style="width:13px;height:13px;flex-shrink:0;margin-top:1px;"></i><span>${escapeHTML(i.msg)}</span></div>`;
  }).join('');
}

function _notebookValidationSummary() {
  const secs = (notebookAdminState && notebookAdminState.sections) || [];
  let errors = 0, warns = 0, empty = 0;
  secs.forEach(s => { const v = validateNotebookSection(s); errors += v.errors; warns += v.warns; if (v.empty) empty++; });
  return { errors, warns, empty, total: secs.length };
}

function _nbValidationSummaryInner() {
  const { errors, warns, empty, total } = _notebookValidationSummary();
  if (errors === 0 && warns === 0 && empty === total) {
    return `<span class="nb-sec-empty-note" style="font-size:0.78rem;"><i data-lucide="inbox" style="width:15px;height:15px;"></i> No questions yet. Start with Import Questions.</span>`;
  }
  if (errors === 0 && warns === 0) {
    const emptyNote = empty ? ` <span style="color:var(--text-tertiary);font-weight:500;">· ${empty} empty section${empty !== 1 ? 's' : ''}</span>` : '';
    return `<span style="display:inline-flex;align-items:center;gap:0.4rem;color:var(--color-success);font-size:0.78rem;font-weight:600;"><i data-lucide="shield-check" style="width:15px;height:15px;"></i> ${empty ? 'Every question has an answer' : 'All sections graded and ready'}${emptyNote}</span>`;
  }
  const parts = [];
  if (errors) parts.push(`<span style="color:var(--color-danger);font-weight:700;">${errors} blocking issue${errors !== 1 ? 's' : ''}</span>`);
  if (warns) parts.push(`<span style="color:var(--color-warning);font-weight:700;">${warns} warning${warns !== 1 ? 's' : ''}</span>`);
  return `<span style="display:inline-flex;align-items:center;gap:0.4rem;font-size:0.78rem;color:var(--text-secondary);"><i data-lucide="alert-triangle" style="width:15px;height:15px;color:var(--color-warning);"></i> ${parts.join(' · ')} — see highlighted sections</span>`;
}

function _updateNbValidationSummary() {
  const el = document.getElementById('nb-validation-summary');
  if (el) { el.innerHTML = _nbValidationSummaryInner(); if (typeof lucide !== 'undefined') lucide.createIcons({ el }); }
}

/* Which section cards are folded. Index-based and reset per form open, so it
   never survives into a different notebook. */
const _nbCollapsedSections = new Set();
/* Whether "Add several at once" is unfolded, kept across re-renders. */
let _nbBulkOpen = false;

function nbToggleSection(idx) {
  syncAllNotebookSections();
  if (_nbCollapsedSections.has(idx)) _nbCollapsedSections.delete(idx);
  else _nbCollapsedSections.add(idx);
  renderNotebookSectionsForm();
}

function nbToggleAllSections() {
  syncAllNotebookSections();
  const secs = (notebookAdminState && notebookAdminState.sections) || [];
  if (_nbCollapsedSections.size >= secs.length && secs.length) _nbCollapsedSections.clear();
  else secs.forEach((_, i) => _nbCollapsedSections.add(i));
  renderNotebookSectionsForm();
}

/** Scrolls to the first section with an error and opens it if it was folded. */
function _nbJumpToFirstIssue() {
  const secs = (notebookAdminState && notebookAdminState.sections) || [];
  const idx = secs.findIndex(sec => validateNotebookSection(sec).errors > 0);
  if (idx === -1) return;
  if (_nbCollapsedSections.has(idx)) {
    _nbCollapsedSections.delete(idx);
    renderNotebookSectionsForm();
  }
  const card = document.querySelector(`.nb-section-card[data-idx="${idx}"]`);
  if (!card) return;
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  card.classList.add('nb-flash');
  setTimeout(() => card.classList.remove('nb-flash'), 1400);
}

function renderNotebookSectionsForm() {
  const container = document.getElementById('notebook-sections-content');
  if (!container) return;

  let html = '<div class="nb-sections-wrap">';

  if (!notebookAdminState.sections || notebookAdminState.sections.length === 0) {
    html += '<div class="nb-section-empty">No sections added yet. Add one below to start.</div>';
  } else {
    // Clickable: "3 blocking issues" now takes you to the first one instead of
    // leaving you to hunt through a long form for the highlighted card.
    html += `<button type="button" id="nb-validation-summary" class="nb-validation-summary"
               onclick="_nbJumpToFirstIssue()" title="Go to the first issue">${_nbValidationSummaryInner()}</button>`;
    html += notebookAdminState.sections.map((sec, idx) => {
      // Auto-detect section test type from answerKeysData
      const akData = sec.answerKeysData || [];
      const typesUsed = [...new Set(akData.map(d => d.type || 'mcq'))];
      let sectionTestType = 'mcq';
      if (typesUsed.length === 0) sectionTestType = 'mcq';
      else if (typesUsed.length === 1) sectionTestType = typesUsed[0];
      else sectionTestType = 'mixed';
      const typeBadgeMap = { mcq: { label: 'MCQ', color: '#818cf8' }, checkbox: { label: 'Multi', color: '#10b981' }, text: { label: 'Text', color: '#fbbf24' }, matching: { label: 'Match', color: '#f472b6' }, truefalse: { label: 'T/F', color: '#38bdf8' }, mixed: { label: 'Mixed', color: '#f97316' } };
      const badge = typeBadgeMap[sectionTestType] || typeBadgeMap.mcq;
      const collapsed = _nbCollapsedSections.has(idx);
      // Build detailed type summary
      const typeCounts = {};
      akData.forEach(d => { const t = d.type || 'mcq'; typeCounts[t] = (typeCounts[t] || 0) + 1; });
      const typeSummaryParts = Object.entries(typeCounts).map(([t, c]) => `${c} ${(typeBadgeMap[t] || {label: t}).label}`);
      const typeSummary = typeSummaryParts.length > 0 ? typeSummaryParts.join(', ') : 'No questions';
      return `
      <div class="nb-section-card${collapsed ? ' is-collapsed' : ''}${validateNotebookSection(sec).errors ? ' has-error' : ''}" data-idx="${idx}" draggable="true"
           ondragstart="nbSectionDragStart(event, ${idx})"
           ondragover="nbSectionDragOver(event)"
           ondrop="nbSectionDrop(event, ${idx})"
           ondragend="nbSectionDragEnd(event)">
        <div class="nb-section-card-header">
          <span class="nb-section-handle" title="Drag to reorder" aria-hidden="true"><i data-lucide="grip-vertical"></i></span>
          <button type="button" class="nb-section-fold" onclick="nbToggleSection(${idx})"
                  title="${collapsed ? 'Expand' : 'Collapse'} this section"
                  aria-expanded="${collapsed ? 'false' : 'true'}" aria-label="${collapsed ? 'Expand' : 'Collapse'} section ${idx + 1}">
            <i data-lucide="chevron-${collapsed ? 'right' : 'down'}"></i>
          </button>
          <span class="nb-section-num" aria-hidden="true">${idx + 1}</span>
          <h4 class="nb-section-card-title" id="nb-sec-title-${idx}">${escapeHTML(sec.label || 'Section ' + (idx + 1))}</h4>
          <div class="nb-section-card-meta">${(sec.questions || []).length} question${(sec.questions || []).length !== 1 ? 's' : ''}${akData.length ? ` · <span class="nb-type-badge" style="--nb-badge:${badge.color};">${escapeHTML(typeSummary || badge.label)}</span>` : ''}</div>
          <button onclick="syncAllNotebookSections(); duplicateNotebookSection(${idx})" class="btn btn-ghost btn-sm nb-section-dup" title="Duplicate section" aria-label="Duplicate section ${idx + 1}">
            <i data-lucide="copy" style="width:14px;height:14px;"></i>
          </button>
          <button onclick="syncAllNotebookSections(); removeNotebookSection(${idx})" class="btn btn-ghost btn-sm nb-section-remove" title="Remove Section" aria-label="Remove Section ${idx + 1}">
            <i data-lucide="trash-2" style="width:14px;height:14px;color:var(--color-danger);"></i>
          </button>
        </div>
        <div class="nb-section-card-body${collapsed ? ' hidden' : ''}">
          <div class="nb-section-fields">
            <div class="af-field" style="flex:1; min-width:160px;">
              <label class="form-label" for="nb-sec-label-${idx}">Section name</label>
              <input id="nb-sec-label-${idx}" class="form-input nb-input-compact" value="${escapeHTML(sec.label || '')}" oninput="syncNotebookSection(${idx})" placeholder="e.g. Math, Reading..." />
            </div>
            <div class="af-field" style="width:110px;">
              <label class="form-label" for="nb-sec-count-${idx}">Questions</label>
              <input id="nb-sec-count-${idx}" type="number" min="0" max="${NB_MAX_QUESTIONS}" class="form-input nb-input-compact" value="${(sec.questions || []).length}" oninput="syncNotebookSection(${idx})" title="Raise it for blank questions, lower it to drop the last ones" />
            </div>
          </div>
          <!-- Import is the way most sections get filled, so it leads. Questions
               and their answers are edited in one window now, so there is one
               editor button beside it. -->
          <div class="nb-section-actions${(sec.questions || []).length ? '' : ' is-empty'}">
            <button onclick="openBulkQuestionImport(${idx})" class="btn btn-primary nb-section-action-btn nb-section-import-btn">
              <i data-lucide="clipboard-paste" style="width:16px;height:16px;"></i> Import Questions
            </button>
            <button onclick="nbOpenQuestionEditor(${idx})" class="btn btn-secondary nb-section-action-btn nb-section-edit-btn">
              <i data-lucide="${(sec.questions || []).length ? 'file-pen-line' : 'plus'}" style="width:16px;height:16px;"></i> ${(sec.questions || []).length ? 'Edit Questions &amp; Answers' : 'Write Questions'}
            </button>
          </div>
          <div id="nb-sec-validation-${idx}" class="nb-sec-validation" style="margin-top:0.5rem; display:flex; flex-direction:column; gap:0.2rem;">${_nbSecValidationInner(sec)}</div>
        </div>
      </div>
    `; }).join('');
  }

  // One card for adding: a name and Add, with several-at-once folded under it.
  // Two cards of the same size made the rarely used bulk form look as
  // important as the normal one.
  html += `
    <div class="nb-add-section-card">
      <div class="nb-add-section-row">
        <i data-lucide="plus-square" class="nb-add-section-icon"></i>
        <input id="new-sec-label" class="form-input" placeholder="New section name (optional)" style="flex:1; min-width:160px;" onkeydown="if(event.key==='Enter') addNotebookSection()" aria-label="New section name" />
        <button onclick="addNotebookSection()" class="btn btn-primary nb-add-section-btn">
          <i data-lucide="plus" style="width:14px;height:14px;"></i> Add Section
        </button>
      </div>
      <details class="nb-add-bulk"${_nbBulkOpen ? ' open' : ''} ontoggle="_nbBulkOpen = this.open">
        <summary>Add several at once</summary>
        <div class="nb-add-section-row">
          <input id="bulk-add-sec-input" class="form-input" placeholder="Math 10 | Science 5 (A-E) | Reading" style="flex:1;" onkeydown="if(event.key==='Enter') bulkAddNotebookSections()" aria-label="Sections to add" />
          <button onclick="bulkAddNotebookSections()" class="btn btn-secondary nb-add-section-btn">
            <i data-lucide="layers" style="width:14px;height:14px;"></i> Add all
          </button>
        </div>
        <span class="af-label-hint">Name, then an optional number of blank questions and choices <code>(A-E)</code>. Separate sections with <code>|</code>.</span>
      </details>
    </div>
  </div>`;

  container.innerHTML = html;
  lucide.createIcons({ el: container });
}

// === Drag-to-reorder sections ===
let _nbSectionDragIdx = -1;

function nbSectionDragStart(e, idx) {
  _nbSectionDragIdx = idx;
  e.dataTransfer.effectAllowed = 'move';
  try { e.dataTransfer.setData('text/plain', String(idx)); } catch (err) {}
  e.currentTarget.classList.add('nb-section-dragging');
  syncAllNotebookSections();
}

function nbSectionDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.nb-section-card').forEach(c => c.classList.remove('nb-section-drag-over'));
  const card = e.currentTarget;
  card.classList.add('nb-section-drag-over');
}

function nbSectionDrop(e, idx) {
  e.preventDefault();
  if (_nbSectionDragIdx < 0 || _nbSectionDragIdx === idx) return;
  const arr = notebookAdminState.sections;
  const [moved] = arr.splice(_nbSectionDragIdx, 1);
  arr.splice(idx, 0, moved);
  _nbSectionDragIdx = -1;
  renderNotebookSectionsForm();
  nbMarkDirty();
}

function nbSectionDragEnd(e) {
  document.querySelectorAll('.nb-section-card').forEach(c => {
    c.classList.remove('nb-section-dragging');
    c.classList.remove('nb-section-drag-over');
  });
  _nbSectionDragIdx = -1;
}

function syncNotebookSection(idx) {
  if (!notebookAdminState || !notebookAdminState.sections[idx]) return;
  const sec = notebookAdminState.sections[idx];
  const labelEl = document.getElementById('nb-sec-label-' + idx);
  const choicesEl = document.getElementById('nb-sec-choices-' + idx);
  const countEl = document.getElementById('nb-sec-count-' + idx);
  if (labelEl) {
    sec.label = labelEl.value;
    const titleEl = document.getElementById('nb-sec-title-' + idx);
    if (titleEl) titleEl.textContent = sec.label.trim() || 'Section ' + (idx + 1);
  }
  if (choicesEl) sec.choices = parseInt(choicesEl.value) || 4;
  if (countEl) {
    // The field accepted anything: 999 built 999 questions, -5 silently wiped
    // the section. Clamp to the same 0-NB_MAX_QUESTIONS the input advertises.
    const raw = parseInt(countEl.value, 10);
    const count = isNaN(raw) ? 0 : Math.max(0, Math.min(NB_MAX_QUESTIONS, raw));
    if (!isNaN(raw) && raw !== count) countEl.value = String(count);

    const prev = (sec.questions || []).length;
    if (count < prev) {
      // Dropping the count strands the answer keys for the questions removed.
      // Say so while it can still be undone, rather than only in the validator.
      const stranded = (sec.answerKeysData || []).filter(d => +d.qNum > count).length;
      if (stranded && !sec._orphanWarned) {
        sec._orphanWarned = true;
        if (typeof toast === 'function') {
          toast(stranded + ' answer key' + (stranded !== 1 ? 's are' : ' is') + ' now above the question count and will be ignored.',
            { type: 'warning', duration: 6000 });
        }
      }
    } else if (count >= prev) {
      sec._orphanWarned = false;
    }
    sec.questions = Array.from({ length: count }, (_, i) => i + 1);
    // Truncate/extend the records with it, so Modify Given and Modify Answer
    // Key both show exactly this many questions.
    nbNormalizeSection(sec);
    // Crossing zero changes what the action row offers; update it in place so
    // the field keeps focus.
    if ((prev === 0) !== (count === 0)) _nbPaintSectionActions(idx, count);
  }
  // Live-update validation without a full re-render (keeps input focus).
  const vEl = document.getElementById('nb-sec-validation-' + idx);
  if (vEl) { vEl.innerHTML = _nbSecValidationInner(sec); if (typeof lucide !== 'undefined') lucide.createIcons({ el: vEl }); }
  if (typeof _updateNbValidationSummary === 'function') _updateNbValidationSummary();
}

/** Relabels the editor button once a section has questions. */
function _nbPaintSectionActions(idx, count) {
  const card = document.querySelector(`.nb-section-card[data-idx="${idx}"]`);
  const row = card && card.querySelector('.nb-section-actions');
  if (!row) return;
  row.classList.toggle('is-empty', !count);
  const edit = row.querySelector('.nb-section-edit-btn');
  if (edit) {
    edit.innerHTML = `<i data-lucide="${count ? 'file-pen-line' : 'plus'}" style="width:16px;height:16px;"></i> ${count ? 'Edit Questions &amp; Answers' : 'Write Questions'}`;
    if (typeof lucide !== 'undefined') lucide.createIcons({ el: edit });
  }
}

function syncAllNotebookSections() {
  if (!notebookAdminState || !notebookAdminState.sections) return;
  notebookAdminState.sections.forEach((_, idx) => syncNotebookSection(idx));
}

/* The question model (nbBlankQuestion, nbApplyTypeDefaults, nbNormalizeSection,
   nbCommitQuestions) and the Edit Questions window live in
   js/admin-notebook-questions.js. */

/* ============================================================
   IMPORT QUESTIONS — the main way a section gets filled
   ------------------------------------------------------------
   The parser is js/notebook-import.js. This is the window around it: a live
   count of what the paste will give you before you commit, append by default
   when the section already has questions, and an undo afterwards. It used to
   replace the section by default, with no undo, behind a blocking "Imported"
   popup.
   ============================================================ */

/** A record nobody has written anything into yet (Bulk Add makes these). */
function nbIsBlankQuestion(d) {
  if (!d) return true;
  const hasAnswer = Array.isArray(d.answer) ? d.answer.length > 0 : String(d.answer || '').trim() !== '';
  const hasChoiceText = Object.values(d.choices || {}).some(v => String(v || '').trim() && !/^(true|false)$/i.test(String(v).trim()));
  const hasPairText = (d.pairs || []).some(p => p && (String(p.left || '').trim() || String(p.right || '').trim()));
  return !String(d.question || '').trim() && !hasAnswer && !hasChoiceText && !hasPairText && !String(d.image || '').trim();
}

/** Questions in a section that hold something. */
function nbRealQuestionCount(sec) {
  return ((sec && sec.answerKeysData) || []).filter(d => !nbIsBlankQuestion(d)).length;
}

/** Apply parsed questions to a section (replace or append). Returns { added }. */
function applyBulkQuestions(idx, text, append) {
  const sec = notebookAdminState.sections[idx];
  if (!sec) return { added: 0 };
  const parsed = nbParseImport(text).questions;
  if (parsed.length === 0) return { added: 0 };

  // Blank placeholder questions are not worth keeping in front of real ones.
  const base = append ? JSON.parse(JSON.stringify(sec.answerKeysData || [])).filter(d => !nbIsBlankQuestion(d)) : [];
  const newEntries = parsed.map(p => ({
    qNum: 0, type: p.type, question: p.question || '',
    choices: p.choices || {}, answer: p.answer, explanation: p.explanation || '',
    hint: p.hint || '', image: p.image || '', pairs: p.pairs || []
  }));
  const all = base.concat(newEntries).slice(0, NB_MAX_QUESTIONS);
  nbCommitQuestions(sec, all);

  let maxChoices = sec.choices || 4;
  all.forEach(d => { const n = Object.keys(d.choices || {}).length; if (n > maxChoices) maxChoices = n; });
  sec.choices = Math.max(2, Math.min(8, maxChoices || 4));

  return { added: Math.min(newEntries.length, NB_MAX_QUESTIONS - base.length) };
}

let _nbImportIdx = -1;
let _nbImportKeys = null;
let _nbImportTimer = null;

function openBulkQuestionImport(idx) {
  syncAllNotebookSections();
  closeBulkQuestionImport();
  const sec = notebookAdminState && notebookAdminState.sections[idx];
  if (!sec) return;
  _nbImportIdx = idx;
  const existing = nbRealQuestionCount(sec);

  const overlay = document.createElement('div');
  overlay.id = 'bulk-q-import-overlay';
  overlay.className = 'nb-import-overlay';
  overlay.innerHTML = `
    <div class="nb-import-dialog" role="dialog" aria-modal="true" aria-labelledby="nb-import-title">
      <div class="nb-import-head">
        <h3 id="nb-import-title"><i data-lucide="clipboard-paste"></i> Import Questions</h3>
        <span class="nb-import-into" title="${escapeHTML(sec.label || '')}">into ${escapeHTML(sec.label || 'Section ' + (idx + 1))}</span>
        <button type="button" class="btn btn-ghost btn-sm nb-import-x" onclick="closeBulkQuestionImport()" aria-label="Close" title="Close (Esc)"><i data-lucide="x"></i></button>
      </div>
      <!-- One format, written so an AI follows it. Its reply goes in a code
           block, so the chat's own Copy button copies only the questions. -->
      <div class="nb-import-ai">
        <i data-lucide="sparkles" class="nb-import-ai-icon"></i>
        <div class="nb-import-ai-text">
          <strong>Getting questions from an AI?</strong>
          <span>Copy the format, fill in your topic and how many, send it, then paste the reply here.</span>
        </div>
        <button type="button" class="btn btn-secondary btn-sm nb-import-copy" onclick="nbCopyFormat('given')"><i data-lucide="clipboard-copy"></i> Copy format</button>
      </div>
      <textarea id="bulk-q-input" spellcheck="false" class="nb-import-input"
                placeholder="${escapeHTML(_nbImportExample())}" oninput="_nbImportSchedulePreview()"></textarea>
      <div id="bulk-q-preview" class="nb-import-preview" aria-live="polite"></div>
      ${existing ? `
      <label class="nb-import-append">
        <input type="checkbox" id="bulk-q-append" checked onchange="_nbImportPreview()" />
        Add after the ${existing} question${existing !== 1 ? 's' : ''} already here
        <span>(untick to replace them)</span>
      </label>` : ''}
      <div class="nb-import-foot">
        <span class="nb-import-keys"><kbd>Ctrl</kbd>+<kbd>Enter</kbd> import &middot; <kbd>Esc</kbd> close</span>
        <button type="button" onclick="closeBulkQuestionImport()" class="btn btn-secondary btn-sm">Cancel</button>
        <button type="button" id="bulk-q-go" onclick="confirmBulkQuestionImport(${idx})" class="btn btn-primary btn-sm" disabled>
          <i data-lucide="check"></i> <span>Import</span>
        </button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: overlay });
  overlay.addEventListener('mousedown', e => { if (e.target === overlay) overlay.dataset.downOutside = '1'; });
  overlay.addEventListener('click', e => {
    // Only a click that began outside closes it: a text selection dragged out
    // of the box used to throw the whole paste away.
    if (e.target === overlay && overlay.dataset.downOutside === '1') closeBulkQuestionImport();
    delete overlay.dataset.downOutside;
  });

  // On window, capturing, so it runs before the admin page's own Esc (which
  // closed the notebook behind this window) and its Ctrl+S.
  _nbImportKeys = (e) => {
    if (!document.getElementById('bulk-q-import-overlay')) return;
    const k = String(e.key || '').toLowerCase();
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeBulkQuestionImport(); }
    else if ((e.ctrlKey || e.metaKey) && (e.key === 'Enter' || k === 's')) {
      e.preventDefault(); e.stopPropagation();
      if (!e.repeat) confirmBulkQuestionImport(_nbImportIdx);
    }
  };
  window.addEventListener('keydown', _nbImportKeys, true);

  _nbImportPreview();
  setTimeout(() => document.getElementById('bulk-q-input')?.focus(), 50);
}

function closeBulkQuestionImport() {
  clearTimeout(_nbImportTimer);
  document.getElementById('bulk-q-import-overlay')?.remove();
  if (_nbImportKeys) window.removeEventListener('keydown', _nbImportKeys, true);
  _nbImportKeys = null;
}

function _nbImportSchedulePreview() {
  clearTimeout(_nbImportTimer);
  _nbImportTimer = setTimeout(_nbImportPreview, 150);
}

/** What the paste will become, before anything is changed. */
function _nbImportPreview() {
  const ta = document.getElementById('bulk-q-input');
  const out = document.getElementById('bulk-q-preview');
  const go = document.getElementById('bulk-q-go');
  if (!ta || !out || !go) return;
  const goLabel = go.querySelector('span');
  const text = ta.value;

  if (!text.trim()) {
    out.innerHTML = `<span class="nb-import-hint">Paste your questions above. Leave a blank line between questions, put choices on lines starting A. B. C., and end each one with an <code>Answer:</code> line.</span>`;
    go.disabled = true;
    if (goLabel) goLabel.textContent = 'Import';
    return;
  }

  const { questions, skipped } = nbParseImport(text);
  const rep = nbImportReport(questions, skipped);
  if (!rep.total) {
    out.innerHTML = `<div class="nb-import-found is-bad"><i data-lucide="search-x"></i> <strong>No questions found yet.</strong> <span>Number each question or give it its own line, with its choices underneath.</span></div>`;
    go.disabled = true;
    if (goLabel) goLabel.textContent = 'Import';
    if (typeof lucide !== 'undefined') lucide.createIcons({ el: out });
    return;
  }

  const appendEl = document.getElementById('bulk-q-append');
  const replacing = appendEl && !appendEl.checked;
  const problems = rep.problems.map(p => `<li>${escapeHTML(p)}</li>`).join('');
  const skippedHtml = rep.skipped.length ? `
    <details class="nb-import-skipped">
      <summary>${rep.skipped.length} line${rep.skipped.length !== 1 ? 's' : ''} left out (not questions)</summary>
      <ul>${rep.skipped.slice(0, 8).map(s => `<li>${escapeHTML(s.length > 90 ? s.slice(0, 90) + '…' : s)}</li>`).join('')}</ul>
    </details>` : '';
  out.innerHTML = `
    <div class="nb-import-found ${rep.problems.length ? 'is-warn' : 'is-ok'}">
      <i data-lucide="${rep.problems.length ? 'alert-triangle' : 'check-circle-2'}"></i>
      <strong>${rep.total} question${rep.total !== 1 ? 's' : ''} found</strong>
      <span>${escapeHTML(rep.parts.join(', '))}</span>
    </div>
    ${problems ? `<ul class="nb-import-problems">${problems}</ul>` : ''}
    ${skippedHtml}`;
  go.disabled = false;
  if (goLabel) goLabel.textContent = (replacing ? 'Replace with ' : 'Import ') + rep.total;
  if (typeof lucide !== 'undefined') lucide.createIcons({ el: out });
}

function confirmBulkQuestionImport(idx) {
  const ta = document.getElementById('bulk-q-input');
  const text = ta ? ta.value : '';
  if (!text.trim() || !nbParseImport(text).questions.length) { _nbImportPreview(); if (ta) ta.focus(); return; }
  const sec = notebookAdminState && notebookAdminState.sections[idx];
  if (!sec) return;
  const appendEl = document.getElementById('bulk-q-append');
  const append = appendEl ? appendEl.checked : true;

  const before = JSON.parse(JSON.stringify(sec));
  const owner = notebookAdminState;
  const res = applyBulkQuestions(idx, text, append);
  closeBulkQuestionImport();
  renderNotebookSectionsForm();
  nbMarkDirty();

  const label = sec.label || 'Section ' + (idx + 1);
  if (typeof pushUndo === 'function') {
    pushUndo(`Imported ${res.added} question${res.added !== 1 ? 's' : ''} into "${label}"`, () => {
      // Only into the notebook it came from; another may be open by now.
      if (notebookAdminState !== owner) return;
      const i = notebookAdminState.sections.findIndex(s => s.id === before.id);
      if (i === -1) return;
      notebookAdminState.sections[i] = before;
      renderNotebookSectionsForm();
      nbMarkDirty();
    });
  } else if (typeof toast === 'function') {
    toast(`Imported ${res.added} question${res.added !== 1 ? 's' : ''}.`, { type: 'success' });
  }
}

/* The parser and the copyable format live in js/notebook-import.js. */

/**
 * One click, one format. There was a menu of four (question format, answer
 * key format, sample block, AI prompt) and only the first one worked well
 * when pasted to an AI. Import and the question paste box copy the universal
 * format; the answer-key paste box copies the short answers-only one.
 */
function nbCopyFormat(kind) {
  const isAnswer = kind === 'answer';
  const spec = isAnswer ? nbAnswerKeyFormatSpec() : nbImportFormatSpec();
  const label = isAnswer ? 'Answer key format copied'
                         : 'Format copied. Fill in your topic, send it to your AI, then paste its reply.';
  if (typeof copyShareLink === 'function') copyShareLink(spec, label);
  else if (navigator.clipboard) {
    navigator.clipboard.writeText(spec).then(
      () => { if (typeof toast === 'function') toast(label, { type: 'success' }); },
      () => { if (typeof toast === 'function') toast('Could not reach the clipboard.', { type: 'error' }); });
  }
}
