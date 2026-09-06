/* ============================================================
   VIZ-STATE.JS — Core State, Persistence, and Utilities
   ============================================================ */

const viz = {
  /* Two surfaces, not five modules: the library map, and Brain. Which
     LIBRARIES the map shows is a separate question, answered by `scopes` —
     "General" was only ever all three at once. */
  activeModule: 'library',
  scopes: ['challenge'],
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

  /* Colour by a rule rather than by hand — see vizNodeTint. */
  tintRule: 'none',
  /* Local graph: show only the neighbourhood of one node. 0 hops = off. */
  focusNodeId: null,
  focusHops: 0,
  /* More than one node can be selected now; selectedNodeId stays as the
     "primary" for the things that only make sense for one (rename, popup). */
  selectedNodeIds: new Set(),
  marquee: null,
  savedViews: [],
  /* The header stat chips are filters now: null | 'placed' | 'starred'. */
  paneFilter: null,
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
  // Comments and frames are things you drew, not library structure, so they
  // survive every setting — hiding your own annotations was never the point.
  if (node.type === 'comment' || node.type === 'frame') return true;
  if (viz.canvasDepth === 'folders') return node.type === 'folder' || node.type === 'root';
  if (viz.canvasDepth === 'items') return node.type !== 'folder' && node.type !== 'root';
  return true;
}

/* 40 snapshots of a 181-node graph is ~2.4 MB held in memory for the whole
   session, and the count told you nothing about that. Cap the bytes instead:
   a small graph keeps a deep history, a huge one keeps a shallow one. */
const VIZ_UNDO_BYTES = 3000000;

function vizPushUndo() {
  /* JSON.stringify already deep-copies; the JSON.parse(JSON.stringify(...))
     inside it was a second full clone thrown away immediately. */
  viz._undoStack.push(JSON.stringify({ nodes: viz.nodes, links: viz.links }));
  let bytes = 0;
  for (let i = viz._undoStack.length - 1; i >= 0; i--) {
    bytes += viz._undoStack[i].length;
    if (bytes > VIZ_UNDO_BYTES && i > 0) { viz._undoStack.splice(0, i); break; }
  }
  if (viz._undoStack.length > 60) viz._undoStack.splice(0, viz._undoStack.length - 60);
  const btn = document.getElementById('viz-undo-btn');
  if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
}

/**
 * Undo the last canvas edit.
 *
 * A DELETE is the exception, and it used to be a lie: vizDeleteNode removes
 * the library record as well as the node, so restoring viz.nodes put the node
 * back and the vizRenderCanvas() on the next line took it straight out again
 * (vizPruneGhostNodes drops any node whose record is gone). The button lit up
 * offering a recovery it could not perform. Now the app-wide undo — the one
 * that actually holds the deleted record — runs first, and the canvas snapshot
 * is applied on top of it.
 */
function vizUndo() {
  if (!viz._undoStack.length) return;
  const snap = JSON.parse(viz._undoStack.pop());

  const missing = snap.nodes.some(n => n.dataId && n.dataId !== 'root' && !vizRecordExists(n));
  if (missing && typeof hasUndo === 'function' && hasUndo() && typeof popUndo === 'function') {
    popUndo();
  }

  viz.nodes = snap.nodes;
  viz.links = snap.links;
  viz.collapsedNodeIds = new Set(viz.nodes.filter(n => n.collapsed).map(n => n.id));
  const live = new Set(viz.nodes.map(n => n.id));
  viz.selectedNodeIds = new Set([...viz.selectedNodeIds].filter(id => live.has(id)));
  if (viz.selectedNodeId && !live.has(viz.selectedNodeId)) viz.selectedNodeId = null;
  if (viz.focusNodeId && !live.has(viz.focusNodeId)) viz.focusNodeId = null;
  vizRenderCanvas();
  vizRenderContentPane();
  vizSave();
  const btn = document.getElementById('viz-undo-btn');
  if (btn && viz._undoStack.length === 0) { btn.disabled = true; btn.style.opacity = '0.5'; }
}

/** Is the library record this canvas node stands for still there? */
function vizRecordExists(node) {
  const id = node.dataId;
  if (!id) return true;
  if (node.type === 'folder' || node.type === 'root') return (state.nodes || []).some(n => n.id === id);
  if (node.type === 'challenge') return (state.challenges || []).some(c => c.id === id);
  if (node.type === 'snippet') return (state.snippets || []).some(x => x.id === id);
  if (node.type === 'notebook') return (state.notebooks || []).some(x => x.id === id);
  return true;
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

/* Writing 61 KB of nodes and links on every drag end, pan end and zoom settle
   was most of what the canvas did between frames. The write is debounced now;
   vizSaveNow() flushes it, and route destroy calls that. */
let _vizSaveTimer = null;

function _vizSnapshot() {
  return {
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
    scopes: viz.scopes,
    // These three were read back at init but never written, so the paint
    // colour silently reset to blue on every reload and the toolbar sync for
    // colour mode was dead code.
    colorModeEnabled: viz.colorModeEnabled,
    colorPaintColor: viz.colorPaintColor,
    tintRule: viz.tintRule,
    focusHops: viz.focusHops,
    savedViews: viz.savedViews,
  };
}

let _vizSaveFailed = false;

function vizSaveNow() {
  if (_vizSaveTimer) { clearTimeout(_vizSaveTimer); _vizSaveTimer = null; }
  try {
    localStorage.setItem(getVizStorageKey(), JSON.stringify(_vizSnapshot()));
    _vizSaveFailed = false;
  } catch (e) {
    // A full quota used to be a console warning and nothing else, so losing
    // the canvas looked exactly like saving it.
    console.warn('[Viz] save failed', e);
    if (!_vizSaveFailed && typeof toast === 'function') {
      toast('Could not save the canvas — browser storage is full. Export a backup before you lose work.',
        { type: 'error', duration: 12000 });
    }
    _vizSaveFailed = true;
    return;
  }
  if (typeof scheduleCloudSave === 'function') scheduleCloudSave();
}

function vizSave() {
  if (_vizSaveTimer) return;
  _vizSaveTimer = setTimeout(() => { _vizSaveTimer = null; vizSaveNow(); }, 400);
}

function vizLoad() {
  const raw = localStorage.getItem(getVizStorageKey());
  if (raw) {
    try {
      const d = JSON.parse(raw);
      viz.nodes = d.nodes || [];
      viz.links = d.links || [];
      viz.pan = d.pan || { x: 0, y: 0 };
      viz.zoom = vizClampZoom(d.zoom || 1);
      viz.fogEnabled = !!d.fogEnabled;
      viz.panesSwapped = !!d.panesSwapped;
      viz.tabsCollapsed = !!d.tabsCollapsed;
      viz.toolbarCollapsed = !!d.toolbarCollapsed;
      viz.flowyDragEnabled = !!d.flowyDragEnabled;
      viz.globeModeEnabled = !!d.globeModeEnabled;
      viz.snapEnabled = !!d.snapEnabled;
      viz.colorModeEnabled = !!d.colorModeEnabled;
      if (d.colorPaintColor !== undefined) viz.colorPaintColor = d.colorPaintColor;
      if (d.tintRule && VIZ_TINT_RULES[d.tintRule]) viz.tintRule = d.tintRule;
      viz.focusHops = Number(d.focusHops) || 0;
      viz.savedViews = Array.isArray(d.savedViews) ? d.savedViews : [];
      if (d.defaultLinkArrowType) viz.defaultLinkArrowType = d.defaultLinkArrowType;
      viz.expandedFolderIds = new Set(d.expandedFolderIds || []);
      if (VIZ_DEPTHS.indexOf(d.canvasDepth) !== -1) viz.canvasDepth = d.canvasDepth;
      if (Array.isArray(d.scopes)) {
        const clean = d.scopes.filter(sc => VIZ_LIBRARY_SCOPES.includes(sc));
        if (clean.length) viz.scopes = clean;
      }
      viz.collapsedNodeIds = new Set(d.collapsedNodeIds || []);
      viz.collapsedNodeIds.forEach(id => {
        const node = viz.nodes.find(n => n.id === id);
        if (node) node.collapsed = true;
      });
      // The focus target is deliberately not restored: coming back to a canvas
      // showing three of your 181 nodes with no visible reason why is worse
      // than losing the focus.
      viz.focusNodeId = null;
    } catch (e) { console.warn('[Viz] load failed', e); }
  }
}

function vizToggleFog() {
  viz.fogEnabled = !viz.fogEnabled;
  if (typeof vizSyncMoreMenu === 'function') vizSyncMoreMenu();
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
    btn.setAttribute('aria-pressed', String(!!viz.linkModeEnabled));
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
