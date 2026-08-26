/* ============================================================
   ADMIN-SNIPPETS.JS — Training Grounds: Snippets Admin
   ============================================================ */

let studyQuillEditor = null;
let studyCommentsQuillEditor = null;
let studyModeState = null;

function initQuill() {
  // After a route re-render the old Quill instances point at DETACHED DOM —
  // writes went to nowhere and the visible editors were dead. Recreate when stale.
  const stale = studyQuillEditor && (!studyQuillEditor.root || !studyQuillEditor.root.isConnected);
  if ((!studyQuillEditor || stale) && window.Quill && document.getElementById('study-desc-editor')) {
    studyQuillEditor = new Quill('#study-desc-editor', {
      theme: 'snow',
      modules: {
        toolbar: [
          ['bold', 'italic', 'underline', 'strike'],
          [{ 'color': [] }, { 'background': [] }],
          [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'indent': '-1' }, { 'indent': '+1' }],
          ['clean']
        ]
      }
    });

    studyQuillEditor.on('text-change', function (delta, oldDelta, source) {
      if (!studyModeState) return;
      studyModeState.description = studyQuillEditor.root.innerHTML;
      // Only user edits mark the form dirty — Quill also fires text-change while
      // we programmatically load content into a freshly-opened form.
      if (source !== 'user') return;
      window.adminIsDirty = true;
      if (typeof setSaveStatus === 'function') setSaveStatus('study-save-status', 'unsaved');
    });

    studyCommentsQuillEditor = new Quill('#study-comments-editor', {
      theme: 'snow',
      modules: {
        toolbar: [
          ['bold', 'italic', 'underline', 'strike'],
          [{ 'color': [] }, { 'background': [] }],
          [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'indent': '-1' }, { 'indent': '+1' }],
          ['image', 'clean']
        ]
      }
    });

    studyCommentsQuillEditor.on('text-change', function (delta, oldDelta, source) {
      if (!studyModeState) return;
      studyModeState.comments = studyCommentsQuillEditor.root.innerHTML;
      if (source !== 'user') return;
      window.adminIsDirty = true;
      if (typeof setSaveStatus === 'function') setSaveStatus('study-save-status', 'unsaved');
    });
  }
}

function renderStudyAdmin() {
  updateAdminFilter();

  const tbody = document.getElementById('study-table-body');
  if (!tbody) return;

  // Build snippet folder picker
  const sfpOpts = [];
  function buildSFP(pid, d) {
    getChildFolders(pid, 'snippet').forEach(f => {
      sfpOpts.push({ id: f.id, label: '  '.repeat(d) + f.name });
      buildSFP(f.id, d + 1);
    });
  }
  buildSFP(null, 0);

  if (!state.snippets || state.snippets.length === 0) {
    tbody.innerHTML = '<div class="empty-state" style="padding:2rem;"><p>No snippets inside Training Grounds.</p></div>';
  } else {
    let filteredSnippets = state.snippets;

    const searchInput = document.getElementById('admin-search-input');
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

    if (query) {
      filteredSnippets = filteredSnippets.filter(s => fuzzyMatch(s.title, query) || (s.tags || []).some(t => fuzzyMatch(t, query)));
    }

    if (adminCategoryFilter === '__uncategorized__') {
      filteredSnippets = filteredSnippets.filter(s => s.parentId === null || s.parentId === undefined);
    } else if (adminCategoryFilter !== 'All') {
      const fids = new Set();
      function collectSFIds(id) { fids.add(id); getChildFolders(id, 'snippet').forEach(cf => collectSFIds(cf.id)); }
      collectSFIds(adminCategoryFilter);
      filteredSnippets = filteredSnippets.filter(s => fids.has(s.parentId));
    }
    tbody.innerHTML = filteredSnippets.map(s => `
      <div class="admin-list-item${studyModeState && studyModeState.id === s.id ? ' active' : ''}"
        role="button" tabindex="0"
        onclick="document.querySelectorAll('.admin-list-item').forEach(el=>el.classList.remove('active'));this.classList.add('active');openStudyForm('${s.id}')"
        onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();document.querySelectorAll('.admin-list-item').forEach(el=>el.classList.remove('active'));this.classList.add('active');openStudyForm('${s.id}')}"
        aria-label="${escapeHTML(s.title)}">
        <div class="admin-list-item-left">
          <div class="admin-list-item-title">${escapeHTML(s.title)}</div>
          <div class="admin-list-item-meta">
            <span>${(s.examples || []).length} example${(s.examples || []).length !== 1 ? 's' : ''}</span>
            <span class="admin-list-item-dot" aria-hidden="true">·</span>
            <button onclick="event.stopPropagation(); openListItemFolderPicker('${s.id}', 'snippet', this)" class="ali-folder-btn" title="Move to folder" aria-label="Move to folder">
              <i data-lucide="folder" style="width:11px;height:11px;"></i>
              <span>${s.parentId ? escapeHTML((sfpOpts.find(f => f.id === s.parentId) || { label: 'Folder' }).label.trim()) : 'Uncategorized'}</span>
              <i data-lucide="chevron-down" style="width:10px;height:10px;opacity:0.6;"></i>
            </button>
          </div>
        </div>
        <div class="admin-list-item-actions">
          <button onclick="event.stopPropagation(); openStudyForm('${s.id}')" class="btn btn-ghost" title="Edit" aria-label="Edit ${escapeHTML(s.title)}">
            <i data-lucide="pencil" style="width:16px;height:16px;color:var(--color-primary);" aria-hidden="true"></i>
          </button>
          <button onclick="event.stopPropagation(); deleteStudySnippet('${s.id}')" class="btn btn-ghost" title="Delete" aria-label="Delete ${escapeHTML(s.title)}">
            <i data-lucide="trash-2" style="width:16px;height:16px;color:var(--color-danger);" aria-hidden="true"></i>
          </button>
        </div>
      </div>
    `).join('');
  }

  // Folder list (tree view)
  const catList = document.getElementById('study-category-list');
  if (catList) {
    catList.innerHTML = renderAdminFolderTree(null, 'snippet', 0);
    if (!catList.innerHTML) {
      catList.innerHTML = '<p style="font-size:0.8rem; color:var(--text-tertiary); padding:0.5rem;">No folders. Add one below.</p>';
    }
  }

  lucide.createIcons();
}

function openStudyForm(id) {
  // Hide Empty State, Show Study Form
  const emptyState = document.getElementById('admin-empty-state');
  if (emptyState) emptyState.classList.add('hidden');
  const formContainer = document.getElementById('study-form-container');
  if (formContainer) {
    formContainer.classList.remove('hidden');
    if (formContainer.parentElement) formContainer.parentElement.scrollTop = 0;
  }

  window.adminIsDirty = false;
  window.saveCurrentAdminForm = saveStudyForm;
  if (typeof setSaveStatus === 'function') setSaveStatus('study-save-status', '');

  initQuill();

  // Build folder picker for study form
  const catSelect = document.getElementById('study-category');
  const sFpOpts = [];
  function buildSFP2(pid, d) {
    getChildFolders(pid, 'snippet').forEach(f => {
      sFpOpts.push({ id: f.id, label: '  '.repeat(d) + f.name });
      buildSFP2(f.id, d + 1);
    });
  }
  buildSFP2(null, 0);
  catSelect.innerHTML = `<option value="">Uncategorized</option>` + sFpOpts.map(f => `<option value="${escapeHTML(f.id)}">${escapeHTML(f.label)}</option>`).join('');

  if (id === 'new') {
    const firstSnippetFolder = state.nodes.find(n => n.type === 'folder' && n.scope === 'snippet');
    studyModeState = {
      id: 'new', title: '', parentId: firstSnippetFolder ? firstSnippetFolder.id : null,
      description: '', comments: '', tags: [], relatedChallenges: [], starterCode: '',
      examples: [{ id: generateId(), name: 'Example 1', code: '', highlightLines: '' }],
      activeExampleIndex: 0, tryCodingTargetIndices: [0]
    };
  } else {
    const s = state.snippets.find(x => x.id === id);
    studyModeState = JSON.parse(JSON.stringify(s));
    if (!studyModeState.tags) studyModeState.tags = [];
    if (!studyModeState.relatedChallenges) studyModeState.relatedChallenges = [];
    if (!studyModeState.starterCode) studyModeState.starterCode = '';
    if (!studyModeState.examples) studyModeState.examples = [];
    if (!studyModeState.tryCodingTargetIndices) {
      studyModeState.tryCodingTargetIndices = [studyModeState.tryCodingExampleIndex || 0];
    }
    studyModeState.activeExampleIndex = 0;
  }

  document.getElementById('study-form-title').innerText = id === 'new' ? 'New Snippet' : 'Edit Snippet';
  document.getElementById('study-title').value = studyModeState.title;
  document.getElementById('study-category').value = studyModeState.parentId || '';
  const langEl = document.getElementById('study-language');
  if (langEl) langEl.value = studyModeState.language || '';
  document.getElementById('study-tag-input').value = '';

  // Render custom category dropdown
  if (typeof renderCustomSelect === 'function') {
    const _sFpOpts = [{ value: '', label: 'Uncategorized', icon: 'inbox' }].concat(
      sFpOpts.map(f => ({ value: f.id, label: f.label.trim(), icon: 'folder' }))
    );
    renderCustomSelect('study-category-cs', _sFpOpts, studyModeState.parentId || '', (val) => {
      studyModeState.parentId = val || null;
      document.getElementById('study-category').value = val;
      window.adminIsDirty = true;
      if (typeof setSaveStatus === 'function') setSaveStatus('study-save-status', 'unsaved');
    }, 'Select category...');
  }

  // Load via the Quill API with source 'silent' — writing root.innerHTML directly
  // is picked up by Quill's MutationObserver as a *user* edit, which marked every
  // freshly-opened form dirty and triggered spurious unsaved-changes prompts.
  if (studyQuillEditor) studyQuillEditor.clipboard.dangerouslyPasteHTML(studyModeState.description || '', 'silent');
  if (studyCommentsQuillEditor) studyCommentsQuillEditor.clipboard.dangerouslyPasteHTML(studyModeState.comments || '', 'silent');

  if (typeof loadSqlPracticeForm === 'function') loadSqlPracticeForm();

  // Setup Global Starter Code
  const gStarterTA = document.getElementById('study-global-starter-textarea');
  const gStarterPre = document.getElementById('study-global-starter-code');
  if (gStarterTA && gStarterPre) {
    gStarterTA.value = studyModeState.starterCode || '';
    gStarterPre.innerHTML = syntaxHighlight(studyModeState.starterCode || '') + '<br/>';
    if (typeof setupSpecificEditor === 'function') {
      setupSpecificEditor('study-global-starter-textarea', 'study-global-starter-pre', 'study-global-starter-code', false);
    }
    gStarterTA.addEventListener('input', (e) => {
      studyModeState.starterCode = e.target.value;
      if (typeof setSaveStatus === 'function') setSaveStatus('study-save-status', 'unsaved');
    });
  }

  renderStudyTags();
  if (typeof renderTagSuggestions === 'function') renderTagSuggestions('study', 'snippet');
  renderStudyRelatedChallenges();
  renderStudyExamplesForm();

  if (id === 'new') {
    setTimeout(() => document.getElementById('study-title')?.focus(), 60);
  }
}

function closeStudyForm() {
  const el = document.getElementById('study-form-container');
  if (el) el.classList.add('hidden');

  const emptyState = document.getElementById('admin-empty-state');
  if (emptyState) emptyState.classList.remove('hidden');

  studyModeState = null;
  window.adminIsDirty = false;
}

function saveStudyForm(opts = {}) {
  if (!studyModeState) return false;

  const titleEl = document.getElementById('study-title');
  const catEl = document.getElementById('study-category');
  const langSaveEl = document.getElementById('study-language');
  if (titleEl) studyModeState.title = titleEl.value;
  if (catEl) studyModeState.parentId = catEl.value || null;
  if (langSaveEl) studyModeState.language = langSaveEl.value.trim() || null;

  if (studyQuillEditor) studyModeState.description = studyQuillEditor.root.innerHTML;
  if (studyCommentsQuillEditor) studyModeState.comments = studyCommentsQuillEditor.root.innerHTML;

  const title = studyModeState.title.trim();
  if (!title) {
    if (typeof showValidationError === 'function') showValidationError(titleEl, "Snippet Title is required.");
    if (!opts.silent) showMessage("Error", "Snippet Title is required.", true);
    return false;
  }

  if (!state.snippets) state.snippets = [];

  // Drop Try Coding targets that point at examples with no target code —
  // they would grade the student against an empty string in snippet practice.
  if (Array.isArray(studyModeState.tryCodingTargetIndices)) {
    studyModeState.tryCodingTargetIndices = studyModeState.tryCodingTargetIndices
      .filter(i => studyModeState.examples[i] && (studyModeState.examples[i].code || '').trim() !== '');
  }

  // A case with no reference answer would mark the student wrong whatever they
  // wrote, and a set of nothing but empty cases should not offer an attempt at
  // all — same reasoning as the Try Coding targets above.
  if (studyModeState.sqlPractice) {
    const sp = studyModeState.sqlPractice;
    sp.cases = (sp.cases || []).filter(c => (c.prompt || '').trim() || (c.answer || '').trim());
    if (!sp.cases.length && !(sp.initSql || '').trim()) delete studyModeState.sqlPractice;
  }

  if (studyModeState.id === 'new') studyModeState.id = generateId();
  // Deep-clone into state: silent saves keep the form open, and sharing the
  // object meant later UNSAVED edits mutated state directly. Form-only fields
  // (activeExampleIndex) are stripped from the clone, not the live form state —
  // deleting them live broke the examples tabs after a Ctrl+S save.
  const savedSnippet = JSON.parse(JSON.stringify(studyModeState));
  delete savedSnippet.activeExampleIndex;
  delete savedSnippet.tryCodingExampleIndex;
  if (state.snippets.some(s => s.id === savedSnippet.id)) {
    state.snippets = state.snippets.map(s => s.id === savedSnippet.id ? savedSnippet : s);
  } else {
    state.snippets.push(savedSnippet);
  }

  saveData();
  if (typeof setSaveStatus === 'function') setSaveStatus('study-save-status', 'saved');
  if (opts.silent) {
    window.adminIsDirty = false;
  } else {
    closeStudyForm();
    renderStudyAdmin();
    window.adminIsDirty = false;
    showMessage("Success", "Snippet saved successfully.");
  }
  return true;
}

function deleteStudySnippet(id) {
  showConfirm("Delete Snippet", "Are you sure you want to delete this snippet?", () => {
    if (studyModeState && studyModeState.id === id) closeStudyForm();
    softDeleteSnippet(id, () => renderStudyAdmin());
  });
}

function addStudyCategory() {
  const input = document.getElementById('new-study-category-input');
  const val = input.value.trim();
  if (val) {
    createNode(val, 'folder', null, 'snippet');
    input.value = '';
    renderStudyAdmin();
  }
}

function removeStudyCategory(nodeId) {
  const folder = state.nodes.find(n => n.id === nodeId);
  if (!folder) return;
  showConfirm("Delete Folder", `Delete "${escapeHTML(folder.name)}"? Items will become uncategorized.`, () => {
    deleteNode(nodeId);
    renderStudyAdmin();
  });
}

function renderStudyTags() {
  if (!studyModeState) return;
  const container = document.getElementById('study-tags-list');
  if (!container) return;
  container.innerHTML = studyModeState.tags.map((t, idx) => `
    <span class="tag">
      ${escapeHTML(t)}
      <button onclick="removeStudyTag(${idx})" title="Remove tag" aria-label="Remove tag ${escapeHTML(t)}"><i data-lucide="x" style="width:12px;height:12px;"></i></button>
    </span>
  `).join('');
  lucide.createIcons({ el: container });
}

function handleStudyTagKeydown(ev) {
  if (ev.key === 'Enter') { ev.preventDefault(); addStudyTag(); return; }
  if (ev.key === ',') { ev.preventDefault(); addStudyTag(); return; }
  if (ev.key === 'Backspace' && !ev.target.value && studyModeState && studyModeState.tags.length > 0) {
    ev.preventDefault();
    studyModeState.tags.pop();
    renderStudyTags();
    window.adminIsDirty = true;
    if (typeof setSaveStatus === 'function') setSaveStatus('study-save-status', 'unsaved');
  }
}

function addStudyTag() {
  const input = document.getElementById('study-tag-input');
  if (!input) return;
  const raw = input.value.trim();
  if (!raw) return;
  raw.split(',').map(v => v.trim()).filter(v => v).forEach(val => {
    if (studyModeState && !studyModeState.tags.includes(val)) {
      studyModeState.tags.push(val);
    }
  });
  input.value = '';
  renderStudyTags();
  if (typeof renderTagSuggestions === 'function') renderTagSuggestions('study', 'snippet');
  window.adminIsDirty = true;
  if (typeof setSaveStatus === 'function') setSaveStatus('study-save-status', 'unsaved');
}

function removeStudyTag(idx) {
  studyModeState.tags.splice(idx, 1);
  renderStudyTags();
  if (typeof renderTagSuggestions === 'function') renderTagSuggestions('study', 'snippet');
  window.adminIsDirty = true;
  if (typeof setSaveStatus === 'function') setSaveStatus('study-save-status', 'unsaved');
}

// === Linked Related Challenges ===
function renderStudyRelatedChallenges() {
  if (!studyModeState) return;
  const selectList = document.getElementById('study-challenge-select');
  const container = document.getElementById('study-related-challenges-list');

  const available = state.challenges.filter(c => !(studyModeState.relatedChallenges || []).includes(c.id));

  if (selectList) {
    selectList.innerHTML = available.map(c => `<option value="${escapeHTML(c.id)}">${escapeHTML(c.title)}</option>`).join('');
  }

  if (container) {
    container.innerHTML = (studyModeState.relatedChallenges || []).map(id => {
      const c = state.challenges.find(ch => ch.id === id);
      if (!c) return '';
      return `
            <div class="af-linked-item">
              <i data-lucide="link-2" style="width:13px;height:13px;color:var(--color-primary);flex-shrink:0;"></i>
              <span class="af-linked-item-title">${escapeHTML(c.title)}</span>
              <button onclick="removeStudyRelatedChallenge('${id}')" class="btn btn-ghost btn-sm af-linked-remove" title="Unlink">
                <i data-lucide="x" style="width:14px;height:14px;"></i>
              </button>
            </div>
          `;
    }).join('');
    lucide.createIcons({ el: container });
  }
}

function addStudyRelatedChallenge() {
  const select = document.getElementById('study-challenge-select');
  if (select && select.value) {
    if (!studyModeState.relatedChallenges) studyModeState.relatedChallenges = [];
    studyModeState.relatedChallenges.push(select.value);
    renderStudyRelatedChallenges();
    window.adminIsDirty = true;
    if (typeof setSaveStatus === 'function') setSaveStatus('study-save-status', 'unsaved');
  }
}

function removeStudyRelatedChallenge(id) {
  if (!studyModeState.relatedChallenges) return;
  studyModeState.relatedChallenges = studyModeState.relatedChallenges.filter(cid => cid !== id);
  renderStudyRelatedChallenges();
  window.adminIsDirty = true;
  if (typeof setSaveStatus === 'function') setSaveStatus('study-save-status', 'unsaved');
}

// === Try Coding Target Manager ===
function updateTryCodingTargets(cb) {
  const idx = parseInt(cb.value);
  if (!studyModeState.tryCodingTargetIndices) {
    studyModeState.tryCodingTargetIndices = [studyModeState.tryCodingExampleIndex || 0];
  }
  if (cb.checked) {
    if (!studyModeState.tryCodingTargetIndices.includes(idx)) {
      studyModeState.tryCodingTargetIndices.push(idx);
    }
  } else {
    studyModeState.tryCodingTargetIndices = studyModeState.tryCodingTargetIndices.filter(i => i !== idx);
  }
  window.adminIsDirty = true;
  if (typeof setSaveStatus === 'function') setSaveStatus('study-save-status', 'unsaved');
}

// === Examples Form ===
function renderStudyExamplesForm() {
  if (!studyModeState) return;

  const tabsContainer = document.getElementById('study-examples-tabs');
  tabsContainer.innerHTML = studyModeState.examples.map((ex, i) => `
    <div onclick="switchStudyExampleTab(${i})" class="variant-tab ${i === studyModeState.activeExampleIndex ? 'active' : ''}">
      ${escapeHTML(ex.name || 'Unnamed')}
      <span onclick="event.stopPropagation(); removeStudyExample(${i})" class="variant-tab-close"><i data-lucide="x" style="width:12px;height:12px;"></i></span>
    </div>
  `).join('');

  const targetsContainer = document.getElementById('try-coding-targets-container');
  if (targetsContainer) {
    let targetIndices = studyModeState.tryCodingTargetIndices || [0];
    targetsContainer.innerHTML = studyModeState.examples.map((ex, i) => `
      <label class="af-try-target-pill">
        <input type="checkbox" value="${i}" onchange="updateTryCodingTargets(this)" ${targetIndices.includes(i) ? 'checked' : ''} />
        <span>${escapeHTML(ex.name || 'Example ' + (i + 1))}</span>
      </label>
    `).join('');
  }

  const activeIdx = studyModeState.activeExampleIndex;
  const activeEx = studyModeState.examples[activeIdx];
  const contentContainer = document.getElementById('study-examples-content');

  if (!activeEx) {
    contentContainer.innerHTML = '<p class="empty-state">No examples added.</p>';
    return;
  }

  contentContainer.innerHTML = `
    <div class="af-row-2">
      <div class="af-field af-field-wide">
        <label class="form-label">Example Name</label>
        <input value="${escapeHTML(activeEx.name)}" oninput="updateStudyExampleField('name', this.value)" class="form-input" />
      </div>
      <div class="af-field">
        <label class="form-label" title="Format: '3', '2-5', '1,4'">Highlight Lines</label>
        <input value="${escapeHTML(activeEx.highlightLines || '')}" oninput="updateStudyExampleField('highlightLines', this.value)" class="form-input" placeholder="e.g. 2-4" />
      </div>
    </div>

    <div style="display:flex; flex-direction:column; flex:1; min-height:220px;">
      <label class="form-label" style="color:var(--color-success);">Target Correct Code <span class="af-label-hint">(hidden solution)</span></label>
      <div class="editor-container" style="flex:1; border-color:var(--color-success);">
        <pre id="study-example-target-pre" class="editor-pre"><code id="study-example-target-code"></code></pre>
        <textarea id="study-example-target-textarea" spellcheck="false" class="editor-textarea" placeholder="function() { ... }"></textarea>
      </div>
    </div>
  `;

  const targetTA = document.getElementById('study-example-target-textarea');
  const targetPre = document.getElementById('study-example-target-code');
  targetTA.value = activeEx.code || '';
  targetPre.innerHTML = syntaxHighlight(activeEx.code || '') + '<br/>';
  if (typeof setupSpecificEditor === 'function') {
    setupSpecificEditor('study-example-target-textarea', 'study-example-target-pre', 'study-example-target-code', false);
  }
  const finalTargetTA = document.getElementById('study-example-target-textarea') || targetTA;
  finalTargetTA.addEventListener('input', (e) => updateStudyExampleField('code', e.target.value));

  lucide.createIcons();
}

function switchStudyExampleTab(idx) {
  studyModeState.activeExampleIndex = idx;
  renderStudyExamplesForm();
}

function addStudyExample() {
  studyModeState.examples.push({ id: generateId(), name: 'Example ' + (studyModeState.examples.length + 1), code: '', highlightLines: '' });
  studyModeState.activeExampleIndex = studyModeState.examples.length - 1;
  renderStudyExamplesForm();
  window.adminIsDirty = true;
  if (typeof setSaveStatus === 'function') setSaveStatus('study-save-status', 'unsaved');
}

function removeStudyExample(idx) {
  if (studyModeState.examples.length <= 1) {
    showMessage('Cannot remove', 'A snippet must have at least one example.', true);
    return;
  }
  studyModeState.examples.splice(idx, 1);
  studyModeState.activeExampleIndex = Math.max(0, studyModeState.activeExampleIndex - 1);
  if (studyModeState.tryCodingTargetIndices) {
    studyModeState.tryCodingTargetIndices = studyModeState.tryCodingTargetIndices
      .filter(i => i !== idx).map(i => i > idx ? i - 1 : i);
  }
  renderStudyExamplesForm();
  window.adminIsDirty = true;
  if (typeof setSaveStatus === 'function') setSaveStatus('study-save-status', 'unsaved');
}

function updateStudyExampleField(field, value) {
  if (studyModeState && studyModeState.examples[studyModeState.activeExampleIndex]) {
    studyModeState.examples[studyModeState.activeExampleIndex][field] = value;
    window.adminIsDirty = true;
    if (typeof setSaveStatus === 'function') setSaveStatus('study-save-status', 'unsaved');
    if (field === 'name') {
      const tabs = document.getElementById('study-examples-tabs');
      if (tabs && tabs.children[studyModeState.activeExampleIndex]) {
        tabs.children[studyModeState.activeExampleIndex].childNodes[0].nodeValue = " " + value + " ";
      }
      const targetsContainer = document.getElementById('try-coding-targets-container');
      if (targetsContainer) {
        let targetIndices = studyModeState.tryCodingTargetIndices || [0];
        targetsContainer.innerHTML = studyModeState.examples.map((ex, i) => `
          <label class="af-try-target-pill">
            <input type="checkbox" value="${i}" onchange="updateTryCodingTargets(this)" ${targetIndices.includes(i) ? 'checked' : ''} />
            <span>${escapeHTML(ex.name || 'Example ' + (i + 1))}</span>
          </label>
        `).join('');
      }
    }
  }
}

/* ── Authoring a SQL practice set ─────────────────────────────
   The same shape the coding library's test cases use — a numbered list of
   cards you can add to, reorder, duplicate and delete — so the two editors
   behave the same way. Each case is a question and the reference answer that
   Check Code compares against.

   It hangs off the snippet rather than being its own entity: a snippet is
   already the thing that carries a schema, an explanation and examples, and a
   practice set for it is one more facet of the same subject. */

function _sqlState() {
  if (typeof studyModeState === 'undefined' || !studyModeState) return null;
  if (!studyModeState.sqlPractice) {
    studyModeState.sqlPractice = { dialect: 'MySQL', initSql: '', cases: [] };
  }
  if (!Array.isArray(studyModeState.sqlPractice.cases)) studyModeState.sqlPractice.cases = [];
  return studyModeState.sqlPractice;
}

function _sqlDirty() {
  window.adminIsDirty = true;
  if (typeof setSaveStatus === 'function') setSaveStatus('study-save-status', 'unsaved');
}

window.sqlSetDialect = function (v) {
  const p = _sqlState(); if (!p) return;
  p.dialect = v; _sqlDirty();
};

window.sqlSetInit = function (v) {
  const p = _sqlState(); if (!p) return;
  p.initSql = v; _sqlDirty();
};

window.sqlAddCase = function () {
  const p = _sqlState(); if (!p) return;
  p.cases.push({
    id: typeof generateId === 'function' ? generateId() : String(Date.now()),
    prompt: '', answer: ''
  });
  _sqlDirty();
  renderSqlCases();
};

window.sqlDeleteCase = function (i) {
  const p = _sqlState(); if (!p || !p.cases[i]) return;
  const go = () => { p.cases.splice(i, 1); _sqlDirty(); renderSqlCases(); };
  // Only worth confirming once something would actually be lost.
  const filled = (p.cases[i].prompt || '').trim() || (p.cases[i].answer || '').trim();
  if (filled && typeof showConfirm === 'function') {
    showConfirm('Delete case ' + (i + 1) + '?', 'Its question and answer will be removed.', go);
  } else { go(); }
};

window.sqlMoveCase = function (i, delta) {
  const p = _sqlState(); if (!p) return;
  const to = i + delta;
  if (to < 0 || to >= p.cases.length) return;
  const [row] = p.cases.splice(i, 1);
  p.cases.splice(to, 0, row);
  _sqlDirty();
  renderSqlCases();
};

window.sqlDuplicateCase = function (i) {
  const p = _sqlState(); if (!p || !p.cases[i]) return;
  const copy = JSON.parse(JSON.stringify(p.cases[i]));
  copy.id = typeof generateId === 'function' ? generateId() : String(Date.now());
  p.cases.splice(i + 1, 0, copy);
  _sqlDirty();
  renderSqlCases();
};

window.sqlUpdateCase = function (i, field, v) {
  const p = _sqlState(); if (!p || !p.cases[i]) return;
  p.cases[i][field] = v;
  _sqlDirty();
};

function renderSqlCases() {
  const host = document.getElementById('sql-cases-list');
  const p = _sqlState();
  if (!host || !p) return;

  if (!p.cases.length) {
    host.innerHTML = `
      <div class="sqladm-empty">
        <i data-lucide="database"></i>
        <p>No cases yet. Each one becomes a numbered answer box in the attempt.</p>
      </div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons({ el: host });
    return;
  }

  host.innerHTML = p.cases.map((c, i) => `
    <div class="sample-item sqladm-case" data-case-idx="${i}" style="flex-direction:column; align-items:stretch; gap:0.5rem;">
      <div style="display:flex; gap:0.5rem; align-items:center;">
        <span class="af-move">
          <button onclick="sqlMoveCase(${i}, -1)" ${i === 0 ? 'disabled' : ''} title="Move up"><i data-lucide="chevron-up"></i></button>
          <button onclick="sqlMoveCase(${i}, 1)" ${i === p.cases.length - 1 ? 'disabled' : ''} title="Move down"><i data-lucide="chevron-down"></i></button>
        </span>
        <span class="sqladm-num">Test Case ${i + 1}</span>
        <span style="flex:1;"></span>
        <button onclick="sqlDuplicateCase(${i})" class="btn btn-ghost" style="padding:0.25rem;" title="Duplicate this case">
          <i data-lucide="copy" style="width:15px;height:15px;color:var(--text-tertiary);"></i>
        </button>
        <button onclick="sqlDeleteCase(${i})" class="btn btn-ghost" style="padding:0.25rem;" title="Delete this case">
          <i data-lucide="trash-2" style="width:15px;height:15px;color:var(--color-danger);"></i>
        </button>
      </div>
      <div style="display:flex; flex-direction:column; gap:0.2rem;">
        <label class="form-label" style="margin-bottom:0;">Question <span class="af-req${(c.prompt || '').trim() ? ' is-filled' : ''}">*</span></label>
        <textarea rows="2" class="form-textarea af-grow" style="min-height:44px;"
                  placeholder="What should the student write? e.g. Show all suspects never mentioned in transcripts"
                  oninput="sqlUpdateCase(${i}, 'prompt', this.value); afAutosize(this); sqlMarkReq(this)">${escapeHTML(c.prompt || '')}</textarea>
      </div>
      <div style="display:flex; flex-direction:column; gap:0.2rem;">
        <label class="form-label" style="margin-bottom:0;">Reference answer <span class="af-req${(c.answer || '').trim() ? ' is-filled' : ''}">*</span></label>
        <textarea rows="3" class="form-textarea af-grow af-code-field" style="min-height:54px;"
                  placeholder="SELECT ..."
                  oninput="sqlUpdateCase(${i}, 'answer', this.value); afAutosize(this); sqlMarkReq(this)">${escapeHTML(c.answer || '')}</textarea>
      </div>
    </div>`).join('');

  if (typeof lucide !== 'undefined') lucide.createIcons({ el: host });
  if (typeof afAutosizeAll === 'function') afAutosizeAll(host);
}
window.renderSqlCases = renderSqlCases;

/* The asterisks here are per-field rather than driven by afUpdateRequiredMarks,
   which keys off element ids — these boxes are a repeating list and have none. */
window.sqlMarkReq = function (el) {
  const wrap = el && el.parentElement;
  const mark = wrap && wrap.querySelector('.af-req');
  if (mark) mark.classList.toggle('is-filled', !!el.value.trim());
};

/** Fill the section from the snippet being edited. */
function loadSqlPracticeForm() {
  const p = _sqlState();
  if (!p) return;
  const d = document.getElementById('sql-dialect');
  if (d) d.value = p.dialect || 'MySQL';
  const init = document.getElementById('sql-init');
  if (init) {
    init.value = p.initSql || '';
    if (typeof afAutosize === 'function') afAutosize(init);
  }
  renderSqlCases();
}
window.loadSqlPracticeForm = loadSqlPracticeForm;
