/* ============================================================
   LANGUAGE.JS — the Language Library's model and CRUD
   ------------------------------------------------------------
   Three collections, all persisted on `state`:

     langWords     — the dictionary. One record is a CONCEPT, not a word: it
                     holds a form per language, so "who / sino / kinsa / hin-o"
                     is one entry with four faces rather than four entries that
                     have to be kept pointing at each other.
     langSets      — authored puzzle sets (the Duolingo-style drills).
     langScenarios — the scenario game's encounters.

   Two languages are always in play: the one you are LEARNING and the one you
   are comparing against (English by default). Everything on screen is drawn
   from that pair, which is why they live in one place here rather than being
   passed around.
   ============================================================ */

const LANGS = [
  { code: 'en',  name: 'English',  short: 'EN' },
  { code: 'fil', name: 'Filipino', short: 'FIL' },
  { code: 'ceb', name: 'Cebuano',  short: 'CEB' },
  { code: 'war', name: 'Waray',    short: 'WAR' }
];

const LANG_CODES = LANGS.map(l => l.code);

/* Parts of speech, offered as a list so the same word is not filed as "noun"
   once and "Noun" the next time — the library groups on this. */
const LANG_POS = ['noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition',
  'conjunction', 'interjection', 'particle', 'phrase'];

const LANG_STUDY_KEY = 'lang.studyLang';
const LANG_REF_KEY = 'lang.refLang';

function langName(code) {
  const l = LANGS.find(x => x.code === code);
  return l ? l.name : String(code || '').toUpperCase();
}

function langShort(code) {
  const l = LANGS.find(x => x.code === code);
  return l ? l.short : String(code || '').toUpperCase();
}

function langIsCode(code) { return LANG_CODES.indexOf(code) > -1; }

/** The language being learned. Cebuano by default — English is the reference. */
function langStudy() {
  try {
    const v = localStorage.getItem(LANG_STUDY_KEY);
    return langIsCode(v) ? v : 'ceb';
  } catch (e) { return 'ceb'; }
}

/** What the study language is being compared against. */
function langRef() {
  try {
    const v = localStorage.getItem(LANG_REF_KEY);
    return langIsCode(v) ? v : 'en';
  } catch (e) { return 'en'; }
}

function langSetStudy(code) {
  if (!langIsCode(code)) return;
  // Study and reference must differ, or the side-by-side compares a column
  // with itself. Bumping the reference is less surprising than refusing the
  // click the user just made.
  try {
    localStorage.setItem(LANG_STUDY_KEY, code);
    if (langRef() === code) localStorage.setItem(LANG_REF_KEY, code === 'en' ? 'fil' : 'en');
  } catch (e) { /* private mode */ }
  langRefreshViews();
}

function langSetRef(code) {
  if (!langIsCode(code)) return;
  try {
    localStorage.setItem(LANG_REF_KEY, code);
    if (langStudy() === code) localStorage.setItem(LANG_STUDY_KEY, code === 'en' ? 'ceb' : 'en');
  } catch (e) { /* private mode */ }
  langRefreshViews();
}

/** Move the study language on to the next one that is not the reference. */
function langCycleStudy(dir) {
  const cur = langStudy(), ref = langRef();
  let i = LANG_CODES.indexOf(cur);
  for (let n = 0; n < LANG_CODES.length; n++) {
    i = (i + (dir < 0 ? -1 : 1) + LANG_CODES.length) % LANG_CODES.length;
    if (LANG_CODES[i] !== ref) { langSetStudy(LANG_CODES[i]); return; }
  }
}

/** Repaint whatever Language view is on screen after a change. */
function langRefreshViews() {
  if (typeof renderLangLibrary === 'function' && document.getElementById('lang-lib-root')) renderLangLibrary();
  if (typeof renderLangAdmin === 'function' && document.getElementById('lang-admin-root')) renderLangAdmin();
}

/* ── Store ────────────────────────────────────────────────── */

function langStore() {
  if (!Array.isArray(state.langWords)) state.langWords = [];
  if (!Array.isArray(state.langSets)) state.langSets = [];
  if (!Array.isArray(state.langScenarios)) state.langScenarios = [];
  if (!Array.isArray(state.langHistory)) state.langHistory = [];
  return state;
}

/** An empty form. Every word carries one of these per language. */
function langBlankForm() {
  return { term: '', pos: '', definition: '', examples: [], notes: '', restrictions: '' };
}

function langBlankWord() {
  const forms = {};
  LANG_CODES.forEach(c => { forms[c] = langBlankForm(); });
  return {
    id: generateId(), parentId: null, order: 0, tags: [],
    forms, createdAt: Date.now(), updatedAt: Date.now()
  };
}

/** Fills in anything a record is missing, so older/imported data still reads. */
function langNormWord(w) {
  if (!w || typeof w !== 'object') return null;
  if (!w.forms || typeof w.forms !== 'object') w.forms = {};
  LANG_CODES.forEach(c => {
    const f = w.forms[c] && typeof w.forms[c] === 'object' ? w.forms[c] : {};
    w.forms[c] = {
      term: String(f.term || '').trim(),
      pos: LANG_POS.indexOf(f.pos) > -1 ? f.pos : '',
      definition: String(f.definition || ''),
      examples: Array.isArray(f.examples)
        ? f.examples.filter(e => e && (e.text || e.gloss)).map(e => ({
            id: e.id || generateId(),
            text: String(e.text || ''),
            gloss: String(e.gloss || '')
          }))
        : [],
      notes: String(f.notes || ''),
      restrictions: String(f.restrictions || '')
    };
  });
  if (!Array.isArray(w.tags)) w.tags = [];
  return w;
}

function langWords() {
  langStore();
  return state.langWords;
}

function langFindWord(id) {
  return langWords().find(w => w.id === id) || null;
}

/**
 * The label to show for a word in a list.
 *
 * Prefers the language you are learning, falls back to the reference, then to
 * anything at all — a half-filled entry should still be findable rather than
 * appearing as a blank row you cannot click.
 */
function langHeadword(w, code) {
  if (!w || !w.forms) return 'Untitled';
  const order = [code || langStudy(), langRef()].concat(LANG_CODES);
  for (const c of order) {
    const t = w.forms[c] && w.forms[c].term;
    if (t && t.trim()) return t.trim();
  }
  return 'Untitled';
}

/** How many of the four languages actually have a term filled in. */
function langFilledCount(w) {
  if (!w || !w.forms) return 0;
  return LANG_CODES.filter(c => w.forms[c] && (w.forms[c].term || '').trim()).length;
}

function langSaveWord(w) {
  langStore();
  const norm = langNormWord(w);
  if (!norm) return null;
  // A record with no term in any language is not a word yet.
  if (!LANG_CODES.some(c => norm.forms[c].term)) return null;
  norm.updatedAt = Date.now();
  const i = state.langWords.findIndex(x => x.id === norm.id);
  if (i > -1) state.langWords[i] = norm;
  else {
    norm.createdAt = norm.createdAt || Date.now();
    state.langWords.push(norm);
  }
  saveData();
  return norm;
}

/** Undoable, like every other delete in the app. */
function langDeleteWord(id) {
  langStore();
  const i = state.langWords.findIndex(w => w.id === id);
  if (i === -1) return;
  const rec = state.langWords[i];
  const head = langHeadword(rec);
  state.langWords.splice(i, 1);
  if (typeof agDetachDeadline === 'function') agDetachDeadline('langword', id);
  saveData();
  langRefreshViews();
  if (typeof pushUndo === 'function') {
    pushUndo('Deleted word "' + head + '"', () => {
      langStore();
      state.langWords.splice(Math.min(i, state.langWords.length), 0, rec);
      saveData();
      langRefreshViews();
    });
  }
}

/* ── Search / filter ──────────────────────────────────────── */

/** Matches across every language's term, definition and examples. */
function langMatches(w, q) {
  if (!q) return true;
  const needle = q.toLowerCase();
  return LANG_CODES.some(c => {
    const f = w.forms[c];
    if (!f) return false;
    if ((f.term || '').toLowerCase().includes(needle)) return true;
    if ((f.definition || '').toLowerCase().includes(needle)) return true;
    if ((f.notes || '').toLowerCase().includes(needle)) return true;
    return (f.examples || []).some(e =>
      (e.text || '').toLowerCase().includes(needle) || (e.gloss || '').toLowerCase().includes(needle));
  }) || (w.tags || []).some(t => t.toLowerCase().includes(needle));
}

/** Every tag in use, for the filter chips. */
function langAllTags() {
  const seen = {};
  langWords().forEach(w => (w.tags || []).forEach(t => { seen[t] = (seen[t] || 0) + 1; }));
  return Object.keys(seen).sort().map(t => ({ tag: t, count: seen[t] }));
}

/* ── Puzzle sets ──────────────────────────────────────────── */

/* The five shapes a drill can take. Each names how it is answered, because
   that is what the runner and the author form both branch on. */
const LANG_PUZZLE_TYPES = [
  { type: 'arrange',   name: 'Arrange the sentence', icon: 'shuffle',
    hint: 'Tiles to drag into order — the classic Duolingo build-a-sentence.' },
  { type: 'blank',     name: 'Fill in the blank',    icon: 'square-dashed-bottom',
    hint: 'One word removed from a sentence; pick the tile that belongs.' },
  { type: 'choice',    name: 'Multiple choice',      icon: 'list-checks',
    hint: 'A prompt and up to four answers, one correct.' },
  { type: 'translate', name: 'Type the translation', icon: 'keyboard',
    hint: 'Free text, compared leniently — case and punctuation are ignored.' },
  { type: 'match',     name: 'Match the pairs',      icon: 'link',
    hint: 'Two columns to pair up, built from your own words.' }
];

function langPuzzleMeta(type) {
  return LANG_PUZZLE_TYPES.find(p => p.type === type) || LANG_PUZZLE_TYPES[0];
}

function langSets() { langStore(); return state.langSets; }
function langFindSet(id) { return langSets().find(s => s.id === id) || null; }

function langBlankSet() {
  return {
    id: generateId(), title: '', description: '', parentId: null, order: 0,
    lang: langStudy(), refLang: langRef(), items: [],
    createdAt: Date.now(), updatedAt: Date.now()
  };
}

function langBlankItem(type) {
  return {
    id: generateId(),
    type: type || 'arrange',
    prompt: '',          // shown to the learner (usually in the reference language)
    answer: '',          // the correct sentence / word
    options: [],         // choice: the answers offered
    correctIndex: 0,     // choice: which of them is right
    distractors: [],     // arrange / blank: extra tiles that do not belong
    pairs: [],           // match: [{ left, right }]
    note: ''             // shown after answering
  };
}

/** Everything a set needs before it can be attempted, or a list of reasons. */
function langSetProblems(set) {
  const out = [];
  if (!set) return ['This set no longer exists.'];
  if (!(set.title || '').trim()) out.push('The set has no title.');
  if (!(set.items || []).length) out.push('The set has no questions yet.');
  (set.items || []).forEach((it, i) => {
    const n = 'Question ' + (i + 1);
    if (it.type === 'choice') {
      const filled = (it.options || []).filter(o => (o || '').trim());
      if (filled.length < 2) out.push(n + ' needs at least two answers.');
      else if (!(it.options[it.correctIndex] || '').trim()) out.push(n + ' has no correct answer marked.');
    } else if (it.type === 'match') {
      const pairs = (it.pairs || []).filter(p => (p.left || '').trim() && (p.right || '').trim());
      if (pairs.length < 2) out.push(n + ' needs at least two complete pairs.');
    } else if (!(it.answer || '').trim()) {
      out.push(n + ' has no answer.');
    }
    if (it.type === 'blank' && (it.answer || '').trim() && !/_{2,}|\{\}/.test(it.prompt || '')) {
      out.push(n + ' has no blank in its sentence — write ___ where the word goes.');
    }
  });
  return out;
}

function langSaveSet(set) {
  langStore();
  if (!set || !(set.title || '').trim()) return null;
  set.title = String(set.title).trim();
  set.lang = langIsCode(set.lang) ? set.lang : langStudy();
  set.refLang = langIsCode(set.refLang) ? set.refLang : langRef();
  set.updatedAt = Date.now();
  const i = state.langSets.findIndex(s => s.id === set.id);
  if (i > -1) state.langSets[i] = set;
  else state.langSets.push(set);
  saveData();
  return set;
}

function langDeleteSet(id) {
  langStore();
  const i = state.langSets.findIndex(s => s.id === id);
  if (i === -1) return;
  const rec = state.langSets[i];
  state.langSets.splice(i, 1);
  saveData();
  langRefreshViews();
  if (typeof pushUndo === 'function') {
    pushUndo('Deleted set "' + (rec.title || 'Untitled') + '"', () => {
      langStore();
      state.langSets.splice(Math.min(i, state.langSets.length), 0, rec);
      saveData();
      langRefreshViews();
    });
  }
}

/* ── Scenarios ────────────────────────────────────────────── */

/* Placeholders for now, as asked — the shape is here so the game has real
   records to run against and the author form has something to fill in. */
const LANG_LOCATIONS = [
  { key: 'cafeteria', name: 'Cafeteria', icon: 'utensils' },
  { key: 'classroom', name: 'Classroom', icon: 'presentation' },
  { key: 'hallway',   name: 'Hallway',   icon: 'door-open' },
  { key: 'home',      name: 'Home',      icon: 'home' },
  { key: 'market',    name: 'Market',    icon: 'shopping-basket' },
  { key: 'street',    name: 'Street',    icon: 'signpost' }
];

function langLocation(key) {
  return LANG_LOCATIONS.find(l => l.key === key) || LANG_LOCATIONS[0];
}

function langScenarios() { langStore(); return state.langScenarios; }
function langFindScenario(id) { return langScenarios().find(s => s.id === id) || null; }

function langBlankScenario() {
  return {
    id: generateId(), title: '', location: 'cafeteria', npc: '', npcLine: '',
    lang: langStudy(), refLang: langRef(),
    playerHp: 100, playerMana: 30, npcHp: 100,
    encounters: [], createdAt: Date.now(), updatedAt: Date.now()
  };
}

function langBlankEncounter() {
  return {
    id: generateId(),
    situation: '',       // what is happening, in the reference language
    line: '',            // what the other person says, in the study language
    options: [
      { text: '', correct: true, note: '' },
      { text: '', correct: false, note: '' }
    ],
    damage: 25,          // dealt on a correct reply
    backlash: 20         // taken on a wrong one
  };
}

function langSaveScenario(sc) {
  langStore();
  if (!sc || !(sc.title || '').trim()) return null;
  sc.title = String(sc.title).trim();
  sc.updatedAt = Date.now();
  const i = state.langScenarios.findIndex(s => s.id === sc.id);
  if (i > -1) state.langScenarios[i] = sc;
  else state.langScenarios.push(sc);
  saveData();
  return sc;
}

function langDeleteScenario(id) {
  langStore();
  const i = state.langScenarios.findIndex(s => s.id === id);
  if (i === -1) return;
  const rec = state.langScenarios[i];
  state.langScenarios.splice(i, 1);
  saveData();
  langRefreshViews();
  if (typeof pushUndo === 'function') {
    pushUndo('Deleted scenario "' + (rec.title || 'Untitled') + '"', () => {
      langStore();
      state.langScenarios.splice(Math.min(i, state.langScenarios.length), 0, rec);
      saveData();
      langRefreshViews();
    });
  }
}

/* ── History ──────────────────────────────────────────────── */

function langRecordAttempt(rec) {
  langStore();
  state.langHistory.unshift(Object.assign({
    id: generateId(),
    ts: Date.now(),
    date: typeof agDateStr === 'function' ? agDateStr(new Date()) : new Date().toISOString().slice(0, 10)
  }, rec || {}));
  // Long histories are the slowest thing in this app's storage; 400 runs is
  // far more than any chart reads back.
  if (state.langHistory.length > 400) state.langHistory.length = 400;
  saveData();
}

function langHistoryFor(kind, id) {
  langStore();
  return state.langHistory.filter(h => h.kind === kind && h.refId === id);
}

function langBestPct(kind, id) {
  const h = langHistoryFor(kind, id);
  return h.length ? Math.max(...h.map(x => x.score || 0)) : -1;
}

/* ── Answer checking ──────────────────────────────────────── */

/**
 * Lenient comparison for typed answers.
 *
 * Case, surrounding whitespace, punctuation and repeated spaces are all
 * ignored: a learner who typed the right words should not be marked wrong for
 * a missing comma. Accents are kept, because in these languages they are part
 * of the word rather than decoration.
 */
function langNormalizeAnswer(s) {
  return String(s == null ? '' : s)
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:"'`()\[\]{}<>]/g, '')
    .replace(/\s+/g, ' ');
}

function langAnswersMatch(a, b) {
  return langNormalizeAnswer(a) === langNormalizeAnswer(b) && langNormalizeAnswer(a) !== '';
}

/** The tiles for an arrange/blank puzzle: the answer's words plus distractors. */
function langTokensFor(item) {
  const base = item.type === 'blank'
    ? [String(item.answer || '').trim()]
    : String(item.answer || '').trim().split(/\s+/).filter(Boolean);
  const extra = (item.distractors || []).map(d => String(d || '').trim()).filter(Boolean);
  return base.concat(extra);
}

/** Fisher-Yates, so the tiles are not always in answer order. */
function langShuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
