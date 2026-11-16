#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#define MAX 10

typedef struct{
    int hours;
    int minutes;
    int seconds;
}Time;

typedef struct{
    int bib;
    char name[16];
    Time finish;
}Runner;

typedef struct{
    Runner elems[MAX];
    int count;
}List, *ListV2;

// --- Function Prototypes ---
void initListV2(ListV2* L);
void insertLastV2(ListV2 L, Runner r);
int toSeconds(Time t);
void sortByTime(ListV2 L);
void readResults(ListV2 L);
void displayResults(ListV2 L);

int main(void)
{
    // 1. Variable Declarations
    ListV2 results = NULL;

    // 2. Function Calls
    initListV2(&results);
    if(results == NULL){
        printf("Unable to open the results.\n");
        return 1;
    }

    readResults(results);
    sortByTime(results);
    displayResults(results);

    // 3. Cleanup
    free(results);

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

void insertLastV2(ListV2 L, Runner r)
{
    //Check if there is enough space to insert.
    if(L->count < MAX){
        L->elems[L->count] = r;
        L->count++;
    }
}

// --- Helper Function ---
int toSeconds(Time t)
{
    return t.hours * 3600 + t.minutes * 60 + t.seconds;
}

// --- Your Implementation ---
void sortByTime(ListV2 L)
{

}

// --- Input Function ---
void readResults(ListV2 L)
{
    int n, i;
    Runner r;

    printf("Number of runners: ");
    scanf("%d", &n);

    for(i = 0; i < n; i++){
        printf("Runner %d (Bib Name H M S): ", i + 1);
        scanf("%d %15s %d %d %d", &r.bib, r.name, &r.finish.hours, &r.finish.minutes, &r.finish.seconds);
        insertLastV2(L, r);
    }
}

// --- Display Function ---
void displayResults(ListV2 L)
{
    int i;
    if(L->count == 0){
        printf("\nNo runners yet.\n");
        return;
    }

    printf("\n=== RESULTS (%d) ===\n", L->count);
    for(i = 0; i < L->count; i++){
        printf("%d. #%d %s - %d:%02d:%02d\n", i + 1, L->elems[i].bib, L->elems[i].name,
               L->elems[i].finish.hours, L->elems[i].finish.minutes, L->elems[i].finish.seconds);
    }
}
