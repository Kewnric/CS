/* ============================================================
   CVM-VIEW.JS — from the cursor to a statement, from memory to boxes
   ------------------------------------------------------------
   Two pure steps between the interpreter and the window:

   targetAt(prog, file, offset) -- which statement the cursor is "after".
     Inside a block, it is the last statement that ends before the cursor;
     with nothing before it, the moment the block is entered. Statements
     inside a sibling branch never count: in `if (c) { A; } else { | }` the
     cursor is at the start of the else, not after A.

   describe(snapshot, prog, opts) -- a snapshot's bytes, read back through
     the types of the variables that own them, as a tree the window draws:
     frames (top of the stack first), globals and heap blocks, each variable
     a node with its value, its cells if it is an array, its members if it is
     a struct, and the address it points at if it is a pointer. Long arrays
     keep their first cells and their last, like the course's diagrams
     (0 1 2 3 ... 49). A heap block takes its type from the pointers that
     point at it, so a linked list draws as nodes, in the order they link.

   Plain script, no DOM.
   ============================================================ */
(function (root) {
  'use strict';
  const CVM = root.CVM || (root.CVM = {});
  if (!CVM.runProgram && typeof require === 'function') Object.assign(CVM, require('./cvm-run.js'));
  const T = CVM.T;
  const { ptrTo, arrOf, sizeOf, isInt, isFloat, typeName } = CVM.types;
  const L = CVM.layout;

  /* ── The cursor ─────────────────────────────────────────── */
  function inside(loc, f, off) { return loc && loc.f === f && loc.p < off && off < loc.e; }

  function targetAt(prog, f, off) {
    let fn = null;
    for (const fd of prog.funcs.values()) if (fd.body && inside(fd.body.loc, f, off)) { fn = fd; break; }
    if (!fn) return null;
    let block = fn.body;
    let found = null;
    for (let guard = 0; guard < 200 && !found; guard++) {
      const items = childList(block);
      let into = null, before = null;
      for (const it of items) {
        if (!it.loc || it.loc.f !== f) continue;
        if (inside(it.loc, f, off) || (it.loc.p === off && false)) { into = it; break; }
        if (it.loc.e <= off) before = it;
      }
      if (into) {
        const sub = descend(into, f, off);
        if (sub) { block = sub; continue; }
        found = { target: into.id, stmt: into };
        break;
      }
      if (before) {
        // At the very end of `for (...) x += n;` the cursor is on the body's
        // line, so it is the body (with its passes), not the whole loop.
        const deep = before.loc.e === off ? lastAtEnd(before) : null;
        found = deep ? { target: deep.id, stmt: deep } : { target: before.id, stmt: before };
      } else found = { target: { enter: block.id }, stmt: block, entering: true };
    }
    if (!found) return null;
    found.fn = fn;
    const s = found.stmt;
    found.line = found.entering ? s.loc.l : (s.loc.el || s.loc.l);
    return found;
  }
  function lastAtEnd(s) {
    const sub = s.k === 'if' ? (s.f || s.t) : (s.k === 'for' || s.k === 'while') ? s.body : null;
    if (!sub || sub.k === 'block' || sub.k === 'empty' || !sub.loc || sub.loc.e !== s.loc.e) return null;
    return lastAtEnd(sub) || sub;
  }
  // The statements one level down: a block's items, a case's body, etc.
  function childList(s) {
    if (s.k === 'block') return s.items;
    return [s];
  }
  /* The container to look inside, when the cursor is within a compound
     statement's body; null when it is in the statement's own header. */
  function descend(s, f, off) {
    const pick = (b) => (b && inside(b.loc, f, off) ? (b.k === 'block' ? b : wrapSingle(b)) : null);
    switch (s.k) {
      case 'block': return s;
      case 'if': return pick(s.t) || pick(s.f);
      case 'while': case 'do': case 'for': return pick(s.body);
      case 'switch': return pick(s.body);
      case 'case': case 'default': return pick(s.body);
    }
    return null;
  }
  // A lone statement as a branch (if (x) y = 1;) is looked into as a one-item block.
  function wrapSingle(b) {
    if (b.k === 'case' || b.k === 'default' || b.k === 'if' || b.k === 'for' || b.k === 'while' || b.k === 'do' || b.k === 'switch') {
      return { k: 'block', items: [b], loc: b.loc, id: b.id, virtual: true };
    }
    return { k: 'block', items: [b], loc: b.loc, id: b.id, virtual: true };
  }

  /* ── Reading a snapshot ─────────────────────────────────── */
  function reader(snap) {
    const pick = (addr) => {
      if (addr >= snap.lo && addr < snap.hi) return [snap.mem, snap.init, addr - snap.lo];
      if (addr >= L.HEAP_BASE && addr < snap.heapTop) return [snap.heapMem, snap.heapInit, addr - L.HEAP_BASE];
      if (addr >= L.RODATA_BASE && addr < snap.roTop) return [snap.ro, null, addr - L.RODATA_BASE];
      return null;
    };
    const byte = (addr) => { const r = pick(addr); return r ? r[0][r[2]] : 0; };
    const isSet = (addr, n) => {
      for (let i = 0; i < n; i++) {
        const r = pick(addr + i);
        if (!r) return false;
        if (r[1] && !r[1][r[2]]) return false;
      }
      return true;
    };
    const anySet = (addr, n) => {
      for (let i = 0; i < n; i++) { const r = pick(addr + i); if (r && (!r[1] || r[1][r[2]])) return true; }
      return false;
    };
    const dvOf = (addr, n) => {
      const b = new Uint8Array(8);
      for (let i = 0; i < n; i++) b[i] = byte(addr + i);
      return new DataView(b.buffer);
    };
    const num = (addr, t) => {
      const dv = dvOf(addr, t.size);
      if (t.k === 'ptr') return Number(dv.getBigUint64(0, true));
      if (t.k === 'float') return t.size === 4 ? dv.getFloat32(0, true) : dv.getFloat64(0, true);
      switch (t.size) {
        case 1: return t.signed ? dv.getInt8(0) : dv.getUint8(0);
        case 2: return t.signed ? dv.getInt16(0, true) : dv.getUint16(0, true);
        case 4: return t.signed ? dv.getInt32(0, true) : dv.getUint32(0, true);
        default: return t.signed ? dv.getBigInt64(0, true) : dv.getBigUint64(0, true);
      }
    };
    const cstr = (addr, max) => {
      const out = [];
      for (let i = 0; i < (max || 200); i++) { const c = byte(addr + i); if (!c) break; out.push(c); }
      return CVM.text.decodeUtf8(out);
    };
    const changed = (addr, n) => {
      for (const [a, len] of snap.writes || []) if (a < addr + n && addr < a + len) return true;
      return false;
    };
    return { byte, isSet, anySet, num, cstr, changed };
  }

  const isCharT = (t) => isInt(t) && t.size === 1 && !t.bool;
  function charLabel(c) {
    if (c === 0) return '\\0';
    if (c === 10) return '\\n';
    if (c === 9) return '\\t';
    if (c === 13) return '\\r';
    if (c === 32) return "' '";
    if (c === 39) return "'\\''";
    if (c > 32 && c < 127) return "'" + String.fromCharCode(c) + "'";
    return String(c);
  }
  function fmtNum(v, t) {
    if (isFloat(t)) {
      if (!Number.isFinite(v)) return Number.isNaN(v) ? 'nan' : (v < 0 ? '-inf' : 'inf');
      let s = CVM.formatFloat(Math.abs(v), 'g', t.size === 4 ? 6 : 8, false);
      if (!/[.e]/.test(s)) s += '.0';
      return (v < 0 || Object.is(v, -0) ? '-' : '') + s;
    }
    if (t.bool) return v ? 'true' : 'false';
    if (t.enumNames && t.enumNames.has(Number(v))) return t.enumNames.get(Number(v));
    if (isCharT(t)) return charLabel(Number(v) & 0xff);
    return String(v);
  }

  const addrLabel = (a) => 'A' + a;

  /* opts: { arrays: 'auto' | 'across' | 'down', maxCells } */
  function describe(snap, prog, opts) {
    opts = opts || {};
    const R = reader(snap);
    const blocks = (snap.blocks || []).slice().sort((a, b) => a.addr - b.addr);
    const blockAt = (addr) => {
      for (const b of blocks) if (addr >= b.addr && addr < b.addr + Math.max(b.size, 1)) return b;
      return null;
    };
    const live = (addr) => (addr >= L.GLOBAL_BASE && addr < snap.sp) || !!blockAt(addr);
    const heapTypes = new Map();   // block addr -> type
    const ptrSeen = [];            // { to, target }

    const fnNameAt = (a) => {
      const fn = snap.fnAt && snap.fnAt.get(a);
      if (fn) return fn.name;
      return null;
    };

    function node(name, t, addr, ctx) {
      const depth = ctx.depth || 0;
      const label = ctx.spell || typeName(t);
      const size = Math.max(sizeOf(t), t.k === 'void' ? 1 : 0);
      const base = { name: name, label: label, addr: addr, size: size, changed: R.changed(addr, size) };
      if (t.k === 'struct') {
        const children = depth > 7 ? [] : t.members.filter(m => m.name).map(m => node(m.name, m.type, addr + m.off,
          { depth: depth + 1, spell: m.spell, inStruct: true, compact: ctx.compact }));
        return Object.assign(base, { kind: 'struct', title: (ctx.spell || typeName(t)), children: children,
          unset: !R.anySet(addr, size), tag: t.tag || t.tdName || '' });
      }
      if (t.k === 'arr') return arrayNode(base, name, t, addr, ctx);
      if (t.k === 'ptr') {
        const unset = !R.isSet(addr, 8);
        const v = R.num(addr, t);
        const out = Object.assign(base, { kind: 'ptr', unset: unset, raw: v });
        if (unset) { out.value = '?'; out.note = 'never set'; return out; }
        if (v === 0) { out.value = 'NULL'; out.isNull = true; return out; }
        out.value = addrLabel(v);
        if (t.to.k === 'fn' || (v >= L.CODE_BASE && v < L.CODE_BASE + 40000)) {
          const fname = fnNameAt(v);
          out.kind = 'fnptr'; out.value = fname ? fname + '()' : addrLabel(v);
          return out;
        }
        if (v >= 1040000) { out.kind = 'file'; out.value = 'FILE'; out.note = 'an open file'; return out; }
        if (v >= 1 && v <= 3) { out.kind = 'file'; out.value = ['', 'stdin', 'stdout', 'stderr'][v]; return out; }
        if (v >= L.RODATA_BASE && v < snap.roTop) {
          out.note = '"' + R.cstr(v, 60).slice(0, 40) + '"';
          out.literal = true;
          return out;
        }
        const b = blockAt(v);
        if (b && b.freed) { out.dangling = 'freed'; out.note = 'points at freed memory'; }
        else if (!live(v)) { out.dangling = 'gone'; out.note = 'points at memory no variable owns'; }
        out.target = v;
        out.toSize = t.to.k === 'void' ? 0 : sizeOf(t.to);
        if (b && !b.freed) ptrSeen.push({ to: t.to, target: v, block: b });
        return out;
      }
      if (t.k === 'fn' || t.k === 'void') return Object.assign(base, { kind: 'scalar', value: '', unset: false });
      const unset = !R.isSet(addr, t.size);
      const v = R.num(addr, t);
      return Object.assign(base, { kind: isCharT(t) ? 'char' : 'scalar', unset: unset, raw: v, value: unset ? '?' : fmtNum(v, t) });
    }

    function arrayNode(base, name, t, addr, ctx) {
      const depth = ctx.depth || 0;
      const n = t.n || 0;
      const es = sizeOf(t.of);
      const max = opts.maxCells || 12;
      let show = [];
      let gapAfter = -1;
      const isStr = isCharT(t.of);
      if (isStr) {
        let len = -1;
        for (let i = 0; i < n; i++) { if (!R.isSet(addr + i, 1)) break; if (R.byte(addr + i) === 0) { len = i; break; } }
        const upto = len === -1 ? Math.min(n - 1, 3) : Math.min(len, 15);
        for (let i = 0; i <= upto && i < n; i++) show.push(i);
        if (n - 1 > upto + 1) { gapAfter = upto; show.push(n - 1); }
        else for (let i = upto + 1; i < n; i++) show.push(i);
      } else if (n <= max) {
        for (let i = 0; i < n; i++) show.push(i);
      } else {
        let last = -1;
        for (let i = n - 1; i >= 0; i--) if (R.anySet(addr + i * es, es)) { last = i; break; }
        const upto = Math.min(Math.max(4, last), max - 2, n - 2);
        for (let i = 0; i <= upto; i++) show.push(i);
        gapAfter = upto;
        show.push(n - 1);
      }
      const grid = t.of.k === 'arr' && t.of.of.k !== 'arr' && t.of.of.k !== 'struct';
      let dir = opts.arrays === 'across' || opts.arrays === 'down' ? opts.arrays : (ctx.inStruct || t.of.k === 'struct' ? 'down' : 'across');
      if (isStr && opts.arrays !== 'down') dir = 'across';   // a string reads left to right
      if (grid) dir = 'grid';
      const cells = show.map(i => {
        const a = addr + i * es;
        if (t.of.k === 'struct' || t.of.k === 'arr') {
          const child = node(name + '[' + i + ']', t.of, a, { depth: depth + 1, inStruct: false, compact: true, spell: null });
          return { index: i, addr: a, size: es, node: child, changed: child.changed || R.changed(a, es), unset: child.unset };
        }
        const child = node(name + '[' + i + ']', t.of, a, { depth: depth + 1 });
        return { index: i, addr: a, size: es, value: child.value, unset: child.unset, changed: child.changed, ptr: child.kind === 'ptr' || child.kind === 'fnptr' ? child : null };
      });
      let str = null;
      if (isStr && R.anySet(addr, 1)) {
        const bytes = [];
        for (let i = 0; i < n && R.isSet(addr + i, 1); i++) { const c = R.byte(addr + i); if (!c) break; bytes.push(c); }
        str = CVM.text.decodeUtf8(bytes);
      }
      const lastLabel = t.nName && !/^\d+$/.test(t.nName) ? t.nName + '-1' : String(n - 1);
      return Object.assign(base, {
        kind: 'array', n: n, cells: cells, gapAfter: gapAfter, dir: dir, lastLabel: lastLabel,
        elem: typeName(t.of), elemKind: t.of.k, isString: isStr, str: str,
        unset: !R.anySet(addr, base.size), compact: !!ctx.compact
      });
    }

    const vars = (list) => list.map(b => node(b.name, b.t, b.addr, { spell: b.spell, depth: 0 }));

    // Frames, top of the stack first.
    const frames = snap.frames.slice().reverse().map((f, i) => {
      const fn = f.fnNode;
      const params = (fn && fn.params || []).map(p => p.name).filter(Boolean);
      return {
        fn: f.fn,
        title: f.fn + '(' + params.join(', ') + ')',
        callLine: f.callLoc && f.fn !== 'main' ? f.callLoc.l : null,
        callFile: f.callLoc ? f.callLoc.f : null,
        top: i === 0,
        vars: vars(f.vars)
      };
    });
    const globals = vars(snap.globals || []);

    /* The heap: blocks get their types from what points at them, in rounds,
       because a node found through one pointer holds the pointer to the next. */
    const heap = [];
    const done = new Set();
    let guard = 0;
    while (guard++ < 40) {
      let progress = false;
      for (const p of ptrSeen.splice(0)) {
        const b = p.block;
        if (done.has(b.addr) || p.target !== b.addr) continue;
        const to = p.to;
        let t;
        if (to.k === 'void' || to.k === 'fn') t = arrOf(T.uchar, b.size);
        else if (to.k === 'struct') t = (b.size >= sizeOf(to) * 2 && b.size % sizeOf(to) === 0) ? arrOf(to, b.size / sizeOf(to)) : to;
        else { const n = Math.floor(b.size / Math.max(sizeOf(to), 1)); t = n > 1 ? arrOf(to, n) : to; }
        heapTypes.set(b.addr, t);
        done.add(b.addr);
        heap.push({ addr: b.addr, size: b.size, freed: b.freed, line: b.loc ? b.loc.l : null, node: node('', t, b.addr, { depth: 0, spell: null, heap: true }) });
        progress = true;
      }
      if (!progress) break;
    }
    // Pointers into the middle of a block, or untyped: whatever is left.
    for (const b of blocks) {
      if (done.has(b.addr) || b.freed) continue;
      const t = arrOf(T.uchar, b.size);
      heap.push({ addr: b.addr, size: b.size, freed: false, leaked: true, line: b.loc ? b.loc.l : null, node: node('', t, b.addr, { depth: 0 }) });
      done.add(b.addr);
    }
    // Leaked: no pointer anywhere reaches it.
    const reached = new Set();
    const walk = (n) => {
      if (!n) return;
      if (n.target) { const b = blockAt(n.target); if (b) reached.add(b.addr); }
      (n.children || []).forEach(walk);
      (n.cells || []).forEach(c => { if (c.node) walk(c.node); if (c.ptr) walk(c.ptr); });
    };
    frames.forEach(f => f.vars.forEach(walk));
    globals.forEach(walk);
    heap.forEach(h => walk(h.node));
    heap.forEach(h => { h.leaked = !reached.has(h.addr); });

    /* In the order they link: a chain starts at a block no other block points
       at (the head), then follows each block's pointers in member order. */
    const byAddr = new Map(heap.map(h => [h.addr, h]));
    const nexts = new Map();
    const pointedFromHeap = new Set();
    const ptrsOf = (n, acc) => {
      if (!n) return acc;
      if (n.target) { const b = blockAt(n.target); if (b && byAddr.has(b.addr)) acc.push(b.addr); }
      (n.children || []).forEach(c => ptrsOf(c, acc));
      (n.cells || []).forEach(c => { if (c.node) ptrsOf(c.node, acc); if (c.ptr) ptrsOf(c.ptr, acc); });
      return acc;
    };
    heap.forEach(h => {
      const out = ptrsOf(h.node, []).filter(a => a !== h.addr);
      nexts.set(h.addr, out);
      out.forEach(a => pointedFromHeap.add(a));
    });
    const ordered = [];
    const seen = new Set();
    const visit = (a) => {
      if (seen.has(a)) return;
      seen.add(a);
      ordered.push(byAddr.get(a));
      (nexts.get(a) || []).forEach(visit);
    };
    heap.filter(h => !pointedFromHeap.has(h.addr)).forEach(h => visit(h.addr));
    heap.forEach(h => visit(h.addr));   // whatever is left: cycles

    return { frames: frames, globals: globals, heap: ordered, kind: snap.kind, loc: snap.loc, pass: snap.pass || null };
  }

  CVM.targetAt = targetAt;
  CVM.describe = describe;
  CVM.charLabel = charLabel;

  if (typeof module !== 'undefined' && module.exports) module.exports = CVM;
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this));
