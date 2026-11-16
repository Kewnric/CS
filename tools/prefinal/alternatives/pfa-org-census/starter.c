#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#define MAX 10

typedef struct{
    char idNo[10];
    char name[16];
    char course[8];
    int yearLevel;
}Member;

typedef struct{
    Member elems[MAX];
    int count;
}List, *ListV2;

// --- Function Prototypes ---
void initListV2(ListV2* L);
void insertLastV2(ListV2 L, Member m);
int countMembers(ListV2 L, char* course, int year);
void loadMembers(ListV2 L);
void processQueries(ListV2 L);

int main(void)
{
    // 1. Variable Declarations
    ListV2 members = NULL;

    // 2. Function Calls
    initListV2(&members);
    if(members == NULL){
        printf("Unable to open the member list.\n");
        return 1;
    }

    loadMembers(members);
    processQueries(members);

    // 3. Cleanup
    free(members);

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

void insertLastV2(ListV2 L, Member m)
{
    //Check if there is enough space to insert.
    if(L->count < MAX){
        L->elems[L->count] = m;
        L->count++;
    }
}

// --- Your Implementation ---
int countMembers(ListV2 L, char* course, int year)
{

}

// --- Input Function ---
void loadMembers(ListV2 L)
{
    Member all[10] = {
        {"24100101", "Aiza", "BSCS", 1},
        {"23100102", "Bryan", "BSIT", 2},
        {"22100103", "Cathy", "BSCS", 3},
        {"24100104", "Dennis", "BSIS", 1},
        {"23100105", "Ella", "BSCS", 2},
        {"21100106", "Fred", "BSIT", 4},
        {"24100107", "Gina", "BSCS", 1},
        {"22100108", "Hugo", "BSIT", 3},
        {"23100109", "Iris", "BSIT", 2},
        {"21100110", "Jake", "BSCS", 4}
    };
    int i;

    for(i = 0; i < 10; i++){
        insertLastV2(L, all[i]);
    }
}

void processQueries(ListV2 L)
{
    int n, i, year, total;
    char course[8];

    printf("Number of queries: ");
    scanf("%d", &n);

    for(i = 0; i < n; i++){
        printf("Query %d (Course Year[0 = any]): ", i + 1);
        scanf("%7s %d", course, &year);

        total = countMembers(L, course, year);
        if(year == 0){
            printf("%s, all years: %d member(s).\n", course, total);
        } else {
            printf("%s, year %d: %d member(s).\n", course, year, total);
        }
    }
}
