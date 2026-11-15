/* ============================================================
   CODEX-DATA.JS — the C Codex's built-in entries
   ------------------------------------------------------------
   One entry per operator, keyword, type, format code, escape, directive and
   library function the course uses. Short keys to keep the file small:

     id   stable id            n   the name as written in C (what F1 matches)
     c    category id          h   header it needs ('' for the language)
     s    signature or form    d   one sentence: what it does
     x    a little more        m   common mistakes
     r    related entry ids    k   concepts (concepts.js) it belongs to
     ex   an example: statements run inside main, or a whole program
     out  exactly what the example prints (null: varies, e.g. an address)

   EVERY EXAMPLE IS RUN. tools/verify-codex.js wraps each example the way
   the Codex does (standard headers and main), compiles it with gcc and
   checks it prints `out` exactly. Run it after any change here:
       node tools/verify-codex.js
   Sizes are gcc's on a 64-bit machine; the in-browser compiler is 32-bit,
   so long, size_t and pointers are 4 bytes there. No example prints them.
   ============================================================ */

const CODEX_CATS = [
  { id: 'operators', name: 'Operators', icon: 'plus-minus', table: true },
  { id: 'keywords', name: 'Keywords', icon: 'key-round' },
  { id: 'types', name: 'Types and sizes', icon: 'box', table: true },
  { id: 'formats', name: 'Format codes', icon: 'percent', table: true },
  { id: 'escapes', name: 'Escape sequences', icon: 'corner-down-left', table: true },
  { id: 'preprocessor', name: 'Preprocessor', icon: 'hash' },
  { id: 'stdio', name: 'stdio.h', icon: 'terminal' },
  { id: 'stdlib', name: 'stdlib.h', icon: 'package' },
  { id: 'string', name: 'string.h', icon: 'type' },
  { id: 'ctype', name: 'ctype.h', icon: 'case-sensitive' },
  { id: 'math', name: 'math.h', icon: 'sigma' },
  { id: 'errors', name: 'Compiler errors', icon: 'bug' }
];

/* Operator precedence, highest first: the Operators table. */
const CODEX_PRECEDENCE = [
  { ops: ['()', '[]', '.', '->', 'x++', 'x--'], assoc: 'left to right', what: 'call, index, member, after-increment' },
  { ops: ['++x', '--x', '+x', '-x', '!', '~', '(type)', '*p', '&x', 'sizeof'], assoc: 'right to left', what: 'unary: before-increment, sign, not, cast, dereference, address' },
  { ops: ['*', '/', '%'], assoc: 'left to right', what: 'multiply, divide, remainder' },
  { ops: ['+', '-'], assoc: 'left to right', what: 'add, subtract' },
  { ops: ['<<', '>>'], assoc: 'left to right', what: 'bit shift' },
  { ops: ['<', '<=', '>', '>='], assoc: 'left to right', what: 'compare' },
  { ops: ['==', '!='], assoc: 'left to right', what: 'equal, not equal' },
  { ops: ['&'], assoc: 'left to right', what: 'bitwise and' },
  { ops: ['^'], assoc: 'left to right', what: 'bitwise exclusive or' },
  { ops: ['|'], assoc: 'left to right', what: 'bitwise or' },
  { ops: ['&&'], assoc: 'left to right', what: 'logical and (stops at the first false)' },
  { ops: ['||'], assoc: 'left to right', what: 'logical or (stops at the first true)' },
  { ops: ['?:'], assoc: 'right to left', what: 'choose one of two values' },
  { ops: ['=', '+=', '-=', '*=', '/=', '%=', '<<=', '>>=', '&=', '^=', '|='], assoc: 'right to left', what: 'assign' },
  { ops: [','], assoc: 'left to right', what: 'do both, the value is the right one' }
];

const CODEX_ENTRIES = [
  /* ── Operators ── */
  { id: 'op-plus', n: '+', c: 'operators', s: 'a + b', d: 'Adds two numbers. Written before one value (+x) it does nothing.', ex: String.raw`printf("%d\n", 7 + 5);`, out: '12\n', r: ['op-minus', 'op-pluseq', 'op-inc'] },
  { id: 'op-minus', n: '-', c: 'operators', s: 'a - b   -x', d: 'Subtracts, or before one value turns its sign around.', ex: String.raw`int x = 4;
printf("%d %d\n", 10 - x, -x);`, out: '6 -4\n', r: ['op-plus', 'op-minuseq', 'op-dec'] },
  { id: 'op-star', n: '*', c: 'operators', s: 'a * b   *p', d: 'Multiplies; before a pointer it means "the thing it points at" (dereference).', x: 'In a declaration, int *p means p is a pointer to int. In an expression, *p reads or writes what p points at.', ex: String.raw`int n = 6;
int *p = &n;
*p = *p * 7;
printf("%d\n", n);`, out: '42\n', m: ['Using *p when p is NULL or was never set.'], r: ['op-amp', 'op-arrow', 'kw-null'], k: ['pointer'] },
  { id: 'op-slash', n: '/', c: 'operators', s: 'a / b', d: 'Divides. Between two ints it throws the fraction away; make one side a double to keep it.', ex: String.raw`printf("%d %.1f\n", 7 / 2, 7 / 2.0);`, out: '3 3.5\n', m: ['7 / 2 is 3, not 3.5: both are ints.', 'Dividing by zero.'], r: ['op-mod', 'op-cast'] },
  { id: 'op-mod', n: '%', c: 'operators', s: 'a % b', d: 'The remainder of dividing two ints: 7 % 3 is 1. x % 2 == 0 means x is even.', ex: String.raw`printf("%d %d\n", 7 % 3, 10 % 2);`, out: '1 0\n', m: ['% only works on integers; use fmod for doubles.'], r: ['op-slash', 'math-fmod'] },
  { id: 'op-inc', n: '++', c: 'operators', s: 'x++   ++x', d: 'Adds one to a variable. x++ gives the old value, ++x the new one.', ex: String.raw`int i = 5;
int a = i++;
int b = ++i;
printf("%d %d %d\n", a, b, i);`, out: '5 7 7\n', m: ['Using i++ and i in the same expression: the order is not defined.'], r: ['op-dec', 'op-pluseq'], k: ['loop'] },
  { id: 'op-dec', n: '--', c: 'operators', s: 'x--   --x', d: 'Takes one from a variable. x-- gives the old value, --x the new one.', ex: String.raw`int i = 3;
while (i-- > 0) {
    printf("%d ", i);
}
printf("\n");`, out: '2 1 0 \n', r: ['op-inc', 'op-minuseq'] },
  { id: 'op-eq', n: '==', c: 'operators', s: 'a == b', d: 'Is a equal to b? Gives 1 for yes, 0 for no.', ex: String.raw`int x = 3;
printf("%d %d\n", x == 3, x == 4);`, out: '1 0\n', m: ['Writing = (assign) where == (compare) was meant: if (x = 3) is always true.', 'Comparing strings with ==: use strcmp.'], r: ['op-ne', 'op-assign', 'str-strcmp'], k: ['if'] },
  { id: 'op-ne', n: '!=', c: 'operators', s: 'a != b', d: 'Is a different from b? Gives 1 for yes, 0 for no.', ex: String.raw`printf("%d\n", 3 != 4);`, out: '1\n', r: ['op-eq', 'op-not'] },
  { id: 'op-lt', n: '<', c: 'operators', s: 'a < b', d: 'Is a less than b?', ex: String.raw`for (int i = 0; i < 3; i++) printf("%d", i);
printf("\n");`, out: '012\n', m: ['i <= n in a loop over an array of n elements runs one step too far.'], r: ['op-le', 'op-gt'], k: ['for'] },
  { id: 'op-le', n: '<=', c: 'operators', s: 'a <= b', d: 'Is a less than or equal to b?', ex: String.raw`printf("%d %d\n", 3 <= 3, 4 <= 3);`, out: '1 0\n', r: ['op-lt', 'op-ge'] },
  { id: 'op-gt', n: '>', c: 'operators', s: 'a > b', d: 'Is a greater than b?', ex: String.raw`printf("%d\n", 5 > 2);`, out: '1\n', r: ['op-ge', 'op-lt'] },
  { id: 'op-ge', n: '>=', c: 'operators', s: 'a >= b', d: 'Is a greater than or equal to b?', ex: String.raw`int score = 75;
if (score >= 75) printf("pass\n");`, out: 'pass\n', r: ['op-gt', 'op-le'] },
  { id: 'op-and', n: '&&', c: 'operators', s: 'a && b', d: 'True when both are true. Stops early: if a is false, b is never looked at.', ex: String.raw`int age = 20;
if (age >= 13 && age <= 19) printf("teen\n");
else printf("not a teen\n");`, out: 'not a teen\n', m: ['Writing & (bitwise) for && (logical).', '13 <= age <= 19 does not mean what it says in C: use &&.'], r: ['op-or', 'op-not'], k: ['if'] },
  { id: 'op-or', n: '||', c: 'operators', s: 'a || b', d: 'True when either is true. Stops early: if a is true, b is never looked at.', ex: String.raw`char c = 'Y';
if (c == 'y' || c == 'Y') printf("yes\n");`, out: 'yes\n', r: ['op-and', 'op-not'], k: ['if'] },
  { id: 'op-not', n: '!', c: 'operators', s: '!x', d: 'Turns true into false and false into true: !0 is 1, !5 is 0.', ex: String.raw`int done = 0;
if (!done) printf("keep going\n");`, out: 'keep going\n', r: ['op-and', 'op-ne'] },
  { id: 'op-assign', n: '=', c: 'operators', s: 'x = value', d: 'Stores a value in a variable. The whole expression has that value too, so a = b = 0 sets both.', ex: String.raw`int a, b;
a = b = 7;
printf("%d %d\n", a, b);`, out: '7 7\n', m: ['= in an if condition where == was meant.'], r: ['op-eq', 'op-pluseq'] },
  { id: 'op-pluseq', n: '+=', c: 'operators', s: 'x += value', d: 'x += 5 is short for x = x + 5. -=, *=, /= and %= work the same way.', ex: String.raw`int total = 10;
total += 5;
total *= 2;
printf("%d\n", total);`, out: '30\n', r: ['op-plus', 'op-minuseq'] },
  { id: 'op-minuseq', n: '-=', c: 'operators', s: 'x -= value', d: 'x -= 3 is short for x = x - 3.', ex: String.raw`int lives = 3;
lives -= 1;
printf("%d\n", lives);`, out: '2\n', r: ['op-pluseq', 'op-minus'] },
  { id: 'op-amp', n: '&', c: 'operators', s: '&x   a & b', d: 'Before a variable, its address (where it lives in memory). Between two ints, bitwise and.', x: 'scanf needs the address of the variable to store into, which is why it is scanf("%d", &n). An array name is already an address, so no & for strings.', ex: String.raw`int n = 0;
int *p = &n;
*p = 9;
printf("%d %d\n", n, 6 & 3);`, out: '9 2\n', m: ['Forgetting & in scanf("%d", &n).', 'Writing & where && was meant.'], r: ['op-star', 'io-scanf'], k: ['pointer', 'scanf'] },
  { id: 'op-arrow', n: '->', c: 'operators', s: 'p->member', d: 'A member of the struct a pointer points at: p->age is short for (*p).age.', ex: String.raw`struct pt { int x, y; } a = {3, 4};
struct pt *p = &a;
p->y = 10;
printf("%d %d\n", p->x, a.y);`, out: '3 10\n', m: ['Using . on a pointer or -> on a struct itself.', 'Using p->next when p is NULL.'], r: ['op-dot', 'kw-struct', 'op-star'], k: ['pointer'] },
  { id: 'op-dot', n: '.', c: 'operators', s: 's.member', d: 'A member of a struct variable.', ex: String.raw`struct pt { int x, y; } a = {3, 4};
a.x = a.x + a.y;
printf("%d\n", a.x);`, out: '7\n', r: ['op-arrow', 'kw-struct'] },
  { id: 'op-index', n: '[]', c: 'operators', s: 'a[i]', d: 'The element at index i. The first is a[0]; the last of n elements is a[n - 1].', ex: String.raw`int a[] = {10, 20, 30};
printf("%d %d\n", a[0], a[2]);`, out: '10 30\n', m: ['a[n] for an array of n elements is past the end.'], r: ['ty-array', 'op-star'], k: ['array'] },
  { id: 'op-call', n: '()', c: 'operators', s: 'f(args)   (type)x', d: 'Calls a function with arguments; around a type, a cast; around an expression, grouping.', ex: String.raw`int sum = (2 + 3) * 4;
printf("%d\n", sum);`, out: '20\n', r: ['op-cast', 'kw-return'], k: ['function'] },
  { id: 'op-cast', n: '(type)', c: 'operators', s: '(double)x', d: 'Converts a value to another type, for example to keep the fraction in a division.', ex: String.raw`int sum = 7, n = 2;
printf("%.2f\n", (double)sum / n);`, out: '3.50\n', m: ['(double)(sum / n) casts after the int division has already thrown the fraction away.'], r: ['op-slash', 'ty-double'] },
  { id: 'op-ternary', n: '?:', c: 'operators', s: 'cond ? a : b', d: 'If cond is true the value is a, otherwise b. A small if that gives back a value.', ex: String.raw`int n = 7;
printf("%s\n", n % 2 == 0 ? "even" : "odd");`, out: 'odd\n', r: ['kw-if'], k: ['ternary'] },
  { id: 'op-comma', n: ',', c: 'operators', s: 'a, b', d: 'Separates arguments and declarations; as an operator, does a then b. Most seen in a for loop with two counters.', ex: String.raw`for (int i = 0, j = 3; i < j; i++, j--) printf("%d%d ", i, j);
printf("\n");`, out: '03 12 \n', r: ['kw-for'] },
  { id: 'op-shl', n: '<<', c: 'operators', s: 'a << n', d: 'Shifts the bits of a left by n places: the same as multiplying by 2 to the n.', ex: String.raw`printf("%d\n", 1 << 4);`, out: '16\n', r: ['op-shr'] },
  { id: 'op-shr', n: '>>', c: 'operators', s: 'a >> n', d: 'Shifts the bits right by n places: for positive numbers, dividing by 2 to the n.', ex: String.raw`printf("%d\n", 40 >> 2);`, out: '10\n', r: ['op-shl'] },
  { id: 'op-bor', n: '|', c: 'operators', s: 'a | b', d: 'Bitwise or: a bit is 1 if it is 1 in either.', ex: String.raw`printf("%d\n", 5 | 2);`, out: '7\n', m: ['Writing | where || was meant.'], r: ['op-amp', 'op-or'] },
  { id: 'op-xor', n: '^', c: 'operators', s: 'a ^ b', d: 'Bitwise exclusive or: a bit is 1 if it differs. It is not a power: use pow.', ex: String.raw`printf("%d\n", 6 ^ 3);`, out: '5\n', m: ['2 ^ 3 is 1, not 8.'], r: ['math-pow'] },
  { id: 'op-bnot', n: '~', c: 'operators', s: '~x', d: 'Flips every bit. For an int, ~x is -x - 1.', ex: String.raw`printf("%d\n", ~5);`, out: '-6\n', r: ['op-not'] },

  /* ── Keywords ── */
  { id: 'kw-if', n: 'if', c: 'keywords', s: 'if (cond) { ... } else { ... }', d: 'Runs a block only when the condition is true (not zero).', ex: String.raw`int t = 30;
if (t > 25) {
    printf("hot\n");
} else {
    printf("fine\n");
}`, out: 'hot\n', m: ['A ; straight after if (cond) makes an empty statement the body.', '= instead of == in the condition.'], r: ['kw-else', 'op-ternary', 'kw-switch'], k: ['if', 'ifelse'] },
  { id: 'kw-else', n: 'else', c: 'keywords', s: 'else { ... }   else if (cond) { ... }', d: 'The block that runs when the if before it was false. else if chains more tests.', ex: String.raw`int s = 82;
if (s >= 90) printf("A\n");
else if (s >= 80) printf("B\n");
else printf("C\n");`, out: 'B\n', r: ['kw-if'], k: ['ifelse'] },
  { id: 'kw-switch', n: 'switch', c: 'keywords', s: 'switch (n) { case 1: ... break; default: ... }', d: 'Picks a case by an integer value. Without break, it falls through into the next case.', ex: String.raw`int day = 2;
switch (day) {
    case 1: printf("Mon\n"); break;
    case 2: printf("Tue\n"); break;
    default: printf("?\n");
}`, out: 'Tue\n', m: ['Forgetting break, so the next case runs too.', 'switch on a string: it only takes integers and chars.'], r: ['kw-case', 'kw-break', 'kw-default'], k: ['switch'] },
  { id: 'kw-case', n: 'case', c: 'keywords', s: 'case 3:', d: 'A label inside a switch: where to start when the value matches.', ex: String.raw`char g = 'b';
switch (g) {
    case 'a':
    case 'b': printf("good\n"); break;
    default: printf("other\n");
}`, out: 'good\n', r: ['kw-switch', 'kw-default'], k: ['switch'] },
  { id: 'kw-default', n: 'default', c: 'keywords', s: 'default:', d: 'The switch label that runs when no case matched.', ex: String.raw`switch (9) {
    case 1: printf("one\n"); break;
    default: printf("something else\n");
}`, out: 'something else\n', r: ['kw-switch', 'kw-case'], k: ['switch'] },
  { id: 'kw-break', n: 'break', c: 'keywords', s: 'break;', d: 'Leaves the nearest loop or switch at once.', ex: String.raw`for (int i = 1; i <= 10; i++) {
    if (i == 4) break;
    printf("%d ", i);
}
printf("\n");`, out: '1 2 3 \n', r: ['kw-continue', 'kw-switch'], k: ['loop'] },
  { id: 'kw-continue', n: 'continue', c: 'keywords', s: 'continue;', d: 'Skips the rest of this pass of the loop and goes on to the next.', ex: String.raw`for (int i = 1; i <= 5; i++) {
    if (i % 2 == 0) continue;
    printf("%d ", i);
}
printf("\n");`, out: '1 3 5 \n', r: ['kw-break'], k: ['loop'] },
  { id: 'kw-for', n: 'for', c: 'keywords', s: 'for (start; keep going while; step) { ... }', d: 'A loop with its counter in one place: where it starts, how long it runs, how it moves.', ex: String.raw`for (int i = 3; i > 0; i--) printf("%d ", i);
printf("go\n");`, out: '3 2 1 go\n', m: ['A ; after the ) makes the loop body empty.', 'i <= n over n elements runs once too often.'], r: ['kw-while', 'kw-do', 'kw-break'], k: ['for', 'loop'] },
  { id: 'kw-while', n: 'while', c: 'keywords', s: 'while (cond) { ... }', d: 'Repeats a block as long as the condition is true; checks before each pass.', ex: String.raw`int n = 1;
while (n < 100) n *= 3;
printf("%d\n", n);`, out: '243\n', m: ['Forgetting to change what the condition tests, so it never ends.'], r: ['kw-for', 'kw-do'], k: ['while', 'loop'] },
  { id: 'kw-do', n: 'do', c: 'keywords', s: 'do { ... } while (cond);', d: 'A loop that runs its body first and checks afterwards, so it always runs at least once.', ex: String.raw`int n = 10;
do {
    printf("%d\n", n);
} while (n < 5);`, out: '10\n', m: ['Forgetting the ; after while (cond).'], r: ['kw-while'], k: ['dowhile', 'loop'] },
  { id: 'kw-return', n: 'return', c: 'keywords', s: 'return value;', d: 'Ends the function and hands a value back to the caller. In main, the program\'s exit status.', ex: String.raw`#include <stdio.h>

int square(int x) {
    return x * x;
}

int main(void) {
    printf("%d\n", square(9));
    return 0;
}`, out: '81\n', m: ['A non-void function that can reach its end without returning.'], r: ['kw-void'], k: ['function'] },
  { id: 'kw-void', n: 'void', c: 'keywords', s: 'void f(void)', d: 'No value: a function that returns nothing, or (in the brackets) takes nothing.', ex: String.raw`#include <stdio.h>

void greet(void) {
    printf("hi\n");
}

int main(void) {
    greet();
    return 0;
}`, out: 'hi\n', r: ['kw-return'], k: ['function'] },
  { id: 'kw-struct', n: 'struct', c: 'keywords', s: 'struct name { type member; ... };', d: 'Groups several values under one name, each with its own type.', ex: String.raw`struct book { char title[20]; int pages; };
struct book b = {"C", 270};
printf("%s has %d pages\n", b.title, b.pages);`, out: 'C has 270 pages\n', m: ['Forgetting the ; after the closing }.', 'Comparing two structs with ==: compare members.'], r: ['op-dot', 'op-arrow', 'kw-typedef'] },
  { id: 'kw-typedef', n: 'typedef', c: 'keywords', s: 'typedef struct { ... } Name;', d: 'Gives a type a new name, often so struct can be left out.', ex: String.raw`typedef struct { int x, y; } Point;
Point p = {1, 2};
printf("%d\n", p.x + p.y);`, out: '3\n', r: ['kw-struct', 'kw-enum'] },
  { id: 'kw-enum', n: 'enum', c: 'keywords', s: 'enum color { RED, GREEN };', d: 'Names for integer constants, counting up from 0 unless told otherwise.', ex: String.raw`enum level { LOW, MID, HIGH };
enum level l = HIGH;
printf("%d\n", l);`, out: '2\n', r: ['kw-typedef', 'pp-define'] },
  { id: 'kw-const', n: 'const', c: 'keywords', s: 'const int MAX = 10;', d: 'A variable that may not be changed after it is set.', ex: String.raw`const double RATE = 0.5;
printf("%.1f\n", 8 * RATE);`, out: '4.0\n', r: ['pp-define'] },
  { id: 'kw-static', n: 'static', c: 'keywords', s: 'static int count;', d: 'Inside a function: a variable that keeps its value between calls. Outside: visible only in this file.', ex: String.raw`#include <stdio.h>

int next(void) {
    static int n = 0;
    return ++n;
}

int main(void) {
    next();
    next();
    printf("%d\n", next());
    return 0;
}`, out: '3\n', r: ['kw-extern'] },
  { id: 'kw-extern', n: 'extern', c: 'keywords', s: 'extern int total;', d: 'Says a variable is defined in another file, so this one can use it.', r: ['kw-static', 'pp-include'] },
  { id: 'kw-sizeof', n: 'sizeof', c: 'keywords', s: 'sizeof(type)   sizeof x', d: 'How many bytes a type or a variable takes. Of an array (in the same function), the whole array.', ex: String.raw`int a[5];
printf("%zu %zu\n", sizeof(int), sizeof a / sizeof a[0]);`, out: '4 5\n', m: ['sizeof of an array passed to a function is the size of a pointer, not the array.'], r: ['ty-int', 'lib-malloc', 'ty-size_t'] },
  { id: 'kw-unsigned', n: 'unsigned', c: 'keywords', s: 'unsigned int n;', d: 'An integer with no negative values, twice the range upward.', ex: String.raw`unsigned int u = 3000000000u;
printf("%u\n", u);`, out: '3000000000\n', m: ['Counting an unsigned down below 0 wraps round to a huge number.'], r: ['ty-int', 'fmt-u'] },
  { id: 'kw-null', n: 'NULL', c: 'keywords', h: 'stddef.h', s: 'p = NULL;', d: 'A pointer that points at nothing. Check for it before using a pointer that might be empty.', ex: String.raw`int *p = NULL;
if (p == NULL) printf("nothing there\n");`, out: 'nothing there\n', m: ['Using *p or p->x when p is NULL: the program crashes (segmentation fault).'], r: ['op-star', 'lib-malloc'], k: ['pointer'] },
  { id: 'kw-goto', n: 'goto', c: 'keywords', s: 'goto label;', d: 'Jumps to a label in the same function. Almost always clearer as a loop or a break.', r: ['kw-break'] },

  /* ── Types ── */
  { id: 'ty-char', n: 'char', c: 'types', size: '1', s: "char c = 'A';", d: 'One character, stored as its code: \'A\' is 65.', ex: String.raw`char c = 'A';
printf("%c %d %c\n", c, c, c + 2);`, out: 'A 65 C\n', m: ['"A" (a string) where \'A\' (a char) was meant.'], r: ['fmt-c', 'ty-string'] },
  { id: 'ty-short', n: 'short', c: 'types', size: '2', s: 'short s;', d: 'A smaller integer, usually from -32768 to 32767.', ex: String.raw`printf("%zu\n", sizeof(short));`, out: '2\n', r: ['ty-int'] },
  { id: 'ty-int', n: 'int', c: 'types', size: '4', s: 'int n = 42;', d: 'The everyday whole number, from about -2.1 billion to 2.1 billion.', ex: String.raw`int n = 2147483647;
printf("%d\n", n);`, out: '2147483647\n', m: ['Overflowing: going past the largest int gives a wrong, often negative, number.'], r: ['ty-long', 'fmt-d'] },
  { id: 'ty-long', n: 'long', c: 'types', size: '8 (4 in the browser)', s: 'long n;', d: 'A wider integer: 8 bytes with gcc on 64-bit, 4 on 32-bit systems such as the in-browser compiler.', ex: String.raw`long big = 100000L * 3;
printf("%ld\n", big);`, out: '300000\n', r: ['ty-longlong', 'fmt-ld'] },
  { id: 'ty-longlong', n: 'long long', c: 'types', size: '8', s: 'long long n;', d: 'An integer of at least 8 bytes everywhere: about 9.2 quintillion.', ex: String.raw`long long n = 3000000000LL * 3;
printf("%lld\n", n);`, out: '9000000000\n', r: ['ty-long'] },
  { id: 'ty-float', n: 'float', c: 'types', size: '4', s: 'float f = 1.5f;', d: 'A number with a fraction, about 7 digits accurate. Prefer double.', ex: String.raw`float f = 2.5f;
printf("%.2f\n", f * 2);`, out: '5.00\n', r: ['ty-double', 'fmt-f'] },
  { id: 'ty-double', n: 'double', c: 'types', size: '8', s: 'double d = 3.14;', d: 'A number with a fraction, about 15 digits accurate. Printed with %f, read with %lf.', ex: String.raw`double d = 1.0 / 3;
printf("%.4f\n", d);`, out: '0.3333\n', m: ['scanf("%f", &d) for a double: it needs %lf.', 'Comparing doubles with ==: allow a tiny difference.'], r: ['ty-float', 'fmt-f', 'fmt-lf'] },
  { id: 'ty-size_t', n: 'size_t', c: 'types', h: 'stddef.h', size: '8 (4 in the browser)', s: 'size_t n = strlen(s);', d: 'The unsigned type sizes and lengths come in, from sizeof and strlen. Printed with %zu.', ex: String.raw`size_t n = strlen("hello");
printf("%zu\n", n);`, out: '5\n', r: ['kw-sizeof', 'str-strlen'] },
  { id: 'ty-bool', n: 'bool', c: 'types', h: 'stdbool.h', size: '1', s: 'bool ok = true;', d: 'true or false, from stdbool.h. Underneath it is 1 or 0.', ex: String.raw`#include <stdio.h>
#include <stdbool.h>

int main(void) {
    bool ok = 3 > 2;
    printf("%d\n", ok);
    return 0;
}`, out: '1\n', r: ['op-not'] },
  { id: 'ty-array', n: 'array', c: 'types', size: 'n × element', s: 'int a[5] = {0};', d: 'A row of values of one type, numbered from 0. Its size is fixed when it is made.', ex: String.raw`int a[4] = {1, 2};
printf("%d %d\n", a[1], a[3]);`, out: '2 0\n', m: ['Reading or writing a[n] or beyond.', 'Assigning one array to another with =: copy element by element.'], r: ['op-index', 'kw-sizeof'], k: ['array'] },
  { id: 'ty-string', n: 'string', c: 'types', size: 'length + 1', s: 'char name[20] = "Ada";', d: 'C has no string type: a string is a char array ending in \'\\0\'. It needs one byte more than its letters.', ex: String.raw`char s[] = "cat";
printf("%zu %zu\n", strlen(s), sizeof s);`, out: '3 4\n', m: ['An array with no room for the \'\\0\'.', 'Comparing with == or copying with =: use strcmp and strcpy.'], r: ['esc-0', 'str-strlen', 'str-strcpy', 'fmt-s'], k: ['array'] },
  { id: 'ty-pointer', n: 'pointer', c: 'types', size: '8 (4 in the browser)', s: 'int *p = &n;', d: 'A variable that holds an address: where another value lives.', ex: String.raw`int n = 5;
int *p = &n;
printf("%d\n", *p + 1);`, out: '6\n', m: ['Using a pointer that was never set.', 'Returning the address of a local variable.'], r: ['op-star', 'op-amp', 'kw-null'], k: ['pointer'] },

  /* ── Format codes ── */
  { id: 'fmt-d', n: '%d', c: 'formats', s: 'printf("%d", n)', d: 'An int, in decimal. In scanf, reads one into an int.', ex: String.raw`printf("[%d]\n", -42);`, out: '[-42]\n', r: ['fmt-i', 'ty-int', 'io-printf'], k: ['printf'] },
  { id: 'fmt-i', n: '%i', c: 'formats', s: 'printf("%i", n)', d: 'In printf the same as %d. In scanf it also reads 0x1F as hex and 017 as octal.', ex: String.raw`printf("%i\n", 17);`, out: '17\n', r: ['fmt-d'] },
  { id: 'fmt-u', n: '%u', c: 'formats', s: 'printf("%u", u)', d: 'An unsigned int.', ex: String.raw`printf("%u\n", 40u);`, out: '40\n', r: ['kw-unsigned'] },
  { id: 'fmt-ld', n: '%ld', c: 'formats', s: 'printf("%ld", big)', d: 'A long. %lld is a long long.', ex: String.raw`printf("%ld %lld\n", 7L, 8LL);`, out: '7 8\n', r: ['ty-long', 'ty-longlong'] },
  { id: 'fmt-zu', n: '%zu', c: 'formats', s: 'printf("%zu", sizeof x)', d: 'A size_t: what sizeof and strlen give.', ex: String.raw`printf("%zu\n", strlen("four"));`, out: '4\n', r: ['ty-size_t'] },
  { id: 'fmt-f', n: '%f', c: 'formats', s: 'printf("%f", d)', d: 'A double (or float), with 6 decimals unless told otherwise.', ex: String.raw`printf("%f\n", 2.5);`, out: '2.500000\n', m: ['Printing an int with %f: it prints rubbish, not the number.'], r: ['fmt-prec', 'fmt-lf', 'ty-double'], k: ['printf'] },
  { id: 'fmt-lf', n: '%lf', c: 'formats', s: 'scanf("%lf", &d)', d: 'In scanf, reads a double (%f reads a float). In printf it is the same as %f.', ex: String.raw`double d;
sscanf("3.25", "%lf", &d);
printf("%.2f\n", d * 2);`, out: '6.50\n', m: ['scanf("%f", &d) into a double reads it wrong.'], r: ['fmt-f', 'io-scanf'], k: ['scanf'] },
  { id: 'fmt-prec', n: '%.2f', c: 'formats', s: 'printf("%.2f", d)', d: 'A double rounded to 2 decimals. Any number of places: %.0f, %.3f.', ex: String.raw`printf("%.2f %.0f\n", 3.14159, 2.5);`, out: '3.14 2\n', r: ['fmt-f', 'fmt-width'] },
  { id: 'fmt-e', n: '%e', c: 'formats', s: 'printf("%e", d)', d: 'A double in scientific notation.', ex: String.raw`printf("%e\n", 12345.678);`, out: '1.234568e+04\n', r: ['fmt-f', 'fmt-g'] },
  { id: 'fmt-g', n: '%g', c: 'formats', s: 'printf("%g", d)', d: 'A double in whichever of %f and %e is shorter, without trailing zeros.', ex: String.raw`printf("%g %g\n", 2.5, 0.00001);`, out: '2.5 1e-05\n', r: ['fmt-f', 'fmt-e'] },
  { id: 'fmt-c', n: '%c', c: 'formats', s: 'printf("%c", ch)', d: 'One character. In scanf, " %c" with a space skips the newline left by the last input.', ex: String.raw`printf("%c%c\n", 'O', 75);`, out: 'OK\n', m: ['scanf("%c") straight after another scanf reads the leftover newline: write " %c".'], r: ['ty-char', 'fmt-s'], k: ['printf', 'scanf'] },
  { id: 'fmt-s', n: '%s', c: 'formats', s: 'printf("%s", str)', d: 'A string, up to its \'\\0\'. In scanf it reads one word (stops at a space).', ex: String.raw`char name[] = "Ada";
printf("Hi, %s!\n", name);`, out: 'Hi, Ada!\n', m: ['scanf("%s", &name): a char array needs no &.', 'scanf("%s") stops at the first space: use fgets for a line.'], r: ['ty-string', 'io-fgets'], k: ['printf'] },
  { id: 'fmt-p', n: '%p', c: 'formats', s: 'printf("%p", (void *)p)', d: 'A pointer\'s address, in hex. It changes from run to run.', ex: String.raw`int n;
printf("%p\n", (void *)&n);`, out: null, r: ['ty-pointer'] },
  { id: 'fmt-x', n: '%x', c: 'formats', s: 'printf("%x", n)', d: 'An unsigned int in hexadecimal (%X for capitals).', ex: String.raw`printf("%x %X\n", 255, 255);`, out: 'ff FF\n', r: ['fmt-o'] },
  { id: 'fmt-o', n: '%o', c: 'formats', s: 'printf("%o", n)', d: 'An unsigned int in octal.', ex: String.raw`printf("%o\n", 8);`, out: '10\n', r: ['fmt-x'] },
  { id: 'fmt-pct', n: '%%', c: 'formats', s: 'printf("%%")', d: 'A percent sign itself.', ex: String.raw`printf("%d%%\n", 50);`, out: '50%\n', m: ['A lone % followed by a letter is read as a format code.'], r: ['io-printf'] },
  { id: 'fmt-width', n: '%5d', c: 'formats', s: 'printf("%5d", n)   printf("%-5d", n)', d: 'At least 5 characters wide, padded with spaces on the left; %-5d pads on the right; %05d with zeros.', ex: String.raw`printf("[%5d][%-5d][%05d]\n", 42, 42, 42);`, out: '[   42][42   ][00042]\n', r: ['fmt-prec', 'fmt-d'] },

  /* ── Escape sequences ── */
  { id: 'esc-n', n: '\\n', c: 'escapes', s: '"line\\n"', d: 'A new line.', ex: String.raw`printf("one\ntwo\n");`, out: 'one\ntwo\n', m: ['Writing /n instead of \\n.'], r: ['esc-t', 'io-printf'] },
  { id: 'esc-t', n: '\\t', c: 'escapes', s: '"a\\tb"', d: 'A tab: moves to the next tab stop.', ex: String.raw`printf("a\tb\n");`, out: 'a\tb\n', r: ['esc-n'] },
  { id: 'esc-bs', n: '\\\\', c: 'escapes', s: '"C:\\\\path"', d: 'A backslash itself.', ex: String.raw`printf("C:\\temp\n");`, out: 'C:\\temp\n', r: ['esc-q'] },
  { id: 'esc-q', n: '\\"', c: 'escapes', s: '"say \\"hi\\""', d: 'A double quote inside a string.', ex: String.raw`printf("she said \"hi\"\n");`, out: 'she said "hi"\n', r: ['esc-sq', 'esc-bs'] },
  { id: 'esc-sq', n: "\\'", c: 'escapes', s: "'\\''", d: 'A single quote as a char.', ex: String.raw`printf("%c\n", '\'');`, out: "'\n", r: ['esc-q', 'ty-char'] },
  { id: 'esc-0', n: '\\0', c: 'escapes', s: "s[i] = '\\0';", d: 'The null character: the end-of-string marker. Its code is 0.', ex: String.raw`char s[] = "hello";
s[2] = '\0';
printf("%s\n", s);`, out: 'he\n', m: ['Forgetting room for it, or forgetting to add it when building a string by hand.'], r: ['ty-string', 'str-strlen'] },
  { id: 'esc-r', n: '\\r', c: 'escapes', s: '"\\r"', d: 'Carriage return: back to the start of the line. Windows files end lines with \\r\\n.', r: ['esc-n'] },

  /* ── Preprocessor ── */
  { id: 'pp-include', n: '#include', c: 'preprocessor', s: '#include <stdio.h>   #include "mine.h"', d: 'Pastes in a header: <...> for the system\'s, "..." for your own files.', ex: String.raw`#include <stdio.h>

int main(void) {
    puts("included");
    return 0;
}`, out: 'included\n', m: ['Calling a library function without its header: "implicit declaration".'], r: ['pp-define', 'pp-guard'] },
  { id: 'pp-define', n: '#define', c: 'preprocessor', s: '#define MAX 100', d: 'A name the preprocessor replaces with its text before compiling. No = and no ;.', ex: String.raw`#include <stdio.h>
#define SIZE 3

int main(void) {
    int a[SIZE] = {1, 2, 3};
    printf("%d\n", a[SIZE - 1]);
    return 0;
}`, out: '3\n', m: ['#define MAX = 100; puts "= 100;" wherever MAX is written.'], r: ['kw-const', 'pp-include'] },
  { id: 'pp-guard', n: '#ifndef', c: 'preprocessor', s: '#ifndef NAME_H\n#define NAME_H\n...\n#endif', d: 'An include guard: a header wrapped this way is only pasted in once, however many files include it.', r: ['pp-include', 'pp-define'] },
  { id: 'pp-if', n: '#if', c: 'preprocessor', s: '#if DEBUG ... #endif', d: 'Keeps or drops code before compiling, depending on a constant.', ex: String.raw`#include <stdio.h>
#define DEBUG 0

int main(void) {
#if DEBUG
    puts("debugging");
#endif
    puts("done");
    return 0;
}`, out: 'done\n', r: ['pp-define', 'pp-guard'] },

  /* ── stdio.h ── */
  { id: 'io-printf', n: 'printf', c: 'stdio', h: 'stdio.h', s: 'int printf(const char *format, ...);', d: 'Prints text, with each % code replaced by the next argument.', ex: String.raw`int n = 3;
double avg = 2.5;
printf("%d items, %.1f each\n", n, avg);`, out: '3 items, 2.5 each\n', m: ['A format code that does not match the argument\'s type.', 'Fewer arguments than % codes.'], r: ['fmt-d', 'fmt-f', 'fmt-s', 'io-puts'], k: ['printf'] },
  { id: 'io-scanf', n: 'scanf', c: 'stdio', h: 'stdio.h', s: 'int scanf(const char *format, ...);', d: 'Reads input into variables, given their addresses. Returns how many it read.', x: 'scanf("%d", &n) returns 1 on success, 0 when the input was not a number, and EOF at the end of input. A failed read leaves the bad characters waiting, so clear the line before trying again.', ex: String.raw`int a, b;
if (sscanf("4 9", "%d %d", &a, &b) == 2) printf("%d\n", a + b);`, out: '13\n', m: ['Forgetting & before the variable.', 'Not checking the return value, so bad input loops forever.', '%f for a double: use %lf.'], r: ['op-amp', 'fmt-lf', 'io-fgets', 'io-getchar'], k: ['scanf'] },
  { id: 'io-puts', n: 'puts', c: 'stdio', h: 'stdio.h', s: 'int puts(const char *s);', d: 'Prints a string and a newline after it.', ex: String.raw`puts("Hello");
puts("World");`, out: 'Hello\nWorld\n', r: ['io-printf', 'io-fputs'] },
  { id: 'io-putchar', n: 'putchar', c: 'stdio', h: 'stdio.h', s: 'int putchar(int c);', d: 'Prints one character.', ex: String.raw`for (char c = 'a'; c <= 'e'; c++) putchar(c);
putchar('\n');`, out: 'abcde\n', r: ['io-getchar'] },
  { id: 'io-getchar', n: 'getchar', c: 'stdio', h: 'stdio.h', s: 'int getchar(void);', d: 'Reads one character, or EOF at the end of input. Returns an int so EOF fits.', x: 'while ((c = getchar()) != \'\\n\' && c != EOF) {} throws away the rest of an input line.', m: ['Storing the result in a char, so EOF cannot be told apart.'], r: ['io-putchar', 'io-eof', 'io-scanf'], k: ['scanf'] },
  { id: 'io-fgets', n: 'fgets', c: 'stdio', h: 'stdio.h', s: 'char *fgets(char *buf, int size, FILE *stream);', d: 'Reads one line, spaces and all, into buf (at most size - 1 characters). Keeps the \\n.', ex: String.raw`char line[32] = "Ada Lovelace\n";
line[strcspn(line, "\n")] = '\0';
printf("[%s]\n", line);`, out: '[Ada Lovelace]\n', m: ['Forgetting that the \\n is kept: remove it with strcspn.', 'Using gets, which has no size limit.'], r: ['io-scanf', 'io-fopen', 'str-strlen'] },
  { id: 'io-fopen', n: 'fopen', c: 'stdio', h: 'stdio.h', s: 'FILE *fopen(const char *path, const char *mode);', d: 'Opens a file: "r" to read, "w" to write (emptying it), "a" to add to the end. NULL if it fails.', m: ['Not checking for NULL.', 'Forgetting fclose.'], r: ['io-fclose', 'io-fprintf', 'io-fgets', 'io-file'] },
  { id: 'io-fclose', n: 'fclose', c: 'stdio', h: 'stdio.h', s: 'int fclose(FILE *fp);', d: 'Closes a file opened with fopen, writing out anything still waiting.', r: ['io-fopen'] },
  { id: 'io-fprintf', n: 'fprintf', c: 'stdio', h: 'stdio.h', s: 'int fprintf(FILE *fp, const char *format, ...);', d: 'printf, but into a file (or stderr).', ex: String.raw`fprintf(stdout, "%d\n", 12);`, out: '12\n', r: ['io-printf', 'io-fopen'] },
  { id: 'io-fscanf', n: 'fscanf', c: 'stdio', h: 'stdio.h', s: 'int fscanf(FILE *fp, const char *format, ...);', d: 'scanf, but from a file.', r: ['io-scanf', 'io-fopen'] },
  { id: 'io-sprintf', n: 'sprintf', c: 'stdio', h: 'stdio.h', s: 'int sprintf(char *buf, const char *format, ...);', d: 'printf, but into a string. snprintf takes the buffer size and is safer.', ex: String.raw`char buf[32];
snprintf(buf, sizeof buf, "%d-%d", 2, 7);
puts(buf);`, out: '2-7\n', m: ['A buffer too small for the result.'], r: ['io-printf', 'io-sscanf'] },
  { id: 'io-sscanf', n: 'sscanf', c: 'stdio', h: 'stdio.h', s: 'int sscanf(const char *str, const char *format, ...);', d: 'scanf, but from a string.', ex: String.raw`int d, m, y;
sscanf("16/11/2026", "%d/%d/%d", &d, &m, &y);
printf("%d\n", y);`, out: '2026\n', r: ['io-scanf', 'io-sprintf'] },
  { id: 'io-fputs', n: 'fputs', c: 'stdio', h: 'stdio.h', s: 'int fputs(const char *s, FILE *fp);', d: 'Writes a string to a file, without adding a newline.', ex: String.raw`fputs("no newline", stdout);
fputs("\n", stdout);`, out: 'no newline\n', r: ['io-puts'] },
  { id: 'io-eof', n: 'EOF', c: 'stdio', h: 'stdio.h', s: 'while ((c = getchar()) != EOF)', d: 'The value input functions return at the end of input: a negative int, usually -1.', ex: String.raw`printf("%d\n", EOF);`, out: '-1\n', r: ['io-getchar', 'io-scanf'] },
  { id: 'io-file', n: 'FILE', c: 'stdio', h: 'stdio.h', s: 'FILE *fp;', d: 'The type of an open file. You only ever hold a pointer to one.', r: ['io-fopen'] },

  /* ── stdlib.h ── */
  { id: 'lib-malloc', n: 'malloc', c: 'stdlib', h: 'stdlib.h', s: 'void *malloc(size_t bytes);', d: 'Asks for a block of memory of that many bytes. NULL if there is none. The block is not cleared.', ex: String.raw`int *a = malloc(3 * sizeof *a);
if (a == NULL) return 1;
for (int i = 0; i < 3; i++) a[i] = i * i;
printf("%d\n", a[2]);
free(a);`, out: '4\n', m: ['Not checking for NULL.', 'malloc(n) instead of malloc(n * sizeof *p).', 'Never calling free.'], r: ['lib-free', 'lib-calloc', 'lib-realloc', 'kw-sizeof'], k: ['pointer'] },
  { id: 'lib-calloc', n: 'calloc', c: 'stdlib', h: 'stdlib.h', s: 'void *calloc(size_t count, size_t size);', d: 'Like malloc for count items of size bytes, but every byte set to zero.', ex: String.raw`int *a = calloc(4, sizeof *a);
if (a == NULL) return 1;
printf("%d\n", a[3]);
free(a);`, out: '0\n', r: ['lib-malloc', 'lib-free'] },
  { id: 'lib-realloc', n: 'realloc', c: 'stdlib', h: 'stdlib.h', s: 'void *realloc(void *p, size_t bytes);', d: 'Makes a block bigger or smaller, moving it if it has to. Keep the old pointer until it succeeds.', ex: String.raw`int *a = malloc(2 * sizeof *a);
if (a == NULL) return 1;
a[0] = 7;
int *b = realloc(a, 10 * sizeof *b);
if (b == NULL) { free(a); return 1; }
printf("%d\n", b[0]);
free(b);`, out: '7\n', m: ['p = realloc(p, n) loses the block when it fails.'], r: ['lib-malloc', 'lib-free'] },
  { id: 'lib-free', n: 'free', c: 'stdlib', h: 'stdlib.h', s: 'void free(void *p);', d: 'Gives a block from malloc, calloc or realloc back. free(NULL) does nothing.', m: ['Using the block after freeing it.', 'Freeing twice, or freeing what malloc did not give.'], r: ['lib-malloc'], k: ['pointer'] },
  { id: 'lib-exit', n: 'exit', c: 'stdlib', h: 'stdlib.h', s: 'void exit(int status);', d: 'Ends the program at once from anywhere: exit(0) for success, exit(1) for failure.', r: ['kw-return'] },
  { id: 'lib-atoi', n: 'atoi', c: 'stdlib', h: 'stdlib.h', s: 'int atoi(const char *s);', d: 'Turns text like "42" into the number 42 (0 if it is not a number). strtol tells you when it fails.', ex: String.raw`printf("%d\n", atoi("42") + 1);`, out: '43\n', r: ['lib-atof', 'io-sscanf'] },
  { id: 'lib-atof', n: 'atof', c: 'stdlib', h: 'stdlib.h', s: 'double atof(const char *s);', d: 'Turns text like "2.5" into a double.', ex: String.raw`printf("%.1f\n", atof("2.5") * 2);`, out: '5.0\n', r: ['lib-atoi'] },
  { id: 'lib-rand', n: 'rand', c: 'stdlib', h: 'stdlib.h', s: 'int rand(void);', d: 'A pseudo-random number from 0 to RAND_MAX. rand() % 6 + 1 is a die roll.', m: ['Calling srand inside a loop, so the numbers repeat.'], r: ['lib-srand'] },
  { id: 'lib-srand', n: 'srand', c: 'stdlib', h: 'stdlib.h', s: 'void srand(unsigned seed);', d: 'Starts rand at a different place. Once, at the start: srand(time(NULL)).', r: ['lib-rand', 'tm-time'] },
  { id: 'lib-abs', n: 'abs', c: 'stdlib', h: 'stdlib.h', s: 'int abs(int n);', d: 'The size of an int without its sign. fabs does doubles.', ex: String.raw`printf("%d %d\n", abs(-7), abs(7));`, out: '7 7\n', r: ['math-fabs'] },
  { id: 'lib-qsort', n: 'qsort', c: 'stdlib', h: 'stdlib.h', s: 'void qsort(void *base, size_t n, size_t size, int (*cmp)(const void *, const void *));', d: 'Sorts any array, using your function to compare two elements.', ex: String.raw`#include <stdio.h>
#include <stdlib.h>

int by_value(const void *a, const void *b) {
    return *(const int *)a - *(const int *)b;
}

int main(void) {
    int v[] = {5, 1, 4};
    qsort(v, 3, sizeof v[0], by_value);
    printf("%d %d %d\n", v[0], v[1], v[2]);
    return 0;
}`, out: '1 4 5\n', r: ['lib-malloc'] },

  /* ── string.h ── */
  { id: 'str-strlen', n: 'strlen', c: 'string', h: 'string.h', s: 'size_t strlen(const char *s);', d: 'How many characters come before the \'\\0\'.', ex: String.raw`printf("%zu\n", strlen("hello"));`, out: '5\n', m: ['Calling it in a loop condition: it walks the whole string every time.'], r: ['ty-string', 'kw-sizeof'] },
  { id: 'str-strcpy', n: 'strcpy', c: 'string', h: 'string.h', s: 'char *strcpy(char *dest, const char *src);', d: 'Copies a string, \'\\0\' included, into dest. dest must be big enough.', ex: String.raw`char a[10];
strcpy(a, "copy");
puts(a);`, out: 'copy\n', m: ['A destination too small.', 'a = "text" for an array: use strcpy.'], r: ['str-strncpy', 'str-strcat'] },
  { id: 'str-strncpy', n: 'strncpy', c: 'string', h: 'string.h', s: 'char *strncpy(char *dest, const char *src, size_t n);', d: 'Copies at most n characters. Does NOT add the \'\\0\' when src is n long or longer.', ex: String.raw`char a[4];
strncpy(a, "abcdef", 3);
a[3] = '\0';
puts(a);`, out: 'abc\n', m: ['Forgetting to end the string yourself.'], r: ['str-strcpy'] },
  { id: 'str-strcat', n: 'strcat', c: 'string', h: 'string.h', s: 'char *strcat(char *dest, const char *src);', d: 'Adds src onto the end of dest. dest must have room for both.', ex: String.raw`char s[20] = "rain";
strcat(s, "bow");
puts(s);`, out: 'rainbow\n', r: ['str-strcpy'] },
  { id: 'str-strcmp', n: 'strcmp', c: 'string', h: 'string.h', s: 'int strcmp(const char *a, const char *b);', d: 'Compares two strings: 0 when equal, less than 0 when a sorts first, more than 0 when b does.', ex: String.raw`printf("%d %d\n", strcmp("cat", "cat") == 0, strcmp("ant", "bee") < 0);`, out: '1 1\n', m: ['if (strcmp(a, b)) means "if different", not "if equal".', 'Comparing strings with ==.'], r: ['str-strncmp', 'op-eq'] },
  { id: 'str-strncmp', n: 'strncmp', c: 'string', h: 'string.h', s: 'int strncmp(const char *a, const char *b, size_t n);', d: 'strcmp, looking at only the first n characters.', ex: String.raw`printf("%d\n", strncmp("hello", "help", 3) == 0);`, out: '1\n', r: ['str-strcmp'] },
  { id: 'str-strchr', n: 'strchr', c: 'string', h: 'string.h', s: 'char *strchr(const char *s, int c);', d: 'A pointer to the first c in s, or NULL.', ex: String.raw`const char *at = strchr("key=value", '=');
puts(at + 1);`, out: 'value\n', r: ['str-strstr'] },
  { id: 'str-strstr', n: 'strstr', c: 'string', h: 'string.h', s: 'char *strstr(const char *hay, const char *needle);', d: 'A pointer to where needle first appears in hay, or NULL.', ex: String.raw`printf("%d\n", strstr("haystack", "st") != NULL);`, out: '1\n', r: ['str-strchr'] },
  { id: 'str-strcspn', n: 'strcspn', c: 'string', h: 'string.h', s: 'size_t strcspn(const char *s, const char *reject);', d: 'How many characters of s come before any of reject: the usual way to cut fgets\' newline.', ex: String.raw`char line[] = "hi\n";
line[strcspn(line, "\n")] = '\0';
printf("[%s]\n", line);`, out: '[hi]\n', r: ['io-fgets'] },
  { id: 'str-memset', n: 'memset', c: 'string', h: 'string.h', s: 'void *memset(void *p, int byte, size_t n);', d: 'Sets n bytes to one value: most often 0, to clear an array.', ex: String.raw`int a[3] = {1, 2, 3};
memset(a, 0, sizeof a);
printf("%d\n", a[1]);`, out: '0\n', r: ['str-memcpy', 'lib-calloc'] },
  { id: 'str-memcpy', n: 'memcpy', c: 'string', h: 'string.h', s: 'void *memcpy(void *dest, const void *src, size_t n);', d: 'Copies n bytes, for any kind of data (arrays, structs).', ex: String.raw`int a[3] = {4, 5, 6}, b[3];
memcpy(b, a, sizeof a);
printf("%d\n", b[2]);`, out: '6\n', r: ['str-memset', 'str-strcpy'] },

  /* ── ctype.h ── */
  { id: 'ct-isdigit', n: 'isdigit', c: 'ctype', h: 'ctype.h', s: 'int isdigit(int c);', d: 'Is c one of \'0\'..\'9\'? (Not zero means yes.)', ex: String.raw`int n = 0;
for (const char *p = "a1b22"; *p; p++) if (isdigit((unsigned char)*p)) n++;
printf("%d\n", n);`, out: '3\n', r: ['ct-isalpha', 'ct-isalnum'] },
  { id: 'ct-isalpha', n: 'isalpha', c: 'ctype', h: 'ctype.h', s: 'int isalpha(int c);', d: 'Is c a letter?', ex: String.raw`printf("%d %d\n", isalpha('q') != 0, isalpha('7') != 0);`, out: '1 0\n', r: ['ct-isdigit', 'ct-isalnum'] },
  { id: 'ct-isalnum', n: 'isalnum', c: 'ctype', h: 'ctype.h', s: 'int isalnum(int c);', d: 'Is c a letter or a digit?', ex: String.raw`printf("%d\n", isalnum('_') != 0);`, out: '0\n', r: ['ct-isalpha', 'ct-isdigit'] },
  { id: 'ct-isspace', n: 'isspace', c: 'ctype', h: 'ctype.h', s: 'int isspace(int c);', d: 'Is c a space, tab, newline or other blank?', ex: String.raw`printf("%d\n", isspace('\t') != 0);`, out: '1\n', r: ['ct-isalpha'] },
  { id: 'ct-isupper', n: 'isupper', c: 'ctype', h: 'ctype.h', s: 'int isupper(int c);   int islower(int c);', d: 'Is c a capital letter (isupper) or a small one (islower)?', ex: String.raw`printf("%d %d\n", isupper('A') != 0, islower('A') != 0);`, out: '1 0\n', r: ['ct-toupper'] },
  { id: 'ct-toupper', n: 'toupper', c: 'ctype', h: 'ctype.h', s: 'int toupper(int c);   int tolower(int c);', d: 'The capital (toupper) or small (tolower) version of a letter; anything else comes back unchanged.', ex: String.raw`printf("%c%c\n", toupper('x'), tolower('Y'));`, out: 'Xy\n', r: ['ct-isupper'] },

  /* ── math.h ── */
  { id: 'math-sqrt', n: 'sqrt', c: 'math', h: 'math.h', s: 'double sqrt(double x);', d: 'The square root. With gcc, link with -lm.', ex: String.raw`printf("%.1f\n", sqrt(81.0));`, out: '9.0\n', r: ['math-pow'] },
  { id: 'math-pow', n: 'pow', c: 'math', h: 'math.h', s: 'double pow(double x, double y);', d: 'x to the power y. C has no ** or ^ for powers.', ex: String.raw`printf("%.0f\n", pow(2, 10));`, out: '1024\n', m: ['Writing 2 ^ 10, which is bitwise exclusive or.'], r: ['math-sqrt', 'op-xor'] },
  { id: 'math-fabs', n: 'fabs', c: 'math', h: 'math.h', s: 'double fabs(double x);', d: 'The size of a double without its sign.', ex: String.raw`printf("%.2f\n", fabs(-2.75));`, out: '2.75\n', r: ['lib-abs'] },
  { id: 'math-floor', n: 'floor', c: 'math', h: 'math.h', s: 'double floor(double x);   double ceil(double x);', d: 'Rounds down (floor) or up (ceil) to a whole number.', ex: String.raw`printf("%.0f %.0f\n", floor(2.7), ceil(2.1));`, out: '2 3\n', r: ['math-round'] },
  { id: 'math-round', n: 'round', c: 'math', h: 'math.h', s: 'double round(double x);', d: 'Rounds to the nearest whole number, halves away from zero.', ex: String.raw`printf("%.0f %.0f\n", round(2.5), round(-2.5));`, out: '3 -3\n', r: ['math-floor'] },
  { id: 'math-fmod', n: 'fmod', c: 'math', h: 'math.h', s: 'double fmod(double x, double y);', d: 'The remainder of x / y for doubles (% only takes ints).', ex: String.raw`printf("%.1f\n", fmod(7.5, 2));`, out: '1.5\n', r: ['op-mod'] },

  /* ── time.h ── */
  { id: 'tm-time', n: 'time', c: 'stdlib', h: 'time.h', s: 'time_t time(time_t *t);', d: 'Seconds since 1970. time(NULL) is the usual seed for srand.', r: ['lib-srand'] }
];

/* An example as the Codex runs it: statements go inside main, with the usual headers. */
function codexWrap(ex) {
  const src = String(ex || '');
  if (/\bmain\s*\(/.test(src)) return src;
  const body = src.split('\n').map(l => (l ? '    ' + l : l)).join('\n');
  return '#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n#include <ctype.h>\n#include <math.h>\n\nint main(void) {\n'
    + body + '\n    return 0;\n}\n';
}

if (typeof module !== 'undefined' && module.exports) module.exports = { CODEX_CATS, CODEX_PRECEDENCE, CODEX_ENTRIES, codexWrap };
