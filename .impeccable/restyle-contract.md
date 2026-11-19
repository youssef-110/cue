# Cue restyle contract (shared by all restyle agents)

Product: Cue, the Deep Echo team's work-management app (boards, items, typed columns, views). Read PRODUCT.md and .impeccable/surfaces/src-app-tsx.md first.

World: "Departures" — European rail departure posters and station departure boards. The world lends ONLY type, palette, density and one signature move. Layout, navigation and controls stay standard, excellent web product UI.

Tokens (already defined in src/index.css — use the Tailwind classes, never raw hex except label colours from data):
- Grounds: bg-bg (warm paper #f4f3ee), bg-panel (white), bg-panel-2, bg-hover; rules border-line (#e3e2db), border-line-strong.
- Text: text-fg (#121212), text-muted, text-faint.
- bg-signal / text-on-signal: signal yellow #f6d11f — the board header band, the brand mark, the "done" label, ::selection. Never as a page ground.
- bg-ink / text-on-ink / text-on-ink-muted: the nav rail and primary buttons (in dark mode primary buttons are signal yellow).
- text-alert / bg-alert / bg-alert-soft: red #d3242b — ONLY exceptions: blocked, overdue, delay tags, destructive actions, errors.
- text-accent / bg-accent-soft: platform blue #1d4fb8 — selection, focus, links, the selected row (2px left edge + soft tint is NOT allowed; use a soft tint row background and a blue 1px inset outline instead).
- Radii are small: rounded-sm (3px) chips, rounded-md (4px) buttons/inputs, rounded-lg (6px) popovers/panels. No pills except avatars.
- Fonts: font-display (Barlow Condensed) via the `.caps` utility for board titles, group headers, column headers, section titles, tabs — uppercase, tracked. font-sans (Barlow) body 13.5–14px. font-mono (JetBrains Mono) for every date, time, number, count, ID, timer.
- Label fills come from data (seed COLORS = timetable inks). Text on any label fill MUST use `inkOn(color)` from src/lib/seed.ts (yellow "Done" gets ink text).

Signature move: deadlines read like departure times. Date cells show the day small ("21 NOV" in mono caps, text-faint) above/beside the time-like big date or, for date-only values, "THU 21 NOV" with the day number large; overdue (not done) items get a red mono delay tag "+2d" (days late). The board header is a station sign: a full-width yellow band with breadcrumb, board name in large condensed caps (36–44px), a mono status line "7 ITEMS · 3 IN PROGRESS · 1 DELAYED · THU 19 NOV 10:42", and the view tabs sitting on the band's bottom edge (active tab joins the white/paper area below).

Motion: one grammar — quick 120ms "flap" tick (the `.flap` class in index.css, keyed on value change) when a status or date changes; panel/popover entrances are 120–160ms ease-out fades with ≤4px travel. No springs/bounces, no scale-on-hover, no glow, no gradients, no glass/backdrop blur, no decorative blobs, no emoji icons, no coloured side-borders thicker than 1px on cards (group colour may be a 4px square swatch next to the group title, or a 3px top rule on the group table — not a left bar).

Statuses/priorities: small solid rectangular tags (rounded-sm, 12px caps font-display, tracking) — never full-bleed filled cells. Empty status = a dashed 1px outline tag "—".

People: round initials avatars are fine but use ink/neutral fills from the user's colour at small size; no gradients.

Craft floor (from impeccable): body text ≥4.5:1 contrast, large ≥3:1; tight groups, more space above a heading than below; real hover/focus/disabled/empty/loading/error states; theme scrollbars/selection/focus via tokens (already in index.css); copy names actions plainly; no eyebrow/kicker labels above headings; no hero-metric templates; no identical card grids as page structure; no nested cards; mono only for data.

Must keep: every feature and behaviour (do not remove functionality, props, handlers, accessibility labels). Only change presentation and microcopy that is generic. Keep TypeScript passing: run `npx tsc -p tsconfig.app.json --noEmit` before finishing and fix your own errors. Don't run git. Don't add npm dependencies. Other agents are restyling other files in parallel — only edit your assigned files; if you need a shared primitive changed in a file you don't own, report it instead.
