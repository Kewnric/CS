/* ============================================================
   ACCOUNTS — username + password, and the login page around them
   ------------------------------------------------------------
   No email needed. A username is a Firebase email/password account under an
   internal address, <name>@users.studysession.app, which is never mailed:
   Firebase keeps emails unique, so usernames are unique, and it hashes the
   password. The account's cloud library lives under users/<uid> exactly like
   a Google account's (firebase-auth.js loads and saves by uid), and signing
   in ends in the same _afterSignedIn as Google.

   Needs, once, in the Firebase console: Authentication → Sign-in method →
   Email/Password. Until then sign-up fails with auth/operation-not-allowed,
   and the page says what to switch on.

   OPTIONAL RECOVERY EMAIL. Attached from the sidebar's account card: the
   account moves to that real address (verifyBeforeUpdateEmail), and a lookup
   usernames/<name> keeps the address ENCRYPTED with a key derived from the
   password (PBKDF2-SHA256 → AES-GCM), so signing in by username still works
   and nobody can read the email by knowing the username. Forgot password
   sends Firebase's reset mail to that address. After a reset the old lookup
   no longer opens: sign in with the email once and it is rewritten. The
   lookup needs this Firestore rule:
     match /usernames/{name} {
       allow get: if true;
       allow create: if request.auth != null && request.resource.data.uid == request.auth.uid;
       allow update, delete: if request.auth != null && resource.data.uid == request.auth.uid;
     }
   ============================================================ */

const ACCT_DOMAIN = 'users.studysession.app';
const ACCT_KDF_ITERS = 250000;
const ACCT_BAD_LOGIN = ['auth/invalid-credential', 'auth/invalid-login-credentials', 'auth/user-not-found', 'auth/wrong-password'];

const ACCT_ERRORS = {
  'auth/email-already-in-use': 'That username is taken. Try another one.',
  'auth/invalid-credential': 'Wrong username or password.',
  'auth/invalid-login-credentials': 'Wrong username or password.',
  'auth/user-not-found': 'Wrong username or password.',
  'auth/wrong-password': 'Wrong username or password.',
  'auth/invalid-email': 'That is not a valid username or email.',
  'auth/missing-password': 'Type your password.',
  'auth/weak-password': 'Pick a stronger password: at least 8 characters.',
  'auth/operation-not-allowed': 'Username accounts are not switched on for this app yet. In the Firebase console: Authentication → Sign-in method → enable Email/Password.',
  'auth/network-request-failed': 'No connection. Check your network, or play as Guest for now.',
  'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/requires-recent-login': 'For your safety, sign out and back in, then try again.',
  'ssp/moved': 'Wrong password — or, if you reset it by email, sign in with your email this once.',
  'ssp/offline': 'You are offline. Guest play works fine without a connection.',
  'ssp/mismatch': 'The two passwords are not the same.',
  'permission-denied': 'The recovery lookup is not allowed yet: add the "usernames" rule to Firestore (see the note in auth-accounts.js).'
};

/* ── Names and addresses ─────────────────────────────────────── */

/** Null when the name is fine; otherwise what is wrong with it. */
function acctValidUsername(name) {
  const n = String(name || '').trim();
  if (n.length < 3) return 'A username needs at least 3 characters.';
  if (n.length > 20) return 'A username can be at most 20 characters.';
  if (!/^[A-Za-z0-9_.]+$/.test(n)) return 'Use letters, digits, _ and . only (no spaces).';
  if (/^\.|\.$|\.\./.test(n)) return 'A dot cannot start or end the name, or come twice in a row.';
  return null;
}

function acctEmailFor(name) {
  return String(name || '').trim().toLowerCase() + '@' + ACCT_DOMAIN;
}

function acctIsInternal(email) {
  return String(email || '').toLowerCase().endsWith('@' + ACCT_DOMAIN);
}

/** The name to greet a signed-in user by. */
function acctDisplayName(user) {
  if (!user) return 'Player';
  if (user.displayName) return user.displayName;
  const email = user.email || '';
  return email ? email.split('@')[0] : 'Player';
}

/** A username account (not Google) that has no recovery email yet. */
function acctCanAttachEmail(user) {
  return !!(user && acctIsInternal(user.email));
}

/* ── The recovery email, encrypted with the password ─────────── */

function _acctB64(bytes) {
  let s = '';
  bytes.forEach(b => { s += String.fromCharCode(b); });
  return btoa(s);
}
function _acctBytes(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}
async function _acctKey(password, salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ACCT_KDF_ITERS, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** { enc, iv, salt } (base64): `text` sealed with a key only `password` opens. */
async function acctEncrypt(text, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await _acctKey(password, salt);
  const enc = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text)));
  return { enc: _acctB64(enc), iv: _acctB64(iv), salt: _acctB64(salt) };
}

/** The text, or null when the password is not the one it was sealed with. */
async function acctDecrypt(blob, password) {
  try {
    const key = await _acctKey(password, _acctBytes(blob.salt));
    const out = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: _acctBytes(blob.iv) }, key, _acctBytes(blob.enc));
    return new TextDecoder().decode(out);
  } catch (e) {
    return null;
  }
}

/** usernames/<name>, or null (none, or the rule is not there). */
async function _acctLookup(name) {
  try {
    const d = await fbDb.collection('usernames').doc(name).get();
    return d.exists ? d.data() : null;
  } catch (e) {
    return null;
  }
}

async function _acctWriteLookup(name, uid, email, password) {
  const blob = await acctEncrypt(email, password);
  await fbDb.collection('usernames').doc(name).set({ uid, ...blob, at: Date.now() });
}

/* ── Signing up and in ────────────────────────────────────────── */

async function acctRegister(username, password) {
  const bad = acctValidUsername(username);
  if (bad) throw { code: 'ssp/bad-name', message: bad };
  if (String(password || '').length < 8) throw { code: 'auth/weak-password' };
  const cred = await fbAuth.createUserWithEmailAndPassword(acctEmailFor(username), password);
  try { await cred.user.updateProfile({ displayName: String(username).trim() }); } catch (_) { /* the name shows as the address's first part */ }
  await _acctEnter(cred.user, true);
}

async function acctSignIn(id, password) {
  const who = String(id || '').trim();
  if (!who) throw { code: 'ssp/bad-name', message: 'Type your username.' };
  if (!password) throw { code: 'auth/missing-password' };
  if (who.includes('@')) {
    const c = await fbAuth.signInWithEmailAndPassword(who, password);
    // A username account that moved to this email: keep its lookup opening
    // with the password in use now (after a reset it held the old one).
    const name = c.user && c.user.displayName && c.user.displayName.toLowerCase();
    if (name && !acctValidUsername(name)) {
      _acctLookup(name).then(look => {
        if (look && look.uid === c.user.uid) _acctWriteLookup(name, c.user.uid, who, password).catch(() => {});
      });
    }
    await _acctEnter(c.user);
    return;
  }
  const name = who.toLowerCase();
  try {
    const c = await fbAuth.signInWithEmailAndPassword(acctEmailFor(name), password);
    await _acctEnter(c.user);
  } catch (e) {
    if (!e || !ACCT_BAD_LOGIN.includes(e.code)) throw e;
    // Not under its internal address: it may have moved to a recovery email.
    const look = await _acctLookup(name);
    if (!look) throw e;
    const email = await acctDecrypt(look, password);
    if (!email) throw { code: 'ssp/moved' };
    const c = await fbAuth.signInWithEmailAndPassword(email, password);
    await _acctEnter(c.user);
  }
}

/** The tail every username sign-in shares with Google's. */
async function _acctEnter(user, isNew) {
  _resetSigninProgress();
  _showSigninLoadingView();
  _signinProgressTo(40, isNew ? 'Creating your save file...' : 'Signing in...');
  await _afterSignedIn(user);
}

async function acctForgot(email) {
  const e = String(email || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw { code: 'auth/invalid-email', message: 'Type the email you attached to your account.' };
  await fbAuth.sendPasswordResetEmail(e);
}

/** Attach a recovery email to the signed-in username account. */
async function acctAttachEmail(email, password) {
  const user = fbAuth.currentUser || currentFirebaseUser;
  if (!user || !acctIsInternal(user.email)) throw { code: 'ssp/none', message: 'Only a username account can attach a recovery email.' };
  const e = String(email || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw { code: 'auth/invalid-email', message: 'That email does not look right.' };
  const name = (user.displayName || user.email.split('@')[0]).toLowerCase();
  await user.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(user.email, password));
  await _acctWriteLookup(name, user.uid, e, password);
  await user.verifyBeforeUpdateEmail(e);
}

function acctErrorText(err) {
  if (!err) return 'Something went wrong. Try again.';
  if (err.code && ACCT_ERRORS[err.code]) return ACCT_ERRORS[err.code];
  if (err.message && String(err.code || '').indexOf('ssp/') === 0) return err.message;
  if (typeof authErrorMessage === 'function') {
    const m = authErrorMessage(err);
    if (m) return m;
  }
  return 'Something went wrong (' + (err.code || 'unknown') + '). Try again.';
}

/* ── The login page ───────────────────────────────────────────── */

let _lpTab = 'signin';

function lpSetTab(tab) {
  _lpTab = tab === 'create' ? 'create' : 'signin';
  const form = document.getElementById('lp-form');
  if (!form) return;
  form.dataset.tab = _lpTab;
  document.querySelectorAll('.lp-tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === _lpTab)));
  const tabs = document.querySelector('.lp-tabs');
  if (tabs) tabs.dataset.tab = _lpTab;
  const create = _lpTab === 'create';
  const label = document.getElementById('lp-user-label');
  if (label) label.textContent = create ? 'Username' : 'Username or email';
  const pass = document.getElementById('lp-pass');
  if (pass) pass.autocomplete = create ? 'new-password' : 'current-password';
  const go = document.querySelector('#lp-submit span');
  if (go) go.textContent = create ? 'Create account' : 'Sign in';
  const sub = document.getElementById('smp-subtitle');
  if (sub) sub.textContent = create ? 'Create your player. No email needed.' : 'Sign in to continue your journey';
  lpError('');
}

function lpError(msg) {
  const el = document.getElementById('lp-err');
  if (!el) return;
  el.textContent = msg || '';
  el.classList.toggle('is-on', !!msg);
}

let _lpBusy = false;
async function acctSubmit(ev) {
  if (ev) ev.preventDefault();
  if (_lpBusy) return;
  const user = (document.getElementById('lp-user') || {}).value || '';
  const pass = (document.getElementById('lp-pass') || {}).value || '';
  const pass2 = (document.getElementById('lp-pass2') || {}).value || '';
  lpError('');
  if (navigator.onLine === false) { lpError(ACCT_ERRORS['ssp/offline']); return; }
  if (_lpTab === 'create') {
    const bad = acctValidUsername(user);
    if (bad) { lpError(bad); return; }
    if (pass.length < 8) { lpError(ACCT_ERRORS['auth/weak-password']); return; }
    if (pass !== pass2) { lpError(ACCT_ERRORS['ssp/mismatch']); return; }
  }
  _lpBusy = true;
  try {
    if (_lpTab === 'create') await acctRegister(user, pass);
    else await acctSignIn(user, pass);
  } catch (err) {
    console.warn('[Accounts]', err);
    _resetSigninProgress();
    _showSigninChooseView();
    lpError(acctErrorText(err));
    const field = document.getElementById(err && String(err.code).indexOf('password') !== -1 ? 'lp-pass' : 'lp-user');
    if (field) field.focus();
  } finally {
    _lpBusy = false;
  }
}

function lpShowForgot(on) {
  const page = document.getElementById('storage-mode-popup');
  if (page) page.classList.toggle('lp-forgot-on', !!on);
  const msg = document.getElementById('lp-forgot-msg');
  if (msg) { msg.textContent = ''; msg.className = 'lp-err'; }
  const target = document.getElementById(on ? 'lp-forgot-email' : 'lp-user');
  if (target) setTimeout(() => target.focus(), 30);
}

async function lpSendReset() {
  const input = document.getElementById('lp-forgot-email');
  const msg = document.getElementById('lp-forgot-msg');
  try {
    await acctForgot(input && input.value);
    if (msg) { msg.textContent = 'If that email belongs to an account, a reset link is on its way. Check your inbox.'; msg.className = 'lp-err is-on is-ok'; }
  } catch (err) {
    if (msg) { msg.textContent = acctErrorText(err); msg.className = 'lp-err is-on'; }
  }
}

function lpToggleEye() {
  const pass = document.getElementById('lp-pass');
  const pass2 = document.getElementById('lp-pass2');
  const btn = document.getElementById('lp-eye');
  if (!pass || !btn) return;
  const show = pass.type === 'password';
  pass.type = show ? 'text' : 'password';
  if (pass2) pass2.type = pass.type;
  btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  btn.setAttribute('aria-pressed', String(show));
  btn.innerHTML = '<i data-lucide="' + (show ? 'eye-off' : 'eye') + '"></i>';
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: btn });
}

/* Your own picture on the page: kept in the picture store on this device
   (media-store.js), its reference in ssp.loginArt -- which also keeps the
   clean-up from treating it as unused. */
function lpPaintArt() {
  const art = document.getElementById('lp-art');
  const img = document.getElementById('lp-art-img');
  const rm = document.getElementById('lp-art-remove');
  let ref = null;
  try { ref = localStorage.getItem('ssp.loginArt'); } catch (_) { ref = null; }
  if (art) art.classList.toggle('has-img', !!ref);
  if (rm) rm.classList.toggle('hidden', !ref);
  if (!img) return;
  if (!ref) { img.classList.add('hidden'); img.removeAttribute('src'); return; }
  img.src = typeof mediaSrc === 'function' ? mediaSrc(ref) : ref;
  img.classList.remove('hidden');
}

async function lpUploadArt(input) {
  const file = input && input.files && input.files[0];
  if (input) input.value = '';
  if (!file || !/^image\//.test(file.type)) return;
  try {
    const ref = typeof mediaUpload === 'function' ? await mediaUpload(file) : null;
    if (!ref) return;
    try { localStorage.setItem('ssp.loginArt', ref); } catch (_) { /* full: the picture shows this time only */ }
    lpPaintArt();
  } catch (e) {
    console.warn('[Login] picture upload failed', e);
    if (typeof showCloudToast === 'function') showCloudToast('That picture could not be used.', true);
  }
}

function lpRemoveArt() {
  try { localStorage.removeItem('ssp.loginArt'); } catch (_) { /* nothing to remove */ }
  lpPaintArt();
}

/* A private window's storage is gone when it closes. Browsers do not say so,
   but they give it a small quota; when it looks like one, Guest says so. */
async function lpCheckPrivate() {
  const note = document.getElementById('lp-private');
  if (!note || !navigator.storage || !navigator.storage.estimate) return;
  try {
    const { quota } = await navigator.storage.estimate();
    note.classList.toggle('hidden', !(quota && quota < 200 * 1024 * 1024));
  } catch (_) { /* unknown: say nothing */ }
}

/** Called each time the login page comes up (showStorageModePicker). */
function lpOnShow() {
  lpSetTab(_lpTab);
  lpShowForgot(false);
  lpPaintArt();
  lpCheckPrivate();
}

/* Wiring: deferred scripts run once the document is parsed. */
(function lpWire() {
  const form = document.getElementById('lp-form');
  if (!form) return;
  form.addEventListener('submit', acctSubmit);
  document.querySelectorAll('.lp-tab').forEach(b => b.addEventListener('click', () => {
    lpSetTab(b.dataset.tab);
    const u = document.getElementById('lp-user');
    if (u) u.focus();
  }));
  const on = (id, ev, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(ev, fn); };
  on('lp-eye', 'click', lpToggleEye);
  on('lp-forgot-link', 'click', () => lpShowForgot(true));
  on('lp-forgot-back', 'click', () => lpShowForgot(false));
  on('lp-forgot-send', 'click', lpSendReset);
  on('lp-forgot-email', 'keydown', e => { if (e.key === 'Enter') { e.preventDefault(); lpSendReset(); } });
  on('lp-art-input', 'change', e => lpUploadArt(e.target));
  on('lp-art-remove', 'click', lpRemoveArt);
})();

/* ── Recovery email, from the sidebar's account card ─────────── */

function acctOpenRecovery() {
  let box = document.getElementById('acct-recovery');
  if (box) box.remove();
  box = document.createElement('div');
  box.id = 'acct-recovery';
  box.className = 'acct-recovery';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-labelledby', 'acct-rec-title');
  box.innerHTML = `<div class="acct-rec-card">
    <h3 id="acct-rec-title">Recovery email</h3>
    <p>Optional. With an email attached, "Forgot password?" can send you a reset link. It is stored encrypted with your password; you still sign in with your username.</p>
    <label class="lp-field"><span>Email</span><span class="lp-input"><i data-lucide="mail"></i><input id="acct-rec-email" type="email" autocomplete="email"></span></label>
    <label class="lp-field"><span>Your password</span><span class="lp-input"><i data-lucide="lock"></i><input id="acct-rec-pass" type="password" autocomplete="current-password"></span></label>
    <div class="lp-err" id="acct-rec-msg" role="status"></div>
    <div class="acct-rec-acts"><button type="button" class="lp-link" id="acct-rec-cancel">Cancel</button><button type="button" class="lp-primary" id="acct-rec-save"><span>Attach email</span></button></div>
  </div>`;
  document.body.appendChild(box);
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: box });
  const close = () => box.remove();
  box.addEventListener('click', e => { if (e.target === box) close(); });
  box.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  box.querySelector('#acct-rec-cancel').onclick = close;
  box.querySelector('#acct-rec-save').onclick = async () => {
    const msg = box.querySelector('#acct-rec-msg');
    msg.className = 'lp-err';
    msg.textContent = '';
    try {
      await acctAttachEmail(box.querySelector('#acct-rec-email').value, box.querySelector('#acct-rec-pass').value);
      msg.textContent = 'Check your inbox and open the link to confirm. Until then, nothing changes.';
      msg.className = 'lp-err is-on is-ok';
    } catch (err) {
      msg.textContent = acctErrorText(err);
      msg.className = 'lp-err is-on';
    }
  };
  setTimeout(() => { const f = box.querySelector('#acct-rec-email'); if (f) f.focus(); }, 30);
}
