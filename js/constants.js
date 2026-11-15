/* ============================================================
   CONSTANTS.JS — Application-wide constants and magic strings
   ============================================================ */

/** Dynamic storage keys based on environment to prevent local wiping */
// storageMode lives in sessionStorage (browser-session-scoped) so closing the
// browser forgets the choice and forces a fresh login next launch.
function getAppStorageKey() { return sessionStorage.getItem('storageMode') === 'online' ? 'codePlatformData_online' : 'codePlatformData'; }
function getVizStorageKey() { return sessionStorage.getItem('storageMode') === 'online' ? 'vizCanvasData_online' : 'vizCanvasData'; }
function getBrainStorageKey() { return sessionStorage.getItem('storageMode') === 'online' ? 'brainCanvasData_online' : 'brainCanvasData'; }
function getQuestStorageKey() { return sessionStorage.getItem('storageMode') === 'online' ? 'questBoardData_online' : 'questBoardData_v3'; }
function getCheatStorageKey() { return sessionStorage.getItem('storageMode') === 'online' ? 'cheatsheetLibrary_online' : 'cheatsheetLibrary'; }

/** sessionStorage key prefix used by setSessionParam / getSessionParam */
const SESSION_PREFIX = 'cm_';


/** Canonical keys for cross-route sessionStorage params */
const SESSION_KEYS = {
  PRACTICE_CHALLENGE:  'practiceChallenge',
  PRACTICE_VARIANT:    'practiceVariant',
  TIME_LIMIT:          'timeLimit',
  AUTO_SAVED_FILES:    'autoSavedFiles',
  BROWSE_ACTIVE_NODE:  'browseActiveNode',
  BROWSE_SCROLL:       'browseScroll',
  STUDY_TAB:           'studyTab',
  ACTIVE_SNIPPET:      'activeSnippet',
  ACTIVE_NOTEBOOK:     'activeNotebook',
  SOLUTION_BACK:       'solutionBack',
  LAST_DIFFS:          'lastDiffs',
  LAST_FILE_DIFFS:     'lastFileDiffs',
  HIDE_SUBFOLDERS:     'hideSubfolders',
};

/** Folder scope identifiers */
const SCOPES = {
  CHALLENGE: 'challenge',
  SNIPPET:   'snippet',
  NOTEBOOK:  'notebook',
};

/** saveData() debounce — 1 second keeps writes cheap without feeling laggy */
const DEBOUNCE_SAVE_MS = 1000;

/** Practice auto-save interval — every 30 s */
const AUTOSAVE_INTERVAL_MS = 30000;

/** Admin search debounce — keeps UI snappy while typing */
const ADMIN_SEARCH_DEBOUNCE_MS = 220;

/* ── Screens built on the code editor ─────────────────────────
   Several shared features used to decide "is this the attempt screen" by
   comparing the route to 'practice' and 'practice-set', so a new screen with
   the same editor silently lost its typing sound and letter animation. They
   ask here instead, by what they need:

     typingSound  the typing voice           letterFx    per-letter animation
     dropPopups   pop-ups drop from above    peek        Ctrl+Space target peek
     countsRuns   Run Code counts against an exam run budget

   Freeground has no target (no peek) and is not an attempt (no run budget). */
const EDITOR_ROUTES = {
  'practice':     { typingSound: true, letterFx: true, dropPopups: true, peek: true,  countsRuns: true },
  'practice-set': { typingSound: true, letterFx: true, dropPopups: true, peek: true,  countsRuns: true },
  'freeground':   { typingSound: true, letterFx: true, dropPopups: true, peek: false, countsRuns: false }
};

/** Is this route (default: the one on screen) one of the editor screens? */
function isEditorRoute(route) {
  const r = route || (document.body && document.body.dataset.route) || '';
  return Object.prototype.hasOwnProperty.call(EDITOR_ROUTES, r);
}

/** Does this editor route (default: the one on screen) want `cap`? */
function editorRouteHas(cap, route) {
  const r = route || (document.body && document.body.dataset.route) || '';
  const caps = Object.prototype.hasOwnProperty.call(EDITOR_ROUTES, r) ? EDITOR_ROUTES[r] : null;
  return !!(caps && caps[cap]);
}
