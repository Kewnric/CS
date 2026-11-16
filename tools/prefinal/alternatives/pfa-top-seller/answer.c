int findTopSeller(List L)
{
    int i, total, top = -1, best = -1;

    for(i = 0; i < L.count; i++){
        total = L.elems[i].sales.jan + L.elems[i].sales.feb + L.elems[i].sales.mar;
        if(total > best){                   /* strictly more: a tie keeps the earlier agent */
            best = total;
            top = i;
        }
    }

    return top;                             /* -1 means the list is empty */
}
