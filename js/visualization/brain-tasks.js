/* ============================================================
   BRAIN TASKS — notes with countdowns that run in order
   ------------------------------------------------------------
   Right-click a note → Task. A task has a duration and a small pill on
   its bottom edge: the time left, a play/pause button and (on hover) a
   reset. At 0 a short chime plays, the note is checked, and every arrow
   leaving it carries a pulse to the next task note, whose countdown
   starts. Arrows are only followed into task notes, in the direction
   they were drawn; a plain note ends the chain, and a step that is done
   is never restarted (so a loop back to an earlier step stops there).
   Checking a task by hand finishes it now and starts what comes next.

   DATA, on the note: task = { dur, state, endsAt?, left? }
     dur     seconds
     state   'idle' | 'running' | 'paused' | 'done'
     endsAt  epoch ms, while running
     left    seconds, while paused
   Saved with the note like any other field. Ticks never touch undo;
   making a note a task, or changing its time, does.

   THE ENGINE runs app-wide, not just on the canvas: one setTimeout to
   the next end time, set again after every change. A countdown keeps
   going when you leave Visualize or reload (endsAt is a clock time), and
   a step that ended while the app was closed finishes on the next start,
   its successor timed from when it really ended -- quietly, unless the
   end was under a minute ago. While Brain shows the canvas a task is on,
   brain.nodes is its live copy and is what the engine edits; any other
   canvas is edited in the stored version (v.nodes, or v.dirs[id] for a
   directory's canvas, brain-dir.js). The digits on screen change once a
   second from a timer that runs only while a running pill is showing;
   the bar under them is one transform animation, set when it starts.
   ============================================================ */

const BRAIN_TASK_PRESETS = [5, 10, 15, 25, 45, 60];   // minutes, the menu's chips
const BRAIN_TASK_DEFAULT = 25 * 60;
const BRAIN_TASK_RECENT_MS = 60000;   // an end older than this (app was closed) is caught up silently

let _btTimer = 0;
let _btTick = 0;
let _btBooted = false;
let _btAudio = null;

const _BT_SVG = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12-7.5z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h3.5v16H7zM13.5 4H17v16h-3.5z" fill="currentColor"/></svg>',
  reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
  timer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 2h4"/><path d="M12 14l3-3"/><circle cx="12" cy="14" r="8"/></svg>',
  done: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>',
  remove: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'
};

/* ── Time ─────────────────────────────────────────────────────── */

/** 5:00, 24:59, 1:05:00. */
function brainTaskFmt(secs) {
  const s = Math.max(0, Math.ceil(secs));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const two = n => String(n).padStart(2, '0');
  return h ? h + ':' + two(m) + ':' + two(r) : m + ':' + two(r);
}

/** "25", "1:30", "1:05:00" → seconds; null when it is not a time. */
function brainTaskParse(text) {
  const t = String(text || '').trim();
  if (!/^\d{1,3}(:\d{1,2}){0,2}$/.test(t)) return null;
  const parts = t.split(':').map(Number);
  let secs;
  if (parts.length === 1) secs = parts[0] * 60;                       // minutes
  else if (parts.length === 2) secs = parts[0] * 60 + parts[1];       // m:ss
  else secs = parts[0] * 3600 + parts[1] * 60 + parts[2];             // h:mm:ss
  return secs > 0 && secs <= 24 * 3600 ? secs : null;
}

/** Seconds left on a task now. */
function brainTaskLeft(task) {
  if (!task) return 0;
  if (task.state === 'running') return Math.max(0, (task.endsAt - Date.now()) / 1000);
  if (task.state === 'paused') return Math.max(0, task.left || 0);
  if (task.state === 'done') return 0;
  return task.dur;
}

function _btLastDur() {
  let v = null;
  try { v = parseInt(localStorage.getItem('ssp.brainTaskDur'), 10); } catch (_) { v = null; }
  return v > 0 ? v : BRAIN_TASK_DEFAULT;
}

/** A task note's name for a toast: its first line, short. */
function _btName(node) {
  const line = String((node && node.commentContent) || '').split('\n').map(s => s.trim()).find(Boolean) || 'Task';
  return line.length > 40 ? line.slice(0, 39) + '…' : line;
}

/** The task in a new state. What a task carries from state to state -- its
 *  time, where its timer floats, when it was first started -- is kept. */
function _btTask(old, state, extra) {
  const t = { dur: old.dur, state };
  if (old.pos) t.pos = old.pos;
  if (old.startedAt) t.startedAt = old.startedAt;
  return Object.assign(t, extra || {});
}

/* ── Where tasks live ─────────────────────────────────────────── */

/** Every canvas of every version: the version's own, then each directory's. */
function _btCanvases() {
  const out = [];
  (brain.versions || []).forEach(v => {
    out.push({ v, dirId: null, box: v });
    if (v.dirs && typeof v.dirs === 'object') Object.keys(v.dirs).forEach(d => out.push({ v, dirId: d, box: v.dirs[d] }));
  });
  return out;
}

/** Is this canvas the one Brain has on screen? Then brain.nodes is its live copy. */
function _btLive(c) {
  if (document.body.dataset.route !== 'visualization' || typeof viz === 'undefined' || viz.activeModule !== 'brain') return false;
  if (brain.activeVersionId !== c.v.id) return false;
  const here = brain.dirPath && brain.dirPath.length ? brain.dirPath[brain.dirPath.length - 1].dirId : null;
  return here === c.dirId;
}

function _btGraph(c) {
  return _btLive(c)
    ? { nodes: brain.nodes, links: brain.links, live: true }
    : { nodes: c.box.nodes || [], links: c.box.links || [], live: false };
}

/** Write what changed: the live canvas through the version save, else the stored brain. */
function _btCommit(live) {
  if (live) brainSaveCurrentVersion(); else brainSave();
}

/* ── The engine ───────────────────────────────────────────────── */

/** Start, or after a load, re-read every canvas for running countdowns. Waits
 *  for the storage choice (which brain save to read). */
function brainTasksBoot() {
  let mode = null;
  try { mode = sessionStorage.getItem('storageMode'); } catch (_) { mode = null; }
  if (!mode) return false;
  if (!_btBooted && !(brain.versions || []).length && typeof brainLoad === 'function') brainLoad();
  _btBooted = true;
  _btFire();
  return true;
}

/** Set the one timer for the next end. */
function _btSchedule() {
  clearTimeout(_btTimer);
  _btTimer = 0;
  let next = Infinity;
  _btCanvases().forEach(c => _btGraph(c).nodes.forEach(n => {
    const t = n.task;
    if (t && t.state === 'running' && t.endsAt < next) next = t.endsAt;
  }));
  if (next === Infinity) return;
  _btTimer = setTimeout(_btFire, Math.min(Math.max(0, next - Date.now()), 2147483647));
}

/** Finish everything that is due, oldest end first, then wait for the next. */
function _btFire() {
  _btTimer = 0;
  const now = Date.now();
  const report = { finished: [], started: [], chime: false, live: false, stored: false };
  for (let guard = 0; guard < 500; guard++) {
    let due = null;
    _btCanvases().forEach(c => _btGraph(c).nodes.forEach(n => {
      const t = n.task;
      if (t && t.state === 'running' && t.endsAt <= now && (!due || t.endsAt < due.n.task.endsAt)) due = { c, n };
    }));
    if (!due) break;
    _btFinish(due.c, due.n, due.n.task.endsAt, report, now);
  }
  if (report.finished.length) {
    // The version save writes the whole brain, stored canvases included.
    if (report.live) brainSaveCurrentVersion(); else if (report.stored) brainSave();
    if (report.chime) brainTaskChime();
    if (report.toast && typeof toast === 'function') toast(report.toast, { type: 'success' });
  }
  _btSchedule();
}

/** One step is over: check it, start what its arrows lead to, and show it. */
function _btFinish(c, n, endAt, report, now) {
  const g = _btGraph(c);
  n.task = _btTask(n.task, 'done', { doneAt: endAt });
  n.checked = true;
  n.checkedAt = n.updatedAt = endAt;
  if (!g.live) c.v.updatedAt = Math.max(c.v.updatedAt || 0, endAt);   // on screen, the version save stamps it
  const started = _btStartNext(g, n, endAt);
  const recent = now - endAt < BRAIN_TASK_RECENT_MS;
  report.finished.push(n);
  report.started.push(...started.map(s => s.m));
  if (g.live) report.live = true; else report.stored = true;
  if (recent) {
    report.chime = true;
    report.toast = '“' + _btName(n) + '” done' + (started.length ? ' — “' + _btName(started[0].m) + '” started' + (started.length > 1 ? ' (+' + (started.length - 1) + ')' : '') : '');
  }
  if (g.live) _btShowFinish(n, started, recent);
}

/** Each task an arrow from `n` leads to starts, timed from when `n` ended. */
function _btStartNext(g, n, endAt) {
  const started = [];
  g.links.forEach(l => {
    if (l.from !== n.id) return;
    const m = g.nodes.find(x => x.id === l.to);
    if (!m || !m.task || m.task.state === 'done' || m.task.state === 'running') return;
    const left = m.task.state === 'paused' && m.task.left > 0 ? m.task.left : m.task.dur;
    m.task = _btTask(m.task, 'running', { endsAt: endAt + left * 1000, startedAt: m.task.startedAt || endAt });
    started.push({ m, link: l });
  });
  return started;
}

/** On screen: the finished note gets its check (popping in), and a pulse runs
 *  along each arrow to the step that starts. */
function _btShowFinish(n, started, animate) {
  _brainCheckPop = animate ? new Set([n.id]) : null;
  brainRenderCanvas();
  _brainCheckPop = null;
  if (animate) brainTaskPulses(started);
}

/** A pulse along each arrow to a step that just started; it rings when it lands. */
function brainTaskPulses(started) {
  started.forEach(s => brainTaskPulse(s.link, () => {
    const el = document.querySelector(`#viz-nodes-layer > .viz-node[data-node-id="${s.m.id}"]`);
    if (!el) return;
    el.classList.remove('bt-arrive');
    void el.offsetWidth;   // restart the ring if it is still playing
    el.classList.add('bt-arrive');
    setTimeout(() => el.classList.remove('bt-arrive'), 900);
  }));
}

// Back on the tab: a timer a background tab held back fires now.
document.addEventListener('visibilitychange', () => { if (!document.hidden && _btBooted) _btFire(); });
// The storage picker comes first; until it is answered there is no brain to read.
(function _btWaitForStorage() {
  if (brainTasksBoot()) return;
  setTimeout(_btWaitForStorage, 1000);
})();

/* ── Acting on tasks ──────────────────────────────────────────── */

/** The note and the canvas it is on, live copy first. */
function _btFind(nodeId) {
  const live = brain.nodes.find(n => n.id === nodeId);
  if (live && brain.activeVersionId && document.body.dataset.route === 'visualization' && viz.activeModule === 'brain') {
    return { n: live, live: true };
  }
  for (const c of _btCanvases()) {
    const n = (c.box.nodes || []).find(x => x.id === nodeId);
    if (n) return { n, live: _btLive(c) };
  }
  return live ? { n: live, live: true } : null;
}

/** Make notes tasks of `durSecs` (or, with null, plain notes again). One undo step. */
function brainTaskSet(nodeIds, durSecs) {
  const nodes = nodeIds.map(id => brain.nodes.find(n => n.id === id))
    .filter(n => n && !(n.shape && BRAIN_PORTLESS.has(n.shape)));
  if (!nodes.length) return;
  brainPushUndo();
  nodes.forEach(n => {
    if (durSecs == null) { delete n.task; return; }
    const pos = n.task && n.task.pos;
    n.task = { dur: durSecs, state: 'idle' };
    if (pos) n.task.pos = pos;   // a new time keeps the timer where you put it
    delete n.checked;
  });
  if (durSecs != null) { try { localStorage.setItem('ssp.brainTaskDur', String(durSecs)); } catch (_) { /* private mode */ } }
  brainRenderCanvas(); brainSaveCurrentVersion();
  _btSchedule();
}

function brainTaskPlay(nodeId) {
  const f = _btFind(nodeId);
  if (!f || !f.n.task) return;
  const t = f.n.task;
  _btAudioWake();   // a press is what lets the chime play later
  if (t.state === 'running') { brainTaskPause(nodeId); return; }
  const left = t.state === 'paused' && t.left > 0 ? t.left : t.dur;
  f.n.task = _btTask(t, 'running', { endsAt: Date.now() + left * 1000,
    startedAt: t.startedAt && t.state !== 'done' ? t.startedAt : Date.now() });
  if (t.state === 'done') delete f.n.checked;   // done and played again: a fresh run
  _btCommit(f.live);
  brainTaskRepaint(nodeId);
  _btSchedule();
}

function brainTaskPause(nodeId) {
  const f = _btFind(nodeId);
  if (!f || !f.n.task || f.n.task.state !== 'running') return;
  f.n.task = _btTask(f.n.task, 'paused', { left: brainTaskLeft(f.n.task) });
  _btCommit(f.live);
  brainTaskRepaint(nodeId);
  _btSchedule();
}

function brainTaskReset(nodeId) {
  const f = _btFind(nodeId);
  if (!f || !f.n.task) return;
  const wasDone = f.n.task.state === 'done';
  f.n.task = _btTask({ dur: f.n.task.dur, pos: f.n.task.pos }, 'idle');
  if (wasDone) delete f.n.checked;
  _btCommit(f.live);
  if (wasDone) brainRenderCanvas(); else brainTaskRepaint(nodeId);
  _btSchedule();
}

/** Checked by hand: the step is finished now, and the next one starts. */
function brainTaskFinishNow(node) {
  if (!node || !node.task || node.task.state === 'done') return [];
  const g = { nodes: brain.nodes, links: brain.links, live: true };
  const now = Date.now();
  node.task = _btTask(node.task, 'done', { doneAt: now });
  const started = _btStartNext(g, node, now);
  return started;
}

/** Unchecked by hand: a done task is ready to run again. */
function brainTaskUndone(node) {
  if (node && node.task && node.task.state === 'done') node.task = _btTask({ dur: node.task.dur, pos: node.task.pos }, 'idle');
}

/* ── The floating timer ──────────────────────────────────────────
   Not on the note: a small indicator floating above it (top-right by
   default, clear of every port), tied to it by a leader line that ends in a
   dot on the note's nearest edge. At rest it shows the time and a small
   progress ring; hovering turns the ring into play / pause. Right-click it
   for reset, a new time, putting it back, or removing it. Drag it anywhere:
   task.pos is its offset from the note's top-left, in canvas px, and moving
   it is not an edit. The bob and the halo are transform/opacity loops; the
   ring is redrawn once a second with the digits. */

function brainTaskPillHTML(node) {
  const t = node.task;
  if (!t) return '';
  const left = brainTaskLeft(t);
  const frac = t.dur > 0 ? Math.min(1, left / t.dur) : 0;
  const running = t.state === 'running';
  const label = t.state === 'done' ? 'Done' : brainTaskFmt(left);
  const playLabel = running ? 'Pause' : (t.state === 'paused' ? 'Resume' : (t.state === 'done' ? 'Run again' : 'Start'));
  const place = t.pos ? ` style="left:${t.pos.x}px;top:${t.pos.y}px"` : '';
  const stateWord = { idle: 'Ready', running: 'Running', paused: 'Paused', done: 'Done' }[t.state] || '';
  return `<span class="bt-lead" data-state="${t.state}" aria-hidden="true"><i></i></span>`
    + `<div class="brain-task${t.pos ? ' is-placed' : ''}" data-state="${t.state}"${place} role="timer"`
    + ` title="${stateWord} · ${brainTaskFmt(t.dur)} timer — drag to move, right-click for more">`
    + `<span class="bt-float"><span class="bt-halo" aria-hidden="true"></span>`
    + `<span class="bt-knob"><span class="bt-ring" style="--p:${frac.toFixed(4)}">${t.state === 'done' ? _BT_SVG.done : ''}</span>`
    + `<button type="button" class="bt-play" title="${playLabel}" aria-label="${playLabel}">${running ? _BT_SVG.pause : (t.state === 'done' ? _BT_SVG.reset : _BT_SVG.play)}</button></span>`
    + `<span class="bt-time">${label}</span></span></div>`;
}

/** Put the timer on a rendered note (brainRenderCanvas) and wire it. */
function brainTaskDecorate(el, node) {
  el.classList.toggle('is-task', !!node.task);
  if (!node.task) return;
  el.insertAdjacentHTML('beforeend', brainTaskPillHTML(node));
  _btBindPill(el.querySelector(':scope > .brain-task'), node.id);
  setTimeout(() => brainTaskLayout(el), 0);   // after the note has its size
  _btEnsureTick();
}

/** Aim the leader line from the timer to the nearest point of the note. */
function brainTaskLayout(el) {
  const bub = el && el.querySelector(':scope > .brain-task');
  const lead = el && el.querySelector(':scope > .bt-lead');
  const inner = el && el.querySelector(':scope > .viz-node-inner');
  if (!bub || !lead || !inner) return;
  const W = inner.offsetWidth, H = inner.offsetHeight;
  const cx = bub.offsetLeft + bub.offsetWidth / 2, cy = bub.offsetTop + bub.offsetHeight / 2;
  const tx = Math.max(0, Math.min(W, cx)), ty = Math.max(0, Math.min(H, cy));
  const dx = cx - tx, dy = cy - ty;
  const len = Math.hypot(dx, dy) - bub.offsetHeight / 2;   // to the timer's edge, not its middle
  lead.classList.toggle('is-off', len < 6);
  if (len < 6) return;
  lead.style.left = tx + 'px';
  lead.style.top = ty + 'px';
  lead.style.width = len + 'px';
  lead.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
}

function _btBindPill(pill, nodeId) {
  if (!pill) return;
  // The timer is not the note: pressing it never drags, edits or selects it.
  pill.addEventListener('dblclick', e => e.stopPropagation());
  pill.addEventListener('click', e => {
    e.stopPropagation();
    if (pill._btDragged) { pill._btDragged = false; return; }
    if (e.target.closest('.bt-play')) brainTaskPlay(nodeId);
  });
  pill.addEventListener('contextmenu', e => brainTaskMenu(e, nodeId));
  pill.addEventListener('pointerdown', e => {
    e.stopPropagation();
    if (e.button !== 0 || e.target.closest('.bt-play')) return;
    _btDragStart(e, pill, nodeId);
  });
}

/* Dragging the timer: by its own position inside the note, so it moves with
   the note afterwards. Saved once on release, without an undo step. */
function _btDragStart(e, pill, nodeId) {
  const el = pill.parentElement;
  const z = brain.zoom || 1;
  const d = { sx: e.clientX, sy: e.clientY, x: pill.offsetLeft, y: pill.offsetTop, moved: false };
  try { pill.setPointerCapture(e.pointerId); } catch (_) { /* gone */ }
  const move = ev => {
    const dx = (ev.clientX - d.sx) / z, dy = (ev.clientY - d.sy) / z;
    if (!d.moved && Math.hypot(ev.clientX - d.sx, ev.clientY - d.sy) < 3) return;
    if (!d.moved) { d.moved = true; pill.classList.add('is-placed', 'is-dragging'); }
    d.nx = Math.round(d.x + dx); d.ny = Math.round(d.y + dy);
    pill.style.left = d.nx + 'px';
    pill.style.top = d.ny + 'px';
    brainTaskLayout(el);
  };
  const up = () => {
    pill.removeEventListener('pointermove', move);
    pill.removeEventListener('pointerup', up);
    pill.removeEventListener('pointercancel', up);
    pill.classList.remove('is-dragging');
    if (!d.moved) return;
    pill._btDragged = true;   // the click that ends a drag is not a press
    const f = _btFind(nodeId);
    if (!f || !f.n.task) return;
    f.n.task.pos = { x: d.nx, y: d.ny };
    _btCommit(f.live);
  };
  pill.addEventListener('pointermove', move);
  pill.addEventListener('pointerup', up);
  pill.addEventListener('pointercancel', up);
}

/** Redraw one note's timer in place. */
function brainTaskRepaint(nodeId) {
  const el = document.querySelector(`#viz-nodes-layer > .viz-node[data-node-id="${nodeId}"]`);
  const node = brain.nodes.find(n => n.id === nodeId);
  if (!el || !node) return;
  el.querySelectorAll(':scope > .brain-task, :scope > .bt-lead').forEach(x => x.remove());
  if (node.task) {
    el.insertAdjacentHTML('beforeend', brainTaskPillHTML(node));
    _btBindPill(el.querySelector(':scope > .brain-task'), nodeId);
    brainTaskLayout(el);
  }
  el.classList.toggle('is-task', !!node.task);
  _btEnsureTick();
}

/** The digits and the ring: once a second, only while a running timer is on screen. */
function _btEnsureTick() {
  if (_btTick || !document.querySelector('.brain-task[data-state="running"]')) return;
  _btTick = setInterval(() => {
    const pills = document.querySelectorAll('#viz-nodes-layer .brain-task[data-state="running"]');
    if (!pills.length) { clearInterval(_btTick); _btTick = 0; return; }
    pills.forEach(p => {
      const el = p.parentElement;
      const n = el && brain.nodes.find(x => x.id === el.dataset.nodeId);
      if (!n || !n.task) return;
      const left = brainTaskLeft(n.task);
      const out = p.querySelector('.bt-time');
      const txt = brainTaskFmt(left);
      if (out && out.textContent !== txt) out.textContent = txt;
      const ring = p.querySelector('.bt-ring');
      if (ring && n.task.dur > 0) ring.style.setProperty('--p', Math.min(1, left / n.task.dur).toFixed(4));
    });
  }, 1000);
}

/* ── The timer's own menu (right-click it) ──────────────────────── */

let _btMenuNode = null;

function brainTaskMenu(e, nodeId) {
  e.preventDefault();
  e.stopPropagation();
  brainHideAllMenus();
  const node = brain.nodes.find(n => n.id === nodeId);
  if (!node || !node.task) return;
  _btMenuNode = nodeId;
  let menu = document.getElementById('brain-task-ctx');
  if (!menu) {
    menu = document.createElement('div');
    menu.id = 'brain-task-ctx';
    menu.className = 'viz-context-menu bnm-menu brain-task-menu hidden';
    menu.setAttribute('role', 'menu');
    document.body.appendChild(menu);
    menu.addEventListener('click', _btMenuClick);
    menu.addEventListener('keydown', ev => {
      if (ev.key === 'Enter' && ev.target.id === 'brain-task-ctx-custom') { ev.preventDefault(); _btMenuCustom(); }
    });
  }
  const t = node.task;
  const running = t.state === 'running';
  const word = { idle: 'Ready', running: 'Running', paused: 'Paused', done: 'Done' }[t.state];
  const act = (a, icon, label, cls) => `<button type="button" class="bnm-act${cls ? ' ' + cls : ''}" data-act="${a}" title="${label}">${icon}<span>${label}</span></button>`;
  menu.innerHTML = `<div class="btm-head"><b>${t.state === 'done' ? 'Done' : brainTaskFmt(brainTaskLeft(t))}</b><span>${word} · ${brainTaskFmt(t.dur)} timer</span></div>
    <div class="bnm-actions btm-acts">
      ${act('play', running ? _BT_SVG.pause : _BT_SVG.play, running ? 'Pause' : (t.state === 'paused' ? 'Resume' : 'Start'))}
      ${act('reset', _BT_SVG.reset, 'Reset')}
      ${t.pos ? act('home', _BT_SVG.home, 'Put back') : ''}
      ${act('remove', _BT_SVG.remove, 'Remove', 'danger')}
    </div>
    <div class="bnm-label">Time</div>
    <div class="bnm-task-row" role="group" aria-label="Task time">
      ${BRAIN_TASK_PRESETS.map(m => `<button type="button" data-secs="${m * 60}" class="${t.dur === m * 60 ? 'active' : ''}">${m}m</button>`).join('')}
    </div>
    <div class="bnm-task-custom">
      <input id="brain-task-ctx-custom" type="text" inputmode="numeric" placeholder="mm:ss" value="${brainTaskFmt(t.dur)}" aria-label="Custom time, minutes:seconds">
      <button type="button" data-act="custom">Set</button>
    </div>`;
  if (typeof vizPositionMenu === 'function') vizPositionMenu(menu, e.clientX, e.clientY);
  else { menu.style.left = e.clientX + 'px'; menu.style.top = e.clientY + 'px'; menu.classList.remove('hidden'); }
}

function _btMenuClick(e) {
  const b = e.target.closest('button');
  const id = _btMenuNode;
  if (!b || !id) return;
  if (b.dataset.secs) { brainTaskSet([id], +b.dataset.secs); brainHideAllMenus(); return; }
  const a = b.dataset.act;
  if (a === 'custom') { _btMenuCustom(); return; }
  brainHideAllMenus();
  if (a === 'play') brainTaskPlay(id);
  else if (a === 'reset') brainTaskReset(id);
  else if (a === 'remove') brainTaskSet([id], null);
  else if (a === 'home') {
    const f = _btFind(id);
    if (f && f.n.task) { delete f.n.task.pos; _btCommit(f.live); brainTaskRepaint(id); }
  }
}

function _btMenuCustom() {
  const input = document.getElementById('brain-task-ctx-custom');
  const secs = brainTaskParse(input && input.value);
  if (secs == null) {
    if (input) { input.classList.add('is-bad'); setTimeout(() => input.classList.remove('is-bad'), 600); }
    return;
  }
  brainTaskSet([_btMenuNode], secs);
  brainHideAllMenus();
}

/* ── The pulse ────────────────────────────────────────────────── */

/** A dot runs once along the arrow (transform only, ~0.9 s), then goes. */
function brainTaskPulse(link, onArrive) {
  let arrived = false;
  const arrive = () => { if (arrived) return; arrived = true; if (onArrive) onArrive(); };
  const path = document.querySelector(`#viz-canvas-svg g.viz-link-group[data-link-id="${link.id}"] path.viz-link`);
  const layer = document.getElementById('viz-nodes-layer');
  if (!path || !layer || typeof path.getTotalLength !== 'function' || !document.body.contains(path)) { arrive(); return; }
  const len = path.getTotalLength();
  if (!len) { arrive(); return; }
  const frames = [];
  for (let i = 0; i <= 24; i++) {
    const p = path.getPointAtLength(len * i / 24);
    frames.push({ transform: `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`, opacity: i === 0 || i === 24 ? 0.6 : 1 });
  }
  const dot = document.createElement('div');
  dot.className = 'brain-task-pulse';
  dot.setAttribute('aria-hidden', 'true');
  layer.appendChild(dot);
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const anim = dot.animate(frames, { duration: reduce ? 1 : 900, easing: 'ease-in-out' });
  const end = () => { dot.remove(); arrive(); };
  anim.onfinish = end;
  anim.oncancel = end;
  setTimeout(end, 1500);   // a redraw that dropped the dot must not hold the arrival back
}

/* ── The chime ────────────────────────────────────────────────── */

/** Create (or wake) the audio context inside a click, so the chime may play later. */
function _btAudioWake() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!_btAudio) _btAudio = new Ctx();
    if (_btAudio.state === 'suspended') _btAudio.resume();
    return _btAudio;
  } catch (_) { return null; }
}

/** Three soft bell strikes rising over about three seconds, made here (no file). */
function brainTaskChime() {
  const ctx = _btAudioWake();
  if (!ctx) return;
  try {
    const t0 = ctx.currentTime + 0.03;
    const master = ctx.createGain();
    master.gain.value = 0.2;
    master.connect(ctx.destination);
    [[0, 783.99], [0.85, 987.77], [1.7, 1174.66]].forEach(([dt, f]) => {
      [[f, 1], [f * 2.0, 0.32], [f * 2.76, 0.12]].forEach(([freq, amp]) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        const s = t0 + dt;
        o.type = 'sine';
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, s);
        g.gain.exponentialRampToValueAtTime(amp, s + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, s + 1.25);
        o.connect(g);
        g.connect(master);
        o.start(s);
        o.stop(s + 1.3);
      });
    });
  } catch (_) { /* no sound is better than a broken timer */ }
}

/* ── The note menu's Task switch and timer ────────────────────── */

/** Task: on for every target note (25 min, or the last time you picked), or off. */
function brainCtxToggleTask() {
  const node = brain.contextNodeId && brain.nodes.find(n => n.id === brain.contextNodeId);
  if (!node) return;
  const targets = brainCtxTargets();
  if (node.task) brainTaskSet(targets.filter(n => n.task).map(n => n.id), null);
  else brainTaskSet(targets.filter(n => !n.task).map(n => n.id), _btLastDur());
  brainTaskSyncCtx(brain.nodes.find(n => n.id === brain.contextNodeId));   // the menu stays, showing the timer
}

/** A new time for every target task: it goes back to the start with that time. */
function brainCtxTaskDur(secs) {
  if (!(secs > 0)) return;
  const ids = brainCtxTargets().filter(n => n.task).map(n => n.id);
  brainTaskSet(ids, secs);
  brainTaskSyncCtx(brain.nodes.find(n => n.id === brain.contextNodeId));
}

function brainCtxTaskCustom() {
  const input = document.getElementById('brain-task-custom');
  const secs = brainTaskParse(input && input.value);
  if (secs == null) {
    if (input) { input.classList.add('is-bad'); setTimeout(() => input.classList.remove('is-bad'), 600); }
    return;
  }
  brainCtxTaskDur(secs);
  brainHideAllMenus();
}

/** The menu shows whether the note is a task, and its time. */
function brainTaskSyncCtx(node) {
  const btn = document.getElementById('brain-ctx-task-btn');
  const box = document.getElementById('brain-ctx-task');
  const portless = !!(node && node.shape && BRAIN_PORTLESS.has(node.shape));
  const on = !!(node && node.task);
  if (btn) {
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', String(on));
    btn.classList.toggle('hidden', portless);
    btn.title = on ? 'Make this a plain note again' : 'Make this a task with a countdown';
  }
  if (!box) return;
  box.classList.toggle('hidden', !on);
  if (!on) return;
  box.querySelectorAll('[data-secs]').forEach(b => b.classList.toggle('active', +b.dataset.secs === node.task.dur));
  const input = document.getElementById('brain-task-custom');
  if (input && document.activeElement !== input) input.value = brainTaskFmt(node.task.dur);
}

function brainTaskMenuHTML() {
  return `<div class="bnm-task hidden" id="brain-ctx-task">
    <div class="bnm-label">Timer</div>
    <div class="bnm-task-row" role="group" aria-label="Task time">
      ${BRAIN_TASK_PRESETS.map(m => `<button type="button" data-secs="${m * 60}" onclick="brainCtxTaskDur(${m * 60})">${m}m</button>`).join('')}
    </div>
    <div class="bnm-task-custom">
      <input id="brain-task-custom" type="text" inputmode="numeric" placeholder="mm:ss" aria-label="Custom time, minutes:seconds"
        onkeydown="if (event.key === 'Enter') { event.preventDefault(); brainCtxTaskCustom(); }">
      <button type="button" onclick="brainCtxTaskCustom()">Set</button>
    </div>
  </div>`;
}
