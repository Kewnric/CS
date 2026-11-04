/* ============================================================
   CVM-PARSE.JS — reads C for the execution-stack window
   ------------------------------------------------------------
   The stack window (js/stack-window.js) draws memory as it stands when the
   program reaches the line the cursor is on. To know that, the program is run
   quietly in the page by a small C interpreter: this file turns the code into
   a tree, js/cvm-run.js runs the tree.

   Why not the real compiler: xcc (js/xcc-core.js) turns C into WebAssembly,
   and WebAssembly memory has no names in it -- there is no way back from a
   byte to "you.age". An interpreter knows every variable it made, so it can
   say what each byte is.

   It reads what a learner writes in this course: every tab (an #include
   "ArrayList.h" pulls the header in, other .c files are appended), #define
   with and without arguments, #ifndef guards, typedef, struct/union/enum,
   pointers, arrays of any depth, function pointers, and all of C's statements
   except goto.

   Plain script, no DOM, one global (CVM), so Node can load it for
   tools/test-cvm.js and two copies from a stale cache cannot clash.
   ============================================================ */
(function (root) {
  'use strict';
  const CVM = root.CVM || (root.CVM = {});

  /* A problem with a place: kind 'compile' (the code cannot be read yet) or
     'runtime' (the program did something C does not allow). */
  class CError extends Error {
    constructor(msg, loc, kind) { super(msg); this.loc = loc || null; this.kind = kind || 'compile'; }
  }
  CVM.CError = CError;

  /* ── Types ─────────────────────────────────────────────────
     Sizes are gcc's on x86-64, which is what Godbolt runs, so sizeof and the
     padding inside a struct match what Run Code prints. */
  function mkInt(name, size, signed, extra) {
    return Object.assign({ k: 'int', name: name, size: size, align: size, signed: signed }, extra || {});
  }
  const T = {
    void: { k: 'void', name: 'void', size: 1, align: 1 },
    bool: mkInt('_Bool', 1, false, { bool: true }),
    char: mkInt('char', 1, true),
    schar: mkInt('signed char', 1, true),
    uchar: mkInt('unsigned char', 1, false),
    short: mkInt('short', 2, true),
    ushort: mkInt('unsigned short', 2, false),
    int: mkInt('int', 4, true),
    uint: mkInt('unsigned int', 4, false),
    long: mkInt('long', 8, true),
    ulong: mkInt('unsigned long', 8, false),
    llong: mkInt('long long', 8, true),
    ullong: mkInt('unsigned long long', 8, false),
    float: { k: 'float', name: 'float', size: 4, align: 4 },
    double: { k: 'float', name: 'double', size: 8, align: 8 },
    ldouble: { k: 'float', name: 'long double', size: 16, align: 16 }
  };
  function ptrTo(t) { return { k: 'ptr', to: t, size: 8, align: 8 }; }
  function arrOf(t, n, nName, nExpr) { return { k: 'arr', of: t, n: n, nName: nName || null, nExpr: nExpr || null }; }
  function fnType(ret, params, variadic, unspecified) {
    return { k: 'fn', ret: ret, params: params, variadic: !!variadic, unspecified: !!unspecified, size: 1, align: 1 };
  }
  function sizeOf(t) {
    if (!t) return 0;
    if (t.k === 'arr') return t.n == null ? 0 : t.n * sizeOf(t.of);
    if (t.k === 'struct') return t.size || 0;
    return t.size;
  }
  function alignOf(t) {
    if (t.k === 'arr') return alignOf(t.of);
    if (t.k === 'struct') return t.align || 1;
    return t.align || 1;
  }
  const alignUp = (n, a) => Math.ceil(n / a) * a;
  function isInt(t) { return t && t.k === 'int'; }
  function isFloat(t) { return t && t.k === 'float'; }
  function isArith(t) { return isInt(t) || isFloat(t); }
  function isPtr(t) { return t && t.k === 'ptr'; }
  function isScalar(t) { return isArith(t) || isPtr(t); }
  function is64(t) { return isInt(t) && t.size === 8; }
  /* How a type is written, for labels: "int", "char[50]", "struct node *". */
  function typeName(t) {
    if (!t) return '?';
    if (t.alias) return t.alias;
    switch (t.k) {
      case 'ptr': {
        if (t.to && t.to.k === 'fn') return typeName(t.to.ret) + ' (*)(…)';
        const inner = typeName(t.to);
        return inner + (inner.endsWith('*') ? '*' : ' *');
      }
      case 'arr': return typeName(t.of) + '[' + (t.n == null ? '' : (t.nName || t.n)) + ']';
      case 'struct': return t.tag ? (t.union ? 'union ' : 'struct ') + t.tag : (t.tdName || (t.union ? 'union' : 'struct'));
      case 'fn': return typeName(t.ret) + '()';
      default: return t.name;
    }
  }
  /* A typedef keeps its own name for labels ("List L"), so it is a thin copy
     of the type it names that carries the alias; everything else about it is
     the original's, structs included (same members, same object). */
  function aliasOf(t, name) {
    if (t.k === 'struct') { if (!t.tdName) t.tdName = name; return t; }
    return Object.assign({}, t, { alias: name });
  }
  CVM.T = T;
  CVM.types = { ptrTo, arrOf, fnType, sizeOf, alignOf, alignUp, isInt, isFloat, isArith, isPtr, isScalar, is64, typeName };

  /* ── Lexer ─────────────────────────────────────────────────
     Every token keeps its file (f), offset (p..e) and line (l): the window
     maps the cursor to a statement through them, and an error says where. */
  const PUNCT = ['...', '<<=', '>>=', '->', '++', '--', '<<', '>>', '<=', '>=', '==', '!=', '&&', '||',
    '*=', '/=', '%=', '+=', '-=', '&=', '^=', '|=', '##'];
  const PUNCT1 = '{}[]()<>;,.:?~!%^&*-+=|/#';

  function lex(src, f) {
    const out = [];
    let i = 0, line = 1, bol = true;
    const n = src.length;
    const tok = (t, v, p, extra) => {
      const o = { t: t, v: v, f: f, p: p, e: i, l: tokLine, bol: bol };
      if (extra) Object.assign(o, extra);
      out.push(o);
      bol = false;
    };
    let tokLine = 1;
    while (i < n) {
      const c = src[i];
      if (c === '\n') { line++; i++; bol = true; out.push({ t: 'nl', f: f, p: i - 1, e: i, l: line - 1 }); continue; }
      if (c === '\\' && src[i + 1] === '\n') { i += 2; line++; continue; }
      if (c === '\\' && src[i + 1] === '\r' && src[i + 2] === '\n') { i += 3; line++; continue; }
      if (c === ' ' || c === '\t' || c === '\r' || c === '\f' || c === '\v') { i++; continue; }
      if (c === '/' && src[i + 1] === '/') {
        while (i < n && src[i] !== '\n') {
          if (src[i] === '\\' && src[i + 1] === '\n') { i += 2; line++; continue; }
          i++;
        }
        continue;
      }
      if (c === '/' && src[i + 1] === '*') {
        const start = i;
        i += 2;
        while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++; }
        if (i >= n) throw new CError('This comment is never closed: a /* needs a */.', { f: f, p: start, e: start + 2, l: line });
        i += 2;
        continue;
      }
      tokLine = line;
      const p = i;
      if (/[A-Za-z_$]/.test(c)) {
        while (i < n && /[A-Za-z0-9_$]/.test(src[i])) i++;
        const word = src.slice(p, i);
        // A prefixed literal: L"..", u8"..", L'x' -- read as a plain one.
        if ((word === 'L' || word === 'u8' || word === 'u' || word === 'U') && (src[i] === '"' || src[i] === "'")) {
          /* fall through to the literal below, from the quote */
        } else { tok('id', word, p); continue; }
      }
      if (/[0-9]/.test(src[i]) || (src[i] === '.' && /[0-9]/.test(src[i + 1] || ''))) {
        const hex = /^0[xX]/.test(src.slice(p, p + 2));
        while (i < n) {
          const d = src[i];
          const sign = src[i + 1] === '+' || src[i + 1] === '-';
          if (sign && (((d === 'e' || d === 'E') && !hex) || d === 'p' || d === 'P')) { i += 2; continue; }
          if (/[0-9A-Za-z_.]/.test(d)) i++;
          else if (d === "'" && /[0-9a-fA-F]/.test(src[i + 1] || '') && /[0-9a-fA-F]/.test(src[i - 1] || '')) i++;   // C23 1'000
          else break;
        }
        tok('num', src.slice(p, i).replace(/'/g, ''), p);
        continue;
      }
      if (src[i] === '"' || src[i] === "'") {
        const q = src[i];
        i++;
        let s = '';
        while (i < n && src[i] !== q) {
          if (src[i] === '\n') throw new CError(q === '"' ? 'This string never ends: it needs a closing ".' : 'This character never ends: it needs a closing \'.', { f: f, p: p, e: i, l: line });
          if (src[i] === '\\') {
            if (src[i + 1] === '\n') { i += 2; line++; continue; }
            s += src[i] + src[i + 1]; i += 2; continue;
          }
          s += src[i]; i++;
        }
        if (i >= n) throw new CError(q === '"' ? 'This string never ends: it needs a closing ".' : 'This character never ends: it needs a closing \'.', { f: f, p: p, e: i, l: line });
        i++;
        tok(q === '"' ? 'str' : 'chr', s, p);
        continue;
      }
      let m = null;
      for (const pu of PUNCT) if (src.startsWith(pu, i)) { m = pu; break; }
      if (!m && PUNCT1.indexOf(c) !== -1) m = c;
      if (!m) {
        i++;
        throw new CError('The character ' + JSON.stringify(c) + ' is not part of C.', { f: f, p: p, e: i, l: line });
      }
      i += m.length;
      tok('op', m, p);
    }
    out.push({ t: 'nl', f: f, p: n, e: n, l: line });
    return out;
  }

  /* Escapes in a string or character literal, to bytes (UTF-8 beyond ASCII). */
  function unescape(s) {
    const bytes = [];
    for (let i = 0; i < s.length; i++) {
      let c = s[i];
      if (c !== '\\') {
        const code = s.codePointAt(i);
        if (code > 0xffff) i++;
        if (code < 0x80) bytes.push(code);
        else {
          const enc = unescape.enc || (unescape.enc = (typeof TextEncoder !== 'undefined' ? new TextEncoder() : null));
          if (enc) enc.encode(String.fromCodePoint(code)).forEach(b => bytes.push(b));
          else bytes.push(code & 0xff);
        }
        continue;
      }
      c = s[++i];
      switch (c) {
        case 'n': bytes.push(10); break;
        case 't': bytes.push(9); break;
        case 'r': bytes.push(13); break;
        case '0': case '1': case '2': case '3': case '4': case '5': case '6': case '7': {
          let v = 0, k = 0;
          while (k < 3 && /[0-7]/.test(s[i] || '')) { v = v * 8 + Number(s[i]); i++; k++; }
          i--;
          bytes.push(v & 0xff);
          break;
        }
        case 'x': {
          let v = 0; i++;
          while (/[0-9a-fA-F]/.test(s[i] || '')) { v = v * 16 + parseInt(s[i], 16); i++; }
          i--;
          bytes.push(v & 0xff);
          break;
        }
        case 'a': bytes.push(7); break;
        case 'b': bytes.push(8); break;
        case 'f': bytes.push(12); break;
        case 'v': bytes.push(11); break;
        case 'e': bytes.push(27); break;
        default: bytes.push(c.charCodeAt(0)); break;   // \\ \' \" \?
      }
    }
    return bytes;
  }

  /* ── Preprocessor ──────────────────────────────────────────
     The whole program is read as one translation unit, the way Run Code
     builds it (preprocessMultiFile): the file with main, every local header it
     includes -- each once, whatever its guards say -- then any other .c file.
     System headers are not read; what they would declare is built in. */
  const BUILTIN_MACROS = {
    NULL: '((void*)0)', EOF: '(-1)', true: '1', false: '0', bool: '_Bool',
    RAND_MAX: '2147483647', INT_MAX: '2147483647', INT_MIN: '(-2147483647-1)',
    UINT_MAX: '4294967295U', LONG_MAX: '9223372036854775807L', LONG_MIN: '(-9223372036854775807L-1)',
    LLONG_MAX: '9223372036854775807LL', LLONG_MIN: '(-9223372036854775807LL-1)',
    CHAR_MAX: '127', CHAR_MIN: '(-128)', SCHAR_MAX: '127', SCHAR_MIN: '(-128)', UCHAR_MAX: '255',
    SHRT_MAX: '32767', SHRT_MIN: '(-32768)', USHRT_MAX: '65535', CHAR_BIT: '8',
    FLT_MAX: '3.40282347e+38F', DBL_MAX: '1.7976931348623157e+308', FLT_MIN: '1.17549435e-38F', DBL_MIN: '2.2250738585072014e-308',
    EXIT_SUCCESS: '0', EXIT_FAILURE: '1', SEEK_SET: '0', SEEK_CUR: '1', SEEK_END: '2', BUFSIZ: '8192',
    M_PI: '3.14159265358979323846', M_E: '2.7182818284590452354', INFINITY: '(1e999)', NAN: '(0.0/0.0)',
    CLOCKS_PER_SEC: '1000000L', __STDC__: '1', __STDC_VERSION__: '201710L', __x86_64__: '1', __linux__: '1',
    size_t: 'unsigned long', ssize_t: 'long', ptrdiff_t: 'long', intptr_t: 'long', uintptr_t: 'unsigned long',
    int8_t: 'signed char', uint8_t: 'unsigned char', int16_t: 'short', uint16_t: 'unsigned short',
    int32_t: 'int', uint32_t: 'unsigned int', int64_t: 'long', uint64_t: 'unsigned long', time_t: 'long', clock_t: 'long',
    wchar_t: 'int', FILE: 'struct _IO_FILE', stdin: '((FILE*)1)', stdout: '((FILE*)2)', stderr: '((FILE*)3)'
  };

  function preprocess(files, mainIdx) {
    const macros = new Map();
    for (const k of Object.keys(BUILTIN_MACROS)) {
      macros.set(k, { name: k, params: null, body: lex(BUILTIN_MACROS[k], -1).filter(t => t.t !== 'nl'), builtin: true });
    }
    const included = new Set();
    const out = [];
    const nameOf = (fl) => (fl.name || '').toLowerCase();
    const findFile = (want) => {
      const w = want.toLowerCase().replace(/^\.\//, '');
      const base = w.split('/').pop();
      return files.findIndex(fl => nameOf(fl) === w || nameOf(fl) === base);
    };

    function run(fi, depth) {
      if (depth > 30) throw new CError('#include goes in circles: a header includes itself.', null);
      included.add(fi);
      const toks = lex(files[fi].code || '', fi);
      const cond = [];   // {on, taken, outer}
      const active = () => cond.every(c => c.on);
      let i = 0;
      const lineToks = () => { const a = []; while (i < toks.length && toks[i].t !== 'nl') a.push(toks[i++]); i++; return a; };
      let pending = [];
      const flush = () => { if (pending.length) { expand(pending, out); pending = []; } };
      while (i < toks.length) {
        const t = toks[i];
        if (t.t === 'nl') { i++; continue; }
        if (t.t === 'op' && t.v === '#' && t.bol) {
          i++;
          const d = lineToks();
          const name = d[0] && d[0].t === 'id' ? d[0].v : (d[0] ? d[0].v : '');
          const rest = d.slice(1);
          if (name === 'if' || name === 'ifdef' || name === 'ifndef') {
            const outer = active();
            let on = false;
            if (outer) {
              if (name === 'ifdef') on = !!(rest[0] && macros.has(rest[0].v));
              else if (name === 'ifndef') on = !(rest[0] && macros.has(rest[0].v));
              else on = ppEval(rest, macros, t);
            }
            cond.push({ on: outer && on, taken: outer && on, outer: outer });
            continue;
          }
          if (name === 'elif') {
            const c = cond[cond.length - 1];
            if (!c) throw new CError('#elif without an #if.', t);
            if (c.taken || !c.outer) c.on = false;
            else { c.on = ppEval(rest, macros, t); c.taken = c.on; }
            continue;
          }
          if (name === 'else') {
            const c = cond[cond.length - 1];
            if (!c) throw new CError('#else without an #if.', t);
            c.on = c.outer && !c.taken; c.taken = true;
            continue;
          }
          if (name === 'endif') {
            if (!cond.length) throw new CError('#endif without an #if.', t);
            cond.pop();
            continue;
          }
          if (!active()) continue;
          if (name === 'define') {
            flush();
            const nm = rest[0];
            if (!nm || nm.t !== 'id') throw new CError('#define needs a name.', t);
            let params = null, bodyStart = 1, variadic = false;
            if (rest[1] && rest[1].v === '(' && rest[1].p === nm.e) {
              params = [];
              let j = 2;
              while (j < rest.length && rest[j].v !== ')') {
                if (rest[j].t === 'id') params.push(rest[j].v);
                else if (rest[j].v === '...') { params.push('__VA_ARGS__'); variadic = true; }
                j++;
              }
              bodyStart = j + 1;
            }
            macros.set(nm.v, { name: nm.v, params: params, variadic: variadic, body: rest.slice(bodyStart) });
            continue;
          }
          if (name === 'undef') { flush(); if (rest[0]) macros.delete(rest[0].v); continue; }
          if (name === 'include') {
            flush();
            if (rest[0] && rest[0].t === 'str') {
              const idx = findFile(rest[0].v);
              if (idx === -1) {
                throw new CError('#include "' + rest[0].v + '": there is no tab with that name.', rest[0]);
              }
              if (!included.has(idx)) run(idx, depth + 1);
            }
            continue;   // <stdio.h> and friends are built in
          }
          if (name === 'error') throw new CError('#error ' + rest.map(x => x.v).join(' '), t);
          continue;   // #pragma, #line, #warning
        }
        if (!active()) { i++; continue; }
        pending.push(t);
        i++;
        // Directives can only change macros between lines, so a run of plain
        // lines is expanded as one stream (a macro call may span lines).
        if (toks[i] && toks[i].t === 'nl') {
          let j = i;
          while (toks[j] && toks[j].t === 'nl') j++;
          if (toks[j] && toks[j].t === 'op' && toks[j].v === '#' && toks[j].bol) flush();
        }
      }
      flush();
      if (cond.length) throw new CError('An #if or #ifndef is never closed with #endif.', null);
    }

    function expand(list, sink) {
      const res = expandList(list, new Set());
      for (const t of res) sink.push(t);
    }

    function expandList(list, hide) {
      const res = [];
      for (let i = 0; i < list.length; i++) {
        const t = list[i];
        if (t.t !== 'id' || hide.has(t.v) || t.noexp || !macros.has(t.v)) { res.push(t); continue; }
        const m = macros.get(t.v);
        if (!m.params) {
          const body = m.body.map(b => relocate(b, t, m.name));
          const inner = new Set(hide); inner.add(m.name);
          expandList(body, inner).forEach(x => res.push(x));
          continue;
        }
        // A function-like macro only expands when called.
        let j = i + 1;
        if (!list[j] || list[j].v !== '(') { res.push(t); continue; }
        const args = [[]];
        let depth = 0;
        j++;
        for (; j < list.length; j++) {
          const a = list[j];
          if (a.v === '(' && a.t === 'op') depth++;
          else if (a.v === ')' && a.t === 'op') { if (depth === 0) break; depth--; }
          else if (a.v === ',' && a.t === 'op' && depth === 0 &&
                   !(m.variadic && args.length >= m.params.length)) { args.push([]); continue; }
          args[args.length - 1].push(a);
        }
        if (j >= list.length) throw new CError('The macro ' + m.name + '( is never closed with ).', t);
        if (m.params.length === 0 && args.length === 1 && !args[0].length) args.length = 0;
        const end = list[j];
        const expArgs = args.map(a => expandList(a, hide));
        const body = [];
        for (let b = 0; b < m.body.length; b++) {
          const bt = m.body[b];
          if (bt.v === '#' && bt.t === 'op' && m.body[b + 1] && m.params.indexOf(m.body[b + 1].v) !== -1) {
            const raw = args[m.params.indexOf(m.body[b + 1].v)] || [];
            body.push(relocate({ t: 'str', v: raw.map(x => x.t === 'str' ? '"' + x.v + '"' : x.v).join(' ').replace(/\\/g, '\\\\').replace(/"/g, '\\"') }, t, m.name));
            b++;
            continue;
          }
          if (bt.v === '##' && bt.t === 'op') {
            const prev = body.pop();
            const nx = m.body[++b];
            let rhs = nx;
            const pi = nx ? m.params.indexOf(nx.v) : -1;
            if (pi !== -1) rhs = (args[pi] || [])[0];
            if (prev && rhs) {
              const glued = lex(String(prev.v) + String(rhs.v), -1).filter(x => x.t !== 'nl');
              glued.forEach(g => body.push(relocate(g, t, m.name)));
            } else if (prev) body.push(prev);
            continue;
          }
          const pi = bt.t === 'id' ? m.params.indexOf(bt.v) : -1;
          if (pi !== -1) {
            const nextIsPaste = m.body[b + 1] && m.body[b + 1].v === '##';
            (nextIsPaste ? (args[pi] || []) : (expArgs[pi] || [])).forEach(x => body.push(x));
          } else body.push(relocate(bt, t, m.name));
        }
        const inner = new Set(hide); inner.add(m.name);
        expandList(body, inner).forEach(x => res.push(x));
        i = j;
        void end;
      }
      return res;
    }

    // A token from a macro body, placed where the macro was used.
    function relocate(b, at, macName) {
      return { t: b.t, v: b.v, f: at.f, p: at.p, e: at.e, l: at.l, mac: at.mac || macName };
    }

    const order = [mainIdx];
    files.forEach((fl, i) => { if (i !== mainIdx && /\.c$/i.test(fl.name || '')) order.push(i); });
    for (const fi of order) if (!included.has(fi)) run(fi, 0);
    out.push({ t: 'eof', v: '', f: mainIdx, p: 0, e: 0, l: 0 });
    return { tokens: out, macros: macros };
  }

  /* #if: macros expanded, defined(X) answered, anything left over is 0. */
  function ppEval(toks, macros, at) {
    const pre = [];
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (t.t === 'id' && t.v === 'defined') {
        let nm = toks[i + 1];
        if (nm && nm.v === '(') { nm = toks[i + 2]; i += 3; } else i += 1;
        pre.push({ t: 'num', v: macros.has(nm && nm.v) ? '1' : '0', f: t.f, p: t.p, e: t.e, l: t.l });
        continue;
      }
      pre.push(t);
    }
    const fake = { macros: macros };
    void fake;
    // Expand with a throwaway preprocessor pass over just these tokens.
    const expanded = [];
    const tmp = (function () {
      const res = [];
      const walk = (list, hide) => {
        for (let i = 0; i < list.length; i++) {
          const t = list[i];
          if (t.t === 'id' && !hide.has(t.v) && macros.has(t.v) && !macros.get(t.v).params) {
            const h = new Set(hide); h.add(t.v);
            walk(macros.get(t.v).body, h);
          } else res.push(t);
        }
      };
      walk(pre, new Set());
      return res;
    })();
    tmp.forEach(t => expanded.push(t.t === 'id' ? { t: 'num', v: '0', f: t.f, p: t.p, e: t.e, l: t.l } : t));
    expanded.push({ t: 'eof', v: '', f: at.f, p: at.p, e: at.e, l: at.l });
    const p = new Parser(expanded);
    const e = p.expr();
    const v = constEval(e, p);
    return v != null && Number(v) !== 0;
  }

  /* ── Parser ────────────────────────────────────────────────
     Recursive descent over the preprocessed tokens. Every node has `k` (its
     kind) and `loc` (where it was written); every statement also gets an `id`
     the interpreter reports it by. */
  const TYPE_KW = new Set(['void', 'char', 'short', 'int', 'long', 'float', 'double', 'signed', 'unsigned',
    '_Bool', 'struct', 'union', 'enum', 'const', 'volatile', 'restrict', '__restrict', 'static', 'extern',
    'auto', 'register', 'typedef', 'inline', '__inline', '_Noreturn', '__extension__', '_Complex']);
  const BINPREC = { '||': 1, '&&': 2, '|': 3, '^': 4, '&': 5, '==': 6, '!=': 6, '<': 7, '>': 7, '<=': 7, '>=': 7,
    '<<': 8, '>>': 8, '+': 9, '-': 9, '*': 10, '/': 10, '%': 10 };
  const ASSIGN_OPS = new Set(['=', '+=', '-=', '*=', '/=', '%=', '<<=', '>>=', '&=', '^=', '|=']);

  let STMT_ID = 0;

  class Parser {
    constructor(tokens) {
      this.toks = tokens;
      this.i = 0;
      this.typedefs = [new Map()];
      this.tags = new Map();
      this.enumConsts = new Map();
      this.funcs = new Map();
      this.globals = [];
      this.protos = new Map();
      this.allStmts = [];
    }
    get t() { return this.toks[this.i]; }
    peek(k) { return this.toks[this.i + (k || 0)] || this.toks[this.toks.length - 1]; }
    next() { const t = this.toks[this.i]; if (this.i < this.toks.length - 1) this.i++; return t; }
    is(v, k) { const t = this.peek(k); return t && (t.t === 'op' || t.t === 'id') && t.v === v; }
    accept(v) { if (this.is(v)) { return this.next(); } return null; }
    prevTok() { return this.toks[Math.max(0, this.i - 1)]; }
    fail(msg, t) {
      const at = t || this.t;
      throw new CError(msg, at && at.t !== 'eof' ? at : this.prevTok());
    }
    expect(v, what) {
      if (this.is(v)) return this.next();
      const t = this.t;
      const got = t.t === 'eof' ? 'the end of the code' : '"' + t.v + '"';
      if (v === ';') this.fail('Missing ; ' + (what || 'at the end of this statement') + '.', this.prevTok());
      this.fail('Expected "' + v + '"' + (what ? ' ' + what : '') + ', found ' + got + '.', t);
    }
    ident(what) {
      const t = this.t;
      if (t.t !== 'id') this.fail('Expected a name' + (what ? ' for ' + what : '') + ', found ' + (t.t === 'eof' ? 'the end of the code' : '"' + t.v + '"') + '.');
      return this.next();
    }
    loc(start) {
      const end = this.prevTok();
      return { f: start.f, p: start.p, l: start.l, e: end.f === start.f ? end.e : start.e, el: end.f === start.f ? end.l : start.l };
    }
    lookupTypedef(name) {
      for (let s = this.typedefs.length - 1; s >= 0; s--) {
        const m = this.typedefs[s];
        if (m.has(name)) return m.get(name);
      }
      return null;
    }
    isTypeStart(k) {
      const t = this.peek(k);
      if (!t || t.t !== 'id') return false;
      if (TYPE_KW.has(t.v)) return true;
      return !!this.lookupTypedef(t.v) && !(this.peek((k || 0) + 1).v === ':' );
    }
    pushScope() { this.typedefs.push(new Map()); }
    popScope() { this.typedefs.pop(); }
    shadow(name) {
      // A variable named like a typedef hides it in its scope.
      const top = this.typedefs[this.typedefs.length - 1];
      if (this.lookupTypedef(name)) top.set(name, null);
    }

    /* ── Declarations ── */
    specifiers() {
      const start = this.t;
      let storage = null, signed = null, longs = 0, base = null, sawShort = false, sawInt = false, inline = false;
      let type = null, spell = null;
      for (;;) {
        const t = this.t;
        if (t.t !== 'id') break;
        const v = t.v;
        if (v === 'typedef' || v === 'static' || v === 'extern' || v === 'auto' || v === 'register') { storage = v === 'auto' || v === 'register' ? storage : v; this.next(); continue; }
        if (v === 'const' || v === 'volatile' || v === 'restrict' || v === '__restrict' || v === '__extension__' || v === '_Noreturn') { this.next(); continue; }
        if (v === 'inline' || v === '__inline') { inline = true; this.next(); continue; }
        if (v === 'signed') { signed = true; this.next(); continue; }
        if (v === 'unsigned') { signed = false; this.next(); continue; }
        if (v === 'long') { longs++; this.next(); continue; }
        if (v === 'short') { sawShort = true; this.next(); continue; }
        if (v === 'int') { sawInt = true; this.next(); continue; }
        if (v === 'char' || v === 'void' || v === 'float' || v === 'double' || v === '_Bool') {
          if (base) this.fail('Two types in one declaration: "' + base + '" and "' + v + '".');
          base = v; this.next(); continue;
        }
        if (v === '_Complex') { this.next(); continue; }
        if (v === 'struct' || v === 'union') { if (type || base) break; type = this.structSpec(); continue; }
        if (v === 'enum') { if (type || base) break; type = this.enumSpec(); continue; }
        if (!type && !base && signed === null && !longs && !sawShort && !sawInt) {
          const td = this.lookupTypedef(v);
          if (td) { type = td; spell = v; this.next(); continue; }
        }
        break;
      }
      if (!type) {
        if (base === 'void') type = T.void;
        else if (base === 'char') type = signed === false ? T.uchar : (signed === true ? T.schar : T.char);
        else if (base === 'float') type = T.float;
        else if (base === 'double') type = longs ? T.ldouble : T.double;
        else if (base === '_Bool') type = T.bool;
        else if (sawShort) type = signed === false ? T.ushort : T.short;
        else if (longs >= 2) type = signed === false ? T.ullong : T.llong;
        else if (longs === 1) type = signed === false ? T.ulong : T.long;
        else if (sawInt || signed !== null) type = signed === false ? T.uint : T.int;
        else return null;
      }
      return { type: type, storage: storage, inline: inline, spell: spell, start: start };
    }

    structSpec() {
      const kw = this.next();
      const isUnion = kw.v === 'union';
      let tag = null;
      if (this.t.t === 'id' && !this.is('{')) tag = this.next().v;
      let st = null;
      const key = (isUnion ? 'union ' : 'struct ') + (tag || '');
      if (tag && this.tags.has(key)) st = this.tags.get(key);
      if (!this.is('{')) {
        if (!st) {
          st = { k: 'struct', tag: tag, union: isUnion, members: [], size: 0, align: 1, complete: false };
          if (tag) this.tags.set(key, st);
        }
        return st;
      }
      if (!st || st.complete) {
        st = { k: 'struct', tag: tag, union: isUnion, members: [], size: 0, align: 1, complete: false };
        if (tag) this.tags.set(key, st);
      }
      this.expect('{');
      const members = [];
      while (!this.is('}')) {
        if (this.t.t === 'eof') this.fail('This struct is never closed with }.', kw);
        const sp = this.specifiers();
        if (!sp) this.fail('Expected a member type inside the struct, found "' + this.t.v + '".');
        if (this.accept(';')) {
          // An unnamed struct/union member: its fields belong to this one.
          if (sp.type.k === 'struct') members.push({ name: null, type: sp.type, anon: true });
          continue;
        }
        do {
          const d = this.declarator(sp.type, false);
          if (this.accept(':')) { this.condExpr(); }   // a bit-field width: kept as the whole type
          members.push({ name: d.name, type: d.type, spell: spellOf(sp, d), loc: d.loc });
        } while (this.accept(','));
        this.expect(';', 'after this struct member');
      }
      this.expect('}');
      layoutStruct(st, members);
      return st;
    }

    enumSpec() {
      this.next();
      let tag = null;
      if (this.t.t === 'id' && !this.is('{')) tag = this.next().v;
      const et = mkInt(tag ? 'enum ' + tag : 'enum', 4, true, { enumNames: new Map() });
      const key = 'enum ' + (tag || '');
      if (!this.is('{')) {
        return (tag && this.tags.get(key)) || et;
      }
      if (tag) this.tags.set(key, et);
      this.expect('{');
      let val = 0;
      while (!this.is('}')) {
        const nm = this.ident('an enum value');
        if (this.accept('=')) {
          const v = constEval(this.condExpr(), this);
          if (v == null) this.fail('An enum value must be a constant.', nm);
          val = Number(v);
        }
        this.enumConsts.set(nm.v, val);
        et.enumNames.set(val, nm.v);
        val++;
        if (!this.accept(',')) break;
      }
      this.expect('}');
      return et;
    }

    /* A declarator wraps a base type: pointers first, then [] and () from the
       right, then whatever was in parentheses. Returns name, type, the
       parameter list when it declares a function, and the macro an array
       size came from ("Max-1" in the picture). */
    declarator(base, abstract) {
      const start = this.t;
      let ptrs = 0;
      while (this.is('*')) {
        this.next();
        while (this.t.t === 'id' && (this.t.v === 'const' || this.t.v === 'volatile' || this.t.v === 'restrict' || this.t.v === '__restrict')) this.next();
        ptrs++;
      }
      let inner = null, name = null, nameTok = null;
      if (this.is('(') && (this.is('*', 1) || this.is('(', 1) || (this.peek(1).t === 'id' && !this.isTypeStart(1) && !abstract))) {
        this.next();
        inner = this.declarator(T.void, abstract);
        this.expect(')');
      } else if (this.t.t === 'id' && !TYPE_KW.has(this.t.v)) {
        nameTok = this.next();
        name = nameTok.v;
      } else if (!abstract) {
        this.fail('Expected a name here, found ' + (this.t.t === 'eof' ? 'the end of the code' : '"' + this.t.v + '"') + '.');
      }
      const suffixes = [];
      let params = null;
      for (;;) {
        if (this.is('[')) {
          const lb = this.next();
          while (this.t.t === 'id' && (this.t.v === 'static' || this.t.v === 'const')) this.next();
          if (this.accept(']')) { suffixes.push({ arr: true, n: null }); continue; }
          const szTokStart = this.i;
          const e = this.assignExpr();
          const szToks = this.toks.slice(szTokStart, this.i);
          this.expect(']', 'to close the array size');
          let n = constEval(e, this);
          let nExpr = null;
          if (n == null) nExpr = e;
          else if (Number(n) < 0) this.fail('An array cannot have a negative size.', lb);
          const macs = new Set(szToks.map(x => x.mac || ''));
          const nName = (macs.size === 1 && !macs.has('')) ? [...macs][0] : (szToks.length === 1 && szToks[0].t === 'id' ? szToks[0].v : null);
          suffixes.push({ arr: true, n: n == null ? null : Number(n), nName: nName, nExpr: nExpr });
          continue;
        }
        if (this.is('(')) {
          this.next();
          const ps = this.paramList();
          if (!params && !inner) params = ps;
          suffixes.push({ fn: true, ps: ps });
          continue;
        }
        break;
      }
      const wrap = (t) => {
        for (let k = 0; k < ptrs; k++) t = ptrTo(t);
        for (let k = suffixes.length - 1; k >= 0; k--) {
          const s = suffixes[k];
          if (s.arr) t = arrOf(t, s.n, s.nName, s.nExpr);
          else t = fnType(t, s.ps.params, s.ps.variadic, s.ps.unspecified);
        }
        return inner ? inner.wrap(t) : t;
      };
      const type = wrap(base);
      if (inner && !params && inner.params && inner.type.k === 'fn') params = inner.params;
      return { name: name || (inner && inner.name), nameTok: nameTok || (inner && inner.nameTok), type: type, params: params,
               wrap: wrap, loc: nameTok ? { f: nameTok.f, p: nameTok.p, e: nameTok.e, l: nameTok.l } : this.loc(start), ptrs: ptrs, suffixes: suffixes };
    }

    paramList() {
      const res = { params: [], variadic: false, unspecified: false };
      if (this.accept(')')) { res.unspecified = true; return res; }
      if (this.is('void') && this.is(')', 1)) { this.next(); this.next(); return res; }
      for (;;) {
        if (this.accept('...')) { res.variadic = true; break; }
        const sp = this.specifiers();
        if (!sp) this.fail('Expected a parameter type, found "' + this.t.v + '".');
        const d = this.declarator(sp.type, true);
        let t = d.type;
        const declared = t;
        if (t.k === 'arr') t = ptrTo(t.of);
        else if (t.k === 'fn') t = ptrTo(t);
        res.params.push({ name: d.name, type: t, declared: declared, spell: spellOf(sp, d), loc: d.loc });
        if (!this.accept(',')) break;
      }
      this.expect(')', 'to close the parameter list');
      return res;
    }

    typeName() {
      const sp = this.specifiers();
      if (!sp) this.fail('Expected a type, found "' + this.t.v + '".');
      const d = this.declarator(sp.type, true);
      return d.type;
    }

    /* A declaration at file or block level. `top` lets a function body follow. */
    declaration(top) {
      const startTok = this.t;
      const sp = this.specifiers();
      if (!sp) return null;
      if (this.accept(';')) return { k: 'decl', vars: [], loc: this.loc(startTok) };   // struct S { ... };
      const vars = [];
      for (;;) {
        const d = this.declarator(sp.type, false);
        if (top && d.type.k === 'fn' && this.is('{')) {
          if (vars.length) this.fail('A function body cannot follow a list of declarations.');
          return this.funcDef(sp, d, startTok);
        }
        if (sp.storage === 'typedef') {
          this.typedefs[this.typedefs.length - 1].set(d.name, aliasOf(d.type, d.name));
        } else if (d.type.k === 'fn') {
          if (!this.protos.has(d.name)) this.protos.set(d.name, { name: d.name, type: d.type, loc: d.loc });
        } else {
          this.shadow(d.name);
          let init = null;
          if (this.accept('=')) init = this.initializer();
          vars.push({ name: d.name, type: d.type, init: init, storage: sp.storage, spell: spellOf(sp, d), loc: d.loc });
        }
        if (!this.accept(',')) break;
      }
      this.expect(';', 'at the end of this declaration');
      return { k: 'decl', vars: vars, loc: this.loc(startTok) };
    }

    funcDef(sp, d, startTok) {
      const fn = { k: 'func', name: d.name, type: d.type, params: (d.params && d.params.params) || [], static: sp.storage === 'static',
                   loc: null, body: null, nameLoc: d.loc, retSpell: sp.spell || typeName(d.type.ret) };
      if (this.funcs.has(d.name)) this.fail('The function ' + d.name + '() is written twice.', d.nameTok);
      this.funcs.set(d.name, fn);   // before the body, so it can call itself
      this.pushScope();
      fn.params.forEach(p => { if (p.name) this.shadow(p.name); });
      this.curFn = fn;
      fn.body = this.block();
      this.curFn = null;
      this.popScope();
      fn.loc = this.loc(startTok);
      return fn;
    }

    initializer() {
      if (this.is('{')) {
        const lb = this.next();
        const items = [];
        while (!this.is('}')) {
          const desig = [];
          for (;;) {
            if (this.is('.') && this.peek(1).t === 'id') { this.next(); desig.push({ field: this.next().v }); continue; }
            if (this.is('[')) {
              this.next();
              const v = constEval(this.condExpr(), this);
              this.expect(']');
              desig.push({ index: Number(v) });
              continue;
            }
            break;
          }
          if (desig.length) this.expect('=');
          items.push({ desig: desig, v: this.initializer() });
          if (!this.accept(',')) break;
        }
        this.expect('}', 'to close this { list');
        return { k: 'init', items: items, loc: this.loc(lb) };
      }
      return this.assignExpr();
    }

    /* ── Statements ── */
    stmt() {
      const st = this.t;
      const node = this.stmtInner();
      if (!node.loc) node.loc = this.loc(st);
      node.id = ++STMT_ID;
      this.allStmts.push(node);
      return node;
    }
    block() {
      const lb = this.expect('{');
      this.pushScope();
      const items = [];
      while (!this.is('}')) {
        if (this.t.t === 'eof') this.fail('This { is never closed with }.', lb);
        items.push(this.blockItem());
      }
      this.next();
      this.popScope();
      const node = { k: 'block', items: items, loc: this.loc(lb), id: ++STMT_ID };
      this.allStmts.push(node);
      return node;
    }
    blockItem() {
      if (this.isTypeStart()) {
        const st = this.t;
        const d = this.declaration(false);
        d.loc = this.loc(st);
        d.id = ++STMT_ID;
        this.allStmts.push(d);
        return d;
      }
      return this.stmt();
    }
    stmtInner() {
      const t = this.t;
      if (t.t === 'op' && t.v === '{') return this.block();
      if (t.t === 'op' && t.v === ';') { this.next(); return { k: 'empty' }; }
      if (t.t === 'id') {
        switch (t.v) {
          case 'if': {
            this.next(); this.expect('(', 'after if');
            const c = this.expr(); this.expect(')', 'to close the if condition');
            const th = this.stmt();
            let el = null;
            if (this.accept('else')) el = this.stmt();
            return { k: 'if', c: c, t: th, f: el };
          }
          case 'while': {
            this.next(); this.expect('(', 'after while');
            const c = this.expr(); this.expect(')', 'to close the while condition');
            return { k: 'while', c: c, body: this.stmt() };
          }
          case 'do': {
            this.next();
            const body = this.stmt();
            this.expect('while', 'after the do body');
            this.expect('(');
            const c = this.expr(); this.expect(')');
            this.expect(';', 'after do ... while (...)');
            return { k: 'do', c: c, body: body };
          }
          case 'for': {
            this.next(); this.expect('(', 'after for');
            this.pushScope();
            let init = null;
            if (this.isTypeStart()) {
              const st = this.t;
              init = this.declaration(false);
              init.loc = this.loc(st);
              init.id = ++STMT_ID;
              this.allStmts.push(init);
            } else if (!this.accept(';')) {
              const st = this.t;
              const e = this.expr();
              this.expect(';', 'after the first part of the for');
              init = { k: 'expr', e: e, loc: this.loc(st), id: ++STMT_ID };
              this.allStmts.push(init);
            }
            const c = this.is(';') ? null : this.expr();
            this.expect(';', 'after the for condition');
            const inc = this.is(')') ? null : this.expr();
            this.expect(')', 'to close the for (...)');
            const body = this.stmt();
            this.popScope();
            return { k: 'for', init: init, c: c, inc: inc, body: body };
          }
          case 'switch': {
            this.next(); this.expect('(', 'after switch');
            const e = this.expr(); this.expect(')');
            return { k: 'switch', e: e, body: this.stmt() };
          }
          case 'case': {
            this.next();
            const e = this.condExpr();
            let hi = null;
            if (this.accept('...')) hi = this.condExpr();   // gcc's case 1 ... 5:
            this.expect(':', 'after the case value');
            const v = constEval(e, this);
            if (v == null) this.fail('A case value must be a constant.', t);
            const body = this.is('}') ? { k: 'empty', loc: this.loc(t), id: ++STMT_ID } : this.stmt();
            return { k: 'case', v: v, hi: hi == null ? null : constEval(hi, this), body: body };
          }
          case 'default': {
            this.next(); this.expect(':', 'after default');
            const body = this.is('}') ? { k: 'empty', loc: this.loc(t), id: ++STMT_ID } : this.stmt();
            return { k: 'default', body: body };
          }
          case 'break': this.next(); this.expect(';', 'after break'); return { k: 'break' };
          case 'continue': this.next(); this.expect(';', 'after continue'); return { k: 'continue' };
          case 'return': {
            this.next();
            const e = this.is(';') ? null : this.expr();
            this.expect(';', 'after return');
            return { k: 'return', e: e };
          }
          case 'goto': this.fail('The stack window cannot follow goto.', t); break;
          default:
            if (this.is(':', 1) && !this.lookupTypedef(t.v)) {   // a label: kept, but nothing jumps to it
              this.next(); this.next();
              return this.is('}') ? { k: 'empty' } : this.stmtInner();
            }
        }
      }
      const e = this.expr();
      this.expect(';');
      return { k: 'expr', e: e };
    }

    /* ── Expressions ── */
    expr() {
      const st = this.t;
      let e = this.assignExpr();
      while (this.is(',')) {
        this.next();
        const b = this.assignExpr();
        e = { k: 'comma', a: e, b: b, loc: this.loc(st) };
      }
      return e;
    }
    assignExpr() {
      const st = this.t;
      const a = this.condExpr();
      const t = this.t;
      if (t.t === 'op' && ASSIGN_OPS.has(t.v)) {
        this.next();
        const b = this.assignExpr();
        return { k: 'assign', op: t.v, a: a, b: b, loc: this.loc(st) };
      }
      return a;
    }
    condExpr() {
      const st = this.t;
      const c = this.binExpr(1);
      if (this.is('?')) {
        this.next();
        const a = this.is(':') ? c : this.expr();   // gcc's x ?: y
        this.expect(':', 'in this ? : expression');
        const b = this.condExpr();
        return { k: 'cond', c: c, a: a, b: b, loc: this.loc(st) };
      }
      return c;
    }
    binExpr(min) {
      const st = this.t;
      let a = this.castExpr();
      for (;;) {
        const t = this.t;
        const pr = t.t === 'op' ? BINPREC[t.v] : undefined;
        if (pr === undefined || pr < min) break;
        this.next();
        const b = this.binExpr(pr + 1);
        a = { k: 'bin', op: t.v, a: a, b: b, loc: this.loc(st) };
      }
      return a;
    }
    castExpr() {
      const st = this.t;
      if (this.is('(') && this.isTypeStart(1)) {
        this.next();
        const ty = this.typeName();
        this.expect(')', 'to close the cast');
        if (this.is('{')) {
          const init = this.initializer();
          return this.postfix({ k: 'clit', t: ty, init: init, loc: this.loc(st) }, st);
        }
        const a = this.castExpr();
        return { k: 'cast', t: ty, a: a, loc: this.loc(st) };
      }
      return this.unaryExpr();
    }
    unaryExpr() {
      const st = this.t;
      const t = this.t;
      if (t.t === 'op') {
        if (t.v === '++' || t.v === '--') { this.next(); const a = this.unaryExpr(); return { k: 'pre', op: t.v, a: a, loc: this.loc(st) }; }
        if (t.v === '&' || t.v === '*' || t.v === '+' || t.v === '-' || t.v === '~' || t.v === '!') {
          this.next();
          const a = this.castExpr();
          return { k: 'un', op: t.v, a: a, loc: this.loc(st) };
        }
        if (t.v === '&&') this.fail('"&&" here: did you mean "&" (the address of)?', t);
      }
      if (t.t === 'id' && (t.v === 'sizeof' || t.v === '_Alignof' || t.v === 'alignof')) {
        this.next();
        const al = t.v !== 'sizeof';
        if (this.is('(') && this.isTypeStart(1)) {
          this.next();
          const ty = this.typeName();
          this.expect(')');
          return { k: al ? 'alignof_t' : 'sizeof_t', t: ty, loc: this.loc(st) };
        }
        const a = this.unaryExpr();
        return { k: 'sizeof_e', a: a, loc: this.loc(st) };
      }
      return this.postfix(this.primary(), st);
    }
    postfix(e, st) {
      for (;;) {
        const t = this.t;
        if (t.t !== 'op') break;
        if (t.v === '[') {
          this.next();
          const i = this.expr();
          this.expect(']', 'to close the [index]');
          e = { k: 'idx', a: e, i: i, loc: this.loc(st) };
        } else if (t.v === '(') {
          this.next();
          const args = [];
          while (!this.is(')')) {
            args.push(this.assignExpr());
            if (!this.accept(',')) break;
          }
          this.expect(')', 'to close the call to ' + (e.k === 'id' ? e.name + '()' : 'this function'));
          e = { k: 'call', f: e, args: args, loc: this.loc(st) };
        } else if (t.v === '.' || t.v === '->') {
          this.next();
          const nm = this.ident('the member after ' + t.v);
          e = { k: 'mem', a: e, name: nm.v, arrow: t.v === '->', loc: this.loc(st), nameLoc: nm };
        } else if (t.v === '++' || t.v === '--') {
          this.next();
          e = { k: 'post', op: t.v, a: e, loc: this.loc(st) };
        } else break;
      }
      return e;
    }
    primary() {
      const t = this.t;
      if (t.t === 'num') { this.next(); return Object.assign(parseNumber(t, this), { loc: this.loc(t) }); }
      if (t.t === 'chr') {
        this.next();
        const b = unescape(t.v);
        if (!b.length) this.fail("'' is an empty character: put one character between the quotes.", t);
        let v = b.length === 1 ? (b[0] > 127 ? b[0] - 256 : b[0]) : b.reduce((a, x) => (a << 8) | x, 0);
        return { k: 'num', v: v, t: T.int, chr: true, loc: this.loc(t) };
      }
      if (t.t === 'str') {
        const bytes = [];
        while (this.t.t === 'str') unescape(this.next().v).forEach(b => bytes.push(b));
        return { k: 'str', bytes: bytes, t: arrOf(T.char, bytes.length + 1), loc: this.loc(t) };
      }
      if (t.t === 'id') {
        if (TYPE_KW.has(t.v)) this.fail('"' + t.v + '" cannot start an expression here.', t);
        this.next();
        if (this.enumConsts.has(t.v)) return { k: 'num', v: this.enumConsts.get(t.v), t: T.int, enumName: t.v, loc: this.loc(t) };
        if (t.v === '__func__' || t.v === '__FUNCTION__') {
          const nm = (this.curFn && this.curFn.name) || '';
          return { k: 'str', bytes: unescape(nm), t: arrOf(T.char, nm.length + 1), loc: this.loc(t) };
        }
        if (t.v === '__LINE__') return { k: 'num', v: t.l, t: T.int, loc: this.loc(t) };
        return { k: 'id', name: t.v, loc: this.loc(t) };
      }
      if (t.t === 'op' && t.v === '(') {
        this.next();
        if (this.is('{')) {   // gcc's statement expression -- not supported, said plainly
          this.fail('The stack window cannot follow ({ ... }) expressions.', t);
        }
        const e = this.expr();
        this.expect(')', 'to close this (');
        return e;
      }
      if (t.t === 'eof') this.fail('The code ends in the middle of an expression.', this.prevTok());
      this.fail('Expected a value here, found "' + t.v + '".', t);
    }

    /* ── The whole program ── */
    program() {
      while (this.t.t !== 'eof') {
        if (this.accept(';')) continue;
        const st = this.t;
        const d = this.declaration(true);
        if (!d) {
          if (this.t.t === 'id' && this.peek(1).v === '(') {
            // An old-style "main() { ... }": int is implied.
            const d2 = this.declarator(T.int, false);
            if (this.is('{')) { this.funcDef({ storage: null, spell: 'int' }, d2, st); continue; }
          }
          this.fail('Expected a declaration or a function here, found "' + this.t.v + '".');
        }
        if (d.k === 'decl') this.globals.push(d);
      }
      return {
        funcs: this.funcs, globals: this.globals, protos: this.protos, tags: this.tags,
        enumConsts: this.enumConsts, stmts: this.allStmts
      };
    }
  }

  function spellOf(sp, d) {
    if (!sp.spell) return null;
    // "List" for List x, "List *" for List *x, "studtype[ARR_LENGTH]" for an array.
    if ((d.suffixes || []).some(s => s.fn)) return null;
    let s = sp.spell;
    for (let k = 0; k < (d.ptrs || 0); k++) s += k ? '*' : ' *';
    for (const sf of d.suffixes || []) s += '[' + (sf.nName || (sf.n == null ? '' : sf.n)) + ']';
    return s;
  }

  function layoutStruct(st, members) {
    let off = 0, size = 0, align = 1;
    const flat = [];
    for (const m of members) {
      const a = alignOf(m.type);
      const s = sizeOf(m.type);
      if (a > align) align = a;
      if (st.union) { m.off = 0; if (s > size) size = s; }
      else { off = alignUp(off, a); m.off = off; off += s; size = off; }
      if (m.anon) {
        // Its fields become this struct's, at their offsets plus its own.
        m.type.members.forEach(x => flat.push(Object.assign({}, x, { off: x.off + m.off })));
      } else flat.push(m);
    }
    st.members = flat;
    st.align = align;
    st.size = alignUp(Math.max(size, 0), align) || 0;
    st.complete = true;
  }

  /* Integer literals keep C's type rules: the first of int, long that holds
     the value (unsigned for a u suffix or a hex value that needs it). */
  function parseNumber(t, p) {
    let s = t.v;
    const isHex = /^0[xX]/.test(s);
    if (!isHex && /[.eE]/.test(s) || isHex && /[pP]/.test(s)) {
      const isF = /[fF]$/.test(s);
      s = s.replace(/[fFlL]$/, '');
      const v = Number(s);
      if (Number.isNaN(v) && !isHex) p.fail('"' + t.v + '" is not a number C can read.', t);
      return { k: 'num', v: isF ? Math.fround(v) : v, t: isF ? T.float : T.double };
    }
    const m = /^(0[xX][0-9a-fA-F]+|0[bB][01]+|0[0-7]*|[1-9][0-9]*)([uUlL]*)$/.exec(s);
    if (!m) p.fail('"' + t.v + '" is not a number C can read' + (/^0[0-9]+$/.test(s) ? ' (a leading 0 means octal, so 8 and 9 are not allowed)' : '') + '.', t);
    let digits = m[1];
    let big;
    if (/^0[bB]/.test(digits)) big = BigInt('0b' + digits.slice(2));
    else if (/^0[xX]/.test(digits)) big = BigInt(digits);
    else if (digits.length > 1 && digits[0] === '0') big = BigInt('0o' + digits.slice(1));
    else big = BigInt(digits);
    const suf = m[2].toLowerCase();
    const u = suf.indexOf('u') !== -1;
    const longs = (suf.match(/l/g) || []).length;
    let ty;
    const decimal = !(/^0/.test(digits) && digits.length > 1);
    if (!longs) {
      if (!u && big <= 2147483647n) ty = T.int;
      else if ((u || !decimal) && big <= 4294967295n) ty = T.uint;
      else if (!u && big <= 9223372036854775807n) ty = T.long;
      else ty = T.ulong;
    } else {
      if (!u && big <= 9223372036854775807n) ty = longs === 2 ? T.llong : T.long;
      else ty = longs === 2 ? T.ullong : T.ulong;
    }
    if (big > 18446744073709551615n) p.fail('"' + t.v + '" is too big for any C integer.', t);
    return { k: 'num', v: ty.size === 8 ? BigInt.asIntN(64, big) : Number(big), t: ty };
  }

  /* A constant expression, or null when it is not one (a runtime array size). */
  function constEval(e, p) {
    if (!e) return null;
    switch (e.k) {
      case 'num': return typeof e.v === 'bigint' ? Number(e.v) : e.v;
      case 'un': {
        const a = constEval(e.a, p);
        if (a == null) return null;
        switch (e.op) { case '-': return -a; case '+': return a; case '~': return ~a; case '!': return a ? 0 : 1; }
        return null;
      }
      case 'bin': {
        const a = constEval(e.a, p);
        if (a == null) return null;
        if (e.op === '&&') { if (!a) return 0; const b = constEval(e.b, p); return b == null ? null : (b ? 1 : 0); }
        if (e.op === '||') { if (a) return 1; const b = constEval(e.b, p); return b == null ? null : (b ? 1 : 0); }
        const b = constEval(e.b, p);
        if (b == null) return null;
        const fl = !Number.isInteger(a) || !Number.isInteger(b);
        switch (e.op) {
          case '+': return a + b; case '-': return a - b; case '*': return a * b;
          case '/': return b === 0 ? null : (fl ? a / b : Math.trunc(a / b));
          case '%': return b === 0 ? null : a % b;
          case '<<': return a * Math.pow(2, b); case '>>': return Math.floor(a / Math.pow(2, b));
          case '<': return a < b ? 1 : 0; case '>': return a > b ? 1 : 0;
          case '<=': return a <= b ? 1 : 0; case '>=': return a >= b ? 1 : 0;
          case '==': return a === b ? 1 : 0; case '!=': return a !== b ? 1 : 0;
          case '&': return a & b; case '|': return a | b; case '^': return a ^ b;
        }
        return null;
      }
      case 'cond': { const c = constEval(e.c, p); if (c == null) return null; return constEval(c ? e.a : e.b, p); }
      case 'cast': { const a = constEval(e.a, p); if (a == null) return null; return isInt(e.t) ? Math.trunc(a) : a; }
      case 'sizeof_t': return sizeOf(e.t);
      case 'alignof_t': return alignOf(e.t);
      case 'sizeof_e': {
        // sizeof of a literal, or of a variable whose type is known here.
        if (e.a.k === 'str') return e.a.bytes.length + 1;
        if (e.a.k === 'num') return e.a.t.size;
        return null;
      }
      case 'comma': return constEval(e.b, p);
    }
    return null;
  }

  /* files: [{ name: 'main.c', code }] -- the main file is the one that
     defines main() (else the first). Throws CError for code that cannot be
     read; the window then keeps the last picture that could be drawn. */
  function parseProgram(files) {
    let mainIdx = files.findIndex(fl => /^[\t ]*(?:int|void)\s+main\s*\(/m.test(fl.code || '') && /\.c$/i.test(fl.name || 'main.c'));
    if (mainIdx === -1) mainIdx = files.findIndex(fl => /\bmain\s*\(/.test(fl.code || ''));
    if (mainIdx === -1) mainIdx = 0;
    const pp = preprocess(files, mainIdx);
    const p = new Parser(pp.tokens);
    const prog = p.program();
    prog.mainIdx = mainIdx;
    prog.files = files;
    return prog;
  }

  CVM.lex = lex;
  CVM.unescape = unescape;
  CVM.preprocess = preprocess;
  CVM.Parser = Parser;
  CVM.parseProgram = parseProgram;
  CVM.constEval = constEval;
  CVM.layoutStruct = layoutStruct;

  if (typeof module !== 'undefined' && module.exports) module.exports = CVM;
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this));
