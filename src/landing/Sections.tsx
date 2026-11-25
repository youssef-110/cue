import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'
import cx from 'clsx'
import { REPO_URL, SectionHead, Tag, WRAP } from './shared'
import { CalendarMock, DashboardMock, DocsMock, KanbanMock, TableMock, TimelineMock, WorkloadMock } from './ViewMocks'

const C = { done: '#f6d11f', stuck: '#d3242b', work: '#1d4fb8', won: '#1f7a4d', teal: '#0f7c8c' }

/* ───────────────────────── What Cue is ───────────────────────── */

const ALSO: [string, string?][] = [
  ['Subitems under any item'],
  ['Updates with @mentions'],
  ['Inbox for mentions and changes'],
  ['My work across every board'],
  ['Dashboards across several boards'],
  ['KPI boards, and a TV board for the office'],
  ['Archive and trash, with restore'],
  ['CSV and Excel import, CSV export'],
  ['Command palette', 'Ctrl K'],
  ['Keyboard shortcuts', 'N  /  D'],
  ['Light and dark themes'],
]

export function WhatIs() {
  return (
    <section aria-labelledby="what" className={cx(WRAP, 'pt-24 sm:pt-32')}>
      <SectionHead id="what" title="Built by the team that runs on it" />
      <div className="grid gap-x-12 gap-y-10 pt-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <p className="max-w-[34ch] text-[clamp(1.35rem,2.4vw,1.75rem)] leading-[1.32] font-medium text-pretty">
          Cue is the work manager the Deep Echo team uses every day: tasks, sales leads and investor prep, each on its own board. Items carry typed columns, the same board opens in ten views, and small automations
          handle the follow-ups. Free for every seat, open source under MIT, and closed to everyone outside the team.
        </p>
        <div>
          <h3 className="caps border-b-2 border-fg pb-2 text-[13px] font-semibold tracking-[0.14em]">Also on the line</h3>
          <ul className="grid sm:grid-cols-2 sm:gap-x-8">
            {ALSO.map(([t, k]) => (
              <li key={t} className="flex min-h-[40px] items-center justify-between gap-3 border-b border-line text-[15px]">
                {t}
                {k && <kbd className="rounded-sm border border-line-strong px-1.5 py-0.5 font-mono text-[11px] whitespace-pre text-muted">{k}</kbd>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

/* ───────────────────────── Views ───────────────────────── */

const VIEWS: { name: string; text: string; mock: () => ReactNode }[] = [
  { name: 'Table', text: 'Groups of items with typed cells you edit in place, as quickly as a spreadsheet. Deadlines read like departure times.', mock: TableMock },
  { name: 'Kanban', text: 'Cards in status columns. Drag a card across and its status changes on every other view.', mock: KanbanMock },
  { name: 'Timeline', text: 'A Gantt chart of any timeline column, with dependencies drawn between items and a line for today.', mock: TimelineMock },
  { name: 'Calendar', text: 'Every dated item on a month grid, so the week ahead is one glance.', mock: CalendarMock },
  { name: 'Dashboard', text: 'Counts and charts built from the board’s own data. A dashboard can also combine several boards.', mock: DashboardMock },
  { name: 'Workload', text: 'Each person’s load per week against a capacity you set, so overbooking shows before it happens.', mock: WorkloadMock },
  { name: 'Docs', text: 'Written pages beside the boards for plans, briefs and notes, in markdown with checklists and links.', mock: DocsMock },
]

export function Views() {
  return (
    <section aria-labelledby="views" className={cx(WRAP, 'pt-28 sm:pt-36')}>
      <SectionHead id="views" title="Ten views, one board">
        Every view edits the same items. Change a status on the Kanban and the table, the timeline and the dashboard already know. Cards, a Form for intake and a Files list sit alongside these.
      </SectionHead>
      <ol>
        {VIEWS.map((v) => (
          <li key={v.name} className="grid gap-x-10 gap-y-4 border-b border-line py-6 md:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] md:items-center lg:grid-cols-[220px_minmax(0,1fr)_380px]">
            <h3 className="caps text-[30px] leading-none font-bold tracking-[0.03em] sm:text-[36px]">{v.name}</h3>
            <p className="max-w-[46ch] text-[16px] leading-[1.5] text-muted md:col-start-1 lg:col-start-auto">{v.text}</p>
            <div className="md:col-start-2 md:row-span-2 md:row-start-1 lg:col-start-auto lg:row-auto">{v.mock()}</div>
          </li>
        ))}
      </ol>
    </section>
  )
}

/* ───────────────────────── Automations ───────────────────────── */

const B = ({ children }: { children: ReactNode }) => <b className="font-semibold text-on-ink">{children}</b>

const ANNOUNCEMENTS: [ReactNode, ReactNode][] = [
  [
    <>
      When <B>Status</B> changes to <Tag color={C.done} ink>Done</Tag>
    </>,
    <>
      Move the item to <B>Completed</B>
    </>,
  ],
  [
    <>
      When <B>Status</B> changes to <Tag color={C.stuck}>Stuck</Tag>
    </>,
    <>Notify the owner</>,
  ],
  [
    <>
      When someone is assigned in <B>Owner</B>
    </>,
    <>
      Set <B>Status</B> to <Tag color={C.work}>Working on it</Tag>
    </>,
  ],
  [
    <>
      One day before the <B>Deadline</B>
    </>,
    <>Notify the owner</>,
  ],
  [
    <>
      Every <B>Monday</B>
    </>,
    <>
      Create <B>Weekly check-in</B> in <B>This week</B>
    </>,
  ],
  [
    <>
      When <B>Stage</B> changes to <Tag color={C.won}>Won</Tag>
    </>,
    <>
      Create an item on the <B>Team tasks</B> board
    </>,
  ],
  [
    <>
      When <B>Status</B> changes to <Tag color={C.teal}>Cancelled</Tag>
    </>,
    <>Archive the item</>,
  ],
]

export function Automations() {
  return (
    <section aria-labelledby="automations" className="mt-28 bg-ink py-20 text-on-ink sm:mt-36 sm:py-28 dark:border-y dark:border-line">
      <div className={WRAP}>
        <SectionHead id="automations" title="Service announcements" onInk>
          Automations listen for a status, any column, an assignment, a date or a schedule. Then they move, notify, assign, set a value, create on another board, archive or duplicate. No code.
        </SectionHead>
        <div className="caps hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-10 border-b border-[#3a3a36] py-3 text-[12px] font-semibold tracking-[0.14em] text-on-ink-muted md:grid">
          <span>When</span>
          <span>Then</span>
        </div>
        <ul>
          {ANNOUNCEMENTS.map(([when, then], i) => (
            <li key={i} className="grid gap-x-10 gap-y-1.5 border-b border-[#2c2c29] py-4 text-[18px] leading-snug text-on-ink-muted md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center md:py-5 md:text-[20px]">
              <span>{when}</span>
              <span className="flex items-center gap-2.5">
                <ArrowRight className="size-4 shrink-0 text-signal" aria-hidden />
                <span>{then}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* ───────────────────────── Column types ───────────────────────── */

const Muted = ({ children }: { children: ReactNode }) => <span className="text-muted">{children}</span>
const Mono = ({ children, className }: { children: ReactNode; className?: string }) => <span className={cx('font-mono text-[13px]', className)}>{children}</span>
const Who = ({ i }: { i: string }) => <span className="inline-grid size-[22px] place-items-center rounded-full bg-fg text-[9.5px] font-semibold text-bg">{i}</span>

const COLUMNS: [string, ReactNode][] = [
  ['Status', <Tag color={C.work}>Working on it</Tag>],
  ['Priority', <Mono className="rounded-sm bg-fg px-1 py-px font-semibold text-bg">P0</Mono>],
  [
    'People',
    <span className="flex gap-1">
      <Who i="YA" />
      <Who i="LM" />
    </span>,
  ],
  [
    'Date',
    <Mono>
      <Muted>THU</Muted> 21 NOV
    </Mono>,
  ],
  ['Timeline', <Mono>21 NOV – 05 DEC</Mono>],
  ['Text', <Muted>Waiting on legal</Muted>],
  ['Long text', <Muted>Draft from the last call…</Muted>],
  ['Numbers', <Mono>12,400</Mono>],
  [
    'Tags',
    <span className="flex gap-1">
      {['press', 'EU'].map((t) => (
        <span key={t} className="rounded-sm border border-line-strong px-1.5 text-[12px] text-muted">
          {t}
        </span>
      ))}
    </span>,
  ],
  [
    'Checkbox',
    <span className="grid size-4 place-items-center rounded-[3px] bg-fg">
      <svg viewBox="0 0 10 10" className="size-2.5" fill="none" stroke="var(--bg)" strokeWidth="1.8" aria-hidden>
        <path d="M2 5.2l2 2L8 3" />
      </svg>
    </span>,
  ],
  ['Link', <span className="text-[14px] text-accent underline decoration-accent/30">ar-tracker.xlsx</span>],
  ['Rating', <Mono>4 / 5</Mono>],
  [
    'Progress',
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-14 rounded-sm bg-line">
        <span className="block h-full w-[60%] rounded-sm bg-fg" />
      </span>
      <Mono>60%</Mono>
    </span>,
  ],
  ['Formula', <Mono>{'{Hours} × {Rate}'}</Mono>],
  ['Time tracking', <Mono>02:15:40</Mono>],
  ['Dependency', <Mono>after CUE-131</Mono>],
  ['Connect boards', <span className="text-[14px]">Sales pipeline</span>],
  [
    'Mirror',
    <span className="text-[14px]">
      <Muted>Stage:</Muted> Won
    </span>,
  ],
  ['File links', <span className="text-[14px] text-accent underline decoration-accent/30">deck-v2.pdf</span>],
  ['Email', <Mono>hello@team.test</Mono>],
  ['Phone', <Mono>+44 20 7946 0000</Mono>],
  ['Location', <span className="text-[14px]">Cardiff</span>],
  ['Vote', <Mono>3 votes</Mono>],
  [
    'Creation log',
    <Mono>
      YA <Muted>· 12 NOV</Muted>
    </Mono>,
  ],
  ['Last updated', <Mono>2h ago</Mono>],
  ['Item ID', <Mono>CUE-142</Mono>],
]

export function Columns() {
  return (
    <section aria-labelledby="columns" className={cx(WRAP, 'pt-28 sm:pt-36')}>
      <SectionHead id="columns" title={`${COLUMNS.length} column types`}>
        From status and deadlines to formulas, time tracking and links between boards. Each type gets its own cell: tags look like tags, dates read like departure times.
      </SectionHead>
      <ul className="grid md:grid-cols-2 md:gap-x-12">
        {COLUMNS.map(([name, sample]) => (
          <li key={name} className="flex min-h-[46px] items-center justify-between gap-4 border-b border-line">
            <span className="caps text-[17px] font-semibold tracking-[0.06em]">{name}</span>
            <span aria-hidden="true" className="flex min-w-0 items-center truncate">
              {sample}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/* ───────────────────────── Private by design / Run your own ───────────────────────── */

const RULES: [string, string][] = [
  ['No public sign-up', 'Every login is created by the team’s admin. There is no form for strangers to fill in.'],
  ['Passwords stay with people', 'The admin hands out a starting password; you choose your own at first sign-in. Forgotten ones are reset by the admin.'],
  ['Viewers can look, not touch', 'Give partners a viewer role to read boards without changing them.'],
  ['Rules, not just screens', 'Access is enforced by Firestore security rules on the backend, so a hidden button is never the only lock.'],
  ['Free tier, no surprises', 'It runs on Firebase’s free Spark plan. Files are kept as links, so there is no storage to pay for.'],
  ['The code is public, the data never is', 'The team’s boards live in its own backend. Nothing from them goes into the repository.'],
]

const STEPS: { title: string; text: ReactNode; code: string }[] = [
  {
    title: 'Get the code',
    text: 'Clone the repository and start it. With no backend configured, Cue runs in local mode and keeps boards in your browser.',
    code: 'git clone https://github.com/youssef-110/cue.git cue\ncd cue\nnpm install\nnpm run dev',
  },
  {
    title: 'Connect your own Firebase',
    text: 'Create a free Firebase project with Email/Password sign-in and Firestore, then paste its web config.',
    code: '# .env.production\nVITE_FIREBASE_API_KEY=…\nVITE_FIREBASE_AUTH_DOMAIN=…\nVITE_FIREBASE_PROJECT_ID=…\nVITE_FIREBASE_APP_ID=…',
  },
  {
    title: 'Deploy and hand out logins',
    text: (
      <>
        Deploy the rules with your owner username, build, and host it anywhere static. Create the owner login once, then everyone else’s from the Team screen. The{' '}
        <a href={`${REPO_URL}#readme`} className="text-accent underline decoration-accent/30 hover:decoration-accent">
          README
        </a>{' '}
        covers the admin server.
      </>
    ),
    code: 'TIDELINE_OWNER_EMAIL=you@cue.invalid \\\n  npm run deploy:rules\nnpm run build',
  },
]

export function PrivateAndRun() {
  return (
    <div className={cx(WRAP, 'grid gap-x-16 gap-y-28 pt-28 sm:pt-36 lg:grid-cols-2')}>
      <section aria-labelledby="private">
        <h2 id="private" className="caps border-b-2 border-fg pb-5 text-[clamp(2.5rem,5vw,4rem)] leading-[0.88] font-bold tracking-[0.01em]">
          Private by design
        </h2>
        <dl>
          {RULES.map(([t, d]) => (
            <div key={t} className="grid gap-1 border-b border-line py-4 sm:grid-cols-[200px_1fr] sm:gap-6">
              <dt className="caps text-[16px] leading-tight font-semibold tracking-[0.06em]">{t}</dt>
              <dd className="text-[15px] leading-[1.5] text-muted">{d}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section aria-labelledby="run">
        <h2 id="run" className="caps border-b-2 border-fg pb-5 text-[clamp(2.5rem,5vw,4rem)] leading-[0.88] font-bold tracking-[0.01em]">
          Run your own
        </h2>
        <ol>
          {STEPS.map((s, i) => (
            <li key={s.title} className="grid grid-cols-[44px_minmax(0,1fr)] gap-x-3 border-b border-line py-5">
              <span className="font-mono text-[22px] leading-none font-medium text-faint" aria-hidden>
                {i + 1}
              </span>
              <div className="min-w-0">
                <h3 className="caps text-[20px] leading-none font-bold tracking-[0.05em]">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-[1.5] text-muted">{s.text}</p>
                <pre className="mt-3 overflow-x-auto rounded-md bg-ink px-4 py-3 font-mono text-[12.5px] leading-[1.65] text-on-ink">
                  <code>{s.code}</code>
                </pre>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
