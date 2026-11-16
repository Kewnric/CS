Order serveDish(ListV2 L, char* dish)
{
    Order served = {0, "NONE", "NONE"};
    int i;

    /* stops at the oldest order of this dish, or at the end of the list */
    for(i = 0; i < L->count && strcmp(L->elems[i].dish, dish) != 0; i++){}

    if(i < L->count){                       /* found - close the gap at i */
        served = L->elems[i];
        L->count--;
        memmove(L->elems+i, L->elems+i+1, sizeof(Order) * (L->count-i));
    }

    return served;
}
