#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#define MAX 10

typedef struct{
    char code[6];
    char name[20];
    int price;
    int stock;
}Product;

typedef struct{
    Product elems[MAX];
    int count;
}List;

// --- Function Prototypes ---
void initList(List* L);
void insertLast(List* L, Product p);
int adjustStock(List* L, char* code, int change);
void loadInventory(List* L);
void processAdjustments(List* L);
void displayInventory(List L);

int main(void)
{
    // 1. Variable Declarations
    List inventory;

    // 2. Function Calls
    initList(&inventory);
    loadInventory(&inventory);
    processAdjustments(&inventory);
    displayInventory(inventory);

    return 0;
}

// --- Provided List Functions ---
void initList(List* L)
{
    L->count = 0;
}

void insertLast(List* L, Product p)
{
    //Check if there is enough space to insert.
    if(L->count < MAX){
        L->elems[L->count] = p;
        L->count++;
    }
}

// --- Your Implementation ---
int adjustStock(List* L, char* code, int change)
{

}

// --- Input Functions ---
void loadInventory(List* L)
{
    Product shelf[6] = {
        {"P-101", "Instant Noodles", 15, 40},
        {"P-102", "Canned Sardines", 28, 25},
        {"P-103", "Coffee Sachet", 9, 60},
        {"P-104", "Bath Soap", 35, 12},
        {"P-105", "Rice 1kg", 55, 8},
        {"P-106", "Cooking Oil", 72, 5}
    };
    int i;

    for(i = 0; i < 6; i++){
        insertLast(L, shelf[i]);
    }
}

void processAdjustments(List* L)
{
    int n, i, change, result;
    char code[6];

    printf("Number of adjustments: ");
    scanf("%d", &n);

    for(i = 0; i < n; i++){
        printf("Adjustment %d (Code Change): ", i + 1);
        scanf("%5s %d", code, &change);

        result = adjustStock(L, code, change);
        if(result >= 0){
            printf("%s now has %d in stock. [index %d]\n", L->elems[result].name,
                   L->elems[result].stock, result);
        } else if(result == -1){
            printf("No product %s.\n", code);
        } else {
            printf("Not enough stock of %s for that sale.\n", code);
        }
    }
}

// --- Display Function ---
void displayInventory(List L)
{
    int i;
    printf("\n=== INVENTORY (%d) ===\n", L.count);
    for(i = 0; i < L.count; i++){
        printf("%d. [%s] %s - P%d x %d\n", i + 1, L.elems[i].code, L.elems[i].name,
               L.elems[i].price, L.elems[i].stock);
    }
}
