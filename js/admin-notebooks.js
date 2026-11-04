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

/* ---- Notebook cover image (stored as a downscaled data URL) ---- */
function renderNotebookCover() {
  const host = document.getElementById('notebook-cover-field');
  if (!host || !notebookAdminState) return;
  const img = notebookAdminState.coverImage;
  host.innerHTML = `
    <input type="file" id="notebook-cover-input" accept="image/*" class="hidden" onchange="handleNotebookCoverUpload(this)" />
    ${img ? `
      <div class="nb-cover-preview">
        <img src="${img}" alt="Cover preview" />
        <div class="nb-cover-actions">
          <button type="button" class="btn btn-sm" onclick="document.getElementById('notebook-cover-input').click()"><i data-lucide="repeat" style="width:13px;height:13px;"></i> Replace</button>
          <button type="button" class="btn btn-sm nb-cover-remove" onclick="removeNotebookCover()"><i data-lucide="trash-2" style="width:13px;height:13px;"></i> Remove</button>
        </div>
      </div>
    ` : `
      <button type="button" class="nb-cover-drop" onclick="document.getElementById('notebook-cover-input').click()">
        <i data-lucide="image-plus"></i>
        <span>Upload a cover image</span>
        <small>PNG / JPG — automatically resized to keep your data small</small>
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
  const reader = new FileReader();
  reader.onload = (e) => {
    _downscaleImage(e.target.result, 960, 0.82, (dataUrl) => {
      notebookAdminState.coverImage = dataUrl;
      nbMarkDirty();
      renderNotebookCover();
    });
  };
  reader.readAsDataURL(file);
}

function removeNotebookCover() {
  if (!notebookAdminState) return;
  delete notebookAdminState.coverImage;
  nbMarkDirty();
  renderNotebookCover();
}

// Resize a data-URL image to a max width via canvas, returning a JPEG data URL.
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
  const n = Math.max(0, Math.min(200, count || 0));
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
              <input id="nb-sec-count-${idx}" type="number" min="0" max="200" class="form-input nb-input-compact" value="${(sec.questions || []).length}" oninput="syncNotebookSection(${idx})" title="Raise it for blank questions, lower it to drop the last ones" />
            </div>
          </div>
          <!-- Import is the way most sections get filled, so it leads. The two
               editors sit beside it in one row rather than wrapping onto a
               second line on their own. -->
          <div class="nb-section-actions${(sec.questions || []).length ? '' : ' is-empty'}">
            <button onclick="openBulkQuestionImport(${idx})" class="btn btn-primary nb-section-action-btn nb-section-import-btn">
              <i data-lucide="clipboard-paste" style="width:16px;height:16px;"></i> Import Questions
            </button>
            <button onclick="openGivenQuestionModal(${idx})" class="btn btn-secondary nb-section-action-btn">
              <i data-lucide="${(sec.questions || []).length ? 'file-pen-line' : 'plus'}" style="width:16px;height:16px;"></i> ${(sec.questions || []).length ? 'Edit Questions' : 'Add Manually'}
            </button>
            <button onclick="openAnswerKeyModal(${idx})" class="btn btn-secondary nb-section-action-btn"
                    ${(sec.questions || []).length ? '' : 'disabled title="Add questions first"'}>
              <i data-lucide="key" style="width:16px;height:16px;"></i> Answer Key
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
    // the section. Clamp to the same 1-200 the input advertises.
    const raw = parseInt(countEl.value, 10);
    const count = isNaN(raw) ? 0 : Math.max(0, Math.min(200, raw));
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

/** Enables Answer Key and relabels the editor button once a section has questions. */
function _nbPaintSectionActions(idx, count) {
  const card = document.querySelector(`.nb-section-card[data-idx="${idx}"]`);
  const row = card && card.querySelector('.nb-section-actions');
  if (!row) return;
  row.classList.toggle('is-empty', !count);
  const btns = row.querySelectorAll('.nb-section-action-btn');
  const edit = btns[1], key = btns[2];
  if (edit) {
    edit.innerHTML = `<i data-lucide="${count ? 'file-pen-line' : 'plus'}" style="width:16px;height:16px;"></i> ${count ? 'Edit Questions' : 'Add Manually'}`;
    if (typeof lucide !== 'undefined') lucide.createIcons({ el: edit });
  }
  if (key) {
    key.disabled = !count;
    key.title = count ? '' : 'Add questions first';
  }
}

function syncAllNotebookSections() {
  if (!notebookAdminState || !notebookAdminState.sections) return;
  notebookAdminState.sections.forEach((_, idx) => syncNotebookSection(idx));
}

/* ============================================================
   QUESTION MODEL — one record per question, count is the authority
   ------------------------------------------------------------
   There were three places that decided how many questions a section had, and
   they disagreed:

     - the Questions field wrote sec.questions = [1..N]
     - both modals ADDED a record for anything missing, never removed extras
     - saveGivenQuestionModal did the opposite, overwriting sec.questions from
       whatever records happened to exist

   So setting 20, then 10, then opening Modify Given and saving put it back to
   20. sec.questions is now the only authority: normalise() makes the record
   list match it exactly, keeping the data of the questions that survive.

   Every question is ONE record shared by both modals. Modify Given owns the
   prompt, image, hint, choices and pair labels; Modify Answer Key owns which of
   those is correct. Both agree on `type`.
   ============================================================ */
const NB_TYPES = ['mcq', 'checkbox', 'text', 'matching', 'truefalse'];

function nbBlankQuestion(qNum, type, nChoices) {
  const d = { qNum, type: type || 'mcq', question: '', hint: '', image: '', explanation: '' };
  const n = Math.max(2, Math.min(8, nChoices || 4));
  if (d.type === 'mcq' || d.type === 'checkbox') {
    d.choices = {};
    for (let i = 0; i < n; i++) d.choices[String.fromCharCode(65 + i)] = '';
  }
  nbApplyTypeDefaults(d);
  return d;
}

/** Gives a record the shape its type needs, and drops answers that type can't hold. */
function nbApplyTypeDefaults(d) {
  const t = NB_TYPES.includes(d.type) ? d.type : 'mcq';
  d.type = t;
  if (t === 'mcq') {
    if (!d.choices || !Object.keys(d.choices).length) d.choices = { A: '', B: '', C: '', D: '' };
    if (Array.isArray(d.answer)) d.answer = d.answer[0] || '';
    if (typeof d.answer !== 'string') d.answer = '';
    if (d.answer && !Object.keys(d.choices).includes(d.answer)) d.answer = '';
    delete d.pairs;
  } else if (t === 'checkbox') {
    if (!d.choices || !Object.keys(d.choices).length) d.choices = { A: '', B: '', C: '', D: '' };
    if (!Array.isArray(d.answer)) d.answer = (typeof d.answer === 'string' && d.answer) ? [d.answer] : [];
    d.answer = d.answer.filter(a => Object.keys(d.choices).includes(a));
    delete d.pairs;
  } else if (t === 'truefalse') {
    d.choices = { A: 'True', B: 'False' };
    if (Array.isArray(d.answer)) d.answer = d.answer[0] || '';
    // Accept either the letter or the word, store the letter.
    const v = String(d.answer || '').trim().toLowerCase();
    d.answer = (v === 'a' || v === 'true') ? 'A' : (v === 'b' || v === 'false') ? 'B' : '';
    delete d.pairs;
  } else if (t === 'text') {
    if (Array.isArray(d.answer)) d.answer = d.answer.join(', ');
    if (typeof d.answer !== 'string') d.answer = '';
    delete d.choices;
    delete d.pairs;
  } else if (t === 'matching') {
    if (!Array.isArray(d.pairs) || !d.pairs.length) d.pairs = [{ left: '', right: '' }, { left: '', right: '' }];
    d.pairs = d.pairs.map(pr => ({ left: (pr && pr.left) || '', right: (pr && pr.right) || '' }));
    delete d.choices;
    d.answer = '';
  }
  return d;
}

/**
 * Makes a section's records match its question count exactly.
 * @returns {number} how many records were dropped
 */
function nbNormalizeSection(sec) {
  if (!sec) return 0;
  const count = (sec.questions || []).length;
  sec.questions = Array.from({ length: count }, (_, i) => i + 1);
  const byNum = {};
  (sec.answerKeysData || []).forEach(d => { if (d && d.qNum != null) byNum[+d.qNum] = d; });
  const dropped = Object.keys(byNum).filter(n => +n > count || +n < 1).length;
  sec.answerKeysData = sec.questions.map(q => nbApplyTypeDefaults(byNum[q] || nbBlankQuestion(q, 'mcq', sec.choices)));
  return dropped;
}

/* ---------- Scroll + focus preservation ----------
   Every edit rebuilt the modal's innerHTML, which threw the scroll position to
   the top: changing one question's type at Q12 dumped you back at Q1. This
   keeps the scroll where it was and puts the caret back. */
function nbRerender(containerId, renderFn) {
  const host = document.getElementById(containerId);
  // The question list scrolls in a panel INSIDE this container, not the
  // container itself, so record every scrollable descendant by position.
  const scrollersBefore = host
    ? [host, ...host.querySelectorAll('*')].filter(el => el.scrollHeight > el.clientHeight + 4).map(el => el.scrollTop)
    : [];
  const outerTop = host ? host.scrollTop : 0;

  const act = document.activeElement;
  const focusId = act && act.id ? act.id : null;
  const selStart = act && act.selectionStart != null ? act.selectionStart : null;

  renderFn();

  const host2 = document.getElementById(containerId);
  if (host2) {
    const after = [host2, ...host2.querySelectorAll('*')].filter(el => el.scrollHeight > el.clientHeight + 4);
    after.forEach((el, i) => { if (scrollersBefore[i] != null) el.scrollTop = scrollersBefore[i]; });
    host2.scrollTop = outerTop;
  }
  if (focusId) {
    const el = document.getElementById(focusId);
    if (el) {
      try {
        el.focus({ preventScroll: true });
        if (selStart != null && el.setSelectionRange) el.setSelectionRange(selStart, selStart);
      } catch (e) { /* not a text field */ }
    }
  }
}

// === Answer Key Modal Logic ===
let activeAnswerKeySectionIdx = -1;
let currentAnswerKeysData = [];

function parseOldAnswerKey(str) {
  const data = [];
  if (!str) return data;
  str.split('\n').forEach(line => {
    const match = line.trim().match(/^(\d+)\s*[=:]\s*([A-Ea-e])/);
    if (match) {
      data.push({ qNum: parseInt(match[1]), answer: match[2].toUpperCase(), explanation: '' });
    }
  });
  return data;
}

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
  const all = base.concat(newEntries).slice(0, 200);
  nbCommitQuestions(sec, all);

  let maxChoices = sec.choices || 4;
  all.forEach(d => { const n = Object.keys(d.choices || {}).length; if (n > maxChoices) maxChoices = n; });
  sec.choices = Math.max(2, Math.min(8, maxChoices || 4));

  return { added: Math.min(newEntries.length, 200 - base.length) };
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

function openAnswerKeyModal(idx) {
  syncAllNotebookSections();
  activeAnswerKeySectionIdx = idx;
  const sec = notebookAdminState.sections[idx];

  if (!sec.answerKeysData) {
    sec.answerKeysData = parseOldAnswerKey(sec.answerKey);
  }

  // The count owns the list: exactly one record per question, no more.
  nbNormalizeSection(sec);
  currentAnswerKeysData = JSON.parse(JSON.stringify(sec.answerKeysData));
  // Freeze the pool of right-hand options as authored, before any connecting
  // rewrites pr.right. Read lazily it would consume its own source.
  currentAnswerKeysData.forEach(d => {
    if ((d.type || 'mcq') !== 'matching') return;
    d._rightPool = (d.pairs || []).map(pr => pr.right || '');
    delete d._rightOrder;
  });
  _nbMatchPick = {};

  document.getElementById('answer-key-modal').classList.remove('hidden');
  renderAnswerKeyContent();
}

function closeAnswerKeyModal() {
  document.getElementById('answer-key-modal').classList.add('hidden');
  activeAnswerKeySectionIdx = -1;
  currentAnswerKeysData = [];
}

function saveAnswerKeyModal() {
  if (activeAnswerKeySectionIdx === -1) return;
  const sec = notebookAdminState.sections[activeAnswerKeySectionIdx];

  syncAnswerKeyData();

  // _rightPool / _rightOrder are connector scratch space, not data.
  sec.answerKeysData = JSON.parse(JSON.stringify(currentAnswerKeysData))
    .map(d => { delete d._rightPool; delete d._rightOrder; return d; });
  nbRebuildLegacyKey(sec);

  closeAnswerKeyModal();
  renderNotebookSectionsForm();
  nbMarkDirty();
}

function syncAnswerKeyData() {
  currentAnswerKeysData.forEach((d, i) => {
    const qType = d.type || 'mcq';
    const expEl = document.getElementById(`ak-exp-${i}`);
    if (expEl) d.explanation = expEl.value;

    if (qType === 'text') {
      const txtEl = document.getElementById(`ak-ans-text-${i}`);
      if (txtEl) d.answer = txtEl.value;
    } else if (qType === 'checkbox') {
      const checks = document.querySelectorAll(`input[name="ak-cb-${i}"]:checked`);
      d.answer = Array.from(checks).map(c => c.value);
    } else if (qType === 'truefalse') {
      const checked = document.querySelector(`input[name="ak-tf-${i}"]:checked`);
      if (checked) d.answer = checked.value;
    } else if (qType === 'matching') {
      // Nothing to read back: connecting writes straight to d.pairs, and the
      // term text itself belongs to Modify Given Question.
      if (!d.pairs) d.pairs = [];
    } else {
      const ansEl = document.getElementById(`ak-ans-${i}`);
      if (ansEl) d.answer = ansEl.value.toUpperCase();
    }
  });
}

/* ============================================================
   MATCHING — click to connect
   ------------------------------------------------------------
   Terms on the left, definitions on the right in a fixed shuffled order. Click
   a term, then click a definition: they join and a line is drawn. Clicking a
   connected item again releases it.

   The stored shape is unchanged — d.pairs[i] = {left, right} — so nothing
   downstream (the quiz, the validator, bulk import) has to know about this.
   ============================================================ */
let _nbMatchPick = {};      // akIdx -> selected left index

/** A stable shuffle per question, so the right column doesn't jump on re-render. */
function _nbRightOrder(d, akIdx) {
  const n = (d.pairs || []).length;
  if (!d._rightOrder || d._rightOrder.length !== n) {
    const order = Array.from({ length: n }, (_, k) => k);
    // Deterministic from the question number: same layout every time it opens.
    let seed = (d.qNum || 1) * 9301 + 49297;
    for (let k = order.length - 1; k > 0; k--) {
      seed = (seed * 9301 + 49297) % 233280;
      const j = Math.floor((seed / 233280) * (k + 1));
      [order[k], order[j]] = [order[j], order[k]];
    }
    d._rightOrder = order;
  }
  return d._rightOrder;
}

function _nbMatchConnectorHtml(d, akIdx) {
  const pairs = d.pairs || [];
  if (!pairs.length) {
    return `<div class="nb-match-empty">No pairs yet — add the terms in <strong>Modify Given Question</strong> first.</div>`;
  }
  const order = _nbRightOrder(d, akIdx);
  const picked = _nbMatchPick[akIdx];
  const linked = pairs.map(pr => (pr.right || '').trim()).filter(Boolean);

  const leftRows = pairs.map((pr, li) => {
    const has = !!(pr.right || '').trim();
    return `<button type="button" class="nb-match-item nb-match-left${picked === li ? ' is-picked' : ''}${has ? ' is-linked' : ''}"
              data-side="left" data-idx="${li}" onclick="nbMatchPickLeft(${akIdx}, ${li})"
              title="${has ? 'Connected — click to release' : 'Click, then click its match'}">
              <span class="nb-match-num">${li + 1}</span>
              <span class="nb-match-text">${escapeHTML(pr.left || '(empty term)')}</span>
              <span class="nb-match-dot"></span>
            </button>`;
  }).join('');

  const rightRows = order.map((ri) => {
    const value = (pairs[ri] && pairs[ri].rightPool !== undefined) ? pairs[ri].rightPool : (pairs[ri] || {}).right;
    const label = _nbRightLabel(d, ri);
    const usedBy = pairs.findIndex(pr => (pr.right || '') === label && label !== '');
    return `<button type="button" class="nb-match-item nb-match-right${usedBy !== -1 ? ' is-linked' : ''}"
              data-side="right" data-idx="${ri}" onclick="nbMatchPickRight(${akIdx}, ${ri})"
              title="${usedBy !== -1 ? 'Matched with ' + escapeHTML(pairs[usedBy].left || 'term ' + (usedBy + 1)) : 'Click to connect'}">
              <span class="nb-match-dot"></span>
              <span class="nb-match-text">${escapeHTML(label || '(empty match)')}</span>
              ${usedBy !== -1 ? `<span class="nb-match-num">${usedBy + 1}</span>` : '<span class="nb-match-num nb-match-num-blank"></span>'}
            </button>`;
  }).join('');

  return `
    <div class="nb-match-wrap" id="nb-match-${akIdx}">
      <div class="nb-match-head">
        <span>Click a term, then its match</span>
        <span class="nb-match-progress">${linked.length}/${pairs.length} connected</span>
        <button type="button" class="nb-match-clear" onclick="nbMatchClearAll(${akIdx})">Clear</button>
      </div>
      <div class="nb-match-cols">
        <div class="nb-match-col">${leftRows}</div>
        <svg class="nb-match-lines" aria-hidden="true"></svg>
        <div class="nb-match-col">${rightRows}</div>
      </div>
    </div>`;
}

/** The pool of right-hand options, as authored. Captured when the modal opens. */
function _nbRightLabel(d, ri) {
  if (!d._rightPool) d._rightPool = (d.pairs || []).map(pr => pr.right || '');
  return d._rightPool[ri] || '';
}

function nbMatchPickLeft(akIdx, li) {
  const d = currentAnswerKeysData[akIdx];
  if (!d) return;
  const pr = d.pairs[li];
  if (pr && (pr.right || '').trim()) {   // already connected → release it
    pr.right = '';
    _nbMatchPick[akIdx] = undefined;
  } else {
    _nbMatchPick[akIdx] = (_nbMatchPick[akIdx] === li) ? undefined : li;
  }
  renderAnswerKeyContent();
}

function nbMatchPickRight(akIdx, ri) {
  const d = currentAnswerKeysData[akIdx];
  if (!d) return;
  const label = _nbRightLabel(d, ri);
  const takenBy = d.pairs.findIndex(pr => (pr.right || '') === label && label !== '');
  if (takenBy !== -1) {                  // clicking a used match frees it
    d.pairs[takenBy].right = '';
    renderAnswerKeyContent();
    return;
  }
  const li = _nbMatchPick[akIdx];
  if (li == null) return;                // nothing picked on the left yet
  d.pairs[li].right = label;
  _nbMatchPick[akIdx] = undefined;
  renderAnswerKeyContent();
}

function nbMatchClearAll(akIdx) {
  const d = currentAnswerKeysData[akIdx];
  if (!d) return;
  (d.pairs || []).forEach(pr => { pr.right = ''; });
  _nbMatchPick[akIdx] = undefined;
  renderAnswerKeyContent();
}

/** Draws one line per connection, after layout so the dots are where we think. */
function nbDrawMatchLines() {
  document.querySelectorAll('.nb-match-wrap').forEach(wrap => {
    const svg = wrap.querySelector('.nb-match-lines');
    const cols = wrap.querySelector('.nb-match-cols');
    if (!svg || !cols) return;
    const box = cols.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${Math.round(box.width)} ${Math.round(box.height)}`);
    svg.setAttribute('width', Math.round(box.width));
    svg.setAttribute('height', Math.round(box.height));

    const akIdx = +wrap.id.replace('nb-match-', '');
    const d = currentAnswerKeysData[akIdx];
    if (!d) return;
    let paths = '';
    (d.pairs || []).forEach((pr, li) => {
      const label = (pr.right || '').trim();
      if (!label) return;
      const ri = (d._rightPool || []).indexOf(label);
      const lEl = wrap.querySelector(`.nb-match-left[data-idx="${li}"] .nb-match-dot`);
      const rEl = wrap.querySelector(`.nb-match-right[data-idx="${ri}"] .nb-match-dot`);
      if (!lEl || !rEl) return;
      const a = lEl.getBoundingClientRect(), b = rEl.getBoundingClientRect();
      const x1 = a.x + a.width / 2 - box.x, y1 = a.y + a.height / 2 - box.y;
      const x2 = b.x + b.width / 2 - box.x, y2 = b.y + b.height / 2 - box.y;
      const mid = (x1 + x2) / 2;
      paths += `<path d="M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}" fill="none" stroke="#f472b6" stroke-width="2" stroke-linecap="round" opacity="0.85"/>`;
    });
    svg.innerHTML = paths;
  });
}

function addAkMatchPair(akIdx) {
  const _d = currentAnswerKeysData[akIdx];
  if (_d && _d._rightPool) { _d._rightPool.push(''); delete _d._rightOrder; }
  syncAnswerKeyData();
  const d = currentAnswerKeysData[akIdx];
  if (!d) return;
  if (!d.pairs) d.pairs = [];
  d.pairs.push({ left: '', right: '' });
  renderAnswerKeyContent();
}

function removeAkMatchPair(akIdx, pairIdx) {
  syncAnswerKeyData();
  const d = currentAnswerKeysData[akIdx];
  if (!d || !d.pairs) return;
  d.pairs.splice(pairIdx, 1);
  renderAnswerKeyContent();
}

function _akTextSimilarity(input, choiceText) {
  const a = input.toLowerCase().trim();
  const b = choiceText.toLowerCase().trim();
  if (!a || !b) return 0;
  if (a === b) return 1.0;
  if (b.includes(a)) return 0.9;
  if (a.includes(b)) return 0.85;
  const wordsA = a.split(/\s+/).filter(w => w.length > 1);
  const wordsB = b.split(/\s+/).filter(w => w.length > 1);
  if (wordsA.length > 0 && wordsB.length > 0) {
    const matched = wordsA.filter(wa => wordsB.some(wb => wb === wa || wb.includes(wa) || wa.includes(wb)));
    if (matched.length > 0) return matched.length / Math.max(wordsA.length, 1) * 0.8;
  }
  const m = a.length, n = b.length;
  let prev = new Array(n + 1).fill(0), curr = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) curr[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], curr[j - 1]);
    [prev, curr] = [curr, prev]; curr.fill(0);
  }
  return (2 * prev[n]) / (m + n);
}

function _akFindBestChoice(rawAns, choiceEntries) {
  let bestScore = 0, bestLetter = null;
  for (const [letter, text] of choiceEntries) {
    if (!text) continue;
    const score = _akTextSimilarity(rawAns, text);
    if (score > bestScore) { bestScore = score; bestLetter = letter; }
  }
  return bestScore >= 0.4 ? { letter: bestLetter, score: bestScore } : null;
}

function _classifyBulkAnswer(rawAns, qNum) {
  const existing = currentAnswerKeysData.find(d => d.qNum === qNum);
  const knownType = existing?.type;
  const choices = existing?.choices || {};
  const choiceEntries = Object.entries(choices);

  if (/^(true|false|t|f)$/i.test(rawAns)) {
    return { type: 'truefalse', answer: /^(true|t)$/i.test(rawAns) ? 'A' : 'B' };
  }
  if (/^["']?([A-Za-z])["']?$/.test(rawAns)) {
    const letter = rawAns.replace(/["']/g, '').toUpperCase();
    if (knownType === 'truefalse') return { type: 'truefalse', answer: letter };
    // Checkbox answers are arrays — a bare letter for a known multi-select must keep that shape
    if (knownType === 'checkbox') return { type: 'checkbox', answer: [letter] };
    return { type: knownType || 'mcq', answer: letter };
  }
  if (/^[A-Za-z](?:\s*[,&]\s*[A-Za-z])+$/i.test(rawAns)) {
    return { type: 'checkbox', answer: rawAns.match(/[A-Za-z]/g).map(l => l.toUpperCase()) };
  }
  const arrowM = rawAns.match(/^(.+?)\s*(?:->|→|=>|—)\s*(.+)$/);
  if (arrowM) {
    return { type: 'matching', answer: '', pairs: [{ left: arrowM[1].trim(), right: arrowM[2].trim() }] };
  }
  if (/^(?:[A-Za-z\d]+)\s*[-–]\s*(?:[A-Za-z\d]+)(?:\s*,\s*(?:[A-Za-z\d]+)\s*[-–]\s*(?:[A-Za-z\d]+))+$/.test(rawAns)) {
    const pairs = rawAns.split(',').map(p => {
      const parts = p.trim().split(/\s*[-–]\s*/);
      return { left: parts[0]?.trim() || '', right: parts[1]?.trim() || '' };
    });
    return { type: 'matching', answer: '', pairs };
  }
  if (choiceEntries.length > 0) {
    const best = _akFindBestChoice(rawAns, choiceEntries);
    if (best) return { type: knownType || 'mcq', answer: best.letter };
  }
  return { type: 'text', answer: rawAns };
}

function bulkAddAnswers() {
  syncAnswerKeyData();
  const input = document.getElementById('ak-bulk-input').value.trim();
  const expInput = document.getElementById('ak-bulk-exp-input') ? document.getElementById('ak-bulk-exp-input').value.trim() : '';
  if (!input && !expInput) return;

  if (input) {
    let autoQNum = 1;
    let pendingMatchQ = null;

    input.split('\n').forEach(line => {
      line = line.trim();
      if (!line) { pendingMatchQ = null; return; }

      const numMatch = line.match(/^(\d+)[.)=:\s]+(.*)$/);
      let qNum, rawAns;
      if (numMatch) {
        qNum = parseInt(numMatch[1]);
        rawAns = numMatch[2].trim();
        autoQNum = qNum + 1;
        pendingMatchQ = null;
      } else if (pendingMatchQ !== null && /(.+?)\s*(?:->|→|=>|—)\s*(.+)/.test(line)) {
        qNum = pendingMatchQ;
        rawAns = line;
      } else {
        qNum = autoQNum;
        autoQNum++;
        rawAns = line;
      }

      if (!rawAns) return;
      const result = _classifyBulkAnswer(rawAns, qNum);
      const existing = currentAnswerKeysData.find(d => d.qNum === qNum);

      if (existing) {
        existing.type = result.type;
        if (result.type === 'matching' && result.pairs) {
          if (!existing.pairs) existing.pairs = [];
          existing.pairs.push(...result.pairs);
          pendingMatchQ = qNum;
        } else {
          existing.answer = result.answer;
          pendingMatchQ = null;
        }
      } else {
        const entry = { qNum, type: result.type, answer: result.answer || '', explanation: '' };
        if (result.type === 'matching' && result.pairs) {
          entry.pairs = result.pairs;
          pendingMatchQ = qNum;
        }
        currentAnswerKeysData.push(entry);
      }
    });
  }

  if (expInput) {
    let autoQNum = 1;
    expInput.split('\n').forEach(line => {
      line = line.trim();
      if (!line) return;

      const match = line.match(/^(\d+)[.)=:]\s+["']?(.*?)["']?$/);
      let qNum, text;
      if (match) {
        qNum = parseInt(match[1]);
        text = match[2].trim();
        autoQNum = qNum + 1;
      } else {
        qNum = autoQNum;
        autoQNum++;
        const stripQuotes = line.match(/^["']?(.*?)["']?$/);
        text = stripQuotes ? stripQuotes[1].trim() : line;
      }

      const existing = currentAnswerKeysData.find(d => d.qNum === qNum);
      if (existing) {
        existing.explanation = text;
      } else {
        currentAnswerKeysData.push({ qNum, answer: '', explanation: text });
      }
    });
  }

  currentAnswerKeysData.sort((a, b) => a.qNum - b.qNum);
  renderAnswerKeyContent();
}

function _renderAnswerKeyContentNow() {
  const container = document.getElementById('answer-key-content');

  let html = `
    <div class="nb-qmodal-cols">
      <div class="nb-qmodal-main">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
          <h4 style="font-weight:700; font-size:0.75rem; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:0.05em; margin:0; display:flex; align-items:center; gap:0.35rem;">
            ANSWER KEYS
            <button onclick="nbCopyFormat('answer')" class="nb-fmt-btn" title="Copy the accepted answer-key format" aria-label="Copy answer key format to clipboard">
              <i data-lucide="clipboard-copy"></i>
            </button>
          </h4>
          <!-- No add/remove here: questions are added and deleted in Edit
               Questions. Doing it from the key made answers for questions that
               did not exist, and deleting one took the question text with it. -->
          <span style="font-size:0.72rem; color:var(--text-tertiary);">Add or delete questions in Edit Questions</span>
        </div>

        <div style="display:flex; flex-direction:column; gap:1rem; margin-bottom:2rem;">
  `;

  if (currentAnswerKeysData.length === 0) {
    html += '<p style="color:var(--text-tertiary); font-size:0.875rem;">No answers added yet.</p>';
  } else {
    html += currentAnswerKeysData.map((d, i) => {
      const qType = d.type || 'mcq';
      const sec = notebookAdminState.sections[activeAnswerKeySectionIdx];
      // Use per-question adaptive choices instead of sec.choices
      const qChoiceKeys = (d.choices && Object.keys(d.choices).length > 0) ? Object.keys(d.choices).sort() : Array.from({ length: sec.choices || 4 }, (_, ci) => String.fromCharCode(65 + ci));
      const typeBadgeColors = { mcq: '#818cf8', checkbox: '#10b981', text: '#fbbf24', matching: '#f472b6', truefalse: '#38bdf8' };
      const typeLabels = { mcq: 'MCQ', checkbox: 'Multi', text: 'Text', matching: 'Match', truefalse: 'T/F' };

      let answerInputHtml = '';
      if (qType === 'text') {
        answerInputHtml = `
          <div style="display:flex; flex-direction:column; gap:0.25rem;">
            <span style="font-size:0.75rem; color:var(--text-tertiary);">Correct Text Answer <em style="opacity:0.8;">(separate accepted alternatives with |)</em>:</span>
            <input id="ak-ans-text-${i}" value="${escapeHTML(typeof d.answer === 'string' ? d.answer : '')}" class="form-input" style="font-size:0.875rem; padding:0.375rem 0.5rem;" placeholder="e.g. photosynthesis | photo synthesis" title="Grading ignores case, extra spaces and trailing punctuation. Use | to accept several answers." />
          </div>
        `;
      } else if (qType === 'checkbox') {
        const checkedArr = Array.isArray(d.answer) ? d.answer : [];
        answerInputHtml = `
          <div style="display:flex; flex-direction:column; gap:0.25rem;">
            <span style="font-size:0.75rem; color:var(--text-tertiary);">Correct Answers (select all):</span>
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
              ${qChoiceKeys.map(l => `
                <label style="display:flex; align-items:center; gap:0.25rem; cursor:pointer; background:var(--bg-surface); padding:0.25rem 0.5rem; border:1px solid var(--border-color); border-radius:var(--radius-sm); font-size:0.875rem; font-weight:600;">
                  <input type="checkbox" name="ak-cb-${i}" value="${l}" ${checkedArr.includes(l) ? 'checked' : ''} /> ${l}
                </label>
              `).join('')}
            </div>
          </div>
        `;
      } else if (qType === 'matching') {
        // Two columns and a click each side, instead of retyping both halves of
        // every pair into text boxes. The right column is shuffled, so the
        // pairing is something you set rather than something already implied by
        // the row order.
        answerInputHtml = _nbMatchConnectorHtml(d, i);
      } else if (qType === 'truefalse') {
        const curAns = typeof d.answer === 'string' ? d.answer : '';
        answerInputHtml = `
          <div style="display:flex; flex-direction:column; gap:0.25rem;">
            <span style="font-size:0.75rem; color:var(--text-tertiary);">Correct Answer:</span>
            <div style="display:flex; gap:0.75rem;">
              <label style="display:flex; align-items:center; gap:0.3rem; cursor:pointer; padding:0.3rem 0.75rem; border-radius:var(--radius-sm); border:1px solid ${curAns === 'A' || curAns.toLowerCase() === 'true' ? '#10b981' : 'var(--border-color)'}; background:${curAns === 'A' || curAns.toLowerCase() === 'true' ? '#10b98122' : 'var(--bg-surface)'};">
                <input type="radio" name="ak-tf-${i}" value="A" ${curAns === 'A' || curAns.toLowerCase() === 'true' ? 'checked' : ''} /> <strong style="color:#10b981;">True</strong>
              </label>
              <label style="display:flex; align-items:center; gap:0.3rem; cursor:pointer; padding:0.3rem 0.75rem; border-radius:var(--radius-sm); border:1px solid ${curAns === 'B' || curAns.toLowerCase() === 'false' ? '#ef4444' : 'var(--border-color)'}; background:${curAns === 'B' || curAns.toLowerCase() === 'false' ? '#ef444422' : 'var(--bg-surface)'};">
                <input type="radio" name="ak-tf-${i}" value="B" ${curAns === 'B' || curAns.toLowerCase() === 'false' ? 'checked' : ''} /> <strong style="color:#ef4444;">False</strong>
              </label>
            </div>
          </div>
        `;
      } else {
        answerInputHtml = `
          <div style="display:flex; align-items:center; gap:0.5rem; background:var(--bg-surface); border:1px solid var(--border-color); padding:0.25rem 0.5rem; border-radius:var(--radius-sm);">
            <span style="font-size:0.875rem; font-family:var(--font-mono); color:var(--text-secondary);">Answer:</span>
            <input id="ak-ans-${i}" value="${escapeHTML(typeof d.answer === 'string' ? d.answer : '')}" class="form-input" style="flex:1; border:none; background:transparent; padding:0; height:auto; box-shadow:none; font-family:var(--font-mono); text-transform:uppercase;" maxlength="1" />
          </div>
        `;
      }

      return `
      <div class="card-flat" style="padding:1rem; border:1px solid var(--border-color); background:var(--bg-surface-hover);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <h5 style="font-weight:700; font-size:0.875rem; margin:0;">Question ${d.qNum}</h5>
            <span style="font-size:0.6rem; font-weight:700; padding:0.125rem 0.375rem; border-radius:999px; background:${typeBadgeColors[qType]}22; color:${typeBadgeColors[qType]}; border:1px solid ${typeBadgeColors[qType]}44;">${typeLabels[qType]}</span>
          </div>
          ${d.question ? `<span class="nb-ak-qpreview" title="${escapeHTML(d.question)}">${escapeHTML(d.question)}</span>` : ''}
        </div>
        <div style="display:flex; flex-direction:column; gap:0.5rem;">
          ${answerInputHtml}
          <div style="display:flex; flex-direction:column; gap:0.25rem;">
            <label style="font-size:0.75rem; color:var(--text-tertiary);">Explanation (Optional)</label>
            <textarea id="ak-exp-${i}" rows="2" class="form-textarea" placeholder="Explanation for this answer..." style="font-size:0.875rem; padding:0.5rem;">${escapeHTML(d.explanation || '')}</textarea>
          </div>
        </div>
      </div>
    `;
    }).join('');
  }

  html += `
        </div>
      </div>

      <div class="nb-qmodal-side">
        <div class="card-flat" style="padding:1.25rem; border:1px solid var(--border-color);">
          <h4 style="font-weight:700; font-size:0.75rem; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.75rem;">BULK ADD ANSWER KEY</h4>
          <p style="font-size:0.7rem; color:var(--text-secondary); margin-bottom:0.5rem;">Auto-detects: letters, True/False, words (fuzzy-matched to choices), matching pairs</p>
          <textarea id="ak-bulk-input" class="form-textarea" rows="6" placeholder="1. A\n2. True\n3. Photosynthesis\n4. A, C, E\n5. term -> definition" style="font-family:var(--font-mono); font-size:0.875rem; margin-bottom:0.75rem;"></textarea>

          <h4 style="font-weight:700; font-size:0.75rem; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.75rem;">BULK EXPLANATIONS</h4>
          <textarea id="ak-bulk-exp-input" class="form-textarea" rows="3" placeholder="1. Explanation...\n2. Explanation..." style="font-family:var(--font-mono); font-size:0.875rem; margin-bottom:0.75rem;"></textarea>

          <button onclick="bulkAddAnswers()" class="btn btn-primary" style="width:100%; font-size:0.85rem; padding:0.5rem 0.75rem; margin-bottom:1rem;">
            <i data-lucide="zap" style="width:14px;height:14px;"></i> Apply Bulk
          </button>

          <div style="background:var(--bg-surface); border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:0.75rem;">
            <h4 style="font-weight:700; font-size:0.7rem; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.5rem;">FORMAT GUIDE</h4>
            <div style="font-family:var(--font-mono); font-size:0.7rem; color:var(--text-secondary); line-height:1.6;">
              <div><span style="color:var(--color-primary); font-weight:600;">MCQ:</span> 1. A &nbsp;or&nbsp; A</div>
              <div><span style="color:#10b981; font-weight:600;">Multi:</span> 1. A, C, E &nbsp;or&nbsp; A &amp; C</div>
              <div><span style="color:#38bdf8; font-weight:600;">T/F:</span> 1. True &nbsp;or&nbsp; T &nbsp;or&nbsp; False</div>
              <div><span style="color:#f472b6; font-weight:600;">Match:</span> 1. term -> definition</div>
              <div><span style="color:#fbbf24; font-weight:600;">Word:</span> 1. Photosynthesis</div>
              <div style="margin-top:0.35rem; font-size:0.65rem; color:var(--text-tertiary);">Words auto-match to the closest choice text. Numbering optional — auto-increments from 1.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;
  // Scoped: the global call rescans the whole document for [data-lucide]
  // on every re-render, with the sidebar and form still mounted.
  lucide.createIcons({ el: container });
}

// === Given Question Modal Logic ===
let activeGivenQuestionSectionIdx = -1;
let currentGivenQuestionsData = [];

function openGivenQuestionModal(idx) {
  syncAllNotebookSections();
  activeGivenQuestionSectionIdx = idx;
  const sec = notebookAdminState.sections[idx];

  if (!sec.answerKeysData) {
    sec.answerKeysData = [];
  }

  nbNormalizeSection(sec);
  currentGivenQuestionsData = JSON.parse(JSON.stringify(sec.answerKeysData));

  document.getElementById('given-question-modal').classList.remove('hidden');
  renderGivenQuestionContent();
}

function closeGivenQuestionModal() {
  document.getElementById('given-question-modal').classList.add('hidden');
  activeGivenQuestionSectionIdx = -1;
  currentGivenQuestionsData = [];
}

function saveGivenQuestionModal() {
  if (activeGivenQuestionSectionIdx === -1) return;
  const sec = notebookAdminState.sections[activeGivenQuestionSectionIdx];

  syncGivenQuestionData();

  // The draft is a full copy of the section (answers included), so it simply
  // replaces it. It used to be merged in by question number, and since a
  // delete renumbered nothing, deleting Q3 kept Q3 and dropped Q5 instead.
  nbCommitQuestions(sec, currentGivenQuestionsData);

  closeGivenQuestionModal();
  renderNotebookSectionsForm();
  nbMarkDirty();
}

/**
 * Writes an edited question list back to its section: numbered 1..n in the
 * order shown, the count taken from the list, and the old one-line answer key
 * rebuilt for anything still reading it.
 */
function nbCommitQuestions(sec, list) {
  const clean = JSON.parse(JSON.stringify(list || []))
    .map((d, i) => { delete d._rightPool; delete d._rightOrder; d.qNum = i + 1; return nbApplyTypeDefaults(d); });
  sec.answerKeysData = clean;
  sec.questions = clean.map(d => d.qNum);
  nbRebuildLegacyKey(sec);
}

/** The "1=A" text key the oldest attempt code falls back to. */
function nbRebuildLegacyKey(sec) {
  sec.answerKey = (sec.answerKeysData || [])
    .filter(d => {
      const t = d.type || 'mcq';
      return (t === 'mcq' || t === 'truefalse') && d.answer && typeof d.answer === 'string' && d.answer.trim() !== '';
    })
    .map(d => `${d.qNum}=${d.answer.trim().toUpperCase()}`)
    .join('\n');
}

/** Numbers the open editor's draft 1..n, in the order it is shown. */
function _nbRenumberDraft() {
  currentGivenQuestionsData.forEach((d, i) => { d.qNum = i + 1; });
}

function syncGivenQuestionData() {
  currentGivenQuestionsData.forEach((d, i) => {
    const qEl = document.getElementById(`gq-text-${i}`);
    const hEl = document.getElementById(`gq-hint-${i}`);
    const tEl = document.getElementById(`gq-type-${i}`);
    const imgEl = document.getElementById(`gq-image-${i}`);
    if (qEl) d.question = qEl.value;
    if (hEl) d.hint = hEl.value;
    if (tEl) d.type = tEl.value;
    if (imgEl) d.image = imgEl.value;

    const qType = d.type || 'mcq';
    if (qType === 'mcq' || qType === 'checkbox') {
      if (!d.choices) d.choices = {};
      // Read adaptive per-question choice inputs (A-Z)
      for (let c = 65; c <= 90; c++) {
        const letter = String.fromCharCode(c);
        const cEl = document.getElementById(`gq-choice-${i}-${letter}`);
        if (cEl) d.choices[letter] = cEl.value;
      }
    } else if (qType === 'matching') {
      if (!d.pairs) d.pairs = [];
      d.pairs.forEach((pair, pi) => {
        const leftEl = document.getElementById(`gq-pair-left-${i}-${pi}`);
        const rightEl = document.getElementById(`gq-pair-right-${i}-${pi}`);
        if (leftEl) pair.left = leftEl.value;
        if (rightEl) pair.right = rightEl.value;
      });
    }
    // truefalse choices are fixed (A=True, B=False), no sync needed
  });
}

function changeGivenQuestionType(idx, newType) {
  syncGivenQuestionData();
  const d = currentGivenQuestionsData[idx];
  if (!d || d.type === newType) return;
  // A letter answer means nothing once the question is Text, and a typed answer
  // means nothing once it is MCQ. Same family (mcq/checkbox/truefalse all pick
  // from choices) keeps what it can; crossing families starts clean.
  const family = (t) => (t === 'mcq' || t === 'checkbox' || t === 'truefalse') ? 'choice' : t;
  if (family(d.type) !== family(newType)) d.answer = '';
  d.type = newType;
  // One place decides what each type needs and what it cannot keep — an "A"
  // left over from MCQ is not a valid Text answer, and a T/F question cannot
  // hold four choices.
  nbApplyTypeDefaults(d);
  renderGivenQuestionContent();
}

/* The parser and the copyable format live in js/notebook-import.js. */

/**
 * One click, one format. There was a menu of four (question format, answer
 * key format, sample block, AI prompt) and only the first one worked well
 * when pasted to an AI. Import and Edit Questions copy the universal format;
 * the Answer Key window copies the short answers-only format.
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

function bulkAddGivenQuestions() {
  syncGivenQuestionData();
  const textarea = document.getElementById('gq-bulk-unified');
  const input = textarea ? textarea.value.trim() : '';
  if (!input) return;

  const { questions: parsed, skipped } = nbParseImport(input);
  if (parsed.length === 0) {
    if (typeof showShareToast === 'function') showShareToast('No questions detected in the input.');
    return;
  }
  // Read the report before the merge below reshapes the records.
  const report = nbImportReport(parsed, skipped);
  parsed.forEach(q => { delete q._unresolvedAnswer; });

  // Save undo state
  window._bulkUndoState = JSON.parse(JSON.stringify(currentGivenQuestionsData));

  // Merge parsed questions into current data
  parsed.forEach(pq => {
    const existing = currentGivenQuestionsData.find(d => d.qNum === pq.qNum);
    if (existing) {
      if (pq.question) existing.question = pq.question;
      if (pq.hint) existing.hint = pq.hint;
      existing.type = pq.type;
      if (Object.keys(pq.choices).length > 0) existing.choices = pq.choices;
      if (pq.pairs && pq.pairs.length > 0) existing.pairs = pq.pairs;
      if (pq.answer) existing.answer = pq.answer;
      if (pq.explanation) existing.explanation = pq.explanation;
    } else {
      currentGivenQuestionsData.push(pq);
    }
  });

  // Numbered pastes fill those numbers; gaps ("1, 2, 7") close up on Save.
  // Still only the draft — the section changes when the window is saved.
  currentGivenQuestionsData.sort((a, b) => a.qNum - b.qNum);
  currentGivenQuestionsData = currentGivenQuestionsData.slice(0, 200).map(d => nbApplyTypeDefaults(d));
  _nbRenumberDraft();

  if (textarea) textarea.value = '';
  renderGivenQuestionContent();
  _showParseReport(report);
}

/** Paints nbImportReport's result under the paste box. */
function _showParseReport(rep) {
  const reportEl = document.getElementById('gq-parse-report');
  if (!reportEl || !rep) return;
  const ok = rep.problems.length === 0;
  reportEl.innerHTML = `
    <div class="nb-parse-report ${ok ? 'is-ok' : 'is-warn'}">
      <div class="nb-parse-head">
        <i data-lucide="${ok ? 'check-circle' : 'alert-triangle'}" style="width:16px;height:16px;"></i>
        <strong>${rep.total} question${rep.total !== 1 ? 's' : ''} parsed</strong>
      </div>
      <div class="nb-parse-sub">${escapeHTML(rep.parts.join(', '))}${rep.answers > 0 ? ` · ${rep.answers} answer${rep.answers !== 1 ? 's' : ''} filled in` : ''}${rep.skipped.length ? ` · ${rep.skipped.length} line${rep.skipped.length !== 1 ? 's' : ''} left out` : ''}</div>
      ${rep.problems.length ? `<ul class="nb-parse-problems">${rep.problems.map(x => `<li>${escapeHTML(x)}</li>`).join('')}</ul>` : ''}
    </div>`;
  if (typeof lucide !== 'undefined') lucide.createIcons({ el: reportEl });
}

/* Everything below edits the window's draft only. The section itself changes
   when you press Save, so Cancel throws all of it away. These used to write
   sec.questions as they went, which Cancel could not undo. */
function quickAddQuestions(type, count) {
  syncGivenQuestionData();
  const sec = notebookAdminState.sections[activeGivenQuestionSectionIdx];
  for (let i = 0; i < count; i++) {
    const q = nbBlankQuestion(currentGivenQuestionsData.length + 1, type, sec && sec.choices);
    if (type === 'matching') q.pairs = [{ left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }];
    currentGivenQuestionsData.push(q);
  }
  _nbRenumberDraft();
  renderGivenQuestionContent();
}

function bulkClearGivenQuestions() {
  window._bulkUndoState = JSON.parse(JSON.stringify(currentGivenQuestionsData));
  currentGivenQuestionsData = [];
  renderGivenQuestionContent();
}

function bulkUndoGivenQuestions() {
  if (!window._bulkUndoState) { if (typeof showShareToast === 'function') showShareToast('Nothing to undo.'); return; }
  currentGivenQuestionsData = JSON.parse(JSON.stringify(window._bulkUndoState));
  window._bulkUndoState = null;
  _nbRenumberDraft();
  renderGivenQuestionContent();
}

function addGivenQuestionChoice(idx) {
  syncGivenQuestionData();
  const d = currentGivenQuestionsData[idx];
  if (!d.choices) d.choices = {};
  const keys = Object.keys(d.choices).sort();
  const next = keys.length > 0 ? String.fromCharCode(keys[keys.length - 1].charCodeAt(0) + 1) : 'A';
  if (next > 'Z') return;
  d.choices[next] = '';
  renderGivenQuestionContent();
}

function removeLastGivenQuestionChoice(idx) {
  syncGivenQuestionData();
  const d = currentGivenQuestionsData[idx];
  if (!d.choices) return;
  const keys = Object.keys(d.choices).sort();
  if (keys.length <= 2) return;
  delete d.choices[keys[keys.length - 1]];
  renderGivenQuestionContent();
}

function addMatchingPair(idx) {
  syncGivenQuestionData();
  const d = currentGivenQuestionsData[idx];
  if (!d.pairs) d.pairs = [];
  d.pairs.push({ left: '', right: '' });
  renderGivenQuestionContent();
}

function removeLastMatchingPair(idx) {
  syncGivenQuestionData();
  const d = currentGivenQuestionsData[idx];
  if (!d.pairs || d.pairs.length <= 1) return;
  d.pairs.pop();
  renderGivenQuestionContent();
}

function removeGivenQuestion(idx) {
  syncGivenQuestionData();
  currentGivenQuestionsData.splice(idx, 1);
  // The ones below move up a number, so Q4 becomes Q3 and nothing is lost.
  _nbRenumberDraft();
  renderGivenQuestionContent();
}

function toggleFormatGuide() {
  const el = document.getElementById('gq-format-guide');
  if (el) el.classList.toggle('hidden');
}

/* Public names keep their meaning; the scroll and caret survive the rebuild. */
function renderGivenQuestionContent() {
  nbRerender('given-question-content', _renderGivenQuestionContentNow);
}

function renderAnswerKeyContent() {
  nbRerender('answer-key-content', _renderAnswerKeyContentNow);
  // Lines need final layout, so they are drawn once the frame is painted.
  requestAnimationFrame(() => { try { nbDrawMatchLines(); } catch (e) { /* no connectors on screen */ } });
}

function _renderGivenQuestionContentNow() {
  const container = document.getElementById('given-question-content');

  const typeBadgeColors = { mcq: '#818cf8', checkbox: '#10b981', text: '#fbbf24', matching: '#f472b6', truefalse: '#38bdf8' };
  const typeLabels = { mcq: 'MCQ', checkbox: 'Multi', text: 'Text', matching: 'Match', truefalse: 'T/F' };

  // === LEFT PANEL: Question cards ===
  let leftHtml = '';
  if (currentGivenQuestionsData.length === 0) {
    leftHtml = '<div style="padding:2rem; text-align:center; color:var(--text-tertiary); font-size:0.875rem;">No questions yet. Paste content in the right panel or use Quick Add buttons.</div>';
  } else {
    leftHtml = currentGivenQuestionsData.map((d, i) => {
      const qType = d.type || 'mcq';
      const badgeColor = typeBadgeColors[qType] || '#818cf8';

      // Type-specific body
      let bodyHtml = '';
      if (qType === 'mcq' || qType === 'checkbox') {
        const choiceKeys = Object.keys(d.choices || {}).sort();
        bodyHtml = `
          <div style="display:flex; flex-direction:column; gap:0.25rem; margin-top:0.5rem; background:var(--bg-surface); padding:0.75rem; border-radius:var(--radius-sm); border:1px solid var(--border-color);">
            <label style="font-size:0.7rem; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:0.03em;">${qType === 'checkbox' ? 'Checkbox Choices' : 'MCQ Choices'} (${choiceKeys.length})</label>
            <div style="display:flex; flex-direction:column; gap:0.3rem;">
              ${choiceKeys.map(letter => `
                <div style="display:flex; align-items:center; gap:0.4rem;">
                  <span style="font-size:0.7rem; font-weight:700; color:var(--text-tertiary); width:16px; text-align:center;">${letter}.</span>
                  <input id="gq-choice-${i}-${letter}" class="form-input" style="flex:1; padding:0.2rem 0.4rem; font-size:0.8rem; height:auto;" placeholder="Choice ${letter}..." value="${escapeHTML(d.choices[letter] || '')}" />
                </div>
              `).join('')}
            </div>
            <div style="display:flex; gap:0.5rem; margin-top:0.35rem;">
              <button onclick="addGivenQuestionChoice(${i})" class="btn btn-ghost" style="font-size:0.7rem; padding:0.15rem 0.4rem; color:var(--color-primary);">+ Add Choice</button>
              <button onclick="removeLastGivenQuestionChoice(${i})" class="btn btn-ghost" style="font-size:0.7rem; padding:0.15rem 0.4rem; color:var(--color-danger);">- Remove</button>
            </div>
          </div>`;
      } else if (qType === 'matching') {
        const pairs = d.pairs || [];
        bodyHtml = `
          <div style="display:flex; flex-direction:column; gap:0.25rem; margin-top:0.5rem; background:var(--bg-surface); padding:0.75rem; border-radius:var(--radius-sm); border:1px solid var(--border-color);">
            <label style="font-size:0.7rem; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:0.03em;">Matching Pairs (${pairs.length})</label>
            ${pairs.map((p, pi) => `
              <div style="display:flex; align-items:center; gap:0.4rem;">
                <span style="font-size:0.7rem; font-weight:700; color:var(--text-tertiary); width:16px;">${pi + 1}.</span>
                <input id="gq-pair-left-${i}-${pi}" class="form-input" style="flex:1; padding:0.2rem 0.4rem; font-size:0.8rem; height:auto;" placeholder="Term..." value="${escapeHTML(p.left || '')}" />
                <span style="color:var(--text-tertiary); font-size:0.75rem;">→</span>
                <input id="gq-pair-right-${i}-${pi}" class="form-input" style="flex:1; padding:0.2rem 0.4rem; font-size:0.8rem; height:auto;" placeholder="Definition..." value="${escapeHTML(p.right || '')}" />
              </div>
            `).join('')}
            <div style="display:flex; gap:0.5rem; margin-top:0.35rem;">
              <button onclick="addMatchingPair(${i})" class="btn btn-ghost" style="font-size:0.7rem; padding:0.15rem 0.4rem; color:var(--color-primary);">+ Add Pair</button>
              <button onclick="removeLastMatchingPair(${i})" class="btn btn-ghost" style="font-size:0.7rem; padding:0.15rem 0.4rem; color:var(--color-danger);">- Remove</button>
            </div>
          </div>`;
      } else if (qType === 'truefalse') {
        bodyHtml = `
          <div style="display:flex; gap:0.75rem; margin-top:0.5rem; background:var(--bg-surface); padding:0.75rem; border-radius:var(--radius-sm); border:1px solid var(--border-color);">
            <span style="font-size:0.8rem; font-weight:600; padding:0.3rem 0.75rem; border-radius:var(--radius-sm); background:#10b98122; color:#10b981; border:1px solid #10b98144;">True</span>
            <span style="font-size:0.8rem; font-weight:600; padding:0.3rem 0.75rem; border-radius:var(--radius-sm); background:#ef444422; color:#ef4444; border:1px solid #ef444444;">False</span>
            <span style="font-size:0.7rem; color:var(--text-tertiary); align-self:center;">Fixed choices — set answer in Answer Key</span>
          </div>`;
      } else {
        bodyHtml = `
          <div style="background:var(--bg-surface); padding:0.75rem; border-radius:var(--radius-sm); border:1px solid var(--border-color); margin-top:0.5rem;">
            <p style="font-size:0.7rem; color:var(--text-tertiary); margin:0;">Text/Identification — no choices. Set answer in Answer Key.</p>
          </div>`;
      }

      return `
        <div class="card-flat" style="padding:0.75rem; border:1px solid var(--border-color); background:var(--bg-surface-hover);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <h5 style="font-weight:700; font-size:0.8rem; margin:0;">Q${d.qNum}</h5>
              <span style="font-size:0.6rem; font-weight:700; padding:0.1rem 0.35rem; border-radius:999px; background:${badgeColor}22; color:${badgeColor}; border:1px solid ${badgeColor}44;">${typeLabels[qType] || qType}</span>
            </div>
            <div style="display:flex; align-items:center; gap:0.25rem;">
              <select id="gq-type-${i}" class="form-select" style="width:auto; padding:0.15rem 0.4rem; font-size:0.7rem; height:auto; border-color:${badgeColor}; color:${badgeColor};" onchange="changeGivenQuestionType(${i}, this.value)">
                <option value="mcq" ${qType === 'mcq' ? 'selected' : ''}>MCQ</option>
                <option value="checkbox" ${qType === 'checkbox' ? 'selected' : ''}>Checkbox</option>
                <option value="text" ${qType === 'text' ? 'selected' : ''}>Text</option>
                <option value="matching" ${qType === 'matching' ? 'selected' : ''}>Matching</option>
                <option value="truefalse" ${qType === 'truefalse' ? 'selected' : ''}>True/False</option>
              </select>
              <button onclick="removeGivenQuestion(${i})" class="btn btn-ghost" style="padding:0.2rem;" title="Remove question">
                <i data-lucide="trash-2" style="width:14px;height:14px;color:var(--color-danger);"></i>
              </button>
            </div>
          </div>
  <textarea id="gq-text-${i}" rows="2" class="form-textarea" placeholder="Question text..." style="font-size:0.8rem; padding:0.4rem;">${escapeHTML(d.question || '')}</textarea>
          <div style="margin-top:0.4rem; display:flex; flex-direction:column; gap:0.4rem;">
            <div style="display:flex; gap:0.4rem; align-items:center;">
              <input id="gq-image-${i}" class="form-input" style="font-size:0.75rem; padding:0.3rem 0.4rem; flex:1;" placeholder="Image URL or upload..." value="${escapeHTML(d.image || '')}" onchange="previewGQImage(${i})" />
              <button onclick="document.getElementById('gq-file-input-${i}').click()" class="btn btn-secondary" style="font-size:0.75rem; padding:0.3rem 0.5rem; height:auto; white-space:nowrap; display:flex; align-items:center; gap:0.25rem;">
                <i data-lucide="upload" style="width:12px;height:12px;"></i> Upload
              </button>
              <input type="file" id="gq-file-input-${i}" accept="image/*" style="display:none;" onchange="uploadGQImageFile(${i}, this)" />
            </div>
            <div id="gq-image-preview-container-${i}" class="${d.image ? '' : 'hidden'}" style="display:flex; align-items:center; gap:0.5rem; margin-top:0.1rem;">
              <img id="gq-image-preview-${i}" src="${d.image || ''}" style="max-width: 80px; max-height: 50px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); object-fit: cover;" />
              <button onclick="clearGQImage(${i})" class="btn btn-ghost" style="padding:0.2rem; color:var(--color-danger); display:flex; align-items:center;" title="Clear Image">
                <i data-lucide="trash" style="width:14px;height:14px;"></i>
              </button>
            </div>
          </div>
          ${bodyHtml}
          <div style="margin-top:0.4rem;">
            <textarea id="gq-hint-${i}" rows="1" class="form-textarea" placeholder="Hint (optional)..." style="font-size:0.75rem; padding:0.3rem 0.4rem; color:var(--text-secondary);">${escapeHTML(d.hint || '')}</textarea>
          </div>
        </div>`;
    }).join('');
  }

  // === RIGHT PANEL: Unified bulk add + quick add + format guide ===
  const formatGuideHtml = `
    <div id="gq-format-guide" class="hidden" style="background:var(--bg-surface); border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:1rem; margin-bottom:1rem; font-size:0.75rem; line-height:1.5;">
      <h4 style="font-weight:700; margin:0 0 0.5rem; font-size:0.8rem;">Paste Format Guide</h4>
      <div style="display:flex; flex-direction:column; gap:0.75rem;">
        <div>
          <strong style="color:#818cf8;">MCQ / Checkbox:</strong><br/>
          <code style="font-size:0.7rem; white-space:pre; display:block; background:var(--bg-surface-hover); padding:0.4rem; border-radius:4px; margin-top:0.25rem;">1. What is 2+2?\nA. 3\nB. 4 *\nC. 5</code>
          <span style="color:var(--text-tertiary);">Mark correct: <code>*B.</code> or <code>B. text *</code> or <code>(correct)</code></span>
        </div>
        <div>
          <strong style="color:#fbbf24;">Identification:</strong><br/>
          <code style="font-size:0.7rem; white-space:pre; display:block; background:var(--bg-surface-hover); padding:0.4rem; border-radius:4px; margin-top:0.25rem;">1. What is the capital of France?\nAnswer: Paris</code>
        </div>
        <div>
          <strong style="color:#f472b6;">Matching:</strong><br/>
          <code style="font-size:0.7rem; white-space:pre; display:block; background:var(--bg-surface-hover); padding:0.4rem; border-radius:4px; margin-top:0.25rem;">1. Match the terms:\nPhotosynthesis -> Light energy\nMitosis -> Cell division</code>
        </div>
        <div>
          <strong style="color:#38bdf8;">True/False:</strong><br/>
          <code style="font-size:0.7rem; white-space:pre; display:block; background:var(--bg-surface-hover); padding:0.4rem; border-radius:4px; margin-top:0.25rem;">1. True or False: The earth is round.\nAnswer: True</code>
        </div>
        <div>
          <strong>Headers auto-skipped:</strong> <code>Part 1</code>, <code>I. Multiple Choice</code>, <code>DIRECTIONS:</code>
        </div>
      </div>
    </div>`;

  let html = `
    <div class="nb-qmodal-cols">
      <div class="nb-qmodal-main">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
          <h4 style="font-weight:700; font-size:0.75rem; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:0.05em; margin:0;">QUESTIONS (${currentGivenQuestionsData.length})</h4>
        </div>
        <div style="display:flex; flex-direction:column; gap:0.75rem; margin-bottom:1rem;">
          ${leftHtml}
        </div>
      </div>

      <div class="nb-qmodal-side">
        <div class="card-flat" style="padding:1rem; border:1px solid var(--border-color);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
            <h4 style="font-weight:700; font-size:0.75rem; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:0.05em; margin:0;">UNIFIED BULK ADD</h4>
            <div style="display:flex; align-items:center; gap:0.3rem;">
              <button onclick="nbCopyFormat('given')" class="nb-fmt-btn" title="Copy the accepted format — hand it to an AI so its output pastes in cleanly" aria-label="Copy format to clipboard">
                <i data-lucide="clipboard-copy"></i>
              </button>
              <button onclick="toggleFormatGuide()" class="btn btn-ghost" style="padding:0.2rem 0.4rem; font-size:0.7rem; color:var(--color-primary); font-weight:700; border:1px solid var(--color-primary)33; border-radius:var(--radius-sm);" title="Show paste format guide">?</button>
            </div>
          </div>
          ${formatGuideHtml}
          <p style="font-size:0.7rem; color:var(--text-secondary); margin-bottom:0.5rem;">Paste everything — questions, choices, answers, matching pairs. Auto-detected.</p>
          <textarea id="gq-bulk-unified" class="form-textarea" rows="8" placeholder="1. What is 2+2?\nA. 3\nB. 4\n\n2. Identify the term for water movement.\nAnswer: Osmosis\n\n3. Match the following:\nCell -> Biology\nAtom -> Chemistry" style="font-family:var(--font-mono); font-size:0.8rem; margin-bottom:0.75rem;"></textarea>
          <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
            <button onclick="bulkAddGivenQuestions()" class="btn btn-primary" style="flex:1; font-size:0.8rem; padding:0.4rem 0.75rem;">
              <i data-lucide="zap" style="width:14px;height:14px;"></i> Parse & Apply
            </button>
            <button onclick="bulkClearGivenQuestions()" class="btn btn-ghost" style="font-size:0.75rem; padding:0.4rem 0.5rem; color:var(--color-danger);">Clear All</button>
            <button onclick="bulkUndoGivenQuestions()" class="btn btn-ghost" style="font-size:0.75rem; padding:0.4rem 0.5rem;">Undo</button>
          </div>
          <div id="gq-parse-report" style="margin-top:0.75rem;"></div>
        </div>

        <div class="card-flat" style="padding:1rem; border:1px solid var(--border-color);">
          <h4 style="font-weight:700; font-size:0.75rem; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.5rem;">QUICK ADD</h4>
          <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
            <button onclick="quickAddQuestions('mcq', 5)" class="btn btn-secondary" style="font-size:0.7rem; padding:0.3rem 0.5rem;">+5 MCQ</button>
            <button onclick="quickAddQuestions('checkbox', 5)" class="btn btn-secondary" style="font-size:0.7rem; padding:0.3rem 0.5rem;">+5 Multi</button>
            <button onclick="quickAddQuestions('matching', 3)" class="btn btn-secondary" style="font-size:0.7rem; padding:0.3rem 0.5rem;">+3 Match</button>
            <button onclick="quickAddQuestions('text', 3)" class="btn btn-secondary" style="font-size:0.7rem; padding:0.3rem 0.5rem;">+3 Ident</button>
            <button onclick="quickAddQuestions('truefalse', 1)" class="btn btn-secondary" style="font-size:0.7rem; padding:0.3rem 0.5rem;">+1 T/F</button>
          </div>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;
  // Scoped: the global call rescans the whole document for [data-lucide]
  // on every re-render, with the sidebar and form still mounted.
  lucide.createIcons({ el: container });
}

/* Helper functions for question image uploads (Base64 compression) */
function uploadGQImageFile(idx, fileInput) {
  const file = fileInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      // Compress/downscale image using Canvas to keep size small
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      const MAX_WIDTH = 800; // Optimal width for Firestore limits and speed
      const MAX_HEIGHT = 600;

      if (width > MAX_WIDTH) {
        height *= MAX_WIDTH / width;
        width = MAX_WIDTH;
      }
      if (height > MAX_HEIGHT) {
        width *= MAX_HEIGHT / height;
        height = MAX_HEIGHT;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to compressed JPEG data URL
      const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);

      // Update inputs and preview UI
      const inputEl = document.getElementById(`gq-image-${idx}`);
      if (inputEl) {
        inputEl.value = compressedBase64;
      }
      
      const previewImg = document.getElementById(`gq-image-preview-${idx}`);
      const previewContainer = document.getElementById(`gq-image-preview-container-${idx}`);
      if (previewImg && previewContainer) {
        previewImg.src = compressedBase64;
        previewContainer.classList.remove('hidden');
      }

      // Sync changes to active state
      syncGivenQuestionData();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function clearGQImage(idx) {
  const inputEl = document.getElementById(`gq-image-${idx}`);
  if (inputEl) inputEl.value = '';

  const previewContainer = document.getElementById(`gq-image-preview-container-${idx}`);
  if (previewContainer) previewContainer.classList.add('hidden');

  syncGivenQuestionData();
}

function previewGQImage(idx) {
  const inputEl = document.getElementById(`gq-image-${idx}`);
  const previewImg = document.getElementById(`gq-image-preview-${idx}`);
  const previewContainer = document.getElementById(`gq-image-preview-container-${idx}`);
  
  if (inputEl && previewImg && previewContainer) {
    const val = inputEl.value.trim();
    if (val) {
      previewImg.src = val;
      previewContainer.classList.remove('hidden');
    } else {
      previewContainer.classList.add('hidden');
    }
  }
  syncGivenQuestionData();
}
