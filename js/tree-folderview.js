/* ============================================================
   TREE FOLDER VIEW -- every library tree as a list, or as folders
   ============================================================
   A slim bar above each library tree switches it between the List it has
   always been and a Folder view like a file explorer's: the contents of one
   folder at a time as big icons, a path to climb back up, double-click a
   folder to go into it.

   The Folder view is drawn from the tree's own rows rather than from each
   library's data, so it works the same on Coding, Notes, Snippets and the
   Analytics sidebars without any of them knowing. The list stays in the page,
   hidden, and the icons act through it: a click on an icon is a click on its
   row (it opens in pane 2 exactly as before), a right-click opens the row's
   own menu. When pane 2 moves somewhere else -- a subfolder tile, a
   breadcrumb -- the Folder view follows it there.

   Per tree, per device: which view (ssp.treeView.<container id>) and the
   folder it was showing (ssp.treeView.<container id>.at).
   ============================================================ */

const TFV_KEY = 'ssp.treeView.';
const TFV = {};   // container id -> { at, lastActive, own, raf }

function _tfvGet(k, dflt) { try { const v = localStorage.getItem(k); return v === null ? dflt : v; } catch (e) { return dflt; } }
function _tfvSet(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { /* private mode */ } }

function tfvMode(c) { return _tfvGet(TFV_KEY + c.id, 'list') === 'icons' ? 'icons' : 'list'; }

function _tfvState(c) {
  if (!TFV[c.id]) TFV[c.id] = { at: _tfvGet(TFV_KEY + c.id + '.at', ''), lastActive: null, own: null, raf: 0 };
  return TFV[c.id];
}

/* The tree's shape, read off its rows: a node's parent is the nearest
   .tree-node around it, and a node is a folder when it has children to open. */
function _tfvNodes(c) { return Array.from(c.querySelectorAll('.tree-node[data-node-id]')); }
function _tfvParent(n, c) {
  const p = n.parentElement && n.parentElement.closest('.tree-node[data-node-id]');
  return p && c.contains(p) ? p : null;
}
function _tfvIsFolder(n) { return !!n.querySelector(':scope > .tree-children'); }
function _tfvRow(n) { return n.querySelector(':scope > .tree-node-row'); }
function _tfvFind(c, id) {
  return id ? _tfvNodes(c).find(n => n.getAttribute('data-node-id') === id) || null : null;
}
function _tfvLabel(n) {
  const l = n.querySelector(':scope > .tree-node-row .tree-node-label');
  return l ? l.textContent.trim() : '';
}
function _tfvIconName(n, folder) {
  const ic = n.querySelector(':scope > .tree-node-row .tree-node-icon');
  let name = ic && ic.getAttribute('data-lucide');
  if (!name && ic) {
    const m = /(?:^|\s)lucide-([a-z0-9-]+)/.exec(ic.getAttribute('class') || '');
    if (m && m[1] !== 'icon') name = m[1];
  }
  return name || (folder ? 'folder' : 'file');
}

/** Attach the bar (once) and draw whichever view the tree is in. */
function tfvSync(c) {
  if (!c || !c.id || !c.isConnected) return;
  const has = !!c.querySelector('.tree-node[data-node-id]');
  let bar = c.previousElementSibling && c.previousElementSibling.classList.contains('tfv-bar') ? c.previousElementSibling : null;
  let view = c.nextElementSibling && c.nextElementSibling.classList.contains('tfv-view') ? c.nextElementSibling : null;
  if (!has && !bar) return;   // not a tree (yet)
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'tfv-bar';
    bar.setAttribute('data-for', c.id);
    c.parentNode.insertBefore(bar, c);
  }
  if (!view) {
    view = document.createElement('div');
    view.className = 'pane-1-content tfv-view';
    view.setAttribute('data-for', c.id);
    view.setAttribute('role', 'listbox');
    view.setAttribute('aria-label', 'Folder contents');
    c.parentNode.insertBefore(view, c.nextSibling);
    _tfvBindView(view, c);
  }
  const icons = tfvMode(c) === 'icons' && has;
  c.classList.toggle('tfv-hidden', icons);
  view.classList.toggle('hidden', !icons);
  bar.classList.toggle('is-icons', icons);
  bar.classList.toggle('hidden', !has);
  if (icons) _tfvDraw(c, view);
  _tfvDrawBar(c, bar, icons);
}

function _tfvDrawBar(c, bar, icons) {
  const st = _tfvState(c);
  let crumbs = '';
  const q = icons ? _tfvQuery(c) : '';
  if (q) {
    crumbs = '<span class="tfv-results"><i data-lucide="search"></i><span>Matches for “' + escapeHTML(q) + '”</span></span>';
  } else if (icons) {
    const path = [];
    let n = _tfvFind(c, st.at);
    while (n) { path.unshift(n); n = _tfvParent(n, c); }
    crumbs = '<button type="button" class="tfv-up" data-tfv-go="' + (path.length > 1 ? path[path.length - 2].getAttribute('data-node-id') : '') + '"'
      + (path.length ? '' : ' disabled') + ' title="Up one folder (Backspace)" aria-label="Up one folder"><i data-lucide="arrow-up"></i></button>'
      + '<nav class="tfv-crumbs" aria-label="Folder path">'
      + '<button type="button" class="tfv-crumb' + (path.length ? '' : ' is-here') + '" data-tfv-go="" title="Top level"><i data-lucide="house"></i></button>'
      + path.map((p, i) => '<i data-lucide="chevron-right" class="tfv-sep"></i><button type="button" class="tfv-crumb' + (i === path.length - 1 ? ' is-here' : '') + '" data-tfv-go="' + p.getAttribute('data-node-id') + '">' + escapeHTML(_tfvLabel(p)) + '</button>').join('')
      + '</nav>';
  }
  const mode = icons ? 'icons' : 'list';
  const key = mode + '|' + crumbs;
  if (bar._tfvKey === key) return;
  bar._tfvKey = key;
  bar.innerHTML = '<div class="tfv-path">' + crumbs + '</div>'
    + '<div class="tfv-seg" role="radiogroup" aria-label="Tree layout">'
    + '<button type="button" class="tfv-seg-btn' + (icons ? '' : ' is-on') + '" role="radio" aria-checked="' + !icons + '" data-tfv-mode="list" title="List"><i data-lucide="list-tree"></i></button>'
    + '<button type="button" class="tfv-seg-btn' + (icons ? ' is-on' : '') + '" role="radio" aria-checked="' + icons + '" data-tfv-mode="icons" title="Folders: big icons, double-click to open"><i data-lucide="layout-grid"></i></button>'
    + '</div>';
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: bar });
}

function _tfvDraw(c, view) {
  const st = _tfvState(c);
  // Follow pane 2: when the open row changed and it was not one of our icons
  // that did it, show the folder it is in (or the folder itself).
  const activeRow = c.querySelector('.tree-node-row.active');
  const activeNode = activeRow && activeRow.closest('.tree-node[data-node-id]');
  const activeId = activeNode ? activeNode.getAttribute('data-node-id') : null;
  if (activeId !== st.lastActive) {
    // Ours when it is the icon just clicked -- however late the library
    // redraws -- so a single click on a folder selects it and stays put.
    const own = st.own && st.own.id === activeId && performance.now() - st.own.at < 1500;
    if (!own && activeNode) {
      const home = _tfvIsFolder(activeNode) ? activeNode : _tfvParent(activeNode, c);
      st.at = home ? home.getAttribute('data-node-id') : '';
    }
    if (own) st.own = null;
    st.lastActive = activeId;
  }
  // A folder that is missing (a search filtered it out, or it was deleted)
  // shows the top level, but stays the one to come back to.
  let here = _tfvFind(c, st.at);
  if (here && !_tfvIsFolder(here)) { here = _tfvParent(here, c); st.at = here ? here.getAttribute('data-node-id') : ''; }
  _tfvSet(TFV_KEY + c.id + '.at', st.at);

  // The eye that hides a library's items hides their icons too; and while the
  // pane is searched, the matches are shown together, wherever they live.
  const hideItems = c.classList.contains('hide-tree-items');
  const q = _tfvQuery(c);
  let folders, items;
  if (q) {
    const all = _tfvNodes(c);
    items = hideItems ? [] : all.filter(n => !_tfvIsFolder(n));
    folders = hideItems ? all.filter(_tfvIsFolder) : [];
  } else {
    const kids = _tfvNodes(c).filter(n => _tfvParent(n, c) === here);
    folders = kids.filter(_tfvIsFolder);
    items = hideItems ? [] : kids.filter(n => !_tfvIsFolder(n));
  }
  const tile = n => {
    const id = n.getAttribute('data-node-id');
    const folder = _tfvIsFolder(n);
    const row = _tfvRow(n);
    const icon = _tfvIconName(n, folder);
    const badge = row && row.querySelector('.tree-node-badge');
    const count = folder ? (badge ? badge.textContent.trim() : String(n.querySelectorAll('.tree-node[data-node-id]').length)) : '';
    // The folder's own colour, else the one its pane 2 tile wears.
    let accent = n.style.getPropertyValue('--icon-accent') || n.style.getPropertyValue('--row-accent') || '';
    if (!accent && folder && typeof libFolderColor === 'function' && typeof state !== 'undefined') {
      const rec = (state.nodes || []).find(x => x.id === id);
      if (rec) accent = libFolderColor(rec);
    }
    const label = _tfvLabel(n);
    return '<div class="tfv-tile ' + (folder ? 'is-folder' : 'is-item') + (row && row.classList.contains('active') ? ' is-active' : '') + '"'
      + ' role="option" tabindex="0" data-tfv-id="' + id + '" title="' + escapeHTML(label) + (folder ? ' (double-click to open)' : '') + '"'
      + (accent ? ' style="--tfv-c:' + accent + ';"' : '') + '>'
      + '<span class="tfv-glyph" aria-hidden="true">'
      + (folder ? '<span class="tfv-tab"></span>' : '<span class="tfv-fold"></span>')
      + (folder && icon === 'folder' ? '' : '<i data-lucide="' + escapeHTML(icon) + '"></i>')
      + (row && row.querySelector('.tree-node-lock') ? '<span class="tfv-mark is-lock"><i data-lucide="lock"></i></span>' : '')
      + (row && row.querySelector('.tree-node-star') ? '<span class="tfv-mark is-star"><i data-lucide="star"></i></span>' : '')
      + '</span>'
      + '<span class="tfv-name">' + escapeHTML(label) + '</span>'
      + (count && count !== '0' ? '<span class="tfv-count">' + escapeHTML(count) + '</span>' : '')
      + '</div>';
  };
  const html = folders.length || items.length
    ? '<div class="tfv-grid">' + folders.map(tile).join('') + items.map(tile).join('') + '</div>'
    : '<div class="tfv-empty"><i data-lucide="' + (q ? 'search-x' : 'folder-open') + '"></i><span>'
      + (q ? 'Nothing here matches “' + escapeHTML(q) + '”' : 'This folder is empty') + '</span></div>';
  if (view._tfvHtml === html) return;   // nothing moved: keep focus and scroll
  const scrolled = view._tfvAt === st.at ? view.scrollTop : 0;
  view._tfvHtml = html;
  view._tfvAt = st.at;
  view.innerHTML = html;
  view.scrollTop = scrolled;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: view });
}

/* What the icons do, through the hidden rows. */
function _tfvFire(row, type, e) {
  if (!row) return;
  row.dispatchEvent(new MouseEvent(type, {
    bubbles: true, cancelable: true, view: window,
    clientX: e.clientX, clientY: e.clientY, button: type === 'contextmenu' ? 2 : 0,
    ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey, altKey: e.altKey
  }));
}

function tfvGo(c, id) {
  _tfvState(c).at = id || '';
  tfvSync(c);
}

/* What the pane's search box holds: its tree is showing matches. */
function _tfvQuery(c) {
  const box = c.parentElement && c.parentElement.querySelector('input.search-input');
  return box ? box.value.trim() : '';
}

/** The icon about to be clicked: when its row becomes the open one, that was us. */
function _tfvOwn(c, n) { _tfvState(c).own = { id: n.getAttribute('data-node-id'), at: performance.now() }; }

function _tfvBindView(view, c) {
  const nodeOf = el => { const t = el.closest && el.closest('.tfv-tile'); return t ? _tfvFind(c, t.getAttribute('data-tfv-id')) : null; };
  view.addEventListener('click', e => {
    const n = nodeOf(e.target);
    if (!n) return;
    view.querySelectorAll('.tfv-tile.is-sel').forEach(t => t.classList.remove('is-sel'));
    e.target.closest('.tfv-tile').classList.add('is-sel');
    _tfvOwn(c, n);
    _tfvFire(_tfvRow(n), 'click', e);
    _tfvQueue(c);   // the open row's highlight moves even if the tree did not redraw
  });
  view.addEventListener('dblclick', e => {
    const n = nodeOf(e.target);
    if (n && _tfvIsFolder(n)) { e.preventDefault(); tfvGo(c, n.getAttribute('data-node-id')); }
  });
  view.addEventListener('contextmenu', e => {
    const n = nodeOf(e.target);
    if (n) { e.preventDefault(); _tfvFire(_tfvRow(n), 'contextmenu', e); return; }
    // The empty space is the tree's empty space: its own menu (New folder...),
    // where the library has one; otherwise the browser's.
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, view: window, clientX: e.clientX, clientY: e.clientY, button: 2 });
    if (!c.dispatchEvent(ev)) e.preventDefault();
  });
  view.addEventListener('keydown', e => {
    const t = e.target.closest && e.target.closest('.tfv-tile');
    if (e.key === 'Backspace' || (e.key === 'ArrowUp' && e.altKey)) {
      const here = _tfvFind(c, _tfvState(c).at);
      if (!here) return;
      e.preventDefault();
      const up = _tfvParent(here, c);
      tfvGo(c, up ? up.getAttribute('data-node-id') : '');
      const back = view.querySelector('.tfv-tile[data-tfv-id="' + here.getAttribute('data-node-id') + '"]');
      if (back) back.focus();
      return;
    }
    if (!t) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      const n = nodeOf(t);
      if (n && _tfvIsFolder(n)) {
        tfvGo(c, n.getAttribute('data-node-id'));
        const first = view.querySelector('.tfv-tile');
        if (first) first.focus();
      } else if (n) { _tfvOwn(c, n); _tfvFire(_tfvRow(n), 'click', e); _tfvQueue(c); }
      return;
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const all = Array.from(view.querySelectorAll('.tfv-tile'));
      const i = all.indexOf(t) + (e.key === 'ArrowRight' ? 1 : -1);
      if (all[i]) { e.preventDefault(); all[i].focus(); }
    }
  });
}

/* The bar's buttons, for every tree at once. */
document.addEventListener('click', e => {
  const btn = e.target.closest && e.target.closest('.tfv-bar button');
  if (!btn) return;
  const bar = btn.closest('.tfv-bar');
  const c = document.getElementById(bar.getAttribute('data-for'));
  if (!c) return;
  if (btn.hasAttribute('data-tfv-mode')) {
    _tfvSet(TFV_KEY + c.id, btn.getAttribute('data-tfv-mode') === 'icons' ? 'icons' : '');
    const st = _tfvState(c);
    st.lastActive = undefined;   // entering the view: start where pane 2 is
    tfvSync(c);
  } else if (btn.hasAttribute('data-tfv-go')) {
    tfvGo(c, btn.getAttribute('data-tfv-go'));
  }
});

/* A tree redraws by replacing rows, or in place by moving classes (the open
   row's .active, a folder's .collapsed); lucide then swaps its icons in. One
   watcher on the page notices either inside a .tree-container and redraws
   that tree's bar and view on the next frame. */
function _tfvQueue(c) {
  const st = _tfvState(c);
  if (st.raf) return;
  st.raf = requestAnimationFrame(() => { st.raf = 0; tfvSync(c); });
}

if (typeof MutationObserver !== 'undefined') {
  new MutationObserver(records => {
    for (let i = 0; i < records.length; i++) {
      const t = records[i].target;
      const c = t.nodeType === 1 && (t.classList.contains('tree-container') ? t : t.closest('.tree-container'));
      if (c && c.id) _tfvQueue(c);
    }
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
}
