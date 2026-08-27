# StudySession Pro — UI kit

High-fidelity recreation of the StudySession Pro web app (source: `Kewnric/CS`, a
vanilla-JS single-page app with a hash router). Open `index.html` for the
click-through; open `launch.html` for the first-run storage picker on its own.

## What's here

| File | Surface |
| --- | --- |
| `index.html` | App shell — sidebar rail, route switching, settings sheet, reset dialog |
| `launch.html` | Storage-mode picker (first run) |
| `AppShell.jsx` | Collapsible icon rail (72px ↔ 260px), brand lockup, settings FAB |
| `HomeScreen.jsx` | Greeting hero, 4 KPI tiles, practice heatmap, quick actions, review + activity panels |
| `LibraryScreen.jsx` | Split view — folder tree left, program grid right, tabs + search |
| `PracticeScreen.jsx` | Dark code editor: file tabs, gutter, question grid, answer bubbles, terminal |
| `QuestBoardScreen.jsx` | Gamified HUD — Orbitron type, XP bar, rank-coloured quest list, detail pane |
| `AnalyticsScreen.jsx` | Glass command centre — hero tiles, trend area chart, tier distribution, history table |
| `StorageModePicker.jsx` | Local vs cloud launch dialog |
| `SettingsSheet.jsx` | Settings modal: storage, theme cycle, export, import, reset |

## Interactions that work

- Sidebar routes between Home, Library, Practice, Quest Board and Analytics.
- Library: expand/collapse folders, select a program, live search filter, click a card into the practice editor.
- Practice: switch and close file tabs, pick an answer bubble, Run Code prints compiler output.
- Quest Board: select a quest to load the detail pane; status tabs switch.
- Settings FAB (bottom right) → Theme cycles dark → purple → green → light; Reset Data opens the destructive confirm dialog.

## Not recreated

Admin, Visualize (hierarchy mindmap) and global Search render an `EmptyState`
pointing at the source repo — their layouts were not read in enough detail to
recreate faithfully, and inventing them would misrepresent the product.
