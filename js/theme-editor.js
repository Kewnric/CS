/* ============================================================
   THEME EDITOR -- recolour the app, piece by piece
   ============================================================
   Settings > Theme Editor. Every colour the themes are made of (page, panels,
   text, accents, borders), plus the pieces people asked for by name that do
   not have a colour of their own: right-click menus, dropdowns, icons,
   dialogs. Changes show at once and belong to the theme they were made in --
   dark edits stay on dark, light on light -- so switching themes still
   switches looks. Each row resets on its own; the footer resets the theme.

   Per device: ssp.themeEdits = { <theme>: { <row id>: <css colour> } }, drawn
   as one <style> at the end of the page, after every stylesheet.
   ============================================================ */

const THEME_EDIT_KEY = 'ssp.themeEdits';

/* The right-click menus and the dropdown panels, by the class that carries
   each one's background -- and the rows inside them. */
const TE_MENUS = '.tree-ctx, .tree-context-menu, .viz-context-menu, .viz-link-menu, .file-menu';
const TE_DROPS = '.browse-head-drop-list, .timer-menu, .viz-toolbar-popup, .viz-ce-lang-menu, .nb-format-menu, .viz-build-menu, .demo-voice-menu, .nb-cover-drop, .cs-table-menu, .ali-folder-popup, select, select option';
const TE_ROWS = '.tree-ctx-item, .viz-ctx-item, .file-menu-item, button, [role="menuitem"], [role="option"], option';

function _teRule(sel, prop) { return v => ':is(' + sel + ') { ' + prop + ': ' + v + ' !important; }'; }
function _teRows(sel, prop, state) {
  return v => ':is(' + sel + ') :is(' + TE_ROWS + ')' + (state || '') + ' { ' + prop + ': ' + v + ' !important; }';
}
function _teText(sel) {
  return v => ':is(' + sel + '), :is(' + sel + ') :is(' + TE_ROWS + ', span, label):not([class*="danger"]) { color: ' + v + ' !important; }';
}

/* Each row: a theme variable (`vars`, read back through `probe`), or a rule
   of its own (`rule`, whose starting value is read from `from`). */
const THEME_EDIT_GROUPS = [
  { id: 'bg', label: 'Backgrounds', icon: 'paint-bucket', items: [
    { id: 'bg-body', label: 'Page', vars: ['--bg-body'] },
    { id: 'bg-surface', label: 'Panels and cards', vars: ['--bg-surface'] },
    { id: 'bg-hover', label: 'Hover and selection', vars: ['--bg-surface-hover'] },
    { id: 'bg-elevated', label: 'Raised: popups and windows', vars: ['--bg-elevated'] },
    { id: 'bg-nav', label: 'Sidebar and top bar', vars: ['--bg-nav', '--bg-nav-solid'], probe: '--bg-nav-solid' }
  ] },
  { id: 'text', label: 'Text', icon: 'type', items: [
    { id: 'text-1', label: 'Main text', vars: ['--text-primary'] },
    { id: 'text-2', label: 'Secondary text', vars: ['--text-secondary'] },
    { id: 'text-3', label: 'Faint text and hints', vars: ['--text-tertiary'] }
  ] },
  { id: 'accent', label: 'Accents and lines', icon: 'sparkles', items: [
    { id: 'primary', label: 'Primary', vars: ['--color-primary'], derive: true },
    { id: 'accent', label: 'Accent', vars: ['--color-accent'] },
    { id: 'success', label: 'Success', vars: ['--color-success'] },
    { id: 'warning', label: 'Warning', vars: ['--color-warning'] },
    { id: 'danger', label: 'Danger', vars: ['--color-danger'] },
    { id: 'border', label: 'Borders and lines', vars: ['--border-color'] }
  ] },
  { id: 'menus', label: 'Right-click menus', icon: 'mouse-pointer-click', items: [
    { id: 'menu-bg', label: 'Background', rule: _teRule(TE_MENUS, 'background'), from: '--bg-elevated' },
    { id: 'menu-text', label: 'Text', rule: _teText(TE_MENUS), from: '--text-primary' },
    { id: 'menu-hover', label: 'Hovered row', rule: _teRows(TE_MENUS, 'background', ':hover'), from: '--bg-surface-hover' },
    { id: 'menu-border', label: 'Border', rule: _teRule(TE_MENUS, 'border-color'), from: '--border-color' },
    { id: 'menu-icon', label: 'Icons', rule: v => ':is(' + TE_MENUS + ') svg { color: ' + v + ' !important; }', from: '--text-tertiary' }
  ] },
  { id: 'drops', label: 'Dropdowns', icon: 'chevrons-up-down', items: [
    { id: 'drop-bg', label: 'Background', rule: _teRule(TE_DROPS, 'background'), from: '--bg-elevated' },
    { id: 'drop-text', label: 'Text', rule: _teText(TE_DROPS), from: '--text-primary' },
    { id: 'drop-hover', label: 'Hovered row', rule: _teRows(TE_DROPS, 'background', ':hover'), from: '--bg-surface-hover' },
    { id: 'drop-border', label: 'Border', rule: _teRule(TE_DROPS, 'border-color'), from: '--border-color' }
  ] },
  { id: 'icons', label: 'Icons', icon: 'shapes', items: [
    { id: 'icon-folder', label: 'Folder icons in the trees', rule: v => '.tree-node-icon.folder-icon-color { color: ' + v + ' !important; }', from: '--color-primary' },
    { id: 'icon-item', label: 'Item icons in the trees', rule: v => '.tree-node-icon.item-icon-color { color: ' + v + ' !important; }', from: '--text-tertiary' },
    { id: 'icon-btn', label: 'Toolbar and button icons', rule: v => ':is(.btn, .tutorial-trigger-btn, .term-icon-btn, .settings-item-icon, .icon-btn) svg { color: ' + v + ' !important; }', from: '--text-secondary' },
    { id: 'icon-all', label: 'Every icon (strong)', rule: v => 'svg.lucide { color: ' + v + ' !important; }', from: '--text-secondary' }
  ] },
  { id: 'dialogs', label: 'Dialogs', icon: 'app-window', items: [
    { id: 'dlg-bg', label: 'Background', rule: _teRule('.modal-content', 'background'), from: '--bg-elevated' },
    { id: 'dlg-text', label: 'Text', rule: v => '.modal-content :is(h2, h3, p, label, span, .modal-title, .modal-desc) { color: ' + v + ' !important; }', from: '--text-primary' }
  ] }
];

function _teItems() { return THEME_EDIT_GROUPS.reduce((a, g) => a.concat(g.items), []); }
function _teTheme() { return document.documentElement.getAttribute('data-theme') || 'dark'; }

function themeEditsAll() {
  try { const v = JSON.parse(localStorage.getItem(THEME_EDIT_KEY) || '{}'); return v && typeof v === 'object' ? v : {}; }
  catch (e) { return {}; }
}
function _teSave(all) {
  try {
    Object.keys(all).forEach(t => { if (!all[t] || !Object.keys(all[t]).length) delete all[t]; });
    if (Object.keys(all).length) localStorage.setItem(THEME_EDIT_KEY, JSON.stringify(all));
    else localStorage.removeItem(THEME_EDIT_KEY);
  } catch (e) { /* private mode */ }
}

/* A colour someone typed is only kept if the browser can draw it. */
function _teValid(v) {
  v = String(v || '').trim();
  if (!v || /[;{}<>]/.test(v)) return '';
  if (typeof CSS !== 'undefined' && CSS.supports) return CSS.supports('color', v) ? v : '';
  const probe = document.createElement('span');
  probe.style.color = v;
  return probe.style.color ? v : '';
}

/** The stylesheet for every theme's edits. */
function themeEditCss(all) {
  const items = _teItems();
  let out = '';
  Object.keys(all || {}).forEach(theme => {
    const ed = all[theme] || {};
    const scope = 'html[data-theme="' + theme.replace(/[^\w-]/g, '') + '"]';
    const vars = [];
    items.forEach(it => {
      const v = _teValid(ed[it.id]);
      if (!v) return;
      if (it.vars) {
        it.vars.forEach(n => vars.push(n + ': ' + v + ';'));
        if (it.derive) {
          vars.push('--color-primary-hover: color-mix(in srgb, ' + v + ' 80%, #fff);');
          vars.push('--color-primary-dark: color-mix(in srgb, ' + v + ' 80%, #000);');
          vars.push('--color-primary-glow: color-mix(in srgb, ' + v + ' 25%, transparent);');
          vars.push('--color-primary-subtle: color-mix(in srgb, ' + v + ' 8%, transparent);');
        }
      } else if (it.rule) {
        // A rule's selector may be a list; :is() scopes every part of it to the theme.
        const r = it.rule(v), at = r.indexOf('{');
        out += scope + ' :is(' + r.slice(0, at).trim() + ') ' + r.slice(at) + '\n';
      }
    });
    if (vars.length) out = scope + ' { ' + vars.join(' ') + ' }\n' + out;
  });
  return out;
}

function themeEditApply() {
  let el = document.getElementById('ssp-theme-edits');
  const css = themeEditCss(themeEditsAll());
  if (!css) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('style'); el.id = 'ssp-theme-edits'; }
  // Last in the document, after every stylesheet, so an edit is never outranked by load order.
  if (el.parentNode !== document.head || el !== document.head.lastElementChild) document.head.appendChild(el);
  if (el.textContent !== css) el.textContent = css;
}

/* What a row shows before it is edited: the colour the theme gives it now. */
function _teHex(cssColor) {
  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?/.exec(cssColor || '');
  if (!m) return '';
  const h = n => ('0' + Math.max(0, Math.min(255, Math.round(+n))).toString(16)).slice(-2);
  let a = m[4] === undefined ? 1 : (String(m[4]).endsWith('%') ? parseFloat(m[4]) / 100 : +m[4]);
  return '#' + h(m[1]) + h(m[2]) + h(m[3]) + (a < 1 ? h(a * 255) : '');
}
function _teCurrent(it) {
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;color:var(' + (it.probe || (it.vars && it.vars[0]) || it.from) + ')';
  document.body.appendChild(probe);
  const c = getComputedStyle(probe).color;
  probe.remove();
  return _teHex(c);
}

function openThemeEditor() {
  closeThemeEditor();
  const overlay = document.createElement('div');
  overlay.id = 'theme-editor';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-content te-window" role="dialog" aria-modal="true" aria-labelledby="te-title">
      <div class="te-head">
        <h2 class="modal-title te-title" id="te-title"><i data-lucide="palette"></i> Theme Editor</h2>
        <button type="button" class="settings-close-btn" onclick="closeThemeEditor()" aria-label="Close the theme editor"><i data-lucide="x"></i></button>
      </div>
      <p class="modal-desc te-desc">Changes show as you make them and belong to the theme you make them in.</p>
      <div class="te-themes" role="radiogroup" aria-label="Theme being edited"></div>
      <div class="te-body"></div>
      <div class="te-foot">
        <button type="button" class="btn btn-ghost btn-sm" id="te-reset-all"><i data-lucide="rotate-ccw"></i> Reset this theme</button>
        <button type="button" class="btn btn-primary btn-sm" onclick="closeThemeEditor()">Done</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeThemeEditor(); });
  overlay.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); closeThemeEditor(); } });
  _tePaint(overlay);
  _teBind(overlay);
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: overlay });
}

function closeThemeEditor() {
  const el = document.getElementById('theme-editor');
  if (el) el.remove();
}

function _tePaint(overlay) {
  const theme = _teTheme();
  const ed = themeEditsAll()[theme] || {};
  const names = (typeof THEMES !== 'undefined' ? THEMES : ['dark', 'light', 'purple', 'green']);
  overlay.querySelector('.te-themes').innerHTML = names.map(t => {
    const n = Object.keys(themeEditsAll()[t] || {}).length;
    return '<button type="button" class="te-theme' + (t === theme ? ' is-on' : '') + '" role="radio" aria-checked="' + (t === theme) + '" data-te-theme="' + t + '">'
      + '<span class="te-theme-dot" data-t="' + t + '"></span>' + t.charAt(0).toUpperCase() + t.slice(1)
      + (n ? '<span class="te-theme-n" title="' + n + ' edit' + (n !== 1 ? 's' : '') + '">' + n + '</span>' : '') + '</button>';
  }).join('');
  const open = overlay._teOpen || { bg: true };
  overlay.querySelector('.te-body').innerHTML = THEME_EDIT_GROUPS.map(g => {
    const set = g.items.filter(it => ed[it.id]).length;
    return '<details class="te-group" data-te-group="' + g.id + '"' + (open[g.id] ? ' open' : '') + '>'
      + '<summary><i data-lucide="' + g.icon + '"></i><span>' + g.label + '</span>'
      + (set ? '<span class="te-group-n">' + set + ' changed</span>' : '') + '<i data-lucide="chevron-down" class="te-chev"></i></summary>'
      + '<div class="te-rows">' + g.items.map(it => {
        const v = ed[it.id] || '';
        const shown = v || _teCurrent(it);
        const hex6 = /^#[0-9a-f]{6}/i.test(shown) ? shown.slice(0, 7) : '#000000';
        return '<div class="te-row' + (v ? ' is-set' : '') + '" data-te-id="' + it.id + '">'
          + '<span class="te-name">' + it.label + '</span>'
          + '<label class="te-swatch" style="--te-c:' + escapeHTML(shown || 'transparent') + ';" title="Pick a colour">'
          + '<input type="color" value="' + hex6 + '" aria-label="' + escapeHTML(it.label) + ' colour"></label>'
          + '<input type="text" class="te-hex" value="' + escapeHTML(shown) + '" spellcheck="false" autocomplete="off" aria-label="' + escapeHTML(it.label) + ', hex or any CSS colour" placeholder="#rrggbb">'
          + '<button type="button" class="te-reset" title="Back to the theme\'s own colour" aria-label="Reset ' + escapeHTML(it.label) + '"' + (v ? '' : ' disabled') + '><i data-lucide="undo-2"></i></button>'
          + '</div>';
      }).join('') + '</div></details>';
  }).join('');
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: overlay });
}

function _teSet(id, value) {
  const all = themeEditsAll();
  const theme = _teTheme();
  all[theme] = all[theme] || {};
  if (value) all[theme][id] = value; else delete all[theme][id];
  _teSave(all);
  themeEditApply();
}

function _teBind(overlay) {
  const rowOf = el => el.closest && el.closest('.te-row');
  const show = (row, v) => {
    row.classList.toggle('is-set', !!v);
    row.querySelector('.te-reset').disabled = !v;
    row.querySelector('.te-swatch').style.setProperty('--te-c', v || 'transparent');
  };
  overlay.addEventListener('input', e => {
    const row = rowOf(e.target);
    if (!row) return;
    const id = row.getAttribute('data-te-id');
    if (e.target.type === 'color') {
      const v = e.target.value;
      row.querySelector('.te-hex').value = v;
      _teSet(id, v); show(row, v);
    } else if (e.target.classList.contains('te-hex')) {
      const v = _teValid(e.target.value);
      e.target.classList.toggle('is-bad', !!e.target.value.trim() && !v);
      if (!v) return;
      if (/^#[0-9a-f]{6}/i.test(v)) row.querySelector('input[type="color"]').value = v.slice(0, 7);
      _teSet(id, v); show(row, v);
    }
  });
  overlay.addEventListener('click', e => {
    const t = e.target.closest && e.target.closest('[data-te-theme]');
    if (t) { themeEditSetTheme(t.getAttribute('data-te-theme')); _tePaint(overlay); return; }
    const reset = e.target.closest && e.target.closest('.te-reset');
    if (reset) {
      const row = rowOf(reset);
      _teSet(row.getAttribute('data-te-id'), '');
      _tePaint(overlay);
      return;
    }
    if (e.target.closest && e.target.closest('#te-reset-all')) {
      const all = themeEditsAll();
      delete all[_teTheme()];
      _teSave(all);
      themeEditApply();
      _tePaint(overlay);
    }
  });
  // Remember which groups are open across repaints.
  overlay.addEventListener('toggle', e => {
    const d = e.target.closest && e.target.closest('.te-group');
    if (!d) return;
    overlay._teOpen = overlay._teOpen || { bg: true };
    overlay._teOpen[d.getAttribute('data-te-group')] = d.open;
  }, true);
}

/** Switch to a theme by name (the editor's theme chips). */
function themeEditSetTheme(theme) {
  const root = document.documentElement;
  if (root.getAttribute('data-theme') === theme) return;
  root.classList.add('theme-transitioning');
  root.setAttribute('data-theme', theme);
  try { localStorage.setItem('theme', theme); } catch (e) { /* private mode */ }
  if (typeof updateThemeIcon === 'function') updateThemeIcon(theme);
  if (typeof scheduleCloudSave === 'function') scheduleCloudSave();
  setTimeout(() => root.classList.remove('theme-transitioning'), 600);
}

themeEditApply();
