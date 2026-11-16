#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#define MAX 10

typedef struct{
    int hour;
    int minute;
}Time;

typedef struct{
    char idNo[10];
    char name[16];
    Time time;
}Tap;

typedef struct{
    Tap elems[MAX];
    int count;
}List, *ListV2;

// --- Function Prototypes ---
void initListV2(ListV2* L);
void insertLastV2(ListV2 L, Tap t);
int removeDuplicateTaps(ListV2 L);
void readTaps(ListV2 L);
void displayAttendance(ListV2 L);

int main(void)
{
    // 1. Variable Declarations
    ListV2 taps = NULL;
    int removed;

    // 2. Function Calls
    initListV2(&taps);
    if(taps == NULL){
        printf("Unable to open the attendance log.\n");
        return 1;
    }

    readTaps(taps);
    removed = removeDuplicateTaps(taps);
    printf("%d duplicate tap(s) removed.\n", removed);
    displayAttendance(taps);

    // 3. Cleanup
    free(taps);

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

void insertLastV2(ListV2 L, Tap t)
{
    //Check if there is enough space to insert.
    if(L->count < MAX){
        L->elems[L->count] = t;
        L->count++;
    }
}

// --- Your Implementation ---
int removeDuplicateTaps(ListV2 L)
{

}

// --- Input Function ---
void readTaps(ListV2 L)
{
    int n, i;
    Tap t;

    printf("Number of taps: ");
    scanf("%d", &n);

    for(i = 0; i < n; i++){
        printf("Tap %d (ID Name HH MM): ", i + 1);
        scanf("%9s %15s %d %d", t.idNo, t.name, &t.time.hour, &t.time.minute);
        insertLastV2(L, t);
    }
}

// --- Display Function ---
void displayAttendance(ListV2 L)
{
    int i;
    if(L->count == 0){
        printf("\nNo taps recorded.\n");
        return;
    }

    printf("\n=== ATTENDANCE (%d) ===\n", L->count);
    for(i = 0; i < L->count; i++){
        printf("%d. [%s] %s - %02d:%02d\n", i + 1, L->elems[i].idNo, L->elems[i].name,
               L->elems[i].time.hour, L->elems[i].time.minute);
    }
}
