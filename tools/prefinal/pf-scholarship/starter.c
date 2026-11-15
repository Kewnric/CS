#include <stdio.h>
#include <string.h>
#include <stdlib.h>

typedef struct{
    char idNo[10];
    char name[24];
}StudentInfo;

typedef struct{
    int math;
    int science;
    int english;
}Scores;

typedef struct{
    StudentInfo info;
    Scores scores;
}Applicant;

typedef struct{
    Applicant* elemPtr;
    int count;
    int arrSize;
}ListV3;

// --- Function Prototypes ---
void initListV3(ListV3* L, int size);
int addApplicant(ListV3* L, Applicant a);
void processApplicants(ListV3* L);
void displayShortlist(ListV3 L);
void freeListV3(ListV3* L);

int main(void)
{
    // 1. Variable Declarations
    ListV3 shortlist;
    int slots;

    // 2. Function Calls
    printf("Number of interview slots: ");
    scanf("%d", &slots);

    initListV3(&shortlist, slots);
    if(shortlist.elemPtr == NULL){
        printf("Unable to create the shortlist.\n");
        return 1;
    }

    processApplicants(&shortlist);
    displayShortlist(shortlist);

    // 3. Cleanup
    freeListV3(&shortlist);

    return 0;
}

// --- Provided List Functions ---
void initListV3(ListV3* L, int size)
{
    //Use the requested size; fall back to 1 if the size given is invalid.
    if(size < 1){
        size = 1;
    }
    L->elemPtr = malloc(sizeof(Applicant) * size);
    L->count = 0;
    L->arrSize = (L->elemPtr != NULL) ? size : 0;
}

void freeListV3(ListV3* L)
{
    free(L->elemPtr);
    L->elemPtr = NULL;
    L->count = 0;
    L->arrSize = 0;
}

// --- Your Implementation ---
int addApplicant(ListV3* L, Applicant a)
{

}

// --- Input Function ---
void processApplicants(ListV3* L)
{
    int n, i, result;
    Applicant a;

    printf("Number of applicants: ");
    scanf("%d", &n);

    for(i = 0; i < n; i++){
        printf("Applicant %d (ID Name Math Science English): ", i + 1);
        scanf("%9s %23s %d %d %d", a.info.idNo, a.info.name,
              &a.scores.math, &a.scores.science, &a.scores.english);

        result = addApplicant(L, a);
        if(result == 1){
            printf("%s (%s) added to the shortlist.\n", a.info.name, a.info.idNo);
        } else if(result == 0){
            printf("Shortlist is full. %s (%s) was not added.\n", a.info.name, a.info.idNo);
        } else {
            printf("%s is already on the shortlist.\n", a.info.idNo);
        }
    }
}

// --- Display Function ---
void displayShortlist(ListV3 L)
{
    int i;
    if(L.count == 0){
        printf("\nThe shortlist is empty.\n");
        return;
    }

    printf("\n=== INTERVIEW SHORTLIST (%d/%d) ===\n", L.count, L.arrSize);
    for(i = 0; i < L.count; i++){
        printf("%d. [%s] %s - Math %d, Science %d, English %d = %d\n", i + 1,
               L.elemPtr[i].info.idNo, L.elemPtr[i].info.name,
               L.elemPtr[i].scores.math, L.elemPtr[i].scores.science, L.elemPtr[i].scores.english,
               L.elemPtr[i].scores.math + L.elemPtr[i].scores.science + L.elemPtr[i].scores.english);
    }
}
