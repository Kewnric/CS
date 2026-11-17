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
  done: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>'
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
  n.task = { dur: n.task.dur, state: 'done' };
  n.checked = true;
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
    m.task = { dur: m.task.dur, state: 'running', endsAt: endAt + left * 1000 };
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
    n.task = { dur: durSecs, state: 'idle' };
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
  f.n.task = { dur: t.dur, state: 'running', endsAt: Date.now() + left * 1000 };
  if (t.state === 'done') delete f.n.checked;   // done and played again: a fresh run
  _btCommit(f.live);
  brainTaskRepaint(nodeId);
  _btSchedule();
}

function brainTaskPause(nodeId) {
  const f = _btFind(nodeId);
  if (!f || !f.n.task || f.n.task.state !== 'running') return;
  f.n.task = { dur: f.n.task.dur, state: 'paused', left: brainTaskLeft(f.n.task) };
  _btCommit(f.live);
  brainTaskRepaint(nodeId);
  _btSchedule();
}

function brainTaskReset(nodeId) {
  const f = _btFind(nodeId);
  if (!f || !f.n.task) return;
  const wasDone = f.n.task.state === 'done';
  f.n.task = { dur: f.n.task.dur, state: 'idle' };
  if (wasDone) delete f.n.checked;
  _btCommit(f.live);
  if (wasDone) brainRenderCanvas(); else brainTaskRepaint(nodeId);
  _btSchedule();
}

/** Checked by hand: the step is finished now, and the next one starts. */
function brainTaskFinishNow(node) {
  if (!node || !node.task || node.task.state === 'done') return [];
  const g = { nodes: brain.nodes, links: brain.links, live: true };
  node.task = { dur: node.task.dur, state: 'done' };
  const started = _btStartNext(g, node, Date.now());
  return started;
}

/** Unchecked by hand: a done task is ready to run again. */
function brainTaskUndone(node) {
  if (node && node.task && node.task.state === 'done') node.task = { dur: node.task.dur, state: 'idle' };
}

/* ── The pill ─────────────────────────────────────────────────── */

function brainTaskPillHTML(node) {
  const t = node.task;
  if (!t) return '';
  const left = brainTaskLeft(t);
  const frac = t.dur > 0 ? Math.min(1, left / t.dur) : 0;
  const running = t.state === 'running';
  const label = t.state === 'done' ? 'Done' : brainTaskFmt(left);
  const bar = running
    ? `<span class="bt-bar"><i style="--bt-from:${frac.toFixed(4)};animation-duration:${left.toFixed(2)}s"></i></span>`
    : `<span class="bt-bar"><i class="is-still" style="transform:scaleX(${frac.toFixed(4)})"></i></span>`;
  const playLabel = running ? 'Pause' : (t.state === 'paused' ? 'Resume' : (t.state === 'done' ? 'Run again' : 'Start'));
  return `<div class="brain-task" data-state="${t.state}" title="Task: ${brainTaskFmt(t.dur)}">${bar}`
    + `<span class="bt-ic">${t.state === 'done' ? _BT_SVG.done : _BT_SVG.timer}</span>`
    + `<span class="bt-time">${label}</span>`
    + `<button type="button" class="bt-play" title="${playLabel}" aria-label="${playLabel}">${running ? _BT_SVG.pause : _BT_SVG.play}</button>`
    + `<button type="button" class="bt-reset" title="Reset to ${brainTaskFmt(t.dur)}" aria-label="Reset">${_BT_SVG.reset}</button></div>`;
}

/** Put the pill on a rendered note (brainRenderCanvas) and wire its buttons. */
function brainTaskDecorate(el, node) {
  el.classList.toggle('is-task', !!node.task);
  if (!node.task) return;
  el.insertAdjacentHTML('beforeend', brainTaskPillHTML(node));
  _btBindPill(el.querySelector(':scope > .brain-task'), node.id);
  _btEnsureTick();
}

function _btBindPill(pill, nodeId) {
  if (!pill) return;
  // The pill is not the note: no drag, no editor, no selection.
  pill.addEventListener('pointerdown', e => e.stopPropagation());
  pill.addEventListener('dblclick', e => e.stopPropagation());
  pill.addEventListener('click', e => {
    e.stopPropagation();
    if (e.target.closest('.bt-reset')) brainTaskReset(nodeId);
    else if (e.target.closest('.bt-play')) brainTaskPlay(nodeId);
  });
}

/** Redraw one note's pill in place. */
function brainTaskRepaint(nodeId) {
  const el = document.querySelector(`#viz-nodes-layer > .viz-node[data-node-id="${nodeId}"]`);
  const node = brain.nodes.find(n => n.id === nodeId);
  if (!el || !node) return;
  const old = el.querySelector(':scope > .brain-task');
  if (old) old.remove();
  if (node.task) {
    el.insertAdjacentHTML('beforeend', brainTaskPillHTML(node));
    _btBindPill(el.querySelector(':scope > .brain-task'), nodeId);
  }
  el.classList.toggle('is-task', !!node.task);
  _btEnsureTick();
}

/** The digits: once a second, only while a running pill is on screen. */
function _btEnsureTick() {
  if (_btTick || !document.querySelector('.brain-task[data-state="running"]')) return;
  _btTick = setInterval(() => {
    const pills = document.querySelectorAll('#viz-nodes-layer .brain-task[data-state="running"]');
    if (!pills.length) { clearInterval(_btTick); _btTick = 0; return; }
    pills.forEach(p => {
      const el = p.parentElement;
      const n = el && brain.nodes.find(x => x.id === el.dataset.nodeId);
      const out = p.querySelector('.bt-time');
      if (n && n.task && out) {
        const txt = brainTaskFmt(brainTaskLeft(n.task));
        if (out.textContent !== txt) out.textContent = txt;
      }
    });
  }, 1000);
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
