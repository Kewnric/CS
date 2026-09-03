/* ============================================================
   OST.JS — the study music player
   ------------------------------------------------------------
   The tracks are the files in audio/ost. They are listed here rather than
   discovered: a static site cannot read a directory, and asking the server for
   a manifest would put the whole player behind a fetch that fails the moment
   the page is opened from disk — which is exactly how the sound effects broke
   once already. A list in a script always arrives.

   ONE AUDIO ELEMENT, ON THE BODY. The button lives in the practice topbar and
   is destroyed with the route; the music must not be. So the element is
   created once outside every route, the module holds the state, and whenever
   the button is rebuilt it is filled in from that state rather than the other
   way round.

   To add a track: drop the file in audio/ost and add a line below. `cover` is
   optional — with no artwork the label is a colour derived from the title, so
   every track still looks like itself on the disc.
   ============================================================ */

const OST_DIR = 'audio/ost/';

/* Filenames are plain ascii, lower case, no spaces. The originals carried
   spaces, brackets and an em dash, which a static host serves only through
   percent-encoding -- a needless way for a URL to go wrong on someone else's
   server. The pretty name lives in `title`, which is the only one anybody
   sees. */
const OST_TRACKS = [
  { file: 'miside-cappie-life.mp3',            title: 'MiSide — Cappie Life' },
  { file: 'miside-ambient-day-first.mp3',      title: 'MiSide — AmbientDay First' },
  { file: 'miside-plane-picture.mp3',          title: 'MiSide — Plane Picture' },
  { file: 'miside-main-menu.mp3',              title: 'MiSide — Main Menu' },
  { file: 'your-lie-in-april-again-piano.mp3', title: 'Your Lie in April — Again (Piano)', end: 54 }
];

const OST_KEY_TRACK = 'ssp.ost.track';
const OST_KEY_VOL = 'ssp.ost.vol';
const OST_KEY_POS = 'ssp.ost.pos';
const OST_KEY_MODE = 'ssp.ost.mode';     // 'all' | 'one' | 'shuffle'
const OST_KEY_AUTO = 'ssp.ost.autoplay';

/** Start on load? On by default. */
function ostAutoplayOn() {
  try { return localStorage.getItem(OST_KEY_AUTO) !== '0'; } catch (e) { return true; }
}

function toggleOstAutoplay() {
  const next = !ostAutoplayOn();
  try { localStorage.setItem(OST_KEY_AUTO, next ? '1' : '0'); } catch (e) { /* private mode */ }
  if (next) _ostTryAutoplay(); else _ostDisarmAutoplay();
  _ostSync();
  if (typeof toast === 'function') {
    toast(next ? 'Music starts with the page' : 'Music waits to be started', { type: 'info', duration: 1800 });
  }
}

let _ostAudio = null;
let _ostIndex = 0;
let _ostMode = 'all';
/* timeupdate fires several times a second, and moving to the next track is not
   instant; without this the cut would be taken more than once. */
let _ostCapping = false;

/* Set when leaving an attempt pauses a track that was playing, and read when
   the next attempt mounts.

   Without it, stopping on the way out had no counterpart on the way back in:
   _ostTryAutoplay() only runs where _ostEl() BUILDS the element, and on the
   second attempt of a page load the element already exists, so the mount
   returned early and the music stayed paused.

   It is deliberately not "autoplay is on, so play": pausing with the player's
   own button clears this, so a track you stopped on purpose stays stopped. */
let _ostResumeOnReturn = false;

/* ── State that outlives the button ──────────────────────── */

function _ostReadInt(key, fallback) {
  try {
    const v = parseInt(localStorage.getItem(key), 10);
    return isNaN(v) ? fallback : v;
  } catch (e) { return fallback; }
}
function _ostWrite(key, value) {
  try { localStorage.setItem(key, String(value)); } catch (e) { /* private mode */ }
}

/** The one element everything else talks to. Created once, kept on the body. */
function _ostEl() {
  if (_ostAudio && document.body.contains(_ostAudio)) return _ostAudio;
  const a = document.createElement('audio');
  a.id = 'ost-audio';
  /* metadata, not auto: the durations are wanted for the progress bar, the
     14MB of audio behind them is not — not before someone asks to hear it. */
  a.preload = 'metadata';
  a.style.display = 'none';
  document.body.appendChild(a);
  _ostAudio = a;

  _ostIndex = Math.max(0, Math.min(_ostReadInt(OST_KEY_TRACK, 0), OST_TRACKS.length - 1));
  const vol = _ostReadInt(OST_KEY_VOL, 55);
  a.volume = Math.max(0, Math.min(1, vol / 100));
  try { _ostMode = localStorage.getItem(OST_KEY_MODE) || 'all'; } catch (e) { _ostMode = 'all'; }

  if (OST_TRACKS.length) {
    a.src = _ostSrc(_ostIndex);
    /* Where you left off, and playing from there if autoplay is on. This used
       to refuse to start on principle -- a page that makes noise on its own is
       a page people close -- but it is asked for now, it is a preference, and
       the seek has to happen BEFORE the play or the track restarts from zero
       every reload. */
    const pos = _ostReadInt(OST_KEY_POS, 0);
    a.addEventListener('loadedmetadata', function once() {
      a.removeEventListener('loadedmetadata', once);
      if (pos > 0 && pos < _ostEnd() - 1) { try { a.currentTime = pos; } catch (e) {} }
      _ostSync();
      _ostTryAutoplay();
    });
    // Metadata may already be there on a warm cache, where the event never fires.
    if (a.readyState >= 1) _ostTryAutoplay();
  }

  a.addEventListener('play', () => {
    // The other half of the rule in spotify.js. Pausing does not raise 'play',
    // so the two cannot chase each other.
    if (typeof _spotPlayer !== 'undefined' && _spotPlayer &&
        typeof _spotState !== 'undefined' && _spotState && !_spotState.paused) {
      try { _spotPlayer.pause(); } catch (e) { /* the listeners report it */ }
    }
    _ostSync();
  });
  a.addEventListener('pause', () => { _ostRemember(); _ostSync(); });
  a.addEventListener('ended', ostNext);
  a.addEventListener('timeupdate', _ostTick);
  a.addEventListener('loadedmetadata', _ostSync);
  a.addEventListener('error', _ostSync);
  return a;
}

/**
 * Where a track finishes, which is not always where the file does.
 *
 * `end` on a track cuts it short: the bar spans that long, seeking works
 * within it, and reaching it moves on exactly as the real end would. Done here
 * rather than by trimming the mp3 so the file stays whole -- the number is one
 * edit away from being changed or dropped, where a re-encode is not.
 */
function _ostEnd() {
  const a = _ostAudio;
  const t = OST_TRACKS[_ostIndex];
  const real = a && isFinite(a.duration) ? a.duration : NaN;
  const cut = t && t.end > 0 ? t.end : NaN;
  if (!isFinite(cut)) return real;
  if (!isFinite(real)) return cut;
  return Math.min(cut, real);      // a cut past the end of the file is just the end
}

/** Encoded even though the names are plain: a file added later may not be. */
function _ostSrc(i) {
  const t = OST_TRACKS[i];
  return t ? OST_DIR + encodeURIComponent(t.file) : '';
}

/* ── Starting on its own ──────────────────────────────────────
   Every browser blocks audio until the page has been interacted with, and no
   amount of asking changes that -- play() returns a promise that simply
   rejects. So this is two-stage: try, and if the try is refused, wait for the
   first click or keypress and go then. On a page you have used before, Chrome
   often allows the first attempt outright and the fallback never runs.

   The fallback disarms itself the moment you touch the player, so pausing
   deliberately and then clicking somewhere else cannot restart the music --
   which is the failure mode that would make this feel broken rather than
   convenient. */
let _ostDisarmAutoplay = () => {};

function _ostTryAutoplay() {
  const a = _ostAudio;
  if (!a || !ostAutoplayOn() || !OST_TRACKS.length) return;
  // Spotify is the chosen source: starting the local track here would put two
  // things on at once the moment the page loads, which is the worst place for
  // it to happen because nobody has touched the player yet.
  if (typeof ostSourceIsSpotify === 'function' && ostSourceIsSpotify()) return;
  const p = a.play();
  if (p && typeof p.catch === 'function') p.catch(() => _ostArmFirstGesture());
}

function _ostArmFirstGesture() {
  _ostDisarmAutoplay();
  const go = () => {
    _ostDisarmAutoplay();
    if (ostAutoplayOn() && _ostAudio && _ostAudio.paused) _ostAudio.play().catch(() => {});
  };
  // Capture, so it still hears the gesture if something else stops it later.
  document.addEventListener('pointerdown', go, true);
  document.addEventListener('keydown', go, true);
  _ostDisarmAutoplay = () => {
    document.removeEventListener('pointerdown', go, true);
    document.removeEventListener('keydown', go, true);
    _ostDisarmAutoplay = () => {};
  };
}

function _ostRemember() {
  const a = _ostAudio;
  if (!a) return;
  _ostWrite(OST_KEY_TRACK, _ostIndex);
  _ostWrite(OST_KEY_POS, Math.floor(a.currentTime || 0));
}

/** A stable colour per track, so the label means something without artwork. */
function _ostHue(i) {
  const t = OST_TRACKS[i];
  if (!t) return 'hsl(240 60% 60%)';
  if (t.hue) return t.hue;
  let h = 0;
  const s = t.title || t.file;
  for (let k = 0; k < s.length; k++) h = (h * 31 + s.charCodeAt(k)) % 360;
  // Kept in the app's half of the wheel — indigo through cyan — so five random
  // hashes cannot produce a hot pink label on a blue topbar.
  return 'hsl(' + (200 + (h % 70)) + ' 58% 58%)';
}

function _ostFmt(sec) {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}

/* ── Controls ─────────────────────────────────────────────── */

function ostIsPlaying() {
  return !!(_ostAudio && !_ostAudio.paused && !_ostAudio.ended);
}

function ostPlayPause() {
  _ostDisarmAutoplay();      // an explicit press settles it; stop waiting
  const a = _ostEl();
  if (!OST_TRACKS.length) return;
  if (a.paused) {
    if (!a.src) a.src = _ostSrc(_ostIndex);
    // A play() that the browser blocks rejects rather than throws, and an
    // unhandled rejection here would be a console error on every blocked tab.
    const p = a.play();
    if (p && p.catch) p.catch(() => _ostSync());
  } else {
    a.pause();
    // Stopped on purpose: do not start it again on the next attempt.
    _ostResumeOnReturn = false;
  }
  _ostSync();
}

function ostPlayTrack(i) {
  if (i < 0 || i >= OST_TRACKS.length) return;
  const a = _ostEl();
  const same = i === _ostIndex && a.src;
  _ostIndex = i;
  if (!same) {
    a.src = _ostSrc(i);
    a.currentTime = 0;
  }
  _ostWrite(OST_KEY_TRACK, i);
  _ostWrite(OST_KEY_POS, 0);
  const p = a.play();
  if (p && p.catch) p.catch(() => _ostSync());
  _ostSync();
}

function ostNext() {
  if (!OST_TRACKS.length) return;
  if (_ostMode === 'one') { const a = _ostEl(); a.currentTime = 0; a.play().catch(() => {}); return; }
  let n;
  if (_ostMode === 'shuffle' && OST_TRACKS.length > 1) {
    // Never the one just heard — a shuffle that repeats a track back to back
    // reads as broken even though it is what random does.
    do { n = Math.floor(Math.random() * OST_TRACKS.length); } while (n === _ostIndex);
  } else {
    n = (_ostIndex + 1) % OST_TRACKS.length;
  }
  ostPlayTrack(n);
}

function ostPrev() {
  if (!OST_TRACKS.length) return;
  const a = _ostEl();
  // Restart first, as every other player does: back means the start of this
  // track unless you are already at it.
  if (a.currentTime > 3) { a.currentTime = 0; return; }
  ostPlayTrack((_ostIndex - 1 + OST_TRACKS.length) % OST_TRACKS.length);
}

function ostSeek(value) {
  const a = _ostEl();
  const end = _ostEnd();
  if (!isFinite(end)) return;
  a.currentTime = (Math.max(0, Math.min(100, +value)) / 100) * end;
  _ostRemember();
}

function ostSetVolume(pct) {
  const a = _ostEl();
  const v = Math.max(0, Math.min(100, +pct));
  a.volume = v / 100;
  _ostWrite(OST_KEY_VOL, Math.round(v));
}

function ostCycleMode() {
  _ostMode = _ostMode === 'all' ? 'one' : (_ostMode === 'one' ? 'shuffle' : 'all');
  _ostWrite(OST_KEY_MODE, _ostMode);
  _ostSync();
  if (typeof toast === 'function') {
    toast(_ostMode === 'all' ? 'Playing through' : (_ostMode === 'one' ? 'Repeating this track' : 'Shuffling'),
      { type: 'info', duration: 1500 });
  }
}

function ostTogglePop() {
  const c = document.querySelector('.ost-control');
  if (!c) return;
  const open = !c.classList.contains('is-open');
  document.querySelectorAll('.js-hold-pop.is-open').forEach(x => x.classList.remove('is-open'));
  c.classList.toggle('is-open', open);
  if (open) { _ostEl(); _ostSync(); }
}

/* ── Painting ─────────────────────────────────────────────── */

/** The bar and the clock, on every timeupdate. Kept apart from _ostSync so the
 *  once-a-second case does not rebuild the track list. */
function _ostTick() {
  const a = _ostAudio;
  if (!a) return;
  const end = _ostEnd();

  /* The cut is taken BEFORE anything to do with the panel, and everything
     below returns early when the panel is shut. A track has to stop where it
     was told to whether or not anybody happens to be looking at the player. */
  if (!_ostCapping && !a.paused && isFinite(end) && a.currentTime >= end - 0.08) {
    _ostCapping = true;
    // Whatever the real end would have done -- so repeat-one and shuffle carry
    // on behaving the same way at a cut as they do at the end of a file.
    ostNext();
    setTimeout(() => { _ostCapping = false; }, 250);
    return;
  }

  // Cheap enough to do here, and it means a reload never loses more than a
  // second of where you were.
  if (Math.floor(a.currentTime) % 5 === 0) _ostRemember();

  const seek = document.getElementById('ost-seek');
  if (!seek || seek.dataset.dragging === '1') return;   // shut, or the thumb is held
  const pct = isFinite(end) && end > 0 ? Math.min(100, (a.currentTime / end) * 100) : 0;
  seek.value = String(pct);
  const cur = document.getElementById('ost-cur');
  if (cur) cur.textContent = _ostFmt(isFinite(end) ? Math.min(a.currentTime, end) : a.currentTime);
  const dur = document.getElementById('ost-dur');
  if (dur) dur.textContent = _ostFmt(end);
}

/** Reflect all of the state into whatever UI currently exists. */
function _ostSync() {
  const control = document.querySelector('.ost-control');
  if (!control) return;
  const a = _ostAudio;
  const playing = ostIsPlaying();
  control.classList.toggle('is-playing', playing);
  control.style.setProperty('--ost-hue', _ostHue(_ostIndex));
  const t = OST_TRACKS[_ostIndex];
  control.style.setProperty('--ost-cover', t && t.cover ? 'url("' + OST_DIR + encodeURIComponent(t.cover) + '")' : 'none');

  const btn = document.getElementById('ost-disc-btn');
  if (btn) {
    const label = OST_TRACKS.length
      ? (playing ? 'Playing: ' + (t ? t.title : '') : 'Music — ' + (t ? t.title : ''))
      : 'No music found';
    btn.title = label;
    btn.setAttribute('aria-label', label);
  }

  const title = document.getElementById('ost-title');
  if (title) title.textContent = t ? t.title : 'Nothing to play';
  const state = document.getElementById('ost-state');
  if (state) {
    state.textContent = !OST_TRACKS.length ? 'No tracks'
      : (a && a.error ? 'Could not load' : (playing ? 'Now playing' : 'Paused'));
  }

  const play = document.getElementById('ost-play');
  if (play && typeof _setLucideIcon === 'function') {
    _setLucideIcon(play.querySelector('[data-lucide], svg'), playing ? 'pause' : 'play');
    play.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    play.title = playing ? 'Pause' : 'Play';
  }

  const mode = document.getElementById('ost-mode');
  if (mode) {
    mode.classList.toggle('is-on', _ostMode !== 'all');
    if (typeof _setLucideIcon === 'function') {
      _setLucideIcon(mode.querySelector('[data-lucide], svg'),
        _ostMode === 'shuffle' ? 'shuffle' : (_ostMode === 'one' ? 'repeat-1' : 'repeat'));
    }
    const ml = _ostMode === 'all' ? 'Playing through' : (_ostMode === 'one' ? 'Repeating this track' : 'Shuffling');
    mode.title = ml; mode.setAttribute('aria-label', ml);
  }

  const vol = document.getElementById('ost-vol');
  if (vol && a) vol.value = String(Math.round(a.volume * 100));

  const auto = document.getElementById('ost-auto');
  if (auto) {
    const on = ostAutoplayOn();
    auto.classList.toggle('is-on', on);
    const al = on ? 'Starts with the page' : 'Waits to be started';
    auto.title = al; auto.setAttribute('aria-label', al);
  }
  /* The label says where the button GOES, not where you are -- a switch
     labelled with the thing you are already looking at reads as a status. */
  const srcLabel = document.getElementById('ost-source-label');
  if (srcLabel && typeof ostSourceIsSpotify === 'function') {
    srcLabel.textContent = ostSourceIsSpotify() ? 'Switch to OST' : 'Switch to Spotify';
  }
  if (typeof _spotSync === 'function') _spotSync();

  document.querySelectorAll('.ost-item').forEach(el => {
    el.classList.toggle('is-current', +el.dataset.i === _ostIndex);
  });
  _ostTick();
}

/** Called after the topbar is (re)built, to fill the new button in. */
/**
 * Stop whatever this player is making noise with, and remember where it got to.
 *
 * The <audio> is appended to <body>, so it outlives any route -- but the only
 * controls for it live in the two attempt topbars. Leaving an attempt therefore
 * left a track playing with nothing on the page able to pause it: measured on
 * the library screen afterwards, still advancing, and no .ost-control in the
 * DOM. Short of reloading there was no way to make it stop.
 *
 * Spotify gets the same treatment. It plays through an in-page device whose
 * only transport is inside this popup, so leaving strands it in exactly the
 * same way.
 *
 * Where the track got to is kept, so autoplay picks it up where it left off on
 * the next attempt rather than starting the album again.
 */
function ostStop() {
  let stopped = false;
  if (_ostAudio) {
    if (!_ostAudio.paused) {
      // Remembered BEFORE the pause, so the next mount can tell "the exit
      // stopped this" from "you stopped this".
      _ostResumeOnReturn = true;
      try { _ostAudio.pause(); stopped = true; } catch (e) { /* nothing to do */ }
    }
    _ostRemember();
  }
  if (typeof _spotPlayer !== 'undefined' && _spotPlayer) {
    try {
      const r = _spotPlayer.pause();
      // pause() is async; an unhandled rejection here would surface as a page
      // error on the way out of a route.
      if (r && typeof r.catch === 'function') r.catch(() => {});
      stopped = true;
    } catch (e) { /* the SDK's listeners report it */ }
  }
  return stopped;
}

/**
 * Send the current track back to 0:00.
 *
 * A fresh attempt gets the music from the top; a resumed one keeps where it
 * was, because resuming is meant to put you back exactly where you left off
 * and the soundtrack is part of that. The track itself is not changed -- only
 * the position within it -- so a fresh run does not also throw away which
 * song you had chosen.
 *
 * The stored position is written as well as the live element being moved,
 * because the <audio> is built lazily by ostMount(), which runs AFTER the
 * attempt's init has worked out whether this is a resume. On the first attempt
 * of a page load there is no element yet, and the stored 0 is what _ostEl()
 * seeks to when it does build one.
 */
function ostRewind() {
  _ostWrite(OST_KEY_POS, 0);
  if (_ostAudio) {
    // Throws if the media is not seekable yet; the stored 0 covers that case.
    try { _ostAudio.currentTime = 0; } catch (e) { /* handled by the stored 0 */ }
  }
}

function ostMount() {
  if (!document.querySelector('.ost-control')) return;
  const a = _ostEl();
  /* Put back what leaving the last attempt took away. _ostEl() only tries
     autoplay on the mount that builds the element, so from the second attempt
     of a page load onwards there was nothing here to start it again. */
  if (_ostResumeOnReturn && a && a.paused && OST_TRACKS.length &&
      !(typeof ostSourceIsSpotify === 'function' && ostSourceIsSpotify())) {
    _ostResumeOnReturn = false;
    if (!a.src) a.src = _ostSrc(_ostIndex);
    // Blocked autoplay rejects rather than throwing; fall back to the same
    // first-gesture arming the initial load uses.
    const pr = a.play();
    if (pr && typeof pr.catch === 'function') pr.catch(() => _ostArmFirstGesture());
  }
  _ostSync();
}

/* ── Markup ───────────────────────────────────────────────── */

function ostButtonTemplate() {
  const rows = OST_TRACKS.length
    ? OST_TRACKS.map((t, i) => `
        <button type="button" class="ost-item" data-i="${i}" onclick="ostPlayTrack(${i})" title="${escapeHTML(t.title)}">
          <span class="ost-item-dot" style="background:${_ostHue(i)};"></span>
          <span class="ost-item-name">${escapeHTML(t.title)}</span>
        </button>`).join('')
    : `<div class="ost-empty">Nothing in audio/ost yet.</div>`;

  return `
    <div class="ost-control">
      <button class="ost-disc-btn" id="ost-disc-btn" onclick="ostTogglePop()"
              title="Music" aria-label="Music" aria-haspopup="dialog">
        <span class="ost-waves" aria-hidden="true"></span>
        <span class="ost-disc" aria-hidden="true"></span>
      </button>
      <div class="ost-pop" role="dialog" aria-label="Music player">
        <div class="ost-source-row">
          <button type="button" class="ost-source-btn" id="ost-source-btn" onclick="ostSwitchSource()">
            <i data-lucide="repeat-2" style="width:14px;height:14px;"></i>
            <span id="ost-source-label">Switch to Spotify</span>
          </button>
          <button type="button" class="ost-btn ost-auto-btn" id="ost-auto" onclick="toggleOstAutoplay()"
                  title="Start with the page" aria-label="Start with the page">
            <i data-lucide="power" style="width:14px;height:14px;"></i>
          </button>
        </div>
        <div class="ost-body">
        <div class="ost-now">
          <div class="ost-now-art" aria-hidden="true"></div>
          <div class="ost-now-text">
            <div class="ost-now-label" id="ost-state">Paused</div>
            <div class="ost-now-title" id="ost-title">—</div>
          </div>
        </div>
        <div class="ost-seek-row">
          <span class="ost-time" id="ost-cur">0:00</span>
          <input type="range" class="ost-seek" id="ost-seek" min="0" max="100" step="0.1" value="0"
                 aria-label="Track position"
                 onpointerdown="this.dataset.dragging='1'"
                 onpointerup="this.dataset.dragging='0'; ostSeek(this.value)"
                 onchange="this.dataset.dragging='0'; ostSeek(this.value)">
          <span class="ost-time" id="ost-dur">0:00</span>
        </div>
        <div class="ost-transport">
          <button type="button" class="ost-btn" onclick="ostPrev()" title="Previous" aria-label="Previous">
            <i data-lucide="skip-back" style="width:15px;height:15px;"></i></button>
          <button type="button" class="ost-btn ost-btn-play" id="ost-play" onclick="ostPlayPause()" title="Play" aria-label="Play">
            <i data-lucide="play" style="width:17px;height:17px;"></i></button>
          <button type="button" class="ost-btn" onclick="ostNext()" title="Next" aria-label="Next">
            <i data-lucide="skip-forward" style="width:15px;height:15px;"></i></button>
          <button type="button" class="ost-btn" id="ost-mode" onclick="ostCycleMode()" title="Playing through" aria-label="Playing through">
            <i data-lucide="repeat" style="width:15px;height:15px;"></i></button>
          <input type="range" class="ost-vol" id="ost-vol" min="0" max="100" step="1" value="55"
                 aria-label="Music volume" oninput="ostSetVolume(this.value)">
        </div>
        <div class="ost-list">${rows}</div>
        </div>
        ${typeof spotifyPanelTemplate === 'function' ? spotifyPanelTemplate() : ''}
      </div>
    </div>`;
}

/* A press anywhere else closes it, and Escape does too — it is a dialog over
   the page, not a panel you have to put away deliberately. */
document.addEventListener('click', function (e) {
  const c = document.querySelector('.ost-control.is-open');
  if (!c) return;
  if (e.target.closest && e.target.closest('.ost-control')) return;
  c.classList.remove('is-open');
}, true);

document.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape') return;
  const c = document.querySelector('.ost-control.is-open');
  if (c) c.classList.remove('is-open');
});

// Whatever position was reached is worth keeping when the tab goes away.
window.addEventListener('pagehide', _ostRemember);
