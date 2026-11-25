/* ============================================================
   ASM86.JS — an 8086 assembler and a small DOS machine, no DOM
   ------------------------------------------------------------
   Freeground's Assembly language: 16-bit 8086 real mode, written the way
   the A86 assembler reads it, run as a DOS .COM program. A86 itself is
   shareware we cannot ship, and DOSBox cannot load from disk the way this
   app must, so this file is both halves:

   ASSEMBLE (Asm86.assemble) turns the source into a list of instructions,
   each at the address it would have in the .COM file (ORG 100h unless the
   program says otherwise), plus the data bytes in a 64 KB image. It is not
   a byte-exact encoder: instructions are kept as objects and executed as
   such, and their lengths follow the 8086 encodings closely enough that
   `$` and label arithmetic come out as A86 would make them.
   A86's own rules, because programs are written for it:
     - a number with a leading zero is HEX (0b800 = B800h, 020 = 20h,
       0110B = 110Bh); others are decimal; suffixes H, B/xB, D/xD, O/Q;
     - B[...] / W[...] (and BYTE / WORD [PTR]) give a memory operand its size;
     - [es:di] puts the segment override inside the brackets;
     - a name followed by ':' is a label (its offset when used as a value),
       a name before DB/DW is a variable (its contents when used);
     - local labels are reused names; >L1 means the next L1 forward;
     - MOV ES, 0B800 is accepted (the class's programs rely on it).
   MASM-style skeletons (.MODEL, .DATA, .CODE, PROC/ENDP, SEGMENT/ENDS,
   ASSUME, END start, @data) assemble too.

   RUN (Asm86.createMachine) is the machine: 1 MB of memory, the registers
   and flags, DOS (INT 20h, INT 21h) and the BIOS (INT 10h video, INT 16h
   keyboard, INT 1Ah clock, INT 15h wait) done natively. The screen is real
   text-mode memory at B800:0000 (80x25, a character byte then an attribute
   byte per cell), so `mov b[es:di], al` and INT 21h output land in the same
   place they do in DOSBox; mode 13h (320x200x256 at A000:0000) works too.
   run(budget) executes up to `budget` instructions and says why it stopped:
   still running, waiting for a key, sleeping, exited, or an error. The
   screen (js/fg-dos.js) drives it a slice per frame, so a loop that never
   ends is just a program that keeps running until Stop.

   Everything hangs off one global, Asm86, so it shares the app's script
   scope without a top-level name of its own. Tests: node tools/test-asm86.js
   ============================================================ */
(function (root) {
  'use strict';

  /* ── Names ─────────────────────────────────────────────────── */

  const R8 = { AL: 0, CL: 1, DL: 2, BL: 3, AH: 4, CH: 5, DH: 6, BH: 7 };
  const R16 = { AX: 0, CX: 1, DX: 2, BX: 3, SP: 4, BP: 5, SI: 6, DI: 7 };
  const SR = { ES: 0, CS: 1, SS: 2, DS: 3 };
  const R16_NAMES = ['AX', 'CX', 'DX', 'BX', 'SP', 'BP', 'SI', 'DI'];
  const AX = 0, CX = 1, DX = 2, BX = 3, SP = 4, BP = 5, SI = 6, DI = 7;
  const ES = 0, CS = 1, SS = 2, DS = 3;

  const K_R8 = 1, K_R16 = 2, K_SR = 3, K_IMM = 4, K_MEM = 5;

  const JCC = {
    JO: 0, JNO: 1, JB: 2, JNAE: 2, JC: 2, JAE: 3, JNB: 3, JNC: 3, JE: 4, JZ: 4, JNE: 5, JNZ: 5,
    JBE: 6, JNA: 6, JA: 7, JNBE: 7, JS: 8, JNS: 9, JP: 10, JPE: 10, JNP: 11, JPO: 11,
    JL: 12, JNGE: 12, JGE: 13, JNL: 13, JLE: 14, JNG: 14, JG: 15, JNLE: 15
  };
  const ALU = { ADD: 0, OR: 1, ADC: 2, SBB: 3, AND: 4, SUB: 5, XOR: 6, CMP: 7 };
  const SHIFT = { ROL: 0, ROR: 1, RCL: 2, RCR: 3, SHL: 4, SAL: 4, SHR: 5, SAR: 7 };
  const LOOPS = { LOOP: 0, LOOPE: 1, LOOPZ: 1, LOOPNE: 2, LOOPNZ: 2 };
  // String instructions: [kind, size]. kind 0 MOVS, 1 CMPS, 2 SCAS, 3 LODS, 4 STOS.
  const STRS = {
    MOVSB: [0, 1], MOVSW: [0, 2], CMPSB: [1, 1], CMPSW: [1, 2], SCASB: [2, 1], SCASW: [2, 2],
    LODSB: [3, 1], LODSW: [3, 2], STOSB: [4, 1], STOSW: [4, 2]
  };
  const STR_GENERIC = { MOVS: 0, CMPS: 1, SCAS: 2, LODS: 3, STOS: 4 };

  // Opcodes of the instruction objects.
  const O = {
    MOV: 1, ALU: 2, TEST: 3, INC: 4, DEC: 5, NEG: 6, NOT: 7, MUL: 8, IMUL: 9, DIV: 10, IDIV: 11,
    SHIFT: 12, PUSH: 13, POP: 14, XCHG: 15, LEA: 16, LDS: 17, LES: 18, JMP: 19, JCC: 20, LOOP: 21,
    JCXZ: 22, CALL: 23, RET: 24, RETF: 25, INT: 26, IRET: 27, STR: 28, CLC: 29, STC: 30, CMC: 31,
    CLD: 32, STD: 33, CLI: 34, STI: 35, CBW: 36, CWD: 37, LAHF: 38, SAHF: 39, PUSHF: 40, POPF: 41,
    PUSHA: 42, POPA: 43, XLAT: 44, AAA: 45, AAS: 46, DAA: 47, DAS: 48, AAM: 49, AAD: 50, NOP: 51,
    HLT: 52, IN: 53, OUT: 54, INTO: 55, JMPF: 56, CALLF: 57
  };
  const SIMPLE = {
    NOP: O.NOP, HLT: O.HLT, CLC: O.CLC, STC: O.STC, CMC: O.CMC, CLD: O.CLD, STD: O.STD, CLI: O.CLI,
    STI: O.STI, CBW: O.CBW, CWD: O.CWD, LAHF: O.LAHF, SAHF: O.SAHF, PUSHF: O.PUSHF, POPF: O.POPF,
    PUSHA: O.PUSHA, POPA: O.POPA, XLAT: O.XLAT, XLATB: O.XLAT, AAA: O.AAA, AAS: O.AAS, DAA: O.DAA,
    DAS: O.DAS, IRET: O.IRET, INTO: O.INTO, WAIT: O.NOP, FWAIT: O.NOP
  };
  const UNARY = { INC: O.INC, DEC: O.DEC, NEG: O.NEG, NOT: O.NOT, MUL: O.MUL, IMUL: O.IMUL, DIV: O.DIV, IDIV: O.IDIV };
  const OTHER = ['MOV', 'TEST', 'PUSH', 'POP', 'XCHG', 'LEA', 'LDS', 'LES', 'JMP', 'JCXZ', 'CALL', 'RET',
    'RETN', 'RETF', 'INT', 'INT3', 'AAM', 'AAD', 'IN', 'OUT', 'REP', 'REPE', 'REPZ', 'REPNE', 'REPNZ', 'LOCK'];
  const MNEMONICS = new Set([].concat(Object.keys(JCC), Object.keys(ALU), Object.keys(SHIFT), Object.keys(LOOPS),
    Object.keys(STRS), Object.keys(STR_GENERIC), Object.keys(SIMPLE), Object.keys(UNARY), OTHER));
  const DATA_SIZE = { DB: 1, DW: 2, DD: 4, DQ: 8, DT: 10 };
  // Directives that only shape a MASM listing or an EXE: accepted, and ignored.
  const IGNORED = new Set(['ASSUME', 'NAME', 'TITLE', 'SUBTTL', 'PAGE', 'PUBLIC', 'EXTRN', 'EXTERN', 'GLOBAL',
    '.8086', '.8087', '.186', '.286', '.386', '.LIST', '.NOLIST', 'INCLUDELIB', 'JUMPS', 'LOCALS', 'IDEAL', 'MASM',
    '.STARTUP', '.EXIT', 'OPTION', 'CODE', 'DATA']);
  const NOT_8086 = new Set(['MOVZX', 'MOVSX', 'SETE', 'SETNE', 'BSF', 'BSR', 'BT', 'BTS', 'BTR', 'BTC', 'CDQ', 'CWDE',
    'PUSHAD', 'POPAD', 'PUSHFD', 'POPFD', 'SHLD', 'SHRD', 'LFS', 'LGS', 'LSS', 'ENTER', 'LEAVE', 'BOUND', 'INSB',
    'INSW', 'OUTSB', 'OUTSW', 'SYSCALL', 'CPUID']);

  /** The program's segment. DOS would pick one; any will do, as long as it is the same every run. */
  const LOAD_SEG = 0x075A;

  /* ── Code page 437: what each byte looks like on a DOS screen ── */
  const CP437 = ' ☺☻♥♦♣♠•◘○◙♂♀♪♫☼►◄↕‼¶§▬↨↑↓→←∟↔▲▼'
    + ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~⌂'
    + 'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐'
    + '└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ';
  const CP437_BACK = new Map();
  for (let i = 32; i < 256; i++) if (!CP437_BACK.has(CP437[i])) CP437_BACK.set(CP437[i], i);

  /* ── Numbers, the A86 way ──────────────────────────────────── */

  /**
   * @param {string} text a number token
   * @param {number|null} radix the RADIX in force (null: hex with a leading zero, else decimal)
   * @returns {number} NaN when it is not a number
   */
  function parseNumber(text, radix) {
    const u = String(text).toUpperCase();
    let m;
    if ((m = /^0X([0-9A-F]+)$/.exec(u))) return parseInt(m[1], 16);
    if ((m = /^([0-9][0-9A-F]*)H$/.exec(u))) return parseInt(m[1], 16);
    if ((m = /^([0-9][0-9A-F]*)XB$/.exec(u))) return /^[01]+$/.test(m[1]) ? parseInt(m[1], 2) : NaN;
    if ((m = /^([0-9][0-9A-F]*)XD$/.exec(u))) return /^\d+$/.test(m[1]) ? parseInt(m[1], 10) : NaN;
    if ((m = /^([0-9]+)[OQ]$/.exec(u))) return /^[0-7]+$/.test(m[1]) ? parseInt(m[1], 8) : NaN;
    const base = radix || (u.length > 1 && u[0] === '0' ? 16 : 10);
    if (base === 16) return /^[0-9A-F]+$/.test(u) ? parseInt(u, 16) : NaN;
    if (base === 10) {
      if (/^\d+$/.test(u)) return parseInt(u, 10);
      if ((m = /^([01]+)B$/.exec(u))) return parseInt(m[1], 2);
      if ((m = /^(\d+)D$/.exec(u))) return parseInt(m[1], 10);
      return NaN;
    }
    const digits = '0123456789ABCDEF'.slice(0, base);
    for (const ch of u) if (digits.indexOf(ch) === -1) return NaN;
    return parseInt(u, base);
  }

  /* ── Lexer ─────────────────────────────────────────────────── */

  function AsmError(msg) { this.message = msg; }

  function lex(text) {
    const toks = [];
    const n = text.length;
    let i = 0;
    while (i < n) {
      const c = text[i];
      if (c === ' ' || c === '\t' || c === '\r' || c === '\f') { i++; continue; }
      if (c === ';') break;
      if (c === '\'' || c === '"') {
        let j = i + 1, s = '';
        for (;;) {
          if (j >= n) throw new AsmError('This string has no closing ' + c + '.');
          if (text[j] === c) {
            if (text[j + 1] === c) { s += c; j += 2; continue; }
            break;
          }
          s += text[j++];
        }
        toks.push({ t: 'str', v: s });
        i = j + 1;
        continue;
      }
      if (c >= '0' && c <= '9') {
        let j = i;
        while (j < n && /[0-9A-Za-z_]/.test(text[j])) j++;
        toks.push({ t: 'num', v: text.slice(i, j) });
        i = j;
        continue;
      }
      if (/[A-Za-z_@.?$]/.test(c)) {
        let j = i + 1;
        while (j < n && /[\w@?$]/.test(text[j])) j++;
        toks.push({ t: 'id', v: text.slice(i, j), u: text.slice(i, j).toUpperCase() });
        i = j;
        continue;
      }
      if ('[](),:+-*/<>=&|~!'.indexOf(c) !== -1) { toks.push({ t: 'p', v: c }); i++; continue; }
      throw new AsmError('Unexpected character "' + c + '".');
    }
    return toks;
  }

  const isP = (t, v) => !!t && t.t === 'p' && t.v === v;
  const idU = (t) => (t && t.t === 'id' ? t.u : null);

  /** Split a token list on top-level commas. */
  function splitCommas(toks) {
    const out = [];
    let cur = [], depth = 0;
    toks.forEach(t => {
      if (t.t === 'p' && (t.v === '(' || t.v === '[')) depth++;
      if (t.t === 'p' && (t.v === ')' || t.v === ']')) depth--;
      if (depth === 0 && isP(t, ',')) { out.push(cur); cur = []; } else cur.push(t);
    });
    if (cur.length || out.length) out.push(cur);
    return out;
  }

  /* ── Expressions ───────────────────────────────────────────── */
  /* AST: {n:'num',v} {n:'str',v} {n:'sym',u,fwd} {n:'here'} {n:'un',op,a} {n:'bin',op,a,b} */

  function parseExpr(toks, radix) {
    let i = 0;
    const peek = () => toks[i];
    const word = (w) => idU(toks[i]) === w;
    function orE() {
      let a = xorE();
      while (word('OR') || isP(peek(), '|')) { i++; a = { n: 'bin', op: 'or', a, b: xorE() }; }
      return a;
    }
    function xorE() {
      let a = andE();
      while (word('XOR')) { i++; a = { n: 'bin', op: 'xor', a, b: andE() }; }
      return a;
    }
    function andE() {
      let a = notE();
      while (word('AND') || isP(peek(), '&')) { i++; a = { n: 'bin', op: 'and', a, b: notE() }; }
      return a;
    }
    function notE() {
      if (word('NOT') || isP(peek(), '~')) { i++; return { n: 'un', op: 'not', a: notE() }; }
      return byE();
    }
    function byE() {
      let a = addE();
      while (word('BY')) { i++; a = { n: 'bin', op: 'by', a, b: addE() }; }
      return a;
    }
    function addE() {
      let a = mulE();
      while (isP(peek(), '+') || isP(peek(), '-')) {
        const op = toks[i++].v;
        a = { n: 'bin', op, a, b: mulE() };
      }
      return a;
    }
    function mulE() {
      let a = unE();
      for (;;) {
        if (isP(peek(), '*') || isP(peek(), '/')) { const op = toks[i++].v; a = { n: 'bin', op, a, b: unE() }; continue; }
        const w = idU(peek());
        if (w === 'MOD' || w === 'SHL' || w === 'SHR') { i++; a = { n: 'bin', op: w.toLowerCase(), a, b: unE() }; continue; }
        return a;
      }
    }
    function unE() {
      const t = peek();
      if (isP(t, '-')) { i++; return { n: 'un', op: 'neg', a: unE() }; }
      if (isP(t, '+')) { i++; return unE(); }
      const w = idU(t);
      if (w === 'OFFSET' || w === 'SEG' || w === 'HIGH' || w === 'LOW' || w === 'TYPE' || w === 'SIZE' || w === 'LENGTH') {
        i++;
        return { n: 'un', op: w.toLowerCase(), a: unE() };
      }
      return prim();
    }
    function prim() {
      const t = toks[i];
      if (!t) throw new AsmError('An expression is missing a value at the end.');
      i++;
      if (t.t === 'num') {
        const v = parseNumber(t.v, radix);
        if (isNaN(v)) throw new AsmError(numberHelp(t.v));
        return { n: 'num', v, tok: t.v };
      }
      if (t.t === 'str') return { n: 'str', v: t.v };
      if (isP(t, '(')) {
        const e = orE();
        if (!isP(toks[i], ')')) throw new AsmError('A "(" is missing its ")".');
        i++;
        return e;
      }
      if (isP(t, '>') && toks[i] && toks[i].t === 'id') { const s = toks[i++]; return { n: 'sym', u: s.u, name: s.v, fwd: true }; }
      if (t.t === 'id') {
        if (t.u === '$') return { n: 'here' };
        if (t.u === '?') return { n: 'num', v: 0, undef: true };
        return { n: 'sym', u: t.u, name: t.v };
      }
      throw new AsmError('Unexpected "' + t.v + '" in an expression.');
    }
    const e = orE();
    if (i < toks.length) throw new AsmError('Unexpected "' + toks[i].v + '" after ' + (i ? '"' + toks[i - 1].v + '"' : 'the start') + '.');
    return e;
  }

  function numberHelp(tok) {
    const u = String(tok).toUpperCase();
    if (/^[1-9][0-9A-F]*$/.test(u)) {
      return u + ' is not a number: A86 reads a number as decimal unless it starts with 0 or ends in H. Write '
        + u + 'h or 0' + u + ' for hex.';
    }
    return u + ' is not a number A86 can read.';
  }

  /* ── The assembler ─────────────────────────────────────────── */

  /**
   * @param {string} source
   * @param {{fileName?: string}} [opts]
   * @returns {{ok: boolean, errors: Array<{line:number,msg:string}>, warnings: Array<{line:number,msg:string}>, program: ?object}}
   */
  function assemble(source, opts) {
    const fileName = (opts && opts.fileName) || 'main.asm';
    const lines = String(source == null ? '' : source).replace(/\r\n?/g, '\n').split('\n');
    const errors = [], warnings = [];
    const err = (line, msg) => { if (errors.length < 25 && !errors.some(e => e.line === line && e.msg === msg)) errors.push({ line: line + 1, msg }); };
    const warn = (line, msg) => { if (warnings.length < 25) warnings.push({ line: line + 1, msg }); };

    /* Pass 0: every line split into its parts, and every name's kind. */
    const stmts = [];
    const syms = new Map();   // UPPER -> [{kind, size, idx, addr, expr, here, redef}]
    const define = (u, def) => {
      const list = syms.get(u) || [];
      list.push(def);
      syms.set(u, list);
    };
    let radix = null;
    lines.forEach((raw, ln) => {
      let toks;
      try { toks = lex(raw); } catch (e) { err(ln, e.message); return; }
      if (!toks.length) return;
      const st = { ln, label: null, name: null, mn: null, ops: [], toks, radix };
      // name:  (but not "es:" in front of an instruction)
      if (toks[0].t === 'id' && isP(toks[1], ':') && !(toks[0].u in SR)) {
        st.label = toks[0];
        toks = toks.slice(2);
      }
      if (toks.length) {
        const first = idU(toks[0]);
        const second = idU(toks[1]);
        const isKw = (w) => !!w && (MNEMONICS.has(w) || w in DATA_SIZE || w === 'ORG' || w === 'EVEN' || w === 'ALIGN'
          || w === 'END' || w === 'RADIX' || w === 'DUP' || IGNORED.has(w) || /^\.(MODEL|CODE|DATA|DATA\?|CONST|STACK|FARDATA)$/.test(w));
        if (first && !isKw(first) && (second in DATA_SIZE || second === 'EQU' || second === 'PROC' || second === 'ENDP'
            || second === 'SEGMENT' || second === 'ENDS' || second === 'LABEL' || isP(toks[1], '='))) {
          st.name = toks[0];
          toks = toks.slice(1);
        }
        if (!toks.length) { stmts.push(st); return; }
        if (isP(toks[0], '=')) st.mn = '=';
        else if (toks[0].t === 'id') st.mn = toks[0].u;
        else { err(ln, 'A line has to start with a label or an instruction, not "' + toks[0].v + '".'); return; }
        st.ops = toks.slice(1);
      }
      if (st.mn === 'RADIX') {
        const v = st.ops.length ? parseInt(st.ops[0].v, 10) : NaN;
        radix = st.ops.length ? (v >= 2 && v <= 16 ? v : radix) : null;
        st.radix = radix;
      }
      if (st.label) define(st.label.u, { kind: 'label', idx: stmts.length, ln, name: st.label.v });
      if (st.name) {
        const u = st.name.u, mn = st.mn;
        if (mn in DATA_SIZE) define(u, { kind: 'var', size: DATA_SIZE[mn], idx: stmts.length, ln, name: st.name.v });
        else if (mn === 'EQU' || mn === '=') define(u, { kind: 'const', idx: stmts.length, ln, redef: mn === '=', name: st.name.v });
        else if (mn === 'PROC') define(u, { kind: 'label', idx: stmts.length, ln, name: st.name.v });
        else if (mn === 'SEGMENT') define(u, { kind: 'seg', idx: stmts.length, ln, name: st.name.v });
        else if (mn === 'LABEL') {
          const t = idU(st.ops[0]);
          define(u, { kind: t === 'BYTE' || t === 'WORD' || t === 'DWORD' ? 'var' : 'label', size: t === 'BYTE' ? 1 : t === 'WORD' ? 2 : t === 'DWORD' ? 4 : 0, idx: stmts.length, ln, name: st.name.v });
        }
      }
      stmts.push(st);
    });

    // A name defined twice is an error, except local labels (L1, L2, ...) and '=' constants.
    syms.forEach((list, u) => {
      if (list.length < 2) return;
      const local = /^[A-Z][0-9]+$/.test(u);
      if (local || list.every(d => d.redef)) return;
      list.slice(1).forEach(d => err(d.ln, '"' + d.name + '" is already defined on line ' + (list[0].ln + 1) + '.'));
    });

    /** The definition a reference at statement `idx` means. */
    function lookup(u, idx, fwd) {
      const list = syms.get(u);
      if (!list || !list.length) return null;
      if (list.length === 1 && !fwd) return list[0];
      if (fwd) return list.find(d => d.idx > idx) || null;
      let best = null;
      list.forEach(d => { if (d.idx <= idx) best = d; });
      return best || list[0];
    }

    /* Evaluation. `strict` false (layout): an unknown address gives null instead of an error. */
    function evaluate(ast, ctx, strict, depth) {
      if ((depth || 0) > 40) throw new AsmError('These EQU constants refer to each other in a circle.');
      switch (ast.n) {
        case 'num': return ast.v;
        case 'str': {
          const s = ast.v;
          if (s.length === 0) return 0;
          if (s.length === 1) return charCode(s);
          if (s.length === 2) return (charCode(s[0]) << 8) | charCode(s[1]);
          throw new AsmError('"' + s + '" is a string; only one or two characters can be used as a number.');
        }
        case 'here': return ctx.here;
        case 'sym': {
          if (ast.u === '@DATA' || ast.u === '@CODE' || ast.u === '@STACK') return LOAD_SEG;
          const d = lookup(ast.u, ctx.idx, ast.fwd);
          if (!d) throw new AsmError('"' + ast.name + '" is not defined anywhere.' + suggest(ast.u));
          if (d.kind === 'seg') return LOAD_SEG;
          if (d.kind === 'const') {
            if (!d.expr) {
              if (strict) throw new AsmError('"' + ast.name + '" has no value.');
              return null;
            }
            return evaluate(d.expr, { here: d.here, idx: d.idx }, strict, (depth || 0) + 1);
          }
          if (d.addr == null) {
            if (strict) throw new AsmError('"' + ast.name + '" is used before it has an address.');
            return null;
          }
          return d.addr;
        }
        case 'un': {
          if (ast.op === 'seg') return LOAD_SEG;
          if (ast.op === 'type' || ast.op === 'size' || ast.op === 'length') {
            const d = ast.a.n === 'sym' ? lookup(ast.a.u, ctx.idx, ast.a.fwd) : null;
            if (ast.op === 'type') return d ? (d.kind === 'var' ? d.size : 0xFFFF) : 0;
            if (ast.op === 'length') return d && d.count ? d.count : 1;
            return d && d.kind === 'var' ? d.size * (d.count || 1) : 0;
          }
          const a = evaluate(ast.a, ctx, strict, depth);
          if (a == null) return null;
          if (ast.op === 'neg') return -a;
          if (ast.op === 'not') return ~a & 0xFFFF;
          if (ast.op === 'offset') return a;
          if (ast.op === 'high') return (a >> 8) & 0xFF;
          if (ast.op === 'low') return a & 0xFF;
          return a;
        }
        case 'bin': {
          const a = evaluate(ast.a, ctx, strict, depth);
          const b = evaluate(ast.b, ctx, strict, depth);
          if (a == null || b == null) return null;
          switch (ast.op) {
            case '+': return a + b;
            case '-': return a - b;
            case '*': return a * b;
            case '/': if (!b) throw new AsmError('Division by zero in an expression.'); return Math.trunc(a / b);
            case 'mod': if (!b) throw new AsmError('Division by zero in an expression.'); return a % b;
            case 'shl': return (a << b) & 0xFFFFFFFF;
            case 'shr': return a >>> b;
            case 'and': return a & b;
            case 'or': return a | b;
            case 'xor': return a ^ b;
            case 'by': return ((a & 0xFF) << 8) | (b & 0xFF);
          }
        }
      }
      throw new AsmError('This expression could not be worked out.');
    }

    const knownNames = () => Array.from(syms.keys());
    function suggest(u) {
      const best = closest(u, knownNames(), 2);
      return best ? ' Did you mean ' + best + '?' : '';
    }

    /** Does this expression use a variable's contents (not under OFFSET)? Returns that variable's definition. */
    function varIn(ast, idx) {
      if (!ast) return null;
      if (ast.n === 'sym') {
        const d = lookup(ast.u, idx, ast.fwd);
        return d && d.kind === 'var' ? d : null;
      }
      if (ast.n === 'un') return ast.op === 'offset' || ast.op === 'seg' || ast.op === 'type' || ast.op === 'size' || ast.op === 'length' ? null : varIn(ast.a, idx);
      if (ast.n === 'bin') return varIn(ast.a, idx) || varIn(ast.b, idx);
      return null;
    }

    /* ── Operands ── */

    /**
     * One operand, classified. Registers come back whole; everything else
     * keeps its expression for later, with what is known already.
     */
    function operand(toks, st) {
      let i = 0, size = 0, seg = -1, far = false;
      for (;;) {
        const w = idU(toks[i]);
        const next = toks[i + 1];
        if ((w === 'BYTE' || w === 'WORD' || w === 'DWORD' || w === 'FAR' || w === 'NEAR' || w === 'SHORT' || w === 'LONG') && next) {
          if (w === 'BYTE') size = 1; else if (w === 'WORD') size = 2; else if (w === 'DWORD' || w === 'FAR') { size = 4; far = w === 'FAR' || far; }
          i++;
          if (idU(toks[i]) === 'PTR') i++;
          continue;
        }
        if ((w === 'B' || w === 'W' || w === 'F' || w === 'D') && isP(next, '[')) {
          size = w === 'B' ? 1 : w === 'W' ? 2 : 4;
          if (w === 'F') far = true;
          i++;
          continue;
        }
        if (w && w in SR && isP(next, ':')) { seg = SR[w]; i += 2; continue; }
        break;
      }
      const rest = toks.slice(i);
      if (!rest.length) throw new AsmError('An operand is missing.');
      // A register on its own.
      if (rest.length === 1 && rest[0].t === 'id') {
        const u = rest[0].u;
        if (u in R8) return { k: K_R8, r: R8[u], size: 1, name: u };
        if (u in R16) return { k: K_R16, r: R16[u], size: 2, name: u };
        if (u in SR) return { k: K_SR, r: SR[u], size: 2, name: u };
        if (/^E(AX|BX|CX|DX|SI|DI|SP|BP)$/.test(u) || u === 'FS' || u === 'GS') {
          throw new AsmError(u + ' is a 386 register. The 8086 has only 16-bit registers: AX, BX, CX, DX, SI, DI, BP, SP.');
        }
      }
      // Postfix size, A86's "ARRAY B".
      if (rest.length >= 2 && (idU(rest[rest.length - 1]) === 'B' || idU(rest[rest.length - 1]) === 'W') && rest[rest.length - 2].t === 'id'
          && !syms.has('B') && !syms.has('W')) {
        size = idU(rest[rest.length - 1]) === 'B' ? 1 : 2;
        rest.pop();
      }
      const outside = [];
      const regs = [];
      let brackets = false;
      for (let k = 0; k < rest.length; k++) {
        const t = rest[k];
        if (isP(t, '[')) {
          let j = k + 1, depth = 1;
          for (; j < rest.length; j++) {
            if (isP(rest[j], '[')) depth++;
            if (isP(rest[j], ']') && --depth === 0) break;
          }
          if (j >= rest.length) throw new AsmError('A "[" is missing its "]".');
          let inner = rest.slice(k + 1, j);
          brackets = true;
          if (inner.length > 2 && idU(inner[0]) in SR && isP(inner[1], ':')) { seg = SR[idU(inner[0])]; inner = inner.slice(2); }
          // Split on top-level + and -.
          const terms = [];
          let cur = [], sign = '+', d = 0;
          inner.forEach(tk => {
            if (isP(tk, '(')) d++;
            if (isP(tk, ')')) d--;
            if (d === 0 && (isP(tk, '+') || isP(tk, '-'))) {
              if (cur.length) terms.push({ sign, toks: cur });
              else if (isP(tk, '-')) { sign = sign === '-' ? '+' : '-'; return; }
              cur = []; sign = tk.v;
              return;
            }
            cur.push(tk);
          });
          if (cur.length) terms.push({ sign, toks: cur });
          terms.forEach(term => {
            const u = term.toks.length === 1 ? idU(term.toks[0]) : null;
            if (u && (u in R16 || u in R8 || u in SR)) {
              if (!(u === 'BX' || u === 'BP' || u === 'SI' || u === 'DI')) {
                throw new AsmError('[' + u + '] is not an 8086 address: only BX, BP, SI and DI can go inside [ ].');
              }
              if (term.sign === '-') throw new AsmError('A register cannot be subtracted inside [ ].');
              regs.push(R16[u]);
              return;
            }
            if (term.toks.some(tk => tk.t === 'id' && (tk.u in R16 || tk.u in R8))) {
              throw new AsmError('Registers inside [ ] can only be added, like [BX+SI+2]; the 8086 cannot scale them.');
            }
            if (outside.length || term.sign === '-') outside.push({ t: 'p', v: term.sign });
            outside.push({ t: 'p', v: '(' }, ...term.toks, { t: 'p', v: ')' });
          });
          k = j;
          continue;
        }
        if (t.t === 'id' && (t.u in R16 || t.u in R8)) {
          throw new AsmError('"' + t.v + '" has to be inside [ ] to be used as an address, like [' + t.v + '].');
        }
        if (t.t === 'id' && t.u in SR && isP(rest[k + 1], ':')) { seg = SR[t.u]; k++; continue; }
        outside.push(t);
      }
      const ast = outside.length ? parseExpr(outside, st.radix) : { n: 'num', v: 0 };
      const v = varIn(ast, st.idx);
      if (brackets || v || seg >= 0) {
        let base = -1, index = -1;
        regs.forEach(r => {
          if (r === BX || r === BP) {
            if (base >= 0) throw new AsmError('[BX+BP] is not an 8086 address: use one of BX or BP, with SI or DI.');
            base = r;
          } else {
            if (index >= 0) throw new AsmError('[SI+DI] is not an 8086 address: use one of SI or DI, with BX or BP.');
            index = r;
          }
        });
        return { k: K_MEM, base, index, seg, size: size || (v ? Math.min(v.size, 4) : 0), ast, far, varName: v ? v.name : null };
      }
      if (size === 4 && far) return { k: K_IMM, ast, size: 0, far: true };
      const sz = size;
      return { k: K_IMM, ast, size: sz, local: ast.n === 'sym' && /^[A-Z][0-9]+$/.test(ast.u) };
    }

    /* ── Layout (pass 1) ── */

    const ins = [];           // instruction objects
    const data = [];          // {addr, items, size, ln, idx}
    const image = new Uint8Array(0x10000);
    let origin = 0x100;
    let entryAst = null, entryIdx = -1;
    let usesSections = false;
    stmts.forEach((st, idx) => {
      st.idx = idx;
      if (st.mn === '.CODE' || st.mn === '.DATA' || st.mn === '.DATA?' || st.mn === '.CONST' || st.mn === '.FARDATA') usesSections = true;
    });
    // With .CODE/.DATA the code is laid out first, then the data, whatever the order in the file.
    const order = [];
    if (usesSections) {
      let section = 'code';
      const code = [], dataSt = [];
      stmts.forEach(st => {
        if (st.mn === '.CODE') section = 'code';
        else if (/^\.(DATA\??|CONST|FARDATA)$/.test(st.mn || '')) section = 'data';
        (section === 'code' ? code : dataSt).push(st);
      });
      order.push(...code, { sectionBreak: true }, ...dataSt);
    } else order.push(...stmts);

    let here = origin;
    const lastPass1 = {};
    const place = (st) => {
      if (st.label) {
        const d = lookup(st.label.u, st.idx, false);
        const own = (syms.get(st.label.u) || []).find(x => x.idx === st.idx && x.kind === 'label');
        if (own) own.addr = here;
        else if (d) d.addr = here;
      }
    };
    function defOf(st, kind) {
      return (syms.get(st.name.u) || []).find(d => d.idx === st.idx && (!kind || d.kind === kind));
    }

    function layout(st) {
      const mn = st.mn;
      place(st);
      if (!mn) return;
      if (st.name && (mn === 'EQU' || mn === '=')) {
        const d = defOf(st, 'const');
        if (d) {
          if (!st.ops.length) throw new AsmError(st.name.v + ' ' + mn + ' needs a value.');
          d.expr = parseExpr(st.ops, st.radix);
          d.here = here;
        }
        return;
      }
      if (st.name && (mn === 'PROC' || mn === 'LABEL')) {
        const d = defOf(st);
        if (d) d.addr = here;
        return;
      }
      if (mn === 'ENDP' || mn === 'ENDS' || mn === 'SEGMENT' || mn === 'RADIX' || IGNORED.has(mn)
          || /^\.(MODEL|CODE|DATA\??|CONST|STACK|FARDATA)$/.test(mn)) return;
      if (mn === 'ORG') {
        const v = evaluate(parseExpr(st.ops, st.radix), { here, idx: st.idx }, false);
        if (v == null) throw new AsmError('ORG needs a value that is known at this point.');
        if (v < 0 || v > 0xFFFF) throw new AsmError('ORG ' + v + ' is outside the 64 KB segment.');
        here = v;
        if (ins.length === 0 && data.length === 0) origin = v;
        return;
      }
      if (mn === 'EVEN') { if (here & 1) here++; return; }
      if (mn === 'ALIGN') {
        const v = evaluate(parseExpr(st.ops, st.radix), { here, idx: st.idx }, false) || 1;
        while (here % v) here++;
        return;
      }
      if (mn === 'END') {
        if (st.ops.length) { entryAst = parseExpr(st.ops, st.radix); entryIdx = st.idx; }
        return;
      }
      if (mn in DATA_SIZE) {
        const size = DATA_SIZE[mn];
        const items = dataItems(st.ops, size, st);
        const count = items.reduce((n, it) => n + it.count, 0);
        if (st.name) { const d = defOf(st, 'var'); if (d) { d.addr = here; d.count = count / Math.max(size, 1); } }
        data.push({ addr: here, items, size, ln: st.ln, idx: st.idx });
        here += count;
        if (here > 0x10000) throw new AsmError('The program no longer fits in its 64 KB segment.');
        return;
      }
      if (mn === 'DUP') throw new AsmError('DUP goes after a count inside DB or DW, like DB 10 DUP (0).');
      if (NOT_8086.has(mn)) throw new AsmError(mn + ' is not an 8086 instruction (it came with the 186 or 386).');
      if (mn === 'EQU' || mn === 'PROC' || mn === 'LABEL') throw new AsmError(mn + ' needs a name in front of it.');
      if (!MNEMONICS.has(mn)) {
        const best = closest(mn, Array.from(MNEMONICS), 2);
        throw new AsmError('Unknown instruction "' + st.toks[st.label ? 2 : 0].v + '".' + (best ? ' Did you mean ' + best + '?' : ''));
      }
      const o = instruction(st);
      if (!o) return;
      o.addr = here;
      o.ln = st.ln;
      o.idx = st.idx;
      ins.push(o);
      here += o.len;
      if (here > 0x10000) throw new AsmError('The program no longer fits in its 64 KB segment.');
    }

    /** DB/DW/DD items: [{count, values: [ast|bytes], dup?}] */
    function dataItems(toks, size, st) {
      const out = [];
      if (!toks.length) throw new AsmError('D' + (size === 1 ? 'B' : size === 2 ? 'W' : 'D') + ' needs at least one value.');
      splitCommas(toks).forEach(part => {
        if (!part.length) throw new AsmError('An empty value between two commas.');
        // n DUP (x, y)  /  n DUP x
        const dupAt = part.findIndex(t => idU(t) === 'DUP');
        if (dupAt > 0) {
          const n = evaluate(parseExpr(part.slice(0, dupAt), st.radix), { here, idx: st.idx }, false);
          if (n == null) throw new AsmError('The DUP count has to be known here; define its constant above this line.');
          if (n < 0 || n > 0xFFFF) throw new AsmError('DUP ' + n + ' does not fit in a 64 KB program.');
          let inner = part.slice(dupAt + 1);
          if (isP(inner[0], '(') && isP(inner[inner.length - 1], ')')) inner = inner.slice(1, -1);
          const sub = dataItems(inner.length ? inner : [{ t: 'id', v: '?', u: '?' }], size, st);
          const each = sub.reduce((s, it) => s + it.count, 0);
          out.push({ count: each * n, dup: n, sub });
          return;
        }
        if (part.length === 1 && part[0].t === 'str' && (size === 1 || part[0].v.length > 2)) {
          const s = part[0].v;
          out.push({ count: s.length * size, str: s });
          return;
        }
        out.push({ count: size, ast: parseExpr(part, st.radix) });
      });
      return out;
    }

    /* ── Instructions ── */

    const immFits8 = (v) => v != null && v >= -128 && v <= 127;
    function memLen(m) {
      if (m.k !== K_MEM) return 1;
      if (m.base < 0 && m.index < 0) return 3;
      const d = m.ast ? tryEval(m.ast, m) : 0;
      if (d === 0 && !(m.base === BP && m.index < 0)) return 1;
      return immFits8(d) ? 2 : 3;
    }
    let curSt = null;
    function tryEval(ast) {
      try { return evaluate(ast, { here, idx: curSt.idx }, false); } catch (e) { return null; }
    }
    const segPrefix = (m) => (m && m.k === K_MEM && m.seg >= 0 ? 1 : 0);
    const sizeName = (s) => (s === 1 ? 'byte' : s === 2 ? 'word' : 'doubleword');

    function needOps(st, n, mn) {
      const parts = st.ops.length ? splitCommas(st.ops) : [];
      if (parts.length !== n) {
        throw new AsmError(mn + ' takes ' + (n === 0 ? 'no operands' : n === 1 ? 'one operand' : n + ' operands, separated by a comma')
          + (parts.length ? ', not ' + parts.length : '') + '.');
      }
      return parts.map(p => operand(p, st));
    }

    /** Both sides' size, or an error that says what to write. */
    function pairSize(a, b, mn) {
      const sa = a.k === K_IMM ? 0 : a.size;
      const sb = b.k === K_IMM ? 0 : b.size;
      if (sa && sb && sa !== sb) {
        const what = (o) => (o.k === K_MEM ? (o.varName ? o.varName + ' (a ' + sizeName(o.size) + ' variable)' : 'that memory (' + sizeName(o.size) + ')') : o.name + ' (' + sizeName(o.size) + ')');
        let hint = '';
        if (mn === 'MOV' && a.k === K_R16 && b.k === K_MEM && b.varName) hint = ' To get its address, write MOV ' + a.name + ', OFFSET ' + b.varName + '.';
        throw new AsmError(mn + ' needs both operands the same size, but ' + what(a) + ' and ' + what(b) + ' differ.' + hint);
      }
      const s = sa || sb;
      if (!s) {
        throw new AsmError(mn + ' cannot tell whether this is a byte or a word. Write B[...] or W[...] (or BYTE PTR / WORD PTR).');
      }
      if (s > 2) throw new AsmError('The 8086 works on bytes and words; a doubleword needs two instructions.');
      return s;
    }

    function checkImm(o, size) {
      const v = tryEval(o.ast);
      if (v == null) return;
      if (size === 1 && (v < -128 || v > 255)) throw new AsmError(v + ' does not fit in a byte (-128 to 255).');
      if (size === 2 && (v < -32768 || v > 65535)) throw new AsmError(v + ' does not fit in a word (-32768 to 65535).');
    }

    function instruction(st) {
      curSt = st;
      let mn = st.mn;
      let rep = 0;
      let ops = st.ops;
      // REP MOVSB on one line (or a prefix alone, applied to the next instruction).
      if (mn === 'LOCK') { if (!ops.length) return null; mn = ops[0].u; ops = ops.slice(1); }
      if (mn === 'REP' || mn === 'REPE' || mn === 'REPZ' || mn === 'REPNE' || mn === 'REPNZ') {
        rep = mn === 'REPNE' || mn === 'REPNZ' ? 2 : 1;
        if (!ops.length) { pendingRep = rep; return null; }
        if (ops[0].t !== 'id') throw new AsmError(mn + ' has to be followed by a string instruction such as MOVSB.');
        mn = ops[0].u;
        ops = ops.slice(1);
        if (!(mn in STRS) && !(mn in STR_GENERIC)) throw new AsmError(st.mn + ' only repeats string instructions (MOVSB, STOSB, CMPSB, SCASB, LODSB and their W forms).');
      } else if (pendingRep) {
        if (mn in STRS || mn in STR_GENERIC) rep = pendingRep;
        pendingRep = 0;
      }
      const s2 = Object.assign({}, st, { ops });

      if (mn in SIMPLE) {
        needOps(s2, 0, mn);
        return { op: SIMPLE[mn], len: 1 };
      }
      if (mn in STRS) {
        needOps(s2, 0, mn);
        return { op: O.STR, sub: STRS[mn][0], size: STRS[mn][1], rep, seg: -1, len: 1 + (rep ? 1 : 0) };
      }
      if (mn in STR_GENERIC) {
        const parts = s2.ops.length ? splitCommas(s2.ops).map(p => operand(p, s2)) : [];
        const sized = parts.find(p => p.size);
        if (!sized) throw new AsmError(mn + ' needs to know byte or word: use ' + mn + 'B or ' + mn + 'W.');
        const src = STR_GENERIC[mn] === 4 ? null : parts[parts.length - 1];
        return { op: O.STR, sub: STR_GENERIC[mn], size: sized.size, rep, seg: src && src.k === K_MEM ? src.seg : -1, len: 1 + (rep ? 1 : 0) };
      }
      if (mn in JCC || mn in LOOPS || mn === 'JCXZ') {
        const [t] = needOps(s2, 1, mn);
        if (t.k !== K_IMM) throw new AsmError(mn + ' needs a label to jump to.');
        const target = tryEval(t.ast);
        if (target != null && Math.abs(target - (here + 2)) > 140 && !(mn in JCC)) {
          warn(st.ln, mn + ' reaches only 128 bytes back or 127 forward on the 8086, and this target is about ' + Math.abs(target - (here + 2)) + ' bytes away.');
        }
        const longJcc = mn in JCC && target != null && (target - (here + 2) < -128);
        if (mn in JCC && target != null && Math.abs(target - (here + 2)) > 140) {
          warn(st.ln, mn + ' is about ' + Math.abs(target - (here + 2)) + ' bytes from its label; an 8086 conditional jump reaches 128 back or 127 forward. A86 builds a longer jump for you; MASM refuses it.');
        }
        if (mn in JCC) return { op: O.JCC, cond: JCC[mn], a: t, len: longJcc ? 5 : 2 };
        if (mn === 'JCXZ') return { op: O.JCXZ, a: t, len: 2 };
        return { op: O.LOOP, sub: LOOPS[mn], a: t, len: 2 };
      }
      if (mn === 'JMP' || mn === 'CALL') {
        const [t] = needOps(s2, 1, mn);
        if (t.k === K_IMM && !t.far) {
          if (mn === 'CALL') return { op: O.CALL, a: t, len: 3 };
          const target = tryEval(t.ast);
          const short = t.local || (target != null && target - (here + 2) >= -128 && target - (here + 2) <= 127 && target <= here);
          return { op: O.JMP, a: t, len: short ? 2 : 3 };
        }
        if (t.k === K_MEM && (t.size === 4 || t.far)) return { op: mn === 'JMP' ? O.JMPF : O.CALLF, a: t, len: 1 + memLen(t) + segPrefix(t) };
        if (t.k === K_R16 || t.k === K_MEM) {
          if (t.k === K_MEM && t.size === 1) throw new AsmError(mn + ' through memory needs a word (the address), not a byte.');
          return { op: mn === 'JMP' ? O.JMP : O.CALL, a: t, indirect: true, len: 1 + memLen(t) + segPrefix(t) };
        }
        throw new AsmError(mn + ' needs a label, a 16-bit register or a word in memory.');
      }
      if (mn === 'RET' || mn === 'RETN' || mn === 'RETF') {
        const parts = s2.ops.length ? needOps(s2, 1, mn) : [];
        if (parts[0] && parts[0].k !== K_IMM) throw new AsmError(mn + ' only takes a number: how many bytes to drop from the stack.');
        return { op: mn === 'RETF' ? O.RETF : O.RET, a: parts[0] || null, len: parts[0] ? 3 : 1 };
      }
      if (mn === 'INT' || mn === 'INT3') {
        if (mn === 'INT3') { needOps(s2, 0, mn); return { op: O.INT, n: 3, len: 1 }; }
        const [t] = needOps(s2, 1, mn);
        if (t.k !== K_IMM) throw new AsmError('INT needs a number, like INT 21h.');
        const v = tryEval(t.ast);
        if (v != null && (v < 0 || v > 255)) throw new AsmError('INT ' + v + ' is not an interrupt: they go from 0 to 255 (0FFh).');
        if (t.ast.n === 'num' && /^[1-9]\d*$/.test(t.ast.tok || '') && [10, 16, 20, 21, 26].indexOf(v) !== -1) {
          warn(st.ln, 'INT ' + t.ast.tok + ' is decimal ' + v + ' (' + v.toString(16).toUpperCase() + 'h). For INT ' + t.ast.tok + 'h write ' + t.ast.tok + 'h or 0' + t.ast.tok + '.');
        }
        return { op: O.INT, a: t, len: v === 3 ? 1 : 2 };
      }
      if (mn === 'AAM' || mn === 'AAD') {
        const parts = s2.ops.length ? needOps(s2, 1, mn) : [];
        return { op: mn === 'AAM' ? O.AAM : O.AAD, a: parts[0] || null, len: 2 };
      }
      if (mn === 'PUSH' || mn === 'POP') {
        const [a] = needOps(s2, 1, mn);
        if (a.k === K_R8 || (a.k === K_MEM && a.size === 1)) throw new AsmError(mn + ' works on words only; ' + (a.name || 'a byte') + ' is a byte.');
        if (a.k === K_IMM && mn === 'POP') throw new AsmError('POP needs somewhere to put the value: a register or memory.');
        if (a.k === K_SR && a.r === CS && mn === 'POP') throw new AsmError('POP CS does not exist on the 8086 (use RETF or a far JMP).');
        if (a.k === K_MEM && !a.size) a.size = 2;
        const len = a.k === K_R16 || a.k === K_SR ? 1 : a.k === K_IMM ? (immFits8(tryEval(a.ast)) ? 2 : 3) : 1 + memLen(a) + segPrefix(a);
        return { op: mn === 'PUSH' ? O.PUSH : O.POP, a, len };
      }
      if (mn in UNARY) {
        const [a] = needOps(s2, 1, mn);
        if (a.k === K_IMM) throw new AsmError(mn + ' needs a register or memory, not a number.' + (mn === 'MUL' || mn === 'DIV' ? ' Put the number in a register first.' : ''));
        if (a.k === K_SR) throw new AsmError(mn + ' cannot work on a segment register.');
        if (!a.size) throw new AsmError(mn + ' cannot tell whether this is a byte or a word. Write B[...] or W[...].');
        const len = (mn === 'INC' || mn === 'DEC') && a.k === K_R16 ? 1 : 1 + memLen(a) + segPrefix(a);
        return { op: UNARY[mn], a, size: a.size, len };
      }
      if (mn in SHIFT) {
        const [a, c] = needOps(s2, 2, mn);
        if (a.k === K_IMM || a.k === K_SR) throw new AsmError(mn + ' shifts a register or memory.');
        if (!a.size) throw new AsmError(mn + ' cannot tell whether this is a byte or a word. Write B[...] or W[...].');
        if (!(c.k === K_IMM || (c.k === K_R8 && c.r === 1))) throw new AsmError(mn + ' shifts by 1, by a number, or by CL.');
        const one = c.k === K_IMM && tryEval(c.ast) === 1;
        return { op: O.SHIFT, sub: SHIFT[mn], a, b: c, size: a.size, len: 1 + memLen(a) + segPrefix(a) + (c.k === K_IMM && !one ? 1 : 0) };
      }
      if (mn === 'LEA' || mn === 'LDS' || mn === 'LES') {
        const [a, b] = needOps(s2, 2, mn);
        if (a.k !== K_R16) throw new AsmError(mn + ' loads into a 16-bit register, such as ' + (mn === 'LEA' ? 'DX' : 'SI') + '.');
        if (b.k !== K_MEM) throw new AsmError(mn + ' needs a memory operand: a variable or [ ].');
        return { op: mn === 'LEA' ? O.LEA : mn === 'LDS' ? O.LDS : O.LES, a, b, len: 1 + memLen(b) + segPrefix(b) };
      }
      if (mn === 'XCHG') {
        const [a, b] = needOps(s2, 2, mn);
        if (a.k === K_IMM || b.k === K_IMM || a.k === K_SR || b.k === K_SR) throw new AsmError('XCHG swaps two registers, or a register and memory.');
        if (a.k === K_MEM && b.k === K_MEM) throw new AsmError('XCHG cannot swap two memory places; one side has to be a register.');
        const size = pairSize(a, b, mn);
        const len = ((a.k === K_R16 && a.r === AX) || (b.k === K_R16 && b.r === AX)) && a.k !== K_MEM && b.k !== K_MEM ? 1 : 1 + memLen(a.k === K_MEM ? a : b) + segPrefix(a) + segPrefix(b);
        return { op: O.XCHG, a, b, size, len };
      }
      if (mn === 'IN' || mn === 'OUT') {
        const [a, b] = needOps(s2, 2, mn);
        const acc = mn === 'IN' ? a : b, port = mn === 'IN' ? b : a;
        if (!((acc.k === K_R8 && acc.r === 0) || (acc.k === K_R16 && acc.r === AX))) throw new AsmError(mn + ' moves through AL or AX only.');
        if (!(port.k === K_IMM || (port.k === K_R16 && port.r === DX))) throw new AsmError('The port has to be a number up to 255, or DX.');
        return { op: mn === 'IN' ? O.IN : O.OUT, acc, port, size: acc.size, len: port.k === K_IMM ? 2 : 1 };
      }
      if (mn === 'MOV' || mn in ALU || mn === 'TEST') {
        const [a, b] = needOps(s2, 2, mn);
        if (a.k === K_IMM) throw new AsmError(mn + ' cannot write into a number; the first operand is where the result goes.');
        if (a.k === K_MEM && b.k === K_MEM) throw new AsmError(mn + ' cannot use two memory operands; load one into a register first.');
        if (mn === 'MOV' && (a.k === K_SR || b.k === K_SR)) {
          if (a.k === K_SR && b.k === K_SR) throw new AsmError('MOV cannot copy one segment register to another; go through AX.');
          if (a.k === K_SR && a.r === CS) throw new AsmError('MOV cannot load CS; a far JMP or RETF changes it.');
          const other = a.k === K_SR ? b : a;
          if (other.k === K_R8 || (other.k === K_MEM && other.size === 1)) throw new AsmError('Segment registers are words; ' + (other.name || 'that byte') + ' is a byte.');
          if (other.k === K_MEM && !other.size) other.size = 2;
          if (other.k === K_IMM) checkImm(other, 2);
          return { op: O.MOV, a, b, size: 2, len: other.k === K_IMM ? 4 : 1 + memLen(other) + segPrefix(other) };
        }
        if (mn !== 'MOV' && (a.k === K_SR || b.k === K_SR)) throw new AsmError(mn + ' cannot use a segment register; copy it to AX first.');
        const size = pairSize(a, b, mn);
        if (b.k === K_IMM) checkImm(b, size);
        let len;
        const acc = (a.k === K_R8 && a.r === 0) || (a.k === K_R16 && a.r === AX);
        if (b.k === K_IMM) {
          if (mn === 'MOV') len = a.k === K_MEM ? 1 + memLen(a) + size : 1 + size;
          else if (acc) len = 1 + size;
          else if (mn === 'TEST') len = 1 + memLen(a) + size;
          else len = 1 + memLen(a) + (size === 1 || immFits8(tryEval(b.ast)) ? 1 : 2);
        } else if (mn === 'MOV' && acc && b.k === K_MEM && b.base < 0 && b.index < 0) len = 3;
        else if (mn === 'MOV' && a.k === K_MEM && a.base < 0 && a.index < 0 && ((b.k === K_R8 && b.r === 0) || (b.k === K_R16 && b.r === AX))) len = 3;
        else len = 1 + memLen(a.k === K_MEM ? a : b);
        len += segPrefix(a) + segPrefix(b);
        const op = mn === 'MOV' ? O.MOV : mn === 'TEST' ? O.TEST : O.ALU;
        return { op, sub: ALU[mn], a, b, size, len };
      }
      throw new AsmError(mn + ' is not supported here.');
    }
    let pendingRep = 0;

    order.forEach(st => {
      if (st.sectionBreak) { if (here & 1) here++; return; }
      try { layout(st); } catch (e) {
        if (e instanceof AsmError) err(st.ln, e.message); else throw e;
      }
    });

    /* ── Pass 2: values ── */

    const resolve = (o, idx, at) => {
      if (!o) return;
      if (o.k === K_IMM) o.v = evaluate(o.ast, { here: at, idx }, true);
      else if (o.k === K_MEM) o.disp = (evaluate(o.ast, { here: at, idx }, true) | 0) & 0xFFFF;
    };
    ins.forEach(o => {
      try {
        resolve(o.a, o.idx, o.addr);
        resolve(o.b, o.idx, o.addr);
        resolve(o.port, o.idx, o.addr);
        resolve(o.acc, o.idx, o.addr);
        if (o.op === O.INT && o.a) o.n = o.a.v & 0xFF;
        if ((o.op === O.MOV || o.op === O.ALU || o.op === O.TEST) && o.b && o.b.k === K_IMM) {
          const v = o.b.v;
          if (o.size === 1 && (v < -128 || v > 255)) throw new AsmError(v + ' does not fit in a byte (-128 to 255).');
          if (o.size === 2 && (v < -32768 || v > 65535)) throw new AsmError(v + ' does not fit in a word (-32768 to 65535).');
        }
      } catch (e) {
        if (e instanceof AsmError) err(o.ln, e.message); else throw e;
      }
    });
    data.forEach(d => {
      let at = d.addr;
      const put = (v, size, ln) => {
        for (let k = 0; k < size; k++) { image[(at + k) & 0xFFFF] = (v >> (8 * k)) & 0xFF; }
        at += size;
      };
      const emit = (items) => items.forEach(it => {
        if (it.dup != null) { for (let r = 0; r < it.dup; r++) emit(it.sub); return; }
        if (it.str != null) { for (const ch of it.str) put(charCode(ch), d.size); return; }
        let v = 0;
        try { v = evaluate(it.ast, { here: at, idx: d.idx }, true); } catch (e) { if (e instanceof AsmError) err(d.ln, e.message); else throw e; }
        if (d.size === 1 && (v < -128 || v > 255)) err(d.ln, v + ' does not fit in a byte (DB holds -128 to 255).');
        if (d.size === 2 && (v < -32768 || v > 65535)) err(d.ln, v + ' does not fit in a word (DW holds -32768 to 65535).');
        if (d.size === 4 && it.ast.n === 'sym') {
          const def = lookup(it.ast.u, d.idx, it.ast.fwd);
          if (def && (def.kind === 'label' || def.kind === 'var')) v = (LOAD_SEG << 16) | (v & 0xFFFF);
        }
        put(v, d.size > 4 ? 4 : d.size);
        if (d.size > 4) at += d.size - 4;
      });
      emit(d.items);
    });

    let entry = origin;
    if (entryAst) {
      try { entry = evaluate(entryAst, { here: 0, idx: entryIdx }, true) & 0xFFFF; } catch (e) { if (e instanceof AsmError) err(stmts[entryIdx].ln, e.message); }
    } else if (usesSections && ins.length) entry = ins[0].addr;
    const program = {
      seg: LOAD_SEG, entry, origin, image, ins, data, lines, fileName,
      end: here
    };
    if (!errors.length) {
      if (!ins.length) err(0, 'There are no instructions to run yet.');
      else if (!ins.some(o => o.addr === entry)) {
        const d = data.find(x => x.addr <= entry && entry < x.addr + Math.max(1, x.items.reduce((n, it) => n + it.count, 0)));
        if (d) {
          err(d.ln, 'DOS starts a .COM program at its very first byte (' + hex4(entry) + 'h), and here that is data, not an instruction. '
            + 'Put the data after the code, or jump over it: JMP start at the top, then start: before the first instruction.');
        } else err(0, 'The program does not start on an instruction (' + hex4(entry) + 'h).');
      }
    }
    errors.sort((a, b) => a.line - b.line);
    return { ok: errors.length === 0, errors, warnings, program: errors.length ? null : program };
  }

  function charCode(ch) {
    const c = String(ch).charCodeAt(0);
    if (c < 128) return c;
    return CP437_BACK.has(ch) ? CP437_BACK.get(ch) : 0x3F;
  }
  function hex4(v) { return ('000' + (v & 0xFFFF).toString(16).toUpperCase()).slice(-4); }
  function hex2(v) { return ('0' + (v & 0xFF).toString(16).toUpperCase()).slice(-2); }

  /** The name in `list` nearest `u` (edit distance at most `max`), or ''. */
  function closest(u, list, max) {
    let best = '', bestD = max + 1;
    list.forEach(w => {
      if (Math.abs(w.length - u.length) > max) return;
      const d = editDistance(u, w);
      if (d < bestD && d > 0) { bestD = d; best = w; }
    });
    return best;
  }
  function editDistance(a, b) {
    const prev = new Array(b.length + 1).fill(0).map((_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      let diag = prev[0];
      prev[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const t = prev[j];
        prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
        diag = t;
      }
    }
    return prev[b.length];
  }

  /* ── The machine ───────────────────────────────────────────── */

  const PAR = new Uint8Array(256);
  for (let i = 0; i < 256; i++) { let b = i, p = 1; while (b) { p ^= b & 1; b >>= 1; } PAR[i] = p; }

  const s8 = (v) => (v & 0x80 ? (v & 0xFF) - 0x100 : v & 0xFF);
  const s16 = (v) => (v & 0x8000 ? (v & 0xFFFF) - 0x10000 : v & 0xFFFF);

  /** The default VGA palette (6-bit DAC values) for mode 13h. */
  function vgaPalette() {
    const p = new Uint8Array(768);
    const ega = [0, 0, 0, 0, 0, 42, 0, 42, 0, 0, 42, 42, 42, 0, 0, 42, 0, 42, 42, 21, 0, 42, 42, 42,
      21, 21, 21, 21, 21, 63, 21, 63, 21, 21, 63, 63, 63, 21, 21, 63, 21, 63, 63, 63, 21, 63, 63, 63];
    p.set(ega, 0);
    const grays = [0, 5, 8, 11, 14, 17, 20, 24, 28, 32, 36, 40, 45, 50, 56, 63];
    grays.forEach((g, i) => { p[(16 + i) * 3] = g; p[(16 + i) * 3 + 1] = g; p[(16 + i) * 3 + 2] = g; });
    // 9 blocks of 24 hues: three intensities by three saturations.
    const levels = [[63, 31, 0], [63, 45, 31], [63, 54, 45], [28, 14, 0], [28, 20, 14], [28, 24, 20], [16, 8, 0], [16, 11, 8], [16, 13, 11]];
    let idx = 32;
    levels.forEach(([hi, , lo]) => {
      const ramp = [lo, (lo * 3 + hi) >> 2, (lo + hi) >> 1, (lo + hi * 3) >> 2, hi];
      // Around the colour wheel in 24 steps: B, then R up, B down, G up, R down, B up, G down.
      const seq = [];
      for (let k = 0; k < 5; k++) seq.push([ramp[k], lo, hi]);
      for (let k = 3; k >= 0; k--) seq.push([hi, lo, ramp[k]]);
      for (let k = 1; k < 5; k++) seq.push([hi, ramp[k], lo]);
      for (let k = 3; k >= 0; k--) seq.push([ramp[k], hi, lo]);
      for (let k = 1; k < 5; k++) seq.push([lo, hi, ramp[k]]);
      for (let k = 3; k >= 1; k--) seq.push([lo, ramp[k], hi]);
      seq.slice(0, 24).forEach(([r, g, b]) => { p[idx * 3] = r; p[idx * 3 + 1] = g; p[idx * 3 + 2] = b; idx++; });
    });
    return p;
  }

  /**
   * A DOS machine with `prog` loaded, as COMMAND.COM would leave it.
   * @param {object} prog assemble(...).program
   * @param {{name?: string, now?: function(): number}} [opts]
   */
  function createMachine(prog, opts) {
    const o = opts || {};
    const now = typeof o.now === 'function' ? o.now : () => Date.now();
    const SEG = prog.seg;
    const mem = new Uint8Array(0x100000 + 4);
    const regs = new Uint16Array(8);
    const sregs = new Uint16Array(4);
    let ip = prog.entry;
    let CF = 0, PF = 0, AF = 0, ZF = 0, SF = 0, TF = 0, IF = 1, DF = 0, OF = 0;
    const codeAt = new Int32Array(0x10000).fill(-1);
    const code = prog.ins;
    code.forEach((ins, i) => { codeAt[ins.addr] = i; });
    const base = SEG * 16;
    mem.set(prog.image, base);
    // Code bytes read as NOPs if a program looks at itself.
    code.forEach(ins => { for (let k = 0; k < ins.len; k++) if (base + ins.addr + k < base + 0x10000) mem[base + ins.addr + k] = 0x90; });
    // The PSP: INT 20h at offset 0, memory top, an empty command tail.
    mem[base] = 0xCD; mem[base + 1] = 0x20;
    mem[base + 2] = 0xFF; mem[base + 3] = 0x9F;
    mem[base + 0x80] = 0; mem[base + 0x81] = 0x0D;
    for (let s = 0; s < 4; s++) sregs[s] = SEG;
    regs[SP] = 0xFFFE;
    regs[CX] = 0x00FF;
    regs[SI] = prog.entry; regs[DI] = 0xFFFE;

    // Screen: text mode 3, the BIOS data area mirrors the cursor.
    let vmode = 3, crow = 0, ccol = 0, cursorOn = true, blink = true, dirty = true;
    const pal = vgaPalette();
    let palIndex = 0, palSub = 0, palReadIndex = 0, retrace = 0;
    const TXT = 0xB8000;
    function clearText(attr) { for (let a = TXT; a < TXT + 4000; a += 2) { mem[a] = 0x20; mem[a + 1] = attr; } }
    clearText(0x07);
    mem[0x449] = 3; mem[0x44A] = 80;
    const prompt = 'C:\\>' + String(o.name || 'MAIN').toUpperCase();
    for (let i = 0; i < prompt.length && i < 80; i++) mem[TXT + i * 2] = prompt.charCodeAt(i);
    crow = 1;
    syncCursor();

    const keys = [];                 // {ascii, scan}
    let lastScan = 0;
    let state = 'run';               // run | key | sleep | exit | error
    let exitCode = 0, message = '', errLine = 0;
    let lineEdit = null;             // INT 21h 0Ah / 3Fh in progress
    let pendingExt = -1;             // the scan code DOS hands out after a 0 for an extended key
    let wakeAt = 0, sleeping = false;
    let steps = 0;
    const notes = new Set();
    const t0 = now();

    function syncCursor() { mem[0x450] = ccol; mem[0x451] = crow; dirty = true; }

    /* Memory */
    const lin = (seg, off) => ((seg << 4) + (off & 0xFFFF)) & 0xFFFFF;
    function ea(op) {
      let off = op.disp;
      if (op.base >= 0) off += regs[op.base];
      if (op.index >= 0) off += regs[op.index];
      const s = op.seg >= 0 ? op.seg : (op.base === BP ? SS : DS);
      return ((sregs[s] << 4) + (off & 0xFFFF)) & 0xFFFFF;
    }
    function wb(a, v) {
      mem[a] = v;
      if (a >= 0xA0000 && a < 0xC0000) dirty = true;
    }
    const rw = (a) => mem[a] | (mem[(a + 1) & 0xFFFFF] << 8);
    function ww(a, v) { wb(a, v & 0xFF); wb((a + 1) & 0xFFFFF, (v >> 8) & 0xFF); }
    const get8 = (r) => (r < 4 ? regs[r] & 0xFF : regs[r - 4] >> 8);
    function set8(r, v) {
      if (r < 4) regs[r] = (regs[r] & 0xFF00) | (v & 0xFF);
      else regs[r - 4] = (regs[r - 4] & 0x00FF) | ((v & 0xFF) << 8);
    }
    function rd(op, w) {
      switch (op.k) {
        case K_R8: return get8(op.r);
        case K_R16: return regs[op.r];
        case K_SR: return sregs[op.r];
        case K_IMM: return op.v & (w ? 0xFFFF : 0xFF);
        default: { const a = ea(op); return w ? rw(a) : mem[a]; }
      }
    }
    function wr(op, w, v) {
      switch (op.k) {
        case K_R8: set8(op.r, v); return;
        case K_R16: regs[op.r] = v; return;
        case K_SR: sregs[op.r] = v; return;
        case K_MEM: { const a = ea(op); if (w) ww(a, v); else wb(a, v & 0xFF); }
      }
    }
    function push(v) { regs[SP] = (regs[SP] - 2) & 0xFFFF; ww(lin(sregs[SS], regs[SP]), v); }
    function pop() { const v = rw(lin(sregs[SS], regs[SP])); regs[SP] = (regs[SP] + 2) & 0xFFFF; return v; }

    /* Flags */
    function szp(v, w) {
      ZF = v === 0 ? 1 : 0;
      SF = (v >> (w ? 15 : 7)) & 1;
      PF = PAR[v & 0xFF];
    }
    function add(a, b, c, w) {
      const m = w ? 0xFFFF : 0xFF, sb = w ? 0x8000 : 0x80;
      const r = a + b + c, res = r & m;
      CF = r > m ? 1 : 0;
      OF = ((a ^ res) & (b ^ res) & sb) ? 1 : 0;
      AF = ((a ^ b ^ res) & 0x10) ? 1 : 0;
      szp(res, w);
      return res;
    }
    function sub(a, b, c, w) {
      const m = w ? 0xFFFF : 0xFF, sb = w ? 0x8000 : 0x80;
      const r = a - b - c, res = r & m;
      CF = r < 0 ? 1 : 0;
      OF = ((a ^ b) & (a ^ res) & sb) ? 1 : 0;
      AF = ((a ^ b ^ res) & 0x10) ? 1 : 0;
      szp(res, w);
      return res;
    }
    function logic(res, w) { CF = 0; OF = 0; AF = 0; szp(res, w); return res; }
    const flagsWord = () => 0xF002 | CF | (PF << 2) | (AF << 4) | (ZF << 6) | (SF << 7) | (TF << 8) | (IF << 9) | (DF << 10) | (OF << 11);
    function setFlags(f) {
      CF = f & 1; PF = (f >> 2) & 1; AF = (f >> 4) & 1; ZF = (f >> 6) & 1; SF = (f >> 7) & 1;
      TF = (f >> 8) & 1; IF = (f >> 9) & 1; DF = (f >> 10) & 1; OF = (f >> 11) & 1;
    }
    function cond(c) {
      switch (c) {
        case 0: return OF; case 1: return !OF; case 2: return CF; case 3: return !CF;
        case 4: return ZF; case 5: return !ZF; case 6: return CF || ZF; case 7: return !CF && !ZF;
        case 8: return SF; case 9: return !SF; case 10: return PF; case 11: return !PF;
        case 12: return SF !== OF; case 13: return SF === OF; case 14: return ZF || SF !== OF; default: return !ZF && SF === OF;
      }
    }
    function shift(kind, v, cnt, w) {
      if (!cnt) return v;
      const bits = w ? 16 : 8, m = w ? 0xFFFF : 0xFF, sb = 1 << (bits - 1);
      let hi, lo;
      switch (kind) {
        case 0: for (let i = 0; i < cnt; i++) { hi = (v & sb) ? 1 : 0; v = ((v << 1) | hi) & m; CF = hi; } OF = ((v & sb) ? 1 : 0) ^ CF; return v;
        case 1: for (let i = 0; i < cnt; i++) { lo = v & 1; v = (v >>> 1) | (lo ? sb : 0); CF = lo; } OF = ((v >> (bits - 1)) ^ (v >> (bits - 2))) & 1; return v;
        case 2: for (let i = 0; i < cnt; i++) { hi = (v & sb) ? 1 : 0; v = ((v << 1) | CF) & m; CF = hi; } OF = ((v & sb) ? 1 : 0) ^ CF; return v;
        case 3: OF = ((v & sb) ? 1 : 0) ^ CF; for (let i = 0; i < cnt; i++) { lo = v & 1; v = (v >>> 1) | (CF ? sb : 0); CF = lo; } return v;
        case 4: for (let i = 0; i < cnt; i++) { CF = (v & sb) ? 1 : 0; v = (v << 1) & m; } OF = ((v & sb) ? 1 : 0) ^ CF; AF = 0; szp(v, w); return v;
        case 5: OF = (v & sb) ? 1 : 0; for (let i = 0; i < cnt; i++) { CF = v & 1; v >>>= 1; } AF = 0; szp(v, w); return v;
        default: for (let i = 0; i < cnt; i++) { CF = v & 1; v = (v >>> 1) | (v & sb); } OF = 0; AF = 0; szp(v, w); return v;
      }
    }

    /* Ending */
    function finish(code2) { state = 'exit'; exitCode = code2 & 0xFF; }
    function fail(msg, line) { state = 'error'; message = msg; errLine = line || 0; }

    /* ── The screen (BIOS) ── */
    function putChar(row, col, ch, attr) {
      const a = TXT + (row * 80 + col) * 2;
      mem[a] = ch;
      if (attr != null) mem[a + 1] = attr;
      dirty = true;
    }
    function scroll(up, n, attr, r0, c0, r1, c1) {
      r1 = Math.min(r1, 24); c1 = Math.min(c1, 79);
      if (r0 > r1 || c0 > c1) return;
      const h = r1 - r0 + 1;
      if (n === 0 || n > h) n = h;
      const cell = (r, c) => TXT + (r * 80 + c) * 2;
      if (up) {
        for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
          const from = r + n;
          if (from <= r1) { mem[cell(r, c)] = mem[cell(from, c)]; mem[cell(r, c) + 1] = mem[cell(from, c) + 1]; }
          else { mem[cell(r, c)] = 0x20; mem[cell(r, c) + 1] = attr; }
        }
      } else {
        for (let r = r1; r >= r0; r--) for (let c = c0; c <= c1; c++) {
          const from = r - n;
          if (from >= r0) { mem[cell(r, c)] = mem[cell(from, c)]; mem[cell(r, c) + 1] = mem[cell(from, c) + 1]; }
          else { mem[cell(r, c)] = 0x20; mem[cell(r, c) + 1] = attr; }
        }
      }
      dirty = true;
    }
    function tty(ch) {
      if (vmode === 0x13) {
        if (ch === 13) ccol = 0; else if (ch === 10) crow++; else if (ch === 8) { if (ccol) ccol--; } else if (ch !== 7) { notes.add('Text in graphics mode (13h) is not drawn here.'); ccol++; }
        if (ccol >= 40) { ccol = 0; crow++; }
        if (crow >= 25) crow = 24;
        syncCursor();
        return;
      }
      switch (ch) {
        case 7: break;
        case 8: if (ccol > 0) ccol--; break;
        case 10: crow++; break;
        case 13: ccol = 0; break;
        default:
          putChar(crow, ccol, ch);
          if (++ccol >= 80) { ccol = 0; crow++; }
      }
      if (crow >= 25) { scroll(true, 1, 0x07, 0, 0, 24, 79); crow = 24; }
      syncCursor();
    }
    /** DOS console output: TTY with tabs expanded. */
    function dosOut(ch) {
      if (ch === 9) { do { tty(0x20); } while (ccol % 8); return; }
      tty(ch);
    }
    function setMode(m) {
      const keep = m & 0x80;
      m &= 0x7F;
      vmode = m === 0x13 ? 0x13 : 3;
      if (m !== 3 && m !== 2 && m !== 0x13 && m !== 7 && m !== 0 && m !== 1) notes.add('Video mode ' + hex2(m) + 'h is shown as text mode 3.');
      mem[0x449] = vmode;
      if (!keep) {
        if (vmode === 0x13) mem.fill(0, 0xA0000, 0xA0000 + 64000); else clearText(0x07);
      }
      crow = 0; ccol = 0;
      pal.set(vgaPalette());
      syncCursor();
    }

    /* ── Keyboard ── */
    function takeKey() { return keys.length ? keys.shift() : null; }
    function ctrlC() {
      const i = keys.findIndex(k => k.ascii === 3);
      if (i === -1) return false;
      keys.splice(i, 1);
      dosOut(0x5E); dosOut(0x43); dosOut(13); dosOut(10);
      finish(0);
      message = 'Stopped with Ctrl+C.';
      return true;
    }
    /** DOS character input. echo: show it. Returns the byte, or -1 to wait. */
    function dosKey(echo) {
      if (pendingExt >= 0) { const s = pendingExt; pendingExt = -1; return s; }
      const k = takeKey();
      if (!k) return -1;
      if (k.ascii === 3) { keys.unshift(k); ctrlC(); return -2; }
      if (k.ascii === 0 || k.ascii === 0xE0) pendingExt = k.scan;
      if (echo && k.ascii) dosOut(k.ascii);
      return k.ascii === 0xE0 ? 0 : k.ascii;
    }
    /** Buffered line input (INT 21h 0Ah, and 3Fh from the keyboard). Returns true when Enter ended it. */
    function lineInput(max) {
      if (!lineEdit) lineEdit = { chars: [], max };
      let k;
      while ((k = takeKey())) {
        const c = k.ascii;
        if (c === 3) { keys.unshift(k); ctrlC(); lineEdit = null; return false; }
        if (c === 13) return true;
        if (c === 8) {
          if (lineEdit.chars.length) { lineEdit.chars.pop(); tty(8); tty(0x20); tty(8); }
          continue;
        }
        if (c === 27) { lineEdit.chars = []; dosOut(0x5C); tty(13); tty(10); continue; }
        if (c === 0 || c === 0xE0) continue;
        if (lineEdit.chars.length < lineEdit.max - 1) { lineEdit.chars.push(c); dosOut(c); }
      }
      return false;
    }

    /* ── Interrupts ── */
    function vector(n) { return { off: rw(n * 4), seg: rw(n * 4 + 2) }; }
    /** Enter an interrupt the program installed (or a stub of ours in F000). */
    function softInt(n, nextIp) {
      const v = vector(n);
      if (v.off === 0 && v.seg === 0) return false;
      push(flagsWord()); push(sregs[CS]); push(nextIp);
      IF = 0; TF = 0;
      sregs[CS] = v.seg; ip = v.off;
      return true;
    }
    /** Native DOS and BIOS. Returns 'ok', 'wait', 'sleep' or 'stop'. */
    function native(n) {
      const ah = regs[AX] >> 8, al = regs[AX] & 0xFF;
      switch (n) {
        case 0x20: finish(0); return 'stop';
        case 0x21: return int21(ah, al);
        case 0x10: return int10(ah, al);
        case 0x16: return int16(ah);
        case 0x1A: {
          const d = new Date(now());
          if (ah === 0) {
            const ms = d.getHours() * 3600000 + d.getMinutes() * 60000 + d.getSeconds() * 1000 + d.getMilliseconds();
            const ticks = Math.floor(ms * 1193180 / 65536 / 1000);
            regs[CX] = ticks >>> 16; regs[DX] = ticks & 0xFFFF; set8(0, 0);
          } else if (ah === 2) {
            const bcd = (v) => ((Math.floor(v / 10) << 4) | (v % 10));
            regs[CX] = (bcd(d.getHours()) << 8) | bcd(d.getMinutes()); regs[DX] = bcd(d.getSeconds()) << 8; CF = 0;
          } else if (ah === 4) {
            const bcd = (v) => ((Math.floor(v / 10) << 4) | (v % 10));
            const y = d.getFullYear();
            regs[CX] = (bcd(Math.floor(y / 100)) << 8) | bcd(y % 100); regs[DX] = (bcd(d.getMonth() + 1) << 8) | bcd(d.getDate()); CF = 0;
          }
          return 'ok';
        }
        case 0x15:
          if (ah === 0x86) {
            if (!sleeping) { wakeAt = now() + ((regs[CX] * 65536 + regs[DX]) / 1000); sleeping = true; return 'sleep'; }
            if (now() < wakeAt) return 'sleep';
            sleeping = false; CF = 0;
            return 'ok';
          }
          CF = 1; set8(4, 0x86);
          return 'ok';
        case 0x27: finish(0); return 'stop';
        case 0x11: regs[AX] = 0x0021; return 'ok';
        case 0x12: regs[AX] = 640; return 'ok';
        case 0x05: return 'ok';
        case 0x00: divideError(); return 'stop';
        case 0x03: fail('Breakpoint (INT 3): the program stopped here on purpose.'); return 'stop';
        case 0x19: finish(0); message = 'INT 19h restarts the computer; the program ended.'; return 'stop';
      }
      fail('INT ' + hex2(n) + 'h is not available here. Supported: INT 20h, 21h (DOS), 10h (video), 16h (keyboard), 1Ah (clock), 15h AH=86h (wait).');
      return 'stop';
    }
    function int21(ah, al) {
      switch (ah) {
        case 0x00: finish(0); return 'stop';
        case 0x01: {
          if (ctrlC()) return 'stop';
          const c = dosKey(true);
          if (c === -2) return 'stop';
          if (c < 0) return 'wait';
          set8(0, c);
          return 'ok';
        }
        case 0x02: if (ctrlC()) return 'stop'; dosOut(regs[DX] & 0xFF); set8(0, regs[DX] & 0xFF); return 'ok';
        case 0x06: {
          const dl = regs[DX] & 0xFF;
          if (dl !== 0xFF) { dosOut(dl); set8(0, dl); return 'ok'; }
          const c = dosKey(false);
          if (c < 0) { ZF = 1; set8(0, 0); } else { ZF = 0; set8(0, c); }
          return 'ok';
        }
        case 0x07: case 0x08: {
          if (ah === 0x08 && ctrlC()) return 'stop';
          const c = dosKey(false);
          if (c === -2) return 'stop';
          if (c < 0) return 'wait';
          set8(0, c);
          return 'ok';
        }
        case 0x09: {
          if (ctrlC()) return 'stop';
          let a = lin(sregs[DS], regs[DX]), n = 0;
          while (mem[a] !== 0x24) {
            dosOut(mem[a]);
            a = (a + 1) & 0xFFFFF;
            if (++n >= 4000) { notes.add('INT 21h AH=09h printed 4000 characters without finding the "$" that ends a string. Did the string end with \'$\'?'); break; }
          }
          set8(0, 0x24);
          return 'ok';
        }
        case 0x0A: {
          const at = lin(sregs[DS], regs[DX]);
          const max = mem[at];
          if (!max) return 'ok';
          if (!lineInput(max)) return state === 'run' ? 'wait' : 'stop';
          const chars = lineEdit.chars;
          lineEdit = null;
          mem[(at + 1) & 0xFFFFF] = chars.length;
          chars.forEach((c, i) => { mem[(at + 2 + i) & 0xFFFFF] = c; });
          mem[(at + 2 + chars.length) & 0xFFFFF] = 0x0D;
          tty(13);
          return 'ok';
        }
        case 0x0B: set8(0, keys.length || pendingExt >= 0 ? 0xFF : 0); return 'ok';
        case 0x0C: {
          keys.length = 0; pendingExt = -1;
          if (al === 0x01 || al === 0x06 || al === 0x07 || al === 0x08 || al === 0x0A) { regs[AX] = (al << 8) | al; return int21(al, al); }
          return 'ok';
        }
        case 0x0E: set8(0, 26); return 'ok';
        case 0x19: set8(0, 2); return 'ok';
        case 0x25: { const v = al * 4; ww(v, regs[DX]); ww(v + 2, sregs[DS]); return 'ok'; }
        case 0x35: {
          const v = vector(al);
          if (v.off === 0 && v.seg === 0) { regs[BX] = al; sregs[ES] = 0xF000; } else { regs[BX] = v.off; sregs[ES] = v.seg; }
          return 'ok';
        }
        case 0x2A: {
          const d = new Date(now());
          regs[CX] = d.getFullYear(); regs[DX] = ((d.getMonth() + 1) << 8) | d.getDate(); set8(0, d.getDay());
          return 'ok';
        }
        case 0x2C: {
          const d = new Date(now());
          regs[CX] = (d.getHours() << 8) | d.getMinutes(); regs[DX] = (d.getSeconds() << 8) | Math.floor(d.getMilliseconds() / 10);
          return 'ok';
        }
        case 0x30: regs[AX] = 0x0005; regs[BX] = 0; regs[CX] = 0; return 'ok';
        case 0x33: set8(2, 0); return 'ok';
        case 0x40: {
          const h = regs[BX];
          if (h === 1 || h === 2) {
            let a = lin(sregs[DS], regs[DX]);
            for (let i = 0; i < regs[CX]; i++) { dosOut(mem[a]); a = (a + 1) & 0xFFFFF; }
            regs[AX] = regs[CX]; CF = 0;
            return 'ok';
          }
          break;
        }
        case 0x3F: {
          if (regs[BX] === 0) {
            if (!lineInput(Math.min(128, regs[CX] + 1))) return state === 'run' ? 'wait' : 'stop';
            const chars = lineEdit.chars.concat([13, 10]).slice(0, regs[CX]);
            lineEdit = null;
            tty(13); tty(10);
            let a = lin(sregs[DS], regs[DX]);
            chars.forEach(c => { mem[a] = c; a = (a + 1) & 0xFFFFF; });
            regs[AX] = chars.length; CF = 0;
            return 'ok';
          }
          break;
        }
        case 0x4C: finish(al); return 'stop';
        case 0x31: finish(al); return 'stop';
        case 0x47: mem[lin(sregs[DS], regs[SI])] = 0; CF = 0; regs[AX] = 0x0100; return 'ok';
        case 0x51: case 0x62: regs[BX] = SEG; return 'ok';
      }
      const files = ah >= 0x0F && ah <= 0x28 || ah >= 0x39 && ah <= 0x46 || ah === 0x4E || ah === 0x4F || ah === 0x56 || ah === 0x57;
      fail('INT 21h function ' + hex2(ah) + 'h is not available here' + (files ? ' (there are no files or drives in this DOS).' : '.')
        + ' Supported: 01h, 02h, 06h, 07h, 08h, 09h, 0Ah, 0Bh, 0Ch, 25h, 2Ah, 2Ch, 30h, 35h, 3Fh/40h (keyboard and screen), 4Ch.');
      return 'stop';
    }
    function int10(ah, al) {
      switch (ah) {
        case 0x00: setMode(al); return 'ok';
        case 0x01: cursorOn = !((regs[CX] >> 8) & 0x20); dirty = true; return 'ok';
        case 0x02: crow = Math.min(regs[DX] >> 8, 24); ccol = Math.min(regs[DX] & 0xFF, 79); syncCursor(); return 'ok';
        case 0x03: regs[DX] = (crow << 8) | ccol; regs[CX] = 0x0607; return 'ok';
        case 0x05: return 'ok';
        case 0x06: case 0x07:
          if (vmode === 0x13) { if (!al) mem.fill(regs[BX] >> 8, 0xA0000, 0xA0000 + 64000); dirty = true; return 'ok'; }
          scroll(ah === 0x06, al, regs[BX] >> 8, regs[CX] >> 8, regs[CX] & 0xFF, regs[DX] >> 8, regs[DX] & 0xFF);
          return 'ok';
        case 0x08: { const a = TXT + (crow * 80 + ccol) * 2; regs[AX] = (mem[a + 1] << 8) | mem[a]; return 'ok'; }
        case 0x09: case 0x0A: {
          if (vmode === 0x13) { notes.add('Text in graphics mode (13h) is not drawn here.'); return 'ok'; }
          let pos = crow * 80 + ccol;
          for (let i = 0; i < regs[CX] && pos < 2000; i++, pos++) {
            mem[TXT + pos * 2] = al;
            if (ah === 0x09) mem[TXT + pos * 2 + 1] = regs[BX] & 0xFF;
          }
          dirty = true;
          return 'ok';
        }
        case 0x0B: return 'ok';
        case 0x0C:
          if (vmode === 0x13 && regs[CX] < 320 && regs[DX] < 200) { wb(0xA0000 + regs[DX] * 320 + regs[CX], al); }
          return 'ok';
        case 0x0D: set8(0, vmode === 0x13 && regs[CX] < 320 && regs[DX] < 200 ? mem[0xA0000 + regs[DX] * 320 + regs[CX]] : 0); return 'ok';
        case 0x0E: tty(al); return 'ok';
        case 0x0F: regs[AX] = (80 << 8) | vmode; set8(7, 0); return 'ok';
        case 0x10:
          if (al === 0x03) { blink = (regs[BX] & 0xFF) !== 0; dirty = true; }
          else if (al === 0x10) { const i = regs[BX] & 0xFF; pal[i * 3] = regs[DX] >> 8; pal[i * 3 + 1] = regs[CX] >> 8; pal[i * 3 + 2] = regs[CX] & 0xFF; dirty = true; }
          return 'ok';
        case 0x11: case 0x12: return 'ok';
        case 0x13: {
          let a = lin(sregs[ES], regs[BP]);
          const keepR = crow, keepC = ccol;
          crow = regs[DX] >> 8; ccol = regs[DX] & 0xFF;
          for (let i = 0; i < regs[CX]; i++) {
            const ch = mem[a]; a = (a + 1) & 0xFFFFF;
            let attr = regs[BX] & 0xFF;
            if (al & 2) { attr = mem[a]; a = (a + 1) & 0xFFFFF; }
            if (ch === 7 || ch === 8 || ch === 10 || ch === 13) tty(ch);
            else { putChar(crow, ccol, ch, attr); if (++ccol >= 80) { ccol = 0; crow++; } if (crow >= 25) { scroll(true, 1, 0x07, 0, 0, 24, 79); crow = 24; } }
          }
          if (!(al & 1)) { crow = keepR; ccol = keepC; }
          syncCursor();
          return 'ok';
        }
        case 0x1A: regs[AX] = 0x001A; regs[BX] = 0x0008; return 'ok';
      }
      notes.add('INT 10h function ' + hex2(ah) + 'h does nothing here.');
      return 'ok';
    }
    function int16(ah) {
      switch (ah) {
        case 0x00: case 0x10: {
          const k = takeKey();
          if (!k) return 'wait';
          regs[AX] = (k.scan << 8) | k.ascii;
          return 'ok';
        }
        case 0x01: case 0x11: {
          if (!keys.length) { ZF = 1; return 'ok'; }
          ZF = 0; regs[AX] = (keys[0].scan << 8) | keys[0].ascii;
          return 'ok';
        }
        case 0x02: case 0x12: set8(0, 0); return 'ok';
      }
      notes.add('INT 16h function ' + hex2(ah) + 'h does nothing here.');
      return 'ok';
    }
    function divideError() {
      const v = vector(0);
      if (v.off || v.seg) return;
      const msg = 'Divide overflow';
      for (const ch of msg) dosOut(ch.charCodeAt(0));
      dosOut(13); dosOut(10);
      finish(0);
      message = 'Divide overflow: a DIV or IDIV divided by zero, or the answer did not fit in AL (or AX).';
      state = 'error';
    }

    function portIn(port, w) {
      let v = 0xFF;
      if (port === 0x3DA) { retrace ^= 0x09; v = retrace; }
      else if (port === 0x60) v = lastScan;
      else if (port === 0x61) v = 0;
      else if (port === 0x3C9) { v = pal[palReadIndex * 3 + palSub] || 0; if (++palSub === 3) { palSub = 0; palReadIndex = (palReadIndex + 1) & 0xFF; } }
      return w ? v | 0xFF00 : v;
    }
    function portOut(port, v) {
      if (port === 0x3C8) { palIndex = v & 0xFF; palSub = 0; }
      else if (port === 0x3C7) { palReadIndex = v & 0xFF; palSub = 0; }
      else if (port === 0x3C9) { pal[palIndex * 3 + palSub] = v & 0x3F; dirty = true; if (++palSub === 3) { palSub = 0; palIndex = (palIndex + 1) & 0xFF; } }
    }

    /* ── One instruction ── */
    function exec(x) {
      const next = (x.addr + x.len) & 0xFFFF;
      ip = next;
      const w = x.size === 2;
      switch (x.op) {
        case O.MOV:
          if (x.b.k === K_SR || x.a.k === K_SR) { wr(x.a, true, rd(x.b, true)); return; }
          wr(x.a, w, rd(x.b, w));
          return;
        case O.ALU: {
          const a = rd(x.a, w), b = rd(x.b, w);
          let r;
          switch (x.sub) {
            case 0: r = add(a, b, 0, w); break;
            case 1: r = logic(a | b, w); break;
            case 2: r = add(a, b, CF, w); break;
            case 3: r = sub(a, b, CF, w); break;
            case 4: r = logic(a & b, w); break;
            case 5: r = sub(a, b, 0, w); break;
            case 6: r = logic(a ^ b, w); break;
            default: sub(a, b, 0, w); return;
          }
          wr(x.a, w, r);
          return;
        }
        case O.TEST: logic(rd(x.a, w) & rd(x.b, w), w); return;
        case O.INC: { const c = CF; wr(x.a, w, add(rd(x.a, w), 1, 0, w)); CF = c; return; }
        case O.DEC: { const c = CF; wr(x.a, w, sub(rd(x.a, w), 1, 0, w)); CF = c; return; }
        case O.NEG: { const v = rd(x.a, w); wr(x.a, w, sub(0, v, 0, w)); CF = v ? 1 : 0; return; }
        case O.NOT: wr(x.a, w, ~rd(x.a, w) & (w ? 0xFFFF : 0xFF)); return;
        case O.MUL: {
          const v = rd(x.a, w);
          if (!w) { const r = (regs[AX] & 0xFF) * v; regs[AX] = r; CF = OF = (r & 0xFF00) ? 1 : 0; szp(r & 0xFF, false); }
          else { const r = regs[AX] * v; regs[AX] = r & 0xFFFF; regs[DX] = Math.floor(r / 65536); CF = OF = regs[DX] ? 1 : 0; szp(regs[AX], true); }
          return;
        }
        case O.IMUL: {
          const v = rd(x.a, w);
          if (!w) { const r = s8(regs[AX]) * s8(v); regs[AX] = r & 0xFFFF; CF = OF = r < -128 || r > 127 ? 1 : 0; }
          else { const r = s16(regs[AX]) * s16(v); const u = r >>> 0; regs[AX] = u & 0xFFFF; regs[DX] = u >>> 16; CF = OF = r < -32768 || r > 32767 ? 1 : 0; }
          return;
        }
        case O.DIV: {
          const v = rd(x.a, w);
          if (!w) {
            const n = regs[AX];
            if (!v || Math.floor(n / v) > 0xFF) { ip = x.addr; if (!softInt(0, next)) divideError(); return; }
            regs[AX] = ((n % v) << 8) | Math.floor(n / v);
          } else {
            const n = regs[DX] * 65536 + regs[AX];
            if (!v || Math.floor(n / v) > 0xFFFF) { ip = x.addr; if (!softInt(0, next)) divideError(); return; }
            regs[AX] = Math.floor(n / v); regs[DX] = n % v;
          }
          return;
        }
        case O.IDIV: {
          const v = rd(x.a, w);
          if (!w) {
            const n = s16(regs[AX]), d = s8(v);
            const q = d ? Math.trunc(n / d) : 0;
            if (!d || q > 127 || q < -128) { if (!softInt(0, next)) divideError(); return; }
            regs[AX] = (((n - q * d) & 0xFF) << 8) | (q & 0xFF);
          } else {
            const n = (regs[DX] << 16) | regs[AX], d = s16(v);
            const q = d ? Math.trunc(n / d) : 0;
            if (!d || q > 32767 || q < -32768) { if (!softInt(0, next)) divideError(); return; }
            regs[AX] = q & 0xFFFF; regs[DX] = (n - q * d) & 0xFFFF;
          }
          return;
        }
        case O.SHIFT: {
          const cnt = (x.b.k === K_IMM ? x.b.v : regs[CX] & 0xFF) & 0x1F;
          wr(x.a, w, shift(x.sub, rd(x.a, w), cnt, w));
          return;
        }
        case O.PUSH: push(rd(x.a, true)); return;
        case O.POP: wr(x.a, true, pop()); return;
        case O.XCHG: { const a = rd(x.a, w), b = rd(x.b, w); wr(x.a, w, b); wr(x.b, w, a); return; }
        case O.LEA: {
          let off = x.b.disp;
          if (x.b.base >= 0) off += regs[x.b.base];
          if (x.b.index >= 0) off += regs[x.b.index];
          regs[x.a.r] = off & 0xFFFF;
          return;
        }
        case O.LDS: case O.LES: {
          const a = ea(x.b);
          regs[x.a.r] = rw(a);
          sregs[x.op === O.LDS ? DS : ES] = rw((a + 2) & 0xFFFFF);
          return;
        }
        case O.JMP: ip = x.indirect ? rd(x.a, true) : x.a.v & 0xFFFF; return;
        case O.JCC: if (cond(x.cond)) ip = x.a.v & 0xFFFF; return;
        case O.LOOP: {
          regs[CX] = (regs[CX] - 1) & 0xFFFF;
          if (regs[CX] !== 0 && (x.sub === 0 || (x.sub === 1 && ZF) || (x.sub === 2 && !ZF))) ip = x.a.v & 0xFFFF;
          return;
        }
        case O.JCXZ: if (regs[CX] === 0) ip = x.a.v & 0xFFFF; return;
        case O.CALL: { const t = x.indirect ? rd(x.a, true) : x.a.v & 0xFFFF; push(next); ip = t; return; }
        case O.RET: ip = pop(); if (x.a) regs[SP] = (regs[SP] + x.a.v) & 0xFFFF; return;
        case O.RETF: ip = pop(); sregs[CS] = pop(); if (x.a) regs[SP] = (regs[SP] + x.a.v) & 0xFFFF; return;
        case O.JMPF: { const a = ea(x.a); ip = rw(a); sregs[CS] = rw((a + 2) & 0xFFFFF); return; }
        case O.CALLF: { const a = ea(x.a); const t = rw(a), s = rw((a + 2) & 0xFFFFF); push(sregs[CS]); push(next); ip = t; sregs[CS] = s; return; }
        case O.INT: {
          const n = x.n;
          if (softInt(n, next)) return;
          const r = native(n);
          if (r === 'wait' || r === 'sleep') { ip = x.addr; if (state === 'run') state = r === 'wait' ? 'key' : 'sleep'; }
          return;
        }
        case O.INTO: if (OF && !softInt(4, next)) fail('INTO: the overflow flag was set (INT 4).', x.ln + 1); return;
        case O.IRET: ip = pop(); sregs[CS] = pop(); setFlags(pop()); return;
        case O.STR: strOp(x, w); return;
        case O.CLC: CF = 0; return;
        case O.STC: CF = 1; return;
        case O.CMC: CF ^= 1; return;
        case O.CLD: DF = 0; return;
        case O.STD: DF = 1; return;
        case O.CLI: IF = 0; return;
        case O.STI: IF = 1; return;
        case O.CBW: regs[AX] = s8(regs[AX]) & 0xFFFF; return;
        case O.CWD: regs[DX] = regs[AX] & 0x8000 ? 0xFFFF : 0; return;
        case O.LAHF: set8(4, flagsWord() & 0xFF); return;
        case O.SAHF: setFlags((flagsWord() & 0xFF00) | (regs[AX] >> 8)); return;
        case O.PUSHF: push(flagsWord()); return;
        case O.POPF: setFlags(pop()); return;
        case O.PUSHA: { const sp = regs[SP]; [AX, CX, DX, BX].forEach(r => push(regs[r])); push(sp); [BP, SI, DI].forEach(r => push(regs[r])); return; }
        case O.POPA: { [DI, SI, BP].forEach(r => { regs[r] = pop(); }); pop(); [BX, DX, CX, AX].forEach(r => { regs[r] = pop(); }); return; }
        case O.XLAT: set8(0, mem[lin(sregs[DS], (regs[BX] + (regs[AX] & 0xFF)) & 0xFFFF)]); return;
        case O.AAA: {
          if ((regs[AX] & 0x0F) > 9 || AF) { regs[AX] = (regs[AX] + 0x106) & 0xFFFF; AF = CF = 1; } else { AF = CF = 0; }
          set8(0, regs[AX] & 0x0F);
          return;
        }
        case O.AAS: {
          if ((regs[AX] & 0x0F) > 9 || AF) { set8(0, (regs[AX] & 0xFF) - 6); set8(4, (regs[AX] >> 8) - 1); AF = CF = 1; } else { AF = CF = 0; }
          set8(0, regs[AX] & 0x0F);
          return;
        }
        case O.DAA: {
          let al = regs[AX] & 0xFF; const oldCF = CF, oldAL = al;
          if ((al & 0x0F) > 9 || AF) { al += 6; AF = 1; } else AF = 0;
          if (oldAL > 0x99 || oldCF) { al += 0x60; CF = 1; } else CF = 0;
          set8(0, al); szp(al & 0xFF, false);
          return;
        }
        case O.DAS: {
          let al = regs[AX] & 0xFF; const oldCF = CF, oldAL = al;
          if ((al & 0x0F) > 9 || AF) { al -= 6; AF = 1; } else AF = 0;
          if (oldAL > 0x99 || oldCF) { al -= 0x60; CF = 1; } else CF = 0;
          set8(0, al); szp(al & 0xFF, false);
          return;
        }
        case O.AAM: {
          const base10 = x.a ? x.a.v & 0xFF : 10;
          if (!base10) { if (!softInt(0, next)) divideError(); return; }
          const al = regs[AX] & 0xFF;
          regs[AX] = (Math.floor(al / base10) << 8) | (al % base10);
          szp(regs[AX] & 0xFF, false);
          return;
        }
        case O.AAD: {
          const base10 = x.a ? x.a.v & 0xFF : 10;
          const al = ((regs[AX] >> 8) * base10 + (regs[AX] & 0xFF)) & 0xFF;
          regs[AX] = al; szp(al, false);
          return;
        }
        case O.NOP: return;
        case O.HLT:
          if (!IF) { finish(0); message = 'HLT with interrupts off: the CPU stopped for good.'; return; }
          ip = x.addr;
          if (!sleeping) { sleeping = true; wakeAt = now() + 55; state = 'sleep'; return; }
          if (now() < wakeAt) { state = 'sleep'; return; }
          sleeping = false; ip = next;
          return;
        case O.IN: {
          const port = x.port.k === K_IMM ? x.port.v & 0xFF : regs[DX];
          const v = portIn(port, w);
          if (w) regs[AX] = v; else set8(0, v);
          return;
        }
        case O.OUT: {
          const port = x.port.k === K_IMM ? x.port.v & 0xFF : regs[DX];
          portOut(port, w ? regs[AX] & 0xFF : regs[AX] & 0xFF);
          if (w) portOut(port + 1, regs[AX] >> 8);
          return;
        }
      }
      fail('This instruction cannot run here.', x.ln + 1);
    }

    function strOp(x, w) {
      const size = w ? 2 : 1, d = DF ? -size : size;
      const srcSeg = x.seg >= 0 ? x.seg : DS;
      const once = () => {
        const src = lin(sregs[srcSeg], regs[SI]), dst = lin(sregs[ES], regs[DI]);
        switch (x.sub) {
          case 0: if (w) ww(dst, rw(src)); else wb(dst, mem[src]); regs[SI] = (regs[SI] + d) & 0xFFFF; regs[DI] = (regs[DI] + d) & 0xFFFF; return;
          case 1: sub(w ? rw(src) : mem[src], w ? rw(dst) : mem[dst], 0, w); regs[SI] = (regs[SI] + d) & 0xFFFF; regs[DI] = (regs[DI] + d) & 0xFFFF; return;
          case 2: sub(w ? regs[AX] : regs[AX] & 0xFF, w ? rw(dst) : mem[dst], 0, w); regs[DI] = (regs[DI] + d) & 0xFFFF; return;
          case 3: if (w) regs[AX] = rw(src); else set8(0, mem[src]); regs[SI] = (regs[SI] + d) & 0xFFFF; return;
          default: if (w) ww(dst, regs[AX]); else wb(dst, regs[AX] & 0xFF); regs[DI] = (regs[DI] + d) & 0xFFFF;
        }
      };
      if (!x.rep) { once(); return; }
      while (regs[CX] !== 0) {
        once();
        regs[CX] = (regs[CX] - 1) & 0xFFFF;
        if (x.sub === 1 || x.sub === 2) {
          if (x.rep === 1 && !ZF) break;
          if (x.rep === 2 && ZF) break;
        }
      }
    }

    /**
     * Run up to `budget` instructions.
     * @returns {{state:string, wakeAt?:number}}
     */
    function run(budget) {
      if (state === 'exit' || state === 'error') return status();
      if (state === 'key' || state === 'sleep') state = 'run';
      const limit = budget || 100000;
      for (let n = 0; n < limit && state === 'run'; n++) {
        if (sregs[CS] !== SEG) {
          if (sregs[CS] === 0xF000 && ip < 256) {
            // One of our vectors, reached through a program's own handler: do it natively, then IRET.
            const r = native(ip);
            if (r === 'wait' || r === 'sleep') { state = r === 'wait' ? 'key' : 'sleep'; break; }
            if (state !== 'run') break;
            ip = pop(); sregs[CS] = pop(); setFlags(pop());
            continue;
          }
          fail('The program jumped out of itself (to ' + hex4(sregs[CS]) + ':' + hex4(ip) + ').');
          break;
        }
        const k = codeAt[ip];
        if (k < 0) {
          if (ip === 0) { finish(0); break; }   // RET from the top: INT 20h in the PSP
          const last = code[code.length - 1];
          if (last && ip === ((last.addr + last.len) & 0xFFFF)) {
            fail('The program ran past its last instruction (line ' + (last.ln + 1) + '). End it with INT 20h, or MOV AH,4Ch then INT 21h.', last.ln + 1);
          } else {
            const d = prog.data.find(x => x.addr <= ip && ip < x.addr + 0x10000 && ip < x.addr + Math.max(1, x.items.reduce((s, it) => s + it.count, 0)));
            fail('The program jumped to ' + hex4(ip) + 'h' + (d ? ', which is data (line ' + (d.ln + 1) + '), not an instruction' : ', where there is no instruction') + '.', d ? d.ln + 1 : 0);
          }
          break;
        }
        const x = code[k];
        steps++;
        exec(x);
        if (state === 'error' && !errLine) errLine = x.ln + 1;
      }
      return status();
    }
    function status() {
      return { state, wakeAt, exitCode, message, line: errLine, steps };
    }

    return {
      run,
      status,
      pushKey(ascii, scan) {
        if (keys.length >= 32) return;
        keys.push({ ascii: ascii & 0xFF, scan: scan & 0xFF });
        lastScan = scan & 0xFF;
        if (state === 'key') state = 'run';
      },
      stop() { if (state !== 'exit' && state !== 'error') { state = 'exit'; message = 'Stopped.'; exitCode = 0; } },
      get dirty() { return dirty; },
      clean() { dirty = false; },
      screen() {
        return { mode: vmode, text: mem.subarray(TXT, TXT + 4000), gfx: mem.subarray(0xA0000, 0xA0000 + 64000), palette: pal, row: crow, col: ccol, cursor: cursorOn, blink };
      },
      screenText() {
        const out = [];
        for (let r = 0; r < 25; r++) {
          let s = '';
          for (let c = 0; c < 80; c++) s += CP437[mem[TXT + (r * 80 + c) * 2]];
          out.push(s.replace(/\s+$/, ''));
        }
        while (out.length && !out[out.length - 1]) out.pop();
        return out.join('\n');
      },
      registers() {
        return {
          AX: regs[AX], BX: regs[BX], CX: regs[CX], DX: regs[DX], SI: regs[SI], DI: regs[DI], BP: regs[BP], SP: regs[SP],
          CS: sregs[CS], DS: sregs[DS], ES: sregs[ES], SS: sregs[SS], IP: ip,
          flags: { CF, PF, AF, ZF, SF, IF, DF, OF }
        };
      },
      notes() { return Array.from(notes); },
      peek(seg, off) { return mem[lin(seg, off)]; },
      get elapsed() { return now() - t0; }
    };
  }

  root.Asm86 = { assemble, createMachine, parseNumber, CP437, LOAD_SEG };
  if (typeof module === 'object' && module.exports) module.exports = root.Asm86;
})(typeof globalThis !== 'undefined' ? globalThis : this);
