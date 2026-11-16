int logCall(List* L, Call c)
{
    int result = 1;

    //No space left: forget the oldest call, which is the last one.
    if(L->count == MAX){
        L->count--;
        result = 0;
    }
    //Shift ALL elements down by one to free index 0.
    memmove(L->elems+1, L->elems, sizeof(Call) * L->count);
    //Insert.
    L->elems[0] = c;
    L->count++;

    return result;
}
