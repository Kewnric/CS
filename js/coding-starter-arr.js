/* ============================================================
   CODING-STARTER-ARR.JS — arrays, in the order they make sense
   ------------------------------------------------------------
   Four folders, and the order between them is the argument:

     A  one row of boxes, used in main and nowhere else
     B  the same row handed to a function -- which is where arrays stop
        behaving like every other value in C
     C  the four operations a course will ask you for by name: search,
        insert, delete, reverse
     D  a second dimension

   B IS THE ONE THAT MATTERS. An int passed to a function is copied and the
   caller is safe; an array is not copied, so a function can change it, and
   `sizeof` inside that function is the size of a pointer rather than of the
   array. Both facts are demonstrated by a program whose whole job is to show
   them, rather than mentioned in passing and met later as a bug.

   C is built on B: insert and delete shift elements one at a time, because an
   array has no gap to open or close. Doing that by hand once is what makes a
   linked list feel like a relief rather than a complication when folder 8
   asks for one.

   Every reference is compiled and run against its own tests by
   tools/verify-pack.js.
   ============================================================ */

function codingStarterArrays() {
  const nodes = [
    { id: 'starter-folder-ar', type: 'folder', name: '5 · Arrays', parentId: null, scope: 'challenge', order: -5 },
    { id: 'starter-folder-ar-one',  type: 'folder', name: 'A · One row of boxes',   parentId: 'starter-folder-ar', scope: 'challenge', order: 0 },
    { id: 'starter-folder-ar-fn',   type: 'folder', name: 'B · Into a function',    parentId: 'starter-folder-ar', scope: 'challenge', order: 1 },
    { id: 'starter-folder-ar-ops',  type: 'folder', name: 'C · Operations',         parentId: 'starter-folder-ar', scope: 'challenge', order: 2 },
    { id: 'starter-folder-ar-grid', type: 'folder', name: 'D · Two dimensions',     parentId: 'starter-folder-ar', scope: 'challenge', order: 3 }
  ];

  const challenges = [

    /* ── A · One row of boxes ───────────────────────────────── */

    _csProgram('ar-print-fixed', 'ar-one', 'A row of five',
      'Declare <code>int A[5] = {3, 1, 4, 1, 5};</code> and print the five values, one per line.<br><br>'
      + '<code>3</code><br><code>1</code><br><code>4</code><br><code>1</code><br><code>5</code><br><br>'
      + 'An array is a row of boxes of the same type, side by side, reached by number. '
      + '<code>A[0]</code> is the FIRST — counting from zero is not a quirk here, it is how far along you '
      + 'are from the start.',
      [{ title: 'Sample 1', content: 'Output:\n3\n1\n4\n1\n5' }],
      [{ name: 'all five in order', stdin: '', expected: '3\n1\n4\n1\n5' }],
      ['printf', 'array', 'loop']),

    _csProgram('ar-index', 'ar-one', 'Pick one out',
      'With <code>int A[5] = {10, 20, 30, 40, 50};</code>, read an index and print that element.<br><br>'
      + 'For <code>2</code>: <code>30</code><br><br>'
      + 'Index 2 is the THIRD box. Ask for <code>A[5]</code> and C will not stop you — it will read whatever '
      + 'happens to sit after the array. That is the single most common source of impossible bugs in C, '
      + 'and it never announces itself.',
      [{ title: 'Sample 1', content: 'Input:\n2\nOutput:\n30' }],
      [{ name: 'the third box', stdin: '2\n', expected: '30' },
       { name: 'the first', stdin: '0\n', expected: '10' },
       { name: 'the last', stdin: '4\n', expected: '50' }],
      ['printf', 'scanf', 'array']),

    _csProgram('ar-read-print', 'ar-one', 'Read a row in',
      'Read a count <code>n</code>, then <code>n</code> numbers into an array, then print them back one per '
      + 'line.<br><br>For <code>3</code> then <code>7 8 9</code>:<br><code>7</code><br><code>8</code><br>'
      + '<code>9</code><br><br>'
      + 'Two loops: one to fill, one to print. Declare the array big enough for the largest input you '
      + 'expect — <code>int A[100];</code> — because its size is fixed the moment it is declared.',
      [{ title: 'Sample 1', content: 'Input:\n3\n7 8 9\nOutput:\n7\n8\n9' }],
      [{ name: 'three values', stdin: '3\n7 8 9\n', expected: '7\n8\n9' },
       { name: 'one value', stdin: '1\n-4\n', expected: '-4' }],
      ['printf', 'scanf', 'array', 'loop']),

    _csProgram('ar-sum-avg', 'ar-one', 'Total and average',
      'Read <code>n</code> and <code>n</code> numbers, then print:<br><br>'
      + '<code>sum = 15</code><br><code>avg = 3.00</code><br><br>'
      + 'Two decimals on the average, and divide by <code>n</code> as a real number or you will lose the '
      + 'fraction — the trap from tier 0, now with an array in front of it.',
      [{ title: 'Sample 1', content: 'Input:\n5\n1 2 3 4 5\nOutput:\nsum = 15\navg = 3.00' }],
      [{ name: 'one to five', stdin: '5\n1 2 3 4 5\n', expected: 'sum = 15\navg = 3.00' },
       { name: 'needs the fraction', stdin: '3\n1 2 2\n', expected: 'sum = 5\navg = 1.67' }],
      ['printf', 'scanf', 'array', 'loop']),

    _csProgram('ar-max-index', 'ar-one', 'The largest, and where it is',
      'Read <code>n</code> and <code>n</code> numbers. Print the largest value AND its index:<br><br>'
      + '<code>9 at 2</code><br><br>'
      + 'Track the index of the best so far rather than the value — then you have both at the end, and '
      + 'comparisons read <code>A[i] &gt; A[best]</code>.<br><br>'
      + 'Start from element 0 as the best and loop from 1. Starting from a made-up value like 0 breaks the '
      + 'moment every number is negative.',
      [{ title: 'Sample 1', content: 'Input:\n5\n3 7 9 2 5\nOutput:\n9 at 2' }],
      [{ name: 'in the middle', stdin: '5\n3 7 9 2 5\n', expected: '9 at 2' },
       { name: 'all negative', stdin: '3\n-9 -2 -30\n', expected: '-2 at 1' },
       { name: 'first is largest', stdin: '4\n8 1 2 3\n', expected: '8 at 0' }],
      ['printf', 'scanf', 'array', 'loop']),

    _csProgram('ar-count-over', 'ar-one', 'How many are above the line',
      'Read <code>n</code>, then <code>n</code> numbers, then one more number — the limit. Print how many '
      + 'of the array are strictly greater than it.<br><br>'
      + 'For <code>5</code>, <code>1 9 3 8 2</code>, limit <code>4</code>: <code>2</code><br><br>'
      + 'Counting is the same shape as summing: a variable outside the loop, changed inside it.',
      [{ title: 'Sample 1', content: 'Input:\n5\n1 9 3 8 2\n4\nOutput:\n2' }],
      [{ name: 'two above', stdin: '5\n1 9 3 8 2\n4\n', expected: '2' },
       { name: 'none above', stdin: '3\n1 2 3\n10\n', expected: '0' },
       { name: 'all above', stdin: '3\n5 6 7\n0\n', expected: '3' }],
      ['printf', 'scanf', 'array', 'loop', 'if']),

    _csProgram('ar-reverse-print', 'ar-one', 'Print it backwards',
      'Read <code>n</code> and <code>n</code> numbers, then print them in reverse on ONE line, separated by '
      + 'spaces.<br><br>For <code>1 2 3</code>: <code>3 2 1 </code><br><br>'
      + 'A trailing space at the end of the line is fine — the checker ignores it.<br><br>'
      + 'Nothing is moved here. The array is untouched; only the order you VISIT it changed. The next '
      + 'folder but one asks you to actually turn it around.',
      [{ title: 'Sample 1', content: 'Input:\n3\n1 2 3\nOutput:\n3 2 1' }],
      [{ name: 'three values', stdin: '3\n1 2 3\n', expected: '3 2 1' },
       { name: 'one value', stdin: '1\n5\n', expected: '5' }],
      ['printf', 'scanf', 'array', 'loop']),

    /* ── B · Into a function ────────────────────────────────── */

    _csProgram('ar-fn-sum', 'ar-fn', 'Hand the row to a function',
      'Write <code>int total(int A[], int size)</code> that adds up the array, and use it.<br><br>'
      + 'For <code>5</code> then <code>1 2 3 4 5</code>: <code>15</code><br><br>'
      + 'Call it as <code>total(A, n)</code> — no <code>&amp;</code>. And it has to be TOLD the size, '
      + 'because inside the function there is no way to work it out. The next program shows why.',
      [{ title: 'Sample 1', content: 'Input:\n5\n1 2 3 4 5\nOutput:\n15' }],
      [{ name: 'one to five', stdin: '5\n1 2 3 4 5\n', expected: '15' },
       { name: 'with negatives', stdin: '4\n10 -3 -7 1\n', expected: '1' }],
      ['printf', 'scanf', 'array', 'function', 'loop']),

    _csProgram('ar-fn-sizeof', 'ar-fn', 'Why the size has to be passed',
      'Declare <code>int A[10];</code> in <code>main</code>. Print <code>sizeof(A)</code> there, then pass '
      + 'the array to <code>void report(int A[])</code> which prints <code>sizeof(A)</code> too.<br><br>'
      + '<code>outside: 40</code><br><code>inside: 8</code><br><br>'
      + 'Cast each <code>sizeof</code> to <code>(int)</code> to print it with <code>%d</code>.<br><br>'
      + 'Forty bytes outside: ten ints. Eight inside: the size of a POINTER, because that is all the '
      + 'function ever received. The array was never copied — <code>int A[]</code> in a parameter list is '
      + 'a polite spelling of <code>int *A</code>.<br><br>'
      + 'This is why every array function in C takes a size, and why the number you see inside may differ '
      + 'from 8 on another machine — it is a pointer, not an array.',
      [{ title: 'Sample 1', content: 'Output:\noutside: 40\ninside: 8' }],
      [{ name: 'forty out, pointer in', stdin: '', expected: 'outside: 40\ninside: 8' }],
      ['printf', 'array', 'function']),

    _csProgram('ar-fn-modify', 'ar-fn', 'A function that changes your array',
      'Write <code>void doubleAll(int A[], int size)</code> that doubles every element IN PLACE. '
      + 'Read the array, call it, and print the array from <code>main</code>.<br><br>'
      + 'For <code>3</code> then <code>1 2 3</code>: <code>2 4 6</code><br><br>'
      + 'Compare this with <em>What happens in the function...</em> in the functions folder, where an '
      + '<code>int</code> could not be changed. No <code>&amp;</code> and no <code>*</code> appear here — '
      + 'an array argument is already an address, so the function is working on YOUR array the whole time.',
      [{ title: 'Sample 1', content: 'Input:\n3\n1 2 3\nOutput:\n2 4 6' }],
      [{ name: 'doubles all three', stdin: '3\n1 2 3\n', expected: '2 4 6' },
       { name: 'with a negative', stdin: '2\n-5 0\n', expected: '-10 0' }],
      ['printf', 'scanf', 'array', 'function', 'loop']),

    _csProgram('ar-fn-fill', 'ar-fn', 'Fill an array you were given',
      'Write <code>void fillSquares(int A[], int size)</code> that puts <code>i * i</code> in each slot. '
      + 'Read <code>n</code> in <code>main</code>, call it, print the result on one line.<br><br>'
      + 'For <code>5</code>: <code>0 1 4 9 16</code><br><br>'
      + 'The caller owns the memory and the function fills it. That split — caller allocates, function '
      + 'writes — is the pattern the whole dynamic-memory folder is built on.',
      [{ title: 'Sample 1', content: 'Input:\n5\nOutput:\n0 1 4 9 16' }],
      [{ name: 'five squares', stdin: '5\n', expected: '0 1 4 9 16' },
       { name: 'just one', stdin: '1\n', expected: '0' }],
      ['printf', 'scanf', 'array', 'function', 'loop']),

    /* ── C · Operations ─────────────────────────────────────── */

    _csProgram('ar-search', 'ar-ops', 'Find it, or say it is not there',
      'Write <code>int findIt(int A[], int size, int target)</code> returning the INDEX of the first match, '
      + 'or <code>-1</code> if there is none. Read the array, then the target, and print the result.<br><br>'
      + 'For <code>5</code>, <code>4 8 15 16 23</code>, target <code>15</code>: <code>2</code><br><br>'
      + 'Linear search: look at each in turn, stop at the first hit. Returning <code>-1</code> for "not '
      + 'found" is a convention worth knowing — it is a value no valid index can ever be.',
      [{ title: 'Sample 1', content: 'Input:\n5\n4 8 15 16 23\n15\nOutput:\n2' }],
      [{ name: 'found in the middle', stdin: '5\n4 8 15 16 23\n15\n', expected: '2' },
       { name: 'not there', stdin: '3\n1 2 3\n99\n', expected: '-1' },
       { name: 'first one wins', stdin: '4\n7 7 7 7\n7\n', expected: '0' }],
      ['printf', 'scanf', 'array', 'function', 'loop']),

    _csProgram('ar-search-count', 'ar-ops', 'How many times does it appear',
      'Read the array and a target, and print how many times the target occurs.<br><br>'
      + 'For <code>5</code>, <code>1 2 2 3 2</code>, target <code>2</code>: <code>3</code><br><br>'
      + 'Searching stops at the first hit; counting cannot stop at all. Same loop, different job.',
      [{ title: 'Sample 1', content: 'Input:\n5\n1 2 2 3 2\n2\nOutput:\n3' }],
      [{ name: 'three times', stdin: '5\n1 2 2 3 2\n2\n', expected: '3' },
       { name: 'never', stdin: '3\n1 2 3\n9\n', expected: '0' }],
      ['printf', 'scanf', 'array', 'loop', 'if']),

    _csProgram('ar-insert', 'ar-ops', 'Insert at a position',
      'Read <code>n</code> and <code>n</code> numbers, then a position and a value. Insert the value AT '
      + 'that position and print the array, space separated.<br><br>'
      + 'For <code>4</code>, <code>1 2 4 5</code>, position <code>2</code>, value <code>3</code>: '
      + '<code>1 2 3 4 5</code><br><br>'
      + 'There is no gap to insert into — you have to MAKE one, by moving everything from the end down to '
      + 'the position one slot to the right. Move from the BACK forwards, or you overwrite the next '
      + 'element before you have copied it.',
      [{ title: 'Sample 1', content: 'Input:\n4\n1 2 4 5\n2 3\nOutput:\n1 2 3 4 5' }],
      [{ name: 'into the middle', stdin: '4\n1 2 4 5\n2 3\n', expected: '1 2 3 4 5' },
       { name: 'at the front', stdin: '3\n2 3 4\n0 1\n', expected: '1 2 3 4' },
       { name: 'at the end', stdin: '3\n1 2 3\n3 4\n', expected: '1 2 3 4' }],
      ['printf', 'scanf', 'array', 'loop']),

    _csProgram('ar-delete', 'ar-ops', 'Delete at a position',
      'Read <code>n</code>, the numbers, then a position. Remove the element at that position and print '
      + 'what is left.<br><br>'
      + 'For <code>5</code>, <code>1 2 3 4 5</code>, position <code>2</code>: <code>1 2 4 5</code><br><br>'
      + 'The mirror of insert: close the gap by moving everything after it one slot LEFT, and this time go '
      + 'forwards. Nothing is erased — the array just stops one earlier.',
      [{ title: 'Sample 1', content: 'Input:\n5\n1 2 3 4 5\n2\nOutput:\n1 2 4 5' }],
      [{ name: 'from the middle', stdin: '5\n1 2 3 4 5\n2\n', expected: '1 2 4 5' },
       { name: 'from the front', stdin: '3\n1 2 3\n0\n', expected: '2 3' },
       { name: 'from the end', stdin: '3\n1 2 3\n2\n', expected: '1 2' }],
      ['printf', 'scanf', 'array', 'loop']),

    _csProgram('ar-delete-value', 'ar-ops', 'Remove every copy of a value',
      'Read the array and a target, and print the array with EVERY occurrence of the target removed.<br><br>'
      + 'For <code>6</code>, <code>1 2 3 2 4 2</code>, target <code>2</code>: <code>1 3 4</code><br><br>'
      + 'Deleting one at a time works but shifts the same elements over and over. The neat way is one '
      + 'pass with two positions: walk with <code>i</code>, and keep a separate <code>out</code> that only '
      + 'advances when you keep something. This "read pointer, write pointer" pattern is everywhere.',
      [{ title: 'Sample 1', content: 'Input:\n6\n1 2 3 2 4 2\n2\nOutput:\n1 3 4' }],
      [{ name: 'three copies gone', stdin: '6\n1 2 3 2 4 2\n2\n', expected: '1 3 4' },
       { name: 'nothing to remove', stdin: '3\n1 2 3\n9\n', expected: '1 2 3' },
       { name: 'all removed', stdin: '3\n5 5 5\n5\n', expected: '' }],
      ['printf', 'scanf', 'array', 'loop', 'if']),

    _csProgram('ar-reverse-place', 'ar-ops', 'Actually turn it around',
      'Read the array and reverse it IN PLACE — not just print it backwards — then print it.<br><br>'
      + 'For <code>1 2 3 4</code>: <code>4 3 2 1</code><br><br>'
      + 'One index from each end, swap them, step both inwards, stop when they meet. The swap is the '
      + 'three-line temporary from tier 0, and you only go halfway — carry on and you reverse it back.',
      [{ title: 'Sample 1', content: 'Input:\n4\n1 2 3 4\nOutput:\n4 3 2 1' }],
      [{ name: 'even length', stdin: '4\n1 2 3 4\n', expected: '4 3 2 1' },
       { name: 'odd length', stdin: '5\n1 2 3 4 5\n', expected: '5 4 3 2 1' },
       { name: 'single element', stdin: '1\n7\n', expected: '7' }],
      ['printf', 'scanf', 'array', 'while']),

    _csProgram('ar-rotate', 'ar-ops', 'Rotate left by one',
      'Read the array and move every element one place left, with the first wrapping round to the end. '
      + 'Print the result.<br><br>For <code>1 2 3 4</code>: <code>2 3 4 1</code><br><br>'
      + 'Save the first element BEFORE the shifting starts. Once the loop has run, the value that used to '
      + 'be in <code>A[0]</code> is gone and no amount of care later will bring it back.',
      [{ title: 'Sample 1', content: 'Input:\n4\n1 2 3 4\nOutput:\n2 3 4 1' }],
      [{ name: 'four elements', stdin: '4\n1 2 3 4\n', expected: '2 3 4 1' },
       { name: 'two elements', stdin: '2\n8 9\n', expected: '9 8' }],
      ['printf', 'scanf', 'array', 'loop']),

    /* ── D · Two dimensions ─────────────────────────────────── */

    _csProgram('ar-2d-print', 'ar-grid', 'A grid in, a grid out',
      'Read <code>rows</code> and <code>cols</code>, then that many numbers, and print them back as a '
      + 'grid — each row on its own line, values separated by spaces.<br><br>'
      + 'For <code>2 3</code> then <code>1 2 3 4 5 6</code>:<br><code>1 2 3</code><br><code>4 5 6</code>'
      + '<br><br>'
      + '<code>int G[20][20];</code> and two nested loops — the outer one walks the rows, the inner one '
      + 'walks along a row. A trailing space per line is fine.',
      [{ title: 'Sample 1', content: 'Input:\n2 3\n1 2 3 4 5 6\nOutput:\n1 2 3\n4 5 6' }],
      [{ name: 'two by three', stdin: '2 3\n1 2 3 4 5 6\n', expected: '1 2 3\n4 5 6' },
       { name: 'one row', stdin: '1 4\n9 8 7 6\n', expected: '9 8 7 6' }],
      ['printf', 'scanf', 'array', 'nestedloop']),

    _csProgram('ar-2d-rowsum', 'ar-grid', 'Total each row',
      'Read a grid and print the total of each row, one per line.<br><br>'
      + 'For <code>2 3</code> then <code>1 2 3 4 5 6</code>:<br><code>6</code><br><code>15</code><br><br>'
      + 'The running total is reset for each row, which means it is declared INSIDE the outer loop. '
      + 'Declare it outside and every row after the first is wrong.',
      [{ title: 'Sample 1', content: 'Input:\n2 3\n1 2 3 4 5 6\nOutput:\n6\n15' }],
      [{ name: 'two rows', stdin: '2 3\n1 2 3 4 5 6\n', expected: '6\n15' },
       { name: 'negatives', stdin: '2 2\n-1 -2 5 5\n', expected: '-3\n10' }],
      ['printf', 'scanf', 'array', 'nestedloop']),

    _csProgram('ar-2d-colsum', 'ar-grid', 'Total each column',
      'Read a grid and print the total of each COLUMN, one per line.<br><br>'
      + 'For <code>2 3</code> then <code>1 2 3 4 5 6</code>:<br><code>5</code><br><code>7</code><br>'
      + '<code>9</code><br><br>'
      + 'The same grid, the loops the other way round: column on the outside, row on the inside. The data '
      + 'did not change — only the order you walked it.',
      [{ title: 'Sample 1', content: 'Input:\n2 3\n1 2 3 4 5 6\nOutput:\n5\n7\n9' }],
      [{ name: 'three columns', stdin: '2 3\n1 2 3 4 5 6\n', expected: '5\n7\n9' },
       { name: 'square grid', stdin: '2 2\n1 2 3 4\n', expected: '4\n6' }],
      ['printf', 'scanf', 'array', 'nestedloop']),

    _csProgram('ar-2d-max', 'ar-grid', 'The largest in the grid',
      'Read a grid and print the largest value with its row and column:<br><br>'
      + '<code>9 at 1 0</code><br><br>'
      + 'Track three things together — the best value and both of its coordinates — and update all three '
      + 'at once, or you will end up reporting one cell\'s value at another cell\'s position.',
      [{ title: 'Sample 1', content: 'Input:\n2 3\n1 2 3\n9 5 6\nOutput:\n9 at 1 0' }],
      [{ name: 'second row', stdin: '2 3\n1 2 3\n9 5 6\n', expected: '9 at 1 0' },
       { name: 'first cell', stdin: '2 2\n8 1\n2 3\n', expected: '8 at 0 0' },
       { name: 'all negative', stdin: '2 2\n-9 -4\n-7 -2\n', expected: '-2 at 1 1' }],
      ['printf', 'scanf', 'array', 'nestedloop'])
  ];

  return { challenges: challenges, nodes: nodes };
}
