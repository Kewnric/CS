/* ============================================================
   COVER-SCENES.JS — animated covers for programs without a picture
   ------------------------------------------------------------
   A program with no cover used to get a hashed two-colour gradient and a file
   icon. Now it gets one of twelve small scenes (css/cover-scenes.css): aurora,
   sunset sea, city at night, deep space, neon rain, firefly forest, dunes,
   code rain, snowy peaks, lighthouse, cherry blossom, autumn grove.

   Everything about a card comes from a hash of the program's id, so every
   card differs from its neighbours and stays the same card after a render:
   which scene, its tint, where its loops start, and its particles -- the
   leaves, petals, flakes, fireflies, glyphs, ripples and birds are placed,
   sized, timed and sent on their way by a generator seeded from that hash.

   COST. Everything that moves is a plain element moved by transform or
   opacity -- no animated SVG, filter, background or size, which would repaint
   every frame. And nothing moves off screen: a scene runs only while its
   cover is in view (one IntersectionObserver sets .cvs-run), and never under
   Motion: Calm / Off or the system's reduced-motion setting, where it rests
   as a still.
   ============================================================ */

const COVER_SCENES = ['aurora', 'sunset', 'city', 'space', 'rain', 'forest', 'dunes', 'stream',
  'snow', 'lighthouse', 'sakura', 'autumn'];

/* The hand-placed parts of each scene, back to front. cvs-a marks what moves. */
const _CVS_PARTS = {
  aurora:
    '<span class="cvs-stars"></span><span class="cvs-stars cvs-tw cvs-a"></span>' +
    '<span class="cvs-rib cvs-rib1 cvs-a"></span><span class="cvs-rib cvs-rib2 cvs-a"></span>' +
    '<span class="cvs-rays cvs-a"></span><span class="cvs-comet cvs-a"></span>' +
    '<span class="cvs-ridge cvs-ridge-far"></span><span class="cvs-lake cvs-a"></span>' +
    '<span class="cvs-ridge cvs-pinerow"></span>',
  sunset:
    '<span class="cvs-sun cvs-a"></span><span class="cvs-flare cvs-a"></span><span class="cvs-sea"></span>' +
    '<span class="cvs-glint cvs-a"></span><span class="cvs-waves cvs-a"></span>' +
    '<span class="cvs-boat cvs-a"><span class="cvs-sail"></span></span>',
  city:
    '<span class="cvs-stars cvs-tw cvs-a"></span><span class="cvs-moon"></span>' +
    '<span class="cvs-search cvs-search1 cvs-a"></span><span class="cvs-search cvs-search2 cvs-a"></span>' +
    '<span class="cvs-track cvs-a"><span class="cvs-plane"></span></span>' +
    '<span class="cvs-far"></span><span class="cvs-near"></span>' +
    '<span class="cvs-wins"></span><span class="cvs-wins cvs-wins2 cvs-a"></span>' +
    '<span class="cvs-traffic cvs-a"></span>',
  space:
    '<span class="cvs-nebula cvs-a"></span><span class="cvs-field cvs-a"></span>' +
    '<span class="cvs-field cvs-field2 cvs-a"></span><span class="cvs-comet cvs-a"></span>' +
    '<span class="cvs-ring cvs-ring-back cvs-a"></span><span class="cvs-planet cvs-a"></span>' +
    '<span class="cvs-ring cvs-ring-front cvs-a"></span>' +
    '<span class="cvs-orbit"><span class="cvs-orbit-i cvs-a"><span class="cvs-sat"></span></span></span>',
  rain:
    '<span class="cvs-glow cvs-a"></span><span class="cvs-sign cvs-a"></span>' +
    '<span class="cvs-street cvs-a"></span><span class="cvs-drops cvs-a"></span>' +
    '<span class="cvs-drops cvs-drops2 cvs-a"></span>',
  forest:
    '<span class="cvs-moonglow"></span><span class="cvs-rays cvs-a"></span>' +
    '<span class="cvs-pines cvs-pines-far"></span><span class="cvs-fog cvs-a"></span>' +
    '<span class="cvs-pines cvs-pines-near"></span><span class="cvs-ferns cvs-a"></span>',
  dunes:
    '<span class="cvs-lowsun cvs-a"></span><span class="cvs-cloud cvs-a"></span>' +
    '<span class="cvs-dune cvs-dune1"></span><span class="cvs-haze cvs-a"></span>' +
    '<span class="cvs-dune cvs-dune2"></span><span class="cvs-dune cvs-dune3"></span>' +
    '<span class="cvs-cactus"></span>',
  stream:
    '<span class="cvs-grid"></span><span class="cvs-scan cvs-a"></span><span class="cvs-glyph cvs-a"></span>' +
    '<span class="cvs-col cvs-a" style="left:8%;--t:3.4s;--o:-0.4s"></span>' +
    '<span class="cvs-col cvs-a" style="left:21%;--t:4.6s;--o:-2.1s"></span>' +
    '<span class="cvs-col cvs-a" style="left:33%;--t:3.9s;--o:-1.2s"></span>' +
    '<span class="cvs-col cvs-a" style="left:62%;--t:4.2s;--o:-3s"></span>' +
    '<span class="cvs-col cvs-a" style="left:74%;--t:3.1s;--o:-0.9s"></span>' +
    '<span class="cvs-col cvs-a" style="left:88%;--t:4.9s;--o:-2.6s"></span>',
  snow:
    '<span class="cvs-skyglow cvs-a"></span>' +
    '<span class="cvs-ridge cvs-peaks-far"></span><span class="cvs-ridge cvs-peaks"></span>' +
    '<span class="cvs-mist cvs-a"></span><span class="cvs-ridge cvs-pinerow cvs-pinerow-snow"></span>',
  lighthouse:
    '<span class="cvs-stars cvs-tw cvs-a"></span><span class="cvs-beam cvs-a"></span>' +
    '<span class="cvs-sea"></span><span class="cvs-waves cvs-a"></span>' +
    '<span class="cvs-rock"></span><span class="cvs-tower"></span><span class="cvs-lamp cvs-a"></span>',
  sakura:
    '<span class="cvs-dawn cvs-a"></span><span class="cvs-ridge cvs-fuji"></span>' +
    '<span class="cvs-mist cvs-a"></span>' +
    '<span class="cvs-branch cvs-a"><span class="cvs-bloom" style="left:10%;top:12%;--b:38px"></span>' +
    '<span class="cvs-bloom" style="left:34%;top:4%;--b:30px"></span><span class="cvs-bloom" style="left:52%;top:26%;--b:26px"></span>' +
    '<span class="cvs-bloom" style="left:20%;top:44%;--b:24px"></span><span class="cvs-bloom" style="left:70%;top:10%;--b:20px"></span></span>',
  autumn:
    '<span class="cvs-lowsun cvs-a"></span><span class="cvs-rays cvs-a"></span>' +
    '<span class="cvs-canopy cvs-canopy-far"></span><span class="cvs-trunks"></span>' +
    '<span class="cvs-canopy cvs-canopy-near cvs-a"></span><span class="cvs-litter"></span>'
};

/* Each scene's particles: kind, count, and the ranges each one is drawn from.
   x/y start (% of the cover), dx/dy the journey (px), t seconds per trip,
   s size (px), r turns (deg) for what tumbles, h hue (deg) for what is tinted. */
const _CVS_SWARMS = {
  aurora:     [{ k: 'mote', n: 10, x: [0, 100], y: [40, 95], dx: [-12, 12], dy: [-44, -20], t: [6, 11], s: [1, 2] }],
  sunset:     [{ k: 'mote', n: 9, x: [32, 68], y: [64, 94], dx: [-12, 12], dy: [-24, -8], t: [2.6, 5], s: [0.8, 1.6] },
               { k: 'bird', n: 3, x: [-14, -4], y: [10, 34], dx: [360, 430], dy: [-18, 12], t: [16, 26], s: [1, 1.3] }],
  city:       [{ k: 'bokeh', n: 7, x: [0, 100], y: [40, 100], dx: [-14, 14], dy: [-52, -26], t: [7, 12], s: [3, 6], h: [190, 340] }],
  space:      [{ k: 'mote', n: 9, x: [10, 110], y: [0, 100], dx: [-110, -60], dy: [-8, 8], t: [9, 16], s: [0.8, 1.5] }],
  rain:       [{ k: 'ripple', n: 7, x: [4, 92], y: [82, 95], t: [1.3, 2.4], s: [3, 5] },
               { k: 'bokeh', n: 5, x: [0, 100], y: [8, 70], dx: [-8, 8], dy: [-14, 14], t: [6, 10], s: [4, 7], h: [290, 350] }],
  forest:     [{ k: 'leaf', n: 6, x: [-10, 80], y: [-28, 6], dx: [60, 140], dy: [110, 150], t: [7, 12], s: [6, 9], r: [240, 720], h: [72, 112] },
               { k: 'mote', n: 7, x: [5, 95], y: [38, 86], dx: [-16, 16], dy: [-18, 6], t: [3.5, 6.5], s: [1.2, 1.9] }],
  dunes:      [{ k: 'dust', n: 11, x: [-25, 80], y: [52, 96], dx: [100, 190], dy: [-12, 4], t: [2.2, 4.2], s: [2, 4] }],
  stream:     [{ k: 'char', n: 10, x: [4, 94], y: [52, 100], dx: [-4, 4], dy: [-72, -40], t: [3, 6], s: [9, 12] }],
  snow:       [{ k: 'flake', n: 16, x: [-10, 100], y: [-22, 14], dx: [12, 44], dy: [112, 142], t: [5, 10], s: [1.2, 3.2] }],
  lighthouse: [{ k: 'mote', n: 8, x: [14, 40], y: [70, 86], dx: [-10, 18], dy: [-28, -12], t: [1.8, 3.2], s: [1, 1.8] },
               { k: 'bird', n: 2, x: [-14, -4], y: [8, 28], dx: [380, 430], dy: [-10, 10], t: [18, 26], s: [1, 1.2] }],
  sakura:     [{ k: 'petal', n: 11, x: [-15, 85], y: [-26, 40], dx: [70, 170], dy: [80, 132], t: [6, 11], s: [5, 8], r: [180, 600], h: [328, 352] }],
  autumn:     [{ k: 'leaf', n: 10, x: [-10, 90], y: [-28, 26], dx: [40, 150], dy: [90, 140], t: [6, 11], s: [6, 10], r: [240, 900], h: [6, 48] }]
};

const _CVS_GLYPHS = '01{};<>*&=+#';

function _cvsHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* mulberry32: small, fast, and the same numbers for the same seed everywhere. */
function _cvsRand(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function _cvsSwarm(spec, rnd) {
  const pick = (r) => r[0] + (r[1] - r[0]) * rnd();
  let out = '';
  for (let i = 0; i < spec.n; i++) {
    const t = pick(spec.t);
    let style = 'left:' + pick(spec.x).toFixed(1) + '%;top:' + pick(spec.y).toFixed(1) + '%' +
      ';--t:' + t.toFixed(2) + 's;--o:-' + (rnd() * t).toFixed(2) + 's;--s:' + pick(spec.s).toFixed(1) + 'px';
    if (spec.dx) style += ';--dx:' + pick(spec.dx).toFixed(0) + 'px;--dy:' + pick(spec.dy).toFixed(0) + 'px';
    if (spec.r) style += ';--r:' + (pick(spec.r) * (rnd() < 0.5 ? -1 : 1)).toFixed(0) + 'deg';
    if (spec.h) style += ';--ph:' + pick(spec.h).toFixed(0) + 'deg';
    let attr = '', inner = '';
    if (spec.k === 'leaf' || spec.k === 'petal' || spec.k === 'bird') inner = '<span class="cvs-pi cvs-a"></span>';
    if (spec.k === 'char') attr = ' data-g="' + _CVS_GLYPHS[Math.floor(rnd() * _CVS_GLYPHS.length)] + '"';
    out += '<span class="cvs-p cvs-' + spec.k + ' cvs-a" style="' + style + '"' + attr + '>' + inner + '</span>';
  }
  return out;
}

/** The cover for a program without a picture. seed: its id (stable), else its title. */
function coverSceneHTML(seed) {
  const h = _cvsHash(String(seed || '?'));
  const key = COVER_SCENES[h % COVER_SCENES.length];
  const tint = ((h >>> 8) % 41) - 20;           // -20..20 degrees: two of a kind still differ
  const phase = ((h >>> 16) % 900) / 100;       // 0..9 s into every loop, so a grid is not in step
  const rnd = _cvsRand(h ^ 0x9E3779B9);
  const swarm = (_CVS_SWARMS[key] || []).map(s => _cvsSwarm(s, rnd)).join('');
  _cvsQueueScan();
  return '<div class="nb-card-cover lib-cover-scene cvs-' + key + '" aria-hidden="true" style="--cvs-h:' + tint +
    'deg;--cvs-d:-' + phase + 's"><span class="cvs-cam">' + _CVS_PARTS[key] + swarm +
    '</span><span class="cvs-grain"></span></div>';
}

/* ── Run only what is on screen ─────────────────────────────── */

function _cvsStill() {
  const m = document.documentElement.getAttribute('data-motion');
  if (m === 'off' || m === 'calm') return true;
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
}

let _cvsIO = null;
const _cvsSeen = new Set();
let _cvsQueued = false;

function _cvsScan() {
  _cvsQueued = false;
  if (!_cvsIO) {
    if (typeof IntersectionObserver === 'undefined') return;
    _cvsIO = new IntersectionObserver((entries) => {
      const still = _cvsStill();
      entries.forEach(e => e.target.classList.toggle('cvs-run', e.isIntersecting && !still));
    }, { rootMargin: '0px' });
  }
  // Covers gone with a re-render are let go, or the observer would keep them alive.
  _cvsSeen.forEach(el => { if (!el.isConnected) { _cvsIO.unobserve(el); _cvsSeen.delete(el); } });
  document.querySelectorAll('.lib-cover-scene:not([data-cvs])').forEach(el => {
    el.setAttribute('data-cvs', '');
    _cvsSeen.add(el);
    _cvsIO.observe(el);
  });
}

/* Asked for by every cover built: its HTML is on the page by the next frame. */
function _cvsQueueScan() {
  if (_cvsQueued) return;
  _cvsQueued = true;
  requestAnimationFrame(_cvsScan);
}

/* A cached card grid can come back without building its covers again, so a
   change of what the content area shows looks too -- only at the top of an
   added subtree, never inside it. */
(function _cvsWatch() {
  const host = document.getElementById('spa-content');
  if (!host || typeof MutationObserver === 'undefined') return;
  new MutationObserver((records) => {
    for (const r of records) {
      for (const n of r.addedNodes) {
        if (n.nodeType === 1 && (n.classList.contains('lib-cover-scene') || n.getElementsByClassName('lib-cover-scene').length)) {
          _cvsQueueScan();
          return;
        }
      }
    }
  }).observe(host, { childList: true, subtree: true });
})();

/* Switching Motion on or off applies to the covers already on screen. */
new MutationObserver(() => {
  const still = _cvsStill();
  _cvsSeen.forEach(el => { if (still) el.classList.remove('cvs-run'); });
  if (!still && _cvsIO) _cvsSeen.forEach(el => { _cvsIO.unobserve(el); _cvsIO.observe(el); });
}).observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
