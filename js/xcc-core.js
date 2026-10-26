/* ============================================================
   XCC-CORE.JS — a real C compiler, running in the page
   ------------------------------------------------------------
   When Godbolt cannot be reached, Run Code and Check Code used to fall back to
   JSCPP, a C++ interpreter written in JavaScript. Measured against this app's
   own 158 starter programs, it could not run 65 of them: no structs, scanf
   into an array element died with "Memory overflow" (which the terminal then
   read as "waiting for input" and sat there), %lld printed literally, no
   FILE, fgets, malloc, NULL or function pointers, and multi-file programs
   crashed outright.

   This replaces it with xcc (github.com/tyfkda/xcc, MIT, see
   vendor/xcc/LICENSE): a C compiler that is itself a WebAssembly program. The
   compiler, its libc and its headers come as one 166 KB zip. Source goes in,
   a WebAssembly program comes out, and that program runs here with the
   learner's stdin. It is real C, so it behaves the way gcc does -- scanf at
   the end of input returns EOF, which is what the terminal's input probe
   (termInstrumentC) and its two-run check are built on.

   Both the compiler and the program it builds are WASI programs. Everything
   they ask the system for is answered below from an in-memory file system:
   no network, no host files. Only the handful of WASI calls they actually
   import are implemented; anything else answers "not supported".

   Plain script, no DOM: js/xcc-worker.js runs it in a Web Worker (so an
   infinite loop can be killed), and the same file runs under Node for the
   pack sweep, so what is tested is what ships.
   ============================================================ */
/* A named factory, for the same reason as xccStdioFactory: the runner's worker
   is built from this function's source text. */
function xccCoreFactory(root) {
  'use strict';

  const E = { SUCCESS: 0, BADF: 8, EXIST: 20, INVAL: 28, ISDIR: 31, NOENT: 44, NOSYS: 52, NOTDIR: 54, NOTEMPTY: 55 };
  const FT = { CHAR: 2, DIR: 3, FILE: 4 };
  const CC_PATH = '/usr/bin/cc';
  const HOME = '/home/wasm';
  /* xcc's default stack is 8 KB, and `int grid[50][50]` alone is 10 KB: every
     2-D array program in the pack trapped with "memory access out of bounds".
     4 MB is room for any of them and for deep recursion. */
  const STACK_SIZE = 4 * 1024 * 1024;
  // printf/scanf done right (xcc-stdio.js), compiled in front of every program.
  const Stdio = root.XccStdio || (typeof require === 'function' ? require('./xcc-stdio.js') : null);

  class WasiExit { constructor(code) { this.code = code; } }
  class WasiTimeout {}

  /* ── The zip ─────────────────────────────────────────────────
     Central directory, then each entry's local header. Deflated entries go
     through the browser's own inflater (DecompressionStream), which Node has
     as well -- no library. */
  async function unzip(bytes) {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('xcc: not a zip file');
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const out = {};
    const dec = new TextDecoder();
    for (let n = 0; n < count; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('xcc: bad zip directory');
      const method = dv.getUint16(p + 10, true);
      const csize = dv.getUint32(p + 20, true);
      const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
      const local = dv.getUint32(p + 42, true);
      const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
      p += 46 + nlen + xlen + clen;
      if (name.endsWith('/')) continue;
      const lstart = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
      const raw = u8.subarray(lstart, lstart + csize);
      if (method === 0) out[name] = raw.slice();
      else if (method === 8) {
        const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        out[name] = new Uint8Array(await new Response(stream).arrayBuffer());
      } else throw new Error('xcc: unsupported zip method ' + method);
    }
    return out;
  }

  /* ── An in-memory file system ──────────────────────────────── */
  function normPath(path) {
    const parts = [];
    for (const seg of String(path).split('/')) {
      if (!seg || seg === '.') continue;
      if (seg === '..') parts.pop(); else parts.push(seg);
    }
    return '/' + parts.join('/');
  }

  class MemFS {
    constructor() { this.files = new Map(); this.dirs = new Set(['/']); }
    mkdirp(path) {
      let cur = '';
      for (const seg of normPath(path).split('/').filter(Boolean)) { cur += '/' + seg; this.dirs.add(cur); }
    }
    write(path, data) {
      path = normPath(path);
      this.mkdirp(path.slice(0, path.lastIndexOf('/')) || '/');
      this.files.set(path, { data: data instanceof Uint8Array ? data : new TextEncoder().encode(String(data)), size: -1 });
      const f = this.files.get(path); f.size = f.data.length;
    }
    read(path) { const f = this.files.get(normPath(path)); return f ? f.data.subarray(0, f.size) : null; }
    remove(path) { return this.files.delete(normPath(path)); }
    /* Files that are written to grow in place: data is capacity, size is length. */
    ensure(f, need) {
      if (need <= f.data.length) return;
      const next = new Uint8Array(Math.max(need, f.data.length * 2, 256));
      next.set(f.data.subarray(0, f.size));
      f.data = next;
    }
  }

  /* ── WASI ─────────────────────────────────────────────────────
     fd 0-2 are the terminal, 3 is "/" and 4 is "." (the home directory) --
     the two preopens xcc's libc walks to resolve a path. */
  function makeWasi(fs, opts) {
    const args = opts.args || [];
    const startedAt = Date.now();
    /* Only when there is no worker to terminate (see xcc-runner.js): checked
       on every write and read, so a runaway that prints or reads is stopped.
       A loop that does neither cannot be interrupted on the page itself. */
    const deadline = opts.deadline || 0;
    const overdue = () => { if (deadline && Date.now() > deadline) throw new WasiTimeout(); };
    const stdin = opts.stdin || new Uint8Array(0);
    let stdinPos = 0;
    const fds = new Map([
      [0, { kind: 'stdin' }], [1, { kind: 'out', sink: opts.onStdout }], [2, { kind: 'out', sink: opts.onStderr }],
      [3, { kind: 'dir', path: '/', pre: '/' }], [4, { kind: 'dir', path: HOME, pre: '.' }]
    ]);
    let nextFd = 5;
    let memory = null;
    const enc = new TextEncoder();
    const mem = () => new DataView(memory.buffer);
    const u8 = () => new Uint8Array(memory.buffer);
    const str = (ptr, len) => new TextDecoder().decode(u8().subarray(ptr, ptr + len));
    const resolve = (dirfd, ptr, len) => {
      const d = fds.get(dirfd);
      if (!d || d.kind !== 'dir') return null;
      const rel = str(ptr, len);
      return normPath(rel.startsWith('/') ? rel : d.path + '/' + rel);
    };
    const iovs = (ptr, n) => {
      const v = mem(), list = [];
      for (let i = 0; i < n; i++) list.push([v.getUint32(ptr + i * 8, true), v.getUint32(ptr + i * 8 + 4, true)]);
      return list;
    };
    const filestat = (buf, type, size) => {
      const v = mem();
      for (let i = 0; i < 64; i += 8) v.setBigUint64(buf + i, 0n, true);
      v.setUint8(buf + 16, type);
      v.setBigUint64(buf + 24, 1n, true);
      v.setBigUint64(buf + 32, BigInt(size), true);
    };

    const impl = {
      args_sizes_get(argcPtr, bufSizePtr) {
        const v = mem();
        v.setUint32(argcPtr, args.length, true);
        v.setUint32(bufSizePtr, args.reduce((s, a) => s + enc.encode(a).length + 1, 0), true);
        return E.SUCCESS;
      },
      args_get(argvPtr, bufPtr) {
        const v = mem(), m = u8();
        args.forEach((a, i) => {
          const b = enc.encode(a);
          v.setUint32(argvPtr + i * 4, bufPtr, true);
          m.set(b, bufPtr); m[bufPtr + b.length] = 0;
          bufPtr += b.length + 1;
        });
        return E.SUCCESS;
      },
      environ_sizes_get(cPtr, sPtr) { const v = mem(); v.setUint32(cPtr, 0, true); v.setUint32(sPtr, 0, true); return E.SUCCESS; },
      environ_get() { return E.SUCCESS; },
      fd_prestat_get(fd, buf) {
        const d = fds.get(fd);
        if (!d || !d.pre) return E.BADF;
        const v = mem();
        v.setUint8(buf, 0);
        v.setUint32(buf + 4, enc.encode(d.pre).length, true);
        return E.SUCCESS;
      },
      fd_prestat_dir_name(fd, ptr, len) {
        const d = fds.get(fd);
        if (!d || !d.pre) return E.BADF;
        u8().set(enc.encode(d.pre).subarray(0, len), ptr);
        return E.SUCCESS;
      },
      fd_write(fd, iov, n, nwrittenPtr) {
        overdue();
        const d = fds.get(fd);
        if (!d) return E.BADF;
        let total = 0;
        for (const [p, l] of iovs(iov, n)) {
          const chunk = u8().slice(p, p + l);
          if (d.kind === 'out') { if (d.sink) d.sink(chunk); }
          else if (d.kind === 'file') {
            const f = d.file;
            if (d.append) d.pos = f.size;
            fs.ensure(f, d.pos + l);
            f.data.set(chunk, d.pos);
            d.pos += l;
            if (d.pos > f.size) f.size = d.pos;
          } else return E.BADF;
          total += l;
        }
        mem().setUint32(nwrittenPtr, total, true);
        return E.SUCCESS;
      },
      fd_read(fd, iov, n, nreadPtr) {
        overdue();
        const d = fds.get(fd);
        if (!d) return E.BADF;
        let total = 0;
        for (const [p, l] of iovs(iov, n)) {
          let src, pos;
          if (d.kind === 'stdin') { src = stdin; pos = stdinPos; }
          else if (d.kind === 'file') { src = d.file.data.subarray(0, d.file.size); pos = d.pos; }
          else return E.BADF;
          const take = Math.max(0, Math.min(l, src.length - pos));
          u8().set(src.subarray(pos, pos + take), p);
          if (d.kind === 'stdin') stdinPos += take; else d.pos += take;
          total += take;
          if (take < l) break;
        }
        mem().setUint32(nreadPtr, total, true);
        return E.SUCCESS;
      },
      fd_seek(fd, offset, whence, outPtr) {
        const d = fds.get(fd);
        if (!d || d.kind !== 'file') return d ? E.INVAL : E.BADF;
        const base = whence === 0 ? 0 : whence === 1 ? d.pos : d.file.size;
        const next = base + Number(offset);
        if (next < 0) return E.INVAL;
        d.pos = next;
        mem().setBigUint64(outPtr, BigInt(next), true);
        return E.SUCCESS;
      },
      fd_tell(fd, outPtr) {
        const d = fds.get(fd);
        if (!d || d.kind !== 'file') return E.BADF;
        mem().setBigUint64(outPtr, BigInt(d.pos), true);
        return E.SUCCESS;
      },
      fd_close(fd) { if (!fds.has(fd)) return E.BADF; if (fd > 4) fds.delete(fd); return E.SUCCESS; },
      fd_fdstat_get(fd, buf) {
        const d = fds.get(fd);
        if (!d) return E.BADF;
        const v = mem();
        v.setUint8(buf, d.kind === 'dir' ? FT.DIR : d.kind === 'file' ? FT.FILE : FT.CHAR);
        v.setUint16(buf + 2, 0, true);
        v.setBigUint64(buf + 8, 0xFFFFFFFFn, true);
        v.setBigUint64(buf + 16, 0xFFFFFFFFn, true);
        return E.SUCCESS;
      },
      fd_fdstat_set_flags() { return E.SUCCESS; },
      fd_filestat_get(fd, buf) {
        const d = fds.get(fd);
        if (!d) return E.BADF;
        if (d.kind === 'file') filestat(buf, FT.FILE, d.file.size);
        else filestat(buf, d.kind === 'dir' ? FT.DIR : FT.CHAR, 0);
        return E.SUCCESS;
      },
      path_filestat_get(dirfd, flags, ptr, len, buf) {
        const path = resolve(dirfd, ptr, len);
        if (path == null) return E.BADF;
        if (fs.files.has(path)) { filestat(buf, FT.FILE, fs.files.get(path).size); return E.SUCCESS; }
        if (fs.dirs.has(path)) { filestat(buf, FT.DIR, 0); return E.SUCCESS; }
        return E.NOENT;
      },
      path_open(dirfd, dirflags, ptr, len, oflags, rightsBase, rightsInh, fdflags, fdOut) {
        const path = resolve(dirfd, ptr, len);
        if (path == null) return E.BADF;
        const CREAT = 1, DIRECTORY = 2, EXCL = 4, TRUNC = 8, APPEND = 1;
        /* xcc's open() never passes O_APPEND on, so fopen(.., "a") arrived as a
           plain create and every write landed at the start of the file. "a" is
           the only fopen mode that creates without truncating ("w" truncates,
           "r+" does not create), so that combination is read as append. */
        const appendMode = !!(fdflags & APPEND) || ((oflags & CREAT) && !(oflags & (TRUNC | EXCL)));
        if (fs.dirs.has(path)) {
          if (oflags & (CREAT | TRUNC)) return E.ISDIR;
          const fd = nextFd++;
          fds.set(fd, { kind: 'dir', path });
          mem().setUint32(fdOut, fd, true);
          return E.SUCCESS;
        }
        if (oflags & DIRECTORY) return E.NOTDIR;
        let f = fs.files.get(path);
        if (f && (oflags & CREAT) && (oflags & EXCL)) return E.EXIST;
        if (!f) {
          if (!(oflags & CREAT)) return E.NOENT;
          const parent = path.slice(0, path.lastIndexOf('/')) || '/';
          if (!fs.dirs.has(parent)) return E.NOENT;
          fs.files.set(path, f = { data: new Uint8Array(0), size: 0 });
        } else if (oflags & TRUNC) f.size = 0;
        const fd = nextFd++;
        // The handle holds the file itself, not its name: the compiler creates a
        // temp file, unlinks the name at once and keeps writing through the fd,
        // the usual POSIX way to get a file that cleans itself up.
        fds.set(fd, { kind: 'file', path, file: f, pos: 0, append: appendMode });
        mem().setUint32(fdOut, fd, true);
        return E.SUCCESS;
      },
      path_unlink_file(dirfd, ptr, len) {
        const path = resolve(dirfd, ptr, len);
        if (path == null) return E.BADF;
        if (fs.dirs.has(path)) return E.ISDIR;
        return fs.files.delete(path) ? E.SUCCESS : E.NOENT;
      },
      path_create_directory(dirfd, ptr, len) {
        const path = resolve(dirfd, ptr, len);
        if (path == null) return E.BADF;
        if (fs.dirs.has(path) || fs.files.has(path)) return E.EXIST;
        fs.dirs.add(path);
        return E.SUCCESS;
      },
      path_remove_directory(dirfd, ptr, len) {
        const path = resolve(dirfd, ptr, len);
        if (path == null) return E.BADF;
        if (!fs.dirs.has(path)) return E.NOENT;
        for (const k of fs.files.keys()) if (k.startsWith(path + '/')) return E.NOTEMPTY;
        fs.dirs.delete(path);
        return E.SUCCESS;
      },
      path_rename(fd1, p1, l1, fd2, p2, l2) {
        const a = resolve(fd1, p1, l1), b = resolve(fd2, p2, l2);
        if (a == null || b == null) return E.BADF;
        const f = fs.files.get(a);
        if (!f) return E.NOENT;
        fs.files.delete(a); fs.files.set(b, f);
        return E.SUCCESS;
      },
      clock_time_get(id, precision, outPtr) {
        const ms = id === 0 ? Date.now() : (typeof performance !== 'undefined' ? performance.now() : Date.now());
        mem().setBigUint64(outPtr, BigInt(Math.round(ms * 1e6)), true);
        return E.SUCCESS;
      },
      clock_res_get(id, outPtr) { mem().setBigUint64(outPtr, 1000n, true); return E.SUCCESS; },
      random_get(ptr, len) {
        const buf = new Uint8Array(len);
        if (root.crypto && root.crypto.getRandomValues) {
          for (let i = 0; i < len; i += 65536) root.crypto.getRandomValues(buf.subarray(i, Math.min(len, i + 65536)));
        } else for (let i = 0; i < len; i++) buf[i] = (Math.random() * 256) | 0;
        u8().set(buf, ptr);
        return E.SUCCESS;
      },
      sched_yield() { return E.SUCCESS; },
      poll_oneoff() { return E.NOSYS; },
      proc_exit(code) { throw new WasiExit(code); }
    };

    /* What the prelude asks the host for: the digits of a double, and a
       correctly rounded parse. See xcc-stdio.js. */
    const ssp = {
      fmt_float(v, conv, prec, flags, width, out, cap) {
        const b = enc.encode(Stdio.fmtFloat(v, conv, prec, flags, width));
        u8().set(b.subarray(0, Math.min(b.length, cap)), out);
        return b.length;
      },
      parse_float(ptr, len) { return Stdio.parseFloatC(str(ptr, len)); },
      // clock(): microseconds of this run, which is what CLOCKS_PER_SEC counts.
      clock_us() { return (Date.now() - startedAt) * 1000; },
      tm_from(t, utc, out) {
        const f = Stdio.tmFields(new Date(t * 1000), !!utc);
        const v = mem();
        f.forEach((n, i) => v.setInt32(out + i * 4, n, true));
      },
      tm_to(ptr) {
        const v = mem();
        const g = i => v.getInt32(ptr + i * 4, true);
        const d = new Date(g(5) + 1900, g(4), g(3), g(2), g(1), g(0));
        // mktime normalises the fields it was given (Feb 30 -> Mar 2) and fills in the rest.
        Stdio.tmFields(d, false).forEach((n, i) => v.setInt32(ptr + i * 4, n, true));
        return Math.floor(d.getTime() / 1000);
      },
      // Not "strftime": an import named like the C function wrapping it links to that function.
      tm_strftime(buf, max, fmtPtr, tmPtr) {
        let end = fmtPtr;
        const m8 = u8();
        while (m8[end]) end++;
        const v = mem();
        const f = []; for (let i = 0; i < 9; i++) f.push(v.getInt32(tmPtr + i * 4, true));
        const b = enc.encode(Stdio.strftimeJS(str(fmtPtr, end - fmtPtr), f));
        if (b.length + 1 > max) return 0;
        u8().set(b, buf); u8()[buf + b.length] = 0;
        return b.length;
      }
    };

    return {
      setMemory(m) { memory = m; },
      importsFor(module) {
        const ns = {}, own = {};
        for (const imp of WebAssembly.Module.imports(module)) {
          if (imp.kind !== 'function') continue;
          if (imp.module === 'wasi_snapshot_preview1') ns[imp.name] = impl[imp.name] || (() => E.NOSYS);
          else if (imp.module === 'ssp') own[imp.name] = ssp[imp.name];
        }
        return { wasi_snapshot_preview1: ns, ssp: own };
      }
    };
  }

  /* In WebAssembly, address 0 is ordinary memory, so `int *p = NULL; *p = 5;`
     just works -- where gcc's program dies with a segmentation fault, which is
     the lesson. xcc leaves the first 4 KB untouched (measured: every program in
     the pack leaves it all zero), so a byte there that is no longer zero after
     the run was written through a NULL pointer, or a small offset from one
     (p->field). Reads through NULL cannot be caught this way; writes can. */
  const NULL_GUARD = 4096;

  /* A trap, in the words a learner can act on. */
  function crashText(msg) {
    const m = String(msg || '');
    if (/out of bounds/i.test(m)) return 'Segmentation fault: the program used memory it does not own -- an array index past the end, or a pointer that does not point anywhere.';
    if (/divide by zero/i.test(m)) return 'Division by zero.';
    if (/integer overflow/i.test(m)) return 'Integer overflow in a division (the smallest int divided by -1).';
    if (/unreachable/i.test(m)) return 'The program reached code that should be impossible -- often a function that should return a value and does not.';
    if (/indirect call|signature|table index|null function/i.test(m)) return 'Called a function through a bad function pointer.';
    if (/stack|recursion/i.test(m)) return 'Stack overflow: a function kept calling itself -- recursion with no case that stops it?';
    return m;
  }

  /** Run one WASI program to completion. @returns {{exitCode:number, crash:?string}} */
  function runWasi(fs, module, opts) {
    const wasi = makeWasi(fs, opts);
    const instance = new WebAssembly.Instance(module, wasi.importsFor(module));
    wasi.setMemory(instance.exports.memory);
    const low = () => new Uint8Array(instance.exports.memory.buffer, 0, NULL_GUARD);
    const guarded = opts.guardNull && low().every(b => b === 0);
    const nullWrite = () => {
      if (!guarded) return -1;
      return low().findIndex(b => b !== 0);
    };
    const finish = (r) => {
      const at = nullWrite();
      if (at >= 0 && !r.crash) {
        return { exitCode: 139, crash: 'Segmentation fault: the program wrote through a NULL pointer'
          + (at ? ' (at offset ' + at + ', so most likely p->something with p == NULL)' : '')
          + '. A pointer has to point at something before you write through it.' };
      }
      return r;
    };
    try {
      instance.exports._start();
      return finish({ exitCode: 0, crash: null });
    } catch (e) {
      if (e instanceof WasiExit) return finish({ exitCode: e.code, crash: null });
      if (e instanceof WasiTimeout) return { exitCode: 143, crash: null, timedOut: true };
      // A trap is the program's fault -- out-of-bounds memory, unreachable,
      // division by zero, a stack too deep -- the in-browser version of a crash.
      // Exit codes as a Linux shell reports a signal, which termExitNote names:
      // 136 is SIGFPE (integer division by zero), 139 SIGSEGV (the rest).
      if (e instanceof WebAssembly.RuntimeError) {
        return { exitCode: /divide by zero|integer overflow/i.test(e.message) ? 136 : 139, crash: crashText(e.message) };
      }
      if (e instanceof RangeError) return { exitCode: 139, crash: crashText('stack ' + e.message) };
      throw e;
    }
  }

  class XccCore {
    constructor(files) {
      this.fs = new MemFS();
      for (const [name, data] of Object.entries(files)) this.fs.write('/' + name, data);
      this.fs.mkdirp(HOME);
      this.fs.mkdirp('/tmp');
      const cc = this.fs.read(CC_PATH);
      if (!cc) throw new Error('xcc: compiler missing from the bundle');
      this.ccModule = new WebAssembly.Module(cc);
      this.cache = new Map();     // source -> {ok, stderr, module}
    }

    static async create(zipBytes) { return new XccCore(await unzip(zipBytes)); }

    /** Compile one translation unit. Cached by source, so the terminal's
        re-run-per-input pays for the compile once. */
    compile(source) {
      const hit = this.cache.get(source);
      if (hit) { this.cache.delete(source); this.cache.set(source, hit); return hit; }
      const fs = this.fs;
      // "#line 1" puts the learner's first line back at 1 for every diagnostic,
      // and keeps working when the input probe adds a #line of its own.
      const full = (Stdio ? Stdio.PRELUDE + Stdio.extrasFor(source) + '#line 1\n' : '') + source;
      fs.write(HOME + '/main.c', full);
      fs.remove(HOME + '/a.wasm');
      let errText = '';
      const dec = new TextDecoder();
      const sink = chunk => { errText += dec.decode(chunk, { stream: true }); };
      const r = runWasi(fs, this.ccModule, {
        args: [CC_PATH, '--stack-size=' + STACK_SIZE, '-o', 'a.wasm', 'main.c'],
        onStdout: sink, onStderr: sink
      });
      const out = fs.read(HOME + '/a.wasm');
      errText = this.repoint(errText, full);
      let result;
      if (r.exitCode === 0 && out && !r.crash) {
        result = { ok: true, stderr: errText, module: new WebAssembly.Module(out) };
      } else {
        result = { ok: false, stderr: errText || (r.crash ? 'compiler crashed: ' + r.crash : 'compilation failed'), module: null };
      }
      this.cache.set(source, result);
      if (this.cache.size > 12) this.cache.delete(this.cache.keys().next().value);
      return result;
    }

    /* xcc's diagnostics, written the way gcc writes them, so the two compilers
       read the same and the terminal can quote and link either:

         xcc:  main.c(4): `undefinedThing' undeclared      gcc-style:
                   int y = undefinedThing + 1;              main.c:5:13: error: 'undefinedThing' undeclared
                           ^~~~~~~~~~~~~~                       5 |     int y = undefinedThing + 1;
                                                                  |             ^~~~~~~~~~~~~~
       THE NUMBER IS NOT TRUSTED. Measured: after the first error in a file,
       xcc's line numbers run one short (undefinedThing on line 5 reported as
       4, x on 7 as 6). The line it quotes is always the right one, so the
       location is found by looking that text up in what was compiled --
       nearest to the reported number, honouring any #line directive (the
       input probe adds one) so the answer is in the learner's numbering. */
    repoint(text, source) {
      const src = String(source || '').split('\n');
      // Physical line -> the line number a diagnostic would give it.
      const logical = [];
      let n = 1;
      for (const line of src) {
        const d = /^\s*#\s*line\s+(\d+)/.exec(line);
        logical.push(d ? null : n);
        n = d ? parseInt(d[1], 10) : n + 1;
      }
      const bare = t => String(t).replace(/\s+$/, '');   // a carriage return, trailing spaces
      const locate = (quoted, reported) => {
        let best = null;
        const want = bare(quoted);
        for (let i = 0; i < src.length; i++) {
          if (logical[i] === null || bare(src[i]) !== want) continue;
          if (best === null || Math.abs(logical[i] - reported) < Math.abs(best - reported)) best = logical[i];
        }
        return best;
      };
      const words = msg => String(msg)
        .replace(/^`([^`']+)' expected$/, "expected '$1'")
        .replace(/`([^`']+)'/g, "'$1'");
      const lines = String(text || '').split('\n');
      const out = [];
      for (let i = 0; i < lines.length; i++) {
        const head = /^main\.c\((\d+)\): ?(.*)$/.exec(lines[i]);
        if (!head) { out.push(lines[i]); continue; }
        const reported = parseInt(head[1], 10);
        const quoted = lines[i + 1], caret = lines[i + 2];
        const hasExcerpt = quoted !== undefined && caret !== undefined && /^\s*\^~*\s*$/.test(caret);
        const at = hasExcerpt ? (locate(quoted, reported) || reported) : reported;
        const col = hasExcerpt ? caret.indexOf('^') + 1 : 0;
        out.push('main.c:' + at + (col ? ':' + col : '') + ': error: ' + words(head[2]));
        if (hasExcerpt) {
          out.push(String(at).padStart(5) + ' | ' + quoted);
          out.push('      | ' + caret);
          i += 2;
        }
      }
      return out.join('\n');
    }

    /** Run a compiled program on stdin. Output arrives through onStdout as it
        is written, so a caller that has to kill a runaway still has it. */
    run(module, stdinText, hooks) {
      const enc = new TextEncoder();
      const dec = new TextDecoder(), decErr = new TextDecoder();
      let stdout = '', stderr = '';
      // Files a previous run wrote stay out of this one.
      for (const k of [...this.fs.files.keys()]) {
        if (k.startsWith(HOME + '/') && k !== HOME + '/main.c' && k !== HOME + '/a.wasm') this.fs.remove(k);
      }
      const r = runWasi(this.fs, module, {
        args: ['main'],
        guardNull: true,
        deadline: hooks && hooks.deadline,
        stdin: enc.encode(stdinText || ''),
        onStdout: chunk => { const t = dec.decode(chunk, { stream: true }); stdout += t; if (hooks && hooks.onStdout) hooks.onStdout(t); },
        onStderr: chunk => { stderr += decErr.decode(chunk, { stream: true }); }
      });
      stdout += dec.decode(); stderr += decErr.decode();
      if (r.crash) stderr += (stderr && !stderr.endsWith('\n') ? '\n' : '') + r.crash;
      if (r.timedOut) stderr += (stderr && stderr.slice(-1) !== String.fromCharCode(10) ? String.fromCharCode(10) : '') + 'Stopped: the program was still running.';
      return { exitCode: r.exitCode, stdout, stderr };
    }

    /** Compile and run, in the same shape as a Godbolt answer. */
    compileRun(source, stdinText, hooks) {
      const t0 = Date.now();
      const cached = this.cache.has(source);
      const c = this.compile(source);
      const t1 = Date.now();
      if (!c.ok) return { didExecute: false, exitCode: -1, stdout: '', stderr: c.stderr, buildStderr: c.stderr, execTime: null, compileMs: t1 - t0 };
      const r = this.run(c.module, stdinText, hooks);
      const t2 = Date.now();
      return { didExecute: true, exitCode: r.exitCode, stdout: r.stdout, stderr: r.stderr, buildStderr: c.stderr,
               execTime: t2 - t0, compileMs: cached ? 0 : t1 - t0, runMs: t2 - t1 };
    }
  }

  root.XccCore = XccCore;
  if (typeof module !== 'undefined' && module.exports) module.exports = { XccCore, unzip };
}
xccCoreFactory(typeof self !== 'undefined' ? self : globalThis);
