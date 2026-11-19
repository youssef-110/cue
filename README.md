<p align="center">
  <img src="public/favicon.svg" width="72" height="72" alt="Tideline logo" />
</p>

<h1 align="center">Tideline</h1>

<p align="center">
  Free, open-source work management for small teams.<br />
  Boards, timelines, dashboards and automations. Free forever, every seat.
</p>

---

Tideline is a team work OS you host yourself. Plan projects on boards with typed columns, look at the same work as a table, a Kanban board, a Gantt timeline, a calendar or a dashboard, and let simple automations handle the busywork. Run it in your browser with zero setup, or connect a free Supabase project to work together in realtime.

It was built by the Deep Echo team to run their own work, and released under the MIT license for any small team that wants a polished tool without per-seat pricing.

## Features

**Boards**
- Boards with coloured, collapsible groups and items
- 13 column types: status, priority, people, date, timeline, text, long text, number, tags, checkbox, link, rating and progress
- Board templates to start from: product roadmap, team tasks, content calendar and more
- CSV import with automatic column-type detection (status, people, dates, numbers, links) and CSV export

**Views**
- **Table**: groups, inline editing, typed cells
- **Kanban**: drag cards between status columns
- **Timeline**: a Gantt view of any timeline column, with a line for today
- **Calendar**: dated items on a month grid
- **Dashboard**: counts and charts built from the board's own data

**Collaboration**
- Item updates and comments with @mentions and likes
- Activity log on every item
- Notifications inbox
- **My work**: everything assigned to you across all boards, sorted by date
- Realtime sync for the whole team through Supabase

**Automations** (no code)
- When a status changes: move the item to a group, notify someone, set a status, assign a person or set a date
- When an item is created
- When a date arrives

**Speed**
- Command palette with <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>K</kbd>
- Keyboard shortcuts for the common actions
- Light and dark themes

## Quick start

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open <http://localhost:5173/app.html>. That's it: **local mode needs no setup**. Boards are saved in your browser's storage, and nothing leaves your machine.

The marketing site lives at <http://localhost:5173/> (`index.html`); the product is `app.html`.

## Team mode with Supabase

To share boards with your team in realtime, connect a free Supabase project.

1. **Create a project** at [supabase.com](https://supabase.com). The free tier is enough for a small team.
2. **Create the schema.** In the dashboard, open **SQL Editor**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql) and run it. It creates the `docs` table, a `team_members` allow-list, row-level security so only listed emails can read or write, and enables realtime. **Edit the last statement first** so it lists your teammates' emails (re-run just that `insert` whenever someone joins).
3. **Lock down sign-ups.** In **Authentication → Sign In / Providers** (called **Authentication → Settings** in older dashboards), turn off **Allow new users to sign up**. Then invite each teammate from **Authentication → Users → Invite user**. Only invited people can sign in.
4. **Add your keys.** Copy `.env.example` to `.env` and fill in the values from **Project Settings → API**:

   ```bash
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

5. Restart `npm run dev`. Tideline now asks you to sign in and syncs every change live.

The anon key is safe to ship in a browser app: access is enforced by the row-level security policies in `schema.sql`. Never put the `service_role` key in `.env`.

## Deploy

`npm run build` produces a static site in `dist/` (with `base: './'`, so it works from any sub-path). Any static host works.

### GitHub Pages

A workflow is included at [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). It builds and deploys on every push to `main`, and can be run by hand from the Actions tab.

1. In your repository, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
2. For team mode, go to **Settings → Secrets and variables → Actions** and add two repository secrets: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Leave them out to deploy in local mode; the build succeeds either way.
3. Push to `main`.

Your site will be at `https://<user>.github.io/<repo>/`, with the app at `.../app.html`.

### Vercel

Import the repository in Vercel. It detects Vite automatically (build command `npm run build`, output directory `dist`). Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under **Settings → Environment Variables** for team mode, then deploy. From the command line:

```bash
npx vercel --prod
```

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| <kbd>Ctrl</kbd> + <kbd>K</kbd> / <kbd>⌘</kbd> + <kbd>K</kbd> | Open the command palette |
| <kbd>N</kbd> | New item |
| <kbd>/</kbd> | Search |
| <kbd>Esc</kbd> | Close the open panel |
| <kbd>D</kbd> | Toggle light and dark theme |

## Tech stack

- [React 19](https://react.dev) and TypeScript
- [Vite](https://vite.dev) (multi-page: `index.html` for the site, `app.html` for the app)
- [Tailwind CSS v4](https://tailwindcss.com)
- [Motion](https://motion.dev) for animation
- [Zustand](https://zustand.docs.pmnd.rs) for state
- [dnd-kit](https://dndkit.com) for drag and drop
- [cmdk](https://cmdk.paco.me) for the command palette
- [Recharts](https://recharts.org) for dashboard charts
- [date-fns](https://date-fns.org), [lucide-react](https://lucide.dev) icons, [Sonner](https://sonner.emilkowal.ski) toasts
- [Supabase](https://supabase.com) (Postgres, Auth, Realtime) for team mode

## Project structure

```
.
├── index.html               # Marketing site entry
├── app.html                 # Product entry
├── public/                  # Static assets (favicon, social card)
├── supabase/
│   └── schema.sql           # Table, row-level security and realtime for team mode
├── src/
│   ├── main.tsx             # App bootstrap
│   ├── App.tsx              # App shell and routing between pages
│   ├── index.css            # Design tokens and global styles (shared by site and app)
│   ├── components/          # Shared UI: cells, sidebar, automations, templates, primitives
│   ├── views/               # Table, Kanban, Timeline, Calendar and Dashboard views
│   ├── pages/               # Board, My work, Inbox, sign-in and other pages
│   ├── lib/                 # Types, store, sync (local and Supabase), seed data, CSV
│   └── landing/             # Marketing site components
└── .github/workflows/
    └── deploy.yml           # Build and deploy to GitHub Pages
```

## Contributing

Issues and pull requests are welcome. Run `npm run lint` and `npm run build` before opening a pull request.

## License

[MIT](LICENSE) © 2026 Deep Echo
