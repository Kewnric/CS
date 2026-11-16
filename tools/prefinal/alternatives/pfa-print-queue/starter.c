#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#define MAX 8

typedef struct{
    char owner[16];
    char docName[24];
    int pages;
}PrintJob;

typedef struct{
    PrintJob elems[MAX];
    int count;
}List, *ListV2;

// --- Function Prototypes ---
void initListV2(ListV2* L);
void insertLastV2(ListV2 L, PrintJob job);
PrintJob printNext(ListV2 L);
void loadQueue(ListV2 L);
void processPrinting(ListV2 L);
void displayQueue(ListV2 L);

int main(void)
{
    // 1. Variable Declarations
    ListV2 queue = NULL;

    // 2. Function Calls
    initListV2(&queue);
    if(queue == NULL){
        printf("Unable to open the print queue.\n");
        return 1;
    }

    loadQueue(queue);
    processPrinting(queue);
    displayQueue(queue);

    // 3. Cleanup
    free(queue);

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

void insertLastV2(ListV2 L, PrintJob job)
{
    //Check if there is enough space to insert.
    if(L->count < MAX){
        L->elems[L->count] = job;
        L->count++;
    }
}

// --- Your Implementation ---
PrintJob printNext(ListV2 L)
{

}

// --- Input Functions ---
void loadQueue(ListV2 L)
{
    //Jobs sent to the printer, in the order they were sent.
    PrintJob sent[6] = {
        {"Ana", "Thesis_Final", 48},
        {"Ben", "Resume", 2},
        {"Cris", "Lab_Report", 12},
        {"Dina", "Poster", 1},
        {"Ely", "Reviewer", 20},
        {"Faye", "Letter", 1}
    };
    int k, i;

    printf("Jobs in the queue (0-6): ");
    scanf("%d", &k);

    for(i = 0; i < k && i < 6; i++){
        insertLastV2(L, sent[i]);
    }
}

void processPrinting(ListV2 L)
{
    int n, i;
    PrintJob job;

    printf("Jobs to print: ");
    scanf("%d", &n);

    for(i = 0; i < n; i++){
        job = printNext(L);
        if(job.pages == 0){
            printf("Printer idle: the queue is empty.\n");
        } else {
            printf("Printed %s for %s (%d page(s)).\n", job.docName, job.owner, job.pages);
        }
    }
}

// --- Display Function ---
void displayQueue(ListV2 L)
{
    int i;
    if(L->count == 0){
        printf("\nThe print queue is empty.\n");
        return;
    }

    printf("\n=== PRINT QUEUE (%d) ===\n", L->count);
    for(i = 0; i < L->count; i++){
        printf("%d. %s - %s, %d page(s)\n", i + 1, L->elems[i].owner, L->elems[i].docName,
               L->elems[i].pages);
    }
}
