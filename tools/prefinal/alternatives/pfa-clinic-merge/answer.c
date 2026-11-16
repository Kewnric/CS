List mergeSchedules(List A, List B)
{
    List merged;
    int i = 0, j = 0;

    initList(&merged);
    //Take the earlier of the two fronts until one list runs out; a tie takes A first.
    while(i < A.count && j < B.count){
        if(minutesOf(A.elems[i].time) <= minutesOf(B.elems[j].time)){
            insertLast(&merged, A.elems[i]);
            i++;
        } else {
            insertLast(&merged, B.elems[j]);
            j++;
        }
    }
    //Copy whatever is left of either list.
    for(; i < A.count; i++){
        insertLast(&merged, A.elems[i]);
    }
    for(; j < B.count; j++){
        insertLast(&merged, B.elems[j]);
    }

    return merged;
}
