/* ============================================================
   CODING-STARTER-C.JS — arrays, pointers, memory, and a bag
   ------------------------------------------------------------
   The second half of the starter pack: four folders that build toward the
   three exercises this was written for — printing a sentinel-terminated array,
   returning a malloc'd array from a function, and the count-then-allocate
   pattern.

   Every program here reads its input from stdin and prints an exact answer,
   because that is the only kind of exercise the checker can mark. The ideas
   that cannot be marked that way — why sizeof is useless inside a function,
   why you cannot return a local array — are taught in the descriptions and
   then made unavoidable by the task.

   The order matters and is not decoration. Sentinel arrays come before
   returning one, returning one comes before deciding how big it should be,
   and the bag at the end needs all of it at once.
   ============================================================ */

function codingStarterFundamentals() {
  const nodes = [
    { id: 'starter-folder-4', type: 'folder', name: 'E · Harder',              parentId: 'starter-folder-ar', scope: 'challenge', order: 4 },
    { id: 'starter-folder-5', type: 'folder', name: 'H · Harder, with pointers', parentId: 'starter-folder-ar', scope: 'challenge', order: 7 },
    { id: 'starter-folder-6', type: 'folder', name: '7 · Memory you ask for',  parentId: null, scope: 'challenge', order: -3 },
    { id: 'starter-folder-7', type: 'folder', name: '8 · Structs and a bag',   parentId: null, scope: 'challenge', order: -2 }
  ];

  const challenges = [

    /* ── 4 · Arrays ─────────────────────────────────────────── */

    _csProgram('arr-sum', 4, 'Add up an array',
      'Read a count <code>n</code>, then <code>n</code> whole numbers, and print their total.<br><br>'
      + 'Write the adding up as a function that takes the array <em>and</em> its size:<br>'
      + '<code>int total(int A[], int size)</code><br><br>'
      + 'It has to take the size because it cannot work it out. Inside a function, '
      + '<code>sizeof(A)</code> is the size of a <em>pointer</em>, not of the array — the array was never '
      + 'copied in, only its address was. That one fact is behind almost every array bug you will write this term.',
      [{ title: 'Sample 1', content: 'Input:\n5\n1 2 3 4 5\nOutput:\n15' }],
      [{ name: 'one to five', stdin: '5\n1 2 3 4 5\n', expected: '15' },
       { name: 'a single value', stdin: '1\n42\n', expected: '42' },
       { name: 'nothing to add', stdin: '0\n', expected: '0' },
       { name: 'negatives count too', stdin: '4\n10 -3 -7 5\n', expected: '5' }]),

    _csProgram('arr-largest', 4, 'The largest in an array',
      'Read a count <code>n</code>, then <code>n</code> whole numbers, and print the largest.<br><br>'
      + 'Again as a function taking the array and its size. Start your running maximum at the '
      + '<em>first element</em>, not at zero — with all-negative input, starting at zero gives you zero, '
      + 'which is not in the array at all.',
      [{ title: 'Sample 1', content: 'Input:\n5\n4 9 2 9 1\nOutput:\n9' }],
      [{ name: 'in the middle', stdin: '5\n4 9 2 9 1\n', expected: '9' },
       { name: 'at the end', stdin: '3\n1 2 3\n', expected: '3' },
       { name: 'all negative', stdin: '4\n-7 -2 -9 -30\n', expected: '-2' },
       { name: 'one element', stdin: '1\n-5\n', expected: '-5' }]),

    _csProgram('arr-sentinel', 4, 'Print until the sentinel',
      'Some arrays do not travel with a size. Instead the last slot holds a value that cannot be real '
      + 'data — a <strong>sentinel</strong> — and you stop when you reach it. Here it is <code>-1</code>.<br><br>'
      + 'Read whole numbers until you read <code>-1</code>, then print each one you read before it, in this exact form:<br>'
      + '<code>Array[0]: 3</code><br><br>'
      + 'Write the printing as <code>void printArr(int A[])</code> with no size parameter — the sentinel is the size. '
      + 'You will use this exact function for the rest of the pack.',
      [{ title: 'Sample 1', content: 'Input:\n3 5 7 -1\nOutput:\nArray[0]: 3\nArray[1]: 5\nArray[2]: 7' }],
      [{ name: 'three values', stdin: '3 5 7 -1\n', expected: 'Array[0]: 3\nArray[1]: 5\nArray[2]: 7' },
       { name: 'straight to the sentinel', stdin: '-1\n', expected: '' },
       { name: 'one value', stdin: '8 -1\n', expected: 'Array[0]: 8' }]),

    /* ── 5 · Pointers ───────────────────────────────────────── */

    _csProgram('ptr-swap', 5, 'Swap two numbers',
      'Read two whole numbers and print them swapped, separated by one space.<br><br>'
      + 'Do the swapping in <code>void swap(int* a, int* b)</code>. A function cannot change a caller\'s '
      + 'variable by taking a copy of it — it needs the <em>address</em>, which is what <code>&amp;x</code> gives you '
      + 'and what <code>int*</code> holds. Inside, <code>*a</code> means "the value at that address".<br><br>'
      + 'If your swap seems to do nothing, you almost certainly swapped the two pointers instead of the two values.',
      [{ title: 'Sample 1', content: 'Input:\n3 8\nOutput:\n8 3' }],
      [{ name: 'two values', stdin: '3 8\n', expected: '8 3' },
       { name: 'already in order', stdin: '9 1\n', expected: '1 9' },
       { name: 'the same twice', stdin: '4 4\n', expected: '4 4' }]),

    _csProgram('ptr-reverse', 5, 'Walk an array backwards',
      'Read a count <code>n</code>, then <code>n</code> whole numbers, and print them in reverse on one line, '
      + 'separated by single spaces.<br><br>'
      + 'Do it with a pointer rather than an index: set a pointer to the last element and step it back with '
      + '<code>p--</code> until it passes the first. <code>A + i</code> and <code>&amp;A[i]</code> are the same address, '
      + 'and <code>*(A + i)</code> and <code>A[i]</code> are the same value — the brackets are a convenience, nothing more.',
      [{ title: 'Sample 1', content: 'Input:\n4\n1 2 3 4\nOutput:\n4 3 2 1' }],
      [{ name: 'four values', stdin: '4\n1 2 3 4\n', expected: '4 3 2 1' },
       { name: 'one value', stdin: '1\n7\n', expected: '7' },
       { name: 'nothing at all', stdin: '0\n', expected: '' }]),

    _csProgram('ptr-minmax', 5, 'Two answers from one function',
      'Read a count <code>n</code>, then <code>n</code> whole numbers. Print the smallest and the largest on one '
      + 'line, separated by a space.<br><br>'
      + 'A function can only <code>return</code> one thing, so hand it somewhere to put the others:<br>'
      + '<code>void minMax(int A[], int size, int* min, int* max)</code><br><br>'
      + 'Call it with <code>minMax(arr, n, &amp;lo, &amp;hi)</code>. These are called out-parameters, and you will see '
      + 'them everywhere in C — it is how a function gives back more than one value.',
      [{ title: 'Sample 1', content: 'Input:\n5\n4 9 2 7 1\nOutput:\n1 9' }],
      [{ name: 'five values', stdin: '5\n4 9 2 7 1\n', expected: '1 9' },
       { name: 'one value is both', stdin: '1\n6\n', expected: '6 6' },
       { name: 'all negative', stdin: '3\n-4 -9 -2\n', expected: '-9 -2' }]),

    /* ── 6 · Memory you ask for ─────────────────────────────── */

    _csProgram('mem-fill', 6, 'Ask for room, then fill it',
      'Read <code>n</code> and print the first <code>n</code> square numbers on one line, separated by spaces '
      + '(1, 4, 9, 16, …). If <code>n</code> is below 1, print nothing.<br><br>'
      + 'Do it in an array you asked for at run time:<br>'
      + '<code>int* A = malloc(sizeof(int) * n);</code><br><br>'
      + 'Note the shape: <code>sizeof(the type) * how many</code>. Ask for <code>n</code> and you get room for '
      + '<code>n</code> ints, not <code>n</code> bytes. Check it is not <code>NULL</code>, and <code>free(A)</code> '
      + 'when you are finished — every <code>malloc</code> is a promise to call <code>free</code> once.',
      [{ title: 'Sample 1', content: 'Input:\n5\nOutput:\n1 4 9 16 25' }],
      [{ name: 'five squares', stdin: '5\n', expected: '1 4 9 16 25' },
       { name: 'just one', stdin: '1\n', expected: '1' },
       { name: 'none', stdin: '0\n', expected: '' }]),

    _csProgram('mem-return', 6, 'Give an array back',
      'Read a count <code>n</code>, then <code>n</code> whole numbers. Build a <em>new</em> array holding each '
      + 'value doubled, ending with a <code>-1</code> sentinel, and print it with your <code>printArr</code>.<br><br>'
      + 'The building goes in a function that returns the array:<br>'
      + '<code>int* doubleAll(int A[], int size)</code><br><br>'
      + 'It must be <code>malloc</code>ed. A local array inside the function stops existing the moment the function '
      + 'returns, and returning its address gives the caller a pointer to memory that is no longer theirs — it will '
      + 'often even seem to work, which is what makes it dangerous.<br><br>'
      + 'Room for <code>size + 1</code>, remember: the sentinel needs a slot too.',
      [{ title: 'Sample 1', content: 'Input:\n3\n1 2 4\nOutput:\nArray[0]: 2\nArray[1]: 4\nArray[2]: 8' }],
      [{ name: 'three values', stdin: '3\n1 2 4\n', expected: 'Array[0]: 2\nArray[1]: 4\nArray[2]: 8' },
       { name: 'one value', stdin: '1\n5\n', expected: 'Array[0]: 10' },
       { name: 'zero doubles to zero', stdin: '2\n0 7\n', expected: 'Array[0]: 0\nArray[1]: 14' }]),

    _csProgram('mem-multiples', 6, 'All the multiples',
      'Read a count <code>n</code>, then <code>n</code> whole numbers, then one more number <code>m</code>. '
      + 'Build a <code>malloc</code>ed array of just those values that divide exactly by <code>m</code>, ending '
      + 'with <code>-1</code>, and print it with <code>printArr</code>. Keep them in the order they arrived.<br><br>'
      + '<code>int* getAllMultiples(int A[], int sizeA, int mult)</code><br><br>'
      + 'The awkward part is that you do not know how big the answer is until you have looked. Two honest ways:<br>'
      + '<strong>Count first.</strong> Walk the array counting matches, allocate exactly that many plus one, walk '
      + 'again to fill it. Two passes, no waste.<br>'
      + '<strong>Collect then copy.</strong> Fill a temporary array big enough for the worst case, then allocate '
      + 'the exact size and <code>memcpy</code> into it. One pass, a little waste.<br><br>'
      + 'When nothing matches, return <code>NULL</code> — and then <code>printArr</code> must survive being handed '
      + 'it. Guard the top of the function with <code>if (A != NULL)</code> and print nothing.',
      [{ title: 'Sample 1', content: 'Input:\n7\n2 20 5 10 13 17 25\n5\nOutput:\nArray[0]: 20\nArray[1]: 5\nArray[2]: 10\nArray[3]: 25' },
       { title: 'Sample 2', content: 'Input:\n3\n1 2 3\n5\nOutput:' }],
      [{ name: 'multiples of five', stdin: '7\n2 20 5 10 13 17 25\n5\n',
         expected: 'Array[0]: 20\nArray[1]: 5\nArray[2]: 10\nArray[3]: 25' },
       { name: 'nothing matches, so NULL', stdin: '3\n1 2 3\n5\n', expected: '' },
       { name: 'everything matches', stdin: '3\n4 8 12\n4\n',
         expected: 'Array[0]: 4\nArray[1]: 8\nArray[2]: 12' },
       { name: 'zero is a multiple of everything', stdin: '2\n0 7\n3\n', expected: 'Array[0]: 0' }]),

    _csProgram('mem-pairs', 6, 'Every pair multiplied',
      'Read a count <code>sizeA</code> and that many numbers, then a count <code>sizeB</code> and that many more. '
      + 'Build a <code>malloc</code>ed array holding every <code>A[i] * B[j]</code> — A\'s first value against all '
      + 'of B, then A\'s second against all of B, and so on — ending with <code>-1</code>. Print it with '
      + '<code>printArr</code>.<br><br>'
      + '<code>int* multiplyArrays(int A[], int sizeA, int B[], int sizeB)</code><br><br>'
      + 'This one you <em>can</em> size in advance: there are exactly <code>sizeA * sizeB</code> products, plus one '
      + 'for the sentinel. Keep a single index <code>k</code> that only ever moves forward, and let the two loops '
      + 'take care of which pair you are on.<br><br>'
      + 'Whoever calls it owns the array afterwards and has to <code>free</code> it — a function that returns '
      + '<code>malloc</code>ed memory is handing over a responsibility as well as a pointer.',
      [{ title: 'Sample 1', content: 'Input:\n3\n1 2 4\n2\n3 5\nOutput:\nArray[0]: 3\nArray[1]: 5\nArray[2]: 6\nArray[3]: 10\nArray[4]: 12\nArray[5]: 20' }],
      [{ name: 'three by two', stdin: '3\n1 2 4\n2\n3 5\n',
         expected: 'Array[0]: 3\nArray[1]: 5\nArray[2]: 6\nArray[3]: 10\nArray[4]: 12\nArray[5]: 20' },
       { name: 'one by one', stdin: '1\n6\n1\n7\n', expected: 'Array[0]: 42' },
       { name: 'a zero in the mix', stdin: '2\n0 3\n2\n5 2\n',
         expected: 'Array[0]: 0\nArray[1]: 0\nArray[2]: 15\nArray[3]: 6' }]),

    /* ── 7 · Structs and a bag ──────────────────────────────── */

    _csProgram('struct-one', 7, 'One Pokemon',
      'A <code>struct</code> lets you keep things that belong together in one value:<br>'
      + '<code>typedef struct { char name[20]; int level; } Pokemon;</code><br><br>'
      + 'Read a name (one word, no spaces) and a level, put them in a <code>Pokemon</code>, and print it as:<br>'
      + '<code>pikachu (Lv. 12)</code><br><br>'
      + 'Note that <code>name</code> is an array inside the struct, so you cannot assign to it with <code>=</code> — '
      + 'read straight into it, or copy with <code>strcpy</code>.',
      [{ title: 'Sample 1', content: 'Input:\npikachu 12\nOutput:\npikachu (Lv. 12)' }],
      [{ name: 'a pokemon', stdin: 'pikachu 12\n', expected: 'pikachu (Lv. 12)' },
       { name: 'level one', stdin: 'magikarp 1\n', expected: 'magikarp (Lv. 1)' }]),

    _csProgram('struct-team', 7, 'The strongest of the team',
      'Read a count <code>n</code>, then <code>n</code> lines of <code>name level</code>. Print the name of the '
      + 'highest level. If two share the highest level, print the one that came first.<br><br>'
      + 'Keep them in an array of structs and walk it exactly as you walked an array of ints — a struct is just a '
      + 'bigger element. Pass the array and its size to a function that finds the best one, and have it return the '
      + '<em>index</em>: an index is safe to return where a pointer into a local array would not be.',
      [{ title: 'Sample 1', content: 'Input:\n3\nbulbasaur 5\ncharmander 9\nsquirtle 9\nOutput:\ncharmander' }],
      [{ name: 'a tie goes to the first', stdin: '3\nbulbasaur 5\ncharmander 9\nsquirtle 9\n', expected: 'charmander' },
       { name: 'the last is strongest', stdin: '2\nrattata 3\nsnorlax 40\n', expected: 'snorlax' },
       { name: 'a team of one', stdin: '1\neevee 7\n', expected: 'eevee' }]),

    _csProgram('poke-bag', 7, 'The bag',
      'Everything at once: a struct, an array of them that grows, and string comparison.<br><br>'
      + 'Read commands one per line until <code>END</code>:<br>'
      + '<code>ADD &lt;item&gt; &lt;qty&gt;</code> — put that many in. If the item is already in the bag, add to it '
      + 'rather than listing it twice.<br>'
      + '<code>USE &lt;item&gt; &lt;qty&gt;</code> — take that many out. If the bag does not hold that many, print '
      + '<code>Not enough &lt;item&gt;</code> and change nothing. If it empties the item, drop it from the bag.<br>'
      + '<code>LIST</code> — print every item as <code>&lt;name&gt; x&lt;qty&gt;</code>, in the order the items were '
      + 'first added. If the bag is empty, print <code>Bag is empty</code>.<br>'
      + '<code>END</code> — stop.<br><br>'
      + 'Hold the bag in a <code>malloc</code>ed array of structs and grow it with <code>realloc</code> when it '
      + 'fills. Two things to be careful of: <code>realloc</code> may move the block, so always assign its result '
      + 'back; and names compare with <code>strcmp(a, b) == 0</code>, never with <code>==</code>, which would '
      + 'compare two addresses and be false for identical words.<br><br>'
      + 'Item names are one word and under 20 characters.',
      [{ title: 'Sample 1', content: 'Input:\nADD potion 3\nADD pokeball 5\nADD potion 2\nLIST\nUSE potion 4\nLIST\nUSE pokeball 9\nEND\nOutput:\npotion x5\npokeball x5\npotion x1\npokeball x5\nNot enough pokeball' }],
      [{ name: 'adding, merging, using, listing',
         stdin: 'ADD potion 3\nADD pokeball 5\nADD potion 2\nLIST\nUSE potion 4\nLIST\nUSE pokeball 9\nEND\n',
         expected: 'potion x5\npokeball x5\npotion x1\npokeball x5\nNot enough pokeball' },
       { name: 'using the last one drops it',
         stdin: 'ADD potion 2\nUSE potion 2\nLIST\nEND\n', expected: 'Bag is empty' },
       { name: 'an empty bag',
         stdin: 'LIST\nEND\n', expected: 'Bag is empty' },
       { name: 'using what you do not have',
         stdin: 'USE potion 1\nEND\n', expected: 'Not enough potion' },
       { name: 'order is the order they were added',
         stdin: 'ADD c 1\nADD a 1\nADD b 1\nLIST\nEND\n', expected: 'c x1\na x1\nb x1' }])
  ];

  return { nodes: nodes, challenges: challenges };
}
