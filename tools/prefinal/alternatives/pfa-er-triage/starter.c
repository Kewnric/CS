#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#define MAX 8

// Triage levels: a lower number is seen first
#define CRITICAL 1
#define URGENT   2
#define STANDARD 3

typedef struct{
    char caseNo[8];
    char name[16];
    int age;
    int level;
}Patient;

typedef struct{
    Patient elems[MAX];
    int count;
}List, *ListV2;

// --- Function Prototypes ---
void initListV2(ListV2* L);
int admitPatient(ListV2 L, Patient p);
char* getLevelText(int level);
void loadWaitingPatients(ListV2 L);
void processArrivals(ListV2 L);
void displayQueue(ListV2 L);

int main(void)
{
    // 1. Variable Declarations
    ListV2 erQueue = NULL;

    // 2. Function Calls
    initListV2(&erQueue);
    if(erQueue == NULL){
        printf("Unable to open the ER queue.\n");
        return 1;
    }

    loadWaitingPatients(erQueue);
    processArrivals(erQueue);
    displayQueue(erQueue);

    // 3. Cleanup
    free(erQueue);

    return 0;
}

// --- Provided List Function ---
void initListV2(ListV2* L)
{
    *L = malloc(sizeof(List));
    if(*L != NULL){
        (*L)->count = 0;
    }
}

// --- Your Implementation ---
int admitPatient(ListV2 L, Patient p)
{

}

// --- Helper Function ---
char* getLevelText(int level)
{
    char* text;
    switch(level){
        case CRITICAL: text = "CRITICAL"; break;
        case URGENT:   text = "URGENT";   break;
        case STANDARD: text = "STANDARD"; break;
        default:       text = "UNKNOWN";
    }
    return text;
}

// --- Input Functions ---
void loadWaitingPatients(ListV2 L)
{
    //Patients who were already waiting, in the order they arrived.
    Patient waiting[6] = {
        {"ER-101", "Ramon", 67, STANDARD},
        {"ER-102", "Lyn", 24, URGENT},
        {"ER-103", "Tito", 45, STANDARD},
        {"ER-104", "Nena", 71, CRITICAL},
        {"ER-105", "Jun", 9, URGENT},
        {"ER-106", "Abby", 33, STANDARD}
    };
    int k, i;

    printf("Patients already waiting (0-6): ");
    scanf("%d", &k);

    for(i = 0; i < k && i < 6; i++){
        admitPatient(L, waiting[i]);
    }
}

void processArrivals(ListV2 L)
{
    int n, i, result;
    Patient p;

    printf("Number of arriving patients: ");
    scanf("%d", &n);

    for(i = 0; i < n; i++){
        printf("Patient %d (Case Name Age Level[1-3]): ", i + 1);
        scanf("%7s %15s %d %d", p.caseNo, p.name, &p.age, &p.level);

        result = admitPatient(L, p);
        if(result > 0){
            printf("%s (%s) is #%d in the queue.\n", p.name, getLevelText(p.level), result);
        } else if(result == 0){
            printf("The ER is full. %s was sent to another hospital.\n", p.name);
        } else {
            printf("Invalid triage level for %s.\n", p.name);
        }
    }
}

// --- Display Function ---
void displayQueue(ListV2 L)
{
    int i;
    if(L->count == 0){
        printf("\nNo patients waiting.\n");
        return;
    }

    printf("\n=== ER QUEUE (%d/%d) ===\n", L->count, MAX);
    for(i = 0; i < L->count; i++){
        printf("%d. [%s] %s, %d - %s\n", i + 1, L->elems[i].caseNo, L->elems[i].name,
               L->elems[i].age, getLevelText(L->elems[i].level));
    }
}
