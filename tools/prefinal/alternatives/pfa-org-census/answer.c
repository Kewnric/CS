int countMembers(ListV2 L, char* course, int year)
{
    int i, total = 0;

    for(i = 0; i < L->count; i++){
        //Same course, and either any year (0) or that exact year.
        if(strcmp(L->elems[i].course, course) == 0 && (year == 0 || L->elems[i].yearLevel == year)){
            total++;
        }
    }

    return total;
}
