/* Route: admin (Admin Hub, Coding Admin, Notes Admin, Snippets Admin) */

function getAdminFormHTML() {
  return `
    <div id="admin-form-container" class="admin-form-panel hidden">
      <!-- Header -->
      <div class="admin-form-header">
        <div class="af-header-left">
          <div class="af-header-badge" style="background:var(--color-primary-subtle);">
            <i data-lucide="code-2" style="width:18px;height:18px;color:var(--color-primary);" aria-hidden="true"></i>
          </div>
          <div class="af-header-text">
            <h2 id="admin-form-title">Edit Program</h2>
            <p>Coding challenge configuration</p>
          </div>
          <span class="af-save-status" id="admin-save-status" aria-live="polite"></span>
        </div>
        <button onclick="confirmCloseAdminForm(closeAdminForm, saveAdminForm)" class="btn btn-ghost af-close-btn" id="close-form-btn" aria-label="Close form" title="Close (Esc)">
          <i data-lucide="x" style="width:20px;height:20px;" aria-hidden="true"></i>
        </button>
      </div>

      <!-- Section: Identity -->
      <div class="af-section">
        <div class="af-section-header">
          <i data-lucide="info" class="af-section-icon" style="color:var(--color-primary);"></i>
          <span>Basic Info</span>
        </div>
        <div class="af-section-body">
          <div class="af-row-2">
            <div class="af-field af-field-wide">
              <label class="form-label" for="admin-title"><i data-lucide="type" class="af-label-icon"></i>Program Title</label>
              <input id="admin-title" oninput="adminState.title = this.value" placeholder="e.g. Basic Math Operations" class="form-input af-input-bold" />
            </div>
            <div class="af-field">
              <label class="form-label"><i data-lucide="folder" class="af-label-icon"></i>Category</label>
              <div id="admin-category-cs"></div>
              <select id="admin-category" onchange="adminState.parentId = this.value || null" class="hidden" aria-hidden="true" tabindex="-1"></select>
            </div>
          </div>

          <div class="af-field">
            <label class="form-label" for="admin-cover-desc"><i data-lucide="align-left" class="af-label-icon"></i>Cover Description <span class="af-label-hint">(shown in Browse)</span></label>
            <textarea id="admin-cover-desc" oninput="adminState.coverDescription = this.value" rows="2" class="form-textarea" placeholder="Brief overview of the program..."></textarea>
          </div>

          <div class="af-field">
            <label class="form-label"><i data-lucide="image" class="af-label-icon"></i>Cover Image <span class="af-label-hint">(optional — shown in Browse &amp; the Home carousel)</span></label>
            <div id="admin-cover-field" class="nb-cover-field"></div>
          </div>

          <div class="af-field">
            <label class="form-label"><i data-lucide="tag" class="af-label-icon"></i>Alias <span class="af-label-hint">(optional — short name shown on the boss bar)</span></label>
            <input id="admin-alias" class="form-input" maxlength="28" placeholder="e.g. Celsius → F"
                   oninput="if(adminState) { adminState.alias = this.value.trim() || null; window.adminIsDirty = true; setSaveStatus('admin-save-status','unsaved'); }" />
          </div>

          <div class="af-field">
            <label class="af-check" for="admin-cheatsheet">
              <input type="checkbox" id="admin-cheatsheet"
                     onchange="if(adminState) { adminState.cheatsheet = this.checked; window.adminIsDirty = true; setSaveStatus('admin-save-status','unsaved'); }" />
              <span class="af-check-text">
                <i data-lucide="book-open" class="af-label-icon"></i>Cheat sheet
                <span class="af-label-hint">— adds a reference-sheet button to this program's attempt</span>
              </span>
            </label>
          </div>

          <div class="af-row-2" style="gap:0.75rem;">
            <div class="af-field" style="flex:1;">
              <label class="form-label"><i data-lucide="signal" class="af-label-icon"></i>Difficulty</label>
              <select id="admin-difficulty" class="form-select" onchange="if(adminState) { adminState.difficulty = this.value || null; window.adminIsDirty = true; setSaveStatus('admin-save-status','unsaved'); }">
                <option value="">Auto (from history)</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div class="af-field" style="flex:1;">
              <label class="form-label"><i data-lucide="swords" class="af-label-icon"></i>Level <span class="af-label-hint">(1–100 — boss LV. and Library grouping)</span></label>
              <input id="admin-level" type="number" min="1" max="100" step="1" class="form-input" placeholder="1–100"
                     oninput="if(adminState) { const v = parseInt(this.value, 10); adminState.level = (v > 0 ? Math.min(v, 100) : null); window.adminIsDirty = true; setSaveStatus('admin-save-status','unsaved'); }" />
            </div>
          </div>

          <div class="af-field">
            <label class="form-label"><i data-lucide="tag" class="af-label-icon"></i>Tags</label>
            <div class="af-tag-input-row">
              <input id="admin-tag-input" onkeydown="handleAdminTagKeydown(event)" placeholder="Type a tag and press Enter (commas for multi)..." class="form-input" />
              <button onclick="addAdminTag()" class="btn btn-secondary btn-sm af-add-btn"><i data-lucide="plus" style="width:13px;height:13px;"></i> Add</button>
            </div>
            <div id="admin-tag-suggestions" class="af-tag-suggestions"></div>
            <div id="admin-tags-list" class="af-tags-list"></div>
          </div>
        </div>
      </div>

      <!-- Section: Variants -->
      <div class="af-section">
        <div class="af-section-header" style="color:var(--color-accent);">
          <i data-lucide="layers" class="af-section-icon" style="color:var(--color-accent);"></i>
          <span>Versions / Variants</span>
          <button onclick="addAdminVariant()" class="btn btn-ghost btn-sm af-section-action" id="add-variant-btn" style="color:var(--color-accent);">
            <i data-lucide="plus-circle" style="width:13px;height:13px;"></i> Add Version
          </button>
        </div>
        <div class="af-section-body" style="padding-top:0.5rem;">
          <div id="admin-variant-tabs" class="variant-tabs"></div>
          <div id="admin-variant-content" style="flex:1;display:flex;flex-direction:column;gap:1rem;margin-top:0.75rem;"></div>
        </div>
      </div>

      <div class="admin-form-footer">
        <div class="af-footer-hint"><kbd>Ctrl</kbd>+<kbd>S</kbd> save · <kbd>Esc</kbd> close</div>
        <div class="af-footer-actions">
          <button onclick="confirmCloseAdminForm(closeAdminForm, saveAdminForm)" class="btn btn-secondary">
            <i data-lucide="x" style="width:15px;height:15px;"></i> Discard
          </button>
          <button onclick="saveAdminForm()" class="btn btn-primary" id="save-all-btn">
            <i data-lucide="save" style="width:15px;height:15px;"></i> Save Program
          </button>
        </div>
      </div>
    </div>
  `;
}

function getNotebookFormHTML() {
  return `
    <div id="notebook-form-container" class="admin-form-panel">
      <div class="admin-form-header">
        <div class="af-header-left">
          <div class="af-header-badge" style="background:rgba(245,158,11,0.12);">
            <i data-lucide="book-open" style="width:18px;height:18px;color:var(--color-warning);"></i>
          </div>
          <div class="af-header-text">
            <h2 id="notebook-form-title">Edit Notebook</h2>
            <p>MCQ notebook / quiz configuration</p>
          </div>
          <span class="af-save-status" id="notebook-save-status" aria-live="polite"></span>
        </div>
        <button onclick="confirmCloseAdminForm(closeNotebookForm, saveNotebookForm)" class="btn btn-ghost af-close-btn" aria-label="Close form" title="Close (Esc)">
          <i data-lucide="x" style="width:20px;height:20px;" aria-hidden="true"></i>
        </button>
      </div>

      <div class="af-section">
        <div class="af-section-header" style="color:var(--color-warning);">
          <i data-lucide="info" class="af-section-icon" style="color:var(--color-warning);"></i>
          <span>Basic Info</span>
        </div>
        <div class="af-section-body">
          <div class="af-row-2">
            <div class="af-field af-field-wide">
              <label class="form-label">Notebook Title</label>
              <input id="notebook-title" oninput="notebookAdminState.title = this.value" class="form-input af-input-bold" placeholder="e.g. Calculus Quiz 1" />
            </div>
            <div class="af-field">
              <label class="form-label">Category</label>
              <div id="notebook-category-cs"></div>
              <select id="notebook-category" onchange="notebookAdminState.parentId = this.value || null" class="hidden" aria-hidden="true" tabindex="-1"></select>
            </div>
          </div>
          <div class="af-row-2">
            <div class="af-field">
              <label class="form-label">Icon</label>
              <div id="notebook-icon-picker-container"></div>
            </div>
            <div class="af-field af-field-wide">
              <label class="form-label">Tags</label>
              <div class="af-tag-input-row">
                <input id="notebook-tag-input" onkeydown="handleNotebookTagKeydown(event)" placeholder="Type a tag and press Enter..." class="form-input" />
                <button onclick="addNotebookTag()" class="btn btn-secondary btn-sm af-add-btn"><i data-lucide="plus" style="width:13px;height:13px;"></i> Add</button>
              </div>
              <div id="notebook-tag-suggestions" class="af-tag-suggestions"></div>
              <div id="notebook-tags-list" class="af-tags-list"></div>
            </div>
          </div>
          <div class="af-row-2" style="gap:0.75rem;">
            <div class="af-field" style="flex:1;">
              <label class="form-label"><i data-lucide="signal" class="af-label-icon"></i>Difficulty</label>
              <select id="notebook-difficulty" class="form-select" onchange="if(notebookAdminState) { notebookAdminState.difficulty = this.value || null; window.notebookIsDirty = true; setSaveStatus('notebook-save-status','unsaved'); }">
                <option value="">None</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div class="af-field" style="flex:1;">
              <label class="form-label"><i data-lucide="trending-up" class="af-label-icon"></i>Level <span class="af-label-hint">(1–100 — orders the Library grid)</span></label>
              <input id="notebook-level" type="number" min="1" max="100" step="1" class="form-input" placeholder="1–100"
                     oninput="if(notebookAdminState) { const v = parseInt(this.value, 10); notebookAdminState.level = (v > 0 ? Math.min(v, 100) : null); window.notebookIsDirty = true; setSaveStatus('notebook-save-status','unsaved'); }" />
            </div>
          </div>
          <div class="af-field">
            <label class="form-label">Description</label>
            <textarea id="notebook-desc" oninput="notebookAdminState.description = this.value" rows="3" class="form-textarea" placeholder="Brief overview of the notebook..."></textarea>
          </div>
          <div class="af-field">
            <label class="form-label"><i data-lucide="image" class="af-label-icon"></i>Cover Image <span class="af-label-hint">(optional — shown on the Home carousel)</span></label>
            <div id="notebook-cover-field" class="nb-cover-field"></div>
          </div>
        </div>
      </div>

      <div class="af-section">
        <div class="af-section-header" style="color:var(--color-primary);">
          <i data-lucide="list" class="af-section-icon" style="color:var(--color-primary);"></i>
          <span>Sections</span>
          <button onclick="addNotebookSection()" class="btn btn-ghost btn-sm af-section-action" style="color:var(--color-primary);">
            <i data-lucide="plus-circle" style="width:13px;height:13px;"></i> Add Section
          </button>
        </div>
        <div class="af-section-body" style="padding-top:0.5rem;">
          <div id="notebook-sections-content" style="display:flex;flex-direction:column;gap:1rem;"></div>
        </div>
      </div>

      <div class="admin-form-footer">
        <div class="af-footer-hint"><kbd>Ctrl</kbd>+<kbd>S</kbd> save</div>
        <div class="af-footer-actions">
          <button onclick="confirmCloseAdminForm(closeNotebookForm, saveNotebookForm)" class="btn btn-secondary">
            <i data-lucide="x" style="width:15px;height:15px;"></i> Discard
          </button>
          <button onclick="saveNotebookForm()" class="btn btn-primary" id="save-notebook-btn">
            <i data-lucide="save" style="width:15px;height:15px;"></i> Save Notebook
          </button>
        </div>
      </div>
    </div>
  `;
}

function getSnippetFormHTML() {
  return `
    <div id="study-form-container" class="admin-form-panel">
      <!-- Header -->
      <div class="admin-form-header">
        <div class="af-header-left">
          <div class="af-header-badge" style="background:rgba(6,182,212,0.12);">
            <i data-lucide="code" style="width:18px;height:18px;color:var(--color-accent);" aria-hidden="true"></i>
          </div>
          <div class="af-header-text">
            <h2 id="study-form-title">Edit Snippet</h2>
            <p>Code snippet / study material</p>
          </div>
          <span class="af-save-status" id="study-save-status" aria-live="polite"></span>
        </div>
        <button onclick="confirmCloseAdminForm(closeStudyForm, saveStudyForm)" class="btn btn-ghost af-close-btn" aria-label="Close form" title="Close (Esc)">
          <i data-lucide="x" style="width:20px;height:20px;" aria-hidden="true"></i>
        </button>
      </div>

      <!-- Section: Identity -->
      <div class="af-section">
        <div class="af-section-header" style="color:var(--color-accent);">
          <i data-lucide="info" class="af-section-icon" style="color:var(--color-accent);"></i>
          <span>Basic Info</span>
        </div>
        <div class="af-section-body">
          <div class="af-row-2">
            <div class="af-field af-field-wide">
              <label class="form-label" for="study-title"><i data-lucide="type" class="af-label-icon"></i>Snippet Title</label>
              <input id="study-title" oninput="studyModeState.title = this.value" class="form-input af-input-bold" placeholder="e.g. Pointer Arithmetic" />
            </div>
            <div class="af-field">
              <label class="form-label"><i data-lucide="folder" class="af-label-icon"></i>Category</label>
              <div id="study-category-cs"></div>
              <select id="study-category" onchange="studyModeState.parentId = this.value || null" class="hidden" aria-hidden="true" tabindex="-1"></select>
            </div>
          </div>
          <div class="af-field">
            <label class="form-label" for="study-language"><i data-lucide="code" class="af-label-icon"></i>Language <span class="af-label-hint">(optional — groups and filters the Snippet Library)</span></label>
            <input id="study-language" class="form-input" list="study-language-list" maxlength="16" placeholder="e.g. C, shell, sql"
                   oninput="if(studyModeState) { studyModeState.language = this.value.trim() || null; window.studyIsDirty = true; setSaveStatus('study-save-status','unsaved'); }" />
            <datalist id="study-language-list">
              <option value="C"></option><option value="C++"></option><option value="Python"></option>
              <option value="JavaScript"></option><option value="SQL"></option><option value="Shell"></option>
              <option value="Java"></option><option value="Assembly"></option>
            </datalist>
          </div>
          <div class="af-field">
            <label class="form-label"><i data-lucide="tag" class="af-label-icon"></i>Tags</label>
            <div class="af-tag-input-row">
              <input id="study-tag-input" onkeydown="handleStudyTagKeydown(event)" placeholder="Type a tag and press Enter (commas for multi)..." class="form-input" />
              <button onclick="addStudyTag()" class="btn btn-secondary btn-sm af-add-btn"><i data-lucide="plus" style="width:13px;height:13px;"></i> Add</button>
            </div>
            <div id="study-tag-suggestions" class="af-tag-suggestions"></div>
            <div id="study-tags-list" class="af-tags-list"></div>
          </div>
        </div>
      </div>

      <!-- Section: Content -->
      <div class="af-section">
        <div class="af-section-header" style="color:var(--color-primary);">
          <i data-lucide="file-text" class="af-section-icon" style="color:var(--color-primary);"></i>
          <span>Content</span>
        </div>
        <div class="af-section-body">
          <div class="af-field">
            <label class="form-label">Description <span style="font-weight:400;color:var(--text-tertiary);">(Rich Text)</span></label>
            <div id="study-desc-editor" style="border-radius:var(--radius-md);background:var(--bg-surface);min-height:150px;"></div>
          </div>
          <div class="af-field">
            <label class="form-label">Comments / Notes</label>
            <div id="study-comments-editor" style="border-radius:var(--radius-md);background:var(--bg-surface);min-height:150px;"></div>
          </div>
        </div>
      </div>

      <!-- Section: Links -->
      <div class="af-section">
        <div class="af-section-header" style="color:var(--color-warning);">
          <i data-lucide="link" class="af-section-icon" style="color:var(--color-warning);"></i>
          <span>Linked Challenges</span>
        </div>
        <div class="af-section-body">
          <div class="af-field">
            <label class="form-label">Link a related program</label>
            <div style="display:flex;gap:0.5rem;">
              <select id="study-challenge-select" class="form-select" style="flex:1;"></select>
              <button onclick="addStudyRelatedChallenge()" class="btn btn-secondary btn-sm" style="white-space:nowrap;"><i data-lucide="link" style="width:13px;height:13px;"></i> Link</button>
            </div>
          </div>
          <div id="study-related-challenges-list" style="display:flex;flex-direction:column;gap:0.5rem;"></div>
        </div>
      </div>

      <!-- Section: Code -->
      <div class="af-section">
        <div class="af-section-header" style="color:var(--color-accent);">
          <i data-lucide="terminal" class="af-section-icon" style="color:var(--color-accent);"></i>
          <span>Global Starter Code</span>
        </div>
        <div class="af-section-body">
          <div class="af-field" style="min-height:180px;display:flex;flex-direction:column;">
            <label class="form-label" style="color:var(--color-accent);">Pre-filled code for Try Coding</label>
            <div class="editor-container" style="flex:1;border-color:var(--color-accent);">
              <pre id="study-global-starter-pre" class="editor-pre"><code id="study-global-starter-code"></code></pre>
              <textarea id="study-global-starter-textarea" spellcheck="false" class="editor-textarea" placeholder="// Add starter boilerplate here..."></textarea>
            </div>
          </div>
        </div>
      </div>

      <!-- Section: Examples -->
      <div class="af-section">
        <div class="af-section-header" style="color:var(--color-success);">
          <i data-lucide="play-circle" class="af-section-icon" style="color:var(--color-success);"></i>
          <span>Code Examples</span>
          <button onclick="addStudyExample()" class="btn btn-ghost btn-sm af-section-action" style="color:var(--color-success);">
            <i data-lucide="plus-circle" style="width:13px;height:13px;"></i> Add Example
          </button>
        </div>
        <div class="af-section-body" style="padding-top:0.5rem;">
          <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem;font-size:0.8125rem;flex-wrap:wrap;">
            <span style="color:var(--text-tertiary);font-weight:700;text-transform:uppercase;letter-spacing:0.04em;font-size:0.6875rem;">Try Coding Targets:</span>
            <div id="try-coding-targets-container" style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;"></div>
          </div>
          <div id="study-examples-tabs" class="variant-tabs"></div>
          <div id="study-examples-content" style="flex:1;display:flex;flex-direction:column;gap:1rem;margin-top:0.75rem;"></div>
        </div>
      </div>

      <div class="admin-form-footer">
        <div class="af-footer-hint"><kbd>Ctrl</kbd>+<kbd>S</kbd> save · <kbd>Esc</kbd> close</div>
        <div class="af-footer-actions">
          <button onclick="confirmCloseAdminForm(closeStudyForm, saveStudyForm)" class="btn btn-secondary">
            <i data-lucide="x" style="width:15px;height:15px;"></i> Discard
          </button>
          <button onclick="saveStudyForm()" class="btn btn-primary" id="save-study-btn">
            <i data-lucide="save" style="width:15px;height:15px;"></i> Save Snippet
          </button>
        </div>
      </div>
    </div>
  `;
}

/* --- Admin Hub dashboard --- */
function adminTemplate() {
  return `
    <div class="home-content">
      <div class="home-scroll lib-hub animate-fade-in">
        <section class="lib-hub-hero fade-in-up">
          <div class="lib-hub-hero-icon"><i data-lucide="settings"></i></div>
          <h1 class="lib-hub-title">Admin Panel</h1>
          <p class="lib-hub-subtitle">Manage wings, customize challenges, and configure system settings.</p>
          <div class="lib-hub-totals" id="admin-hub-totals"></div>
        </section>

        <section>
          <h2 class="lib-hub-section-title"><i data-lucide="sliders"></i> Active Wings Config</h2>
          <div class="lib-hub-grid stagger-children" id="admin-hub-active"></div>
        </section>

        <section style="margin-top:2rem;">
          <h2 class="lib-hub-section-title"><i data-lucide="boxes"></i> Other Wings</h2>
          <div class="lib-hub-grid lib-hub-grid-soon stagger-children" id="admin-hub-soon"></div>
        </section>
      </div>
    </div>
  `;
}

function adminInit() {
  const challenges = state.challenges || [];
  const notebooks = state.notebooks || [];
  const snippets = state.snippets || [];

  const codingFolders = state.nodes.filter(n => n.scope === 'challenge' && n.type === 'folder').length;
  const notebookFolders = state.nodes.filter(n => n.scope === 'notebook' && n.type === 'folder').length;
  const snippetFolders = state.nodes.filter(n => n.scope === 'snippet' && n.type === 'folder').length;

  const totals = document.getElementById('admin-hub-totals');
  if (totals) {
    totals.innerHTML = `
      ${_libStatChip('sliders', '3 active wings')}
      ${_libStatChip('file-code', `${challenges.length} programs`)}
      ${_libStatChip('book-open', `${notebooks.length} notebooks`)}
      ${_libStatChip('code', `${snippets.length} snippets`)}
    `;
  }

  const active = document.getElementById('admin-hub-active');
  if (active) {
    const card = (route, cls, icon, name, desc, chips) => `
      <div class="lib-card ${cls}" onclick="spaNavigate('${route}')" role="link" tabindex="0"
           onkeydown="if(event.key==='Enter')spaNavigate('${route}')">
        <div class="lib-card-glow"></div>
        <div class="lib-card-head">
          <div class="lib-card-icon"><i data-lucide="${icon}"></i></div>
          <i data-lucide="arrow-up-right" class="lib-card-arrow"></i>
        </div>
        <h3 class="lib-card-name">${name}</h3>
        <p class="lib-card-desc">${desc}</p>
        <div class="lib-card-chips">${chips}</div>
      </div>`;

    active.innerHTML =
      card('admin-coding', 'lib-card-coding', 'code-2', 'Coding Library Admin',
        'Configure challenge programs, add variants/test cases, organize categories, and define prerequisite lock rules.',
        _libStatChip('file-code', `${challenges.length} programs`) + _libStatChip('folder', `${codingFolders} folders`)) +
      card('admin-notes', 'lib-card-notes', 'book-open', 'Notes Library Admin',
        'Configure MCQ notebooks, set up questions/answers, and categorize quiz sets.',
        _libStatChip('book-open', `${notebooks.length} notebooks`) + _libStatChip('folder', `${notebookFolders} folders`)) +
      card('admin-snippets', 'lib-card-snippets', 'code', 'Snippet Library Admin',
        'Manage reference snippets, pre-filled code, rich text comments, and link related challenges.',
        _libStatChip('code', `${snippets.length} snippets`) + _libStatChip('folder', `${snippetFolders} folders`));
  }

  const soon = document.getElementById('admin-hub-soon');
  if (soon) {
    // These stopped being placeholders when the wings became real libraries.
    // They have no separate admin form — entries are written inside the wing —
    // so the card says so and opens it rather than raising a "coming soon".
    soon.innerHTML = LIBRARY_PLACEHOLDERS.map(p => {
      const n = (typeof wingItems === 'function') ? wingItems(p.key).length : 0;
      return `
      <div class="lib-card lib-card-wing" onclick="spaNavigate('wing?k=${p.key}')" role="link" tabindex="0"
           onkeydown="if(event.key==='Enter')spaNavigate('wing?k=${p.key}')">
        <div class="lib-card-glow"></div>
        <div class="lib-card-head">
          <div class="lib-card-icon"><i data-lucide="${p.icon}"></i></div>
          <i data-lucide="arrow-up-right" class="lib-card-arrow"></i>
        </div>
        <h3 class="lib-card-name">${p.name}</h3>
        <p class="lib-card-desc">Entries and folders are managed inside the wing itself.</p>
        <div class="lib-card-chips">${_libStatChip('file-text', `${n} entr${n === 1 ? 'y' : 'ies'}`)}</div>
      </div>`;
    }).join('');
  }

  const adminRoot = document.querySelector('.lib-hub');
  if (typeof lucide !== 'undefined') lucide.createIcons(adminRoot ? { root: adminRoot } : undefined);
}

function adminDestroy() {}


/* --- Coding Admin Wing --- */
function adminCodingTemplate() {
  return `
    <div class="messenger-layout">
      <main class="messenger-pane-1">
        <div class="pane-1-header">
          <div style="display: flex; align-items: center; gap: 0.5rem; width: 100%; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1; min-width: 0;">
              <button onclick="spaNavigate('admin')" class="btn-back-dark" style="margin-right: 0.5rem; padding: 0.25rem 0.5rem; font-size: 0.75rem; flex-shrink: 0;">
                <i data-lucide="chevron-left" style="width:14px;height:14px;"></i> Back
              </button>
              <h2 class="section-header-animated" style="margin: 0; display: flex; align-items: center;">
                <span class="section-header-icon-wrap browse-icon-wrap">
                  <i data-lucide="code-2"></i>
                  <span class="section-header-icon-ring"></span>
                </span>
                <span class="section-header-text">
                  <span class="section-header-title">Coding Admin</span>
                  <span class="section-header-subtitle" id="admin-coding-header-stats">Loading...</span>
                </span>
              </h2>
            </div>
            <button class="tutorial-trigger-btn" onclick="GuidedTutorial.start()" title="Show Page Tour" aria-label="Show Page Tour" style="flex-shrink: 0;">
              <i data-lucide="graduation-cap" aria-hidden="true"></i>
            </button>
          </div>
          <div class="search-container" style="width: 100%; margin-top: 0.75rem;">
            <i data-lucide="search"></i>
            <input type="text" id="admin-search-input" class="search-input" placeholder="Search programs..." oninput="(window._adminSearchDebounced || (window._adminSearchDebounced = debounce(renderAdmin, 220)))()" aria-label="Search programs">
          </div>
          <div id="admin-filter-container"></div>
        </div>
        <div class="pane-1-content">
          <div id="admin-practice-wrapper">
            <!-- Programs -->
            <!-- Programs: the full list, grouped by folder. It used to show two
                 and hide the rest behind a "Show N more…" disclosure. -->
            <div class="card-flat admin-programs-card">
              <h2 class="admin-programs-title">
                <i data-lucide="code" style="color:var(--color-primary);"></i> Programs
                <button class="admin-groups-btn" onclick="adminToggleAllGroups()" id="admin-groups-btn"
                        title="Expand or collapse every folder">Collapse all</button>
              </h2>
              <div id="admin-table-body-preview"></div>
            </div>

            <!-- Practice Sets. Programs is what you come here for, so everything
                 below it is collapsed by default rather than sharing the scroll. -->
            <details class="admin-panel">
              <summary>
                <i data-lucide="chevron-right" class="admin-panel-chev"></i>
                <i data-lucide="layout-grid" style="color:var(--color-accent);width:16px;height:16px;"></i>
                <span class="admin-panel-name">Practice Sets</span>
                <span class="admin-panel-count" id="admin-sets-count">0</span>
              </summary>
              <div class="admin-panel-body">
                <p style="font-size:0.75rem; color:var(--text-tertiary); margin-bottom:1rem;">Bundle several problems into one session.</p>
                <div id="admin-sets-list" style="display:flex; flex-direction:column; gap:0.5rem; margin-bottom:0.75rem;"></div>
                <button onclick="openSetBuilder('new')" class="btn btn-secondary" style="width:100%;">
                  <i data-lucide="plus" style="width:16px;height:16px;"></i> New Practice Set
                </button>
              </div>
            </details>

            <!-- Categories -->
            <details class="admin-panel">
              <summary>
                <i data-lucide="chevron-right" class="admin-panel-chev"></i>
                <i data-lucide="folder" style="color:var(--color-warning);width:16px;height:16px;"></i>
                <span class="admin-panel-name">Categories</span>
                <span class="admin-panel-count" id="admin-cats-count">0</span>
              </summary>
              <div class="admin-panel-body">
              <ul id="admin-category-list-preview" style="display:flex; flex-direction:column; gap:0.5rem; margin-bottom:0.5rem; list-style:none; padding:0;"></ul>
              
              <div class="tree-node" id="admin-categories-dropdown-wrapper" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md);">
                <div class="tree-node-row" onclick="toggleAdminSection('admin-categories-content', event)" style="cursor: pointer; padding: 0.75rem 1rem; border-radius: var(--radius-md);">
                  <i data-lucide="chevron-right" class="tree-node-chevron"></i>
                  <span class="tree-node-label" style="font-weight:600; font-size:0.95rem; color: var(--text-secondary);">Show <span id="admin-categories-rest-count">0</span> more categories...</span>
                </div>
                <div class="tree-children collapsed" id="admin-categories-content">
                  <div class="tree-children-inner" style="padding: 0 1rem 1rem 1rem;">
                    <ul id="admin-category-list-rest" style="display:flex; flex-direction:column; gap:0.5rem; margin-bottom:1rem; list-style:none; padding:0;"></ul>
                    <div style="display:flex; gap:0.5rem;">
                      <input id="new-category-input" placeholder="New Category" onkeydown="if(event.key==='Enter') addCategory()" class="form-input" style="flex:1;" />
                      <button onclick="addCategory()" class="btn btn-secondary btn-icon" id="add-category-btn" title="Add Category"><i data-lucide="plus" style="width:18px;height:18px;"></i></button>
                    </div>
                  </div>
                </div>
              </div>
              
              <div id="admin-categories-fallback-add" style="display:none; gap:0.5rem; margin-top: 0.5rem;">
                <input id="new-category-input-fallback" placeholder="New Category" onkeydown="if(event.key==='Enter') { document.getElementById('new-category-input').value = this.value; addCategory(); this.value=''; }" class="form-input" style="flex:1;" />
                <button onclick="document.getElementById('new-category-input').value = document.getElementById('new-category-input-fallback').value; addCategory(); document.getElementById('new-category-input-fallback').value='';" class="btn btn-secondary btn-icon" title="Add Category"><i data-lucide="plus" style="width:18px;height:18px;"></i></button>
              </div>
              </div>
            </details>

            <!-- Skill Tree Locks -->
            <details class="admin-panel">
              <summary>
                <i data-lucide="chevron-right" class="admin-panel-chev"></i>
                <i data-lucide="lock" style="color:var(--text-tertiary);width:16px;height:16px;"></i>
                <span class="admin-panel-name">Skill Tree Locks</span>
                <span class="admin-panel-count" id="admin-locks-count">0</span>
              </summary>
              <div class="admin-panel-body">
                <div style="display:flex; flex-direction:column; gap:0.75rem; margin-bottom: 0.5rem;" id="admin-lock-rules-preview"></div>

                <div class="tree-node" id="admin-locks-dropdown-wrapper" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md);">
                  <div class="tree-node-row" onclick="toggleAdminSection('admin-locks-content', event)" style="cursor: pointer; padding: 0.75rem 1rem; border-radius: var(--radius-md);">
                    <i data-lucide="chevron-right" class="tree-node-chevron"></i>
                    <span class="tree-node-label" style="font-weight:600; font-size:0.95rem; color: var(--text-secondary);">Show <span id="admin-locks-rest-count">0</span> more locks...</span>
                  </div>
                  <div class="tree-children collapsed" id="admin-locks-content">
                    <div class="tree-children-inner" style="padding: 0 1rem 1rem 1rem;">
                      <div style="display:flex; flex-direction:column; gap:0.75rem;" id="admin-lock-rules-rest"></div>
                    </div>
                  </div>
                </div>
              </div>
            </details>
          </div>
        </div>
      </main>
      <div class="resizer-divider" onmousedown="initResizerDrag(event, this)"></div>
      <section class="messenger-pane-2">
        <div id="admin-empty-state" class="admin-empty-state">
          <div class="admin-empty-content">
            <div class="admin-empty-icon">
              <i data-lucide="edit-3" aria-hidden="true"></i>
            </div>
            <h2 class="admin-empty-title">Select a program to edit</h2>
            <p class="admin-empty-subtitle" id="admin-empty-sub">Choose a program from the left panel, or create a new one.</p>
          </div>
          <button onclick="openNewAdminItem()" class="btn btn-primary bottom-center-action" id="new-program-btn">
            <i data-lucide="plus" style="width:18px;height:18px;"></i> <span id="new-btn-text">Create New Program</span>
          </button>
        </div>
        ${getAdminFormHTML()}
      </section>
    </div>
  `;
}

function adminCodingInit() {
  window.currentAdminMode = 'practice';
  renderAdmin();

  // Populate dynamic header stats
  const totalPrograms = state.challenges ? state.challenges.length : 0;
  const folders = state.nodes.filter(n => n.scope === 'challenge' && n.type === 'folder').length;
  const sub = document.getElementById('admin-coding-header-stats');
  if (sub) {
    sub.textContent = `${totalPrograms} program${totalPrograms !== 1 ? 's' : ''} across ${folders} folder${folders !== 1 ? 's' : ''}`;
  }

  if (typeof renderAdminSets === 'function') renderAdminSets();
  if (typeof bindAdminFormListeners === 'function') bindAdminFormListeners();
  if (typeof bindAdminKeyboardShortcuts === 'function') bindAdminKeyboardShortcuts();
  GuidedTutorial.init('admin-coding');
}

function adminCodingDestroy() {
  window.adminIsDirty = false;
  if (typeof unbindAdminKeyboardShortcuts === 'function') unbindAdminKeyboardShortcuts();
  if (typeof GuidedTutorial !== 'undefined' && GuidedTutorial.end) GuidedTutorial.end();
  if (typeof _aliFolderPickerCleanup === 'function') _aliFolderPickerCleanup();
  if (typeof adminState !== 'undefined') adminState = null;
  window.saveCurrentAdminForm = null;
}


/* --- Notes Admin Wing --- */
function adminNotesTemplate() {
  return `
    <div class="messenger-layout">
      <main class="messenger-pane-1">
        <div class="pane-1-header">
          <div style="display: flex; align-items: center; gap: 0.5rem; width: 100%; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1; min-width: 0;">
              <button onclick="spaNavigate('admin')" class="btn-back-dark" style="margin-right: 0.5rem; padding: 0.25rem 0.5rem; font-size: 0.75rem; flex-shrink: 0;">
                <i data-lucide="chevron-left" style="width:14px;height:14px;"></i> Back
              </button>
              <h2 class="section-header-animated" style="margin: 0; display: flex; align-items: center;">
                <span class="section-header-icon-wrap study-icon-wrap">
                  <i data-lucide="book-open"></i>
                  <span class="section-header-icon-ring"></span>
                </span>
                <span class="section-header-text">
                  <span class="section-header-title">Notes Admin</span>
                  <span class="section-header-subtitle" id="admin-notes-header-stats">Loading...</span>
                </span>
              </h2>
            </div>
            <button class="tutorial-trigger-btn" onclick="GuidedTutorial.start()" title="Show Page Tour" aria-label="Show Page Tour" style="flex-shrink: 0;">
              <i data-lucide="graduation-cap" aria-hidden="true"></i>
            </button>
          </div>
          <div class="search-container" style="width: 100%; margin-top: 0.75rem;">
            <i data-lucide="search"></i>
            <input type="text" id="admin-search-input" class="search-input" placeholder="Search notebooks..." oninput="(window._adminSearchDebounced || (window._adminSearchDebounced = debounce(renderAdmin, 220)))()" aria-label="Search notebooks">
          </div>
          <div id="admin-filter-container"></div>
        </div>
        <div class="pane-1-content">
          <div id="admin-study-wrapper">
            <div style="display:flex; flex-direction:column; gap:0.25rem;" id="notebook-table-body"></div>
            
            <div class="card-flat" style="margin-top: 2rem; padding: 1.25rem;" id="notebook-category-container">
              <h2 style="font-weight:700; font-size:1.1rem; margin-bottom:1rem;">Notebook Categories</h2>
              <ul id="notebook-category-list" style="display:flex; flex-direction:column; gap:0.5rem; margin-bottom:1rem; list-style:none; padding: 0;"></ul>
              <div style="display:flex; gap:0.5rem;">
                <input id="new-notebook-category-input" placeholder="New Category" onkeydown="if(event.key==='Enter') addNotebookCategory()" class="form-input" style="flex:1;" />
                <button onclick="addNotebookCategory()" class="btn btn-secondary btn-icon" title="Add Category"><i data-lucide="plus" style="width:18px;height:18px;"></i></button>
              </div>
            </div>
          </div>
        </div>
      </main>
      <div class="resizer-divider" onmousedown="initResizerDrag(event, this)"></div>
      <section class="messenger-pane-2">
        <div id="admin-empty-state" class="admin-empty-state">
          <div class="admin-empty-content">
            <div class="admin-empty-icon">
              <i data-lucide="edit-3" aria-hidden="true"></i>
            </div>
            <h2 class="admin-empty-title">Select a notebook to edit</h2>
            <p class="admin-empty-subtitle" id="admin-empty-sub">Choose a notebook from the left panel, or create a new one.</p>
          </div>
          <button onclick="openNewAdminItem()" class="btn btn-primary bottom-center-action" id="new-program-btn">
            <i data-lucide="plus" style="width:18px;height:18px;"></i> <span id="new-btn-text">Create New Notebook</span>
          </button>
        </div>
        ${getNotebookFormHTML()}
      </section>
    </div>
  `;
}

function adminNotesInit() {
  window.currentAdminMode = 'study';
  window.currentAdminStudyTab = 'notes';
  renderAdmin();

  // Populate dynamic header stats
  const notebooks = state.notebooks || [];
  const folders = state.nodes.filter(n => n.scope === 'notebook' && n.type === 'folder').length;
  const sub = document.getElementById('admin-notes-header-stats');
  if (sub) {
    sub.textContent = `${notebooks.length} notebook${notebooks.length !== 1 ? 's' : ''} across ${folders} folder${folders !== 1 ? 's' : ''}`;
  }

  if (typeof bindAdminFormListeners === 'function') bindAdminFormListeners();
  if (typeof bindAdminKeyboardShortcuts === 'function') bindAdminKeyboardShortcuts();
  GuidedTutorial.init('admin-notes');
}

function adminNotesDestroy() {
  window.adminIsDirty = false;
  if (typeof unbindAdminKeyboardShortcuts === 'function') unbindAdminKeyboardShortcuts();
  if (typeof GuidedTutorial !== 'undefined' && GuidedTutorial.end) GuidedTutorial.end();
  if (typeof _aliFolderPickerCleanup === 'function') _aliFolderPickerCleanup();
  if (typeof notebookAdminState !== 'undefined') notebookAdminState = null;
  window.saveCurrentAdminForm = null;
}


/* --- Snippets Admin Wing --- */
function adminSnippetsTemplate() {
  return `
    <div class="messenger-layout">
      <main class="messenger-pane-1">
        <div class="pane-1-header">
          <div style="display: flex; align-items: center; gap: 0.5rem; width: 100%; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1; min-width: 0;">
              <button onclick="spaNavigate('admin')" class="btn-back-dark" style="margin-right: 0.5rem; padding: 0.25rem 0.5rem; font-size: 0.75rem; flex-shrink: 0;">
                <i data-lucide="chevron-left" style="width:14px;height:14px;"></i> Back
              </button>
              <h2 class="section-header-animated" style="margin: 0; display: flex; align-items: center;">
                <span class="section-header-icon-wrap snippets-icon-wrap">
                  <i data-lucide="code"></i>
                  <span class="section-header-icon-ring"></span>
                </span>
                <span class="section-header-text">
                  <span class="section-header-title">Snippets Admin</span>
                  <span class="section-header-subtitle" id="admin-snippets-header-stats">Loading...</span>
                </span>
              </h2>
            </div>
            <button class="tutorial-trigger-btn" onclick="GuidedTutorial.start()" title="Show Page Tour" aria-label="Show Page Tour" style="flex-shrink: 0;">
              <i data-lucide="graduation-cap" aria-hidden="true"></i>
            </button>
          </div>
          <div class="search-container" style="width: 100%; margin-top: 0.75rem;">
            <i data-lucide="search"></i>
            <input type="text" id="admin-search-input" class="search-input" placeholder="Search snippets..." oninput="(window._adminSearchDebounced || (window._adminSearchDebounced = debounce(renderAdmin, 220)))()" aria-label="Search snippets">
          </div>
          <div id="admin-filter-container"></div>
        </div>
        <div class="pane-1-content">
          <div id="admin-study-wrapper">
            <div style="display:flex; flex-direction:column; gap:0.25rem;" id="study-table-body"></div>
            
            <div class="card-flat" style="margin-top: 2rem; padding: 1.25rem;" id="study-category-container">
              <h2 style="font-weight:700; font-size:1.1rem; margin-bottom:1rem;">Snippet Categories</h2>
              <ul id="study-category-list" style="display:flex; flex-direction:column; gap:0.5rem; margin-bottom:1rem; list-style:none; padding: 0;"></ul>
              <div style="display:flex; gap:0.5rem;">
                <input id="new-study-category-input" placeholder="New Category" onkeydown="if(event.key==='Enter') addStudyCategory()" class="form-input" style="flex:1;" />
                <button onclick="addStudyCategory()" class="btn btn-secondary btn-icon" title="Add Category"><i data-lucide="plus" style="width:18px;height:18px;"></i></button>
              </div>
            </div>
          </div>
        </div>
      </main>
      <div class="resizer-divider" onmousedown="initResizerDrag(event, this)"></div>
      <section class="messenger-pane-2">
        <div id="admin-empty-state" class="admin-empty-state">
          <div class="admin-empty-content">
            <div class="admin-empty-icon">
              <i data-lucide="edit-3" aria-hidden="true"></i>
            </div>
            <h2 class="admin-empty-title">Select a snippet to edit</h2>
            <p class="admin-empty-subtitle" id="admin-empty-sub">Choose a snippet from the left panel, or create a new one.</p>
          </div>
          <button onclick="openNewAdminItem()" class="btn btn-primary bottom-center-action" id="new-program-btn">
            <i data-lucide="plus" style="width:18px;height:18px;"></i> <span id="new-btn-text">Create New Snippet</span>
          </button>
        </div>
        ${getSnippetFormHTML()}
      </section>
    </div>
  `;
}

function adminSnippetsInit() {
  window.currentAdminMode = 'study';
  window.currentAdminStudyTab = 'snippets';
  renderAdmin();

  // Populate dynamic header stats
  const snippets = state.snippets || [];
  const folders = state.nodes.filter(n => n.scope === 'snippet' && n.type === 'folder').length;
  const sub = document.getElementById('admin-snippets-header-stats');
  if (sub) {
    sub.textContent = `${snippets.length} snippet${snippets.length !== 1 ? 's' : ''} across ${folders} folder${folders !== 1 ? 's' : ''}`;
  }

  if (typeof bindAdminFormListeners === 'function') bindAdminFormListeners();
  if (typeof bindAdminKeyboardShortcuts === 'function') bindAdminKeyboardShortcuts();
  GuidedTutorial.init('admin-snippets');
}

function adminSnippetsDestroy() {
  window.adminIsDirty = false;
  if (typeof unbindAdminKeyboardShortcuts === 'function') unbindAdminKeyboardShortcuts();
  if (typeof GuidedTutorial !== 'undefined' && GuidedTutorial.end) GuidedTutorial.end();
  if (typeof _aliFolderPickerCleanup === 'function') _aliFolderPickerCleanup();
  if (typeof studyModeState !== 'undefined') studyModeState = null;
  window.saveCurrentAdminForm = null;
}
