#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#define MAX 5

typedef struct{
    char name[16];
    char number[12];
}Contact;

typedef struct{
    Contact contact;
    int minutes;
}Call;

typedef struct{
    Call elems[MAX];
    int count;
}List;

// --- Function Prototypes ---
void initList(List* L);
int logCall(List* L, Call c);
void loadEarlyCalls(List* L);
void processCalls(List* L);
void displayCalls(List L);

int main(void)
{
    // 1. Variable Declarations
    List recent;

    // 2. Function Calls
    initList(&recent);
    loadEarlyCalls(&recent);
    processCalls(&recent);
    displayCalls(recent);

    return 0;
}

// --- Provided List Function ---
void initList(List* L)
{
    L->count = 0;
}

// --- Your Implementation ---
int logCall(List* L, Call c)
{

}

// --- Input Functions ---
void loadEarlyCalls(List* L)
{
    //Calls made earlier today, oldest first.
    Call early[5] = {
        {{"Mama", "09171110001"}, 12},
        {{"Kuya", "09181110002"}, 3},
        {{"Boss", "09191110003"}, 25},
        {{"Lola", "09201110004"}, 40},
        {{"Jessa", "09211110005"}, 7}
    };
    int k, i;

    printf("Calls already in the log (0-5): ");
    scanf("%d", &k);

    for(i = 0; i < k && i < 5; i++){
        logCall(L, early[i]);
    }
}

void processCalls(List* L)
{
    int n, i, result;
    Call c;

    printf("Number of new calls: ");
    scanf("%d", &n);

    for(i = 0; i < n; i++){
        printf("Call %d (Name Number Minutes): ", i + 1);
        scanf("%15s %11s %d", c.contact.name, c.contact.number, &c.minutes);

        result = logCall(L, c);
        if(result == 1){
            printf("Logged a call with %s.\n", c.contact.name);
        } else {
            printf("Logged a call with %s. The oldest call was dropped.\n", c.contact.name);
        }
    }
}

// --- Display Function ---
void displayCalls(List L)
{
    int i;
    if(L.count == 0){
        printf("\nNo recent calls.\n");
        return;
    }

    printf("\n=== RECENT CALLS (%d/%d) ===\n", L.count, MAX);
    for(i = 0; i < L.count; i++){
        printf("%d. %s (%s) - %d min\n", i + 1, L.elems[i].contact.name,
               L.elems[i].contact.number, L.elems[i].minutes);
    }
}
