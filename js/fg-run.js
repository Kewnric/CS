/* ============================================================
   FG-RUN.JS — running Freeground's other languages
   ------------------------------------------------------------
   C runs as it always has (xcc / GCC through the terminal). This file is
   what Run does for the rest:

   JAVASCRIPT goes through the same terminal as C. fgTermLang() tells the
   terminal (practice.js _termInit) that the tab is JavaScript, and
   fgTermRun() stands in for the compiler: it answers in the compiler's
   result shape ({didExecute, exitCode, stdout, stderr, buildStderr}), so
   typing input, Stop, history and the strip under the editor all work.
   The program runs in a Web Worker made from a blob: URL (that works from
   file:// too), as a classic script, so it behaves like the browser
   console or Node: console.log prints (objects the way Node shows them),
   prompt() reads one line. Each read marks itself in stdout the way the C
   probe build does (terminal-io.js TERM_MARK): \x011\x01 for a line read,
   \x010\x01 where input ran out -- the terminal then waits for you to type
   and runs it again with that line, exactly as it does for scanf.
   The worker's own source is its prelude (fgJsWorkerMain, as text) and
   then your file, so a syntax error is reported with your line number.
   It ends when the code and every timer it started are done, or at the
   time limit (Compiler options), and a loop that never ends is ended there.

   HTML opens a preview beside the code (fgPreviewOpen): the page in a
   sandboxed iframe (scripts, no access to the app), rebuilt as you type.
   <link href="style.css"> and <script src="app.js"> are filled in from the
   tab's own files. console.log and errors from the page are listed under it.

   ASSEMBLY is js/fg-dos.js.
   ============================================================ */

/** The language the terminal should run, when it is not C: 'js', or null. */
function fgTermLang() {
  const c = typeof state === 'object' && state ? state.activeChallenge : null;
  return c && c.isFreeground && c.fgLang === 'js' ? 'js' : null;
}

/** What the terminal's engine badge says for a language. */
function fgTermEngineLabel(lang) { return lang === 'js' ? 'JS' : 'XCC'; }

/** The terminal's compiler, for a language that is not C. */
function fgTermRun(lang, source, stdin, aborter, onOut) {
  const f = (state.userFiles || [])[state.activeFileIndex || 0];
  const file = f ? f.name + f.ext : 'main.js';
  return fgJsRun(source, stdin, aborter, onOut, file);
}

/**
 * Run JavaScript in a worker.
 * @returns {Promise<{didExecute:boolean, exitCode:number, stdout:string, stderr:string, buildStderr:string, runMs:number, compileMs:number}>}
 */
function fgJsRun(source, stdin, aborter, onOut, fileName) {
  const file = fileName || 'main.js';
  const src = String(source == null ? '' : source);
  const prelude = '(' + fgJsWorkerMain.toString() + ')(' + JSON.stringify(String(stdin || '')) + ', ';
  const preLines = (prelude.match(/\n/g) || []).length;
  // The line count goes in the call itself, which ends the prelude's last line.
  const head = prelude + preLines + ', ' + JSON.stringify(file) + ');\n';
  const text = head + src + '\n;self.__ssp_main_done();\n';
  const limit = typeof _xccLimitMs === 'function' ? _xccLimitMs() : 10000;
  return new Promise((resolve, reject) => {
    const signal = aborter ? aborter.signal : null;
    if (signal && signal.aborted) { reject(new Error('STOPPED')); return; }
    let url = '', worker = null, out = '', done = false;
    const t0 = performance.now();
    const cleanup = () => {
      clearTimeout(timer);
      if (worker) { try { worker.terminate(); } catch (e) { /* gone */ } }
      if (url) URL.revokeObjectURL(url);
      if (signal) signal.removeEventListener('abort', onAbort);
    };
    const finish = (res) => {
      if (done) return;
      done = true;
      cleanup();
      resolve(Object.assign({ didExecute: true, exitCode: 0, stdout: out, stderr: '', buildStderr: '',
        runMs: Math.round(performance.now() - t0), compileMs: 0 }, res));
    };
    const onAbort = () => { if (done) return; done = true; cleanup(); reject(new Error('STOPPED')); };
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => finish({
      exitCode: 124,
      stderr: 'Stopped after ' + (limit / 1000) + ' s: the program was still running (a loop that never ends, or a timer that is never cleared). The limit is in Compiler options.'
    }), limit);
    try {
      url = URL.createObjectURL(new Blob([text], { type: 'text/javascript' }));
      worker = new Worker(url);
    } catch (e) {
      done = true;
      cleanup();
      reject(new Error('XCC_UNAVAILABLE: JavaScript could not start here (' + (e && e.message || e) + ')'));
      return;
    }
    worker.onmessage = (e) => {
      const m = e.data || {};
      if (m.t === 'out') { out += m.s; if (onOut) onOut(out); }
      else if (m.t === 'end') finish({ exitCode: m.code | 0, stderr: m.error ? fgJsErrorText(m.error, src, file) : '' });
    };
    // Only a syntax error gets here: the prelude catches everything that happens while it runs.
    worker.onerror = (e) => {
      if (e && e.preventDefault) e.preventDefault();
      const line = e && e.lineno ? e.lineno - preLines - 1 : 0;
      const msg = String((e && e.message) || 'SyntaxError').replace(/^Uncaught\s+/, '');
      const err = { name: '', message: msg, frames: line > 0 ? [{ fn: '', line, col: e.colno || 0 }] : [] };
      finish({ didExecute: false, exitCode: 1, buildStderr: fgJsErrorText(err, src, file) });
    };
  });
}

/**
 * An error as the terminal shows it: where, what, the line with a caret, then the calls.
 * @param {{name:string, message:string, frames:Array<{fn:string,line:number,col:number}>}} err
 */
function fgJsErrorText(err, source, file) {
  const lines = String(source || '').split('\n');
  const head = (err.name ? err.name + ': ' : '') + (err.message || '');
  const frames = (err.frames || []).filter(f => f.line > 0 && f.line <= lines.length);
  const at = frames[0];
  let text = at ? file + ':' + at.line + (at.col ? ':' + at.col : '') + ': ' + head : head;
  if (at) {
    const code = lines[at.line - 1];
    const num = String(at.line);
    text += '\n ' + num + ' | ' + code;
    if (at.col) text += '\n ' + ' '.repeat(num.length) + ' | ' + code.slice(0, at.col - 1).replace(/[^\t]/g, ' ') + '^';
  }
  frames.slice(1, 6).forEach(f => { text += '\n    at ' + (f.fn ? f.fn + ' (' : '') + file + ':' + f.line + ':' + f.col + (f.fn ? ')' : ''); });
  const m = /\b(document|window|require|module|exports|fetch|localStorage|alert)\b is not defined/.exec(err.message || '');
  if (m) {
    text += m[1] === 'require' || m[1] === 'module' || m[1] === 'exports'
      ? '\n\nThis runs JavaScript on its own, without Node\'s modules; there is nothing to require.'
      : '\n\nThis tab runs JavaScript without a page, like Node does. For document and window, make an HTML tab and put the script in it.';
  }
  return text;
}

/* The worker's prelude. It runs in the worker, so it must use nothing from
   outside itself: its source text is all that goes across. */
function fgJsWorkerMain(stdin, pre, file) {
  var MARK = String.fromCharCode(1);
  var STOP = { sspStop: true };
  var out = '', total = 0, lastFlush = 0, ended = false, mainDone = false, pos = 0, indent = '';
  var counts = {}, clocks = {};
  var active = new Set();
  var nativeSetTimeout = self.setTimeout.bind(self), nativeSetInterval = self.setInterval.bind(self);
  var nativeClearTimeout = self.clearTimeout.bind(self), nativeClearInterval = self.clearInterval.bind(self);

  function flush(force) {
    if (!out) return;
    var now = Date.now();
    if (force || now - lastFlush > 30) { postMessage({ t: 'out', s: out }); out = ''; lastFlush = now; }
  }
  function write(s) {
    if (ended) return;
    out += s;
    total += s.length;
    if (total > 1000000) { end(1, { name: '', message: 'Stopped: the program printed more than a million characters.', frames: [] }); throw STOP; }
    flush(false);
  }
  function end(code, error) {
    if (ended) return;
    flush(true);
    ended = true;
    postMessage({ t: 'end', code: code, error: error || null });
  }
  function frames(err) {
    var list = [];
    // Chrome: "    at name (blob:…:12:5)" or "    at blob:…:12:5"; Firefox: "name@blob:…:12:5".
    String((err && err.stack) || '').split('\n').forEach(function (l) {
      if (l.indexOf('blob:') === -1) return;
      var m = /:(\d+):(\d+)\)?\s*$/.exec(l);
      if (!m) return;
      var line = +m[1] - pre - 1;
      if (line < 1) return;
      var c = /^\s*at\s+(.*?)\s+\(/.exec(l) || /^\s*([^@\s]*)@/.exec(l);
      var fn = (c ? c[1] : '').replace(/^Object\.<anonymous>$/, '').replace(/^async\s+/, '').replace(/^self\./, '');
      list.push({ fn: fn, line: line, col: +m[2] });
    });
    return list;
  }
  function describe(err) {
    if (err && typeof err === 'object' && 'message' in err) return { name: err.name || 'Error', message: String(err.message), frames: frames(err) };
    return { name: 'Uncaught', message: inspect(err, 0, [], false), frames: [] };
  }
  function fail(err) {
    if (err === STOP || ended) return;
    end(1, describe(err));
  }

  function quote(s) { return "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'"; }
  function inspect(v, depth, seen, top) {
    var t = typeof v;
    if (v === null) return 'null';
    if (t === 'undefined') return 'undefined';
    if (t === 'string') return top ? v : quote(v);
    if (t === 'number') return Object.is(v, -0) ? '-0' : String(v);
    if (t === 'bigint') return String(v) + 'n';
    if (t === 'boolean') return String(v);
    if (t === 'symbol') return v.toString();
    if (t === 'function') {
      var src = Function.prototype.toString.call(v);
      if (/^class\b/.test(src)) return '[class ' + (v.name || '(anonymous)') + ']';
      return '[Function: ' + (v.name || '(anonymous)') + ']';
    }
    if (seen.indexOf(v) !== -1) return '[Circular *1]';
    if (v instanceof Error) {
      var st = frames(v);
      return v.name + ': ' + v.message + st.map(function (f) { return '\n    at ' + (f.fn ? f.fn + ' (' : '') + file + ':' + f.line + ':' + f.col + (f.fn ? ')' : ''); }).join('');
    }
    if (v instanceof Date) return isNaN(v) ? 'Invalid Date' : v.toISOString();
    if (v instanceof RegExp) return String(v);
    if (v instanceof Promise) return 'Promise { <pending> }';
    if (depth > 2) return Array.isArray(v) ? '[Array]' : '[Object]';
    seen.push(v);
    var parts = [], prefix = '', open = '{', close = '}';
    if (Array.isArray(v)) {
      open = '['; close = ']';
      for (var i = 0; i < v.length && i < 100; i++) parts.push(i in v ? inspect(v[i], depth + 1, seen, false) : '<1 empty item>');
      if (v.length > 100) parts.push('... ' + (v.length - 100) + ' more item' + (v.length - 100 > 1 ? 's' : ''));
    } else if (v instanceof Map) {
      prefix = 'Map(' + v.size + ') ';
      v.forEach(function (val, key) { parts.push(inspect(key, depth + 1, seen, false) + ' => ' + inspect(val, depth + 1, seen, false)); });
    } else if (v instanceof Set) {
      prefix = 'Set(' + v.size + ') ';
      v.forEach(function (val) { parts.push(inspect(val, depth + 1, seen, false)); });
    } else {
      var proto = Object.getPrototypeOf(v);
      var ctor = proto && proto.constructor && proto.constructor.name;
      if (proto === null) prefix = '[Object: null prototype] ';
      else if (ctor && ctor !== 'Object') prefix = ctor + ' ';
      Object.keys(v).forEach(function (k) {
        parts.push((/^[A-Za-z_$][\w$]*$/.test(k) ? k : quote(k)) + ': ' + inspect(v[k], depth + 1, seen, false));
      });
    }
    seen.pop();
    if (!parts.length) return prefix + open + close;
    var one = prefix + open + ' ' + parts.join(', ') + ' ' + close;
    if (one.length <= 72 && one.indexOf('\n') === -1) return one;
    return prefix + open + '\n' + parts.map(function (p) { return '  ' + p.replace(/\n/g, '\n  '); }).join(',\n') + '\n' + close;
  }
  function format(args) {
    var a = Array.prototype.slice.call(args);
    var first = '';
    if (typeof a[0] === 'string' && a[0].indexOf('%') !== -1) {
      var f = a.shift();
      first = f.replace(/%([sdifjoOc%])/g, function (m, k) {
        if (k === '%') return '%';
        if (!a.length) return m;
        var v = a.shift();
        if (k === 's') return typeof v === 'string' ? v : inspect(v, 1, [], false);
        if (k === 'd' || k === 'i') return typeof v === 'object' ? 'NaN' : String(k === 'i' ? parseInt(v, 10) : Number(v));
        if (k === 'f') return String(parseFloat(v));
        if (k === 'j') { try { return JSON.stringify(v); } catch (e) { return '[Circular]'; } }
        if (k === 'c') return '';
        return inspect(v, 0, [], false);
      });
    }
    var rest = a.map(function (v) { return inspect(v, 0, [], true); });
    var s = (first ? [first] : []).concat(rest).join(' ');
    return indent ? indent + s.replace(/\n/g, '\n' + indent) : s;
  }
  function line(args) { write(format(args) + '\n'); }
  function table(data) {
    if (!data || typeof data !== 'object') { line([data]); return; }
    var rows = Object.keys(data), cols = [], hasValues = false;
    rows.forEach(function (r) {
      var v = data[r];
      if (v && typeof v === 'object') Object.keys(v).forEach(function (k) { if (cols.indexOf(k) === -1) cols.push(k); });
      else hasValues = true;
    });
    var head = ['(index)'].concat(cols, hasValues ? ['Values'] : []);
    var body = rows.map(function (r) {
      var v = data[r];
      var cells = [r];
      cols.forEach(function (k) { cells.push(v && typeof v === 'object' && k in v ? inspect(v[k], 1, [], false) : ''); });
      if (hasValues) cells.push(v && typeof v === 'object' ? '' : inspect(v, 1, [], false));
      return cells;
    });
    var w = head.map(function (h, i) { return Math.max(h.length, Math.max.apply(null, body.map(function (b) { return b[i].length; }).concat([0]))) + 2; });
    var pad = function (s, n) { var l = Math.floor((n - s.length) / 2); return ' '.repeat(l) + s + ' '.repeat(n - s.length - l); };
    var bar = function (a, b, c) { return a + w.map(function (n) { return '─'.repeat(n); }).join(b) + c; };
    var row = function (cells) { return '│' + cells.map(function (c, i) { return pad(c, w[i]); }).join('│') + '│'; };
    write([bar('┌', '┬', '┐'), row(head), bar('├', '┼', '┤')].concat(body.map(row), [bar('└', '┴', '┘')]).join('\n') + '\n');
  }
  var con = self.console;
  con.log = con.info = con.debug = con.error = con.warn = con.dir = function () { line(arguments); };
  con.table = function (d) { table(d); };
  con.group = con.groupCollapsed = function () { if (arguments.length) line(arguments); indent += '  '; };
  con.groupEnd = function () { indent = indent.slice(2); };
  con.count = function (label) { label = label === undefined ? 'default' : String(label); counts[label] = (counts[label] || 0) + 1; line([label + ': ' + counts[label]]); };
  con.countReset = function (label) { counts[label === undefined ? 'default' : String(label)] = 0; };
  con.time = function (label) { clocks[label === undefined ? 'default' : String(label)] = performance.now(); };
  con.timeEnd = con.timeLog = function (label) {
    label = label === undefined ? 'default' : String(label);
    if (clocks[label] == null) return;
    line([label + ': ' + (performance.now() - clocks[label]).toFixed(3) + 'ms']);
  };
  con.assert = function (ok) { if (!ok) line(['Assertion failed' + (arguments.length > 1 ? ': ' + format(Array.prototype.slice.call(arguments, 1)) : '')]); };
  con.trace = function () { line(['Trace: ' + format(arguments)]); };
  con.clear = function () {};

  function readLine() {
    if (pos >= stdin.length) { write(MARK + '0' + MARK); end(0); throw STOP; }
    var nl = stdin.indexOf('\n', pos);
    var s = nl === -1 ? stdin.slice(pos) : stdin.slice(pos, nl);
    pos = nl === -1 ? stdin.length : nl + 1;
    write(MARK + '1' + MARK);
    return s;
  }
  self.prompt = function (msg) { if (msg !== undefined && msg !== null) write(String(msg)); return readLine(); };
  self.readline = function () { return readLine(); };
  self.alert = function (msg) { write((msg === undefined ? '' : String(msg)) + '\n'); };
  self.confirm = function (msg) { if (msg !== undefined) write(String(msg) + ' '); return /^\s*(y|yes|ok|true|1)\s*$/i.test(readLine()); };
  self.process = {
    argv: ['node', file], env: {}, platform: 'browser',
    stdout: { write: function (s) { write(String(s)); return true; } },
    stderr: { write: function (s) { write(String(s)); return true; } },
    exit: function (code) { end(code | 0); throw STOP; }
  };

  function check() {
    if (!mainDone || ended || active.size) return;
    nativeSetTimeout(function () { if (!active.size) end(0); }, 0);
  }
  function call(fn, args) {
    if (ended || typeof fn !== 'function') return;
    try { fn.apply(null, args); } catch (e) { fail(e); }
  }
  self.setTimeout = function (fn, ms) {
    var args = Array.prototype.slice.call(arguments, 2);
    var id = nativeSetTimeout(function () { active.delete(id); call(fn, args); check(); }, ms);
    active.add(id);
    return id;
  };
  self.setInterval = function (fn, ms) {
    var args = Array.prototype.slice.call(arguments, 2);
    var id = nativeSetInterval(function () { call(fn, args); }, ms);
    active.add(id);
    return id;
  };
  self.clearTimeout = self.clearInterval = function (id) { active.delete(id); nativeClearTimeout(id); nativeClearInterval(id); check(); };
  self.addEventListener('error', function (e) { e.preventDefault(); fail(e.error !== undefined ? e.error : e.message); });
  self.addEventListener('unhandledrejection', function (e) { e.preventDefault(); fail(e.reason); });
  self.__ssp_main_done = function () { mainDone = true; check(); };
}

/* ── HTML: the live preview ────────────────────────────────── */

let _fgPv = null;

/** Is the preview open? */
function fgPreviewIsOpen() { return !!document.getElementById('fg-preview'); }

/** Open (or refresh) the preview beside the editor. */
function fgPreviewOpen() {
  const body = document.querySelector('#fg-layout .practice-body');
  if (!body) return;
  if (!fgPreviewIsOpen()) {
    const el = document.createElement('aside');
    el.id = 'fg-preview';
    el.className = 'fg-preview';
    el.setAttribute('aria-label', 'Preview');
    el.innerHTML = `
      <div class="fg-pv-head">
        <i data-lucide="globe" aria-hidden="true"></i>
        <span class="fg-pv-title">Preview</span>
        <label class="fg-pv-live" title="Rebuild the page as you type"><input type="checkbox" id="fg-pv-live" checked> Live</label>
        <span class="fg-pv-gap"></span>
        <button type="button" class="fg-dos-btn" id="fg-pv-reload" title="Reload the page (Ctrl+Enter)"><i data-lucide="rotate-ccw"></i></button>
        <button type="button" class="fg-dos-btn" id="fg-pv-tab" title="Open in a new browser tab"><i data-lucide="external-link"></i></button>
        <button type="button" class="fg-dos-btn" id="fg-pv-close" title="Close the preview" aria-label="Close the preview"><i data-lucide="x"></i></button>
      </div>
      <div class="fg-pv-frame-wrap"><iframe id="fg-pv-frame" class="fg-pv-frame" title="Your page"
        sandbox="allow-scripts allow-modals allow-forms allow-popups"></iframe></div>
      <div class="fg-pv-console" id="fg-pv-console">
        <button type="button" class="fg-pv-console-head" id="fg-pv-console-head" aria-expanded="false">
          <i data-lucide="terminal" aria-hidden="true"></i> Console <span class="fg-pv-count" id="fg-pv-count"></span>
        </button>
        <div class="fg-pv-console-body" id="fg-pv-console-body" hidden></div>
      </div>`;
    body.appendChild(el);
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: el });
    _fgPv = { token: Math.random().toString(36).slice(2), timer: 0, lines: [] };
    _fgPv.onMsg = (e) => _fgPreviewMessage(e);
    window.addEventListener('message', _fgPv.onMsg);
    const on = (id, fn) => { const b = document.getElementById(id); if (b) b.onclick = fn; };
    on('fg-pv-close', () => fgPreviewClose());
    on('fg-pv-reload', () => fgPreviewRefresh());
    on('fg-pv-tab', () => _fgPreviewNewTab());
    on('fg-pv-console-head', () => {
      const b = document.getElementById('fg-pv-console-body');
      const h = document.getElementById('fg-pv-console-head');
      if (!b || !h) return;
      b.hidden = !b.hidden;
      h.setAttribute('aria-expanded', b.hidden ? 'false' : 'true');
    });
    const ta = document.getElementById('editor-textarea');
    if (ta) { _fgPv.onInput = () => _fgPreviewSoon(); ta.addEventListener('input', _fgPv.onInput); }
  }
  fgPreviewRefresh();
}

function fgPreviewClose() {
  if (_fgPv) {
    clearTimeout(_fgPv.timer);
    window.removeEventListener('message', _fgPv.onMsg);
    const ta = document.getElementById('editor-textarea');
    if (ta && _fgPv.onInput) ta.removeEventListener('input', _fgPv.onInput);
  }
  _fgPv = null;
  const el = document.getElementById('fg-preview');
  if (el) el.remove();
}

function _fgPreviewSoon() {
  if (!_fgPv) return;
  const live = document.getElementById('fg-pv-live');
  if (live && !live.checked) return;
  clearTimeout(_fgPv.timer);
  _fgPv.timer = setTimeout(fgPreviewRefresh, 500);
}

/** The tab's files as they are in the editor now. */
function _fgPreviewFiles() {
  if (typeof savePracticeFileCode === 'function') savePracticeFileCode();
  return (state.userFiles || []).map(f => ({ name: f.name + f.ext, ext: f.ext, code: String(f.userCode || '') }));
}

function fgPreviewRefresh() {
  const frame = document.getElementById('fg-pv-frame');
  if (!frame || !_fgPv) return;
  _fgPv.lines = [];
  _fgPreviewPaintConsole();
  frame.srcdoc = fgPreviewDocument(_fgPreviewFiles(), state.activeFileIndex || 0, _fgPv.token);
}

/**
 * The page to show: the HTML file (the open one if it is HTML, else the
 * first), with linked .css and .js files from the tab put inline and a
 * small script first that sends console output and errors to the app.
 * @param {Array<{name:string, ext:string, code:string}>} files
 * @param {number} activeIndex
 * @param {string} token  marks this preview's messages
 */
function fgPreviewDocument(files, activeIndex, token) {
  const list = files || [];
  const page = (list[activeIndex] && list[activeIndex].ext === '.html') ? list[activeIndex] : list.find(f => f.ext === '.html');
  const byName = new Map(list.map(f => [f.name.toLowerCase(), f]));
  let html = page ? page.code : '<pre style="font:14px monospace;color:#888">This tab has no .html file to show.</pre>';
  const local = (href) => byName.get(String(href || '').replace(/^\.\//, '').toLowerCase());
  html = html.replace(/<link\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi, (m, href) => {
    const f = local(href);
    return f && f.ext === '.css' && /stylesheet/i.test(m) ? '<style>\n' + f.code.replace(/<\/style/gi, '<\\/style') + '\n</style>' : m;
  });
  html = html.replace(/<script\b([^>]*)\bsrc\s*=\s*["']([^"']+)["']([^>]*)>\s*<\/script>/gi, (m, a, src, b) => {
    const f = local(src);
    return f && f.ext === '.js' ? '<script' + (a + b).replace(/\s+$/, '') + '>\n' + f.code.replace(/<\/script/gi, '<\\/script') + '\n</script>' : m;
  });
  const hook = '<script>(' + _fgPreviewHook.toString() + ')(' + JSON.stringify(token) + ');</script>';
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => m + hook);
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, (m) => m + hook);
  return hook + html;
}

/* Runs inside the preview page: console and errors go to the app. */
function _fgPreviewHook(token) {
  var send = function (kind, args) {
    var text = Array.prototype.map.call(args, function (v) {
      if (typeof v === 'string') return v;
      try { return JSON.stringify(v); } catch (e) { return String(v); }
    }).join(' ');
    try { parent.postMessage({ fgPreview: token, kind: kind, text: text }, '*'); } catch (e) { /* gone */ }
  };
  ['log', 'info', 'warn', 'error', 'debug'].forEach(function (k) {
    var orig = console[k];
    console[k] = function () { send(k, arguments); if (orig) orig.apply(console, arguments); };
  });
  window.addEventListener('error', function (e) { send('error', [e.message + (e.lineno ? ' (line ' + e.lineno + ')' : '')]); });
  window.addEventListener('unhandledrejection', function (e) { send('error', ['Unhandled promise rejection: ' + (e.reason && e.reason.message || e.reason)]); });
}

function _fgPreviewMessage(e) {
  const d = e.data;
  if (!_fgPv || !d || d.fgPreview !== _fgPv.token) return;
  const frame = document.getElementById('fg-pv-frame');
  if (!frame || e.source !== frame.contentWindow) return;
  if (_fgPv.lines.length < 500) _fgPv.lines.push({ kind: String(d.kind || 'log'), text: String(d.text || '') });
  _fgPreviewPaintConsole();
}

function _fgPreviewPaintConsole() {
  const body = document.getElementById('fg-pv-console-body');
  const count = document.getElementById('fg-pv-count');
  if (!body || !_fgPv) return;
  const lines = _fgPv.lines;
  body.innerHTML = lines.length
    ? lines.map(l => '<div class="fg-pv-line is-' + escapeHTML(l.kind) + '">' + escapeHTML(l.text) + '</div>').join('')
    : '<div class="fg-pv-line is-empty">console.log from the page shows here.</div>';
  body.scrollTop = body.scrollHeight;
  const errs = lines.filter(l => l.kind === 'error').length;
  if (count) {
    count.textContent = lines.length ? String(lines.length) : '';
    count.classList.toggle('has-errors', errs > 0);
  }
  if (errs && body.hidden) {
    body.hidden = false;
    const h = document.getElementById('fg-pv-console-head');
    if (h) h.setAttribute('aria-expanded', 'true');
  }
}

function _fgPreviewNewTab() {
  const doc = fgPreviewDocument(_fgPreviewFiles(), state.activeFileIndex || 0, 'tab');
  const url = URL.createObjectURL(new Blob([doc], { type: 'text/html' }));
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
