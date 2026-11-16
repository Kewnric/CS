#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#define MAX 10

typedef struct{
    char isbn[14];
    char title[32];
    char author[16];
}Book;

typedef struct{
    Book elems[MAX];
    int count;
}List;

// --- Function Prototypes ---
void initList(List* L);
void insertLast(List* L, Book b);
int locateBook(List L, char* isbn);
void loadShelf(List* L);
void processLookups(List* L);
void displayShelf(List L);

int main(void)
{
    // 1. Variable Declarations
    List shelf;

    // 2. Function Calls
    initList(&shelf);
    loadShelf(&shelf);
    processLookups(&shelf);
    displayShelf(shelf);

    return 0;
}

// --- Provided List Functions ---
void initList(List* L)
{
    L->count = 0;
}

void insertLast(List* L, Book b)
{
    //Check if there is enough space to insert.
    if(L->count < MAX){
        L->elems[L->count] = b;
        L->count++;
    }
}

// --- Your Implementation ---
int locateBook(List L, char* isbn)
{

}

// --- Input Functions ---
void loadShelf(List* L)
{
    //Books on the shelf, slot 1 first.
    Book stock[8] = {
        {"9780000000011", "Learn C in 30 Days", "R. Santos"},
        {"9780000000028", "Data Structures Made Easy", "M. Cruz"},
        {"9780000000035", "Discrete Math Notes", "A. Lim"},
        {"9780000000042", "Calculus Volume 1", "J. Reyes"},
        {"9780000000059", "Physics for Engineers", "K. Tan"},
        {"9780000000066", "Philippine History", "L. Go"},
        {"9780000000073", "Basic Accounting", "P. Uy"},
        {"9780000000080", "General Biology", "S. Co"}
    };
    int k, i;

    printf("Books on the shelf (0-8): ");
    scanf("%d", &k);

    for(i = 0; i < k && i < 8; i++){
        insertLast(L, stock[i]);
    }
}

void processLookups(List* L)
{
    int n, i, slot;
    char isbn[14];

    printf("Number of lookups: ");
    scanf("%d", &n);

    for(i = 0; i < n; i++){
        printf("ISBN %d: ", i + 1);
        scanf("%13s", isbn);

        slot = locateBook(*L, isbn);
        if(slot > 0){
            printf("Slot %d: %s by %s.\n", slot, L->elems[slot - 1].title, L->elems[slot - 1].author);
        } else {
            printf("%s is not on the shelf.\n", isbn);
        }
    }
}

// --- Display Function ---
void displayShelf(List L)
{
    int i;
    if(L.count == 0){
        printf("\nThe shelf is empty.\n");
        return;
    }

    printf("\n=== SHELF (%d books) ===\n", L.count);
    for(i = 0; i < L.count; i++){
        printf("%d. [%s] %s - %s\n", i + 1, L.elems[i].isbn, L.elems[i].title, L.elems[i].author);
    }
}
