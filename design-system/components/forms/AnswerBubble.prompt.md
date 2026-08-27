A, B, C, D pick in the answer sheet and notebook practice views.

```jsx
<div style={{display:'flex',gap:'0.375rem'}}>
  {['A','B','C','D'].map(k => <AnswerBubble key={k} state={k==='B'?'selected':'default'}>{k}</AnswerBubble>)}
</div>
```

Rows are prefixed by a right-aligned 28px mono question number in --text-tertiary. Add the .shake class when a pick grades wrong.
