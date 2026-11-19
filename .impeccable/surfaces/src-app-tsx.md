---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: ["app.html","src/main.tsx"]
---

# Cue app (Operate)

Scope: the signed-in product at app.html: shell, boards, all five views plus workload, item panel, team, auth screens. Visitor mode: Operate.
Audience and job: the Deep Echo team (founders + collaborators) running daily tasks, a sales pipeline and investor prep all day at a desk; the admin also manages logins.
Constraints: standard web controls; spreadsheet-fast editing; both light and dark; free tier only.

## Direction contract

THESIS: The team's day set as a departure board: deadlines run like train times, delays called out in red, the board name hung like a station sign. Refuses the category default of a white canvas with full-colour status blocks and a violet brand accent.

OWN-WORLD: Signal yellow #F6D11F owns the shell header band and the brand mark; ink #121212 owns the nav rail; tables sit on white with 1px #E6E6E1 rules and a 2px ink rule under column headers. Red #D3242B is reserved for exceptions (blocked, overdue, delay). Platform blue #1D4FB8 is selection, focus and links. Barlow Condensed caps for titles, group and column headers; Barlow for body; JetBrains Mono for every date, time, count and ID. Statuses are small solid tags, never filled cells.

STORY: Open a board and read it like a departures board: what leaves next, who owns it, what is late. Edit any cell in place, switch views without losing your place, and trust that red only ever means something is wrong.

FIRST VIEWPORT: Ink rail left (Cue mark, boards, My work, Inbox badge, Team). Yellow band across the top of the board area: breadcrumb, board name in large condensed caps, a mono status line (items · in progress · delayed · now), view tabs at its bottom edge. Toolbar under it with the black New item button first. The grouped table fills the rest, Deadline as the leading time column, overdue rows carrying a red +Nd delay tag.

FORM: Departures (European rail departure posters), position 2 on the ordered list, taken as impeccable's pick; seed key a124ccaf.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Signature interaction: deadline cells render as timetable times (day small, time large tabular); overdue items get a +Nd delay tag; the status line in the band updates live.
Motion grammar: flap-board style quick vertical ticks (120ms) when a status or deadline changes; no springy bounces, no glows, no gradients.
