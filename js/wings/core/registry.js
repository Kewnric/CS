/* ============================================================
   WINGS/CORE/REGISTRY.JS — the registry the seven wings plug into
   ------------------------------------------------------------
   Each wing lives in its own file under js/wings/ and registers itself here.
   Nothing in this file knows what a mindset or a diary is; it holds only what
   all seven genuinely share — the field editors, the date handling, the
   grouping, and the small pieces of chrome (badges, stars, progress bars)
   that would otherwise be copied seven times.

   To add or change a wing, edit its own file. Nothing here should need
   touching for it, and no other wing can be broken by it.

   A wing registers:
     noun, nounPlural   what one entry is called
     titleLabel/Placeholder, bodyLabel/Placeholder
     layout             a css hook, also the reader's modifier class
     rows               true to render a column of rows, false for a card grid
     groupBy            field key, '__year', '__month', or null
     groupOrder         the order those groups appear in
     sortKey            a date field to sort on instead of updatedAt
     fields[]           the extra fields, in editor order
     card(w, ctx)       one card or row; ctx.index is 1-based across the list
     readerExtras(w)    sections under the body in the reader, optional
   ============================================================ */

const WING_DEFS = {};

function wingRegister(key, def) {
  WING_DEFS[key] = Object.assign({
    noun: 'entry', nounPlural: 'entries',
    titleLabel: 'Title', titlePlaceholder: 'Give it a name…',
    bodyLabel: 'Content', bodyPlaceholder: 'Write it out…',
    layout: 'plain', rows: false, fields: [], groupBy: null,
    card: (w) => wingPlainCard(w),
    readerExtras: () => ''
  }, def || {});
}

/** The fallback keeps an unregistered wing working as a plain list. */
const WING_SCHEMA_DEFAULT = {
  noun: 'entry', nounPlural: 'entries',
  titleLabel: 'Title', titlePlaceholder: 'Give it a name…',
  bodyLabel: 'Content', bodyPlaceholder: 'Write it out…',
  layout: 'plain', rows: false, fields: [], groupBy: null,
  card: (w) => wingPlainCard(w),
  readerExtras: () => ''
};

function wingSchema(key) {
  return WING_DEFS[key || _wingKey] || WING_SCHEMA_DEFAULT;
}

function wingIsRowLayout(schema) { return !!schema.rows; }

/* ── Values ───────────────────────────────────────────────── */

function wingVal(w, key) {
  return (w && w.data && w.data[key] !== undefined) ? w.data[key] : '';
}

const WING_STAGE_STATES = ['planned', 'walking', 'cleared'];

/** done / total / percent for a checklist or a stage list. */
function wingProgress(w) {
  const steps = wingVal(w, 'steps');
  if (Array.isArray(steps) && steps.length) {
    const done = steps.filter(s => s && s.done).length;
    return { done, total: steps.length, pct: Math.round((done / steps.length) * 100) };
  }
  const stages = wingVal(w, 'stages');
  if (Array.isArray(stages) && stages.length) {
    const done = stages.filter(s => s && s.status === 'cleared').length;
    return { done, total: stages.length, pct: Math.round((done / stages.length) * 100) };
  }
  return null;
}

/* ── Dates ────────────────────────────────────────────────── */

function wingToday() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
         String(d.getDate()).padStart(2, '0');
}

/** A yyyy-mm-dd string as a LOCAL date. new Date('2026-01-05') is UTC
    midnight, which reads as the 4th anywhere behind Greenwich. */
function wingParseDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3]);
}

function wingDateLabel(s, opts) {
  const d = wingParseDate(s);
  if (!d) return '';
  return d.toLocaleDateString(undefined, opts || { year: 'numeric', month: 'short', day: 'numeric' });
}

/** The date this wing orders by — its own if it has one, else when it changed. */
function wingSortStamp(w, schema) {
  if (schema.sortKey) {
    const d = wingParseDate(wingVal(w, schema.sortKey));
    if (d) return d.getTime();
  }
  return w.updatedAt || w.createdAt || 0;
}

/* ── Grouping ─────────────────────────────────────────────── */

/**
 * Split the list into labelled groups.
 *
 * __year and __month are derived from the wing's own date rather than a stored
 * value, which is what lets a chronology and a journal group themselves
 * without carrying a redundant field.
 */
function wingGroupList(list, schema) {
  if (!schema.groupBy) return [{ label: null, items: list }];

  const keyOf = (w) => {
    if (schema.groupBy === '__year') {
      const d = wingParseDate(wingVal(w, schema.sortKey));
      return d ? String(d.getFullYear()) : 'Undated';
    }
    if (schema.groupBy === '__month') {
      const d = wingParseDate(wingVal(w, schema.sortKey));
      return d ? d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : 'Undated';
    }
    return wingVal(w, schema.groupBy) || 'Unsorted';
  };

  const buckets = new Map();
  list.forEach(w => {
    const k = keyOf(w);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(w);
  });

  let labels = Array.from(buckets.keys());
  if (schema.groupOrder) {
    labels.sort((a, b) => {
      const ia = schema.groupOrder.indexOf(a), ib = schema.groupOrder.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  } else if (schema.groupBy === '__year' || schema.groupBy === '__month') {
    // Newest first, with anything undated at the bottom rather than sorted
    // into 1970 by an empty date.
    labels.sort((a, b) => {
      if (a === 'Undated') return 1;
      if (b === 'Undated') return -1;
      return wingSortStamp(buckets.get(b)[0], schema) - wingSortStamp(buckets.get(a)[0], schema);
    });
  } else {
    labels.sort();
  }
  return labels.map(l => ({ label: l, items: buckets.get(l) }));
}

/* ── Chrome the wings share ───────────────────────────────── */

function wingBadge(text, cls) {
  if (!text) return '';
  return `<span class="wing-badge ${cls || ''}">${escapeHTML(String(text))}</span>`;
}

function wingStars(n, max) {
  const v = parseInt(n, 10) || 0;
  const top = max || 5;
  let out = '<span class="wing-stars" aria-label="' + v + ' out of ' + top + '">';
  for (let i = 1; i <= top; i++) {
    out += `<i data-lucide="star" style="width:13px;height:13px;${i <= v ? 'fill:currentColor;' : 'opacity:.3;'}"></i>`;
  }
  return out + '</span>';
}

function wingProgressBarHTML(p) {
  if (!p) return '';
  return `
    <div class="wing-prog" title="${p.done} of ${p.total} done">
      <div class="wing-prog-track"><div class="wing-prog-fill" style="width:${p.pct}%;"></div></div>
      <span class="wing-prog-num">${p.done}/${p.total}</span>
    </div>`;
}

/** Slug so a value can drive a colour class without a lookup table. */
function wingSlug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

/** The wrapper every card and row shares: selection, favourite, click target. */
function wingShell(w, inner, extraClass) {
  const selecting = libSelectMode('wing');
  /* Due-ness is a CLASS, not a badge dropped into the card. Seven wings lay
     their cards out seven ways — a timeline, a museum wall, a rulebook — and
     an absolutely placed chip that suited one would land on the text of
     another. A left edge stripe reads the same everywhere and cannot collide
     with the fav button or the select box already in the corners. */
  const revType = (typeof revWingType === 'function') ? revWingType(_wingKey) : null;
  const due = (revType && typeof libIsDue === 'function' && libIsDue(revType, w.id)) ? ' wing-is-due' : '';
  return `
    <div class="${extraClass}${libIsSelected('wing', w.id) ? ' lib-selected' : ''}${due}"
         onclick="${selecting ? `libToggleSelect('wing','${w.id}')` : `wingOpen('${w.id}')`}" style="cursor:pointer;">
      ${libSelectBoxHTML('wing', w.id)}
      ${libFavButtonHTML('wing', w)}
      ${inner}
    </div>`;
}

function wingPlainCard(w) {
  const when = w.updatedAt || w.createdAt;
  return wingShell(w, `
    <h3 class="wing-row-title">${escapeHTML(w.title || 'Untitled')}</h3>
    ${(w.tags || []).length ? `<div class="wing-tagrow">${(w.tags || []).map(t => libTagBadgeHTML('wing', t)).join('')}</div>` : ''}
    <p class="wing-row-snip">${escapeHTML(_wingSnippet(w.body, 160) || 'No content yet.')}</p>
    ${when ? `<div class="card-last-attempt"><i data-lucide="clock" style="width:11px;height:11px;"></i> ${new Date(when).toLocaleDateString()}</div>` : ''}
  `, 'card card-enhanced');
}

/* ── Field editors ────────────────────────────────────────── */

function wingFieldEditorHTML(f, w) {
  const id = 'wing-x-' + f.key;
  const raw = wingVal(w, f.key);
  const hint = f.hint ? `<span class="af-label-hint">${escapeHTML(f.hint)}</span>` : '';
  const label = `<label class="form-label" for="${id}">${escapeHTML(f.label)} ${hint}</label>`;

  if (f.type === 'select') {
    const cur = raw || f.def || '';
    return `<div class="af-field">${label}
      <select id="${id}" class="form-select">
        ${f.options.map(o => `<option value="${escapeHTML(o)}"${o === cur ? ' selected' : ''}>${escapeHTML(o)}</option>`).join('')}
      </select></div>`;
  }

  if (f.type === 'date') {
    const val = raw || (f.def === 'today' ? wingToday() : '');
    return `<div class="af-field">${label}
      <input type="date" id="${id}" class="form-input" value="${escapeHTML(val)}" /></div>`;
  }

  if (f.type === 'rating') {
    const v = parseInt(raw, 10) || 0;
    const max = f.max || 5;
    return `<div class="af-field">${label}
      <div class="wing-rate-pick" id="${id}" data-value="${v}">
        ${Array.from({ length: max }, (_, i) => `
          <button type="button" class="wing-rate-star${i < v ? ' on' : ''}" data-n="${i + 1}"
                  onclick="wingSetRating('${f.key}', ${i + 1})" aria-label="${i + 1} of ${max}">
            <i data-lucide="star" style="width:18px;height:18px;${i < v ? 'fill:currentColor;' : ''}"></i>
          </button>`).join('')}
        <button type="button" class="wing-rate-clear" onclick="wingSetRating('${f.key}', 0)">clear</button>
      </div></div>`;
  }

  if (f.type === 'checklist' || f.type === 'stages') {
    const list = Array.isArray(raw) ? raw : [];
    return `<div class="af-field">${label}
      <textarea id="${id}" class="form-textarea" rows="6"
                placeholder="One per line…">${escapeHTML(list.map(s => s.text).join('\n'))}</textarea></div>`;
  }

  if (f.type === 'goalref') {
    const goals = (typeof wingItems === 'function') ? wingItems('progression') : [];
    return `<div class="af-field">${label}
      <select id="${id}" class="form-select">
        <option value="">— none —</option>
        ${goals.map(g => `<option value="${g.id}"${raw === g.id ? ' selected' : ''}>${escapeHTML(g.title || 'Untitled')}</option>`).join('')}
      </select>
      ${goals.length ? '' : '<p class="af-label-hint" style="margin-top:0.35rem;">No goals in the Progression library yet.</p>'}
    </div>`;
  }

  /* An image field, for the one wing that catalogues things with covers.
     The value is a downscaled data URL held on the preview element, read back
     by wingReadFieldValues — the same shape and the same _downscaleImage the
     other libraries' covers use, rather than a second way of storing a
     picture. */
  if (f.type === 'image') {
    const cur = raw || '';
    return `<div class="af-field af-field-wide">${label}
      <div class="wing-img-field" id="${id}" data-value="${escapeHTML(cur)}">
        <div class="wing-img-preview">
          ${cur ? `<img src="${escapeHTML(cur)}" alt="" />`
                : `<span class="wing-img-empty"><i data-lucide="image"></i> No image</span>`}
        </div>
        <div class="wing-img-actions">
          <label class="btn btn-secondary btn-sm">
            <i data-lucide="upload" style="width:14px;height:14px;"></i> Choose image
            <input type="file" accept="image/*" style="display:none;"
                   onchange="wingImagePick('${f.key}', this)" />
          </label>
          <button type="button" class="btn btn-ghost btn-sm" onclick="wingImageClear('${f.key}')"
                  ${cur ? '' : 'disabled'}>Remove</button>
        </div>
      </div></div>`;
  }

  if (f.type === 'textarea') {
    return `<div class="af-field">${label}
      <textarea id="${id}" class="form-textarea" rows="${f.rows || 4}"
                placeholder="${escapeHTML(f.placeholder || '')}">${escapeHTML(raw || '')}</textarea></div>`;
  }

  return `<div class="af-field">${label}
    <input id="${id}" class="form-input" value="${escapeHTML(raw || '')}"
           placeholder="${escapeHTML(f.placeholder || '')}" /></div>`;
}

/** The rating widget writes to a data attribute; the save reads that. */
function wingSetRating(key, n) {
  const host = document.getElementById('wing-x-' + key);
  if (!host) return;
  const cur = parseInt(host.dataset.value, 10) || 0;
  // Clicking the star you are already on clears it — otherwise a 1 can never
  // be undone without hunting for a separate control.
  const next = (n === cur) ? 0 : n;
  host.dataset.value = next;
  // A star is a click, not an input or a change, so the delegated dirty
  // tracking never saw it. A rating was the one edit you could make and then
  // lose without being asked about it.
  if (typeof wingMarkDirty === 'function') wingMarkDirty();
  host.querySelectorAll('.wing-rate-star').forEach(b => {
    const on = (parseInt(b.dataset.n, 10) || 0) <= next;
    b.classList.toggle('on', on);
    const i = b.querySelector('svg, [data-lucide]');
    if (i) i.style.fill = on ? 'currentColor' : '';
  });
}

/**
 * Read every schema field out of the editor.
 *
 * Checklists merge rather than replace: an item whose text is unchanged keeps
 * whether it was ticked. Retyping a step list to reword one line would
 * otherwise silently reset a goal you were halfway through.
 */
function wingReadFieldValues(schema, existing) {
  const data = {};
  (schema.fields || []).forEach(f => {
    const el = document.getElementById('wing-x-' + f.key);
    if (!el) return;

    if (f.type === 'rating') { data[f.key] = parseInt(el.dataset.value, 10) || 0; return; }

    if (f.type === 'image') { data[f.key] = el.dataset.value || ''; return; }

    if (f.type === 'checklist' || f.type === 'stages') {
      const was = Array.isArray(wingVal(existing, f.key)) ? wingVal(existing, f.key) : [];
      const seen = {};
      was.forEach(s => { if (s && s.text) seen[s.text] = s; });
      data[f.key] = String(el.value || '')
        .split('\n').map(t => t.trim()).filter(Boolean)
        .map(t => {
          const prev = seen[t];
          return f.type === 'stages'
            ? { text: t, status: (prev && prev.status) || 'planned' }
            : { text: t, done: !!(prev && prev.done) };
        });
      return;
    }

    data[f.key] = el.value;
  });
  return data;
}

/* ── The reader's shared parts ────────────────────────────── */

/** The schema fields, laid out under the title. */
function wingReaderMetaHTML(w, schema) {
  const rows = [];
  (schema.fields || []).forEach(f => {
    const v = wingVal(w, f.key);
    // Lists and links get their own sections from the wing itself.
    if (f.type === 'checklist' || f.type === 'stages' || f.type === 'goalref') return;
    if (v === '' || v === null || v === undefined || v === 0) return;
    let shown;
    if (f.type === 'date') shown = escapeHTML(wingDateLabel(v));
    else if (f.type === 'rating') shown = wingStars(v, f.max || 5);
    else shown = escapeHTML(String(v));
    if (!shown) return;
    rows.push(`<div class="wing-meta-row"><dt>${escapeHTML(f.label)}</dt><dd>${shown}</dd></div>`);
  });
  return rows.length ? `<dl class="wing-meta">${rows.join('')}</dl>` : '';
}

function wingSaveAndRepaint() {
  saveData();
  wingRenderDetail();
  wingRenderSidebar();
  wingUpdateHeader();
}

/**
 * Jump to another wing and open one entry there.
 *
 * The entry is handed over rather than set: wingInitFor picks up
 * _wingPendingOpen when the route mounts. That replaced a 60ms setTimeout that
 * reopened the entry after guessing the route had finished building — which
 * worked until a slow first paint, and then quietly did not.
 */
function wingGoTo(key, id) {
  if (typeof event !== 'undefined' && event) event.stopPropagation();
  const target = '#/' + key;
  if (window.location.hash === target) {
    _wingKey = key;
    _wingFolderId = null;
    _wingActiveId = id;
    _wingEditing = null;
    wingRenderSidebar(); wingRenderDetail(); wingUpdateHeader();
    return;
  }
  _wingPendingOpen = id;
  window.location.hash = target;
}

/* ============================================================
   THE SHARED FORM PIECES
   ------------------------------------------------------------
   The wings had the plainest forms in the app: a stack of labelled inputs,
   tags typed as one comma-separated string, no way to tell whether what you
   had typed was saved, and nothing stopping you navigating away mid-edit.
   Every other library got the admin form chrome — sections, a save status, a
   required marker, chip tags with suggestions — and the wings did not.

   These are shared rather than written into the wing editor because the wing
   ADMIN needs exactly the same pieces, and a tag editor that behaves one way
   in the library and another way in its admin is worse than no admin at all.

   Only one wing form is ever open at a time, in one route, so a single draft
   here is the whole state it needs.
   ============================================================ */

let _wingTagDraft = [];
let _wingTagScope = null;      // which wing this form belongs to
let _wingFormDirty = false;
let _wingFormStatusId = null;
let _wingLastSaveFn = null;    // the save hook we lent the router
let _wingTagPool = [];         // the suggestions currently on screen

/**
 * Seed the chip editor.
 *
 * The wing is held here rather than read from _wingKey when needed. The admin
 * runs against _awxKey, and _wingKey is whatever library you last opened, so
 * refreshing suggestions from _wingKey showed the wrong wing's tags: editing
 * in the Roadmap admin after visiting Mindset offered Mindset's vocabulary.
 */
function wingTagsBegin(tags, scopeKey) {
  _wingTagDraft = Array.isArray(tags) ? tags.slice() : [];
  _wingTagScope = scopeKey || null;
}

function wingTagsRead() { return _wingTagDraft.slice(); }

/**
 * The chip editor.
 *
 * `scopeKey` is the wing, used to gather the tags already in use so the
 * suggestions are that wing's own vocabulary rather than the whole app's.
 */
function wingTagEditorHTML(scopeKey) {
  if (scopeKey) _wingTagScope = scopeKey;
  return `
    <div class="af-field af-field-wide">
      <label class="form-label" for="wing-tag-input">Tags
        <span class="af-label-hint">Enter or comma to add</span></label>
      <div class="af-tag-input-row">
        <input id="wing-tag-input" class="form-input" placeholder="Add a tag..."
               onkeydown="wingTagKeydown(event)" oninput="wingTagSuggest()" />
        <button type="button" class="btn btn-secondary btn-sm af-add-btn" onclick="wingTagAdd()">
          <i data-lucide="plus" style="width:14px;height:14px;"></i> Add
        </button>
      </div>
      <div class="af-tags-list" id="wing-tags-list"></div>
      <div class="af-tag-suggestions" id="wing-tag-suggestions"></div>
    </div>`;
}

function wingRenderTags() {
  const host = document.getElementById('wing-tags-list');
  if (!host) return;
  host.innerHTML = _wingTagDraft.map((t, i) => `
    <span class="tag">${escapeHTML(t)}
      <button type="button" onclick="wingTagRemove(${i})" title="Remove tag"
              aria-label="Remove tag ${escapeHTML(t)}"><i data-lucide="x" style="width:12px;height:12px;"></i></button>
    </span>`).join('');
  if (typeof lucide !== 'undefined') lucide.createIcons({ el: host });
}

function wingTagAdd() {
  const input = document.getElementById('wing-tag-input');
  if (!input) return;
  String(input.value || '').split(',').map(v => v.trim()).filter(Boolean).forEach(v => {
    if (!_wingTagDraft.includes(v)) _wingTagDraft.push(v);
  });
  input.value = '';
  wingRenderTags();
  const sug = document.getElementById('wing-tag-suggestions');
  if (sug) sug.innerHTML = '';
  wingMarkDirty();
}

function wingTagRemove(i) {
  _wingTagDraft.splice(i, 1);
  wingRenderTags();
  wingMarkDirty();
}

function wingTagKeydown(ev) {
  if (ev.key === 'Enter' || ev.key === ',') { ev.preventDefault(); wingTagAdd(); return; }
  // Backspace on an empty box takes the last chip back, so a mistyped tag does
  // not need the mouse to undo.
  if (ev.key === 'Backspace' && !ev.target.value && _wingTagDraft.length) {
    ev.preventDefault();
    _wingTagDraft.pop();
    wingRenderTags();
    wingMarkDirty();
  }
}

/** The tags already used in this wing, most common first. */
function wingTopTags(key, limit) {
  const counts = {};
  (typeof wingItems === 'function' ? wingItems(key) : []).forEach(w =>
    (w.tags || []).forEach(t => { counts[t] = (counts[t] || 0) + 1; }));
  return Object.keys(counts)
    .sort((a, b) => counts[b] - counts[a] || a.localeCompare(b))
    .slice(0, limit || 8);
}

/**
 * The tags already used in this wing, offered as buttons.
 *
 * The handlers are BOUND, not written into an onclick attribute. A tag is
 * ordinary text and may contain an apostrophe; escapeHTML turns that into
 * &#39;, which the HTML parser faithfully decodes back to ' before the JS in
 * the attribute is ever compiled. So onclick="wingTagPick('don't panic')"
 * threw "missing ) after argument list" and that tag could not be picked at
 * all. Escaping for two nested languages at once is a trap worth stepping
 * around: keep the data out of the attribute and the whole class goes away.
 */
function wingTagSuggest() {
  const host = document.getElementById('wing-tag-suggestions');
  const input = document.getElementById('wing-tag-input');
  if (!host || !input) return;
  const typed = String(input.value || '').trim().toLowerCase();
  _wingTagPool = wingTopTags(_wingTagScope, 24)
    .filter(t => !_wingTagDraft.includes(t))
    .filter(t => !typed || t.toLowerCase().includes(typed))
    .slice(0, 8);

  if (!_wingTagPool.length) { host.innerHTML = ''; return; }
  host.innerHTML = `<span class="af-tag-suggest-label">In use</span>` +
    _wingTagPool.map(t => `<button type="button" class="af-tag-suggest">${escapeHTML(t)}</button>`).join('');
  host.querySelectorAll('.af-tag-suggest').forEach((b, i) => {
    b.addEventListener('click', () => wingTagPick(_wingTagPool[i]));
  });
}

function wingTagPick(t) {
  if (t === undefined || t === null) return;
  if (!_wingTagDraft.includes(t)) _wingTagDraft.push(t);
  const input = document.getElementById('wing-tag-input');
  if (input) input.value = '';
  wingRenderTags();
  wingTagSuggest();
  wingMarkDirty();
}

/* ── Dirty tracking ───────────────────────────────────────────
   The wings were the only library you could navigate away from mid-edit and
   lose what you had typed without being asked.
   ------------------------------------------------------------ */

/**
 * @param {string}   statusId  the save-status element to drive
 * @param {function} saveFn    what the router should call to save this form
 *
 * window.adminIsDirty and window.saveCurrentAdminForm are the router's own
 * unsaved-changes guard, which intercepts the BROWSER's Back and Forward
 * buttons. The wing forms tracked dirtiness privately, so that guard never
 * fired for them and Back threw away what you had typed without asking —
 * every other admin form in the app is protected there.
 */
function wingFormBegin(statusId, saveFn) {
  _wingFormDirty = false;
  _wingFormStatusId = statusId || null;
  window.adminIsDirty = false;
  if (typeof saveFn === 'function') {
    _wingLastSaveFn = saveFn;
    window.saveCurrentAdminForm = saveFn;
  }
}

function wingMarkDirty() {
  _wingFormDirty = true;
  window.adminIsDirty = true;
  if (_wingFormStatusId && typeof setSaveStatus === 'function') {
    setSaveStatus(_wingFormStatusId, 'unsaved');
  }
}

function wingFormIsDirty() { return _wingFormDirty; }

function wingFormClean(showSaved) {
  _wingFormDirty = false;
  window.adminIsDirty = false;
  if (_wingFormStatusId && typeof setSaveStatus === 'function') {
    setSaveStatus(_wingFormStatusId, showSaved ? 'saved' : '');
  }
}

/**
 * Leaving a wing form: stop claiming the router's save hook.
 *
 * Only if it is still ours. openAdminForm sets the same global when a coding
 * or notebook form opens, and clearing it blindly would disarm that form's
 * guard instead of our own.
 */
function wingFormEnd() {
  _wingFormDirty = false;
  window.adminIsDirty = false;
  if (_wingLastSaveFn && window.saveCurrentAdminForm === _wingLastSaveFn) {
    window.saveCurrentAdminForm = null;
    _wingLastSaveFn = null;
  }
}

/**
 * Ask before throwing away edits, and offer to keep them instead.
 *
 * Mirrors confirmCloseAdminForm rather than reimplementing the dialog, so a
 * wing behaves the way the rest of the admin already does.
 */
function wingConfirmDiscard(onLeave, onSave) {
  if (!_wingFormDirty) { onLeave(); return; }
  if (typeof showUnsavedConfirm !== 'function') { onLeave(); return; }
  showUnsavedConfirm(
    () => { _wingFormDirty = false; onLeave(); },
    () => {
      const ok = typeof onSave === 'function' ? onSave({ silent: true }) : true;
      if (ok === false) return;          // validation failed — stay put
      _wingFormDirty = false;
      // And then go where you were going. Saving was how you answered "I am
      // leaving, keep this" — stopping at the save would leave you on the form
      // you had just asked to leave, which is the one thing the dialog was
      // opened to resolve. confirmCloseAdminForm has always done this.
      onLeave();
    }
  );
}

/**
 * Every input in a form marks it dirty.
 *
 * Delegated on the container rather than an oninput on each field, because
 * the schema fields are built by wingFieldEditorHTML and adding a handler to
 * each of the seven field types would mean seven places to forget one.
 */
function wingBindFormDirty(host) {
  if (!host || host._wingDirtyBound) return;
  host._wingDirtyBound = true;
  host.addEventListener('input', wingMarkDirty);
  host.addEventListener('change', wingMarkDirty);
}

/* ── Links between wings ──────────────────────────────────────
   A Roadmap path names the Progression goal it serves, by id. Deleting the
   goal left the path pointing at nothing, and wingReaderMetaHTML skips a
   goalref it cannot resolve — so a broken link looked exactly like a path
   that never had one, and the id sat in the data until the next time anyone
   happened to open and re-save that path.
   ------------------------------------------------------------ */

/**
 * Clear every goalRef whose goal no longer exists.
 *
 * @returns {Array<{id:string, goalRef:string}>} what was cleared, so the
 *          caller can hand it to its own undo. Deleting a goal and undoing it
 *          should put the paths back too, not just the goal.
 */
function wingClearDeadGoalRefs() {
  const alive = {};
  wingItems('progression').forEach(g => { alive[g.id] = true; });
  const cleared = [];
  wingItems('roadmap').forEach(p => {
    const ref = p.data && p.data.goalRef;
    if (ref && !alive[ref]) {
      cleared.push({ id: p.id, goalRef: ref });
      p.data.goalRef = '';
    }
  });
  return cleared;
}

/** Put back what wingClearDeadGoalRefs cleared. */
function wingRestoreGoalRefs(cleared) {
  if (!cleared || !cleared.length) return;
  const paths = wingItems('roadmap');
  cleared.forEach(c => {
    const p = paths.find(x => x.id === c.id);
    if (p) { p.data = p.data || {}; p.data.goalRef = c.goalRef; }
  });
}

/* ── The image field's handlers ───────────────────────────────
   Downscaled before storing, because these libraries live in localStorage and
   a handful of full-size photographs would fill the quota and take the whole
   store down with them.
   ------------------------------------------------------------ */
function wingImagePick(key, input) {
  const host = document.getElementById('wing-x-' + key);
  const file = input && input.files && input.files[0];
  if (!host || !file) return;
  if (!/^image\//.test(file.type)) {
    if (typeof toast === 'function') toast('That is not an image file.', { type: 'warning' });
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    const done = (dataUrl) => {
      host.dataset.value = dataUrl;
      const prev = host.querySelector('.wing-img-preview');
      if (prev) prev.innerHTML = `<img src="${dataUrl}" alt="" />`;
      const rm = host.querySelector('.wing-img-actions button');
      if (rm) rm.disabled = false;
      if (typeof wingMarkDirty === 'function') wingMarkDirty();
    };
    if (typeof _downscaleImage === 'function') _downscaleImage(e.target.result, 640, 0.82, done);
    else done(e.target.result);
  };
  reader.readAsDataURL(file);
  input.value = '';        // so choosing the same file twice still fires
}

function wingImageClear(key) {
  const host = document.getElementById('wing-x-' + key);
  if (!host) return;
  host.dataset.value = '';
  const prev = host.querySelector('.wing-img-preview');
  if (prev) prev.innerHTML = '<span class="wing-img-empty"><i data-lucide="image"></i> No image</span>';
  const rm = host.querySelector('.wing-img-actions button');
  if (rm) rm.disabled = true;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: host });
  if (typeof wingMarkDirty === 'function') wingMarkDirty();
}
