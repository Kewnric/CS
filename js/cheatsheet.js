/* ============================================================
   CHEATSHEET.JS — the Cheat Sheet Library.
   ------------------------------------------------------------
   Your own reference book, not generated from anything else. A
   sheet is a notebook: named, tagged, paginated, and made of
   blocks — key terms, code you keep for reference (never run),
   prose, tables, images, links — plus sticky notes you can drop
   anywhere on the page.

   It lives in its own store so nothing here can disturb the
   Coding/Notes/Snippet libraries, and it is reachable two ways:
   its own route, and the cheat-sheet toggle inside an attempt
   (which opens the same sheets read-only).
   ============================================================ */

const CS_KEY = 'cheatsheetLibrary';
const CS_PAGE = 15;                 // cards per page, same as everywhere else

const cs = {
  sheets: [],
  openId: null,
  pageIdx: 0,
  page: 1,          // library pagination
  query: '',
  tag: '',
  sort: 'recent',
  view: 'grid',      // 'grid' | 'list'
  study: false,      // key-terms definitions hidden until clicked
  jump: null,        // {sheetId, page, blockId} from a search hit
  readOnly: false,  // true when opened from inside an attempt
  _host: null       // where to render (route pane, or #cheat-body)
};

const csNL = String.fromCharCode(10);   // newline, spelled out

function csEsc(s) { return typeof escapeHTML === 'function' ? escapeHTML(String(s)) : String(s); }
function csId(p) { return p + '_' + (typeof generateId === 'function' ? generateId() : Math.random().toString(36).slice(2)); }

function csLoad() {
  try { const v = localStorage.getItem('csView'); if (v === 'list' || v === 'grid') cs.view = v; } catch (e) { /* none */ }
  try {
    const raw = JSON.parse(localStorage.getItem(CS_KEY));
    cs.sheets = (raw && raw.sheets) || [];
  } catch (e) { cs.sheets = []; }
}

function csSave() {
  try { localStorage.setItem(CS_KEY, JSON.stringify({ sheets: cs.sheets })); }
  catch (e) {
    // A silent failure here loses written notes, which is the worst thing this
    // file could do quietly.
    if (typeof toast === 'function') toast('Could not save — browser storage is full.', { type: 'error', duration: 10000 });
    return;
  }
  if (typeof scheduleCloudSave === 'function') scheduleCloudSave();
}

/* ── Model ─────────────────────────────────────────────────── */

const CS_BLOCKS = {
  terms: { icon: 'list', label: 'Key terms' },
  code: { icon: 'code-2', label: 'Code' },
  text: { icon: 'align-left', label: 'Note' },
  check: { icon: 'check-square', label: 'Checklist' },
  callout: { icon: 'megaphone', label: 'Callout' },
  table: { icon: 'table', label: 'Table' },
  image: { icon: 'image', label: 'Image' },
  link: { icon: 'link', label: 'Link' }
};

const CS_CALLOUTS = {
  note: { icon: 'info', label: 'Note' },
  tip: { icon: 'lightbulb', label: 'Tip' },
  warn: { icon: 'alert-triangle', label: 'Warning' },
  danger: { icon: 'octagon-alert', label: 'Careful' }
};

function csNewBlock(type) {
  const b = { id: csId('b'), type };
  if (type === 'terms') b.rows = [{ term: '', def: '' }];
  if (type === 'code') { b.code = ''; b.lang = 'c'; b.caption = ''; b.name = ''; }
  if (type === 'text') b.text = '';
  if (type === 'table') b.cells = [['', ''], ['', '']];
  if (type === 'image') { b.src = ''; b.caption = ''; }
  if (type === 'link') { b.url = ''; b.label = ''; }
  if (type === 'check') b.items = [{ text: '', done: false }];
  if (type === 'callout') { b.kind = 'note'; b.text = ''; }
  return b;
}

function csNewPage(name) {
  return { id: csId('p'), name: name || 'Page 1', blocks: [], notes: [] };
}

function csCreate(title) {
  const sheet = {
    id: csId('cs'), title: title || 'Untitled sheet', tags: [], icon: 'book-marked', color: '',
    pinned: false, programId: null, history: [],
    pages: [csNewPage('Page 1')], createdAt: Date.now(), updatedAt: Date.now()
  };
  cs.sheets.unshift(sheet);
  csSave();
  return sheet;
}

function csSheet(id) { return cs.sheets.find(s => s.id === id) || null; }
function csOpenSheet() { return csSheet(cs.openId); }
function csPage() {
  const s = csOpenSheet();
  if (!s) return null;
  return s.pages[Math.min(cs.pageIdx, s.pages.length - 1)] || null;
}
function csTouch() { const s = csOpenSheet(); if (s) s.updatedAt = Date.now(); csSave(); }

function csAllTags() {
  const t = new Set();
  cs.sheets.forEach(s => (s.tags || []).forEach(x => t.add(x)));
  return [...t].sort();
}

/** The filtered, sorted library list. */
function csFiltered() {
  const q = (cs.query || '').trim().toLowerCase();
  let list = cs.sheets.filter(s => {
    if (cs.tag && !(s.tags || []).includes(cs.tag)) return false;
    if (!q) return true;
    if ((s.title || '').toLowerCase().includes(q)) return true;
    if ((s.tags || []).some(t => t.toLowerCase().includes(q))) return true;
    // search inside the sheet, which is the point of a reference book
    return csHits(s, q).length > 0;
  });
  const by = cs.sort === 'title'
    ? (a, b) => (a.title || '').localeCompare(b.title || '')
    : cs.sort === 'created' ? (a, b) => b.createdAt - a.createdAt
      : (a, b) => b.updatedAt - a.updatedAt;
  // Pinned sheets lead whatever ordering is chosen.
  return list.slice().sort((a, b) => (!!b.pinned - !!a.pinned) || by(a, b));
}

/**
 * Where a query actually matches inside a sheet.
 * Search filtered the card list and stopped there, so finding "the sheet that
 * mentions malloc" still left you hunting through its pages by hand.
 * @returns {Array<{page:number,pageName:string,blockId:string,type:string,snippet:string}>}
 */
function csHits(sheet, q) {
  if (!q) return [];
  const out = [];
  (sheet.pages || []).forEach((pg, pi) => {
    (pg.blocks || []).forEach(b => {
      const text = csBlockText(b);
      const at = text.toLowerCase().indexOf(q);
      if (at === -1) return;
      const from = Math.max(0, at - 28);
      out.push({
        page: pi, pageName: pg.name, blockId: b.id, type: b.type,
        snippet: (from ? '…' : '') + text.slice(from, at + q.length + 40).replace(/\s+/g, ' ')
      });
    });
  });
  return out;
}

/** Every searchable string in a block, without the JSON scaffolding. */
function csBlockText(b) {
  switch (b.type) {
    case 'terms': return (b.rows || []).map(r => r.term + ' ' + r.def).join(' ');
    case 'code': return [b.name, b.code, b.caption].filter(Boolean).join(' ');
    case 'text': case 'callout': return b.text || '';
    case 'check': return (b.items || []).map(i => i.text).join(' ');
    case 'table': return (b.cells || []).map(r => r.join(' ')).join(' ');
    case 'image': return b.caption || '';
    case 'link': return [b.label, b.url].filter(Boolean).join(' ');
    default: return '';
  }
}

window.csJumpTo = function (sheetId, page, blockId) {
  cs.openId = sheetId;
  cs.pageIdx = page;
  cs.jump = { sheetId, page, blockId };
  csRender();
  setTimeout(() => {
    const el = document.querySelector(`.cs-block[data-bid="${blockId}"]`);
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    // The highlight is a cue, not a state - it fades once you have seen it.
    setTimeout(() => { cs.jump = null; if (el) el.classList.remove('cs-hit'); }, 2400);
  }, 60);
};

function csCountBlocks(s) {
  return (s.pages || []).reduce((n, p) => n + (p.blocks || []).length, 0);
}

/** A stable cover gradient per sheet, so cards are told apart at a glance. */
function csCover(sheet) {
  // Dark and blue-leaning, so a wall of covers sits with the app instead of
  // shouting over it. The first palette had a mint-to-cyan pair that looked
  // like a highlighter next to everything else.
  const PAIRS = [
    ['#1e3a8a', '#0e7490'], ['#312e81', '#1e40af'], ['#0c4a6e', '#155e75'],
    ['#1e293b', '#334e68'], ['#3730a3', '#0891b2'], ['#164e63', '#1e3a8a']
  ];
  if (sheet.color) return [sheet.color, sheet.color];
  let h = 0;
  const id = String(sheet.id || '');
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PAIRS[h % PAIRS.length];
}

/** What a sheet actually contains, for the card badges. */
function csKinds(sheet) {
  const n = {};
  (sheet.pages || []).forEach(p => (p.blocks || []).forEach(b => { n[b.type] = (n[b.type] || 0) + 1; }));
  return Object.keys(n).map(t => ({ type: t, n: n[t], icon: (CS_BLOCKS[t] || {}).icon || 'square' }));
}


/* ── Revision history ──────────────────────────────────────────
   These are hand-written notes; a bad paste had no way back. Ten snapshots is
   enough to undo a bad session without turning localStorage into an archive. */
const CS_HISTORY_MAX = 10;

function csSnapshot(reason) {
  const s = csOpenSheet();
  if (!s) return;
  s.history = s.history || [];
  const last = s.history[s.history.length - 1];
  const body = JSON.stringify(s.pages);
  if (last && last.body === body) return;          // nothing actually changed
  s.history.push({ ts: Date.now(), reason: reason || 'edit', body });
  if (s.history.length > CS_HISTORY_MAX) s.history.shift();
}

window.csOpenHistory = function () {
  const s = csOpenSheet();
  if (!s || !(s.history || []).length) {
    if (typeof toast === 'function') toast('No earlier versions yet.', { type: 'info' });
    return;
  }
  const rows = s.history.slice().reverse().map((h, i) => {
    const n = s.history.length - 1 - i;
    const pages = JSON.parse(h.body).length;
    return `<button class="cs-hist-row" onclick="csRestore(${n})">
        <span>${new Date(h.ts).toLocaleString()}</span>
        <span class="cs-hist-meta">${pages} page${pages !== 1 ? 's' : ''} \u00b7 ${csEsc(h.reason)}</span>
      </button>`;
  }).join('');
  const ov = document.createElement('div');
  ov.className = 'modal-overlay fd-overlay';
  ov.id = 'cs-hist-dlg';
  ov.innerHTML = `<div class="modal-content fd-box" role="dialog" aria-label="Version history">
      <h3 class="fd-title"><i data-lucide="history"></i> Version history</h3>
      <div class="cs-hist">${rows}</div>
      <div class="fd-actions"><button class="btn btn-secondary btn-sm" onclick="document.getElementById('cs-hist-dlg').remove()">Close</button></div>
    </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: ov });
};

window.csRestore = function (i) {
  const s = csOpenSheet();
  const h = (s.history || [])[i];
  if (!h) return;
  showConfirm('Restore this version?', 'The current contents are saved as a version first, so this is reversible.', () => {
    csSnapshot('before restore');
    s.pages = JSON.parse(h.body);
    cs.pageIdx = 0;
    csSave();
    const dlg = document.getElementById('cs-hist-dlg');
    if (dlg) dlg.remove();
    csRender();
  });
};

/* ── Markdown ──────────────────────────────────────────────────
   Notes were plain text, which made a long one unskimmable. A deliberately
   small subset: bold, italic, inline code, links, and - or 1. lists. */
function csMarkdown(src) {
  const esc = csEsc(String(src || ''));
  const lines = esc.split(csNL);
  let out = '', list = null;
  const inline = (t) => t
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  const close = () => { if (list) { out += '</' + list + '>'; list = null; } };
  lines.forEach(raw => {
    const t = raw.trim();
    let m;
    if ((m = t.match(/^[-*]\s+(.*)$/))) {
      if (list !== 'ul') { close(); out += '<ul>'; list = 'ul'; }
      out += '<li>' + inline(m[1]) + '</li>';
    } else if ((m = t.match(/^\d+[.)]\s+(.*)$/))) {
      if (list !== 'ol') { close(); out += '<ol>'; list = 'ol'; }
      out += '<li>' + inline(m[1]) + '</li>';
    } else if (!t) {
      close();
    } else {
      close();
      out += '<p>' + inline(t) + '</p>';
    }
  });
  close();
  return out;
}

/* ── Images ────────────────────────────────────────────────────
   Stored as data URIs, so a couple of phone screenshots could fill the whole
   quota. Downscaled on the way in rather than warned about afterwards. */
const CS_IMG_MAX = 1400;

function csReadImageScaled(file, done) {
  const r = new FileReader();
  r.onload = () => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, CS_IMG_MAX / Math.max(img.width, img.height));
      if (scale === 1 && r.result.length < 400000) { done(r.result); return; }
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      let out;
      try { out = c.toDataURL('image/jpeg', 0.82); } catch (e) { out = r.result; }
      done(out.length < r.result.length ? out : r.result);
    };
    img.onerror = () => done(r.result);
    img.src = r.result;
  };
  r.readAsDataURL(file);
}

/* ── Library view ──────────────────────────────────────────── */

function csRender() {
  const host = cs._host || document.getElementById('cs-root');
  if (!host) return;
  host.innerHTML = cs.openId ? csSheetHTML() : csLibraryHTML();
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: host });
  if (cs.openId) csBindSheet(host);
}

function csLibraryHTML() {
  const all = csFiltered();
  const pages = Math.max(1, Math.ceil(all.length / CS_PAGE));
  if (cs.page > pages) cs.page = pages;
  const slice = all.slice((cs.page - 1) * CS_PAGE, cs.page * CS_PAGE);
  const tags = csAllTags();

  const cards = slice.map(s => {
    const blocks = csCountBlocks(s);
    const when = new Date(s.updatedAt || s.createdAt).toLocaleDateString();
    const kinds = csKinds(s);
    const cover = csCover(s);
    const hits = csHits(s, (cs.query || '').trim().toLowerCase());
    if (cs.view === 'list') {
      return `
        <button class="cs-row" onclick="csOpen('${s.id}')" oncontextmenu="csCardMenu(event,'${s.id}');return false;">
          <i data-lucide="${s.icon || 'book-marked'}" class="cs-row-icon" style="color:${cover[0]}"></i>
          <span class="cs-row-title">${s.pinned ? '<i data-lucide="pin" class="cs-pin"></i>' : ''}${csEsc(s.title)}</span>
          <span class="cs-row-tags">${(s.tags || []).slice(0, 2).map(t => `<span class="cs-tag">${csEsc(t)}</span>`).join('')}</span>
          <span class="cs-row-meta">${(s.pages || []).length}pgs \u00b7 ${blocks} block${blocks !== 1 ? 's' : ''}</span>
          <span class="cs-row-when">${when}</span>
        </button>`;
    }
    return `
      <button class="cs-card${s.pinned ? ' is-pinned' : ''}" style="--cs-a:${cover[0]};--cs-b:${cover[1]}"
              onclick="csOpen('${s.id}')" oncontextmenu="csCardMenu(event,'${s.id}');return false;">
        <span class="cs-cover">
          <i data-lucide="${s.icon || 'book-marked'}"></i>
          <span class="cs-cover-pages">${(s.pages || []).length}pgs</span>
          ${s.pinned ? '<span class="cs-cover-pin"><i data-lucide="pin"></i></span>' : ''}
        </span>
        <span class="cs-card-body">
          <span class="cs-card-title">${csEsc(s.title)}</span>
          <span class="cs-badges">
            ${kinds.map(k => `<span class="cs-badge cs-k-${k.type}" title="${k.n} ${CS_BLOCKS[k.type] ? CS_BLOCKS[k.type].label : k.type}"><i data-lucide="${k.icon}"></i>${k.n}</span>`).join('')}
          </span>
          <span class="cs-card-tags">${(s.tags || []).slice(0, 3).map(t => `<span class="cs-tag">${csEsc(t)}</span>`).join('')}</span>
          <span class="cs-card-foot">${blocks} block${blocks !== 1 ? 's' : ''} \u00b7 ${when}</span>
          ${hits.length ? `<span class="cs-hits">${hits.slice(0, 3).map(h =>
      `<span class="cs-hitrow" role="button" tabindex="0" onclick="event.stopPropagation();csJumpTo('${s.id}',${h.page},'${h.blockId}')">
             <i data-lucide="corner-down-right"></i>
             <span class="cs-hit-where">${csEsc(h.pageName)}</span>
             <span class="cs-hit-text">${csEsc(h.snippet)}</span>
           </span>`).join('')}${hits.length > 3 ? `<span class="cs-hit-more">+${hits.length - 3} more</span>` : ''}</span>` : ''}
        </span>
      </button>`;
  }).join('');

  const bar = pages > 1 ? `<div class="pagination-bar cs-pages">
      <button class="page-btn page-arrow" onclick="csGoPage(${cs.page - 1})" ${cs.page <= 1 ? 'disabled' : ''}>&lsaquo;</button>
      ${Array.from({ length: pages }, (_, i) => i + 1).map(n =>
    `<button class="page-btn ${n === cs.page ? 'active' : ''}" onclick="csGoPage(${n})">${n}</button>`).join('')}
      <button class="page-btn page-arrow" onclick="csGoPage(${cs.page + 1})" ${cs.page >= pages ? 'disabled' : ''}>&rsaquo;</button>
    </div>` : '';

  return `
    <div class="cheat-wrap">
      <header class="cs-head">
        <h1><span class="cs-head-icon"><i data-lucide="book-marked"></i></span>
          Cheat Sheet Library
          <span class="cs-head-count">${cs.sheets.length}</span>
        </h1>
        <p class="cs-head-sub">Your own reference book — terms, code you keep for looking at, tables, links and notes.</p>
      </header>

      <div class="cs-toolbar">
        <div class="search-container search-animated cs-search">
          <i data-lucide="search"></i>
          <input type="text" class="search-input" placeholder="Search sheets and their contents…"
                 value="${csEsc(cs.query)}" oninput="csSetQuery(this.value)">
        </div>
        <select class="cs-select" onchange="csSetSort(this.value)">
          <option value="recent" ${cs.sort === 'recent' ? 'selected' : ''}>Recently edited</option>
          <option value="created" ${cs.sort === 'created' ? 'selected' : ''}>Newest</option>
          <option value="title" ${cs.sort === 'title' ? 'selected' : ''}>A–Z</option>
        </select>
        <button class="cs-viewtoggle" onclick="csSetView('${cs.view === 'grid' ? 'list' : 'grid'}')"
                title="${cs.view === 'grid' ? 'Switch to list' : 'Switch to cards'}">
          <i data-lucide="${cs.view === 'grid' ? 'list' : 'layout-grid'}"></i>
        </button>
        <button class="btn btn-primary btn-sm cs-new" onclick="csCreatePrompt()">
          <i data-lucide="plus" style="width:14px;height:14px;"></i> New sheet
        </button>
      </div>

      ${tags.length ? `<div class="cs-chips">
        <button class="cs-chip ${cs.tag ? '' : 'active'}" onclick="csSetTag('')">All</button>
        ${tags.map(t => `<button class="cs-chip ${cs.tag === t ? 'active' : ''}" onclick="csSetTag('${csEsc(t)}')">${csEsc(t)}</button>`).join('')}
      </div>` : ''}

      ${all.length ? `<div class="${cs.view === 'list' ? 'cs-list' : 'cs-grid'}">${cards}</div>${bar}` : `
        <div class="cs-empty">
          <i data-lucide="book-marked"></i>
          <h2>${cs.sheets.length ? 'Nothing matches' : 'No sheets yet'}</h2>
          <p>${cs.sheets.length
      ? 'Try a different search or topic.'
      : 'A cheat sheet is whatever you want to be able to look up in a hurry: syntax you keep forgetting, a worked example, a table of operators.'}</p>
          ${cs.sheets.length ? '' : '<button class="btn btn-primary btn-sm" onclick="csCreatePrompt()"><i data-lucide="plus" style="width:14px;height:14px;"></i> Create your first sheet</button>'}
        </div>`}
    </div>`;
}

window.csGoPage = function (n) { cs.page = n; csRender(); };
window.csSetQuery = function (v) { cs.query = v; cs.page = 1; csRender(); };
window.csSetTag = function (v) { cs.tag = v; cs.page = 1; csRender(); };
window.csSetSort = function (v) { cs.sort = v; csRender(); };
window.csSetView = function (v) {
  cs.view = v;
  try { localStorage.setItem('csView', v); } catch (e) { /* quota */ }
  csRender();
};

window.csCreatePrompt = function () {
  showInputDialog('New cheat sheet', null, 'Name', '', (name) => {
    const s = csCreate((name || '').trim() || 'Untitled sheet');
    csOpen(s.id);
  });
};

window.csOpen = function (id) { cs.openId = id; cs.pageIdx = 0; csRender(); };
window.csBack = function () { cs.openId = null; csRender(); };

window.csCardMenu = function (e, id) {
  const s = csSheet(id);
  if (!s || cs.readOnly) return;
  const programs = (typeof state !== 'undefined' && state.challenges) || [];
  const linked = programs.find(c => c.id === s.programId);
  const actions = [
    { icon: 'pencil', label: 'Rename', fn: () => showInputDialog('Rename sheet', null, 'Name', s.title, v => { s.title = (v || '').trim() || s.title; csBump(s); csRender(); }) },
    { icon: 'tag', label: 'Topics…', fn: () => showInputDialog('Topics', 'Comma separated.', 'Topics', (s.tags || []).join(', '), v => { s.tags = (v || '').split(',').map(x => x.trim()).filter(Boolean); csBump(s); csRender(); }) },
    { icon: s.pinned ? 'pin-off' : 'pin', label: s.pinned ? 'Unpin' : 'Pin to top', fn: () => { s.pinned = !s.pinned; csBump(s); csRender(); } },
    { sep: true },
    // The cover was already in the model (csCover reads both) with no way in.
    { icon: 'palette', label: 'Cover colour…', fn: () => csPickColor(id) },
    { icon: 'image', label: 'Cover icon…', fn: () => csPickIcon(id) },
    { icon: 'link-2', label: linked ? `Linked to “${linked.title}”` : 'Link to a program…', fn: () => csPickProgram(id) },
    { sep: true },
    { icon: 'copy', label: 'Duplicate', fn: () => { const c = JSON.parse(JSON.stringify(s)); c.id = csId('cs'); c.title = s.title + ' (Copy)'; c.pinned = false; c.createdAt = c.updatedAt = Date.now(); cs.sheets.unshift(c); csSave(); csRender(); } },
    { icon: 'printer', label: 'Print / PDF', fn: () => csPrint(id) },
    { sep: true },
    { icon: 'trash-2', label: 'Delete', danger: true, fn: () => showConfirm('Delete sheet?', `Delete “${s.title}”? This cannot be undone.`, () => { cs.sheets = cs.sheets.filter(x => x.id !== id); csSave(); csRender(); }) }
  ];
  if (typeof _treeShowMenu === 'function') _treeShowMenu(e, actions);
};


function csBump(sheet) { if (sheet) sheet.updatedAt = Date.now(); csSave(); }

const CS_COVER_COLORS = ['', '#1e3a8a', '#0e7490', '#312e81', '#155e75', '#3730a3', '#7c2d12', '#7f1d1d', '#14532d', '#4c1d95'];
const CS_COVER_ICONS = ['book-marked', 'code-2', 'terminal', 'binary', 'brain', 'flask-conical', 'sigma', 'database', 'git-branch', 'shapes', 'bug', 'key-round'];

function csDialog(title, icon, bodyHTML, id) {
  const ov = document.createElement('div');
  ov.className = 'modal-overlay fd-overlay';
  ov.id = id;
  ov.innerHTML = `<div class="modal-content fd-box" role="dialog" aria-label="${csEsc(title)}">
      <h3 class="fd-title"><i data-lucide="${icon}"></i> ${csEsc(title)}</h3>${bodyHTML}
      <div class="fd-actions"><button class="btn btn-secondary btn-sm" onclick="document.getElementById('${id}').remove()">Close</button></div>
    </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: ov });
}

window.csPickColor = function (id) {
  const s = csSheet(id);
  csDialog('Cover colour', 'palette',
    '<div class="cs-swatches">' + CS_COVER_COLORS.map(c =>
      `<button class="cs-swatch ${(s.color || '') === c ? 'active' : ''}" style="background:${c || 'var(--bg-surface-hover)'}"
               onclick="csApplyCover('${id}','${c}')">${c ? '' : '\u2715'}</button>`).join('') + '</div>',
    'cs-color-dlg');
};
window.csApplyCover = function (id, c) {
  const s = csSheet(id);
  if (c) s.color = c; else delete s.color;
  csBump(s);
  const d = document.getElementById('cs-color-dlg'); if (d) d.remove();
  csRender();
};

window.csPickIcon = function (id) {
  const s = csSheet(id);
  csDialog('Cover icon', 'image',
    '<div class="cs-icons">' + CS_COVER_ICONS.map(ic =>
      `<button class="cs-icon ${(s.icon || '') === ic ? 'active' : ''}" onclick="csApplyIcon('${id}','${ic}')" title="${ic}">
         <i data-lucide="${ic}"></i></button>`).join('') + '</div>',
    'cs-icon-dlg');
};
window.csApplyIcon = function (id, ic) {
  const s = csSheet(id);
  s.icon = ic;
  csBump(s);
  const d = document.getElementById('cs-icon-dlg'); if (d) d.remove();
  csRender();
};

/** Tie a sheet to a program, so the attempt opens straight to it. */
window.csPickProgram = function (id) {
  const s = csSheet(id);
  const progs = ((typeof state !== 'undefined' && state.challenges) || []).slice()
    .sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  csDialog('Link to a program', 'link-2',
    `<p class="cs-dlg-hint">Opening the cheat sheet during an attempt at this program jumps straight here.</p>
     <div class="cs-proglist">
       <button class="cs-progrow ${s.programId ? '' : 'active'}" onclick="csApplyProgram('${id}','')">Not linked</button>
       ${progs.map(c => `<button class="cs-progrow ${s.programId === c.id ? 'active' : ''}" onclick="csApplyProgram('${id}','${c.id}')">${csEsc(c.title)}</button>`).join('')}
     </div>`, 'cs-prog-dlg');
};
window.csApplyProgram = function (id, pid) {
  const s = csSheet(id);
  s.programId = pid || null;
  csBump(s);
  const d = document.getElementById('cs-prog-dlg'); if (d) d.remove();
  csRender();
};

/** A clean, page-per-page render for paper. */
window.csPrint = function (id) {
  const s = csSheet(id);
  if (!s) return;
  const keep = { open: cs.openId, idx: cs.pageIdx, ro: cs.readOnly };
  cs.openId = id; cs.readOnly = true;
  const parts = s.pages.map((pg, i) => {
    cs.pageIdx = i;
    return `<section class="cs-print-page"><h2>${csEsc(s.title)} \u2014 ${csEsc(pg.name)}</h2>` +
      (pg.blocks || []).map((b, bi) => csBlockHTML(b, bi, true)).join('') + '</section>';
  }).join('');
  cs.openId = keep.open; cs.pageIdx = keep.idx; cs.readOnly = keep.ro;

  const host = document.createElement('div');
  host.id = 'cs-print';
  host.innerHTML = parts;
  document.body.appendChild(host);
  document.body.classList.add('cs-printing');
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: host });
  const done = () => {
    document.body.classList.remove('cs-printing');
    host.remove();
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  setTimeout(() => window.print(), 60);
};

/* ── Sheet view ────────────────────────────────────────────── */

function csSheetHTML() {
  const s = csOpenSheet();
  if (!s) return csLibraryHTML();
  const page = csPage();
  const ro = cs.readOnly;

  const tabs = s.pages.map((p, i) => `
    <button class="cs-tab ${i === cs.pageIdx ? 'active' : ''}" onclick="csGoSheetPage(${i})"
            ondblclick="${ro ? '' : `csRenamePage(${i})`}"
            oncontextmenu="${ro ? '' : `csPageMenu(event,${i});return false;`}">${csEsc(p.name)}</button>`).join('');

  return `
    <div class="cheat-wrap cs-sheet">
      <div class="cs-sheet-head">
        <button class="btn-back-dark cs-back" onclick="csBack()"><i data-lucide="chevron-left" style="width:15px;height:15px;"></i> Library</button>
        <h1 class="cs-sheet-title" ${ro ? '' : 'contenteditable="true" spellcheck="false" data-cs-title="1"'}>${csEsc(s.title)}</h1>
        <span class="cs-sheet-tags">${(s.tags || []).map(t => `<span class="cs-tag">${csEsc(t)}</span>`).join('')}</span>
        <span class="cs-sheet-tools">
          <button class="cs-mini ${cs.study ? 'on' : ''}" onclick="csToggleStudy()" title="Hide definitions and reveal them one at a time">
            <i data-lucide="graduation-cap"></i> Study
          </button>
          ${ro ? '' : `<button class="cs-mini" onclick="csOpenHistory()" title="Earlier versions of this sheet">
            <i data-lucide="history"></i> Versions</button>`}
        </span>
      </div>

      <div class="cs-tabs">
        ${tabs}
        ${ro ? '' : '<button class="cs-tab cs-tab-add" onclick="csAddPage()" title="Add page"><i data-lucide="plus"></i></button>'}
      </div>

      <div class="cs-paper" id="cs-paper">
        ${page && page.blocks.length
      ? page.blocks.map((b, i) => csBlockHTML(b, i, ro)).join('')
      : `<div class="cs-blank"><i data-lucide="feather"></i><p>Empty page. ${ro ? '' : 'Add a block below.'}</p></div>`}
        ${(page && page.notes || []).map(n => csNoteHTML(n, ro)).join('')}
      </div>

      ${ro ? '' : `
      <div class="cs-add">
        ${Object.keys(CS_BLOCKS).map(t => `
          <button class="cs-add-btn" onclick="csAddBlock('${t}')" title="Add ${CS_BLOCKS[t].label}">
            <i data-lucide="${CS_BLOCKS[t].icon}"></i> ${CS_BLOCKS[t].label}
          </button>`).join('')}
        <button class="cs-add-btn cs-add-note" onclick="csAddNote()" title="A sticky note you can drag anywhere">
          <i data-lucide="sticky-note"></i> Sticky
        </button>
      </div>`}
    </div>`;
}

function csBlockHTML(b, i, ro) {
  const del = ro ? '' : `<div class="cs-block-tools">
      <button onclick="csMoveBlock(${i},-1)" title="Move up"><i data-lucide="chevron-up"></i></button>
      <button onclick="csMoveBlock(${i},1)" title="Move down"><i data-lucide="chevron-down"></i></button>
      <button onclick="csDupBlock(${i})" title="Duplicate"><i data-lucide="copy"></i></button>
      <button onclick="csDelBlock(${i})" title="Remove" class="danger"><i data-lucide="trash-2"></i></button>
    </div>`;
  const ce = ro ? '' : 'contenteditable="true" spellcheck="false"';
  let body = '';

  if (b.type === 'terms') {
    body = `<table class="cs-terms"><tbody>${(b.rows || []).map((r, ri) => `
      <tr>
        <td class="cs-term" ${ce} data-b="${i}" data-r="${ri}" data-f="term" data-ph="Term">${csEsc(r.term)}</td>
        <td class="cs-def${cs.study ? ' cs-veil' : ''}" ${cs.study ? 'onclick="this.classList.toggle(\'cs-veil\')"' : ce} data-b="${i}" data-r="${ri}" data-f="def" data-ph="Definition">${csEsc(r.def)}</td>
        ${ro ? '' : `<td class="cs-rowdel"><button onclick="csDelTerm(${i},${ri})"><i data-lucide="x"></i></button></td>`}
      </tr>`).join('')}</tbody></table>
      ${ro ? '' : `<button class="cs-mini" onclick="csAddTerm(${i})"><i data-lucide="plus"></i> Add term</button>`}`;
  } else if (b.type === 'code') {
    /* The same highlighter, tab size and mono metrics the attempt editor uses,
       so a snippet you keep here looks like the thing you are comparing it to.
       The transparent textarea over a highlighted <pre> is the editor's own
       trick — a textarea cannot colour its own text. */
    const view = csViewCode(b);
    const isFolded = !!(b.folded || []).length;
    const hl = (typeof syntaxHighlight === 'function') ? syntaxHighlight(view) : csEsc(view);
    body = `<div class="cs-codewrap">
        <div class="cs-codebar">
          <span class="cs-lang">${csEsc(b.lang || 'c')}</span>
          <span class="cs-codename" ${ro ? '' : 'contenteditable="true" spellcheck="false"'}
                data-b="${i}" data-f="name" data-ph="untitled.c">${csEsc(b.name || '')}</span>
          <span class="cs-codebar-right">
            ${ro ? '' : `<button class="cs-mini" onclick="csFormatCode(${i})" title="Re-indent"><i data-lucide="align-left"></i> Tidy</button>`}
            <button class="cs-mini" onclick="csCopyCode(${i})"><i data-lucide="copy"></i> Copy</button>
          </span>
        </div>
        <div class="cs-codeedit${isFolded ? ' is-folded' : ''}">
          <div class="cs-gutter" data-b="${i}">${csGutterHTML(b)}</div>
          <div class="cs-codestack">
            <pre class="cs-code cs-code-hl" aria-hidden="true"><code>${hl}</code></pre>
            <textarea class="cs-code cs-code-ta" data-b="${i}" data-f="code" spellcheck="false"
                      ${ro || isFolded ? 'readonly' : ''}
                      placeholder="Paste code you want to look at later — it is never run.">${csEsc(view)}</textarea>
          </div>
        </div>
      </div>
      ${isFolded ? '<div class="cs-foldnote">Folded — unfold to edit</div>' : ''}
      <div class="cs-cap" ${ce} data-b="${i}" data-f="caption" data-ph="Caption (optional)">${csEsc(b.caption || '')}</div>`;
  } else if (b.type === 'text') {
    // Rendered markdown until you click into it, then the raw source so what
    // you edit is what you wrote.
    body = `<div class="cs-text" ${ce} data-b="${i}" data-f="text" data-md="1"
                 data-raw="${csEsc(b.text || '')}" data-ph="Write anything… **bold**, *italic*, \`code\`, - lists">${
      (b.text || '') ? csMarkdown(b.text) : ''}</div>`;
  } else if (b.type === 'check') {
    body = `<div class="cs-checks">${(b.items || []).map((it, ri) => `
        <label class="cs-check ${it.done ? 'done' : ''}">
          <input type="checkbox" ${it.done ? 'checked' : ''} ${ro ? 'disabled' : ''} onchange="csCheck(${i},${ri},this.checked)">
          <span ${ce} data-b="${i}" data-r="${ri}" data-f="text" data-ph="Item">${csEsc(it.text)}</span>
          ${ro ? '' : `<button class="cs-rowx" onclick="csDelCheck(${i},${ri})"><i data-lucide="x"></i></button>`}
        </label>`).join('')}</div>
      ${ro ? '' : `<button class="cs-mini" onclick="csAddCheck(${i})"><i data-lucide="plus"></i> Add item</button>`}`;
  } else if (b.type === 'callout') {
    const kind = b.kind || 'note';
    body = `<div class="cs-callout cs-callout-${kind}">
        <i data-lucide="${CS_CALLOUTS[kind].icon}"></i>
        <div class="cs-callout-body" ${ce} data-b="${i}" data-f="text" data-ph="Something worth flagging…">${csEsc(b.text || '')}</div>
      </div>
      ${ro ? '' : `<div class="cs-callout-kinds">${Object.keys(CS_CALLOUTS).map(k =>
      `<button class="cs-mini ${k === kind ? 'on' : ''}" onclick="csCalloutKind(${i},'${k}')">${CS_CALLOUTS[k].label}</button>`).join('')}</div>`}`;
  } else if (b.type === 'table') {
    body = `<table class="cs-table"><tbody>${(b.cells || []).map((row, ri) => `<tr>${row.map((cell, ci) =>
      `<td ${ce} data-b="${i}" data-r="${ri}" data-c="${ci}" data-f="cell">${csEsc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>
      ${ro ? '' : `<div class="cs-tabletools">
        <button class="cs-mini" onclick="csTableRow(${i},1)"><i data-lucide="plus"></i> Row</button>
        <button class="cs-mini" onclick="csTableCol(${i},1)"><i data-lucide="plus"></i> Column</button>
        <button class="cs-mini" onclick="csTableRow(${i},-1)"><i data-lucide="minus"></i> Row</button>
        <button class="cs-mini" onclick="csTableCol(${i},-1)"><i data-lucide="minus"></i> Column</button>
      </div>`}`;
  } else if (b.type === 'image') {
    body = b.src
      ? `<img class="cs-img" src="${csEsc(b.src)}" alt="${csEsc(b.caption || '')}">
         <div class="cs-cap" ${ce} data-b="${i}" data-f="caption" data-ph="Caption">${csEsc(b.caption || '')}</div>`
      : `<div class="cs-drop" ondragover="event.preventDefault()" ondrop="csDropImage(event,${i})">
           <i data-lucide="image"></i>
           <p>Paste an image here, drop a file, or <button class="cs-mini" onclick="csPickImage(${i})">choose a file</button></p>
         </div>`;
  } else if (b.type === 'link') {
    body = `<div class="cs-linkrow">
        <i data-lucide="link"></i>
        <span class="cs-linklabel" ${ce} data-b="${i}" data-f="label" data-ph="Label">${csEsc(b.label || '')}</span>
        <span class="cs-linkurl" ${ce} data-b="${i}" data-f="url" data-ph="https://…">${csEsc(b.url || '')}</span>
        ${b.url ? `<a href="${csEsc(b.url)}" target="_blank" rel="noopener noreferrer" class="cs-mini">Open</a>` : ''}
      </div>`;
  }

  const hit = cs.jump && cs.jump.blockId === b.id ? ' cs-hit' : '';
  return `<section class="cs-block cs-block-${b.type}${hit}" data-i="${i}" data-bid="${b.id}"
           ${ro ? '' : `draggable="true" ondragstart="csBlockDragStart(event,${i})" ondragover="csBlockDragOver(event,${i})" ondrop="csBlockDrop(event,${i})" ondragend="csBlockDragEnd(event)"`}>
      <div class="cs-block-head">${ro ? '' : '<i data-lucide="grip-vertical" class="cs-grip" title="Drag to reorder"></i>'}
        <i data-lucide="${CS_BLOCKS[b.type].icon}"></i>
        <span>${CS_BLOCKS[b.type].label}</span>${del}</div>
      ${body}
    </section>`;
}

const CS_SHAPES = [
  { id: 'note', label: 'Note', icon: 'sticky-note' },
  { id: 'arrow', label: 'Arrow', icon: 'move-up-right' },
  { id: 'circle', label: 'Circle', icon: 'circle' }
];

function csNoteHTML(n, ro) {
  const shape = n.shape || 'note';
  const w = n.w || (shape === 'circle' ? 120 : 168);
  const h = n.h || (shape === 'arrow' ? 40 : shape === 'circle' ? 120 : 96);
  const body = shape === 'arrow'
    ? `<svg class="cs-arrow" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true">
         <defs><marker id="csArrow-${n.id}" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
           <polygon points="0 0, 7 3.5, 0 7" fill="currentColor"/></marker></defs>
         <line x1="2" y1="12" x2="88" y2="12" stroke="currentColor" stroke-width="3"
               stroke-linecap="round" marker-end="url(#csArrow-${n.id})"/>
       </svg>
       <div class="cs-note-body cs-arrow-label" ${ro ? '' : 'contenteditable="true" spellcheck="false"'} data-note="${n.id}" data-ph="label">${csEsc(n.text || '')}</div>`
    : `<div class="cs-note-body" ${ro ? '' : 'contenteditable="true" spellcheck="false"'} data-note="${n.id}" data-ph="Note…">${csEsc(n.text || '')}</div>`;

  return `<div class="cs-note cs-shape-${shape}" data-id="${n.id}"
       style="left:${n.x}px;top:${n.y}px;width:${w}px;height:${h}px;--cs-note:${n.color || '#fde68a'};transform:rotate(${n.rot || 0}deg)">
      ${ro ? '' : `
      <div class="cs-note-bar">
        <select class="cs-note-shape" onchange="csSetShape('${n.id}', this.value)" title="Shape">
          ${CS_SHAPES.map(x => `<option value="${x.id}" ${shape === x.id ? 'selected' : ''}>${x.label}</option>`).join('')}
        </select>
        <button class="cs-note-x" onclick="csDelNote('${n.id}')" title="Remove"><i data-lucide="x"></i></button>
      </div>`}
      ${body}
      ${ro ? '' : `<span class="cs-note-rot" title="Drag to rotate"><i data-lucide="rotate-cw"></i></span>
                   <span class="cs-note-size" title="Drag to resize"></span>`}
    </div>`;
}

window.csSetShape = function (id, shape) {
  const p = csPage();
  const n = (p.notes || []).find(x => x.id === id);
  if (!n) return;
  n.shape = shape;
  // Each shape wants a different natural size; keep whatever the user set only
  // when it still makes sense for the new shape.
  if (shape === 'circle') { n.w = n.h = Math.max(80, Math.min(n.w || 120, n.h || 120)); }
  else if (shape === 'arrow') { n.w = Math.max(90, n.w || 160); n.h = 40; }
  else { n.w = Math.max(120, n.w || 168); n.h = Math.max(80, n.h || 96); }
  csTouch(); csRender();
};

/* ── Code block: the editor's essentials, minus running ───────
   Line marks, folding, auto-closing brackets and auto-indent. The attempt
   editor's own modules are bound to its single live textarea and its file
   model, so this is the same behaviour expressed against one block's string. */

/** Lines that open a `{` block, mapped to the line that closes them. */
function csFoldRanges(code) {
  const lines = String(code || '').split(csNL);
  const stack = [];
  const map = {};
  lines.forEach((ln, i) => {
    for (const ch of ln) {
      if (ch === '{') stack.push(i);
      else if (ch === '}') { const open = stack.pop(); if (open != null && i > open) map[open] = i; }
    }
  });
  return map;
}

/** Line indexes swallowed by an active fold. */
function csHiddenLines(b) {
  const folds = csFoldRanges(b.code || '');
  const hidden = new Set();
  (b.folded || []).forEach(o => {
    const c = folds[o];
    if (c != null) for (let k = o + 1; k <= c; k++) hidden.add(k);
  });
  return hidden;
}

/**
 * What the editor SHOWS: the source with folded bodies removed.
 * The gutter used to drop the folded rows while the textarea kept every line,
 * so the numbers and the code slid out of register - the fold appeared to
 * collapse the page rather than the block.
 */
function csViewCode(b) {
  const hidden = csHiddenLines(b);
  if (!hidden.size) return b.code || '';
  return (b.code || '').split(csNL).filter((_, n) => !hidden.has(n)).join(csNL);
}

function csGutterHTML(b) {
  const code = b.code || '';
  const lines = code.split(csNL);
  const folds = csFoldRanges(code);
  const marks = b.marks || [];
  const folded = b.folded || [];
  const hidden = csHiddenLines(b);

  return lines.map((_, n) => {
    if (hidden.has(n)) return '';
    const isFold = folds[n] != null;
    const isFolded = folded.indexOf(n) !== -1;
    return '<span class="cs-ln' + (marks.indexOf(n) !== -1 ? ' marked' : '') + '"' +
      ' data-ln="' + n + '" onclick="csToggleMark(event)">' +
      '<span class="cs-lnpad"></span>' +
      '<span class="cs-lnno">' + (n + 1) + '</span>' +
      (isFold
        ? '<span class="cs-fold' + (isFolded ? ' on' : '') + '" onclick="csToggleFold(event,' + n + ')">' +
          (isFolded ? '\u25b8' : '\u25be') + '</span>'
        : '<span></span>') +
      '</span>';
  }).join('');
}

window.csToggleMark = function (e) {
  // The chevron and the ghost both live inside the row; only the row toggles
  // the mark, and the chevron stops the event before it gets here.
  if (e.target.closest('.cs-fold')) return;
  e.stopPropagation();
  const gut = e.currentTarget.closest('.cs-gutter');
  const b = csPage().blocks[Number(gut.dataset.b)];
  const n = Number(e.currentTarget.dataset.ln);
  b.marks = b.marks || [];
  const at = b.marks.indexOf(n);
  if (at === -1) b.marks.push(n); else b.marks.splice(at, 1);
  csTouch();
  e.currentTarget.classList.toggle('marked', at === -1);
};

window.csToggleFold = function (e, n) {
  e.stopPropagation();
  const gut = e.target.closest('.cs-gutter');
  const b = csPage().blocks[Number(gut.dataset.b)];
  b.folded = b.folded || [];
  const at = b.folded.indexOf(n);
  if (at === -1) b.folded.push(n); else b.folded.splice(at, 1);
  csTouch();
  csRender();
};

/* Auto-closing pairs, the same set the attempt editor closes. */
const CS_PAIRS = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'" };

/**
 * Bracket closing, closer skip-over, auto-indent after `{`, and Tab.
 * @returns {boolean} true when the key was handled here
 */
function csCodeKey(e, ta) {
  const v = ta.value, a = ta.selectionStart, bEnd = ta.selectionEnd;
  const ins = (text, caret) => {
    document.execCommand('insertText', false, text);   // keeps the undo stack
    if (caret != null) ta.selectionStart = ta.selectionEnd = a + caret;
  };

  if (e.key === 'Tab') { e.preventDefault(); ins('    '); return true; }

  // Typing the closer that is already there just steps over it.
  if ([')', ']', '}', '"', "'"].indexOf(e.key) !== -1 && v[a] === e.key && a === bEnd) {
    e.preventDefault();
    ta.selectionStart = ta.selectionEnd = a + 1;
    return true;
  }

  if (CS_PAIRS[e.key]) {
    e.preventDefault();
    const sel = v.slice(a, bEnd);
    if (sel) { ins(e.key + sel + CS_PAIRS[e.key]); ta.selectionStart = a + 1; ta.selectionEnd = a + 1 + sel.length; }
    else ins(e.key + CS_PAIRS[e.key], 1);
    return true;
  }

  if (e.key === 'Enter') {
    const lineStart = v.lastIndexOf(csNL, a - 1) + 1;
    const line = v.slice(lineStart, a);
    const indent = (line.match(/^[ \t]*/) || [''])[0];
    const opens = /[{([]\s*$/.test(line);
    e.preventDefault();
    if (opens && CS_PAIRS[line.trim().slice(-1)] === v[a]) {
      // Caret between a fresh pair: open a body and put the closer on its own line.
      ins(csNL + indent + '    ' + csNL + indent);
      ta.selectionStart = ta.selectionEnd = a + 1 + indent.length + 4;
    } else {
      ins(csNL + indent + (opens ? '    ' : ''));
    }
    return true;
  }

  if (e.key === 'Backspace' && a === bEnd && a > 0 && CS_PAIRS[v[a - 1]] === v[a]) {
    e.preventDefault();                    // delete an empty pair as one unit
    ta.selectionStart = a - 1; ta.selectionEnd = a + 1;
    document.execCommand('delete');
    return true;
  }
  return false;
}

/* ── Editing ───────────────────────────────────────────────── */


window.csToggleStudy = function () { cs.study = !cs.study; csRender(); };

window.csCheck = function (i, ri, on) {
  const b = csPage().blocks[i];
  if (b && b.items[ri]) { b.items[ri].done = !!on; csTouch(); csRender(); }
};
window.csAddCheck = function (i) { csPage().blocks[i].items.push({ text: '', done: false }); csTouch(); csRender(); };
window.csDelCheck = function (i, ri) { csPage().blocks[i].items.splice(ri, 1); csTouch(); csRender(); };
window.csCalloutKind = function (i, k) { csPage().blocks[i].kind = k; csTouch(); csRender(); };

window.csDupBlock = function (i) {
  const p = csPage();
  const copy = JSON.parse(JSON.stringify(p.blocks[i]));
  copy.id = csId('b');
  p.blocks.splice(i + 1, 0, copy);
  csSnapshot('duplicate block');
  csTouch(); csRender();
};

/* Blocks are reordered by dragging the whole card. The up/down buttons stay -
   they are the only way to do it from a keyboard. */
let _csDragFrom = null;
window.csBlockDragStart = function (e, i) {
  // Dragging from inside a text field would fight the caret.
  if (e.target.closest('[contenteditable="true"], textarea, input, button')) { e.preventDefault(); return; }
  _csDragFrom = i;
  e.dataTransfer.effectAllowed = 'move';
  try { e.dataTransfer.setData('text/plain', String(i)); } catch (x) { /* older */ }
  e.currentTarget.classList.add('cs-dragging');
};
window.csBlockDragOver = function (e, i) {
  if (_csDragFrom === null || _csDragFrom === i) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  el.classList.toggle('cs-drop-above', e.clientY < r.top + r.height / 2);
  el.classList.toggle('cs-drop-below', e.clientY >= r.top + r.height / 2);
};
window.csBlockDrop = function (e, i) {
  e.preventDefault();
  const from = _csDragFrom;
  const el = e.currentTarget;
  const above = el.classList.contains('cs-drop-above');
  csBlockDragEnd(e);
  if (from === null || from === i) return;
  const p = csPage();
  const [b] = p.blocks.splice(from, 1);
  let to = i + (above ? 0 : 1);
  if (from < to) to--;
  p.blocks.splice(to, 0, b);
  csSnapshot('reorder blocks');
  csTouch(); csRender();
};
window.csBlockDragEnd = function () {
  _csDragFrom = null;
  document.querySelectorAll('.cs-block').forEach(el =>
    el.classList.remove('cs-dragging', 'cs-drop-above', 'cs-drop-below'));
};

/* ── Pages ─────────────────────────────────────────────────── */
window.csPageMenu = function (e, i) {
  const s = csOpenSheet();
  const actions = [
    { icon: 'pencil', label: 'Rename', fn: () => csRenamePage(i) },
    { icon: 'copy', label: 'Duplicate', fn: () => {
      const c = JSON.parse(JSON.stringify(s.pages[i]));
      c.id = csId('p'); c.name = s.pages[i].name + ' (Copy)';
      (c.blocks || []).forEach(b => { b.id = csId('b'); });
      s.pages.splice(i + 1, 0, c);
      cs.pageIdx = i + 1; csSnapshot('duplicate page'); csTouch(); csRender();
    } },
    { sep: true },
    { icon: 'chevron-left', label: 'Move left', fn: () => csMovePage(i, -1) },
    { icon: 'chevron-right', label: 'Move right', fn: () => csMovePage(i, 1) },
    { sep: true },
    { icon: 'trash-2', label: 'Delete page', danger: true, fn: () => csDelPage(i) }
  ];
  if (typeof _treeShowMenu === 'function') _treeShowMenu(e, actions);
};

window.csMovePage = function (i, d) {
  const s = csOpenSheet();
  const j = i + d;
  if (j < 0 || j >= s.pages.length) return;
  const [pg] = s.pages.splice(i, 1);
  s.pages.splice(j, 0, pg);
  cs.pageIdx = j;
  csTouch(); csRender();
};

/** There was no way to remove a page at all - a mis-clicked "+" was permanent. */
window.csDelPage = function (i) {
  const s = csOpenSheet();
  if (s.pages.length === 1) {
    if (typeof toast === 'function') toast('A sheet needs at least one page.', { type: 'info' });
    return;
  }
  const pg = s.pages[i];
  const n = (pg.blocks || []).length;
  const go = () => {
    csSnapshot('delete page');
    s.pages.splice(i, 1);
    cs.pageIdx = Math.max(0, Math.min(cs.pageIdx, s.pages.length - 1));
    csTouch(); csRender();
    if (typeof toast === 'function') {
      toast(`Deleted “${pg.name}”.`, { type: 'info', duration: 8000,
        action: { label: 'Undo', onClick: () => { s.pages.splice(i, 0, pg); csTouch(); csRender(); } } });
    }
  };
  if (n) showConfirm('Delete page?', `“${pg.name}” has ${n} block${n !== 1 ? 's' : ''}. You can undo from the toast that follows.`, go);
  else go();
};

window.csGoSheetPage = function (i) { cs.pageIdx = i; csRender(); };
window.csAddPage = function () {
  const s = csOpenSheet();
  s.pages.push(csNewPage('Page ' + (s.pages.length + 1)));
  cs.pageIdx = s.pages.length - 1;
  csTouch(); csRender();
};
window.csRenamePage = function (i) {
  const s = csOpenSheet();
  showInputDialog('Rename page', null, 'Name', s.pages[i].name, v => {
    s.pages[i].name = (v || '').trim() || s.pages[i].name; csTouch(); csRender();
  });
};
window.csAddBlock = function (type) {
  const p = csPage();
  p.blocks.push(csNewBlock(type));
  csTouch(); csRender();
};
window.csDelBlock = function (i) {
  const p = csPage();
  csSnapshot('delete block');
  const [gone] = p.blocks.splice(i, 1);
  csTouch(); csRender();
  // Every other delete in this app offers a way back; this one was silent.
  if (typeof toast === 'function') {
    toast(`Removed ${(CS_BLOCKS[gone.type] || {}).label || 'block'}.`, {
      type: 'info', duration: 8000,
      action: { label: 'Undo', onClick: () => { p.blocks.splice(Math.min(i, p.blocks.length), 0, gone); csTouch(); csRender(); } }
    });
  }
};
window.csMoveBlock = function (i, d) {
  const p = csPage();
  const j = i + d;
  if (j < 0 || j >= p.blocks.length) return;
  const [b] = p.blocks.splice(i, 1);
  p.blocks.splice(j, 0, b);
  csTouch(); csRender();
};
window.csAddTerm = function (i) { csPage().blocks[i].rows.push({ term: '', def: '' }); csTouch(); csRender(); };
window.csDelTerm = function (i, ri) { csPage().blocks[i].rows.splice(ri, 1); csTouch(); csRender(); };
window.csTableRow = function (i, d) {
  const b = csPage().blocks[i];
  if (d > 0) b.cells.push(new Array(b.cells[0].length).fill(''));
  else if (b.cells.length > 1) b.cells.pop();
  csTouch(); csRender();
};
window.csTableCol = function (i, d) {
  const b = csPage().blocks[i];
  if (d > 0) b.cells.forEach(r => r.push(''));
  else if (b.cells[0].length > 1) b.cells.forEach(r => r.pop());
  csTouch(); csRender();
};
window.csFormatCode = function (i) {
  const b = csPage().blocks[i];
  if (typeof edFormatCode === 'function') { b.code = edFormatCode(b.code || ''); }
  else {
    // Minimal brace-follow indenter, so Tidy still does something sensible.
    let depth = 0;
    b.code = (b.code || '').split(csNL).map(line => {
      const t = line.trim();
      if (t.startsWith('}')) depth = Math.max(0, depth - 1);
      const out = '    '.repeat(depth) + t;
      if (t.endsWith('{')) depth++;
      return out;
    }).join(csNL);
  }
  csTouch(); csRender();
};

window.csCopyCode = function (i) {
  const b = csPage().blocks[i];
  if (navigator.clipboard) navigator.clipboard.writeText(b.code || '');
  if (typeof toast === 'function') toast('Code copied.', { type: 'success' });
};
window.csPickImage = function (i) {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = () => { if (inp.files && inp.files[0]) csReadImage(inp.files[0], i); };
  inp.click();
};
window.csDropImage = function (e, i) {
  e.preventDefault();
  const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (f) csReadImage(f, i);
};
function csReadImage(file, i) {
  csReadImageScaled(file, (src) => {
    const b = csPage().blocks[i];
    if (b) { b.src = src; csTouch(); csRender(); }
  });
}
window.csAddNote = function () {
  const p = csPage();
  p.notes = p.notes || [];
  p.notes.push({
    id: csId('n'), x: 40 + p.notes.length * 18, y: 40 + p.notes.length * 18,
    text: '', color: '#fde68a', shape: 'note', w: 168, h: 96, rot: 0
  });
  csTouch(); csRender();
};
window.csDelNote = function (id) {
  const p = csPage();
  p.notes = (p.notes || []).filter(n => n.id !== id);
  csTouch(); csRender();
};

/** Text edits and sticky dragging, bound once per render. */
function csBindSheet(host) {
  if (cs.readOnly) return;

  host.querySelectorAll('[data-cs-title]').forEach(el => {
    el.addEventListener('blur', () => {
      const s = csOpenSheet();
      if (s) { s.title = el.textContent.trim() || s.title; csTouch(); }
    });
  });

  // One handler for every editable field; the dataset says where it belongs.
  // A markdown note shows its source while the caret is in it, and its
  // rendered form the rest of the time.
  host.querySelectorAll('[data-md]').forEach(el => {
    el.addEventListener('focus', () => { el.textContent = el.dataset.raw || ''; });
  });

  host.querySelectorAll('[data-f]').forEach(el => {
    el.addEventListener('blur', () => {
      const p = csPage();
      if (!p) return;
      const b = p.blocks[Number(el.dataset.b)];
      if (!b) return;
      const v = el.tagName === 'TEXTAREA' ? el.value : el.textContent;
      if (el.dataset.f === 'cell') b.cells[Number(el.dataset.r)][Number(el.dataset.c)] = v;
      else if (el.dataset.r !== undefined && b.type === 'check') b.items[Number(el.dataset.r)].text = v;
      else if (el.dataset.r !== undefined) b.rows[Number(el.dataset.r)][el.dataset.f] = v;
      else b[el.dataset.f] = v;
      csTouch();
      if (el.dataset.md) { el.dataset.raw = v; el.innerHTML = v ? csMarkdown(v) : ''; }
    });
  });

  // Code editors: keep the highlight layer and the gutter in step, and make Tab
  // indent instead of leaving the field.
  host.querySelectorAll('.cs-code-ta').forEach(ta => {
    const stack = ta.closest('.cs-codeedit');
    const hl = stack && stack.querySelector('.cs-code-hl code');
    const gut = stack && stack.querySelector('.cs-gutter');
    const blockOf = () => { const p = csPage(); return p && p.blocks[Number(ta.dataset.b)]; };
    const paint = () => {
      if (hl) hl.innerHTML = (typeof syntaxHighlight === 'function') ? syntaxHighlight(ta.value) : csEsc(ta.value);
      // ta.value is the full source whenever nothing is folded, which is the
      // only state in which editing is allowed.
      const b = blockOf();
      if (gut && b) gut.innerHTML = csGutterHTML(b);
    };
    const activeLine = () => {
      if (!gut) return;
      const n = ta.value.slice(0, ta.selectionStart).split(csNL).length - 1;
      gut.querySelectorAll('.cs-ln').forEach(el => el.classList.toggle('active', Number(el.dataset.ln) === n));
    };
    ta.addEventListener('input', () => {
      const b = blockOf();
      if (b) { b.code = ta.value; csTouch(); }
      paint();
      activeLine();
    });
    ta.addEventListener('click', activeLine);
    ta.addEventListener('keyup', activeLine);
    ta.addEventListener('scroll', () => {
      const pre = stack && stack.querySelector('.cs-code-hl');
      if (pre) { pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft; }
      if (gut) gut.scrollTop = ta.scrollTop;
    });
    ta.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (csCodeKey(e, ta)) {
        const b = blockOf();
        if (b) { b.code = ta.value; csTouch(); }
        paint();
        activeLine();
      }
    });
  });

  host.querySelectorAll('[data-note]').forEach(el => {
    el.addEventListener('blur', () => {
      const p = csPage();
      const n = (p.notes || []).find(x => x.id === el.dataset.note);
      if (n) { n.text = el.textContent; csTouch(); }
    });
  });

  // Sticky notes drag by their body's edge, not by the text — otherwise you
  // could never select what you wrote.
  host.querySelectorAll('.cs-note').forEach(el => {
    el.addEventListener('mousedown', (e) => {
      if (e.target.closest('.cs-note-body') || e.target.closest('.cs-note-bar')) return;
      if (e.target.closest('.cs-note-size') || e.target.closest('.cs-note-rot')) return;
      e.preventDefault();
      const paper = document.getElementById('cs-paper');
      const p = csPage();
      const n = (p.notes || []).find(x => x.id === el.dataset.id);
      if (!n || !paper) return;
      const pr = paper.getBoundingClientRect();
      const off = { x: e.clientX - el.getBoundingClientRect().left, y: e.clientY - el.getBoundingClientRect().top };
      const move = (mv) => {
        n.x = Math.max(0, Math.round(mv.clientX - pr.left - off.x));
        n.y = Math.max(0, Math.round(mv.clientY - pr.top - off.y));
        el.style.left = n.x + 'px';
        el.style.top = n.y + 'px';
      };
      const up = () => {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        csTouch();
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });

    // Resize and rotate share the drag plumbing; only the maths differs.
    const grip = (sel, onMove) => {
      const g = el.querySelector(sel);
      if (!g) return;
      g.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const p = csPage();
        const n = (p.notes || []).find(x => x.id === el.dataset.id);
        if (!n) return;
        const r = el.getBoundingClientRect();
        const start = { x: e.clientX, y: e.clientY, w: r.width, h: r.height, rot: n.rot || 0,
          cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
        const mv = (m) => { onMove(n, start, m, el); };
        const up2 = () => {
          document.removeEventListener('mousemove', mv);
          document.removeEventListener('mouseup', up2);
          csTouch();
        };
        document.addEventListener('mousemove', mv);
        document.addEventListener('mouseup', up2);
      });
    };

    grip('.cs-note-size', (n, st, m, node) => {
      let w = Math.max(60, Math.round(st.w + (m.clientX - st.x)));
      let h = Math.max(34, Math.round(st.h + (m.clientY - st.y)));
      if (n.shape === 'circle') { h = w = Math.max(w, h); }      // a circle stays round
      if (n.shape === 'arrow') { h = 40; }                        // an arrow keeps its bar height
      n.w = w; n.h = h;
      node.style.width = w + 'px';
      node.style.height = h + 'px';
    });

    grip('.cs-note-rot', (n, st, m, node) => {
      const deg = Math.atan2(m.clientY - st.cy, m.clientX - st.cx) * 180 / Math.PI;
      const snapped = m.shiftKey ? Math.round(deg / 15) * 15 : Math.round(deg);
      n.rot = snapped;
      node.style.transform = 'rotate(' + snapped + 'deg)';
    });
  });

  // Pasting an image anywhere on the page makes an image block, which is what
  // you expect from a notes surface.
  host.addEventListener('paste', (e) => {
    const items = (e.clipboardData && e.clipboardData.items) || [];
    for (const it of items) {
      if (it.type && it.type.indexOf('image') === 0) {
        const f = it.getAsFile();
        if (f) {
          e.preventDefault();
          const p = csPage();
          const b = csNewBlock('image');
          p.blocks.push(b);
          csReadImage(f, p.blocks.length - 1);
          csSnapshot('paste image');
          return;
        }
      }
    }
  });
}

/* ── Route + in-attempt panel ──────────────────────────────── */

function cheatsheetTemplate() {
  return `<div class="cs-route"><div id="cs-root"></div></div>`;
}
function cheatsheetInit() {
  csLoad();
  cs.readOnly = false;
  cs._host = document.getElementById('cs-root');
  csRender();
}
function cheatsheetDestroy() { cs._host = null; }

/** The same sheets, read-only, inside the attempt's cheat-sheet overlay. */
function csFillOverlay(programId) {
  const body = document.getElementById('cheat-body');
  if (!body) return;
  csLoad();
  // A sheet tied to this program opens straight to it; otherwise the index.
  const linked = programId && cs.sheets.find(x => x.programId === programId);
  cs.openId = linked ? linked.id : null;
  cs.pageIdx = 0;
  // Editable here too. Reading a reference and realising it is wrong, with no
  // way to correct it without leaving the attempt, is the worst moment to be
  // locked out of your own notes.
  cs.readOnly = false;
  cs._host = body;
  if (!cs.sheets.length) {
    body.innerHTML = `<div class="cs-empty">
        <i data-lucide="book-marked"></i>
        <h2>No cheat sheets yet</h2>
        <p>Build one in the Cheat Sheet Library and it will be here whenever you are stuck.</p>
        <button class="btn btn-primary btn-sm" onclick="closeCheatsheet();spaNavigate('cheatsheet')">Open the library</button>
      </div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: body });
    return;
  }
  csRender();
}

window.csFillOverlay = csFillOverlay;
window.csRender = csRender;
