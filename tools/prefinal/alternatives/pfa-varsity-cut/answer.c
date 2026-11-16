int removeBelowCutoff(ListV2 L, int cutoff)
{
    int i, j = 0, removed;

    //Keep only the athletes at or above the cutoff, in their order.
    for(i = 0; i < L->count; i++){
        if(L->elems[i].scores.speed + L->elems[i].scores.agility + L->elems[i].scores.skill >= cutoff){
            L->elems[j] = L->elems[i];
            j++;
        }
    }
    removed = L->count - j;
    L->count = j;

    return removed;
}
