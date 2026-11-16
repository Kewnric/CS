ListV2 copyCart(ListV2 L)
{
    ListV2 copy;

    initListV2(&copy);
    if(copy != NULL){
        *copy = *L;                         /* copies the whole struct: the array and the count */
    }

    return copy;                            /* NULL means there was no memory */
}
