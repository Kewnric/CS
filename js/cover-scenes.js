/* ============================================================
   COVER-SCENES.JS — animated covers for programs without a picture
   ------------------------------------------------------------
   A program with no cover used to get a hashed two-colour gradient and a file
   icon. Now it gets one of ten small scenes (css/cover-scenes.css): aurora,
   sunset sea, city at night, deep space, neon rain, fireflies, dunes, code
   rain, snowy peaks, lighthouse. Which one, its tint and where in its loops
   it starts all come from a hash of the program's id, so every card differs
   from its neighbours and stays the same card after every render.

   COST. Everything that moves is a plain element moved by transform or
   opacity -- no animated SVG, filter, background or size, which would repaint
   every frame. And nothing moves off screen: a scene runs only while its
   cover is in view (one IntersectionObserver sets .cvs-run), and never under
   Motion: Calm / Off or the system's reduced-motion setting, where it rests
   as a still.
   ============================================================ */

const COVER_SCENES = ['aurora', 'sunset', 'city', 'space', 'rain', 'forest', 'dunes', 'stream', 'snow', 'lighthouse'];

/* The parts of each scene, back to front. cvs-a marks the ones that move. */
const _CVS_PARTS = {
  aurora:
    '<span class="cvs-stars"></span><span class="cvs-stars cvs-tw cvs-a"></span>' +
    '<span class="cvs-rib cvs-rib1 cvs-a"></span><span class="cvs-rib cvs-rib2 cvs-a"></span>' +
    '<span class="cvs-ridge cvs-ridge-far"></span><span class="cvs-ridge cvs-ridge-near"></span>',
  sunset:
    '<span class="cvs-sun cvs-a"></span><span class="cvs-sea"></span>' +
    '<span class="cvs-glint cvs-a"></span><span class="cvs-waves cvs-a"></span>',
  city:
    '<span class="cvs-stars cvs-tw cvs-a"></span><span class="cvs-moon"></span>' +
    '<span class="cvs-track cvs-a"><span class="cvs-plane"></span></span>' +
    '<span class="cvs-far"></span><span class="cvs-near"></span>' +
    '<span class="cvs-wins"></span><span class="cvs-wins cvs-wins2 cvs-a"></span>',
  space:
    '<span class="cvs-field cvs-a"></span><span class="cvs-comet cvs-a"></span>' +
    '<span class="cvs-ring cvs-ring-back cvs-a"></span><span class="cvs-planet cvs-a"></span>' +
    '<span class="cvs-ring cvs-ring-front cvs-a"></span>',
  rain:
    '<span class="cvs-glow cvs-a"></span><span class="cvs-sign cvs-a"></span>' +
    '<span class="cvs-street cvs-a"></span><span class="cvs-drops cvs-a"></span>',
  forest:
    '<span class="cvs-moonglow"></span><span class="cvs-pines cvs-pines-far"></span>' +
    '<span class="cvs-fog cvs-a"></span><span class="cvs-pines cvs-pines-near"></span>' +
    '<span class="cvs-ff cvs-a" style="left:18%;top:58%;--t:5.2s"></span>' +
    '<span class="cvs-ff cvs-a" style="left:34%;top:36%;--t:6.4s"></span>' +
    '<span class="cvs-ff cvs-a" style="left:52%;top:64%;--t:4.6s"></span>' +
    '<span class="cvs-ff cvs-a" style="left:66%;top:44%;--t:7s"></span>' +
    '<span class="cvs-ff cvs-a" style="left:80%;top:62%;--t:5.8s"></span>' +
    '<span class="cvs-ff cvs-a" style="left:90%;top:32%;--t:6.8s"></span>',
  dunes:
    '<span class="cvs-lowsun cvs-a"></span><span class="cvs-cloud cvs-a"></span>' +
    '<span class="cvs-dune cvs-dune1"></span><span class="cvs-dune cvs-dune2"></span>' +
    '<span class="cvs-dune cvs-dune3"></span><span class="cvs-sand cvs-a"></span>',
  stream:
    '<span class="cvs-grid"></span><span class="cvs-glyph cvs-a"></span>' +
    '<span class="cvs-col cvs-a" style="left:8%;--t:3.4s;--o:-0.4s"></span>' +
    '<span class="cvs-col cvs-a" style="left:21%;--t:4.6s;--o:-2.1s"></span>' +
    '<span class="cvs-col cvs-a" style="left:33%;--t:3.9s;--o:-1.2s"></span>' +
    '<span class="cvs-col cvs-a" style="left:62%;--t:4.2s;--o:-3s"></span>' +
    '<span class="cvs-col cvs-a" style="left:74%;--t:3.1s;--o:-0.9s"></span>' +
    '<span class="cvs-col cvs-a" style="left:88%;--t:4.9s;--o:-2.6s"></span>',
  snow:
    '<span class="cvs-ridge cvs-peaks-far"></span><span class="cvs-ridge cvs-peaks"></span>' +
    '<span class="cvs-flakes cvs-a"></span><span class="cvs-flakes cvs-flakes2 cvs-a"></span>',
  lighthouse:
    '<span class="cvs-stars cvs-tw cvs-a"></span><span class="cvs-beam cvs-a"></span>' +
    '<span class="cvs-sea"></span><span class="cvs-waves cvs-a"></span>' +
    '<span class="cvs-rock"></span><span class="cvs-tower"></span><span class="cvs-lamp cvs-a"></span>'
};

function _cvsHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** The cover for a program without a picture. seed: its id (stable), else its title. */
function coverSceneHTML(seed) {
  const h = _cvsHash(String(seed || '?'));
  const key = COVER_SCENES[h % COVER_SCENES.length];
  const tint = ((h >>> 8) % 41) - 20;           // -20..20 degrees: two of a kind still differ
  const phase = ((h >>> 16) % 900) / 100;       // 0..9 s into every loop, so a grid is not in step
  _cvsQueueScan();
  return '<div class="nb-card-cover lib-cover-scene cvs-' + key + '" aria-hidden="true" style="--cvs-h:' + tint +
    'deg;--cvs-d:-' + phase + 's">' + _CVS_PARTS[key] + '</div>';
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
    }, { rootMargin: '60px' });
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
