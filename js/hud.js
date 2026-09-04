/* ============================================================
   HUD.JS — mounts the decorative HUD chrome, and its switch
   ------------------------------------------------------------
   The layer itself is CSS (css/hud.css). This file builds the subtree once,
   keeps it in step with the sidebar's width, and carries the preference.

   BUILT ONCE, NOT PER ROUTE. It is fixed to the viewport and says nothing
   about the page under it, so there is nothing to rebuild when the route
   changes -- the same reasoning that puts the agenda flag on <body>.
   ============================================================ */

const HUD_KEY = 'ssp.hud';

function hudEnabled() {
  try { return localStorage.getItem(HUD_KEY) !== '0'; } catch (e) { return true; }
}

function hudSetEnabled(on) {
  try { localStorage.setItem(HUD_KEY, on ? '1' : '0'); } catch (e) { /* private mode */ }
  document.body.classList.toggle('hud-off', !on);
}

function toggleHud() {
  const next = !hudEnabled();
  hudSetEnabled(next);
  _syncHudSettingsRow();
  if (typeof toast === 'function') {
    toast(next ? 'HUD chrome on' : 'HUD chrome off', { type: 'info', duration: 1600 });
  }
}

/**
 * Keep the Settings row reading what the switch actually is.
 *
 * Called on toggle and again when the sheet opens: the preference is stored,
 * so it can have been changed in another tab since this one last drew the row.
 * The same reason _syncFullscreenBtn runs on open rather than only on click.
 */
function _syncHudSettingsRow() {
  const on = hudEnabled();
  const row = document.getElementById('settings-hud-item');
  if (!row) return;
  row.setAttribute('aria-pressed', String(on));
  const label = document.getElementById('settings-hud-label');
  const desc = document.getElementById('settings-hud-desc');
  if (label) label.textContent = on ? 'HUD Chrome On' : 'HUD Chrome Off';
  if (desc) desc.textContent = on ? 'Frame, brackets and scan lines' : 'No chrome over the page';
  if (typeof _setLucideIcon === 'function') {
    _setLucideIcon(document.getElementById('settings-hud-icon'), on ? 'scan' : 'scan-line');
  }
}

/* The bracket, drawn once and mirrored into the other three corners by CSS
   transforms -- the kit passed a `corner` prop and rebuilt the SVG four times. */
function _hudBracket(cls) {
  return '<svg class="hud-bracket ' + cls + '" width="86" height="86" viewBox="0 0 86 86" aria-hidden="true">'
       + '<path d="M0 30 V6 Q0 0 6 0 H30" fill="none" stroke="rgba(34,211,238,0.55)" stroke-width="1.25"/>'
       + '<path d="M0 46 V52" stroke="rgba(34,211,238,0.35)" stroke-width="1"/>'
       + '<path d="M46 0 H52" stroke="rgba(34,211,238,0.35)" stroke-width="1"/>'
       + '<rect x="9" y="9" width="5" height="5" fill="rgba(34,211,238,0.7)"/>'
       + '<path d="M22 22 H40" stroke="rgba(34,211,238,0.2)" stroke-width="1"/>'
       + '</svg>';
}

function _hudCross(top, left, size, opacity) {
  const d = size * 2;
  return '<svg class="hud-cross" width="' + d + '" height="' + d + '" viewBox="0 0 20 20" aria-hidden="true"'
       + ' style="top:' + top + ';left:' + left + ';opacity:' + opacity + ';">'
       + '<path d="M10 3 V17 M3 10 H17" stroke="rgba(34,211,238,0.85)" stroke-width="1"/></svg>';
}

function _hudTicks(cls, style, count) {
  let out = '<div class="hud-ticks ' + cls + '" style="' + style + '" aria-hidden="true">';
  for (let i = 0; i < count; i++) out += '<span></span>';
  return out + '</div>';
}

function hudMount() {
  if (document.getElementById('hud-layer')) return;
  const layer = document.createElement('div');
  layer.id = 'hud-layer';
  layer.className = 'hud-layer';
  layer.setAttribute('aria-hidden', 'true');
  layer.innerHTML =
      '<div class="hud-scan"></div>'
    + '<div class="hud-wash-left"></div>'
    + '<div class="hud-wash-top"></div>'
    + '<div class="hud-chrome">'
    +   '<div class="hud-frame"></div>'
    +   '<div class="hud-frame-inner"></div>'
    +   _hudBracket('hud-bracket-tl') + _hudBracket('hud-bracket-tr')
    +   _hudBracket('hud-bracket-bl') + _hudBracket('hud-bracket-br')
    +   _hudCross('12%', 'calc(100% - 46px)', 10, 0.45)
    +   _hudCross('58%', 'calc(100% - 30px)', 7, 0.3)
    +   _hudCross('calc(100% - 30px)', '34%', 7, 0.25)
    +   _hudCross('26px', '22%', 7, 0.3)
    +   _hudTicks('hud-ticks-v', 'right:22px;top:26%;', 16)
    +   _hudTicks('hud-ticks-h', 'left:38%;top:22px;', 18)
    +   _hudTicks('hud-ticks-h', 'right:12%;bottom:24px;', 12)
    +   '<div class="hud-dashes">'
    +     '<span style="width:18px"></span><span style="width:10px"></span>'
    +     '<span style="width:26px"></span><span style="width:8px"></span>'
    +   '</div>'
    +   '<div class="hud-rule"></div>'
    +   '<div class="hud-panel-b"></div>'
    +   '<div class="hud-pulse"></div>'
    + '</div>';
  /* Set BEFORE the layer is in the document, or the first frame paints the
     chrome around the storage picker and it is hidden a moment later -- the
     brief flash this is here to prevent. hud.js is deferred ahead of
     firebase-auth.js, but function declarations share one global scope and
     this runs at DOMContentLoaded, by which point both have executed. */
  if (typeof storagePickerWillShow === 'function') {
    document.body.classList.toggle('picker-open', storagePickerWillShow());
  }
  document.body.appendChild(layer);
  document.body.classList.toggle('hud-off', !hudEnabled());
  hudSyncNav();
}

/**
 * Keep the chrome off the sidebar.
 *
 * The kit was handed the nav width as a prop. Here it is measured from the rail
 * itself, so a collapse animates through the 0.3s transition the chrome already
 * declares rather than jumping.
 *
 * OBSERVED, NOT READ ONCE. The first attempt measured at DOMContentLoaded, when
 * the app shell does not exist yet: it fell back to 260px against a rail that is
 * 72px, and the chrome's left edge cut through the middle of the page. A
 * ResizeObserver gets the real width whenever the rail has one, and covers
 * collapsing and expanding without anything having to call in.
 */
function hudSyncNav() {
  const layer = document.getElementById('hud-layer');
  if (!layer) return;
  const rail = document.querySelector('.app-sidebar, .sidebar, #sidebar');
  if (!rail) return;                 // shell not built yet; the watcher will fire
  layer.style.setProperty('--hud-nav', Math.round(rail.getBoundingClientRect().width) + 'px');
  // A rail that has been swapped out from under the observer needs it back.
  if (_hudRail && !_hudRail.isConnected) _hudWatchRail();
}

let _hudRO = null;
let _hudRail = null;

/* Re-attaches when the rail it was watching is gone.
   Observing the first rail found and leaving it at that looked right and was
   not: the shell re-renders and replaces that element, so the observer is left
   holding a detached node and stops firing. Measured after one collapse --
   --hud-nav stuck at 78px against a rail that was 72px wide. */
function _hudWatchRail() {
  const rail = document.querySelector('.app-sidebar, .sidebar, #sidebar');
  if (!rail) return false;
  if (rail !== _hudRail) {
    _hudRail = rail;
    if (typeof ResizeObserver === 'function') {
      if (_hudRO) _hudRO.disconnect();
      _hudRO = new ResizeObserver(hudSyncNav);
      _hudRO.observe(rail);
    }
  }
  hudSyncNav();
  return true;
}

/* The shell is rendered by the router after load, so wait for the rail rather
   than assuming it. Gives up after ~5s, at which point the CSS default stands. */
function _hudStart() {
  hudMount();
  /* The rail animates in on first paint, so the width caught the moment it
     exists is a frame of that animation -- measured once at 78px against a rail
     that settles at 72. The observer covers every later change, but it has
     nothing to report if the rail never resizes again, so the settled value has
     to be taken deliberately. */
  setTimeout(hudSyncNav, 600);
  setTimeout(hudSyncNav, 1600);
  if (_hudWatchRail()) return;
  let tries = 0;
  const id = setInterval(() => {
    if (_hudWatchRail() || ++tries > 50) clearInterval(id);
  }, 100);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _hudStart);
} else {
  _hudStart();
}
window.addEventListener('resize', hudSyncNav);
/* A route change is when the shell is most likely to have rebuilt the rail, and
   it is the cheapest place to notice. */
window.addEventListener('hashchange', () => setTimeout(_hudWatchRail, 60));
