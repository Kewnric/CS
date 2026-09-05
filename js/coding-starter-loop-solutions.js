/* ============================================================
   CODING-STARTER-LOOP-SOLUTIONS.JS — references for loops and patterns
   ------------------------------------------------------------
   Compiled and run against their own tests by tools/verify-pack.js.

   The pattern references all share one shape: the outer loop is the ROW, the
   inner loops are what goes on it. Written that way on purpose -- a student
   who sees the same skeleton five times can start predicting it, which is the
   point of doing five of them.
   ============================================================ */

const CS_LOOP_SOLUTIONS = {

  /* ── A · Repeating ──────────────────────────────────────── */

  'lp-count-up':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int n;\n    scanf("%d", &n);\n    int i = 1;\n'
    + '    while (i <= n) {\n        printf("%d\\n", i);\n        i++;\n    }\n'
    + '    return 0;\n}\n',

  'lp-count-down-for':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int n;\n    scanf("%d", &n);\n'
    + '    for (int i = n; i >= 1; i--) {\n        printf("%d\\n", i);\n    }\n'
    + '    return 0;\n}\n',

  'lp-sum-n':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int n, sum = 0;\n    scanf("%d", &n);\n'
    + '    for (int i = 1; i <= n; i++) sum += i;\n'
    + '    printf("%d\\n", sum);\n    return 0;\n}\n',

  'lp-dowhile':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int n, count = 0;\n    scanf("%d", &n);\n    int i = 1;\n'
    + '    do {\n        printf("%d\\n", i);\n        count++;\n        i++;\n'
    + '    } while (i <= n);\n'
    + '    printf("ran %d times\\n", count);\n    return 0;\n}\n',

  'lp-skip-multiples':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int n;\n    scanf("%d", &n);\n'
    + '    for (int i = 1; i <= n; i++) {\n'
    + '        if (i % 3 == 0) continue;\n'
    + '        printf("%d ", i);\n    }\n'
    + '    printf("\\n");\n    return 0;\n}\n',

  'lp-stop-early':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int n, target;\n    scanf("%d %d", &n, &target);\n'
    + '    for (int i = 1; i <= n; i++) {\n'
    + '        if (i == target) {\n            printf("stopped at %d\\n", i);\n            break;\n        }\n'
    + '        printf("%d\\n", i);\n    }\n'
    + '    return 0;\n}\n',

  /* ── B · Patterns ───────────────────────────────────────── */

  'lp-stars-line':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int n;\n    scanf("%d", &n);\n'
    + '    for (int i = 0; i < n; i++) printf("*");\n'
    + '    printf("\\n");\n    return 0;\n}\n',

  'lp-half-pyramid':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int n;\n    scanf("%d", &n);\n'
    + '    for (int row = 1; row <= n; row++) {\n'
    + '        for (int s = 1; s <= row; s++) printf("*");\n'
    + '        printf("\\n");\n    }\n'
    + '    return 0;\n}\n',

  'lp-half-pyramid-inv':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int n;\n    scanf("%d", &n);\n'
    + '    for (int row = n; row >= 1; row--) {\n'
    + '        for (int s = 1; s <= row; s++) printf("*");\n'
    + '        printf("\\n");\n    }\n'
    + '    return 0;\n}\n',

  'lp-number-triangle':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int n;\n    scanf("%d", &n);\n'
    + '    for (int row = 1; row <= n; row++) {\n'
    + '        for (int c = 1; c <= row; c++) printf("%d", c);\n'
    + '        printf("\\n");\n    }\n'
    + '    return 0;\n}\n',

  'lp-pyramid':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int n;\n    scanf("%d", &n);\n'
    + '    for (int row = 1; row <= n; row++) {\n'
    + '        for (int sp = 1; sp <= n - row; sp++) printf(" ");\n'
    + '        for (int s = 1; s <= 2 * row - 1; s++) printf("*");\n'
    + '        printf("\\n");\n    }\n'
    + '    return 0;\n}\n',

  'lp-pyramid-inv':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int n;\n    scanf("%d", &n);\n'
    + '    for (int row = n; row >= 1; row--) {\n'
    + '        for (int sp = 1; sp <= n - row; sp++) printf(" ");\n'
    + '        for (int s = 1; s <= 2 * row - 1; s++) printf("*");\n'
    + '        printf("\\n");\n    }\n'
    + '    return 0;\n}\n',

  'lp-diamond':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int n;\n    scanf("%d", &n);\n'
    + '    for (int row = 1; row <= n; row++) {\n'
    + '        for (int sp = 1; sp <= n - row; sp++) printf(" ");\n'
    + '        for (int s = 1; s <= 2 * row - 1; s++) printf("*");\n'
    + '        printf("\\n");\n    }\n'
    + '    for (int row = n - 1; row >= 1; row--) {\n'
    + '        for (int sp = 1; sp <= n - row; sp++) printf(" ");\n'
    + '        for (int s = 1; s <= 2 * row - 1; s++) printf("*");\n'
    + '        printf("\\n");\n    }\n'
    + '    return 0;\n}\n',

  'lp-square':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int n;\n    scanf("%d", &n);\n'
    + '    for (int row = 1; row <= n; row++) {\n'
    + '        for (int c = 1; c <= n; c++) {\n'
    + '            if (row == 1 || row == n || c == 1 || c == n) printf("*");\n'
    + '            else printf(" ");\n'
    + '        }\n        printf("\\n");\n    }\n'
    + '    return 0;\n}\n',

  'lp-times-grid':
    '#include <stdio.h>\n\nint main(void) {\n'
    + '    int n;\n    scanf("%d", &n);\n'
    + '    for (int r = 1; r <= n; r++) {\n'
    + '        for (int c = 1; c <= n; c++) printf("%d ", r * c);\n'
    + '        printf("\\n");\n    }\n'
    + '    return 0;\n}\n'
};
