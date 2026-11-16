int signUp(List* L, Member m)
{
    int i, result = -1;

    /* stops at the member with the same ID, or at the end of the list */
    for(i = 0; i < L->count && strcmp(L->elems[i].idNo, m.idNo) != 0; i++){}

    if(i == L->count){                      /* not a member yet */
        result = 0;
        //Check if there is enough space to insert.
        if(L->count < MAX){
            //No shifting needed: the next free slot is at index count.
            L->elems[L->count] = m;
            L->count++;
            result = 1;
        }
    }

    return result;
}
