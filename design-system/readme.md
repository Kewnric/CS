# StudySession Pro — Design System

A design system extracted from **StudySession Pro**, a study-and-practice web app
for learning C programming. Built by reading the app's own source, not from
screenshots.

## The product

StudySession Pro is a single-user study tool. A student stores C programs,
snippets and notebooks in a deep folder library, then runs timed practice
sessions against them: type the program from memory, answer multiple-choice
questions on an answer sheet, compile and run, get scored. Every attempt is
logged, so the app can show streaks, accuracy, review schedules (SRS) and a
per-tier breakdown of what the student has actually mastered.

It is a client-side app — a vanilla-JS SPA with a hash router, no framework, no
build step. On first run it asks where to keep your data: **local browser
storage** or **cloud sync via Google**. Everything else is one window: a
collapsible icon rail on the left, one route in the main pane.

### Surfaces

| Route | What it is |
| --- | --- |
| **Home** | Greeting hero, four KPI tiles, practice heatmap, quick actions, review queue, recent activity |
| **Library** | Split view — folder tree on the left, program/snippet/notebook grid on the right |
| **Practice** | Full-dark code editor: multi-file tabs, line gutter, question grid, answer bubbles, terminal output |
| **Analytics** | Glass "command centre" — hero metrics, trend chart, tier distribution, attempt history |
| **Quest Board** | A separate gamified layer: XP, levels, S-to-E ranked quests, Orbitron HUD type |
| **Admin** | Authoring forms for programs, versions, questions and answer keys |
| **Visualize** | Hierarchy mindmap of the library |
| **Search** | Global search across everything |

The Quest Board is worth calling out: it is deliberately a different visual
register from the rest of the app — a game HUD bolted onto a study tool. Orbitron
appears there and nowhere else.

## Sources

- **GitHub:** `Kewnric/CS` — <https://github.com/Kewnric/CS> (branch `main`).
  The whole system was derived from this repository. Explore it further before
  building anything substantial: `css/` holds the real token and component
  values, `js/routes/` holds each screen's markup, `js/constants.js` holds the
  domain vocabulary.
- Files read for this system: `index.html`, `js/constants.js`,
  `js/routes/route-home.js`, `css/motion.css`, `css/components.css`,
  `css/layout.css`, `css/pages.css`, `css/quest-board.css`, `css/auth.css`,
  `icons/icon.svg`.
- No Figma file, slide deck or brand-guidelines document was provided. Content
  and visual rules below are inferred from the source, not from a written brand
  guide.

## Index

| Path | What |
| --- | --- |
| `styles.css` | Global entry point — `@import` list only. Link this one file. |
| `tokens/` | `fonts.css`, `colors.css`, `themes.css`, `typography.css`, `spacing.css`, `radius.css`, `shadows.css`, `motion.css` |
| `base/` | `reset.css` (box model, body, headings, scrollbar, focus ring, ligature kill), `animations.css` (keyframes + utility classes) |
| `components/core/` | Button, Card, Badge, Tag, TierBadge, ScoreBadge, EmptyState, Divider, Icon |
| `components/forms/` | FormLabel, Input, Select, Textarea, SearchInput, AnswerBubble |
| `components/navigation/` | SidebarLink, Tabs, Breadcrumb, TreeNode, FileTab, Pagination |
| `components/feedback/` | Modal, Toast, Skeleton, ProgressRing |
| `components/data/` | StatCard, PanelCard, QuickActionCard, Heatmap, DataTable |
| `ui_kits/studysession/` | Click-through recreation of the app — five screens + launch picker. See its own README. |
| `guidelines/` | 21 specimen cards for colours, type, spacing, effects and brand |
| `assets/logo.svg` | The app mark (the only logo in the source) |
| `templates/app-dashboard/` | Starting-point template — app shell, hero, KPI tiles, dashboard panels |
| `SKILL.md` | Agent Skills wrapper, for use in Claude Code |
| `github.md` | Source-repo association and sync record |

Every component has a sibling `.d.ts` (props contract) and `.prompt.md` (what it
is, when to use it, a usage example).

### Intentional additions

- **Icon** — the source calls `lucide.createIcons()` imperatively on raw
  `<i data-lucide>` tags. A thin React wrapper was needed so components could
  render glyphs; it does nothing the source doesn't already do.
- **Pagination**, **Skeleton**, **Toast** — present in the source CSS
  (`components.css`) but not exercised on every screen. Kept because the values
  are real, not invented.

---

# Content fundamentals

**Voice: second person, present tense, plain.** The app talks to one student
about their own work. "You have 6 cards due for review." Never "the user", never
royal "we".

**Sentence case everywhere except micro-labels.** Headings and buttons are
sentence case ("New program", "Run Code", "Resume practice"). The one systematic
exception is the uppercase micro-label — 11px, 700 weight, 0.06em tracking —
which the app uses instead of real subheadings: `RECENT ACTIVITY`,
`PRACTICE ACTIVITY`, `QUICK ACTIONS`, `PROGRESS`. If you're labelling a region,
that's the pattern; don't write an `<h3>`.

**Labels are nouns; buttons are verbs.** Panels are named for what they contain
("Due for review", "Attempt history"). Buttons name the action and nothing else
("Save", "Import", "Continue", "Reset"). No "Click here", no "Let's get started".

**Numbers carry the message.** The product is quantified, so copy defers to
figures: `12` day streak, `94%` accuracy, `18 / 18`, `4,120 / 5,000 XP`,
`Process exited with code 0 (34 ms)`. Set them in mono. Don't editorialise around
them — no "Great job!", no "You're on fire".

**Empty states encourage, never scold.** "No quests yet — accept one from the
board to start earning XP." A partial score is amber, not red; there is no
"failed" score state in the attempt UI.

**The Quest Board switches register.** That surface writes in caps, clipped and
game-like: `CLEAR THE ARRAY GAUNTLET`, `SYSTEMS APPRENTICE`, `LV 24`, `SYSTEM`,
`ACTIVE / COMPLETED / FAILED`. Quest titles are uppercase; quest descriptions
drop back to plain mono sentence case ("Solve 5 array programs without a hint").
Do not carry that voice into the rest of the app, and don't carry the app's
gentle voice into the Quest Board.

**Personal, occasionally devotional.** The home hero shows a rotating scripture
quote under the greeting ("Whatever you do, work at it with all your heart." —
Colossians 3:23). This is a single-user tool built by its user; keep that
register if you extend the home screen, and don't add marketing copy anywhere —
there is no marketing site.

**No emoji.** Not in the source, not in labels, not in empty states. Every glyph
is a Lucide icon.

---

# Visual foundations

**Dark by default.** `index.html` writes `data-theme="dark"` on `<html>` before
first paint. Light exists as the `:root` values, but the product ships dark and
every design decision reads correctly there first. Two more themes — purple and
green — reassign both neutrals *and* `--color-primary`, so never hard-code
indigo where a token exists.

**Colour.** Indigo `#6366f1` is the brand; cyan `#06b6d4`/`#22d3ee` is the
accent and belongs to *active state* — the selected nav row, an open folder
glyph, the current file tab — never to a button fill. Green/amber/red are
semantic only, each with a matching 10%-alpha background for badges. Six
difficulty tiers (S gold → E grey) have fixed gradients that must not be
recoloured. Terminal surfaces stay `#0d1117` in every theme: a code pane is
always dark.

**Gradients are structural, not decorative.** Three uses, and no others: a
135° indigo→indigo-dark fill on primary buttons; a 135° indigo→cyan→green tint
at 5–10% alpha as a background wash on heroes and cards; and text gradients
(`background-clip: text`) on the brand lockup and page titles. There are no
bluish-purple hero gradients and no full-saturation gradient backgrounds.

**Type.** Inter for everything UI. JetBrains Mono for code, terminals and any
numeral that must not jitter — all stat values are mono. Orbitron, 700/900 only,
on the Quest Board and nowhere else. The system runs heavy: 700 is the default
for anything titular, 800–900 for page titles and stat values, 600 for buttons
and list items, 400 only for body prose. Large text gets negative tracking
(-0.02em to -0.03em); uppercase micro-labels get +0.06em; Orbitron gets +1 to
1.5px. Body copy is 14px — not 16px. Line height 1.6 for prose, 1.2–1.3 for
headings, 1.65 for code.

**Ligatures are force-disabled app-wide** (`font-feature-settings: "liga" 0,
"calt" 0, "dlig" 0` on `*`). JetBrains Mono would otherwise fuse `<=`, `>=`,
`->`, `!=` into single glyphs, and a student learning C must see the characters
they typed. Never re-enable them.

**Spacing and layout.** A 4px-based rem scale (`--space-xs` … `--space-2xl`),
but component padding in the source is often raw rem — `0.625rem 1.25rem` on a
button, `0.875rem 1rem` on a table cell, `1.25rem 1.5rem` on a panel. Keep those
literals; do not snap them to a 4/8 grid. Content maxes at 1200px and centres.
Dashboard rows are `3fr 2fr` or `minmax(0,1fr) clamp(230px,24%,300px)` with
1.25rem gaps; card grids are `repeat(auto-fill, minmax(280px, 1fr))` with a 1rem
gap. The sidebar is a fixed 72px rail that expands to 260px. Panes are separate
rounded surfaces floating on the body colour with a small outer padding — not
edge-to-edge columns.

**Corners.** Nothing is square. 6px on tags and score badges, 10px on buttons,
inputs and list rows, 16px on cards, 24px on panes and modals, fully rounded on
pills, badges and the search field.

**Cards.** The standard card is: surface fill + a 5–10% 135° indigo→cyan tint,
1px `--border-color`, 16px radius, `inset 0 1px 1px rgba(255,255,255,0.03)` for a
lit top bevel, plus `--shadow-sm`. On hover it lifts 3px, the border goes 30%
indigo, the tint strengthens, the shadow becomes an indigo-tinted
`0 10px 20px`, and a 3px indigo→cyan bar fades in along the top edge. Panels
(dashboard sections) are flatter: no tint, 24px radius, an uppercase eyebrow
header instead of a heading.

**Shadows come in two systems.** Neutral elevation (`--shadow-sm` → `xl`,
theme-aware — much heavier alphas in dark) for surfaces sitting above other
surfaces; and *coloured glow* (`0 0 20px var(--color-primary-glow)`) for anything
active, hovered or gamified. Glow is the affordance; shadow is the geometry. Cards
also carry the inset white hairline; buttons carry `0 2px 8px` of their own colour.

**Transparency and blur.** Used in three places only: modal scrims
(`rgba(0,0,0,0.55)` at 10px blur — 0.7 at 16px for the launch dialog), glass
stat tiles (80% surface at 12px blur) and the analytics panels (40% surface at
16px blur with an `inset 0 1px 0 rgba(255,255,255,0.05)` top highlight). Nothing
else is translucent; content panes are opaque.

**Motion.** Four durations (150 / 250 / 400ms, plus a 300ms spring) and three
curves. The signature is `cubic-bezier(0.34, 1.56, 0.64, 1)` — a real 1.56
overshoot — used on hover lifts and icon pops: icons scale to 1.12–1.15 and
sometimes rotate -5°. Dialogs deliberately *don't* spring: they rise 12px and
scale from 0.985 on `cubic-bezier(0.16, 1, 0.3, 1)`, because the bounce read as
clunky at modal size. Structural transitions (sidebar width, tree expand) use
`cubic-bezier(0.4, 0, 0.2, 1)` at 200–300ms. Entrances are `fadeInUp` (16px) and
`scaleIn` (0.92); lists stagger children at 50ms intervals. Ambient loops exist
but are slow and low-amplitude: a 6–8s `float` on hero orbs and empty-state
glyphs, a 2s `glowPulse` on active elements, a 1.4s shimmer on skeletons. Errors
shake. Everything collapses to static under `prefers-reduced-motion`.

**Hover, focus, press.** Hover = lift (1px on buttons, 2–4px on cards/tiles) +
border shifts to the accent + coloured glow appears; secondary surfaces also
brighten one step (`--bg-surface-hover`). Nav rows and tree rows nudge 2–3px
right instead of lifting. Press = `scale(0.97)`, no colour change. Focus = a
single treatment everywhere: `2px solid var(--color-primary)` outline at 2px
offset. Inputs are the exception — focus swaps the border to indigo with *no*
ring; the search field is the exception to the exception and does get a 3px glow
ring. Disabled = `opacity: 0.5`, `cursor: not-allowed`, no transform.

**The active-state rail.** Selection anywhere in the app is a 3px cyan bar with
a `2px 0 8px` cyan glow on the element's left edge, plus a radial cyan wash from
that edge. The library tree inverts it — the rail sits on the *right* edge and is
colour-coded by depth (indigo, cyan, green, amber, red for levels 0–4).

**Backgrounds.** No photography, no illustration, no texture, no pattern. Depth
comes from four things: the theme's body colour, layered translucent surfaces,
large soft radial orbs at 9–13% alpha drifting behind heroes and the analytics
page, and the low-alpha diagonal tint washes. If you need visual interest, reach
for a radial glow, not an image.

---

# Iconography

**Lucide, exclusively.** The source loads `lucide@0.408.0` from unpkg and calls
`lucide.createIcons()` after every render. There is no icon font, no SVG sprite
and no PNG icon in the repository — so this system links Lucide from CDN rather
than vendoring assets. The `Icon` component wraps that call.

```html
<script src="https://unpkg.com/lucide@0.408.0/dist/umd/lucide.min.js"></script>
```

**Sizes.** 12–14px inline with text and in eyebrow headers, 16px default (button
glyphs, table cells), 18px for tiles, tree rows and list icons, 22–24px for
sidebar rows and page titles, 28–48px for empty states and modal headers.
Default stroke width throughout — the source never overrides it.

**Colour.** Glyphs inherit `currentColor` except where they carry meaning: cyan
for folders and active state, semantic colours in badges and toasts, and a
36–44px rounded chip with a 12–15% wash behind the icon on stat tiles and quick
actions.

**Vocabulary in the product.** `code-2` (the brand glyph), `home`, `library`,
`bar-chart-3`, `settings`, `git-branch`, `scroll-text`, `search`, `menu`,
`chevron-right`, `folder`, `folder-plus`, `file-code-2`, `lock`, `play`, `save`,
`terminal`, `plus`, `x`, `check`, `check-circle-2`, `alert-circle`,
`alert-triangle`, `info`, `flame`, `target`, `clock`, `trophy`, `swords`,
`calendar-days`, `history`, `repeat`, `zap`, `activity`, `trending-up`, `layers`,
`gauge`, `graduation-cap`, `lightbulb`, `cloud`, `hard-drive`, `download`,
`upload`, `trash-2`, `pencil`, `notebook-pen`, `scissors`, `moon`.

**Emoji and unicode.** No emoji anywhere. Unicode is used only in two narrow
places: `‹ ›` in pagination and `✕` on the editor's file-tab close affordance
(both lifted from the source CSS).

**Logo.** `assets/logo.svg` is copied verbatim from the repo's `icons/icon.svg` —
a 512px rounded tile carrying the `code-2` glyph on the indigo→cyan brand
gradient. It is the only mark in the source. Alongside it the app sets the
wordmark in Inter 800–900 with a gradient text fill; there is no separate
wordmark asset, so render the name in type rather than looking for one.

---

## Substitutions and gaps

- **Fonts:** the source loads Inter, JetBrains Mono and Orbitron from Google
  Fonts and ships no local binaries. This system does the same — nothing was
  substituted, but there are also no font files to vendor. If you need offline
  copies, download them from Google Fonts and add `@font-face` rules to
  `tokens/fonts.css`.
- **Icons:** linked from the Lucide CDN at the source's pinned version rather
  than vendored, because the repository contains no icon assets to copy.
- **Not recreated:** the Admin, Visualize and global Search routes. Their CSS was
  not read in enough detail to recreate faithfully; the UI kit shows an honest
  empty state for each rather than an invented layout.
- **No marketing site, no mobile app, no slide template** exists in the source,
  so none were built.
