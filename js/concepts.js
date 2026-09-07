/* ============================================================
   CONCEPTS.JS — how strong you are at each idea, not each program
   ------------------------------------------------------------
   Spaced repetition already schedules PROGRAMS: pass one and it comes back in
   six days. That is the right mechanism pointed at the wrong noun. You do not
   forget "Count up to n", you forget how a while loop's third part works, and
   the program is only the place that showed you.

   The concept graph was already in the data and unused. Every program names
   the constructs it needs in `minRequirements`, and MIN_REQ_DEFS gives each of
   them a label — fifteen ideas, authored, with a test attached. This turns the
   attempt history and the mistake log into a strength per idea, so "what
   should I do next" has an answer that is not just "whatever is due".

   THREE INPUTS, and the third is what makes it more than an average:
     scores    every attempt at a program that needs this concept
     recency   weighted on a three-week half-life, because what you could do in
               March is weaker evidence than what you did on Tuesday
     mistakes  the classified errors from mistakes.js that BELONG to this
               concept — a segfault is evidence about pointers in a way that a
               mark out of 100 is not
   ============================================================ */

/* Which classified mistakes are evidence about which construct. Only the ones
   that genuinely point at one idea are mapped: a missing semicolon says
   nothing about loops, so `syntax`, `variables` and `includes` stay out of
   this and are left to the mistakes panel, which reports them on their own. */
const CONCEPT_MISTAKES = {
  scanf: ['scanf-no-ampersand'],
  printf: ['format-percent', 'format-mismatch'],
  pointer: ['segfault', 'int-conversion'],
  array: ['array-bounds'],
  loop: ['timeout'],
  for: ['timeout'],
  while: ['timeout', 'assign-in-condition'],
  dowhile: ['timeout', 'assign-in-condition'],
  nestedloop: ['timeout'],
  function: ['missing-return'],
  recursion: ['missing-return'],
  /* Conditionals had no mistake wired to them at all, so their strength came
     from attempt scores alone and nothing could ever pull one down -- while
     assign-in-condition, the "= where == was meant" rule, mapped to no concept
     in this table and therefore counted towards nothing. The rule and the
     concepts both already existed; only the link was missing.

     while and dowhile take it too: `while (x = 1)` is the same fault, and it
     is the shape the drill generator already looks for (if|while).

     switch is deliberately left out. No rule in the taxonomy describes a
     switch-specific fault, and inventing a link to one that does not fit
     would make the row move for reasons the reader cannot act on. */
  if: ['assign-in-condition'],
  ifelse: ['assign-in-condition']
};

/** Half-life of evidence, in days. */
const CONCEPT_HALF_LIFE = 21;

/** How much the mistake log can pull a strength down, at most. */
const CONCEPT_MISTAKE_MAX = 20;

/**
 * The constructs a variant needs, as plain strings.
 * The pack AUTHORS these as ['printf','scanf'] and stores them expanded into
 * {id,type} records, so both shapes have to be read.
 */
function _conceptReqs(variant) {
  const raw = (variant && variant.minRequirements) || [];
  return raw.map(r => (typeof r === 'string' ? r : (r && (r.type || r.name || r.id)) || ''))
    .filter(Boolean);
}

/** Every concept a challenge exercises, across all its variants. */
function conceptsOf(challenge) {
  const out = [];
  ((challenge && challenge.variants) || []).forEach(v => {
    _conceptReqs(v).forEach(t => { if (out.indexOf(t) === -1) out.push(t); });
  });
  return out;
}

/** concept → the challenges that need it. @returns {Object<string,Array>} */
function conceptPrograms() {
  const map = Object.create(null);
  (state.challenges || []).forEach(ch => {
    conceptsOf(ch).forEach(t => (map[t] || (map[t] = [])).push(ch));
  });
  return map;
}

/** Evidence decays: 1.0 today, 0.5 after CONCEPT_HALF_LIFE days. */
function _conceptWeight(ts) {
  /* A timestamp that is not a number is not evidence, and must not be poison.
     One mistake-log entry with no `at` -- an import, an edited store, a record
     from a build that did not stamp them -- made the sum NaN, and NaN fails
     every >= in _conceptBand, so find() matched nothing and the fallback
     returned the LAST band: measured, a concept sitting at a clean 100 was
     reported Weak, with a NaN percentage on the row.

     Unknown age reads as infinitely old, so it weighs nothing and changes no
     total. Note the deliberate difference from a zero timestamp, which stays
     as it was: 0.5^(days since the epoch / 21) is subnormal rather than zero,
     so a history entry with no time still carries its score in the ratio
     instead of dropping the concept to untried. */
  const n = Number(ts);
  const days = isFinite(n) ? Math.max(0, (Date.now() - n) / 86400000) : Infinity;
  return Math.pow(0.5, days / CONCEPT_HALF_LIFE);
}

const CONCEPT_BANDS = [
  { at: 85, band: 'strong', label: 'Strong' },
  { at: 70, band: 'solid', label: 'Solid' },
  { at: 50, band: 'shaky', label: 'Shaky' },
  { at: 0, band: 'weak', label: 'Weak' }
];

function _conceptBand(strength) {
  return CONCEPT_BANDS.find(b => strength >= b.at) || CONCEPT_BANDS[CONCEPT_BANDS.length - 1];
}

/**
 * Strength per concept.
 *
 * @returns {Array<{concept,label,strength,band,bandLabel,attempts,programs,
 *                  solved,unsolved,lastAt,penalty,mistakes,weakest}>}
 *          Untried concepts come back with strength null and band 'untried' —
 *          worth showing, because a gap you have never touched is not the same
 *          as one you are bad at, and the two need different next steps.
 */
function conceptMastery() {
  const byConcept = conceptPrograms();
  const history = state.history || [];
  const mistakes = Array.isArray(state.mistakes) ? state.mistakes : [];

  // challengeId → its attempts, so the history is walked once rather than once
  // per concept. With 15 concepts over a full history that mattered.
  const byChallenge = Object.create(null);
  history.forEach(h => {
    if (!h || !h.challengeId) return;
    (byChallenge[h.challengeId] || (byChallenge[h.challengeId] = [])).push(h);
  });

  return Object.keys(byConcept).map(concept => {
    const progs = byConcept[concept];
    let wSum = 0, wScore = 0, attempts = 0, lastAt = 0;
    const perProgram = [];

    progs.forEach(ch => {
      const runs = byChallenge[ch.id] || [];
      if (!runs.length) { perProgram.push({ id: ch.id, title: ch.title, score: null, runs: 0 }); return; }
      /* Credit split across everything the program exercises: one that needs a
         single idea is strong evidence about it, one that needs four is a
         quarter of the evidence about each.

         This does NOT rescue a concept that is in almost everything. printf is
         in 108 of the pack's 149 programs, so its strength largely tracks your
         overall average — measured, three bad POINTER attempts pulled printf to
         71 and this weighting left it at 71, because every one of those six
         programs happens to carry exactly three requirements and a constant
         share cancels out of a weighted mean. What separates the two there is
         the mistake penalty below, which is concept-specific by construction:
         the same run left pointer at 31 and printf untouched.

         It is kept because it is right whenever the breadth actually varies,
         and because the row shows how many programs a concept spans, so a
         reader can see for themselves which ones are broad. */
      const share = 1 / Math.max(1, conceptsOf(ch).length);
      let best = 0;
      runs.forEach(h => {
        const ts = h.submitTime || h.startTime || 0;
        const w = _conceptWeight(ts) * share;
        wSum += w;
        wScore += w * (typeof h.score === 'number' ? h.score : 0);
        attempts++;
        if (ts > lastAt) lastAt = ts;
        if ((h.score || 0) > best) best = h.score || 0;
      });
      perProgram.push({ id: ch.id, title: ch.title, score: best, runs: runs.length });
    });

    /* Mistakes that belong to this concept, weighted the same way. Each is one
       attempt it cost, so the scale is "attempts spoiled by this idea". */
    const codes = CONCEPT_MISTAKES[concept] || [];
    let mWeight = 0;
    const mCounts = Object.create(null);
    if (codes.length) {
      mistakes.forEach(m => {
        if (codes.indexOf(m.code) === -1) return;
        mWeight += _conceptWeight(m.at);
        mCounts[m.code] = (mCounts[m.code] || 0) + 1;
      });
    }
    const penalty = Math.min(CONCEPT_MISTAKE_MAX, Math.round(mWeight * 5));

    const base = wSum > 0 ? wScore / wSum : null;
    const strength = base === null ? null : Math.max(0, Math.min(100, Math.round(base - penalty)));
    const band = strength === null
      ? { band: 'untried', label: 'Untried' }
      : _conceptBand(strength);

    const solved = perProgram.filter(p => p.score === 100).length;
    return {
      concept: concept,
      label: (typeof minReqLabel === 'function') ? minReqLabel(concept) : concept,
      strength: strength,
      band: band.band,
      bandLabel: band.label,
      attempts: attempts,
      programs: progs.length,
      solved: solved,
      unsolved: progs.length - solved,
      lastAt: lastAt,
      penalty: penalty,
      mistakes: Object.keys(mCounts).map(code => ({
        code: code,
        label: (typeof MISTAKE_BY_CODE !== 'undefined' && MISTAKE_BY_CODE[code])
          ? MISTAKE_BY_CODE[code].label : code,
        attempts: mCounts[code]
      })).sort((a, b) => b.attempts - a.attempts),
      // Lowest first, unattempted last: something you have never opened is not
      // the same kind of "weak" as something you scored 40 on.
      weakest: perProgram
        .filter(p => p.score !== 100)
        .sort((a, b) => (a.score === null) - (b.score === null) || (a.score || 0) - (b.score || 0))
        .slice(0, 4)
    };
  }).sort((a, b) => {
    // Tried and weak first; untried after them; strong last.
    const rank = (c) => c.strength === null ? 1000 : c.strength;
    return rank(a) - rank(b);
  });
}

/** The n weakest concepts that have enough evidence to be believed. */
function conceptWeakest(n, minAttempts) {
  const need = minAttempts == null ? 2 : minAttempts;
  return conceptMastery()
    // Below 'solid'. Drilling something you are already reliable at is time
    // taken from the thing you are not.
    .filter(c => c.strength !== null && c.attempts >= need && c.strength < 70)
    .slice(0, n || 3);
}

/* ── Drilling one ──────────────────────────────────────────────
   A generated practice set rather than a filtered library view, and that is
   the point: a set INTERLEAVES. Practice here is otherwise blocked by folder —
   all the loops, then all the arrays — and interleaved practice retains better
   than blocked practice by a wide margin. A drill is the one place the app can
   mix without the folders having to change.

   One set, rebuilt each time and kept under a fixed id, so drilling does not
   silently grow a list of sets nobody asked for. */
const CONCEPT_DRILL_SET_ID = 'set-concept-drill';

/**
 * Build a set from the weakest programs in a concept and start it.
 * @param {string} concept a MIN_REQ_DEFS type; omit for "my weakest overall"
 */
function conceptDrill(concept) {
  const model = conceptMastery();
  const picks = [];
  const label = [];

  const take = (c) => {
    if (!c) return;
    label.push(c.label);
    c.weakest.slice(0, 3).forEach(p => {
      if (!picks.some(x => x.challengeId === p.id)) picks.push({ challengeId: p.id, title: p.title });
    });
  };

  if (concept) {
    take(model.find(c => c.concept === concept));
  } else {
    // Mixed: the three weakest with real evidence behind them.
    conceptWeakest(3).forEach(take);
  }

  if (!picks.length) {
    if (typeof toast === 'function') toast('Nothing to drill yet — attempt a few programs first.', { type: 'info' });
    return;
  }

  const problems = picks.map((p, i) => {
    const ch = (state.challenges || []).find(c => c.id === p.challengeId);
    const v = ch && (ch.variants || [])[0];
    if (!ch || !v) return null;
    return { id: 'drill_' + i, source: 'library', challengeId: ch.id, variantId: v.id };
  }).filter(Boolean);

  if (!problems.length) {
    if (typeof toast === 'function') toast('Those programs are no longer in the library.', { type: 'warning' });
    return;
  }

  if (!Array.isArray(state.codingSets)) state.codingSets = [];
  const set = {
    id: CONCEPT_DRILL_SET_ID,
    title: 'Drill · ' + (label.join(' + ') || 'weakest'),
    description: 'Generated from your weakest ' + (concept ? 'programs in this concept' : 'concepts')
      + '. Rebuilt each time you start a drill.',
    problems: problems
  };
  const at = state.codingSets.findIndex(s => s.id === CONCEPT_DRILL_SET_ID);
  if (at === -1) state.codingSets.push(set); else state.codingSets[at] = set;
  if (typeof saveData === 'function') saveData();

  clearSessionParam('psetAutosave');          // a drill is always a fresh run
  setSessionParam('activeCodingSet', set.id);
  setSessionParam('codingSetTimeLimit', 0);
  spaNavigate('practice-set');
}

/* ── The panel ─────────────────────────────────────────────── */

function _conceptPct(c) {
  return c.strength === null ? '—' : c.strength + '%';
}

/**
 * The concept-mastery card for Coding Analytics.
 * @returns {string} HTML
 */
function conceptPanelHTML() {
  const model = conceptMastery();
  if (!model.length) {
    return '<div class="mk-empty">No programs carry minimum requirements yet, so there is nothing to measure against.</div>';
  }
  const tried = model.filter(c => c.strength !== null);
  if (!tried.length) {
    return '<div class="mk-empty">Attempt a few programs and each idea they exercise will get a strength here.</div>';
  }

  const weakest = conceptWeakest(3);
  const head = weakest.length
    ? `<div class="cn-lead">
         <span>Weakest right now: <strong>${weakest.map(c => escapeHTML(c.label)).join(', ')}</strong></span>
         <button class="cn-drill" onclick="conceptDrill()">
           <i data-lucide="swords"></i> Drill these
         </button>
       </div>`
    : '';

  return head + '<div class="cn-list">' + model.map(c => `
    <div class="cn-row is-${c.band}">
      <div class="cn-meter" title="${escapeHTML(c.bandLabel)}">
        <div class="cn-fill" style="--cn-w:${c.strength === null ? 0 : c.strength}%"></div>
      </div>
      <div class="cn-name">
        <span class="cn-label">${escapeHTML(c.label)}</span>
        <span class="cn-sub">${c.attempts
          ? c.attempts + ' attempt' + (c.attempts !== 1 ? 's' : '') + ' · ' + c.solved + '/' + c.programs + ' solved'
          : c.programs + ' program' + (c.programs !== 1 ? 's' : '') + ', none attempted'}${
          c.penalty ? ' · −' + c.penalty + ' from mistakes' : ''}</span>
      </div>
      <span class="cn-pct">${_conceptPct(c)}</span>
      <button class="cn-go" onclick="conceptDrill('${c.concept}')"
              title="Practise the weakest programs that use this">
        <i data-lucide="play"></i>
      </button>
    </div>`).join('') + '</div>';
}
