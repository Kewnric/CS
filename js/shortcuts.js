/* ============================================================
   SHORTCUTS.JS — Global keyboard shortcuts + cheat-sheet (?)
   ------------------------------------------------------------
   - `?`            toggle the shortcuts cheat-sheet
   - `g` then …     jump to a section (g h/c/n/a/m/v/q) or search (g s)
   Guards: ignored while typing in inputs/editors, and g-jumps are
   suppressed while a modal/overlay is open.
   ============================================================ */

const SHORTCUT_GO_MAP = {
  h: { route: 'home',          label: 'Home' },
  l: { route: 'library',       label: 'Library' },
  c: { route: 'browse',        label: 'Coding Library' },
  n: { route: 'study',         label: 'Notes Library' },
  p: { route: 'snippets',      label: 'Snippet Library' },
  a: { route: 'analytics',     label: 'Analytics' },
  m: { route: 'admin',         label: 'Admin' },
  v: { route: 'visualization', label: 'Visualize' },
  q: { route: 'quests',        label: 'Quest Board' }
};

let _goPending = false;
let _goTimer = null;

function _shortcutIsMac() {
  return /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || '');
}

/** True when focus is in a field where the user is typing. */
function _shortcutInEditable(e) {
  const t = e.target;
  if (!t) return false;
  const tag = (t.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (t.isContentEditable) return true;
  return false;
}

/** True when a modal/overlay is open (so g-jumps don't fire underneath it). */
function _shortcutModalOpen() {
  if (document.querySelector('.modal-overlay:not(.hidden)')) return true;
  if (document.querySelector('.smp-overlay:not(.hidden)')) return true;
  if (document.getElementById('run-code-overlay')) return true;
  if (document.getElementById('bulk-q-import-overlay')) return true;
  const gs = document.getElementById('global-search-modal');
  if (gs && !gs.classList.contains('hidden')) return true;
  return false;
}

function _armGoSequence() {
  _goPending = true;
  clearTimeout(_goTimer);
  _goTimer = setTimeout(() => { _goPending = false; }, 1200);
}

function _showGoToast(label) {
  let toast = document.getElementById('shortcut-go-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'shortcut-go-toast';
    toast.style.cssText = 'position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%);background:var(--bg-elevated,#1a1a1a);color:var(--text-primary,#fff);border:1px solid var(--border-color,#333);padding:0.4rem 0.9rem;border-radius:999px;font-size:0.8rem;font-weight:600;z-index:100000;opacity:0;transition:opacity 0.15s ease;pointer-events:none;box-shadow:0 6px 20px rgba(0,0,0,0.35);';
    document.body.appendChild(toast);
  }
  toast.textContent = '→ ' + label;
  requestAnimationFrame(() => { toast.style.opacity = '1'; });
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { toast.style.opacity = '0'; }, 900);
}

document.addEventListener('keydown', (e) => {
  // Always allow Escape to close our own cheat-sheet.
  if (e.key === 'Escape') {
    const cs = document.getElementById('shortcuts-cheatsheet');
    if (cs) { cs.remove(); return; }
  }

  if (_shortcutInEditable(e)) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return; // leave modifier combos to their owners

  // `?` toggles the cheat-sheet (works anywhere).
  if (e.key === '?') {
    e.preventDefault();
    toggleShortcutsCheatSheet();
    return;
  }

  // Resolve a pending `g` sequence.
  if (_goPending) {
    _goPending = false;
    clearTimeout(_goTimer);
    const k = (e.key || '').toLowerCase();
    if (k === 's') {
      e.preventDefault();
      if (typeof openGlobalSearch === 'function') openGlobalSearch();
      return;
    }
    const dest = SHORTCUT_GO_MAP[k];
    if (dest && typeof spaNavigate === 'function') {
      e.preventDefault();
      spaNavigate(dest.route);
      _showGoToast(dest.label);
    }
    return;
  }

  // Begin a `g` sequence (only when no modal is blocking navigation).
  if ((e.key === 'g' || e.key === 'G') && !_shortcutModalOpen()) {
    _armGoSequence();
    return;
  }
});

/** Build/remove the cheat-sheet overlay. */
function toggleShortcutsCheatSheet() {
  const existing = document.getElementById('shortcuts-cheatsheet');
  if (existing) { existing.remove(); return; }

  const mod = _shortcutIsMac() ? '⌘' : 'Ctrl';
  const kbd = (s) => `<kbd style="display:inline-block;min-width:1.4em;text-align:center;padding:2px 7px;margin:0 1px;border-radius:6px;background:var(--bg-surface,#222);border:1px solid var(--border-color,#444);border-bottom-width:2px;font-family:var(--font-mono,monospace);font-size:0.78rem;color:var(--text-primary,#eee);">${s}</kbd>`;
  const seq = (a, b) => `${kbd(a)} <span style="opacity:0.5;">then</span> ${kbd(b)}`;

  const groups = [
    { title: 'Navigate', rows: [
      ['Home', seq('G', 'H')],
      ['Library hub', seq('G', 'L')],
      ['Coding Library', seq('G', 'C')],
      ['Notes Library', seq('G', 'N')],
      ['Snippet Library', seq('G', 'P')],
      ['Analytics', seq('G', 'A')],
      ['Admin', seq('G', 'M')],
      ['Visualize', seq('G', 'V')],
      ['Quest Board', seq('G', 'Q')]
    ]},
    { title: 'Find', rows: [
      ['Command palette / search', `${kbd(mod)} ${kbd('K')}`],
      ['Search (g-jump)', seq('G', 'S')]
    ]},
    { title: 'Practice', rows: [
      ['Submit code', `${kbd(mod)} ${kbd('Enter')}`],
      ['Retry', `${kbd(mod)} ${kbd('Shift')} ${kbd('R')}`],
      ['Back to library', kbd('Esc')]
    ]},
    { title: 'General', rows: [
      ['Toggle this menu', kbd('?')],
      ['Close menu / dialog', kbd('Esc')]
    ]}
  ];

  const overlay = document.createElement('div');
  overlay.id = 'shortcuts-cheatsheet';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:100000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);padding:1rem;';
  overlay.innerHTML = `
    <div style="background:var(--bg-elevated,#161616);border:1px solid var(--border-color,#333);border-radius:var(--radius-lg,14px);width:620px;max-width:100%;max-height:88vh;overflow:auto;box-shadow:0 28px 60px rgba(0,0,0,0.55);">
      <div style="display:flex;align-items:center;gap:0.5rem;padding:1.1rem 1.4rem;border-bottom:1px solid var(--border-color,#333);position:sticky;top:0;background:var(--bg-elevated,#161616);">
        <i data-lucide="keyboard" style="width:20px;height:20px;color:var(--color-primary,#818cf8);"></i>
        <h2 style="font-size:1.05rem;font-weight:800;margin:0;color:var(--text-primary,#fff);">Keyboard Shortcuts</h2>
        <button onclick="toggleShortcutsCheatSheet()" style="margin-left:auto;background:none;border:none;color:var(--text-tertiary,#999);cursor:pointer;padding:0.25rem;border-radius:6px;"><i data-lucide="x" style="width:20px;height:20px;"></i></button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;padding:1.25rem 1.4rem;">
        ${groups.map(g => `
          <div>
            <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-tertiary,#888);font-weight:700;margin-bottom:0.6rem;">${g.title}</div>
            <div style="display:flex;flex-direction:column;gap:0.5rem;">
              ${g.rows.map(([label, keys]) => `
                <div style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;">
                  <span style="font-size:0.85rem;color:var(--text-secondary,#ccc);">${label}</span>
                  <span style="white-space:nowrap;">${keys}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
      <div style="padding:0.75rem 1.4rem;border-top:1px solid var(--border-color,#333);font-size:0.72rem;color:var(--text-tertiary,#888);">
        Tip: press <span style="font-family:var(--font-mono,monospace);">G</span> then a letter to jump between sections — just like your favorite apps.
      </div>
    </div>`;

  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: overlay });
}
