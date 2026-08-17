/* ============================================================
   STATE.JS — Global State, Data Persistence, Local Storage
   ============================================================ */

// Collision-resistant IDs. Prefer crypto.randomUUID (migration mints many IDs
// in tight loops — 9-char Math.random risked collisions that silently merge
// folders/items). Falls back for very old browsers.
const generateId = () =>
  (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : 'id_' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);

// --- Global State ---
let state = {
  view: 'browse',
  // Legacy (kept for migration only)
  categories: ['Basics', 'Algorithms', 'Data Structures'],
  snippetCategories: ['Basics/Loops', 'Basics/Functions', 'Advanced/Web'],
  notebookCategories: ['General'],
  // New Tree System
  nodes: [],            // Array of { id, type:'folder', name, parentId, scope }
  expandedNodes: [],     // Array of node IDs currently expanded in tree UI
  activeNodeId: null,    // Currently selected folder node ID
  // Existing
  categoryRequirements: {},
  snippetProgress: {},
  badges: [],
  snippets: [],
  notebooks: [],
  notebookHistory: [],
  snippetHistory: [],
  challenges: [],
  codingSets: [],        // Multi-problem practice sets: { id, title, description, problems: [...] }
  history: [],
  activeAttempts: {},
  review: {},            // Spaced-repetition state, keyed "<type>:<id>" (see review.js)
  activeChallenge: null,
  activeVariant: null,
  userCode: '',
  sessionData: null,
  timeLimit: 0,
  lastDiffs: []
};

// Admin Flow State
let adminState = null;
let pendingChallengeId = null;
let activeTimerInterval = null;

// --- Data Migration ---
function migrateLegacyData(challenges) {
  return challenges.map(c => {
    if (!c.tags) c.tags = [];
    if (!c.variants) {
      return {
        id: c.id,
        title: c.title,
        category: c.category,
        tags: c.tags,
        coverDescription: c.description || '',
        variants: [{
          id: generateId(),
          name: 'Version 1',
          description: c.description || '',
          code: c.code || '',
          starterCode: '',
          files: [{ id: generateId(), name: 'main', ext: '.c', starterCode: '', code: c.code || '' }],
          samples: []
        }]
      };
    }
    // Migrate variants that don't yet have a files[] array
    c.variants = c.variants.map(v => {
      if (!v.files || v.files.length === 0) {
        v.files = [{ id: generateId(), name: 'main', ext: '.c', starterCode: v.starterCode || '', code: v.code || '' }];
      }
      if (!v.samples) v.samples = [];
      if (!v.hints) v.hints = [];
      if (!v.tests) v.tests = [];   // test cases: { id, name, stdin, expected, hidden }
      if (!v.minRequirements) v.minRequirements = [];  // required constructs: { id, type }
      return v;
    });
    return c;
  });
}


// --- Migrate flat categories to tree nodes ---
function migrateCategoriesToNodes(parsed) {
  const nodes = [];
  const reqMapping = {}; // old category name → new node ID (for lock rules)

  // Practice categories → folder nodes
  let folderOrderCounterCh = 0;
  (parsed.categories || []).forEach(cat => {
    const folderId = generateId();
    nodes.push({ id: folderId, type: 'folder', name: cat, parentId: null, scope: 'challenge', order: folderOrderCounterCh++ });
    reqMapping[cat] = folderId;
    let itemOrder = 0;
    state.challenges.forEach(c => {
      if (c.category === cat) { c.parentId = folderId; c.order = itemOrder++; }
    });
  });
  // Orphan challenges → null parentId (root)
  let rootOrderCh = 0;
  state.challenges.forEach(c => { if (!c.parentId) { c.parentId = null; c.order = rootOrderCh++; } });

  // Snippet categories → folder nodes
  let folderOrderCounterSn = 0;
  (parsed.snippetCategories || []).forEach(cat => {
    const folderId = generateId();
    nodes.push({ id: folderId, type: 'folder', name: cat, parentId: null, scope: 'snippet', order: folderOrderCounterSn++ });
    let itemOrder = 0;
    (state.snippets || []).forEach(s => {
      if (s.category === cat) { s.parentId = folderId; s.order = itemOrder++; }
    });
  });
  // Orphan snippets
  let rootOrderSn = 0;
  (state.snippets || []).forEach(s => { if (!s.parentId) { s.parentId = null; s.order = rootOrderSn++; } });

  // Notebook categories → folder nodes
  let folderOrderCounterNb = 0;
  (parsed.notebookCategories || []).forEach(cat => {
    const folderId = generateId();
    nodes.push({ id: folderId, type: 'folder', name: cat, parentId: null, scope: 'notebook', order: folderOrderCounterNb++ });
    let itemOrder = 0;
    (state.notebooks || []).forEach(n => {
      if (n.category === cat) { n.parentId = folderId; n.order = itemOrder++; }
    });
  });
  // Orphan notebooks
  let rootOrderNb = 0;
  (state.notebooks || []).forEach(n => { if (!n.parentId) { n.parentId = null; n.order = rootOrderNb++; } });

  // Migrate category requirements to use node IDs
  if (parsed.categoryRequirements) {
    const newReqs = {};
    Object.entries(parsed.categoryRequirements).forEach(([catName, req]) => {
      const nodeId = reqMapping[catName];
      if (nodeId) {
        newReqs[nodeId] = {
          reqNodeId: reqMapping[req.reqCat] || null,
          reqCat: req.reqCat, // Keep for display fallback
          count: req.count
        };
      }
    });
    state.categoryRequirements = newReqs;
  }

  return nodes;
}

// --- Data Persistence ---
function loadData() {
  const saved = localStorage.getItem(getAppStorageKey());
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      state.categories = parsed.categories || state.categories;
      state.snippetCategories = parsed.snippetCategories || state.snippetCategories;
      state.categoryRequirements = parsed.categoryRequirements || {};
      state.snippetProgress = parsed.snippetProgress || {};
      state.badges = parsed.badges || [];
      state.snippets = parsed.snippets || [];
      state.notebooks = parsed.notebooks || [];
      state.notebookCategories = parsed.notebookCategories || ['General'];
      state.notebookHistory = parsed.notebookHistory || [];
      state.snippetHistory = parsed.snippetHistory || [];
      state.challenges = migrateLegacyData(parsed.challenges || state.challenges);
      state.codingSets = parsed.codingSets || [];
      state.history = parsed.history || [];
      state.activeAttempts = parsed.activeAttempts || {};
      state.review = parsed.review || {};
      state.expandedNodes = parsed.expandedNodes || [];

      // Tree migration: if nodes don't exist yet, migrate from flat categories
      if (parsed.nodes && parsed.nodes.length > 0) {
        state.nodes = parsed.nodes;
      } else {
        state.nodes = migrateCategoriesToNodes(parsed);
        console.log('[Migration] Converted flat categories → tree nodes:', state.nodes.length, 'folders created');
      }

      // Sample content used to be merged back in here on EVERY load: anything
      // from the seed whose id was missing from state was treated as absent
      // rather than deleted, and re-added. Deleting a sample program was
      // therefore the exact thing that guaranteed its return on the next
      // reload — in the library, on the Visualize canvas, everywhere. There is
      // no seed to merge any more, and a deletion is now permanent.

    } catch (e) {
      console.error("Failed to parse local storage", e);
    }
  } else {
    // ── Seed default/example content for first-time users ──
    seedDefaultData();
  }
}

/**
 * Build the canonical default seed payload — used by both first-time boot and
 * the "Reset Data" button. Returns an object the caller can merge into `state`.
 *
 * The payload contains 3 challenge folders, 3 snippet folders, 2 notebook folders,
 * 4 example programs, 3 example snippets, and 2 example notebooks so a new user
 * immediately sees a populated workspace.
 */
function buildDefaultSeed() {
  /* An empty workspace. This used to hand back 3 challenge folders, 3 snippet
     folders, 2 notebook folders and 9 example items, and js/custom-seed.js
     added 16 more programs across 5 folders on top. Every route already has a
     real empty state, so a new user gets those instead of somebody else's
     example content to delete.

     Used by both first-time boot and Reset Data, so both now produce a clean
     workspace rather than restoring samples. */
  return {
    nodes: [],
    challenges: [],
    snippets: [],
    notebooks: [],
    expandedNodes: [],
    categoryRequirements: {},
    snippetProgress: {},
    badges: [],
    notebookHistory: [],
    history: [],
    activeAttempts: {},
    review: {}
  };
}

function seedDefaultData() {
  const seed = buildDefaultSeed();
  state.nodes = seed.nodes;
  state.challenges = seed.challenges;
  state.snippets = seed.snippets;
  state.notebooks = seed.notebooks;
  state.expandedNodes = seed.expandedNodes;
  state.categoryRequirements = seed.categoryRequirements;
  state.snippetProgress = seed.snippetProgress;
  state.badges = seed.badges;
  state.notebookHistory = seed.notebookHistory;
  state.history = seed.history;
  state.activeAttempts = seed.activeAttempts;
  state.review = seed.review || {};
  saveData();
}

let saveTimeout;
let _saveDataPending = false;
let _breadcrumbCache = new Map();
let _quotaWarned = false; // ensures the "storage full" warning shows only once per session

window.addEventListener('beforeunload', () => {
  if (_saveDataPending) { clearTimeout(saveTimeout); _flushSaveData(); }
});

function _flushSaveData() {
  _saveDataPending = false;
  const dataToSave = {
    categories: getNodeNamesForScope('challenge'),
    snippetCategories: getNodeNamesForScope('snippet'),
    notebookCategories: getNodeNamesForScope('notebook'),
    nodes: state.nodes,
    expandedNodes: state.expandedNodes,
    categoryRequirements: state.categoryRequirements,
    snippetProgress: state.snippetProgress,
    badges: state.badges,
    snippets: state.snippets,
    notebooks: state.notebooks,
    notebookHistory: state.notebookHistory,
    snippetHistory: state.snippetHistory || [],
    challenges: state.challenges,
    codingSets: state.codingSets || [],
    history: state.history,
    activeAttempts: state.activeAttempts,
    review: state.review || {}
  };
  try {
    localStorage.setItem(getAppStorageKey(), JSON.stringify(dataToSave));
  } catch (e) {
    console.error("Storage Error:", e);
    // Don't let a quota failure pass silently — the user could lose work.
    if (!_quotaWarned) {
      _quotaWarned = true;
      if (typeof showMessage === 'function') {
        showMessage('Storage Full',
          'Your latest changes could not be saved — the browser\'s local storage is full. Use “Export Data” to back up now, then remove old data to free space.',
          true);
      }
    }
  }
}

/** Debounced localStorage persist — also clears the breadcrumb path cache. */
function saveData() {
  _breadcrumbCache = new Map();
  _saveDataPending = true;
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    _flushSaveData();
    if (typeof scheduleCloudSave === 'function') scheduleCloudSave();
  }, DEBOUNCE_SAVE_MS);
}

// ============================================================
// TREE HELPER FUNCTIONS
// ============================================================

// Get all items in the database by their scope category
function getItemsForScope(scope) {
  if (scope === 'challenge') return state.challenges || [];
  if (scope === 'snippet') return state.snippets || [];
  if (scope === 'notebook') return state.notebooks || [];
  return [];
}

// Get root-level folder names for a scope (for legacy compat)
function getNodeNamesForScope(scope) {
  return state.nodes
    .filter(n => n.type === 'folder' && n.scope === scope && n.parentId === null)
    .map(n => n.name);
}

// Get child folders of a parent
function getChildFolders(parentId, scope) {
  return state.nodes
    .filter(n =>
      n.type === 'folder' &&
      n.parentId === (parentId || null) &&
      (!scope || n.scope === scope)
    )
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

// Count all items recursively inside a folder
function countItemsRecursive(folderId, scope) {
  let count = 0;
  // Direct items
  if (scope === 'challenge') {
    count += state.challenges.filter(c => c.parentId === folderId).length;
    // Practice sets live in the challenge-scope tree too.
    count += (state.codingSets || []).filter(s => (s.parentId || null) === folderId).length;
  }
  else if (scope === 'snippet') count += (state.snippets || []).filter(s => s.parentId === folderId).length;
  else if (scope === 'notebook') count += (state.notebooks || []).filter(n => n.parentId === folderId).length;
  // Child folders
  const childFolders = state.nodes.filter(n => n.type === 'folder' && n.parentId === folderId);
  childFolders.forEach(cf => { count += countItemsRecursive(cf.id, scope); });
  return count;
}

// Get items directly in a folder
function getItemsInFolder(folderId, scope) {
  const parentId = folderId || null;
  let items = [];
  if (scope === 'challenge') items = state.challenges.filter(c => c.parentId === parentId);
  else if (scope === 'snippet') items = (state.snippets || []).filter(s => s.parentId === parentId);
  else if (scope === 'notebook') items = (state.notebooks || []).filter(n => n.parentId === parentId);
  // Generic "wing" libraries (Language, Mindset, Diary…) all share one shape and
  // scope themselves as 'wing:<key>'.
  else if (typeof scope === 'string' && scope.indexOf('wing:') === 0) {
    const key = scope.slice(5);
    items = ((state.wings && state.wings[key]) || []).filter(w => (w.parentId || null) === parentId);
  }
  return items.sort((a, b) => (a.order || 0) - (b.order || 0));
}

// Practice sets directly in a challenge-scope folder.
function getSetsInFolder(folderId) {
  return (state.codingSets || [])
    .filter(s => (s.parentId || null) === (folderId || null))
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

/** @param {string} nodeId @returns {Array} ordered array of node objects from root to nodeId */
function getBreadcrumbPath(nodeId) {
  if (_breadcrumbCache.has(nodeId)) return _breadcrumbCache.get(nodeId);
  const path = [];
  const seen = new Set(); // guard against corrupted parentId cycles (hang prevention)
  let current = state.nodes.find(n => n.id === nodeId);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current);
    current = current.parentId ? state.nodes.find(n => n.id === current.parentId) : null;
  }
  _breadcrumbCache.set(nodeId, path);
  return path;
}

// Check if nodeId is a descendant of ancestorId (circular reference guard)
function isDescendantOf(nodeId, ancestorId) {
  const seen = new Set(); // stop on cycles so a corrupted tree can't infinite-loop
  let current = state.nodes.find(n => n.id === nodeId);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    if (current.parentId === ancestorId) return true;
    current = current.parentId ? state.nodes.find(n => n.id === current.parentId) : null;
  }
  return false;
}

// --- CRUD Operations ---
function createNode(name, type, parentId, scope) {
  const node = { id: generateId(), type, name, parentId: parentId || null, scope: scope || 'challenge' };
  state.nodes.push(node);
  saveData();
  return node;
}

function deleteNode(nodeId) {
  const node = state.nodes.find(n => n.id === nodeId);
  if (!node) return;
  const promotedParentId = node.parentId || null;

  // Find the current highest order in the promoted parent so we don't overlap
  const existingFolders = getChildFolders(promotedParentId, node.scope);
  const existingItems = getItemsInFolder(promotedParentId, node.scope);
  let maxOrder = Math.max(
    -1,
    ...existingFolders.map(f => f.order || 0),
    ...existingItems.map(i => i.order || 0)
  );

  // Promote immediate child folders to the deleted node's parent
  state.nodes.filter(n => n.parentId === nodeId).forEach(child => {
    child.parentId = promotedParentId;
    child.order = ++maxOrder;
  });

  // Promote items whose parentId was this node
  state.challenges.forEach(c => { if (c.parentId === nodeId) { c.parentId = promotedParentId; c.order = ++maxOrder; }});
  if (state.snippets) state.snippets.forEach(s => { if (s.parentId === nodeId) { s.parentId = promotedParentId; s.order = ++maxOrder; }});
  if (state.notebooks) state.notebooks.forEach(n => { if (n.parentId === nodeId) { n.parentId = promotedParentId; n.order = ++maxOrder; }});
  // Practice sets live in the challenge tree — promote them too
  if (state.codingSets) state.codingSets.forEach(s => { if ((s.parentId || null) === nodeId) { s.parentId = promotedParentId; s.order = ++maxOrder; }});

  // Remove only the target node
  state.nodes = state.nodes.filter(n => n.id !== nodeId);

  // Clean up requirements for just this node
  delete state.categoryRequirements[nodeId];

  // Also remove this node from being a requirement for OTHER categories
  Object.keys(state.categoryRequirements).forEach(key => {
    if (state.categoryRequirements[key].reqNodeId === nodeId) {
      state.categoryRequirements[key].reqNodeId = promotedParentId; 
      if (!promotedParentId) delete state.categoryRequirements[key];
    }
  });

  saveData();
}

function moveNode(nodeId, newParentId) {
  // Guard: can't move into self or descendant
  if (nodeId === newParentId) return;
  if (newParentId && isDescendantOf(newParentId, nodeId)) return;

  const node = state.nodes.find(n => n.id === nodeId);
  if (node) {
    node.parentId = newParentId || null;
    saveData();
  }
}

function renameNode(nodeId, newName) {
  if (!newName || !newName.trim()) return;
  const node = state.nodes.find(n => n.id === nodeId);
  if (node) {
    node.name = newName.trim();
    saveData();
  }
}

function moveItemToFolder(itemId, itemType, newFolderId) {
  if (itemType === 'challenge') {
    const item = state.challenges.find(c => c.id === itemId);
    if (item) { item.parentId = newFolderId || null; saveData(); }
  } else if (itemType === 'snippet') {
    const item = (state.snippets || []).find(s => s.id === itemId);
    if (item) { item.parentId = newFolderId || null; saveData(); }
  } else if (itemType === 'notebook') {
    const item = (state.notebooks || []).find(n => n.id === itemId);
    if (item) { item.parentId = newFolderId || null; saveData(); }
  }
}

// Toggle expand/collapse
function toggleNodeExpanded(nodeId) {
  const idx = state.expandedNodes.indexOf(nodeId);
  if (idx >= 0) {
    state.expandedNodes.splice(idx, 1);
  } else {
    state.expandedNodes.push(nodeId);
  }
  saveData();
}

function isNodeExpanded(nodeId) {
  return state.expandedNodes.includes(nodeId);
}

function updateTreeOrder(parentId, scope, sortedIds) {
  // Update order property for folders
  sortedIds.forEach((id, index) => {
    const node = state.nodes.find(n => n.id === id);
    if (node) {
      node.order = index;
      node.parentId = parentId || null;
    } else {
      // Check items
      const items = getItemsForScope(scope);
      const item = items.find(it => it.id === id);
      if (item) {
        item.order = index;
        item.parentId = parentId || null;
      }
    }
  });
  saveData();
}

/** @param {string} key SESSION_KEYS constant @param {*} value JSON-serializable */
function setSessionParam(key, value) {
  sessionStorage.setItem(SESSION_PREFIX + key, JSON.stringify(value));
}

/** @param {string} key @returns {*} parsed value or null */
function getSessionParam(key) {
  const val = sessionStorage.getItem(SESSION_PREFIX + key);
  if (val) {
    try { return JSON.parse(val); } catch (e) { return null; }
  }
  return null;
}

function clearSessionParam(key) {
  sessionStorage.removeItem(SESSION_PREFIX + key);
}

/** Atomic state mutation + save. @param {function(state): void} updaterFn */
function setState(updaterFn) {
  updaterFn(state);
  saveData();
}

// --- Shareable Challenge/Snippet URL Encoding ---
function encodeShareData(data) {
  try {
    return btoa(encodeURIComponent(JSON.stringify(data)));
  } catch (e) {
    console.error('[Share] Encode failed:', e);
    return null;
  }
}

function decodeShareData(str) {
  try {
    const base64Str = str.replace(/ /g, '+');
    return JSON.parse(decodeURIComponent(atob(base64Str)));
  } catch (e) {
    console.error('[Share] Decode failed:', e);
    return null;
  }
}

/**
 * Share data is embedded entirely in the URL. Browsers, CDNs and messaging apps
 * truncate very long URLs, producing a link that silently fails to open. Warn the
 * user when that's likely so they can fall back to an exported backup file.
 * @param {string} url @returns {boolean} true if a warning was shown
 */
function warnIfShareUrlTooLong(url) {
  if (url && url.length > 8000) {
    if (typeof showMessage === 'function') {
      showMessage('Large Share Link',
        'This link is ' + Math.round(url.length / 1024) + ' KB — large enough that some browsers or apps may cut it off and it won\'t open. If that happens, use “Export Data” to share a backup file instead.',
        true);
    }
    return true;
  }
  return false;
}