/* ============================================================
   CODING-STARTER-ADVANCED.JS — strings, recursion, grids, files
   ------------------------------------------------------------
   Folders 9 to 12 of the starter pack. The first eight take you from printing
   a line to a linked list; these four are the rest of a first C course, and
   they are aimed squarely at the two exam lists: structures and files for the
   final, multi-dimensional arrays alongside them, and the string and
   recursion work that everything else leans on.

   HARDER ON PURPOSE. The early folders accept any solution that prints the
   right answer. These do not: nearly every program here carries minimum
   requirements, so a task that says "write it as a recursive function" fails
   an iterative answer even when the output is perfect. That is the difference
   between practising output and practising the technique, and the technique
   is what an exam asks for.

   EVERY REFERENCE IS COMPILED AND RUN against every one of its own tests by
   tools/verify-pack.js before it ships. A reference that fails its own tests
   marks correct work wrong, silently.

   ON THE FILE FOLDER. Those programs write, read back and delete their own
   file in the working directory, so they are self-contained and need nothing
   set up. Whether they RUN depends on the engine behind Run Code allowing
   file access; the tests are stdin/stdout like everything else, so if an
   engine refuses, the failure is visible rather than silent.
   ============================================================ */

function codingStarterAdvanced() {
  const nodes = [
    { id: 'starter-folder-9',  type: 'folder', name: '9 · Strings',              parentId: null, scope: 'challenge', order: 8 },
    { id: 'starter-folder-10', type: 'folder', name: '10 · Functions and recursion', parentId: null, scope: 'challenge', order: 9 },
    { id: 'starter-folder-11', type: 'folder', name: '11 · Grids',               parentId: null, scope: 'challenge', order: 10 },
    { id: 'starter-folder-12', type: 'folder', name: '12 · Files',               parentId: null, scope: 'challenge', order: 11 }
  ];

  const challenges = [

    /* ── 9 · Strings ────────────────────────────────────────── */

    _csProgram('str-length', 9, 'Measure a word yourself',
      'Read one word and print how many characters it has — without calling '
      + '<code>strlen</code>.<br><br>'
      + 'Prompt: <code>Enter a word: </code>. Answer: <code>Length: N</code>.<br><br>'
      + 'A C string is a <code>char</code> array that ends at the first <code>\\0</code>. '
      + 'That terminator is not part of the length and it is not optional — it is the only '
      + 'thing telling a loop where to stop. Walk until you meet it and count the steps.',
      [{ title: 'Sample 1', content: 'Input:\nhello\nOutput:\nEnter a word: Length: 5' }],
      [{ name: 'hello', stdin: 'hello\n', expected: 'Enter a word: Length: 5' },
       { name: 'one letter', stdin: 'a\n', expected: 'Enter a word: Length: 1' },
       { name: 'a longer one', stdin: 'reincarnation\n', expected: 'Enter a word: Length: 13' }],
      ['loop', 'scanf']),

    _csProgram('str-reverse', 9, 'Reverse a word',
      'Read one word and print it backwards.<br><br>'
      + 'Prompt: <code>Enter a word: </code>. Answer: <code>Reversed: X</code>.<br><br>'
      + 'Find the end first, then walk back to the start. Printing from '
      + '<code>length - 1</code> down to <code>0</code> is the whole job — the trap is '
      + 'starting at <code>length</code>, which prints the terminator.',
      [{ title: 'Sample 1', content: 'Input:\nstressed\nOutput:\nEnter a word: Reversed: desserts' }],
      [{ name: 'stressed', stdin: 'stressed\n', expected: 'Enter a word: Reversed: desserts' },
       { name: 'a palindrome', stdin: 'level\n', expected: 'Enter a word: Reversed: level' },
       { name: 'one letter', stdin: 'x\n', expected: 'Enter a word: Reversed: x' }],
      ['loop', 'array']),

    _csProgram('str-vowels', 9, 'Count the vowels',
      'Read one word and count how many of its letters are vowels '
      + '(<code>a e i o u</code>, either case).<br><br>'
      + 'Prompt: <code>Enter a word: </code>. Answer: <code>Vowels: N</code>.<br><br>'
      + 'Handle upper and lower case. Comparing against ten characters works; so does '
      + 'lowering the letter first and comparing against five. The second is shorter and '
      + 'is the habit worth forming.',
      [{ title: 'Sample 1', content: 'Input:\nProgramming\nOutput:\nEnter a word: Vowels: 3' }],
      [{ name: 'Programming', stdin: 'Programming\n', expected: 'Enter a word: Vowels: 3' },
       { name: 'all of them', stdin: 'AEIOUaeiou\n', expected: 'Enter a word: Vowels: 10' },
       { name: 'none at all', stdin: 'rhythm\n', expected: 'Enter a word: Vowels: 0' }],
      ['loop', 'if']),

    _csProgram('str-palindrome', 9, 'Is it a palindrome?',
      'Read one word and say whether it reads the same backwards.<br><br>'
      + 'Prompt: <code>Enter a word: </code>. Answer: <code>Palindrome</code> or '
      + '<code>Not a palindrome</code>.<br><br>'
      + 'Two indexes, one at each end, walking toward each other. Stop the moment they '
      + 'disagree — checking the whole word when the first pair already failed is wasted '
      + 'work, and on a long string it is the difference that shows.',
      [{ title: 'Sample 1', content: 'Input:\nracecar\nOutput:\nEnter a word: Palindrome' },
       { title: 'Sample 2', content: 'Input:\nhello\nOutput:\nEnter a word: Not a palindrome' }],
      [{ name: 'racecar', stdin: 'racecar\n', expected: 'Enter a word: Palindrome' },
       { name: 'hello', stdin: 'hello\n', expected: 'Enter a word: Not a palindrome' },
       { name: 'even length', stdin: 'abba\n', expected: 'Enter a word: Palindrome' },
       { name: 'one letter', stdin: 'z\n', expected: 'Enter a word: Palindrome' }],
      ['loop', 'ifelse']),

    _csProgram('str-wordcount', 9, 'Count the words in a line',
      'Read a whole line and print how many words are in it.<br><br>'
      + 'Prompt: <code>Enter a line: </code>. Answer: <code>Words: N</code>.<br><br>'
      + 'A word starts where a non-space follows a space or the start of the line. Read the '
      + 'line with <code>fgets</code>, not <code>scanf("%s")</code> — <code>%s</code> stops '
      + 'at the first space, so it would only ever see the first word. Leading, trailing and '
      + 'repeated spaces all have to come out right.',
      [{ title: 'Sample 1', content: 'Input:\nthe quick brown fox\nOutput:\nEnter a line: Words: 4' }],
      [{ name: 'four words', stdin: 'the quick brown fox\n', expected: 'Enter a line: Words: 4' },
       { name: 'extra spaces', stdin: '   spaced   out   words   \n', expected: 'Enter a line: Words: 3' },
       { name: 'one word', stdin: 'alone\n', expected: 'Enter a line: Words: 1' },
       { name: 'nothing but spaces', stdin: '     \n', expected: 'Enter a line: Words: 0' }],
      ['loop', 'if', 'scanf']),

    /* ── 10 · Functions and recursion ───────────────────────── */

    _csProgram('rec-factorial', 10, 'Factorial, recursively',
      'Read a number <code>n</code> and print <code>n!</code> using a '
      + '<strong>recursive</strong> function.<br><br>'
      + 'Prompt: <code>Enter a number: </code>. Answer: <code>Factorial: N</code>.<br><br>'
      + 'Write <code>long long factorial(int n)</code> that calls itself. Every recursion needs '
      + 'a base case that returns without recursing — here <code>0! = 1</code> — and a '
      + 'step that moves toward it. Miss either and you get a stack overflow rather than an '
      + 'answer.<br><br>'
      + 'A loop is not accepted for this one: the requirement is the technique.',
      [{ title: 'Sample 1', content: 'Input:\n5\nOutput:\nEnter a number: Factorial: 120' }],
      [{ name: 'five', stdin: '5\n', expected: 'Enter a number: Factorial: 120' },
       { name: 'zero is one', stdin: '0\n', expected: 'Enter a number: Factorial: 1' },
       { name: 'one', stdin: '1\n', expected: 'Enter a number: Factorial: 1' },
       { name: 'a big one', stdin: '20\n', expected: 'Enter a number: Factorial: 2432902008176640000' }],
      ['recursion', 'function']),

    _csProgram('rec-fib', 10, 'Fibonacci, recursively',
      'Read <code>n</code> and print the <code>n</code>th Fibonacci number, counting from '
      + '<code>F(0) = 0</code> and <code>F(1) = 1</code>. Use recursion.<br><br>'
      + 'Prompt: <code>Enter a number: </code>. Answer: <code>Fibonacci: N</code>.<br><br>'
      + 'Two base cases this time, not one. Note how much work this repeats — '
      + '<code>fib(30)</code> computes <code>fib(10)</code> thousands of times. That is the '
      + 'honest cost of the naive version, and knowing it is the point of writing it.',
      [{ title: 'Sample 1', content: 'Input:\n10\nOutput:\nEnter a number: Fibonacci: 55' }],
      [{ name: 'ten', stdin: '10\n', expected: 'Enter a number: Fibonacci: 55' },
       { name: 'zero', stdin: '0\n', expected: 'Enter a number: Fibonacci: 0' },
       { name: 'one', stdin: '1\n', expected: 'Enter a number: Fibonacci: 1' },
       { name: 'twenty', stdin: '20\n', expected: 'Enter a number: Fibonacci: 6765' }],
      ['recursion', 'function']),

    _csProgram('rec-power', 10, 'Raise to a power, recursively',
      'Read a base and an exponent and print base to that power, using recursion.<br><br>'
      + 'Prompts: <code>Enter the base: </code> then <code>Enter the exponent: </code>.<br>'
      + 'Answer: <code>Result: N</code>.<br><br>'
      + 'Anything to the power of 0 is 1 — that is your base case. The exponent is never '
      + 'negative here.',
      [{ title: 'Sample 1', content: 'Input:\n2\n8\nOutput:\nEnter the base: Enter the exponent: Result: 256' }],
      [{ name: 'two to the eight', stdin: '2\n8\n', expected: 'Enter the base: Enter the exponent: Result: 256' },
       { name: 'anything to the zero', stdin: '7\n0\n', expected: 'Enter the base: Enter the exponent: Result: 1' },
       { name: 'four squared', stdin: '4\n2\n', expected: 'Enter the base: Enter the exponent: Result: 16' },
       { name: 'one stays one', stdin: '1\n30\n', expected: 'Enter the base: Enter the exponent: Result: 1' }],
      ['recursion', 'function']),

    _csProgram('rec-gcd', 10, 'Greatest common divisor',
      'Read two numbers and print their greatest common divisor, using recursion.<br><br>'
      + 'Prompts: <code>Enter the first number: </code> then <code>Enter the second number: </code>.<br>'
      + 'Answer: <code>GCD: N</code>.<br><br>'
      + 'Euclid: <code>gcd(a, 0) = a</code>, and otherwise '
      + '<code>gcd(a, b) = gcd(b, a % b)</code>. Four lines, and it is the oldest algorithm '
      + 'still in daily use.',
      [{ title: 'Sample 1', content: 'Input:\n48\n18\nOutput:\nEnter the first number: Enter the second number: GCD: 6' }],
      [{ name: 'forty-eight and eighteen', stdin: '48\n18\n', expected: 'Enter the first number: Enter the second number: GCD: 6' },
       { name: 'coprime', stdin: '17\n5\n', expected: 'Enter the first number: Enter the second number: GCD: 1' },
       { name: 'one divides the other', stdin: '100\n25\n', expected: 'Enter the first number: Enter the second number: GCD: 25' },
       { name: 'zero on the right', stdin: '9\n0\n', expected: 'Enter the first number: Enter the second number: GCD: 9' }],
      ['recursion', 'function']),

    _csProgram('fn-swap-ref', 10, 'By value and by reference',
      'Read two numbers, then print them swapped — doing the swapping inside a function '
      + 'that takes <strong>pointers</strong>.<br><br>'
      + 'Prompts: <code>Enter the first number: </code> then <code>Enter the second number: </code>.<br>'
      + 'Answer: <code>Swapped: A B</code>.<br><br>'
      + 'Write <code>void swap(int *a, int *b)</code>. A function taking <code>int a, int b</code> '
      + 'gets copies and can swap them all day without the caller ever noticing — this is the '
      + 'single most common way a first C program silently does nothing. The exam asks it as '
      + '"by reference versus by value"; this is that question.',
      [{ title: 'Sample 1', content: 'Input:\n3\n8\nOutput:\nEnter the first number: Enter the second number: Swapped: 8 3' }],
      [{ name: 'three and eight', stdin: '3\n8\n', expected: 'Enter the first number: Enter the second number: Swapped: 8 3' },
       { name: 'negatives', stdin: '-4\n9\n', expected: 'Enter the first number: Enter the second number: Swapped: 9 -4' },
       { name: 'the same twice', stdin: '5\n5\n', expected: 'Enter the first number: Enter the second number: Swapped: 5 5' }],
      ['function', 'pointer']),

    /* ── 11 · Grids ─────────────────────────────────────────── */

    _csProgram('grid-print', 11, 'Read and print a grid',
      'Read two numbers, rows and columns, then that many whole numbers, and print them '
      + 'back as a grid — one row per line, values separated by single spaces.<br><br>'
      + 'Prompts: <code>Enter rows: </code>, <code>Enter columns: </code>, then '
      + '<code>Enter the values: </code>.<br><br>'
      + 'Declare it as <code>int grid[10][10]</code> and use two nested loops. In C the second '
      + 'index moves fastest in memory, which is why row-by-row is the natural order to both '
      + 'fill and print.',
      [{ title: 'Sample 1', content: 'Input:\n2\n3\n1 2 3 4 5 6\nOutput:\nEnter rows: Enter columns: Enter the values: 1 2 3\n4 5 6' }],
      [{ name: 'two by three', stdin: '2\n3\n1 2 3 4 5 6\n',
         expected: 'Enter rows: Enter columns: Enter the values: 1 2 3\n4 5 6' },
       { name: 'a single cell', stdin: '1\n1\n7\n',
         expected: 'Enter rows: Enter columns: Enter the values: 7' },
       { name: 'one column', stdin: '3\n1\n4 5 6\n',
         expected: 'Enter rows: Enter columns: Enter the values: 4\n5\n6' }],
      ['nestedloop', 'array']),

    _csProgram('grid-rowsums', 11, 'Total each row',
      'Read a grid as before, then print the total of each row, one per line.<br><br>'
      + 'Prompts: <code>Enter rows: </code>, <code>Enter columns: </code>, '
      + '<code>Enter the values: </code>.<br>'
      + 'Answer lines: <code>Row N: total</code>, numbering from 0.<br><br>'
      + 'The outer loop picks the row and the inner one adds it up. Reset the running total '
      + 'at the top of each row — forgetting to is the classic nested-loop bug, and it '
      + 'gives you a running grand total instead.',
      [{ title: 'Sample 1', content: 'Input:\n2\n3\n1 2 3 4 5 6\nOutput:\nEnter rows: Enter columns: Enter the values: Row 0: 6\nRow 1: 15' }],
      [{ name: 'two by three', stdin: '2\n3\n1 2 3 4 5 6\n',
         expected: 'Enter rows: Enter columns: Enter the values: Row 0: 6\nRow 1: 15' },
       { name: 'negatives cancel', stdin: '1\n4\n5 -5 2 -2\n',
         expected: 'Enter rows: Enter columns: Enter the values: Row 0: 0' },
       { name: 'three rows', stdin: '3\n2\n1 1 2 2 3 3\n',
         expected: 'Enter rows: Enter columns: Enter the values: Row 0: 2\nRow 1: 4\nRow 2: 6' }],
      ['nestedloop', 'array']),

    _csProgram('grid-transpose', 11, 'Transpose a grid',
      'Read a grid and print its transpose — the same values with rows and columns '
      + 'swapped, so the cell at row <code>i</code> column <code>j</code> comes out at row '
      + '<code>j</code> column <code>i</code>.<br><br>'
      + 'Prompts: <code>Enter rows: </code>, <code>Enter columns: </code>, '
      + '<code>Enter the values: </code>.<br><br>'
      + 'The output has <code>columns</code> rows and <code>rows</code> columns. You do not '
      + 'need a second array — just print in the other order.',
      [{ title: 'Sample 1', content: 'Input:\n2\n3\n1 2 3 4 5 6\nOutput:\nEnter rows: Enter columns: Enter the values: 1 4\n2 5\n3 6' }],
      [{ name: 'two by three', stdin: '2\n3\n1 2 3 4 5 6\n',
         expected: 'Enter rows: Enter columns: Enter the values: 1 4\n2 5\n3 6' },
       { name: 'square', stdin: '2\n2\n1 2 3 4\n',
         expected: 'Enter rows: Enter columns: Enter the values: 1 3\n2 4' },
       { name: 'one row becomes one column', stdin: '1\n3\n7 8 9\n',
         expected: 'Enter rows: Enter columns: Enter the values: 7\n8\n9' }],
      ['nestedloop', 'array']),

    _csProgram('grid-diagonal', 11, 'The main diagonal',
      'Read a square grid and print the total of its main diagonal — the cells where the '
      + 'row number equals the column number.<br><br>'
      + 'Prompts: <code>Enter size: </code> then <code>Enter the values: </code>.<br>'
      + 'Answer: <code>Diagonal: N</code>.<br><br>'
      + 'This one needs no nested loop at all once you see it: a single index reaches '
      + '<code>grid[i][i]</code>. Writing the two-loop version first and then noticing is a '
      + 'fair way to arrive at it.',
      [{ title: 'Sample 1', content: 'Input:\n3\n1 2 3 4 5 6 7 8 9\nOutput:\nEnter size: Enter the values: Diagonal: 15' }],
      [{ name: 'three by three', stdin: '3\n1 2 3 4 5 6 7 8 9\n',
         expected: 'Enter size: Enter the values: Diagonal: 15' },
       { name: 'one cell', stdin: '1\n42\n', expected: 'Enter size: Enter the values: Diagonal: 42' },
       { name: 'two by two', stdin: '2\n1 2 3 4\n', expected: 'Enter size: Enter the values: Diagonal: 5' }],
      ['loop', 'array']),

    /* ── 12 · Files ─────────────────────────────────────────── */

    _csProgram('file-write-read', 12, 'Write a file, read it back',
      'Read a number, write it to a file called <code>data.txt</code>, close the file, open it '
      + 'again and read the number back, then print it.<br><br>'
      + 'Prompt: <code>Enter a number: </code>. Answer: <code>Read back: N</code>.<br><br>'
      + 'The shape is always the same: <code>fopen</code>, check it did not return '
      + '<code>NULL</code>, use it, <code>fclose</code>. Writing with <code>fprintf</code> and '
      + 'reading with <code>fscanf</code> works exactly like <code>printf</code> and '
      + '<code>scanf</code> with the stream named first.<br><br>'
      + 'Not closing before reopening is the bug that makes this print nothing — the value '
      + 'is still sitting in a buffer, not in the file.',
      [{ title: 'Sample 1', content: 'Input:\n42\nOutput:\nEnter a number: Read back: 42' }],
      [{ name: 'forty-two', stdin: '42\n', expected: 'Enter a number: Read back: 42' },
       { name: 'negative', stdin: '-7\n', expected: 'Enter a number: Read back: -7' },
       { name: 'zero', stdin: '0\n', expected: 'Enter a number: Read back: 0' }],
      ['scanf', 'printf']),

    _csProgram('file-lines', 12, 'Write several lines, count them',
      'Read a count <code>n</code>, then <code>n</code> whole numbers. Write each on its own '
      + 'line of <code>nums.txt</code>, then read the file back and print how many lines it had '
      + 'and what they add up to.<br><br>'
      + 'Prompts: <code>Enter how many: </code> then <code>Enter the numbers: </code>.<br>'
      + 'Answers: <code>Lines: N</code> then <code>Total: N</code>.<br><br>'
      + 'Read back with <code>while (fscanf(f, "%d", &v) == 1)</code>. Testing against '
      + '<code>1</code> — the number of items actually converted — is how you know a '
      + 'read succeeded; testing against <code>EOF</code> misses a malformed value.',
      [{ title: 'Sample 1', content: 'Input:\n4\n10 20 30 40\nOutput:\nEnter how many: Enter the numbers: Lines: 4\nTotal: 100' }],
      [{ name: 'four numbers', stdin: '4\n10 20 30 40\n',
         expected: 'Enter how many: Enter the numbers: Lines: 4\nTotal: 100' },
       { name: 'a single one', stdin: '1\n5\n',
         expected: 'Enter how many: Enter the numbers: Lines: 1\nTotal: 5' },
       { name: 'nothing at all', stdin: '0\n',
         expected: 'Enter how many: Enter the numbers: Lines: 0\nTotal: 0' }],
      ['loop', 'scanf']),

    _csProgram('file-structs', 12, 'A file of structures',
      'Read a count <code>n</code>, then <code>n</code> students — an ID number and a year '
      + 'level each. Write the whole array to <code>students.dat</code> in '
      + '<strong>binary</strong> with <code>fwrite</code>, read it back with '
      + '<code>fread</code>, and print each record.<br><br>'
      + 'Prompts: <code>Enter how many: </code> then <code>Enter the records: </code>.<br>'
      + 'Answer lines: <code>ID N year Y</code>.<br><br>'
      + 'This is the final\'s headline topic. <code>fwrite(arr, sizeof(Student), n, f)</code> '
      + 'writes <code>n</code> records in one call; <code>fread</code> takes the same shape and '
      + 'returns how many it actually got. Open with <code>"wb"</code> and <code>"rb"</code> — '
      + 'the <code>b</code> matters on Windows, where a plain <code>"w"</code> will quietly '
      + 'corrupt any byte that happens to look like a newline.',
      [{ title: 'Sample 1', content: 'Input:\n2\n1001 1 1002 3\nOutput:\nEnter how many: Enter the records: ID 1001 year 1\nID 1002 year 3' }],
      [{ name: 'two students', stdin: '2\n1001 1 1002 3\n',
         expected: 'Enter how many: Enter the records: ID 1001 year 1\nID 1002 year 3' },
       { name: 'one student', stdin: '1\n2024 4\n',
         expected: 'Enter how many: Enter the records: ID 2024 year 4' },
       { name: 'three of them', stdin: '3\n1 1 2 2 3 3\n',
         expected: 'Enter how many: Enter the records: ID 1 year 1\nID 2 year 2\nID 3 year 3' }],
      ['array', 'scanf']),

    _csProgram('file-seek', 12, 'Jump to a record',
      'Write <code>n</code> numbers to <code>seek.dat</code> in binary, then use '
      + '<code>fseek</code> to read back just the one at a given index — without reading '
      + 'the ones before it.<br><br>'
      + 'Prompts: <code>Enter how many: </code>, <code>Enter the numbers: </code>, '
      + '<code>Enter an index: </code>.<br>'
      + 'Answer: <code>Value: N</code>, or <code>Out of range</code> if the index is not '
      + 'there.<br><br>'
      + '<code>fseek(f, index * sizeof(int), SEEK_SET)</code> puts the cursor exactly where '
      + 'that record starts. This is what fixed-size records buy you: any record in one jump, '
      + 'no matter how big the file. <code>rewind(f)</code> is the same as seeking to 0.',
      [{ title: 'Sample 1', content: 'Input:\n5\n10 20 30 40 50\n2\nOutput:\nEnter how many: Enter the numbers: Enter an index: Value: 30' }],
      [{ name: 'the middle one', stdin: '5\n10 20 30 40 50\n2\n',
         expected: 'Enter how many: Enter the numbers: Enter an index: Value: 30' },
       { name: 'the first', stdin: '3\n7 8 9\n0\n',
         expected: 'Enter how many: Enter the numbers: Enter an index: Value: 7' },
       { name: 'the last', stdin: '3\n7 8 9\n2\n',
         expected: 'Enter how many: Enter the numbers: Enter an index: Value: 9' },
       { name: 'past the end', stdin: '3\n7 8 9\n5\n',
         expected: 'Enter how many: Enter the numbers: Enter an index: Out of range' }],
      ['loop', 'if'])
  ];

  return { nodes, challenges };
}
