void sortByTime(ListV2 L)
{
    Runner r;
    int i, j;

    //Insertion sort: take each runner and slide it in among the sorted ones before it.
    for(i = 1; i < L->count; i++){
        r = L->elems[i];
        //Find the correct index for insertion: behind every time that is faster or the same.
        for(j = 0; j < i && toSeconds(L->elems[j].finish) <= toSeconds(r.finish); j++){}

        //Shift elements down.
        if(j < i){
            memmove(L->elems+j+1, L->elems+j, sizeof(Runner) * (i-j));
        }
        //Insert.
        L->elems[j] = r;
    }
}
