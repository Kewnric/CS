int openApp(List* L, char* name)
{
    App a;
    int i, result = 0;

    /* stops at the app with this name, or at the end of the list */
    for(i = 0; i < L->count && strcmp(L->elems[i].name, name) != 0; i++){}

    if(i < L->count){                       /* found - lift it out and put it first */
        a = L->elems[i];
        //Shift the apps before it down by one.
        memmove(L->elems+1, L->elems, sizeof(App) * i);
        L->elems[0] = a;
        result = i + 1;                     /* where it was, counted from 1 */
    }

    return result;
}
