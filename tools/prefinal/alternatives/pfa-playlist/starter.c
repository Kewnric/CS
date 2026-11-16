#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#define MAX 8

typedef struct{
    int minutes;
    int seconds;
}Duration;

typedef struct{
    char title[24];
    char artist[16];
    Duration length;
}Song;

typedef struct{
    Song elems[MAX];
    int count;
}List, *ListV2;

// --- Function Prototypes ---
void initListV2(ListV2* L);
void insertLastV2(ListV2 L, Song s);
int insertSongAt(ListV2 L, Song s, int pos);
void loadPlaylist(ListV2 L);
void processInserts(ListV2 L);
void displayPlaylist(ListV2 L);

int main(void)
{
    // 1. Variable Declarations
    ListV2 playlist = NULL;

    // 2. Function Calls
    initListV2(&playlist);
    if(playlist == NULL){
        printf("Unable to open the playlist.\n");
        return 1;
    }

    loadPlaylist(playlist);
    processInserts(playlist);
    displayPlaylist(playlist);

    // 3. Cleanup
    free(playlist);

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

void insertLastV2(ListV2 L, Song s)
{
    //Check if there is enough space to insert.
    if(L->count < MAX){
        L->elems[L->count] = s;
        L->count++;
    }
}

// --- Your Implementation ---
int insertSongAt(ListV2 L, Song s, int pos)
{

}

// --- Input Functions ---
void loadPlaylist(ListV2 L)
{
    Song saved[6] = {
        {"Morning Rain", "Tala", {4, 29}},
        {"Coastline", "Sinag", {5, 21}},
        {"Paper Planes", "Tala", {5, 4}},
        {"Night Market", "Lakbay", {4, 12}},
        {"Old Photos", "Sinag", {4, 40}},
        {"Homeward", "Lakbay", {3, 38}}
    };
    int k, i;

    printf("Songs already in the playlist (0-6): ");
    scanf("%d", &k);

    for(i = 0; i < k && i < 6; i++){
        insertLastV2(L, saved[i]);
    }
}

void processInserts(ListV2 L)
{
    int n, i, pos, result;
    Song s;

    printf("Number of songs to insert: ");
    scanf("%d", &n);

    for(i = 0; i < n; i++){
        printf("Song %d (Title Artist Min Sec Position): ", i + 1);
        scanf("%23s %15s %d %d %d", s.title, s.artist, &s.length.minutes, &s.length.seconds, &pos);

        result = insertSongAt(L, s, pos);
        if(result == 1){
            printf("%s is now song #%d.\n", s.title, pos);
        } else if(result == 0){
            printf("The playlist is full. %s was not added.\n", s.title);
        } else {
            printf("Position %d is not valid. %s was not added.\n", pos, s.title);
        }
    }
}

// --- Display Function ---
void displayPlaylist(ListV2 L)
{
    int i;
    if(L->count == 0){
        printf("\nThe playlist is empty.\n");
        return;
    }

    printf("\n=== PLAYLIST (%d/%d) ===\n", L->count, MAX);
    for(i = 0; i < L->count; i++){
        printf("%d. %s - %s (%d:%02d)\n", i + 1, L->elems[i].title, L->elems[i].artist,
               L->elems[i].length.minutes, L->elems[i].length.seconds);
    }
}
