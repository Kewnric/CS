/* ============================================================
   LANGUAGE-SEED.JS — a starter pack for the Language Library
   ------------------------------------------------------------
   Ten words, ten drill sets and ten scenarios, so the wing has something in
   it the first time you open it and every screen has real content to show.

   Shipped as a button rather than a file to import, for two reasons: an
   import REPLACES the whole store and would take your programs and notebooks
   with it, and this has to land wherever your data actually lives. Adding is
   additive and re-runnable — anything already there by name is skipped, so
   pressing it twice does not give you two of everything.

   A WORD ON THE VOCABULARY: these are common, everyday forms, but I am not a
   speaker of Cebuano, Filipino or Waray and some of them will be off —
   regional variants especially. They are starter entries meant to be
   corrected, which is exactly what the admin form is for.
   ============================================================ */

/* Each entry carries all four languages plus one short sentence, which is
   what the drill generator below builds its questions out of. */
const LANG_SAMPLE_WORDS = [
  { tags: ['question words'],
    en:  { t: 'who',  d: 'Asks which person.' },
    fil: { t: 'sino', d: 'Panghalip pananong para sa tao.' },
    ceb: { t: 'kinsa', d: 'Asks which person.', r: 'For people only — use "unsa" for things.' },
    war: { t: 'hin-o', d: 'Asks which person.' },
    s: { ceb: 'Kinsa ka', en: 'Who are you', q: 1 } },

  { tags: ['question words'],
    en:  { t: 'what', d: 'Asks which thing.' },
    fil: { t: 'ano',  d: 'Panghalip pananong para sa bagay.' },
    ceb: { t: 'unsa', d: 'Asks which thing.' },
    war: { t: 'ano',  d: 'Asks which thing.' },
    s: { ceb: 'Unsa ni', en: 'What is this', q: 1 } },

  { tags: ['question words'],
    en:  { t: 'where', d: 'Asks about a place.' },
    fil: { t: 'saan',  d: 'Pananong sa lugar.' },
    ceb: { t: 'asa',   d: 'Asks about a place.', n: 'Also used for "where are you going".' },
    war: { t: 'hain',  d: 'Asks about a place.' },
    s: { ceb: 'Asa ka padulong', en: 'Where are you going', q: 1 } },

  { tags: ['question words'],
    en:  { t: 'when',    d: 'Asks about a time.' },
    fil: { t: 'kailan',  d: 'Pananong sa oras.' },
    ceb: { t: 'kanus-a', d: 'Asks about a time.' },
    war: { t: 'san-o',   d: 'Asks about a time.' },
    s: { ceb: 'Kanus-a ka moabot', en: 'When will you arrive', q: 1 } },

  { tags: ['question words'],
    en:  { t: 'why',   d: 'Asks the reason.' },
    fil: { t: 'bakit', d: 'Pananong sa dahilan.' },
    ceb: { t: 'ngano', d: 'Asks the reason.' },
    war: { t: 'kay ano', d: 'Asks the reason.' },
    s: { ceb: 'Ngano man', en: 'Why is that', q: 1 } },

  { tags: ['question words'],
    en:  { t: 'how',    d: 'Asks the manner or method.' },
    fil: { t: 'paano',  d: 'Pananong sa paraan.' },
    ceb: { t: 'unsaon', d: 'Asks the manner or method.' },
    war: { t: 'paonan-o', d: 'Asks the manner or method.' },
    s: { ceb: 'Unsaon nako', en: 'How do I do it', q: 1 } },

  { tags: ['basics'],
    en:  { t: 'yes', d: 'Agreement.' },
    fil: { t: 'oo',  d: 'Pagsang-ayon.' },
    ceb: { t: 'oo',  d: 'Agreement.', n: 'Say "oo" to friends, "opo" upward in Filipino.' },
    war: { t: 'oo',  d: 'Agreement.' },
    s: { ceb: 'Oo salamat', en: 'Yes thank you' } },

  { tags: ['basics'],
    en:  { t: 'no',     d: 'Refusal or negation.' },
    fil: { t: 'hindi',  d: 'Pagtanggi.' },
    ceb: { t: 'dili',   d: 'Refusal or negation.', r: 'For "none/nothing" use "wala" instead.' },
    war: { t: 'diri',   d: 'Refusal or negation.' },
    s: { ceb: 'Dili ko', en: 'Not me' } },

  { tags: ['courtesy'],
    en:  { t: 'thank you', d: 'Gratitude.' },
    fil: { t: 'salamat',   d: 'Pasasalamat.' },
    ceb: { t: 'salamat',   d: 'Gratitude.', n: 'Add "kaayo" for "thank you very much".' },
    war: { t: 'salamat',   d: 'Gratitude.' },
    s: { ceb: 'Salamat kaayo', en: 'Thank you very much' } },

  { tags: ['courtesy', 'greetings'],
    en:  { t: 'good morning',    d: 'A morning greeting.' },
    fil: { t: 'magandang umaga', d: 'Bati sa umaga.' },
    ceb: { t: 'maayong buntag',  d: 'A morning greeting.', r: 'Before noon only — use "maayong hapon" after.' },
    war: { t: 'maupay nga aga',  d: 'A morning greeting.' },
    s: { ceb: 'Maayong buntag', en: 'Good morning' } }
];

/* Ten scenarios across the six locations. Each has two or three turns, and
   every turn has exactly one right answer plus two plausible wrong ones —
   wrong options that are obviously wrong teach nothing. */
const LANG_SAMPLE_SCENARIOS = [
  { title: 'Lunch queue small talk', location: 'cafeteria', npc: 'Ate Marites', turns: [
    { s: 'She turns around in the queue.', l: 'Kinsa ka?',
      o: [['Ako si Kim.', 1, 'She asked who you are — introduce yourself.'],
          ['Asa ka?', 0, 'That asks where SHE is going.'],
          ['Unsa?', 0, 'Just "what?" — abrupt.']] },
    { s: 'She nods at the last tray.', l: 'Gusto ka?',
      o: [['Oo, salamat.', 1, 'Accept and thank her.'],
          ['Ngano man?', 0, 'Asking why is odd here.'],
          ['Dili ko.', 0, 'A flat refusal with no thanks.']] }
  ] },
  { title: 'Late to first period', location: 'classroom', npc: 'Sir Tan', turns: [
    { s: 'He looks up as you come in.', l: 'Ngano nalangan ka?',
      o: [['Pasayloa ko, sir.', 1, 'Apologise first.'],
          ['Kinsa ka?', 0, 'You know who he is.'],
          ['Unsa ni?', 0, 'Answers nothing.']] },
    { s: 'He gestures at the board.', l: 'Unsa ni?',
      o: [['Kana ang leksyon.', 1, 'Name what he is pointing at.'],
          ['Asa ni?', 0, 'He asked what, not where.'],
          ['Oo.', 0, '"Yes" is not an answer to "what".']] }
  ] },
  { title: 'Stopped in the corridor', location: 'hallway', npc: 'Kuya Ben', turns: [
    { s: 'He blocks the way, grinning.', l: 'Asa ka padulong?',
      o: [['Sa klase.', 1, 'He asked where — say where.'],
          ['Kinsa ka?', 0, 'Deflecting.'],
          ['Kanus-a?', 0, 'He asked where, not when.']] },
    { s: 'He steps aside.', l: 'Sige, una na ko.',
      o: [['Salamat, ingat.', 1, 'Thank him and wish him well.'],
          ['Ngano?', 0, 'Asking why he is leaving is strange.'],
          ['Dili.', 0, 'Refusing nothing.']] }
  ] },
  { title: 'Dinner at home', location: 'home', npc: 'Nanay', turns: [
    { s: 'She sets down a plate.', l: 'Gusto ka og dugang?',
      o: [['Oo, salamat kaayo.', 1, 'Accept warmly.'],
          ['Hain?', 0, 'That is the Waray for "where".'],
          ['Unsaon?', 0, 'Asking how is out of place.']] },
    { s: 'She sits down across from you.', l: 'Kanus-a ka mopauli ugma?',
      o: [['Sa gabii.', 1, 'She asked when — give a time.'],
          ['Sa balay.', 0, 'That answers where.'],
          ['Kinsa?', 0, 'Answers nothing.']] }
  ] },
  { title: 'Buying at the stall', location: 'market', npc: 'Manang Lita', turns: [
    { s: 'She holds up a bundle.', l: 'Unsa imong gusto?',
      o: [['Kini, palihug.', 1, 'Point and ask politely.'],
          ['Kinsa ka?', 0, 'Rude to a vendor.'],
          ['Ngano man?', 0, 'Asking why she asked.']] },
    { s: 'She hands it over.', l: 'Salamat ha.',
      o: [['Salamat sab.', 1, 'Return the thanks.'],
          ['Dili ko.', 0, 'Refusing after taking it.'],
          ['Asa?', 0, 'Answers nothing.']] }
  ] },
  { title: 'Asking directions', location: 'street', npc: 'Traffic Aide', turns: [
    { s: 'You have been walking in circles.', l: 'Unsa imong gipangita?',
      o: [['Asa ang terminal?', 1, 'Ask where the terminal is.'],
          ['Kinsa ang terminal?', 0, '"Who" for a place.'],
          ['Kanus-a ang terminal?', 0, '"When" for a place.']] },
    { s: 'He points down the road.', l: 'Diretso lang.',
      o: [['Salamat kaayo.', 1, 'Thank him properly.'],
          ['Ngano?', 0, 'Questioning clear directions.'],
          ['Dili.', 0, 'Refusing help you asked for.']] }
  ] },
  { title: 'Group project partner', location: 'classroom', npc: 'Classmate Joy', turns: [
    { s: 'She waves her notebook at you.', l: 'Unsaon nato ni?',
      o: [['Bahinon nato.', 1, 'She asked HOW — propose a method.'],
          ['Kinsa nato?', 0, 'Not a question that fits.'],
          ['Asa nato?', 0, 'She asked how, not where.']] }
  ] },
  { title: 'Morning at the gate', location: 'hallway', npc: 'Guard Manoy', turns: [
    { s: 'He nods as you arrive.', l: 'Maayong buntag.',
      o: [['Maayong buntag sab.', 1, 'Return the greeting.'],
          ['Maayong gabii.', 0, 'That is "good evening".'],
          ['Salamat.', 0, 'Thanks is not a greeting back.']] },
    { s: 'He checks your bag.', l: 'Unsa naa diha?',
      o: [['Mga libro.', 1, 'Say what is inside.'],
          ['Oo.', 0, '"Yes" answers nothing.'],
          ['Hin-o?', 0, 'That is Waray for "who".']] }
  ] },
  { title: 'Sharing a table', location: 'cafeteria', npc: 'Senior Rex', turns: [
    { s: 'Every other seat is taken.', l: 'Pwede ba?',
      o: [['Oo, sige.', 1, 'Let him sit.'],
          ['Kinsa ka?', 0, 'Challenging a simple request.'],
          ['Ngano man?', 0, 'Demanding a reason.']] },
    { s: 'He settles in.', l: 'Salamat ha.',
      o: [['Walay sapayan.', 1, '"You are welcome".'],
          ['Dili.', 0, 'Refusing his thanks.'],
          ['Asa?', 0, 'Answers nothing.']] }
  ] },
  { title: 'Closing time', location: 'market', npc: 'Kuya Vendor', turns: [
    { s: 'The stalls are shutting.', l: 'Sirado na, sunod na lang.',
      o: [['Sige, salamat gihapon.', 1, 'Accept and thank him anyway.'],
          ['Ngano sirado?', 0, 'Arguing with closing time.'],
          ['Kinsa ka?', 0, 'Answers nothing.']] }
  ] }
];

/* ── Building the pack ────────────────────────────────────── */

function _langSeedWord(w) {
  const rec = langBlankWord();
  rec.tags = (w.tags || []).slice();
  LANG_CODES.forEach(c => {
    const src = w[c];
    if (!src) return;
    rec.forms[c] = {
      term: src.t,
      pos: '',
      definition: src.d || '',
      examples: (c === 'ceb' && w.s)
        ? [{ id: generateId(), text: w.s.ceb + (w.s.q ? '?' : '.'), gloss: w.s.en + (w.s.q ? '?' : '.') }]
        : [],
      notes: src.n || '',
      restrictions: src.r || ''
    };
  });
  return rec;
}

/**
 * Ten sets of five, one question per puzzle type, so every drill card on the
 * library board has ten questions behind it rather than one type having all
 * of them and the rest sitting empty.
 */
function _langSeedSets() {
  const out = [];
  for (let i = 0; i < LANG_SAMPLE_WORDS.length; i++) {
    const w = LANG_SAMPLE_WORDS[i];
    const others = LANG_SAMPLE_WORDS.filter((_, k) => k !== i);
    const pick = langShuffle(others).slice(0, 3);
    const sentence = w.s.ceb;
    const head = sentence.split(' ')[0];

    const set = langBlankSet();
    set.title = 'Starter ' + (i + 1) + ' — ' + w.en.t;
    set.description = 'Built around "' + w.ceb.t + '" (' + w.en.t + ').';
    set.lang = 'ceb';
    set.refLang = 'en';
    set.items = [
      Object.assign(langBlankItem('arrange'), {
        // Only the questions get a question mark — "Say: Not me?" read as one.
        prompt: 'Say: ' + w.s.en + (w.s.q ? '?' : '.'),
        answer: sentence,
        distractors: pick.map(p => p.ceb.t)
      }),
      Object.assign(langBlankItem('blank'), {
        prompt: sentence.replace(head, '___') + (w.s.q ? '?' : '.'),
        answer: head,
        distractors: pick.map(p => p.ceb.t)
      }),
      Object.assign(langBlankItem('choice'), {
        prompt: 'Which one means "' + w.en.t + '"?',
        options: langShuffle([w.ceb.t].concat(pick.map(p => p.ceb.t))),
        correctIndex: 0,
        note: w.ceb.d || ''
      }),
      Object.assign(langBlankItem('translate'), {
        prompt: 'Type "' + w.en.t + '" in Cebuano',
        answer: w.ceb.t,
        note: w.ceb.r || w.ceb.n || ''
      }),
      Object.assign(langBlankItem('match'), {
        prompt: 'Match each one to its meaning',
        pairs: [w].concat(pick).map(p => ({ left: p.ceb.t, right: p.en.t }))
      })
    ];
    // The choice options were shuffled, so find where the right one landed.
    const ch = set.items[2];
    ch.correctIndex = ch.options.indexOf(w.ceb.t);
    out.push(set);
  }
  return out;
}

function _langSeedScenarios() {
  return LANG_SAMPLE_SCENARIOS.map(sc => {
    const rec = langBlankScenario();
    rec.title = sc.title;
    rec.location = sc.location;
    rec.npc = sc.npc;
    rec.lang = 'ceb';
    rec.refLang = 'en';
    rec.playerHp = 100;
    rec.playerMana = 30;
    rec.npcHp = sc.turns.length * 40;   // beatable in one correct reply per turn
    rec.encounters = sc.turns.map(t => ({
      id: generateId(),
      situation: t.s,
      line: t.l,
      options: t.o.map(o => ({ text: o[0], correct: !!o[1], note: o[2] || '' })),
      damage: 40,
      backlash: 18
    }));
    return rec;
  });
}

/**
 * Add the pack, skipping anything already present by name.
 * @returns {{words:number, sets:number, scenarios:number, skipped:number}}
 */
function langAddSamplePack() {
  langStore();
  const res = { words: 0, sets: 0, scenarios: 0, skipped: 0 };

  const haveTerm = (t) => langWords().some(w =>
    LANG_CODES.some(c => (w.forms[c].term || '').toLowerCase() === t.toLowerCase()));
  LANG_SAMPLE_WORDS.forEach(w => {
    if (haveTerm(w.ceb.t)) { res.skipped++; return; }
    if (langSaveWord(_langSeedWord(w))) res.words++;
  });

  const haveSet = (title) => langSets().some(s => (s.title || '') === title);
  _langSeedSets().forEach(s => {
    if (haveSet(s.title)) { res.skipped++; return; }
    if (langSaveSet(s)) res.sets++;
  });

  const haveSc = (title) => langScenarios().some(s => (s.title || '') === title);
  _langSeedScenarios().forEach(s => {
    if (haveSc(s.title)) { res.skipped++; return; }
    if (langSaveScenario(s)) res.scenarios++;
  });

  saveData();
  langRefreshViews();
  return res;
}

/** The button in Language Admin. Confirms first — it writes to your store. */
function langLoadSamplePack() {
  const already = langWords().length + langSets().length + langScenarios().length;
  showConfirm('Add the starter pack?',
    'Ten words, ten drill sets and ten scenarios are added to your Language Library. '
    + 'Nothing is replaced — anything already there by name is skipped.'
    + (already ? ' You currently have ' + already + ' entr' + (already === 1 ? 'y' : 'ies') + '.' : ''),
    () => {
      const r = langAddSamplePack();
      const added = r.words + r.sets + r.scenarios;
      if (typeof toast === 'function') {
        toast(added
          ? `Added ${r.words} words, ${r.sets} drill sets and ${r.scenarios} scenarios.`
          + (r.skipped ? ` ${r.skipped} were already there.` : '')
          : 'Everything in the pack was already there.',
          { type: added ? 'success' : 'info', duration: 6000 });
      }
    });
}
