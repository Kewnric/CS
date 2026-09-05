/* ============================================================
   CODING-STARTER-CORE.JS — tier 0, the ground the rest stands on
   ------------------------------------------------------------
   The pack used to open with "Say hello" and reach decisions three programs
   later. That is the right ORDER and far too few steps: printing, declaring a
   variable, reading one in and doing arithmetic on it are four separate
   skills, and a course that spends one program on each teaches none of them.

   This is that same beginning, taken slowly. Four folders, each a single idea
   at a time, each program adding exactly one thing to the one before it:

     0.1  putting characters on the screen, and nothing else
     0.2  keeping a value in a box, and what kind of box it is
     0.3  getting a value in from outside
     0.4  doing arithmetic to it -- including the two that surprise everyone,
          integer division and the remainder

   NOTHING HERE USES A CONSTRUCT IT HAS NOT TAUGHT. There is no loop in tier 0
   and no if: a student who has done these forty programs can print, declare,
   read and calculate, which is exactly what folder 1 assumes and never said.

   Every reference is compiled and run against its own tests by
   tools/verify-pack.js.
   ============================================================ */

function codingStarterCore() {
  /* Negative order so the whole tier sorts ahead of "1 · Printing and
     reading", which is where the pack used to begin. */
  const nodes = [
    { id: 'starter-folder-core', type: 'folder', name: '0 · Before you start', parentId: null, scope: 'challenge', order: -10 },
    { id: 'starter-folder-core-out',  type: 'folder', name: '0.1 · Putting it on the screen', parentId: 'starter-folder-core', scope: 'challenge', order: 0 },
    { id: 'starter-folder-core-var',  type: 'folder', name: '0.2 · Variables and types',      parentId: 'starter-folder-core', scope: 'challenge', order: 1 },
    { id: 'starter-folder-core-in',   type: 'folder', name: '0.3 · Reading input',            parentId: 'starter-folder-core', scope: 'challenge', order: 2 },
    { id: 'starter-folder-core-op',   type: 'folder', name: '0.4 · Operators',                parentId: 'starter-folder-core', scope: 'challenge', order: 3 }
  ];

  const challenges = [

    /* ── 0.1 Putting it on the screen ───────────────────────
       printf and nothing else. No variables, no input: the only thing being
       learned is that a program is a list of instructions that run in order,
       and that the text inside the quotes is what comes out. */

    _csProgram('c-print-line', 'core-out', 'One line of text',
      'Print exactly this line:<br><br><code>C is fun.</code><br><br>'
      + 'Every C program starts the same way: <code>#include &lt;stdio.h&gt;</code> to get <code>printf</code>, '
      + 'then <code>int main(void) { ... return 0; }</code> around your instructions.<br><br>'
      + 'The <code>\\n</code> at the end of the text is a NEWLINE. Without it the next thing printed would '
      + 'carry on along the same line.',
      [{ title: 'Sample 1', content: 'Output:\nC is fun.' }],
      [{ name: 'prints the line', stdin: '', expected: 'C is fun.' }],
      ['printf']),

    _csProgram('c-print-two', 'core-out', 'Two lines, two instructions',
      'Print two lines:<br><br><code>Line one</code><br><code>Line two</code><br><br>'
      + 'Use two separate <code>printf</code> calls. They run top to bottom, in the order you wrote them '
      + '— that order IS the program.',
      [{ title: 'Sample 1', content: 'Output:\nLine one\nLine two' }],
      [{ name: 'both lines in order', stdin: '', expected: 'Line one\nLine two' }],
      ['printf']),

    _csProgram('c-print-escape', 'core-out', 'Quotes and backslashes',
      'Print these two lines:<br><br><code>She said "hello" and left.</code><br>'
      + '<code>The path is C:\\Users\\me</code><br><br>'
      + 'Both characters are a problem, and for the same reason: the quote would END your string early, '
      + 'and the backslash is how you say "the next character is special". So you escape them — '
      + '<code>\\"</code> for a quote, <code>\\\\</code> for one backslash.',
      [{ title: 'Sample 1', content: 'Output:\nShe said "hello" and left.\nThe path is C:\\Users\\me' }],
      [{ name: 'both awkward characters', stdin: '',
         expected: 'She said "hello" and left.\nThe path is C:\\Users\\me' }],
      ['printf']),

    _csProgram('c-print-tab', 'core-out', 'Line things up with a tab',
      'Print this little table:<br><br><code>Name&#9;Age</code><br><code>Ann&#9;19</code><br><code>Bo&#9;21</code><br><br>'
      + 'The gaps are TAB characters, written <code>\\t</code>. One tab, not spaces — spaces would not line the '
      + 'columns up when the names are different lengths.',
      [{ title: 'Sample 1', content: 'Output:\nName\tAge\nAnn\t19\nBo\t21' }],
      [{ name: 'three tabbed rows', stdin: '', expected: 'Name\tAge\nAnn\t19\nBo\t21' }],
      ['printf']),

    _csProgram('c-print-int', 'core-out', 'Print a number',
      'Print the number <code>42</code> on its own line.<br><br>'
      + 'A number is not text, so you cannot just put it in the quotes and expect it to be a number. '
      + 'You leave a SLOT for it — <code>%d</code> — and pass the value after the string:<br><br>'
      + '<code>printf("%d\\n", 42);</code><br><br>'
      + '<code>%d</code> means "a whole number goes here".',
      [{ title: 'Sample 1', content: 'Output:\n42' }],
      [{ name: 'prints 42', stdin: '', expected: '42' }],
      ['printf']),

    _csProgram('c-print-two-ints', 'core-out', 'Two numbers in one line',
      'Print exactly:<br><br><code>7 and 9</code><br><br>'
      + 'One <code>printf</code>, two slots. The values are filled in left to right, so the first value '
      + 'goes in the first <code>%d</code>.',
      [{ title: 'Sample 1', content: 'Output:\n7 and 9' }],
      [{ name: 'both slots filled', stdin: '', expected: '7 and 9' }],
      ['printf']),

    _csProgram('c-print-float', 'core-out', 'Print a number with decimals',
      'Print <code>3.14159</code> rounded to TWO decimal places:<br><br><code>3.14</code><br><br>'
      + 'A number with a fractional part uses <code>%f</code>, and <code>%.2f</code> says "two digits after the '
      + 'point". Plain <code>%f</code> would give you <code>3.141590</code> — six digits, which is almost never '
      + 'what you want.',
      [{ title: 'Sample 1', content: 'Output:\n3.14' }],
      [{ name: 'two decimal places', stdin: '', expected: '3.14' }],
      ['printf']),

    _csProgram('c-print-char', 'core-out', 'Print single characters',
      'Print exactly:<br><br><code>C-9</code><br><br>'
      + 'Use three <code>%c</code> slots and pass the three characters <code>\'C\'</code>, <code>\'-\'</code>, '
      + '<code>\'9\'</code>.<br><br>'
      + 'Note the SINGLE quotes. <code>\'9\'</code> is the character nine; <code>9</code> is the number nine; '
      + '<code>"9"</code> is a string. Three different things, and C will let you confuse them.',
      [{ title: 'Sample 1', content: 'Output:\nC-9' }],
      [{ name: 'three characters', stdin: '', expected: 'C-9' }],
      ['printf']),

    _csProgram('c-print-percent', 'core-out', 'Print a percent sign',
      'Print exactly:<br><br><code>Battery: 87%</code><br><br>'
      + 'A single <code>%</code> starts a slot, so printing one literally needs <code>%%</code>. '
      + 'This is the first place C makes you say what you mean twice, and it will not be the last.',
      [{ title: 'Sample 1', content: 'Output:\nBattery: 87%' }],
      [{ name: 'literal percent', stdin: '', expected: 'Battery: 87%' }],
      ['printf']),

    _csProgram('c-print-box', 'core-out', 'Draw a box',
      'Print this box, exactly:<br><br><code>+----+</code><br><code>|    |</code><br><code>+----+</code><br><br>'
      + 'Three <code>printf</code> calls. Nothing new here — this is the folder\'s exam: characters, spaces '
      + 'and newlines, all under your control.',
      [{ title: 'Sample 1', content: 'Output:\n+----+\n|    |\n+----+' }],
      [{ name: 'the box', stdin: '', expected: '+----+\n|    |\n+----+' }],
      ['printf']),

    /* ── 0.2 Variables and types ────────────────────────────
       A value you can name, change, and ask the size of. Still no input:
       one new idea at a time. */

    _csProgram('c-var-int', 'core-var', 'Keep a number in a box',
      'Declare an <code>int</code> called <code>score</code>, put <code>25</code> in it, and print:<br><br>'
      + '<code>score = 25</code><br><br>'
      + 'A variable is a named box big enough for one value of one kind. <code>int score = 25;</code> '
      + 'makes the box, names it, and puts something in it, all at once.',
      [{ title: 'Sample 1', content: 'Output:\nscore = 25' }],
      [{ name: 'declares and prints', stdin: '', expected: 'score = 25' }],
      ['printf']),

    _csProgram('c-var-assign', 'core-var', 'Change what is in the box',
      'Put <code>5</code> in a variable and print it. Then put <code>12</code> in the SAME variable and print '
      + 'it again:<br><br><code>5</code><br><code>12</code><br><br>'
      + 'The second line is not a new variable. <code>=</code> in C does not mean "equals" — it means '
      + '"put the right-hand value into the left-hand box", replacing whatever was there.',
      [{ title: 'Sample 1', content: 'Output:\n5\n12' }],
      [{ name: 'before and after', stdin: '', expected: '5\n12' }],
      ['printf']),

    _csProgram('c-var-float', 'core-var', 'A box for decimals',
      'Declare a <code>float</code> holding <code>19.5</code> and print it to two decimal places:<br><br>'
      + '<code>19.50</code><br><br>'
      + 'An <code>int</code> cannot hold 19.5 — it would keep 19 and throw the rest away without telling you. '
      + 'The kind of box decides what fits.',
      [{ title: 'Sample 1', content: 'Output:\n19.50' }],
      [{ name: 'two decimals', stdin: '', expected: '19.50' }],
      ['printf']),

    _csProgram('c-var-char', 'core-var', 'A box for one character',
      'Declare a <code>char</code> holding <code>\'B\'</code> and print:<br><br><code>Grade: B</code><br><br>'
      + 'A <code>char</code> holds exactly one character. Not a word — one.',
      [{ title: 'Sample 1', content: 'Output:\nGrade: B' }],
      [{ name: 'prints the grade', stdin: '', expected: 'Grade: B' }],
      ['printf']),

    _csProgram('c-var-sizeof', 'core-var', 'How big is each box?',
      'Print the size in bytes of the four basic types:<br><br>'
      + '<code>char: 1</code><br><code>int: 4</code><br><code>float: 4</code><br><code>double: 8</code><br><br>'
      + 'Use <code>sizeof(type)</code>. Print each with <code>%d</code> and a <code>(int)</code> cast in front '
      + 'of the <code>sizeof</code>.<br><br>'
      + 'This is worth doing once by hand because every later bug about arrays and memory comes back to '
      + 'these four numbers.',
      [{ title: 'Sample 1', content: 'Output:\nchar: 1\nint: 4\nfloat: 4\ndouble: 8' }],
      [{ name: 'the four sizes', stdin: '', expected: 'char: 1\nint: 4\nfloat: 4\ndouble: 8' }],
      ['printf']),

    _csProgram('c-var-many', 'core-var', 'Several boxes at once',
      'Declare three <code>int</code>s on ONE line holding 1, 2 and 3, then print:<br><br><code>1 2 3</code>',
      [{ title: 'Sample 1', content: 'Output:\n1 2 3' }],
      [{ name: 'three on one line', stdin: '', expected: '1 2 3' }],
      ['printf']),

    _csProgram('c-var-swap-temp', 'core-var', 'Swap two boxes',
      'Read two whole numbers and print them the other way round:<br><br>'
      + '<code>a = 9, b = 4</code> for the input 4 then 9.<br><br>'
      + 'You cannot write <code>a = b; b = a;</code> — by the time the second line runs, the old <code>a</code> '
      + 'is already gone. You need a THIRD box to hold it. Remember this one: you will meet it again as the '
      + 'first thing pointers are used for.',
      [{ title: 'Sample 1', content: 'Input:\n4\n9\nOutput:\na = 9, b = 4' }],
      [{ name: 'swaps 4 and 9', stdin: '4\n9\n', expected: 'a = 9, b = 4' },
       { name: 'swaps negatives', stdin: '-2\n7\n', expected: 'a = 7, b = -2' }],
      ['printf', 'scanf']),

    _csProgram('c-var-cast', 'core-var', 'Seven divided by two',
      'With <code>a = 7</code> and <code>b = 2</code>, print the division twice:<br><br>'
      + '<code>3</code><br><code>3.50</code><br><br>'
      + 'The first is <code>a / b</code> — two <code>int</code>s divided give an <code>int</code>, and the '
      + 'fraction is DISCARDED, not rounded. The second is <code>(float)a / b</code>, which turns one side '
      + 'into a real number first so the division keeps the half.<br><br>'
      + 'This is the single most common wrong answer in first-year C.',
      [{ title: 'Sample 1', content: 'Output:\n3\n3.50' }],
      [{ name: 'int then real', stdin: '', expected: '3\n3.50' }],
      ['printf']),

    _csProgram('c-var-char-code', 'core-var', 'A character is a number',
      'Read one character and print it with its numeric code:<br><br><code>A is 65</code><br><br>'
      + 'Read it with <code>scanf(" %c", &c)</code> — note the SPACE before <code>%c</code>, which tells '
      + 'scanf to skip over any leftover newline first.<br><br>'
      + 'Then print the same variable twice: once with <code>%c</code> and once with <code>%d</code>. '
      + 'A <code>char</code> really is a small integer; the format is what decides how you see it.',
      [{ title: 'Sample 1', content: 'Input:\nA\nOutput:\nA is 65' }],
      [{ name: 'capital A', stdin: 'A\n', expected: 'A is 65' },
       { name: 'lower case z', stdin: 'z\n', expected: 'z is 122' }],
      ['printf', 'scanf']),

    _csProgram('c-var-const', 'core-var', 'A box you promise not to change',
      'Read a radius as a real number and print the area of that circle to two decimals, using a '
      + '<code>const float PI = 3.14159f;</code>.<br><br>'
      + 'For radius 2: <code>12.57</code><br><br>'
      + '<code>const</code> means the compiler will stop you assigning to it. Naming the constant is worth '
      + 'more than the safety: <code>PI * r * r</code> says what it is, <code>3.14159 * r * r</code> makes '
      + 'the reader work it out.',
      [{ title: 'Sample 1', content: 'Input:\n2\nOutput:\n12.57' }],
      [{ name: 'radius 2', stdin: '2\n', expected: '12.57' },
       { name: 'radius 1.5', stdin: '1.5\n', expected: '7.07' }],
      ['printf', 'scanf']),

    /* ── 0.3 Reading input ──────────────────────────────────
       scanf, and the one thing that trips everyone: & . */

    _csProgram('c-in-int', 'core-in', 'Read one number',
      'Read one whole number and print:<br><br><code>You typed 8</code> (for the input 8)<br><br>'
      + '<code>scanf("%d", &n);</code> — and that <code>&amp;</code> is not decoration. scanf has to CHANGE '
      + 'your variable, so it needs to know where the box is, not what is currently in it. '
      + '<code>&amp;n</code> means "the address of n".<br><br>'
      + 'Leave the <code>&amp;</code> off and the program compiles and then misbehaves. You will do it '
      + 'anyway, once.',
      [{ title: 'Sample 1', content: 'Input:\n8\nOutput:\nYou typed 8' }],
      [{ name: 'reads 8', stdin: '8\n', expected: 'You typed 8' },
       { name: 'reads a negative', stdin: '-15\n', expected: 'You typed -15' }],
      ['printf', 'scanf']),

    _csProgram('c-in-two', 'core-in', 'Read two numbers, one at a time',
      'Read two whole numbers with TWO separate <code>scanf</code> calls, then print them on one line '
      + 'separated by a space:<br><br><code>3 4</code>',
      [{ title: 'Sample 1', content: 'Input:\n3\n4\nOutput:\n3 4' }],
      [{ name: 'reads both', stdin: '3\n4\n', expected: '3 4' }],
      ['printf', 'scanf']),

    _csProgram('c-in-one-call', 'core-in', 'Read two numbers in one call',
      'Read two whole numbers with a SINGLE <code>scanf("%d %d", &a, &b)</code> and print their sum:<br><br>'
      + '<code>sum = 7</code><br><br>'
      + 'One call, two slots, two addresses. It does not care whether the two numbers arrive on the same '
      + 'line or on different lines — whitespace is whitespace to scanf.',
      [{ title: 'Sample 1', content: 'Input:\n3 4\nOutput:\nsum = 7' }],
      [{ name: 'same line', stdin: '3 4\n', expected: 'sum = 7' },
       { name: 'separate lines', stdin: '10\n32\n', expected: 'sum = 42' }],
      ['printf', 'scanf']),

    _csProgram('c-in-float', 'core-in', 'Read a decimal number',
      'Read one real number and print it to THREE decimal places.<br><br>'
      + 'For the input <code>2.5</code>: <code>2.500</code><br><br>'
      + 'Reading a <code>float</code> uses <code>%f</code>. Careful: printing one also uses '
      + '<code>%f</code>, but reading an <code>int</code> and printing it both use <code>%d</code> — the '
      + 'letters are about the TYPE, not about which direction the data is going.',
      [{ title: 'Sample 1', content: 'Input:\n2.5\nOutput:\n2.500' }],
      [{ name: 'two and a half', stdin: '2.5\n', expected: '2.500' },
       { name: 'a third', stdin: '0.125\n', expected: '0.125' }],
      ['printf', 'scanf']),

    _csProgram('c-in-char', 'core-in', 'Read one character',
      'Read a single character and print it inside square brackets:<br><br><code>[k]</code><br><br>'
      + 'Use <code>scanf(" %c", &c)</code>. The leading space matters: without it you can pick up the '
      + 'newline left behind by whatever was typed before.',
      [{ title: 'Sample 1', content: 'Input:\nk\nOutput:\n[k]' }],
      [{ name: 'a letter', stdin: 'k\n', expected: '[k]' },
       { name: 'a digit character', stdin: '7\n', expected: '[7]' }],
      ['printf', 'scanf']),

    _csProgram('c-in-mixed', 'core-in', 'Read two different kinds',
      'Read a whole number and then a real number, and print:<br><br><code>4 then 1.5</code><br><br>'
      + 'One decimal place on the real number. The formats have to match the types in order — swap them '
      + 'and you get nonsense rather than an error.',
      [{ title: 'Sample 1', content: 'Input:\n4 1.5\nOutput:\n4 then 1.5' }],
      [{ name: 'int then float', stdin: '4 1.5\n', expected: '4 then 1.5' },
       { name: 'on two lines', stdin: '10\n0.25\n', expected: '10 then 0.2' }],
      ['printf', 'scanf']),

    _csProgram('c-in-reverse-three', 'core-in', 'Three in, three out backwards',
      'Read three whole numbers and print them in the opposite order, space separated:<br><br>'
      + '<code>3 2 1</code> for the input <code>1 2 3</code>',
      [{ title: 'Sample 1', content: 'Input:\n1 2 3\nOutput:\n3 2 1' }],
      [{ name: 'one two three', stdin: '1 2 3\n', expected: '3 2 1' },
       { name: 'mixed signs', stdin: '-5 0 9\n', expected: '9 0 -5' }],
      ['printf', 'scanf']),

    _csProgram('c-in-sum-avg', 'core-in', 'Sum and average',
      'Read two whole numbers and print both their sum and their average:<br><br>'
      + '<code>sum = 7</code><br><code>avg = 3.5</code><br><br>'
      + 'One decimal place on the average. Watch the division: <code>(a + b) / 2</code> would throw the '
      + 'half away, because both sides are whole numbers. Divide by <code>2.0</code> instead.',
      [{ title: 'Sample 1', content: 'Input:\n3 4\nOutput:\nsum = 7\navg = 3.5' }],
      [{ name: 'three and four', stdin: '3 4\n', expected: 'sum = 7\navg = 3.5' },
       { name: 'even total', stdin: '10 20\n', expected: 'sum = 30\navg = 15.0' }],
      ['printf', 'scanf']),

    /* ── 0.4 Operators ──────────────────────────────────────
       Arithmetic, and the two operators that decide half of everything you
       will write later: / on integers, and % . */

    _csProgram('c-op-five', 'core-op', 'All five operators',
      'Read two whole numbers and print, each on its own line: their sum, difference, product, '
      + 'quotient and remainder.<br><br>'
      + 'For <code>17 5</code>:<br><code>22</code><br><code>12</code><br><code>85</code><br><code>3</code><br>'
      + '<code>2</code><br><br>'
      + 'The last two are the interesting ones. <code>17 / 5</code> is 3, not 3.4 — whole numbers divide '
      + 'into whole numbers. <code>17 % 5</code> is what is left over: 2.',
      [{ title: 'Sample 1', content: 'Input:\n17 5\nOutput:\n22\n12\n85\n3\n2' }],
      [{ name: 'seventeen and five', stdin: '17 5\n', expected: '22\n12\n85\n3\n2' },
       { name: 'divides exactly', stdin: '20 4\n', expected: '24\n16\n80\n5\n0' }],
      ['printf', 'scanf']),

    _csProgram('c-op-intdiv', 'core-op', 'The same division, two ways',
      'Read two whole numbers and print the division as a whole number and then as a real one:<br><br>'
      + '<code>int: 3</code><br><code>real: 3.40</code><br><br>'
      + 'Two decimals on the second. The values are identical — only the TYPE of the division changed, '
      + 'and that changed the answer.',
      [{ title: 'Sample 1', content: 'Input:\n17 5\nOutput:\nint: 3\nreal: 3.40' }],
      [{ name: 'seventeen fifths', stdin: '17 5\n', expected: 'int: 3\nreal: 3.40' },
       { name: 'exact', stdin: '9 3\n', expected: 'int: 3\nreal: 3.00' }],
      ['printf', 'scanf']),

    _csProgram('c-op-last-digit', 'core-op', 'The last digit',
      'Read a whole number and print its last digit.<br><br>'
      + 'For <code>4071</code>: <code>1</code><br><br>'
      + 'Remainder by 10. This one line is the seed of half the number puzzles you will be set — '
      + 'reversing a number, summing its digits, checking a palindrome all start here.',
      [{ title: 'Sample 1', content: 'Input:\n4071\nOutput:\n1' }],
      [{ name: 'four thousand and seventy one', stdin: '4071\n', expected: '1' },
       { name: 'ends in zero', stdin: '500\n', expected: '0' }],
      ['printf', 'scanf']),

    _csProgram('c-op-split-digits', 'core-op', 'Split a three-digit number',
      'Read a three-digit number and print its hundreds, tens and units separated by spaces.<br><br>'
      + 'For <code>472</code>: <code>4 7 2</code><br><br>'
      + 'Division moves digits off the right; remainder keeps them. Getting the middle one needs both.',
      [{ title: 'Sample 1', content: 'Input:\n472\nOutput:\n4 7 2' }],
      [{ name: 'four seven two', stdin: '472\n', expected: '4 7 2' },
       { name: 'with a zero in it', stdin: '905\n', expected: '9 0 5' }],
      ['printf', 'scanf']),

    _csProgram('c-op-precedence', 'core-op', 'Which happens first',
      'Read three whole numbers and print two lines: <code>a + b * c</code>, then '
      + '<code>(a + b) * c</code>.<br><br>'
      + 'For <code>2 3 4</code>:<br><code>14</code><br><code>20</code><br><br>'
      + 'Multiplication binds tighter than addition, so the first is <code>2 + 12</code>. Brackets are how '
      + 'you overrule that — and how you save the next reader from having to remember the table.',
      [{ title: 'Sample 1', content: 'Input:\n2 3 4\nOutput:\n14\n20' }],
      [{ name: 'two three four', stdin: '2 3 4\n', expected: '14\n20' },
       { name: 'with a one', stdin: '5 1 10\n', expected: '15\n60' }],
      ['printf', 'scanf']),

    _csProgram('c-op-compound', 'core-op', 'Change a value in place',
      'Read a whole number, then print it after each of three changes: add 10, then double it, then '
      + 'subtract 5.<br><br>'
      + 'For <code>5</code>:<br><code>15</code><br><code>30</code><br><code>25</code><br><br>'
      + 'Write them as <code>n += 10;</code>, <code>n *= 2;</code>, <code>n -= 5;</code>. '
      + '<code>n += 10</code> is exactly <code>n = n + 10</code>, said shorter.',
      [{ title: 'Sample 1', content: 'Input:\n5\nOutput:\n15\n30\n25' }],
      [{ name: 'from five', stdin: '5\n', expected: '15\n30\n25' },
       { name: 'from zero', stdin: '0\n', expected: '10\n20\n15' }],
      ['printf', 'scanf']),

    _csProgram('c-op-increment', 'core-op', 'Before or after',
      'Starting from <code>int n = 5;</code>, print three lines: <code>n++</code>, then <code>n</code>, '
      + 'then <code>++n</code>.<br><br><code>5</code><br><code>6</code><br><code>7</code><br><br>'
      + '<code>n++</code> hands back the OLD value and then adds one, which is why the first line is 5 and '
      + 'the second is 6. <code>++n</code> adds one first and hands back the new value. Same effect on '
      + '<code>n</code>, different value in the expression.',
      [{ title: 'Sample 1', content: 'Output:\n5\n6\n7' }],
      [{ name: 'post then pre', stdin: '', expected: '5\n6\n7' }],
      ['printf']),

    _csProgram('c-op-avg-three', 'core-op', 'Average of three',
      'Read three whole numbers and print their average to two decimal places.<br><br>'
      + 'For <code>1 2 4</code>: <code>2.33</code><br><br>'
      + 'Divide by <code>3.0</code>, not <code>3</code>. You have now seen this trap three times; that is '
      + 'on purpose.',
      [{ title: 'Sample 1', content: 'Input:\n1 2 4\nOutput:\n2.33' }],
      [{ name: 'one two four', stdin: '1 2 4\n', expected: '2.33' },
       { name: 'exact average', stdin: '10 20 30\n', expected: '20.00' }],
      ['printf', 'scanf']),

    _csProgram('c-op-seconds', 'core-op', 'Seconds into hours',
      'Read a number of seconds and print it as hours, minutes and seconds separated by colons.<br><br>'
      + 'For <code>3671</code>: <code>1:1:11</code><br><br>'
      + 'Both operators, three times over: divide to find how many whole units fit, take the remainder to '
      + 'find what is left for the smaller unit.',
      [{ title: 'Sample 1', content: 'Input:\n3671\nOutput:\n1:1:11' }],
      [{ name: 'an hour and a bit', stdin: '3671\n', expected: '1:1:11' },
       { name: 'under a minute', stdin: '45\n', expected: '0:0:45' },
       { name: 'exactly two hours', stdin: '7200\n', expected: '2:0:0' }],
      ['printf', 'scanf']),

    _csProgram('c-op-swap-math', 'core-op', 'Swap without a third box',
      'Read two whole numbers and print them swapped, WITHOUT using a third variable.<br><br>'
      + 'For <code>4 9</code>: <code>9 4</code><br><br>'
      + 'It can be done with arithmetic alone: add both into one of them, then subtract each back out. '
      + 'Work out on paper what <code>a = a + b; b = a - b; a = a - b;</code> leaves behind.<br><br>'
      + 'A party trick rather than good practice — the version with a temporary is clearer and the '
      + 'compiler makes it just as fast. But it will tell you whether you really believe that '
      + '<code>=</code> is an instruction and not a statement of fact.',
      [{ title: 'Sample 1', content: 'Input:\n4 9\nOutput:\n9 4' }],
      [{ name: 'four and nine', stdin: '4 9\n', expected: '9 4' },
       { name: 'with a negative', stdin: '-3 8\n', expected: '8 -3' }],
      ['printf', 'scanf'])
  ];

  return { challenges: challenges, nodes: nodes };
}
