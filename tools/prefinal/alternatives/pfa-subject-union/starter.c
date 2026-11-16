#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#define MAX 12

typedef struct{
    char code[8];
    int units;
}Subject;

typedef struct{
    Subject elems[MAX];
    int count;
}List;

// --- Function Prototypes ---
void initList(List* L);
void insertLast(List* L, Subject s);
int findSubject(List L, char* code);
List unionSubjects(List A, List B);
void readSubjects(List* L, char* student);
void displaySubjects(List L);

int main(void)
{
    // 1. Variable Declarations
    List mika, jojo, all;

    // 2. Function Calls
    initList(&mika);
    initList(&jojo);
    readSubjects(&mika, "Mika");
    readSubjects(&jojo, "Jojo");

    all = unionSubjects(mika, jojo);
    displaySubjects(all);

    return 0;
}

// --- Provided List Functions ---
void initList(List* L)
{
    L->count = 0;
}

void insertLast(List* L, Subject s)
{
    //Check if there is enough space to insert.
    if(L->count < MAX){
        L->elems[L->count] = s;
        L->count++;
    }
}

int findSubject(List L, char* code)
{
    int i;
    /* stops at the subject with this code, or at the end of the list */
    for(i = 0; i < L.count && strcmp(L.elems[i].code, code) != 0; i++){}

    return (i < L.count) ? i : -1;          /* -1 means not found */
}

// --- Your Implementation ---
List unionSubjects(List A, List B)
{

}

// --- Input Function ---
void readSubjects(List* L, char* student)
{
    int n, i;
    Subject s;

    printf("Subjects of %s (0-6): ", student);
    scanf("%d", &n);

    for(i = 0; i < n && i < 6; i++){
        printf("Subject %d (Code Units): ", i + 1);
        scanf("%7s %d", s.code, &s.units);
        insertLast(L, s);
    }
}

// --- Display Function ---
void displaySubjects(List L)
{
    int i, total = 0;
    if(L.count == 0){
        printf("\nNo subjects.\n");
        return;
    }

    printf("\n=== ALL SUBJECTS (%d) ===\n", L.count);
    for(i = 0; i < L.count; i++){
        printf("%d. %s (%d units)\n", i + 1, L.elems[i].code, L.elems[i].units);
        total += L.elems[i].units;
    }
    printf("Total units: %d\n", total);
}
