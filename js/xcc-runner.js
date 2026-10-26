/* ============================================================
   XCC-RUNNER.JS — the offline compiler, from the page's side
   ------------------------------------------------------------
   xccCompileRun(source, stdin, aborter) answers in exactly the shape a
   Godbolt run does ({didExecute, exitCode, stdout, stderr, buildStderr,
   execTime}), so Run Code and Check Code use it in Godbolt's place without
   knowing the difference. See js/xcc-core.js for what it is and why.

   The work happens in js/xcc-worker.js. Jobs queue there and run one at a
   time; each gets XCC_RUN_LIMIT_MS from the moment it starts, and a job still
   running at its limit takes the worker down with it. It then answers like a
   sandbox that killed a runaway: exit 143 with the output it had produced,
   which termExitNote already explains. Jobs still waiting are handed to a
   fresh worker.

   Rejects with XCC_UNAVAILABLE when the compiler cannot start at all (a page
   opened from file://, a bundle that failed to download) -- callers then fall
   back to the old interpreter -- and with STOPPED when the user pressed Stop.
   ============================================================ */
const XCC_WORKER_URL = 'js/xcc-worker.js';
const XCC_ZIP_URL = 'vendor/xcc/wccfiles.zip';
const XCC_RUN_LIMIT_MS = 8000;

let _xccWorker = null;
let _xccSeq = 0;
const _xccJobs = new Map();   // id -> job

function _xccPost(job) {
  _xccWorker.postMessage({ type: 'run', id: job.id, source: job.source, stdin: job.stdin });
}

function _xccSpawn() {
  const w = new Worker(XCC_WORKER_URL);
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
      clearTimeout(job.timer);
      _xccJobs.delete(m.id);
      job.detach();
      if (m.error) job.reject(new Error(m.error));
      else job.resolve(m.result);
    }
  };
  // The worker script itself would not load (file://, offline with nothing
  // cached): nothing queued can ever run, so say so to every job.
  w.onerror = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (_xccWorker !== w) return;
    _xccWorker = null;
    try { w.terminate(); } catch (err) { /* already gone */ }
    for (const job of [..._xccJobs.values()]) {
      clearTimeout(job.timer);
      _xccJobs.delete(job.id);
      job.detach();
      job.reject(new Error('XCC_UNAVAILABLE: ' + ((e && e.message) || 'the compiler worker did not start')));
    }
  };
  w.postMessage({ type: 'init', zipUrl: new URL(XCC_ZIP_URL, location.href).href });
  return w;
}

/* End the job that is running (over its limit, or stopped by the user) by
   ending the worker under it, then give everything still waiting to a new one. */
function _xccKill(job, why) {
  if (!_xccJobs.has(job.id)) return;
  clearTimeout(job.timer);
  _xccJobs.delete(job.id);
  job.detach();
  const running = job.started;
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
    for (const other of _xccJobs.values()) { other.started = false; _xccPost(other); }
  }
}

/**
 * Compile and run one translation unit in the browser.
 * @param {string} source  the merged program (preprocessMultiFile's output)
 * @param {string} stdin
 * @param {AbortController} [aborter]  Stop ends the run
 * @returns {Promise<{didExecute:boolean, exitCode:number, stdout:string, stderr:string, buildStderr:string, execTime:?number}>}
 */
function xccCompileRun(source, stdin, aborter) {
  return new Promise((resolve, reject) => {
    if (typeof Worker === 'undefined' || location.protocol === 'file:') {
      reject(new Error('XCC_UNAVAILABLE: needs the page served over http(s)'));
      return;
    }
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
    if (!_xccWorker) _xccWorker = _xccSpawn();
    _xccPost(job);
  });
}

/** Is this error "the compiler could not start", as opposed to Stop? */
function xccUnavailable(err) {
  return !!(err && /^XCC_UNAVAILABLE/.test(err.message || ''));
}
