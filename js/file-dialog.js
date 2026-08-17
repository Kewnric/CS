/* ============================================================
   FILE-DIALOG.JS — one Add / Rename File dialog for every editor
   ------------------------------------------------------------
   The practice page, the practice-set page and the admin variant form
   each grew their own copy of this dialog and then drifted apart: one
   stripped a typed extension and the others didn't, one closed on a
   backdrop click and the others didn't, one defaulted to .c and another
   to .h, and only one of the three could tell you WHY Create did nothing.
   This is the single implementation all three now call.

   C only. The compiler is invoked as C (-std=gnu17), so a .cpp file here
   was never going to build — offering it just produced broken attempts.
   ============================================================ */

/** The only extensions that mean anything to this app, and what each does. */
const FILE_EXTS = [
  { ext: '.h', hint: 'Header — inlined wherever your code says #include "…".' },
  { ext: '.c', hint: 'Source — compiled together with your main file.' },
  { ext: '.txt', hint: 'Notes only — never compiled, and the program cannot read it.' }
];

/* A name that isn't a valid C identifier can't be #included cleanly, and
   anything with a slash or a dot would break the include matcher outright. */
const FILE_NAME_RE = /^[A-Za-z_][A-Za-z0-9_-]*$/;

/* Shadowing one of these makes #include <stdio.h> resolve to the wrong file on
   some toolchains, which fails in a way that reads as nonsense. */
const C_SYSTEM_HEADERS = [
  'assert', 'ctype', 'errno', 'float', 'inttypes', 'limits', 'locale', 'math',
  'setjmp', 'signal', 'stdarg', 'stdbool', 'stddef', 'stdint', 'stdio', 'stdlib',
  'string', 'time', 'wchar', 'wctype'
];

let _fdState = null;

/** UTILS_H — the guard macro for a header called utils. */
function fdGuardMacro(name) {
  return String(name).replace(/[^A-Za-z0-9]/g, '_').toUpperCase() + '_H';
}

/** Starter body for a new header: the include guard students most often forget. */
function fdGuardText(name) {
  const g = fdGuardMacro(name);
  return `#ifndef ${g}\n#define ${g}\n\n/* Declarations go here. */\n\n#endif /* ${g} */\n`;
}

/** Starter body for the .c that pairs with a header. */
function fdPairText(name) {
  return `#include "${name}.h"\n\n/* Definitions go here. */\n`;
}

/**
 * Add `#include "header"` to a source file, after the last existing #include so
 * it lands where a C programmer would put it. Returns the code unchanged if the
 * include is already there.
 */
function fdInsertInclude(code, header) {
  const src = String(code == null ? '' : code);
  const line = `#include "${header}"`;
  if (src.indexOf(line) !== -1) return src;
  const lines = src.split('\n');
  let at = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*#\s*include\b/.test(lines[i])) at = i;
  }
  if (at === -1) return line + '\n' + src;
  lines.splice(at + 1, 0, line);
  return lines.join('\n');
}

/** Headers the code #includes that no file in this problem provides. */
function fdMissingIncludes(mainCode, files) {
  const have = new Set((files || []).map(f => f.name + f.ext));
  const out = [];
  const re = /#\s*include\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(String(mainCode || ''))) !== null) {
    const target = m[1].trim();
    if (!have.has(target) && out.indexOf(target) === -1) out.push(target);
  }
  return out;
}

function _fdKey(e) {
  if (!document.getElementById('file-dialog')) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeFileDialog(); }
  else if (e.key === 'Enter' && e.target && e.target.tagName !== 'BUTTON') {
    e.preventDefault(); _fdSubmit();
  }
}

function closeFileDialog() {
  const el = document.getElementById('file-dialog');
  if (el) el.remove();
  document.removeEventListener('keydown', _fdKey, true);
  // Hand focus back to the button that opened it, rather than dumping the
  // keyboard user at the top of the document.
  const anchor = _fdState && _fdState.anchor;
  _fdState = null;
  if (anchor && document.contains(anchor) && typeof anchor.focus === 'function') anchor.focus();
}

/**
 * @param {object} o
 *   mode      'add' | 'rename'
 *   files     [{name, ext}] — index 0 is the main file
 *   index     number, rename target
 *   mainCode  string, the main file's source (drives the suggestions)
 *   canPair   boolean, the host can create two files in one go
 *   onSubmit  ({name, ext, guard, include, pair}) => void
 *   anchor    Element focus returns to on close
 */
function openFileDialog(o) {
  closeFileDialog();
  const rename = o.mode === 'rename';
  const files = o.files || [];
  const cur = rename ? (files[o.index] || { name: '', ext: '.h' }) : null;
  _fdState = { opts: o, anchor: o.anchor || document.activeElement };

  const missing = rename ? [] : fdMissingIncludes(o.mainCode, files);

  const overlay = document.createElement('div');
  overlay.id = 'file-dialog';
  overlay.className = 'modal-overlay fd-overlay';
  overlay.innerHTML = `
    <div class="modal-content fd-box" role="dialog" aria-modal="true" aria-labelledby="fd-title">
      <h3 class="fd-title" id="fd-title">
        <i data-lucide="${rename ? 'pencil' : 'file-plus'}"></i> ${rename ? 'Rename File' : 'Add File'}
      </h3>

      ${missing.length ? `
        <div class="fd-suggest">
          <span class="fd-suggest-label">Your code includes ${missing.length === 1 ? 'a file' : 'files'} that ${missing.length === 1 ? "doesn't" : "don't"} exist yet:</span>
          <div class="fd-chips">
            ${missing.map(f => `<button type="button" class="fd-chip" data-file="${escapeHTML(f)}">${escapeHTML(f)}</button>`).join('')}
          </div>
        </div>` : ''}

      <div class="fd-row">
        <input id="fd-name" class="form-input" placeholder="Filename*" spellcheck="false"
               autocomplete="off" aria-label="Filename" value="${rename ? escapeHTML(cur.name) : ''}" />
        <select id="fd-ext" class="form-select" aria-label="File type">
          ${FILE_EXTS.map(e => `<option value="${e.ext}"${(rename ? cur.ext : '.h') === e.ext ? ' selected' : ''}>${e.ext}</option>`).join('')}
        </select>
      </div>

      <div class="fd-preview" id="fd-preview" aria-live="polite"></div>
      <p class="fd-hint" id="fd-hint"></p>
      <p class="fd-warn" id="fd-warn"></p>
      <p class="fd-error" id="fd-error" role="alert"></p>

      ${rename ? '' : `
        <div class="fd-opts" id="fd-opts">
          <label class="fd-opt"><input type="checkbox" id="fd-guard" checked>
            <span><strong>Add an include guard</strong><em>#ifndef / #define / #endif, so including it twice is safe</em></span></label>
          <label class="fd-opt"><input type="checkbox" id="fd-include" checked>
            <span><strong>#include it in <span id="fd-main-name">main.c</span></strong><em>Otherwise the new file is never compiled in</em></span></label>
          ${o.canPair ? `<label class="fd-opt"><input type="checkbox" id="fd-pair">
            <span><strong>Also create the matching <span id="fd-pair-name">.c</span></strong><em>Pre-filled with the include, ready for the definitions</em></span></label>` : ''}
        </div>`}

      <div class="fd-files" id="fd-files"></div>

      <div class="fd-actions">
        <button type="button" class="btn btn-secondary btn-sm" id="fd-cancel">Cancel</button>
        <button type="button" class="btn btn-primary btn-sm" id="fd-ok">${rename ? 'Rename' : 'Create'}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: overlay });

  const nameEl = overlay.querySelector('#fd-name');
  const extEl = overlay.querySelector('#fd-ext');

  // Typing "utils.h" means the name is "utils" and the type is .h — it does not
  // mean a file called "utils.h.c". Only OUR extensions are consumed this way.
  const absorbExt = () => {
    const m = nameEl.value.match(/^(.*)(\.[A-Za-z]+)$/);
    if (!m) return;
    const hit = FILE_EXTS.find(e => e.ext.toLowerCase() === m[2].toLowerCase());
    if (!hit) return;
    nameEl.value = m[1];
    extEl.value = hit.ext;
  };

  nameEl.addEventListener('input', () => { _fdPaint(); });
  nameEl.addEventListener('blur', () => { absorbExt(); _fdPaint(); });
  extEl.addEventListener('change', _fdPaint);
  overlay.querySelectorAll('.fd-chip').forEach(chip => {
    chip.onclick = () => {
      const full = chip.dataset.file;
      const m = full.match(/^(.*?)(\.[A-Za-z]+)?$/);
      nameEl.value = (m && m[1]) || full;
      const hit = FILE_EXTS.find(e => e.ext.toLowerCase() === ((m && m[2]) || '').toLowerCase());
      if (hit) extEl.value = hit.ext;
      _fdPaint();
      nameEl.focus();
    };
  });
  overlay.querySelector('#fd-cancel').onclick = closeFileDialog;
  overlay.querySelector('#fd-ok').onclick = () => { absorbExt(); _fdSubmit(); };
  overlay.addEventListener('click', e => { if (e.target === overlay) closeFileDialog(); });

  // Tab cycles inside the dialog instead of escaping to the page behind it.
  overlay.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const els = overlay.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled])');
    if (!els.length) return;
    const first = els[0], last = els[els.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  document.addEventListener('keydown', _fdKey, true);

  _fdPaint();
  // Focus now, not on a timer — the element is already in the document, and a
  // deferred focus meant the first keystroke after opening could go nowhere.
  nameEl.focus();
  if (rename) nameEl.select();
}

/** Refresh everything that depends on the current name + extension. */
function _fdPaint() {
  if (!_fdState) return;
  const o = _fdState.opts;
  const rename = o.mode === 'rename';
  const nameEl = document.getElementById('fd-name');
  const extEl = document.getElementById('fd-ext');
  if (!nameEl || !extEl) return;
  const raw = nameEl.value.trim();
  const ext = extEl.value;
  const files = o.files || [];
  const mainName = files[0] ? files[0].name + files[0].ext : 'the main file';

  // Live preview of the file that will actually be made
  const prev = document.getElementById('fd-preview');
  if (prev) {
    prev.textContent = raw ? raw + ext : '';
    prev.classList.toggle('empty', !raw);
  }

  // What this extension does — the old copy claimed the list depended on a
  // "currently selected language" that has never existed anywhere in this app.
  const hintEl = document.getElementById('fd-hint');
  const meta = FILE_EXTS.find(e => e.ext === ext);
  if (hintEl) hintEl.textContent = meta ? meta.hint : '';

  // A header option only makes sense for a header
  const opts = document.getElementById('fd-opts');
  if (opts) {
    opts.style.display = ext === '.h' ? '' : 'none';
    const mn = document.getElementById('fd-main-name');
    if (mn) mn.textContent = mainName;
    const pn = document.getElementById('fd-pair-name');
    if (pn) pn.textContent = (raw || 'file') + '.c';
  }

  // Non-blocking warning: shadowing a standard header
  const warnEl = document.getElementById('fd-warn');
  if (warnEl) {
    const clash = ext === '.h' && C_SYSTEM_HEADERS.indexOf(raw.toLowerCase()) !== -1;
    warnEl.textContent = clash
      ? `Careful: <${raw}.h> is a standard C header. Your file can shadow it and break #include <${raw}.h>.`
      : '';
    warnEl.style.display = clash ? '' : 'none';
  }

  // The files that already exist, so "that name is taken" is never a surprise
  const list = document.getElementById('fd-files');
  if (list) {
    list.innerHTML = files.length
      ? `<span class="fd-files-label">Already here:</span> ` + files.map((f, i) =>
        `<code class="fd-file${rename && i === o.index ? ' self' : ''}">${escapeHTML(f.name + f.ext)}</code>`).join('')
      : '';
  }

  _fdValidate(false);
}

/**
 * @param {boolean} loud show the message for an empty name too — silent while
 *   you're still typing, explicit the moment you press Create.
 * @returns {null|{name,ext}}
 */
function _fdValidate(loud) {
  const o = _fdState.opts;
  const rename = o.mode === 'rename';
  const nameEl = document.getElementById('fd-name');
  const extEl = document.getElementById('fd-ext');
  const errEl = document.getElementById('fd-error');
  const name = nameEl.value.trim();
  const ext = extEl.value;
  const files = o.files || [];

  const fail = (msg) => {
    if (errEl) errEl.textContent = msg;
    nameEl.classList.add('fd-invalid');
    return null;
  };
  const pass = () => {
    if (errEl) errEl.textContent = '';
    nameEl.classList.remove('fd-invalid');   // the old dialog never cleared this
    return { name: name, ext: ext };
  };

  if (!name) {
    // Quiet while the field is simply still empty; explicit once Create is hit.
    if (loud) return fail('Give the file a name first.');
    if (errEl) errEl.textContent = '';
    nameEl.classList.remove('fd-invalid');
    return null;
  }
  if (!FILE_NAME_RE.test(name)) {
    return fail('Letters, digits, _ and - only, starting with a letter or _ — anything else can\'t be #included.');
  }
  const dup = files.some((f, i) => (!rename || i !== o.index) && f.name === name && f.ext === ext);
  if (dup) return fail(`${name}${ext} already exists in this problem.`);
  return pass();
}

function _fdSubmit() {
  if (!_fdState) return;
  const o = _fdState.opts;
  const ok = _fdValidate(true);
  if (!ok) { document.getElementById('fd-name').focus(); return; }
  const checked = (id) => {
    const el = document.getElementById(id);
    return !!(el && el.checked && el.offsetParent !== null);
  };
  const payload = {
    name: ok.name,
    ext: ok.ext,
    guard: ok.ext === '.h' && checked('fd-guard'),
    include: ok.ext === '.h' && checked('fd-include'),
    pair: ok.ext === '.h' && checked('fd-pair')
  };
  const fn = o.onSubmit;
  closeFileDialog();
  if (fn) fn(payload);
}
