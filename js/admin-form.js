/* ============================================================
   ADMIN-FORM.JS — Challenge Form Open/Close/Save/Tags
   ============================================================ */

function openAdminForm(id) {
  if (window.currentAdminMode === 'study') return openStudyForm(id);

  // Hide Empty State, Show Form
  const emptyState = document.getElementById('admin-empty-state');
  if (emptyState) emptyState.classList.add('hidden');
  const formContainer = document.getElementById('admin-form-container');
  if (formContainer) {
    formContainer.classList.remove('hidden');
    if (formContainer.parentElement) formContainer.parentElement.scrollTop = 0;
  }

  window.adminIsDirty = false;
  window.saveCurrentAdminForm = saveAdminForm;
  setSaveStatus('admin-save-status', '');
  // The step shell is set up after adminState exists, since what each step
  // still needs is read off it.
  setTimeout(() => {
    if (typeof afResetSteps === 'function') afResetSteps();
    if (typeof afAutosizeAll === 'function') afAutosizeAll(document.getElementById('admin-form-container'));
  }, 0);

  // Build folder picker for admin form
  const catSelect = document.getElementById('admin-category');
  const fpOpts = [];
  function buildFP(pid, d) {
    getChildFolders(pid, 'challenge').forEach(f => {
      fpOpts.push({ id: f.id, label: '  '.repeat(d) + f.name });
      buildFP(f.id, d + 1);
    });
  }
  buildFP(null, 0);
  catSelect.innerHTML = `<option value="">Uncategorized</option>` + fpOpts.map(f => `<option value="${escapeHTML(f.id)}">${escapeHTML(f.label)}</option>`).join('');

  const c = id !== 'new' ? state.challenges.find(ch => ch.id === id) : null;

  if (id === 'new' || !c) {
    const firstFolder = state.nodes.find(n => n.type === 'folder' && n.scope === 'challenge');
    adminState = {
      id: id === 'new' ? 'new' : id,
      title: '', parentId: firstFolder ? firstFolder.id : null, coverDescription: '',
      tags: [],
      variants: [{ id: generateId(), name: 'Version 1', description: '', starterCode: '', code: '', samples: [], tests: [] }],
      activeVariantIndex: 0
    };
  } else {
    adminState = JSON.parse(JSON.stringify(c));
    if (!adminState.tags) adminState.tags = [];
    if (!adminState.variants || adminState.variants.length === 0) {
      adminState.variants = [{ id: generateId(), name: 'Version 1', description: '', starterCode: '', code: '', samples: [] }];
    } else {
      adminState.variants.forEach(v => {
        if (!v.description) v.description = '';
        if (!v.starterCode) v.starterCode = '';
        if (!v.code) v.code = '';
        if (!v.samples) v.samples = [];
        if (!v.tests) v.tests = [];
        if (!v.minRequirements) v.minRequirements = [];
      });
    }
    adminState.activeVariantIndex = 0;
  }

  // Ensure all variants have a files[] (migration guard)
  adminState.variants.forEach(v => {
    if (!v.files || v.files.length === 0) {
      v.files = [{ id: generateId(), name: 'main', ext: '.c', starterCode: v.starterCode || '', code: v.code || '' }];
    }
    v.activeFileIndex = 0;
  });

  document.getElementById('admin-form-title').innerText = id === 'new' ? 'Create Program' : 'Edit Program';
  document.getElementById('admin-title').value = adminState.title;
  document.getElementById('admin-category').value = adminState.parentId || '';
  document.getElementById('admin-cover-desc').value = adminState.coverDescription || '';
  const diffSelect = document.getElementById('admin-difficulty');
  if (diffSelect) diffSelect.value = adminState.difficulty || '';
  const levelInput = document.getElementById('admin-level');
  if (levelInput) levelInput.value = adminState.level != null ? adminState.level : '';
  const aliasInput = document.getElementById('admin-alias');
  if (aliasInput) aliasInput.value = adminState.alias || '';
  const cheatInput = document.getElementById('admin-cheatsheet');
  if (cheatInput) cheatInput.checked = !!adminState.cheatsheet;
  document.getElementById('admin-tag-input').value = '';

  // Render custom category dropdown
  if (typeof renderCustomSelect === 'function') {
    _adminRenderCategorySelect(fpOpts);
  }

  renderAdminTags();
  renderTagSuggestions('admin', 'challenge');
  renderAdminVariantForm();
  renderAdminCover();

  if (id === 'new') {
    setTimeout(() => document.getElementById('admin-title')?.focus(), 60);
  }
}

/* ---- Program cover image (stored as a downscaled data URL, like notebooks) ---- */
function renderAdminCover() {
  const host = document.getElementById('admin-cover-field');
  if (!host || !adminState) return;
  const img = adminState.coverImage;
  host.innerHTML = `
    <input type="file" id="admin-cover-input" accept="image/*" class="hidden" onchange="handleAdminCoverUpload(this)" />
    ${img ? `
      <div class="nb-cover-preview">
        <img src="${img}" alt="Cover preview" />
        <div class="nb-cover-actions">
          <button type="button" class="btn btn-sm" onclick="document.getElementById('admin-cover-input').click()"><i data-lucide="repeat" style="width:13px;height:13px;"></i> Replace</button>
          <button type="button" class="btn btn-sm nb-cover-remove" onclick="removeAdminCover()"><i data-lucide="trash-2" style="width:13px;height:13px;"></i> Remove</button>
        </div>
      </div>
    ` : `
      <button type="button" class="nb-cover-drop" onclick="document.getElementById('admin-cover-input').click()">
        <i data-lucide="image-plus"></i>
        <span>Upload a cover image</span>
        <small>PNG / JPG — automatically resized to keep your data small</small>
      </button>
    `}
  `;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: host });
}

function handleAdminCoverUpload(input) {
  const file = input.files && input.files[0];
  if (!file || !adminState) return;
  if (!/^image\//.test(file.type)) {
    if (typeof showMessage === 'function') showMessage('Error', 'Please choose an image file.', true);
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    _downscaleImage(e.target.result, 960, 0.82, (dataUrl) => {
      adminState.coverImage = dataUrl;
      window.adminIsDirty = true;
      setSaveStatus('admin-save-status', 'unsaved');
      renderAdminCover();
    });
  };
  reader.readAsDataURL(file);
}

function removeAdminCover() {
  if (!adminState) return;
  delete adminState.coverImage;
  window.adminIsDirty = true;
  setSaveStatus('admin-save-status', 'unsaved');
  renderAdminCover();
}

/**
 * Close an admin form, but confirm first when there are unsaved changes.
 * Esc, the X button and Discard all route through here — previously they
 * closed instantly and silently threw away the user's edits.
 */
function confirmCloseAdminForm(closeFn, saveFn) {
  if (window.adminIsDirty) {
    showUnsavedConfirm(
      () => { window.adminIsDirty = false; closeFn(); },
      () => {
        const ok = typeof saveFn === 'function' ? saveFn({ silent: true }) : true;
        if (ok === false) return; // validation failed — keep the form open
        window.adminIsDirty = false;
        closeFn();
      }
    );
    return;
  }
  closeFn();
}

function closeAdminForm() {
  // Put an expanded editor home first, or it is destroyed inside the overlay.
  if (typeof afCollapseEditor === 'function') afCollapseEditor();
  const el = document.getElementById('admin-form-container');
  if (el) el.classList.add('hidden');

  // Also close visualization modal if it exists
  const vizModal = document.getElementById('viz-admin-modal');
  if (vizModal) vizModal.classList.add('hidden');

  // Show Empty State
  const emptyState = document.getElementById('admin-empty-state');
  if (emptyState) emptyState.classList.remove('hidden');

  adminState = null;
  window.adminIsDirty = false;
}

function renderAdminTags() {
  if (!adminState) return;
  const container = document.getElementById('admin-tags-list');
  if (!container) return;
  container.innerHTML = adminState.tags.map((t, idx) => `
    <span class="tag">
      ${escapeHTML(t)}
      <button onclick="removeAdminTag(${idx})" title="Remove tag" aria-label="Remove tag ${escapeHTML(t)}"><i data-lucide="x" style="width:12px;height:12px;"></i></button>
    </span>
  `).join('');
  lucide.createIcons({ el: container });
}

function handleAdminTagKeydown(ev) {
  if (ev.key === 'Enter') { ev.preventDefault(); addAdminTag(); return; }
  if (ev.key === ',') { ev.preventDefault(); addAdminTag(); return; }
  if (ev.key === 'Backspace' && !ev.target.value && adminState && adminState.tags.length > 0) {
    ev.preventDefault();
    adminState.tags.pop();
    renderAdminTags();
    window.adminIsDirty = true;
    setSaveStatus('admin-save-status', 'unsaved');
  }
}

function addAdminTag() {
  const input = document.getElementById('admin-tag-input');
  if (!input) return;
  const raw = input.value.trim();
  if (!raw) return;
  raw.split(',').map(v => v.trim()).filter(v => v).forEach(val => {
    if (adminState && !adminState.tags.includes(val)) {
      adminState.tags.push(val);
    }
  });
  input.value = '';
  renderAdminTags();
  renderTagSuggestions('admin', 'challenge');
  window.adminIsDirty = true;
  setSaveStatus('admin-save-status', 'unsaved');
}

function removeAdminTag(idx) {
  if (!adminState) return;
  adminState.tags.splice(idx, 1);
  renderAdminTags();
  renderTagSuggestions('admin', 'challenge');
  window.adminIsDirty = true;
  setSaveStatus('admin-save-status', 'unsaved');
}


/* ============================================================
   CATEGORY DROPDOWN — pick one, or make one without leaving the form
   ------------------------------------------------------------
   Filing a program used to mean abandoning a half-filled form, going to the
   folder pane, making the folder, and coming back. The dropdown can do it.

   A folder made here is "pending" until the program is saved, and pending
   folders carry an X so a typo can be undone on the spot. Saving the program
   commits them and the X disappears — by then something is filed in there.
   ============================================================ */
let _adminPendingFolders = [];

/** Same depth-first walk the native <select> uses, so both stay in step. */
function _adminFolderOpts() {
  const out = [];
  (function walk(pid, d) {
    getChildFolders(pid, 'challenge').forEach(f => {
      out.push({ value: f.id, label: '  '.repeat(d) + f.name, icon: 'folder' });
      walk(f.id, d + 1);
    });
  })(null, 0);
  return [{ value: '', label: 'Uncategorized', icon: 'inbox' }]
    .concat(out.map(o => ({ value: o.value, label: o.label.trim(), icon: 'folder' })));
}

/* saveAdminForm reads the hidden native <select>, not adminState. Assigning an
   id that has no matching <option> silently leaves the value empty, so a folder
   created here would be forgotten the moment the program was saved. Rebuild the
   options whenever the folder list changes. */
function _adminSyncNativeCategory(value) {
  const el = document.getElementById('admin-category');
  if (!el) return;
  el.innerHTML = _adminFolderOpts()
    .map(o => `<option value="${escapeHTML(o.value)}">${escapeHTML(o.label || 'Uncategorized')}</option>`)
    .join('');
  el.value = value || '';
}

function _adminRenderCategorySelect() {
  if (typeof renderCustomSelect !== 'function') return;
  renderCustomSelect('admin-category-cs', _adminFolderOpts(), adminState.parentId || '', (val) => {
    adminState.parentId = val || null;
    _adminSyncNativeCategory(val);
    window.adminIsDirty = true;
    setSaveStatus('admin-save-status', 'unsaved');
  }, 'Select category...', {
    createLabel: 'New category...',
    onCreate: () => _adminCreateCategory(),
    removable: (id) => _adminPendingFolders.includes(id),
    onRemove: (id) => _adminRemovePendingFolder(id)
  });
}

function _adminCreateCategory() {
  showInputDialog('New category', null, 'Category name', '', (name) => {
    const t = (name || '').trim();
    if (!t) return;
    const dupe = (state.nodes || []).some(n =>
      n.type === 'folder' && n.scope === 'challenge' && (n.name || '').toLowerCase() === t.toLowerCase());
    if (dupe) {
      if (typeof toast === 'function') toast('A category called "' + t + '" already exists.', { type: 'warning' });
      return;
    }
    const node = createNode(t, 'folder', null, 'challenge');
    if (!node) return;                 // refused: the pack is on screen
    _adminPendingFolders.push(node.id);

    // Selected straight away — creating it here means you want to use it.
    adminState.parentId = node.id;
    _adminSyncNativeCategory(node.id);
    window.adminIsDirty = true;
    setSaveStatus('admin-save-status', 'unsaved');

    _adminRenderCategorySelect();
    if (typeof renderAdmin === 'function') renderAdmin();
    if (typeof toast === 'function') toast('Category "' + t + '" created.', { type: 'success' });
  });
}

function _adminRemovePendingFolder(id) {
  if (!_adminPendingFolders.includes(id)) return;   // only ones made in this form
  const node = (state.nodes || []).find(n => n.id === id);
  const kids = (state.challenges || []).filter(c => c.parentId === id).length;
  if (kids) {
    if (typeof toast === 'function') toast('That category is not empty any more.', { type: 'warning' });
    _adminPendingFolders = _adminPendingFolders.filter(x => x !== id);
    _adminRenderCategorySelect();
    return;
  }
  state.nodes = (state.nodes || []).filter(n => n.id !== id);
  _adminPendingFolders = _adminPendingFolders.filter(x => x !== id);
  if (adminState.parentId === id) adminState.parentId = null;
  saveData();
  _adminSyncNativeCategory(adminState.parentId || '');
  _adminRenderCategorySelect();
  if (typeof renderAdmin === 'function') renderAdmin();
  if (typeof toast === 'function') toast('Removed "' + ((node && node.name) || 'category') + '".', { type: 'info' });
}

function saveAdminForm(opts = {}) {
  // Sync DOM fields back to state before saving
  const titleEl = document.getElementById('admin-title');
  const catEl = document.getElementById('admin-category');
  const coverDescEl = document.getElementById('admin-cover-desc');
  const levelEl = document.getElementById('admin-level');
  if (titleEl) adminState.title = titleEl.value;
  if (catEl) adminState.parentId = catEl.value || null;
  if (coverDescEl) adminState.coverDescription = coverDescEl.value;
  if (levelEl) {
    const lv = parseInt(levelEl.value, 10);
    adminState.level = lv > 0 ? Math.min(lv, 100) : null;   // levels run 1–100
  }
  const aliasEl = document.getElementById('admin-alias');
  if (aliasEl) adminState.alias = aliasEl.value.trim() || null;
  const cheatEl = document.getElementById('admin-cheatsheet');
  if (cheatEl) adminState.cheatsheet = cheatEl.checked;

  const title = adminState.title.trim();
  if (!title) {
    showValidationError(titleEl, "Program Title is required.");
    if (!opts.silent) showMessage("Error", "Program Title is required.", true);
    return false;
  }

  let isValid = true;
  let firstInvalidVariantIdx = -1;
  adminState.variants.forEach((v, vi) => {
    if (!v.name.trim()) { isValid = false; if (firstInvalidVariantIdx === -1) firstInvalidVariantIdx = vi; return; }
    if (v.files && v.files.length > 0) {
      v.code = v.files[0].code || '';
      v.starterCode = v.files[0].starterCode || '';
    }
    const hasCode = v.files ? v.files.some(f => f.code.trim()) : v.code.trim();
    if (!hasCode) { isValid = false; if (firstInvalidVariantIdx === -1) firstInvalidVariantIdx = vi; }
  });

  if (!isValid) {
    if (firstInvalidVariantIdx >= 0 && adminState.activeVariantIndex !== firstInvalidVariantIdx) {
      adminState.activeVariantIndex = firstInvalidVariantIdx;
      if (typeof renderAdminVariantForm === 'function') renderAdminVariantForm();
    }
    if (!opts.silent) showMessage("Error", "All versions must have a name and at least one file with target code.", true);
    return false;
  }

  const { activeVariantIndex, ...toSave } = adminState;
  if (toSave.id === 'new') toSave.id = generateId();
  adminState.id = toSave.id;

  // Deep-clone into state: silent saves (Ctrl+S, tab-switch) keep the form open,
  // and sharing the object meant later UNSAVED edits mutated state directly.
  const saved = JSON.parse(JSON.stringify(toSave));
  const exists = state.challenges.some(c => c.id === saved.id);
  if (!exists) {
    // A NEW program only. Editing one that is already here is fine in either
    // library -- a pack program keeps its pack id and cannot mix.
    if (typeof csCanAddHere === 'function' && !csCanAddHere('program')) return;
    state.challenges.push(saved);
  } else {
    state.challenges = state.challenges.map(c => c.id === saved.id ? saved : c);
  }

  saveData();
  // The program is filed now, so the folders it was filed into are no longer
  // provisional. This is what takes the X off them.
  _adminPendingFolders = [];
  setSaveStatus('admin-save-status', 'saved');
  if (opts.silent) {
    // Keep form open for autosave/silent saves
    window.adminIsDirty = false;
  } else {
    closeAdminForm();
    renderAdmin();
    window.adminIsDirty = false;
    showMessage("Success", "Program saved successfully.");
  }
  return true;
}

function deleteChallenge(id) {
  showConfirm("Delete Challenge", "Are you sure you want to delete this challenge program?", () => {
    if (adminState && adminState.id === id) closeAdminForm();
    softDeleteChallenge(id, () => renderAdmin());
  });
}

/* ============================================================
   SHARED HELPERS (used by all admin forms)
   ============================================================ */

// Save status indicator (text in form header)
function setSaveStatus(elId, status) {
  const el = document.getElementById(elId);
  if (!el) return;
  const map = {
    unsaved: { txt: 'Unsaved changes', cls: 'af-save-unsaved', icon: 'circle' },
    saving: { txt: 'Saving...', cls: 'af-save-saving', icon: 'loader' },
    saved: { txt: 'Saved', cls: 'af-save-saved', icon: 'check-circle' },
    '': { txt: '', cls: '', icon: '' }
  };
  const s = map[status] || map[''];
  el.className = 'af-save-status ' + s.cls;
  el.innerHTML = s.txt ? `<i data-lucide="${s.icon}" style="width:12px;height:12px;"></i> ${s.txt}` : '';
  if (typeof lucide !== 'undefined' && s.icon) lucide.createIcons({ el });
  if (status === 'saved') {
    setTimeout(() => {
      if (el.classList.contains('af-save-saved')) setSaveStatus(elId, '');
    }, 2200);
  }
}

// Tag suggestion list (frequent tags from existing items in scope)
function getTopTags(scope, limit) {
  const items = scope === 'challenge' ? (state.challenges || [])
               : scope === 'snippet' ? (state.snippets || [])
               : scope === 'notebook' ? (state.notebooks || [])
               : [];
  const counts = new Map();
  items.forEach(it => (it.tags || []).forEach(t => counts.set(t, (counts.get(t) || 0) + 1)));
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit || 8).map(([t]) => t);
}

function renderTagSuggestions(prefix, scope) {
  const container = document.getElementById(prefix + '-tag-suggestions');
  if (!container) return;
  const currentTags = (prefix === 'admin' ? adminState : prefix === 'study' ? studyModeState : notebookAdminState);
  if (!currentTags) { container.innerHTML = ''; return; }
  const existing = new Set(currentTags.tags || []);
  const suggestions = getTopTags(scope, 12).filter(t => !existing.has(t));
  if (suggestions.length === 0) { container.innerHTML = ''; return; }
  container.innerHTML = `<div class="af-tag-suggest-label">Quick add:</div>` + suggestions.map(t => `
    <button type="button" class="af-tag-suggest" onclick="addTagSuggestion('${prefix}', '${escapeHTML(t).replace(/'/g, "\\'")}')">${escapeHTML(t)}</button>
  `).join('');
}

function addTagSuggestion(prefix, tag) {
  const target = prefix === 'admin' ? adminState : prefix === 'study' ? studyModeState : notebookAdminState;
  if (!target) return;
  if (!target.tags) target.tags = [];
  if (!target.tags.includes(tag)) target.tags.push(tag);
  if (prefix === 'admin') {
    renderAdminTags(); renderTagSuggestions('admin', 'challenge');
    setSaveStatus('admin-save-status', 'unsaved');
  } else if (prefix === 'study') {
    renderStudyTags(); renderTagSuggestions('study', 'snippet');
    setSaveStatus('study-save-status', 'unsaved');
  } else if (prefix === 'notebook') {
    renderNotebookTags(); renderTagSuggestions('notebook', 'notebook');
    setSaveStatus('notebook-save-status', 'unsaved');
  }
  window.adminIsDirty = true;
}

// Visual validation error: shake + focus + scroll
function showValidationError(el, msg) {
  if (!el) return;
  el.classList.remove('error');
  void el.offsetWidth; // restart animation
  el.classList.add('error');
  setTimeout(() => el.classList.remove('error'), 1000);
  try { el.focus({ preventScroll: false }); } catch (e) { el.focus(); }
  try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
}

/* ============================================================
   KEYBOARD SHORTCUTS (Admin-wide)
   ============================================================ */
let _adminKeyHandler = null;

function bindAdminKeyboardShortcuts() {
  if (_adminKeyHandler) document.removeEventListener('keydown', _adminKeyHandler, true);
  _adminKeyHandler = function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      // Capture phase: intercept before CodeMirror / Quill can swallow the event
      e.preventDefault();
      e.stopPropagation();
      if (typeof window.saveCurrentAdminForm === 'function') {
        window.saveCurrentAdminForm({ silent: true });
      }
      return;
    }
    // Non-Ctrl+S shortcuts only run when not inside a focusable form field
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
      if (e.key === 'Escape') {
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      if (typeof openNewAdminItem === 'function') openNewAdminItem();
    } else if (e.key === 'Escape') {
      // Don't hijack Esc while a dialog is open — let the dialog's own handler take it.
      const dlg = document.getElementById('dialog-modal');
      if (dlg && !dlg.classList.contains('hidden')) return;
      const adminFrm = document.getElementById('admin-form-container');
      const studyFrm = document.getElementById('study-form-container');
      const nbFrm = document.getElementById('notebook-form-container');
      let target = null;
      if (adminFrm && !adminFrm.classList.contains('hidden')) target = [closeAdminForm, saveAdminForm];
      else if (studyFrm && !studyFrm.classList.contains('hidden')) target = [closeStudyForm, saveStudyForm];
      else if (nbFrm && !nbFrm.classList.contains('hidden')) target = [closeNotebookForm, saveNotebookForm];
      if (target) {
        // Consume the keystroke: the unsaved-changes dialog this may open would
        // otherwise be instantly closed by the global Esc-closes-modal handler.
        e.preventDefault();
        e.stopPropagation();
        confirmCloseAdminForm(target[0], target[1]);
      }
    }
  };
  // Use capture:true so this fires before CodeMirror/Quill keydown handlers
  document.addEventListener('keydown', _adminKeyHandler, true);
}

function unbindAdminKeyboardShortcuts() {
  if (_adminKeyHandler) {
    document.removeEventListener('keydown', _adminKeyHandler, true);
    _adminKeyHandler = null;
  }
}
