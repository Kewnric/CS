/* ============================================================
   AMBIENT.JS — the crystals that blow through the practice panes
   ------------------------------------------------------------
   The field and the colour wash are pure CSS on the panes themselves (see
   css/ambient.css), which is deliberate: those two survive every re-render
   without anything here having to notice, because they are properties of the
   element rather than nodes inside it.

   The crystals cannot be done that way — each needs its own path, size and
   timing — so they are nodes, and nodes have to be put back when the pane
   that holds them is rebuilt. That is all this file does, plus the switch.
   ============================================================ */

const AMB_KEY = 'ssp.ambient';

/* Enough to read as a drift, few enough that nobody's laptop notices. Each
   carries its own line, size, speed and delay, so the group never falls into
   a visible rhythm. */
const AMB_COUNT = 7;

/** Is the ambient layer on? On by default; the switch is a departure from it. */
function ambEnabled() {
  try { return localStorage.getItem(AMB_KEY) !== '0'; } catch (e) { return true; }
}

/** The panes worth filling: the two that are mostly empty for most of an attempt. */
function _ambHosts() {
  return [document.querySelector('.practice-sidebar'), document.getElementById('practice-panel')]
    .filter(Boolean);
}

/* The app's own crystal, drawn small. Faceted rather than a plain diamond so
   it still reads as a gem at 14px. */
function _ambCrystalSVG() {
  return '<svg viewBox="0 0 14 22" fill="none" aria-hidden="true">'
       + '<path d="M7 1 L13 8 L7 21 L1 8 Z" fill="currentColor" fill-opacity=".14"'
       + ' stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/>'
       + '<path d="M1 8 L13 8 M7 1 L7 21" stroke="currentColor" stroke-width=".7" opacity=".55"/>'
       + '</svg>';
}

/**
 * Fill one pane, if it is not already filled.
 *
 * Idempotent by design: it is called after every panel render, and a pane that
 * still has its crystals must be left alone rather than restarted — restarting
 * would snap every crystal back to the left edge in unison, which is the one
 * thing that would make them look like a mechanism.
 */
function _ambFill(host) {
  if (!host) return;
  const existing = host.querySelector(':scope > .amb-leaves');
  if (existing) return;

  const layer = document.createElement('div');
  layer.className = 'amb-leaves';
  layer.setAttribute('aria-hidden', 'true');

  for (let i = 0; i < AMB_COUNT; i++) {
    const leaf = document.createElement('div');
    leaf.className = 'amb-leaf';
    /* Spread over the height, then jittered, so they neither line up in bands
       nor clump the way pure random does over so few. */
    const lane = (i + 0.5) / AMB_COUNT;
    const y = Math.round((lane * 92 + (Math.random() * 10 - 5)) * 10) / 10;
    leaf.style.setProperty('--y', Math.max(2, Math.min(94, y)) + '%');
    leaf.style.setProperty('--t', (26 + Math.random() * 26).toFixed(1) + 's');
    // Negative, so the pane opens with crystals already in flight rather than
    // with an empty pane that slowly fills.
    leaf.style.setProperty('--d', (-Math.random() * 40).toFixed(1) + 's');
    leaf.style.setProperty('--s', (0.55 + Math.random() * 0.85).toFixed(2));
    leaf.style.setProperty('--o', (0.22 + Math.random() * 0.3).toFixed(2));

    const inner = document.createElement('span');
    inner.className = 'amb-leaf-i';
    inner.innerHTML = _ambCrystalSVG();
    // Cyan or indigo, so the drift is not one flat colour.
    inner.style.color = Math.random() < 0.55 ? 'var(--amb-lit)' : 'var(--amb-ink)';
    leaf.appendChild(inner);
    layer.appendChild(leaf);
  }
  // First child, so it sits behind everything the pane already holds.
  host.insertBefore(layer, host.firstChild);
}

/** Put the crystals back wherever they are missing, or take them all away. */
function ambMount() {
  const on = ambEnabled();
  document.body.classList.toggle('amb-off', !on);
  if (!on) {
    document.querySelectorAll('.amb-leaves').forEach(el => el.remove());
    return;
  }
  _ambHosts().forEach(_ambFill);
}

/** The topbar switch. */
function toggleAmbient() {
  const next = !ambEnabled();
  try { localStorage.setItem(AMB_KEY, next ? '1' : '0'); } catch (e) { /* private mode */ }
  ambMount();
  _syncAmbientBtn();
  if (typeof toast === 'function') {
    toast(next ? 'Background motion on' : 'Background motion off', { type: 'info', duration: 1800 });
  }
}

function _syncAmbientBtn() {
  const on = ambEnabled();
  const label = on ? 'Background motion on' : 'Background motion off';
  const btn = document.getElementById('ambient-btn');
  if (!btn) return;
  btn.title = label;
  btn.setAttribute('aria-label', label);
  btn.setAttribute('aria-pressed', String(on));
  btn.style.color = on ? 'var(--color-accent-hover, #22d3ee)' : '';
  const icon = btn.querySelector('[data-lucide], svg');
  if (typeof _setLucideIcon === 'function') _setLucideIcon(icon, on ? 'gem' : 'square');
}

function ambientButtonTemplate() {
  const on = ambEnabled();
  const label = on ? 'Background motion on' : 'Background motion off';
  return `
    <button class="btn btn-ghost practice-icon-btn" onclick="toggleAmbient()"
            title="${label}" id="ambient-btn" aria-label="${label}" aria-pressed="${on}"
            style="${on ? 'color:var(--color-accent-hover,#22d3ee);' : ''}">
      <i data-lucide="${on ? 'gem' : 'square'}" style="width:16px;height:16px;" aria-hidden="true"></i>
    </button>`;
}
