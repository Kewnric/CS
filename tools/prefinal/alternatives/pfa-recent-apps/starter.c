#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#define MAX 8

typedef struct{
    char name[16];
    char developer[16];
    int sizeMB;
}App;

typedef struct{
    App elems[MAX];
    int count;
}List;

// --- Function Prototypes ---
void initList(List* L);
void insertLast(List* L, App a);
int openApp(List* L, char* name);
void loadApps(List* L);
void processOpens(List* L);
void displayApps(List L);

int main(void)
{
    // 1. Variable Declarations
    List recent;

    // 2. Function Calls
    initList(&recent);
    loadApps(&recent);
    processOpens(&recent);
    displayApps(recent);

    return 0;
}

// --- Provided List Functions ---
void initList(List* L)
{
    L->count = 0;
}

void insertLast(List* L, App a)
{
    //Check if there is enough space to insert.
    if(L->count < MAX){
        L->elems[L->count] = a;
        L->count++;
    }
}

// --- Your Implementation ---
int openApp(List* L, char* name)
{

}

// --- Input Functions ---
void loadApps(List* L)
{
    //Apps in the switcher, most recently used first.
    App installed[6] = {
        {"ChatNow", "Kwento", 320},
        {"PayGo", "Bayad", 180},
        {"TuneBox", "Himig", 150},
        {"ClassHub", "Aral", 90},
        {"RideX", "Byahe", 210},
        {"ShopLa", "Tinda", 160}
    };
    int k, i;

    printf("Apps in the switcher (0-6): ");
    scanf("%d", &k);

    for(i = 0; i < k && i < 6; i++){
        insertLast(L, installed[i]);
    }
}

void processOpens(List* L)
{
    int n, i, was;
    char name[16];

    printf("Apps opened: ");
    scanf("%d", &n);

    for(i = 0; i < n; i++){
        printf("App %d: ", i + 1);
        scanf("%15s", name);

        was = openApp(L, name);
        if(was > 0){
            printf("%s moved to the front (was #%d).\n", name, was);
        } else {
            printf("%s is not in the switcher.\n", name);
        }
    }
}

// --- Display Function ---
void displayApps(List L)
{
    int i;
    if(L.count == 0){
        printf("\nNo recent apps.\n");
        return;
    }

    printf("\n=== RECENT APPS (%d) ===\n", L.count);
    for(i = 0; i < L.count; i++){
        printf("%d. %s by %s (%d MB)\n", i + 1, L.elems[i].name, L.elems[i].developer, L.elems[i].sizeMB);
    }
}
