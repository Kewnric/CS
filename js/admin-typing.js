/* ============================================================
   ADMIN-TYPING.JS — authoring for the Memorization Typing Library
   ------------------------------------------------------------
   One thing to write here: an entry. Text or code; for code, which of the
   four languages, because that decides its highlighting, its indentation and
   what auto close fills in. The form edits a working copy and only commits
   on Save, so backing out of a half-written entry leaves the store alone.

   The content box behaves like a small editor for code — Tab indents, Enter
   keeps the line's indentation — so pasting and touching up a snippet does
   not fight you. A live preview underneath shows it exactly as the test will.
   ============================================================ */

let mtaDraft = null;
let mtaQuery = '';
let mtaFilter = 'all';

function adminTypingTemplate() {
  return `
    <div class="home-content">
      <div class="home-scroll" id="mta-root" style="padding:1.5rem 2rem 4rem;">
        <div class="admin-hub-head">
          <button onclick="spaNavigate('admin')" class="btn-back-dark" style="padding:0.25rem 0.5rem; font-size:0.75rem;">
            <i data-lucide="chevron-left" style="width:14px;height:14px;"></i> Back
          </button>
          <h1 class="lib-hub-title" style="font-size:1.6rem; margin-left:0.75rem;">Memorization Typing Admin</h1>
          <span class="mta-grow"></span>
          <button class="btn btn-secondary btn-sm" type="button" onclick="spaNavigate('typing')" title="Open the library">
            <i data-lucide="keyboard" style="width:14px;height:14px;"></i> Library
          </button>
        </div>
        <div id="mta-body"></div>
      </div>
    </div>`;
}

function adminTypingInit() {
  mtStore();
  mtaQuery = '';
  mtaFilter = 'all';
  mtaDraft = null;
  const edit = getSessionParam('mtaEdit');
  const asCode = getSessionParam('mtaAsCode');
  if (edit) {
    setSessionParam('mtaEdit', null);
    setSessionParam('mtaAsCode', null);
    const it = mtFindItem(edit);
    if (it) mtaDraft = JSON.parse(JSON.stringify(mtNormItem(it)));
    // arriving from the test's "this looks like code": switched, not yet saved
    if (mtaDraft && asCode && MT_LANGS.some(l => l.key === asCode)) { mtaDraft.kind = 'code'; mtaDraft.lang = asCode; }
  }
  renderTypingAdmin();
}

function adminTypingDestroy() { mtaDraft = null; }

/* Ctrl+S (Cmd+S) saves the entry and closes the form, the key the other admin
   screens use. Bound once on the document and gated on this form being open,
   so it cannot fight them for the shortcut. Capture phase, so the content box's
   own key handling never sees it; Ctrl+Shift+S is left to the cloud save. */
document.addEventListener('keydown', function (e) {
  if (!mtaDraft || !document.getElementById('mta-content')) return;
  if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || String(e.key).toLowerCase() !== 's') return;
  e.preventDefault();
  e.stopPropagation();
  if (e.repeat) return;
  // a dialog already up (the "save as code?" question) is answered there
  const dlg = document.getElementById('dialog-modal');
  if (dlg && !dlg.classList.contains('hidden')) return;
  mtaSave(false);
}, true);

function renderTypingAdmin() {
  const body = document.getElementById('mta-body');
  if (!body) return;
  body.innerHTML = mtaDraft ? mtaFormHTML() : mtaListHTML();
  const root = document.getElementById('mta-root');
  if (typeof lucide !== 'undefined' && root) lucide.createIcons({ root });
  if (mtaDraft) mtaWireForm();
}

/* ── The list ─────────────────────────────────────────────── */

function mtaListHTML() {
  const q = mtaQuery.trim().toLowerCase();
  const all = mtItems();
  const shown = all.filter(it => {
    if (mtaFilter === 'text' && it.kind !== 'text') return false;
    if (MT_LANGS.some(l => l.key === mtaFilter) && !(it.kind === 'code' && it.lang === mtaFilter)) return false;
    if (!q) return true;
    return (it.title || '').toLowerCase().includes(q) || (it.tags || []).some(t => t.toLowerCase().includes(q))
      || (it.content || '').toLowerCase().includes(q);
  });
  const filters = [['all', 'All', 'layers'], ['text', 'Text', 'file-text']].concat(MT_LANGS.map(l => [l.key, l.name, l.icon]));
  const rows = shown.map(it => {
    const sz = mtItemSize(it);
    const best = mtBestFor(it.id);
    return `
      <tr>
        <td><strong>${escapeHTML(it.title || 'Untitled')}</strong>
          ${(it.tags || []).length ? `<div class="mta-tags">${it.tags.map(t => `<span class="lang-mini-pill">${escapeHTML(t)}</span>`).join('')}</div>` : ''}</td>
        <td><span class="mta-kind is-${it.kind === 'code' ? it.lang : 'text'}">${escapeHTML(it.kind === 'code' ? mtLangMeta(it.lang).name : 'Text')}</span>
          ${(() => {
            const g = it.kind === 'text' ? mtGuessLang(it.content) : null;
            return g ? `<button class="mta-convert" type="button" onclick="mtaConvert('${it.id}', '${g}')" title="It looks like ${escapeHTML(mtLangMeta(g).name)} code">
              <i data-lucide="triangle-alert"></i> make it ${escapeHTML(mtLangMeta(g).name)}</button>` : '';
          })()}</td>
        <td>${it.kind === 'code' ? sz.lines + ' line' + (sz.lines !== 1 ? 's' : '') : sz.words + ' word' + (sz.words !== 1 ? 's' : '')} · ${sz.chars} chars</td>
        <td>${best ? mtSpeed(best.wpm) + ' ' + mtUnitLabel() : '<em>—</em>'}</td>
        <td class="lang-admin-actions">
          <button class="btn btn-ghost btn-sm" onclick="mtlRun('${it.id}')" title="Practise it" aria-label="Practise ${escapeHTML(it.title)}"><i data-lucide="play"></i></button>
          <button class="btn btn-ghost btn-sm" onclick="mtaEdit('${it.id}')" title="Edit" aria-label="Edit ${escapeHTML(it.title)}"><i data-lucide="pencil"></i></button>
          <button class="btn btn-ghost btn-sm" onclick="mtaDuplicate('${it.id}')" title="Duplicate" aria-label="Duplicate ${escapeHTML(it.title)}"><i data-lucide="copy"></i></button>
          <button class="btn btn-ghost btn-sm" onclick="mtaDelete('${it.id}')" title="Delete" aria-label="Delete ${escapeHTML(it.title)}"><i data-lucide="trash-2"></i></button>
        </td>
      </tr>`;
  }).join('');
  return `
    <div class="lang-admin-bar mta-bar">
      <button class="btn btn-primary" onclick="mtaNew('text')"><i data-lucide="file-plus" style="width:15px;height:15px;"></i> New text</button>
      <button class="btn btn-primary" onclick="mtaNew('code')"><i data-lucide="file-code" style="width:15px;height:15px;"></i> New code</button>
      <div class="search-container lang-admin-search">
        <i data-lucide="search"></i>
        <input type="text" class="search-input" id="mta-q" placeholder="Search entries…" autocomplete="off"
               aria-label="Search entries" value="${escapeHTML(mtaQuery)}" oninput="mtaSetQuery(this.value)" />
      </div>
      <span class="lang-admin-count" id="mta-count">${q || mtaFilter !== 'all' ? shown.length + ' of ' + all.length : all.length} entr${all.length === 1 ? 'y' : 'ies'}</span>
    </div>
    <div class="lang-tabs mta-filters" style="padding:0 0 0.85rem;">
      ${filters.map(([k, label, icon]) => `<button class="lang-tab${mtaFilter === k ? ' is-active' : ''}" type="button" onclick="mtaSetFilter('${k}')"><i data-lucide="${icon}"></i> ${escapeHTML(label)}</button>`).join('')}
    </div>
    <table class="lang-admin-table" id="mta-table">
      <thead><tr><th>Title</th><th>Type</th><th>Size</th><th>Best</th><th></th></tr></thead>
      <tbody>${rows || `<tr><td colspan="5"><em>${all.length ? 'Nothing matches.' : 'No entries yet. Start with New text or New code — paste what you want to memorise.'}</em></td></tr>`}</tbody>
    </table>`;
}

function mtaSetQuery(v) {
  mtaQuery = v || '';
  const body = document.getElementById('mta-body');
  if (!body) return;
  // swap only the table, so the caret stays in the box
  const tmp = document.createElement('div');
  tmp.innerHTML = mtaListHTML();
  const a = document.getElementById('mta-table'), b = tmp.querySelector('#mta-table');
  const ca = document.getElementById('mta-count'), cb = tmp.querySelector('#mta-count');
  if (a && b) { a.innerHTML = b.innerHTML; if (typeof lucide !== 'undefined') lucide.createIcons({ root: a }); }
  if (ca && cb) ca.textContent = cb.textContent;
}

function mtaSetFilter(f) { mtaFilter = f; renderTypingAdmin(); }

function mtaConvert(id, lang) {
  const it = mtConvertToCode(id, lang);
  if (!it) return;
  renderTypingAdmin();
  if (typeof toast === 'function') toast(`"${it.title || 'Untitled'}" is now a ${mtLangMeta(it.lang).name} code entry.`, { type: 'success' });
}

function mtaNew(kind) { mtaDraft = mtBlankItem(kind); renderTypingAdmin(); }

function mtaEdit(id) {
  const it = mtFindItem(id);
  if (!it) return;
  mtaDraft = JSON.parse(JSON.stringify(mtNormItem(it)));
  renderTypingAdmin();
}

function mtaDuplicate(id) {
  const it = mtFindItem(id);
  if (!it) return;
  const copy = JSON.parse(JSON.stringify(mtNormItem(it)));
  copy.id = generateId();
  copy.title = (it.title || 'Untitled') + ' (copy)';
  copy.createdAt = copy.updatedAt = Date.now();
  mtSaveItem(copy);
  renderTypingAdmin();
  if (typeof toast === 'function') toast('Duplicated.', { type: 'success' });
}

function mtaDelete(id) {
  const it = mtFindItem(id);
  if (!it) return;
  showConfirm('Delete entry?', `Delete "${it.title || 'Untitled'}"? Its results stay in your history. You can undo this.`, () => {
    mtDeleteItem(id, renderTypingAdmin);
  });
}

/* ── The form ─────────────────────────────────────────────── */

function mtaFormHTML() {
  const d = mtaDraft;
  const isNew = !mtFindItem(d.id);
  return `
    <div class="af-section">
      <div class="af-section-header"><i data-lucide="${d.kind === 'code' ? 'file-code' : 'file-text'}" class="af-section-icon"></i>
        <span>${isNew ? 'New entry' : 'Edit entry'}</span></div>
      <div class="af-section-body">
        <div class="af-field">
          <label class="form-label">Title <span class="af-label-hint">(left blank, the first line is used)</span></label>
          <input class="form-input af-input-bold" id="mta-title" value="${escapeHTML(d.title)}" placeholder="e.g. Hello World in C" />
        </div>
        <div class="af-row-2" style="gap:0.75rem;">
          <div class="af-field" style="flex:1;">
            <label class="form-label">Type</label>
            <div class="lang-tabs" style="padding:0;" id="mta-kind">
              <button class="lang-tab${d.kind === 'text' ? ' is-active' : ''}" type="button" onclick="mtaSetKind('text')"><i data-lucide="file-text"></i> Text</button>
              <button class="lang-tab${d.kind === 'code' ? ' is-active' : ''}" type="button" onclick="mtaSetKind('code')"><i data-lucide="code-2"></i> Code</button>
            </div>
          </div>
          <div class="af-field" style="flex:2;"${d.kind === 'code' ? '' : ' hidden'} id="mta-lang-field">
            <label class="form-label">Language</label>
            <div class="lang-tabs" style="padding:0;" id="mta-lang">
              ${MT_LANGS.map(l => `<button class="lang-tab${d.lang === l.key ? ' is-active' : ''}" type="button" onclick="mtaSetLang('${l.key}')"><i data-lucide="${l.icon}"></i> ${l.name}</button>`).join('')}
            </div>
          </div>
        </div>
        <div class="af-field">
          <label class="form-label">${d.kind === 'code' ? 'Code' : 'Text'} <span class="af-label-hint" id="mta-size"></span></label>
          <textarea class="form-textarea mta-content${d.kind === 'code' ? ' is-code' : ''}" id="mta-content" rows="${d.kind === 'code' ? 16 : 9}" spellcheck="${d.kind === 'code' ? 'false' : 'true'}"
                    placeholder="${d.kind === 'code' ? 'Paste the snippet or the whole program' : 'Paste the paragraph you want to memorise'}">${escapeHTML(d.content)}</textarea>
          <p class="lang-form-hint" id="mta-hint">${d.kind === 'code'
            ? '<i data-lucide="info" style="width:13px;height:13px;"></i> Tab indents, Shift+Tab un-indents, Enter keeps the indentation. Tabs become four spaces.'
            : '<i data-lucide="info" style="width:13px;height:13px;"></i> Line breaks are kept (Enter or space both move on). Curly quotes and dashes become plain ones.'}</p>
          <div class="mta-codehint" id="mta-codehint" hidden></div>
        </div>
        <div class="af-field">
          <label class="form-label">Preview <span class="af-label-hint">(what the test shows, ghosted)</span></label>
          <div class="mta-preview" id="mta-preview"></div>
        </div>
        <div class="af-row-2" style="gap:0.75rem;">
          <div class="af-field" style="flex:1;">
            <label class="form-label"><i data-lucide="tag" class="af-label-icon"></i>Tags <span class="af-label-hint">(comma separated)</span></label>
            <input class="form-input" id="mta-tags" value="${escapeHTML((d.tags || []).join(', '))}" placeholder="e.g. exam, basics" />
          </div>
          <div class="af-field" style="flex:1;">
            <label class="form-label">Notes <span class="af-label-hint">(optional, shown in the library)</span></label>
            <input class="form-input" id="mta-notes" value="${escapeHTML(d.notes || '')}" placeholder="Anything worth remembering about it" />
          </div>
        </div>
      </div>
    </div>
    <div class="modal-actions" style="justify-content:flex-end; gap:0.5rem;">
      <button class="btn btn-secondary" onclick="mtaCancel()">Cancel</button>
      <button class="btn btn-secondary" onclick="mtaSave(true)"><i data-lucide="play" style="width:15px;height:15px;"></i> Save &amp; practise</button>
      <button class="btn btn-primary" onclick="mtaSave(false)" title="Save and close (Ctrl+S)">
        <i data-lucide="check" style="width:15px;height:15px;"></i> Save entry <kbd class="mta-kbd">${/Mac|iPhone|iPad/.test(navigator.platform || '') ? '⌘' : 'Ctrl'} S</kbd>
      </button>
    </div>`;
}

function mtaCollect() {
  const d = mtaDraft;
  if (!d) return;
  const v = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
  d.title = v('mta-title');
  d.content = v('mta-content');
  d.tags = v('mta-tags').split(',').map(t => t.trim()).filter(Boolean);
  d.notes = v('mta-notes');
}

function mtaSetKind(kind) {
  mtaCollect();
  mtaDraft.kind = kind;
  renderTypingAdmin();
}

function mtaSetLang(lang) {
  mtaCollect();
  mtaDraft.lang = lang;
  document.querySelectorAll('#mta-lang .lang-tab').forEach((b, i) => b.classList.toggle('is-active', MT_LANGS[i].key === lang));
  mtaPreview();
}

function mtaCancel() { mtaDraft = null; renderTypingAdmin(); }

function mtaSave(practise, keepAsText) {
  mtaCollect();
  // code under Text is the easy mistake here; ask once, at the moment it is made
  const guess = mtaDraft.kind === 'text' && !keepAsText ? mtGuessLang(mtaDraft.content) : null;
  if (guess && typeof showChoice === 'function') {
    const name = mtLangMeta(guess).name;
    showChoice({
      title: 'Save as ' + name + ' code?',
      message: 'This is set to Text but looks like ' + name + ' code. As text it types like a paragraph and does not show under ' + name + ' in the library.',
      primary: { label: 'Save as ' + name + ' code', detail: 'Highlighting, auto indent, auto close and the code window', icon: mtLangMeta(guess).icon },
      secondary: { label: 'Keep it as text', detail: 'Type it like prose', icon: 'file-text' },
      onPrimary: () => { mtaDraft.kind = 'code'; mtaDraft.lang = guess; mtaSave(practise, true); },
      onSecondary: () => mtaSave(practise, true)
    });
    return;
  }
  const saved = mtSaveItem(mtaDraft);
  if (!saved) {
    showMessage('Nothing to save', 'Paste or type the text you want to memorise first.', true);
    return;
  }
  mtaDraft = null;
  if (typeof toast === 'function') toast('Entry saved.', { type: 'success' });
  if (practise) { mtlRun(saved.id); return; }
  renderTypingAdmin();
}

function mtaPreview() {
  const d = mtaDraft;
  const host = document.getElementById('mta-preview');
  const size = document.getElementById('mta-size');
  const ta = document.getElementById('mta-content');
  if (!d || !host || !ta) return;
  const s = mtCleanContent(ta.value, d.kind);
  host.className = 'mta-preview' + (d.kind === 'code' ? ' is-code' : '');
  host.innerHTML = s
    ? (d.kind === 'code' ? `<pre class="mtl-pre tk-on">${mtHighlightHTML(s, d.lang)}</pre>` : `<div class="mtl-prose">${escapeHTML(s).replace(/\n/g, '<br>')}</div>`)
    : '<em class="mta-preview-empty">Nothing yet.</em>';
  if (size) {
    const words = s.split(/\s+/).filter(Boolean).length;
    const lines = s ? s.split('\n').length : 0;
    size.textContent = s ? `(${s.length} chars · ${words} words${d.kind === 'code' ? ' · ' + lines + ' lines' : ''})` : '';
  }
  // code pasted into a Text entry types as prose; say so while it is still a draft
  const hint = document.getElementById('mta-codehint');
  if (hint) {
    const guess = d.kind === 'text' ? mtGuessLang(s) : null;
    hint.hidden = !guess;
    if (guess) {
      const name = mtLangMeta(guess).name;
      hint.innerHTML = `<i data-lucide="code-2"></i>
        <span>This looks like ${escapeHTML(name)} code. As Code it gets highlighting, a scrolling code window, auto indent and auto close.</span>
        <button class="btn btn-secondary btn-sm" type="button" onclick="mtaSwitchToCode('${guess}')">Make it ${escapeHTML(name)}</button>`;
      if (typeof lucide !== 'undefined') lucide.createIcons({ root: hint });
    }
  }
}

function mtaSwitchToCode(lang) {
  mtaCollect();
  mtaDraft.kind = 'code';
  mtaDraft.lang = lang;
  renderTypingAdmin();
}

/** The content box as a small code editor: Tab, Shift+Tab, and Enter that keeps indentation. */
function mtaWireForm() {
  const ta = document.getElementById('mta-content');
  if (!ta) return;
  let t = null;
  ta.addEventListener('input', () => { clearTimeout(t); t = setTimeout(mtaPreview, 80); });
  ta.addEventListener('keydown', (e) => {
    if (!mtaDraft || mtaDraft.kind !== 'code') return;
    const v = ta.value, s = ta.selectionStart, end = ta.selectionEnd;
    const lineStart = v.lastIndexOf('\n', s - 1) + 1;
    if (e.key === 'Tab') {
      e.preventDefault();
      if (s !== end && v.slice(s, end).indexOf('\n') !== -1 || e.shiftKey) {
        // indent or un-indent every selected line
        const blockEnd = v.indexOf('\n', end) === -1 ? v.length : v.indexOf('\n', end);
        const lines = v.slice(lineStart, blockEnd).split('\n');
        const out = lines.map(l => e.shiftKey ? l.replace(/^ {1,4}/, '') : '    ' + l).join('\n');
        ta.setRangeText(out, lineStart, blockEnd, 'select');
      } else {
        ta.setRangeText('    ', s, end, 'end');
      }
      ta.dispatchEvent(new Event('input'));
    } else if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
      const line = v.slice(lineStart, s);
      let ind = (line.match(/^ */) || [''])[0];
      if (/[{\[(]\s*$/.test(line)) ind += '    ';
      e.preventDefault();
      ta.setRangeText('\n' + ind, s, end, 'end');
      ta.dispatchEvent(new Event('input'));
    } else if ((e.key === '}' || e.key === ']' || e.key === ')') && s === end && /^ +$/.test(v.slice(lineStart, s))) {
      // a closer on a line of nothing but indentation steps back out, as an editor does
      e.preventDefault();
      const cut = Math.min(4, s - lineStart);
      ta.setRangeText(e.key, s - cut, s, 'end');
      ta.dispatchEvent(new Event('input'));
    }
  });
  mtaPreview();
  const title = document.getElementById('mta-title');
  if (title && !title.value) title.focus();
}
