/* ============================================================
   DEMO-LESSONS.JS — the walkthroughs themselves
   ------------------------------------------------------------
   One idea per lesson, one small COMPLETE program per lesson, walked a line at
   a time. Every step names the line it is on, what that line does, what the
   variables hold afterwards, and what has appeared on screen so far.

   Rules these follow, because a demonstration that cheats teaches nothing:

     * The code is a real program. It compiles, and the output shown is what it
       actually prints — nothing is summarised or tidied.
     * A step's `out` is the output SO FAR, not just the new part, because that
       is what a terminal looks like.
     * `vars` is what is in scope at that moment. A variable that has gone out
       of scope is dropped from the row rather than left showing a stale value.
     * Text a person typed is wrapped in ‸thin marks‸ so it can be drawn the way
       your own typing looks in a terminal, distinct from what the program wrote.

   `match` is how a lesson finds its programs: the minRequirements a program
   already declares, the folder it already sits in, and — as a last resort — a
   pattern in the reference solution. All three are authored data that exists
   for other reasons, so a new program joins the right walkthrough for free.
   ============================================================ */

const DEMO_LESSONS = [

  /* ══ Output ══════════════════════════════════════════════ */

  {
    id: 'printf',
    order: 10,
    group: 'Getting words out and values in',
    title: 'printf',
    tagline: 'Putting characters on the screen, and what \\n really does',
    icon: 'type',
    file: 'hello.c',
    match: { requires: ['printf'], folders: ['starter-folder-core-out'] },
    code:
`#include <stdio.h>

int main(void) {
    printf("Hello.\\n");
    printf("Goodbye.\\n");
    return 0;
}`,
    steps: [
      { line: 1, say: '<code>#include &lt;stdio.h&gt;</code> is how you ask for the standard <em>input/output</em> library. <code>printf</code> lives in there. Leave this line out and the compiler has never heard of it.' },
      { line: 3, say: '<code>main</code> is where the program starts. Every C program has exactly one, and the machine begins at its first line no matter where in the file it is written.' },
      { line: 4, say: 'This is the whole of printing: <code>printf</code> writes the characters between the quotes, exactly as written. No more, no less.', out: 'Hello.\n' },
      { line: 4, say: 'The <code>\\n</code> at the end is <strong>one character</strong> — a newline. It is not part of the word "Hello."; it is the instruction "move to the start of the next line". That is why the cursor is now waiting below.', out: 'Hello.\n' },
      { line: 5, say: 'The second <code>printf</code> runs after the first, because instructions run top to bottom. It starts on a fresh line — but only because the previous line ended with <code>\\n</code>.', out: 'Hello.\nGoodbye.\n' },
      {
        line: 4,
        code:
`#include <stdio.h>

int main(void) {
    printf("Hello.");
    printf("Goodbye.\\n");
    return 0;
}`,
        say: 'Here is the same program with that <code>\\n</code> taken out of line 4. Nothing else changed — and the two pieces of text run together, because nothing ever told the cursor to move.',
        out: 'Hello.Goodbye.\n'
      },
      { line: 6, say: '<code>return 0</code> from <code>main</code> means "this finished, and it went fine". Anything other than 0 is how a program reports that it did not.', out: 'Hello.\nGoodbye.\n' }
    ],
    recap: 'printf writes exactly what is between the quotes. A new line only happens where you put a <code>\\n</code>.'
  },

  {
    id: 'printf-values',
    order: 20,
    group: 'Getting words out and values in',
    title: 'Printing a value',
    tagline: '%d, %f and the second argument that fills them in',
    icon: 'hash',
    file: 'apples.c',
    // The printing tier, and specifically the programs there that print a
    // VALUE rather than a fixed line. It used to claim the variables and
    // operators tiers as well, which left the two lessons actually about
    // those tiers unable to outrank it on their own folders.
    match: { requires: ['printf'], folders: ['starter-folder-core-out'],
             code: /printf\s*\([^)]*%[-0-9.]*[a-zA-Z][^)]*,/ },
    code:
`#include <stdio.h>

int main(void) {
    int apples = 3;
    double price = 1.5;

    printf("I have %d apples.\\n", apples);
    printf("Each costs %.2f.\\n", price);
    printf("%d apples cost %.2f.\\n", apples, apples * price);
    return 0;
}`,
    steps: [
      { line: 4, say: '<code>int apples = 3;</code> makes a box called <code>apples</code> that can hold a whole number, and puts 3 in it.', vars: { apples: '3' } },
      { line: 5, say: '<code>double</code> is the box for a number with a fractional part. <code>1.5</code> would not fit in an <code>int</code> — it would be cut down to 1.', vars: { apples: '3', price: '1.5' } },
      { line: 7, say: 'The <code>%d</code> is a <strong>placeholder</strong>, not text. printf reaches for the next argument after the string — <code>apples</code> — and prints its value where the %d is.', vars: { apples: '3', price: '1.5' }, out: 'I have 3 apples.\n' },
      { line: 8, say: '<code>%f</code> is the placeholder for a <code>double</code>. The <code>.2</code> says "two digits after the point", which is why 1.5 prints as 1.50 rather than 1.500000.', vars: { apples: '3', price: '1.5' }, out: 'I have 3 apples.\nEach costs 1.50.\n' },
      { line: 9, say: 'Two placeholders, two arguments, in that order. The second one is an expression rather than a variable — printf gets the answer, 4.5, not the sum.', vars: { apples: '3', price: '1.5' }, out: 'I have 3 apples.\nEach costs 1.50.\n3 apples cost 4.50.\n' },
      { line: 9, say: 'The order is the whole contract: the first %d takes the first argument, the %.2f takes the second. Give it fewer arguments than placeholders and it prints whatever happens to be lying in memory.', vars: { apples: '3', price: '1.5' }, out: 'I have 3 apples.\nEach costs 1.50.\n3 apples cost 4.50.\n' }
    ],
    next: ['types'],
    recap: 'A <code>%</code> in the string is a hole; the arguments after the string fill the holes, left to right, one each.'
  },

  {
    id: 'scanf',
    order: 30,
    group: 'Getting words out and values in',
    title: 'scanf',
    tagline: 'Reading a value in — and the & everyone forgets',
    icon: 'keyboard',
    file: 'read.c',
    match: { requires: ['scanf'], folders: ['starter-folder-core-in'] },
    code:
`#include <stdio.h>

int main(void) {
    int n;

    printf("Enter a number: ");
    scanf("%d", &n);

    printf("You typed %d.\\n", n);
    return 0;
}`,
    steps: [
      { line: 4, say: '<code>int n;</code> makes the box but puts nothing in it. Right now <code>n</code> holds whatever was already at that address — reading it before it is set is a real bug, not a tidy zero.', vars: { n: '(nothing yet)' } },
      { line: 6, say: 'Print the prompt FIRST. There is no <code>\\n</code> on it deliberately: the cursor stays on the same line so what you type appears right after the colon.', vars: { n: '(nothing yet)' }, out: 'Enter a number: ' },
      { line: 7, say: 'The program stops here and waits. Nothing else runs until a value arrives.', vars: { n: '(nothing yet)' }, out: 'Enter a number: ' },
      { line: 7, say: 'You type <strong>5</strong> and press Enter. <code>"%d"</code> tells scanf to read a whole number — that is what it will accept and nothing else.', vars: { n: '5' }, out: 'Enter a number: ‸5‸\n' },
      { line: 7, say: 'Now the <code>&amp;</code>. printf is given a <em>value</em> to print; scanf has to be given somewhere to <em>put</em> one. <code>&amp;n</code> means "the address of n" — the box itself, not a copy of what is in it. Leave the &amp; off and scanf writes to whatever number happened to be in <code>n</code>, treated as an address.', vars: { n: '5' }, out: 'Enter a number: ‸5‸\n' },
      { line: 9, say: 'And now <code>n</code> really holds 5, so printing it prints 5.', vars: { n: '5' }, out: 'Enter a number: ‸5‸\nYou typed 5.\n' }
    ],
    next: ['string'],
    recap: 'Prompt, then <code>scanf("%d", &amp;n)</code>. The <code>&amp;</code> is not decoration — it is what lets scanf reach your variable.'
  },

  /* ══ Choices ═════════════════════════════════════════════ */

  {
    id: 'if',
    order: 40,
    group: 'Choosing what to do',
    title: 'if',
    tagline: 'Running a line only sometimes',
    icon: 'git-branch',
    file: 'pass.c',
    match: { requires: ['if'], folders: ['starter-folder-2'] },
    code:
`#include <stdio.h>

int main(void) {
    int score;

    printf("Enter a score: ");
    scanf("%d", &score);

    if (score >= 50) {
        printf("Pass\\n");
    }

    printf("Done\\n");
    return 0;
}`,
    steps: [
      { lines: [6, 7], say: 'Prompt, wait, read. You type <strong>72</strong>.', vars: { score: '72' }, out: 'Enter a score: ‸72‸\n' },
      { line: 9, say: 'The bracketed part is a <strong>question</strong>: is score at least 50? With score at 72 the answer is yes, so the block below runs.', vars: { score: '72' }, out: 'Enter a score: ‸72‸\n' },
      { line: 10, say: 'Inside the braces. This line only exists for the case where the question was yes.', vars: { score: '72' }, out: 'Enter a score: ‸72‸\nPass\n' },
      { line: 13, say: 'Outside the braces again. This runs whatever the answer was — the <code>if</code> guards its own block and nothing else.', vars: { score: '72' }, out: 'Enter a score: ‸72‸\nPass\nDone\n' },
      { line: 9, say: 'Now the same program with <strong>31</strong> typed instead. The question is no, so the whole block is skipped — not run and discarded, never entered at all.', vars: { score: '31' }, out: 'Enter a score: ‸31‸\n' },
      { line: 13, say: 'Execution carries on after the closing brace. "Pass" never appeared, "Done" still does.', vars: { score: '31' }, out: 'Enter a score: ‸31‸\nDone\n' },
      {
        line: 9,
        code:
`#include <stdio.h>

int main(void) {
    int score;

    printf("Enter a score: ");
    scanf("%d", &score);

    if (score = 50) {
        printf("Pass\\n");
    }

    printf("Done\\n");
    return 0;
}`,
        say: 'One character to watch for. <code>==</code> asks; <code>=</code> <em>assigns</em>. This version sets score to 50 and then treats 50 as "yes" — so it prints Pass for every input, and quietly destroys the score while it is at it.',
        vars: { score: '50' },
        out: 'Enter a score: ‸31‸\nPass\nDone\n'
      }
    ],
    recap: 'An <code>if</code> guards the block in its braces. <code>==</code> compares — <code>=</code> assigns, and is almost never what you meant inside an if.'
  },

  {
    id: 'ifelse',
    order: 50,
    group: 'Choosing what to do',
    title: 'if / else if / else',
    tagline: 'Exactly one branch, and why order matters',
    icon: 'split',
    file: 'grade.c',
    match: { requires: ['ifelse'], folders: ['starter-folder-2'] },
    code:
`#include <stdio.h>

int main(void) {
    int score;

    printf("Enter a score: ");
    scanf("%d", &score);

    if (score >= 75) {
        printf("Grade A\\n");
    } else if (score >= 50) {
        printf("Grade B\\n");
    } else {
        printf("Fail\\n");
    }

    return 0;
}`,
    steps: [
      { lines: [6, 7], say: 'You type <strong>62</strong>.', vars: { score: '62' }, out: 'Enter a score: ‸62‸\n' },
      { line: 9, say: 'First question: is it at least 75? No — 62 is not. So this block is skipped and the chain moves on.', vars: { score: '62' }, out: 'Enter a score: ‸62‸\n' },
      { line: 11, say: 'Second question, and it is only ever asked because the first was no. Is it at least 50? Yes.', vars: { score: '62' }, out: 'Enter a score: ‸62‸\n' },
      { line: 12, say: 'Grade B. And now the whole chain is finished — the <code>else</code> below is not even looked at.', vars: { score: '62' }, out: 'Enter a score: ‸62‸\nGrade B\n' },
      { line: 13, say: '<code>else</code> has no question. It is what happens when every question above it said no, so exactly one branch of the chain ever runs.', vars: { score: '62' }, out: 'Enter a score: ‸62‸\nGrade B\n' },
      {
        line: 9,
        code:
`#include <stdio.h>

int main(void) {
    int score;

    printf("Enter a score: ");
    scanf("%d", &score);

    if (score >= 50) {
        printf("Grade B\\n");
    } else if (score >= 75) {
        printf("Grade A\\n");
    } else {
        printf("Fail\\n");
    }

    return 0;
}`,
        say: 'The order is not cosmetic. Here the two tests are swapped, and a score of <strong>90</strong> hits <code>&gt;= 50</code> first — so it prints Grade B and never reaches the A. In a chain, the narrowest test goes first.',
        vars: { score: '90' },
        out: 'Enter a score: ‸90‸\nGrade B\n'
      }
    ],
    next: ['switch'],
    recap: 'A chain runs at most one branch, top to bottom. Put the tightest condition first, or a looser one above it will catch everything.'
  },

  /* ══ Repeating ═══════════════════════════════════════════ */

  {
    id: 'for',
    order: 60,
    group: 'Doing it again',
    title: 'The for loop',
    tagline: 'Start, keep going while, and step — in that order',
    icon: 'repeat',
    file: 'count.c',
    match: { requires: ['loop'], folders: ['starter-folder-lp-rep'] },
    code:
`#include <stdio.h>

int main(void) {
    int i;

    for (i = 1; i <= 3; i++) {
        printf("i is %d\\n", i);
    }

    printf("Done. i is %d\\n", i);
    return 0;
}`,
    steps: [
      { line: 6, say: 'Three parts, separated by semicolons. <code>i = 1</code> runs <strong>once</strong>, before anything else — it is the setup.', vars: { i: '1' } },
      { line: 6, say: '<code>i &lt;= 3</code> is checked BEFORE each pass. 1 is not more than 3, so we go in.', vars: { i: '1' } },
      { line: 7, say: 'The body. One pass.', vars: { i: '1' }, out: 'i is 1\n' },
      { line: 6, say: '<code>i++</code> runs at the END of the pass, then the condition is checked again. i is 2, still within 3.', vars: { i: '2' }, out: 'i is 1\n' },
      { line: 7, say: 'Second pass.', vars: { i: '2' }, out: 'i is 1\ni is 2\n' },
      { line: 6, say: 'i becomes 3. Still <code>&lt;= 3</code>, so there is one more.', vars: { i: '3' }, out: 'i is 1\ni is 2\n' },
      { line: 7, say: 'Third pass.', vars: { i: '3' }, out: 'i is 1\ni is 2\ni is 3\n' },
      { line: 6, say: 'i becomes 4. Now <code>4 &lt;= 3</code> is false, so the body does not run and the loop is over. The body ran three times; the condition was checked four.', vars: { i: '4' }, out: 'i is 1\ni is 2\ni is 3\n' },
      { line: 10, say: 'And this is the part that catches people: <code>i</code> is 4 out here, not 3. It has to be — being 4 is exactly what stopped the loop.', vars: { i: '4' }, out: 'i is 1\ni is 2\ni is 3\nDone. i is 4\n' }
    ],
    recap: 'Setup once, then check → body → step, over and over. When the loop ends, the counter has already gone one past the last value it used.'
  },

  {
    id: 'while',
    order: 70,
    group: 'Doing it again',
    title: 'while and do-while',
    tagline: 'Looping when you do not know how many times',
    icon: 'refresh-cw',
    file: 'countdown.c',
    match: { requires: ['while'], folders: ['starter-folder-lp-rep'] },
    code:
`#include <stdio.h>

int main(void) {
    int n = 3;

    while (n > 0) {
        printf("%d\\n", n);
        n--;
    }

    printf("Lift off\\n");
    return 0;
}`,
    steps: [
      { line: 4, say: 'A <code>for</code> keeps its three parts on one line. A <code>while</code> keeps only the question — the setup goes above it.', vars: { n: '3' } },
      { line: 6, say: 'Is n more than 0? Yes.', vars: { n: '3' } },
      { line: 7, say: 'Print it.', vars: { n: '3' }, out: '3\n' },
      { line: 8, say: '<code>n--</code> is the step, and here it is <strong>your job</strong>. A for loop would have done it for you. Forget this line and the condition never changes and the program never stops.', vars: { n: '2' }, out: '3\n' },
      { line: 6, say: 'Back to the top. 2 is still more than 0.', vars: { n: '2' }, out: '3\n' },
      { lines: [7, 8], say: 'Print, decrement. Again.', vars: { n: '1' }, out: '3\n2\n' },
      { lines: [7, 8], say: 'And once more.', vars: { n: '0' }, out: '3\n2\n1\n' },
      { line: 6, say: 'Now <code>0 &gt; 0</code> is false. The loop ends without running the body again.', vars: { n: '0' }, out: '3\n2\n1\n' },
      { line: 11, say: 'Out the bottom.', vars: { n: '0' }, out: '3\n2\n1\nLift off\n' },
      {
        line: 6,
        code:
`#include <stdio.h>

int main(void) {
    int n = 0;

    do {
        printf("%d\\n", n);
        n--;
    } while (n > 0);

    printf("Lift off\\n");
    return 0;
}`,
        say: 'A <code>do-while</code> asks the question at the BOTTOM, so the body always runs at least once. Here n starts at 0 — a plain while would print nothing at all, and this prints 0.',
        vars: { n: '-1' },
        out: '0\nLift off\n'
      }
    ],
    next: ['do-while', 'break-continue'],
    recap: 'A while checks first and might never run; a do-while checks last and always runs once. Either way, moving the condition along is on you.'
  },

  {
    id: 'nestedloop',
    order: 80,
    group: 'Doing it again',
    title: 'A loop inside a loop',
    tagline: 'How a triangle of stars actually gets drawn',
    icon: 'grid-3x3',
    file: 'triangle.c',
    match: { requires: ['nestedloop'], folders: ['starter-folder-lp-pat'] },
    code:
`#include <stdio.h>

int main(void) {
    int row, col;

    for (row = 1; row <= 3; row++) {
        for (col = 1; col <= row; col++) {
            printf("*");
        }
        printf("\\n");
    }

    return 0;
}`,
    steps: [
      { line: 6, say: 'The outer loop counts ROWS. It will run three times, and each one of those runs is a whole line of output.', vars: { row: '1' } },
      { line: 7, say: 'The inner loop counts COLUMNS — and look at its limit: <code>col &lt;= row</code>. It is not a fixed number, it is however many this row needs. On row 1 that is one star.', vars: { row: '1', col: '1' } },
      { line: 8, say: 'One star. No <code>\\n</code> — the stars of a row have to stay on the same line.', vars: { row: '1', col: '1' }, out: '*' },
      { line: 7, say: 'col becomes 2, which is more than row, so the inner loop is finished for this row.', vars: { row: '1', col: '2' }, out: '*' },
      { line: 10, say: 'THIS is the newline, and it is outside the inner loop and inside the outer one. That placement is the whole shape: one line break per row.', vars: { row: '1', col: '2' }, out: '*\n' },
      { line: 6, say: 'Outer loop steps. row is 2 — and the inner loop restarts from col = 1 every time.', vars: { row: '2', col: '1' }, out: '*\n' },
      { lines: [7, 8], say: 'Two stars this time, because the inner limit follows row.', vars: { row: '2', col: '3' }, out: '*\n**' },
      { line: 10, say: 'End of row 2.', vars: { row: '2', col: '3' }, out: '*\n**\n' },
      { lines: [7, 8], say: 'Row 3: three stars.', vars: { row: '3', col: '4' }, out: '*\n**\n***' },
      { line: 10, say: 'End of row 3, and the outer loop is done.', vars: { row: '3', col: '4' }, out: '*\n**\n***\n' }
    ],
    recap: 'The outer loop is rows, the inner is what goes in one row, and the <code>\\n</code> belongs between them. Make the inner limit depend on the outer counter and you get a shape.'
  },

  /* ══ Functions ═══════════════════════════════════════════ */

  {
    id: 'function',
    order: 90,
    group: 'Functions',
    title: 'Writing your own function',
    tagline: 'Give it something, get something back',
    icon: 'box',
    file: 'square.c',
    match: { requires: ['function'], folders: ['starter-folder-fn-basics', 'starter-folder-fn-value'] },
    code:
`#include <stdio.h>

int square(int n) {
    return n * n;
}

int main(void) {
    int result = square(4);

    printf("%d\\n", result);
    printf("%d\\n", square(9));
    return 0;
}`,
    steps: [
      { line: 3, say: 'Read the header from the outside in. <code>int square(int n)</code> — it is called square, you must hand it one <code>int</code>, and it hands back an <code>int</code>.' },
      { line: 3, say: '<code>n</code> is the <strong>parameter</strong>: a name for whatever gets handed in. It does not exist yet; nothing is running.' },
      { line: 7, say: 'The program starts here, not at the top of the file. Writing square above main does not run it.' },
      { line: 8, say: 'The call. <code>4</code> is the <strong>argument</strong> — the actual value. Execution jumps up to square.', vars: { '(main) result': '(not yet)' } },
      { line: 4, say: 'Now <code>n</code> exists and holds 4. Inside square, that is the only variable there is — it cannot see anything in main.', vars: { '(square) n': '4' } },
      { line: 4, say: '<code>return</code> does two things at once: it works out <code>4 * 4</code>, and it ends square immediately, handing 16 back to whoever called it.', vars: { '(square) n': '4' } },
      { line: 8, say: 'Back in main, and the call has become its answer. <code>square(4)</code> is 16, so that is what goes into result. <code>n</code> is gone — it only existed while square was running.', vars: { '(main) result': '16' } },
      { line: 10, say: 'Print it.', vars: { '(main) result': '16' }, out: '16\n' },
      { line: 11, say: 'And you can use a call anywhere a value fits — no variable needed. This runs square again with a different argument and prints the answer straight out.', vars: { '(main) result': '16' }, out: '16\n81\n' }
    ],
    next: ['pass-by-value'],
    recap: 'A function is a named block with an entrance (parameters) and an exit (return). The call becomes the returned value, right where you wrote it.'
  },

  {
    id: 'pass-by-value',
    order: 100,
    group: 'Functions',
    title: 'Pass by value',
    tagline: 'Why the number you changed is unchanged when you get back',
    icon: 'copy',
    file: 'byvalue.c',
    match: {
      requires: ['function'],
      folders: ['starter-folder-fn-basics'],
      code: /\b(void|int)\s+\w+\s*\(\s*int\s+\w+\s*\)/
    },
    code:
`#include <stdio.h>

void addTen(int n) {
    n = n + 10;
    printf("inside:  n is %d\\n", n);
}

int main(void) {
    int score = 5;

    addTen(score);
    printf("outside: score is %d\\n", score);
    return 0;
}`,
    steps: [
      { line: 9, say: 'main makes a box called <code>score</code> with 5 in it. Hold on to that: 5.', vars: { 'main · score': '5' } },
      { line: 11, say: 'The call. And here is the thing the whole lesson is about — C does not hand the function your box. It <strong>copies what is in it</strong>.', vars: { 'main · score': '5' } },
      { line: 3, say: 'A second, separate box is made, called <code>n</code>, and the value 5 is copied into it. Watch the 5 travel: two boxes now, holding the same number and with nothing else to do with each other.', vars: { 'main · score': '5', 'addTen · n': '5' }, flow: { from: 'score', to: 'n', label: '5' } },
      { line: 4, say: '<code>n = n + 10</code>. This changes <strong>n</strong>. Watch score: it does not move, because nobody touched it.', vars: { 'main · score': '5', 'addTen · n': '15' } },
      { line: 5, say: 'Print from inside, and n really is 15. The function did exactly what it was asked.', vars: { 'main · score': '5', 'addTen · n': '15' }, out: 'inside:  n is 15\n' },
      { line: 6, say: 'addTen ends — and <code>n</code> ceases to exist. It was a local copy, and its lifetime was the call.', vars: { 'main · score': '5' }, out: 'inside:  n is 15\n' },
      { line: 12, say: 'Back in main. <code>score</code> is still 5. Nothing went wrong; the function was never given anything that could change it.', vars: { 'main · score': '5' }, out: 'inside:  n is 15\noutside: score is 5\n' },
      { line: 11, say: 'This is <strong>pass by value</strong>, and it is the default for every plain variable in C. A function receives copies, so it cannot reach back and alter its caller\'s variables — which is usually exactly what you want.', vars: { 'main · score': '5' }, out: 'inside:  n is 15\noutside: score is 5\n' }
    ],
    next: ['pointer', 'pass-by-reference'],
    recap: 'The function got a copy, changed the copy, and the copy went away. If you need the caller\'s variable to change, you have to give the function its address — that is the next walkthrough.'
  },

  /* ══ Pointers ════════════════════════════════════════════ */

  {
    id: 'pointer',
    order: 110,
    group: 'Pointers',
    title: 'Pointers',
    tagline: 'A second name for a box you already have',
    icon: 'crosshair',
    file: 'pointer.c',
    match: { requires: ['pointer'], folders: ['starter-folder-ptr-what'] },
    code:
`#include <stdio.h>

int main(void) {
    int score = 5;
    int *p = &score;

    printf("score is %d\\n", score);
    printf("p points at %d\\n", *p);

    *p = 99;
    printf("score is now %d\\n", score);
    return 0;
}`,
    steps: [
      { line: 4, say: 'An ordinary variable. It holds 5, and it lives somewhere in memory — say address 1000. You never normally care where.', vars: { score: '5' } },
      { line: 5, say: 'Two new pieces of notation, and they are opposites. <code>&amp;score</code> means "the ADDRESS of score" — 1000, not 5.', vars: { score: '5' } },
      { line: 5, say: '<code>int *p</code> declares p as "a thing that holds the address of an int". So p holds 1000 — and the arrow IS what that means: p is a box too, and what is inside it is a location.', vars: { score: '5', p: '1000' }, ptrs: { p: 'score' } },
      { line: 7, say: 'Printing score prints 5, the way it always did. Nothing about score has changed.', vars: { score: '5', p: '1000' }, ptrs: { p: 'score' }, out: 'score is 5\n' },
      { line: 8, say: '<code>*p</code> is the other direction: follow the arrow and use what is at the end of it. This is called <strong>dereferencing</strong>.', vars: { score: '5', p: '1000' }, ptrs: { p: 'score' }, out: 'score is 5\np points at 5\n' },
      { line: 10, say: 'And it works as a destination too. <code>*p = 99</code> means "follow the arrow and put 99 there". It never mentions score by name.', vars: { score: '99', p: '1000' }, ptrs: { p: 'score' }, out: 'score is 5\np points at 5\n' },
      { line: 11, say: 'But the arrow ends at score, so score is 99 now. That is the whole point of a pointer: a second way to reach one box.', vars: { score: '99', p: '1000' }, ptrs: { p: 'score' }, out: 'score is 5\np points at 5\nscore is now 99\n' }
    ],
    next: ['pass-by-reference', 'pointer-array'],
    recap: '<code>&amp;x</code> gets the address of x. <code>*p</code> uses whatever is at the address in p — to read it, or to write to it.'
  },

  {
    id: 'pass-by-reference',
    order: 120,
    group: 'Pointers',
    title: 'Pass by reference',
    tagline: 'Handing a function the box instead of a copy of what is in it',
    icon: 'share-2',
    file: 'byref.c',
    match: { requires: ['pointer', 'function'], folders: ['starter-folder-ptr-fn'] },
    code:
`#include <stdio.h>

void addTen(int *n) {
    *n = *n + 10;
}

int main(void) {
    int score = 5;

    addTen(&score);
    printf("score is %d\\n", score);
    return 0;
}`,
    steps: [
      { line: 8, say: 'Same start as the pass-by-value walkthrough: score holds 5, at some address — say 1000.', vars: { 'main · score': '5' } },
      { line: 10, say: 'And here is the one difference that changes everything: <code>&amp;score</code>. We are not handing over the value 5 — we are handing over the ADDRESS 1000.', vars: { 'main · score': '5' } },
      { line: 3, say: 'So the parameter has to be able to hold an address: <code>int *n</code>. A copy is still made — but it is a copy of the ADDRESS, and a copy of an address still points at the original box.', vars: { 'main · score': '5', 'addTen · n': '1000' }, ptrs: { n: 'score' }, flow: { from: 'score', to: 'n', label: '&score' } },
      { line: 4, say: '<code>*n</code> reads through the address: follow the arrow, find 5. Add ten to get 15.', vars: { 'main · score': '5', 'addTen · n': '1000' }, ptrs: { n: 'score' } },
      { line: 4, say: 'And <code>*n =</code> writes through it: follow the arrow, put 15 there. That box belongs to main — watch it change from inside the function.', vars: { 'main · score': '15', 'addTen · n': '1000' }, ptrs: { n: 'score' } },
      { line: 5, say: 'addTen ends and <code>n</code> disappears, exactly like last time. But what it did while it was alive was permanent, because it reached outside itself.', vars: { 'main · score': '15' } },
      { line: 11, say: 'score is 15. The function changed its caller\'s variable — that is <strong>pass by reference</strong>.', vars: { 'main · score': '15' }, out: 'score is 15\n' },
      {
        lines: [3, 7],
        code:
`#include <stdio.h>

void swap(int *a, int *b) {
    int temp = *a;
    *a = *b;
    *b = temp;
}

int main(void) {
    int x = 1, y = 2;

    swap(&x, &y);
    printf("x=%d y=%d\\n", x, y);
    return 0;
}`,
        say: 'The classic case, and the one that cannot be done any other way: swapping two of the caller\'s variables. A by-value version would swap its own two copies and change nothing. Note <code>temp</code> is a plain <code>int</code> — it holds a value, not an address.',
        vars: { 'main · x': '2', 'main · y': '1' },
        out: 'x=2 y=1\n'
      }
    ],
    recap: 'Pass <code>&amp;x</code>, receive <code>int *n</code>, and use <code>*n</code> to read and write the caller\'s box. It is the only way a function can change a plain variable it was given.'
  },

  /* ══ Arrays ══════════════════════════════════════════════ */

  {
    id: 'array',
    order: 130,
    group: 'Arrays',
    title: 'Arrays',
    tagline: 'A row of boxes, counted from zero',
    icon: 'rows-3',
    file: 'marks.c',
    match: { requires: ['array'], folders: ['starter-folder-ar-one'] },
    code:
`#include <stdio.h>

int main(void) {
    int marks[5] = {70, 82, 55, 91, 64};
    int i;

    printf("first is %d\\n", marks[0]);
    printf("last is %d\\n", marks[4]);

    for (i = 0; i < 5; i++) {
        printf("%d ", marks[i]);
    }
    printf("\\n");
    return 0;
}`,
    steps: [
      { line: 4, say: 'One name, five boxes, side by side in memory. The <code>5</code> is how many, and it is fixed forever the moment you write it.', vars: { 'marks[0..4]': '70 82 55 91 64' } },
      { line: 7, say: 'The first one is <code>marks[0]</code>, not marks[1]. The index is an OFFSET — "how far along from the start" — and the first box is zero boxes along.', vars: { 'marks[0..4]': '70 82 55 91 64' }, out: 'first is 70\n' },
      { line: 8, say: 'So five boxes are numbered 0, 1, 2, 3, 4 — and the last index is one less than the size. <code>marks[5]</code> would be off the end.', vars: { 'marks[0..4]': '70 82 55 91 64' }, out: 'first is 70\nlast is 64\n' },
      { line: 8, say: 'And C will not stop you writing <code>marks[5]</code>. There is no check. It reads whatever memory sits after your array and carries on as if nothing happened, which is why array bugs are so hard to see.', vars: { 'marks[0..4]': '70 82 55 91 64' }, out: 'first is 70\nlast is 64\n' },
      { line: 10, say: 'This is the shape of nearly every array loop you will write: start at 0, keep going while <code>i &lt; size</code>. Not <code>&lt;=</code> — that would step one past the end.', vars: { i: '0', 'marks[0..4]': '70 82 55 91 64' }, out: 'first is 70\nlast is 64\n' },
      { line: 11, say: 'The index does not have to be a number you typed. <code>marks[i]</code> means "the box i along", and i changes on every pass.', vars: { i: '0', 'marks[i]': '70' }, out: 'first is 70\nlast is 64\n70 ' },
      { line: 11, say: 'i is 1, so this is the second box.', vars: { i: '1', 'marks[i]': '82' }, out: 'first is 70\nlast is 64\n70 82 ' },
      { line: 11, say: '…and on to the end.', vars: { i: '4', 'marks[i]': '64' }, out: 'first is 70\nlast is 64\n70 82 55 91 64 ' },
      { line: 13, say: 'i reaches 5, the condition fails, the loop stops — having touched every box exactly once.', vars: { i: '5' }, out: 'first is 70\nlast is 64\n70 82 55 91 64 \n' }
    ],
    next: ['array-function', 'array-ops'],
    recap: 'Indexes run 0 to size-1. Loop with <code>i &lt; size</code>, and remember that C never checks whether you went off the end.'
  },

  {
    id: 'array-function',
    order: 140,
    group: 'Arrays',
    title: 'Passing an array to a function',
    tagline: 'The one thing that is NOT copied — and why sizeof lies',
    icon: 'move-right',
    file: 'arrfn.c',
    match: { requires: ['array', 'function'], folders: ['starter-folder-ar-fn'] },
    code:
`#include <stdio.h>

int total(int a[], int n) {
    int i, sum = 0;
    for (i = 0; i < n; i++) {
        sum = sum + a[i];
    }
    return sum;
}

void bump(int a[], int n) {
    int i;
    for (i = 0; i < n; i++) {
        a[i] = a[i] + 1;
    }
}

int main(void) {
    int marks[3] = {10, 20, 30};

    printf("total %d\\n", total(marks, 3));
    bump(marks, 3);
    printf("total %d\\n", total(marks, 3));
    return 0;
}`,
    steps: [
      { line: 19, say: 'Three boxes: 10, 20, 30.', vars: { 'main · marks': '10 20 30' } },
      { line: 21, say: 'Passing an array does NOT copy it. What actually gets handed over is the address of its first box — even though the parameter is written <code>int a[]</code>.', vars: { 'main · marks': '10 20 30' } },
      { line: 3, say: 'So inside, <code>a</code> is not a row of boxes. It is a pointer to main\'s row. <code>int a[]</code> and <code>int *a</code> mean exactly the same thing in a parameter list.', vars: { 'main · marks': '10 20 30', 'total · a': '→ main\'s marks' } },
      { line: 3, say: 'And that is why <code>n</code> has to be there. The function cannot work out how long the array is — <code>sizeof(a)</code> in here gives the size of a POINTER, not of the array. The length has to be told.', vars: { 'main · marks': '10 20 30', 'total · n': '3' } },
      { lines: [5, 6], say: 'Adding up through the pointer. Reading is harmless.', vars: { 'total · sum': '60', 'total · i': '3' } },
      { line: 21, say: '60.', vars: { 'main · marks': '10 20 30' }, out: 'total 60\n' },
      { line: 22, say: 'Now the interesting one. <code>bump</code> takes the same kind of parameter — and it WRITES.', vars: { 'main · marks': '10 20 30' }, out: 'total 60\n' },
      { line: 14, say: '<code>a[i] = a[i] + 1</code>. There is no copy to protect main\'s array, so this changes main\'s boxes directly.', vars: { 'main · marks': '11 21 31' }, out: 'total 60\n' },
      { line: 23, say: 'Back in main, and the array really has changed: 63, not 60. An <code>int</code> passed to a function is safe from it; an array is not, and nothing in the call looks any different.', vars: { 'main · marks': '11 21 31' }, out: 'total 60\ntotal 63\n' }
    ],
    next: ['pointer-array'],
    recap: 'An array argument becomes a pointer. The function can change your data, it cannot measure it, and you must pass the length yourself.'
  },

  /* ══ Recursion ═══════════════════════════════════════════ */

  {
    id: 'recursion',
    order: 150,
    group: 'Functions',
    title: 'Recursion',
    tagline: 'A function that calls itself, and the line that stops it',
    icon: 'iteration-cw',
    file: 'fact.c',
    match: { requires: ['recursion'], folders: ['starter-folder-10'] },
    code:
`#include <stdio.h>

int factorial(int n) {
    if (n <= 1) {
        return 1;
    }
    return n * factorial(n - 1);
}

int main(void) {
    printf("%d\\n", factorial(4));
    return 0;
}`,
    steps: [
      { line: 11, say: 'Call it with 4.', vars: { 'factorial(4)': 'running' } },
      { line: 4, say: 'First, the way OUT. Every recursive function needs a case that answers without calling itself — leave this off and it never stops.', vars: { 'factorial(4)': 'n = 4' } },
      { line: 7, say: '4 is not ≤ 1, so: 4 times whatever factorial(3) turns out to be. That inner call has to finish before this multiplication can happen, so this one is put on hold.', vars: { 'factorial(4)': 'waiting on factorial(3)' } },
      { line: 7, say: 'factorial(3) does the same: 3 times factorial(2). Two calls are now paused, each holding its own <code>n</code>.', vars: { 'factorial(4)': 'waiting', 'factorial(3)': 'waiting on factorial(2)' } },
      { line: 7, say: 'And again: 2 times factorial(1). Three paused.', vars: { 'factorial(4)': 'waiting', 'factorial(3)': 'waiting', 'factorial(2)': 'waiting on factorial(1)' } },
      { line: 5, say: 'factorial(1) hits the base case and returns 1 outright. Nothing further is called — the descent stops here.', vars: { 'factorial(1)': 'returns 1' } },
      { line: 7, say: 'Now they finish in reverse. factorial(2) was waiting for that 1: 2 × 1 = 2.', vars: { 'factorial(2)': 'returns 2' } },
      { line: 7, say: 'factorial(3): 3 × 2 = 6.', vars: { 'factorial(3)': 'returns 6' } },
      { line: 7, say: 'factorial(4): 4 × 6 = 24. The outermost call was the first to start and the last to finish.', vars: { 'factorial(4)': 'returns 24' } },
      { line: 11, say: '24.', out: '24\n' }
    ],
    recap: 'Base case first, then a call that moves toward it. The calls stack up on the way down and are finished off in reverse on the way back.'
  }
,

  /* ══ Arrays, continued ═══════════════════════════════════ */

  {
    id: 'array-ops',
    order: 145,
    group: 'Arrays',
    title: 'Insert and delete',
    tagline: 'Making room, and closing the gap',
    icon: 'list-plus',
    file: 'ops.c',
    match: { folders: ['starter-folder-ar-ops', 'starter-folder-4'] },
    code:
`#include <stdio.h>

int main(void) {
    int a[6] = {10, 20, 30, 40, 0};
    int n = 4;
    int i;

    for (i = n; i > 1; i--) {
        a[i] = a[i - 1];
    }
    a[1] = 99;
    n++;

    for (i = 0; i < n; i++) {
        printf("%d ", a[i]);
    }
    printf("\\n");
    return 0;
}`,
    steps: [
      { lines: [4, 5], say: 'Six boxes, but only four are in use. That is the whole trick of an array list: the array is a fixed size, and <code>n</code> says how much of it counts. The spare room is what lets anything be inserted.', vars: { 'a': '10 20 30 40 _ _', n: '4' } },
      { line: 8, say: 'To insert at position 1, everything from there on has to move one place right. The loop runs BACKWARDS — start at the end and walk down.', vars: { 'a': '10 20 30 40 _ _', n: '4', i: '4' } },
      { line: 9, say: 'i is 4: copy a[3] into a[4]. The 40 now exists in two places, which is fine — the left-hand copy is about to be overwritten.', vars: { 'a': '10 20 30 40 40', n: '4', i: '4' } },
      { line: 9, say: 'i is 3: a[2] into a[3]. The 30 moves right.', vars: { 'a': '10 20 30 30 40', n: '4', i: '3' } },
      { line: 9, say: 'i is 2: a[1] into a[2]. And now position 1 is free — its old value is safely one place along.', vars: { 'a': '10 20 20 30 40', n: '4', i: '2' } },
      { line: 8, say: 'Going backwards is the point. Forwards, the first copy would overwrite the value the second copy needed, and one number would be smeared across the whole array.', vars: { 'a': '10 20 20 30 40', n: '4', i: '1' } },
      { line: 11, say: 'Now drop the new value into the hole.', vars: { 'a': '10 99 20 30 40', n: '4', i: '1' } },
      { line: 12, say: 'And say the list is one longer. Forgetting this line is the classic bug: the value is there, and nothing will ever look at it.', vars: { 'a': '10 99 20 30 40', n: '5', i: '1' } },
      { lines: [14, 16], say: 'Printing uses <code>n</code>, not 6. The two spare boxes hold whatever they held before and are none of the list\'s business.', vars: { n: '5' }, out: '10 99 20 30 40 \n' },
      {
        line: 8,
        code:
`#include <stdio.h>

int main(void) {
    int a[6] = {10, 99, 20, 30, 40};
    int n = 5;
    int i;

    for (i = 1; i < n - 1; i++) {
        a[i] = a[i + 1];
    }
    n--;

    for (i = 0; i < n; i++) {
        printf("%d ", a[i]);
    }
    printf("\\n");
    return 0;
}`,
        say: 'Deleting is the same idea reversed: shift everything after the hole one place LEFT, and this time the loop runs forwards for exactly the same reason. Then <code>n--</code>. Nothing is erased — the last slot still holds its old copy — the list just stops counting it.',
        vars: { 'a': '10 20 30 40 40', n: '4' },
        out: '10 20 30 40 \n'
      }
    ],
    recap: 'Insert: shift right, backwards, then write, then <code>n++</code>. Delete: shift left, forwards, then <code>n--</code>. The array never changes size; <code>n</code> does.'
  },

  {
    id: 'grid',
    order: 148,
    group: 'Arrays',
    title: 'Two dimensions',
    tagline: 'Rows and columns, and which loop is which',
    icon: 'table-2',
    file: 'grid.c',
    match: { folders: ['starter-folder-ar-grid', 'starter-folder-11'] },
    code:
`#include <stdio.h>

int main(void) {
    int g[2][3] = { {1, 2, 3},
                    {4, 5, 6} };
    int r, c, sum;

    for (r = 0; r < 2; r++) {
        sum = 0;
        for (c = 0; c < 3; c++) {
            printf("%d ", g[r][c]);
            sum = sum + g[r][c];
        }
        printf("| row total %d\\n", sum);
    }
    return 0;
}`,
    steps: [
      { lines: [4, 5], say: '<code>g[2][3]</code> reads outside-in: <strong>2 rows, each of 3</strong>. The braces are written the same way — one inner pair per row.', vars: { 'g[0]': '1 2 3', 'g[1]': '4 5 6' } },
      { line: 7, say: 'Outer loop over rows. <code>r</code> picks which row; it will be 0 then 1.', vars: { r: '0' } },
      { line: 8, say: '<code>sum</code> is reset HERE, inside the row loop. Put it above line 7 and you would get a running total across the whole grid instead of one per row.', vars: { r: '0', sum: '0' } },
      { line: 9, say: 'Inner loop over the columns of THIS row.', vars: { r: '0', c: '0', sum: '0' } },
      { lines: [10, 11], say: '<code>g[r][c]</code> is row r, column c — row first, always, in the same order as the declaration.', vars: { r: '0', c: '0', sum: '1' }, out: '1 ' },
      { lines: [10, 11], say: 'c walks along the row.', vars: { r: '0', c: '2', sum: '6' }, out: '1 2 3 ' },
      { line: 13, say: 'End of the row: print its total and break the line. Outside the inner loop, inside the outer one — the same placement as the star triangle.', vars: { r: '0', sum: '6' }, out: '1 2 3 | row total 6\n' },
      { line: 7, say: 'Next row. <code>c</code> restarts at 0 and <code>sum</code> is cleared again.', vars: { r: '1', c: '0', sum: '0' }, out: '1 2 3 | row total 6\n' },
      { lines: [10, 11], say: 'Row 1 is 4, 5, 6.', vars: { r: '1', c: '2', sum: '15' }, out: '1 2 3 | row total 6\n4 5 6 ' },
      { line: 13, say: 'And its total.', vars: { r: '1', sum: '15' }, out: '1 2 3 | row total 6\n4 5 6 | row total 15\n' },
      { line: 9, say: 'Column totals are the same two loops with the order swapped: put <code>c</code> outside and <code>r</code> inside, and you walk down a column instead of along a row. The grid does not change — only which index moves fastest.', vars: {}, out: '1 2 3 | row total 6\n4 5 6 | row total 15\n' }
    ],
    recap: '<code>g[row][col]</code>, declared rows-first. Outer loop rows, inner loop columns — and swap them to work down columns instead.'
  },

  {
    id: 'pointer-array',
    order: 149,
    group: 'Pointers',
    title: 'Pointers and arrays',
    tagline: 'Why a[i] and *(a + i) are the same thing',
    icon: 'move-horizontal',
    file: 'ptrarr.c',
    match: { folders: ['starter-folder-ptr-arr', 'starter-folder-5'] },
    code:
`#include <stdio.h>

int main(void) {
    int a[4] = {10, 20, 30, 40};
    int *p = a;
    int i;

    printf("%d %d\\n", a[0], *p);
    printf("%d %d\\n", a[2], *(p + 2));

    for (i = 0; i < 4; i++) {
        printf("%d ", *(a + i));
    }
    printf("\\n");
    return 0;
}`,
    steps: [
      { line: 4, say: 'Four ints, side by side. Say the first sits at address 1000 — then, because each int is 4 bytes, the next is at 1004, then 1008, then 1012.', vars: { a: '10 20 30 40' } },
      { line: 5, say: 'No <code>&amp;</code> here, and that is not a mistake. <strong>An array\'s name IS the address of its first element.</strong> <code>p = a</code> and <code>p = &amp;a[0]</code> mean the same thing.', vars: { a: '10 20 30 40', p: '1000' } },
      { line: 8, say: 'So <code>*p</code> — what is at 1000 — is 10, which is exactly <code>a[0]</code>.', vars: { p: '1000' }, out: '10 10\n' },
      { line: 9, say: '<code>p + 2</code> does NOT mean 1002. Pointer arithmetic counts in ELEMENTS: two ints along is 8 bytes, so it is 1008. The compiler knows the size because the pointer has a type.', vars: { p: '1000', 'p + 2': '1008' }, out: '10 10\n30 30\n' },
      { line: 9, say: 'Which makes <code>*(p + 2)</code> and <code>a[2]</code> the same value by the same route. They are not similar — <code>a[i]</code> is <em>defined</em> as <code>*(a + i)</code>.', vars: { p: '1000' }, out: '10 10\n30 30\n' },
      { lines: [11, 12], say: 'So this loop is an ordinary array walk, written the other way round. Both forms compile to the same thing; brackets are just easier to read.', vars: { i: '0' }, out: '10 10\n30 30\n10 ' },
      { line: 12, say: 'i walks along.', vars: { i: '3' }, out: '10 10\n30 30\n10 20 30 40 ' },
      { line: 5, say: 'One difference that matters: <code>p</code> is a variable and can be moved — <code>p++</code> is legal. <code>a</code> is the array\'s name and cannot; <code>a++</code> will not compile.', vars: { a: '10 20 30 40', p: '1000' }, out: '10 10\n30 30\n10 20 30 40 \n' }
    ],
    recap: '<code>a</code> is the address of <code>a[0]</code>, and <code>a[i]</code> means <code>*(a + i)</code>. Adding 1 to a pointer moves it one ELEMENT, not one byte.'
  },

  /* ══ Strings ═════════════════════════════════════════════ */

  {
    id: 'string',
    order: 160,
    group: 'Strings',
    title: 'Strings',
    tagline: 'A char array, and the invisible character on the end',
    icon: 'text-cursor-input',
    file: 'word.c',
    match: { folders: ['starter-folder-9'] },
    code:
`#include <stdio.h>

int main(void) {
    char word[20];
    int i;

    printf("Enter a word: ");
    scanf("%s", word);

    printf("You typed %s\\n", word);

    for (i = 0; word[i] != '\\0'; i++) {
        printf("%c-", word[i]);
    }
    printf("\\n%d letters\\n", i);
    return 0;
}`,
    steps: [
      { line: 4, say: 'There is no string type in C. A string is an <strong>array of char</strong> — 20 boxes, each holding one character. The 20 is the room available, not the length of anything.', vars: { word: '(20 empty boxes)' } },
      { lines: [7, 8], say: 'You type <strong>cat</strong>. Note there is no <code>&amp;</code> on <code>word</code>: it is an array, so its name is already the address scanf needs.', vars: { word: "c a t \\0" }, out: 'Enter a word: ‸cat‸\n' },
      { line: 8, say: 'And scanf put FOUR characters in, not three. After the t it wrote <code>\'\\0\'</code> — a byte of value zero, the <strong>null terminator</strong>. That is the only thing marking where the word ends.', vars: { 'word[0..3]': "'c' 'a' 't' '\\0'" }, out: 'Enter a word: ‸cat‸\n' },
      { line: 10, say: '<code>%s</code> starts at the address it is given and prints characters until it meets the \\0. Lose that byte and it keeps going into whatever is next in memory.', vars: { 'word[0..3]': "'c' 'a' 't' '\\0'" }, out: 'Enter a word: ‸cat‸\nYou typed cat\n' },
      { line: 12, say: 'Which is also how you walk one yourself. The loop has no length to count to — it stops when it <em>finds</em> the terminator.', vars: { i: '0', 'word[i]': "'c'" }, out: 'Enter a word: ‸cat‸\nYou typed cat\n' },
      { line: 13, say: '<code>%c</code> is one character; <code>%s</code> is a whole string. Different placeholders for different things.', vars: { i: '0', 'word[i]': "'c'" }, out: 'Enter a word: ‸cat‸\nYou typed cat\nc-' },
      { line: 13, say: 'On along the word.', vars: { i: '2', 'word[i]': "'t'" }, out: 'Enter a word: ‸cat‸\nYou typed cat\nc-a-t-' },
      { line: 12, say: 'i is 3, and <code>word[3]</code> IS the \\0, so the condition fails and the loop stops. It never printed the terminator — it stopped at it.', vars: { i: '3', 'word[i]': "'\\0'" }, out: 'Enter a word: ‸cat‸\nYou typed cat\nc-a-t-' },
      { line: 15, say: 'And <code>i</code> has counted the letters for free: 3. That is exactly what <code>strlen</code> does — it walks to the \\0 and reports how far it got.', vars: { i: '3' }, out: 'Enter a word: ‸cat‸\nYou typed cat\nc-a-t-\n3 letters\n' },
      { line: 4, say: 'Last thing, and it is the one that bites: <code>scanf("%s")</code> will happily write past box 20 if you type more than that. It does not know how big the array is. It stops at whitespace, too — type "hot dog" and you get "hot".', vars: {}, out: 'Enter a word: ‸cat‸\nYou typed cat\nc-a-t-\n3 letters\n' }
    ],
    next: ['string-funcs'],
    recap: 'A string is a char array ending in <code>\'\\0\'</code>. Loop until you meet the terminator; the array\'s size and the string\'s length are two different numbers.'
  },

  {
    id: 'string-funcs',
    order: 165,
    group: 'Strings',
    title: 'strlen, strcpy, strcmp',
    tagline: 'Why = and == do not work on strings',
    icon: 'wand-2',
    file: 'strfn.c',
    match: { folders: ['starter-folder-9'], code: /\b(strlen|strcpy|strcmp|strcat)\s*\(/ },
    code:
`#include <stdio.h>
#include <string.h>

int main(void) {
    char a[20] = "cat";
    char b[20];

    printf("%d\\n", (int) strlen(a));

    strcpy(b, a);
    printf("%s\\n", b);

    strcat(b, "fish");
    printf("%s\\n", b);

    if (strcmp(a, "cat") == 0) {
        printf("a is cat\\n");
    }
    return 0;
}`,
    steps: [
      { line: 2, say: 'These four live in <code>&lt;string.h&gt;</code>, not stdio. Forget this include and the compiler guesses at them, which usually still links and then behaves oddly.' },
      { line: 5, say: 'A char array can be initialised from a literal. This puts c, a, t and the \\0 into the first four boxes; the other sixteen are spare room.', vars: { a: '"cat"  (+ 16 spare)' } },
      { line: 8, say: '<code>strlen</code> walks to the \\0 and returns how far it went: 3. Not 20, and not 4 — the terminator is not part of the length.', vars: { a: '"cat"' }, out: '3\n' },
      { line: 10, say: 'Now the important one. You cannot write <code>b = a</code>: that would try to assign one array to another, and C will not. Copying a string means copying it character by character, which is what <code>strcpy</code> does.', vars: { a: '"cat"', b: '"cat"' } },
      { line: 10, say: 'And strcpy copies the \\0 too — otherwise the copy would have no end. It also has no idea how big <code>b</code> is, so a source longer than the destination overruns it.', vars: { a: '"cat"', b: '"cat"' }, out: '3\n' },
      { line: 11, say: 'b really is its own string now. Changing it later will not touch a.', vars: { a: '"cat"', b: '"cat"' }, out: '3\ncat\n' },
      { line: 13, say: '<code>strcat</code> APPENDS: it finds b\'s \\0, and writes from there. So the destination has to have room for both — b is 20 boxes and "catfish" needs 8, which is fine.', vars: { b: '"catfish"' }, out: '3\ncat\n' },
      { line: 14, say: 'Seven characters plus a new terminator.', vars: { b: '"catfish"' }, out: '3\ncat\ncatfish\n' },
      { line: 16, say: 'And the other thing you cannot do: <code>a == "cat"</code> compares two ADDRESSES, and they are different addresses, so it is false even though the text matches.', vars: { a: '"cat"' }, out: '3\ncat\ncatfish\n' },
      { line: 16, say: '<code>strcmp</code> compares the characters. It returns <strong>0 when they are equal</strong> — which reads backwards until you know why: it returns negative, zero or positive to say which sorts first, so zero means "no difference".', vars: {}, out: '3\ncat\ncatfish\n' },
      { line: 17, say: 'So the test for "are these the same string" is <code>strcmp(a, b) == 0</code>. Writing <code>if (strcmp(a, b))</code> means "if they are DIFFERENT", which is the opposite of what it looks like.', vars: {}, out: '3\ncat\ncatfish\ta is cat\n' }
    ],
    recap: 'Copy with strcpy, join with strcat, compare with <code>strcmp(a, b) == 0</code>. <code>=</code> and <code>==</code> on strings do not do what they look like.'
  },

  /* ══ Structs ═════════════════════════════════════════════ */

  {
    id: 'struct',
    order: 170,
    group: 'Structs',
    title: 'Structs',
    tagline: 'One name for several values that belong together',
    icon: 'package-2',
    file: 'poke.c',
    match: { folders: ['starter-folder-7'] },
    code:
`#include <stdio.h>

struct Pokemon {
    char name[20];
    int level;
    int hp;
};

int main(void) {
    struct Pokemon p;
    struct Pokemon team[3];

    strcpy(p.name, "Pikachu");
    p.level = 12;
    p.hp = 35;

    printf("%s (Lv %d) HP %d\\n", p.name, p.level, p.hp);

    team[0] = p;
    team[0].hp = 40;
    printf("%d and %d\\n", p.hp, team[0].hp);
    return 0;
}`,
    steps: [
      { lines: [3, 7], say: 'This does not make anything. It describes a <strong>shape</strong>: any Pokemon has a name, a level and some hp. Nothing exists yet and no memory has been used.' },
      { line: 7, say: 'Note the semicolon after the closing brace. A struct definition needs one; leaving it off produces an error pointing at the next line, which is why it is so confusing.' },
      { line: 10, say: 'THIS makes one. <code>p</code> is a single variable that happens to contain three things — one box big enough for all of them, side by side.', vars: { 'p.name': '(empty)', 'p.level': '?', 'p.hp': '?' } },
      { line: 11, say: 'And an array of them works exactly like an array of ints: three Pokemon in a row.', vars: { team: '3 Pokemon, all empty' } },
      { line: 13, say: 'The dot reaches a member. <code>p.name</code> is a char array, so it is copied with strcpy like any other string — you cannot assign to it.', vars: { 'p.name': '"Pikachu"' } },
      { lines: [14, 15], say: 'The int members are plain assignments.', vars: { 'p.name': '"Pikachu"', 'p.level': '12', 'p.hp': '35' } },
      { line: 17, say: 'Each member is printed with the placeholder for its own type — <code>%s</code> for the name, <code>%d</code> for the numbers. You cannot print a whole struct in one go.', vars: { 'p.level': '12', 'p.hp': '35' }, out: 'Pikachu (Lv 12) HP 35\n' },
      { line: 19, say: 'And here is the one that surprises people: a struct CAN be assigned whole. This copies all three members in one line — including the name array, which is the one thing <code>=</code> normally refuses.', vars: { 'p.hp': '35', 'team[0].hp': '35' } },
      { line: 20, say: 'But it is a <strong>copy</strong>, not a link. Changing team[0] does not touch p.', vars: { 'p.hp': '35', 'team[0].hp': '40' } },
      { line: 21, say: '35 and 40. Same rule as pass-by-value, and for the same reason: assigning a struct duplicates its contents.', vars: { 'p.hp': '35', 'team[0].hp': '40' }, out: 'Pikachu (Lv 12) HP 35\n35 and 40\n' }
    ],
    next: ['typedef', 'struct-pointer'],
    recap: 'A <code>struct</code> is a shape; a variable of that type is one instance. Reach members with <code>.</code>, and remember that assigning a struct copies every member.'
  },

  {
    id: 'struct-pointer',
    order: 175,
    group: 'Structs',
    title: 'Structs and functions',
    tagline: 'The arrow, and how to let a function change one',
    icon: 'arrow-right-circle',
    file: 'structfn.c',
    match: { folders: ['starter-folder-7'], code: /->/ },
    code:
`#include <stdio.h>

struct Pokemon {
    int level;
    int hp;
};

void levelUpCopy(struct Pokemon p) {
    p.level = p.level + 1;
}

void levelUp(struct Pokemon *p) {
    p->level = p->level + 1;
    p->hp = p->hp + 5;
}

int main(void) {
    struct Pokemon pika = {12, 35};

    levelUpCopy(pika);
    printf("after copy: %d\\n", pika.level);

    levelUp(&pika);
    printf("after ref:  %d hp %d\\n", pika.level, pika.hp);
    return 0;
}`,
    steps: [
      { line: 18, say: 'One Pokemon: level 12, 35 hp. The braces fill the members in declaration order.', vars: { 'pika.level': '12', 'pika.hp': '35' } },
      { line: 20, say: 'Call the by-value version. A struct passed like this is COPIED — every member of it, however big the struct is.', vars: { 'pika.level': '12' } },
      { line: 9, say: 'So this raises the copy\'s level, exactly as it says.', vars: { 'pika.level': '12', 'copy p.level': '13' } },
      { line: 21, say: 'And back in main, pika is untouched. Same lesson as pass-by-value, just with more members involved.', vars: { 'pika.level': '12' }, out: 'after copy: 12\n' },
      { line: 23, say: 'Now the address version. <code>&amp;pika</code> — the same <code>&amp;</code> as always.', vars: { 'pika.level': '12', 'pika.hp': '35' }, out: 'after copy: 12\n' },
      { line: 12, say: 'The parameter is <code>struct Pokemon *p</code>: a pointer to one. Nothing is copied but the address itself.', vars: { 'p': '→ pika' }, out: 'after copy: 12\n' },
      { line: 13, say: 'And here is the arrow. <code>p-&gt;level</code> means "follow the pointer, then take the level member". It is shorthand for <code>(*p).level</code>, which is what you would otherwise have to write — the brackets are needed because <code>.</code> binds tighter than <code>*</code>.', vars: { 'pika.level': '13' }, out: 'after copy: 12\n' },
      { line: 14, say: 'Writing through the arrow changes main\'s Pokemon.', vars: { 'pika.level': '13', 'pika.hp': '40' }, out: 'after copy: 12\n' },
      { line: 24, say: '13 and 40. Both changes stuck.', vars: { 'pika.level': '13', 'pika.hp': '40' }, out: 'after copy: 12\nafter ref:  13 hp 40\n' },
      { line: 12, say: 'And this is why real code passes structs by pointer even when it does not need to change them: a big struct copied on every call is slow, and an address is always one small value. You will see <code>const struct Pokemon *p</code> for exactly that — pass the address, promise not to write.', vars: {}, out: 'after copy: 12\nafter ref:  13 hp 40\n' }
    ],
    recap: 'Dot on a struct, arrow on a pointer to one. Pass <code>&amp;thing</code> and take <code>struct T *p</code> when the function must change it — or when copying it would be wasteful.'
  },

  /* ══ Memory you ask for ══════════════════════════════════ */

  {
    id: 'malloc',
    order: 180,
    group: 'Memory you ask for',
    title: 'malloc and free',
    tagline: 'An array whose size you do not know until you run',
    icon: 'database',
    file: 'alloc.c',
    match: { folders: ['starter-folder-6'] },
    code:
`#include <stdio.h>
#include <stdlib.h>

int main(void) {
    int n, i;
    int *a;

    printf("How many? ");
    scanf("%d", &n);

    a = malloc(n * sizeof(int));
    if (a == NULL) {
        return 1;
    }

    for (i = 0; i < n; i++) {
        a[i] = i * 10;
    }
    for (i = 0; i < n; i++) {
        printf("%d ", a[i]);
    }
    printf("\\n");

    free(a);
    return 0;
}`,
    steps: [
      { line: 6, say: 'The problem this solves: <code>int a[n]</code> with n read at runtime is not something you can rely on. The size of an ordinary array has to be known when the program is compiled.', vars: {} },
      { lines: [8, 9], say: 'You type <strong>4</strong>. Only now does the program know how much room it needs.', vars: { n: '4' }, out: 'How many? ‸4‸\n' },
      { line: 11, say: '<code>malloc</code> asks for a number of BYTES, not a number of ints. <code>n * sizeof(int)</code> is the idiom: four ints at four bytes each is 16 bytes.', vars: { n: '4' }, out: 'How many? ‸4‸\n' },
      { line: 11, say: 'Use <code>sizeof(int)</code> rather than 4. It is not always 4, and writing the number by hand is a bug that only appears on a different machine.', vars: { n: '4' }, out: 'How many? ‸4‸\n' },
      { line: 11, say: 'What comes back is an ADDRESS — the start of 16 bytes nobody else is using. <code>a</code> is a pointer, and from here on it behaves exactly like an array name.', vars: { n: '4', a: '→ 16 bytes' }, out: 'How many? ‸4‸\n' },
      { line: 12, say: 'And it can fail. When there is no room, malloc returns <code>NULL</code> — and using a NULL pointer crashes. Checking is not optional politeness; it is the difference between an error and a crash.', vars: { a: '→ 16 bytes' }, out: 'How many? ‸4‸\n' },
      { lines: [16, 17], say: 'Now it is just an array. <code>a[i]</code> works because, as the pointer walkthrough showed, that is <code>*(a + i)</code> either way.', vars: { 'a[0..3]': '0 10 20 30' }, out: 'How many? ‸4‸\n' },
      { lines: [19, 21], say: 'Read it back the same way.', vars: { 'a[0..3]': '0 10 20 30' }, out: 'How many? ‸4‸\n0 10 20 30 \n' },
      { line: 24, say: '<code>free</code> hands the 16 bytes back. Memory from malloc is <strong>yours until you say otherwise</strong> — it is not cleaned up when the function ends, the way a local array is.', vars: { a: '(freed)' }, out: 'How many? ‸4‸\n0 10 20 30 \n' },
      { line: 24, say: 'Every malloc needs exactly one free. None, and the memory leaks; twice, and the program corrupts its own allocator. And after free, <code>a</code> still holds the old address — using it now is a "use after free", which often appears to work and then does not.', vars: {}, out: 'How many? ‸4‸\n0 10 20 30 \n' }
    ],
    next: ['malloc-return', 'linked-list'],
    recap: '<code>malloc(n * sizeof(T))</code>, check for NULL, use it as an array, <code>free</code> it once. It lives until you free it, not until the function ends.'
  },

  {
    id: 'malloc-return',
    order: 185,
    group: 'Memory you ask for',
    title: 'Returning an array',
    tagline: 'Count first, then allocate — and never return a local',
    icon: 'package-open',
    file: 'build.c',
    match: { folders: ['starter-folder-6'], code: /\*\s*\w+\s*\([^)]*\)\s*\{[\s\S]*malloc/ },
    code:
`#include <stdio.h>
#include <stdlib.h>

int *multiples(int of, int limit, int *count) {
    int i, n = 0;
    int *out;

    for (i = of; i <= limit; i = i + of) {
        n++;
    }

    out = malloc(n * sizeof(int));
    if (out == NULL) { *count = 0; return NULL; }

    n = 0;
    for (i = of; i <= limit; i = i + of) {
        out[n] = i;
        n++;
    }

    *count = n;
    return out;
}

int main(void) {
    int howMany, i;
    int *a = multiples(3, 10, &howMany);

    for (i = 0; i < howMany; i++) {
        printf("%d ", a[i]);
    }
    printf("\\n");
    free(a);
    return 0;
}`,
    steps: [
      { line: 27, say: 'main wants the multiples of 3 up to 10. It cannot know in advance that there are three of them — so the function has to both build the array AND report its length.', vars: {} },
      { line: 4, say: 'Which is why there are two ways out. The RETURN carries the array; <code>int *count</code> is an out-parameter carrying the length, by address, exactly like pass-by-reference.', vars: { of: '3', limit: '10' } },
      { lines: [8, 10], say: 'First pass: count, do not store. 3, 6, 9 — three of them. Nothing has been allocated yet.', vars: { n: '3' } },
      { line: 12, say: 'Now the size is known, so ask for exactly that much. This is the <strong>count-then-allocate</strong> pattern, and the alternative is guessing a maximum and wasting it.', vars: { n: '3', out: '→ 12 bytes' } },
      { line: 13, say: 'Check the allocation, and on failure report zero AND return NULL — a caller that gets a length without an array will read from nowhere.', vars: { out: '→ 12 bytes' } },
      { lines: [15, 19], say: 'Second pass over the same numbers, storing them this time. The loop is identical; only the body differs.', vars: { 'out[0..2]': '3 6 9', n: '3' } },
      { line: 21, say: 'Write the length back through the pointer main gave us.', vars: { 'main howMany': '3' } },
      { line: 22, say: 'And return the address. This is safe because the memory came from malloc — it belongs to nobody in particular and outlives this call.', vars: { 'main howMany': '3' } },
      {
        lines: [4, 8],
        code:
`#include <stdio.h>

int *broken(void) {
    int local[3] = {1, 2, 3};
    return local;
}

int main(void) {
    int *a = broken();
    printf("%d\\n", a[0]);
    return 0;
}`,
        say: 'And here is what you must NOT do. <code>local</code> lives on the stack; it stops existing the moment broken returns, so the address handed back points at memory that has been given up. It often prints 1 the first time and rubbish the second, which is the worst possible behaviour — it looks like it works.',
        vars: { a: '→ memory that is gone' },
        out: '1\n'
      },
      { line: 33, say: 'Back in the working version: main uses the array, then frees it. Whoever receives malloc\'d memory inherits the duty to free it — that has to be said in the function\'s documentation, because nothing in the type says so.', vars: {}, out: '3 6 9 \n' }
    ],
    recap: 'Count, allocate exactly, fill, return the pointer and the length separately. Never return the address of a local — return malloc\'d memory, and say who frees it.'
  },

  /* ══ Lists ═══════════════════════════════════════════════ */

  {
    id: 'linked-list',
    order: 190,
    group: 'Memory you ask for',
    title: 'Linked lists',
    tagline: 'Nodes that know where the next one is',
    icon: 'workflow',
    file: 'list.c',
    match: { folders: ['starter-folder-8', 'starter-folder-ws'] },
    code:
`#include <stdio.h>
#include <stdlib.h>

struct Node {
    int value;
    struct Node *next;
};

int main(void) {
    struct Node *head = NULL;
    struct Node *n;
    int i;

    for (i = 3; i >= 1; i--) {
        n = malloc(sizeof(struct Node));
        n->value = i;
        n->next = head;
        head = n;
    }

    for (n = head; n != NULL; n = n->next) {
        printf("%d ", n->value);
    }
    printf("\\n");
    return 0;
}`,
    steps: [
      { lines: [4, 7], say: 'A node holds a value and <strong>the address of the next node</strong>. The struct contains a pointer to its own type, which is legal precisely because a pointer’s size is known even when the struct is not finished.', vars: {} },
      { line: 10, say: '<code>head</code> is the way in — the address of the first node. NULL means the list is empty, and NULL is also what marks the end.', vars: { head: 'NULL' }, ptrs: { head: null } },
      { line: 15, say: 'One node, asked for by hand. An array reserves all its room at once; a list asks for one node at a time, which is why it can grow to any length.', vars: { head: 'NULL', 'node A': '?' }, ptrs: { head: null } },
      { lines: [16, 17], say: 'Fill it in, and point it at whatever the head was. On the first pass that is NULL — so this node’s <code>next</code> is NULL, which makes it the last one.', vars: { head: 'NULL', 'node A': '3' }, ptrs: { head: null, 'node A': null } },
      { line: 18, say: 'And now this node IS the head. Inserting at the front is two assignments and no shifting at all — the thing an array cannot do cheaply.', vars: { head: '→', 'node A': '3' }, ptrs: { head: 'node A', 'node A': null } },
      { lines: [15, 18], say: 'Second pass, i is 2. The new node points at the old head, and takes its place.', vars: { head: '→', 'node B': '2', 'node A': '3' }, ptrs: { head: 'node B', 'node B': 'node A', 'node A': null } },
      { lines: [15, 18], say: 'Third pass, i is 1. The loop counted DOWN because each insert goes on the front — building 3, 2, 1 leaves the list in the order 1, 2, 3.', vars: { head: '→', 'node C': '1', 'node B': '2', 'node A': '3' }, ptrs: { head: 'node C', 'node C': 'node B', 'node B': 'node A', 'node A': null } },
      { line: 21, say: 'Walking it. Start at head, and the step is <code>n = n-&gt;next</code> — you cannot jump to the fifth node, you have to walk past four.', vars: { head: '→', n: '→', 'node C': '1', 'node B': '2', 'node A': '3' }, ptrs: { head: 'node C', n: 'node C', 'node C': 'node B', 'node B': 'node A', 'node A': null } },
      { line: 22, say: 'First value.', vars: { n: '→', 'node C': '1', 'node B': '2', 'node A': '3' }, ptrs: { n: 'node C', 'node C': 'node B', 'node B': 'node A', 'node A': null }, out: '1 ' },
      { line: 21, say: 'Follow the link.', vars: { n: '→', 'node C': '1', 'node B': '2', 'node A': '3' }, ptrs: { n: 'node B', 'node C': 'node B', 'node B': 'node A', 'node A': null }, out: '1 2 ' },
      { line: 21, say: 'And again — until <code>n</code> is NULL, which is the condition that stops the walk. That is the whole reason the last node’s next is NULL rather than anything else.', vars: { n: 'NULL', 'node C': '1', 'node B': '2', 'node A': '3' }, ptrs: { n: null, 'node C': 'node B', 'node B': 'node A', 'node A': null }, out: '1 2 3 \n' },
      { line: 15, say: 'One duty left, and this program shirks it: every one of those nodes came from malloc and none was freed. Freeing a list means walking it while holding onto <code>next</code> BEFORE you free the node — reading a freed node to find out where to go next is the classic way to lose the rest of the list.', vars: {}, out: '1 2 3 \n' }
    ],
    next: ['struct-pointer'],
    recap: 'A node holds a value and the next address; NULL ends the list. Insert at the front by pointing the new node at the head and becoming the head. Walk with <code>n = n-&gt;next</code>.'
  },

  /* ══ Files ═══════════════════════════════════════════════ */

  {
    id: 'file-io',
    order: 200,
    group: 'Files',
    title: 'Reading and writing a file',
    tagline: 'fopen, fprintf, fclose — and checking it opened',
    icon: 'file-text',
    file: 'notes.c',
    match: { folders: ['starter-folder-12'] },
    code:
`#include <stdio.h>

int main(void) {
    FILE *f;
    int a, b;

    f = fopen("scores.txt", "w");
    if (f == NULL) {
        printf("could not open\\n");
        return 1;
    }
    fprintf(f, "%d %d\\n", 70, 82);
    fclose(f);

    f = fopen("scores.txt", "r");
    if (f == NULL) {
        return 1;
    }
    fscanf(f, "%d %d", &a, &b);
    fclose(f);

    printf("read %d and %d\\n", a, b);
    return 0;
}`,
    steps: [
      { line: 4, say: '<code>FILE *</code> is a handle: not the file, and not its contents — a thing the library gives you that stands for an open file.', vars: { f: '(none)' } },
      { line: 7, say: '<code>fopen</code> takes a name and a MODE. <code>"w"</code> is write, and it is destructive: it empties an existing file before you write a byte. <code>"a"</code> appends instead.', vars: { f: '→ scores.txt (w)' } },
      { line: 8, say: 'And it can fail — no permission, no such folder, disk full. It returns NULL when it does, and every use of the handle after that is a crash. This check is the same duty as checking malloc.', vars: { f: '→ scores.txt (w)' } },
      { line: 12, say: '<code>fprintf</code> is <code>printf</code> with one extra argument on the front: which file. Everything after it is identical — same placeholders, same rules.', vars: { f: '→ scores.txt (w)' }, out: '' },
      { line: 13, say: '<code>fclose</code> matters more than it looks. Output is buffered, so the numbers may still be sitting in memory rather than on the disk — closing is what guarantees they arrive. A program that ends without closing can leave an empty file.', vars: { f: '(closed)' } },
      { line: 15, say: 'Open it again, this time with <code>"r"</code> for read. A file opened "w" cannot be read from — the mode is a promise about what you will do.', vars: { f: '→ scores.txt (r)' } },
      { line: 19, say: '<code>fscanf</code> is <code>scanf</code> with the file on the front, and it keeps the <code>&amp;</code>: it still needs somewhere to put what it reads.', vars: { a: '70', b: '82' } },
      { line: 20, say: 'Close it again. Two opens, two closes.', vars: { a: '70', b: '82', f: '(closed)' } },
      { line: 22, say: 'And the values really did come back off the disk.', vars: { a: '70', b: '82' }, out: 'read 70 and 82\n' },
      { line: 19, say: 'One thing to know for later: <code>fscanf</code> returns how many items it managed to read, which is how a loop knows the file has run out — <code>while (fscanf(f, "%d", &amp;x) == 1)</code> is the usual shape. At the end it returns <code>EOF</code>.', vars: {}, out: 'read 70 and 82\n' }
    ],
    recap: 'fopen with a mode, check for NULL, fprintf/fscanf exactly like printf/scanf with the file first, then fclose. "w" empties the file; closing is what actually writes it.'
  }

,

  /* ══ Types and operators ═════════════════════════════════ */

  {
    id: 'types',
    order: 22,
    group: 'Getting words out and values in',
    title: 'Types, sizeof and casting',
    tagline: 'What fits in the box, and what falls off the edge',
    icon: 'ruler',
    file: 'types.c',
    match: { folders: ['starter-folder-core-var'] },
    code:
`#include <stdio.h>

int main(void) {
    int whole = 7;
    double exact = 7.0;
    char letter = 'A';
    const int MAX = 100;

    printf("%d bytes, %d bytes, %d byte\\n",
           (int) sizeof(int), (int) sizeof(double), (int) sizeof(char));

    printf("%d\\n", whole / 2);
    printf("%.2f\\n", exact / 2);
    printf("%.2f\\n", (double) whole / 2);

    printf("%c is %d\\n", letter, letter);
    printf("%d\\n", MAX);
    return 0;
}`,
    steps: [
      { line: 4, say: 'A type is a promise about what a box can hold and how wide it is. <code>int</code> is a whole number — no fractional part, ever.', vars: { whole: '7' } },
      { line: 5, say: '<code>double</code> holds a number with a decimal point. Same value written two ways, two completely different boxes.', vars: { whole: '7', exact: '7.0' } },
      { line: 6, say: '<code>char</code> is one character, in single quotes. Double quotes would be a string, which is a different thing entirely.', vars: { whole: '7', exact: '7.0', letter: "'A'" } },
      { line: 7, say: '<code>const</code> is a promise not to change it. The compiler holds you to it — assigning to MAX later is an error, not a warning.', vars: { whole: '7', exact: '7.0', letter: "'A'", MAX: '100 (const)' } },
      { lines: [9, 10], say: '<code>sizeof</code> reports how many bytes a type takes. It is measured by the compiler, not worked out at runtime.', vars: {}, out: '4 bytes, 8 bytes, 1 byte\n' },
      { line: 12, say: 'And here is the one that catches everyone. <code>7 / 2</code> where both sides are int is <strong>integer division</strong>: the answer is 3, and the remainder is thrown away. Not rounded — dropped.', vars: { whole: '7' }, out: '4 bytes, 8 bytes, 1 byte\n3\n' },
      { line: 13, say: 'With a double on the left the division is done in doubles, and you get 3.50.', vars: { exact: '7.0' }, out: '4 bytes, 8 bytes, 1 byte\n3\n3.50\n' },
      { line: 14, say: 'A <strong>cast</strong> forces the issue: <code>(double) whole</code> says "treat this int as a double, here, for this expression". One side being a double is enough to make the whole division a double one.', vars: { whole: '7' }, out: '4 bytes, 8 bytes, 1 byte\n3\n3.50\n3.50\n' },
      { line: 14, say: 'The cast has to be on an operand, not on the answer. <code>(double)(whole / 2)</code> would divide as ints first — giving 3 — and then convert the 3, which is exactly the bug it was meant to avoid.', vars: {}, out: '4 bytes, 8 bytes, 1 byte\n3\n3.50\n3.50\n' },
      { line: 16, say: 'And a char really is a number: it stores the character\'s code, 65 for A. Same box, two placeholders — <code>%c</code> shows the character, <code>%d</code> shows the number. That is why <code>letter + 1</code> is B.', vars: { letter: "'A' = 65" }, out: '4 bytes, 8 bytes, 1 byte\n3\n3.50\n3.50\nA is 65\n' }
    ],
    next: ['operators'],
    recap: 'int drops the fraction; double keeps it. Cast an OPERAND, not the answer. A char is a small integer holding a character code.'
  },

  {
    id: 'operators',
    order: 24,
    group: 'Getting words out and values in',
    title: 'Operators',
    tagline: '%, precedence, and ++ before or after',
    icon: 'calculator',
    file: 'ops.c',
    match: { folders: ['starter-folder-core-op'] },
    code:
`#include <stdio.h>

int main(void) {
    int n = 254;
    int a = 2, b;

    printf("%d %d\\n", n / 10, n % 10);
    printf("%d\\n", 2 + 3 * 4);
    printf("%d\\n", (2 + 3) * 4);

    a += 5;
    printf("%d\\n", a);

    b = a++;
    printf("a=%d b=%d\\n", a, b);

    b = ++a;
    printf("a=%d b=%d\\n", a, b);
    return 0;
}`,
    steps: [
      { line: 7, say: 'The two halves of a division. <code>/</code> gives the whole part — 254 / 10 is 25 — and <code>%</code> gives what is left over, 4.', vars: { n: '254' }, out: '25 4\n' },
      { line: 7, say: 'Which makes <code>% 10</code> "the last digit" and <code>/ 10</code> "everything but the last digit". Those two together are how you take a number apart one digit at a time.', vars: { n: '254' }, out: '25 4\n' },
      { line: 8, say: 'Precedence: <code>*</code> binds tighter than <code>+</code>, so this is 2 + 12, not 5 × 4. The same rule as ordinary arithmetic.', vars: {}, out: '25 4\n14\n' },
      { line: 9, say: 'Brackets override it. When you are not certain, brackets cost nothing and remove the doubt for whoever reads it next.', vars: {}, out: '25 4\n14\n20\n' },
      { line: 11, say: '<code>a += 5</code> is shorthand for <code>a = a + 5</code>. The same exists for <code>-=</code>, <code>*=</code>, <code>/=</code> and <code>%=</code>.', vars: { a: '7' }, out: '25 4\n14\n20\n' },
      { line: 12, say: 'Seven.', vars: { a: '7' }, out: '25 4\n14\n20\n7\n' },
      { line: 14, say: 'Now the pair that trips people. <code>a++</code> is <strong>post</strong>-increment: it hands back the OLD value and then adds one.', vars: { a: '8', b: '7' } },
      { line: 15, say: 'So a is 8 and b got 7 — the value a had before the ++ happened.', vars: { a: '8', b: '7' }, out: '25 4\n14\n20\n7\na=8 b=7\n' },
      { line: 17, say: '<code>++a</code> is <strong>pre</strong>-increment: add one first, then hand back the new value.', vars: { a: '9', b: '9' } },
      { line: 18, say: 'Both 9. As a statement on its own — <code>i++;</code> in a for loop — the two are identical; the difference only shows when you use the result.', vars: { a: '9', b: '9' }, out: '25 4\n14\n20\n7\na=8 b=7\na=9 b=9\n' }
    ],
    recap: '<code>/</code> is the whole part, <code>%</code> the remainder. <code>a++</code> hands back the old value, <code>++a</code> the new one.'
  },

  /* ══ Choices ═════════════════════════════════════════════ */

  {
    id: 'switch',
    order: 55,
    group: 'Choosing what to do',
    title: 'switch',
    tagline: 'One value, many cases — and the break that must be there',
    icon: 'list-checks',
    file: 'menu.c',
    match: { folders: ['starter-folder-2'], code: /\bswitch\s*\(/ },
    code:
`#include <stdio.h>

int main(void) {
    int choice;

    printf("Pick 1-3: ");
    scanf("%d", &choice);

    switch (choice) {
        case 1:
            printf("Add\\n");
            break;
        case 2:
            printf("Remove\\n");
            break;
        case 3:
            printf("Quit\\n");
            break;
        default:
            printf("No such option\\n");
    }
    return 0;
}`,
    steps: [
      { lines: [6, 7], say: 'You type <strong>2</strong>.', vars: { choice: '2' }, out: 'Pick 1-3: ‸2‸\n' },
      { line: 9, say: '<code>switch</code> takes one value and jumps straight to the matching label. It is not a chain of tests — it is a jump, which is why it only works on whole numbers and characters, never on a range or a string.', vars: { choice: '2' }, out: 'Pick 1-3: ‸2‸\n' },
      { line: 13, say: 'choice is 2, so execution lands here. The cases above were not tested and not run — they were skipped over.', vars: { choice: '2' }, out: 'Pick 1-3: ‸2‸\n' },
      { line: 14, say: 'Run the body.', vars: { choice: '2' }, out: 'Pick 1-3: ‸2‸\nRemove\n' },
      { line: 15, say: '<code>break</code> leaves the switch. This is the line everyone forgets, and forgetting it is not a syntax error — it compiles perfectly.', vars: { choice: '2' }, out: 'Pick 1-3: ‸2‸\nRemove\n' },
      { line: 19, say: '<code>default</code> is the else: it runs when no case matched. It is optional, and a switch without one silently does nothing for an unexpected value.', vars: { choice: '2' }, out: 'Pick 1-3: ‸2‸\nRemove\n' },
      {
        line: 14,
        code:
`#include <stdio.h>

int main(void) {
    int choice;

    printf("Pick 1-3: ");
    scanf("%d", &choice);

    switch (choice) {
        case 1:
            printf("Add\\n");
        case 2:
            printf("Remove\\n");
        case 3:
            printf("Quit\\n");
        default:
            printf("No such option\\n");
    }
    return 0;
}`,
        say: 'Here is the same switch with the breaks removed. A case is a LABEL, not a block — once execution lands on one it carries straight on through every case below it. Type 1 and you get all four lines. This is called <strong>fall-through</strong>.',
        vars: { choice: '1' },
        out: 'Pick 1-3: ‸1‸\nAdd\nRemove\nQuit\nNo such option\n'
      },
      {
        lines: [10, 12],
        code:
`#include <stdio.h>

int main(void) {
    char grade;

    printf("Grade: ");
    scanf(" %c", &grade);

    switch (grade) {
        case 'A':
        case 'B':
            printf("Pass\\n");
            break;
        default:
            printf("Fail\\n");
    }
    return 0;
}`,
        say: 'And fall-through is occasionally what you want. Stacking labels with nothing between them is how you say "A or B, same answer" — the only tidy way a switch can express an <em>or</em>.',
        vars: { grade: "'B'" },
        out: 'Grade: ‸B‸\nPass\n'
      }
    ],
    next: ['break-continue'],
    recap: 'A switch jumps to a matching label and runs on from there. Every case needs its <code>break</code> unless you meant it to fall through.'
  },

  /* ══ Loops ═══════════════════════════════════════════════ */

  {
    id: 'do-while',
    order: 72,
    group: 'Doing it again',
    title: 'do-while',
    tagline: 'When the body has to run at least once',
    icon: 'rotate-cw',
    file: 'menu.c',
    match: { folders: ['starter-folder-lp-rep'], code: /\bdo\s*\{/ },
    code:
`#include <stdio.h>

int main(void) {
    int n;

    do {
        printf("Enter a positive number: ");
        scanf("%d", &n);
    } while (n <= 0);

    printf("Thank you: %d\\n", n);
    return 0;
}`,
    steps: [
      { line: 4, say: '<code>n</code> holds nothing yet — and that is exactly the problem this loop shape solves. A <code>while</code> would have to test it before anything had put a value in it.', vars: { n: '(nothing yet)' } },
      { line: 6, say: '<code>do</code> means "run this now". No question is asked first; the body simply happens.', vars: { n: '(nothing yet)' } },
      { lines: [7, 8], say: 'Prompt and read. You type <strong>-4</strong>.', vars: { n: '-4' }, out: 'Enter a positive number: ‸-4‸\n' },
      { line: 9, say: 'NOW the question, at the bottom. Is n still no good? -4 is ≤ 0, so yes — go round again.', vars: { n: '-4' }, out: 'Enter a positive number: ‸-4‸\n' },
      { lines: [7, 8], say: 'Second time. You type <strong>0</strong>, which is also not positive.', vars: { n: '0' }, out: 'Enter a positive number: ‸-4‸\nEnter a positive number: ‸0‸\n' },
      { line: 9, say: 'Still ≤ 0. Again.', vars: { n: '0' }, out: 'Enter a positive number: ‸-4‸\nEnter a positive number: ‸0‸\n' },
      { lines: [7, 8], say: 'You type <strong>12</strong>.', vars: { n: '12' }, out: 'Enter a positive number: ‸-4‸\nEnter a positive number: ‸0‸\nEnter a positive number: ‸12‸\n' },
      { line: 9, say: '<code>12 &lt;= 0</code> is false, so the loop ends. Note the <strong>semicolon</strong> after the closing bracket — a do-while is one statement and needs one, unlike every other loop.', vars: { n: '12' }, out: 'Enter a positive number: ‸-4‸\nEnter a positive number: ‸0‸\nEnter a positive number: ‸12‸\n' },
      { line: 11, say: 'Out, with a value known to be good.', vars: { n: '12' }, out: 'Enter a positive number: ‸-4‸\nEnter a positive number: ‸0‸\nEnter a positive number: ‸12‸\nThank you: 12\n' },
      { line: 6, say: 'That is the whole choice: <strong>while</strong> when the body might not need to run at all, <strong>do-while</strong> when it must run once before you can possibly know. Input validation and menus are the two places you meet it.', vars: {}, out: 'Enter a positive number: ‸-4‸\nEnter a positive number: ‸0‸\nEnter a positive number: ‸12‸\nThank you: 12\n' }
    ],
    recap: 'The body runs, THEN the question is asked — so it always runs at least once. Remember the semicolon after <code>while (…)</code>.'
  },

  {
    id: 'break-continue',
    order: 75,
    group: 'Doing it again',
    title: 'break and continue',
    tagline: 'Leaving early, and skipping just this one',
    icon: 'skip-forward',
    file: 'skip.c',
    match: { folders: ['starter-folder-lp-rep'], code: /\b(break|continue)\s*;/ },
    code:
`#include <stdio.h>

int main(void) {
    int i;

    for (i = 1; i <= 6; i++) {
        if (i % 3 == 0) {
            continue;
        }
        printf("%d ", i);
    }
    printf("\\n");

    for (i = 1; i <= 6; i++) {
        if (i == 4) {
            break;
        }
        printf("%d ", i);
    }
    printf("\\n");
    return 0;
}`,
    steps: [
      { lines: [6, 7], say: 'First loop. The test is "is i a multiple of 3?" — using the remainder operator from the operators walkthrough.', vars: { i: '1' } },
      { line: 10, say: '1 is not, so it prints.', vars: { i: '1' }, out: '1 ' },
      { line: 10, say: '2 likewise.', vars: { i: '2' }, out: '1 2 ' },
      { line: 8, say: 'i is 3, so <code>continue</code> runs — and it jumps STRAIGHT to the next pass. The printf below is skipped, but the loop itself carries on.', vars: { i: '3' }, out: '1 2 ' },
      { line: 6, say: 'Important detail: continue does not skip the <code>i++</code>. In a <code>for</code> the step is part of the loop machinery, so it still happens.', vars: { i: '4' }, out: '1 2 ' },
      { line: 10, say: '4 and 5 print, 6 is skipped, and the loop finishes normally.', vars: { i: '6' }, out: '1 2 4 5 \n' },
      { line: 14, say: 'Second loop, same range.', vars: { i: '1' }, out: '1 2 4 5 \n' },
      { line: 18, say: '1, 2 and 3 print.', vars: { i: '3' }, out: '1 2 4 5 \n1 2 3 ' },
      { line: 16, say: 'i is 4 and <code>break</code> runs. This does not skip a pass — it <strong>ends the loop entirely</strong>. Execution continues after the closing brace.', vars: { i: '4' }, out: '1 2 4 5 \n1 2 3 ' },
      { line: 20, say: 'So 5 and 6 never happen. That is the difference in one word: continue means "not this one", break means "no more".', vars: { i: '4' }, out: '1 2 4 5 \n1 2 3 \n' },
      { line: 16, say: 'One trap worth knowing now: in NESTED loops, break leaves only the loop it is in — the inner one. There is no "break out of both" in C; you need a flag, or a function you can return from.', vars: {}, out: '1 2 4 5 \n1 2 3 \n' }
    ],
    recap: '<code>continue</code> skips the rest of this pass; <code>break</code> ends the loop. In nested loops, break only leaves the inner one.'
  },

  /* ══ Structs ═════════════════════════════════════════════ */

  {
    id: 'typedef',
    order: 172,
    group: 'Structs',
    title: 'typedef',
    tagline: 'A shorter name for a type you will write a hundred times',
    icon: 'tag',
    file: 'typedef.c',
    // No folder of its own on purpose. Every struct program in the pack uses
    // typedef, so claiming that folder outranked the struct walkthrough and
    // left the more basic idea unreachable. This one is offered as the
    // follow-up from `struct`, which is the order it should be met in.
    match: { code: /typedef/ },
    code:
`#include <stdio.h>

struct PokemonTag {
    int level;
    int hp;
};

typedef struct PokemonTag Pokemon;

typedef struct {
    int x;
    int y;
} Point;

void show(Pokemon p) {
    printf("Lv %d HP %d\\n", p.level, p.hp);
}

int main(void) {
    struct PokemonTag a = {5, 20};
    Pokemon b = {12, 35};
    Point origin = {0, 0};

    show(a);
    show(b);
    printf("(%d, %d)\\n", origin.x, origin.y);
    return 0;
}`,
    steps: [
      { lines: [3, 6], say: 'An ordinary struct. Its full type name is <code>struct PokemonTag</code> — both words, every time you declare one, pass one, or return one.', vars: {} },
      { line: 8, say: '<code>typedef</code> gives an existing type a second name. Read it as a declaration with the word typedef on the front: this says "<code>Pokemon</code> is now another way of writing <code>struct PokemonTag</code>".', vars: {} },
      { line: 8, say: 'It creates nothing and costs nothing at runtime. There is no new type here — just a shorter name for one that already existed.', vars: {} },
      { lines: [10, 13], say: 'And the form you will see most: the tag is left out entirely and the name comes after the closing brace. <code>Point</code> is the only name this struct has.', vars: {} },
      { line: 15, say: 'Which makes parameters and return types readable. <code>Pokemon p</code> rather than <code>struct PokemonTag p</code> — on a function taking three of them, that is the difference between a line and a paragraph.', vars: {} },
      { line: 20, say: 'The old spelling still works. <code>a</code> is declared the long way.', vars: { 'a': 'Lv 5, 20 hp' } },
      { line: 21, say: 'And <code>b</code> the short way. These are the SAME TYPE — not two similar ones — so anything that takes one takes the other.', vars: { 'a': 'Lv 5, 20 hp', 'b': 'Lv 12, 35 hp' } },
      { line: 22, say: '<code>Point</code> has no long form to fall back on, because no tag was ever written.', vars: { 'origin': '(0, 0)' } },
      { lines: [24, 25], say: 'Both go to the same function, and it cannot tell which spelling declared them.', vars: {}, out: 'Lv 5 HP 20\nLv 12 HP 35\n' },
      { line: 26, say: 'One place the tag is still needed: a struct that refers to ITSELF. <code>typedef struct Node { int v; Node *next; } Node;</code> does not compile — the name does not exist yet inside the braces. You write <code>struct Node *next;</code> there, which is why linked-list code carries both.', vars: {}, out: 'Lv 5 HP 20\nLv 12 HP 35\n(0, 0)\n' }
    ],
    recap: '<code>typedef</code> is an alias, not a new type. It is what lets you write <code>Pokemon</code> instead of <code>struct PokemonTag</code> everywhere.'
  }


];
