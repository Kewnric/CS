/* ============================================================
   ADMIN-NOTEBOOK-QUESTIONS.JS — one editor for a section's questions
   ------------------------------------------------------------
   There used to be two windows: "Modify Given Question" for the text and
   choices, and "Modify Answer Key" for which choice was right. They edited the
   same records through two drafts, disagreed about how many questions there
   were, and made you open the second window to finish every question you
   wrote in the first ("Fixed choices — set answer in Answer Key").

   Now each question is one card: its text, its choices with the right one
   marked beside them, then explanation, hint and image. The paste boxes for
   questions and for an answer key sit in the side panel.

   Everything edits a draft (nbqDraft). The section changes on Save; Cancel and
   Esc throw the draft away (asking first when something changed).

   Also here: the question model every part of the notebook editor shares —
   one record per question, its shape decided by its type.
   ============================================================ */

/* ---------- Question model ---------- */
const NBQ_TYPES = ['mcq', 'checkbox', 'text', 'matching', 'truefalse'];
const NBQ_TYPE_LABEL = { mcq: 'Multiple choice', checkbox: 'Multi-select', truefalse: 'True / False', text: 'Identification', matching: 'Matching' };

function nbBlankQuestion(qNum, type, nChoices) {
  const d = { qNum, type: type || 'mcq', question: '', hint: '', image: '', explanation: '' };
  const n = Math.max(2, Math.min(8, nChoices || 4));
  if (d.type === 'mcq' || d.type === 'checkbox') {
    d.choices = {};
    for (let i = 0; i < n; i++) d.choices[String.fromCharCode(65 + i)] = '';
  }
  nbApplyTypeDefaults(d);
  return d;
}

/** Gives a record the shape its type needs, and drops answers that type can't hold. */
function nbApplyTypeDefaults(d) {
  const t = NBQ_TYPES.includes(d.type) ? d.type : 'mcq';
  d.type = t;
  if (t === 'mcq') {
    if (!d.choices || !Object.keys(d.choices).length) d.choices = { A: '', B: '', C: '', D: '' };
    if (Array.isArray(d.answer)) d.answer = d.answer[0] || '';
    if (typeof d.answer !== 'string') d.answer = '';
    if (d.answer && !Object.keys(d.choices).includes(d.answer)) d.answer = '';
    delete d.pairs;
  } else if (t === 'checkbox') {
    if (!d.choices || !Object.keys(d.choices).length) d.choices = { A: '', B: '', C: '', D: '' };
    if (!Array.isArray(d.answer)) d.answer = (typeof d.answer === 'string' && d.answer) ? [d.answer] : [];
    d.answer = d.answer.filter(a => Object.keys(d.choices).includes(a));
    delete d.pairs;
  } else if (t === 'truefalse') {
    d.choices = { A: 'True', B: 'False' };
    if (Array.isArray(d.answer)) d.answer = d.answer[0] || '';
    // Accept either the letter or the word, store the letter.
    const v = String(d.answer || '').trim().toLowerCase();
    d.answer = (v === 'a' || v === 'true') ? 'A' : (v === 'b' || v === 'false') ? 'B' : '';
    delete d.pairs;
  } else if (t === 'text') {
    if (Array.isArray(d.answer)) d.answer = d.answer.join(', ');
    if (typeof d.answer !== 'string') d.answer = '';
    delete d.choices;
    delete d.pairs;
  } else if (t === 'matching') {
    if (!Array.isArray(d.pairs) || !d.pairs.length) d.pairs = [{ left: '', right: '' }, { left: '', right: '' }];
    d.pairs = d.pairs.map(pr => ({ left: (pr && pr.left) || '', right: (pr && pr.right) || '' }));
    delete d.choices;
    d.answer = '';
  }
  return d;
}

/**
 * Makes a section's records match its question count exactly (the count field
 * on the section card sets it).
 * @returns {number} how many records were dropped
 */
function nbNormalizeSection(sec) {
  if (!sec) return 0;
  const count = (sec.questions || []).length;
  sec.questions = Array.from({ length: count }, (_, i) => i + 1);
  const byNum = {};
  (sec.answerKeysData || []).forEach(d => { if (d && d.qNum != null) byNum[+d.qNum] = d; });
  const dropped = Object.keys(byNum).filter(n => +n > count || +n < 1).length;
  sec.answerKeysData = sec.questions.map(q => nbApplyTypeDefaults(byNum[q] || nbBlankQuestion(q, 'mcq', sec.choices)));
  return dropped;
}

/**
 * Writes an edited question list back to its section: numbered 1..n in the
 * order shown, the count taken from the list, and the old one-line answer key
 * rebuilt for anything still reading it.
 */
function nbCommitQuestions(sec, list) {
  const clean = JSON.parse(JSON.stringify(list || []))
    .map((d, i) => { delete d._rightPool; delete d._rightOrder; d.qNum = i + 1; return nbApplyTypeDefaults(d); });
  sec.answerKeysData = clean;
  sec.questions = clean.map(d => d.qNum);
  nbRebuildLegacyKey(sec);
}

/** The "1=A" text key the oldest attempt code falls back to. */
function nbRebuildLegacyKey(sec) {
  sec.answerKey = (sec.answerKeysData || [])
    .filter(d => {
      const t = d.type || 'mcq';
      return (t === 'mcq' || t === 'truefalse') && d.answer && typeof d.answer === 'string' && d.answer.trim() !== '';
    })
    .map(d => `${d.qNum}=${d.answer.trim().toUpperCase()}`)
    .join('\n');
}

/** Very old notebooks kept only "1=A" lines. */
function parseOldAnswerKey(str) {
  const data = [];
  if (!str) return data;
  str.split('\n').forEach(line => {
    const match = line.trim().match(/^(\d+)\s*[=:]\s*([A-Ea-e])/);
    if (match) data.push({ qNum: parseInt(match[1], 10), answer: match[2].toUpperCase(), explanation: '' });
  });
  return data;
}

/** Whether a question can be graded as it stands. */
function nbqHasAnswer(d) {
  if (!d) return false;
  const t = d.type || 'mcq';
  if (t === 'checkbox') return Array.isArray(d.answer) && d.answer.length > 0;
  if (t === 'matching') return (d.pairs || []).filter(p => String(p.left || '').trim() && String(p.right || '').trim()).length >= 2;
  return String(d.answer == null ? '' : d.answer).trim() !== '';
}

/* ---------- Scroll + focus preservation ----------
   Every structural edit rebuilds the list's HTML. This keeps each scroller
   where it was and puts the caret back, so changing Q12's type does not throw
   you back to Q1. */
function nbRerender(containerId, renderFn) {
  const host = document.getElementById(containerId);
  const scrollersBefore = host
    ? [host, ...host.querySelectorAll('*')].filter(el => el.scrollHeight > el.clientHeight + 4).map(el => el.scrollTop)
    : [];
  const outerTop = host ? host.scrollTop : 0;
  const act = document.activeElement;
  const focusId = act && act.id ? act.id : null;
  const selStart = act && act.selectionStart != null ? act.selectionStart : null;

  renderFn();

  const host2 = document.getElementById(containerId);
  if (host2) {
    const after = [host2, ...host2.querySelectorAll('*')].filter(el => el.scrollHeight > el.clientHeight + 4);
    after.forEach((el, i) => { if (scrollersBefore[i] != null) el.scrollTop = scrollersBefore[i]; });
    host2.scrollTop = outerTop;
  }
  if (focusId) {
    const el = document.getElementById(focusId);
    if (el) {
      try {
        el.focus({ preventScroll: true });
        if (selStart != null && el.setSelectionRange) el.setSelectionRange(selStart, selStart);
      } catch (e) { /* not a text field */ }
    }
  }
}

/* ---------- The editor ---------- */
let nbqSecIdx = -1;
let nbqDraft = [];
let nbqOpenedJson = '';
let nbqUndoState = null;
let _nbqKeys = null;

function nbqSection() {
  return notebookAdminState && notebookAdminState.sections ? notebookAdminState.sections[nbqSecIdx] : null;
}

function nbOpenQuestionEditor(idx) {
  if (typeof syncAllNotebookSections === 'function') syncAllNotebookSections();
  const sec = notebookAdminState && notebookAdminState.sections[idx];
  if (!sec) return;
  if (!sec.answerKeysData || !sec.answerKeysData.length) {
    sec.answerKeysData = sec.answerKey ? parseOldAnswerKey(sec.answerKey) : [];
  }
  nbNormalizeSection(sec);
  nbqSecIdx = idx;
  nbqDraft = JSON.parse(JSON.stringify(sec.answerKeysData)).map(d => nbApplyTypeDefaults(d));
  nbqOpenedJson = JSON.stringify(nbqDraft);
  nbqUndoState = null;

  const modal = document.getElementById('given-question-modal');
  if (!modal) return;
  const title = modal.querySelector('.modal-title');
  if (title) title.textContent = 'Questions · ' + (sec.label || 'Section ' + (idx + 1));
  modal.classList.remove('hidden');

  // Ahead of the admin page's own Esc (it closed the notebook behind this)
  // and its Ctrl+S (it saved the notebook without this window's edits).
  if (_nbqKeys) window.removeEventListener('keydown', _nbqKeys, true);
  _nbqKeys = (e) => {
    const m = document.getElementById('given-question-modal');
    if (!m || m.classList.contains('hidden')) return;
    const dlg = document.getElementById('dialog-modal');
    if (dlg && !dlg.classList.contains('hidden')) return;   // a confirm is up
    const k = String(e.key || '').toLowerCase();
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); nbqCancel(); }
    else if ((e.ctrlKey || e.metaKey) && !e.altKey && k === 's') {
      e.preventDefault(); e.stopPropagation();
      if (!e.repeat) nbqSave({ andNotebook: true });
    }
  };
  window.addEventListener('keydown', _nbqKeys, true);

  nbqRender();
  // An empty section opens on the paste box; a full one on its first question.
  setTimeout(() => {
    const first = nbqDraft.length ? document.getElementById('nbq-q-0') : document.getElementById('nbq-paste');
    if (first) try { first.focus({ preventScroll: true }); } catch (e) { /* gone */ }
  }, 60);
}

function nbqClose() {
  const modal = document.getElementById('given-question-modal');
  if (modal) modal.classList.add('hidden');
  if (_nbqKeys) window.removeEventListener('keydown', _nbqKeys, true);
  _nbqKeys = null;
  nbqSecIdx = -1;
  nbqDraft = [];
  nbqUndoState = null;
}

function nbqChanged() {
  return JSON.stringify(nbqDraft) !== nbqOpenedJson;
}

function nbqCancel() {
  if (!nbqChanged()) { nbqClose(); return; }
  showConfirm('Discard these changes?', 'Your edits to the questions in this section will be lost.', () => nbqClose());
}

/** Writes the draft into the section. With andNotebook, saves the notebook too (Ctrl+S). */
function nbqSave(opts) {
  const sec = nbqSection();
  if (!sec) { nbqClose(); return; }
  nbCommitQuestions(sec, nbqDraft);
  let maxChoices = 0;
  nbqDraft.forEach(d => { const n = Object.keys(d.choices || {}).length; if (n > maxChoices) maxChoices = n; });
  if (maxChoices) sec.choices = Math.max(2, Math.min(8, maxChoices));
  const changed = nbqChanged();
  nbqClose();
  renderNotebookSectionsForm();
  if (changed) nbMarkDirty();
  if (opts && opts.andNotebook && typeof saveNotebookForm === 'function') saveNotebookForm({ silent: true });
}

/* ---- Field edits: write straight to the draft, no re-render ---- */
function nbqSet(i, field, value) {
  const d = nbqDraft[i];
  if (!d) return;
  d[field] = value;
  if (field === 'answer') nbqPaintStatus(i);
}

function nbqSetChoice(i, letter, value) {
  const d = nbqDraft[i];
  if (!d || !d.choices) return;
  d.choices[letter] = value;
}

function nbqMark(i, letter, on) {
  const d = nbqDraft[i];
  if (!d) return;
  if (d.type === 'checkbox') {
    const set = new Set(Array.isArray(d.answer) ? d.answer : []);
    if (on) set.add(letter); else set.delete(letter);
    d.answer = Object.keys(d.choices || {}).sort().filter(L => set.has(L));
  } else {
    d.answer = letter;
  }
  // Only this card's marks change.
  document.querySelectorAll(`#nbq-card-${i} .nbq-choice, #nbq-card-${i} .nbq-tf`).forEach(el => {
    const L = el.dataset.letter;
    const isOn = Array.isArray(d.answer) ? d.answer.includes(L) : d.answer === L;
    el.classList.toggle('is-correct', isOn);
    const input = el.querySelector('input[type=radio], input[type=checkbox]');
    if (input) input.checked = isOn;
    if (el.classList.contains('nbq-tf')) el.setAttribute('aria-pressed', isOn ? 'true' : 'false');
  });
  nbqPaintStatus(i);
}

function nbqSetPair(i, pi, side, value) {
  const d = nbqDraft[i];
  if (!d || !d.pairs || !d.pairs[pi]) return;
  d.pairs[pi][side] = value;
  nbqPaintStatus(i);
}

/* ---- Structural edits: re-render, keeping scroll and caret ---- */
function nbqRerender() { nbRerender('given-question-content', nbqRender); }

function nbqChangeType(i, type) {
  const d = nbqDraft[i];
  if (!d || d.type === type) return;
  // Same family (MCQ, multi-select, T/F all pick from choices) keeps what it
  // can; crossing families starts the answer clean.
  const family = (t) => (t === 'mcq' || t === 'checkbox' || t === 'truefalse') ? 'choice' : t;
  if (family(d.type) !== family(type)) d.answer = '';
  if (d.type === 'truefalse' && (type === 'mcq' || type === 'checkbox')) {
    d.choices = { A: '', B: '', C: '', D: '' };
    d.answer = type === 'checkbox' ? [] : '';
  }
  d.type = type;
  nbApplyTypeDefaults(d);
  nbqRerender();
}

function nbqAddChoice(i, focus) {
  const d = nbqDraft[i];
  if (!d || !d.choices) return;
  const keys = Object.keys(d.choices).sort();
  if (keys.length >= 8) return;
  const next = String.fromCharCode(65 + keys.length);
  d.choices[next] = '';
  nbqRerender();
  if (focus) setTimeout(() => document.getElementById(`nbq-c-${i}-${next}`)?.focus(), 0);
}

/** Removes one choice and closes the gap, so the letters still run A, B, C. */
function nbqRemoveChoice(i, letter) {
  const d = nbqDraft[i];
  if (!d || !d.choices) return;
  const keys = Object.keys(d.choices).sort();
  if (keys.length <= 2) return;
  const kept = keys.filter(L => L !== letter);
  const remap = {};
  const choices = {};
  kept.forEach((L, k) => { const nl = String.fromCharCode(65 + k); remap[L] = nl; choices[nl] = d.choices[L]; });
  d.choices = choices;
  if (Array.isArray(d.answer)) d.answer = d.answer.filter(L => remap[L]).map(L => remap[L]);
  else d.answer = remap[d.answer] || '';
  nbqRerender();
}

/** Enter in a choice goes to the next one, or makes it. */
function nbqChoiceKey(e, i, letter) {
  if (e.key !== 'Enter' || e.shiftKey) return;
  e.preventDefault();
  const d = nbqDraft[i];
  const keys = Object.keys((d && d.choices) || {}).sort();
  const at = keys.indexOf(letter);
  if (at >= 0 && at < keys.length - 1) document.getElementById(`nbq-c-${i}-${keys[at + 1]}`)?.focus();
  else nbqAddChoice(i, true);
}

function nbqAddPair(i, focus) {
  const d = nbqDraft[i];
  if (!d) return;
  if (!d.pairs) d.pairs = [];
  d.pairs.push({ left: '', right: '' });
  nbqRerender();
  if (focus) setTimeout(() => document.getElementById(`nbq-pl-${i}-${d.pairs.length - 1}`)?.focus(), 0);
}

function nbqRemovePair(i, pi) {
  const d = nbqDraft[i];
  if (!d || !d.pairs || d.pairs.length <= 2) return;
  d.pairs.splice(pi, 1);
  nbqRerender();
}

function nbqPairKey(e, i, pi) {
  if (e.key !== 'Enter' || e.shiftKey) return;
  e.preventDefault();
  const d = nbqDraft[i];
  if (d && pi < d.pairs.length - 1) document.getElementById(`nbq-pl-${i}-${pi + 1}`)?.focus();
  else nbqAddPair(i, true);
}

function nbqAdd(type, count) {
  const sec = nbqSection();
  const n = Math.max(1, Math.min(50, count || 1));
  for (let k = 0; k < n && nbqDraft.length < NB_MAX_QUESTIONS; k++) {
    const q = nbBlankQuestion(nbqDraft.length + 1, type, sec && sec.choices);
    nbqDraft.push(q);
  }
  nbqRender();
  const last = nbqDraft.length - 1 - (n - 1);
  setTimeout(() => {
    const card = document.getElementById(`nbq-card-${last}`);
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById(`nbq-q-${last}`)?.focus({ preventScroll: true });
  }, 0);
}

function nbqMove(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= nbqDraft.length) return;
  [nbqDraft[i], nbqDraft[j]] = [nbqDraft[j], nbqDraft[i]];
  nbqRerender();
  document.getElementById(`nbq-card-${j}`)?.scrollIntoView({ block: 'nearest' });
}

function nbqDuplicate(i) {
  const d = nbqDraft[i];
  if (!d || nbqDraft.length >= NB_MAX_QUESTIONS) return;
  nbqDraft.splice(i + 1, 0, JSON.parse(JSON.stringify(d)));
  nbqRerender();
}

function nbqDelete(i) {
  if (!nbqDraft[i]) return;
  nbqUndoState = { label: 'Question ' + (i + 1) + ' deleted', draft: JSON.parse(JSON.stringify(nbqDraft)) };
  nbqDraft.splice(i, 1);
  nbqRerender();
}

function nbqClearAll() {
  if (!nbqDraft.length) return;
  showConfirm('Delete all ' + nbqDraft.length + ' questions?', 'This only changes the window until you press Save, and Undo brings them back.', () => {
    nbqUndoState = { label: 'All questions deleted', draft: JSON.parse(JSON.stringify(nbqDraft)) };
    nbqDraft = [];
    nbqRender();
  });
}

function nbqUndo() {
  if (!nbqUndoState) return;
  nbqDraft = nbqUndoState.draft;
  nbqUndoState = null;
  nbqRerender();
}

/* ---- Images ----
   Uploads go to the picture store (js/media-store.js); the question keeps its
   reference. A pasted web address is kept as it is. */
(window.MEDIA_READERS = window.MEDIA_READERS || {})['admin-notebook-questions'] = true;

function nbqUploadImage(i, input) {
  const file = input.files && input.files[0];
  if (!file || !nbqDraft[i]) return;
  if (!/^image\//.test(file.type)) { if (typeof toast === 'function') toast('Please choose an image file.', { type: 'error' }); return; }
  const target = nbqDraft[i];
  input.value = '';
  mediaUpload(file).then((ref) => {
    // The same question, even if it moved or the list was rebuilt meanwhile.
    if (nbqDraft.indexOf(target) === -1) return;
    target.image = ref;
    nbqRerender();
  }).catch(() => { if (typeof toast === 'function') toast('That picture could not be read.', { type: 'error' }); });
}

function nbqSetImageUrl(i, value) {
  if (!nbqDraft[i]) return;
  nbqDraft[i].image = String(value || '').trim();
  nbqRerender();
}

function nbqClearImage(i) {
  if (!nbqDraft[i]) return;
  nbqDraft[i].image = '';
  nbqRerender();
}

/* ---- Status ---- */
function _nbqStatusHtml(d) {
  if (nbqHasAnswer(d)) return '<i data-lucide="check-circle-2"></i> Answer set';
  return d.type === 'matching' ? '<i data-lucide="alert-circle"></i> Needs two full pairs' : '<i data-lucide="alert-circle"></i> Needs an answer';
}

function nbqPaintStatus(i) {
  const d = nbqDraft[i];
  const card = document.getElementById(`nbq-card-${i}`);
  const st = document.getElementById(`nbq-status-${i}`);
  if (!d || !card || !st) return;
  const ok = nbqHasAnswer(d);
  card.classList.toggle('needs-answer', !ok);
  st.className = 'nbq-status ' + (ok ? 'is-ok' : 'is-bad');
  st.innerHTML = _nbqStatusHtml(d);
  if (typeof lucide !== 'undefined') lucide.createIcons({ el: st });
  nbqPaintSummary();
}

function nbqPaintSummary() {
  const el = document.getElementById('nbq-summary');
  if (!el) return;
  const n = nbqDraft.length;
  const missing = nbqDraft.filter(d => !nbqHasAnswer(d)).length;
  el.innerHTML = !n ? 'No questions yet'
    : `<strong>${n}</strong> question${n !== 1 ? 's' : ''}` +
      (missing
        ? ` · <span class="nbq-summary-bad">${missing} need${missing === 1 ? 's' : ''} an answer</span> <button type="button" class="nbq-next-btn" onclick="nbqJumpNext()">Next <i data-lucide="arrow-down"></i></button>`
        : ' · <span class="nbq-summary-ok">all answered</span>');
  if (typeof lucide !== 'undefined') lucide.createIcons({ el });
}

let _nbqJumpFrom = -1;
/** Scrolls to the next question that still needs an answer. */
function nbqJumpNext() {
  const n = nbqDraft.length;
  for (let k = 1; k <= n; k++) {
    const i = (_nbqJumpFrom + k) % n;
    if (!nbqHasAnswer(nbqDraft[i])) {
      _nbqJumpFrom = i;
      const card = document.getElementById(`nbq-card-${i}`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.remove('nb-flash'); void card.offsetWidth; card.classList.add('nb-flash');
      }
      return;
    }
  }
}

/* ---- Rendering ---- */
function _nbqBodyHtml(d, i) {
  const t = d.type;
  if (t === 'mcq' || t === 'checkbox') {
    const keys = Object.keys(d.choices || {}).sort();
    const multi = t === 'checkbox';
    const isOn = (L) => multi ? (Array.isArray(d.answer) && d.answer.includes(L)) : d.answer === L;
    return `
      <div class="nbq-choices" role="${multi ? 'group' : 'radiogroup'}" aria-label="Choices for question ${i + 1}">
        ${keys.map(L => `
          <div class="nbq-choice${isOn(L) ? ' is-correct' : ''}" data-letter="${L}">
            <label class="nbq-mark" title="${multi ? 'Tick every right answer' : 'Mark as the right answer'}">
              <input type="${multi ? 'checkbox' : 'radio'}" name="nbq-ans-${i}" ${isOn(L) ? 'checked' : ''}
                     onchange="nbqMark(${i}, '${L}', this.checked)" aria-label="${L} is ${multi ? 'a' : 'the'} right answer" />
              <span class="nbq-letter">${L}</span>
            </label>
            <input id="nbq-c-${i}-${L}" class="form-input nbq-choice-text" value="${escapeHTML(d.choices[L] || '')}"
                   placeholder="Choice ${L}" oninput="nbqSetChoice(${i}, '${L}', this.value)" onkeydown="nbqChoiceKey(event, ${i}, '${L}')" />
            <button type="button" class="nbq-tool" onclick="nbqRemoveChoice(${i}, '${L}')" ${keys.length <= 2 ? 'disabled' : ''} title="Remove choice ${L}" aria-label="Remove choice ${L}"><i data-lucide="x"></i></button>
          </div>`).join('')}
        <div class="nbq-choice-foot">
          <button type="button" class="nbq-add-line" onclick="nbqAddChoice(${i}, true)" ${keys.length >= 8 ? 'disabled' : ''}><i data-lucide="plus"></i> Add choice</button>
          <span>${multi ? 'Tick every right answer.' : 'Click a letter to mark the right answer.'}</span>
        </div>
      </div>`;
  }
  if (t === 'truefalse') {
    return `
      <div class="nbq-tf-row" role="radiogroup" aria-label="Right answer for question ${i + 1}">
        ${[['A', 'True'], ['B', 'False']].map(([L, word]) => `
          <button type="button" class="nbq-tf nbq-tf-${word.toLowerCase()}${d.answer === L ? ' is-correct' : ''}" data-letter="${L}"
                  aria-pressed="${d.answer === L ? 'true' : 'false'}" onclick="nbqMark(${i}, '${L}', true)">
            <i data-lucide="${L === 'A' ? 'check' : 'x'}"></i> ${word}
          </button>`).join('')}
        <span class="nbq-tf-note">Click the right answer.</span>
      </div>`;
  }
  if (t === 'text') {
    return `
      <div class="nbq-ident">
        <label for="nbq-a-${i}">Right answer</label>
        <input id="nbq-a-${i}" class="form-input" value="${escapeHTML(typeof d.answer === 'string' ? d.answer : '')}"
               placeholder="e.g. photosynthesis | photo synthesis" oninput="nbqSet(${i}, 'answer', this.value)" />
        <span>Grading ignores case and extra spaces. Separate other accepted answers with |.</span>
      </div>`;
  }
  // matching
  const pairs = d.pairs || [];
  return `
    <div class="nbq-pairs">
      <div class="nbq-pairs-head"><span>Term</span><span></span><span>Its match</span><span></span></div>
      ${pairs.map((p, pi) => `
        <div class="nbq-pair">
          <input id="nbq-pl-${i}-${pi}" class="form-input" value="${escapeHTML(p.left || '')}" placeholder="Term ${pi + 1}"
                 oninput="nbqSetPair(${i}, ${pi}, 'left', this.value)" />
          <i data-lucide="arrow-right" class="nbq-pair-arrow"></i>
          <input id="nbq-pr-${i}-${pi}" class="form-input" value="${escapeHTML(p.right || '')}" placeholder="Match ${pi + 1}"
                 oninput="nbqSetPair(${i}, ${pi}, 'right', this.value)" onkeydown="nbqPairKey(event, ${i}, ${pi})" />
          <button type="button" class="nbq-tool" onclick="nbqRemovePair(${i}, ${pi})" ${pairs.length <= 2 ? 'disabled' : ''} title="Remove pair" aria-label="Remove pair ${pi + 1}"><i data-lucide="x"></i></button>
        </div>`).join('')}
      <div class="nbq-choice-foot">
        <button type="button" class="nbq-add-line" onclick="nbqAddPair(${i}, true)"><i data-lucide="plus"></i> Add pair</button>
        <span>Each row is a right pair. Students see the right column shuffled.</span>
      </div>
    </div>`;
}

function _nbqCardHtml(d, i, n) {
  const ok = nbqHasAnswer(d);
  const img = String(d.image || '').trim();
  return `
    <div class="nbq-card${ok ? '' : ' needs-answer'}" id="nbq-card-${i}">
      <div class="nbq-card-head">
        <span class="nbq-num">${i + 1}</span>
        <select class="form-select nbq-type" onchange="nbqChangeType(${i}, this.value)" aria-label="Type of question ${i + 1}">
          ${NBQ_TYPES.map(t => `<option value="${t}" ${d.type === t ? 'selected' : ''}>${NBQ_TYPE_LABEL[t]}</option>`).join('')}
        </select>
        <span class="nbq-status ${ok ? 'is-ok' : 'is-bad'}" id="nbq-status-${i}">${_nbqStatusHtml(d)}</span>
        <div class="nbq-tools">
          <button type="button" class="nbq-tool" onclick="nbqMove(${i}, -1)" ${i === 0 ? 'disabled' : ''} title="Move up" aria-label="Move question ${i + 1} up"><i data-lucide="arrow-up"></i></button>
          <button type="button" class="nbq-tool" onclick="nbqMove(${i}, 1)" ${i === n - 1 ? 'disabled' : ''} title="Move down" aria-label="Move question ${i + 1} down"><i data-lucide="arrow-down"></i></button>
          <button type="button" class="nbq-tool" onclick="nbqDuplicate(${i})" title="Duplicate" aria-label="Duplicate question ${i + 1}"><i data-lucide="copy"></i></button>
          <button type="button" class="nbq-tool is-danger" onclick="nbqDelete(${i})" title="Delete" aria-label="Delete question ${i + 1}"><i data-lucide="trash-2"></i></button>
        </div>
      </div>
      <textarea id="nbq-q-${i}" class="form-textarea af-grow nbq-text" rows="2" placeholder="Question ${i + 1}"
                oninput="nbqSet(${i}, 'question', this.value)">${escapeHTML(d.question || '')}</textarea>
      ${_nbqBodyHtml(d, i)}
      <div class="nbq-extras">
        <label class="nbq-extra nbq-extra-wide">
          <span>Explanation</span>
          <textarea id="nbq-exp-${i}" class="form-textarea af-grow" rows="1" placeholder="Shown after answering (optional)"
                    oninput="nbqSet(${i}, 'explanation', this.value)">${escapeHTML(d.explanation || '')}</textarea>
        </label>
        <label class="nbq-extra">
          <span>Hint</span>
          <input id="nbq-hint-${i}" class="form-input" value="${escapeHTML(d.hint || '')}" placeholder="Optional" oninput="nbqSet(${i}, 'hint', this.value)" />
        </label>
        <div class="nbq-extra nbq-image">
          <span>Image</span>
          ${img ? `
            <div class="nbq-image-set">
              <img src="${escapeHTML(mediaSrc(img, 'thumb'))}" alt="" />
              <button type="button" class="btn btn-ghost btn-sm" onclick="document.getElementById('nbq-file-${i}').click()">Replace</button>
              <button type="button" class="btn btn-ghost btn-sm nbq-image-remove" onclick="nbqClearImage(${i})">Remove</button>
            </div>` : `
            <div class="nbq-image-add">
              <input class="form-input" placeholder="Paste an image URL" onchange="nbqSetImageUrl(${i}, this.value)" aria-label="Image URL for question ${i + 1}" />
              <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('nbq-file-${i}').click()"><i data-lucide="upload"></i> Upload</button>
            </div>`}
          <input type="file" id="nbq-file-${i}" accept="image/*" class="hidden" onchange="nbqUploadImage(${i}, this)" />
        </div>
      </div>
    </div>`;
}

function nbqRender() {
  const host = document.getElementById('given-question-content');
  if (!host) return;
  const n = nbqDraft.length;
  const quick = [['mcq', 'Multiple choice'], ['checkbox', 'Multi-select'], ['truefalse', 'True / False'], ['text', 'Identification'], ['matching', 'Matching']];
  host.innerHTML = `
    <div class="nb-qmodal-cols nbq-cols">
      <div class="nb-qmodal-main nbq-main">
        <div class="nbq-bar"><span id="nbq-summary"></span>
          ${nbqUndoState ? `<button type="button" class="btn btn-ghost btn-sm nbq-undo" onclick="nbqUndo()"><i data-lucide="undo-2"></i> Undo: ${escapeHTML(nbqUndoState.label)}</button>` : ''}
        </div>
        <div class="nbq-list">
          ${n ? nbqDraft.map((d, i) => _nbqCardHtml(d, i, n)).join('') : `
            <div class="nbq-empty">
              <i data-lucide="clipboard-paste"></i>
              <strong>No questions in this section yet</strong>
              <span>Paste them into the box on the right, or start one from Add a question.</span>
            </div>`}
        </div>
        ${n ? `<div class="nbq-add-row">${quick.map(([t, label]) => `<button type="button" class="btn btn-secondary btn-sm" onclick="nbqAdd('${t}')"><i data-lucide="plus"></i> ${label}</button>`).join('')}</div>` : ''}
      </div>
      <div class="nb-qmodal-side nbq-side">
        <section class="nbq-panel">
          <h4>Add a question</h4>
          <div class="nbq-quick">${quick.map(([t, label]) => `<button type="button" class="btn btn-secondary btn-sm" onclick="nbqAdd('${t}')">${label}</button>`).join('')}</div>
        </section>
        <section class="nbq-panel">
          <h4>Paste questions
            <button type="button" onclick="nbCopyFormat('given')" class="nb-fmt-btn" title="Copy the format: hand it to an AI and paste its reply here" aria-label="Copy the question format"><i data-lucide="clipboard-copy"></i></button>
          </h4>
          <textarea id="nbq-paste" class="form-textarea nbq-mono" rows="7" spellcheck="false"
                    placeholder="${escapeHTML(typeof _nbImportExample === 'function' ? _nbImportExample() : '')}"></textarea>
          <button type="button" class="btn btn-primary btn-sm nbq-panel-btn" onclick="nbqPasteQuestions()"><i data-lucide="plus"></i> Add to the end</button>
          <div id="gq-parse-report"></div>
        </section>
        <section class="nbq-panel">
          <h4>Paste an answer key
            <button type="button" onclick="nbCopyFormat('answer')" class="nb-fmt-btn" title="Copy the answer key format" aria-label="Copy the answer key format"><i data-lucide="clipboard-copy"></i></button>
          </h4>
          <textarea id="nbq-keys" class="form-textarea nbq-mono" rows="5" spellcheck="false"
                    placeholder="1. B&#10;2. A, C&#10;3. True&#10;4. stdio.h&#10;Explanation: printf lives there."></textarea>
          <button type="button" class="btn btn-secondary btn-sm nbq-panel-btn" onclick="nbqPasteAnswers()"><i data-lucide="key"></i> Fill in answers</button>
          <div id="nbq-keys-report"></div>
        </section>
        ${n ? `<section class="nbq-panel nbq-panel-quiet">
          <button type="button" class="btn btn-ghost btn-sm nbq-clear" onclick="nbqClearAll()"><i data-lucide="trash-2"></i> Delete all questions</button>
        </section>` : ''}
      </div>
    </div>`;
  if (typeof lucide !== 'undefined') lucide.createIcons({ el: host });
  nbqPaintSummary();
  _nbqAutosize(host, 0);
}

/* Sizes the growing boxes once the window has its real width. Measured while
   it was still opening, a box read as hundreds of wrapped lines and grew to
   its 420px cap. */
function _nbqAutosize(host, tries) {
  setTimeout(() => {
    if (!host.isConnected || typeof afAutosizeAll !== 'function') return;
    const list = host.querySelector('.nbq-list');
    if ((!list || list.clientWidth < 240) && tries < 8) { _nbqAutosize(host, tries + 1); return; }
    afAutosizeAll(host);
  }, tries ? 80 : 0);
}

/* ---- Paste boxes ---- */
function nbqPasteQuestions() {
  const ta = document.getElementById('nbq-paste');
  const text = ta ? ta.value : '';
  if (!text.trim()) { ta?.focus(); return; }
  const { questions, skipped } = nbParseImport(text);
  if (!questions.length) {
    if (typeof toast === 'function') toast('No questions found in that text.', { type: 'warning' });
    return;
  }
  const report = nbImportReport(questions, skipped);
  nbqUndoState = { label: questions.length + ' pasted', draft: JSON.parse(JSON.stringify(nbqDraft)) };
  // Blank placeholders (from a count or Bulk Add) give way to real questions.
  const keep = nbqDraft.filter(d => !(typeof nbIsBlankQuestion === 'function' && nbIsBlankQuestion(d)));
  const added = questions.map(p => nbApplyTypeDefaults({
    qNum: 0, type: p.type, question: p.question || '', choices: p.choices || {}, answer: p.answer,
    explanation: p.explanation || '', hint: p.hint || '', image: p.image || '', pairs: p.pairs || []
  }));
  nbqDraft = keep.concat(added).slice(0, NB_MAX_QUESTIONS);
  if (ta) ta.value = '';
  nbqRender();
  _showParseReport(report);
  const first = document.getElementById(`nbq-card-${keep.length}`);
  if (first) first.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** Paints nbImportReport's result under the question paste box. */
function _showParseReport(rep) {
  const reportEl = document.getElementById('gq-parse-report');
  if (!reportEl || !rep) return;
  const ok = rep.problems.length === 0;
  reportEl.innerHTML = `
    <div class="nb-parse-report ${ok ? 'is-ok' : 'is-warn'}">
      <div class="nb-parse-head">
        <i data-lucide="${ok ? 'check-circle' : 'alert-triangle'}" style="width:16px;height:16px;"></i>
        <strong>${rep.total} question${rep.total !== 1 ? 's' : ''} added</strong>
      </div>
      <div class="nb-parse-sub">${escapeHTML(rep.parts.join(', '))}${rep.skipped.length ? ` · ${rep.skipped.length} line${rep.skipped.length !== 1 ? 's' : ''} left out` : ''}</div>
      ${rep.problems.length ? `<ul class="nb-parse-problems">${rep.problems.map(x => `<li>${escapeHTML(x)}</li>`).join('')}</ul>` : ''}
    </div>`;
  if (typeof lucide !== 'undefined') lucide.createIcons({ el: reportEl });
}

/* Fuzzy match of a written-out answer to a choice's text. */
function _akTextSimilarity(input, choiceText) {
  const a = String(input || '').toLowerCase().trim();
  const b = String(choiceText || '').toLowerCase().trim();
  if (!a || !b) return 0;
  if (a === b) return 1.0;
  if (b.includes(a)) return 0.9;
  if (a.includes(b)) return 0.85;
  const wordsA = a.split(/\s+/).filter(w => w.length > 1);
  const wordsB = b.split(/\s+/).filter(w => w.length > 1);
  if (wordsA.length > 0 && wordsB.length > 0) {
    const matched = wordsA.filter(wa => wordsB.some(wb => wb === wa || wb.includes(wa) || wa.includes(wb)));
    if (matched.length > 0) return matched.length / Math.max(wordsA.length, 1) * 0.8;
  }
  const m = a.length, n = b.length;
  let prev = new Array(n + 1).fill(0), curr = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) curr[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], curr[j - 1]);
    [prev, curr] = [curr, prev]; curr.fill(0);
  }
  return (2 * prev[n]) / (m + n);
}

/**
 * One line of an answer key applied to one question. Returns '' when it took,
 * or a short reason when it did not.
 */
function _nbqApplyAnswer(d, raw) {
  const t = d.type || 'mcq';
  const v = String(raw || '').trim();
  if (!v) return 'empty';
  if (t === 'matching') {
    const m = v.match(/^(.+?)\s*(?:->|→|=>)\s*(.+)$/);
    if (!m) return 'not a "term -> match" pair';
    if (!d._keyPairs) d._keyPairs = [];
    d._keyPairs.push({ left: m[1].trim(), right: m[2].trim() });
    return '';
  }
  if (t === 'text') { d.answer = v; return ''; }
  if (t === 'truefalse') {
    const r = _resolveBulkAnswer(v, d.choices, 'truefalse');
    if (r.unresolved || !r.answer) return 'not True or False';
    d.answer = r.answer;
    return '';
  }
  // A blank choice question answered with a word becomes identification:
  // there is nothing to pick the word from.
  const hasChoiceText = Object.values(d.choices || {}).some(x => String(x || '').trim());
  const looksLikeLetters = /^\(?[A-Ha-h]\)?(?:\s*(?:,|&|and|\+)\s*\(?[A-Ha-h]\)?)*\.?$/i.test(v);
  if (!hasChoiceText && !looksLikeLetters) { d.type = 'text'; nbApplyTypeDefaults(d); d.answer = v; return ''; }
  const multi = t === 'checkbox' || (looksLikeLetters && /,|&|\band\b|\+/i.test(v));
  if (multi && t === 'mcq') { d.type = 'checkbox'; nbApplyTypeDefaults(d); }
  const r = _resolveBulkAnswer(v, d.choices, d.type);
  const got = Array.isArray(r.answer) ? r.answer.length : !!r.answer;
  if (got) { d.answer = r.answer; return ''; }
  // Last try: the closest choice text.
  let best = null, score = 0;
  Object.entries(d.choices || {}).forEach(([L, text]) => {
    const s = _akTextSimilarity(v, text);
    if (s > score) { score = s; best = L; }
  });
  if (best && score >= 0.4) { d.answer = d.type === 'checkbox' ? [best] : best; return ''; }
  return 'matches no choice';
}

function nbqPasteAnswers() {
  const ta = document.getElementById('nbq-keys');
  const out = document.getElementById('nbq-keys-report');
  const text = ta ? ta.value : '';
  if (!text.trim()) { ta?.focus(); return; }
  if (!nbqDraft.length) {
    if (out) out.innerHTML = '<div class="nb-parse-report is-warn"><div class="nb-parse-sub">Add the questions first; the key fills in their answers.</div></div>';
    return;
  }
  const before = JSON.parse(JSON.stringify(nbqDraft));
  let auto = 1, last = null, applied = 0;
  const missing = [], failed = [];
  const touched = new Set();
  nbCleanImportText(text).split('\n').forEach(line => {
    const t = line.trim();
    if (!t) return;
    const exp = t.match(/^(?:explanation|explain|exp|why)\s*[:=\-–—]\s*(.+)$/i);
    if (exp) { if (last && nbqDraft[last - 1]) nbqDraft[last - 1].explanation = exp[1].trim(); return; }
    const num = t.match(/^(?:Q(?:uestion)?\s*)?(\d{1,3})\s*[.):=\-–—]?\s+(.+)$/i) || t.match(/^(\d{1,3})\s*[.):=]\s*(.+)$/);
    let q, raw;
    if (num) { q = parseInt(num[1], 10); raw = num[2]; }
    else if (last && nbqDraft[last - 1] && nbqDraft[last - 1].type === 'matching' && /(?:->|→|=>)/.test(t)) { q = last; raw = t; }
    else { q = auto; raw = t; }
    raw = raw.replace(/^(?:answer|ans)\s*[:=\-–—]\s*/i, '');
    auto = q + 1;
    last = q;
    const d = nbqDraft[q - 1];
    if (!d) { missing.push(q); return; }
    const why = _nbqApplyAnswer(d, raw);
    if (why) failed.push('Q' + q + ' (' + why + ')');
    else { applied++; touched.add(q - 1); }
  });
  // Matching pairs from a key replace the question's pairs as a whole.
  nbqDraft.forEach(d => { if (d._keyPairs) { if (d._keyPairs.length >= 2) d.pairs = d._keyPairs; delete d._keyPairs; } });
  if (applied) nbqUndoState = { label: 'answers filled in', draft: before };
  nbqRerender();
  const outNow = document.getElementById('nbq-keys-report');
  if (outNow) {
    const probs = [];
    if (missing.length) probs.push(`no question ${[...new Set(missing)].slice(0, 6).map(n => 'Q' + n).join(', ')} in this section`);
    if (failed.length) probs.push(failed.slice(0, 5).join(', '));
    outNow.innerHTML = `<div class="nb-parse-report ${probs.length ? 'is-warn' : 'is-ok'}">
      <div class="nb-parse-head"><strong>${applied} answer${applied !== 1 ? 's' : ''} filled in</strong></div>
      ${probs.length ? `<ul class="nb-parse-problems">${probs.map(p => `<li>${escapeHTML(p)}</li>`).join('')}</ul>` : ''}
    </div>`;
  }
  if (applied && ta) ta.value = '';
}
