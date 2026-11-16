int admitPatient(ListV2 L, Patient p)
{
    int i, result = -1;

    //Check that the level is one of the three.
    if(p.level >= CRITICAL && p.level <= STANDARD){
        result = 0;
        //Check if there is enough space to insert.
        if(L->count < MAX){
            /* stops behind everyone at the same level or more urgent */
            for(i = 0; i < L->count && L->elems[i].level <= p.level; i++){}

            //Shift elements down.
            if(i < L->count){
                memmove(L->elems+i+1, L->elems+i, sizeof(Patient) * (L->count-i));
            }
            //Insert.
            L->elems[i] = p;
            L->count++;
            result = i + 1;                 /* queue position, counted from 1 */
        }
    }

    return result;
}
