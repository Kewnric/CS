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
    int yearLevel;
}Student;

typedef struct{
    Student elems[MAX];
    int count;
}List, *ListV2;

// --- Function Prototypes ---
void initListV2(ListV2* L);
void insertLastV2(ListV2 L, Student s);
Student findStudent(ListV2 L, char* idNo);
void loadRecords(ListV2 L);
void processRequests(ListV2 L);
void displayStudent(Student s);

int main(void)
{
    // 1. Variable Declarations
    ListV2 records = NULL;

    // 2. Function Calls
    initListV2(&records);
    if(records == NULL){
        printf("Unable to open the records.\n");
        return 1;
    }

    loadRecords(records);
    processRequests(records);

    // 3. Cleanup
    free(records);

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

void insertLastV2(ListV2 L, Student s)
{
    //Check if there is enough space to insert.
    if(L->count < MAX){
        L->elems[L->count] = s;
        L->count++;
    }
}

// --- Your Implementation ---
Student findStudent(ListV2 L, char* idNo)
{

}

// --- Input Functions ---
void loadRecords(ListV2 L)
{
    Student onFile[8] = {
        {"22100451", {"Andrea", "Reyes"}, "BSCS", 3},
        {"22100873", {"Benjie", "Santos"}, "BSIT", 3},
        {"23101102", {"Carla", "Mendoza"}, "BSIS", 2},
        {"21100618", {"Franco", "Aquino"}, "BSCS", 4},
        {"24101539", {"Ella", "Bautista"}, "BSIT", 1},
        {"22100990", {"Gwen", "Lim"}, "BSCS", 3},
        {"23100345", {"Hector", "Tan"}, "BSIS", 2},
        {"21100777", {"Isa", "Cruz"}, "BSIT", 4}
    };
    int i;

    for(i = 0; i < 8; i++){
        insertLastV2(L, onFile[i]);
    }
}

void processRequests(ListV2 L)
{
    int n, i;
    char id[10];
    Student found;

    printf("Number of requests: ");
    scanf("%d", &n);

    for(i = 0; i < n; i++){
        printf("Student ID %d: ", i + 1);
        scanf("%9s", id);

        found = findStudent(L, id);
        displayStudent(found);
        if(found.yearLevel == 0){
            printf("No record for %s.\n", id);
        }
    }
}

// --- Display Function ---
void displayStudent(Student s)
{
    printf("[%s] %s %s - %s %d\n", s.idNo, s.name.first, s.name.last, s.course, s.yearLevel);
}
