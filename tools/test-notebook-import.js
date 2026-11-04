/* Tests for js/notebook-import.js, the notebook question importer.
   Run: node tools/test-notebook-import.js
   Each case is a paste the Import Questions window has to read: the format the
   app hands out, the shapes AI replies come back in, and the older formats. */
const path = require('path');
const NI = require(path.join(__dirname, '..', 'js', 'notebook-import.js'));

let failed = 0, passed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; return; }
  failed++;
  console.log('FAIL  ' + name + (detail ? '\n      ' + detail : ''));
}
const parse = (t) => NI.nbParseImport(t);
const brief = (q) => `${q.qNum}:${q.type}:${JSON.stringify(q.answer)}:${q.question}`;

/* 1. The format the app copies parses into exactly its five examples. */
{
  const { questions: qs, skipped } = parse(NI._nbImportExample());
  check('example: 5 questions', qs.length === 5, qs.map(brief).join(' | '));
  check('example: types', qs.map(q => q.type).join(',') === 'mcq,checkbox,truefalse,text,matching', qs.map(q => q.type).join(','));
  check('example: MCQ answer', qs[0].answer === 'A');
  check('example: explanation kept', /formatted text/.test(qs[0].explanation));
  check('example: multi answer', JSON.stringify(qs[1].answer) === '["A","C"]', JSON.stringify(qs[1].answer));
  check('example: T/F answer', qs[2].answer === 'A');
  check('example: ident answer with alternatives', qs[3].answer === 'stdio.h | <stdio.h>', qs[3].answer);
  check('example: hint kept', qs[3].hint === 'standard input and output');
  check('example: 3 pairs', (qs[4].pairs || []).length === 3);
  check('example: tag stripped', !/\[/.test(qs.map(q => q.question).join(' ')));
  check('example: nothing skipped', skipped.length === 0, skipped.join(' | '));
}

/* 2. The whole spec pasted back in (someone copies it and pastes it straight
      into the box) still only yields the five examples, not its rule lines. */
{
  const { questions: qs } = parse(NI.nbImportFormatSpec());
  check('spec pasted back: 5 questions', qs.length === 5, qs.map(brief).join(' | '));
}

/* 3. A chatty AI reply: intro, code fence, outro. */
{
  const reply = [
    'Sure! Here are 3 questions about C pointers:',
    '',
    '```text',
    '1. What does the & operator return? [MCQ]',
    'A. The value at an address',
    'B. The address of a variable',
    'C. A copy of the variable',
    'Answer: B',
    '',
    '2. A pointer can be NULL. [T/F]',
    'Answer: True',
    'Let me know if you want more!',
    '',
    '3. What keyword frees memory from malloc? [Ident]',
    'Answer: free',
    '```',
    '',
    'I hope these help with your studying.'
  ].join('\n');
  const { questions: qs, skipped } = parse(reply);
  check('chatty: 3 questions', qs.length === 3, qs.map(brief).join(' | '));
  check('chatty: outro not glued onto Q2', qs[1] && !/Let me know/.test(qs[1].question), qs[1] && qs[1].question);
  check('chatty: chatter reported as skipped', skipped.length === 3, JSON.stringify(skipped));
  check('chatty: answers', qs.map(q => q.answer).join(',') === 'B,A,free', qs.map(q => q.answer).join(','));
}

/* 4. Markdown everywhere: bold numbers, bold labels, bullets, headings. */
{
  const md = [
    '## Multiple Choice',
    '',
    '**1.** Which loop always runs at least once?',
    '- A) for',
    '- B) while',
    '- C) do-while',
    '**Answer:** C',
    '**Explanation:** The condition is checked after the body.',
    '',
    '**2. Which header declares malloc?**',
    'A) stdio.h',
    'B) stdlib.h',
    'C) string.h',
    'Answer: **B**'
  ].join('\n');
  const { questions: qs } = parse(md);
  check('markdown: 2 questions', qs.length === 2, qs.map(brief).join(' | '));
  check('markdown: choices read', qs[0] && Object.keys(qs[0].choices).join('') === 'ABC', qs[0] && JSON.stringify(qs[0].choices));
  check('markdown: bold answer label', qs[0] && qs[0].answer === 'C', qs[0] && JSON.stringify(qs[0].answer));
  check('markdown: explanation', qs[0] && /after the body/.test(qs[0].explanation));
  check('markdown: bold answer value', qs[1] && qs[1].answer === 'B', qs[1] && JSON.stringify(qs[1].answer));
  check('markdown: no stray asterisks', !/\*/.test(qs.map(q => q.question).join(' ')), qs.map(q => q.question).join(' | '));
}

/* 5. Separator lines copied from a format's examples are not questions. */
{
  const sep = [
    '--- 1. MULTIPLE CHOICE (one correct) ---',
    '1. Pick the integer type. [MCQ]',
    'A. int', 'B. float', 'Answer: A',
    '',
    '=====',
    '2. Pick the floating type. [MCQ]',
    'A. int', 'B. float', 'Answer: B'
  ].join('\n');
  const { questions: qs } = parse(sep);
  check('separators: 2 questions', qs.length === 2, qs.map(brief).join(' | '));
}

/* 6. The correct choice marked in bold, with no Answer line. */
{
  const bold = ['1. Which is a C keyword?', 'A. function', '**B. struct**', 'C. def', 'D. var'].join('\n');
  const { questions: qs } = parse(bold);
  check('bold choice: answer B', qs[0] && qs[0].answer === 'B', qs[0] && JSON.stringify(qs[0]));
  check('bold choice: text has no marker', qs[0] && qs[0].choices.B === 'struct', qs[0] && qs[0].choices.B);
}

/* 7. Every choice bulleted with "* " is a list, not four right answers. */
{
  const stars = ['1. Which prints text?', '* printf()', '* scanf()', '* malloc()'].join('\n');
  const { questions: qs } = parse(stars);
  check('star bullets: 3 choices', qs[0] && Object.keys(qs[0].choices).length === 3, qs[0] && JSON.stringify(qs[0].choices));
  const starLetters = ['1. Which prints text?', '*A. printf()', '*B. scanf()', '*C. malloc()'].join('\n');
  const q2 = parse(starLetters).questions[0];
  check('all starred letters: no answer', q2 && (q2.answer === '' || (Array.isArray(q2.answer) && !q2.answer.length)), q2 && JSON.stringify(q2.answer));
}

/* 8. Other ways of writing the number and the answer. */
{
  const t = [
    'Question 1',
    'What does sizeof(char) return?',
    'A. 1', 'B. 2', 'C. 4',
    'Correct answer: A',
    '',
    'Q2: Which operator dereferences a pointer?',
    'A. &', 'B. *', 'C. ->',
    'The answer is B',
    '',
    'Question 3: Which function opens a file?',
    'a) fopen', 'b) open', 'c) file',
    'Answer: a) fopen'
  ].join('\n');
  const { questions: qs } = parse(t);
  check('numbering variants: 3 questions', qs.length === 3, qs.map(brief).join(' | '));
  check('"Question 1" on its own line', qs[0] && qs[0].question === 'What does sizeof(char) return?', qs[0] && qs[0].question);
  check('"Correct answer:"', qs[0] && qs[0].answer === 'A', qs[0] && JSON.stringify(qs[0].answer));
  check('"The answer is"', qs[1] && qs[1].answer === 'B', qs[1] && JSON.stringify(qs[1].answer));
  check('lowercase choices', qs[2] && qs[2].answer === 'A', qs[2] && JSON.stringify(qs[2].answer));
}

/* 9. The old Import dialog example keeps working. */
{
  const old = 'Q: Which function prints to stdout in C?\nA) printf()\nB) console.log()\nC) echo()\n*A\nExplanation: printf is the standard C output.\n\nSelect all valid C loop keywords\nA) for\nB) loop\nC) while\nAnswer: A, C\n\nWhat is the capital of France?\nAnswer: Paris\n\nMatch the following:\nCell -> Biology\nAtom -> Chemistry';
  const { questions: qs } = parse(old);
  check('old example: 4 questions', qs.length === 4, qs.map(brief).join(' | '));
  check('old example: types', qs.map(q => q.type).join(',') === 'mcq,checkbox,text,matching', qs.map(q => q.type).join(','));
  check('old example: *A marker', qs[0] && qs[0].answer === 'A');
}

/* 10. C in the question text is not "cleaned". */
{
  const c = ['1. What does int **pp declare? [MCQ]', 'A. a pointer to a pointer to int', 'B. an array of int', 'Answer: A',
             '', '2. What does #include <stdio.h> do? [Ident]', 'Answer: includes the standard I/O header'].join('\n');
  const { questions: qs } = parse(c);
  check('C text: ** kept', qs[0] && qs[0].question === 'What does int **pp declare?', qs[0] && qs[0].question);
  check('C text: #include kept', qs[1] && /^What does #include/.test(qs[1].question), qs[1] && qs[1].question);
}

/* 11. A question that starts with a header word is still a question. */
{
  const { questions: qs } = parse('Section 6.5 of the C standard covers what? [Ident]\nAnswer: expressions');
  check('header word with ?: kept', qs.length === 1, qs.map(brief).join(' | '));
}

/* 12. Type tag spellings. */
{
  const tags = ['[Multiple Choice]', '[True/False]', '[Multi-select]', '[Identification]', '[Matching]', '(T/F)'];
  const want = ['mcq', 'truefalse', 'checkbox', 'text', 'matching', 'truefalse'];
  tags.forEach((tg, i) => {
    const r = NI._extractTypeTag('What is it? ' + tg);
    check('tag ' + tg, r.type === want[i] && r.text === 'What is it?', JSON.stringify(r));
  });
  check('footnote [1] is not a tag', NI._extractTypeTag('See note [1]').type === null);
}

/* 13. The report names what will not grade. */
{
  const { questions: qs, skipped } = parse('1. Pick one. [MCQ]\nA. x\nB. y\n\nHello there:\n\n2. Pick again. [MCQ]\nA. x\nB. y\nAnswer: Z');
  const rep = NI.nbImportReport(qs, skipped);
  check('report: total', rep.total === 2, JSON.stringify(rep));
  check('report: no-answer problem', rep.problems.some(p => /no answer/.test(p)), JSON.stringify(rep.problems));
  check('report: unresolved problem', rep.problems.some(p => /match no choice/.test(p)), JSON.stringify(rep.problems));
  check('report: skipped line', rep.skipped.length === 1 && rep.skipped[0] === 'Hello there:', JSON.stringify(rep.skipped));
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
