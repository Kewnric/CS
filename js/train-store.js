/* ============================================================
   TRAIN-STORE.JS — the save fields of the Coding Library's new sections
   ------------------------------------------------------------
   Freeground, templates, the Training hub, the Codex and typing weak spots
   all keep their data in `state`, next to the library, so it is saved,
   exported, imported, reset and synced with everything else.

   ONE LIST, FOUR PLACES. The save is a fixed list of fields written out in
   state.js (local save), io.js (export / import / reset) and firebase-auth.js
   (cloud load and save). A field missed in any one of them is lost there and
   nowhere else, which is the kind of loss nobody notices until it matters. So
   every new field is named once, below, and those files go through the
   functions here instead of naming the fields themselves.

   THE STALE-FILE HAZARD. The first load after a release can run new files
   beside the service worker's cached copy of an older state.js. That older
   file writes the old fixed list and would drop every field here on its next
   save. Each of the three files sets a flag (STATE_HAS_TRAINING,
   IO_HAS_TRAINING, FB_HAS_TRAINING); trainStoreWritable() is true only when
   all three are present, and a screen that writes these fields stays
   read-only for that page load when it is false.

   Cloud: two documents of their own, `training` and `freeground`, never the
   app or history documents, which are already the fullest.
   ============================================================ */

const TRAIN_FIELDS = {
  templates:       { domain: 'training',   empty: () => [] },
  templateHistory: { domain: 'training',   empty: () => [] },
  trainLog:        { domain: 'training',   empty: () => [] },
  trainPrefs:      { domain: 'training',   empty: () => ({}) },
  typeStats:       { domain: 'training',   empty: () => ({ keys: {}, seqs: {}, decayedAt: 0 }) },
  drillLog:        { domain: 'training',   empty: () => ({ sureWrong: [] }) },
  codex:           { domain: 'training',   empty: () => ({ notes: {}, edits: {}, custom: [], seen: {} }) },
  freeground:      { domain: 'freeground', empty: () => ({ tabs: [], activeId: null }) }
};

/** The cloud documents these fields live in. */
const TRAIN_DOMAINS = ['training', 'freeground'];

/* A value of the right broad shape: an array where the empty value is one, a
   plain object where it is one. Anything else is replaced by the empty value,
   so a damaged or hand-edited backup cannot put a string where a list goes. */
function _trainShapeOk(value, empty) {
  if (Array.isArray(empty)) return Array.isArray(value);
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** The value as it should be stored: the empty value's keys filled in. */
function _trainNormal(name, value) {
  const empty = TRAIN_FIELDS[name].empty();
  if (!_trainShapeOk(value, empty)) return empty;
  if (Array.isArray(empty)) return value;
  const out = Object.assign({}, value);
  Object.keys(empty).forEach((k) => {
    const e = empty[k];
    if (out[k] === undefined) out[k] = e;
    else if (e !== null && typeof e === 'object' && !_trainShapeOk(out[k], e)) out[k] = e;
  });
  return out;
}

/**
 * Put the fields from a parsed save into `state`.
 * @param {object} src  a parsed save, backup or cloud document (may be null)
 * @param {{domain?: string, keepMissing?: boolean}} [opts]
 *   domain       only the fields of this cloud document
 *   keepMissing  a field the source lacks keeps its current value (an import
 *                of a backup made before the field existed); otherwise it is
 *                reset to empty (a load, which must not inherit another
 *                account's data still held in memory)
 */
function trainFieldsRead(src, opts) {
  const o = opts || {};
  const from = src && typeof src === 'object' ? src : {};
  Object.keys(TRAIN_FIELDS).forEach((name) => {
    if (o.domain && TRAIN_FIELDS[name].domain !== o.domain) return;
    if (from[name] === undefined && o.keepMissing) {
      state[name] = _trainNormal(name, state[name]);
      return;
    }
    state[name] = _trainNormal(name, from[name]);
  });
}

/**
 * The fields as they go into a save.
 * @param {string} [domain] only the fields of this cloud document
 * @returns {object}
 */
function trainFieldsWrite(domain) {
  const out = {};
  Object.keys(TRAIN_FIELDS).forEach((name) => {
    if (domain && TRAIN_FIELDS[name].domain !== domain) return;
    out[name] = _trainNormal(name, state[name]);
  });
  return out;
}

/** Every field back to empty (Reset Data, first run). */
function trainFieldsReset() {
  Object.keys(TRAIN_FIELDS).forEach((name) => { state[name] = TRAIN_FIELDS[name].empty(); });
}

/**
 * True when every file that saves these fields knows them. False on the first
 * load after a release when an older state.js, io.js or firebase-auth.js is
 * still being served from the cache.
 */
function trainStoreWritable() {
  return typeof STATE_HAS_TRAINING !== 'undefined'
    && typeof IO_HAS_TRAINING !== 'undefined'
    && typeof FB_HAS_TRAINING !== 'undefined';
}

/** The size hint shown when one of these cloud documents is too large. */
function trainDomainHint(name) {
  if (name === 'freeground') return 'Freeground holds too much code. Delete shelved tabs you no longer need.';
  if (name === 'training') return 'Training data is too large. Delete old templates or clear training history.';
  return '';
}
