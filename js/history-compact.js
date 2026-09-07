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

/* ── What it is costing, and how to get some back ──────────────
   Deletion existed, but only one program at a time: you opened that program's
   history, ticked boxes and deleted. Recovering room meant visiting up to 159
   programs by hand, which made the "trim your history" advice technically true
   and practically useless. This is the same operation across everything, and it
   goes through softDeleteHistory so it lands in the undo stack like every other
   delete rather than being a special irreversible button. */

/** Bytes the practice history occupies, as Firestore counts them. */
function historyBytes(list) {
  try {
    const json = JSON.stringify(list || state.history || []);
    return (typeof TextEncoder !== 'undefined')
      ? new TextEncoder().encode(json).length : json.length;
  } catch (e) { return 0; }
}

/* Practice history shares its document with the notebook, snippet and language
   histories, so its own budget is a share of the cap rather than all of it.
   The compaction windows are tuned to settle just under this. */
const HISTORY_BUDGET = 640000;

/** Entries older than `days`, oldest first. */
function historyOlderThan(days) {
  const cut = Date.now() - days * 86400000;
  return (state.history || []).filter(h => _histWhen(h) && _histWhen(h) < cut);
}

/** Everything except the highest-scoring attempt at each program. */
function historyNonBest() {
  const best = new Map();
  (state.history || []).forEach(h => {
    const cur = best.get(h.challengeId);
    if (!cur || (h.score || 0) > (cur.score || 0)) best.set(h.challengeId, h);
  });
  const keep = new Set(best.values());
  return (state.history || []).filter(h => !keep.has(h));
}

function _histPlural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

/**
 * Delete a set of entries by the rule that chose them.
 * @param {string} rule 'days:<n>' or 'nonbest'
 */
function historyTrim(rule) {
  const m = /^days:(\d+)$/.exec(rule || '');
  const doomed = m ? historyOlderThan(parseInt(m[1], 10)) : historyNonBest();
  if (!doomed.length) {
    if (typeof toast === 'function') toast('Nothing matches that — no attempts were deleted.', { type: 'info' });
    return;
  }
  const ids = doomed.map(h => h.id).filter(Boolean);
  if (!ids.length) return;
  const freed = Math.round(historyBytes(doomed) / 1024);
  const what = m
    ? _histPlural(ids.length, 'attempt') + ' older than ' + m[1] + ' days'
    : _histPlural(ids.length, 'attempt') + ' that are not your best at their program';
  const ask = typeof showConfirm === 'function' ? showConfirm : null;
  const run = () => {
    softDeleteHistory(ids, () => {
      if (typeof renderAnalyticsCharts === 'function') renderAnalyticsCharts();
      else if (typeof handleRoute === 'function') handleRoute();
      if (typeof toast === 'function') {
        toast('Deleted ' + _histPlural(ids.length, 'attempt') + ', freeing about ' + freed
              + 'KB. Undo is in the usual place.', { type: 'success', duration: 5000 });
      }
    });
  };
  if (ask) ask('Delete ' + _histPlural(ids.length, 'attempt'), 'This removes ' + what
      + ', freeing about ' + freed + 'KB. Scores go with them. You can undo it.', run);
  else run();
}

/** The Storage card on the analytics screen. */
function historyStoragePanelHTML() {
  const list = state.history || [];
  const used = historyBytes(list);
  const pct = Math.min(100, Math.round((used / HISTORY_BUDGET) * 100));
  const withCode = list.filter(historyHasCode).length;
  const tone = pct >= 90 ? 'is-hot' : pct >= 70 ? 'is-warm' : '';

  const opts = [
    { rule: 'days:365', label: 'Older than a year', n: historyOlderThan(365).length },
    { rule: 'days:180', label: 'Older than 6 months', n: historyOlderThan(180).length },
    { rule: 'days:90', label: 'Older than 90 days', n: historyOlderThan(90).length },
    { rule: 'nonbest', label: 'All but your best at each program', n: historyNonBest().length }
  ];

  return '<div class="hs-wrap">'
    + '<div class="hs-meter ' + tone + '"><span style="width:' + pct + '%"></span></div>'
    + '<p class="hs-line"><b>' + Math.round(used / 1024) + ' KB</b> of about '
      + Math.round(HISTORY_BUDGET / 1024) + ' KB &mdash; ' + pct + '% of what practice history '
      + 'can use before the sync refuses the write.</p>'
    + '<p class="hs-sub">' + _histPlural(list.length, 'attempt') + ' kept, ' + withCode
      + ' of them still carrying the code you wrote. Older attempts keep their scores for ever; '
      + 'only the source is let go, and the reference is read back from the program itself.</p>'
    + '<div class="hs-acts">'
    + opts.map(o => '<button class="hs-btn" ' + (o.n ? '' : 'disabled ')
        + 'onclick="historyTrim(\'' + o.rule + '\')">'
        + o.label + '<span class="hs-n">' + o.n + '</span></button>').join('')
    + '</div>'
    + '<p class="hs-note">Deleting here goes through the same undo as everywhere else.</p>'
    + '</div>';
}
