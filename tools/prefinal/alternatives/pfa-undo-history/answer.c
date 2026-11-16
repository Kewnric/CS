int undoActions(List* L, int steps)
{
    int undone = 0;

    while(undone < steps && L->count > 0){
        //No shifting needed: just forget the last action.
        L->count--;
        undone++;
    }

    return undone;
}
