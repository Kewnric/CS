/* ============================================================
   TEMPLATES-STARTER.JS — the built-in templates
   ------------------------------------------------------------
   Common C shapes from the course: array walks, searches, sorts, strings,
   input loops, structs, malloc, linked lists, files, recursion. Each is a
   template (js/templates.js) whose names are slots, so the drill can ask for
   it again with different ones.

   EVERY HARNESS IS RUN. tools/verify-templates.js compiles each canonical
   form inside its harness with gcc and checks the output, and does the same
   for twenty variations of each, so a starter template never marks a correct
   answer wrong. Run it after changing anything here:
       node tools/verify-templates.js
   File templates have no harness (the online compiler has no disk to write
   to); they are marked on tokens alone.

   Built-ins are copied into state.templates the first time the Training hub
   opens (tplEnsureStarters), marked `builtin`, and can then be edited like
   your own; Reset in the admin puts one back as shipped.
   ============================================================ */

const TPL_IO = '#include <stdio.h>\n';
const TPL_IO_LIB = '#include <stdio.h>\n#include <stdlib.h>\n';
const TPL_IO_STR = '#include <stdio.h>\n#include <string.h>\n';

const TPL_STARTER = [
  {
    id: 'tpl-sum-array', title: 'Sum of an array', concepts: ['array', 'for', 'function'], tags: ['arrays'],
    label: 'Add up every element of an int array and return the total.',
    body: String.raw`int ⟦fn:sum_array⟧(const int ⟦arr:values⟧[], int ⟦n:count⟧) {
    int ⟦acc:total⟧ = 0;
    for (int i = 0; i < ⟦n:count⟧; i++) {
        ⟦acc:total⟧ += ⟦arr:values⟧[i];
    }
    return ⟦acc:total⟧;
}`,
    harness: { prelude: TPL_IO, code: String.raw`int main(void) {
    int data[] = {3, 5, 9, -2};
    printf("%d\n", ⟦fn⟧(data, 4));
    return 0;
}`, expect: '15\n' }
  },
  {
    id: 'tpl-max-array', title: 'Largest element', concepts: ['array', 'for', 'if', 'function'], tags: ['arrays'],
    label: 'Return the largest value in a non-empty int array.',
    body: String.raw`int ⟦fn:largest⟧(const int ⟦arr:values⟧[], int ⟦n:count⟧) {
    int ⟦best:best⟧ = ⟦arr:values⟧[0];
    for (int i = 1; i < ⟦n:count⟧; i++) {
        if (⟦arr:values⟧[i] > ⟦best:best⟧) {
            ⟦best:best⟧ = ⟦arr:values⟧[i];
        }
    }
    return ⟦best:best⟧;
}`,
    harness: { prelude: TPL_IO, code: String.raw`int main(void) {
    int data[] = {4, 17, -3, 9};
    printf("%d\n", ⟦fn⟧(data, 4));
    return 0;
}`, expect: '17\n' }
  },
  {
    id: 'tpl-linear-search', title: 'Linear search', concepts: ['array', 'for', 'if', 'function'], tags: ['arrays', 'searching'],
    label: 'Return the index of the first element equal to the target, or -1.',
    body: String.raw`int ⟦fn:find_index⟧(const int ⟦arr:values⟧[], int ⟦n:count⟧, int ⟦target:target⟧) {
    for (int i = 0; i < ⟦n:count⟧; i++) {
        if (⟦arr:values⟧[i] == ⟦target:target⟧) {
            return i;
        }
    }
    return -1;
}`,
    harness: { prelude: TPL_IO, code: String.raw`int main(void) {
    int data[] = {4, 7, 9, 1, 3};
    printf("%d\n", ⟦fn⟧(data, 5, 9));
    printf("%d\n", ⟦fn⟧(data, 5, 42));
    return 0;
}`, expect: '2\n-1\n' }
  },
  {
    id: 'tpl-binary-search', title: 'Binary search', concepts: ['array', 'while', 'ifelse', 'function'], tags: ['arrays', 'searching'],
    label: 'Find the target in a sorted int array by halving the range; return its index or -1.',
    body: String.raw`int ⟦fn:binary_search⟧(const int ⟦arr:sorted⟧[], int ⟦n:count⟧, int ⟦target:target⟧) {
    int lo = 0, hi = ⟦n:count⟧ - 1;
    while (lo <= hi) {
        int mid = lo + (hi - lo) / 2;
        if (⟦arr:sorted⟧[mid] == ⟦target:target⟧) {
            return mid;
        } else if (⟦arr:sorted⟧[mid] < ⟦target:target⟧) {
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }
    return -1;
}`,
    harness: { prelude: TPL_IO, code: String.raw`int main(void) {
    int data[] = {1, 3, 5, 7, 9, 11};
    printf("%d\n", ⟦fn⟧(data, 6, 7));
    printf("%d\n", ⟦fn⟧(data, 6, 4));
    return 0;
}`, expect: '3\n-1\n' }
  },
  {
    id: 'tpl-swap', title: 'Swap through pointers', concepts: ['pointer', 'function'], tags: ['pointers'],
    label: 'Exchange two ints through their addresses.',
    body: String.raw`void ⟦fn:swap⟧(int *⟦a:a⟧, int *⟦b:b⟧) {
    int tmp = *⟦a:a⟧;
    *⟦a:a⟧ = *⟦b:b⟧;
    *⟦b:b⟧ = tmp;
}`,
    harness: { prelude: TPL_IO, code: String.raw`int main(void) {
    int x = 1, y = 2;
    ⟦fn⟧(&x, &y);
    printf("%d %d\n", x, y);
    return 0;
}`, expect: '2 1\n' }
  },
  {
    id: 'tpl-bubble-sort', title: 'Bubble sort', concepts: ['array', 'nestedloop', 'if', 'function'], tags: ['arrays', 'sorting'],
    label: 'Sort an int array ascending by swapping neighbours that are out of order.',
    body: String.raw`void ⟦fn:bubble_sort⟧(int ⟦arr:values⟧[], int ⟦n:count⟧) {
    for (int pass = 0; pass < ⟦n:count⟧ - 1; pass++) {
        for (int i = 0; i < ⟦n:count⟧ - 1 - pass; i++) {
            if (⟦arr:values⟧[i] > ⟦arr:values⟧[i + 1]) {
                int tmp = ⟦arr:values⟧[i];
                ⟦arr:values⟧[i] = ⟦arr:values⟧[i + 1];
                ⟦arr:values⟧[i + 1] = tmp;
            }
        }
    }
}`,
    harness: { prelude: TPL_IO, code: String.raw`int main(void) {
    int data[] = {5, 2, 9, 1, 7};
    ⟦fn⟧(data, 5);
    for (int k = 0; k < 5; k++) printf("%d ", data[k]);
    printf("\n");
    return 0;
}`, expect: '1 2 5 7 9 \n' }
  },
  {
    id: 'tpl-selection-sort', title: 'Selection sort', concepts: ['array', 'nestedloop', 'if', 'function'], tags: ['arrays', 'sorting'],
    label: 'Sort ascending by moving the smallest remaining element to the front each pass.',
    body: String.raw`void ⟦fn:selection_sort⟧(int ⟦arr:values⟧[], int ⟦n:count⟧) {
    for (int i = 0; i < ⟦n:count⟧ - 1; i++) {
        int min = i;
        for (int j = i + 1; j < ⟦n:count⟧; j++) {
            if (⟦arr:values⟧[j] < ⟦arr:values⟧[min]) {
                min = j;
            }
        }
        int tmp = ⟦arr:values⟧[i];
        ⟦arr:values⟧[i] = ⟦arr:values⟧[min];
        ⟦arr:values⟧[min] = tmp;
    }
}`,
    harness: { prelude: TPL_IO, code: String.raw`int main(void) {
    int data[] = {8, 3, 6, 1, 4};
    ⟦fn⟧(data, 5);
    for (int k = 0; k < 5; k++) printf("%d ", data[k]);
    printf("\n");
    return 0;
}`, expect: '1 3 4 6 8 \n' }
  },
  {
    id: 'tpl-reverse-array', title: 'Reverse an array', concepts: ['array', 'for', 'function'], tags: ['arrays'],
    label: 'Reverse an int array in place with two indexes walking toward each other.',
    body: String.raw`void ⟦fn:reverse⟧(int ⟦arr:values⟧[], int ⟦n:count⟧) {
    for (int i = 0, j = ⟦n:count⟧ - 1; i < j; i++, j--) {
        int tmp = ⟦arr:values⟧[i];
        ⟦arr:values⟧[i] = ⟦arr:values⟧[j];
        ⟦arr:values⟧[j] = tmp;
    }
}`,
    harness: { prelude: TPL_IO, code: String.raw`int main(void) {
    int data[] = {1, 2, 3, 4};
    ⟦fn⟧(data, 4);
    for (int k = 0; k < 4; k++) printf("%d ", data[k]);
    printf("\n");
    return 0;
}`, expect: '4 3 2 1 \n' }
  },
  {
    id: 'tpl-count-even', title: 'Count matches', concepts: ['array', 'for', 'if', 'function'], tags: ['arrays'],
    label: 'Count the even numbers in an int array.',
    body: String.raw`int ⟦fn:count_even⟧(const int ⟦arr:values⟧[], int ⟦n:count⟧) {
    int ⟦hits:hits⟧ = 0;
    for (int i = 0; i < ⟦n:count⟧; i++) {
        if (⟦arr:values⟧[i] % 2 == 0) {
            ⟦hits:hits⟧++;
        }
    }
    return ⟦hits:hits⟧;
}`,
    harness: { prelude: TPL_IO, code: String.raw`int main(void) {
    int data[] = {2, 7, 4, 4, 9, 10};
    printf("%d\n", ⟦fn⟧(data, 6));
    return 0;
}`, expect: '4\n' }
  },
  {
    id: 'tpl-average', title: 'Average as a double', concepts: ['array', 'for', 'if', 'function'], tags: ['arrays'],
    label: 'Return the mean of an int array as a double, and 0 for an empty one.',
    body: String.raw`double ⟦fn:average⟧(const int ⟦arr:values⟧[], int ⟦n:count⟧) {
    if (⟦n:count⟧ == 0) {
        return 0.0;
    }
    int sum = 0;
    for (int i = 0; i < ⟦n:count⟧; i++) {
        sum += ⟦arr:values⟧[i];
    }
    return (double)sum / ⟦n:count⟧;
}`,
    harness: { prelude: TPL_IO, code: String.raw`int main(void) {
    int data[] = {1, 2, 4};
    printf("%.2f\n", ⟦fn⟧(data, 3));
    return 0;
}`, expect: '2.33\n' }
  },
  {
    id: 'tpl-strlen', title: 'String length by hand', concepts: ['while', 'function', 'array'], tags: ['strings'],
    label: 'Count the characters before the terminating \'\\0\'.',
    body: String.raw`int ⟦fn:my_strlen⟧(const char *⟦s:text⟧) {
    int len = 0;
    while (⟦s:text⟧[len] != '\0') {
        len++;
    }
    return len;
}`,
    harness: { prelude: TPL_IO, code: String.raw`int main(void) {
    int a = ⟦fn⟧("hello");
    int b = ⟦fn⟧("");
    printf("%d %d\n", a, b);
    return 0;
}`, expect: '5 0\n' }
  },
  {
    id: 'tpl-count-char', title: 'Count a character', concepts: ['for', 'if', 'function'], tags: ['strings'],
    label: 'Count how many times one character appears in a string.',
    body: String.raw`int ⟦fn:count_char⟧(const char *⟦s:text⟧, char ⟦c:wanted⟧) {
    int n = 0;
    for (int i = 0; ⟦s:text⟧[i] != '\0'; i++) {
        if (⟦s:text⟧[i] == ⟦c:wanted⟧) {
            n++;
        }
    }
    return n;
}`,
    harness: { prelude: TPL_IO, code: String.raw`int main(void) {
    printf("%d\n", ⟦fn⟧("banana", 'a'));
    return 0;
}`, expect: '3\n' }
  },
  {
    id: 'tpl-reverse-string', title: 'Reverse a string', concepts: ['while', 'function', 'array'], tags: ['strings'],
    label: 'Reverse a string in place, swapping from both ends toward the middle.',
    body: String.raw`void ⟦fn:reverse_string⟧(char *⟦s:text⟧) {
    int i = 0, j = (int)strlen(⟦s:text⟧) - 1;
    while (i < j) {
        char tmp = ⟦s:text⟧[i];
        ⟦s:text⟧[i] = ⟦s:text⟧[j];
        ⟦s:text⟧[j] = tmp;
        i++;
        j--;
    }
}`,
    harness: { prelude: TPL_IO_STR, code: String.raw`int main(void) {
    char word[] = "stressed";
    ⟦fn⟧(word);
    printf("%s\n", word);
    return 0;
}`, expect: 'desserts\n' }
  },
  {
    id: 'tpl-to-upper', title: 'Uppercase a string', concepts: ['for', 'function'], tags: ['strings'],
    label: 'Turn every letter of a string to upper case with toupper.',
    body: String.raw`void ⟦fn:to_upper⟧(char *⟦s:text⟧) {
    for (int i = 0; ⟦s:text⟧[i] != '\0'; i++) {
        ⟦s:text⟧[i] = (char)toupper((unsigned char)⟦s:text⟧[i]);
    }
}`,
    harness: { prelude: '#include <stdio.h>\n#include <ctype.h>\n', code: String.raw`int main(void) {
    char word[] = "Hello, C!";
    ⟦fn⟧(word);
    printf("%s\n", word);
    return 0;
}`, expect: 'HELLO, C!\n' }
  },
  {
    id: 'tpl-palindrome', title: 'Palindrome check', concepts: ['while', 'if', 'function'], tags: ['strings'],
    label: 'Return 1 when a string reads the same backwards, else 0.',
    body: String.raw`int ⟦fn:is_palindrome⟧(const char *⟦s:text⟧) {
    int i = 0, j = (int)strlen(⟦s:text⟧) - 1;
    while (i < j) {
        if (⟦s:text⟧[i] != ⟦s:text⟧[j]) {
            return 0;
        }
        i++;
        j--;
    }
    return 1;
}`,
    harness: { prelude: TPL_IO_STR, code: String.raw`int main(void) {
    int a = ⟦fn⟧("level");
    int b = ⟦fn⟧("lever");
    printf("%d %d\n", a, b);
    return 0;
}`, expect: '1 0\n' }
  },
  {
    id: 'tpl-read-positive', title: 'Read a positive number', concepts: ['scanf', 'while', 'printf', 'function'], tags: ['input'],
    label: 'Keep asking until scanf reads a positive int; throw away the rest of a bad line; -1 at end of input.',
    body: String.raw`int ⟦fn:read_positive⟧(void) {
    int ⟦value:value⟧;
    int got;
    while ((got = scanf("%d", &⟦value:value⟧)) != 1 || ⟦value:value⟧ <= 0) {
        if (got == EOF) {
            return -1;
        }
        int ch;
        while ((ch = getchar()) != '\n' && ch != EOF) {
        }
        printf("Try again: ");
    }
    return ⟦value:value⟧;
}`,
    harness: { prelude: TPL_IO, stdin: '-3\nabc\n7\n', code: String.raw`int main(void) {
    printf("Got %d\n", ⟦fn⟧());
    return 0;
}`, expect: 'Try again: Try again: Got 7\n' }
  },
  {
    id: 'tpl-menu-loop', title: 'Menu loop', concepts: ['dowhile', 'switch', 'scanf', 'printf'], tags: ['input'],
    label: 'Show a menu, read a choice and act on it with switch until the user picks 0.',
    body: String.raw`void ⟦fn:run_menu⟧(void) {
    int ⟦choice:choice⟧;
    do {
        printf("1) Hello  2) Bye  0) Quit\n");
        if (scanf("%d", &⟦choice:choice⟧) != 1) {
            break;
        }
        switch (⟦choice:choice⟧) {
            case 1:
                printf("Hello!\n");
                break;
            case 2:
                printf("Bye!\n");
                break;
            case 0:
                break;
            default:
                printf("No such option\n");
        }
    } while (⟦choice:choice⟧ != 0);
}`,
    harness: { prelude: TPL_IO, stdin: '1\n5\n0\n', code: String.raw`int main(void) {
    ⟦fn⟧();
    return 0;
}`, expect: '1) Hello  2) Bye  0) Quit\nHello!\n1) Hello  2) Bye  0) Quit\nNo such option\n1) Hello  2) Bye  0) Quit\n' }
  },
  {
    id: 'tpl-struct-print', title: 'A struct and a printer', concepts: ['pointer', 'function', 'printf'], tags: ['structs'],
    label: 'Define a struct with a name and a number, and print one through a pointer with ->.',
    body: String.raw`struct ⟦Type:Student⟧ {
    char name[32];
    int ⟦field:age⟧;
};

void ⟦fn:print_one⟧(const struct ⟦Type:Student⟧ *⟦p:s⟧) {
    printf("%s (%d)\n", ⟦p:s⟧->name, ⟦p:s⟧->⟦field:age⟧);
}`,
    harness: { prelude: TPL_IO, code: String.raw`int main(void) {
    struct ⟦Type⟧ one = {"Ana", 20};
    ⟦fn⟧(&one);
    return 0;
}`, expect: 'Ana (20)\n' }
  },
  {
    id: 'tpl-struct-max', title: 'Best in an array of structs', concepts: ['array', 'for', 'if', 'function'], tags: ['structs', 'arrays'],
    label: 'Return the index of the struct with the highest value in one field.',
    body: String.raw`int ⟦fn:index_of_max⟧(const struct ⟦Type:Student⟧ ⟦arr:list⟧[], int ⟦n:count⟧) {
    int best = 0;
    for (int i = 1; i < ⟦n:count⟧; i++) {
        if (⟦arr:list⟧[i].⟦field:score⟧ > ⟦arr:list⟧[best].⟦field:score⟧) {
            best = i;
        }
    }
    return best;
}`,
    harness: { prelude: String.raw`#include <stdio.h>
struct ⟦Type⟧ { char name[16]; int ⟦field⟧; };
`, code: String.raw`int main(void) {
    struct ⟦Type⟧ all[] = {{"Ana", 81}, {"Ben", 95}, {"Cy", 77}};
    printf("%s\n", all[⟦fn⟧(all, 3)].name);
    return 0;
}`, expect: 'Ben\n' }
  },
  {
    id: 'tpl-malloc-array', title: 'malloc an array', concepts: ['pointer', 'for', 'if', 'function'], tags: ['memory'],
    label: 'Allocate n ints with malloc, check for NULL, fill them with 1..n and return the block.',
    body: String.raw`int *⟦fn:make_range⟧(int ⟦n:count⟧) {
    int *⟦arr:values⟧ = malloc(sizeof(int) * ⟦n:count⟧);
    if (⟦arr:values⟧ == NULL) {
        return NULL;
    }
    for (int i = 0; i < ⟦n:count⟧; i++) {
        ⟦arr:values⟧[i] = i + 1;
    }
    return ⟦arr:values⟧;
}`,
    harness: { prelude: TPL_IO_LIB, code: String.raw`int main(void) {
    int *got = ⟦fn⟧(5);
    for (int k = 0; k < 5; k++) printf("%d ", got[k]);
    printf("\n");
    free(got);
    return 0;
}`, expect: '1 2 3 4 5 \n' }
  },
  {
    id: 'tpl-list-push', title: 'Linked list: push at head', concepts: ['pointer', 'function'], tags: ['linked lists', 'memory'],
    label: 'Define a list node and insert a new node at the head through a pointer to the head.',
    body: String.raw`struct ⟦Type:Node⟧ {
    int ⟦field:value⟧;
    struct ⟦Type:Node⟧ *next;
};

void ⟦fn:push⟧(struct ⟦Type:Node⟧ **head, int ⟦field:value⟧) {
    struct ⟦Type:Node⟧ *n = malloc(sizeof *n);
    if (n == NULL) {
        return;
    }
    n->⟦field:value⟧ = ⟦field:value⟧;
    n->next = *head;
    *head = n;
}`,
    harness: { prelude: TPL_IO_LIB, code: String.raw`int main(void) {
    struct ⟦Type⟧ *list = NULL;
    ⟦fn⟧(&list, 1);
    ⟦fn⟧(&list, 2);
    ⟦fn⟧(&list, 3);
    for (struct ⟦Type⟧ *c = list; c != NULL; c = c->next) printf("%d ", c->⟦field⟧);
    printf("\n");
    return 0;
}`, expect: '3 2 1 \n' }
  },
  {
    id: 'tpl-list-print', title: 'Linked list: walk and print', concepts: ['pointer', 'for', 'function', 'printf'], tags: ['linked lists'],
    label: 'Visit every node from the head to NULL and print its value.',
    body: String.raw`void ⟦fn:print_list⟧(const struct ⟦Type:Node⟧ *head) {
    for (const struct ⟦Type:Node⟧ *cur = head; cur != NULL; cur = cur->next) {
        printf("%d ", cur->⟦field:value⟧);
    }
    printf("\n");
}`,
    harness: { prelude: String.raw`#include <stdio.h>
struct ⟦Type⟧ { int ⟦field⟧; struct ⟦Type⟧ *next; };
`, code: String.raw`int main(void) {
    struct ⟦Type⟧ c = {3, NULL}, b = {2, &c}, a = {1, &b};
    ⟦fn⟧(&a);
    return 0;
}`, expect: '1 2 3 \n' }
  },
  {
    id: 'tpl-list-append', title: 'Linked list: append at tail', concepts: ['pointer', 'while', 'if', 'function'], tags: ['linked lists', 'memory'],
    label: 'Add a node at the end: link it as the head when the list is empty, else walk to the last node.',
    body: String.raw`void ⟦fn:append⟧(struct ⟦Type:Node⟧ **head, int ⟦v:value⟧) {
    struct ⟦Type:Node⟧ *n = malloc(sizeof *n);
    if (n == NULL) {
        return;
    }
    n->⟦field:data⟧ = ⟦v:value⟧;
    n->next = NULL;
    if (*head == NULL) {
        *head = n;
        return;
    }
    struct ⟦Type:Node⟧ *cur = *head;
    while (cur->next != NULL) {
        cur = cur->next;
    }
    cur->next = n;
}`,
    harness: { prelude: String.raw`#include <stdio.h>
#include <stdlib.h>
struct ⟦Type⟧ { int ⟦field⟧; struct ⟦Type⟧ *next; };
`, code: String.raw`int main(void) {
    struct ⟦Type⟧ *list = NULL;
    ⟦fn⟧(&list, 1);
    ⟦fn⟧(&list, 2);
    ⟦fn⟧(&list, 3);
    for (struct ⟦Type⟧ *c = list; c != NULL; c = c->next) printf("%d ", c->⟦field⟧);
    printf("\n");
    return 0;
}`, expect: '1 2 3 \n' }
  },
  {
    id: 'tpl-list-free', title: 'Linked list: free it all', concepts: ['pointer', 'while', 'function'], tags: ['linked lists', 'memory'],
    label: 'Free every node, saving next before the node it lives in is freed.',
    body: String.raw`void ⟦fn:free_list⟧(struct ⟦Type:Node⟧ *head) {
    while (head != NULL) {
        struct ⟦Type:Node⟧ *next = head->next;
        free(head);
        head = next;
    }
}`,
    harness: { prelude: String.raw`#include <stdio.h>
#include <stdlib.h>
struct ⟦Type⟧ { int value; struct ⟦Type⟧ *next; };
`, code: String.raw`int main(void) {
    struct ⟦Type⟧ *list = NULL;
    for (int k = 0; k < 3; k++) {
        struct ⟦Type⟧ *n = malloc(sizeof *n);
        n->value = k;
        n->next = list;
        list = n;
    }
    ⟦fn⟧(list);
    printf("freed\n");
    return 0;
}`, expect: 'freed\n' }
  },
  {
    id: 'tpl-list-remove', title: 'Linked list: delete a value', concepts: ['pointer', 'while', 'ifelse', 'function'], tags: ['linked lists', 'memory'],
    label: 'Unlink and free the first node holding the target, keeping a pointer to the one before; 1 if found.',
    body: String.raw`int ⟦fn:remove_value⟧(struct ⟦Type:Node⟧ **head, int ⟦v:target⟧) {
    struct ⟦Type:Node⟧ *cur = *head, *prev = NULL;
    while (cur != NULL && cur->⟦field:data⟧ != ⟦v:target⟧) {
        prev = cur;
        cur = cur->next;
    }
    if (cur == NULL) {
        return 0;
    }
    if (prev == NULL) {
        *head = cur->next;
    } else {
        prev->next = cur->next;
    }
    free(cur);
    return 1;
}`,
    harness: { prelude: String.raw`#include <stdio.h>
#include <stdlib.h>
struct ⟦Type⟧ { int ⟦field⟧; struct ⟦Type⟧ *next; };
`, code: String.raw`int main(void) {
    struct ⟦Type⟧ *list = NULL;
    for (int k = 3; k >= 1; k--) {
        struct ⟦Type⟧ *n = malloc(sizeof *n);
        n->⟦field⟧ = k;
        n->next = list;
        list = n;
    }
    int a = ⟦fn⟧(&list, 2);
    int b = ⟦fn⟧(&list, 9);
    int c = ⟦fn⟧(&list, 1);
    printf("%d %d %d:", a, b, c);
    for (struct ⟦Type⟧ *p = list; p != NULL; p = p->next) printf(" %d", p->⟦field⟧);
    printf("\n");
    return 0;
}`, expect: '1 0 1: 3\n' }
  },
  {
    id: 'tpl-file-count-lines', title: 'Count lines in a file', concepts: ['while', 'if', 'function'], tags: ['files'],
    label: 'Open a file for reading, count lines with fgets, close it; -1 when it will not open.',
    body: String.raw`int ⟦fn:count_lines⟧(const char *⟦path:path⟧) {
    FILE *fp = fopen(⟦path:path⟧, "r");
    if (fp == NULL) {
        return -1;
    }
    char line[256];
    int ⟦lines:lines⟧ = 0;
    while (fgets(line, sizeof line, fp) != NULL) {
        ⟦lines:lines⟧++;
    }
    fclose(fp);
    return ⟦lines:lines⟧;
}`
  },
  {
    id: 'tpl-file-write', title: 'Write numbers to a file', concepts: ['for', 'if', 'function', 'array'], tags: ['files'],
    label: 'Open a file for writing, fprintf one number per line, close it; 0 when it will not open.',
    body: String.raw`int ⟦fn:save_scores⟧(const char *⟦path:path⟧, const int ⟦arr:scores⟧[], int ⟦n:count⟧) {
    FILE *fp = fopen(⟦path:path⟧, "w");
    if (fp == NULL) {
        return 0;
    }
    for (int i = 0; i < ⟦n:count⟧; i++) {
        fprintf(fp, "%d\n", ⟦arr:scores⟧[i]);
    }
    fclose(fp);
    return 1;
}`
  },
  {
    id: 'tpl-factorial', title: 'Factorial, recursively', concepts: ['recursion', 'if', 'function'], tags: ['recursion'],
    label: 'n! as a base case (n <= 1) and a call on n - 1.',
    body: String.raw`long ⟦fn:factorial⟧(int ⟦n:n⟧) {
    if (⟦n:n⟧ <= 1) {
        return 1;
    }
    return ⟦n:n⟧ * ⟦fn:factorial⟧(⟦n:n⟧ - 1);
}`,
    harness: { prelude: TPL_IO, code: String.raw`int main(void) {
    printf("%ld\n", ⟦fn⟧(10));
    return 0;
}`, expect: '3628800\n' }
  },
  {
    id: 'tpl-fibonacci', title: 'Fibonacci, iteratively', concepts: ['for', 'function'], tags: ['loops'],
    label: 'The nth Fibonacci number by walking two running values forward n times.',
    body: String.raw`int ⟦fn:fibonacci⟧(int ⟦n:n⟧) {
    int a = 0, b = 1;
    for (int i = 0; i < ⟦n:n⟧; i++) {
        int next = a + b;
        a = b;
        b = next;
    }
    return a;
}`,
    harness: { prelude: TPL_IO, code: String.raw`int main(void) {
    int a = ⟦fn⟧(10);
    int b = ⟦fn⟧(1);
    printf("%d %d\n", a, b);
    return 0;
}`, expect: '55 1\n' }
  },
  {
    id: 'tpl-gcd', title: 'Greatest common divisor', concepts: ['while', 'function'], tags: ['loops', 'math'],
    label: 'Euclid: replace (a, b) with (b, a % b) until b is 0.',
    body: String.raw`int ⟦fn:gcd⟧(int ⟦a:a⟧, int ⟦b:b⟧) {
    while (⟦b:b⟧ != 0) {
        int r = ⟦a:a⟧ % ⟦b:b⟧;
        ⟦a:a⟧ = ⟦b:b⟧;
        ⟦b:b⟧ = r;
    }
    return ⟦a:a⟧;
}`,
    harness: { prelude: TPL_IO, code: String.raw`int main(void) {
    printf("%d\n", ⟦fn⟧(84, 36));
    return 0;
}`, expect: '12\n' }
  },
  {
    id: 'tpl-is-prime', title: 'Prime check', concepts: ['for', 'if', 'function'], tags: ['loops', 'math'],
    label: 'Return 1 for a prime: below 2 is not, otherwise try divisors up to the square root.',
    body: String.raw`int ⟦fn:is_prime⟧(int ⟦n:n⟧) {
    if (⟦n:n⟧ < 2) {
        return 0;
    }
    for (int d = 2; d * d <= ⟦n:n⟧; d++) {
        if (⟦n:n⟧ % d == 0) {
            return 0;
        }
    }
    return 1;
}`,
    harness: { prelude: TPL_IO, code: String.raw`int main(void) {
    int a = ⟦fn⟧(1);
    int b = ⟦fn⟧(2);
    int c = ⟦fn⟧(9);
    int d = ⟦fn⟧(13);
    printf("%d%d%d%d\n", a, b, c, d);
    return 0;
}`, expect: '0101\n' }
  },
  {
    id: 'tpl-row-sums', title: 'Row sums of a 2D array', concepts: ['array', 'nestedloop', 'function'], tags: ['arrays'],
    label: 'Fill an output array with the sum of each row of a grid with a fixed column count.',
    body: String.raw`#define COLS 3

void ⟦fn:row_sums⟧(int ⟦m:grid⟧[][COLS], int rows, int ⟦out:sums⟧[]) {
    for (int r = 0; r < rows; r++) {
        ⟦out:sums⟧[r] = 0;
        for (int c = 0; c < COLS; c++) {
            ⟦out:sums⟧[r] += ⟦m:grid⟧[r][c];
        }
    }
}`,
    harness: { prelude: TPL_IO, code: String.raw`int main(void) {
    int g[2][COLS] = {{1, 2, 3}, {4, 5, 6}};
    int s[2];
    ⟦fn⟧(g, 2, s);
    printf("%d %d\n", s[0], s[1]);
    return 0;
}`, expect: '6 15\n' }
  }
];

if (typeof module !== 'undefined' && module.exports) module.exports = { TPL_STARTER };
