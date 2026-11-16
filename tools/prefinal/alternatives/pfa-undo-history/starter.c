#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#define MAX 8

typedef struct{
    char type[8];
    char text[16];
    int position;
}Action;

typedef struct{
    Action elems[MAX];
    int count;
}List;

// --- Function Prototypes ---
void initList(List* L);
void insertLast(List* L, Action a);
int undoActions(List* L, int steps);
void loadHistory(List* L);
void processUndos(List* L);
void displayHistory(List L);

int main(void)
{
    // 1. Variable Declarations
    List history;

    // 2. Function Calls
    initList(&history);
    loadHistory(&history);
    processUndos(&history);
    displayHistory(history);

    return 0;
}

// --- Provided List Functions ---
void initList(List* L)
{
    L->count = 0;
}

void insertLast(List* L, Action a)
{
    //Check if there is enough space to insert.
    if(L->count < MAX){
        L->elems[L->count] = a;
        L->count++;
    }
}

// --- Your Implementation ---
int undoActions(List* L, int steps)
{

}

// --- Input Functions ---
void loadHistory(List* L)
{
    //Edits made so far, oldest first.
    Action done[6] = {
        {"TYPE", "Hello", 0},
        {"TYPE", "World", 6},
        {"DELETE", "o", 4},
        {"PASTE", "Lorem", 11},
        {"TYPE", "!", 16},
        {"DELETE", "Hello", 0}
    };
    int k, i;

    printf("Edits so far (0-6): ");
    scanf("%d", &k);

    for(i = 0; i < k && i < 6; i++){
        insertLast(L, done[i]);
    }
}

void processUndos(List* L)
{
    int n, i, steps, undone;

    printf("Undo requests: ");
    scanf("%d", &n);

    for(i = 0; i < n; i++){
        printf("Steps to undo: ");
        scanf("%d", &steps);

        undone = undoActions(L, steps);
        printf("Undid %d action(s).\n", undone);
    }
}

// --- Display Function ---
void displayHistory(List L)
{
    int i;
    if(L.count == 0){
        printf("\nNothing left to undo.\n");
        return;
    }

    printf("\n=== HISTORY (%d) ===\n", L.count);
    for(i = 0; i < L.count; i++){
        printf("%d. %s \"%s\" at %d\n", i + 1, L.elems[i].type, L.elems[i].text, L.elems[i].position);
    }
}
