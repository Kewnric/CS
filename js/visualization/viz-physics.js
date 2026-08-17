/* ============================================================
   VIZ-PHYSICS.JS — Obsidian-style force-directed layout + hover focus
   ------------------------------------------------------------
   - vizToggleForceLayout(): toolbar/keyboard ("P") toggle. While ON, a
     force simulation (link springs + node repulsion + center gravity)
     runs on the visible graph of the active module (viz or brain) and
     settles organically. Dragging a node tugs the rest of the graph.
   - vizHoverFocus()/vizHoverClear(): hovering a node highlights it and
     its direct neighbors and fades everything else, like Obsidian.
   ============================================================ */

const vizForce = {
  enabled: false,
  _raf: null,
  _vel: new Map(),        // nodeId -> {vx, vy}
  _els: new Map(),        // nodeId -> element (cache, refreshed on miss)
  _settled: false,
  _calmFrames: 0,
  _frame: 0,
  _savedAfterSettle: false,
  _preForcePositions: null, // Map<nodeId, {x, y}> — snapshot before force layout
  _cfg: null,               // cached vizForceSettings()
  _last: 0,                 // previous rAF timestamp, for the real delta
};

/* Obsidian exposes exactly four sliders — Center force, Repel force, Link
   force, Link distance — and its feel comes almost entirely from those. These
   are the same four, at Obsidian's defaults, persisted per user. Everything
   below them is fixed tuning that Obsidian doesn't expose either. */
const VF_DEFAULTS = { center: 0.35, repel: 1, link: 1, distance: 340 };
const VF_KEY = 'vizForceSettings';

function vizForceSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(VF_KEY));
    return Object.assign({}, VF_DEFAULTS, raw || {});
  } catch (e) { return Object.assign({}, VF_DEFAULTS); }
}

function vizForceSet(key, value) {
  const s = vizForceSettings();
  s[key] = value;
  try { localStorage.setItem(VF_KEY, JSON.stringify(s)); } catch (e) { /* quota */ }
  vizForce._cfg = s;
  vizForceWake();          // any change re-heats the graph, like Obsidian
  const out = document.getElementById('vf-' + key + '-val');
  if (out) out.textContent = key === 'distance' ? Math.round(value) : Number(value).toFixed(2);
}

/* Nodes here are wide cards (not dots), so repulsion alone isn't enough:
   a rectangle-aware collision pass keeps the boxes from overlapping. */
const VF_REPULSION = 380000;  // node-node push (inverse-square), scaled by `repel`
const VF_SPRING_K  = 0.025;   // link spring stiffness, scaled by `link`
const VF_GRAVITY   = 0.0022;  // pull toward the centre, scaled by `center`
const VF_DAMPING   = 0.8;     // velocity decay per frame
const VF_MAX_V     = 16;      // speed cap (px/frame)
const VF_SETTLE_V  = 0.3;     // below this max speed the graph is "calm" (force balance leaves ~0.1px/frame residual creep)
const VF_SETTLE_FRAMES = 30;  // calm frames before pausing integration
const VF_COLL_PAD  = 34;      // min gap between card edges (px)
const VF_COLL_K    = 0.55;    // collision separation strength
const VF_BURST_ITER = 260;    // synchronous pre-untangle steps on enable
const VF_DT        = 0.016;   // reference step; real dt is clamped around this

/** Snapshot of the active module's simulation context (cheap, per frame). */
function _vfCtx() {
  if (typeof viz !== 'undefined' && viz.activeModule === 'brain') {
    return {
      nodes: brain.nodes,
      links: brain.links,
      defW: 250, defH: 80,
      dragging: () => brain.draggingNode,
      updateLinks: () => { if (typeof brainUpdateSVGLinks === 'function') brainUpdateSVGLinks(); },
      updateMinimap: () => { if (typeof brainUpdateMinimap === 'function') brainUpdateMinimap(); },
      save: () => { if (typeof brainSaveCurrentVersion === 'function') brainSaveCurrentVersion(); },
      pushUndo: () => { if (typeof brainPushUndo === 'function') brainPushUndo(); },
      render: () => { if (typeof brainRenderCanvas === 'function') brainRenderCanvas(); },
    };
  }
  const scopes = (typeof vizGetVisibleScopes === 'function') ? vizGetVisibleScopes() : [];
  const nodes = viz.nodes.filter(n => scopes.includes(n.scope));
  const ids = new Set(nodes.map(n => n.id));
  return {
    nodes,
    links: viz.links.filter(l => ids.has(l.from) && ids.has(l.to)),
    defW: 180, defH: 50,
    dragging: () => viz.draggingNode,
    updateLinks: () => { if (typeof vizUpdateSVGLinks === 'function') vizUpdateSVGLinks(); },
    updateMinimap: () => { if (typeof vizUpdateMinimap === 'function') vizUpdateMinimap(); },
    save: () => { if (typeof vizSave === 'function') vizSave(); },
    pushUndo: () => { if (typeof vizPushUndo === 'function') vizPushUndo(); },
    render: () => { if (typeof vizRenderCanvas === 'function') vizRenderCanvas(); },
  };
}

function vizToggleForceLayout() {
  vizForce.enabled = !vizForce.enabled;
  const btn = document.getElementById('viz-force-toggle-btn');
  if (btn) btn.classList.toggle('is-active', vizForce.enabled);
  const panel = document.getElementById('viz-force-panel');
  if (panel) {
    panel.classList.toggle('hidden', !vizForce.enabled);
    if (vizForce.enabled) vizForceRenderPanel();
  }

  if (vizForce.enabled) {
    vizForce._cfg = vizForceSettings();
    const ctx = _vfCtx();
    // Snapshot every node's position so we can restore on toggle-off.
    vizForce._preForcePositions = new Map();
    ctx.nodes.forEach(n => vizForce._preForcePositions.set(n.id, { x: n.x, y: n.y }));
    // Pre-untangle: run the simulation synchronously (no DOM writes) so the
    // graph springs into a clean layout instantly instead of crawling there.
    const sizes = _vfSizes(ctx);
    for (let i = 0; i < VF_BURST_ITER; i++) {
      const maxV = _vfStep(ctx, sizes, null, VF_DT);
      if (i > 60 && maxV < VF_SETTLE_V) break;
    }
    vizForce._vel.clear();
    ctx.render(); // one full re-render with the untangled positions
    vizForceWake();
    vizForce._last = 0;
    if (!vizForce._raf) vizForce._raf = requestAnimationFrame(_vfTick);
  } else {
    vizForceStop();
  }
}

/**
 * Stop the simulation loop (also used on route destroy).
 *
 * Turning it off KEEPS the layout. It used to snap every node back to where it
 * sat before you enabled it, which meant the force layout could never actually
 * be used to arrange a graph — the one thing it is for. Obsidian behaves the
 * same way: the simulation's output is the layout. The pre-force positions go
 * onto the undo stack instead, so one Ctrl+Z still puts everything back.
 */
function vizForceStop(silent) {
  if (vizForce._raf) { cancelAnimationFrame(vizForce._raf); vizForce._raf = null; }

  if (!silent && vizForce._preForcePositions) {
    const ctx = _vfCtx();
    const before = vizForce._preForcePositions;
    vizForce._preForcePositions = null;
    const moved = ctx.nodes.some(n => {
      const p = before.get(n.id);
      return p && (Math.abs(p.x - n.x) > 0.5 || Math.abs(p.y - n.y) > 0.5);
    });
    if (moved) {
      // Bank the OLD positions as the undo point, then keep the new ones.
      const now = ctx.nodes.map(n => ({ id: n.id, x: n.x, y: n.y }));
      ctx.nodes.forEach(n => { const p = before.get(n.id); if (p) { n.x = p.x; n.y = p.y; } });
      ctx.pushUndo();
      now.forEach(p => { const n = ctx.nodes.find(x => x.id === p.id); if (n) { n.x = p.x; n.y = p.y; } });
    }
    ctx.render();
    ctx.save();
    ctx.updateMinimap();
    if (moved && typeof toast === 'function') toast('Layout kept. Ctrl+Z to put it back.', { type: 'info' });
  }

  vizForce.enabled = false;
  vizForce._vel.clear();
  vizForce._els.clear();
  vizForce._last = 0;
  const btn = document.getElementById('viz-force-toggle-btn');
  if (btn) btn.classList.remove('is-active');
  const panel = document.getElementById('viz-force-panel');
  if (panel) panel.classList.add('hidden');
}

/* ── The four sliders ──────────────────────────────────────────
   Obsidian's whole graph feel lives in these; without them the simulation has
   exactly one look and no way to adapt it to a dense or a sparse graph. */
function vizForceTogglePanel() {
  const p = document.getElementById('viz-force-panel');
  if (!p) return;
  if (p.classList.contains('hidden')) vizForceRenderPanel();
  p.classList.toggle('hidden');
}

function vizForceRenderPanel() {
  const p = document.getElementById('viz-force-panel');
  if (!p) return;
  const s = vizForceSettings();
  const row = (key, label, min, max, stepSize, val, hint) => `
    <label class="vf-row" title="${hint}">
      <span class="vf-label">${label}</span>
      <input type="range" min="${min}" max="${max}" step="${stepSize}" value="${val}"
             oninput="vizForceSet('${key}', parseFloat(this.value))" />
      <output id="vf-${key}-val" class="vf-val">${key === 'distance' ? Math.round(val) : Number(val).toFixed(2)}</output>
    </label>`;
  p.innerHTML = `
    <div class="vf-title">Forces</div>
    ${row('center', 'Center', 0, 1, 0.01, s.center, 'How strongly everything is pulled toward the middle')}
    ${row('repel', 'Repel', 0, 3, 0.05, s.repel, 'How hard nodes push each other apart')}
    ${row('link', 'Link', 0, 2, 0.05, s.link, 'How stiff the connections are')}
    ${row('distance', 'Link distance', 80, 600, 10, s.distance, 'The length a connection wants to be')}
    <button class="vf-reset" onclick="vizForceReset()">Reset to defaults</button>`;
}

function vizForceReset() {
  try { localStorage.removeItem(VF_KEY); } catch (e) { /* quota */ }
  vizForce._cfg = Object.assign({}, VF_DEFAULTS);
  vizForceRenderPanel();
  vizForceWake();
}

/** Wake the simulation after external changes (drag, render, add node…). */
function vizForceWake() {
  vizForce._settled = false;
  vizForce._calmFrames = 0;
  vizForce._savedAfterSettle = false;
  vizForce._els.clear();   // re-renders replace elements; refresh the cache
  vizForce._sizes = null;  // sizes may have changed too
}

function _vfEl(id) {
  let el = vizForce._els.get(id);
  if (!el || !el.isConnected) {
    el = document.querySelector(`.viz-node[data-node-id="${id}"]`);
    if (el) vizForce._els.set(id, el);
  }
  return el;
}

/** Node sizes (from live elements when available, else stored/default). */
function _vfSizes(ctx) {
  const sizes = new Map();
  ctx.nodes.forEach(n => {
    const el = _vfEl(n.id);
    sizes.set(n.id, {
      w: (el && el.offsetWidth) || n.w || ctx.defW,
      h: (el && el.offsetHeight) || n.h || ctx.defH,
    });
  });
  return sizes;
}

/**
 * One simulation step: repulsion + rectangle collision + springs + gravity,
 * then integrate. Mutates node x/y. Returns the max node speed this step.
 * Used by both the animated rAF loop and the synchronous untangle burst.
 */
function _vfStep(ctx, sizes, draggingId, dt) {
  const nodes = ctx.nodes;
  if (nodes.length === 0) return 0;
  // Clamped so a 144Hz display doesn't settle 2.4x faster than a 60Hz one and
  // a stalled tab doesn't fling every node across the canvas on the next frame.
  const step = Math.max(0.008, Math.min(dt || VF_DT, 0.033));

  // Geometry snapshot (centers + sizes)
  const geo = new Map();
  let cx = 0, cy = 0;
  nodes.forEach(n => {
    const s = sizes.get(n.id) || { w: ctx.defW, h: ctx.defH };
    const g = { w: s.w, h: s.h, cx: n.x + s.w / 2, cy: n.y + s.h / 2, fx: 0, fy: 0 };
    geo.set(n.id, g);
    cx += g.cx; cy += g.cy;
  });
  cx /= nodes.length; cy /= nodes.length;

  const cfg = vizForce._cfg || (vizForce._cfg = vizForceSettings());

  // 1. Pairwise repulsion + card-aware collision separation
  for (let i = 0; i < nodes.length; i++) {
    const a = geo.get(nodes[i].id);
    for (let j = i + 1; j < nodes.length; j++) {
      const b = geo.get(nodes[j].id);
      let dx = a.cx - b.cx, dy = a.cy - b.cy;
      let d2 = dx * dx + dy * dy;
      if (d2 < 1) { dx = (Math.random() - 0.5); dy = (Math.random() - 0.5); d2 = 1; }
      const d = Math.sqrt(d2);
      const f = (VF_REPULSION * cfg.repel) / (d2 + 600);
      a.fx += (dx / d) * f; a.fy += (dy / d) * f;
      b.fx -= (dx / d) * f; b.fy -= (dy / d) * f;

      // Collision: these are wide cards, not points. If the padded boxes
      // overlap, push firmly apart along the axis of least overlap so no
      // two cards can sit on top of each other.
      const overlapX = (a.w + b.w) / 2 + VF_COLL_PAD - Math.abs(dx);
      const overlapY = (a.h + b.h) / 2 + VF_COLL_PAD - Math.abs(dy);
      if (overlapX > 0 && overlapY > 0) {
        if (overlapX < overlapY) {
          const push = overlapX * VF_COLL_K * 60;
          const s = dx >= 0 ? 1 : -1;
          a.fx += s * push; b.fx -= s * push;
        } else {
          const push = overlapY * VF_COLL_K * 60;
          const s = dy >= 0 ? 1 : -1;
          a.fy += s * push; b.fy -= s * push;
        }
      }
    }
  }

  // 2. Link springs (attract toward rest length)
  ctx.links.forEach(l => {
    const a = geo.get(l.from), b = geo.get(l.to);
    if (!a || !b) return;
    const dx = b.cx - a.cx, dy = b.cy - a.cy;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const f = VF_SPRING_K * cfg.link * (d - cfg.distance);
    a.fx += (dx / d) * f; a.fy += (dy / d) * f;
    b.fx -= (dx / d) * f; b.fy -= (dy / d) * f;
  });

  // 3. Gravity toward the centre (keeps islands from drifting away)
  nodes.forEach(n => {
    const g = geo.get(n.id);
    g.fx += (cx - g.cx) * VF_GRAVITY * cfg.center * 28;
    g.fy += (cy - g.cy) * VF_GRAVITY * cfg.center * 28;
  });

  // 4. Integrate (skip the node being dragged — the cursor pins it)
  let maxV = 0;
  nodes.forEach(n => {
    if (n.id === draggingId) { vizForce._vel.set(n.id, { vx: 0, vy: 0 }); return; }
    const g = geo.get(n.id);
    let v = vizForce._vel.get(n.id);
    if (!v) { v = { vx: 0, vy: 0 }; vizForce._vel.set(n.id, v); }
    v.vx = (v.vx + g.fx * step) * VF_DAMPING;
    v.vy = (v.vy + g.fy * step) * VF_DAMPING;
    const sp = Math.sqrt(v.vx * v.vx + v.vy * v.vy);
    if (sp > VF_MAX_V) { v.vx = (v.vx / sp) * VF_MAX_V; v.vy = (v.vy / sp) * VF_MAX_V; }
    if (sp > maxV) maxV = sp;
    if (sp < 0.01) return;
    n.x += v.vx;
    n.y += v.vy;
  });
  return maxV;
}

function _vfTick(now) {
  vizForce._raf = null;
  if (!vizForce.enabled) return;
  vizForce._raf = requestAnimationFrame(_vfTick);
  vizForce._frame++;

  const dt = vizForce._last ? (now - vizForce._last) / 1000 : VF_DT;
  vizForce._last = now;

  const ctx = _vfCtx();
  if (ctx.nodes.length === 0) return;

  const draggingId = ctx.dragging();
  // Re-heat only; the full wake dropped the element and size caches on EVERY
  // frame of a drag, so the next frame re-measured offsetWidth/offsetHeight for
  // every node in the graph — a forced synchronous layout per frame.
  if (draggingId) {
    vizForce._settled = false;
    vizForce._calmFrames = 0;
  }
  if (vizForce._settled) {
    // Calm graph: integration paused; keep watching for drags.
    // Don't persist — force layout is a temporary preview; positions revert
    // to the pre-force snapshot when the user toggles it off.
    return;
  }

  // Sizes change rarely — refresh the cache periodically, not per frame.
  if (!vizForce._sizes || vizForce._frame % 20 === 0) vizForce._sizes = _vfSizes(ctx);
  const maxV = _vfStep(ctx, vizForce._sizes, draggingId, dt);

  // Write positions to the DOM
  ctx.nodes.forEach(n => {
    if (n.id === draggingId) return;
    const el = _vfEl(n.id);
    if (el) { el.style.left = n.x + 'px'; el.style.top = n.y + 'px'; }
  });

  ctx.updateLinks();
  if (vizForce._frame % 6 === 0) ctx.updateMinimap();

  // Settle detection — zero velocities on freeze so residual creep stops dead
  if (maxV < VF_SETTLE_V && !draggingId) {
    if (++vizForce._calmFrames >= VF_SETTLE_FRAMES) {
      vizForce._settled = true;
      vizForce._vel.clear();
    }
  } else {
    vizForce._calmFrames = 0;
  }
}

/* ============================================================
   HOVER FOCUS — Obsidian-style neighborhood highlighting
   ============================================================ */

function vizHoverFocus(nodeId) {
  const isBrain = typeof viz !== 'undefined' && viz.activeModule === 'brain';
  // Don't fight active interactions
  if (isBrain ? (brain.draggingNode || brain.isPanning || brain.linkingFrom) :
                (viz.draggingNode || viz.isPanning || viz.linkingFrom)) return;
  const links = isBrain ? brain.links : viz.links;
  const container = document.getElementById('viz-canvas-container');
  const nodesLayer = document.getElementById('viz-nodes-layer');
  const svg = document.getElementById('viz-canvas-svg');
  if (!container || !nodesLayer) return;

  const adj = new Set([nodeId]);
  links.forEach(l => {
    if (l.from === nodeId) adj.add(l.to);
    if (l.to === nodeId) adj.add(l.from);
  });

  container.classList.add('viz-focus');
  nodesLayer.querySelectorAll('.viz-node').forEach(el => {
    const id = el.dataset.nodeId;
    el.classList.toggle('viz-hover-main', id === nodeId);
    el.classList.toggle('viz-hover-adj', id !== nodeId && adj.has(id));
  });
  if (svg) {
    svg.querySelectorAll('.viz-link-group').forEach(g => {
      const lid = g.dataset.linkId;
      const l = links.find(x => x.id === lid);
      g.classList.toggle('viz-link-adj', !!(l && (l.from === nodeId || l.to === nodeId)));
    });
  }
}

function vizHoverClear() {
  const container = document.getElementById('viz-canvas-container');
  if (container) container.classList.remove('viz-focus');
  document.querySelectorAll('.viz-node.viz-hover-main, .viz-node.viz-hover-adj')
    .forEach(el => el.classList.remove('viz-hover-main', 'viz-hover-adj'));
  document.querySelectorAll('.viz-link-group.viz-link-adj')
    .forEach(g => g.classList.remove('viz-link-adj'));
}
