/* ============================================================
   CODING-STARTER-ADVANCED-SOLUTIONS.JS — references for folders 9-12
   ------------------------------------------------------------
   Same contract as coding-starter-solutions.js: this is what the boss bar
   measures against and what Check Code grades by, and every one of them has
   been compiled with gcc and run against every test of its own program by
   tools/verify-pack.js.

   Written plainly on purpose. Similarity is measured against this text, so a
   clever one-liner would punish the straightforward solution a learner is
   actually going to write. Where a program has a minimum requirement, the
   reference satisfies it the obvious way -- the recursive ones really recurse.
   ============================================================ */

const CS_ADV_SOLUTIONS = {

  /* ── 9 · Strings ────────────────────────────────────────── */

  'str-length':
    '#include <stdio.h>\n\nint main(void) {\n    char word[256];\n    int length = 0;\n\n'
    + '    printf("Enter a word: ");\n    scanf("%255s", word);\n\n'
    + '    while (word[length] != \'\\0\') {\n        length++;\n    }\n\n'
    + '    printf("Length: %d\\n", length);\n    return 0;\n}\n',

  'str-reverse':
    '#include <stdio.h>\n\nint main(void) {\n    char word[256];\n    int length = 0, i;\n\n'
    + '    printf("Enter a word: ");\n    scanf("%255s", word);\n\n'
    + '    while (word[length] != \'\\0\') {\n        length++;\n    }\n\n'
    + '    printf("Reversed: ");\n'
    + '    for (i = length - 1; i >= 0; i--) {\n        printf("%c", word[i]);\n    }\n'
    + '    printf("\\n");\n    return 0;\n}\n',

  'str-vowels':
    '#include <stdio.h>\n\nint main(void) {\n    char word[256];\n    int i, count = 0;\n\n'
    + '    printf("Enter a word: ");\n    scanf("%255s", word);\n\n'
    + '    for (i = 0; word[i] != \'\\0\'; i++) {\n'
    + '        char c = word[i];\n'
    + '        if (c >= \'A\' && c <= \'Z\') {\n            c = c + 32;\n        }\n'
    + '        if (c == \'a\' || c == \'e\' || c == \'i\' || c == \'o\' || c == \'u\') {\n'
    + '            count++;\n        }\n    }\n\n'
    + '    printf("Vowels: %d\\n", count);\n    return 0;\n}\n',

  'str-palindrome':
    '#include <stdio.h>\n\nint main(void) {\n    char word[256];\n'
    + '    int length = 0, left, right, ok = 1;\n\n'
    + '    printf("Enter a word: ");\n    scanf("%255s", word);\n\n'
    + '    while (word[length] != \'\\0\') {\n        length++;\n    }\n\n'
    + '    left = 0;\n    right = length - 1;\n'
    + '    while (left < right) {\n'
    + '        if (word[left] != word[right]) {\n            ok = 0;\n            break;\n        }\n'
    + '        left++;\n        right--;\n    }\n\n'
    + '    if (ok) {\n        printf("Palindrome\\n");\n'
    + '    } else {\n        printf("Not a palindrome\\n");\n    }\n'
    + '    return 0;\n}\n',

  'str-wordcount':
    '#include <stdio.h>\n\nint main(void) {\n    char line[1024];\n    int i, words = 0, inWord = 0;\n\n'
    + '    printf("Enter a line: ");\n    if (fgets(line, sizeof(line), stdin) == NULL) {\n'
    + '        line[0] = \'\\0\';\n    }\n\n'
    + '    for (i = 0; line[i] != \'\\0\'; i++) {\n'
    + '        char c = line[i];\n'
    + '        if (c == \' \' || c == \'\\t\' || c == \'\\n\') {\n            inWord = 0;\n'
    + '        } else if (!inWord) {\n            inWord = 1;\n            words++;\n        }\n    }\n\n'
    + '    printf("Words: %d\\n", words);\n    return 0;\n}\n',

  /* ── 10 · Functions and recursion ───────────────────────── */

  'rec-factorial':
    '#include <stdio.h>\n\nlong long factorial(int n)\n{\n'
    + '    if (n <= 0) {\n        return 1;\n    }\n'
    + '    return (long long) n * factorial(n - 1);\n}\n\n'
    + 'int main(void) {\n    int n;\n\n'
    + '    printf("Enter a number: ");\n    scanf("%d", &n);\n\n'
    + '    printf("Factorial: %lld\\n", factorial(n));\n    return 0;\n}\n',

  'rec-fib':
    '#include <stdio.h>\n\nlong long fib(int n)\n{\n'
    + '    if (n <= 0) {\n        return 0;\n    }\n'
    + '    if (n == 1) {\n        return 1;\n    }\n'
    + '    return fib(n - 1) + fib(n - 2);\n}\n\n'
    + 'int main(void) {\n    int n;\n\n'
    + '    printf("Enter a number: ");\n    scanf("%d", &n);\n\n'
    + '    printf("Fibonacci: %lld\\n", fib(n));\n    return 0;\n}\n',

  'rec-power':
    '#include <stdio.h>\n\nlong long power(int base, int exponent)\n{\n'
    + '    if (exponent <= 0) {\n        return 1;\n    }\n'
    + '    return (long long) base * power(base, exponent - 1);\n}\n\n'
    + 'int main(void) {\n    int base, exponent;\n\n'
    + '    printf("Enter the base: ");\n    scanf("%d", &base);\n\n'
    + '    printf("Enter the exponent: ");\n    scanf("%d", &exponent);\n\n'
    + '    printf("Result: %lld\\n", power(base, exponent));\n    return 0;\n}\n',

  'rec-gcd':
    '#include <stdio.h>\n\nint gcd(int a, int b)\n{\n'
    + '    if (b == 0) {\n        return a;\n    }\n'
    + '    return gcd(b, a % b);\n}\n\n'
    + 'int main(void) {\n    int a, b;\n\n'
    + '    printf("Enter the first number: ");\n    scanf("%d", &a);\n\n'
    + '    printf("Enter the second number: ");\n    scanf("%d", &b);\n\n'
    + '    printf("GCD: %d\\n", gcd(a, b));\n    return 0;\n}\n',

  'fn-swap-ref':
    '#include <stdio.h>\n\nvoid swap(int *a, int *b)\n{\n    int temp = *a;\n'
    + '    *a = *b;\n    *b = temp;\n}\n\n'
    + 'int main(void) {\n    int a, b;\n\n'
    + '    printf("Enter the first number: ");\n    scanf("%d", &a);\n\n'
    + '    printf("Enter the second number: ");\n    scanf("%d", &b);\n\n'
    + '    swap(&a, &b);\n\n'
    + '    printf("Swapped: %d %d\\n", a, b);\n    return 0;\n}\n',

  /* ── 11 · Grids ─────────────────────────────────────────── */

  'grid-print':
    '#include <stdio.h>\n\nint main(void) {\n    int grid[50][50];\n    int rows, cols, i, j;\n\n'
    + '    printf("Enter rows: ");\n    scanf("%d", &rows);\n\n'
    + '    printf("Enter columns: ");\n    scanf("%d", &cols);\n\n'
    + '    printf("Enter the values: ");\n'
    + '    for (i = 0; i < rows; i++) {\n        for (j = 0; j < cols; j++) {\n'
    + '            scanf("%d", &grid[i][j]);\n        }\n    }\n\n'
    + '    for (i = 0; i < rows; i++) {\n        for (j = 0; j < cols; j++) {\n'
    + '            if (j > 0) {\n                printf(" ");\n            }\n'
    + '            printf("%d", grid[i][j]);\n        }\n        printf("\\n");\n    }\n'
    + '    return 0;\n}\n',

  'grid-rowsums':
    '#include <stdio.h>\n\nint main(void) {\n    int grid[50][50];\n    int rows, cols, i, j, total;\n\n'
    + '    printf("Enter rows: ");\n    scanf("%d", &rows);\n\n'
    + '    printf("Enter columns: ");\n    scanf("%d", &cols);\n\n'
    + '    printf("Enter the values: ");\n'
    + '    for (i = 0; i < rows; i++) {\n        for (j = 0; j < cols; j++) {\n'
    + '            scanf("%d", &grid[i][j]);\n        }\n    }\n\n'
    + '    for (i = 0; i < rows; i++) {\n        total = 0;\n'
    + '        for (j = 0; j < cols; j++) {\n            total += grid[i][j];\n        }\n'
    + '        printf("Row %d: %d\\n", i, total);\n    }\n'
    + '    return 0;\n}\n',

  'grid-transpose':
    '#include <stdio.h>\n\nint main(void) {\n    int grid[50][50];\n    int rows, cols, i, j;\n\n'
    + '    printf("Enter rows: ");\n    scanf("%d", &rows);\n\n'
    + '    printf("Enter columns: ");\n    scanf("%d", &cols);\n\n'
    + '    printf("Enter the values: ");\n'
    + '    for (i = 0; i < rows; i++) {\n        for (j = 0; j < cols; j++) {\n'
    + '            scanf("%d", &grid[i][j]);\n        }\n    }\n\n'
    + '    for (j = 0; j < cols; j++) {\n        for (i = 0; i < rows; i++) {\n'
    + '            if (i > 0) {\n                printf(" ");\n            }\n'
    + '            printf("%d", grid[i][j]);\n        }\n        printf("\\n");\n    }\n'
    + '    return 0;\n}\n',

  'grid-diagonal':
    '#include <stdio.h>\n\nint main(void) {\n    int grid[50][50];\n    int size, i, j, total = 0;\n\n'
    + '    printf("Enter size: ");\n    scanf("%d", &size);\n\n'
    + '    printf("Enter the values: ");\n'
    + '    for (i = 0; i < size; i++) {\n        for (j = 0; j < size; j++) {\n'
    + '            scanf("%d", &grid[i][j]);\n        }\n    }\n\n'
    + '    for (i = 0; i < size; i++) {\n        total += grid[i][i];\n    }\n\n'
    + '    printf("Diagonal: %d\\n", total);\n    return 0;\n}\n',

  /* ── 12 · Files ─────────────────────────────────────────── */

  'file-write-read':
    '#include <stdio.h>\n\nint main(void) {\n    int value, readBack = 0;\n    FILE *f;\n\n'
    + '    printf("Enter a number: ");\n    scanf("%d", &value);\n\n'
    + '    f = fopen("data.txt", "w");\n'
    + '    if (f == NULL) {\n        printf("Could not open the file\\n");\n        return 1;\n    }\n'
    + '    fprintf(f, "%d\\n", value);\n    fclose(f);\n\n'
    + '    f = fopen("data.txt", "r");\n'
    + '    if (f == NULL) {\n        printf("Could not open the file\\n");\n        return 1;\n    }\n'
    + '    fscanf(f, "%d", &readBack);\n    fclose(f);\n\n'
    + '    remove("data.txt");\n\n'
    + '    printf("Read back: %d\\n", readBack);\n    return 0;\n}\n',

  'file-lines':
    '#include <stdio.h>\n\nint main(void) {\n    int n, i, value;\n    int lines = 0, total = 0;\n    FILE *f;\n\n'
    + '    printf("Enter how many: ");\n    scanf("%d", &n);\n\n'
    + '    printf("Enter the numbers: ");\n'
    + '    f = fopen("nums.txt", "w");\n'
    + '    if (f == NULL) {\n        printf("Could not open the file\\n");\n        return 1;\n    }\n'
    + '    for (i = 0; i < n; i++) {\n        scanf("%d", &value);\n'
    + '        fprintf(f, "%d\\n", value);\n    }\n    fclose(f);\n\n'
    + '    f = fopen("nums.txt", "r");\n'
    + '    if (f == NULL) {\n        printf("Could not open the file\\n");\n        return 1;\n    }\n'
    + '    while (fscanf(f, "%d", &value) == 1) {\n        lines++;\n        total += value;\n    }\n'
    + '    fclose(f);\n\n    remove("nums.txt");\n\n'
    + '    printf("Lines: %d\\n", lines);\n    printf("Total: %d\\n", total);\n    return 0;\n}\n',

  'file-structs':
    '#include <stdio.h>\n\ntypedef struct {\n    int id;\n    int year;\n} Student;\n\n'
    + 'int main(void) {\n    Student list[100];\n    Student back[100];\n'
    + '    int n, i, got;\n    FILE *f;\n\n'
    + '    printf("Enter how many: ");\n    scanf("%d", &n);\n\n'
    + '    printf("Enter the records: ");\n'
    + '    for (i = 0; i < n; i++) {\n'
    + '        scanf("%d %d", &list[i].id, &list[i].year);\n    }\n\n'
    + '    f = fopen("students.dat", "wb");\n'
    + '    if (f == NULL) {\n        printf("Could not open the file\\n");\n        return 1;\n    }\n'
    + '    fwrite(list, sizeof(Student), n, f);\n    fclose(f);\n\n'
    + '    f = fopen("students.dat", "rb");\n'
    + '    if (f == NULL) {\n        printf("Could not open the file\\n");\n        return 1;\n    }\n'
    + '    got = fread(back, sizeof(Student), n, f);\n    fclose(f);\n\n'
    + '    remove("students.dat");\n\n'
    + '    for (i = 0; i < got; i++) {\n'
    + '        printf("ID %d year %d\\n", back[i].id, back[i].year);\n    }\n'
    + '    return 0;\n}\n',

  'file-seek':
    '#include <stdio.h>\n\nint main(void) {\n    int n, i, index, value;\n    FILE *f;\n\n'
    + '    printf("Enter how many: ");\n    scanf("%d", &n);\n\n'
    + '    printf("Enter the numbers: ");\n'
    + '    f = fopen("seek.dat", "wb");\n'
    + '    if (f == NULL) {\n        printf("Could not open the file\\n");\n        return 1;\n    }\n'
    + '    for (i = 0; i < n; i++) {\n        scanf("%d", &value);\n'
    + '        fwrite(&value, sizeof(int), 1, f);\n    }\n    fclose(f);\n\n'
    + '    printf("Enter an index: ");\n    scanf("%d", &index);\n\n'
    + '    if (index < 0 || index >= n) {\n        remove("seek.dat");\n'
    + '        printf("Out of range\\n");\n        return 0;\n    }\n\n'
    + '    f = fopen("seek.dat", "rb");\n'
    + '    if (f == NULL) {\n        printf("Could not open the file\\n");\n        return 1;\n    }\n'
    + '    fseek(f, index * sizeof(int), SEEK_SET);\n'
    + '    fread(&value, sizeof(int), 1, f);\n    fclose(f);\n\n'
    + '    remove("seek.dat");\n\n'
    + '    printf("Value: %d\\n", value);\n    return 0;\n}\n'
};
