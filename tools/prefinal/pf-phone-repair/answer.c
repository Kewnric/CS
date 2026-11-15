int updateJobStatus(ListV2 L, char* jobID, int newStatus)
{
    int i, result = -1;

    /* stops at the index holding jobID, or at the end of the list */
    for(i = 0; i < L->count && strcmp(L->elems[i].jobID, jobID) != 0; i++){}

    if(i < L->count){                       /* found */
        //Only one step forward, and never past CLAIMED.
        if(newStatus == L->elems[i].status + 1 && newStatus <= CLAIMED){
            L->elems[i].status = newStatus;
            result = i;
        } else {
            result = -2;
        }
    }

    return result;                          /* -1 means not found */
}
