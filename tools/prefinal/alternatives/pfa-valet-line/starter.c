#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#define MAX 8

typedef struct{
    char plate[9];
    char model[16];
    char owner[16];
}Car;

typedef struct{
    Car elems[MAX];
    int count;
}List;

// --- Function Prototypes ---
void initList(List* L);
void insertLast(List* L, Car c);
int removeCarAt(List* L, int pos, Car* removed);
void loadValetLine(List* L);
void processPickups(List* L);
void displayLine(List L);

int main(void)
{
    // 1. Variable Declarations
    List valet;

    // 2. Function Calls
    initList(&valet);
    loadValetLine(&valet);
    processPickups(&valet);
    displayLine(valet);

    return 0;
}

// --- Provided List Functions ---
void initList(List* L)
{
    L->count = 0;
}

void insertLast(List* L, Car c)
{
    //Check if there is enough space to insert.
    if(L->count < MAX){
        L->elems[L->count] = c;
        L->count++;
    }
}

// --- Your Implementation ---
int removeCarAt(List* L, int pos, Car* removed)
{

}

// --- Input Functions ---
void loadValetLine(List* L)
{
    //Cars parked by the valet, in the order they arrived.
    Car parked[7] = {
        {"NBC-1234", "Vios", "Arnel"},
        {"GAA-5678", "Mirage", "Bea"},
        {"TKO-2468", "Fortuner", "Carl"},
        {"PLM-1357", "Civic", "Dang"},
        {"XYZ-9087", "Innova", "Edz"},
        {"QWE-1122", "Jazz", "Fe"},
        {"RTY-3344", "Ranger", "Gab"}
    };
    int k, i;

    printf("Cars in the valet line (0-7): ");
    scanf("%d", &k);

    for(i = 0; i < k && i < 7; i++){
        insertLast(L, parked[i]);
    }
}

void processPickups(List* L)
{
    int n, i, pos;
    Car gone;

    printf("Cars leaving: ");
    scanf("%d", &n);

    for(i = 0; i < n; i++){
        printf("Position of car %d: ", i + 1);
        scanf("%d", &pos);

        if(removeCarAt(L, pos, &gone) == 1){
            printf("%s (%s) left. It was at position %d.\n", gone.plate, gone.owner, pos);
        } else {
            printf("No car at position %d.\n", pos);
        }
    }
}

// --- Display Function ---
void displayLine(List L)
{
    int i;
    if(L.count == 0){
        printf("\nThe valet line is empty.\n");
        return;
    }

    printf("\n=== VALET LINE (%d) ===\n", L.count);
    for(i = 0; i < L.count; i++){
        printf("%d. %s %s - %s\n", i + 1, L.elems[i].plate, L.elems[i].model, L.elems[i].owner);
    }
}
