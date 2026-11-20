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
// Loads and saves the `training` and `freeground` documents (js/train-store.js).
const FB_HAS_TRAINING = true;

// SESSION persistence: the auth session only lives until the browser tab/window
// is closed. The next browser launch is a clean slate and the user has to sign
// in again. (LOCAL would persist indefinitely; NONE would even forget across
// reloads.) See: https://firebase.google.com/docs/auth/web/auth-state-persistence
/* "Remember me" upgrades this to LOCAL, which survives a browser restart. The
   default stays SESSION so an unticked box behaves exactly as before. */
const REMEMBER_KEY = 'ssp.rememberMode';

/* Firestore's hard cap is 1,048,576 bytes per document. This sits below it so
   the field names and per-document overhead Firestore also charges for have
   somewhere to go, and so the warning arrives before the write is refused. */
const DOC_BYTE_CEILING = 1040000;
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
// Why the last save failed ('' once one works), and whether that run of
// failures has had its one popup. Successes pop nothing up: the sync icon says.
let _cloudLastError = '';
let _cloudErrorToasted = false;
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
  _cloudChangeSeq++;
  if (_cloudCopyCleanFor) _cloudCopySave(_cloudCopyCleanFor, false);   // this device's copy is now ahead
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
  _cloudErrorToasted = false;   // asked for: a failure this time says so
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

/* Reads compressed saves (store-codec.js); see storeCompactExisting. */
const FB_READS_PACKED = true;

/** What is already on this device, so the choice isn't blind. */
function _localDataSummary() {
  let raw = null;
  // Guest's own library, whatever mode the tab is in: opened from inside a
  // cloud session, the mode's key counted the ACCOUNT's programs under Guest.
  try { raw = localStorage.getItem('codePlatformData'); }
  catch (e) { return null; }
  if (!raw) return null;
  try {
    const d = JSON.parse(storeDecode(raw));
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
      : 'Stays on this device. Works offline.';
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
      : 'Use your Google account. Syncs across devices.';
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

/**
 * Will this load open on the storage picker rather than the app?
 *
 * bootApp decides that from savedMode, but it runs after every deferred script,
 * so anything that paints at DOMContentLoaded -- the HUD does -- would flash
 * before being told. Same reads as the check in bootApp, and no side effects,
 * so it can be asked early and asked twice.
 */
function storagePickerWillShow() {
  try {
    if (sessionStorage.getItem('ssp.pendingRedirect')) return true;
    const saved = sessionStorage.getItem('storageMode')
      || (typeof authRemembered === 'function' ? authRemembered() : null);
    return saved !== 'local';   // 'online' restores behind the picker; null is a first visit
  } catch (e) {
    return false;               // storage blocked: assume the app, not the gate
  }
}

function showStorageModePicker() {
  const popup = document.getElementById('storage-mode-popup');
  if (popup) popup.classList.remove('hidden');
  const appLayout = document.querySelector('.app-layout');
  if (appLayout) { appLayout.style.visibility = 'hidden'; appLayout.setAttribute('aria-hidden', 'true'); }
  // The HUD layer lives on <body>, outside .app-layout, so hiding the app above
  // leaves its chrome painting around the dialog. See css/hud.css.
  document.body.classList.add('picker-open');
  if (typeof _stkQueue === 'function') _stkQueue();   // the picker's own stickers (js/stickers.js)
  _showSigninChooseView();
  _paintPicker();
  if (typeof lpOnShow === 'function') lpOnShow();   // the login page's tabs, picture and notes (auth-accounts.js)

  document.addEventListener('keydown', _pickerKeydown, true);
  if (!_pickerOnlineHandler) {
    // Plugging the cable back in should re-enable the button by itself.
    _pickerOnlineHandler = () => _paintPicker();
    window.addEventListener('online', _pickerOnlineHandler);
    window.addEventListener('offline', _pickerOnlineHandler);
  }

  // Focus started on <body>, so a screen reader announced nothing at all.
  const firstBtn = document.getElementById('lp-user') || document.getElementById('smp-local-btn');
  if (firstBtn) setTimeout(() => { try { firstBtn.focus(); } catch (e) {} }, 60);
}

function hideStorageModePicker() {
  const popup = document.getElementById('storage-mode-popup');
  if (popup) popup.classList.add('hidden');
  const appLayout = document.querySelector('.app-layout');
  if (appLayout) { appLayout.style.visibility = ''; appLayout.removeAttribute('aria-hidden'); }
  document.body.classList.remove('picker-open');
  if (typeof _stkQueue === 'function') _stkQueue();   // back to the page's stickers
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
  /* The safety net for picker-open. hudMount sets it from storagePickerWillShow
     before the picker exists, and hideStorageModePicker clears it -- but a boot
     path that reaches the app WITHOUT ever showing the picker would never call
     that, and the HUD would stay hidden for the whole session. This is the one
     point every path passes through on its way to a visible app. */
  document.body.classList.remove('picker-open');
  SpaRouter.init();
  _attachUnloadGuard();
  _updateCloudStatusUI();
  applyPendingShare();
  // The game-style greeting: in full the first time, briefly once a day (status-window.js).
  if (typeof statusWindowMaybeShow === 'function') setTimeout(statusWindowMaybeShow, 700);
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
  if (_appBooted) { _switchToGuestHere(); return; }
  storageMode = 'local';
  sessionStorage.setItem('storageMode', 'local');
  authSetRemembered(_pickerRemember() ? 'local' : null);
  hideStorageModePicker();
  if (typeof profileKeysEnter === 'function') profileKeysEnter('guest');   // Guest's own drafts (profile-keys.js)
  _flushAllInMemoryDomains();
  loadData();
  if (typeof repairDataIntegrity === 'function') repairDataIntegrity();
  // Restore viz & brain canvas state from localStorage so that
  // _rerenderActiveRoute() → vizAutoPopulate() sees the existing nodes
  // (with their saved positions) instead of an empty array.
  if (typeof vizLoad === 'function') vizLoad();
  if (typeof brainLoad === 'function') brainLoad();
  /* The flush above emptied the Quest Board and the cheat sheets too, and
     loadData reads neither: the board stayed empty, at level 1, until the
     Quest Board page was opened, and the first XP or penalty in between
     saved that empty board over Guest's real one. */
  withCloudSaveSuppressed(() => {
    try { if (typeof loadQuestData === 'function') loadQuestData(); } catch (e) { console.warn('[Guest] quest board:', e); }
    try { if (typeof csLoad === 'function') csLoad(); } catch (e) { /* the cheat-sheet page reads them itself */ }
  });
  _rerenderActiveRoute();
  finishBoot();
  // Navigate home so the user sees fresh local data, same as Google sign-in flow
  if (typeof spaNavigate === 'function') spaNavigate('home');
}

/* ---------- Changing profile from inside the app ----------
   "Change Storage Mode" opens the login page over an app that is already
   running one profile. Every module keeps what it loaded in memory, and much
   of it outlived _flushAllInMemoryDomains: the last profile's cheat sheets,
   typing items, wings, language words, quest player, a cloud save already on
   its timer (which then wrote into the NEXT account). So a switch made from
   inside the app ends by reloading the page into the new profile -- the boot
   path starts from nothing -- and leaving an account is a sign-out of it on
   this device, with the same question about unsaved changes. */

/** Before this tab leaves its signed-in account: unsaved cloud changes are saved, let go, or the switch is called off. */
async function authLeaveAccountOk() {
  if (!_appBooted || storageMode !== 'online' || !currentFirebaseUser) return true;
  if (!_cloudIsDirty && !_cloudIsSaving) return true;
  return await _confirmUnsavedSignOut();
}

/** The account's copies leave this device, as on sign-out: its library cache and its drafts. */
function _forgetAccountHere(uid) {
  _wipeOnlineCaches();
  if (uid && typeof profileKeysDrop === 'function') profileKeysDrop('u:' + uid);
}

/** Start the tab again in `mode`, with nothing of the profile before it in memory or in the tab's session. */
function _reloadInto(mode) {
  clearTimeout(_cloudSaveTimer);
  _cloudSaveTimer = null;
  _cloudIsDirty = false;      // settled by authLeaveAccountOk; the unload guard must not ask again
  _cloudIsSaving = false;
  let share = null;
  try { share = sessionStorage.getItem(PENDING_SHARE_KEY); sessionStorage.clear(); } catch (e) { /* blocked */ }
  try {
    if (share) sessionStorage.setItem(PENDING_SHARE_KEY, share);
    sessionStorage.setItem('storageMode', mode);
  } catch (e) { /* blocked: the picker asks again */ }
  window.location.reload();
}

async function _switchToGuestHere() {
  if (storageMode === 'local') {           // Guest already: nothing changes hands
    authSetRemembered(_pickerRemember() ? 'local' : null);
    hideStorageModePicker();
    return;
  }
  if (!(await authLeaveAccountOk())) return;
  const uid = currentFirebaseUser && currentFirebaseUser.uid;
  try { await fbAuth.signOut(); } catch (e) { console.warn('[Firebase] Sign-out before Guest failed:', e); }
  currentFirebaseUser = null;
  _forgetAccountHere(uid);
  authSetRemembered(_pickerRemember() ? 'local' : null);
  _reloadInto('local');
}

/* ---------- Choose Online (Google Sign-In) ---------- */

async function chooseOnlineMode() {
  // Failing after a doomed round-trip taught the user nothing. navigator.onLine
  // is only reliable in the negative direction, which is the direction we need.
  if (navigator.onLine === false) {
    showCloudToast(AUTH_ERRORS['ssp/offline'], true);
    return;
  }
  if (!(await authLeaveAccountOk())) return;

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
  if (_appBooted) { _afterSignedInHere(user); return; }
  _signinProgressTo(65, 'Authenticating user...');
  currentFirebaseUser = user;
  storageMode = 'online';
  sessionStorage.setItem('storageMode', 'online');
  if (_pickerRemember()) authSetRemembered('online');
  updateCloudUserBadge();

  /* This device's copy of the account, when it can be trusted, as on a
     refresh. It may hold changes that never reached the cloud (the tab was
     closed first), and a download would put the older cloud copy over them. */
  const fromCopy = _bootFromDeviceCopy(user);
  if (!fromCopy) {
    _signinProgressTo(85, 'Syncing cloud data...');
    await loadFromFirestore(user.uid);
  }

  _signinProgressFinish('Complete!');

  setTimeout(() => {
    hideStorageModePicker();
    _showSigninChooseView();
    finishBoot();
    showCloudToast('Signed in as ' + (user.displayName || user.email));
    if (typeof spaNavigate === 'function') spaNavigate('home');
    if (fromCopy) _cloudCheckAfterDeviceBoot(user.uid).catch(e => console.warn('[Firebase] sign-in check:', e));
  }, 380);
}

/** A sign-in made from inside the app (see "Changing profile" above). */
function _afterSignedInHere(user) {
  if (storageMode === 'online' && currentFirebaseUser && currentFirebaseUser.uid === user.uid) {
    // The same account again: nothing changes hands.
    currentFirebaseUser = user;
    if (_pickerRemember()) authSetRemembered('online');
    hideStorageModePicker();
    _showSigninChooseView();
    return;
  }
  _signinProgressTo(80, 'Opening your save file...');
  if (storageMode === 'online' && currentFirebaseUser) _forgetAccountHere(currentFirebaseUser.uid);
  if (_pickerRemember()) authSetRemembered('online');
  // Firebase keeps the new sign-in across the reload; bootApp restores it.
  _reloadInto('online');
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
/* The account whose cloud load failed in this page: no save may reach its
   cloud until a reload loads it properly (see loadFromFirestore's catch). */
let _cloudLoadFailedFor = null;

async function loadFromFirestore(uid) {
  // Suppress cloud uploads during the entire load — flushing, seeding defaults,
  // re-rendering routes etc. all call saveData/vizSave which would otherwise
  // schedule unwanted uploads back to Firestore on every sign-in.
  const __prevSuppress = _suppressCloudSave;
  _suppressCloudSave = true;
  let dirtyAfter = false;   // unsaved changes once loaded: only a device copy opened instead can have them
  // A save still waiting on its timer belongs to whoever was in before, and
  // the stamp it is checked against is theirs.
  clearTimeout(_cloudSaveTimer);
  _cloudSaveTimer = null;
  _cloudBaseline = 0;
  try {
    _claimOnlineCaches(uid);
    if (typeof profileKeysEnter === 'function') profileKeysEnter('u:' + uid);   // this account's drafts (profile-keys.js)
    _flushAllInMemoryDomains();

    const rootDoc = await fbDb.collection('users').doc(uid).get();

    if (rootDoc.exists) {
      const rootData = rootDoc.data();

      const rootVer = typeof rootData.schema === 'number' ? rootData.schema : rootData.schemaVersion;
      if (rootVer >= FIRESTORE_SCHEMA_VERSION) {
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

      if (typeof repairDataIntegrity === 'function') repairDataIntegrity();
      _cacheAllToLocalStorage();
      _cloudIsDirty = false;
      _lastCloudSaveAt = Date.now();
      // Remember which cloud revision this session is built on. Any save that
      // finds a NEWER one knows another device wrote in the meantime.
      _cloudBaseline = _stampOf(rootData.lastSaved);
      _cloudCopySave(uid, true);   // the copy above now matches this revision
      _rerenderActiveRoute();
      console.log('[Firebase] Loaded cloud data for', uid);
      // The pictures this library uses that this device has not got (js/media-store.js).
      if (typeof mediaCloudPull === 'function') mediaCloudPull(uid).catch(() => {});
    } else {
      console.log('[Firebase] No cloud data for this account. Seeding defaults.');
      seedDefaultData();
      _restoreCheatSheets([]);   // a new account starts with none, not with what memory held
      _cacheAllToLocalStorage();
      await saveToFirestore(uid);
    }
  } catch (err) {
    console.error('[Firebase] Load failed:', err);
    /* THE CLOUD COULD NOT BE READ, so this page holds no revision of it. The
       next save used to put what it had -- the library from the cache at
       best, and an empty canvas, brain, quest board and training data -- over
       the account's real cloud copy, with nothing to ask first (no baseline
       to compare against). This device's copy opens instead when it can be
       trusted, as a refresh opens it, and later saves are checked against its
       revision. Otherwise nothing is sent to the cloud until a reload. */
    if (_bootFromDeviceCopy({ uid })) {
      dirtyAfter = _cloudIsDirty;
      showCloudToast('Could not reach the cloud. Opened the copy of your account on this device.', true);
      return;
    }
    _cloudLoadFailedFor = uid;
    _cloudCopyDistrust();   // what this page writes to the device copy is not the whole account
    // IMPORTANT: Do NOT call seedDefaultData() or loadData() here.
    // loadData() seeds defaults when localStorage is empty — exactly what we
    // must NOT do after an account switch clears localStorage. If the cache has
    // data for this account, restore it; otherwise leave state as-is (empty from
    // _flushAllInMemoryDomains) so there is nothing to accidentally save over
    // the user's real cloud data. The cache is this account's: _claimOnlineCaches
    // emptied it above if it was anyone else's.
    try {
      const cached = localStorage.getItem(getAppStorageKey());
      if (cached) {
        const parsed = JSON.parse(storeDecode(cached));
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
    showCloudToast('Cloud load failed. Nothing is saved to your cloud until you reload the page.', true);
  } finally {
    _suppressCloudSave = __prevSuppress;
    _cloudIsDirty = dirtyAfter;
    _updateCloudStatusUI();
  }
}

/** The cheat sheets, read straight from their store when cheatsheet.js has
    not loaded its copy yet. */
const FB_READS_PACKED_CS = true;   // the cheat sheets may be stored compressed (store-codec.js)
function _cheatSheetsFromStorage() {
  try {
    const key = typeof getCheatStorageKey === 'function' ? getCheatStorageKey() : 'cheatsheetLibrary';
    return (JSON.parse((typeof storeDecode === 'function' ? storeDecode(localStorage.getItem(key)) : localStorage.getItem(key))) || {}).sheets || [];
  } catch (e) { return []; }
}

/** Put a cloud copy of the cheat sheets back, in memory and on disk. Always
    called, even with nothing to restore, so one account's sheets cannot be
    left in place for the next one that signs in. */
function _restoreCheatSheets(sheets) {
  const list = Array.isArray(sheets) ? sheets : [];
  try {
    const key = typeof getCheatStorageKey === 'function' ? getCheatStorageKey() : 'cheatsheetLibrary';
    localStorage.setItem(key, JSON.stringify({ sheets: list }));
  } catch (e) { /* storage full */ }
  if (typeof cs !== 'undefined') cs.sheets = list;
}

/** Load V2 subcollection documents in parallel. */
async function _loadV2Domains(uid) {
  const userRef = fbDb.collection('users').doc(uid);
  const domRef = (name) => userRef.collection('domains').doc(name);

  const names = ['app', 'history', 'viz', 'brain', 'quests', 'settings', 'stash', 'training', 'freeground', 'prefs'];
  const read = await Promise.all(names.map(n => domRef(n).get()));
  // A domain too big for one document was saved in parts (_fsSplitText): put it back together.
  const [appDoc, histDoc, vizDoc, brainDoc, questsDoc, settingsDoc, stashDoc, trainingDoc, fgDoc, prefsDoc] =
    await Promise.all(read.map((doc, i) => _fsJoinDomain(domRef, names[i], doc)));
  // Inner lists went up wrapped (see _sanitizeForFirestore); unwrap them here.
  const dataOf = (doc) => _fromFirestore(doc.data());

  /* Freeground, templates, training and Codex (js/train-store.js). A missing
     document reads as empty, like every field above: keeping what was in
     memory would carry one account's data into the next one signed in. */
  if (typeof trainFieldsRead === 'function') {
    trainFieldsRead(trainingDoc.exists ? dataOf(trainingDoc) : {}, { domain: 'training' });
    const runs = {};
    ((state.freeground || {}).tabs || []).forEach(t => { if (t && t.id && t.lastRun) runs[t.id] = t.lastRun; });
    trainFieldsRead(fgDoc.exists ? dataOf(fgDoc) : {}, { domain: 'freeground' });
    ((state.freeground || {}).tabs || []).forEach(t => { if (t && !t.lastRun && runs[t.id]) t.lastRun = runs[t.id]; });
  }

  // The parked library and the unfinished attempts; see the write side.
  if (stashDoc.exists) {
    const st = dataOf(stashDoc);
    state.codingStash = st.codingStash || state.codingStash || null;
    _restorePracticeDrafts(st.practiceDraft);
    _restoreDraft('ssp.sqlAttemptDraft', st.sqlDraft);
    _restoreDraft('npAttemptInProgress', st.npDraft);
    _restorePsetDrafts(st.psetDrafts);
  }

  // Preferences: none saved yet means this device's stay, and go up next save.
  if (prefsDoc.exists) _applyRestoredPrefs(_restorePrefs(dataOf(prefsDoc)));

  // App (core data — excludes history)
  if (appDoc.exists) {
    const d = dataOf(appDoc);
    state.challenges = migrateLegacyData(d.challenges || []);
    state.snippets = d.snippets || [];
    state.notebooks = d.notebooks || [];
    state.categoryRequirements = d.categoryRequirements || {};
    state.snippetProgress = d.snippetProgress || {};
    state.badges = d.badges || [];
    state.activeAttempts = d.activeAttempts || {};
    state.expandedNodes = d.expandedNodes || [];
    state.nodes = Array.isArray(d.nodes) ? d.nodes : [];
    // Defaulted rather than left alone on purpose: signing into a second
    // account in the same tab used to inherit whatever the first account had
    // in memory here, and then write it up to the second account's cloud.
    state.codingSets = d.codingSets || [];
    // The layout migration's stamp; see state.js. Small metadata, so it
    // rides in the app document rather than the parked-library one.
    state.codingPackLayout = d.codingPackLayout || 0;
    state.langRun = d.langRun || null;
    state.review = d.review || {};
    state.deadlines = d.deadlines || {};
    state.events = d.events || [];
    state.langWords = d.langWords || [];
    state.langSets = d.langSets || [];
    state.langScenarios = d.langScenarios || [];
    state.typeItems = Array.isArray(d.typeItems) ? d.typeItems : [];
    state.wings = (d.wings && typeof d.wings === 'object') ? d.wings : {};
    _restoreCheatSheets(d.cheatsheets);
    state.mistakes = Array.isArray(d.mistakes) ? d.mistakes : (state.mistakes || []);
  }

  // History (separated for size management)
  if (histDoc.exists) {
    const d = dataOf(histDoc);
    state.history = d.history || [];
    state.notebookHistory = d.notebookHistory || [];
    state.snippetHistory = d.snippetHistory || [];
    state.langHistory = d.langHistory || [];
    state.typeHistory = Array.isArray(d.typeHistory) ? d.typeHistory : [];
  }

  // Viz
  if (vizDoc.exists && typeof viz !== 'undefined') {
    const v = dataOf(vizDoc);
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
    const d = dataOf(brainDoc);
    brain.versions = d.versions || [];
    brain.folders = d.folders || [];
    brain.activeVersionId = d.activeVersionId || null;
  }

  // Quests
  if (questsDoc.exists && typeof questState !== 'undefined') {
    const d = dataOf(questsDoc);
    questState.quests = (typeof migrateQuest === 'function')
      ? (d.quests || []).map(migrateQuest) : (d.quests || []);
    if (d.player) questState.player = d.player;
    if (d.lastLoginDate) questState.lastLoginDate = d.lastLoginDate;
  }

  // Settings
  if (settingsDoc.exists) {
    const s = dataOf(settingsDoc);
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
  state.snippetHistory = parsed.snippetHistory || [];
  state.activeAttempts = parsed.activeAttempts || {};
  state.expandedNodes = parsed.expandedNodes || [];
  // A V1 payload predates all of these; defaulting them stops the previous
  // account's data being carried into this one.
  state.codingSets = parsed.codingSets || [];
  state.review = parsed.review || {};
  state.deadlines = parsed.deadlines || {};
  state.events = parsed.events || [];
  state.langWords = parsed.langWords || [];
  state.langSets = parsed.langSets || [];
  state.langScenarios = parsed.langScenarios || [];
  state.langHistory = parsed.langHistory || [];
  state.typeItems = Array.isArray(parsed.typeItems) ? parsed.typeItems : [];
  state.typeHistory = Array.isArray(parsed.typeHistory) ? parsed.typeHistory : [];
  state.wings = (parsed.wings && typeof parsed.wings === 'object') ? parsed.wings : {};
  _restoreCheatSheets(parsed.cheatsheets);
  state.codingPackLayout = parsed.codingPackLayout || state.codingPackLayout || 0;
  state.langRun = parsed.langRun || state.langRun || null;
  state.codingStash = parsed.codingStash || state.codingStash || null;
  state.mistakes = Array.isArray(parsed.mistakes) ? parsed.mistakes : (state.mistakes || []);
  if (typeof trainFieldsRead === 'function') trainFieldsRead(parsed);
  _restorePracticeDrafts(parsed.practiceDraft);
  _restoreDraft('ssp.sqlAttemptDraft', parsed.sqlDraft);
  _restoreDraft('npAttemptInProgress', parsed.npDraft);

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
    questState.quests = (typeof migrateQuest === 'function')
      ? (data.quests.quests || []).map(migrateQuest) : (data.quests.quests || []);
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
  if (typeof renderBrowse === 'function' && document.getElementById('browse-category-list')) {
    try { renderBrowse(); } catch (e) {}
  }
  // Home, the Notes Library and the Quest Board have no single function that
  // repaints them -- renderHome / renderStudyHome / renderQuestBoard were never
  // defined, so these refreshes silently did nothing. Re-enter the route.
  const _r = document.body.dataset.route;
  if ((_r === 'home' || _r === 'study' || _r === 'quests') && typeof SpaRouter !== 'undefined') {
    try { SpaRouter.refresh(); } catch (e) {}
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
  /* Everything else a profile owns. These were left as they were, so an
     account with no cloud copy yet (a new one) was seeded with the previous
     profile's coding sets, typing items, wings, language words, deadlines,
     events and histories, and saved them to its own cloud. */
  state.codingSets = [];
  state.codingStash = null;
  state.codingPackLayout = 0;
  state.review = {};
  state.deadlines = {};
  state.events = [];
  state.mistakes = [];
  state.snippetHistory = [];
  state.langWords = [];
  state.langSets = [];
  state.langScenarios = [];
  state.langHistory = [];
  state.langRun = null;
  state.typeItems = [];
  state.typeHistory = [];
  state.wings = {};
  // The cheat sheets live outside `state` (cheatsheet.js) and go up with the app document.
  if (typeof cs !== 'undefined' && cs) { cs.sheets = []; cs.openId = null; }

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

  // Quests: the whole player. Only xp and level were reset (and a `streakDays`
  // the player does not have), so streak, best streak, completed count, title
  // and freezes carried into the next profile.
  if (typeof questState !== 'undefined') {
    questState.quests = [];
    if (typeof questPlayerDefaults === 'function') questState.player = questPlayerDefaults();
    else if (questState.player) { questState.player.xp = 0; questState.player.level = 1; }
  }
}

/* ============================================================
   THE CLOUD-MODE CACHES BELONG TO ONE ACCOUNT
   ------------------------------------------------------------
   The *_online keys are one slot, not one per account. Sign-out empties
   it, but a tab closed while signed in does not, and the next account in
   then had the last one's library as its "cache": the fallback when its
   cloud load failed, and the unsaved Freeground typing. ssp.onlineOwner
   names the account the slot holds; anyone else finds it empty.
   ============================================================ */
const ONLINE_OWNER_KEY = 'ssp.onlineOwner';
const ONLINE_CACHE_KEYS = [
  'codePlatformData_online', 'vizCanvasData_online', 'brainCanvasData_online',
  'questBoardData_online', 'cheatsheetLibrary_online', 'ssp.fg.buffer_online',
  'ssp.cloudCopy',  // CLOUD_COPY_KEY: says the slot can be opened without a download
  'ssp.cloudUse'    // CLOUD_USE_KEY: the last save's sizes
];

/** Empty the cloud-mode slot. Never the mode's key by name: in a tab that has not been
 *  told it is online, getAppStorageKey() is Guest's library. */
function _wipeOnlineCaches() {
  _cloudCopyCleanFor = null;
  ONLINE_CACHE_KEYS.forEach(k => { try { localStorage.removeItem(k); } catch (e) { /* blocked */ } });
  try { localStorage.removeItem(ONLINE_OWNER_KEY); } catch (e) { /* blocked */ }
}

/** The slot is about to hold `uid`'s library: anyone else's goes first. */
function _claimOnlineCaches(uid) {
  let owner = null;
  try { owner = localStorage.getItem(ONLINE_OWNER_KEY); } catch (e) { return; }
  if (owner === uid) return;
  _wipeOnlineCaches();
  try { localStorage.setItem(ONLINE_OWNER_KEY, uid); } catch (e) { /* full: claimed again next time */ }
}

/* ============================================================
   TWO ACCOUNTS IN TWO TABS
   ------------------------------------------------------------
   A second tab signing in to another account claims the slot above, and
   signing this account out in another tab empties it. This tab, still
   running its account, went on saving its library, canvas and sheets into
   the slot: into the other account's device copy, which that account's next
   refresh opened as its own and then saved to its cloud. So this tab stops.
   What it has not sent goes up to its own cloud once more (memory is still
   its own), it writes nothing more on this device, and a cover asks for a
   reload, which opens its account again (the other tab then stops in turn).
   ============================================================ */
let _tabStale = false;       // another tab has this device's account slot: nothing more is saved here
let _tabFinalSave = false;   // the one save allowed after that, of this tab's own work

/** Another tab changed whose account the slot holds (a `storage` event on ONLINE_OWNER_KEY). */
function _onlineSlotChanged(newOwner) {
  if (_tabStale || storageMode !== 'online' || !currentFirebaseUser) return;
  if (newOwner === currentFirebaseUser.uid) return;
  const uid = currentFirebaseUser.uid;
  _tabStale = true;
  // Nothing more on this device: a write already on a timer would land in the other account's copy.
  clearTimeout(_cloudSaveTimer);
  _cloudSaveTimer = null;
  _cloudCopyCleanFor = null;
  try { if (typeof saveStopForThisPage === 'function') saveStopForThisPage(); } catch (e) { /* state.js not loaded */ }
  const send = _cloudIsDirty && !_cloudIsSaving && navigator.onLine !== false;
  const unsent = _cloudIsDirty && !send && !_cloudIsSaving;
  _showSlotLostCover((newOwner ? 'Another tab on this device signed in to a different account.' : 'This account was signed out in another tab.') +
    ' Two accounts cannot share this device at once, so this tab saves nothing more here.' +
    (send || _cloudIsSaving ? ' Changes it had not saved are being sent to your cloud now.' : '') +
    (unsent ? ' It is offline, so its latest changes could not be sent.' : ''));
  if (send) {
    _tabFinalSave = true;
    saveToFirestore(uid).catch(() => false).then(() => { _tabFinalSave = false; });
  }
}

/** True while this tab may write to this device's storage (see the wrapper below). */
function _tabMayWriteHere() { return !_tabStale; }

function _showSlotLostCover(why) {
  if (typeof document === 'undefined' || !document.body || document.getElementById('slot-lost-cover')) return;
  const cover = document.createElement('div');
  cover.id = 'slot-lost-cover';
  cover.setAttribute('role', 'alertdialog');
  cover.setAttribute('aria-modal', 'true');
  cover.style.cssText = 'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,0.72);';
  const box = document.createElement('div');
  box.style.cssText = 'max-width:420px;width:100%;background:var(--bg-secondary,#1e1e24);color:var(--text-primary,#f2f2f2);border-radius:12px;padding:20px;box-shadow:0 12px 40px rgba(0,0,0,0.5);font-size:0.9375rem;line-height:1.5;';
  const title = document.createElement('div');
  title.style.cssText = 'font-weight:700;font-size:1.0625rem;margin-bottom:8px;';
  title.textContent = 'This tab has stopped saving';
  const msg = document.createElement('p');
  msg.style.cssText = 'margin:0 0 16px;';
  msg.textContent = why + ' Reload to keep working in this account.';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-primary';
  btn.textContent = 'Reload';
  btn.style.cssText = 'width:100%;';
  btn.onclick = () => { window.location.reload(); };
  box.append(title, msg, btn);
  cover.appendChild(box);
  document.body.appendChild(cover);
  try { btn.focus(); } catch (e) { /* not focusable yet */ }
}

if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('storage', (e) => {
    if (!e || e.key !== ONLINE_OWNER_KEY) return;
    try { if (e.storageArea && e.storageArea !== localStorage) return; } catch (err) { return; }
    _onlineSlotChanged(e.newValue);
  });
}

/* ============================================================
   OPENING FROM THIS DEVICE'S COPY
   Refreshing while signed in used to download every domain before anything
   showed, on every reload. The *_online keys already hold the account, so a
   refresh now opens from them and asks the cloud only whether another device
   has saved since (one small read of the root document). The copy is trusted
   only when this record says it is complete and whose it is:
     uid    the account it holds (ssp.onlineOwner must agree)
     stamp  the cloud revision it matches (_cloudBaseline at the time)
     clean  false while it has changes the cloud has not got
   Written only after a full cloud load or a cloud save; dropped with the
   caches and on any failed local write (a full quota leaves the copy behind
   the cloud), so anything doubtful takes the full load instead.
   ============================================================ */
const CLOUD_COPY_KEY = 'ssp.cloudCopy';
let _cloudChangeSeq = 0;         // bumped by every markCloudDirty
let _cloudCopyCleanFor = null;   // the uid whose record says clean, so marking it dirty is one write
let _cloudCopyBroken = false;    // a local write failed in this page: never vouch for the copy

/** This device, named in every cloud save (root `savedBy`) so a refresh can
 *  tell its own last save from another device's. Never synced. */
function _deviceId() {
  let id = null;
  try { id = localStorage.getItem('ssp.deviceId'); } catch (e) { return ''; }
  if (!id) {
    id = 'd' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    try { localStorage.setItem('ssp.deviceId', id); } catch (e) { /* full: a new one next time */ }
  }
  return id;
}

function _cloudCopyRead() {
  try {
    const r = JSON.parse(localStorage.getItem(CLOUD_COPY_KEY) || 'null');
    return (r && r.v === 1 && typeof r.uid === 'string' && r.uid) ? r : null;
  } catch (e) { return null; }
}

function _cloudCopySave(uid, clean) {
  if (_cloudCopyBroken || !uid) return;
  try {
    // Only for the account the slot holds: another tab may have given it to another one.
    if (localStorage.getItem(ONLINE_OWNER_KEY) !== uid) { _cloudCopyCleanFor = null; return; }
    localStorage.setItem(CLOUD_COPY_KEY, JSON.stringify({ v: 1, uid: uid, stamp: _cloudBaseline || 0, clean: !!clean }));
    _cloudCopyCleanFor = clean ? uid : null;
  } catch (e) { /* the setItem wrapper has already dropped it */ }
}

/** A local write failed: the copy may be behind the cloud. Full load next time. */
function _cloudCopyDistrust() {
  _cloudCopyBroken = true;
  _cloudCopyCleanFor = null;
  try { localStorage.removeItem(CLOUD_COPY_KEY); } catch (e) { /* blocked */ }
}

/** Would leaving now lose anything? Not while this device's copy is trusted:
 *  it has every change, and the next open (refresh or sign-in) sends them up. */
function _cloudCopyHolds() {
  if (_cloudCopyBroken || !currentFirebaseUser) return false;
  const rec = _cloudCopyRead();
  let owner = null;
  try { owner = localStorage.getItem(ONLINE_OWNER_KEY); } catch (e) { return false; }
  return !!rec && rec.uid === currentFirebaseUser.uid && owner === rec.uid;
}

/** Open `user`'s account from this device's copy, the way Guest opens.
 *  False, having changed nothing that matters, when the copy cannot be trusted. */
function _bootFromDeviceCopy(user) {
  let full = null;
  try { full = sessionStorage.getItem('ssp.cloudFullLoad'); sessionStorage.removeItem('ssp.cloudFullLoad'); } catch (e) { /* blocked */ }
  if (full) return false;                                  // asked for the full load (_cloudReloadForNewer)
  const rec = _cloudCopyRead();
  if (!rec || !user || rec.uid !== user.uid) return false;
  if (getAppStorageKey() !== 'codePlatformData_online') return false;   // the tab does not know it is online
  let owner = null, raw = null;
  try { owner = localStorage.getItem(ONLINE_OWNER_KEY); raw = localStorage.getItem(getAppStorageKey()); } catch (e) { return false; }
  if (owner !== user.uid || !raw) return false;
  try { JSON.parse(storeDecode(raw)); } catch (e) { return false; }   // unreadable here: the cloud has it
  withCloudSaveSuppressed(() => {
    if (typeof profileKeysEnter === 'function') profileKeysEnter('u:' + user.uid);   // this account's drafts
    _flushAllInMemoryDomains();
    loadData();
    if (typeof repairDataIntegrity === 'function') repairDataIntegrity();
    if (typeof vizLoad === 'function') vizLoad();
    if (typeof brainLoad === 'function') brainLoad();
    // loadData reads neither (see chooseLocalMode); the board may also hold what it read at startup.
    try { if (typeof loadQuestData === 'function') loadQuestData(); } catch (e) { console.warn('[Firebase] quest board:', e); }
    try { if (typeof csLoad === 'function') csLoad(); } catch (e) { /* the cheat-sheet page reads them itself */ }
  });
  if (typeof saveIsBlocked === 'function' && saveIsBlocked()) {
    if (typeof allowSavingAgain === 'function') allowSavingAgain();   // the full load replaces it all
    return false;
  }
  _cloudBaseline = rec.stamp || 0;
  _cloudIsDirty = !rec.clean;
  _cloudCopyCleanFor = rec.clean ? user.uid : null;
  _lastCloudSaveAt = Date.now();
  return true;
}

/** After opening from the copy: has another device saved since it was made? */
async function _cloudCheckAfterDeviceBoot(uid) {
  let root = null;
  try {
    const doc = await fbDb.collection('users').doc(uid).get();
    root = doc.exists ? (doc.data() || {}) : null;
  } catch (e) { return; }   // offline: the copy stands; changes go up when the connection is back
  if (!currentFirebaseUser || currentFirebaseUser.uid !== uid) return;
  const remote = root ? _stampOf(root.lastSaved) : 0;
  // 2s of slack, as in _cloudConflictBlocks, for clock skew against the server stamp.
  if (root && remote > _cloudBaseline + 2000) {
    if (root.savedBy && root.savedBy === _deviceId()) {
      /* This device saved it (as the last tab closed, or in another tab). Its
         local copy is written before its cloud save, so the copy has it. */
      _cloudBaseline = remote;
      if (!_cloudIsDirty) _cloudCopySave(uid, true);
    } else if (!_cloudIsDirty && !(typeof _saveDataPending !== 'undefined' && _saveDataPending)) {
      _cloudReloadForNewer();   // another device's work, nothing changed here yet: the full load
      return;
    }
    /* Otherwise both sides have changes: the save below meets the newer
       revision and asks which to keep (_cloudConflictBlocks). */
  }
  if (_cloudIsDirty) scheduleCloudSave();   // changes the copy has that never reached the cloud
  if (typeof mediaCloudPull === 'function') mediaCloudPull(uid).catch(() => {});
}

/** Reload into the full cloud load, once. Never without the flag: that would loop. */
function _cloudReloadForNewer() {
  try { sessionStorage.setItem('ssp.cloudFullLoad', '1'); } catch (e) { return; }
  location.reload();
}

/** Write all current domains to localStorage caches (skips cloud upload). */
function _cacheAllToLocalStorage() {
  /* App: the whole save, by the writer every other save uses (state.js). This
     wrote a shorter list of its own, without the practice sets, reviews,
     wings, typing items, mistakes, training data and the parked library --
     harmless while every refresh downloaded everything again, not once a
     refresh opens from this copy. */
  try { if (typeof _flushSaveData === 'function') _flushSaveData(); } catch (e) { /* ignore */ }

  // Viz
  if (typeof viz !== 'undefined') {
    try {
      storeSetJSON(getVizStorageKey(), ({
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
      storeSetJSON(getBrainStorageKey(), ({
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
/* A LIST DIRECTLY INSIDE A LIST is the one plain-JSON shape Firestore refuses
   ("Nested arrays are not supported"), and the save is one batch, so a single
   cheat-sheet table (rows of cells) failed every domain's save at once. Such a
   list goes up wrapped as { $arr: [...] } and _fromFirestore unwraps it on
   load. Saves from before this never held a wrapper: they could not be
   written at all. tests/cloud-nested-arrays.spec.js */
const FS_NESTED_KEY = '$arr';

/** A domain document as the app keeps it: wrapped inner lists unwrapped. */
function _fromFirestore(v) {
  if (Array.isArray(v)) {
    return v.map(item => {
      const wrapped = item && typeof item === 'object' && !Array.isArray(item)
        && Object.keys(item).length === 1 && Array.isArray(item[FS_NESTED_KEY]);
      return _fromFirestore(wrapped ? item[FS_NESTED_KEY] : item);
    });
  }
  // Plain maps only: a Firestore Timestamp or other class keeps its methods.
  if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
    const out = {};
    for (const k of Object.keys(v)) out[k] = _fromFirestore(v[k]);
    return out;
  }
  return v;
}

/* ============================================================
   PREFERENCES AND DEVICE-KEPT DATA — the `prefs` document
   ------------------------------------------------------------
   These live in their own localStorage keys, read by the features that own
   them, and used to stay on the device: a new device, or a sign-out, lost
   them. Each listed key now rides up as { k, v } (the raw string, so no
   feature changes how it reads its own key) and is written back on load.
   A key the account has not saved is left as it is on this device.

   NOT LISTED, ON PURPOSE: where windows and panes sit and how big they are,
   which panels are folded, Spotify's tokens and the remember-me choice (a
   key and a device decision), the media caches, the login picture, the
   Freeground buffer, per-account welcome flags, stickers (their pictures
   are on this device only; each profile keeps its own, js/stickers.js) and
   the glass speed probe. Add a new key here only if it is the person's data
   or taste, not this screen's layout. A key that is the person's DATA
   (not taste) also goes on PROFILE_OWNED_KEYS (js/profile-keys.js), or one
   profile's values are what the next one signed in here starts with.
   docs/superpowers/specs/2026-11-18-cloud-sync-icon-design.md
   ============================================================ */
const SYNC_PREF_KEYS = [
  // Data
  'anSrsState', 'demoSeenLessons', 'editorLineMarks', 'ssp.dailyGoal', 'ssp.themeEdits', 'ssp.actionUse',
  // What lists show and how
  'analyticsHideItems', 'anRange', 'browseHideItems', 'browseRowShow', 'csView', 'homeCarouselSource',
  'libraryPrefs', 'notesRowShow', 'snipRowShow', 'snippetsHideItems', 'solutionDiffPrefs', 'ssp.hideVerse',
  'ssp.treeColorTarget', 'studyHideItems',
  // Editor, terminal, practice
  'editorFontSize', 'editorWordWrap', 'lineNumbersHidden', 'ssp.editorFx', 'ssp.editorFxBlur',
  'ssp.editorFxOverlay', 'ssp.editorFxSparks', 'ssp.editorFxTilt', 'ssp.peek', 'terminalCompilerOpts',
  'ssp.termEngine', 'ssp.bossBreak', 'ssp.bossShake',
  // Typing, sound, voice
  'ssp.typeConfig', 'ssp.typingSfx', 'ssp.typingSfxVoice', 'ssp.typingSfxVol', 'ssp.speech',
  'ssp.ost.autoplay', 'ssp.ambient', 'ssp.ambientTheme',
  // Look and motion
  'ssp.motion', 'ssp.glass', 'ssp.libHolo', 'ssp.hud', 'ssp.sidebarAuto', 'ssp.windowMemoryOff',
  // Language, notebooks, demos, drills, Codex
  'lang.studyLang', 'lang.refLang', 'lang.autoskip', 'ssp.lang.autoVoice', 'ssp.langAutoSpeak',
  'ssp.langDrillPrefs', 'ssp.np.autoVoice', 'ssp.np.shuffle', 'npTextAlign', 'demoVoice', 'demoVoiceOpts',
  'demoAutoOpen', 'ssp.drillMode', 'ssp.drillSource', 'ssp.codexLookup',
  // Notes and the canvas
  'ssp.brainNoteStyle', 'ssp.brainLinkStyle', 'ssp.brainCodeLang', 'ssp.brainNewNoteCode', 'ssp.brainTaskDur',
  'brainCanvasOpts', 'vizForceSettings', 'ssp.vizBrainDefault', 'ssp.vizRecentColors'
];
const _SYNC_PREF_SET = new Set(SYNC_PREF_KEYS);

/** True for a localStorage key that follows the account. */
function syncPrefIsSynced(key) { return _SYNC_PREF_SET.has(String(key)); }

/** The `prefs` document: every synced key this device has, as raw strings. */
/** A key as it is for the profile in this tab: a profile's own keys may hold
 *  another tab's profile while this one is behind it (profile-keys.js). */
function _ownKeyRaw(key) {
  try {
    if (typeof profileKeysOwnRaw === 'function') return profileKeysOwnRaw(profileCurrentId(), key);
    return localStorage.getItem(key);
  } catch (e) { return null; }
}

/** True while the shared profile keys hold this tab's profile. */
function _holdsOwnKeys() {
  try { return typeof profileKeysHeldBy !== 'function' || profileKeysHeldBy(profileCurrentId()); }
  catch (e) { return true; }
}

function _prefsForCloud() {
  const items = [];
  SYNC_PREF_KEYS.forEach(k => {
    const v = _ownKeyRaw(k);
    if (v !== null) items.push({ k, v });
  });
  return { items };
}

/** Writes the account's preferences to this device; returns the keys that changed. */
function _restorePrefs(doc) {
  const changed = [];
  ((doc && Array.isArray(doc.items)) ? doc.items : []).forEach(it => {
    if (!it || !syncPrefIsSynced(it.k) || typeof it.v !== 'string') return;
    try {
      if (localStorage.getItem(it.k) !== it.v) { localStorage.setItem(it.k, it.v); changed.push(it.k); }
    } catch (e) { /* private mode, or full */ }
  });
  return changed;
}

/** What can change in place does; the rest reads its key on the next load. */
function _applyRestoredPrefs(changed) {
  const has = (k) => changed.indexOf(k) !== -1;
  try { if (has('ssp.themeEdits') && typeof themeEditApply === 'function') themeEditApply(); } catch (e) { /* next load */ }
  try { if (has('ssp.motion') && window.Motion && Motion.setLevel) Motion.setLevel(localStorage.getItem('ssp.motion')); } catch (e) { /* next load */ }
  try { if (has('ssp.glass') && typeof glassApply === 'function') glassApply(); } catch (e) { /* next load */ }
  try {
    if ((has('editorFontSize') || has('editorWordWrap') || has('lineNumbersHidden')) && typeof applyEditorViewSettings === 'function') applyEditorViewSettings();
  } catch (e) { /* next load */ }
}

/** Practice-set drafts from the cloud, merged per set: the newer one wins. */
function _restorePsetDrafts(incoming) {
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return;
  try {
    let mine = {};
    try { mine = JSON.parse(localStorage.getItem('ssp.psetDrafts') || 'null') || {}; } catch (e) { mine = {}; }
    Object.keys(incoming).forEach(id => {
      const d = incoming[id];
      if (d && typeof d === 'object' && (!mine[id] || (mine[id].savedAt || 0) < (d.savedAt || 0))) mine[id] = d;
    });
    const keep = typeof PSET_DRAFTS_MAX === 'number' ? PSET_DRAFTS_MAX : 4;
    Object.keys(mine).sort((a, b) => (mine[b].savedAt || 0) - (mine[a].savedAt || 0)).slice(keep).forEach(k => { delete mine[k]; });
    localStorage.setItem('ssp.psetDrafts', JSON.stringify(mine));
  } catch (e) { /* private mode, or too big to store */ }
}

/* A synced key changing asks for a cloud save, wherever it is written from:
   the ~60 places that write these keys need not know about the cloud. Only a
   real change counts (several write the same value on every paint), and
   only while signed in; the load's own write-back runs with saves
   suppressed. */
(function _watchSyncedKeys() {
  if (typeof Storage === 'undefined') return;
  const proto = Storage.prototype;
  const get = proto.getItem, set = proto.setItem, remove = proto.removeItem;
  const isLocal = (store) => { try { return store === window.localStorage; } catch (e) { return false; } };
  const touched = (store, key, before) => {
    if (!syncPrefIsSynced(key) || !isLocal(store)) return;
    if (storageMode !== 'online' || !currentFirebaseUser) return;
    if (get.call(store, key) === before) return;
    scheduleCloudSave();
  };
  proto.setItem = function (key, value) {
    // A tab another account has taken this device from writes nothing here (_onlineSlotChanged).
    if (isLocal(this) && !_tabMayWriteHere()) return undefined;
    const before = syncPrefIsSynced(key) ? get.call(this, key) : null;
    let r;
    try { r = set.call(this, key, value); } catch (err) {
      // It did not land (a full quota): this device's copy of the account may now be behind the cloud.
      if (isLocal(this)) { try { _cloudCopyDistrust(); } catch (e) { /* never mask the error */ } }
      throw err;
    }
    try { touched(this, key, before); } catch (e) { /* never break a write */ }
    return r;
  };
  proto.removeItem = function (key) {
    if (isLocal(this) && !_tabMayWriteHere()) return undefined;
    const before = syncPrefIsSynced(key) ? get.call(this, key) : null;
    const r = remove.call(this, key);
    try { touched(this, key, before); } catch (e) { /* never break a write */ }
    return r;
  };
})();

/** Strip values Firestore can't store: undefined, functions, Set, Map, DOM nodes,
 *  Date (converted to ms), circular refs; wrap a list held directly in a list.
 *  Returns a deep-cloned plain object. */
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
    return v.map(item => {
      const s = _sanitizeForFirestore(item, seen);
      return Array.isArray(s) ? { [FS_NESTED_KEY]: s } : s;
    });
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

/* A DOMAIN IN PARTS. Over the one-document cap, a domain's JSON text goes up
   as domains/<name>__p0, __p1, ... ({ s: text }) under a head document
   { $parts: n } in its usual place. 300,000 UTF-16 units is at most 900 KB of
   UTF-8 (three bytes a unit at worst), so every part fits; a cut never falls
   between the two halves of a surrogate pair, which would make both parts
   invalid strings. Parts left over from a bigger save are never read: the head
   says how many there are. */
const FS_PARTS_KEY = '$parts';
const FS_PART_CHARS = 300000;
const FS_MAX_PARTS = 24;
const FS_COMMIT_CEILING = 9 * 1048576;
const FS_Z_KEY = '$z';           // the parts are deflated JSON, base64
const FS_Z_MIN = 16384;          // smaller domains stay plain maps, readable in the console
const FS_B64_PART = 900000;      // base64 is ASCII: a byte a character
const FIRESTORE_FORMAT = 3;      // root `schema`: compressed parts (2 was plain maps, one each)
const FS_OLD_READER_TRAP = 'compressed: open the latest StudySession Pro';
const CLOUD_USE_KEY = 'ssp.cloudUse';   // the last save's sizes (Settings > Storage); this device only

function _fsChunk(text, n) {
  const out = [];
  for (let i = 0; i < text.length; i += n) out.push(text.slice(i, i + n));
  return out.length ? out : [''];
}

function _fsB64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function _fsUnB64(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** `json` deflated, in fflate's worker where there is one, and read back
 *  before it is trusted; null when it cannot be (then it goes up uncompressed). */
function _fsDeflate(json) {
  return new Promise((resolve) => {
    if (typeof fflate === 'undefined' || typeof TextEncoder === 'undefined' || typeof btoa === 'undefined') { resolve(null); return; }
    let bytes;
    try { bytes = new TextEncoder().encode(json); } catch (e) { resolve(null); return; }
    const check = (z) => {
      try { resolve(_fsInflateBytes(z) === json ? z : null); } catch (e) { resolve(null); }
    };
    const now = () => { try { check(fflate.deflateSync(bytes, { level: 6 })); } catch (e) { resolve(null); } };
    if (typeof fflate.deflate === 'function' && typeof Worker !== 'undefined') {
      try { fflate.deflate(bytes, { level: 6 }, (err, z) => { if (err || !z) now(); else check(z); }); } catch (e) { now(); }
    } else now();
  });
}

function _fsInflateBytes(z) {
  return new TextDecoder('utf-8', { fatal: true }).decode(fflate.inflateSync(z));
}

function _fsSplitText(text) {
  const parts = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(i + FS_PART_CHARS, text.length);
    const c = text.charCodeAt(end - 1);
    if (end < text.length && c >= 0xD800 && c <= 0xDBFF) end--;   // keep a surrogate pair together
    parts.push(text.slice(i, end));
    i = end;
  }
  return parts;
}

/** `doc` as read, or, when it is the head of a domain in parts, the whole
 *  domain put back together (in the same shape a read gives: exists, data()). */
async function _fsJoinDomain(domRef, name, doc) {
  const head = doc && doc.exists ? doc.data() : null;
  const n = head && typeof head[FS_PARTS_KEY] === 'number' ? head[FS_PARTS_KEY] : 0;
  if (!n) return doc;
  const parts = await Promise.all(Array.from({ length: n }, (_, i) => domRef(name + '__p' + i).get()));
  const text = parts.map(p => {
    const s = p.exists ? (p.data() || {}).s : null;
    if (typeof s !== 'string') throw new Error('Cloud domain "' + name + '" is missing part ' + parts.indexOf(p) + '.');
    return s;
  }).join('');
  // Deflated parts are base64 (the format since FIRESTORE_FORMAT 3); a damaged part throws, the load fails and keeps this device's copy.
  const value = JSON.parse(head[FS_Z_KEY] ? _fsInflateBytes(_fsUnB64(text)) : text);
  return { exists: true, data: () => value };
}

async function saveToFirestore(uid) {
  if (!uid) return false;
  /* Not into a cloud this page never loaded (loadFromFirestore), nor from a
     tab another account has taken this device from (_onlineSlotLost), apart
     from that tab's one last save of its own work. */
  const refused = _cloudLoadFailedFor === uid
    ? 'Your cloud save could not be loaded, so nothing is sent to it. Reload the page to try again.'
    : (_tabStale && !_tabFinalSave ? 'This tab has stopped saving: another tab is using this device for a different account. Reload to continue here.' : '');
  if (refused) {
    _cloudLastError = refused;
    _updateCloudStatusUI();
    if (!_cloudErrorToasted) { _cloudErrorToasted = true; showCloudToast(refused, true); }
    return false;
  }
  if (await _cloudConflictBlocks(uid)) {
    _cloudIsSaving = false;
    _updateCloudStatusUI();
    return false;
  }
  _cloudIsSaving = true;
  _updateCloudStatusUI();
  try {
    const seqAtStart = _cloudChangeSeq;   // a change after this is not in the upload
    let cloudUse = null;                  // what this save stores, for the Storage row
    const batch = fbDb.batch();
    const userRef = fbDb.collection('users').doc(uid);
    const domRef = (name) => userRef.collection('domains').doc(name);

    // Root doc — metadata only (overwrites old V1 fields if migrating)
    /* THE ROOT KEEPS OLDER BUILDS FROM READING AN EMPTY LIBRARY. Domains now go
       up compressed and in parts, which a build from before cannot read: it
       would take every split domain for empty and its next save would upload
       that. So the format is named in `schema`, not `schemaVersion`: an older
       build, finding no schemaVersion, takes its V1 path, which reads `app`
       here first, and the trap in it throws before anything is changed -- its
       load then fails and it keeps that device's own copy. One stale load per
       device after a release, never a wipe. */
    batch.set(userRef, {
      schema: FIRESTORE_FORMAT,
      lastSaved: firebase.firestore.FieldValue.serverTimestamp(),
      savedBy: _deviceId(),
      app: { challenges: FS_OLD_READER_TRAP }
    });

    // App domain (core data — excludes history for size management)
    const appPayload = _sanitizeForFirestore({
      nodes: state.nodes,
      expandedNodes: state.expandedNodes,
      codingPackLayout: state.codingPackLayout || 0,
      langRun: state.langRun || null,
      categoryRequirements: state.categoryRequirements,
      snippetProgress: state.snippetProgress,
      badges: state.badges,
      snippets: state.snippets,
      notebooks: state.notebooks,
      challenges: state.challenges,
      activeAttempts: state.activeAttempts,
      // Everything below this line used to be saved to localStorage and
      // nowhere else. On a cloud account that made it single-device data that
      // sign-out deleted.
      codingSets: state.codingSets || [],
      review: state.review || {},
      deadlines: state.deadlines || {},
      events: state.events || [],
      langWords: state.langWords || [],
      langSets: state.langSets || [],
      langScenarios: state.langScenarios || [],
      typeItems: state.typeItems || [],
      wings: state.wings || {},
      // The cheat sheets live in their own localStorage key rather than in
      // `state`. csSave() has always asked for a cloud save; nothing carried
      // them until now.
      cheatsheets: (typeof cs !== 'undefined' && cs.sheets) ? cs.sheets : _cheatSheetsFromStorage(),
      // Parked library and the classified error log -- neither was written
      // anywhere before, so both died with the tab. See state.js.
      mistakes: state.mistakes || [],
      /* THE ATTEMPT YOU HAVE NOT FINISHED. It lives in localStorage and went
         nowhere, so Resume was a single-device promise: the code you wrote on
         one machine simply was not on the other. It carries its own savedAt,
         which is what lets the newer of two drafts win on load rather than
         whichever device happened to sync last. */
    }) || {};

    /* THE PARKED LIBRARY AND THE UNFINISHED ATTEMPTS GET THEIR OWN DOCUMENT.
       A Firestore document is capped at 1MB and the write is rejected whole if
       it goes over -- silently, as far as the app is concerned. The app doc is
       414KB with the pack installed, and codingStash is a SECOND library of
       much the same size, so putting it alongside would have taken a user with
       both packs to the edge of a cap that fails the entire sync rather than
       the one field. Drafts carry whole files and ride along here for the same
       reason. */
    const stashPayload = _sanitizeForFirestore({
      codingStash: state.codingStash || null,
      // The map of program drafts (practice.js); one per program now.
      // From a tab behind another profile's, its own parked map (practiceDraftMap reads the keys).
      practiceDraft: (typeof practiceDraftMap === 'function' && _holdsOwnKeys()) ? practiceDraftMap()
        : (_draftForCloud('ssp.practiceDrafts') || _draftForCloud('ssp.practiceDraft')),
      sqlDraft: _draftForCloud('ssp.sqlAttemptDraft'),
      /* The notebook attempt too. Home lists all three under Resume, from
         the same keys that resume them, but only two of them travelled --
         so a half-finished reviewer was offered on the machine you left it
         on and nowhere else. It carries savedAt like the others, so the
         newer of two devices' drafts wins the same way. Measured at 8.9KB
         for a 120-question attempt, against a 1MB document cap. */
      npDraft: _draftForCloud('npAttemptInProgress'),
      // Practice sets keep a draft per set too (practice-set.js), merged per set on load.
      psetDrafts: _draftForCloud('ssp.psetDrafts')
    }) || {};

    // Preferences and the data kept in their own keys (SYNC_PREF_KEYS).
    const prefsPayload = _sanitizeForFirestore(_prefsForCloud()) || {};

    // History domain (separated — grows unbounded)
    const historyPayload = _sanitizeForFirestore({
      history: state.history,
      notebookHistory: state.notebookHistory,
      snippetHistory: state.snippetHistory || [],
      langHistory: state.langHistory || [],
      typeHistory: state.typeHistory || []
    }) || {};

    /* Freeground and the training sections: a document each, so neither can
       push the app or history document over its cap (js/train-store.js). */
    const trainingPayload = _sanitizeForFirestore(typeof trainFieldsWrite === 'function' ? trainFieldsWrite('training') : {}) || {};
    const fgRaw = typeof trainFieldsWrite === 'function' ? trainFieldsWrite('freeground') : {};
    if (fgRaw.freeground && Array.isArray(fgRaw.freeground.tabs)) {
      // The last run's output stays on this device (a copy: state keeps it).
      fgRaw.freeground = Object.assign({}, fgRaw.freeground, { tabs: fgRaw.freeground.tabs.map(t => Object.assign({}, t, { lastRun: '' })) });
    }
    const fgPayload = _sanitizeForFirestore(fgRaw) || {};

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

    /* Per-domain size check (Firestore doc limit: 1 MB each).

       STASH IS CHECKED TOO, and used not to be -- which is backwards, because
       it is the document this whole split exists for. It carries the parked
       library, a second full copy of the pack, plus three unfinished attempts.
       Every other domain was measured and it alone went out unmeasured.

       That mattered more than a missed warning: the write is one atomic batch,
       so an oversized stash does not fail by itself, it fails EVERY domain with
       it -- app, history, settings, all of it -- and reports a raw Firestore
       error instead of the sentence that says what to do about it. */
    const domains = { app: appPayload, history: historyPayload, stash: stashPayload, viz: vizPayload, brain: brainPayload, quests: questsPayload, settings: settingsPayload, training: trainingPayload, freeground: fgPayload, prefs: prefsPayload };
    const measured = {};
    let totalBytes = 0;
    for (const [name, payload] of Object.entries(domains)) {
      /* UTF-8 BYTES, which is what Firestore counts. String length counts
         UTF-16 units, and every em dash and arrow in this app's own copy is
         one unit but three bytes -- measured at 0.08% more bytes than units
         on a real stash, which is 840 bytes at the threshold against a margin
         of only 576. A document sitting right on the line could therefore
         pass here and still be refused. The limit is also not purely payload:
         Firestore charges for field names and its own per-document overhead,
         so the ceiling leaves room for that instead of aiming at the cap. */
      let size = 0, json = '';
      try {
        json = JSON.stringify(payload);
        size = (typeof TextEncoder !== 'undefined')
          ? new TextEncoder().encode(json).length
          : json.length;
      } catch (e) {}
      totalBytes += size;
      measured[name] = { json, size };
    }

    /* COMPRESSED, like the copy on this device. A domain of 16 KB or more goes
       up as its JSON deflated (fflate, in its worker, read back before it is
       trusted), as base64 text in parts:
         domains/<name>       { $parts: n, $z: 1 }
         domains/<name>__pN   { s: base64 }
       The library falls from ~1.3 MB to a fraction of that. Always in parts, even
       one: the build before this reads a $parts head as JSON text, and on base64
       that fails loudly (its load keeps the device's copy) rather than reading
       an empty library. A domain that will not compress goes up as JSON text in
       parts when over the cap (the earlier format), else plain as always. */
    const names = Object.keys(domains);
    const zipped = await Promise.all(names.map(n => measured[n].json.length >= FS_Z_MIN ? _fsDeflate(measured[n].json) : null));
    const plan = {};
    let storedBytes = 0, largestDoc = 0, docCount = 0;
    names.forEach((name, i) => {
      const { json, size } = measured[name];
      let parts = null, head = null;
      if (zipped[i]) {
        parts = _fsChunk(_fsB64(zipped[i]), FS_B64_PART);
        head = { [FS_PARTS_KEY]: parts.length, [FS_Z_KEY]: 1 };
      } else if (size > DOC_BYTE_CEILING) {
        parts = _fsSplitText(json);
        head = { [FS_PARTS_KEY]: parts.length };
      }
      if (parts && parts.length > FS_MAX_PARTS) {
        const hint = name === 'history' ? 'Trim practice history (Analytics → delete old attempts).'
          : name === 'app' ? 'Reduce challenges/snippets/notebooks.'
          : name === 'stash' ? 'The parked library is too big. Switch the coding library over to it so it is not being carried as a spare, or clear it.'
          : (typeof trainDomainHint === 'function' && trainDomainHint(name)) || ('Reduce ' + name + ' data.');
        const err = new Error('Domain "' + name + '" too large (' + Math.round(size / 1024) + ' KB). ' + hint);
        err.code = 'doc-too-large';
        throw err;
      }
      plan[name] = { head, parts };
      if (!parts) {
        storedBytes += size; largestDoc = Math.max(largestDoc, size); docCount++;
      } else {
        const bytes = zipped[i] ? parts.reduce((n, t) => n + t.length, 0) : size;
        storedBytes += bytes;
        docCount += 1 + parts.length;
        largestDoc = Math.max(largestDoc, zipped[i] ? Math.max.apply(null, parts.map(t => t.length)) : Math.ceil(size / parts.length));
      }
    });
    // One commit carries every document, and Firestore caps a commit at 10 MiB.
    if (storedBytes > FS_COMMIT_CEILING) {
      const err = new Error('Cloud save too large (' + (storedBytes / 1048576).toFixed(1) + ' MB). Trim practice history or remove unused programs.');
      err.code = 'doc-too-large';
      throw err;
    }

    // Add all domain docs to the atomic batch (a split one as its head and parts).
    for (const name of names) {
      const { head, parts } = plan[name];
      if (!parts) { batch.set(domRef(name), domains[name]); continue; }
      batch.set(domRef(name), head);
      parts.forEach((text, i) => batch.set(domRef(name + '__p' + i), { s: text }));
    }
    cloudUse = { uid: uid, stored: storedBytes, raw: totalBytes, largest: largestDoc, docs: docCount };

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

    /* A change made while this save was in flight is not in it. Clearing the
       flag anyway left that change on this device only -- and its timer had
       already met a save running and given up -- so it reached the cloud only
       with the next change, or never if there was none. */
    const changedMeanwhile = seqAtStart !== _cloudChangeSeq;
    _cloudIsDirty = changedMeanwhile;
    _cloudIsSaving = false;
    _lastCloudSaveAt = Date.now();
    _cloudBaseline = _lastCloudSaveAt;
    _cloudCopySave(uid, !changedMeanwhile);
    if (cloudUse) {
      cloudUse.at = Date.now();
      // Part of the account slot: only while it is this account's.
      try { if (localStorage.getItem(ONLINE_OWNER_KEY) === uid) localStorage.setItem(CLOUD_USE_KEY, JSON.stringify(cloudUse)); } catch (e) { /* full */ }
    }
    _cloudLastError = '';
    _cloudErrorToasted = false;
    _updateCloudStatusUI();
    if (changedMeanwhile) scheduleCloudSave();   // the usual 5 s wait, then the rest goes up
    // Then the pictures the library uses, each its own document (js/media-store.js).
    if (typeof mediaCloudPush === 'function') mediaCloudPush(uid).catch(() => {});
    // Notify other tabs that cloud data changed
    if (_syncChannel) {
      try { _syncChannel.postMessage({ type: 'cloud-saved', tabId: _tabId, at: Date.now(), uid: uid }); } catch (e) {}
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
    _cloudLastError = msg;
    _updateCloudStatusUI();
    if (!_cloudErrorToasted) { _cloudErrorToasted = true; showCloudToast(msg, true); }
    return false;
  }
}

/** Called by saveData()/vizSave()/brainSave()/saveQuestData().
 *  Marks dirty and schedules a debounced auto-save to cloud.
 *  "Save now" button still works for immediate flush. */
/* ── Unfinished attempts ───────────────────────────────────────
   Read straight out of localStorage rather than from `state`, because that is
   where the editor keeps them: the draft is written on a timer while you type,
   long before anything is graded. */
function _draftForCloud(key) {
  try {
    const raw = _ownKeyRaw(key);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return (d && typeof d === 'object') ? d : null;
  } catch (e) { return null; }
}

/**
 * Keep whichever draft is newer.
 *
 * Two devices can each hold an unfinished attempt, and the one that synced
 * last is not necessarily the one written last -- a laptop that has been shut
 * since Tuesday would otherwise overwrite this morning's work when it wakes up
 * and pushes. savedAt decides it instead.
 */
function _restoreDraft(key, incoming) {
  if (!incoming || typeof incoming !== 'object') return;
  try {
    const mineRaw = localStorage.getItem(key);
    if (mineRaw) {
      const mine = JSON.parse(mineRaw);
      if (mine && (mine.savedAt || 0) >= (incoming.savedAt || 0)) return;
    }
    localStorage.setItem(key, JSON.stringify(incoming));
  } catch (e) { /* private mode, or a draft too big to store */ }
}

/**
 * Program drafts from the cloud, merged per program: the newer savedAt wins for
 * each one, so a draft that only this device has is never dropped. Takes the
 * map, or the single draft older releases sent.
 */
function _restorePracticeDrafts(incoming) {
  if (!incoming || typeof incoming !== 'object') return;
  if (typeof practiceDraftMap !== 'function') { _restoreDraft('ssp.practiceDraft', incoming); return; }
  try { practiceDraftStore(practiceDraftMerge(practiceDraftMap(), incoming)); }
  catch (e) { /* private mode, or too big to store */ }
}

function scheduleCloudSave() {
  if (_suppressCloudSave) return;
  markCloudDirty();
  // Debounced auto-save
  if (storageMode === 'online' && currentFirebaseUser) {
    clearTimeout(_cloudSaveTimer);
    _cloudSaveTimer = setTimeout(() => {
      // Offline, the write would only time out after a minute and report a
      // failure; it waits for the 'online' event instead (_flushIfWaiting).
      // Not while an account is being loaded: memory is half one account, half nothing.
      if (_cloudIsDirty && !_cloudIsSaving && !_suppressCloudSave && navigator.onLine !== false) flushCloudNow();
    }, CLOUD_SAVE_DEBOUNCE_MS);
  }
}

/** Run `fn` with cloud-save suppression — useful during init flows where
 *  helpers like vizAutoPopulate or checkDailyReset call saveData/vizSave/etc
 *  but no real user change has occurred yet. */
/* Saving when it matters. Hiding the tab is the last moment a phone reliably
   runs the page, and state.js has just written everything locally and marked
   it unsaved (its listener runs first: it loads first), so the cloud save
   goes now, not after the 5 s delay. Back online, whatever waited goes up. */
function _flushIfWaiting() {
  if (storageMode !== 'online' || !currentFirebaseUser) return;
  if (!_cloudIsDirty || _cloudIsSaving || _suppressCloudSave || navigator.onLine === false) return;
  clearTimeout(_cloudSaveTimer);
  _cloudSaveTimer = null;
  flushCloudNow();
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') _flushIfWaiting(); });
window.addEventListener('online', () => { _paintSyncFab(); _flushIfWaiting(); });
window.addEventListener('offline', () => _paintSyncFab());

function withCloudSaveSuppressed(fn) {
  const prev = _suppressCloudSave;
  _suppressCloudSave = true;
  try { return fn(); } finally { _suppressCloudSave = prev; }
}

/* ---------- Cloud Toast ---------- */

function showCloudToast(message, isError) {
  // One toast for the whole app (js/motion.js); #cloud-save-toast is the fallback.
  if (window.Motion && typeof Motion.toast === 'function') {
    Motion.toast(message, { type: isError ? 'error' : 'success', duration: 2500 });
    return;
  }
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
        ${typeof acctCanAttachEmail === 'function' && acctCanAttachEmail(currentFirebaseUser) ? `<button onclick="acctOpenRecovery()" class="cu-action-btn" title="Attach a recovery email (optional)" aria-label="Recovery email">
          <i data-lucide="mail-plus" style="width:14px;height:14px;"></i>
          <span>Recovery email</span>
        </button>` : ''}
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
    _paintSyncFab();
  }
}

/** The sync icon above the gear: hidden unless signed in; data-state picks
    the icon and dot (components.css), the title says when or why. */
function _paintSyncFab() {
  const btn = document.getElementById('sync-fab');
  if (!btn) return;
  const on = storageMode === 'online' && !!currentFirebaseUser;
  btn.classList.toggle('hidden', !on);
  if (!on) return;
  let st, label;
  if (_cloudIsSaving) { st = 'saving'; label = 'Saving to the cloud...'; }
  else if (navigator.onLine === false) { st = 'offline'; label = 'Offline. Changes stay on this device and sync when you are back online.'; }
  else if (_cloudLastError) { st = 'error'; label = 'Last save failed: ' + _cloudLastError + ' Click to try again.'; }
  else if (_cloudIsDirty) { st = 'dirty'; label = 'Changes waiting to sync. Click to save now.'; }
  else { st = 'synced'; label = (_lastCloudSaveAt ? 'Synced ' + _agoText(_lastCloudSaveAt) : 'All synced') + '. Click to save now.'; }
  if (btn.dataset.state !== st) btn.dataset.state = st;
  btn.title = label;
  btn.setAttribute('aria-label', 'Cloud sync: ' + label);
}

function _updateCloudStatusUI() {
  _paintSyncFab();
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
  if (typeof _dlgOpen === 'function') _dlgOpen(modal); else modal.classList.remove('hidden');
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: modal });
}

async function _doSignOut() {
  try {
    const uid = currentFirebaseUser && currentFirebaseUser.uid;
    await fbAuth.signOut();
    currentFirebaseUser = null;
    storageMode = null;
    sessionStorage.removeItem('storageMode');
    localStorage.removeItem('storageMode'); // clean up legacy key from older builds

    /* Wipe ALL cached cloud data from localStorage so next sign-in starts
       clean, and this account's drafts (profile-keys.js). By name: this used
       to remove getAppStorageKey() as well, which in a tab restored by
       "Remember me" (where the mode was never stored for the tab) was
       GUEST's library. */
    _forgetAccountHere(uid);

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
    /* Only when leaving could lose something. With a trusted copy on this
       device the changes are safe here and go up on the next open, so a
       refresh no longer asks. */
    if (storageMode === 'online' && (_cloudIsDirty || _cloudIsSaving) && !_cloudCopyHolds()) {
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
      if (evt.data.type === 'cloud-saved' && _cloudSavedConcernsThisTab(evt.data)) {
        showCloudToast('Another tab saved changes — click "Reload" to sync.', false);
        _showStaleTabBanner();
      }
    };
  }
}

/** Only another tab of this same account has news for this one: Guest's tab, or
 *  another account's, was told "data was updated" by every cloud save. */
function _cloudSavedConcernsThisTab(msg) {
  return storageMode === 'online' && !!currentFirebaseUser && !!msg && msg.uid === currentFirebaseUser.uid;
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
    // "Remember me" brings a new browser session straight here; the tab must know its mode too.
    try { sessionStorage.setItem('storageMode', 'local'); } catch (e) { /* blocked: Guest is the default anyway */ }
    if (typeof profileKeysEnter === 'function') profileKeysEnter('guest');
    loadData();
    if (typeof repairDataIntegrity === 'function') repairDataIntegrity();
    finishBoot();
    return;
  }

  if (savedMode === 'online') {
    storageMode = 'online';
    const showRestoring = () => {
      showStorageModePicker();
      _showSigninLoadingView();
      _resetSigninProgress();
      _signinProgressTo(25, 'Restoring session...');
    };
    /* With the account's copy on this device the app normally opens before
       the loading screen would even be seen (_bootFromDeviceCopy). */
    let restoringTimer = 0;
    if (_cloudCopyRead()) restoringTimer = setTimeout(() => { restoringTimer = 0; showRestoring(); }, 600);
    else showRestoring();
    const restoringNow = () => {
      if (!restoringTimer) return;
      clearTimeout(restoringTimer);
      restoringTimer = 0;
      showRestoring();
    };

    const unsub = fbAuth.onAuthStateChanged(async (user) => {
      unsub();
      if (user) {
        currentFirebaseUser = user;
        /* Every get*StorageKey() reads the mode from the TAB's session. A new
           browser session restored by "Remember me" comes here with none, so
           the account's library was cached into Guest's keys, its saves went
           there, and signing out deleted Guest's library. */
        try { sessionStorage.setItem('storageMode', 'online'); } catch (e) { /* blocked */ }
        updateCloudUserBadge();
        if (_bootFromDeviceCopy(user)) {
          clearTimeout(restoringTimer);
          restoringTimer = 0;
          hideStorageModePicker();
          _resetSigninProgress();
          _showSigninChooseView();
          finishBoot();
          _cloudCheckAfterDeviceBoot(user.uid).catch(e => console.warn('[Firebase] refresh check:', e));
          return;
        }
        restoringNow();
        _signinProgressTo(70, 'Syncing cloud data...');
        await loadFromFirestore(user.uid);
        _signinProgressFinish('Welcome back!');
        setTimeout(() => {
          hideStorageModePicker();
          _showSigninChooseView();
          finishBoot();
        }, 320);
      } else {
        restoringNow();   // signed out meanwhile: the picker must be on screen to sign in
        _resetSigninProgress();
        _showSigninChooseView();
      }
    });
    return;
  }

  // First visit: straight to the picker.
  showStorageModePicker();
}
