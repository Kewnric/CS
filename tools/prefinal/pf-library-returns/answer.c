int returnAllBooks(ListV2 L, char* borrowerID)
{
    int i, j, removed = 0;

    i = 0;
    while(i < L->count){
        if(strcmp(L->elems[i].borrower.idNo, borrowerID) == 0){
            for(j = i; j < L->count - 1; j++){
                L->elems[j] = L->elems[j + 1];
            }
            L->count--;
            removed++;
        } else {
            i++;
        }
    }

    return removed;
}
