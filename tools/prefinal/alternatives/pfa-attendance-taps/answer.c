int removeDuplicateTaps(ListV2 L)
{
    int i, j, removed = 0;

    for(i = 0; i < L->count; i++){
        j = i + 1;
        while(j < L->count){
            if(strcmp(L->elems[j].idNo, L->elems[i].idNo) == 0){   /* a later tap - close the gap at j */
                L->count--;
                memmove(L->elems+j, L->elems+j+1, sizeof(Tap) * (L->count-j));
                removed++;
            } else {
                j++;
            }
        }
    }

    return removed;
}
