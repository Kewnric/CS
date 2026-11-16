#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#define MAX 10

typedef struct{
    char first[16];
    char last[16];
}Name;

typedef struct{
    char idNo[10];
    Name name;
    char course[8];
}Student;

typedef struct{
    Student elems[MAX];
    int count;
}List;

// --- Function Prototypes ---
void initList(List* L);
void insertLast(List* L, Student s);
List getRoster(List L, char* course);
void loadMasterList(List* L);
void processRosters(List* L);
void displayList(List L, char* label);

int main(void)
{
    // 1. Variable Declarations
    List master;

    // 2. Function Calls
    initList(&master);
    loadMasterList(&master);
    processRosters(&master);
    displayList(master, "MASTER LIST");

    return 0;
}

// --- Provided List Functions ---
void initList(List* L)
{
    L->count = 0;
}

void insertLast(List* L, Student s)
{
    //Check if there is enough space to insert.
    if(L->count < MAX){
        L->elems[L->count] = s;
        L->count++;
    }
}

// --- Your Implementation ---
List getRoster(List L, char* course)
{

}

// --- Input Functions ---
void loadMasterList(List* L)
{
    Student all[10] = {
        {"22100001", {"Ana", "Reyes"}, "BSCS"},
        {"22100002", {"Ben", "Cruz"}, "BSIT"},
        {"22100003", {"Cara", "Lim"}, "BSCS"},
        {"22100004", {"Dan", "Uy"}, "BSIS"},
        {"22100005", {"Eli", "Tan"}, "BSIT"},
        {"22100006", {"Faye", "Go"}, "BSCS"},
        {"22100007", {"Gio", "Sy"}, "BSIS"},
        {"22100008", {"Hana", "Ong"}, "BSIT"},
        {"22100009", {"Ivan", "Co"}, "BSCS"},
        {"22100010", {"Jade", "Yu"}, "BSIT"}
    };
    int i;

    for(i = 0; i < 10; i++){
        insertLast(L, all[i]);
    }
}

void processRosters(List* L)
{
    int n, i;
    char course[8];
    List roster;

    printf("Number of rosters: ");
    scanf("%d", &n);

    for(i = 0; i < n; i++){
        printf("Course %d: ", i + 1);
        scanf("%7s", course);

        roster = getRoster(*L, course);
        displayList(roster, course);
    }
}

// --- Display Function ---
void displayList(List L, char* label)
{
    int i;
    printf("\n=== %s (%d) ===\n", label, L.count);
    for(i = 0; i < L.count; i++){
        printf("%d. [%s] %s, %s - %s\n", i + 1, L.elems[i].idNo, L.elems[i].name.last,
               L.elems[i].name.first, L.elems[i].course);
    }
}
