The home dashboard's headline numbers. Always four across.

```jsx
<div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'0.875rem'}}>
  <StatCard icon="flame" value="12" label="Day streak" accent="indigo" />
  <StatCard icon="check-circle-2" value="87" label="Solved" accent="green" />
  <StatCard icon="target" value="94%" label="Accuracy" accent="amber" />
  <StatCard icon="clock" value="6.2h" label="This week" accent="cyan" />
</div>
```

Keep the accent order — the product assigns it by position, not by meaning.
