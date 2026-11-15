#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#define MAX 10

typedef enum{
    REGULAR,
    VIP
}TicketType;

typedef struct{
    char first[16];
    char last[16];
}FullName;

typedef struct{
    char code[10];
    TicketType type;
}Ticket;

typedef struct{
    FullName name;
    Ticket ticket;
}Fan;

typedef struct{
    Fan elems[MAX];
    int count;
}List;

// --- Function Prototypes ---
void initList(List* L);
int queueFan(List* L, Fan f);
void loadEarlyFans(List* L);
void processArrivals(List* L);
void displayLine(List L);

int main(void)
{
    // 1. Variable Declarations
    List gateLine;

    // 2. Function Calls
    initList(&gateLine);
    loadEarlyFans(&gateLine);
    processArrivals(&gateLine);
    displayLine(gateLine);

    return 0;
}

// --- Provided List Function ---
void initList(List* L)
{
    L->count = 0;
}

// --- Your Implementation ---
int queueFan(List* L, Fan f)
{

}

// --- Input Functions ---
void loadEarlyFans(List* L)
{
    //Fans who were already at the gate, in the order they arrived.
    Fan early[6] = {
        {{"Ana", "Reyes"}, {"T-2001", REGULAR}},
        {{"Ben", "Santos"}, {"T-2002", REGULAR}},
        {{"Cara", "Lim"}, {"T-2003", VIP}},
        {{"Dan", "Uy"}, {"T-2004", REGULAR}},
        {{"Eli", "Tan"}, {"T-2005", VIP}},
        {{"Faye", "Go"}, {"T-2006", REGULAR}}
    };
    int k, i;

    printf("Fans already in line (0-6): ");
    scanf("%d", &k);

    for(i = 0; i < k && i < 6; i++){
        queueFan(L, early[i]);
    }
}

void processArrivals(List* L)
{
    int n, i, type, result;
    Fan f;

    printf("Number of arriving fans: ");
    scanf("%d", &n);

    for(i = 0; i < n; i++){
        printf("Fan %d (Code First Last Type[0 - Regular, 1 - VIP]): ", i + 1);
        scanf("%9s %15s %15s %d", f.ticket.code, f.name.first, f.name.last, &type);
        f.ticket.type = (TicketType)type;

        result = queueFan(L, f);
        if(result == 1){
            printf("%s %s (%s) joined the line.\n", f.name.first, f.name.last, f.ticket.code);
        } else if(result == 0){
            printf("Line is full. %s %s (%s) was turned away.\n", f.name.first, f.name.last, f.ticket.code);
        } else {
            printf("Ticket %s was already scanned. %s %s was turned away.\n", f.ticket.code, f.name.first, f.name.last);
        }
    }
}

// --- Display Function ---
void displayLine(List L)
{
    int i;
    if(L.count == 0){
        printf("\nThe gate line is empty.\n");
        return;
    }

    printf("\n=== GATE LINE (%d/%d) ===\n", L.count, MAX);
    for(i = 0; i < L.count; i++){
        printf("%d. [%s] %s - %s, %s\n", i + 1,
               (L.elems[i].ticket.type == VIP) ? "VIP" : "REG",
               L.elems[i].ticket.code, L.elems[i].name.last, L.elems[i].name.first);
    }
}
