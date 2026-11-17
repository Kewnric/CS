/* GLASS.JS -- the frosted blur behind windows, and taking it away where it lags.

   A backdrop blur is cheap when the graphics card composites the page. When
   the browser composites on the CPU instead (Chrome with hardware
   acceleration off, or its GPU blocklisted or crashed), every frame in which
   anything moves under a blur re-blurs the whole screen in software: Session
   Setup and Settings opened at ~18 fps instead of 60, and the same scrim is
   behind every .modal-overlay in the app (and ~70 other blurs). Without the
   blur they open at 60 either way.

   A page cannot ask how the browser composites (WebGL still names the card),
   so it is measured: the first blurred full-screen windows to open
   (perf-freeze.js calls glassProbe) are timed for half a second. If most of
   their frames take over 30 ms while the main thread sits idle, the blur is
   what is slow: <html>.no-glass takes every backdrop blur away
   (css/components.css) and this device remembers it (ssp.glass.slow).

   Settings > Blur: Auto (that), Off, On. Picking Auto again measures afresh.
   The class is put on before first paint by the inline script in index.html. */

const GLASS_KEY = 'ssp.glass';            // 'auto' (default) | 'off' | 'on'
const GLASS_SLOW_KEY = 'ssp.glass.slow';  // '1' once Auto found the blur slow here
const GLASS_PROBE_MS = 500;
const GLASS_SLOW_FRAME = 30;              // ms: under ~33 fps
const _glass = { probing: false, probes: 0 };

function glassMode() {
  try {
    const v = localStorage.getItem(GLASS_KEY);
    return v === 'on' || v === 'off' ? v : 'auto';
  } catch (e) { return 'auto'; }
}

function _glassSlow() {
  try { return localStorage.getItem(GLASS_SLOW_KEY) === '1'; } catch (e) { return false; }
}

function glassOn() {
  const m = glassMode();
  return m === 'on' || (m === 'auto' && !_glassSlow());
}

function glassApply() {
  document.documentElement.classList.toggle('no-glass', !glassOn());
}

/** Time the frames of a blurred window opening; turn the blur off if they
 *  are slow for drawing rather than for work on the main thread. */
function glassProbe() {
  if (_glass.probing || _glass.probes >= 3 || glassMode() !== 'auto' || _glassSlow()) return;
  if (document.visibilityState !== 'visible') return;
  // Test browsers draw in software; they are measured only when a test asks.
  try { if (navigator.webdriver && !localStorage.getItem('ssp.glass.test')) return; } catch (e) { return; }
  _glass.probing = true;
  // Work the main thread did: its scripts, and style, layout and paint. A
  // frame held up by a CPU-drawn blur is long too, but all of it is spent
  // before rendering starts, waiting on the compositor (measured: 55 ms
  // frames with no script, ~1 ms of style and layout, nothing blocking).
  let busy = 0;
  const work = e => {
    const scripts = (e.scripts || []).reduce((a, s) => a + s.duration, 0);
    const render = e.styleAndLayoutStart ? e.startTime + e.duration - e.styleAndLayoutStart : 0;
    busy += scripts + render;
  };
  let obs = null;
  try {
    if (PerformanceObserver.supportedEntryTypes && PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')) {
      obs = new PerformanceObserver(list => list.getEntries().forEach(work));
      obs.observe({ type: 'long-animation-frame' });
    }
  } catch (e) { obs = null; }
  const gaps = [];
  let last = 0;
  let t0 = 0;
  const tick = t => {
    if (!t0) t0 = t;
    if (last) gaps.push(t - last);
    last = t;
    if (t - t0 < GLASS_PROBE_MS && document.visibilityState === 'visible') { requestAnimationFrame(tick); return; }
    if (obs) { try { obs.takeRecords().forEach(work); obs.disconnect(); } catch (e) { /* gone */ } }
    _glass.probing = false;
    if (gaps.length < 5 || document.visibilityState !== 'visible') return;
    _glass.probes++;
    const slow = gaps.filter(g => g > GLASS_SLOW_FRAME).length / gaps.length;
    // Slow frames from script or layout are not the blur's doing.
    if (slow < 0.6 || busy > (t - t0) * 0.4) return;
    try { localStorage.setItem(GLASS_SLOW_KEY, '1'); } catch (e) { /* private mode */ }
    glassApply();
    _syncGlassRow();
    if (typeof toast === 'function') {
      toast('Blur turned off: this browser is drawing without the graphics card, and the blur made windows lag. Settings > Blur brings it back.', { type: 'info', duration: 6000 });
    }
  };
  requestAnimationFrame(tick);
}

/** The Settings row: Auto -> Off -> On -> Auto. */
function toggleGlass() {
  const next = { auto: 'off', off: 'on', on: 'auto' }[glassMode()];
  try {
    if (next === 'auto') { localStorage.removeItem(GLASS_KEY); localStorage.removeItem(GLASS_SLOW_KEY); }
    else localStorage.setItem(GLASS_KEY, next);
  } catch (e) { /* private mode */ }
  _glass.probes = 0;
  glassApply();
  _syncGlassRow();
  if (typeof toast === 'function') {
    toast({ auto: 'Blur: Auto -- off by itself if it lags', off: 'Blur off', on: 'Blur on' }[next], { type: 'info', duration: 1800 });
  }
}

function _syncGlassRow() {
  const row = document.getElementById('settings-glass-item');
  if (!row) return;
  const m = glassMode();
  const on = glassOn();
  row.setAttribute('aria-pressed', String(on));
  const label = document.getElementById('settings-glass-label');
  const desc = document.getElementById('settings-glass-desc');
  if (label) label.textContent = 'Blur: ' + (m === 'auto' ? 'Auto' : m === 'on' ? 'On' : 'Off');
  if (desc) {
    desc.textContent = m === 'off' ? 'Windows dim the page instead of frosting it'
      : m === 'on' ? 'Frosted glass behind windows, always'
      : on ? 'Frosted glass; turns itself off if it makes windows lag'
      : 'Off here: this browser draws without the graphics card';
  }
  if (typeof _setLucideIcon === 'function') {
    _setLucideIcon(document.getElementById('settings-glass-icon'), on ? 'droplets' : 'droplet-off');
  }
}

glassApply();
document.addEventListener('DOMContentLoaded', _syncGlassRow);
window.addEventListener('storage', e => {
  if (e.key === GLASS_KEY || e.key === GLASS_SLOW_KEY || e.key === null) { glassApply(); _syncGlassRow(); }
});
