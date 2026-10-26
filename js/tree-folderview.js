/* ============================================================
   TREE FOLDER VIEW -- every library tree as a list, or as folders
   ============================================================
   A List / Folders switch in each tree's pane header (beside its other
   header buttons) turns the tree into a view like a file explorer's: the
   contents of one folder at a time as big icons. Double-click a folder to go
   into it; Back (or Backspace) goes back out. The path itself is not repeated
   here -- pane 2 already shows it.

   The view is drawn from the tree's own rows rather than from each library's
   data, so it works the same on Coding, Notes, Snippets, Brain and the
   Analytics sidebars without any of them knowing. The list stays in the page,
   hidden, and the icons act through it: a click on an icon is a click on its
   row (it opens in pane 2 exactly as before), a right-click opens the row's
   own menu. When pane 2 moves somewhere else -- a subfolder tile, a
   breadcrumb -- the view follows it there.

   One switch for every tree (ssp.treeView), since they are all the same kind
   of thing; each tree remembers its own folder (ssp.treeView.<id>.at).
   ============================================================ */

const TFV_KEY = 'ssp.treeView';
const TFV_SEL = '.tree-container, #viz-content-body';
const TFV = {};   // container id -> { at, lastActive, own, sel, navAt, raf }

function _tfvGet(k, dflt) { try { const v = localStorage.getItem(k); return v === null ? dflt : v; } catch (e) { return dflt; } }
function _tfvSet(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { /* private mode */ } }

/* The switch used to be per tree (ssp.treeView.<id>); a tree left in Folders
   carries the setting over to the one switch. */
(function _tfvMigrate() {
  try {
    if (localStorage.getItem(TFV_KEY) !== null) return;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k || !/^ssp\.treeView\.[^.]+$/.test(k)) continue;
      if (localStorage.getItem(k) === 'icons') localStorage.setItem(TFV_KEY, 'icons');
      localStorage.removeItem(k);
    }
  } catch (e) { /* private mode */ }
})();

function tfvMode() { return _tfvGet(TFV_KEY, '') === 'icons' ? 'icons' : 'list'; }

function _tfvState(c) {
  if (!TFV[c.id]) TFV[c.id] = { at: _tfvGet(TFV_KEY + '.' + c.id + '.at', ''), lastActive: null, own: null, sel: null, navAt: -1e9, raf: 0 };
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

/* What the pane's search box holds: its tree is showing matches. */
function _tfvQuery(c) {
  const box = c.parentElement && c.parentElement.querySelector('input.search-input');
  return box ? box.value.trim() : '';
}

/** Put the switch in place and draw whichever view the tree is in. */
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
    bar.innerHTML = '<div class="tfv-bar-main"></div>';
    c.parentNode.insertBefore(bar, c);
  }
  if (!view) {
    view = document.createElement('div');
    view.className = 'tfv-view hidden ' + (c.id === 'viz-content-body' ? 'viz-content-body' : 'pane-1-content');
    view.setAttribute('data-for', c.id);
    view.setAttribute('role', 'listbox');
    view.setAttribute('aria-label', 'Folder contents');
    c.parentNode.insertBefore(view, c.nextSibling);
    _tfvBindView(view, c);
  }
  _tfvSeg(c, bar, has);
  const icons = tfvMode() === 'icons' && has;
  c.classList.toggle('tfv-hidden', icons);
  view.classList.toggle('hidden', !icons);
  if (icons) _tfvDraw(c, view);
  _tfvDrawBar(c, bar, icons);
}

/* The switch sits in the pane's header, just before its menu (Coding) or its
   show/hide-items eye (everywhere else). A pane with neither gets it in the
   strip above the tree. */
function _tfvSegHome(c) {
  const pane = c.parentElement;
  if (!pane) return null;
  const menu = pane.querySelector('.browse-head-menu');
  if (menu) return menu;
  return Array.from(pane.querySelectorAll('[id$="toggle-items-btn"]')).find(b => !b.closest('.browse-head-drop')) || null;
}

function _tfvSeg(c, bar, has) {
  const pane = c.parentElement;
  let seg = pane && pane.querySelector('.tfv-seg[data-for="' + c.id + '"]');
  if (!seg) {
    if (!has) return;
    seg = document.createElement('div');
    seg.className = 'tfv-seg';
    seg.setAttribute('data-for', c.id);
    seg.setAttribute('role', 'radiogroup');
    seg.setAttribute('aria-label', 'Tree layout');
    seg.innerHTML = '<button type="button" class="tfv-seg-btn" role="radio" data-tfv-mode="list" title="List"><i data-lucide="list-tree"></i></button>'
      + '<button type="button" class="tfv-seg-btn" role="radio" data-tfv-mode="icons" title="Folders: big icons, double-click to open"><i data-lucide="layout-grid"></i></button>';
    const before = _tfvSegHome(c);
    if (before) { seg.classList.add('in-head'); before.parentNode.insertBefore(seg, before); }
    else { seg.classList.add('in-bar'); bar.appendChild(seg); }
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: seg });
  }
  const icons = tfvMode() === 'icons';
  seg.classList.toggle('hidden', !has);
  seg.querySelectorAll('.tfv-seg-btn').forEach(b => {
    const on = (b.getAttribute('data-tfv-mode') === 'icons') === icons;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-checked', String(on));
  });
}

/* The strip above the tree: Back, inside a folder (the path is pane 2's to
   show), or what a search found. */
function _tfvDrawBar(c, bar, icons) {
  const main = bar.querySelector('.tfv-bar-main');
  const q = icons ? _tfvQuery(c) : '';
  const here = icons && !q ? _tfvFind(c, _tfvState(c).at) : null;
  let html = '';
  if (q) {
    html = '<span class="tfv-results"><i data-lucide="search"></i><span>Matches for “' + escapeHTML(q) + '”</span></span>';
  } else if (here) {
    const up = _tfvParent(here, c);
    html = '<button type="button" class="tfv-back" data-tfv-go="' + (up ? up.getAttribute('data-node-id') : '') + '"'
      + ' title="Back to ' + escapeHTML(up ? _tfvLabel(up) : 'the top level') + ' (Backspace)">'
      + '<i data-lucide="arrow-left"></i><span>Back</span></button>';
  }
  bar.classList.toggle('hidden', !html && !bar.querySelector('.tfv-seg.in-bar:not(.hidden)'));
  if (main._tfvHtml === html) return;
  main._tfvHtml = html;
  main.innerHTML = html;
  if (html && typeof lucide !== 'undefined') lucide.createIcons({ root: main });
}

function _tfvDraw(c, view) {
  const st = _tfvState(c);
  // Follow pane 2: when the open row changed and it was not one of our icons
  // that did it, show the folder it is in (or the folder itself). Ours when it
  // is the icon just clicked -- however late the library redraws -- so a
  // single click on a folder selects it and stays put.
  const activeRow = c.querySelector('.tree-node-row.active');
  const activeNode = activeRow && activeRow.closest('.tree-node[data-node-id]');
  const activeId = activeNode ? activeNode.getAttribute('data-node-id') : null;
  if (activeId !== st.lastActive) {
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
  _tfvSet(TFV_KEY + '.' + c.id + '.at', st.at);

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

  const look = n => {
    const id = n.getAttribute('data-node-id');
    const folder = _tfvIsFolder(n);
    const row = _tfvRow(n);
    const badge = row && row.querySelector('.tree-node-badge');
    // The folder's own colour, else the one its pane 2 tile wears.
    let accent = n.style.getPropertyValue('--icon-accent') || n.style.getPropertyValue('--row-accent') || '';
    if (!accent && folder && typeof libFolderColor === 'function' && typeof state !== 'undefined') {
      const rec = (state.nodes || []).find(x => x.id === id);
      if (rec) accent = libFolderColor(rec);
    }
    return {
      id, folder, accent,
      label: _tfvLabel(n),
      icon: _tfvIconName(n, folder),
      count: folder ? (badge ? badge.textContent.trim() : String(n.querySelectorAll('.tree-node[data-node-id]').length)) : '',
      lock: !!(row && row.querySelector('.tree-node-lock')),
      star: !!(row && row.querySelector('.tree-node-star'))
    };
  };
  const looks = folders.concat(items).map(look);
  const place = q ? '?' + q : st.at;
  const sig = place + '|' + JSON.stringify(looks);

  // Rebuilt only when what is shown changed. A click (which only moves the
  // open row) changes classes on the icons already there, so a double-click
  // lands on the same icon both times -- and the icons fly in only when you
  // arrive somewhere else, not each time something is picked.
  if (view._tfvSig !== sig) {
    const moved = view._tfvPlace !== place;
    view._tfvPlace = place;
    view._tfvSig = sig;
    const scrolled = moved ? 0 : view.scrollTop;
    view.classList.toggle('tfv-anim', moved);
    view.innerHTML = looks.length
      ? '<div class="tfv-grid">' + looks.map(_tfvTileHTML).join('') + '</div>'
      : '<div class="tfv-empty"><i data-lucide="' + (q ? 'search-x' : 'folder-open') + '"></i><span>'
        + (q ? 'Nothing here matches “' + escapeHTML(q) + '”' : 'This folder is empty') + '</span></div>';
    view.scrollTop = scrolled;
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: view });
  }
  view.querySelectorAll('.tfv-tile').forEach(t => {
    const id = t.getAttribute('data-tfv-id');
    t.classList.toggle('is-active', id === activeId);
    t.classList.toggle('is-sel', id === st.sel);
  });
}

function _tfvTileHTML(o) {
  return '<div class="tfv-tile ' + (o.folder ? 'is-folder' : 'is-item') + '"'
    + ' role="option" tabindex="0" data-tfv-id="' + o.id + '" title="' + escapeHTML(o.label) + (o.folder ? ' (double-click to open)' : '') + '"'
    + (o.accent ? ' style="--tfv-c:' + o.accent + ';"' : '') + '>'
    + '<span class="tfv-glyph" aria-hidden="true">'
    + (o.folder ? '<span class="tfv-tab"></span>' : '<span class="tfv-fold"></span>')
    + (o.folder && o.icon === 'folder' ? '' : '<i data-lucide="' + escapeHTML(o.icon) + '"></i>')
    + (o.lock ? '<span class="tfv-mark is-lock"><i data-lucide="lock"></i></span>' : '')
    + (o.star ? '<span class="tfv-mark is-star"><i data-lucide="star"></i></span>' : '')
    + '</span>'
    + '<span class="tfv-name">' + escapeHTML(o.label) + '</span>'
    + (o.count && o.count !== '0' ? '<span class="tfv-count">' + escapeHTML(o.count) + '</span>' : '')
    + '</div>';
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
  const st = _tfvState(c);
  st.at = id || '';
  st.sel = null;
  st.navAt = performance.now();
  tfvSync(c);
}

/** The icon about to be clicked: when its row becomes the open one, that was us. */
function _tfvOwn(c, n) { _tfvState(c).own = { id: n.getAttribute('data-node-id'), at: performance.now() }; }

function _tfvBindView(view, c) {
  const nodeOf = el => { const t = el.closest && el.closest('.tfv-tile'); return t ? _tfvFind(c, t.getAttribute('data-tfv-id')) : null; };
  view.addEventListener('click', e => {
    const n = nodeOf(e.target);
    if (!n) return;
    const st = _tfvState(c);
    st.sel = n.getAttribute('data-node-id');
    view.querySelectorAll('.tfv-tile').forEach(t => t.classList.toggle('is-sel', t.getAttribute('data-tfv-id') === st.sel));
    // The second click of a double-click on a folder is the double-click's:
    // it would only pick the same folder again.
    if (e.detail >= 2 && _tfvIsFolder(n)) return;
    _tfvOwn(c, n);
    _tfvFire(_tfvRow(n), 'click', e);
    _tfvQueue(c);   // the open icon's mark moves even if the tree did not redraw
  });
  view.addEventListener('dblclick', e => {
    const n = nodeOf(e.target);
    if (!n || !_tfvIsFolder(n)) return;
    e.preventDefault();
    // A double-click just after one that opened a folder is the same gesture
    // landing on whatever now sits under the pointer: one folder at a time.
    if (performance.now() - _tfvState(c).navAt < 450) return;
    tfvGo(c, n.getAttribute('data-node-id'));
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
    if (e.key === 'Backspace' || (e.key === 'ArrowLeft' && e.altKey)) {
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

/* The switch and Back, for every tree at once. The switch is one setting, so
   flipping it in one pane flips every tree on the page. */
document.addEventListener('click', e => {
  const btn = e.target.closest && e.target.closest('.tfv-seg button, .tfv-bar button');
  if (!btn) return;
  const holder = btn.closest('[data-for]');
  const c = holder && document.getElementById(holder.getAttribute('data-for'));
  if (!c) return;
  if (btn.hasAttribute('data-tfv-mode')) {
    _tfvSet(TFV_KEY, btn.getAttribute('data-tfv-mode') === 'icons' ? 'icons' : '');
    document.querySelectorAll(TFV_SEL).forEach(t => {
      if (!t.id) return;
      _tfvState(t).lastActive = undefined;   // entering the view: start where pane 2 is
      tfvSync(t);
    });
  } else if (btn.hasAttribute('data-tfv-go')) {
    tfvGo(c, btn.getAttribute('data-tfv-go'));
  }
});

/* A tree redraws by replacing rows, or in place by moving classes (the open
   row's .active, a folder's .collapsed); lucide then swaps its icons in. One
   watcher on the page notices either inside a tree and redraws that tree's
   view on the next frame. */
function _tfvQueue(c) {
  const st = _tfvState(c);
  if (st.raf) return;
  st.raf = requestAnimationFrame(() => { st.raf = 0; tfvSync(c); });
}

if (typeof MutationObserver !== 'undefined') {
  new MutationObserver(records => {
    for (let i = 0; i < records.length; i++) {
      const t = records[i].target;
      const c = t.nodeType === 1 && (t.matches(TFV_SEL) ? t : t.closest(TFV_SEL));
      if (c && c.id) _tfvQueue(c);
    }
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
}
