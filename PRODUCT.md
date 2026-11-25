# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The Deep Echo team: two co-founders plus a few collaborators (including partner-company contacts). They plan daily work, follow up on sales leads with broadcasters and media companies, prepare investor material, and keep track of who owns what. They use it at a desk during the working day, switching between boards many times an hour.

The admin (a co-founder) creates every account by hand, hands out usernames and starting passwords, and resets forgotten passwords from inside the app.

Secondary audience: developers who find the public GitHub repository and want to run their own copy. They get the code only, never access to the team's data or backend.

## Product Purpose

A free team work-management tool that replaces a paid per-seat SaaS: boards of items with typed columns, several views of the same work, updates, notifications and automations. Success means the team runs its daily tracking here instead of spreadsheets or paid tools, without anyone outside the team being able to sign up or see data.

## Positioning

Owned by the team that uses it: free for every seat, hosted on the team's own free-tier backend, closed to outsiders by design, and published as open-source code that others can self-host with their own backend.

## Operating Context

- Replaces a shared spreadsheet (tasks with priority P0–P3, owner, collaborator, status Not started / In progress / Blocked / Completed, deadline, notes, doc link), a sales pipeline sheet (customer, segment, problem, solution, stage, next step, willingness to pay) and a backup/access checklist.
- Team members log in with a username and password created by the admin. No public sign-up.
- Real team data is imported privately through CSV inside the running app; it never goes into the public repository.

## Capabilities and Constraints

- Boards, groups, items, subitems, 13+ column types, Table / Kanban / Timeline / Calendar / Dashboard views, updates with mentions, inbox, My work, automations, command palette, CSV import/export, light and dark themes.
- KPI boards (added 2026-11-25, from a KPI one-pager a co-founder shared as reference): round, milestones vs target, money and runway, investor funnel, sales pipeline, opportunities, weekly activity, readiness, team and hiring, plus a full-screen TV board. Private to their maker until shared. Real figures are typed into the running app, never into the repository.
- Team mode on Firebase (Spark free plan, project `tideline-97832`, eur3): Firestore + Auth, access enforced by `firestore.rules`.
- Admin-only account management: create username/password accounts, reset passwords, remove people. Requires a small server-side function because browsers cannot change another user's password.
- Free-tier only: no paid storage, so file attachments are links, not uploads. No outbound email.
- Name: **Cue** (chosen 2026-11-19, replacing the working name Tideline).

## Brand Commitments

- Name: Cue. Mark: a signal-yellow tile whose C is a clock face with its hand pointing into the gap (`src/components/ui.tsx` Logo, `public/favicon.svg`).
- Visual world: "Departures" (European rail departure posters), chosen by the owner on 2026-11-19 through impeccable (seed a124ccaf). The earlier violet/teal gradient look was rejected as generic and must not return.
- Accounts: usernames + passwords created by the admin; no public sign-up.

## Evidence on Hand

- Real workflow source: `../01_Task Tracking-*/01_Task Tracking/DeepEcho Tasktracking 2026.xlsx` (private; never copy its customers, prices or names into the repo).
- Deep Echo logos exist in the parent folder (`../DeepEcho Logo V1/V2 *.svg|png`).
- No customers, testimonials, user counts or benchmarks for this product exist; none may be invented.

## Product Principles

1. Closed by default: nothing is visible without an admin-created login.
2. Spreadsheet-fast: editing a cell must feel as quick as a sheet.
3. One source, many views: every view edits the same items.
4. The code is public, the data never is.
5. Free forever for the team: stay inside free tiers.

## Accessibility & Inclusion

Keyboard-operable, visible focus, readable contrast in both themes, respects reduced motion. No further product-specific standard established.
