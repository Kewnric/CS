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
    match: { requires: ['printf'], folders: ['starter-folder-core-var', 'starter-folder-core-op'] },
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
      { line: 3, say: 'A second, separate box is made, called <code>n</code>, and the value 5 is copied into it. Two boxes now. They hold the same number and have nothing else to do with each other.', vars: { 'main · score': '5', 'addTen · n': '5' } },
      { line: 4, say: '<code>n = n + 10</code>. This changes <strong>n</strong>. Watch score: it does not move, because nobody touched it.', vars: { 'main · score': '5', 'addTen · n': '15' } },
      { line: 5, say: 'Print from inside, and n really is 15. The function did exactly what it was asked.', vars: { 'main · score': '5', 'addTen · n': '15' }, out: 'inside:  n is 15\n' },
      { line: 6, say: 'addTen ends — and <code>n</code> ceases to exist. It was a local copy, and its lifetime was the call.', vars: { 'main · score': '5' }, out: 'inside:  n is 15\n' },
      { line: 12, say: 'Back in main. <code>score</code> is still 5. Nothing went wrong; the function was never given anything that could change it.', vars: { 'main · score': '5' }, out: 'inside:  n is 15\noutside: score is 5\n' },
      { line: 11, say: 'This is <strong>pass by value</strong>, and it is the default for every plain variable in C. A function receives copies, so it cannot reach back and alter its caller\'s variables — which is usually exactly what you want.', vars: { 'main · score': '5' }, out: 'inside:  n is 15\noutside: score is 5\n' }
    ],
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
      { line: 4, say: 'An ordinary variable. It holds 5, and it lives somewhere in memory — say address 1000. You never normally care where.', vars: { score: '5   (at 1000)' } },
      { line: 5, say: 'Two new pieces of notation, and they are opposites. <code>&amp;score</code> means "the ADDRESS of score" — 1000, not 5.', vars: { score: '5   (at 1000)' } },
      { line: 5, say: '<code>int *p</code> declares p as "a thing that holds the address of an int". So p now holds 1000. p is a box too; what is inside it is a location.', vars: { score: '5   (at 1000)', p: '1000' } },
      { line: 7, say: 'Printing score prints 5, the way it always did. Nothing about score has changed.', vars: { score: '5   (at 1000)', p: '1000' }, out: 'score is 5\n' },
      { line: 8, say: '<code>*p</code> is the other direction: "go to the address in p and use what is there". That is 1000, and 1000 holds 5. This is called <strong>dereferencing</strong>.', vars: { score: '5   (at 1000)', p: '1000' }, out: 'score is 5\np points at 5\n' },
      { line: 10, say: 'And it works as a destination too. <code>*p = 99</code> means "go to 1000 and put 99 there". It never mentions score.', vars: { score: '99   (at 1000)', p: '1000' }, out: 'score is 5\np points at 5\n' },
      { line: 11, say: 'But score IS 1000, so score is 99 now. That is the whole point of a pointer: a second way to reach one box.', vars: { score: '99   (at 1000)', p: '1000' }, out: 'score is 5\np points at 5\nscore is now 99\n' }
    ],
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
      { line: 8, say: 'Same start as the pass-by-value walkthrough: score holds 5, at some address — say 1000.', vars: { 'main · score': '5   (at 1000)' } },
      { line: 10, say: 'And here is the one difference that changes everything: <code>&amp;score</code>. We are not handing over the value 5 — we are handing over the ADDRESS 1000.', vars: { 'main · score': '5   (at 1000)' } },
      { line: 3, say: 'So the parameter has to be able to hold an address: <code>int *n</code>. A copy is still made — but it is a copy of the address, and a copy of an address still points at the original box.', vars: { 'main · score': '5   (at 1000)', 'addTen · n': '1000' } },
      { line: 4, say: '<code>*n</code> reads through the address: go to 1000, find 5. Add ten to get 15.', vars: { 'main · score': '5   (at 1000)', 'addTen · n': '1000' } },
      { line: 4, say: 'And <code>*n =</code> writes through it: go to 1000, put 15 there. That box belongs to main.', vars: { 'main · score': '15   (at 1000)', 'addTen · n': '1000' } },
      { line: 5, say: 'addTen ends and <code>n</code> disappears, exactly like last time. But what it did while it was alive was permanent, because it reached outside itself.', vars: { 'main · score': '15   (at 1000)' } },
      { line: 11, say: 'score is 15. The function changed its caller\'s variable — that is <strong>pass by reference</strong>.', vars: { 'main · score': '15   (at 1000)' }, out: 'score is 15\n' },
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

];
