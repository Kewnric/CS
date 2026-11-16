#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#define MAX 8

typedef struct{
    char seat[4];
    char name[16];
    char destination[16];
}Passenger;

typedef struct{
    Passenger elems[MAX];
    int count;
}List;

// --- Function Prototypes ---
void initList(List* L);
void insertLast(List* L, Passenger p);
void reverseList(List* L);
void loadPassengers(List* L);
void displayBus(List L, char* label);

int main(void)
{
    // 1. Variable Declarations
    List bus;

    // 2. Function Calls
    initList(&bus);
    loadPassengers(&bus);
    displayBus(bus, "BOARDING ORDER");

    reverseList(&bus);
    displayBus(bus, "UNLOADING ORDER");

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
void reverseList(List* L)
{

}

// --- Input Function ---
void loadPassengers(List* L)
{
    //Passengers in the order they boarded.
    Passenger boarded[8] = {
        {"1A", "Abby", "Danao"},
        {"1B", "Boyet", "Carmen"},
        {"2A", "Celia", "Liloan"},
        {"2B", "Doms", "Danao"},
        {"3A", "Evan", "Compostela"},
        {"3B", "Flor", "Liloan"},
        {"4A", "Gerry", "Carmen"},
        {"4B", "Hazel", "Danao"}
    };
    int k, i;

    printf("Passengers boarding (0-8): ");
    scanf("%d", &k);

    for(i = 0; i < k && i < 8; i++){
        insertLast(L, boarded[i]);
    }
}

// --- Display Function ---
void displayBus(List L, char* label)
{
    int i;
    printf("\n=== %s (%d) ===\n", label, L.count);
    for(i = 0; i < L.count; i++){
        printf("%d. [%s] %s - %s\n", i + 1, L.elems[i].seat, L.elems[i].name, L.elems[i].destination);
    }
}
