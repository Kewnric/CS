int updateJobStatus(ListV2 L, char* jobID, int newStatus)
{
    int i, result = -1;

    for(i = 0; i < L->count && result == -1; i++){
        if(strcmp(L->elems[i].jobID, jobID) == 0){
            result = i;
        }
    }

    if(result != -1){
        if(newStatus == L->elems[result].status + 1 && newStatus <= CLAIMED){
            L->elems[result].status = newStatus;
        } else {
            result = -2;
        }
    }

    return result;
}
