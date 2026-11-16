ListV2 extractGraduates(ListV2 L)
{
    ListV2 grads;
    int i, j = 0;

    initListV2(&grads);
    if(grads != NULL){
        for(i = 0; i < L->count; i++){
            if(L->elems[i].yearLevel == 4){
                insertLastV2(grads, L->elems[i]);   /* goes to the new list */
            } else {
                L->elems[j] = L->elems[i];          /* stays: keep it, in order */
                j++;
            }
        }
        L->count = j;
    }

    return grads;                           /* NULL means there was no memory */
}
