Every confirm, prompt and result in the app is one of these. Centre-aligned, icon on top, two buttons at the bottom.

```jsx
<Modal
  icon="trash-2" iconColor="var(--color-danger)"
  title="Reset Data" description="Wipe everything and restore defaults?"
  actions={<><Button variant="secondary" style={{flex:1}}>Cancel</Button><Button variant="danger" style={{flex:1}}>Reset</Button></>}
/>
```

Destructive dialogs use a red icon and a danger button; Cancel is always the secondary on the left.
