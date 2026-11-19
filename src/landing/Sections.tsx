import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowRightLeft,
  Bell,
  CalendarClock,
  Check,
  Copy,
  FileSpreadsheet,
  FolderInput,
  Heart,
  LayoutTemplate,
  Moon,
  Plus,
  Search,
  Sun,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cx } from '../components/ui'
import { CalendarMock, DashboardMock, KanbanMock, TableMock, TimelineMock } from './ViewMocks'
import { C, Face, PEOPLE, Reveal, RevealItem, SectionHead } from './shared'

/* ───────────────────────── Views ───────────────────────── */

const VIEWS = [
  { name: 'Table', blurb: 'Groups, typed columns and inline editing. The spreadsheet that knows what a status is.', Mock: TableMock },
  { name: 'Kanban', blurb: 'Drag cards across any status column. Counts update as you go.', Mock: KanbanMock },
  { name: 'Timeline', blurb: 'A Gantt view of every timeline column, with a line for today.', Mock: TimelineMock },
  { name: 'Calendar', blurb: 'Every dated item on a month grid, colour-coded by status.', Mock: CalendarMock },
  { name: 'Dashboard', blurb: 'Counts and charts built from the board itself. No exports, no formulas.', Mock: DashboardMock },
]

export function Views() {
  const [active, setActive] = useState(0)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const base = useId()
  const onKey = (e: KeyboardEvent) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!d) return
    e.preventDefault()
    const next = (active + d + VIEWS.length) % VIEWS.length
    setActive(next)
    tabs.current[next]?.focus()
  }
  const { Mock } = VIEWS[active]

  return (
    <section aria-labelledby="views-h" className="relative mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32" id="views">
      <SectionHead id="views-h" title="One board, five ways to look at it">
        Switch views without copying data anywhere. Every view reads the same items, so a change in one shows up in all of them.
      </SectionHead>

      <div className="mt-12 grid gap-6 lg:grid-cols-[280px_1fr] lg:gap-10">
        <div role="tablist" aria-label="Board views" aria-orientation="vertical" onKeyDown={onKey} className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
          {VIEWS.map((v, i) => (
            <button
              key={v.name}
              ref={(el) => {
                tabs.current[i] = el
              }}
              role="tab"
              id={`${base}-t${i}`}
              aria-selected={i === active}
              aria-controls={`${base}-p`}
              tabIndex={i === active ? 0 : -1}
              onClick={() => setActive(i)}
              className={cx(
                'relative shrink-0 rounded-xl px-4 py-3 text-left transition-colors lg:py-4',
                i === active ? 'text-fg' : 'text-muted hover:bg-hover hover:text-fg',
              )}
            >
              {i === active && <motion.span layoutId="view-tab" className="absolute inset-0 rounded-xl border border-line bg-panel shadow-card" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
              <span className="relative block font-display text-[17px] font-semibold tracking-tight">{v.name}</span>
              <span className={cx('relative mt-1 hidden text-[13.5px] leading-snug text-muted lg:block', i !== active && 'lg:hidden')}>{v.blurb}</span>
            </button>
          ))}
        </div>

        <div id={`${base}-p`} role="tabpanel" aria-labelledby={`${base}-t${active}`} className="relative min-h-[400px] min-w-0 rounded-[20px] border border-line bg-panel p-3 shadow-card sm:p-5">
          <p className="mb-4 text-[14px] text-muted lg:hidden">{VIEWS[active].blurb}</p>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={active} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
              <Mock />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}

/* ───────────────────────── Automations ───────────────────────── */

type Chip = { icon: LucideIcon; text: ReactNode }
const RECIPES: { when: Chip; then: Chip }[] = [
  {
    when: { icon: ArrowRightLeft, text: <>Status changes to <Tag c={C.green}>Done</Tag></> },
    then: { icon: FolderInput, text: <>Move item to <b className="font-medium">Shipped</b></> },
  },
  {
    when: { icon: ArrowRightLeft, text: <>Status changes to <Tag c={C.red}>Stuck</Tag></> },
    then: { icon: Bell, text: <>Notify the owner</> },
  },
  {
    when: { icon: Plus, text: <>An item is created</> },
    then: { icon: UserPlus, text: <>Assign <Face p={PEOPLE.ines} size={18} /> Inès</> },
  },
  {
    when: { icon: CalendarClock, text: <>The due date arrives</> },
    then: { icon: ArrowRightLeft, text: <>Set status to <Tag c={C.orange}>Working on it</Tag></> },
  },
  {
    when: { icon: ArrowRightLeft, text: <>Status changes to <Tag c={C.violet}>In review</Tag></> },
    then: { icon: CalendarClock, text: <>Set the review date to today</> },
  },
]

function Tag({ c, children }: { c: string; children: ReactNode }) {
  return (
    <span className="rounded-[5px] px-1.5 py-0.5 text-[12px] font-medium whitespace-nowrap text-white" style={{ background: c }}>
      {children}
    </span>
  )
}

export function Automations() {
  return (
    <section aria-labelledby="auto-h" id="automations" className="relative border-y border-line bg-panel/60 py-24 sm:py-32">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHead id="auto-h" title="Let the board do the busywork">
            Pick a trigger, pick an action, done. Automations are plain sentences you build from dropdowns, so anyone on the team can read what a board does and change it.
          </SectionHead>
          <Reveal className="mt-8 grid grid-cols-2 gap-x-6 gap-y-3 text-[14px] text-muted">
            {['Move to group', 'Notify someone', 'Set a status', 'Assign a person', 'Set a date', 'Run on create or on a date'].map((t) => (
              <RevealItem key={t} className="flex items-center gap-2">
                <Check size={15} className="shrink-0 text-tide" />
                {t}
              </RevealItem>
            ))}
          </Reveal>
        </div>

        <Reveal as="ul" className="space-y-3">
          {RECIPES.map((r, i) => (
            <RevealItem as="li" key={i} className="group rounded-2xl border border-line bg-panel p-3 transition-shadow hover:shadow-pop sm:p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-0">
                <Step label="When" chip={r.when} />
                <div className="relative mx-3 hidden h-px flex-1 bg-line-strong sm:block" aria-hidden>
                  <span className="lp-pulse absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent shadow-[0_0_0_4px_color-mix(in_oklab,var(--accent)_22%,transparent)]" style={{ ['--delay' as string]: `${i * 0.45}s` }} />
                </div>
                <div className="ml-5 h-3 w-px bg-line-strong sm:hidden" aria-hidden />
                <Step label="Then" chip={r.then} accent />
              </div>
            </RevealItem>
          ))}
        </Reveal>
      </div>
    </section>
  )
}

function Step({ label, chip, accent }: { label: string; chip: Chip; accent?: boolean }) {
  const Icon = chip.icon
  return (
    <div className={cx('flex min-w-0 items-center gap-2.5 rounded-xl px-3 py-2.5 sm:max-w-[48%]', accent ? 'bg-accent-soft' : 'bg-panel-2')}>
      <span className={cx('grid size-7 shrink-0 place-items-center rounded-lg', accent ? 'bg-accent text-white' : 'bg-panel text-muted shadow-card')}>
        <Icon size={14} />
      </span>
      <span className="min-w-0 text-[14px] leading-snug">
        <span className="mr-1.5 text-faint">{label}</span>
        <span className="inline-flex flex-wrap items-center gap-1">{chip.text}</span>
      </span>
    </div>
  )
}

/* ───────────────────────── Feature bento ───────────────────────── */

export function Features() {
  return (
    <section aria-labelledby="feat-h" id="features" className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
      <SectionHead id="feat-h" title="The small things that make a tool feel fast">
        Tideline is built for people who live in it all day: everything is a keystroke away, nothing waits on a spinner, and your teammates' changes simply appear.
      </SectionHead>

      <Reveal className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Tile className="lg:col-span-4" title="Command palette" body="Press Ctrl K or ⌘ K to jump to any board, item or action.">
          <Palette />
        </Tile>
        <Tile className="lg:col-span-2" title="Realtime sync" body="Edits from teammates land in a blink, through your own free Supabase project.">
          <Sync />
        </Tile>
        <Tile className="lg:col-span-2" title="My work" body="Everything assigned to you, across every board, sorted by date.">
          <MyWork />
        </Tile>
        <Tile className="lg:col-span-2" title="Inbox and mentions" body="Updates, @mentions and likes, in one notifications inbox.">
          <Inbox />
        </Tile>
        <Tile className="lg:col-span-2" title="Templates" body="Start from a roadmap, a task list, a sales pipeline or a content calendar.">
          <Templates />
        </Tile>
        <Tile className="lg:col-span-2" title="CSV import and export" body="Bring a spreadsheet in, take a board out. Columns map to types.">
          <Csv />
        </Tile>
        <Tile className="lg:col-span-2" title="Light and dark" body="Both themes are designed, not inverted. Press D to switch.">
          <Themes />
        </Tile>
        <Tile className="lg:col-span-2" title="Keyboard-first" body="N for a new item, / to search, Esc to close a panel.">
          <Keys />
        </Tile>
      </Reveal>
    </section>
  )
}

function Tile({ title, body, children, className }: { title: string; body: string; children: ReactNode; className?: string }) {
  return (
    <RevealItem className={cx('group relative flex flex-col overflow-hidden rounded-[20px] border border-line bg-panel p-5 transition-[border-color,box-shadow] duration-300 hover:border-line-strong hover:shadow-pop', className)}>
      <div className="relative mb-5 grid min-h-[150px] flex-1 place-items-center overflow-hidden rounded-xl bg-panel-2/70 p-4">{children}</div>
      <h3 className="font-display text-[19px] font-semibold tracking-tight">{title}</h3>
      <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">{body}</p>
    </RevealItem>
  )
}

function Palette() {
  return (
    <div className="w-full max-w-md rounded-xl border border-line bg-panel shadow-pop transition-transform duration-300 group-hover:-translate-y-1">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2.5 text-[13.5px]">
        <Search size={15} className="text-faint" />
        <span>
          road<span className="lp-caret ml-px inline-block h-4 w-px translate-y-[3px] bg-accent" />
        </span>
        <kbd className="ml-auto rounded border border-line px-1.5 font-mono text-[10.5px] text-faint">Esc</kbd>
      </div>
      <ul className="p-1.5 text-[13px]">
        {[
          ['Product roadmap', 'Board'],
          ['Roadmap review notes', 'Item in Team tasks'],
          ['New roadmap from template', 'Action'],
        ].map(([a, b], i) => (
          <li key={a} className={cx('flex items-center justify-between rounded-lg px-2.5 py-2', i === 0 && 'bg-accent-soft text-accent group-hover:bg-transparent group-hover:text-fg', i === 1 && 'group-hover:bg-accent-soft group-hover:text-accent')}>
            {a}
            <span className="text-[11.5px] text-faint">{b}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Sync() {
  return (
    <div className="flex w-full max-w-[220px] flex-col gap-2">
      {[PEOPLE.maya, PEOPLE.leo].map((p, i) => (
        <div key={p.name} className="flex items-center gap-2 rounded-lg border border-line bg-panel px-2.5 py-2 text-[12.5px] shadow-card">
          <Face p={p} size={20} />
          <span className="truncate">Billing page polish</span>
          <span
            className={cx(
              'ml-auto w-[62px] shrink-0 rounded text-center text-[10.5px] leading-5 font-medium text-white transition-colors duration-500',
              i === 0 ? 'bg-[#00b884]' : 'bg-[#f0475a] delay-150 group-hover:bg-[#00b884]',
            )}
          >
            {i === 0 ? 'Done' : (
              <>
                <span className="group-hover:hidden">Stuck</span>
                <span className="hidden group-hover:inline">Done</span>
              </>
            )}
          </span>
        </div>
      ))}
      <span className="mt-1 flex items-center gap-1.5 self-center text-[11.5px] text-muted">
        <span className="size-1.5 rounded-full bg-[#00b884]" /> In sync
      </span>
    </div>
  )
}

function MyWork() {
  return (
    <ul className="w-full max-w-[240px] space-y-1.5 text-[12.5px]">
      {[
        ['Write release notes', 'Product roadmap', 'Today', C.orange],
        ['Pilot interview notes', 'Research', 'Tomorrow', C.slate],
        ['Approve invoices', 'Finance', 'Fri', C.red],
      ].map(([t, b, d, c], i) => (
        <li key={t} className="flex items-center gap-2 rounded-lg border border-line bg-panel px-2.5 py-2 shadow-card transition-transform duration-300" style={{ transitionDelay: `${i * 40}ms` }}>
          <span className="size-2 shrink-0 rounded-full" style={{ background: c }} />
          <span className="min-w-0">
            <span className="block truncate">{t}</span>
            <span className="block truncate text-[11px] text-faint">{b}</span>
          </span>
          <span className="ml-auto text-[11px] text-muted">{d}</span>
        </li>
      ))}
    </ul>
  )
}

function Inbox() {
  return (
    <div className="w-full max-w-[250px] rounded-lg border border-line bg-panel p-3 text-[12.5px] shadow-card">
      <div className="flex items-center gap-2">
        <Face p={PEOPLE.sam} size={22} />
        <span className="font-medium">Sam</span>
        <span className="text-faint">2m</span>
      </div>
      <p className="mt-2 leading-snug">
        <span className="rounded bg-accent-soft px-1 text-accent">@Maya</span> the copy is final, ready when you are.
      </p>
      <div className="mt-2.5 flex items-center gap-1.5 text-[11.5px] text-muted">
        <Heart size={13} className="transition-all duration-300 group-hover:scale-125 group-hover:fill-[#ec4f9a] group-hover:text-[#ec4f9a]" />
        <span className="group-hover:hidden">Like</span>
        <span className="hidden group-hover:inline">Liked</span>
      </div>
    </div>
  )
}

function Templates() {
  const cards = [
    ['Product roadmap', C.indigo, '-rotate-6 group-hover:-translate-x-10 group-hover:-rotate-12'],
    ['Content calendar', C.teal, 'rotate-3 group-hover:translate-x-10 group-hover:rotate-12'],
    ['Team tasks', C.orange, 'group-hover:-translate-y-2'],
  ] as const
  return (
    <div className="relative h-[120px] w-[150px]">
      {cards.map(([t, c, m]) => (
        <div key={t} className={cx('absolute inset-0 rounded-xl border border-line bg-panel p-3 shadow-card transition-transform duration-500 ease-out', m)}>
          <LayoutTemplate size={16} style={{ color: c }} />
          <div className="mt-2 text-[12.5px] font-medium">{t}</div>
          <div className="mt-2 space-y-1">
            <span className="block h-1.5 w-full rounded-full" style={{ background: c, opacity: 0.35 }} />
            <span className="block h-1.5 w-2/3 rounded-full bg-panel-2" />
          </div>
        </div>
      ))}
    </div>
  )
}

function Csv() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-16 place-items-center rounded-xl border border-line bg-panel shadow-card transition-transform duration-500 group-hover:translate-x-1">
        <FileSpreadsheet size={26} className="text-[#00b884]" />
        <span className="-mt-2 font-mono text-[10px] text-faint">.csv</span>
      </div>
      <div className="h-px w-8 bg-line-strong" />
      <div className="w-[110px] overflow-hidden rounded-lg border border-line bg-panel text-[10.5px] shadow-card">
        {[C.green, C.orange, C.slate].map((c, i) => (
          <div key={c} className="flex items-center gap-1.5 border-t border-line px-2 py-1.5 first:border-t-0">
            <span className="h-1.5 flex-1 rounded-full bg-panel-2" />
            <span className="h-3 w-7 origin-left scale-x-0 rounded-sm transition-transform duration-300 group-hover:scale-x-100" style={{ background: c, transitionDelay: `${150 + i * 90}ms` }} />
          </div>
        ))}
      </div>
    </div>
  )
}

function Themes() {
  return (
    <div className="relative h-[110px] w-full max-w-[230px] overflow-hidden rounded-xl border border-line shadow-card">
      <div className="absolute inset-0 bg-[#f6f7fb] p-3">
        <Sun size={15} className="text-[#f7b500]" />
        <ThemeLines fg="#171a2b" line="#e4e6ef" />
      </div>
      <div className="absolute inset-0 bg-[#0d0f1a] p-3 transition-[clip-path] duration-500 ease-out [clip-path:inset(0_0_0_55%)] group-hover:[clip-path:inset(0_0_0_12%)]">
        <Moon size={15} className="ml-auto text-[#7c7cff]" />
        <ThemeLines fg="#eceef8" line="#262b42" />
      </div>
    </div>
  )
}
function ThemeLines({ fg, line }: { fg: string; line: string }) {
  return (
    <div className="mt-3 space-y-2">
      <span className="block h-2 w-3/4 rounded-full" style={{ background: fg, opacity: 0.8 }} />
      <span className="block h-2 w-full rounded-full" style={{ background: line }} />
      <span className="block h-2 w-1/2 rounded-full" style={{ background: line }} />
    </div>
  )
}

function Keys() {
  return (
    <div className="flex flex-wrap justify-center gap-2 font-mono text-[13px]">
      {['Ctrl', 'K', 'N', '/', 'Esc', 'D'].map((k) => (
        <kbd key={k} className="lp-key grid h-10 min-w-10 place-items-center rounded-lg border border-line bg-panel px-2.5 text-fg">
          {k}
        </kbd>
      ))}
    </div>
  )
}

/* ───────────────────────── Self-host ───────────────────────── */

const STEPS = [
  {
    title: 'Fork the repository',
    body: 'Fork Tideline on GitHub, then clone your fork. Local mode works right away: data stays in the browser, no account needed.',
    code: 'git clone https://github.com/<you>/tideline\ncd tideline\nnpm install\nnpm run dev',
  },
  {
    title: 'Create a free Supabase project',
    body: 'Open the SQL editor and run supabase/schema.sql. It creates the table, row-level security and realtime. Turn off public sign-ups and invite your team by email.',
    code: '# .env\nVITE_SUPABASE_URL=https://<project>.supabase.co\nVITE_SUPABASE_ANON_KEY=<anon key>',
  },
  {
    title: 'Deploy it',
    body: 'Add the two values as repository secrets and set Pages to deploy from GitHub Actions. The included workflow builds and publishes on every push to main. Vercel works too.',
    code: 'git push origin main\n# or\nnpx vercel --prod',
  },
]

export function SelfHost() {
  return (
    <section aria-labelledby="host-h" id="self-host" className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
      <SectionHead id="host-h" title="Yours to run, in about ten minutes">
        Tideline is a static site plus one Postgres table. Host it on free tiers you control, and your data never sits on someone else's servers.
      </SectionHead>
      <Reveal as="ol" className="mt-12 grid gap-4 lg:grid-cols-3">
        {STEPS.map((s, i) => (
          <RevealItem as="li" key={s.title} className="flex min-w-0 flex-col rounded-[20px] border border-line bg-panel p-5">
            <span className="grid size-9 place-items-center rounded-full border border-line font-display text-[15px] font-bold text-accent" aria-hidden>
              {i + 1}
            </span>
            <h3 className="mt-4 font-display text-[19px] font-semibold tracking-tight">
              <span className="sr-only">Step {i + 1}: </span>
              {s.title}
            </h3>
            <p className="mt-2 mb-5 text-[14.5px] leading-relaxed text-muted">{s.body}</p>
            <CodeBlock code={s.code} />
          </RevealItem>
        ))}
      </Reveal>
    </section>
  )
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard blocked: the text is still selectable */
    }
  }
  return (
    <div className="relative mt-auto rounded-xl bg-[#11132a] text-[#d9dcf2] dark:bg-[#0a0c18]">
      <pre className="overflow-x-auto p-4 pr-12 font-mono text-[12.5px] leading-relaxed">
        {code.split('\n').map((l, i) => (
          <div key={i} className={l.startsWith('#') ? 'text-[#7d84a8]' : undefined}>
            {l || ' '}
          </div>
        ))}
      </pre>
      <button
        type="button"
        onClick={copy}
        className="absolute top-2.5 right-2.5 grid size-8 place-items-center rounded-lg text-[#9aa0c4] transition-colors hover:bg-white/10 hover:text-white"
        aria-label={copied ? 'Copied' : 'Copy code'}
      >
        {copied ? <Check size={15} /> : <Copy size={15} />}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? 'Copied to clipboard' : ''}
      </span>
    </div>
  )
}

