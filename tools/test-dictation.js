/* node tools/test-dictation.js
   Checks dictShape (js/dictation.js): how one heard phrase is fitted to the
   text around the caret -- spacing, capitals, "I", spoken punctuation. */
const path = require('path');
const { dictShape } = require(path.join(__dirname, '..', 'js', 'dictation.js'));

const EN = { punct: true, caps: true, en: true };
const CODE = { punct: true, caps: false, en: false };
const PLAIN = { punct: false, caps: true, en: false };
let fails = 0, n = 0;
function check(label, phrase, before, after, opts, wantText, wantEat) {
  n++;
  const got = dictShape(phrase, before, after, opts);
  const text = got ? got.text : null;
  const eat = got ? got.eat : 0;
  if (text !== wantText || eat !== (wantEat || 0)) {
    fails++;
    console.log('FAIL ' + label + '\n  got  ' + JSON.stringify({ text, eat }) + '\n  want ' + JSON.stringify({ text: wantText, eat: wantEat || 0 }));
  }
}

// Start of the box, and after a sentence: capital.
check('empty box', 'hello world', '', '', EN, 'Hello world');
check('after full stop', 'and then', 'Done.', '', EN, ' And then');
check('after full stop and space', 'and then', 'Done. ', '', EN, 'And then');
check('after question mark', 'yes', 'Ready?', '', EN, ' Yes');
check('after new line', 'next idea', 'First\n', '', EN, 'Next idea');
check('mid sentence: no capital', 'the stack', 'Push it onto', '', EN, ' the stack');
// Spoken punctuation.
check('comma and period', 'first comma second period', '', '', EN, 'First, second.');
check('question mark', 'is it sorted question mark', '', '', EN, 'Is it sorted?');
check('capital after spoken period', 'one period two', '', '', EN, 'One. Two');
check('new line', 'line one new line line two', '', '', EN, 'Line one\nLine two');
check('new paragraph', 'a new paragraph b', '', '', EN, 'A\n\nB');
check('semicolon, not colon', 'x semicolon y', 'Let ', '', EN, 'x; y');
check('colon', 'note colon pointers', '', '', EN, 'Note: pointers');
check('parens', 'call open paren x close paren', '', '', EN, 'Call (x)');
check('"period of" stays a word', 'a period of time', '', '', EN, 'A period of time');
check('phrase is only a comma', 'comma', 'word ', '', EN, ',', 1);
check('phrase is only a period', 'period', 'The end', '', EN, '.');
check('punctuation off', 'one comma two', '', '', PLAIN, 'One comma two');
// "I".
check('i alone', 'i think i can', 'And ', '', EN, 'I think I can');
check("i'm", "i'm sure", 'Well, ', '', EN, "I'm sure");
check('i inside words untouched', 'it is fine', 'Yes ', '', EN, 'it is fine');
// Spacing.
check('no space after open paren', 'value', 'f(', '', EN, 'value');
check('space before following word', 'big', 'A', 'dog', EN, ' big ');
check('nothing before a space after', 'big', 'A', ' dog', EN, ' big');
check('extra spaces collapsed', '  lots   of   space  ', 'Has', '', EN, ' lots of space');
check('nothing left', '   ', 'x', '', EN, null);
// Recogniser that punctuates itself (Edge).
check('already punctuated', 'Hello there. How are you?', '', '', EN, 'Hello there. How are you?');
check('already punctuated, mid text', 'Then it returns.', 'Done.', '', EN, ' Then it returns.');
check('numbers keep their dot', 'pi is 3.14', 'Note:', '', EN, ' pi is 3.14');
// Code notes: no capitals, still spacing.
check('code: no capital', 'return zero', '', '', CODE, 'return zero');
check('code: after semicolon', 'int x', 'int y;', '', CODE, ' int x');
// Other languages: no English rules.
check('filipino: no "I" rule', 'i kaw', 'Sabi ko ', '', { punct: false, caps: true, en: false }, 'i kaw');

console.log((n - fails) + '/' + n + ' dictation checks passed');
process.exit(fails ? 1 : 0);
