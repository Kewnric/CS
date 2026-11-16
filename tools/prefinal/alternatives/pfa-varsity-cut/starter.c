#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#define MAX 10

typedef struct{
    int speed;
    int agility;
    int skill;
}Drills;

typedef struct{
    char idNo[8];
    char name[16];
    Drills scores;
}Athlete;

typedef struct{
    Athlete elems[MAX];
    int count;
}List, *ListV2;

// --- Function Prototypes ---
void initListV2(ListV2* L);
void insertLastV2(ListV2 L, Athlete a);
int removeBelowCutoff(ListV2 L, int cutoff);
void loadTryouts(ListV2 L);
void displayPool(ListV2 L);

int main(void)
{
    // 1. Variable Declarations
    ListV2 pool = NULL;
    int cutoff, removed;

    // 2. Function Calls
    initListV2(&pool);
    if(pool == NULL){
        printf("Unable to open the tryout list.\n");
        return 1;
    }

    loadTryouts(pool);

    printf("Cutoff total: ");
    scanf("%d", &cutoff);
    removed = removeBelowCutoff(pool, cutoff);
    printf("%d athlete(s) cut.\n", removed);

    displayPool(pool);

    // 3. Cleanup
    free(pool);

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

void insertLastV2(ListV2 L, Athlete a)
{
    //Check if there is enough space to insert.
    if(L->count < MAX){
        L->elems[L->count] = a;
        L->count++;
    }
}

// --- Your Implementation ---
int removeBelowCutoff(ListV2 L, int cutoff)
{

}

// --- Input Function ---
void loadTryouts(ListV2 L)
{
    //Athletes in the order they tried out.
    Athlete tried[8] = {
        {"VA-01", "Arnold", {80, 75, 90}},
        {"VA-02", "Bea", {70, 65, 60}},
        {"VA-03", "Chito", {90, 85, 88}},
        {"VA-04", "Dina", {60, 70, 65}},
        {"VA-05", "Ely", {85, 80, 70}},
        {"VA-06", "Faith", {75, 75, 75}},
        {"VA-07", "Gabby", {50, 60, 55}},
        {"VA-08", "Hans", {88, 92, 95}}
    };
    int i;

    for(i = 0; i < 8; i++){
        insertLastV2(L, tried[i]);
    }
}

// --- Display Function ---
void displayPool(ListV2 L)
{
    int i;
    if(L->count == 0){
        printf("\nNo athletes left.\n");
        return;
    }

    printf("\n=== VARSITY POOL (%d) ===\n", L->count);
    for(i = 0; i < L->count; i++){
        printf("%d. [%s] %s - %d + %d + %d = %d\n", i + 1, L->elems[i].idNo, L->elems[i].name,
               L->elems[i].scores.speed, L->elems[i].scores.agility, L->elems[i].scores.skill,
               L->elems[i].scores.speed + L->elems[i].scores.agility + L->elems[i].scores.skill);
    }
}
