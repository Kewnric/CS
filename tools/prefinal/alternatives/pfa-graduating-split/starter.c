#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#define MAX 10

typedef struct{
    char idNo[10];
    char name[16];
    char course[8];
    int yearLevel;
}Student;

typedef struct{
    Student elems[MAX];
    int count;
}List, *ListV2;

// --- Function Prototypes ---
void initListV2(ListV2* L);
void insertLastV2(ListV2 L, Student s);
ListV2 extractGraduates(ListV2 L);
void loadStudents(ListV2 L);
void displayStudents(ListV2 L, char* label);

int main(void)
{
    // 1. Variable Declarations
    ListV2 students = NULL;
    ListV2 graduates = NULL;

    // 2. Function Calls
    initListV2(&students);
    if(students == NULL){
        printf("Unable to open the student list.\n");
        return 1;
    }

    loadStudents(students);
    graduates = extractGraduates(students);
    if(graduates == NULL){
        printf("Unable to create the graduating list.\n");
        free(students);
        return 1;
    }

    displayStudents(students, "STAYING");
    displayStudents(graduates, "GRADUATING");

    // 3. Cleanup
    free(students);
    free(graduates);

    return 0;
}

// --- Provided List Functions ---
void initListV2(ListV2* L)
{
    *L = malloc(sizeof(List));
    if(*L != NULL){
        (*L)->count = 0;
    }
}

void insertLastV2(ListV2 L, Student s)
{
    //Check if there is enough space to insert.
    if(L->count < MAX){
        L->elems[L->count] = s;
        L->count++;
    }
}

// --- Your Implementation ---
ListV2 extractGraduates(ListV2 L)
{

}

// --- Input Function ---
void loadStudents(ListV2 L)
{
    Student enrolled[10] = {
        {"21100001", "Abe", "BSCS", 3},
        {"20100002", "Bea", "BSIT", 4},
        {"20100003", "Cid", "BSCS", 4},
        {"22100004", "Dee", "BSIS", 2},
        {"23100005", "Eve", "BSIT", 1},
        {"20100006", "Fin", "BSIS", 4},
        {"21100007", "Gus", "BSCS", 3},
        {"22100008", "Hya", "BSIT", 2},
        {"23100009", "Ian", "BSCS", 1},
        {"20100010", "Jen", "BSIS", 4}
    };
    int k, i;

    printf("Students enrolled (0-10): ");
    scanf("%d", &k);

    for(i = 0; i < k && i < 10; i++){
        insertLastV2(L, enrolled[i]);
    }
}

// --- Display Function ---
void displayStudents(ListV2 L, char* label)
{
    int i;
    printf("\n=== %s (%d) ===\n", label, L->count);
    for(i = 0; i < L->count; i++){
        printf("%d. [%s] %s - %s %d\n", i + 1, L->elems[i].idNo, L->elems[i].name,
               L->elems[i].course, L->elems[i].yearLevel);
    }
}
