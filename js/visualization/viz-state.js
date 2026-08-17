/* ============================================================
   VIZ-STATE.JS — Core State, Persistence, and Utilities
   ============================================================ */

const viz = {
  activeModule: 'challenge',
  selectedNodeId: null,
  selectedFolderId: null,
  folderStatePerModule: {},
  nodes: [],
  links: [],
  pan: { x: 0, y: 0 },
  zoom: 1,
  isPanning: false,
  panStart: { x: 0, y: 0 },
  panStartOffset: { x: 0, y: 0 },
  draggingNode: null,
  dragOffset: { x: 0, y: 0 },
  linkingFrom: null,
  portDrag: null,
  contextPos: null,
  contextNodeId: null,
  contextLinkId: null,
  popupTargetNode: null,
  fogEnabled: false,
  linkModeEnabled: false,
  snapEnabled: false,
  snapGrid: 20,
  searchQuery: '',
  highlightedNodeIds: new Set(),
  _undoStack: [],
  _dragStartPos: null,
  colorModeEnabled: false,
  colorPaintColor: 'blue',
  defaultLinkArrowType: 'arrow',
  flowyDragEnabled: false,
  globeModeEnabled: false,
  expandedFolderIds: new Set(),
  collapsedNodeIds: new Set(),
  paneQuery: '',
  canvasDepth: 'all',            // see VIZ_DEPTHS

  panesSwapped: false,
  toolbarCollapsed: false,
  tabsCollapsed: false,
};

// (Removed VIZ_STORAGE_KEY constant, using getVizStorageKey() instead)

/* How much of the tree the canvas draws. Auto-populate places a node for every
   folder AND every item, which on the General canvas was 26 folders/roots
   holding up 54 leaves — "folders" alone turns that into a readable map of the
   structure. */
const VIZ_DEPTHS = ['all', 'folders', 'items'];
const VIZ_DEPTH_META = {
  all: { label: 'Folders + items', icon: 'list-tree' },
  folders: { label: 'Folders only', icon: 'folder-tree' },
  items: { label: 'Items only', icon: 'file' }
};

function vizSetDepth(mode) {
  if (VIZ_DEPTHS.indexOf(mode) === -1) return;
  viz.canvasDepth = mode;
  vizSave();
  const popup = document.getElementById('viz-depth-popup');
  if (popup) popup.classList.add('hidden');
  vizSyncDepthBtn();
  vizRenderCanvas();
  setTimeout(() => vizCenterCanvas(), 30);
}

function vizToggleDepthMenu() {
  const el = document.getElementById('viz-depth-popup');
  if (el) el.classList.toggle('hidden');
}

function vizSyncDepthBtn() {
  const btn = document.getElementById('viz-depth-btn');
  if (btn) {
    btn.title = 'Canvas shows: ' + (VIZ_DEPTH_META[viz.canvasDepth] || VIZ_DEPTH_META.all).label;
    btn.classList.toggle('is-active', viz.canvasDepth !== 'all');
  }
  document.querySelectorAll('#viz-depth-popup .viz-link-type-option').forEach(o => {
    o.classList.toggle('active', o.dataset.depth === viz.canvasDepth);
  });
}

/** Does the canvas draw this node under the current depth setting? */
function vizDepthAllows(node) {
  if (viz.canvasDepth === 'folders') return node.type === 'folder' || node.type === 'root' || node.type === 'comment';
  if (viz.canvasDepth === 'items') return node.type !== 'folder' && node.type !== 'root';
  return true;
}

function vizPushUndo() {
  viz._undoStack.push(JSON.stringify({ 
    nodes: JSON.parse(JSON.stringify(viz.nodes)), 
    links: JSON.parse(JSON.stringify(viz.links)) 
  }));
  if (viz._undoStack.length > 40) viz._undoStack.shift();
  const btn = document.getElementById('viz-undo-btn');
  if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
}

function vizUndo() {
  if (!viz._undoStack.length) return;
  const snap = JSON.parse(viz._undoStack.pop());
  viz.nodes = snap.nodes;
  viz.links = snap.links;
  viz.collapsedNodeIds = new Set(viz.nodes.filter(n => n.collapsed).map(n => n.id));
  vizRenderCanvas();
  vizSave();
  const btn = document.getElementById('viz-undo-btn');
  if (btn && viz._undoStack.length === 0) { btn.disabled = true; btn.style.opacity = '0.5'; }
}

function vizToggleSnap() {
  viz.snapEnabled = !viz.snapEnabled;
  vizSyncSnapBtn();
  vizSave();
}

/** Keep the toolbar's grid button showing the state it actually holds. */
function vizSyncSnapBtn() {
  const btn = document.getElementById('viz-snap-btn');
  if (!btn) return;
  btn.classList.toggle('is-active', viz.snapEnabled);
  btn.style.color = '';
  const label = 'Snap to grid: ' + (viz.snapEnabled ? 'on' : 'off');
  btn.title = label;
  btn.dataset.tip = label;
  btn.setAttribute('aria-pressed', String(!!viz.snapEnabled));
}

function vizSnapCoord(v) {
  if (!viz.snapEnabled) return v;
  return Math.round(v / viz.snapGrid) * viz.snapGrid;
}

function vizSave() {
  const d = {
    nodes: viz.nodes,
    links: viz.links,
    pan: viz.pan,
    zoom: viz.zoom,
    fogEnabled: viz.fogEnabled,
    panesSwapped: viz.panesSwapped,
    tabsCollapsed: viz.tabsCollapsed,
    toolbarCollapsed: viz.toolbarCollapsed,
    flowyDragEnabled: viz.flowyDragEnabled,
    globeModeEnabled: viz.globeModeEnabled,
    snapEnabled: viz.snapEnabled,
    defaultLinkArrowType: viz.defaultLinkArrowType,
    collapsedNodeIds: [...viz.collapsedNodeIds],
    // Which sidebar folders are open. General opens with its three library
    // headings collapsed the first time (all three at once is 2700px of list in
    // a 600px pane) — after that it is whatever you left it as.
    expandedFolderIds: [...viz.expandedFolderIds],
    canvasDepth: viz.canvasDepth,
  };
  try { localStorage.setItem(getVizStorageKey(), JSON.stringify(d)); } catch (e) { console.warn('[Viz] save failed', e); }
  if (typeof scheduleCloudSave === 'function') scheduleCloudSave();
}

function vizLoad() {
  const raw = localStorage.getItem(getVizStorageKey());
  if (raw) {
    try {
      const d = JSON.parse(raw);
      viz.nodes = d.nodes || [];
      viz.links = d.links || [];
      viz.pan = d.pan || { x: 0, y: 0 };
      viz.zoom = d.zoom || 1;
      viz.fogEnabled = !!d.fogEnabled;
      viz.panesSwapped = !!d.panesSwapped;
      viz.tabsCollapsed = !!d.tabsCollapsed;
      viz.toolbarCollapsed = !!d.toolbarCollapsed;
      viz.flowyDragEnabled = !!d.flowyDragEnabled;
      viz.globeModeEnabled = !!d.globeModeEnabled;
      viz.snapEnabled = !!d.snapEnabled;
      if (d.defaultLinkArrowType) viz.defaultLinkArrowType = d.defaultLinkArrowType;
      viz.expandedFolderIds = new Set(d.expandedFolderIds || []);
      if (VIZ_DEPTHS.indexOf(d.canvasDepth) !== -1) viz.canvasDepth = d.canvasDepth;
      viz.collapsedNodeIds = new Set(d.collapsedNodeIds || []);
      viz.collapsedNodeIds.forEach(id => {
        const node = viz.nodes.find(n => n.id === id);
        if (node) node.collapsed = true;
      });
    } catch (e) { console.warn('[Viz] load failed', e); }
  }
}

function vizToggleFog() {
  viz.fogEnabled = !viz.fogEnabled;
  const btn = document.getElementById('viz-fog-toggle-btn');
  if (btn) {
    btn.classList.toggle('is-active', viz.fogEnabled);
    btn.classList.add('viz-state-fog');
    btn.innerHTML = viz.fogEnabled
      ? `<i data-lucide="eye" style="width:12px;height:12px;"></i> Fog`
      : `<i data-lucide="eye-off" style="width:12px;height:12px;"></i> Fog`;
    btn.style.color = '';
    btn.style.borderColor = '';
    if (typeof lucide !== 'undefined') lucide.createIcons({ el: btn });
  }
  vizSave();
  vizRenderCanvas();
}

function vizToggleLinkMode() {
  // Dispatch to brain module when active — brain has its own link state
  if (typeof viz !== 'undefined' && viz.activeModule === 'brain') {
    if (typeof brainToggleLinkMode === 'function') brainToggleLinkMode();
    return;
  }

  viz.linkModeEnabled = !viz.linkModeEnabled;

  // Turn off color mode if enabling link mode
  if (viz.linkModeEnabled && viz.colorModeEnabled) {
    viz.colorModeEnabled = false;
    const colorBtn = document.getElementById('viz-color-toggle-btn');
    if (colorBtn) { colorBtn.classList.remove('is-active'); colorBtn.style.color = ''; colorBtn.style.borderColor = ''; }
    const colorPopup = document.getElementById('viz-color-mode-popup');
    if (colorPopup) colorPopup.classList.add('hidden');
    const container = document.getElementById('viz-canvas-container');
    if (container) container.classList.remove('color-paint-mode');
  }

  if (!viz.linkModeEnabled && viz.linkingFrom) {
    vizCancelLinking();
  }

  const btn = document.getElementById('viz-link-toggle-btn');
  if (btn) {
    btn.classList.toggle('is-active', viz.linkModeEnabled);
    btn.style.color = '';
    btn.style.borderColor = '';
  }
  // Apply cursor hint on canvas
  const container = document.getElementById('viz-canvas-container');
  if (container) container.classList.toggle('linking-mode', viz.linkModeEnabled);
}

function vizColorMap(color) {
  const map = { red: '#ef4444', orange: '#f97316', yellow: '#eab308', green: '#22c55e', blue: '#3b82f6', purple: '#a855f7', pink: '#ec4899', cyan: '#06b6d4' };
  return map[color] || 'var(--text-tertiary)';
}
