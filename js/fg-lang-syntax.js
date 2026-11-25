/* ============================================================
   FG-LANG-SYNTAX.JS — colouring for Freeground's other languages
   ------------------------------------------------------------
   syntax.js paints C. A Freeground tab can also hold JavaScript, HTML
   (with CSS and JS inside it, or beside it in their own files) and 8086
   assembly, so the editor asks edHighlight (syntax.js), which hands any
   file that is not .c/.h to fgLangHighlight here, by its extension.

   Every painter returns the text unchanged apart from <span>s and the
   three escapes (& < >): the editor lays this HTML exactly over the
   textarea, so one moved character would put every caret after it in the
   wrong place. The spans are the C painter's classes (css/editor.css), so
   the themes colour these too and nothing new is styled.
   No DOM; node tools/test-fg-run.js checks them.
   ============================================================ */

function _fgHlEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function _fgHlSpan(cls, text) {
  return text ? '<span class="syntax-' + cls + '">' + _fgHlEsc(text) + '</span>' : '';
}

/**
 * Paint `code` with one global regex: `classify(match)` names the class for
 * each match (or '' to leave it plain). Text between matches stays plain.
 */
function _fgHlScan(code, re, classify) {
  const s = String(code == null ? '' : code);
  let out = '', last = 0, m;
  re.lastIndex = 0;
  while ((m = re.exec(s))) {
    if (!m[0]) { re.lastIndex++; continue; }
    out += _fgHlEsc(s.slice(last, m.index));
    const cls = classify(m, s);
    out += cls ? _fgHlSpan(cls, m[0]) : _fgHlEsc(m[0]);
    last = m.index + m[0].length;
  }
  return out + _fgHlEsc(s.slice(last));
}

/* ── JavaScript ────────────────────────────────────────────── */

const FG_HL_JS_KW = new Set(('var let const function class extends new this super typeof instanceof in of delete void '
  + 'async await yield static get set import export from default null undefined true false NaN Infinity').split(' '));
const FG_HL_JS_CTRL = new Set('if else for while do switch case break continue return throw try catch finally'.split(' '));
const FG_HL_JS_GLOBALS = new Set(('console Math JSON Number String Boolean Array Object Date RegExp Map Set WeakMap Promise '
  + 'Symbol BigInt Error TypeError RangeError parseInt parseFloat isNaN isFinite prompt alert confirm document window '
  + 'setTimeout setInterval clearTimeout clearInterval process').split(' '));
const FG_HL_JS_RE = /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|("(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?|`(?:[^`\\]|\\[\s\S])*`?)|(\b0[xX][\da-fA-F_]+n?\b|\b0[bB][01_]+n?\b|(?:\b\d[\d_]*\.?\d*|\.\d+)(?:[eE][+-]?\d+)?n?\b)|([A-Za-z_$][\w$]*)|([{}()[\]])|([-+*/%=<>!&|^~?:]+)/g;

function fgHlJs(code) {
  return _fgHlScan(code, FG_HL_JS_RE, (m, s) => {
    if (m[1]) return 'comment';
    if (m[2]) return 'string';
    if (m[3]) return 'number';
    if (m[5]) return 'bracket';
    if (m[6]) return 'operator';
    const w = m[4];
    if (FG_HL_JS_CTRL.has(w)) return 'control';
    if (FG_HL_JS_KW.has(w)) return 'keyword';
    const before = s[m.index - 1];
    const after = s.slice(m.index + w.length).match(/^\s*(.)/);
    if (after && after[1] === '(') return 'function';
    if (before === '.') return 'var';
    if (FG_HL_JS_GLOBALS.has(w)) return 'stdlib';
    if (/^[A-Z]/.test(w)) return 'usertype';
    return 'var';
  });
}

/* ── CSS ───────────────────────────────────────────────────── */

const FG_HL_CSS_RE = /(\/\*[\s\S]*?(?:\*\/|$))|("(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?)|([{}])|(@[\w-]+)|(#[\da-fA-F]{3,8}\b)|(-?(?:\d+\.?\d*|\.\d+)(?:%|[a-zA-Z]+)?)|(!important)|(-?[A-Za-z_][\w-]*)|([:;,>+~()[\]=*.#])/g;

function fgHlCss(code) {
  let depth = 0;
  return _fgHlScan(code, FG_HL_CSS_RE, (m, s) => {
    if (m[1]) return 'comment';
    if (m[2]) return 'string';
    if (m[3]) { depth = m[3] === '{' ? depth + 1 : Math.max(0, depth - 1); return 'bracket'; }
    if (m[4]) return 'control';
    if (m[7]) return 'keyword';
    if (m[8]) {
      if (depth === 0) {
        const prev = s[m.index - 1];
        return prev === '.' || prev === '#' ? 'function' : prev === ':' ? 'control' : 'keyword';
      }
      // Inside a block: a property before ':', a value after it.
      return /^\s*:/.test(s.slice(m.index + m[0].length)) ? 'var' : 'string';
    }
    if (m[5] || m[6]) return depth > 0 ? 'number' : (m[5] ? 'function' : 'number');
    return '';
  });
}

/* ── HTML ──────────────────────────────────────────────────── */

function fgHlHtml(code) {
  const s = String(code == null ? '' : code);
  const n = s.length;
  let out = '', i = 0;
  while (i < n) {
    if (s.startsWith('<!--', i)) {
      const j = s.indexOf('-->', i + 4);
      const end = j === -1 ? n : j + 3;
      out += _fgHlSpan('comment', s.slice(i, end));
      i = end;
      continue;
    }
    if (s[i] === '<' && s[i + 1] === '!') {
      const j = s.indexOf('>', i);
      const end = j === -1 ? n : j + 1;
      out += _fgHlSpan('preproc', s.slice(i, end));
      i = end;
      continue;
    }
    const tag = s[i] === '<' ? /^<(\/?)([A-Za-z][\w:-]*)/.exec(s.slice(i, i + 64)) : null;
    if (tag) {
      out += _fgHlSpan('bracket', '<' + tag[1]) + _fgHlSpan('keyword', tag[2]);
      i += tag[0].length;
      let closed = false;
      while (i < n) {
        const rest = s.slice(i, i + 4096);
        let m;
        if ((m = /^\s+/.exec(rest))) { out += _fgHlEsc(m[0]); i += m[0].length; continue; }
        if (rest[0] === '>' || rest.startsWith('/>')) {
          const t = rest[0] === '>' ? '>' : '/>';
          out += _fgHlSpan('bracket', t);
          i += t.length;
          closed = true;
          break;
        }
        if (rest[0] === '<') break;
        if ((m = /^=/.exec(rest))) { out += _fgHlSpan('operator', '='); i++; continue; }
        if ((m = /^"[^"]*"?|^'[^']*'?/.exec(rest))) { out += _fgHlSpan('string', m[0]); i += m[0].length; continue; }
        if ((m = /^[^\s=>/"'<]+/.exec(rest))) {
          const value = out.endsWith('<span class="syntax-operator">=</span>');
          out += _fgHlSpan(value ? 'string' : 'var', m[0]);
          i += m[0].length;
          continue;
        }
        out += _fgHlEsc(rest[0]);
        i++;
      }
      // What a <script> or <style> holds is that language, up to its closing tag.
      const name = tag[2].toLowerCase();
      if (closed && !tag[1] && (name === 'script' || name === 'style')) {
        const lower = s.toLowerCase();
        const j = lower.indexOf('</' + name, i);
        const end = j === -1 ? n : j;
        const inner = s.slice(i, end);
        out += name === 'script' ? fgHlJs(inner) : fgHlCss(inner);
        i = end;
      }
      continue;
    }
    if (s[i] === '&') {
      const m = /^&(?:#\d+|#x[\da-fA-F]+|[A-Za-z]\w*);/.exec(s.slice(i, i + 16));
      if (m) { out += _fgHlSpan('escape', m[0]); i += m[0].length; continue; }
    }
    let j = i + 1;
    while (j < n && s[j] !== '<' && s[j] !== '&') j++;
    out += _fgHlEsc(s.slice(i, j));
    i = j;
  }
  return out;
}

/* ── 8086 assembly (A86 / MASM) ────────────────────────────── */

const FG_HL_ASM_JUMPS = new Set(('JMP CALL RET RETN RETF IRET INT INT3 INTO LOOP LOOPE LOOPZ LOOPNE LOOPNZ JCXZ '
  + 'JO JNO JB JNAE JC JAE JNB JNC JE JZ JNE JNZ JBE JNA JA JNBE JS JNS JP JPE JNP JPO JL JNGE JGE JNL JLE JNG JG JNLE').split(' '));
const FG_HL_ASM_OPS = new Set(('MOV ADD ADC SUB SBB CMP AND OR XOR TEST NOT NEG INC DEC MUL IMUL DIV IDIV SHL SAL SHR SAR '
  + 'ROL ROR RCL RCR PUSH POP PUSHF POPF PUSHA POPA XCHG LEA LDS LES XLAT XLATB CBW CWD LAHF SAHF AAA AAS AAM AAD DAA DAS '
  + 'MOVSB MOVSW CMPSB CMPSW SCASB SCASW LODSB LODSW STOSB STOSW MOVS CMPS SCAS LODS STOS REP REPE REPZ REPNE REPNZ LOCK '
  + 'NOP HLT WAIT CLC STC CMC CLD STD CLI STI IN OUT').split(' '));
const FG_HL_ASM_REGS = new Set('AX BX CX DX SI DI BP SP AL AH BL BH CL CH DL DH CS DS ES SS IP'.split(' '));
const FG_HL_ASM_DIRS = new Set(('DB DW DD DQ DT EQU ORG PROC ENDP SEGMENT ENDS ASSUME END DUP OFFSET SEG PTR BYTE WORD '
  + 'DWORD SHORT NEAR FAR LONG EVEN ALIGN RADIX LABEL TYPE HIGH LOW MOD SHL SHR NOT BY TITLE PAGE NAME PUBLIC '
  + '.MODEL .CODE .DATA .STACK .CONST .8086 .186 .286 .386 @DATA @CODE').split(' '));
const FG_HL_ASM_RE = /(;[^\n]*)|('(?:[^'\n]|'')*'?|"(?:[^"\n]|"")*"?)|(\b\d[\dA-Za-z_]*)|(>?[A-Za-z_@.?$][\w@?$.]*)(:?)|([[\]])|([-+*/,()=:<>])/g;

function fgHlAsm(code) {
  return _fgHlScan(code, FG_HL_ASM_RE, (m, s) => {
    if (m[1]) return 'comment';
    if (m[2]) return 'string';
    if (m[3]) return 'number';
    if (m[6]) return 'bracket';
    if (m[7]) return m[7] === ',' ? '' : 'operator';
    const raw = m[4], u = raw.replace(/^>/, '').toUpperCase();
    if (m[5]) return FG_HL_ASM_REGS.has(u) ? 'var' : 'function';   // "start:" (or "es:")
    if (FG_HL_ASM_REGS.has(u)) return 'var';
    if (FG_HL_ASM_JUMPS.has(u)) return 'control';
    if (FG_HL_ASM_OPS.has(u)) return 'keyword';
    if (FG_HL_ASM_DIRS.has(u)) return 'usertype';
    // A86's B[...] / W[...]
    if ((u === 'B' || u === 'W' || u === 'F') && s[m.index + raw.length] === '[') return 'usertype';
    return 'function';
  });
}

/**
 * Paint a file by its extension.
 * @param {string} ext ".js", ".html", ".asm" …
 * @param {string} code
 */
function fgLangHighlight(ext, code) {
  if (!code) return '';
  switch (String(ext || '').toLowerCase()) {
    case '.js': case '.mjs': return fgHlJs(code);
    case '.css': return fgHlCss(code);
    case '.html': case '.htm': return fgHlHtml(code);
    case '.asm': case '.a86': case '.8': return fgHlAsm(code);
    case '.sql': return typeof sqlHighlight === 'function' ? sqlHighlight(code) : _fgHlEsc(code);
    case '.txt': case '.md': return _fgHlEsc(code);
  }
  return typeof syntaxHighlight === 'function' ? syntaxHighlight(code) : _fgHlEsc(code);
}
