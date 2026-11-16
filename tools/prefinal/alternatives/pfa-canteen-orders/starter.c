#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#define MAX 10

typedef struct{
    int orderNo;
    char dish[16];
    char customer[16];
}Order;

typedef struct{
    Order elems[MAX];
    int count;
}List, *ListV2;

// --- Function Prototypes ---
void initListV2(ListV2* L);
void insertLastV2(ListV2 L, Order o);
Order serveDish(ListV2 L, char* dish);
void loadOrders(ListV2 L);
void processServing(ListV2 L);
void displayOrders(ListV2 L);

int main(void)
{
    // 1. Variable Declarations
    ListV2 orders = NULL;

    // 2. Function Calls
    initListV2(&orders);
    if(orders == NULL){
        printf("Unable to open the order list.\n");
        return 1;
    }

    loadOrders(orders);
    processServing(orders);
    displayOrders(orders);

    // 3. Cleanup
    free(orders);

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

void insertLastV2(ListV2 L, Order o)
{
    //Check if there is enough space to insert.
    if(L->count < MAX){
        L->elems[L->count] = o;
        L->count++;
    }
}

// --- Your Implementation ---
Order serveDish(ListV2 L, char* dish)
{

}

// --- Input Functions ---
void loadOrders(ListV2 L)
{
    //Pending orders, oldest first.
    Order pending[8] = {
        {101, "Adobo", "Lito"},
        {102, "Sinigang", "Marj"},
        {103, "Adobo", "Noel"},
        {104, "Pancit", "Olive"},
        {105, "Lechon", "Pia"},
        {106, "Sinigang", "Quin"},
        {107, "Adobo", "Rosa"},
        {108, "Lumpia", "Sid"}
    };
    int k, i;

    printf("Pending orders (0-8): ");
    scanf("%d", &k);

    for(i = 0; i < k && i < 8; i++){
        insertLastV2(L, pending[i]);
    }
}

void processServing(ListV2 L)
{
    int n, i;
    char dish[16];
    Order served;

    printf("Dishes ready: ");
    scanf("%d", &n);

    for(i = 0; i < n; i++){
        printf("Dish %d: ", i + 1);
        scanf("%15s", dish);

        served = serveDish(L, dish);
        if(served.orderNo == 0){
            printf("No pending order for %s.\n", dish);
        } else {
            printf("Order #%d (%s) served to %s.\n", served.orderNo, served.dish, served.customer);
        }
    }
}

// --- Display Function ---
void displayOrders(ListV2 L)
{
    int i;
    if(L->count == 0){
        printf("\nNo pending orders.\n");
        return;
    }

    printf("\n=== PENDING ORDERS (%d) ===\n", L->count);
    for(i = 0; i < L->count; i++){
        printf("%d. #%d %s - %s\n", i + 1, L->elems[i].orderNo, L->elems[i].dish, L->elems[i].customer);
    }
}
