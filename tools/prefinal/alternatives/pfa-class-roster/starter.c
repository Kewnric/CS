#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#define MAX 8

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
int enrollStudent(List* L, Student s);
void loadEarlyEnrollees(List* L);
void processEnrollment(List* L);
void displayRoster(List L);

int main(void)
{
    // 1. Variable Declarations
    List roster;

    // 2. Function Calls
    initList(&roster);
    loadEarlyEnrollees(&roster);
    processEnrollment(&roster);
    displayRoster(roster);

    return 0;
}

// --- Provided List Function ---
void initList(List* L)
{
    L->count = 0;
}

// --- Your Implementation ---
int enrollStudent(List* L, Student s)
{

}

// --- Input Functions ---
void loadEarlyEnrollees(List* L)
{
    //Students who enrolled during early registration, in the order they enrolled.
    Student early[5] = {
        {"23100101", {"Liza", "Santos"}, "BSCS"},
        {"23100102", {"Paolo", "Aquino"}, "BSIT"},
        {"23100103", {"Rina", "Mendoza"}, "BSIS"},
        {"23100104", {"Carlo", "Bautista"}, "BSCS"},
        {"23100105", {"Mika", "Santos"}, "BSIT"}
    };
    int k, i;

    printf("Early enrollees (0-5): ");
    scanf("%d", &k);

    for(i = 0; i < k && i < 5; i++){
        enrollStudent(L, early[i]);
    }
}

void processEnrollment(List* L)
{
    int n, i, result;
    Student s;

    printf("Number of new enrollees: ");
    scanf("%d", &n);

    for(i = 0; i < n; i++){
        printf("Student %d (ID First Last Course): ", i + 1);
        scanf("%9s %15s %15s %7s", s.idNo, s.name.first, s.name.last, s.course);

        result = enrollStudent(L, s);
        if(result >= 0){
            printf("%s %s enrolled as #%d on the roster.\n", s.name.first, s.name.last, result + 1);
        } else {
            printf("The roster is full. %s %s was not enrolled.\n", s.name.first, s.name.last);
        }
    }
}

// --- Display Function ---
void displayRoster(List L)
{
    int i;
    if(L.count == 0){
        printf("\nThe roster is empty.\n");
        return;
    }

    printf("\n=== CLASS ROSTER (%d/%d) ===\n", L.count, MAX);
    for(i = 0; i < L.count; i++){
        printf("%d. %s, %s [%s] %s\n", i + 1, L.elems[i].name.last, L.elems[i].name.first,
               L.elems[i].idNo, L.elems[i].course);
    }
}
