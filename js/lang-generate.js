/* ============================================================
   LANG-GENERATE.JS — drill questions built from the dictionary
   ------------------------------------------------------------
   THE GAP THIS CLOSES. Installing the starter pack put 1,008 words into the
   library, each with an English gloss, a description of how it is used and a
   worked example sentence. Every drill screen then reported ten questions
   ready, because langItemsOfType read authored SETS and nothing else. A
   thousand words, fifty questions, and no path from one to the other: 2% of
   the vocabulary was practisable and 98% was a list you could read.

   Nothing new had to be invented to fix it. _langSeedSets already builds all
   five puzzle types out of one word, and langEnemyFromWords already casts
   adventure opponents from the dictionary. This does the same thing for the
   drills, on demand rather than baked into saved records -- generated
   questions are not stored, so they cost no bytes in a document that is
   already the tightest thing in this app for space.

   ORDER IS NOT RANDOM. Questions come out weighted by what js/lang-recall.js
   knows: words that are due first, then words never asked, then the rest.
   Drilling a thousand words uniformly at random is how you see "gaan ug dugo"
   twice and never see "kuno" at all.
   ============================================================ */

/** The synthetic set generated questions belong to, so the runner can name them. */
const LANG_GEN_SET = { id: '__dictionary__', title: 'From your dictionary', lang: 'ceb', refLang: 'en' };

/** A word is usable at all if it has a term and a gloss in the two live languages. */
function langGenUsable(w, study, ref) {
  return !!(langForm(w, study).term && langForm(w, ref).term);
}

/** Its example sentence in the language being studied, if it has one. */
function langGenExample(w, study) {
  const ex = (langForm(w, study).examples || [])[0];
  return (ex && ex.text && ex.text.trim()) ? ex : null;
}

/**
 * Three wrong answers for a word.
 *
 * Drawn from the same tag first. A multiple choice between "kasingkasing" and
 * three random words is answerable by elimination without knowing anything;
 * between four body parts it is not.
 */
function langGenDistractors(w, pool, study, ref, n) {
  const want = n || 3;
  const mine = (w.tags || []);
  /* A DISTRACTOR THAT IS ALSO CORRECT IS NOT A DISTRACTOR. 26 words in the
     pack share an English gloss with another -- lima/singko are both "five",
     uyoan/tito are both "uncle", limpyo/hinlo are both "clean". Measured
     before this guard: 2.9% of choice questions on those words offered BOTH,
     marked one wrong, and then told the scheduler you had failed a word you
     had actually got right. Twice punished for being correct. */
  const gloss = langForm(w, ref).term.toLowerCase().trim();
  const ok = x => x !== w && langForm(x, ref).term.toLowerCase().trim() !== gloss
                  && langForm(x, study).term.toLowerCase().trim() !== langForm(w, study).term.toLowerCase().trim();
  const usable = pool.filter(ok);
  const same = usable.filter(x => (x.tags || []).some(t => mine.includes(t)));
  const rest = usable.filter(x => same.indexOf(x) === -1);
  const picked = langShuffle(same).slice(0, want);
  if (picked.length < want) picked.push(...langShuffle(rest).slice(0, want - picked.length));
  return picked.map(x => langForm(x, study).term).filter(Boolean);
}

/**
 * One question of one type, or null when this word cannot carry that type.
 * The returned item is shaped exactly like an authored one, plus wordId.
 */
function langGenItem(type, w, pool, study, ref) {
  const s = langForm(w, study), r = langForm(w, ref);
  const term = s.term, gloss = r.term;
  if (!term || !gloss) return null;
  const ex = langGenExample(w, study);
  const it = langBlankItem(type);
  it.id = 'gen-' + type + '-' + w.id;
  it.wordId = w.id;
  it.generated = true;

  if (type === 'choice') {
    const wrong = langGenDistractors(w, pool, study, ref, 3);
    if (wrong.length < 1) return null;
    it.prompt = 'Which one means "' + gloss + '"?';
    it.options = langShuffle([term].concat(wrong));
    it.correctIndex = it.options.indexOf(term);
    it.note = s.definition || '';
    return it;
  }

  if (type === 'translate') {
    it.prompt = 'Type "' + gloss + '" in ' + langName(study);
    it.answer = term;
    it.note = s.notes || s.definition || '';
    return it;
  }

  if (type === 'match') {
    /* Same rule as the distractors, and here it is worse: two rows with the
       same right-hand gloss make the grid genuinely unanswerable, because
       both pairings are true and only one is accepted. Build the set so no
       gloss and no term appears twice. */
    const seenGloss = {}, seenTerm = {};
    const take = x => {
      const g = langForm(x, ref).term.toLowerCase().trim();
      const t = langForm(x, study).term.toLowerCase().trim();
      if (!g || !t || seenGloss[g] || seenTerm[t]) return false;
      seenGloss[g] = seenTerm[t] = true;
      return true;
    };
    const chosen = [w].filter(take);
    langShuffle(pool.filter(x => x !== w)).some(x => {
      if (take(x)) chosen.push(x);
      return chosen.length >= 4;
    });
    it.prompt = 'Match each one to its meaning';
    it.pairs = chosen.map(x => ({ left: langForm(x, study).term, right: langForm(x, ref).term }));
    return it.pairs.length >= 2 ? it : null;
  }

  /* The two sentence puzzles need a sentence. Most of the pack has one; a
     word without is simply not offered for these types rather than being
     dressed up into a one-word "sentence" that teaches nothing. */
  if (!ex) return null;
  const sentence = ex.text.trim();
  const words = sentence.split(/\s+/).filter(Boolean);

  if (type === 'arrange') {
    if (words.length < 2) return null;
    it.prompt = 'Say: ' + (ex.gloss || gloss);
    it.answer = sentence;
    it.distractors = langGenDistractors(w, pool, study, ref, 2);
    return it;
  }

  if (type === 'blank') {
    /* Blank out the word being taught where the sentence contains it, and
       otherwise the longest word -- blanking "sa" asks nothing.

       BY POSITION, NOT BY TEXT. sentence.replace(target, '___') matches the
       first SUBSTRING, so "inom" inside "Moinom ko ug tubig" produced
       "Mo___ ko ug tubig" and asked the learner to complete a word that had
       been cut in half. Rebuilding the sentence from its own tokens cannot
       land inside one. */
    let at = words.findIndex(x => langNormalizeAnswer(x) === langNormalizeAnswer(term));
    if (at === -1) {
      let best = -1;
      words.forEach((x, i) => { if (best === -1 || x.length > words[best].length) best = i; });
      at = best;
    }
    const target = at > -1 ? words[at] : '';
    if (!target || target.length < 2) return null;
    it.prompt = words.map((x, i) => i === at ? '___' : x).join(' ');
    /* The tile the learner picks has to be the word, not the word plus the
       full stop that happened to follow it in the sentence. */
    it.answer = target.replace(/^[^\wÀ-ÿ]+|[^\wÀ-ÿ]+$/g, '') || target;
    if (it.answer !== target) it.prompt = it.prompt.replace('___', '___' + target.slice(target.indexOf(it.answer) + it.answer.length));
    it.distractors = langGenDistractors(w, pool, study, ref, 3);
    it.note = ex.gloss ? '"' + sentence + '" — ' + ex.gloss : '';
    return it;
  }
  return null;
}

/**
 * Words in the order they should be asked: due first, then unseen, then the
 * rest by how long since they last came round.
 */
function langGenOrder(pool) {
  if (typeof langRecall !== 'function') return langShuffle(pool);
  const due = [], fresh = [], seen = [];
  pool.forEach(w => {
    const r = langRecall(w.id);
    if (!r) fresh.push(w);
    else if (r.due <= langToday()) due.push(w);
    else seen.push(w);
  });
  due.sort((a, b) => langRecall(a.id).due - langRecall(b.id).due);
  seen.sort((a, b) => (langRecall(a.id).last || 0) - (langRecall(b.id).last || 0));
  return due.concat(langShuffle(fresh), seen);
}

/**
 * Questions of one type, built from the dictionary.
 * @param {string} type one of the five puzzle types
 * @param {number} [limit] how many to build; the drill only ever plays a handful
 * @returns {Array<{item:object,set:object}>} the same shape langItemsOfType returns
 */
function langGeneratedItems(type, limit) {
  const study = langStudy(), ref = langRef();
  const pool = langWords().filter(w => langGenUsable(w, study, ref));
  if (pool.length < 2) return [];
  const want = limit || 40;
  const out = [];
  /* Walk in recall order and stop at `want`, rather than building all 1,008
     and slicing -- building every question of every type over the pack is
     work nobody asked for on a screen that shows one question at a time. */
  const ordered = langGenOrder(pool);
  for (let i = 0; i < ordered.length && out.length < want; i++) {
    const it = langGenItem(type, ordered[i], pool, study, ref);
    if (it && !langItemProblems(it).length) out.push({ item: it, set: LANG_GEN_SET });
  }
  return out;
}

/**
 * How many questions of a type the dictionary could produce.
 *
 * Counted, not generated: the card on the board wants a number, and building
 * a thousand questions to count them would cost more than drawing the board.
 */
function langGeneratedCount(type) {
  const study = langStudy(), ref = langRef();
  const pool = langWords().filter(w => langGenUsable(w, study, ref));
  if (pool.length < 2) return 0;
  if (type === 'choice' || type === 'translate' || type === 'match') return pool.length;
  // arrange and blank need a usable example sentence
  return pool.filter(w => {
    const ex = langGenExample(w, study);
    if (!ex) return false;
    const words = ex.text.trim().split(/\s+/).filter(Boolean);
    return type === 'arrange' ? words.length >= 2 : words.some(x => x.length >= 2);
  }).length;
}
