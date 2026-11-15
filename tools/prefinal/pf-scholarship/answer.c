int addApplicant(ListV3* L, Applicant a)
{
    int i, pos, total, result = 1;

    for(i = 0; i < L->count && result == 1; i++){
        if(strcmp(L->elemPtr[i].info.idNo, a.info.idNo) == 0){
            result = -1;
        }
    }

    if(result == 1 && L->count >= L->arrSize){
        result = 0;
    }

    if(result == 1){
        total = a.scores.math + a.scores.science + a.scores.english;
        pos = 0;
        while(pos < L->count &&
              L->elemPtr[pos].scores.math + L->elemPtr[pos].scores.science
              + L->elemPtr[pos].scores.english >= total){
            pos++;
        }

        for(i = L->count; i > pos; i--){
            L->elemPtr[i] = L->elemPtr[i - 1];
        }
        L->elemPtr[pos] = a;
        L->count++;
    }

    return result;
}
