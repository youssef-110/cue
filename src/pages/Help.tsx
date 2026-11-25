import type { ReactNode } from 'react'
import { Play, Users } from 'lucide-react'
import { useStore } from '../lib/store'
import { auth } from '../lib/sync'
import { COLUMN_TYPES } from '../components/columnTypes'
import { RoleMatrix } from '../components/Roles'
import { startTour } from '../components/Tour'
import { Button, Kbd } from '../components/ui'

/** Opens the Team screen owned by the sidebar. */
export const openTeam = () => window.dispatchEvent(new Event('cue:open-team'))

type Section = { id: string; title: string; admin?: boolean; body: ReactNode }

const P = ({ children }: { children: ReactNode }) => <p className="mt-2 max-w-[68ch] text-[15px] leading-relaxed text-muted">{children}</p>
const Steps = ({ items }: { items: ReactNode[] }) => (
  <ol className="mt-3 max-w-[68ch] space-y-2">
    {items.map((it, n) => (
      <li key={n} className="flex gap-3 text-[15px] leading-relaxed">
        <span className="mt-0.5 font-mono text-[13px] font-semibold text-faint">{String(n + 1).padStart(2, '0')}</span>
        <span>{it}</span>
      </li>
    ))}
  </ol>
)
const B = ({ children }: { children: ReactNode }) => <strong className="font-semibold text-fg">{children}</strong>

const SHORTCUTS: [string, string][] = [
  ['Ctrl K', 'Search and jump anywhere'],
  ['N', 'New item on the current board'],
  ['/', 'Search the current board'],
  ['Ctrl Z', 'Undo your last cell edit or rename'],
  ['Esc', 'Close the open item'],
  ['D', 'Switch light and dark'],
]

const SECTIONS: Section[] = [
  {
    id: 'start',
    title: 'Getting started',
    body: (
      <>
        <P>Cue keeps the team’s work in one place. Everything is organised in four layers:</P>
        <Steps
          items={[
            <><B>Workspaces</B> group related boards, for example Operations and Sales.</>,
            <><B>Boards</B> track one stream of work: tasks, a sales pipeline, a roadmap.</>,
            <><B>Groups</B> split a board into sections such as This week, Next week or Done.</>,
            <><B>Items</B> are the rows: one task, one lead, one piece of content. Columns describe them.</>,
          ]}
        />
        <P>Everything syncs live. When a teammate changes something, you see it straight away without reloading.</P>
      </>
    ),
  },
  {
    id: 'boards',
    title: 'Boards and items',
    body: (
      <>
        <Steps
          items={[
            <>Create a board with <B>+ Board</B> under a workspace in the left rail. Pick a template or start blank.</>,
            <>Add an item with <B>New item</B> at the top of the board, or by typing in the empty row at the bottom of a group.</>,
            <>Click any cell to edit it. Drag the handle at the start of a row to reorder items or move them between groups.</>,
            <>Click an item’s name to open its panel: updates, files, activity and every column in one place.</>,
            <>Tick several rows to archive, delete, duplicate or move them at once.</>,
          ]}
        />
        <P>Items can have subitems, for breaking a task into steps. Open the item and add them in its panel.</P>
      </>
    ),
  },
  {
    id: 'columns',
    title: 'Columns',
    body: (
      <>
        <P>Add a column with the + at the end of the header row. Rename, recolour labels or remove a column from its header menu. Available types:</P>
        <ul className="mt-3 grid max-w-[68ch] grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3">
          {COLUMN_TYPES.map(({ type, label, icon: Icon }) => (
            <li key={type} className="flex items-center gap-2 text-[14px]">
              <Icon className="size-4 shrink-0 text-faint" /> {label}
            </li>
          ))}
        </ul>
        <P>
          <B>Formula</B> calculates from other columns. <B>Connect boards</B> links items across boards and <B>Mirror</B> shows a value from the linked item. <B>Dependency</B> marks
          what must finish first, and the timeline draws it as an arrow. <B>Files</B> stores links to documents, so keep the files in your shared drive. <B>World clock</B> shows the current time in a city, handy for partners abroad. A <B>Button</B> column runs automations: add one, then create a “When column changes” automation on it.
        </P>
      </>
    ),
  },
  {
    id: 'views',
    title: 'Views',
    body: (
      <>
        <P>Every board can be seen in several ways. All views edit the same items, so a change in one shows in all of them. Add a view with the + next to the board’s tabs.</P>
        <Steps
          items={[
            <><B>Table</B>: the spreadsheet view, with filters, sorting, group by and column summaries.</>,
            <><B>Kanban</B>: cards in columns by status. Drag a card to change it.</>,
            <><B>Timeline</B>: items on a calendar strip by their timeline or date column, with dependencies.</>,
            <><B>Calendar</B>: items on the day they are due.</>,
            <><B>Chart</B>: the board summarised by status, priority or person.</>,
            <><B>Workload</B>: how much each person has on, week by week.</>,
            <><B>Cards</B>: every item as a card, editable in place.</>,
            <><B>Form</B>: a clean form that adds a new item to the board. Good for requests and intake.</>,
            <><B>Files</B>: every file link attached anywhere on the board, in one list.</>,
          ]}
        />
        <P>Filters and group-by are saved per view, so one board can have a “My open items” table and a “Whole team” kanban.</P>
      </>
    ),
  },
  {
    id: 'updates',
    title: 'Updates, mentions and the inbox',
    body: (
      <>
        <P>
          Open an item and write in <B>Updates</B> to discuss it. Type <B>@</B> and a name to mention someone: they get a notification in their <B>Inbox</B>. People
          assigned to an item, or who follow it with the bell, hear about new updates too.
        </P>
        <P>Click <B>Reply</B> under an update to answer it in a thread. The person who wrote it is notified.</P>
        <P>
          <B>Email notifications:</B> click your name at the bottom of the left rail, type your email and click <B>Send code</B>. Enter the 6-digit code from
          the email to connect it. Notifications then come by email too, and you can switch them off or disconnect at any time. The Inbox still gets everything.
        </P>
        <P>
          <B>My work</B> lists everything assigned to you on any board, grouped by Overdue, Today, This week, Next week, Later and No date. It is the best place to start the day.
        </P>
      </>
    ),
  },
  {
    id: 'automations',
    title: 'Automations',
    body: (
      <>
        <P>Open a board, then <B>Automate</B> in its header. Each automation is a “when this happens, do that” rule. Start from a recipe or build your own. Triggers:</P>
        <Steps
          items={[
            'When a status changes to a label',
            'When an item is created',
            'When any column, or one chosen column, changes',
            'When a person is assigned',
            'When a date arrives, or a number of days before it',
            'Every day, every weekday (Monday to Friday) or every Monday: create items. Weekday items are dated, so they show on the calendar',
          ]}
        />
        <P>Actions: notify someone, set a status, assign a person, set a date to today, move the item to a group, create an item on another board, duplicate, archive, or clear a column. Switch an automation off with its toggle without deleting it.</P>
        <P>
          A schedule can carry a <B>meeting link</B>, such as a Google Meet link. Each item it creates gets the link in a <B>Meeting link</B> column, and the
          calendar shows a camera button on those items to join the call in one click.
        </P>
      </>
    ),
  },
  {
    id: 'dashboards',
    title: 'Dashboards and docs',
    body: (
      <>
        <P>
          <B>Dashboards</B> (left rail) combine several boards: totals, status batteries, charts, workload and overdue lists. Use them for a weekly review.
        </P>
        <P>
          <B>Docs</B> are pages for notes, plans and meeting minutes. Create one with <B>Doc</B> under a workspace, or open the <B>Doc</B> tab on a board to keep
          its notes next to the work. Docs support headings, lists, checklists and links.
        </P>
      </>
    ),
  },
  {
    id: 'kpis',
    title: 'KPI boards',
    body: (
      <>
        <P>
          <B>KPIs</B> (left rail) hold the numbers the company is steered by on one page: the round, milestones against their targets, revenue, cost, cash and
          runway, the investor funnel, the sales pipeline, the value of open opportunities, weekly activity, company readiness, and the team with its open roles.
        </P>
        <Steps
          items={[
            <>Click <B>Edit</B> on a panel to type its numbers into a small table. Amounts accept 2,600, 12k or 1.2M. Changes save as you leave each cell.</>,
            <>Milestones can count themselves: from firm investor money, the whole round, or the accounts that reached a pipeline stage. The nearest open deadline shows at the top.</>,
            <>Click a lamp under <B>Company readiness</B> to score an area from 1 to 5.</>,
            <>Click <B>TV board</B> to show the board full screen as a departure board for the office screen. It updates live and keeps the screen awake. Press Esc to leave.</>,
          ]}
        />
        <P>
          New KPI boards are <B>private</B> to the person who made them; admins can always open them. Use <B>Share</B> on the yellow band to open one to the whole team or to
          chosen people. Viewers can read the numbers and the tables behind them, but not change them.
        </P>
      </>
    ),
  },
  {
    id: 'import',
    title: 'Importing and exporting',
    body: (
      <>
        <P>
          Click <B>Import</B> under a workspace and choose a CSV or Excel (.xlsx) file. Each sheet becomes a board: the first row becomes the columns, and Cue
          picks column types from the values (dates, numbers, statuses). Export any board to CSV from its menu.
        </P>
        <P>Imported data stays inside the team’s private database. Nothing goes into the public code repository.</P>
      </>
    ),
  },
  {
    id: 'private',
    title: 'Private boards',
    body: (
      <>
        <P>
          Open a board’s <B>⋯</B> menu and choose <B>Board access</B>. Pick <B>Private</B> and tick the people who should see it. Everyone else won’t see the
          board, its items, updates, docs or activity anywhere in Cue, including search, My work and dashboards. The database enforces this, not just the screen.
        </P>
        <P>Admins can always open private boards. Only the person who made the board, or an admin, can change who sees it. Private boards show a lock in the left rail.</P>
      </>
    ),
  },
  {
    id: 'trash',
    title: 'Archive and trash',
    body: (
      <P>
        Archive items, groups or boards you are finished with. They leave every view but stay searchable in <B>Archive &amp; Trash</B>, where you can restore them. Deleted
        things wait in the trash for 30 days, then they are removed for good.
      </P>
    ),
  },
  {
    id: 'roles',
    title: 'Roles',
    body: (
      <>
        <P>Every person has one role. It decides what they can change. The database enforces it, not just the screen.</P>
        <div className="mt-4 max-w-[720px]">
          <RoleMatrix />
        </div>
      </>
    ),
  },
  {
    id: 'admins',
    title: 'For admins',
    admin: true,
    body: (
      <>
        <P>Only people with a login can see anything in Cue. There is no public sign-up. You create every account.</P>
        <h3 className="caps mt-5 text-[16px] font-bold tracking-[0.06em]">Add a person</h3>
        <Steps
          items={[
            <>Open <B>Team</B> in the left rail.</>,
            <>Type their full name and a username (lowercase letters, digits, dots or dashes), then choose a role.</>,
            <>Click <B>Create login</B>. A yellow login ticket shows the username and a starting password, once.</>,
            <>Click <B>Copy login</B> and send it to them privately. At first sign-in they choose their own password.</>,
          ]}
        />
        <h3 className="caps mt-5 text-[16px] font-bold tracking-[0.06em]">Someone forgot their password</h3>
        <Steps items={[<>Open <B>Team</B> and click <B>Reset password</B> next to their name.</>, 'Send them the new ticket. Their old password stops working and they are signed out everywhere.']} />
        <h3 className="caps mt-5 text-[16px] font-bold tracking-[0.06em]">Change a role or remove someone</h3>
        <P>
          Pick a new role from the list next to their name. It applies at once, even if they are signed in. <B>Remove</B> deletes their login immediately. Their past
          updates and items stay. You can’t change or remove yourself, so the workspace always keeps an admin.
        </P>
      </>
    ),
  },
  {
    id: 'shortcuts',
    title: 'Keyboard shortcuts',
    body: (
      <dl className="mt-3 grid max-w-[480px] grid-cols-[110px_1fr] gap-y-2">
        {SHORTCUTS.map(([k, what]) => (
          <div key={k} className="contents">
            <dt>
              <Kbd>{k}</Kbd>
            </dt>
            <dd className="text-[15px]">{what}</dd>
          </div>
        ))}
      </dl>
    ),
  },
]

export function HelpPage() {
  const isAdmin = useStore((s) => s.isAdmin)
  const list = SECTIONS.filter((s) => !s.admin || isAdmin)
  const go = (id: string) => document.getElementById(`help-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  return (
    <div className="h-full overflow-y-auto">
      <header className="band border-b border-on-signal/20 bg-signal text-on-signal">
        <div className="mx-auto max-w-5xl px-6 pb-6 pt-8 sm:px-8">
          <h1 className="caps text-[34px] font-bold leading-none sm:text-[44px]">Help</h1>
          <p className="mt-2 max-w-[60ch] text-[15px]">How Cue works, what each role can do{isAdmin ? ', and how to manage the team' : ''}.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => startTour('member')}>
              <Play /> Welcome tour
            </Button>
            {isAdmin && (
              <Button variant="primary" onClick={() => startTour('admin')}>
                <Play /> Admin tour
              </Button>
            )}
            {isAdmin && auth && (
              <Button variant="outline" onClick={openTeam}>
                <Users /> Open Team
              </Button>
            )}
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-5xl gap-10 px-6 py-8 sm:px-8">
        <nav aria-label="Help topics" className="sticky top-8 hidden h-fit w-48 shrink-0 lg:block">
          <ul className="space-y-0.5">
            {list.map((s) => (
              <li key={s.id}>
                <button onClick={() => go(s.id)} className="w-full rounded-md px-2.5 py-1.5 text-left text-[14px] text-muted transition-colors hover:bg-hover hover:text-fg">
                  {s.title}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 flex-1 space-y-10 pb-16">
          {list.map((s) => (
            <section key={s.id} id={`help-${s.id}`} aria-labelledby={`help-h-${s.id}`} className="scroll-mt-6">
              <h2 id={`help-h-${s.id}`} className="caps border-b-2 border-fg pb-1.5 text-[24px] font-bold leading-none">
                {s.title}
              </h2>
              {s.body}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
