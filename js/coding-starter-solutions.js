/* ============================================================
   CODING-STARTER-SOLUTIONS.JS — the reference each program is marked against
   ------------------------------------------------------------
   The boss bar measures how close what you have written is to the reference,
   and Check Code grades against it. Both were broken for this pack: every
   program shipped with the same empty main() as BOTH its starter code and its
   reference, so on load the editor already matched the target exactly and the
   bar arrived at zero HP before a key was pressed.

   So the reference is the finished program, and the starter code is nothing at
   all -- an empty editor, which is what was asked for and is also the only
   honest starting point when the bar is measuring distance from the answer.

   EVERY ONE OF THESE WAS COMPILED AND RUN against every test of its program
   before being put here. That is not a formality: a reference that does not
   pass its own tests marks correct work wrong, and it would do it quietly.

   They are written plainly on purpose -- ordinary loops, obvious names, no
   tricks. Similarity is measured against this text, so a clever one-liner
   would punish the straightforward solution a learner is going to write.
   ============================================================ */

const CS_SOLUTIONS = {

  /* ── 1 · Printing and reading ─────────────────────────────── */

  'hello':
    '#include <stdio.h>\n\nint main(void) {\n    printf("Hello, World!\\n");\n    return 0;\n}\n',

  'echo-number':
    '#include <stdio.h>\n\nint main(void) {\n    int n;\n    scanf("%d", &n);\n'
    + '    printf("%d\\n", n);\n    return 0;\n}\n',

  'add-two':
    '#include <stdio.h>\n\nint main(void) {\n    int a, b;\n    scanf("%d %d", &a, &b);\n'
    + '    printf("%d\\n", a + b);\n    return 0;\n}\n',

  /* ── 2 · Making decisions ─────────────────────────────────── */

  'odd-even':
    '#include <stdio.h>\n\nint main(void) {\n    int n;\n    scanf("%d", &n);\n'
    + '    if (n % 2 == 0) {\n        printf("Even\\n");\n    } else {\n'
    + '        printf("Odd\\n");\n    }\n    return 0;\n}\n',

  'largest':
    '#include <stdio.h>\n\nint main(void) {\n    int a, b, c, largest;\n'
    + '    scanf("%d %d %d", &a, &b, &c);\n    largest = a;\n'
    + '    if (b > largest) {\n        largest = b;\n    }\n'
    + '    if (c > largest) {\n        largest = c;\n    }\n'
    + '    printf("%d\\n", largest);\n    return 0;\n}\n',

  'grade':
    '#include <stdio.h>\n\nint main(void) {\n    int score;\n    char grade;\n'
    + '    scanf("%d", &score);\n'
    + '    if (score >= 90) {\n        grade = \'A\';\n'
    + '    } else if (score >= 80) {\n        grade = \'B\';\n'
    + '    } else if (score >= 70) {\n        grade = \'C\';\n'
    + '    } else if (score >= 60) {\n        grade = \'D\';\n'
    + '    } else {\n        grade = \'F\';\n    }\n'
    + '    printf("%c\\n", grade);\n    return 0;\n}\n',

  /* ── 3 · Repeating work ───────────────────────────────────── */

  'countdown':
    '#include <stdio.h>\n\nint main(void) {\n    int n, i;\n    scanf("%d", &n);\n'
    + '    for (i = n; i >= 1; i--) {\n        printf("%d\\n", i);\n    }\n'
    + '    return 0;\n}\n',

  'sum-to-n':
    '#include <stdio.h>\n\nint main(void) {\n    int n, i, total = 0;\n    scanf("%d", &n);\n'
    + '    for (i = 1; i <= n; i++) {\n        total += i;\n    }\n'
    + '    printf("%d\\n", total);\n    return 0;\n}\n',

  'times-table':
    '#include <stdio.h>\n\nint main(void) {\n    int n, i;\n    scanf("%d", &n);\n'
    + '    for (i = 1; i <= 10; i++) {\n        printf("%d x %d = %d\\n", n, i, n * i);\n    }\n'
    + '    return 0;\n}\n',

  /* ── 4 · Arrays ───────────────────────────────────────────── */

  'arr-sum':
    '#include <stdio.h>\n\nint total(int A[], int size)\n{\n    int sum = 0, i;\n'
    + '    for (i = 0; i < size; i++) {\n        sum += A[i];\n    }\n    return sum;\n}\n\n'
    + 'int main(void) {\n    int n, i;\n    int A[100];\n    scanf("%d", &n);\n'
    + '    for (i = 0; i < n; i++) {\n        scanf("%d", &A[i]);\n    }\n'
    + '    printf("%d\\n", total(A, n));\n    return 0;\n}\n',

  'arr-largest':
    '#include <stdio.h>\n\nint largest(int A[], int size)\n{\n    int best = A[0], i;\n'
    + '    for (i = 1; i < size; i++) {\n        if (A[i] > best) {\n            best = A[i];\n'
    + '        }\n    }\n    return best;\n}\n\n'
    + 'int main(void) {\n    int n, i;\n    int A[100];\n    scanf("%d", &n);\n'
    + '    for (i = 0; i < n; i++) {\n        scanf("%d", &A[i]);\n    }\n'
    + '    printf("%d\\n", largest(A, n));\n    return 0;\n}\n',

  'arr-sentinel':
    '#include <stdio.h>\n\nvoid printArr(int A[])\n{\n    int i;\n'
    + '    for (i = 0; A[i] != -1; i++) {\n        printf("Array[%d]: %d\\n", i, A[i]);\n    }\n}\n\n'
    + 'int main(void) {\n    int A[200];\n    int i = 0, value;\n'
    + '    while (scanf("%d", &value) == 1) {\n        A[i] = value;\n'
    + '        if (value == -1) {\n            break;\n        }\n        i++;\n    }\n'
    + '    A[i] = -1;\n    printArr(A);\n    return 0;\n}\n',

  /* ── 5 · Pointers ─────────────────────────────────────────── */

  'ptr-swap':
    '#include <stdio.h>\n\nvoid swap(int* a, int* b)\n{\n    int temp = *a;\n'
    + '    *a = *b;\n    *b = temp;\n}\n\n'
    + 'int main(void) {\n    int a, b;\n    scanf("%d %d", &a, &b);\n    swap(&a, &b);\n'
    + '    printf("%d %d\\n", a, b);\n    return 0;\n}\n',

  'ptr-reverse':
    '#include <stdio.h>\n\nint main(void) {\n    int n, i;\n    int A[100];\n'
    + '    int* p;\n    scanf("%d", &n);\n'
    + '    for (i = 0; i < n; i++) {\n        scanf("%d", &A[i]);\n    }\n'
    + '    for (p = A + n - 1; p >= A; p--) {\n'
    + '        if (p != A + n - 1) {\n            printf(" ");\n        }\n'
    + '        printf("%d", *p);\n    }\n'
    + '    if (n > 0) {\n        printf("\\n");\n    }\n    return 0;\n}\n',

  'ptr-minmax':
    '#include <stdio.h>\n\nvoid minMax(int A[], int size, int* min, int* max)\n{\n    int i;\n'
    + '    *min = A[0];\n    *max = A[0];\n'
    + '    for (i = 1; i < size; i++) {\n'
    + '        if (A[i] < *min) {\n            *min = A[i];\n        }\n'
    + '        if (A[i] > *max) {\n            *max = A[i];\n        }\n    }\n}\n\n'
    + 'int main(void) {\n    int n, i, low, high;\n    int A[100];\n    scanf("%d", &n);\n'
    + '    for (i = 0; i < n; i++) {\n        scanf("%d", &A[i]);\n    }\n'
    + '    minMax(A, n, &low, &high);\n    printf("%d %d\\n", low, high);\n    return 0;\n}\n',

  /* ── 6 · Memory you ask for ───────────────────────────────── */

  'mem-fill':
    '#include <stdio.h>\n#include <stdlib.h>\n\nint main(void) {\n    int n, i;\n    int* A;\n'
    + '    scanf("%d", &n);\n    if (n < 1) {\n        return 0;\n    }\n'
    + '    A = malloc(sizeof(int) * n);\n    if (A == NULL) {\n        return 1;\n    }\n'
    + '    for (i = 0; i < n; i++) {\n        A[i] = (i + 1) * (i + 1);\n    }\n'
    + '    for (i = 0; i < n; i++) {\n        if (i > 0) {\n            printf(" ");\n        }\n'
    + '        printf("%d", A[i]);\n    }\n    printf("\\n");\n    free(A);\n    return 0;\n}\n',

  'mem-return':
    '#include <stdio.h>\n#include <stdlib.h>\n\nvoid printArr(int A[])\n{\n    int i;\n'
    + '    if (A != NULL) {\n        for (i = 0; A[i] != -1; i++) {\n'
    + '            printf("Array[%d]: %d\\n", i, A[i]);\n        }\n    }\n}\n\n'
    + 'int* doubleAll(int A[], int size)\n{\n    int i;\n'
    + '    int* C = malloc(sizeof(int) * (size + 1));\n'
    + '    if (C == NULL) {\n        return NULL;\n    }\n'
    + '    for (i = 0; i < size; i++) {\n        C[i] = A[i] * 2;\n    }\n'
    + '    C[size] = -1;\n    return C;\n}\n\n'
    + 'int main(void) {\n    int n, i;\n    int A[100];\n    int* C;\n    scanf("%d", &n);\n'
    + '    for (i = 0; i < n; i++) {\n        scanf("%d", &A[i]);\n    }\n'
    + '    C = doubleAll(A, n);\n    printArr(C);\n    free(C);\n    return 0;\n}\n',

  'mem-multiples':
    '#include <stdio.h>\n#include <stdlib.h>\n\nvoid printArr(int A[])\n{\n    int i;\n'
    + '    if (A != NULL) {\n        for (i = 0; A[i] != -1; i++) {\n'
    + '            printf("Array[%d]: %d\\n", i, A[i]);\n        }\n    }\n}\n\n'
    + 'int* getAllMultiples(int A[], int sizeA, int mult)\n{\n'
    + '    int* arrayMults = NULL;\n    int count = 0;\n    int i, j = 0;\n\n'
    + '    for (i = 0; i < sizeA; i++) {\n        if (A[i] % mult == 0) {\n'
    + '            count++;\n        }\n    }\n\n'
    + '    if (count > 0) {\n        arrayMults = malloc(sizeof(int) * (count + 1));\n'
    + '        if (arrayMults != NULL) {\n'
    + '            for (i = 0; i < sizeA; i++) {\n                if (A[i] % mult == 0) {\n'
    + '                    arrayMults[j] = A[i];\n                    j++;\n                }\n            }\n'
    + '            arrayMults[j] = -1;\n        }\n    }\n    return arrayMults;\n}\n\n'
    + 'int main(void) {\n    int n, i, mult;\n    int A[100];\n    int* C;\n    scanf("%d", &n);\n'
    + '    for (i = 0; i < n; i++) {\n        scanf("%d", &A[i]);\n    }\n'
    + '    scanf("%d", &mult);\n    C = getAllMultiples(A, n, mult);\n'
    + '    printArr(C);\n    free(C);\n    return 0;\n}\n',

  'mem-pairs':
    '#include <stdio.h>\n#include <stdlib.h>\n\nvoid printArr(int A[])\n{\n    int i;\n'
    + '    if (A != NULL) {\n        for (i = 0; A[i] != -1; i++) {\n'
    + '            printf("Array[%d]: %d\\n", i, A[i]);\n        }\n    }\n}\n\n'
    + 'int* multiplyArrays(int A[], int sizeA, int B[], int sizeB)\n{\n'
    + '    int sizeC = sizeA * sizeB + 1;\n    int i, j, k = 0;\n'
    + '    int* C = malloc(sizeof(int) * sizeC);\n\n'
    + '    if (C == NULL) {\n        return NULL;\n    }\n'
    + '    for (i = 0; i < sizeA; i++) {\n        for (j = 0; j < sizeB; j++) {\n'
    + '            C[k] = A[i] * B[j];\n            k++;\n        }\n    }\n'
    + '    C[k] = -1;\n    return C;\n}\n\n'
    + 'int main(void) {\n    int sizeA, sizeB, i;\n    int A[50], B[50];\n    int* C;\n'
    + '    scanf("%d", &sizeA);\n'
    + '    for (i = 0; i < sizeA; i++) {\n        scanf("%d", &A[i]);\n    }\n'
    + '    scanf("%d", &sizeB);\n'
    + '    for (i = 0; i < sizeB; i++) {\n        scanf("%d", &B[i]);\n    }\n'
    + '    C = multiplyArrays(A, sizeA, B, sizeB);\n    printArr(C);\n    free(C);\n'
    + '    return 0;\n}\n',

  /* ── 7 · Structs and a bag ────────────────────────────────── */

  'struct-one':
    '#include <stdio.h>\n\ntypedef struct {\n    char name[20];\n    int level;\n} Pokemon;\n\n'
    + 'int main(void) {\n    Pokemon p;\n    scanf("%19s %d", p.name, &p.level);\n'
    + '    printf("%s (Lv. %d)\\n", p.name, p.level);\n    return 0;\n}\n',

  'struct-team':
    '#include <stdio.h>\n\ntypedef struct {\n    char name[20];\n    int level;\n} Pokemon;\n\n'
    + 'int strongest(Pokemon team[], int size)\n{\n    int best = 0, i;\n'
    + '    for (i = 1; i < size; i++) {\n        if (team[i].level > team[best].level) {\n'
    + '            best = i;\n        }\n    }\n    return best;\n}\n\n'
    + 'int main(void) {\n    int n, i;\n    Pokemon team[100];\n    scanf("%d", &n);\n'
    + '    for (i = 0; i < n; i++) {\n        scanf("%19s %d", team[i].name, &team[i].level);\n    }\n'
    + '    printf("%s\\n", team[strongest(team, n)].name);\n    return 0;\n}\n',

  'poke-bag':
    '#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n\n'
    + 'typedef struct {\n    char name[20];\n    int qty;\n} Item;\n\n'
    + 'int findItem(Item* bag, int count, const char* name)\n{\n    int i;\n'
    + '    for (i = 0; i < count; i++) {\n        if (strcmp(bag[i].name, name) == 0) {\n'
    + '            return i;\n        }\n    }\n    return -1;\n}\n\n'
    + 'int main(void) {\n    Item* bag = NULL;\n    int count = 0, capacity = 0;\n'
    + '    char command[16], name[20];\n    int qty, at, i;\n\n'
    + '    while (scanf("%15s", command) == 1) {\n'
    + '        if (strcmp(command, "END") == 0) {\n            break;\n        }\n'
    + '        if (strcmp(command, "LIST") == 0) {\n'
    + '            if (count == 0) {\n                printf("Bag is empty\\n");\n'
    + '            } else {\n                for (i = 0; i < count; i++) {\n'
    + '                    printf("%s x%d\\n", bag[i].name, bag[i].qty);\n                }\n'
    + '            }\n            continue;\n        }\n'
    + '        if (scanf("%19s %d", name, &qty) != 2) {\n            break;\n        }\n\n'
    + '        if (strcmp(command, "ADD") == 0) {\n            at = findItem(bag, count, name);\n'
    + '            if (at >= 0) {\n                bag[at].qty += qty;\n            } else {\n'
    + '                if (count == capacity) {\n'
    + '                    Item* bigger;\n'
    + '                    capacity = (capacity == 0) ? 4 : capacity * 2;\n'
    + '                    bigger = realloc(bag, sizeof(Item) * capacity);\n'
    + '                    if (bigger == NULL) {\n                        free(bag);\n'
    + '                        return 1;\n                    }\n                    bag = bigger;\n'
    + '                }\n                strcpy(bag[count].name, name);\n'
    + '                bag[count].qty = qty;\n                count++;\n            }\n'
    + '        } else if (strcmp(command, "USE") == 0) {\n'
    + '            at = findItem(bag, count, name);\n'
    + '            if (at < 0 || bag[at].qty < qty) {\n'
    + '                printf("Not enough %s\\n", name);\n            } else {\n'
    + '                bag[at].qty -= qty;\n'
    + '                if (bag[at].qty == 0) {\n'
    + '                    for (i = at; i < count - 1; i++) {\n'
    + '                        bag[i] = bag[i + 1];\n                    }\n'
    + '                    count--;\n                }\n            }\n        }\n    }\n\n'
    + '    free(bag);\n    return 0;\n}\n'
};
