/* ============================================================
   BRAIN DATES — when things were made and last changed
   ------------------------------------------------------------
   Kept on the records themselves, as epoch ms:
     notes     createdAt, updatedAt, checkedAt (task.startedAt / doneAt
               are kept by brain-tasks.js)
     canvases  createdAt, updatedAt, openedAt (openedAt was already there)
     folders   createdAt, updatedAt (made, renamed)
   A note's "last edited" moves on content only -- text, look, check,
   directory, its task's time -- never on moving or resizing it, nor on
   its timer running or being dragged. A canvas's moves on any change to
   its notes or links (moves included) and on a rename; never on pan or
   zoom. Notes are stamped in one place, brainSaveCurrentVersion, by
   comparing each note's content with the copy saved before, so every way
   of editing a note is covered without each one remembering to.
   Anything made before these dates were kept has none, and says so.

   On screen: a card when the pointer rests on a canvas or folder row, a
   dot on canvas rows edited today or this week, the dates at the foot of a
   note's menu, and the Activity panel (the history button in the Brain
   pane's header): 28 days of activity as bars, then everything made,
   edited or finished, newest first, by day. A click opens it.
   ============================================================ */

const BRAIN_SIG_SKIP = new Set(['x', 'y', 'w', 'h', 'userSized', 'collapsed', '_collapsedChildren',
  'createdAt', 'updatedAt', 'checkedAt']);
const BRAIN_EDIT_GAP_MS = 60000;   // an edit within a minute of making it is part of making it

/** What a note says and looks like, as one string: two notes with the same
 *  signature differ only in where they sit. */
function brainNoteSig(n) {
  const o = {};
  Object.keys(n).sort().forEach(k => { if (!BRAIN_SIG_SKIP.has(k)) o[k] = n[k]; });
  if (o.task) o.task = { dur: o.task.dur };   // its run and where its timer floats are not edits
  return JSON.stringify(o);
}

/**
 * Stamp the canvas being saved (brainSaveCurrentVersion): `nodes`/`links`
 * are about to replace `into.nodes`/`into.links`; `v` is the version (the
 * same object, or the one a directory's canvas belongs to).
 */
function brainDatesStamp(into, v, nodes, links) {
  if (!into || !v) return;
  const now = Date.now();
  const before = new Map((into.nodes || []).map(n => [n.id, n]));
  let changed = (into.nodes || []).length !== nodes.length;
  nodes.forEach(n => {
    const old = before.get(n.id);
    if (!old) {
      if (!n.createdAt) n.createdAt = now;
      if (!n.updatedAt) n.updatedAt = n.createdAt;
      changed = true;
      return;
    }
    if (brainNoteSig(old) !== brainNoteSig(n)) {
      n.updatedAt = now;
      changed = true;
      if (n.checked && !old.checked && !(n.checkedAt > (old.checkedAt || 0))) n.checkedAt = now;
    } else if (old.x !== n.x || old.y !== n.y || old.w !== n.w || old.h !== n.h) changed = true;
    if (!n.checked && n.checkedAt) delete n.checkedAt;
  });
  if (!changed && JSON.stringify(into.links || []) !== JSON.stringify(links || [])) changed = true;
  if (changed) v.updatedAt = now;
}

/** A canvas or folder is made now. */
function brainDatesNew(rec) {
  const now = Date.now();
  rec.createdAt = now;
  rec.updatedAt = now;
  return rec;
}

/* ── Saying when ─────────────────────────────────────────────── */

/** "just now", "5 min ago", "3 h ago", "yesterday", "4 days ago", "3 weeks ago", "Nov 2". */
function brainAgo(t) {
  if (!t) return '';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return Math.round(s / 60) + ' min ago';
  if (s < 86400 && new Date(t).getDate() === new Date().getDate()) return Math.round(s / 3600) + ' h ago';
  const days = Math.round((_brainDay(Date.now()) - _brainDay(t)) / 86400000);
  if (days <= 1) return 'yesterday';
  if (days < 7) return days + ' days ago';
  if (days < 35) return Math.round(days / 7) + (Math.round(days / 7) === 1 ? ' week ago' : ' weeks ago');
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: new Date(t).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}

/** Nov 18, 2026, 12:40 AM */
function brainWhen(t) {
  return t ? new Date(t).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
}

/** Midnight of that day, local time. */
function _brainDay(t) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const BRAIN_NO_DATE = 'Before dates were kept';

/* ── Records ─────────────────────────────────────────────────── */

/** Every note of a version: its own canvas and each directory's. */
function _brainAllNotes(v) {
  const out = (v.nodes || []).map(n => ({ n, dirId: null }));
  if (v.dirs && typeof v.dirs === 'object') {
    Object.keys(v.dirs).forEach(d => (v.dirs[d].nodes || []).forEach(n => out.push({ n, dirId: d })));
  }
  return out;
}

/** The version as it is now: the one on screen still has its live notes in brain.nodes. */
function _brainVersionStats(v) {
  const all = _brainAllNotes(v).map(x => x.n);
  const tasks = all.filter(n => n.task);
  return {
    notes: all.filter(n => !n.shape).length,
    tasks: tasks.length,
    done: tasks.filter(n => n.task.state === 'done').length,
    links: (v.links || []).length,
  };
}

/** Canvases in a folder and every folder under it. */
function _brainFolderVersions(fid) {
  const ids = new Set([fid]);
  let grew = true;
  while (grew) {
    grew = false;
    brain.folders.forEach(f => { if (f.parentId && ids.has(f.parentId) && !ids.has(f.id)) { ids.add(f.id); grew = true; } });
  }
  return brain.versions.filter(v => ids.has(v.folderId));
}

/** A note's name: its first line, short. */
function brainNoteName(n) {
  const line = String((n && n.commentContent) || '').split('\n').map(s => s.trim()).find(Boolean);
  const name = line || (n && n.shape ? (BRAIN_SHAPES.find(s => s[0] === n.shape) || [0, 'Object'])[1] : 'Empty note');
  return name.length > 48 ? name.slice(0, 47) + '…' : name;
}

/* ── Freshness dot on canvas rows ─────────────────────────────── */

function brainFreshDotHTML(v) {
  const t = v && v.updatedAt;
  if (!t) return '';
  const age = Date.now() - t;
  if (age < 86400000) return '<span class="brain-fresh is-today" aria-hidden="true"></span>';
  if (age < 7 * 86400000) return '<span class="brain-fresh is-week" aria-hidden="true"></span>';
  return '';
}

/* ── The card on a row ───────────────────────────────────────── */

let _brainCardTimer = 0;

function brainDatesHover(row, kind, id) {
  clearTimeout(_brainCardTimer);
  _brainCardTimer = setTimeout(() => _brainShowCard(row, kind, id), 380);
}

function brainDatesHoverEnd() {
  clearTimeout(_brainCardTimer);
  const card = document.getElementById('brain-date-card');
  if (card) card.classList.remove('is-on');
}

function _brainCardRow(icon, label, t, extra) {
  return `<div class="bdc-row"><span class="bdc-ic">${icon}</span><span class="bdc-k">${label}</span>`
    + (t ? `<span class="bdc-v"><b>${escapeHTML(brainAgo(t))}</b><small>${escapeHTML(brainWhen(t))}</small></span>`
      : `<span class="bdc-v is-none">${escapeHTML(extra || BRAIN_NO_DATE)}</span>`) + '</div>';
}

const _BD_SVG = {
  made: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  open: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
  done: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
  start: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12-7.5z" fill="currentColor"/></svg>',
  canvas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>',
  folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9l-.8-1.2A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>',
  note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5Z"/><path d="M15 3v6h6"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'
};

function _brainShowCard(row, kind, id) {
  if (!row || !row.isConnected) return;
  let html = '';
  if (kind === 'canvas') {
    const v = brain.versions.find(x => x.id === id);
    if (!v) return;
    const s = _brainVersionStats(v);
    html = `<div class="bdc-head"><span class="bdc-kind">${_BD_SVG.canvas}</span><b>${escapeHTML(v.name || 'Canvas')}</b></div>`
      + _brainCardRow(_BD_SVG.made, 'Created', v.createdAt)
      + _brainCardRow(_BD_SVG.edit, 'Last edited', v.updatedAt, 'Not since dates were kept')
      + _brainCardRow(_BD_SVG.open, 'Last opened', v.openedAt, 'Not yet')
      + `<div class="bdc-stats"><span>${s.notes} note${s.notes === 1 ? '' : 's'}</span><span>${s.links} link${s.links === 1 ? '' : 's'}</span>`
      + (s.tasks ? `<span class="is-task">${s.done}/${s.tasks} tasks done</span>` : '') + '</div>';
  } else {
    const f = brain.folders.find(x => x.id === id);
    if (!f) return;
    const vs = _brainFolderVersions(id);
    const inside = vs.reduce((m, v) => Math.max(m, v.updatedAt || 0), 0);
    html = `<div class="bdc-head"><span class="bdc-kind">${_BD_SVG.folder}</span><b>${escapeHTML(f.name || 'Folder')}</b></div>`
      + _brainCardRow(_BD_SVG.made, 'Created', f.createdAt)
      + _brainCardRow(_BD_SVG.edit, 'Last change inside', Math.max(inside, f.updatedAt || 0) || null, 'Nothing since dates were kept')
      + `<div class="bdc-stats"><span>${vs.length} canvas${vs.length === 1 ? '' : 'es'}</span></div>`;
  }
  let card = document.getElementById('brain-date-card');
  if (!card) {
    card = document.createElement('div');
    card.id = 'brain-date-card';
    card.className = 'brain-date-card';
    card.setAttribute('role', 'tooltip');
    document.body.appendChild(card);
  }
  card.innerHTML = html;
  const r = row.getBoundingClientRect();
  card.style.left = '0px';
  card.style.top = '0px';
  card.classList.add('is-on');
  const w = card.offsetWidth, h = card.offsetHeight;
  let x = r.right + 10, y = r.top - 6;
  if (x + w > innerWidth - 8) x = Math.max(8, r.left - w - 10);
  y = Math.max(8, Math.min(innerHeight - h - 8, y));
  card.style.left = Math.round(x) + 'px';
  card.style.top = Math.round(y) + 'px';
}

/* ── The note menu's foot ────────────────────────────────────── */

function brainDatesSyncCtx(node) {
  const box = document.getElementById('brain-ctx-dates');
  if (!box) return;
  if (!node) { box.innerHTML = ''; return; }
  const bits = [];
  bits.push(`<span title="${escapeHTML(brainWhen(node.createdAt))}">${_BD_SVG.made}Created <b>${node.createdAt ? escapeHTML(brainAgo(node.createdAt)) : 'before dates were kept'}</b></span>`);
  if (node.updatedAt && node.updatedAt - (node.createdAt || 0) > BRAIN_EDIT_GAP_MS) {
    bits.push(`<span title="${escapeHTML(brainWhen(node.updatedAt))}">${_BD_SVG.edit}Edited <b>${escapeHTML(brainAgo(node.updatedAt))}</b></span>`);
  }
  const t = node.task;
  if (t && t.doneAt) bits.push(`<span class="is-done" title="${escapeHTML(brainWhen(t.doneAt))}">${_BD_SVG.done}Done <b>${escapeHTML(brainAgo(t.doneAt))}</b></span>`);
  else if (t && t.startedAt) bits.push(`<span title="${escapeHTML(brainWhen(t.startedAt))}">${_BD_SVG.start}Started <b>${escapeHTML(brainAgo(t.startedAt))}</b></span>`);
  else if (node.checked && node.checkedAt) bits.push(`<span class="is-done" title="${escapeHTML(brainWhen(node.checkedAt))}">${_BD_SVG.done}Checked <b>${escapeHTML(brainAgo(node.checkedAt))}</b></span>`);
  box.innerHTML = bits.join('');
}

/* ── The Activity panel ──────────────────────────────────────── */

const BRAIN_ACTIVITY_DAYS = 28;
const BRAIN_ACTIVITY_MAX = 300;
let _brainActivityKind = 'all';

/** Everything made, edited or finished, newest first. */
function brainActivityEvents() {
  const out = [];
  const push = (e) => { if (e.t) out.push(e); };
  (brain.folders || []).forEach(f => {
    push({ kind: 'folder', verb: 'created', t: f.createdAt, id: f.id, name: f.name || 'Folder' });
    if (f.updatedAt && f.updatedAt - (f.createdAt || 0) > BRAIN_EDIT_GAP_MS) push({ kind: 'folder', verb: 'renamed', t: f.updatedAt, id: f.id, name: f.name || 'Folder' });
  });
  (brain.versions || []).forEach(v => {
    // The canvas on screen has its newest notes in brain.nodes; the saved copy
    // is written on every edit, so the version is current enough to list.
    push({ kind: 'canvas', verb: 'created', t: v.createdAt, vId: v.id, name: v.name || 'Canvas' });
    if (v.updatedAt && v.updatedAt - (v.createdAt || 0) > BRAIN_EDIT_GAP_MS) push({ kind: 'canvas', verb: 'edited', t: v.updatedAt, vId: v.id, name: v.name || 'Canvas' });
    const dirName = (dirId) => {
      if (!dirId) return '';
      const owner = _brainAllNotes(v).find(x => x.n.dirId === dirId);
      return owner ? brainNoteName(owner.n) : '';
    };
    _brainAllNotes(v).forEach(({ n, dirId }) => {
      const base = { kind: 'note', vId: v.id, dirId, id: n.id, name: brainNoteName(n), where: (v.name || 'Canvas') + (dirId ? ' › ' + dirName(dirId) : '') };
      push(Object.assign({ verb: 'created', t: n.createdAt }, base));
      if (n.updatedAt && n.updatedAt - (n.createdAt || 0) > BRAIN_EDIT_GAP_MS) push(Object.assign({ verb: 'edited', t: n.updatedAt }, base));
      if (n.task && n.task.doneAt) push(Object.assign({ verb: 'done', t: n.task.doneAt }, base));
      else if (n.checked && n.checkedAt) push(Object.assign({ verb: 'checked', t: n.checkedAt }, base));
    });
  });
  out.sort((a, b) => b.t - a.t);
  return out;
}

function brainActivityToggle(force) {
  const open = !!document.getElementById('brain-activity');
  const want = typeof force === 'boolean' ? force : !open;
  if (want === open) { if (want) brainActivityPaint(); return; }
  const body = document.getElementById('viz-content-body');
  const btn = document.getElementById('brain-activity-btn');
  if (!want) {
    document.getElementById('brain-activity').remove();
    if (body) body.classList.remove('hidden');
    if (btn) { btn.classList.remove('is-active'); btn.setAttribute('aria-pressed', 'false'); }
    return;
  }
  if (!body) return;
  const panel = document.createElement('section');
  panel.id = 'brain-activity';
  panel.className = 'brain-activity';
  panel.setAttribute('aria-label', 'Activity');
  body.classList.add('hidden');
  body.insertAdjacentElement('afterend', panel);
  if (btn) { btn.classList.add('is-active'); btn.setAttribute('aria-pressed', 'true'); }
  panel.addEventListener('click', _brainActivityClick);
  brainActivityPaint(true);
}

function brainActivityPaint(first) {
  const panel = document.getElementById('brain-activity');
  if (!panel) return;
  const all = brainActivityEvents();
  // 28 days of bars: how much was made or changed each day.
  const today = _brainDay(Date.now());
  const counts = new Array(BRAIN_ACTIVITY_DAYS).fill(0);
  all.forEach(e => {
    const back = Math.round((today - _brainDay(e.t)) / 86400000);
    if (back >= 0 && back < BRAIN_ACTIVITY_DAYS) counts[BRAIN_ACTIVITY_DAYS - 1 - back]++;
  });
  const peak = Math.max(1, ...counts);
  const total = counts.reduce((a, b) => a + b, 0);
  const made = all.filter(e => e.verb === 'created' && today - _brainDay(e.t) < BRAIN_ACTIVITY_DAYS * 86400000).length;
  const bars = counts.map((c, i) => {
    const day = new Date(today - (BRAIN_ACTIVITY_DAYS - 1 - i) * 86400000);
    const label = day.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) + ': ' + c + (c === 1 ? ' change' : ' changes');
    const h = c ? Math.max(0.12, c / peak) : 0.04;
    return `<span class="ba-bar${i === BRAIN_ACTIVITY_DAYS - 1 ? ' is-today' : ''}${c ? '' : ' is-zero'}" title="${escapeHTML(label)}"`
      + ` style="--h:${h.toFixed(3)};--i:${i}"></span>`;
  }).join('');
  const kinds = [['all', 'All'], ['canvas', 'Canvases'], ['note', 'Notes'], ['folder', 'Folders']];
  const shown = all.filter(e => _brainActivityKind === 'all' || e.kind === _brainActivityKind).slice(0, BRAIN_ACTIVITY_MAX);
  let list = '';
  let lastDay = null;
  shown.forEach((e, idx) => {
    const d = _brainDay(e.t);
    if (d !== lastDay) {
      lastDay = d;
      const diff = Math.round((today - d) / 86400000);
      const head = diff === 0 ? 'Today' : diff === 1 ? 'Yesterday'
        : new Date(d).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: new Date(d).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
      list += `<div class="ba-day">${escapeHTML(head)}</div>`;
    }
    const time = new Date(e.t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    list += `<button type="button" class="ba-item" data-i="${idx}" data-kind="${e.kind}" data-verb="${e.verb}" title="${escapeHTML(brainWhen(e.t))}">`
      + `<span class="ba-ic">${_BD_SVG[e.kind]}</span>`
      + `<span class="ba-main"><span class="ba-name">${escapeHTML(e.name)}</span>`
      + (e.where ? `<span class="ba-where">${escapeHTML(e.where)}</span>` : '') + '</span>'
      + `<span class="ba-verb">${escapeHTML(e.verb)}</span><span class="ba-time">${escapeHTML(time)}</span></button>`;
  });
  if (!list) list = `<div class="ba-empty">${_BD_SVG.edit}<p>Nothing here yet. What you make and change from now on shows up here, by day.</p></div>`;
  panel._events = shown;
  panel.innerHTML = `<div class="ba-head">
      <div><b>Activity</b><span>${total} change${total === 1 ? '' : 's'} · ${made} made · last ${BRAIN_ACTIVITY_DAYS} days</span></div>
      <button type="button" class="ba-close" data-act="close" title="Back to the canvases" aria-label="Close activity">${_BD_SVG.close}</button>
    </div>
    <div class="ba-bars${first ? ' is-new' : ''}" role="img" aria-label="Activity over the last ${BRAIN_ACTIVITY_DAYS} days">${bars}</div>
    <div class="ba-chips" role="tablist">${kinds.map(([k, l]) => `<button type="button" class="ba-chip${k === _brainActivityKind ? ' is-on' : ''}" data-kind="${k}" role="tab" aria-selected="${k === _brainActivityKind}">${l}</button>`).join('')}</div>
    <div class="ba-list">${list}</div>`;
}

function _brainActivityClick(e) {
  const panel = e.currentTarget;
  const close = e.target.closest('[data-act="close"]');
  if (close) { brainActivityToggle(false); return; }
  const chip = e.target.closest('.ba-chip');
  if (chip) { _brainActivityKind = chip.dataset.kind; brainActivityPaint(); return; }
  const item = e.target.closest('.ba-item');
  if (!item || !panel._events) return;
  const ev = panel._events[+item.dataset.i];
  if (!ev) return;
  panel.querySelectorAll('.ba-item.is-on').forEach(x => x.classList.remove('is-on'));
  item.classList.add('is-on');
  brainActivityGo(ev);
}

/** The directory notes to open, from the version's own canvas down to `dirId`. */
function _brainDirChain(v, dirId) {
  const chain = [];
  let want = dirId;
  for (let guard = 0; want && guard < 64; guard++) {
    const top = (v.nodes || []).find(n => n.dirId === want);
    if (top) { chain.unshift(top.id); return chain; }
    const holder = Object.keys(v.dirs || {}).find(d => (v.dirs[d].nodes || []).some(n => n.dirId === want));
    if (!holder) return null;
    chain.unshift(v.dirs[holder].nodes.find(n => n.dirId === want).id);
    want = holder;
  }
  return chain;
}

/** Open what an Activity line is about. */
function brainActivityGo(ev) {
  if (ev.kind === 'folder') {
    brainActivityToggle(false);
    if (typeof brainRevealFolder === 'function') brainRevealFolder(ev.id);
    return;
  }
  const v = brain.versions.find(x => x.id === ev.vId);
  if (!v) return;
  if (brain.activeVersionId !== v.id) brainSwitchVersion(v.id);
  else if (brain.dirPath.length && typeof brainDirGoTo === 'function') brainDirGoTo(0);
  if (ev.kind !== 'note') return;
  const chain = ev.dirId ? _brainDirChain(v, ev.dirId) : [];
  if (chain === null) return;
  chain.forEach(id => { if (typeof brainDirEnter === 'function') brainDirEnter(id); });
  const n = brain.nodes.find(x => x.id === ev.id);
  if (!n) return;
  // Centre it and light it up, the way an arriving task step does.
  const c = document.getElementById('viz-canvas-container');
  if (c) {
    if (typeof vizStopTween === 'function') vizStopTween();
    brain.pan.x = Math.round(c.clientWidth / 2 - (n.x + (n.w || 250) / 2) * brain.zoom);
    brain.pan.y = Math.round(c.clientHeight / 2 - (n.y + (n.h || 80) / 2) * brain.zoom);
  }
  brain.selectedNodeIds.clear();
  brain.selectedNodeId = n.id;
  brainRenderCanvas();
  const el = document.querySelector(`#viz-nodes-layer > .viz-node[data-node-id="${n.id}"]`);
  if (el) {
    el.classList.add('bt-arrive');
    setTimeout(() => el.classList.remove('bt-arrive'), 900);
  }
}
