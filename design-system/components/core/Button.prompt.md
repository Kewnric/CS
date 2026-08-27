The app's button — use for every action; primary is reserved for the one main action per surface or dialog.

```jsx
<Button variant="primary" icon="play">Start</Button>
<Button variant="secondary">Cancel</Button>
<Button variant="ghost" iconOnly icon="x" aria-label="Close" />
```

Variants: primary (indigo gradient + glow), secondary (surface + border — always the Cancel side of a dialog), danger (red gradient, destructive only), ghost (bare, for toolbars and close buttons), practice (full-width outlined CTA at the bottom of a card). size="sm" for toolbars and inline rows. In modals the source stretches both buttons with flex:1.
