Content container for anything clickable in the Library and Browse grids.

```jsx
<Card onClick={open}>
  <h3 style={{fontSize:'1rem',fontWeight:700}}>Linked List Reversal</h3>
  <p style={{fontSize:'0.75rem',color:'var(--text-tertiary)'}}>3 versions</p>
</Card>
```

variant="glass" for stat tiles over the hero gradient; variant="flat" for non-interactive panels. Grids use repeat(auto-fill, minmax(280px, 1fr)) with gap: var(--space-md).
