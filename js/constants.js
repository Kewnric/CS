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

/** sessionStorage key prefix used by setSessionParam / getSessionParam */
const SESSION_PREFIX = 'cm_';

/** Relative path to the JSCPP interpreter bundle (lazy-loaded on first Run) */
const JSCPP_SRC = 'js/JSCPP.es5.min.js';

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
