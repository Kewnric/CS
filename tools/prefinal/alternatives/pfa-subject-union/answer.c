List unionSubjects(List A, List B)
{
    List all;
    int i;

    initList(&all);
    //Every subject of A, then every subject of B, each one only once.
    for(i = 0; i < A.count; i++){
        if(findSubject(all, A.elems[i].code) == -1){
            insertLast(&all, A.elems[i]);
        }
    }
    for(i = 0; i < B.count; i++){
        if(findSubject(all, B.elems[i].code) == -1){
            insertLast(&all, B.elems[i]);
        }
    }

    return all;
}
