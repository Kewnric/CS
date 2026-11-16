PrintJob printNext(ListV2 L)
{
    PrintJob job = {"NONE", "NONE", 0};

    if(L->count > 0){
        job = L->elems[0];
        L->count--;
        //Shift ALL remaining elements up by one to close the gap at index 0.
        memmove(L->elems, L->elems+1, sizeof(PrintJob) * L->count);
    }

    return job;
}
