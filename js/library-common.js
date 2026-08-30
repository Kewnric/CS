/* ============================================================
   LIBRARY-COMMON.JS — primitives shared by the Coding, Notes and
   Snippet libraries (and the generic "wing" libraries).
   ------------------------------------------------------------
   These three pages grew independently and drifted: each had its own filter
   storage, its own idea of what "search" covers, and only one of them surfaced
   the spaced-repetition scheduler that already tracks all three. Everything
   here exists so a change lands in all of them at once.

   Each library registers an adapter under its namespace ('browse', 'notebook',
   'snippet', or a wing key) so the shared bulk-selection bar can move, tag,
   favourite and delete without knowing anything about what it is holding.
   ============================================================ */

/* ── Preferences ──────────────────────────────────────────────
   Filters and sorts used to live in sessionStorage, so every one of them
   reset when the browser closed. They are a stated preference, not a scratch
   value — localStorage. (Page NUMBER stays per-session on purpose.) */

/**
 * Extra left inset on a LEAF row in a library tree, in rem.
 *
 * Nesting is already indented by `.tree-children { margin-left: 18px }` in
 * layout.css. Every tree here ALSO added a per-depth padding on top of that, so
 * one level of nesting cost ~29px and the tree read as a staircase. The padding
 * now carries only the row's own inset; the margin does the nesting, and a leaf
 * sits ~9px in from its folder because its chevron slot is narrowed instead
 * (see .tree-item-node in library.css).
 */
const TREE_ITEM_INSET = 0;

const LIB_PREF_KEY = 'libraryPrefs';
let _libPrefCache = null;

function _libPrefs() {
  if (_libPrefCache) return _libPrefCache;
  try {
    const raw = JSON.parse(localStorage.getItem(LIB_PREF_KEY));
    _libPrefCache = (raw && typeof raw === 'object') ? raw : {};
  } catch (e) {
    _libPrefCache = {};
  }
  return _libPrefCache;
}

function getLibPref(key, fallback) {
  const v = _libPrefs()[key];
  return v === undefined ? fallback : v;
}

function setLibPref(key, value) {
  const p = _libPrefs();
  if (value === null || value === undefined) delete p[key];
  else p[key] = value;
  try { localStorage.setItem(LIB_PREF_KEY, JSON.stringify(p)); }
  catch (e) { /* quota — prefs still hold for this session */ }
}

/* ── Search ───────────────────────────────────────────────────
   All three libraries used to match on title + tags only, which meant a
   snippet library you could not search by code and a notebook library you
   could not search by question text. */

/** Every piece of text a library item should be findable by. */
function libSearchText(item, kind) {
  if (!item) return [];
  const parts = [item.title, item.description, item.coverDescription];
  (item.tags || []).forEach(t => parts.push(t));

  if (kind === 'snippet') {
    parts.push(item.language, item.code, item.explanation);
    (item.examples || []).forEach(ex => { parts.push(ex.title, ex.code, ex.explanation); });
    (item.tryCoding || []).forEach(tc => { parts.push(tc.instruction, tc.starterCode); });
  } else if (kind === 'notebook') {
    // section.questions is a list of question NUMBERS; the text lives in
    // section.answerKeysData, keyed alongside each answer.
    (item.sections || []).forEach(s => {
      parts.push(s.label, s.title);
      (s.answerKeysData || []).forEach(k => {
        parts.push(k.question, k.explanation, k.hint);
        Object.values(k.choices || {}).forEach(c => parts.push(c));
        (k.pairs || []).forEach(p => parts.push(p.left, p.right));
      });
    });
  } else if (kind === 'challenge') {
    (item.variants || []).forEach(v => {
      parts.push(v.name, v.description);
      (v.files || []).forEach(f => parts.push(f.name + (f.ext || '')));
    });
  }
  return parts.filter(Boolean);
}

/**
 * Does this item match the search box?
 *
 * Title and tags are fuzzy-matched as before (so "clsfhr" still finds "Celsius
 * to Fahrenheit"); the deeper fields are plain substring matches, because fuzzy
 * matching a whole source file matches essentially everything.
 */
function libMatches(item, query, kind) {
  if (!query) return true;
  const q = String(query).toLowerCase();
  if (typeof fuzzyMatch === 'function') {
    if (fuzzyMatch(item.title, query)) return true;
    if ((item.tags || []).some(t => fuzzyMatch(t, query))) return true;
  } else if ((item.title || '').toLowerCase().includes(q)) {
    return true;
  }
  return libSearchText(item, kind).some(t => String(t).toLowerCase().includes(q));
}

/* ── Favourites ───────────────────────────────────────────── */

function libIsFavorite(item) { return !!(item && item.favorite); }

function libToggleFavorite(ns, id) {
  const a = LIB_ADAPTERS[ns];
  if (!a) return;
  const item = a.find(id);
  if (!item) return;
  item.favorite = !item.favorite;
  if (typeof saveData === 'function') saveData();
  if (typeof toast === 'function') {
    toast(item.favorite ? 'Added to favourites.' : 'Removed from favourites.', { type: 'success' });
  }
  a.rerender();
}

/** The star button that sits on every library card. */
function libFavButtonHTML(ns, item) {
  const on = libIsFavorite(item);
  return `<button class="lib-fav-btn${on ? ' on' : ''}" title="${on ? 'Remove from favourites' : 'Add to favourites'}"
    aria-pressed="${on}" onclick="event.stopPropagation(); libToggleFavorite('${ns}', '${item.id}')">
    <i data-lucide="star" style="width:14px;height:14px;${on ? 'fill:currentColor;' : ''}"></i>
  </button>`;
}

/* ── Spaced repetition, surfaced everywhere ───────────────────
   review.js already schedules challenges, notebooks AND snippets. Only the
   Snippet library ever showed it. */

function libReviewRec(type, id) {
  return (state.review && state.review[type + ':' + id]) || null;
}

/** 'new' | 'due' | 'learning' */
function libReviewStatus(type, id) {
  const r = libReviewRec(type, id);
  if (!r) return 'new';
  if (r.due && typeof _revToday === 'function' && r.due <= _revToday()) return 'due';
  return 'learning';
}

function libIsDue(type, id) { return libReviewStatus(type, id) === 'due'; }

/** How many items of this type are due today. */
function libDueCount(type, list) {
  return (list || []).filter(x => libIsDue(type, x.id)).length;
}

/** A compact "Due today" / "3d overdue" / "in 5d" chip for a card. */
function libReviewChipHTML(type, id) {
  const r = libReviewRec(type, id);
  if (!r || !r.due || typeof _revDaysBetween !== 'function' || typeof _revToday !== 'function') return '';
  const over = _revDaysBetween(r.due, _revToday());
  if (over >= 0) {
    const label = over === 0 ? 'Due today' : `${over}d overdue`;
    return `<span class="badge lib-due-badge${over > 0 ? ' over' : ''}" title="Scheduled by spaced repetition"><i data-lucide="brain" style="width:12px;height:12px;margin-right:2px;"></i>${label}</span>`;
  }
  return `<span class="badge badge-neutral lib-next-badge" title="Next review ${escapeHTML(r.due)}"><i data-lucide="clock" style="width:12px;height:12px;margin-right:2px;"></i>in ${-over}d</span>`;
}

/* ── Tags as a filter, not just decoration ────────────────── */

/** Tags actually present in this pool, most common first. */
function libTagPool(list, limit) {
  const counts = new Map();
  (list || []).forEach(it => (it.tags || []).forEach(t => counts.set(t, (counts.get(t) || 0) + 1)));
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit || 14)
    .map(([t, n]) => ({ tag: t, count: n }));
}

/** Clickable tag badge — sets the tag filter for this library. */
function libTagBadgeHTML(ns, tag) {
  return `<span class="badge badge-primary lib-tag-badge" title="Filter by “${escapeHTML(tag)}”"
    onclick="event.stopPropagation(); libSetTagFilter('${ns}', '${escapeHTML(String(tag)).replace(/'/g, '&#39;')}')">${escapeHTML(tag)}</span>`;
}

function libGetTagFilter(ns) { return getLibPref(ns + '.tag', 'all'); }

function libSetTagFilter(ns, tag) {
  const cur = libGetTagFilter(ns);
  setLibPref(ns + '.tag', cur === tag ? 'all' : tag);   // clicking the active tag clears it
  setSessionParam(ns === 'browse' ? 'browsePage' : ns + 'Page', 1);
  const a = LIB_ADAPTERS[ns];
  if (a) a.rerender();
}

/* ── Shared filter chips ──────────────────────────────────── */

function libChipHTML(active, onclick, label, title) {
  return `<button onclick="${onclick}" class="lib-chip${active ? ' active' : ''}"${title ? ` title="${escapeHTML(title)}"` : ''}>${label}</button>`;
}

/* ── Sort direction ───────────────────────────────────────────
   The sort menu offered orders but no way to flip one, so reading a list
   backwards meant picking a different sort entirely — and there was no
   one-click "alphabetical" at all. These sit in the filter panel beside the
   other chips, and apply on top of whichever sort is chosen. */

function libSortDir(ns) { return getLibPref(ns + '.sortDir', 'asc'); }

function libSetSortDir(ns, dir) {
  setLibPref(ns + '.sortDir', dir);
  const a = LIB_ADAPTERS[ns];
  if (a) a.rerender();
}

/** Apply the chosen direction to an already-sorted list. */
function libApplySortDir(ns, list) {
  return libSortDir(ns) === 'desc' ? list.slice().reverse() : list;
}

/**
 * What the list is ordered BY. Direction is a separate control, because
 * "Alphabetical" sitting between "Ascending" and "Descending" read as a third
 * direction rather than a different ordering.
 *
 * @param {string} ns       library namespace
 * @param {string} setSort  name of that library's sort setter, e.g. 'setBrowseSort'
 * @param {string} curSort  the sort currently chosen
 * @param {string} chrono   that library's value for "by date" — snippets track
 *                          reviews rather than attempts, so it is not the same
 *                          option everywhere
 */
function libSortTypeChipsHTML(ns, setSort, curSort, chrono) {
  const c = chrono || 'recent';
  return [
    // 'default' keeps the folder's own order, which is exactly the order set by
    // Arrange by hand in the admin — there is no separate app-imposed default.
    libChipHTML(curSort === 'default', `${setSort}('default')`, 'Custom',
      'The order you arranged in Admin'),
    libChipHTML(curSort === 'title', `${setSort}('title')`, 'Alphabetical', 'By title'),
    libChipHTML(curSort === c, `${setSort}('${c}')`, 'Chronological', 'By most recent activity')
  ].join('');
}

/** Which way round that ordering runs. */
function libSortDirChipsHTML(ns) {
  const dir = libSortDir(ns);
  return [
    libChipHTML(dir === 'asc', `libSetSortDir('${ns}','asc')`, 'Ascending', 'First to last'),
    libChipHTML(dir === 'desc', `libSetSortDir('${ns}','desc')`, 'Descending', 'Last to first')
  ].join('');
}

/** The Favourites / Due pair every library now carries. */
function libCommonChipsHTML(ns, reviewType, pool) {
  const fav = getLibPref(ns + '.fav', false);
  const due = getLibPref(ns + '.due', false);
  const favCount = (pool || []).filter(libIsFavorite).length;
  const dueCount = reviewType ? libDueCount(reviewType, pool) : 0;
  let html = '';
  if (favCount || fav) {
    html += libChipHTML(fav, `libToggleFlag('${ns}','fav')`,
      `<i data-lucide="star" style="width:12px;height:12px;${fav ? 'fill:currentColor;' : ''}"></i> ${favCount}`,
      'Show only favourites');
  }
  if (reviewType && (dueCount || due)) {
    html += libChipHTML(due, `libToggleFlag('${ns}','due')`,
      `<i data-lucide="brain" style="width:12px;height:12px;"></i> Due ${dueCount}`,
      'Show only what spaced repetition says is due today');
  }
  return html;
}

function libToggleFlag(ns, flag) {
  setLibPref(ns + '.' + flag, !getLibPref(ns + '.' + flag, false));
  setSessionParam(ns === 'browse' ? 'browsePage' : ns + 'Page', 1);
  const a = LIB_ADAPTERS[ns];
  if (a) a.rerender();
}

/** Just the tag chips, for callers that supply their own row wrapper. */
function _libTagChipsOnly(ns, pool) {
  const tags = libTagPool(pool);
  if (!tags.length) return '';
  const cur = libGetTagFilter(ns);
  return libChipHTML(cur === 'all', `libSetTagFilterExact('${ns}','all')`, 'Any') +
    tags.map(({ tag, count }) => libChipHTML(cur === tag,
      `libSetTagFilterExact('${ns}','${escapeHTML(tag).replace(/'/g, '&#39;')}')`,
      `${escapeHTML(tag)} <b>${count}</b>`)).join('');
}

/** Tag chip row with its own separator, rendered only when the pool has tags. */
function libTagChipsHTML(ns, pool) {
  const chips = _libTagChipsOnly(ns, pool);
  if (!chips) return '';
  return `<span class="lib-chip-sep" aria-hidden="true"></span>
    <div class="lib-chip-row"><i data-lucide="tag" style="width:13px;height:13px;color:var(--text-tertiary);"></i>${chips}</div>`;
}

function libSetTagFilterExact(ns, tag) {
  setLibPref(ns + '.tag', tag);
  setSessionParam(ns === 'browse' ? 'browsePage' : ns + 'Page', 1);
  const a = LIB_ADAPTERS[ns];
  if (a) a.rerender();
}

/** Apply the shared filters (favourite / due / tag) to a list. */
function libApplyCommonFilters(ns, list, reviewType) {
  let out = list;
  if (getLibPref(ns + '.fav', false)) out = out.filter(libIsFavorite);
  if (reviewType && getLibPref(ns + '.due', false)) out = out.filter(x => libIsDue(reviewType, x.id));
  const tag = libGetTagFilter(ns);
  if (tag && tag !== 'all') out = out.filter(x => (x.tags || []).includes(tag));
  return out;
}

function libAnyCommonFilterActive(ns) {
  return !!getLibPref(ns + '.fav', false) || !!getLibPref(ns + '.due', false) || libGetTagFilter(ns) !== 'all';
}

function libClearCommonFilters(ns) {
  setLibPref(ns + '.fav', false);
  setLibPref(ns + '.due', false);
  setLibPref(ns + '.tag', 'all');
}

/* ── The filter bar shell ─────────────────────────────────────
   Four rows of chips permanently open above the grid pushed the cards off the
   screen, and it mixed two different kinds of control: things that narrow WHAT
   you see (status, difficulty, level, tags, favourites, due) and things that
   change HOW it's laid out (ladder, programs-vs-sets, subfolders, sort). The
   first kind collapses behind a Filters button that carries a count and a
   summary of what's on; the second lives in its own View menu. */

function libFiltersOpen(ns) { return !!getLibPref(ns + '.filtersOpen', false); }

function libToggleFilters(ns) {
  const next = !libFiltersOpen(ns);
  setLibPref(ns + '.filtersOpen', next);
  // Re-rendering the pane just to reveal a few rows of chips rebuilt every card
  // on the page, so the whole list blinked. The panel is always in the DOM now
  // and opening it is a class change, which the browser can animate on its own.
  const shell = document.querySelector('.lib-filter-shell[data-ns="' + ns + '"]');
  if (shell) {
    shell.classList.toggle('open', next);
    const btn = shell.querySelector('.lib-filter-toggle');
    if (btn) btn.setAttribute('aria-expanded', String(next));
    return;
  }
  const a = LIB_ADAPTERS[ns];   // shell not on screen yet: fall back to a redraw
  if (a) a.rerender();
}

/**
 * @param {object} o
 *   .ns          library namespace
 *   .groups      [{ icon, chips }] rows inside the collapsible body
 *   .active      [{ label, clear }] what's currently narrowing the list
 *   .countLabel  "3 of 15"
 *   .view        HTML for the View menu body ('' hides the menu)
 *   .sort        the sort <select>
 *   .onClear     JS expression that resets every filter
 */
function libFilterShellHTML(o) {
  const open = libFiltersOpen(o.ns);
  const active = o.active || [];
  const groups = (o.groups || []).filter(g => g && g.chips);

  const summary = active.length
    ? `<div class="lib-filter-active">
         ${active.map(a => `<button class="lib-active-pill" onclick="${a.clear}" title="Remove this filter">
             ${a.label}<i data-lucide="x" style="width:11px;height:11px;"></i></button>`).join('')}
         <button class="lib-active-clear" onclick="${o.onClear}">Clear all</button>
       </div>`
    : '';

  // The body is always rendered; `open` on the shell is what shows it. The
  // chevron is one icon that rotates rather than two that swap, so the state
  // change never has to re-run the icon library.
  return `
    <div class="lib-filter-shell${open ? ' open' : ''}" data-ns="${o.ns}">
      <div class="lib-filter-head">
        <button class="lib-filter-toggle${active.length ? ' has-active' : ''}"
                onclick="libToggleFilters('${o.ns}')" aria-expanded="${open}">
          <i data-lucide="sliders-horizontal" style="width:13px;height:13px;"></i>
          Filters${active.length ? `<span class="lib-filter-count">${active.length}</span>` : ''}
          <i data-lucide="chevron-down" class="lib-filter-chev" style="width:13px;height:13px;"></i>
        </button>
        ${summary}
        <div class="lib-filter-tail">
          <span class="lib-filter-count-label">${o.countLabel || ''}</span>
          ${o.view ? `
          <details class="lib-view">
            <summary title="How the list is laid out"><i data-lucide="layout-grid" style="width:13px;height:13px;"></i> View <i data-lucide="chevron-down" class="lib-view-chev" style="width:12px;height:12px;"></i></summary>
            <div class="lib-view-pop">
              <div class="lib-view-title">Layout</div>
              ${o.view}
            </div>
          </details>` : ''}
          ${o.sort || ''}
        </div>
      </div>
      <div class="lib-filter-panel"><div class="lib-filter-clip">
        <div class="lib-filter-body">
          ${groups.map(g => `<div class="lib-chip-row${g.wrap ? ' lib-chip-row-wrap' : ''}">${g.icon ? `<i data-lucide="${g.icon}" style="width:13px;height:13px;color:var(--text-tertiary);"></i>` : ''}${g.chips}</div>`).join('')}
          ${active.length ? `<button class="lib-active-clear" onclick="${o.onClear}">Clear all filters</button>` : ''}
        </div>
      </div></div>
    </div>`;
}

/**
 * Fold a long chip row down to `keep` chips behind a "+N" button. Tags are
 * user-created and unbounded — twenty of them turned the filter panel into a
 * wall of pills that pushed the results off the screen.
 * @param {string} chipsHtml the row's chips, already rendered
 * @param {number} keep how many to show before the fold
 */
function libFoldChips(chipsHtml, keep) {
  const parts = String(chipsHtml || '').split(/(?=<button|<span class="lib-)/).filter(x => x.trim());
  const max = keep || 8;
  if (parts.length <= max + 1) return chipsHtml;
  const id = 'chiprow-' + Math.random().toString(36).slice(2, 8);
  const hidden = parts.length - max;
  return `<span id="${id}-shown">${parts.slice(0, max).join('')}</span>` +
    `<span id="${id}-rest" hidden>${parts.slice(max).join('')}</span>` +
    `<button class="lib-chip-more" onclick="libUnfoldChips('${id}', this)">+${hidden} more</button>`;
}

function libUnfoldChips(id, btn) {
  const rest = document.getElementById(id + '-rest');
  if (rest) rest.hidden = false;
  if (btn) btn.remove();
}

// One handler for every View menu: a <details> stays open until something else
// is clicked, which is not what a dropdown should do.
document.addEventListener('click', (e) => {
  document.querySelectorAll('details.lib-view[open]').forEach(d => {
    if (!d.contains(e.target)) d.removeAttribute('open');
  });
});

/* ── Cover fallback ───────────────────────────────────────────
   Items without a cover image used to render a flat card, which made a grid of
   them hard to scan. A stable colour + monogram derived from the title gives
   every card a distinct silhouette without anyone uploading anything. */

function libCoverFallbackHTML(title, icon) {
  const t = String(title || '?');
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) % 360;
  const initials = t.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?';
  return `<div class="nb-card-cover lib-cover-fallback" aria-hidden="true"
      style="--c1:hsl(${h} 58% 32%); --c2:hsl(${(h + 42) % 360} 62% 18%);">
      ${icon ? `<i data-lucide="${icon}"></i>` : `<span class="lib-cover-initials">${escapeHTML(initials)}</span>`}
    </div>`;
}

/* ── Bulk selection ───────────────────────────────────────────
   One selection model for every library. A library registers an adapter and
   gets select-mode, a floating action bar, and move/tag/favourite/delete. */

const LIB_ADAPTERS = {};

/**
 * @param {string} ns  'browse' | 'notebook' | 'snippet' | wing key
 * @param {object} adapter
 *   .scope     folder scope for "move to…"
 *   .noun      singular display noun ('program')
 *   .list()    every item in this library
 *   .find(id)  one item
 *   .remove(id, done)  soft-delete one item
 *   .rerender()
 */
function registerLibAdapter(ns, adapter) { LIB_ADAPTERS[ns] = adapter; }

let _libSel = { ns: null, ids: new Set() };

function libSelectMode(ns) { return _libSel.ns === ns; }
function libIsSelected(ns, id) { return _libSel.ns === ns && _libSel.ids.has(id); }

function libToggleSelectMode(ns) {
  if (_libSel.ns === ns) _libSel = { ns: null, ids: new Set() };
  else _libSel = { ns, ids: new Set() };
  const a = LIB_ADAPTERS[ns];
  if (a) a.rerender();
}

function libToggleSelect(ns, id) {
  if (_libSel.ns !== ns) _libSel = { ns, ids: new Set() };
  if (_libSel.ids.has(id)) _libSel.ids.delete(id); else _libSel.ids.add(id);
  const a = LIB_ADAPTERS[ns];
  if (a) a.rerender();
}

function libSelectAll(ns, ids) {
  if (_libSel.ns !== ns) _libSel = { ns, ids: new Set() };
  const all = ids.every(id => _libSel.ids.has(id));
  ids.forEach(id => { if (all) _libSel.ids.delete(id); else _libSel.ids.add(id); });
  const a = LIB_ADAPTERS[ns];
  if (a) a.rerender();
}

/** Checkbox overlay for a card while select-mode is on. */
function libSelectBoxHTML(ns, id) {
  if (!libSelectMode(ns)) return '';
  const on = libIsSelected(ns, id);
  return `<button class="lib-select-box${on ? ' on' : ''}" role="checkbox" aria-checked="${on}"
    onclick="event.stopPropagation(); libToggleSelect('${ns}', '${id}')" title="Select">
    ${on ? '<i data-lucide="check" style="width:12px;height:12px;"></i>' : ''}
  </button>`;
}

/** Toolbar button that turns select-mode on and off. */
function libSelectToggleHTML(ns) {
  const on = libSelectMode(ns);
  return `<button class="btn btn-ghost lib-select-toggle${on ? ' active' : ''}" onclick="libToggleSelectMode('${ns}')"
    title="${on ? 'Leave selection mode' : 'Select several at once'}" style="padding:0.5rem;">
    <i data-lucide="${on ? 'x' : 'list-checks'}" style="width:16px;height:16px;"></i>
  </button>`;
}

/** The floating bar shown while items are selected. */
function libSelectionBarHTML(ns, visibleIds) {
  if (!libSelectMode(ns)) return '';
  const a = LIB_ADAPTERS[ns] || {};
  const n = _libSel.ids.size;
  const noun = a.noun || 'item';
  const ids = JSON.stringify(visibleIds || []).replace(/"/g, '&quot;');
  return `<div class="lib-bulk-bar">
    <span class="lib-bulk-count">${n} ${escapeHTML(noun)}${n === 1 ? '' : 's'} selected</span>
    <button class="btn btn-secondary btn-sm" onclick="libSelectAll('${ns}', ${ids})"><i data-lucide="check-square" style="width:13px;height:13px;"></i> All on this page</button>
    <span class="lib-bulk-sep"></span>
    <button class="btn btn-secondary btn-sm" ${n ? '' : 'disabled'} onclick="libBulkMove('${ns}')"><i data-lucide="move" style="width:13px;height:13px;"></i> Move…</button>
    <button class="btn btn-secondary btn-sm" ${n ? '' : 'disabled'} onclick="libBulkTag('${ns}')"><i data-lucide="tag" style="width:13px;height:13px;"></i> Tag…</button>
    <button class="btn btn-secondary btn-sm" ${n ? '' : 'disabled'} onclick="libBulkFavorite('${ns}')"><i data-lucide="star" style="width:13px;height:13px;"></i> Favourite</button>
    ${typeof a.bulkExtra === 'function' ? a.bulkExtra(n) : ''}
    <button class="btn btn-danger btn-sm" ${n ? '' : 'disabled'} onclick="libBulkDelete('${ns}')"><i data-lucide="trash-2" style="width:13px;height:13px;"></i> Delete</button>
    <button class="btn btn-ghost btn-sm" onclick="libToggleSelectMode('${ns}')">Done</button>
  </div>`;
}

function libSelectedIds(ns) { return _libSel.ns === ns ? [..._libSel.ids] : []; }

function _libSelectedItems(ns) {
  const a = LIB_ADAPTERS[ns];
  if (!a) return [];
  return [..._libSel.ids].map(id => a.find(id)).filter(Boolean);
}

function libBulkMove(ns) {
  const a = LIB_ADAPTERS[ns];
  const items = _libSelectedItems(ns);
  if (!a || !items.length) return;
  // showListPickerDialog prepends its own "Root (no parent)" → value null.
  const opts = [];
  const walk = (pid, d) => {
    (typeof getChildFolders === 'function' ? getChildFolders(pid, a.scope) : []).forEach(f => {
      opts.push({ value: f.id, label: '— '.repeat(d) + f.name });
      walk(f.id, d + 1);
    });
  };
  walk(null, 0);
  if (typeof showListPickerDialog !== 'function') return;
  showListPickerDialog('Move to folder', `Move ${items.length} ${a.noun}${items.length === 1 ? '' : 's'} to:`,
    opts, (target) => {
      items.forEach(it => { it.parentId = target || null; });
      if (typeof saveData === 'function') saveData();
      if (typeof toast === 'function') toast(`Moved ${items.length} ${a.noun}${items.length === 1 ? '' : 's'}.`, { type: 'success' });
      libToggleSelectMode(ns);
    });
}

function libBulkTag(ns) {
  const a = LIB_ADAPTERS[ns];
  const items = _libSelectedItems(ns);
  if (!a || !items.length || typeof showInputDialog !== 'function') return;
  showInputDialog('Add a tag', `Applied to ${items.length} ${a.noun}${items.length === 1 ? '' : 's'}. Commas for several.`,
    'e.g. pointers', '', (val) => {
      const tags = String(val || '').split(',').map(t => t.trim()).filter(Boolean);
      if (!tags.length) return;
      items.forEach(it => {
        if (!Array.isArray(it.tags)) it.tags = [];
        tags.forEach(t => { if (!it.tags.includes(t)) it.tags.push(t); });
      });
      if (typeof saveData === 'function') saveData();
      if (typeof toast === 'function') toast(`Tagged ${items.length} ${a.noun}${items.length === 1 ? '' : 's'}.`, { type: 'success' });
      libToggleSelectMode(ns);
    });
}

function libBulkFavorite(ns) {
  const a = LIB_ADAPTERS[ns];
  const items = _libSelectedItems(ns);
  if (!a || !items.length) return;
  // Mixed selection → favourite everything; all-favourited → clear them.
  const allOn = items.every(libIsFavorite);
  items.forEach(it => { it.favorite = !allOn; });
  if (typeof saveData === 'function') saveData();
  if (typeof toast === 'function') toast(allOn ? 'Removed from favourites.' : `Favourited ${items.length}.`, { type: 'success' });
  libToggleSelectMode(ns);
}

function libBulkDelete(ns) {
  const a = LIB_ADAPTERS[ns];
  const items = _libSelectedItems(ns);
  if (!a || !items.length || !a.remove) return;
  const n = items.length;
  const go = () => {
    // removeMany, when the adapter has one, so a bulk delete is a single undo
    // rather than one per item. Adapters without it keep the per-item loop
    // exactly as before.
    if (typeof a.removeMany === 'function') a.removeMany(items.map(it => it.id));
    // Delete in one pass, then re-render once — each remove() saves on its own.
    else items.forEach(it => a.remove(it.id));
    if (typeof saveData === 'function') saveData();
    if (typeof toast === 'function') toast(`Deleted ${n} ${a.noun}${n === 1 ? '' : 's'}.`, { type: 'success' });
    libToggleSelectMode(ns);
  };
  if (typeof showConfirm === 'function') {
    showConfirm(`Delete ${n} ${a.noun}${n === 1 ? '' : 's'}?`,
      'They move to the recycle bin and can be restored from there.', go);
  } else { go(); }
}

/* ── The pseudo-folder's mode ──────────────────────────────────
   "Uncategorized" is a view over the data, not a place, so it can just as
   usefully be a view over the FAVOURITES. Right-clicking the row cycles
   between the two; the setting is per library and persists.

   Favourites is a cross-folder view: an item keeps whatever folder it lives
   in, which is why dropping onto the row in that mode stars the item rather
   than moving it. */
const LIB_ROOT_MODES = ['uncategorized', 'favorites'];

const LIB_ROOT_META = {
  uncategorized: {
    label: 'Uncategorized',
    icon: 'inbox',
    hint: 'Programs that are not in any folder',
    next: 'Show favourites instead'
  },
  favorites: {
    label: 'Favourites',
    icon: 'star',
    hint: 'Everything you have starred, wherever it lives',
    next: 'Show uncategorized instead'
  }
};

function libRootMode(ns) {
  const v = getLibPref(ns + '.rootMode', 'uncategorized');
  return LIB_ROOT_MODES.indexOf(v) === -1 ? 'uncategorized' : v;
}

function libRootMeta(ns) { return LIB_ROOT_META[libRootMode(ns)]; }

/** Step to the next mode and redraw. */
function libCycleRootMode(ns) {
  const cur = libRootMode(ns);
  const next = LIB_ROOT_MODES[(LIB_ROOT_MODES.indexOf(cur) + 1) % LIB_ROOT_MODES.length];
  setLibPref(ns + '.rootMode', next);
  const host = (typeof TREE_HOSTS !== 'undefined') ? TREE_HOSTS[ns] : null;
  if (host && host.rerender) host.rerender();
  else {
    const a = LIB_ADAPTERS[ns];
    if (a && a.rerender) a.rerender();
  }
  if (typeof treeAnnounce === 'function') treeAnnounce(LIB_ROOT_META[next].label + ' shown');
}

/**
 * What the pseudo-folder should list right now.
 * @param {string} ns
 * @param {Array} all every item in this library
 * @param {Array} [sets] practice sets, coding library only
 */
function libRootItems(ns, all, sets) {
  const pool = (all || []).concat(sets || []);
  if (libRootMode(ns) === 'favorites') return pool.filter(libIsFavorite);
  // An item whose folder no longer exists used to match neither "in a folder"
  // nor "uncategorized", so it vanished from every view while still sitting in
  // state, counting toward totals and taking up storage. A parent that does not
  // resolve is treated as no parent, so the item stays reachable.
  const folders = new Set((state.nodes || []).map(n => n.id));
  return pool.filter(x => {
    const pid = x.parentId || null;
    return pid === null || !folders.has(pid);
  });
}

/**
 * Dropping onto the pseudo-folder while it is showing Favourites stars the
 * items rather than moving them — favourites is a view, not a location, so a
 * move would be meaningless and a refusal would be unhelpful.
 * @returns {boolean} true when the drop was consumed
 */
function libRootDropInto(ns, targetId, ids, find) {
  if (targetId !== '__root__' || libRootMode(ns) !== 'favorites') return false;
  let added = 0;
  (ids || []).forEach(id => {
    const it = find(id);
    if (it && !it.favorite) { it.favorite = true; added++; }
  });
  const host = (typeof TREE_HOSTS !== 'undefined') ? TREE_HOSTS[ns] : null;
  // Brain keeps its versions outside `state`, so saveData() would drop the star.
  if (added) {
    if (host && host.save) host.save();
    else if (typeof saveData === 'function') saveData();
  }
  if (host && host.rerender) host.rerender();
  if (typeof toast === 'function') {
    toast(added ? `Added ${added} to favourites.` : 'Already in favourites.',
      { type: added ? 'success' : 'info' });
  }
  return true;
}

/** True while the pseudo-folder is a drop target for starring. */
function libRootAcceptsDrop(ns, targetId) {
  return targetId === '__root__' && libRootMode(ns) === 'favorites';
}
