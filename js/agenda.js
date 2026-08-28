/* ============================================================
   AGENDA.JS — deadlines, events, and the notification flag
   ------------------------------------------------------------
   Three things share one timeline here:

     deadlines — a date the user puts on a library item ("finish this by
                 Friday"). Stored per item, cleared per item.
     events    — free-standing entries that belong to no item at all
                 (an exam, a class, a reminder).
     reviews   — what the spaced-repetition scheduler in review.js already
                 considers due. Not owned here and never written to; it is
                 read so that "what is on my plate" is one list rather than
                 two places the user has to remember to check.

   Everything is keyed on a local 'YYYY-MM-DD' string, deliberately not on a
   Date or an ISO timestamp: a deadline of "the 30th" is the 30th wherever you
   open it, and toISOString() would quietly shift it a day for anyone west of
   UTC. Clock time is optional and kept beside the date as 'HH:MM'.
   ============================================================ */

/* ── Dates ────────────────────────────────────────────────── */

function agDateStr(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function agToday() { return agDateStr(new Date()); }

/** 'YYYY-MM-DD' → a Date at LOCAL midnight (never parsed as UTC). */
function agParseDate(s) {
  const p = String(s || '').split('-');
  if (p.length !== 3) return null;
  const d = new Date(+p[0], +p[1] - 1, +p[2]);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * The moment an entry comes due.
 * With no clock time this is the END of that day — an item dated today is not
 * overdue at 9am just because it has no time on it.
 */
function agTs(dateStr, time) {
  const d = agParseDate(dateStr);
  if (!d) return 0;
  if (time && /^\d{1,2}:\d{2}$/.test(time)) {
    const [h, m] = time.split(':');
    d.setHours(+h, +m, 0, 0);
  } else {
    d.setHours(23, 59, 59, 999);
  }
  return d.getTime();
}

function agDaysBetween(a, b) {
  const da = agParseDate(a), db = agParseDate(b);
  if (!da || !db) return 0;
  return Math.round((db - da) / 86400000);
}

const AG_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const AG_MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function agFmtDate(dateStr) {
  const d = agParseDate(dateStr);
  if (!d) return '';
  return AG_MONTHS_SHORT[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}

function agFmtTime(time) {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return h12 + ':' + String(m).padStart(2, '0') + ' ' + ampm;
}

/**
 * "in 3 days" / "in 4h 20m" / "2 days overdue".
 *
 * Granularity follows the entry: something set for a date only is answered in
 * days, because "in 14h" is a false precision for a deadline the user wrote
 * as "Friday".
 *
 * Today is the exception, and the reason is that "Today" is not an answer.
 * The one day you need the hours is the day the thing is actually due, so an
 * entry landing today drops to the clock and counts down to the end of it —
 * the same countdown a timed entry gets, from the same code below.
 */
function agTimeLeft(entry) {
  const now = Date.now();
  const ms = entry.ts - now;
  const past = ms < 0;
  const abs = Math.abs(ms);

  if (!entry.time) {
    const days = agDaysBetween(agToday(), entry.date);
    if (days === 1) return 'Tomorrow';
    if (days > 1) return 'in ' + days + ' days';
    if (days === -1) return '1 day overdue';
    if (days < -1) return Math.abs(days) + ' days overdue';
    // days === 0 falls through: ts is the end of today, so the clock below
    // reads as the hours and minutes left in the day.
  }

  const mins = Math.floor(abs / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  let out;
  if (days >= 1) out = days + 'd ' + (hours % 24) + 'h';
  else if (hours >= 1) out = hours + 'h ' + (mins % 60) + 'm';
  else if (mins >= 1) out = mins + 'm';
  else out = past ? 'just now' : 'under a minute';

  if (out === 'just now') return 'Just overdue';
  if (out === 'under a minute') return 'Due now';
  return past ? out + ' overdue' : 'in ' + out;
}

/* ── Store ────────────────────────────────────────────────── */

/**
 * state.deadlines is keyed "<type>:<id>" like state.review, so a deadline can
 * be hung on a snippet or a notebook later without reshaping anything.
 */
function agStore() {
  if (!state.deadlines || typeof state.deadlines !== 'object') state.deadlines = {};
  if (!Array.isArray(state.events)) state.events = [];
  return state;
}

function agDeadlineKey(type, id) { return type + ':' + id; }

function agGetDeadline(type, id) {
  agStore();
  return state.deadlines[agDeadlineKey(type, id)] || null;
}

function agSetDeadline(type, id, patch) {
  agStore();
  if (!type || !id || !patch || !patch.date) return null;
  const key = agDeadlineKey(type, id);
  const rec = {
    type, id,
    date: patch.date,
    time: patch.time || null,
    note: patch.note || '',
    createdAt: (state.deadlines[key] && state.deadlines[key].createdAt) || Date.now()
  };
  state.deadlines[key] = rec;
  saveData();
  agRefresh();
  return rec;
}

function agClearDeadline(type, id) {
  agStore();
  delete state.deadlines[agDeadlineKey(type, id)];
  saveData();
  agRefresh();
}

function agEvents() { agStore(); return state.events; }

function agSaveEvent(ev) {
  agStore();
  if (!ev || !ev.title || !ev.date) return null;
  if (ev.id) {
    const i = state.events.findIndex(e => e.id === ev.id);
    if (i > -1) { state.events[i] = Object.assign({}, state.events[i], ev); saveData(); agRefresh(); return state.events[i]; }
  }
  const rec = {
    id: generateId(),
    title: ev.title,
    date: ev.date,
    time: ev.time || null,
    kind: ev.kind || 'event',
    note: ev.note || '',
    createdAt: Date.now()
  };
  state.events.push(rec);
  saveData();
  agRefresh();
  return rec;
}

function agDeleteEvent(id) {
  agStore();
  const i = state.events.findIndex(e => e.id === id);
  if (i === -1) return;
  state.events.splice(i, 1);
  saveData();
  agRefresh();
}

/* ── Aggregation ──────────────────────────────────────────── */

const AG_KIND_META = {
  deadline: { icon: 'flag', label: 'Deadline', cls: 'ag-k-deadline' },
  event:    { icon: 'calendar', label: 'Event', cls: 'ag-k-event' },
  exam:     { icon: 'graduation-cap', label: 'Exam', cls: 'ag-k-exam' },
  reminder: { icon: 'bell', label: 'Reminder', cls: 'ag-k-reminder' },
  review:   { icon: 'repeat', label: 'Review', cls: 'ag-k-review' }
};

function agItemTitle(type, id) {
  const list = type === 'challenge' ? state.challenges
    : type === 'snippet' ? state.snippets
    : type === 'notebook' ? state.notebooks : null;
  if (!list) return null;
  const found = (list || []).find(x => x.id === id);
  return found ? (found.title || 'Untitled') : null;
}

/**
 * Every dated thing, in one list, sorted soonest first.
 *
 * A deadline whose item has been deleted is skipped rather than shown as a
 * ghost: the record is left in place so that undoing the deletion brings the
 * deadline back with it.
 */
function agEntries() {
  agStore();
  const out = [];
  const now = Date.now();

  Object.values(state.deadlines).forEach(d => {
    if (!d || !d.date) return;
    const title = agItemTitle(d.type, d.id);
    if (title === null) return;
    const ts = agTs(d.date, d.time);
    out.push({
      key: 'd:' + agDeadlineKey(d.type, d.id),
      kind: 'deadline', title, date: d.date, time: d.time || null, ts,
      note: d.note || '', sourceType: d.type, sourceId: d.id, overdue: ts < now
    });
  });

  state.events.forEach(e => {
    if (!e || !e.date) return;
    const ts = agTs(e.date, e.time);
    out.push({
      key: 'e:' + e.id,
      kind: e.kind || 'event', title: e.title, date: e.date, time: e.time || null, ts,
      note: e.note || '', sourceType: null, sourceId: e.id, overdue: ts < now, isEvent: true
    });
  });

  if (typeof getDueReviewItems === 'function') {
    getDueReviewItems().forEach(r => {
      const ts = agTs(r.due, null);
      out.push({
        key: 'r:' + r.type + ':' + r.id,
        kind: 'review', title: r.title, date: r.due, time: null, ts,
        note: '', sourceType: r.type, sourceId: r.id, overdue: r.daysOverdue > 0
      });
    });
  }

  out.sort((a, b) => a.ts - b.ts);
  return out;
}

function agEntriesOn(dateStr) {
  return agEntries().filter(e => e.date === dateStr);
}

/**
 * Overdue and due-today, which is what the flag's badge counts.
 *
 * Bucketed on the same test the rows are styled by — the moment it came due,
 * not the calendar day. An 18:00 event at 23:00 is overdue tonight, and
 * counting it as merely "due today" made the pills disagree with the list
 * sitting directly under them.
 */
function agCounts() {
  const today = agToday();
  const now = Date.now();
  let overdue = 0, dueToday = 0, upcoming = 0;
  agEntries().forEach(e => {
    if (e.ts < now) overdue++;
    else if (e.date === today) dueToday++;
    else upcoming++;
  });
  return { overdue, dueToday, upcoming, badge: overdue + dueToday };
}

/* ── The flag ─────────────────────────────────────────────── */

let agPanelOpen = false;
let agCalYear = new Date().getFullYear();
let agCalMonth = new Date().getMonth();
let agSelectedDay = null;   // null = show everything upcoming

function agMountFlag() {
  if (document.getElementById('ag-flag-root')) return;
  const root = document.createElement('div');
  root.id = 'ag-flag-root';
  root.className = 'ag-root';
  root.innerHTML = `
    <button class="ag-flag" id="ag-flag" type="button" onclick="agTogglePanel()"
            aria-haspopup="dialog" aria-expanded="false" aria-controls="ag-panel"
            title="Agenda — deadlines, events and what is due">
      <i data-lucide="bookmark" class="ag-flag-icon" aria-hidden="true"></i>
      <span class="ag-flag-count" id="ag-flag-count" hidden></span>
      <i data-lucide="chevron-down" class="ag-flag-pull" aria-hidden="true"></i>
    </button>
    <div class="ag-panel" id="ag-panel" role="dialog" aria-modal="false"
         aria-label="Agenda" hidden></div>`;
  document.body.appendChild(root);
  agPaintFlag();
  agStartTicker();
  if (typeof lucide !== 'undefined') lucide.createIcons({ root });

  // Clicking away closes it. Bound once, on the document, rather than a
  // full-screen backdrop: the panel is a dropdown, not a modal, and the rest
  // of the page should stay usable underneath it.
  document.addEventListener('mousedown', (e) => {
    if (!agPanelOpen) return;
    if (root.contains(e.target)) return;
    if (document.getElementById('ag-modal')) return;  // its own form is open
    agClosePanel();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && agPanelOpen && !document.getElementById('ag-modal')) agClosePanel();
  });
}

/** Badge only. Cheap enough to call after anything that changes the data. */
function agPaintFlag() {
  const el = document.getElementById('ag-flag-count');
  const flag = document.getElementById('ag-flag');
  if (!el || !flag) return;
  const c = agCounts();
  el.textContent = c.badge > 99 ? '99+' : String(c.badge);
  el.hidden = c.badge === 0;
  flag.classList.toggle('has-overdue', c.overdue > 0);
  flag.setAttribute('title', c.badge === 0
    ? 'Agenda — nothing due'
    : 'Agenda — ' + c.badge + ' due' + (c.overdue ? ' (' + c.overdue + ' overdue)' : ''));
}

/** Repaint whatever is currently on screen after a data change. */
function agRefresh() {
  agPaintFlag();
  if (agPanelOpen) agRenderPanel();
  // The program page shows its own deadline chip.
  if (typeof renderBrowseContent === 'function' && document.getElementById('browse-challenges-container')) {
    renderBrowseContent();
  }
}

function agTogglePanel() { agPanelOpen ? agClosePanel() : agOpenPanel(); }

function agOpenPanel() {
  const panel = document.getElementById('ag-panel');
  const flag = document.getElementById('ag-flag');
  if (!panel) return;
  agPanelOpen = true;
  panel.hidden = false;
  if (flag) flag.setAttribute('aria-expanded', 'true');
  document.getElementById('ag-flag-root').classList.add('is-open');
  // Always land on the month that actually has today in it, showing
  // everything. A day filter left over from last time meant the panel could
  // open on "Nothing on Aug 15" while three things were actually due.
  const now = new Date();
  agCalYear = now.getFullYear();
  agCalMonth = now.getMonth();
  agSelectedDay = null;
  agRenderPanel();
}

function agClosePanel() {
  const panel = document.getElementById('ag-panel');
  const flag = document.getElementById('ag-flag');
  agPanelOpen = false;
  if (panel) panel.hidden = true;
  if (flag) flag.setAttribute('aria-expanded', 'false');
  const root = document.getElementById('ag-flag-root');
  if (root) root.classList.remove('is-open');
}

let _agTicker = null;

function agStartTicker() {
  agStopTicker();
  _agTicker = setInterval(agTick, 60000);
}

function agStopTicker() {
  if (_agTicker) { clearInterval(_agTicker); _agTicker = null; }
}

/**
 * Keep every countdown honest, once a minute.
 *
 * Runs from mount rather than only while the panel is open, because the chip
 * on a program's own page now counts down too — a page you leave sitting for
 * an hour would otherwise still claim four hours left when there is one.
 *
 * Panel rows are patched in place rather than re-rendered: a full repaint
 * every minute would throw away the list's scroll position and blink the row
 * the pointer is on.
 */
function agTick() {
  agPaintFlag();
  const byKey = {};
  const entries = agEntries();
  entries.forEach(e => { byKey[e.key] = e; });

  const panel = document.getElementById('ag-panel');
  if (agPanelOpen && panel) {
    panel.querySelectorAll('.ag-row').forEach(row => {
      const e = byKey[row.getAttribute('data-ag-key')];
      if (!e) return;
      const chip = row.querySelector('.ag-row-left');
      if (chip) {
        chip.textContent = agTimeLeft(e);
        chip.classList.toggle('is-overdue', e.overdue);
      }
      row.classList.toggle('is-overdue', e.overdue);
    });
  }

  document.querySelectorAll('.ag-deadline-chip[data-ag-dl]').forEach(chip => {
    const [type, id] = chip.getAttribute('data-ag-dl').split(':');
    const d = agGetDeadline(type, id);
    if (!d) return;
    const entry = { date: d.date, time: d.time, ts: agTs(d.date, d.time) };
    const left = chip.querySelector('em');
    if (left) left.textContent = agTimeLeft(entry);
    chip.classList.toggle('is-overdue', entry.ts < Date.now());
  });
}

/* ── Panel ────────────────────────────────────────────────── */

function agRenderPanel() {
  const panel = document.getElementById('ag-panel');
  if (!panel) return;
  const c = agCounts();
  panel.innerHTML = `
    <div class="ag-head">
      <div class="ag-head-title">
        <i data-lucide="calendar-clock" aria-hidden="true"></i>
        <span>Agenda</span>
      </div>
      <div class="ag-head-sub">${escapeHTML(agFmtDate(agToday()))}</div>
      <button class="ag-icon-btn" onclick="agClosePanel()" type="button" aria-label="Close agenda">
        <i data-lucide="x" aria-hidden="true"></i>
      </button>
    </div>

    <div class="ag-quick">
      <button class="ag-quick-btn" type="button" onclick="agOpenEventModal()" title="Add an event">
        <i data-lucide="calendar-plus" aria-hidden="true"></i><span>Event</span>
      </button>
      <button class="ag-quick-btn" type="button" onclick="agClosePanel(); spaNavigate('library')" title="Set a deadline on a program">
        <i data-lucide="flag" aria-hidden="true"></i><span>Deadline</span>
      </button>
      <button class="ag-quick-btn" type="button" onclick="agClosePanel(); spaNavigate('quests')" title="Quest Board">
        <i data-lucide="scroll-text" aria-hidden="true"></i><span>Quests</span>
      </button>
      <button class="ag-quick-btn" type="button" onclick="agClosePanel(); spaNavigate('analytics')" title="Analytics">
        <i data-lucide="bar-chart-3" aria-hidden="true"></i><span>Stats</span>
      </button>
      <div class="ag-quick-spacer"></div>
      <div class="ag-quick-stat${c.overdue ? ' is-bad' : ''}" title="Overdue">
        <i data-lucide="alert-circle" aria-hidden="true"></i>${c.overdue}
      </div>
      <div class="ag-quick-stat${c.dueToday ? ' is-warn' : ''}" title="Due today">
        <i data-lucide="target" aria-hidden="true"></i>${c.dueToday}
      </div>
    </div>

    ${agCalendarHTML()}
    ${agListHTML()}
  `;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: panel });
}

function agCalendarHTML() {
  const today = agToday();
  const first = new Date(agCalYear, agCalMonth, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(agCalYear, agCalMonth + 1, 0).getDate();

  // One pass over the entries, bucketed by date, rather than a scan per cell.
  const byDate = {};
  agEntries().forEach(e => { (byDate[e.date] = byDate[e.date] || []).push(e); });

  let cells = '';
  for (let i = 0; i < startDow; i++) cells += '<div class="ag-cell is-blank"></div>';
  for (let day = 1; day <= daysInMonth; day++) {
    const ds = agCalYear + '-' + String(agCalMonth + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
    const list = byDate[ds] || [];
    const kinds = [];
    list.forEach(e => {
      const k = e.overdue ? 'overdue' : e.kind;
      if (kinds.indexOf(k) === -1) kinds.push(k);
    });
    const dots = kinds.slice(0, 3)
      .map(k => `<span class="ag-dot ag-dot-${k}"></span>`).join('');
    cells += `
      <button class="ag-cell${ds === today ? ' is-today' : ''}${ds === agSelectedDay ? ' is-selected' : ''}${list.length ? ' has-items' : ''}"
              type="button" onclick="agSelectDay('${ds}')"
              aria-label="${escapeHTML(agFmtDate(ds))}${list.length ? ', ' + list.length + ' item' + (list.length !== 1 ? 's' : '') : ''}"
              ${ds === agSelectedDay ? 'aria-pressed="true"' : ''}>
        <span class="ag-cell-num">${day}</span>
        <span class="ag-cell-dots">${dots}</span>
      </button>`;
  }

  return `
    <div class="ag-cal">
      <div class="ag-cal-head">
        <button class="ag-icon-btn" type="button" onclick="agCalShift(-1)" aria-label="Previous month">
          <i data-lucide="chevron-left" aria-hidden="true"></i>
        </button>
        <div class="ag-cal-month">${AG_MONTHS[agCalMonth]} ${agCalYear}</div>
        <button class="ag-icon-btn" type="button" onclick="agCalShift(1)" aria-label="Next month">
          <i data-lucide="chevron-right" aria-hidden="true"></i>
        </button>
        <button class="ag-today-btn" type="button" onclick="agCalToday()">Today</button>
      </div>
      <div class="ag-cal-dow">
        <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
      </div>
      <div class="ag-cal-grid">${cells}</div>
    </div>`;
}

function agListHTML() {
  const today = agToday();
  const showingDay = !!agSelectedDay;
  const all = agEntries();
  // Upcoming view keeps overdue items in it — the point of the list is what
  // still needs doing, and something a week late needs doing most of all.
  const list = showingDay ? all.filter(e => e.date === agSelectedDay) : all.filter(e => e.date >= today || e.overdue);

  const rows = list.map(e => {
    const meta = AG_KIND_META[e.kind] || AG_KIND_META.event;
    const left = agTimeLeft(e);
    const when = agFmtDate(e.date) + (e.time ? ' · ' + agFmtTime(e.time) : '');
    return `
      <div class="ag-row${e.overdue ? ' is-overdue' : ''}" data-ag-key="${e.key}">
        <div class="ag-row-kind ${meta.cls}" title="${meta.label}">
          <i data-lucide="${meta.icon}" aria-hidden="true"></i>
        </div>
        <button class="ag-row-main" type="button" onclick="agGoToEntry('${e.key}')"
                title="${e.sourceType ? 'Open this item' : 'Edit this event'}">
          <span class="ag-row-title">${escapeHTML(e.title)}</span>
          <span class="ag-row-when">${escapeHTML(when)}${e.note ? ' · ' + escapeHTML(e.note) : ''}</span>
        </button>
        <span class="ag-row-left${e.overdue ? ' is-overdue' : ''}">${escapeHTML(left)}</span>
        ${e.kind === 'review' ? '' : `
        <button class="ag-icon-btn ag-row-del" type="button" onclick="agRemoveEntry('${e.key}')"
                aria-label="Remove" title="${e.isEvent ? 'Delete this event' : 'Clear this deadline'}">
          <i data-lucide="trash-2" aria-hidden="true"></i>
        </button>`}
      </div>`;
  }).join('');

  const emptyMsg = showingDay
    ? 'Nothing on ' + agFmtDate(agSelectedDay) + '.'
    : 'Nothing due. Set a deadline on a program, or add an event.';

  return `
    <div class="ag-list-head">
      <span class="ag-list-title">
        ${showingDay ? escapeHTML(agFmtDate(agSelectedDay)) : 'Due &amp; upcoming'}
      </span>
      ${showingDay ? `<button class="ag-link-btn" type="button" onclick="agSelectDay(null)">Show all</button>` : ''}
      <span class="ag-list-count">${list.length}</span>
    </div>
    <div class="ag-list">
      ${rows || `<div class="ag-empty"><i data-lucide="calendar-check" aria-hidden="true"></i><span>${escapeHTML(emptyMsg)}</span></div>`}
    </div>
    <div class="ag-foot">
      <button class="btn btn-secondary btn-sm" type="button" onclick="agOpenEventModal()">
        <i data-lucide="plus" style="width:14px;height:14px;" aria-hidden="true"></i> Add event
      </button>
    </div>`;
}

function agCalShift(delta) {
  agCalMonth += delta;
  while (agCalMonth < 0) { agCalMonth += 12; agCalYear--; }
  while (agCalMonth > 11) { agCalMonth -= 12; agCalYear++; }
  agRenderPanel();
}

function agCalToday() {
  const now = new Date();
  agCalYear = now.getFullYear();
  agCalMonth = now.getMonth();
  agSelectedDay = agToday();
  agRenderPanel();
}

/** Clicking the selected day again clears the filter rather than doing nothing. */
function agSelectDay(dateStr) {
  agSelectedDay = (dateStr && dateStr !== agSelectedDay) ? dateStr : null;
  agRenderPanel();
}

function agFindEntry(key) { return agEntries().find(e => e.key === key) || null; }

/**
 * Go to a route that may be the one already on screen.
 *
 * spaNavigate only assigns location.hash, and assigning the hash it already
 * holds fires no hashchange — so the router never re-runs and the page does
 * not move. Every other caller of these routes navigates from somewhere else,
 * so it never came up; the agenda opens over whatever page you are on, and
 * clicking a program row from the Library did nothing at all. Re-firing the
 * event puts the router through its normal cycle, which re-reads the session
 * param the caller just set.
 */
function agNavigateEvenIfHere(route, go) {
  if (document.body.dataset.route === route) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    go();
  }
}

function agGoToEntry(key) {
  const e = agFindEntry(key);
  if (!e) return;
  if (e.isEvent) { agOpenEventModal(e.sourceId); return; }
  agClosePanel();
  if (e.sourceType === 'challenge') {
    setSessionParam('browseActiveProgram', e.sourceId);
    agNavigateEvenIfHere('browse', () => spaNavigate('browse'));
  } else if (e.sourceType === 'snippet') {
    setSessionParam('activeSnippetId', e.sourceId);
    agNavigateEvenIfHere('snippets', () => spaNavigate('snippets'));
  } else if (e.sourceType === 'notebook') {
    setSessionParam('activeNotebook', e.sourceId);
    agNavigateEvenIfHere('study', () => spaNavigate('study'));
  }
}

function agRemoveEntry(key) {
  const e = agFindEntry(key);
  if (!e) return;
  if (e.isEvent) agDeleteEvent(e.sourceId);
  else if (e.kind === 'deadline') agClearDeadline(e.sourceType, e.sourceId);
}

/* ── Forms ────────────────────────────────────────────────── */

function agCloseModal() {
  const m = document.getElementById('ag-modal');
  if (m) m.remove();
}

function agModalShell(title, icon, bodyHtml, footHtml) {
  agCloseModal();
  const wrap = document.createElement('div');
  wrap.id = 'ag-modal';
  wrap.className = 'modal-overlay';
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-modal', 'true');
  wrap.onclick = (e) => { if (e.target === wrap) agCloseModal(); };
  wrap.innerHTML = `
    <div class="modal-content ag-modal-content">
      <div class="ag-modal-head">
        <h2 class="modal-title ag-modal-title"><i data-lucide="${icon}" aria-hidden="true"></i> ${title}</h2>
        <button class="ag-icon-btn" type="button" onclick="agCloseModal()" aria-label="Close">
          <i data-lucide="x" aria-hidden="true"></i>
        </button>
      </div>
      <div class="ag-form">${bodyHtml}</div>
      <div class="modal-actions ag-modal-actions">${footHtml}</div>
    </div>`;
  document.body.appendChild(wrap);
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: wrap });
  const first = wrap.querySelector('input, select, textarea');
  if (first) setTimeout(() => first.focus(), 30);
  wrap.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); agCloseModal(); }
  });
  return wrap;
}

/** Set / change / clear the deadline on one library item. */
function agOpenDeadlineModal(type, id) {
  const title = agItemTitle(type, id);
  if (title === null) return;
  const cur = agGetDeadline(type, id);
  const today = agToday();

  agModalShell(cur ? 'Change deadline' : 'Set deadline', 'flag', `
    <p class="ag-form-lead">${escapeHTML(title)}</p>
    <div class="ag-form-row">
      <label class="form-label" for="ag-dl-date">Due date</label>
      <input type="date" id="ag-dl-date" class="form-input" value="${escapeHTML(cur ? cur.date : today)}" min="1970-01-01">
    </div>
    <div class="ag-form-row">
      <label class="form-label" for="ag-dl-time">Time <span class="ag-optional">optional</span></label>
      <input type="time" id="ag-dl-time" class="form-input" value="${escapeHTML(cur && cur.time ? cur.time : '')}">
      <span class="ag-form-hint">Without a time it is due by the end of that day.</span>
    </div>
    <div class="ag-form-row">
      <label class="form-label" for="ag-dl-note">Note <span class="ag-optional">optional</span></label>
      <input type="text" id="ag-dl-note" class="form-input" maxlength="120"
             placeholder="Why this date?" value="${escapeHTML(cur ? cur.note : '')}">
    </div>
    <div class="ag-quickdates">
      <button type="button" class="ag-chip" onclick="agQuickDate(0)">Today</button>
      <button type="button" class="ag-chip" onclick="agQuickDate(1)">Tomorrow</button>
      <button type="button" class="ag-chip" onclick="agQuickDate(3)">In 3 days</button>
      <button type="button" class="ag-chip" onclick="agQuickDate(7)">In a week</button>
    </div>
  `, `
    ${cur ? `<button class="btn btn-ghost ag-danger-btn" type="button" onclick="agSubmitDeadline('${type}','${id}',true)">
      <i data-lucide="trash-2" style="width:15px;height:15px;" aria-hidden="true"></i> Clear
    </button>` : ''}
    <button class="btn btn-secondary" type="button" onclick="agCloseModal()">Cancel</button>
    <button class="btn btn-primary" type="button" onclick="agSubmitDeadline('${type}','${id}',false)">
      <i data-lucide="check" style="width:15px;height:15px;" aria-hidden="true"></i> ${cur ? 'Update' : 'Set deadline'}
    </button>
  `);
}

/** The quick chips write into whichever date field the open form has. */
function agQuickDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const input = document.getElementById('ag-dl-date') || document.getElementById('ag-ev-date');
  if (input) input.value = agDateStr(d);
}

function agSubmitDeadline(type, id, clear) {
  if (clear) {
    agClearDeadline(type, id);
    agCloseModal();
    agToast('Deadline cleared');
    return;
  }
  const date = (document.getElementById('ag-dl-date') || {}).value || '';
  if (!date) {
    agToast('Pick a date first', 'error');
    return;
  }
  agSetDeadline(type, id, {
    date,
    time: (document.getElementById('ag-dl-time') || {}).value || null,
    note: ((document.getElementById('ag-dl-note') || {}).value || '').trim()
  });
  agCloseModal();
  agToast('Deadline set for ' + agFmtDate(date));
}

/** New or existing free-standing event. */
function agOpenEventModal(eventId) {
  const ev = eventId ? agEvents().find(e => e.id === eventId) : null;
  const date = ev ? ev.date : (agSelectedDay || agToday());
  const kinds = [
    ['event', 'Event'],
    ['exam', 'Exam'],
    ['reminder', 'Reminder']
  ];

  agModalShell(ev ? 'Edit event' : 'Add event', 'calendar-plus', `
    <div class="ag-form-row">
      <label class="form-label" for="ag-ev-title">Title</label>
      <input type="text" id="ag-ev-title" class="form-input" maxlength="120"
             placeholder="Midterm, study group, submission…" value="${escapeHTML(ev ? ev.title : '')}">
    </div>
    <div class="ag-form-grid">
      <div class="ag-form-row">
        <label class="form-label" for="ag-ev-date">Date</label>
        <input type="date" id="ag-ev-date" class="form-input" value="${escapeHTML(date)}">
      </div>
      <div class="ag-form-row">
        <label class="form-label" for="ag-ev-time">Time <span class="ag-optional">optional</span></label>
        <input type="time" id="ag-ev-time" class="form-input" value="${escapeHTML(ev && ev.time ? ev.time : '')}">
      </div>
    </div>
    <div class="ag-form-row">
      <label class="form-label" for="ag-ev-kind">Type</label>
      <select id="ag-ev-kind" class="form-select">
        ${kinds.map(([v, l]) => `<option value="${v}"${ev && ev.kind === v ? ' selected' : ''}>${l}</option>`).join('')}
      </select>
    </div>
    <div class="ag-form-row">
      <label class="form-label" for="ag-ev-note">Note <span class="ag-optional">optional</span></label>
      <input type="text" id="ag-ev-note" class="form-input" maxlength="160"
             placeholder="Room, chapter, anything" value="${escapeHTML(ev ? ev.note : '')}">
    </div>
    <div class="ag-quickdates">
      <button type="button" class="ag-chip" onclick="agQuickDate(0)">Today</button>
      <button type="button" class="ag-chip" onclick="agQuickDate(1)">Tomorrow</button>
      <button type="button" class="ag-chip" onclick="agQuickDate(7)">In a week</button>
    </div>
  `, `
    ${ev ? `<button class="btn btn-ghost ag-danger-btn" type="button" onclick="agSubmitEvent('${ev.id}',true)">
      <i data-lucide="trash-2" style="width:15px;height:15px;" aria-hidden="true"></i> Delete
    </button>` : ''}
    <button class="btn btn-secondary" type="button" onclick="agCloseModal()">Cancel</button>
    <button class="btn btn-primary" type="button" onclick="agSubmitEvent('${ev ? ev.id : ''}',false)">
      <i data-lucide="check" style="width:15px;height:15px;" aria-hidden="true"></i> ${ev ? 'Save' : 'Add event'}
    </button>
  `);
}

function agSubmitEvent(eventId, del) {
  if (del) {
    agDeleteEvent(eventId);
    agCloseModal();
    agToast('Event deleted');
    return;
  }
  const title = ((document.getElementById('ag-ev-title') || {}).value || '').trim();
  const date = (document.getElementById('ag-ev-date') || {}).value || '';
  if (!title) { agToast('Give the event a title', 'error'); return; }
  if (!date) { agToast('Pick a date first', 'error'); return; }
  agSaveEvent({
    id: eventId || null,
    title,
    date,
    time: (document.getElementById('ag-ev-time') || {}).value || null,
    kind: (document.getElementById('ag-ev-kind') || {}).value || 'event',
    note: ((document.getElementById('ag-ev-note') || {}).value || '').trim()
  });
  agCloseModal();
  agToast(eventId ? 'Event saved' : 'Event added');
}

/* ── Chip used on the program page ────────────────────────── */

/** The deadline as it appears inline on an item's own page. '' when unset. */
function agDeadlineChipHTML(type, id) {
  const d = agGetDeadline(type, id);
  if (!d) return '';
  const entry = { date: d.date, time: d.time, ts: agTs(d.date, d.time) };
  const overdue = entry.ts < Date.now();
  return `
    <span class="ag-deadline-chip${overdue ? ' is-overdue' : ''}" data-ag-dl="${type}:${id}"
          title="${escapeHTML(d.note || 'Deadline')}">
      <i data-lucide="flag" style="width:12px;height:12px;" aria-hidden="true"></i>
      ${escapeHTML(agFmtDate(d.date))}${d.time ? ' · ' + escapeHTML(agFmtTime(d.time)) : ''}
      <em>${escapeHTML(agTimeLeft(entry))}</em>
    </span>`;
}

/** Thin wrapper: the toast layer is optional chrome, never a hard dependency. */
function agToast(msg, type) {
  if (typeof window.toast === 'function') window.toast(msg, { type: type || 'success' });
}

/* ── Boot ─────────────────────────────────────────────────── */

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', agMountFlag);
} else {
  agMountFlag();
}
