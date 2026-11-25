/* ============================================================
   FG-DOS.JS — the DOS screen an Assembly freeground runs on
   ------------------------------------------------------------
   Run on an Assembly tab assembles the file (js/asm86.js) and opens this
   window: an 80x25 text screen drawn from the machine's video memory at
   B800:0000, the way DOSBox shows it. Characters a program pokes into
   b[es:di] and what INT 21h prints land in the same memory, so both show.
   Mode 13h (320x200, 256 colours at A000:0000) draws on a canvas instead.

   The machine runs a slice of instructions per animation frame (Speed:
   8086, DOSBox, Max), so a program that loops forever keeps running until
   Stop, and one that waits for a key (INT 21h 01h/0Ah, INT 16h) waits:
   click the screen and type. Esc goes to the program while it runs (many
   programs quit on Esc); once it has ended, Esc closes the window.

   Assembly errors are listed under the screen; each one's line takes the
   editor there. The registers strip shows AX..DI, IP and the flags, live.
   ============================================================ */

const FG_DOS_SPEED_KEY = 'ssp.fg.dosSpeed';
const FG_DOS_REGS_KEY = 'ssp.fg.dosRegs';
/* Instructions per frame. DOSBox's default is about 3 million a second. */
const FG_DOS_SPEEDS = { '8086': { label: '8086', per: 5000 }, dosbox: { label: 'DOSBox', per: 50000 }, max: { label: 'Max', per: 0 } };
const FG_DOS_COLORS = ['#000000', '#0000AA', '#00AA00', '#00AAAA', '#AA0000', '#AA00AA', '#AA5500', '#AAAAAA',
  '#555555', '#5555FF', '#55FF55', '#55FFFF', '#FF5555', '#FF55FF', '#FFFF55', '#FFFFFF'];
/* Scan codes by KeyboardEvent.code, for programs that read AH after INT 16h. */
const FG_DOS_SCANS = (() => {
  const m = { Escape: 0x01, Backspace: 0x0E, Tab: 0x0F, Enter: 0x1C, NumpadEnter: 0x1C, Space: 0x39,
    Minus: 0x0C, Equal: 0x0D, BracketLeft: 0x1A, BracketRight: 0x1B, Semicolon: 0x27, Quote: 0x28,
    Backquote: 0x29, Backslash: 0x2B, Comma: 0x33, Period: 0x34, Slash: 0x35 };
  'QWERTYUIOP'.split('').forEach((c, i) => { m['Key' + c] = 0x10 + i; });
  'ASDFGHJKL'.split('').forEach((c, i) => { m['Key' + c] = 0x1E + i; });
  'ZXCVBNM'.split('').forEach((c, i) => { m['Key' + c] = 0x2C + i; });
  '1234567890'.split('').forEach((c, i) => { m['Digit' + c] = 0x02 + i; });
  return m;
})();
const FG_DOS_EXT = { ArrowUp: 0x48, ArrowDown: 0x50, ArrowLeft: 0x4B, ArrowRight: 0x4D, Home: 0x47, End: 0x4F,
  PageUp: 0x49, PageDown: 0x51, Insert: 0x52, Delete: 0x53, F1: 0x3B, F2: 0x3C, F3: 0x3D, F4: 0x3E, F5: 0x3F,
  F6: 0x40, F7: 0x41, F8: 0x42, F9: 0x43, F10: 0x44 };

let _fgDos = null;

function _fgDosSpeed() {
  try { const v = localStorage.getItem(FG_DOS_SPEED_KEY); return FG_DOS_SPEEDS[v] ? v : 'dosbox'; } catch (e) { return 'dosbox'; }
}

/**
 * Assemble `source` and run it on a fresh DOS screen.
 * @param {string} source
 * @param {string} fileName e.g. "main.asm"
 */
function fgDosRun(source, fileName) {
  if (typeof Asm86 === 'undefined') return;
  const name = String(fileName || 'main.asm').replace(/\.[^.]*$/, '');
  const res = Asm86.assemble(source, { fileName: fileName || 'main.asm' });
  _fgDosOpen(name);
  const d = _fgDos;
  d.fileName = fileName || 'main.asm';
  d.warnings = res.warnings || [];
  if (!res.ok) {
    d.machine = null;
    _fgDosStatus('error', 'Assembly error' + (res.errors.length > 1 ? 's' : '') + ' · ' + res.errors.length);
    _fgDosMessages(res.errors.map(e => ({ type: 'error', line: e.line, text: e.msg })).concat(d.warnings.map(w => ({ type: 'warning', line: w.line, text: w.msg }))));
    _fgDosPaintScreen(true);
    return;
  }
  d.machine = Asm86.createMachine(res.program, { name });
  d.startedAt = performance.now();
  d.steps = 0;
  _fgDosMessages(d.warnings.map(w => ({ type: 'warning', line: w.line, text: w.msg })));
  _fgDosStatus('run', 'Running');
  _fgDosPaintScreen(true);
  const scr = document.getElementById('fg-dos-screen');
  if (scr) scr.focus({ preventScroll: true });
  _fgDosLoop();
}

function _fgDosOpen(name) {
  let el = document.getElementById('fg-dos');
  if (!_fgDos || !el) {
    if (el) el.remove();
    el = document.createElement('section');
    el.id = 'fg-dos';
    el.className = 'fg-dos';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'DOS screen');
    el.innerHTML = `
      <header class="fg-dos-head" id="fg-dos-head">
        <i data-lucide="monitor" aria-hidden="true"></i>
        <span class="fg-dos-title" id="fg-dos-title"></span>
        <span class="fg-dos-status" id="fg-dos-status" role="status"></span>
        <span class="fg-dos-spacer"></span>
        <button type="button" class="fg-dos-btn" id="fg-dos-speed" title="How fast the CPU runs: 8086 (4.77 MHz), DOSBox (its default), or as fast as this computer can"></button>
        <button type="button" class="fg-dos-btn" id="fg-dos-regs-btn" title="Show the registers and flags" aria-pressed="false"><i data-lucide="cpu"></i></button>
        <button type="button" class="fg-dos-btn" id="fg-dos-copy" title="Copy the screen as text"><i data-lucide="copy"></i></button>
        <button type="button" class="fg-dos-btn fg-dos-stop" id="fg-dos-stop" title="Stop the program"><i data-lucide="square"></i></button>
        <button type="button" class="fg-dos-btn" id="fg-dos-rerun" title="Assemble and run again (Ctrl+Enter)"><i data-lucide="rotate-ccw"></i></button>
        <button type="button" class="fg-dos-btn" id="fg-dos-close" title="Close (Esc once the program has ended)" aria-label="Close"><i data-lucide="x"></i></button>
      </header>
      <div class="fg-dos-body" id="fg-dos-body">
        <div class="fg-dos-screen" id="fg-dos-screen" tabindex="0" aria-label="DOS screen. Click here and type to give the program keys.">
          <div class="fg-dos-text" id="fg-dos-text" aria-hidden="true"></div>
          <div class="fg-dos-cursor" id="fg-dos-cursor" aria-hidden="true"></div>
          <canvas class="fg-dos-canvas" id="fg-dos-canvas" width="320" height="200" hidden></canvas>
          <div class="fg-dos-sr" id="fg-dos-sr" aria-live="polite"></div>
        </div>
      </div>
      <div class="fg-dos-regs" id="fg-dos-regs" hidden></div>
      <div class="fg-dos-msgs" id="fg-dos-msgs"></div>`;
    document.body.appendChild(el);
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: el });
    _fgDos = { raf: 0, timer: 0, machine: null, ro: null, keyHandler: null, cell: 0 };
    const on = (id, fn) => { const b = document.getElementById(id); if (b) b.onclick = fn; };
    on('fg-dos-close', () => fgDosClose());
    on('fg-dos-stop', () => _fgDosStop());
    on('fg-dos-rerun', () => { if (typeof fgRun === 'function') fgRun(); });
    on('fg-dos-copy', () => _fgDosCopy());
    on('fg-dos-speed', () => _fgDosCycleSpeed());
    on('fg-dos-regs-btn', () => _fgDosToggleRegs());
    const scr = document.getElementById('fg-dos-screen');
    scr.addEventListener('keydown', _fgDosKeydown);
    scr.addEventListener('mousedown', () => scr.focus({ preventScroll: true }));
    const msgs = document.getElementById('fg-dos-msgs');
    msgs.addEventListener('click', _fgDosMsgClick);
    msgs.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') _fgDosMsgClick(e); });
    _fgDosWireDrag(el);
    if (typeof ResizeObserver === 'function') {
      _fgDos.ro = new ResizeObserver(() => _fgDosFit());
      _fgDos.ro.observe(document.getElementById('fg-dos-body'));
    }
    _fgDos.keyHandler = (e) => {
      if (e.key !== 'Escape' || !document.getElementById('fg-dos')) return;
      const m = _fgDos && _fgDos.machine;
      const running = m && ['run', 'key', 'sleep'].indexOf(m.status().state) !== -1;
      if (running && document.activeElement === document.getElementById('fg-dos-screen')) return;   // the program's Esc
      e.preventDefault();
      e.stopPropagation();
      fgDosClose();
    };
    document.addEventListener('keydown', _fgDos.keyHandler, true);
    let showRegs = false;
    try { showRegs = localStorage.getItem(FG_DOS_REGS_KEY) === '1'; } catch (e) { /* none */ }
    _fgDosShowRegs(showRegs);
  } else {
    _fgDosHalt();
  }
  const title = document.getElementById('fg-dos-title');
  if (title) title.textContent = String(name || 'main').toUpperCase() + '.COM';
  _fgDosPaintSpeed();
  _fgDosFit();
}

/** Close the window and end the program. */
function fgDosClose() {
  _fgDosHalt();
  if (_fgDos) {
    if (_fgDos.ro) _fgDos.ro.disconnect();
    if (_fgDos.keyHandler) document.removeEventListener('keydown', _fgDos.keyHandler, true);
  }
  _fgDos = null;
  const el = document.getElementById('fg-dos');
  if (el) el.remove();
  const ta = document.getElementById('editor-textarea');
  if (ta) ta.focus();
}

function _fgDosHalt() {
  if (!_fgDos) return;
  cancelAnimationFrame(_fgDos.raf);
  clearTimeout(_fgDos.timer);
  _fgDos.raf = 0;
  _fgDos.timer = 0;
  if (_fgDos.machine) _fgDos.machine.stop();
}

function _fgDosStop() {
  if (!_fgDos || !_fgDos.machine) return;
  const st = _fgDos.machine.status().state;
  if (st === 'exit' || st === 'error') return;
  _fgDosHalt();
  _fgDosStatus('stopped', 'Stopped');
  _fgDosPaintScreen(true);
}

/* ── The run loop ──────────────────────────────────────────── */

function _fgDosLoop() {
  if (!_fgDos || !_fgDos.machine) return;
  cancelAnimationFrame(_fgDos.raf);
  clearTimeout(_fgDos.timer);
  _fgDos.raf = requestAnimationFrame(_fgDosFrame);
}

function _fgDosFrame() {
  const d = _fgDos;
  if (!d || !d.machine) return;
  d.raf = 0;
  const m = d.machine;
  const speed = FG_DOS_SPEEDS[_fgDosSpeed()];
  let st;
  if (speed.per) st = m.run(speed.per);
  else {
    const until = performance.now() + 12;
    do { st = m.run(40000); } while (st.state === 'run' && performance.now() < until);
  }
  if (m.dirty) _fgDosPaintScreen();
  _fgDosPaintRegs();
  if (st.state === 'run') {
    if (d.lastShown !== 'run') _fgDosStatus('run', 'Running');
    d.raf = requestAnimationFrame(_fgDosFrame);
  } else if (st.state === 'key') {
    _fgDosStatus('key', 'Waiting for a key — click the screen and type');
  } else if (st.state === 'sleep') {
    if (d.lastShown !== 'run') _fgDosStatus('run', 'Running');
    d.timer = setTimeout(() => { if (_fgDos === d) _fgDosLoop(); }, Math.max(0, Math.min(1000, st.wakeAt - Date.now())));
  } else {
    _fgDosEnded(st);
  }
}

function _fgDosEnded(st) {
  const d = _fgDos;
  _fgDosPaintScreen(true);
  _fgDosPaintRegs(true);
  const secs = ((performance.now() - d.startedAt) / 1000).toFixed(2);
  const notes = d.machine.notes().map(t => ({ type: 'info', text: t }));
  if (st.state === 'error') {
    _fgDosStatus('error', 'Stopped by an error');
    _fgDosMessages([{ type: 'error', line: st.line, text: st.message }].concat(notes, d.warnings.map(w => ({ type: 'warning', line: w.line, text: w.msg }))));
    return;
  }
  const msg = st.message ? st.message + ' ' : '';
  _fgDosStatus('done', msg ? msg.trim() : 'Program ended · exit code ' + st.exitCode + ' · ' + st.steps.toLocaleString() + ' instructions · ' + secs + ' s');
  _fgDosMessages(notes.concat(d.warnings.map(w => ({ type: 'warning', line: w.line, text: w.msg }))));
}

/* ── Drawing ───────────────────────────────────────────────── */

function _fgDosPaintScreen(force) {
  const d = _fgDos;
  if (!d) return;
  const textEl = document.getElementById('fg-dos-text');
  const canvas = document.getElementById('fg-dos-canvas');
  const cur = document.getElementById('fg-dos-cursor');
  if (!textEl || !canvas || !cur) return;
  const m = d.machine;
  if (!m) { textEl.innerHTML = ''; cur.hidden = true; canvas.hidden = true; return; }
  if (!m.dirty && !force) return;
  m.clean();
  const s = m.screen();
  if (s.mode === 0x13) {
    canvas.hidden = false;
    textEl.hidden = true;
    cur.hidden = true;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(320, 200);
    const px = img.data, pal = s.palette, g = s.gfx;
    for (let i = 0; i < 64000; i++) {
      const c = g[i] * 3;
      px[i * 4] = (pal[c] * 255 / 63) | 0;
      px[i * 4 + 1] = (pal[c + 1] * 255 / 63) | 0;
      px[i * 4 + 2] = (pal[c + 2] * 255 / 63) | 0;
      px[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return;
  }
  canvas.hidden = true;
  textEl.hidden = false;
  const cp = Asm86.CP437;
  const t = s.text;
  let html = '';
  for (let r = 0; r < 25; r++) {
    let row = '', run = '', attr = -1;
    for (let c = 0; c < 80; c++) {
      const i = (r * 80 + c) * 2;
      const a = t[i + 1];
      if (a !== attr) {
        if (run) row += _fgDosSpan(attr, run, s.blink);
        run = '';
        attr = a;
      }
      const ch = cp[t[i]];
      run += ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '&' ? '&amp;' : ch;
    }
    if (run) row += _fgDosSpan(attr, run, s.blink);
    html += '<div class="fg-dos-row">' + row + '</div>';
  }
  textEl.innerHTML = html;
  const st = m.status().state;
  cur.hidden = !s.cursor || st === 'exit' || st === 'error';
  cur.style.transform = 'translate(' + s.col + 'ch, calc(' + s.row + ' * var(--dos-line)))';
  const sr = document.getElementById('fg-dos-sr');
  if (sr && (st === 'exit' || st === 'error' || st === 'key')) sr.textContent = m.screenText().slice(-400);
}

function _fgDosSpan(attr, text, blink) {
  const fg = attr & 0x0F;
  const bg = blink ? (attr >> 4) & 0x07 : (attr >> 4) & 0x0F;
  const bl = blink && (attr & 0x80) ? ' fg-dos-blink' : '';
  if (fg === 7 && bg === 0 && !bl) return text;
  return '<span class="dc' + fg + ' db' + bg + bl + '">' + text + '</span>';
}

/** Size the screen's font so 80x25 fills the body. */
function _fgDosFit() {
  const body = document.getElementById('fg-dos-body');
  const scr = document.getElementById('fg-dos-screen');
  if (!body || !scr) return;
  const w = body.clientWidth - 16, h = body.clientHeight - 16;
  if (w <= 0 || h <= 0) return;
  // A cell is about 0.6em wide and --dos-line (1.2em) tall in the monospace stack.
  const size = Math.max(7, Math.min(w / (80 * 0.602), h / (25 * 1.2), 22));
  scr.style.fontSize = size.toFixed(2) + 'px';
}

function _fgDosStatus(kind, text) {
  const el = document.getElementById('fg-dos-status');
  if (_fgDos) _fgDos.lastShown = kind;
  if (el) { el.textContent = text; el.dataset.kind = kind; }
  const stop = document.getElementById('fg-dos-stop');
  if (stop) stop.disabled = !(kind === 'run' || kind === 'key');
}

function _fgDosMessages(list) {
  const el = document.getElementById('fg-dos-msgs');
  if (!el) return;
  const file = (_fgDos && _fgDos.fileName) || 'main.asm';
  el.innerHTML = (list || []).map(m => {
    const where = m.line ? `<span class="fg-dos-loc" role="link" tabindex="0" data-line="${m.line}" title="Show line ${m.line} in the editor">${escapeHTML(file)}:${m.line}</span> ` : '';
    return `<div class="fg-dos-msg is-${m.type}">${where}${escapeHTML(m.text)}</div>`;
  }).join('');
  el.hidden = !list || !list.length;
}

function _fgDosMsgClick(e) {
  const loc = e.target.closest && e.target.closest('.fg-dos-loc');
  if (!loc) return;
  e.preventDefault();
  const line = parseInt(loc.dataset.line, 10);
  if (line > 0 && typeof practiceJumpToLine === 'function') practiceJumpToLine(state.activeFileIndex || 0, line);
}

function _fgDosPaintRegs(force) {
  const el = document.getElementById('fg-dos-regs');
  if (!el || el.hidden || !_fgDos || !_fgDos.machine) return;
  const now = performance.now();
  if (!force && _fgDos.regsAt && now - _fgDos.regsAt < 100) return;
  _fgDos.regsAt = now;
  const r = _fgDos.machine.registers();
  const h = (v) => ('000' + v.toString(16).toUpperCase()).slice(-4);
  const reg = (n) => `<span class="fg-dos-reg"><b>${n}</b>${h(r[n])}</span>`;
  const f = r.flags;
  const flag = (n, k) => `<span class="fg-dos-flag${f[k] ? ' is-on' : ''}" title="${n}">${k.slice(0, 1)}</span>`;
  el.innerHTML = ['AX', 'BX', 'CX', 'DX', 'SI', 'DI', 'BP', 'SP', 'IP', 'DS', 'ES'].map(reg).join('')
    + '<span class="fg-dos-flags">' + [['Overflow', 'OF'], ['Direction', 'DF'], ['Interrupt', 'IF'], ['Sign', 'SF'], ['Zero', 'ZF'], ['Auxiliary carry', 'AF'], ['Parity', 'PF'], ['Carry', 'CF']].map(([n, k]) => flag(n, k)).join('') + '</span>';
}

function _fgDosShowRegs(on) {
  const el = document.getElementById('fg-dos-regs');
  const b = document.getElementById('fg-dos-regs-btn');
  if (el) el.hidden = !on;
  if (b) { b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); }
  if (on) _fgDosPaintRegs(true);
}

function _fgDosToggleRegs() {
  const el = document.getElementById('fg-dos-regs');
  const on = !!(el && el.hidden);
  try { localStorage.setItem(FG_DOS_REGS_KEY, on ? '1' : '0'); } catch (e) { /* none */ }
  _fgDosShowRegs(on);
}

function _fgDosPaintSpeed() {
  const b = document.getElementById('fg-dos-speed');
  if (b) b.textContent = FG_DOS_SPEEDS[_fgDosSpeed()].label;
}

function _fgDosCycleSpeed() {
  const order = ['8086', 'dosbox', 'max'];
  const next = order[(order.indexOf(_fgDosSpeed()) + 1) % order.length];
  try { localStorage.setItem(FG_DOS_SPEED_KEY, next); } catch (e) { /* none */ }
  _fgDosPaintSpeed();
}

function _fgDosCopy() {
  if (!_fgDos || !_fgDos.machine || !navigator.clipboard) return;
  navigator.clipboard.writeText(_fgDos.machine.screenText()).then(() => {
    if (typeof toast === 'function') toast('Copied the screen', { type: 'success', duration: 1400 });
  }).catch(() => {});
}

/* ── Keys ──────────────────────────────────────────────────── */

function _fgDosKeydown(e) {
  const d = _fgDos;
  if (!d || !d.machine) return;
  const st = d.machine.status().state;
  if (st === 'exit' || st === 'error') return;
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') return;   // Run again
  const k = fgDosKeyFor(e);
  if (!k) return;
  e.preventDefault();
  e.stopPropagation();
  d.machine.pushKey(k.ascii, k.scan);
  if (st === 'key') { _fgDosStatus('run', 'Running'); _fgDosLoop(); }
}

/**
 * The DOS keystroke for a browser key: {ascii, scan}, or null for keys DOS has no use for.
 * @param {{key:string, code:string, ctrlKey?:boolean, altKey?:boolean, metaKey?:boolean}} e
 */
function fgDosKeyFor(e) {
  if (e.metaKey) return null;
  if (e.key in FG_DOS_EXT) return { ascii: 0, scan: FG_DOS_EXT[e.key] };
  const scan = FG_DOS_SCANS[e.code] || 0;
  if (e.key === 'Enter') return { ascii: 13, scan: 0x1C };
  if (e.key === 'Backspace') return { ascii: 8, scan: 0x0E };
  if (e.key === 'Tab') return { ascii: 9, scan: 0x0F };
  if (e.key === 'Escape') return { ascii: 27, scan: 0x01 };
  if (e.altKey && !e.ctrlKey) return scan ? { ascii: 0, scan } : null;
  if (e.ctrlKey && /^[a-z]$/i.test(e.key)) return { ascii: e.key.toUpperCase().charCodeAt(0) & 0x1F, scan };
  if (e.ctrlKey) return null;
  if (e.key.length !== 1) return null;
  const c = e.key.charCodeAt(0);
  let ascii = c < 128 ? c : Asm86.CP437.indexOf(e.key);
  if (ascii < 32 && c >= 128) ascii = 0x3F;
  return { ascii, scan };
}

/* ── Dragging the window by its header ─────────────────────── */

function _fgDosWireDrag(el) {
  const head = el.querySelector('#fg-dos-head');
  if (!head) return;
  head.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('button')) return;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - r.left, dy = e.clientY - r.top;
    head.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const x = Math.max(0, Math.min(window.innerWidth - 80, ev.clientX - dx));
      const y = Math.max(0, Math.min(window.innerHeight - 40, ev.clientY - dy));
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.right = 'auto';
      el.style.bottom = 'auto';
      el.style.transform = 'none';
    };
    const up = () => { head.removeEventListener('pointermove', move); head.removeEventListener('pointerup', up); };
    head.addEventListener('pointermove', move);
    head.addEventListener('pointerup', up);
  });
}
