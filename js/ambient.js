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

/* Each shard is only lit for about a tenth of its cycle, so the number here is
   roughly ten times what is on screen at once. Twenty-six gives two or three
   flecks at any moment and a field that is never quite still -- a dozen gave
   one, which read as a pane where something occasionally happened rather than
   as a field with weather in it. */
const AMB_COUNT = 26;

/** Is the ambient layer on? On by default; the switch is a departure from it. */
function ambEnabled() {
  try { return localStorage.getItem(AMB_KEY) !== '0'; } catch (e) { return true; }
}

/** The panes worth filling: the two that are mostly empty for most of an attempt. */
/* Every pane this should sit behind, in one place.

   The attempt screens ONLY -- .practice-sidebar and .practice-panel, the
   two-pane shell shared by coding practice, practice sets, snippet attempts
   and notes practice. These are the panes that genuinely sit empty while you
   work, which is what the effect was for.

   This used to also list .messenger-pane-1 / -2 and .an-sn-page, which put it
   behind the libraries, admin forms, analytics, quests and the language pages.
   That was wrong on a phone: those panes go full-width, so a layer sized for a
   340px sidebar tiled the entire screen and read as page background rather
   than as something inside a pane. Kept to the attempt panes, it stays
   contained on every width.

   Deliberately NOT .home-content: the dashboard is dense with cards, and the
   analytics and admin landing pages are menus you pass through.

   Adding a screen later means adding a selector here and nothing else; the
   stylesheet keys off the .amb-host class this applies. */
const AMB_HOST_SELECTOR = '.practice-sidebar, .practice-panel';

function _ambHosts() {
  const hosts = Array.from(document.querySelectorAll(AMB_HOST_SELECTOR));
  // The stylesheet needs the class; giving it here keeps the list of pages and
  // the thing that marks them from drifting apart.
  hosts.forEach(h => h.classList.add('amb-host'));
  return hosts;
}

/* Five slivers, and neighbours never share one.

   CURVED AND POINTED AT BOTH ENDS. Each is two arcs meeting at a point, so it
   reads as a splinter rather than a tapered rectangle, and each bends a
   different way and by a different amount. The widest part sits about two
   thirds down, which leaves a long fine point at the y=0 end -- and y=0 is the
   end that leads, since the stylesheet turns the shape a quarter clockwise and
   that maps the top of the box onto the direction of travel.

   Filled rather than outlined. At 17px a stroke was most of the shard and the
   fill was a sliver of a sliver, so it read as a hollow shape; solid reads as
   a fleck catching the light.

   Taken in order rather than at random, which is what guarantees no two
   adjacent shards match; random pairs them often enough to notice, and
   noticing is the whole problem being solved. */
const AMB_SHAPES = [
  '<path d="M3 0 C4.6 10 5.4 20 3.3 30 C2.6 20 2.2 10 3 0 Z" fill="currentColor"'
  + ' fill-opacity=".85"/>',
  '<path d="M3 0 C1.5 10 0.7 21 3.1 30 C3.6 21 4.4 10 3 0 Z" fill="currentColor"'
  + ' fill-opacity=".8"/>',
  '<path d="M3 0 C5.2 12 5.0 23 3.4 30 C3.2 23 3.5 12 3 0 Z" fill="currentColor"'
  + ' fill-opacity=".9"/>',
  '<path d="M3 0 C4.2 9 5.6 22 3.2 30 C2.4 22 1.9 9 3 0 Z" fill="currentColor"'
  + ' fill-opacity=".75"/>',
  '<path d="M3 0 C1.9 11 1.2 22 3.2 30 C3.9 22 4.8 11 3 0 Z" fill="currentColor"'
  + ' fill-opacity=".85"/>'
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
    const curve = _ambRand(8, 30) * (Math.random() < 0.5 ? -1 : 1);
    el.style.setProperty('--x', x);
    el.style.setProperty('--y', y);
    el.style.setProperty('--ang', ang.toFixed(1) + 'deg');
    /* A short drift, not a crossing. These are small enough that 280px read as
       a streak fired across the pane; at this size the eye wants a fleck that
       moves a little and is gone. */
    el.style.setProperty('--len', Math.round(_ambRand(40, 130)) + 'px');
    el.style.setProperty('--curve', Math.round(curve) + 'px');
    // Not all equally bright, so the field has some depth to it.
    el.style.setProperty('--o', _ambRand(0.45, 1).toFixed(2));
    // Turned the way it is bending, so its length follows the curve rather
    // than pointing where it set off.
    el.style.setProperty('--spin', (curve > 0 ? 16 : -16).toFixed(0) + 'deg');
    el.style.setProperty('--s', _ambRand(0.5, 1.25).toFixed(2));
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

  /* Most travel alone, anywhere and in any direction. */
  for (let i = 0; i < AMB_COUNT - 10; i++) {
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
    const members = 5;
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
    document.querySelectorAll('.amb-host').forEach(el => el.classList.remove('amb-host'));
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
