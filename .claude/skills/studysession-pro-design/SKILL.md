---
name: studysession-pro-design
description: Use when building or restyling any StudySession Pro interface — screens, components, tokens, colours, type, spacing, motion — or when producing mocks, prototypes or design artifacts for it. The design system extracted from this app's own CSS lives in design-system/ at the repo root.
user-invocable: true
---

# StudySession Pro — design system

The system was extracted from this repository's own `css/` by Claude Design and
exported to **`design-system/`** at the repo root. That directory is the source
of truth for how this app should look; `css/` is the running implementation of
it. When the two disagree, say so rather than quietly following one.

## Read first

- `design-system/readme.md` — the full guide, and the place to start.
- `design-system/github.md` — which app file each part was built from, plus
  what has not been recreated yet (Admin, Visualize, global Search).

## What is where

| Need | Read |
| --- | --- |
| Colours, themes, difficulty tiers, terminal palette | `design-system/tokens/colors.css`, `tokens/themes.css` |
| Type scale, the three families | `design-system/tokens/fonts.css`, `tokens/typography.css` |
| Spacing, radius, shadows, motion | `design-system/tokens/{spacing,radius,shadows,motion}.css` |
| A component's API and markup | `design-system/components/<group>/<Name>.jsx` and its `.d.ts` |
| When and how to use a component | `design-system/components/<group>/<Name>.prompt.md` |
| A whole screen's composition | `design-system/ui_kits/studysession/*.jsx` |
| A written rule with an example | `design-system/guidelines/*.card.html` |

## Working with it

This app is buildless vanilla HTML/CSS/JS. The exported components are React,
so they are a **specification, not code to import** — read one for its tokens,
states and structure, then write the equivalent in the app's own idiom. Reach
for an existing CSS variable before inventing a value; nearly everything the
system defines already exists as a token in `css/global.css`.

For a mock or a throwaway prototype, copy the assets out and build static HTML
instead — do not wire it into the app.

## Keeping it in step

The export is a snapshot, taken on the date in `github.md`. Editing files under
`design-system/` does not change the app, and changing `css/` does not update
the export. When the app's styling moves on, the honest options are to re-export
from Claude Design or to note the drift — not to hand-edit the snapshot so it
merely looks current.
