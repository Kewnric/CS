/* ============================================================
   ADMIN-VARIANTS.JS — Variant Tabs, File Tabs, Editors, Samples
   ============================================================ */

function renderAdminVariantForm() {
  if (!adminState || !adminState.variants) return;

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
        <div class="file-tab ${fi === activeVar.activeFileIndex ? 'active' : ''}" onclick="adminSwitchFile(${fi})">
          <span class="file-tab-name">${escapeHTML(f.name + f.ext)}</span>
          ${activeVar.files.length > 1 ? `<span class="file-tab-x" onclick="event.stopPropagation(); adminDeleteFile(${fi})">×</span>` : ''}
        </div>
      `).join('')}
      <button class="file-tab-add" onclick="adminAddFile(this)" title="Add File"><i data-lucide="plus" style="width:13px;height:13px;"></i></button>
    </div>`;
  }

  const contentContainer = document.getElementById('admin-variant-content');

  contentContainer.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:1rem;">
      <div>
        <label class="form-label">Version Name</label>
        <input value="${escapeHTML(activeVar.name)}" oninput="updateActiveVariantField('name', this.value)" class="form-input" />
      </div>
      <div>
        <label class="form-label-inline"><span>Instruction / Description</span></label>
        <textarea rows="3" oninput="updateActiveVariantField('description', this.value)" class="form-textarea">${escapeHTML(activeVar.description || '')}</textarea>
      </div>

      <div style="display:flex; flex-direction:column; flex:1; min-height:220px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
          <label class="form-label" style="color:var(--color-accent); margin-bottom:0;">Starter Code <span style="font-weight:400; font-size:0.75rem; opacity:0.7;">(pre-filled for user)</span></label>
        </div>
        ${fileTabsHTML('starter')}
        <div class="editor-container" style="flex:1; border-color:var(--color-accent); border-top:none; border-radius:0 0 var(--radius-md) var(--radius-md);">
          <pre id="admin-starter-pre" class="editor-pre"><code id="admin-starter-code"></code></pre>
          <textarea id="admin-starter-ta" spellcheck="false" class="editor-textarea" placeholder="// Add starter boilerplate here..."></textarea>
        </div>
      </div>

      <div style="display:flex; flex-direction:column; flex:1; min-height:240px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
          <label class="form-label" style="color:var(--color-success); margin-bottom:0;">Target Code <span style="font-weight:400; font-size:0.75rem; opacity:0.7;">(hidden solution)</span></label>
        </div>
        ${fileTabsHTML('target')}
        <div class="editor-container" style="flex:1; border-color:var(--color-success); border-top:none; border-radius:0 0 var(--radius-md) var(--radius-md);">
          <pre id="admin-target-pre" class="editor-pre"><code id="admin-target-code"></code></pre>
          <textarea id="admin-target-ta" spellcheck="false" class="editor-textarea" placeholder="// Target code for this file..."></textarea>
        </div>
      </div>

      <div>
        <label class="form-label">Hints <span style="font-weight:400; font-size:0.75rem; opacity:0.7;">(one per line, revealed progressively during practice, -5% each)</span></label>
        <textarea rows="3" oninput="updateActiveVariantField('hints', this.value.split('\\n').filter(h => h.trim()))" class="form-textarea" style="font-size:0.8125rem;" placeholder="First hint...\nSecond hint...\nThird hint...">${escapeHTML((activeVar.hints || []).join('\n'))}</textarea>
      </div>

      <div class="divider"></div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
        <label class="form-label" style="margin-bottom:0;">Sample Outputs</label>
        <button onclick="addAdminSample()" class="btn btn-ghost btn-sm" style="color:var(--color-primary); font-weight:600;">
          <i data-lucide="plus-circle" style="width:14px;height:14px;"></i> Add Sample
        </button>
      </div>
      <div id="admin-samples-list" style="display:flex; flex-direction:column; gap:0.75rem;">
        ${activeVar.samples.map((s, sampleIdx) => `
          <div class="sample-item">
            <div style="flex:1; display:flex; flex-direction:column; gap:0.5rem;">
              <input value="${escapeHTML(s.title || '')}" oninput="updateSampleField(${sampleIdx}, 'title', this.value)" placeholder="Sample Title" class="form-input" style="font-weight:600; font-size:0.8125rem; padding:0.375rem 0.5rem;" />
              <textarea rows="2" oninput="updateSampleField(${sampleIdx}, 'content', this.value)" placeholder="Sample content..." class="form-textarea" style="font-family:var(--font-mono); font-size:0.75rem; min-height:40px; padding:0.375rem 0.5rem;">${escapeHTML(s.content || '')}</textarea>
            </div>
            <button onclick="deleteAdminSample(${sampleIdx})" class="btn btn-ghost" style="padding:0.25rem;" title="Delete Sample">
              <i data-lucide="trash-2" style="width:16px;height:16px;color:var(--color-danger);"></i>
            </button>
          </div>
        `).join('') + (activeVar.samples.length === 0 ? '<p style="font-size:0.75rem; color:var(--text-tertiary); font-style:italic;">No samples added.</p>' : '')}
      </div>

      <div class="divider"></div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
        <label class="form-label" style="margin-bottom:0; display:flex; align-items:center; gap:0.4rem;">
          <i data-lucide="list-checks" style="width:14px;height:14px;color:var(--color-warning);"></i> Minimum Requirements
          <span style="font-weight:400; font-size:0.72rem; opacity:0.7;">(constructs the student's code must use)</span>
        </label>
        <button onclick="addAdminMinReq()" class="btn btn-ghost btn-sm" style="color:var(--color-warning); font-weight:600;">
          <i data-lucide="plus-circle" style="width:14px;height:14px;"></i> Add Requirement
        </button>
      </div>
      <div id="admin-minreq-list" style="display:flex; flex-direction:column; gap:0.5rem;">
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

      <div class="divider"></div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
        <label class="form-label" style="margin-bottom:0; display:flex; align-items:center; gap:0.4rem;">
          <i data-lucide="check-circle" style="width:14px;height:14px;color:var(--color-success);"></i> Test Cases
          <span style="font-weight:400; font-size:0.72rem; opacity:0.7;">(run on Submit — score becomes pass rate)</span>
        </label>
        <div style="display:flex; gap:0.4rem; align-items:center;">
          <button onclick="adminVerifySolution()" id="admin-verify-btn" class="btn btn-ghost btn-sm" style="color:var(--color-success); font-weight:600;" title="Compile & run the Target Code against every test case to catch authoring mistakes before students see them.">
            <i data-lucide="shield-check" style="width:14px;height:14px;"></i> Verify Solution
          </button>
          <button onclick="addAdminTest()" class="btn btn-ghost btn-sm" style="color:var(--color-primary); font-weight:600;">
            <i data-lucide="plus-circle" style="width:14px;height:14px;"></i> Add Test
          </button>
        </div>
      </div>
      <div id="admin-verify-results"></div>
      <div id="admin-tests-list" style="display:flex; flex-direction:column; gap:0.75rem;">
        ${(activeVar.tests || []).map((t, ti) => `
          <div class="sample-item" style="flex-direction:column; align-items:stretch; gap:0.5rem;">
            <div style="display:flex; gap:0.5rem; align-items:center;">
              <input value="${escapeHTML(t.name || '')}" oninput="updateTestField(${ti}, 'name', this.value)" placeholder="Test name (e.g. Case 1)" class="form-input" style="font-weight:600; font-size:0.8125rem; padding:0.375rem 0.5rem; flex:1;" />
              <label style="display:flex; align-items:center; gap:0.3rem; font-size:0.72rem; color:var(--text-tertiary); white-space:nowrap; cursor:pointer;" title="Hidden tests still count toward the score, but the student doesn't see their input/expected output.">
                <input type="checkbox" ${t.hidden ? 'checked' : ''} onchange="updateTestField(${ti}, 'hidden', this.checked)" /> Hidden
              </label>
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
                <textarea rows="3" oninput="updateTestField(${ti}, 'stdin', this.value)" placeholder="(optional)" class="form-textarea" style="font-family:var(--font-mono); font-size:0.72rem; min-height:54px; padding:0.375rem 0.5rem;">${escapeHTML(t.stdin || '')}</textarea>
              </div>
              <div style="display:flex; flex-direction:column; gap:0.2rem;">
                <span style="font-size:0.68rem; color:var(--color-success); text-transform:uppercase; letter-spacing:0.03em;">Expected stdout</span>
                <textarea rows="3" oninput="updateTestField(${ti}, 'expected', this.value)" placeholder="Exact expected output" class="form-textarea" style="font-family:var(--font-mono); font-size:0.72rem; min-height:54px; padding:0.375rem 0.5rem;">${escapeHTML(t.expected || '')}</textarea>
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
        '<div><strong>Expected:</strong><pre>' + escapeHTML(r.expected || '(empty)') + '</pre></div>' +
        '<div><strong>Solution printed:</strong><pre>' + escapeHTML(r.actual || '(no output)') + '</pre></div>' +
      '</div>';
    }
    return row + '</div>';
  }).join('');
  resultsEl.innerHTML = html;
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
