/* ============================================================
   STATUS WINDOW — the game-style greeting after you enter
   ------------------------------------------------------------
   A translucent blue "system" window, the kind an RPG shows a new player:
   [ SYSTEM ], a typed-out greeting, and the player's status -- name, how
   they are signed in, Quest Board level and XP, streak, programs passed,
   accuracy, last session.

   In full the first time an account (or Guest, on this device) enters; after
   that a short "Welcome back" once a day, which goes by itself. Called from
   finishBoot (firebase-auth.js). Records: ssp.welcome.seen.<account> and
   ssp.welcome.day.<account> in localStorage.

   A browser driven by tests does not get it (it would cover what they click)
   unless ssp.welcome.test is set.
   ============================================================ */

const SW_BRIEF_MS = 6500;

function _swGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
function _swSet(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* private mode: it shows again */ } }

function _swToday() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/** Who is entering: { key, name, kind }. */
function _swAccount() {
  const online = typeof storageMode !== 'undefined' && storageMode === 'online'
    && typeof currentFirebaseUser !== 'undefined' && currentFirebaseUser;
  if (!online) return { key: 'guest', name: 'Guest', kind: 'Guest · this device' };
  const u = currentFirebaseUser;
  const name = typeof acctDisplayName === 'function' ? acctDisplayName(u) : (u.displayName || 'Player');
  const isAccount = typeof acctIsInternal === 'function' && acctIsInternal(u.email);
  const viaGoogle = (u.providerData || []).some(p => p && p.providerId === 'google.com');
  return { key: 'u:' + u.uid, name, kind: viaGoogle ? 'Google account' : (isAccount ? 'Player account' : 'Account') };
}

/** The Quest Board's player, read from its save without running its daily reset. */
function _swPlayer() {
  if (typeof questState !== 'undefined' && questState && questState.player && questState.quests && questState.quests.length) return questState.player;
  try {
    const key = typeof getQuestStorageKey === 'function' ? getQuestStorageKey() : 'questBoardData_v3';
    const raw = localStorage.getItem(key);
    const d = raw ? JSON.parse(raw) : null;
    if (d && d.player) return d.player;
  } catch (_) { /* no board yet */ }
  return { level: 1, xp: 0, job: null, title: null };
}

function _swStats() {
  const hist = (typeof state !== 'undefined' && state && state.history) || [];
  const passed = new Set(hist.filter(h => (h.score || 0) >= 100 && h.challengeId).map(h => h.challengeId)).size;
  const recent = hist.slice(-50);
  const acc = recent.length ? Math.round(recent.reduce((a, h) => a + (h.score || 0), 0) / recent.length) : null;
  let last = 0;
  hist.forEach(h => { const t = new Date(h.startTime || h.date || 0).getTime(); if (t > last) last = t; });
  let streak = 0;
  try { streak = typeof calculateStreak === 'function' ? calculateStreak() : 0; } catch (_) { streak = 0; }
  const p = _swPlayer();
  const level = Math.max(1, p.level || 1);
  const need = typeof getXPForNextLevel === 'function' ? getXPForNextLevel(level) : 100 * Math.pow(1.5, level - 1);
  return { passed, acc, last, streak, level, xp: p.xp || 0, need: Math.max(1, Math.floor(need)), job: p.job, title: p.title };
}

function _swAgo(t) {
  if (!t) return 'None yet';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 90) return 'Just now';
  if (s < 3600) return Math.round(s / 60) + ' min ago';
  if (s < 86400) return Math.round(s / 3600) + ' h ago';
  const d = Math.round(s / 86400);
  return d === 1 ? 'Yesterday' : d + ' days ago';
}

function _swEsc(s) {
  return typeof escapeHTML === 'function' ? escapeHTML(String(s)) : String(s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
}

/** Show the window if this entry calls for it. */
function statusWindowMaybeShow() {
  if (navigator.webdriver && _swGet('ssp.welcome.test') !== '1') return;
  if (document.getElementById('status-window')) return;
  const acct = _swAccount();
  const seenKey = 'ssp.welcome.seen.' + acct.key, dayKey = 'ssp.welcome.day.' + acct.key;
  const today = _swToday();
  const first = _swGet(seenKey) !== '1';
  if (!first && _swGet(dayKey) === today) return;
  _swSet(seenKey, '1');
  _swSet(dayKey, today);
  statusWindowShow(first ? 'full' : 'brief', acct);
}

function statusWindowShow(kind, acct) {
  acct = acct || _swAccount();
  const st = _swStats();
  const full = kind === 'full';
  const greet = full ? 'Welcome, ' + acct.name + '.' : 'Welcome back, ' + acct.name + '.';
  const xpFrac = Math.min(1, st.xp / st.need);
  const cell = (k, v, icon) => `<div class="sw-cell"><span class="sw-k">${icon ? '<i data-lucide="' + icon + '"></i>' : ''}${k}</span><b>${_swEsc(v)}</b></div>`;
  const el = document.createElement('div');
  el.id = 'status-window';
  el.className = 'sw-overlay ' + (full ? 'is-full' : 'is-brief');
  el.setAttribute('role', full ? 'dialog' : 'status');
  if (full) { el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'sw-title'); }
  el.innerHTML = `<div class="sw-window">
    <span class="sw-scan" aria-hidden="true"></span>
    <span class="sw-edge is-t" aria-hidden="true"></span><span class="sw-edge is-b" aria-hidden="true"></span>
    <div class="sw-head"><span class="sw-tag">[ SYSTEM ]</span><span class="sw-rule" aria-hidden="true"></span><span class="sw-clock">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
    <h2 class="sw-title" id="sw-title"><span class="sw-type" aria-label="${_swEsc(greet)}"></span><span class="sw-caret" aria-hidden="true"></span></h2>
    <p class="sw-sub">${full ? 'A new player has arrived. Your save file is ready.' : (st.streak ? 'Day ' + st.streak + ' of your streak. Keep it going.' : 'A new day. Your quests are waiting.')}</p>
    ${full ? `<div class="sw-status">
      <div class="sw-id">
        <div class="sw-id-row"><span class="sw-k">NAME</span><b>${_swEsc(acct.name)}</b></div>
        <div class="sw-id-row"><span class="sw-k">STORAGE</span><b>${_swEsc(acct.kind)}</b></div>
        ${st.job ? `<div class="sw-id-row"><span class="sw-k">JOB</span><b>${_swEsc(st.job)}</b></div>` : ''}
      </div>
      <div class="sw-level">
        <span class="sw-lv">LV.</span><b class="sw-lv-n">${st.level}</b>
        <div class="sw-xp"><div class="sw-xp-bar"><i style="--xp:${xpFrac.toFixed(3)}"></i></div><small>${st.xp} / ${st.need} XP</small></div>
      </div>
      <div class="sw-grid">
        ${cell('STREAK', st.streak + (st.streak === 1 ? ' day' : ' days'), 'flame')}
        ${cell('PASSED', st.passed + (st.passed === 1 ? ' program' : ' programs'), 'trophy')}
        ${cell('ACCURACY', st.acc == null ? '—' : st.acc + '%', 'target')}
        ${cell('LAST SESSION', _swAgo(st.last), 'history')}
      </div>
    </div>
    <div class="sw-foot"><span class="sw-hint">Press Enter</span><button type="button" class="sw-btn" id="sw-confirm">Confirm</button></div>`
    : `<div class="sw-brief-stats"><span><i data-lucide="flame"></i>${st.streak} day streak</span><span><i data-lucide="shield"></i>LV. ${st.level}</span><span><i data-lucide="history"></i>${_swAgo(st.last)}</span></div>`}
  </div>`;
  document.body.appendChild(el);
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: el });

  // The greeting types itself out once.
  const out = el.querySelector('.sw-type');
  let i = 0;
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const type = () => {
    if (!out.isConnected) return;
    i = reduce ? greet.length : i + 1;
    out.textContent = greet.slice(0, i);
    if (i < greet.length) setTimeout(type, 34);
    else el.classList.add('is-typed');
  };
  setTimeout(type, full ? 380 : 220);

  const close = () => statusWindowClose(el);
  if (full) {
    const btn = el.querySelector('#sw-confirm');
    btn.addEventListener('click', close);
    el._swKey = e => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); close(); } };
    document.addEventListener('keydown', el._swKey, true);
    setTimeout(() => { if (btn.isConnected) btn.focus({ preventScroll: true }); }, 400);
  } else {
    el.addEventListener('click', close);
    el._swTimer = setTimeout(close, SW_BRIEF_MS);
  }
  return el;
}

function statusWindowClose(el) {
  el = el || document.getElementById('status-window');
  if (!el || el.classList.contains('is-closing')) return;
  el.classList.add('is-closing');
  clearTimeout(el._swTimer);
  if (el._swKey) document.removeEventListener('keydown', el._swKey, true);
  // Faded by a transition, then gone (no animation is left holding it).
  setTimeout(() => el.remove(), 320);
}
