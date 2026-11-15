/* The teacher's own ADT List (array) implementation, Version 1 and Version 2.
 * Every tools/prefinal/<id>/answer.c is written to match it:
 *   - memmove for every shift: sizeof(type) * (count - i)
 *   - an empty-body for loop to search: for(i = 0; i < count && <not it>; i++){}
 *   - the space check wraps the insert: if(L->count < MAX){ ... }
 *   - deleting: count-- first, then memmove(elems+i, elems+i+1, ... (count-i))
 *   - one return at the end (a result variable, or a ternary), no break
 *   - V1 takes List* (L->...), V2 takes ListV2 as-is, V3 reaches elemPtr
 * Not built: build-prefinal.js only reads the folders beside this file. */

#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#define MAX 10

/*
 * ADT List - Array Implementation
 * Version 1: List is a structure containing an array and a count.
 * Version 2: List is a POINTER to a structure containing an array and a count.
 */
typedef struct{
    int elems[MAX];
    int count;
}List, *ListV2;

// --- Function Prototypes ---
// Version 1
void initList(List* L);
void insertSorted(List* L, int data);
void insertFirst(List* L, int data);
void insertLast(List* L, int data);
void deleteFirst(List* L);
void deleteLast(List* L);
void deleteElem(List* L, int data);
int search(List L, int data);

// Version 2
void initListV2(ListV2* L);
void insertSortedV2(ListV2 L, int data);
void insertFirstV2(ListV2 L, int data);
void insertLastV2(ListV2 L, int data);
void deleteFirstV2(ListV2 L);
void deleteLastV2(ListV2 L);
void deleteElemV2(ListV2 L, int data);
int searchV2(ListV2 L, int data);
void freeListV2(ListV2* L);

// Shared
void displayList(List L);

int main(void)
{
    // ===================== VERSION 1 =====================
    List nums;
    initList(&nums);

    printf("=== VERSION 1 ===\n");
    insertSorted(&nums, 12);
    insertSorted(&nums, 3);
    insertSorted(&nums, 17);
    insertSorted(&nums, 5);
    printf("After insertSorted 12, 3, 17, 5:\n");
    displayList(nums);

    insertFirst(&nums, 99);
    insertLast(&nums, 42);
    printf("After insertFirst 99 and insertLast 42:\n");
    displayList(nums);

    printf("search 17 -> index %d\n", search(nums, 17));
    printf("search 8  -> index %d\n", search(nums, 8));

    deleteFirst(&nums);
    deleteLast(&nums);
    deleteElem(&nums, 5);
    printf("After deleteFirst, deleteLast, deleteElem 5:\n");
    displayList(nums);

    // ===================== VERSION 2 =====================
    ListV2 listTwo;
    initListV2(&listTwo);

    printf("\n=== VERSION 2 ===\n");
    insertSortedV2(listTwo, 11);
    insertSortedV2(listTwo, 1);
    insertSortedV2(listTwo, 4);
    insertSortedV2(listTwo, 17);
    printf("After insertSortedV2 11, 1, 4, 17:\n");
    displayList(*listTwo);

    insertFirstV2(listTwo, 99);
    insertLastV2(listTwo, 42);
    printf("After insertFirstV2 99 and insertLastV2 42:\n");
    displayList(*listTwo);

    printf("searchV2 4  -> index %d\n", searchV2(listTwo, 4));
    printf("searchV2 8  -> index %d\n", searchV2(listTwo, 8));

    deleteFirstV2(listTwo);
    deleteLastV2(listTwo);
    deleteElemV2(listTwo, 11);
    printf("After deleteFirstV2, deleteLastV2, deleteElemV2 11:\n");
    displayList(*listTwo);

    freeListV2(&listTwo);

    return 0;
}

/* =====================================================================
 *                              VERSION 1
 *  L is a List* so the functions can change the caller's list.
 *  Members are accessed with ->   (L->count, L->elems[i])
 * ===================================================================== */

void initList(List* L)
{
    L->count = 0;
}

void insertSorted(List* L, int data)
{
    //Check if there is enough space to insert.
    if(L->count < MAX){
        int i;
        //Find the correct index for insertion.
        for(i = 0; i < L->count && L->elems[i] < data; i++){}

        //Shift elements down.
        if(i < L->count){
            memmove(L->elems+i+1, L->elems+i, sizeof(int) * (L->count-i));
        }
        //Insert.
        L->elems[i] = data;
        L->count++;
    }
}

void insertFirst(List* L, int data)
{
    //Check if there is enough space to insert.
    if(L->count < MAX){
        //Shift ALL elements down by one to free index 0.
        memmove(L->elems+1, L->elems, sizeof(int) * L->count);
        //Insert.
        L->elems[0] = data;
        L->count++;
    }
}

void insertLast(List* L, int data)
{
    //Check if there is enough space to insert.
    if(L->count < MAX){
        //No shifting needed: the next free slot is at index count.
        L->elems[L->count] = data;
        L->count++;
    }
}

void deleteFirst(List* L)
{
    if(L->count > 0){
        L->count--;
        //Shift ALL remaining elements up by one to close the gap at index 0.
        memmove(L->elems, L->elems+1, sizeof(int) * L->count);
    }
}

void deleteLast(List* L)
{
    if(L->count > 0){
        //No shifting needed: just forget the last element.
        L->count--;
    }
}

void deleteElem(List* L, int data)
{
    if(L->count > 0){
        int i;
        /* stops at the index holding data, or at the end of the list */
        for(i = 0; i < L->count && L->elems[i] != data; i++){}
        if(i < L->count){                   /* found - close the gap at i */
            L->count--;
            memmove(L->elems+i, L->elems+i+1, sizeof(int) * (L->count-i));
        }
    }
}

int search(List L, int data)
{
    int i;
    /* stops at the index holding data, or at the end of the list */
    for(i = 0; i < L.count && L.elems[i] != data; i++){}

    return (i < L.count) ? i : -1;          /* -1 means not found */
}

/* =====================================================================
 *                              VERSION 2
 *  ListV2 is ALREADY a pointer, so L is passed as-is and changes still
 *  reach the caller. Only initListV2 and freeListV2 need a ListV2*,
 *  because they change the pointer itself.
 * ===================================================================== */

void initListV2(ListV2* L)
{
    *L = malloc(sizeof(List));
    if(*L != NULL){
        (*L)->count = 0;
    }
}

void insertSortedV2(ListV2 L, int data)
{
    //Check if there is enough space to insert.
    if(L->count < MAX){
        int i;
        //Find the correct index for insertion.
        for(i = 0; i < L->count && L->elems[i] < data; i++){}

        //Shift elements down.
        if(i < L->count){
            memmove(L->elems+i+1, L->elems+i, sizeof(int) * (L->count-i));
        }
        //Insert.
        L->elems[i] = data;
        L->count++;
    }
}

void insertFirstV2(ListV2 L, int data)
{
    //Check if there is enough space to insert.
    if(L->count < MAX){
        //Shift ALL elements down by one to free index 0.
        memmove(L->elems+1, L->elems, sizeof(int) * L->count);
        //Insert.
        L->elems[0] = data;
        L->count++;
    }
}

void insertLastV2(ListV2 L, int data)
{
    //Check if there is enough space to insert.
    if(L->count < MAX){
        //No shifting needed: the next free slot is at index count.
        L->elems[L->count] = data;
        L->count++;
    }
}

void deleteFirstV2(ListV2 L)
{
    if(L->count > 0){
        L->count--;
        //Shift ALL remaining elements up by one to close the gap at index 0.
        memmove(L->elems, L->elems+1, sizeof(int) * L->count);
    }
}

void deleteLastV2(ListV2 L)
{
    if(L->count > 0){
        //No shifting needed: just forget the last element.
        L->count--;
    }
}

void deleteElemV2(ListV2 L, int data)
{
    if(L->count > 0){
        int i;
        /* stops at the index holding data, or at the end of the list */
        for(i = 0; i < L->count && L->elems[i] != data; i++){}
        if(i < L->count){                   /* found - close the gap at i */
            L->count--;
            memmove(L->elems+i, L->elems+i+1, sizeof(int) * (L->count-i));
        }
    }
}

int searchV2(ListV2 L, int data)
{
    int i;
    /* stops at the index holding data, or at the end of the list */
    for(i = 0; i < L->count && L->elems[i] != data; i++){}

    return (i < L->count) ? i : -1;         /* -1 means not found */
}

void freeListV2(ListV2* L)
{
    free(*L);
    *L = NULL;
}

/* =====================================================================
 *                               SHARED
 *  Version 2 calls this with displayList(*listTwo).
 * ===================================================================== */

void displayList(List L)
{
    int i;
    for(i = 0; i < L.count; i++){
        printf("L.elem[%d]: %d\n", i, L.elems[i]);
    }
}
