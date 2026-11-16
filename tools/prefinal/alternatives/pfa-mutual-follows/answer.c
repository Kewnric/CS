ListV2 mutualFollows(ListV2 A, ListV2 B)
{
    ListV2 common;
    int i;

    initListV2(&common);
    if(common != NULL){
        //In A's order: keep an account B also follows, and only once.
        for(i = 0; i < A->count; i++){
            if(findAccountV2(B, A->elems[i].handle) != -1 && findAccountV2(common, A->elems[i].handle) == -1){
                insertLastV2(common, A->elems[i]);
            }
        }
    }

    return common;                          /* NULL means there was no memory */
}
