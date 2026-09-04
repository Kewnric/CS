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
  deadlines: {},         // User-set due dates, keyed "<type>:<id>" (see agenda.js)
  events: [],            // Free-standing calendar entries (see agenda.js)
  langWords: [],         // Language Library dictionary (see language.js)
  langSets: [],          // Language drill sets
  langScenarios: [],     // Language scenario encounters
  langHistory: [],       // Language drill / scenario runs
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
      state.deadlines = parsed.deadlines || {};
      state.events = parsed.events || [];
      state.langWords = parsed.langWords || [];
      state.langSets = parsed.langSets || [];
      state.langScenarios = parsed.langScenarios || [];
      state.langHistory = parsed.langHistory || [];
      state.wings = (parsed.wings && typeof parsed.wings === 'object') ? parsed.wings : {};
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
      /* THE SAVE THAT FOLLOWS THIS WOULD HAVE ERASED IT.
         A parse failure used to be logged and shrugged off: the app carried on
         with default state, looked empty, and the first autosave wrote that
         empty state straight over the bytes that failed to parse. A truncated
         write, a crash mid-save or a quota-clipped string is usually MOSTLY
         intact and recoverable by hand -- but only if it still exists.
         So the bytes are copied aside, saving is refused until the user
         decides, and they are told rather than left looking at an empty app. */
      console.error('Failed to parse local storage', e);
      _loadFailed = true;
      try {
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        localStorage.setItem(getAppStorageKey() + '.corrupt.' + stamp, saved);
      } catch (e2) {
        // Out of room to keep a copy: the original is still where it was, and
        // refusing to save is what protects it.
        console.error('Could not set aside the unreadable save', e2);
      }
      /* Asked, not announced. The message has to name a way out or saving stays
         paused forever, and the only two are: put a backup in, or start again.
         Starting again is offered as a button rather than described, because a
         description would have to tell someone to clear their own site data. */
      if (typeof _showThreeButtonDialog === 'function') {
        _showThreeButtonDialog('Saved data could not be read',
          'Your data is still on this device but could not be understood, so nothing has been overwritten and saving is paused until you decide. A copy has been set aside either way.',
          [
            { label: 'Leave it, I will import a backup', action: 'keep' },
            { label: 'Start fresh', danger: true, action: 'fresh' }
          ],
          (choice) => {
            if (choice === 'fresh') startFreshAfterUnreadableSave();
          });
      } else if (typeof showMessage === 'function') {
        showMessage('Saved data could not be read',
          'Your data could not be understood, so nothing has been overwritten and saving is paused. Import a backup to carry on.', true);
      }
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

/* Set when the saved data could not be parsed. While it is true nothing is
   written, so the unreadable-but-probably-recoverable bytes stay where they
   are. Cleared only by an explicit Start Fresh or a successful Import. */
let _loadFailed = false;

/** True when saving is paused because the stored data could not be read. */
function saveIsBlocked() { return _loadFailed; }

/**
 * Let saving resume, after the user has chosen what to do about the bad data.
 * Import calls this once it has replaced state; Start Fresh calls it after
 * clearing. Nothing else should -- the flag is the only thing standing between
 * a recoverable file and an empty one.
 */
function allowSavingAgain() { _loadFailed = false; }

/**
 * Begin again after data that could not be read.
 *
 * Removes only the live key. The copy set aside when the read failed is left
 * alone, so "start fresh" is still not the same as "destroy it" -- the bytes
 * remain on the device for anyone who wants to pick through them later.
 */
function startFreshAfterUnreadableSave() {
  try { localStorage.removeItem(getAppStorageKey()); } catch (e) { /* nothing to remove */ }
  allowSavingAgain();
  location.reload();
}

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
    review: state.review || {},
    deadlines: state.deadlines || {},
    events: state.events || [],
    langWords: state.langWords || [],
    langSets: state.langSets || [],
    langScenarios: state.langScenarios || [],
    langHistory: state.langHistory || [],
    wings: state.wings || {}
  };
  /* Never write over data we could not read. Everything above is default state
     when the load failed, so this would be the write that turns a recoverable
     file into an empty one. */
  if (_loadFailed) return;
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
  /* Only the coding library has two of itself, so only its scope is gated: a
     folder made while the starter pack is on screen would be yours, filed
     inside the pack, and would follow it into the stash on the next swap.
     Notes, snippets and the wings are unaffected. */
  if ((scope || 'challenge') === 'challenge' &&
      typeof csCanAddHere === 'function' && !csCanAddHere('folder')) return null;
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
/**
 * The folders beside this one: same parent, same library.
 *
 * Both halves matter. Parent alone would treat every top-level folder in the
 * app as one group -- coding, notebook and snippet folders all sit at
 * parentId null -- so opening a coding folder would collapse the notes tree.
 *
 * Returns nothing for a node that is not in state.nodes. That is deliberate:
 * "__root__" is a pseudo-folder each library paints for its uncategorised
 * items, and all three libraries share that one id, so collapsing it here would
 * close it in the other two trees at the same time. It is left out of the
 * accordion rather than given a wrong answer.
 */
/**
 * Where the "Uncategorised" row's open/shut state is kept.
 *
 * Every library paints one and they all call it "__root__", so storing it under
 * that bare id made the three share a single switch: opening Uncategorised in
 * the coding tree would have opened it in notes and snippets too. The key
 * carries the library, so each has its own.
 */
function rootExpansionKey(scope) { return '__root__:' + (scope || 'challenge'); }

/** The id a node's expansion is stored under. Only the root row differs. */
function expansionKeyFor(nodeId, scope) {
  return nodeId === '__root__' ? rootExpansionKey(scope) : nodeId;
}

/**
 * The folders beside this one: same parent, same library.
 *
 * Both halves matter. Parent alone would treat every top-level folder in the
 * app as one group -- coding, notebook and snippet folders all sit at
 * parentId null -- so opening a coding folder would collapse the notes tree.
 *
 * THE UNCATEGORISED ROW COUNTS AS ONE OF THEM. It is drawn level with the
 * top-level folders and behaves like one, so it shuts when a real folder opens
 * and takes them with it when it opens. It is not in state.nodes -- it is
 * painted from whatever has no folder -- so it has to be named rather than
 * found, which is why the scope is passed in for it.
 */
function siblingFolderIds(nodeId, scope) {
  if (nodeId === '__root__') {
    return (state.nodes || [])
      .filter(n => n.scope === scope && !n.parentId)
      .map(n => n.id);
  }
  const node = (state.nodes || []).find(n => n.id === nodeId);
  if (!node) return [];
  const parent = node.parentId || null;
  const sibs = (state.nodes || [])
    .filter(n => n.id !== nodeId && n.scope === node.scope && (n.parentId || null) === parent)
    .map(n => n.id);
  if (!parent) sibs.push(rootExpansionKey(node.scope));
  return sibs;
}

/**
 * Open or close one folder.
 *
 * Opening closes the folders BESIDE it and none above it -- an accordion per
 * level rather than one for the whole tree. Ancestors are never siblings of
 * their own descendant, so a subfolder opens inside a parent that stays open,
 * and the tree settles into a single path from the root to wherever you are.
 *
 * A collapsed folder keeps whatever was open inside it. Its subtree is not
 * rendered while it is shut, so clearing it would only mean losing your place
 * when you come back.
 */
function setNodeExpanded(nodeId, open, scope) {
  if (!state.expandedNodes) state.expandedNodes = [];
  const key = expansionKeyFor(nodeId, scope);
  const drop = (id) => {
    const i = state.expandedNodes.indexOf(id);
    if (i >= 0) state.expandedNodes.splice(i, 1);
  };
  if (!open) {
    drop(key);
  } else {
    siblingFolderIds(nodeId, scope).forEach(drop);
    if (!state.expandedNodes.includes(key)) state.expandedNodes.push(key);
  }
  saveData();
}

/**
 * Close every folder in one library.
 *
 * Scoped, because expandedNodes is one flat list shared by all of them and
 * closing the coding tree must not close the notes tree with it.
 */
function collapseAllFolders(scope) {
  if (!state.expandedNodes || !state.expandedNodes.length) return;
  const mine = new Set((state.nodes || []).filter(n => n.scope === scope).map(n => n.id));
  mine.add(rootExpansionKey(scope));   // Uncategorised shuts with the rest
  let changed = false;
  for (let i = state.expandedNodes.length - 1; i >= 0; i--) {
    if (mine.has(state.expandedNodes[i])) { state.expandedNodes.splice(i, 1); changed = true; }
  }
  if (changed) saveData();
}

function toggleNodeExpanded(nodeId, scope) {
  setNodeExpanded(nodeId, !isNodeExpanded(nodeId, scope), scope);
}

/**
 * Open every folder from the top down to nodeId, closing the ones beside each
 * on the way -- the same accordion, applied to a whole path at once.
 *
 * Used where a folder is revealed rather than clicked: selecting a program,
 * jumping to a search hit. Those used to push each ancestor onto expandedNodes
 * directly, which left every folder passed through on the way to a previous
 * selection still hanging open.
 *
 * Folders on the path never close each other -- an ancestor and its descendant
 * are not siblings, and any sibling that is itself on the path is kept -- and
 * the whole walk saves once rather than once per level.
 */
function expandNodePath(nodeId) {
  if (!state.expandedNodes) state.expandedNodes = [];
  const chain = [];
  let curr = (state.nodes || []).find(n => n.id === nodeId);
  while (curr) {
    chain.push(curr.id);
    curr = (state.nodes || []).find(n => n.id === curr.parentId);
  }
  if (!chain.length) return;
  const onPath = new Set(chain);
  chain.forEach((id) => {
    siblingFolderIds(id).forEach((sib) => {
      if (onPath.has(sib)) return;
      const i = state.expandedNodes.indexOf(sib);
      if (i >= 0) state.expandedNodes.splice(i, 1);
    });
    if (!state.expandedNodes.includes(id)) state.expandedNodes.push(id);
  });
  saveData();
}

function isNodeExpanded(nodeId, scope) {
  return state.expandedNodes.includes(expansionKeyFor(nodeId, scope));
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
/* Plain base64 puts "+" and "/" in a query string, where "+" decodes as a
   space. That was patched on the way back in with a replace(/ /g, '+'), which
   only held while nothing else in the pipeline touched the string. URL-safe
   base64 has no characters that need escaping, so the round trip is exact. */
function encodeShareData(data) {
  try {
    return btoa(encodeURIComponent(JSON.stringify(data)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  } catch (e) {
    console.error('[Share] Encode failed:', e);
    return null;
  }
}

function decodeShareData(str) {
  try {
    // Accept both: links copied before this change are still plain base64,
    // where a "+" may already have become a space in transit.
    let b64 = String(str).replace(/-/g, '+').replace(/_/g, '/').replace(/ /g, '+');
    while (b64.length % 4) b64 += '=';
    return JSON.parse(decodeURIComponent(atob(b64)));
  } catch (e) {
    console.error('[Share] Decode failed:', e);
    return null;
  }
}

/* ============================================================
   SHARE CLIPBOARD
   ------------------------------------------------------------
   navigator.clipboard is undefined on plain http and in older browsers, so
   `navigator.clipboard.writeText(...)` threw synchronously — before the
   .catch() that was meant to provide the fallback could ever run. The share
   button simply died with a TypeError.
   ============================================================ */
function copyShareLink(url, okMessage) {
  const done = () => {
    if (typeof showShareToast === 'function') showShareToast(okMessage || 'Link copied to clipboard!');
    else if (typeof toast === 'function') toast(okMessage || 'Link copied to clipboard!', { type: 'success' });
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(done).catch(() => _shareCopyFallback(url, done));
    return;
  }
  _shareCopyFallback(url, done);
}

/** execCommand first; if even that fails, show the link so it can be copied. */
function _shareCopyFallback(url, done) {
  let ok = false;
  try {
    const ta = document.createElement('textarea');
    ta.value = url;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px;left:-1000px;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    ok = document.execCommand('copy');
    ta.remove();
  } catch (e) { ok = false; }

  if (ok) { done(); return; }
  _showShareLinkDialog(url);
}

/** Last resort: a selectable field, rather than a prompt() the browser may block. */
function _showShareLinkDialog(url) {
  document.getElementById('share-link-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'share-link-overlay';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-content" style="max-width:560px;">
      <h2 class="modal-title">Copy this link</h2>
      <p class="modal-desc">Your browser blocked automatic copying. Select the link and copy it.</p>
      <textarea class="form-textarea" readonly rows="4"
        style="font-family:var(--font-mono);font-size:0.75rem;word-break:break-all;">${escapeHTML(url)}</textarea>
      <div style="display:flex;justify-content:flex-end;gap:0.5rem;margin-top:1rem;">
        <button class="btn btn-primary" onclick="document.getElementById('share-link-overlay').remove()">Done</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const ta = overlay.querySelector('textarea');
  if (ta) { ta.focus(); ta.select(); }
}

/* ============================================================
   PENDING SHARE — applied only once a storage mode is chosen
   ------------------------------------------------------------
   A ?data= link used to be read by whichever library route happened to mount.
   Open one in a browser that had never picked Local or Cloud and the picker
   came up, the router had not started, and after signing in the app landed on
   Home — so the shared item was silently dropped unless the user happened to
   walk to the right library while the URL still carried the parameter.

   The payload is now lifted out of the URL at boot and held until a mode is
   chosen, then written into whichever account was picked.
   ============================================================ */
const PENDING_SHARE_KEY = 'ssp.pendingShare';

/** Called at boot, before the storage picker. Clears ?data= from the URL. */
function captureSharePayload() {
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('data');
    if (!raw) return;
    const decoded = decodeShareData(raw);
    // Strip the parameter either way: a corrupt link should not survive a reload.
    window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    if (!decoded || !decoded._type) {
      if (typeof showMessage === 'function') {
        showMessage('Broken share link', 'That link could not be read. It may have been cut short by the app it was sent through.', true);
      }
      return;
    }
    sessionStorage.setItem(PENDING_SHARE_KEY, JSON.stringify(decoded));
  } catch (e) {
    console.warn('[Share] capture failed:', e);
  }
}

function takePendingShare() {
  try {
    const raw = sessionStorage.getItem(PENDING_SHARE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_SHARE_KEY);
    return JSON.parse(raw);
  } catch (e) { return null; }
}

function hasPendingShare() {
  try { return !!sessionStorage.getItem(PENDING_SHARE_KEY); } catch (e) { return false; }
}

/**
 * Share data is embedded entirely in the URL. Browsers, CDNs and messaging apps
 * truncate very long URLs, producing a link that silently fails to open. Warn the
 * user when that's likely so they can fall back to an exported backup file.
 * @param {string} url @returns {boolean} true if a warning was shown
 */
/* ============================================================
   DATA INTEGRITY
   ------------------------------------------------------------
   Nothing validated the shape of what was loaded. Feeding the app deliberately
   broken data showed it would not crash — it would just quietly carry the
   damage:

     - a program whose folder was deleted disappeared from every view while
       still occupying storage and counting toward totals
     - two items could share an id, so editing one edited both
     - a practice set could point at a program that no longer exists
     - categoryRequirements could lock a folder behind a deleted program,
       leaving it permanently locked

   This runs once after load, fixes what it safely can, and says what it did.
   It never deletes user content: orphans are recovered to Uncategorized rather
   than dropped.
   ============================================================ */
function repairDataIntegrity() {
  const report = { orphans: 0, duplicateIds: 0, deadSetProblems: 0, deadLocks: 0, emptyVariants: 0 };
  if (!state) return report;

  const folderIds = new Set((state.nodes || []).filter(n => n && n.type === 'folder').map(n => n.id));

  // Orphans -> Uncategorized, so they are visible and can be filed or deleted.
  ['challenges', 'snippets', 'notebooks', 'codingSets'].forEach(key => {
    (state[key] || []).forEach(item => {
      if (item && item.parentId && !folderIds.has(item.parentId)) {
        item.parentId = null;
        report.orphans++;
      }
    });
  });
  // A folder whose own parent is gone becomes a root folder.
  (state.nodes || []).forEach(n => {
    if (n && n.parentId && !folderIds.has(n.parentId)) { n.parentId = null; report.orphans++; }
  });

  // Duplicate ids: the later copy is renumbered, so both survive and are
  // editable independently.
  const seen = new Set();
  ['challenges', 'snippets', 'notebooks', 'codingSets', 'nodes'].forEach(key => {
    (state[key] || []).forEach(item => {
      if (!item) return;
      if (!item.id) { item.id = generateId(); report.duplicateIds++; return; }
      if (seen.has(item.id)) {
        item.id = generateId();
        report.duplicateIds++;
      }
      seen.add(item.id);
    });
  });

  // Practice sets pointing at programs that are gone.
  const liveChallenges = new Set((state.challenges || []).map(c => c.id));
  (state.codingSets || []).forEach(set => {
    const before = (set.problems || []).length;
    set.problems = (set.problems || []).filter(pr =>
      pr && (pr.source !== 'library' || liveChallenges.has(pr.challengeId)));
    report.deadSetProblems += before - set.problems.length;
  });

  // Prerequisites naming deleted programs would lock a folder forever.
  const req = state.categoryRequirements || {};
  Object.keys(req).forEach(nodeId => {
    const r = req[nodeId];
    if (!r) { delete req[nodeId]; return; }
    if (!folderIds.has(nodeId)) { delete req[nodeId]; report.deadLocks++; return; }
    if (Array.isArray(r.requiredChallengeIds)) {
      const kept = r.requiredChallengeIds.filter(id => liveChallenges.has(id));
      if (kept.length !== r.requiredChallengeIds.length) {
        report.deadLocks += r.requiredChallengeIds.length - kept.length;
        r.requiredChallengeIds = kept;
      }
      if (!kept.length && !r.reqNodeId) delete req[nodeId];
    }
    if (r && r.reqNodeId && !folderIds.has(r.reqNodeId)) { delete req[nodeId]; report.deadLocks++; }
  });

  // A program with no version cannot be attempted; give it an empty one so it
  // is editable rather than a dead row.
  (state.challenges || []).forEach(c => {
    if (!Array.isArray(c.variants) || !c.variants.length) {
      c.variants = [{ id: generateId(), name: 'Version 1', description: '', code: '', starterCode: '',
        files: [{ id: generateId(), name: 'main', ext: '.c', code: '', starterCode: '' }],
        samples: [], tests: [] }];
      report.emptyVariants++;
    }
  });

  const total = Object.values(report).reduce((a, b) => a + b, 0);
  if (total > 0) {
    saveData();
    const bits = [];
    if (report.orphans) bits.push(report.orphans + ' item' + (report.orphans !== 1 ? 's' : '') + ' recovered to Uncategorized');
    if (report.duplicateIds) bits.push(report.duplicateIds + ' duplicate id' + (report.duplicateIds !== 1 ? 's' : '') + ' renumbered');
    if (report.deadSetProblems) bits.push(report.deadSetProblems + ' set problem' + (report.deadSetProblems !== 1 ? 's' : '') + ' dropped');
    if (report.deadLocks) bits.push(report.deadLocks + ' stale prerequisite' + (report.deadLocks !== 1 ? 's' : '') + ' cleared');
    if (report.emptyVariants) bits.push(report.emptyVariants + ' program' + (report.emptyVariants !== 1 ? 's' : '') + ' given a version');
    console.warn('[Repair]', bits.join('; '));
    if (typeof toast === 'function') {
      toast('Fixed some damaged data: ' + bits.join('; ') + '.', { type: 'warning', duration: 8000 });
    }
  }
  return report;
}

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