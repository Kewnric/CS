#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#define MAX 10

typedef struct{
    char idNo[10];
    char name[24];
}Borrower;

typedef struct{
    char callNo[16];
    char title[40];
}Book;

typedef struct{
    Borrower borrower;
    Book book;
}Loan;

typedef struct{
    Loan elems[MAX];
    int count;
}List, *ListV2;

// --- Function Prototypes ---
void initListV2(ListV2* L);
void insertLastV2(ListV2 L, Loan ln);
int returnAllBooks(ListV2 L, char* borrowerID);
void loadActiveLoans(ListV2 L);
void processReturns(ListV2 L);
void displayLoans(ListV2 L);

int main(void)
{
    // 1. Variable Declarations
    ListV2 loans = NULL;

    // 2. Function Calls
    initListV2(&loans);
    if(loans == NULL){
        printf("Unable to open the loan records.\n");
        return 1;
    }

    loadActiveLoans(loans);
    processReturns(loans);
    displayLoans(loans);

    // 3. Cleanup
    free(loans);

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

void insertLastV2(ListV2 L, Loan ln)
{
    //Check if there is enough space to insert.
    if(L->count < MAX){
        L->elems[L->count] = ln;
        L->count++;
    }
}

// --- Your Implementation ---
int returnAllBooks(ListV2 L, char* borrowerID)
{

}

// --- Input Functions ---
void loadActiveLoans(ListV2 L)
{
    //Active loans, in the order the books were borrowed.
    Loan active[MAX] = {
        {{"22100451", "Andrea"}, {"QA76.73-C15", "Programming in C"}},
        {{"22100451", "Andrea"}, {"QA76.9-D35", "Data Structures Made Easy"}},
        {{"22100873", "Benjie"}, {"QA39.2-R67", "Discrete Mathematics"}},
        {{"22101102", "Carla"}, {"PL6058-B34", "Mga Kuwentong Bayan"}},
        {{"22100873", "Benjie"}, {"QA303-S77", "Calculus Volume 1"}},
        {{"22100873", "Benjie"}, {"QC21.3-H35", "Fundamentals of Physics"}},
        {{"22101539", "Ella"}, {"DS668-A44", "History of the Philippines"}},
        {{"22100618", "Franco"}, {"HF5635-W43", "Basic Accounting"}},
        {{"22101539", "Ella"}, {"QH308.2-C36", "General Biology"}},
        {{"22100618", "Franco"}, {"HB171.5-M35", "Principles of Economics"}}
    };
    int i;

    for(i = 0; i < MAX; i++){
        insertLastV2(L, active[i]);
    }
}

void processReturns(ListV2 L)
{
    int n, i, removed;
    char id[10];

    printf("Number of borrowers returning books: ");
    scanf("%d", &n);

    for(i = 0; i < n; i++){
        printf("Borrower ID: ");
        scanf("%9s", id);

        removed = returnAllBooks(L, id);
        if(removed > 0){
            printf("%d book(s) returned by %s.\n", removed, id);
        } else {
            printf("No active loans for %s.\n", id);
        }
    }
}

// --- Display Function ---
void displayLoans(ListV2 L)
{
    int i;
    if(L->count == 0){
        printf("\nNo active loans.\n");
        return;
    }

    printf("\n=== ACTIVE LOANS (%d) ===\n", L->count);
    for(i = 0; i < L->count; i++){
        printf("%d. [%s] %s - %s (%s)\n", i + 1, L->elems[i].book.callNo,
               L->elems[i].book.title, L->elems[i].borrower.name, L->elems[i].borrower.idNo);
    }
}
