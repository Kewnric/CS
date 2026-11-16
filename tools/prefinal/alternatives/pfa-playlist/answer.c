int insertSongAt(ListV2 L, Song s, int pos)
{
    int i, result = -1;

    //Check that pos is a real place: 1 up to one past the last song.
    if(pos >= 1 && pos <= L->count + 1){
        result = 0;
        //Check if there is enough space to insert.
        if(L->count < MAX){
            i = pos - 1;                    /* position 1 is index 0 */
            //Shift elements down.
            if(i < L->count){
                memmove(L->elems+i+1, L->elems+i, sizeof(Song) * (L->count-i));
            }
            //Insert.
            L->elems[i] = s;
            L->count++;
            result = 1;
        }
    }

    return result;
}
