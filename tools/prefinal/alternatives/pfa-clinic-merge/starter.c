#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#define MAX 10

typedef struct{
    int hour;
    int minute;
}Time;

typedef struct{
    char patient[16];
    Time time;
    char clinic[10];
}Appointment;

typedef struct{
    Appointment elems[MAX];
    int count;
}List;

// --- Function Prototypes ---
void initList(List* L);
void insertLast(List* L, Appointment a);
int minutesOf(Time t);
List mergeSchedules(List A, List B);
void readBranch(List* L, char* clinic);
void displaySchedule(List L);

int main(void)
{
    // 1. Variable Declarations
    List branchA, branchB, day;

    // 2. Function Calls
    initList(&branchA);
    initList(&branchB);
    readBranch(&branchA, "Lahug");
    readBranch(&branchB, "Mandaue");

    day = mergeSchedules(branchA, branchB);
    displaySchedule(day);

    return 0;
}

// --- Provided List Functions ---
void initList(List* L)
{
    L->count = 0;
}

void insertLast(List* L, Appointment a)
{
    //Check if there is enough space to insert.
    if(L->count < MAX){
        L->elems[L->count] = a;
        L->count++;
    }
}

// --- Helper Function ---
int minutesOf(Time t)
{
    return t.hour * 60 + t.minute;
}

// --- Your Implementation ---
List mergeSchedules(List A, List B)
{

}

// --- Input Function ---
void readBranch(List* L, char* clinic)
{
    int n, i;
    Appointment a;

    printf("Appointments at %s (0-5): ", clinic);
    scanf("%d", &n);

    //Each branch enters its appointments earliest first.
    for(i = 0; i < n && i < 5; i++){
        printf("Appointment %d (Patient HH MM): ", i + 1);
        scanf("%15s %d %d", a.patient, &a.time.hour, &a.time.minute);
        strcpy(a.clinic, clinic);
        insertLast(L, a);
    }
}

// --- Display Function ---
void displaySchedule(List L)
{
    int i;
    if(L.count == 0){
        printf("\nNo appointments today.\n");
        return;
    }

    printf("\n=== DAY SCHEDULE (%d) ===\n", L.count);
    for(i = 0; i < L.count; i++){
        printf("%d. %02d:%02d %s (%s)\n", i + 1, L.elems[i].time.hour, L.elems[i].time.minute,
               L.elems[i].patient, L.elems[i].clinic);
    }
}
