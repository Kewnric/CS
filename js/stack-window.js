/* ============================================================
   STACK-WINDOW.JS — the execution stack, drawn as you type
   ------------------------------------------------------------
   The layers button in the editor toolbar opens a window that shows memory as
   it stands when the program reaches the line the cursor is on: one box per
   stack frame (the function you are in on top, main at the bottom), the
   globals, and the heap. Variables are boxes; arrays are rows of cells (or a
   column, inside a struct, like the course's "LIST L" diagrams); pointers are
   arrows. Whatever the cursor's line just wrote glows.

   It follows typing, not a run: a moment after you stop, the program is run
   quietly in the page (js/cvm-*.js -- nothing is sent anywhere) up to the
   cursor. If that line runs many times, the last pass is shown and the arrows
   in the footer step back through earlier ones. scanf reads from the window's
   Input box, which starts as Sample 1's input.

   Docked, it sits beside the code with a divider to drag; floating, it is a
   window you move by its header and size from its corner, and the page behind
   it keeps working. Which one, and where, is remembered per device in
   localStorage `ssp.stackWindow`.
   ============================================================ */

const SK_PREF_KEY = 'ssp.stackWindow';
const SK_DEFAULTS = { open: false, mode: 'dock', dockW: 420, x: null, y: null, w: 520, h: 600, arrays: 'auto', inputOpen: false };

let _skEl = null;
let _skTimer = null;
let _skPollId = null;
let _skLastSig = '';
let _skLastCodeKey = '';
let _skParsed = null;       // { key, prog, error }
let _skResult = null;       // the last run, with its snapshots
let _skPassIdx = -1;        // which kept snapshot is shown; -1 = the last
let _skInput = null;        // the Input box's text (null = Sample 1's)
let _skInputFor = null;     // the variant that input belongs to
let _skRO = null;
let _skTaHandlers = null;
let _skView = null;
let _skStatus = null;

function _skPrefs() {
  let p = {};
  try { p = JSON.parse(localStorage.getItem(SK_PREF_KEY) || '{}') || {}; } catch (e) { p = {}; }
  return Object.assign({}, SK_DEFAULTS, p);
}
function _skSave(patch) {
  const p = Object.assign(_skPrefs(), patch);
  try { localStorage.setItem(SK_PREF_KEY, JSON.stringify(p)); } catch (e) { /* private mode */ }
  return p;
}
function _skEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ── Opening and closing ───────────────────────────────────── */

function skToggle() {
  if (_skEl) skClose(); else skOpen();
}
function skOpen() {
  if (!document.getElementById('editor-textarea') || typeof CVM === 'undefined' || !CVM.runProgram) return;
  _skSave({ open: true });
  _skMount();
  _skUpdate(true);
}
function skClose() {
  _skSave({ open: false });
  _skUnmount();
}
/* The attempt screens call these: reopen it if it was left open, and tidy up
   (timers, listeners) when the screen goes, without forgetting it was open. */
function skRestore() {
  if (_skPrefs().open) skOpen();
  else _skPaintButton(false);
}
function skDestroy() { _skUnmount(); _skResult = null; _skParsed = null; _skView = null; _skLastSig = ''; _skLastCodeKey = ''; }

function _skPaintButton(on) {
  const b = document.getElementById('ed-stack-btn');
  if (!b) return;
  b.classList.toggle('active', !!on);
  b.setAttribute('aria-pressed', on ? 'true' : 'false');
}

function _skMode() {
  // Too narrow to sit beside the code: float, without changing the setting.
  if (window.innerWidth < 900) return 'float';
  return _skPrefs().mode === 'float' ? 'float' : 'dock';
}

function _skMount() {
  _skUnmount();
  const prefs = _skPrefs();
  const mode = _skMode();
  const el = document.createElement('section');
  el.id = 'sk-win';
  el.className = 'sk-win ' + (mode === 'dock' ? 'is-docked' : 'is-floating');
  el.setAttribute('aria-label', 'Execution stack');
  el.innerHTML = `
    ${mode === 'dock' ? '<div class="sk-grip" title="Drag to resize" aria-hidden="true"></div>' : ''}
    <header class="sk-head">
      <i data-lucide="layers" class="sk-head-ico" aria-hidden="true"></i>
      <span class="sk-head-title">Execution stack</span>
      <span class="sk-head-sp"></span>
      <button class="sk-hbtn${prefs.inputOpen ? ' is-on' : ''}" id="sk-input-btn" title="Input for scanf" aria-label="Input for scanf" aria-pressed="${prefs.inputOpen}"><i data-lucide="keyboard"></i></button>
      <button class="sk-hbtn" id="sk-dir-btn" title="" aria-label="Array direction"><i data-lucide="${prefs.arrays === 'down' ? 'arrow-down-to-line' : prefs.arrays === 'across' ? 'arrow-right-to-line' : 'wand-2'}"></i></button>
      <button class="sk-hbtn" id="sk-mode-btn" title="${mode === 'dock' ? 'Float: a window you can move' : 'Dock beside the code'}" aria-label="${mode === 'dock' ? 'Float the window' : 'Dock beside the code'}"><i data-lucide="${mode === 'dock' ? 'picture-in-picture-2' : 'panel-right'}"></i></button>
      <button class="sk-hbtn sk-close" id="sk-close-btn" title="Close" aria-label="Close the execution stack"><i data-lucide="x"></i></button>
    </header>
    <div class="sk-input${prefs.inputOpen ? '' : ' hidden'}" id="sk-input">
      <label for="sk-input-text">Input for <code>scanf</code>, one value per line</label>
      <textarea id="sk-input-text" spellcheck="false" rows="3"></textarea>
      <button class="sk-link" id="sk-input-reset" type="button">Use Sample 1's input</button>
    </div>
    <div class="sk-canvas" id="sk-canvas"><div class="sk-inner" id="sk-inner"></div></div>
    <footer class="sk-foot" id="sk-foot"></footer>`;
  if (mode === 'dock') {
    const area = document.querySelector('.practice-body > .practice-editor-area');
    if (!area) return;
    el.style.setProperty('--sk-dock-w', Math.max(260, Math.min(prefs.dockW, Math.round(window.innerWidth * 0.6))) + 'px');
    area.after(el);
  } else {
    document.body.appendChild(el);
    const w = Math.min(prefs.w || 520, window.innerWidth - 16);
    const h = Math.min(prefs.h || 600, window.innerHeight - 16);
    let x = prefs.x == null ? window.innerWidth - w - 24 : prefs.x;
    let y = prefs.y == null ? 90 : prefs.y;
    x = Math.max(8, Math.min(x, window.innerWidth - Math.min(w, 160)));
    y = Math.max(8, Math.min(y, window.innerHeight - 48));
    Object.assign(el.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
  }
  _skEl = el;
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: el });
  _skPaintDirBtn();
  _skPaintButton(true);
  _skWire(el, mode);
  const ta = document.getElementById('editor-textarea');
  if (ta) {
    const quick = () => _skPoll(true);
    _skTaHandlers = { ta: ta, quick: quick };
    ta.addEventListener('keyup', quick);
    ta.addEventListener('click', quick);
    ta.addEventListener('input', quick);
  }
  _skPollId = setInterval(() => _skPoll(false), 450);
  const canvas = el.querySelector('#sk-canvas');
  if (typeof ResizeObserver !== 'undefined') {
    let t = null;
    _skRO = new ResizeObserver(() => {
      _skDrawArrows();
      if (mode === 'float') {
        clearTimeout(t);
        t = setTimeout(() => { if (_skEl) _skSave({ w: _skEl.offsetWidth, h: _skEl.offsetHeight }); }, 300);
      }
    });
    _skRO.observe(mode === 'float' ? el : canvas);
  }
  if (_skView) _skRender();
}

function _skUnmount() {
  if (_skPollId) { clearInterval(_skPollId); _skPollId = null; }
  clearTimeout(_skTimer); _skTimer = null;
  if (_skRO) { _skRO.disconnect(); _skRO = null; }
  if (_skTaHandlers) {
    const { ta, quick } = _skTaHandlers;
    ta.removeEventListener('keyup', quick);
    ta.removeEventListener('click', quick);
    ta.removeEventListener('input', quick);
    _skTaHandlers = null;
  }
  if (_skEl) { _skEl.remove(); _skEl = null; }
  _skPaintButton(false);
}

function _skWire(el, mode) {
  el.querySelector('#sk-close-btn').onclick = () => skClose();
  el.querySelector('#sk-mode-btn').onclick = () => {
    _skSave({ mode: mode === 'dock' ? 'float' : 'dock' });
    _skMount();
  };
  el.querySelector('#sk-dir-btn').onclick = () => {
    const order = ['auto', 'across', 'down'];
    const cur = _skPrefs().arrays;
    _skSave({ arrays: order[(order.indexOf(cur) + 1) % order.length] });
    _skPaintDirBtn();
    _skRedescribe();
  };
  el.querySelector('#sk-input-btn').onclick = () => {
    const open = !_skPrefs().inputOpen;
    _skSave({ inputOpen: open });
    el.querySelector('#sk-input').classList.toggle('hidden', !open);
    const b = el.querySelector('#sk-input-btn');
    b.classList.toggle('is-on', open);
    b.setAttribute('aria-pressed', open ? 'true' : 'false');
    if (open) el.querySelector('#sk-input-text').focus();
  };
  const inp = el.querySelector('#sk-input-text');
  inp.value = _skStdin();
  inp.addEventListener('input', () => { _skInput = inp.value; _skSchedule(400); });
  el.querySelector('#sk-input-reset').onclick = () => { _skInput = null; inp.value = _skStdin(); _skSchedule(0); };
  // Hovering a pointer lights its arrow and dims the rest.
  const inner = el.querySelector('#sk-inner');
  inner.addEventListener('mouseover', (e) => {
    const src = e.target.closest('[data-sk-arrow]');
    const svg = inner.querySelector('#sk-arrows');
    if (!svg) return;
    svg.querySelectorAll('.is-focus').forEach(p => p.classList.remove('is-focus'));
    svg.classList.toggle('has-focus', !!src);
    if (src) { const p = svg.querySelector('[data-n="' + src.getAttribute('data-sk-arrow') + '"]'); if (p) p.classList.add('is-focus'); }
  });
  inner.addEventListener('mouseleave', () => {
    const svg = inner.querySelector('#sk-arrows');
    if (svg) svg.classList.remove('has-focus');
  });
  el.querySelector('#sk-foot').addEventListener('click', (e) => {
    const b = e.target.closest('[data-sk-pass]');
    if (b) skPass(Number(b.getAttribute('data-sk-pass')));
  });

  if (mode === 'dock') {
    const grip = el.querySelector('.sk-grip');
    let drag = null;
    grip.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      drag = { x: e.clientX, w: el.offsetWidth, id: e.pointerId };
      grip.setPointerCapture(e.pointerId);
      el.classList.add('is-resizing');
      e.preventDefault();
    });
    grip.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const w = Math.max(260, Math.min(drag.w + (drag.x - e.clientX), Math.round(window.innerWidth * 0.6)));
      el.style.setProperty('--sk-dock-w', w + 'px');
    });
    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      drag = null;
      el.classList.remove('is-resizing');
      _skSave({ dockW: el.offsetWidth });
      _skDrawArrows();
    };
    grip.addEventListener('pointerup', end);
    grip.addEventListener('pointercancel', end);
  } else {
    const head = el.querySelector('.sk-head');
    let drag = null;
    head.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('button')) return;
      drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x: el.offsetLeft, y: el.offsetTop };
      head.setPointerCapture(e.pointerId);
      head.classList.add('is-dragging');
      e.preventDefault();
    });
    head.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      // Keep the header reachable, so the window can always be grabbed back.
      const x = Math.max(80 - el.offsetWidth, Math.min(window.innerWidth - 80, drag.x + e.clientX - drag.sx));
      const y = Math.max(0, Math.min(window.innerHeight - 40, drag.y + e.clientY - drag.sy));
      el.style.left = x + 'px';
      el.style.top = y + 'px';
    });
    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      drag = null;
      head.classList.remove('is-dragging');
      _skSave({ x: el.offsetLeft, y: el.offsetTop });
    };
    head.addEventListener('pointerup', end);
    head.addEventListener('pointercancel', end);
  }
}

function _skPaintDirBtn() {
  const b = _skEl && _skEl.querySelector('#sk-dir-btn');
  if (!b) return;
  const a = _skPrefs().arrays;
  const text = a === 'down' ? 'Arrays: drawn down (click for automatic)'
    : a === 'across' ? 'Arrays: drawn across (click to draw them down)'
    : 'Arrays: automatic -- down inside a struct, across elsewhere (click to draw them all across)';
  b.title = text;
  b.setAttribute('aria-label', text);
  b.innerHTML = '<i data-lucide="' + (a === 'down' ? 'arrow-down-to-line' : a === 'across' ? 'arrow-right-to-line' : 'wand-2') + '"></i>';
  if (typeof lucide !== 'undefined') lucide.createIcons({ root: b });
}

/* ── Following the editor ──────────────────────────────────── */

function _skStdin() {
  const v = (typeof state !== 'undefined' && state.activeVariant) || null;
  const id = v ? (v.id || v.title || 'v') : null;
  if (_skInputFor !== id) { _skInputFor = id; _skInput = null; }
  if (_skInput != null) return _skInput;
  const s = v && (v.samples || [])[0];
  if (s && typeof _sampleStdin === 'function') return _sampleStdin(s);
  return '';
}

function _skFiles(ta) {
  const full = (typeof edFullSource === 'function') ? edFullSource(ta) : ta.value;
  if (typeof state !== 'undefined' && Array.isArray(state.userFiles) && state.userFiles.length) {
    return state.userFiles.map((f, i) => ({
      name: (f.name || 'main') + (f.ext || '.c'),
      code: i === state.activeFileIndex ? full : (f.userCode || '')
    }));
  }
  return [{ name: 'main.c', code: full }];
}
function _skActiveFile() {
  return (typeof state !== 'undefined' && Array.isArray(state.userFiles) && state.userFiles.length) ? (state.activeFileIndex || 0) : 0;
}
function _skCaret(ta) {
  const off = ta.selectionStart || 0;
  return (typeof edViewOffsetToFull === 'function') ? edViewOffsetToFull(ta, off) : off;
}

/* Checked on every keystroke and every 450 ms: a file switch, a Retry or an
   expanded fold change the code without an input event. */
function _skPoll(quick) {
  const ta = document.getElementById('editor-textarea');
  if (!ta || !_skEl) return;
  const files = _skFiles(ta);
  const codeKey = files.map(f => f.name + '\u0000' + f.code).join('\u0001') + '\u0002' + _skStdin();
  const sig = codeKey + '\u0003' + _skActiveFile() + ':' + _skCaret(ta);
  if (sig === _skLastSig) return;
  const codeChanged = codeKey !== _skLastCodeKey;
  _skLastSig = sig;
  _skSchedule(codeChanged ? 450 : (quick ? 90 : 0));
}
function _skSchedule(ms) {
  clearTimeout(_skTimer);
  _skTimer = setTimeout(() => _skUpdate(false), ms);
}

function _skUpdate(first) {
  const ta = document.getElementById('editor-textarea');
  if (!ta || !_skEl) return;
  const files = _skFiles(ta);
  const fi = _skActiveFile();
  const stdin = _skStdin();
  const codeKey = files.map(f => f.name + '\u0000' + f.code).join('\u0001') + '\u0002' + stdin;
  const codeChanged = codeKey !== _skLastCodeKey;
  _skLastCodeKey = codeKey;
  if (first) _skLastSig = codeKey + '\u0003' + fi + ':' + _skCaret(ta);

  const active = files[fi] || files[0];
  if (!/\.(c|h)$/i.test(active.name)) {
    _skStatus = { kind: 'note', text: 'The execution stack follows C programs (.c and .h files).' };
    _skView = null;
    _skRender();
    return;
  }
  if (!files.some(f => /\S/.test(f.code))) {
    _skStatus = { kind: 'note', text: 'Write some C and the boxes appear here as you type.' };
    _skView = null; _skResult = null;
    _skRender();
    return;
  }

  if (!_skParsed || _skParsed.key !== codeKey) {
    try { _skParsed = { key: codeKey, prog: CVM.parseProgram(files), error: null }; }
    catch (e) {
      if (!(e instanceof CVM.CError)) { console.error('[stack]', e); }
      _skParsed = { key: codeKey, prog: null, error: e };
    }
  }
  if (_skParsed.error) {
    // Half-typed code: the last picture stays, dimmed, and the footer says where.
    const e = _skParsed.error;
    _skStatus = { kind: 'error', stale: true, text: _skWhere(e.loc, files) + (e.message || String(e)) };
    _skRender(true);
    return;
  }
  const prog = _skParsed.prog;
  const caret = _skCaret(ta);
  const tgt = CVM.targetAt(prog, fi, caret);
  let r;
  try {
    r = CVM.runProgram(prog, { stdin: stdin, target: tgt ? tgt.target : null, maxSteps: 1000000, timeMs: 350 });
  } catch (e) {
    console.error('[stack] run failed', e);
    _skStatus = { kind: 'error', stale: true, text: 'The stack window could not follow this program.' };
    _skRender(true);
    return;
  }
  if (codeChanged || !_skResult || !_skResult.tgt || !tgt || JSON.stringify(_skResult.tgt.target) !== JSON.stringify(tgt.target)) _skPassIdx = -1;
  r.tgt = tgt;
  r.files = files;
  _skResult = r;
  _skRedescribe();
}

function _skWhere(loc, files) {
  if (!loc || loc.l == null) return '';
  const multi = files && files.length > 1;
  const fname = multi && files[loc.f] ? files[loc.f].name + ' ' : '';
  return (multi ? fname : '') + 'Line ' + loc.l + ': ';
}

/* Which snapshot to draw, and what the footer says about it. */
function _skRedescribe() {
  const r = _skResult;
  if (!r || !_skParsed || !_skParsed.prog) { _skRender(); return; }
  const tgt = r.tgt;
  let snap = null;
  const notes = [];
  if (tgt && r.snaps.length) {
    const idx = _skPassIdx < 0 ? r.snaps.length - 1 : Math.min(_skPassIdx, r.snaps.length - 1);
    snap = r.snaps[idx];
  }
  let where;
  if (snap) {
    where = tgt.entering
      ? (tgt.stmt === tgt.fn.body ? 'Start of ' + tgt.fn.name + '()' : 'Start of the block, line ' + tgt.line)
      : 'After line ' + tgt.line;
  } else if (r.error && r.errorSnap) {
    snap = r.errorSnap;
    where = 'Where it stopped';
  } else {
    snap = r.end;
    where = 'End of the program';
    if (tgt) notes.push('Line ' + tgt.line + ' never runs' + (tgt.fn && tgt.fn.name !== 'main' && !r.snaps.length ? ' (is ' + tgt.fn.name + '() ever called?)' : '') + ', so this is the end of the program.');
    else notes.push('The cursor is outside every function, so this is the end of the program.');
  }
  if (r.inputShort) notes.push('scanf on line ' + r.inputShort.l + ' had no input left' + (_skPrefs().inputOpen ? '.' : ': add some with the keyboard button.'));
  let view = null;
  try { view = CVM.describe(snap, _skParsed.prog, { arrays: _skPrefs().arrays }); }
  catch (e) { console.error('[stack] describe failed', e); }
  _skView = view;
  _skStatus = {
    kind: r.error ? 'error' : 'ok',
    where: where,
    text: r.error ? _skWhere(r.error.loc, r.files) + r.error.message : '',
    notes: notes,
    passes: snap && snap.pass && r.passes > 1 ? { at: snap.pass, total: r.passes, idx: r.snaps.indexOf(snap), kept: r.snaps.length } : null
  };
  _skRender();
}

function skPass(delta) {
  const r = _skResult;
  if (!r || !r.snaps.length) return;
  const cur = _skPassIdx < 0 ? r.snaps.length - 1 : _skPassIdx;
  _skPassIdx = Math.max(0, Math.min(r.snaps.length - 1, cur + delta));
  _skRedescribe();
}

/* ── Drawing ───────────────────────────────────────────────── */

function _skRender(stale) {
  if (!_skEl) return;
  const inner = _skEl.querySelector('#sk-inner');
  const foot = _skEl.querySelector('#sk-foot');
  _skEl.classList.toggle('is-stale', !!stale);
  if (!stale) {
    inner.innerHTML = _skView ? _skViewHtml(_skView) : '<div class="sk-blank">' + _skEsc((_skStatus && _skStatus.text) || 'Nothing to draw yet.') + '</div>';
  }
  foot.innerHTML = _skFootHtml();
  _skDrawArrows();
  const glow = inner.querySelector('.is-changed');
  if (glow && !stale) {
    const c = _skEl.querySelector('#sk-canvas');
    const gr = glow.getBoundingClientRect(), cr = c.getBoundingClientRect();
    if (gr.top < cr.top || gr.bottom > cr.bottom) c.scrollTop += gr.top - cr.top - cr.height / 3;
  }
}

function _skFootHtml() {
  const s = _skStatus;
  if (!s) return '';
  let h = '';
  if (s.where) h += '<span class="sk-where">' + _skEsc(s.where) + '</span>';
  if (s.passes) {
    const p = s.passes;
    h += '<span class="sk-pass">'
      + '<button type="button" class="sk-pbtn" data-sk-pass="-1" ' + (p.idx <= 0 ? 'disabled' : '') + ' aria-label="Earlier pass">&#9664;</button>'
      + '<span>pass ' + p.at.toLocaleString('en-US') + ' of ' + p.total.toLocaleString('en-US') + '</span>'
      + '<button type="button" class="sk-pbtn" data-sk-pass="1" ' + (p.idx >= p.kept - 1 ? 'disabled' : '') + ' aria-label="Later pass">&#9654;</button>'
      + '</span>';
  }
  if (s.kind === 'error' && s.text) h += '<span class="sk-msg is-error">' + _skEsc(s.text) + (s.stale ? ' <em>(showing the last version that worked)</em>' : '') + '</span>';
  else if (s.kind === 'note' && s.text) h += '<span class="sk-msg">' + _skEsc(s.text) + '</span>';
  (s.notes || []).forEach(n => { h += '<span class="sk-msg is-note">' + _skEsc(n) + '</span>'; });
  return h;
}

function _skViewHtml(v) {
  let h = '';
  v.frames.forEach((f) => {
    h += '<div class="sk-frame' + (f.top ? ' is-top' : '') + '">'
      + '<div class="sk-frame-head"><span class="sk-frame-title">' + _skEsc(f.title) + '</span>'
      + (f.callLine ? '<span class="sk-frame-sub">called from line ' + f.callLine + '</span>' : (f.fn === 'main' ? '<span class="sk-frame-sub">bottom of the stack</span>' : ''))
      + '</div>'
      + (f.vars.length ? '<div class="sk-vars">' + f.vars.map(x => _skVarHtml(x, 0)).join('') + '</div>' : '<div class="sk-empty">No variables yet.</div>')
      + '</div>';
  });
  if (v.globals.length) {
    h += '<div class="sk-frame sk-globals"><div class="sk-frame-head"><span class="sk-frame-title">Globals</span><span class="sk-frame-sub">outside every function</span></div>'
      + '<div class="sk-vars">' + v.globals.map(x => _skVarHtml(x, 0)).join('') + '</div></div>';
  }
  if (v.heap.length) {
    h += '<div class="sk-heap"><div class="sk-frame-head"><span class="sk-frame-title">Heap</span><span class="sk-frame-sub">from malloc</span></div><div class="sk-heap-blocks">'
      + v.heap.map(b => '<div class="sk-block' + (b.leaked ? ' is-leaked' : '') + '">'
        + '<div class="sk-block-tag">' + _skEsc('A' + b.addr) + ' &middot; ' + b.size + ' bytes' + (b.line ? ' &middot; line ' + b.line : '') + (b.leaked ? ' &middot; <b>nothing points here</b>' : '') + '</div>'
        + _skVarHtml(b.node, 0) + '</div>').join('')
      + '</div></div>';
  }
  return h + '<svg class="sk-arrows" id="sk-arrows" aria-hidden="true"></svg>';
}

function _skLab(n) {
  if (!n.name) return '';
  return '<div class="sk-lab"><b>' + _skEsc(n.name) + '</b><i>' + _skEsc(n.label) + '</i></div>';
}
function _skCls(n) { return (n.unset ? ' is-unset' : '') + (n.changed ? ' is-changed' : ''); }
function _skAttr(n) { return ' data-a="' + n.addr + '" data-s="' + Math.max(n.size, 1) + '"'; }

/* depth: 0 for a variable, 1 for its members, 2 and deeper for what is
   nested inside those -- which is drawn on one line ({ "John", 'R', "Doe" })
   so a struct of structs does not take a whole screen. */
function _skVarHtml(n, depth) {
  depth = depth || 0;
  if (depth >= 2 && (n.kind === 'struct' || n.kind === 'array')) {
    return '<div class="sk-var">' + _skLab(n) + '<div class="sk-compact' + _skCls(n) + '"' + _skAttr(n) + '>' + _skRecVal(n) + '</div></div>';
  }
  switch (n.kind) {
    case 'struct': return _skStructHtml(n, depth);
    case 'array': return _skArrayHtml(n);
    case 'ptr': case 'fnptr': case 'file': return _skPtrHtml(n);
    default:
      return '<div class="sk-var">' + _skLab(n) + '<div class="sk-box' + (n.kind === 'char' ? ' is-char' : '') + _skCls(n) + '"' + _skAttr(n) + '>' + _skEsc(n.value) + '</div></div>';
  }
}

function _skPtrHtml(n, bare) {
  const cls = 'sk-box sk-ptr' + (n.isNull ? ' is-null' : '') + (n.dangling ? ' is-dangling' : '') + _skCls(n);
  const ptr = n.target && !n.dangling ? ' data-ptr="' + n.target + '" data-ps="' + (n.toSize || 0) + '"' : '';
  const box = '<div class="' + cls + '"' + _skAttr(n) + ptr + '>' + _skEsc(n.value) + '</div>';
  const note = n.note ? '<div class="sk-note' + (n.literal ? ' is-lit' : '') + '">' + (n.literal ? '&rarr; ' : '') + _skEsc(n.note) + '</div>' : '';
  if (bare) return box + note;
  return '<div class="sk-var">' + _skLab(n) + box + note + '</div>';
}

function _skStructHtml(n, depth) {
  const title = n.name ? '<b>' + _skEsc(n.title) + '</b> ' + _skEsc(n.name) : '<b>' + _skEsc(n.title) + '</b>';
  return '<div class="sk-struct' + (n.changed ? ' has-change' : '') + '"' + _skAttr(n) + '>'
    + '<div class="sk-struct-title">' + title + '</div>'
    + '<div class="sk-members">' + n.children.map(ch => _skVarHtml(ch, (depth || 0) + 1)).join('') + '</div></div>';
}

function _skCellVal(c) {
  if (c.ptr) return _skPtrHtml(c.ptr, true);
  return _skEsc(c.value);
}
function _skIdx(n, c) { return c.index === n.n - 1 && n.lastLabel !== String(n.n - 1) ? n.lastLabel : String(c.index); }

function _skArrayHtml(n) {
  const head = n.name ? _skLab(n) : '';
  const strNote = n.isString && n.str != null ? '<div class="sk-note is-lit">"' + _skEsc(n.str.length > 40 ? n.str.slice(0, 40) + '…' : n.str) + '"</div>' : '';
  if (n.dir === 'grid') {
    const cols = n.cells[0] && n.cells[0].node ? n.cells[0].node.cells : [];
    let t = '<table class="sk-grid"' + _skAttr(n) + '><tr><th></th>' + cols.map(cc => '<th>' + _skEsc(String(cc.index)) + '</th>').join('') + '</tr>';
    n.cells.forEach((row, ri) => {
      t += '<tr><th>' + _skEsc(_skIdx(n, row)) + '</th>' + (row.node ? row.node.cells.map(cc => '<td class="sk-cell' + _skCls(cc) + '" data-a="' + cc.addr + '" data-s="' + cc.size + '">' + _skCellVal(cc) + '</td>').join('') : '') + '</tr>';
      if (n.gapAfter === row.index && ri < n.cells.length - 1) t += '<tr class="sk-gap-row"><th>&hellip;</th><td colspan="' + cols.length + '">&hellip;</td></tr>';
    });
    return '<div class="sk-var">' + head + t + '</table></div>';
  }
  if (n.dir === 'down') {
    let rows = '';
    n.cells.forEach((c, i) => {
      rows += '<div class="sk-row"><span class="sk-ridx">' + _skEsc(_skIdx(n, c)) + '</span>'
        + (c.node ? '<div class="sk-rec' + _skCls(c) + '" data-a="' + c.addr + '" data-s="' + c.size + '">' + _skRecHtml(c.node) + '</div>'
          : '<div class="sk-cell' + _skCls(c) + '" data-a="' + c.addr + '" data-s="' + c.size + '">' + _skCellVal(c) + '</div>')
        + '</div>';
      if (n.gapAfter === c.index && i < n.cells.length - 1) rows += '<div class="sk-row sk-gap-row"><span class="sk-ridx"></span><div class="sk-cell sk-gap">&middot; &middot; &middot;</div></div>';
    });
    return '<div class="sk-var sk-down">' + (n.name ? '<div class="sk-col-title">' + _skEsc(n.name) + ' <i>' + _skEsc(n.label) + '</i></div>' : '')
      + '<div class="sk-col"' + _skAttr(n) + '>' + rows + '</div>' + strNote + '</div>';
  }
  // across: the name holds the address of cell 0, with an arrow to the cells
  let cells = '';
  n.cells.forEach((c, i) => {
    cells += '<div class="sk-cellwrap"><span class="sk-cidx">' + _skEsc(_skIdx(n, c)) + '</span>'
      + (c.node ? '<div class="sk-rec sk-rec-box' + _skCls(c) + '" data-a="' + c.addr + '" data-s="' + c.size + '">' + _skRecHtml(c.node) + '</div>'
        : '<div class="sk-cell' + (n.isString ? ' is-char' : '') + _skCls(c) + '" data-a="' + c.addr + '" data-s="' + c.size + '">' + _skCellVal(c) + '</div>')
      + '</div>';
    if (n.gapAfter === c.index && i < n.cells.length - 1) cells += '<div class="sk-cellwrap"><span class="sk-cidx">&hellip;</span><div class="sk-cell sk-gap">&hellip;</div></div>';
  });
  const nameBox = n.name ? '<div class="sk-box sk-arrname" data-ptr="' + n.addr + '" title="' + _skEsc(n.name) + ' starts at A' + n.addr + '">A' + n.addr + '</div>' : '';
  return '<div class="sk-var">' + head + '<div class="sk-across">' + nameBox + '<div class="sk-cells"' + _skAttr(n) + '>' + cells + '</div></div>' + strNote + '</div>';
}

/* A struct as one row inside an array: its members side by side, strings as
   text, nested structs in braces. */
function _skRecHtml(n) {
  if (n.kind === 'struct') {
    return n.children.map(ch => '<span class="sk-fld"><i>' + _skEsc(ch.name) + '</i>' + _skRecVal(ch) + '</span>').join('');
  }
  if (n.kind === 'array') return _skRecVal(n);
  return _skRecVal(n);
}
function _skRecVal(n) {
  if (n.kind === 'struct') return '<span class="sk-fv sk-fv-rec' + _skCls(n) + '"' + _skAttr(n) + '>{ ' + n.children.map(ch => _skRecVal(ch)).join(', ') + ' }</span>';
  if (n.kind === 'array') {
    if (n.isString) return '<span class="sk-fv is-str' + _skCls(n) + '"' + _skAttr(n) + '>' + (n.str == null ? '?' : '"' + _skEsc(n.str) + '"') + '</span>';
    return '<span class="sk-fv' + _skCls(n) + '"' + _skAttr(n) + '>[' + n.cells.map(c => (c.node ? '…' : _skEsc(c.value))).join(', ') + (n.gapAfter >= 0 ? ', …' : '') + ']</span>';
  }
  if (n.kind === 'ptr' || n.kind === 'fnptr' || n.kind === 'file') {
    const ptr = n.target && !n.dangling ? ' data-ptr="' + n.target + '" data-ps="' + (n.toSize || 0) + '"' : '';
    return '<span class="sk-fv sk-fv-ptr' + (n.isNull ? ' is-null' : '') + _skCls(n) + '"' + _skAttr(n) + ptr + '>' + _skEsc(n.value) + '</span>';
  }
  return '<span class="sk-fv' + _skCls(n) + '"' + _skAttr(n) + '>' + _skEsc(n.value) + '</span>';
}

/* Arrows: each [data-ptr] to the smallest drawn thing whose bytes hold that
   address (a cell before its array, a member before its struct). */
function _skDrawArrows() {
  if (!_skEl) return;
  const inner = _skEl.querySelector('#sk-inner');
  const svg = inner && inner.querySelector('#sk-arrows');
  if (!svg) return;
  const ir = inner.getBoundingClientRect();
  svg.setAttribute('width', inner.scrollWidth);
  svg.setAttribute('height', inner.scrollHeight);
  const owners = Array.from(inner.querySelectorAll('[data-a]')).map(el => ({ el: el, a: Number(el.getAttribute('data-a')), s: Number(el.getAttribute('data-s')) || 1 }));
  let paths = '';
  let laneN = 0, pathN = 0;
  const rel = (r) => ({ l: r.left - ir.left, r: r.right - ir.left, t: r.top - ir.top, b: r.bottom - ir.top, cx: (r.left + r.right) / 2 - ir.left, cy: (r.top + r.bottom) / 2 - ir.top });
  inner.querySelectorAll('[data-ptr]').forEach(src => {
    const at = Number(src.getAttribute('data-ptr'));
    const ps = Number(src.getAttribute('data-ps')) || 0;
    let best = null, whole = null;
    for (const o of owners) {
      if (o.el === src || o.el.contains(src)) continue;
      if (at >= o.a && at < o.a + o.s && (!best || o.s < best.s || (o.s === best.s && best.el.contains(o.el)))) best = o;
      // A pointer to a whole struct lands on the struct, not its first member.
      if (ps && o.a === at && o.s === ps && (!whole || whole.el.contains(o.el))) whole = o;
    }
    if (whole) best = whole;
    if (!best) return;
    const a = rel(src.getBoundingClientRect());
    const b = rel(best.el.getBoundingClientRect());
    if (!b.r && !b.b) return;
    const hot = src.classList.contains('is-changed');
    const sx = a.r, sy = a.cy;
    let d;
    const overlapX = b.l < a.r - 6 && b.r > a.l + 6;
    if (b.t > a.b + 8 && overlapX && b.t - a.b < 220) {
      // Straight down onto the next thing, like one list node to the next.
      const x0 = a.cx, x1 = Math.max(b.l + 14, Math.min(b.r - 14, a.cx)), y0 = a.b, y1 = b.t - 2;
      const my = (y0 + y1) / 2;
      d = 'M' + x0 + ',' + y0 + ' C' + x0 + ',' + my + ' ' + x1 + ',' + my + ' ' + x1 + ',' + y1;
    } else if (Math.abs(b.cy - sy) > 140) {
      // A long way up or down: along a lane beside both boxes, on whichever
      // side is nearer, so it does not cut across everything in between.
      const off = (laneN++ % 4) * 4;
      const laneL = Math.max(3, Math.min(a.l, b.l) - 10 - off);
      const laneR = Math.min(inner.scrollWidth - 3, Math.max(a.r, b.r) + 10 + off);
      const useR = (laneR - a.r) + (laneR - b.r) < (a.l - laneL) + (b.l - laneL);
      const lane = useR ? laneR : laneL, k = useR ? -8 : 8;
      const x0 = useR ? a.r : a.l, ex = useR ? b.r + 2 : b.l - 2, ey = b.cy, dir = ey > sy ? 1 : -1;
      d = 'M' + x0 + ',' + sy + ' L' + (lane + k) + ',' + sy + ' Q' + lane + ',' + sy + ' ' + lane + ',' + (sy + dir * 8)
        + ' L' + lane + ',' + (ey - dir * 8) + ' Q' + lane + ',' + ey + ' ' + (lane + k) + ',' + ey + ' L' + ex + ',' + ey;
    } else if (b.l >= sx + 14) {
      const ex = b.l - 2, ey = b.cy;
      const mx = (sx + ex) / 2;
      d = 'M' + sx + ',' + sy + ' C' + mx + ',' + sy + ' ' + mx + ',' + ey + ' ' + ex + ',' + ey;
    } else {
      // Behind or below: out to the right, round, into the target's right side.
      const ex = b.r + 2, ey = b.cy;
      const bend = Math.max(sx, ex) + 34 + Math.min(60, Math.abs(ey - sy) / 6);
      d = 'M' + sx + ',' + sy + ' C' + bend + ',' + sy + ' ' + bend + ',' + ey + ' ' + ex + ',' + ey;
    }
    const arr = src.classList.contains('sk-arrname');
    src.setAttribute('data-sk-arrow', String(pathN));
    paths += '<path d="' + d + '" data-n="' + (pathN++) + '" class="sk-arrow' + (hot ? ' is-hot' : '') + (arr ? ' is-arr' : '') + '" marker-end="url(#sk-head' + (hot ? '-hot' : arr ? '-arr' : '') + ')"/>';
  });
  const mk = (id, cls) => '<marker id="' + id + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="sk-arrowhead' + cls + '"/></marker>';
  svg.innerHTML = '<defs>' + mk('sk-head', '') + mk('sk-head-hot', ' is-hot') + mk('sk-head-arr', ' is-arr') + '</defs>' + paths;
}
