---
name: Cue
description: The team's day set as a departure board.
colors:
  signal-yellow: "#f6d11f"
  on-signal: "#121212"
  ink: "#121212"
  on-ink: "#f4f3ee"
  on-ink-muted: "#a9a8a0"
  platform-blue: "#1d4fb8"
  platform-blue-soft: "#e6edfa"
  exception-red: "#d3242b"
  exception-red-soft: "#fbe6e6"
  station-paper: "#f4f3ee"
  panel: "#ffffff"
  panel-2: "#f1f0ea"
  hover: "#ebeae3"
  rule: "#e3e2db"
  rule-strong: "#c9c8bf"
  fg: "#121212"
  muted: "#55554f"
  faint: "#74746e"
  dark-bg: "#121211"
  dark-panel: "#1b1b19"
  dark-panel-2: "#22221f"
  dark-rule: "#2f2f2b"
  dark-rule-strong: "#44443e"
  dark-fg: "#f1f0ea"
  dark-muted: "#b3b2aa"
  dark-faint: "#8c8b84"
  dark-platform-blue: "#6f9bf2"
  dark-exception-red: "#f0565c"
  label-green: "#1f7a4d"
  label-teal: "#0f7c8c"
  label-sky: "#2b7bd0"
  label-violet: "#5b3fa8"
  label-pink: "#b8326b"
  label-orange: "#d9661a"
  label-lime: "#6e8f1e"
  label-slate: "#8a8a84"
  label-graphite: "#3d3d39"
  label-stone: "#c9c8bf"
typography:
  display:
    fontFamily: "Barlow Condensed, Barlow, ui-sans-serif, sans-serif"
    fontSize: "clamp(2.75rem, 10.6vw, 8.75rem)"
    fontWeight: 700
    lineHeight: 0.86
    letterSpacing: "0.005em"
  headline:
    fontFamily: "Barlow Condensed, Barlow, ui-sans-serif, sans-serif"
    fontSize: "44px"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "0.015em"
  title:
    fontFamily: "Barlow Condensed, Barlow, ui-sans-serif, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.1em"
  body:
    fontFamily: "Barlow, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "\"tnum\""
  label:
    fontFamily: "Barlow Condensed, Barlow, ui-sans-serif, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.12em"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1
    fontFeature: "\"tnum\""
  departure-time:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1
    fontFeature: "\"tnum\""
rounded:
  sm: "3px"
  md: "4px"
  lg: "6px"
  xl: "8px"
  2xl: "10px"
spacing:
  control-h: "32px"
  rail-item-h: "36px"
  tab-h: "40px"
  page-x: "32px"
  page-x-narrow: "16px"
  wrap: "1240px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  button-outline:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.fg}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  button-soft:
    backgroundColor: "{colors.panel-2}"
    textColor: "{colors.fg}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  button-ghost:
    textColor: "{colors.muted}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  band:
    backgroundColor: "{colors.signal-yellow}"
    textColor: "{colors.on-signal}"
    padding: "16px 32px 0"
  view-tab-active:
    backgroundColor: "{colors.station-paper}"
    textColor: "{colors.fg}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    height: "40px"
  rail:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
  rail-badge:
    backgroundColor: "{colors.signal-yellow}"
    textColor: "{colors.on-signal}"
    rounded: "{rounded.sm}"
    height: "18px"
  label-pill:
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 8px"
    height: "22px"
  delay-tag:
    backgroundColor: "{colors.exception-red}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "3px 4px"
  avatar:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
    size: "26px"
  input-field:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.fg}"
    rounded: "{rounded.md}"
    height: "32px"
    padding: "0 10px"
---

# Design System: Cue

## Overview

**Creative North Star: "The Departures Board"**

Cue sets a working day the way a European rail station sets its departures: a signal-yellow station sign names the board, an ink rail runs down the left like the platform wall, and every item reads like a train with a time, a destination and an owner. Deadlines are departure times, lateness is a red delay tag, and a changed value ticks into place like a split-flap tile. The rest of the system stays quiet so those signals carry.

Density is spreadsheet-tight: 32px controls, 13 to 14px body, a grouped table that fills the viewport. Surfaces are warm off-white paper ruled with hairlines, not cards floating on grey. Typography does the structural work: condensed caps for anything that would hang on a sign, mono for anything you would read off a timetable, Barlow for everything people write.

The earlier violet and teal gradient look was rejected as generic and does not return. No gradients, no glows, no springy motion.

**Key Characteristics:**
- Signal yellow is a place (the band, the mark, the rail badge), not a decoration.
- Ink owns the rail and the primary action; red only ever means something is wrong; blue is selection, focus and links.
- Condensed caps for sign voice, JetBrains Mono for every date, time, count and ID, Barlow for prose.
- Hairline rules and a 2px heavy rule under every column or section header.
- Flap-board ticks (120ms, vertical) when a value changes; nothing bounces.

## Colors

A three-signal palette on warm paper: yellow for the sign, ink for the wall, red for exceptions, with platform blue as the one interactive accent.

### Primary
- **Signal Yellow** (`signal-yellow`): the board band across the top of every board, the Cue mark tile, the unread badge on the rail, the landing hero and text selection. In dark theme the band inverts into a lit departure board: ink ground with yellow type (about 13:1), done by overriding the band's theme colours, not the token.
- **Station Ink** (`ink`): the nav rail, the primary button (New item, Open the team workspace), avatars, the heavy 2px rule under the band in light, and the darkest priority tag (P0 / Critical).

### Secondary
- **Platform Blue** (`platform-blue`, dark `dark-platform-blue`): focus rings, selected rows and menu items (on `platform-blue-soft`), links, caret and native control accent. Never decoration; as a fill it appears only as the indigo label swatch.

### Tertiary
- **Exception Red** (`exception-red`, dark `dark-exception-red`): delay tags (+Nd), overdue deadline digits, the "delayed" count in the status line, destructive menu items (on `exception-red-soft`), the Stuck / Blocked label.

### Neutral
- **Station Paper** (`station-paper`): the page ground and the active view tab, which joins the band to the page below.
- **Panel White** (`panel`) and **Panel Two** (`panel-2`): table body, popovers, soft buttons and quiet filled states.
- **Hover Stone** (`hover`): row and menu hover.
- **Hairline** (`rule`) and **Strong Rule** (`rule-strong`): 1px table rules and control borders; strong rule also styles the scrollbar thumb.
- **Ink Text** (`fg`), **Muted** (`muted`), **Faint** (`faint`): text in three weights of attention. Faint carries placeholders, weekday/month parts of a deadline, and timestamps.
- **On-Ink Muted** (`on-ink-muted`): secondary text and icons on the rail.

### Label palette
User labels (status, priority, tags, groups) pick from a fixed set of 14 colours in `src/lib/seed.ts`: green, teal, sky, indigo (= platform blue), violet, pink, red (= exception red), orange, amber (= signal yellow), lime, slate, graphite, stone, ink. Text on a filled label is chosen by luminance (ink above 0.19 relative luminance, white below). Default status labels: Not started slate, Working on it / In progress indigo, Stuck / Blocked red, Done / Completed amber. Default priorities step down the greys: ink, graphite, slate, stone.

### Named Rules
**The Red Means Wrong Rule.** Exception red appears only where something is late, blocked or destructive. If nothing is wrong on a screen, no red is on it.

**The Blue Is Selection Rule.** Platform blue marks where you are and what you selected (focus, selection, links). Outside the label palette, where indigo is the default In progress colour, it never fills a surface or a heading.

**The Sign Is Yellow Rule.** Signal yellow fills whole shapes (band, hero, mark tile, badge, the Done label pill) and is never used as a thin accent line or text colour on paper.

## Typography

**Display Font:** Barlow Condensed 600/700 (with Barlow, ui-sans-serif)
**Body Font:** Barlow 400/500/600 (with ui-sans-serif, system-ui)
**Label/Mono Font:** JetBrains Mono 400/500 (with ui-monospace)

All three are self-hosted through @fontsource. Body numerals are tabular everywhere.

**Character:** Condensed grotesque caps read like enamel station signage; mono digits read like the board itself. Barlow keeps written content plain and legible at 14px.

### Hierarchy
- **Display** (700, clamp(2.75rem, 10.6vw, 8.75rem), 0.86, uppercase): landing hero only. Section heads on the landing step down to clamp(2.5rem, 5vw, 4rem) at 0.88.
- **Headline** (700, 44px / 30px under 640px, 1.02, uppercase, 0.015em): the board name on the band.
- **Title** (600, 15px, uppercase, 0.1em): view tabs, panel titles such as Activity.
- **Body** (400, 14px app / 16px landing): cell text, descriptions (max 72ch on the band), menus at 13.5px.
- **Label** (600, 12px, uppercase, 0.08 to 0.14em): column headers, breadcrumbs, label pills, section headers in popovers.
- **Mono** (500, 13px, uppercase where it is a date): status line, counts, keyboard hints, IDs, timestamps.
- **Departure time** (600, 17px day digits flanked by 11px weekday and month caps): deadline cells.

### Named Rules
**The Timetable Rule.** Every date, time, count and ID is set in JetBrains Mono with tabular figures. Prose never is.

**The Sign Voice Rule.** Condensed caps (the `.caps` treatment: Barlow Condensed, uppercase, 0.04em minimum tracking) are for things that would hang on a sign: names, headers, tabs, labels. Never for sentences.

## Layout

The app is a two-column shell: a collapsible ink rail on the left (64px header row, 36px nav items) and the board area on the right. The board area stacks the yellow band (16px top padding, 32px side padding, 16px on phones), a 16px-padded toolbar with the primary action first, then the view filling the rest. View tabs sit on the band's bottom edge with a -2px overlap so the active tab joins the page ground; on narrow screens they scroll horizontally inside the band.

Controls share one 32px height (buttons, search, filters); rail rows are 36px, tabs 40px, menu rows 32px, label pills 22px. Gaps step in 4px units (6, 8, 10, 16, 24px).

The landing uses a 1240px wrap with 16px / 32px gutters, a full-bleed yellow hero, and an always-dark departure board that overlaps the hero's bottom edge by 96 to 112px. The board's five columns collapse to four under 1024px and to a two-column time-plus-task stack under 640px.

## Elevation & Depth

The system is flat and ruled. Depth comes from rules and ground changes (paper, white panel, yellow band, ink rail), not shadows. Shadows exist only for things that float above the page: popovers, menus, modals and the landing's departure board.

### Shadow Vocabulary
- **Pop** (`0 2px 4px rgb(18 18 18 / 0.06), 0 12px 28px -6px rgb(18 18 18 / 0.22)`): popovers, menus, dialogs.
- **Card** (`0 1px 2px rgb(18 18 18 / 0.06)`): the faintest lift for a resting card.
- **Board** (`0 2px 4px rgb(18 18 18 / 0.08), 0 24px 48px -16px rgb(18 18 18 / 0.35)`): the landing departure board only.

### Named Rules
**The Ruled Not Raised Rule.** Separate content with a 1px hairline; mark the start of a table or section with a 2px rule in the foreground colour. Reach for a shadow only when the element floats.

## Shapes

Corners are barely softened, like enamel signs: 3px for tags, pills, badges and menu rows, 4px for buttons, inputs and tabs (top corners only on tabs), 6px for popovers and the landing board. Avatars are the only circles. Label swatches inside outline tags are hard 7px squares. Split-flap tiles on the landing are 2px with a 1px dark seam across the middle.

## Components

### Buttons
Plain, dense and decisive.
- **Shape:** 4px corners, 32px tall, 12px side padding, 13.5px medium text, 16px icons.
- **Primary:** ink fill with paper text, semibold; hover drops to 85% ink. In dark theme it becomes signal yellow with ink text. One per toolbar, placed first.
- **Outline:** white panel with a strong-rule border; hover takes the hover stone.
- **Soft:** panel-two fill with a strong-rule border; doubles as the "on" state of toolbar toggles (`aria-pressed`).
- **Ghost:** muted text, no border; hover fills hover stone and darkens text.
- **Focus:** 2px platform-blue outline, 2px offset, everywhere. On the landing hero the focus outline switches to ink so it stays visible on yellow.
- **Disabled:** 45% opacity, no pointer events.

### Label pills and tags
- **Status / priority pill:** solid label colour, 22px tall, 3px corners, condensed caps 12px at 0.08em, text colour chosen by luminance. An empty value is a dashed strong-rule pill with a faint dash. A new value ticks in with the flap animation.
- **Tag (multi-select):** outline only, strong-rule border, 7px square swatch, 12px medium text; selected tags take a blue border on blue-soft.
- **Ink-filled tags in dark:** any label filled with ink gets an inset 1px muted hairline so it does not vanish on the dark ground.

### Inputs / Fields
- **Style:** white panel, strong-rule 1px border, 4px corners, 32px tall, 13 to 13.5px text, faint placeholder, keyboard hint in faint mono.
- **Focus:** border turns platform blue (the global blue outline also applies on keyboard focus).

### Navigation
- **Rail:** ink ground, paper text at 80%, muted icons. Hover lays a 7% paper wash; the current page gets a 12% wash, medium weight and a signal-yellow icon. Unread counts are signal-yellow mono badges. A hairline at 10% paper separates the account footer.
- **View tabs:** condensed caps 15px at 0.1em on the band; inactive tabs are 80% ink-on-yellow with a 10% ink wash on hover; the active tab takes the page ground and joins the content below.

### Avatar
Neutral ink circle with paper initials (40% of size, semibold). In dark it becomes a raised panel circle with a strong-rule hairline. Stacks overlap by 6px with a ring in the surface colour behind them (yellow on the band).

### Board band (signature)
The station sign: signal-yellow header with a 2px ink bottom rule, condensed-caps breadcrumb (12.5px, 0.12em), the board name in 44px condensed caps, a mono status line (items · in progress · delayed · current day and time), an optional description at 80% ink, and the view tabs on its bottom edge. The delayed count becomes a red tag only when it is above zero. In dark, the band is an ink board with yellow type.

### Departure time (signature)
A deadline reads like a departure: weekday caps (11px faint), day digits (17px semibold), month caps (11px faint), all mono and tabular. Late items turn all three red and add a solid red `+Nd` delay tag; an item due today gets an outlined condensed-caps TODAY tag in the foreground colour. Done items drop the digits to muted. The cell is keyed by date, so a change ticks in with the flap animation.

### Cue mark
A signal-yellow 32-unit tile with 5-unit corners whose ink C is a clock face, the hand pointing into the gap. The wordmark sets "Cue" in Barlow Condensed bold beside it, on ink or paper.

### KPI board (signature)
The company's numbers set like a station: the yellow band names the KPI board with a mono status line (targets met · late · updated), an ink service-notice strip calls out the nearest open deadline (yellow NEXT DEADLINE tag, red LATE +Nd tag when overdue), and ruled panels follow. Charts use one emphasis mark against slate context: `--chart-hi` is ink on paper and signal yellow in dark, `--chart-lo` slate, `--chart-soft` stone for pending amounts, `--chart-track` the unfilled track. Gauges, donuts and radar charts are deliberately replaced by meters (actual vs target), a 28px segmented bar (round composition), stage ladders (furthest stage on top, names under each bar), five signal lamps per readiness area, and small-multiple weekly columns. Figures are JetBrains Mono. The **TV board** is always the lit departure board (ink ground, signal-yellow name, split-flap tiles for the clock and the round's percent), sized in em from `min(1.02vw, 1.82vh)` so it fills any screen without scrolling.

### Team calendar (signature)
The team's schedule set like a timetable: the yellow band names the Calendar with a mono status line (a solid ink NOW tag with what is on and until when, an outlined NEXT tag with the next event), and Day / Week / Month sit on the band's bottom edge as view tabs. Day names and digits are mono like the departure time; today's digits sit on an ink tile (signal yellow in dark), the same tile marks today in the mini month. The grid is ruled, not boxed: hour hairlines, half-hour rules at half strength, weekends on panel-two, and a 2px foreground rule under the day header. The now line is a 2px foreground rule with a dot, and the current time sits in an ink tag in the hour gutter; never red, since nothing is wrong. Each person has one colour from the label palette minus red, the greys and ink (`personColors` in `src/lib/calendar.ts`, the same for every viewer), shown as a 3px left bar on a quiet fill mixed into the surface (`--cal-tint`, 16% in light and 30% in dark, stronger while dragged). Event titles are Barlow (people write them), times are mono. A drag-selection and a selected event are platform blue: they mark what you are choosing. Overlapping events split the column side by side.

### Motion
- **Flap** (120ms, `cubic-bezier(0.2, 0.7, 0.2, 1)`, from -35% Y and transparent): any value that changes in place.
- **Popover** (140ms in on the same curve with a 4px drift, 100ms fade out).
- Reduced motion collapses all animation and transition to near zero.

## Do's and Don'ts

### Do:
- **Do** put the signal-yellow band on every board and keep the ink rail on the left.
- **Do** set every date, time, count and ID in JetBrains Mono with tabular figures.
- **Do** rule tables with 1px hairlines and put a 2px foreground rule under every column or section header.
- **Do** use exception red only for late, blocked, delayed or destructive states, and show lateness as a `+Nd` delay tag.
- **Do** use platform blue for focus (2px outline, 2px offset), selection and links only.
- **Do** keep controls at 32px with 4px corners, and lead each toolbar with the ink primary button.
- **Do** tick changed values in with the 120ms flap animation and respect reduced motion.

### Don't:
- **Don't** bring back the violet and teal gradient look, or any gradient or glow.
- **Don't** use red for emphasis, branding or a heading.
- **Don't** use blue as a decorative accent or a fill outside label pills.
- **Don't** fill whole table cells with status colour; statuses are small solid pills.
- **Don't** add shadows to resting content; only floating layers get Pop.
- **Don't** set sentences in condensed caps.
- **Don't** use springy or bouncing motion.
