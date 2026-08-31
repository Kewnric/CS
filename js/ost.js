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

const OST_TRACKS = [
  { file: 'MiSide OST — Cappie Life (In-Game Version).mp3', title: 'MiSide — Cappie Life' },
  { file: 'MiSide OST_ AmbientDay First.mp3',               title: 'MiSide — AmbientDay First' },
  { file: 'MiSide OST_ Plane Picture.mp3',                  title: 'MiSide — Plane Picture' },
  { file: 'MiSide_OST_MainMenu.mp3',                        title: 'MiSide — Main Menu' },
  { file: 'Your Lie in April OST - Again (Piano).mp3',      title: 'Your Lie in April — Again (Piano)' }
];

const OST_KEY_TRACK = 'ssp.ost.track';
const OST_KEY_VOL = 'ssp.ost.vol';
const OST_KEY_POS = 'ssp.ost.pos';
const OST_KEY_MODE = 'ssp.ost.mode';     // 'all' | 'one' | 'shuffle'

let _ostAudio = null;
let _ostIndex = 0;
let _ostMode = 'all';

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
    // Where you left off, but NOT playing: a page that starts making noise on
    // its own is a page people close. The browser would refuse anyway.
    const pos = _ostReadInt(OST_KEY_POS, 0);
    if (pos > 0) a.addEventListener('loadedmetadata', function once() {
      a.removeEventListener('loadedmetadata', once);
      if (pos < a.duration - 1) { try { a.currentTime = pos; } catch (e) {} }
      _ostSync();
    });
  }

  a.addEventListener('play', _ostSync);
  a.addEventListener('pause', () => { _ostRemember(); _ostSync(); });
  a.addEventListener('ended', ostNext);
  a.addEventListener('timeupdate', _ostTick);
  a.addEventListener('loadedmetadata', _ostSync);
  a.addEventListener('error', _ostSync);
  return a;
}

/** Encoded per segment: these filenames carry spaces, em dashes and brackets. */
function _ostSrc(i) {
  const t = OST_TRACKS[i];
  return t ? OST_DIR + encodeURIComponent(t.file) : '';
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
  if (!isFinite(a.duration)) return;
  a.currentTime = (Math.max(0, Math.min(100, +value)) / 100) * a.duration;
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
  const seek = document.getElementById('ost-seek');
  if (!a || !seek) return;
  if (seek.dataset.dragging === '1') return;    // don't fight the thumb
  const pct = isFinite(a.duration) && a.duration > 0 ? (a.currentTime / a.duration) * 100 : 0;
  seek.value = String(pct);
  const cur = document.getElementById('ost-cur');
  if (cur) cur.textContent = _ostFmt(a.currentTime);
  const dur = document.getElementById('ost-dur');
  if (dur) dur.textContent = _ostFmt(a.duration);
  // Cheap enough to do here, and it means a reload never loses more than a
  // second of where you were.
  if (Math.floor(a.currentTime) % 5 === 0) _ostRemember();
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

  document.querySelectorAll('.ost-item').forEach(el => {
    el.classList.toggle('is-current', +el.dataset.i === _ostIndex);
  });
  _ostTick();
}

/** Called after the topbar is (re)built, to fill the new button in. */
function ostMount() {
  if (!document.querySelector('.ost-control')) return;
  _ostEl();
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
