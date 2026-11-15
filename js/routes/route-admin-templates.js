/* ============================================================
   Route: admin-templates — writing templates
   ------------------------------------------------------------
   The list on the left, the form on the right. A template is written as
   ordinary C; selecting a name and pressing Mark as slot (Ctrl+M) turns it
   into a slot, optionally everywhere it appears as code (never inside a
   string or a comment). The preview shows the canonical form and one
   variation, and Run the harness compiles the canonical form inside it.

   Import and Export use the plain text format in js/templates.js, which is
   also what "Copy the format for an AI" hands out, so a set of templates can
   be asked for in any chat and pasted straight in. Nothing is written until
   the preview of what was read has been accepted.

   The form takes part in the admin's unsaved-changes guard: its container is
   in admin-core.js isAdminFormOpen, and Save is saveCurrentAdminForm.
   ============================================================ */

const atpl = { id: null, draft: null, q: '', varySeed: 1, importItems: null };

function adminTemplatesTemplate() {
  return `
    <div class="home-content">
      <div class="home-scroll atpl">
        <div class="chub-top">
          <button onclick="spaNavigate('training')" class="btn-back-dark chub-back">
            <i data-lucide="chevron-left" style="width:14px;height:14px;"></i> Training hub
          </button>
          <h1 class="atpl-h1"><i data-lucide="puzzle"></i> Templates</h1>
          <span></span>
        </div>
        <div class="atpl-layout">
          <aside class="atpl-list-pane">
            <div class="atpl-list-tools">
              <div class="search-container"><i data-lucide="search"></i>
                <input type="text" id="atpl-q" class="search-input" placeholder="Find…" autocomplete="off" oninput="atplRenderList()">
              </div>
              <button class="btn btn-primary btn-sm" onclick="atplOpen('new')" title="New template"><i data-lucide="plus"></i> New</button>
            </div>
            <div class="atpl-list" id="atpl-list" role="listbox" aria-label="Templates"></div>
            <div class="atpl-list-foot">
              <button class="btn btn-ghost btn-sm" onclick="atplImportOpen()"><i data-lucide="upload"></i> Import</button>
              <button class="btn btn-ghost btn-sm" onclick="atplExport()"><i data-lucide="download"></i> Export</button>
              <button class="btn btn-ghost btn-sm" onclick="atplCopyFormat()" title="Instructions to paste into an AI chat, so its answer can be imported here"><i data-lucide="clipboard-copy"></i> Format for an AI</button>
            </div>
          </aside>
          <section class="atpl-main" id="atpl-main">
            <div class="atpl-empty" id="atpl-empty"><i data-lucide="mouse-pointer-click"></i><p>Pick a template, or start a new one.</p></div>
            <form class="atpl-form hidden" id="atpl-form" onsubmit="event.preventDefault(); atplSave();" autocomplete="off"></form>
          </section>
        </div>
      </div>
    </div>`;
}

function adminTemplatesInit() {
  if (typeof tplEnsureStarters === 'function') tplEnsureStarters();
  atpl.id = null; atpl.draft = null;
  window.adminIsDirty = false;
  window.saveCurrentAdminForm = () => atplSave({ silent: true });
  atplRenderList();
  // Handed over from elsewhere: Make template from a program, a snippet or Freeground.
  const pre = getSessionParam('adminPrefill');
  if (pre && pre.kind === 'template') {
    clearSessionParam('adminPrefill');
    atplOpen('new', { title: pre.title, body: pre.body, sourceType: pre.sourceType, sourceId: pre.sourceId });
    _atplDirty(true);
  }
  atpl.onKey = (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.code === 'KeyS' && atpl.draft) { e.preventDefault(); atplSave(); }
  };
  document.addEventListener('keydown', atpl.onKey);
}

function adminTemplatesDestroy() {
  if (atpl.onKey) document.removeEventListener('keydown', atpl.onKey);
  window.adminIsDirty = false;
  window.saveCurrentAdminForm = null;
  atplImportClose();
}

function atplRender() { atplRenderList(); if (atpl.id && atpl.id !== 'new' && !tplFind(atpl.id)) atplClose(); }

function _atplDirty(on) {
  window.adminIsDirty = !!on;
  const s = document.getElementById('atpl-save-state');
  if (s) s.textContent = on ? 'Unsaved changes' : '';
}

function atplRenderList() {
  const host = document.getElementById('atpl-list');
  if (!host) return;
  const q = ((document.getElementById('atpl-q') || {}).value || '').trim().toLowerCase();
  const list = tplStore().filter(t => !q || t.title.toLowerCase().includes(q) || (t.tags || []).join(' ').toLowerCase().includes(q));
  host.innerHTML = list.length ? list.map(t => `
    <button type="button" class="atpl-item${t.id === atpl.id ? ' is-on' : ''}" role="option" aria-selected="${t.id === atpl.id}" onclick="atplOpen('${escapeHTML(t.id)}')">
      <strong>${escapeHTML(t.title)}</strong>
      <span>${t.builtin ? '<em class="atpl-badge">built in</em>' : ''}${escapeHTML((t.tags || []).join(', '))}</span>
    </button>`).join('') : '<p class="atpl-none">No templates match.</p>';
}

/* ── The form ──────────────────────────────────────────────── */

function atplOpen(id, seed) {
  if (window.adminIsDirty && atpl.draft && id !== atpl.id) {
    if (!confirm('Leave this template without saving your changes?')) return;
  }
  const src = id === 'new' ? Object.assign({ id: null, title: '', label: '', body: '', tags: [], concepts: [], pool: [], harness: null }, seed || {}) : tplFind(id);
  if (!src) return;
  atpl.id = id;
  atpl.draft = JSON.parse(JSON.stringify(tplNormal(src)));
  if (id === 'new') atpl.draft.id = null;
  atpl.varySeed = 1;
  _atplDirty(false);
  _atplRenderForm();
  atplRenderList();
}

function atplClose() {
  atpl.id = null; atpl.draft = null;
  _atplDirty(false);
  const form = document.getElementById('atpl-form');
  const empty = document.getElementById('atpl-empty');
  if (form) form.classList.add('hidden');
  if (empty) empty.classList.remove('hidden');
  atplRenderList();
}

function _atplRenderForm() {
  const form = document.getElementById('atpl-form');
  const empty = document.getElementById('atpl-empty');
  const d = atpl.draft;
  if (!form || !d) return;
  if (empty) empty.classList.add('hidden');
  form.classList.remove('hidden');
  const h = d.harness || { prelude: '', code: '', stdin: '', expect: '' };
  const concepts = (typeof MIN_REQ_DEFS !== 'undefined' ? MIN_REQ_DEFS : []).map(x => ({ id: x.type, label: x.label }));
  const isBuiltin = d.builtin && (typeof TPL_STARTER !== 'undefined') && TPL_STARTER.some(t => t.id === d.id);
  form.innerHTML = `
    <div class="atpl-form-head">
      <h2>${atpl.id === 'new' ? 'New template' : 'Edit template'}</h2>
      <span class="atpl-save-state" id="atpl-save-state"></span>
    </div>
    <label class="form-label" for="atpl-title">Title</label>
    <input class="form-input" id="atpl-title" maxlength="80" value="${escapeHTML(d.title)}" placeholder="Linked list: push at head">
    <label class="form-label" for="atpl-label">What it does (the only prompt at Recall)</label>
    <input class="form-input" id="atpl-label" maxlength="200" value="${escapeHTML(d.label)}" placeholder="Insert a node at the head of a singly linked list.">
    <div class="atpl-row2">
      <div><label class="form-label" for="atpl-tags">Tags</label>
        <input class="form-input" id="atpl-tags" value="${escapeHTML((d.tags || []).join(', '))}" placeholder="arrays, sorting"></div>
      <div><label class="form-label">Ideas it uses</label>
        <div class="atpl-concepts" id="atpl-concepts">${concepts.map(c => `
          <label class="atpl-chip"><input type="checkbox" value="${c.id}" ${(d.concepts || []).indexOf(c.id) !== -1 ? 'checked' : ''}> ${escapeHTML(c.label)}</label>`).join('')}</div></div>
    </div>

    <div class="atpl-body-head">
      <label class="form-label" for="atpl-body">The code</label>
      <button type="button" class="btn btn-secondary btn-sm" onclick="atplMarkStart()" title="Select a name in the code, then press this (Ctrl+M)"><i data-lucide="brackets"></i> Mark as slot</button>
    </div>
    <div class="atpl-slotbar hidden" id="atpl-slotbar">
      <span>Slot name</span><input class="form-input" id="atpl-slot-name" maxlength="30">
      <label class="atpl-chip"><input type="checkbox" id="atpl-slot-all" checked> <span id="atpl-slot-all-label">everywhere it appears</span></label>
      <button type="button" class="btn btn-primary btn-sm" onclick="atplMarkApply()">Mark</button>
      <button type="button" class="btn btn-ghost btn-sm" onclick="atplMarkCancel()">Cancel</button>
    </div>
    <textarea class="form-textarea atpl-code" id="atpl-body" rows="14" spellcheck="false" placeholder="Write the C code, then mark the names that change as slots.">${escapeHTML(d.body)}</textarea>
    <div class="atpl-slots" id="atpl-slots"></div>

    <label class="form-label" for="atpl-pool">Name sets for Vary (optional, one per line)</label>
    <textarea class="form-textarea atpl-code" id="atpl-pool" rows="3" spellcheck="false" placeholder="Type=Book, field=isbn">${escapeHTML(tplPoolText(d.pool))}</textarea>
    <div class="atpl-msg" id="atpl-pool-msg"></div>

    <details class="atpl-harness" ${h.code ? 'open' : ''}>
      <summary><i data-lucide="flask-conical"></i> Harness: a main() that calls it and prints a fixed result (optional)</summary>
      <label class="form-label" for="atpl-prelude">Before the template (#includes, a struct it needs)</label>
      <textarea class="form-textarea atpl-code" id="atpl-prelude" rows="2" spellcheck="false">${escapeHTML(h.prelude)}</textarea>
      <label class="form-label" for="atpl-hcode">After the template (main)</label>
      <textarea class="form-textarea atpl-code" id="atpl-hcode" rows="6" spellcheck="false">${escapeHTML(h.code)}</textarea>
      <div class="atpl-row2">
        <div><label class="form-label" for="atpl-stdin">Input</label>
          <textarea class="form-textarea atpl-code" id="atpl-stdin" rows="2" spellcheck="false">${escapeHTML(h.stdin)}</textarea></div>
        <div><label class="form-label" for="atpl-expect">Expected output, exactly</label>
          <textarea class="form-textarea atpl-code" id="atpl-expect" rows="2" spellcheck="false">${escapeHTML(h.expect)}</textarea></div>
      </div>
      <button type="button" class="btn btn-secondary btn-sm" onclick="atplRunHarness()"><i data-lucide="play"></i> Run the harness</button>
      <div class="atpl-msg" id="atpl-run-out"></div>
    </details>

    <div class="atpl-preview">
      <div><div class="atpl-pv-title">As written (canonical)</div><pre class="atpl-pv" id="atpl-canon"></pre></div>
      <div><div class="atpl-pv-title">A variation <button type="button" class="btn btn-ghost btn-sm" onclick="atplAnotherVary()"><i data-lucide="shuffle"></i> Another</button></div>
        <pre class="atpl-pv" id="atpl-vary"></pre></div>
    </div>

    <div class="atpl-actions">
      <button type="submit" class="btn btn-primary"><i data-lucide="save"></i> Save</button>
      ${atpl.id !== 'new' ? `<button type="button" class="btn btn-secondary" onclick="atplPractise()"><i data-lucide="play"></i> Practise</button>
      <button type="button" class="btn btn-ghost" onclick="atplDuplicate()"><i data-lucide="copy-plus"></i> Duplicate</button>` : ''}
      ${isBuiltin ? '<button type="button" class="btn btn-ghost" onclick="atplReset()" title="Put this template back as it was shipped"><i data-lucide="rotate-ccw"></i> Reset</button>' : ''}
      ${atpl.id !== 'new' ? '<button type="button" class="btn btn-ghost atpl-danger" onclick="atplDelete()"><i data-lucide="trash-2"></i> Delete</button>' : ''}
    </div>`;
  form.querySelectorAll('input, textarea').forEach(el => el.addEventListener('input', () => { _atplDirty(true); _atplPreview(); }));
  form.querySelectorAll('#atpl-concepts input').forEach(el => el.addEventListener('change', () => _atplDirty(true)));
  const body = document.getElementById('atpl-body');
  if (body) body.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.code === 'KeyM') { e.preventDefault(); atplMarkStart(); }
    else if (e.key === 'Tab' && !e.shiftKey) {   // indent, do not leave the field
      e.preventDefault();
      const s = body.selectionStart;
      body.setRangeText('    ', s, body.selectionEnd, 'end');
      body.dispatchEvent(new Event('input'));
    }
  });
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: form });
  _atplPreview();
}

/** The form's fields as a template (not saved). */
function _atplRead() {
  const v = (id) => ((document.getElementById(id) || {}).value || '');
  const d = Object.assign({}, atpl.draft);
  d.title = v('atpl-title').trim();
  d.label = v('atpl-label').trim();
  d.tags = v('atpl-tags').split(',').map(s => s.trim()).filter(Boolean);
  d.concepts = Array.from(document.querySelectorAll('#atpl-concepts input:checked')).map(x => x.value);
  d.body = v('atpl-body').replace(/\r\n/g, '\n');
  const code = v('atpl-hcode');
  d.harness = code.trim() ? { prelude: v('atpl-prelude'), code, stdin: v('atpl-stdin'), expect: v('atpl-expect') } : null;
  const pool = tplParsePool(v('atpl-pool'), d);
  d.pool = pool.sets;
  d._poolErrors = pool.errors;
  return d;
}

function _atplPreview() {
  if (!atpl.draft) return;
  const d = _atplRead();
  const parsed = tplParse(d.body);
  const slots = document.getElementById('atpl-slots');
  if (slots) {
    slots.innerHTML = (parsed.slots.length
      ? parsed.slots.map(s => `<span class="atpl-slot"><b>${escapeHTML(s.name)}</b> = ${escapeHTML(s.def || '—')}</span>`).join('')
      : '<span class="atpl-hint">No slots yet: select a name in the code and press Mark as slot.</span>')
      + parsed.errors.map(e => `<div class="atpl-err">${escapeHTML(e)}</div>`).join('');
  }
  const pm = document.getElementById('atpl-pool-msg');
  if (pm) pm.innerHTML = (d._poolErrors || []).map(e => `<div class="atpl-err">${escapeHTML(e)}</div>`).join('');
  const canon = document.getElementById('atpl-canon');
  if (canon) canon.textContent = tplCanonical(d) || ' ';
  const vary = document.getElementById('atpl-vary');
  if (vary) {
    const v = tplVariation(d, atpl.varySeed);
    vary.textContent = v ? tplFill(d.body, v.values) : 'Mark at least one name as a slot to get variations.';
  }
}

function atplAnotherVary() { atpl.varySeed++; _atplPreview(); }

/* ── Marking a slot ────────────────────────────────────────── */

function atplMarkStart() {
  const body = document.getElementById('atpl-body');
  const bar = document.getElementById('atpl-slotbar');
  if (!body || !bar) return;
  const sel = body.value.slice(body.selectionStart, body.selectionEnd);
  if (!sel || /\n/.test(sel)) { if (typeof toast === 'function') toast('Select a name in the code first.', { type: 'info', duration: 2000 }); return; }
  atpl.mark = { start: body.selectionStart, end: body.selectionEnd, sel };
  const name = document.getElementById('atpl-slot-name');
  const guess = /^[A-Z]/.test(sel) ? 'Type' : (tplIsIdent(sel) ? sel.replace(/_.*/, '').slice(0, 12) : 'slot');
  const count = (body.value.match(new RegExp('\\b' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g')) || []).length;
  const allLabel = document.getElementById('atpl-slot-all-label');
  if (allLabel) allLabel.textContent = tplIsIdent(sel) ? `everywhere it appears as code (${count} place${count === 1 ? '' : 's'})` : 'just here';
  const all = document.getElementById('atpl-slot-all');
  if (all) { all.disabled = !tplIsIdent(sel); all.checked = tplIsIdent(sel); }
  bar.classList.remove('hidden');
  if (name) { name.value = guess; name.focus(); name.select(); name.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); atplMarkApply(); } else if (e.key === 'Escape') { e.preventDefault(); atplMarkCancel(); } }; }
}

function atplMarkApply() {
  const body = document.getElementById('atpl-body');
  const name = (document.getElementById('atpl-slot-name') || {}).value || '';
  const all = !!(document.getElementById('atpl-slot-all') || {}).checked;
  if (!body || !atpl.mark) return;
  const r = tplMarkSlot(body.value, atpl.mark.start, atpl.mark.end, name.trim(), all);
  if (r.error) { if (typeof toast === 'function') toast(r.error, { type: 'warning', duration: 3200 }); return; }
  body.value = r.body;
  atplMarkCancel();
  _atplDirty(true);
  _atplPreview();
  body.focus();
}

function atplMarkCancel() {
  const bar = document.getElementById('atpl-slotbar');
  if (bar) bar.classList.add('hidden');
  atpl.mark = null;
}

/* ── Save, delete, run ─────────────────────────────────────── */

/** Save the form. Returns false (and says why) when it cannot be saved. */
function atplSave(opts) {
  if (!atpl.draft) return false;
  if (typeof trainStoreWritable === 'function' && !trainStoreWritable()) {
    if (typeof toast === 'function') toast('The app was just updated. Reload the page to save templates.', { type: 'warning' });
    return false;
  }
  const d = _atplRead();
  const parsed = tplParse(d.body);
  const why = !d.title ? 'Give it a title.' : !d.body.trim() ? 'Write the code.' : parsed.errors[0] || (d._poolErrors || [])[0] || '';
  if (why) { if (typeof toast === 'function') toast(why, { type: 'warning', duration: 3200 }); return false; }
  delete d._poolErrors;
  if (atpl.id === 'new') d.id = generateId();
  const saved = tplSave(d);
  atpl.id = saved.id;
  atpl.draft = JSON.parse(JSON.stringify(saved));
  _atplDirty(false);
  atplRenderList();
  if (!(opts && opts.silent)) {
    _atplRenderForm();
    if (typeof toast === 'function') toast('Template saved', { type: 'success', duration: 1500 });
  }
  return true;
}

function atplPractise() {
  if (window.adminIsDirty && !atplSave()) return;
  if (atpl.id && atpl.id !== 'new') tplStartDrill(atpl.id, { back: 'admin-templates' });
}

function atplDuplicate() {
  const d = _atplRead();
  delete d._poolErrors;
  atpl.id = null;
  atplOpen('new', Object.assign(d, { id: null, builtin: false, title: d.title + ' (copy)' }));
  _atplDirty(true);
}

function atplReset() {
  if (!atpl.id || !confirm('Put this template back as it was shipped? Your edits to it are lost.')) return;
  const t = tplResetBuiltin(atpl.id);
  if (t) { _atplDirty(false); atplOpen(t.id); }
}

function atplDelete() {
  const t = tplFind(atpl.id);
  if (!t) return;
  const go = () => { tplDelete(t.id); _atplDirty(false); atplClose(); };
  if (typeof showConfirm === 'function') showConfirm('Delete template', '"' + t.title + '" and its review schedule will be deleted. You can undo it right after.', go, { confirmLabel: 'Delete' });
  else if (confirm('Delete "' + t.title + '"?')) go();
}

/** Compile the canonical form inside the harness and say what it printed. */
async function atplRunHarness() {
  const out = document.getElementById('atpl-run-out');
  const d = _atplRead();
  if (!out) return;
  if (!d.harness) { out.innerHTML = '<div class="atpl-err">Write the harness main() first.</div>'; return; }
  out.innerHTML = '<span class="atpl-hint">Running…</span>';
  try {
    const src = tplHarnessSource(d, tplCanonical(d), {});
    const got = await _rtcRun(src, d.harness.stdin || '', { offline: !navigator.onLine });
    const r = got && got.res;
    if (!r) { out.innerHTML = `<div class="atpl-err">${escapeHTML((got && got.error) || 'No compiler could be reached.')}</div>`; return; }
    const printed = String(r.stdout || '').replace(/\r\n/g, '\n');
    const ok = tplSameOutput(printed, d.harness.expect);
    out.innerHTML = `<div class="${ok ? 'atpl-ok' : 'atpl-err'}">${ok ? 'Prints exactly the expected output.' : 'Does not match the expected output.'}</div>
      ${r.buildStderr ? `<pre class="atpl-pv">${escapeHTML(String(r.buildStderr).slice(0, 800))}</pre>` : ''}
      <pre class="atpl-pv">${escapeHTML(printed) || '(printed nothing)'}</pre>`;
  } catch (e) {
    out.innerHTML = `<div class="atpl-err">${escapeHTML((e && e.message) || String(e))}</div>`;
  }
}

/* ── Import, export ────────────────────────────────────────── */

function atplExport() {
  const text = tplExportText(tplStore());
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  a.download = 'templates.txt';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
}

function atplCopyFormat() {
  const done = () => { if (typeof toast === 'function') toast('Copied. Paste it into an AI chat, then import its answer here.', { type: 'success', duration: 3000 }); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(TPL_AI_FORMAT).then(done).catch(() => {});
}

function atplImportClose() {
  const el = document.getElementById('atpl-import');
  if (el) el.remove();
  atpl.importItems = null;
}

function atplImportOpen() {
  atplImportClose();
  const ov = document.createElement('div');
  ov.id = 'atpl-import';
  ov.className = 'modal-overlay';
  ov.innerHTML = `
    <div class="modal-content atpl-import-box" role="dialog" aria-modal="true" aria-labelledby="atpl-import-title">
      <h3 id="atpl-import-title"><i data-lucide="upload"></i> Import templates</h3>
      <p class="atpl-hint">Paste templates in the text format (Export writes it; "Format for an AI" explains it), or choose a file.</p>
      <textarea class="form-textarea atpl-code" id="atpl-import-text" rows="10" spellcheck="false" placeholder="=== template&#10;title: …"></textarea>
      <input type="file" id="atpl-import-file" accept=".txt,text/plain">
      <div class="atpl-msg" id="atpl-import-msg"></div>
      <div class="atpl-import-actions">
        <label class="atpl-chip"><input type="radio" name="atpl-dup" value="replace" checked> Replace templates with the same title</label>
        <label class="atpl-chip"><input type="radio" name="atpl-dup" value="keep"> Keep both</label>
        <label class="atpl-chip"><input type="radio" name="atpl-dup" value="skip"> Skip those</label>
      </div>
      <div class="atpl-actions">
        <button class="btn btn-primary" id="atpl-import-go" disabled onclick="atplImportApply()">Import</button>
        <button class="btn btn-ghost" onclick="atplImportClose()">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  const ta = ov.querySelector('#atpl-import-text');
  ta.addEventListener('input', () => _atplImportRead(ta.value));
  ov.querySelector('#atpl-import-file').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    f.text().then(t => { ta.value = t; _atplImportRead(t); });
  });
  ov.addEventListener('mousedown', (e) => { if (e.target === ov) atplImportClose(); });
  ov.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); atplImportClose(); } });
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: ov });
  ta.focus();
}

function _atplImportRead(text) {
  const r = tplParseImport(text);
  atpl.importItems = r.items;
  const msg = document.getElementById('atpl-import-msg');
  const go = document.getElementById('atpl-import-go');
  const titles = new Set(tplStore().map(t => t.title.toLowerCase()));
  if (msg) {
    msg.innerHTML = (r.items.length ? `<div class="atpl-ok">Found ${countNoun(r.items.length, 'template')}: ${r.items.map(t =>
      escapeHTML(t.title) + (titles.has(t.title.toLowerCase()) ? ' <em>(same title as one you have)</em>' : '')).join(', ')}</div>` : '')
      + r.errors.map(e => `<div class="atpl-err">${escapeHTML(e)}</div>`).join('');
  }
  if (go) { go.disabled = !r.items.length; go.textContent = r.items.length ? 'Import ' + countNoun(r.items.length, 'template') : 'Import'; }
}

function atplImportApply() {
  const items = atpl.importItems || [];
  const mode = (document.querySelector('input[name="atpl-dup"]:checked') || {}).value || 'replace';
  let added = 0, replaced = 0, skipped = 0;
  items.forEach(t => {
    const same = tplStore().find(x => x.title.toLowerCase() === t.title.toLowerCase());
    if (same && mode === 'skip') { skipped++; return; }
    if (same && mode === 'replace') { tplSave(Object.assign({}, t, { id: same.id, builtin: same.builtin, parentId: same.parentId })); replaced++; return; }
    tplSave(Object.assign({}, t, { id: generateId(), builtin: false })); added++;
  });
  atplImportClose();
  atplRenderList();
  if (typeof toast === 'function') toast(`Imported: ${added} new, ${replaced} replaced${skipped ? ', ' + skipped + ' skipped' : ''}.`, { type: 'success', duration: 3000 });
}
