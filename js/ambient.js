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

/* A dozen, because each one is only visible for about a tenth of its cycle --
   so at any moment one or two are in flight and the rest are waiting. Fewer
   read as a pane where nothing happens; many more read as rain. */
const AMB_COUNT = 12;

/** Is the ambient layer on? On by default; the switch is a departure from it. */
function ambEnabled() {
  try { return localStorage.getItem(AMB_KEY) !== '0'; } catch (e) { return true; }
}

/** The panes worth filling: the two that are mostly empty for most of an attempt. */
function _ambHosts() {
  return [document.querySelector('.practice-sidebar'), document.getElementById('practice-panel')]
    .filter(Boolean);
}

/* Five slivers, and neighbours never share one.

   Long and thin, because the shard IS the streak now -- there is no separate
   trail behind it. Drawn upright in a tall narrow box and turned a quarter by
   the stylesheet, so the length ends up along the direction of travel.

   Taken in order rather than at random, which is what guarantees no two
   adjacent shards match; random pairs them often enough to notice, and
   noticing is the whole problem being solved. */
const AMB_SHAPES = [
  '<path d="M3 0 L5.2 13 L3 30 L0.8 13 Z" fill="currentColor" fill-opacity=".22"'
  + ' stroke="currentColor" stroke-width=".7" stroke-linejoin="round"/>',
  '<path d="M3 0 L5 9 L3.6 30 L1.2 10 Z" fill="currentColor" fill-opacity=".18"'
  + ' stroke="currentColor" stroke-width=".6" stroke-linejoin="round"/>',
  '<path d="M3 0 L6 15 L3 30 L0 15 Z" fill="currentColor" fill-opacity=".15"'
  + ' stroke="currentColor" stroke-width=".7" stroke-linejoin="round"/>',
  '<path d="M3 0 L4.4 7 L3 30 L1.7 8 Z" fill="currentColor" fill-opacity=".26"'
  + ' stroke="currentColor" stroke-width=".55" stroke-linejoin="round"/>',
  '<path d="M3 0 L5.4 20 L3 30 L0.6 19 Z" fill="currentColor" fill-opacity=".2"'
  + ' stroke="currentColor" stroke-width=".65" stroke-linejoin="round"/>'
];

function _ambShapeSVG(i) {
  return '<svg viewBox="0 0 6 30" fill="none" aria-hidden="true">'
       + AMB_SHAPES[i % AMB_SHAPES.length] + '</svg>';
}

const _ambRand = (lo, hi) => lo + Math.random() * (hi - lo);

/**
 * Fill one pane, if it is not already filled.
 *
 * Idempotent by design: it is called after every panel render, and a pane that
 * still has its shards must be left alone rather than restarted -- restarting
 * would fire every shard at once, which is the one thing that would make them
 * look like a mechanism instead of weather.
 */
function _ambFill(host) {
  if (!host) return;
  if (host.querySelector(':scope > .amb-shards')) return;

  const layer = document.createElement('div');
  layer.className = 'amb-shards';
  layer.setAttribute('aria-hidden', 'true');

  // Runs across every shard in the pane, gusts included, so the no-two-alike
  // rule holds across the whole layer rather than within each group.
  let n = 0;

  const shardAt = (x, y, ang, cycle, delay) => {
    const el = document.createElement('div');
    el.className = 'amb-shard';
    const curve = _ambRand(18, 62) * (Math.random() < 0.5 ? -1 : 1);
    el.style.setProperty('--x', x);
    el.style.setProperty('--y', y);
    el.style.setProperty('--ang', ang.toFixed(1) + 'deg');
    el.style.setProperty('--len', Math.round(_ambRand(130, 280)) + 'px');
    el.style.setProperty('--curve', Math.round(curve) + 'px');
    // Turned the way it is bending, so its length follows the curve rather
    // than pointing where it set off.
    el.style.setProperty('--spin', (curve > 0 ? 16 : -16).toFixed(0) + 'deg');
    el.style.setProperty('--s', _ambRand(0.65, 1.3).toFixed(2));
    el.style.setProperty('--t', cycle.toFixed(1) + 's');
    el.style.setProperty('--d', delay.toFixed(2) + 's');

    const inner = document.createElement('span');
    inner.className = 'amb-shard-i';
    inner.style.color = (n % 3) ? 'var(--amb-lit)' : 'var(--amb-ink)';
    inner.innerHTML = _ambShapeSVG(n);
    n++;
    el.appendChild(inner);
    return el;
  };

  /* Four that travel alone, anywhere and in any direction. */
  for (let i = 0; i < 4; i++) {
    const cycle = _ambRand(6, 14);
    layer.appendChild(shardAt(
      _ambRand(8, 88).toFixed(1) + '%',
      _ambRand(8, 88).toFixed(1) + '%',
      _ambRand(0, 360),
      cycle,
      -Math.random() * cycle
    ));
  }

  /* And two gusts: a handful each, thrown from one point at one moment, with
     the ground turning under them. Members share the cycle and very nearly the
     delay -- near, not equal, because a group that strikes in perfect unison
     reads as a chorus line rather than as wind. */
  for (let g = 0; g < 2; g++) {
    const gust = document.createElement('div');
    gust.className = 'amb-gust';
    const cycle = _ambRand(7, 12);
    const delay = -Math.random() * cycle;
    gust.style.setProperty('--gx', _ambRand(20, 80).toFixed(1) + '%');
    gust.style.setProperty('--gy', _ambRand(20, 80).toFixed(1) + '%');
    gust.style.setProperty('--gt', cycle.toFixed(1) + 's');
    gust.style.setProperty('--gd', delay.toFixed(2) + 's');
    gust.style.setProperty('--gspin', (_ambRand(90, 210) * (Math.random() < 0.5 ? -1 : 1)).toFixed(0) + 'deg');

    // Fanned around one heading: blown together, not scattered from a point.
    const heading = _ambRand(0, 360);
    const members = 4 + Math.round(Math.random());
    for (let i = 0; i < members; i++) {
      gust.appendChild(shardAt(
        Math.round(_ambRand(-34, 34)) + 'px',
        Math.round(_ambRand(-34, 34)) + 'px',
        heading + _ambRand(-38, 38),
        cycle,
        delay + _ambRand(-0.3, 0.3)
      ));
    }
    layer.appendChild(gust);
  }

  // First child, so it sits behind everything the pane already holds.
  host.insertBefore(layer, host.firstChild);
}

/** Put the shards back wherever they are missing, or take them all away. */
function ambMount() {
  const on = ambEnabled();
  document.body.classList.toggle('amb-off', !on);
  if (!on) {
    document.querySelectorAll('.amb-shards').forEach(el => el.remove());
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
