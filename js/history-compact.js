/* ============================================================
   HISTORY-COMPACT.JS — keeping the record without keeping it four times
   ------------------------------------------------------------
   Every graded attempt stored the whole program several times over. The
   reference solution went in three times (expectedCode, targetFiles[].code and
   userFiles[].code), the starter twice, and your own text twice. Measured over
   the 159-program pack: 534KB for a single attempt at each program, of which
   52.6% was the reference and 5.3% the starter -- neither of which is yours,
   and both of which are already in the challenge definition. Only 29.9% was
   code you actually wrote.

   That matters because history rides in a Firestore document capped at 1MB,
   shared with the notebook, snippet and language histories. Nothing capped it.
   One pass over the pack was 52.1% of the cap, and retries are normal here --
   there is a badge for five attempts on one program.

   THREE RULES, IN ORDER OF HOW MUCH THEY COST YOU.

   1. DE-DUPLICATE. Strictly lossless: a copy is only dropped when an identical
      copy is still in the same entry. Nothing is inferred and nothing is read
      from anywhere else, so this cannot lose anything under any circumstance.
      It is applied to every entry, for ever.

   2. DROP THE REFERENCE from entries past the recent window. The reference is
      the pack's, not yours, and it is in the challenge -- so this is
      recoverable rather than lost. Your own code stays.

   3. DROP THE CODE from entries past the long window, keeping every metric.
      Scores, dates, durations, attempt numbers, test counts and the classified
      mistakes are what the analytics and concept-mastery screens read, and
      those are kept for ever regardless. Only the source is let go.

   The screens that show code all already guard for its absence -- they filter
   on `userFiles.length` before offering a diff or a restore -- so an entry that
   has been through rule 3 quietly stops offering code instead of showing an
   empty comparison.
   ============================================================ */

/* The three windows, chosen by measuring the steady state rather than by
   picking round numbers. History shares its 1MB document with the notebook,
   snippet and language histories, so the target was for practice history alone
   to settle near half the cap however long you study.

   A metrics-only entry is about 295 bytes and that is the floor -- at 2000 the
   floor alone was 83% of the cap, which is why the ceiling is not higher. */

/** Entries that keep their code AND the reference to diff it against. */
const HISTORY_CODE_KEEP = 40;

/** Entries that keep your own code, without the reference. */
const HISTORY_OWN_KEEP = 150;

/** Hard ceiling. Past this the oldest entries go, metrics and all. */
const HISTORY_MAX = 1500;

/** Newest first, whichever field the entry has. */
function _histWhen(e) {
  const n = Number(e && (e.submitTime || e.startTime));
  return isFinite(n) ? n : 0;
}

/** The target file matching a user file, by name+ext, else by position. */
function _histMate(list, f, i) {
  if (!Array.isArray(list)) return null;
  return list.find(t => t.name === f.name && t.ext === f.ext) || list[i] || null;
}

/**
 * Rule 1 — lossless de-duplication of one entry.
 *
 * Only ever deletes a value that is byte-identical to one still present in the
 * SAME entry, so every reader can reconstruct what it had. Returns the entry.
 */
function historyDedupeEntry(e) {
  if (!e || typeof e !== 'object') return e;
  const targets = Array.isArray(e.targetFiles) ? e.targetFiles : null;

  if (targets && targets.length && Array.isArray(e.userFiles)) {
    e.userFiles.forEach((f, i) => {
      const t = _histMate(targets, f, i);
      if (!t) return;
      // The reference and the starter live on the target copy; this one is a
      // duplicate of it, and rehydrate puts it back for anything that needs it.
      if (f.code !== undefined && f.code === t.code) delete f.code;
      if (f.starterCode !== undefined && f.starterCode === t.starterCode) delete f.starterCode;
    });
  }
  // expectedCode repeats the first target's reference.
  if (targets && targets.length && e.expectedCode !== undefined
      && e.expectedCode === targets[0].code) {
    delete e.expectedCode;
  }
  /* userCode is DELIBERATELY KEPT even though it repeats the first file's text.
     Deleting it was tried and is a trap: several readers take the
     `entry.userCode` branch when an entry has no targetFiles, and rule 2 removes
     targetFiles later -- so an entry would end up with neither, and those screens
     would show an empty attempt while the text sat in userFiles all along. It is
     one file's worth of duplication against a whole class of silent breakage. */
  return e;
}

/** Rule 2 — the reference belongs to the challenge, not to the attempt. */
function historyDropReference(e) {
  if (!e || typeof e !== 'object') return e;
  if (e.targetFiles === undefined && e.expectedCode === undefined) return e;
  delete e.targetFiles;
  delete e.expectedCode;
  e.refDropped = true;
  return e;
}

/** Rule 3 — metrics stay, source goes. */
function historyDropCode(e) {
  if (!e || typeof e !== 'object') return e;
  if (!e.userFiles && e.userCode === undefined && !e.targetFiles) return e;
  delete e.userFiles;
  delete e.targetFiles;
  delete e.userCode;
  delete e.expectedCode;
  delete e.refDropped;
  e.codeDropped = true;
  return e;
}

/**
 * Put back what de-duplication took out.
 *
 * Anything that wants WHOLE files -- the editor restore in particular, which
 * needs each file's reference or the boss bar has nothing to measure against --
 * asks for them here rather than reading userFiles directly. Falls back to the
 * challenge definition when the entry's own reference has been dropped, which
 * is exactly why dropping it is recoverable.
 */
function historyRehydrateFiles(entry, challenge) {
  if (!entry || !Array.isArray(entry.userFiles)) return null;
  const ch = challenge
    || (Array.isArray(state.challenges)
        ? state.challenges.find(c => c.id === entry.challengeId) : null);
  const fromCh = ch && ch.variants && ch.variants[0] && Array.isArray(ch.variants[0].files)
    ? ch.variants[0].files : null;
  const targets = Array.isArray(entry.targetFiles) ? entry.targetFiles : fromCh;

  return entry.userFiles.map((f, i) => {
    const t = _histMate(targets, f, i);
    return {
      ...f,
      code: f.code !== undefined ? f.code : (t ? (t.code || '') : ''),
      starterCode: f.starterCode !== undefined ? f.starterCode : (t ? (t.starterCode || '') : '')
    };
  });
}

/**
 * The (file, yours, reference) triples for an attempt.
 *
 * The diff and review screens used to read entry.targetFiles directly and fall
 * back to entry.expectedCode -- which rule 2 removes, so a diff of an older
 * attempt would have shown your code against an empty column. The reference is
 * recoverable precisely because it belongs to the challenge, so this looks
 * there when the entry no longer carries its own copy, and both screens get a
 * real comparison for as long as your code is kept.
 */
function historyFilePairs(entry) {
  if (!entry) return [];
  const files = historyRehydrateFiles(entry);
  if (files && files.length) {
    return files.map(f => ({
      name: (f.name || 'main') + (f.ext || '.c'),
      rawName: f.name, ext: f.ext,
      user: f.userCode || '',
      target: f.code || ''
    }));
  }
  const ch = Array.isArray(state.challenges)
    ? state.challenges.find(c => c.id === entry.challengeId) : null;
  const v = ch && ch.variants && ch.variants[0];
  return [{
    name: 'main.c', rawName: 'main', ext: '.c',
    user: historyUserCode(entry),
    target: entry.expectedCode || (v ? (v.code || (v.files && v.files[0] && v.files[0].code) || '') : '')
  }];
}

/** The text of an attempt, wherever it ended up living. */
function historyUserCode(entry) {
  if (!entry) return '';
  if (entry.userCode !== undefined) return entry.userCode;
  if (Array.isArray(entry.userFiles) && entry.userFiles.length) {
    return entry.userFiles[0].userCode || '';
  }
  return '';
}

/** Does this entry still carry code you could open? */
function historyHasCode(entry) {
  return !!(entry && !entry.codeDropped
    && ((Array.isArray(entry.userFiles) && entry.userFiles.length)
        || (entry.userCode !== undefined && entry.userCode !== '')));
}

/**
 * Apply the whole policy to a history array, in place.
 *
 * Ordered by time rather than by array position, because entries are unshifted
 * onto the front and an import or a merge can arrive out of order -- ranking by
 * position would then strip the wrong ones.
 *
 * @returns {{deduped:number, refDropped:number, codeDropped:number, removed:number}}
 */
function historyCompact(list) {
  const out = { deduped: 0, refDropped: 0, codeDropped: 0, removed: 0 };
  if (!Array.isArray(list) || !list.length) return out;

  const ranked = list.slice().sort((a, b) => _histWhen(b) - _histWhen(a));
  const rank = new Map();
  ranked.forEach((e, i) => rank.set(e, i));

  list.forEach(e => {
    historyDedupeEntry(e);
    out.deduped++;
    const r = rank.get(e);
    if (r >= HISTORY_OWN_KEEP) { if (!e.codeDropped) { historyDropCode(e); out.codeDropped++; } }
    else if (r >= HISTORY_CODE_KEEP) { if (!e.refDropped) { historyDropReference(e); out.refDropped++; } }
  });

  if (list.length > HISTORY_MAX) {
    const keep = new Set(ranked.slice(0, HISTORY_MAX));
    for (let i = list.length - 1; i >= 0; i--) {
      if (!keep.has(list[i])) { list.splice(i, 1); out.removed++; }
    }
  }
  return out;
}
