/* ============================================================
   ADMIN-SETS.JS — Practice Sets (multi-problem sessions)
   ------------------------------------------------------------
   A "practice set" bundles several problems into one CodeChum-style
   session: the student switches freely between them, runs / checks
   each one, then submits the whole attempt at the end.

   A problem is either:
     { id, source:'library', challengeId, variantId }
     { id, source:'manual', title, description, starterCode,
       referenceCode, tests:[{id,name,stdin,expected,hidden}] }
   ============================================================ */

let setBuilderState = null; // working copy while the builder modal is open

// ── Admin list (left pane card) ──
function renderAdminSets() {
  const host = document.getElementById('admin-sets-list');
  if (!host) return;
  const sets = state.codingSets || [];

  if (sets.length === 0) {
    host.innerHTML = '<p style="font-size:0.8rem; color:var(--text-tertiary); padding:0.25rem 0;">No practice sets yet. Create one below.</p>';
    return;
  }

  host.innerHTML = sets.map(s => {
    const n = (s.problems || []).length;
    const folder = s.parentId ? state.nodes.find(node => node.id === s.parentId) : null;
    const folderLabel = folder ? escapeHTML(folder.name) : 'Uncategorized';
    return `
      <div class="admin-set-row">
        <div class="admin-set-info">
          <div class="admin-set-title">${escapeHTML(s.title)}</div>
          <div class="admin-set-meta"><i data-lucide="folder" style="width:11px;height:11px;display:inline;vertical-align:-1px;"></i> ${folderLabel} · ${n} problem${n !== 1 ? 's' : ''}</div>
        </div>
        <button onclick="startCodingSet('${s.id}')" class="btn btn-practice btn-sm" title="Start session">
          <i data-lucide="play" style="width:13px;height:13px;fill:currentColor;"></i>
        </button>
        <button onclick="openSetBuilder('${s.id}')" class="btn btn-ghost btn-sm" title="Edit">
          <i data-lucide="pencil" style="width:14px;height:14px;"></i>
        </button>
        <button onclick="deleteCodingSet('${s.id}')" class="btn btn-ghost btn-sm" title="Delete">
          <i data-lucide="trash-2" style="width:14px;height:14px;color:var(--color-danger);"></i>
        </button>
      </div>`;
  }).join('');
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: host });
}

function deleteCodingSet(id) {
  const i = (state.codingSets || []).findIndex(s => s.id === id);
  if (i === -1) return;
  const set = state.codingSets[i];
  showConfirm('Delete Practice Set', `Delete "${escapeHTML(set.title)}"? Past attempt history is kept.`, () => {
    state.codingSets.splice(i, 1);
    saveData();
    renderAdminSets();
    // Every other thing you can delete in this app comes back from the undo
    // toast. A whole practice set was the one that did not.
    if (typeof pushUndo === 'function') {
      pushUndo('Deleted set "' + (set.title || 'Untitled') + '"', () => {
        if (!state.codingSets) state.codingSets = [];
        state.codingSets.splice(Math.min(i, state.codingSets.length), 0, set);
        saveData();
        renderAdminSets();
      });
    }
  });
}

function startCodingSet(id) {
  const set = (state.codingSets || []).find(s => s.id === id);
  if (!set || !(set.problems || []).length) {
    if (typeof showMessage === 'function') showMessage('Empty set', 'This practice set has no problems yet — edit it first.', true);
    return;
  }
  // Session Setup — optional time limit, mirroring the single-program attempt.
  openSetTimerModal(set);
}

/** Pre-start "Session Setup" modal for a practice set (set an optional time limit). */
function openSetTimerModal(set) {
  let overlay = document.getElementById('set-timer-overlay');
  if (overlay) overlay.remove();
  const n = (set.problems || []).length;
  overlay = document.createElement('div');
  overlay.id = 'set-timer-overlay';
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div class="modal-content">
      <div class="modal-icon"><i data-lucide="layout-grid" style="width:48px;height:48px;color:var(--color-accent);"></i></div>
      <h2 class="modal-title">Session Setup</h2>
      <p class="modal-desc" style="font-size:0.875rem;">${escapeHTML(set.title)} · ${n} problem${n !== 1 ? 's' : ''}. Set an optional time limit (0 = untimed).</p>
      <div style="display:flex; gap:0.5rem; margin-bottom:1.5rem; text-align:left;">
        <div style="flex:1;"><label class="form-label" for="set-timer-h" style="text-align:center;">Hours</label><input type="number" id="set-timer-h" min="0" value="0" class="form-input" style="text-align:center;" /></div>
        <div style="flex:1;"><label class="form-label" for="set-timer-m" style="text-align:center;">Mins</label><input type="number" id="set-timer-m" min="0" value="0" class="form-input" style="text-align:center;" /></div>
        <div style="flex:1;"><label class="form-label" for="set-timer-s" style="text-align:center;">Secs</label><input type="number" id="set-timer-s" min="0" value="0" class="form-input" style="text-align:center;" /></div>
      </div>
      <div class="modal-actions">
        <button onclick="document.getElementById('set-timer-overlay').remove()" class="btn btn-secondary">Cancel</button>
        <button onclick="confirmStartSet('${set.id}')" class="btn btn-primary"><i data-lucide="play" style="width:16px;height:16px;fill:currentColor;"></i> Start</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') overlay.remove();
    if (e.key === 'Enter') confirmStartSet(set.id);
  });
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: overlay });
  setTimeout(() => document.getElementById('set-timer-h')?.focus(), 50);
}

function confirmStartSet(id) {
  const h = parseInt(document.getElementById('set-timer-h')?.value) || 0;
  const m = parseInt(document.getElementById('set-timer-m')?.value) || 0;
  const s = parseInt(document.getElementById('set-timer-s')?.value) || 0;
  const total = (h * 3600) + (m * 60) + s;
  document.getElementById('set-timer-overlay')?.remove();
  // Explicit Start = a fresh session: drop any prior autosave so the timer
  // anchors to "now" (autosave-restore is only for an accidental refresh).
  clearSessionParam('psetAutosave');
  setSessionParam('activeCodingSet', id);
  setSessionParam('codingSetTimeLimit', total);
  spaNavigate('practice-set');
}

// ── Builder modal ──
function openSetBuilder(id) {
  if (id === 'new') {
    setBuilderState = { id: 'new', title: '', description: '', parentId: null, problems: [] };
  } else {
    const existing = (state.codingSets || []).find(s => s.id === id);
    if (!existing) return;
    setBuilderState = JSON.parse(JSON.stringify(existing));
    if (setBuilderState.parentId === undefined) setBuilderState.parentId = null;
  }

  // Build the challenge-scope folder options (sets live in the Coding Library tree).
  const folderOpts = [];
  (function buildFolderOpts(pid, depth) {
    getChildFolders(pid, 'challenge').forEach(f => {
      folderOpts.push({ id: f.id, label: '  '.repeat(depth) + f.name });
      buildFolderOpts(f.id, depth + 1);
    });
  })(null, 0);
  const folderOptionsHtml = `<option value="">Uncategorized</option>` +
    folderOpts.map(f => `<option value="${escapeHTML(f.id)}"${(setBuilderState.parentId || '') === f.id ? ' selected' : ''}>${escapeHTML(f.label)}</option>`).join('');

  let overlay = document.getElementById('set-builder-overlay');
  if (overlay) overlay.remove();
  overlay = document.createElement('div');
  overlay.id = 'set-builder-overlay';
  overlay.className = 'set-builder-overlay';
  overlay.innerHTML = `
    <div class="set-builder-window">
      <div class="set-builder-header">
        <h3><i data-lucide="layout-grid" style="width:18px;height:18px;color:var(--color-accent);"></i> ${id === 'new' ? 'New' : 'Edit'} Practice Set</h3>
        <button class="btn btn-ghost" onclick="closeSetBuilder()" aria-label="Close"><i data-lucide="x" style="width:18px;height:18px;"></i></button>
      </div>
      <div class="set-builder-body">
        <div class="af-field">
          <label class="form-label">Set Title</label>
          <input id="sb-title" class="form-input af-input-bold" placeholder="e.g. Week 3 Machine Problems" value="${escapeHTML(setBuilderState.title)}" oninput="setBuilderState.title = this.value" />
        </div>
        <div class="af-row-2" style="gap:0.75rem;">
          <div class="af-field" style="flex:2;">
            <label class="form-label">Description <span class="af-label-hint">(optional)</span></label>
            <input id="sb-desc" class="form-input" placeholder="What this session covers..." value="${escapeHTML(setBuilderState.description || '')}" oninput="setBuilderState.description = this.value" />
          </div>
          <div class="af-field" style="flex:1;">
            <label class="form-label"><i data-lucide="folder" class="af-label-icon"></i>Category <span class="af-label-hint">(Coding Library)</span></label>
            <select id="sb-category" class="hidden" aria-hidden="true" tabindex="-1">${folderOptionsHtml}</select>
            <div id="sb-category-cs"></div>
          </div>
        </div>

        <div class="af-field">
          <label class="form-label">Problems <span class="af-label-hint">(switch freely between these during the attempt)</span></label>
          <div id="sb-problems-list"></div>
        </div>

        <div class="sb-add-row">
          <div class="sb-add-library">
            <select id="sb-lib-challenge" class="form-select" onchange="_sbFillVariantSelect()"></select>
            <select id="sb-lib-variant" class="form-select"></select>
            <button id="sb-add-lib-btn" class="btn btn-secondary btn-sm" onclick="sbAddLibraryProblem()"><i data-lucide="plus" style="width:13px;height:13px;"></i> Add from library</button>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="sbAddManualProblem()" style="white-space:nowrap;">
            <i data-lucide="pen-line" style="width:13px;height:13px;"></i> Add manual problem
          </button>
        </div>
        <div id="sb-manual-form" class="hidden"></div>
      </div>
      <div class="set-builder-footer">
        <button class="btn btn-secondary" onclick="closeSetBuilder()">Cancel</button>
        <button class="btn btn-primary" onclick="saveSetBuilder()"><i data-lucide="save" style="width:15px;height:15px;"></i> Save Practice Set</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('keydown', e => { if (e.key === 'Escape') closeSetBuilder(); });

  _sbFillChallengeSelect();
  _sbRenderCategorySelect();
  renderSbProblems();
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: overlay });
  setTimeout(() => document.getElementById('sb-title')?.focus(), 50);
}

/* Same control and the same "make one right here" ability the program form
   has — the set builder was the one place still on a bare <select>, so filing a
   set into a new folder meant closing the dialog and losing the draft. */
let _sbPendingFolders = [];

function _sbSyncNativeCategory(value) {
  const el = document.getElementById('sb-category');
  if (!el) return;
  el.innerHTML = _adminFolderOpts()
    .map(o => `<option value="${escapeHTML(o.value)}">${escapeHTML(o.label || 'Uncategorized')}</option>`)
    .join('');
  el.value = value || '';
}

function _sbRenderCategorySelect() {
  if (typeof renderCustomSelect !== 'function' || !setBuilderState) return;
  renderCustomSelect('sb-category-cs', _adminFolderOpts(), setBuilderState.parentId || '', (val) => {
    setBuilderState.parentId = val || null;
    _sbSyncNativeCategory(val);
  }, 'Select category...', {
    createLabel: 'New category...',
    onCreate: () => _sbCreateCategory(),
    removable: (id) => _sbPendingFolders.includes(id),
    onRemove: (id) => _sbRemovePendingFolder(id)
  });
}

function _sbCreateCategory() {
  showInputDialog('New category', null, 'Category name', '', (name) => {
    const t = (name || '').trim();
    if (!t || !setBuilderState) return;
    const dupe = (state.nodes || []).some(n =>
      n.type === 'folder' && n.scope === 'challenge' && (n.name || '').toLowerCase() === t.toLowerCase());
    if (dupe) {
      if (typeof toast === 'function') toast('A category called "' + t + '" already exists.', { type: 'warning' });
      return;
    }
    const node = createNode(t, 'folder', null, 'challenge');
    if (!node) return;                 // refused: the pack is on screen
    _sbPendingFolders.push(node.id);
    setBuilderState.parentId = node.id;
    _sbSyncNativeCategory(node.id);
    _sbRenderCategorySelect();
    if (typeof toast === 'function') toast('Category "' + t + '" created.', { type: 'success' });
  });
}

function _sbRemovePendingFolder(id) {
  if (!_sbPendingFolders.includes(id)) return;
  const hasItems = (state.challenges || []).some(c => c.parentId === id) ||
                   (state.codingSets || []).some(x => x.parentId === id);
  if (hasItems) {
    if (typeof toast === 'function') toast('That category is not empty any more.', { type: 'warning' });
    _sbPendingFolders = _sbPendingFolders.filter(x => x !== id);
    _sbRenderCategorySelect();
    return;
  }
  state.nodes = (state.nodes || []).filter(n => n.id !== id);
  _sbPendingFolders = _sbPendingFolders.filter(x => x !== id);
  if (setBuilderState && setBuilderState.parentId === id) setBuilderState.parentId = null;
  saveData();
  _sbSyncNativeCategory(setBuilderState ? (setBuilderState.parentId || '') : '');
  _sbRenderCategorySelect();
  if (typeof renderAdmin === 'function') renderAdmin();
}

function closeSetBuilder() {
  setBuilderState = null;
  document.getElementById('set-builder-overlay')?.remove();
}

function _sbFillChallengeSelect() {
  const sel = document.getElementById('sb-lib-challenge');
  if (!sel) return;
  const list = state.challenges || [];
  sel.innerHTML = list.length
    ? list.map(c => `<option value="${c.id}">${escapeHTML(c.title)}</option>`).join('')
    : '<option value="">No programs in the library yet</option>';
  // Offering a control that cannot do anything is worse than not offering it:
  // with an empty library the button silently returned and nothing happened.
  sel.disabled = !list.length;
  _sbFillVariantSelect();
}

function _sbFillVariantSelect() {
  const chSel = document.getElementById('sb-lib-challenge');
  const vSel = document.getElementById('sb-lib-variant');
  const addBtn = document.getElementById('sb-add-lib-btn');
  if (!chSel || !vSel) return;
  const c = (state.challenges || []).find(ch => ch.id === chSel.value);
  const variants = c ? (c.variants || []) : [];
  // An empty <select> renders as a blank box with no hint that anything is
  // wrong. Say what is missing instead.
  vSel.innerHTML = variants.length
    ? variants.map(v => `<option value="${v.id}">${escapeHTML(v.name)}</option>`).join('')
    : `<option value="">${c ? 'This program has no versions' : 'No version'}</option>`;
  vSel.disabled = !variants.length;
  if (addBtn) {
    addBtn.disabled = !variants.length;
    addBtn.title = variants.length ? '' :
      (c ? 'Give this program a version in the Programs list first'
         : 'Add a program to the library, or use "Add manual problem"');
  }
}

function renderSbProblems() {
  const host = document.getElementById('sb-problems-list');
  if (!host || !setBuilderState) return;
  const probs = setBuilderState.problems || [];

  if (probs.length === 0) {
    host.innerHTML = '<p style="font-size:0.8rem; color:var(--text-tertiary); padding:0.5rem; border:1px dashed var(--border-color); border-radius:var(--radius-md); text-align:center;">No problems added yet — add at least one below.</p>';
    return;
  }

  host.innerHTML = probs.map((p, i) => {
    let title, sub;
    if (p.source === 'library') {
      const c = (state.challenges || []).find(ch => ch.id === p.challengeId);
      const v = c ? (c.variants || []).find(x => x.id === p.variantId) : null;
      title = c ? c.title : '⚠️ Missing program';
      sub = v ? v.name + ((v.tests || []).length ? ` · ${v.tests.length} tests` : ' · graded by reference') : 'version missing';
    } else {
      title = p.title || 'Untitled problem';
      sub = `Manual · ${(p.tests || []).length ? p.tests.length + ' tests' : (p.referenceCode || '').trim() ? 'graded by reference' : 'compile check only'}`;
    }
    return `
      <div class="sb-problem-row">
        <span class="sb-problem-num">${i + 1}</span>
        <span class="sb-problem-badge ${p.source}">${p.source === 'library' ? 'Library' : 'Manual'}</span>
        <div class="sb-problem-info">
          <div class="sb-problem-title">${escapeHTML(title)}</div>
          <div class="sb-problem-sub">${escapeHTML(sub)}</div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="sbMoveProblem(${i}, -1)" title="Move up" ${i === 0 ? 'disabled style="opacity:0.3;"' : ''}><i data-lucide="chevron-up" style="width:14px;height:14px;"></i></button>
        <button class="btn btn-ghost btn-sm" onclick="sbMoveProblem(${i}, 1)" title="Move down" ${i === probs.length - 1 ? 'disabled style="opacity:0.3;"' : ''}><i data-lucide="chevron-down" style="width:14px;height:14px;"></i></button>
        ${p.source === 'manual' ? `<button class="btn btn-ghost btn-sm" onclick="sbEditManualProblem(${i})" title="Edit"><i data-lucide="pencil" style="width:14px;height:14px;"></i></button>` : ''}
        <button class="btn btn-ghost btn-sm" onclick="sbRemoveProblem(${i})" title="Remove"><i data-lucide="x" style="width:14px;height:14px;color:var(--color-danger);"></i></button>
      </div>`;
  }).join('');
  const overlay = document.getElementById('set-builder-overlay');
  if (typeof lucide !== 'undefined' && overlay) lucide.createIcons({ root: overlay });
}

function sbAddLibraryProblem() {
  if (!setBuilderState) return;
  const chSel = document.getElementById('sb-lib-challenge');
  const vSel = document.getElementById('sb-lib-variant');
  if (!chSel || !chSel.value) return;
  const c = (state.challenges || []).find(ch => ch.id === chSel.value);
  if (!c) return;
  const vId = vSel && vSel.value ? vSel.value : (c.variants[0] && c.variants[0].id);
  if (!vId) {
    if (typeof toast === 'function') toast('That program has no versions to add.', { type: 'warning' });
    return;
  }
  const dupe = (setBuilderState.problems || []).some(pr =>
    pr.source === 'library' && pr.challengeId === c.id && pr.variantId === vId);
  if (dupe) {
    if (typeof toast === 'function') toast('That version is already in this set.', { type: 'warning' });
    return;
  }
  setBuilderState.problems.push({ id: generateId(), source: 'library', challengeId: c.id, variantId: vId });
  renderSbProblems();
}

function sbRemoveProblem(i) {
  if (!setBuilderState) return;
  setBuilderState.problems.splice(i, 1);
  renderSbProblems();
}

function sbMoveProblem(i, dir) {
  if (!setBuilderState) return;
  const j = i + dir;
  if (j < 0 || j >= setBuilderState.problems.length) return;
  const [p] = setBuilderState.problems.splice(i, 1);
  setBuilderState.problems.splice(j, 0, p);
  renderSbProblems();
}

// ── Manual problem sub-form ──
let _sbManualDraft = null;
let _sbManualEditIndex = -1; // -1 = adding new

function sbAddManualProblem() {
  _sbManualDraft = { id: generateId(), source: 'manual', title: '', description: '', starterCode: '', referenceCode: '', tests: [] };
  _sbManualEditIndex = -1;
  _renderSbManualForm();
}

function sbEditManualProblem(i) {
  if (!setBuilderState || !setBuilderState.problems[i]) return;
  _sbManualDraft = JSON.parse(JSON.stringify(setBuilderState.problems[i]));
  _sbManualEditIndex = i;
  _renderSbManualForm();
}

function _renderSbManualForm() {
  const host = document.getElementById('sb-manual-form');
  if (!host || !_sbManualDraft) return;
  host.classList.remove('hidden');
  const d = _sbManualDraft;

  host.innerHTML = `
    <div class="sb-manual-card">
      <div class="sb-manual-head">
        <strong>${_sbManualEditIndex >= 0 ? 'Edit' : 'New'} manual problem</strong>
        <button class="btn btn-ghost btn-sm" onclick="sbCancelManual()"><i data-lucide="x" style="width:14px;height:14px;"></i></button>
      </div>
      <div class="af-field"><label class="form-label">Problem Title</label>
        <input id="sbm-title" class="form-input" placeholder="e.g. FizzBuzz" value="${escapeHTML(d.title)}" oninput="_sbManualDraft.title = this.value" /></div>
      <div class="af-field"><label class="form-label">Description / Instructions</label>
        <textarea id="sbm-desc" class="form-textarea" rows="3" placeholder="What should the program do?" oninput="_sbManualDraft.description = this.value">${escapeHTML(d.description)}</textarea></div>
      <div class="af-row-2" style="gap:0.75rem;">
        <div class="af-field" style="flex:1;"><label class="form-label">Starter Code <span class="af-label-hint">(optional)</span></label>
          <textarea id="sbm-starter" class="form-textarea sb-code" rows="6" spellcheck="false" oninput="_sbManualDraft.starterCode = this.value">${escapeHTML(d.starterCode)}</textarea></div>
        <div class="af-field" style="flex:1;"><label class="form-label">Reference Solution <span class="af-label-hint">(optional — used for similarity grading if no tests)</span></label>
          <textarea id="sbm-ref" class="form-textarea sb-code" rows="6" spellcheck="false" oninput="_sbManualDraft.referenceCode = this.value">${escapeHTML(d.referenceCode)}</textarea></div>
      </div>
      <div class="af-field">
        <label class="form-label">Test Cases <span class="af-label-hint">(stdin → expected stdout; Check Code runs these)</span></label>
        <div id="sbm-tests"></div>
        <button class="btn btn-secondary btn-sm" onclick="sbmAddTest()" style="margin-top:0.5rem;"><i data-lucide="plus" style="width:13px;height:13px;"></i> Add Test Case</button>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:0.75rem;">
        <button class="btn btn-secondary btn-sm" onclick="sbCancelManual()">Cancel</button>
        <button class="btn btn-primary btn-sm" onclick="sbConfirmManual()"><i data-lucide="check" style="width:13px;height:13px;"></i> ${_sbManualEditIndex >= 0 ? 'Update' : 'Add'} Problem</button>
      </div>
    </div>
  `;
  _renderSbmTests();
  const overlay = document.getElementById('set-builder-overlay');
  if (typeof lucide !== 'undefined' && overlay) lucide.createIcons({ root: overlay });
  host.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function _renderSbmTests() {
  const host = document.getElementById('sbm-tests');
  if (!host || !_sbManualDraft) return;
  const tests = _sbManualDraft.tests || [];
  if (tests.length === 0) {
    host.innerHTML = '<p style="font-size:0.75rem;color:var(--text-tertiary);">No tests — the problem will be graded by reference similarity (or compile check).</p>';
    return;
  }
  host.innerHTML = tests.map((t, ti) => `
    <div class="sbm-test-row">
      <input class="form-input" placeholder="Name" value="${escapeHTML(t.name || '')}" oninput="_sbManualDraft.tests[${ti}].name = this.value" style="width:130px;" />
      <textarea class="form-textarea sb-code" rows="2" placeholder="stdin" oninput="_sbManualDraft.tests[${ti}].stdin = this.value">${escapeHTML(t.stdin || '')}</textarea>
      <textarea class="form-textarea sb-code" rows="2" placeholder="expected stdout" oninput="_sbManualDraft.tests[${ti}].expected = this.value">${escapeHTML(t.expected || '')}</textarea>
      <label class="sbm-hidden-toggle" title="Hidden tests don't reveal expected output to the student">
        <input type="checkbox" ${t.hidden ? 'checked' : ''} onchange="_sbManualDraft.tests[${ti}].hidden = this.checked" /> hidden
      </label>
      <button class="btn btn-ghost btn-sm" onclick="sbmRemoveTest(${ti})"><i data-lucide="trash-2" style="width:13px;height:13px;color:var(--color-danger);"></i></button>
    </div>
  `).join('');
  const overlay = document.getElementById('set-builder-overlay');
  if (typeof lucide !== 'undefined' && overlay) lucide.createIcons({ root: overlay });
}

function sbmAddTest() {
  if (!_sbManualDraft) return;
  if (!_sbManualDraft.tests) _sbManualDraft.tests = [];
  _sbManualDraft.tests.push({ id: generateId(), name: 'Case ' + (_sbManualDraft.tests.length + 1), stdin: '', expected: '', hidden: false });
  _renderSbmTests();
}

function sbmRemoveTest(ti) {
  if (!_sbManualDraft) return;
  _sbManualDraft.tests.splice(ti, 1);
  _renderSbmTests();
}

function sbCancelManual() {
  _sbManualDraft = null;
  _sbManualEditIndex = -1;
  const host = document.getElementById('sb-manual-form');
  if (host) { host.classList.add('hidden'); host.innerHTML = ''; }
}

function sbConfirmManual() {
  if (!_sbManualDraft || !setBuilderState) return;
  if (!(_sbManualDraft.title || '').trim()) {
    const t = document.getElementById('sbm-title');
    if (t && typeof showValidationError === 'function') showValidationError(t, 'Title required');
    return;
  }
  // Drop empty tests (no expected output)
  _sbManualDraft.tests = (_sbManualDraft.tests || []).filter(t => (t.expected || '').length > 0 || (t.stdin || '').length > 0);
  if (_sbManualEditIndex >= 0) setBuilderState.problems[_sbManualEditIndex] = _sbManualDraft;
  else setBuilderState.problems.push(_sbManualDraft);
  sbCancelManual();
  renderSbProblems();
}

function saveSetBuilder() {
  if (!setBuilderState) return;
  const titleEl = document.getElementById('sb-title');
  if (titleEl) setBuilderState.title = titleEl.value;
  const catEl = document.getElementById('sb-category');
  if (catEl) setBuilderState.parentId = catEl.value || null;

  if (!(setBuilderState.title || '').trim()) {
    if (titleEl && typeof showValidationError === 'function') showValidationError(titleEl, 'Title required');
    return;
  }
  if (!(setBuilderState.problems || []).length) {
    if (typeof showMessage === 'function') showMessage('No problems', 'Add at least one problem to the set.', true);
    return;
  }

  _sbPendingFolders = [];   // the set is filed now, so its folders are permanent
  if (setBuilderState.id === 'new') setBuilderState.id = generateId();
  if (!setBuilderState.createdAt) setBuilderState.createdAt = Date.now();
  const saved = JSON.parse(JSON.stringify(setBuilderState));

  if (!state.codingSets) state.codingSets = [];
  const idx = state.codingSets.findIndex(s => s.id === saved.id);
  if (idx !== -1) state.codingSets[idx] = saved;
  else state.codingSets.unshift(saved);

  saveData();
  closeSetBuilder();
  renderAdminSets();
  if (typeof adminRefreshCardsIfOpen === 'function') adminRefreshCardsIfOpen();
  if (typeof toast === 'function') toast('Practice set saved', { type: 'success' });
  else if (typeof showMessage === 'function') showMessage('Saved', 'Practice set saved.');
}
