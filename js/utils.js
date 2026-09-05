/* ============================================================
   UTILS.JS — Utility Functions
   ============================================================ */

// Tier definitions for global use (Mindmap, Browse, Admin)
const TIER_LEVELS = [
  { value: '', label: '—', cssClass: '' },
  { value: 's', label: 'S', cssClass: 'tier-s' },
  { value: 'a', label: 'A', cssClass: 'tier-a' },
  { value: 'b', label: 'B', cssClass: 'tier-b' },
  { value: 'c', label: 'C', cssClass: 'tier-c' },
  { value: 'd', label: 'D', cssClass: 'tier-d' },
  { value: 'e', label: 'E', cssClass: 'tier-e' }
];

/** @param {string} tier - one of s|a|b|c|d|e @returns {string} badge HTML or '' */
function getTierBadgeHTML(tier) {
  if (!tier) return '';
  const t = TIER_LEVELS.find(l => l.value === tier);
  if (!t || !t.cssClass) return '';
  return `<span class="tier-badge ${t.cssClass}">${t.label}-Tier</span>`;
}

function _applyTierSelectColor(select) {
  const tierColors = { s: '#FFD700', a: '#EF4444', b: '#F97316', c: '#3B82F6', d: '#8B5CF6', e: '#94A3B8' };
  const color = tierColors[select.value] || '';
  select.style.borderColor = color;
  select.style.color = color;
  select.style.fontWeight = color ? '800' : '';
}

// ======================== TIER PICKER MODAL ========================
function openTierPicker(nodeId, onSave) {
  const node = state.nodes.find(n => n.id === nodeId);
  const current = node ? (node.tier || '') : '';

  const tiers = [
    { value: 's', label: 'S', color: '#FFD700', desc: 'Top tier' },
    { value: 'a', label: 'A', color: '#EF4444', desc: 'High' },
    { value: 'b', label: 'B', color: '#F97316', desc: 'Above average' },
    { value: 'c', label: 'C', color: '#3B82F6', desc: 'Average' },
    { value: 'd', label: 'D', color: '#8B5CF6', desc: 'Below average' },
    { value: 'e', label: 'E', color: '#94A3B8', desc: 'Low' },
  ];

  let overlay = document.getElementById('tier-picker-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'tier-picker-overlay';
    overlay.className = 'prereq-picker-overlay';
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="prereq-picker-window" style="max-width:420px;">
      <div class="prereq-picker-header">
        <h2><i data-lucide="bar-chart-2"></i> Set Tier${node ? ' — ' + escapeHTML(node.name) : ''}</h2>
        <button onclick="closeTierPicker()" class="btn btn-ghost" style="padding:0.25rem;"><i data-lucide="x" style="width:20px;height:20px;"></i></button>
      </div>
      <div class="prereq-picker-body" style="padding:1.25rem 1.5rem; gap:0.5rem; display:flex; flex-direction:column;">
        <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:0.625rem;">
          ${tiers.map(t => `
            <button class="tier-picker-tile${current === t.value ? ' selected' : ''}" data-tier="${t.value}"
              style="--tier-color:${t.color};"
              onclick="selectTierTile('${t.value}')">
              <span class="tier-picker-tile-label">${t.label}</span>
              <span class="tier-picker-tile-desc">${t.desc}</span>
            </button>
          `).join('')}
        </div>
        <button class="tier-picker-clear${!current ? ' selected' : ''}" onclick="selectTierTile('')">
          <i data-lucide="x-circle" style="width:14px;height:14px;"></i> Clear Tier
        </button>
      </div>
    </div>
  `;

  // Store callback for custom onSave
  overlay._onSave = onSave;
  overlay._nodeId = nodeId;

  lucide.createIcons({ root: overlay });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeTierPicker(); });
}

function selectTierTile(tier) {
  const overlay = document.getElementById('tier-picker-overlay');
  if (!overlay) return;
  const onSave = overlay._onSave;
  const nodeId = overlay._nodeId;

  if (onSave) {
    onSave(tier || null);
  } else {
    updateFolderTier(nodeId, tier || null);
    if (typeof renderBrowse === 'function') renderBrowse();
    if (typeof renderSnippetList === 'function') renderSnippetList();
    if (typeof notesRenderSidebar === 'function') notesRenderSidebar();
  }
  closeTierPicker();
}

function closeTierPicker() {
  const overlay = document.getElementById('tier-picker-overlay');
  if (overlay) overlay.remove();
}

// ======================== LOCK PICKER (multi-scope prereq) ========================
let _lockPickerNodeId = null;
let _lockPickerScope = 'challenge';
let _lockPickerSelected = new Set();

function openLockPicker(nodeId, scope) {
  _lockPickerNodeId = nodeId;
  _lockPickerScope = scope || 'challenge';

  const req = (state.categoryRequirements || {})[nodeId] || {};
  _lockPickerSelected = new Set(req.requiredChallengeIds || []);

  const node = state.nodes.find(n => n.id === nodeId);
  const nodeName = node ? node.name : 'Unknown';

  const itemLabel = scope === 'challenge' ? 'programs' : scope === 'snippet' ? 'snippets' : 'notebooks';

  let overlay = document.getElementById('lock-picker-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'lock-picker-overlay';
    overlay.className = 'prereq-picker-overlay';
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="prereq-picker-window">
      <div class="prereq-picker-header">
        <h2><i data-lucide="lock"></i> Lock Prerequisites — "${escapeHTML(nodeName)}"</h2>
        <button onclick="closeLockPicker()" class="btn btn-ghost" style="padding:0.25rem;"><i data-lucide="x" style="width:20px;height:20px;"></i></button>
      </div>
      <div class="prereq-picker-search">
        <div class="prereq-picker-search-wrapper">
          <i data-lucide="search"></i>
          <input type="text" id="lock-picker-search-input" placeholder="Search ${itemLabel}..." oninput="renderLockPickerBody()">
        </div>
      </div>
      <div class="prereq-picker-body" id="lock-picker-body"></div>
      <div class="prereq-picker-footer">
        <div class="prereq-picker-count"><span id="lock-picker-count-num">0</span> prerequisite(s) selected</div>
        <div style="display:flex; gap:0.5rem;">
          <button onclick="closeLockPicker()" class="btn btn-ghost">Cancel</button>
          <button onclick="saveLockPicker()" class="btn btn-primary">
            <i data-lucide="check" style="width:16px;height:16px;"></i> Save
          </button>
        </div>
      </div>
    </div>
  `;

  lucide.createIcons({ root: overlay });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeLockPicker(); });
  renderLockPickerBody();
}

function _getLockItems() {
  if (_lockPickerScope === 'challenge') return state.challenges || [];
  if (_lockPickerScope === 'snippet') return state.snippets || [];
  if (_lockPickerScope === 'notebook') return state.notebooks || [];
  return [];
}

function renderLockPickerBody() {
  const body = document.getElementById('lock-picker-body');
  if (!body) return;

  const searchInput = document.getElementById('lock-picker-search-input');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
  const allItems = _getLockItems();
  const itemIcon = _lockPickerScope === 'challenge' ? 'code' : _lockPickerScope === 'snippet' ? 'file-code' : 'book-open';

  function renderFolderBranch(parentId, depth) {
    const folders = getChildFolders(parentId, _lockPickerScope);
    let html = '';
    folders.forEach(folder => {
      if (folder.id === _lockPickerNodeId) return; // skip self
      const items = allItems.filter(it => it.parentId === folder.id);
      const filtered = query ? items.filter(it => fuzzyMatch(it.title || it.name || '', query)) : items;
      const subHtml = renderFolderBranch(folder.id, depth + 1);
      if (filtered.length === 0 && !subHtml) return;

      html += `<div class="prereq-picker-folder">
        <div class="prereq-picker-folder-header" style="padding-left:${depth * 0.75}rem;">
          <i data-lucide="folder" style="color:var(--color-accent);"></i>
          ${escapeHTML(folder.name)}
          <span style="margin-left:auto;font-size:0.6rem;color:var(--text-tertiary);">${filtered.length}</span>
        </div>`;
      filtered.forEach(it => {
        const isChecked = _lockPickerSelected.has(it.id);
        html += `<div class="prereq-picker-item${isChecked ? ' checked' : ''}" onclick="toggleLockItem('${it.id}')" style="padding-left:${(depth + 1) * 0.75 + 0.5}rem;">
          <i data-lucide="${itemIcon}" style="width:14px;height:14px;color:var(--text-tertiary);flex-shrink:0;"></i>
          <span class="prereq-picker-item-label">${escapeHTML(it.title || it.name || '')}</span>
          <input type="checkbox" class="prereq-picker-checkbox" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation();toggleLockItem('${it.id}')">
        </div>`;
      });
      html += subHtml + `</div>`;
    });
    return html;
  }

  let html = renderFolderBranch(null, 0);

  // Root-level uncategorized items
  const rootItems = allItems.filter(it => !it.parentId);
  const filteredRoot = query ? rootItems.filter(it => fuzzyMatch(it.title || it.name || '', query)) : rootItems;
  if (filteredRoot.length > 0) {
    html += `<div class="prereq-picker-folder"><div class="prereq-picker-folder-header"><i data-lucide="inbox" style="color:var(--text-tertiary);"></i> Uncategorized <span style="margin-left:auto;font-size:0.6rem;color:var(--text-tertiary);">${filteredRoot.length}</span></div>`;
    filteredRoot.forEach(it => {
      const isChecked = _lockPickerSelected.has(it.id);
      html += `<div class="prereq-picker-item${isChecked ? ' checked' : ''}" onclick="toggleLockItem('${it.id}')">
        <i data-lucide="${itemIcon}" style="width:14px;height:14px;color:var(--text-tertiary);flex-shrink:0;"></i>
        <span class="prereq-picker-item-label">${escapeHTML(it.title || it.name || '')}</span>
        <input type="checkbox" class="prereq-picker-checkbox" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation();toggleLockItem('${it.id}')">
      </div>`;
    });
    html += `</div>`;
  }

  if (!html) {
    html = `<div class="prereq-picker-empty"><i data-lucide="search-x"></i><p>No items found${query ? ` matching "${escapeHTML(query)}"` : ''}.</p></div>`;
  }

  body.innerHTML = html;
  lucide.createIcons({ root: body });
  const countEl = document.getElementById('lock-picker-count-num');
  if (countEl) countEl.textContent = _lockPickerSelected.size;
}

function toggleLockItem(itemId) {
  if (_lockPickerSelected.has(itemId)) {
    _lockPickerSelected.delete(itemId);
  } else {
    _lockPickerSelected.add(itemId);
  }
  renderLockPickerBody();
}

function saveLockPicker() {
  if (!_lockPickerNodeId) return;
  if (!state.categoryRequirements) state.categoryRequirements = {};
  if (_lockPickerSelected.size === 0) {
    delete state.categoryRequirements[_lockPickerNodeId];
  } else {
    state.categoryRequirements[_lockPickerNodeId] = { requiredChallengeIds: Array.from(_lockPickerSelected) };
  }
  saveData();
  closeLockPicker();
  if (typeof renderBrowse === 'function') renderBrowse();
  if (typeof renderSnippetList === 'function') renderSnippetList();
  if (typeof notesRenderSidebar === 'function') notesRenderSidebar();
  // The lock picker is also reachable from the admin, where the lock badge and
  // the Skill Tree Locks grid both show what was just changed.
  if (typeof renderAdmin === 'function' && document.getElementById('admin-card-browser')) renderAdmin();
  if (typeof adminRefreshCardsIfOpen === 'function') adminRefreshCardsIfOpen();
}

function closeLockPicker() {
  const overlay = document.getElementById('lock-picker-overlay');
  if (overlay) overlay.remove();
  _lockPickerNodeId = null;
  _lockPickerSelected = new Set();
}

/* ======================== INLINE FOLDER EDITING (shared) ========================
   Click-to-edit a folder's name/description in place. Used by the Coding Library
   and (via thin wrappers) the Notes Library snippet/notebook folder overviews so
   the behaviour matches across libraries. */

/** Make the clicked element edit the folder's name in place. @param {Element} el @param {string} folderId @param {Function} [onSaved] re-render callback */
function inlineEditFolderTitle(el, folderId, onSaved) {
  if (!el || el.contentEditable === 'true') return;
  const folder = state.nodes.find(n => n.id === folderId);
  if (!folder) return;
  const original = folder.name || '';
  el.textContent = original;
  el.contentEditable = 'true';
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el); range.collapse(false);
  const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);

  function cleanup() { el.removeEventListener('blur', commit); el.removeEventListener('keydown', onKey); }
  function commit() {
    el.contentEditable = 'false';
    const v = el.textContent.trim();
    cleanup();
    if (v && v !== folder.name) {
      folder.name = v;
      saveData();
      if (typeof onSaved === 'function') onSaved();
    } else if (!v) {
      el.textContent = original;
    }
  }
  function onKey(e) {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { el.textContent = original; el.contentEditable = 'false'; cleanup(); }
  }
  el.addEventListener('blur', commit);
  el.addEventListener('keydown', onKey);
}

/** Make the clicked element edit the folder's description in place. @param {Element} el @param {string} folderId */
function inlineEditFolderDesc(el, folderId) {
  if (!el || el.contentEditable === 'true') return;
  const folder = state.nodes.find(n => n.id === folderId);
  if (!folder) return;
  const original = folder.description || '';
  el.textContent = original;
  el.contentEditable = 'true';
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el); range.collapse(false);
  const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);

  function cleanup() { el.removeEventListener('blur', commit); el.removeEventListener('keydown', onKey); }
  function commit() {
    el.contentEditable = 'false';
    const v = el.textContent.trim();
    cleanup();
    if (v !== folder.description) { folder.description = v; saveData(); }
    if (!v) { el.innerHTML = '<span style="color:var(--text-tertiary);font-style:italic;">Click to add a description...</span>'; }
  }
  function onKey(e) {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { el.textContent = original; el.contentEditable = 'false'; cleanup(); }
  }
  el.addEventListener('blur', commit);
  el.addEventListener('keydown', onKey);
}

/** @param {string} str @returns {string} HTML-entity-escaped string */
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** @param {number} secs total seconds @returns {string} "HH:MM:SS" or "MM:SS" */
function formatTimeDisplay(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/** LCS-based similarity ratio. @returns {number} 0.0–1.0 */
function calculateSimilarity(s1, s2) {
  // Quick equality checks first
  if (s1 === s2) return 1.0;
  if (s1.trim() === s2.trim()) return 0.95;
  if (s1.replace(/\s/g, '') === s2.replace(/\s/g, '')) return 0.9;

  // Character-level LCS ratio for partial match detection
  const a = s1.replace(/\s/g, '');
  const b = s2.replace(/\s/g, '');
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const n = a.length, m = b.length;

  // Char-level LCS is O(n·m). For very large inputs (e.g. the boss health bar
  // comparing whole files on every edit) that can freeze the UI, so approximate
  // with a line-level LCS instead: lines as tokens, weighted by char length.
  if (n * m > 4000000) {
    const la = s1.split('\n').map(l => l.replace(/\s/g, '')).filter(l => l !== '');
    const lb = s2.split('\n').map(l => l.replace(/\s/g, '')).filter(l => l !== '');
    const ln = la.length, lm = lb.length;
    let lprev = new Array(lm + 1).fill(0);
    let lcurr = new Array(lm + 1).fill(0);
    for (let i = 1; i <= ln; i++) {
      for (let j = 1; j <= lm; j++) {
        lcurr[j] = la[i - 1] === lb[j - 1]
          ? lprev[j - 1] + la[i - 1].length
          : Math.max(lprev[j], lcurr[j - 1]);
      }
      [lprev, lcurr] = [lcurr, lprev];
      lcurr.fill(0);
    }
    return (2 * lprev[lm]) / (a.length + b.length);
  }

  // Optimized 2-row LCS for memory efficiency
  let prev = new Array(m + 1).fill(0);
  let curr = new Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1;
      } else {
        curr[j] = Math.max(prev[j], curr[j - 1]);
      }
    }
    [prev, curr] = [curr, prev];
    curr.fill(0);
  }
  const lcsLen = prev[m];
  return (2 * lcsLen) / (a.length + b.length);
}

// Strip dangerous HTML to prevent XSS. Prefers DOMPurify (robust, loaded from
// CDN in index.html); falls back to a best-effort regex pass when DOMPurify is
// unavailable (e.g. offline first-load before the CDN script is cached).
function sanitizeHTML(html) {
  if (html == null) return '';
  if (typeof DOMPurify !== 'undefined' && DOMPurify && typeof DOMPurify.sanitize === 'function') {
    return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
  }
  // ── Fallback (DOMPurify not loaded) ──
  // Remove script tags and their content
  html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  // Remove event handler attributes (onclick, onerror, onload, etc.)
  html = html.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '');
  // Remove javascript: hrefs
  html = html.replace(/href\s*=\s*["']?\s*javascript:[^"'\s>]*/gi, 'href="#"');
  // Remove dangerous tags
  html = html.replace(/<(iframe|object|embed|form|input|button|base|meta|link|svg|math)[^>]*>/gi, '');
  return html;
}

/**
 * Sanitize untrusted rich HTML (snippet description/comments, shared content,
 * Quill output) before injecting via innerHTML. Always returns a safe string.
 * @param {string} html @returns {string}
 */
function sanitizeUserHTML(html) {
  return sanitizeHTML(html);
}

// Custom Rich Text + Markdown Support
/** Renders markdown + [[color:text]] syntax to sanitized HTML. @returns {string} */
function formatRichText(text) {
  if (!text) return '';
  let html;
  if (typeof marked !== 'undefined') {
    // Configure marked to avoid deprecated options warning
    html = marked.parse(text, { breaks: true });
    html = sanitizeHTML(html);
  } else {
    html = escapeHTML(text);
  }
  // Keep custom color syntax: [[color:text]] → <span style="color: color;">text</span>
  html = html.replace(/\[\[([a-zA-Z#0-9(),.\s%]+):([\s\S]*?)\]\]/g, '<span style="color: $1;">$2</span>');
  return html;
}

/** @param {Function} fn @param {number} wait ms @returns {Function} debounced wrapper */
function debounce(fn, wait) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

/**
 * Highlight a worked sample: its section labels, the input it is fed and the
 * output it produces, plus any [[color:text]] tokens the author wrote.
 *
 * A LABEL IS A WHOLE LINE, NOT ANYTHING BEFORE A COLON. The old rule painted
 * the text before the FIRST colon on EVERY line. In a transcript that is mostly
 * program output, so a sample reading
 *
 *   Output:
 *   Enter a number: 3 x 1 = 3
 *   3 x 2 = 6
 *
 * had "Enter a number:" coloured as though it were a section heading, while the
 * identical lines under it -- which happen to carry no colon -- stayed plain.
 * The highlighting marked a prompt as structure and split one block of output
 * in two. A label now has to be the entire line, which is also the shape
 * _sampleStdin parses when it hunts for the input block, so the two agree about
 * what a sample looks like.
 *
 * WHAT YOU TYPE AND WHAT THE PROGRAM SAYS READ DIFFERENTLY. Everything under
 * Input: is tinted, everything under Output: takes the foreground colour, so a
 * sample reads as a transcript rather than as one grey wall.
 *
 * @returns {string} HTML
 */
function formatSampleText(text) {
  if (!text) return '';
  // A heading on a line of its own -- any word, since authors name their own
  // sections and only the shape can be relied on.
  const OWN_LINE = /^([ \t]*)([A-Za-z][A-Za-z0-9 _+-]{0,23}):([ \t]*)$/;
  /* A heading with its value on the same line. This one cannot go by shape --
     'Enter a number: 3' has it too -- so it goes by name, and only the words
     that actually head a section count. That is the whole difference between
     structure and a prompt that happens to end in a colon. */
  const NAMED = /^([ \t]*)(input|output|expected|result|explanation|note|sample|example|constraints)([ \t]*:)/i;
  const sectionOf = (word) => {
    const w = word.trim().toLowerCase();
    return w === 'input' ? 'in' : (w === 'output' || w === 'expected' || w === 'result') ? 'out' : '';
  };
  let section = '';
  const html = escapeHTML(text).split('\n').map((line) => {
    const own = line.match(OWN_LINE);
    if (own) {
      section = sectionOf(own[2]);
      return '<span class="sample-label">' + line + '</span>';
    }
    const named = line.match(NAMED);
    if (named) {
      section = sectionOf(named[2]);
      const rest = line.slice(named[0].length);
      const head = '<span class="sample-label">' + named[1] + named[2] + named[3] + '</span>';
      if (!rest.trim()) return head;
      return head + (section ? '<span class="sample-' + section + '">' + rest + '</span>' : rest);
    }
    if (!line.trim() || !section) return line;
    return '<span class="sample-' + section + '">' + line + '</span>';
  }).join('\n');
  /* Author tokens last, so a colour name is never mistaken for a label.
     The style is inline and the section colouring above is a class, so a
     colour applied by hand wins over the Input:/Output: tint of the line it
     sits in -- the two never fight over the same words. */
  return html.replace(/\[\[([^:\]]+):(.*?)\]\]/g, (m, key, body) => {
    const style = sampleTokenStyle(key);
    return style ? '<span style="' + style + '">' + body + '</span>' : body;
  });
}

/* A token key is one or more words: b / i / u / s for the marks, bg-<colour>
   for a highlight, and anything else as a text colour -- which is what the
   key has always been, so `[[red:hi]]` written before any of this still
   renders exactly as it did. Values are checked against a shape rather than
   pasted into the style attribute as given. */
function sampleSafeColor(v) {
  const c = String(v || '').trim();
  if (/^#[0-9A-Fa-f]{3,8}$/.test(c)) return c;
  if (/^[A-Za-z]{3,20}$/.test(c)) return c;
  return '';
}

function sampleTokenStyle(key) {
  const out = [];
  const deco = [];
  String(key || '').trim().split(/\s+/).forEach(w => {
    const lw = w.toLowerCase();
    if (lw === 'b' || lw === 'bold') out.push('font-weight:700');
    else if (lw === 'i' || lw === 'italic') out.push('font-style:italic');
    else if (lw === 'u' || lw === 'underline') deco.push('underline');
    else if (lw === 's' || lw === 'strike') deco.push('line-through');
    else if (lw.slice(0, 3) === 'bg-') {
      const c = sampleSafeColor(w.slice(3));
      if (c) out.push('background-color:' + c);
    } else {
      const c = sampleSafeColor(w);
      if (c) out.push('color:' + c);
    }
  });
  // Underline and strike are one property, so they are collected and written
  // once -- as two declarations the second silently dropped the first.
  if (deco.length) out.push('text-decoration:' + deco.join(' '));
  return out.join(';');
}

/** Subsequence match — true if all chars of pattern appear in order within str. @returns {boolean} */
function fuzzyMatch(str, pattern) {
  if (!pattern) return true;
  str = str.toLowerCase();
  pattern = pattern.toLowerCase();

  if (str.includes(pattern)) return true;

  let patternIdx = 0;
  let strIdx = 0;
  while (patternIdx < pattern.length && strIdx < str.length) {
    if (pattern[patternIdx] === str[strIdx]) {
      patternIdx++;
    }
    strIdx++;
  }
  return patternIdx === pattern.length;
}

/** @param {Element} [root] scope icon scan to a subtree; omit for full document */
function refreshIcons(root) {
  if (typeof lucide === 'undefined') return;
  root ? lucide.createIcons({ root }) : lucide.createIcons();
}

// ======================== TEMPLATE HELPERS ========================

/**
 * Tagged template literal — enables HTML syntax highlighting in editors.
 * Usage: html`<div class="foo">${expr}</div>`
 * @returns {string}
 */
function html(strings, ...vals) {
  return strings.reduce((out, str, i) => out + str + (vals[i] ?? ''), '');
}

// ======================== RESIZER LOGIC ========================
function initResizerDrag(e, resizer) {
  e.preventDefault();
  // Its pane is folded away — the seam is only the expand arrow now.
  if (resizer.classList.contains('collapsed')) return;
  const parent = resizer.parentElement;
  if (!parent) return;

  // Always resize the fixed-width pane (viz-content-pane or messenger-pane-1),
  // regardless of visual order (handles row-reverse swap correctly).
  const fixedPane = parent.querySelector('.viz-content-pane') ||
                    parent.querySelector('.messenger-pane-1') ||
                    resizer.previousElementSibling;
  if (!fixedPane) return;

  // In row-reverse (panes swapped), dragging right should shrink the content pane.
  const isReversed = getComputedStyle(parent).flexDirection === 'row-reverse';

  const startX = e.clientX;
  const startWidth = fixedPane.getBoundingClientRect().width;

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:999999;cursor:col-resize;';
  document.body.appendChild(overlay);
  // Suspend the pane's fold-away transition, or the edge trails the cursor.
  document.body.classList.add('is-resizing');

  // One write per frame. Mousemove can fire several times between paints, and
  // each extra write forced another layout of the whole editor for nothing.
  let pending = null, raf = 0;
  const paint = () => {
    raf = 0;
    if (pending == null) return;
    fixedPane.style.width = pending + 'px';
    fixedPane.style.flexBasis = pending + 'px';
    fixedPane.style.flexShrink = '0';
    fixedPane.style.maxWidth = 'none';
    pending = null;
  };

  const mouseMoveHandler = (ev) => {
    // Releasing the button outside the window doesn't always deliver a mouseup,
    // which used to leave the full-screen grab overlay in place and the whole
    // page unclickable. The next move with no button held ends the drag.
    if (ev.buttons === 0) { mouseUpHandler(); return; }
    const delta = ev.clientX - startX;
    const newWidth = Math.max(200, startWidth + (isReversed ? -delta : delta));
    const parentWidth = parent.getBoundingClientRect().width;
    pending = Math.min(newWidth, parentWidth - 200);
    if (!raf) raf = requestAnimationFrame(paint);
  };

  const mouseUpHandler = () => {
    if (raf) { cancelAnimationFrame(raf); paint(); }
    document.body.classList.remove('is-resizing');
    if (overlay.parentNode) document.body.removeChild(overlay);
    document.removeEventListener('mousemove', mouseMoveHandler);
    document.removeEventListener('mouseup', mouseUpHandler);
    window.removeEventListener('blur', mouseUpHandler);
    window.dispatchEvent(new Event('resize'));
  };

  document.addEventListener('mousemove', mouseMoveHandler);
  document.addEventListener('mouseup', mouseUpHandler);
  window.addEventListener('blur', mouseUpHandler);   // alt-tabbed away mid-drag
}

function getHistoryForSet(setId) {
  const set = (state.codingSets || []).find(s => s.id === setId);
  if (!set) return [];
  const setProblems = set.problems || [];
  const challengeIds = new Set(setProblems.filter(p => p.source === 'library').map(p => p.challengeId));
  
  return state.history.filter(h => {
    if (h.setId === setId) return true;
    if (challengeIds.has(h.challengeId) && h.challengeTitle && h.challengeTitle.includes(`(Set: ${set.title})`)) return true;
    return false;
  });
}

function groupSetAttempts(logs) {
  const attempts = {};
  logs.forEach(l => {
    const key = l.submitTime || l.startTime || 'unknown';
    if (!attempts[key]) {
      attempts[key] = {
        submitTime: l.submitTime,
        startTime: l.startTime,
        date: l.date,
        duration: l.duration,
        scores: [],
        logs: []
      };
    }
    attempts[key].scores.push(l.score);
    attempts[key].logs.push(l);
  });
  
  return Object.values(attempts).map(att => {
    const avgScore = att.scores.length > 0 ? Math.round(att.scores.reduce((a, b) => a + b, 0) / att.scores.length) : 0;
    return {
      ...att,
      score: avgScore
    };
  }).sort((a, b) => (b.submitTime || 0) - (a.submitTime || 0));
}

/* ============================================================
   MINIMUM REQUIREMENTS — construct detection (CodeChum-style)
   A variant/problem may require certain constructs (if-else, loops…).
   Detection is heuristic over comment/string-stripped source.
   ============================================================ */

/** Strip comments AND string/char literal contents so keywords inside text don't false-match. */
function _minReqStrip(code) {
  let c = (typeof stripComments === 'function') ? stripComments(code || '') : (code || '');
  // Blank out string and char literal contents (keep the quotes as empty)
  c = c.replace(/"(?:\\.|[^"\\])*"/g, '""').replace(/'(?:\\.|[^'\\])*'/g, "''");
  return c;
}

function _hasNestedLoop(c) {
  return /\b(for|while)\s*\([^)]*\)[^{};]*\{[\s\S]*?\b(for|while)\s*\(/.test(c);
}
/** Any function definition whose name isn't main(). */
function _userFunctionNames(c) {
  const names = [];
  const re = /\b[A-Za-z_][\w\s\*]*?\b([A-Za-z_]\w*)\s*\([^;{)]*\)\s*\{/g;
  let m;
  while ((m = re.exec(c)) !== null) {
    const name = m[1];
    if (name && name !== 'main' && !['if', 'for', 'while', 'switch', 'sizeof', 'return'].includes(name)) names.push(name);
  }
  return names;
}
function _hasUserFunction(c) { return _userFunctionNames(c).length > 0; }
function _hasRecursion(c) {
  return _userFunctionNames(c).some(name => {
    const calls = (c.match(new RegExp('\\b' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\(', 'g')) || []).length;
    return calls >= 2; // definition + at least one self-call
  });
}

const MIN_REQ_DEFS = [
  { type: 'ifelse', label: 'If-Else Statement', test: c => /\bif\s*\(/.test(c) && /\belse\b/.test(c) },
  { type: 'if', label: 'If Statement', test: c => /\bif\s*\(/.test(c) },
  { type: 'switch', label: 'Switch Statement', test: c => /\bswitch\s*\(/.test(c) },
  { type: 'for', label: 'For Loop', test: c => /\bfor\s*\(/.test(c) },
  { type: 'while', label: 'While Loop', test: c => /\bwhile\s*\(/.test(c) },
  { type: 'dowhile', label: 'Do-While Loop', test: c => /\bdo\b[\s\S]*?\bwhile\s*\(/.test(c) },
  { type: 'loop', label: 'Loop (any)', test: c => /\b(for|while)\s*\(/.test(c) },
  { type: 'nestedloop', label: 'Nested Loop', test: c => _hasNestedLoop(c) },
  { type: 'function', label: 'User-Defined Function', test: c => _hasUserFunction(c) },
  { type: 'recursion', label: 'Recursion', test: c => _hasRecursion(c) },
  { type: 'array', label: 'Array', test: c => /\b[A-Za-z_]\w*\s+[A-Za-z_]\w*\s*\[/.test(c) || /\[\s*\]/.test(c) },
  { type: 'pointer', label: 'Pointer', test: c => /\b[A-Za-z_]\w*\s*\*\s*[A-Za-z_]\w*/.test(c) || /->/.test(c) },
  { type: 'ternary', label: 'Ternary Operator (?:)', test: c => /\?[^?:;]*:/.test(c) },
  { type: 'printf', label: 'Output (printf)', test: c => /\bprintf\s*\(/.test(c) },
  { type: 'scanf', label: 'Input (scanf)', test: c => /\b(scanf|gets|fgets|getchar)\s*\(/.test(c) },
];

function _minReqDef(type) { return MIN_REQ_DEFS.find(d => d.type === type); }
function minReqLabel(type) { const d = _minReqDef(type); return d ? d.label : type; }

/** True if the code satisfies a single requirement. */
function evalMinRequirement(type, code) {
  const def = _minReqDef(type);
  if (!def) return true; // unknown requirement → don't block
  try { return !!def.test(_minReqStrip(code)); } catch (e) { return false; }
}

// ============================================================
// SHARED PAGINATION HELPER
// ============================================================

const ITEMS_PER_PAGE = 15;

/**
 * Build the pagination bar HTML.
 * @param {number} totalItems  Total items (post-filter)
 * @param {number} currentPage 1-indexed
 * @param {string} onPageFn    Name of the JS function to call with the page number, e.g. 'browsePage'
 * @returns {string} HTML string — empty if totalItems <= ITEMS_PER_PAGE
 */
function _buildPaginationBar(totalItems, currentPage, onPageFn) {
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  if (totalPages <= 1) return '';

  let html = '<div class="pagination-bar">';

  // Previous
  html += `<button class="page-btn page-arrow" onclick="${onPageFn}(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''} title="Previous page">&lsaquo;</button>`;

  // Page numbers with smart ellipsis
  const pages = _paginationRange(currentPage, totalPages);
  let prev = 0;
  pages.forEach(p => {
    if (p - prev > 1) html += '<span class="page-ellipsis">…</span>';
    html += `<button class="page-btn ${p === currentPage ? 'active' : ''}" onclick="${onPageFn}(${p})">${p}</button>`;
    prev = p;
  });

  // Next
  html += `<button class="page-btn page-arrow" onclick="${onPageFn}(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''} title="Next page">&rsaquo;</button>`;

  html += '</div>';
  return html;
}

/** Generate the array of page numbers to show (always includes first, last, and neighbors of current). */
function _paginationRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total]);
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.add(i);
  return [...pages].sort((a, b) => a - b);
}