#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#define MAX 7

typedef struct{
    char code[6];
    char name[16];
}Stop;

typedef struct{
    Stop elems[MAX];
    int count;
}List, *ListV2;

// --- Function Prototypes ---
void initListV2(ListV2* L);
void insertLastV2(ListV2 L, Stop s);
int addStopAfter(ListV2 L, Stop s, char* afterCode);
void loadRoute(ListV2 L);
void processNewStops(ListV2 L);
void displayRoute(ListV2 L);

int main(void)
{
    // 1. Variable Declarations
    ListV2 route = NULL;

    // 2. Function Calls
    initListV2(&route);
    if(route == NULL){
        printf("Unable to open the route.\n");
        return 1;
    }

    loadRoute(route);
    processNewStops(route);
    displayRoute(route);

    // 3. Cleanup
    free(route);

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

void insertLastV2(ListV2 L, Stop s)
{
    //Check if there is enough space to insert.
    if(L->count < MAX){
        L->elems[L->count] = s;
        L->count++;
    }
}

// --- Your Implementation ---
int addStopAfter(ListV2 L, Stop s, char* afterCode)
{

}

// --- Input Functions ---
void loadRoute(ListV2 L)
{
    //The current route, in the order the bus passes the stops.
    Stop current[5] = {
        {"S01", "Talamban"},
        {"S02", "Banilad"},
        {"S03", "Lahug"},
        {"S04", "Fuente"},
        {"S05", "Colon"}
    };
    int k, i;

    printf("Stops on the route (0-5): ");
    scanf("%d", &k);

    for(i = 0; i < k && i < 5; i++){
        insertLastV2(L, current[i]);
    }
}

void processNewStops(ListV2 L)
{
    int n, i, result;
    char after[6];
    Stop s;

    printf("Number of new stops: ");
    scanf("%d", &n);

    for(i = 0; i < n; i++){
        printf("New stop %d (Code Name AfterCode): ", i + 1);
        scanf("%5s %15s %5s", s.code, s.name, after);

        result = addStopAfter(L, s, after);
        if(result > 0){
            printf("%s added as stop #%d.\n", s.name, result);
        } else if(result == 0){
            printf("The route is full. %s was not added.\n", s.name);
        } else {
            printf("No stop %s on the route. %s was not added.\n", after, s.name);
        }
    }
}

// --- Display Function ---
void displayRoute(ListV2 L)
{
    int i;
    if(L->count == 0){
        printf("\nThe route has no stops.\n");
        return;
    }

    printf("\n=== ROUTE (%d/%d stops) ===\n", L->count, MAX);
    for(i = 0; i < L->count; i++){
        printf("%d. [%s] %s\n", i + 1, L->elems[i].code, L->elems[i].name);
    }
}
