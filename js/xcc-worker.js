/* ============================================================
   XCC-WORKER.JS — where the offline compiler actually runs
   ------------------------------------------------------------
   A compiled program runs synchronously, so a `while (1)` on the page itself
   would freeze the tab for good. Here it can only freeze this worker, and the
   page (js/xcc-runner.js) terminates the worker once a job outlives its limit.

   Messages in:  {type:'init', zipUrl}  then  {type:'run', id, source, stdin}
   Messages out: {type:'start', id}      the job has begun (the page starts its clock)
                 {type:'out', id, text}  stdout so far, so a killed job keeps it
                 {type:'done', id, result | error}
   ============================================================ */
importScripts('xcc-stdio.js', 'xcc-core.js');

let ready = null;

self.onmessage = async (e) => {
  const m = e.data || {};
  if (m.type === 'init') {
    if (!ready) {
      ready = fetch(m.zipUrl)
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
        .then(buf => XccCore.create(buf));
      ready.catch(() => {});
    }
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
