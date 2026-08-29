/* ============================================================
   NAVIGATION.JS — Theme Toggle, Sidebar + Navigation Helpers
   ============================================================ */

// --- Sidebar Toggle ---
function toggleSidebar() {
  const sidebar = document.querySelector('.app-sidebar');
  if (!sidebar) return;

  const isMobile = window.innerWidth <= 640;
  const btn = document.querySelector('.sidebar-toggle-btn');

  if (isMobile) {
    const isOpen = sidebar.classList.contains('mobile-open');
    sidebar.classList.toggle('mobile-open', !isOpen);
    const backdrop = document.getElementById('sidebar-backdrop');
    if (backdrop) backdrop.classList.toggle('hidden', isOpen);
    if (btn) btn.setAttribute('aria-expanded', String(!isOpen));
  } else {
    sidebar.style.width = '';
    sidebar.style.flexBasis = '';
    sidebar.classList.toggle('expanded');
    localStorage.setItem('sidebarExpanded', sidebar.classList.contains('expanded'));
    if (btn) btn.setAttribute('aria-expanded', String(sidebar.classList.contains('expanded')));
    if (typeof scheduleCloudSave === 'function') scheduleCloudSave();
  }
}

/* Any route change closes the drawer. Tapping a nav item used to leave it
   open over the page you had just asked for, which on a phone means the
   destination is behind the menu you navigated with. */
new MutationObserver(function () {
  if (window.innerWidth <= 640) closeMobileSidebar();
}).observe(document.body, { attributes: true, attributeFilter: ['data-route'] });

function closeMobileSidebar() {
  const sidebar = document.querySelector('.app-sidebar');
  if (sidebar) sidebar.classList.remove('mobile-open');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (backdrop) backdrop.classList.add('hidden');
  const btn = document.querySelector('.sidebar-toggle-btn');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

const THEMES = ['dark', 'light', 'purple', 'green'];

function toggleTheme() {
  const root = document.documentElement;

  root.classList.add('theme-transitioning');

  const currentTheme = root.getAttribute('data-theme') || 'dark';
  let nextIndex = THEMES.indexOf(currentTheme) + 1;
  if (nextIndex >= THEMES.length) nextIndex = 0;
  const newTheme = THEMES[nextIndex];

  root.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);

  updateThemeIcon(newTheme);
  if (typeof scheduleCloudSave === 'function') scheduleCloudSave();

  setTimeout(() => {
    root.classList.remove('theme-transitioning');
  }, 600);
}

/* --- Sidebar Bottom Collapsible --- */
// ── Settings popup (replaces the old sidebar-bottom section) ──
function openSettingsModal() {
  const modal = document.getElementById('settings-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  // Full screen can have been entered or left with F11 while this was closed,
  // so the row is brought up to date on open rather than only when toggled.
  if (typeof _syncFullscreenBtn === 'function') _syncFullscreenBtn();
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: modal });
}

function closeSettingsModal() {
  const modal = document.getElementById('settings-modal');
  if (modal) modal.classList.add('hidden');
}

// Legacy no-op kept for safety — the sidebar-bottom markup was replaced by the
// settings popup (#settings-modal) opened from the bottom-right gear button.
function toggleSidebarBottom() {
  const content = document.getElementById('sidebar-bottom-content');
  const toggle = document.getElementById('sidebar-bottom-toggle');
  if (!content || !toggle) return;
  const isCollapsed = content.classList.toggle('collapsed');
  toggle.classList.toggle('collapsed', isCollapsed);
  try { localStorage.setItem('sidebarBottomCollapsed', isCollapsed ? '1' : '0'); } catch (e) {}
}

function initSidebarBottom() {
  const collapsed = localStorage.getItem('sidebarBottomCollapsed') === '1';
  if (collapsed) {
    const content = document.getElementById('sidebar-bottom-content');
    const toggle = document.getElementById('sidebar-bottom-toggle');
    if (content) content.classList.add('collapsed');
    if (toggle) toggle.classList.add('collapsed');
  }
}

function updateThemeIcon(theme) {
  const themeIcon = document.getElementById('theme-icon');
  if (themeIcon) {
    let iconName = 'moon'; // default for dark
    if (theme === 'light') iconName = 'sun';
    else if (theme === 'purple') iconName = 'sparkles';
    else if (theme === 'green') iconName = 'leaf';

    themeIcon.setAttribute('data-lucide', iconName);
    if (window.lucide) {
      lucide.createIcons({ root: themeIcon.parentElement || themeIcon });
    }
  }
}

function initTheme() {
  // 1. Suppress all entry animations during initial page paint
  document.body.classList.add('no-entry-animation');

  // 2. Init Theme
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);

  // 3. Init Sidebar State — suppress transition to prevent layout jump
  const sidebar = document.querySelector('.app-sidebar');
  if (sidebar) {
    sidebar.classList.add('no-transition');
    if (localStorage.getItem('sidebarExpanded') === 'true') {
      sidebar.classList.add('expanded');
    }
  }

  // 4. Re-enable transitions and animations after first paint.
  //
  // This handoff used to sit in nested requestAnimationFrame alone. A hidden
  // tab never paints, so rAF never runs there — and a page first opened in a
  // background tab (ctrl+click, or a restored session) kept
  // .no-entry-animation on <body> forever. That rule sets
  // transition-duration: 0s !important on every element in the app, so every
  // transition on the site stayed dead and initSidebarBottom() never ran, until
  // the page was reloaded while visible. The timeout guarantees the handoff;
  // rAF still wins when the tab is actually on screen, keeping the original
  // after-first-paint timing.
  let entryAnimationsEnabled = false;
  const enableEntryAnimations = () => {
    if (entryAnimationsEnabled) return;
    entryAnimationsEnabled = true;
    if (sidebar) sidebar.classList.remove('no-transition');
    document.body.classList.remove('no-entry-animation');
    initSidebarBottom();
  };
  requestAnimationFrame(() => requestAnimationFrame(enableEntryAnimations));
  setTimeout(enableEntryAnimations, 120);
}

/* The sidebar rows carry no href, so the browser stops previewing the route in
   its status bar on every hover — the app is a hash-router SPA and that
   preview was only ever noise. An anchor without href also stops being
   keyboard-operable, so Enter is wired back here rather than repeated as an
   attribute on each row. Space is deliberately not bound: these announce as
   links, and Space is the button gesture. */
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const el = e.target && e.target.closest && e.target.closest('[role="link"][onclick]');
  if (!el) return;
  e.preventDefault();
  el.click();
});

// --- Nav Active State ---
function setActiveNav(page) {
  document.querySelectorAll('.sidebar-link').forEach(el => {
    el.classList.remove('active');
  });
  const activeEl = document.getElementById('nav-' + page);
  if (activeEl) activeEl.classList.add('active');
}

// --- Page Navigation Helper ---
function navigateTo(page) {
  spaNavigate(page);
}

// ============================================================
// GLOBAL ESCAPE KEY — closes any open modal
// ============================================================
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;

  // Global search takes priority
  const gsModal = document.getElementById('global-search-modal');
  if (gsModal && !gsModal.classList.contains('hidden')) {
    closeGlobalSearch();
    return;
  }

  // Close any visible modal-overlay (hint, timer, icon-picker, answer-key, etc.)
  const openModal = document.querySelector('.modal-overlay:not(.hidden)');
  if (openModal) {
    openModal.classList.add('hidden');
    return;
  }

  // Close mindmap overlay
  const mindmap = document.getElementById('mindmap-overlay');
  if (mindmap && !mindmap.classList.contains('hidden')) {
    if (typeof closeMindmap === 'function') closeMindmap();
  }
});

// ============================================================
// GLOBAL SEARCH
// ============================================================
let _globalSearchTimer = null;
/** Debounced global search — used by the input's oninput. */
function debouncedGlobalSearch() {
  clearTimeout(_globalSearchTimer);
  _globalSearchTimer = setTimeout(() => renderGlobalSearchResults(), 150);
}

// --- Command palette: runnable actions surfaced alongside search results ---
function getGlobalCommands() {
  const cmds = [
    { id: 'go-home', icon: 'home', label: 'Go to Home', sub: 'Dashboard', keywords: 'dashboard home', run: () => spaNavigate('home') },
    { id: 'go-library', icon: 'library', label: 'Go to Library', sub: 'All collections', keywords: 'library hub collections wings', run: () => spaNavigate('library') },
    { id: 'go-browse', icon: 'layout-template', label: 'Go to Coding Library', sub: 'Programs', keywords: 'browse programs challenges code', run: () => spaNavigate('browse') },
    { id: 'go-study', icon: 'book-open', label: 'Go to Notes Library', sub: 'Notebooks & quizzes', keywords: 'study notes notebooks quizzes', run: () => spaNavigate('study') },
    { id: 'go-snippets', icon: 'code', label: 'Go to Snippet Library', sub: 'Code snippets', keywords: 'snippets code reference examples', run: () => spaNavigate('snippets') },
    { id: 'go-analytics', icon: 'bar-chart-3', label: 'Go to Analytics', sub: 'Progress & history', keywords: 'analytics stats history progress charts', run: () => spaNavigate('analytics') },
    { id: 'go-admin', icon: 'settings', label: 'Go to Admin Panel', sub: 'Manage content', keywords: 'admin manage edit content', run: () => spaNavigate('admin') },
    { id: 'go-visualize', icon: 'git-branch', label: 'Go to Visualize', sub: 'Mind map', keywords: 'visualize mindmap brain graph', run: () => spaNavigate('visualization') },
    { id: 'go-quests', icon: 'scroll-text', label: 'Go to Quest Board', sub: 'Goals & challenges', keywords: 'quests goals board gamify', run: () => spaNavigate('quests') },
    { id: 'review-due', icon: 'brain', label: 'Review Due Items', sub: 'Spaced repetition', keywords: 'review due spaced repetition srs study flashcards', run: () => { spaNavigate('home'); setTimeout(() => { const el = document.getElementById('home-srs'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 450); } },
    // The one library the palette could not see into.
    ...((() => {
      let sheets = [];
      try { sheets = (JSON.parse(localStorage.getItem(typeof getCheatStorageKey === 'function' ? getCheatStorageKey() : 'cheatsheetLibrary')) || {}).sheets || []; } catch (e) { sheets = []; }
      return sheets.slice(0, 40).map(sh => ({
        id: 'cs_' + sh.id,
        icon: sh.icon || 'book-marked',
        label: sh.title,
        sub: 'Cheat sheet \u00b7 ' + (sh.pages || []).length + ' page' + ((sh.pages || []).length !== 1 ? 's' : ''),
        keywords: 'cheat sheet reference ' + sh.title + ' ' + (sh.tags || []).join(' '),
        run: () => { spaNavigate('cheatsheet'); setTimeout(() => { if (typeof csOpen === 'function') csOpen(sh.id); }, 320); }
      }));
    })()),
    { id: 'shortcuts', icon: 'keyboard', label: 'Keyboard Shortcuts', sub: 'Press ? anytime', keywords: 'keyboard shortcuts hotkeys keys cheat sheet help', run: () => typeof toggleShortcutsCheatSheet === 'function' && toggleShortcutsCheatSheet() },
    { id: 'open-settings', icon: 'settings', label: 'Open Settings', sub: 'Storage, theme, backups', keywords: 'settings preferences config options gear', run: () => typeof openSettingsModal === 'function' && openSettingsModal() },
    { id: 'toggle-theme', icon: 'moon', label: 'Toggle Theme', sub: 'Light / dark', keywords: 'theme dark light mode appearance', run: () => typeof toggleTheme === 'function' && toggleTheme() },
    { id: 'storage-mode', icon: 'cloud', label: 'Change Storage Mode', sub: 'Local / cloud', keywords: 'storage cloud local sync firebase', run: () => typeof showStorageModePicker === 'function' && showStorageModePicker() },
    { id: 'export-data', icon: 'download', label: 'Export Data', sub: 'Download a backup', keywords: 'export backup download save json', run: () => typeof handleDataExport === 'function' && handleDataExport() },
    { id: 'import-data', icon: 'upload', label: 'Import Data', sub: 'Restore from a backup', keywords: 'import restore upload load', run: () => { const i = document.getElementById('import-input'); if (i) i.click(); } },
    { id: 'reset-data', icon: 'trash-2', label: 'Reset All Data', sub: 'Restore defaults', keywords: 'reset wipe clear delete defaults', danger: true, run: () => typeof handleDataReset === 'function' && handleDataReset() },
  ];
  // index for dispatch
  _globalCommandMap = {};
  cmds.forEach(c => { _globalCommandMap[c.id] = c; });
  return cmds;
}
let _globalCommandMap = {};

function handleCommandSelect(id) {
  const cmd = _globalCommandMap[id];
  closeGlobalSearch();
  if (cmd && typeof cmd.run === 'function') {
    try { cmd.run(); } catch (e) { console.error('[CommandPalette] run error:', e); }
  }
}

function openGlobalSearch() {
  const modal = document.getElementById('global-search-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  const input = document.getElementById('global-search-input');
  if (input) { input.value = ''; input.focus(); }
  renderGlobalSearchResults();
}

function closeGlobalSearch() {
  const modal = document.getElementById('global-search-modal');
  if (modal) modal.classList.add('hidden');
}

// Close on backdrop click
document.addEventListener('click', (e) => {
  const modal = document.getElementById('global-search-modal');
  if (modal && e.target === modal) closeGlobalSearch();
});

function renderGlobalSearchResults() {
  const input = document.getElementById('global-search-input');
  const container = document.getElementById('global-search-results');
  if (!input || !container) return;

  const q = input.value.trim().toLowerCase();

  const groupHeader = (txt) =>
    `<div style="padding:0.5rem 0.75rem 0.25rem;font-size:0.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-tertiary);">${txt}</div>`;

  const cmdRow = (c) => `
    <div class="global-search-result-item" role="option"
      onclick="handleCommandSelect('${c.id}')" tabindex="-1"
      style="display:flex;align-items:center;gap:0.75rem;padding:0.625rem 0.75rem;border-radius:var(--radius-md);cursor:pointer;transition:background var(--transition-fast);"
      onmouseenter="this.style.background='var(--bg-surface-hover)'" onmouseleave="this.style.background=''">
      <i data-lucide="${c.icon}" style="width:16px;height:16px;color:${c.danger ? 'var(--color-danger)' : 'var(--color-primary)'};flex-shrink:0;" aria-hidden="true"></i>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:600;font-size:0.875rem;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHTML(c.label)}</div>
        <div style="font-size:0.75rem;color:var(--text-tertiary);">${escapeHTML(c.sub)}</div>
      </div>
      <span style="font-size:0.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-tertiary);background:var(--bg-surface-hover);padding:0.125rem 0.5rem;border-radius:var(--radius-full);">Action</span>
    </div>`;

  const allCommands = getGlobalCommands();

  // Empty query → command palette default view (curated quick actions).
  if (!q) {
    container.innerHTML =
      groupHeader('Quick actions') +
      allCommands.map(cmdRow).join('') +
      `<div style="padding:0.75rem;text-align:center;color:var(--text-tertiary);font-size:0.75rem;border-top:1px solid var(--border-color-subtle);margin-top:0.25rem;">
        Type to search programs, snippets &amp; notebooks — or run a command. <kbd style="font-size:0.6875rem;">↑↓</kbd> to navigate, <kbd style="font-size:0.6875rem;">↵</kbd> to select.
      </div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: container });
    return;
  }

  const matchedCommands = allCommands.filter(
    (c) => fuzzyMatch(c.label, q) || fuzzyMatch(c.keywords || '', q)
  );

  const results = [];

  // Search challenges
  (state.challenges || []).forEach(c => {
    if (fuzzyMatch(c.title, q) || (c.tags || []).some(t => fuzzyMatch(t, q)) || fuzzyMatch(c.coverDescription || '', q)) {
      const folder = state.nodes && state.nodes.find(n => n.id === c.parentId);
      results.push({ type: 'challenge', icon: 'code-2', label: c.title, sub: folder ? folder.name : 'Uncategorized', id: c.id, parentId: c.parentId });
    }
  });

  // Search snippets
  (state.snippets || []).forEach(s => {
    if (fuzzyMatch(s.title, q) || (s.tags || []).some(t => fuzzyMatch(t, q))) {
      const folder = state.nodes && state.nodes.find(n => n.id === s.parentId);
      results.push({ type: 'snippet', icon: 'file-code', label: s.title, sub: folder ? folder.name : 'Uncategorized', id: s.id, parentId: s.parentId });
    }
  });

  // Search notebooks
  (state.notebooks || []).forEach(nb => {
    if (fuzzyMatch(nb.title, q) || (nb.tags || []).some(t => fuzzyMatch(t, q))) {
      const folder = state.nodes && state.nodes.find(n => n.id === nb.parentId);
      results.push({ type: 'notebook', icon: 'book-open', label: nb.title, sub: folder ? folder.name : 'Uncategorized', id: nb.id });
    }
  });

  if (results.length === 0 && matchedCommands.length === 0) {
    container.innerHTML = `<div style="padding:1.5rem;text-align:center;color:var(--text-tertiary);font-size:0.875rem;">
      No results for "<strong>${escapeHTML(q)}</strong>"
    </div>`;
    return;
  }

  const typeLabels = { challenge: 'Program', snippet: 'Snippet', notebook: 'Notebook' };
  const typeColors = { challenge: 'var(--color-primary)', snippet: 'var(--color-accent)', notebook: 'var(--color-warning)' };

  const contentHtml = results.slice(0, 40).map(r => `
    <div class="global-search-result-item" role="option"
      onclick="handleGlobalSearchSelect('${r.type}','${r.id}','${r.parentId || ''}')"
      tabindex="-1"
      style="display:flex;align-items:center;gap:0.75rem;padding:0.625rem 0.75rem;border-radius:var(--radius-md);cursor:pointer;transition:background var(--transition-fast);"
      onmouseenter="this.style.background='var(--bg-surface-hover)'" onmouseleave="this.style.background=''">
      <i data-lucide="${r.icon}" style="width:16px;height:16px;color:${typeColors[r.type]};flex-shrink:0;" aria-hidden="true"></i>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:600;font-size:0.875rem;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHTML(r.label)}</div>
        <div style="font-size:0.75rem;color:var(--text-tertiary);">${escapeHTML(r.sub)}</div>
      </div>
      <span style="font-size:0.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:${typeColors[r.type]};background:var(--bg-surface-hover);padding:0.125rem 0.5rem;border-radius:var(--radius-full);">${typeLabels[r.type]}</span>
    </div>
  `).join('');

  container.innerHTML =
    (matchedCommands.length ? groupHeader('Commands') + matchedCommands.map(cmdRow).join('') : '') +
    (results.length ? groupHeader('Results') + contentHtml : '');

  if (typeof lucide !== 'undefined') lucide.createIcons({ root: container });
}

function handleGlobalSearchSelect(type, id, parentId) {
  closeGlobalSearch();
  if (type === 'challenge') {
    setSessionParam('browseActiveProgram', id);
    spaNavigate('browse');
    // Already on the browse route? Same-hash navigation won't re-init — open directly.
    if (typeof browseSelectProgram === 'function' && document.getElementById('browse-challenges-container')) {
      browseSelectProgram(id);
    }
  } else if (type === 'snippet') {
    setSessionParam('activeSnippetId', id);
    spaNavigate('snippets');
    // Already on the snippets route? The router won't re-init on a same-hash
    // navigation, so select directly.
    if (typeof selectSnippet === 'function' && document.getElementById('snippet-list-container')) {
      selectSnippet(id);
    }
  } else if (type === 'notebook') {
    setSessionParam('activeNotebook', id);
    spaNavigate('study');
    if (typeof notesSelectNotebook === 'function' && document.getElementById('notes-sidebar-container')) {
      notesSelectNotebook(id);
      clearSessionParam('activeNotebook');
    }
  }
}

// Keyboard navigation inside global search
document.addEventListener('keydown', (e) => {
  const modal = document.getElementById('global-search-modal');
  if (!modal || modal.classList.contains('hidden')) return;

  const items = modal.querySelectorAll('.global-search-result-item');
  if (!items.length) return;

  let focused = modal.querySelector('.global-search-result-item:focus');
  const idx = focused ? Array.from(items).indexOf(focused) : -1;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    const next = items[idx + 1] || items[0];
    next.focus();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    const prev = items[idx - 1] || items[items.length - 1];
    prev.focus();
  } else if (e.key === 'Enter') {
    // Run the focused item, or the first result if the input still has focus.
    (focused || items[0]).click();
  }
});

// Also allow Ctrl+K / Cmd+K to open search from anywhere
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    const modal = document.getElementById('global-search-modal');
    if (modal && modal.classList.contains('hidden')) {
      openGlobalSearch();
    } else {
      closeGlobalSearch();
    }
  }
});

// --- Unsaved Changes Interceptor (SPA version) ---
document.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('click', (e) => {
    // FIX: Target ANY link that starts with a hash route, not just sidebar links.
    // This protects against clicks on the brand logo or internal cross-links.
    const link = e.target.closest('a[href^="#/"]');
    if (!link) return;

    const dest = link.getAttribute('href');
    if (!dest) return;

    if (window.adminIsDirty && typeof isAdminFormOpen === 'function' && isAdminFormOpen()) {
      e.preventDefault(); // Stop the link from navigating immediately
      const route = dest.replace(/^#\/?/, ''); // Clean the route string

      showUnsavedConfirm(
        () => {
          // Discard changes
          window.adminIsDirty = false;
          spaNavigate(route);
        },
        () => {
          // Attempt to save changes
          if (window.saveCurrentAdminForm) {
            const success = window.saveCurrentAdminForm({ silent: true });
            if (success === false) return; // Keep user on page if save fails
          }
          window.adminIsDirty = false;
          spaNavigate(route);
        }
      );
    }
  });
});