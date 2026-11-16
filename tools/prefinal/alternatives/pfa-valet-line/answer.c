int removeCarAt(List* L, int pos, Car* removed)
{
    int i, result = 0;

    //Check that pos names a car: 1 up to count.
    if(pos >= 1 && pos <= L->count){
        i = pos - 1;                        /* position 1 is index 0 */
        *removed = L->elems[i];
        //Close the gap at i.
        L->count--;
        memmove(L->elems+i, L->elems+i+1, sizeof(Car) * (L->count-i));
        result = 1;
    }

    return result;
}
