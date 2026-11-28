/* ============================================================
   THEMES — one window to pick a theme, and which theme each part follows
   ============================================================
   Opened from Settings > Appearance > Themes and from the login page.
   A theme sets every part at once; each part can instead follow a theme of
   its own (or be off). Everything a part shows is copied from Ultima:
     colours   css/global.css [data-theme] blocks (Ultima palettes)
     fonts     css/type-systems/*.css   (Ultima/kit/type-systems, verbatim)
     cursor    js/anime-cursor.js       (Ultima/kit/anime-cursor.js, verbatim)
     login     js/ultima-login.js       (Ultima welcome windows & login transitions, verbatim)
   Stored in `ssp.themes` (synced): { v: 1, theme, parts: { colors, fonts, cursor, login, welcome } },
   each part 'follow' (the theme's choice), '' (off) or an id. The colours still
   live in `theme` as before, so the practice page, Theme Editor and cloud copy
   read them as they always did. `ssp.typeSystem` is the resolved font sheet,
   read by index.html's head script so the fonts are there before first paint. */

const THM_KEY = 'ssp.themes';

const THM_THEMES = [
  { id: 'dark', name: 'Default', sub: 'Night blue and indigo', sw: ['#0b1120', '#6366f1', '#e2e8f0'],
    fonts: '', cursor: '', login: '', welcome: '' },
  { id: 'light', name: 'Light', sub: 'Paper white and indigo', sw: ['#f8fafc', '#6366f1', '#0f172a'],
    fonts: '', cursor: '', login: '', welcome: '' },
  { id: 'purple', name: 'Purple', sub: 'Deep violet', sw: ['#1e1b4b', '#a855f7', '#e0e7ff'],
    fonts: '', cursor: '', login: '', welcome: '' },
  { id: 'green', name: 'Green-Default', sub: 'Emerald', sw: ['#064e3b', '#10b981', '#ecfdf5'],
    fonts: '', cursor: '', login: '', welcome: '' },
  { id: 'sao', name: 'Sword Art Online', sub: 'White system panels, orange accents', sw: ['#0c1328', '#f5a623', '#f4f6f8'],
    fonts: 'sao-01-full-dive', cursor: 'skyblade', login: 'sao:0', welcome: 'sao:0' },
  { id: 'solo', name: 'Solo Leveling', sub: 'Glowing blue System windows', sw: ['#03060d', '#4cc9ff', '#e8f6ff'],
    fonts: 'solo-06-system-window', cursor: 'gatebreaker', login: 'sl:0', welcome: 'sl:0' },
  { id: 'genshin', name: 'Genshin Impact', sub: 'Crystal Realm gold on night blue', sw: ['#080b26', '#d9ae4e', '#eef1fb'],
    fonts: 'genshin-16-mondstadt', cursor: 'elementa', login: '', welcome: '' },
  { id: 'ff7', name: 'Final Fantasy VII', sub: 'Navy glass, cyan and energy green', sw: ['#03070d', '#7fd6ff', '#46ffbe'],
    fonts: 'ff7-12-mako-reactor', cursor: 'reactor', login: 'ff:0', welcome: 'ff:0' },
];

/* The 20 Ultima type systems, by franchise. */
const THM_FONTS = [
  ['Sword Art Online', [['sao-01-full-dive', 'Full Dive'], ['sao-02-floating-castle', 'Floating Castle'],
    ['sao-03-fairy-flight', 'Fairy Flight'], ['sao-04-gun-gale', 'Gun Gale'], ['sao-05-underworld-chronicle', 'Underworld Chronicle']]],
  ['Solo Leveling', [['solo-06-system-window', 'System Window'], ['solo-07-gate-rank', 'Gate Rank'],
    ['solo-08-shadow-monarch', 'Shadow Monarch'], ['solo-09-hunter-association', 'Hunter Association'], ['solo-10-manhwa-panel', 'Manhwa Panel']]],
  ['Genshin Impact', [['genshin-16-mondstadt', 'Mondstadt'], ['genshin-17-liyue', 'Liyue'], ['genshin-18-inazuma', 'Inazuma'],
    ['genshin-19-sumeru', 'Sumeru'], ['genshin-20-fontaine', 'Fontaine']]],
  ['Final Fantasy VII', [['ff7-11-corporate-tower', 'Corporate Tower'], ['ff7-12-mako-reactor', 'Mako Reactor'],
    ['ff7-13-slum-chalkboard', 'Slum Chalkboard'], ['ff7-14-wall-market-neon', 'Wall Market Neon'], ['ff7-15-wutai-shinobi', 'Wutai Shinobi']]],
];

/* The four Ultima cursors (kit/anime-cursor.js). */
const THM_CURSORS = [['skyblade', 'Skyblade (Sword Art Online)'], ['gatebreaker', 'Gatebreaker (Solo Leveling)'],
  ['elementa', 'Elementa (Genshin Impact)'], ['reactor', 'Reactor (Final Fantasy VII)']];

/* Ultima's login transitions and welcome windows, by engine theme key (G.themes[].key). */
const THM_ULT = [
  ['sao', 'Sword Art Online',
    ['Dive Tunnel', 'Polygon Shatter', 'Iris Open', 'Sense Calibration', 'Menu Cascade'],
    ['System Panel', 'Floating Type', 'Menu Drop', 'HUD Link', 'Alert Dialog', 'Polygon Assemble', 'Light Scan',
      'Notification Stack', 'Holo Player Card', 'Sync Terminal']],
  ['sl', 'Solo Leveling',
    ['Gate Warp', 'System Override', 'Shadow Engulf', 'Ascension Pillar', 'Gate Lock'],
    ['System Notification', 'System Whisper', 'Log-in Reward', 'Status Window', 'Level Up', 'Glitch Override',
      'Corner Brackets', 'Shadow Rise', 'Rank Appraisal', 'Alert → Verified']],
  ['ff', 'Final Fantasy VII',
    ['Energy Surge', 'Cross Slash', 'Rail Transit', 'Depth Focus', 'Hex Dissolve'],
    ['Command Panel', 'Cinematic Title', 'Menu Select', 'Energy Stream', 'Chapter Card', 'Limit Slash', 'Glass & Orbs',
      'Party HUD', 'Banner Ribbon', 'Geometric Emblem']],
];

const THM_PARTS = [
  { id: 'colors', label: 'Colors', desc: 'Backgrounds, panels, text and accents' },
  { id: 'fonts', label: 'Fonts', desc: 'Ultima type systems for text and headings' },
  { id: 'cursor', label: 'Cursor', desc: 'Animated cursor with trails and click bursts' },
  { id: 'login', label: 'Login transition', desc: 'Plays when you enter from the login page' },
  { id: 'welcome', label: 'Welcome window', desc: 'Shown after you enter from the login page' },
];

function _thmEsc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function thmById(id) { return THM_THEMES.find(t => t.id === id) || THM_THEMES[0]; }

function thmLoad() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(THM_KEY)); } catch (e) { /* first visit */ }
  if (!s || typeof s !== 'object') s = {};
  if (!s.theme) s.theme = (function () { try { return localStorage.getItem('theme'); } catch (e) { return null; } })() || 'dark';
  if (!THM_THEMES.some(t => t.id === s.theme)) s.theme = 'dark';
  s.parts = Object.assign({ colors: 'follow', fonts: 'follow', cursor: 'follow', login: 'follow', welcome: 'follow' }, s.parts || {});
  s.v = 1;
  return s;
}

function thmSave(s) {
  try { localStorage.setItem(THM_KEY, JSON.stringify(s)); } catch (e) { /* full */ }
}

/** What a part shows now: the part's own choice, or the theme's. */
function thmResolve(part, s) {
  s = s || thmLoad();
  const v = s.parts[part];
  if (v != null && v !== 'follow') return v;
  const t = thmById(s.theme);
  return part === 'colors' ? t.id : (t[part] || '');
}

/* ---------- Colors ---------- */
function _thmSetColors(id) {
  const root = document.documentElement;
  if (root.getAttribute('data-theme') === id) return;
  const flip = () => {
    if (typeof themeEditSetTheme === 'function') themeEditSetTheme(id);
    else {
      root.setAttribute('data-theme', id);
      try { localStorage.setItem('theme', id); } catch (e) { /* private mode */ }
      if (typeof updateThemeIcon === 'function') updateThemeIcon(id);
      if (typeof scheduleCloudSave === 'function') scheduleCloudSave();
    }
    root.classList.remove('theme-transitioning');
  };
  // The same circle reveal the theme row has always used (js/mx-pages.js wrapTheme).
  const M = window.Motion;
  if ((M && M.prefersReducedMotion && M.prefersReducedMotion()) || typeof document.startViewTransition !== 'function') return flip();
  const o = (M && M.origin) || {};
  const fresh = performance.now() - (o.t || 0) < 1500;
  root.style.setProperty('--mx-ox', (fresh ? o.x : window.innerWidth / 2) + 'px');
  root.style.setProperty('--mx-oy', (fresh ? o.y : window.innerHeight / 2) + 'px');
  root.classList.add('mx-theme-vt');
  const done = () => { root.classList.remove('mx-theme-vt'); root.style.removeProperty('--mx-ox'); root.style.removeProperty('--mx-oy'); };
  try {
    const vt = document.startViewTransition(flip);
    vt.finished.then(done, done);
    if (vt.ready && vt.ready.catch) vt.ready.catch(() => {});
  } catch (e) { done(); flip(); }
}

/* ---------- Fonts ---------- */
function _thmSetFonts(id) {
  const root = document.documentElement;
  const ok = /^[a-z0-9-]+$/.test(id || '');
  let link = document.getElementById('thm-type-link');
  if (!ok) {
    if (link) link.remove();
    root.classList.remove('ssp-type');
    try { localStorage.removeItem('ssp.typeSystem'); } catch (e) { /* private mode */ }
    return;
  }
  const href = 'css/type-systems/' + id + '.css';
  if (!link) {
    link = document.createElement('link');
    link.rel = 'stylesheet';
    link.id = 'thm-type-link';
    document.head.appendChild(link);
  }
  if (link.getAttribute('href') !== href) link.setAttribute('href', href);
  root.classList.add('ssp-type');
  try { localStorage.setItem('ssp.typeSystem', id); } catch (e) { /* private mode */ }
}

/* ---------- Scripts loaded on demand ---------- */
const _thmLoading = {};
function _thmScript(src) {
  if (_thmLoading[src]) return _thmLoading[src];
  _thmLoading[src] = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = res;
    s.onerror = () => { delete _thmLoading[src]; rej(new Error('Could not load ' + src)); };
    document.head.appendChild(s);
  });
  return _thmLoading[src];
}

/* ---------- Cursor ---------- */
function _thmSetCursor(id) {
  if (!id) {
    if (window.AnimeCursor && AnimeCursor.current) AnimeCursor.current.destroy();
    return;
  }
  _thmScript('js/anime-cursor.js').then(() => {
    if (thmResolve('cursor') !== id) return;
    const cur = AnimeCursor.current;
    if (cur && cur.setTheme) cur.setTheme(id);
    else AnimeCursor.init({ theme: id, size: 1, density: 1, respectReducedMotion: true });
  }).catch(() => { /* offline before first load */ });
}

/* ---------- Login transition and welcome window (Ultima engine) ---------- */
function _thmUltimaLoad() {
  if (!document.getElementById('thm-ult-fonts')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.id = 'thm-ult-fonts';
    l.href = 'https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500;600;700&family=Cinzel:wght@400;500;600&family=Exo+2:wght@200;300;400;500;600;700&family=Inter:wght@400;500;600;700&family=Jost:wght@200;300;400;500;600&family=Oxanium:wght@400;600;700;800&display=swap';
    document.head.appendChild(l);
  }
  return _thmScript('js/ultima-login.js');
}

function _thmUltPick(v, list) {
  const m = /^([a-z]+):(\d+)$/.exec(v || '');
  if (!m || !window.G || !G.themes) return null;
  const th = G.themes.find(t => t.key === m[1]);
  const item = th && th[list] && th[list][+m[2]];
  return item ? { th, item } : null;
}

function _thmUserName() {
  try {
    const u = typeof fbAuth !== 'undefined' && fbAuth && fbAuth.currentUser;
    if (u && u.displayName) return u.displayName;
  } catch (e) { /* no auth */ }
  return 'Guest';
}

let _thmIntroOn = false;
/** Plays the chosen login transition, then the welcome window, over the screen.
    Click, Esc or Skip ends it. */
async function thmPlayIntro(only) {
  if (_thmIntroOn) return;
  const lg = only === 'welcome' ? '' : thmResolve('login');
  const wl = only === 'login' ? '' : thmResolve('welcome');
  if (!lg && !wl) return;
  if (!only && document.documentElement.getAttribute('data-motion') === 'off') return;
  _thmIntroOn = true;
  try { await _thmUltimaLoad(); } catch (e) { _thmIntroOn = false; return; }
  G.name = _thmUserName();
  const ov = document.createElement('div');
  ov.className = 'thm-intro';
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-label', 'Welcome');
  ov.innerHTML = '<div class="thm-intro-box"></div><button type="button" class="thm-intro-skip">Skip</button>';
  document.body.appendChild(ov);
  const st = G.makeStage();
  ov.firstChild.appendChild(st.el);
  let next = null;
  const advance = () => { if (next) { const f = next; next = null; f(); } };
  let skipped = false;
  const skipAll = () => { skipped = true; advance(); };
  ov.querySelector('.thm-intro-skip').addEventListener('click', e => { e.stopPropagation(); skipAll(); });
  ov.addEventListener('click', advance);
  const onKey = e => { if (e.key === 'Escape') skipAll(); else if (e.key === 'Enter' || e.key === ' ') advance(); };
  document.addEventListener('keydown', onKey, true);
  const step = (ms) => new Promise(res => { next = res; if (ms) setTimeout(() => { if (next === res) advance(); }, ms); });

  const t = _thmUltPick(lg, 'transitions');
  if (t) {
    const p = step(30000);
    G.mountTransition(st, t.th, t.item, { autoplay: true, onDone: advance });
    await p;
  }
  const w = !skipped && _thmUltPick(wl, 'welcomes');
  if (w) {
    const p = step(9000);
    G.mountWelcome(st, w.th, w.item);
    await p;
  }
  document.removeEventListener('keydown', onKey, true);
  G.clear(st);
  ov.classList.add('is-out');
  setTimeout(() => ov.remove(), 450);
  _thmIntroOn = false;
}

/** Applies fonts and cursor (and, when asked, colours) from the saved choices. */
function thmApply(withColors) {
  const s = thmLoad();
  if (withColors) _thmSetColors(thmResolve('colors', s));
  _thmSetFonts(thmResolve('fonts', s));
  _thmSetCursor(thmResolve('cursor', s));
}

/* ---------- The window ---------- */
function _thmOptions(part, cur) {
  const o = (v, label) => '<option value="' + _thmEsc(v) + '"' + (v === cur ? ' selected' : '') + '>' + _thmEsc(label) + '</option>';
  const g = (label, inner) => '<optgroup label="' + _thmEsc(label) + '">' + inner + '</optgroup>';
  let h = o('follow', 'Follow theme');
  if (part === 'colors') {
    h += THM_THEMES.map(t => o(t.id, t.name)).join('');
  } else if (part === 'fonts') {
    h += o('', 'App default (Inter)');
    h += THM_FONTS.map(([name, list]) => g(name, list.map(([id, n]) => o(id, n)).join(''))).join('');
  } else if (part === 'cursor') {
    h += o('', 'System cursor');
    h += THM_CURSORS.map(([id, n]) => o(id, n)).join('');
  } else {
    h += o('', 'None');
    const idx = part === 'login' ? 2 : 3;
    h += THM_ULT.map(u => g(u[1], u[idx].map((n, i) => o(u[0] + ':' + i, n)).join(''))).join('');
  }
  return h;
}

function _thmFollowName(part, s) {
  const v = thmResolve(part, s);
  if (part === 'colors') return thmById(v).name;
  if (!v) return part === 'fonts' ? 'App default' : (part === 'cursor' ? 'System cursor' : 'None');
  if (part === 'fonts') { for (const [, list] of THM_FONTS) for (const [id, n] of list) if (id === v) return n; }
  if (part === 'cursor') { const c = THM_CURSORS.find(x => x[0] === v); return c ? c[1] : v; }
  const m = /^([a-z]+):(\d+)$/.exec(v);
  const u = m && THM_ULT.find(x => x[0] === m[1]);
  return u ? u[part === 'login' ? 2 : 3][+m[2]] : v;
}

function _thmPaint(win) {
  const s = thmLoad();
  win.querySelector('.thm-grid').innerHTML = THM_THEMES.map(t =>
    '<button type="button" class="thm-card" data-thm="' + t.id + '" aria-pressed="' + (t.id === s.theme) + '">' +
      '<span class="thm-sw">' + t.sw.map(c => '<i style="background:' + c + '"></i>').join('') + '</span>' +
      '<b>' + _thmEsc(t.name) + '</b><small>' + _thmEsc(t.sub) + '</small>' +
    '</button>').join('');
  win.querySelector('.thm-parts').innerHTML = THM_PARTS.map(p => {
    const cur = s.parts[p.id];
    const canPlay = p.id === 'login' || p.id === 'welcome';
    return '<div class="thm-row">' +
      '<span class="thm-row-info"><span class="thm-row-label">' + _thmEsc(p.label) + '</span>' +
      '<span class="thm-row-desc">' + _thmEsc(p.desc) + (cur === 'follow' ? ' · now ' + _thmEsc(_thmFollowName(p.id, s)) : '') + '</span></span>' +
      '<select class="thm-select" data-part="' + p.id + '" aria-label="' + _thmEsc(p.label) + '">' + _thmOptions(p.id, cur) + '</select>' +
      (canPlay ? '<button type="button" class="thm-play" data-play="' + p.id + '" title="Preview"' + (thmResolve(p.id, s) ? '' : ' disabled') + '>' +
        '<i data-lucide="play" aria-hidden="true"></i></button>' : '') +
    '</div>';
  }).join('');
  if (window.lucide) lucide.createIcons({ root: win });
}

function _thmChanged(s, colorsToo) {
  thmSave(s);
  if (colorsToo) _thmSetColors(thmResolve('colors', s));
  _thmSetFonts(thmResolve('fonts', s));
  _thmSetCursor(thmResolve('cursor', s));
}

function openThemes() {
  let ov = document.getElementById('thm-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'thm-overlay';
    ov.className = 'thm-overlay hidden';
    ov.innerHTML =
      '<div class="thm-win" role="dialog" aria-modal="true" aria-labelledby="thm-title">' +
        '<div class="thm-head"><i data-lucide="palette" aria-hidden="true"></i><h2 id="thm-title">Themes</h2>' +
          '<button type="button" class="thm-close" aria-label="Close"><i data-lucide="x" aria-hidden="true"></i></button></div>' +
        '<div class="thm-body">' +
          '<div class="thm-sec">Theme</div><div class="thm-grid"></div>' +
          '<div class="thm-sec">Each part</div><div class="thm-parts"></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', e => {
      if (e.target === ov || e.target.closest('.thm-close')) return closeThemes();
      const card = e.target.closest('.thm-card');
      if (card) {
        const s = thmLoad();
        s.theme = card.dataset.thm;
        _thmChanged(s, true);
        _thmPaint(ov);
        return;
      }
      const play = e.target.closest('.thm-play');
      if (play) thmPlayIntro(play.dataset.play);
    });
    ov.addEventListener('change', e => {
      const sel = e.target.closest('.thm-select');
      if (!sel) return;
      const s = thmLoad();
      s.parts[sel.dataset.part] = sel.value;
      _thmChanged(s, sel.dataset.part === 'colors');
      _thmPaint(ov);
    });
    ov.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); closeThemes(); } });
  }
  _thmPaint(ov);
  ov.classList.remove('hidden');
  const f = ov.querySelector('.thm-card[aria-pressed="true"]');
  if (f) f.focus();
}

function closeThemes() {
  const ov = document.getElementById('thm-overlay');
  if (ov) ov.classList.add('hidden');
}

/* Boot: fonts and cursor from the saved choices (the colours are already on
   from the head script), and the intro once the login page is left. */
(function thmBoot() {
  const go = () => {
    thmApply(false);
    const lp = document.getElementById('storage-mode-popup');
    if (!lp) return;
    // Have the engine ready by the time they press Sign in.
    const preload = () => { if (thmResolve('login') || thmResolve('welcome')) _thmUltimaLoad().catch(() => {}); };
    let shown = !lp.classList.contains('hidden');
    if (shown) preload();
    const obs = new MutationObserver(() => {
      const open = !lp.classList.contains('hidden');
      if (open && !shown) {
        shown = true;
        preload();
      } else if (!open && shown) {
        obs.disconnect();
        closeThemes();
        thmPlayIntro();
      }
    });
    obs.observe(lp, { attributes: true, attributeFilter: ['class'] });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
  else go();
})();
