/* ============================================================
   MINDMAP.JS — Interactive Visualization / Hierarchy Mindmap
   ============================================================ */

let mindmapActiveScope = 'all'; // 'all', 'challenge', 'snippet', 'notebook'
let mindmapExpandedNodes = new Set();

function openMindmap() {
  const overlay = document.getElementById('mindmap-overlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  renderMindmap();
}

function closeMindmap() {
  const overlay = document.getElementById('mindmap-overlay');
  if (overlay) overlay.classList.add('hidden');
}

function setMindmapScope(scope) {
  mindmapActiveScope = scope;
  renderMindmap();
}

function toggleMindmapNode(nodeId, e) {
  if (e) { e.stopPropagation(); e.preventDefault(); }
  if (mindmapExpandedNodes.has(nodeId)) {
    mindmapExpandedNodes.delete(nodeId);
  } else {
    mindmapExpandedNodes.add(nodeId);
  }
  renderMindmap();
}

function mindmapExpandAll() {
  const scopes = mindmapActiveScope === 'all'
    ? ['challenge', 'snippet', 'notebook']
    : [mindmapActiveScope];
  state.nodes.filter(n => scopes.includes(n.scope)).forEach(n => mindmapExpandedNodes.add(n.id));
  // Also add scope root keys
  scopes.forEach(s => mindmapExpandedNodes.add('scope-' + s));
  renderMindmap();
}

function mindmapCollapseAll() {
  mindmapExpandedNodes.clear();
  renderMindmap();
}

function renderMindmap() {
  const body = document.getElementById('mindmap-body');
  if (!body) return;

  // Scope tabs
  const tabsContainer = document.getElementById('mindmap-scope-tabs');
  if (tabsContainer) {
    const scopes = [
      { id: 'all', label: 'All', icon: 'layers' },
      { id: 'challenge', label: 'Programs', icon: 'code' },
      { id: 'snippet', label: 'Snippets', icon: 'file-text' },
      { id: 'notebook', label: 'Notebooks', icon: 'book' }
    ];
    tabsContainer.innerHTML = scopes.map(s => `
      <button class="mindmap-scope-tab ${mindmapActiveScope === s.id ? 'active' : ''}" onclick="setMindmapScope('${s.id}')">
        <i data-lucide="${s.icon}" style="width:14px;height:14px;"></i> ${s.label}
      </button>
    `).join('');
  }

  const scopesToRender = mindmapActiveScope === 'all'
    ? ['challenge', 'snippet', 'notebook']
    : [mindmapActiveScope];

  const scopeLabels = { challenge: 'Coding Library', snippet: 'Snippets', notebook: 'Notebooks' };
  const scopeIcons = { challenge: 'layout-template', snippet: 'file-text', notebook: 'book' };
  const scopeColors = { challenge: 'var(--color-primary)', snippet: 'var(--color-accent)', notebook: 'var(--color-success)' };

  let html = '<div class="mm-tree">';

  scopesToRender.forEach(scope => {
    const scopeKey = 'scope-' + scope;
    const scopeExpanded = mindmapExpandedNodes.has(scopeKey);
    const rootFolders = state.nodes.filter(n => n.scope === scope && n.type === 'folder' && (n.parentId || null) === null);
    const rootItems = getItemsForScope(scope).filter(item => (item.parentId || null) === null);
    const totalCount = state.nodes.filter(n => n.scope === scope).length + getItemsForScope(scope).length;

    html += `
      <div class="mm-node">
        <div class="mm-node-row mm-folder" onclick="toggleMindmapNode('${scopeKey}')" style="background: linear-gradient(135deg, rgba(99,102,241,0.06), transparent); border: 1px solid var(--border-color); margin-bottom: 0.25rem;">
          <i data-lucide="chevron-right" class="mm-chevron ${scopeExpanded ? 'expanded' : ''}"></i>
          <i data-lucide="${scopeIcons[scope]}" class="mm-icon" style="color: ${scopeColors[scope]};"></i>
          <span class="mm-node-label" style="font-size: 1rem; font-weight: 800; letter-spacing: 0.02em;">${scopeLabels[scope]}</span>
          <span class="mm-node-meta">${totalCount} total</span>
        </div>
        <div class="mm-children ${scopeExpanded ? '' : 'collapsed'}">
          <ul>
            ${renderMindmapTree(null, scope, 0)}
            ${rootItems.map(item => renderMindmapItem(item, scope)).join('')}
          </ul>
          <button class="mm-add-btn" onclick="mindmapAddFolder('${scope}', null)">
            <i data-lucide="plus" style="width:12px;height:12px;"></i> Add Folder
          </button>
        </div>
      </div>
    `;
  });

  html += '</div>';
  body.innerHTML = html;

  // FIX: Scope Lucide icon creation ONLY to the mindmap body to prevent global DOM lag
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: body });
}

function renderMindmapTree(parentId, scope, depth) {
  const folders = state.nodes.filter(n =>
    n.scope === scope && n.type === 'folder' && (n.parentId || null) === (parentId || null)
  );

  let html = '';
  folders.forEach(folder => {
    const expanded = mindmapExpandedNodes.has(folder.id);
    const childFolders = state.nodes.filter(n => n.scope === scope && n.parentId === folder.id);

    // FIX: Safely fallback to null to ensure uncategorized items don't break strict equality
    const directItems = getItemsForScope(scope).filter(item => (item.parentId || null) === folder.id);

    const hasChildren = childFolders.length > 0 || directItems.length > 0;
    const chevronClass = hasChildren ? (expanded ? 'expanded' : '') : 'invisible';

    // getTierBadgeHTML now safely imported globally from utils.js
    const tierBadge = typeof getTierBadgeHTML === 'function' ? getTierBadgeHTML(folder.tier) : '';
    const totalCount = countItemsRecursive(folder.id, scope);

    html += `
      <li class="mm-node">
        <div class="mm-node-row mm-folder" onclick="toggleMindmapNode('${folder.id}')">
          <i data-lucide="chevron-right" class="mm-chevron ${chevronClass}" onclick="toggleMindmapNode('${folder.id}', event)"></i>
          <i data-lucide="${folder.icon || 'folder'}" class="mm-icon"></i>
          <span class="mm-node-label">${escapeHTML(folder.name)}</span>
          ${tierBadge}
          <span class="mm-node-meta">${totalCount}</span>
        </div>
        <div class="mm-children ${expanded ? '' : 'collapsed'}">
          <ul>
            ${renderMindmapTree(folder.id, scope, depth + 1)}
            ${directItems.map(item => renderMindmapItem(item, scope)).join('')}
          </ul>
          <button class="mm-add-btn" onclick="mindmapAddFolder('${scope}', '${folder.id}')">
            <i data-lucide="plus" style="width:12px;height:12px;"></i> Add Subfolder
          </button>
        </div>
      </li>
    `;
  });

  return html;
}

function renderMindmapItem(item, scope) {
  const iconMap = { challenge: 'code', snippet: 'file-text', notebook: 'book' };
  const icon = item.icon || iconMap[scope] || 'file';
  const title = item.title || item.name || 'Untitled';

  return `
    <li class="mm-node">
      <div class="mm-node-row mm-item">
        <i data-lucide="chevron-right" class="mm-chevron invisible"></i>
        <i data-lucide="${icon}" class="mm-icon"></i>
        <span class="mm-node-label">${escapeHTML(title)}</span>
      </div>
    </li>
  `;
}

function getItemsForScope(scope) {
  if (scope === 'challenge') return state.challenges || [];
  if (scope === 'snippet') return state.snippets || [];
  if (scope === 'notebook') return state.notebooks || [];
  return [];
}

function mindmapAddFolder(scope, parentId) {
  showInputDialog('New Folder', null, 'Folder name', '', (name) => {
    createNode(name.trim(), 'folder', parentId, scope);
    if (parentId) mindmapExpandedNodes.add(parentId);
    mindmapExpandedNodes.add('scope-' + scope);
    saveData();
    renderMindmap();
  });
}