int locateBook(List L, char* isbn)
{
    int i;
    /* stops at the book with this ISBN, or at the end of the list */
    for(i = 0; i < L.count && strcmp(L.elems[i].isbn, isbn) != 0; i++){}

    return (i < L.count) ? i + 1 : 0;       /* 0 means not on the shelf */
}
