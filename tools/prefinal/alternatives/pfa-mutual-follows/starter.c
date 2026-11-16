#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#define MAX 10

typedef struct{
    char handle[16];
    int followers;
}Account;

typedef struct{
    Account elems[MAX];
    int count;
}List, *ListV2;

// --- Function Prototypes ---
void initListV2(ListV2* L);
void insertLastV2(ListV2 L, Account a);
int findAccountV2(ListV2 L, char* handle);
ListV2 mutualFollows(ListV2 A, ListV2 B);
void readFollowing(ListV2 L, char* user);
void displayMutual(ListV2 L);

int main(void)
{
    // 1. Variable Declarations
    ListV2 ria = NULL, sam = NULL, both = NULL;

    // 2. Function Calls
    initListV2(&ria);
    initListV2(&sam);
    if(ria == NULL || sam == NULL){
        printf("Unable to open the follow lists.\n");
        free(ria);
        free(sam);
        return 1;
    }

    readFollowing(ria, "Ria");
    readFollowing(sam, "Sam");

    both = mutualFollows(ria, sam);
    if(both == NULL){
        printf("Unable to create the mutual list.\n");
    } else {
        displayMutual(both);
    }

    // 3. Cleanup
    free(ria);
    free(sam);
    free(both);

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

void insertLastV2(ListV2 L, Account a)
{
    //Check if there is enough space to insert.
    if(L->count < MAX){
        L->elems[L->count] = a;
        L->count++;
    }
}

int findAccountV2(ListV2 L, char* handle)
{
    int i;
    /* stops at the account with this handle, or at the end of the list */
    for(i = 0; i < L->count && strcmp(L->elems[i].handle, handle) != 0; i++){}

    return (i < L->count) ? i : -1;         /* -1 means not found */
}

// --- Your Implementation ---
ListV2 mutualFollows(ListV2 A, ListV2 B)
{

}

// --- Input Function ---
void readFollowing(ListV2 L, char* user)
{
    int n, i;
    Account a;

    printf("Accounts %s follows (0-8): ", user);
    scanf("%d", &n);

    for(i = 0; i < n && i < 8; i++){
        printf("Account %d (Handle Followers): ", i + 1);
        scanf("%15s %d", a.handle, &a.followers);
        insertLastV2(L, a);
    }
}

// --- Display Function ---
void displayMutual(ListV2 L)
{
    int i;
    if(L->count == 0){
        printf("\nYou have no follows in common.\n");
        return;
    }

    printf("\n=== YOU BOTH FOLLOW (%d) ===\n", L->count);
    for(i = 0; i < L->count; i++){
        printf("%d. @%s (%d followers)\n", i + 1, L->elems[i].handle, L->elems[i].followers);
    }
}
