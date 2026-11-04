/* ============================================================
   CVM-RUN.JS — runs the tree js/cvm-parse.js built, and remembers memory
   ------------------------------------------------------------
   A tree-walking C interpreter over one flat byte memory, so a struct copy is
   a byte copy, a pointer is an address and arithmetic on it means what it
   means in C. Every byte also carries "was this ever written", which is how
   the window can draw garbage as ? instead of a made-up number.

   Memory, by address (the numbers the window shows as A100, A152, ...):
       100 ..           globals, then the stack, frames one after another
       100000 ..        the heap: every malloc block, 16 bytes apart
       900000 ..        string literals (read-only)
       990000 ..        functions, so a function pointer is an address too

   Run with a `target` -- a statement id, or { enter: blockId } -- and every
   time that statement finishes the whole state is copied into a snapshot:
   the call stack with each frame's live variables, the globals, the heap,
   and which bytes the statement wrote (the window makes those glow).

   It stops, and says why in plain words, where real C would have gone wrong
   quietly: an index past the end of an array, a NULL or never-set pointer,
   a freed block used again, a loop still running after a million steps.

   Plain script, no DOM; Node loads it for tools/test-cvm.js.
   ============================================================ */
(function (root) {
  'use strict';
  const CVM = root.CVM || (root.CVM = {});
  if (!CVM.T && typeof require === 'function') Object.assign(CVM, require('./cvm-parse.js'));
  const T = CVM.T;
  const { ptrTo, arrOf, fnType, sizeOf, alignOf, alignUp, isInt, isFloat, isArith, isPtr, is64, typeName } = CVM.types;
  const CError = CVM.CError;

  const GLOBAL_BASE = 100;
  const HEAP_BASE = 100000;
  const RODATA_BASE = 900000;
  const CODE_BASE = 990000;
  const FILE_BASE = 1040000;   // FILE * values are handles, never memory
  const MEM_SIZE = 1048576;
  const MAX_SNAPS = 300;

  const BRK = { brk: true };
  const CONT = { cont: true };
  class Ret { constructor(v) { this.v = v; } }
  class Exit { constructor(code) { this.code = code; } }
  class Stop { constructor(why, loc) { this.why = why; this.loc = loc; } }

  const VOIDV = { t: T.void, v: 0 };
  const rtErr = (msg, loc) => new CError(msg, loc, 'runtime');

  /* Integer types promote to int; the usual arithmetic conversions pick the
     common type of a binary operator, exactly as C11 6.3.1.8 says. */
  function promote(t) {
    if (t.k === 'int' && (t.size < 4 || t.bool || t.enumNames)) return T.int;
    return t;
  }
  function commonType(a, b) {
    if (isFloat(a) || isFloat(b)) {
      const fa = isFloat(a) ? a.size : 0, fb = isFloat(b) ? b.size : 0;
      return Math.max(fa, fb) >= 8 ? T.double : T.float;
    }
    a = promote(a); b = promote(b);
    if (a.size === b.size && a.signed === b.signed) return a;
    if (a.signed === b.signed) return a.size > b.size ? a : b;
    const u = a.signed ? b : a, s = a.signed ? a : b;
    if (u.size >= s.size) return u;
    if (s.size > u.size) return s;
    return { k: 'int', name: 'unsigned ' + s.name, size: s.size, align: s.size, signed: false };
  }

  /* A value converted to type t: wraps like the hardware does. */
  function conv(v, from, t) {
    if (t.k === 'int') {
      if (t.bool) return truthy(v, from) ? 1 : 0;
      let n = v;
      if (isFloat(from)) {
        if (!Number.isFinite(n)) n = t.size === 8 ? -9223372036854775808 : -2147483648;
        n = Math.trunc(n);
        if (t.size === 8) return t.signed ? BigInt.asIntN(64, BigInt(n)) : BigInt.asUintN(64, BigInt(n));
      }
      if (t.size === 8) {
        const b = typeof n === 'bigint' ? n : BigInt(Math.trunc(n));
        return t.signed ? BigInt.asIntN(64, b) : BigInt.asUintN(64, b);
      }
      if (typeof n === 'bigint') n = Number(BigInt.asIntN(32, n));
      switch (t.size) {
        case 4: return t.signed ? (n | 0) : (n >>> 0);
        case 2: return t.signed ? ((n << 16) >> 16) : (n & 0xffff);
        case 1: return t.signed ? ((n << 24) >> 24) : (n & 0xff);
      }
      return n;
    }
    if (t.k === 'float') {
      const n = typeof v === 'bigint' ? Number(v) : v;
      return t.size === 4 ? Math.fround(n) : n;
    }
    if (t.k === 'ptr') {
      if (typeof v === 'bigint') return Number(BigInt.asUintN(64, v));
      return isFloat(from) ? Math.trunc(v) : v;
    }
    return v;
  }
  function truthy(v, t) {
    if (typeof v === 'bigint') return v !== 0n;
    void t;
    return v !== 0 && !Number.isNaN(v) ? true : (Number.isNaN(v) ? true : false);
  }
  const num = (v) => (typeof v === 'bigint' ? Number(v) : v);

  /* ── The interpreter ───────────────────────────────────────── */
  class VM {
    constructor(prog, opts) {
      opts = opts || {};
      this.prog = prog;
      this.mem = new Uint8Array(MEM_SIZE);
      this.dv = new DataView(this.mem.buffer);
      this.init = new Uint8Array(MEM_SIZE);
      this.globalEnd = GLOBAL_BASE;
      this.sp = 0;
      this.stackBase = 0;
      this.heapTop = HEAP_BASE;
      this.blocks = [];          // heap blocks, by address
      this.roTop = RODATA_BASE;
      this.globals = new Map();
      this.globalList = [];
      this.frames = [];
      this.out = [];
      this.outLen = 0;
      this.input = encodeUtf8(opts.stdin || '');
      this.inPos = 0;
      this.inputShort = null;
      this.steps = 0;
      this.maxSteps = opts.maxSteps || 2000000;
      this.deadline = opts.timeMs ? now() + opts.timeMs : Infinity;
      this.target = opts.target == null ? null : opts.target;
      this.snaps = [];
      this.snapCount = 0;
      this.logDepth = 0;
      this.writes = [];
      this.endSnap = null;
      this.statics = new Map();
      this.strAddr = new Map();
      this.files = new Map();
      this.handles = new Map();
      this.handleSeq = 0;
      const vmRef = this;
      this.stdin = { isStdin: true, eof: false, get buf() { return vmRef.input; }, get pos() { return vmRef.inPos; }, set pos(p) { vmRef.inPos = p; } };
      this.fnAddr = new Map();
      this.fnAt = new Map();
      this.randState = null;
      this.strtokPos = 0;
      this.maxOut = opts.maxOut || 1 << 20;
      this.curLoc = null;
      let a = CODE_BASE;
      for (const [name, fn] of prog.funcs) { this.fnAddr.set(name, a); this.fnAt.set(a, fn); a += 16; }
      this.builtinBase = a;
    }

    /* ── memory ── */
    region(addr, n, write, loc) {
      if (addr < 16) throw rtErr(addr === 0 ? 'This uses a NULL pointer: it points at nothing.' : 'This uses an address near NULL: the pointer was never set properly.', loc || this.curLoc);
      const end = addr + n;
      if (addr >= GLOBAL_BASE && end <= this.globalEnd) return;
      if (addr >= this.stackBase && addr < HEAP_BASE) {
        if (end <= this.sp) return;
        throw rtErr('This reaches stack memory that no longer belongs to a variable -- often the address of a local variable from a function that has already returned.', loc || this.curLoc);
      }
      if (addr >= HEAP_BASE && addr < RODATA_BASE) {
        const b = this.blockAt(addr);
        if (b) {
          if (b.freed) throw rtErr('This uses a block after free() gave it back.', loc || this.curLoc);
          if (end <= b.addr + b.size) return;
          throw rtErr('This goes past the end of a malloc block of ' + b.size + ' byte' + (b.size === 1 ? '' : 's') + '.', loc || this.curLoc);
        }
        throw rtErr('This pointer points into the heap but not at any malloc block.', loc || this.curLoc);
      }
      if (addr >= RODATA_BASE && end <= this.roTop) {
        if (write) throw rtErr('This writes into a string literal, which C does not allow. Copy it into a char array first.', loc || this.curLoc);
        return;
      }
      throw rtErr('This pointer points at memory the program does not own.', loc || this.curLoc);
    }
    blockAt(addr) {
      // Last block starting at or before addr.
      let lo = 0, hi = this.blocks.length - 1, best = null;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (this.blocks[mid].addr <= addr) { best = this.blocks[mid]; lo = mid + 1; } else hi = mid - 1;
      }
      if (best && addr < best.addr + Math.max(best.size, 1)) return best;
      return null;
    }
    markWrite(addr, n, isInit) {
      this.init.fill(isInit === false ? 0 : 1, addr, addr + n);
      if (this.logDepth > 0) this.writes.push([addr, n]);
    }
    read(addr, t, loc) {
      const n = t.k === 'struct' ? sizeOf(t) : t.size;
      this.region(addr, n, false, loc);
      const dv = this.dv;
      let v;
      if (t.k === 'int') {
        switch (t.size) {
          case 1: v = t.signed ? dv.getInt8(addr) : dv.getUint8(addr); break;
          case 2: v = t.signed ? dv.getInt16(addr, true) : dv.getUint16(addr, true); break;
          case 4: v = t.signed ? dv.getInt32(addr, true) : dv.getUint32(addr, true); break;
          default: v = t.signed ? dv.getBigInt64(addr, true) : dv.getBigUint64(addr, true);
        }
        if (t.bool) v = v ? 1 : 0;
      } else if (t.k === 'float') {
        v = t.size === 4 ? dv.getFloat32(addr, true) : dv.getFloat64(addr, true);
      } else if (t.k === 'ptr') {
        v = Number(dv.getBigUint64(addr, true));
      } else throw rtErr('Cannot read a value of type ' + typeName(t) + '.', loc || this.curLoc);
      let u = false;
      for (let i = 0; i < n; i++) if (!this.init[addr + i]) { u = true; break; }
      return { t: t, v: v, u: u };
    }
    write(addr, t, v, loc, uninit) {
      const n = t.size;
      this.region(addr, n, true, loc);
      const dv = this.dv;
      if (t.k === 'int') {
        switch (t.size) {
          case 1: dv.setUint8(addr, Number(v) & 0xff); break;
          case 2: dv.setUint16(addr, Number(v) & 0xffff, true); break;
          case 4: dv.setUint32(addr, Number(v) >>> 0, true); break;
          default: dv.setBigUint64(addr, BigInt.asUintN(64, typeof v === 'bigint' ? v : BigInt(Math.trunc(v))), true);
        }
      } else if (t.k === 'float') {
        if (t.size === 4) dv.setFloat32(addr, v, true);
        else dv.setFloat64(addr, v, true);
      } else if (t.k === 'ptr') {
        dv.setBigUint64(addr, BigInt(Math.max(0, Math.trunc(v))), true);
      }
      this.markWrite(addr, n, !uninit);
    }
    copy(dst, src, n, loc) {
      if (n <= 0) return;
      this.region(src, n, false, loc);
      this.region(dst, n, true, loc);
      this.mem.copyWithin(dst, src, src + n);
      this.init.copyWithin(dst, src, src + n);
      if (this.logDepth > 0) this.writes.push([dst, n]);
    }
    stackAlloc(t, loc) {
      const sz = Math.max(sizeOf(t), 1);
      const addr = alignUp(this.sp, Math.min(alignOf(t), 16));
      if (addr + sz > HEAP_BASE) throw rtErr('The stack is full: a function calls itself too deeply, or an array is too big for a local variable.', loc || this.curLoc);
      this.sp = addr + sz;
      this.init.fill(0, addr, addr + sz);
      return addr;
    }
    globalAlloc(t) {
      const sz = Math.max(sizeOf(t), 1);
      const addr = alignUp(this.globalEnd, Math.min(alignOf(t), 16));
      this.globalEnd = addr + sz;
      if (this.globalEnd > HEAP_BASE / 2) throw rtErr('The global variables are too big for the stack window to hold.', this.curLoc);
      this.mem.fill(0, addr, addr + sz);
      this.init.fill(1, addr, addr + sz);
      return addr;
    }
    rodata(bytes) {
      const addr = this.roTop;
      if (addr + bytes.length + 1 > CODE_BASE) throw rtErr('Too many string literals for the stack window.', this.curLoc);
      this.mem.set(bytes, addr);
      this.mem[addr + bytes.length] = 0;
      this.init.fill(1, addr, addr + bytes.length + 1);
      this.roTop = addr + bytes.length + 1;
      return addr;
    }
    malloc(n, loc, zero) {
      n = Math.max(0, Math.floor(n));
      if (n > 600000) return 0;
      const addr = alignUp(this.heapTop, 16) + (this.blocks.length ? 16 : 0);
      if (addr + n >= RODATA_BASE) return 0;
      this.heapTop = addr + Math.max(n, 1);
      const b = { addr: addr, size: n, freed: false, loc: loc, seq: this.blocks.length };
      this.blocks.push(b);
      this.mem.fill(0, addr, addr + n);
      this.init.fill(zero ? 1 : 0, addr, addr + n);
      if (zero && this.logDepth > 0) this.writes.push([addr, n]);
      return addr;
    }
    cstr(addr, loc, max) {
      const bytes = [];
      const lim = max == null ? 1 << 20 : max;
      for (let i = 0; i < lim; i++) {
        this.region(addr + i, 1, false, loc);
        const b = this.mem[addr + i];
        if (!b) break;
        bytes.push(b);
      }
      return bytes;
    }
    /* stdin is (FILE*)1, stdout 2, stderr 3; files from fopen() are handles. */
    stream(v, loc, what) {
      const a = num(v.v);
      if (a === 1) return this.stdin;
      if (a === 2 || a === 3) return { out: true, err: a === 3 };
      const h = this.handles.get(a);
      if (!h) throw rtErr(what + '() was given ' + (a === 0 ? 'NULL: fopen() failed, so check the FILE pointer before using it.' : 'a file that is not open (was it closed already?).'), loc);
      return h;
    }
    readByte(h, loc) {
      if (h.out) return -1;
      if (!h.isStdin && !h.r) return -1;
      if (h.pos < h.buf.length) return h.buf[h.pos++];
      h.eof = true;
      if (h.isStdin && !this.inputShort) this.inputShort = loc;
      return -1;
    }
    writeTo(h, bytes, loc) {
      void loc;
      if (h.out) { if (!h.err) this.putBytes(bytes); return true; }
      if (h.isStdin || !h.w) return false;
      if (h.append) h.pos = h.buf.length;
      for (let i = h.buf.length; i < h.pos; i++) h.buf[i] = 0;
      for (let i = 0; i < bytes.length; i++) h.buf[h.pos + i] = bytes[i];
      h.pos += bytes.length;
      return true;
    }
    putBytes(bytes) {
      if (this.outLen > this.maxOut) return;
      this.out.push(bytes);
      this.outLen += bytes.length;
    }

    /* ── steps, snapshots ── */
    tick(loc) {
      if (++this.steps > this.maxSteps) throw new Stop('steps', loc);
      if ((this.steps & 4095) === 0 && now() > this.deadline) throw new Stop('time', loc);
    }
    snapshot(kind, node) {
      const frames = this.frames.map(f => ({
        fn: f.fn.name,
        fnNode: f.fn,
        callLoc: f.callLoc,
        vars: f.scopes.flatMap(s => [...s.values()]).filter(b => !b.hidden).map(b => ({ name: b.name, t: b.t, addr: b.addr, spell: b.spell, param: !!b.param, isStatic: !!b.isStatic }))
      }));
      const lo = GLOBAL_BASE, hi = Math.max(this.sp, this.globalEnd);
      return {
        kind: kind,
        stmt: node ? node.id : null,
        loc: node ? node.loc : null,
        frames: frames,
        globals: this.globalList.map(b => ({ name: b.name, t: b.t, addr: b.addr, spell: b.spell })),
        blocks: this.blocks.map(b => ({ addr: b.addr, size: b.size, freed: b.freed, loc: b.loc, seq: b.seq })),
        lo: lo, hi: hi,
        mem: this.mem.slice(lo, hi), init: this.init.slice(lo, hi),
        heapMem: this.mem.slice(HEAP_BASE, this.heapTop), heapInit: this.init.slice(HEAP_BASE, this.heapTop),
        heapTop: this.heapTop,
        ro: this.mem.slice(RODATA_BASE, this.roTop),
        roTop: this.roTop,
        writes: this.writes.slice(),
        fnAt: this.fnAt,
        builtinNames: this.builtinNames,
        stackBase: this.stackBase,
        sp: this.sp
      };
    }
    capture(node) {
      this.snapCount++;
      const s = this.snapshot('stmt', node);
      s.pass = this.snapCount;
      if (this.snaps.length >= MAX_SNAPS) this.snaps.shift();
      this.snaps.push(s);
    }
    isTarget(node) {
      const t = this.target;
      return t != null && typeof t === 'number' && node.id === t;
    }
    isEnterTarget(node) {
      const t = this.target;
      return t != null && typeof t === 'object' && t.enter === node.id;
    }

    /* ── scope ── */
    frame() { return this.frames[this.frames.length - 1]; }
    lookup(name) {
      const f = this.frame();
      if (f) for (let i = f.scopes.length - 1; i >= 0; i--) { const b = f.scopes[i].get(name); if (b) return b; }
      return this.globals.get(name) || null;
    }
    bind(name, b) {
      const f = this.frame();
      const scope = f ? f.scopes[f.scopes.length - 1] : this.globals;
      if (name) {
        b.name = name;
        scope.set(name, b);
        if (!f) this.globalList.push(b);
      }
    }

    /* ── running the whole program ── */
    run() {
      const prog = this.prog;
      const result = { ok: true, error: null, stop: null, exitCode: 0 };
      try {
        // Globals: zeroed, then their initialisers in order.
        for (const d of prog.globals) for (const v of d.vars) this.declareGlobal(v);
        this.stackBase = alignUp(this.globalEnd + 1, 100);
        if (this.stackBase < 200) this.stackBase = 200;
        this.sp = this.stackBase;
        const main = prog.funcs.get('main');
        this.mainBody = main ? main.body : null;
        if (!main) throw new CError(prog.protos.has('main') ? 'main() is declared but has no body yet.' : 'There is no main() yet: the program starts there.', null);
        const args = [];
        if (main.params.length >= 2) {
          // argc = 1, argv = { "main", NULL }
          const name = this.rodata(encodeUtf8('main'));
          const argv = this.stackAlloc(arrOf(ptrTo(T.char), 2));
          this.write(argv, ptrTo(T.char), name); this.write(argv + 8, ptrTo(T.char), 0);
          args.push({ t: T.int, v: 1 }, { t: ptrTo(ptrTo(T.char)), v: argv });
        }
        const r = this.callUser(main, args, main.loc, true);
        result.exitCode = r && r.t.k === 'int' ? Number(r.v) : 0;
      } catch (e) {
        if (e instanceof Exit) { result.exitCode = e.code; }
        else if (e instanceof Stop) {
          result.ok = false;
          result.stop = e.why;
          result.error = rtErr(e.why === 'steps'
            ? 'Stopped after ' + this.maxSteps.toLocaleString('en-US') + ' steps: a loop may never end.'
            : 'Stopped: the program ran too long. A loop may never end.', e.loc);
          result.errorSnap = e.snap || this.snapshot('error', null);
        } else if (e instanceof CError) {
          result.ok = false;
          result.error = e;
          if (!e.loc && this.curLoc) e.loc = this.curLoc;
          if (e.kind === 'runtime') result.errorSnap = e.snap || this.snapshot('error', null);
        } else if (e instanceof RangeError) {
          result.ok = false;
          result.error = rtErr('The program calls itself too deeply (recursion with no way out?).', this.curLoc);
        } else throw e;
      }
      if (!this.endSnap) this.endSnap = this.snapshot('end', null);
      result.end = this.endSnap;
      result.snaps = this.snaps;
      result.passes = this.snapCount;
      result.steps = this.steps;
      result.stdout = decodeUtf8(concatBytes(this.out));
      result.inputShort = this.inputShort;
      result.inputUsed = this.inPos;
      return result;
    }

    declareGlobal(v) {
      this.curLoc = v.loc;
      let t = this.completeType(v.type, v.init, v.loc);
      if (v.storage === 'extern' && !v.init) {
        if (this.globals.has(v.name)) return;
      }
      const old = this.globals.get(v.name);
      if (old && !v.init) return;   // a tentative definition seen twice
      const addr = old ? old.addr : this.globalAlloc(t);
      if (!old) this.bind(v.name, { t: t, addr: addr, spell: v.spell, decl: v });
      if (v.init) this.initialize(addr, t, v.init, true);
    }

    /* An array with no size takes it from its initialiser; a VLA from now. */
    completeType(t, init, loc) {
      if (t.k !== 'arr') return t;
      if (t.n == null && t.nExpr) {
        const n = this.toNum(this.rval(t.nExpr));
        if (n <= 0) throw rtErr('An array needs a size above 0, and this one is ' + n + '.', loc);
        if (n > 500000) throw rtErr('An array of ' + n + ' elements is too big for the stack window.', loc);
        return arrOf(this.completeType(t.of, null, loc), n, t.nName);
      }
      if (t.n == null && init) {
        if (init.k === 'str') return arrOf(t.of, init.bytes.length + 1, null);
        if (init.k === 'init') {
          let n = 0, idx = 0;
          for (const it of init.items) {
            if (it.desig.length && it.desig[0].index != null) idx = it.desig[0].index;
            idx++;
            if (idx > n) n = idx;
          }
          if (init.items.length === 1 && init.items[0].v.k === 'str' && isInt(t.of) && t.of.size === 1) n = init.items[0].v.bytes.length + 1;
          return arrOf(t.of, n, null);
        }
      }
      if (t.of.k === 'arr' && t.of.nExpr) return arrOf(this.completeType(t.of, null, loc), t.n, t.nName);
      return t;
    }

    /* Write an initialiser into memory. Braces fill in order (or by
       designator); whatever an initialiser list leaves out is zero. */
    initialize(addr, t, init, isGlobal) {
      if (init.k === 'init' || (init.k === 'str' && t.k === 'arr')) {
        // Anything in braces zeroes the whole object first.
        this.region(addr, sizeOf(t), true, init.loc);
        this.mem.fill(0, addr, addr + sizeOf(t));
        this.markWrite(addr, sizeOf(t), true);
        void isGlobal;
        this.initInto(addr, t, init);
        return;
      }
      const v = this.rval(init);
      this.storeValue(addr, t, v, init.loc);
    }
    initInto(addr, t, init) {
      if (t.k === 'arr' && init.k === 'str') {
        const n = Math.min(init.bytes.length + 1, t.n == null ? init.bytes.length + 1 : t.n);
        for (let i = 0; i < n; i++) this.mem[addr + i] = i < init.bytes.length ? init.bytes[i] : 0;
        if (t.n != null && init.bytes.length > t.n) throw rtErr('The string "' + decodeUtf8(init.bytes) + '" has ' + (init.bytes.length + 1) + ' characters with its \\0, but the array only holds ' + t.n + '.', init.loc);
        return;
      }
      if (init.k !== 'init') {
        const v = this.rval(init);
        this.storeValue(addr, t, v, init.loc);
        return;
      }
      if (t.k === 'arr') {
        const es = sizeOf(t.of);
        // { "text" } for a char array
        if (init.items.length === 1 && init.items[0].v.k === 'str' && isInt(t.of) && t.of.size === 1 && !init.items[0].desig.length) {
          this.initInto(addr, t, init.items[0].v);
          return;
        }
        let idx = 0;
        const flat = this.flatten(init.items, t);
        for (const it of flat) {
          if (it.desig && it.desig.length) idx = it.desig[0].index;
          if (t.n != null && idx >= t.n) throw rtErr('Too many values in { }: the array holds ' + t.n + '.', it.v.loc || init.loc);
          const sub = it.desig && it.desig.length > 1 ? { k: 'init', items: [{ desig: it.desig.slice(1), v: it.v }], loc: it.v.loc } : it.v;
          this.initInto(addr + idx * es, t.of, sub);
          idx++;
        }
        return;
      }
      if (t.k === 'struct') {
        const ms = t.members;
        let mi = 0;
        const flat = this.flatten(init.items, t);
        for (const it of flat) {
          if (it.desig && it.desig.length && it.desig[0].field) {
            mi = ms.findIndex(m => m.name === it.desig[0].field);
            if (mi === -1) throw rtErr(typeName(t) + ' has no member called ' + it.desig[0].field + '.', it.v.loc || init.loc);
          }
          if (mi >= ms.length) throw rtErr('Too many values in { } for ' + typeName(t) + ', which has ' + ms.length + ' member' + (ms.length === 1 ? '' : 's') + '.', it.v.loc || init.loc);
          const m = ms[mi];
          const sub = it.desig && it.desig.length > 1 ? { k: 'init', items: [{ desig: it.desig.slice(1), v: it.v }], loc: it.v.loc } : it.v;
          this.initInto(addr + m.off, m.type, sub);
          mi++;
          if (t.union) break;
        }
        return;
      }
      // A scalar in braces: { 5 }
      if (init.items.length) this.initInto(addr, t, init.items[0].v);
    }
    /* Brace elision: int a[2][2] = {1, 2, 3, 4} fills the inner arrays in
       turn. Values that are not themselves {…} are grouped to the element's size. */
    flatten(items, t) {
      const elemT = t.k === 'arr' ? t.of : null;
      const needsGroup = (et) => et && (et.k === 'arr' || et.k === 'struct');
      if (t.k === 'arr' && needsGroup(elemT)) {
        const out = [];
        let i = 0;
        while (i < items.length) {
          const it = items[i];
          if (it.v.k === 'init' || (it.v.k === 'str' && elemT.k === 'arr') || (it.desig && it.desig.length) || (elemT.k === 'struct' && this.isStructValue(it.v, elemT))) { out.push(it); i++; continue; }
          const per = scalarCount(elemT);
          out.push({ desig: [], v: { k: 'init', items: items.slice(i, i + per).map(x => ({ desig: [], v: x.v })), loc: it.v.loc } });
          i += per;
        }
        return out;
      }
      if (t.k === 'struct') {
        const out = [];
        let i = 0, mi = 0;
        while (i < items.length) {
          const it = items[i];
          if (it.desig && it.desig.length) {
            out.push(it);
            mi = t.members.findIndex(m => m.name === it.desig[0].field) + 1;
            i++; continue;
          }
          const m = t.members[mi];
          if (m && needsGroup(m.type) && it.v.k !== 'init' && !(it.v.k === 'str' && m.type.k === 'arr') && !(m.type.k === 'struct' && this.isStructValue(it.v, m.type))) {
            const per = scalarCount(m.type);
            out.push({ desig: [], v: { k: 'init', items: items.slice(i, i + per).map(x => ({ desig: [], v: x.v })), loc: it.v.loc } });
            i += per;
          } else { out.push(it); i++; }
          mi++;
        }
        return out;
      }
      return items;
    }
    isStructValue(e, st) {
      if (e.k === 'init' || e.k === 'num' || e.k === 'str') return false;
      try { const t = this.typeOf(e); return t && t.k === 'struct' && t === st; } catch (err) { return false; }
    }

    storeValue(addr, t, v, loc) {
      if (t.k === 'struct') {
        if (v.t.k !== 'struct') throw rtErr('A ' + typeName(t) + ' needs a whole struct here, not ' + typeName(v.t) + '.', loc);
        this.copy(addr, v.addr, sizeOf(t), loc);
        return;
      }
      if (t.k === 'arr') throw rtErr('An array cannot be assigned with =. Copy it element by element' + (isInt(t.of) && t.of.size === 1 ? ', or with strcpy() for a string' : '') + '.', loc);
      if (v.t.k === 'struct') throw rtErr('A whole ' + typeName(v.t) + ' cannot go into ' + typeName(t) + '.', loc);
      if (v.t.k === 'void') throw rtErr('This has no value to store (a void function returns nothing).', loc);
      this.write(addr, t, conv(v.v, v.t, t), loc, v.u);
    }

    /* ── functions ── */
    callUser(fn, args, callLoc, isMain) {
      if (this.frames.length > 3000) throw rtErr('The program calls itself too deeply (recursion with no way out?).', callLoc);
      const spBase = this.sp;
      const frame = { fn: fn, scopes: [new Map()], spBase: spBase, callLoc: callLoc };
      this.frames.push(frame);
      fn.params.forEach((p, i) => {
        if (!p.name) return;
        const addr = this.stackAlloc(p.type, p.loc);
        const a = args[i];
        if (a) this.storeValue(addr, p.type, a, callLoc);
        this.bind(p.name, { t: p.type, addr: addr, spell: p.spell, param: true });
      });
      let ret = VOIDV;
      try {
        const sig = this.exec(fn.body);
        if (sig instanceof Ret) ret = sig.v;
        else if (fn.type.ret.k !== 'void') ret = { t: fn.type.ret, v: fn.type.ret.k === 'int' && fn.type.ret.size === 8 ? 0n : 0, u: !isMain };
      } finally {
        if (isMain && !this.endSnap) this.endSnap = this.snapshot('end', null);
      }
      // A returned struct outlives the frame: copied to the caller's stack.
      let bytes = null, ibytes = null;
      if (ret.t.k === 'struct') { bytes = this.mem.slice(ret.addr, ret.addr + sizeOf(ret.t)); ibytes = this.init.slice(ret.addr, ret.addr + sizeOf(ret.t)); }
      this.frames.pop();
      this.sp = spBase;
      if (bytes) {
        const tmp = this.stackAlloc(ret.t);
        this.mem.set(bytes, tmp); this.init.set(ibytes, tmp);
        return { t: ret.t, addr: tmp };
      }
      if (fn.type.ret.k !== 'void' && ret.t.k !== 'void' && ret.t !== fn.type.ret) {
        return { t: fn.type.ret, v: conv(ret.v, ret.t, fn.type.ret), u: ret.u };
      }
      return ret;
    }

    callAddr(addr, args, loc) {
      const fn = this.fnAt.get(addr);
      if (fn) return this.callUser(fn, args, loc);
      const bname = this.builtinAt && this.builtinAt.get(addr);
      if (bname) return BUILTINS[bname].call.call(this, args, loc);
      throw rtErr(addr === 0 ? 'This calls a function pointer that is NULL.' : 'This calls through a pointer that does not point at a function.', loc);
    }

    /* ── statements ── */
    exec(s) {
      this.tick(s.loc);
      const tgt = this.isTarget(s);
      if (tgt) { this.logDepth++; if (this.logDepth === 1) this.writes = []; }
      let sig;
      try { sig = this.execInner(s); }
      catch (e) {
        // Where it went wrong, taken here while every scope is still open.
        if ((e instanceof Stop || (e instanceof CError && e.kind === 'runtime')) && !e.snap) {
          if (e instanceof CError && !e.loc) e.loc = s.loc;
          e.snap = this.snapshot('error', s);
        }
        throw e;
      }
      finally { if (tgt) this.logDepth--; }
      if (tgt) this.capture(s);
      return sig;
    }
    execInner(s) {
      switch (s.k) {
        case 'block': {
          const f = this.frame();
          f.scopes.push(new Map());
          const sp0 = this.sp;
          if (this.isEnterTarget(s)) { this.writes = []; this.capture(s); }
          try {
            for (const it of s.items) {
              const sig = this.exec(it);
              if (sig) return sig;
            }
          } finally {
            if (s === this.mainBody && !this.endSnap) this.endSnap = this.snapshot('end', null);
            f.scopes.pop();
            this.sp = sp0;
          }
          return null;
        }
        case 'decl': {
          for (const v of s.vars) {
            this.curLoc = v.loc;
            if (v.storage === 'extern') { continue; }
            if (v.storage === 'static') {
              let addr = this.statics.get(v);
              const t = this.completeType(v.type, v.init, v.loc);
              if (addr == null) {
                addr = this.globalAlloc(t);
                this.statics.set(v, addr);
                if (v.init) this.initialize(addr, t, v.init, true);
              }
              this.bind(v.name, { t: t, addr: addr, spell: v.spell, isStatic: true });
              continue;
            }
            const t = this.completeType(v.type, v.init, v.loc);
            if (t.k === 'struct' && !t.complete) throw rtErr(typeName(t) + ' is used before its members are written out.', v.loc);
            const addr = this.stackAlloc(t, v.loc);
            // Bound first, so int x = sizeof x; and self-referencing inits work.
            this.bind(v.name, { t: t, addr: addr, spell: v.spell });
            if (v.init) {
              const sp = this.sp;
              this.initialize(addr, t, v.init, false);
              this.sp = sp;
            }
          }
          return null;
        }
        case 'expr': {
          const sp = this.sp;
          this.curLoc = s.loc;
          this.rval(s.e);
          this.sp = sp;   // temporaries die with the statement
          return null;
        }
        case 'if': {
          this.curLoc = s.loc;
          if (this.cond(s.c)) return this.exec(s.t);
          if (s.f) return this.exec(s.f);
          return null;
        }
        case 'while': {
          while (this.cond(s.c)) {
            this.tick(s.loc);
            const sig = this.exec(s.body);
            if (sig === BRK) break;
            if (sig === CONT) continue;
            if (sig) return sig;
          }
          return null;
        }
        case 'do': {
          do {
            this.tick(s.loc);
            const sig = this.exec(s.body);
            if (sig === BRK) break;
            if (sig === CONT) continue;
            if (sig) return sig;
          } while (this.cond(s.c));
          return null;
        }
        case 'for': {
          const f = this.frame();
          f.scopes.push(new Map());
          const sp0 = this.sp;
          try {
            if (s.init) this.exec(s.init);
            for (;;) {
              if (s.c && !this.cond(s.c)) break;
              this.tick(s.loc);
              const sig = this.exec(s.body);
              if (sig === BRK) break;
              if (sig && sig !== CONT) return sig;
              if (s.inc) { const sp = this.sp; this.curLoc = s.loc; this.rval(s.inc); this.sp = sp; }
            }
          } finally { f.scopes.pop(); this.sp = sp0; }
          return null;
        }
        case 'switch': {
          this.curLoc = s.loc;
          const v = this.rval(s.e);
          if (!isInt(v.t)) throw rtErr('switch needs a whole number (int or char), not ' + typeName(v.t) + '.', s.e.loc);
          const x = num(conv(v.v, v.t, promote(v.t)));
          const items = s.body.k === 'block' ? s.body.items : [s.body];
          let start = -1, def = -1;
          for (let i = 0; i < items.length && start === -1; i++) {
            for (let n = items[i]; n && (n.k === 'case' || n.k === 'default'); n = n.body) {
              if (n.k === 'default') { if (def === -1) def = i; continue; }
              if (n.hi != null ? (x >= n.v && x <= n.hi) : x === n.v) { start = i; break; }
            }
          }
          if (start === -1) start = def;
          if (start < 0) return null;
          const f = this.frame();
          if (s.body.k === 'block') f.scopes.push(new Map());
          const sp0 = this.sp;
          try {
            for (let i = start; i < items.length; i++) {
              const sig = this.exec(items[i]);
              if (sig === BRK) return null;
              if (sig) return sig;
            }
          } finally { if (s.body.k === 'block') f.scopes.pop(); this.sp = sp0; }
          return null;
        }
        case 'case': case 'default': return this.exec(s.body);
        case 'break': return BRK;
        case 'continue': return CONT;
        case 'return': {
          this.curLoc = s.loc;
          if (!s.e) return new Ret(VOIDV);
          let v = this.rval(s.e);
          const fn = this.frame().fn;
          const rt = fn.type.ret;
          if (rt.k === 'void') return new Ret(VOIDV);
          if (rt.k === 'struct') {
            if (v.t.k !== 'struct') throw rtErr(fn.name + '() must return a ' + typeName(rt) + '.', s.loc);
            return new Ret(v);
          }
          if (v.t.k === 'struct') throw rtErr(fn.name + '() returns ' + typeName(rt) + ', not a whole struct.', s.loc);
          return new Ret({ t: rt, v: conv(v.v, v.t, rt), u: v.u });
        }
        case 'empty': return null;
      }
      throw rtErr('The stack window cannot run a "' + s.k + '" statement.', s.loc);
    }
    cond(e) {
      const sp = this.sp;
      const v = this.rval(e);
      this.sp = sp;
      if (v.t.k === 'struct') throw rtErr('A whole struct cannot be true or false: compare one of its members.', e.loc);
      return truthy(v.v, v.t);
    }

    /* ── expressions ── */
    toNum(v) { return num(v.v); }

    /* What type an expression has, without running it (sizeof needs this). */
    typeOf(e) {
      switch (e.k) {
        case 'num': return e.t;
        case 'str': return e.t;
        case 'id': {
          const b = this.lookup(e.name);
          if (b) return b.t;
          const fn = this.prog.funcs.get(e.name) || this.prog.protos.get(e.name);
          if (fn) return fn.type;
          if (BUILTINS[e.name]) return fnType(BUILTINS[e.name].ret || T.int, [], true);
          throw rtErr('There is no variable called ' + e.name + '.', e.loc);
        }
        case 'idx': {
          const a = this.typeOf(e.a);
          if (a.k === 'arr') return a.of;
          if (a.k === 'ptr') return a.to;
          const b = this.typeOf(e.i);
          if (b.k === 'arr') return b.of;
          if (b.k === 'ptr') return b.to;
          throw rtErr('[ ] needs an array or a pointer.', e.loc);
        }
        case 'mem': {
          let a = this.typeOf(e.a);
          if (e.arrow) a = a.k === 'ptr' ? a.to : (a.k === 'arr' ? a.of : a);
          const m = a.k === 'struct' && a.members.find(x => x.name === e.name);
          if (!m) throw rtErr(memberMsg(a, e), e.loc);
          return m.type;
        }
        case 'un': {
          const a = this.typeOf(e.a);
          if (e.op === '*') return a.k === 'ptr' ? a.to : (a.k === 'arr' ? a.of : a);
          if (e.op === '&') return ptrTo(a);
          if (e.op === '!') return T.int;
          return isInt(a) ? promote(a) : a;
        }
        case 'pre': case 'post': return this.typeOf(e.a);
        case 'assign': return this.typeOf(e.a);
        case 'cast': return e.t;
        case 'clit': return this.completeType(e.t, e.init, e.loc);
        case 'sizeof_t': case 'sizeof_e': case 'alignof_t': return T.ulong;
        case 'comma': return this.typeOf(e.b);
        case 'cond': {
          const a = this.typeOf(e.a), b = this.typeOf(e.b);
          if (isArith(a) && isArith(b)) return commonType(a, b);
          return a.k === 'ptr' || a.k === 'arr' ? decay(a) : decay(b);
        }
        case 'call': {
          const f = this.typeOf(e.f);
          const ft = f.k === 'ptr' ? f.to : f;
          return ft.k === 'fn' ? ft.ret : T.int;
        }
        case 'bin': {
          const op = e.op;
          if (['<', '>', '<=', '>=', '==', '!=', '&&', '||'].indexOf(op) !== -1) return T.int;
          const a = decay(this.typeOf(e.a)), b = decay(this.typeOf(e.b));
          if (op === '-' && a.k === 'ptr' && b.k === 'ptr') return T.long;
          if (a.k === 'ptr') return a;
          if (b.k === 'ptr') return b;
          if (op === '<<' || op === '>>') return promote(a);
          return commonType(a, b);
        }
        case 'init': return T.int;
      }
      return T.int;
    }

    /* An lvalue: { t, addr } for anything that names memory. */
    lval(e) {
      switch (e.k) {
        case 'id': {
          const b = this.lookup(e.name);
          if (!b) {
            if (this.prog.funcs.has(e.name) || BUILTINS[e.name]) throw rtErr(e.name + ' is a function, not a variable.', e.loc);
            throw rtErr('There is no variable called ' + e.name + (this.frame() ? ' in ' + this.frame().fn.name + '()' : '') + '.', e.loc);
          }
          return { t: b.t, addr: b.addr, name: e.name };
        }
        case 'idx': {
          let at = this.typeOf(e.a);
          let base = e.a, ix = e.i;
          if (at.k !== 'arr' && at.k !== 'ptr') {
            const it = this.typeOf(e.i);
            if (it.k === 'arr' || it.k === 'ptr') { base = e.i; ix = e.a; at = it; }
            else throw rtErr('[ ] needs an array or a pointer, and ' + exprName(e.a) + ' is ' + typeName(at) + '.', e.loc);
          }
          const iv = this.rval(ix);
          if (!isInt(iv.t)) throw rtErr('An array index must be a whole number, not ' + typeName(iv.t) + '.', ix.loc);
          if (iv.u) throw rtErr('The index ' + exprName(ix) + ' was never given a value.', ix.loc);
          const i = num(iv.v);
          if (at.k === 'arr') {
            const lv = this.lval(base);
            if (at.n != null && (i < 0 || i >= at.n)) {
              throw rtErr(exprName(base) + '[' + i + '] is outside the array: ' + exprName(base) + ' has ' + at.n + ' cell' + (at.n === 1 ? '' : 's') + ' (0 to ' + (at.n - 1) + ').', e.loc);
            }
            return { t: at.of, addr: lv.addr + i * sizeOf(at.of) };
          }
          const pv = this.rval(base);
          this.checkPtr(pv, base);
          return { t: at.to, addr: pv.v + i * sizeOf(at.to.k === 'void' ? T.char : at.to) };
        }
        case 'mem': {
          let addr, st;
          if (e.arrow) {
            const pv = this.rval(e.a);
            if (pv.t.k !== 'ptr') throw rtErr('-> needs a pointer to a struct; ' + exprName(e.a) + ' is ' + typeName(pv.t) + (pv.t.k === 'struct' ? '. Use . instead' : '') + '.', e.loc);
            this.checkPtr(pv, e.a);
            st = pv.t.to; addr = pv.v;
          } else {
            let lv;
            if (isLvalueExpr(e.a)) lv = this.lval(e.a);
            else { const v = this.rval(e.a); if (v.t.k !== 'struct') throw rtErr('. needs a struct; ' + exprName(e.a) + ' is ' + typeName(v.t) + '.', e.loc); lv = { t: v.t, addr: v.addr }; }
            st = lv.t; addr = lv.addr;
            if (st.k === 'ptr') throw rtErr(exprName(e.a) + ' is a pointer, so its members are reached with -> (or (*' + exprName(e.a) + ').' + e.name + ').', e.loc);
          }
          if (st.k !== 'struct') throw rtErr(memberMsg(st, e), e.loc);
          if (!st.complete) throw rtErr(typeName(st) + ' is used before its members are written out.', e.loc);
          const m = st.members.find(x => x.name === e.name);
          if (!m) throw rtErr(memberMsg(st, e), e.loc);
          return { t: m.type, addr: addr + m.off };
        }
        case 'un': {
          if (e.op !== '*') break;
          const pv = this.rval(e.a);
          if (pv.t.k !== 'ptr') throw rtErr('* needs a pointer, and ' + exprName(e.a) + ' is ' + typeName(pv.t) + '.', e.loc);
          if (pv.t.to.k === 'fn') return { t: pv.t.to, addr: pv.v, fn: true };
          this.checkPtr(pv, e.a);
          return { t: pv.t.to, addr: pv.v };
        }
        case 'str': {
          let a = this.strAddr.get(e);
          if (a == null) { a = this.rodata(e.bytes); this.strAddr.set(e, a); }
          return { t: e.t, addr: a };
        }
        case 'clit': {
          const t = this.completeType(e.t, e.init, e.loc);
          const addr = this.stackAlloc(t, e.loc);
          this.initialize(addr, t, e.init, false);
          return { t: t, addr: addr };
        }
        case 'assign': case 'pre': case 'post': case 'cond': case 'comma': case 'call': {
          const v = this.rval(e);
          if (v.t.k === 'struct') return { t: v.t, addr: v.addr };
          break;
        }
      }
      throw rtErr(exprName(e) + ' is a value, not a place in memory, so it cannot be assigned to or have its address taken.', e.loc);
    }
    checkPtr(pv, e) {
      if (pv.u) throw rtErr(exprName(e) + ' was never given an address, so it points anywhere.', e.loc);
      if (pv.v === 0) throw rtErr(exprName(e) + ' is NULL: it points at nothing.', e.loc);
    }

    load(lv, e) {
      const t = lv.t;
      if (t.k === 'arr') return { t: ptrTo(t.of), v: lv.addr, arr: t };
      if (t.k === 'fn') return { t: ptrTo(t), v: lv.addr };
      if (t.k === 'struct') {
        this.region(lv.addr, sizeOf(t), false, e && e.loc);
        return { t: t, addr: lv.addr };
      }
      if (t.k === 'void') throw rtErr('A void pointer cannot be read: cast it to a real type first.', e && e.loc);
      return this.read(lv.addr, t, e && e.loc);
    }

    rval(e) {
      switch (e.k) {
        case 'num': return { t: e.t, v: e.v };
        case 'str': { const lv = this.lval(e); return { t: ptrTo(T.char), v: lv.addr, arr: e.t }; }
        case 'id': {
          const b = this.lookup(e.name);
          if (b) return this.load({ t: b.t, addr: b.addr }, e);
          if (this.fnAddr.has(e.name)) return { t: ptrTo(this.prog.funcs.get(e.name).type), v: this.fnAddr.get(e.name) };
          if (BUILTINS[e.name]) return { t: ptrTo(fnType(BUILTINS[e.name].ret || T.int, [], true)), v: this.builtinAddr(e.name) };
          if (this.prog.protos.has(e.name)) throw rtErr(e.name + '() is declared but has no body yet.', e.loc);
          throw rtErr('There is no variable called ' + e.name + (this.frame() ? ' in ' + this.frame().fn.name + '()' : '') + '.', e.loc);
        }
        case 'idx': case 'mem': case 'clit': return this.load(this.lval(e), e);
        case 'un': return this.unary(e);
        case 'pre': case 'post': return this.incdec(e);
        case 'assign': return this.assign(e);
        case 'bin': return this.binary(e);
        case 'cond': {
          const c = this.rval(e.c);
          const pick = truthy(c.v, c.t) ? e.a : e.b;
          const v = this.rval(pick);
          const ta = this.typeOf(e.a), tb = this.typeOf(e.b);
          if (isArith(ta) && isArith(tb) && isArith(v.t)) { const ct = commonType(ta, tb); return { t: ct, v: conv(v.v, v.t, ct), u: v.u }; }
          return v;
        }
        case 'comma': this.rval(e.a); return this.rval(e.b);
        case 'cast': {
          const v = this.rval(e.a);
          if (e.t.k === 'void') return VOIDV;
          if (e.t.k === 'struct') {
            if (v.t === e.t) return v;
            throw rtErr('A value cannot be cast to a whole struct.', e.loc);
          }
          if (v.t.k === 'struct') throw rtErr('A whole struct cannot be cast to ' + typeName(e.t) + '.', e.loc);
          return { t: e.t, v: conv(v.v, v.t, e.t), u: v.u };
        }
        case 'sizeof_t': return { t: T.ulong, v: BigInt(sizeOf(this.completeType(e.t, null, e.loc))) };
        case 'alignof_t': return { t: T.ulong, v: BigInt(alignOf(e.t)) };
        case 'sizeof_e': {
          const t = this.typeOf(e.a);
          return { t: T.ulong, v: BigInt(t.k === 'fn' ? 1 : sizeOf(t)) };
        }
        case 'call': return this.call(e);
        case 'init': throw rtErr('A { } list only works when declaring a variable.', e.loc);
      }
      throw rtErr('The stack window cannot work out this expression.', e.loc);
    }

    unary(e) {
      const op = e.op;
      if (op === '&') {
        if (e.a.k === 'id' && !this.lookup(e.a.name) && (this.fnAddr.has(e.a.name) || BUILTINS[e.a.name])) return this.rval(e.a);
        const lv = this.lval(e.a);
        return { t: ptrTo(lv.t), v: lv.addr };
      }
      if (op === '*') {
        const lv = this.lval(e);
        if (lv.fn) return { t: ptrTo(lv.t), v: lv.addr };
        return this.load(lv, e);
      }
      const v = this.rval(e.a);
      if (op === '!') {
        if (v.t.k === 'struct') throw rtErr('! cannot be applied to a whole struct.', e.loc);
        return { t: T.int, v: truthy(v.v, v.t) ? 0 : 1, u: v.u };
      }
      if (!isArith(v.t)) throw rtErr(op + ' needs a number, and ' + exprName(e.a) + ' is ' + typeName(v.t) + '.', e.loc);
      const t = isInt(v.t) ? promote(v.t) : v.t;
      const x = conv(v.v, v.t, t);
      if (op === '+') return { t: t, v: x, u: v.u };
      if (op === '-') return { t: t, v: conv(typeof x === 'bigint' ? -x : -x, t, t), u: v.u };
      if (op === '~') {
        if (!isInt(t)) throw rtErr('~ needs a whole number.', e.loc);
        return { t: t, v: conv(typeof x === 'bigint' ? ~x : ~x, t, t), u: v.u };
      }
      throw rtErr('Unknown operator ' + op + '.', e.loc);
    }

    incdec(e) {
      const lv = this.lval(e.a);
      const t = lv.t;
      if (!(isArith(t) || t.k === 'ptr')) throw rtErr(e.op + ' needs a number or a pointer, and ' + exprName(e.a) + ' is ' + typeName(t) + '.', e.loc);
      const old = this.read(lv.addr, t, e.loc);
      if (old.u && t.k !== 'ptr') { /* garbage in, garbage out -- C allows it */ }
      const d = e.op === '++' ? 1 : -1;
      let nv;
      if (t.k === 'ptr') nv = old.v + d * sizeOf(t.to.k === 'void' ? T.char : t.to);
      else if (typeof old.v === 'bigint') nv = conv(old.v + BigInt(d), t, t);
      else nv = conv(old.v + d, isFloat(t) ? t : T.llong, t);
      this.write(lv.addr, t, nv, e.loc, old.u);
      return e.k === 'pre' ? { t: t, v: nv, u: old.u } : old;
    }

    assign(e) {
      if (e.op === '=') {
        const lt = this.typeOf(e.a);
        if (lt.k === 'arr') throw rtErr('An array cannot be assigned with =. ' + (isInt(lt.of) && lt.of.size === 1 ? 'For a string, use strcpy(' + exprName(e.a) + ', ...).' : 'Copy it one element at a time.'), e.loc);
        const v = this.rval(e.b);
        const lv = this.lval(e.a);
        if (lv.t.k === 'struct') {
          if (v.t.k !== 'struct' || v.t !== lv.t) throw rtErr(exprName(e.a) + ' is a ' + typeName(lv.t) + ', so it needs a ' + typeName(lv.t) + ' value, not ' + typeName(v.t) + '.', e.loc);
          // Through a temp: a = f(a) may read what it is writing.
          if (v.addr !== lv.addr) this.copy(lv.addr, v.addr, sizeOf(lv.t), e.loc);
          return { t: lv.t, addr: lv.addr };
        }
        this.storeValue(lv.addr, lv.t, v, e.loc);
        return { t: lv.t, v: conv(v.v, v.t, lv.t), u: v.u };
      }
      const op = e.op.slice(0, -1);
      const lv = this.lval(e.a);
      const cur = this.load(lv, e.a);
      const rhs = this.rval(e.b);
      const res = this.arith(op, cur, rhs, e);
      this.storeValue(lv.addr, lv.t, res, e.loc);
      return { t: lv.t, v: conv(res.v, res.t, lv.t), u: res.u };
    }

    binary(e) {
      const op = e.op;
      if (op === '&&') {
        const a = this.rval(e.a);
        if (!truthy(a.v, a.t)) return { t: T.int, v: 0, u: a.u };
        const b = this.rval(e.b);
        return { t: T.int, v: truthy(b.v, b.t) ? 1 : 0, u: a.u || b.u };
      }
      if (op === '||') {
        const a = this.rval(e.a);
        if (truthy(a.v, a.t)) return { t: T.int, v: 1, u: a.u };
        const b = this.rval(e.b);
        return { t: T.int, v: truthy(b.v, b.t) ? 1 : 0, u: a.u || b.u };
      }
      const a = this.rval(e.a);
      const b = this.rval(e.b);
      return this.arith(op, a, b, e);
    }

    arith(op, a, b, e) {
      const u = a.u || b.u;
      if (a.t.k === 'struct' || b.t.k === 'struct') throw rtErr('"' + op + '" cannot work on a whole struct: use one of its members' + (op === '==' ? ' (structs are compared member by member)' : '') + '.', e.loc);
      const ap = a.t.k === 'ptr', bp = b.t.k === 'ptr';
      if (ap || bp) {
        const step = (t) => sizeOf(t.to.k === 'void' || t.to.k === 'fn' ? T.char : t.to);
        if (op === '+' && ap && isInt(b.t)) return { t: a.t, v: a.v + num(b.v) * step(a.t), u: u };
        if (op === '+' && bp && isInt(a.t)) return { t: b.t, v: b.v + num(a.v) * step(b.t), u: u };
        if (op === '-' && ap && isInt(b.t)) return { t: a.t, v: a.v - num(b.v) * step(a.t), u: u };
        if (op === '-' && ap && bp) return { t: T.long, v: BigInt(Math.trunc((a.v - b.v) / step(a.t))), u: u };
        const av = ap ? a.v : num(a.v), bv = bp ? b.v : num(b.v);
        switch (op) {
          case '==': return { t: T.int, v: av === bv ? 1 : 0, u: u };
          case '!=': return { t: T.int, v: av !== bv ? 1 : 0, u: u };
          case '<': return { t: T.int, v: av < bv ? 1 : 0, u: u };
          case '>': return { t: T.int, v: av > bv ? 1 : 0, u: u };
          case '<=': return { t: T.int, v: av <= bv ? 1 : 0, u: u };
          case '>=': return { t: T.int, v: av >= bv ? 1 : 0, u: u };
        }
        throw rtErr('"' + op + '" does not work on pointers.', e.loc);
      }
      if (!isArith(a.t) || !isArith(b.t)) throw rtErr('"' + op + '" needs numbers.', e.loc);
      if (op === '<<' || op === '>>') {
        const t = promote(a.t);
        if (!isInt(t) || !isInt(b.t)) throw rtErr('"' + op + '" needs whole numbers.', e.loc);
        const x = conv(a.v, a.t, t);
        const bits = t.size * 8;
        const n = num(b.v) & (bits - 1);
        if (t.size === 8) return { t: t, v: conv(op === '<<' ? x << BigInt(n) : x >> BigInt(n), t, t), u: u };
        let r;
        if (op === '<<') r = x << n;
        else r = t.signed ? x >> n : x >>> n;
        return { t: t, v: conv(r, t, t), u: u };
      }
      const ct = commonType(a.t, b.t);
      const x = conv(a.v, a.t, ct), y = conv(b.v, b.t, ct);
      if (isFloat(ct)) {
        let r;
        switch (op) {
          case '+': r = x + y; break; case '-': r = x - y; break; case '*': r = x * y; break;
          case '/': r = x / y; break;
          case '%': throw rtErr('% only works on whole numbers. For decimals, use fmod() from math.h.', e.loc);
          case '<': return { t: T.int, v: x < y ? 1 : 0, u: u };
          case '>': return { t: T.int, v: x > y ? 1 : 0, u: u };
          case '<=': return { t: T.int, v: x <= y ? 1 : 0, u: u };
          case '>=': return { t: T.int, v: x >= y ? 1 : 0, u: u };
          case '==': return { t: T.int, v: x === y ? 1 : 0, u: u };
          case '!=': return { t: T.int, v: x !== y ? 1 : 0, u: u };
          default: throw rtErr('"' + op + '" only works on whole numbers.', e.loc);
        }
        return { t: ct, v: conv(r, ct, ct), u: u };
      }
      if ((op === '/' || op === '%') && (typeof y === 'bigint' ? y === 0n : y === 0)) {
        throw rtErr('Division by zero: ' + exprName(e.b) + ' is 0 here.', e.loc);
      }
      if (ct.size === 8) {
        let r;
        switch (op) {
          case '+': r = x + y; break; case '-': r = x - y; break; case '*': r = x * y; break;
          case '/': r = x / y; break; case '%': r = x % y; break;
          case '&': r = x & y; break; case '|': r = x | y; break; case '^': r = x ^ y; break;
          case '<': return { t: T.int, v: x < y ? 1 : 0, u: u };
          case '>': return { t: T.int, v: x > y ? 1 : 0, u: u };
          case '<=': return { t: T.int, v: x <= y ? 1 : 0, u: u };
          case '>=': return { t: T.int, v: x >= y ? 1 : 0, u: u };
          case '==': return { t: T.int, v: x === y ? 1 : 0, u: u };
          case '!=': return { t: T.int, v: x !== y ? 1 : 0, u: u };
        }
        return { t: ct, v: conv(r, ct, ct), u: u };
      }
      let r;
      switch (op) {
        case '+': r = x + y; break; case '-': r = x - y; break;
        case '*': r = ct.signed ? Math.imul(x, y) : (Math.imul(x, y) >>> 0); break;
        case '/': r = Math.trunc(x / y); break;
        case '%': r = x % y; break;
        case '&': r = x & y; break; case '|': r = x | y; break; case '^': r = x ^ y; break;
        case '<': return { t: T.int, v: x < y ? 1 : 0, u: u };
        case '>': return { t: T.int, v: x > y ? 1 : 0, u: u };
        case '<=': return { t: T.int, v: x <= y ? 1 : 0, u: u };
        case '>=': return { t: T.int, v: x >= y ? 1 : 0, u: u };
        case '==': return { t: T.int, v: x === y ? 1 : 0, u: u };
        case '!=': return { t: T.int, v: x !== y ? 1 : 0, u: u };
        default: throw rtErr('Unknown operator ' + op + '.', e.loc);
      }
      return { t: ct, v: conv(r, ct, ct), u: u };
    }

    builtinAddr(name) {
      if (!this.builtinAt) { this.builtinAt = new Map(); this.builtinAddrs = new Map(); }
      if (!this.builtinAddrs.has(name)) {
        const a = this.builtinBase + this.builtinAddrs.size * 16;
        this.builtinAddrs.set(name, a); this.builtinAt.set(a, name);
      }
      return this.builtinAddrs.get(name);
    }

    call(e) {
      let fn = null, bname = null, addr = null;
      if (e.f.k === 'id' && !this.lookup(e.f.name)) {
        const name = e.f.name;
        fn = this.prog.funcs.get(name);
        if (!fn) {
          if (BUILTINS[name]) bname = name;
          else if (this.prog.protos.has(name)) throw rtErr(name + '() is declared but has no body yet.', e.loc);
          else throw rtErr('There is no function called ' + name + '()' + (SUGGEST[name] ? ': ' + SUGGEST[name] : '.'), e.loc);
        }
      } else {
        const fv = this.rval(e.f);
        if (fv.t.k !== 'ptr' || fv.t.to.k !== 'fn') throw rtErr(exprName(e.f) + ' is not a function.', e.loc);
        if (fv.u) throw rtErr(exprName(e.f) + ' was never given a function to point at.', e.loc);
        addr = fv.v;
        fn = this.fnAt.get(addr) || null;
        if (!fn) bname = this.builtinAt && this.builtinAt.get(addr);
        if (!fn && !bname) throw rtErr(addr === 0 ? exprName(e.f) + ' is NULL, so there is no function to call.' : exprName(e.f) + ' does not point at a function.', e.loc);
      }
      if (fn) {
        const ps = fn.params;
        const variadic = fn.type.variadic, unspec = fn.type.unspecified;
        if (!unspec && (e.args.length < ps.length || (!variadic && e.args.length > ps.length))) {
          throw rtErr(fn.name + '() takes ' + ps.length + ' value' + (ps.length === 1 ? '' : 's') + ' but this call gives it ' + e.args.length + '.', e.loc);
        }
        const args = [];
        for (let i = 0; i < e.args.length; i++) {
          const v = this.rval(e.args[i]);
          const p = ps[i];
          if (p && p.type.k === 'struct' && (v.t.k !== 'struct' || v.t !== p.type)) {
            throw rtErr('Value ' + (i + 1) + ' of ' + fn.name + '() must be a ' + typeName(p.type) + ', not ' + typeName(v.t) + '.', e.args[i].loc);
          }
          if (p && p.type.k === 'ptr' && v.t.k === 'struct') throw rtErr('Value ' + (i + 1) + ' of ' + fn.name + '() is a pointer: pass &' + exprName(e.args[i]) + '.', e.args[i].loc);
          if (p && v.t.k === 'struct') {
            // A struct passed by value is copied now, before the call changes anything.
            const tmp = this.stackAlloc(v.t);
            this.copy(tmp, v.addr, sizeOf(v.t), e.loc);
            args.push({ t: v.t, addr: tmp });
          } else args.push(v);
        }
        const saved = this.curLoc;
        const r = this.callUser(fn, args, e.loc);
        this.curLoc = saved;
        return r;
      }
      const B = BUILTINS[bname];
      const args = e.args.map(a => this.rval(a));
      this.curLoc = e.loc;
      return B.call.call(this, args, e.loc, e);
    }
  }

  function decay(t) { return t.k === 'arr' ? ptrTo(t.of) : (t.k === 'fn' ? ptrTo(t) : t); }
  function isLvalueExpr(e) { return e.k === 'id' || e.k === 'idx' || e.k === 'mem' || (e.k === 'un' && e.op === '*') || e.k === 'str' || e.k === 'clit'; }
  function scalarCount(t) {
    if (t.k === 'arr') return (t.n || 0) * scalarCount(t.of);
    if (t.k === 'struct') return t.members.reduce((a, m) => a + scalarCount(m.type), 0) || 1;
    return 1;
  }
  function memberMsg(t, e) {
    if (t.k !== 'struct') return exprName(e.a) + ' is ' + typeName(t) + ', which has no members.';
    const names = t.members.map(m => m.name).filter(Boolean);
    return typeName(t) + ' has no member called ' + e.name + (names.length ? '. It has: ' + names.join(', ') + '.' : '.');
  }
  /* A short name for an expression, for messages: "L->count", "nums[i]". */
  function exprName(e) {
    if (!e) return 'this';
    switch (e.k) {
      case 'id': return e.name;
      case 'num': return e.chr ? "'" + String.fromCharCode(e.v) + "'" : String(e.v);
      case 'idx': return exprName(e.a) + '[' + exprName(e.i) + ']';
      case 'mem': return exprName(e.a) + (e.arrow ? '->' : '.') + e.name;
      case 'un': return e.op + exprName(e.a);
      case 'call': return exprName(e.f) + '()';
      case 'str': return '"' + decodeUtf8(e.bytes).slice(0, 20) + '"';
      case 'bin': return exprName(e.a) + ' ' + e.op + ' ' + exprName(e.b);
      case 'cast': return exprName(e.a);
      case 'post': return exprName(e.a) + e.op;
      case 'pre': return e.op + exprName(e.a);
    }
    return 'this';
  }

  /* ── The C library, as far as a course needs it ────────────── */
  const SUGGEST = {
    getch: 'that is from conio.h, which only exists on Windows.',
    clrscr: 'that is from conio.h, which only exists on Windows.',
    print: 'did you mean printf()?', scan: 'did you mean scanf()?',
    Printf: 'C is case-sensitive: printf().', Scanf: 'C is case-sensitive: scanf().'
  };
  const S = (vm, v, loc) => vm.cstr(v.v, loc);
  const I = (v) => ({ t: T.int, v: v | 0 });
  const UL = (v) => ({ t: T.ulong, v: BigInt(v) });
  const P = (t, v) => ({ t: t, v: v });
  const D = (v) => ({ t: T.double, v: v });
  const dbl = (v) => (typeof v.v === 'bigint' ? Number(v.v) : v.v);
  const charP = ptrTo(T.char);
  const voidP = ptrTo(T.void);
  function needPtr(vm, v, what, loc) {
    if (!v || v.t.k !== 'ptr') throw rtErr(what + ' needs an address here' + (v && v.t.k === 'int' ? ' (did you forget the &?)' : '') + '.', loc);
    if (v.u) throw rtErr(what + ' was given a pointer that was never set.', loc);
    if (v.v === 0) throw rtErr(what + ' was given NULL.', loc);
    return v.v;
  }
  function needArgs(args, n, name, loc) {
    if (args.length < n) throw rtErr(name + '() needs ' + n + ' value' + (n === 1 ? '' : 's') + ' but got ' + args.length + '.', loc);
  }
  function writeBytes(vm, addr, bytes, loc) {
    vm.region(addr, bytes.length, true, loc);
    vm.mem.set(bytes, addr);
    vm.markWrite(addr, bytes.length, true);
  }
  const mathFn = (f) => ({ ret: T.double, call(args, loc) { needArgs(args, f.length, 'this', loc); return D(f.apply(null, args.map(dbl))); } });
  const mathFnF = (f) => ({ ret: T.float, call(args, loc) { needArgs(args, f.length, 'this', loc); return { t: T.float, v: Math.fround(f.apply(null, args.map(dbl))) }; } });
  const ctype = (test) => ({ ret: T.int, call(args) { const c = num(args[0].v); return I(c >= 0 && c < 256 && test(c) ? 1 : 0); } });
  const cRound = (x) => (x < 0 ? -Math.round(-x) : Math.round(x));

  const BUILTINS = {
    printf: { ret: T.int, call(args, loc) {
      needArgs(args, 1, 'printf', loc);
      const bytes = formatC(this, needPtr(this, args[0], 'printf', loc), args.slice(1), loc);
      this.putBytes(bytes);
      return I(bytes.length);
    } },
    fprintf: { ret: T.int, call(args, loc) {
      needArgs(args, 2, 'fprintf', loc);
      const h = this.stream(args[0], loc, 'fprintf');
      const bytes = formatC(this, needPtr(this, args[1], 'fprintf', loc), args.slice(2), loc);
      return I(this.writeTo(h, bytes, loc) ? bytes.length : -1);
    } },
    sprintf: { ret: T.int, call(args, loc) {
      needArgs(args, 2, 'sprintf', loc);
      const bytes = formatC(this, needPtr(this, args[1], 'sprintf', loc), args.slice(2), loc);
      writeBytes(this, needPtr(this, args[0], 'sprintf', loc), bytes.concat([0]), loc);
      return I(bytes.length);
    } },
    snprintf: { ret: T.int, call(args, loc) {
      needArgs(args, 3, 'snprintf', loc);
      const n = num(args[1].v);
      const bytes = formatC(this, needPtr(this, args[2], 'snprintf', loc), args.slice(3), loc);
      if (n > 0) writeBytes(this, needPtr(this, args[0], 'snprintf', loc), bytes.slice(0, n - 1).concat([0]), loc);
      return I(bytes.length);
    } },
    puts: { ret: T.int, call(args, loc) { this.putBytes(S(this, args[0], loc).concat([10])); return I(1); } },
    fputs: { ret: T.int, call(args, loc) { return I(this.writeTo(this.stream(args[1], loc, 'fputs'), S(this, args[0], loc), loc) ? 1 : -1); } },
    putchar: { ret: T.int, call(args) { const c = num(args[0].v) & 0xff; this.putBytes([c]); return I(c); } },
    putc: { ret: T.int, call(args, loc) { const c = num(args[0].v) & 0xff; return I(this.writeTo(this.stream(args[1], loc, 'putc'), [c], loc) ? c : -1); } },
    fputc: { ret: T.int, call(args, loc) { const c = num(args[0].v) & 0xff; return I(this.writeTo(this.stream(args[1], loc, 'fputc'), [c], loc) ? c : -1); } },
    fflush: { ret: T.int, call() { return I(0); } },
    perror: { ret: T.void, call() { return VOIDV; } },
    getchar: { ret: T.int, call(args, loc) { return I(this.readByte(this.stdin, loc)); } },
    getc: { ret: T.int, call(args, loc) { return I(this.readByte(this.stream(args[0], loc, 'getc'), loc)); } },
    fgetc: { ret: T.int, call(args, loc) { return I(this.readByte(this.stream(args[0], loc, 'fgetc'), loc)); } },
    ungetc: { ret: T.int, call(args, loc) { const h = this.stream(args[1], loc, 'ungetc'); if (h.pos > 0) h.pos--; h.eof = false; return args[0]; } },
    fgets: { ret: charP, call(args, loc) {
      needArgs(args, 3, 'fgets', loc);
      const dst = needPtr(this, args[0], 'fgets', loc);
      const n = num(args[1].v);
      const h = this.stream(args[2], loc, 'fgets');
      const bytes = [];
      while (bytes.length < n - 1) {
        const c = this.readByte(h, loc);
        if (c === -1) break;
        bytes.push(c);
        if (c === 10) break;
      }
      if (!bytes.length) return P(charP, 0);
      writeBytes(this, dst, bytes.concat([0]), loc);
      return P(charP, dst);
    } },
    gets: { ret: charP, call(args, loc) {
      const dst = needPtr(this, args[0], 'gets', loc);
      if (this.inPos >= this.input.length) { if (!this.inputShort) this.inputShort = loc; return P(charP, 0); }
      const bytes = [];
      while (this.inPos < this.input.length) { const c = this.input[this.inPos++]; if (c === 10) break; bytes.push(c); }
      writeBytes(this, dst, bytes.concat([0]), loc);
      return P(charP, dst);
    } },
    scanf: { ret: T.int, call(args, loc) {
      needArgs(args, 1, 'scanf', loc);
      return I(scanC(this, needPtr(this, args[0], 'scanf', loc), args.slice(1), loc, null));
    } },
    fscanf: { ret: T.int, call(args, loc) {
      needArgs(args, 2, 'fscanf', loc);
      const h = this.stream(args[0], loc, 'fscanf');
      return I(scanC(this, needPtr(this, args[1], 'fscanf', loc), args.slice(2), loc, h.isStdin ? null : h));
    } },
    sscanf: { ret: T.int, call(args, loc) {
      needArgs(args, 2, 'sscanf', loc);
      const src = S(this, args[0], loc);
      return I(scanC(this, needPtr(this, args[1], 'sscanf', loc), args.slice(2), loc, { buf: src, pos: 0 }));
    } },
    fopen: { ret: voidP, call(args, loc) {
      needArgs(args, 2, 'fopen', loc);
      const name = decodeLatin(S(this, args[0], loc));
      const mode = decodeLatin(S(this, args[1], loc));
      let f = this.files.get(name);
      const m = mode[0];
      if (m === 'r' && !f) return P(voidP, 0);
      if (!f || m === 'w') { f = { bytes: [] }; this.files.set(name, f); }
      const plus = mode.indexOf('+') !== -1;
      const h = { name: name, f: f, pos: m === 'a' ? f.bytes.length : 0, append: m === 'a', r: m === 'r' || plus, w: m !== 'r' || plus, eof: false };
      Object.defineProperty(h, 'buf', { get() { return this.f.bytes; } });
      const addr = FILE_BASE + (this.handleSeq++) * 16;
      this.handles.set(addr, h);
      return P(voidP, addr);
    } },
    fclose: { ret: T.int, call(args, loc) {
      const a = num(args[0].v);
      if (!this.handles.has(a)) throw rtErr(a === 0 ? 'fclose() was given NULL: fopen() had failed, so there is nothing to close.' : 'fclose() was given a file that is not open (closed twice?).', loc);
      this.handles.delete(a);
      return I(0);
    } },
    feof: { ret: T.int, call(args, loc) { return I(this.stream(args[0], loc, 'feof').eof ? 1 : 0); } },
    ferror: { ret: T.int, call() { return I(0); } },
    clearerr: { ret: T.void, call(args, loc) { this.stream(args[0], loc, 'clearerr').eof = false; return VOIDV; } },
    rewind: { ret: T.void, call(args, loc) { const h = this.stream(args[0], loc, 'rewind'); h.pos = 0; h.eof = false; return VOIDV; } },
    ftell: { ret: T.long, call(args, loc) { return { t: T.long, v: BigInt(this.stream(args[0], loc, 'ftell').pos) }; } },
    fseek: { ret: T.int, call(args, loc) {
      const h = this.stream(args[0], loc, 'fseek');
      const off = num(args[1].v), wh = num(args[2].v);
      const base = wh === 1 ? h.pos : wh === 2 ? h.buf.length : 0;
      if (base + off < 0) return I(-1);
      h.pos = base + off; h.eof = false;
      return I(0);
    } },
    fread: { ret: T.ulong, call(args, loc) {
      needArgs(args, 4, 'fread', loc);
      const dst = needPtr(this, args[0], 'fread', loc), size = num(args[1].v), n = num(args[2].v);
      const h = this.stream(args[3], loc, 'fread');
      let got = 0;
      for (; got < n; got++) {
        if (h.pos + size > h.buf.length) { h.eof = true; break; }
        writeBytes(this, dst + got * size, h.buf.slice(h.pos, h.pos + size), loc);
        h.pos += size;
      }
      return UL(got);
    } },
    fwrite: { ret: T.ulong, call(args, loc) {
      needArgs(args, 4, 'fwrite', loc);
      const src = needPtr(this, args[0], 'fwrite', loc), size = num(args[1].v), n = num(args[2].v);
      this.region(src, size * n, false, loc);
      this.writeTo(this.stream(args[3], loc, 'fwrite'), Array.from(this.mem.slice(src, src + size * n)), loc);
      return UL(n);
    } },
    remove: { ret: T.int, call(args, loc) { return I(this.files.delete(decodeLatin(S(this, args[0], loc))) ? 0 : -1); } },
    rename: { ret: T.int, call(args, loc) {
      const a = decodeLatin(S(this, args[0], loc)), b = decodeLatin(S(this, args[1], loc));
      if (!this.files.has(a)) return I(-1);
      this.files.set(b, this.files.get(a)); this.files.delete(a);
      return I(0);
    } },
    system: { ret: T.int, call() { return I(0); } },
    exit: { ret: T.void, call(args) { this.endSnap = this.snapshot('end', null); throw new Exit(args[0] ? num(args[0].v) : 0); } },
    abort: { ret: T.void, call() { this.endSnap = this.snapshot('end', null); throw new Exit(134); } },

    malloc: { ret: voidP, call(args, loc) { needArgs(args, 1, 'malloc', loc); return P(voidP, this.malloc(num(args[0].v), loc, false)); } },
    calloc: { ret: voidP, call(args, loc) { needArgs(args, 2, 'calloc', loc); return P(voidP, this.malloc(num(args[0].v) * num(args[1].v), loc, true)); } },
    realloc: { ret: voidP, call(args, loc) {
      needArgs(args, 2, 'realloc', loc);
      const old = args[0].v, n = num(args[1].v);
      const nb = this.malloc(n, loc, false);
      if (old) {
        const b = this.blockAt(old);
        if (!b || b.addr !== old) throw rtErr('realloc() needs an address that malloc() gave you.', loc);
        if (b.freed) throw rtErr('realloc() was given a block that is already freed.', loc);
        this.copy(nb, old, Math.min(b.size, n), loc);
        b.freed = true;
      }
      return P(voidP, nb);
    } },
    free: { ret: T.void, call(args, loc) {
      const a = args[0] && args[0].v;
      if (!a) return VOIDV;
      if (args[0].u) throw rtErr('free() was given a pointer that was never set.', loc);
      const b = this.blockAt(a);
      if (!b || b.addr !== a) throw rtErr(a >= HEAP_BASE && a < RODATA_BASE ? 'free() needs the address malloc() returned, not one inside the block.' : 'free() only takes addresses from malloc(); this one is a variable on the stack.', loc);
      if (b.freed) throw rtErr('This block was already freed: free() twice on the same address.', loc);
      b.freed = true;
      if (this.logDepth > 0) this.writes.push([b.addr, b.size]);
      return VOIDV;
    } },

    strlen: { ret: T.ulong, call(args, loc) { return UL(this.cstr(needPtr(this, args[0], 'strlen', loc), loc).length); } },
    strcpy: { ret: charP, call(args, loc) {
      const d = needPtr(this, args[0], 'strcpy', loc);
      writeBytes(this, d, this.cstr(needPtr(this, args[1], 'strcpy', loc), loc).concat([0]), loc);
      return P(charP, d);
    } },
    strncpy: { ret: charP, call(args, loc) {
      const d = needPtr(this, args[0], 'strncpy', loc);
      const n = num(args[2].v);
      const s = this.cstr(needPtr(this, args[1], 'strncpy', loc), loc, n);
      const out = s.slice(0, n);
      while (out.length < n) out.push(0);
      writeBytes(this, d, out, loc);
      return P(charP, d);
    } },
    strcat: { ret: charP, call(args, loc) {
      const d = needPtr(this, args[0], 'strcat', loc);
      const len = this.cstr(d, loc).length;
      writeBytes(this, d + len, this.cstr(needPtr(this, args[1], 'strcat', loc), loc).concat([0]), loc);
      return P(charP, d);
    } },
    strncat: { ret: charP, call(args, loc) {
      const d = needPtr(this, args[0], 'strncat', loc);
      const len = this.cstr(d, loc).length;
      writeBytes(this, d + len, this.cstr(needPtr(this, args[1], 'strncat', loc), loc, num(args[2].v)).concat([0]), loc);
      return P(charP, d);
    } },
    strcmp: { ret: T.int, call(args, loc) { return I(cmpBytes(this.cstr(needPtr(this, args[0], 'strcmp', loc), loc), this.cstr(needPtr(this, args[1], 'strcmp', loc), loc))); } },
    strncmp: { ret: T.int, call(args, loc) {
      const n = num(args[2].v);
      return I(cmpBytes(this.cstr(needPtr(this, args[0], 'strncmp', loc), loc, n), this.cstr(needPtr(this, args[1], 'strncmp', loc), loc, n)));
    } },
    strcasecmp: { ret: T.int, call(args, loc) { return I(cmpBytes(lowerB(this.cstr(needPtr(this, args[0], 'strcasecmp', loc), loc)), lowerB(this.cstr(needPtr(this, args[1], 'strcasecmp', loc), loc)))); } },
    strchr: { ret: charP, call(args, loc) {
      const s = needPtr(this, args[0], 'strchr', loc);
      const c = num(args[1].v) & 0xff;
      const b = this.cstr(s, loc);
      if (c === 0) return P(charP, s + b.length);
      const i = b.indexOf(c);
      return P(charP, i === -1 ? 0 : s + i);
    } },
    strrchr: { ret: charP, call(args, loc) {
      const s = needPtr(this, args[0], 'strrchr', loc);
      const c = num(args[1].v) & 0xff;
      const b = this.cstr(s, loc);
      if (c === 0) return P(charP, s + b.length);
      const i = b.lastIndexOf(c);
      return P(charP, i === -1 ? 0 : s + i);
    } },
    strstr: { ret: charP, call(args, loc) {
      const s = needPtr(this, args[0], 'strstr', loc);
      const h = decodeLatin(this.cstr(s, loc)), n = decodeLatin(this.cstr(needPtr(this, args[1], 'strstr', loc), loc));
      const i = h.indexOf(n);
      return P(charP, i === -1 ? 0 : s + i);
    } },
    strdup: { ret: charP, call(args, loc) {
      const b = this.cstr(needPtr(this, args[0], 'strdup', loc), loc);
      const a = this.malloc(b.length + 1, loc, false);
      writeBytes(this, a, b.concat([0]), loc);
      return P(charP, a);
    } },
    strtok: { ret: charP, call(args, loc) {
      let s = args[0].v;
      if (!s) s = this.strtokPos;
      if (!s) return P(charP, 0);
      const delim = this.cstr(needPtr(this, args[1], 'strtok', loc), loc);
      while (this.mem[s] && delim.indexOf(this.mem[s]) !== -1) s++;
      if (!this.mem[s]) { this.strtokPos = 0; return P(charP, 0); }
      let e2 = s;
      while (this.mem[e2] && delim.indexOf(this.mem[e2]) === -1) e2++;
      if (this.mem[e2]) { this.write(e2, T.char, 0, loc); this.strtokPos = e2 + 1; } else this.strtokPos = 0;
      return P(charP, s);
    } },
    strupr: { ret: charP, call(args, loc) { const s = needPtr(this, args[0], 'strupr', loc); const b = this.cstr(s, loc).map(c => (c >= 97 && c <= 122 ? c - 32 : c)); writeBytes(this, s, b, loc); return P(charP, s); } },
    strlwr: { ret: charP, call(args, loc) { const s = needPtr(this, args[0], 'strlwr', loc); writeBytes(this, s, lowerB(this.cstr(s, loc)), loc); return P(charP, s); } },
    strrev: { ret: charP, call(args, loc) { const s = needPtr(this, args[0], 'strrev', loc); writeBytes(this, s, this.cstr(s, loc).reverse(), loc); return P(charP, s); } },
    memset: { ret: voidP, call(args, loc) {
      const d = needPtr(this, args[0], 'memset', loc);
      const n = num(args[2].v);
      this.region(d, n, true, loc);
      this.mem.fill(num(args[1].v) & 0xff, d, d + n);
      this.markWrite(d, n, true);
      return P(voidP, d);
    } },
    memcpy: { ret: voidP, call(args, loc) { const d = needPtr(this, args[0], 'memcpy', loc); this.copy(d, needPtr(this, args[1], 'memcpy', loc), num(args[2].v), loc); return P(voidP, d); } },
    memmove: { ret: voidP, call(args, loc) { const d = needPtr(this, args[0], 'memmove', loc); this.copy(d, needPtr(this, args[1], 'memmove', loc), num(args[2].v), loc); return P(voidP, d); } },
    memcmp: { ret: T.int, call(args, loc) {
      const a = needPtr(this, args[0], 'memcmp', loc), b = needPtr(this, args[1], 'memcmp', loc), n = num(args[2].v);
      this.region(a, n, false, loc); this.region(b, n, false, loc);
      for (let i = 0; i < n; i++) { const d = this.mem[a + i] - this.mem[b + i]; if (d) return I(d < 0 ? -1 : 1); }
      return I(0);
    } },

    abs: { ret: T.int, call(args) { const v = num(args[0].v); return I(Math.abs(v)); } },
    labs: { ret: T.long, call(args) { const v = BigInt(args[0].v); return { t: T.long, v: v < 0n ? -v : v }; } },
    llabs: { ret: T.llong, call(args) { const v = BigInt(args[0].v); return { t: T.llong, v: v < 0n ? -v : v }; } },
    atoi: { ret: T.int, call(args, loc) { return I(parseIntPrefix(decodeLatin(S(this, args[0], loc)), 10).v); } },
    atol: { ret: T.long, call(args, loc) { return { t: T.long, v: BigInt(parseIntPrefix(decodeLatin(S(this, args[0], loc)), 10).v) }; } },
    atof: { ret: T.double, call(args, loc) { return D(parseFloatPrefix(decodeLatin(S(this, args[0], loc))).v); } },
    strtol: { ret: T.long, call(args, loc) {
      const s = needPtr(this, args[0], 'strtol', loc);
      const r = parseIntPrefix(decodeLatin(this.cstr(s, loc)), args[2] ? num(args[2].v) : 10);
      if (args[1] && args[1].v) this.write(args[1].v, charP, s + r.len, loc);
      return { t: T.long, v: BigInt(r.v) };
    } },
    strtod: { ret: T.double, call(args, loc) {
      const s = needPtr(this, args[0], 'strtod', loc);
      const r = parseFloatPrefix(decodeLatin(this.cstr(s, loc)));
      if (args[1] && args[1].v) this.write(args[1].v, charP, s + r.len, loc);
      return D(r.v);
    } },
    rand: { ret: T.int, call() { return I(glibcRand(this)); } },
    srand: { ret: T.void, call(args) { glibcSrand(this, num(args[0].v) >>> 0); return VOIDV; } },
    time: { ret: T.long, call(args, loc) {
      const t = 1700000000n;
      if (args[0] && args[0].v) this.write(args[0].v, T.long, t, loc);
      return { t: T.long, v: t };
    } },
    clock: { ret: T.long, call() { return { t: T.long, v: BigInt(this.steps) }; } },
    qsort: { ret: T.void, call(args, loc) {
      needArgs(args, 4, 'qsort', loc);
      const base = needPtr(this, args[0], 'qsort', loc), n = num(args[1].v), size = num(args[2].v), cmp = args[3].v;
      this.region(base, n * size, true, loc);
      const items = [];
      for (let i = 0; i < n; i++) items.push({ b: this.mem.slice(base + i * size, base + (i + 1) * size), ini: this.init.slice(base + i * size, base + (i + 1) * size) });
      const sp = this.sp;
      const ta = this.stackAlloc(arrOf(T.char, size)), tb = this.stackAlloc(arrOf(T.char, size));
      const vt = ptrTo(T.void);
      const sorted = mergeSort(items, (x, y) => {
        this.mem.set(x.b, ta); this.init.set(x.ini, ta);
        this.mem.set(y.b, tb); this.init.set(y.ini, tb);
        return num(this.callAddr(cmp, [{ t: vt, v: ta }, { t: vt, v: tb }], loc).v);
      });
      this.sp = sp;
      sorted.forEach((it, i) => { this.mem.set(it.b, base + i * size); this.init.set(it.ini, base + i * size); });
      if (this.logDepth > 0) this.writes.push([base, n * size]);
      return VOIDV;
    } },

    sqrt: mathFn(Math.sqrt), pow: mathFn(Math.pow), fabs: mathFn(Math.abs), floor: mathFn(Math.floor),
    ceil: mathFn(Math.ceil), round: mathFn(cRound), trunc: mathFn(Math.trunc),
    fmod: mathFn((a, b) => a % b), sin: mathFn(Math.sin), cos: mathFn(Math.cos), tan: mathFn(Math.tan),
    asin: mathFn(Math.asin), acos: mathFn(Math.acos), atan: mathFn(Math.atan), atan2: mathFn(Math.atan2),
    exp: mathFn(Math.exp), log: mathFn(Math.log), log10: mathFn(Math.log10), log2: mathFn(Math.log2),
    hypot: mathFn(Math.hypot), cbrt: mathFn(Math.cbrt), fmax: mathFn(Math.max), fmin: mathFn(Math.min),
    sqrtf: mathFnF(Math.sqrt), powf: mathFnF(Math.pow), fabsf: mathFnF(Math.abs), floorf: mathFnF(Math.floor),
    ceilf: mathFnF(Math.ceil), roundf: mathFnF(cRound),
    lround: { ret: T.long, call(args) { return { t: T.long, v: BigInt(cRound(dbl(args[0]))) }; } },

    isalpha: ctype(c => (c >= 65 && c <= 90) || (c >= 97 && c <= 122)),
    isdigit: ctype(c => c >= 48 && c <= 57),
    isalnum: ctype(c => (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57)),
    isspace: ctype(c => c === 32 || (c >= 9 && c <= 13)),
    isupper: ctype(c => c >= 65 && c <= 90),
    islower: ctype(c => c >= 97 && c <= 122),
    ispunct: ctype(c => c > 32 && c < 127 && !((c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57))),
    isxdigit: ctype(c => (c >= 48 && c <= 57) || (c >= 65 && c <= 70) || (c >= 97 && c <= 102)),
    isprint: ctype(c => c >= 32 && c < 127),
    iscntrl: ctype(c => c < 32 || c === 127),
    toupper: { ret: T.int, call(args) { const c = num(args[0].v); return I(c >= 97 && c <= 122 ? c - 32 : c); } },
    tolower: { ret: T.int, call(args) { const c = num(args[0].v); return I(c >= 65 && c <= 90 ? c + 32 : c); } },
    Sleep: { ret: T.void, call() { return VOIDV; } },
    sleep: { ret: T.int, call() { return I(0); } },
    usleep: { ret: T.int, call() { return I(0); } }
  };

  function cmpBytes(a, b) {
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
    return a.length === b.length ? 0 : (a.length < b.length ? -1 : 1);
  }
  const lowerB = (b) => b.map(c => (c >= 65 && c <= 90 ? c + 32 : c));
  function mergeSort(a, cmp) {
    if (a.length < 2) return a;
    const m = a.length >> 1;
    const l = mergeSort(a.slice(0, m), cmp), r = mergeSort(a.slice(m), cmp);
    const out = [];
    let i = 0, j = 0;
    while (i < l.length && j < r.length) out.push(cmp(l[i], r[j]) <= 0 ? l[i++] : r[j++]);
    while (i < l.length) out.push(l[i++]);
    while (j < r.length) out.push(r[j++]);
    return out;
  }
  function parseIntPrefix(s, base) {
    const m = /^[ \t\n\r\f\v]*([+-]?)(0[xX][0-9a-fA-F]+|[0-9]+)?/.exec(s);
    if (!m || !m[2]) return { v: 0, len: 0 };
    let digits = m[2];
    let b = base || 10;
    if ((b === 16 || b === 0) && /^0[xX]/.test(digits)) { b = 16; digits = digits.slice(2); }
    else if (b === 0) b = digits.length > 1 && digits[0] === '0' ? 8 : 10;
    let v = 0, used = 0;
    for (const ch of digits) { const d = parseInt(ch, 36); if (Number.isNaN(d) || d >= b) break; v = v * b + d; used++; }
    return { v: m[1] === '-' ? -v : v, len: m[0].length - (m[2].length - used - (m[2].length - digits.length)) };
  }
  function parseFloatPrefix(s) {
    const m = /^[ \t\n\r\f\v]*[+-]?(?:(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?|inf(?:inity)?|nan)/i.exec(s);
    if (!m) return { v: 0, len: 0 };
    const body = m[0].trim().toLowerCase();
    const v = /inf/.test(body) ? (body[0] === '-' ? -Infinity : Infinity) : (/nan/.test(body) ? NaN : Number(body));
    return { v: v, len: m[0].length };
  }

  /* glibc's rand(): the additive feedback generator, so srand(42) gives the
     same numbers here as in Run Code. */
  function glibcSrand(vm, seed) {
    const r = new Array(34);
    r[0] = seed === 0 ? 1 : seed;
    for (let i = 1; i < 31; i++) {
      const hi = Math.trunc(r[i - 1] / 127773), lo = r[i - 1] % 127773;
      let w = 16807 * lo - 2836 * hi;
      if (w < 0) w += 2147483647;
      r[i] = w;
    }
    for (let i = 31; i < 34; i++) r[i] = r[i - 31];
    const st = { r: r.map(x => x >>> 0), k: 34 };
    for (let i = 0; i < 310; i++) glibcStep(st);
    vm.randState = st;
  }
  function glibcStep(st) {
    const r = st.r;
    const v = (r[r.length - 31] + r[r.length - 3]) >>> 0;
    r.push(v);
    if (r.length > 64) r.splice(0, r.length - 34);
    return v;
  }
  function glibcRand(vm) {
    if (!vm.randState) glibcSrand(vm, 1);
    return glibcStep(vm.randState) >>> 1;
  }

  /* ── printf ── */
  function formatC(vm, fmtAddr, args, loc) {
    const f = vm.cstr(fmtAddr, loc);
    const out = [];
    let ai = 0;
    const nextArg = (conv) => {
      if (ai >= args.length) throw rtErr('The format has more %' + conv + ' than values after it.', loc);
      return args[ai++];
    };
    const pushStr = (s) => { for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i) & 0xff); };
    for (let i = 0; i < f.length; i++) {
      const c = f[i];
      if (c !== 37) { out.push(c); continue; }
      i++;
      if (f[i] === 37) { out.push(37); continue; }
      let flags = '';
      while ('-+ #0'.indexOf(String.fromCharCode(f[i])) !== -1 && i < f.length) flags += String.fromCharCode(f[i++]);
      let width = null, prec = null;
      if (f[i] === 42) { width = num(nextArg('*').v); i++; if (width < 0) { flags += '-'; width = -width; } }
      else { let w = ''; while (f[i] >= 48 && f[i] <= 57) w += String.fromCharCode(f[i++]); if (w) width = Number(w); }
      if (f[i] === 46) {
        i++;
        if (f[i] === 42) { prec = num(nextArg('*').v); i++; if (prec < 0) prec = null; }
        else { let p = ''; while (f[i] >= 48 && f[i] <= 57) p += String.fromCharCode(f[i++]); prec = p ? Number(p) : 0; }
      }
      let len = '';
      while ('hlLqjzt'.indexOf(String.fromCharCode(f[i])) !== -1 && i < f.length) len += String.fromCharCode(f[i++]);
      const cv = String.fromCharCode(f[i]);
      if (i >= f.length) { pushStr('%'); break; }
      let body = '', sign = '', isNum = true;
      switch (cv) {
        case 'd': case 'i': {
          const a = nextArg(cv);
          let v = isFloat(a.t) ? BigInt(Math.trunc(a.v) | 0) : BigInt(a.v);
          if (len === 'hh') v = BigInt.asIntN(8, v); else if (len === 'h') v = BigInt.asIntN(16, v);
          else if (len === 'l' || len === 'll' || len === 'j' || len === 'z' || len === 't' || len === 'q') v = BigInt.asIntN(64, v);
          else v = BigInt.asIntN(32, v);
          if (v < 0n) { sign = '-'; v = -v; } else if (flags.indexOf('+') !== -1) sign = '+'; else if (flags.indexOf(' ') !== -1) sign = ' ';
          body = v.toString();
          if (prec != null) { body = body.padStart(prec, '0'); if (prec === 0 && v === 0n) body = ''; }
          break;
        }
        case 'u': case 'x': case 'X': case 'o': {
          const a = nextArg(cv);
          let v = isFloat(a.t) ? BigInt(Math.trunc(a.v)) : BigInt(a.v);
          const bits = len === 'hh' ? 8 : len === 'h' ? 16 : (len === 'l' || len === 'll' || len === 'j' || len === 'z' || len === 't' || len === 'q') ? 64 : 32;
          v = BigInt.asUintN(bits, v);
          body = v.toString(cv === 'u' ? 10 : cv === 'o' ? 8 : 16);
          if (cv === 'X') body = body.toUpperCase();
          if (prec != null) { body = body.padStart(prec, '0'); if (prec === 0 && v === 0n) body = ''; }
          if (flags.indexOf('#') !== -1 && v !== 0n) { if (cv === 'x') sign = '0x'; else if (cv === 'X') sign = '0X'; else if (cv === 'o' && body[0] !== '0') body = '0' + body; }
          break;
        }
        case 'c': {
          const a = nextArg(cv);
          isNum = false;
          const bytes = [num(a.v) & 0xff];
          padBytes(out, bytes, width, flags);
          continue;
        }
        case 's': {
          const a = nextArg(cv);
          isNum = false;
          if (a.t.k !== 'ptr') throw rtErr('%s needs a string (a char array or char *), but got ' + typeName(a.t) + '.', loc);
          let bytes = a.v === 0 ? [40, 110, 117, 108, 108, 41] : vm.cstr(a.v, loc, prec == null ? undefined : prec);
          if (prec != null) bytes = bytes.slice(0, prec);
          padBytes(out, bytes, width, flags);
          continue;
        }
        case 'f': case 'F': case 'e': case 'E': case 'g': case 'G': case 'a': case 'A': {
          const a = nextArg(cv);
          let v = isFloat(a.t) ? a.v : Number(a.v);
          if (isInt(a.t)) v = 0;   // gcc would print garbage for an int passed as %f
          if (v < 0 || Object.is(v, -0)) { sign = '-'; v = -v; } else if (flags.indexOf('+') !== -1) sign = '+'; else if (flags.indexOf(' ') !== -1) sign = ' ';
          body = fmtFloat(v, cv, prec == null ? 6 : prec, flags.indexOf('#') !== -1);
          if (!Number.isFinite(v)) { flags = flags.replace(/0/g, ''); }
          break;
        }
        case 'p': {
          const a = nextArg(cv);
          body = a.v ? '0x' + Number(a.v).toString(16) : '(nil)';
          isNum = false;
          padBytes(out, Array.from(body, ch => ch.charCodeAt(0)), width, flags);
          continue;
        }
        case 'n': { nextArg(cv); continue; }
        default:
          pushStr('%' + flags + (width != null ? width : '') + (prec != null ? '.' + prec : '') + len + cv);
          continue;
      }
      if (isNum) {
        let s = sign + body;
        if (width != null && s.length < width) {
          if (flags.indexOf('-') !== -1) s = s.padEnd(width, ' ');
          else if (flags.indexOf('0') !== -1 && (prec == null || 'fFeEgG'.indexOf(cv) !== -1)) s = sign + body.padStart(width - sign.length, '0');
          else s = s.padStart(width, ' ');
        }
        pushStr(s);
      }
    }
    return out;
  }
  function padBytes(out, bytes, width, flags) {
    const pad = width != null && bytes.length < width ? width - bytes.length : 0;
    if (pad && flags.indexOf('-') === -1) for (let k = 0; k < pad; k++) out.push(32);
    for (const b of bytes) out.push(b);
    if (pad && flags.indexOf('-') !== -1) for (let k = 0; k < pad; k++) out.push(32);
  }
  /* toFixed rounds an exact tie up; glibc rounds it to even. Ties are rare
     (only values exactly halfway in binary), but 0.125 -> "0.12" is one. */
  function toFixedC(v, p) {
    let s = v.toFixed(Math.min(p, 100));
    if (p <= 20) {
      const scaled = v * Math.pow(10, p);
      const fl = Math.floor(scaled);
      if (scaled - fl === 0.5 && Number.isFinite(scaled) && scaled < 9e15 && (fl / Math.pow(10, p) + 0.5 / Math.pow(10, p)) === v) {
        const even = fl % 2 === 0 ? fl : fl + 1;
        s = (even / Math.pow(10, p)).toFixed(p);
      }
    }
    if (p > 100) s += '0'.repeat(p - 100);
    return s;
  }
  function fmtFloat(v, cv, prec, alt) {
    if (!Number.isFinite(v)) {
      const s = Number.isNaN(v) ? 'nan' : 'inf';
      return cv === cv.toUpperCase() ? s.toUpperCase() : s;
    }
    const lower = cv.toLowerCase();
    if (lower === 'f') { const s = toFixedC(v, prec); return alt && prec === 0 ? s + '.' : s; }
    if (lower === 'e') {
      let s = v.toExponential(Math.min(prec, 100));
      s = s.replace(/e([+-])(\d)$/, 'e$10$2');
      if (alt && prec === 0) s = s.replace('e', '.e');
      return cv === 'E' ? s.toUpperCase() : s;
    }
    if (lower === 'g') {
      const P0 = prec === 0 ? 1 : prec;
      if (v === 0) {
        const z = alt ? (P0 > 1 ? '0.' + '0'.repeat(P0 - 1) : '0.') : '0';
        return z;
      }
      const ex = Number(v.toExponential(P0 - 1).split('e')[1]);
      let s;
      if (P0 > ex && ex >= -4) s = toFixedC(v, P0 - 1 - ex);
      else s = v.toExponential(P0 - 1).replace(/e([+-])(\d)$/, 'e$10$2');
      if (!alt) {
        if (s.indexOf('e') !== -1) s = s.replace(/\.?0+e/, 'e');
        else if (s.indexOf('.') !== -1) s = s.replace(/\.?0+$/, '');
      }
      return cv === 'G' ? s.toUpperCase() : s;
    }
    if (lower === 'a') return v.toString(16);
    return String(v);
  }

  /* ── scanf ── */
  function scanC(vm, fmtAddr, args, loc, src) {
    const f = vm.cstr(fmtAddr, loc);
    const inBuf = src ? src.buf : vm.input;
    let pos = src ? src.pos : vm.inPos;
    const at = () => (pos < inBuf.length ? inBuf[pos] : -1);
    const isWs = (c) => c === 32 || (c >= 9 && c <= 13);
    let assigned = 0, ai = 0, failedEarly = true, ranOut = false;
    const store = (t, v) => {
      if (ai >= args.length) throw rtErr('The scanf format has more % than places to store them.', loc);
      const a = args[ai++];
      if (a.t.k !== 'ptr') throw rtErr('scanf needs the address of each variable: put & before ' + (a.t.k === 'int' ? 'it' : 'the variable') + '.', loc);
      if (a.u) throw rtErr('scanf was given a pointer that was never set.', loc);
      if (a.v === 0) throw rtErr('scanf was given NULL to store into.', loc);
      vm.write(a.v, t, conv(v, typeof v === 'bigint' ? T.llong : (Number.isInteger(v) ? T.llong : T.double), t), loc);
    };
    const storeBytes = (bytes, addNul) => {
      if (ai >= args.length) throw rtErr('The scanf format has more % than places to store them.', loc);
      const a = args[ai++];
      if (a.t.k !== 'ptr') throw rtErr('%s and %c need a char array (no & needed for an array).', loc);
      writeBytes(vm, a.v, addNul ? bytes.concat([0]) : bytes, loc);
    };
    let i = 0;
    for (; i < f.length; i++) {
      const c = f[i];
      if (isWs(c)) { while (isWs(at())) pos++; continue; }
      if (c !== 37) {
        if (at() === -1) { ranOut = true; break; }
        if (at() !== c) break;
        pos++; continue;
      }
      i++;
      if (f[i] === 37) { while (isWs(at())) pos++; if (at() !== 37) break; pos++; continue; }
      let suppress = false;
      if (f[i] === 42) { suppress = true; i++; }
      let w = '';
      while (f[i] >= 48 && f[i] <= 57) w += String.fromCharCode(f[i++]);
      const width = w ? Number(w) : Infinity;
      let len = '';
      while ('hlLqjzt'.indexOf(String.fromCharCode(f[i])) !== -1 && i < f.length) len += String.fromCharCode(f[i++]);
      const cv = String.fromCharCode(f[i]);
      if (cv !== 'c' && cv !== '[' && cv !== 'n') while (isWs(at())) pos++;
      if (cv !== 'n' && at() === -1) { ranOut = true; break; }
      failedEarly = false;
      if (cv === 'd' || cv === 'i' || cv === 'u' || cv === 'x' || cv === 'X' || cv === 'o') {
        let s = '';
        const base = cv === 'x' || cv === 'X' ? 16 : cv === 'o' ? 8 : 10;
        if ((at() === 43 || at() === 45) && s.length < width) { s += String.fromCharCode(at()); pos++; }
        let b = base;
        if (cv === 'i' && at() === 48) { b = 8; }
        if ((cv === 'i' || cv === 'x' || cv === 'X') && at() === 48 && (inBuf[pos + 1] === 120 || inBuf[pos + 1] === 88)) { b = 16; s += '0x'; pos += 2; }
        let digits = '';
        while (s.length + digits.length < width) {
          const ch = at();
          const d = ch === -1 ? NaN : parseInt(String.fromCharCode(ch), 36);
          if (Number.isNaN(d) || d >= b) break;
          digits += String.fromCharCode(ch); pos++;
        }
        if (!digits) break;
        if (!suppress) {
          let v = BigInt(b === 10 ? digits : (b === 16 ? '0x' + digits : '0o' + digits));
          if (s[0] === '-') v = -v;
          const t = len === 'hh' ? (cv === 'd' || cv === 'i' ? T.schar : T.uchar) : len === 'h' ? T.short : (len === 'l' || len === 'll' || len === 'j' || len === 'z' || len === 'q') ? T.long : (cv === 'd' || cv === 'i' ? T.int : T.uint);
          store(t, t.size === 8 ? BigInt.asIntN(64, v) : Number(BigInt.asIntN(32, v)));
          assigned++;
        }
        continue;
      }
      if ('feEgGaA'.indexOf(cv) !== -1) {
        let s = '';
        const rest = decodeLatin(Array.from(inBuf.slice(pos, pos + Math.min(width, 400))));
        const m = /^[+-]?(?:(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?|inf(?:inity)?|nan)/i.exec(rest);
        if (!m) break;
        s = m[0];
        pos += s.length;
        if (!suppress) {
          const v = parseFloatPrefix(s).v;
          store(len === 'l' ? T.double : (len === 'L' ? T.ldouble : T.float), v);
          assigned++;
        }
        continue;
      }
      if (cv === 's') {
        const bytes = [];
        while (at() !== -1 && !isWs(at()) && bytes.length < width) bytes.push(inBuf[pos++]);
        if (!suppress) { storeBytes(bytes, true); assigned++; }
        continue;
      }
      if (cv === 'c') {
        const n = width === Infinity ? 1 : width;
        const bytes = [];
        while (bytes.length < n && at() !== -1) bytes.push(inBuf[pos++]);
        if (!bytes.length) { ranOut = true; break; }
        if (!suppress) { storeBytes(bytes, false); assigned++; }
        continue;
      }
      if (cv === '[') {
        i++;
        let neg = false;
        if (f[i] === 94) { neg = true; i++; }
        const set = new Set();
        let first = true;
        while (i < f.length && (f[i] !== 93 || first)) {
          if (f[i + 1] === 45 && f[i + 2] && f[i + 2] !== 93) { for (let ch = f[i]; ch <= f[i + 2]; ch++) set.add(ch); i += 3; }
          else { set.add(f[i]); i++; }
          first = false;
        }
        const bytes = [];
        while (at() !== -1 && bytes.length < width && (neg ? !set.has(at()) : set.has(at()))) bytes.push(inBuf[pos++]);
        if (!bytes.length) break;
        if (!suppress) { storeBytes(bytes, true); assigned++; }
        continue;
      }
      if (cv === 'n') { if (!suppress) store(T.int, pos - (src ? 0 : 0)); continue; }
      if (cv === 'p') { break; }
      break;
    }
    if (src) { src.pos = pos; if (ranOut) src.eof = true; } else { vm.inPos = pos; if (ranOut) vm.stdin.eof = true; }
    if (ranOut && !src && !vm.inputShort) vm.inputShort = loc;
    if (ranOut && assigned === 0 && failedEarly) return -1;
    if (ranOut && assigned === 0) return -1;
    return assigned;
  }

  /* ── bytes and text ── */
  function encodeUtf8(s) {
    if (typeof TextEncoder !== 'undefined') return Array.from(new TextEncoder().encode(s));
    return Array.from(Buffer.from(s, 'utf8'));
  }
  function decodeUtf8(bytes) {
    const u8 = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
    if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8').decode(u8);
    return Buffer.from(u8).toString('utf8');
  }
  function decodeLatin(bytes) { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return s; }
  function concatBytes(chunks) {
    let n = 0;
    for (const c of chunks) n += c.length;
    const out = new Uint8Array(n);
    let o = 0;
    for (const c of chunks) { out.set(c, o); o += c.length; }
    return out;
  }
  function now() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }

  /* Run a parsed program. opts: { stdin, target, maxSteps, timeMs }. */
  function runProgram(prog, opts) {
    const vm = new VM(prog, opts);
    return vm.run();
  }

  CVM.VM = VM;
  CVM.runProgram = runProgram;
  CVM.BUILTINS = BUILTINS;
  CVM.layout = { GLOBAL_BASE, HEAP_BASE, RODATA_BASE, CODE_BASE };
  CVM.text = { encodeUtf8, decodeUtf8, decodeLatin };
  CVM.exprName = exprName;
  CVM.formatFloat = fmtFloat;

  if (typeof module !== 'undefined' && module.exports) module.exports = CVM;
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this));
