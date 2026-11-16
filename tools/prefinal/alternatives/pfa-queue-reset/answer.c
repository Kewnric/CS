int makeNull(List* L)
{
    int cleared = L->count;

    L->count = 0;                           /* the old tickets stay in memory but no longer count */

    return cleared;
}
