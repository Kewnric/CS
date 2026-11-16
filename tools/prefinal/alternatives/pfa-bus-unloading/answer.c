void reverseList(List* L)
{
    Passenger temp;
    int i;

    //Swap the i-th from the front with the i-th from the back, up to the middle.
    for(i = 0; i < L->count / 2; i++){
        temp = L->elems[i];
        L->elems[i] = L->elems[L->count-1-i];
        L->elems[L->count-1-i] = temp;
    }
}
