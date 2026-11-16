int cancelFlight(List* L, char* flight)
{
    int i = 0, removed = 0;

    while(i < L->count){
        if(strcmp(L->elems[i].flight, flight) == 0){   /* found - close the gap at i */
            L->count--;
            memmove(L->elems+i, L->elems+i+1, sizeof(Passenger) * (L->count-i));
            removed++;
        } else {
            i++;                            /* move on only when nothing moved into i */
        }
    }

    return removed;
}
