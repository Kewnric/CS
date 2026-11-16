int adjustStock(List* L, char* code, int change)
{
    int i, result = -1;

    /* stops at the product with this code, or at the end of the list */
    for(i = 0; i < L->count && strcmp(L->elems[i].code, code) != 0; i++){}

    if(i < L->count){                       /* found */
        result = -2;
        //Stock can never go below zero.
        if(L->elems[i].stock + change >= 0){
            L->elems[i].stock += change;
            result = i;
        }
    }

    return result;                          /* -1 means not found */
}
