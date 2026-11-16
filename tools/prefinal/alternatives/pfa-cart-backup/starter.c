#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#define MAX 10

typedef struct{
    char code[6];
    char name[20];
    int qty;
    int price;
}Item;

typedef struct{
    Item elems[MAX];
    int count;
}List, *ListV2;

// --- Function Prototypes ---
void initListV2(ListV2* L);
void insertLastV2(ListV2 L, Item it);
void deleteItemV2(ListV2 L, char* code);
ListV2 copyCart(ListV2 L);
void loadCart(ListV2 L);
void processRemovals(ListV2 L);
void displayCart(ListV2 L, char* label);

int main(void)
{
    // 1. Variable Declarations
    ListV2 cart = NULL, backup = NULL;

    // 2. Function Calls
    initListV2(&cart);
    if(cart == NULL){
        printf("Unable to open the cart.\n");
        return 1;
    }

    loadCart(cart);
    backup = copyCart(cart);
    if(backup == NULL){
        printf("Unable to back up the cart.\n");
        free(cart);
        return 1;
    }

    processRemovals(cart);
    displayCart(cart, "CART NOW");
    displayCart(backup, "BACKUP");

    // 3. Cleanup
    free(cart);
    free(backup);

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

void insertLastV2(ListV2 L, Item it)
{
    //Check if there is enough space to insert.
    if(L->count < MAX){
        L->elems[L->count] = it;
        L->count++;
    }
}

void deleteItemV2(ListV2 L, char* code)
{
    if(L->count > 0){
        int i;
        /* stops at the index holding code, or at the end of the list */
        for(i = 0; i < L->count && strcmp(L->elems[i].code, code) != 0; i++){}
        if(i < L->count){                   /* found - close the gap at i */
            L->count--;
            memmove(L->elems+i, L->elems+i+1, sizeof(Item) * (L->count-i));
        }
    }
}

// --- Your Implementation ---
ListV2 copyCart(ListV2 L)
{

}

// --- Input Functions ---
void loadCart(ListV2 L)
{
    Item picked[6] = {
        {"G-01", "Rice 5kg", 1, 280},
        {"G-02", "Eggs (dozen)", 2, 95},
        {"G-03", "Milk 1L", 3, 92},
        {"G-04", "Bread", 2, 65},
        {"G-05", "Coffee", 1, 185},
        {"G-06", "Bananas", 1, 70}
    };
    int i;

    for(i = 0; i < 6; i++){
        insertLastV2(L, picked[i]);
    }
}

void processRemovals(ListV2 L)
{
    int n, i;
    char code[6];

    printf("Items to remove: ");
    scanf("%d", &n);

    for(i = 0; i < n; i++){
        printf("Code %d: ", i + 1);
        scanf("%5s", code);
        deleteItemV2(L, code);
    }
}

// --- Display Function ---
void displayCart(ListV2 L, char* label)
{
    int i, total = 0;
    for(i = 0; i < L->count; i++){
        total += L->elems[i].qty * L->elems[i].price;
    }

    printf("\n=== %s (%d items, P%d) ===\n", label, L->count, total);
    for(i = 0; i < L->count; i++){
        printf("%d. [%s] %s x%d @ P%d\n", i + 1, L->elems[i].code, L->elems[i].name,
               L->elems[i].qty, L->elems[i].price);
    }
}
