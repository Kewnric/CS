/* ============================================================
   ADMIN-PREREQ.JS — Prerequisite Picker Modal
   ============================================================ */

// ======================== PREREQUISITE PICKER MODAL ========================
let _prereqPickerFolderId = null;
let _prereqPickerSelected = new Set();

function openPrereqPicker(folderId) {
  _prereqPickerFolderId = folderId;
  const req = state.categoryRequirements[folderId] || {};
  // Backward compat: support old format { reqNodeId, count } and new { requiredChallengeIds }
  if (req.requiredChallengeIds) {
    _prereqPickerSelected = new Set(req.requiredChallengeIds);
  } else if (req.reqNodeId) {
    // Legacy: convert old format - select all challenges in that folder
    const oldChallenges = state.challenges.filter(c => c.parentId === req.reqNodeId);
    _prereqPickerSelected = new Set(oldChallenges.slice(0, req.count || 1).map(c => c.id));
  } else {
    _prereqPickerSelected = new Set();
  }

  const folder = state.nodes.find(n => n.id === folderId);
  const folderName = folder ? folder.name : 'Unknown';

  let overlay = document.getElementById('prereq-picker-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'prereq-picker-overlay';
    overlay.className = 'prereq-picker-overlay';
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="prereq-picker-window">
      <div class="prereq-picker-header">
        <h2><i data-lucide="shield"></i> Prerequisites for "${escapeHTML(folderName)}"</h2>
        <button onclick="closePrereqPicker()" class="btn btn-ghost" style="padding:0.25rem;"><i data-lucide="x" style="width:20px;height:20px;"></i></button>
      </div>
      <div class="prereq-picker-search">
        <div class="prereq-picker-search-wrapper">
          <i data-lucide="search"></i>
          <input type="text" id="prereq-picker-search-input" placeholder="Search programs..." oninput="renderPrereqPickerBody()">
        </div>
      </div>
      <div class="prereq-picker-body" id="prereq-picker-body"></div>
      <div class="prereq-picker-footer">
        <div class="prereq-picker-count"><span id="prereq-picker-count-num">0</span> prerequisite(s) selected</div>
        <div style="display:flex; gap:0.5rem;">
          <button onclick="closePrereqPicker()" class="btn btn-ghost">Cancel</button>
          <button onclick="savePrereqPicker()" class="btn btn-primary" style="background:var(--color-warning); border-color:var(--color-warning);">
            <i data-lucide="check" style="width:16px;height:16px;"></i> Save
          </button>
        </div>
      </div>
    </div>
  `;

  lucide.createIcons({ root: overlay });
  renderPrereqPickerBody();
}

function renderPrereqPickerBody() {
  const body = document.getElementById('prereq-picker-body');
  if (!body) return;

  const searchInput = document.getElementById('prereq-picker-search-input');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  let html = '';

  // Build a recursive folder tree with challenges
  function renderFolderBranch(parentId, depth) {
    const folders = getChildFolders(parentId, 'challenge');
    let branchHtml = '';

    folders.forEach(folder => {
      const challenges = state.challenges.filter(c => c.parentId === folder.id);
      const filteredChallenges = query
        ? challenges.filter(c => fuzzyMatch(c.title, query) || (c.tags || []).some(t => fuzzyMatch(t, query)))
        : challenges;

      // Check if subfolder branches have matching items
      const subHtml = renderFolderBranch(folder.id, depth + 1);
      if (filteredChallenges.length === 0 && !subHtml) return;

      branchHtml += `<div class="prereq-picker-folder">
        <div class="prereq-picker-folder-header" style="padding-left:${depth * 0.75}rem;">
          <i data-lucide="folder" style="color:var(--color-accent);"></i>
          ${escapeHTML(folder.name)}
          <span style="margin-left:auto; font-size:0.6rem; color:var(--text-tertiary);">${filteredChallenges.length} program${filteredChallenges.length !== 1 ? 's' : ''}</span>
        </div>`;

      filteredChallenges.forEach(c => {
        const isChecked = _prereqPickerSelected.has(c.id);
        const isCompleted = state.history.some(h => h.challengeId === c.id && h.score === 100 && !h.isArchived);
        branchHtml += `
          <div class="prereq-picker-item ${isChecked ? 'checked' : ''}" onclick="togglePrereqItem('${c.id}')">
            <i data-lucide="code" style="width:14px;height:14px;color:var(--text-tertiary);flex-shrink:0;"></i>
            <span class="prereq-picker-item-label">${escapeHTML(c.title)}</span>
            ${isCompleted ? '<span class="prereq-picker-item-meta" style="color:var(--color-success);">✓ Done</span>' : '<span class="prereq-picker-item-meta">Not done</span>'}
            <input type="checkbox" class="prereq-picker-checkbox" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation(); togglePrereqItem('${c.id}')">
          </div>
        `;
      });

      branchHtml += subHtml;
      branchHtml += `</div>`;
    });

    return branchHtml;
  }

  html += renderFolderBranch(null, 0);

  // Root-level (uncategorized) challenges
  const rootChallenges = state.challenges.filter(c => !c.parentId);
  const filteredRoot = query
    ? rootChallenges.filter(c => fuzzyMatch(c.title, query) || (c.tags || []).some(t => fuzzyMatch(t, query)))
    : rootChallenges;

  if (filteredRoot.length > 0) {
    html += `<div class="prereq-picker-folder">
      <div class="prereq-picker-folder-header">
        <i data-lucide="inbox" style="color:var(--text-tertiary);"></i>
        Uncategorized
        <span style="margin-left:auto; font-size:0.6rem; color:var(--text-tertiary);">${filteredRoot.length}</span>
      </div>`;

    filteredRoot.forEach(c => {
      const isChecked = _prereqPickerSelected.has(c.id);
      const isCompleted = state.history.some(h => h.challengeId === c.id && h.score === 100 && !h.isArchived);
      html += `
        <div class="prereq-picker-item ${isChecked ? 'checked' : ''}" onclick="togglePrereqItem('${c.id}')">
          <i data-lucide="code" style="width:14px;height:14px;color:var(--text-tertiary);flex-shrink:0;"></i>
          <span class="prereq-picker-item-label">${escapeHTML(c.title)}</span>
          ${isCompleted ? '<span class="prereq-picker-item-meta" style="color:var(--color-success);">✓ Done</span>' : '<span class="prereq-picker-item-meta">Not done</span>'}
          <input type="checkbox" class="prereq-picker-checkbox" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation(); togglePrereqItem('${c.id}')">
        </div>
      `;
    });

    html += `</div>`;
  }

  if (!html) {
    html = `<div class="prereq-picker-empty">
      <i data-lucide="search-x"></i>
      <p>No programs found${query ? ` matching "${escapeHTML(query)}"` : ''}.</p>
    </div>`;
  }

  body.innerHTML = html;
  lucide.createIcons({ root: body });

  // Update count
  const countEl = document.getElementById('prereq-picker-count-num');
  if (countEl) countEl.textContent = _prereqPickerSelected.size;
}

function togglePrereqItem(challengeId) {
  if (_prereqPickerSelected.has(challengeId)) {
    _prereqPickerSelected.delete(challengeId);
  } else {
    _prereqPickerSelected.add(challengeId);
  }
  renderPrereqPickerBody();
}

function savePrereqPicker() {
  if (!_prereqPickerFolderId) return;

  if (!state.categoryRequirements) state.categoryRequirements = {};

  if (_prereqPickerSelected.size === 0) {
    delete state.categoryRequirements[_prereqPickerFolderId];
  } else {
    state.categoryRequirements[_prereqPickerFolderId] = {
      requiredChallengeIds: Array.from(_prereqPickerSelected)
    };
  }

  saveData();
  closePrereqPicker();
  renderAdmin();
}

function closePrereqPicker() {
  const overlay = document.getElementById('prereq-picker-overlay');
  if (overlay) overlay.remove();
  _prereqPickerFolderId = null;
  _prereqPickerSelected = new Set();
}
