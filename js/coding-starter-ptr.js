/* ============================================================
   CODING-STARTER-PTR.JS — functions, then pointers, one step at a time
   ------------------------------------------------------------
   The pack reached pointers in its fifth folder with three programs to teach
   them, opening on "swap two numbers" -- which is the classic exercise and
   also the one that needs every pointer idea at once: address-of, a pointer
   parameter, and dereferencing to assign. Shown that first, it reads as a
   spell.

   So it is taken apart here. A pointer is introduced as a second name for a
   box you already have, and nothing else, for four programs. Only once
   changing `x` through `p` is ordinary does a pointer cross into a function,
   and only then is swap asked for -- by which point it is the obvious thing
   rather than the clever one.

   Functions come first for the same reason: `swap` cannot teach you pointers
   while it is also teaching you what a parameter is. The last program of the
   functions folder deliberately FAILS to change its caller's variable, which
   is the question the pointers folder then answers.

   Every reference is compiled and run against its own tests by
   tools/verify-pack.js. Addresses are never tested -- they differ every run --
   so each pointer program is marked on what the pointer did instead.
   ============================================================ */

function codingStarterPointers() {
  const nodes = [
    { id: 'starter-folder-fn',  type: 'folder', name: '3 · Functions',  parentId: null, scope: 'challenge', order: -7 },
    { id: 'starter-folder-ptr', type: 'folder', name: '4 · Pointers',   parentId: null, scope: 'challenge', order: -6 },
    { id: 'starter-folder-fn-basics', type: 'folder', name: 'A · Writing one',        parentId: 'starter-folder-fn', scope: 'challenge', order: 0 },
    { id: 'starter-folder-fn-value',  type: 'folder', name: 'B · Giving an answer back', parentId: 'starter-folder-fn', scope: 'challenge', order: 1 },
    { id: 'starter-folder-ptr-what',  type: 'folder', name: 'A · A second name for a box', parentId: 'starter-folder-ptr', scope: 'challenge', order: 0 },
    { id: 'starter-folder-ptr-fn',    type: 'folder', name: 'B · Into a function',    parentId: 'starter-folder-ptr', scope: 'challenge', order: 1 },
    { id: 'starter-folder-ptr-arr',   type: 'folder', name: 'C · Pointers and arrays', parentId: 'starter-folder-ptr', scope: 'challenge', order: 2 }
  ];

  const challenges = [

    /* ── 0.5 A · Writing one ────────────────────────────────── */

    _csProgram('fn-hello', 'fn-basics', 'Your first function',
      'Write a function called <code>greet</code> that takes nothing and prints:<br><br>'
      + '<code>Hello from a function</code><br><br>'
      + 'Call it once from <code>main</code>.<br><br>'
      + '<code>void greet(void) { ... }</code> — the first <code>void</code> means it hands nothing back, '
      + 'the second means it takes nothing in. Writing it does not run it; only <code>greet();</code> does.',
      [{ title: 'Sample 1', content: 'Output:\nHello from a function' }],
      [{ name: 'calls the function', stdin: '', expected: 'Hello from a function' }],
      ['printf', 'function']),

    _csProgram('fn-call-twice', 'fn-basics', 'Call it more than once',
      'Write a function <code>line</code> that prints <code>----</code>, then from <code>main</code> print:'
      + '<br><br><code>----</code><br><code>middle</code><br><code>----</code><br><br>'
      + 'Call <code>line()</code> twice. That is the whole point of a function: the instructions are written '
      + 'once and happen wherever you ask for them.',
      [{ title: 'Sample 1', content: 'Output:\n----\nmiddle\n----' }],
      [{ name: 'twice, around the middle', stdin: '', expected: '----\nmiddle\n----' }],
      ['printf', 'function']),

    _csProgram('fn-param', 'fn-basics', 'Hand it a value',
      'Write <code>void showSquare(int n)</code> which prints <code>n</code> times itself. Read a number in '
      + '<code>main</code> and pass it in.<br><br>For <code>6</code>: <code>36</code><br><br>'
      + 'The name <code>n</code> inside the function is a NEW box that gets a copy of what you passed. '
      + 'That copy is the whole story of the next few programs.',
      [{ title: 'Sample 1', content: 'Input:\n6\nOutput:\n36' }],
      [{ name: 'six squared', stdin: '6\n', expected: '36' },
       { name: 'negative squares positive', stdin: '-4\n', expected: '16' }],
      ['printf', 'scanf', 'function']),

    _csProgram('fn-two-params', 'fn-basics', 'Two values in',
      'Write <code>void showSum(int a, int b)</code> that prints the sum. Read both in <code>main</code>.'
      + '<br><br>For <code>3 4</code>: <code>7</code><br><br>'
      + 'Arguments are matched by POSITION, not by name — the first value you pass lands in the first '
      + 'parameter whatever either is called.',
      [{ title: 'Sample 1', content: 'Input:\n3 4\nOutput:\n7' }],
      [{ name: 'three and four', stdin: '3 4\n', expected: '7' },
       { name: 'with a negative', stdin: '10 -25\n', expected: '-15' }],
      ['printf', 'scanf', 'function']),

    _csProgram('fn-prototype', 'fn-basics', 'Promise it now, write it later',
      'Write <code>int triple(int n)</code> that returns <code>n * 3</code>, but define it BELOW '
      + '<code>main</code>. Above <code>main</code>, write only the prototype:<br><br>'
      + '<code>int triple(int n);</code><br><br>'
      + 'Read a number and print its triple. For <code>7</code>: <code>21</code><br><br>'
      + 'C reads your file top to bottom and has to know a function\'s shape before it sees it called. '
      + 'The prototype is that promise; the definition keeps it.',
      [{ title: 'Sample 1', content: 'Input:\n7\nOutput:\n21' }],
      [{ name: 'triples seven', stdin: '7\n', expected: '21' },
       { name: 'triples zero', stdin: '0\n', expected: '0' }],
      ['printf', 'scanf', 'function']),

    _csProgram('fn-scope', 'fn-basics', 'What happens in the function...',
      'Write <code>void tryToChange(int n)</code> that sets its parameter to 99 and prints '
      + '<code>inside: 99</code>. Read a number in <code>main</code>, call the function, then print '
      + '<code>outside: N</code> with the ORIGINAL value.<br><br>'
      + 'For the input <code>5</code>:<br><code>inside: 99</code><br><code>outside: 5</code><br><br>'
      + 'The function changed its own copy and the caller never noticed. This is not a bug to fix — it is '
      + 'how C passes arguments, and the next folder is entirely about the one way around it.',
      [{ title: 'Sample 1', content: 'Input:\n5\nOutput:\ninside: 99\noutside: 5' }],
      [{ name: 'the caller is untouched', stdin: '5\n', expected: 'inside: 99\noutside: 5' },
       { name: 'still untouched', stdin: '-1\n', expected: 'inside: 99\noutside: -1' }],
      ['printf', 'scanf', 'function']),

    /* ── 0.5 B · Giving an answer back ──────────────────────── */

    _csProgram('fn-return', 'fn-value', 'Hand a value back',
      'Write <code>int square(int n)</code> that RETURNS <code>n * n</code> instead of printing it. '
      + 'Print the result in <code>main</code>.<br><br>For <code>6</code>: <code>36</code><br><br>'
      + 'A function that prints is stuck printing. A function that returns can be used in a sum, stored, '
      + 'passed on, printed later — which is why almost every function you write should return.',
      [{ title: 'Sample 1', content: 'Input:\n6\nOutput:\n36' }],
      [{ name: 'six squared', stdin: '6\n', expected: '36' },
       { name: 'zero', stdin: '0\n', expected: '0' }],
      ['printf', 'scanf', 'function']),

    _csProgram('fn-return-use', 'fn-value', 'Use the answer in a sum',
      'Using the same <code>square</code>, read TWO numbers and print the sum of their squares.<br><br>'
      + 'For <code>3 4</code>: <code>25</code><br><br>'
      + 'Call it twice inside one expression. A returned value is just a value — it can go anywhere a '
      + 'number can go.',
      [{ title: 'Sample 1', content: 'Input:\n3 4\nOutput:\n25' }],
      [{ name: 'three four five', stdin: '3 4\n', expected: '25' },
       { name: 'with a negative', stdin: '-5 12\n', expected: '169' }],
      ['printf', 'scanf', 'function']),

    _csProgram('fn-max2', 'fn-value', 'The larger of two',
      'Write <code>int larger(int a, int b)</code> returning the bigger one, and print it for two numbers '
      + 'read in <code>main</code>.<br><br>For <code>4 9</code>: <code>9</code><br><br>'
      + 'A function can return from more than one place. The first <code>return</code> reached ends the '
      + 'function immediately.',
      [{ title: 'Sample 1', content: 'Input:\n4 9\nOutput:\n9' }],
      [{ name: 'second is bigger', stdin: '4 9\n', expected: '9' },
       { name: 'first is bigger', stdin: '30 2\n', expected: '30' },
       { name: 'equal', stdin: '7 7\n', expected: '7' }],
      ['printf', 'scanf', 'function']),

    _csProgram('fn-max3', 'fn-value', 'Build on what you built',
      'Write <code>int largest3(int a, int b, int c)</code> — and write it by CALLING your '
      + '<code>larger</code> twice, not by writing new comparisons.<br><br>'
      + 'For <code>4 9 2</code>: <code>9</code><br><br>'
      + '<code>larger(larger(a, b), c)</code>. A function you trust becomes a word you can build the next '
      + 'one out of, and that is the whole reason they exist.',
      [{ title: 'Sample 1', content: 'Input:\n4 9 2\nOutput:\n9' }],
      [{ name: 'middle is biggest', stdin: '4 9 2\n', expected: '9' },
       { name: 'last is biggest', stdin: '1 2 3\n', expected: '3' },
       { name: 'all negative', stdin: '-9 -2 -30\n', expected: '-2' }],
      ['printf', 'scanf', 'function']),

    _csProgram('fn-countdown', 'fn-value', 'A function that calls itself',
      'Write <code>void countdown(int n)</code> that prints <code>n</code>, then <code>n-1</code>, down to '
      + '<code>0</code>, one per line — by calling ITSELF, with no loop.<br><br>'
      + 'For <code>3</code>:<br><code>3</code><br><code>2</code><br><code>1</code><br><code>0</code><br><br>'
      + 'Every recursion needs a way to stop. Here it is <code>if (n &lt; 0) return;</code> — without it the '
      + 'calls never end and the program dies.',
      [{ title: 'Sample 1', content: 'Input:\n3\nOutput:\n3\n2\n1\n0' }],
      [{ name: 'from three', stdin: '3\n', expected: '3\n2\n1\n0' },
       { name: 'from zero', stdin: '0\n', expected: '0' }],
      ['printf', 'scanf', 'recursion']),

    _csProgram('fn-sum-recursive', 'fn-value', 'Add up to n, recursively',
      'Write <code>int total(int n)</code> returning <code>1 + 2 + ... + n</code>, with no loop.<br><br>'
      + 'For <code>5</code>: <code>15</code><br><br>'
      + 'The trick is to say the problem in terms of a smaller one: the total up to <code>n</code> is '
      + '<code>n</code> plus the total up to <code>n - 1</code>. The stopping case is <code>0</code>.',
      [{ title: 'Sample 1', content: 'Input:\n5\nOutput:\n15' }],
      [{ name: 'up to five', stdin: '5\n', expected: '15' },
       { name: 'up to one', stdin: '1\n', expected: '1' },
       { name: 'zero', stdin: '0\n', expected: '0' }],
      ['printf', 'scanf', 'recursion']),

    /* ── 0.6 A · A second name for a box ────────────────────── */

    _csProgram('ptr-declare', 'ptr-what', 'A pointer is a box holding a place',
      'Read a number into <code>x</code>. Declare <code>int *p;</code>, point it at <code>x</code> with '
      + '<code>p = &amp;x;</code>, then print:<br><br><code>x = 5</code><br><code>*p = 5</code><br><br>'
      + 'Three symbols and that is the whole idea:<br>'
      + '<code>int *p</code> — a box that holds the PLACE of an int<br>'
      + '<code>&amp;x</code> — the place where x lives<br>'
      + '<code>*p</code> — the value at the place p holds<br><br>'
      + 'Both lines print the same number because they are the same box, reached two ways.',
      [{ title: 'Sample 1', content: 'Input:\n5\nOutput:\nx = 5\n*p = 5' }],
      [{ name: 'reads five', stdin: '5\n', expected: 'x = 5\n*p = 5' },
       { name: 'reads a negative', stdin: '-12\n', expected: 'x = -12\n*p = -12' }],
      ['printf', 'scanf', 'pointer']),

    _csProgram('ptr-same-box', 'ptr-what', 'Prove it is the same box',
      'Read a number into <code>x</code> and point <code>p</code> at it. Print two lines, each '
      + '<code>1</code> for true:<br><br>'
      + 'first whether <code>*p == x</code>, then whether <code>p == &amp;x</code>.<br><br>'
      + '<code>1</code><br><code>1</code><br><br>'
      + 'Comparisons in C give you 1 or 0, so you can print one directly with <code>%d</code>. '
      + 'The first says the values match; the second says the ADDRESSES do, which is the stronger claim.',
      [{ title: 'Sample 1', content: 'Input:\n5\nOutput:\n1\n1' }],
      [{ name: 'both true', stdin: '5\n', expected: '1\n1' },
       { name: 'still both true', stdin: '0\n', expected: '1\n1' }],
      ['printf', 'scanf', 'pointer']),

    _csProgram('ptr-change', 'ptr-what', 'Change x without naming x',
      'Read a number into <code>x</code>, point <code>p</code> at it, print <code>before: N</code>, then '
      + 'assign <code>100</code> THROUGH the pointer and print <code>after: 100</code>.<br><br>'
      + 'For <code>5</code>:<br><code>before: 5</code><br><code>after: 100</code><br><br>'
      + 'The line that does it is <code>*p = 100;</code> — and note that <code>x</code> is nowhere in it. '
      + 'A pointer is not a copy; it is a way in.',
      [{ title: 'Sample 1', content: 'Input:\n5\nOutput:\nbefore: 5\nafter: 100' }],
      [{ name: 'changes x', stdin: '5\n', expected: 'before: 5\nafter: 100' },
       { name: 'from a negative', stdin: '-7\n', expected: 'before: -7\nafter: 100' }],
      ['printf', 'scanf', 'pointer']),

    _csProgram('ptr-add-through', 'ptr-what', 'Read and write through it',
      'Read two numbers <code>x</code> and <code>n</code>. Point <code>p</code> at <code>x</code> and add '
      + '<code>n</code> to x THROUGH the pointer, then print <code>x</code>.<br><br>'
      + 'For <code>10 5</code>: <code>15</code><br><br>'
      + '<code>*p = *p + n;</code> reads through the pointer and writes back through it in one line.',
      [{ title: 'Sample 1', content: 'Input:\n10 5\nOutput:\n15' }],
      [{ name: 'ten plus five', stdin: '10 5\n', expected: '15' },
       { name: 'adding a negative', stdin: '10 -30\n', expected: '-20' }],
      ['printf', 'scanf', 'pointer']),

    _csProgram('ptr-two-pointers', 'ptr-what', 'Two pointers, one box',
      'Read a number into <code>x</code> and aim TWO pointers at it. Double it through the first, then '
      + 'print the value through the second, and then <code>x</code> itself.<br><br>'
      + 'For <code>6</code>:<br><code>12</code><br><code>12</code><br><br>'
      + 'Nothing was copied. Changing the box through one name changes what every other name sees — '
      + 'which is the power and the danger in equal measure.',
      [{ title: 'Sample 1', content: 'Input:\n6\nOutput:\n12\n12' }],
      [{ name: 'both see it', stdin: '6\n', expected: '12\n12' },
       { name: 'zero doubles to zero', stdin: '0\n', expected: '0\n0' }],
      ['printf', 'scanf', 'pointer']),

    _csProgram('ptr-null', 'ptr-what', 'A pointer to nowhere',
      'Declare <code>int *p = NULL;</code> and print <code>nothing yet</code> if it is NULL. Then read a '
      + 'number, point <code>p</code> at it, and print <code>now: N</code> if it is not NULL.<br><br>'
      + 'For <code>8</code>:<br><code>nothing yet</code><br><code>now: 8</code><br><br>'
      + '<code>NULL</code> means "pointing at nothing on purpose". Dereferencing it crashes the program, '
      + 'so a pointer that might be NULL gets checked before it is followed. Every crash you will have in '
      + 'the memory folder is a version of forgetting this.',
      [{ title: 'Sample 1', content: 'Input:\n8\nOutput:\nnothing yet\nnow: 8' }],
      [{ name: 'null then set', stdin: '8\n', expected: 'nothing yet\nnow: 8' }],
      ['printf', 'scanf', 'pointer', 'if']),

    /* ── 0.6 B · Into a function ────────────────────────────── */

    _csProgram('ptr-param', 'ptr-fn', 'Now change the caller\'s variable',
      'Write <code>void setToHundred(int *p)</code> which sets what <code>p</code> points at to 100. '
      + 'In <code>main</code>, read a number, print <code>before: N</code>, call it with '
      + '<code>&amp;n</code>, and print <code>after: 100</code>.<br><br>'
      + 'For <code>5</code>:<br><code>before: 5</code><br><code>after: 100</code><br><br>'
      + 'Compare this with <em>What happens in the function...</em>, which could not do it. Nothing about '
      + 'C changed: the function still gets a COPY of what you passed. But this time what you passed was '
      + 'an address, and a copy of an address still leads to the same box.',
      [{ title: 'Sample 1', content: 'Input:\n5\nOutput:\nbefore: 5\nafter: 100' }],
      [{ name: 'the caller does change', stdin: '5\n', expected: 'before: 5\nafter: 100' },
       { name: 'from a negative', stdin: '-3\n', expected: 'before: -3\nafter: 100' }],
      ['printf', 'scanf', 'pointer', 'function']),

    _csProgram('ptr-swap-intro', 'ptr-fn', 'Swap, for real this time',
      'Write <code>void swap(int *a, int *b)</code> that exchanges the two values it is pointed at. '
      + 'Read two numbers, swap them, print them.<br><br>'
      + 'For <code>4 9</code>: <code>9 4</code><br><br>'
      + 'You already know the three lines with a temporary from tier 0. The only new part is that every '
      + '<code>a</code> and <code>b</code> becomes <code>*a</code> and <code>*b</code>, and the call site '
      + 'passes <code>&amp;x, &amp;y</code>.<br><br>'
      + 'This is the exercise everyone is shown first. It should feel like nothing now.',
      [{ title: 'Sample 1', content: 'Input:\n4 9\nOutput:\n9 4' }],
      [{ name: 'four and nine', stdin: '4 9\n', expected: '9 4' },
       { name: 'negatives', stdin: '-1 -8\n', expected: '-8 -1' },
       { name: 'equal values', stdin: '5 5\n', expected: '5 5' }],
      ['printf', 'scanf', 'pointer', 'function']),

    _csProgram('ptr-two-results', 'ptr-fn', 'Two answers from one function',
      'Write <code>void divide(int a, int b, int *quotient, int *remainder)</code> that works out both and '
      + 'writes them through the pointers. Print:<br><br><code>3 remainder 2</code> for <code>17 5</code>'
      + '<br><br>'
      + 'A function can only <code>return</code> one thing. When you need two, you pass in somewhere to '
      + 'put them. Half the C standard library works this way.',
      [{ title: 'Sample 1', content: 'Input:\n17 5\nOutput:\n3 remainder 2' }],
      [{ name: 'seventeen by five', stdin: '17 5\n', expected: '3 remainder 2' },
       { name: 'divides exactly', stdin: '20 4\n', expected: '5 remainder 0' }],
      ['printf', 'scanf', 'pointer', 'function']),

    _csProgram('ptr-minmax-out', 'ptr-fn', 'Smallest and largest at once',
      'Write <code>void minMax(int a, int b, int c, int *lo, int *hi)</code> that puts the smallest of the '
      + 'three in <code>*lo</code> and the largest in <code>*hi</code>. Print them separated by a space.'
      + '<br><br>For <code>7 2 9</code>: <code>2 9</code>',
      [{ title: 'Sample 1', content: 'Input:\n7 2 9\nOutput:\n2 9' }],
      [{ name: 'seven two nine', stdin: '7 2 9\n', expected: '2 9' },
       { name: 'already in order', stdin: '1 2 3\n', expected: '1 3' },
       { name: 'all the same', stdin: '4 4 4\n', expected: '4 4' }],
      ['printf', 'scanf', 'pointer', 'function']),

    /* ── 0.6 C · Pointers and arrays ────────────────────────── */

    _csProgram('ptr-array-name', 'ptr-arr', 'An array name is an address',
      'With <code>int A[5] = {10, 20, 30, 40, 50};</code> and <code>int *p = A;</code>, print three lines: '
      + '<code>*p</code>, then <code>A[0]</code>, then whether <code>p == &amp;A[0]</code>.<br><br>'
      + '<code>10</code><br><code>10</code><br><code>1</code><br><br>'
      + 'Notice there is no <code>&amp;</code> in <code>int *p = A;</code>. Used in an expression, an array '
      + 'name IS the address of its first element. That single fact explains why arrays behave so strangely '
      + 'when passed to functions.',
      [{ title: 'Sample 1', content: 'Output:\n10\n10\n1' }],
      [{ name: 'same first element', stdin: '', expected: '10\n10\n1' }],
      ['printf', 'pointer', 'array']),

    _csProgram('ptr-arith', 'ptr-arr', 'Adding one to a pointer',
      'With the same array and <code>int *p = A;</code>, print <code>*p</code>, <code>*(p + 1)</code> and '
      + '<code>*(p + 4)</code>:<br><br><code>10</code><br><code>20</code><br><code>50</code><br><br>'
      + '<code>p + 1</code> does not add one BYTE — it moves on by one <code>int</code>, four bytes here. '
      + 'The type of the pointer is what decides the size of a step, which is why '
      + '<code>A[i]</code> and <code>*(A + i)</code> are the same thing written twice.',
      [{ title: 'Sample 1', content: 'Output:\n10\n20\n50' }],
      [{ name: 'three positions', stdin: '', expected: '10\n20\n50' }],
      ['printf', 'pointer', 'array']),

    _csProgram('ptr-walk', 'ptr-arr', 'Walk the array with a pointer',
      'Read a count <code>n</code> and then <code>n</code> numbers into an array. Print them one per line '
      + '— using a POINTER that you move along, not <code>A[i]</code>.<br><br>'
      + 'For <code>3</code> then <code>7 8 9</code>:<br><code>7</code><br><code>8</code><br><code>9</code>'
      + '<br><br>Set <code>int *p = A;</code>, print <code>*p</code>, then <code>p++</code>.',
      [{ title: 'Sample 1', content: 'Input:\n3\n7 8 9\nOutput:\n7\n8\n9' }],
      [{ name: 'three values', stdin: '3\n7 8 9\n', expected: '7\n8\n9' },
       { name: 'one value', stdin: '1\n42\n', expected: '42' }],
      ['printf', 'scanf', 'pointer', 'array', 'loop']),

    _csProgram('ptr-sum-walk', 'ptr-arr', 'Total, through a pointer parameter',
      'Write <code>int total(int *p, int size)</code> that adds up <code>size</code> values starting at '
      + '<code>p</code>. Read <code>n</code> and <code>n</code> numbers, and print the total.<br><br>'
      + 'For <code>5</code> then <code>1 2 3 4 5</code>: <code>15</code><br><br>'
      + 'Call it as <code>total(A, n)</code> — no <code>&amp;</code>, because the array name already is an '
      + 'address. And it still needs the size passed in: inside the function there is nothing but a '
      + 'pointer, and a pointer does not know how much is behind it.',
      [{ title: 'Sample 1', content: 'Input:\n5\n1 2 3 4 5\nOutput:\n15' }],
      [{ name: 'one to five', stdin: '5\n1 2 3 4 5\n', expected: '15' },
       { name: 'with negatives', stdin: '4\n10 -3 -7 1\n', expected: '1' }],
      ['printf', 'scanf', 'pointer', 'function', 'loop']),

    _csProgram('ptr-to-ptr', 'ptr-arr', 'A pointer to a pointer',
      'Read a number into <code>x</code>. Point <code>p</code> at <code>x</code>, and point '
      + '<code>int **pp</code> at <code>p</code>. Print <code>x</code>, <code>*p</code> and '
      + '<code>**pp</code> — all the same — then assign <code>7</code> through <code>**pp</code> and print '
      + '<code>x</code> again.<br><br>'
      + 'For <code>3</code>:<br><code>3</code><br><code>3</code><br><code>3</code><br><code>7</code><br><br>'
      + 'One star gets you to a value, two stars get you to a pointer. You will need this the moment a '
      + 'function has to change where a pointer POINTS rather than what it points at.',
      [{ title: 'Sample 1', content: 'Input:\n3\nOutput:\n3\n3\n3\n7' }],
      [{ name: 'three levels', stdin: '3\n', expected: '3\n3\n3\n7' }],
      ['printf', 'scanf', 'pointer']),

    _csProgram('ptr-fn', 'ptr-arr', 'A pointer to a function',
      'Write <code>add</code> and <code>multiply</code>, both <code>int f(int, int)</code>. Read two '
      + 'numbers. Declare <code>int (*op)(int, int);</code>, point it at <code>add</code> and print the '
      + 'result, then point it at <code>multiply</code> and print that.<br><br>'
      + 'For <code>3 4</code>:<br><code>7</code><br><code>12</code><br><br>'
      + 'Functions live in memory too, so they have addresses, so you can hold one in a variable and '
      + 'decide at RUN TIME which to call. This is how sorting routines take a comparison, and how menus '
      + 'stop being a hundred-line switch.',
      [{ title: 'Sample 1', content: 'Input:\n3 4\nOutput:\n7\n12' }],
      [{ name: 'add then multiply', stdin: '3 4\n', expected: '7\n12' },
       { name: 'with zero', stdin: '5 0\n', expected: '5\n0' }],
      ['printf', 'scanf', 'pointer', 'function'])
  ];

  return { challenges: challenges, nodes: nodes };
}
