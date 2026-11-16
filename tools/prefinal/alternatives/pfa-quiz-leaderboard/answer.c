int addPoints(ListV2 L, char* teamName, int points)
{
    Team t;
    int i, result = -1;

    /* stops at the team with this name, or at the end of the list */
    for(i = 0; i < L->count && strcmp(L->elems[i].name, teamName) != 0; i++){}

    if(i < L->count){                       /* found - take it out, update it, put it back */
        t = L->elems[i];
        L->count--;
        memmove(L->elems+i, L->elems+i+1, sizeof(Team) * (L->count-i));

        t.points += points;

        //Find the correct index for insertion: behind every team with at least as many points.
        for(i = 0; i < L->count && L->elems[i].points >= t.points; i++){}

        //Shift elements down.
        if(i < L->count){
            memmove(L->elems+i+1, L->elems+i, sizeof(Team) * (L->count-i));
        }
        //Insert.
        L->elems[i] = t;
        L->count++;
        result = i + 1;                     /* its new rank */
    }

    return result;
}
