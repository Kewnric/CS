/* ============================================================
   XCC-RUNNER.JS — the offline compiler, from the page's side
   ------------------------------------------------------------
   xccCompileRun(source, stdin, aborter) answers in exactly the shape a
   Godbolt run does ({didExecute, exitCode, stdout, stderr, buildStderr,
   execTime}), so Run Code and Check Code use it in Godbolt's place without
   knowing the difference. See js/xcc-core.js for what it is and why.

   IT MUST WORK FROM file://. This app is opened straight from disk, and a
   page loaded that way may run <script> tags but may not fetch() a file or
   start a Worker from a script file -- the first version did both, so from
   disk it never started and the old interpreter answered instead ("does not
   support struct"). So:
     - everything is loaded by <script> tags, on first use: js/xcc-stdio.js,
       js/xcc-core.js and the compiler itself as base64 (vendor/xcc/wccfiles.js);
     - the worker is built from those files' own source text (their factories'
       toString()) as a blob: URL, which a page from disk is allowed to start;
     - if a browser refuses even that, the compiler runs on the page, with a
       time limit checked on every write and read.

   In the worker, jobs run one at a time; each gets XCC_RUN_LIMIT_MS from the
   moment it starts, and a job still running at its limit takes the worker
   down with it and answers like a sandbox that killed a runaway: exit 143
   with the output it had produced, which termExitNote already explains.

   Rejects with XCC_UNAVAILABLE when the compiler cannot start at all -- the
   callers then fall back to the old interpreter -- and with STOPPED when the
   user pressed Stop.
   ============================================================ */
const XCC_SCRIPTS = ['js/xcc-stdio.js', 'js/xcc-core.js', 'vendor/xcc/wccfiles.js'];
const XCC_RUN_LIMIT_MS = 8000;

let _xccPrep = null;          // Promise<ArrayBuffer>: scripts loaded, bundle decoded
let _xccBundle = null;
let _xccMode = 'worker';      // 'worker', or 'page' when no worker can be started
let _xccWorker = null;
let _xccPageCoreP = null;    // Promise<XccCore> for running on the page
let _xccSeq = 0;
const _xccJobs = new Map();   // id -> job

function _xccScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('XCC_UNAVAILABLE: could not load ' + src));
    document.head.appendChild(s);
  });
}

/** Load the compiler once: its three scripts, then the bundle out of base64. */
function _xccPrepare() {
  if (!_xccPrep) {
    _xccPrep = (async () => {
      for (const src of XCC_SCRIPTS) await _xccScript(src);
      const bin = atob(self.XCC_BUNDLE_B64 || '');
      if (!bin.length) throw new Error('XCC_UNAVAILABLE: the compiler bundle is empty');
      const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      _xccBundle = u8.buffer;
      return _xccBundle;
    })();
    // A failed load (offline with nothing cached) may succeed later.
    _xccPrep.catch(() => { _xccPrep = null; });
  }
  return _xccPrep;
}

/* What runs inside the worker. A function only so its source can be put in
   the blob next to the two factories; it is never called on the page. */
function xccWorkerMain() {
  let ready = null;
  self.onmessage = async (e) => {
    const m = e.data || {};
    if (m.type === 'init') {
      if (!ready) { ready = self.XccCore.create(m.bundle); ready.catch(() => {}); }
      return;
    }
    if (m.type !== 'run') return;
    let core;
    try {
      core = await ready;
    } catch (err) {
      self.postMessage({ type: 'done', id: m.id, error: 'XCC_UNAVAILABLE: ' + (err && err.message || err) });
      return;
    }
    self.postMessage({ type: 'start', id: m.id });
    let pending = '', last = Date.now();
    const flush = () => { if (pending) { self.postMessage({ type: 'out', id: m.id, text: pending }); pending = ''; } last = Date.now(); };
    try {
      const result = core.compileRun(m.source, m.stdin, {
        onStdout: (t) => { pending += t; if (pending.length > 4096 || Date.now() - last > 100) flush(); }
      });
      self.postMessage({ type: 'done', id: m.id, result });
    } catch (err) {
      self.postMessage({ type: 'done', id: m.id, error: String(err && err.message || err) });
    }
  };
}

function _xccWorkerSource() {
  return xccStdioFactory.toString() + '\n' + xccCoreFactory.toString() + '\n'
    + 'xccStdioFactory(self);\nxccCoreFactory(self);\n(' + xccWorkerMain.toString() + ')();\n';
}

function _xccPost(job) {
  _xccWorker.postMessage({ type: 'run', id: job.id, source: job.source, stdin: job.stdin });
}

function _xccFinish(job) {
  clearTimeout(job.timer);
  _xccJobs.delete(job.id);
  job.detach();
}

/* No worker after all: everything queued runs on the page instead. */
function _xccFallToPage() {
  if (_xccWorker) { try { _xccWorker.terminate(); } catch (err) { /* gone */ } }
  _xccWorker = null;
  _xccMode = 'page';
  for (const job of _xccJobs.values()) { job.started = false; _xccRunOnPage(job); }
}

function _xccSpawn() {
  let w;
  try {
    const url = URL.createObjectURL(new Blob([_xccWorkerSource()], { type: 'text/javascript' }));
    w = new Worker(url);
  } catch (err) {
    return null;   // refused outright: the caller runs on the page
  }
  w.onmessage = (e) => {
    const m = e.data || {};
    const job = _xccJobs.get(m.id);
    if (!job) return;
    if (m.type === 'start') {
      job.started = true;
      job.timer = setTimeout(() => _xccKill(job, 'limit'), XCC_RUN_LIMIT_MS);
    } else if (m.type === 'out') {
      job.out += m.text;
    } else if (m.type === 'done') {
      _xccFinish(job);
      if (m.error) job.reject(new Error(m.error));
      else job.resolve(m.result);
    }
  };
  // Refused after the fact (some browsers only object once it loads).
  w.onerror = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (_xccWorker === w) _xccFallToPage();
  };
  w.postMessage({ type: 'init', bundle: _xccBundle.slice(0) });
  return w;
}

/* End the job that is running (over its limit, or stopped by the user) by
   ending the worker under it, then give everything still waiting to a new one. */
function _xccKill(job, why) {
  if (!_xccJobs.has(job.id)) return;
  _xccFinish(job);
  const running = job.started && _xccMode === 'worker';
  if (running && _xccWorker) {
    try { _xccWorker.terminate(); } catch (err) { /* already gone */ }
    _xccWorker = null;
  }
  if (why === 'limit') {
    job.resolve({
      didExecute: true, exitCode: 143, stdout: job.out, buildStderr: '', execTime: XCC_RUN_LIMIT_MS,
      stderr: 'Stopped after ' + (XCC_RUN_LIMIT_MS / 1000) + ' s: the program was still running.'
    });
  } else {
    job.reject(new Error('STOPPED'));
  }
  if (running && _xccJobs.size) {
    _xccWorker = _xccSpawn();
    if (!_xccWorker) { _xccFallToPage(); return; }
    for (const other of _xccJobs.values()) { other.started = false; _xccPost(other); }
  }
}

/* On the page: one job per task turn, in order. It cannot be interrupted, so
   the limit is enforced from inside the program's own writes and reads. */
function _xccRunOnPage(job) {
  if (!_xccPageCoreP) _xccPageCoreP = self.XccCore.create(_xccBundle);
  _xccPageCoreP
    .then(core => new Promise(r => setTimeout(() => r(core), 0)))
    .then(core => {
      if (!_xccJobs.has(job.id)) return;
      try {
        const result = core.compileRun(job.source, job.stdin, { deadline: Date.now() + XCC_RUN_LIMIT_MS });
        _xccFinish(job);
        job.resolve(result);
      } catch (err) {
        _xccFinish(job);
        job.reject(err);
      }
    }, err => {
      if (!_xccJobs.has(job.id)) return;
      _xccFinish(job);
      job.reject(new Error('XCC_UNAVAILABLE: ' + (err && err.message || err)));
    });
}

/**
 * Compile and run one translation unit in the browser.
 * @param {string} source  the merged program (preprocessMultiFile's output)
 * @param {string} stdin
 * @param {AbortController} [aborter]  Stop ends the run
 * @returns {Promise<{didExecute:boolean, exitCode:number, stdout:string, stderr:string, buildStderr:string, execTime:?number}>}
 */
async function xccCompileRun(source, stdin, aborter) {
  await _xccPrepare();
  return new Promise((resolve, reject) => {
    const signal = aborter ? aborter.signal : null;
    if (signal && signal.aborted) { reject(new Error('STOPPED')); return; }
    const job = {
      id: ++_xccSeq, source: String(source || ''), stdin: String(stdin || ''),
      out: '', started: false, timer: null, resolve, reject, detach: () => {}
    };
    if (signal) {
      const onAbort = () => _xccKill(job, 'stop');
      signal.addEventListener('abort', onAbort, { once: true });
      job.detach = () => signal.removeEventListener('abort', onAbort);
    }
    _xccJobs.set(job.id, job);
    if (_xccMode === 'worker' && !_xccWorker) {
      _xccWorker = _xccSpawn();
      if (!_xccWorker) _xccMode = 'page';
    }
    if (_xccMode === 'worker') _xccPost(job);
    else _xccRunOnPage(job);
  });
}

/** Is this error "the compiler could not start", as opposed to Stop? */
function xccUnavailable(err) {
  return !!(err && /^XCC_UNAVAILABLE/.test(err.message || ''));
}
