import { motion } from 'motion/react'
import { cx } from '../components/ui'
import { C, Face, PEOPLE, type Person } from './shared'

const S = {
  todo: ['Not started', C.slate],
  wip: ['Working on it', C.orange],
  stuck: ['Stuck', C.red],
  done: ['Done', C.green],
} as const
type St = keyof typeof S

const ITEMS: { name: string; who: Person; st: St; date: string; tags: string[] }[] = [
  { name: 'Interview five pilot teams', who: PEOPLE.ines, st: 'done', date: 'Nov 12', tags: ['Research'] },
  { name: 'Write release notes', who: PEOPLE.sam, st: 'wip', date: 'Nov 21', tags: ['Content'] },
  { name: 'Migrate board permissions', who: PEOPLE.leo, st: 'stuck', date: 'Nov 24', tags: ['Backend'] },
  { name: 'Calendar view keyboard nav', who: PEOPLE.maya, st: 'wip', date: 'Nov 26', tags: ['Frontend', 'A11y'] },
  { name: 'CSV import edge cases', who: PEOPLE.leo, st: 'todo', date: 'Dec 2', tags: ['Backend'] },
  { name: 'Team offsite agenda', who: PEOPLE.ines, st: 'todo', date: 'Dec 8', tags: ['Ops'] },
]

export function TableMock() {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px] overflow-hidden rounded-lg border border-line border-l-[3px]" style={{ borderLeftColor: C.indigo }}>
        <div className="grid grid-cols-[1fr_52px_120px_86px_1fr] bg-panel-2/60 text-[11.5px] text-faint">
          {['Item', 'Owner', 'Status', 'Due', 'Tags'].map((h, i) => (
            <span key={h} className={cx('px-3 py-2', i > 0 && 'border-l border-line')}>
              {h}
            </span>
          ))}
        </div>
        {ITEMS.map((it) => (
          <div key={it.name} className="grid grid-cols-[1fr_52px_120px_86px_1fr] border-t border-line text-[13px]">
            <span className="truncate px-3 py-2.5">{it.name}</span>
            <span className="grid place-items-center border-l border-line">
              <Face p={it.who} />
            </span>
            <span className="border-l border-line p-[3px]">
              <span className="grid h-full place-items-center rounded-[5px] text-[11.5px] font-medium text-white" style={{ background: S[it.st][1] }}>
                {S[it.st][0]}
              </span>
            </span>
            <span className="flex items-center border-l border-line px-3 text-muted tabular-nums">{it.date}</span>
            <span className="flex items-center gap-1 border-l border-line px-2">
              {it.tags.map((t) => (
                <span key={t} className="rounded-md bg-panel-2 px-1.5 py-0.5 text-[11px] text-muted">
                  {t}
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function KanbanMock() {
  const cols: St[] = ['todo', 'wip', 'stuck', 'done']
  return (
    <div className="overflow-x-auto pb-1">
      <div className="grid min-w-[640px] grid-cols-4 gap-3">
        {cols.map((st) => {
          const cards = ITEMS.filter((i) => i.st === st)
          return (
            <div key={st} className="rounded-xl bg-panel-2/70 p-2">
              <div className="mb-2 flex items-center justify-between rounded-md px-2 py-1.5 text-[12px] font-medium text-white" style={{ background: S[st][1] }}>
                {S[st][0]}
                <span className="opacity-80 tabular-nums">{cards.length}</span>
              </div>
              <div className="space-y-2">
                {cards.map((c, i) => (
                  <div
                    key={c.name}
                    className={cx(
                      'rounded-lg border border-line bg-panel p-2.5 text-[12.5px] shadow-card',
                      st === 'wip' && i === 1 && 'rotate-[2.5deg] shadow-pop ring-2 ring-accent/40',
                    )}
                  >
                    <div className="leading-snug">{c.name}</div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="rounded bg-panel-2 px-1.5 py-0.5 text-[10.5px] text-muted tabular-nums">{c.date}</span>
                      <Face p={c.who} size={20} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function TimelineMock() {
  const weeks = ['Nov 9', 'Nov 16', 'Nov 23', 'Nov 30', 'Dec 7']
  const bars: { name: string; st: St; s: number; w: number; who: Person }[] = [
    { name: 'Research', st: 'done', s: 0, w: 22, who: PEOPLE.ines },
    { name: 'Permissions', st: 'stuck', s: 24, w: 30, who: PEOPLE.leo },
    { name: 'Release notes', st: 'wip', s: 34, w: 18, who: PEOPLE.sam },
    { name: 'Calendar a11y', st: 'wip', s: 30, w: 40, who: PEOPLE.maya },
    { name: 'CSV import', st: 'todo', s: 58, w: 24, who: PEOPLE.leo },
    { name: 'Offsite', st: 'todo', s: 78, w: 16, who: PEOPLE.ines },
  ]
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        <div className="grid grid-cols-[110px_1fr] text-[11.5px] text-faint">
          <span />
          <div className="grid grid-cols-5">
            {weeks.map((w) => (
              <span key={w} className="border-l border-line px-2 py-1.5">
                {w}
              </span>
            ))}
          </div>
        </div>
        <div className="relative">
          {bars.map((b, i) => (
            <div key={b.name} className="grid grid-cols-[110px_1fr] border-t border-line">
              <span className="truncate py-2.5 pr-2 text-[12.5px]">{b.name}</span>
              <div className="relative grid grid-cols-5">
                {[0, 1, 2, 3, 4].map((k) => (
                  <span key={k} className="border-l border-line" />
                ))}
                <motion.span
                  className="absolute top-1/2 flex h-6 -translate-y-1/2 items-center gap-1.5 rounded-full pr-2 pl-0.5 text-[11px] font-medium text-white"
                  style={{ left: `${b.s}%`, width: `${b.w}%`, background: S[b.st][1], transformOrigin: 'left' }}
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 + i * 0.07, duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
                >
                  <Face p={b.who} size={20} />
                  <span className="truncate">{S[b.st][0]}</span>
                </motion.span>
              </div>
            </div>
          ))}
          {/* today marker */}
          <span className="pointer-events-none absolute inset-y-0 w-px bg-tide" style={{ left: 'calc(110px + (100% - 110px) * 0.31)' }}>
            <span className="absolute -top-1 -left-[3px] size-[7px] rounded-full bg-tide" />
          </span>
        </div>
      </div>
    </div>
  )
}

export function CalendarMock() {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const first = new Date(y, m, 1)
  const lead = (first.getDay() + 6) % 7 // weeks start on Mon
  const days = new Date(y, m + 1, 0).getDate()
  const cells = Array.from({ length: Math.ceil((lead + days) / 7) * 7 }, (_, i) => i - lead + 1)
  const events: Record<number, { t: string; c: string }[]> = {
    3: [{ t: 'Sprint review', c: C.indigo }],
    6: [{ t: 'Invoices', c: C.amber }],
    10: [{ t: 'Release notes', c: C.orange }],
    12: [{ t: 'Pilot calls', c: C.teal }, { t: '1:1 Leo', c: C.violet }],
    17: [{ t: 'Board sync', c: C.sky }],
    19: [{ t: 'Ship v1.4', c: C.green }],
    24: [{ t: 'Permissions', c: C.red }],
    26: [{ t: 'Offsite prep', c: C.pink }],
  }
  const month = first.toLocaleDateString('en', { month: 'long', year: 'numeric' })
  return (
    <div>
      <div className="mb-2 font-display text-[15px] font-semibold">{month}</div>
      <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-line text-[11px]">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <span key={d} className="bg-panel-2/60 px-1.5 py-1 text-faint">
            {d}
          </span>
        ))}
        {cells.map((d, i) => {
          const inMonth = d >= 1 && d <= days
          const today = inMonth && d === now.getDate()
          return (
            <div key={i} className={cx('min-h-[52px] border-t border-line p-1 sm:min-h-[60px]', i % 7 && 'border-l', !inMonth && 'bg-panel-2/40')}>
              {inMonth && (
                <span className={cx('inline-grid size-5 place-items-center rounded-full tabular-nums', today ? 'bg-accent font-semibold text-white' : 'text-muted')}>{d}</span>
              )}
              {inMonth &&
                events[d]?.map((e) => (
                  <span key={e.t} className="mt-0.5 block truncate rounded px-1 py-px text-[10.5px] font-medium text-white" style={{ background: e.c }}>
                    {e.t}
                  </span>
                ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function DashboardMock() {
  const tiles = [
    { k: 'Done this week', v: '18', c: C.green },
    { k: 'In progress', v: '7', c: C.orange },
    { k: 'Overdue', v: '2', c: C.red },
  ]
  const byPerson = [
    { p: PEOPLE.maya, done: 7, wip: 3 },
    { p: PEOPLE.leo, done: 4, wip: 2 },
    { p: PEOPLE.ines, done: 5, wip: 1 },
    { p: PEOPLE.sam, done: 2, wip: 1 },
  ]
  const split = [
    { c: C.green, v: 46 },
    { c: C.orange, v: 24 },
    { c: C.red, v: 8 },
    { c: C.slate, v: 22 },
  ]
  let acc = 0
  const conic = split.map((s) => `${s.c} ${acc}% ${(acc += s.v)}%`).join(', ')
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
      <div className="grid grid-cols-3 gap-3 sm:col-span-2">
        {tiles.map((t) => (
          <div key={t.k} className="rounded-xl border border-line bg-panel p-3">
            <div className="text-[11.5px] text-muted">{t.k}</div>
            <div className="mt-1 font-display text-[26px] leading-none font-bold tabular-nums" style={{ color: t.c }}>
              {t.v}
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-line bg-panel p-3">
        <div className="mb-3 text-[12px] font-medium">Items by owner</div>
        <div className="flex h-[132px] items-end justify-around gap-3">
          {byPerson.map((b, i) => (
            <div key={b.p.name} className="flex flex-col items-center gap-1.5">
              <div className="flex h-[100px] w-7 flex-col justify-end overflow-hidden rounded-md">
                <motion.span
                  className="block w-full"
                  style={{ background: C.orange, height: `${b.wip * 9}%`, transformOrigin: 'bottom' }}
                  initial={{ scaleY: 0 }}
                  whileInView={{ scaleY: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.25 + i * 0.08, duration: 0.5 }}
                />
                <motion.span
                  className="block w-full"
                  style={{ background: C.green, height: `${b.done * 9}%`, transformOrigin: 'bottom' }}
                  initial={{ scaleY: 0 }}
                  whileInView={{ scaleY: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 + i * 0.08, duration: 0.5 }}
                />
              </div>
              <Face p={b.p} size={20} />
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-4 rounded-xl border border-line bg-panel p-3">
        <div className="relative size-[112px] shrink-0 rounded-full" style={{ background: `conic-gradient(${conic})` }}>
          <div className="absolute inset-[18px] grid place-items-center rounded-full bg-panel text-center">
            <span className="font-display text-xl leading-none font-bold">46%</span>
          </div>
        </div>
        <ul className="space-y-1.5 text-[12px] text-muted">
          {(['done', 'wip', 'stuck', 'todo'] as St[]).map((s) => (
            <li key={s} className="flex items-center gap-2">
              <span className="size-2.5 rounded-sm" style={{ background: S[s][1] }} />
              {S[s][0]}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
