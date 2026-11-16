#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#define MAX 6

typedef struct{
    char idNo[10];
    char name[16];
    char course[8];
}Member;

typedef struct{
    Member elems[MAX];
    int count;
}List;

// --- Function Prototypes ---
void initList(List* L);
int signUp(List* L, Member m);
void loadFoundingMembers(List* L);
void processSignUps(List* L);
void displayMembers(List L);

int main(void)
{
    // 1. Variable Declarations
    List members;

    // 2. Function Calls
    initList(&members);
    loadFoundingMembers(&members);
    processSignUps(&members);
    displayMembers(members);

    return 0;
}

// --- Provided List Function ---
void initList(List* L)
{
    L->count = 0;
}

// --- Your Implementation ---
int signUp(List* L, Member m)
{

}

// --- Input Functions ---
void loadFoundingMembers(List* L)
{
    Member founders[4] = {
        {"22101001", "Aiza", "BSCS"},
        {"22101002", "Bryan", "BSIT"},
        {"22101003", "Cathy", "BSIS"},
        {"22101004", "Dennis", "BSCS"}
    };
    int k, i;

    printf("Founding members (0-4): ");
    scanf("%d", &k);

    for(i = 0; i < k && i < 4; i++){
        signUp(L, founders[i]);
    }
}

void processSignUps(List* L)
{
    int n, i, result;
    Member m;

    printf("Number of sign-ups: ");
    scanf("%d", &n);

    for(i = 0; i < n; i++){
        printf("Sign-up %d (ID Name Course): ", i + 1);
        scanf("%9s %15s %7s", m.idNo, m.name, m.course);

        result = signUp(L, m);
        if(result == 1){
            printf("%s (%s) joined the org.\n", m.name, m.idNo);
        } else if(result == 0){
            printf("Membership is full. %s (%s) was not added.\n", m.name, m.idNo);
        } else {
            printf("%s is already a member.\n", m.idNo);
        }
    }
}

// --- Display Function ---
void displayMembers(List L)
{
    int i;
    if(L.count == 0){
        printf("\nThe org has no members yet.\n");
        return;
    }

    printf("\n=== ORG MEMBERS (%d/%d) ===\n", L.count, MAX);
    for(i = 0; i < L.count; i++){
        printf("%d. [%s] %s - %s\n", i + 1, L.elems[i].idNo, L.elems[i].name, L.elems[i].course);
    }
}
