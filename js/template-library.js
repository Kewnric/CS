/* ============================================================
   TEMPLATE-LIBRARY.JS — your templates: stored, scheduled, recorded
   ------------------------------------------------------------
   The rules of a template are js/templates.js; this is where they live in
   the app: state.templates (the list), state.templateHistory (every check
   in the drill) and state.review (when each comes back, through review.js
   as type 'template').

   BUILT-INS ARE COPIED IN ONCE (tplEnsureStarters), marked `builtin`, so
   they can be edited like your own. Deleting one records its id, so it does
   not come back on the next visit; Reset in the admin restores the shipped
   version of one.

   HISTORY IS KEPT SMALL. A record holds your answer only on the newest 100
   checks (the ones the review window can still show), and at most 1,000
   records are kept: the answer is the only large field, and the target is
   in the template already.
   ============================================================ */

const TPL_HISTORY_MAX = 1000;
const TPL_HISTORY_ANSWERS = 100;

function tplStore() {
  if (!Array.isArray(state.templates)) state.templates = [];
  return state.templates;
}

function tplHistory() {
  if (!Array.isArray(state.templateHistory)) state.templateHistory = [];
  return state.templateHistory;
}

function tplFind(id) { return id ? (tplStore().find(t => t.id === id) || null) : null; }

/** The pass mark for a stage, from Settings (default 95). */
function tplPassMark() {
  const p = state.trainPrefs && Number(state.trainPrefs.templatePass);
  return p >= 50 && p <= 100 ? p : TPL_PASS_DEFAULT;
}

/** Copy in any built-in template not yet here (and not deleted on purpose). */
function tplEnsureStarters() {
  if (typeof TPL_STARTER === 'undefined') return 0;
  if (typeof trainStoreWritable === 'function' && !trainStoreWritable()) return 0;
  const list = tplStore();
  const gone = new Set(((state.trainPrefs || {}).tplDeleted) || []);
  const have = new Set(list.map(t => t.id));
  let added = 0;
  TPL_STARTER.forEach(raw => {
    if (have.has(raw.id) || gone.has(raw.id)) return;
    const now = Date.now();
    list.push(Object.assign(tplNormal(raw), { builtin: true, createdAt: now, updatedAt: now }));
    added++;
  });
  if (added && typeof saveData === 'function') saveData();
  return added;
}

/** Save a template (new or edited). Returns the stored record. */
function tplSave(t) {
  const list = tplStore();
  const rec = tplNormal(t);
  if (!rec.id) rec.id = generateId();
  rec.updatedAt = Date.now();
  const at = list.findIndex(x => x.id === rec.id);
  if (at === -1) { rec.createdAt = rec.updatedAt; list.push(rec); }
  else {
    // An edit that changes the code a lot sends the next review back a stage.
    const before = list[at];
    if (before.body !== rec.body) {
      const same = tplScore(tplCanonical(before), tplCanonical(rec));
      if (same < 70) rec.relearn = true;
    }
    rec.createdAt = before.createdAt || rec.updatedAt;
    list[at] = rec;
  }
  if (typeof saveData === 'function') saveData();
  return rec;
}

/** Delete a template, its schedule and its folder place, with an Undo for all of it. */
function tplDelete(id) {
  const list = tplStore();
  const at = list.findIndex(t => t.id === id);
  if (at === -1) return false;
  const [gone] = list.splice(at, 1);
  const key = 'template:' + id;
  const review = state.review && state.review[key];
  if (review) delete state.review[key];
  if (gone.builtin) {
    if (!state.trainPrefs) state.trainPrefs = {};
    state.trainPrefs.tplDeleted = (state.trainPrefs.tplDeleted || []).concat(id);
  }
  if (typeof saveData === 'function') saveData();
  if (typeof pushUndo === 'function') {
    pushUndo('Delete template "' + gone.title + '"', () => {
      tplStore().splice(Math.min(at, tplStore().length), 0, gone);
      if (review) state.review[key] = review;
      if (gone.builtin && state.trainPrefs) state.trainPrefs.tplDeleted = (state.trainPrefs.tplDeleted || []).filter(x => x !== id);
      if (typeof saveData === 'function') saveData();
      if (typeof tplOnStoreChanged === 'function') tplOnStoreChanged();
    });
  }
  return true;
}

/** Put a built-in template back as shipped. */
function tplResetBuiltin(id) {
  const raw = (typeof TPL_STARTER !== 'undefined' ? TPL_STARTER : []).find(t => t.id === id);
  if (!raw) return null;
  const cur = tplFind(id);
  return tplSave(Object.assign(tplNormal(raw), { builtin: true, parentId: cur ? cur.parentId : null }));
}

/**
 * Record one check from the drill.
 * @param {{templateId: string, stage: number, score: number, passed: boolean, seconds: number,
 *          peeks: number, self?: boolean, seed?: number, answer?: string, harness?: string}} e
 */
function tplRecord(e) {
  const h = tplHistory();
  h.push(Object.assign({ id: generateId(), at: Date.now() }, e));
  if (h.length > TPL_HISTORY_MAX) h.splice(0, h.length - TPL_HISTORY_MAX);
  for (let i = 0; i < h.length - TPL_HISTORY_ANSWERS; i++) if (h[i].answer) delete h[i].answer;
  if (typeof saveData === 'function') saveData();
}

/**
 * Where you are with a template.
 * @returns {{stage: number, attempts: number, best: number, last: ?object,
 *            due: ?string, dueNow: boolean, reviewed: boolean}}
 *   stage = the highest stage passed (0 = none yet)
 */
function tplStatus(id) {
  const recs = tplHistory().filter(r => r.templateId === id);
  let stage = 0, best = 0;
  recs.forEach(r => {
    if (r.passed && r.stage > stage) stage = r.stage;
    if (r.score > best) best = r.score;
  });
  const rev = state.review && state.review['template:' + id];
  const today = typeof _revToday === 'function' ? _revToday() : '';
  const dueNow = !!(rev && rev.due && today && rev.due <= today);
  return { stage, attempts: recs.length, best, last: recs[recs.length - 1] || null,
    due: rev ? rev.due : null, dueNow, reviewed: !!rev };
}

/** The stage a drill should open at: a review at Recall, a new one at Copy. */
function tplStartStage(id, opts) {
  const t = tplFind(id);
  const s = tplStatus(id);
  if (opts && opts.stage) return Math.min(5, Math.max(1, opts.stage | 0));
  if (t && t.relearn && s.stage >= 3) return 3;
  if (opts && opts.review) return 4;
  if (s.stage >= 4) return 4;
  return Math.min(4, s.stage + 1);
}

/** Templates due for review today, most overdue first. */
function tplDueList() {
  if (typeof getDueReviewItems !== 'function') return [];
  return getDueReviewItems().filter(r => r.type === 'template');
}

/**
 * Open the drill on a template.
 * @param {string} id
 * @param {{review?: boolean, stage?: number, seed?: number, back?: string}} [opts]
 */
function tplStartDrill(id, opts) {
  const t = tplFind(id);
  if (!t) { if (typeof toast === 'function') toast('That template is no longer here.', { type: 'warning' }); return; }
  const o = opts || {};
  const here = (document.body && document.body.dataset.route) || '';
  setSessionParam('tplDrill', {
    id, stage: tplStartStage(id, o), review: !!o.review,
    seed: o.seed || ((Date.now() % 1000000) + 1), back: o.back || (here && here !== 'template-attempt' ? here : 'training')
  });
  spaNavigate('template-attempt');
}

/**
 * Make a template from code: opens the admin form on a new one with the code
 * as its body. Slots are marked there (Mark as slot), never guessed silently.
 */
function tplMakeFrom(opts) {
  const o = opts || {};
  setSessionParam('adminPrefill', { kind: 'template', title: o.title || '', body: o.body || '',
    sourceType: o.sourceType || null, sourceId: o.sourceId || null });
  spaNavigate('admin-templates');
}
