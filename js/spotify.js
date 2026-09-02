/* ============================================================
   SPOTIFY.JS — the player's other source
   ------------------------------------------------------------
   The music button can play the bundled OST or drive Spotify. This is the
   Spotify half: sign-in, a Web Playback SDK device, and the transport the
   popup calls into. js/ost.js is untouched by it; ostSourceIsSpotify() is the
   one thing the two agree on.

   NO SECRET LIVES IN THIS REPO, and the flow is chosen for that reason.

   The Authorization Code flow needs a client SECRET to exchange the code, and
   a secret in a static site published to GitHub Pages is a secret published to
   everyone. The Implicit flow avoids that but hands back a token that expires
   in an hour with no way to renew it, so the music dies mid-session.

   PKCE is the one that fits: the app proves it started the exchange by holding
   a random verifier, so no secret is needed, AND it returns a refresh token so
   the session survives. The client id is not a secret -- it identifies the
   app, it does not authorise anything on its own -- so it is safe here.

   PREMIUM IS REQUIRED. The Web Playback SDK refuses to create a device on a
   free account; that is Spotify's rule, not a limitation of this code. The
   'account_error' listener below is what that failure arrives as, and it is
   reported rather than swallowed so the reason is visible.

   SETUP, once, at developer.spotify.com/dashboard:
     1. Create an app, copy its Client ID.
     2. Tick BOTH "Web API" and "Web Playback SDK".
     3. Add redirect URIs matching where this runs, EXACTLY:
          https://kewnric.github.io/CS/
          http://127.0.0.1:8754/     <- for local work, NOT localhost
        Spotify requires https everywhere except the loopback literals
        127.0.0.1 and [::1]; the hostname "localhost" is rejected outright.
        So to sign in locally the preview has to be opened on 127.0.0.1 too,
        or the address bar and the registered URI will not match. Both are
        secure contexts as far as crypto.subtle is concerned, so the PKCE
        challenge works either way -- this is purely Spotify's rule.
     4. Paste the Client ID into the player popup.
   ============================================================ */

const SPOT_CLIENT_KEY  = 'ssp.spotify.clientId';
const SPOT_TOKEN_KEY   = 'ssp.spotify.token';     // { access, refresh, expires }
const SPOT_VERIFIER_KEY = 'ssp.spotify.verifier';
const SPOT_SCOPES = [
  'streaming',                    // the SDK device
  'user-read-email',              // required alongside streaming
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state'    // shuffle, transfer, next/prev
].join(' ');

let _spotPlayer = null;
let _spotDeviceId = null;
let _spotState = null;          // last player_state_changed payload, normalised
let _spotSdkLoading = false;
let _spotError = '';

/* ── Stored credentials ─────────────────────────────────────── */

function spotifyClientId() {
  try { return localStorage.getItem(SPOT_CLIENT_KEY) || ''; } catch (e) { return ''; }
}

function spotifySetClientId(id) {
  const v = (id || '').trim();
  try { v ? localStorage.setItem(SPOT_CLIENT_KEY, v) : localStorage.removeItem(SPOT_CLIENT_KEY); }
  catch (e) { /* private mode */ }
}

function _spotTokens() {
  try { return JSON.parse(localStorage.getItem(SPOT_TOKEN_KEY) || 'null'); } catch (e) { return null; }
}

function _spotStoreTokens(t) {
  try {
    if (t) localStorage.setItem(SPOT_TOKEN_KEY, JSON.stringify(t));
    else localStorage.removeItem(SPOT_TOKEN_KEY);
  } catch (e) { /* private mode */ }
}

function spotifyConnected() {
  const t = _spotTokens();
  return !!(t && t.refresh);
}

/* ── PKCE ───────────────────────────────────────────────────── */

function _spotRandomString(n) {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  // Unreserved URL characters only, so the verifier survives a redirect intact.
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  return Array.from(bytes, b => abc[b % abc.length]).join('');
}

async function _spotChallenge(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  // base64url: standard base64 with the three characters that mean something
  // else in a URL swapped out, and the padding dropped.
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Exactly what must be registered in the dashboard — no hash, no query. */
function spotifyRedirectUri() {
  return location.origin + location.pathname;
}

async function spotifyLogin() {
  const id = spotifyClientId();
  if (!id) { _spotError = 'Enter your Spotify Client ID first.'; _spotSync(); return; }
  if (!window.isSecureContext) {
    // crypto.subtle is unavailable over plain http except on loopback, and the
    // failure would otherwise look like a Spotify problem rather than a
    // browser one.
    _spotError = 'Sign-in needs https, or 127.0.0.1 locally.'; _spotSync(); return;
  }
  const verifier = _spotRandomString(96);
  try { localStorage.setItem(SPOT_VERIFIER_KEY, verifier); } catch (e) { /* private mode */ }
  const challenge = await _spotChallenge(verifier);
  const q = new URLSearchParams({
    client_id: id,
    response_type: 'code',
    redirect_uri: spotifyRedirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SPOT_SCOPES
  });
  location.href = 'https://accounts.spotify.com/authorize?' + q.toString();
}

/**
 * Finish the redirect, if this load is one. Runs on every boot; cheap and
 * silent when there is no `code` in the URL.
 */
async function spotifyHandleRedirect() {
  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  const err = params.get('error');
  if (!code && !err) return false;

  // Take the code out of the address bar either way: it is single-use, and a
  // reload that retries it gets an invalid_grant that looks like a real fault.
  const clean = location.pathname + location.hash;
  history.replaceState(null, '', clean);

  if (err) { _spotError = 'Spotify sign-in was cancelled.'; _spotSync(); return false; }

  let verifier = '';
  try { verifier = localStorage.getItem(SPOT_VERIFIER_KEY) || ''; } catch (e) { /* ignore */ }
  try { localStorage.removeItem(SPOT_VERIFIER_KEY); } catch (e) { /* ignore */ }
  if (!verifier) { _spotError = 'Sign-in could not be completed — try again.'; _spotSync(); return false; }

  const ok = await _spotExchange({
    grant_type: 'authorization_code',
    code,
    redirect_uri: spotifyRedirectUri(),
    client_id: spotifyClientId(),
    code_verifier: verifier
  });
  if (ok) { spotifySetSource('spotify'); await spotifyEnsurePlayer(); }
  return ok;
}

/** Shared by the first exchange and every refresh after it. */
async function _spotExchange(body) {
  try {
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body).toString()
    });
    const j = await res.json();
    if (!res.ok || !j.access_token) {
      _spotError = j.error_description || j.error || 'Spotify refused the sign-in.';
      _spotSync();
      return false;
    }
    const prev = _spotTokens();
    _spotStoreTokens({
      access: j.access_token,
      // A refresh response does not always carry a new refresh token; keeping
      // the old one is the difference between a session that lasts and one
      // that logs itself out after an hour.
      refresh: j.refresh_token || (prev && prev.refresh) || '',
      expires: Date.now() + (j.expires_in || 3600) * 1000
    });
    _spotError = '';
    _spotSync();
    return true;
  } catch (e) {
    _spotError = 'Could not reach Spotify.';
    _spotSync();
    return false;
  }
}

/** A valid access token, refreshing it first if it is close to expiring. */
async function spotifyToken() {
  const t = _spotTokens();
  if (!t) return '';
  // 60s of slack: a token that expires mid-request is a request that fails.
  if (t.access && Date.now() < t.expires - 60000) return t.access;
  if (!t.refresh) return '';
  const ok = await _spotExchange({
    grant_type: 'refresh_token',
    refresh_token: t.refresh,
    client_id: spotifyClientId()
  });
  const now = _spotTokens();
  return ok && now ? now.access : '';
}

function spotifyLogout() {
  if (_spotPlayer) { try { _spotPlayer.disconnect(); } catch (e) {} }
  _spotPlayer = null; _spotDeviceId = null; _spotState = null; _spotError = '';
  _spotStoreTokens(null);
  spotifySetSource('ost');
  _spotSync();
  if (typeof toast === 'function') toast('Disconnected from Spotify', { type: 'info', duration: 1800 });
}

/* ── The Web Playback SDK ───────────────────────────────────── */

function _spotLoadSdk() {
  return new Promise((resolve, reject) => {
    if (window.Spotify && window.Spotify.Player) return resolve();
    if (_spotSdkLoading) {
      // Already on its way; the global callback below resolves everyone.
      const t = setInterval(() => {
        if (window.Spotify && window.Spotify.Player) { clearInterval(t); resolve(); }
      }, 120);
      setTimeout(() => { clearInterval(t); reject(new Error('timeout')); }, 12000);
      return;
    }
    _spotSdkLoading = true;
    /* The SDK calls this global when it is ready and there is no other hook,
       so it has to exist before the script does. */
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    const s = document.createElement('script');
    s.src = 'https://sdk.scdn.co/spotify-player.js';
    s.async = true;
    s.onerror = () => { _spotSdkLoading = false; reject(new Error('sdk blocked')); };
    document.head.appendChild(s);
    setTimeout(() => reject(new Error('timeout')), 15000);
  });
}

/** Build the device if it is wanted and not already there. */
async function spotifyEnsurePlayer() {
  if (_spotPlayer || !spotifyConnected()) return;
  try { await _spotLoadSdk(); }
  catch (e) { _spotError = 'Could not load the Spotify player.'; _spotSync(); return; }

  _spotPlayer = new Spotify.Player({
    name: 'StudySession Pro',
    // Called by the SDK whenever it needs a token, including after one expires
    // — which is why the refresh lives behind spotifyToken() rather than being
    // handed over once at construction.
    getOAuthToken: cb => { spotifyToken().then(t => cb(t)); },
    volume: 0.55
  });

  _spotPlayer.addListener('ready', ({ device_id }) => {
    _spotDeviceId = device_id;
    _spotError = '';
    _spotSync();
  });
  _spotPlayer.addListener('not_ready', () => { _spotDeviceId = null; _spotSync(); });

  _spotPlayer.addListener('player_state_changed', st => {
    if (!st) { _spotState = null; _spotSync(); return; }
    /* Spotify has started, so the local track stops. This lives here rather
       than only in the source switch because playback can begin from outside
       this app entirely -- the phone, the desktop client, another tab -- and
       the switch never runs in those cases. Whatever started it, hearing two
       things at once is the bug. */
    if (!st.paused && typeof _ostAudio !== 'undefined' && _ostAudio && !_ostAudio.paused) {
      _ostAudio.pause();
    }
    const tr = st.track_window && st.track_window.current_track;
    _spotState = {
      paused: st.paused,
      position: st.position,
      duration: st.duration,
      shuffle: !!st.shuffle,
      title: tr ? tr.name : '',
      artists: tr && tr.artists ? tr.artists.map(a => a.name).join(', ') : '',
      art: tr && tr.album && tr.album.images && tr.album.images.length
        ? tr.album.images[tr.album.images.length - 1].url : ''
    };
    _spotSync();
  });

  // Reported, not swallowed: 'account_error' is how a free account arrives,
  // and silence would leave that looking like a bug in this file.
  _spotPlayer.addListener('initialization_error', ({ message }) => { _spotError = message; _spotSync(); });
  _spotPlayer.addListener('authentication_error', ({ message }) => {
    _spotError = message || 'Spotify sign-in expired.'; _spotStoreTokens(null); _spotSync();
  });
  _spotPlayer.addListener('account_error', () => {
    _spotError = 'Spotify Premium is required to play here.'; _spotSync();
  });
  _spotPlayer.addListener('playback_error', ({ message }) => { _spotError = message; _spotSync(); });

  try { await _spotPlayer.connect(); } catch (e) { _spotError = 'Could not connect.'; _spotSync(); }
}

/** Small helper for the REST calls the SDK does not cover. */
async function _spotApi(path, method, body) {
  const token = await spotifyToken();
  if (!token) return null;
  try {
    const res = await fetch('https://api.spotify.com/v1/' + path, {
      method: method || 'GET',
      headers: { Authorization: 'Bearer ' + token,
                 ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    if (res.status === 204 || res.status === 202) return {};
    return await res.json().catch(() => ({}));
  } catch (e) { return null; }
}

/* ── Transport ──────────────────────────────────────────────── */

/** Move playback onto this device — nothing plays here until that happens. */
async function spotifyTransferHere(play) {
  if (!_spotDeviceId) return;
  await _spotApi('me/player', 'PUT', { device_ids: [_spotDeviceId], play: !!play });
}

async function spotifyTogglePlay() {
  await spotifyEnsurePlayer();
  if (!_spotPlayer) return;
  // Nothing has been sent here yet, so there is nothing to toggle: claim
  // playback first, which starts whatever the account was last playing.
  if (!_spotState) { await spotifyTransferHere(true); return; }
  try { await _spotPlayer.togglePlay(); } catch (e) { /* the listeners report it */ }
}

async function spotifyNext() { if (_spotPlayer) { try { await _spotPlayer.nextTrack(); } catch (e) {} } }
async function spotifyPrev() { if (_spotPlayer) { try { await _spotPlayer.previousTrack(); } catch (e) {} } }

async function spotifySeek(pct) {
  if (!_spotPlayer || !_spotState || !_spotState.duration) return;
  const ms = Math.max(0, Math.min(100, +pct)) / 100 * _spotState.duration;
  try { await _spotPlayer.seek(Math.round(ms)); } catch (e) {}
}

async function spotifySetVolume(pct) {
  if (!_spotPlayer) return;
  try { await _spotPlayer.setVolume(Math.max(0, Math.min(100, +pct)) / 100); } catch (e) {}
}

/** Shuffle is a REST call; the SDK has no method for it. */
async function spotifyToggleShuffle() {
  const on = !(_spotState && _spotState.shuffle);
  await _spotApi('me/player/shuffle?state=' + (on ? 'true' : 'false')
    + (_spotDeviceId ? '&device_id=' + _spotDeviceId : ''), 'PUT');
  if (_spotState) _spotState.shuffle = on;
  _spotSync();
  if (typeof toast === 'function') {
    toast(on ? 'Shuffling on Spotify' : 'Shuffle off', { type: 'info', duration: 1500 });
  }
}

/* ── Search ─────────────────────────────────────────────────── */

let _spotSearchTimer = null;
let _spotSearchSeq = 0;

/** Typing fires per keystroke; the API should not. */
function spotifySearchDebounced(q) {
  clearTimeout(_spotSearchTimer);
  _spotSearchTimer = setTimeout(() => spotifySearch(q), 320);
}

async function spotifySearch(q) {
  const box = document.getElementById('spot-results');
  if (!box) return;
  const query = (q || '').trim();
  if (!query) { box.innerHTML = ''; return; }

  /* Results can come back out of order -- a short query answered after a
     longer one would leave the wrong list on screen. Each search claims a
     number and only the newest is allowed to paint. */
  const seq = ++_spotSearchSeq;
  box.innerHTML = '<div class="spot-note">Searching…</div>';

  const j = await _spotApi('search?q=' + encodeURIComponent(query) + '&type=track&limit=8');
  if (seq !== _spotSearchSeq) return;

  const items = (j && j.tracks && j.tracks.items) ? j.tracks.items : [];
  if (!items.length) { box.innerHTML = '<div class="spot-note">No matches.</div>'; return; }

  const esc = typeof escapeHTML === 'function' ? escapeHTML : (s => String(s));
  box.innerHTML = items.map(t => {
    const art = (t.album && t.album.images && t.album.images.length)
      ? t.album.images[t.album.images.length - 1].url : '';
    const who = (t.artists || []).map(a => a.name).join(', ');
    return `
      <button type="button" class="spot-result" onclick="spotifyPlayUri('${esc(t.uri)}')"
              title="${esc(t.name)} — ${esc(who)}">
        <span class="spot-result-art"${art ? ` style="background-image:url('${esc(art)}')"` : ''}></span>
        <span class="spot-result-text">
          <span class="spot-result-name">${esc(t.name)}</span>
          <span class="spot-result-artist">${esc(who)}</span>
        </span>
      </button>`;
  }).join('');
}

/** Play one track on this device. */
async function spotifyPlayUri(uri) {
  await spotifyEnsurePlayer();
  if (!_spotDeviceId) {
    _spotError = 'The player is still starting — try again in a moment.';
    _spotSync();
    return;
  }
  // device_id is required: without it Spotify plays on whatever device it
  // considers active, which is usually not this browser tab.
  const r = await _spotApi('me/player/play?device_id=' + _spotDeviceId, 'PUT', { uris: [uri] });
  if (r && r.error) { _spotError = r.error.message || 'Could not start that track.'; _spotSync(); }
}

/* ── Which source the player is showing ─────────────────────── */

const SPOT_SOURCE_KEY = 'ssp.player.source';    // 'ost' | 'spotify'

function ostSource() {
  try { return localStorage.getItem(SPOT_SOURCE_KEY) === 'spotify' ? 'spotify' : 'ost'; }
  catch (e) { return 'ost'; }
}
function ostSourceIsSpotify() { return ostSource() === 'spotify'; }

function spotifySetSource(which) {
  try { localStorage.setItem(SPOT_SOURCE_KEY, which === 'spotify' ? 'spotify' : 'ost'); }
  catch (e) { /* private mode */ }
}

/** The switch in the popup header. */
async function ostSwitchSource() {
  if (ostSourceIsSpotify()) {
    spotifySetSource('ost');
    if (_spotPlayer) { try { await _spotPlayer.pause(); } catch (e) {} }
  } else {
    spotifySetSource('spotify');
    // Stop the local track rather than leaving two things playing at once.
    if (typeof _ostAudio !== 'undefined' && _ostAudio && !_ostAudio.paused) _ostAudio.pause();
    await spotifyEnsurePlayer();
  }
  if (typeof _ostSync === 'function') _ostSync();
  _spotSync();
}

/** Exposed so the popup's input can save the id and immediately sign in. */
function spotifySaveClientId(v) {
  spotifySetClientId(v);
  _spotSync();
}

/* ── Painting the Spotify half of the popup ─────────────────── */

function _spotFmt(ms) {
  if (!isFinite(ms) || ms < 0) return '0:00';
  const s = Math.floor(ms / 1000);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

function _spotSync() {
  const pop = document.querySelector('.ost-control');
  if (!pop) return;
  pop.classList.toggle('is-spotify', ostSourceIsSpotify());

  const panel = document.getElementById('spot-panel');
  if (!panel) return;

  const connected = spotifyConnected();
  const st = _spotState;
  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };

  const stage = panel.querySelector('.spot-stage');
  if (stage) stage.dataset.stage = !spotifyClientId() ? 'id' : (!connected ? 'login' : 'player');

  set('spot-error', _spotError || '');
  const errEl = document.getElementById('spot-error');
  if (errEl) errEl.style.display = _spotError ? '' : 'none';

  set('spot-title', st ? (st.title || '—') : (connected ? 'Nothing playing' : '—'));
  set('spot-artist', st ? (st.artists || '') : '');
  set('spot-cur', st ? _spotFmt(st.position) : '0:00');
  set('spot-dur', st ? _spotFmt(st.duration) : '0:00');

  const art = document.getElementById('spot-art');
  if (art) art.style.backgroundImage = st && st.art ? `url("${st.art}")` : 'none';

  const seek = document.getElementById('spot-seek');
  if (seek && st && st.duration && seek.dataset.dragging !== '1') {
    seek.value = String((st.position / st.duration) * 100);
  }

  const play = document.getElementById('spot-play');
  if (play && typeof _setLucideIcon === 'function') {
    const playing = st && !st.paused;
    _setLucideIcon(play.querySelector('[data-lucide], svg'), playing ? 'pause' : 'play');
    play.title = playing ? 'Pause' : 'Play';
  }
  const sh = document.getElementById('spot-shuffle');
  if (sh) sh.classList.toggle('is-on', !!(st && st.shuffle));

  const idInput = document.getElementById('spot-client-id');
  if (idInput && document.activeElement !== idInput) idInput.value = spotifyClientId();
  set('spot-redirect', spotifyRedirectUri());
}

/** Markup for the Spotify side; ost.js drops this into the popup. */
function spotifyPanelTemplate() {
  return `
    <div class="spot-panel" id="spot-panel">
      <div class="spot-stage" data-stage="id">

        <div class="spot-setup">
          <p class="spot-hint">Paste your Spotify app's <b>Client ID</b>. Add this exact
             redirect URI in the Spotify dashboard first — Spotify rejects
             <code>localhost</code>, so locally you must open this page on
             <code>127.0.0.1</code>:</p>
          <code class="spot-redirect" id="spot-redirect"></code>
          <input type="text" class="spot-input" id="spot-client-id" placeholder="Client ID"
                 spellcheck="false" autocomplete="off"
                 onchange="spotifySaveClientId(this.value)">
          <p class="spot-hint spot-hint-dim">Playback needs Spotify Premium.</p>
        </div>

        <div class="spot-login">
          <button type="button" class="spot-connect" onclick="spotifyLogin()">
            <i data-lucide="log-in" style="width:15px;height:15px;"></i> Connect Spotify
          </button>
          <button type="button" class="spot-link" onclick="spotifySetClientId(''); _spotSync();">
            Use a different Client ID
          </button>
        </div>

        <div class="spot-player">
          <div class="spot-now">
            <div class="spot-art" id="spot-art" aria-hidden="true"></div>
            <div class="spot-now-text">
              <div class="spot-now-title" id="spot-title">—</div>
              <div class="spot-now-artist" id="spot-artist"></div>
            </div>
          </div>
          <div class="ost-seek-row">
            <span class="ost-time" id="spot-cur">0:00</span>
            <input type="range" class="ost-seek" id="spot-seek" min="0" max="100" step="0.1" value="0"
                   aria-label="Track position"
                   onpointerdown="this.dataset.dragging='1'"
                   onpointerup="this.dataset.dragging='0'; spotifySeek(this.value)"
                   onchange="this.dataset.dragging='0'; spotifySeek(this.value)">
            <span class="ost-time" id="spot-dur">0:00</span>
          </div>
          <div class="ost-transport">
            <button type="button" class="ost-btn" onclick="spotifyPrev()" title="Previous">
              <i data-lucide="skip-back" style="width:15px;height:15px;"></i></button>
            <button type="button" class="ost-btn ost-btn-play" id="spot-play" onclick="spotifyTogglePlay()" title="Play">
              <i data-lucide="play" style="width:17px;height:17px;"></i></button>
            <button type="button" class="ost-btn" onclick="spotifyNext()" title="Next">
              <i data-lucide="skip-forward" style="width:15px;height:15px;"></i></button>
            <button type="button" class="ost-btn" id="spot-shuffle" onclick="spotifyToggleShuffle()" title="Shuffle">
              <i data-lucide="shuffle" style="width:15px;height:15px;"></i></button>
            <input type="range" class="ost-vol" min="0" max="100" step="1" value="55"
                   aria-label="Spotify volume" oninput="spotifySetVolume(this.value)">
          </div>
          <div class="spot-search">
            <input type="search" class="spot-input" id="spot-q" placeholder="Search Spotify…"
                   spellcheck="false" autocomplete="off"
                   oninput="spotifySearchDebounced(this.value)">
            <div class="spot-results" id="spot-results"></div>
          </div>
          <button type="button" class="spot-link" onclick="spotifyLogout()">Disconnect</button>
        </div>

      </div>
      <div class="spot-error" id="spot-error" role="status" style="display:none;"></div>
    </div>`;
}

/* Position only ticks through player_state_changed, which fires on transport
   changes rather than continuously, so the clock needs its own beat. Only
   while the popup is open and something is actually playing. */
setInterval(() => {
  if (!ostSourceIsSpotify() || !_spotState || _spotState.paused) return;
  if (!document.querySelector('.ost-control.is-open')) return;
  _spotState.position = Math.min(_spotState.duration, _spotState.position + 1000);
  _spotSync();
}, 1000);

/* Finish a sign-in redirect, and rebuild the device on a normal reload so the
   player is there before the popup is opened. */
document.addEventListener('DOMContentLoaded', () => {
  spotifyHandleRedirect().then(() => {
    if (spotifyConnected() && ostSourceIsSpotify()) spotifyEnsurePlayer();
    _spotSync();
  });
});
