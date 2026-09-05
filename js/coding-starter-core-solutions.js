/* ============================================================
   CODING-STARTER-CORE-SOLUTIONS.JS — reference answers for tier 0
   ------------------------------------------------------------
   One entry per program in coding-starter-core.js. Every one of these is
   compiled with gcc and run against that program's own tests by
   tools/verify-pack.js, because a reference that fails its own tests marks
   correct work wrong and does it silently.

   They are written the way a student at that point in the course would write
   them -- no construct appears before the folder that teaches it. The answer
   to a printing exercise does not quietly use a loop.
   ============================================================ */

const CS_CORE_SOLUTIONS = {

  /* ── 0.1 Printing ───────────────────────────────────────── */

  'c-print-line':
    '#include <stdio.h>\n\nint main(void) {\n    printf("C is fun.\\n");\n    return 0;\n}\n',

  'c-print-two':
    '#include <stdio.h>\n\nint main(void) {\n    printf("Line one\\n");\n    printf("Line two\\n");\n    return 0;\n}\n',

  'c-print-escape':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    printf("She said \\"hello\\" and left.\\n");\n'
    + '    printf("The path is C:\\\\Users\\\\me\\n");\n'
    + '    return 0;\n}\n',

  'c-print-tab':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    printf("Name\\tAge\\n");\n'
    + '    printf("Ann\\t19\\n");\n'
    + '    printf("Bo\\t21\\n");\n'
    + '    return 0;\n}\n',

  'c-print-int':
    '#include <stdio.h>\n\nint main(void) {\n    printf("%d\\n", 42);\n    return 0;\n}\n',

  'c-print-two-ints':
    '#include <stdio.h>\n\nint main(void) {\n    printf("%d and %d\\n", 7, 9);\n    return 0;\n}\n',

  'c-print-float':
    '#include <stdio.h>\n\nint main(void) {\n    printf("%.2f\\n", 3.14159);\n    return 0;\n}\n',

  'c-print-char':
    '#include <stdio.h>\n\nint main(void) {\n    printf("%c%c%c\\n", \'C\', \'-\', \'9\');\n    return 0;\n}\n',

  'c-print-percent':
    '#include <stdio.h>\n\nint main(void) {\n    printf("Battery: 87%%\\n");\n    return 0;\n}\n',

  'c-print-box':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    printf("+----+\\n");\n'
    + '    printf("|    |\\n");\n'
    + '    printf("+----+\\n");\n'
    + '    return 0;\n}\n',

  /* ── 0.2 Variables and types ────────────────────────────── */

  'c-var-int':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int score = 25;\n    printf("score = %d\\n", score);\n    return 0;\n}\n',

  'c-var-assign':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int n = 5;\n    printf("%d\\n", n);\n    n = 12;\n    printf("%d\\n", n);\n    return 0;\n}\n',

  'c-var-float':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    float price = 19.5f;\n    printf("%.2f\\n", price);\n    return 0;\n}\n',

  'c-var-char':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    char grade = \'B\';\n    printf("Grade: %c\\n", grade);\n    return 0;\n}\n',

  'c-var-sizeof':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    printf("char: %d\\n", (int)sizeof(char));\n'
    + '    printf("int: %d\\n", (int)sizeof(int));\n'
    + '    printf("float: %d\\n", (int)sizeof(float));\n'
    + '    printf("double: %d\\n", (int)sizeof(double));\n'
    + '    return 0;\n}\n',

  'c-var-many':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int a = 1, b = 2, c = 3;\n'
    + '    printf("%d %d %d\\n", a, b, c);\n    return 0;\n}\n',

  'c-var-swap-temp':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int a, b, temp;\n    scanf("%d", &a);\n    scanf("%d", &b);\n'
    + '    temp = a;\n    a = b;\n    b = temp;\n'
    + '    printf("a = %d, b = %d\\n", a, b);\n    return 0;\n}\n',

  'c-var-cast':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int a = 7, b = 2;\n'
    + '    printf("%d\\n", a / b);\n'
    + '    printf("%.2f\\n", (float)a / b);\n'
    + '    return 0;\n}\n',

  'c-var-char-code':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    char c;\n    scanf(" %c", &c);\n'
    + '    printf("%c is %d\\n", c, c);\n    return 0;\n}\n',

  'c-var-const':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    const float PI = 3.14159f;\n    float r;\n    scanf("%f", &r);\n'
    + '    printf("%.2f\\n", PI * r * r);\n    return 0;\n}\n',

  /* ── 0.3 Reading input ──────────────────────────────────── */

  'c-in-int':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int n;\n    scanf("%d", &n);\n    printf("You typed %d\\n", n);\n    return 0;\n}\n',

  'c-in-two':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int a, b;\n    scanf("%d", &a);\n    scanf("%d", &b);\n'
    + '    printf("%d %d\\n", a, b);\n    return 0;\n}\n',

  'c-in-one-call':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int a, b;\n    scanf("%d %d", &a, &b);\n'
    + '    printf("sum = %d\\n", a + b);\n    return 0;\n}\n',

  'c-in-float':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    float x;\n    scanf("%f", &x);\n    printf("%.3f\\n", x);\n    return 0;\n}\n',

  'c-in-char':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    char c;\n    scanf(" %c", &c);\n    printf("[%c]\\n", c);\n    return 0;\n}\n',

  'c-in-mixed':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int n;\n    float x;\n    scanf("%d %f", &n, &x);\n'
    + '    printf("%d then %.1f\\n", n, x);\n    return 0;\n}\n',

  'c-in-reverse-three':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int a, b, c;\n    scanf("%d %d %d", &a, &b, &c);\n'
    + '    printf("%d %d %d\\n", c, b, a);\n    return 0;\n}\n',

  'c-in-sum-avg':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int a, b;\n    scanf("%d %d", &a, &b);\n'
    + '    printf("sum = %d\\n", a + b);\n'
    + '    printf("avg = %.1f\\n", (a + b) / 2.0);\n'
    + '    return 0;\n}\n',

  /* ── 0.4 Operators ──────────────────────────────────────── */

  'c-op-five':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int a, b;\n    scanf("%d %d", &a, &b);\n'
    + '    printf("%d\\n", a + b);\n'
    + '    printf("%d\\n", a - b);\n'
    + '    printf("%d\\n", a * b);\n'
    + '    printf("%d\\n", a / b);\n'
    + '    printf("%d\\n", a % b);\n'
    + '    return 0;\n}\n',

  'c-op-intdiv':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int a, b;\n    scanf("%d %d", &a, &b);\n'
    + '    printf("int: %d\\n", a / b);\n'
    + '    printf("real: %.2f\\n", (float)a / b);\n'
    + '    return 0;\n}\n',

  'c-op-last-digit':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int n;\n    scanf("%d", &n);\n    printf("%d\\n", n % 10);\n    return 0;\n}\n',

  'c-op-split-digits':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int n;\n    scanf("%d", &n);\n'
    + '    printf("%d %d %d\\n", n / 100, (n / 10) % 10, n % 10);\n'
    + '    return 0;\n}\n',

  'c-op-precedence':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int a, b, c;\n    scanf("%d %d %d", &a, &b, &c);\n'
    + '    printf("%d\\n", a + b * c);\n'
    + '    printf("%d\\n", (a + b) * c);\n'
    + '    return 0;\n}\n',

  'c-op-compound':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int n;\n    scanf("%d", &n);\n'
    + '    n += 10;\n    printf("%d\\n", n);\n'
    + '    n *= 2;\n    printf("%d\\n", n);\n'
    + '    n -= 5;\n    printf("%d\\n", n);\n'
    + '    return 0;\n}\n',

  'c-op-increment':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int n = 5;\n'
    + '    printf("%d\\n", n++);\n'
    + '    printf("%d\\n", n);\n'
    + '    printf("%d\\n", ++n);\n'
    + '    return 0;\n}\n',

  'c-op-avg-three':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int a, b, c;\n    scanf("%d %d %d", &a, &b, &c);\n'
    + '    printf("%.2f\\n", (a + b + c) / 3.0);\n'
    + '    return 0;\n}\n',

  'c-op-seconds':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int t;\n    scanf("%d", &t);\n'
    + '    printf("%d:%d:%d\\n", t / 3600, (t % 3600) / 60, t % 60);\n'
    + '    return 0;\n}\n',

  'c-op-swap-math':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int a, b;\n    scanf("%d %d", &a, &b);\n'
    + '    a = a + b;\n    b = a - b;\n    a = a - b;\n'
    + '    printf("%d %d\\n", a, b);\n    return 0;\n}\n'
};
