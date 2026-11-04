/* ============================================================
   NOTEBOOK-IMPORT.JS — turns pasted text into notebook questions
   ------------------------------------------------------------
   No DOM in here, on purpose. The Import Questions window and the paste box
   in Edit Questions both call it, and tools/test-notebook-import.js runs it
   in Node. It used to live in the middle of admin-notebooks.js, between two
   modals.

   Three steps:
     nbCleanImportText     strips what an AI reply wraps around the questions
                           (code fences, **bold** labels, "- " bullets)
     _tokenizeBulkInput    says what each line is
     _assembleBulkQuestions  builds questions from those tokens

   nbParseImport does all three and also returns the lines it threw away, so
   the Import window can show them instead of dropping them silently.
   ============================================================ */

const _NBI_HEADER_KW = /^(part|section|test|directions?|instructions?|items?|for items|note)\b/i;
const _NBI_ROMAN = /^[IVX]+\.\s+/;
const _NBI_ALLCAPS = /^[A-Z][A-Z\s]{2,}:\s*$/;
const _NBI_SECTION_NAMES = ['multiple choice', 'true or false', 'identification', 'matching', 'essay', 'reading comprehension', 'enumeration', 'problem solving', 'fill in the blank', 'true/false'];

/* Words that open the label lines. Kept in one place so the cleaner and the
   tokenizer agree on what "Answer:" can look like. */
const _NBI_ANSWER_RE = /^(?:the\s+)?(?:correct\s+answers?|right\s+answers?|answers?|ans|correct)\s*[:=\-–—]\s*(.+)$/i;
const _NBI_ANSWER_IS_RE = /^(?:the\s+)?(?:correct\s+)?answer\s+is\s*[:\-–—]?\s*(.+)$/i;
const _NBI_EXPLAIN_RE = /^(?:explanation|explain|exp|why|reason|rationale)\s*[:=\-–—]\s*(.+)$/i;
const _NBI_HINT_RE = /^(?:hint|clue)\s*[:=\-–—]\s*(.+)$/i;

/**
 * One line of an AI reply, with the formatting it added taken off.
 * Only touches the start of the line and the value after a label, so C in the
 * question text ("int **pp") is left alone.
 */
function nbCleanImportLine(line) {
  let t = String(line == null ? '' : line).replace(/\s+$/, '');
  if (/^\s*(```|~~~)/.test(t)) return '';                    // code fence
  t = t.replace(/^\s*>\s?/, '');                              // > quoted
  t = t.replace(/^(\s*)#{1,6}\s+/, '$1');                     // ### heading
  // "- A) text", "• B. text": a bullet in front of a choice letter.
  t = t.replace(/^(\s*)[-•–]\s+(?=\*?\(?[A-Ha-h][.):\]]\s)/, '$1');
  // "- Answer: B", "* Hint: ...": a bullet in front of a label.
  t = t.replace(/^(\s*)[-•–*]\s+(?=(?:\*\*|__)?(?:the\s+)?(?:correct\s+answer|right\s+answer|answer|ans|explanation|explain|hint|why|reason)\b)/i, '$1');
  // "**B. printf()**": a whole choice in bold is how a model marks the right
  // one, so it becomes the * marker. An Answer: line still overrides it, and
  // if every choice is bold the assembler ignores the stars.
  t = t.replace(/^(\s*)(\*\*|__)(\(?[A-Ha-h][.):\]]\s+.+?)\2\s*$/, '$1*$3');
  // "**1.** What", "**Answer:** B", "**What is X?**": bold or underline at the start.
  t = t.replace(/^(\s*)(\*\*|__)(.+?)\2/, '$1$3');
  // "*Answer:* B", "_Hint:_ x": italic label.
  t = t.replace(/^(\s*)([*_])([A-Za-z][^*_]{0,30}?:)\2/, '$1$3');
  // "Answer: **B**": bold value after a label.
  t = t.replace(/^(\s*(?:the\s+)?(?:correct\s+answers?|answers?|ans|explanation|hint)\s*[:=\-–—]\s*)(\*\*|__)(.+?)\2\s*$/i, '$1$3');
  return t;
}

/** The whole paste, cleaned line by line. */
function nbCleanImportText(text) {
  return String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n').map(nbCleanImportLine).join('\n');
}

function _isHeaderLine(text, hasActiveQ, seenNumQ) {
  // A line that asks something is a question, whatever word it opens with:
  // "Section 2 of the standard covers what?" is not a header.
  const asks = /\?\s*(\[[^\]]*\])?\s*$/.test(text);
  if (!asks && _NBI_HEADER_KW.test(text)) return true;
  if (_NBI_ROMAN.test(text)) return true;
  if (/^#{1,3}\s+/.test(text)) return true;
  if (_NBI_ALLCAPS.test(text)) return true;
  if (/^[-=_*]{3,}$/.test(text)) return true;
  // "--- 1. MULTIPLE CHOICE ---": a separator with words in it. An AI copies
  // these out of a format's examples, and each one became a junk question.
  if (/^[-=]{2,}.*[-=]{2,}$/.test(text)) return true;
  // Context-aware: "A. Reading Comprehension" before any question = header
  if (!hasActiveQ) {
    const m = text.match(/^([A-Za-z])[.)]\s+(.+)$/);
    if (m) {
      const content = m[2].toLowerCase();
      if (_NBI_SECTION_NAMES.some(kw => content.includes(kw))) return true;
      if (!seenNumQ && /^[A-E]$/i.test(m[1]) && m[2].split(/\s+/).length <= 3) return true;
    }
  }
  return false;
}

function _extractAnswerMarker(text) {
  let c = text.replace(/\s*\((?:correct(?:\s+answer)?|answer|right)\)\s*$/i, '');
  if (c !== text) return { text: c.trim(), isCorrect: true };
  c = text.replace(/\s*\[(?:correct(?:\s+answer)?|answer|right)\]\s*$/i, '');
  if (c !== text) return { text: c.trim(), isCorrect: true };
  c = text.replace(/\s*(?:[✓✔✅]|←\s*correct)\s*$/i, '');
  if (c !== text) return { text: c.trim(), isCorrect: true };
  if (text.length > 1) {
    c = text.replace(/\s*\*\s*$/, '');
    if (c !== text) return { text: c.trim(), isCorrect: true };
  }
  return { text, isCorrect: false };
}

/* Phase 1 — Tokenize: classify each line */
function _tokenizeBulkInput(text) {
  const lines = String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n');
  const tokens = [];
  let hasActiveQ = false, seenNumQ = false, afterBlank = false, choicesStarted = false;
  // "Question 3" alone on a line: its text is the next line that has any.
  let pendingNum = null;

  for (const raw of lines) {
    const t = raw.trim();

    // 1. BLANK
    if (!t) { tokens.push({ type: 'blank' }); afterBlank = true; continue; }

    if (pendingNum != null) {
      const tagged = _extractTypeTag(t);
      const inline = _splitInlineChoices(tagged.text);
      tokens.push({ type: 'question', qNum: pendingNum, text: inline.text, forcedType: tagged.type });
      inline.choices.forEach(c => tokens.push({ type: 'choice', letter: c.letter, text: c.text, isCorrect: c.isCorrect }));
      pendingNum = null;
      hasActiveQ = true; seenNumQ = true; afterBlank = false; choicesStarted = inline.choices.length > 0;
      continue;
    }

    // 2. HEADER
    if (_isHeaderLine(t, hasActiveQ, seenNumQ)) {
      tokens.push({ type: 'header', text: t }); continue;
    }

    // 2b. STANDALONE ANSWER MARKER: "*A" or "*A, C" on its own line.
    const starM = t.match(/^\*\s*([A-Za-z](?:\s*[,&+]\s*[A-Za-z])*)\s*$/);
    if (starM) { tokens.push({ type: 'answer', text: starM[1].trim() }); choicesStarted = true; continue; }

    // 3. ANSWER LINE: "Answer: X", "Correct answer - X", "The answer is X"
    const ansM = t.match(_NBI_ANSWER_RE) || t.match(_NBI_ANSWER_IS_RE);
    if (ansM && hasActiveQ) {
      tokens.push({ type: 'answer', text: ansM[1].trim() });
      // The question is closed: a line after its answer is never more of it.
      choicesStarted = true; afterBlank = false;
      continue;
    }

    // 3b. EXPLANATION / HINT LINES
    const expM = t.match(_NBI_EXPLAIN_RE);
    if (expM && hasActiveQ) { tokens.push({ type: 'explanation', text: expM[1].trim() }); choicesStarted = true; continue; }
    const hintM = t.match(_NBI_HINT_RE);
    if (hintM && hasActiveQ) { tokens.push({ type: 'hint', text: hintM[1].trim() }); choicesStarted = true; continue; }

    // 4. QUESTION LINE: "1. text", "Q1. text", "Question 1: text", "Item 1 - text".
    //    Plain numbers need a space after the dot, so "1.5 is a float" is not one.
    const qM = t.match(/^[Qq]?(\d{1,3})[.)=:]\s+(.+)$/) ||
               t.match(/^(?:Q|Question|Item|No\.?)\s*#?\s*(\d{1,3})\s*[.):=\-–—]?\s+(.+)$/i);
    if (qM && qM[2].trim()) {
      hasActiveQ = true; seenNumQ = true; afterBlank = false; choicesStarted = false;
      // A trailing [MCQ] / [T/F] / [Match] / [Ident] / [Multi] settles the type
      // instead of leaving it to be guessed from the shape of what follows.
      const tagged = _extractTypeTag(qM[2].trim());
      // "1. Pick a colour?  A. red  B. blue" — all on one line, which a compact
      // paste often produces. Split the choices off the prompt.
      const inline = _splitInlineChoices(tagged.text);
      tokens.push({ type: 'question', qNum: parseInt(qM[1], 10), text: inline.text, forcedType: tagged.type });
      inline.choices.forEach(c => tokens.push({ type: 'choice', letter: c.letter, text: c.text, isCorrect: c.isCorrect }));
      if (inline.choices.length) choicesStarted = true;
      continue;
    }
    const qOnly = t.match(/^(?:Q|Question|Item)\s*#?\s*(\d{1,3})\s*[.):=\-–—]?\s*$/i);
    if (qOnly) { pendingNum = parseInt(qOnly[1], 10); continue; }

    // 5a. TAB-SEPARATED PAIR — what you get pasting two columns out of a
    //     spreadsheet or a table, which was previously read as prose.
    if (t.includes('\t')) {
      const cells = t.split('\t').map(c => c.trim()).filter(Boolean);
      if (cells.length === 2) {
        tokens.push({ type: 'pair', left: cells[0], right: cells[1] });
        hasActiveQ = true; choicesStarted = true; continue;
      }
    }

    // 5. MATCHING PAIR: "term -> definition"
    const pairM = t.match(/^(?:[A-Za-z][.)]\s+)?(.+?)\s*(?:->|→|=>)\s*(.+)$/);
    if (pairM && pairM[1].trim().length > 0 && pairM[2].trim().length > 0) {
      tokens.push({ type: 'pair', left: pairM[1].trim(), right: pairM[2].trim() });
      hasActiveQ = true; choicesStarted = true; continue;
    }

    // 6. CHOICE LINE (only inside a question block)
    if (hasActiveQ) {
      let star = false, ct = t;
      if (/^\*\s*/.test(ct)) { star = true; ct = ct.replace(/^\*\s*/, ''); }

      // (A) text
      const cpM = ct.match(/^\(([A-Za-z])\)\s+(.+)$/);
      if (cpM) {
        const { text: cleaned, isCorrect } = _extractAnswerMarker(cpM[2].trim());
        tokens.push({ type: 'choice', letter: cpM[1].toUpperCase(), text: cleaned, isCorrect: isCorrect || star, starred: star });
        choicesStarted = true; afterBlank = false; continue;
      }
      // A. text | A) text | A: text | A] text
      const clM = ct.match(/^([A-Za-z])[.):\]]\s+(.+)$/);
      if (clM) {
        const { text: cleaned, isCorrect } = _extractAnswerMarker(clM[2].trim());
        tokens.push({ type: 'choice', letter: clM[1].toUpperCase(), text: cleaned, isCorrect: isCorrect || star, starred: star });
        choicesStarted = true; afterBlank = false; continue;
      }
      // Bullet: - text, • text, and "* text" — a Markdown bullet, which is
      // not the * correct-marker when nothing like "A." follows it.
      const blM = ct.match(/^[-•]\s+(.+)$/) || (star && /^\*\s/.test(t) ? [t, ct] : null);
      if (blM) {
        tokens.push({ type: 'bullet', text: blM[1].trim() });
        choicesStarted = true; afterBlank = false; continue;
      }
    }

    // 7. CONTINUATION (inside question, before choices start, not after blank)
    if (hasActiveQ && !choicesStarted && !afterBlank) {
      tokens.push({ type: 'continuation', text: t }); continue;
    }

    // 8. UNKNOWN — an unnumbered question line. It opens a block like a
    //    numbered one does; without this, the "A." / "B." lines beneath it were
    //    not treated as choices at all and the question came out as free text.
    const taggedU = _extractTypeTag(t);
    const inlineU = _splitInlineChoices(taggedU.text);
    tokens.push({ type: 'unknown', text: inlineU.text, forcedType: taggedU.type });
    inlineU.choices.forEach(c => tokens.push({ type: 'choice', letter: c.letter, text: c.text, isCorrect: c.isCorrect }));
    hasActiveQ = true;
    choicesStarted = inlineU.choices.length > 0;
    afterBlank = false;
  }
  return tokens;
}

/**
 * Pulls choices off a line that carries both the prompt and its options.
 * Only fires on two or more markers running A, B, C… in order, so an ordinary
 * sentence containing "a." or a middle initial is left alone.
 * @returns {{text: string, choices: Array<{letter,text,isCorrect}>}}
 */
function _splitInlineChoices(line) {
  const re = /(?:^|\s)\*?\(?([A-Za-z])\)?[.)]\s+/g;
  const hits = [];
  let m;
  while ((m = re.exec(line)) !== null) {
    hits.push({ letter: m[1].toUpperCase(), start: m.index + (m[0].startsWith(' ') ? 1 : 0), end: re.lastIndex,
                starred: m[0].includes('*') });
  }
  // Must start at A and run consecutively, otherwise this is prose.
  const consecutive = hits.length >= 2 && hits[0].letter === 'A' &&
    hits.every((h, k) => h.letter.charCodeAt(0) === 65 + k);
  if (!consecutive) return { text: line, choices: [] };

  const text = line.slice(0, hits[0].start).trim();
  if (!text) return { text: line, choices: [] };   // the whole line was choices

  const choices = hits.map((h, k) => {
    const stop = k + 1 < hits.length ? hits[k + 1].start : line.length;
    const raw = line.slice(h.end, stop).trim();
    const cleaned = _extractAnswerMarker(raw);
    return { letter: h.letter, text: cleaned.text, isCorrect: cleaned.isCorrect || h.starred };
  }).filter(c => c.text);

  return choices.length >= 2 ? { text, choices } : { text: line, choices: [] };
}

/** Type names a tag may use, longest first so "multiple choice" wins over "multiple". */
const _NBI_TYPE_WORDS = [
  ['multiple choice', 'mcq'], ['single choice', 'mcq'], ['mcq', 'mcq'],
  ['multiple select', 'checkbox'], ['multi-select', 'checkbox'], ['multi select', 'checkbox'],
  ['multiple answers', 'checkbox'], ['multiple answer', 'checkbox'], ['checkbox', 'checkbox'],
  ['multiple', 'checkbox'], ['multi', 'checkbox'],
  ['true or false', 'truefalse'], ['true/false', 'truefalse'], ['true / false', 'truefalse'],
  ['truefalse', 'truefalse'], ['t/f', 'truefalse'], ['tf', 'truefalse'],
  ['matching', 'matching'], ['match', 'matching'],
  ['identification', 'text'], ['ident', 'text'], ['short answer', 'text'],
  ['fill in the blank', 'text'], ['text', 'text']
];

/** Pulls a trailing [MCQ] / [T/F] / [Match] / [Ident] / [Multi] off a question. */
function _extractTypeTag(text) {
  const s = String(text == null ? '' : text);
  // Square brackets take any type name. Round ones only the unmistakable ones:
  // "(text)" at the end of a sentence is too likely to be the sentence.
  const m = s.match(/\s*\[([^\]]{1,24})\]\s*$/) || s.match(/\s*\(((?:mcq|multi(?:ple)?[- ]?(?:select|answers?)?|t\/f|true\s*\/\s*false|true or false|matching|match|ident(?:ification)?))\)\s*$/i);
  if (!m) return { text: s, type: null };
  const raw = m[1].toLowerCase().replace(/\s+/g, ' ').trim();
  const hit = _NBI_TYPE_WORDS.find(([w]) => raw === w);
  if (!hit) return { text: s, type: null };
  return { text: s.slice(0, m.index).trim(), type: hit[1] };
}

/**
 * Turns whatever was written after "Answer:" into something the question can
 * actually hold. Previously only a bare letter worked, so "Answer: B) 4",
 * "Answer: printf()" and "Answer: A and C" all landed as-is and graded nothing.
 * @returns {{answer: string|string[], unresolved: boolean}}
 */
function _resolveBulkAnswer(rawAnswer, choices, type) {
  let raw = String(rawAnswer == null ? '' : rawAnswer).trim();
  if (!raw) return { answer: type === 'checkbox' ? [] : '', unresolved: false };
  const letters = Object.keys(choices || {});

  if (type === 'text') return { answer: raw.replace(/\s*[.;]\s*$/, ''), unresolved: false };

  if (type === 'truefalse') {
    const v = raw.toLowerCase().replace(/[^a-z]/g, '');
    if (['a', 'true', 't', 'yes'].includes(v)) return { answer: 'A', unresolved: false };
    if (['b', 'false', 'f', 'no'].includes(v)) return { answer: 'B', unresolved: false };
    return { answer: '', unresolved: true };
  }

  // "Both A and C", "Options A, C": the words in front are not answers.
  raw = raw.replace(/^(?:both|all of|options?|choices?|letters?)\s+/i, '');
  // Split on comma / "and" / "&" / "+" so multi-answers arrive as a list.
  const parts = raw.split(/\s*(?:,|;|\band\b|&|\+|\/)\s*/i).map(x => x.trim()).filter(Boolean);
  const resolved = [];
  let unresolved = false;

  parts.forEach(part => {
    // "B" or "B) 4" or "(B) 4" — take the leading letter when it names a choice.
    const lead = part.match(/^\(?([A-Za-z])\)?[.):\]]?(?:\s|$)/);
    if (lead && letters.includes(lead[1].toUpperCase())) {
      resolved.push(lead[1].toUpperCase());
      return;
    }
    // A number: 1 -> first choice.
    const num = part.match(/^(\d{1,2})$/);
    if (num) {
      const idx = parseInt(num[1], 10) - 1;
      if (letters[idx]) { resolved.push(letters[idx]); return; }
    }
    // The answer written out as the choice's own text.
    const norm = (x) => String(x || '').trim().toLowerCase().replace(/[.;]+$/, '');
    const hit = letters.find(L => norm(choices[L]) === norm(part));
    if (hit) { resolved.push(hit); return; }
    unresolved = true;
  });

  const unique = [...new Set(resolved)];
  if (type === 'checkbox') return { answer: unique, unresolved: unresolved && !unique.length };
  return { answer: unique[0] || '', unresolved: unresolved && !unique.length };
}

/* Type auto-detection */
function _detectQuestionType(q) {
  if (q.pairs && q.pairs.length >= 2) return 'matching';
  const txt = q.question || '';
  if (/true\s*(or|\/)\s*false/i.test(txt)) return 'truefalse';
  const vals = Object.values(q.choices || {}).map(v => (v || '').toLowerCase().trim());
  if (vals.length === 2 && vals.includes('true') && vals.includes('false')) return 'truefalse';
  if (Array.isArray(q.answer) && q.answer.length > 1) return 'checkbox';
  if (/select all|choose all|multiple correct|pick all|that apply|multiple answers|more than one/i.test(txt)) return 'checkbox';
  if (/(?:choose|select|pick)\s+(?:two|three|four|five|six|seven|eight|nine|ten|\d+)/i.test(txt)) return 'checkbox';
  if (Object.keys(q.choices || {}).length === 0 && (!q.pairs || q.pairs.length < 2)) {
    // A bare True/False answer with no choices is a T/F question.
    const a = String(q._rawAnswer || '').trim().toLowerCase().replace(/[^a-z]/g, '');
    if (a === 'true' || a === 'false') return 'truefalse';
    return 'text';
  }
  return 'mcq';
}

/**
 * Phase 2 — Assemble tokens into question objects.
 * @param {Array} tokens from _tokenizeBulkInput
 * @param {Array} [skipped] receives the text of blocks that were not questions
 */
function _assembleBulkQuestions(tokens, skipped) {
  const questions = [];
  let cur = null, autoQ = 1;

  function finalize() {
    if (!cur) return;
    const nChoices = Object.keys(cur.choices).length;
    const hasPairs = (cur.pairs || []).length > 0;

    // "Sure! Here are 10 questions:" and "Let me know if you want more!" — an
    // AI's opening and closing lines. Unnumbered, nothing to pick, no answer,
    // and not asking anything: that is chatter, not a question. It used to
    // become a question of its own that could never be graded.
    const hasAnswerText = cur._rawAnswer != null && String(cur._rawAnswer).trim() !== '';
    if (cur._unnumbered && !nChoices && !hasPairs && !hasAnswerText && !cur.answer &&
        !/\?\s*$/.test(cur.question || '')) {
      if (skipped && cur.question) skipped.push(cur.question);
      cur = null;
      return;
    }
    if (!cur.question && !nChoices && !hasPairs) { cur = null; return; }

    // Every choice starred is a Markdown bullet list ("* printf()"), not
    // every choice being right.
    if (!hasAnswerText && nChoices >= 3 && cur._starred >= nChoices) cur.answer = '';

    const raw = hasAnswerText ? cur._rawAnswer : cur.answer;

    // Resolve permissively FIRST, so type detection can see that "A and C" is
    // two answers. Detecting first left cur.answer empty and every multi-answer
    // question came out as a single-choice MCQ.
    const probe = _resolveBulkAnswer(raw, cur.choices, 'checkbox');
    cur.answer = probe.answer;

    // An explicit [tag] on the question line beats the guess.
    cur.type = cur.forcedType || _detectQuestionType(cur);
    delete cur.forcedType;
    if (cur.type === 'truefalse') cur.choices = { A: 'True', B: 'False' };

    // Now shape it for the type that was chosen.
    const res = _resolveBulkAnswer(raw, cur.choices, cur.type);
    cur.answer = res.answer;
    if (res.unresolved) cur._unresolvedAnswer = String(raw || '').trim();
    delete cur._rawAnswer;
    delete cur._unnumbered;
    delete cur._starred;
    // Single pair isn't matching — merge back to question text
    if (cur.pairs && cur.pairs.length < 2 && cur.type !== 'matching') {
      cur.pairs.forEach(p => { cur.question += (cur.question ? ' ' : '') + p.left + ' -> ' + p.right; });
      cur.pairs = [];
    }
    questions.push(cur);
    cur = null;
  }

  function startQ(qNum, text, forcedType, unnumbered) {
    finalize();
    cur = { qNum, type: 'mcq', question: text || '', hint: '', answer: '', explanation: '',
            choices: {}, pairs: [], forcedType: forcedType || null, _unnumbered: !!unnumbered, _starred: 0 };
  }

  for (const tok of tokens) {
    switch (tok.type) {
      case 'blank': break;
      case 'header': break;
      case 'question':
        startQ(tok.qNum, tok.text, tok.forcedType, false);
        if (tok.qNum >= autoQ) autoQ = tok.qNum + 1;
        break;
      case 'choice':
        if (!cur) startQ(autoQ++, '', null, false);
        cur.choices[tok.letter] = tok.text;
        if (tok.starred) cur._starred++;
        if (tok.isCorrect) {
          if (!cur.answer) cur.answer = tok.letter;
          else if (typeof cur.answer === 'string') cur.answer = [cur.answer, tok.letter];
          else if (Array.isArray(cur.answer)) cur.answer.push(tok.letter);
        }
        break;
      case 'bullet':
        if (!cur) startQ(autoQ++, '', null, false);
        cur.choices[String.fromCharCode(65 + Object.keys(cur.choices).length)] = tok.text;
        break;
      case 'pair':
        if (!cur) startQ(autoQ++, 'Match the following:', null, false);
        cur.pairs.push({ left: tok.left, right: tok.right });
        break;
      case 'answer':
        // Kept verbatim: finalize() resolves it once the choices are known, so
        // "Answer: printf()" can be matched against the choice text.
        if (cur) cur._rawAnswer = tok.text;
        break;
      case 'explanation':
        if (cur) cur.explanation = cur.explanation ? cur.explanation + ' ' + tok.text : tok.text;
        break;
      case 'hint':
        if (cur) cur.hint = cur.hint ? cur.hint + ' ' + tok.text : tok.text;
        break;
      case 'continuation':
        if (cur) cur.question += (cur.question ? ' ' : '') + tok.text;
        break;
      case 'unknown':
        startQ(autoQ++, tok.text, tok.forcedType, true);
        break;
    }
  }
  finalize();
  return questions;
}

/**
 * The whole import: clean, tokenize, assemble.
 * @returns {{questions: Array, skipped: string[]}}
 */
function nbParseImport(text) {
  const skipped = [];
  const questions = _assembleBulkQuestions(_tokenizeBulkInput(nbCleanImportText(text)), skipped);
  return { questions, skipped };
}

/**
 * What an import found and what will not grade, for the preview line and the
 * report under Edit Questions' paste box.
 */
function nbImportReport(parsed, skipped) {
  const typeLabels = { mcq: 'MCQ', checkbox: 'Multi-select', text: 'Identification', matching: 'Matching', truefalse: 'True/False' };
  const counts = {};
  (parsed || []).forEach(q => { counts[q.type] = (counts[q.type] || 0) + 1; });
  const parts = Object.entries(counts).map(([t, c]) => `${c} ${typeLabels[t] || t}`);

  const hasAns = (q) => Array.isArray(q.answer) ? q.answer.length > 0 : String(q.answer || '').trim() !== '';
  const answers = (parsed || []).filter(hasAns).length;
  const problems = [];
  const noAnswer = (parsed || []).filter(q => !hasAns(q) && q.type !== 'matching');
  if (noAnswer.length) {
    problems.push(`${noAnswer.length} with no answer (${noAnswer.slice(0, 6).map(q => 'Q' + q.qNum).join(', ')}${noAnswer.length > 6 ? '…' : ''})`);
  }
  const unresolved = (parsed || []).filter(q => q._unresolvedAnswer);
  if (unresolved.length) {
    problems.push(`${unresolved.length} answer${unresolved.length !== 1 ? 's' : ''} that match no choice (${unresolved.slice(0, 4).map(q => 'Q' + q.qNum + ': "' + q._unresolvedAnswer + '"').join(', ')})`);
  }
  const fewChoices = (parsed || []).filter(q => (q.type === 'mcq' || q.type === 'checkbox') && Object.keys(q.choices || {}).length < 2);
  if (fewChoices.length) problems.push(`${fewChoices.length} choice question${fewChoices.length !== 1 ? 's' : ''} with fewer than 2 choices`);
  const nums = (parsed || []).map(q => q.qNum);
  const dupes = nums.filter((n, i) => nums.indexOf(n) !== i);
  if (dupes.length) problems.push(`repeated question numbers: ${[...new Set(dupes)].join(', ')}`);
  const halfPairs = (parsed || []).filter(q => q.type === 'matching' && (q.pairs || []).some(pr => !pr.left || !pr.right));
  if (halfPairs.length) problems.push(`${halfPairs.length} matching question${halfPairs.length !== 1 ? 's' : ''} with an incomplete pair`);

  return { total: (parsed || []).length, parts, answers, problems, skipped: skipped || [] };
}

/* ============================================================
   THE FORMAT — one text, for you or for an AI
   ------------------------------------------------------------
   There used to be four (question format, answer key format, a sample block
   and an "AI prompt"). The question format was the one that worked; the AI
   prompt ended in "<N> questions about <TOPIC>", which a model happily
   answered with an intro line, a closing line and markdown, and each of those
   arrived as a question. This is the question format written as instructions,
   with the reply wrapped in a code block so the chat's own Copy button copies
   only the questions.
   ============================================================ */
const NBI_NL = String.fromCharCode(10);

/** The five examples, exactly as the importer reads them. */
function _nbImportExample() {
  return [
    '1. Which function prints formatted output in C? [MCQ]',
    'A. printf()',
    'B. scanf()',
    'C. puts()',
    'D. getchar()',
    'Answer: A',
    'Explanation: printf writes formatted text to standard output.',
    '',
    '2. Which of these are C loop keywords? [Multi]',
    'A. for',
    'B. loop',
    'C. while',
    'D. repeat',
    'Answer: A, C',
    '',
    '3. In C, array indexes start at 0. [T/F]',
    'Answer: True',
    '',
    '4. Which header declares printf? [Ident]',
    'Answer: stdio.h | <stdio.h>',
    'Hint: standard input and output',
    '',
    '5. Match each format specifier to its type. [Match]',
    '%d -> int',
    '%f -> double',
    '%c -> char'
  ].join(NBI_NL);
}

/** The one format: rules a person can follow and a model will. */
function nbImportFormatSpec() {
  return [
    'Write quiz questions that I will paste into StudySession Pro.',
    '',
    'TOPIC: (write the topic here)',
    'HOW MANY: (for example 20)',
    'TYPES: any mix of [MCQ] [Multi] [T/F] [Ident] [Match], or only the ones I name',
    '',
    'HOW TO REPLY',
    'Put every question inside ONE code block, and write nothing before or after it.',
    'Inside the block use plain text only: no **bold**, no # headings, no bullets,',
    'no separator lines.',
    '',
    // Not numbered and not bulleted: a pasted-back copy of these rules must
    // not read as questions or choices.
    'FORMAT RULES',
    'One question per block, with one empty line between blocks.',
    'Number the questions in order and start each one with its number and a period.',
    'End the question line with its type tag: [MCQ] [Multi] [T/F] [Ident] [Match]',
    'Put each choice on its own line, starting with its letter and a period.',
    'Every question except [Match] has an "Answer:" line after its choices.',
    'For [MCQ] the answer is one letter; for [Multi] two or more letters, like A, C.',
    'For [T/F] the answer is True or False.',
    'For [Ident] it is the expected word or phrase; separate other accepted spellings with |.',
    'For [Match] write two or more pair lines like the example below, and no Answer line.',
    'Optional, after the answer: an "Explanation:" line and a "Hint:" line.',
    'Keep every question, choice, answer and explanation on one line.',
    '',
    'EXAMPLE (copy the shape, not the content)',
    '',
    _nbImportExample()
  ].join(NBI_NL);
}

/** For the Answer Key window's paste box: answers only, by number. */
function nbAnswerKeyFormatSpec() {
  return [
    'ANSWER KEY FORMAT (StudySession Pro)',
    '',
    'One line per question, starting with its number. Plain text, no markdown.',
    '',
    '1. B            one correct letter',
    '2. A, C         several letters (multi-select)',
    '3. True         True or False',
    '4. stdio.h      the expected word for an identification question',
    '5. %d -> int    matching: one line per pair, each starting with the number',
    '',
    'An "Explanation: ..." line right after an answer is stored with it.'
  ].join(NBI_NL);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { nbCleanImportText, nbCleanImportLine, nbParseImport, nbImportReport, nbImportFormatSpec,
    nbAnswerKeyFormatSpec, _nbImportExample, _tokenizeBulkInput, _assembleBulkQuestions, _resolveBulkAnswer, _extractTypeTag };
}
