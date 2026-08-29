/* ============================================================
   WING-COMMON.JS — the registry the seven wings plug into
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
  return `
    <div class="${extraClass}${libIsSelected('wing', w.id) ? ' lib-selected' : ''}"
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

/** Jump to another wing and open one entry there. */
function wingGoTo(key, id) {
  if (typeof event !== 'undefined' && event) event.stopPropagation();
  _wingKey = key;
  _wingFolderId = null;
  _wingActiveId = id;
  _wingEditing = null;
  const target = '#/wing?k=' + key;
  if (window.location.hash === target) {
    wingRenderSidebar(); wingRenderDetail(); wingUpdateHeader();
  } else {
    window.location.hash = target;
    // The route rebuilds the pane, so the entry has to be reopened after it.
    setTimeout(() => { _wingActiveId = id; wingRenderDetail(); }, 60);
  }
}
