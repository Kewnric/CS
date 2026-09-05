/* ============================================================
   ADMIN-VARIANTS.JS — Variant Tabs, File Tabs, Editors, Samples
   ============================================================ */

function renderAdminVariantForm() {
  if (!adminState || !adminState.variants) return;
  // An expanded editor lives in the overlay, not in the form. Redrawing without
  // putting it back left the old node orphaned there while a fresh one appeared
  // in the form — two elements sharing an id, and typing in the wrong one.
  if (typeof afCollapseEditor === 'function') afCollapseEditor();

  const tabsContainer = document.getElementById('admin-variant-tabs');
  tabsContainer.innerHTML = adminState.variants.map((v, i) => `
    <div onclick="switchAdminVariant(${i})" class="variant-tab ${i === adminState.activeVariantIndex ? 'active' : ''}">
      ${escapeHTML(v.name || 'Unnamed')}
      ${adminState.variants.length > 1 ? `<span onclick="event.stopPropagation(); deleteAdminVariant(${i})" class="variant-tab-close"><i data-lucide="x" style="width:12px;height:12px;"></i></span>` : ''}
    </div>
  `).join('');

  const activeVar = adminState.variants[adminState.activeVariantIndex];
  if (!activeVar.files || activeVar.files.length === 0) {
    activeVar.files = [{ id: generateId(), name: 'main', ext: '.c', starterCode: activeVar.starterCode || '', code: activeVar.code || '' }];
  }
  if (typeof activeVar.activeFileIndex !== 'number') activeVar.activeFileIndex = 0;
  if (!activeVar.tests) activeVar.tests = [];
  if (!activeVar.minRequirements) activeVar.minRequirements = [];
  const activeFile = activeVar.files[activeVar.activeFileIndex];

  function fileTabsHTML(prefix, actionAdd) {
    return `<div class="file-tab-bar">
      ${activeVar.files.map((f, fi) => `
        <div class="file-tab ${fi === activeVar.activeFileIndex ? 'active' : ''}${f.locked ? ' is-locked' : ''}" onclick="adminSwitchFile(${fi})">
          <span class="file-tab-name">${escapeHTML(f.name + f.ext)}</span>
          <span class="file-tab-lockbtn" onclick="event.stopPropagation(); adminToggleFileLock(${fi})"
                title="${f.locked ? 'Given to the student — read only. Click to unlock.' : 'Click to lock: the student can read it but not edit it.'}">
            <i data-lucide="${f.locked ? 'lock' : 'unlock'}" style="width:11px;height:11px;"></i>
          </span>
          ${activeVar.files.length > 1 ? `<span class="file-tab-x" onclick="event.stopPropagation(); adminDeleteFile(${fi})">×</span>` : ''}
        </div>
      `).join('')}
      <button class="file-tab-add" onclick="adminAddFile(this)" title="Add File"><i data-lucide="plus" style="width:13px;height:13px;"></i></button>
    </div>`;
  }

  const contentContainer = document.getElementById('admin-variant-content');

  contentContainer.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:0.875rem;">
      <div data-step="2">
        <label class="form-label">Version Name <span class="af-req" data-req-for="admin-variant-name">*</span></label>
        <input id="admin-variant-name" value="${escapeHTML(activeVar.name)}" oninput="updateActiveVariantField('name', this.value)" class="form-input" />
      </div>
      <div data-step="2" class="af-rich-block">
        <label class="form-label-inline"><span>Instruction / Description <span class="af-req" data-req-for="admin-variant-desc">*</span></span></label>
        <div class="af-rich" id="admin-variant-desc-editor"></div>
        <!-- The value that is actually saved. Everything else in this form finds
             a field by id and reads .value, so the editor writes through to a
             real field rather than teaching every one of those places about
             Quill. It is also the fallback if the Quill CDN has not loaded. -->
        <textarea id="admin-variant-desc" class="af-rich-value" rows="3"
                  oninput="updateActiveVariantField('description', this.value)"
                  >${escapeHTML(activeVar.description || '')}</textarea>
      </div>

      <div data-step="2" style="display:flex; flex-direction:column; flex:1; min-height:220px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
          <label class="form-label" style="color:var(--color-accent); margin-bottom:0;">Starter Code <span style="font-weight:400; font-size:0.75rem; opacity:0.7;">(pre-filled for user)</span></label>
          <button type="button" class="af-expand-btn" onclick="afExpandEditor('starter')"
                  title="Open this editor full screen" aria-label="Expand Starter Code">
            <i data-lucide="maximize-2"></i>
          </button>
        </div>
        ${fileTabsHTML('starter')}
        <div class="editor-container" style="flex:1; border-color:var(--color-accent); border-top:none; border-radius:0 0 var(--radius-md) var(--radius-md);">
          <pre id="admin-starter-pre" class="editor-pre"><code id="admin-starter-code"></code></pre>
          <textarea id="admin-starter-ta" spellcheck="false" class="editor-textarea" placeholder="// Add starter boilerplate here..."></textarea>
        </div>
      </div>

      <div data-step="2" style="display:flex; flex-direction:column; flex:1; min-height:240px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
          <label class="form-label" style="color:var(--color-success); margin-bottom:0;">Target Code <span class="af-req" data-req-for="admin-target-ta">*</span> <span style="font-weight:400; font-size:0.75rem; opacity:0.7;">(hidden solution)</span></label>
          <button type="button" class="af-expand-btn" onclick="afExpandEditor('target')"
                  title="Open this editor full screen" aria-label="Expand Target Code">
            <i data-lucide="maximize-2"></i>
          </button>
        </div>
        ${fileTabsHTML('target')}
        <div class="editor-container" style="flex:1; border-color:var(--color-success); border-top:none; border-radius:0 0 var(--radius-md) var(--radius-md);">
          <pre id="admin-target-pre" class="editor-pre"><code id="admin-target-code"></code></pre>
          <textarea id="admin-target-ta" spellcheck="false" class="editor-textarea" placeholder="// Target code for this file..."></textarea>
        </div>
      </div>

      <div data-step="2">
        <label class="form-label">Hints <span style="font-weight:400; font-size:0.75rem; opacity:0.7;">(one per line, revealed progressively during practice, -5% each)</span></label>
        <textarea rows="3" oninput="updateActiveVariantField('hints', this.value.split('\\n').filter(h => h.trim()))" class="form-textarea" style="font-size:0.8125rem;" placeholder="First hint...\nSecond hint...\nThird hint...">${escapeHTML((activeVar.hints || []).join('\n'))}</textarea>
      </div>

      <div class="divider" data-step="3"></div>

      <div data-step="3" style="display:flex; justify-content:space-between; align-items:center;">
        <label class="form-label" style="margin-bottom:0;">Sample Outputs</label>
        <button onclick="addAdminSample()" class="btn btn-ghost btn-sm" style="color:var(--color-primary); font-weight:600;">
          <i data-lucide="plus-circle" style="width:14px;height:14px;"></i> Add Sample
        </button>
      </div>
      <div id="admin-samples-list" data-step="3" style="display:flex; flex-direction:column; gap:0.75rem;">
        ${activeVar.samples.map((s, sampleIdx) => `
          <div class="sample-item">
            <div style="flex:1; display:flex; flex-direction:column; gap:0.5rem;">
              <input value="${escapeHTML(s.title || '')}" oninput="updateSampleField(${sampleIdx}, 'title', this.value)" placeholder="Sample Title" class="form-input" style="font-weight:600; font-size:0.8125rem; padding:0.375rem 0.5rem;" />
              <div class="stb-wrap">
                ${typeof sampleFieldHTML === 'function' ? sampleFieldHTML('admin-sample-body-' + sampleIdx, s) : ''}
              </div>
            </div>
            <button onclick="deleteAdminSample(${sampleIdx})" class="btn btn-ghost" style="padding:0.25rem;" title="Delete Sample">
              <i data-lucide="trash-2" style="width:16px;height:16px;color:var(--color-danger);"></i>
            </button>
          </div>
        `).join('') + (activeVar.samples.length === 0 ? '<p style="font-size:0.75rem; color:var(--text-tertiary); font-style:italic;">No samples added.</p>' : '')}
      </div>

      <div class="divider" data-step="3"></div>

      <div data-step="3" style="display:flex; justify-content:space-between; align-items:center;">
        <label class="form-label" style="margin-bottom:0; display:flex; align-items:center; gap:0.4rem;">
          <i data-lucide="list-checks" style="width:14px;height:14px;color:var(--color-warning);"></i> Minimum Requirements
          <span style="font-weight:400; font-size:0.72rem; opacity:0.7;">(constructs the student's code must use)</span>
        </label>
        <button onclick="addAdminMinReq()" class="btn btn-ghost btn-sm" style="color:var(--color-warning); font-weight:600;">
          <i data-lucide="plus-circle" style="width:14px;height:14px;"></i> Add Requirement
        </button>
      </div>
      <div id="admin-minreq-list" data-step="3" style="display:flex; flex-direction:column; gap:0.5rem;">
        ${(activeVar.minRequirements || []).map((r, ri) => `
          <div class="sample-item" style="align-items:center; gap:0.5rem;">
            <i data-lucide="circle-dot" style="width:14px;height:14px;color:var(--color-warning);flex-shrink:0;"></i>
            <select onchange="updateMinReqField(${ri}, this.value)" class="form-select" style="flex:1; font-size:0.8125rem; padding:0.375rem 0.5rem;">
              ${MIN_REQ_DEFS.map(d => `<option value="${d.type}" ${r.type === d.type ? 'selected' : ''}>${escapeHTML(d.label)}</option>`).join('')}
            </select>
            <button onclick="deleteAdminMinReq(${ri})" class="btn btn-ghost" style="padding:0.25rem;" title="Remove requirement">
              <i data-lucide="trash-2" style="width:16px;height:16px;color:var(--color-danger);"></i>
            </button>
          </div>
        `).join('') + ((activeVar.minRequirements || []).length === 0 ? '<p style="font-size:0.75rem; color:var(--text-tertiary); font-style:italic;">No requirements — the student can solve it any way. Add one to require a specific construct.</p>' : '')}
      </div>

      <div class="divider" data-step="3"></div>

      <div data-step="3" style="display:flex; justify-content:space-between; align-items:center;">
        <label class="form-label" style="margin-bottom:0; display:flex; align-items:center; gap:0.4rem;">
          <i data-lucide="check-circle" style="width:14px;height:14px;color:var(--color-success);"></i> Test Cases
          <span style="font-weight:400; font-size:0.72rem; opacity:0.7;">(run on Submit — score becomes pass rate)</span>
        </label>
        <div style="display:flex; gap:0.4rem; align-items:center;">
          <button onclick="afBulkAddTests()" class="btn btn-ghost btn-sm" style="color:var(--color-primary); font-weight:600;" title="Paste several tests at once">
          <i data-lucide="clipboard-paste" style="width:14px;height:14px;"></i> Paste tests
        </button>
        <button onclick="adminVerifySolution()" id="admin-verify-btn" class="btn btn-ghost btn-sm" style="color:var(--color-success); font-weight:600;" title="Compile & run the Target Code against every test case to catch authoring mistakes before students see them.">
            <i data-lucide="shield-check" style="width:14px;height:14px;"></i> Verify Solution
          </button>
          <button onclick="addAdminTest()" class="btn btn-ghost btn-sm" style="color:var(--color-primary); font-weight:600;">
            <i data-lucide="plus-circle" style="width:14px;height:14px;"></i> Add Test
          </button>
        </div>
      </div>
      <div id="admin-verify-results"></div>
      <div id="admin-tests-list" data-step="3" style="display:flex; flex-direction:column; gap:0.75rem;">
        ${(activeVar.tests || []).map((t, ti) => `
          <div class="sample-item" data-test-idx="${ti}" style="flex-direction:column; align-items:stretch; gap:0.5rem;">
            <div style="display:flex; gap:0.5rem; align-items:center;">
              <span class="af-move">
                <button onclick="afMoveTest(${ti}, -1)" ${ti === 0 ? 'disabled' : ''} title="Move up"><i data-lucide="chevron-up"></i></button>
                <button onclick="afMoveTest(${ti}, 1)" ${ti === (activeVar.tests || []).length - 1 ? 'disabled' : ''} title="Move down"><i data-lucide="chevron-down"></i></button>
              </span>
              <input value="${escapeHTML(t.name || '')}" oninput="updateTestField(${ti}, 'name', this.value)" placeholder="Test name (e.g. Case 1)" class="form-input" style="font-weight:600; font-size:0.8125rem; padding:0.375rem 0.5rem; flex:1;" />
              <label style="display:flex; align-items:center; gap:0.3rem; font-size:0.72rem; color:var(--text-tertiary); white-space:nowrap; cursor:pointer;" title="Hidden tests still count toward the score, but the student doesn't see their input/expected output.">
                <input type="checkbox" ${t.hidden ? 'checked' : ''} onchange="updateTestField(${ti}, 'hidden', this.checked)" /> Hidden
              </label>
              <button onclick="afDuplicateTest(${ti})" class="btn btn-ghost" style="padding:0.25rem;" title="Duplicate this test">
                <i data-lucide="copy" style="width:15px;height:15px;color:var(--text-tertiary);"></i>
              </button>
              <button onclick="adminAutofillExpected(${ti})" class="btn btn-ghost" style="padding:0.25rem;" title="Auto-fill: run the Target Code with this test's stdin and use its output as the expected stdout.">
                <i data-lucide="wand-2" style="width:16px;height:16px;color:var(--color-accent);"></i>
              </button>
              <button onclick="deleteAdminTest(${ti})" class="btn btn-ghost" style="padding:0.25rem;" title="Delete test">
                <i data-lucide="trash-2" style="width:16px;height:16px;color:var(--color-danger);"></i>
              </button>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem;">
              <div style="display:flex; flex-direction:column; gap:0.2rem;">
                <span style="font-size:0.68rem; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:0.03em;">Stdin (input)</span>
                <textarea rows="3" oninput="updateTestField(${ti}, 'stdin', this.value)" placeholder="(optional)" class="form-textarea af-grow af-code-field" style="min-height:54px;">${escapeHTML(t.stdin || '')}</textarea>
              </div>
              <div style="display:flex; flex-direction:column; gap:0.2rem;">
                <span style="font-size:0.68rem; color:var(--color-success); text-transform:uppercase; letter-spacing:0.03em;">Expected stdout</span>
                <textarea rows="3" oninput="updateTestField(${ti}, 'expected', this.value)" placeholder="Exact expected output" class="form-textarea af-grow af-code-field" style="min-height:54px;">${escapeHTML(t.expected || '')}</textarea>
              </div>
            </div>
          </div>
        `).join('') + ((activeVar.tests || []).length === 0 ? '<p style="font-size:0.75rem; color:var(--text-tertiary); font-style:italic;">No test cases — submissions are graded by reference-code match. Add a test to grade by running the code.</p>' : '')}
      </div>
    </div>
  `;

  // Initialize Starter Code Editor for active file
  const starterTA = document.getElementById('admin-starter-ta');
  const starterPre = document.getElementById('admin-starter-code');
  starterTA.value = activeFile.starterCode || '';
  starterPre.innerHTML = syntaxHighlight(activeFile.starterCode || '') + '<br/>';
  starterTA.oninput = function() {
    activeFile.starterCode = this.value;
    starterPre.innerHTML = syntaxHighlight(this.value) + '<br/>';
    // Keep legacy field in sync with first file
    if (activeVar.activeFileIndex === 0) activeVar.starterCode = this.value;
    _adminMarkDirty();
  };
  if (typeof setupSpecificEditor === 'function') {
    setupSpecificEditor('admin-starter-ta', 'admin-starter-pre', 'admin-starter-code', false, null);
  }

  // Redrawing rebuilds the step-tagged blocks, so whichever step is open has
  // to be re-applied or every block would come back visible at once.
  if (typeof afGoToStep === 'function' && typeof _afStep !== 'undefined') afGoToStep(_afStep);
  if (typeof afUpdateRequiredMarks === 'function') afUpdateRequiredMarks();
  if (typeof afAutosizeAll === 'function') afAutosizeAll(document.getElementById('admin-variant-content'));
  afInitDescEditor();

  // Initialize Target Code Editor for active file
  const targetTA = document.getElementById('admin-target-ta');
  const targetPre = document.getElementById('admin-target-code');
  targetTA.value = activeFile.code || '';
  targetPre.innerHTML = syntaxHighlight(activeFile.code || '') + '<br/>';
  targetTA.oninput = function() {
    activeFile.code = this.value;
    targetPre.innerHTML = syntaxHighlight(this.value) + '<br/>';
    // Keep legacy field in sync with first file
    if (activeVar.activeFileIndex === 0) activeVar.code = this.value;
    _adminMarkDirty();
  };
  if (typeof setupSpecificEditor === 'function') {
    setupSpecificEditor('admin-target-ta', 'admin-target-pre', 'admin-target-code', false, null);
  }

  lucide.createIcons();

  // The form is rebuilt wholesale, so every sample field is a fresh element
  // needing its highlighted backdrop back.
  _adminWireSampleEditors();
}

function switchAdminVariant(idx) {
  adminState.activeVariantIndex = idx;
  renderAdminVariantForm();
}

function addAdminVariant() {
  const vLen = adminState.variants.length + 1;
  adminState.variants.push({
    id: generateId(),
    name: `Version ${vLen}`,
    description: '',
    starterCode: '',
    code: '',
    activeFileIndex: 0,
    files: [{ id: generateId(), name: 'main', ext: '.c', starterCode: '', code: '' }],
    samples: [],
    tests: []
  });
  adminState.activeVariantIndex = adminState.variants.length - 1;
  _adminMarkDirty();
  renderAdminVariantForm();
}

/**
 * Lock or unlock one file.
 *
 * A locked file is handout material -- a header, a driver, the utilities --
 * that the student reads but cannot edit, rename or delete. Marking them is
 * what turns a pile of files into an exercise with an obvious place to work.
 */
function adminToggleFileLock(fi) {
  const v = adminState.variants[adminState.activeVariantIndex];
  if (!v || !v.files || !v.files[fi]) return;
  v.files[fi].locked = !v.files[fi].locked;
  if (typeof _adminMarkDirty === 'function') _adminMarkDirty();
  if (typeof renderAdminVariantForm === 'function') renderAdminVariantForm();
  if (typeof toast === 'function') {
    const f = v.files[fi];
    toast(f.name + f.ext + (f.locked ? ' is now read-only for the student.' : ' can be edited again.'),
          { type: 'info', duration: 2600 });
  }
}

function adminSwitchFile(fi) {
  const v = adminState.variants[adminState.activeVariantIndex];
  v.activeFileIndex = fi;
  renderAdminVariantForm();
}

/* Authoring side of the same dialog (file-dialog.js). Admin edits the STARTER
   and TARGET bodies separately, so a guard is pre-filled into both. */
function adminAddFile(anchor) {
  const v = adminState.variants[adminState.activeVariantIndex];
  if (!v) return;
  openFileDialog({
    mode: 'add',
    files: v.files,
    mainCode: (v.files[0] || {}).starterCode || '',
    canPair: true,
    anchor: anchor || document.querySelector('.file-tab-add'),
    onSubmit: (r) => {
      const made = [{ name: r.name, ext: r.ext, body: r.guard ? fdGuardText(r.name) : '' }];
      if (r.pair) made.push({ name: r.name, ext: '.c', body: fdPairText(r.name) });
      made.forEach(f => {
        if (v.files.some(x => x.name === f.name && x.ext === f.ext)) return;
        v.files.push({ id: generateId(), name: f.name, ext: f.ext, starterCode: f.body, code: f.body });
      });
      if (r.include && v.files[0]) {
        v.files[0].starterCode = fdInsertInclude(v.files[0].starterCode, r.name + r.ext);
        v.files[0].code = fdInsertInclude(v.files[0].code, r.name + r.ext);
      }
      v.activeFileIndex = v.files.length - 1;
      _adminMarkDirty();
      renderAdminVariantForm();
    }
  });
}

function adminDeleteFile(fi) {
  const v = adminState.variants[adminState.activeVariantIndex];
  if (v.files.length <= 1) return; // keep at least one
  v.files.splice(fi, 1);
  v.activeFileIndex = Math.max(0, Math.min(v.activeFileIndex, v.files.length - 1));
  _adminMarkDirty();
  renderAdminVariantForm();
}

function deleteAdminVariant(idx) {
  showConfirm("Delete Version", "Remove this variant entirely?", () => {
    adminState.variants.splice(idx, 1);
    adminState.activeVariantIndex = Math.max(0, adminState.activeVariantIndex - 1);
    _adminMarkDirty();
    renderAdminVariantForm();
  });
}

function updateActiveVariantField(field, value) {
  if (adminState && adminState.variants[adminState.activeVariantIndex]) {
    adminState.variants[adminState.activeVariantIndex][field] = value;
    _adminMarkDirty();
    if (field === 'name') {
      const tabs = document.getElementById('admin-variant-tabs');
      const tab = tabs && tabs.children[adminState.activeVariantIndex];
      if (tab) {
        const textNode = Array.from(tab.childNodes).find(n => n.nodeType === Node.TEXT_NODE && n.nodeValue.trim() !== '');
        if (textNode) textNode.nodeValue = ' ' + value + ' ';
        else tab.insertBefore(document.createTextNode(' ' + value + ' '), tab.firstChild);
      }
    }
  }
}

/* Each sample body is a formatted editor, not a textarea, so what it holds
   is read out rather than taken off .value -- and it says so with a change
   event, since redrawing itself is not something the form should have to
   know about. */
function _adminWireSampleEditors() {
  if (typeof sampleEditorAttach !== 'function') return;
  document.querySelectorAll('.stb-editor[id^="admin-sample-body-"]').forEach((el) => {
    sampleEditorAttach(el);
    if (el._adminWired) return;
    el._adminWired = true;
    const idx = parseInt(el.id.replace('admin-sample-body-', ''), 10);
    el.addEventListener('change', () => {
      if (typeof updateSampleField !== 'function') return;
      const v = sampleEditorValue(el);
      updateSampleField(idx, 'content', v.content);
      updateSampleField(idx, 'fmt', v.fmt);
    });
  });
}

function addAdminSample() {
  adminState.variants[adminState.activeVariantIndex].samples.push({
    title: `Sample Output ${adminState.variants[adminState.activeVariantIndex].samples.length + 1}`,
    content: ''
  });
  renderAdminVariantForm();
}

function updateSampleField(idx, field, value) {
  adminState.variants[adminState.activeVariantIndex].samples[idx][field] = value;
  _adminMarkDirty();
}

function deleteAdminSample(idx) {
  adminState.variants[adminState.activeVariantIndex].samples.splice(idx, 1);
  _adminMarkDirty();
  renderAdminVariantForm();
}

// ── Test Cases ──
function _adminMarkDirty() {
  window.adminIsDirty = true;
  if (typeof setSaveStatus === 'function') setSaveStatus('admin-save-status', 'unsaved');
}

function addAdminTest() {
  const v = adminState.variants[adminState.activeVariantIndex];
  if (!v.tests) v.tests = [];
  v.tests.push({ id: generateId(), name: `Case ${v.tests.length + 1}`, stdin: '', expected: '', hidden: false });
  _adminMarkDirty();
  renderAdminVariantForm();
}

// ── Minimum Requirements (required constructs) ──
function addAdminMinReq() {
  const v = adminState.variants[adminState.activeVariantIndex];
  if (!v.minRequirements) v.minRequirements = [];
  // Default to the first construct not already required.
  const used = new Set(v.minRequirements.map(r => r.type));
  const next = MIN_REQ_DEFS.find(d => !used.has(d.type)) || MIN_REQ_DEFS[0];
  v.minRequirements.push({ id: generateId(), type: next.type });
  _adminMarkDirty();
  renderAdminVariantForm();
}

function updateMinReqField(idx, type) {
  const v = adminState.variants[adminState.activeVariantIndex];
  if (v && v.minRequirements && v.minRequirements[idx]) {
    v.minRequirements[idx].type = type;
    _adminMarkDirty();
  }
}

function deleteAdminMinReq(idx) {
  const v = adminState.variants[adminState.activeVariantIndex];
  if (!v || !v.minRequirements) return;
  v.minRequirements.splice(idx, 1);
  _adminMarkDirty();
  renderAdminVariantForm();
}

function updateTestField(idx, field, value) {
  const v = adminState.variants[adminState.activeVariantIndex];
  if (v && v.tests && v.tests[idx]) {
    v.tests[idx][field] = value;
    _adminMarkDirty();
  }
}

function deleteAdminTest(idx) {
  const v = adminState.variants[adminState.activeVariantIndex];
  if (!v || !v.tests) return;
  v.tests.splice(idx, 1);
  _adminMarkDirty();
  renderAdminVariantForm();
}

// ── Solution Verification (author-side QA) ──

/**
 * Merge a variant's TARGET code files into one translation unit, mirroring
 * what preprocessMultiFile does for the student's files at submit time:
 * local #include "x.h" is inlined, remaining .c/.cpp sources are appended.
 */
function _adminBuildSolutionSource(v) {
  const files = (v.files || []).filter(f => f && (f.code || '').trim() !== '');
  if (files.length === 0) return '';

  const mainFile = files.find(f => (f.ext === '.c' || f.ext === '.cpp') && /\bmain\s*\(/.test(f.code)) || files[0];
  const included = new Set([mainFile.name + mainFile.ext]);

  function inlineIncludes(code) {
    return code.replace(/#\s*include\s*"([^"]+)"/g, (match, fname) => {
      const f = files.find(x => (x.name + x.ext) === fname);
      if (f && !included.has(fname)) {
        included.add(fname);
        return '/* ── ' + fname + ' ── */\n' + inlineIncludes(f.code || '') + '\n/* ── end ' + fname + ' ── */';
      }
      return included.has(fname) ? '' : match;
    });
  }

  let result = inlineIncludes(mainFile.code || '');
  for (const f of files) {
    const fullName = f.name + f.ext;
    if (included.has(fullName) || (f.ext !== '.c' && f.ext !== '.cpp')) continue;
    included.add(fullName);
    result += '\n\n/* ── ' + fullName + ' (auto-linked) ── */\n' + inlineIncludes(f.code || '') + '\n/* ── end ' + fullName + ' ── */';
  }
  return result;
}

/** Run the variant's Target Code against its authored tests and show pass/fail inline. */
async function adminVerifySolution() {
  const v = adminState.variants[adminState.activeVariantIndex];
  const resultsEl = document.getElementById('admin-verify-results');
  const btn = document.getElementById('admin-verify-btn');
  if (!v || !resultsEl) return;

  const tests = (v.tests || []).filter(t => t && typeof t.expected === 'string');
  if (tests.length === 0) {
    resultsEl.innerHTML = '<div class="admin-verify-banner warn">Add at least one test case first.</div>';
    return;
  }
  const source = _adminBuildSolutionSource(v);
  if (!source.trim()) {
    resultsEl.innerHTML = '<div class="admin-verify-banner warn">Target Code is empty — write the solution before verifying.</div>';
    return;
  }

  if (btn) { btn.disabled = true; btn.style.opacity = '0.55'; }
  resultsEl.innerHTML = '<div class="admin-verify-banner run"><i data-lucide="loader" class="run-code-spinner" style="width:13px;height:13px;"></i> Compiling & running ' + tests.length + ' test' + (tests.length > 1 ? 's' : '') + ' against the solution…</div>';
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: resultsEl });

  let results;
  try {
    results = await runTestCases(tests, source);
  } catch (e) {
    results = null;
  }
  if (btn) { btn.disabled = false; btn.style.opacity = ''; }

  if (!results) {
    resultsEl.innerHTML = '<div class="admin-verify-banner fail">Could not run the tests (compiler offline?). Try again later.</div>';
    return;
  }

  const passed = results.filter(r => r.passed).length;
  const allPass = passed === results.length;

  // Recorded so the Review step can say whether this program has ever been
  // checked against its own solution.
  adminState._verifiedAt = allPass ? Date.now() : null;
  adminState._verifiedPassed = passed;
  adminState._verifiedTotal = results.length;
  if (typeof afRenderRail === 'function') afRenderRail();

  // Stamp the outcome onto the test cards themselves, so the answer is beside
  // the thing you would edit rather than only in a list further down.
  results.forEach((r, i) => {
    const card = document.querySelector('#admin-tests-list .sample-item[data-test-idx="' + i + '"]');
    if (!card) return;
    card.classList.toggle('test-pass', !!r.passed);
    card.classList.toggle('test-fail', !r.passed);
  });
  let html = '<div class="admin-verify-banner ' + (allPass ? 'pass' : 'fail') + '">' +
    (allPass ? '✓ Solution passes all ' + results.length + ' tests — safe to save.'
             : '✗ Solution passes ' + passed + '/' + results.length + ' tests. Fix the Target Code or the expected outputs below.') +
    '</div>';
  html += results.map(r => {
    let row = '<div class="admin-verify-row ' + (r.passed ? 'pass' : 'fail') + '">' +
      '<span class="admin-verify-icon">' + (r.passed ? '✓' : '✗') + '</span>' +
      '<span class="admin-verify-name">' + escapeHTML(r.name) + (r.hidden ? ' <em>(hidden)</em>' : '') + '</span>';
    if (!r.passed) {
      row += '<div class="admin-verify-detail">' +
        (r.error ? '<div><strong>Error:</strong> ' + escapeHTML(r.error) + '</div>' : '') +
        '<div><strong>Expected:</strong><pre>' + _afShowWhitespace(r.expected) + '</pre></div>' +
        '<div><strong>Solution printed:</strong><pre>' + _afShowWhitespace(r.actual) + '</pre></div>' +
        _afWhitespaceNote(r.expected, r.actual) +
      '</div>';
    }
    return row + '</div>';
  }).join('');
  resultsEl.innerHTML = html;
}

/**
 * Trailing spaces and a missing final newline are the classic authoring bug,
 * and in a plain <pre> the two sides look identical. Spaces become middle dots
 * and line ends become a visible mark, but only where it matters — every space
 * dotted would be unreadable, so only runs at the end of a line are shown.
 */
function _afShowWhitespace(text) {
  if (text === undefined || text === null || text === '') return '<em>(empty)</em>';
  return String(text)
    .split('\n')
    .map(line => {
      const m = line.match(/[ \t]+$/);
      const body = escapeHTML(m ? line.slice(0, -m[0].length) : line);
      const tail = m ? '<span class="af-ws">' + m[0].replace(/ /g, '\u00b7').replace(/\t/g, '\u2192') + '</span>' : '';
      return body + tail;
    })
    .join('<span class="af-ws">\u00b6</span>\n');
}

/** Say it in words when the only difference is invisible. */
function _afWhitespaceNote(expected, actual) {
  const e = String(expected === undefined || expected === null ? '' : expected);
  const a = String(actual === undefined || actual === null ? '' : actual);
  if (e === a) return '';
  if (e.trim() === a.trim()) {
    const eNl = e.endsWith('\n'), aNl = a.endsWith('\n');
    if (eNl !== aNl) {
      return '<div class="af-ws-note">Only difference: the ' + (aNl ? 'solution prints' : 'expected value has') +
             ' a trailing newline and the other does not.</div>';
    }
    return '<div class="af-ws-note">Only difference is whitespace — leading or trailing spaces.</div>';
  }
  if (e.replace(/\s+/g, '') === a.replace(/\s+/g, '')) {
    return '<div class="af-ws-note">Same characters, different spacing or line breaks.</div>';
  }
  return '';
}

/** Run the Target Code with one test's stdin and fill its expected stdout from the result. */
async function adminAutofillExpected(idx) {
  const v = adminState.variants[adminState.activeVariantIndex];
  if (!v || !v.tests || !v.tests[idx]) return;
  const resultsEl = document.getElementById('admin-verify-results');

  const source = _adminBuildSolutionSource(v);
  if (!source.trim()) {
    if (resultsEl) resultsEl.innerHTML = '<div class="admin-verify-banner warn">Target Code is empty — write the solution before auto-filling.</div>';
    return;
  }

  if (resultsEl) {
    resultsEl.innerHTML = '<div class="admin-verify-banner run"><i data-lucide="loader" class="run-code-spinner" style="width:13px;height:13px;"></i> Running the solution to capture its output…</div>';
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: resultsEl });
  }

  let res = null;
  try {
    res = await _godboltCompileRun(source, v.tests[idx].stdin || '');
  } catch (e) {
    try { res = await _gradeRunJSCPP(source, v.tests[idx].stdin || ''); } catch (e2) { res = null; }
  }

  if (!res || !res.didExecute) {
    if (resultsEl) resultsEl.innerHTML = '<div class="admin-verify-banner fail">Solution did not compile/run:<pre>' + escapeHTML((res && (res.buildStderr || res.stderr)) || 'compiler unreachable') + '</pre></div>';
    return;
  }

  v.tests[idx].expected = _normalizeOutput(res.stdout || '');
  _adminMarkDirty();
  renderAdminVariantForm();
  const el = document.getElementById('admin-verify-results');
  if (el) el.innerHTML = '<div class="admin-verify-banner pass">✓ Expected output for “' + escapeHTML(v.tests[idx].name || 'Case ' + (idx + 1)) + '” filled from the solution’s actual output.</div>';
}


/* ── Managing tests and versions ──────────────────────────────
   Reordering meant deleting and retyping, and a second test that differed by
   one character meant typing the whole thing again. */

function _afActiveVariant() {
  if (typeof adminState === 'undefined' || !adminState) return null;
  return (adminState.variants || [])[adminState.activeVariantIndex] || (adminState.variants || [])[0] || null;
}

window.afMoveTest = function (idx, delta) {
  const v = _afActiveVariant();
  if (!v || !v.tests) return;
  const to = idx + delta;
  if (to < 0 || to >= v.tests.length) return;
  const [row] = v.tests.splice(idx, 1);
  v.tests.splice(to, 0, row);
  window.adminIsDirty = true;
  if (typeof setSaveStatus === 'function') setSaveStatus('admin-save-status', 'unsaved');
  renderAdminVariantForm();
};

window.afDuplicateTest = function (idx) {
  const v = _afActiveVariant();
  if (!v || !v.tests || !v.tests[idx]) return;
  const copy = JSON.parse(JSON.stringify(v.tests[idx]));
  copy.id = typeof generateId === 'function' ? generateId() : String(Date.now());
  copy.name = (copy.name || 'Test') + ' (copy)';
  v.tests.splice(idx + 1, 0, copy);
  window.adminIsDirty = true;
  if (typeof setSaveStatus === 'function') setSaveStatus('admin-save-status', 'unsaved');
  renderAdminVariantForm();
};

/**
 * Several tests from one block of text. Each test is stdin, then `=>` or `--`,
 * then the expected output; blank lines separate them. Anything unparseable is
 * reported rather than silently dropped.
 */
window.afBulkAddTests = function () {
  const v = _afActiveVariant();
  if (!v) return;
  if (!v.tests) v.tests = [];
  showInputDialog('Paste tests',
    'One test per block, separated by a blank line. Put => on its own line between the input and the expected output.',
    '5 3\n=>\n8\n\n2 2\n=>\n4', '', (raw) => {
      const text = String(raw || '').replace(/\r\n/g, '\n').trim();
      if (!text) return;
      let added = 0, skipped = 0;
      text.split(/\n\s*\n/).forEach(block => {
        const parts = block.split(/^\s*(?:=>|--)\s*$/m);
        if (parts.length !== 2) { skipped++; return; }
        v.tests.push({
          id: typeof generateId === 'function' ? generateId() : String(Date.now() + added),
          name: 'Test ' + (v.tests.length + 1),
          stdin: parts[0].replace(/^\n+|\n+$/g, ''),
          expected: parts[1].replace(/^\n+|\n+$/g, ''),
          hidden: false
        });
        added++;
      });
      window.adminIsDirty = true;
      if (typeof setSaveStatus === 'function') setSaveStatus('admin-save-status', 'unsaved');
      renderAdminVariantForm();
      if (typeof toast === 'function') {
        toast(added + ' test' + (added !== 1 ? 's' : '') + ' added' +
          (skipped ? ', ' + skipped + ' block' + (skipped !== 1 ? 's' : '') + ' skipped — no => separator' : '') + '.',
          { type: skipped ? 'warning' : 'success', duration: skipped ? 6000 : 3500 });
      }
    });
};

window.afDuplicateVariant = function () {
  if (typeof adminState === 'undefined' || !adminState) return;
  const v = _afActiveVariant();
  if (!v) return;
  const copy = JSON.parse(JSON.stringify(v));
  copy.id = typeof generateId === 'function' ? generateId() : String(Date.now());
  copy.name = (copy.name || 'Version') + ' (copy)';
  (copy.files || []).forEach(f => { f.id = typeof generateId === 'function' ? generateId() : String(Math.random()); });
  (copy.tests || []).forEach(t => { t.id = typeof generateId === 'function' ? generateId() : String(Math.random()); });
  adminState.variants.push(copy);
  adminState.activeVariantIndex = adminState.variants.length - 1;
  window.adminIsDirty = true;
  if (typeof setSaveStatus === 'function') setSaveStatus('admin-save-status', 'unsaved');
  // renderAdminVariantForm redraws the tab strip itself; there is no separate
  // tabs renderer to call.
  renderAdminVariantForm();
  if (typeof toast === 'function') toast('Version duplicated.', { type: 'success' });
};


/* ── Editors, full screen ─────────────────────────────────────
   A 220px box is a poor place to write a solution in, and the form around it
   is not much bigger. Rather than build a second editor and keep the two in
   step, the existing one is MOVED into the overlay and moved back on close —
   one editor, one value, nothing to synchronise. */

const AF_EDITORS = [
  { key: 'starter', label: 'Starter Code', icon: 'file-code' },
  { key: 'target',  label: 'Target Code',  icon: 'shield-check' }
];

let _afExpandedFrom = null;   // where the editor was taken from
let _afExpandedEl = null;     // the editor itself
let _afExpandedKey = null;    // which one is up

window.afExpandEditor = function (which) {
  if (_afExpandedEl) return;
  const box = document.getElementById('admin-' + which + '-pre');
  const container = box ? box.closest('.editor-container') : null;
  if (!container) return;

  let ov = document.getElementById('af-editor-modal');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'af-editor-modal';
    ov.className = 'modal-overlay';
    document.body.appendChild(ov);
  }
  ov.classList.remove('hidden');
  const order = AF_EDITORS.map(e => e.key);
  const at = order.indexOf(which);
  const meta = AF_EDITORS[at];

  ov.innerHTML = `
    <div class="modal-content af-editor-modal" onclick="event.stopPropagation()">
      <div class="af-editor-head">
        <div class="af-editor-title">
          <!-- Switching without leaving full screen: writing the solution means
               looking at the starter constantly, and exiting to swap made that
               two clicks and a scroll each way. -->
          <span class="af-editor-nav">
            <button onclick="afSwapEditor(-1)" ${at === 0 ? 'disabled' : ''}
                    title="${at === 0 ? 'Nothing before this' : 'Show ' + AF_EDITORS[at - 1].label}"
                    aria-label="Previous editor"><i data-lucide="chevron-left"></i></button>
            <button onclick="afSwapEditor(1)" ${at === order.length - 1 ? 'disabled' : ''}
                    title="${at === order.length - 1 ? 'Nothing after this' : 'Show ' + AF_EDITORS[at + 1].label}"
                    aria-label="Next editor"><i data-lucide="chevron-right"></i></button>
          </span>
          <h2><i data-lucide="${meta.icon}"></i> ${meta.label}</h2>
          <span class="af-editor-count">${at + 1} of ${order.length}</span>
        </div>
        <button class="btn btn-ghost" onclick="afCollapseEditor()" aria-label="Close full screen">
          <i data-lucide="minimize-2"></i> Exit full screen
        </button>
      </div>
      <div class="af-editor-slot" id="af-editor-slot"></div>
      <p class="af-editor-note">Edits here are the same field — closing puts it straight back.</p>
    </div>`;

  // Leave a marker so it goes back exactly where it came from.
  const marker = document.createElement('div');
  marker.id = 'af-editor-placeholder';
  container.parentNode.insertBefore(marker, container);
  _afExpandedFrom = marker;
  _afExpandedEl = container;

  _afExpandedKey = which;
  container.classList.add('af-editor-expanded');
  document.getElementById('af-editor-slot').appendChild(container);
  ov.onclick = () => afCollapseEditor();
  if (typeof lucide !== 'undefined') lucide.createIcons({ el: ov });

  const ta = container.querySelector('textarea');
  if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
};

/**
 * Move to the editor either side. The current one goes home first, so the
 * move-in/move-out invariant holds and there is never more than one editor out
 * of the form.
 */
window.afSwapEditor = function (delta) {
  const order = AF_EDITORS.map(e => e.key);
  const at = order.indexOf(_afExpandedKey);
  const to = at + delta;
  if (at === -1 || to < 0 || to >= order.length) return;
  afCollapseEditor();
  afExpandEditor(order[to]);
};

window.afCollapseEditor = function () {
  const ov = document.getElementById('af-editor-modal');
  if (_afExpandedEl && _afExpandedFrom && _afExpandedFrom.parentNode) {
    _afExpandedEl.classList.remove('af-editor-expanded');
    _afExpandedFrom.parentNode.insertBefore(_afExpandedEl, _afExpandedFrom);
    _afExpandedFrom.remove();
  }
  _afExpandedEl = null;
  _afExpandedFrom = null;
  _afExpandedKey = null;
  if (ov) { ov.classList.add('hidden'); ov.innerHTML = ''; }
};

/* Escape closes it, and the editor must go home before the form is torn down —
   otherwise it would be destroyed inside the overlay and the field would be
   gone when the step was next drawn. */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && _afExpandedEl) {
    e.stopPropagation();
    afCollapseEditor();
  }
}, true);


/* ── The instruction, written properly ────────────────────────
   An exercise instruction is not a flat paragraph. It has emphasis, terms the
   student must type exactly, ordered steps, and things worth colouring —
   and this was a bare textarea, so all of it had to be imagined. Quill is
   already loaded for the snippet study editor, so the same one is used here
   rather than adding a second way of writing rich text to the app.

   It writes through to the hidden textarea as well as to adminState, so
   saving, the required asterisk and the step rail all keep reading a field by
   id exactly as they did when this was a plain textarea. */

let afDescQuill = null;

const AF_DESC_TOOLBAR = [
  [{ header: [2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ color: [] }, { background: [] }],
  [{ list: 'ordered' }, { list: 'bullet' }, { indent: '-1' }, { indent: '+1' }],
  ['blockquote', 'code', 'code-block', 'link'],
  ['clean']
];

/**
 * Every instruction written so far is plain text. Pasted into an HTML editor
 * as-is, its line breaks would collapse into one run-on paragraph and any "<"
 * would be swallowed as a tag — so anything that is not already markup is
 * escaped and split into paragraphs before it is loaded.
 */
/* The tags a description may be made of. This list is what decides whether a
   stored value is ALREADY markup -- and anything missing from it was treated
   as plain text and escaped, which is how a description written with <code>
   came to show its tags as words the moment the editor opened on it. The pack
   ships 266 of those. Keep this in step with what the editor can produce. */
const AF_DESC_TAGS = 'p|br|ol|ul|li|h[1-6]|strong|b|em|i|u|s|span|code|pre|blockquote|div|a|small|sup|sub|mark|kbd';
const AF_DESC_IS_HTML = new RegExp('<(?:' + AF_DESC_TAGS + ')' + String.fromCharCode(92) + 'b', 'i');
const AF_DESC_ESCAPED = new RegExp('&lt;(/?(?:' + AF_DESC_TAGS + '))&gt;', 'gi');

/**
 * Put back tags a previous version escaped into text.
 *
 * Only the tags above, and only when the value carries no real markup of its
 * own -- so a description that genuinely means to SHOW `&lt;code&gt;` as words,
 * alongside actual markup, is left alone.
 */
function afDescRepair(value) {
  const raw = String(value == null ? '' : value);
  if (!raw || raw.indexOf('&lt;') === -1) return raw;
  AF_DESC_ESCAPED.lastIndex = 0;
  if (!AF_DESC_ESCAPED.test(raw)) return raw;
  AF_DESC_ESCAPED.lastIndex = 0;
  return raw.replace(AF_DESC_ESCAPED, '<$1>');
}

function afDescToHTML(value) {
  const raw = afDescRepair(value);
  if (!raw.trim()) return '';
  if (AF_DESC_IS_HTML.test(raw)) return raw;
  return raw.split(/\n/)
    .map(line => (line.trim() ? '<p>' + escapeHTML(line) + '</p>' : '<p><br></p>'))
    .join('');
}

window.afInitDescEditor = function () {
  const host = document.getElementById('admin-variant-desc-editor');
  const hidden = document.getElementById('admin-variant-desc');
  if (!host || !hidden) return;

  // Offline before the CDN has been cached: show the plain textarea instead of
  // an empty box that swallows everything typed into it.
  if (!window.Quill) {
    host.style.display = 'none';
    hidden.classList.add('af-rich-fallback');
    return;
  }

  // renderAdminVariantForm rebuilds this whole block, so a surviving instance
  // points at detached DOM: its writes would go nowhere and the editor on
  // screen would be dead. The snippet editor hit exactly this.
  if (afDescQuill && afDescQuill.root && host.contains(afDescQuill.root)) return;

  /* The app's own toolbar, wired to Quill. Same controls, same swatches and
     same chrome as the sample editor next door -- see formatToolbarHTML. */
  const bar = document.createElement('div');
  bar.innerHTML = typeof descToolbarHTML === 'function' ? descToolbarHTML('admin-variant-desc-editor') : '';
  const barEl = bar.firstElementChild;
  if (barEl) host.parentNode.insertBefore(barEl, host);

  const q = new Quill(host, {
    theme: 'snow',
    placeholder: 'What should the student write? Steps, constraints, and anything they must match exactly.',
    modules: { toolbar: barEl || AF_DESC_TOOLBAR }
  });
  if (typeof formatToolbarPolish === 'function') formatToolbarPolish(barEl);
  afDescQuill = q;

  // 'silent' — loading the saved value must not read as typing, or opening a
  // program would mark it unsaved before anything had been touched.
  q.clipboard.dangerouslyPasteHTML(afDescToHTML(hidden.value), 'silent');

  afLabelToolbar(q.getModule('toolbar').container);

  q.on('text-change', (delta, oldDelta, source) => {
    // An empty Quill document is "<p><br></p>" — a non-empty string that says
    // nothing. Stored as-is, the asterisk and the step rail would both report
    // the instruction as written while the box sat blank.
    const html = q.getText().trim() ? q.root.innerHTML : '';
    hidden.value = html;
    if (source !== 'user') return;
    updateActiveVariantField('description', html);
    if (typeof afUpdateRequiredMarks === 'function') afUpdateRequiredMarks();
    if (typeof afRenderRail === 'function') afRenderRail();
  });
};


/* ── Naming the toolbar ───────────────────────────────────────
   Quill ships its toolbar as bare icons carrying no label of any kind — no
   title, no aria-label — so each control is a guess until you click it and
   look at what changed. Every one is named here, on hover and to a screen
   reader both. */

const AF_TOOL_LABELS = [
  ['.ql-header',                'Heading level'],
  ['.ql-bold',                  'Bold'],
  ['.ql-italic',                'Italic'],
  ['.ql-underline',             'Underline'],
  ['.ql-strike',                'Strikethrough'],
  ['.ql-color',                 'Text colour'],
  ['.ql-background',            'Highlight colour'],
  ['.ql-list[value="ordered"]', 'Numbered list'],
  ['.ql-list[value="bullet"]',  'Bulleted list'],
  ['.ql-indent[value="-1"]',    'Decrease indent'],
  ['.ql-indent[value="+1"]',    'Increase indent'],
  ['.ql-blockquote',            'Quote block'],
  ['.ql-code',                  'Inline code'],
  ['.ql-code-block',            'Code block'],
  ['.ql-link',                  'Insert link'],
  ['.ql-clean',                 'Clear formatting']
];

function afLabelToolbar(toolbarEl) {
  if (!toolbarEl) return;
  AF_TOOL_LABELS.forEach(pair => {
    toolbarEl.querySelectorAll(pair[0]).forEach(el => {
      // Quill builds each dropdown from a <select> and leaves the original in
      // the DOM, hidden. Labelling that too put an aria-label on a control
      // nobody can reach and a tooltip on a box with no position.
      if (el.tagName === 'SELECT') return;
      el.classList.add('af-tip');
      el.setAttribute('data-tip', pair[1]);
      el.setAttribute('aria-label', pair[1]);
    });
  });

  // The two colour dropdowns are grids of unlabelled squares, where the value
  // is the only thing identifying one. The heading dropdown already writes its
  // own item labels, so it is left alone.
  toolbarEl.querySelectorAll('.ql-color .ql-picker-item, .ql-background .ql-picker-item')
    .forEach(item => {
      const v = item.getAttribute('data-value');
      item.setAttribute('title', v || 'Default');
    });
}
