#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#define MAX 8

typedef struct{
    char name[16];
    char school[8];
    int points;
}Team;

typedef struct{
    Team elems[MAX];
    int count;
}List, *ListV2;

// --- Function Prototypes ---
void initListV2(ListV2* L);
void insertLastV2(ListV2 L, Team t);
int addPoints(ListV2 L, char* teamName, int points);
void loadLeaderboard(ListV2 L);
void processRounds(ListV2 L);
void displayLeaderboard(ListV2 L);

int main(void)
{
    // 1. Variable Declarations
    ListV2 board = NULL;

    // 2. Function Calls
    initListV2(&board);
    if(board == NULL){
        printf("Unable to open the leaderboard.\n");
        return 1;
    }

    loadLeaderboard(board);
    processRounds(board);
    displayLeaderboard(board);

    // 3. Cleanup
    free(board);

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

void insertLastV2(ListV2 L, Team t)
{
    //Check if there is enough space to insert.
    if(L->count < MAX){
        L->elems[L->count] = t;
        L->count++;
    }
}

// --- Your Implementation ---
int addPoints(ListV2 L, char* teamName, int points)
{

}

// --- Input Functions ---
void loadLeaderboard(ListV2 L)
{
    //The board after the first round, highest first.
    Team standing[6] = {
        {"Alpha", "USC", 50},
        {"Bravo", "UC", 45},
        {"Charlie", "CIT", 45},
        {"Delta", "UP", 30},
        {"Echo", "USJR", 20},
        {"Foxtrot", "SWU", 10}
    };
    int i;

    for(i = 0; i < 6; i++){
        insertLastV2(L, standing[i]);
    }
}

void processRounds(ListV2 L)
{
    int n, i, points, rank;
    char name[16];

    printf("Number of scores: ");
    scanf("%d", &n);

    for(i = 0; i < n; i++){
        printf("Score %d (Team Points): ", i + 1);
        scanf("%15s %d", name, &points);

        rank = addPoints(L, name, points);
        if(rank > 0){
            printf("%s now has %d points and is rank #%d.\n", name, L->elems[rank - 1].points, rank);
        } else {
            printf("No team named %s.\n", name);
        }
    }
}

// --- Display Function ---
void displayLeaderboard(ListV2 L)
{
    int i;
    printf("\n=== LEADERBOARD ===\n");
    for(i = 0; i < L->count; i++){
        printf("%d. %s (%s) - %d\n", i + 1, L->elems[i].name, L->elems[i].school, L->elems[i].points);
    }
}
