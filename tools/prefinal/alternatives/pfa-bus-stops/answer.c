int addStopAfter(ListV2 L, Stop s, char* afterCode)
{
    int i, result = -1;

    /* stops at the stop with code afterCode, or at the end of the route */
    for(i = 0; i < L->count && strcmp(L->elems[i].code, afterCode) != 0; i++){}

    if(i < L->count){                       /* found - the new stop goes right after it */
        result = 0;
        //Check if there is enough space to insert.
        if(L->count < MAX){
            i++;
            //Shift elements down.
            if(i < L->count){
                memmove(L->elems+i+1, L->elems+i, sizeof(Stop) * (L->count-i));
            }
            //Insert.
            L->elems[i] = s;
            L->count++;
            result = i + 1;                 /* its stop number, counted from 1 */
        }
    }

    return result;
}
