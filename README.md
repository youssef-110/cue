<p align="center">
  <img src="public/favicon.svg" width="72" height="72" alt="Cue logo" />
</p>

<h1 align="center">Cue</h1>

<p align="center">
  Free, open-source work management, built by the Deep Echo team for itself.<br />
  Boards, typed columns, seven views and automations. MIT licensed.
</p>

<p align="center">
  <a href="https://youssef-110.github.io/tideline/">Website</a>
</p>

---

Cue is the work manager the Deep Echo team runs its day on: tasks, sales leads and investor prep, each on its own board. Items carry typed columns, the same board opens as a table, a Kanban, a timeline, a calendar and more, and small automations handle the follow-ups.

The team's hosted workspace is private. There is no public sign-up: the team's admin creates every login. The code is public, so anyone can run their own copy with their own free Firebase project. Your data stays in your backend; nothing from ours is in this repository.

## Features

**Boards**
- Boards with coloured, collapsible groups, items and subitems
- 26 column types: status, priority, people, date, timeline, text, long text, numbers, tags, checkbox, link, rating, progress, formula, time tracking, dependency, connect boards, mirror, file links, email, phone, location, vote, creation log, last updated and item ID
- Board templates to start from
- CSV and Excel (.xlsx) import with column-type detection, and CSV export
- Archive and trash, with restore

**Views**
- **Table**: groups, inline editing, typed cells
- **Kanban**: drag cards between status columns
- **Timeline**: a Gantt view of any timeline column, with dependencies and a line for today
- **Calendar**: dated items on a month grid
- **Dashboard**: counts and charts from the board's data, plus dashboards that combine several boards
- **Workload**: each person's load per week against a capacity
- **Docs**: markdown pages beside the boards, with checklists and links

**Working together**
- Updates on every item, with @mentions
- Inbox for mentions and changes
- **My work**: everything assigned to you across all boards
- Realtime sync for the whole team through Firebase

**Automations** (no code)
- Triggers: a status changes, any column changes, a person is assigned, an item is created, a date arrives or is near, or a recurring schedule (every day or every Monday)
- Actions: move to a group, notify, assign, set a status or date, create an item on another board, clear a column, archive or duplicate

**Accounts** (team mode)
- Username and password logins created by an admin; no public sign-up
- Admin, member and viewer roles
- The admin resets forgotten passwords; people choose their own password at their next sign-in

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

Open <http://localhost:5173/app.html>. With no Firebase config, Cue runs in **local mode**: boards are saved in your browser's storage, no account is needed, and nothing leaves your machine.

The website lives at <http://localhost:5173/> (`index.html`); the product is `app.html`.

## Team mode with Firebase

Team mode shares boards in realtime and puts the workspace behind admin-created logins. It runs on a free Firebase project (Spark plan) plus one small serverless function for account management.

Logins are usernames. Firebase Auth needs an email address, so each username is stored as `<username>@cue.invalid`, a reserved domain: no mail is ever sent.

1. **Create a project** at [console.firebase.google.com](https://console.firebase.google.com).
2. **Turn on sign-in:** Build → Authentication → Get started → **Email/Password** → Enable.
3. **Create the database:** Build → Firestore Database → Create database → **production mode**.
4. **Register a web app:** Project settings → Your apps → Web (`</>`). Copy the config into `.env.production` (and `.env.local` for development). See [`.env.example`](.env.example).

   ```bash
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project
   VITE_FIREBASE_APP_ID=...
   ```

5. **Deploy the security rules** with the owner's login. Pick the owner's username now; the rules only let that login claim a fresh workspace.

   ```bash
   npx firebase login
   npx firebase use your-project
   TIDELINE_OWNER_EMAIL=yourname@cue.invalid npm run deploy:rules
   ```

6. **Deploy the admin server.** Browsers cannot create accounts or change another person's password, so the admin's Team screen calls [`api/team.ts`](api/team.ts), a Vercel serverless function. It checks that the caller is a signed-in admin before doing anything. It needs **no key file**: Vercel's per-request OIDC token is exchanged for Google credentials through workload identity federation.

   - In Google Cloud (your Firebase project): enable the IAM, IAM Service Account Credentials and Security Token Service APIs; create a service account with **Firebase Authentication Admin** and **Cloud Datastore User**; create a workload identity pool `vercel` with an OIDC provider `vercel` (issuer `https://oidc.vercel.com/<team-slug>`, audience `https://vercel.com/<team-slug>`, mapping `google.subject = assertion.sub`, condition `assertion.sub == "owner:<team-slug>:project:<project>:environment:production"`); grant that principal **Workload Identity User** on the service account.
   - Edit the project number, project id and service-account email at the top of `api/team.ts`.
   - On Vercel set `ALLOWED_ORIGINS`: a comma-separated list of the origins your site is served from.

   The app calls `/api/team` by default, which works when the site and the function are deployed together. If the site is hosted elsewhere, such as GitHub Pages, set `VITE_ADMIN_API` to the function's full URL at build time.

7. **Set up the owner.** Open the app, choose **New workspace setup**, and create the owner account with the username from step 5. Then press **Claim workspace**. This works once; that login becomes the admin.
8. **Create the team's logins** from the **Team** screen: a username, a name, a role (admin, member or viewer) and a starting password. Hand the details over yourself. Each person picks their own password at first sign-in. Forgotten passwords are reset from the same screen, and removing someone signs them out and deletes their login.

Access is enforced by [`firestore.rules`](firestore.rules): only team members can read or write, viewers can only read, comments and activity are bound to their author, and only the server function manages accounts. The web config is not a secret; the rules are what protect the data. Test them locally with `npm run test:rules` (needs Java), or run the whole app against local emulators with `npm run emulators` plus a `.env.local` that sets `VITE_FIREBASE_EMULATOR=1`.

## Deploy

`npm run build` produces a static site in `dist/` (with `base: './'`, so it works from any sub-path). Any static host works. In Firebase → Authentication → Settings → **Authorized domains**, add the domain you deploy to.

### GitHub Pages

A workflow is included at [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). It builds and deploys on every push to `main`, and can be run by hand from the Actions tab.

1. In your repository, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
2. Commit your `.env.production` (the Firebase web config, plus `VITE_ADMIN_API` for team mode), or leave it out to deploy in local mode.
3. Push to `main`.

Your site will be at `https://<user>.github.io/<repo>/`, with the app at `.../app.html`. GitHub Pages serves static files only, so the admin server needs to run somewhere else, such as Vercel.

### Vercel

Import the repository in Vercel. It detects Vite (build command `npm run build`, output directory `dist`) and deploys `api/team.ts` as a function next to the site. Add `ALLOWED_ORIGINS` in the project's environment variables and set up workload identity as in step 6. From the command line:

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
- [Tailwind CSS v4](https://tailwindcss.com), with Barlow, Barlow Condensed and JetBrains Mono self-hosted through Fontsource
- [Motion](https://motion.dev) for animation
- [Zustand](https://zustand.docs.pmnd.rs) for state
- [dnd-kit](https://dndkit.com) for drag and drop
- [cmdk](https://cmdk.paco.me) for the command palette
- [Recharts](https://recharts.org) for dashboard charts
- [read-excel-file](https://gitlab.com/catamphetamine/read-excel-file) for .xlsx import
- [date-fns](https://date-fns.org), [lucide-react](https://lucide.dev) icons, [Sonner](https://sonner.emilkowal.ski) toasts
- [Firebase](https://firebase.google.com) (Auth, Firestore) for team mode, and `firebase-admin` in the admin server

## Project structure

```
.
├── index.html               # Website entry
├── app.html                 # Product entry
├── public/                  # Static assets (favicon, social card)
├── api/team.ts              # Admin server: create logins, reset passwords, roles, removal
├── firestore.rules          # Who can read/write what in team mode
├── scripts/build-rules.mjs  # Fills the owner login into the rules before deploy
├── tests/                   # Rules tests (npm run test:rules) and markdown tests
├── src/
│   ├── main.tsx             # App bootstrap
│   ├── App.tsx              # App shell and routing between pages
│   ├── index.css            # Design tokens and global styles (shared by site and app)
│   ├── components/          # Shared UI: cells, sidebar, automations, team, primitives
│   ├── views/               # Table, Kanban, Timeline, Calendar, Dashboard and Workload views
│   ├── pages/               # Board, Docs, My work, Inbox, Archive, sign-in and other pages
│   ├── lib/                 # Types, store, sync (local and Firebase), team, seed data, CSV
│   └── landing/             # Website components
└── .github/workflows/
    └── deploy.yml           # Build and deploy to GitHub Pages
```

## Contributing

Issues and pull requests are welcome. Run `npm run lint` and `npm run build` before opening a pull request.

## License

[MIT](LICENSE) © 2026 Deep Echo
