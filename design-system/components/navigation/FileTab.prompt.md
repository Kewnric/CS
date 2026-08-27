Multi-file tab bar above the code editor. The bar itself is #0d1117 with a bottom border and hidden scrollbars.

```jsx
<div style={{display:'flex',background:'var(--term-bg)',borderBottom:'1px solid var(--border-color)',minHeight:38}}>
  <FileTab name="main.c" active />
  <FileTab name="helpers.h" dirty />
</div>
```
