int enrollStudent(List* L, Student s)
{
    int i, result = -1;

    //Check if there is enough space to insert.
    if(L->count < MAX){
        //Find the correct index for insertion: behind every last name that comes first or is the same.
        for(i = 0; i < L->count && strcmp(L->elems[i].name.last, s.name.last) <= 0; i++){}

        //Shift elements down.
        if(i < L->count){
            memmove(L->elems+i+1, L->elems+i, sizeof(Student) * (L->count-i));
        }
        //Insert.
        L->elems[i] = s;
        L->count++;
        result = i;
    }

    return result;
}
