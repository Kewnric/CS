/* ============================================================
   CODING-STARTER-LOOP.JS — repeating work, and the patterns built on it
   ------------------------------------------------------------
   This folder sits between tier 0 and functions because everything after it
   needs a loop: you cannot walk an array or fill a grid without one.

   THE PATTERNS ARE NOT DECORATION. A pyramid is the cheapest honest exercise
   in nested loops there is -- the outer loop is the row, the inner loops are
   what goes on it, and getting it wrong is visible instantly instead of being
   an off-by-one you argue with. Five of them in a row, each adding one thing,
   is worth more than one clever one:

     stars on a line     one loop
     half pyramid        rows, and a count that grows with the row
     inverted            the same, counted the other way
     full pyramid        two inner loops -- spaces THEN stars
     inverted / diamond  the same skeleton, run backwards or twice
     hollow square       one inner loop deciding per cell what to print

   By the last one the shape is no longer a puzzle, which is exactly what a
   grid exercise later assumes you have.

   Every reference is compiled and run against its own tests by
   tools/verify-pack.js.
   ============================================================ */

function codingStarterLoops() {
  const nodes = [
    { id: 'starter-folder-lp', type: 'folder', name: '2 · Repeating work', parentId: null, scope: 'challenge', order: -8 },
    { id: 'starter-folder-lp-rep', type: 'folder', name: 'A · Loops',    parentId: 'starter-folder-lp', scope: 'challenge', order: 0 },
    { id: 'starter-folder-lp-pat', type: 'folder', name: 'B · Patterns', parentId: 'starter-folder-lp', scope: 'challenge', order: 1 }
  ];

  const challenges = [

    /* ── A · Loops ──────────────────────────────────────────── */

    _csProgram('lp-count-up', 'lp-rep', 'Count up to n',
      'Read a number <code>n</code> and print <code>1</code> to <code>n</code>, one per line, using a '
      + '<code>while</code> loop.<br><br>For <code>3</code>:<br><code>1</code><br><code>2</code><br>'
      + '<code>3</code><br><br>'
      + 'A loop needs three things and a <code>while</code> makes you place all three yourself: something '
      + 'to start from, a test that says whether to go round again, and a change that eventually makes '
      + 'the test false. Forget the third and the program never stops.',
      [{ title: 'Sample 1', content: 'Input:\n3\nOutput:\n1\n2\n3' }],
      [{ name: 'up to three', stdin: '3\n', expected: '1\n2\n3' },
       { name: 'just one', stdin: '1\n', expected: '1' },
       { name: 'zero prints nothing', stdin: '0\n', expected: '' }],
      ['printf', 'scanf', 'while']),

    _csProgram('lp-count-down-for', 'lp-rep', 'Count down with a for',
      'Read <code>n</code> and print from <code>n</code> down to <code>1</code>, one per line, using a '
      + '<code>for</code> loop.<br><br>For <code>3</code>:<br><code>3</code><br><code>2</code><br>'
      + '<code>1</code><br><br>'
      + 'A <code>for</code> is the same three parts as a <code>while</code>, gathered onto one line where '
      + 'you cannot forget one. Use it whenever you know the count in advance.',
      [{ title: 'Sample 1', content: 'Input:\n3\nOutput:\n3\n2\n1' }],
      [{ name: 'down from three', stdin: '3\n', expected: '3\n2\n1' },
       { name: 'down from one', stdin: '1\n', expected: '1' }],
      ['printf', 'scanf', 'for']),

    _csProgram('lp-sum-n', 'lp-rep', 'Add up to n',
      'Read <code>n</code> and print the total of <code>1 + 2 + ... + n</code>.<br><br>'
      + 'For <code>5</code>: <code>15</code><br><br>'
      + 'The running total is declared OUTSIDE the loop and added to inside it. Declare it inside and it '
      + 'is born again each time round, which is the classic first loop bug.',
      [{ title: 'Sample 1', content: 'Input:\n5\nOutput:\n15' }],
      [{ name: 'up to five', stdin: '5\n', expected: '15' },
       { name: 'up to one', stdin: '1\n', expected: '1' },
       { name: 'zero', stdin: '0\n', expected: '0' }],
      ['printf', 'scanf', 'for']),

    _csProgram('lp-dowhile', 'lp-rep', 'At least once',
      'Read <code>n</code> and print <code>1</code> to <code>n</code> with a <code>do ... while</code>, '
      + 'then print how many times the loop body ran.<br><br>'
      + 'For <code>3</code>:<br><code>1</code><br><code>2</code><br><code>3</code><br>'
      + '<code>ran 3 times</code><br><br>'
      + 'A <code>do ... while</code> tests at the BOTTOM, so the body always runs at least once. Try it '
      + 'with <code>0</code> and watch it print 1 anyway — that is the whole difference, and it is why '
      + 'this loop suits menus and nothing else.',
      [{ title: 'Sample 1', content: 'Input:\n3\nOutput:\n1\n2\n3\nran 3 times' }],
      [{ name: 'three times', stdin: '3\n', expected: '1\n2\n3\nran 3 times' },
       { name: 'runs once even for zero', stdin: '0\n', expected: '1\nran 1 times' }],
      ['printf', 'scanf', 'dowhile']),

    _csProgram('lp-skip-multiples', 'lp-rep', 'Skip the multiples of three',
      'Read <code>n</code> and print <code>1</code> to <code>n</code> on one line, space separated, '
      + 'SKIPPING every multiple of 3.<br><br>'
      + 'For <code>7</code>: <code>1 2 4 5 7</code><br><br>'
      + '<code>continue</code> abandons this trip round the loop and starts the next one. Everything '
      + 'below it is skipped, so where you put it decides what gets skipped with it.',
      [{ title: 'Sample 1', content: 'Input:\n7\nOutput:\n1 2 4 5 7' }],
      [{ name: 'up to seven', stdin: '7\n', expected: '1 2 4 5 7' },
       { name: 'up to three', stdin: '3\n', expected: '1 2' }],
      ['printf', 'scanf', 'for', 'if']),

    _csProgram('lp-stop-early', 'lp-rep', 'Stop when you find it',
      'Read <code>n</code> and a target. Print <code>1</code> upwards, one per line, but the moment you '
      + 'reach the target print <code>stopped at T</code> and leave the loop.<br><br>'
      + 'For <code>10 4</code>:<br><code>1</code><br><code>2</code><br><code>3</code><br>'
      + '<code>stopped at 4</code><br><br>'
      + '<code>break</code> leaves the loop entirely. This is the shape of every search you will write: '
      + 'walk until you find it, then stop looking.',
      [{ title: 'Sample 1', content: 'Input:\n10 4\nOutput:\n1\n2\n3\nstopped at 4' }],
      [{ name: 'stops at four', stdin: '10 4\n', expected: '1\n2\n3\nstopped at 4' },
       { name: 'never reaches it', stdin: '3 9\n', expected: '1\n2\n3' }],
      ['printf', 'scanf', 'for', 'if']),

    /* ── B · Patterns ───────────────────────────────────────── */

    _csProgram('lp-stars-line', 'lp-pat', 'A line of stars',
      'Read <code>n</code> and print <code>n</code> stars on ONE line.<br><br>'
      + 'For <code>5</code>: <code>*****</code><br><br>'
      + 'The newline comes AFTER the loop, not inside it. That one detail is the whole difference between '
      + 'a line and a column, and every pattern below is built on it.',
      [{ title: 'Sample 1', content: 'Input:\n5\nOutput:\n*****' }],
      [{ name: 'five stars', stdin: '5\n', expected: '*****' },
       { name: 'one star', stdin: '1\n', expected: '*' }],
      ['printf', 'scanf', 'for']),

    _csProgram('lp-half-pyramid', 'lp-pat', 'Half pyramid',
      'Read <code>n</code> and print a left-aligned triangle of stars.<br><br>For <code>4</code>:<br><br>'
      + '<code>*</code><br><code>**</code><br><code>***</code><br><code>****</code><br><br>'
      + 'Two loops now. The OUTER one is the row; the INNER one prints that row\'s stars and the count it '
      + 'goes up to is the row number. Printing the newline belongs to the outer loop.',
      [{ title: 'Sample 1', content: 'Input:\n4\nOutput:\n*\n**\n***\n****' }],
      [{ name: 'four rows', stdin: '4\n', expected: '*\n**\n***\n****' },
       { name: 'one row', stdin: '1\n', expected: '*' }],
      ['printf', 'scanf', 'nestedloop']),

    _csProgram('lp-half-pyramid-inv', 'lp-pat', 'Half pyramid, upside down',
      'The same triangle, widest first.<br><br>For <code>4</code>:<br><br>'
      + '<code>****</code><br><code>***</code><br><code>**</code><br><code>*</code><br><br>'
      + 'Nothing changes but the direction the OUTER loop counts. The inner loop is untouched — which is '
      + 'worth noticing, because it means the row number is the only thing deciding the shape.',
      [{ title: 'Sample 1', content: 'Input:\n4\nOutput:\n****\n***\n**\n*' }],
      [{ name: 'four rows', stdin: '4\n', expected: '****\n***\n**\n*' },
       { name: 'two rows', stdin: '2\n', expected: '**\n*' }],
      ['printf', 'scanf', 'nestedloop']),

    _csProgram('lp-number-triangle', 'lp-pat', 'A triangle of digits',
      'The same shape, but each row counts from 1.<br><br>For <code>4</code>:<br><br>'
      + '<code>1</code><br><code>12</code><br><code>123</code><br><code>1234</code><br><br>'
      + 'Only what the inner loop PRINTS changed. Same skeleton — and the inner counter, which you were '
      + 'ignoring before, is now the thing being printed.',
      [{ title: 'Sample 1', content: 'Input:\n4\nOutput:\n1\n12\n123\n1234' }],
      [{ name: 'four rows', stdin: '4\n', expected: '1\n12\n123\n1234' },
       { name: 'three rows', stdin: '3\n', expected: '1\n12\n123' }],
      ['printf', 'scanf', 'nestedloop']),

    _csProgram('lp-pyramid', 'lp-pat', 'A full pyramid',
      'Read <code>n</code> and print a centred pyramid.<br><br>For <code>4</code>:<br><br>'
      + '<code>   *</code><br><code>  ***</code><br><code> *****</code><br><code>*******</code><br><br>'
      + 'TWO inner loops now, in this order: first the spaces, then the stars. Row <code>r</code> of '
      + '<code>n</code> needs <code>n - r</code> spaces and <code>2r - 1</code> stars.<br><br>'
      + 'Work those two formulas out on paper before you type anything. Guessing at them is how people '
      + 'spend an hour on a pyramid.',
      [{ title: 'Sample 1', content: 'Input:\n4\nOutput:\n   *\n  ***\n *****\n*******' }],
      [{ name: 'four rows', stdin: '4\n', expected: '   *\n  ***\n *****\n*******' },
       { name: 'one row', stdin: '1\n', expected: '*' }],
      ['printf', 'scanf', 'nestedloop']),

    _csProgram('lp-pyramid-inv', 'lp-pat', 'A pyramid upside down',
      'The centred pyramid, widest first.<br><br>For <code>4</code>:<br><br>'
      + '<code>*******</code><br><code> *****</code><br><code>  ***</code><br><code>   *</code><br><br>'
      + 'Again only the outer loop is reversed. Both formulas stay exactly as they were.',
      [{ title: 'Sample 1', content: 'Input:\n4\nOutput:\n*******\n *****\n  ***\n   *' }],
      [{ name: 'four rows', stdin: '4\n', expected: '*******\n *****\n  ***\n   *' },
       { name: 'two rows', stdin: '2\n', expected: '***\n *' }],
      ['printf', 'scanf', 'nestedloop']),

    _csProgram('lp-diamond', 'lp-pat', 'A diamond',
      'Read <code>n</code> and print a pyramid with an upside-down one under it, sharing the widest row.'
      + '<br><br>For <code>3</code>:<br><br>'
      + '<code>  *</code><br><code> ***</code><br><code>*****</code><br><code> ***</code><br>'
      + '<code>  *</code><br><br>'
      + 'You have already written both halves. The only new decision is that the second half starts at '
      + '<code>n - 1</code>, not <code>n</code> — otherwise the widest row prints twice.',
      [{ title: 'Sample 1', content: 'Input:\n3\nOutput:\n  *\n ***\n*****\n ***\n  *' }],
      [{ name: 'three tall', stdin: '3\n', expected: '  *\n ***\n*****\n ***\n  *' },
       { name: 'one tall', stdin: '1\n', expected: '*' }],
      ['printf', 'scanf', 'nestedloop']),

    _csProgram('lp-square', 'lp-pat', 'A hollow square',
      'Read <code>n</code> and print an <code>n</code> by <code>n</code> square of stars that is HOLLOW '
      + '— stars on the border, spaces inside.<br><br>For <code>4</code>:<br><br>'
      + '<code>****</code><br><code>*  *</code><br><code>*  *</code><br><code>****</code><br><br>'
      + 'One inner loop this time, but it decides PER CELL what to print: a star on the first or last row '
      + 'or the first or last column, a space otherwise.<br><br>'
      + 'This is the pattern that stops being about counting and starts being about a condition — which '
      + 'is how every grid problem after it works.',
      [{ title: 'Sample 1', content: 'Input:\n4\nOutput:\n****\n*  *\n*  *\n****' }],
      [{ name: 'four by four', stdin: '4\n', expected: '****\n*  *\n*  *\n****' },
       { name: 'three by three', stdin: '3\n', expected: '***\n* *\n***' },
       { name: 'one by one', stdin: '1\n', expected: '*' }],
      ['printf', 'scanf', 'nestedloop', 'ifelse']),

    _csProgram('lp-times-grid', 'lp-pat', 'A times-table grid',
      'Read <code>n</code> and print the <code>n</code> by <code>n</code> multiplication table, rows on '
      + 'their own lines and values separated by spaces.<br><br>For <code>3</code>:<br><br>'
      + '<code>1 2 3</code><br><code>2 4 6</code><br><code>3 6 9</code><br><br>'
      + 'The cell is the product of the two loop counters. A trailing space per line is fine.<br><br>'
      + 'You have now written a nested loop where the inner counter is a position, a value, and a '
      + 'coordinate. That is everything a two-dimensional array will ask of you.',
      [{ title: 'Sample 1', content: 'Input:\n3\nOutput:\n1 2 3\n2 4 6\n3 6 9' }],
      [{ name: 'three by three', stdin: '3\n', expected: '1 2 3\n2 4 6\n3 6 9' },
       { name: 'one by one', stdin: '1\n', expected: '1' }],
      ['printf', 'scanf', 'nestedloop'])
  ];

  return { challenges: challenges, nodes: nodes };
}
