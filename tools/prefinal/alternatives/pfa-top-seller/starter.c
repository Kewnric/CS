#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#define MAX 8

typedef struct{
    int jan;
    int feb;
    int mar;
}Sales;

typedef struct{
    char code[6];
    char name[16];
    Sales sales;
}Agent;

typedef struct{
    Agent elems[MAX];
    int count;
}List;

// --- Function Prototypes ---
void initList(List* L);
void insertLast(List* L, Agent a);
int findTopSeller(List L);
void loadAgents(List* L);
void displayAgents(List L);

int main(void)
{
    // 1. Variable Declarations
    List team;
    int top;

    // 2. Function Calls
    initList(&team);
    loadAgents(&team);

    top = findTopSeller(team);
    if(top == -1){
        printf("No agents to rank.\n");
    } else {
        printf("Top seller: %s (%s) with %d in sales.\n", team.elems[top].name, team.elems[top].code,
               team.elems[top].sales.jan + team.elems[top].sales.feb + team.elems[top].sales.mar);
    }

    displayAgents(team);

    return 0;
}

// --- Provided List Functions ---
void initList(List* L)
{
    L->count = 0;
}

void insertLast(List* L, Agent a)
{
    //Check if there is enough space to insert.
    if(L->count < MAX){
        L->elems[L->count] = a;
        L->count++;
    }
}

// --- Your Implementation ---
int findTopSeller(List L)
{

}

// --- Input Function ---
void loadAgents(List* L)
{
    Agent all[7] = {
        {"AG-01", "Mara", {120, 80, 100}},
        {"AG-02", "Nico", {90, 110, 95}},
        {"AG-03", "Odette", {150, 70, 90}},
        {"AG-04", "Pao", {100, 100, 110}},
        {"AG-05", "Queenie", {60, 90, 80}},
        {"AG-06", "Ralph", {130, 120, 70}},
        {"AG-07", "Sol", {140, 100, 80}}
    };
    int k, i;

    printf("Agents on the team (0-7): ");
    scanf("%d", &k);

    for(i = 0; i < k && i < 7; i++){
        insertLast(L, all[i]);
    }
}

// --- Display Function ---
void displayAgents(List L)
{
    int i;
    if(L.count == 0){
        return;
    }

    printf("\n=== SALES TEAM (%d) ===\n", L.count);
    for(i = 0; i < L.count; i++){
        printf("%d. [%s] %s - %d + %d + %d = %d\n", i + 1, L.elems[i].code, L.elems[i].name,
               L.elems[i].sales.jan, L.elems[i].sales.feb, L.elems[i].sales.mar,
               L.elems[i].sales.jan + L.elems[i].sales.feb + L.elems[i].sales.mar);
    }
}
