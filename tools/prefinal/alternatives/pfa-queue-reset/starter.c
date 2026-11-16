#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#define MAX 8

typedef struct{
    int number;
    char name[16];
    char service[12];
}Ticket;

typedef struct{
    Ticket elems[MAX];
    int count;
}List;

// --- Function Prototypes ---
void initList(List* L);
void insertLast(List* L, Ticket t);
int makeNull(List* L);
void loadTickets(List* L);
void readNextMorning(List* L);
void displayQueue(List L, char* label);

int main(void)
{
    // 1. Variable Declarations
    List queue;
    int cleared;

    // 2. Function Calls
    initList(&queue);
    loadTickets(&queue);
    displayQueue(queue, "BEFORE CLOSING");

    cleared = makeNull(&queue);
    printf("Cleared %d ticket(s).\n", cleared);
    displayQueue(queue, "AFTER CLOSING");

    readNextMorning(&queue);
    displayQueue(queue, "NEXT MORNING");

    return 0;
}

// --- Provided List Functions ---
void initList(List* L)
{
    L->count = 0;
}

void insertLast(List* L, Ticket t)
{
    //Check if there is enough space to insert.
    if(L->count < MAX){
        L->elems[L->count] = t;
        L->count++;
    }
}

// --- Your Implementation ---
int makeNull(List* L)
{

}

// --- Input Functions ---
void loadTickets(List* L)
{
    //Tickets still waiting at closing time.
    Ticket waiting[6] = {
        {41, "Arturo", "Deposit"},
        {42, "Belen", "Withdraw"},
        {43, "Carding", "Inquiry"},
        {44, "Dolor", "Deposit"},
        {45, "Ernie", "Loan"},
        {46, "Fely", "Withdraw"}
    };
    int k, i;

    printf("Tickets waiting at closing (0-6): ");
    scanf("%d", &k);

    for(i = 0; i < k && i < 6; i++){
        insertLast(L, waiting[i]);
    }
}

void readNextMorning(List* L)
{
    int n, i;
    Ticket t;

    printf("Customers next morning: ");
    scanf("%d", &n);

    for(i = 0; i < n; i++){
        t.number = i + 1;
        printf("Customer %d (Name Service): ", i + 1);
        scanf("%15s %11s", t.name, t.service);
        insertLast(L, t);
    }
}

// --- Display Function ---
void displayQueue(List L, char* label)
{
    int i;
    printf("\n=== %s (%d) ===\n", label, L.count);
    for(i = 0; i < L.count; i++){
        printf("%d. Ticket %d - %s (%s)\n", i + 1, L.elems[i].number, L.elems[i].name, L.elems[i].service);
    }
}
