int queueFan(List* L, Fan f)
{
    int i, pos, result = 1;

    for(i = 0; i < L->count && result == 1; i++){
        if(strcmp(L->elems[i].ticket.code, f.ticket.code) == 0){
            result = -1;
        }
    }

    if(result == 1 && L->count == MAX){
        result = 0;
    }

    if(result == 1){
        if(f.ticket.type == VIP){
            pos = 0;
            while(pos < L->count && L->elems[pos].ticket.type == VIP){
                pos++;
            }
        } else {
            pos = L->count;
        }

        for(i = L->count; i > pos; i--){
            L->elems[i] = L->elems[i - 1];
        }
        L->elems[pos] = f;
        L->count++;
    }

    return result;
}
