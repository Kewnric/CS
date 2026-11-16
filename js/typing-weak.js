/* ============================================================
   TYPING-WEAK.JS — which keys and key runs slow you down
   ------------------------------------------------------------
   A typing result keeps its speed, not its keystrokes, so the detail is
   collected when a test finishes (twkRecord, called from typing-attempt.js)
   into state.typeStats:
     keys  { char: { n, ms, bad } }    every character typed: how often,
                                       the time it took, how often wrong
     seqs  { "->": { n, ms } }         two- and three-character runs: C is
                                       slow in its symbols, not its letters
     tot   { keys, bad, backs, ms }    for the time lost to corrections
   Counts halve every 30 days, so the picture follows how you type now.

   "Drill these" writes a typing entry, "Weak spots (generated)", made of
   real lines from your programs and templates that contain your slowest
   runs, and starts a test on it.
   ============================================================ */

const TWK_SEQ_MAX = 400;
const TWK_MIN_SAMPLES = 20;
const TWK_HALF_LIFE_DAYS = 30;
const TWK_DRILL_ID = 'twk-drill';

function twkStore() {
  const s = state.typeStats && typeof state.typeStats === 'object' ? state.typeStats : (state.typeStats = {});
  if (!s.keys || typeof s.keys !== 'object') s.keys = {};
  if (!s.seqs || typeof s.seqs !== 'object') s.seqs = {};
  if (!s.tot || typeof s.tot !== 'object') s.tot = { keys: 0, bad: 0, backs: 0, ms: 0 };
  if (!s.decayedAt) s.decayedAt = Date.now();
  return s;
}

function _twkDecay(s) {
  const days = (Date.now() - (s.decayedAt || Date.now())) / 86400000;
  if (days < TWK_HALF_LIFE_DAYS) return;
  const half = (o) => Object.keys(o).forEach(k => {
    const v = o[k];
    v.n = Math.floor(v.n / 2); v.ms = v.ms / 2;
    if (v.bad) v.bad = Math.floor(v.bad / 2);
    if (v.typed) v.typed = Math.floor(v.typed / 2);
    if (!v.n && !v.typed) delete o[k];
  });
  half(s.keys); half(s.seqs);
  ['keys', 'bad', 'backs', 'ms'].forEach(k => { s.tot[k] = Math.floor((s.tot[k] || 0) / 2); });
  s.decayedAt = Date.now();
}

/**
 * Add one finished test. Only characters typed in a row count toward a
 * timing (the gap after a pause or a fix is not the key's fault).
 * @param {object} eng the typing engine (typing-engine.js)
 */
function twkRecord(eng) {
  if (!eng || !eng.target || !eng.at || !eng.st) return;
  if (typeof trainStoreWritable === 'function' && !trainStoreWritable()) return;
  const s = twkStore();
  _twkDecay(s);
  const T = eng.target;
  let prev = -1;
  for (let i = 0; i < T.length; i++) {
    const st = eng.st[i];
    if (st !== MT_OK && st !== MT_BAD) { prev = -1; continue; }
    const c = T[i];
    if (c === '\n' || c === ' ' && i > 0 && T[i - 1] === ' ') { prev = i; continue; }   // indentation is not a key run
    // n and ms: timed keystrokes (typed straight after the one before);
    // typed and bad: every one, for the error rate.
    const k = s.keys[c] || (s.keys[c] = { n: 0, ms: 0, typed: 0, bad: 0 });
    k.typed = (k.typed || 0) + 1;
    if (st === MT_BAD) k.bad++;
    if (prev === i - 1 && prev >= 0) {
      const dt = eng.at[i] - eng.at[prev];
      if (dt > 0 && dt < 2000) {
        k.n++;
        k.ms += dt;
        const two = T.slice(i - 1, i + 1);
        if (two.trim().length === 2) { const q = s.seqs[two] || (s.seqs[two] = { n: 0, ms: 0 }); q.n++; q.ms += dt; }
        if (i >= 2 && eng.st[i - 2] === MT_OK) {
          const three = T.slice(i - 2, i + 1);
          const dt2 = eng.at[i] - eng.at[i - 2];
          if (three.trim().length === 3 && dt2 > 0 && dt2 < 3000 && /[^A-Za-z0-9]/.test(three)) {
            const q = s.seqs[three] || (s.seqs[three] = { n: 0, ms: 0 }); q.n++; q.ms += dt2 / 2;
          }
        }
      }
    }
    prev = i;
  }
  const backs = (eng.log || []).filter(e => e[1] === 'Backspace' || e[1] === 'CtrlBackspace').length;
  s.tot.keys += (eng.keysOk || 0) + (eng.keysBad || 0);
  s.tot.bad += eng.keysBad || 0;
  s.tot.backs += backs;
  s.tot.ms += eng.log && eng.log.length ? eng.log[eng.log.length - 1][0] : 0;
  // Keep the most-used runs only.
  const seqKeys = Object.keys(s.seqs);
  if (seqKeys.length > TWK_SEQ_MAX) {
    seqKeys.sort((a, b) => s.seqs[a].n - s.seqs[b].n).slice(0, seqKeys.length - TWK_SEQ_MAX).forEach(k => delete s.seqs[k]);
  }
  if (typeof saveData === 'function') saveData();
}

/**
 * What the numbers say.
 * @returns {{enough: boolean, avg: number, slowKeys: Array, slowSeqs: Array, errKeys: Array, lostSec: number, rawWpm: number, wpm: number, keys: object}}
 */
function twkReport() {
  const s = twkStore();
  const keys = Object.keys(s.keys).map(c => {
    const v = s.keys[c];
    const typed = v.typed || v.n;
    return { c, n: v.n, typed, avg: v.n ? v.ms / v.n : 0, err: typed ? (v.bad || 0) / typed : 0 };
  }).filter(k => k.typed >= 1);
  const timed = keys.filter(k => k.n >= TWK_MIN_SAMPLES && k.avg > 0);
  const avg = timed.length ? timed.reduce((t, k) => t + k.avg * k.n, 0) / timed.reduce((t, k) => t + k.n, 0) : 0;
  const seqs = Object.keys(s.seqs).map(q => ({ q, n: s.seqs[q].n, avg: s.seqs[q].ms / s.seqs[q].n }))
    .filter(x => x.n >= TWK_MIN_SAMPLES);
  const hist = (state.typeHistory || []).slice(-10);
  const per = s.tot.keys ? s.tot.ms / s.tot.keys : 0;
  return {
    enough: timed.length >= 5,
    avg,
    slowKeys: timed.slice().sort((a, b) => b.avg - a.avg).slice(0, 10),
    slowSeqs: seqs.sort((a, b) => b.avg - a.avg).slice(0, 10),
    errKeys: keys.filter(k => k.typed >= TWK_MIN_SAMPLES && k.err > 0).sort((a, b) => b.err - a.err).slice(0, 8),
    lostSec: Math.round(((s.tot.bad || 0) + (s.tot.backs || 0)) * per / 1000),
    rawWpm: hist.length ? hist.reduce((t, r) => t + (r.raw || 0), 0) / hist.length : 0,
    wpm: hist.length ? hist.reduce((t, r) => t + (r.wpm || 0), 0) / hist.length : 0,
    keys: s.keys
  };
}

/** Lines of real C that hold the given runs, most runs first. */
function twkDrillLines(seqs, max) {
  const want = (seqs || []).map(x => x.q || x).filter(Boolean);
  const lines = new Map();
  const add = (code) => String(code || '').split('\n').forEach(l => {
    const t = l.trim();
    if (t.length < 8 || t.length > 70 || /^(\/\/|\/\*|\*|#)/.test(t)) return;
    const hits = want.filter(q => t.indexOf(q) !== -1).length;
    if (hits) lines.set(t, Math.max(lines.get(t) || 0, hits));
  });
  (state.challenges || []).forEach(c => ((c.variants || [])[0] ? ((c.variants[0].files || []).map(f => f.code).concat([c.variants[0].code])) : []).forEach(add));
  (state.templates || []).forEach(t => { if (typeof tplCanonical === 'function') add(tplCanonical(t)); });
  return Array.from(lines.entries()).sort((a, b) => b[1] - a[1]).slice(0, max || 12).map(e => e[0]);
}

/** Write the weak-spots entry and start a typing test on it. */
function twkStartDrill() {
  const r = twkReport();
  const lines = twkDrillLines(r.slowSeqs.length ? r.slowSeqs : r.slowKeys.map(k => ({ q: k.c })), 12);
  if (!lines.length) {
    if (typeof toast === 'function') toast('Not enough typing yet to know your weak spots. A few code tests first.', { type: 'info', duration: 2800 });
    return;
  }
  const items = typeof mtItems === 'function' ? mtItems() : (state.typeItems || []);
  let it = items.find(x => x.id === TWK_DRILL_ID);
  if (!it) {
    it = typeof mtBlankItem === 'function' ? mtBlankItem('code') : { kind: 'code', lang: 'c', tags: [], notes: '' };
    it.id = TWK_DRILL_ID;
    items.push(it);
  }
  it.title = 'Weak spots (generated)';
  it.kind = 'code';
  it.lang = 'c';
  it.content = lines.join('\n');
  it.tags = ['generated'];
  it.notes = 'Lines from your own programs and templates that hold the key runs you type slowest. Rewritten each time you press Drill these.';
  it.updatedAt = Date.now();
  if (typeof saveData === 'function') saveData();
  if (typeof mtlRun === 'function') mtlRun(TWK_DRILL_ID);
}

/* ── The panel in the Typing Library's results ─────────────── */

const TWK_ROWS = ['1234567890-=', 'qwertyuiop[]', "asdfghjkl;'", 'zxcvbnm,./', '!@#%&*()_+{}', '<>|"?:^~\\'];

function twkPanelHTML() {
  const r = twkReport();
  const s = twkStore();
  if (!r.enough) {
    return `<div class="twk-panel"><div class="twk-head"><h3><i data-lucide="keyboard"></i> Weak spots</h3></div>
      <p class="twk-empty">After a few more code tests this shows the keys and key runs that slow you down, and builds a drill from them.</p></div>`;
  }
  const cell = (c) => {
    const k = s.keys[c] || s.keys[c.toUpperCase()];
    if (!k || k.n < 3) return `<span class="twk-key is-none" title="${escapeHTML(c)}: not enough yet">${escapeHTML(c)}</span>`;
    const avg = k.ms / Math.max(k.n, 1);
    const slow = r.avg ? Math.max(0, Math.min(1, (avg / r.avg - 1) / 1.5)) : 0;
    const err = (k.bad || 0) / Math.max(k.typed || k.n, 1);
    return `<span class="twk-key" style="--twk-slow:${slow.toFixed(2)};--twk-err:${Math.min(1, err * 5).toFixed(2)}"
      title="${escapeHTML(c)}: ${Math.round(avg)} ms, ${Math.round(err * 100)}% wrong, typed ${k.n} times">${escapeHTML(c)}</span>`;
  };
  const vis = (q) => escapeHTML(q).replace(/ /g, '␣');
  return `
    <div class="twk-panel">
      <div class="twk-head">
        <h3><i data-lucide="keyboard"></i> Weak spots</h3>
        <button class="btn btn-primary btn-sm" type="button" onclick="twkStartDrill()"><i data-lucide="target" style="width:14px;height:14px;"></i> Drill these</button>
      </div>
      <div class="twk-board" aria-label="Your keyboard: warmer is slower, red edge is more errors">${TWK_ROWS.map(row => `<div class="twk-row">${row.split('').map(cell).join('')}</div>`).join('')}</div>
      <div class="twk-cols">
        <div><div class="twk-title">Slowest runs</div>${r.slowSeqs.length ? r.slowSeqs.map(x => `<div class="twk-line"><code>${vis(x.q)}</code><span>${Math.round(x.avg)} ms${r.avg ? ' · ' + (x.avg / r.avg).toFixed(1) + '×' : ''}</span></div>`).join('') : '<p class="twk-empty">Not enough yet.</p>'}</div>
        <div><div class="twk-title">Most often wrong</div>${r.errKeys.length ? r.errKeys.map(k => `<div class="twk-line"><code>${vis(k.c)}</code><span>${Math.round(k.err * 100)}%</span></div>`).join('') : '<p class="twk-empty">Nothing stands out.</p>'}</div>
        <div><div class="twk-title">Last 10 tests</div>
          <div class="twk-line"><span>Raw speed</span><strong>${Math.round(r.rawWpm)}</strong></div>
          <div class="twk-line"><span>Real speed</span><strong>${Math.round(r.wpm)}</strong></div>
          <div class="twk-line"><span>Lost to fixing</span><strong>~${r.lostSec}s</strong></div>
        </div>
      </div>
    </div>`;
}
