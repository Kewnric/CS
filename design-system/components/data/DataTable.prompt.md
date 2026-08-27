Tabular records — attempt history, admin lists.

```jsx
<DataTable
  columns={[{key:'name',label:'Program'},{label:'Tier',render:r=><TierBadge tier={r.tier}/>},{label:'Score',align:'right',render:r=><ScoreBadge perfect={r.perfect}>{r.score}</ScoreBadge>}]}
  rows={rows} onRowClick={open} />
```
