Student findStudent(ListV2 L, char* idNo)
{
    Student found = {"XXXX", {"XXXX", "XXXX"}, "XXXX", 0};
    int i;

    /* stops at the student with this ID, or at the end of the list */
    for(i = 0; i < L->count && strcmp(L->elems[i].idNo, idNo) != 0; i++){}

    if(i < L->count){                       /* found - hand back a copy */
        found = L->elems[i];
    }

    return found;
}
