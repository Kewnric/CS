/* ============================================================
   LANG-DRILL-HELP.JS — making the drills answerable
   ------------------------------------------------------------
   The drills were fair to the grader and unfair to the learner. "___ ko."
   with four tiles is a guess, not a question: the sentence's meaning was
   known to the library -- it is on the matching "Say: ..." question, and on
   the word's example -- but never shown. A typed answer one letter off was
   simply wrong. A single slip in a five-pair grid failed the whole grid.

   This file holds the pieces that fix that and need no drill state:
   - the run settings (length, hearts, hints, typos, what is shown) and the
     panel that edits them, shared by the drill page and the running drill;
   - what a sentence means and what a word means, looked up from your own
     dictionary and sets;
   - typo tolerance, by edit distance over folded text.
   ============================================================ */

/* ── Settings ─────────────────────────────────────────────── */

const LA_PREFS_KEY = 'ssp.langDrillPrefs';

const LA_PREF_DEFAULTS = {
  length: 10,        // questions per run; 0 = all of them
  hearts: 3,         // 0 = unlimited, for practice without an ending
  meanings: true,    // show what a fill-in-the-blank sentence means
  hints: true,       // the hint button
  typos: true,       // one wrong letter still counts when typing
  autoNext: false,   // move on by itself after a right answer
  speakers: false,   // a speaker on every tile (read-aloud covers it otherwise)
  keys: true         // the little number-key labels
};

/* What the panel offers. `start` settings take effect when a run begins, so
   inside a running drill they say "next run" rather than appearing to do
   nothing. */
const LA_PREF_UI = [
  { key: 'length', label: 'Questions per run', icon: 'list-ordered', when: 'start',
    choices: [[5, '5'], [10, '10'], [20, '20'], [0, 'All']] },
  { key: 'hearts', label: 'Hearts', icon: 'heart', when: 'start',
    choices: [[3, '3'], [5, '5'], [0, '∞']] },
  { key: 'meanings', label: 'Show what sentences mean', icon: 'languages',
    sub: 'The translation under a fill-in-the-blank sentence' },
  { key: 'hints', label: 'Hint button', icon: 'lightbulb',
    sub: 'Clears a wrong answer or reveals a little. Costs no heart.' },
  { key: 'typos', label: 'Forgive small typos', icon: 'spell-check',
    sub: 'One wrong letter (two in long words) still counts' },
  { key: 'autoNext', label: 'Continue by itself when right', icon: 'fast-forward' },
  { key: 'speakers', label: 'Speaker on every tile', icon: 'volume-2' },
  { key: 'keys', label: 'Number-key labels', icon: 'keyboard' }
];

function laPrefs() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(LA_PREFS_KEY) || '{}') || {}; } catch (e) { saved = {}; }
  return Object.assign({}, LA_PREF_DEFAULTS, saved);
}

function laSetPref(key, value) {
  if (!(key in LA_PREF_DEFAULTS)) return;
  const p = laPrefs();
  p[key] = value;
  try { localStorage.setItem(LA_PREFS_KEY, JSON.stringify(p)); } catch (e) { /* private mode */ }
  // Every open panel repaints, and a running drill redraws what changed.
  document.querySelectorAll('[data-la-settings]').forEach(el => {
    el.innerHTML = laSettingsBodyHTML(el.dataset.laSettings);
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: el });
  });
  if (typeof laPrefsChanged === 'function') laPrefsChanged(key);
}

function laSettingsBodyHTML(where) {
  const p = laPrefs();
  return LA_PREF_UI.map(o => {
    if (o.choices) {
      return `
        <div class="la-set-row">
          <span class="la-set-label"><i data-lucide="${o.icon}"></i>
            <span>${escapeHTML(o.label)}${o.when === 'start' && where === 'run' ? '<small>From the next run</small>' : ''}</span></span>
          <span class="la-seg" role="radiogroup" aria-label="${escapeHTML(o.label)}">
            ${o.choices.map(([v, t]) => `
              <button type="button" role="radio" class="${p[o.key] === v ? 'is-on' : ''}" aria-checked="${p[o.key] === v ? 'true' : 'false'}"
                      onclick="laSetPref('${o.key}', ${v})">${t}</button>`).join('')}
          </span>
        </div>`;
    }
    const on = !!p[o.key];
    return `
      <div class="la-set-row">
        <span class="la-set-label"><i data-lucide="${o.icon}"></i>
          <span>${escapeHTML(o.label)}${o.sub ? `<small>${escapeHTML(o.sub)}</small>` : ''}</span></span>
        <button type="button" class="la-switch${on ? ' is-on' : ''}" role="switch" aria-checked="${on ? 'true' : 'false'}"
                aria-label="${escapeHTML(o.label)}" onclick="laSetPref('${o.key}', ${!on})"><i></i></button>
      </div>`;
  }).join('');
}

/** The settings panel. `where` is 'page' (before a run) or 'run' (during one). */
function laSettingsHTML(where) {
  return `<div class="la-settings" data-la-settings="${where}">${laSettingsBodyHTML(where)}</div>`;
}

/* ── What things mean ─────────────────────────────────────────
   Two lookups built from your own data and cached until it changes:
   sentence -> its meaning (from every example's gloss and every "Say: ..."
   arrange question), and word -> its meaning in the language you read. */

let _laMeanings = null;
let _laMeaningsKey = '';

function laMeaningTables() {
  const study = langStudy(), ref = langRef();
  const words = langWords(), sets = langSets();
  const key = study + ':' + ref + ':' + words.length + ':' + sets.length;
  if (_laMeanings && _laMeaningsKey === key) return _laMeanings;
  const sentences = {}, glosses = {};
  words.forEach(w => {
    const f = langForm(w, study), g = langForm(w, ref);
    if (f.term && g.term) glosses[langNormalizeAnswer(f.term)] = g.term;
    (f.examples || []).forEach(ex => {
      if (ex && ex.text && ex.gloss) sentences[langNormalizeAnswer(ex.text)] = ex.gloss;
    });
  });
  // An arrange question is a sentence and its meaning, written by hand.
  sets.forEach(set => (set.items || []).forEach(it => {
    if (it.type === 'arrange' && it.answer && /^\s*say\s*:/i.test(it.prompt || '')) {
      sentences[langNormalizeAnswer(it.answer)] = String(it.prompt).replace(/^\s*say\s*:\s*/i, '');
    }
  }));
  _laMeanings = { sentences, glosses };
  _laMeaningsKey = key;
  return _laMeanings;
}

/** What a fill-in-the-blank sentence means, or '' when nothing says. */
function laSentenceMeaning(it) {
  if (!it) return '';
  if (it.hint) return it.hint;
  const full = String(it.prompt || '').replace(/_{2,}|\{\}/, it.answer || '');
  return laMeaningTables().sentences[langNormalizeAnswer(full)] || '';
}

/** A word's meaning in the language you read, or ''. */
function laWordGloss(term) {
  return laMeaningTables().glosses[langNormalizeAnswer(term)] || '';
}

/* ── Typos ────────────────────────────────────────────────── */

/** Lower-case, no punctuation, no accents: the letters that matter. */
function laFold(s) {
  return langNormalizeAnswer(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Edit distance, with an early exit once it cannot come under `cap`. */
function laEditDistance(a, b, cap) {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev = [];
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < best) best = cur[j];
    }
    if (best > cap) return cap + 1;
    prev = cur;
  }
  return prev[b.length];
}

/**
 * How close a typed answer came.
 * @returns {'exact'|'accents'|'typo'|''} '' is wrong
 */
function laTypoMatch(given, expected) {
  if (langAnswersMatch(given, expected)) return 'exact';
  const g = laFold(given), e = laFold(expected);
  if (!g || !e) return '';
  if (g === e) return 'accents';
  const allow = e.length >= 9 ? 2 : e.length >= 4 ? 1 : 0;
  return allow && laEditDistance(g, e, allow) <= allow ? 'typo' : '';
}
