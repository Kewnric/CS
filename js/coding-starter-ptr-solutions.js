/* ============================================================
   CODING-STARTER-PTR-SOLUTIONS.JS — references for functions and pointers
   ------------------------------------------------------------
   Compiled and run against their own tests by tools/verify-pack.js.

   A pointer exercise cannot be marked on the address it prints -- that number
   is different on every run. So every one of these is marked on what the
   pointer DID: the value it read, or the caller's variable it changed. That
   is the useful half anyway.
   ============================================================ */

const CS_PTR_SOLUTIONS = {

  /* ── A · Functions ──────────────────────────────────────── */

  'fn-hello':
    '#include <stdio.h>\n\n'
    + 'void greet(void) {\n    printf("Hello from a function\\n");\n}\n\n'
    + 'int main(void) {\n    greet();\n    return 0;\n}\n',

  'fn-call-twice':
    '#include <stdio.h>\n\n'
    + 'void line(void) {\n    printf("----\\n");\n}\n\n'
    + 'int main(void) {\n    line();\n    printf("middle\\n");\n    line();\n    return 0;\n}\n',

  'fn-param':
    '#include <stdio.h>\n\n'
    + 'void showSquare(int n) {\n    printf("%d\\n", n * n);\n}\n\n'
    + 'int main(void) {\n    int n;\n    scanf("%d", &n);\n    showSquare(n);\n    return 0;\n}\n',

  'fn-two-params':
    '#include <stdio.h>\n\n'
    + 'void showSum(int a, int b) {\n    printf("%d\\n", a + b);\n}\n\n'
    + 'int main(void) {\n    int a, b;\n    scanf("%d %d", &a, &b);\n    showSum(a, b);\n    return 0;\n}\n',

  'fn-return':
    '#include <stdio.h>\n\n'
    + 'int square(int n) {\n    return n * n;\n}\n\n'
    + 'int main(void) {\n    int n;\n    scanf("%d", &n);\n'
    + '    printf("%d\\n", square(n));\n    return 0;\n}\n',

  'fn-return-use':
    '#include <stdio.h>\n\n'
    + 'int square(int n) {\n    return n * n;\n}\n\n'
    + 'int main(void) {\n    int a, b;\n    scanf("%d %d", &a, &b);\n'
    + '    printf("%d\\n", square(a) + square(b));\n    return 0;\n}\n',

  'fn-max2':
    '#include <stdio.h>\n\n'
    + 'int larger(int a, int b) {\n    if (a > b) return a;\n    return b;\n}\n\n'
    + 'int main(void) {\n    int a, b;\n    scanf("%d %d", &a, &b);\n'
    + '    printf("%d\\n", larger(a, b));\n    return 0;\n}\n',

  'fn-max3':
    '#include <stdio.h>\n\n'
    + 'int larger(int a, int b) {\n    if (a > b) return a;\n    return b;\n}\n\n'
    + 'int largest3(int a, int b, int c) {\n    return larger(larger(a, b), c);\n}\n\n'
    + 'int main(void) {\n    int a, b, c;\n    scanf("%d %d %d", &a, &b, &c);\n'
    + '    printf("%d\\n", largest3(a, b, c));\n    return 0;\n}\n',

  'fn-prototype':
    '#include <stdio.h>\n\n'
    + 'int triple(int n);\n\n'
    + 'int main(void) {\n    int n;\n    scanf("%d", &n);\n'
    + '    printf("%d\\n", triple(n));\n    return 0;\n}\n\n'
    + 'int triple(int n) {\n    return n * 3;\n}\n',

  'fn-scope':
    '#include <stdio.h>\n\n'
    + 'void tryToChange(int n) {\n    n = 99;\n    printf("inside: %d\\n", n);\n}\n\n'
    + 'int main(void) {\n    int n;\n    scanf("%d", &n);\n'
    + '    tryToChange(n);\n    printf("outside: %d\\n", n);\n    return 0;\n}\n',

  'fn-countdown':
    '#include <stdio.h>\n\n'
    + 'void countdown(int n) {\n    if (n < 0) return;\n'
    + '    printf("%d\\n", n);\n    countdown(n - 1);\n}\n\n'
    + 'int main(void) {\n    int n;\n    scanf("%d", &n);\n    countdown(n);\n    return 0;\n}\n',

  'fn-sum-recursive':
    '#include <stdio.h>\n\n'
    + 'int total(int n) {\n    if (n <= 0) return 0;\n    return n + total(n - 1);\n}\n\n'
    + 'int main(void) {\n    int n;\n    scanf("%d", &n);\n'
    + '    printf("%d\\n", total(n));\n    return 0;\n}\n',

  /* ── B · Pointers ───────────────────────────────────────── */

  'ptr-declare':
    '#include <stdio.h>\n\n'
    + 'int main(void) {\n    int x;\n    int *p;\n    scanf("%d", &x);\n'
    + '    p = &x;\n'
    + '    printf("x = %d\\n", x);\n    printf("*p = %d\\n", *p);\n    return 0;\n}\n',

  'ptr-same-box':
    '#include <stdio.h>\n\n'
    + 'int main(void) {\n    int x;\n    scanf("%d", &x);\n    int *p = &x;\n'
    + '    printf("%d\\n", *p == x);\n'
    + '    printf("%d\\n", p == &x);\n    return 0;\n}\n',

  'ptr-change':
    '#include <stdio.h>\n\n'
    + 'int main(void) {\n    int x;\n    scanf("%d", &x);\n    int *p = &x;\n'
    + '    printf("before: %d\\n", x);\n'
    + '    *p = 100;\n'
    + '    printf("after: %d\\n", x);\n    return 0;\n}\n',

  'ptr-add-through':
    '#include <stdio.h>\n\n'
    + 'int main(void) {\n    int x, n;\n    scanf("%d %d", &x, &n);\n    int *p = &x;\n'
    + '    *p = *p + n;\n'
    + '    printf("%d\\n", x);\n    return 0;\n}\n',

  'ptr-two-pointers':
    '#include <stdio.h>\n\n'
    + 'int main(void) {\n    int x;\n    scanf("%d", &x);\n'
    + '    int *p = &x;\n    int *q = &x;\n'
    + '    *p = *p * 2;\n'
    + '    printf("%d\\n", *q);\n    printf("%d\\n", x);\n    return 0;\n}\n',

  'ptr-null':
    '#include <stdio.h>\n\n'
    + 'int main(void) {\n    int x;\n    scanf("%d", &x);\n'
    + '    int *p = NULL;\n'
    + '    if (p == NULL) printf("nothing yet\\n");\n'
    + '    p = &x;\n'
    + '    if (p != NULL) printf("now: %d\\n", *p);\n'
    + '    return 0;\n}\n',

  'ptr-param':
    '#include <stdio.h>\n\n'
    + 'void setToHundred(int *p) {\n    *p = 100;\n}\n\n'
    + 'int main(void) {\n    int n;\n    scanf("%d", &n);\n'
    + '    printf("before: %d\\n", n);\n'
    + '    setToHundred(&n);\n'
    + '    printf("after: %d\\n", n);\n    return 0;\n}\n',

  'ptr-swap-intro':
    '#include <stdio.h>\n\n'
    + 'void swap(int *a, int *b) {\n    int temp = *a;\n    *a = *b;\n    *b = temp;\n}\n\n'
    + 'int main(void) {\n    int x, y;\n    scanf("%d %d", &x, &y);\n'
    + '    swap(&x, &y);\n'
    + '    printf("%d %d\\n", x, y);\n    return 0;\n}\n',

  'ptr-two-results':
    '#include <stdio.h>\n\n'
    + 'void divide(int a, int b, int *quotient, int *remainder) {\n'
    + '    *quotient = a / b;\n    *remainder = a % b;\n}\n\n'
    + 'int main(void) {\n    int a, b, q, r;\n    scanf("%d %d", &a, &b);\n'
    + '    divide(a, b, &q, &r);\n'
    + '    printf("%d remainder %d\\n", q, r);\n    return 0;\n}\n',

  'ptr-minmax-out':
    '#include <stdio.h>\n\n'
    + 'void minMax(int a, int b, int c, int *lo, int *hi) {\n'
    + '    *lo = a;\n    *hi = a;\n'
    + '    if (b < *lo) *lo = b;\n    if (c < *lo) *lo = c;\n'
    + '    if (b > *hi) *hi = b;\n    if (c > *hi) *hi = c;\n}\n\n'
    + 'int main(void) {\n    int a, b, c, lo, hi;\n    scanf("%d %d %d", &a, &b, &c);\n'
    + '    minMax(a, b, c, &lo, &hi);\n'
    + '    printf("%d %d\\n", lo, hi);\n    return 0;\n}\n',

  'ptr-array-name':
    '#include <stdio.h>\n\n'
    + 'int main(void) {\n    int A[5] = {10, 20, 30, 40, 50};\n'
    + '    int *p = A;\n'
    + '    printf("%d\\n", *p);\n'
    + '    printf("%d\\n", A[0]);\n'
    + '    printf("%d\\n", p == &A[0]);\n'
    + '    return 0;\n}\n',

  'ptr-arith':
    '#include <stdio.h>\n\n'
    + 'int main(void) {\n    int A[5] = {10, 20, 30, 40, 50};\n'
    + '    int *p = A;\n'
    + '    printf("%d\\n", *p);\n'
    + '    printf("%d\\n", *(p + 1));\n'
    + '    printf("%d\\n", *(p + 4));\n'
    + '    return 0;\n}\n',

  'ptr-walk':
    '#include <stdio.h>\n\n'
    + 'int main(void) {\n    int n;\n    scanf("%d", &n);\n    int A[100];\n'
    + '    for (int i = 0; i < n; i++) scanf("%d", &A[i]);\n'
    + '    int *p = A;\n'
    + '    for (int i = 0; i < n; i++) {\n'
    + '        printf("%d\\n", *p);\n        p++;\n    }\n'
    + '    return 0;\n}\n',

  'ptr-sum-walk':
    '#include <stdio.h>\n\n'
    + 'int total(int *p, int size) {\n    int sum = 0;\n'
    + '    for (int i = 0; i < size; i++) {\n        sum += *p;\n        p++;\n    }\n'
    + '    return sum;\n}\n\n'
    + 'int main(void) {\n    int n;\n    scanf("%d", &n);\n    int A[100];\n'
    + '    for (int i = 0; i < n; i++) scanf("%d", &A[i]);\n'
    + '    printf("%d\\n", total(A, n));\n    return 0;\n}\n',

  'ptr-to-ptr':
    '#include <stdio.h>\n\n'
    + 'int main(void) {\n    int x;\n    scanf("%d", &x);\n'
    + '    int *p = &x;\n    int **pp = &p;\n'
    + '    printf("%d\\n", x);\n'
    + '    printf("%d\\n", *p);\n'
    + '    printf("%d\\n", **pp);\n'
    + '    **pp = 7;\n'
    + '    printf("%d\\n", x);\n    return 0;\n}\n',

  'ptr-fn':
    '#include <stdio.h>\n\n'
    + 'int add(int a, int b) {\n    return a + b;\n}\n\n'
    + 'int multiply(int a, int b) {\n    return a * b;\n}\n\n'
    + 'int main(void) {\n    int a, b;\n    scanf("%d %d", &a, &b);\n'
    + '    int (*op)(int, int);\n'
    + '    op = add;\n    printf("%d\\n", op(a, b));\n'
    + '    op = multiply;\n    printf("%d\\n", op(a, b));\n'
    + '    return 0;\n}\n'
};
