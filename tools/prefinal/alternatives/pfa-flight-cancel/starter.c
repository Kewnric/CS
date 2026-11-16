#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#define MAX 10

typedef struct{
    char first[16];
    char last[16];
}Name;

typedef struct{
    char ticketNo[8];
    Name name;
    char flight[8];
}Passenger;

typedef struct{
    Passenger elems[MAX];
    int count;
}List;

// --- Function Prototypes ---
void initList(List* L);
void insertLast(List* L, Passenger p);
int cancelFlight(List* L, char* flight);
void loadCheckIns(List* L);
void processCancellations(List* L);
void displayCheckIns(List L);

int main(void)
{
    // 1. Variable Declarations
    List checkIns;

    // 2. Function Calls
    initList(&checkIns);
    loadCheckIns(&checkIns);
    processCancellations(&checkIns);
    displayCheckIns(checkIns);

    return 0;
}

// --- Provided List Functions ---
void initList(List* L)
{
    L->count = 0;
}

void insertLast(List* L, Passenger p)
{
    //Check if there is enough space to insert.
    if(L->count < MAX){
        L->elems[L->count] = p;
        L->count++;
    }
}

// --- Your Implementation ---
int cancelFlight(List* L, char* flight)
{

}

// --- Input Functions ---
void loadCheckIns(List* L)
{
    //Passengers in the order they checked in.
    Passenger checked[10] = {
        {"TK-001", {"Ana", "Cruz"}, "5J560"},
        {"TK-002", {"Ben", "Lim"}, "PR1845"},
        {"TK-003", {"Cara", "Uy"}, "5J560"},
        {"TK-004", {"Dan", "Go"}, "5J560"},
        {"TK-005", {"Eli", "Tan"}, "Z2771"},
        {"TK-006", {"Fay", "Sy"}, "PR1845"},
        {"TK-007", {"Gil", "Ong"}, "5J560"},
        {"TK-008", {"Hal", "Yu"}, "Z2771"},
        {"TK-009", {"Ivy", "Co"}, "PR1845"},
        {"TK-010", {"Jon", "Ty"}, "5J560"}
    };
    int k, i;

    printf("Passengers checked in (0-10): ");
    scanf("%d", &k);

    for(i = 0; i < k && i < 10; i++){
        insertLast(L, checked[i]);
    }
}

void processCancellations(List* L)
{
    int n, i, removed;
    char flight[8];

    printf("Cancelled flights: ");
    scanf("%d", &n);

    for(i = 0; i < n; i++){
        printf("Flight %d: ", i + 1);
        scanf("%7s", flight);

        removed = cancelFlight(L, flight);
        if(removed > 0){
            printf("%d passenger(s) of %s rebooked.\n", removed, flight);
        } else {
            printf("No passengers on %s.\n", flight);
        }
    }
}

// --- Display Function ---
void displayCheckIns(List L)
{
    int i;
    if(L.count == 0){
        printf("\nThe check-in list is empty.\n");
        return;
    }

    printf("\n=== CHECK-IN LIST (%d) ===\n", L.count);
    for(i = 0; i < L.count; i++){
        printf("%d. [%s] %s, %s - %s\n", i + 1, L.elems[i].ticketNo, L.elems[i].name.last,
               L.elems[i].name.first, L.elems[i].flight);
    }
}
