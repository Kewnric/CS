/* ============================================================
   ADMIN-NOTEBOOKS.JS — Training Grounds: Notebooks (MCQ) Admin
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
    tbody.innerHTML = '<div class="empty-state" style="padding:2rem;"><p>No notebooks inside Training Grounds.</p></div>';
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
              return qs
                ? `${qs} question${qs !== 1 ? 's' : ''}` + (secs > 1 ? ` in ${secs} sections` : '')
                : `${secs} section${secs !== 1 ? 's' : ''} · empty`;
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
    const firstNbFolder = state.nodes.find(n => n.type === 'folder' && n.scope === 'notebook');
    notebookAdminState = {
      id: 'new', title: '', parentId: firstNbFolder ? firstNbFolder.id : null,
      icon: 'book', tags: [], description: '', sections: []
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
      window.adminIsDirty = true;
      if (typeof setSaveStatus === 'function') setSaveStatus('notebook-save-status', 'unsaved');
    }, 'Select category...');
  }

  renderIconDropdown('notebook-icon-picker-container', notebookAdminState.icon || 'book', (newIcon) => {
    notebookAdminState.icon = newIcon;
    window.adminIsDirty = true;
    if (typeof setSaveStatus === 'function') setSaveStatus('notebook-save-status', 'unsaved');
  });
  document.getElementById('notebook-desc').value = notebookAdminState.description || '';
  const nbDiff = document.getElementById('notebook-difficulty');
  if (nbDiff) nbDiff.value = notebookAdminState.difficulty || '';
  const nbLevel = document.getElementById('notebook-level');
  if (nbLevel) nbLevel.value = notebookAdminState.level != null ? notebookAdminState.level : '';

  renderNotebookTags();
  if (typeof renderTagSuggestions === 'function') renderTagSuggestions('notebook', 'notebook');
  renderNotebookSectionsForm();
  renderNotebookCover();

  if (id === 'new') {
    setTimeout(() => document.getElementById('notebook-title')?.focus(), 60);
  }
}

function closeNotebookForm() {
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
      window.adminIsDirty = true;
      if (typeof setSaveStatus === 'function') setSaveStatus('notebook-save-status', 'unsaved');
      renderNotebookCover();
    });
  };
  reader.readAsDataURL(file);
}

function removeNotebookCover() {
  if (!notebookAdminState) return;
  delete notebookAdminState.coverImage;
  window.adminIsDirty = true;
  if (typeof setSaveStatus === 'function') setSaveStatus('notebook-save-status', 'unsaved');
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
  if (!(notebookAdminState.sections || []).length) {
    showMessage('Nothing to preview', 'Add a section with at least one question first.', true);
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

function handleNotebookTagKeydown(ev) {
  if (ev.key === 'Enter') { ev.preventDefault(); addNotebookTag(); return; }
  if (ev.key === ',') { ev.preventDefault(); addNotebookTag(); return; }
  if (ev.key === 'Backspace' && !ev.target.value && notebookAdminState && notebookAdminState.tags.length > 0) {
    ev.preventDefault();
    notebookAdminState.tags.pop();
    renderNotebookTags();
    window.adminIsDirty = true;
    if (typeof setSaveStatus === 'function') setSaveStatus('notebook-save-status', 'unsaved');
  }
}

function addNotebookTag() {
  const input = document.getElementById('notebook-tag-input');
  if (!input) return;
  const raw = input.value.trim();
  if (!raw) return;
  raw.split(',').map(v => v.trim()).filter(v => v).forEach(val => {
    if (notebookAdminState && !notebookAdminState.tags.includes(val)) {
      notebookAdminState.tags.push(val);
    }
  });
  input.value = '';
  renderNotebookTags();
  if (typeof renderTagSuggestions === 'function') renderTagSuggestions('notebook', 'notebook');
  window.adminIsDirty = true;
  if (typeof setSaveStatus === 'function') setSaveStatus('notebook-save-status', 'unsaved');
}

function removeNotebookTag(tag) {
  notebookAdminState.tags = notebookAdminState.tags.filter(t => t !== tag);
  renderNotebookTags();
  if (typeof renderTagSuggestions === 'function') renderTagSuggestions('notebook', 'notebook');
  window.adminIsDirty = true;
  if (typeof setSaveStatus === 'function') setSaveStatus('notebook-save-status', 'unsaved');
}

function renderNotebookTags() {
  const list = document.getElementById('notebook-tags-list');
  if (!list) return;
  list.innerHTML = notebookAdminState.tags.map(t => `
    <span class="tag">
      ${escapeHTML(t)}
      <button onclick="removeNotebookTag('${escapeHTML(t).replace(/'/g, "\\'")}')" title="Remove tag" aria-label="Remove tag ${escapeHTML(t)}"><i data-lucide="x" style="width:12px;height:12px;"></i></button>
    </span>
  `).join('');
  lucide.createIcons({ el: list });
}

function addNotebookSection() {
  syncAllNotebookSections();
  const labelEl = document.getElementById('new-sec-label');
  const label = labelEl ? (labelEl.value.trim() || 'New Section') : 'New Section';

  notebookAdminState.sections.push({
    id: 'sec_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    label: label,
    questions: [1, 2, 3, 4, 5],
    answerKey: '',
    answerKeysData: []
  });
  if (labelEl) labelEl.value = '';
  renderNotebookSectionsForm();
  window.adminIsDirty = true;
  if (typeof setSaveStatus === 'function') setSaveStatus('notebook-save-status', 'unsaved');
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

    // Extract count e.g. 10
    const countMatch = label.match(/\d+$/);
    let count = 5;
    if (countMatch) {
      count = parseInt(countMatch[0]);
      label = label.replace(/\d+$/, '').trim();
    }

    notebookAdminState.sections.push({
      id: 'sec_' + Date.now() + Math.random().toString(36).slice(2, 7),
      label: label || 'Section',
      choices: choices,
      questions: Array.from({ length: count }, (_, i) => i + 1),
      answerKey: '',
      answerKeysData: []
    });
  });
  const bulkInput = document.getElementById('bulk-add-sec-input');
  if (bulkInput) bulkInput.value = '';
  renderNotebookSectionsForm();
  window.adminIsDirty = true;
  if (typeof setSaveStatus === 'function') setSaveStatus('notebook-save-status', 'unsaved');
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
    window.adminIsDirty = true;
    if (typeof setSaveStatus === 'function') setSaveStatus('notebook-save-status', 'unsaved');
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
  window.adminIsDirty = true;
  if (typeof setSaveStatus === 'function') setSaveStatus('notebook-save-status', 'unsaved');
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
    errors: issues.filter(i => i.level === 'error').length,
    warns: issues.filter(i => i.level === 'warn').length,
    issues
  };
}

function _nbSecValidationInner(sec) {
  const v = validateNotebookSection(sec);
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
  let errors = 0, warns = 0;
  secs.forEach(s => { const v = validateNotebookSection(s); errors += v.errors; warns += v.warns; });
  return { errors, warns };
}

function _nbValidationSummaryInner() {
  const { errors, warns } = _notebookValidationSummary();
  if (errors === 0 && warns === 0) {
    return `<span style="display:inline-flex;align-items:center;gap:0.4rem;color:var(--color-success);font-size:0.78rem;font-weight:600;"><i data-lucide="shield-check" style="width:15px;height:15px;"></i> All sections graded and ready</span>`;
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
          <h4 class="nb-section-card-title">Section ${idx + 1}</h4>
          <div class="nb-section-card-meta">${(sec.questions || []).length} question${(sec.questions || []).length !== 1 ? 's' : ''} · <span class="nb-type-badge" style="--nb-badge:${badge.color};">${escapeHTML(typeSummary || badge.label)}</span></div>
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
              <label class="form-label">Label</label>
              <input id="nb-sec-label-${idx}" class="form-input nb-input-compact" value="${escapeHTML(sec.label || '')}" oninput="syncNotebookSection(${idx})" placeholder="e.g. Math, Reading..." />
            </div>
            <div class="af-field" style="width:120px;">
              <label class="form-label">Type</label>
              <!-- Was a readonly <input>: it looked editable, took a click and did
                   nothing. It is a derived summary, so it reads as one now. -->
              <div class="nb-type-readout" style="--nb-badge:${badge.color};" title="Auto-detected from the answer key">
                ${escapeHTML(typeSummary || badge.label)}
              </div>
            </div>
            <div class="af-field" style="width:100px;">
              <label class="form-label">Questions</label>
              <input id="nb-sec-count-${idx}" type="number" min="1" max="200" class="form-input nb-input-compact" value="${(sec.questions || []).length}" oninput="syncNotebookSection(${idx})" />
            </div>
          </div>
          <div class="nb-section-actions">
            <button onclick="openGivenQuestionModal(${idx})" class="btn btn-secondary nb-section-action-btn">
              <i data-lucide="file-text" style="width:16px;height:16px;"></i> Modify Given Question
            </button>
            <button onclick="openAnswerKeyModal(${idx})" class="btn btn-secondary nb-section-action-btn">
              <i data-lucide="key" style="width:16px;height:16px;"></i> Modify Answer Key
            </button>
            <button onclick="openBulkQuestionImport(${idx})" class="btn btn-secondary nb-section-action-btn">
              <i data-lucide="clipboard-paste" style="width:16px;height:16px;"></i> Import Questions
            </button>
          </div>
          <div id="nb-sec-validation-${idx}" class="nb-sec-validation" style="margin-top:0.5rem; display:flex; flex-direction:column; gap:0.2rem;">${_nbSecValidationInner(sec)}</div>
        </div>
      </div>
    `; }).join('');
  }

  html += `
    <div class="nb-add-section-card">
      <div class="nb-add-section-header">
        <i data-lucide="plus-square" style="width:14px;height:14px;color:var(--color-primary);"></i>
        <span>Add New Section</span>
      </div>
      <div class="nb-add-section-row">
        <input id="new-sec-label" class="form-input" placeholder="Section name..." style="flex:1; min-width:160px;" onkeydown="if(event.key==='Enter') addNotebookSection()" />
        <button onclick="addNotebookSection()" class="btn btn-primary nb-add-section-btn">
          <i data-lucide="plus" style="width:14px;height:14px;"></i> Add
        </button>
      </div>
    </div>

    <div class="nb-add-section-card">
      <div class="nb-add-section-header">
        <i data-lucide="layers" style="width:14px;height:14px;color:var(--color-accent);"></i>
        <span>Bulk Add Sections</span>
        <span class="af-label-hint" style="margin-left:auto;">Format: <code>Name Count (A-E)</code> · separate with <code>|</code></span>
      </div>
      <div class="nb-add-section-row">
        <input id="bulk-add-sec-input" class="form-input" placeholder="Math 10 | Science 5 (A-E)" style="flex:1;" onkeydown="if(event.key==='Enter') bulkAddNotebookSections()" />
        <button onclick="bulkAddNotebookSections()" class="btn btn-secondary nb-add-section-btn">
          <i data-lucide="layers" style="width:14px;height:14px;"></i> Confirm
        </button>
      </div>
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
  window.adminIsDirty = true;
  if (typeof setSaveStatus === 'function') setSaveStatus('notebook-save-status', 'unsaved');
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
  if (labelEl) sec.label = labelEl.value;
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
  }
  // Live-update validation without a full re-render (keeps input focus).
  const vEl = document.getElementById('nb-sec-validation-' + idx);
  if (vEl) { vEl.innerHTML = _nbSecValidationInner(sec); if (typeof lucide !== 'undefined') lucide.createIcons({ el: vEl }); }
  if (typeof _updateNbValidationSummary === 'function') _updateNbValidationSummary();
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

function nbBlankQuestion(qNum, type) {
  const d = { qNum, type: type || 'mcq', question: '', hint: '', image: '', explanation: '' };
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
  sec.answerKeysData = sec.questions.map(q => nbApplyTypeDefaults(byNum[q] || nbBlankQuestion(q)));
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
   BULK QUESTION IMPORT — paste a block of MCQ/checkbox/TF questions
   to populate a section's questions + answer keys at once.
   ============================================================ */

/**
 * Parse pasted question blocks (separated by blank lines) into answerKeysData-shaped
 * entries (without qNum, assigned by the caller).
 * Supported per block:
 *   - question line (optionally prefixed "Q:" / "1." / "1)")
 *   - choice lines: "A) text", "A. text", "(A) text"; prefix "*" marks the correct one
 *   - "Answer: A"  (or "A, C" → multi-select; "True"/"False" → maps to A/B)
 *   - "Explanation: ..." / "Hint: ..."
 * @returns {Array<{type,question,choices,answer,explanation,hint}>}
 */
function parseBulkQuestions(text) {
  if (!text) return [];
  const blocks = String(text).replace(/\r\n/g, '\n').split(/\n\s*\n+/).map(b => b.trim()).filter(Boolean);
  const out = [];

  blocks.forEach(block => {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    let question = '', explanation = '', hint = '';
    const choices = {};
    let answerLetters = [];
    const starred = [];

    lines.forEach(line => {
      const mlAns = line.match(/^(answer|ans|correct)\s*[:=]\s*(.+)$/i);
      if (mlAns) {
        const raw = mlAns[2].trim();
        const low = raw.toLowerCase();
        if (low === 'true') answerLetters = ['A'];
        else if (low === 'false') answerLetters = ['B'];
        else answerLetters = raw.toUpperCase().match(/[A-H]/g) || [];
        return;
      }
      const mlExp = line.match(/^(explanation|explain|exp)\s*[:=]\s*(.+)$/i);
      if (mlExp) { explanation = mlExp[2].trim(); return; }
      const mlHint = line.match(/^hint\s*[:=]\s*(.+)$/i);
      if (mlHint) { hint = mlHint[1].trim(); return; }

      // standalone correct-answer marker: "*A" / "*A)" / "*A." (no choice text)
      const mstar = line.match(/^\*\s*\(?([A-Ha-h])\)?[.):]?\s*$/);
      if (mstar) { starred.push(mstar[1].toUpperCase()); return; }

      // choice line:  *A) text | (A) text | A. text | A: text
      const mc = line.match(/^(\*?)\s*\(?([A-Ha-h])\)?\s*[).:\-]\s+(.*)$/);
      if (mc) {
        const letter = mc[2].toUpperCase();
        choices[letter] = mc[3].trim();
        if (mc[1] === '*') starred.push(letter);
        return;
      }

      // otherwise: part of the question text (strip "Q:" / leading numbering)
      const q = line.replace(/^q(uestion)?\s*[:.)\-]?\s*/i, '').replace(/^\d+\s*[.)\-:]\s*/, '').trim();
      if (q) question = question ? question + ' ' + q : q;
    });

    if (starred.length) answerLetters = starred;
    answerLetters = [...new Set(answerLetters)].filter(L => Object.keys(choices).length === 0 || choices[L] !== undefined);

    if (!question && Object.keys(choices).length === 0) return; // nothing usable

    const choiceVals = Object.keys(choices).sort().map(k => (choices[k] || '').toLowerCase());
    const isTF = choiceVals.length === 2 && choiceVals.includes('true') && choiceVals.includes('false');

    let type, answer;
    if (isTF) { type = 'truefalse'; answer = answerLetters[0] || ''; }
    else if (answerLetters.length > 1) { type = 'checkbox'; answer = answerLetters; }
    else { type = 'mcq'; answer = answerLetters[0] || ''; }

    out.push({ type, question, choices, answer, explanation, hint });
  });

  return out;
}

/** Apply parsed questions to a section (replace or append). Returns { added }.
 *  Uses the same two-phase parser as the Given Question modal, so matching,
 *  identification, explanations and hints all work here too. */
function applyBulkQuestions(idx, text, append) {
  const sec = notebookAdminState.sections[idx];
  if (!sec) return { added: 0 };
  const parsed = _assembleBulkQuestions(_tokenizeBulkInput(text));
  if (parsed.length === 0) return { added: 0 };

  let base = [];
  let startQ = 1;
  if (append && Array.isArray(sec.answerKeysData)) {
    base = JSON.parse(JSON.stringify(sec.answerKeysData));
    startQ = (sec.questions || []).length + 1;
  }

  const newEntries = parsed.map((p, i) => ({
    qNum: startQ + i, type: p.type, question: p.question || '',
    choices: p.choices || {}, answer: p.answer, explanation: p.explanation || '',
    hint: p.hint || '', image: p.image || '', pairs: p.pairs || []
  }));

  const all = base.concat(newEntries);
  sec.answerKeysData = all;
  sec.questions = Array.from({ length: all.length }, (_, i) => i + 1);

  let maxChoices = sec.choices || 4;
  all.forEach(d => { const n = Object.keys(d.choices || {}).length; if (n > maxChoices) maxChoices = n; });
  sec.choices = Math.max(2, Math.min(8, maxChoices || 4));

  return { added: newEntries.length };
}

function openBulkQuestionImport(idx) {
  syncAllNotebookSections();
  let overlay = document.getElementById('bulk-q-import-overlay');
  if (overlay) overlay.remove();
  overlay = document.createElement('div');
  overlay.id = 'bulk-q-import-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);padding:1rem;';
  const example = 'Q: Which function prints to stdout in C?\nA) printf()\nB) console.log()\nC) echo()\n*A\nExplanation: printf is the standard C output.\n\nSelect all valid C loop keywords\nA) for\nB) loop\nC) while\nAnswer: A, C\n\nWhat is the capital of France?\nAnswer: Paris\n\nMatch the following:\nCell -> Biology\nAtom -> Chemistry';
  overlay.innerHTML = `
    <div style="background:var(--bg-elevated);border:1px solid var(--border-color);border-radius:var(--radius-lg);padding:1.5rem;width:640px;max-width:100%;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 24px 48px rgba(0,0,0,0.5);">
      <h3 style="font-weight:700;margin-bottom:0.5rem;display:flex;align-items:center;gap:0.5rem;font-size:1.05rem;">
        <i data-lucide="clipboard-paste" style="width:18px;height:18px;color:var(--color-primary);"></i> Import Questions
        <!-- This dialog explains the format, so this is where you want to take a
             copy of it — for your own notes, or to hand to an AI. -->
        <button onclick="nbFormatMenu(event, 'given')" class="nb-fmt-btn" style="margin-left:auto;"
                title="Copy this format — paste it to an AI so its questions import cleanly"
                aria-label="Copy the import format to the clipboard">
          <i data-lucide="clipboard-copy"></i>
        </button>
      </h3>
      <p style="font-size:0.78rem;color:var(--text-tertiary);margin-bottom:0.5rem;line-height:1.5;">
        Paste questions separated by a blank line. Mark the correct choice with <code>*</code> or an <code>Answer:</code> line.
        Two letters (<code>Answer: A, C</code>) make a multi-select; <code>True</code>/<code>False</code> auto-detects.
        A word answer with no choices makes an <em>identification</em> question; <code>term -&gt; definition</code> lines make a <em>matching</em> question.
        <code>Explanation:</code> and <code>Hint:</code> lines are picked up too.
        <button onclick="nbFormatMenu(event, 'given')" class="nb-fmt-link">Copy this format</button>
      </p>
      <textarea id="bulk-q-input" spellcheck="false" style="width:100%;flex:1;min-height:240px;font-family:var(--font-mono);font-size:0.78rem;padding:0.6rem;border-radius:var(--radius-md);border:1px solid var(--border-color);background:var(--bg-surface);color:var(--text-primary);resize:vertical;" placeholder="${escapeHTML(example)}"></textarea>
      <label style="display:flex;align-items:center;gap:0.4rem;font-size:0.8rem;color:var(--text-secondary);margin:0.6rem 0;cursor:pointer;">
        <input type="checkbox" id="bulk-q-append" /> Append to existing questions (otherwise replaces this section)
      </label>
      <div id="bulk-q-error" style="font-size:0.75rem;color:var(--color-danger);min-height:1em;margin-bottom:0.4rem;"></div>
      <div style="display:flex;gap:0.5rem;justify-content:flex-end;">
        <button onclick="document.getElementById('bulk-q-import-overlay').remove()" class="btn btn-secondary btn-sm">Cancel</button>
        <button onclick="confirmBulkQuestionImport(${idx})" class="btn btn-primary btn-sm"><i data-lucide="check" style="width:14px;height:14px;"></i> Import</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: overlay });
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  setTimeout(() => document.getElementById('bulk-q-input')?.focus(), 50);
}

function confirmBulkQuestionImport(idx) {
  const ta = document.getElementById('bulk-q-input');
  const errEl = document.getElementById('bulk-q-error');
  const append = !!(document.getElementById('bulk-q-append') && document.getElementById('bulk-q-append').checked);
  const text = ta ? ta.value : '';
  if (!text.trim()) { if (errEl) errEl.textContent = 'Paste at least one question.'; return; }
  if (_assembleBulkQuestions(_tokenizeBulkInput(text)).length === 0) { if (errEl) errEl.textContent = 'Could not find any questions — check the format against the example.'; return; }

  const res = applyBulkQuestions(idx, text, append);
  const overlay = document.getElementById('bulk-q-import-overlay');
  if (overlay) overlay.remove();
  renderNotebookSectionsForm();
  window.adminIsDirty = true;
  if (typeof setSaveStatus === 'function') setSaveStatus('notebook-save-status', 'unsaved');
  if (typeof showMessage === 'function') showMessage('Imported', `Added ${res.added} question${res.added !== 1 ? 's' : ''} to this section.`);
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

  sec.answerKey = currentAnswerKeysData
    .filter(d => {
      const t = d.type || 'mcq';
      return (t === 'mcq' || t === 'truefalse') && d.answer && typeof d.answer === 'string' && d.answer.trim() !== '';
    })
    .map(d => `${d.qNum}=${d.answer.trim().toUpperCase()}`)
    .join('\n');

  closeAnswerKeyModal();
  renderNotebookSectionsForm();
  window.adminIsDirty = true;
  if (typeof setSaveStatus === 'function') setSaveStatus('notebook-save-status', 'unsaved');
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

function addAnswerKeySample() {
  syncAnswerKeyData();
  const nextQ = currentAnswerKeysData.length > 0 ? Math.max(...currentAnswerKeysData.map(d => d.qNum)) + 1 : 1;
  currentAnswerKeysData.push({ qNum: nextQ, answer: '', explanation: '' });
  renderAnswerKeyContent();
}

function removeAnswerKeySample(idx) {
  syncAnswerKeyData();
  currentAnswerKeysData.splice(idx, 1);
  renderAnswerKeyContent();
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
            <button onclick="nbFormatMenu(event, 'answer')" class="nb-fmt-btn" title="Copy the accepted answer-key format" aria-label="Copy answer key format to clipboard">
              <i data-lucide="clipboard-copy"></i>
            </button>
          </h4>
          <button onclick="addAnswerKeySample()" class="btn btn-ghost btn-sm" style="color:var(--color-primary); font-weight:600;">
            <i data-lucide="plus-circle" style="width:14px;height:14px;"></i> Add Answer
          </button>
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
          <button onclick="removeAnswerKeySample(${i})" class="btn btn-ghost btn-sm" title="Remove" style="padding:0.25rem;">
            <i data-lucide="trash-2" style="width:14px;height:14px;color:var(--color-danger);"></i>
          </button>
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

  // Merge currentGivenQuestionsData into sec.answerKeysData to avoid overwriting answers
  if (!sec.answerKeysData) {
    sec.answerKeysData = [];
  }

  currentGivenQuestionsData.forEach(gq => {
    const existing = sec.answerKeysData.find(d => d.qNum === gq.qNum);
    if (existing) {
      existing.question = gq.question;
      existing.hint = gq.hint;
      existing.image = gq.image || '';
      existing.type = gq.type || existing.type || 'mcq';
      existing.choices = gq.choices || existing.choices || {};
      existing.pairs = gq.pairs || existing.pairs || [];
      if (gq.answer) existing.answer = gq.answer;
    } else {
      sec.answerKeysData.push(gq);
    }
  });

  // sec.questions is NOT rebuilt from the records here. Doing that was what
  // resurrected a count the user had already lowered.
  nbNormalizeSection(sec);

  closeGivenQuestionModal();
  renderNotebookSectionsForm();
  window.adminIsDirty = true;
  if (typeof setSaveStatus === 'function') setSaveStatus('notebook-save-status', 'unsaved');
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

/* ----------------------------------------------------------
   INTELLIGENT BULK ADD PARSER — Two-Phase Engine
   Replaces old normalizeQuestionBulkText + bulkAddGivenQuestions
   Supports: MCQ, Checkbox, Text/Identification, Matching, True/False
   Per-question adaptive choices (A-Z), answer markers, headers, pairs
   ---------------------------------------------------------- */

const _BULK_HEADER_KW = /^(part|section|test|directions?|instructions?|items?|for items|note)\b/i;
const _BULK_ROMAN = /^[IVX]+\.\s+/;
const _BULK_ALLCAPS = /^[A-Z][A-Z\s]{2,}:\s*$/;
const _BULK_SECTION_NAMES = ['multiple choice', 'true or false', 'identification', 'matching', 'essay', 'reading comprehension', 'enumeration', 'problem solving', 'fill in the blank', 'true/false'];

function _isHeaderLine(text, hasActiveQ, seenNumQ) {
  if (_BULK_HEADER_KW.test(text)) return true;
  if (_BULK_ROMAN.test(text)) return true;
  if (/^#{1,3}\s+/.test(text)) return true;
  if (_BULK_ALLCAPS.test(text)) return true;
  if (/^[-=]{3,}$/.test(text)) return true;
  // Context-aware: "A. Reading Comprehension" before any question = header
  if (!hasActiveQ) {
    const m = text.match(/^([A-Za-z])[.)]\s+(.+)$/);
    if (m) {
      const content = m[2].toLowerCase();
      if (_BULK_SECTION_NAMES.some(kw => content.includes(kw))) return true;
      if (!seenNumQ && /^[A-E]$/i.test(m[1]) && m[2].split(/\s+/).length <= 3) return true;
    }
  }
  return false;
}

function _extractAnswerMarker(text) {
  let c = text.replace(/\s*\(correct\)\s*$/i, '');
  if (c !== text) return { text: c.trim(), isCorrect: true };
  c = text.replace(/\s*\[correct\]\s*$/i, '');
  if (c !== text) return { text: c.trim(), isCorrect: true };
  c = text.replace(/\s*[✓✔]\s*$/, '');
  if (c !== text) return { text: c.trim(), isCorrect: true };
  if (text.length > 1) {
    c = text.replace(/\s*\*\s*$/, '');
    if (c !== text) return { text: c.trim(), isCorrect: true };
  }
  return { text, isCorrect: false };
}

/* Phase 1 — Tokenize: classify each line */
function _tokenizeBulkInput(text) {
  const lines = text.split('\n');
  const tokens = [];
  let hasActiveQ = false, seenNumQ = false, afterBlank = false, choicesStarted = false;

  for (const raw of lines) {
    const t = raw.trim();

    // 1. BLANK
    if (!t) { tokens.push({ type: 'blank' }); afterBlank = true; continue; }

    // 2. HEADER
    if (_isHeaderLine(t, hasActiveQ, seenNumQ)) {
      tokens.push({ type: 'header', text: t }); continue;
    }

    // 2b. STANDALONE ANSWER MARKER: "*A" or "*A, C" on its own line. The Import
    //     dialog advertises this, but the line was falling through to the
    //     unknown branch and starting a whole new question.
    const starM = t.match(/^\*\s*([A-Za-z](?:\s*[,&+]\s*[A-Za-z])*)\s*$/);
    if (starM) { tokens.push({ type: 'answer', text: starM[1].trim() }); continue; }

    // 3. ANSWER LINE: "Answer: X"
    const ansM = t.match(/^(?:Answer|Ans|Correct)\s*[:=]\s*(.+)$/i);
    if (ansM) { tokens.push({ type: 'answer', text: ansM[1].trim() }); continue; }

    // 3b. EXPLANATION / HINT LINES
    const expM = t.match(/^(?:Explanation|Explain|Exp|Why)\s*[:=]\s*(.+)$/i);
    if (expM) { tokens.push({ type: 'explanation', text: expM[1].trim() }); continue; }
    const hintM = t.match(/^Hint\s*[:=]\s*(.+)$/i);
    if (hintM) { tokens.push({ type: 'hint', text: hintM[1].trim() }); continue; }

    // 4. QUESTION LINE (1-3 digits, avoids year-like numbers)
    const qM = t.match(/^[Qq]?(\d{1,3})[.)=:]\s+(.+)$/);
    if (qM && qM[2].trim()) {
      hasActiveQ = true; seenNumQ = true; afterBlank = false; choicesStarted = false;
      // A trailing [MCQ] / [T/F] / [Match] / [Ident] / [Multi] settles the type
      // instead of leaving it to be guessed from the shape of what follows.
      const tagged = _extractTypeTag(qM[2].trim());
      // "1. Pick a colour?  A. red  B. blue" — all on one line, which a compact
      // paste often produces. Split the choices off the prompt.
      const inline = _splitInlineChoices(tagged.text);
      tokens.push({ type: 'question', qNum: parseInt(qM[1]), text: inline.text, forcedType: tagged.type });
      inline.choices.forEach(c => tokens.push({ type: 'choice', letter: c.letter, text: c.text, isCorrect: c.isCorrect }));
      if (inline.choices.length) choicesStarted = true;
      continue;
    }

    // 5a. TAB-SEPARATED PAIR — what you get pasting two columns out of a
    //     spreadsheet or a table, which was previously read as prose.
    if (t.includes('\t')) {
      const cells = t.split('\t').map(c => c.trim()).filter(Boolean);
      if (cells.length === 2) {
        tokens.push({ type: 'pair', left: cells[0], right: cells[1] });
        hasActiveQ = true; choicesStarted = true; continue;
      }
    }

    // 5. MATCHING PAIR: "term -> definition"
    const pairM = t.match(/^(?:[A-Za-z][.)]\s+)?(.+?)\s*(?:->|→|=>)\s*(.+)$/);
    if (pairM && pairM[1].trim().length > 0 && pairM[2].trim().length > 0) {
      tokens.push({ type: 'pair', left: pairM[1].trim(), right: pairM[2].trim() });
      hasActiveQ = true; choicesStarted = true; continue;
    }

    // 6. CHOICE LINE (only inside a question block)
    if (hasActiveQ) {
      let star = false, ct = t;
      if (/^\*\s*/.test(ct)) { star = true; ct = ct.replace(/^\*\s*/, ''); }

      // (A) text
      const cpM = ct.match(/^\(([A-Za-z])\)\s+(.+)$/);
      if (cpM) {
        const { text: cleaned, isCorrect } = _extractAnswerMarker(cpM[2].trim());
        tokens.push({ type: 'choice', letter: cpM[1].toUpperCase(), text: cleaned, isCorrect: isCorrect || star });
        choicesStarted = true; afterBlank = false; continue;
      }
      // A. text | A) text | A: text | A] text
      const clM = ct.match(/^([A-Za-z])[.):\]]\s+(.+)$/);
      if (clM) {
        const { text: cleaned, isCorrect } = _extractAnswerMarker(clM[2].trim());
        tokens.push({ type: 'choice', letter: clM[1].toUpperCase(), text: cleaned, isCorrect: isCorrect || star });
        choicesStarted = true; afterBlank = false; continue;
      }
      // Bullet: - text, • text
      const blM = ct.match(/^[-•]\s+(.+)$/);
      if (blM) {
        tokens.push({ type: 'bullet', text: blM[1].trim() });
        choicesStarted = true; afterBlank = false; continue;
      }
    }

    // 7. CONTINUATION (inside question, before choices start, not after blank)
    if (hasActiveQ && !choicesStarted && !afterBlank) {
      tokens.push({ type: 'continuation', text: t }); continue;
    }

    // 8. UNKNOWN — an unnumbered question line. It opens a block like a
    //    numbered one does; without this, the "A." / "B." lines beneath it were
    //    not treated as choices at all and the question came out as free text.
    const inlineU = _splitInlineChoices(t);
    tokens.push({ type: 'unknown', text: inlineU.text });
    inlineU.choices.forEach(c => tokens.push({ type: 'choice', letter: c.letter, text: c.text, isCorrect: c.isCorrect }));
    hasActiveQ = true;
    choicesStarted = inlineU.choices.length > 0;
    afterBlank = false;
  }
  return tokens;
}

/**
 * Pulls choices off a line that carries both the prompt and its options.
 * Only fires on two or more markers running A, B, C… in order, so an ordinary
 * sentence containing "a." or a middle initial is left alone.
 * @returns {{text: string, choices: Array<{letter,text,isCorrect}>}}
 */
function _splitInlineChoices(line) {
  const re = /(?:^|\s)\*?\(?([A-Za-z])\)?[.)]\s+/g;
  const hits = [];
  let m;
  while ((m = re.exec(line)) !== null) {
    hits.push({ letter: m[1].toUpperCase(), start: m.index + (m[0].startsWith(' ') ? 1 : 0), end: re.lastIndex,
                starred: m[0].includes('*') });
  }
  // Must start at A and run consecutively, otherwise this is prose.
  const consecutive = hits.length >= 2 && hits[0].letter === 'A' &&
    hits.every((h, k) => h.letter.charCodeAt(0) === 65 + k);
  if (!consecutive) return { text: line, choices: [] };

  const text = line.slice(0, hits[0].start).trim();
  if (!text) return { text: line, choices: [] };   // the whole line was choices

  const choices = hits.map((h, k) => {
    const stop = k + 1 < hits.length ? hits[k + 1].start : line.length;
    const raw = line.slice(h.end, stop).trim();
    const cleaned = (typeof _extractAnswerMarker === 'function') ? _extractAnswerMarker(raw) : { text: raw, isCorrect: false };
    return { letter: h.letter, text: cleaned.text, isCorrect: cleaned.isCorrect || h.starred };
  }).filter(c => c.text);

  return choices.length >= 2 ? { text, choices } : { text: line, choices: [] };
}

/** Pulls a trailing [MCQ] / [T/F] / [Match] / [Ident] / [Multi] off a question. */
function _extractTypeTag(text) {
  const m = text.match(/\s*\[(mcq|multi|multiple|checkbox|tf|t\/f|truefalse|true\/false|match|matching|ident|identification|text)\]\s*$/i);
  if (!m) return { text, type: null };
  const raw = m[1].toLowerCase();
  const map = {
    mcq: 'mcq',
    multi: 'checkbox', multiple: 'checkbox', checkbox: 'checkbox',
    tf: 'truefalse', 't/f': 'truefalse', truefalse: 'truefalse', 'true/false': 'truefalse',
    match: 'matching', matching: 'matching',
    ident: 'text', identification: 'text', text: 'text'
  };
  return { text: text.slice(0, m.index).trim(), type: map[raw] || null };
}

/**
 * Turns whatever was written after "Answer:" into something the question can
 * actually hold. Previously only a bare letter worked, so "Answer: B) 4",
 * "Answer: printf()" and "Answer: A and C" all landed as-is and graded nothing.
 * @returns {{answer: string|string[], unresolved: boolean}}
 */
function _resolveBulkAnswer(rawAnswer, choices, type) {
  const raw = String(rawAnswer == null ? '' : rawAnswer).trim();
  if (!raw) return { answer: type === 'checkbox' ? [] : '', unresolved: false };
  const letters = Object.keys(choices || {});

  if (type === 'text') return { answer: raw, unresolved: false };

  if (type === 'truefalse') {
    const v = raw.toLowerCase().replace(/[^a-z]/g, '');
    if (['a', 'true', 't'].includes(v)) return { answer: 'A', unresolved: false };
    if (['b', 'false', 'f'].includes(v)) return { answer: 'B', unresolved: false };
    return { answer: '', unresolved: true };
  }

  // Split on comma / "and" / "&" / "+" so multi-answers arrive as a list.
  const parts = raw.split(/\s*(?:,|;|\band\b|&|\+|\/)\s*/i).map(x => x.trim()).filter(Boolean);
  const resolved = [];
  let unresolved = false;

  parts.forEach(part => {
    // "B" or "B) 4" or "(B) 4" — take the leading letter when it names a choice.
    const lead = part.match(/^\(?([A-Za-z])\)?[.):\]]?(?:\s|$)/);
    if (lead && letters.includes(lead[1].toUpperCase())) {
      resolved.push(lead[1].toUpperCase());
      return;
    }
    // A number: 1 -> first choice.
    const num = part.match(/^(\d{1,2})$/);
    if (num) {
      const idx = parseInt(num[1], 10) - 1;
      if (letters[idx]) { resolved.push(letters[idx]); return; }
    }
    // The answer written out as the choice's own text.
    const hit = letters.find(L => String(choices[L] || '').trim().toLowerCase() === part.toLowerCase());
    if (hit) { resolved.push(hit); return; }
    unresolved = true;
  });

  const unique = [...new Set(resolved)];
  if (type === 'checkbox') return { answer: unique, unresolved: unresolved && !unique.length };
  return { answer: unique[0] || '', unresolved: unresolved && !unique.length };
}

/* Type auto-detection */
function _detectQuestionType(q) {
  if (q.pairs && q.pairs.length >= 2) return 'matching';
  const txt = q.question || '';
  if (/true\s*(or|\/)\s*false/i.test(txt)) return 'truefalse';
  const vals = Object.values(q.choices || {}).map(v => (v || '').toLowerCase().trim());
  if (vals.length === 2 && vals.includes('true') && vals.includes('false')) return 'truefalse';
  if (Array.isArray(q.answer) && q.answer.length > 1) return 'checkbox';
  if (/select all|choose all|multiple correct|pick all|that apply|multiple answers|more than one/i.test(txt)) return 'checkbox';
  if (/(?:choose|select|pick)\s+(?:two|three|four|five|six|seven|eight|nine|ten|\d+)/i.test(txt)) return 'checkbox';
  if (Object.keys(q.choices || {}).length === 0 && (!q.pairs || q.pairs.length < 2)) return 'text';
  return 'mcq';
}

/* Phase 2 — Assemble tokens into question objects */
function _assembleBulkQuestions(tokens) {
  const questions = [];
  let cur = null, autoQ = 1;

  function finalize() {
    if (!cur) return;
    const raw = cur._rawAnswer != null ? cur._rawAnswer : cur.answer;

    // Resolve permissively FIRST, so type detection can see that "A and C" is
    // two answers. Detecting first left cur.answer empty and every multi-answer
    // question came out as a single-choice MCQ.
    const probe = _resolveBulkAnswer(raw, cur.choices, 'checkbox');
    cur.answer = probe.answer;

    // An explicit [tag] on the question line beats the guess.
    cur.type = cur.forcedType || _detectQuestionType(cur);
    delete cur.forcedType;
    if (cur.type === 'truefalse') cur.choices = { A: 'True', B: 'False' };

    // Now shape it for the type that was chosen.
    const res = _resolveBulkAnswer(raw, cur.choices, cur.type);
    cur.answer = res.answer;
    if (res.unresolved) cur._unresolvedAnswer = String(raw || '').trim();
    delete cur._rawAnswer;
    // Single pair isn't matching — merge back to question text
    if (cur.pairs && cur.pairs.length < 2 && cur.type !== 'matching') {
      cur.pairs.forEach(p => { cur.question += (cur.question ? ' ' : '') + p.left + ' -> ' + p.right; });
      cur.pairs = [];
    }
    questions.push(cur);
    cur = null;
  }

  function startQ(qNum, text, forcedType) {
    finalize();
    cur = { qNum, type: 'mcq', question: text || '', hint: '', answer: '', explanation: '',
            choices: {}, pairs: [], forcedType: forcedType || null };
  }

  for (const tok of tokens) {
    switch (tok.type) {
      case 'blank': break;
      case 'header': break;
      case 'question':
        startQ(tok.qNum, tok.text, tok.forcedType);
        if (tok.qNum >= autoQ) autoQ = tok.qNum + 1;
        break;
      case 'choice':
        if (!cur) startQ(autoQ++, '');
        cur.choices[tok.letter] = tok.text;
        if (tok.isCorrect) {
          if (!cur.answer) cur.answer = tok.letter;
          else if (typeof cur.answer === 'string') cur.answer = [cur.answer, tok.letter];
          else if (Array.isArray(cur.answer)) cur.answer.push(tok.letter);
        }
        break;
      case 'bullet':
        if (!cur) startQ(autoQ++, '');
        cur.choices[String.fromCharCode(65 + Object.keys(cur.choices).length)] = tok.text;
        break;
      case 'pair':
        if (!cur) startQ(autoQ++, 'Match the following:');
        cur.pairs.push({ left: tok.left, right: tok.right });
        break;
      case 'answer':
        // Kept verbatim: finalize() resolves it once the choices are known, so
        // "Answer: printf()" can be matched against the choice text.
        if (cur) cur._rawAnswer = tok.text;
        break;
      case 'explanation':
        if (cur) cur.explanation = cur.explanation ? cur.explanation + ' ' + tok.text : tok.text;
        break;
      case 'hint':
        if (cur) cur.hint = cur.hint ? cur.hint + ' ' + tok.text : tok.text;
        break;
      case 'continuation':
        if (cur) cur.question += (cur.question ? ' ' : '') + tok.text;
        break;
      case 'unknown':
        startQ(autoQ++, tok.text);
        break;
    }
  }
  finalize();
  return questions;
}

/* Main entry point: parse unified textarea and apply */
/* ============================================================
   FORMAT REFERENCE — copy to clipboard
   ------------------------------------------------------------
   The parser accepts a lot, but nothing told you what. These build a spec you
   can paste to another model so the questions come back in a shape this
   importer reads on the first try, rather than being hand-fixed afterwards.
   ============================================================ */
const NB_FMT_NL = String.fromCharCode(10);

/** The exact sample this dialog shows as its placeholder. */
function _nbImportExample() {
  return [
    'Q: Which function prints to stdout in C?',
    'A) printf()', 'B) console.log()', 'C) echo()', '*A',
    'Explanation: printf is the standard C output.',
    '',
    'Select all valid C loop keywords',
    'A) for', 'B) loop', 'C) while', 'Answer: A, C',
    '',
    'What is the capital of France?',
    'Answer: Paris',
    '',
    'Match the following:',
    'Cell -> Biology',
    'Atom -> Chemistry'
  ].join(NB_FMT_NL);
}

function _nbGivenFormatSpec() {
  const L = [
    'QUESTION FORMAT — StudySession notebook import',
    '',
    'One question per block, blank line between blocks. Numbering is optional;',
    'unnumbered blocks are numbered in the order they appear.',
    'Add [MCQ] [Multi] [T/F] [Match] [Ident] at the end of a question line to',
    'set its type explicitly, otherwise the type is inferred.',
    '',
    '--- 1. MULTIPLE CHOICE (one correct) ---',
    '1. Which function prints to stdout in C? [MCQ]',
    'A. printf()',
    'B. console.log()',
    'C. echo()',
    'Answer: A',
    '',
    '--- 2. MULTI-SELECT (more than one correct) ---',
    '2. Which of these are loops? [Multi]',
    'A. for',
    'B. if',
    'C. while',
    'Answer: A and C',
    '',
    '--- 3. TRUE / FALSE ---',
    '3. The mitochondria produces ATP. [T/F]',
    'Answer: True',
    '',
    '--- 4. IDENTIFICATION (typed answer) ---',
    '4. Name the green pigment in chloroplasts. [Ident]',
    'Answer: Chlorophyll',
    'Hint: Starts with C.',
    '',
    '--- 5. MATCHING (two or more pairs) ---',
    '5. Match the organelle to its job: [Match]',
    'Nucleus -> Holds DNA',
    'Ribosome -> Makes protein',
    'Lysosome -> Digests waste',
    '',
    'ACCEPTED VARIATIONS',
    '- numbering: "1." "1)" "1:" "Q1." or none at all',
    '- choices:   "A." "A)" "(A)" "A:" — and they may sit on the question line',
    '- correct choice may be marked with * instead of an Answer line: "*B. Whale"',
    '- Answer accepts: a letter ("B"), letter with text ("B) 4"), the choice',
    '  text itself ("printf()"), a position ("2"), several ("A and C", "A, C")',
    '- matching pairs accept "->", "=>", "→" or a TAB between the two sides',
    '- "Hint:" and "Explanation:" lines attach to the question above them',
    '- headers like "PART I - MULTIPLE CHOICE" and "Instructions: ..." are ignored',
    '',
    'AVOID',
    '- putting two questions in one block without a blank line between them',
    '- numbering choices ("1. printf()") — numbers start a new question',
    '- a single matching pair; matching needs at least two'
  ];
  return L.join(NB_FMT_NL);
}

function _nbAnswerFormatSpec() {
  const L = [
    'ANSWER KEY FORMAT — StudySession notebook import',
    '',
    'One line per question. The number must match the question it answers.',
    '',
    '--- MULTIPLE CHOICE --- (the letter of the correct choice)',
    '1. B',
    '1 = B',
    'Answer 1: B',
    '',
    '--- MULTI-SELECT --- (every correct letter)',
    '2. A, C',
    '2 = A and C',
    '',
    '--- TRUE / FALSE ---',
    '3. True',
    '3 = T',
    '',
    '--- IDENTIFICATION --- (the exact expected text)',
    '4. Chlorophyll',
    '',
    '--- MATCHING --- (pair each term with its match)',
    '5. Nucleus -> Holds DNA',
    '5. Ribosome -> Makes protein',
    '5. Lysosome -> Digests waste',
    '',
    'NOTES',
    '- an "Explanation: ..." line after an answer is stored with it',
    '- letters are case-insensitive',
    '- an answer for a question number that does not exist is reported, not',
    '  silently dropped'
  ];
  return L.join(NB_FMT_NL);
}

/** The spec plus instructions, ready to hand to a model. */
function _nbAiPromptSpec() {
  const L = [
    'You are writing quiz questions that will be pasted into StudySession Pro.',
    'Follow this format EXACTLY. Output plain text only — no markdown, no code',
    'fences, no commentary before or after.',
    '',
    'Rules:',
    '- one question per block, one blank line between blocks',
    '- number every question sequentially starting at 1',
    '- put the type tag at the end of the question line',
    '- every question except Matching must have an Answer line',
    '- Multiple choice: 3-4 plausible options, exactly one correct',
    '- Multi-select: at least two correct, and say so in the question',
    '- Matching: at least two pairs, one per line, using ->',
    '- keep each question on a single line',
    '',
    _nbGivenFormatSpec(),
    '',
    'Now generate <N> questions about <TOPIC> using the formats above.'
  ];
  return L.join(NB_FMT_NL);
}

/** Copies a spec, using the same clipboard path the share links use. */
function nbCopyFormat(kind) {
  const spec = kind === 'answer' ? _nbAnswerFormatSpec()
             : kind === 'ai' ? _nbAiPromptSpec()
             : kind === 'sample' ? _nbImportExample()
             : _nbGivenFormatSpec();
  const label = kind === 'answer' ? 'Answer key format copied'
              : kind === 'ai' ? 'AI prompt copied — paste it to your model'
              : kind === 'sample' ? 'Sample questions copied'
              : 'Question format copied';
  if (typeof copyShareLink === 'function') copyShareLink(spec, label);
  else if (navigator.clipboard) navigator.clipboard.writeText(spec);
  _nbCloseFormatMenu();
}

function _nbCloseFormatMenu() {
  document.getElementById('nb-format-menu')?.remove();
}

/** Small menu so one button covers question, answer key and the AI prompt. */
function nbFormatMenu(ev, defaultKind) {
  ev.stopPropagation();
  const existing = document.getElementById('nb-format-menu');
  if (existing) { existing.remove(); return; }

  const btn = ev.currentTarget;
  const menu = document.createElement('div');
  menu.id = 'nb-format-menu';
  menu.className = 'nb-format-menu';
  const item = (kind, icon, title, sub) =>
    `<button type="button" class="nb-format-item" onclick="nbCopyFormat('${kind}')">
       <i data-lucide="${icon}"></i>
       <span><strong>${title}</strong><em>${sub}</em></span>
     </button>`;
  menu.innerHTML =
    item('given', 'list-checks', 'Question format', 'All five types, with examples') +
    item('answer', 'key', 'Answer key format', 'How to write the answers') +
    item('sample', 'file-text', 'Sample block', 'The example shown here, ready to edit') +
    item('ai', 'sparkles', 'AI prompt', 'Format plus instructions, for a model');
  document.body.appendChild(menu);
  if (typeof lucide !== 'undefined') lucide.createIcons({ el: menu });

  const r = btn.getBoundingClientRect();
  const mh = menu.getBoundingClientRect().height;
  menu.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 292)) + 'px';
  menu.style.top = (r.bottom + mh > window.innerHeight ? Math.max(8, r.top - mh - 6) : r.bottom + 6) + 'px';

  setTimeout(() => document.addEventListener('click', _nbCloseFormatMenu, { once: true }), 0);
}

function bulkAddGivenQuestions() {
  syncGivenQuestionData();
  const textarea = document.getElementById('gq-bulk-unified');
  const input = textarea ? textarea.value.trim() : '';
  if (!input) return;

  // Save undo state
  window._bulkUndoState = JSON.parse(JSON.stringify(currentGivenQuestionsData));

  const tokens = _tokenizeBulkInput(input);
  const parsed = _assembleBulkQuestions(tokens);

  if (parsed.length === 0) {
    if (typeof showShareToast === 'function') showShareToast('No questions detected in the input.');
    return;
  }

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

  currentGivenQuestionsData.sort((a, b) => a.qNum - b.qNum);

  // Bulk add is an explicit authoring action, so it may GROW the section — but
  // through the same count that everything else reads, and the field on the
  // form is updated with it. It never silently resurrects a count you lowered.
  const sec = notebookAdminState.sections[activeGivenQuestionSectionIdx];
  const highest = currentGivenQuestionsData.reduce((m, d) => Math.max(m, d.qNum || 0), 0);
  const newCount = Math.min(200, Math.max((sec.questions || []).length, highest));
  sec.questions = Array.from({ length: newCount }, (_, i) => i + 1);
  sec.answerKeysData = JSON.parse(JSON.stringify(currentGivenQuestionsData));
  nbNormalizeSection(sec);
  currentGivenQuestionsData = JSON.parse(JSON.stringify(sec.answerKeysData));
  const countEl = document.getElementById('nb-sec-count-' + activeGivenQuestionSectionIdx);
  if (countEl) countEl.value = String(newCount);

  if (textarea) textarea.value = '';
  renderGivenQuestionContent();
  _showParseReport(parsed);
  window.adminIsDirty = true;
  if (typeof setSaveStatus === 'function') setSaveStatus('notebook-save-status', 'unsaved');
}

function _showParseReport(parsed) {
  const counts = {};
  parsed.forEach(q => { counts[q.type] = (counts[q.type] || 0) + 1; });
  const typeLabels = { mcq: 'MCQ', checkbox: 'Multi-Select', text: 'Identification', matching: 'Matching', truefalse: 'True/False' };
  const parts = Object.entries(counts).map(([t, c]) => `${c} ${typeLabels[t] || t}`);

  const hasAns = (q) => Array.isArray(q.answer) ? q.answer.length > 0 : String(q.answer || '').trim() !== '';
  const answersFound = parsed.filter(hasAns).length;

  /* The report only ever said what worked. These are the things that quietly
     did not, and each one is a question that will not grade. */
  const problems = [];
  const noAnswer = parsed.filter(q => !hasAns(q) && q.type !== 'matching');
  if (noAnswer.length) {
    problems.push(`${noAnswer.length} with no answer (${noAnswer.slice(0, 6).map(q => 'Q' + q.qNum).join(', ')}${noAnswer.length > 6 ? '…' : ''})`);
  }
  const unresolved = parsed.filter(q => q._unresolvedAnswer);
  if (unresolved.length) {
    problems.push(`${unresolved.length} answer${unresolved.length !== 1 ? 's' : ''} that match no choice (${unresolved.slice(0, 4).map(q => 'Q' + q.qNum + ': "' + q._unresolvedAnswer + '"').join(', ')})`);
  }
  const emptyChoices = parsed.filter(q => (q.type === 'mcq' || q.type === 'checkbox') && Object.keys(q.choices || {}).length < 2);
  if (emptyChoices.length) {
    problems.push(`${emptyChoices.length} choice question${emptyChoices.length !== 1 ? 's' : ''} with fewer than 2 choices`);
  }
  const dupes = parsed.map(q => q.qNum).filter((n, i, a) => a.indexOf(n) !== i);
  if (dupes.length) problems.push(`repeated question numbers: ${[...new Set(dupes)].join(', ')}`);
  const halfPairs = parsed.filter(q => q.type === 'matching' && (q.pairs || []).some(pr => !pr.left || !pr.right));
  if (halfPairs.length) problems.push(`${halfPairs.length} matching question${halfPairs.length !== 1 ? 's' : ''} with an incomplete pair`);

  parsed.forEach(q => { delete q._unresolvedAnswer; });

  const reportEl = document.getElementById('gq-parse-report');
  if (!reportEl) return;
  const ok = problems.length === 0;
  reportEl.innerHTML = `
    <div class="nb-parse-report ${ok ? 'is-ok' : 'is-warn'}">
      <div class="nb-parse-head">
        <i data-lucide="${ok ? 'check-circle' : 'alert-triangle'}" style="width:16px;height:16px;"></i>
        <strong>${parsed.length} question${parsed.length !== 1 ? 's' : ''} parsed</strong>
      </div>
      <div class="nb-parse-sub">${parts.join(', ')}${answersFound > 0 ? ` · ${answersFound} answer${answersFound !== 1 ? 's' : ''} filled in` : ''}</div>
      ${problems.length ? `<ul class="nb-parse-problems">${problems.map(x => `<li>${escapeHTML(x)}</li>`).join('')}</ul>` : ''}
    </div>`;
  if (typeof lucide !== 'undefined') lucide.createIcons({ el: reportEl });
}

function quickAddQuestions(type, count) {
  syncGivenQuestionData();
  const maxQ = currentGivenQuestionsData.length > 0 ? Math.max(...currentGivenQuestionsData.map(d => d.qNum)) : 0;
  for (let i = 0; i < count; i++) {
    const q = { qNum: maxQ + i + 1, type, question: '', hint: '', image: '', answer: '', explanation: '', choices: {}, pairs: [] };
    if (type === 'mcq' || type === 'checkbox') q.choices = { A: '', B: '', C: '', D: '' };
    else if (type === 'matching') q.pairs = [{ left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }];
    else if (type === 'truefalse') q.choices = { A: 'True', B: 'False' };
    currentGivenQuestionsData.push(q);
  }
  const sec = notebookAdminState.sections[activeGivenQuestionSectionIdx];
  sec.questions = currentGivenQuestionsData.map(d => d.qNum).sort((a, b) => a - b);
  renderGivenQuestionContent();
  window.adminIsDirty = true;
  if (typeof setSaveStatus === 'function') setSaveStatus('notebook-save-status', 'unsaved');
}

function bulkClearGivenQuestions() {
  window._bulkUndoState = JSON.parse(JSON.stringify(currentGivenQuestionsData));
  currentGivenQuestionsData = [];
  const sec = notebookAdminState.sections[activeGivenQuestionSectionIdx];
  sec.questions = [];
  renderGivenQuestionContent();
  window.adminIsDirty = true;
  if (typeof setSaveStatus === 'function') setSaveStatus('notebook-save-status', 'unsaved');
}

function bulkUndoGivenQuestions() {
  if (!window._bulkUndoState) { if (typeof showShareToast === 'function') showShareToast('Nothing to undo.'); return; }
  currentGivenQuestionsData = JSON.parse(JSON.stringify(window._bulkUndoState));
  window._bulkUndoState = null;
  currentGivenQuestionsData.sort((a, b) => a.qNum - b.qNum);
  const sec = notebookAdminState.sections[activeGivenQuestionSectionIdx];
  sec.questions = currentGivenQuestionsData.map(d => d.qNum).sort((a, b) => a - b);
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
  const sec = notebookAdminState.sections[activeGivenQuestionSectionIdx];
  sec.questions = currentGivenQuestionsData.map(d => d.qNum).sort((a, b) => a - b);
  renderGivenQuestionContent();
  window.adminIsDirty = true;
  if (typeof setSaveStatus === 'function') setSaveStatus('notebook-save-status', 'unsaved');
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
              <button onclick="nbFormatMenu(event, 'given')" class="nb-fmt-btn" title="Copy the accepted format — hand it to an AI so its output pastes in cleanly" aria-label="Copy format to clipboard">
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
