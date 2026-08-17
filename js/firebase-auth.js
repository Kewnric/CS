/* ============================================================
   FIREBASE-AUTH.JS — Firebase Init, Auth, Cloud Save/Load (Unified)
   ----
   Cloud document layout (Schema V2 — subcollection split):
     users/{uid}                  → { schemaVersion: 2, lastSaved }
     users/{uid}/domains/app      → { nodes, challenges, snippets, notebooks, ... }
     users/{uid}/domains/history  → { history, notebookHistory }
     users/{uid}/domains/viz      → { nodes, links, pan, zoom, fogEnabled, ... }
     users/{uid}/domains/brain    → { versions, folders, activeVersionId }
     users/{uid}/domains/quests   → { quests, player, lastLoginDate }
     users/{uid}/domains/settings → { theme, sidebarExpanded, tutorialsDone[] }

   V1 (legacy single-doc) is auto-migrated on first load.
   Firestore rules must allow subcollection access:
     match /users/{userId}/{document=**} {
       allow read, write: if request.auth.uid == userId;
     }
   ============================================================ */

const firebaseConfig = {
  apiKey: "AIzaSyANt1EyX048v3DcF84Z8mY8dMJE1EfzUCE",
  authDomain: "study-session-kk02.firebaseapp.com",
  projectId: "study-session-kk02",
  storageBucket: "study-session-kk02.firebasestorage.app",
  messagingSenderId: "742476751171",
  appId: "1:742476751171:web:429ec4a13a2203631d8ff6",
  measurementId: "G-56NYN0YPS7"
};

firebase.initializeApp(firebaseConfig);
const fbAuth = firebase.auth();
const fbDb = firebase.firestore();
const FIRESTORE_SCHEMA_VERSION = 2;

// SESSION persistence: the auth session only lives until the browser tab/window
// is closed. The next browser launch is a clean slate and the user has to sign
// in again. (LOCAL would persist indefinitely; NONE would even forget across
// reloads.) See: https://firebase.google.com/docs/auth/web/auth-state-persistence
/* "Remember me" upgrades this to LOCAL, which survives a browser restart. The
   default stays SESSION so an unticked box behaves exactly as before. */
const REMEMBER_KEY = 'ssp.rememberMode';
function authRemembered() {
  try { return localStorage.getItem(REMEMBER_KEY); } catch (e) { return null; }
}
function authSetRemembered(mode) {
  try {
    if (mode) localStorage.setItem(REMEMBER_KEY, mode);
    else localStorage.removeItem(REMEMBER_KEY);
  } catch (e) { /* private mode */ }
}
try {
  fbAuth.setPersistence(authRemembered() === 'online'
    ? firebase.auth.Auth.Persistence.LOCAL
    : firebase.auth.Auth.Persistence.SESSION);
} catch (e) {}

// `storageMode` is now read from sessionStorage (browser-tab scoped) instead of
// localStorage, so a fresh browser launch always shows the picker. We keep a
// per-tab record so SPA reloads within the same session don't re-prompt.
let storageMode = sessionStorage.getItem('storageMode') || null;
let currentFirebaseUser = null;
let _appBooted = false;

// Dirty-state tracking for auto-save + "Save Now" + unsaved-changes prompt
let _cloudIsDirty = false;
let _cloudIsSaving = false;
let _lastCloudSaveAt = null;
let _cloudSaveTimer = null;
const CLOUD_SAVE_DEBOUNCE_MS = 5000; // auto-save 5s after last change

// Multi-tab coordination via BroadcastChannel
const _syncChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('studysession-sync') : null;
const _tabId = Math.random().toString(36).slice(2, 8);

// Suppress cloud uploads during initialization / route mount when local-only
// helpers (vizAutoPopulate, checkDailyReset) write to localStorage but the data
// hasn't actually changed in any user-meaningful way.
let _suppressCloudSave = false;

/* ============================================================
   PUBLIC SYNC HOOKS — call these from any save site
   ============================================================ */

/** Mark in-memory state as dirty (needs cloud upload). Called from saveData(),
 *  vizSave(), brainSave(), saveQuestData(), toggleTheme(), etc. */
function markCloudDirty() {
  _cloudIsDirty = true;
  _updateCloudStatusUI();
}

/** Force an immediate flush to cloud. Returns a Promise. */
async function flushCloudNow() {
  if (storageMode !== 'online' || !currentFirebaseUser) return false;
  return await saveToFirestore(currentFirebaseUser.uid);
}

/** Manual "Save Now" — visible feedback on the badge button. */
async function manualCloudSave() {
  if (storageMode !== 'online' || !currentFirebaseUser) {
    showCloudToast('Sign in to save to cloud', true);
    return;
  }
  await flushCloudNow();
}

/* ============================================================
   SIGN-IN PROGRESS BAR
   ============================================================ */
let _signinProgress = { current: 0, target: 0, interval: null, finished: false };

function _resetSigninProgress() {
  if (_signinProgress.interval) clearInterval(_signinProgress.interval);
  _signinProgress = { current: 0, target: 0, interval: null, finished: false };
}

function _renderSigninProgress(text) {
  const bar = document.getElementById('smp-progress-bar');
  const txt = document.getElementById('smp-progress-text');
  const pct = Math.max(0, Math.min(100, Math.round(_signinProgress.current)));
  if (bar) bar.style.width = pct + '%';
  if (txt) txt.textContent = (text || 'Signing in...') + ' ' + pct + '%';
}

function _startSigninProgressTicker() {
  if (_signinProgress.interval) return;
  _signinProgress.interval = setInterval(() => {
    if (_signinProgress.finished) return;
    const gap = _signinProgress.target - _signinProgress.current;
    if (gap > 0.4) _signinProgress.current += Math.max(0.4, gap * 0.06);
    else if (gap < -0.4) _signinProgress.current = _signinProgress.target;
    _renderSigninProgress(_signinProgress._lastText || 'Signing in...');
  }, 90);
}

function _signinProgressTo(target, text) {
  _signinProgress._lastText = text;
  _signinProgress.target = Math.max(_signinProgress.target, target);
  _startSigninProgressTicker();
}

function _signinProgressFinish(text) {
  _signinProgress.finished = true;
  _signinProgress.current = 100;
  _signinProgress.target = 100;
  _renderSigninProgress(text || 'Complete!');
  if (_signinProgress.interval) { clearInterval(_signinProgress.interval); _signinProgress.interval = null; }
}

/* ============================================================
   AUTH ERRORS — Firebase's messages are written for developers
   ------------------------------------------------------------
   Users were shown raw strings like "A network error (such as timeout,
   interrupted connection or unreachable host) has occurred." Each of these
   says what happened AND what to do about it.
   ============================================================ */
const AUTH_ERRORS = {
  'auth/network-request-failed': 'No connection. Check your network, or use Local Storage for now.',
  'auth/popup-blocked': 'Your browser blocked the sign-in popup. Retrying in this tab...',
  'auth/popup-closed-by-user': null,           // user cancelled — say nothing
  'auth/cancelled-popup-request': null,
  'auth/user-cancelled': null,
  'auth/unauthorized-domain': 'This site is not authorised for sign-in yet. Add its domain in Firebase → Authentication → Settings → Authorized domains.',
  'auth/operation-not-allowed': 'Google sign-in is not enabled for this project yet (Firebase → Authentication → Sign-in method).',
  'auth/account-exists-with-different-credential': 'That email is already registered with a different sign-in method.',
  'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/internal-error': 'Google sign-in had an internal error. Try again in a moment.',
  'auth/timeout': 'Sign-in took too long. Check your connection and try again.',
  'ssp/timeout': 'Sign-in took too long — the popup may be waiting behind this window.',
  'ssp/offline': 'You are offline. Local Storage works fine without a connection.'
};

/** Returns null when the failure is a deliberate user cancellation. */
function authErrorMessage(err) {
  const code = (err && err.code) || '';
  if (Object.prototype.hasOwnProperty.call(AUTH_ERRORS, code)) return AUTH_ERRORS[code];
  return 'Sign-in failed. ' + ((err && err.message) || 'Please try again.');
}

/** Rejects if the promise has not settled in `ms`, so a popup that never comes
    back can't leave the progress bar spinning forever. */
function _withTimeout(promise, ms, code) {
  let t;
  const bomb = new Promise((_res, rej) => {
    t = setTimeout(() => {
      const e = new Error('timed out');
      e.code = code || 'ssp/timeout';
      rej(e);
    }, ms);
  });
  return Promise.race([promise, bomb]).finally(() => clearTimeout(t));
}

/* ---------- Storage Mode Popup ---------- */

function _pickerRemember() {
  const cb = document.getElementById('smp-remember-cb');
  return !!(cb && cb.checked);
}

/** What is already on this device, so the choice isn't blind. */
function _localDataSummary() {
  let raw = null;
  try { raw = localStorage.getItem(typeof getAppStorageKey === 'function' ? getAppStorageKey() : 'appData'); }
  catch (e) { return null; }
  if (!raw) return null;
  try {
    const d = JSON.parse(raw);
    const n = (d.notebooks || []).length;
    const c = (d.challenges || []).length;
    const s2 = (d.snippets || []).length;
    if (!n && !c && !s2) return null;
    const parts = [];
    if (c) parts.push(c + ' program' + (c !== 1 ? 's' : ''));
    if (n) parts.push(n + ' notebook' + (n !== 1 ? 's' : ''));
    if (s2) parts.push(s2 + ' snippet' + (s2 !== 1 ? 's' : ''));
    return parts.join(' · ');
  } catch (e) { return null; }
}

function _paintPicker() {
  const remembered = authRemembered();
  const cb = document.getElementById('smp-remember-cb');
  if (cb) cb.checked = !!remembered;

  ['local', 'online'].forEach((mode) => {
    const badge = document.getElementById('smp-' + mode + '-last');
    if (badge) badge.classList.toggle('hidden', remembered !== mode);
  });

  // Local: say what's actually in there rather than describing the concept.
  const localDesc = document.getElementById('smp-local-desc');
  const summary = _localDataSummary();
  if (localDesc) {
    localDesc.textContent = summary
      ? 'On this device: ' + summary + '. Works offline.'
      : 'Data saved in your browser. Fast and offline-ready.';
  }

  // Cloud: offline is a fact we already know, so don't make them find out.
  const onlineBtn = document.getElementById('smp-online-btn');
  const onlineDesc = document.getElementById('smp-online-desc');
  const offline = navigator.onLine === false;
  if (onlineBtn) {
    onlineBtn.disabled = offline;
    onlineBtn.classList.toggle('smp-btn-disabled', offline);
  }
  if (onlineDesc) {
    onlineDesc.textContent = offline
      ? "You're offline — Local Storage still works."
      : 'Sign in with Google to sync across devices.';
  }
}

/* Tab used to escape the modal to the skip-link and the settings button, so the
   app was reachable before a storage mode had been chosen. */
function _pickerKeydown(e) {
  if (e.key !== 'Tab') return;
  const popup = document.getElementById('storage-mode-popup');
  if (!popup || popup.classList.contains('hidden')) return;
  const items = [...popup.querySelectorAll('button, input, [href], [tabindex]:not([tabindex="-1"])')]
    .filter(el => !el.disabled && el.offsetParent !== null);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

let _pickerOnlineHandler = null;

function showStorageModePicker() {
  const popup = document.getElementById('storage-mode-popup');
  if (popup) popup.classList.remove('hidden');
  const appLayout = document.querySelector('.app-layout');
  if (appLayout) { appLayout.style.visibility = 'hidden'; appLayout.setAttribute('aria-hidden', 'true'); }
  _showSigninChooseView();
  _paintPicker();

  document.addEventListener('keydown', _pickerKeydown, true);
  if (!_pickerOnlineHandler) {
    // Plugging the cable back in should re-enable the button by itself.
    _pickerOnlineHandler = () => _paintPicker();
    window.addEventListener('online', _pickerOnlineHandler);
    window.addEventListener('offline', _pickerOnlineHandler);
  }

  // Focus started on <body>, so a screen reader announced nothing at all.
  const firstBtn = document.getElementById('smp-local-btn');
  if (firstBtn) setTimeout(() => { try { firstBtn.focus(); } catch (e) {} }, 60);
}

function hideStorageModePicker() {
  const popup = document.getElementById('storage-mode-popup');
  if (popup) popup.classList.add('hidden');
  const appLayout = document.querySelector('.app-layout');
  if (appLayout) { appLayout.style.visibility = ''; appLayout.removeAttribute('aria-hidden'); }
  document.removeEventListener('keydown', _pickerKeydown, true);
  if (_pickerOnlineHandler) {
    window.removeEventListener('online', _pickerOnlineHandler);
    window.removeEventListener('offline', _pickerOnlineHandler);
    _pickerOnlineHandler = null;
  }
}

function _showSigninChooseView() {
  const body = document.querySelector('#storage-mode-popup .smp-body');
  const progContainer = document.getElementById('smp-progress-container');
  if (body) body.classList.remove('hidden');
  if (progContainer) progContainer.classList.add('hidden');
  const onlineBtn = document.getElementById('smp-online-btn');
  const localBtn = document.getElementById('smp-local-btn');
  if (onlineBtn) { onlineBtn.disabled = false; onlineBtn.classList.remove('smp-btn-disabled'); }
  if (localBtn)  { localBtn.disabled = false; localBtn.classList.remove('smp-btn-disabled'); }
  _resetSigninProgress();
  _renderSigninProgress('Signing in...');
}

function _showSigninLoadingView() {
  const body = document.querySelector('#storage-mode-popup .smp-body');
  const progContainer = document.getElementById('smp-progress-container');
  if (body) body.classList.add('hidden');
  if (progContainer) progContainer.classList.remove('hidden');
}

function finishBoot() {
  if (_appBooted) return;
  _appBooted = true;
  SpaRouter.init();
  _attachUnloadGuard();
  _updateCloudStatusUI();
  applyPendingShare();
}

/**
 * Files a share that was waiting for a storage mode, then takes the user to it.
 * Runs after the account's data has loaded, so it is saved into that account
 * rather than into whatever was on screen when the link was opened.
 */
function applyPendingShare() {
  if (typeof hasPendingShare !== 'function' || !hasPendingShare()) return;
  const shared = takePendingShare();
  if (!shared) return;

  const go = (route, importer) => {
    try { importer(shared); } catch (e) { console.error('[Share] import failed:', e); return; }
    if (typeof spaNavigate === 'function') spaNavigate(route);
  };

  setTimeout(() => {
    if (shared._type === 'challenge' && typeof importSharedChallenge === 'function') {
      go('browse', importSharedChallenge);
    } else if (shared._type === 'notebook' && typeof importSharedNotebook === 'function') {
      go('study', importSharedNotebook);
    } else if (shared._type === 'snippet' && typeof importSharedSnippet === 'function') {
      go('snippets', importSharedSnippet);
    } else {
      console.warn('[Share] nothing can import type:', shared._type);
    }
  }, 60);
}

/* ---------- Choose Local ---------- */

function chooseLocalMode() {
  storageMode = 'local';
  sessionStorage.setItem('storageMode', 'local');
  authSetRemembered(_pickerRemember() ? 'local' : null);
  hideStorageModePicker();
  _flushAllInMemoryDomains();
  loadData();
  // Restore viz & brain canvas state from localStorage so that
  // _rerenderActiveRoute() → vizAutoPopulate() sees the existing nodes
  // (with their saved positions) instead of an empty array.
  if (typeof vizLoad === 'function') vizLoad();
  if (typeof brainLoad === 'function') brainLoad();
  _rerenderActiveRoute();
  finishBoot();
  // Navigate home so the user sees fresh local data, same as Google sign-in flow
  if (typeof spaNavigate === 'function') spaNavigate('home');
}

/* ---------- Choose Online (Google Sign-In) ---------- */

async function chooseOnlineMode() {
  // Failing after a doomed round-trip taught the user nothing. navigator.onLine
  // is only reliable in the negative direction, which is the direction we need.
  if (navigator.onLine === false) {
    showCloudToast(AUTH_ERRORS['ssp/offline'], true);
    return;
  }

  _resetSigninProgress();
  _showSigninLoadingView();
  _signinProgressTo(20, 'Waiting for Google login...');

  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    _signinProgressTo(40, 'Waiting for Google login...');
    // 2 minutes: long enough to pick an account and type a password, short
    // enough that a popup lost behind the window doesn't hang the app.
    const result = await _withTimeout(fbAuth.signInWithPopup(provider), 120000);
    await _afterSignedIn(result.user);
  } catch (err) {
    // Popups are blocked outright by most mobile browsers and by every in-app
    // webview (Instagram, Facebook, LinkedIn). Without this fallback Cloud
    // Storage simply did not work on the devices most likely to hit it.
    if (_isPopupUnavailable(err)) {
      try {
        _signinProgressTo(50, 'Redirecting to Google...');
        showCloudToast(AUTH_ERRORS['auth/popup-blocked']);
        // Survives the full page reload the redirect causes.
        sessionStorage.setItem('ssp.pendingRedirect', '1');
        await fbAuth.signInWithRedirect(provider);
        return; // page navigates away
      } catch (err2) {
        sessionStorage.removeItem('ssp.pendingRedirect');
        _failSignin(err2);
        return;
      }
    }
    _failSignin(err);
  }
}

/** Popup could not be used — blocked, closed by the OS, or unsupported. */
function _isPopupUnavailable(err) {
  const code = (err && err.code) || '';
  return code === 'auth/popup-blocked' ||
         code === 'auth/operation-not-supported-in-this-environment' ||
         code === 'auth/web-storage-unsupported' ||
         code === 'ssp/timeout';
}

function _failSignin(err) {
  console.error('[Firebase] Sign-in failed:', err);
  _resetSigninProgress();
  _showSigninChooseView();
  const msg = authErrorMessage(err);
  if (msg) showCloudToast(msg, true);
}

/** Shared tail of every successful sign-in: popup, redirect, or restored. */
async function _afterSignedIn(user) {
  _signinProgressTo(65, 'Authenticating user...');
  currentFirebaseUser = user;
  storageMode = 'online';
  sessionStorage.setItem('storageMode', 'online');
  if (_pickerRemember()) authSetRemembered('online');
  updateCloudUserBadge();

  _signinProgressTo(85, 'Syncing cloud data...');
  await loadFromFirestore(user.uid);

  _signinProgressFinish('Complete!');

  setTimeout(() => {
    hideStorageModePicker();
    _showSigninChooseView();
    finishBoot();
    showCloudToast('Signed in as ' + (user.displayName || user.email));
    if (typeof spaNavigate === 'function') spaNavigate('home');
  }, 380);
}

/** Completes a redirect sign-in after the page reloads. Called from bootApp. */
async function _resumeRedirectSignin() {
  const pending = sessionStorage.getItem('ssp.pendingRedirect');
  sessionStorage.removeItem('ssp.pendingRedirect');
  let result = null;
  try {
    result = await fbAuth.getRedirectResult();
  } catch (err) {
    if (pending) _failSignin(err);
    return false;
  }
  if (result && result.user) {
    showStorageModePicker();
    _showSigninLoadingView();
    _signinProgressTo(60, 'Signing you in...');
    await _afterSignedIn(result.user);
    return true;
  }
  return false;
}

/* ============================================================
   LOAD FROM FIRESTORE — restores all domains
   ============================================================ */
async function loadFromFirestore(uid) {
  // Suppress cloud uploads during the entire load — flushing, seeding defaults,
  // re-rendering routes etc. all call saveData/vizSave which would otherwise
  // schedule unwanted uploads back to Firestore on every sign-in.
  const __prevSuppress = _suppressCloudSave;
  _suppressCloudSave = true;
  try {
    _flushAllInMemoryDomains();

    const rootDoc = await fbDb.collection('users').doc(uid).get();

    if (rootDoc.exists) {
      const rootData = rootDoc.data();

      if (rootData.schemaVersion >= FIRESTORE_SCHEMA_VERSION) {
        // V2+ subcollection format — load domains in parallel
        await _loadV2Domains(uid);
      } else {
        // V1 legacy single-doc — restore data then migrate to V2
        console.log('[Firebase] Migrating V1 single-doc → V2 subcollections...');
        _restoreV1Data(rootData);
        _cacheAllToLocalStorage();
        try {
          await saveToFirestore(uid);
          console.log('[Firebase] V1 → V2 migration complete.');
        } catch (migErr) {
          console.warn('[Firebase] V2 migration save failed (update Firestore rules for subcollections):', migErr.message);
        }
      }

      _cacheAllToLocalStorage();
      _cloudIsDirty = false;
      _lastCloudSaveAt = Date.now();
      // Remember which cloud revision this session is built on. Any save that
      // finds a NEWER one knows another device wrote in the meantime.
      _cloudBaseline = _stampOf(rootData.lastSaved);
      _rerenderActiveRoute();
      console.log('[Firebase] Loaded cloud data for', uid);
    } else {
      console.log('[Firebase] No cloud data for this account. Seeding defaults.');
      seedDefaultData();
      _cacheAllToLocalStorage();
      await saveToFirestore(uid);
    }
  } catch (err) {
    console.error('[Firebase] Load failed:', err);
    // IMPORTANT: Do NOT call seedDefaultData() or loadData() here.
    // loadData() seeds defaults when localStorage is empty — exactly what we
    // must NOT do after an account switch clears localStorage. If the cache has
    // data for this account, restore it; otherwise leave state as-is (empty from
    // _flushAllInMemoryDomains) so there is nothing to accidentally save over
    // the user's real cloud data.
    try {
      const cached = localStorage.getItem(getAppStorageKey());
      if (cached) {
        const parsed = JSON.parse(cached);
        state.challenges = migrateLegacyData(parsed.challenges || []);
        state.snippets = parsed.snippets || [];
        state.notebooks = parsed.notebooks || [];
        state.categoryRequirements = parsed.categoryRequirements || {};
        state.snippetProgress = parsed.snippetProgress || {};
        state.badges = parsed.badges || [];
        state.notebookHistory = parsed.notebookHistory || [];
        state.history = parsed.history || [];
        state.activeAttempts = parsed.activeAttempts || {};
        state.expandedNodes = parsed.expandedNodes || [];
        if (Array.isArray(parsed.nodes)) {
          state.nodes = parsed.nodes;
        } else if (parsed.categories) {
          state.categories = parsed.categories;
          state.snippetCategories = parsed.snippetCategories || [];
          state.notebookCategories = parsed.notebookCategories || ['General'];
          state.nodes = migrateCategoriesToNodes(parsed);
        }
        // else: leave state.nodes = [] (already flushed) — never seed on network error
      }
    } catch (e) { /* cache unreadable — leave state empty, safer than seeding defaults */ }
    showCloudToast('Cloud load failed — using cached/local data. Please reload and try again.', true);
  } finally {
    _suppressCloudSave = __prevSuppress;
    _cloudIsDirty = false;
    _updateCloudStatusUI();
  }
}

/** Load V2 subcollection documents in parallel. */
async function _loadV2Domains(uid) {
  const userRef = fbDb.collection('users').doc(uid);
  const domRef = (name) => userRef.collection('domains').doc(name);

  const [appDoc, histDoc, vizDoc, brainDoc, questsDoc, settingsDoc] = await Promise.all([
    domRef('app').get(),
    domRef('history').get(),
    domRef('viz').get(),
    domRef('brain').get(),
    domRef('quests').get(),
    domRef('settings').get()
  ]);

  // App (core data — excludes history)
  if (appDoc.exists) {
    const d = appDoc.data();
    state.challenges = migrateLegacyData(d.challenges || []);
    state.snippets = d.snippets || [];
    state.notebooks = d.notebooks || [];
    state.categoryRequirements = d.categoryRequirements || {};
    state.snippetProgress = d.snippetProgress || {};
    state.badges = d.badges || [];
    state.activeAttempts = d.activeAttempts || {};
    state.expandedNodes = d.expandedNodes || [];
    state.nodes = Array.isArray(d.nodes) ? d.nodes : [];
  }

  // History (separated for size management)
  if (histDoc.exists) {
    const d = histDoc.data();
    state.history = d.history || [];
    state.notebookHistory = d.notebookHistory || [];
  }

  // Viz
  if (vizDoc.exists && typeof viz !== 'undefined') {
    const v = vizDoc.data();
    viz.nodes = v.nodes || [];
    viz.links = v.links || [];
    viz.pan = v.pan || { x: 0, y: 0 };
    viz.zoom = v.zoom || 1;
    viz.fogEnabled = !!v.fogEnabled;
    viz.panesSwapped = !!v.panesSwapped;
    viz.tabsCollapsed = !!v.tabsCollapsed;
    viz.toolbarCollapsed = !!v.toolbarCollapsed;
    viz.flowyDragEnabled = !!v.flowyDragEnabled;
    viz.globeModeEnabled = !!v.globeModeEnabled;
    viz.snapEnabled = !!v.snapEnabled;
    if (v.defaultLinkArrowType !== undefined) viz.defaultLinkArrowType = v.defaultLinkArrowType;
  }

  // Brain
  if (brainDoc.exists && typeof brain !== 'undefined') {
    const d = brainDoc.data();
    brain.versions = d.versions || [];
    brain.folders = d.folders || [];
    brain.activeVersionId = d.activeVersionId || null;
  }

  // Quests
  if (questsDoc.exists && typeof questState !== 'undefined') {
    const d = questsDoc.data();
    questState.quests = d.quests || [];
    if (d.player) questState.player = d.player;
    if (d.lastLoginDate) questState.lastLoginDate = d.lastLoginDate;
  }

  // Settings
  if (settingsDoc.exists) {
    const s = settingsDoc.data();
    if (s.theme) {
      localStorage.setItem('theme', s.theme);
      document.documentElement.setAttribute('data-theme', s.theme);
    }
    if (typeof s.sidebarExpanded === 'boolean') {
      localStorage.setItem('sidebarExpanded', String(s.sidebarExpanded));
    }
    if (typeof s.sidebarBottomCollapsed === 'boolean') {
      localStorage.setItem('sidebarBottomCollapsed', s.sidebarBottomCollapsed ? '1' : '0');
    }
    if (Array.isArray(s.tutorialsDone)) {
      s.tutorialsDone.forEach(t => localStorage.setItem('tutorial_done_' + t, '1'));
    }
  }
}

/** Restore in-memory state from V1 (legacy single-document) Firestore payload. */
function _restoreV1Data(data) {
  const parsed = data.app || data;
  state.challenges = migrateLegacyData(parsed.challenges || []);
  state.snippets = parsed.snippets || [];
  state.notebooks = parsed.notebooks || [];
  state.categoryRequirements = parsed.categoryRequirements || {};
  state.snippetProgress = parsed.snippetProgress || {};
  state.badges = parsed.badges || [];
  state.notebookHistory = parsed.notebookHistory || [];
  state.history = parsed.history || [];
  state.activeAttempts = parsed.activeAttempts || {};
  state.expandedNodes = parsed.expandedNodes || [];

  if (Array.isArray(parsed.nodes)) {
    state.nodes = parsed.nodes;
  } else if (parsed.categories) {
    state.categories = parsed.categories;
    state.snippetCategories = parsed.snippetCategories || [];
    state.notebookCategories = parsed.notebookCategories || ['General'];
    state.nodes = migrateCategoriesToNodes(parsed);
  } else {
    state.nodes = [];
  }

  if (data.viz && typeof viz !== 'undefined') {
    const v = data.viz;
    viz.nodes = v.nodes || [];
    viz.links = v.links || [];
    viz.pan = v.pan || { x: 0, y: 0 };
    viz.zoom = v.zoom || 1;
    viz.fogEnabled = !!v.fogEnabled;
    viz.panesSwapped = !!v.panesSwapped;
    viz.tabsCollapsed = !!v.tabsCollapsed;
    viz.toolbarCollapsed = !!v.toolbarCollapsed;
    viz.flowyDragEnabled = !!v.flowyDragEnabled;
    viz.globeModeEnabled = !!v.globeModeEnabled;
    viz.snapEnabled = !!v.snapEnabled;
    if (v.defaultLinkArrowType !== undefined) viz.defaultLinkArrowType = v.defaultLinkArrowType;
  }

  if (data.brain && typeof brain !== 'undefined') {
    brain.versions = data.brain.versions || [];
    brain.folders = data.brain.folders || [];
    brain.activeVersionId = data.brain.activeVersionId || null;
  }

  if (data.quests && typeof questState !== 'undefined') {
    questState.quests = data.quests.quests || [];
    if (data.quests.player) questState.player = data.quests.player;
    if (data.quests.lastLoginDate) questState.lastLoginDate = data.quests.lastLoginDate;
  }

  if (data.settings) {
    if (data.settings.theme) {
      localStorage.setItem('theme', data.settings.theme);
      document.documentElement.setAttribute('data-theme', data.settings.theme);
    }
    if (typeof data.settings.sidebarExpanded === 'boolean') {
      localStorage.setItem('sidebarExpanded', String(data.settings.sidebarExpanded));
    }
    if (typeof data.settings.sidebarBottomCollapsed === 'boolean') {
      localStorage.setItem('sidebarBottomCollapsed', data.settings.sidebarBottomCollapsed ? '1' : '0');
    }
    if (Array.isArray(data.settings.tutorialsDone)) {
      data.settings.tutorialsDone.forEach(t => localStorage.setItem('tutorial_done_' + t, '1'));
    }
  }
}

/** After loading new account data, force the currently-displayed route to
 *  re-render with the fresh data (otherwise the canvas still shows the old
 *  account's nodes until the user navigates away and back). */
function _rerenderActiveRoute() {
  if (typeof viz !== 'undefined' && typeof vizRenderCanvas === 'function') {
    // Safety net: if viz.nodes is empty (e.g. after _flushAllInMemoryDomains)
    // but localStorage has saved viz data, restore it so vizAutoPopulate()
    // doesn't recreate all nodes with stacked default positions.
    if (viz.nodes.length === 0 && typeof vizLoad === 'function') {
      try { vizLoad(); } catch (e) {}
    }
    try { if (typeof vizAutoPopulate === 'function') vizAutoPopulate(); } catch (e) {}
    try { vizRenderContentPane && vizRenderContentPane(); } catch (e) {}
    try { vizRenderCanvas(); } catch (e) {}
    try { setTimeout(() => { if (typeof vizCenterCanvas === 'function') vizCenterCanvas(); }, 80); } catch (e) {}
  }
  if (typeof brain !== 'undefined' && typeof brainRenderCanvas === 'function') {
    try { brainRenderSidebar && brainRenderSidebar(); } catch (e) {}
    try { brainRenderCanvas(); } catch (e) {}
  }
  if (typeof renderAdmin === 'function' && document.getElementById('admin-table-body-preview')) {
    try { renderAdmin(); } catch (e) {}
  }
  if (typeof renderHome === 'function' && document.getElementById('home-greeting')) {
    try { renderHome(); } catch (e) {}
  }
  if (typeof renderBrowse === 'function' && document.getElementById('browse-category-list')) {
    try { renderBrowse(); } catch (e) {}
  }
  if (typeof renderStudyHome === 'function' && document.getElementById('study-tree-list')) {
    try { renderStudyHome(); } catch (e) {}
  }
  if (typeof renderQuestBoard === 'function' && document.getElementById('quest-board-root')) {
    try { renderQuestBoard(); } catch (e) {}
  }
}

/** Wipe every in-memory domain to a clean shape before loading another account. */
function _flushAllInMemoryDomains() {
  // Core app state
  state.nodes = [];
  state.expandedNodes = [];
  state.categoryRequirements = {};
  state.snippetProgress = {};
  state.badges = [];
  state.snippets = [];
  state.notebooks = [];
  state.notebookHistory = [];
  state.challenges = [];
  state.history = [];
  state.activeAttempts = {};
  state.activeChallenge = null;
  state.activeVariant = null;
  state.userCode = '';
  state.sessionData = null;
  state.timeLimit = 0;
  state.lastDiffs = [];

  // Viz canvas
  if (typeof viz !== 'undefined') {
    viz.nodes = [];
    viz.links = [];
    viz.pan = { x: 0, y: 0 };
    viz.zoom = 1;
    viz.fogEnabled = false;
    viz.panesSwapped = false;
    viz.tabsCollapsed = false;
    viz.toolbarCollapsed = false;
    viz.flowyDragEnabled = false;
    viz.globeModeEnabled = false;
    viz.snapEnabled = false;
    viz.defaultLinkArrowType = 'none';
    if (viz.expandedFolderIds && viz.expandedFolderIds.clear) viz.expandedFolderIds.clear();
  }

  // Brain
  if (typeof brain !== 'undefined') {
    brain.versions = [];
    brain.folders = [];
    brain.activeVersionId = null;
    brain.nodes = [];
    brain.links = [];
  }

  // Quests
  if (typeof questState !== 'undefined') {
    questState.quests = [];
    if (questState.player) {
      questState.player.xp = 0;
      questState.player.level = 1;
      questState.player.streakDays = 0;
    }
  }
}

/** Write all current domains to localStorage caches (skips cloud upload). */
function _cacheAllToLocalStorage() {
  // App
  try {
    localStorage.setItem(getAppStorageKey(), JSON.stringify({
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
      challenges: state.challenges,
      history: state.history,
      activeAttempts: state.activeAttempts
    }));
  } catch (e) { /* ignore */ }

  // Viz
  if (typeof viz !== 'undefined') {
    try {
      localStorage.setItem(getVizStorageKey(), JSON.stringify({
        nodes: viz.nodes, links: viz.links, pan: viz.pan, zoom: viz.zoom,
        fogEnabled: viz.fogEnabled, panesSwapped: viz.panesSwapped,
        tabsCollapsed: viz.tabsCollapsed, toolbarCollapsed: viz.toolbarCollapsed,
        flowyDragEnabled: viz.flowyDragEnabled, globeModeEnabled: viz.globeModeEnabled,
        snapEnabled: viz.snapEnabled, defaultLinkArrowType: viz.defaultLinkArrowType
      }));
    } catch (e) { /* ignore */ }
  }

  // Brain
  if (typeof brain !== 'undefined') {
    try {
      localStorage.setItem(getBrainStorageKey(), JSON.stringify({
        versions: brain.versions, folders: brain.folders, activeVersionId: brain.activeVersionId
      }));
    } catch (e) { /* ignore */ }
  }

  // Quests
  if (typeof questState !== 'undefined') {
    try {
      localStorage.setItem(getQuestStorageKey(), JSON.stringify({
        quests: questState.quests, player: questState.player, lastLoginDate: questState.lastLoginDate
      }));
    } catch (e) { /* ignore */ }
  }
}

/* ============================================================
   SAVE TO FIRESTORE — pushes all domains
   ============================================================ */
/** Strip values Firestore can't store: undefined, functions, Set, Map, DOM nodes,
 *  Date (converted to ms), circular refs. Returns a deep-cloned plain object. */
function _sanitizeForFirestore(v, seen) {
  seen = seen || new WeakSet();
  if (v === null || v === undefined) return null;
  if (typeof v === 'function') return null;
  if (typeof v !== 'object') {
    if (typeof v === 'number' && (!isFinite(v) || isNaN(v))) return null;
    return v;
  }
  if (v instanceof Date) return v.getTime();
  if (v instanceof Set) return Array.from(v).map(x => _sanitizeForFirestore(x, seen));
  if (v instanceof Map) {
    const o = {};
    v.forEach((val, k) => { o[String(k)] = _sanitizeForFirestore(val, seen); });
    return o;
  }
  if (v instanceof Node) return null;
  if (seen.has(v)) return null;
  seen.add(v);
  if (Array.isArray(v)) {
    return v.map(item => _sanitizeForFirestore(item, seen));
  }
  const out = {};
  for (const k of Object.keys(v)) {
    if (k.startsWith('_')) continue; // skip private fields (e.g. _undoStack)
    const sanitized = _sanitizeForFirestore(v[k], seen);
    if (sanitized !== undefined) out[k] = sanitized;
  }
  return out;
}

/** Firestore timestamps arrive as Timestamp, Date, or null depending on path. */
function _stampOf(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  return 0;
}

/* The cloud revision this session loaded. Two devices open at once used to mean
   silent last-write-wins: whoever saved second erased the other's work with no
   warning. */
let _cloudBaseline = 0;
let _conflictPrompting = false;

/** True if the caller should abort the save. */
async function _cloudConflictBlocks(uid) {
  if (!_cloudBaseline || _conflictPrompting) return false;
  let remote = 0;
  try {
    const doc = await fbDb.collection('users').doc(uid).get();
    remote = doc.exists ? _stampOf(doc.data().lastSaved) : 0;
  } catch (e) {
    return false; // can't check — don't block the save
  }
  // 2s of slack absorbs clock skew between the server stamp and our own write.
  if (remote <= _cloudBaseline + 2000) return false;

  _conflictPrompting = true;
  const when = new Date(remote).toLocaleString();
  return await new Promise((resolve) => {
    const done = (v) => { _conflictPrompting = false; resolve(v); };
    if (typeof _showThreeButtonDialog === 'function') {
      _showThreeButtonDialog(
        'Newer data in the cloud',
        'Another device saved at ' + when + ', after this tab loaded. Overwriting replaces that version with what is on this screen.',
        [
          { label: 'Keep theirs (reload)', primary: true, action: 'reload' },
          { label: 'Overwrite with mine', danger: true, action: 'overwrite' },
          { label: 'Cancel', action: 'cancel' }
        ],
        (choice) => {
          if (choice === 'reload') { location.reload(); return done(true); }
          if (choice === 'overwrite') { _cloudBaseline = remote; return done(false); }
          done(true);
        }
      );
    } else if (confirm('Another device saved at ' + when + '. Overwrite it with this tab\'s data?')) {
      _cloudBaseline = remote; done(false);
    } else { done(true); }
  });
}

async function saveToFirestore(uid) {
  if (!uid) return false;
  if (await _cloudConflictBlocks(uid)) {
    _cloudIsSaving = false;
    _updateCloudStatusUI();
    return false;
  }
  _cloudIsSaving = true;
  _updateCloudStatusUI();
  try {
    const batch = fbDb.batch();
    const userRef = fbDb.collection('users').doc(uid);
    const domRef = (name) => userRef.collection('domains').doc(name);

    // Root doc — metadata only (overwrites old V1 fields if migrating)
    batch.set(userRef, {
      schemaVersion: FIRESTORE_SCHEMA_VERSION,
      lastSaved: firebase.firestore.FieldValue.serverTimestamp()
    });

    // App domain (core data — excludes history for size management)
    const appPayload = _sanitizeForFirestore({
      nodes: state.nodes,
      expandedNodes: state.expandedNodes,
      categoryRequirements: state.categoryRequirements,
      snippetProgress: state.snippetProgress,
      badges: state.badges,
      snippets: state.snippets,
      notebooks: state.notebooks,
      challenges: state.challenges,
      activeAttempts: state.activeAttempts
    }) || {};

    // History domain (separated — grows unbounded)
    const historyPayload = _sanitizeForFirestore({
      history: state.history,
      notebookHistory: state.notebookHistory
    }) || {};

    // Viz domain
    let vizPayload = {};
    if (typeof viz !== 'undefined') {
      vizPayload = _sanitizeForFirestore({
        nodes: viz.nodes || [],
        links: viz.links || [],
        pan: viz.pan || { x: 0, y: 0 },
        zoom: viz.zoom || 1,
        fogEnabled: !!viz.fogEnabled,
        panesSwapped: !!viz.panesSwapped,
        tabsCollapsed: !!viz.tabsCollapsed,
        toolbarCollapsed: !!viz.toolbarCollapsed,
        flowyDragEnabled: !!viz.flowyDragEnabled,
        globeModeEnabled: !!viz.globeModeEnabled,
        snapEnabled: !!viz.snapEnabled,
        defaultLinkArrowType: viz.defaultLinkArrowType || 'none'
      }) || {};
    }

    // Brain domain
    let brainPayload = {};
    if (typeof brain !== 'undefined') {
      brainPayload = _sanitizeForFirestore({
        versions: brain.versions || [],
        folders: brain.folders || [],
        activeVersionId: brain.activeVersionId || null
      }) || {};
    }

    // Quests domain
    let questsPayload = {};
    if (typeof questState !== 'undefined') {
      questsPayload = _sanitizeForFirestore({
        quests: questState.quests || [],
        player: questState.player || null,
        lastLoginDate: questState.lastLoginDate || null
      }) || {};
    }

    // Settings domain
    const tutorialsDone = Object.keys(localStorage)
      .filter(k => k.startsWith('tutorial_done_'))
      .map(k => k.slice('tutorial_done_'.length));
    const settingsPayload = _sanitizeForFirestore({
      theme: localStorage.getItem('theme') || 'dark',
      sidebarExpanded: localStorage.getItem('sidebarExpanded') === 'true',
      sidebarBottomCollapsed: localStorage.getItem('sidebarBottomCollapsed') === '1',
      tutorialsDone
    }) || {};

    // Per-domain size check (Firestore doc limit: 1 MB each)
    const domains = { app: appPayload, history: historyPayload, viz: vizPayload, brain: brainPayload, quests: questsPayload, settings: settingsPayload };
    for (const [name, payload] of Object.entries(domains)) {
      let size = 0;
      try { size = JSON.stringify(payload).length; } catch (e) {}
      if (size > 1048000) {
        const hint = name === 'history' ? 'Trim practice history (Analytics → delete old attempts).'
          : name === 'app' ? 'Reduce challenges/snippets/notebooks.' : 'Reduce ' + name + ' data.';
        const err = new Error('Domain "' + name + '" too large (' + Math.round(size / 1024) + ' KB). ' + hint);
        err.code = 'doc-too-large';
        throw err;
      }
    }

    // Add all domain docs to the atomic batch
    batch.set(domRef('app'), appPayload);
    batch.set(domRef('history'), historyPayload);
    batch.set(domRef('viz'), vizPayload);
    batch.set(domRef('brain'), brainPayload);
    batch.set(domRef('quests'), questsPayload);
    batch.set(domRef('settings'), settingsPayload);

    // Commit with timeout
    const writePromise = batch.commit();
    let timeoutId = null;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        const err = new Error(
          'Cloud save timed out (60s). Your Firestore Security Rules may need updating — ' +
          'open Firebase Console → Firestore → Rules and set: ' +
          'match /users/{userId}/{document=**} { allow read, write: if request.auth.uid == userId; }'
        );
        err.code = 'deadline-exceeded';
        reject(err);
      }, 60000);
    });
    try {
      await Promise.race([writePromise, timeoutPromise]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }

    _cloudIsDirty = false;
    _cloudIsSaving = false;
    _lastCloudSaveAt = Date.now();
    _cloudBaseline = _lastCloudSaveAt;
    _updateCloudStatusUI();
    showCloudToast('Saved to cloud');
    // Notify other tabs that cloud data changed
    if (_syncChannel) {
      try { _syncChannel.postMessage({ type: 'cloud-saved', tabId: _tabId, at: Date.now() }); } catch (e) {}
    }
    return true;
  } catch (err) {
    console.error('[Firebase] Save failed:', err);
    _cloudIsSaving = false;
    _updateCloudStatusUI();
    let msg = 'Cloud save failed';
    if (err) {
      const code = err.code || '';
      const isPermDenied = code === 'permission-denied' || code === 'PERMISSION_DENIED' ||
        (err.message && err.message.toLowerCase().includes('permission'));
      const isTimeout = code === 'deadline-exceeded' ||
        (err.message && err.message.toLowerCase().includes('timed out'));
      if (isPermDenied) {
        msg = 'Save blocked by Firestore rules. Update rules to support subcollections: match /users/{userId}/{document=**} { allow read, write: if request.auth.uid == userId; }';
      } else if (isTimeout) {
        msg = 'Save timed out — check Firestore Security Rules or your network.';
      } else {
        switch (code) {
          case 'unauthenticated':
            msg = 'Save failed: session expired. Please sign in again.';
            break;
          case 'unavailable':
            msg = 'Save failed: Firebase offline. Try again.';
            break;
          case 'resource-exhausted':
            msg = 'Save failed: quota exceeded. Try again later.';
            break;
          case 'invalid-argument':
            msg = 'Save failed: invalid data. ' + (err.message || '');
            break;
          case 'doc-too-large':
            msg = err.message;
            break;
          default:
            msg = 'Cloud save failed: ' + (err.message || code || 'unknown error');
        }
      }
    }
    showCloudToast(msg, true);
    return false;
  }
}

/** Called by saveData()/vizSave()/brainSave()/saveQuestData().
 *  Marks dirty and schedules a debounced auto-save to cloud.
 *  "Save now" button still works for immediate flush. */
function scheduleCloudSave() {
  if (_suppressCloudSave) return;
  markCloudDirty();
  // Debounced auto-save
  if (storageMode === 'online' && currentFirebaseUser) {
    clearTimeout(_cloudSaveTimer);
    _cloudSaveTimer = setTimeout(() => {
      if (_cloudIsDirty && !_cloudIsSaving) flushCloudNow();
    }, CLOUD_SAVE_DEBOUNCE_MS);
  }
}

/** Run `fn` with cloud-save suppression — useful during init flows where
 *  helpers like vizAutoPopulate or checkDailyReset call saveData/vizSave/etc
 *  but no real user change has occurred yet. */
function withCloudSaveSuppressed(fn) {
  const prev = _suppressCloudSave;
  _suppressCloudSave = true;
  try { return fn(); } finally { _suppressCloudSave = prev; }
}

/* ---------- Cloud Toast ---------- */

function showCloudToast(message, isError) {
  let toast = document.getElementById('cloud-save-toast');
  if (!toast) return;
  toast.textContent = (isError ? '✕ ' : '✓ ') + message;
  toast.className = 'cloud-toast' + (isError ? ' cloud-toast-error' : '') + ' cloud-toast-show';
  clearTimeout(toast._hideTimeout);
  toast._hideTimeout = setTimeout(() => {
    toast.classList.remove('cloud-toast-show');
  }, 2500);
}

/* ---------- Cloud User Badge (sidebar) ---------- */

function updateCloudUserBadge() {
  const badge = document.getElementById('cloud-user-badge');
  if (!badge) return;

  if (storageMode === 'online' && currentFirebaseUser) {
    const name = currentFirebaseUser.displayName || currentFirebaseUser.email || 'User';
    const photo = currentFirebaseUser.photoURL;
    badge.innerHTML = `
      <div class="cu-row">
        ${photo ? '<img src="' + photo + '" alt="" class="cloud-user-avatar" referrerpolicy="no-referrer">' : '<i data-lucide="cloud" style="width:16px;height:16px;color:var(--color-success);"></i>'}
        <span class="cloud-user-name" title="${escapeHTML(name)}">${escapeHTML(name)}</span>
      </div>
      <div class="cu-status">
        <span class="cu-status-dot" id="cu-status-dot" aria-hidden="true"></span>
        <span class="cu-status-text" id="cu-status-text">All saved</span>
      </div>
      <div class="cu-actions">
        <button id="cu-save-btn" onclick="manualCloudSave()" class="cu-action-btn cu-save-btn" title="Save now (Ctrl+Shift+S)" aria-label="Save now">
          <i data-lucide="save" style="width:14px;height:14px;"></i>
          <span>Save now</span>
        </button>
        <button onclick="firebaseSignOut()" class="cu-action-btn cu-signout-btn" title="Sign out" aria-label="Sign out">
          <i data-lucide="log-out" style="width:14px;height:14px;"></i>
          <span>Sign out</span>
        </button>
      </div>
    `;
    badge.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons({ el: badge });
    _updateCloudStatusUI();
  } else {
    badge.classList.add('hidden');
  }
}

function _updateCloudStatusUI() {
  const dot = document.getElementById('cu-status-dot');
  const txt = document.getElementById('cu-status-text');
  const btn = document.getElementById('cu-save-btn');
  if (!dot || !txt) return;
  if (_cloudIsSaving) {
    dot.className = 'cu-status-dot saving';
    txt.textContent = 'Saving...';
    if (btn) { btn.disabled = true; }
  } else if (_cloudIsDirty) {
    dot.className = 'cu-status-dot dirty';
    txt.textContent = 'Unsaved';
    if (btn) { btn.disabled = false; }
  } else {
    dot.className = 'cu-status-dot saved';
    // "All saved" was equally true one second and one hour after the last sync,
    // so a sync that quietly stopped working looked exactly like a healthy one.
    txt.textContent = _lastCloudSaveAt ? 'Synced ' + _agoText(_lastCloudSaveAt) : 'All saved';
    txt.title = _lastCloudSaveAt ? new Date(_lastCloudSaveAt).toLocaleString() : '';
    if (btn) { btn.disabled = false; }
  }
}

function _agoText(ts) {
  const secs = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (secs < 10) return 'just now';
  if (secs < 60) return secs + 's ago';
  const mins = Math.round(secs / 60);
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  return Math.round(hrs / 24) + 'd ago';
}

// Keeps "Synced 2m ago" honest without touching the network.
setInterval(() => {
  if (storageMode === 'online' && currentFirebaseUser && !_cloudIsDirty && !_cloudIsSaving) {
    _updateCloudStatusUI();
  }
}, 30000);

/* ============================================================
   SIGN OUT — with unsaved-data confirm prompt
   ============================================================ */

async function firebaseSignOut() {
  // If we have unsaved cloud changes, prompt the user.
  if (_cloudIsDirty || _cloudIsSaving) {
    const proceed = await _confirmUnsavedSignOut();
    if (!proceed) return;
  }
  await _doSignOut();
}

/** Promise that resolves true (proceed) or false (cancel) based on user choice.
 *  Uses showConfirm() if available so we get the styled modal. */
function _confirmUnsavedSignOut() {
  return new Promise((resolve) => {
    const message = 'You have unsaved cloud changes. Save them before signing out?\n\n' +
                    '• Save & sign out — uploads your changes, then signs you out.\n' +
                    '• Sign out anyway — discards unsaved changes since the last cloud save.\n' +
                    '• Cancel — stay signed in.';

    // Use a custom 3-button modal so we have the full options.
    _showThreeButtonDialog(
      'Unsaved Cloud Changes',
      message,
      [
        { label: 'Save & sign out', primary: true, action: 'save' },
        { label: 'Sign out anyway', danger: true, action: 'discard' },
        { label: 'Cancel', action: 'cancel' }
      ],
      async (action) => {
        if (action === 'cancel') return resolve(false);
        if (action === 'save') {
          // Flush, then sign out
          showCloudToast('Saving before sign out...');
          const ok = await flushCloudNow();
          if (!ok) {
            showCloudToast('Save failed — sign out cancelled', true);
            return resolve(false);
          }
          return resolve(true);
        }
        if (action === 'discard') return resolve(true);
      }
    );
  });
}

function _showThreeButtonDialog(title, message, actions, onChoice) {
  const modal = document.getElementById('dialog-modal');
  if (!modal) {
    // Native fallback
    const ans = confirm(title + '\n\n' + message + '\n\nOK = Save & sign out, Cancel = Cancel');
    onChoice(ans ? 'save' : 'cancel');
    return;
  }
  document.getElementById('dialog-title').innerText = title;
  document.getElementById('dialog-msg').innerText = message;
  document.getElementById('dialog-icon').innerHTML =
    '<i data-lucide="alert-triangle" class="modal-icon-svg" style="color:var(--color-warning);"></i>';
  const btnContainer = document.getElementById('dialog-actions');
  btnContainer.innerHTML = actions.map((a, i) => {
    const cls = a.primary ? 'btn btn-primary' : (a.danger ? 'btn btn-danger' : 'btn btn-secondary');
    return `<button id="3btn-${i}" class="${cls}" style="flex:1;">${escapeHTML(a.label)}</button>`;
  }).join('');
  actions.forEach((a, i) => {
    const btn = document.getElementById('3btn-' + i);
    if (btn) btn.onclick = () => {
      if (typeof closeModalSmooth === 'function') closeModalSmooth(modal);
      else modal.classList.add('hidden');
      onChoice(a.action);
    };
  });
  modal.classList.remove('hidden');
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: modal });
}

async function _doSignOut() {
  try {
    await fbAuth.signOut();
    currentFirebaseUser = null;
    storageMode = null;
    sessionStorage.removeItem('storageMode');
    localStorage.removeItem('storageMode'); // clean up legacy key from older builds

    // Wipe ALL cached cloud data from localStorage so next sign-in starts clean
    localStorage.removeItem(getAppStorageKey());
    localStorage.removeItem('codePlatformData_online');
    localStorage.removeItem('vizCanvasData_online');
    localStorage.removeItem('brainCanvasData_online');
    localStorage.removeItem('questBoardData_online');
    localStorage.removeItem('questBoardData_v3');

    // Also wipe sessionStorage so nothing carries over to the next account
    try { sessionStorage.clear(); } catch (e) {}

    _cloudIsDirty = false;
    _cloudIsSaving = false;
    updateCloudUserBadge();
    window.location.reload();
  } catch (err) {
    console.error('[Firebase] Sign-out failed:', err);
  }
}

/* ============================================================
   BROWSER UNLOAD GUARD — warn if closing tab with unsaved cloud data
   ============================================================ */
function _attachUnloadGuard() {
  if (window._cloudUnloadAttached) return;
  window._cloudUnloadAttached = true;
  window.addEventListener('beforeunload', (e) => {
    // Flush pending auto-save timer on tab close
    if (_cloudSaveTimer) { clearTimeout(_cloudSaveTimer); _cloudSaveTimer = null; }
    if (storageMode === 'online' && (_cloudIsDirty || _cloudIsSaving)) {
      e.preventDefault();
      e.returnValue = 'You have unsaved cloud changes. Are you sure you want to leave?';
      return e.returnValue;
    }
  });
  // Keyboard shortcut: Ctrl/Cmd + Shift + S = save now
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (storageMode === 'online' && currentFirebaseUser) manualCloudSave();
    }
  });
  // Multi-tab sync: listen for saves from other tabs
  if (_syncChannel) {
    _syncChannel.onmessage = (evt) => {
      if (!evt.data || evt.data.tabId === _tabId) return;
      if (evt.data.type === 'cloud-saved') {
        showCloudToast('Another tab saved changes — click "Reload" to sync.', false);
        _showStaleTabBanner();
      }
    };
  }
}

/** Show a non-intrusive banner letting the user reload to pick up changes from another tab. */
function _showStaleTabBanner() {
  if (document.getElementById('stale-tab-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'stale-tab-banner';
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:var(--color-warning,#f59e0b);color:#000;display:flex;align-items:center;justify-content:center;gap:0.75rem;padding:0.5rem 1rem;font-size:0.8125rem;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,0.2);';
  banner.innerHTML = '<span>Data was updated in another tab.</span>' +
    '<button onclick="location.reload()" style="background:#000;color:#fff;border:none;padding:0.25rem 0.75rem;border-radius:4px;cursor:pointer;font-weight:700;font-size:0.8125rem;">Reload</button>' +
    '<button onclick="this.parentElement.remove()" style="background:transparent;border:none;cursor:pointer;font-size:1rem;padding:0.25rem;">✕</button>';
  document.body.prepend(banner);
}

/* ---------- Boot ---------- */

async function bootApp() {
  // Lift ?data= out of the URL before the picker appears. Whatever mode the
  // user then chooses — Local, or a Google account — is the one the shared
  // item gets written into.
  if (typeof captureSharePayload === 'function') captureSharePayload();

  // A redirect sign-in lands back here on a fresh page load, so this has to run
  // before anything decides to show the picker again.
  if (sessionStorage.getItem('ssp.pendingRedirect') || authRemembered() === 'online') {
    try { if (await _resumeRedirectSignin()) return; } catch (e) { console.warn('[Firebase] redirect resume:', e); }
  }

  // Read from sessionStorage so a fresh browser launch (no session) always
  // returns null and shows the picker. Within the same browser session, SPA
  // reloads still see the choice. "Remember my choice" opts out of that.
  const savedMode = sessionStorage.getItem('storageMode') || authRemembered();
  // Clean up legacy localStorage key from previous builds so it doesn't
  // accidentally auto-resume an old session on first run after the upgrade.
  if (localStorage.getItem('storageMode')) localStorage.removeItem('storageMode');

  if (savedMode === 'local') {
    storageMode = 'local';
    loadData();
    finishBoot();
    return;
  }

  if (savedMode === 'online') {
    storageMode = 'online';
    showStorageModePicker();
    _showSigninLoadingView();
    _resetSigninProgress();
    _signinProgressTo(25, 'Restoring session...');

    const unsub = fbAuth.onAuthStateChanged(async (user) => {
      unsub();
      if (user) {
        currentFirebaseUser = user;
        updateCloudUserBadge();
        _signinProgressTo(70, 'Syncing cloud data...');
        await loadFromFirestore(user.uid);
        _signinProgressFinish('Welcome back!');
        setTimeout(() => {
          hideStorageModePicker();
          _showSigninChooseView();
          finishBoot();
        }, 320);
      } else {
        _resetSigninProgress();
        _showSigninChooseView();
      }
    });
    return;
  }

  // First visit — show picker
  showStorageModePicker();
}
