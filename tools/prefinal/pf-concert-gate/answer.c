int queueFan(List* L, Fan f)
{
    int i, result = -1;

    /* stops at the fan holding the same ticket code, or at the end of the list */
    for(i = 0; i < L->count && strcmp(L->elems[i].ticket.code, f.ticket.code) != 0; i++){}

    if(i == L->count){                      /* not in line yet */
        result = 0;
        //Check if there is enough space to insert.
        if(L->count < MAX){
            //Find the correct index for insertion.
            if(f.ticket.type == VIP){
                /* stops behind the last VIP already in line */
                for(i = 0; i < L->count && L->elems[i].ticket.type == VIP; i++){}
            } else {
                i = L->count;               /* a Regular fan goes at the end */
            }

            //Shift elements down.
            if(i < L->count){
                memmove(L->elems+i+1, L->elems+i, sizeof(Fan) * (L->count-i));
            }
            //Insert.
            L->elems[i] = f;
            L->count++;
            result = 1;
        }
    }

    return result;
}
