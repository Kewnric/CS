/* ============================================================
   TYPING-SYNTAX.JS — per-character highlighting for the
   Memorization Typing Library
   ------------------------------------------------------------
   The editor's syntaxHighlight() returns an HTML string for C. The typing
   screen needs something else: a class for EVERY character, because each
   character is its own span that flips between ghost, typed and wrong as you
   go. So this is a set of small scanners — C, HTML, CSS, JavaScript — that
   write a token name per index into an array, plus the pairs the auto-close
   option needs (which bracket closes which, which quote ends which string,
   which closing tag belongs to which opening one).

   Colours are VS Code's Dark+ and Light+ (see css/typing.css). Brackets get
   VS Code's pair colourisation: three colours cycling by depth.

   mtTokenize(src, lang) -> { cls: string[], pairs: Map<openIdx, [from, to)> }
   ============================================================ */

const MT_LANGS = [
  { key: 'c',    name: 'C',          short: 'C',    icon: 'file-code' },
  { key: 'html', name: 'HTML',       short: 'HTML', icon: 'code-xml' },
  { key: 'css',  name: 'CSS',        short: 'CSS',  icon: 'palette' },
  { key: 'js',   name: 'JavaScript', short: 'JS',   icon: 'braces' }
];

function mtLangMeta(key) {
  return MT_LANGS.find(l => l.key === key) || MT_LANGS[0];
}

const MT_C_CONTROL = new Set('if else for while do switch case break continue return goto default'.split(' '));
const MT_C_STORAGE = new Set(('int char float double void long short signed unsigned struct union enum typedef ' +
  'const static extern volatile register inline auto sizeof restrict _Bool bool _Atomic _Noreturn ' +
  '_Thread_local _Alignas _Alignof _Static_assert _Complex NULL true false').split(' '));
const MT_C_TYPES = new Set(('FILE size_t ssize_t ptrdiff_t wchar_t va_list time_t clock_t ' +
  'div_t ldiv_t fpos_t jmp_buf sig_atomic_t intptr_t uintptr_t intmax_t uintmax_t').split(' '));

const MT_JS_CONTROL = new Set(('if else for while do switch case break continue return throw try catch finally ' +
  'import export from default as await yield with debugger').split(' '));
const MT_JS_STORAGE = new Set(('const let var function class extends new delete typeof instanceof in of void ' +
  'async static super this true false null undefined NaN Infinity').split(' '));

const MT_HTML_VOID = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));

function _mtIsIdStart(c) { return /[A-Za-z_$]/.test(c); }
function _mtIsId(c) { return /[\w$]/.test(c); }
function _mtIsDigit(c) { return c >= '0' && c <= '9'; }

/** A scanner's shared state: the source, the class array, and the pairs. */
function _mtCtx(src) {
  return {
    src: src,
    cls: new Array(src.length).fill(''),
    pairs: new Map(),
    brackets: []          // indices painted 'br', coloured by depth at the end
  };
}

function _mtPaint(ctx, from, to, name) {
  for (let i = from; i < to && i < ctx.cls.length; i++) ctx.cls[i] = name;
}

/** Where the next non-blank character is, or -1. */
function _mtPeekNonWs(src, i, end) {
  while (i < end && (src[i] === ' ' || src[i] === '\t')) i++;
  return i < end ? i : -1;
}

/**
 * A quoted string, from its opening quote. Escapes get their own colour and,
 * when `fmt` is set, so do printf-style specifiers. Returns the index after it.
 * A string closed on the line it opened on becomes a pair, so typing the
 * opening quote with auto-close on fills in the closing one.
 */
function _mtScanString(ctx, i, end, opts) {
  const src = ctx.src, q = src[i];
  const start = i;
  let j = i + 1;
  let closed = false;
  while (j < end) {
    const c = src[j];
    if (c === '\\' && j + 1 < end) { j += 2; continue; }
    if (c === q) { closed = true; j++; break; }
    if (c === '\n' && q !== '`') break;
    j++;
  }
  _mtPaint(ctx, start, j, (opts && opts.cls) || 'str');
  if (!opts || opts.inner !== false) {
    // escapes and format specifiers sit inside the string's own colour
    const body = src.slice(start, j);
    const esc = /\\(?:x[0-9a-fA-F]+|u[0-9a-fA-F]{4}|u\{[0-9a-fA-F]+\}|[0-7]{1,3}|.)/g;
    let m;
    while ((m = esc.exec(body))) _mtPaint(ctx, start + m.index, start + m.index + m[0].length, 'esc');
    if (opts && opts.fmt && q === '"') {
      const fmt = /%[-+ #0']*(?:\d+|\*)?(?:\.(?:\d+|\*))?(?:hh|h|ll|l|L|j|z|t)?[diouxXeEfFgGaAcspn%]/g;
      while ((m = fmt.exec(body))) _mtPaint(ctx, start + m.index, start + m.index + m[0].length, 'fmt');
    }
  }
  if (closed && j - start >= 2) ctx.pairs.set(start, [j - 1, j]);
  return j;
}

function _mtScanBlockComment(ctx, i, end) {
  let j = ctx.src.indexOf('*/', i + 2);
  j = (j < 0 || j >= end) ? end : j + 2;
  _mtPaint(ctx, i, j, 'com');
  return j;
}

function _mtScanLineComment(ctx, i, end) {
  let j = ctx.src.indexOf('\n', i);
  if (j < 0 || j > end) j = end;
  _mtPaint(ctx, i, j, 'com');
  return j;
}

/** C-family and JS number literals, suffixes included. */
function _mtScanNumber(ctx, i, end, js) {
  const rest = ctx.src.slice(i, Math.min(end, i + 80));
  const re = js
    ? /^(?:0[xX][0-9a-fA-F_]+n?|0[bB][01_]+n?|0[oO][0-7_]+n?|(?:\d[\d_]*\.?[\d_]*|\.\d[\d_]*)(?:[eE][+-]?\d+)?n?)/
    : /^(?:0[xX][0-9a-fA-F]+[uUlL]*|0[bB][01]+[uUlL]*|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?[fFlLuU]*)/;
  const m = re.exec(rest);
  const len = m ? Math.max(1, m[0].length) : 1;
  _mtPaint(ctx, i, i + len, 'num');
  return i + len;
}

function _mtMarkBracket(ctx, i) {
  ctx.cls[i] = 'br';
  ctx.brackets.push(i);
}

/* ── C ──────────────────────────────────────────────────────── */

function _mtScanC(ctx, start, end) {
  const src = ctx.src;
  // Names the program introduces as types: struct tags and typedef names.
  const userTypes = new Set();
  const seg = src.slice(start, end);
  let m;
  const tag = /\b(?:struct|union|enum)\s+([A-Za-z_]\w*)/g;
  while ((m = tag.exec(seg))) userTypes.add(m[1]);
  const td = /\btypedef\b[^;{]*?([A-Za-z_]\w*)\s*;/g;
  while ((m = td.exec(seg))) userTypes.add(m[1]);
  const close = /\}\s*([A-Za-z_]\w*)\s*;/g;
  while ((m = close.exec(seg))) userTypes.add(m[1]);

  let i = start, lineStart = true, prevWord = '';
  while (i < end) {
    const c = src[i];
    if (c === '\n') { lineStart = true; i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }

    if (lineStart && c === '#') { i = _mtScanCPreproc(ctx, i, end); lineStart = true; continue; }
    lineStart = false;

    if (c === '/' && src[i + 1] === '/') { i = _mtScanLineComment(ctx, i, end); continue; }
    if (c === '/' && src[i + 1] === '*') { i = _mtScanBlockComment(ctx, i, end); continue; }
    if (c === '"' || c === "'") { i = _mtScanString(ctx, i, end, { fmt: true }); prevWord = ''; continue; }
    if (_mtIsDigit(c) || (c === '.' && _mtIsDigit(src[i + 1] || ''))) { i = _mtScanNumber(ctx, i, end, false); prevWord = ''; continue; }

    if (_mtIsIdStart(c)) {
      let j = i + 1;
      while (j < end && /\w/.test(src[j])) j++;
      const w = src.slice(i, j);
      const next = _mtPeekNonWs(src, j, end);
      let name;
      if (MT_C_CONTROL.has(w)) name = 'kw';
      else if (MT_C_STORAGE.has(w)) name = 'st';
      else if (next >= 0 && src[next] === '(') name = 'fn';
      else if (prevWord === 'struct' || prevWord === 'union' || prevWord === 'enum') name = 'type';
      else if (userTypes.has(w) || MT_C_TYPES.has(w) || /_t$/.test(w)) name = 'type';
      else if (/^[A-Z][A-Z0-9_]+$/.test(w)) name = 'const';
      else name = 'var';
      _mtPaint(ctx, i, j, name);
      prevWord = w;
      i = j;
      continue;
    }

    if ('{}()[]'.indexOf(c) !== -1) { _mtMarkBracket(ctx, i); prevWord = ''; i++; continue; }
    ctx.cls[i] = (c === ';' || c === ',') ? 'punc' : 'op';
    prevWord = '';
    i++;
  }
}

/** One preprocessor line (and its backslash continuations). */
function _mtScanCPreproc(ctx, i, end) {
  const src = ctx.src;
  // the line's real end, following continuations
  let lineEnd = i;
  while (lineEnd < end) {
    if (src[lineEnd] === '\n') {
      let k = lineEnd - 1;
      while (k > i && (src[k] === ' ' || src[k] === '\t')) k--;
      if (src[k] === '\\') { lineEnd++; continue; }
      break;
    }
    lineEnd++;
  }
  let j = i + 1;
  while (j < lineEnd && (src[j] === ' ' || src[j] === '\t')) j++;
  let k = j;
  while (k < lineEnd && /\w/.test(src[k])) k++;
  const directive = src.slice(j, k);
  _mtPaint(ctx, i, k, 'pp');
  // blank out the spaces between # and the word so they stay uncoloured
  for (let s = i + 1; s < j; s++) ctx.cls[s] = '';
  let p = _mtPeekNonWs(src, k, lineEnd);
  if (p < 0) return lineEnd;
  if (directive === 'include' || directive === 'import') {
    if (src[p] === '<') {
      let q = src.indexOf('>', p);
      if (q < 0 || q > lineEnd) q = lineEnd - 1;
      _mtPaint(ctx, p, q + 1, 'hdr');
      ctx.pairs.set(p, [q, q + 1]);
      p = q + 1;
    } else if (src[p] === '"') {
      p = _mtScanString(ctx, p, lineEnd, { cls: 'hdr', inner: false });
    }
    // anything after (usually a comment)
    _mtScanC(ctx, p, lineEnd);
    return lineEnd;
  }
  if (directive === 'define' || directive === 'undef' || directive === 'ifdef' || directive === 'ifndef') {
    let q = p;
    while (q < lineEnd && /\w/.test(src[q])) q++;
    _mtPaint(ctx, p, q, src[q] === '(' ? 'fn' : 'const');
    p = q;
  }
  _mtScanC(ctx, p, lineEnd);
  return lineEnd;
}

/* ── JavaScript ─────────────────────────────────────────────── */

/**
 * JS from `start` to `end`. Stops early at an unmatched `}` when `stopAtBrace`
 * is set, which is how a template literal's ${ … } hands control back.
 */
function _mtScanJS(ctx, start, end, stopAtBrace) {
  const src = ctx.src;
  let i = start;
  let depth = 0;
  // what came last, for telling a regex from a division
  let last = '';          // 'id' | 'num' | 'close' | 'op' | 'kw' | ''
  let prevWord = '';
  let afterDot = false;
  while (i < end) {
    const c = src[i];
    if (c === '\n' || c === ' ' || c === '\t' || c === '\r') { i++; continue; }

    if (c === '/' && src[i + 1] === '/') { i = _mtScanLineComment(ctx, i, end); continue; }
    if (c === '/' && src[i + 1] === '*') { i = _mtScanBlockComment(ctx, i, end); continue; }

    if (c === '"' || c === "'") { i = _mtScanString(ctx, i, end); last = 'num'; afterDot = false; continue; }
    if (c === '`') { i = _mtScanTemplate(ctx, i, end); last = 'num'; afterDot = false; continue; }

    if (c === '/' && (last === '' || last === 'op' || last === 'kw')) {
      const j = _mtScanRegex(ctx, i, end);
      if (j > i) { i = j; last = 'num'; continue; }
    }

    if (_mtIsDigit(c) || (c === '.' && _mtIsDigit(src[i + 1] || ''))) {
      i = _mtScanNumber(ctx, i, end, true); last = 'num'; afterDot = false; continue;
    }

    if (_mtIsIdStart(c)) {
      let j = i + 1;
      while (j < end && _mtIsId(src[j])) j++;
      const w = src.slice(i, j);
      const next = _mtPeekNonWs(src, j, end);
      const callsNext = next >= 0 && src[next] === '(';
      let name;
      if (afterDot) name = callsNext ? 'fn' : 'var';
      else if (MT_JS_CONTROL.has(w)) name = 'kw';
      else if (MT_JS_STORAGE.has(w)) name = 'st';
      else if (prevWord === 'function') name = 'fn';
      else if (prevWord === 'class' || prevWord === 'extends' || prevWord === 'new' || prevWord === 'instanceof') name = 'type';
      else if (callsNext) name = /^[A-Z]/.test(w) && /[a-z]/.test(w) ? 'type' : 'fn';
      else if (/^[A-Z][A-Z0-9_]+$/.test(w)) name = 'const';
      else if (/^[A-Z]/.test(w)) name = 'type';
      else name = 'var';
      _mtPaint(ctx, i, j, name);
      last = (name === 'kw' || (name === 'st' && !/^(this|true|false|null|undefined|NaN|Infinity|super)$/.test(w))) ? 'kw' : 'id';
      prevWord = w;
      afterDot = false;
      i = j;
      continue;
    }

    if (c === '=' && src[i + 1] === '>') { _mtPaint(ctx, i, i + 2, 'st'); i += 2; last = 'op'; prevWord = ''; afterDot = false; continue; }

    if ('{}()[]'.indexOf(c) !== -1) {
      if (c === '{') depth++;
      if (c === '}') {
        if (depth === 0 && stopAtBrace) return i;
        depth--;
      }
      _mtMarkBracket(ctx, i);
      last = (c === ')' || c === ']' || c === '}') ? 'close' : 'op';
      prevWord = '';
      afterDot = false;
      i++;
      continue;
    }

    if (c === '.' && src[i + 1] !== '.') { ctx.cls[i] = 'punc'; afterDot = true; last = 'op'; i++; continue; }
    if (c === '?' && src[i + 1] === '.') { _mtPaint(ctx, i, i + 2, 'punc'); afterDot = true; last = 'op'; i += 2; continue; }
    ctx.cls[i] = (c === ';' || c === ',' || c === ':') ? 'punc' : 'op';
    last = 'op';
    prevWord = '';
    afterDot = false;
    i++;
  }
  return i;
}

function _mtScanTemplate(ctx, i, end) {
  const src = ctx.src;
  const start = i;
  let j = i + 1;
  let closed = false;
  ctx.cls[i] = 'str';
  while (j < end) {
    const c = src[j];
    if (c === '\\' && j + 1 < end) { _mtPaint(ctx, j, j + 2, 'esc'); j += 2; continue; }
    if (c === '`') { ctx.cls[j] = 'str'; closed = true; j++; break; }
    if (c === '$' && src[j + 1] === '{') {
      _mtPaint(ctx, j, j + 2, 'tpl');
      const open = j + 1;
      const k = _mtScanJS(ctx, j + 2, end, true);
      if (k < end && src[k] === '}') {
        ctx.cls[k] = 'tpl';
        ctx.pairs.set(open, [k, k + 1]);
        j = k + 1;
      } else { j = k; }
      continue;
    }
    ctx.cls[j] = 'str';
    j++;
  }
  if (closed) ctx.pairs.set(start, [j - 1, j]);
  return j;
}

/** A regex literal from its opening slash, or `i` back if it is not one. */
function _mtScanRegex(ctx, i, end) {
  const src = ctx.src;
  let j = i + 1, inClass = false;
  while (j < end) {
    const c = src[j];
    if (c === '\n') return i;
    if (c === '\\') { j += 2; continue; }
    if (c === '[') inClass = true;
    else if (c === ']') inClass = false;
    else if (c === '/' && !inClass) break;
    j++;
  }
  if (j >= end || j === i + 1) return i;
  j++;
  while (j < end && /[a-z]/.test(src[j])) j++;
  _mtPaint(ctx, i, j, 'rx');
  return j;
}

/* ── CSS ────────────────────────────────────────────────────── */

function _mtScanCSS(ctx, start, end) {
  const src = ctx.src;
  // 'rules' = selectors expected; 'decl' = property: value; 'frames' = keyframe selectors
  const stack = ['rules'];
  let i = start;
  let pendingAt = '';
  while (i < end) {
    const c = src[i];
    if (c === '\n' || c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i = _mtScanBlockComment(ctx, i, end); continue; }
    const top = stack[stack.length - 1];

    if (c === '}') { _mtMarkBracket(ctx, i); if (stack.length > 1) stack.pop(); i++; continue; }

    if (top === 'decl') {
      if (c === ';') { ctx.cls[i] = 'punc'; i++; continue; }
      if (c === '{') { _mtMarkBracket(ctx, i); stack.push('decl'); i++; continue; }
      // A nested rule (CSS nesting) starts with something no property can
      // start with, and reaches its `{` before any `;` or `}`.
      if ('&.#:[>+~*'.indexOf(c) !== -1) {
        let k = i;
        while (k < end && src[k] !== '{' && src[k] !== ';' && src[k] !== '}') k++;
        if (src[k] === '{') { i = _mtScanSelector(ctx, i, end); continue; }
      }
      i = _mtScanDeclaration(ctx, i, end);
      continue;
    }

    if (c === '@') {
      let j = i + 1;
      while (j < end && /[\w-]/.test(src[j])) j++;
      _mtPaint(ctx, i, j, 'at');
      pendingAt = src.slice(i + 1, j).toLowerCase();
      i = _mtScanAtPrelude(ctx, j, end);
      if (src[i] === '{') {
        _mtMarkBracket(ctx, i);
        if (/keyframes$/.test(pendingAt)) stack.push('frames');
        else if (/^(media|supports|document|container|layer|scope|starting-style)$/.test(pendingAt)) stack.push('rules');
        else stack.push('decl');
        i++;
      } else if (src[i] === ';') { ctx.cls[i] = 'punc'; i++; }
      pendingAt = '';
      continue;
    }

    // a selector (or a keyframe stop) up to its block
    i = _mtScanSelector(ctx, i, end, top === 'frames');
    if (src[i] === '{') { _mtMarkBracket(ctx, i); stack.push('decl'); i++; }
    else if (i < end && src[i] !== '}') i++;
  }
}

function _mtScanSelector(ctx, i, end, frames) {
  const src = ctx.src;
  while (i < end && src[i] !== '{' && src[i] !== '}') {
    const c = src[i];
    if (c === '/' && src[i + 1] === '*') { i = _mtScanBlockComment(ctx, i, end); continue; }
    if (c === '"' || c === "'") { i = _mtScanString(ctx, i, end); continue; }
    if (c === ' ' || c === '\n' || c === '\t' || c === '\r') { i++; continue; }
    if (c === ',' || c === '>' || c === '+' || c === '~') { ctx.cls[i] = 'punc'; i++; continue; }
    if (c === '[') {
      _mtMarkBracket(ctx, i);
      let j = i + 1;
      while (j < end && src[j] !== ']' && src[j] !== '{') {
        const d = src[j];
        if (d === '"' || d === "'") { j = _mtScanString(ctx, j, end); continue; }
        ctx.cls[j] = /[\w-]/.test(d) ? 'attr' : 'op';
        j++;
      }
      if (src[j] === ']') { _mtMarkBracket(ctx, j); j++; }
      i = j;
      continue;
    }
    if (c === '(' || c === ')') { _mtMarkBracket(ctx, i); i++; continue; }
    if (frames && (_mtIsDigit(c))) {
      let j = i;
      while (j < end && /[\d.%]/.test(src[j])) j++;
      _mtPaint(ctx, i, j, 'num');
      i = j;
      continue;
    }
    ctx.cls[i] = 'sel';
    i++;
  }
  return i;
}

function _mtScanAtPrelude(ctx, i, end) {
  const src = ctx.src;
  while (i < end && src[i] !== '{' && src[i] !== ';' && src[i] !== '}') {
    const c = src[i];
    if (c === ' ' || c === '\n' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '"' || c === "'") { i = _mtScanString(ctx, i, end); continue; }
    if (c === '(' || c === ')') { _mtMarkBracket(ctx, i); i++; continue; }
    if (_mtIsDigit(c) || (c === '.' && _mtIsDigit(src[i + 1] || ''))) {
      let j = i;
      while (j < end && /[\d.]/.test(src[j])) j++;
      while (j < end && /[a-z%]/i.test(src[j])) j++;
      _mtPaint(ctx, i, j, 'num');
      i = j;
      continue;
    }
    if (/[\w-]/.test(c)) {
      let j = i;
      while (j < end && /[\w-]/.test(src[j])) j++;
      const w = src.slice(i, j);
      const next = _mtPeekNonWs(src, j, end);
      let name = 'cssval';
      if (/^(and|not|only|or)$/.test(w)) name = 'st';
      else if (next >= 0 && src[next] === ':') name = 'prop';
      else if (next >= 0 && src[next] === '(') name = 'fn';
      _mtPaint(ctx, i, j, name);
      i = j;
      continue;
    }
    ctx.cls[i] = (c === ',' || c === ':') ? 'punc' : 'op';
    i++;
  }
  return i;
}

/** One `property: value` up to (not including) its `;` or `}`. */
function _mtScanDeclaration(ctx, i, end) {
  const src = ctx.src;
  // the property name
  let j = i;
  while (j < end && /[\w-]/.test(src[j])) j++;
  if (j === i) { ctx.cls[i] = 'op'; return i + 1; }
  _mtPaint(ctx, i, j, src.slice(i, i + 2) === '--' ? 'var' : 'prop');
  i = j;
  while (i < end && (src[i] === ' ' || src[i] === '\t')) i++;
  if (src[i] !== ':') return i;
  ctx.cls[i] = 'punc';
  i++;
  return _mtScanValue(ctx, i, end);
}

function _mtScanValue(ctx, i, end) {
  const src = ctx.src;
  let parens = 0;
  while (i < end) {
    const c = src[i];
    if ((c === ';' || c === '}') && parens === 0) return i;
    if (c === ' ' || c === '\n' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i = _mtScanBlockComment(ctx, i, end); continue; }
    if (c === '"' || c === "'") { i = _mtScanString(ctx, i, end); continue; }
    if (c === '(') { parens++; _mtMarkBracket(ctx, i); i++; continue; }
    if (c === ')') { parens = Math.max(0, parens - 1); _mtMarkBracket(ctx, i); i++; continue; }
    if (c === '!') {
      let j = i + 1;
      while (j < end && /[a-z]/i.test(src[j])) j++;
      _mtPaint(ctx, i, j, 'imp');
      i = j;
      continue;
    }
    if (c === '#') {
      let j = i + 1;
      while (j < end && /[0-9a-fA-F]/.test(src[j])) j++;
      _mtPaint(ctx, i, j, 'cssval');
      i = j;
      continue;
    }
    if (_mtIsDigit(c) || ((c === '.' || c === '-' || c === '+') && /[\d.]/.test(src[i + 1] || '') && (c !== '.' || _mtIsDigit(src[i + 1] || '')))) {
      let j = i + 1;
      while (j < end && /[\d.eE]/.test(src[j])) j++;
      while (j < end && /[a-zA-Z%]/.test(src[j])) j++;
      _mtPaint(ctx, i, j, 'num');
      i = j;
      continue;
    }
    if (/[\w-]/.test(c)) {
      let j = i;
      while (j < end && /[\w-]/.test(src[j])) j++;
      const w = src.slice(i, j);
      if (src[j] === '(') {
        _mtPaint(ctx, i, j, 'fn');
        // url(...) without quotes is a string
        if (w.toLowerCase() === 'url' && src[j + 1] !== '"' && src[j + 1] !== "'") {
          const close = src.indexOf(')', j);
          if (close > -1 && close < end) {
            _mtMarkBracket(ctx, j);
            _mtPaint(ctx, j + 1, close, 'str');
            _mtMarkBracket(ctx, close);
            i = close + 1;
            continue;
          }
        }
      } else {
        _mtPaint(ctx, i, j, w.slice(0, 2) === '--' ? 'var' : 'cssval');
      }
      i = j;
      continue;
    }
    ctx.cls[i] = (c === ',' || c === '/') ? 'punc' : 'op';
    i++;
  }
  return i;
}

/* ── HTML ───────────────────────────────────────────────────── */

function _mtScanHTML(ctx, start, end) {
  const src = ctx.src;
  const open = [];   // { name, gt }
  let i = start;
  while (i < end) {
    const c = src[i];
    if (c === '<' && src.startsWith('<!--', i)) {
      let j = src.indexOf('-->', i + 4);
      j = (j < 0 || j >= end) ? end : j + 3;
      _mtPaint(ctx, i, j, 'com');
      i = j;
      continue;
    }
    if (c === '<' && src[i + 1] === '!') {
      // <!DOCTYPE html>
      _mtPaint(ctx, i, i + 2, 'tagp');
      let j = i + 2;
      let k = j;
      while (k < end && /[A-Za-z]/.test(src[k])) k++;
      _mtPaint(ctx, j, k, 'st');
      j = k;
      while (j < end && src[j] !== '>') {
        if (/[\w-]/.test(src[j])) ctx.cls[j] = 'attr';
        j++;
      }
      if (j < end) { ctx.cls[j] = 'tagp'; j++; }
      i = j;
      continue;
    }
    if (c === '<' && /[A-Za-z\/]/.test(src[i + 1] || '')) {
      const closing = src[i + 1] === '/';
      const lt = i;
      _mtPaint(ctx, i, i + (closing ? 2 : 1), 'tagp');
      let j = i + (closing ? 2 : 1);
      let k = j;
      while (k < end && /[\w:-]/.test(src[k])) k++;
      const name = src.slice(j, k).toLowerCase();
      _mtPaint(ctx, j, k, 'tag');
      j = k;
      let selfClose = false;
      while (j < end && src[j] !== '>') {
        const d = src[j];
        if (d === ' ' || d === '\n' || d === '\t' || d === '\r') { j++; continue; }
        if (d === '/' && src[j + 1] === '>') { ctx.cls[j] = 'tagp'; selfClose = true; j++; continue; }
        if (d === '=') { ctx.cls[j] = 'punc'; j++; continue; }
        if (d === '"' || d === "'") { j = _mtScanString(ctx, j, end, { inner: false }); continue; }
        if (d === '<') break;   // a broken tag; let the next one start fresh
        // an attribute name, or an unquoted value right after '='
        let a = j;
        while (a < end && !/[\s=>"'<]/.test(src[a]) && !(src[a] === '/' && src[a + 1] === '>')) a++;
        if (a === j) { j++; continue; }
        let p = j - 1;
        while (p > lt && /\s/.test(src[p])) p--;
        _mtPaint(ctx, j, a, src[p] === '=' ? 'str' : 'attr');
        j = a;
      }
      if (j < end && src[j] === '>') { ctx.cls[j] = 'tagp'; }
      const gt = j;
      i = j < end && src[j] === '>' ? j + 1 : j;

      if (closing) {
        // pair it with the nearest open element of the same name
        for (let o = open.length - 1; o >= 0; o--) {
          if (open[o].name === name) {
            if (gt < end) ctx.pairs.set(open[o].gt, [lt, gt + 1]);
            open.length = o;
            break;
          }
        }
        continue;
      }
      if (selfClose || MT_HTML_VOID.has(name) || gt >= end) continue;

      if (name === 'script' || name === 'style') {
        const re = new RegExp('</' + name + '\\s*>', 'i');
        const rest = src.slice(i, end);
        const m = re.exec(rest);
        const bodyEnd = m ? i + m.index : end;
        if (name === 'script') _mtScanJS(ctx, i, bodyEnd, false);
        else _mtScanCSS(ctx, i, bodyEnd);
        open.push({ name, gt });
        i = bodyEnd;
        continue;
      }
      open.push({ name, gt });
      continue;
    }
    if (c === '&') {
      const m = /^&(?:#\d+|#x[0-9a-fA-F]+|[A-Za-z]\w*);/.exec(src.slice(i, i + 16));
      if (m) { _mtPaint(ctx, i, i + m[0].length, 'ent'); i += m[0].length; continue; }
    }
    // plain text
    i++;
  }
}

/* ── Public ─────────────────────────────────────────────────── */

/**
 * Classes per character and the auto-close pairs.
 * Bracket depth colouring runs last, over every bracket any scanner marked,
 * so brackets inside HTML's <script> and <style> join one sequence.
 */
function mtTokenize(src, lang) {
  const ctx = _mtCtx(String(src || ''));
  const n = ctx.src.length;
  if (lang === 'html') _mtScanHTML(ctx, 0, n);
  else if (lang === 'css') _mtScanCSS(ctx, 0, n);
  else if (lang === 'js') _mtScanJS(ctx, 0, n, false);
  else _mtScanC(ctx, 0, n);

  const stack = [];
  const match = { ')': '(', ']': '[', '}': '{' };
  ctx.brackets.sort((a, b) => a - b).forEach(i => {
    const ch = ctx.src[i];
    if (ch === '(' || ch === '[' || ch === '{') {
      ctx.cls[i] = 'br' + (stack.length % 3);
      stack.push(i);
    } else {
      // pop to the nearest matching opener; an unmatched closer is flagged
      let k = stack.length - 1;
      while (k >= 0 && ctx.src[stack[k]] !== match[ch]) k--;
      if (k < 0) { ctx.cls[i] = 'brx'; return; }
      const o = stack[k];
      stack.length = k;
      ctx.cls[i] = 'br' + (k % 3);
      ctx.pairs.set(o, [i, i + 1]);
    }
  });
  stack.forEach(o => { ctx.cls[o] = 'brx'; });
  return { cls: ctx.cls, pairs: ctx.pairs };
}

/**
 * Which of the four languages a piece of text looks like, or null for prose.
 * Only used to point out code saved as Text — it never changes an entry.
 */
function mtGuessLang(src) {
  const s = String(src || '');
  if (s.trim().length < 8) return null;
  if (/^\s*#\s*(include|define)\b/m.test(s) || /\b(int|void|char)\s+main\s*\(/.test(s) || /\b(printf|scanf)\s*\(/.test(s)) return 'c';
  if (/<!DOCTYPE html/i.test(s) || /<\/(html|head|body|div|span|p|a|ul|ol|li|h[1-6]|section|form|button|table|td|tr)>/i.test(s)) return 'html';
  if (/\bfunction\s*\w*\s*\(|\b(const|let|var)\s+\w+\s*=|=>|console\.log|document\.\w/.test(s)) return 'js';
  if (/[\w\]\)*-]\s*\{[^{}]*[\w-]+\s*:\s*[^;{}]+;[^{}]*\}/.test(s)) return 'css';
  if (/;\s*$/m.test(s) && /[{}]/.test(s)) return 'c';
  return null;
}

/** Highlighted HTML for a read-only preview: runs of one class become one span. */
function mtHighlightHTML(src, lang) {
  const text = String(src || '');
  const { cls } = mtTokenize(text, lang);
  let out = '', run = '', cur = null;
  const flush = () => {
    if (!run) return;
    const esc = run.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    out += cur ? `<span class="tk-${cur}">${esc}</span>` : esc;
    run = '';
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i] === '\n' || text[i] === ' ' || text[i] === '\t' ? '' : cls[i];
    if (c !== cur && text[i] !== ' ' && text[i] !== '\n' && text[i] !== '\t') { flush(); cur = c; }
    run += text[i];
  }
  flush();
  return out;
}
