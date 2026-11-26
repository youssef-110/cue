import { useCallback, useEffect, useMemo, useState } from 'react'
import { addMonths, format, parseISO } from 'date-fns'
import { CalendarDays, Check, ChevronLeft, ChevronRight, Eye, Plus, Users } from 'lucide-react'
import { changeEvents, deleteEvent, useCanEdit, useStore } from '../lib/store'
import { addDays, atMinutes, browserTz, minutesOf, monthGrid, occurrences, personColors, shiftSeries, skip, weekStart, type Occ } from '../lib/calendar'
import { inkOn, uid } from '../lib/seed'
import type { CalEvent, User } from '../lib/types'
import { Button, Kbd, Popover, cx } from '../components/ui'
import { TimeGrid } from '../calendar/TimeGrid'
import { MonthView } from '../calendar/MonthView'
import { AskSeries, EventDetails, EventEditor } from '../calendar/Editor'
import { fmtDay, fmtTime, occId, useMedia, useNow, type CalApi } from '../calendar/parts'

type ViewKind = 'day' | 'week' | 'month'
const VIEWS: [ViewKind, string, string][] = [
  ['day', 'Day', 'D'],
  ['week', 'Week', 'W'],
  ['month', 'Month', 'M'],
]
const TAB = 'caps relative flex h-10 shrink-0 items-center gap-1.5 rounded-t-md px-4 text-[15px] font-semibold tracking-[0.1em] transition-colors'
const TAB_ON = 'bg-bg text-fg'
const TAB_OFF = 'text-on-signal/80 hover:bg-on-signal/10 hover:text-on-signal'
const VIEW_KEY = 'cue:cal-view'
const HIDDEN_KEY = 'cue:cal-hidden'

const load = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
const keep = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* private window: the choice just isn't remembered */
  }
}
const sameDays = (a?: number[], b?: number[]) => (a ?? []).join() === (b ?? []).join()

/** Personal and team calendar: everyone's schedule, each person's in their own colour, filterable per person. */
export function CalendarPage() {
  const tz = useMemo(() => browserTz(), [])
  const now = useNow(tz)
  const today = now.slice(0, 10)
  const narrow = useMedia('(max-width: 767px)')
  const [view, setViewRaw] = useState<ViewKind>(() => load(VIEW_KEY, 'week'))
  const setView = useCallback((next: ViewKind) => {
    setViewRaw(next)
    keep(VIEW_KEY, next)
  }, [])
  const v: ViewKind = narrow ? 'day' : view
  const [cursor, setCursor] = useState(today)
  const [hidden, setHiddenRaw] = useState<string[]>(() => load(HIDDEN_KEY, []))
  const setHidden = (ids: string[]) => (setHiddenRaw(ids), keep(HIDDEN_KEY, ids))

  const users = useStore((s) => s.user)
  const events = useStore((s) => s.event)
  const meId = useStore((s) => s.meId)
  const editable = useCanEdit()

  const people = useMemo(
    () => Object.values(users).filter((u) => !u.removedAt).sort((a, b) => +(b.id === meId) - +(a.id === meId) || a.name.localeCompare(b.name)),
    [users, meId],
  )
  const colors = useMemo(() => personColors(people), [people])
  const shown = useMemo(() => Object.values(events).filter((e) => colors[e.ownerId] && !hidden.includes(e.ownerId)), [events, colors, hidden])

  const days = useMemo(() => (v === 'day' ? [cursor] : v === 'week' ? Array.from({ length: 7 }, (_, i) => addDays(weekStart(cursor), i)) : monthGrid(cursor)), [v, cursor])
  const occs = useMemo(() => occurrences(shown, days[0], days[days.length - 1], tz), [shown, days, tz])

  // ---------- open things ----------
  const [details, setDetails] = useState<{ occ: Occ; anchor: HTMLElement } | null>(null)
  const [editing, setEditing] = useState<{ draft: CalEvent; occ?: Occ; isNew: boolean } | null>(null)
  const [ask, setAsk] = useState<{ verb: string; resolve: (c: 'this' | 'all' | null) => void } | null>(null)
  const askSeries = (verb: string) => new Promise<'this' | 'all' | null>((resolve) => setAsk({ verb, resolve }))
  const busy = !!details || !!editing || !!ask
  // details show the live event, so a change from elsewhere (or an undo) is reflected
  const detailOcc = details && events[details.occ.ev.id] ? { ...details.occ, ev: events[details.occ.ev.id] } : null

  const create = useCallback(
    (start: string, end: string, allDay?: boolean) => {
      if (!editable) return
      setDetails(null)
      const t = Date.now()
      setEditing({ isNew: true, draft: { id: uid('e_'), ownerId: meId, title: '', start, end, allDay: allDay || undefined, tz, createdAt: t, updatedAt: t } })
    },
    [editable, meId, tz],
  )
  // one date split off a series, as its own event
  const split = (ev: CalEvent, fields: Partial<CalEvent>): CalEvent => ({ ...ev, ...fields, id: uid('e_'), repeat: undefined, exceptions: undefined, seriesId: ev.id, tz, createdAt: Date.now() })

  async function move(o: Occ, start: string, end: string) {
    const ev = events[o.ev.id]
    if (!ev) return
    setDetails(null)
    if (!ev.repeat?.days.length) return changeEvents([{ ...ev, start, end, tz: ev.allDay ? ev.tz : tz }], [], `Moved “${ev.title}”`)
    const choice = await askSeries('Move')
    if (choice === 'this') changeEvents([skip(ev, o.key), split(ev, { start, end })], [], `Moved “${ev.title}” on ${fmtDay(start)}`)
    if (choice === 'all') changeEvents([shiftSeries(ev, o, { start, end })], [], `Moved every “${ev.title}”`)
  }

  async function save(e: CalEvent) {
    if (!editing) return
    const { isNew, occ } = editing
    const ev = events[e.id]
    if (isNew || !ev || !ev.repeat?.days.length || !occ) {
      setEditing(null)
      return changeEvents([{ ...e, tz: ev?.allDay && e.allDay ? ev.tz : tz }])
    }
    const choice = await askSeries('Change')
    if (!choice) return // back to the editor
    setEditing(null)
    if (choice === 'this') return changeEvents([skip(ev, occ.key), split(ev, { ...e, repeat: undefined })], [], `Changed “${e.title}” on ${fmtDay(e.start)}`)
    const shifted = shiftSeries(ev, occ, e)
    changeEvents([{ ...shifted, title: e.title, notes: e.notes, location: e.location, allDay: e.allDay, repeat: sameDays(e.repeat?.days, ev.repeat.days) && e.repeat ? { ...shifted.repeat!, until: e.repeat.until } : e.repeat }])
  }

  async function remove(o: Occ) {
    const ev = events[o.ev.id]
    setDetails(null)
    if (!ev) return
    if (!ev.repeat?.days.length) return deleteEvent(ev.id)
    const choice = await askSeries('Delete')
    if (choice === 'this') changeEvents([skip(ev, o.key)], [], `Deleted “${ev.title}” on ${fmtDay(o.start)}`)
    if (choice === 'all') deleteEvent(ev.id)
  }

  const step = useCallback(
    (n: number) => setCursor((c) => (v === 'month' ? format(addMonths(parseISO(c), n), 'yyyy-MM-dd') : addDays(c, n * (v === 'week' ? 7 : 1)))),
    [v],
  )
  const createNow = useCallback(() => {
    const onToday = days.includes(today) && v !== 'month'
    const start = onToday ? atMinutes(today, Math.min(1380, Math.ceil((minutesOf(now) + 1) / 30) * 30)) : cursor + 'T09:00'
    create(start, atMinutes(start, minutesOf(start) + 60))
  }, [days, today, v, now, cursor, create])

  // keyboard: t today, d/w/m views, arrows or j/k to move, c create (Esc closes what is open)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable || e.metaKey || e.ctrlKey || e.altKey) return
      if (busy || useStore.getState().paletteOpen) return
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      const act: Record<string, () => void> = {
        t: () => setCursor(today),
        d: () => setView('day'),
        w: () => setView('week'),
        m: () => setView('month'),
        ArrowLeft: () => step(-1),
        k: () => step(-1),
        ArrowRight: () => step(1),
        j: () => step(1),
        c: createNow,
      }
      if (!act[key]) return
      e.preventDefault()
      act[key]()
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [busy, today, step, createNow, setView])

  const api: CalApi = {
    colors,
    users,
    meId,
    canCreate: editable,
    selected: details ? occId(details.occ) : undefined,
    busy,
    create,
    open: (o, anchor) => setDetails({ occ: o, anchor }),
    move: (o, s, e) => void move(o, s, e),
    goDay: (d) => (setCursor(d), setView('day')),
  }

  const label =
    v === 'day'
      ? fmtDay(cursor, 'EEE d MMMM yyyy')
      : v === 'month'
        ? fmtDay(cursor, 'MMMM yyyy')
        : days[0].slice(0, 7) === days[6].slice(0, 7)
          ? `${+days[0].slice(8)} – ${fmtDay(days[6], 'd MMM yyyy')}`
          : `${fmtDay(days[0], days[0].slice(0, 4) === days[6].slice(0, 4) ? 'd MMM' : 'd MMM yyyy')} – ${fmtDay(days[6], 'd MMM yyyy')}`

  const panel = (
    <>
      <MiniMonth key={cursor.slice(0, 7)} cursor={cursor} today={today} days={v === 'month' ? days.filter((d) => d.slice(0, 7) === cursor.slice(0, 7)) : days} events={shown} tz={tz} onPick={setCursor} />
      <People people={people} colors={colors} meId={meId} hidden={hidden} setHidden={setHidden} />
    </>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Band now={now} occs={occs} events={shown} tz={tz} view={v} narrow={narrow} setView={setView} editable={editable} />

      <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-8">
        {editable && (
          <Button variant="primary" onClick={createNow} title="Create an event (C)">
            <Plus /> Create
          </Button>
        )}
        <Button variant="outline" onClick={() => setCursor(today)} title="Go to today (T)">
          Today
        </Button>
        <div className="flex">
          <Button variant="ghost" className="w-8 px-0" onClick={() => step(-1)} aria-label={`Previous ${v}`} title={`Previous ${v} (K or ←)`}>
            <ChevronLeft />
          </Button>
          <Button variant="ghost" className="w-8 px-0" onClick={() => step(1)} aria-label={`Next ${v}`} title={`Next ${v} (J or →)`}>
            <ChevronRight />
          </Button>
        </div>
        <h2 aria-live="polite" className="font-mono text-[15px] font-semibold uppercase">
          {label}
        </h2>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden items-center gap-1 text-[12px] text-faint lg:flex">
            <Kbd>T</Kbd> today <Kbd>D</Kbd>
            <Kbd>W</Kbd>
            <Kbd>M</Kbd> view <Kbd>C</Kbd> create
          </span>
          <PeopleButton count={people.length - hidden.filter((id) => colors[id]).length} total={people.length}>
            {panel}
          </PeopleButton>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 border-t border-line">
        <aside aria-label="Calendars" className="hidden w-[232px] shrink-0 flex-col gap-6 overflow-y-auto border-r border-line bg-bg px-3 py-4 min-[1100px]:flex">
          {panel}
        </aside>
        {v === 'month' ? (
          <MonthView days={days} month={cursor} occs={occs} today={today} api={api} />
        ) : (
          <TimeGrid days={days} occs={occs} today={today} now={now} api={api} />
        )}
      </div>

      <EventDetails
        occ={detailOcc}
        anchor={details?.anchor ?? null}
        color={detailOcc ? colors[detailOcc.ev.ownerId] : ''}
        owner={detailOcc ? users[detailOcc.ev.ownerId] : undefined}
        editable={!!detailOcc && editable && detailOcc.ev.ownerId === meId}
        zoneNote={
          // only when the event's own clock reads differently from yours
          detailOcc && !detailOcc.ev.allDay && atMinutes(detailOcc.key, minutesOf(detailOcc.ev.start)) !== detailOcc.start
            ? `Set in ${detailOcc.ev.tz.replace(/_/g, ' ')}, shown in your time`
            : undefined
        }
        onClose={() => setDetails(null)}
        onEdit={() => {
          if (!detailOcc) return
          setEditing({ draft: { ...detailOcc.ev, start: detailOcc.start, end: detailOcc.end, tz }, occ: detailOcc, isNew: false })
          setDetails(null)
        }}
        onDelete={() => detailOcc && void remove(detailOcc)}
      />
      {editing && <EventEditor key={editing.draft.id} draft={editing.draft} isNew={editing.isNew} onSave={(e) => void save(e)} onClose={() => setEditing(null)} />}
      <AskSeries ask={ask} onAnswer={(c) => (ask?.resolve(c), setAsk(null))} />
    </div>
  )
}

/** The station sign: what is on now and next, and the view tabs. */
function Band({ now, occs, events, tz, view, narrow, setView, editable }: { now: string; occs: Occ[]; events: CalEvent[]; tz: string; view: ViewKind; narrow: boolean; setView: (v: ViewKind) => void; editable: boolean }) {
  const today = now.slice(0, 10)
  // what's on: the next two weeks, from now
  const soon = useMemo(() => occurrences(events, today, addDays(today, 14), tz).filter((o) => !o.ev.allDay && o.end > now), [events, today, tz, now])
  const current = soon.find((o) => o.start <= now)
  const next = soon.find((o) => o.start > now)
  return (
    <header className="band min-w-0 shrink-0 border-b-2 border-ink bg-signal px-4 pt-4 text-on-signal sm:px-8 dark:border-line-strong">
      <div className="caps flex items-center gap-2 text-[12.5px] font-semibold tracking-[0.12em]">
        <span className="grid size-7 shrink-0 place-items-center rounded-sm bg-on-signal text-signal">
          <CalendarDays className="size-4" />
        </span>
        <span className="text-on-signal/80">Team</span>
        {!editable && (
          <span className="ml-1 flex shrink-0 items-center gap-1 rounded-sm border border-on-signal/40 px-1.5 py-0.5 text-[11.5px]">
            <Eye className="size-3.5" /> View only
          </span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        <h1 className="caps text-[30px] font-bold leading-[1.02] tracking-[0.015em] sm:text-[44px]">Calendar</h1>
        <p className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[13px] font-medium uppercase [&>*]:whitespace-nowrap">
          {current && (
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="rounded-sm bg-on-signal px-1.5 py-0.5 text-[11px] font-semibold text-signal">Now</span>
              <span className="max-w-[22ch] truncate font-sans text-[14px] font-semibold normal-case">{current.ev.title}</span> to {fmtTime(current.end)}
            </span>
          )}
          {next && (
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="rounded-sm border border-on-signal/60 px-1.5 py-0.5 text-[11px] font-semibold">Next</span>
              <span className="max-w-[22ch] truncate font-sans text-[14px] font-semibold normal-case">{next.ev.title}</span>
              {next.start.slice(0, 10) === today ? fmtTime(next.start) : `${fmtDay(next.start, 'EEE d')} ${fmtTime(next.start)}`}
            </span>
          )}
          <span className="opacity-80">
            <b className="font-semibold">{occs.length}</b> in view · {fmtDay(now, 'EEE d MMM')} {fmtTime(now)}
          </span>
        </p>
      </div>
      <nav aria-label="Calendar view" className="-mx-4 -mb-[2px] mt-4 flex items-end gap-0.5 overflow-x-auto overflow-y-hidden px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {VIEWS.filter(([k]) => !narrow || k === 'day').map(([k, name, key]) => (
          <button key={k} onClick={() => setView(k)} aria-current={view === k ? 'page' : undefined} title={`${name} (${key})`} className={cx(TAB, view === k ? TAB_ON : TAB_OFF)}>
            {name}
          </button>
        ))}
      </nav>
    </header>
  )
}

/** Month navigator: pick a day; the shown days are selected, days with events carry a dot. */
function MiniMonth({ cursor, today, days, events, tz, onPick }: { cursor: string; today: string; days: string[]; events: CalEvent[]; tz: string; onPick: (d: string) => void }) {
  const [month, setMonth] = useState(cursor.slice(0, 7)) // keyed by the cursor's month, so it follows the page
  const grid = useMemo(() => monthGrid(month + '-01'), [month])
  const marks = useMemo(() => new Set(occurrences(events, grid[0], grid[41], tz).map((o) => o.start.slice(0, 10))), [events, grid, tz])
  const shift = (n: number) => setMonth(format(addMonths(parseISO(month + '-01'), n), 'yyyy-MM'))
  return (
    <section aria-label="Month navigator">
      <div className="mb-1 flex items-center gap-1 px-1">
        <h3 className="caps flex-1 text-[14px] font-semibold tracking-[0.08em]">{fmtDay(month + '-01', 'MMMM yyyy')}</h3>
        <button onClick={() => shift(-1)} aria-label="Previous month" className="grid size-7 place-items-center rounded-md text-muted transition-colors hover:bg-hover hover:text-fg">
          <ChevronLeft className="size-4" />
        </button>
        <button onClick={() => shift(1)} aria-label="Next month" className="grid size-7 place-items-center rounded-md text-muted transition-colors hover:bg-hover hover:text-fg">
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center font-mono">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i} aria-hidden className="py-1 text-[10.5px] font-medium text-faint">
            {d}
          </span>
        ))}
        {grid.map((d) => {
          const on = days.includes(d)
          return (
            <button
              key={d}
              onClick={() => onPick(d)}
              aria-label={fmtDay(d, 'EEEE d MMMM')}
              aria-current={d === today ? 'date' : undefined}
              className={cx(
                'relative mx-auto grid size-7 place-items-center rounded-md text-[12px] font-medium transition-colors',
                d === today ? 'bg-ink font-semibold text-on-ink dark:bg-signal dark:text-on-signal' : on ? 'bg-accent-soft text-accent' : d.slice(0, 7) === month ? 'text-fg hover:bg-hover' : 'text-faint hover:bg-hover',
              )}
            >
              {+d.slice(8)}
              {marks.has(d) && <span aria-hidden className={cx('absolute bottom-[3px] size-[3px] rounded-full', d === today ? 'bg-current' : 'bg-muted')} />}
            </button>
          )
        })}
      </div>
    </section>
  )
}

/** "My calendars": every teammate with their colour; tick to show or hide, or show only one. */
function People({ people, colors, meId, hidden, setHidden }: { people: User[]; colors: Record<string, string>; meId: string; hidden: string[]; setHidden: (ids: string[]) => void }) {
  return (
    <section aria-label="Team calendars">
      <div className="mb-1 flex items-baseline border-b-2 border-fg px-1 pb-1">
        <h3 className="caps flex-1 text-[12px] font-semibold tracking-[0.12em]">Team calendars</h3>
        {hidden.some((id) => colors[id]) && (
          <button onClick={() => setHidden([])} className="text-[12px] text-accent hover:underline">
            Show all
          </button>
        )}
      </div>
      <ul className="mt-1">
        {people.map((p) => {
          const c = colors[p.id]
          const on = !hidden.includes(p.id)
          return (
            <li key={p.id} className="group flex h-8 items-center rounded-sm pr-1 transition-colors hover:bg-hover">
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 px-1.5">
                <input type="checkbox" className="peer sr-only" checked={on} onChange={() => setHidden(on ? [...hidden, p.id] : hidden.filter((x) => x !== p.id))} />
                <span
                  aria-hidden
                  className="grid size-4 shrink-0 place-items-center rounded-[3px] border-2 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
                  style={{ borderColor: c, background: on ? c : 'transparent', color: inkOn(c) }}
                >
                  {on && <Check className="size-3" strokeWidth={3} />}
                </span>
                <span className={cx('min-w-0 flex-1 truncate text-[13.5px]', !on && 'text-muted')}>
                  {p.name}
                  {p.id === meId && <span className="text-faint"> (you)</span>}
                </span>
              </label>
              <button
                onClick={() => setHidden(people.filter((x) => x.id !== p.id).map((x) => x.id))}
                title={`Show only ${p.name}`}
                className="shrink-0 rounded-sm px-1.5 py-0.5 text-[12px] text-muted opacity-0 transition-opacity hover:bg-panel hover:text-fg focus-visible:opacity-100 group-hover:opacity-100"
              >
                Only
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** Under 1100px the calendars panel opens from the toolbar. */
function PeopleButton({ count, total, children }: { count: number; total: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null)
  return (
    <>
      <Button ref={setAnchor} variant="outline" onClick={() => setOpen(!open)} aria-expanded={open} className="min-[1100px]:hidden">
        <Users /> <span className="font-mono">{count}/{total}</span>
      </Button>
      <Popover anchor={anchor} open={open} onClose={() => setOpen(false)} width={264} align="end" className="flex flex-col gap-5 !p-3">
        {children}
      </Popover>
    </>
  )
}
