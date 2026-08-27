# Source repository

repo: Kewnric/CS
branch: main

## Last sync

date: 2026-08-27T16:57:52Z

### Updated in this project

- Extracted the full token set (colours, four theme scopes, type, spacing, radius, shadows, motion) from `css/`.
- Authored 26 React components across core, forms, navigation, feedback and data groups.
- Built a click-through UI kit: home, library, practice editor, quest board, analytics, storage picker.
- Added an `app-dashboard` template as the starting point for new screens.
- Copied the app mark from `icons/icon.svg` to `assets/logo.svg`; icons link Lucide 0.408.0 from CDN as the source does.

## Screen map

| Project screen | Built from |
| --- | --- |
| `ui_kits/studysession/AppShell.jsx` | `index.html`, `css/layout.css` |
| `ui_kits/studysession/HomeScreen.jsx` | `js/routes/route-home.js`, `css/pages.css` |
| `ui_kits/studysession/LibraryScreen.jsx` | `css/pages.css`, `css/components.css` |
| `ui_kits/studysession/PracticeScreen.jsx` | `css/pages.css`, `css/components.css` |
| `ui_kits/studysession/QuestBoardScreen.jsx` | `css/quest-board.css` |
| `ui_kits/studysession/AnalyticsScreen.jsx` | `css/pages.css`, `css/components.css` |
| `ui_kits/studysession/StorageModePicker.jsx` | `css/auth.css` |
| `ui_kits/studysession/SettingsSheet.jsx` | `css/components.css` |
| `tokens/*.css`, `base/*.css` | `css/motion.css`, `css/components.css`, `css/layout.css`, `index.html` |
| `components/**` | `css/components.css`, `css/pages.css`, `css/quest-board.css` |
| `assets/logo.svg` | `icons/icon.svg` |

Not yet recreated: Admin, Visualize (hierarchy mindmap), global Search.
