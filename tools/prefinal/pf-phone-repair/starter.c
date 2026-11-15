#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#define MAX 10

// Repair job status codes (a job moves through these in order)
#define RECEIVED  0
#define REPAIRING 1
#define READY     2
#define CLAIMED   3

typedef struct{
    char name[24];
    char contact[12];
}Customer;

typedef struct{
    char brand[16];
    char model[24];
}Device;

typedef struct{
    char jobID[8];
    Customer customer;
    Device device;
    int status;
}RepairJob;

typedef struct{
    RepairJob elems[MAX];
    int count;
}List, *ListV2;

// --- Function Prototypes ---
void initListV2(ListV2* L);
void insertLastV2(ListV2 L, RepairJob job);
int updateJobStatus(ListV2 L, char* jobID, int newStatus);
char* getStatusText(int status);
void loadJobs(ListV2 L);
void processUpdates(ListV2 L);
void displayJobs(ListV2 L);

int main(void)
{
    // 1. Variable Declarations
    ListV2 jobs = NULL;

    // 2. Function Calls
    initListV2(&jobs);
    if(jobs == NULL){
        printf("Unable to open the job tracker.\n");
        return 1;
    }

    loadJobs(jobs);
    processUpdates(jobs);
    displayJobs(jobs);

    // 3. Cleanup
    free(jobs);

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

void insertLastV2(ListV2 L, RepairJob job)
{
    //Check if there is enough space to insert.
    if(L->count < MAX){
        L->elems[L->count] = job;
        L->count++;
    }
}

// --- Your Implementation ---
int updateJobStatus(ListV2 L, char* jobID, int newStatus)
{

}

// --- Helper Function ---
char* getStatusText(int status)
{
    char* text;
    switch(status){
        case RECEIVED:  text = "RECEIVED";  break;
        case REPAIRING: text = "REPAIRING"; break;
        case READY:     text = "READY";     break;
        case CLAIMED:   text = "CLAIMED";   break;
        default:        text = "UNKNOWN";
    }
    return text;
}

// --- Input Functions ---
void loadJobs(ListV2 L)
{
    RepairJob current[8] = {
        {"JB-1001", {"Andrea", "09171234501"}, {"Samsung", "Galaxy A54"}, RECEIVED},
        {"JB-1002", {"Benjie", "09181234502"}, {"Apple", "iPhone 13"}, REPAIRING},
        {"JB-1003", {"Carla", "09191234503"}, {"Xiaomi", "Redmi Note 12"}, READY},
        {"JB-1004", {"Dodong", "09201234504"}, {"Oppo", "A78"}, CLAIMED},
        {"JB-1005", {"Ella", "09211234505"}, {"Vivo", "Y36"}, RECEIVED},
        {"JB-1006", {"Franco", "09221234506"}, {"Realme", "C55"}, REPAIRING},
        {"JB-1007", {"Gwen", "09231234507"}, {"Huawei", "Nova 11"}, READY},
        {"JB-1008", {"Hector", "09241234508"}, {"Infinix", "Hot 30"}, RECEIVED}
    };
    int i;

    for(i = 0; i < 8; i++){
        insertLastV2(L, current[i]);
    }
}

void processUpdates(ListV2 L)
{
    int n, i, newStatus, result;
    char id[8];

    printf("Number of status updates: ");
    scanf("%d", &n);

    for(i = 0; i < n; i++){
        printf("Update %d (Job ID and New Status [0-3]): ", i + 1);
        scanf("%7s %d", id, &newStatus);

        result = updateJobStatus(L, id, newStatus);
        if(result >= 0){
            printf("%s (%s %s) is now %s. [index %d]\n", id,
                   L->elems[result].device.brand, L->elems[result].device.model,
                   getStatusText(L->elems[result].status), result);
        } else if(result == -1){
            printf("Job %s not found.\n", id);
        } else {
            printf("Invalid status change for %s (to %s).\n", id, getStatusText(newStatus));
        }
    }
}

// --- Display Function ---
void displayJobs(ListV2 L)
{
    int i;
    printf("\n=== REPAIR JOBS (%d) ===\n", L->count);
    for(i = 0; i < L->count; i++){
        printf("%d. [%s] %s (%s) - %s %s - %s\n", i + 1, L->elems[i].jobID,
               L->elems[i].customer.name, L->elems[i].customer.contact,
               L->elems[i].device.brand, L->elems[i].device.model,
               getStatusText(L->elems[i].status));
    }
}
