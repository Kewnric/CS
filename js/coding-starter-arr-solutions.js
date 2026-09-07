/* ============================================================
   CODING-STARTER-ARR-SOLUTIONS.JS — references for the arrays tier
   ------------------------------------------------------------
   Compiled and run against their own tests by tools/verify-pack.js.

   The insert and delete references are written the long way on purpose --
   shifting element by element with an explicit loop -- because that shifting
   IS the lesson. An array has no gap to open or close; you make one by moving
   everything that comes after.
   ============================================================ */

const CS_ARR_SOLUTIONS = {
  /* ── Added variations ────────────────────────────────────
     Compiled and run before being written down; the tests hold what the
     program actually printed. See tools/verify-pack.js. */
  'grid-menu':
    "#include <stdio.h>\n\nint main(void) {\n    int seats[4][5] = {{0}};\n    int choice, r, c, i, j, taken;\n\n    do {\n        printf(\"=== Seat Booking ===\\n\");\n        printf(\"1. Show the plan\\n\");\n        printf(\"2. Book a seat\\n\");\n        printf(\"3. Cancel a seat\\n\");\n        printf(\"4. How many left\\n\");\n        printf(\"0. Exit\\n\");\n        printf(\"Choice: \");\n        scanf(\"%d\", &choice);\n\n        switch (choice) {\n            case 1:\n                for (i = 0; i < 4; i++) {\n                    for (j = 0; j < 5; j++) {\n                        printf(\"%c\", seats[i][j] ? 'X' : '.');\n                    }\n                    printf(\"\\n\");\n                }\n                break;\n            case 2:\n                printf(\"Enter row and seat: \");\n                scanf(\"%d %d\", &r, &c);\n                if (r < 0 || r > 3 || c < 0 || c > 4) {\n                    printf(\"No such seat\\n\");\n                } else if (seats[r][c]) {\n                    printf(\"Already taken\\n\");\n                } else {\n                    seats[r][c] = 1;\n                    printf(\"Booked %d %d\\n\", r, c);\n                }\n                break;\n            case 3:\n                printf(\"Enter row and seat: \");\n                scanf(\"%d %d\", &r, &c);\n                if (r < 0 || r > 3 || c < 0 || c > 4) {\n                    printf(\"No such seat\\n\");\n                } else if (seats[r][c] == 0) {\n                    printf(\"Was not booked\\n\");\n                } else {\n                    seats[r][c] = 0;\n                    printf(\"Cancelled %d %d\\n\", r, c);\n                }\n                break;\n            case 4:\n                taken = 0;\n                for (i = 0; i < 4; i++) {\n                    for (j = 0; j < 5; j++) {\n                        taken = taken + seats[i][j];\n                    }\n                }\n                printf(\"%d free of 20\\n\", 20 - taken);\n                break;\n            case 0:\n                break;\n            default:\n                printf(\"No such choice\\n\");\n                break;\n        }\n    } while (choice != 0);\n\n    printf(\"Bye\\n\");\n    return 0;\n}\n",
  'arr-menu':
    "#include <stdio.h>\n\nint main(void) {\n    int marks[50];\n    int count = 0, choice, i, total, best, worst;\n\n    do {\n        printf(\"=== Gradebook ===\\n\");\n        printf(\"1. Add a mark\\n\");\n        printf(\"2. List\\n\");\n        printf(\"3. Average\\n\");\n        printf(\"4. Highest and lowest\\n\");\n        printf(\"0. Exit\\n\");\n        printf(\"Choice: \");\n        scanf(\"%d\", &choice);\n\n        switch (choice) {\n            case 1:\n                printf(\"Enter a mark: \");\n                scanf(\"%d\", &marks[count]);\n                count = count + 1;\n                printf(\"Recorded %d mark(s)\\n\", count);\n                break;\n            case 2:\n                if (count == 0) {\n                    printf(\"No marks yet\\n\");\n                } else {\n                    for (i = 0; i < count; i++) {\n                        printf(\"%d. %d\\n\", i + 1, marks[i]);\n                    }\n                }\n                break;\n            case 3:\n                if (count == 0) {\n                    printf(\"No marks yet\\n\");\n                } else {\n                    total = 0;\n                    for (i = 0; i < count; i++) {\n                        total = total + marks[i];\n                    }\n                    printf(\"Average %.2f\\n\", (double) total / count);\n                }\n                break;\n            case 4:\n                if (count == 0) {\n                    printf(\"No marks yet\\n\");\n                } else {\n                    best = marks[0];\n                    worst = marks[0];\n                    for (i = 1; i < count; i++) {\n                        if (marks[i] > best) best = marks[i];\n                        if (marks[i] < worst) worst = marks[i];\n                    }\n                    printf(\"Highest %d lowest %d\\n\", best, worst);\n                }\n                break;\n            case 0:\n                break;\n            default:\n                printf(\"No such choice\\n\");\n                break;\n        }\n    } while (choice != 0);\n\n    printf(\"Bye\\n\");\n    return 0;\n}\n",

  /* ── A · One row of boxes ───────────────────────────────── */

  'ar-print-fixed':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int A[5] = {3, 1, 4, 1, 5};\n'
    + '    for (int i = 0; i < 5; i++) {\n        printf("%d\\n", A[i]);\n    }\n'
    + '    return 0;\n}\n',

  'ar-index':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int A[5] = {10, 20, 30, 40, 50};\n    int i;\n    scanf("%d", &i);\n'
    + '    printf("%d\\n", A[i]);\n    return 0;\n}\n',

  'ar-read-print':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int n;\n    scanf("%d", &n);\n    int A[100];\n'
    + '    for (int i = 0; i < n; i++) scanf("%d", &A[i]);\n'
    + '    for (int i = 0; i < n; i++) printf("%d\\n", A[i]);\n'
    + '    return 0;\n}\n',

  'ar-sum-avg':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int n;\n    scanf("%d", &n);\n    int A[100];\n    int sum = 0;\n'
    + '    for (int i = 0; i < n; i++) scanf("%d", &A[i]);\n'
    + '    for (int i = 0; i < n; i++) sum += A[i];\n'
    + '    printf("sum = %d\\n", sum);\n'
    + '    printf("avg = %.2f\\n", (float)sum / n);\n'
    + '    return 0;\n}\n',

  'ar-max-index':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int n;\n    scanf("%d", &n);\n    int A[100];\n'
    + '    for (int i = 0; i < n; i++) scanf("%d", &A[i]);\n'
    + '    int best = 0;\n'
    + '    for (int i = 1; i < n; i++) {\n        if (A[i] > A[best]) best = i;\n    }\n'
    + '    printf("%d at %d\\n", A[best], best);\n'
    + '    return 0;\n}\n',

  'ar-count-over':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int n, limit;\n    scanf("%d", &n);\n    int A[100];\n'
    + '    for (int i = 0; i < n; i++) scanf("%d", &A[i]);\n'
    + '    scanf("%d", &limit);\n    int count = 0;\n'
    + '    for (int i = 0; i < n; i++) {\n        if (A[i] > limit) count++;\n    }\n'
    + '    printf("%d\\n", count);\n    return 0;\n}\n',

  'ar-reverse-print':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int n;\n    scanf("%d", &n);\n    int A[100];\n'
    + '    for (int i = 0; i < n; i++) scanf("%d", &A[i]);\n'
    + '    for (int i = n - 1; i >= 0; i--) printf("%d ", A[i]);\n'
    + '    printf("\\n");\n    return 0;\n}\n',

  /* ── B · Arrays and functions ───────────────────────────── */

  'ar-fn-sum':
    '#include <stdio.h>\n\n'
    + 'int total(int A[], int size) {\n    int sum = 0;\n'
    + '    for (int i = 0; i < size; i++) sum += A[i];\n    return sum;\n}\n\n'
    + 'int main(void) {\n    int n;\n    scanf("%d", &n);\n    int A[100];\n'
    + '    for (int i = 0; i < n; i++) scanf("%d", &A[i]);\n'
    + '    printf("%d\\n", total(A, n));\n    return 0;\n}\n',

  'ar-fn-modify':
    '#include <stdio.h>\n\n'
    + 'void doubleAll(int A[], int size) {\n'
    + '    for (int i = 0; i < size; i++) A[i] = A[i] * 2;\n}\n\n'
    + 'int main(void) {\n    int n;\n    scanf("%d", &n);\n    int A[100];\n'
    + '    for (int i = 0; i < n; i++) scanf("%d", &A[i]);\n'
    + '    doubleAll(A, n);\n'
    + '    for (int i = 0; i < n; i++) printf("%d ", A[i]);\n'
    + '    printf("\\n");\n    return 0;\n}\n',

  'ar-fn-sizeof':
    '#include <stdio.h>\n\n'
    + 'void report(int A[]) {\n'
    + '    printf("inside: %d\\n", (int)sizeof(A));\n}\n\n'
    + 'int main(void) {\n    int A[10];\n'
    + '    printf("outside: %d\\n", (int)sizeof(A));\n'
    + '    report(A);\n    return 0;\n}\n',

  'ar-fn-fill':
    '#include <stdio.h>\n\n'
    + 'void fillSquares(int A[], int size) {\n'
    + '    for (int i = 0; i < size; i++) A[i] = i * i;\n}\n\n'
    + 'int main(void) {\n    int n;\n    scanf("%d", &n);\n    int A[100];\n'
    + '    fillSquares(A, n);\n'
    + '    for (int i = 0; i < n; i++) printf("%d ", A[i]);\n'
    + '    printf("\\n");\n    return 0;\n}\n',

  /* ── C · Array operations ───────────────────────────────── */

  'ar-search':
    '#include <stdio.h>\n\n'
    + 'int findIt(int A[], int size, int target) {\n'
    + '    for (int i = 0; i < size; i++) {\n        if (A[i] == target) return i;\n    }\n'
    + '    return -1;\n}\n\n'
    + 'int main(void) {\n    int n, target;\n    scanf("%d", &n);\n    int A[100];\n'
    + '    for (int i = 0; i < n; i++) scanf("%d", &A[i]);\n'
    + '    scanf("%d", &target);\n'
    + '    printf("%d\\n", findIt(A, n, target));\n    return 0;\n}\n',

  'ar-search-count':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int n, target;\n    scanf("%d", &n);\n    int A[100];\n'
    + '    for (int i = 0; i < n; i++) scanf("%d", &A[i]);\n'
    + '    scanf("%d", &target);\n    int count = 0;\n'
    + '    for (int i = 0; i < n; i++) {\n        if (A[i] == target) count++;\n    }\n'
    + '    printf("%d\\n", count);\n    return 0;\n}\n',

  'ar-insert':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int n, pos, value;\n    scanf("%d", &n);\n    int A[100];\n'
    + '    for (int i = 0; i < n; i++) scanf("%d", &A[i]);\n'
    + '    scanf("%d %d", &pos, &value);\n'
    + '    for (int i = n; i > pos; i--) A[i] = A[i - 1];\n'
    + '    A[pos] = value;\n    n++;\n'
    + '    for (int i = 0; i < n; i++) printf("%d ", A[i]);\n'
    + '    printf("\\n");\n    return 0;\n}\n',

  'ar-delete':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int n, pos;\n    scanf("%d", &n);\n    int A[100];\n'
    + '    for (int i = 0; i < n; i++) scanf("%d", &A[i]);\n'
    + '    scanf("%d", &pos);\n'
    + '    for (int i = pos; i < n - 1; i++) A[i] = A[i + 1];\n'
    + '    n--;\n'
    + '    for (int i = 0; i < n; i++) printf("%d ", A[i]);\n'
    + '    printf("\\n");\n    return 0;\n}\n',

  'ar-delete-value':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int n, target;\n    scanf("%d", &n);\n    int A[100];\n'
    + '    for (int i = 0; i < n; i++) scanf("%d", &A[i]);\n'
    + '    scanf("%d", &target);\n'
    + '    int out = 0;\n'
    + '    for (int i = 0; i < n; i++) {\n'
    + '        if (A[i] != target) {\n            A[out] = A[i];\n            out++;\n        }\n    }\n'
    + '    for (int i = 0; i < out; i++) printf("%d ", A[i]);\n'
    + '    printf("\\n");\n    return 0;\n}\n',

  'ar-reverse-place':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int n;\n    scanf("%d", &n);\n    int A[100];\n'
    + '    for (int i = 0; i < n; i++) scanf("%d", &A[i]);\n'
    + '    int i = 0, j = n - 1;\n'
    + '    while (i < j) {\n'
    + '        int temp = A[i];\n        A[i] = A[j];\n        A[j] = temp;\n'
    + '        i++;\n        j--;\n    }\n'
    + '    for (int k = 0; k < n; k++) printf("%d ", A[k]);\n'
    + '    printf("\\n");\n    return 0;\n}\n',

  'ar-rotate':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int n;\n    scanf("%d", &n);\n    int A[100];\n'
    + '    for (int i = 0; i < n; i++) scanf("%d", &A[i]);\n'
    + '    int first = A[0];\n'
    + '    for (int i = 0; i < n - 1; i++) A[i] = A[i + 1];\n'
    + '    A[n - 1] = first;\n'
    + '    for (int i = 0; i < n; i++) printf("%d ", A[i]);\n'
    + '    printf("\\n");\n    return 0;\n}\n',

  /* ── D · Grids ──────────────────────────────────────────── */

  'ar-2d-print':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int rows, cols;\n    scanf("%d %d", &rows, &cols);\n    int G[20][20];\n'
    + '    for (int r = 0; r < rows; r++)\n'
    + '        for (int c = 0; c < cols; c++) scanf("%d", &G[r][c]);\n'
    + '    for (int r = 0; r < rows; r++) {\n'
    + '        for (int c = 0; c < cols; c++) printf("%d ", G[r][c]);\n'
    + '        printf("\\n");\n    }\n'
    + '    return 0;\n}\n',

  'ar-2d-rowsum':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int rows, cols;\n    scanf("%d %d", &rows, &cols);\n    int G[20][20];\n'
    + '    for (int r = 0; r < rows; r++)\n'
    + '        for (int c = 0; c < cols; c++) scanf("%d", &G[r][c]);\n'
    + '    for (int r = 0; r < rows; r++) {\n'
    + '        int sum = 0;\n'
    + '        for (int c = 0; c < cols; c++) sum += G[r][c];\n'
    + '        printf("%d\\n", sum);\n    }\n'
    + '    return 0;\n}\n',

  'ar-2d-colsum':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int rows, cols;\n    scanf("%d %d", &rows, &cols);\n    int G[20][20];\n'
    + '    for (int r = 0; r < rows; r++)\n'
    + '        for (int c = 0; c < cols; c++) scanf("%d", &G[r][c]);\n'
    + '    for (int c = 0; c < cols; c++) {\n'
    + '        int sum = 0;\n'
    + '        for (int r = 0; r < rows; r++) sum += G[r][c];\n'
    + '        printf("%d\\n", sum);\n    }\n'
    + '    return 0;\n}\n',

  'ar-2d-max':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int rows, cols;\n    scanf("%d %d", &rows, &cols);\n    int G[20][20];\n'
    + '    for (int r = 0; r < rows; r++)\n'
    + '        for (int c = 0; c < cols; c++) scanf("%d", &G[r][c]);\n'
    + '    int best = G[0][0], br = 0, bc = 0;\n'
    + '    for (int r = 0; r < rows; r++) {\n'
    + '        for (int c = 0; c < cols; c++) {\n'
    + '            if (G[r][c] > best) {\n'
    + '                best = G[r][c];\n                br = r;\n                bc = c;\n'
    + '            }\n        }\n    }\n'
    + '    printf("%d at %d %d\\n", best, br, bc);\n'
    + '    return 0;\n}\n'
};
