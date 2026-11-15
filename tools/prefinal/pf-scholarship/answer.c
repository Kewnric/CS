int addApplicant(ListV3* L, Applicant a)
{
    int i, total, result = -1;

    /* stops at the applicant with the same ID number, or at the end of the list */
    for(i = 0; i < L->count && strcmp(L->elemPtr[i].info.idNo, a.info.idNo) != 0; i++){}

    if(i == L->count){                      /* not on the shortlist yet */
        result = 0;
        //Check if there is enough space to insert.
        if(L->count < L->arrSize){
            total = a.scores.math + a.scores.science + a.scores.english;
            //Find the correct index for insertion: after every total at least as high.
            for(i = 0; i < L->count && L->elemPtr[i].scores.math + L->elemPtr[i].scores.science
                                       + L->elemPtr[i].scores.english >= total; i++){}

            //Shift elements down.
            if(i < L->count){
                memmove(L->elemPtr+i+1, L->elemPtr+i, sizeof(Applicant) * (L->count-i));
            }
            //Insert.
            L->elemPtr[i] = a;
            L->count++;
            result = 1;
        }
    }

    return result;
}
