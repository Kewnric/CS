List getRoster(List L, char* course)
{
    List roster;
    int i;

    initList(&roster);
    for(i = 0; i < L.count; i++){
        if(strcmp(L.elems[i].course, course) == 0){
            insertLast(&roster, L.elems[i]);
        }
    }

    return roster;                          /* a whole List comes back by value: no malloc */
}
